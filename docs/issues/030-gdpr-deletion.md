## GDPR data deletion – endpoint, background job, and frontend UI

**Title:** GDPR data deletion – endpoint, background job, and frontend UI  
**Labels:** `backend, frontend, compliance, afk`  
**Blocked by:** #002 (users & hand_history tables), #006 (frontend settings page scaffold)

---

### 📌 Summary

Implement the **right to erasure** (GDPR Article 17) for StackBluff users. Users must be able to:

1. Request deletion of their account and all associated personal data.
2. Receive a confirmation that the request has been accepted.
3. Have their data permanently anonymised within 30 days via a background job.
4. Also be able to export their data in a machine‑readable format (data portability, GDPR Article 20).

The system must handle the deletion gracefully, preserving aggregate statistics (e.g., leaderboard positions) while removing all personally identifiable information (PII).

**Two agents will work in parallel:**
- **Agent 1 (Backend)** – implements endpoints, background job, and data anonymisation logic.
- **Agent 2 (Frontend)** – implements the UI for account deletion and data export, including confirmation and status display.

---

### 🧩 Context (where to find things)

| Component | File(s) |
|-----------|---------|
| User repository & entities | `backend/crates/sb-db-entities/src/user.rs`, `sb-contracts/src/repo_api.rs`, `sb-db-repos/src/user_repo.rs` |
| Hand history | `backend/crates/sb-db-entities/src/hand_history.rs`, `sb-db-repos/src/hand_history_repo.rs` |
| Mission & referral tables | `backend/crates/sb-db-entities/src/mission_completion.rs`, `referral.rs`, `subscription_event.rs` |
| Payment intents | `backend/crates/sb-db-entities/src/payment_intents.rs` (or similar) |
| REST routes (backend) | `backend/crates/sb-rest-router/src/lib.rs` (main router), maybe a new `user_routes.rs` |
| Background job infrastructure | Use `tokio-cron-scheduler` (already in `Cargo.toml` of `sb-server`) for daily job. |
| Frontend settings page | Existing settings page location (to be added via #006). |

---

### 🔧 Part 1 – Backend (Agent 1)

#### 1. Database changes

Add a `deletion_requests` table:

```sql
CREATE TABLE deletion_requests (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    requested_at TIMESTAMP NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',  -- pending | processing | completed | failed
    processed_at TIMESTAMP,
    reason TEXT
);
```

Add a migration (`m20260628_create_deletion_requests.rs`) and register it.

Also add a `deleted_at` column to `users` (nullable) to mark anonymised accounts, but keep the record for referential integrity.

#### 2. Endpoint: `DELETE /users/me`

- **Path:** `/users/me`
- **Method:** DELETE
- **Authentication:** required (via `AuthUser`).
- **Response:** `202 Accepted` with `{ "status": "accepted", "message": "Deletion request received. You will receive an email confirmation (if registered) and your data will be anonymised within 30 days." }`
- **Implementation:**
  - Insert a record into `deletion_requests` with `status = 'pending'`.
  - If the user has an email, send a confirmation email (or use the notification service) to verify the request (optional but recommended).
  - Immediately invalidate all active sessions (delete from `sessions` table) and revoke the JWT (or mark it as invalid).
  - Return `202 Accepted`.

#### 3. Endpoint: `GET /users/me/data`

- **Path:** `/users/me/data`
- **Method:** GET
- **Authentication:** required.
- **Response:** `200 OK` with JSON containing:
  - User profile (display name, email, creation date, etc.)
  - Full hand history (anonymised by removing other players' PII? For data portability, include the user's own hole cards, bets, etc.)
  - Mission progress, referrals (where user is referrer or referee), subscription events, payment intents.
  - All data must be exported in a structured format (e.g., JSON).
- **Implementation:**
  - Query all relevant tables for the user.
  - Combine into a single JSON object.
  - Return with `Content-Disposition: attachment; filename="user_data.json"` (optional, but good practice).

#### 4. Background job (daily)

- Schedule a daily cron job (using `tokio-cron-scheduler`) to process `deletion_requests` with `status = 'pending'` and `requested_at` older than 30 days (or immediately for testing).
- For each user, perform the following anonymisation steps inside a transaction:
  1. **Users table:** Keep the record but set:
     - `display_name = 'Deleted User'` (or NULL)
     - `email = NULL`
     - `telegram_id = NULL`
     - `password_hash = NULL`
     - `push_subscription = NULL`
     - `chip_balance = 0` (or keep as 0, but perhaps leave aggregated data)
     - `created_at` and `updated_at` remain for auditing.
     - Add `deleted_at = NOW()`.
  2. **Hand history:** For hands where the user was a participant, set their `user_id` to `NULL` in the `players_json` (and `participants` column). The hand record remains for aggregate statistics but no longer links to the user.
  3. **Sessions:** Delete all sessions for the user.
  4. **Missions:** Delete or anonymise (keep mission completions but with `user_id = NULL`? Better to keep for aggregate, but GDPR allows retention for statistical purposes; we can keep but remove link by setting `user_id = NULL` if not needed for leaderboard).
  5. **Referrals:** Anonymise both referrer and referred IDs (set to NULL) to break the link.
  6. **Subscription events:** Delete or anonymise.
  7. **Payment intents:** Keep for accounting, but remove `user_id` link (set to NULL) after anonymisation.
  8. **Tournament registrations & results:** Set `user_id = NULL` (or delete) but keep tournament structure.
- After successful anonymisation, update `deletion_requests.status = 'completed'` and `processed_at = NOW()`.
- Log each step and send a notification to admins (or log errors).

#### 5. Re‑registration handling

- When a user re‑registers with the same Telegram ID, the system should create a **new** user record (the old one was anonymised). Ensure that `telegram_id` is unique and the old record has it set to NULL, so a new user with the same ID can be created.

---

### 🔧 Part 2 – Frontend (Agent 2)

#### 1. Settings page – “Delete my account” section

- Add a new section in the user settings (accessible from the main navigation / profile).
- Include:
  - A button **“Delete my account”**.
  - A disclaimer: *“This will permanently delete your account and anonymise all your personal data. This action cannot be undone. You have 30 days to cancel (by contacting support) before the deletion is finalised.”*
- On click, show a **confirmation modal**:
  - Require the user to type their password (or confirm via email OTP) to prevent accidental deletion.
  - For PWA users with unverified email, require email verification before allowing deletion.
  - After confirmation, call `DELETE /users/me` and show a success message: *“Deletion request accepted. You will receive a confirmation email shortly.”*

#### 2. Status indicator

- Display the current status of the deletion request (if any) on the settings page:
  - *“Your deletion request is pending. Data will be anonymised within 30 days.”*
  - *“Your account is scheduled for deletion on [date].”*
  - *“Your account has been anonymised (if already processed).”*

#### 3. Data export button

- Add a **“Download my data”** button next to the deletion section.
- On click, call `GET /users/me/data` and download the JSON file.

#### 4. Email verification flow (if not already implemented)

- For PWA users, before allowing deletion, ensure their email is verified. If not, send a verification email and prompt them to verify.

---

### ✅ Acceptance Criteria

- [ ] **Backend:**
  - [ ] `DELETE /users/me` returns `202 Accepted` and inserts a pending deletion request.
  - [ ] All sessions are immediately invalidated.
  - [ ] `GET /users/me/data` returns a comprehensive JSON export of all user data.
  - [ ] The background job runs daily and correctly anonymises users with pending requests older than 30 days.
  - [ ] After anonymisation, no PII remains in `users` or related tables (verified by test queries).
  - [ ] Re‑registration with the same Telegram ID creates a fresh, clean account.
  - [ ] Leaderboard no longer shows the deleted user's name, but aggregate chip totals remain (e.g., “Anonymous” or the anonymised record).

- [ ] **Frontend:**
  - [ ] Settings page has a “Delete my account” button with a confirmation modal.
  - [ ] Users cannot delete their account without confirming (password or email OTP).
  - [ ] Status of deletion request is shown on the settings page.
  - [ ] “Download my data” button works and downloads the export.

- [ ] **General:**
  - [ ] GDPR compliance is verified: after deletion, no PII can be found in the database (tested with a data audit script).
  - [ ] The entire flow is documented for legal/audit purposes.

---

### 🔗 Blocked By

- **#002** – The user, hand_history, sessions, etc., tables must exist.
- **#006** – The frontend settings page scaffold must be in place so we can add the deletion UI.

---

### 🧪 Testing Notes

- Unit tests for the backend endpoints (mock the background job).
- Integration tests for the anonymisation logic (use a test database).
- E2E tests for the frontend flow (simulate deletion request).
- Manual test: create a user, request deletion, wait for the background job (or trigger manually), and verify all data is anonymised.

---

### 📝 Implementation Hints

- Use `tokio-cron-scheduler` (already imported in `sb-server/Cargo.toml`) to schedule the daily job. The job should be spawned in `main.rs` after the database is initialised.
- The anonymisation logic can be a separate module in `sb-db-repos` or a new crate `sb-gdpr`.
- For the data export, use serde to serialise all relevant data into a single JSON structure. Be careful not to include other users' PII.
- For the email confirmation, you can reuse the existing notification service (or implement a simple email sender using `reqwest` to a transactional email provider). However, the issue description doesn't explicitly require email confirmation; it says "for PWA users if not verified, require email verification" – so we need a verification flow.
- Ensure all database operations are wrapped in transactions to maintain consistency.
