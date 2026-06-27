## Telegram bot – post game result summary to originating group

**Title:** Telegram bot – post game result summary to originating group  
**Labels:** `backend, telegram, bot, afk`  
**Blocked by:** #001 (NotificationService), #013 (bot webhook exists)

---

### 📌 Summary

When a poker game session started via `/poker` in a Telegram group ends (i.e., the table closes or all players leave), the bot should post a **game result summary** back to the originating group. The summary must include:

- Winner’s display name (mention via `@username` if available).
- Winning hand description (human‑readable, e.g., “Two Pair – Aces and Kings”).
- Chip amount won.
- An **invite link** with a `?ref=<inviter_user_id>` parameter for referral attribution (the inviter is the player who ran `/poker`).

The result post must appear **within 5 seconds** of the session ending.

---

### 🧩 Context (where to find things)

| Component | File(s) |
|-----------|---------|
| Telegram bot handler (commands) | `backend/crates/sb-bot-handler/src/commands.rs` (handles `/poker`, `/challenge`) |
| Bot state | `backend/crates/sb-bot-handler/src/types.rs` (BotState holds `notification_service`, `table_service`, `user_resolution`) |
| Notification service trait | `backend/crates/sb-contracts/src/notification_api.rs` (`NotificationService`) |
| Table registry events | `backend/crates/sb-table-registry/src/events.rs` (`HandCompletedEvent`) – currently only hand‑level events; **need to introduce a `TableClosedEvent` or `SessionClosedEvent`** |
| Table actor | `backend/crates/sb-table-registry/src/actor.rs` – TableActor runs the game; it shuts down when empty. |
| Rest router / app wiring | `backend/crates/sb-server/src/main.rs` – where the bot state is built and attached. |

---

### 🔧 What to build

#### 1. Add a `TableClosedEvent` (or reuse `RoomMessage`)

- In `sb-table-registry/src/events.rs`, define a new event:
  ```rust
  pub struct TableClosedEvent {
      pub table_id: TableId,
      pub room_id: TableId,
      pub started_by: UserId,        // the user who created the table (/poker invoker)
      pub winner: Option<UserId>,
      pub winning_hand_description: String,
      pub pot_amount: ChipAmount,
      // maybe list of participants, etc.
  }
  ```
- Emit this event in `TableActor` when the last player leaves and the room is being shut down (inside the `clear_board_and_start_next` or `handle_command(Shutdown)`).
- Use the existing `event_tx` broadcast channel (same as for `HandCompletedEvent`) – just add a new variant or a separate channel.

#### 2. Capture session metadata

- When `/poker` is invoked, store in the table actor (or registry) who started the game. You can add a field `created_by: UserId` to the `TableActor` or store it in the `GameRoom` metadata.
- Also store the `chat_id` of the Telegram group where the game was started (so the bot knows where to send the result). This can be attached to the table via `table_service.create_table` input – extend `CreateTableInput` with an optional `telegram_chat_id` field.

#### 3. Spawn a listener for `TableClosedEvent`

- In `main.rs`, after creating the `BotState`, spawn a background task that subscribes to the table registry’s event bus and listens for `TableClosedEvent`.
- For each event:
  - Extract the `started_by` user (the inviter) and the `chat_id` (must have been stored).
  - Build the summary text: “@Alice won 12,000 chips with Two Pair – Aces and Kings”.
  - Generate an invite link: `<mini_app_url>?ref=<started_by_user_id>` (the mini app URL is already in `BotState`).
  - Use the `NotificationService` (which has a `send_telegram_message` method) to post the summary to the chat.
  - Ensure this happens within a few seconds (the event is already emitted synchronously, so the delay is minimal).

#### 4. Update `NotificationService` (if needed)

- The current `NotificationService` trait (in `sb-contracts/src/notification_api.rs`) already has `send_telegram_message(chat_id, text, keyboard)`. This is sufficient; no changes required.

#### 5. Error handling

- If `send_telegram_message` fails (e.g., chat deleted or bot removed), log a warning and **do not crash** the server. Use `tracing::warn!` and continue.

---

### ✅ Acceptance Criteria

- [ ] After a game started via `/poker` ends (all players leave), the bot posts a message in the same Telegram group within 5 seconds.
- [ ] The message includes:
  - Winner’s display name (with `@` mention if available).
  - Human‑readable hand description (e.g., “Two Pair – Aces and Kings”).
  - Pot size (in chips).
  - An invite link with `?ref=<inviter_user_id>` (the inviter is the user who issued `/poker`).
- [ ] If the game had no winner (e.g., all folded? but poker always has a winner), still post a summary indicating the game ended.
- [ ] If the group is deleted or the bot is removed, the failure is logged as a warning and the server continues running (no panic).
- [ ] E2E test: Simulate a 3‑hand session, leave, and verify the bot message appears with correct content.

---

### 🔗 Blocked By

- **#001** – `NotificationService` must be wired and functional (it already exists, but need to ensure `send_telegram_message` works end‑to‑end).
- **#013** – The bot webhook must be properly set up and receiving updates (already exists; `sb-bot-handler` is attached in `main.rs`).

---

### 🧪 Testing Notes

- Use `wiremock` or a mock Telegram API to test the notification sending without hitting the real Telegram servers.
- Unit test the event listener logic in isolation (mock the notification service).
- For integration, you can run a local bot with a test token and verify the message appears in a test group (manual, but can be part of the QA process).

---

### 📝 Implementation Hints

- The `TableActor` currently does not store the `created_by` or `chat_id`. Extend its `new` method to accept these parameters when the table is created (via `registry.create_table` or `table_service.create_cash_table`). You may need to propagate these fields through the `Registry` and `TableServiceImpl`.
- The `TableClosedEvent` should be emitted in the `shutdown` path (e.g., when `handle_command(Shutdown)` is called and the actor is about to exit).
- The event listener can be spawned in `main.rs` after the `BotState` is built and the registry is created.
