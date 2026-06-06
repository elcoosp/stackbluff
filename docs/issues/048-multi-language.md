---
title: Multi‑language support – French, English, German, Spanish
labels: frontend, backend, internationalisation, afk
blocked_by: 006
---

## What to build

Implement i18n for four languages (from Vision non‑goals – Month 5):

- Backend: `Accept-Language` header or user preference stored in `users.locale`.
- Oracle templates localised (50+ templates × 4 languages = 200 entries minimum).
- Frontend: i18n library (e.g., `react-i18next`). All UI text in JSON translation files.
- Language switcher in settings (default: browser language or Telegram client language).
- Hand history and replay cards localised (card text, result descriptions).
- Season Pass and shop descriptions localised.

## Acceptance criteria

- [ ] User selects "Deutsch" → all UI text, Oracle output, and notifications in German.
- [ ] Oracle templates for all four languages cover the same 50+ scenarios.
- [ ] Fallback to English for missing translations.
- [ ] Leaderboard and hand histories show localised card/rank names.

## Blocked by

#006 (frontend scaffold), #012 (Oracle templates)
