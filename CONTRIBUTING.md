# Contributing

Thanks for considering a contribution to PulseOps.

## Before opening a pull request

1. Check the roadmap and existing issues to avoid duplicate work.
2. Keep changes focused and explain the problem they solve.
3. Add or update tests for behavior changes.
4. Update documentation and environment examples when needed.
5. Never commit credentials, customer data, or production logs.

## Pull request expectations

Include:
- What changed and why.
- How the change was tested.
- Screenshots or API examples for user-facing changes.
- Migration and configuration notes, if applicable.
- Known limitations or follow-up work.

## Engineering standards

- Prefer small, reviewable modules.
- Validate external input at system boundaries.
- Keep tenant authorization in the server-side domain/API layer.
- Make asynchronous handlers idempotent.
- Use structured logs and avoid sensitive values.
- Label mocked integrations and synthetic data clearly.

## Reporting vulnerabilities

Do not disclose exploitable security issues in public issues. Contact the repository owner privately through GitHub's security reporting feature when available.
