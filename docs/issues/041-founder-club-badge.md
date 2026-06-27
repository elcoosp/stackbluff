## Founder Club badge and unique table skin – first 100 clubs

**Title:** Founder Club badge and unique table skin – first 100 clubs  
**Labels:** `backend, frontend, clubs, viral, afk`  
**Blocked by:** #014 (club system exists), #006 (frontend club page)

---

### 📌 Summary

Implement the **Founder Club** reward (REQ-FUNC-056). The first 100 clubs ever created on the platform receive:

- A permanent `founder_club` badge displayed on the club page, search results, and tournament listings.
- Access to a **unique table skin** (from a special “Founder Collection” of 3 exclusive designs) that overrides the default table skin for all tables created under that club.

Club creation order is determined by the `created_at` timestamp (precise to milliseconds). The badge and skin are **permanent** – they stay with the club even if ownership changes.

The club owner can select one of the 3 founder skins in the club settings (visible only to founder clubs). The selected skin is applied to all tables belonging to that club.

---

### 🧩 Context (where to find things)

| Component | File(s) |
|-----------|---------|
| Club entity | `backend/crates/sb-db-entities/src/clubs.rs` (has `created_at`, `founder_skin_id`) |
| Club repository | `backend/crates/sb-db-repos/src/club_repo.rs` (ClubRepoImpl) |
| Club service | `backend/crates/sb-club/src/service.rs` (ClubServiceImpl) |
| Badge table | New table `club_badges` (create migration). |
| REST endpoints | `backend/crates/sb-rest-router/src/club_routes.rs` (or `sb-club/src/handlers.rs`) |
| Table creation | `backend/crates/sb-table-registry/src/registry.rs` (apply skin when creating table) |
| Frontend club page | `frontend/apps/pwa/src/pages/ClubPage.tsx` (from #006) |
| Frontend club settings | `frontend/apps/pwa/src/components/club/SettingsTab.tsx` (from #034) |
| Frontend table rendering | `frontend/apps/pwa/src/components/game/` (apply skin to felt, cards) |

---

### 🔧 What to build

#### 1. Database changes

- Add `founder_skin_id` (INTEGER, nullable) to the `clubs` table.
- Create `club_badges` table:
  ```sql
  CREATE TABLE club_badges (
      club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
      badge_type TEXT NOT NULL,  -- 'founder_club'
      awarded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (club_id, badge_type)
  );
  ```
- Create migration `m20260630_create_club_badges_and_founder_skin.rs`.

#### 2. Backend – founder club detection

- On club creation (`create_club`), determine if the club is within the first 100:
  - Query the count of clubs created before this one (based on `created_at` ordering).
  - If the new club’s position is ≤ 100, mark it as a founder club by:
    - Inserting a record in `club_badges` with `badge_type = 'founder_club'`.
    - Setting `founder_skin_id = NULL` initially (owner can later pick a skin).
- The ordering must be precise – use `created_at` with sub‑millisecond precision (or a monotonically increasing sequence number). Since SQLite’s `DATETIME` has millisecond precision, we can use `created_at` and an auto‑increment `id` as a tie‑breaker.

#### 3. Backend – founder skin selection

- Add a new endpoint or extend `PATCH /clubs/{id}/settings` to accept `founder_skin_id` (1–3).
- Only allow the update if the club has the `founder_club` badge.
- Valid skin IDs: 1, 2, 3 (defined in a frontend‑side configuration; backend just stores the ID).
- If the club is not a founder club, return `403 Forbidden` or `400 Bad Request`.

#### 4. Backend – table skin application

- When a table is created under a club (in `Registry::create_table` or `Registry::create_tournament_table`), check the club’s `founder_skin_id`.
- If set, store the skin ID in the table’s configuration (or as a separate column) so that the frontend can apply the correct skin when rendering.
- The skin should override the default table skin for that table.

#### 5. Frontend – founder badge display

- In the club page header, show the `founder_club` badge (e.g., a golden crown icon with a tooltip).
- In club search results and tournament listings, display the badge next to the club name.
- The badge should be visible to all users.

#### 6. Frontend – founder skin picker

- In the club settings (available to club owners), add a **Founder Skins** section (only visible if the club has the `founder_club` badge).
- Display the 3 exclusive skins as selectable options (preview images).
- When a skin is selected, call `PATCH /clubs/{id}/settings` with `founder_skin_id`.
- After saving, the club’s tables should reflect the new skin immediately (via WebSocket broadcast or by refetching the club settings).

#### 7. Frontend – table rendering with founder skin

- When rendering a table (`TablePage` or `TableFelt`, `Card` components), check if the table has a founder skin assigned.
- If yes, apply the corresponding CSS styles:
  - **Felt colour**: use a custom gradient (defined per skin).
  - **Card backs**: use a custom card back design (e.g., a distinct pattern or colour).
  - **Table rail**: optional styling changes.
- The skin configuration can be stored in the frontend as a mapping from skin ID to styles (colour, image URLs, etc.).

---

### ✅ Acceptance Criteria

- [ ] **Backend:**
  - [ ] The first 100 clubs created receive the `founder_club` badge and have `founder_skin_id` set to NULL.
  - [ ] Club #101 onwards do not receive the badge or skin.
  - [ ] Only founder clubs can update `founder_skin_id` via the API.
  - [ ] Tables created under a founder club store the selected skin ID.
- [ ] **Frontend:**
  - [ ] The `founder_club` badge is displayed on the club page, in search results, and in tournament listings.
  - [ ] Club owners of founder clubs see the “Founder Skins” section in settings with 3 options.
  - [ ] Non‑founder clubs do not see the founder skins section.
  - [ ] Selecting a skin updates the club’s settings and the change is reflected on all active tables within 10 seconds (via WebSocket or polling).
  - [ ] Tables with a founder skin display a distinct felt colour and card back design (different from the default).
  - [ ] The skin persists even if the club changes ownership (the badge and skin stay with the club).

---

### 🔗 Blocked By

- **#014** – The club system (including creation, membership, and settings) must be fully functional.
- **#006** – The frontend club page and settings UI must exist to display the badge and skin picker.

---

### 🧪 Testing Notes

- **Backend tests**:
  - Unit test for founder detection logic (create 101 clubs and assert the first 100 get the badge).
  - Integration test for the skin selection endpoint (permission checks, validation).
  - Verify that tables created under a founder club have the skin ID stored correctly.
- **Frontend tests**:
  - Unit tests for the badge display component.
  - Integration tests for the skin picker (API call, state update).
  - E2E test: create a founder club, select a skin, join a table, and verify the table renders with the custom skin.

---

### 📝 Implementation Hints

- **Founder detection**: Use `SELECT COUNT(*) FROM clubs WHERE created_at < NOW()` or use an auto‑incrementing `id` if clubs are created sequentially. The latter is simpler: if `id <= 100`, it's a founder club (assuming no deletions). However, if IDs are UUIDs, we need to use `created_at` and order by `created_at` to find the rank.
- **Skin configuration**: Define the skin styles in the frontend as a map:
  ```typescript
  const FOUNDER_SKINS = {
    1: { feltGradient: '...', cardBackImage: '...', railColor: '...' },
    2: { ... },
    3: { ... }
  };
  ```
- **WebSocket broadcast**: When the skin is updated, broadcast a `club_theme_updated` event (similar to #035) to all users at the club’s tables, so the skin updates in real time.
- **Backward compatibility**: For tables created before the founder skin feature, `founder_skin_id` is NULL; they should use the default skin.

---

This issue provides a complete specification for the Founder Club badge and unique skin feature, with clear boundaries for backend and frontend work.
