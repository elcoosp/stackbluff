## Frontend shop – chip bundles, Season Pass, Club Pro

**Title:** Frontend shop – chip bundles, Season Pass, Club Pro  
**Labels:** `frontend, payments, ui, afk`  
**Blocked by:** #006 (frontend scaffold), #017 (payment backend)

---

### 📌 Summary

Implement the **Shop UI** for both the PWA and Telegram Mini App. The shop page (`/shop`) must display purchasable items:

- **Chip bundles** (e.g., 10k chips / €1, 50k / €4, 250k / €15, 1M / €40).
- **Season Pass** (€5.99, valid for 8 weeks) – grants unlimited Oracle access and other perks.
- **Club Pro** (€4.99/month) – only visible if the user owns a club (determined via store/backend).

Each item shows the price in **Telegram Stars** (Mini App) or **EUR** (PWA). On purchase, the frontend calls `POST /payments/create-intent` and then redirects to the appropriate checkout flow. After successful payment, the user’s balance and/or pass status must update in real time (via WebSocket `user.updated` message or polling).

---

### 🧩 Context (where to find things)

| Component | File(s) |
|-----------|---------|
| Shop page (new) | `frontend/apps/pwa/src/pages/ShopPage.tsx` (create) |
| Routing | `frontend/apps/pwa/src/routes/shop.tsx` (create) |
| UI components (reuse) | `frontend/apps/pwa/src/components/ui/` (Button, Card, etc.), `@stackbluff/shared/ui/` (GlassPanel, LiquidMetalButton) |
| State management | `frontend/apps/pwa/src/stores/authStore.ts` (balance, user), create `shopStore` if needed |
| API client | `frontend/apps/pwa/src/lib/api.ts` (uses `@stackbluff/shared/api/client`) |
| WebSocket integration | `frontend/apps/pwa/src/hooks/useGameWebSocket.ts` (can be extended to listen for `user.updated`) |
| Payment backend (contract) | `POST /payments/create-intent` – expects `{ product_id: string, provider: string }` returns `{ client_secret: string, redirect_url?: string }` |

---

### 🔧 What to build

#### 1. Backend API contract (assumed from #017)

We’ll use the following expected endpoints:

- `GET /shop/products` – returns list of purchasable items:
  ```json
  {
    "products": [
      { "id": "chips_10k", "name": "10,000 Chips", "price_eur": 1.00, "price_stars": 10, "type": "chips", "chips_amount": 10000 },
      { "id": "season_pass", "name": "Season Pass", "price_eur": 5.99, "price_stars": 60, "type": "season_pass", "duration_days": 56 },
      { "id": "club_pro", "name": "Club Pro", "price_eur": 4.99, "price_stars": 50, "type": "club_pro", "duration_days": 30 }
    ]
  }
  ```
- `POST /payments/create-intent` – request:
  ```json
  { "product_id": "chips_10k", "provider": "stripe" | "telegram_stars" }
  ```
  Response (PWA):
  ```json
  { "client_secret": "pi_...", "redirect_url": "https://checkout.stripe.com/..." }
  ```
  Response (Mini App):
  ```json
  { "invoice_link": "https://t.me/...", "payment_id": "tg_..." }
  ```
  (The backend returns a link or an invoice ID; the frontend will open it.)

- `GET /user/me` (existing) returns user profile including `season_pass_expires_at`, `club_pro_expires_at`, `balance`.

- WebSocket event `user.updated` (sent after any payment success) updates the client’s balance and pass status.

#### 2. Shop page `/shop`

- Create a new route in `frontend/apps/pwa/src/routes/shop.tsx` that renders `ShopPage`.
- The page should use the existing `GlassPanel` or a custom container with the app’s dark theme and carbon background.
- Display the products in a responsive grid (1 column on mobile, 2 on tablet, 3 on desktop).

##### Product card design

Each product card must show:
- Product name and description (e.g., “10,000 Chips”).
- Price in both EUR and Telegram Stars (the appropriate one for the current platform is highlighted; the other is shown faded).
- For chip bundles: show the chip amount.
- For Season Pass: show a countdown timer if already purchased; otherwise show “Buy Now”.
- For Club Pro: show “Unlock” button; if user does not own a club, show a disabled state with a tooltip “Requires a club”.

The card should use the `LiquidMetalButton` for the purchase action.

##### Platform detection

- Use `window.Telegram?.WebApp` to detect Mini App environment.
- If `Telegram.WebApp` is available, set `provider = 'telegram_stars'` and display prices in Stars.
- Otherwise, use `provider = 'stripe'` and display prices in EUR.

#### 3. State management

- Add a `shopStore` (using Zustand) to manage product list, purchase state, and user entitlements.
- Alternatively, extend `authStore` with `seasonPassExpiresAt`, `clubProExpiresAt`, and `isClubOwner`.
- Use React Query to fetch products and user profile.

#### 4. Purchase flow

1. User clicks “Buy” on a product.
2. Show a confirmation dialog (using existing `Dialog` component) with product details and the final price.
3. On confirm, call `POST /payments/create-intent` with the product ID and detected provider.
4. Depending on the provider:
   - **Stripe (PWA)**: redirect to the `redirect_url` (or use Stripe.js to confirm the payment). After success, the user is redirected back to the app (via `success_url` configured in backend). The frontend should then refresh user data.
   - **Telegram Stars (Mini App)**: call `Telegram.WebApp.openInvoice(invoice_link, callback)` (or use the invoice link directly). The backend will handle the webhook and update the user’s balance.
5. After payment, listen for the WebSocket `user.updated` event (or poll `/user/me`) to update the user’s balance and pass expiry dates.
6. Show a toast notification on success or error.

#### 5. WebSocket integration

- Extend `useGameWebSocket` (or create a dedicated `useUserUpdates` hook) to listen for `user.updated` messages.
- When received, update the `authStore` balance and pass fields.
- This ensures the UI reflects the new balance without a full page reload.

#### 6. Season Pass integration with Oracle UI

- In the Oracle component (e.g., `TacticalOracle` or `AnalyticsPanel`), display an “Unlimited” badge if the user has an active Season Pass.
- Use `authStore.seasonPassExpiresAt` to check if the pass is active.

#### 7. Club Pro integration

- The Club Pro product should only be displayed if the user owns a club (check `authStore.isClubOwner` or fetch from `/user/me`).
- If the user purchases Club Pro, the frontend should enable a placeholder customisation UI (e.g., a “Customise Club” button that opens a modal with dummy options).

---

### ✅ Acceptance Criteria

- [ ] The `/shop` page displays all products with correct prices (EUR and Stars) and descriptions.
- [ ] In the Mini App, clicking a chip bundle opens the Telegram Stars invoice; after payment, the balance updates via WebSocket (or polling) within 5 seconds.
- [ ] In the PWA, clicking a chip bundle redirects to Stripe Checkout; after successful payment, the balance updates and the user is returned to the success page.
- [ ] The Season Pass product shows a countdown timer (days/hours remaining) if the user already has an active pass; otherwise, it shows a “Buy” button.
- [ ] The Oracle UI displays an “Unlimited” badge when the user has an active Season Pass.
- [ ] The Club Pro product is **only visible** to users who own a club. If they purchase it, a placeholder customisation UI becomes accessible.
- [ ] All purchase flows handle errors gracefully (e.g., insufficient funds, network errors) and show user-friendly toast messages.
- [ ] The user’s balance and entitlements update in real time after a purchase (WebSocket or polling).
- [ ] The UI is responsive and matches the existing dark theme (GlassPanel, LiquidMetalButton, carbon background).

---

### 🔗 Blocked By

- **#006** – Frontend scaffold (routing, stores, UI components) must be in place.
- **#017** – Payment backend must be ready to handle `create-intent` and process payments.

---

### 🧪 Testing Notes

- **Unit tests** for the shop store and purchase logic (mocking API calls).
- **Integration tests** for the purchase flow (using a test Stripe/Telegram environment).
- **E2E tests** (Playwright) for the Mini App and PWA purchase flows.
- Manual testing:
  - Verify that product prices are correctly formatted for each platform.
  - Simulate a payment success and confirm the WebSocket updates the balance.
  - Test the edge case where the user’s balance is insufficient (backend should return an error).

---

### 📝 Implementation Hints

- **Reuse components**: Use `GlassPanel`, `LiquidMetalButton`, `Dialog` (from `@stackbluff/shared`), and the existing `Card` components.
- **Animations**: Use `motion` from `framer-motion` for smooth transitions (as done in other pages).
- **State**: Use `@tanstack/react-query` for fetching products and user data; use Zustand for UI state (e.g., loading, dialog open).
- **Platform detection**: Create a helper `getPaymentProvider()` that returns `'stripe'` or `'telegram_stars'` based on `window.Telegram`.
- **WebSocket**: The `useGameWebSocket` hook already handles WebSocket connections. You can add a listener for `user.updated` messages and call `useAuthStore.getState().updateBalance(amount)` or similar.
- **Season Pass check**: In the Oracle components, conditionally show the unlimited badge if `user.season_pass_expires_at > Date.now()`.
- **Club Pro visibility**: Fetch the user’s club ownership from the profile; if `ownsClub` is false, skip rendering the Club Pro card or show a locked state.

---

This issue provides a clear, self‑contained specification for the frontend shop implementation, aligned with the existing codebase architecture and design patterns.
