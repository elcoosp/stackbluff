---
title: Final spec compliance audit and performance optimisation
labels: qa, performance, compliance, afk
blocked_by: 001, 002, 003, 004, 005, 006, 007, 008, 009, 010, 011, 012, 013, 014, 015, 016, 017, 018, 019, 020, 021, 022, 023, 024, 025, 026, 027, 028, 029, 030, 031, 032, 033, 034, 035, 036, 037, 038, 039, 040, 041, 042, 043, 044, 045, 046, 047, 048, 049, 050, 051
---

## What to build

Final compliance audit and performance optimisation (closing all open requirements):

- Run full regression test suite (all TC‑xxx from verification plan).
- Verify all REQ-FUNC, REQ-NFR, and BR requirements are satisfied (traceability matrix updated).
- Load test: 5,000 concurrent tables, 15,000 players, verify p99 latency < 50ms (REQ-NFR-PERF-002).
- Security audit: OWASP top 10, dependency advisories (`cargo deny`, `pnpm audit`).
- GDPR compliance check: data deletion, consent logs, PII masking in logs.
- Performance optimisation: SQLite WAL checkpoint tuning, WebSocket message batching, asset compression.
- Generate final compliance report (`docs/compliance-report.md`).

## Acceptance criteria

- [ ] All Must Have and Should Have requirements marked "verified".
- [ ] Load test passes for 5,000 concurrent tables on Hetzner CAX11.
- [ ] No high‑severity security advisories in dependencies.
- [ ] GDPR deletion test passes (user requests deletion, data anonymised within 30 days).
- [ ] Lighthouse score ≥ 90 for both PWA and Mini App on mobile 4G.

## Blocked by

All previous issues (001‑051) – must be complete before audit.
