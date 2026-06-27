## Device fingerprinting for anti‑cheat collusion detection

**Title:** Device fingerprinting for anti‑cheat collusion detection  
**Labels:** `backend, anti-cheat, afk`  
**Blocked by:** #016 (anti‑cheat core exists)

---

### 📌 Summary

Enhance the anti‑cheat system to detect collusion (multi‑accounting) by combining **IP address** and **device fingerprint** hashes. The client collects a set of browser/device characteristics, hashes them, and sends the hash to the backend on login and before each game session. The backend stores fingerprint records linked to the user and uses them, together with IP data, to flag accounts that repeatedly play heads‑up against each other from the same device and IP.

This extends the existing `ip_collusion` module (from #016) to include a fingerprint match as an additional signal for suspicious activity.

No automatic bans are applied; flagged accounts are placed under review (admin API later).

---

### 🧩 Context (where to find things)

| Component | File(s) |
|-----------|---------|
| Anti‑cheat core | `backend/crates/sb-anti-cheat/src/lib.rs`, `service.rs`, `ip_collusion.rs` |
| Rate limiter | `backend/crates/sb-anti-cheat/src/rate_limiter.rs` (not directly used, but available) |
| Database entities | `backend/crates/sb-db-entities/src/entities/anti_cheat_events.rs` (existing event log) |
| New table needed | `device_fingerprints` (create migration) |
| REST endpoint | `backend/crates/sb-rest-router/src/anti_cheat_routes.rs` (or add to existing router) |
| Frontend (Agent 2) | `frontend/apps/pwa/src/services/fingerprint.ts` (new service) |
| WebSocket / HTTP | The fingerprint can be sent via HTTP POST (non‑critical) before joining a table, or piggybacked on the WebSocket connection. |

---

### 🔧 What to build

#### 1. Database migration

Create a new table `device_fingerprints`:

```sql
CREATE TABLE device_fingerprints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    fingerprint_hash TEXT NOT NULL,   -- SHA‑256 hex string
    ip TEXT NOT NULL,                 -- IP address at time of submission
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, fingerprint_hash) -- one record per (user, device)
);
```

Create migration `m20260630_create_device_fingerprints.rs` and register it.

Also consider an index on `(fingerprint_hash, ip)` for efficient lookups.

#### 2. Backend – fingerprint storage endpoint

Add a new route: `POST /anti-cheat/fingerprint`

- Request body: `{ fingerprint_hash: string }` (hex SHA‑256 of the client‑collected fingerprint).
- Authentication required (via `AuthUser`).
- Insert or update the `device_fingerprints` record for the user (if the same fingerprint already exists, update `created_at`/`ip`).
- Return `{ status: 'ok' }`.

#### 3. Extend collusion detection

In `AntiCheatServiceImpl::record_heads_up`:

- Currently it uses `IpCollusionTracker` which tracks heads‑up sessions per IP per 24h.
- Augment this to also check if the two users **share the same fingerprint** (i.e., both have a recent fingerprint record with the same hash).
- Use the `device_fingerprints` table to query: get the current fingerprint for each user (the most recent record). If they have the same hash and the IP matches, then it's a stronger collusion signal.
- The existing `IpCollusionTracker` already counts heads‑up sessions. We can introduce a second counter that only counts sessions where both fingerprint and IP match.
- When the threshold (5 sessions in 24h) is reached, log an event in `anti_cheat_events` with `event_type = 'collusion_flag'` and `details = 'same IP and device fingerprint'`.

#### 4. Client‑side fingerprint collection (Frontend – Agent 2)

- Create a service `frontend/apps/pwa/src/services/fingerprint.ts`.
- Collect the following components:
  - `screen_resolution` (window.screen.width × height)
  - `timezone` (Intl.DateTimeFormat().resolvedOptions().timeZone)
  - `platform` (navigator.platform)
  - `language` (navigator.language)
  - `user_agent` (navigator.userAgent)
  - `webgl_vendor` and `webgl_renderer` (from WebGL context)
  - `fonts` (list of installed fonts using `document.fonts` – async, may take time)
- Hash the concatenated string using SHA‑256 (via the Web Crypto API).
- The collection should be non‑blocking (use `requestIdleCallback` or a background task) and take < 50ms overhead.
- On login and before joining a table (or on first hand), send the hash to `POST /anti-cheat/fingerprint`.

#### 5. Admin review (future)

- The flagging only creates events; no automatic ban.
- An admin dashboard (not part of this ticket) can review flagged accounts.

---

### ✅ Acceptance Criteria

- [ ] **Backend:**
  - [ ] `POST /anti-cheat/fingerprint` stores or updates the fingerprint record for the authenticated user.
  - [ ] The collusion detection (`record_heads_up`) now checks for matching fingerprints.
  - [ ] If two users have the same IP and same fingerprint hash and play ≥5 heads‑up games in 24h, an `anti_cheat_events` entry is created with `event_type = 'collusion_flag'`.
  - [ ] No false positives: different fingerprints on the same IP are not flagged (the system only flags when both IP and fingerprint match).
- [ ] **Frontend:**
  - [ ] The fingerprint collection runs asynchronously and does not block the UI.
  - [ ] The SHA‑256 hash is sent to the backend on login and before the first game session.
  - [ ] The hash is consistent across browser sessions for the same device (i.e., the same components produce the same hash).
- [ ] **General:**
  - [ ] The system does not auto‑ban; only flags for manual review.

---

### 🔗 Blocked By

- **#016** – The anti‑cheat core (IP collusion tracking) must be in place. This ticket extends that functionality.

---

### 🧪 Testing Notes

- **Unit tests** for the fingerprint storage and collusion check (mock the database).
- **Integration tests** using two test users with the same IP and fingerprint to simulate collusion.
- **Frontend tests** verifying that the fingerprint collection produces a consistent hash and is sent correctly.
- **Performance test**: ensure fingerprint collection does not impact the initial load or game start (< 50ms overhead).

---

### 📝 Implementation Hints

- **Hashing**: Use the Web Crypto API (`crypto.subtle.digest('SHA-256', data)`). Convert to hex.
- **Fingerprint components**: The list of fonts can be heavy; use a timeout (e.g., 500ms) and fallback to an empty string if not ready.
- **Rate limiting**: The endpoint itself is rate‑limited via the existing `check_auth_rate` (IP limit) – no additional rate limiting needed.
- **Collusion logic**: The `IpCollusionTracker` currently stores sessions in memory. To avoid persistence issues, the fingerprint check should query the `device_fingerprints` table directly (or use a cached version). For simplicity, we can read the current fingerprint for each user from the database when `record_heads_up` is called.
- **SQL index**: Add an index on `(fingerprint_hash, ip)` to speed up the collusion queries.

---

This issue provides a clear specification for both backend and frontend agents, ensuring a robust device fingerprinting system integrated with the existing anti‑cheat infrastructure.
