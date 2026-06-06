---
title: Frontend lobby UI and table creation flow
labels: frontend, ui, afk
blocked_by: 006, 007
---

## What to build

Agent 2 implements the lobby page for both PWA and Mini App:

- `LobbyPage` component (shared) that calls `GET /lobby` and displays a list of tables using shadcn/ui cards.
- "Create Table" button opens a modal with stake level selector (6 options) and max players (2‑9).
- On submit, calls `POST /tables`, then navigates to `table/:id` route.
- Zustand store (`useTableStore`) caches the lobby list and refreshes every 30 seconds.
- Use `PlatformAPI` for any platform‑specific navigation (Telegram back button, etc.).

## Acceptance criteria

- [ ] Lobby loads and shows tables within 500ms (skeleton fallback).
- [ ] Create Table modal validates inputs (max players 2‑9, stake selected).
- [ ] After creation, user is redirected to table view with correct `table_id`.
- [ ] UI is responsive and respects dark mode (Tailwind CSS v4).

## Blocked by

#006 (frontend scaffold), #007 (backend endpoints)
