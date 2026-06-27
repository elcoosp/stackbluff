## B2B white‑label API – partner clubs and custom branding

**Title:** B2B white‑label API – partner clubs and custom branding  
**Labels:** `backend, api, b2b, afk`  
**Blocked by:** #001 (contracts – B2BApi), #014 (club system), #039 (customisation reuse)

---

### 📌 Summary

Build a **B2B white‑label API** (Vision non‑goals Month 10) that allows partners to provision white‑labeled poker clubs, manage users, and receive real‑time game events via webhooks. Partners can embed a poker table (or iframe) with their own branding (custom logo, colours) and integrate with their own user base.

Key features:

- **Partner provisioning**: Create white‑labeled clubs with custom domains (e.g., `poker.acme.com`) and generate API keys.
- **User & balance management**: List users, add/remove chips, query balances.
- **Webhooks**: Partners register a URL to receive game events (hand completion, tournament results) signed with a shared secret.
- **Revenue share**: Track partner ID on chip purchases and club subscriptions for revenue attribution.
- **Developer portal**: OpenAPI spec (YAML) and a simple static documentation page.

---

### 🧩 Context (where to find things)

| Component | File(s) |
|-----------|---------|
| Club system | `backend/crates/sb-club/src/service.rs`, `sb-db-repos/src/club_repo.rs` |
| Customisation reuse | `backend/crates/sb-club/src/service.rs` – club settings, branding overrides. |
| Payment system | `backend/crates/sb-payment/src/service.rs` – revenue share tracking. |
| Notification / webhooks | `backend/crates/sb-contracts/src/notification_api.rs` – can be extended for webhook delivery. |
| New B2B crate | `backend/crates/sb-b2b-api/` (new) – REST endpoints, API key management, webhook dispatcher. |
| OpenAPI generation | Use `utoipa` crate to generate OpenAPI spec from Rust code. |
| Database | `backend/crates/sb-db-entities/src/partner.rs` (new entity) – stores partner info, API keys, webhook URLs, revenue share. |

---

### 🔧 What to build

#### 1. Database changes

Create a `partners` table:

```sql
CREATE TABLE partners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    api_key TEXT NOT NULL UNIQUE,
    custom_domain TEXT UNIQUE, -- optional, e.g., "poker.acme.com"
    webhook_url TEXT,
    webhook_secret TEXT,       -- shared secret for signing webhooks
    revenue_share_percent INTEGER DEFAULT 5, -- e.g., 5% of chip purchases
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

Also add a `partner_id` column to `clubs` and `payment_intents` (or a separate `revenue_shares` table) to track partner attribution.

#### 2. Backend – B2B API endpoints

Create a new crate `sb-b2b-api` with the following endpoints (all authenticated via `X-API-Key` header):

- `POST /b2b/clubs` – create a white‑labeled club
  - Request: `{ name: string, custom_domain?: string, branding?: { logo_url, primary_color, secondary_color } }`
  - Creates a club with `partner_id` set and applies branding overrides (store in `clubs.pro_settings_json`).
  - Returns: `{ club_id, api_key }` (the partner’s API key for future requests).

- `GET /b2b/users` – list users in the partner’s club(s)
  - Query params: `limit`, `offset`, `search` (by name/email).
  - Returns list of users with balances.

- `POST /b2b/credits` – add chips to a user
  - Request: `{ user_id: UUID, amount: number, reason?: string }`
  - Credits the user’s balance; tracks the transaction for revenue share.

- `POST /b2b/webhooks/register` – register a webhook URL for game events
  - Request: `{ url: string, events: ['hand_completed', 'tournament_completed'] }`
  - Stores the URL and generates a webhook secret (used to sign payloads).
  - Partners can update or delete webhooks.

#### 3. Webhook delivery system

- Extend `NotificationService` (or create a separate `WebhookService`) to dispatch events to registered webhooks.
- On each relevant event (hand completion, tournament result), build a JSON payload and send a `POST` request to the partner’s webhook URL.
- Include a signature header (e.g., `X-StackBluff-Signature: sha256(secret + payload)`).
- Retry on failure (exponential backoff, up to 3 attempts).
- Log delivery results for auditing.

#### 4. Revenue share tracking

- Add a `partner_id` column to `payment_intents` (and/or `subscription_events`).
- When a chip purchase or subscription occurs, store the `partner_id` from the club the user belongs to (or from the referrer).
- Run a monthly job to compute revenue share amounts for each partner (e.g., sum of all purchases × revenue_share_percent).
- Provide an endpoint for partners to view their revenue share reports (optional).

#### 5. Developer portal (static page)

- Serve a simple static HTML page (or Markdown) at `/b2b/docs` that:
  - Lists all endpoints with examples.
  - Includes instructions on API key generation and webhook registration.
  - Provides the OpenAPI spec download (YAML/JSON).
- The OpenAPI spec can be generated using `utoipa` from the API code.

#### 6. Custom domain and branding

- When a partner creates a club with a custom domain, the frontend (or a dedicated landing page) can be served under that domain with the club’s branding.
- The club’s branding (`logo_url`, `primary_color`, `secondary_color`) is stored in `clubs.pro_settings_json` and applied via CSS overrides (reuse customisation system from #039).

---

### ✅ Acceptance Criteria

- [ ] **Backend:**
  - [ ] Partners can create white‑labeled clubs via API; a new club is created with `partner_id` and branding.
  - [ ] API key authentication works (valid key in `Authorization` header).
  - [ ] `GET /b2b/users` returns paginated users for the partner’s clubs.
  - [ ] `POST /b2b/credits` correctly updates the user’s balance and records the transaction.
  - [ ] Webhooks are registered and events are delivered (with signatures) to partner endpoints.
  - [ ] Revenue share is tracked on chip purchases (partner_id stored in payment_intents).
  - [ ] OpenAPI spec is generated and available at `/b2b/openapi.json`.

- [ ] **Developer portal:**
  - [ ] A static documentation page is served at `/b2b/docs` with clear instructions and examples.
  - [ ] The OpenAPI spec can be downloaded and imported into tools like Postman.

- [ ] **Custom domain (optional):**
  - [ ] If a custom domain is provided, the table/landing page is accessible under that domain with partner branding (CSS overrides).

- [ ] **General:**
  - [ ] Webhooks retry on failure and log errors.
  - [ ] API key can be rotated (new endpoint `POST /b2b/api-keys/rotate`).
  - [ ] Usage tracking (e.g., number of API calls) is logged.

---

### 🔗 Blocked By

- **#001** – Contracts (B2BApi) must be defined; the trait and types should be in `sb-contracts`.
- **#014** – Club system must be fully functional (creation, memberships, settings).
- **#039** – Customisation system (branding overrides) must exist to apply partner branding.

---

### 🧪 Testing Notes

- **Unit tests** for API key generation, webhook signing, and revenue share calculations.
- **Integration tests** with a test partner, creating a club, adding a user, and verifying credits.
- **Webhook delivery tests** using a mock server (e.g., `wiremock`).
- **Manual QA**:
  - Create a partner, get an API key, create a club.
  - Add chips to a user via the API.
  - Trigger a hand completion and verify webhook delivery.

---

### 📝 Implementation Hints

- **API key generation**: Use `rand::Rng` to generate a 32‑byte hex string.
- **Webhook signing**: Use HMAC‑SHA256 with the shared secret and the raw JSON payload. Include the signature in a custom header.
- **Revenue share**: The partner ID can be derived from the club the user belongs to (if any). For non‑club users, partner_id is NULL.
- **OpenAPI generation**: Use `utoipa` with `#[derive(OpenApi)]` on the API struct. Serve the spec at a well‑known URL.
- **Developer portal**: Use a simple Markdown‑to‑HTML converter (e.g., `comrak`) or serve a pre‑built static page. For MVP, a plain HTML page with hand‑written documentation is acceptable.
