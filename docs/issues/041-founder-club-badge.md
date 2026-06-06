---
title: Founder Club badge and unique table skin – first 100 clubs
labels: backend, frontend, clubs, viral, afk
blocked_by: 014, 006
---

## What to build

Implement Founder Club reward (REQ-FUNC-056):

- Track club creation order (timestamp). First 100 clubs ever created receive:
  - A permanent "Founder Club" badge on club profile.
  - A unique table skin (felt + card back design) available only to these clubs.
- Skin selection: club owner can choose from a special "Founder Collection" (3 exclusive designs) in club settings.
- Skin applies to all tables created under that club.
- Frontend: badge displayed on club page, search results, and tournament listings.
- For clubs created after the first 100, no badge or founder skins.

## Acceptance criteria

- [ ] Club #1–#100: badge visible; club settings show "Founder Skins" tab.
- [ ] Club #101: no badge, founder skins not visible.
- [ ] Table with founder skin shows distinct felt and card backs.
- [ ] Skin persists even if club changes ownership (badge stays with club).

## Blocked by

#014 (club system exists), #006 (frontend club page)
