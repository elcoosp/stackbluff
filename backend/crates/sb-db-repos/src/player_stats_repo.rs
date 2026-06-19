use async_trait::async_trait;
use chrono::Utc;
use sb_contracts::repo_api::PersistenceError;
use sb_contracts::stats_api::PlayerStatsRepo;
use sb_db_entities::user_statistics;
use sb_shared_types::player_stats::{PlayerStatsDto, StatsDelta};
use sea_orm::{ActiveModelTrait, DatabaseConnection, EntityTrait, Set};

pub struct PlayerStatsRepoImpl {
    db: DatabaseConnection,
}

impl PlayerStatsRepoImpl {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }
}

#[async_trait]
impl PlayerStatsRepo for PlayerStatsRepoImpl {
    async fn get(&self, user_id: &str) -> Result<PlayerStatsDto, PersistenceError> {
        let stats = user_statistics::Entity::find_by_id(user_id.to_string())
            .one(&self.db)
            .await
            .map_err(|e| PersistenceError::Database(e.to_string()))?;

        Ok(map_model_to_dto(stats, user_id))
    }

    async fn apply_delta(&self, delta: StatsDelta) -> Result<(), PersistenceError> {
        let now = Utc::now().to_rfc3339();
        let user_id = delta.user_id.clone();

        let existing = user_statistics::Entity::find_by_id(user_id.clone())
            .one(&self.db)
            .await
            .map_err(|e| PersistenceError::Database(e.to_string()))?;

        if let Some(model) = existing {
            let old_stats = model.clone();
            let mut active: user_statistics::ActiveModel = model.into();

            active.hands_played = Set(old_stats.hands_played + delta.hands_played);
            active.hands_won = Set(old_stats.hands_won + delta.hands_won);
            active.vpip_hands = Set(old_stats.vpip_hands + delta.vpip_hands);
            active.pfr_hands = Set(old_stats.pfr_hands + delta.pfr_hands);
            active.preflop_fold_count =
                Set(old_stats.preflop_fold_count + delta.preflop_fold_count);
            active.showdowns = Set(old_stats.showdowns + delta.showdowns);
            active.showdown_wins = Set(old_stats.showdown_wins + delta.showdown_wins);
            active.hands_won_without_showdown =
                Set(old_stats.hands_won_without_showdown + delta.hands_won_without_showdown);
            active.total_wagered = Set(old_stats.total_wagered + delta.total_wagered);
            active.total_won = Set(old_stats.total_won + delta.total_won);
            active.net_profit = Set(old_stats.net_profit + delta.net_profit);

            if delta.biggest_pot_won > old_stats.biggest_pot_won {
                active.biggest_pot_won = Set(delta.biggest_pot_won);
            }

            active.all_in_count = Set(old_stats.all_in_count + delta.all_in_count);
            active.bets = Set(old_stats.bets + delta.bets);
            active.raises = Set(old_stats.raises + delta.raises);
            active.calls = Set(old_stats.calls + delta.calls);
            active.last_hand_played_at = Set(Some(now.clone()));
            active.last_hand_id = Set(delta.last_hand_id.clone());
            active.last_updated_at = Set(now);
            active.version = Set(old_stats.version + 1);

            active
                .update(&self.db)
                .await
                .map_err(|e| PersistenceError::Database(e.to_string()))?;
        } else {
            let active = user_statistics::ActiveModel {
                user_id: Set(user_id.clone()),
                hands_played: Set(delta.hands_played),
                hands_won: Set(delta.hands_won),
                vpip_hands: Set(delta.vpip_hands),
                pfr_hands: Set(delta.pfr_hands),
                preflop_fold_count: Set(delta.preflop_fold_count),
                showdowns: Set(delta.showdowns),
                showdown_wins: Set(delta.showdown_wins),
                hands_won_without_showdown: Set(delta.hands_won_without_showdown),
                total_wagered: Set(delta.total_wagered),
                total_won: Set(delta.total_won),
                net_profit: Set(delta.net_profit),
                biggest_pot_won: Set(delta.biggest_pot_won),
                all_in_count: Set(delta.all_in_count),
                bets: Set(delta.bets),
                raises: Set(delta.raises),
                calls: Set(delta.calls),
                last_hand_played_at: Set(Some(now.clone())),
                last_hand_id: Set(delta.last_hand_id.clone()),
                last_updated_at: Set(now),
                version: Set(1),
            };

            active
                .insert(&self.db)
                .await
                .map_err(|e| PersistenceError::Database(e.to_string()))?;
        }

        Ok(())
    }
}

fn map_model_to_dto(model: Option<user_statistics::Model>, user_id: &str) -> PlayerStatsDto {
    if let Some(m) = model {
        let hands_played = m.hands_played as f32;
        let win_rate = if hands_played > 0.0 {
            m.hands_won as f32 / hands_played
        } else {
            0.0
        };
        let vpip = if hands_played > 0.0 {
            m.vpip_hands as f32 / hands_played
        } else {
            0.0
        };
        let pfr = if hands_played > 0.0 {
            m.pfr_hands as f32 / hands_played
        } else {
            0.0
        };
        let wtsd = if hands_played > 0.0 {
            m.showdowns as f32 / hands_played
        } else {
            0.0
        };
        let aggression_factor = if m.calls > 0 {
            (m.bets + m.raises) as f32 / m.calls as f32
        } else {
            0.0
        };

        PlayerStatsDto {
            user_id: m.user_id,
            display_name: None,
            hands_played: m.hands_played as u64,
            hands_won: m.hands_won as u64,
            win_rate,
            vpip,
            pfr,
            aggression_factor,
            showdowns: m.showdowns as u64,
            showdown_wins: m.showdown_wins as u64,
            wtsd,
            total_wagered: m.total_wagered,
            total_won: m.total_won,
            net_profit: m.net_profit,
            biggest_pot_won: m.biggest_pot_won,
            all_in_count: m.all_in_count as u64,
            last_hand_played_at: m.last_hand_played_at,
        }
    } else {
        PlayerStatsDto {
            user_id: user_id.to_string(),
            ..Default::default()
        }
    }
}
