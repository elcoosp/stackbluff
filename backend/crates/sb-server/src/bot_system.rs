use async_trait::async_trait;
use sb_poker_bots::TableClient;
use sb_shared_types::{ActionType, AppError, ChipAmount, TableId, UserId};
use sb_table_registry::game_room::RoomMessage;
use sb_table_registry::registry::Registry;
use std::sync::Arc;
use tokio::sync::mpsc;

pub struct BotTableClient {
    pub registry: Arc<Registry>,
}

#[async_trait]
impl TableClient for BotTableClient {
    async fn join_table(
        &self,
        room_id: TableId,
        user_id: UserId,
        stack: ChipAmount,
        msg_tx: mpsc::UnboundedSender<RoomMessage>,
    ) -> Result<bool, AppError> {
        self.registry
            .join_room_full(
                room_id,
                user_id,
                format!("Bot_{}", user_id),
                None,
                stack,
                msg_tx,
            )
            .await
            .map_err(|e| AppError::Internal(e.to_string()))
    }

    async fn send_action(
        &self,
        room_id: TableId,
        user_id: UserId,
        action_type: ActionType,
        amount: Option<ChipAmount>,
    ) -> Result<(), AppError> {
        self.registry
            .send_player_action(room_id, user_id, action_type, amount)
            .await
            .map_err(|e| AppError::Internal(e.to_string()))
    }

    async fn leave_table(
        &self,
        room_id: TableId,
        user_id: UserId,
        force: bool,
    ) -> Result<ChipAmount, AppError> {
        self.registry
            .send_leave(room_id, user_id, force)
            .await
            .map_err(|e| AppError::Internal(e.to_string()))
    }

    async fn set_sitting_out(
        &self,
        room_id: TableId,
        user_id: UserId,
        sitting_out: bool,
    ) -> Result<(), AppError> {
        self.registry
            .set_sitting_out(room_id, user_id, sitting_out)
            .await
    }

    async fn get_table_config(&self, room_id: TableId) -> Result<sb_shared_types::TableConfig, AppError> {
        self.registry
            .get_table_config(room_id)
            .await
            .ok_or_else(|| AppError::NotFound("Table config not found".to_string()))
    }

    async fn get_player_count(&self, room_id: TableId) -> Result<u8, AppError> {
        let count = self.registry.get_total_active_players(room_id).await;
        Ok(count as u8)
    }
}
