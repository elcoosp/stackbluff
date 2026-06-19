use crate::commands::DbCommand;
use sb_contracts::repo_api::{
    HandHistoryRepository, HandSummary, PersistenceError, PersistenceResult, WinnerSummary,
};
use sb_db_entities::hand_history::{self};
use sb_db_entities::hand_history_json::{HandPlayers, HandResult};
use sb_shared_types::{PlayerId, RequestContext, TableId, UserId};
use sea_orm::{
    ColumnTrait, DatabaseConnection, EntityTrait, PaginatorTrait, QueryFilter, QueryOrder,
};
use std::collections::HashMap;
use tokio::sync::{mpsc, oneshot};
use uuid::Uuid;

pub struct HandHistoryRepoImpl {
    sender: mpsc::UnboundedSender<DbCommand>,
    db: DatabaseConnection,
}

impl HandHistoryRepoImpl {
    pub fn new(sender: mpsc::UnboundedSender<DbCommand>, db: DatabaseConnection) -> Self {
        Self { sender, db }
    }
}

#[async_trait::async_trait]
impl HandHistoryRepository for HandHistoryRepoImpl {
    async fn store_hand(
        &self,
        ctx: RequestContext,
        hand_data: serde_json::Value,
    ) -> PersistenceResult<()> {
        let table_id_str = hand_data["table_id"]
            .as_str()
            .ok_or_else(|| PersistenceError::Database("missing table_id".into()))?;
        let table_id =
            Uuid::parse_str(table_id_str).map_err(|e| PersistenceError::Database(e.to_string()))?;
        let played_at_str = hand_data["played_at"]
            .as_str()
            .ok_or_else(|| PersistenceError::Database("missing played_at".into()))?;
        let played_at = chrono::DateTime::parse_from_rfc3339(played_at_str)
            .map_err(|e| PersistenceError::Database(e.to_string()))?
            .with_timezone(&chrono::Utc);

        let players_json = hand_data["players"].clone();
        let actions_json = hand_data["actions"].clone();
        let result_json = hand_data["result"].clone();

        let (tx, rx) = oneshot::channel();
        let cmd = DbCommand::StoreHandHistory {
            ctx,
            table_id,
            played_at,
            players_json,
            actions_json,
            result_json,
            respond: tx,
        };
        self.sender
            .send(cmd)
            .map_err(|e| PersistenceError::Database(e.to_string()))?;
        rx.await
            .map_err(|e| PersistenceError::Database(e.to_string()))?
    }

    async fn list_hand_summaries(
        &self,
        _ctx: RequestContext,
        table_id: TableId,
        limit: u64,
        cursor: Option<(chrono::DateTime<chrono::Utc>, Uuid)>,
    ) -> PersistenceResult<(
        Vec<HandSummary>,
        Option<(chrono::DateTime<chrono::Utc>, Uuid)>,
    )> {
        use hand_history::Column;
        use sea_orm::Condition;

        let mut query = hand_history::Entity::find()
            .filter(Column::TableId.eq(table_id.as_uuid()))
            .order_by_desc(Column::PlayedAt)
            .order_by_desc(Column::Id);

        if let Some((played_at, id)) = cursor {
            query = query.filter(
                Condition::any().add(Column::PlayedAt.lt(played_at)).add(
                    Condition::all()
                        .add(Column::PlayedAt.eq(played_at))
                        .add(Column::Id.lt(id)),
                ),
            );
        }

        let models = query
            .all(&self.db)
            .await
            .map_err(|e| PersistenceError::Database(e.to_string()))?;

        let has_next = models.len() > limit as usize;
        let models = if has_next {
            &models[..limit as usize]
        } else {
            &models[..]
        };

        let mut summaries = Vec::with_capacity(models.len());
        for m in models {
            let players: HandPlayers = m.players_json.clone();
            let result: HandResult = m.result_json.clone();

            // ── Build PID→UID mapping ──
            let pid_to_uid: HashMap<PlayerId, UserId> = players
                .seats
                .iter()
                .filter_map(|p| p.user_id.map(|u| (p.player_id, u)))
                .collect();

            let pot = result.winners.iter().map(|w| w.amount_won).sum();

            let winners: Vec<WinnerSummary> = result
                .winners
                .iter()
                .map(|w| WinnerSummary {
                    user_id: pid_to_uid
                        .get(&w.player_id)
                        .copied()
                        .unwrap_or_else(|| UserId::new(w.player_id.0)),
                    amount: w.amount_won,
                    hand_rank: w.hand_description.clone(),
                })
                .collect();

            // ── These are already Vec<String> ──
            let community_cards = result.community_cards.clone();

            // ── Convert [String; 2] to Vec<String> ──
            let winner_hole_cards = result.winners.first().and_then(|winner| {
                players
                    .seats
                    .iter()
                    .find(|seat| seat.player_id == winner.player_id)
                    .and_then(|seat| seat.hole_cards.clone())
                    .map(|arr| arr.to_vec())
            });

            summaries.push(HandSummary {
                id: m.id,
                table_id: TableId::new(m.table_id),
                played_at: m.played_at,
                pot,
                winners,
                community_cards,
                winner_hole_cards,
            });
        }

        let next_cursor = if has_next {
            models.last().map(|m| (m.played_at, m.id))
        } else {
            None
        };

        Ok((summaries, next_cursor))
    }

    async fn count_hand_histories(
        &self,
        _ctx: RequestContext,
        table_id: TableId,
    ) -> PersistenceResult<u64> {
        use hand_history::Column;
        let count = hand_history::Entity::find()
            .filter(Column::TableId.eq(table_id.as_uuid()))
            .count(&self.db)
            .await
            .map_err(|e| PersistenceError::Database(e.to_string()))?;
        Ok(count)
    }

    async fn count_user_hands(
        &self,
        _ctx: RequestContext,
        table_id: TableId,
        user_id: UserId,
    ) -> PersistenceResult<u64> {
        use hand_history::Column;
        let pattern = format!(",{},", user_id.as_uuid());
        let count = hand_history::Entity::find()
            .filter(Column::TableId.eq(table_id.as_uuid()))
            .filter(Column::Participants.like(&pattern))
            .count(&self.db)
            .await
            .map_err(|e| PersistenceError::Database(e.to_string()))?;
        Ok(count)
    }
}

/// Spawns a background task that deletes hand history records older than
/// a configurable number of days (env: HAND_HISTORY_RETENTION_DAYS, default 30).
pub async fn spawn_hand_history_cleanup(db: DatabaseConnection) {
    tokio::spawn(async move {
        let retention_days = std::env::var("HAND_HISTORY_RETENTION_DAYS")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(30);
        let cutoff = chrono::Utc::now() - chrono::Duration::days(retention_days);

        let mut interval = tokio::time::interval(std::time::Duration::from_secs(3600));
        loop {
            interval.tick().await;

            let result = hand_history::Entity::delete_many()
                .filter(hand_history::Column::PlayedAt.lt(cutoff))
                .exec(&db)
                .await;

            match result {
                Ok(res) => {
                    if res.rows_affected > 0 {
                        tracing::info!(
                            deleted = res.rows_affected,
                            "Hand history cleanup completed"
                        );
                    }
                }
                Err(e) => {
                    tracing::error!(error = ?e, "Hand history cleanup delete failed");
                }
            }
        }
    });
}
