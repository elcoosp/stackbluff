---
title: Club management UI – tournament scheduling and basic settings
labels: frontend, clubs, afk
blocked_by: 006, 029
---

## What to build

Agent 2 builds the club management interface:

- Club page (`/clubs/:id`) with tabs: Leaderboard, Tournaments, Settings.
- Tournament scheduling form: date/time picker, blind structure template dropdown, max players (10–500), buy‑in chips.
- Show upcoming tournaments list with register/unregister buttons.
- Settings (for club owner): edit name, upload logo (to CDN), link Telegram group (set `telegram_group_id` via API).
- For Club Pro subscribers (from #033), additional customisation options (banner, chip preset, felt colour) – placeholders until Wave 4.

## Acceptance criteria

- [ ] Club owner can schedule a tournament in ≤ 2 minutes; tournament appears in list.
- [ ] Members can register and receive confirmations (toast + notification).
- [ ] Linked Telegram group receives result posts (#029).
- [ ] Club leaderboard updates within 5 minutes of any XP change.

## Blocked by

#006 (frontend), #029 (backend club tournament endpoints)
