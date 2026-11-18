CREATE TYPE "TenantRole" AS ENUM ('ADMIN', 'MEMBER');
CREATE TABLE "users" (
  "id" UUID NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "password_hash" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "tenant_memberships" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "role" "TenantRole" NOT NULL DEFAULT 'MEMBER',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tenant_memberships_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "tenant_memberships_user_id_tenant_id_key" ON "tenant_memberships"("user_id", "tenant_id");
CREATE INDEX "tenant_memberships_tenant_id_role_idx" ON "tenant_memberships"("tenant_id", "role");
ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
