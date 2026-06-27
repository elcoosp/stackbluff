use std::sync::Arc;
use chrono::{DateTime, Utc, Duration};
use sb_contracts::tournament_api::{TournamentRepo, TournamentStatus};
use sb_contracts::notification_api::{NotificationService, ClubNotifier};
use sb_shared_types::TournamentId;
use tokio::time::{sleep_until, Instant};

pub fn schedule_reminders(
    tournament_id: TournamentId,
    start: DateTime<Utc>,
    repo: Arc<dyn TournamentRepo>,
    notification_service: Arc<dyn NotificationService>,
    club_notifier: Option<Arc<dyn ClubNotifier>>,
    app_base_url: String,
) {
    let reminder_60 = start - Duration::minutes(60);
    let reminder_10 = start - Duration::minutes(10);

    if reminder_60 > Utc::now() {
        let repo = repo.clone();
        let ns = notification_service.clone();
        let cn = club_notifier.clone();
        let url = app_base_url.clone();
        let tid = tournament_id;
        tokio::spawn(async move {
            let duration = (reminder_60 - Utc::now()).to_std().unwrap_or_default();
            sleep_until(Instant::now() + duration).await;
            send_reminder(tid, "60 minutes", repo, ns, cn, url).await;
        });
    }

    if reminder_10 > Utc::now() {
        let repo = repo.clone();
        let ns = notification_service.clone();
        let cn = club_notifier.clone();
        let url = app_base_url.clone();
        let tid = tournament_id;
        tokio::spawn(async move {
            let duration = (reminder_10 - Utc::now()).to_std().unwrap_or_default();
            sleep_until(Instant::now() + duration).await;
            send_reminder(tid, "10 minutes", repo, ns, cn, url).await;
        });
    }
}

async fn send_reminder(
    tournament_id: TournamentId,
    label: &str,
    repo: Arc<dyn TournamentRepo>,
    notification_service: Arc<dyn NotificationService>,
    club_notifier: Option<Arc<dyn ClubNotifier>>,
    app_base_url: String,
) {
    let tournament = match repo.get_tournament(tournament_id).await {
        Ok(Some(t)) => t,
        _ => return,
    };

    if tournament.status == TournamentStatus::Cancelled
        || tournament.status == TournamentStatus::Completed
    {
        return;
    }

    let registrations = match repo.list_registrations(tournament_id).await {
        Ok(r) => r,
        Err(_) => return,
    };

    let deep_link = format!("{}/tournaments/{}", app_base_url, tournament_id);
    let tournament_name = format!("{:?}", tournament.config.tournament_type);
    let start_time = tournament.config.scheduled_start.unwrap().to_rfc3339();

    let message = format!(
        "🏟️ Tournament \"{}\" starts at {}. Join now: {}",
        tournament_name, start_time, deep_link
    );

    for reg in registrations {
        if let Err(e) = notification_service
            .send_telegram_message_to_user(reg.user_id, message.clone(), None)
            .await
        {
            tracing::warn!(user_id = %reg.user_id, error = %e, "Failed to send tournament reminder");
        }
    }

    if let Some(cn) = club_notifier
        && let Some(club_id) = tournament.config.club_id
    {
        let club_message = format!(
            "🏟️ Tournament \"{}\" starts in {}! Join: {}",
            tournament_name, label, deep_link
        );
        if let Err(e) = cn.send_club_reminder(club_id, club_message).await {
            tracing::warn!(club_id = %club_id, error = %e, "Failed to send club reminder");
        }
    }
}
