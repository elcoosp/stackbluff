---
title: Lobby REST endpoints – list tables and create table
labels: backend, api, afk
blocked_by: 002, 003, 005
---

## What to build

Implement REST routes in `rest_router` (Agent 1) that use the `TableApi` contract:

- `GET /lobby` – returns list of active tables (id, stake level, current players, status).
- `POST /tables` – creates a new cash game table (body: stake_level, max_players) and returns table_id.
- Both endpoints require JWT authentication (middleware from #004).
- Data is read from the `tables` SQLite table and the in‑memory `TableRegistry`.

## Acceptance criteria

- [ ] Unauthenticated requests return 401.
- [ ] `GET /lobby` returns JSON array with at least `id`, `stake`, `player_count`, `status`.
- [ ] `POST /tables` inserts a row into the `tables` table and registers the table actor in `TableRegistry`.
- [ ] Integration test: create table → list tables → see the new table.

## Blocked by

#002 (tables table exists), #003 (game engine – needed for stub table actor later), #005 (registry stub)
