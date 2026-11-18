# PulseOps

**An AI-assisted developer platform for cloud operations, observability, incident response, SRE, and FinOps.**

PulseOps brings service ownership, operational signals, incident workflows, reliability objectives, and cloud-cost visibility into one engineering workspace.

> **Project status:** The repository foundation and first application shell are in progress. The web app, API health endpoints, and database schema are the first runnable milestone. External integrations and production-grade authentication are not yet implemented.

## Current stack

- **Web:** Next.js 15, React 19, TypeScript
- **API:** NestJS 10, TypeScript
- **Data:** PostgreSQL 16, Prisma 6
- **Local infrastructure:** Docker Compose, Redis
- **CI:** GitHub Actions

## Prerequisites

- Node.js 20 or newer
- pnpm 10
- Docker Engine/Desktop with Compose

## Local setup

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Create local environment files:

   ```bash
   cp .env.example .env
   cp apps/api/.env.example apps/api/.env
   ```

   The root file configures Docker Compose. The API file configures NestJS and Prisma. Use local-only credentials and never commit real secrets.

3. Start PostgreSQL and Redis:

   ```bash
   docker compose up -d postgres redis
   ```

4. Generate Prisma Client and validate the schema:

   ```bash
   pnpm db:generate
   pnpm --filter @pulseops/api prisma:validate
   ```

5. Apply the initial database migration:

   ```bash
   pnpm --filter @pulseops/api prisma:migrate
   ```

6. Start the API and web app in separate terminals:

   ```bash
   pnpm dev:api
   pnpm dev:web
   ```

7. Open:
   - Web: http://localhost:3000
   - API liveness: http://localhost:4000/api/v1/health
   - API readiness: http://localhost:4000/api/v1/ready

The readiness endpoint checks PostgreSQL and returns HTTP 503 if the database is unavailable.

## Environment variables

See the root `.env.example`, `apps/api/.env.example`, and `apps/web/.env.example`. Environment files are local-only and must not be committed.

## Planned capabilities

- Developer portal and service catalog
- Deployment and CI/CD visibility
- Metrics, logs, and traces
- Incident management and runbooks
- SLI/SLO and error-budget tracking
- FinOps and cloud cost allocation
- AI-assisted incident analysis with human-approved remediation
- Tenant-aware access control and audit history

See [ROADMAP.md](docs/ROADMAP.md) for implementation status. Planned features are not represented as completed functionality.

## Engineering principles

1. Build tested vertical slices before splitting into distributed services.
2. Label live, mocked, and planned integrations honestly.
3. Enforce authorization in the API, not only in the UI.
4. Require human approval for risky production actions.
5. Design for least privilege, auditability, and secure secret handling.
6. Instrument services with logs, metrics, and traces.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Database design](docs/DATABASE.md)
- [API conventions](docs/API.md)
- [Security model](docs/SECURITY.md)
- [Deployment strategy](docs/DEPLOYMENT.md)
- [Roadmap](docs/ROADMAP.md)
- [Contributing](CONTRIBUTING.md)

## License

A license has not yet been selected. Until one is added, all rights are reserved by the repository owner.
