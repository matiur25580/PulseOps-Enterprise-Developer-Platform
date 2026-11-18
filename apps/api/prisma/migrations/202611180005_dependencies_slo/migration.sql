CREATE TYPE "SloIndicator" AS ENUM ('AVAILABILITY', 'LATENCY');

CREATE TABLE "service_dependencies" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "source_service_id" UUID NOT NULL,
  "target_service_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "service_dependencies_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "service_dependencies_not_self" CHECK ("source_service_id" <> "target_service_id")
);
CREATE UNIQUE INDEX "service_dependencies_tenant_id_source_service_id_target_service_id_key"
  ON "service_dependencies"("tenant_id", "source_service_id", "target_service_id");
CREATE INDEX "service_dependencies_tenant_id_source_service_id_idx" ON "service_dependencies"("tenant_id", "source_service_id");
CREATE INDEX "service_dependencies_tenant_id_target_service_id_idx" ON "service_dependencies"("tenant_id", "target_service_id");
ALTER TABLE "service_dependencies" ADD CONSTRAINT "service_dependencies_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_dependencies" ADD CONSTRAINT "service_dependencies_source_service_id_fkey"
  FOREIGN KEY ("source_service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_dependencies" ADD CONSTRAINT "service_dependencies_target_service_id_fkey"
  FOREIGN KEY ("target_service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "slo_definitions" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "service_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "indicator" "SloIndicator" NOT NULL,
  "target_percent" DOUBLE PRECISION NOT NULL,
  "window_days" INTEGER NOT NULL DEFAULT 30,
  "latency_threshold_ms" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "slo_definitions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "slo_target_range" CHECK ("target_percent" > 0 AND "target_percent" <= 100),
  CONSTRAINT "slo_window_range" CHECK ("window_days" BETWEEN 1 AND 90),
  CONSTRAINT "slo_latency_threshold" CHECK (("indicator" = 'AVAILABILITY' AND "latency_threshold_ms" IS NULL) OR ("indicator" = 'LATENCY' AND "latency_threshold_ms" > 0))
);
CREATE INDEX "slo_definitions_tenant_id_service_id_idx" ON "slo_definitions"("tenant_id", "service_id");
ALTER TABLE "slo_definitions" ADD CONSTRAINT "slo_definitions_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "slo_definitions" ADD CONSTRAINT "slo_definitions_service_id_fkey"
  FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "sli_samples" (
  "id" UUID NOT NULL,
  "slo_id" UUID NOT NULL,
  "success" BOOLEAN NOT NULL,
  "latency_ms" INTEGER,
  "observed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sli_samples_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sli_latency_nonnegative" CHECK ("latency_ms" IS NULL OR "latency_ms" >= 0)
);
CREATE INDEX "sli_samples_slo_id_observed_at_idx" ON "sli_samples"("slo_id", "observed_at");
ALTER TABLE "sli_samples" ADD CONSTRAINT "sli_samples_slo_id_fkey"
  FOREIGN KEY ("slo_id") REFERENCES "slo_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
