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
    UpdatePlayerStats {
        user_id: UserId,
        stats: PlayerStatsDto,
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
}

impl TableActor {
    pub fn new(
        room_id: TableId,
        table_id: TableId,
        config: TableConfig,
        cmd_tx: mpsc::Sender<InternalCommand>,
        event_tx: tokio::sync::broadcast::Sender<HandCompletedEvent>,
        stats_repo: Arc<dyn PlayerStatsRepo + Send + Sync>,
        active_players: Arc<AtomicU8>,
    ) -> Self {
        Self {
            room_id,
            table_id,
            config,
            players: HashMap::new(),
            current_hand: None,
            user_senders: HashMap::new(),
            cmd_tx,
            last_dealer_index: None,
            event_tx,
            hand_players: Vec::new(),
            hand_actions: Vec::new(),
            hand_started_at: None,
            last_actions: HashMap::new(),
            stats_repo,
            active_players,
            kick_vote_state: None,
            kick_cooldowns: HashMap::new(),
            kick_refund_responder: None,
        }
    }

    fn send_to_all(
        user_senders: &HashMap<UserId, mpsc::UnboundedSender<RoomMessage>>,
        msg: RoomMessage,
    ) {
        for tx in user_senders.values() {
            let _ = tx.send(msg.clone());
        }
    }

    fn send_to_user(
        user_senders: &HashMap<UserId, mpsc::UnboundedSender<RoomMessage>>,
        user_id: &UserId,
        msg: RoomMessage,
    ) {
        if let Some(tx) = user_senders.get(user_id) {
            let _ = tx.send(msg);
        }
    }

    pub async fn run(mut self, mut rx: mpsc::Receiver<InternalCommand>) {
        let span =
            span!(Level::INFO, "table_actor", room_id = %self.room_id, table_id = %self.table_id);
        async move {
            info!("Table actor started");
            while let Some(cmd) = rx.recv().await {
                if !self.handle_command(cmd).await {
                    break;
                }
            }
            info!("Table actor terminated");
        }
        .instrument(span)
        .await;
    }

    async fn handle_command(&mut self, cmd: InternalCommand) -> bool {
        debug!(?cmd, "Handling command");
        match cmd {
            InternalCommand::Join {
                user_id,
                display_name,
                seat,
                stack,
                msg_tx,
                respond_to,
            } => {
                self.join_player(user_id, display_name, seat, stack, msg_tx, respond_to)
                    .await
            }
            InternalCommand::Reconnect {
                user_id,
                msg_tx,
                respond_to,
            } => {
                debug!(%user_id, "Handling reconnect");
                let found = self.handle_reconnect(user_id, msg_tx).await;
                let _ = respond_to.send(found);
            }
            InternalCommand::Leave {
                user_id,
                respond_to,
                force,
            } => self.leave_player(user_id, respond_to, force).await,
            InternalCommand::Rebuy { user_id, stack } => self.process_rebuy(user_id, stack).await,
            InternalCommand::Action {
                user_id,
                action_type,
                amount,
            } => self.process_action(user_id, action_type, amount).await,
            InternalCommand::StartHand => self.start_new_hand().await,
            InternalCommand::Timeout { user_id } => self.handle_timeout(user_id).await,
            InternalCommand::ShowdownComplete => self.finalize_hand_after_reveal().await,
            InternalCommand::ClearLastActions => {
                self.last_actions.clear();
                self.broadcast_table_state();
            }
            InternalCommand::UpdatePlayerStats { user_id, stats } => {
                if let Some(player) = self.players.get_mut(&user_id) {
                    player.stats = Some(stats);
                    self.broadcast_table_state();
                }
            }
            InternalCommand::SitOut { user_id, sitting_out } => {
                self.set_sitting_out(user_id, sitting_out).await;
            }
            InternalCommand::StartKickVote { initiator_id, target_id, respond_to } => {
                self.start_kick_vote(initiator_id, target_id, respond_to).await;
            }
            InternalCommand::VoteKickYes { voter_id, kick_vote_id } => {
                self.cast_kick_vote_yes(voter_id, kick_vote_id).await;
            }
            InternalCommand::KickVoteTimeout { kick_vote_id } => {
                self.timeout_kick_vote(kick_vote_id).await;
            }

            InternalCommand::Shutdown => {
                if let Some(hand) = &mut self.current_hand {
                    hand.cancel_timeout();
                }
                return false;
            }
        }
        true
    }

    async fn handle_reconnect(
        &mut self,
        user_id: UserId,
        msg_tx: mpsc::UnboundedSender<RoomMessage>,
    ) -> bool {
        self.user_senders.insert(user_id, msg_tx);

        let player_info = if let Some(player) = self.players.get_mut(&user_id) {
            if player.is_leaving {
                debug!(%user_id, "Player was leaving, canceling leave.");
                player.is_leaving = false;
                player.force_leave = false;
                player.sitting_out = false;
                player.sitting_out = false;
                if let Some(responder) = player.leave_responder.take() {
                    let _ = responder.send(LeaveResult::Cancelled);
                }
            }
            debug!(%user_id, "Player already at table, resyncing state for reconnect");
                player.sitting_out = false;
                player.sitting_out = false;
            Some(player.player_id)
        } else {
            None
        };

        if let Some(player_id) = player_info {
            let seat = self.players.get(&user_id).map(|p| p.seat).unwrap_or(0);
            Self::send_to_user(
                &self.user_senders,
                &user_id,
                RoomMessage::Connected {
                    room_id: self.room_id,
                    user_id,
                    seat_index: seat,
                },
            );
            self.broadcast_table_state();
            if let Some(hand) = &self.current_hand {
                if let Some(hole_cards) = hand.state.player_hole_cards(player_id) {
                    let ws_cards: Vec<WsCard> = hole_cards
                        .iter()
                        .map(|c| WsCard {
                            suit: format!("{:?}", c.suit).to_lowercase(),
                            rank: format!("{:?}", c.rank),
                        })
                        .collect();
                    Self::send_to_user(
                        &self.user_senders,
                        &user_id,
                        RoomMessage::PrivateMessage {
                            room_id: self.room_id,
                            target_user_id: user_id,
                            payload: PrivatePayload::YourHoleCards {
                                hole_cards: ws_cards,
                            },
                        },
                    );
                }
                if hand.current_player_user() == Some(user_id) {
                    let action_req = build_action_required(self.room_id, hand, user_id);
                    Self::send_to_user(
                        &self.user_senders,
                        &user_id,
                        RoomMessage::ActionRequired(action_req),
                    );
                }
                if let Some(analytics) = build_analytics(hand, user_id) {
                    Self::send_to_user(
                        &self.user_senders,
                        &user_id,
                        RoomMessage::PrivateMessage {
                            room_id: self.room_id,
                            target_user_id: user_id,
                            payload: PrivatePayload::Analytics { analytics },
                        },
                    );
                }
            }
            true
        } else {
            self.send_error_to(&user_id, "Not seated at table. Please buy in.");
            false
        }
    }

    async fn join_player(
        &mut self,
        user_id: UserId,
        display_name: String,
        seat: Option<u8>,
        stack: ChipAmount,
        msg_tx: mpsc::UnboundedSender<RoomMessage>,
        respond_to: tokio::sync::oneshot::Sender<bool>,
    ) {
        debug!(%user_id, stack = stack.as_i64(), "Attempting to join player");

        if let Some(player) = self.players.get_mut(&user_id) {
            if player.is_leaving {
                debug!(%user_id, "Player is rejoining while leave is pending. Converting to new join.");
                player.is_leaving = false;
                player.force_leave = false;
                player.sitting_out = false;
                player.sitting_out = false;
                player.stack = stack;
                if let Some(rt) = player.leave_responder.take() {
                    let _ = rt.send(LeaveResult::Cancelled);
                }

                self.user_senders.insert(user_id, msg_tx);
                Self::send_to_user(
                    &self.user_senders,
                    &user_id,
                    RoomMessage::Connected {
                        room_id: self.room_id,
                        user_id,
                        seat_index: player.seat,
                    },
                );
                self.broadcast_table_state();

                let _ = respond_to.send(false);
                return;
            }

            debug!(%user_id, "Player already exists, treating as reconnect");
            self.handle_reconnect(user_id, msg_tx).await;
            let _ = respond_to.send(false);
            return;
        }

        if stack < self.config.min_buy_in {
            self.send_error_to(
                &user_id,
                &format!(
                    "Buy-in of {} is below the table minimum of {}.",
                    stack.as_i64(),
                    self.config.min_buy_in.as_i64()
                ),
            );
            let _ = respond_to.send(false);
            return;
        }
        if stack > self.config.max_buy_in {
            self.send_error_to(
                &user_id,
                &format!(
                    "Buy-in of {} exceeds the table maximum of {}.",
                    stack.as_i64(),
                    self.config.max_buy_in.as_i64()
                ),
            );
            let _ = respond_to.send(false);
            return;
        }

        let seat = match seat {
            Some(s) => s,
            None => {
                let occupied: std::collections::HashSet<u8> =
                    self.players.values().map(|p| p.seat).collect();
                let mut free = None;
                for s in 0..self.config.max_players {
                    if !occupied.contains(&s) {
                        free = Some(s);
                        break;
                    }
                }
                match free {
                    Some(s) => s,
                    None => {
                        self.send_error_to(&user_id, "Table is full");
                        let _ = respond_to.send(false);
                        return;
                    }
                }
            }
        };
        if self.players.values().any(|p| p.seat == seat) {
            self.send_error_to(&user_id, &format!("Seat {} taken", seat));
            let _ = respond_to.send(false);
            return;
        }
        if seat >= self.config.max_players {
            self.send_error_to(&user_id, "Seat out of range");
            let _ = respond_to.send(false);
            return;
        }

        let player = Player::new(user_id, display_name, seat, stack);

        let stats_repo = self.stats_repo.clone();
        let cmd_tx = self.cmd_tx.clone();
        let uid = user_id;
        tokio::spawn(async move {
            if let Ok(stats_dto) = stats_repo.get(&uid.0.to_string()).await {
                let _ = cmd_tx
                    .send(InternalCommand::UpdatePlayerStats {
                        user_id: uid,
                        stats: stats_dto,
                    })
                    .await;
            }
        });

        self.players.insert(player.user_id, player);
        self.user_senders.insert(user_id, msg_tx);
        self.active_players.fetch_add(1, Ordering::Relaxed);

        Self::send_to_user(
            &self.user_senders,
            &user_id,
            RoomMessage::Connected {
                room_id: self.room_id,
                user_id,
                seat_index: seat,
            },
        );
        self.broadcast_table_state();
        info!(%user_id, seat, stack = stack.as_i64(), "Joined");

        if self.players.len() >= 2 && self.current_hand.is_none() {
            info!("2+ players seated and no hand in progress, auto-starting hand");
            self.start_new_hand().await;
        }

        let _ = respond_to.send(true);
    }

    async fn process_rebuy(&mut self, user_id: UserId, stack: ChipAmount) {
        if let Some(player) = self.players.get_mut(&user_id) {
            if player.is_leaving {
                self.send_error_to(&user_id, "You are in the process of leaving the table");
                return;
            }
            if player.stack > zero() {
                self.send_error_to(&user_id, "You still have chips, cannot rebuy");
                return;
            }
            if stack < self.config.min_buy_in || stack > self.config.max_buy_in {
                self.send_error_to(
                    &user_id,
                    &format!(
                        "Rebuy amount {} is outside the allowed range ({}–{}).",
                        stack.as_i64(),
                        self.config.min_buy_in.as_i64(),
                        self.config.max_buy_in.as_i64()
                    ),
                );
                return;
            }
            player.stack = stack;
            self.broadcast_table_state();
            info!(%user_id, stack = stack.as_i64(), "Player rebought");
            if self.players.len() >= 2 && self.current_hand.is_none() {
                info!("2+ players seated and no hand in progress, auto-starting hand after rebuy");
                self.start_new_hand().await;
            }
        } else {
            self.send_error_to(&user_id, "Not at table");
        }
    }

    async fn leave_player(
        &mut self,
        user_id: UserId,
        respond_to: tokio::sync::oneshot::Sender<LeaveResult>,
        force: bool,
    ) {
        debug!(%user_id, force, "Handling leave_player");

        if !self.players.contains_key(&user_id) {
            debug!(%user_id, "Leave failed: player not found");
            let _ = respond_to.send(LeaveResult::Refunded(zero()));
            return;
        }

        let mut should_fold = false;
        let mut is_in_hand = false;
        let mut responder_opt = Some(respond_to);

        if let Some(player) = self.players.get_mut(&user_id) {
            if player.is_leaving {
                debug!(%user_id, "Player already leaving. Updating force flag.");
                if force {
                    player.force_leave = true;
                }
                if let Some(old_rt) = player.leave_responder.take() {
                    let _ = old_rt.send(LeaveResult::Cancelled);
                }
                if let Some(rt) = responder_opt.take() {
                    player.leave_responder = Some(rt);
                }
                return;
            }

            if let Some(hand) = &self.current_hand
                && hand.player_by_user_id.contains_key(&user_id)
            {
                is_in_hand = true;
                player.is_leaving = true;
                player.force_leave = force;
                if let Some(rt) = responder_opt.take() {
                    player.leave_responder = Some(rt);
                }
                if force {
                    should_fold = true;
                }
                info!(%user_id, force, "Player left during hand. Deferring refund until hand completes.");
            }
        }

        if is_in_hand {
            if should_fold {
                debug!(%user_id, "Force folding player in hand");
                if let Some(hand) = &mut self.current_hand {
                    if let Some(pid) = hand.player_by_user_id.get(&user_id).copied()
                        && !hand.state.player_is_all_in(pid)
                        && let Err(e) = hand.state.force_fold(pid)
                    {
                        warn!(%user_id, error = ?e, "Failed to force fold player");
                    }
                    hand.cancel_timeout();

                    let new_stack = self
                        .players
                        .get(&user_id)
                        .map(|p| p.stack)
                        .unwrap_or_else(zero)
                        .as_i64() as u64;
                    let new_pot = hand.state.current_pot().as_i64() as u64;

                    self.last_actions.insert(
                        user_id,
                        ActionInfo {
                            text: "FOLD".to_string(),
                            amount: None,
                        },
                    );

                    Self::send_to_all(
                        &self.user_senders,
                        RoomMessage::ActionBroadcast(ActionBroadcast {
                            room_id: self.room_id,
                            player_id: user_id,
                            action: "fold".to_string(),
                            amount: None,
                            new_stack,
                            new_pot,
                        }),
                    );

                    self.check_hand_completion().await;
                    self.broadcast_table_state();
                }
            } else {
                self.broadcast_table_state();
            }
        } else {
            debug!(%user_id, "Force leaving player not in hand");
            if let Some(player) = self.players.remove(&user_id) {
                self.user_senders.remove(&user_id);
                self.active_players.fetch_sub(1, Ordering::Relaxed);
                let remaining_stack = player.stack;
                self.broadcast_table_state();
                info!(%user_id, stack = remaining_stack.as_i64(), "Player left and refunded.");
                if let Some(rt) = responder_opt.take() {
                    let _ = rt.send(LeaveResult::Refunded(remaining_stack));
                }
            }
        }
    }

    async fn start_new_hand(&mut self) {
        if self.current_hand.is_some() {
            warn!("Hand already in progress");
            return;
        }
        self.prune_cooldowns();
        self.prune_cooldowns();

        let active_players_count = self
            .players
            .values()
            .filter(|p| p.stack > zero() && !p.is_leaving)
            .count();
        if active_players_count < 2 {
            warn!("Not enough players with chips");
            return;
        }

        self.last_actions.clear();

        let user_ids: Vec<UserId> = self.players.keys().copied().collect();
        for uid in user_ids {
            let stats_repo = self.stats_repo.clone();
            let cmd_tx = self.cmd_tx.clone();
            tokio::spawn(async move {
                if let Ok(stats_dto) = stats_repo.get(&uid.0.to_string()).await {
                    let _ = cmd_tx
                        .send(InternalCommand::UpdatePlayerStats {
                            user_id: uid,
                            stats: stats_dto,
                        })
                        .await;
                }
            });
        }

        let dealer_index = match self.last_dealer_index {
            Some(idx) => (idx + 1) % active_players_count,
            None => 0,
        };
        let (sb, bb) = blinds_for_stake(self.config.stake_level);

        struct PlayerInfo {
            player_id: PlayerId,
            user_id: UserId,
            seat: u8,
            stack_before: ChipAmount,
        }

        let mut player_infos: Vec<PlayerInfo> = self
            .players
            .values()
            .filter(|p| p.stack > zero() && !p.is_leaving)
            .map(|p| PlayerInfo {
                player_id: p.player_id,
                user_id: p.user_id,
                seat: p.seat,
                stack_before: p.stack,
            })
            .collect();

        player_infos.sort_by_key(|p| p.seat);

        let players_for_engine: Vec<(PlayerId, ChipAmount)> = player_infos
            .iter()
            .map(|p| (p.player_id, p.stack_before))
            .collect();

        let small_idx = (dealer_index + 1) % players_for_engine.len();
        let big_idx = (dealer_index + 2) % players_for_engine.len();
        if players_for_engine[small_idx].1 < sb {
            error!("Small blind insufficient");
            return;
        }
        if players_for_engine[big_idx].1 < bb {
            error!("Big blind insufficient");
            return;
        }

        let dealer_pid = players_for_engine[dealer_index].0;
        let state =
            match GameState::new_hand(self.table_id, players_for_engine, dealer_index, (sb, bb)) {
                Ok(s) => s,
                Err(e) => {
                    error!(error = %e, "Failed to create hand");
                    return;
                }
            };

        for player in self.players.values_mut() {
            if let Some(engine_stack) = state.player_stack(player.player_id) {
                player.stack = engine_stack;
            }
        }

        let mut user_by_player_id = HashMap::new();
        let mut player_by_user_id = HashMap::new();
        for player in self.players.values() {
            user_by_player_id.insert(player.player_id, player.user_id);
            player_by_user_id.insert(player.user_id, player.player_id);
        }

        let mut active = ActiveHand::new(state, user_by_player_id, player_by_user_id, dealer_index);
        active.timeout_duration_ms = self.config.turn_time_limit_ms;

        self.hand_players.clear();
        self.hand_actions.clear();
        self.hand_started_at = Some(Utc::now());

        for p in &player_infos {
            if let Some(hole_cards) = active.state.player_hole_cards(p.player_id) {
                let hole_strs = [
                    format!("{:?}{:?}", hole_cards[0].rank, hole_cards[0].suit),
                    format!("{:?}{:?}", hole_cards[1].rank, hole_cards[1].suit),
                ];
                self.hand_players.push(HandPlayer {
                    player_id: p.player_id,
                    user_id: Some(p.user_id),
                    seat: p.seat,
                    hole_cards: Some(hole_strs),
                    stack_before: p.stack_before.as_i64(),
                    stack_after: p.stack_before.as_i64(),
                    is_dealer: p.player_id == dealer_pid,
                });
            }
        }

        for player in self.players.values() {
            if player.stack == zero() || player.is_leaving {
                continue;
            }
            if let Some(hole_cards) = active.state.player_hole_cards(player.player_id) {
                let ws_cards: Vec<WsCard> = hole_cards
                    .iter()
                    .map(|c| WsCard {
                        suit: format!("{:?}", c.suit).to_lowercase(),
                        rank: format!("{:?}", c.rank),
                    })
                    .collect();
                Self::send_to_user(
                    &self.user_senders,
                    &player.user_id,
                    RoomMessage::PrivateMessage {
                        room_id: self.room_id,
                        target_user_id: player.user_id,
                        payload: PrivatePayload::YourHoleCards {
                            hole_cards: ws_cards,
                        },
                    },
                );
            }
        }

        if let Some(user) = active.current_player_user() {
            let is_leaving = self
                .players
                .get(&user)
                .map(|p| p.is_leaving)
                .unwrap_or(false);
            if is_leaving {
                let cmd_tx = self.cmd_tx.clone();
                tokio::spawn(async move {
                    tokio::time::sleep(Duration::from_millis(100)).await;
                    let _ = cmd_tx
                        .send(InternalCommand::Timeout { user_id: user })
                        .await;
                });
            } else {
                active.schedule_timeout(user, self.cmd_tx.clone(), self.config.turn_time_limit_ms);
            }
            let action_req = build_action_required(self.room_id, &active, user);
            Self::send_to_all(&self.user_senders, RoomMessage::ActionRequired(action_req));
        }

        self.last_dealer_index = Some(dealer_index);
        self.current_hand = Some(active);

        if let Some(hand) = &self.current_hand {
            self.broadcast_analytics(hand);
        }
        self.broadcast_table_state();
        info!(dealer_index, "Hand started");
    }

    async fn process_action(
        &mut self,
        user_id: UserId,
        action_type: ActionType,
        amount: Option<ChipAmount>,
    ) {
        let hand = match &mut self.current_hand {
            Some(h) => h,
            None => {
                self.send_error_to(&user_id, "No active hand");
                return;
            }
        };

        if hand.current_player_user() != Some(user_id) {
            let turn_user = hand.current_player_user();
            self.send_error_to(
                &user_id,
                &format!(
                    "Not your turn — it's {}'s turn",
                    turn_user
                        .map(|u| u.to_string())
                        .unwrap_or_else(|| "unknown".into())
                ),
            );
            return;
        }

        let player_id = match hand.player_by_user_id.get(&user_id) {
            Some(pid) => *pid,
            None => {
                self.send_error_to(&user_id, "Not in hand");
                return;
            }
        };

        let engine_action = match action_type {
            ActionType::Fold => Action::Fold,
            ActionType::Check => Action::Check,
            ActionType::Call => Action::Call,
            ActionType::Raise => {
                let raise = amount.unwrap_or_else(zero);
                let min_raise = hand.state.min_raise_amount();
                if raise < min_raise {
                    self.send_error_to(&user_id, &format!("Minimum raise is {}", min_raise));
                    return;
                }
                Action::Raise(raise)
            }
            ActionType::AllIn => {
                let stack = self
                    .players
                    .get(&user_id)
                    .map(|p| p.stack)
                    .unwrap_or_else(zero);
                Action::Raise(stack)
            }
            ActionType::Bet => {
                let bet = amount.unwrap_or_else(zero);
                Action::Raise(bet)
            }
        };

        info!(%user_id, action = ?action_type, ?amount, "Processing action");
        let prev_comm_cards_len = hand.state.community_cards().len();

        match hand.state.apply_action(player_id, engine_action) {
            Ok(()) => {
                hand.cancel_timeout();

                if let Some(new_stack) = hand.player_stack(user_id)
                    && let Some(player) = self.players.get_mut(&user_id)
                {
                    player.stack = new_stack;
                }

                let new_pot = hand.state.current_pot();

                let action_str_lower = format!("{:?}", action_type).to_lowercase();
                let action_str_upper = match action_type {
                    ActionType::Fold => "FOLD",
                    ActionType::Check => "CHECK",
                    ActionType::Call => "CALL",
                    ActionType::Raise => "RAISE",
                    ActionType::AllIn => "ALL-IN",
                    ActionType::Bet => "BET",
                }
                .to_string();

                let amount_u64 = amount.map(|a| a.as_i64() as u64);
                let new_stack = self
                    .players
                    .get(&user_id)
                    .map(|p| p.stack)
                    .unwrap_or_else(zero);

                self.last_actions.insert(
                    user_id,
                    ActionInfo {
                        text: action_str_upper.clone(),
                        amount: amount_u64,
                    },
                );

                Self::send_to_all(
                    &self.user_senders,
                    RoomMessage::ActionBroadcast(ActionBroadcast {
                        room_id: self.room_id,
                        player_id: user_id,
                        action: action_str_lower,
                        amount: amount_u64,
                        new_stack: new_stack.as_i64() as u64,
                        new_pot: new_pot.as_i64() as u64,
                    }),
                );

                if let Some(started_at) = self.hand_started_at {
                    let elapsed_ms = (Utc::now() - started_at).num_milliseconds().max(0) as u64;
                    self.hand_actions.push(HandAction {
                        player_id,
                        action_type: format!("{:?}", action_type).to_lowercase(),
                        amount: amount.map(|a| a.as_i64()),
                        timestamp_ms: elapsed_ms,
                    });
                }

                if hand.state.community_cards().len() > prev_comm_cards_len {
                    let cmd_tx = self.cmd_tx.clone();
                    tokio::spawn(async move {
                        tokio::time::sleep(Duration::from_millis(1500)).await;
                        let _ = cmd_tx.send(InternalCommand::ClearLastActions).await;
                    });
                }

                if let Some(next) = hand.current_player_user() {
                    let is_leaving = self
                        .players
                        .get(&next)
                        .map(|p| p.is_leaving)
                        .unwrap_or(false);
                    if is_leaving {
                        let cmd_tx = self.cmd_tx.clone();
                        tokio::spawn(async move {
                            tokio::time::sleep(Duration::from_millis(100)).await;
                            let _ = cmd_tx
                                .send(InternalCommand::Timeout { user_id: next })
                                .await;
                        });
                    } else {
                        hand.schedule_timeout(
                            next,
                            self.cmd_tx.clone(),
                            self.config.turn_time_limit_ms,
                        );
                    }
                    let action_req = build_action_required(self.room_id, hand, next);
                    Self::send_to_all(&self.user_senders, RoomMessage::ActionRequired(action_req));

                    if hand.state.community_cards().len() > prev_comm_cards_len {
                        for player in self.players.values() {
                            if let Some(analytics) = build_analytics(hand, player.user_id) {
                                Self::send_to_user(
                                    &self.user_senders,
                                    &player.user_id,
                                    RoomMessage::PrivateMessage {
                                        room_id: self.room_id,
                                        target_user_id: player.user_id,
                                        payload: PrivatePayload::Analytics { analytics },
                                    },
                                );
                            }
                        }
                    }
                    self.broadcast_table_state();
                } else {
                    self.check_hand_completion().await;
                }
            }
            Err(e) => {
                let msg = match e {
                    ActionError::NotYourTurn => "Not your turn".into(),
                    ActionError::AlreadyFolded => "Already folded".into(),
                    ActionError::AlreadyAllIn => "Already all-in".into(),
                    ActionError::InvalidRaise { .. } => {
                        let min = hand.state.min_raise_amount();
                        format!(
                            "Invalid action — if facing a bet, use 'call' instead of 'check'. Minimum raise is {}",
                            min
                        )
                    }
                    ActionError::HandComplete => "Hand finished".into(),
                    ActionError::ShowdownNotActionable => "No actions in showdown".into(),
                    ActionError::InsufficientStack { action, .. } => {
                        format!("Insufficient stack to {}", action)
                    }
                };
                self.send_error_to(&user_id, &msg);
            }
        }
    }

    async fn handle_timeout(&mut self, user_id: UserId) {
        let hand = match &mut self.current_hand {
            Some(h) => h,
            None => return,
        };
        if hand.current_player_user() != Some(user_id) {
            return;
        }
        info!(%user_id, "Auto-fold timeout");
        let pid = match hand.player_by_user_id.get(&user_id) {
            Some(p) => *p,
            None => return,
        };
        let _ = hand.state.apply_action(pid, Action::Fold);
        hand.cancel_timeout();

        let new_stack = self
            .players
            .get(&user_id)
            .map(|p| p.stack)
            .unwrap_or_else(zero)
            .as_i64() as u64;
        let new_pot = hand.state.current_pot().as_i64() as u64;

        self.last_actions.insert(
            user_id,
            ActionInfo {
                text: "FOLD".to_string(),
                amount: None,
            },
        );

        Self::send_to_all(
            &self.user_senders,
            RoomMessage::ActionBroadcast(ActionBroadcast {
                room_id: self.room_id,
                player_id: user_id,
                action: "fold".to_string(),
                amount: None,
                new_stack,
                new_pot,
            }),
        );

        if let Some(next) = hand.current_player_user() {
            let is_leaving = self
                .players
                .get(&next)
                .map(|p| p.is_leaving)
                .unwrap_or(false);
            if is_leaving {
                let cmd_tx = self.cmd_tx.clone();
                tokio::spawn(async move {
                    tokio::time::sleep(Duration::from_millis(100)).await;
                    let _ = cmd_tx
                        .send(InternalCommand::Timeout { user_id: next })
                        .await;
                });
            } else {
                hand.schedule_timeout(next, self.cmd_tx.clone(), self.config.turn_time_limit_ms);
            }
            let action_req = build_action_required(self.room_id, hand, next);
            Self::send_to_all(&self.user_senders, RoomMessage::ActionRequired(action_req));
            self.broadcast_table_state();
        } else {
            self.check_hand_completion().await;
        }
    }

    async fn check_hand_completion(&mut self) {
        let mut hand = match self.current_hand.take() {
            Some(h) => h,
            None => return,
        };
        hand.cancel_timeout();

        if !hand.state.is_hand_complete() {
            if let Some(next) = hand.current_player_user() {
                info!(%next, street = %street_name(&hand.state), "New street, notifying next player");
                let is_leaving = self
                    .players
                    .get(&next)
                    .map(|p| p.is_leaving)
                    .unwrap_or(false);
                if is_leaving {
                    let cmd_tx = self.cmd_tx.clone();
                    tokio::spawn(async move {
                        tokio::time::sleep(Duration::from_millis(100)).await;
                        let _ = cmd_tx
                            .send(InternalCommand::Timeout { user_id: next })
                            .await;
                    });
                } else {
                    hand.schedule_timeout(
                        next,
                        self.cmd_tx.clone(),
                        self.config.turn_time_limit_ms,
                    );
                }
                let action_req = build_action_required(self.room_id, &hand, next);
                Self::send_to_all(&self.user_senders, RoomMessage::ActionRequired(action_req));
            } else {
                warn!("Hand not complete but no current player — engine issue");
            }

            self.broadcast_analytics(&hand);
            self.current_hand = Some(hand);
            self.broadcast_table_state();
            return;
        }

        let active_count = hand
            .player_by_user_id
            .keys()
            .filter(|uid| !hand.player_is_folded(**uid))
            .count();
        let is_showdown = active_count > 1;

        let reveal = self.build_showdown_reveal(&hand, is_showdown);
        Self::send_to_all(&self.user_senders, RoomMessage::ShowdownReveal(reveal));

        self.current_hand = Some(hand);

        self.broadcast_table_state();

        let cmd_tx = self.cmd_tx.clone();
        let delay = if is_showdown {
            info!("Showdown reached — revealing cards with 3s delay");
            Duration::from_secs(3)
        } else {
            info!("Walkover — single player wins with 2.5s delay");
            Duration::from_millis(2_500)
        };

        tokio::spawn(async move {
            tokio::time::sleep(delay).await;
            let _ = cmd_tx.send(InternalCommand::ShowdownComplete).await;
        });
    }

    async fn finalize_hand_after_reveal(&mut self) {
        let hand = match self.current_hand.take() {
            Some(h) => h,
            None => {
                warn!("ShowdownComplete fired but no active hand — ignoring");
                return;
            }
        };
        self.finalize_hand(hand).await;
    }

    async fn finalize_hand(&mut self, hand: ActiveHand) {
        self.process_winners(&hand).await;

        let final_stacks: HashMap<PlayerId, i64> = self
            .players
            .values()
            .map(|p| (p.player_id, p.stack.as_i64()))
            .collect();
        for hp in &mut self.hand_players {
            if let Some(stack) = final_stacks.get(&hp.player_id) {
                hp.stack_after = *stack;
            }
        }

        let result = self.build_hand_result(&hand);
        let event = HandCompletedEvent {
            table_id: self.table_id,
            room_id: self.room_id,
            played_at: self.hand_started_at.unwrap_or_else(Utc::now),
            players: HandPlayers {
                seats: self.hand_players.clone(),
            },
            actions: HandActions {
                actions: self.hand_actions.clone(),
            },
            result,
        };

        if let Err(e) = self.event_tx.send(event) {
            warn!(
                table_id = %self.table_id,
                room_id = %self.room_id,
                error = %e,
                "Failed to send hand completed event"
            );
        }

        self.clear_board_and_start_next(hand).await;
    }

    fn build_hand_result(&self, hand: &ActiveHand) -> HandResult {
        let winners = hand.state.calculate_pot_winners();
        let pot_splits: Vec<PotSplit> = winners
            .iter()
            .map(|w| PotSplit {
                winner_id: w.player_id,
                amount: w.amount.as_i64(),
            })
            .collect();

        let community: Vec<String> = hand
            .state
            .community_cards()
            .iter()
            .map(|c| format!("{:?}{:?}", c.rank, c.suit))
            .collect();

        let winner_models: Vec<Winner> = winners
            .iter()
            .map(|w| Winner {
                player_id: w.player_id,
                hand_rank: w.hand_rank as u16,
                hand_description: w.hand_rank.name().to_string(),
                amount_won: w.amount.as_i64(),
            })
            .collect();

        HandResult {
            winners: winner_models,
            pot_distribution: pot_splits,
            community_cards: community,
        }
    }

    async fn process_winners(&mut self, hand: &ActiveHand) {
        let winners = hand.state.calculate_pot_winners();

        for winner in &winners {
            if let Some(user) = hand.user_by_player_id.get(&winner.player_id)
                && let Some(player) = self.players.get_mut(user)
            {
                player.stack = player
                    .stack
                    .checked_add(winner.amount)
                    .unwrap_or(player.stack);
            }
        }

        let winner_results: Vec<WinnerResult> = winners
            .iter()
            .filter_map(|w| {
                let user_id = hand.user_by_player_id.get(&w.player_id)?;
                let display_name = self
                    .players
                    .get(user_id)
                    .map(|p| p.display_name.clone())
                    .unwrap_or_else(|| user_id.to_string());
                Some(WinnerResult {
                    user_id: *user_id,
                    display_name,
                    amount: w.amount.as_i64() as u64,
                    hand_rank: w.hand_rank.name().to_string(),
                })
            })
            .collect();

        let total_pot = hand.state.current_pot().as_i64() as u64;
        Self::send_to_all(
            &self.user_senders,
            RoomMessage::HandResult(RoomHandResult {
                room_id: self.room_id,
                winners: winner_results,
                pot: total_pot,
            }),
        );
    }

    async fn clear_board_and_start_next(&mut self, hand: ActiveHand) {
        self.last_dealer_index = Some(hand.dealer_index);
        self.current_hand = None;

        let mut users_to_remove = Vec::new();
        for (user_id, player) in &mut self.players {
            if player.is_leaving {
                if let Some(responder) = player.leave_responder.take() {
                    let _ = responder.send(LeaveResult::Refunded(player.stack));
                }
                users_to_remove.push(*user_id);
            }
        }
        for user_id in users_to_remove {
            self.players.remove(&user_id);
            self.user_senders.remove(&user_id);
            self.active_players.fetch_sub(1, Ordering::Relaxed);
        }

        self.broadcast_table_state();

        if self
            .players
            .values()
            .filter(|p| p.stack > zero() && !p.is_leaving)
            .count()
            >= 2
        {
            info!("Hand complete, auto-starting next hand");
            self.start_new_hand().await;
        }
    }

    fn build_showdown_reveal(&self, hand: &ActiveHand, is_showdown: bool) -> ShowdownReveal {
        let community: Vec<WsCard> = hand
            .state
            .community_cards()
            .iter()
            .map(|c| WsCard {
                suit: format!("{:?}", c.suit).to_lowercase(),
                rank: format!("{:?}", c.rank),
            })
            .collect();

        let winners = hand.state.calculate_pot_winners();

        let players: Vec<ShowdownPlayer> = hand
            .player_by_user_id
            .keys()
            .filter(|uid| !hand.player_is_folded(**uid))
            .filter_map(|user_id| {
                let user_id = *user_id;
                let pid = hand.player_by_user_id.get(&user_id)?;

                let hole_cards_opt = if is_showdown {
                    hand.state.player_hole_cards(*pid)
                } else {
                    None
                };

                let hole_cards: Vec<WsCard> = match hole_cards_opt {
                    Some(cards) => cards
                        .iter()
                        .map(|c| WsCard {
                            suit: format!("{:?}", c.suit).to_lowercase(),
                            rank: format!("{:?}", c.rank),
                        })
                        .collect(),
                    None => vec![],
                };

                let is_winner = winners.iter().any(|w| w.player_id == *pid);
                let win_amount = winners
                    .iter()
                    .find(|w| w.player_id == *pid)
                    .map(|w| w.amount.as_i64() as u64)
                    .unwrap_or(0);

                let seat = self.players.get(&user_id).map(|p| p.seat).unwrap_or(0);
                let display_name = self
                    .players
                    .get(&user_id)
                    .map(|p| p.display_name.clone())
                    .unwrap_or_else(|| "Player".to_string());

                let mut hand_description = String::new();
                let mut winning_cards_ws: Vec<WsCard> = vec![];

                if is_showdown
                    && community.len() >= 5
                    && is_winner
                    && let Some(cards) = hole_cards_opt
                    && cards.len() == 2
                    && let Some(comm) = community_cards_to_array(hand)
                {
                    let (strength, winning_cards_raw) =
                        sb_game_engine::evaluate::evaluate_hand_strength(&cards, &comm);
                    hand_description = get_hand_description(&strength);
                    winning_cards_ws = winning_cards_raw
                        .iter()
                        .map(|c| WsCard {
                            suit: format!("{:?}", c.suit).to_lowercase(),
                            rank: format!("{:?}", c.rank),
                        })
                        .collect();
                }

                Some(ShowdownPlayer {
                    user_id,
                    display_name,
                    seat,
                    hole_cards,
                    hand_description,
                    is_winner,
                    win_amount,
                    winning_cards: winning_cards_ws,
                })
            })
            .collect();

        ShowdownReveal {
            room_id: self.room_id,
            players,
            community_cards: community,
            pot: hand.state.current_pot().as_i64() as u64,
        }
    }

    fn broadcast_analytics(&self, hand: &ActiveHand) {
        for player in self.players.values() {
            if player.stack == zero() || player.is_leaving {
                continue;
            }
            if let Some(analytics) = build_analytics(hand, player.user_id) {
                Self::send_to_user(
                    &self.user_senders,
                    &player.user_id,
                    RoomMessage::PrivateMessage {
                        room_id: self.room_id,
                        target_user_id: player.user_id,
                        payload: PrivatePayload::Analytics { analytics },
                    },
                );
            }
        }
    }

    fn broadcast_table_state(&self) {
        let current_turn_user_id = self
            .current_hand
            .as_ref()
            .and_then(|h| h.current_player_user());
        let current_turn_expires_at = self
            .current_hand
            .as_ref()
            .and_then(|h| h.timeout_expires_at);
        let current_turn_timeout_ms = self.current_hand.as_ref().map(|h| h.timeout_duration_ms);
        let street = self
            .current_hand
            .as_ref()
            .map(|h| street_name(&h.state))
            .unwrap_or_default();

        let positions_map: HashMap<u8, String> = if let Some(hand) = &self.current_hand {
            let mut active_players: Vec<&Player> = self
                .players
                .values()
                .filter(|p| !hand.player_is_folded(p.user_id) && !hand.player_is_all_in(p.user_id))
                .collect();

            if active_players.len() <= 1 {
                HashMap::new()
            } else {
                active_players.sort_by_key(|p| p.seat);
                let num_players = active_players.len() as i32;

                let dealer_idx_in_active = active_players
                    .iter()
                    .position(|p| p.seat as usize == hand.dealer_index)
                    .map(|i| i as i32)
                    .unwrap_or(0);

                let mut map = HashMap::new();
                for (i, player) in active_players.iter().enumerate() {
                    let pos_idx = (i as i32 - dealer_idx_in_active + num_players) % num_players;
                    let badge = match num_players {
                        2 => match pos_idx {
                            0 => "BTN",
                            1 => "BB",
                            _ => "",
                        },
                        _ => match pos_idx {
                            0 => "BTN",
                            1 => "SB",
                            2 => "BB",
                            3 => "UTG",
                            n if n == num_players - 1 => "CO",
                            n if n == num_players - 2 => "HJ",
                            n if n == num_players - 3 => "MP",
                            _ => "",
                        },
                    };
                    if !badge.is_empty() {
                        map.insert(player.seat, badge.to_string());
                    }
                }
                map
            }
        } else {
            HashMap::new()
        };

        let players_state: Vec<PlayerStateInfo> = if let Some(hand) = &self.current_hand {
            self.players
                .values()
                .map(|player| {
                    let uid = player.user_id;
                    let stack = hand.player_stack(uid).unwrap_or_else(zero);
                    let bet = hand.player_current_bet(uid).unwrap_or_else(zero);
                    let all_in = hand.player_is_all_in(uid);
                    let folded = hand.player_is_folded(uid);
                    PlayerStateInfo {
                        user_id: uid,
                        display_name: player.display_name.clone(),
                        seat: player.seat,
                        stack,
                        current_bet: bet,
                        is_all_in: all_in,
                        is_folded: folded,
                        is_leaving: player.is_leaving,
                        sitting_out: player.sitting_out,
                        position_badge: positions_map.get(&player.seat).cloned(),
                        last_action: self.last_actions.get(&uid).cloned(),
                        stats: player.stats.clone(),
                    }
                })
                .collect()
        } else {
            self.players
                .values()
                .map(|player| PlayerStateInfo {
                    user_id: player.user_id,
                    display_name: player.display_name.clone(),
                    seat: player.seat,
                    stack: player.stack,
                    current_bet: zero(),
                    is_all_in: false,
                    is_folded: false,
                    is_leaving: player.is_leaving,
                        sitting_out: player.sitting_out,
                    position_badge: None,
                    last_action: None,
                    stats: player.stats.clone(),
                })
                .collect()
        };

        let community: Vec<WsCard> = self
            .current_hand
            .as_ref()
            .map(|h| {
                h.state
                    .community_cards()
                    .iter()
                    .map(|c| WsCard {
                        suit: format!("{:?}", c.suit).to_lowercase(),
                        rank: format!("{:?}", c.rank),
                    })
                    .collect()
            })
            .unwrap_or_default();

        let (pot, side_pots) = if let Some(hand) = &self.current_hand {
            let pot = hand.state.current_pot();
            let side_pots_vec: Vec<SidePotMessage> = hand
                .state
                .side_pots()
                .into_iter()
                .map(|sp| {
                    let eligible_users: Vec<UserId> = sp
                        .eligible_players
                        .iter()
                        .filter_map(|pid| hand.user_by_player_id.get(pid).copied())
                        .collect();
                    SidePotMessage {
                        amount: sp.amount.as_i64() as u64,
                        eligible_players: eligible_users,
                    }
                })
                .collect();
            (pot.as_i64() as u64, side_pots_vec)
        } else {
            (0, vec![])
        };

        let msg = RoomMessage::TableState(TableStateUpdate {
            room_id: self.room_id,
            players: players_state,
            current_hand_in_progress: self.current_hand.is_some(),
            community_cards: community,
            current_turn_user_id,
            current_turn_expires_at,
            current_turn_timeout_ms,
            street,
            pot,
            side_pots,
        });
        Self::send_to_all(&self.user_senders, msg);
    }

    fn send_error_to(&self, user_id: &UserId, msg: &str) {
        warn!(%user_id, "Error: {}", msg);
        Self::send_to_user(
            &self.user_senders,
            user_id,
            RoomMessage::Error {
                room_id: Some(self.room_id),
                target_user_id: Some(*user_id),
                message: msg.to_string(),
            },
        );
    }

    async fn set_sitting_out(&mut self, user_id: UserId, sitting_out: bool) {
        let player = match self.players.get_mut(&user_id) {
            Some(p) => p,
            None => { self.send_error_to(&user_id, "Not at table"); return; }
        };
        if player.sitting_out == sitting_out { return; }
        player.sitting_out = sitting_out;
        self.broadcast_table_state();
        if sitting_out { info!(%user_id, "Player sitting out"); }
        else { info!(%user_id, "Player sitting in"); }
    }

    async fn start_kick_vote(&mut self, initiator_id: UserId, target_id: UserId, respond_to: Option<tokio::sync::oneshot::Sender<ChipAmount>>) {
        if let Some(&last) = self.kick_cooldowns.get(&target_id)
            && last.elapsed() < StdDuration::from_secs(300)
        {
            self.send_error_to(&initiator_id, "Target is on kick cooldown (5 minutes)");
            return;
        }
        if self.kick_vote_state.is_some() {
            self.send_error_to(&initiator_id, "A kick vote is already in progress");
            return;
        }
        let _target = match self.players.get(&target_id) {
            Some(p) if p.sitting_out => p,
            _ => { self.send_error_to(&initiator_id, "Target is not sitting out"); return; }
        };
        if !self.players.get(&initiator_id).map(|p| !p.sitting_out).unwrap_or(false) {
            self.send_error_to(&initiator_id, "You are not an active player");
            return;
        }
        let active_players_count: u32 = self.players.values()
            .filter(|p| p.user_id != target_id && !p.sitting_out)
            .count() as u32;
        if active_players_count < 2 {
            self.send_error_to(&initiator_id, "Not enough active players to vote");
            return;
        }
        let required_votes = ((active_players_count / 2) + 1).max(2);
        let kick_vote_id = Uuid::new_v4();
        let state = KickVoteState {
            kick_vote_id,
            initiator: initiator_id,
            target: target_id,
            yes_votes: HashSet::new(),
            started_at: Instant::now(),
            required_votes,
            active_players_count,
        };
        Self::send_to_all(&self.user_senders, RoomMessage::KickVoteStarted {
            room_id: self.room_id,
            initiator_id,
            target_id,
            kick_vote_id,
            duration_secs: 10,
            required_votes,
        });
        let tx = self.cmd_tx.clone();
        let vid = kick_vote_id;
        tokio::spawn(async move {
            sleep(Duration::from_secs(10)).await;
            let _ = tx.send(InternalCommand::KickVoteTimeout { kick_vote_id: vid }).await;
        });
        self.kick_vote_state = Some(state);
        self.kick_refund_responder = respond_to;
    }

    async fn cast_kick_vote_yes(&mut self, voter_id: UserId, kick_vote_id: Uuid) {
        let state = match &mut self.kick_vote_state {
            Some(s) if s.kick_vote_id == kick_vote_id => s,
            _ => { self.send_error_to(&voter_id, "No matching kick vote"); return; }
        };
        if voter_id == state.target { self.send_error_to(&voter_id, "You cannot vote for yourself"); return; }
        if !self.players.get(&voter_id).map(|p| !p.sitting_out).unwrap_or(false) {
            self.send_error_to(&voter_id, "Only active players can vote");
            return;
        }
        if state.yes_votes.contains(&voter_id) { self.send_error_to(&voter_id, "You have already voted"); return; }
        state.yes_votes.insert(voter_id);
        let yes_count = state.yes_votes.len() as u32;
        let passed = yes_count >= state.required_votes;
        Self::send_to_all(&self.user_senders, RoomMessage::KickVoteUpdate {
            room_id: self.room_id,
            kick_vote_id,
            yes_votes: yes_count,
            required_votes: state.required_votes,
            passed,
        });
        if passed {
            let vid = state.kick_vote_id;
            self.finalize_kick_vote(vid).await;
        }
    }

    async fn timeout_kick_vote(&mut self, kick_vote_id: Uuid) {
        match &self.kick_vote_state {
            Some(s) if s.kick_vote_id == kick_vote_id => {
                info!(%kick_vote_id, "Kick vote timed out");
                info!(%kick_vote_id, "Kick vote timed out");
                self.broadcast_kick_vote_failed(&kick_vote_id);
                if let Some(responder) = self.kick_refund_responder.take() {
                    let _ = responder.send(zero());
                }
                self.kick_vote_state = None;
            }
            _ => {}
        }
    }

    async fn finalize_kick_vote(&mut self, kick_vote_id: Uuid) {
        let state = match self.kick_vote_state.take() {
            Some(s) if s.kick_vote_id == kick_vote_id => s,
            _ => return,
        };
        let refund_responder = self.kick_refund_responder.take();
        let (tx, rx) = tokio::sync::oneshot::channel();
        self.leave_player(state.target, tx, true).await;
        tokio::spawn(async move {
            let stack = match rx.await {
                Ok(LeaveResult::Refunded(stack)) => stack,
                _ => zero(),
            };
            if let Some(rt) = refund_responder { let _ = rt.send(stack); }
        });
        Self::send_to_all(&self.user_senders, RoomMessage::PlayerRemoved {
            room_id: self.room_id,
            player_id: state.target,
            reason: format!("Kicked by vote ({} yes votes)", state.yes_votes.len()),
        });
        self.broadcast_table_state();
    }

    fn broadcast_kick_vote_failed(&self, kick_vote_id: &Uuid) {
        Self::send_to_all(&self.user_senders, RoomMessage::KickVoteUpdate {
            room_id: self.room_id,
            kick_vote_id: *kick_vote_id,
            yes_votes: 0,
            required_votes: 0,
            passed: false,
        });
    }

    fn prune_cooldowns(&mut self) {
        self.kick_cooldowns.retain(|_, instant| instant.elapsed() < StdDuration::from_secs(300));
    }


    fn prune_cooldowns(&mut self) {
        self.kick_cooldowns.retain(|_, instant| instant.elapsed() < StdDuration::from_secs(300));
    }

}

fn community_cards_to_array(hand: &ActiveHand) -> Option<[sb_shared_types::Card; 5]> {
    let cc = hand.state.community_cards();
    if cc.len() >= 5 {
        Some(cc[..5].try_into().ok()?)
    } else {
        None
    }
}

pub fn spawn_table_actor(
    room_id: TableId,
    table_id: TableId,
    config: TableConfig,
    event_tx: tokio::sync::broadcast::Sender<HandCompletedEvent>,
    stats_repo: Arc<dyn PlayerStatsRepo + Send + Sync>,
    active_players: Arc<AtomicU8>,
) -> (mpsc::Sender<InternalCommand>, tokio::task::JoinHandle<()>) {
    let (tx, rx) = mpsc::channel(32);
    let actor = TableActor::new(
        room_id,
        table_id,
        config,
        tx.clone(),
        event_tx,
        stats_repo,
        active_players,
    );
    let handle = tokio::spawn(actor.run(rx));
    (tx, handle)
}
