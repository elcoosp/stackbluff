//! Game state for a poker hand – fully production-ready.

use crate::deck::Deck;
use crate::evaluate::evaluate_hand_strength;
use crate::hand_rank::HandRank;
use crate::pot::compute_side_pots;
use sb_shared_types::{Card, ChipAmount, PlayerId};
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
    pub stack: ChipAmount, // chips remaining
    pub has_folded: bool,
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
    /// Creates a new hand with given players, dealer index, and blinds.
    /// Players must have enough chips to post blinds (validated).
    pub fn new_hand(
        players: Vec<(PlayerId, ChipAmount)>, // (player, starting stack)
        dealer_index: usize,
        blinds: (ChipAmount, ChipAmount),
    ) -> Result<Self, &'static str> {
        if players.len() < 2 {
            return Err("Need at least 2 players");
        }
        let sb = blinds.0;
        let bb = blinds.1;
        // Validate stacks
        for (_, stack) in &players {
            if *stack < sb && *stack < bb {
                return Err("Player cannot post blind");
            }
        }

        let hand_id = HandId(rand::random::<u64>());
        let mut deck = Deck::new();
        deck.shuffle();

        let mut player_states: Vec<PlayerHandState> = players
            .into_iter()
            .map(|(pid, stack)| PlayerHandState {
                player_id: pid,
                hole_cards: None,
                bet_this_round: ChipAmount::new(0).expect("zero amount"),
                total_bet: ChipAmount::new(0).expect("zero amount"),
                is_all_in: false,
                stack,
                has_folded: false,
            })
            .collect();

        // Deal hole cards
        for state in &mut player_states {
            let c1 = deck.deal().ok_or("Not enough cards")?;
            let c2 = deck.deal().ok_or("Not enough cards")?;
            state.hole_cards = Some([c1, c2]);
        }

        let small_blind_index = (dealer_index + 1) % player_states.len();
        let big_blind_index = (dealer_index + 2) % player_states.len();

        let mut round_bets = vec![ChipAmount::new(0).expect("zero amount"); player_states.len()];
        // Post blinds (subtract from stacks)
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
        let current_player_index = (big_blind_index + 1) % player_states.len();

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
            last_aggressor_index: Some(big_blind_index),
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
        if player.stack == ChipAmount::new(0).expect("zero amount") {
            player.is_all_in = true;
        }
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
        // Borrow check fix: take needed values before mutably borrowing self.players
        let current_round = self.current_round;
        if current_round == BettingRound::Showdown {
            return Err(ActionError::ShowdownNotActionable);
        }

        // Extract values needed for the action before any mutable borrow
        let (folded, all_in, stack, round_bet, smallest_bet, min_raise) = {
            let p = &self.players[idx];
            (
                p.has_folded,
                p.is_all_in,
                p.stack,
                self.round_bets[idx],
                self.smallest_bet,
                self.min_raise,
            )
        };

        if folded {
            return Err(ActionError::AlreadyFolded);
        }
        if all_in {
            return Err(ActionError::AlreadyAllIn);
        }

        match action {
            Action::Fold => {
                // Perform fold – we need mutable access to players[idx]
                let player = &mut self.players[idx];
                player.has_folded = true;
                debug!(player = ?player.player_id, "Fold");
                self.advance_turn();
            }
            Action::Check => {
                if round_bet != smallest_bet {
                    return Err(ActionError::InvalidRaise {
                        attempted: ChipAmount::new(0).expect("zero amount"),
                        min: min_raise,
                    });
                }
                debug!(player = ?self.players[idx].player_id, "Check");
                self.advance_turn();
            }
            Action::Call => {
                let call_amount = smallest_bet - round_bet;
                if call_amount <= ChipAmount::new(0).expect("zero amount") {
                    return Err(ActionError::InvalidRaise {
                        attempted: call_amount,
                        min: min_raise,
                    });
                }
                if stack < call_amount {
                    return Err(ActionError::InsufficientStack {
                        action: "call".into(),
                        needed: call_amount,
                    });
                }
                self.add_bet(idx, call_amount);
                debug!(player = ?self.players[idx].player_id, call = ?call_amount, "Call");
                self.advance_turn();
            }
            Action::Raise(raise_amount) => {
                let total_bet = round_bet + raise_amount;
                let required = smallest_bet + min_raise;
                if total_bet < required {
                    return Err(ActionError::InvalidRaise {
                        attempted: raise_amount,
                        min: min_raise,
                    });
                }
                if stack < raise_amount {
                    return Err(ActionError::InsufficientStack {
                        action: "raise".into(),
                        needed: raise_amount,
                    });
                }
                self.add_bet(idx, raise_amount);
                self.smallest_bet = total_bet;
                self.min_raise = raise_amount;
                self.last_aggressor_index = Some(idx);
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
        if p.stack == ChipAmount::new(0).expect("zero amount") {
            p.is_all_in = true;
            debug!(player = ?p.player_id, "All-in");
        }
    }

    fn advance_turn(&mut self) {
        let mut next = (self.current_player_index + 1) % self.players.len();
        let initial = self.current_player_index;
        while self.players[next].has_folded || self.players[next].is_all_in {
            next = (next + 1) % self.players.len();
            if next == initial {
                // Only all-in/folded players left – end the round
                self.end_round();
                return;
            }
        }
        self.current_player_index = next;
        if self.round_complete() {
            self.end_round();
        }
    }

    fn round_complete(&self) -> bool {
        let active_players: Vec<usize> = self
            .players
            .iter()
            .enumerate()
            .filter(|(_, p)| !p.has_folded && !p.is_all_in)
            .map(|(i, _)| i)
            .collect();
        if active_players.is_empty() {
            return true;
        }
        let all_bet_equal = active_players
            .iter()
            .all(|&i| self.round_bets[i] == self.smallest_bet);
        let last_aggressor = self.last_aggressor_index;
        let all_acted = active_players
            .iter()
            .all(|&i| i == self.current_player_index || self.round_bets[i] == self.smallest_bet);
        all_bet_equal && (last_aggressor.is_none() || all_acted)
    }

    fn end_round(&mut self) {
        match self.current_round {
            BettingRound::Preflop => {
                self.current_round = BettingRound::Flop;
                for _ in 0..3 {
                    if let Some(card) = self.deck.deal() {
                        self.community_cards.push(card);
                    } else {
                        warn!("Deck exhausted during flop");
                        self.hand_complete = true;
                        return;
                    }
                }
                self.reset_round();
            }
            BettingRound::Flop => {
                self.current_round = BettingRound::Turn;
                if let Some(card) = self.deck.deal() {
                    self.community_cards.push(card);
                } else {
                    warn!("Deck exhausted during turn");
                    self.hand_complete = true;
                    return;
                }
                self.reset_round();
            }
            BettingRound::Turn => {
                self.current_round = BettingRound::River;
                if let Some(card) = self.deck.deal() {
                    self.community_cards.push(card);
                } else {
                    warn!("Deck exhausted during river");
                    self.hand_complete = true;
                    return;
                }
                self.reset_round();
            }
            BettingRound::River => {
                self.current_round = BettingRound::Showdown;
                self.hand_complete = true;
            }
            BettingRound::Showdown => {
                self.hand_complete = true;
            }
        }
        if !self.hand_complete {
            debug!(round = ?self.current_round, "Round ended, moving to next");
        }
    }

    fn reset_round(&mut self) {
        for p in &mut self.players {
            p.bet_this_round = ChipAmount::new(0).expect("zero amount");
        }
        self.round_bets
            .fill(ChipAmount::new(0).expect("zero amount"));
        self.smallest_bet = ChipAmount::new(0).expect("zero amount");
        self.min_raise = self.blinds.1;
        self.last_aggressor_index = None;
        // Find first active player after dealer
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

    pub fn calculate_pot_winners(&self) -> Vec<Winner> {
        if !self.hand_complete {
            return vec![];
        }
        // Determine players still in hand (not folded)
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
            // Last player standing wins entire pot
            let winner = &self.players[active[0]];
            return vec![Winner {
                player_id: winner.player_id,
                amount: self.pot,
                hand_rank: HandRank::HighCard,
            }];
        }

        // Build total bets per player (for side pots)
        let total_bets: Vec<(PlayerId, ChipAmount)> = active
            .iter()
            .map(|&i| (self.players[i].player_id, self.players[i].total_bet))
            .collect();
        let pots = compute_side_pots(&total_bets);
        let mut winners = Vec::new();

        // For each pot, evaluate hands among eligible players
        for pot in pots {
            let eligible_ids: Vec<PlayerId> = pot.eligible_players;
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
            // Evaluate hands using community cards (if enough)
            if self.community_cards.len() < 5 {
                // Not enough cards – should not happen because Showdown only reached with 5 cards
                warn!("Showdown with incomplete community cards, defaulting to high card");
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
            players,
            0,
            (ChipAmount::new(5).unwrap(), ChipAmount::new(10).unwrap()),
        )
        .unwrap();
        assert!(!state.is_hand_complete());
    }

    #[test]
    fn test_fold_action() {
        let players = vec![
            (pid(1), ChipAmount::new(1000).unwrap()),
            (pid(2), ChipAmount::new(1000).unwrap()),
        ];
        let mut state = GameState::new_hand(
            players,
            0,
            (ChipAmount::new(5).unwrap(), ChipAmount::new(10).unwrap()),
        )
        .unwrap();
        let pid = state.players[state.current_player_index].player_id;
        assert!(state.apply_action(pid, Action::Fold).is_ok());
        assert!(state.players[state.current_player_index].has_folded);
        let players = vec![
            (pid(1), ChipAmount::new(1000).unwrap()),
            (pid(2), ChipAmount::new(1000).unwrap()),
        ];
        let mut state = GameState::new_hand(
            players,
            0,
            (ChipAmount::new(5).unwrap(), ChipAmount::new(10).unwrap()),
        )
        .unwrap();
        let folded_pid = state.players[state.current_player_index].player_id;
        assert!(state.apply_action(folded_pid, Action::Fold).is_ok());
        let folded_idx = state
            .players
            .iter()
            .position(|p| p.player_id == folded_pid)
            .unwrap();
        assert!(state.players[folded_idx].has_folded);
    }

    #[test]
    fn test_invalid_raise() {
        let players = vec![
            (pid(1), ChipAmount::new(1000).unwrap()),
            (pid(2), ChipAmount::new(1000).unwrap()),
        ];
        let mut state = GameState::new_hand(
            players,
            0,
            (ChipAmount::new(5).unwrap(), ChipAmount::new(10).unwrap()),
        )
        .unwrap();
        let pid = state.players[state.current_player_index].player_id;
        let result = state.apply_action(pid, Action::Raise(ChipAmount::new(1).unwrap()));
        assert!(matches!(result, Err(ActionError::InvalidRaise { .. })));
    }
}
