//! Pot and side pot management.
use sb_shared_types::{ChipAmount, PlayerId};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Pot {
    pub amount: ChipAmount,
    pub eligible_players: Vec<PlayerId>, // players who can win this pot
}

/// Given a list of players with their total bets, compute side pots.
/// Returns a vector of pots from smallest to largest (main pot first).
pub fn compute_side_pots(players: &[(PlayerId, ChipAmount)]) -> Vec<Pot> {
    // Sort players by total bet ascending
    let mut sorted: Vec<(PlayerId, ChipAmount)> = players.to_vec();
    sorted.sort_by_key(|(_, bet)| bet.as_i64());

    let mut pots = Vec::new();
    let mut last_bet = ChipAmount::new(0).expect("zero amount");
    let mut remaining_players: Vec<(PlayerId, ChipAmount)> = sorted;

    while !remaining_players.is_empty() {
        // The minimum bet among remaining players
        let min_bet = remaining_players[0].1;
        let contribution = if last_bet == ChipAmount::new(0).expect("zero amount") {
            min_bet
        } else {
            min_bet - last_bet
        };
        if contribution > ChipAmount::new(0).expect("zero amount") {
            let pot_amount = contribution * ChipAmount::new(remaining_players.len() as i64).expect("positive");
            let eligible = remaining_players.iter().map(|(p, _)| *p).collect();
            pots.push(Pot {
                amount: pot_amount,
                eligible_players: eligible,
            });
        }
        last_bet = min_bet;
        // Remove players with this bet (they are all‑in and cannot win further pots)
        remaining_players.retain(|(_, bet)| *bet > min_bet);
    }
    pots
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;
    fn pid(id: u128) -> PlayerId {
        PlayerId(Uuid::from_u128(id))
    }

    #[test]
    fn test_side_pots_simple() {
        let players = vec![(pid(1), ChipAmount::new(100).unwrap()), (pid(2), ChipAmount::new(50).unwrap())];
        let pots = compute_side_pots(&players);
        assert_eq!(pots.len(), 2);
        assert_eq!(pots[0].amount, ChipAmount::new(100).unwrap()); // 50*2
        assert_eq!(pots[0].eligible_players.len(), 2);
        assert_eq!(pots[1].amount, ChipAmount::new(50).unwrap()); // (100-50)*1
        assert_eq!(pots[1].eligible_players, vec![pid(1)]);
    }
}
