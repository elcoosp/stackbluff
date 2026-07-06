use async_trait::async_trait;
use chrono::{DateTime, Utc};
use sb_shared_types::{AppError, ChipAmount, RequestContext, TableId, TournamentId, UserId};
use serde::{Deserialize, Serialize};

// ── Enums ────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TournamentType {
    SitAndGo,
    Mtt,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TournamentStatus {
    Registering,
    Running,
    Completed,
    Cancelled,
}

// ── Configuration types ──────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlindLevel {
    pub level: u32,
    pub small_blind: i64,
    pub big_blind: i64,
    pub ante: i64,
    pub duration_seconds: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlindSchedule {
    pub levels: Vec<BlindLevel>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PayoutEntry {
    pub position: u32,
    pub percentage: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PayoutStructure {
    pub entries: Vec<PayoutEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TournamentConfig {
    pub tournament_type: TournamentType,
    pub max_players: u32,
    pub buy_in: ChipAmount,
    pub blind_schedule: BlindSchedule,
    pub payout_structure: PayoutStructure,
    pub start_delay_seconds: u32,
    pub min_players_to_start: u32,
    pub club_id: Option<sb_shared_types::ids::ClubId>,
    pub scheduled_start: Option<chrono::DateTime<chrono::Utc>>,
    pub blind_schedule_id: Option<uuid::Uuid>,
}

// ── Query types ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TournamentSummary {
    pub id: TournamentId,
    pub tournament_type: TournamentType,
    pub status: TournamentStatus,
    pub registered: u32,
    pub max_players: u32,
    pub buy_in: ChipAmount,
    pub prize_pool: ChipAmount,
    pub current_blind_level: Option<u32>,
    pub started_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TournamentResult {
    pub tournament_id: TournamentId,
    pub user_id: UserId,
    pub position: u32,
    pub prize: ChipAmount,
    pub completed_at: DateTime<Utc>,
}

// ── Repository record types ──────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TournamentRecord {
    pub id: TournamentId,
    pub config: TournamentConfig,
    pub status: TournamentStatus,
    pub prize_pool: ChipAmount,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TournamentRegistration {
    pub tournament_id: TournamentId,
    pub user_id: UserId,
    pub registered_at: DateTime<Utc>,
}

// ── Service trait ────────────────────────────────────────────────────────────

#[async_trait]
pub trait TournamentService: Send + Sync {
    async fn create_tournament(
        &self,
        ctx: &RequestContext,
        config: TournamentConfig,
    ) -> Result<TournamentId, AppError>;

    async fn register(
        &self,
        ctx: &RequestContext,
        tournament_id: TournamentId,
        user_id: UserId,
    ) -> Result<(), AppError>;

    async fn unregister(
        &self,
        ctx: &RequestContext,
        tournament_id: TournamentId,
        user_id: UserId,
    ) -> Result<(), AppError>;

    async fn get_tournament(
        &self,
        ctx: &RequestContext,
        tournament_id: TournamentId,
    ) -> Result<TournamentSummary, AppError>;

    async fn list_tournaments(
        &self,
        ctx: &RequestContext,
        type_filter: Option<TournamentType>,
    ) -> Result<Vec<TournamentSummary>, AppError>;

    async fn get_results(
        &self,
        ctx: &RequestContext,
        tournament_id: TournamentId,
    ) -> Result<Vec<TournamentResult>, AppError>;

    async fn get_my_table(
        &self,
        ctx: &RequestContext,
        tournament_id: TournamentId,
        user_id: UserId,
    ) -> Result<Option<TableId>, AppError>;
}

// ── Repository trait ─────────────────────────────────────────────────────────

#[async_trait]
pub trait TournamentRepo: Send + Sync {
    // Transactional versions (used internally)
    async fn register_player_txn(
        &self,
        conn: &sea_orm::DatabaseConnection,
        tournament_id: TournamentId,
        user_id: UserId,
        buy_in: ChipAmount,
    ) -> Result<(), AppError>;

    async fn unregister_player_txn(
        &self,
        conn: &sea_orm::DatabaseConnection,
        tournament_id: TournamentId,
        user_id: UserId,
        buy_in: ChipAmount,
    ) -> Result<(), AppError>;

    // Simple versions that use the repo's own connection
    async fn register_player(
        &self,
        tournament_id: TournamentId,
        user_id: UserId,
        buy_in: ChipAmount,
    ) -> Result<(), AppError>;

    async fn unregister_player(
        &self,
        tournament_id: TournamentId,
        user_id: UserId,
        buy_in: ChipAmount,
    ) -> Result<(), AppError>;

    async fn insert_tournament(&self, config: &TournamentConfig) -> Result<TournamentId, AppError>;

    async fn get_tournament(&self, id: TournamentId) -> Result<Option<TournamentRecord>, AppError>;

    async fn list_tournaments(
        &self,
        type_filter: Option<TournamentType>,
    ) -> Result<Vec<TournamentRecord>, AppError>;

    async fn set_status(
        &self,
        id: TournamentId,
        status: TournamentStatus,
        started_at: Option<DateTime<Utc>>,
    ) -> Result<(), AppError>;

    async fn list_registrations(
        &self,
        id: TournamentId,
    ) -> Result<Vec<TournamentRegistration>, AppError>;

    async fn record_result(&self, r: &TournamentResult) -> Result<(), AppError>;

    async fn list_results(&self, id: TournamentId) -> Result<Vec<TournamentResult>, AppError>;

    async fn increment_prize_pool(
        &self,
        conn: &sea_orm::DatabaseConnection,
        id: TournamentId,
        amount: ChipAmount,
    ) -> Result<(), AppError>;

    async fn decrement_prize_pool(
        &self,
        conn: &sea_orm::DatabaseConnection,
        id: TournamentId,
        amount: ChipAmount,
    ) -> Result<(), AppError>;

    // ── Added for registration counts ────────────────────────────────
    async fn count_registrations(&self, tournament_id: TournamentId) -> Result<u32, AppError>;
}
