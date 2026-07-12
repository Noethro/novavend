# NovaVend Architecture

## System shape

NovaVend is a TypeScript modular monolith. Deployable applications live under `apps/`, while domain boundaries and infrastructure live under `packages/`. TASK-002 adds the core tenancy domain to `packages/database`; it does not add authentication or HTTP endpoints.

The primary runtime components are:

- `apps/web`: Next.js merchant dashboard shell.
- `apps/api`: NestJS/Fastify API with dependency health checks.
- `apps/worker`: BullMQ background-process shell.
- `packages/database`: PostgreSQL schema, migrations, and focused repositories.
- `packages/contracts`: transport-level Zod contracts.
- `packages/secondlife-protocol`: clean-room in-world protocol contracts.

## Domain boundaries

The tenancy domain owns users, workspaces, memberships, global avatar identities, workspace-avatar links, audit events, and idempotency records. Future product, vendor, sale, and delivery modules must reference the tenancy domain rather than bypassing it.

Workspace ownership is explicit at every repository call. Tenant-owned reads cannot be issued without a `workspaceId`. Generic unscoped business-repository methods are deliberately absent.

## Transaction boundaries

Workspace creation and its first active owner are inserted in one database transaction. Final-owner changes take a transaction-scoped PostgreSQL advisory lock keyed by workspace ID, then re-count active owners before mutation. This preserves the invariant under concurrency.

## Time and identifiers

Public identifiers are PostgreSQL UUIDs generated with `gen_random_uuid()`. Database timestamps use `timestamp with time zone`; application code uses JavaScript `Date` values interpreted as UTC.

## Security boundary

Raw passwords, session tokens, pairing codes, device credentials, and idempotency keys must never be logged or persisted. Idempotency repositories accept only hashes. Audit metadata must be allowlisted by callers and must never include secrets.

See [ADR-0001](ADR/0001-modular-monolith.md), [ADR-0002](ADR/0002-workspace-isolation.md), and [the database schema](DATABASE_SCHEMA.md).

## Frontend localization boundary

TASK-003 keeps locale state in one client-side `LocaleProvider` inside the root web layout. The
dashboard shell, pages, language selector, typed navigation, committed dictionaries, and shared
`Intl` formatters live under `apps/web/src`. Pages do not duplicate locale resolution or persistence
logic. This boundary requires no API, cookie, middleware, or server session and remains compatible
with both normal Next.js builds and the `/novavend` GitHub Pages static export.

See [the internationalization guide](INTERNATIONALIZATION.md) for locale resolution, dictionary, and
testing rules.
