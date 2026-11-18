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
