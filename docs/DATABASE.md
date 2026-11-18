# Database Design

## Status

This is an initial logical data model. It is not yet an implemented Prisma schema or migration.

## Conventions

- Use UUID primary keys.
- Store timestamps in UTC.
- Include `tenant_id` on tenant-owned records and enforce tenant scoping in every repository query.
- Prefer soft deletion only where business or audit requirements justify it.
- Use database constraints for invariants that must hold under concurrency.

## Core entities

| Entity | Important fields | Purpose |
| --- | --- | --- |
| Tenant | id, name, slug, status, created_at | Workspace boundary |
| User | id, email, display_name, status | Human identity |
| Membership | tenant_id, user_id, role_id, status | User access to a tenant |
| Role | id, tenant_id, name | Tenant-scoped role |
| Permission | id, key, description | Atomic capability |
| RolePermission | role_id, permission_id | Role-to-permission mapping |
| Service | id, tenant_id, name, owner_team_id, lifecycle | Service catalog |
| Team | id, tenant_id, name, contact | Ownership group |
| ServiceDependency | source_service_id, target_service_id, kind | Service relationships |
| Incident | id, tenant_id, service_id, severity, status, title | Operational incident |
| IncidentEvent | id, incident_id, actor_id, event_type, payload | Append-only timeline |
| Slo | id, tenant_id, service_id, target, window | Reliability objective |
| AuditEvent | id, tenant_id, actor_id, action, target, metadata | Security and governance trail |

## Relationships

- A tenant has many memberships, teams, services, incidents, and SLOs.
- A user can belong to multiple tenants through memberships.
- A service can have many dependencies, incidents, and SLOs.
- An incident has an ordered timeline of incident events.
- Audit events are append-only and should be retained according to an explicit policy.

## Indexing and integrity

- Unique: `Tenant.slug`, `User.email` (subject to identity-provider policy), and `Membership(tenant_id, user_id)`.
- Index tenant-owned tables by `(tenant_id, created_at)` where chronological access is common.
- Index incidents by `(tenant_id, status, severity, created_at)`.
- Add foreign keys for ownership and relationship integrity.
- Consider row-level security as defense in depth, not a replacement for application authorization.

## Data lifecycle

Define retention periods for audit events, incident payloads, telemetry references, and AI prompts/responses before production use. Avoid storing secrets or unnecessary personal data in event payloads.


## Runbooks and escalation
- `runbook_references` stores tenant- and service-scoped external runbook/playbook/dashboard/postmortem URLs. A partial unique index enforces one primary runbook per service.
- `escalation_policies` stores the primary/secondary contact addresses, escalation interval guidance, optional on-call URL and operator notes for each service.
- `incidents.service_id` optionally links an incident to a service. `escalation_level` and `escalated_at` record manual escalation progression. Incident events and audit logs capture the selected escalation target.
- Runbook references and escalation policies cascade with their owning tenant/service. Incident service references are cleared when the service is deleted.


## FinOps
- `cost_records` stores normalized provider line items, source idempotency keys, resource metadata, billing month, exact decimal cost, currency and optional service allocation. Provider/source IDs are unique per tenant; deleting a service preserves cost history and clears the allocation.
- `cost_budgets` stores monthly workspace-wide or service-specific budget amounts and threshold percentages. Currency is explicit and comparisons never combine currencies.
- `cost_budget_events` records an idempotent threshold event per budget, month and configured threshold. Evaluation is manual; no background scheduler or provider API ingestion is implied.
