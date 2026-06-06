---
title: Multi‑language support – French, English, German, Spanish
labels: frontend, backend, internationalisation, afk
blocked_by: 006
---

## What to build

Implement i18n for four languages (Vision Month 5) – Agent 2 + Agent 1:

- **Backend** (`sb-oracle`, `sb-notification`, `sb-tournament`):
  - Accept `Accept-Language` header; store user’s locale in `users.locale` (default based on header or Telegram client language).
  - Oracle templates localised: 50+ templates × 4 languages = 200 entries. Store as JSON files (`templates_en.json`, `templates_fr.json`, etc.).
  - Notification text templates localised.
- **Frontend**:
  - Use `react-i18next` with language JSON files.
  - Language switcher in settings (dropdown).
  - Hand history and replay cards localised (use translated strings).
  - Season Pass and shop descriptions localised.

## Acceptance criteria

- [ ] User selects "Deutsch" → all UI text, Oracle output, and notifications in German.
- [ ] Oracle templates for all four languages cover the same 50+ scenarios (verified by snapshot test).
- [ ] Fallback to English for missing translations.
- [ ] Leaderboard and hand histories show localised card/rank names (e.g., "As" vs "Ace").

## Blocked by

#006 (frontend scaffold), #012 (Oracle templates)
