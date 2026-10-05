use tracing::{error, info};

use sb_contracts::tournament_api::{TournamentRepo, TournamentStatus};
use sb_shared_types::AppError;

/// On server startup, resolve any tournaments that were in `Running` state
/// during a crash. Refunds remaining players and marks tournament as Cancelled.
pub async fn settle_crashed_tournaments(
    repo: &dyn TournamentRepo,
    user_repo: &dyn sb_contracts::repo_api::UserRepo,
) -> Result<(), AppError> {
    let running = repo
        .list_tournaments(None, None)
        .await?
        .into_iter()
        .filter(|t| t.status == TournamentStatus::Running)
        .collect::<Vec<_>>();

    for tournament in running {
        info!(
            tournament_id = %tournament.id,
            "settling crashed tournament..."
        );

        // B-8 FIX: flip the status FIRST and only refund if the flip
        // actually changed it. The previous ordering (refund -> flip)
        // meant a crash or a failed `set_status` between the two steps
        // refunded the same registrations again on the next restart —
        // minting chips every startup. Flipping first makes the whole
        // operation idempotent: after the first transition Running ->
        // Cancelled, later startups skip. Worst case on crash we lose
        // refunds, but we never create chips out of nothing.
        //
        // The preferred long-term fix is a single transaction that marks
        // each registration `refunded = true` and credits chips inside
        // it, plus a `chip_committed` column (see B-3).
        match repo
            .set_status(tournament.id, TournamentStatus::Cancelled, None)
            .await
        {
            Ok(()) => {}
            Err(e) => {
                error!(
                    tournament_id = %tournament.id,
                    error = ?e,
                    "Skipping refund: could not flip crashed tournament to Cancelled"
                );
                continue;
            }
        }

        // Now that we own the transition, refund non-winners.
        let results = repo.list_results(tournament.id).await?;
        let result_user_ids: std::collections::HashSet<_> =
            results.iter().map(|r| r.user_id).collect();

        let registrations = repo.list_registrations(tournament.id).await?;
        for reg in &registrations {
            // B-3/B-8 follow-up: only refund registrations whose buy-in was
            // actually debited. The previous version refunded every row,
            // including rows whose buy-in was never charged (missing
            // wallet debit path) — minting chips on every crashed
            // tournament.
            if !reg.chip_committed {
                info!(
                    tournament_id = %tournament.id,
                    user_id = %reg.user_id,
                    "Skipping refund for registration whose buy-in was never charged"
                );
                continue;
            }
            if result_user_ids.contains(&reg.user_id) {
                info!(
                    tournament_id = %tournament.id,
                    user_id = %reg.user_id,
                    "Skipping refund for player who already received prize"
                );
                continue;
            }
            let ctx = sb_shared_types::RequestContext::new(uuid::Uuid::new_v4(), Some(reg.user_id));
            if let Err(e) = user_repo
                .update_chip_balance(ctx.clone(), reg.user_id, tournament.config.buy_in.as_i64())
                .await
            {
                error!(
                    tournament_id = %tournament.id,
                    user_id = %reg.user_id,
                    error = ?e,
                    "Failed to refund crashed tournament buy-in"
                );
            }
        }

        info!(
            tournament_id = %tournament.id,
            players_refunded = registrations.len(),
            "crashed tournament settled"
        );
    }

    Ok(())
}
