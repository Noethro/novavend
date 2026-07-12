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
pnpm format:check
```

See [the PRD](docs/PRD.md) and [TASK-001](docs/CODEX_TASK_001_REPOSITORY_BOOTSTRAP.md) for product boundaries and acceptance criteria.
