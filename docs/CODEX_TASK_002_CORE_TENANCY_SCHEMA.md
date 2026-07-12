# CODEX TASK-002 — Core Tenancy Domain and Database Schema

## Role

Act as a senior backend and data-platform engineer. Implement the foundational tenancy domain for NovaVend. Read `docs/PRD.md` completely before changing code.

## Objective

Create the first production-grade business database schema and repository layer for:

- users
- workspaces
- workspace memberships
- globally identified Second Life avatar accounts
- workspace-to-avatar links
- audit logs
- idempotency records

This task establishes tenant isolation and durable migrations. It does **not** implement authentication, API endpoints, device pairing, products, vendors, sales, or delivery logic.

## Branch and pull request

Work only on this existing branch:

`feature/task-002-core-tenancy-schema`

Do not commit directly to `main`.

When complete, open a **draft pull request** targeting `main`. Do not merge it.

## Required design decisions

### Identifiers

- Use PostgreSQL UUID primary keys.
- IDs exposed outside the database must be non-sequential.
- Prefer database-generated UUID defaults supported by the existing stack.
- Do not introduce integer public IDs.

### Time

- Store all timestamps as timezone-aware PostgreSQL timestamps.
- Treat all timestamps as UTC in application code.
- Use database defaults for creation timestamps where appropriate.

### Soft deletion

- Users and workspaces require nullable `deleted_at` timestamps.
- Normal queries must exclude soft-deleted records unless explicitly requested.
- Do not physically delete users or workspaces through repository methods.

### Workspace isolation

Every workspace-owned query must require an explicit `workspaceId` parameter.

Repository APIs must make accidental unscoped reads difficult. Do not expose generic methods such as:

- `findAll()`
- `findById(id)` for tenant-owned records
- unrestricted table access through business repositories

Use workspace-scoped methods such as:

- `findWorkspaceById(workspaceId)`
- `findMember(workspaceId, userId)`
- `listWorkspaceAvatars(workspaceId)`
- `findIdempotencyRecord(workspaceId, scope, keyHash)`

Database-level PostgreSQL Row-Level Security is deferred. Document this decision and the compensating repository-level controls in an ADR.

## Required tables

### 1. `users`

Required columns:

- `id` UUID primary key
- `email` original email value
- `email_normalized` lowercased normalized email
- `display_name` nullable
- `status` enum: `pending`, `active`, `suspended`, `deleted`
- `created_at`
- `updated_at`
- `deleted_at` nullable

Required rules:

- Unique constraint on `email_normalized`
- Email normalization must be performed by a shared domain helper and tested
- No password hash, session, OAuth identity, or MFA fields in this task

### 2. `workspaces`

Required columns:

- `id` UUID primary key
- `name`
- `slug`
- `status` enum: `active`, `suspended`, `deleted`
- `created_by_user_id` foreign key to `users`
- `created_at`
- `updated_at`
- `deleted_at` nullable

Required rules:

- Unique constraint on normalized `slug`
- Slugs use lowercase ASCII letters, digits, and hyphens
- Add a shared slug-normalization and validation helper with tests

### 3. `workspace_members`

Required columns:

- `workspace_id` foreign key
- `user_id` foreign key
- `role` enum: `owner`, `manager`, `support`, `viewer`
- `status` enum: `active`, `invited`, `suspended`
- `joined_at` nullable
- `created_at`
- `updated_at`

Required rules:

- Composite primary key or equivalent unique constraint on `(workspace_id, user_id)`
- Indexes supporting member lookup by workspace and by user
- Repository method for creating a workspace and its first owner atomically
- Repository/service rule preventing removal or demotion of the final active owner
- Concurrency-safe test for the final-owner rule

### 4. `avatar_accounts`

This is a global Second Life identity table.

Required columns:

- `id` UUID primary key
- `avatar_uuid` UUID representing the Second Life avatar
- `display_name` nullable
- `legacy_name` nullable
- `created_at`
- `updated_at`

Required rules:

- Unique constraint on `avatar_uuid`
- One global avatar record may be linked to multiple workspaces

### 5. `workspace_avatar_accounts`

Required columns:

- `workspace_id` foreign key
- `avatar_account_id` foreign key
- `linked_by_user_id` foreign key
- `status` enum: `active`, `revoked`
- `linked_at`
- `revoked_at` nullable

Required rules:

- Unique link per `(workspace_id, avatar_account_id)`
- A revoked link may be reactivated without creating duplicates
- All reads require workspace scope

### 6. `audit_logs`

Required columns:

- `id` UUID primary key
- `workspace_id` nullable for pre-workspace account events
- `actor_user_id` nullable
- `actor_avatar_account_id` nullable
- `action`
- `entity_type`
- `entity_id` nullable UUID
- `correlation_id` nullable
- `metadata` JSONB with an empty-object default
- `created_at`

Required rules:

- Append-only repository API
- No update or delete repository methods
- Index by workspace and creation time
- Index by actor user and creation time
- Metadata must never contain raw passwords, tokens, pairing codes, or device secrets; document this rule

### 7. `idempotency_records`

Required columns:

- `id` UUID primary key
- `workspace_id` foreign key
- `scope`
- `key_hash`
- `request_hash`
- `status` enum: `in_progress`, `completed`, `failed`
- `response_status` nullable integer
- `response_body` nullable JSONB
- `expires_at`
- `created_at`
- `updated_at`

Required rules:

- Unique constraint on `(workspace_id, scope, key_hash)`
- Never store the raw idempotency key
- Repository must distinguish first claim, duplicate matching request, and conflicting reuse with a different request hash
- Add expiration cleanup support without creating a scheduler in this task

## Drizzle and migration requirements

- Implement all schema definitions in `packages/database`.
- Generate and commit real SQL migrations and Drizzle metadata.
- Migration must apply successfully to an empty PostgreSQL database.
- Document a development reset procedure.
- Add useful foreign-key behavior explicitly.
- Do not use `ON DELETE CASCADE` for users, workspaces, audit logs, or idempotency records unless clearly justified.
- Export schema types required by future tasks.

## Repository layer

Create focused repository/domain modules inside `packages/database` or a clearly named sibling package if justified.

Required capabilities:

- Create user
- Find active user by normalized email
- Soft-delete user
- Create workspace and initial owner in one transaction
- Find active workspace by ID and slug
- Add workspace member
- Change member role with final-owner protection
- Suspend workspace member with final-owner protection
- Upsert global avatar account by Second Life avatar UUID
- Link, revoke, and reactivate avatar link within a workspace
- List active workspace avatars
- Append audit event
- Claim/read/complete/fail idempotency record
- Delete expired idempotency records through an explicit maintenance method

Use typed result objects for expected domain conflicts. Do not use exceptions for normal outcomes such as duplicate membership, final-owner protection, or conflicting idempotency reuse.

## Documentation

Create or update:

- `docs/ARCHITECTURE.md`
- `docs/DATABASE_SCHEMA.md`
- `docs/ADR/0001-modular-monolith.md`
- `docs/ADR/0002-workspace-isolation.md`

Documentation must include:

- Entity relationships
- Tenant boundary rules
- Why avatar identity is global but workspace links are tenant-owned
- Soft-deletion behavior
- Final-owner invariant
- Idempotency behavior
- Why PostgreSQL RLS is deferred
- Migration and local reset instructions

A Mermaid ER diagram is acceptable in `docs/DATABASE_SCHEMA.md`.

## Tests

Add unit tests for:

- Email normalization
- Workspace slug normalization and rejection
- Typed domain result handling
- Idempotency request-hash comparison logic

Add PostgreSQL integration tests for:

1. Migration applies to an empty database.
2. Normalized email uniqueness is enforced.
3. Workspace slug uniqueness is enforced.
4. Workspace and first owner are created atomically.
5. Duplicate membership is rejected predictably.
6. Final active owner cannot be demoted.
7. Final active owner cannot be suspended.
8. A workspace with two active owners may demote one owner.
9. The same avatar UUID can link to multiple workspaces.
10. The same avatar cannot be linked twice within one workspace.
11. A revoked avatar link can be reactivated.
12. Workspace-scoped repository reads do not return another workspace's data.
13. Audit records can be appended and queried by workspace.
14. First idempotency claim succeeds.
15. Repeated matching idempotency request is recognized as a duplicate.
16. Reuse of the same key hash with a different request hash is reported as a conflict.
17. Expired idempotency records can be removed by the maintenance method.
18. Soft-deleted users and workspaces are excluded from normal reads.

Tests must run against a real PostgreSQL service in CI. Do not mock the database for integration assertions.

## CI and scripts

- Ensure `pnpm test:integration` runs the new database integration tests.
- Ensure migrations run before integration tests.
- Add a migration/schema consistency check supported by the installed Drizzle version.
- Keep existing quality and E2E jobs passing.
- Update `.env.example` only when new variables are actually required.

## Security requirements

- Never log or store raw passwords, session tokens, pairing codes, device credentials, or idempotency keys.
- Use hashes for idempotency keys and request payload fingerprints.
- Do not add authentication shortcuts.
- Keep SQL parameterized through Drizzle or the database driver.
- Preserve correlation IDs in audit events when supplied by callers.

## Explicitly out of scope

Do not implement:

- Registration or login endpoints
- Password hashing or session management
- OAuth
- Email sending or verification
- Pairing code generation
- Device tables
- Heartbeats
- Product tables
- Vendors
- Sales
- Delivery jobs
- Rentals
- Affiliate systems
- Gift cards
- Loyalty
- Coupons
- Marketplace integration
- Web dashboard screens
- PostgreSQL RLS policies

## Acceptance criteria

1. All required tables, constraints, indexes, enums, and relations exist.
2. SQL migrations apply cleanly to an empty PostgreSQL database.
3. All tenant-owned repository methods require `workspaceId`.
4. Cross-workspace repository isolation tests pass.
5. Final-owner protection is implemented and concurrency-safe.
6. Avatar accounts are globally unique and linkable to multiple workspaces.
7. Audit logging is append-only at the repository API level.
8. Raw idempotency keys are never stored.
9. Unit and PostgreSQL integration tests pass.
10. Existing lint, typecheck, unit, build, integration, and E2E checks remain green.
11. Documentation accurately matches the implementation.
12. No out-of-scope feature is added.

## Completion procedure

Before finishing:

1. Update from current `main` if needed.
2. Run `pnpm format:check`.
3. Run `pnpm lint`.
4. Run `pnpm typecheck`.
5. Run `pnpm test`.
6. Start PostgreSQL and Redis as documented.
7. Apply migrations to a fresh database.
8. Run `pnpm test:integration`.
9. Run `pnpm build`.
10. Run `pnpm test:e2e`.
11. Fix every failure within task scope.
12. Commit and push the branch.
13. Open a draft PR targeting `main`.
14. Do not merge.

## Required final report

Return:

- Draft PR link
- Final commit SHA
- Complete changed-file list
- Migration file names
- Implemented tables and constraints
- Commands executed
- Exact unit and integration test counts
- Build and E2E results
- Known limitations
- Deviations from this task, if any

Stop and report rather than guessing if the existing architecture conflicts with these requirements or if a required behavior cannot be implemented safely in the installed framework versions.
