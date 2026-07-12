# ADR-0002: Repository-Enforced Workspace Isolation

- Status: Accepted
- Date: 2026-07-12

## Context

NovaVend is multi-tenant. Tenant-owned records must not leak across workspaces. PostgreSQL Row-Level Security would add a second authorization context before authentication, connection-scoped tenant identity, and operational policies exist.

## Decision

Defer PostgreSQL RLS. Enforce isolation at the focused repository boundary for TASK-002:

- Every tenant-owned read and mutation takes an explicit `workspaceId`.
- No generic `findAll()` or unscoped tenant `findById()` method is exposed.
- Composite uniqueness includes `workspace_id` where identity is tenant-owned.
- Cross-workspace PostgreSQL integration tests exercise repository isolation.
- Code review treats unscoped table access outside the database package as a security defect.

The global `avatar_accounts` table is deliberately not tenant-owned. A workspace owns only its link in `workspace_avatar_accounts`, enabling one Second Life identity to participate in multiple workspaces without duplicating global identity.

## Compensating controls

Repository method signatures make the scope mandatory, parameterized Drizzle queries include the workspace predicate, and tests verify negative cross-tenant reads. Audit and idempotency reads are also workspace-scoped. PostgreSQL roles used by applications should not be granted schema-modifying permissions.

## Consequences

- Isolation is testable without hidden connection session state.
- Direct SQL outside the repository boundary remains a risk and is prohibited by architecture.
- RLS should be reconsidered after authentication and request-to-workspace context are implemented.
