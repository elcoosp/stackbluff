---
title: Club Pro customisation – banner, chip preset, felt colour
labels: backend, frontend, clubs, payments, afk
blocked_by: 033, 034
---

## What to build

Implement Club Pro customisation features (REQ-FUNC-045, SN-015):

- Backend: Store customisation settings in `clubs.pro_settings` JSON column (banner_url, chip_preset_id, felt_colour).
- Presets: 5 chip designs (classic, neon, gold, marble, wood) stored as CSS classes or image assets.
- Felt colours: 8 presets (green, blue, red, purple, black, orange, teal, grey).
- Frontend: Club Settings page (visible only to Club Pro subscribers) with:
  - Banner image uploader (CDN upload, preview).
  - Chip preset picker (5 options, live preview).
  - Felt colour picker (8 swatches, live preview).
- Changes apply instantly to all club tables (WebSocket broadcast `club.theme_updated`).
- For non‑Pro owners, customisation UI is locked with upgrade CTA.

## Acceptance criteria

- [ ] Club Pro subscriber sees customisation UI; non‑Pro sees upgrade prompt.
- [ ] Changing banner updates club page header within 5 seconds.
- [ ] Changing chip preset updates chip images on all active club tables within 10 seconds.
- [ ] Felt colour change reflects on table background immediately.
- [ ] Non‑Pro club owners cannot save customisations.

## Blocked by

#033 (shop – Club Pro purchase flow), #034 (club management UI scaffold)
