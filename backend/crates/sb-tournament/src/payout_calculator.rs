use sb_contracts::tournament_api::PayoutStructure;

/// Pure function: calculates prize distribution for a given prize pool.
/// Remainder chips go to the first position.
pub fn calculate_payouts(prize_pool: i64, structure: &PayoutStructure) -> Vec<(u32, i64)> {
    let mut payouts = Vec::new();
    let mut total_distributed: i64 = 0;

    for entry in &structure.entries {
        let amount = (prize_pool as f64 * entry.percentage as f64 / 100.0).floor() as i64;
        payouts.push((entry.position, amount));
        total_distributed += amount;
    }

    // Give remainder to first position
    let remainder = prize_pool - total_distributed;
    if remainder > 0 {
        payouts[0].1 += remainder;
    }

    payouts
}

#[cfg(test)]
mod tests {
    use super::*;
    use sb_contracts::tournament_api::PayoutEntry;

    #[test]
    fn test_standard_3_player_payout() {
        let structure = PayoutStructure {
            entries: vec![
                PayoutEntry {
                    position: 1,
                    percentage: 50.0,
                },
                PayoutEntry {
                    position: 2,
                    percentage: 30.0,
                },
                PayoutEntry {
                    position: 3,
                    percentage: 20.0,
                },
            ],
        };
        let prize_pool = 1000;
        let payouts = calculate_payouts(prize_pool, &structure);
        assert_eq!(payouts.len(), 3);
        assert_eq!(payouts[0], (1, 500));
        assert_eq!(payouts[1], (2, 300));
        assert_eq!(payouts[2], (3, 200));
    }

    #[test]
    fn test_remainder_goes_to_first() {
        let structure = PayoutStructure {
            entries: vec![
                PayoutEntry {
                    position: 1,
                    percentage: 50.0,
                },
                PayoutEntry {
                    position: 2,
                    percentage: 50.0,
                },
            ],
        };
        let prize_pool = 1001; // Odd number
        let payouts = calculate_payouts(prize_pool, &structure);
        assert_eq!(payouts[0].1 + payouts[1].1, 1001);
        // First gets the extra chip
        assert_eq!(payouts[0].1, 501);
        assert_eq!(payouts[1].1, 500);
    }
}
