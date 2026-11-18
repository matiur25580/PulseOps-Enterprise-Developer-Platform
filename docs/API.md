# API Conventions

## Status

The API contract is a design baseline. No production API endpoints are implemented yet.

## Base path and versioning

Use `/api/v1` for public application endpoints. Keep internal health endpoints separate from tenant-scoped business APIs.

## Response envelope

Successful responses should use a consistent envelope:

```json
{
  "data": {},
  "meta": {
    "requestId": "opaque-request-id"
  }
}
```

Errors should expose a stable machine-readable code and a safe human-readable message:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request contains invalid fields.",
    "details": []
  },
  "meta": {
    "requestId": "opaque-request-id"
  }
}
```

Never return stack traces, SQL errors, tokens, or secret values to clients.

## Initial endpoint candidates

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/v1/health` | Liveness |
| GET | `/api/v1/ready` | Dependency readiness |
| GET | `/api/v1/services` | List services in active tenant |
| POST | `/api/v1/services` | Register a service |
| GET | `/api/v1/incidents` | List incidents |
| POST | `/api/v1/incidents` | Open an incident |
| GET | `/api/v1/incidents/:id/events` | Read incident timeline |

These are planned routes, not currently available endpoints.

## API requirements

- Validate all inputs at the boundary.
- Authenticate every non-public route.
- Authorize at the resource and action level.
- Derive tenant context from trusted identity/session context, never from an unchecked client field.
- Paginate collection endpoints; use cursor pagination for large or changing datasets.
- Apply rate limits to authentication, AI, and expensive query endpoints.
- Support idempotency keys for retriable create/execute operations.
- Publish an OpenAPI specification alongside implemented routes.
