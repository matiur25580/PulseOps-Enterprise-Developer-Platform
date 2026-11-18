# Deployment Strategy

## Current state

The repository now contains a CI-tested Next.js portal and NestJS API with PostgreSQL migrations. Production infrastructure is not provisioned for this repository yet; use the production runbook below before deploying.

## Local development direction

- Docker Compose for PostgreSQL and Redis.
- Separate application processes for the web portal, core API, and AI service once their implementations are added.
- `.env.example` documents variable names without containing credentials.
- Health checks should be available for every long-running service.

## Environments

| Environment | Purpose | Data |
| --- | --- | --- |
| Local | Developer workflow | Disposable local data |
| CI | Automated validation and tests | Ephemeral test data |
| Preview | Review feature branches | Synthetic/non-sensitive data |
| Production | Real operational use | Protected, backed-up data |

## Release checklist

1. CI checks pass and required tests are green.
2. Database migrations are reviewed and have a rollback/forward-fix plan.
3. Required environment variables and secrets are configured in the platform.
4. Health and readiness checks are verified.
5. Logs, metrics, and traces are available.
6. Backup and restore procedures are tested.
7. Access controls and audit logging are verified.
8. Rollback criteria and an owner are identified.

## Infrastructure evolution

Start with a simple managed deployment for the first working slice. Introduce Kubernetes, Terraform-managed cloud resources, event streaming, and multi-region architecture only when the product's needs justify their operational cost.

## Current infrastructure and production runbook

PulseOps has CI-backed application code and a versioned Prisma migration, but no production infrastructure is provisioned for this repository yet. Do not run the production migration workflow until a production PostgreSQL database has been created, backed up, and its connection secret configured.

### Recommended hosting configuration

- API: Render Node web service built from the repository root.
- PostgreSQL: managed PostgreSQL reachable from the API service.
- Web: Vercel Next.js project rooted at `apps/web`.

API environment:
- `NODE_ENV=production`: enables production-only startup security checks.
- `DATABASE_URL`: managed PostgreSQL connection string (use the provider's internal/private URL where possible).
- `JWT_SECRET`: long, random, unique production secret.
- `WEB_ORIGIN`: exact deployed web origin.
- `API_PORT`: use the platform-provided port or 4000.
- `METRICS_TOKEN`: long random bearer token; required to protect `/api/v1/metrics`.

Web build environment:
- `NEXT_PUBLIC_API_BASE_URL`: deployed API origin, without the `/api/v1` suffix (the application adds it).

Never commit production values. Configure secrets in the hosting provider and in the GitHub `production` environment. Enable required reviewers on that GitHub environment before allowing production migration runs.

### Safe migration sequence

1. Provision PostgreSQL and configure automated backups and restore access.
2. Configure `PRODUCTION_DATABASE_URL` as a secret in GitHub Environment `production`.
3. Run **Production Database Migration** manually and type `APPLY` to confirm. It executes `prisma migrate deploy`; it does not reset the database.
4. Deploy the API and web applications from the intended production branch with the environment variables above.
5. Run **Production Deployment Verification** with the API and web HTTPS origins. It checks API liveness, PostgreSQL readiness, and the web root.
6. Verify sign-in, registration, service catalog, dependency graph, incident workflows, and SLO endpoints against a controlled production test workspace.

### Operational limits

- The current `/api/v1/metrics` counters are process-local and reset on restart. Use one API instance for the initial scrape setup or aggregate metrics with a durable backend before horizontal scaling.
- SLI samples are currently submitted through the authenticated API. They are not automatically derived from real application traffic.
- Structured request logs and trace IDs are emitted, but OTLP export, a collector, and a durable trace backend are not configured yet.
- Production migration and deployment workflows are deliberately manual. CI passing does not mean a production database has been migrated or a deployment is live.
