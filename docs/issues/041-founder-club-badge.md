---
title: Founder Club badge and unique table skin – first 100 clubs
labels: backend, frontend, clubs, viral, afk
blocked_by: 014, 006
---

## What to build

Implement Founder Club reward (REQ-FUNC-056):

- **Backend** (`sb-club`):
  - Track club creation order (using auto‑increment `created_at` with precise timestamp).
  - First 100 clubs ever created receive:
    - A permanent 'founder_club' badge (store in `club_badges` table).
    - A unique table skin available only to these clubs: store `founder_skin_id` in `clubs` (NULL if not founder).
  - Skin selection: club owner can choose from a special "Founder Collection" (3 exclusive designs) in club settings.
  - Skin applies to all tables created under that club (default skin override).
- **Frontend**:
  - Badge displayed on club page, search results, and tournament listings.
  - Founder club skin picker shows exclusive options (locked for non‑founder clubs).
  - Table rendering uses the selected founder skin.

## Acceptance criteria

- [ ] Club #1–#100: badge visible; club settings show "Founder Skins" tab.
- [ ] Club #101: no badge, founder skins not visible.
- [ ] Table with founder skin shows distinct felt and card backs (different from default).
- [ ] Skin persists even if club changes ownership (badge stays with club).

## Blocked by

#014 (club system exists), #006 (frontend club page)
