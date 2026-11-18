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
