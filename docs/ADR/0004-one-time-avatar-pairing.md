# ADR-0004: One-time Second Life avatar pairing

## Status

Accepted for TASK-005.

## Decision

NovaVend links a Second Life avatar through a 192-bit base64url bootstrap token that expires after
ten minutes by default and is consumed once. The browser receives the raw token only in the create
response. PostgreSQL stores only its SHA-256 digest. The claim transaction locks the challenge,
upserts the global avatar UUID, creates or reactivates the workspace-owned link, records replay data,
and appends a token-free audit event.

The public claim endpoint derives owner and object UUIDs exclusively from bounded simulator headers.
The protocol object UUID must match the header. Simulator headers are not a general signature; trust
comes from token entropy, short lifetime, single-use consumption, and the merchant placing the token
inside an object owned by the intended avatar.

## Consequences

Owner and manager roles manage challenges and links; every active workspace member may read status
and linked avatars. All access remains repository-scoped by workspace. Claim rate limits use hashed
network and token fingerprints and fail closed when Redis is unavailable. This bootstrap token is
not a reusable device credential and does not establish request signing for later device traffic.
