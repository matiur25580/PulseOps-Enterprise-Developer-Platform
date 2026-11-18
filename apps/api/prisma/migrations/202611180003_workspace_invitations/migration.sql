CREATE TABLE "workspace_invitations" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "email" TEXT NOT NULL,
  "role" "TenantRole" NOT NULL DEFAULT 'MEMBER',
  "token_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "accepted_at" TIMESTAMP(3),
  "revoked_at" TIMESTAMP(3),
  "created_by_user_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "workspace_invitations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "workspace_invitations_token_hash_key" ON "workspace_invitations"("token_hash");
CREATE INDEX "workspace_invitations_tenant_id_email_idx" ON "workspace_invitations"("tenant_id", "email");
CREATE INDEX "workspace_invitations_expires_at_idx" ON "workspace_invitations"("expires_at");

ALTER TABLE "workspace_invitations"
  ADD CONSTRAINT "workspace_invitations_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
