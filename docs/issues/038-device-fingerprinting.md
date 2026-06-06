---
title: Device fingerprinting for anti‑cheat collusion detection
labels: backend, anti-cheat, afk
blocked_by: 016
---

## What to build

Enhance `sb-anti-cheat` crate with device fingerprinting (REQ-FUNC-101):

- **Frontend** (Agent 2): Collect fingerprint components: screen resolution, timezone, WebGL vendor/renderer, list of fonts (using `document.fonts`), platform, language. Hash them (e.g., SHA‑256) and send as `fingerprint_hash`.
- **Backend**: On login and before each game session, client calls `POST /anti-cheat/fingerprint` with the hash.
- Store fingerprint in `device_fingerprints` table linked to `user_id` (with timestamp).
- Flag accounts that share the same IP and fingerprint playing heads‑up ≥5 times in 24 hours (use existing collusion detection from #016, augmented with fingerprint match).
- Flagged accounts are placed under review; no automatic ban.

## Acceptance criteria

- [ ] Two accounts with identical fingerprint and same IP playing 5 HU sessions → flag created in `anti_cheat_events`.
- [ ] No false positives for different fingerprints on same IP (e.g., public WiFi).
- [ ] Flagged accounts are not automatically banned; admin API can review.
- [ ] Frontend collects fingerprint without blocking game start (<50ms overhead, async).

## Blocked by

#016 (anti‑cheat core exists)
