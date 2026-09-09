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

        // Get results to avoid double-refunding
        let results = repo.list_results(tournament.id).await?;
        let result_user_ids: std::collections::HashSet<_> =
            results.iter().map(|r| r.user_id).collect();

        // Get all registrations and refund buy-ins only if not already paid out
        let registrations = repo.list_registrations(tournament.id).await?;
        for reg in &registrations {
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

        // Mark as cancelled
        if let Err(e) = repo
            .set_status(tournament.id, TournamentStatus::Cancelled, None)
            .await
        {
            error!(
                tournament_id = %tournament.id,
                error = ?e,
                "Failed to mark crashed tournament as cancelled"
            );
        }

        info!(
            tournament_id = %tournament.id,
            players_refunded = registrations.len(),
            "crashed tournament settled"
        );
    }

    Ok(())
}
