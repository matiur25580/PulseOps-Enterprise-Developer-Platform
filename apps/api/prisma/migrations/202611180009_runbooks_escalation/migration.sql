ALTER TABLE "incidents" ADD COLUMN "service_id" UUID;
ALTER TABLE "incidents" ADD COLUMN "escalation_level" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "incidents" ADD COLUMN "escalated_at" TIMESTAMP(3);
CREATE TABLE "runbook_references" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "service_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'RUNBOOK',
  "is_primary" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "runbook_references_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "escalation_policies" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "service_id" UUID NOT NULL,
  "primary_contact_email" TEXT NOT NULL,
  "secondary_contact_email" TEXT,
  "escalation_after_minutes" INTEGER NOT NULL DEFAULT 15,
  "on_call_url" TEXT,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "escalation_policies_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "runbook_references_one_primary_per_service_idx" ON "runbook_references"("service_id") WHERE "is_primary" = true;
CREATE UNIQUE INDEX "runbook_references_service_id_title_key" ON "runbook_references"("service_id", "title");
CREATE INDEX "runbook_references_tenant_id_service_id_idx" ON "runbook_references"("tenant_id", "service_id");
CREATE UNIQUE INDEX "escalation_policies_tenant_id_service_id_key" ON "escalation_policies"("tenant_id", "service_id");
CREATE INDEX "escalation_policies_tenant_id_idx" ON "escalation_policies"("tenant_id");
CREATE INDEX "incidents_tenant_id_service_id_idx" ON "incidents"("tenant_id", "service_id");
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "runbook_references" ADD CONSTRAINT "runbook_references_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "runbook_references" ADD CONSTRAINT "runbook_references_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "escalation_policies" ADD CONSTRAINT "escalation_policies_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "escalation_policies" ADD CONSTRAINT "escalation_policies_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;
