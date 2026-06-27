## Leaderboard division sharding for clubs exceeding 500 members

**Title:** Leaderboard division sharding for clubs exceeding 500 members  
**Labels:** `backend, clubs, performance, afk`  
**Blocked by:** #014 (club leaderboard exists)

---

### 📌 Summary

Implement **division sharding** for club leaderboards to handle clubs with more than 500 members (REQ-FUNC-042, BR-014). When a club exceeds 500 members, the membership is automatically split into divisions of ≤500 members. Each division maintains its own leaderboard, ranked by weekly XP. The API and UI must support viewing a specific division, and the frontend should display the division a member belongs to.

Key requirements:

- Divisions are numbered sequentially (1, 2, …) based on join order (the earliest 500 members go to Division 1, the next 500 to Division 2, etc.).
- Each division has its own leaderboard (ranked by weekly XP).
- The `GET /clubs/{id}/leaderboard` endpoint accepts a `?division=1` query parameter (default 1) and returns leaderboard entries for that division, along with `total_divisions`.
- Club owners can view any division’s leaderboard (frontend will provide a dropdown).
- Members see which division they belong to on the club page.
- XP earned moves a member **up only within their division** (no cross-division movement).
- If a club grows beyond 1000 members, divisions may be rebalanced (round‑robin reassignment) on request or via a weekly background job.

---

### 🧩 Context (where to find things)

| Component | File(s) |
|-----------|---------|
| Club repository | `backend/crates/sb-db-repos/src/club_repo.rs` (ClubRepoImpl) |
| Club service | `backend/crates/sb-club/src/service.rs` (ClubServiceImpl) |
| Club entities | `backend/crates/sb-db-entities/src/club_memberships.rs`, `club_leaderboard.rs` |
| Existing leaderboard logic | `backend/crates/sb-db-repos/src/club_repo.rs` (`get_leaderboard_page`, `refresh_leaderboard`) |
| REST endpoints | `backend/crates/sb-rest-router/src/club_routes.rs` (if exists) or `sb-club/src/handlers.rs` |
| API contract | `GET /clubs/{id}/leaderboard` (add `division` query param) |

---

### 🔧 What to build

#### 1. Division assignment logic

- When a user joins a club, assign them to a division based on the current member count:
  - `division = (member_count / DIVISION_SIZE) + 1` (using 0‑based indexing).
  - Store the division number in the `club_memberships` table (add a `division` column, integer, not null, default 1).
  - Create a migration to add this column (`m20260629_add_division_to_club_memberships.rs`).

#### 2. Leaderboard refresh with divisions

- The `refresh_leaderboard` function in `ClubRepoImpl` currently computes division based on rank (i.e., `division = (rank-1)/DIVISION_SIZE + 1`). This must be updated to **use the membership’s stored division** instead of recomputing from rank.
- The refresh should:
  - Delete existing `club_leaderboard` entries for the club.
  - Insert new rows for each member, grouping by division (stored in `club_memberships`).
  - Rank order remains by `weekly_xp` **within each division**.

#### 3. API: `GET /clubs/{id}/leaderboard`

- Update the handler to accept an optional query parameter `division` (default 1).
- The repository method `get_leaderboard_page` should filter by `division` and return:
  - `entries: Vec<LeaderboardEntry>` (rank, user_id, weekly_xp)
  - `total_divisions` (computed as `ceil(total_members / DIVISION_SIZE)`)
  - `current_division` (the requested division)
  - `total_members` (total members in the club, not just the division)
- The response should also include the member’s own division (if the user is authenticated) – this can be added as a separate field or included in the `UserProfile` response when fetching club details.

#### 4. Rebalancing (on request or weekly job)

- Provide an admin endpoint or a background job that:
  - Reassigns all members of a club to divisions in round‑robin order (or by join order) to keep divisions balanced when the club grows unevenly (e.g., if many members join and old divisions become full).
  - This can be triggered manually by the club owner (via a `POST /clubs/{id}/rebalance` endpoint) or run weekly as a cron job for all clubs.
- The rebalance logic:
  - Clear existing division assignments.
  - Sort members by `joined_at` (or by `weekly_xp` descending if desired).
  - Assign them in chunks of `DIVISION_SIZE`.
- After rebalancing, refresh the leaderboard for the club.

#### 5. XP movement

- `add_xp` (incrementing weekly XP) should **not** change a member’s division. Divisions are only changed by rebalancing or initial assignment.
- Ensure the `increment_weekly_xp` method updates the `club_memberships` row without affecting the division column.

#### 6. API for frontend

- The club details endpoint (`GET /clubs/{id}`) should return the current user’s division (if they are a member).
- The leaderboard endpoint should include `total_divisions` in the response so the frontend can build a dropdown.

---

### ✅ Acceptance Criteria

- [ ] When a club reaches 501 members, the 501st member is assigned to Division 2. Division 1 has exactly 500 members.
- [ ] The `GET /clubs/{id}/leaderboard?division=1` query returns exactly 500 rows (or the number of members in that division) in under 100ms (measured with realistic data).
- [ ] The response includes `total_divisions` and `current_division`.
- [ ] XP earned moves a member’s rank **only within their division**; members in Division 2 cannot overtake Division 1 members in the same leaderboard view.
- [ ] The rebalance job (if triggered) correctly redistributes members so all divisions are balanced (e.g., for 1000 members, both divisions have 500 members).
- [ ] The frontend can retrieve the member’s division from the club details endpoint.
- [ ] All existing leaderboard functionality remains intact (e.g., ordering by XP, pagination by rank).

---

### 🔗 Blocked By

- **#014** – The club leaderboard and membership system must exist (tables, repository, basic CRUD). This ticket extends that foundation.

---

### 🧪 Testing Notes

- **Unit tests** for division assignment logic (especially edge cases: exactly 500, 501, 1000 members).
- **Integration tests** for the leaderboard API with a seeded database of 600 members, verifying division filtering and total divisions.
- **Performance test** for leaderboard query with 500 rows – ensure it stays under 100ms (use SQLite’s `EXPLAIN` to check indexes).
- **Rebalancing test**: Add 1000 members, trigger rebalance, and assert all divisions have exactly 500 members.

---

### 📝 Implementation Hints

- **Migration**: Add `division` column to `club_memberships` (default 1). Also consider adding an index on `(club_id, division)` for faster leaderboard queries.
- **Leaderboard refresh**: Update the refresh query to group by division and use the stored division from `club_memberships`. For SQLite, you can use `ROW_NUMBER()` over `(PARTITION BY division ORDER BY weekly_xp DESC)` to compute ranks per division.
- **API response**: Extend the `LeaderboardPage` struct (in `sb-contracts/src/repo_api.rs`) with `total_divisions` and `current_division` fields.
- **Rebalancing**: Use a background job with `tokio-cron-scheduler` (already in `sb-server`) or a simple `tokio::spawn` for a one‑off task. The rebalance endpoint should be protected (owner only).
