## Club tournament scheduling and automatic result posting

**Title:** Club tournament scheduling and automatic result posting  
**Labels:** `backend, clubs, tournament, afk`  
**Blocked by:** #014 (club system), #024 (MTT logic), #027 (bot posting)

---

### 📌 Summary

Extend the club system to allow **club‑specific tournament scheduling and management**. Club owners (or members with appropriate permissions) can schedule tournaments that are restricted to club members. After the tournament ends, a result summary is automatically posted to the club’s linked Telegram group (if configured). The tournament uses the MTT logic (from #024) but enforces a `club_id` filter during registration. XP earned from tournament play is integrated with the club leaderboard (#014).

---

### 🧩 Context (where to find things)

| Component | File(s) |
|-----------|---------|
| Club service & repo | `backend/crates/sb-club/src/service.rs`, `sb-db-repos/src/club_repo.rs` |
| Tournament service | `backend/crates/sb-tournament/src/tournament_service.rs` |
| MTT director | `backend/crates/sb-tournament/src/mtt_director.rs` |
| Club entities (club, memberships) | `backend/crates/sb-db-entities/src/club.rs`, `club_memberships.rs` |
| Tournament entities | `backend/crates/sb-db-entities/src/tournament.rs`, `tournament_registration.rs` |
| Notification service | `backend/crates/sb-contracts/src/notification_api.rs` |
| Bot handler | `backend/crates/sb-bot-handler/` |
| REST routes | `backend/crates/sb-rest-router/src/tournament_routes.rs`, `sb-club/src/handlers.rs` |

---

### 🔧 What to build

#### 1. Extend `TournamentConfig` with club and scheduling fields

In `sb-contracts/src/tournament_api.rs`:

```rust
pub struct TournamentConfig {
    // existing fields...
    pub club_id: Option<ClubId>,
    pub scheduled_start: Option<DateTime<Utc>>,
    pub blind_schedule_id: Option<Uuid>,      // reference to a blind template (optional, or embed full schedule)
}
```

- `club_id` makes the tournament club‑only (registration restricted to club members).
- `scheduled_start` allows future scheduling (used by #028 for reminders).
- `blind_schedule_id` could point to a reusable blind template (if we implement a blind template table; or we can embed the schedule directly – for simplicity, embed full schedule).

The database table `tournaments` already has `config_json` (JSON), so no schema change needed if we just include these fields in the JSON.

#### 2. API: `POST /clubs/{id}/tournaments`

Add a new endpoint in `sb-club` (or `sb-rest-router`):

- Path: `/clubs/{club_id}/tournaments`
- Method: POST
- Authentication: required (must be a club member, preferably the owner or admin – check permissions via club repo).
- Request body: `{ "name": "Weekly MTT", "max_players": 20, "buy_in": 500, "scheduled_start": "2026-07-01T18:00:00Z", "blind_schedule": { ... }, "payout_structure": { ... } }`
- Response: `{ "tournament_id": "..." }`
- Implementation:
  1. Validate that the user is a member of the club (and optionally has permission to create tournaments – club owner by default).
  2. Build a `TournamentConfig` with `club_id = club_id`.
  3. Call `TournamentService::create_tournament` with the config.
  4. The tournament will be stored in the DB with `club_id` embedded in the config.
  5. If `scheduled_start` is provided, the reminder tasks (#028) will automatically be triggered.

#### 3. Registration check: club membership

Modify the registration logic in `TournamentService` (or in the actor) to enforce club membership:

- In `register` (and `register_player_txn`), after retrieving the tournament config, check if `config.club_id.is_some()`.
- If yes, verify that the user is a member of that club (via `ClubRepo::is_member`).
- If not, return `AppError::PermissionDenied` or a custom `ClubError`.

#### 4. Tournament run using MTT logic

- The tournament will be started using the existing MTT actor (`MttDirector`). The actor is already generic; it does not need to know about clubs. The only change is the registration check (step 3).
- The actor will handle blind progression, rebalancing, etc., as per #024.

#### 5. Result posting to Telegram group

After the tournament ends (via `MttDirector::end_tournament`), we need to post a result summary to the club’s linked Telegram group (if the club has a `telegram_group_id` or `telegram_chat_id` stored).

- Extend the `Club` entity (in `sb-db-entities/src/club.rs`) with a `telegram_chat_id` field (nullable, `i64`). Add a migration for this column.
- In `end_tournament`, after computing results:
  - Fetch the club’s `telegram_chat_id` (via `ClubRepo::find_club_by_id`).
  - If present, build a summary message (top 3 placements, winning hand summary, invite link to the next tournament).
  - Use `NotificationService::send_telegram_message(chat_id, text, None)` (or `BotState` directly) to post the message. This should happen within 10 seconds of the final hand.

#### 6. XP integration with club leaderboard

- During tournament play, each hand (or each elimination) should award XP to the participants. The existing `stats_aggregator` does not handle XP.
- In the `HandCompletedEvent` processing (or after each hand), we can add XP based on the number of hands played and/or performance.
- For simplicity, we can award a fixed amount of XP per hand played (e.g., 5 XP per hand) and bonus XP for winning (e.g., 50 XP). The exact formula can be configurable.
- Use `ClubService::add_xp` (from #014) to update the member’s weekly XP for the club.

We can integrate this in the `stats_aggregator` or create a separate listener for `HandCompletedEvent` that adds XP if the table is a tournament table and the tournament has a `club_id`.

---

### ✅ Acceptance Criteria

- [ ] A club owner can schedule a tournament via `POST /clubs/{id}/tournaments` with all required fields.
- [ ] The tournament appears in `GET /clubs/{id}/tournaments` (list of scheduled/active/completed tournaments for that club).
- [ ] Only club members can register for the tournament; non‑members receive a `403 Forbidden` or `Conflict` error.
- [ ] The tournament runs using MTT logic, with proper blind progression and rebalancing.
- [ ] When the tournament ends, a result summary is posted to the club’s Telegram group (if `telegram_chat_id` is set) within 10 seconds.
- [ ] The post includes:
  - Top 3 placements (with usernames or display names).
  - Winning hand summary (e.g., “Alice won with a flush”).
  - An invite link to the next scheduled tournament (or a general club link).
- [ ] XP is awarded to participants (per hand played) and updated in the club leaderboard.
- [ ] The tournament completion updates the club’s leaderboard (via existing `refresh_leaderboard` scheduled task or immediate).

---

### 🔗 Blocked By

- **#014** – Club system (membership, leaderboard, XP) must be functional.
- **#024** – MTT logic must be complete and stable.
- **#027** – Telegram bot posting must be able to send messages to arbitrary chat IDs (this is essentially the notification service + bot handler).

---

### 🧪 Testing Notes

- Integration tests using a test database and mocked notification service to verify:
  - Club tournament creation.
  - Registration restriction.
  - XP accumulation.
  - Result posting.
- For the result posting, use a mock `NotificationService` and assert that `send_telegram_message` is called with the correct chat ID and message content.
- For XP integration, verify that `ClubService::add_xp` is called with the correct amount.

---

### 📝 Implementation Hints

- The `TournamentServiceImpl` currently does not have a dependency on `ClubRepo` or `ClubService`. Inject `Arc<dyn ClubRepo>` and `Arc<dyn ClubService>` so that registration checks and XP updates can be performed.
- The MTT director `end_tournament` method can be extended to call a callback or send an event that triggers the result posting. Alternatively, the event listener for `HandCompletedEvent` can detect the end of the tournament (maybe by listening for a `TournamentCompletedEvent`). A cleaner approach: emit a `TournamentCompletedEvent` from the MTT director and have a separate handler that deals with club results.
- The `telegram_chat_id` should be part of the `Club` model; add it via a migration. Ensure it is nullable.
- The invite link can be generated using `APP_BASE_URL` environment variable + `/clubs/<club_id>` or a specific tournament page.
