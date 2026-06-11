use serde::{Deserialize, Serialize};

#[derive(Serialize, Debug, Clone)]
pub struct DeckStatusResponse {
    pub deck_id: String,
    pub status: String,
    pub total_prompts: i64,
    pub prompts_ready: i64,
    pub prompts_generating: i64,
    pub prompts_review: i64,
    pub prompts_done: i64,
}

#[derive(Serialize, Debug, Clone)]
pub struct PromptResponse {
    pub id: i32,
    pub target_card: String,
    pub target_layer: String,
    pub final_positive: String,
    pub final_negative: String,
    pub status: String,
}

#[derive(Deserialize, Debug, Clone)]
pub struct UpdatePromptRequest {
    pub status: String,
}

#[derive(Deserialize, Debug, Clone)]
pub struct CreateTakeRequest {
    pub image_base64: String,
    pub take_number: i32,
}

#[derive(Serialize, Debug, Clone)]
pub struct TakeResponse {
    pub id: i32,
    pub prompt_id: i32,
    pub target_card: String,
    pub target_layer: String,
    pub take_number: i32,
    pub file_path: String,
    pub selected: bool,
}

#[derive(Deserialize, Debug, Clone)]
pub struct GenerateStartRequest {
    pub takes_per_prompt: u32,
}
