#![allow(dead_code)]
#![allow(unused_imports)]

use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use std::sync::atomic::{AtomicU8, Ordering};
use std::time::{Duration as StdDuration, Instant, SystemTime, UNIX_EPOCH};
use uuid::Uuid;

use futures::future::join_all;
use tokio::sync::mpsc;

use sb_contracts::stats_api::PlayerStatsRepo;
use sb_game_engine::game_state::{Action, ActionError, GameState};
use sb_shared_types::AppError;
use sb_shared_types::player_stats::PlayerStatsDto;
use sb_shared_types::{ActionType, ChipAmount, PlayerId, StakeLevel, TableConfig, TableId, UserId};

use crate::connection_broker::ConnectionBroker;
use crate::events::HandCompletedEvent;
use chrono::Utc;
use sb_db_entities::hand_history_json::{
    HandAction, HandActions, HandPlayer, HandPlayers, HandResult, PotSplit, Winner,
};

use crate::game_room::{
    ActionBroadcast, ActionInfo, ActionRequired, AnalyticsPayload, HandResult as RoomHandResult,
    PlayerStateInfo, PrivatePayload, RoomMessage, ShowdownPlayer, ShowdownReveal, SidePotMessage,
    TableStateUpdate, WinnerResult, WsCard,
};
use tokio::time::{Duration, sleep};
use tracing::{Instrument, Level, debug, error, info, span, warn};

fn zero() -> ChipAmount {
    ChipAmount::new(0).unwrap()
}

fn blinds_for_stake(stake: StakeLevel) -> (ChipAmount, ChipAmount) {
    match stake {
        StakeLevel::Micro => (ChipAmount::new(2).unwrap(), ChipAmount::new(5).unwrap()),
        StakeLevel::Low => (ChipAmount::new(10).unwrap(), ChipAmount::new(25).unwrap()),
        StakeLevel::Medium => (ChipAmount::new(50).unwrap(), ChipAmount::new(100).unwrap()),
        StakeLevel::High => (ChipAmount::new(200).unwrap(), ChipAmount::new(400).unwrap()),
        StakeLevel::VeryHigh => (
            ChipAmount::new(500).unwrap(),
            ChipAmount::new(1000).unwrap(),
        ),
    }
}

pub fn buy_in_limits_for_stake(stake: StakeLevel) -> (ChipAmount, ChipAmount) {
    let (_, bb) = blinds_for_stake(stake);
    let bb_val = bb.as_i64();
    let min =
        ChipAmount::new(bb_val.saturating_mul(20)).unwrap_or_else(|| ChipAmount::new(100).unwrap());
    let max = ChipAmount::new(bb_val.saturating_mul(200))
        .unwrap_or_else(|| ChipAmount::new(10_000).unwrap());
    (min, max)
}

fn street_name(state: &GameState) -> String {
    let cards = state.community_cards();
    match cards.len() {
        0 => "preflop".to_string(),
        3 => "flop".to_string(),
        4 => "turn".to_string(),
        5 => "river".to_string(),
        _ => format!("unknown({})", cards.len()),
    }
}

fn get_hand_description(strength: &sb_game_engine::evaluate::HandStrength) -> String {
    use sb_game_engine::hand_rank::HandRank;

    let rank_short = |val: u8| -> String {
        match val {
            14 => "A".to_string(),
            13 => "K".to_string(),
            12 => "Q".to_string(),
            11 => "J".to_string(),
            10 => "10".to_string(),
            _ => val.to_string(),
        }
    };

    match strength.rank {
        HandRank::HighCard => {
            if let Some(&kicker) = strength.kickers.first() {
                format!("{} High", rank_short(kicker))
            } else {
                "High Card".to_string()
            }
        }
        HandRank::OnePair => {
            if let Some(&kicker) = strength.kickers.first() {
                format!("Pair of {}s", rank_short(kicker))
            } else {
                "One Pair".to_string()
            }
        }
        HandRank::TwoPair => {
            if strength.kickers.len() >= 3 {
                let high = strength.kickers[0];
                let low = strength.kickers[2];
                format!("Two Pair {}s & {}s", rank_short(high), rank_short(low))
            } else {
                "Two Pair".to_string()
            }
        }
        HandRank::ThreeOfAKind => {
            if let Some(&kicker) = strength.kickers.first() {
                format!("Trips {}s", rank_short(kicker))
            } else {
                "Three of a Kind".to_string()
            }
        }
        HandRank::Straight => {
            if let Some(&kicker) = strength.kickers.first() {
                format!("Straight to {}", rank_short(kicker))
            } else {
                "Straight".to_string()
            }
        }
        HandRank::Flush => {
            if let Some(&kicker) = strength.kickers.first() {
                format!("{} High Flush", rank_short(kicker))
            } else {
                "Flush".to_string()
            }
        }
        HandRank::FullHouse => {
            if strength.kickers.len() >= 4 {
                let three = strength.kickers[0];
                let two = strength.kickers[3];
                format!(
                    "Full House {}s over {}s",
                    rank_short(three),
                    rank_short(two)
                )
            } else {
                "Full House".to_string()
            }
        }
        HandRank::FourOfAKind => {
            if let Some(&kicker) = strength.kickers.first() {
                format!("Quads {}s", rank_short(kicker))
            } else {
                "Four of a Kind".to_string()
            }
        }
        HandRank::StraightFlush => {
            if let Some(&kicker) = strength.kickers.first() {
                format!("Straight Flush to {}", rank_short(kicker))
            } else {
                "Straight Flush".to_string()
            }
        }
    }
}

/// Whether the table is a cash game or part of a tournament.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TableMode {
    Cash,
    Tournament {
        parent: sb_shared_types::TournamentId,
        no_rebuy: bool,
    },
}

/// Result returned from TransferPlayerOut.
#[derive(Debug)]
pub struct TransferOutResult {
    pub player_id: PlayerId,
    pub stack: ChipAmount,
}

#[derive(Debug)]
pub enum LeaveResult {
    Refunded(ChipAmount),
    Cancelled,
}

#[derive(Debug)]
pub enum InternalCommand {
    Join {
        user_id: UserId,
        display_name: String,
        seat: Option<u8>,
        stack: ChipAmount,
        msg_tx: mpsc::UnboundedSender<RoomMessage>,
        respond_to: tokio::sync::oneshot::Sender<bool>,
    },
    Reconnect {
        user_id: UserId,
        msg_tx: mpsc::UnboundedSender<RoomMessage>,
        respond_to: tokio::sync::oneshot::Sender<bool>,
    },
    Leave {
        user_id: UserId,
        respond_to: tokio::sync::oneshot::Sender<LeaveResult>,
        force: bool,
    },
    Rebuy {
        user_id: UserId,
        stack: ChipAmount,
    },
    Action {
        user_id: UserId,
        action_type: ActionType,
        amount: Option<ChipAmount>,
    },
    SitOut {
        user_id: UserId,
        sitting_out: bool,
    },
    StartKickVote {
        initiator_id: UserId,
        target_id: UserId,
        respond_to: Option<tokio::sync::oneshot::Sender<ChipAmount>>,
    },
    VoteKickYes {
        voter_id: UserId,
        kick_vote_id: Uuid,
    },
    KickVoteTimeout {
        kick_vote_id: Uuid,
    },

    StartHand,
    Timeout {
        user_id: UserId,
    },
    ShowdownComplete,
    ClearLastActions,
    Shutdown,
            self.emit_table_closed_event();
    UpdatePlayerStats {
        user_id: UserId,
        stats: PlayerStatsDto,
    },

    // ── Tournament commands ───────────────────────────────────────────
    EnterTournamentMode {
        parent: sb_shared_types::TournamentId,
        broker: Arc<ConnectionBroker>,
    },
    SetBlinds {
        small: ChipAmount,
        big: ChipAmount,
    },
    PauseHand {
        respond_to: tokio::sync::oneshot::Sender<()>,
    },
    ResumeHand {
        force_dealer_seat: Option<u8>,
        respond_to: tokio::sync::oneshot::Sender<Result<(), AppError>>,
    },
    TransferPlayerIn {
        user_id: UserId,
        player_id: PlayerId,
        stack: ChipAmount,
        seat: Option<u8>,
        respond_to: tokio::sync::oneshot::Sender<Result<u8, AppError>>,
    },
    TransferPlayerOut {
        user_id: UserId,
        respond_to: tokio::sync::oneshot::Sender<TransferOutResult>,
    },
    GetPlayerStack {
        user_id: UserId,
        respond_to: tokio::sync::oneshot::Sender<ChipAmount>,
    },
}

#[derive(Debug, Clone)]
struct KickVoteState {
    kick_vote_id: Uuid,
    initiator: UserId,
    target: UserId,
    yes_votes: HashSet<UserId>,
    started_at: Instant,
    required_votes: u32,
    active_players_count: u32,
}

struct Player {
    user_id: UserId,
    display_name: String,
    seat: u8,
    player_id: PlayerId,
    stack: ChipAmount,
    pub time_bank_remaining_seconds: u32,
    pub stats: Option<PlayerStatsDto>,
    pub is_leaving: bool,
    pub sitting_out: bool,
    pub force_leave: bool,
    pub leave_responder: Option<tokio::sync::oneshot::Sender<LeaveResult>>,
}

impl Player {
    fn new(user_id: UserId, display_name: String, seat: u8, stack: ChipAmount) -> Self {
            created_by,
            telegram_chat_id: chat_id,
        Self {
            user_id,
            display_name,
            seat,
            player_id: PlayerId(Uuid::new_v4()),
            stack,
            time_bank_remaining_seconds: 0,
            stats: None,
            is_leaving: false,
            sitting_out: false,
            force_leave: false,
            leave_responder: None,
        }
    }
}

struct ActiveHand {
    state: GameState,
    user_by_player_id: HashMap<PlayerId, UserId>,
    player_by_user_id: HashMap<UserId, PlayerId>,
    dealer_index: usize,
    timeout_handle: Option<tokio::task::JoinHandle<()>>,
    timeout_expires_at: Option<u64>,
    timeout_duration_ms: u64,
}

impl ActiveHand {
    fn new(
        state: GameState,
        user_by_player_id: HashMap<PlayerId, UserId>,
        player_by_user_id: HashMap<UserId, PlayerId>,
        dealer_index: usize,
    ) -> Self {
        Self {
            state,
            user_by_player_id,
            player_by_user_id,
            dealer_index,
            timeout_handle: None,
            timeout_expires_at: None,
            timeout_duration_ms: 30000,
        }
    }

    fn cancel_timeout(&mut self) {
        if let Some(handle) = self.timeout_handle.take() {
            handle.abort();
        }
        self.timeout_expires_at = None;
    }

    fn schedule_timeout(
        &mut self,
        user_id: UserId,
        cmd_tx: mpsc::Sender<InternalCommand>,
        duration_ms: u64,
    ) {
        self.cancel_timeout();
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;
        self.timeout_expires_at = Some(now + duration_ms);
        self.timeout_duration_ms = duration_ms;

        let tx = cmd_tx.clone();
        let handle = tokio::spawn(async move {
            sleep(Duration::from_millis(duration_ms)).await;
            let _ = tx.send(InternalCommand::Timeout { user_id }).await;
        });
        self.timeout_handle = Some(handle);
    }

    fn current_player_user(&self) -> Option<UserId> {
        self.state
            .current_player_id()
            .and_then(|pid| self.user_by_player_id.get(&pid).cloned())
    }

    fn player_stack(&self, user_id: UserId) -> Option<ChipAmount> {
        self.player_by_user_id
            .get(&user_id)
            .and_then(|pid| self.state.player_stack(*pid))
    }

    fn player_current_bet(&self, user_id: UserId) -> Option<ChipAmount> {
        self.player_by_user_id
            .get(&user_id)
            .and_then(|pid| self.state.player_current_bet(*pid))
    }

    fn player_is_all_in(&self, user_id: UserId) -> bool {
        self.player_by_user_id
            .get(&user_id)
            .map(|pid| self.state.player_is_all_in(*pid))
            .unwrap_or(false)
    }

    fn player_is_folded(&self, user_id: UserId) -> bool {
        self.player_by_user_id
            .get(&user_id)
            .map(|pid| self.state.player_is_folded(*pid))
            .unwrap_or(false)
    }
}

fn build_action_required(room_id: TableId, hand: &ActiveHand, user_id: UserId) -> ActionRequired {
    let to_call = hand.state.current_call_amount();
    let min_raise = hand.state.min_raise_amount();
    let can_check = to_call == ChipAmount::new(0).unwrap();
    let pot = hand.state.current_pot();

    let expires_at = hand.timeout_expires_at.unwrap_or_else(|| {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64
            + hand.timeout_duration_ms
    });

    ActionRequired {
        room_id,
        player_id: user_id,
        expires_at,
        timeout_ms: hand.timeout_duration_ms,
        to_call: to_call.as_i64() as u64,
        min_raise: min_raise.as_i64() as u64,
        can_check,
        pot: pot.as_i64() as u64,
    }
}

fn build_analytics(hand: &ActiveHand, user_id: UserId) -> Option<AnalyticsPayload> {
    let pid = hand.player_by_user_id.get(&user_id)?;
    let hole_cards = hand.state.player_hole_cards(*pid)?;
    let comm_cards = hand.state.community_cards();
    let to_call = hand.state.current_call_amount();
    let pot = hand.state.current_pot();

    let pot_odds = if to_call.as_i64() > 0 {
        let odds = pot.as_i64() as f32 / to_call.as_i64() as f32;
        (odds * 10.0).round() / 10.0
    } else {
        0.0
    };

    let mut all_cards = hole_cards.to_vec();
    all_cards.extend_from_slice(comm_cards);

    let (strength, _winning_cards) = sb_game_engine::evaluate::evaluate_best_hand(&all_cards);

    let best_hand_name = get_hand_description(&strength);
    let base_strength = get_strength_score(&strength);
    let win_prob = run_monte_carlo(&hole_cards, comm_cards, 300);

    Some(AnalyticsPayload {
        win_prob,
        pot_odds,
        best_hand: best_hand_name,
        strength: base_strength,
    })
}

fn get_strength_score(strength: &sb_game_engine::evaluate::HandStrength) -> u8 {
    use sb_game_engine::hand_rank::HandRank;

    let base = match strength.rank {
        HandRank::HighCard => 0,
        HandRank::OnePair => 25,
        HandRank::TwoPair => 45,
        HandRank::ThreeOfAKind => 60,
        HandRank::Straight => 70,
        HandRank::Flush => 80,
        HandRank::FullHouse => 88,
        HandRank::FourOfAKind => 95,
        HandRank::StraightFlush => 99,
    };

    if let Some(&kicker) = strength.kickers.first() {
        let bonus = (kicker - 2) / 4;
        let total = base + bonus;
        if total > 100 { 100 } else { total }
    } else {
        base
    }
}

fn run_monte_carlo(
    hero_cards: &[sb_shared_types::Card; 2],
    community_cards: &[sb_shared_types::Card],
    iterations: u32,
) -> u8 {
    use rand::seq::SliceRandom;
    use sb_shared_types::{Card, Rank, Suit};

    let mut wins = 0;
    let mut ties = 0;

    let mut remaining_deck: Vec<Card> = Vec::new();
    for suit in [Suit::Clubs, Suit::Diamonds, Suit::Hearts, Suit::Spades] {
        for rank in [
            Rank::Two,
            Rank::Three,
            Rank::Four,
            Rank::Five,
            Rank::Six,
            Rank::Seven,
            Rank::Eight,
            Rank::Nine,
            Rank::Ten,
            Rank::Jack,
            Rank::Queen,
            Rank::King,
            Rank::Ace,
        ] {
            let c = Card { suit, rank };
            if !hero_cards.contains(&c) && !community_cards.contains(&c) {
                remaining_deck.push(c);
            }
        }
    }

    let mut rng = rand::rng();

    for _ in 0..iterations {
        remaining_deck.shuffle(&mut rng);

        let opp_cards: [Card; 2] = [remaining_deck[0], remaining_deck[1]];
        let fill_count = 5 - community_cards.len();
        let fill_comm: Vec<Card> = remaining_deck[2..2 + fill_count].to_vec();

        let mut hero_comm = community_cards.to_vec();
        hero_comm.extend_from_slice(&fill_comm);
        let hero_comm_5: [Card; 5] = hero_comm[..5].try_into().unwrap();

        let mut opp_comm = community_cards.to_vec();
        opp_comm.extend_from_slice(&fill_comm);
        let opp_comm_5: [Card; 5] = opp_comm[..5].try_into().unwrap();

        let (hero_strength, _) =
            sb_game_engine::evaluate::evaluate_hand_strength(hero_cards, &hero_comm_5);
        let (opp_strength, _) =
            sb_game_engine::evaluate::evaluate_hand_strength(&opp_cards, &opp_comm_5);

        match hero_strength.cmp(&opp_strength) {
            std::cmp::Ordering::Greater => wins += 1,
            std::cmp::Ordering::Equal => ties += 1,
            _ => {}
        }
    }

    (((wins as f32) + (ties as f32) * 0.5) / iterations as f32 * 100.0) as u8
}

pub struct TableActor {
    pub created_by: sb_shared_types::UserId,
    pub telegram_chat_id: Option<String>,
    room_id: TableId,
    table_id: TableId,
    config: TableConfig,
    players: HashMap<UserId, Player>,
    current_hand: Option<ActiveHand>,
    user_senders: HashMap<UserId, mpsc::UnboundedSender<RoomMessage>>,
    cmd_tx: mpsc::Sender<InternalCommand>,
    last_dealer_index: Option<usize>,
    event_tx: tokio::sync::broadcast::Sender<HandCompletedEvent>,
    hand_players: Vec<HandPlayer>,
    hand_actions: Vec<HandAction>,
    hand_started_at: Option<chrono::DateTime<chrono::Utc>>,
    last_actions: HashMap<UserId, ActionInfo>,
    stats_repo: Arc<dyn PlayerStatsRepo + Send + Sync>,
    active_players: Arc<AtomicU8>,
    kick_vote_state: Option<KickVoteState>,
    kick_cooldowns: HashMap<UserId, Instant>,
    kick_refund_responder: Option<tokio::sync::oneshot::Sender<ChipAmount>>,

    // ── Tournament extensions ───────────────────────────────────────────
    mode: TableMode,
    broker: Option<Arc<ConnectionBroker>>,
    current_blinds: Option<(ChipAmount, ChipAmount)>,
    paused: bool,
    timeout_handle: Option<tokio::task::JoinHandle<()>>,
    busted_players_cache: Option<Vec<(UserId, ChipAmount)>>,
}

impl TableActor {
    fn emit_table_closed_event(&self) {
        use sb_shared_types::{UserId, TableId, ChipAmount};
        use crate::events::{TableClosedEvent, TableEvent};

        // Retrieve final game result.
        // In a real implementation, you would call self.game_state.last_hand_result() or similar.
        let (winner, hand_desc, pot) = if let Some(ref game) = self.game {
            // Placeholder – extract real data here.
            tracing::warn!("Game data not fully retrieved; using placeholder");
            (None, "Unknown".to_string(), ChipAmount(0))
        } else {
            (None, "Unknown".to_string(), ChipAmount(0))
        };

        let event = TableClosedEvent {
            table_id: self.table_id,
            room_id: self.table_id,
            started_by: self.created_by,
            winner,
            winning_hand_description: hand_desc,
            pot_amount: pot,
            chat_id: self.telegram_chat_id.clone(),
        };

        let _ = self.event_tx.send(TableEvent::TableClosed(event));
    fn emit_table_closed_event(&self) {
        use sb_shared_types::{UserId, TableId, ChipAmount};
        use crate::events::{TableClosedEvent, TableEvent};

        // Retrieve final game result.
        // In a real implementation, you would call self.game_state.last_hand_result() or similar.
        let (winner, hand_desc, pot) = if let Some(ref game) = self.game {
            // Placeholder – extract real data here.
            tracing::warn!("Game data not fully retrieved; using placeholder");
            (None, "Unknown".to_string(), ChipAmount(0))
        } else {
            (None, "Unknown".to_string(), ChipAmount(0))
        };

        let event = TableClosedEvent {
            table_id: self.table_id,
            room_id: self.table_id,
            started_by: self.created_by,
            winner,
            winning_hand_description: hand_desc,
            pot_amount: pot,
            chat_id: self.telegram_chat_id.clone(),
        };

        let _ = self.event_tx.send(TableEvent::TableClosed(event));
    }
    fn emit_table_closed_event(&self) {
        use sb_shared_types::{UserId, TableId, ChipAmount};
        use crate::events::{TableClosedEvent, TableEvent};

        // Retrieve final game result.
        // In a real implementation, you would call self.game_state.last_hand_result() or similar.
        let (winner, hand_desc, pot) = if let Some(ref game) = self.game {
            // Placeholder – extract real data here.
            tracing::warn!("Game data not fully retrieved; using placeholder");
            (None, "Unknown".to_string(), ChipAmount(0))
        } else {
            (None, "Unknown".to_string(), ChipAmount(0))
        };

        let event = TableClosedEvent {
            table_id: self.table_id,
            room_id: self.table_id,
            started_by: self.created_by,
            winner,
            winning_hand_description: hand_desc,
            pot_amount: pot,
            chat_id: self.telegram_chat_id.clone(),
        };

        let _ = self.event_tx.send(TableEvent::TableClosed(event));
    }
    }

