import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type ClaimedEvent = {
  id: string;
  event_type: string;
  aggregate_type: string;
  aggregate_id: string;
  tenant_id: string;
  payload: Prisma.JsonValue;
  attempts: number;
  max_attempts: number;
};

@Injectable()
export class OutboxWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxWorker.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  private stopping = false;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    if (process.env.OUTBOX_WORKER_ENABLED === 'false') return;
    const intervalMs = this.readPositiveInt(process.env.OUTBOX_POLL_INTERVAL_MS, 2000, 60000);
    this.timer = setInterval(() => void this.drain(), intervalMs);
    this.timer.unref?.();
    void this.drain();
  }

  async onModuleDestroy() {
    this.stopping = true;
    if (this.timer) clearInterval(this.timer);
    // Nest waits for an active drain to finish before closing Prisma.
    while (this.running) await new Promise(resolve => setTimeout(resolve, 25));
  }

  private readPositiveInt(value: string | undefined, fallback: number, max: number) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
  }

  private async drain() {
    if (this.running || this.stopping) return;
    this.running = true;
    try {
      for (let i = 0; i < 25 && !this.stopping; i++) {
        const event = await this.claimOne();
        if (!event) break;
        await this.process(event);
      }
    } catch (error) {
      this.logger.error('Outbox polling failed', error instanceof Error ? error.stack : String(error));
    } finally {
      this.running = false;
    }
  }

  // Claim one due event atomically; SKIP LOCKED lets concurrent workers poll without processing the same row.
  private async claimOne(): Promise<ClaimedEvent | null> {
    const staleBefore = new Date(Date.now() - 5 * 60 * 1000);
    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE outbox_events
      SET status = 'DEAD_LETTER', locked_at = NULL,
          last_error = 'Worker lease expired after maximum attempts', updated_at = NOW()
      WHERE status = 'PROCESSING' AND locked_at < ${staleBefore}
        AND attempts >= max_attempts
    `);
    const rows = await this.prisma.$queryRaw<ClaimedEvent[]>(Prisma.sql`
      UPDATE outbox_events
      SET status = 'PROCESSING', locked_at = NOW(), attempts = attempts + 1, updated_at = NOW()
      WHERE id = (
        SELECT id FROM outbox_events
        WHERE (
          (status IN ('PENDING','RETRY') AND available_at <= NOW())
          OR (status = 'PROCESSING' AND locked_at < ${staleBefore})
        )
        AND attempts < max_attempts
        ORDER BY available_at ASC, created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      RETURNING id, event_type, aggregate_type, aggregate_id, tenant_id, payload, attempts, max_attempts
    `);
    return rows[0] ?? null;
  }

  private async process(event: ClaimedEvent) {
    try {
      // This relay currently provides durable processing/auditing. External
      // notification adapters can subscribe to event types without changing
      // the transaction that produced the domain event.
      switch (event.event_type) {
        case 'SLO_ALERT_TRIGGERED':
          this.logger.log(JSON.stringify({
            event: 'outbox.event.processed',
            eventId: event.id,
            eventType: event.event_type,
            aggregateType: event.aggregate_type,
            aggregateId: event.aggregate_id,
            tenantId: event.tenant_id,
          }));
          break;
        default:
          throw new Error(`Unsupported outbox event type: ${event.event_type}`);
      }

      await this.prisma.outboxEvent.update({
        where: { id: event.id },
        data: { status: 'PROCESSED', processedAt: new Date(), lockedAt: null, lastError: null },
      });
    } catch (error) {
      const message = (error instanceof Error ? error.message : String(error)).slice(0, 2000);
      const dead = event.attempts >= event.max_attempts;
      const delaySeconds = Math.min(3600, 2 ** Math.min(event.attempts, 10));
      await this.prisma.outboxEvent.update({
        where: { id: event.id },
        data: {
          status: dead ? 'DEAD_LETTER' : 'RETRY',
          availableAt: dead ? new Date() : new Date(Date.now() + delaySeconds * 1000),
          lockedAt: null,
          lastError: message,
        },
      });
      this.logger.error(JSON.stringify({
        event: dead ? 'outbox.event.dead_lettered' : 'outbox.event.retry_scheduled',
        eventId: event.id,
        attempts: event.attempts,
        error: message,
      }));
    }
  }
}
