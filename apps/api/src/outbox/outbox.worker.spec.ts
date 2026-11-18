import { OutboxWorker } from './outbox.worker';
import { PrismaService } from '../prisma/prisma.service';

describe('OutboxWorker', () => {
  const makeWorker = () => {
    const prisma = {
      $queryRaw: jest.fn(),
      $executeRaw: jest.fn(),
      outboxEvent: { update: jest.fn().mockResolvedValue({}) },
    } as unknown as PrismaService;
    return { worker: new OutboxWorker(prisma), prisma };
  };

  const event = {
    id: '00000000-0000-4000-8000-000000000001',
    event_type: 'SLO_ALERT_TRIGGERED',
    aggregate_type: 'INCIDENT',
    aggregate_id: '00000000-0000-4000-8000-000000000002',
    tenant_id: '00000000-0000-4000-8000-000000000003',
    payload: {},
    attempts: 1,
    max_attempts: 8,
  };

  it('marks a supported event as processed', async () => {
    const { worker, prisma } = makeWorker();
    await (worker as any).process(event);
    expect(prisma.outboxEvent.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: event.id },
      data: expect.objectContaining({ status: 'PROCESSED', processedAt: expect.any(Date) }),
    }));
  });

  it('schedules exponential retry for a failed event', async () => {
    const { worker, prisma } = makeWorker();
    await (worker as any).process({ ...event, event_type: 'UNKNOWN_EVENT' });
    expect(prisma.outboxEvent.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: event.id },
      data: expect.objectContaining({ status: 'RETRY', attempts: undefined, lastError: expect.stringContaining('Unsupported') }),
    }));
  });

  it('moves an exhausted event to the dead-letter state', async () => {
    const { worker, prisma } = makeWorker();
    await (worker as any).process({ ...event, event_type: 'UNKNOWN_EVENT', attempts: 8 });
    expect(prisma.outboxEvent.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: event.id },
      data: expect.objectContaining({ status: 'DEAD_LETTER', lockedAt: null }),
    }));
  });
});
