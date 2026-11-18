# Roadmap

Roadmap items are targets, not completed features. Each phase should produce a demonstrable, tested increment.

## Phase 0 — Repository foundation

- [x] Establish project overview and architecture direction.
- [x] Document initial data model, API conventions, security, and deployment strategy.
- [x] Add local database/cache infrastructure and CI scaffold.
- [x] Add application workspace and runnable health endpoints.

## Phase 1 — First vertical slice

- [x] Next.js portal shell (authentication integration remains future work).
- [x] NestJS API with health/readiness endpoints.
- [x] PostgreSQL data model and initial migration.
- [ ] Apply migrations against a running local database and verify readiness.
- [ ] Tenant-aware service catalog CRUD with authentication and authorization.
- [ ] API and UI tests in CI.

## Phase 2 — Operational workflows

- [ ] Service ownership and dependency graph.
- [ ] Incident lifecycle and append-only timeline.
- [ ] Runbook references and escalation metadata.
- [ ] Audit events for privileged operations.

## Phase 3 — Observability and SRE

- [ ] OpenTelemetry instrumentation.
- [ ] Metrics/logs/traces integration.
- [ ] SLI/SLO definitions and error-budget calculations.
- [ ] Alert and burn-rate views.

## Phase 4 — Delivery and FinOps

- [ ] Deployment metadata integrations.
- [ ] Cloud cost import and allocation.
- [ ] Budgets, forecasts, and anomaly indicators.
- [ ] DORA metric calculations with documented definitions.

## Phase 5 — AI-assisted operations

- [ ] Incident summarization with source references.
- [ ] Log/event context analysis.
- [ ] Root-cause hypotheses with confidence and evidence.
- [ ] Human-approved remediation proposals.
- [ ] Evaluation dataset, privacy controls, and cost limits.

## Definition of done

A feature is complete only when it has input validation, authorization, tests, useful telemetry, documentation, and an honest description of whether its integrations are live or simulated.
