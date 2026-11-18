# PulseOps

**An AI-assisted developer platform for cloud operations, observability, incident response, SRE, and FinOps.**

PulseOps brings service ownership, operational signals, incident workflows, reliability objectives, and cloud-cost visibility into one engineering workspace.

> **Project status:** The repository includes a Next.js portal, NestJS API, PostgreSQL/Prisma schema, JWT authentication, tenant-scoped Service Catalog and Team Management, workspace member invitations, ADMIN/MEMBER RBAC, and GitHub Actions quality gates for API unit tests, PostgreSQL integration tests, and Playwright browser tests. Production hardening (managed secrets, invitation email delivery, email verification, rate limiting, refresh-token/session management, audit logging, and security headers) remains outstanding.

## Current stack
- **Web:** Next.js 15, React 19, TypeScript
- **API:** NestJS 10, TypeScript
- **Data:** PostgreSQL 16, Prisma 6
- **Local infrastructure:** Docker Compose, Redis
- **CI:** GitHub Actions, Jest, ts-jest

## Prerequisites
- Node.js 20 or newer
- pnpm 10
- Docker Engine/Desktop with Compose

## Local setup
1. Install dependencies: `pnpm install`.
2. Create local environment files: `cp .env.example .env` and `cp apps/api/.env.example apps/api/.env`.
3. Start PostgreSQL and Redis: `docker compose up -d postgres redis`.
4. Set a strong local `JWT_SECRET` in `apps/api/.env`. Never use the example value outside local development.
5. Generate Prisma Client and validate: `pnpm db:generate` and `pnpm --filter @pulseops/api prisma:validate`.
6. Apply migrations: `pnpm --filter @pulseops/api prisma:migrate`.
7. Run API unit tests: `pnpm test:api`.
8. Run PostgreSQL integration tests: `pnpm test:integration` (requires the migrated test database in `DATABASE_URL`).
9. Run browser tests: `pnpm test:browser` (requires the API and web app running, plus Playwright Chromium installed with `pnpm --filter @pulseops/web exec playwright install chromium`).
10. Start API and web in separate terminals: `pnpm dev:api` and `pnpm dev:web`.

## Local endpoints
- Web: http://localhost:3000
- API liveness: http://localhost:4000/api/v1/health
- API readiness: http://localhost:4000/api/v1/ready
- Authentication: `POST /api/v1/auth/register`, `POST /api/v1/auth/login`
- Service Catalog: `GET/POST/PATCH/DELETE /api/v1/services` (Bearer token required)
- Teams: `GET/POST/PATCH/DELETE /api/v1/teams` (Bearer token required; writes require ADMIN)
- Members: `GET /api/v1/members`, `POST /api/v1/members/invitations`, `PATCH /api/v1/members/:userId/role`, and `DELETE /api/v1/members/:userId` (administrative actions require ADMIN).
- Invitation acceptance: `POST /api/v1/auth/accept-invitation` (single-use seven-day token; email delivery is not configured yet).

The readiness endpoint checks PostgreSQL and returns HTTP 503 if the database is unavailable. Team and service APIs derive workspace scope from the verified JWT; clients cannot override tenant IDs.

## Automated quality gates

The `Quality Gates` GitHub Actions workflow provisions PostgreSQL 16, generates Prisma Client, applies the schema to an isolated CI database, runs API unit and PostgreSQL integration tests, builds both applications, and executes Playwright Chromium tests against the running API and web UI. The browser suite covers workspace registration/sign-in, Team Management CRUD, service ownership assignment, workspace invitations, member read-only access, and Service Catalog CRUD. Team and Service operations use the authenticated workspace-scoped API.

Integration tests use a dedicated Jest configuration and are intentionally excluded from the fast unit-test command.

## Environment variables
See the root `.env.example`, `apps/api/.env.example`, and `apps/web/.env.example`. Environment files are local-only and must not be committed.

## Planned capabilities
- Deployment and CI/CD visibility
- Metrics, logs, and traces
- Incident management and runbooks
- SLI/SLO and error-budget tracking
- FinOps and cloud cost allocation
- AI-assisted incident analysis with human-approved remediation

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
