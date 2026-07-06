use crate::puzzle::models::Puzzle;
use chrono::{Datelike, Utc};
use once_cell::sync::Lazy;

static PUZZLES_JSON: &str = include_str!("../../assets/puzzles.json");
static PUZZLES: Lazy<Vec<Puzzle>> = Lazy::new(|| {
    serde_json::from_str(PUZZLES_JSON).expect("FATAL: Corrupted puzzles.json")
});

pub fn get_today_puzzle() -> Option<&'static Puzzle> {
    let days = Utc::now().date_naive().num_days_from_ce() as usize;
    PUZZLES.get(days % PUZZLES.len())
}
pub fn get_today_date() -> chrono::NaiveDate { Utc::now().date_naive() }
