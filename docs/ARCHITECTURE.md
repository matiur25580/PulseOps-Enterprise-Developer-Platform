# Architecture

## Status and scope

This document describes the target architecture. The current repository is a foundation scaffold; the services below are design boundaries, not claims that all components already exist.

## Architectural principles

- Start with a modular monolith for the core business API; split services only when operationally justified.
- Keep AI inference behind a dedicated interface and never let model output directly execute privileged actions.
- Use asynchronous events for work that can be retried or processed independently.
- Make tenant, actor, and correlation context explicit across requests and events.
- Instrument the system with structured logs, metrics, and traces from the beginning.

## Logical view

```mermaid
flowchart LR
  U[Engineer] --> WEB[Next.js Portal]
  WEB --> API[NestJS Core API]
  API --> PG[(PostgreSQL)]
  API --> REDIS[(Redis)]
  API --> AI[FastAPI AI Service]
  API --> BUS[Event Bus - later phase]
  BUS --> WORKERS[Background Workers - later phase]
  API --> OTEL[OpenTelemetry]
  WORKERS --> OTEL
  AI --> OTEL
```

## Main boundaries

| Component | Responsibility | Initial approach |
| --- | --- | --- |
| Web portal | Service catalog, operational views, workflows | Next.js app |
| Core API | Authenticated domain APIs and authorization | NestJS modular monolith |
| AI service | Explanations, summaries, anomaly context | FastAPI service, isolated |
| PostgreSQL | Durable domain data and audit records | Primary datastore |
| Redis | Cache, rate-limit counters, short-lived coordination | Optional infrastructure dependency |
| Event processing | Retries and asynchronous workflows | Introduce after synchronous slice works |
| Telemetry | Traces, metrics, structured logs | OpenTelemetry conventions |

## Current observability slice

The API emits structured JSON HTTP request events, creates server spans with W3C trace context, returns `traceparent` and `x-trace-id` response headers, and can export sampled spans through OTLP/HTTP when configured. An AsyncLocalStorage context helper allows outbound HTTP clients to inject the active W3C `traceparent`. The API also exposes process-local Prometheus request counters and duration histograms at `/api/v1/metrics`; these metrics are not durable or horizontally aggregated. Service-level objectives are persisted per service and calculated from authenticated SLI sample ingestion; production traffic is not yet automatically mapped to service SLI events.

Service dependencies are stored as tenant-scoped directed edges. The API rejects self-edges and detects cycles before insertion.

## Request flow

1. The browser sends an authenticated request to the API.
2. The API validates input, resolves tenant and actor context, and authorizes the operation.
3. Domain logic reads or writes PostgreSQL within a transaction.
4. An outbox record is written in the same transaction when an event must be published.
5. A worker publishes and processes events with idempotency and retry policies.
6. Telemetry records request, dependency, and workflow outcomes.

## Reliability and failure handling

- Set explicit timeouts on network calls.
- Retry only transient failures, with bounded exponential backoff and jitter.
- Use idempotency keys for externally retried write operations.
- Use a transactional outbox when database writes and event publication must stay consistent.
- Define dead-letter handling and operator replay procedures before enabling asynchronous production workflows.
- Degrade optional AI features without blocking core incident and service-management workflows.

## Security boundaries

- Enforce authorization in the API, not only in the UI.
- Scope every tenant-owned record and query by tenant.
- Keep secrets in deployment secret stores; never commit real credentials.
- Require explicit human approval for disruptive or privileged remediation.
- Record actor, action, target, timestamp, and outcome in the audit trail.


## Distributed tracing configuration

OTLP export is opt-in. Set `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` to a complete OTLP/HTTP traces URL, or set `OTEL_EXPORTER_OTLP_ENDPOINT` as the base URL (the API appends `/v1/traces`). Configure `OTEL_SERVICE_NAME` and optional comma-separated `OTEL_EXPORTER_OTLP_HEADERS` for authenticated collectors. `OTEL_TRACES_SAMPLER_ARG` controls deterministic root sampling from 0 to 1; the default is 1.0. Incoming sampled W3C trace context remains sampled, while an unsampled parent remains unsampled.

The exporter uses the Node.js built-in Fetch API, a bounded three-second timeout, and best-effort delivery so collector outages do not fail API requests. The context helper exposes `TraceContextService.inject(headers)` for outbound HTTP adapters. Current tracing covers inbound HTTP server spans; automatic database/Prisma spans, browser-to-API instrumentation, baggage, metrics OTLP export, and a collector deployment are not included. Without an OTLP endpoint, spans are not sent remotely, but trace IDs remain available in response headers and structured logs.


## GitHub delivery intelligence

A workspace can map a GitHub repository to one catalog service. A public webhook receiver validates GitHub's HMAC SHA-256 signature against the raw request body and persists delivery IDs idempotently. Merged pull requests and terminal deployment statuses are normalized into PostgreSQL records. DORA calculations are derived from those records and workspace incident history; they expose sample sizes and explicitly label proxy definitions. GitHub App OAuth, automatic webhook provisioning, and direct GitHub API polling are not implemented.
