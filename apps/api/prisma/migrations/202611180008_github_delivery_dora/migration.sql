CREATE TABLE "github_repository_integrations" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "service_id" UUID NOT NULL,
  "repository_full_name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "github_repository_integrations_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "github_pull_requests" (
  "id" UUID NOT NULL,
  "integration_id" UUID NOT NULL,
  "number" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "merged_at" TIMESTAMP(3),
  "merge_commit_sha" TEXT,
  "head_sha" TEXT NOT NULL,
  "base_ref" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "github_pull_requests_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "deployment_records" (
  "id" UUID NOT NULL,
  "integration_id" UUID NOT NULL,
  "github_deployment_id" TEXT NOT NULL,
  "status_id" TEXT NOT NULL,
  "sha" TEXT NOT NULL,
  "ref" TEXT NOT NULL,
  "environment" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "deployed_at" TIMESTAMP(3),
  "status_updated_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "deployment_records_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "github_webhook_deliveries" (
  "id" UUID NOT NULL,
  "delivery_id" TEXT NOT NULL,
  "integration_id" UUID NOT NULL,
  "event_name" TEXT NOT NULL,
  "action" TEXT,
  "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "github_webhook_deliveries_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "github_repository_integrations_repository_full_name_key" ON "github_repository_integrations"("repository_full_name");
CREATE UNIQUE INDEX "github_repository_integrations_tenant_id_service_id_key" ON "github_repository_integrations"("tenant_id", "service_id");
CREATE INDEX "github_repository_integrations_tenant_id_active_idx" ON "github_repository_integrations"("tenant_id", "active");
CREATE UNIQUE INDEX "github_pull_requests_integration_id_number_key" ON "github_pull_requests"("integration_id", "number");
CREATE INDEX "github_pull_requests_integration_id_merged_at_idx" ON "github_pull_requests"("integration_id", "merged_at");
CREATE INDEX "github_pull_requests_merge_commit_sha_idx" ON "github_pull_requests"("merge_commit_sha");
CREATE UNIQUE INDEX "deployment_records_integration_id_github_deployment_id_key" ON "deployment_records"("integration_id", "github_deployment_id");
CREATE INDEX "deployment_records_integration_id_status_updated_at_idx" ON "deployment_records"("integration_id", "status_updated_at");
CREATE INDEX "deployment_records_integration_id_state_deployed_at_idx" ON "deployment_records"("integration_id", "state", "deployed_at");
CREATE INDEX "deployment_records_sha_idx" ON "deployment_records"("sha");
CREATE UNIQUE INDEX "github_webhook_deliveries_delivery_id_key" ON "github_webhook_deliveries"("delivery_id");
CREATE INDEX "github_webhook_deliveries_integration_id_received_at_idx" ON "github_webhook_deliveries"("integration_id", "received_at");
ALTER TABLE "github_repository_integrations" ADD CONSTRAINT "github_repository_integrations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "github_repository_integrations" ADD CONSTRAINT "github_repository_integrations_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "github_pull_requests" ADD CONSTRAINT "github_pull_requests_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "github_repository_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "deployment_records" ADD CONSTRAINT "deployment_records_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "github_repository_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "github_webhook_deliveries" ADD CONSTRAINT "github_webhook_deliveries_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "github_repository_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
