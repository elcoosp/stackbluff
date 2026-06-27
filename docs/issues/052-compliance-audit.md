## Final spec compliance audit and performance optimisation

**Title:** Final spec compliance audit and performance optimisation  
**Labels:** `qa, performance, compliance, afk`  
**Blocked by:** All previous issues (001‑051) – this is the final validation and closure task.

---

### 📌 Summary

Perform a **final compliance audit and performance optimisation** across the entire StackBluff codebase. This is the closing milestone after all other features and fixes are complete. The goal is to:

1. **Verify all requirements** (REQ-FUNC, REQ-NFR, BR) are satisfied and update the traceability matrix.
2. **Run full regression tests** using the verification plan (all TC-xxx test cases) with `cargo nextest` and `vitest`.
3. **Load test** the system with 5,000 concurrent tables and 15,000 players, ensuring p99 latency < 50ms (REQ-NFR-PERF-002) using a `k6` script.
4. **Security audit**: OWASP Top 10, dependency checks (`cargo deny`, `pnpm audit`), and manual code review.
5. **GDPR compliance check**: test data deletion flow, consent logs, and ensure no PII leakage in logs.
6. **Performance optimisation**: SQLite WAL checkpoint tuning, WebSocket message batching, asset compression (Brotli), and other low‑hanging improvements.
7. **Generate a final compliance report** (`docs/compliance-report.md`) and handover to the founder.

This ticket is the **final gate** before the product can be considered production‑ready.

---

### 🧩 Context (where to find things)

| Component | File(s) |
|-----------|---------|
| Traceability matrix | `docs/traceability.md` (create/update) |
| Test suite | `backend/` (cargo tests), `frontend/` (vitest, Playwright) |
| Load test script | `scripts/load-test.k6.js` (new) – use k6 |
| Security audit | `cargo deny` (already in CI), `pnpm audit`, manual review |
| GDPR | `backend/crates/sb-gdpr/` (if exists) or relevant deletion logic |
| Performance optimisation | `backend/Cargo.toml` (dependencies), `frontend/vite.config.ts` (compression) |
| Final report | `docs/compliance-report.md` (create) |

---

### 🔧 What to build / do

#### 1. Update traceability matrix

- Review all requirements documents (spec, BR, NFR) and map them to implemented features.
- Mark each requirement as `verified` (with a reference to the test case that covers it) or `not implemented` (if any are missing – they should be addressed before this audit).
- The matrix should be a Markdown table:
  ```markdown
  | Requirement ID | Description | Implemented? | Test Case | Status |
  |----------------|-------------|--------------|-----------|--------|
  | REQ-FUNC-001   | ...         | Yes          | TC-001    | ✅ Verified |
  ```

#### 2. Full regression test suite

- Run **all** unit, integration, and end‑to‑end tests:
  - Backend: `cargo nextest run --workspace`
  - Frontend: `pnpm test` (vitest) and `pnpm test:e2e` (Playwright)
- Verify that all TC-xxx test cases from the verification plan are executed and pass.
- Document any failures and fix them before proceeding.

#### 3. Load test (5,000 concurrent tables, 15,000 players)

- Write a k6 script (`scripts/load-test.k6.js`) that:
  - Simulates users joining tables, playing hands, and leaving.
  - Ramps up to 15,000 virtual users and 5,000 tables over 10 minutes.
  - Measures p99 latency for WebSocket messages and HTTP API calls.
- Run the test against a staging environment with Hetzner CAX11 (2 vCPU, 4 GB RAM) as specified.
- Ensure p99 latency < 50ms for game actions (REQ-NFR-PERF-002).
- If the target is not met, profile and optimise (see step 6).

#### 4. Security audit

- **Dependency scanning**:
  - Backend: `cargo deny check` (advisories, licenses).
  - Frontend: `pnpm audit` and `pnpm audit --fix`.
  - Ensure no high‑severity vulnerabilities.
- **OWASP Top 10**:
  - Review authentication (JWT handling, session management).
  - Check for injection vulnerabilities (SQL via SeaORM – should be safe if using prepared statements; verify).
  - Validate CORS and WebSocket security.
  - Ensure encryption in transit (TLS) is enforced.
  - Check for rate limiting (already in `sb-anti-cheat`).
- **Manual review**: inspect critical code paths for security issues.

#### 5. GDPR compliance check

- **Data deletion flow**: manually test the `DELETE /users/me` flow and ensure:
  - The user is flagged for deletion.
  - The background job correctly anonymises PII in all tables.
  - No email/telegram/name is left in hot tables.
- **Consent logs**: verify that cookie and notification consent are stored and respected.
- **Logging**: scan logs for PII patterns (email, telegram ID) and ensure they are masked (e.g., using `tracing` with `#[sensitive]`).
- **Document** the GDPR compliance measures in the final report.

#### 6. Performance optimisation

- **SQLite WAL checkpoint**:
  - Verify that `PRAGMA journal_mode=WAL` is enabled.
  - Adjust checkpoint intervals to reduce I/O (e.g., `PRAGMA wal_autocheckpoint=1000`).
- **WebSocket message batching**:
  - Ensure that multiple messages sent in quick succession are batched to reduce network overhead (e.g., combine state updates).
- **Asset compression**:
  - Enable Brotli compression in the frontend build (Vite).
  - Enable gzip/Brotli on the backend static file serving (if any).
- **Database queries**:
  - Review slow queries (using `EXPLAIN`) and add indexes where missing.
  - Ensure the `leaderboard_global_mv` refresh is efficient.
- **Caching**:
  - Check that the `moka` cache is used for frequent queries (user profiles, club settings).

#### 7. Lighthouse score

- Run Lighthouse on both the PWA (mobile 4G) and the Mini App (which is essentially the PWA in a WebView).
- Ensure score ≥ 90 for Performance, Accessibility, Best Practices, and SEO.
- Optimise if needed (image compression, lazy loading, code splitting).

#### 8. Final compliance report

- Compile all findings into `docs/compliance-report.md`.
- Include:
  - Summary of verified requirements.
  - Load test results (latency, throughput).
  - Security audit findings (and fixes applied).
  - GDPR compliance statement.
  - Performance optimisation actions taken.
  - Any remaining open issues (with severity and plan).
- Present the report to the founder (via email or a meeting).

---

### ✅ Acceptance Criteria

- [ ] All Must Have and Should Have requirements are marked "verified" in `traceability.md`.
- [ ] `cargo nextest` and `vitest` pass with 0 failures.
- [ ] Load test with 5,000 concurrent tables and 15,000 players shows p99 latency < 50ms.
- [ ] `cargo deny` and `pnpm audit` show no high‑severity advisories.
- [ ] GDPR deletion test passes (user requests deletion, data anonymised within 30 days; verified by manual query).
- [ ] Lighthouse score ≥ 90 on mobile 4G for both PWA and Mini App.
- [ ] Final compliance report is delivered to the founder, and all action items are resolved or documented.

---

### 🔗 Blocked By

All previous issues (001‑051). This ticket cannot start until all Must Have features are implemented and integrated.

---

### 🧪 Testing Notes

- The load test should be run in a dedicated staging environment that matches the production specification (Hetzner CAX11).
- Use a test dataset with realistic hand histories and tournament data.
- For the security audit, use tools like `cargo audit` (not just `deny`) and `npm audit`.
- For GDPR, manual testing is acceptable, but also include an automated test that checks for PII in logs.

---

### 📝 Implementation Hints

- **k6 script**: Use the k6 WebSocket API to simulate players. Keep the script simple: players join, check action, fold after a few seconds.
- **SQLite tuning**: The WAL checkpoint can be adjusted via `PRAGMA` statements. Add a startup hook to set these.
- **Asset compression**: In Vite, use `vite-plugin-compression` for Brotli/gzip.
- **Lighthouse**: Run it via the CLI or use the Lighthouse CI GitHub Action.
