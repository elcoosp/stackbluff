use serde::{Deserialize, Serialize};
use sb_shared_types::StakeLevel;
use uuid::Uuid;

#[derive(Serialize, Deserialize)]
pub struct TableSummary {
    pub table_id: Uuid,
    pub stake_level: String,
    pub max_players: u8,
    pub current_players: u8,  // will be 0 initially, later populated
    pub status: String,
}

#[derive(Serialize, Deserialize)]
pub struct LobbyResponse {
    pub tables: Vec<TableSummary>,
}

#[derive(Deserialize)]
pub struct CreateTableRequest {
    pub stake_level: String,
    pub max_players: u8,
}

#[derive(Serialize)]
pub struct CreateTableResponse {
    pub table_id: Uuid,
}
