CREATE TABLE "alert_rules" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "slo_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "threshold_percent" DOUBLE PRECISION NOT NULL,
  "cooldown_minutes" INTEGER NOT NULL DEFAULT 30,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "last_triggered_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "alert_rules_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "alert_rules_threshold_range" CHECK ("threshold_percent" >= 0 AND "threshold_percent" <= 100),
  CONSTRAINT "alert_rules_cooldown_range" CHECK ("cooldown_minutes" BETWEEN 1 AND 1440)
);
CREATE INDEX "alert_rules_tenant_id_enabled_idx" ON "alert_rules"("tenant_id", "enabled");
CREATE INDEX "alert_rules_slo_id_idx" ON "alert_rules"("slo_id");
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_slo_id_fkey"
  FOREIGN KEY ("slo_id") REFERENCES "slo_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "alert_events" (
  "id" UUID NOT NULL,
  "rule_id" UUID NOT NULL,
  "incident_id" UUID,
  "observed_percent" DOUBLE PRECISION NOT NULL,
  "threshold_percent" DOUBLE PRECISION NOT NULL,
  "message" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "alert_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "alert_events_rule_id_created_at_idx" ON "alert_events"("rule_id", "created_at");
ALTER TABLE "alert_events" ADD CONSTRAINT "alert_events_rule_id_fkey"
  FOREIGN KEY ("rule_id") REFERENCES "alert_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
