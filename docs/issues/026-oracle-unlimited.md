 ## Oracle unlimited access for Season Pass holders
 
 **Labels:** `backend, oracle, afk`  
 **Blocked by:** #002 (users table needs season pass columns), #012 (Oracle engine exists)
 
 ---
 
 ### 📌 Summary
 
 Currently, the Oracle analysis endpoint (`/oracle/analyze`) is limited to **3 free analyses per user session** (implemented in `sb-oracle/src/session.rs`). Season Pass holders should get **unlimited access** to the Oracle. This ticket enhances the `sb-oracle` crate to check a user’s active Season Pass status and conditionally bypass the rate cap.
 
 ---
 
 ### 🧩 Context (where to find things in the codebase)
 
 | Component | File(s) |
 |-----------|---------|
 | Oracle service implementation | `backend/crates/sb-oracle/src/lib.rs` (OracleServiceImpl) |
 | Session manager (caps free usage) | `backend/crates/sb-oracle/src/session.rs` (SessionManager, MAX_ANALYSES = 3) |
 | User repository trait | `backend/crates/sb-contracts/src/repo_api.rs` (UserRepo, UserProfile) |
 | Database entities (users) | `backend/crates/sb-db-entities/src/user.rs` (Model) |
 | Migrations | `backend/migration/src/` (add new migration file) |
 | REST endpoint | `backend/crates/sb-rest-router/src/oracle_routes.rs` (`/oracle/analyze`) |
 | New endpoint for remaining | Add `GET /oracle/remaining` in `oracle_routes.rs` |
 
 ---
 
 ### 🔧 What to build
 
 #### 1. Database migration
 
 Add two columns to the `users` table:
 
 ```sql
 ALTER TABLE users ADD COLUMN season_pass_id UUID NULL;
 ALTER TABLE users ADD COLUMN season_pass_expires_at TIMESTAMP NULL;
 ```
 
 - `season_pass_id` can be a foreign key to a future `season_passes` table (or just store an identifier). For now, it’s a nullable UUID.
 - `season_pass_expires_at` is the UTC timestamp when the pass expires. If `NULL` or in the past, the user has no active pass.
 
 > 💡 **Note:** The migration must be idempotent (`IF NOT EXISTS` for columns is not supported in SQLite; use a check or ignore duplicate errors). See existing migrations for pattern (e.g., `m20260622_132958_mission_system.rs` uses `add_column_if_not_exists` via helper).
 
 Place the migration in `backend/migration/src/m20260627_add_season_pass_columns.rs` and register it in `lib.rs`.
 
 #### 2. Update domain types
 
 - Extend `sb_shared_types::UserProfile` (in `sb-contracts/src/repo_api.rs`) to include:
   ```rust
   pub season_pass_id: Option<Uuid>,
   pub season_pass_expires_at: Option<DateTime<Utc>>,
   ```
 - Update the repository implementation (`sb-db-repos/src/user_repo.rs` and the writer loop) to read/write these fields.
 
 #### 3. Extend `UserRepo` trait (optional)
 
 Add a convenience method to check active pass status directly, e.g.:
 
 ```rust
 async fn has_active_season_pass(&self, ctx: RequestContext, user_id: UserId) -> Result<bool, PersistenceError>;
 ```
 
 Or simply use `get_user_profile` and check the fields in the Oracle service.
 
 #### 4. Modify `OracleServiceImpl::analyze`
 
 In `backend/crates/sb-oracle/src/lib.rs`:
 
 - Inject an `Arc<dyn UserRepo>` into `OracleServiceImpl` (update constructor).
 - In `analyze`, retrieve the user’s profile (via `user_repo.get_user_profile(ctx, user_id)`).
 - If `profile.season_pass_expires_at` is `Some` and `> Utc::now()`, **skip** the `sessions.try_consume(user_id)` check (allow unlimited).
 - Otherwise, enforce the 3‑per‑session cap as before.
 
 #### 5. Expose `GET /oracle/remaining`
 
 Add a new REST endpoint in `oracle_routes.rs`:
 
 ```rust
 async fn remaining_analyses(
     State(oracle): State<SharedOracleService>,
     Extension(auth_user): Extension<AuthUser>, // requires authentication
 ) -> impl IntoResponse
 ```
 
 - Returns JSON: `{ "remaining": 3, "unlimited": false }` or `{ "unlimited": true }`.
 - Logic:
   - Look up user profile; if active pass, return `{ "unlimited": true }`.
   - Else, query the session manager (expose a method like `remaining_analyses(user_id)`) to get how many of the 3 free analyses are left.
 
 #### 6. Session manager enhancement
 
 Add a method to `SessionManager`:
 
 ```rust
 pub async fn remaining(&self, user_id: UserId) -> u32
 ```
 
 Returns `MAX_ANALYSES - count` (or 0 if count >= MAX_ANALYSES), ignoring any TTL/reset logic.
 
 ---
 
 ### ✅ Acceptance Criteria
 
 - [ ] Season Pass holder (with `season_pass_expires_at > now()`) can call `/oracle/analyze` more than 3 times in a session without receiving `LimitReached` error.
 - [ ] Non‑pass holder receives `LimitReached` after exactly 3 successful analyses in the same session.
 - [ ] The error response for `LimitReached` includes an `upgrade_url` field (value configurable via env, e.g., `UPGRADE_URL`).
 - [ ] `GET /oracle/remaining` returns correct remaining count for free users and `unlimited: true` for pass holders.
 - [ ] After pass expiry (timestamp passes), the user reverts to free tier and the 3‑per‑session cap applies again (test with mock or time manipulation).
 - [ ] Migration correctly adds columns to existing databases (idempotent).
 - [ ] Unit tests added for:
   - Active pass bypasses limit.
   - Expired pass behaves like free user.
   - Remaining endpoint logic.
 
 ---
 
 ### 🔗 Blocked By
 
 - **#002** – Users table needs the new columns. This ticket must wait for the migration to be merged.
 - **#012** – Oracle engine exists and provides the core logic. This ticket only modifies the rate‑limiting layer.
 
 ---
 
 ### 🧪 Testing
 
 - Write integration tests using a test database and mock time (e.g., using `tokio::time::pause()`).
 - Use `mockall` to mock `UserRepo` for unit tests in `sb-oracle`.
 - Ensure the `remaining` endpoint is authenticated (uses `AuthUser` middleware).
 
 ---
 
 ### 📝 Notes for the AI agent
 
 - The existing session manager uses a `DashMap` and resets after 8 hours of inactivity. That logic remains unchanged for free users.
 - The `OracleServiceImpl` currently does not have a `UserRepo` dependency; you will need to add it via the constructor and update the creation in `main.rs` (where the oracle service is built).
 - The `UserProfile` struct is used in many places; adding fields there will require updating all usages – but for now, just add the fields and adjust the writer loop to read them from the database.
 - The `oracle_routes` currently passes a dummy user ID in the request context; we need to ensure the real authenticated user ID is used. The route should use `Extension<AuthUser>` to get the authenticated user ID.
