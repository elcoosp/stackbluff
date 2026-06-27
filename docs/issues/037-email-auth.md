## Email sending – password reset and registration verification (PWA)

**Title:** Email sending – password reset and registration verification (PWA)  
**Labels:** `backend, auth, afk`  
**Blocked by:** #004 (authentication module exists)

---

### 📌 Summary

Add transactional email support for PWA users. This extends the `sb-auth` crate to:

1. **Send a verification email** upon registration with a one‑time link to verify the email address.
2. **Send a password reset email** upon request with a secure token to reset the password.
3. Store the `email_verified_at` timestamp in the `users` table.
4. Use **Resend API** (or AWS SES) for email delivery, with background queuing to avoid blocking requests.
5. Enforce **rate limiting** (max 3 verification emails per email per hour).
6. **Block paid transactions** (chip bundles, Season Pass, Club Pro) for unverified users (return `403 Forbidden`).

Email sending is implemented as a background task using a `tokio` channel to ensure low latency for the request path.

---

### 🧩 Context (where to find things)

| Component | File(s) |
|-----------|---------|
| Authentication service | `backend/crates/sb-auth/src/auth_service.rs` (AuthServiceImpl) |
| User repository | `backend/crates/sb-contracts/src/repo_api.rs` (UserRepo), `sb-db-repos/src/user_repo.rs` |
| User entity | `backend/crates/sb-db-entities/src/user.rs` (add `email_verified_at`) |
| Configuration | `backend/crates/sb-auth/src/config.rs` (add Resend API key, sender email, base URL) |
| JWT utilities | `backend/crates/sb-auth/src/jwt.rs` (extend to create short‑lived tokens) |
| REST routes | `backend/crates/sb-auth/src/routes.rs` (add verification and reset endpoints) |
| Payment service (for blocking) | `backend/crates/sb-payment/src/service.rs` (check `email_verified_at` before payment) |

---

### 🔧 What to build

#### 1. Database migration

Add `email_verified_at` column to `users` table:

```sql
ALTER TABLE users ADD COLUMN email_verified_at TIMESTAMP NULL;
```

Create migration `m20260630_add_email_verified_at.rs` and register it.

#### 2. Email configuration

Add to `AuthConfig` (in `sb-auth/src/config.rs`):

```rust
pub struct AuthConfig {
    // existing fields...
    pub resend_api_key: SecretString,
    pub email_from: String,
    pub app_base_url: String,
    pub verification_token_ttl_seconds: u64, // e.g., 86400 (24h)
    pub reset_token_ttl_seconds: u64,        // e.g., 3600 (1h)
}
```

Read from environment: `RESEND_API_KEY`, `EMAIL_FROM`, `APP_BASE_URL`, etc.

#### 3. Email sending service

Create a new module `sb-auth/src/email.rs`:

- Define a struct `EmailService` with a `reqwest::Client` and the API key.
- Implement methods:
  - `send_verification_email(to: &str, token: &str) -> Result<(), Error>`
  - `send_password_reset_email(to: &str, token: &str) -> Result<(), Error>`
- Use the Resend API endpoint: `https://api.resend.com/emails` with JSON payload:
  ```json
  {
    "from": "noreply@stackbluff.com",
    "to": "user@example.com",
    "subject": "Verify your email",
    "html": "<a href='...'>Verify</a>"
  }
  ```

#### 4. Background email queue

- In `sb-auth/src/lib.rs`, create a global `mpsc::Sender<EmailJob>` (or use a static lazy).
- Start a background task (spawned once) that receives jobs and sends emails sequentially (or with a small concurrency).
- The email sending should be fire‑and‑forget from the request handler – the handler pushes the job and returns immediately.
- Use a `oneshot` channel if confirmation is needed, but for simplicity, just log errors.

#### 5. Verification flow

- **Registration**: After user creation, generate a short‑lived JWT (e.g., with claim `email_verify` and `sub` = user_id). Store nothing extra. Send the email with a link: `{app_base_url}/verify-email?token={jwt}`.
- **Verification endpoint**: `GET /auth/verify-email?token=...` – decode the token, check expiry, update `users.email_verified_at = NOW()` for that user.
- **Rate limiting**: Use an in‑memory cache (e.g., `DashMap`) keyed by email to count sent emails per hour. Reject if > 3 in the last 60 minutes.

#### 6. Password reset flow

- **Request reset**: `POST /auth/forgot-password` with `{ email }` – check if user exists, generate a short‑lived JWT (claim `reset_password`), send email with link: `{app_base_url}/reset-password?token={jwt}`.
- **Reset endpoint**: `POST /auth/reset-password` with `{ token, new_password }` – decode token, verify, update password hash.

#### 7. Block unverified users for payments

- In `sb-payment/src/service.rs` (or wherever payment intent creation is), add a check:
  - Fetch user profile (including `email_verified_at`).
  - If `email_verified_at` is `NULL` and `platform == 'pwa'`, return `403 Forbidden` with a message: “Please verify your email address before making a purchase.”

#### 8. Error handling and logging

- Log email send failures (warn or error) but do not fail the request.
- Provide clear error messages to the user (e.g., “Verification email sent” or “Invalid token”).

---

### ✅ Acceptance Criteria

- [ ] A new PWA user registering via email receives a verification email within 10 seconds (measured with a mock or real API).
- [ ] Clicking the verification link marks the user’s `email_verified_at` as `NOW()`.
- [ ] Unverified users attempting to buy chips, Season Pass, or Club Pro receive a `403 Forbidden` response with a clear message.
- [ ] A password reset request sends an email with a reset link; the link works and allows the user to set a new password.
- [ ] Rate limiting: sending more than 3 verification emails to the same email within an hour fails with a `429 Too Many Requests` error.
- [ ] No emails are sent for users with `platform = 'telegram'` (they are not required to verify).
- [ ] All email sending happens asynchronously without blocking the request handler (response time < 100ms for the API call).
- [ ] The background email queue processes jobs reliably; errors are logged but do not crash the server.

---

### 🔗 Blocked By

- **#004** – The authentication module (`sb-auth`) must exist and support registration/login flows. This ticket extends that existing foundation.

---

### 🧪 Testing Notes

- **Unit tests**:
  - Mock the email sender to verify that jobs are queued and sent.
  - Test rate limiting logic.
  - Test JWT generation and verification for both flows.
- **Integration tests**:
  - Use a test database and a real Resend API (or mock with `wiremock`) to verify the full flow.
  - Test that the verification endpoint updates the user record.
  - Test that payment endpoints reject unverified users.
- **Manual testing**:
  - Register a new user, check email, click link, verify in DB.
  - Request password reset, check email, reset password, log in with new password.

---

### 📝 Implementation Hints

- **JWT tokens**: Use the existing `jsonwebtoken` crate. Add custom claims for verification and reset.
- **Queue**: Use `tokio::sync::mpsc::unbounded_channel` and spawn a single consumer task that loops and sends emails. This is simple and sufficient.
- **Resend API**: Use `reqwest` with the API key in the `Authorization: Bearer` header.
- **Rate limiting**: Use a `DashMap<String, Vec<Instant>>` to store timestamps per email; clean up old entries periodically (or on each check).
- **Email templates**: Keep the HTML simple; include the link and a brief message. For MVP, use a static HTML string.
- **Configuration**: All secrets (API keys) should be loaded from environment variables (already supported via `AuthConfig::from_env()`).
