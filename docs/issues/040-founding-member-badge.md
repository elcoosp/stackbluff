## Founding Member badge – 10+ successful referrals

**Title:** Founding Member badge – 10+ successful referrals  
**Labels:** `backend, frontend, viral, afk`  
**Blocked by:** #015 (referral system exists), #006 (frontend profile page)

---

### 📌 Summary

Implement the **Founding Member badge** (REQ-FUNC-055). Users who successfully refer **10 friends who each complete at least 5 hands** will be awarded a special badge: `founding_member`. The badge is visible on the user's profile, the global leaderboard, and optionally on the table seating (if the user enables it in settings). When the badge is unlocked, the user receives a shareable moment via `PlatformAPI`.

The referral system (from #015) already tracks referrals and hand completion. This ticket adds badge tracking, awarding logic, and frontend display.

---

### 🧩 Context (where to find things)

| Component | File(s) |
|-----------|---------|
| Referral system | `backend/crates/sb-viral/src/referral.rs`, `sb-db-repos/src/referral_repo.rs` |
| Badge management | New table `user_badges` (create migration). |
| Viral service | `backend/crates/sb-viral/src/lib.rs` (extend `on_hand_completed` to check and award badges). |
| Backfill script | A one‑off script (can be a migration or a standalone binary). |
| Frontend profile page | `frontend/apps/pwa/src/pages/ProfilePage.tsx` (or `SettingsPage`). |
| Leaderboard | `frontend/apps/pwa/src/components/Leaderboard.tsx` (add badge icon). |
| Table seating | `frontend/apps/pwa/src/components/game/PlayerSpot.tsx` (optional badge display). |
| Platform sharing | `frontend/apps/pwa/src/platform/PlatformAPI.ts` (from #006). |

---

### 🔧 What to build

#### 1. Database – badge table

Create a new table `user_badges`:

```sql
CREATE TABLE user_badges (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    badge_type TEXT NOT NULL,  -- 'founding_member', 'founder_club' (future)
    awarded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, badge_type)
);
```

Create migration `m20260630_create_user_badges.rs` and register it.

#### 2. Backend – award logic

- Extend the referral tracking in `sb-viral/src/lib.rs` (or `referral_repo.rs`) to also count **completed referrals** (referred users who have played ≥5 hands).
- In `ViralServiceImpl::on_hand_completed`, after handling the referral bonus, check if the referred user has now reached 5 hands (the existing logic already does this). If so, increment the referrer's `completed_referrals` count (store in `users` or a separate `referral_stats` table). For simplicity, we can compute `completed_referrals` on the fly by counting rows in `referral` where `hand_count >= 5` and `bonus_awarded = true`.
- When the referrer’s count reaches 10, insert a badge record for them.
- The awarding should be idempotent – only insert if not already present.
- Use a transaction to avoid race conditions.

#### 3. Backfill script

- Write a one‑off script (e.g., in `bin/backfill_founding_member.rs` or as a migration) that:
  - Iterates over all users.
  - Counts their completed referrals (where `hand_count >= 5` and `bonus_awarded = true`).
  - If count ≥ 10, inserts the badge.
- Run the script once during deployment.

#### 4. API endpoints

- `GET /users/me/badges` – returns list of badge types the user has.
- `GET /users/{id}/badges` – for public profile (optional).
- Ensure the badge data is included in the existing `GET /users/me` response (or a separate query).

#### 5. Frontend – profile page

- In the user profile (`/profile` or settings), display the badge if present:
  - Show a small icon (e.g., a star or crown).
  - Tooltip: *“Founding Member – Referred 10 friends who played 5+ hands.”*
- If the badge is not yet earned, show a progress bar (e.g., “X/10 referrals completed”) to encourage sharing.

#### 6. Frontend – leaderboard

- In the global leaderboard, add a small badge icon next to the user’s name if they have the `founding_member` badge.
- Use the same icon as in the profile.

#### 7. Frontend – table seating (optional)

- In `PlayerSpot`, optionally show a tiny badge next to the player’s name if they have the badge (and if the user has enabled this in settings).
- Provide a toggle in user settings to show/hide badges on tables.

#### 8. Shareable unlock moment

- When the badge is awarded (backend or frontend detects it on next fetch), trigger a shareable notification:
  - Show a toast: “🏆 You’ve unlocked the Founding Member badge! Share your achievement.”
  - Call `PlatformAPI.shareContent` with a predefined message: *“I just became a Founding Member of StackBluff by referring 10 friends who played 5+ hands! Join me: {invite_link}”*.
- The share can be automatic (with a confirm dialog) or manual via a “Share” button.

---

### ✅ Acceptance Criteria

- [ ] A user with exactly 9 completed referrals has no badge.
- [ ] When the 10th referred friend completes their 5th hand, the badge is awarded **within 5 minutes** (via the next hand completion event or a periodic check – use the `on_hand_completed` trigger).
- [ ] The badge appears on the user’s profile page (icon + tooltip).
- [ ] The badge appears on the global leaderboard (small icon next to name).
- [ ] The badge appears on the table seating (optional, configurable in settings).
- [ ] The backfill script correctly badges all existing users with ≥10 completed referrals.
- [ ] The badge persists across seasons and account merges (the badge table is not reset).
- [ ] The shareable unlock moment triggers and uses `PlatformAPI.shareContent` correctly.
- [ ] The frontend shows a progress indicator for users approaching the badge (e.g., “8/10 referrals completed”).

---

### 🔗 Blocked By

- **#015** – The referral system must exist and track hand counts and bonus awards.
- **#006** – The frontend profile page and `PlatformAPI.shareContent` must be in place.

---

### 🧪 Testing Notes

- **Unit tests** for the badge awarding logic (mock the referral repo and user badge repo).
- **Integration test**: Create a user with 9 referrals, trigger the 10th referral’s 5th hand, verify the badge is inserted.
- **E2E test** (Playwright): Verify that the badge appears on the profile and leaderboard after earning it.
- **Backfill test**: Run the script on a seeded database with qualifying users and assert badges are inserted.

---

### 📝 Implementation Hints

- **Completed referrals count**: Compute it with a SQL query counting referrals where `hand_count >= 5` and `bonus_awarded = true` for the referrer. This avoids storing an extra counter.
- **Awarding logic**: In `ViralServiceImpl::on_hand_completed`, after awarding the referral bonus, query the referrer’s count. If `count >= 10` and not already badged, insert the badge.
- **Performance**: The count query is per referral completion (which is infrequent). Index `(referrer_id, hand_count)` to make it efficient.
- **Frontend fetching**: Add a `useBadges` hook that fetches the user’s badges. Invalidate the query after a hand result or after a WebSocket `badge.unlocked` event (optional).
- **WebSocket event**: Extend the WebSocket to send a `badge.unlocked` event when a badge is awarded, so the frontend can update instantly without polling.
- **Share content**: Use a template string for the share message; include the app URL with a referral parameter (if the user has a referral code).
