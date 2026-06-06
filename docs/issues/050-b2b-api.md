---
title: B2B white‑label API – partner clubs and custom branding
labels: backend, api, b2b, afk
blocked_by: 001, 014, 039
---

## What to build

White‑label API for B2B partners (Vision non‑goals Month 10):

- REST API endpoints for partners to:
  - Create white‑labeled clubs with custom domain (e.g., `poker.acme.com`).
  - Manage users and chip balances.
  - Embed table widgets in their own website (iframe).
  - Webhook notifications for game events (hand completion, tournament results).
- Partner authentication via API keys (separate from user auth).
- Revenue share: partner pays monthly fee + % of chip sales (configurable).
- Documentation: OpenAPI spec and developer portal.

## Acceptance criteria

- [ ] Partner can provision a white‑label club via API.
- [ ] Embedded iframe displays poker table with partner's branding.
- [ ] Webhook delivers hand results to partner's endpoint.
- [ ] API key rotation and usage tracking implemented.

## Blocked by

#001 (contracts), #014 (club system), #039 (customisation reuse)
