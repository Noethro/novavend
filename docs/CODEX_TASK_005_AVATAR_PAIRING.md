# CODEX TASK-005 — Secure Second Life Avatar Pairing

## Role

Act as a senior application-security, backend, frontend, database, and LSL engineer. Implement NovaVend's first clean-room Second Life identity connection flow without weakening the tenancy, authentication, localization, or static-preview guarantees from TASK-002 through TASK-004.

Read these files completely before changing code:

- `docs/PRD.md`
- `docs/ARCHITECTURE.md`
- `docs/DATABASE_SCHEMA.md`
- `docs/INTERNATIONALIZATION.md`
- `docs/ADR/0002-workspace-isolation.md`
- `docs/ADR/0003-opaque-server-sessions.md`
- `docs/CODEX_TASK_002_CORE_TENANCY_SCHEMA.md`
- `docs/CODEX_TASK_003_MULTILINGUAL_DASHBOARD.md`
- `docs/CODEX_TASK_004_AUTH_ONBOARDING.md`
- `packages/secondlife-protocol/src/index.ts`
- `packages/database/src/repositories/avatars.ts`

## Objective

Allow an authenticated merchant to securely link a Second Life avatar to one NovaVend workspace through a short-lived, single-use, high-entropy pairing token entered into a clean-room in-world LSL linker script.

The server-capable application must support this flow:

1. An authenticated workspace owner or manager opens the Avatars page.
2. The merchant creates a short-lived pairing challenge for the current workspace.
3. The API returns the raw pairing token exactly once.
4. The merchant pastes the token into the NovaVend Avatar Linker object/script in Second Life.
5. The LSL script submits the token using the versioned NovaVend protocol.
6. The API derives the avatar UUID from the simulator-provided owner header, never from a user-editable form field.
7. The API atomically consumes the challenge, upserts the global avatar identity, and creates or reactivates the workspace-owned avatar link.
8. Browser polling shows the linked avatar without requiring a page reload.
9. An authorized merchant can later revoke the workspace link.

GitHub Pages remains an honest frontend-only preview. It must render the Avatars route and the complete pairing interface in all six languages, but it must not issue API calls, generate a real token, claim an avatar, or simulate successful pairing.

## Branch and pull request

Work only on the existing branch:

`feature/task-005-avatar-pairing`

Do not create another branch. Do not commit directly to `main`.

Open one draft pull request targeting `main`. Continue updating that same pull request. Do not merge it.

## Scope boundaries

### Included

- Workspace-aware authorization for avatar operations.
- Short-lived one-time avatar pairing challenges.
- Hash-only pairing-token persistence.
- Versioned Second Life avatar-pairing protocol contracts.
- A public in-world claim endpoint with strict validation and rate limiting.
- Atomic avatar upsert and workspace-link creation/reactivation.
- Pairing status polling, cancellation, avatar listing, and revocation.
- Safe audit events.
- A clean-room LSL Avatar Linker script and setup documentation.
- A responsive `/avatars/` dashboard route in all six supported languages.
- Honest GitHub Pages preview behavior.
- Database migration, repositories, services, contracts, documentation, and tests.

### Excluded

Do not implement:

- Delivery-node pairing or credentials.
- Vendor pairing.
- Products, inventory, payments, sales, deliveries, redelivery, rentals, affiliates, loyalty, coupons, or gift cards.
- Second Life account passwords or web login through Second Life.
- Bot-based verification.
- OAuth, MFA, email verification, or password recovery.
- General device request signing or long-lived device credentials.
- Managed API/database/Redis hosting.
- Fake pairing success in GitHub Pages.

The one-time avatar pairing token is a bootstrap possession secret, not a reusable device credential. General signed device traffic belongs to a future task.

## Security and threat model

### Pairing token

- Generate at least 128 bits of cryptographically secure randomness.
- Use a copy/paste-safe base64url or unambiguous base32 representation.
- Do not use short numeric-only codes.
- Default expiry: 10 minutes, configurable within a safe validated range.
- Return the raw token only in the create-challenge response.
- Persist only `SHA-256(token)`.
- Never log, audit, return later, or expose the raw token.
- Never place the raw token in a URL, query string, Redis key, metric label, or error message.
- Compare token hashes using constant-time comparison where application comparison occurs.
- A challenge is single-use and cannot return to pending after claim, cancellation, or expiry.

### Second Life identity

- Treat the avatar UUID as the durable identity.
- Obtain the avatar UUID from the simulator-provided `X-SecondLife-Owner-Key` request header through one centralized parser.
- Parse the simulator-provided object UUID from `X-SecondLife-Object-Key` and require it to match the protocol envelope `deviceId`.
- Treat `X-SecondLife-Owner-Name` and object name as optional display metadata only.
- Never accept an avatar UUID from the pairing-token form, browser payload, or editable LSL text box.
- Validate every UUID and reject missing, malformed, or conflicting identity headers.
- Keep exact Second Life header names and parsing rules inside `packages/secondlife-protocol`, not scattered across controllers.

Simulator headers are not a general cryptographic signature. The security of this bootstrap flow depends on the unpredictable one-time token, its short lifetime, single-use consumption, and the merchant entering it into an object owned by the intended avatar. Document this boundary honestly.

### Replay and concurrency

- Claim the challenge in a database transaction with row-level locking or an equivalent concurrency-safe conditional update.
- Two concurrent claims must produce only one durable avatar link.
- Repeating the same successful message for the same avatar may return the same safe success result.
- A consumed token presented by a different avatar must return a stable conflict response without changing the existing link.
- Expired and cancelled challenges must never be claimable.
- Add a unique claimed message identifier or equivalent deterministic replay protection.

### Authorization

Introduce a reusable workspace-access authorization boundary.

- Authentication still resolves the global user through the existing opaque session guard.
- Every browser workspace route must verify an active membership for the route's `workspaceId`.
- Owner and manager may create/cancel pairing challenges and revoke avatar links.
- Owner, manager, support, and viewer may list linked avatars and read pairing status.
- Never trust a workspace ID supplied by the browser without membership authorization.
- Do not expose a generic unscoped workspace repository method.
- Cross-workspace access must return a generic forbidden/not-found-safe response.

The authorization service/guard must be reusable by future product, vendor, and delivery tasks.

## Database design

Create a new committed Drizzle migration after `0001_bizarre_scalphunter.sql`.

Add an enum or constrained status for:

- `pending`
- `claimed`
- `cancelled`
- `expired`

Add a workspace-owned table such as `avatar_pairing_challenges` with:

- UUID primary key.
- `workspace_id` UUID foreign key.
- `created_by_user_id` UUID foreign key.
- Unique `token_hash` text.
- Status.
- `expires_at` timestamptz.
- Nullable `claimed_at` timestamptz.
- Nullable `cancelled_at` timestamptz.
- Nullable `claimed_avatar_account_id` UUID foreign key.
- Nullable `claimed_message_id` UUID.
- `created_at` and `updated_at` timestamptz.

Add indexes for:

- Workspace/status/expiry lookup.
- Expiry maintenance.
- Claimed avatar lookup where useful.
- Unique token hash.

Required invariants:

- A claimed row has claimed timestamp and claimed avatar account.
- A cancelled row has cancelled timestamp.
- Pending rows have no claimed/cancelled fields.
- Expired state may be materialized during reads/claims or through an explicit maintenance method.
- Add an explicit cleanup/expiry repository method, but do not add a scheduler.
- Do not edit already-merged migrations.

Reuse the existing global `avatar_accounts` and tenant-owned `workspace_avatar_accounts` tables. The same global avatar may be linked to multiple workspaces, while each workspace link remains independently revocable.

## Repository transaction requirements

Add focused pairing repository behavior. Do not expose raw table access to controllers.

### Create challenge

- Verify the user has authorized membership before repository invocation.
- Generate the raw token in the service layer and pass only its hash to persistence.
- Limit pending challenges per workspace/user to a small documented number.
- Cancel or reject excessive pending challenges deterministically.
- Append a safe audit event without token material.

### Claim challenge

Atomically:

1. Resolve the token hash.
2. Lock the pending challenge.
3. Verify it is unexpired and unconsumed.
4. Upsert the global avatar account by avatar UUID.
5. Create or reactivate the workspace avatar link using existing invariants.
6. Mark the challenge claimed with avatar account and message ID.
7. Append a safe workspace audit event.
8. Commit all changes together.

Any failure must roll back all claim changes.

### Cancel and revoke

- Cancellation only affects pending challenges in the same workspace.
- Revocation uses the existing workspace-scoped link and must not delete the global avatar identity.
- Revoking a link must append a safe audit event.
- Re-linking a previously revoked avatar should reactivate the existing workspace link.

## Versioned Second Life protocol

Extend `packages/secondlife-protocol` with typed Zod contracts rather than using an untyped payload record in application code.

Add an avatar-pairing claim envelope compatible with the existing protocol version and `DeviceType.AvatarLink`.

Required fields include:

- `version`
- `deviceType: avatar_link`
- `deviceId` matching the simulator object UUID header
- `messageId` UUID
- `sentAt` ISO timestamp
- Payload containing the raw pairing token

Validation requirements:

- Strict object validation; reject unknown fields where practical.
- Enforce a reasonable clock-skew window in addition to challenge expiry.
- Stable protocol error codes.
- No raw token in parsed-error output or logging.
- The public claim endpoint must accept JSON only and use a conservative body-size limit.

Implement a centralized simulator-header parser returning a typed identity object containing:

- Owner/avatar UUID.
- Object UUID.
- Optional owner name.
- Optional object name.
- Optional region/shard metadata only when safely bounded.

Do not store location metadata unless it is explicitly needed. Do not put simulator metadata into audit logs by default.

## API endpoints

Use shared Zod contracts in `packages/contracts` and protocol contracts in `packages/secondlife-protocol`.

### `POST /workspaces/:workspaceId/avatar-pairings`

Authenticated owner/manager only.

Response:

- Challenge ID.
- Raw pairing token exactly once.
- Expiry timestamp.
- Safe status.
- Instructions needed by the UI.

Do not return token hash.

### `GET /workspaces/:workspaceId/avatar-pairings/:challengeId`

Authenticated workspace member.

Return safe status, expiry, and linked avatar summary when claimed. Never return raw token or token hash.

### `DELETE /workspaces/:workspaceId/avatar-pairings/:challengeId`

Authenticated owner/manager only.

Cancel a pending challenge idempotently. Do not alter claimed links.

### `POST /secondlife/v1/avatar-pairings/claim`

Public in-world endpoint; no browser session cookie and no browser Origin requirement.

- Validate simulator headers and protocol envelope.
- Rate limit by hashed client network identifier and hashed token fingerprint.
- Fail closed with a controlled service-unavailable response if Redis is unavailable.
- Claim atomically.
- Return compact LSL-friendly JSON with stable result codes.
- Never echo the raw token.

### `GET /workspaces/:workspaceId/avatars`

Authenticated workspace member.

Return safe linked-avatar summaries only.

### `DELETE /workspaces/:workspaceId/avatars/:avatarAccountId`

Authenticated owner/manager only.

Revoke the workspace link without deleting the global avatar identity.

## Rate limiting

Use Redis with atomic bounded-expiry operations, following TASK-004's hardened rate-limit pattern.

Cover at least:

- Browser challenge creation per user and workspace.
- Public claim attempts per client IP/network fingerprint.
- Public claim attempts per pairing-token hash fingerprint.

Requirements:

- No raw token, avatar name, email, password, cookie, or session value in Redis keys.
- Use stable `429` responses with integer `Retry-After`.
- Avoid permanent account/avatar lockout.
- Public claim throttling must not reveal whether a token exists.

## LSL Avatar Linker

Add a clean-room script under a clear path such as:

`lsl/novavend-avatar-linker.lsl`

The script must:

- Be independently authored and documented.
- Operate only for the object owner.
- Prompt the owner to paste a pairing token through an owner-only private channel or text box.
- Never say the token in public chat.
- Send one versioned JSON request with `llHTTPRequest`.
- Use the object key as `deviceId` and a newly generated message ID for each new claim.
- Handle timeout, success, expired, invalid, rate-limited, and service-unavailable responses.
- Avoid storing the token after completion or script reset.
- Clear temporary listeners and timers.
- Provide concise owner-only status messages.
- Contain no shared production secret, API password, or copied third-party code.

Add documentation explaining how to place the script in an owner-controlled object and configure the API URL for a real deployment.

Because the managed API is not deployed yet, document that the LSL script cannot complete a real production link against GitHub Pages.

## Frontend requirements

### Route

Add a static-export-compatible route:

- `/avatars/`

Preserve:

- `/`
- `/status/`
- `/login/`
- `/register/`
- `/onboarding/`
- `/novavend/` GitHub Pages base-path behavior.

Activate the Avatars navigation item. Other future capabilities remain visibly coming soon.

### Server-capable behavior

When preview mode is disabled and an API is configured:

- Use the existing authenticated session lifecycle.
- Use the user's first active workspace as the current workspace for this MVP; make the selected workspace explicit in the UI.
- Do not treat client workspace selection as authorization; the API always rechecks membership.
- List linked avatars.
- Create a pairing challenge.
- Display the raw token only from the immediate create response.
- Show a visible countdown and expiration state.
- Provide copy-to-clipboard with an accessible fallback.
- Poll pairing status with bounded intervals and stop on claim, cancellation, expiry, unmount, or repeated failure.
- Allow challenge cancellation.
- Show a successful linked-avatar card after claim.
- Allow authorized revocation with explicit confirmation.
- Provide clear, localized, user-safe errors.
- Do not persist the raw pairing token in localStorage, sessionStorage, cookies, URLs, or analytics.

### GitHub Pages preview behavior

When `NEXT_PUBLIC_PREVIEW_MODE=true`:

- Render the full Avatars screen in all six languages.
- Show the pairing steps and representative visual states for design review.
- Clearly label all values as preview/sample data.
- Disable or intercept create, copy-real-token, poll, cancel, and revoke network actions.
- Make zero requests to the unhosted API.
- Never generate or show a value that could be mistaken for a usable pairing token.
- Never simulate a successful account/avatar link.

Static export must generate:

- `/novavend/avatars/index.html`

## Localization and accessibility

Every new user-facing string must exist in:

- English `en`
- Turkish `tr`
- German `de`
- Russian `ru`
- Simplified Chinese `zh-CN`
- Japanese `ja`

English remains the fallback. Dictionary completeness tests stay strict.

Accessibility requirements:

- Keyboard-operable controls.
- Proper labels and status regions.
- Countdown updates must not create excessive screen-reader announcements.
- Dialog/confirmation focus management.
- Mobile layout at 320 px without horizontal overflow.
- Token display must wrap safely on small screens.

## Audit and logging

Append safe audit events for:

- Pairing challenge created.
- Pairing challenge cancelled.
- Avatar linked or reactivated.
- Avatar link revoked.

Never audit or log:

- Raw pairing tokens.
- Token hashes.
- Cookies or session tokens.
- Passwords or credential hashes.
- Raw request bodies for the claim endpoint.
- Full Redis keys.

Preserve correlation/message identifiers where safe.

## Required tests

### Unit tests

Cover at minimum:

- Pairing token entropy/format and hash-only handling.
- Expiry boundaries.
- Second Life header parsing and malformed-header rejection.
- Object UUID/header versus envelope-device mismatch.
- Protocol schema strictness and clock-skew checks.
- Workspace role authorization matrix.
- Rate-limit key privacy and atomic TTL behavior.
- Safe API projections that never expose token hashes.
- Frontend countdown and polling termination.
- Preview mode issuing no pairing requests.
- Dictionary completeness in all six locales.

### PostgreSQL/Redis integration tests

Cover at minimum:

1. Authorized owner creates a pending challenge.
2. Manager may create; support/viewer may not create.
3. Raw token is not stored.
4. Excess pending challenge behavior is deterministic.
5. Valid in-world claim creates/upserts global avatar identity.
6. Claim creates active workspace link.
7. Claim marks challenge consumed atomically.
8. Same-message retry for same avatar is deterministic.
9. Concurrent claims create only one link.
10. Different-avatar reuse of consumed token is rejected.
11. Expired challenge is rejected.
12. Cancelled challenge is rejected.
13. Invalid token returns generic failure.
14. Missing/malformed owner header is rejected.
15. Object header/envelope mismatch is rejected.
16. Cross-workspace challenge read/cancel is impossible.
17. Listing avatars is workspace-scoped.
18. Revocation does not delete global avatar identity.
19. Re-linking a revoked avatar reactivates the existing link.
20. Audit rows contain no token or credential material.
21. Redis claim limits use hashed fingerprints and bounded expiry.
22. Redis failure produces controlled fail-closed behavior.

Keep every existing TASK-001 through TASK-004 test green.

### API integration tests

Boot the real NestJS/Fastify application against PostgreSQL and Redis and verify:

- Workspace authorization on all browser endpoints.
- Create challenge response returns raw token once.
- Status response never returns token/hash.
- Cancellation behavior.
- Valid simulator headers and claim success.
- Invalid/missing/conflicting simulator headers.
- Expired, cancelled, replayed, and cross-avatar claim behavior.
- Avatar list and revoke behavior.
- `429` plus `Retry-After`.
- Stable error contracts and correlation IDs.

### Frontend and Playwright tests

Verify:

- `/avatars/` loads in every locale.
- Existing auth redirects remain correct in real mode tests.
- Preview route performs no API requests.
- Avatars navigation is active and base-path safe.
- Pairing instructions, disabled preview actions, and limitations are visible.
- Language choice persists across `/avatars/` and reload.
- Mobile layout works at 320 px.
- Existing dashboard, status, login, registration, and onboarding flows remain green.

## Documentation

Update:

- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/DATABASE_SCHEMA.md`
- `docs/INTERNATIONALIZATION.md`

Add an ADR for one-time avatar pairing and its trust boundary.

Document:

- Token lifecycle.
- Workspace authorization.
- Simulator-header parsing.
- Replay/concurrency behavior.
- LSL setup.
- Why the pairing token is not a reusable device credential.
- Why real linking requires a hosted API/database/Redis deployment.

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

If local PostgreSQL, Redis, or Chromium is unavailable, attempt the command, report the exact local limitation, and obtain conclusive success from GitHub Actions service containers/installed Chromium before declaring completion.

## Acceptance criteria

TASK-005 is complete only when:

1. A new migration adds the pairing challenge model without modifying merged migrations.
2. Raw pairing tokens are returned once and never persisted.
3. Workspace authorization prevents cross-tenant access.
4. Valid in-world claims atomically create/reactivate avatar links.
5. Replay, expiry, cancellation, and concurrency behavior is deterministic.
6. Simulator identity parsing is centralized and tested.
7. Redis throttling is private, atomic, bounded, and fail closed.
8. The clean-room LSL linker is committed and documented.
9. `/avatars/` works in all six languages and remains mobile accessible.
10. GitHub Pages remains network-free and does not simulate pairing.
11. Static export includes `/novavend/avatars/` with correct assets.
12. All previous tests and all new tests pass in CI.
13. One draft PR targets `main` and remains unmerged for technical review.

## Completion report

When finished, provide:

- Draft PR link.
- Final commit SHA.
- Complete changed-file list.
- Migration name and schema changes.
- Pairing-token entropy, encoding, expiry, and storage behavior.
- Workspace authorization design.
- Simulator-header and protocol design.
- Implemented endpoints.
- Atomic claim/replay behavior.
- Redis rate-limit behavior.
- LSL script path and setup summary.
- Unit, PostgreSQL/Redis integration, API integration, build, static-export, and Playwright totals.
- GitHub Actions run link.
- Generated preview routes.
- Expected hosted preview URL.
- Known limitations.

Do not merge the pull request.