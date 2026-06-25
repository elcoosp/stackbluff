use sb_shared_types::{ChipAmount, PlayerId, UserId};

/// A planned move of a player from one table to another.
#[derive(Debug, Clone)]
pub struct PlayerMove {
    pub user_id: UserId,
    pub player_id: PlayerId,
    pub stack: ChipAmount,
    pub from_table_idx: usize,
    pub to_table_idx: usize,
}

/// Given the current state of tables (list of (player_id, user_id, stack) per table),
/// compute the moves needed to rebalance. The algorithm:
/// 1. Collect all players from tables with ≤2 active players.
/// 2. Distribute them evenly among the remaining tables (those with >2 players).
/// 3. Close empty source tables after moves.
pub fn compute_rebalance_moves(tables: &[Vec<(PlayerId, UserId, ChipAmount)>]) -> Vec<PlayerMove> {
    let total_players: usize = tables.iter().map(|t| t.len()).sum();
    let _ = total_players; // total_players used for debugging/logging

    // Identify source tables (≤2 players) and target tables (>2 players)
    let mut source_indices: Vec<usize> = vec![];
    let mut target_indices: Vec<usize> = vec![];
    for (i, table) in tables.iter().enumerate() {
        if table.len() <= 2 {
            source_indices.push(i);
        } else {
            target_indices.push(i);
        }
    }

    if source_indices.is_empty() || target_indices.is_empty() {
        return vec![];
    }

    // Collect all players from source tables
    let mut source_players: Vec<(usize, PlayerId, UserId, ChipAmount)> = vec![];
    for &src_idx in &source_indices {
        for (pid, uid, stack) in &tables[src_idx] {
            source_players.push((src_idx, *pid, *uid, *stack));
        }
    }

    // Distribute source players round-robin to target tables
    let mut moves = Vec::new();
    let mut target_loads: Vec<usize> = target_indices.iter().map(|&i| tables[i].len()).collect();

    for (src_idx, pid, uid, stack) in source_players {
        // Find target with smallest load
        let mut min_load = usize::MAX;
        let mut best_target_idx = 0;
        for (j, &load) in target_loads.iter().enumerate() {
            if load < min_load {
                min_load = load;
                best_target_idx = j;
            }
        }
        let actual_table_idx = target_indices[best_target_idx];
        moves.push(PlayerMove {
            user_id: uid,
            player_id: pid,
            stack,
            from_table_idx: src_idx,
            to_table_idx: actual_table_idx,
        });
        target_loads[best_target_idx] += 1;
    }

    moves
}

/// Compute the final table merge: collect all remaining players and
/// redistribute them to a single table with random seating.
/// Returns the list of moves needed.
pub fn compute_final_table_moves(
    tables: &[Vec<(PlayerId, UserId, ChipAmount)>],
) -> Vec<PlayerMove> {
    let total_players: usize = tables.iter().map(|t| t.len()).sum();
    if total_players == 0 {
        return vec![];
    }

    // Designate the first non-empty table as the final table
    let final_table_idx = tables.iter().position(|t| !t.is_empty()).unwrap_or(0);

    let mut moves = Vec::new();
    for (i, table) in tables.iter().enumerate() {
        if i != final_table_idx && !table.is_empty() {
            for (pid, uid, stack) in table {
                moves.push(PlayerMove {
                    user_id: *uid,
                    player_id: *pid,
                    stack: *stack,
                    from_table_idx: i,
                    to_table_idx: final_table_idx,
                });
            }
        }
    }
    moves
}

#[cfg(test)]
mod tests {
    use super::*;
    use sb_shared_types::PlayerId;
    use uuid::Uuid;

    fn pid(id: u128) -> PlayerId {
        PlayerId::new(Uuid::from_u128(id))
    }
    fn uid(id: u128) -> UserId {
        UserId::new(Uuid::from_u128(id))
    }
    fn stack(v: i64) -> ChipAmount {
        ChipAmount::new(v).unwrap()
    }

    fn make_table(ids: &[(u128, u128, i64)]) -> Vec<(PlayerId, UserId, ChipAmount)> {
        ids.iter()
            .map(|&(pid_val, uid_val, s)| (pid(pid_val), uid(uid_val), stack(s)))
            .collect()
    }

    #[test]
    fn test_rebalance_moves_players_from_small_tables() {
        // Table 0: 2 players, Table 1: 3 players, Table 2: 1 player
        let tables = vec![
            make_table(&[(1, 101, 1000), (2, 102, 1000)]),
            make_table(&[(3, 103, 1000), (4, 104, 1000), (5, 105, 1000)]),
            make_table(&[(6, 106, 1000)]),
        ];
        let moves = compute_rebalance_moves(&tables);
        // Tables 0 and 2 are source (≤2), Table 1 is target
        assert!(!moves.is_empty(), "Should produce moves");
        // All moves should go to table 1
        for m in &moves {
            assert_eq!(m.to_table_idx, 1, "All should move to table 1");
        }
    }

    #[test]
    fn test_no_rebalance_when_all_tables_large() {
        let tables = vec![
            make_table(&[(1, 101, 1000), (2, 102, 1000), (3, 103, 1000)]),
            make_table(&[(4, 104, 1000), (5, 105, 1000), (6, 106, 1000)]),
        ];
        let moves = compute_rebalance_moves(&tables);
        assert!(moves.is_empty());
    }

    #[test]
    fn test_final_table_moves_consolidate_all() {
        let tables = vec![
            make_table(&[(1, 101, 1000)]),
            make_table(&[(2, 102, 1000)]),
            make_table(&[(3, 103, 1000)]),
        ];
        let moves = compute_final_table_moves(&tables);
        // All players should move to table 0 (first non-empty)
        assert_eq!(moves.len(), 2); // Table 0 has 1 player (no move), tables 1,2 move
        for m in &moves {
            assert_eq!(m.to_table_idx, 0);
        }
    }
}
