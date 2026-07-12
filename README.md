# NovaVend

NovaVend is a clean-room Second Life commerce platform. It is inspired only by the general capabilities of networked vendor systems and does not copy CasperDNS branding, text, interface, private APIs, or proprietary code.

This repository currently contains infrastructure only. Authentication, products, sales, delivery workflows, rentals, affiliates, loyalty, coupons, gift cards, and Marketplace integration are intentionally out of scope for TASK-001.

## Repository layout

- `apps/web` — Next.js dashboard shell
- `apps/api` — NestJS API shell using Fastify and Pino
- `apps/worker` — BullMQ worker shell using Redis and Pino
- `packages/database` — PostgreSQL and Drizzle connection foundation
- `packages/contracts` — shared Zod contracts
- `packages/ui` — shared React UI primitives
- `packages/config` — validated environment configuration
- `packages/secondlife-protocol` — clean-room protocol boundary types

## Prerequisites

- Node.js 20.19 or newer
- pnpm 11 or newer
- Docker with Docker Compose

## Quick start

```bash
cp .env.example .env
pnpm install
docker compose up -d
pnpm dev
```

The web app listens on `http://localhost:3000`; the API listens on `http://localhost:3001`.

## Quality commands

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
pnpm test:integration
pnpm format:check
```

`pnpm test:integration` expects PostgreSQL and Redis at the URLs configured by
`DATABASE_URL` and `REDIS_URL`. Start them with `docker compose up -d` first.
`pnpm test:e2e` starts the web development server automatically and requires the
Chromium binary installed with `pnpm exec playwright install chromium`.

Database tooling is available through `pnpm db:generate`, `pnpm db:check`,
`pnpm db:migrate`, and `pnpm db:studio`.

See [the PRD](docs/PRD.md) and [TASK-001](docs/CODEX_TASK_001_REPOSITORY_BOOTSTRAP.md) for product boundaries and acceptance criteria.

Core tenancy architecture is documented in [the architecture guide](docs/ARCHITECTURE.md),
[the database schema](docs/DATABASE_SCHEMA.md), and the ADRs under `docs/ADR`.

## Hosted preview

The frontend-only development preview is available at
[https://noethro.github.io/novavend/](https://noethro.github.io/novavend/). No local installation is
required to view it. The Pages preview does not host an API, database, authentication, or commerce
services; those require a future managed deployment. Approved changes are rebuilt and deployed
automatically after they are merged into `main`. GitHub Actions is the configured Pages publishing source.
