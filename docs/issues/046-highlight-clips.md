---
title: Auto‑generated highlight clips – epic hand videos
labels: backend, viral, afk
blocked_by: 015, 044
---

## What to build

Implement automatic highlight clip generation (SN-017):

- Trigger events: Royal Flush, 4‑of‑a‑kind, bad beat (losing with full house or better), all‑in with >100BB, tournament final table elimination.
- Generate a short video clip (5‑10 seconds) using server‑side rendering (Puppeteer + FFmpeg) or a third‑party service.
- Clip shows: hole cards, board development, final result, player reaction (if available).
- Upload clip to Cloudflare R2 with public URL.
- Streamer receives a notification with clip URL and can share to social media.
- Also store in user's "My Highlights" gallery.

## Acceptance criteria

- [ ] Royal Flush triggers clip generation within 30 seconds.
- [ ] Clip is watchable (H.264, 720p, < 2MB).
- [ ] Streamer receives Telegram/Web Push with shareable link.
- [ ] User can view past highlights on profile.

## Blocked by

#015 (replay card infrastructure), #044 (OBS overlay – for video composition)
