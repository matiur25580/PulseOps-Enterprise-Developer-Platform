# Enterprise Product Coverage Plan

This document is the canonical feature inventory for taking PulseOps from its current working foundation to a production-oriented enterprise developer platform. A checkbox is marked complete only after implementation, automated tests, documentation, and an honest integration-status review. A planned or mocked integration must never be presented as live.

## Delivery principles

- Deliver vertical slices: database and migration, API, authorization, UI, tests, telemetry, documentation, and deployment verification.
- Preserve strict tenant isolation. Tenant identity must come from verified server-side membership, never client-supplied tenant IDs.
- Prefer secure, maintained standards and providers (OIDC/OAuth, SAML where justified, MFA through identity providers) over bespoke cryptography.
- Keep local development and CI reproducible. Prefer free-tier-compatible infrastructure and managed-service adapters; do not silently introduce paid resources.
- Require human approval, least privilege, idempotency, audit events, and rollback plans for production-impacting actions.
- Do not claim compliance certification (SOC 2, ISO 27001, etc.) from technical controls alone.

## Current foundation (present in repository; still subject to ongoing verification)

- [x] Next.js portal and NestJS API foundation.
- [x] PostgreSQL/Prisma schema and versioned migrations.
- [x] JWT sign-in and workspace registration.
- [x] Tenant-scoped Service Catalog and Team Management.
- [x] Workspace membership, invitations, ADMIN/MEMBER role checks, and last-admin protection.
- [x] Incident lifecycle, append-only incident timeline, and audit viewer.
- [x] Service dependency graph with cycle prevention.
- [x] SLI/SLO calculations, error budgets, alert rules, and transactional outbox.
- [x] Request metrics, trace context, and optional OTLP export.
- [x] GitHub webhook ingestion and DORA calculations.
- [x] Normalized FinOps cost imports and budget evaluation.
- [x] Runbook references and manually triggered, audited escalation.
- [x] CI quality gates, PostgreSQL integration tests, and Playwright browser tests.
- [x] PostgreSQL backup/restore scripts and migration runbook.

These are implemented foundations, not proof that every external integration or production operational process is complete. See README, ROADMAP, SECURITY, and DEPLOYMENT for current limitations.

## Phase 1 — Security, identity, and tenant governance

- [x] Replace long-lived stateless access-only sessions with 15-minute access tokens and securely stored, rotating, revocable refresh sessions (refresh-token hashes, replay-family revocation, session inventory, and remote logout are implemented).
- [ ] Login and registration abuse protection: distributed rate limits, brute-force controls, safe error messages, and abuse telemetry.
- [ ] Email verification and password reset using expiring, single-use, hashed tokens.
- [ ] Invitation email delivery with provider adapters, retry/outbox handling, expiry, revocation, and delivery status.
- [ ] Security headers, strict request/body limits, production CORS policy, cookie/CSRF design where cookies are used, and secure proxy configuration.
- [ ] Expand RBAC to Owner, Admin, Developer, Incident Responder, and Viewer with resource/action permissions and explicit deny-by-default behavior.
- [ ] Scoped API keys: hashed-at-rest secrets, one-time display, scopes, expiry, rotation, revocation, last-used metadata, and audit.
- [ ] OIDC login (Google, Microsoft, GitHub) with verified issuer/audience/state/nonce and account-linking safeguards.
- [ ] Enterprise SAML 2.0 and OIDC federation, domain discovery, and workspace-managed identity policies.
- [ ] MFA enforcement via identity provider; privileged-action re-authentication.
- [ ] SCIM 2.0 user/group provisioning and deprovisioning with replay-safe operations.
- [x] Session inventory and remote logout, including individual-session and revoke-all flows.
- [ ] Suspicious-login notifications and expanded security event history.
- [ ] Tamper-evident audit export/retention and privileged-access review.

## Phase 2 — Observability and alerting platform

- [ ] Durable metrics, logs, and traces storage through pluggable backends (OpenTelemetry-compatible).
- [ ] OTLP ingestion endpoints with authentication, quotas, validation, tenant routing, and retention policies.
- [ ] Service-level telemetry ingestion and service/environment/resource identity mapping.
- [ ] Searchable structured logs with filters, correlation IDs, trace links, and redaction.
- [ ] Metrics explorer, custom dashboards, reusable queries, and dashboard sharing.
- [ ] Distributed trace explorer, service map, latency breakdown, and dependency health.
- [ ] Alert routing, deduplication, grouping, suppression, maintenance windows, and notification adapters.
- [ ] Multi-window/multi-burn-rate SLO alerts, alert fatigue controls, and alert delivery receipts.
- [ ] Error and exception tracking with release/environment context.
- [ ] Infrastructure health and external synthetic checks.
- [ ] Telemetry retention, sampling, quotas, ingestion budgets, and backpressure controls.

## Phase 3 — Incident response and reliability engineering

- [ ] On-call schedules, rotations, overrides, holidays, and timezone-aware handoffs.
- [ ] Escalation policies with scheduled timers, retry, acknowledgement timeout, and notification delivery.
- [ ] Incident collaboration: responders, roles, chat/updates, attachments, and live timeline.
- [ ] Alert-to-incident correlation and automatic incident creation with deduplication.
- [ ] Incident commander workflow, stakeholder updates, and status-page publishing.
- [ ] Postmortems with templates, contributing factors, action items, owners, and due dates.
- [ ] Evidence-backed root-cause analysis and linked deployments/alerts/traces/logs.
- [ ] Maintenance windows, change freezes, and service-specific operational calendars.
- [ ] SLO burn-rate reporting, error-budget policies, and deployment guardrails.

## Phase 4 — Developer experience and delivery intelligence

- [ ] Developer portal with service catalog, ownership, documentation, environments, and self-service workflows.
- [ ] Service templates/scaffolding, golden paths, standards, and reusable blueprints.
- [ ] API catalog, OpenAPI import/rendering, versioning, and API lifecycle policies.
- [ ] Environment management, configuration history, and secret references (never expose secret values).
- [ ] Deployment history, release annotations, rollback links, and change-risk analysis.
- [ ] GitHub App integration, OAuth installation, repository discovery, and managed webhook lifecycle.
- [ ] CI/CD integrations for GitHub Actions and other providers through adapters.
- [ ] Deployment approvals, policy checks, and environment promotion workflows.
- [ ] Infrastructure-as-code visibility and drift reporting.
- [ ] Complete DORA reporting with explicit definitions, sample sizes, and data-quality indicators.

## Phase 5 — FinOps and enterprise governance

- [ ] Cloud billing adapters (AWS, Azure, GCP) and normalized CSV/provider exports.
- [ ] Cost allocation by tenant, team, service, environment, owner, and tags.
- [ ] Forecasting, anomaly detection, idle-resource hints, and optimization recommendations.
- [ ] Budgets, alerts, approval workflows, and cost-change audit.
- [ ] Tenant plans, quotas, usage metering, fair-use controls, and billing provider adapter.
- [ ] Organization-wide policies, policy-as-code checks, and exception workflows.
- [ ] Data retention, export, deletion, residency, and legal hold controls.
- [ ] Compliance evidence collection, access reviews, and control mapping for SOC 2/ISO 27001 readiness (not certification).
- [x] PostgreSQL backup integrity tooling (custom-format archive validation, TOC verification, and SHA-256 checksums) plus a documented recovery runbook.
- [ ] Real external backup execution, independently stored backup copies, restore drills, and measured disaster recovery objectives.
- [ ] Multi-region architecture only after measured demand and a funded operational model.

## Phase 6 — AI-assisted operations

- [ ] Incident summaries with source links and explicit evidence provenance.
- [ ] Log/metric/trace context analysis with tenant authorization and sensitive-data redaction.
- [ ] Alert correlation and anomaly detection with measurable precision/recall.
- [ ] Root-cause hypotheses with confidence, evidence, and alternative explanations.
- [ ] Deployment risk assessment based on service history and observed signals.
- [ ] Postmortem drafting and action-item suggestions.
- [ ] Natural-language operations assistant with read-only defaults and explicit tool allowlists.
- [ ] Human approval for every production-impacting remediation; no autonomous shell execution.
- [ ] Evaluation dataset, regression tests, prompt-injection defenses, privacy controls, provider fallback, and per-tenant cost limits.

## Cross-cutting release gates

Every feature must satisfy all applicable checks before being called complete:

- [ ] Threat model, input validation, authentication, authorization, and tenant-isolation tests.
- [ ] Safe migrations, indexes/constraints, rollback or forward-recovery strategy, and backup consideration.
- [ ] API contract, accessible responsive UI, loading/empty/error states, and useful user feedback.
- [ ] Unit, integration, and browser tests; security regression tests for sensitive flows.
- [ ] Structured logs, metrics, trace correlation, alerting, and redaction.
- [ ] Rate limits, quotas, timeout/retry policy, idempotency, and graceful degradation.
- [ ] Documentation, environment variable examples, operational runbook, and known limitations.
- [ ] CI green, deploy preview verified, production smoke checks green, and rollback path understood.
- [ ] Free-tier impact checked. Any unavoidable paid dependency must be optional and disclosed before provisioning.

## Delivery order

1. Close the security and session-management gaps before connecting real customer identity or cloud accounts.
2. Complete on-call notification delivery and durable observability before claiming full incident automation.
3. Expand the developer portal and delivery integrations.
4. Add FinOps provider adapters and governance controls.
5. Add AI features only after data access, redaction, evaluations, and approval controls are in place.

The repository roadmap remains the concise status view. This file is the complete scope inventory; update both when a milestone is delivered.
