# Roadmap

Roadmap items are targets, not completed features. Each phase should produce a demonstrable, tested increment.

## Phase 0 — Repository foundation
- [x] Establish project overview and architecture direction.
- [x] Document initial data model, API conventions, security, and deployment strategy.
- [x] Add local database/cache infrastructure and CI scaffold.
- [x] Add application workspace and runnable health endpoints.

## Phase 1 — First vertical slice
- [x] Next.js portal shell and JWT authentication flow.
- [x] NestJS API with health/readiness endpoints.
- [x] PostgreSQL data model and migrations.
- [x] Tenant-aware Service Catalog CRUD with JWT authentication and workspace isolation.
- [x] Tenant-scoped Team Management API (CRUD).
- [x] Workspace member directory, one-time invitations, revocation, role updates, and membership removal API.
- [x] API-enforced ADMIN/MEMBER RBAC with live membership revalidation and last-admin protection.
- [x] API unit tests for tenant isolation and cross-tenant resource access, executed in CI.
- [ ] Apply migrations against a running local database and verify readiness.
- [x] API integration tests against PostgreSQL and browser-level UI tests.

## Phase 2 — Operational workflows
- [x] Service ownership assignment in the workspace UI.
- [x] Tenant-scoped directed service dependency graph with cycle prevention.
- [x] Tenant-scoped incident lifecycle (create, assign, acknowledge, resolve) with append-only timeline events.
- [ ] Runbook references and escalation metadata.
- [x] Append-only audit events for privileged workspace operations and incident lifecycle, with ADMIN-only audit viewer.

## Phase 3 — Observability and SRE
- [x] Structured HTTP request logs, trace ID propagation, and Prometheus-compatible process metrics endpoint.
- [x] W3C trace context, inbound HTTP spans, and optional OTLP/HTTP export (collector deployment and database/browser auto-instrumentation remain outstanding).
- [ ] Durable external metrics/logs/traces backend and automatic service-level telemetry ingestion.
- [x] Persisted per-service SLI/SLO definitions, rolling-window calculations, and remaining error-budget reporting (manual sample ingestion).
- [x] Tenant-scoped SLO alert rules, cooldown-based incident automation, and transactional outbox event processing (multi-window burn-rate and external notifications remain outstanding).

## Phase 4 — Delivery and FinOps
- [x] GitHub repository webhook ingestion for merged pull requests and deployment statuses (manual webhook configuration; no GitHub App OAuth).
- [ ] Cloud cost import and allocation.
- [ ] Budgets, forecasts, and anomaly indicators.
- [x] DORA metric calculations with sample sizes and documented definitions (webhook-derived deployment data; lead time matched by merge SHA).

## Phase 5 — AI-assisted operations
- [ ] Incident summarization with source references.
- [ ] Log/event context analysis.
- [ ] Root-cause hypotheses with confidence and evidence.
- [ ] Human-approved remediation proposals.
- [ ] Evaluation dataset, privacy controls, and cost limits.

## Definition of done
A feature is complete only when it has input validation, authorization, tests, useful telemetry, documentation, and an honest description of whether its integrations are live or simulated.
