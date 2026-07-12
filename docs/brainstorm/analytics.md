Based on your codebase and the research, here is a concrete, step-by-step plan to implement a zero-budget, open-source analytics stack. This plan leverages your existing consent system and provides two complementary data streams: high-level product analytics and detailed game-behavior analytics.

### The Two-Pronged Approach

Your `useConsentStore` (`frontend/apps/pwa/src/stores/consentStore.ts`) already handles consent correctly. The key is to use it to gate **all** analytics events, regardless of the destination.

1.  **Product & Pageview Analytics (Plausible CE)**:
    *   **What**: Tracks page views, conversions (e.g., registrations, purchases), and high-level user flows.
    *   **Why**: Gives you a clear, visual dashboard to understand user acquisition and retention, similar to Google Analytics but privacy-focused.
    *   **How**: Self-host the **Plausible Community Edition (CE)**. This is a direct, drop-in replacement for the `plausible` calls already in your code, like in `frontend/apps/pwa/src/lib/analytics.ts`.

2.  **Game & Behavior Analytics (Custom Rust API)**:
    *   **What**: Tracks granular in-game actions: `hand_action`, `tournament_registration`, `oracle_usage`, etc.
    *   **Why**: Generic tools like Plausible are not designed for this high-volume, domain-specific data. A custom API gives you full control over the schema, allowing you to answer specific questions like "What is the average raise size on the river?".
    *   **How**: Build a new endpoint in your existing Rust backend (e.g., `/api/analytics/event`) that asynchronously writes these events to your SQLite database.

---

### Step 1: Self-Host Plausible Community Edition (CE)

This is the most straightforward part, as your frontend already uses the Plausible API.

1.  **Deploy Plausible CE**: Follow the official guide to run it with Docker Compose. It requires three services: the Plausible app, a PostgreSQL database (for accounts/settings), and a ClickHouse database (for analytics events).
    *   **Resource**: The official `plausible/community-edition` repository provides the necessary `docker-compose.yml` and environment file.
2.  **Configure Your Frontend**: Update your `VITE_PLAUSIBLE_DOMAIN` and `VITE_PLAUSIBLE_API_HOST` environment variables to point to your self-hosted instance.
3.  **Verify**: Your existing `trackEvent` function in `frontend/apps/pwa/src/lib/analytics.ts` will now send data to your own server.

---

### Step 2: Build the Custom Game Analytics API (Rust)

This involves creating a new database table, a SeaORM entity, and an Axum endpoint.

#### 2.1. Create the Database Table

Create a new migration in `backend/migration` for an `analytics_events` table.

```sql
-- migration/src/m20260712_000001_create_analytics_events.rs
CREATE TABLE analytics_events (
    id TEXT PRIMARY KEY, -- Use UUID
    user_id TEXT NOT NULL,
    event_type TEXT NOT NULL, -- e.g., "hand_action", "tournament_register"
    payload_json TEXT NOT NULL, -- JSONB for flexible event data
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

#### 2.2. Generate the SeaORM Entity

Run the SeaORM CLI to generate the entity for the new table. This will create a file like `sb-db-entities/src/analytics_event.rs`. You'll need to add this new module to your `sb-db-entities/src/lib.rs`.

#### 2.3. Create the Ingestion Endpoint (Axum)

Add a new route in your `sb-rest-router` crate. This is the endpoint your frontend will call.

```rust
// In sb-rest-router/src/analytics_routes.rs
use axum::{Json, Router, extract::State, routing::post};
use sb_shared_types::RequestContext;
use sea_orm::{DatabaseConnection, ActiveModelTrait, Set};
use uuid::Uuid;
use chrono::Utc;

// Define the request structure
#[derive(serde::Deserialize)]
pub struct AnalyticsEvent {
    pub event_type: String,
    pub payload: serde_json::Value,
}

pub async fn ingest_event(
    State(db): State<DatabaseConnection>,
    Extension(ctx): Extension<RequestContext>,
    Json(event): Json<AnalyticsEvent>,
) -> Result<(), (StatusCode, String)> {
    // 1. Get the user ID from the request context (set by your auth middleware)
    let user_id = ctx.user_id.ok_or((StatusCode::UNAUTHORIZED, "Unauthorized".to_string()))?;

    // 2. Create the ActiveModel for the new entity
    let new_event = sb_db_entities::analytics_event::ActiveModel {
        id: Set(Uuid::new_v4().to_string()),
        user_id: Set(user_id.to_string()),
        event_type: Set(event.event_type),
        payload_json: Set(event.payload.to_string()),
        created_at: Set(Utc::now()),
    };

    // 3. Insert into the database
    new_event.insert(&db).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(())
}

pub fn analytics_routes() -> Router<DatabaseConnection> {
    Router::new().route("/api/analytics/event", post(ingest_event))
}
```

Then, register this router in your main `sb-server/src/main.rs` file, similar to how you register other routes like `tournament_router`.

#### 2.4. Server-Side Tracking (Optional)

You can also send events from the backend. For example, you might want to track `tournament_created` or `payment_succeeded` events directly from Rust. You can use the `plausible_rs` crate to send these to your self-hosted Plausible instance. Alternatively, you can insert them directly into your new `analytics_events` table.

---

### Step 3: Update the Frontend to Send Game Events

You already have an analytics service (`frontend/apps/pwa/src/lib/analytics.ts`) and a consent store. You can extend the `trackEvent` function to send events to both Plausible and your new custom endpoint.

1.  **Create an API Client**: In your frontend, create a service that sends a POST request to your new `/api/analytics/event` endpoint.

    ```typescript
    // frontend/apps/pwa/src/lib/customAnalytics.ts
    import { canFireAnalytics } from '@/stores/consentStore';

    export async function trackGameEvent(eventType: string, payload: Record<string, any>) {
      if (!canFireAnalytics()) {
        return;
      }

      try {
        await fetch('/api/analytics/event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event_type: eventType, payload }),
        });
      } catch (error) {
        // Silently fail - don't let analytics break the user experience
        console.warn('Failed to send analytics event:', error);
      }
    }
    ```

2.  **Integrate into Components**: Call `trackGameEvent` from your React components. For example, in `frontend/apps/pwa/src/components/game/ActionBar.tsx`, you could track when a user raises.

    ```tsx
    // Inside the handleAction function
    import { trackGameEvent } from '@/lib/customAnalytics';

    const handleAction = useCallback((action: string, amount?: number) => {
      // ... existing logic
      trackGameEvent('player_action', { action, amount, pot_size: pot });
      // ...
    }, [onAction]);
    ```

---

### Step 4: View Your Data

- **Plausible**: Access the beautiful Plausible dashboard to see page views, referrers, and conversion funnels.
- **Custom Data**:
    - **Direct SQL**: Query your `analytics_events` table directly using the `sqlite3` CLI or a GUI tool like **Beekeeper Studio**.
    - **Open-Source Dashboard**: For a more visual approach, consider self-hosting **Metabase**. It's a free, open-source BI tool that can connect directly to your SQLite database, allowing you to build dashboards and charts from your game event data.

This two-tiered approach gives you immediate, visual insights with Plausible and the deep, queryable game data you need to make informed product decisions, all while staying within a zero-dollar budget.
