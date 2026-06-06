---
title: Auto‑generated highlight clips – epic hand videos
labels: backend, viral, afk
blocked_by: 015, 044
---

## What to build

Implement automatic highlight clip generation (SN-017) – Agent 4:

- **Trigger events** (same as replay card triggers): Royal Flush, 4‑of‑a‑kind, bad beat (losing with full house or better), all‑in with >100BB, tournament final table elimination.
- **Clip generation**:
  - Use a headless browser (Puppeteer) or a service like `remotion` to render a short video (5‑10 seconds) from an HTML/CSS template (reuse replay card design).
  - Alternatively, generate a GIF/MP4 via server‑side canvas (e.g., `image` crate + FFmpeg).
  - For MVP, generate a high‑quality MP4 (H.264, 720p, < 2MB) and upload to Cloudflare R2.
- **Delivery**:
  - Streamer/user receives a notification (via `NotificationService`) with a shareable link.
  - Store clip URL in `hand_history` (clip_url column) and in `user_highlights` table.
- **Frontend**: User can view past highlights on profile ("My Highlights" gallery).

## Acceptance criteria

- [ ] Royal Flush triggers clip generation within 30 seconds (background job).
- [ ] Clip is watchable (H.264, 720p, < 2MB) and includes hole cards and board evolution.
- [ ] Streamer receives Telegram/Web Push with shareable link.
- [ ] User can view past highlights on profile page (paginated).

## Blocked by

#015 (replay card infrastructure), #044 (OBS overlay – for video composition)
