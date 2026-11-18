# API

All endpoints are prefixed with `/api/v1`. JSON request/response bodies are used. DTO validation rejects unknown properties and invalid input.

## Health
- `GET /health`: process liveness.
- `GET /ready`: database readiness; returns 503 when PostgreSQL is unavailable.

## Authentication
- `POST /auth/register`: creates a workspace, first user, and ADMIN membership. Body: `{ "name": "Ada Lovelace", "email": "ada@example.com", "password": "at-least-12-characters", "tenantName": "Platform Team" }`.
- `POST /auth/login`: validates email/password and workspace slug. Body: `{ "email": "ada@example.com", "password": "at-least-12-characters", "tenantSlug": "platform-team-xxxxxxxx" }`.
- Both return a one-hour JWT and identity/workspace summary.

Send authenticated requests with `Authorization: Bearer <accessToken>`.

## Service Catalog
All routes require a valid bearer token. Workspace scope comes from the verified token; clients cannot select or override a tenant ID.
- `GET /services`: list services in the authenticated workspace.
- `POST /services`: create a service.
- `PATCH /services/:id`: update a service belonging to the authenticated workspace.
- `DELETE /services/:id`: delete a service belonging to the authenticated workspace.

Fields: `name` and `slug` (2–100 chars), optional `description` (max 1,000 chars), optional absolute `repository` URL, optional `teamId` UUID from the same workspace, and optional lifecycle (`EXPERIMENTAL`, `PRODUCTION`, `DEPRECATED`, `RETIRED`). Slugs are normalized to lowercase and unique per workspace.

## Teams
All routes require a valid bearer token. Workspace scope comes from the verified token.
- `GET /teams`: list teams in the current workspace.
- `POST /teams`: create a team with `{ "name": "Platform", "email": "platform@example.com" }`.
- `PATCH /teams/:id`: update a team belonging to the current workspace.
- `DELETE /teams/:id`: delete a team belonging to the current workspace. Existing services remain; their nullable `teamId` is cleared by the database's `ON DELETE SET NULL` relation.

Team names are unique per workspace. Duplicate names return 409; resources outside the caller's workspace return 404. Invalid payloads return 400; missing/invalid tokens return 401.

## Incident management
All routes require a valid bearer token and are scoped to the authenticated workspace.
- GET /incidents: list workspace incidents with assignee and chronological timeline.
- POST /incidents: create an incident. Body includes title, optional description, severity (CRITICAL, HIGH, MEDIUM, LOW), and optional assignedToUserId.
- PATCH /incidents/:id/assign: assign an open/acknowledged incident to a workspace member.
- POST /incidents/:id/acknowledge: transition an OPEN incident to ACKNOWLEDGED.
- POST /incidents/:id/resolve: transition an OPEN or ACKNOWLEDGED incident to RESOLVED. Optional body: { "message": "Rollback completed" }.

Incident transitions append timeline events. Resolved incidents cannot be reassigned or acknowledged again. Assignees must be members of the same workspace.

## Audit trail
- GET /audit-logs?limit=50: ADMIN only; returns the latest 1–100 workspace audit records with actor details.
- Audit events are recorded for Team and Service create/update/delete, invitation create/revoke, member role changes/removal, and incident create/assign/acknowledge/resolve. No API endpoint mutates or deletes audit records. Workspace scope is derived from the authenticated JWT.

## Security notes
JWTs expire after one hour. Passwords are hashed with bcryptjs (cost factor 12). Production startup requires `JWT_SECRET`. Refresh tokens, email verification, login rate limiting, password reset, managed secrets, and security headers remain outstanding.

## Workspace members and RBAC
- `GET /members`: list members in the authenticated workspace (ADMIN and MEMBER).
- `POST /members/invitations`: ADMIN only. Body: `{ "email": "new.member@example.com" }`. Creates a seven-day MEMBER invitation and returns a one-time `acceptanceToken`. Until an email provider is configured, an administrator must share this token through a secure channel; the API does not send email.
- `DELETE /members/invitations/:id`: ADMIN only; revoke a pending invitation.
- `PATCH /members/:userId/role`: ADMIN only. Body: `{ "role": "ADMIN" | "MEMBER" }`.
- `DELETE /members/:userId`: ADMIN only; remove a member from this workspace.
- `POST /auth/accept-invitation`: public invitation acceptance. Body: `{ "name": "New Member", "email": "new.member@example.com", "password": "at-least-12-characters", "token": "<one-time-token>" }`. New accounts are created; existing accounts must provide their current password. The token is single-use and expires after seven days.

ADMIN members can create, update, and delete Teams and Services. MEMBER accounts can read Teams, Services, and the member directory, but write operations return 403. Role changes and membership removal take effect immediately for existing JWTs because the API reloads membership and role from PostgreSQL on every authenticated request. A workspace cannot demote or remove its last ADMIN.

## Service dependency graph
All endpoints require authentication and are scoped to the caller's workspace.
- GET /service-dependencies: list directed edges with source and target service details.
- POST /service-dependencies (ADMIN): body { "sourceServiceId": "<uuid>", "targetServiceId": "<uuid>" }. Both services must belong to the same workspace. Self-edges and cycles are rejected.
- DELETE /service-dependencies/:id (ADMIN): remove a workspace edge.

## SLI / SLO
- GET /slos: list workspace objectives with rolling-window measurements.
- POST /slos/services/:serviceId (ADMIN): create an objective with name, indicator (AVAILABILITY or LATENCY), targetPercent (0.01–100), optional windowDays (1–90, default 30), and latencyThresholdMs (required for LATENCY).
- POST /slos/:id/samples (ADMIN): record a manual sample with success boolean and latencyMs for latency objectives.
- DELETE /slos/:id (ADMIN): delete an objective and its samples.

The API calculates measured SLI percentage and remaining error-budget percentage from samples in the configured rolling window. A no-sample objective reports null measurement values. The current data source is MANUAL_API_INGESTION; no production request telemetry is automatically attributed to a service yet.

## Metrics and request telemetry
- GET /metrics: Prometheus text exposition for per-process HTTP request counters and latency histogram buckets. METRICS_TOKEN is required at production startup and the endpoint requires Authorization: Bearer <token>. In local development, if unset, the scrape endpoint is unauthenticated.
- HTTP responses include x-trace-id. Incoming valid W3C traceparent trace IDs are propagated; otherwise a new trace ID is generated. Structured JSON request events are written to stdout.

Metrics are held in process memory and reset on restart; they are not a durable or horizontally aggregated time series. An OTLP/OpenTelemetry collector, external metrics backend, alerting and service-level telemetry adapters are future integration work.

## SLO alerting
All routes require authentication and use the authenticated workspace scope.
- GET /alerts: list alert rules, their SLO/service, and recent events.
- POST /alerts/slos/:sloId/rules (ADMIN): create a rule with { "name": "Checkout availability", "thresholdPercent": 99.5, "cooldownMinutes": 30 }. The measured SLI at or below the threshold triggers an incident. Cooldown is 1–1440 minutes.
- PATCH /alerts/:id/enabled (ADMIN): enable or disable a rule with { "enabled": true }.
- POST /alerts/evaluate (ADMIN): evaluate all enabled rules against samples in each SLO rolling window. Returns NO_DATA, HEALTHY, COOLDOWN, or TRIGGERED per rule.
- GET /alerts/:id/events: list the latest 100 alert events for a rule.

When a rule breaches, the evaluator creates a HIGH incident, timeline event, alert event, updates the rule cooldown timestamp, and writes an audit record in one PostgreSQL transaction. Repeated triggers are suppressed during cooldown. Evaluation is currently an authenticated manual operation; scheduled evaluation, delivery channels (email/Slack/PagerDuty), burn-rate windows, and distributed worker execution are not yet implemented.


## Transactional outbox and background processing
Domain transactions can persist an `OutboxEvent` alongside the business change. The current SLO alert path writes the incident, incident timeline event, alert event, audit record, and `SLO_ALERT_TRIGGERED` outbox event in the same PostgreSQL transaction. A rollback therefore leaves neither a partial incident nor a missing event.

The API process runs a lightweight database-polling worker:
- Claims one due event at a time with PostgreSQL `FOR UPDATE SKIP LOCKED`, allowing multiple API instances to compete safely.
- Uses a five-minute processing lease so events abandoned by a crashed process can be reclaimed.
- Retries failures with capped exponential backoff (up to one hour).
- Moves exhausted or unsupported events to `DEAD_LETTER`; event rows retain the last error for inspection.
- Uses a unique idempotency key for producer-side duplicate prevention.

Worker configuration:
- `OUTBOX_WORKER_ENABLED=false` disables polling (enabled by default).
- `OUTBOX_POLL_INTERVAL_MS` controls polling cadence (default 2000 ms, capped at 60000).

The initial `SLO_ALERT_TRIGGERED` handler emits a structured processing log only. Email, Slack, PagerDuty, external queues, operator replay tooling, and exactly-once external side effects are not implemented. Consumers of external systems must use the event ID/idempotency key to make their own side effects idempotent.


## Distributed tracing
The API accepts W3C Trace Context `traceparent` headers and creates a server span for each HTTP request. Responses include `traceparent` (the server span context) and `x-trace-id`. Structured request logs include trace and span IDs.

OTLP/HTTP export is optional:
- `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`: complete traces endpoint.
- `OTEL_EXPORTER_OTLP_ENDPOINT`: base endpoint; `/v1/traces` is appended.
- `OTEL_SERVICE_NAME`: resource service name (default `pulseops-api`).
- `OTEL_EXPORTER_OTLP_HEADERS`: optional comma-separated HTTP headers.
- `OTEL_TRACES_SAMPLER_ARG`: deterministic root sampling ratio, 0–1 (default 1).

Unset both endpoint variables to disable remote trace export. Export is best-effort with a three-second timeout and never blocks or fails the API request. Outbound HTTP adapters can propagate the active context by injecting `TraceContextService` and calling `inject(existingHeaders)`. This milestone adds inbound HTTP spans; automatic Prisma/database spans and browser instrumentation are not yet implemented.


## GitHub delivery integration and DORA metrics

Repository connections are workspace-scoped. ADMIN users can:
- `POST /integrations/github/repositories` with `{ "serviceId": "<service-uuid>", "repositoryFullName": "owner/repository" }` to connect a repository to a catalog service.
- `GET /integrations/github/repositories` to list connected repositories.
- `DELETE /integrations/github/repositories/:id` to disable ingestion without deleting historical metrics.

Configure `GITHUB_WEBHOOK_SECRET` as a deployment secret, then create a GitHub repository webhook pointing to `/api/v1/integrations/github/webhook`, using that same secret and JSON content type. Subscribe to `pull_request` and `deployment_status` events. The API verifies GitHub's `X-Hub-Signature-256` HMAC against the exact raw request body using constant-time comparison. Missing secrets or invalid signatures are rejected. GitHub delivery IDs are persisted uniquely to make retries idempotent. Webhook events for unconnected repositories are acknowledged and ignored.

Merged pull requests are stored from `pull_request` events with action `closed` and `merged=true`. Deployment records are upserted from terminal `deployment_status` states (`success`, `failure`, `error`, `inactive`).

- `GET /engineering-metrics/dora?windowDays=30` returns workspace DORA indicators for a 7–90 day window.
- Deployment frequency is successful deployments divided by window days (also returned per week).
- Lead time is the median time from PR merge to successful deployment, matched by exact merge commit SHA.
- Change failure rate is failed terminal GitHub deployment states (failure/error) divided by successful plus failed deployment records. Inactive deployments retain their original successful deployment timestamp and are not counted as failures. This is a webhook-derived proxy and not confirmed incident causality.
- MTTR is the mean time from incident creation to resolution for workspace incidents resolved within the selected window.

Metrics include sample sizes and limitations. Null means there is insufficient matching data; zero is not substituted for missing samples. This integration uses GitHub webhooks, not the GitHub App installation/OAuth flow or GitHub API polling. It does not automatically create GitHub webhooks; administrators configure them in GitHub.


## Service runbooks and escalation policies

All routes require authentication and are scoped to the caller's workspace. ADMIN is required for mutations.
- `GET /services/:serviceId/runbooks`: list a service's runbook references.
- `POST /services/:serviceId/runbooks`: create a reference with `title`, absolute `url`, optional `category` (`RUNBOOK`, `PLAYBOOK`, `DASHBOARD`, `POSTMORTEM`) and optional `isPrimary`. A service can have only one primary runbook; selecting a new primary atomically clears the previous primary.
- `DELETE /services/:serviceId/runbooks/:runbookId`: remove a reference.
- `GET /services/:serviceId/escalation-policy`: return the configured policy or null.
- `PUT /services/:serviceId/escalation-policy`: upsert `primaryContactEmail`, optional `secondaryContactEmail`, `escalationAfterMinutes` (1–1440, default 15), optional `onCallUrl` and `notes`. Primary and secondary contacts must differ.

Incident creation accepts optional `serviceId`; it must reference a service in the same workspace. The incident response includes its linked service.
- `POST /incidents/:id/escalate`: manually advance an unresolved service-linked incident to the next configured contact. Level 1 targets the primary contact; level 2 targets the secondary contact. The compare-and-set update, incident timeline event and audit event are committed transactionally. Escalation stops when no further contact is configured.

Escalation is currently a recorded workflow action only: PulseOps does not send email/SMS/Slack notifications or automatically escalate after the configured interval. The interval and contact are included in the event metadata for operators and future notification integrations.


## FinOps cost allocation and budgets

All endpoints require authentication and workspace membership. Cost imports, budget creation and budget evaluation are ADMIN-only.
- `POST /finops/cost-records/import`: import 1–500 normalized cost line items. Each record includes provider (`AWS`, `AZURE`, `GCP`, `OTHER`), provider-specific `sourceRecordId`, `resourceId`, UTC first-of-month `billingPeriodStart`, non-negative `costAmount` (up to six decimal places), three-letter `currency`, optional same-workspace `serviceId`, region/resource name and tags. Re-importing the same provider/source record updates the existing row instead of duplicating it.
- `GET /finops/costs?period=YYYY-MM`: returns totals by currency, provider and service, plus unallocated spend. Different currencies are never summed together and no FX conversion is assumed.
- `POST /finops/budgets`: create a monthly budget with name, amount, currency, optional serviceId (omit for workspace-wide), and optional thresholdPercent (default 80).
- `GET /finops/budgets?period=YYYY-MM`: returns each budget's actual spend, utilization and sample count for the period.
- `POST /finops/budgets/evaluate?period=YYYY-MM`: manually evaluate enabled budgets. Threshold events are idempotent per budget, month and threshold.

This milestone accepts normalized JSON cost line items from an export adapter. It does not connect to AWS Cost Explorer, Azure Cost Management, or Google Cloud Billing APIs, and it does not parse provider CSV exports directly. No exchange-rate conversion, forecast, or automatic evaluation scheduler is implemented. Missing source rows return `NO_DATA`, not a fabricated zero-spend signal.


Example cost import payload:

```json
{
  "records": [
    {
      "provider": "AWS",
      "sourceRecordId": "cur-line-2026-11-0001",
      "resourceId": "arn:aws:ec2:ap-south-1:123456789012:instance/i-abc123",
      "resourceName": "payments-api-prod",
      "region": "ap-south-1",
      "billingPeriodStart": "2026-11-01T00:00:00.000Z",
      "costAmount": 18.425,
      "currency": "USD",
      "serviceId": "00000000-0000-4000-8000-000000000001",
      "tags": { "environment": "production", "team": "platform" }
    }
  ]
}
```

Do not put credentials, access tokens, customer data or other secrets in cost tags.
