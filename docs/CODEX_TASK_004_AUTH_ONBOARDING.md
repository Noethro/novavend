# CODEX TASK-004 — Authentication and First-Workspace Onboarding

## Role

Act as a senior application-security, backend, and frontend engineer. Implement NovaVend's first production-grade identity flow without weakening the tenancy guarantees from TASK-002 or the multilingual/static-preview guarantees from TASK-003.

Read these files completely before changing code:

- `docs/PRD.md`
- `docs/ARCHITECTURE.md`
- `docs/DATABASE_SCHEMA.md`
- `docs/INTERNATIONALIZATION.md`
- `docs/CODEX_TASK_002_CORE_TENANCY_SCHEMA.md`
- `docs/CODEX_TASK_002A_BROWSER_PREVIEW.md`
- `docs/CODEX_TASK_003_MULTILINGUAL_DASHBOARD.md`

## Objective

Add real email/password authentication to the API and database, then add the first authenticated onboarding flow that creates a merchant workspace and its owner membership.

The normal server-capable application must support:

1. Registering with email, display name, and password.
2. Creating a secure server-side session.
3. Logging in and logging out.
4. Reading the current authenticated session.
5. Redirecting a newly registered user to first-workspace onboarding.
6. Atomically creating the first workspace and active owner membership.
7. Entering the dashboard after onboarding.

The GitHub Pages deployment remains a static frontend-only preview. It must display the new authentication and onboarding screens in all six languages, but it must not pretend that an account was created or make calls to an unhosted API.

## Branch and pull request

Work only on the existing branch:

`feature/task-004-auth-onboarding`

Do not create another branch. Do not commit directly to `main`.

Open one draft pull request targeting `main`. Continue updating that same pull request. Do not merge it.

## Scope boundaries

### Included

- Password credential persistence.
- Opaque server-side sessions.
- Registration, login, logout, and current-session API endpoints.
- Authenticated first-workspace creation.
- Authentication middleware/guard and request identity context.
- Exact-origin credentialed browser access.
- Redis-backed abuse throttling for registration and login.
- Login, registration, and onboarding frontend routes.
- Multilingual validation, errors, loading states, and accessible forms.
- Honest GitHub Pages preview behavior.
- Database migration, repositories, contracts, documentation, and tests.

### Excluded

Do not implement:

- Email delivery or email verification.
- Password reset or account recovery.
- Multi-factor authentication.
- OAuth, social login, passkeys, or Second Life login.
- Team invitations or role-management screens.
- Avatar linking, devices, DropBoxes, products, vendors, payments, sales, deliveries, or rentals.
- A managed API/database deployment.
- Fake authentication or fake successful account creation in GitHub Pages.

Document excluded security features clearly as known limitations, not as completed functionality.

## Required authentication design

### 1. Password credentials

Add a dedicated table such as `user_password_credentials` rather than placing password hashes on `users`.

Required fields:

- `user_id` UUID primary key and foreign key to `users.id`.
- `password_hash` text, not null.
- `password_updated_at` timezone-aware timestamp.
- `created_at` and `updated_at` timezone-aware timestamps.

Requirements:

- Hash passwords with Argon2id through a maintained Node.js library.
- Use explicit reviewed parameters of at least 64 MiB memory, 3 iterations, and parallelism 1, unless the selected library expresses equivalent safe parameters differently.
- Passwords must be 12–128 characters.
- Accept Unicode passwords.
- Do not trim or normalize password content.
- Never log, audit, return, or persist a raw password.
- Never expose the password hash outside the authentication repository/service.
- Password verification must use the library's constant-time verifier.

### 2. Server-side sessions

Add a `user_sessions` table.

Required fields:

- UUID primary key.
- `user_id` foreign key.
- Unique `token_hash`.
- `created_at`.
- `last_seen_at`.
- `expires_at`.
- Nullable `revoked_at`.

Add indexes for active lookup, user-session lookup, and expiry maintenance.

Session requirements:

- Generate at least 256 bits of cryptographically secure randomness.
- Send only the raw opaque token to the browser.
- Persist only a SHA-256 token hash.
- Use an HttpOnly cookie.
- Use `SameSite=Lax` or stricter.
- Use `Secure` in production.
- Use a narrow, documented cookie name such as `novavend_session`.
- Do not store authentication tokens in `localStorage` or `sessionStorage`.
- Use a finite lifetime; default to seven days unless the existing configuration model justifies another documented value.
- Reject expired, revoked, suspended-user, deleted-user, and unknown sessions.
- Logout must revoke the current session and expire the cookie.
- Update `last_seen_at` without writing on every single request; use a reasonable minimum refresh interval.
- Add an explicit expired/revoked-session cleanup repository method. Do not add a scheduler in this task.

### 3. User lifecycle

Registration must:

- Normalize email through the existing tenancy normalization rules.
- Reject duplicate active or pending email identities without leaking password information.
- Create the user with status `pending`.
- Create the password credential in the same database transaction.
- Create a session only after the transaction succeeds.
- Return a response indicating that workspace onboarding is required.

Pending users may authenticate only to complete onboarding.

First-workspace onboarding must atomically:

- Validate the authenticated pending or active user.
- Create the workspace using the existing tenancy repository invariants.
- Create the active owner membership.
- Change a pending user to `active`.
- Append appropriate audit records.
- Roll back every change if any step fails.

Active users who already own or belong to a workspace must not accidentally create duplicate "first" onboarding workspaces through retries. Handle retry/conflict behavior deterministically.

Suspended or deleted users must not register a new session or use onboarding endpoints.

### 4. Abuse resistance

Implement Redis-backed throttling for at least:

- Registration attempts by client IP.
- Login attempts by client IP.
- Login attempts by normalized-email hash plus client IP.

Requirements:

- Never use the raw password in a rate-limit key.
- Prefer a SHA-256 normalized-email fingerprint rather than raw email in Redis keys.
- Use bounded windows and documented limits.
- Return `429` with a stable error code and `Retry-After` where practical.
- If Redis is unavailable, do not silently bypass authentication rate limits. Return a controlled service-unavailable response for protected auth mutations.
- Do not create a permanent account-lockout mechanism that lets attackers lock another user indefinitely.

### 5. Browser-origin protection

Configure browser access explicitly:

- Add validated API configuration for the allowed web origin.
- Credentialed CORS must allow only the exact configured origin; never use wildcard origin with credentials.
- Validate `Origin` for browser mutation requests that create or use credentialed sessions.
- Reject unexpected origins with a stable error contract.
- Preserve correlation IDs and redact cookie/authorization-sensitive headers from logs.
- Do not log raw request bodies on authentication routes.

## API contracts and endpoints

Use shared Zod contracts in `packages/contracts` as the transport source of truth. NestJS DTOs/adapters may wrap them, but validation behavior must not drift.

Implement:

### `POST /auth/register`

Request:

- `email`
- `displayName`
- `password`

Behavior:

- Creates pending user, credential, and session.
- Sets session cookie.
- Returns a safe user projection and `needsOnboarding: true`.
- Use `201` on success.
- Duplicate email returns a stable conflict code without exposing internal database details.

### `POST /auth/login`

Request:

- `email`
- `password`

Behavior:

- Uses one generic invalid-credentials response for unknown email and incorrect password.
- Creates a new server session on success.
- Returns the safe user projection and onboarding/workspace state.
- Do not reveal whether an account exists.

### `POST /auth/logout`

Behavior:

- Requires or safely handles the current cookie.
- Revokes the matching session when present.
- Clears the cookie.
- Is idempotent from the browser perspective.

### `GET /auth/session`

Behavior:

- Returns `401` when no valid session exists.
- Returns only safe user fields.
- Returns memberships/workspace summaries required by the dashboard shell.
- Returns `needsOnboarding` based on user/workspace state.
- Never returns hashes, internal credentials, raw session tokens, or unrestricted tenant data.

### `POST /onboarding/workspace`

Request:

- `name`
- Optional requested `slug`; otherwise derive it safely.

Behavior:

- Requires a valid session.
- Creates the first workspace and owner membership atomically.
- Activates a pending user.
- Returns a safe workspace summary.
- Handles slug collisions without leaking SQL details.
- Prevents accidental duplicate first-workspace creation.

## Repository and service boundaries

- Keep password and session persistence behind focused authentication repositories.
- Do not expose generic unrestricted table access to application modules.
- Reuse existing user, workspace, membership, audit, and normalization behavior.
- Every workspace-owned read remains explicitly workspace-scoped.
- Authentication guards may resolve a global user identity, but authorization to workspace data must still require membership and workspace context.
- Add an ADR documenting opaque server-side sessions and why JWT/local-storage authentication was not selected.
- Update architecture and database-schema documentation.

## Audit and logging

Append safe audit events for successful:

- User registration.
- Login.
- Logout/revocation when attributable.
- First workspace creation/onboarding completion.

Do not store raw email, password, cookie, session token, password hash, Redis rate-limit key, or credential headers in audit metadata.

Failed authentication attempts may be structured security logs, but they must use generic outcomes and safe fingerprints rather than secrets.

## Frontend requirements

### Routes

Add static-export-compatible routes:

- `/login/`
- `/register/`
- `/onboarding/`

Preserve:

- `/`
- `/status/`
- `/novavend/` base-path behavior on GitHub Pages.

### Real server-capable behavior

When an actual API is configured and preview mode is disabled:

- Registration submits to `/auth/register` with credentials enabled.
- Successful registration routes to onboarding.
- Login routes pending users to onboarding and onboarded users to the dashboard.
- Onboarding creates the first workspace, refreshes session state, and routes to the dashboard.
- Logout revokes the server session and routes to login.
- API requests use `credentials: 'include'`.
- Do not persist user/session/auth state in browser storage.
- Locale persistence may continue using the existing `novavend.locale` key.
- API errors map to localized, user-safe messages.
- Forms have field-level validation, submit loading state, disabled duplicate submission, and keyboard/screen-reader support.

### GitHub Pages preview behavior

Update the Pages build with an explicit public preview-mode environment variable, for example `NEXT_PUBLIC_PREVIEW_MODE=true`.

In preview mode:

- Authentication and onboarding pages render fully in all six languages.
- Submit actions are disabled or intercepted before any network request.
- Display a clear localized explanation that accounts cannot be created in the frontend-only preview because the API/database are not hosted yet.
- Do not simulate a successful login, set fake auth state, or store fake credentials.
- Keep the existing dashboard visible for product-design review.
- Do not make failed requests to `api.not-hosted.invalid` or any nonexistent API.
- Static export must include root, status, login, register, and onboarding HTML outputs.

### Localization

Every new user-facing string must be added to all six committed dictionaries:

- English `en`
- Turkish `tr`
- German `de`
- Russian `ru`
- Simplified Chinese `zh-CN`
- Japanese `ja`

English remains the fallback. Dictionary completeness tests must remain strict.

## Configuration

Add validated environment settings as needed, including equivalents of:

- Allowed web origin.
- Session cookie name.
- Session lifetime.
- Secure-cookie mode derived safely from environment.
- Authentication rate-limit windows and limits, with secure defaults.
- Frontend preview mode.

Update `.env.example` without adding real secrets.

Production configuration must fail fast when required origins or security-sensitive settings are invalid.

## Database migration

Create and commit a new Drizzle migration for authentication tables and indexes.

Requirements:

- Migration applies cleanly after TASK-002 migrations.
- Migration metadata and snapshots are committed.
- `pnpm db:check` passes.
- Integration tests apply the complete migration chain to an empty PostgreSQL 17 database.
- Do not edit an already-merged migration to retrofit authentication.

## Required tests

### Unit tests

Cover at minimum:

- Email normalization integration.
- Password policy boundaries.
- Argon2id hash and verification.
- Session-token generation and hash-only persistence behavior.
- Cookie options for test/development/production.
- Session expiry and revocation rules.
- Safe user/session response projection.
- Origin validation.
- Rate-limit key privacy and decision behavior.
- Contract validation.
- Locale dictionary completeness for every new string.
- Frontend auth-state routing decisions.
- Preview mode never issuing auth requests.

### PostgreSQL/Redis integration tests

Cover at minimum:

1. Registration creates one pending user and one credential atomically.
2. Password hashes are not equal to raw passwords.
3. Duplicate normalized email is rejected safely.
4. Failed registration rolls back user and credential together.
5. Login succeeds with the correct password.
6. Unknown email and wrong password return the same public error shape.
7. Session storage contains only the token hash.
8. Valid session resolves the correct user.
9. Expired session is rejected.
10. Revoked session is rejected.
11. Suspended/deleted user session is rejected.
12. Logout revokes the session.
13. First onboarding creates workspace and active owner membership atomically.
14. Onboarding activates a pending user.
15. Onboarding rollback preserves invariants on conflict.
16. Duplicate first-onboarding retry is deterministic and creates no second workspace.
17. Cross-user session access is impossible.
18. Rate limiting operates through Redis and does not persist raw email/password data.
19. Unexpected origin is rejected for protected mutations.
20. Audit records contain no credentials or session tokens.

Keep every existing TASK-001 through TASK-003 integration assertion green.

### API integration tests

Boot the real NestJS/Fastify application against PostgreSQL and Redis and verify:

- Register response and cookie.
- Generic login failure.
- Successful login.
- Current-session response.
- Onboarding authorization and success.
- Logout and cookie expiration.
- Cookie flags and exact-origin CORS behavior.
- `429` behavior and stable error contracts.

### Frontend tests

Cover:

- All auth/onboarding screens in all six locales.
- Accessible labels and validation errors.
- Loading and duplicate-submit prevention.
- Correct redirects based on pending/active/session state.
- Preview-mode explanation and disabled submission.
- Mobile layout at 320 px without horizontal overflow.

### Playwright and static export

Verify in Chromium:

- `/novavend/login/`, `/register/`, and `/onboarding/` load in preview mode.
- Language changes persist across these routes and reloads.
- Preview forms make no API requests.
- Existing dashboard and status navigation still work.
- Static export contains all five public HTML routes and repository-scoped assets.

## CI and validation commands

Run and fix every in-scope failure:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm db:check
pnpm test:integration
pnpm build
GITHUB_PAGES=true NEXT_PUBLIC_PREVIEW_MODE=true pnpm --filter @novavend/web build
pnpm --filter @novavend/web test:static-export
pnpm test:e2e
```

Update CI where needed so PostgreSQL 17, Redis, API integration, Chromium, and static export are validated in GitHub Actions.

## Documentation

Update at minimum:

- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/DATABASE_SCHEMA.md`
- `.env.example`
- A new authentication/session ADR.

Document:

- Authentication flow.
- Pending-to-active onboarding transition.
- Cookie/session model.
- Origin and rate-limit protections.
- Pages preview limitation.
- Explicitly deferred email verification, recovery, MFA, and managed backend hosting.

## Acceptance criteria

1. Registration, login, logout, and current-session endpoints work against PostgreSQL and Redis.
2. Passwords use reviewed Argon2id hashing and are never logged or returned.
3. Browser sessions use opaque random cookies with hash-only database storage.
4. Pending users can complete atomic first-workspace onboarding and become active.
5. Workspace tenancy invariants and owner membership guarantees remain intact.
6. Suspended, deleted, expired, and revoked identities cannot authenticate.
7. Login failure does not reveal whether an email exists.
8. Redis-backed limits and exact-origin protection cover authentication mutations.
9. Login, registration, and onboarding screens are available in all six languages.
10. GitHub Pages displays honest preview-only screens and performs no fake or failing auth requests.
11. Static export preserves `/novavend` and generates root, status, login, register, and onboarding routes.
12. Existing tests remain green and all new unit, integration, API, static-export, and Playwright tests pass.
13. One branch and one draft PR are used.
14. The PR is not merged before technical review.

## Completion report

When complete, commit and push all changes and report:

- Draft PR link.
- Final commit SHA.
- Complete changed-file list.
- Migration name and schema changes.
- Authentication/session architecture.
- Endpoint list and response behavior.
- Password and cookie security settings.
- Rate-limit and origin-protection behavior.
- Unit, PostgreSQL/Redis integration, API integration, build, static-export, and Playwright results.
- GitHub Actions run link.
- Generated preview routes.
- Expected hosted preview URL.
- Known limitations.

Do not merge the pull request.
