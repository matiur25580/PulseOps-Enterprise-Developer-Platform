CREATE TABLE "outbox_events" (
  "id" UUID NOT NULL,
  "event_type" TEXT NOT NULL,
  "aggregate_type" TEXT NOT NULL,
  "aggregate_id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "max_attempts" INTEGER NOT NULL DEFAULT 8,
  "available_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "locked_at" TIMESTAMP(3),
  "processed_at" TIMESTAMP(3),
  "last_error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "outbox_events_status_check" CHECK ("status" IN ('PENDING','PROCESSING','RETRY','PROCESSED','DEAD_LETTER')),
  CONSTRAINT "outbox_events_attempts_check" CHECK ("attempts" >= 0 AND "max_attempts" BETWEEN 1 AND 20)
);
CREATE UNIQUE INDEX "outbox_events_idempotency_key_key" ON "outbox_events"("idempotency_key");
CREATE INDEX "outbox_events_status_available_at_created_at_idx" ON "outbox_events"("status","available_at","created_at");
CREATE INDEX "outbox_events_tenant_id_created_at_idx" ON "outbox_events"("tenant_id","created_at");
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
