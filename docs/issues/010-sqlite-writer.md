---
title: SQLite write serialisation channel and hand history saving
labels: backend, database, afk
blocked_by: 002
---

## What to build

Implement the single‑writer pattern for SQLite (Agent 1):

- A global `tokio::sync::mpsc::channel<DbCommand>` that all modules use to send write operations.
- One dedicated Tokio task that owns the SQLite connection and processes commands sequentially.
- Initial commands: `InsertHandHistory`, `UpdateChipBalance`, `InsertSession`.
- On hand completion, the table actor sends an `InsertHandHistory` command. Confirm it is written to the `hand_history` table.

## Acceptance criteria

- [ ] 100 concurrent writes from different modules are serialised and do not cause SQLITE_BUSY errors.
- [ ] Hand history is stored within 100ms of hand completion.
- [ ] If the write task panics, the server logs an error and restarts the task (hand history may be lost – acceptable for early version).
- [ ] Benchmark: 500 writes/second sustained for 1 minute.

## Blocked by

#002 (hand_history table exists)
