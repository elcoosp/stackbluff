---
title: Club Pro customisation – banner, chip preset, felt colour
labels: backend, frontend, clubs, payments, afk
blocked_by: 033, 034
---

## What to build

Implement Club Pro customisation features (REQ-FUNC-045, SN-015):

- **Backend** (`sb-club` + `sb-payment`):
  - Store customisation settings in `clubs.pro_settings` JSON column: `{ banner_url, chip_preset_id, felt_color }`.
  - Presets: 5 chip designs defined in frontend config, stored by ID.
  - Felt colours: 8 presets (CSS colour codes).
  - `PATCH /clubs/{id}/settings` endpoint requires Club Pro active (check subscription status).
  - When settings change, broadcast `club.theme_updated` via WebSocket to all users currently at a club table.

- **Frontend** (Agent 2):
  - Club Settings page (only visible to Club Pro subscribers) with:
    - Banner image uploader (upload to CDN, preview).
    - Chip preset picker (5 options, live preview in a mini chip).
    - Felt colour picker (8 swatches, live preview on a mock table).
  - For non‑Pro owners, customisation UI is locked with upgrade CTA linking to shop.

## Acceptance criteria

- [ ] Club Pro subscriber sees customisation UI; non‑Pro sees upgrade prompt.
- [ ] Changing banner updates club page header within 5 seconds (reload not required).
- [ ] Changing chip preset updates chip images on all active club tables within 10 seconds (via WebSocket broadcast).
- [ ] Felt colour change reflects on table background immediately.
- [ ] Non‑Pro club owners cannot save customisations (API returns 403).

## Blocked by

#033 (shop – Club Pro purchase flow), #034 (club management UI scaffold)
