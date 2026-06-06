---
title: Database schema – users, sessions, hand_history, tables
labels: database, backend, afk
blocked_by: 001
---

## What to build

Create the first SeaORM migration that defines the core tables needed for authentication and basic gameplay. Tables:

- `users` (UUID, telegram_id, email, display_name, chip_balance, streak_count, created_at, updated_at)
- `sessions` (token_hash, user_id, expires_at, platform)
- `hand_history` (id, table_id, played_at, players_json, actions_json, result_json, is_archived)
- `tables` (id, created_by, config_json, status, club_id nullable, created_at)

Use SeaORM 2.0 entity generation. Write a separate migration file per table for clarity.

## Acceptance criteria

- [ ] Migrations are additive and reversible (up/down).
- [ ] `sea-orm-cli generate entity` produces correct entity files.
- [ ] Unit test verifies that `users` table can be created and queried in an in‑memory SQLite DB.
- [ ] All JSON fields use `serde_json::Value` and are validated against expected schemas.

## Blocked by

#001 (contracts – types needed for JSON schemas)
