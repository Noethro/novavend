# ADR-0001: TypeScript Modular Monolith

- Status: Accepted
- Date: 2026-07-12

## Context

NovaVend needs clear domain boundaries without the operational cost and distributed consistency risks of premature microservices. The web, API, worker, database, and clean-room protocol already share one pnpm/Turborepo workspace.

## Decision

Build NovaVend as a TypeScript modular monolith. Deployable processes remain separate apps, while domain modules expose narrow typed APIs from shared packages. TASK-002 places the tenancy schema, domain helpers, and focused repositories in `packages/database` because their invariants and transactions are inseparable from PostgreSQL behavior.

Business modules must not import unrestricted database tables through generic repositories. They use the focused tenancy repositories and explicit transaction boundaries.

## Consequences

- Cross-module refactoring and transactions remain straightforward.
- CI can validate one deterministic dependency graph.
- Module discipline is enforced through APIs and review rather than network boundaries.
- A future service extraction remains possible when operational evidence justifies it.
