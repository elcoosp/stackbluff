---
title: Authentication module – Telegram initData, JWT, password Argon2id
labels: backend, auth, afk
blocked_by: 001, 002
---

## What to build

Implement `sb-auth` crate implementing `AuthService` from `sb-contracts::service_api`:

- `POST /auth/telegram` – validates `initData` HMAC using bot token, creates/retrieves user, returns JWT.
- `POST /auth/register` (PWA) – email + password, stores Argon2id hash.
- `POST /auth/login` – verifies password, returns JWT.
- JWT: HS256, 30‑day expiry, contains `user_id` and `platform`. Use `jsonwebtoken` ≥10.3.0 (CVE-2026-25537 fixed).
- Argon2id config: iterations=2, memory=65536, parallelism=1.

The module does **not** touch SQLite directly; it sends commands via `UserRepo` trait (injected dependency). This keeps it testable.

## Acceptance criteria

- [ ] Valid Telegram `initData` returns HTTP 200 with JWT; invalid returns 401.
- [ ] Argon2id hash matches stored hash on login.
- [ ] JWT verification middleware (for other crates) rejects expired/malformed tokens.
- [ ] Integration test with mock `UserRepo` passes.

## Blocked by

#001 (contracts – AuthService trait, RequestContext), #002 (schema for users table)
