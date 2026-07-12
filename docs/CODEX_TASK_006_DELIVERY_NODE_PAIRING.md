# CODEX TASK-006 — Secure Delivery Node Pairing and Health

## Role

Act as a senior application-security, backend, frontend, PostgreSQL, Redis, protocol, and LSL engineer. Implement NovaVend's first persistent in-world delivery-node identity without weakening the tenancy, authentication, avatar-linking, localization, or static-preview guarantees established by TASK-002 through TASK-005.

Read these files completely before changing code:

- `docs/PRD.md`
- `docs/ARCHITECTURE.md`
- `docs/DATABASE_SCHEMA.md`
- `docs/INTERNATIONALIZATION.md`
- `docs/ADR/0002-workspace-isolation.md`
- `docs/ADR/0003-opaque-server-sessions.md`
- `docs/ADR/0004-one-time-avatar-pairing.md`
- `docs/CODEX_TASK_004_AUTH_ONBOARDING.md`
- `docs/CODEX_TASK_005_AVATAR_PAIRING.md`
- `packages/secondlife-protocol/src/index.ts`
- `packages/database/src/schema.ts`
- `apps/api/src/workspace-access.service.ts`
- `lsl/novavend-avatar-linker.lsl`

## Objective

Allow an authenticated merchant to pair a merchant-owned Second Life Delivery Node / DropBox to one workspace, issue a persistent device credential exactly once to the in-world script, authenticate later heartbeat requests with HMAC-SHA256, prevent replay, and show trustworthy node health in the dashboard.

This task creates device identity and health only. It does not deliver inventory or implement products, vendors, payments, sales, or delivery jobs.

The server-capable flow must support:

1. An authenticated owner or manager opens `/devices/`.
2. The merchant creates a short-lived delivery-node pairing challenge.
3. The browser receives a one-time pairing token and expiry.
4. The merchant places the clean-room Delivery Node script in an object owned by an avatar actively linked to the workspace.
5. The object owner pastes the pairing token through an owner-only private text box.
6. The public pairing endpoint derives avatar and object identity from simulator headers, atomically consumes the challenge, creates or re-pairs the node, and returns a device credential exactly once to the LSL script.
7. The LSL script persists its credential in protected linkset data and begins signed heartbeats.
8. The API verifies the credential, HMAC signature, object binding, clock skew, and message replay before updating health.
9. The dashboard lists online, stale, offline, disabled, and revoked nodes using derived health status.
10. An authorized merchant may revoke a node, immediately invalidating all of its credentials.

GitHub Pages remains an honest network-free design preview. It must render `/devices/` in all six languages but must not create a real pairing challenge, reveal a usable token, pair a device, issue credentials, or simulate signed traffic.

## Branch and pull request

Work only on the existing branch:

`feature/task-006-delivery-node-pairing`

Do not create another branch. Do not commit directly to `main`.

Open one draft pull request targeting `main`. Continue updating that same pull request. Do not merge it.

## Scope boundaries

### Included

- Workspace-authorized Delivery Node pairing challenges.
- Verification that the simulator owner avatar is actively linked to the target workspace.
- Global object UUID binding and workspace-owned Delivery Node records.
- Persistent per-node credentials returned exactly once to LSL.
- AES-256-GCM encryption of device secrets at rest.
- HMAC-SHA256 authenticated heartbeat requests using LSL `llHMAC`.
- Strict canonical request construction shared between TypeScript and LSL.
- Timestamp and message-ID replay protection.
- Credential revocation and safe re-pairing/rotation.
- Derived node health and dashboard polling.
- Redis abuse throttling and fail-closed behavior.
- Clean-room Delivery Node LSL script.
- `/devices/` frontend in en, tr, de, ru, zh-CN, and ja.
- Migration, repositories, contracts, protocol tests, docs, CI, and static preview.

### Excluded

Do not implement:

- Product or inventory catalog records.
- Inventory-name mapping.
- Vendor pairing.
- Payment ingestion.
- Sales, delivery jobs, acknowledgements, retries, redelivery, or failover routing.
- Customer records, rentals, affiliates, loyalty, coupons, gift cards, or Marketplace integration.
- Automatic credential rotation scheduler.
- Remote script update distribution.
- Managed production hosting.
- Fake device pairing or fake live health in GitHub Pages.

## Security model

### Pairing challenge

Follow the TASK-005 challenge guarantees:

- At least 192 bits from a CSPRNG.
- Exact copy/paste-safe base64url format; document the exact regex and length.
- Default expiry 10 minutes, validated configuration.
- Raw token returned only in the browser create response.
- Persist only SHA-256 of the token.
- Never log, audit, persist, place in a URL, Redis key, metric label, or later status response.
- Single-use, one-way state transitions: pending, claimed, cancelled, expired.
- Atomic claim with row locking.

Use a separate delivery-node challenge table or a clearly typed generalized device-pairing model. Do not overload avatar-pairing rows with incompatible state.

### Owner-avatar requirement

The public pairing claim must:

- Parse `X-SecondLife-Owner-Key` and `X-SecondLife-Object-Key` through the centralized protocol package.
- Require the envelope `deviceId` to equal the simulator object UUID.
- Resolve the challenge workspace from the token hash.
- Require the simulator owner avatar UUID to have an active `workspace_avatar_accounts` link in that workspace.
- Treat owner name, object name, region, and shard as bounded metadata only.
- Never accept avatar UUID, object UUID, or workspace ID from an editable pairing-token field.
- Reject missing, malformed, mismatched, unlinked-owner, cancelled, expired, and consumed claims with stable generic responses.

### Persistent credential

On successful pairing:

- Generate a 256-bit CSPRNG device secret.
- Use base64url without padding and document the exact length/regex.
- Return the raw secret exactly once, only in the in-world pairing response.
- Never return the device secret to the browser dashboard.
- Never log or audit the raw secret or HMAC signature.
- Store the secret only encrypted with AES-256-GCM.
- Store key version, nonce/IV, ciphertext, and authentication tag separately.
- Use a validated environment master key containing exactly 32 decoded bytes.
- No committed production key and no insecure production default.
- Production startup must fail fast when the key is missing, malformed, or weakly configured.
- Decrypt only inside the device-authentication service for signature verification.
- Clear temporary plaintext buffers/references as soon as practical.

Suggested configuration:

- `DEVICE_CREDENTIAL_MASTER_KEY_B64`
- `DEVICE_CREDENTIAL_KEY_VERSION`
- `DELIVERY_NODE_PAIRING_TTL_SECONDS`
- `DELIVERY_NODE_HEARTBEAT_INTERVAL_SECONDS`
- `DELIVERY_NODE_STALE_AFTER_SECONDS`
- `DELIVERY_NODE_OFFLINE_AFTER_SECONDS`
- pairing and heartbeat rate-limit settings

Tests and CI may use an explicit test-only key supplied through environment configuration. `.env.example` contains placeholders only.

### HMAC request authentication

Use standard HMAC-SHA256. Do not invent a custom MAC.

The LSL client must use:

`llHMAC(deviceSecret, canonicalRequest, "sha256")`

The server must use Node's standard `createHmac('sha256', secret)` and compare decoded signatures with `timingSafeEqual`.

Define one canonical UTF-8 request format in `packages/secondlife-protocol`. It must be simple enough to reproduce exactly in LSL and must use fixed field ordering and newline delimiters.

Required canonical fields:

1. Signature scheme/version, e.g. `NV1-HMAC-SHA256`.
2. HTTP method.
3. Exact route path.
4. Protocol version.
5. Device type.
6. Server-issued node ID.
7. Credential ID.
8. Simulator/object UUID (`deviceId`).
9. Message ID.
10. `sentAt` timestamp exactly as transmitted.
11. Canonical payload hash or a fixed-order canonical payload string.

Requirements:

- No locale-dependent formatting.
- No JSON object-key ordering dependency unless a committed canonical JSON function is used by both implementations.
- All signed string fields must be bounded and validated.
- HMAC output encoding must be specified exactly and match `llHMAC` output.
- Commit deterministic shared test vectors containing a non-production example secret, canonical request, and expected signature.
- TypeScript unit tests must validate those vectors.
- The LSL script must contain or document the same vector for manual verification.
- Credential ID and signature may use allowed custom HTTP headers, but sensitive headers must be redacted from Pino logs.

### Replay protection

For signed requests:

- Require a UUID message ID.
- Enforce configured clock skew, default 300 seconds.
- Persist a bounded receipt keyed by credential/device and message ID, or use an equivalently durable replay store.
- Store only safe request fingerprints, never raw credentials or signatures.
- First valid message updates health.
- Exact retry of the same authenticated request may return the same compact acknowledgement without applying a second update.
- Reuse of the same message ID with a different request fingerprint returns a stable conflict.
- Add an explicit expired-receipt cleanup repository method; no scheduler is required in this task.
- A revoked/disabled credential must fail before any health mutation.

### Transport and request bounds

- HTTPS is mandatory in documented real deployments.
- Public Second Life endpoints do not require browser Origin or session cookies.
- Continue using strict JSON and the existing conservative Fastify body limit.
- Use exact protocol schemas and reject unknown fields.
- Apply Redis throttling by hashed IP/network fingerprint, hashed node or credential identifier, and pairing token fingerprint where relevant.
- Never put raw device secrets, signatures, pairing tokens, avatar names, or session values in Redis keys.
- Return integer `Retry-After` on 429.
- Fail closed with controlled 503 when Redis is unavailable.

## Database design

Create a new Drizzle migration after TASK-005.

Use focused tables with explicit workspace ownership. Suggested models follow; equivalent normalized names are acceptable when all invariants are preserved.

### `delivery_node_pairing_challenges`

- UUID primary key.
- `workspace_id` FK.
- `created_by_user_id` FK.
- Unique token hash.
- Status: pending, claimed, cancelled, expired.
- Expiry, claimed, cancelled timestamps.
- Nullable claimed delivery-node ID and claimed message ID.
- Creation/update timestamps.
- Check constraints binding fields to status.
- Workspace/status/expiry and expiry-maintenance indexes.

### `delivery_nodes`

- UUID primary key used as the server-issued node ID.
- `workspace_id` FK, always explicit.
- Unique simulator object UUID with a documented re-pair policy.
- Owner avatar-account FK.
- Paired-by user FK.
- Status: active, disabled, revoked.
- Safe bounded object name.
- Safe bounded script version.
- Strict capabilities JSON or typed columns.
- Configured heartbeat interval.
- Paired, last-seen, last-heartbeat, disabled, revoked timestamps.
- Optional bounded last region/shard metadata only if documented as operational data.
- Creation/update timestamps.
- Indexes for workspace/status, object UUID, and heartbeat maintenance.

A copied object has a different object UUID and must not inherit an authenticated identity. It must pair separately. An object already active in another workspace must not silently move tenants.

### `device_credentials`

- UUID credential ID.
- Delivery-node FK.
- Status: active or revoked.
- Key version.
- AES-GCM nonce, ciphertext, and authentication tag.
- Created, last-used, and revoked timestamps.
- At most one active credential per node, enforced transactionally and with a suitable partial unique index where practical.

Re-pairing the same node in the same workspace must revoke prior credentials and issue a new one atomically. Revoking a node revokes every credential.

### `device_request_receipts`

- Credential/device FK.
- Message ID UUID.
- Safe request hash.
- Compact response/result code if required for exact retry.
- Expiry timestamp.
- Creation timestamp.
- Unique credential/message ID constraint.
- Expiry-maintenance index.

Do not store raw request bodies, signatures, or secrets.

## Repository transactions

### Create challenge

- Browser session and active workspace membership required.
- Owner/manager only.
- Generate token in service; persistence receives only hash.
- Enforce a small configurable pending limit per workspace/user.
- Expire stale pending rows during create/read or through explicit maintenance.
- Append safe audit event.

### Claim node

Atomically:

1. Resolve and lock challenge by token hash.
2. Validate pending and unexpired state.
3. Validate simulator object UUID and owner avatar UUID.
4. Confirm active avatar link to challenge workspace.
5. Create or safely re-pair the workspace Delivery Node.
6. Revoke any prior active credential for a same-workspace re-pair.
7. Generate/encrypt a new device secret.
8. Create active credential.
9. Mark challenge claimed with node and message IDs.
10. Append safe audit records.
11. Commit.

Only after commit may the API return the raw secret to LSL. Any failure rolls back all device, credential, challenge, and audit mutations.

Concurrent claims must yield one durable node/credential outcome. A same-message/same-object retry may return the original safe pairing response only if the raw one-time secret can be recovered securely; otherwise return a deterministic already-paired result that instructs re-pairing without exposing or regenerating credentials accidentally. Document the chosen behavior and test it.

### Signed heartbeat

Atomically after successful HMAC verification:

- Claim/check message receipt.
- Reject conflicting replay.
- Update `last_seen_at`, `last_heartbeat_at`, script version, and safe capabilities.
- Update credential `last_used_at` with write throttling if needed.
- Return compact LSL-friendly acknowledgement.
- Append audit only for security-relevant state changes, not every routine heartbeat.

### Revoke node

- Owner/manager only.
- Workspace-scoped.
- Mark node revoked and revoke all credentials in one transaction.
- Future signed requests return a stable unauthorized/device-revoked response.
- Preserve historical node and audit rows.

## Protocol contracts

Extend `packages/secondlife-protocol` with strict Zod contracts for:

### Pairing claim

Device type must be `delivery_node`.

Payload should include only bounded bootstrap metadata such as:

- pairing token
- script version
- supported protocol/capability identifiers

The device/object UUID comes from the envelope and must match the simulator header.

### Pairing response

Compact JSON containing:

- `ok`
- result code
- node ID
- credential ID
- raw device secret exactly once
- heartbeat interval seconds
- server time

Never include workspace internals or browser-session data.

### Heartbeat request

Strict signed envelope containing:

- protocol version
- device type `delivery_node`
- object/device UUID
- server-issued node ID
- message ID
- `sentAt`
- bounded payload with script version, operational status, free script memory, and typed capability/revision fields

Do not accept arbitrary unbounded metadata.

### Heartbeat response

Compact JSON containing:

- `ok`
- stable result code
- server time
- next heartbeat interval or backoff hint

Do not implement delivery commands in heartbeat responses in this task.

## API endpoints

### Browser endpoints

- `POST /workspaces/:workspaceId/delivery-node-pairings`
- `GET /workspaces/:workspaceId/delivery-node-pairings/:challengeId`
- `DELETE /workspaces/:workspaceId/delivery-node-pairings/:challengeId`
- `GET /workspaces/:workspaceId/delivery-nodes`
- `GET /workspaces/:workspaceId/delivery-nodes/:nodeId`
- `DELETE /workspaces/:workspaceId/delivery-nodes/:nodeId`

Owner/manager may create, cancel, and revoke. All active roles may read. Every endpoint rechecks membership and workspace scope.

### Public in-world endpoints

- `POST /secondlife/v1/delivery-nodes/pair`
- `POST /secondlife/v1/delivery-nodes/heartbeat`

Pairing uses the one-time challenge and simulator headers. Heartbeat uses simulator headers plus HMAC-authenticated device credentials. Neither endpoint uses browser cookies or browser Origin checks.

## Health derivation

Health must be derived from lifecycle status and timestamps rather than requiring a scheduled status-flipping job.

Recommended behavior:

- `online`: active and last heartbeat within the online threshold.
- `stale`: active and beyond online threshold but not beyond offline threshold.
- `offline`: active with no heartbeat or beyond offline threshold.
- `disabled`: explicitly disabled if this lifecycle is implemented.
- `revoked`: revoked and permanently rejected until a new pairing creates/reactivates a node under the documented policy.

Validate configuration so stale/offline thresholds are greater than the heartbeat interval and ordered correctly.

The browser may poll the list/status endpoint at a bounded interval such as 30 seconds. API remains the source of truth.

## LSL Delivery Node

Add an independently authored clean-room script:

`lsl/novavend-delivery-node.lsl`

Requirements:

- Owner-only pairing UI through a private random channel/text box.
- HTTPS API base URL configuration.
- Versioned JSON pairing request using object key as `deviceId`.
- Parse one-time node ID, credential ID, secret, and heartbeat interval.
- Persist credential state using `llLinksetDataWriteProtected` / `llLinksetDataReadProtected`.
- Derive the protected-store passphrase from owner UUID, object UUID, and a NovaVend namespace so owner/object changes make inherited credentials unreadable and force re-pairing.
- On owner change, clear or abandon old credential state and reset safely.
- A copied object with a new object UUID must require pairing again.
- Generate a fresh UUID message ID and timestamp per heartbeat.
- Build the exact canonical request defined by the protocol package.
- Generate HMAC-SHA256 with `llHMAC`.
- Send credential ID and signature through allowed custom headers or the exact documented transport fields.
- Keep combined custom headers well below platform limits.
- Do not say secrets or signatures in public chat.
- Do not include secrets in URLs.
- Never send a heartbeat concurrently with another outstanding heartbeat.
- Use configured interval with small jitter and exponential backoff for 429, 503, platform 420/470, and transport failure.
- Stop and tell the owner to re-pair on revoked/invalid credentials.
- Clear temporary pairing token from script memory immediately after request submission.
- Handle reset, region restart, object copy, owner change, timeout, and HTTP errors.
- Report concise owner-only status.
- No product inventory scanning or object delivery yet.

Document that protected linkset data persists across script reset and object cloning, but credential binding to owner/object UUID prevents a cloned object from authenticating as the original node.

## Frontend

Add static-export-compatible route:

- `/devices/`

Activate the Devices navigation item. Preserve all existing routes and `/novavend` base-path behavior.

### Real server-capable behavior

When preview mode is disabled:

- Use existing session lifecycle and first active workspace selection.
- List Delivery Nodes with selected workspace explicit.
- Show derived health badge, last heartbeat, object name/UUID, owner avatar, script version, and capabilities.
- Create and cancel one pairing challenge.
- Show raw pairing token only from immediate create response.
- Countdown and polling stop on claim, cancellation, expiry, repeated failure, or unmount.
- Never expose the device credential or secret in the browser.
- Allow owner/manager revocation with accessible confirmation.
- Refresh health at a bounded interval.
- Localized safe errors and loading states.
- 320 px layout without horizontal overflow.

### GitHub Pages preview

When `NEXT_PUBLIC_PREVIEW_MODE=true`:

- Render full `/devices/` design in all six languages.
- Clearly label sample data and offline backend state.
- Show representative online/stale/offline visual states as non-live design samples.
- Do not issue session, pairing, polling, revoke, or heartbeat requests beyond existing preview guarantees.
- Do not generate/show a usable pairing token, credential ID, device secret, or signature.
- Do not simulate successful pairing.

Static export must include:

- `/novavend/devices/index.html`

## Logging and audit

Redact at minimum:

- credential ID/signature custom headers when sensitive
- device secret
- encrypted credential material
- pairing token
- cookies and authorization headers

Safe audit events:

- delivery-node pairing created/cancelled/claimed
- node paired/re-paired
- credential issued/revoked
- node revoked
- meaningful security rejection only when safe and rate-limited

Do not write an audit event for every healthy heartbeat.

## Documentation

Add an ADR covering:

- one-time bootstrap pairing
- encrypted device secret storage
- standard HMAC-SHA256 and canonical request design
- object/owner binding
- replay receipts
- derived health
- protected linkset-data trust boundary

Update architecture, database schema, README, internationalization docs, environment examples, and LSL setup instructions.

## Required tests

### Unit

Cover at minimum:

- pairing token format/entropy/hash-only behavior
- 256-bit device-secret generation and format
- AES-256-GCM encrypt/decrypt, wrong-key, tampered-tag, and key-version behavior
- canonical request output
- HMAC-SHA256 deterministic shared vectors matching LSL base64 output
- constant-time signature comparison length mismatch handling
- clock skew
- exact protocol validation and unknown fields
- health derivation boundaries
- configuration validation and production fail-fast behavior
- workspace role permissions
- all six locale dictionaries
- preview mode zero-network behavior
- frontend polling/countdown/revocation states

### PostgreSQL/Redis integration

Cover at minimum:

1. Migration chain applies to empty PostgreSQL 17.
2. Challenge stores token hash only.
3. Pending limit and expiry behavior.
4. Object owner must be an actively linked workspace avatar.
5. Cross-workspace owner/object attempts are rejected.
6. Pairing creates workspace node and encrypted credential atomically.
7. Database never contains raw device secret.
8. AES-GCM fields and active-credential uniqueness are enforced.
9. Concurrent claims yield one durable outcome.
10. Re-pair revokes old credential and issues a new one.
11. Wrong object UUID cannot use a valid credential.
12. Valid HMAC heartbeat updates health.
13. Invalid signature, stale/future time, malformed envelope, and wrong credential fail without mutation.
14. Exact replay is idempotent; conflicting replay is rejected.
15. Revocation invalidates every credential.
16. Health derivation returns online/stale/offline correctly.
17. Redis keys contain no raw token, secret, signature, avatar name, email, or cookie.
18. Redis outage fails pairing/heartbeat throttles closed.
19. `Retry-After` is present on 429.
20. Audit and logs contain no secrets.
21. Cleanup methods remove expired challenges and replay receipts.

### API integration

Boot the real NestJS/Fastify API against PostgreSQL and Redis. Test:

- authenticated create/status/cancel/list/detail/revoke
- exact-origin CORS and DELETE preflight
- public pairing with simulator headers
- unlinked avatar rejection
- secret returned only to LSL pairing response
- signed heartbeat success
- bad signature, replay, clock skew, object mismatch, revoked credential
- strict JSON/body limits and stable errors
- rate limits and Redis failure
- correlation IDs and redaction

### Frontend and Playwright

- `/devices/` renders in six locales.
- Real-mode mocked session/node/pairing flows.
- Browser never receives device secret.
- Preview performs zero device API requests.
- Sample health states are clearly labeled non-live.
- Navigation and locale persistence work.
- Static export and `/novavend` assets are correct.
- 320 px no horizontal overflow.

## Validation commands

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

Static verification must include:

- `/novavend/`
- `/novavend/status/`
- `/novavend/login/`
- `/novavend/register/`
- `/novavend/onboarding/`
- `/novavend/avatars/`
- `/novavend/devices/`

## Completion report

Commit and push to the same branch, then open one draft PR. Do not merge.

Report:

- Draft PR link
- Final commit SHA
- Complete changed-file list
- Migration and schema changes
- Pairing token format, entropy, expiry, and hash-only storage
- Device-secret format and AES-GCM storage design
- Master-key configuration and fail-fast behavior
- Exact canonical request format
- HMAC algorithm/encoding and shared vector result
- Simulator owner/object binding
- Replay and clock-skew behavior
- Re-pair, rotation, disable/revoke behavior
- Health thresholds and derivation
- Redis rate limits/fail-closed behavior
- Browser endpoints and public protocol endpoints
- LSL path, protected storage, setup, heartbeat/backoff behavior
- Unit/integration/API/frontend/Playwright totals
- Actions run URL
- Static preview routes and expected URL
- Known limitations

## Acceptance criteria

TASK-006 is complete only when:

1. Delivery Node challenges are workspace-scoped, one-time, short-lived, and hash-only.
2. Only owner/manager can create/cancel/revoke; active members can read.
3. The simulator owner must be an actively linked workspace avatar.
4. Object UUID is bound and cannot silently cross workspaces.
5. A 256-bit secret is returned exactly once to LSL and never to the browser.
6. Device secrets are encrypted with AES-256-GCM under validated external key configuration.
7. Heartbeats use standard HMAC-SHA256 with deterministic LSL-compatible canonicalization.
8. Signature comparison is constant-time and sensitive headers/log fields are redacted.
9. Clock skew and durable message replay protection are enforced.
10. Re-pairing revokes old credentials atomically.
11. Revoking a node invalidates all credentials immediately.
12. Health is derived correctly without a required scheduler.
13. Redis throttling is private, bounded, and fail-closed.
14. The clean-room LSL script persists credentials safely and handles copy/owner/reset/backoff cases.
15. `/devices/` works in normal mode and is honest/network-free in Pages preview.
16. All six locales, accessibility, static export, and mobile constraints pass.
17. Existing TASK-001 through TASK-005 behavior remains green.
18. All required CI commands pass in GitHub Actions.
19. One draft PR exists and is not merged.
20. Products, vendors, sales, delivery execution, and rentals remain out of scope.