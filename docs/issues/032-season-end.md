---
title: Season end – card generation and soft rank reset
labels: backend, seasons, viral, afk
blocked_by: 002, 015
---

## What to build

Implement season end processing (REQ-FUNC-071, REQ-FUNC-073):

- Seasons table: `id, name, starts_at, ends_at`.
- At season end (every 8 weeks), run a background job that:
  - Computes final rank for each player (based on rank points).
  - Generates a shareable Season End Card (PNG via HTML/CSS rendering, or SVG template) for each player with: final rank, best hand, total chips won, number of hands played.
  - Stores card URL in `user_season_card` table.
  - Performs soft rank reset: Legend → Maestro, Maestro → Diamond, Diamond → Platinum, etc. (minimum reset is Gold to Silver).
- Frontend displays a notification “Your Season X card is ready!” with share button.

## Acceptance criteria

- [ ] Job runs exactly at season end timestamp; all players receive a card within 24 hours.
- [ ] Card contains correct data; share button invokes PlatformAPI.shareContent().
- [ ] New season starts with reset ranks; leaderboard resets for new season.

## Blocked by

#002 (seasons, player_ranks tables), #015 (replay card generation infrastructure)
