use sb_shared_types::{ChipAmount, TableId, UserId};
use serde::Serialize;
use std::collections::HashMap;
use tokio::sync::mpsc;
use uuid::Uuid;

// === WebSocket message types ===

#[derive(Debug, Clone, Serialize)]
pub struct WsCard {
    pub suit: String,
    pub rank: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct SidePotMessage {
    pub amount: u64,
    pub eligible_players: Vec<UserId>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ActionInfo {
    pub text: String,
    pub amount: Option<u64>,
}

#[derive(Debug, Clone, Serialize)]
pub struct PlayerStateInfo {
    pub user_id: UserId,
    pub display_name: String,
    pub seat: u8,
    pub stack: ChipAmount,
    pub current_bet: ChipAmount,
    pub is_all_in: bool,
    pub is_folded: bool,
    pub is_leaving: bool,
    pub sitting_out: bool, // CHANGED: Added to show "Away" state
    #[serde(skip_serializing_if = "Option::is_none")]
    pub position_badge: Option<String>,
    pub last_action: Option<ActionInfo>,
    pub stats: Option<sb_shared_types::player_stats::PlayerStatsDto>,
}

#[derive(Debug, Clone, Serialize)]
pub struct TableStateUpdate {
    pub room_id: TableId,
    pub players: Vec<PlayerStateInfo>,
    pub current_hand_in_progress: bool,
    pub community_cards: Vec<WsCard>,
    pub current_turn_user_id: Option<UserId>,
    pub current_turn_expires_at: Option<u64>,
    pub current_turn_timeout_ms: Option<u64>,
    pub street: String,
    pub pot: u64,
    pub side_pots: Vec<SidePotMessage>,
}

#[derive(Debug, Clone, Serialize)]
pub struct AnalyticsPayload {
    pub win_prob: u8,
    pub pot_odds: f32,
    pub best_hand: String,
    pub strength: u8,
}

#[derive(Debug, Clone, Serialize)]
pub struct ActionRequired {
    pub room_id: TableId,
    pub player_id: UserId,
    pub expires_at: u64,
    pub timeout_ms: u64,
    pub to_call: u64,
    pub min_raise: u64,
    pub can_check: bool,
    pub pot: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct ActionBroadcast {
    pub room_id: TableId,
    pub player_id: UserId,
    pub action: String,
    pub amount: Option<u64>,
    pub new_stack: u64,
    pub new_pot: u64,
}

// ── Showdown types ──

#[derive(Debug, Clone, Serialize)]
pub struct ShowdownPlayer {
    pub user_id: UserId,
    pub display_name: String,
    pub seat: u8,
    pub hole_cards: Vec<WsCard>,
    pub hand_description: String,
    pub is_winner: bool,
    pub win_amount: u64,
    pub winning_cards: Vec<WsCard>,
}

// ── Tournament payload types ────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
pub struct TournamentStateUpdate {
    pub tournament_id: sb_shared_types::TournamentId,
    pub status: String,
    pub registered_count: u32,
    pub max_players: u32,
    pub prize_pool: u64,
    pub blind_level: Option<u32>,
}

#[derive(Debug, Clone, Serialize)]
pub struct TournamentResultPayload {
    pub tournament_id: sb_shared_types::TournamentId,
    pub user_id: UserId,
    pub position: u32,
    pub prize: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct ShowdownReveal {
    pub room_id: TableId,
    pub players: Vec<ShowdownPlayer>,
    pub community_cards: Vec<WsCard>,
    pub pot: u64,
}

// ── Hand result types ──

#[derive(Debug, Clone, Serialize)]
pub struct WinnerResult {
    pub user_id: UserId,
    pub display_name: String,
    pub amount: u64,
    pub hand_rank: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct HandResult {
    pub room_id: TableId,
    pub winners: Vec<WinnerResult>,
    pub pot: u64,
}

// ── Room message enum ──
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type")]
pub enum RoomMessage {
    #[serde(rename = "TableState")]
    TableState(TableStateUpdate),
    #[serde(rename = "ActionRequired")]
    ActionRequired(ActionRequired),
    #[serde(rename = "ActionBroadcast")]
    ActionBroadcast(ActionBroadcast),
    #[serde(rename = "ShowdownReveal")]
    ShowdownReveal(ShowdownReveal),
    KickVoteStarted {
        room_id: TableId,
        initiator_id: UserId,
        target_id: UserId,
        kick_vote_id: Uuid,
        duration_secs: u32,
        required_votes: u32,
    },
    ClubThemeUpdated {
        club_id: sb_shared_types::ClubId,
        banner_url: Option<String>,
        chip_preset_id: Option<i32>,
        felt_color: Option<String>,
    },
    KickVoteUpdate {
        room_id: TableId,
        kick_vote_id: Uuid,
        yes_votes: u32,
        required_votes: u32,
        passed: bool,
    },
    PlayerRemoved {
        room_id: TableId,
        player_id: UserId,
        reason: String,
    },
    #[serde(rename = "HandResult")]
    HandResult(HandResult),
    #[serde(rename = "Error")]
    Error {
        room_id: Option<TableId>,
        target_user_id: Option<UserId>,
        message: String,
    },
    #[serde(rename = "Connected")]
    Connected {
        room_id: TableId,
        user_id: UserId,
        seat_index: u8,
    },
    #[serde(rename = "PrivateMessage")]
    PrivateMessage {
        room_id: TableId,
        target_user_id: UserId,
        payload: PrivatePayload,
    },
    #[serde(rename = "RoomAssigned")]
    RoomAssigned { table_id: TableId, room_id: TableId },
    #[serde(rename = "TournamentState")]
    TournamentState(TournamentStateUpdate),
    #[serde(rename = "TournamentRegistered")]
    TournamentRegistered {
        tournament_id: sb_shared_types::TournamentId,
        user_id: UserId,
    },
    #[serde(rename = "TournamentStarting")]
    TournamentStarting {
        tournament_id: sb_shared_types::TournamentId,
        starts_in_seconds: u32,
    },
    #[serde(rename = "TournamentBlindLevel")]
    TournamentBlindLevel {
        tournament_id: sb_shared_types::TournamentId,
        level: u32,
        small_blind: i64,
        big_blind: i64,
        ante: i64,
    },
    #[serde(rename = "TournamentElimination")]
    TournamentElimination {
        tournament_id: sb_shared_types::TournamentId,
        user_id: UserId,
        position: u32,
    },
    #[serde(rename = "TournamentResult")]
    TournamentResult {
        tournament_id: sb_shared_types::TournamentId,
        results: Vec<TournamentResultPayload>,
    },
    #[serde(rename = "TournamentTableChanged")]
    TournamentTableChanged {
        tournament_id: sb_shared_types::TournamentId,
        new_room_id: TableId,
        new_seat: u8,
    },
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case", tag = "type")]
pub enum PrivatePayload {
    YourHoleCards { hole_cards: Vec<WsCard> },
    Analytics { analytics: AnalyticsPayload },
}

// === Connection / GameRoom ===

#[allow(dead_code)]
struct Connection {
    #[allow(dead_code)]
    user_id: UserId,
    #[allow(dead_code)]
    display_name: String,
    tx: mpsc::UnboundedSender<axum::extract::ws::Message>,
    seat_index: Option<usize>,
    chip_stack: ChipAmount,
}

pub struct GameRoom {
    pub table_id: TableId,
    max_players: u8,
    small_blind: u64,
    big_blind: u64,
    connections: HashMap<UserId, Connection>,
    game_state: Option<sb_game_engine::game_state::GameState>,
    dealer_index: usize,
}

impl GameRoom {
    pub fn new(table_id: TableId, small_blind: u64, big_blind: u64) -> Self {
        Self {
            table_id,
            max_players: 5,
            small_blind,
            big_blind,
            connections: HashMap::new(),
            game_state: None,
            dealer_index: 0,
        }
    }

    pub fn connect(
        &mut self,
        user_id: UserId,
        display_name: String,
        tx: mpsc::UnboundedSender<axum::extract::ws::Message>,
    ) {
        self.connections.insert(
            user_id,
            Connection {
                user_id,
                display_name,
                tx,
                seat_index: None,
                chip_stack: ChipAmount::default(),
            },
        );
    }

    pub fn disconnect(&mut self, _user_id: &UserId) {}

    pub fn seat_player(&mut self, user_id: UserId, buy_in: u64) -> Result<(), String> {
        let seat = self.connections.len() % self.max_players as usize;
        let conn = self
            .connections
            .get_mut(&user_id)
            .ok_or("Player not connected")?;
        conn.seat_index = Some(seat);
        conn.chip_stack = ChipAmount::new(buy_in as i64).unwrap_or_default();
        Ok(())
    }

    pub fn apply_action(
        &mut self,
        user_id: UserId,
        action: &str,
        amount: Option<u64>,
    ) -> Result<(), String> {
        use sb_game_engine::game_state::Action;

        let parsed_action = match action {
            "fold" => Action::Fold,
            "check" => Action::Check,
            "call" => Action::Call,
            "raise" => {
                let amt = amount.ok_or("Raise requires amount")?;
                Action::Raise(ChipAmount::new(amt as i64).ok_or("Invalid raise amount")?)
            }
            "allin" => {
                let conn = self
                    .connections
                    .get(&user_id)
                    .ok_or("Player not connected")?;
                let stack = conn.chip_stack;
                Action::Raise(stack)
            }
            _ => return Err(format!("Unknown action: {}", action)),
        };

        let _ = parsed_action;
        Ok(())
    }

    pub fn start_hand(&mut self) -> Result<(), String> {
        use sb_game_engine::game_state::GameState;

        let sb = ChipAmount::new(self.small_blind as i64).unwrap();
        let bb = ChipAmount::new(self.big_blind as i64).unwrap();

        let players: Vec<(sb_shared_types::PlayerId, ChipAmount)> = self
            .connections
            .iter()
            .filter_map(|(uid, conn)| {
                conn.seat_index.map(|_| {
                    (
                        sb_shared_types::PlayerId::new(uid.as_uuid()),
                        conn.chip_stack,
                    )
                })
            })
            .collect();

        if players.len() < 2 {
            return Err("Need at least 2 players".to_string());
        }

        self.game_state = Some(
            GameState::new_hand(self.table_id, players, self.dealer_index, (sb, bb))
                .map_err(|e| e.to_string())?,
        );

        Ok(())
    }
}
