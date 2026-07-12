# TASK-001 — Repository Bootstrap

## Goal

Create the complete NovaVend monorepo foundation without implementing product business logic.

## Required branch

`feature/task-001-repository-bootstrap`

## Deliverables

- pnpm workspaces and Turborepo task orchestration.
- Strict shared TypeScript configuration.
- `apps/web`: minimal Next.js App Router shell.
- `apps/api`: minimal NestJS application using Fastify and structured Pino logging.
- `apps/worker`: minimal BullMQ worker runtime foundation with Pino logging.
- `packages/database`: PostgreSQL/Drizzle connection foundation.
- `packages/contracts`: shared Zod contracts.
- `packages/ui`: shared React UI package.
- `packages/config`: Zod-validated runtime configuration.
- `packages/secondlife-protocol`: clean-room protocol boundary scaffolding.
- Vitest unit-test foundation and Playwright browser-test foundation.
- ESLint, Prettier, Docker Compose, and CI configuration.
- Root README, PRD, sample environment, and ignore files.

## Constraints

- Do not copy CasperDNS branding, text, interface, private APIs, or proprietary code.
- Do not implement authentication, products, sales, delivery business logic, rentals, affiliates, loyalty, coupons, gift cards, or Marketplace integration.
- Do not merge the resulting pull request.

## Acceptance criteria

1. Dependencies install with `pnpm install`.
2. `pnpm lint` passes.
3. `pnpm typecheck` passes.
4. `pnpm test` passes.
5. `pnpm build` passes.
6. The required workspace directories are present.
7. PostgreSQL and Redis services are declared with health checks.
8. CI runs install, lint, type checking, unit tests, and builds.
9. Changes are committed and pushed on the required feature branch.
10. A pull request is opened and left unmerged.

## Definition of done

All acceptance criteria are satisfied, failures within scope are fixed, and the pull request documents validation results and known limitations.
