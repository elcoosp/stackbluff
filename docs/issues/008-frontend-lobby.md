---
title: Frontend lobby UI and table creation flow
labels: frontend, ui, afk
blocked_by: 006, 007
---

## What to build

Agent 2 implements the lobby page for both PWA and Mini App:

- `LobbyPage` component that calls `GET /lobby` and displays a list of tables using shadcn/ui cards.
- A “Create Table” button opens a modal with stake level selection (6 options) and max players (2‑9).
- On submit, calls `POST /tables`, then navigates to the table view with the new `table_id`.
- Use Zustand store (`useTableStore`) to cache the lobby list and refresh every 30 seconds.

## Acceptance criteria

- [ ] Lobby loads and shows tables within 500ms.
- [ ] Create Table modal shows validation (max players ≥2 ≤9).
- [ ] After creation, user is redirected to `table/:id` route.
- [ ] UI works identically on PWA and Telegram Mini App (responsive, dark mode).

## Blocked by

#006 (monorepo), #007 (backend endpoints exist)
