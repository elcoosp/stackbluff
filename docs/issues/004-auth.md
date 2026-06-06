---
title: Authentication – Telegram initData validation and JWT issuance
labels: backend, auth, afk
blocked_by: 001, 002
---

## What to build

Implement the `auth_module` (Agent 1) as a set of functions behind `AuthApi` trait:

- `POST /auth/telegram` – accepts `initData`, validates HMAC using bot token, creates/retrieves user, returns JWT.
- `POST /auth/register` (PWA) – email + password, stores Argon2id hash.
- `POST /auth/login` – verifies password, returns JWT.
- JWT uses `jsonwebtoken` crate (≥10.3.0) with 30‑day expiry, HS256, and contains `user_id` and `platform`.
- Argon2id config: iterations=2, memory=65536, parallelism=1.

## Acceptance criteria

- [ ] Valid Telegram `initData` returns HTTP 200 with JWT; invalid returns 401.
- [ ] Argon2id hash matches stored hash on login.
- [ ] JWT verification middleware rejects expired/malformed tokens.
- [ ] Integration test: register → login → access protected endpoint.

## Blocked by

#001 (contract trait), #002 (users table exists)
