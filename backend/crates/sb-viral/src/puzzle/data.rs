use crate::puzzle::models::Puzzle;
use chrono::{Datelike, Utc};
use once_cell::sync::Lazy;
use std::fs;
use std::path::PathBuf;
use tracing::warn;

static PUZZLES: Lazy<Vec<Puzzle>> = Lazy::new(|| {
    let manifest_dir = env!("CARGO_MANIFEST_DIR");
    let puzzle_path = PathBuf::from(manifest_dir).join("assets/puzzles.json");
    match fs::read_to_string(&puzzle_path) {
        Ok(content) => match serde_json::from_str::<Vec<Puzzle>>(&content) {
            Ok(puzzles) => {
                tracing::info!("Loaded {} puzzles from {}", puzzles.len(), puzzle_path.display());
                puzzles
            }
            Err(e) => {
                warn!("Failed to parse puzzles.json: {}", e);
                Vec::new()
            }
        },
        Err(e) => {
            warn!("Failed to read puzzles.json at {}: {}", puzzle_path.display(), e);
            Vec::new()
        }
    }
});

pub fn get_puzzle_count() -> usize {
    PUZZLES.len()
}

pub fn get_puzzle_for_date(date: chrono::NaiveDate) -> Option<&'static Puzzle> {
    if PUZZLES.is_empty() {
        return None;
    }
    let days = date.num_days_from_ce() as usize;
    let index = days % PUZZLES.len();
    PUZZLES.get(index)
}

pub fn get_today_puzzle() -> Option<&'static Puzzle> {
    let today = Utc::now().date_naive();
    get_puzzle_for_date(today)
}

pub fn get_today_date() -> chrono::NaiveDate {
    Utc::now().date_naive()
}
