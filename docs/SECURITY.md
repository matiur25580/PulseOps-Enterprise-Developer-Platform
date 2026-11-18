# Security Model

## Security objectives
PulseOps handles operational metadata and potentially sensitive infrastructure context. Security controls must be implemented before connecting real cloud accounts or production systems.

## Identity and access
- Use a proven OIDC/OAuth identity provider rather than implementing password cryptography from scratch.
- Require MFA through the identity provider for privileged roles.
- Apply tenant-scoped RBAC and deny by default.
- Re-check authorization in the API for every protected operation.
- Use short-lived sessions/tokens and rotate credentials according to provider guidance.

## Secrets and configuration
- Commit only placeholders in `.env.example`.
- Store real secrets in the hosting platform's secret manager.
- Never log access tokens, API keys, passwords, authorization headers, or raw secret-bearing payloads.
- Rotate credentials immediately if exposed.

## AI safety
- Treat model output as untrusted data.
- Do not allow model-generated shell commands or remediation plans to execute automatically.
- Require human approval for production-impacting actions.
- Apply tool allowlists, tenant authorization, rate limits, and audit logging to AI-assisted workflows.
- Minimize prompt context and redact secrets before sending data to an external model provider.

## Application controls
- Validate and normalize input; use parameterized database access.
- Configure CORS narrowly, request size limits, and dependency timeouts.
- Set secure cookie attributes when cookie sessions are used and add CSRF protection where applicable.
- Protect against SSRF in features that fetch user-supplied URLs.
- Keep dependencies patched and scan changes in CI.

## Implemented authentication and tenant isolation
- Passwords are stored as bcrypt hashes (cost factor 12); access tokens are signed JWTs with a one-hour expiry.
- Production startup requires `JWT_SECRET`; registration creates a workspace and ADMIN membership transactionally.
- Service, Team, Member, Incident, and Audit controllers require verified bearer tokens. Tenant scope comes from the token, not a request header or body.
- The JWT guard revalidates workspace membership and current role from PostgreSQL on every request. Removed members lose access immediately; role changes apply to already-issued tokens.
- ADMIN-only write operations are enforced by API guards. MEMBER is read-only for Team and Service resources.
- Workspace invitations store only SHA-256 token hashes, are single-use, expire after seven days, and always grant MEMBER. An administrator must securely share the one-time token until an email provider is integrated.
- The last workspace administrator cannot be demoted or removed; members cannot remove their own membership.
- Team update/delete look up resources by both ID and authenticated tenant ID.
- Service creation verifies any assigned team belongs to the same tenant.
- Deleting a team preserves its services and clears their optional team reference through the database relation.
- Unit tests cover tenant-scoped listing/creation and cross-tenant update/delete/assignment rejection.
- Incident reads and mutations derive tenant scope from the verified identity; assignees must hold a membership in that workspace.
- Service dependency reads and mutations are tenant-scoped; both endpoints must belong to the same workspace, self-edges and detected cycles are rejected.
- SLO definitions and SLI samples are tenant-scoped; only ADMINs can create objectives or submit samples.
- The Prometheus metrics endpoint requires a METRICS_TOKEN bearer check in production; application startup fails if it is missing.
- Request logs contain route/method/status/duration and trace ID only; authorization headers and request bodies are not logged.
- Incident state transitions append timeline events. Audit records capture Team/Service mutations, invitation and membership administration, and incident lifecycle actions; the API exposes no audit mutation or deletion route. Audit viewing is ADMIN-only.

## JWT token validation
- Tokens are signed with the configured `JWT_SECRET` and include the fixed `pulseops-api` issuer and `pulseops-web` audience.
- Verification enforces both issuer and audience; tokens minted for another issuer or client are rejected.
- Production requires a unique `JWT_SECRET` of at least 32 characters. The known development fallback is available only outside production.
- Generate a production secret locally with `openssl rand -base64 48` and store it only in the hosting provider's secret manager. Never commit it or paste it into chat.

## Session and authentication hardening
- Access JWTs expire after 15 minutes and include a session ID; each protected request revalidates workspace membership and an active, unexpired session in PostgreSQL.
- Refresh credentials are random opaque tokens; only SHA-256 hashes are stored. The raw token is issued as an HttpOnly cookie scoped to `/api/v1/auth`.
- Refresh rotates tokens transactionally. Reuse of a rotated token revokes its token family. Logout, logout-all, session inventory, and per-session revocation are supported.
- Register, login, and refresh use database-backed fixed-window rate limits shared across API instances.
- Production cookies use Secure, HttpOnly, SameSite=None. Default Vercel and Render hostnames are cross-site and browser privacy settings may block third-party cookies; a same-site custom domain or first-party auth proxy is recommended.
- Existing access tokens without a session ID must be replaced by signing in again after deployment.

## Remaining production hardening
Invitation email delivery, email verification, password reset, managed secrets, and external security review remain outstanding. Treat this as an application foundation, not a production security certification.


## GitHub webhook security
- The webhook receiver accepts events only when `GITHUB_WEBHOOK_SECRET` is configured and the `X-Hub-Signature-256` HMAC matches the exact raw request body.
- Signature comparisons use constant-time comparison. Invalid or missing signatures are rejected.
- Delivery IDs are stored with a unique constraint and processed transactionally with the corresponding PR/deployment update to make GitHub retries idempotent.
- The webhook handler stores only event metadata and normalized PR/deployment fields; it does not persist the full incoming payload.
- The shared webhook secret is a deployment secret, never a repository setting or committed value. Configure the same secret in the GitHub webhook settings.
- Repository-to-service mappings are tenant-scoped; the repository name is globally unique in PulseOps to avoid ambiguous webhook routing across workspaces.
- GitHub webhook configuration is manual. GitHub App installation/OAuth and automatic webhook provisioning are not implemented.


## Runbook and escalation controls
- Runbook references and escalation policies are scoped by tenant and service; cross-workspace service IDs return not found.
- Only ADMIN members can create/delete runbooks or change escalation policies. Read access requires authenticated workspace membership.
- Incident escalation uses a compare-and-set level transition and commits the timeline and audit records in the same serializable transaction.
- Escalation currently records the selected contact in event metadata; no external notification is sent and no automatic timer is running.


## FinOps data controls
- Cost imports are ADMIN-only, bounded to 500 records per request, validated for currency, decimal precision, billing month and tenant-owned service allocation.
- Provider source record IDs are idempotent within tenant/provider scope; duplicate imports update the existing normalized row.
- Cost and budget queries always derive tenant scope from the authenticated identity. Budget events are stored idempotently.
- Provider credentials are not collected or stored. This milestone imports normalized JSON exports and does not call cloud provider billing APIs.
