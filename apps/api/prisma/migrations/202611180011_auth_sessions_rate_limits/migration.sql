CREATE TABLE "auth_sessions" ("id" UUID NOT NULL,"user_id" UUID NOT NULL,"tenant_id" UUID NOT NULL,"family_id" UUID NOT NULL,"token_hash" TEXT NOT NULL,"expires_at" TIMESTAMP(3) NOT NULL,"revoked_at" TIMESTAMP(3),"replaced_by_id" UUID,"created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"last_used_at" TIMESTAMP(3),CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "auth_sessions_token_hash_key" ON "auth_sessions"("token_hash");
CREATE INDEX "auth_sessions_user_id_tenant_id_revoked_at_idx" ON "auth_sessions"("user_id","tenant_id","revoked_at");
CREATE INDEX "auth_sessions_family_id_idx" ON "auth_sessions"("family_id");
CREATE INDEX "auth_sessions_expires_at_idx" ON "auth_sessions"("expires_at");
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE TABLE "auth_rate_limit_buckets" ("key" VARCHAR(64) NOT NULL,"window_started_at" TIMESTAMP(3) NOT NULL,"request_count" INTEGER NOT NULL DEFAULT 0,"blocked_until" TIMESTAMP(3),CONSTRAINT "auth_rate_limit_buckets_pkey" PRIMARY KEY ("key"));
CREATE INDEX "auth_rate_limit_buckets_window_started_at_idx" ON "auth_rate_limit_buckets"("window_started_at");
