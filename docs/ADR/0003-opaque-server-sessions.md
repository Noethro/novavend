# ADR-0003: Opaque server-side sessions

## Status

Accepted for TASK-004.

## Decision

NovaVend authenticates browser users with an opaque 256-bit random token in the narrow
`novavend_session` cookie. Only its SHA-256 digest is stored in PostgreSQL. The cookie is HttpOnly,
SameSite=Lax, scoped to `/`, finite-lived for seven days by default, and Secure in production.
Expired, revoked, suspended-user, deleted-user, and unknown sessions are rejected. `last_seen_at` is
refreshed no more often than every fifteen minutes. Cleanup is explicit and has no scheduler yet.

Passwords are stored only in `user_password_credentials` using Node's maintained Argon2id API with
64 MiB memory, three passes, parallelism one, a random 16-byte salt, and a 32-byte tag.

## Rationale

Server-side revocation is required for logout and account suspension. Opaque cookies avoid exposing
identity claims to the browser and avoid the long-lived revocation complexity of JWTs. Tokens are
never placed in local or session storage, limiting script access. Exact-origin mutation checks,
credentialed CORS, and SameSite cookies form the browser request boundary.

## Consequences

Authentication requires PostgreSQL and protected mutations require Redis-backed rate limits. If
Redis is unavailable, registration and login fail closed with a controlled 503 response. A managed
backend deployment is required; GitHub Pages shows the forms but disables submission.
