---
title: Kick inactive player vote – majority vote removal
labels: backend, game-engine, afk
blocked_by: 009
---

## What to build

Implement kick vote for cash game tables (REQ-FUNC-020):

- Any active player can start a vote against an inactive (sitting out) player via `action.kick_vote { target_player_id }`.
- A vote remains open for 10 seconds. Majority of remaining active players must vote `yes` (≥2 players).
- If majority reached, target player is removed from the table; their chips are returned to balance.
- All players receive `table.player_removed` message.
- A player cannot be voted on more than once per 5 minutes.

## Acceptance criteria

- [ ] Table with 4 active players, 1 inactive: vote starts, 2 yes votes within 10s → inactive player kicked.
- [ ] Vote fails if not enough yes votes within 10s.
- [ ] Kicked player can rejoin table (unless re‑voted immediately – cooldown enforced).
- [ ] Integration test: vote passes, player removed, stack unchanged.

## Blocked by

#009 (table actor with player list)
