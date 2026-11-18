# Security Model

## Security objectives

PulseOps is intended to handle operational metadata and potentially sensitive infrastructure context. Security controls must be implemented before connecting real cloud accounts or production systems.

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
- Rotate credentials immediately if they are exposed.

## AI safety

- Treat model output as untrusted data.
- Do not allow model-generated shell commands or remediation plans to execute automatically.
- Require a human approval step for production-impacting actions.
- Apply tool allowlists, tenant authorization, rate limits, and audit logging to AI-assisted workflows.
- Minimize prompt context and redact secrets before sending data to an external model provider.

## Application controls

- Validate and normalize input.
- Use parameterized database access.
- Configure CORS narrowly.
- Set secure cookie attributes when cookie sessions are used.
- Add CSRF protection where applicable.
- Protect against SSRF in any feature that fetches user-supplied URLs.
- Set request size limits and dependency timeouts.
- Keep dependencies patched and scan changes in CI.

## Auditability

Audit privileged actions with actor, tenant, action, target, timestamp, request ID, approval context, and outcome. Avoid recording sensitive payloads.

## Incident response

Maintain documented procedures for credential compromise, tenant isolation failure, data exposure, and supply-chain vulnerabilities. Define a security contact before public production use.


## Implemented authentication and workspace isolation
- User passwords are stored as bcrypt hashes (cost factor 12), never as plaintext.
- API access tokens are signed JWTs with a one-hour expiry.
- Production startup refuses to run without `JWT_SECRET`; configure it through the deployment secret manager.
- Registration creates a workspace and an ADMIN membership in one database transaction.
- Service Catalog controllers require a verified bearer token. Tenant scope is read from the token, never from a request header or body.
- Service list, lookup-before-update/delete, and create operations are tenant-scoped. Team references are checked against the same tenant.
- Unknown DTO properties are rejected by the global validation pipe.

## Remaining production hardening
Email verification, refresh-token rotation/revocation, login/register rate limiting, password reset, audit logging, CSRF considerations for browser cookie storage, security headers, and automated authorization/e2e tests are not yet implemented. Treat this as an application foundation, not a production security certification.
