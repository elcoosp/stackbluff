---
title: Anti-cheat – chip velocity and collusion flags
labels: backend, anti-cheat, afk
blocked_by: 001, 002
---

## What to build

Implement `sb-anti-cheat` crate (Agent 5) behind `AntiCheatService` trait:

- Track net chip transfers between any pair of accounts per rolling 24h window (in‑memory cache with TTL, backed by SQLite if needed).
- If net transfer > 5000 chips in same direction, reject further transfers and log flag to `anti_cheat_events` table.
- Rate limiting per action: max 10 game actions/second per user; per‑IP auth endpoint limit 100 req/min (implemented as middleware in `sb-rest-router`).
- Detection of same‑IP heads‑up sessions ≥5 in 24h → flag for review (no auto‑ban). Requires IP address from `RequestContext`.
- Provide `fn check_transfer(from: UserId, to: UserId, amount: ChipAmount) -> Result<(), AntiCheatError>`.

## Acceptance criteria

- [ ] Two accounts: A → B 6000 chips total in 4 hours; 5th transfer blocked.
- [ ] Log entry written to `anti_cheat_events` table with user_ids, IP, timestamps.
- [ ] Rate limit: 11th action within 1 second receives HTTP 429.
- [ ] Per‑transfer check < 1ms (cached in memory).

## Blocked by

#001 (contracts – AntiCheatService), #002 (anti_cheat_events table exists)
