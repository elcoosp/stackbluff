---
title: Sit & Go tournament – auto-start on full seats (6 or 9 players)
labels: backend, tournament, afk
blocked_by: 001, 009
---

## What to build

Implement Sit & Go tournament support in `sb-tournament` crate (Agent 1):

- `POST /tournaments/sit-and-go` with `max_players` (6 or 9) and `buy_in` (ChipAmount).
- System creates a dedicated table actor with tournament rules: players eliminated when stack = 0.
- When the last seat is filled, tournament automatically starts within 5 seconds.
- Prize pool = buy_in * players (no rake at launch). Payout structure: 1st 50%, 2nd 30%, 3rd 20% for 9‑player; 1st 65%, 2nd 35% for 6‑player.
- Eliminated players receive a `tournament.elimination` WebSocket message and can spectate.
- Tournament table uses the same WebSocket protocol as cash games, plus `tournament.result` at end.
- Store results in `tournament_results` table.

## Acceptance criteria

- [ ] Creating a 6‑player S&G deducts buy_in from each player; when 6th player joins, game starts.
- [ ] Blind levels increase every 10 minutes (configurable in `TableConfig`).
- [ ] Winner receives correct prize pool distribution.
- [ ] Integration test: 6 players register, tournament completes, payouts correct.

## Blocked by

#001 (contracts – TournamentService), #009 (table actor loop exists)
