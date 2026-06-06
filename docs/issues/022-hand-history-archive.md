---
title: Hand history archival – move >30 day old hands to R2
labels: backend, storage, afk
blocked_by: 002, 020
---

## What to build

Implement archival background job (Agent 1) inside `sb-server`:

- Runs daily at 02:00 UTC using `tokio_cron_scheduler` or similar.
- Selects hand histories older than 30 days from `hand_history` where `is_archived = false`.
- Serialises each hand to JSON (including players_json, actions_json, result_json).
- Uploads to Cloudflare R2 bucket: key = `hands/{year}/{month}/{hand_id}.json`.
- After successful upload, mark `is_archived = true` in SQLite.
- Provide a retrieval endpoint `GET /hands/{id}`:
  - First check hot table (is_archived = false). If found, return.
  - If archived, fetch from R2 and return JSON.
- Use `aws-sdk-rust` for R2 (S3‑compatible).

## Acceptance criteria

- [ ] After archival job runs, hands >30 days have `is_archived = true` and are present in R2.
- [ ] Retrieval endpoint returns archived hand from R2 within 500ms (with caching).
- [ ] No data loss: if R2 upload fails, hand remains unarchived and retry on next run.
- [ ] Unit test with mock R2 client: upload success marks archived; upload failure does not.

## Blocked by

#002 (hand_history table with is_archived column), #020 (leaderboard – but not a direct blocker)
