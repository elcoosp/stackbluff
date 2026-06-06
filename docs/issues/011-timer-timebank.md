---
title: Timer and time bank – server‑side enforcement
labels: backend, game-engine, afk
blocked_by: 001, 009
---

## What to build

Implement the full decision timer and time bank system (REQ-FUNC-015, 016) inside the table actor:

- 30‑second main timer starts when action is required.
- If timer expires and player has time bank (>0), consume 1 second from bank and reset main timer.
- If time bank reaches zero, auto‑fold.
- Broadcast timer updates to all players (`action.required` includes `remaining_ms`).
- Time bank persists across hands within a session.

## Acceptance criteria

- [ ] Player with 30s bank folds after 30s + 30s (main + bank) total idle time.
- [ ] Time bank decrements correctly on each main timer expiry.
- [ ] After using 15s bank, remaining 15s available next hand.
- [ ] Unit test: time bank exact expiry calculations.

## Blocked by

#001 (contracts – ActionType), #009 (table actor loop exists)
