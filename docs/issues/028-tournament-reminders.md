## Tournament reminders – 60min and 10min before start

**Title:** Tournament reminders – 60min and 10min before start  
**Labels:** `backend, tournament, notifications, afk`  
**Blocked by:** #023 (tournament creation), #021 (notification routing)

---

### 📌 Summary

When a tournament (Sit&Go or MTT) is created with a **scheduled start time** (i.e., an absolute `DateTime<Utc>` in the future), the system must automatically schedule two reminder notifications:

- **60 minutes before start** – a general reminder that the tournament is approaching.
- **10 minutes before start** – a final reminder with a deep link to the tournament lobby.

Reminders are sent via `NotificationService` to all currently registered participants. For club tournaments (i.e., those associated with a `ClubId`), the reminder should also be posted in the linked Telegram group (using `sb-bot-handler`).

All scheduled jobs must be **persisted** – on server restart, they must be re‑scheduled from the database.

---

### 🧩 Context (where to find things)

| Component | File(s) |
|-----------|---------|
| Tournament configuration | `backend/crates/sb-contracts/src/tournament_api.rs` (`TournamentConfig`) |
| Tournament repository | `backend/crates/sb-contracts/src/tournament_api.rs` (`TournamentRepo`) + `sb-db-repos/src/tournament_repo.rs` |
| Tournament service (creation) | `backend/crates/sb-tournament/src/tournament_service.rs` (`TournamentServiceImpl::create_tournament`) |
| Tournament actors (S&G, MTT) | `backend/crates/sb-tournament/src/sit_go_tournament.rs`, `mtt_director.rs` |
| Notification service trait | `backend/crates/sb-contracts/src/notification_api.rs` (`NotificationService`) |
| Bot handler (Telegram) | `backend/crates/sb-bot-handler/` (can be invoked via `BotState` or a separate service) |
| Database entities | `backend/crates/sb-db-entities/src/tournament.rs` (needs `scheduled_start` column) |
| Main server wiring | `backend/crates/sb-server/src/main.rs` – where services are instantiated |

---

### 🔧 What to build

#### 1. Add `scheduled_start` to tournament configuration and database

- Extend `TournamentConfig` (in `sb-contracts/src/tournament_api.rs`) with:
  ```rust
  pub scheduled_start: Option<DateTime<Utc>>,
  ```
  This must be optional to support existing tournaments that start immediately (like current S&Gs).

- Extend the `tournaments` table (entity `sb_db_entities/src/tournament.rs`) with a `scheduled_start` column (`DateTimeUtc`, nullable).  
  Create a new migration (e.g., `m20260628_add_scheduled_start_to_tournaments.rs`) that adds this column.

- Update the repository methods (`insert_tournament`, etc.) to read/write this field.

#### 2. Schedule reminders in `TournamentServiceImpl::create_tournament`

- When a tournament is created with `config.scheduled_start.is_some()` and the start time is in the future, spawn two background tasks using `tokio::spawn`:

  ```rust
  let start = config.scheduled_start.unwrap();
  let tournament_id = id;
  let repo = self.repo.clone();
  let notification_service = self.notification_service.clone(); // inject NotificationService into TournamentServiceImpl
  let bot_handler = self.bot_handler.clone(); // optional, for club tournaments
  // ... also need club_id if present

  tokio::spawn(async move {
      // 60-minute reminder
      let reminder_60 = start - chrono::Duration::minutes(60);
      if reminder_60 > Utc::now() {
          tokio::time::sleep_until(reminder_60.into()).await;
          send_reminder(tournament_id, "60 minutes", repo, notification_service, bot_handler).await;
      }
      // 10-minute reminder
      let reminder_10 = start - chrono::Duration::minutes(10);
      if reminder_10 > Utc::now() {
          tokio::time::sleep_until(reminder_10.into()).await;
          send_reminder(tournament_id, "10 minutes", repo, notification_service, bot_handler).await;
      }
  });
  ```

- The `send_reminder` function:
  - Fetches current registrations via `repo.list_registrations(tournament_id)`.
  - For each registered user, call `notification_service.send` with a `NotificationEvent::TournamentReminder { tournament_name, start_time, deep_link }`.
  - If the tournament is a club tournament (has a `club_id`), also send a message to the club’s Telegram group (requires `BotHandler` or a separate service). This can be done via `bot_handler.send_telegram_message(chat_id, text)` – you'll need to store the group’s chat ID somewhere (perhaps in the club entity or as an extra field in the tournament).

#### 3. Reschedule reminders on server restart

- In `main.rs`, after loading existing tournaments (see `load_existing_tournaments` function), iterate over tournaments whose `status == "Registering"` and `scheduled_start` is in the future, and re‑spawn the reminder tasks using the same logic as in step 2.

- Since the tasks are not persisted, we must re‑schedule them from the database on every startup. This ensures reminders are not lost after a restart.

#### 4. Handle unregistration

- If a player unregisters before a reminder is sent, the reminder job should fetch the **current** registrations at the time of sending. Therefore, the list is always up‑to‑date – no need to cancel individual jobs.

#### 5. Error handling

- If sending a notification fails (e.g., user’s platform unavailable), log a warning and continue.
- If the tournament is cancelled before the reminder, the job should check the tournament status before sending; if status is `Cancelled` or `Completed`, skip sending.

---

### ✅ Acceptance Criteria

- [ ] A tournament scheduled for 14:00 UTC (with `scheduled_start`) causes two notifications to be sent to all registered users at 13:00 and 13:50 UTC.
- [ ] Each reminder includes the tournament name, start time, and a deep link to the tournament lobby (e.g., `https://app.stackbluff.com/tournaments/<id>`).
- [ ] If a user unregisters before a reminder, they do not receive it (the job checks current registrations).
- [ ] For club tournaments, the reminder is also posted to the club’s linked Telegram group (if the club has a `telegram_chat_id`).
- [ ] After a server restart, all upcoming scheduled tournaments have their reminder tasks re‑created automatically.
- [ ] No duplicate reminders are sent (each task runs exactly once).
- [ ] If the tournament is cancelled before the reminder, no reminder is sent (status check).
- [ ] Logs show successful scheduling and sending, and warnings for any failures.

---

### 🔗 Blocked By

- **#023** – Tournament creation must be functional (including storing config and status).
- **#021** – Notification routing must be able to deliver messages to users (and optionally to Telegram groups).

---

### 🧪 Testing Notes

- Use `tokio::time::pause()` and `advance` to simulate time passing without actually waiting.
- Mock `NotificationService` to verify calls.
- Write integration tests that:
  - Create a scheduled tournament,
  - Advance time to the reminder points,
  - Assert that notifications are sent to the correct users.
- Also test restart scenario: create a tournament, stop the server, restart, and verify reminders are still sent.

---

### 📝 Implementation Notes

- Inject `Arc<dyn NotificationService>` and an optional `Arc<BotState>` into `TournamentServiceImpl`. Update `main.rs` to pass these dependencies.
- The deep link can be built using an environment variable `APP_BASE_URL` + `/tournaments/<id>`.
- The reminder tasks are fire‑and‑forget; they run in the background and do not block the main flow.
- To store the `club_id` in the tournament, you may need to extend `TournamentConfig` and the database accordingly (if not already present). The issue does not explicitly require a club association, but the description mentions "club tournaments". You can assume that `TournamentConfig` already has a `club_id: Option<ClubId>` field (if not, add it as part of this ticket).
