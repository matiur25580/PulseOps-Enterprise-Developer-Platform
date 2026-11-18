# Deployment Strategy

## Current state

There is no deployable application yet. The repository foundation will add local infrastructure configuration first; application services and cloud deployment will follow after a tested vertical slice exists.

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
