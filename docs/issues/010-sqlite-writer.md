---
title: SQLite writer loop – SAVEPOINT batch writing with surgical isolation
labels: backend, database, afk
blocked_by: 002
---

## What to build

Implement `sb-db-repos` crate with the **SAVEPOINT writer loop** as specified in the 10/10 architecture:

- A single `mpsc::channel<DbCommand>` that all modules use to send write operations.
- One dedicated Tokio task (`writer_loop`) that owns the SQLite connection and processes commands in batches (up to 50).
- **Within a single transaction**, for each command:
  - Create a `SAVEPOINT sp_{index}`.
  - Execute the command (SQL via SeaORM or `sqlx`).
  - If constraint violation (e.g., UNIQUE, CHECK), rollback to savepoint, map error to `PersistenceError::ConstraintViolation`.
  - If other error, rollback to savepoint, map to `PersistenceError::Transient`.
  - On success, release savepoint.
- If any command fails, others in the batch still commit (isolated via savepoints).
- If final `commit()` fails, treat ALL as `PersistenceError::Transient` (retryable).
- Include `RequestContext` in every `DbCommand` for tracing.
- Provide `UserRepo`, `HandHistoryRepo`, etc. implementations that send commands and wait for a `oneshot` response.

**Critical:** Error mapping happens exactly where the SQL executes, not in the repo trait.

## Acceptance criteria

- [ ] Batch of 10 commands, one constraint violation – others commit, only the violating command returns error.
- [ ] 500 writes/second sustained for 1 minute without `SQLITE_BUSY` errors.
- [ ] Each command has a tracing span that drops immediately after execution (no nesting).
- [ ] Unit test: transient error during commit causes all commands to receive `Transient`.

## Blocked by

#002 (schema exists – to implement commands)
