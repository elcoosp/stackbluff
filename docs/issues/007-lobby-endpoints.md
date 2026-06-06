---
title: Lobby REST endpoints – list tables and create table
labels: backend, api, afk
blocked_by: 002, 003, 005
---

## What to build

Implement `sb-rest-router` crate with Axum routes that use injected `TableService` (from `sb-contracts`):

- `GET /lobby` – returns JSON: `[{ table_id, stake_level, current_players, max_players, status }]`.
- `POST /tables` – creates a new cash game table (body: `stake_level`, `max_players`), returns `{ table_id }`.
- Both endpoints require JWT authentication (middleware from `sb-auth`).
- Data is read from SQLite via `TableRepo` (for persistent tables) and `TableRegistry` (for active tables).
- Error responses: `{ "error": { "code": "...", "message": "..." } }` – never expose stack traces.

## Acceptance criteria

- [ ] Unauthenticated requests return 401.
- [ ] `GET /lobby` returns a list of tables from both DB and in‑memory registry.
- [ ] `POST /tables` inserts a row into `tables` table and registers a new table actor via `TableRegistry`.
- [ ] Integration test: create table → list → see the new table.

## Blocked by

#002 (tables table exists), #003 (game engine – needed for table config validation), #005 (registry stub)
