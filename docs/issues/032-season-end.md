---
title: Season end – card generation and soft rank reset
labels: backend, seasons, viral, afk
blocked_by: 002, 015
---

## What to build

Implement season end processing (REQ-FUNC-071, REQ-FUNC-073):

- **Database:** `seasons` table (id, name, starts_at, ends_at), `player_ranks` (user_id, season_id, rank_tier, rank_points).
- **Backend job** (Agent 1, in `sb-server`):
  - At season end (every 8 weeks), compute final rank for each player (based on rank points accumulated).
  - Generate a shareable Season End Card: use a templated HTML/CSS rendered via `headless_chrome` or `image` crate (PNG). For MVP, produce a JSON structure that frontend can render as a card.
  - Store card URL in `user_season_cards` table.
  - Perform soft rank reset: Legend → Maestro, Maestro → Diamond, Diamond → Platinum, etc. (minimum reset is Gold to Silver).
- **Frontend:** Show a notification “Your Season X card is ready!” with share button using `PlatformAPI.shareContent`.

## Acceptance criteria

- [ ] Job runs exactly at season end timestamp; all players receive a card within 24 hours.
- [ ] Card contains correct data (final rank, best hand, total chips won, hands played).
- [ ] New season starts with reset ranks; leaderboard resets for new season.
- [ ] Share button works on both PWA and Mini App.

## Blocked by

#002 (seasons, player_ranks tables), #015 (replay card generation infrastructure)
