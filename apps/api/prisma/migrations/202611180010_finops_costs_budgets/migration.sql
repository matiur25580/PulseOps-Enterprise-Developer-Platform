CREATE TYPE "CloudProvider" AS ENUM ('AWS', 'AZURE', 'GCP', 'OTHER');
CREATE TABLE "cost_records" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "service_id" UUID,
  "provider" "CloudProvider" NOT NULL,
  "source_record_id" TEXT NOT NULL,
  "resource_id" TEXT NOT NULL,
  "resource_name" TEXT,
  "region" TEXT,
  "billing_period_start" DATE NOT NULL,
  "cost_amount" DECIMAL(18,6) NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "tags" JSONB,
  "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cost_records_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "cost_budgets" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "service_id" UUID,
  "name" TEXT NOT NULL,
  "amount" DECIMAL(18,6) NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "threshold_percent" INTEGER NOT NULL DEFAULT 80,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "cost_budgets_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "cost_budget_events" (
  "id" UUID NOT NULL,
  "budget_id" UUID NOT NULL,
  "period_start" DATE NOT NULL,
  "actual_amount" DECIMAL(18,6) NOT NULL,
  "threshold_percent" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cost_budget_events_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "cost_records_tenant_id_provider_source_record_id_key" ON "cost_records"("tenant_id", "provider", "source_record_id");
CREATE INDEX "cost_records_tenant_id_billing_period_start_idx" ON "cost_records"("tenant_id", "billing_period_start");
CREATE INDEX "cost_records_tenant_id_service_id_billing_period_start_idx" ON "cost_records"("tenant_id", "service_id", "billing_period_start");
CREATE INDEX "cost_records_tenant_id_provider_billing_period_start_idx" ON "cost_records"("tenant_id", "provider", "billing_period_start");
CREATE UNIQUE INDEX "cost_budgets_tenant_id_name_key" ON "cost_budgets"("tenant_id", "name");
CREATE INDEX "cost_budgets_tenant_id_enabled_idx" ON "cost_budgets"("tenant_id", "enabled");
CREATE INDEX "cost_budgets_tenant_id_service_id_idx" ON "cost_budgets"("tenant_id", "service_id");
CREATE UNIQUE INDEX "cost_budget_events_budget_id_period_start_threshold_percent_key" ON "cost_budget_events"("budget_id", "period_start", "threshold_percent");
CREATE INDEX "cost_budget_events_budget_id_created_at_idx" ON "cost_budget_events"("budget_id", "created_at");
ALTER TABLE "cost_records" ADD CONSTRAINT "cost_records_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cost_records" ADD CONSTRAINT "cost_records_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cost_budgets" ADD CONSTRAINT "cost_budgets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cost_budgets" ADD CONSTRAINT "cost_budgets_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cost_budget_events" ADD CONSTRAINT "cost_budget_events_budget_id_fkey" FOREIGN KEY ("budget_id") REFERENCES "cost_budgets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
