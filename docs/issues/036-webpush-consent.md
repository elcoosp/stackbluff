## Web Push consent prompt and subscription management

**Title:** Web Push consent prompt and subscription management  
**Labels:** `frontend, notifications, afk`  
**Blocked by:** #006 (frontend settings page), #021 (backend subscription endpoint)

---

### 📌 Summary

Implement the Web Push consent flow for the PWA (REQ-FUNC-111, REQ-NFR-COMP-001). This includes:

- A non‑intrusive prompt displayed after the user’s first game completion (or a relevant engagement event) asking for permission to send push notifications (tournament reminders, streak alerts, etc.).
- If the user allows, the browser’s `Notification.requestPermission()` is called, and the resulting push subscription is sent to the backend at `POST /notifications/subscribe` (implemented in #021).
- If the user denies, the prompt is never shown again (stored in `localStorage`).
- A settings page (linked from the user profile) where the user can enable/disable notifications, re‑prompt, or update their subscription.
- A **cookie consent banner** (REQ-NFR-COMP-001) that must be accepted before any non‑essential tracking (e.g., analytics). Analytics events fire only after explicit consent (stored in `localStorage`).

---

### 🧩 Context (where to find things)

| Component | File(s) |
|-----------|---------|
| Settings page | `frontend/apps/pwa/src/pages/SettingsPage.tsx` (existing from #006) |
| User profile / navigation | `frontend/apps/pwa/src/components/Header.tsx` (profile dropdown) |
| Notification service (client) | `frontend/apps/pwa/src/services/notificationService.ts` (create) |
| API client | `frontend/apps/pwa/src/lib/api.ts` (uses `@stackbluff/shared/api/client`) |
| Analytics | Use `window.plausible` or a custom analytics wrapper; check for consent before firing. |
| State management | `frontend/apps/pwa/src/stores/consentStore.ts` (create) for notification and cookie consent. |
| Web Push library | Use `web-push` (already in backend) – frontend uses the native Push API. |

---

### 🔧 What to build

#### 1. Notification permission prompt

- The prompt should appear **after the first game hand completes** (i.e., after the user has played their first hand). This can be triggered by the `useGameFeedback` hook or by listening to the `HandResult` event from the WebSocket.
- Show a non‑intrusive toast or modal (e.g., using `sonner` toast with an action button, or a small `Dialog`).
- The prompt should say: *“Get tournament reminders and streak alerts. Allow notifications?”* with **Allow** and **Deny** buttons.
- If **Allow**:
  - Call `Notification.requestPermission()`.
  - If permission is granted, call the backend to store the subscription (see step 3).
- If **Deny**:
  - Store `notification_consent = 'denied'` in `localStorage` and never show the prompt again.
- If the user clicks **“Maybe later”**, store a flag and show the prompt again on the next hand (or after 24 hours).

#### 2. Cookie consent banner

- Show a banner (bottom‑fixed) on the first visit (check `cookie_consent` in `localStorage`).
- The banner should state: *“We use cookies for analytics and to improve your experience. By clicking ‘Accept’, you consent to our use of cookies.”* with **Accept** and **Decline** buttons.
- If **Accept**, set `cookie_consent = true` in `localStorage` and allow analytics events (e.g., Plausible, Google Analytics, or custom events).
- If **Decline**, set `cookie_consent = false`; analytics events are not fired.
- The banner should be dismissible only via Accept/Decline (no close button).

#### 3. Backend subscription endpoint (client side)

- After permission is granted, the frontend must:
  - Convert the `PushSubscription` object to JSON (using `JSON.stringify`).
  - Send a `POST` request to `/notifications/subscribe` with:
    ```json
    { "subscription": { "endpoint": "...", "keys": { "p256dh": "...", "auth": "..." } } }
    ```
  - Use the `apiClient` (or `fetch`) with authentication.
- The backend (#021) will store the subscription and use it to send push notifications.

#### 4. Settings page integration

- In the existing settings page (from #006), add a **Notifications** section:
  - Show current permission status: `Enabled`, `Blocked`, or `Not set`.
  - A toggle button (or switch) to enable/disable notifications.
  - If the user has blocked notifications, clicking the toggle could prompt them to change permissions in the browser settings (or show a guide).
  - If permission is granted, allow the user to **update** their subscription (e.g., if they switch browsers, they can re‑subscribe).
- Store the user’s preference (push enabled) in `localStorage` or on the backend (but the backend already has the subscription).

#### 5. Analytics consent guard

- Wrap all analytics event calls with a check:
  ```typescript
  if (localStorage.getItem('cookie_consent') === 'true') {
    // fire analytics event
  }
  ```
- For Plausible, you can use `window.plausible?.('event', { ... })` only when consent is given.

---

### ✅ Acceptance Criteria

- [ ] After the first game hand, a notification permission prompt appears (non‑intrusive) with Allow/Deny buttons.
- [ ] If **Allow**, the browser prompts for permission; if granted, the subscription is sent to the backend and stored.
- [ ] If **Deny**, the prompt never appears again (checked via `localStorage`).
- [ ] The cookie consent banner appears on the first visit and blocks analytics events until accepted.
- [ ] After accepting the cookie banner, analytics events (e.g., page views, custom events) are fired.
- [ ] The settings page shows the current notification status and allows the user to toggle or update their subscription.
- [ ] The entire flow works in both PWA and browser (desktop/mobile).
- [ ] No errors are thrown if the Push API is not supported (e.g., Safari on iOS < 16.4) – the prompt is skipped and a fallback message is shown.

---

### 🔗 Blocked By

- **#006** – The frontend settings page must exist and be accessible from the profile.
- **#021** – The backend subscription endpoint must be implemented and ready to accept push subscriptions.

---

### 🧪 Testing Notes

- **Unit tests**:
  - Mock `Notification.requestPermission` and test the Allow/Deny flow.
  - Test that the consent flags are correctly saved in `localStorage`.
- **Integration tests**:
  - Simulate a hand completion and verify the prompt appears.
  - Verify that the subscription is sent to the backend when allowed.
- **Manual testing**:
  - Test in Chrome (push supported), Firefox, and Safari (with/without push support).
  - Verify that analytics events are only fired after cookie consent.
  - Test the settings page toggle and re‑subscription.

---

### 📝 Implementation Hints

- **Notification permission prompt**: Use a `Dialog` with a gentle animation (from `framer-motion`). Alternatively, use `sonner` with a custom action button.
- **Subscription handling**: Use the `navigator.serviceWorker` API to get the subscription; if no service worker exists, create one (or reuse the existing one from the PWA setup).
- **Service worker**: The PWA already has a service worker; extend it to handle push events.
- **Consent store**: Create a Zustand store for consent management with methods to check and set consent.
- **Analytics**: If using Plausible, the script is loaded conditionally; ensure the analytics code respects the consent flag.

---

This issue provides a clear, self‑contained specification for the Web Push consent flow and cookie consent banner, aligned with the existing frontend and backend infrastructure.
