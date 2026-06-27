## Season end – card generation and soft rank reset

**Title:** Season end – card generation and soft rank reset  
**Labels:** `backend, seasons, viral, afk`  
**Blocked by:** #002 (seasons, player_ranks tables), #015 (replay card generation infrastructure)

---

### 📌 Summary

At the end of each season (every 8 weeks), the system must:

1. **Compute final rank** for each player based on rank points accumulated during the season (already stored in `player_ranks`).
2. **Generate a shareable Season End Card** for each player, containing:
   - Final rank tier (e.g., “Legend”, “Diamond”).
   - Best hand achieved (from user statistics).
   - Total chips won during the season.
   - Hands played during the season.
3. **Perform a soft rank reset** for the new season:
   - Legend → Maestro
   - Maestro → Diamond
   - Diamond → Platinum
   - Platinum → Gold
   - Gold → Silver
   - Silver → Silver (no drop below Silver)
   - Bronze → Bronze
   - Brick → Brick
4. **Notify users** (via in‑app notification or push) that their card is ready, with a share button.

The card must be shareable via the platform’s sharing mechanism (`PlatformAPI.shareContent` from #006), and the image should be generated server‑side and stored in R2 (or served as a dynamic image).

---

### 🧩 Context (where to find things)

| Component | File(s) |
|-----------|---------|
| Season entity | `backend/crates/sb-db-entities/src/season.rs` |
| Player rank entity | `backend/crates/sb-db-entities/src/player_rank.rs` |
| Rank tier enum | `backend/crates/sb-db-entities/src/enums.rs` (RankTier) |
| User statistics | `backend/crates/sb-db-entities/src/user_statistics.rs` |
| Background scheduling | `sb-server/src/main.rs` (uses `tokio-cron-scheduler` for leaderboard refresh; can add similar) |
| R2 storage | `sb-server/src/hand_archive.rs` (RealR2, put_object) – can be reused for card images. |
| Player stats repo | `sb-db-repos/src/player_stats_repo.rs` – can fetch hands played, chips won. |
| Notification service | `sb-contracts/src/notification_api.rs` – to notify users. |
| Frontend sharing | `frontend/src/platform/PlatformAPI.ts` (from #006) – shareContent. |

---

### 🔧 What to build

#### 1. Database changes

- Add a new table `user_season_cards`:
  ```sql
  CREATE TABLE user_season_cards (
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      season_id INTEGER NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
      card_image_url TEXT,                -- URL to the generated image (R2)
      card_data JSONB,                    -- structured data for rendering (if not using image)
      generated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, season_id)
  );
  ```
  - Add migration `m20260628_create_user_season_cards.rs` and register it.

#### 2. Background job at season end

- In `sb-server/src/main.rs`, schedule a one‑time job (or recurring, checking for season end) using `tokio-cron-scheduler` or a simpler `tokio::time` sleep until the season’s `ends_at`.
- The job should:
  1. Query all `seasons` where `ends_at > NOW()` (the next season that has just ended) – or use a flag to avoid double processing.
  2. For each such season:
     - Compute final rank for each user from `player_ranks` for that season (already stored; nothing to compute, just retrieve).
     - For each user with a rank, generate a card (see step 3).
     - Store the card URL in `user_season_cards`.
     - Apply the soft rank reset for the **new season** (see step 4).
     - Mark the season as processed (add a `processed` boolean column to `seasons` to avoid reruns).

#### 3. Card generation

- Use `sb-server/src/hand_archive.rs` as a template for generating and uploading an image to R2.
- Create a new module `season_card.rs` with a function `generate_season_card(user_id, season_id)`:
  - Fetch user’s final rank tier, total chips won, hands played (from `user_statistics`), and best hand (e.g., from hand history or stats).
  - Generate a PNG image using a templating approach:
    - Option A: Use a headless browser (e.g., via `headless_chrome` crate) to render an HTML template.
    - Option B: Use the `image` crate to draw the card directly (simpler but less flexible).
    - For MVP, we can generate a JSON structure and let the frontend render the card from the JSON (no image generation). But the acceptance criteria mention a shareable card, and sharing an image is more effective. However, we can start with JSON and later add image generation. The issue says “shareable Season End Card” – likely an image. We’ll implement image generation using a lightweight HTML-to-image approach or a simple canvas drawing.
  - Upload the image to R2 (bucket `season-cards` or similar) using `RealR2::put_object`, with a key like `seasons/{season_id}/user_{user_id}.png`.
  - Return the public URL.

- Store the URL in `user_season_cards`.

#### 4. Soft rank reset

- For the **next season** (the one following the ended season), we need to assign initial ranks to all players who participated in the ended season.
- The reset logic (drop one tier, floor at Silver):
  ```rust
  fn reset_rank(current_tier: RankTier) -> RankTier {
      use RankTier::*;
      match current_tier {
          Legend => Maestro,
          Maestro => Diamond,
          Diamond => Platinum,
          Platinum => Gold,
          Gold => Silver,
          Silver | Bronze | Brick => current_tier, // stay same
      }
  }
  ```
- Insert a new row in `player_ranks` for the new season with the reset tier and `rank_points = 0` (or keep some percentage? For soft reset, maybe keep some points or start fresh). We'll start fresh with 0 points for simplicity.
- Also, reset the global leaderboard materialised view (leaderboard refresh job will handle it, but we can trigger it manually after reset).

#### 5. Notification

- After generating the card, send an in‑app notification (or push notification) to the user: “Your Season X card is ready! Check it out.”
- The notification should include a deep link to the card (e.g., `/profile/season-card`).
- Use the existing `NotificationService` to send the event (e.g., `NotificationEvent::SeasonCardReady { season_id, card_url }`).

#### 6. Frontend integration

- Add a new page or modal to display the user’s season card (using the image URL from the backend).
- Show a notification badge on the lobby or profile when a new card is available.
- Implement a **Share** button that calls `PlatformAPI.shareContent` with the card image URL and a caption (e.g., “I finished Season X as a Legend! Try to beat me at StackBluff”).
- The share should work in both PWA and Telegram Mini App contexts (using the platform‑agnostic share API from #006).

---

### ✅ Acceptance Criteria

- [ ] **Backend:**
  - [ ] `user_season_cards` table is created via migration.
  - [ ] A background job runs exactly at the season end timestamp (or shortly after) and processes all players for that season.
  - [ ] For each player, a card image is generated and uploaded to R2.
  - [ ] The URL is stored in `user_season_cards`.
  - [ ] Soft rank reset is applied: all players get a new rank in the next season according to the drop rules (Legend→Maestro, … Gold→Silver, Silver and below stay the same).
  - [ ] Players receive a notification that their card is ready.
  - [ ] The global leaderboard is refreshed after reset.

- [ ] **Frontend:**
  - [ ] Users can view their Season End Card (via a new route or modal).
  - [ ] A notification indicator appears when a new card is available.
  - [ ] The Share button works and shares the card (image + caption) via `PlatformAPI.shareContent`.
  - [ ] The card displays the correct data: rank tier, best hand, total chips won, hands played.

- [ ] **General:**
  - [ ] All players receive a card within 24 hours of season end (job runs promptly).
  - [ ] No data loss: all historical ranks are preserved for reference.
  - [ ] The new season starts with fresh leaderboard (reset).

---

### 🔗 Blocked By

- **#002** – `seasons` and `player_ranks` tables must exist.
- **#015** – Replay card generation infrastructure (R2 upload, image generation) provides a basis; we can reuse the same approach (or extend it) for season cards.

---

### 🧪 Testing Notes

- Unit tests for the rank reset logic.
- Integration tests: simulate season end with a test database, check that cards are generated and ranks reset.
- Mock the image generation to avoid heavy dependencies in CI.
- Frontend: test that the share button triggers the platform share API.

---

### 📝 Implementation Hints

- **Image generation:**  
  - For MVP, consider using a simple HTML template and converting it to PNG via `html2canvas` in the frontend (i.e., generate the card client‑side). However, the spec says "server-side generated card" – we can generate a JSON card and let the frontend render it; the image can be created on the client when sharing. That might be simpler and avoid server‑side image dependencies. But to be safe, implement a server‑side image generation using the `image` crate with basic shapes and text (or use `resvg` for SVG). We'll keep it flexible: generate a JSON card data that the frontend can render as a styled component, and also provide an image URL if we implement image generation later.
  - The acceptance criteria say “card contains correct data” – it doesn't mandate image format. So we can start with a JSON card and a frontend renderer.

- **Scheduling:**  
  - Use `tokio-cron-scheduler` to schedule a job that runs daily and checks if any season ended. Or compute the exact sleep time until the next season end and spawn a one‑shot task. The latter is simpler.

- **Notifications:**  
  - Use the existing `NotificationService` (from #001) to send the notification. The `NotificationEvent` enum can be extended with `SeasonCardReady { season_id: i32 }`.

- **Reuse R2:**  
  - The `hand_archive` module already has a `RealR2` struct; we can instantiate it in `main.rs` and pass it to the season card generator.
