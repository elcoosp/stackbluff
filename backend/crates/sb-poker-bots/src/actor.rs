//! BotActor: Async I/O state machine and local history tracking.

use std::sync::Arc;
use std::time::Duration;

use rand::rngs::StdRng;
use rand::{RngExt, SeedableRng};
use tokio::sync::mpsc;
use tracing::{info, warn};

use sb_shared_types::{Card, ChipAmount, Rank, Suit, TableId, UserId};
use sb_table_registry::game_room::{
    ActionRequired, HandResult as RoomHandResult, PrivatePayload, RoomMessage, TableStateUpdate,
};

use crate::engine::{decide, BotProfile, BotViewState};
use crate::evaluator::fast_equity;
use crate::economy::BankrollManager;
use crate::TableClient;

const RING_BUFFER_CAPACITY: usize = 5;
const TILT_THRESHOLD_PERCENT: f32 = 0.30;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum BotState {
    Idle,
    Seated,
    PendingLeave,
    Leaving,
}

pub struct BotActor {
    pub user_id: UserId,
    pub table_id: TableId,
    pub profile: BotProfile,
    pub state: BotState,

    table_client: Arc<dyn TableClient>,
    bankroll_manager: Arc<BankrollManager>,

    // Local history for Tilt
    stack_deltas: Vec<ChipAmount>,
    session_start_stack: ChipAmount,
    last_known_stack: ChipAmount,
    hand_just_ended: bool,

    // Hand state
    hole_cards: Vec<Card>,
    community_cards: Vec<Card>,

    rng: StdRng,
}

impl BotActor {
    pub fn new(
        user_id: UserId,
        table_id: TableId,
        profile: BotProfile,
        table_client: Arc<dyn TableClient>,
        bankroll_manager: Arc<BankrollManager>,
        initial_stack: ChipAmount,
    ) -> Self {
        Self {
            user_id,
            table_id,
            profile,
            state: BotState::Idle,
            table_client,
            bankroll_manager,
            stack_deltas: Vec::with_capacity(RING_BUFFER_CAPACITY),
            session_start_stack: initial_stack,
            last_known_stack: initial_stack,
            hand_just_ended: false,
            hole_cards: Vec::new(),
            community_cards: Vec::new(),
            rng: StdRng::from_rng(&mut rand::rng()),
        }
    }

    pub async fn run(mut self, mut msg_rx: mpsc::UnboundedReceiver<RoomMessage>) {
        self.state = BotState::Seated;
        info!(bot_id = %self.user_id, "Bot actor started");

        while let Some(msg) = msg_rx.recv().await {
            match msg {
                RoomMessage::TableState(update) => {
                    self.handle_table_state(update);
                }
                RoomMessage::PrivateMessage { payload, .. } => {
                    self.handle_private_message(payload);
                }
                RoomMessage::ActionRequired(action_req) => {
                    if self.state == BotState::Seated {
                        self.handle_action_required(action_req).await;
                    }
                }
                RoomMessage::HandResult(result) => {
                    self.handle_hand_result(&result).await;
                    if self.state == BotState::PendingLeave {
                        self.state = BotState::Leaving;
                        match self.table_client.leave_table(self.table_id, self.user_id, false).await {
                            Ok(refunded_stack) => {
                                if let Err(e) = self.bankroll_manager.credit_bankroll(self.user_id, refunded_stack).await {
                                    warn!(bot_id = %self.user_id, error = %e, "Failed to credit bankroll on leave");
                                }
                            }
                            Err(e) => {
                                warn!(bot_id = %self.user_id, error = %e, "Failed to leave table");
                            }
                        }
                        break;
                    }
                }
                _ => {}
            }
        }
        info!(bot_id = %self.user_id, "Bot actor terminated");
    }

    fn handle_table_state(&mut self, update: TableStateUpdate) {
        self.community_cards = update.community_cards.iter().map(parse_card).collect();

        if let Some(player) = update.players.iter().find(|p| p.user_id == self.user_id) {
            let new_stack = player.stack;

            // Rebuy detection: stack was 0, now > 0
            if self.last_known_stack.as_i64() == 0 && new_stack.as_i64() > 0 {
                self.stack_deltas.clear();
                self.session_start_stack = new_stack;
            }

            if self.hand_just_ended {
                let delta = ChipAmount::new(new_stack.as_i64() - self.last_known_stack.as_i64())
                    .unwrap_or_default();
                self.record_delta(delta);
                self.hand_just_ended = false;
            }
            self.last_known_stack = new_stack;
        }
    }

    fn handle_private_message(&mut self, payload: PrivatePayload) {
        if let PrivatePayload::YourHoleCards { hole_cards } = payload {
            self.hole_cards = hole_cards.iter().map(parse_card).collect();
        }
    }

    async fn handle_action_required(&mut self, req: ActionRequired) {
        let human_delay = if std::env::var("BOT_FAST_MODE")
            .map(|v| v == "1")
            .unwrap_or(false)
        {
            Duration::from_millis(1)
        } else {
            Duration::from_millis(self.rng.random_range(500..2000))
        };
        tokio::time::sleep(human_delay).await;

        let equity = fast_equity(&self.hole_cards, &self.community_cards);

        let pot_odds = if req.to_call > 0 {
            (req.pot as f32 / req.to_call as f32) / 10.0
        } else {
            0.0
        };

        let street = match self.community_cards.len() {
            0 => "preflop".to_string(),
            3 => "flop".to_string(),
            4 => "turn".to_string(),
            5 => "river".to_string(),
            _ => "unknown".to_string(),
        };

        let is_tilted = self.is_tilted();
        if is_tilted {
            tracing::warn!(target: "bot_tilt", bot_id = %self.user_id, profile = ?self.profile, "Bot entering tilt state");
        }

        let view_state = BotViewState {
            street,
            pot_odds,
            to_call: ChipAmount::new(req.to_call as i64).unwrap_or_default(),
            min_raise: ChipAmount::new(req.min_raise as i64).unwrap_or_default(),
            can_check: req.can_check,
            is_tilted,
        };

        let start = std::time::Instant::now();
        let decision = decide(
            &mut self.rng,
            &self.profile,
            &view_state,
            &self.hole_cards,
            equity,
        );
        let elapsed = start.elapsed().as_micros() as f64;
        metrics::histogram!("bot_decision_latency_microseconds").record(elapsed);
        metrics::counter!("bot_action_distribution", "action" => format!("{:?}", decision.action_type)).increment(1);

        tracing::info!(
            target: "bot_decision",
            bot_id = %self.user_id,
            profile = ?self.profile,
            street = %view_state.street,
            equity = equity,
            pot_odds = view_state.pot_odds,
            action = ?decision.action_type,
            "Bot decision made"
        );

        if let Err(e) = self
            .table_client
            .send_action(self.table_id, self.user_id, decision.action_type, decision.amount)
            .await
        {
            warn!(bot_id = %self.user_id, error = %e, "Failed to send action");
        }
    }

    async fn handle_hand_result(&mut self, _result: &RoomHandResult) {
        self.hand_just_ended = true;
        self.hole_cards.clear();
    }

    fn record_delta(&mut self, delta: ChipAmount) {
        if self.stack_deltas.len() == RING_BUFFER_CAPACITY {
            self.stack_deltas.remove(0);
        }
        self.stack_deltas.push(delta);
    }

    fn is_tilted(&self) -> bool {
        if self.stack_deltas.len() < RING_BUFFER_CAPACITY {
            return false;
        }
        let sum: i64 = self.stack_deltas.iter().map(|c| c.as_i64()).sum();
        let threshold = (self.session_start_stack.as_i64() as f32 * TILT_THRESHOLD_PERCENT) as i64;
        sum < -threshold
    }
}

fn parse_card(c: &sb_table_registry::game_room::WsCard) -> Card {
    let suit = match c.suit.as_str() {
        "hearts" => Suit::Hearts,
        "diamonds" => Suit::Diamonds,
        "clubs" => Suit::Clubs,
        "spades" => Suit::Spades,
        _ => Suit::Clubs,
    };
    let rank = match c.rank.as_str() {
        "Two" => Rank::Two,
        "Three" => Rank::Three,
        "Four" => Rank::Four,
        "Five" => Rank::Five,
        "Six" => Rank::Six,
        "Seven" => Rank::Seven,
        "Eight" => Rank::Eight,
        "Nine" => Rank::Nine,
        "Ten" => Rank::Ten,
        "Jack" => Rank::Jack,
        "Queen" => Rank::Queen,
        "King" => Rank::King,
        "Ace" => Rank::Ace,
        _ => Rank::Two,
    };
    Card { suit, rank }
}
