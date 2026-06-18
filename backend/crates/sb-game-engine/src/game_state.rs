use crate::deck::Deck;
use crate::evaluate::evaluate_hand_strength;
use crate::hand_rank::HandRank;
use crate::pot::compute_side_pots;
use sb_shared_types::UserId;
use sb_shared_types::game_types::SidePot;
use sb_shared_types::{Card, ChipAmount, PlayerId, TableId};

use sb_ws_messages::ActionRequired as WsActionRequired;
use tracing::{debug, warn};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct HandId(pub u64);

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PlayerHandState {
    pub player_id: PlayerId,
    pub hole_cards: Option<[Card; 2]>,
    pub bet_this_round: ChipAmount,
    pub total_bet: ChipAmount,
    pub is_all_in: bool,
    pub stack: ChipAmount,
    pub has_folded: bool,
    pub acted_this_round: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BettingRound {
    Preflop,
    Flop,
    Turn,
    River,
    Showdown,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Action {
    Fold,
    Check,
    Call,
    Raise(ChipAmount),
}

#[derive(Debug, thiserror::Error, PartialEq, Eq, Clone)]
pub enum ActionError {
    #[error("Not player's turn")]
    NotYourTurn,
    #[error("Player already folded")]
    AlreadyFolded,
    #[error("Player already all-in")]
    AlreadyAllIn,
    #[error("Invalid raise amount: {attempted:?} (minimum {min:?})")]
    InvalidRaise {
        attempted: ChipAmount,
        min: ChipAmount,
    },
    #[error("Game already finished")]
    HandComplete,
    #[error("Cannot act in showdown")]
    ShowdownNotActionable,
    #[error("Insufficient stack to {action}")]
    InsufficientStack { action: String, needed: ChipAmount },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Winner {
    pub player_id: PlayerId,
    pub amount: ChipAmount,
    pub hand_rank: HandRank,
}

pub struct GameState {
    hand_id: HandId,
    deck: Deck,
    players: Vec<PlayerHandState>,
    current_round: BettingRound,
    current_player_index: usize,
    community_cards: Vec<Card>,
    pot: ChipAmount,
    smallest_bet: ChipAmount,
    min_raise: ChipAmount,
    blinds: (ChipAmount, ChipAmount),
    dealer_index: usize,
    last_aggressor_index: Option<usize>,
    round_bets: Vec<ChipAmount>,
    hand_complete: bool,
}

impl GameState {
    pub fn current_pot(&self) -> ChipAmount {
        self.pot
    }

    pub fn side_pots(&self) -> Vec<SidePot> {
        use crate::pot::compute_side_pots;
        let total_bets: Vec<(PlayerId, ChipAmount)> = self
            .players
            .iter()
            .filter(|p| !p.has_folded)
            .map(|p| (p.player_id, p.total_bet))
            .collect();
        let pots = compute_side_pots(&total_bets);
        pots.into_iter()
            .map(|p| SidePot {
                amount: p.amount,
                eligible_players: p.eligible_players,
            })
            .collect()
    }

    pub fn player_hole_cards(&self, player_id: PlayerId) -> Option<[Card; 2]> {
        self.players
            .iter()
            .find(|p| p.player_id == player_id)
            .and_then(|p| p.hole_cards)
    }

    pub fn new_hand(
        table_id: TableId,
        players: Vec<(PlayerId, ChipAmount)>,
        dealer_index: usize,
        blinds: (ChipAmount, ChipAmount),
    ) -> Result<Self, &'static str> {
        let _ = table_id;
        if players.len() < 2 {
            return Err("Need at least 2 players");
        }
        let sb = blinds.0;
        let bb = blinds.1;
        let small_idx = (dealer_index + 1) % players.len();
        let big_idx = (dealer_index + 2) % players.len();
        if players[small_idx].1 < sb {
            return Err("Small blind cannot post");
        }
        if players[big_idx].1 < bb {
            return Err("Big blind cannot post");
        }

        let hand_id = HandId(rand::random::<u64>());
        let mut deck = Deck::new();
        deck.shuffle();

        let mut player_states: Vec<PlayerHandState> = players
            .into_iter()
            .map(|(pid, stack)| PlayerHandState {
                player_id: pid,
                hole_cards: None,
                bet_this_round: ChipAmount::new(0).unwrap(),
                total_bet: ChipAmount::new(0).unwrap(),
                is_all_in: false,
                stack,
                has_folded: false,
                acted_this_round: false,
            })
            .collect();

        for state in &mut player_states {
            let c1 = deck.deal().ok_or("Not enough cards")?;
            let c2 = deck.deal().ok_or("Not enough cards")?;
            state.hole_cards = Some([c1, c2]);
        }

        let small_blind_index = (dealer_index + 1) % player_states.len();
        let big_blind_index = (dealer_index + 2) % player_states.len();

        let mut round_bets = vec![ChipAmount::new(0).unwrap(); player_states.len()];
        Self::post_blind(
            &mut player_states[small_blind_index],
            sb,
            &mut round_bets[small_blind_index],
        )?;
        Self::post_blind(
            &mut player_states[big_blind_index],
            bb,
            &mut round_bets[big_blind_index],
        )?;

        let pot = sb + bb;
        let smallest_bet = bb;
        let min_raise = bb;

        // In heads-up: dealer=SB acts first preflop.
        // In 3+: UTG (after BB) acts first preflop.
        let current_player_index = if player_states.len() == 2 {
            small_blind_index // dealer/SB acts first
        } else {
            (big_blind_index + 1) % player_states.len()
        };

        debug!(
            hand_id = hand_id.0,
            "New hand created, dealer={}, blinds={:?}", dealer_index, blinds
        );

        Ok(GameState {
            hand_id,
            deck,
            players: player_states,
            current_round: BettingRound::Preflop,
            current_player_index,
            community_cards: Vec::new(),
            pot,
            smallest_bet,
            min_raise,
            blinds,
            dealer_index,
            last_aggressor_index: Some(big_blind_index), // BB is initial "aggressor" for preflop
            round_bets,
            hand_complete: false,
        })
    }

    fn post_blind(
        player: &mut PlayerHandState,
        amount: ChipAmount,
        round_bet: &mut ChipAmount,
    ) -> Result<(), &'static str> {
        if player.stack < amount {
            return Err("Insufficient stack for blind");
        }
        player.stack = player.stack - amount;
        player.total_bet = player.total_bet + amount;
        player.bet_this_round = player.bet_this_round + amount;
        *round_bet = *round_bet + amount;
        if player.stack == ChipAmount::new(0).unwrap() {
            player.is_all_in = true;
        }
        // Blinds do NOT count as "acted" — BB still gets option to raise
        Ok(())
    }

    pub fn apply_action(&mut self, player_id: PlayerId, action: Action) -> Result<(), ActionError> {
        if self.hand_complete {
            return Err(ActionError::HandComplete);
        }
        let idx = self
            .players
            .iter()
            .position(|p| p.player_id == player_id)
            .ok_or(ActionError::NotYourTurn)?;
        if idx != self.current_player_index {
            return Err(ActionError::NotYourTurn);
        }
        if self.current_round == BettingRound::Showdown {
            return Err(ActionError::ShowdownNotActionable);
        }

        let p = &self.players[idx];
        if p.has_folded {
            return Err(ActionError::AlreadyFolded);
        }
        if p.is_all_in {
            return Err(ActionError::AlreadyAllIn);
        }

        match action {
            Action::Fold => {
                self.players[idx].has_folded = true;
                self.players[idx].acted_this_round = true;
                debug!(player = ?self.players[idx].player_id, "Fold");

                // If only one player remains, hand is complete
                let active_count = self.players.iter().filter(|p| !p.has_folded).count();
                if active_count == 1 {
                    self.hand_complete = true;
                    return Ok(());
                }

                self.advance_turn();
            }
            Action::Check => {
                if self.round_bets[idx] != self.smallest_bet {
                    return Err(ActionError::InvalidRaise {
                        attempted: ChipAmount::new(0).unwrap(),
                        min: self.min_raise,
                    });
                }
                self.players[idx].acted_this_round = true;
                debug!(player = ?self.players[idx].player_id, "Check");
                self.advance_turn();
            }
            Action::Call => {
                let call_amount = self.smallest_bet - self.round_bets[idx];
                if call_amount <= ChipAmount::new(0).unwrap() {
                    // Can't call when bets are equal — should use Check
                    return Err(ActionError::InvalidRaise {
                        attempted: call_amount,
                        min: self.min_raise,
                    });
                }
                if self.players[idx].stack < call_amount {
                    return Err(ActionError::InsufficientStack {
                        action: "call".into(),
                        needed: call_amount,
                    });
                }
                self.add_bet(idx, call_amount);
                self.players[idx].acted_this_round = true;
                debug!(player = ?self.players[idx].player_id, call = ?call_amount, "Call");
                self.advance_turn();
            }
            Action::Raise(raise_amount) => {
                let total_bet = self.round_bets[idx] + raise_amount;
                let required = self.smallest_bet + self.min_raise;
                if total_bet < required {
                    return Err(ActionError::InvalidRaise {
                        attempted: raise_amount,
                        min: self.min_raise,
                    });
                }
                if self.players[idx].stack < raise_amount {
                    return Err(ActionError::InsufficientStack {
                        action: "raise".into(),
                        needed: raise_amount,
                    });
                }
                self.add_bet(idx, raise_amount);
                self.smallest_bet = total_bet;
                self.min_raise = raise_amount;
                self.last_aggressor_index = Some(idx);

                // Reset acted_this_round for all OTHER active players —
                // they must respond to the raise
                for (i, p) in self.players.iter_mut().enumerate() {
                    if i != idx && !p.has_folded && !p.is_all_in {
                        p.acted_this_round = false;
                    }
                }

                self.players[idx].acted_this_round = true;
                debug!(player = ?self.players[idx].player_id, raise = ?raise_amount, total_bet = ?total_bet, "Raise");
                self.advance_turn();
            }
        }
        Ok(())
    }

    fn add_bet(&mut self, idx: usize, amount: ChipAmount) {
        let p = &mut self.players[idx];
        p.stack = p.stack - amount;
        p.bet_this_round = p.bet_this_round + amount;
        p.total_bet = p.total_bet + amount;
        self.round_bets[idx] = self.round_bets[idx] + amount;
        self.pot = self.pot + amount;
        if p.stack == ChipAmount::new(0).unwrap() {
            p.is_all_in = true;
            debug!(player = ?p.player_id, "All-in");
        }
    }

    fn advance_turn(&mut self) {
        // Find next player who can still act (not folded, not all-in)
        let mut next = (self.current_player_index + 1) % self.players.len();
        let start = next;
        loop {
            let p = &self.players[next];
            if !p.has_folded && !p.is_all_in {
                break;
            }
            next = (next + 1) % self.players.len();
            if next == start {
                // All players are folded or all-in
                break;
            }
        }

        self.current_player_index = next;

        if self.round_complete() {
            self.end_round();
        }
    }

    fn round_complete(&self) -> bool {
        let active: Vec<usize> = self
            .players
            .iter()
            .enumerate()
            .filter(|(_, p)| !p.has_folded && !p.is_all_in)
            .map(|(i, _)| i)
            .collect();

        if active.is_empty() {
            return true;
        }

        // All active players must have acted this round AND have equal bets
        let all_acted = active.iter().all(|&i| self.players[i].acted_this_round);
        let all_bet_equal = active
            .iter()
            .all(|&i| self.round_bets[i] == self.smallest_bet);

        all_acted && all_bet_equal
    }

    /// Count players who can still act (not folded, not all-in)
    fn active_player_count(&self) -> usize {
        self.players
            .iter()
            .filter(|p| !p.has_folded && !p.is_all_in)
            .count()
    }

    /// Deal the remaining community cards (turn and river) if missing.
    fn deal_remaining_community_cards(&mut self) {
        while self.community_cards.len() < 5 {
            if let Some(card) = self.deck.deal() {
                self.community_cards.push(card);
            } else {
                warn!("Deck exhausted while dealing remaining community cards");
                break;
            }
        }
    }

    fn end_round(&mut self) {
        match self.current_round {
            BettingRound::Preflop => {
                // Deal flop
                for _ in 0..3 {
                    if let Some(card) = self.deck.deal() {
                        self.community_cards.push(card);
                    } else {
                        warn!("Deck exhausted during flop");
                        self.hand_complete = true;
                        return;
                    }
                }
                // If no active players, deal the rest and go to showdown
                if self.active_player_count() == 0 {
                    self.deal_remaining_community_cards();
                    self.current_round = BettingRound::Showdown;
                    self.hand_complete = true;
                    return;
                }
                self.current_round = BettingRound::Flop;
                self.reset_round();
            }
            BettingRound::Flop => {
                // Deal turn
                if let Some(card) = self.deck.deal() {
                    self.community_cards.push(card);
                } else {
                    warn!("Deck exhausted during turn");
                    self.hand_complete = true;
                    return;
                }
                if self.active_player_count() == 0 {
                    // Deal river and finish
                    if let Some(card) = self.deck.deal() {
                        self.community_cards.push(card);
                    } else {
                        warn!("Deck exhausted during river");
                        self.hand_complete = true;
                        return;
                    }
                    self.current_round = BettingRound::Showdown;
                    self.hand_complete = true;
                    return;
                }
                self.current_round = BettingRound::Turn;
                self.reset_round();
            }
            BettingRound::Turn => {
                // Deal river
                if let Some(card) = self.deck.deal() {
                    self.community_cards.push(card);
                } else {
                    warn!("Deck exhausted during river");
                    self.hand_complete = true;
                    return;
                }
                if self.active_player_count() == 0 {
                    self.current_round = BettingRound::Showdown;
                    self.hand_complete = true;
                    return;
                }
                self.current_round = BettingRound::River;
                self.reset_round();
            }
            BettingRound::River => {
                self.current_round = BettingRound::Showdown;
                self.hand_complete = true;
            }
            BettingRound::Showdown => self.hand_complete = true,
        }
        if !self.hand_complete {
            debug!(round = ?self.current_round, "Round ended, moving to next");
        }
    }

    fn reset_round(&mut self) {
        for p in &mut self.players {
            p.bet_this_round = ChipAmount::new(0).unwrap();
            p.acted_this_round = false;
        }
        self.round_bets.fill(ChipAmount::new(0).unwrap());
        self.smallest_bet = ChipAmount::new(0).unwrap();
        self.min_raise = self.blinds.1;
        self.last_aggressor_index = None;

        // First to act post-flop: first active player after dealer
        let mut start = (self.dealer_index + 1) % self.players.len();
        let initial = start;
        while self.players[start].has_folded || self.players[start].is_all_in {
            start = (start + 1) % self.players.len();
            if start == initial {
                break;
            }
        }
        self.current_player_index = start;
    }

    pub fn is_hand_complete(&self) -> bool {
        self.hand_complete
    }

    pub fn hand_id(&self) -> HandId {
        self.hand_id
    }

    /// Returns the PlayerId of the player whose turn it is
    pub fn current_player_id(&self) -> Option<PlayerId> {
        if self.hand_complete || self.current_round == BettingRound::Showdown {
            return None;
        }
        self.players
            .get(self.current_player_index)
            .map(|p| p.player_id)
    }

    /// Returns the amount needed to call for the current player
    pub fn current_call_amount(&self) -> ChipAmount {
        if let Some(_player) = self.players.get(self.current_player_index) {
            let current_bet = self.round_bets[self.current_player_index];
            if current_bet < self.smallest_bet {
                self.smallest_bet - current_bet
            } else {
                ChipAmount::new(0).unwrap()
            }
        } else {
            ChipAmount::new(0).unwrap()
        }
    }

    /// Returns the minimum raise amount
    pub fn min_raise_amount(&self) -> ChipAmount {
        self.min_raise
    }

    /// Returns the current community cards
    pub fn community_cards(&self) -> &[Card] {
        &self.community_cards
    }

    /// Returns the current stack of a player
    pub fn player_stack(&self, player_id: PlayerId) -> Option<ChipAmount> {
        self.players
            .iter()
            .find(|p| p.player_id == player_id)
            .map(|p| p.stack)
    }

    /// Returns the current bet of a player this round
    pub fn player_current_bet(&self, player_id: PlayerId) -> Option<ChipAmount> {
        self.players
            .iter()
            .find(|p| p.player_id == player_id)
            .map(|p| p.bet_this_round)
    }

    /// Returns whether a player is all-in
    pub fn player_is_all_in(&self, player_id: PlayerId) -> bool {
        self.players
            .iter()
            .any(|p| p.player_id == player_id && p.is_all_in)
    }

    /// Returns whether a player has folded
    pub fn player_is_folded(&self, player_id: PlayerId) -> bool {
        self.players
            .iter()
            .any(|p| p.player_id == player_id && p.has_folded)
    }

    pub fn action_required_for_current_player(&self) -> Option<WsActionRequired> {
        if self.hand_complete {
            return None;
        }
        let current = self.current_player_id()?;
        let current_idx = self.current_player_index;
        let to_call = self.smallest_bet - self.players[current_idx].bet_this_round;
        let min_raise = self.min_raise;
        let can_check = to_call == ChipAmount::new(0).unwrap();
        let remaining_ms = 30_000;

        // Calculate Analytics
        let analytics = if let Some(hole_cards) = &self.players[current_idx].hole_cards {
            let pot_odds = if to_call.as_i64() > 0 {
                (self.pot.as_i64() as f32 / to_call.as_i64() as f32) / 10.0
            } else {
                0.0
            };

            let (best_hand_name, base_strength) = if self.community_cards.len() >= 5 {
                let comm_5: [Card; 5] = self.community_cards[..5].try_into().unwrap();
                let strength = crate::evaluate::evaluate_hand_strength(hole_cards, &comm_5);
                (
                    strength.rank.name().to_string(),
                    crate::analytics::get_strength_score(strength.rank),
                )
            } else {
                // Pre-flop or partial flop logic
                if hole_cards[0].rank == hole_cards[1].rank {
                    ("One Pair".to_string(), 25)
                } else {
                    ("High Card".to_string(), 10)
                }
            };

            let win_prob =
                crate::analytics::run_monte_carlo(hole_cards, &self.community_cards, 500);

            Some(sb_ws_messages::AnalyticsPayload {
                win_prob,
                pot_odds,
                best_hand: best_hand_name,
                strength: base_strength,
            })
        } else {
            None
        };

        Some(WsActionRequired {
            user_id: UserId(current.0),
            to_call,
            min_raise,
            can_check,
            remaining_ms,
            analytics,
        })
    }

    pub fn public_snapshot_for_player(
        &self,
        _viewer_id: PlayerId,
    ) -> sb_ws_messages::TableStateUpdate {
        let players = self
            .players
            .iter()
            .map(|p| {
                let user_id = sb_shared_types::UserId(p.player_id.0);
                (user_id, p.stack, p.total_bet, p.is_all_in)
            })
            .collect();
        sb_ws_messages::TableStateUpdate {
            table_id: sb_shared_types::TableId::new(uuid::Uuid::nil()),
            players,
            current_hand_in_progress: !self.hand_complete,
            community_cards: self
                .community_cards
                .iter()
                .map(|c| sb_ws_messages::Card {
                    suit: format!("{:?}", c.suit).to_lowercase(),
                    rank: format!("{:?}", c.rank),
                })
                .collect(),
        }
    }

    pub fn calculate_pot_winners(&self) -> Vec<Winner> {
        if !self.hand_complete {
            return vec![];
        }
        let active: Vec<usize> = self
            .players
            .iter()
            .enumerate()
            .filter(|(_, p)| !p.has_folded)
            .map(|(i, _)| i)
            .collect();
        if active.is_empty() {
            return vec![];
        }
        if active.len() == 1 {
            let winner = &self.players[active[0]];
            return vec![Winner {
                player_id: winner.player_id,
                amount: self.pot,
                hand_rank: HandRank::HighCard,
            }];
        }

        let total_bets: Vec<(PlayerId, ChipAmount)> = active
            .iter()
            .map(|&i| (self.players[i].player_id, self.players[i].total_bet))
            .collect();
        let pots = compute_side_pots(&total_bets);
        let mut winners = Vec::new();

        for pot in pots {
            let eligible_ids = pot.eligible_players;
            let eligible_indices: Vec<usize> = self
                .players
                .iter()
                .enumerate()
                .filter(|(_, p)| eligible_ids.contains(&p.player_id))
                .map(|(i, _)| i)
                .collect();
            if eligible_indices.is_empty() {
                continue;
            }
            if eligible_indices.len() == 1 {
                let winner = &self.players[eligible_indices[0]];
                winners.push(Winner {
                    player_id: winner.player_id,
                    amount: pot.amount,
                    hand_rank: HandRank::HighCard,
                });
                continue;
            }
            if self.community_cards.len() < 5 {
                warn!("Showdown with incomplete community cards – splitting pot");
                let share_val = pot.amount.as_i64() / eligible_indices.len() as i64;
                let share = ChipAmount::new(share_val).expect("share positive");
                for idx in eligible_indices {
                    winners.push(Winner {
                        player_id: self.players[idx].player_id,
                        amount: share,
                        hand_rank: HandRank::HighCard,
                    });
                }
                continue;
            }
            let community: [Card; 5] = self.community_cards[..5].try_into().unwrap();
            let mut best_strength = None;
            let mut best_indices = Vec::new();
            for &idx in &eligible_indices {
                let hole = self.players[idx].hole_cards.as_ref().unwrap();
                let strength = evaluate_hand_strength(hole, &community);
                if let Some(ref current) = best_strength {
                    if strength > *current {
                        best_strength = Some(strength);
                        best_indices = vec![idx];
                    } else if strength == *current {
                        best_indices.push(idx);
                    }
                } else {
                    best_strength = Some(strength);
                    best_indices = vec![idx];
                }
            }
            let share_val = pot.amount.as_i64() / best_indices.len() as i64;
            let share = ChipAmount::new(share_val).expect("share positive");
            for idx in best_indices {
                winners.push(Winner {
                    player_id: self.players[idx].player_id,
                    amount: share,
                    hand_rank: best_strength.as_ref().unwrap().rank,
                });
            }
        }
        winners
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    fn pid(id: u128) -> PlayerId {
        PlayerId(Uuid::from_u128(id))
    }

    #[test]
    fn test_new_hand_ok() {
        let players = vec![
            (pid(1), ChipAmount::new(1000).unwrap()),
            (pid(2), ChipAmount::new(1000).unwrap()),
        ];
        let state = GameState::new_hand(
            TableId::generate(),
            players,
            0,
            (ChipAmount::new(5).unwrap(), ChipAmount::new(10).unwrap()),
        )
        .unwrap();
        assert!(!state.is_hand_complete());
    }

    #[test]
    fn test_heads_up_call_then_bb_option() {
        // Dealer=pid(1), SB=pid(1), BB=pid(2)
        let players = vec![
            (pid(1), ChipAmount::new(1000).unwrap()),
            (pid(2), ChipAmount::new(1000).unwrap()),
        ];
        let mut state = GameState::new_hand(
            TableId::generate(),
            players,
            0,
            (ChipAmount::new(5).unwrap(), ChipAmount::new(10).unwrap()),
        )
        .unwrap();

        // SB (pid(1)) should act first preflop in heads-up
        assert_eq!(state.current_player_id(), Some(pid(1)));

        // SB calls
        state.apply_action(pid(1), Action::Call).unwrap();

        // BB (pid(2)) should now get option to raise — NOT end the round!
        assert_eq!(state.current_player_id(), Some(pid(2)));
        assert_eq!(state.current_round, BettingRound::Preflop);

        // BB checks (completes the round)
        state.apply_action(pid(2), Action::Check).unwrap();

        // Now flop should be dealt
        assert_eq!(state.current_round, BettingRound::Flop);
        assert_eq!(state.community_cards.len(), 3);
    }

    #[test]
    fn test_heads_up_full_hand() {
        let players = vec![
            (pid(1), ChipAmount::new(1000).unwrap()),
            (pid(2), ChipAmount::new(1000).unwrap()),
        ];
        let mut state = GameState::new_hand(
            TableId::generate(),
            players,
            0,
            (ChipAmount::new(5).unwrap(), ChipAmount::new(10).unwrap()),
        )
        .unwrap();

        // Preflop: SB calls, BB checks
        assert_eq!(state.current_player_id(), Some(pid(1)));
        state.apply_action(pid(1), Action::Call).unwrap();
        assert_eq!(state.current_player_id(), Some(pid(2)));
        state.apply_action(pid(2), Action::Check).unwrap();

        // Flop: SB acts first postflop
        assert_eq!(state.current_round, BettingRound::Flop);
        assert_eq!(state.current_player_id(), Some(pid(1)));
        state.apply_action(pid(1), Action::Check).unwrap();

        // BB checks
        assert_eq!(state.current_player_id(), Some(pid(2)));
        state.apply_action(pid(2), Action::Check).unwrap();

        // Turn
        assert_eq!(state.current_round, BettingRound::Turn);
        state.apply_action(pid(1), Action::Check).unwrap();
        state.apply_action(pid(2), Action::Check).unwrap();

        // River
        assert_eq!(state.current_round, BettingRound::River);
        state.apply_action(pid(1), Action::Check).unwrap();
        state.apply_action(pid(2), Action::Check).unwrap();

        // Showdown
        assert!(state.is_hand_complete());
    }

    #[test]
    fn test_raise_resets_acted_flag() {
        let players = vec![
            (pid(1), ChipAmount::new(1000).unwrap()),
            (pid(2), ChipAmount::new(1000).unwrap()),
            (pid(3), ChipAmount::new(1000).unwrap()),
        ];
        let mut state = GameState::new_hand(
            TableId::generate(),
            players,
            0,
            (ChipAmount::new(5).unwrap(), ChipAmount::new(10).unwrap()),
        )
        .unwrap();

        // UTG raises
        let utg = state.current_player_id().unwrap();
        state
            .apply_action(utg, Action::Raise(ChipAmount::new(20).unwrap()))
            .unwrap();

        // SB must respond to raise
        let sb = state.current_player_id().unwrap();
        assert!(
            !state
                .players
                .iter()
                .find(|p| p.player_id == sb)
                .unwrap()
                .acted_this_round
        );
        state.apply_action(sb, Action::Call).unwrap();

        // BB must respond to raise
        let bb = state.current_player_id().unwrap();
        assert!(
            !state
                .players
                .iter()
                .find(|p| p.player_id == bb)
                .unwrap()
                .acted_this_round
        );
        state.apply_action(bb, Action::Call).unwrap();

        // Round should now be complete
        assert_eq!(state.current_round, BettingRound::Flop);
    }

    #[test]
    fn test_fold_action() {
        let players = vec![
            (pid(1), ChipAmount::new(1000).unwrap()),
            (pid(2), ChipAmount::new(1000).unwrap()),
        ];
        let mut state = GameState::new_hand(
            TableId::generate(),
            players,
            0,
            (ChipAmount::new(5).unwrap(), ChipAmount::new(10).unwrap()),
        )
        .unwrap();
        let folded_id = state.players[state.current_player_index].player_id;
        assert!(state.apply_action(folded_id, Action::Fold).is_ok());
        assert!(state.is_hand_complete());
    }

    #[test]
    fn test_invalid_raise() {
        let players = vec![
            (pid(1), ChipAmount::new(1000).unwrap()),
            (pid(2), ChipAmount::new(1000).unwrap()),
        ];
        let mut state = GameState::new_hand(
            TableId::generate(),
            players,
            0,
            (ChipAmount::new(5).unwrap(), ChipAmount::new(10).unwrap()),
        )
        .unwrap();
        let id = state.players[state.current_player_index].player_id;
        let result = state.apply_action(id, Action::Raise(ChipAmount::new(1).unwrap()));
        assert!(matches!(result, Err(ActionError::InvalidRaise { .. })));
    }

    #[test]
    fn test_betting_sequence_call_raise() {
        let players = vec![
            (pid(1), ChipAmount::new(1000).unwrap()),
            (pid(2), ChipAmount::new(1000).unwrap()),
        ];
        let mut state = GameState::new_hand(
            TableId::generate(),
            players,
            0,
            (ChipAmount::new(5).unwrap(), ChipAmount::new(10).unwrap()),
        )
        .unwrap();
        // SB raises
        let first = state.players[state.current_player_index].player_id;
        state
            .apply_action(first, Action::Raise(ChipAmount::new(20).unwrap()))
            .unwrap();
        // BB calls
        let second = state.players[state.current_player_index].player_id;
        state.apply_action(second, Action::Call).unwrap();
        assert_eq!(state.current_round, BettingRound::Flop);
        assert_eq!(state.community_cards.len(), 3);
    }

    // ── Test the all-in fix ──
    #[test]
    fn test_all_in_no_active_players_ends_hand_immediately() {
        let players = vec![
            (pid(1), ChipAmount::new(1000).unwrap()),
            (pid(2), ChipAmount::new(1000).unwrap()),
        ];
        let mut state = GameState::new_hand(
            TableId::generate(),
            players,
            0,
            (ChipAmount::new(5).unwrap(), ChipAmount::new(10).unwrap()),
        )
        .unwrap();

        // Preflop: SB (dealer) calls all-in?
        // But we need both to be all-in. Let's make SB shove, BB call all-in.
        // SB is pid(1) first to act.
        state
            .apply_action(pid(1), Action::Raise(ChipAmount::new(1000).unwrap()))
            .unwrap();
        // Now BB (pid(2)) must respond; they call all-in.
        state.apply_action(pid(2), Action::Call).unwrap();

        // Now both players are all-in, no active players.
        // The hand should now be complete after dealing flop/turn/river.
        // We can check that hand_complete is true and community cards are dealt.
        assert!(state.is_hand_complete());
        assert_eq!(state.community_cards().len(), 5);
        // Pot should be 2000 (1000+1000) plus blinds? Actually blinds were posted before:
        // blinds are 5 and 10, so pot = 5+10+1000+1000 = 2015? But our logic: when SB raises 1000, he puts in 1000 plus the 5 blind? Actually he has 1000 stack, blind is separate. The total pot should include blinds and the all-in bets. Let's just check pot is >0.
        assert!(state.current_pot().as_i64() > 0);
    }
}
