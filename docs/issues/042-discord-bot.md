## Discord bot integration – tournament results and club leaderboard posts

**Title:** Discord bot integration – tournament results and club leaderboard posts  
**Labels:** `backend, discord, bot, afk`  
**Blocked by:** #001 (NotificationService extension), #021 (notification routing), #029 (club tournament results)

---

### 📌 Summary

Implement a **Discord bot** as an extension of the `NotificationService` (TBD-002). This allows club owners to link a Discord channel to their club, enabling automated posts:

- **Tournament result summaries** (top 3 placements, winning hand, prize distribution) automatically after a club tournament ends.
- **Daily leaderboard snapshot** (top 10 members by weekly XP) posted at 09:00 UTC.
- **Optional notifications** (streak alerts, referral milestones) configurable per club via `club_pro_settings`.

The bot uses Discord webhooks or the bot token for message delivery. Club owners manage the link via slash commands (`/discord link`, `/discord unlink`, `/discord settings`) using Discord's interaction framework.

---

### 🧩 Context (where to find things)

| Component | File(s) |
|-----------|---------|
| Notification service trait | `backend/crates/sb-contracts/src/notification_api.rs` (`NotificationService`) |
| Existing bot handler (Telegram) | `backend/crates/sb-bot-handler/` – serves as a pattern for integrating a new bot. |
| Club settings | `backend/crates/sb-db-entities/src/clubs.rs` (add `discord_channel_id`, `discord_webhook_url`) |
| Club service / repo | `backend/crates/sb-club/src/service.rs`, `sb-db-repos/src/club_repo.rs` |
| Tournament events | `backend/crates/sb-tournament/src/mtt_director.rs`, `sit_go_tournament.rs` – need to emit events. |
| Scheduled jobs | `backend/crates/sb-server/src/main.rs` – can use `tokio-cron-scheduler`. |

---

### 🔧 What to build

#### 1. Database changes

- Add to `clubs` table:
  - `discord_channel_id` (TEXT, nullable) – the channel ID where posts are sent.
  - `discord_webhook_url` (TEXT, nullable) – optional webhook URL (if using webhooks instead of bot token).
- Add to `club_pro_settings` (or a new `discord_settings` table) for per‑club preferences:
  - `post_tournament_results` (BOOLEAN, default true)
  - `post_daily_leaderboard` (BOOLEAN, default true)
  - `post_streak_alerts` (BOOLEAN, default false)
  - `post_referral_milestones` (BOOLEAN, default false)
- Create migration `m20260630_add_discord_integration.rs`.

#### 2. DiscordNotifier – implement NotificationService

- Create new crate `sb-discord-bot` or extend `sb-bot-handler`.
- Implement a struct `DiscordNotifier` that holds a `reqwest::Client`, a bot token (from env `DISCORD_BOT_TOKEN`), and optionally a webhook sender.
- Implement `NotificationService`:
  - `send_telegram_message` – no‑op for Discord (or forward to a generic channel, but keep separate).
  - `send_telegram_message_to_user` – no‑op.
  - `answer_callback_query` – no‑op.
  - Add new method(s) specific to Discord: `send_discord_message(channel_id: &str, content: &str, embed: Option<Embed>)`.
- The `DiscordNotifier` will be used by the event listeners (tournament completion, leaderboard cron job).

#### 3. Discord bot – slash commands

- Use `serenity` (or `twilight`) to create a Discord bot that listens for interactions.
- Register slash commands globally or per guild:
  - `/discord link #channel` – stores the channel ID and/or webhook URL in the club settings. Only accessible by the club owner (verified via OAuth or by matching Discord user ID with the club owner’s Discord ID – we need to store Discord user IDs in the `users` table as well; assume we have a `discord_user_id` column).
  - `/discord unlink` – removes the channel/webhook association.
  - `/discord settings` – opens a modal or select menu to toggle the optional notification types.
- All commands should respond with **ephemeral messages** (visible only to the user) confirming the action.

#### 4. Event listeners

- **Tournament result**: In the tournament actors (`MttDirector`, `SitGoTournament`), after `end_tournament`, emit an event `TournamentCompletedEvent` (or reuse the existing `TournamentResult` message). The Discord notifier listens to these events and:
  - Retrieves the club ID from the tournament config.
  - If the club has a Discord channel/webhook configured and `post_tournament_results` is true, send an embed with:
    - Title: `🏆 Tournament "{name}" completed!`
    - Fields: 1st, 2nd, 3rd place with player names and prizes.
    - Winning hand description.
- **Daily leaderboard**: Schedule a cron job (using `tokio-cron-scheduler`) that runs at 09:00 UTC. For each club with a Discord link and `post_daily_leaderboard` true, fetch the top 10 members (from `club_leaderboard`), format as a leaderboard, and post to Discord.

#### 5. Authentication & linking

- To link a Discord channel, the bot needs to verify that the command invoker is the club owner. This requires storing the user’s Discord ID in the `users` table (add `discord_user_id`). When a user logs in via OAuth2 (future), we'll store that. For MVP, we can use a simple command that requires the user to provide a verification code (or link via web app). But for simplicity, we can assume the club owner’s Discord ID is stored and matched.
- The bot must know which guild (server) the command was invoked in. The channel ID is sufficient; the bot can send messages to that channel without needing guild info.

---

### ✅ Acceptance Criteria

- [ ] **Backend:**
  - [ ] `discord_channel_id` and `discord_webhook_url` are stored per club.
  - [ ] A Discord bot (using `serenity` or `twilight`) is implemented and runs alongside the server.
  - [ ] Slash commands `/discord link`, `/discord unlink`, `/discord settings` are registered and respond with ephemeral messages.
  - [ ] `/discord link #channel` saves the channel ID to the club (only if the invoker is the club owner).
  - [ ] When a club tournament ends, a Discord message with an embed (top 3, winning hand) is sent to the linked channel within 30 seconds.
  - [ ] A daily cron job at 09:00 UTC posts the top 10 leaderboard members to all linked clubs.
  - [ ] The optional notification settings (toggle for tournament results, daily leaderboard, streaks, referrals) are stored and respected.

- [ ] **Integration:**
  - [ ] The Discord bot connects to Discord and responds to interactions.
  - [ ] Messages are sent using either webhook or bot token (configurable).
  - [ ] All sensitive data (tokens) are loaded from environment variables.

---

### 🔗 Blocked By

- **#001** – `NotificationService` trait must exist and be extensible.
- **#021** – Notification routing must be able to dispatch to multiple providers.
- **#029** – Club tournament results must be available (i.e., tournaments can complete and produce results).

---

### 🧪 Testing Notes

- **Unit tests** for the Discord notifier (mock `reqwest` to verify payloads).
- **Integration tests** with a test Discord bot (using a test server) – manual or via a mock Discord API.
- **Cron job testing**: Use `tokio::time::pause()` to simulate time and verify the job runs.
- **Command testing**: Test the slash command logic without actually connecting to Discord (mock the interaction handler).

---

### 📝 Implementation Hints

- **Bot framework**: Use `serenity` for simplicity – it has built‑in support for slash commands and ephemeral responses.
- **Webhook vs token**: Prefer webhooks for posting (they are simpler and don't require a bot token for sending). But for commands, we need a bot. We can implement both: the bot handles commands, and we use the stored webhook URL for posting (or fall back to bot token if no webhook).
- **Storing Discord IDs**: Add `discord_user_id` to `users` table. This will be populated when the user links their Discord account via OAuth2 (future). For now, we can allow linking by having the user provide their Discord ID manually (or via a verification code).
- **Cron scheduling**: Use `tokio-cron-scheduler` (already in `sb-server` dependencies) – add a job that runs at 09:00 UTC.
- **Event bus**: Use the existing broadcast channel (`event_tx` from `sb-table-registry`) to publish `TournamentCompletedEvent`. The Discord notifier subscribes to this channel and reacts.
- **Optional settings**: Store them in `club_pro_settings` (or a dedicated `discord_settings` JSON column).
