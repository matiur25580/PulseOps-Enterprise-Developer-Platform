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

## Security notes
JWTs expire after one hour. Passwords are hashed with bcryptjs (cost factor 12). Production startup requires `JWT_SECRET`. Refresh tokens, email verification, login rate limiting, password reset, and audit events remain outstanding.
