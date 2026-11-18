# PulseOps

**An AI-assisted developer platform for cloud operations, observability, incident response, SRE, and FinOps.**

PulseOps is an engineering platform project designed to bring service ownership, operational signals, incident workflows, reliability objectives, and cloud-cost visibility into one workspace.

> **Project status:** Foundation in progress. This repository currently contains architecture and engineering foundations; integrations and production capabilities are not yet implemented. Any future demo data or simulated integrations will be clearly labelled.

## Why PulseOps?

Modern engineering teams often work across disconnected tools for service catalogs, deployments, monitoring, incidents, reliability objectives, and cloud spend. PulseOps aims to provide a coherent operational view while keeping automation safe, auditable, and human-approved.

## Planned capabilities

| Area | Intended capability |
| --- | --- |
| Developer portal | Service catalog, ownership, dependencies, runbooks |
| Delivery | Deployment history, release metadata, CI/CD integration |
| Observability | Metrics, logs, traces, service health |
| Incident management | Incident timeline, severity, ownership, escalation |
| AIOps | Incident summaries, anomaly context, root-cause hypotheses |
| SRE | SLIs, SLOs, error budgets, burn-rate signals |
| FinOps | Cloud usage, budgets, cost allocation, trend analysis |
| Governance | RBAC, audit events, secure configuration |
| Engineering analytics | DORA metrics and operational trends |

## Architecture direction

- **Web:** Next.js, React, TypeScript
- **Core API:** NestJS, TypeScript
- **AI service:** Python, FastAPI
- **Data:** PostgreSQL, Prisma, Redis
- **Events:** Kafka or Redpanda (later phase)
- **Telemetry:** OpenTelemetry, Prometheus, Grafana
- **Infrastructure:** Docker, Kubernetes, Terraform
- **Quality:** Vitest/Jest, Pytest, Playwright, GitHub Actions

The architecture is intentionally modular. The first implementation milestone will establish a working vertical slice before introducing distributed infrastructure.

## Repository layout

```text
apps/
  web/                 # Next.js developer portal
  api/                 # NestJS core API
  ai-service/          # FastAPI intelligence service
services/
  event-worker/        # asynchronous event processing (planned)
  incident-engine/     # incident workflows (planned)
  cost-engine/         # cost aggregation (planned)
packages/
  shared-types/        # shared contracts
  validation/          # shared validation schemas
  config/              # shared tooling configuration
infrastructure/
  docker/
  kubernetes/
  terraform/
monitoring/
  prometheus/
  grafana/
  opentelemetry/
docs/
  ARCHITECTURE.md
  DATABASE.md
  API.md
  SECURITY.md
  DEPLOYMENT.md
  ROADMAP.md
.github/workflows/
```

## Getting started

The runnable application setup is being added in the Foundation milestone. Until then, this repository is a design and implementation scaffold, not a deployable product.

See:
- [Architecture](docs/ARCHITECTURE.md)
- [Database design](docs/DATABASE.md)
- [API conventions](docs/API.md)
- [Security model](docs/SECURITY.md)
- [Deployment strategy](docs/DEPLOYMENT.md)
- [Roadmap](docs/ROADMAP.md)

## Engineering principles

1. Build a tested vertical slice before adding more services.
2. Treat integrations as live, mocked, or planned—never blur the distinction.
3. Require explicit authorization and human approval for risky production actions.
4. Design for least privilege, auditability, and secure secret handling.
5. Measure reliability with observable, actionable signals.
6. Document operational trade-offs and failure modes.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Issues and pull requests are welcome.

## License

A license has not yet been selected. Until one is added, all rights are reserved by the repository owner.
