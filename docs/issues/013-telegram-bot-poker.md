---
title: Telegram bot – /poker command and group table creation
labels: backend, telegram, bot, afk
blocked_by: 001, 004, 007
---

## What to build

Implement the Telegram bot handler (Agent 3):

- Webhook endpoint `POST /telegram/webhook` that processes bot commands.
- Command `/poker` in a group: creates a new table via `TableApi::create_table`, generates an inline keyboard “Join Table”, sends a message to the group.
- When a user clicks “Join Table”, the bot replies with a deep link to the Mini App that includes `table_id`.
- Also implement `@stackbluffbot challenge @friend` (1v1 challenge) – creates a heads‑up table and mentions both players.

## Acceptance criteria

- [ ] `/poker` in a group creates a table and bot responds within 3 seconds.
- [ ] Clicking “Join Table” opens Mini App with correct `table_id` parameter.
- [ ] Challenge command creates a private table and notifies both players.
- [ ] All bot interactions use the shared `NotificationApi` contract.

## Blocked by

#001 (contracts – TableApi, NotificationApi), #004 (auth – user resolution), #007 (table creation endpoint exists)
