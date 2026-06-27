use crate::puzzle::models::Puzzle;
use chrono::{Datelike, Utc};
use once_cell::sync::Lazy;

static PUZZLES_JSON: &str = include_str!("../../assets/puzzles.json");

static PUZZLES: Lazy<Vec<Puzzle>> = Lazy::new(|| {
    serde_json::from_str::<Vec<Puzzle>>(PUZZLES_JSON)
        .expect("FATAL: Failed to parse embedded puzzles.json. The asset is corrupted.")
});

pub fn get_puzzle_for_date(date: chrono::NaiveDate) -> Option<&'static Puzzle> {
    if PUZZLES.is_empty() { return None; }
    let days = date.num_days_from_ce() as usize;
    PUZZLES.get(days % PUZZLES.len())
}

pub fn get_today_puzzle() -> Option<&'static Puzzle> { get_puzzle_for_date(Utc::now().date_naive()) }
pub fn get_today_date() -> chrono::NaiveDate { Utc::now().date_naive() }
