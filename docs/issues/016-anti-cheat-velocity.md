---
title: Anti-cheat – chip velocity and collusion flags
labels: backend, anti-cheat, afk
blocked_by: 001, 002
---

## What to build

Implement anti‑cheat module (Agent 5) with:

- Track net chip transfers between any pair of accounts per rolling 24h window.
- If net transfer > 5000 chips in same direction, block further transfers and log flag.
- Rate limiting per action: max 10 game actions/second per user; per‑IP auth endpoint limit 100 req/min.
- Detection of same‑IP heads‑up sessions ≥5 in 24h → flag for review (no auto‑ban).

All logic behind `AntiCheatApi` trait.

## Acceptance criteria

- [ ] Two accounts: A → B 6000 chips total in 4 hours; 5th transfer blocked.
- [ ] Log entry written to `anti_cheat_events` table with user_ids, IP, timestamps.
- [ ] Rate limit: 11th action within 1 second receives HTTP 429.
- [ ] No performance impact: per‑transfer check < 1ms.

## Blocked by

#001 (contracts – AntiCheatApi), #002 (anti_cheat_events table exists)
