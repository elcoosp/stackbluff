Based on the current state of your codebase, your core game loop, tournaments, and infrastructure are solid. You are now at the stage where you need to build the surrounding operational and monetization features. 

Here is a concrete, step-by-step implementation plan for the three critical features you requested.

---

### 1. The Payment & Monetization Pipeline
You have the `sb-payment` crate and Stripe dependencies declared, but they are not wired up. You need to allow users to buy chips and Season Passes.

**Step 1: Database Migration for Transactions**
*   Create a new SeaORM migration to add a `transactions` table.
*   Columns: `id` (Uuid), `user_id` (Uuid FK), `stripe_session_id` (String), `amount_cents` (i32), `currency` (String), `product_type` (String: "chips" or "season_pass"), `status` (String: "pending", "completed", "failed"), `created_at`, `updated_at`.

**Step 2: Implement `sb-payment` Crate**
*   Create a `PaymentService` trait in `sb-contracts` with methods like `create_checkout_session(user_id, product_type)` and `process_webhook_event(payload, signature)`.
*   In `sb-payment`, implement `StripePaymentService` using the `async-stripe` crate.
*   **Create Checkout Session:** When a user requests to buy chips, create a Stripe Checkout Session. Save the session ID to your `transactions` table with status `pending`. Return the Stripe URL to the frontend.
*   **Webhook Handler:** Create a raw-body extractor in Axum to receive Stripe webhooks. Verify the signature using your Stripe Webhook Secret. On `checkout.session.completed`, update the `transactions` table to `completed` and call `UserRepo::update_chip_balance` or grant the Season Pass.

**Step 3: Wire into `main.rs` and Router**
*   Initialize `StripePaymentService` in `main.rs` and add it to `AppState`.
*   In `sb-rest-router`, create a `payment_routes` module:
    *   `POST /api/payments/checkout`: Authenticated route. Takes the product ID, calls `PaymentService::create_checkout_session`, returns the URL.
    *   `POST /api/payments/webhook`: Unauthenticated route (uses Stripe signature for auth). Calls `PaymentService::process_webhook_event`.

---

### 2. Admin & Moderation Tools
When you go live, players will get stuck or need refunds. You need secure endpoints to manage the game state without touching the database directly.

**Step 1: Database & Auth Updates**
*   Add an `is_admin` boolean column (default `false`) to your `users` table via a new migration.
*   Update `UserProfile` in `sb-shared-types` to include `is_admin`.
*   In `sb-auth/src/middleware.rs`, you can leave the JWT as is, but in your admin routes, you will extract the `AuthUser`, fetch their profile, and verify `is_admin == true`. (Alternatively, add an `admin` flag directly to the JWT claims for speed).

**Step 2: Create Admin Router (`sb-rest-router::admin`)**
*   Create an `admin_middleware` that checks if the user is an admin. If not, return `403 Forbidden`.
*   **Chip Management:** `POST /admin/users/{id}/refund` - Takes an amount, calls `UserRepo::update_chip_balance`, and logs the action.
*   **Tournament Management:** `POST /admin/tournaments/{id}/cancel` - Fetches the tournament, calls a new `TournamentService::force_cancel(tournament_id)` method which refunds all active players and marks the tournament as `Cancelled` in the DB.
*   **User Management:** `POST /admin/users/{id}/ban` - Sets a `is_banned` flag on the user. Update the auth middleware to reject banned users immediately.

**Step 3: Wire into `main.rs`**
*   Merge the `admin_router` into your main `Router` in `main.rs`, applying the `admin_middleware` layer to it.

---

### 3. Tournament Late Registration & Re-entries
Currently, your `MttDirector` rejects registrations as soon as the tournament starts. Modern MTTs need Late Registration to build prize pools.

**Step 1: Update Configuration Types**
*   In `sb-contracts::tournament_api`, add `late_reg_levels: u32` to `TournamentConfig`. This defines how many blind levels late registration stays open.
*   Add `late_reg_active: bool` to the `TournamentSummary` payload so the frontend knows if it can still register.

**Step 2: Update `MttDirector` Logic**
*   In `MttDirector::register_player`, change the state check:
    ```rust
    if !matches!(self.state, DirectorState::Registering | DirectorState::Running) {
        return Err(AppError::TournamentRegistrationClosed);
    }
    if matches!(self.state, DirectorState::Running) {
        let current_level = self.blind_scheduler.as_ref().map(|s| s.current_level().0).unwrap_or(0);
        if current_level > self.config.late_reg_levels {
            return Err(AppError::TournamentRegistrationClosed);
        }
    }
    ```
*   When a player registers late, they need to be immediately seated. Add logic to assign them to a table with an open seat, or dynamically create a new table if all are full.
*   **Re-entries:** If a player busts during late registration, allow them to call `register_player` again. Treat it as a new entry (add to prize pool, give them a new stack).

**Step 3: Update `handle_hand_completed`**
*   At the end of `handle_hand_completed`, check if `current_level > config.late_reg_levels`.
*   If late registration has just ended, broadcast a `TournamentState` update with `late_reg_active: false` so the frontend updates the UI.
