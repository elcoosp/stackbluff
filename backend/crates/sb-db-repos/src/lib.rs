#![allow(clippy::needless_update)]
pub mod leaderboard_repo;
pub mod referral_repo;

pub mod commands;
pub mod hand_history_repo;
pub mod player_stats_repo;
pub mod table_repo;
pub mod user_repo;
pub mod writer_loop;

pub mod club_repo;
pub mod tournament_repo;
pub use writer_loop::init_writer_loop;

pub use table_repo::TableRepoImpl;

pub use hand_history_repo::HandHistoryRepoImpl;

pub use leaderboard_repo::{LeaderboardRepo, refresh_leaderboard_mv};
pub use tournament_repo::TournamentRepoImpl;

pub mod badge_engine;
pub mod badge_repo;
pub mod gdpr_repo;
pub mod puzzle_repo;
pub mod season_card_repo;

pub use gdpr_repo::PgGdprRepo;
