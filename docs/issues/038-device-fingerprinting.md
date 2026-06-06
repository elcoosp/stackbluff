---
title: Device fingerprinting for anti‑cheat collusion detection
labels: backend, anti-cheat, afk
blocked_by: 016
---

## What to build

Enhance anti‑cheat module with device fingerprinting (REQ-FUNC-101):

- Collect from frontend: screen resolution, timezone, WebGL vendor, list of fonts, platform, language.
- Send fingerprint on login and before each game session (via `POST /anti-cheat/fingerprint`).
- Store fingerprint hash in `device_fingerprints` table linked to user.
- Flag accounts that share the same IP and fingerprint playing heads‑up ≥5 times in 24 hours.

## Acceptance criteria

- [ ] Two accounts with identical fingerprint and same IP playing 5 HU sessions → flag created.
- [ ] No false positives for different fingerprints on same IP (e.g., public WiFi).
- [ ] Flagged accounts are placed under review; no automatic ban.
- [ ] Frontend collects fingerprint without blocking game start (<50ms overhead).

## Blocked by

#016 (anti‑cheat core exists)
