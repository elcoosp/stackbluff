use axum::{
    Json, Router,
    extract::{Extension, State},
    http::StatusCode,
    routing::{get, patch},
};
use sb_auth::middleware::AuthUser;
use sb_db_entities::user_notification_preferences;
use sea_orm::{ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, Set};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

use crate::AppState;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NotificationPreferences {
    pub tournament_reminder_60: bool,
    pub tournament_reminder_10: bool,
    pub tournament_results: bool,
    pub club_announcements: bool,
    pub friend_activity: bool,
    pub promotional: bool,
}

impl Default for NotificationPreferences {
    fn default() -> Self {
        Self {
            tournament_reminder_60: true,
            tournament_reminder_10: true,
            tournament_results: true,
            club_announcements: true,
            friend_activity: true,
            promotional: false,
        }
    }
}

async fn get_preferences(
    Extension(auth_user): Extension<AuthUser>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<NotificationPreferences>, (StatusCode, String)> {
    let user_id = Uuid::parse_str(&auth_user.user_id)
        .map_err(|_| (StatusCode::BAD_REQUEST, "Invalid user ID".to_string()))?;

    let model = user_notification_preferences::Entity::find()
        .filter(user_notification_preferences::Column::UserId.eq(user_id))
        .one(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let prefs = match model {
        Some(m) => NotificationPreferences {
            tournament_reminder_60: m.tournament_reminder_60,
            tournament_reminder_10: m.tournament_reminder_10,
            tournament_results: m.tournament_results,
            club_announcements: m.club_announcements,
            friend_activity: m.friend_activity,
            promotional: m.promotional,
        },
        None => NotificationPreferences::default(),
    };

    Ok(Json(prefs))
}

async fn update_preferences(
    Extension(auth_user): Extension<AuthUser>,
    State(state): State<Arc<AppState>>,
    Json(payload): Json<NotificationPreferences>,
) -> Result<StatusCode, (StatusCode, String)> {
    let user_id = Uuid::parse_str(&auth_user.user_id)
        .map_err(|_| (StatusCode::BAD_REQUEST, "Invalid user ID".to_string()))?;

    // Check if already exists
    let existing = user_notification_preferences::Entity::find()
        .filter(user_notification_preferences::Column::UserId.eq(user_id))
        .one(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if let Some(model) = existing {
        // Update
        let mut active: user_notification_preferences::ActiveModel = model.into();
        active.tournament_reminder_60 = Set(payload.tournament_reminder_60);
        active.tournament_reminder_10 = Set(payload.tournament_reminder_10);
        active.tournament_results = Set(payload.tournament_results);
        active.club_announcements = Set(payload.club_announcements);
        active.friend_activity = Set(payload.friend_activity);
        active.promotional = Set(payload.promotional);
        active.updated_at = Set(chrono::Utc::now());
        active.update(&state.db)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    } else {
        // Insert
        let active = user_notification_preferences::ActiveModel {
            user_id: Set(user_id),
            tournament_reminder_60: Set(payload.tournament_reminder_60),
            tournament_reminder_10: Set(payload.tournament_reminder_10),
            tournament_results: Set(payload.tournament_results),
            club_announcements: Set(payload.club_announcements),
            friend_activity: Set(payload.friend_activity),
            promotional: Set(payload.promotional),
            updated_at: Set(chrono::Utc::now()),
        };
        active.insert(&state.db)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    }

    Ok(StatusCode::OK)
}

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/notifications/preferences", get(get_preferences))
        .route("/notifications/preferences", patch(update_preferences))
}
