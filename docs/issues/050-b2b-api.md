---
title: B2B white‑label API – partner clubs and custom branding
labels: backend, api, b2b, afk
blocked_by: 001, 014, 039
---

## What to build

White‑label API for B2B partners (Vision non‑goals Month 10) – Agent 1:

- New crate `sb-b2b-api` with REST endpoints:
  - `POST /b2b/clubs` – create a white‑labeled club with custom domain (e.g., `poker.acme.com`). Returns API key.
  - `GET /b2b/users` – list users, balances.
  - `POST /b2b/credits` – add chips to a user.
  - Webhook registration: partners can register a URL to receive game events (hand completion, tournament results).
- Partner authentication via API key (in `Authorization` header).
- Revenue share tracking: store partner ID on chip purchases and club subscriptions.
- Documentation: OpenAPI spec (YAML) and a simple developer portal (static page).

## Acceptance criteria

- [ ] Partner can provision a white‑label club via API; club appears in system with `partner_id`.
- [ ] Embedded iframe (or widget) displays poker table with partner's branding (custom logo, colours via CSS overrides).
- [ ] Webhook delivers hand results to partner's endpoint (signed with shared secret).
- [ ] API key rotation and usage tracking implemented.

## Blocked by

#001 (contracts – B2BApi), #014 (club system), #039 (customisation reuse)
