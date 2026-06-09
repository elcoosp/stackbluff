//! Game state for a poker hand.

use crate::deck::Deck;
use crate::evaluate::evaluate_hand;
use crate::hand_rank::HandRank;
use sb_shared_types::{Card, ChipAmount, PlayerId};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct HandId(pub u64);

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PlayerHandState {
    pub player_id: PlayerId,
    pub hole_cards: Option<[Card; 2]>,
    pub bet_this_round: ChipAmount,
    pub total_bet: ChipAmount,
    pub is_all_in: bool,
    pub has_folded: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BettingRound {
    Preflop, Flop, Turn, River, Showdown,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Action {
    Fold, Check, Call, Raise(ChipAmount),
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum ActionError {
    #[error("Not player's turn")] NotYourTurn,
    #[error("Player already folded")] AlreadyFolded,
    #[error("Player already all-in")] AlreadyAllIn,
    #[error("Invalid raise amount")] InvalidRaise,
    #[error("Game already finished")] HandComplete,
    #[error("Cannot act in showdown")] ShowdownNotActionable,
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
    pub fn new_hand(players: Vec<PlayerId>, blinds: (ChipAmount, ChipAmount)) -> Self {
        let hand_id = HandId(rand::random::<u64>());
        let mut deck = Deck::new();
        deck.shuffle();
        let mut player_states: Vec<PlayerHandState> = players
            .into_iter()
            .map(|pid| PlayerHandState {
                player_id: pid,
                hole_cards: None,
                bet_this_round: ChipAmount::new(0).expect("zero amount"),
                total_bet: ChipAmount::new(0).expect("zero amount"),
                is_all_in: false,
                has_folded: false,
            })
            .collect();
        for state in &mut player_states {
            let c1 = deck.deal().unwrap();
            let c2 = deck.deal().unwrap();
            state.hole_cards = Some([c1, c2]);
        }
        let dealer_index = 0;
        let small_blind_index = (dealer_index + 1) % player_states.len();
        let big_blind_index = (dealer_index + 2) % player_states.len();
        let sb_amount = blinds.0;
        let bb_amount = blinds.1;
        let mut round_bets = vec![ChipAmount::new(0).expect("zero amount"); player_states.len()];
        round_bets[small_blind_index] = sb_amount;
        round_bets[big_blind_index] = bb_amount;
        let pot = sb_amount + bb_amount;
        let smallest_bet = bb_amount;
        let min_raise = bb_amount;
        let current_player_index = (big_blind_index + 1) % player_states.len();
        GameState {
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
        }
    }

    pub fn apply_action(&mut self, player_id: PlayerId, action: Action) -> Result<(), ActionError> {
        if self.hand_complete { return Err(ActionError::HandComplete); }
        let idx = self.players.iter().position(|p| p.player_id == player_id).ok_or(ActionError::NotYourTurn)?;
        if idx != self.current_player_index { return Err(ActionError::NotYourTurn); }
        let player = &mut self.players[idx];
        if player.has_folded { return Err(ActionError::AlreadyFolded); }
        if player.is_all_in { return Err(ActionError::AlreadyAllIn); }
        match action {
            Action::Fold => { player.has_folded = true; self.advance_turn(); }
            Action::Check => {
                if self.round_bets[idx] != self.smallest_bet { return Err(ActionError::InvalidRaise); }
                self.advance_turn();
            }
            Action::Call => {
                let call_amount = self.smallest_bet - self.round_bets[idx];
                if call_amount <= ChipAmount::new(0).expect("zero amount") { return Err(ActionError::InvalidRaise); }
                self.add_bet(idx, call_amount);
                self.advance_turn();
            }
            Action::Raise(raise_amount) => {
                let total_bet = self.round_bets[idx] + raise_amount;
                if total_bet < self.smallest_bet + self.min_raise { return Err(ActionError::InvalidRaise); }
                self.add_bet(idx, raise_amount);
                self.smallest_bet = total_bet;
                self.min_raise = raise_amount;
                self.last_aggressor_index = Some(idx);
                self.advance_turn();
            }
        }
        Ok(())
    }

    fn add_bet(&mut self, idx: usize, amount: ChipAmount) {
        let p = &mut self.players[idx];
        p.bet_this_round = p.bet_this_round + amount;
        p.total_bet = p.total_bet + amount;
        self.round_bets[idx] = self.round_bets[idx] + amount;
        self.pot = self.pot + amount;
    }

    fn advance_turn(&mut self) {
        let mut next = (self.current_player_index + 1) % self.players.len();
        while self.players[next].has_folded || self.players[next].is_all_in {
            next = (next + 1) % self.players.len();
            if next == self.current_player_index {
                self.end_round();
                return;
            }
        }
        self.current_player_index = next;
        if self.round_complete() { self.end_round(); }
    }

    fn round_complete(&self) -> bool {
        let active: Vec<usize> = self.players.iter().enumerate().filter(|(_,p)| !p.has_folded && !p.is_all_in).map(|(i,_)| i).collect();
        if active.is_empty() { return true; }
        let all_bet_equal = active.iter().all(|&i| self.round_bets[i] == self.smallest_bet);
        let last = self.last_aggressor_index;
        let all_acted = active.iter().all(|&i| i == self.current_player_index || self.round_bets[i] == self.smallest_bet);
        all_bet_equal && (last.is_none() || all_acted)
    }

    fn end_round(&mut self) {
        match self.current_round {
            BettingRound::Preflop => {
                self.current_round = BettingRound::Flop;
                for _ in 0..3 { self.community_cards.push(self.deck.deal().unwrap()); }
                self.reset_round();
            }
            BettingRound::Flop => {
                self.current_round = BettingRound::Turn;
                self.community_cards.push(self.deck.deal().unwrap());
                self.reset_round();
            }
            BettingRound::Turn => {
                self.current_round = BettingRound::River;
                self.community_cards.push(self.deck.deal().unwrap());
                self.reset_round();
            }
            BettingRound::River => { self.current_round = BettingRound::Showdown; self.hand_complete = true; }
            BettingRound::Showdown => { self.hand_complete = true; }
        }
    }

    fn reset_round(&mut self) {
        for p in &mut self.players { p.bet_this_round = ChipAmount::new(0).expect("zero amount"); }
        for b in &mut self.round_bets { *b = ChipAmount::new(0).expect("zero amount"); }
        self.smallest_bet = ChipAmount::new(0).expect("zero amount");
        self.min_raise = self.blinds.1;
        self.last_aggressor_index = None;
        let mut start = (self.dealer_index + 1) % self.players.len();
        while self.players[start].has_folded || self.players[start].is_all_in {
            start = (start + 1) % self.players.len();
            if start == (self.dealer_index + 1) % self.players.len() { break; }
        }
        self.current_player_index = start;
    }

    pub fn is_hand_complete(&self) -> bool { self.hand_complete }
    pub fn hand_id(&self) -> HandId { self.hand_id }

    pub fn calculate_pot_winners(&self) -> Vec<Winner> {
        let active: Vec<usize> = self.players.iter().enumerate().filter(|(_,p)| !p.has_folded).map(|(i,_)| i).collect();
        if active.is_empty() { return vec![]; }
        if active.len() == 1 {
            return vec![Winner { player_id: self.players[active[0]].player_id, amount: self.pot, hand_rank: HandRank::HighCard }];
        }
        let community: [Card;5] = self.community_cards.clone().try_into().unwrap();
        let mut best_rank = HandRank::HighCard;
        let mut winners = Vec::new();
        for &i in &active {
            let hole = self.players[i].hole_cards.as_ref().unwrap();
            let rank = evaluate_hand(hole, &community);
            if rank > best_rank {
                best_rank = rank;
                winners = vec![self.players[i].player_id];
            } else if rank == best_rank {
                winners.push(self.players[i].player_id);
            }
        }
        let share = self.pot / ChipAmount::new(winners.len() as i64).expect("positive length");
        winners.into_iter().map(|pid| Winner { player_id: pid, amount: share, hand_rank: best_rank }).collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn test_fold_action() {
        let players = vec![PlayerId(1), PlayerId(2)];
        let mut state = GameState::new_hand(players, (ChipAmount::new(5).unwrap(), ChipAmount::new(10).unwrap()));
        let pid = state.players[state.current_player_index].player_id;
        assert!(state.apply_action(pid, Action::Fold).is_ok());
    }
}
