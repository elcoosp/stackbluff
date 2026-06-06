---
title: Timer and time bank – server‑side enforcement inside table actor
labels: backend, game-engine, afk
blocked_by: 001, 009
---

## What to build

Enhance `sb-table-registry/src/actor.rs` with full timer and time bank (REQ-FUNC-015, 016):

- 30‑second main timer starts when `action.required` is sent.
- If timer expires and player has time bank (>0), consume 1 second from bank, reset main timer.
- If time bank reaches zero, auto‑fold.
- Broadcast timer updates: `action.required` includes `remaining_ms` (server‑side authoritative).
- Time bank persists across hands within a session (stored in actor state, not persisted to DB yet).
- Add `time_bank_remaining_seconds` to `PlayerState` struct.

## Acceptance criteria

- [ ] Player with 30s bank folds after 30s + 30s (main + bank) total idle time.
- [ ] Time bank decrements correctly on each main timer expiry.
- [ ] After using 15s bank, remaining 15s available next hand.
- [ ] Unit test: time bank exact expiry calculations using `tokio::time::advance`.

## Blocked by

#001 (shared types – ActionType includes timer fields), #009 (table actor loop exists)
