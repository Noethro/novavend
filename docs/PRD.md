# NovaVend Product Requirements Document

## 1. Product summary

NovaVend is a clean-room commerce platform for Second Life merchants. It will connect a web dashboard, an API, background workers, and merchant-owned in-world LSL nodes. The product may take inspiration from the general category capabilities of networked vendor systems, but it must not copy CasperDNS branding, text, interface, private APIs, or proprietary code.

## 2. MVP objective

The eventual MVP enables a merchant to:

1. Link a Second Life avatar.
2. Pair an in-world delivery node.
3. Create a product in the web dashboard.
4. Pair an in-world vendor.
5. Receive an in-world payment.
6. Record a sale.
7. Request delivery through an LSL delivery node.
8. Review the outcome in the web dashboard.

## 3. Users

- Merchants who configure products, vendors, and delivery infrastructure.
- Shoppers who interact with merchant-owned in-world vendors.
- Operators who monitor platform health and delivery failures.

## 4. System boundaries

NovaVend owns its web application, API, worker processes, database model, public contracts, and clean-room in-world protocol. Second Life and merchant-owned LSL objects are external systems. All protocol behavior must be independently designed and documented.

## 5. Target architecture

- A Next.js web application for merchant-facing experiences.
- A NestJS API using Fastify and Pino.
- BullMQ workers backed by Redis for asynchronous work.
- PostgreSQL persistence accessed through Drizzle ORM.
- Shared Zod contracts and strict TypeScript packages.
- A separately versioned clean-room Second Life protocol package.

## 6. MVP capability roadmap

- Identity and avatar linking.
- Secure node and vendor pairing.
- Product and inventory configuration.
- Payment event ingestion and idempotent sale creation.
- Queued delivery requests, acknowledgements, retries, and audit trails.
- Merchant dashboard status and operational visibility.

## 7. TASK-001 scope

TASK-001 establishes repository infrastructure only: workspaces, applications, shared package boundaries, local services, quality tooling, CI, and minimal health/bootstrap code.

## 8. Explicit TASK-001 exclusions

No authentication, product, sale, delivery, rental, affiliate, loyalty, coupon, gift-card, or Marketplace business logic is permitted in the first task. No production deployment or LSL script is included.

## 9. Non-functional requirements

- Strict TypeScript compilation throughout the monorepo.
- Deterministic dependency installation through pnpm lockfiles.
- Independently buildable and testable workspace boundaries.
- Structured logs and environment validation.
- Local PostgreSQL and Redis parity through Docker Compose.
- Clean-room documentation and implementation practices.
- Automated lint, type-check, unit-test, and build gates.

## 10. Initial success criteria

- A new contributor can install dependencies and understand the repository from the README.
- All required applications and shared packages exist and build.
- PostgreSQL and Redis can be started locally.
- Lint, type checking, unit tests, and builds pass from the repository root.
- The first pull request contains only repository-bootstrap work.
