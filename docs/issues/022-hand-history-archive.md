---
title: Hand history archival – move >30 day old hands to R2
labels: backend, storage, afk
blocked_by: 002, 020
---

## What to build

Implement background job (Agent 1) that runs daily at 02:00 UTC:

- Selects hand histories older than 30 days from `hand_history` where `is_archived = false`.
- Serialises each hand to JSON, uploads to Cloudflare R2 bucket with key `hands/{year}/{month}/{hand_id}.json`.
- Marks those hands as `is_archived = true` in SQLite.
- Also provide a retrieval endpoint `GET /hands/{id}` that fetches from R2 if not in hot DB.

## Acceptance criteria

- [ ] After archival job runs, hands >30 days are removed from hot table (or marked) and present in R2.
- [ ] Retrieval endpoint returns hand from R2 within 500ms.
- [ ] No data loss: if R2 upload fails, hand remains unarchived and retry on next run.
- [ ] Unit test: mock R2 upload success and verify marking.

## Blocked by

#002 (hand_history table with is_archived column), #020 (leaderboard – not a direct blocker but depends on DB state)
