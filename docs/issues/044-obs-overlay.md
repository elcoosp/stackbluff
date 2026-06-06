---
title: OBS Studio stream overlay – browser source for streamers
labels: frontend, streamer, afk
blocked_by: 018
---

## What to build

Implement OBS overlay for streamers (SN-018) – Agent 2:

- New endpoint `GET /overlay/{table_id}` returns a minimal HTML/CSS/JS page (no React, vanilla) showing:
  - Table layout (seats, stacks, community cards).
  - Player names (obfuscated if requested via query param `?obfuscate=true`).
  - Hole cards of the streamer only (if authenticated via streamer token).
  - Current pot, action indicator, timer.
  - Optional chat box (if community chat implemented in #045) – can be separate endpoint.
- Overlay updates via WebSocket (same stream as game, filtered for public view).
- Streamer generates a unique overlay token via `POST /profile/overlay-token` (returns token). Embed token in URL: `/overlay/{table_id}?token=...`.
- CSS customisation: background opacity, hide player names, etc. via URL parameters (`?bgOpacity=0.5`).

## Acceptance criteria

- [ ] Streamer copies overlay URL to OBS browser source → live table appears.
- [ ] Overlay updates in real‑time (< 1s delay).
- [ ] Streamer token grants hole card visibility only for their own hand (others' hole cards hidden).
- [ ] Non‑authenticated overlay shows no hole cards (spectator mode).

## Blocked by

#018 (frontend table view – reuse components)
