use serde::{Deserialize, Serialize};
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Puzzle {
    pub id: u32,
    pub hole_cards: Vec<String>,
    pub community_cards: Vec<String>,
    pub action_description: String,
    pub correct_action: String,
    pub possible_actions: Vec<String>,
    pub explanation: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PuzzleResponse {
    pub puzzle_id: u32,
    pub hole_cards: Vec<String>,
    pub community_cards: Vec<String>,
    pub action_description: String,
    pub possible_actions: Vec<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubmitRequest {
    pub selected_action: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubmitResponse {
    pub correct: bool,
    pub explanation: String,
    pub user_action: String,
    pub correct_action: String,
}
