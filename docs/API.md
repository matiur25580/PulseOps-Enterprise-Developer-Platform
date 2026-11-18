# API

All endpoints are prefixed with `/api/v1`. JSON request/response bodies are used. DTO validation rejects unknown properties and invalid input.

## Health
- `GET /health`: process liveness.
- `GET /ready`: database readiness; returns 503 when PostgreSQL is unavailable.

## Authentication
- `POST /auth/register`: creates a workspace, first user, and ADMIN membership.
  - Body: `{ "name": "Ada Lovelace", "email": "ada@example.com", "password": "at-least-12-characters", "tenantName": "Platform Team" }`
  - Returns a one-hour JWT, user summary, generated tenant slug, and role.
- `POST /auth/login`: validates email/password and a workspace slug.
  - Body: `{ "email": "ada@example.com", "password": "at-least-12-characters", "tenantSlug": "platform-team-xxxxxxxx" }`
  - Returns a one-hour JWT and identity/workspace summary.

Send authenticated requests with `Authorization: Bearer <accessToken>`.

## Service Catalog
All routes require a valid bearer token. The workspace scope is derived from the verified token claim; clients cannot select or override a tenant ID.

- `GET /services`: list services in the authenticated workspace.
- `POST /services`: create a service.
- `PATCH /services/:id`: update a service belonging to the authenticated workspace.
- `DELETE /services/:id`: delete a service belonging to the authenticated workspace.

Create/update fields:
- `name`: 2–100 characters.
- `slug`: 2–100 characters; normalized to lowercase and unique per workspace.
- `description`: optional, up to 1,000 characters.
- `repository`: optional absolute URL.
- `teamId`: optional UUID; must identify a team in the same workspace.
- `lifecycle`: `EXPERIMENTAL`, `PRODUCTION`, `DEPRECATED`, or `RETIRED`.

A resource outside the caller's workspace is treated as not found. Duplicate workspace slugs return 409. Invalid payloads return 400; missing/invalid tokens return 401.

## Security notes
JWTs expire after one hour. Passwords are hashed with bcryptjs (cost factor 12). The local fallback secret is for development only; production startup fails unless `JWT_SECRET` is set. This initial milestone does not yet implement refresh tokens, email verification, login rate limiting, password reset, or audit events.
