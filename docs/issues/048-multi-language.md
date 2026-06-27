## Multi‑language support – French, English, German, Spanish

**Title:** Multi‑language support – French, English, German, Spanish  
**Labels:** `frontend, backend, internationalisation, afk`  
**Blocked by:** #006 (frontend scaffold), #012 (Oracle templates)

---

### 📌 Summary

Implement internationalisation (i18n) for **four languages**: French, English, German, Spanish (Vision Month 5). Both backend and frontend must be localised:

- **Backend** (`sb-oracle`, `sb-notification`, `sb-tournament`):
  - Accept `Accept-Language` header and store the user’s locale in `users.locale` (default based on header or Telegram client language).
  - Oracle templates localised: 50+ templates × 4 languages = 200 entries. Store as JSON files (`templates_en.json`, `templates_fr.json`, `templates_de.json`, `templates_es.json`).
  - Notification text templates localised.
- **Frontend**:
  - Use **Lingui** (`@lingui/core` + `@lingui/react`) with PO or JSON files.
  - Language switcher in settings (dropdown).
  - Hand history and replay cards localised (use translated strings).
  - Season Pass and shop descriptions localised.

---

### 🧩 Context (where to find things)

| Component | File(s) |
|-----------|---------|
| User entity | `backend/crates/sb-db-entities/src/user.rs` – add `locale` column (default 'en'). |
| Oracle templates | `backend/crates/sb-oracle/assets/templates.json` – split into language‑specific files. |
| Oracle service | `backend/crates/sb-oracle/src/templates.rs` – load the correct template file based on locale. |
| Notification service | `backend/crates/sb-contracts/src/notification_api.rs` – localise notification text. |
| Tournament reminders | `backend/crates/sb-tournament/src/tournament_service.rs` – localise reminder messages. |
| Frontend i18n setup | `frontend/apps/pwa/src/i18n/` – create `lingui.config.ts`, locale JSON/PO files. |
| Frontend settings | `frontend/apps/pwa/src/pages/SettingsPage.tsx` – add language switcher. |
| Frontend components | `frontend/apps/pwa/src/components/` – use `useLingui` and `t` macro. |

---

### 🔧 What to build

#### 1. Backend – database and locale detection

- Add `locale` column to `users` table (TEXT, default 'en'):
  ```sql
  ALTER TABLE users ADD COLUMN locale TEXT NOT NULL DEFAULT 'en';
  ```
- Update the user settings API (`PATCH /users/me`) to accept and store `locale`.
- In request handlers, detect the locale:
  1. Check the `Accept-Language` header (e.g., `fr-FR,fr;q=0.9,en;q=0.8`).
  2. If the user is authenticated, use their stored `locale` (from DB).
  3. Fallback to 'en'.
- Pass the locale to all relevant services (`OracleService`, `NotificationService`, etc.).

#### 2. Backend – Oracle templates localisation

- Replace the single `templates.json` with language‑specific files:
  - `templates_en.json`
  - `templates_fr.json`
  - `templates_de.json`
  - `templates_es.json`
- The `TemplateLibrary` should load the file corresponding to the current locale.
- Each template's `output_text` must be translated into all four languages.
- Ensure the **same template structure** (rules, IDs) is maintained across all files (only the `output_text` changes).
- Add a snapshot test to verify that all 50+ templates exist in each language file.

#### 3. Backend – Notification templates localisation

- Define a set of notification templates (e.g., tournament reminders, streak alerts, referral bonuses).
- Store translations in a similar JSON structure (or use a simple string map).
- The `NotificationService` should accept a locale and format the notification text accordingly.

#### 4. Frontend – i18n setup with Lingui

- Install `@lingui/core`, `@lingui/react`, `@lingui/cli`, `@lingui/macro`.
- Create `lingui.config.ts`:
  ```typescript
  export default {
    locales: ['en', 'fr', 'de', 'es'],
    sourceLocale: 'en',
    catalogs: [
      {
        path: 'src/locales/{locale}/messages',
        include: ['src'],
      },
    ],
    format: 'po', // or 'json'
  };
  ```
- Run `lingui extract` to extract messages, `lingui compile` to compile them.
- Load the compiled catalogs in the app (using `i18n.load()` and `i18n.activate()`).

#### 5. Frontend – language switcher

- In the settings page, add a dropdown (or a select) with the four languages.
- On change, call `PATCH /users/me` with the new locale, update the Lingui `i18n` instance, and reload the UI.
- The selected language should persist across sessions (stored in `localStorage` and synced with the backend).

#### 6. Frontend – localised components

- Use the `t` macro (or `Trans` component) for all UI text:
  ```typescript
  import { t } from '@lingui/macro';
  const label = t`Welcome to StackBluff`;
  ```
- For dynamic translations (e.g., card ranks), use `t` with variables:
  ```typescript
  const rank = t`Ace`; // This will be translated
  ```
- For hand history and replay cards, ensure all text (hand descriptions, pot amounts, player names) is displayed using translated strings.

#### 7. Testing – snapshot tests

- Add a backend test that:
  - Loads all template JSON files.
  - Verifies that each template ID exists in all languages.
  - Checks that the `output_text` is not empty and contains the expected placeholders (`{hand_strength}`, `{pot_odds}`, etc.).
- Frontend tests can verify that the language switcher updates the UI correctly.

---

### ✅ Acceptance Criteria

- [ ] **Backend:**
  - [ ] `users.locale` is stored and used for all communications (Oracle, notifications).
  - [ ] Oracle templates exist for all four languages and cover the same 50+ scenarios.
  - [ ] Notification texts are localised based on the user’s locale.
  - [ ] Fallback to English works when a translation is missing.

- [ ] **Frontend:**
  - [ ] Language switcher in settings allows selecting any of the four languages.
  - [ ] All UI text (buttons, headings, labels) updates when switching languages.
  - [ ] Card ranks and suits are translated (e.g., "Ace of Spades" → "As de Pique").
  - [ ] Hand history and replay cards show localised hand names (e.g., "Full House" → "Full" in French).
  - [ ] Shop and Season Pass descriptions are translated.
  - [ ] Error messages and toasts are translated.

- [ ] **General:**
  - [ ] The selected language persists across page reloads and sessions.
  - [ ] The Oracle output is in the user’s chosen language.
  - [ ] Tournament reminders and other notifications are in the user’s language.

---

### 🔗 Blocked By

- **#006** – Frontend scaffold must be in place to add the language switcher and i18n setup.
- **#012** – Oracle templates must exist (even if only in English) so we can create the translated versions.

---

### 🧪 Testing Notes

- **Snapshot test** (backend): Verify all template IDs exist in all language files.
- **Unit tests** (backend): Test locale detection (Accept-Language header, user preference, fallback).
- **Unit tests** (frontend): Test the language switcher and Lingui integration.
- **E2E tests** (Playwright): Switch languages and verify that UI text changes.
- **Manual QA**: Verify that Oracle output, notifications, and all UI elements are localised in each language.

---

### 📝 Implementation Hints

- **Backend locale detection**: Use `Accept‑Language` parsing (e.g., `reqwest::header::AcceptLanguage` or a simple parser). For simplicity, we can store the locale in the user session and use it for all requests.
- **Oracle templates**: The 50+ templates are defined in `templates.json`. Translating them is a manual task. Consider using a translation service (like DeepL) for the initial translation, then refine manually.
- **Frontend i18n (Lingui)**:
  - Add `lingui` scripts to `package.json`:
    ```json
    "scripts": {
      "extract": "lingui extract",
      "compile": "lingui compile"
    }
    ```
  - Run `extract` to pull all `t` and `Trans` messages into `.po` files.
  - Translate the `.po` files (or use a translation service).
  - Run `compile` to generate the compiled catalogs.
- **Card rank translation**: Create a mapping function in Lingui:
  ```typescript
  import { t } from '@lingui/macro';
  const rankMap = {
    Ace: t`Ace`,
    King: t`King`,
    // ...
  };
  ```
- **Placeholders**: In Oracle templates, the placeholders (`{hand_strength}`, `{pot_odds}`) must remain untranslated; only the surrounding text changes. Ensure this is clear to translators.
