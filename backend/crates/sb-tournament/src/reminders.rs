use std::sync::Arc;
use chrono::{DateTime, Utc, Duration};
use sb_contracts::tournament_api::{TournamentRepo, TournamentStatus};
use sb_contracts::notification_api::{NotificationService, ClubNotifier};
use sb_shared_types::TournamentId;
use tokio::time::sleep_until;
use std::time::Instant;

pub fn schedule_reminders(
    tournament_id: TournamentId,
    start: DateTime<Utc>,
    repo: Arc<dyn TournamentRepo>,
    notification_service: Arc<dyn NotificationService>,
    bot_handler: Option<Arc<dyn sb_contracts::notification_api::ClubNotifier>>,
    app_base_url: String,
) {
    let reminder_60 = start - Duration::minutes(60);
    let reminder_10 = start - Duration::minutes(10);

    if reminder_60 > Utc::now() {
        let repo = repo.clone();
        let ns = notification_service.clone();
        let bh = bot_handler.clone();
        let url = app_base_url.clone();
        let tid = tournament_id;
        tokio::spawn(async move {
            let duration = (reminder_60 - Utc::now()).to_std().unwrap_or_default();
            sleep_until(Instant::now() + duration).await;
            send_reminder(tid, "60 minutes", repo, ns, bh, url).await;
        });
    }

    if reminder_10 > Utc::now() {
        let repo = repo.clone();
        let ns = notification_service.clone();
        let bh = bot_handler.clone();
        let url = app_base_url.clone();
        let tid = tournament_id;
        tokio::spawn(async move {
            let duration = (reminder_10 - Utc::now()).to_std().unwrap_or_default();
            sleep_until(Instant::now() + duration).await;
            send_reminder(tid, "10 minutes", repo, ns, bh, url).await;
        });
    }
}

async fn send_reminder(
    tournament_id: TournamentId,
    label: &str,
    repo: Arc<dyn TournamentRepo>,
    notification_service: Arc<dyn NotificationService>,
    bot_handler: Option<Arc<dyn sb_contracts::notification_api::ClubNotifier>>,
    app_base_url: String,
) {
    let tournament = match repo.get_tournament(tournament_id).await {
        Ok(Some(t)) => t,
        _ => return,
    };

    if tournament.status == TournamentStatus::Cancelled || tournament.status == TournamentStatus::Completed {
        return;
    }

    let registrations = match repo.list_registrations(tournament_id).await {
        Ok(r) => r,
        Err(_) => return,
    };

    let deep_link = format!("{}/tournaments/{}", app_base_url, tournament_id);
    let tournament_name = format!("{:?}", tournament.config.tournament_type);
    let start_time = tournament.config.scheduled_start.unwrap();

    for reg in registrations {
        let _ = notification_service.send(
            reg.user_id,
            sb_contracts::notification_api::NotificationEvent::TournamentReminder {
                tournament_name: tournament_name.clone(),
                start_time,
                deep_link: deep_link.clone(),
            },
        ).await;
    }

    if let Some(bh) = bot_handler {
        if let Some(club_id) = tournament.config.club_id {
            let _ = bh.send_telegram_message(club_id, format!("Tournament {} starts in {}!", tournament_name, label)).await;
        }
    }
}
