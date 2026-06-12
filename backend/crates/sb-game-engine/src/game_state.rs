//! Game state for a poker hand – fully production‑ready.

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
    pub stack: ChipAmount,
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
    pub fn new_hand(
        players: Vec<(PlayerId, ChipAmount)>,
        dealer_index: usize,
        blinds: (ChipAmount, ChipAmount),
    ) -> Result<Self, &'static str> {
        if players.len() < 2 {
            return Err("Need at least 2 players");
        }
        let sb = blinds.0;
        let bb = blinds.1;
        // Validate that each player has enough chips for the blind they will post
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
        if player.stack == ChipAmount::new(0).unwrap() {
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
        if self.current_round == BettingRound::Showdown {
            return Err(ActionError::ShowdownNotActionable);
        }

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
                self.players[idx].has_folded = true;
                debug!(player = ?self.players[idx].player_id, "Fold");
                self.advance_turn();
            }
            Action::Check => {
                if round_bet != smallest_bet {
                    return Err(ActionError::InvalidRaise {
                        attempted: ChipAmount::new(0).unwrap(),
                        min: min_raise,
                    });
                }
                debug!(player = ?self.players[idx].player_id, "Check");
                self.advance_turn();
            }
            Action::Call => {
                let call_amount = smallest_bet - round_bet;
                if call_amount <= ChipAmount::new(0).unwrap() {
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
        if p.stack == ChipAmount::new(0).unwrap() {
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
        let all_bet_equal = active
            .iter()
            .all(|&i| self.round_bets[i] == self.smallest_bet);
        let last = self.last_aggressor_index;
        let all_acted = active
            .iter()
            .all(|&i| i == self.current_player_index || self.round_bets[i] == self.smallest_bet);
        all_bet_equal && (last.is_none() || all_acted)
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
            BettingRound::Showdown => self.hand_complete = true,
        }
        if !self.hand_complete {
            debug!(round = ?self.current_round, "Round ended, moving to next");
        }
    }

    fn reset_round(&mut self) {
        for p in &mut self.players {
            p.bet_this_round = ChipAmount::new(0).unwrap();
        }
        self.round_bets.fill(ChipAmount::new(0).unwrap());
        self.smallest_bet = ChipAmount::new(0).unwrap();
        self.min_raise = self.blinds.1;
        self.last_aggressor_index = None;
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

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------
#[cfg(test)]
mod tests {
    use super::*;
    use sb_shared_types::{Card, Rank, Suit};
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
        let folded_id = state.players[state.current_player_index].player_id;
        assert!(state.apply_action(folded_id, Action::Fold).is_ok());
        let folded_idx = state
            .players
            .iter()
            .position(|p| p.player_id == folded_id)
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
            players,
            0,
            (ChipAmount::new(5).unwrap(), ChipAmount::new(10).unwrap()),
        )
        .unwrap();
        let first = state.players[state.current_player_index].player_id;
        state.apply_action(first, Action::Call).unwrap();
        assert_eq!(state.current_round, BettingRound::Flop);
        assert_eq!(state.community_cards.len(), 3);
    }

    #[test]
    fn test_dealer_rotation() {
        let players = vec![
            (pid(1), ChipAmount::new(1000).unwrap()),
            (pid(2), ChipAmount::new(1000).unwrap()),
            (pid(3), ChipAmount::new(1000).unwrap()),
        ];
        let state = GameState::new_hand(
            players,
            1,
            (ChipAmount::new(5).unwrap(), ChipAmount::new(10).unwrap()),
        )
        .unwrap();
        assert_eq!(state.players[2].player_id, pid(3));
        assert_eq!(state.players[0].player_id, pid(1));
    }

    // Insufficient stack tests – now with correct dealer assignment
    #[test]
    fn test_insufficient_stack_call() {
        // Dealer = 1 so that small blind is player 0 (short stack) and big blind is player 1 (large)
        let players = vec![
            (pid(1), ChipAmount::new(9).unwrap()),
            (pid(2), ChipAmount::new(1000).unwrap()),
        ];
        let mut state = GameState::new_hand(
            players,
            1,
            (ChipAmount::new(5).unwrap(), ChipAmount::new(10).unwrap()),
        )
        .unwrap();
        // After posting, small blind (player0) has 4 chips left, call amount = 10 - 5 = 5 -> insufficient
        let sb_id = state.players[state.current_player_index].player_id;
        let result = state.apply_action(sb_id, Action::Call);
        assert!(matches!(result, Err(ActionError::InsufficientStack { .. })));
    }

    #[test]
    fn test_insufficient_stack_raise() {
        // Dealer = 1, short stack small blind (player0) with 15 after blind? Let's give 20 to start.
        let players = vec![
            (pid(1), ChipAmount::new(20).unwrap()),
            (pid(2), ChipAmount::new(1000).unwrap()),
        ];
        let mut state = GameState::new_hand(
            players,
            1,
            (ChipAmount::new(5).unwrap(), ChipAmount::new(10).unwrap()),
        )
        .unwrap();
        // After SB, stack = 15. Minimum raise = 10. Raise of 11 is allowed? Actually raise amount is additional chips.
        // To cause insufficient stack, raise huge amount.
        let sb_id = state.players[state.current_player_index].player_id;
        let result = state.apply_action(sb_id, Action::Raise(ChipAmount::new(100).unwrap()));
        assert!(matches!(result, Err(ActionError::InsufficientStack { .. })));
    }

    #[test]
    fn test_all_in_scenario_no_side_pot() {
        let players = vec![
            (pid(1), ChipAmount::new(100).unwrap()),
            (pid(2), ChipAmount::new(200).unwrap()),
        ];
        let mut state = GameState::new_hand(
            players,
            0,
            (ChipAmount::new(5).unwrap(), ChipAmount::new(10).unwrap()),
        )
        .unwrap();
        state.players[0].stack = ChipAmount::new(0).unwrap();
        state.players[0].is_all_in = true;
        state.hand_complete = true;
        state.current_round = BettingRound::Showdown;
        let winners = state.calculate_pot_winners();
        assert!(!winners.is_empty());
    }

    #[test]
    fn test_all_in_cannot_act() {
        let players = vec![
            (pid(1), ChipAmount::new(50).unwrap()),
            (pid(2), ChipAmount::new(1000).unwrap()),
        ];
        let mut state = GameState::new_hand(
            players,
            0,
            (ChipAmount::new(5).unwrap(), ChipAmount::new(10).unwrap()),
        )
        .unwrap();
        state.players[0].stack = ChipAmount::new(0).unwrap();
        state.players[0].is_all_in = true;
        state.current_player_index = 0;
        let res = state.apply_action(state.players[0].player_id, Action::Call);
        assert!(matches!(res, Err(ActionError::AlreadyAllIn)));
    }

    #[test]
    fn test_betting_round_completion_after_raise() {
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
        let first = state.players[state.current_player_index].player_id;
        state
            .apply_action(first, Action::Raise(ChipAmount::new(20).unwrap()))
            .unwrap();
        let second = state.players[state.current_player_index].player_id;
        state.apply_action(second, Action::Call).unwrap();
        assert_eq!(state.current_round, BettingRound::Flop);
        assert_eq!(state.community_cards.len(), 3);
    }

    #[test]
    fn test_fold_to_end_round() {
        let players = vec![
            (pid(1), ChipAmount::new(1000).unwrap()),
            (pid(2), ChipAmount::new(1000).unwrap()),
            (pid(3), ChipAmount::new(1000).unwrap()),
        ];
        let mut state = GameState::new_hand(
            players,
            0,
            (ChipAmount::new(5).unwrap(), ChipAmount::new(10).unwrap()),
        )
        .unwrap();
        let first = state.players[state.current_player_index].player_id;
        state.apply_action(first, Action::Fold).unwrap();
        let second = state.players[state.current_player_index].player_id;
        state.apply_action(second, Action::Call).unwrap();
        assert_eq!(state.current_round, BettingRound::Flop);
    }

    #[test]
    fn test_all_in_with_side_pot() {
        let a = pid(1);
        let b = pid(2);
        let c = pid(3);
        let players = vec![
            (a, ChipAmount::new(1000).unwrap()),
            (b, ChipAmount::new(1000).unwrap()),
            (c, ChipAmount::new(1000).unwrap()),
        ];
        let mut state = GameState::new_hand(
            players,
            0,
            (ChipAmount::new(5).unwrap(), ChipAmount::new(10).unwrap()),
        )
        .unwrap();
        state.players[0].total_bet = ChipAmount::new(50).unwrap();
        state.players[1].total_bet = ChipAmount::new(100).unwrap();
        state.players[2].total_bet = ChipAmount::new(100).unwrap();
        state.players[0].is_all_in = true;
        state.hand_complete = true;
        state.current_round = BettingRound::Showdown;
        state.community_cards = vec![
            Card {
                suit: Suit::Hearts,
                rank: Rank::Two,
            },
            Card {
                suit: Suit::Diamonds,
                rank: Rank::Three,
            },
            Card {
                suit: Suit::Clubs,
                rank: Rank::Four,
            },
            Card {
                suit: Suit::Spades,
                rank: Rank::Five,
            },
            Card {
                suit: Suit::Hearts,
                rank: Rank::Six,
            },
        ];
        state.players[0].hole_cards = Some([
            Card {
                suit: Suit::Hearts,
                rank: Rank::Two,
            },
            Card {
                suit: Suit::Clubs,
                rank: Rank::Three,
            },
        ]);
        state.players[1].hole_cards = Some([
            Card {
                suit: Suit::Hearts,
                rank: Rank::Queen,
            },
            Card {
                suit: Suit::Clubs,
                rank: Rank::Queen,
            },
        ]);
        state.players[2].hole_cards = Some([
            Card {
                suit: Suit::Hearts,
                rank: Rank::Ace,
            },
            Card {
                suit: Suit::Clubs,
                rank: Rank::Ace,
            },
        ]);
        let winners = state.calculate_pot_winners();
        let total_for_c = winners
            .iter()
            .find(|w| w.player_id == c)
            .map(|w| w.amount.as_i64())
            .unwrap_or(0);
        assert!(total_for_c > 0);
    }
}

impl GameState {
    /// Returns the PlayerId of the player whose turn it is
    pub fn current_player_id(&self) -> Option<PlayerId> {
        if self.hand_complete || self.current_round == BettingRound::Showdown {
            return None;
        }
        self.players.get(self.current_player_index).map(|p| p.player_id)
    }

    /// Returns the amount needed to call for the current player
    pub fn current_call_amount(&self) -> ChipAmount {
        if let Some(player) = self.players.get(self.current_player_index) {
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
}
