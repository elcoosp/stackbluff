## Native iOS/Android wrapper – React Native build

**Title:** Native iOS/Android wrapper – React Native build  
**Labels:** `frontend, mobile, afk`  
**Blocked by:** #006 (frontend monorepo – PWA already works)

---

### 📌 Summary

Package the existing web app as **native iOS and Android apps** using **React Native** (Vision Month 6). Instead of Capacitor, we port the frontend to React Native while sharing the maximum amount of code (business logic, state management, API clients, and shared UI components) via the existing monorepo structure.

Key approach:

- Create a new app `frontend/apps/mobile` using React Native (with Expo or bare).
- Share core logic (Zustand stores, API client, WebSocket hooks, utility functions) from `@stackbluff/shared` in a React Native‑compatible way.
- Reuse UI components where possible (via a design system that works on both web and mobile), but rebuild the game table and navigation with React Native primitives (View, Text, etc.) for native performance and feel.
- Implement **native push notifications** via Firebase Cloud Messaging (Android) and APNS (iOS), as a fallback for Web Push (which only works on the PWA).
- Use **React Native In‑App Purchase** (`react-native-iap`) for App Store / Google Play payments (instead of Stripe on mobile).
- Keep the same WebSocket backend for real‑time game updates.
- CI/CD: GitHub Actions builds `.ipa` and `.apk` on tag, optionally upload to TestFlight / Internal Track.

---

### 🧩 Context (where to find things)

| Component | File(s) |
|-----------|---------|
| Shared code (stores, API, hooks) | `frontend/packages/shared/` – already used by PWA. |
| Web‑specific components (DOM) | `frontend/apps/pwa/src/components/` – not reusable directly; need native equivalents. |
| React Native app | `frontend/apps/mobile/` (new) |
| Native push notifications | `react-native-push-notification` or Expo Notifications. |
| In‑app purchases | `react-native-iap`. |
| WebSocket | Reuse the same `useGameWebSocket` hook (needs to work in RN). |
| CI/CD | `.github/workflows/mobile.yml` (new). |

---

### 🔧 What to build

#### 1. Project setup

- Create `frontend/apps/mobile` with React Native (Expo or bare). Expo is recommended for faster iteration.
- Configure the monorepo to support the new app (update `pnpm‑workspace.yaml` or `turbo.json`).
- Set up environment variables for API endpoints and WebSocket URL.

#### 2. Shared code extraction

- Move all **platform‑agnostic** code from `frontend/apps/pwa` to `frontend/packages/shared`:
  - Zustand stores (`gameStore`, `authStore`, `tournamentStore`, etc.)
  - API client (`@stackbluff/shared/api/client`)
  - WebSocket hook (`useGameWebSocket`) – must be React Native‑compatible (no `window`). Use `react-native-websocket` or the built‑in `WebSocket` (which works in RN).
  - Utility functions (formatting, seat positions, card rendering logic).
- Create a **design system** package (`@stackbluff/ui`) that exports components that work on both web and native (using `react-native-web` or platform‑specific files). For MVP, we can have separate implementations but share the same API.

#### 3. Mobile‑specific UI

- Build the game table view using React Native:
  - Use `react-native-svg` for card rendering.
  - Use `react-native-gesture-handler` and `react-native-reanimated` for smooth animations (chips, card dealing).
  - Use `react-native-safe-area-context` for proper layout.
- Rebuild navigation (stack navigator with `@react-navigation/native`).
- Rebuild the lobby, profile, shop, and settings pages with RN components.

#### 4. Native push notifications

- Use `expo-notifications` (if using Expo) or `react-native-push-notification`.
- Implement a `NotificationService` that registers the device for push notifications (FCM/APNS) and sends the push token to the backend via `POST /notifications/register` (same endpoint as Web Push).
- When a notification is received, handle it appropriately (e.g., navigate to tournament or table).

#### 5. In‑app purchases

- Use `react-native-iap` to integrate App Store and Google Play in‑app purchases.
- Define product IDs (e.g., `chips_10k`, `season_pass`, `club_pro`) that match the backend product IDs.
- On purchase, call the backend `POST /payments/create-intent` with `provider: 'iap'` (or similar) and pass the transaction receipt for verification.
- The backend verifies the receipt and credits the chips/entitlements.

#### 6. CI/CD pipeline

- Add a GitHub Actions workflow that:
  - Builds the React Native app using Expo EAS (or `fastlane` for bare).
  - Creates `.ipa` and `.apk` files.
  - Optionally uploads to TestFlight (iOS) and Internal Track (Android) on tags.

---

### ✅ Acceptance Criteria

- [ ] **Development:**
  - [ ] The mobile app runs on iOS simulator and Android emulator.
  - [ ] The lobby loads, tables are visible, and the game table renders correctly.
  - [ ] WebSocket connection works and updates the table in real‑time.
  - [ ] Authentication (login/register) works.

- [ ] **Native features:**
  - [ ] Push notifications are registered and received when the app is closed (tested on real devices).
  - [ ] In‑app purchases complete and chips are credited to the user’s balance.
  - [ ] The app uses native navigation and gestures (smooth).

- [ ] **CI/CD:**
  - [ ] Building the app produces installable `.ipa` and `.apk`.
  - [ ] The build is uploaded to TestFlight / Internal Track on tag.

- [ ] **Code sharing:**
  - [ ] At least 80% of the business logic (stores, API, WebSocket) is shared between PWA and mobile.
  - [ ] The shared packages are properly versioned and maintained.

---

### 🔗 Blocked By

- **#006** – The frontend monorepo (PWA) must be stable, and the shared packages must be extracted.

---

### 🧪 Testing Notes

- **Manual testing** on real devices:
  - iOS (iPhone 12, iOS 16+)
  - Android (Pixel 5, Android 13+)
- **Push notifications**: test with a real device, send a test notification from the backend.
- **In‑app purchases**: test with sandbox/test accounts (no real money).
- **CI/CD**: test the build workflow on a feature branch before merging.

---

### 📝 Implementation Hints

- **Monorepo**: Use `turbo` or `nx` to manage builds across apps.
- **Shared code**: The shared package must be React Native‑compatible (no browser APIs). Use `react-native` conditionals or separate entry points.
- **WebSocket**: Use `react-native-websocket` for better control.
- **Navigation**: Use `@react-navigation/native` stack and bottom tabs.
- **Design system**: Use `react-native-paper` or `native-base` for consistency, or build custom components with `react-native` primitives.
- **Push notifications**: Expo Notifications is the easiest path if using Expo. Otherwise, `react-native-push-notification` is a solid choice.
- **In‑app purchases**: `react-native-iap` is the most maintained library.
- **Environment**: Use `react-native-config` for environment variables.
