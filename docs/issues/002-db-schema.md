---
title: Database schema (SQLite) and SeaORM entity generation
labels: database, backend, afk
blocked_by: 001
---

## What to build

Create the initial SQLite schema using SeaORM migrations (in `backend/migration/`). Tables:

- `users` (id UUID PK, telegram_id BIGINT UNIQUE, email TEXT UNIQUE, display_name TEXT, chip_balance BIGINT NOT NULL DEFAULT 0, streak_count INT DEFAULT 0, created_at TIMESTAMP, updated_at TIMESTAMP, platform TEXT, email_verified_at TIMESTAMP NULL)
- `sessions` (token_hash TEXT PK, user_id UUID FK, expires_at TIMESTAMP, platform TEXT)
- `hand_history` (id UUID PK, table_id UUID, played_at TIMESTAMP, players_json TEXT, actions_json TEXT, result_json TEXT, is_archived BOOLEAN DEFAULT FALSE)
- `tables` (id UUID PK, created_by UUID FK, config_json TEXT, status TEXT, club_id UUID NULL, created_at TIMESTAMP)
- `clubs` (id UUID PK, owner_id UUID FK, name TEXT, logo_url TEXT, telegram_group_id BIGINT NULL, pro_settings_json TEXT NULL, created_at TIMESTAMP)
- `club_memberships` (user_id UUID, club_id UUID, joined_at TIMESTAMP, weekly_xp INT DEFAULT 0, PRIMARY KEY (user_id, club_id))

Run `sea-orm-cli generate entity` to produce entity files in a new crate `sb-db-entities`.

## Acceptance criteria

- [ ] Migrations are additive and reversible (up/down tested).
- [ ] All JSON fields use `serde_json::Value`.
- [ ] Foreign key constraints enforced (SQLite with foreign_keys = ON).
- [ ] `chip_balance` has a `CHECK (chip_balance >= 0)` constraint.
- [ ] Entity generation produces compilable Rust code.

## Blocked by

#001 (shared types – uses same ID types)
