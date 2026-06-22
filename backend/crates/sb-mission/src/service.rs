use std::collections::HashSet;
use std::sync::Arc;
use async_trait::async_trait;
use chrono::{NaiveDate, Utc};
use rand::rngs::StdRng;
use rand::SeedableRng;
use rand::RngExt;       // for gen_range
use sea_orm::*;
use sb_shared_types::missions::*;
use sb_shared_types::game_types::HandResult;
use sb_shared_types::chips::ChipAmount;
use sb_shared_types::errors::AppError;
use sb_shared_types::request_context::RequestContext;
use sb_shared_types::ids::UserId;
use sb_contracts::service_api::{MissionApi, ClaimResult, UserService};

use crate::entities::{daily_mission, streak};

pub struct MissionServiceImpl {
    db: Arc<DatabaseConnection>,
    user_service: Arc<dyn UserService>,
}

impl MissionServiceImpl {
    pub fn new(db: Arc<DatabaseConnection>, user_service: Arc<dyn UserService>) -> Self {
        Self { db, user_service }
    }

    fn extract_user_id(&self, ctx: &RequestContext) -> Result<UserId, AppError> {
        ctx.user_id.ok_or_else(|| AppError::from("No user id"))
    }

    fn select_daily_missions(&self, user_id: UserId, date: NaiveDate) -> [usize; 3] {
        let pool = all_mission_definitions();
        let seed = format!("{}-{}", date, user_id.0);
        let mut hasher = std::hash::DefaultHasher::new();
        std::hash::Hash::hash(&seed, &mut hasher);
        let hash = std::hash::Hasher::finish(&hasher);
        let mut rng = StdRng::seed_from_u64(hash);
        let mut indices = HashSet::new();
        while indices.len() < 3 {
            indices.insert(rng.random_range(0..pool.len()));
        }
        let mut v: Vec<_> = indices.into_iter().collect();
        v.sort();
        [v[0], v[1], v[2]]
    }

    async fn ensure_daily_assignments(&self, user_id: UserId, date: NaiveDate) -> Result<Vec<daily_mission::Model>, AppError> {
        let existing = daily_mission::Entity::find()
            .filter(daily_mission::Column::UserId.eq(user_id.0))
            .filter(daily_mission::Column::AssignedDate.eq(date))
            .all(self.db.as_ref())
            .await
            .map_err(|e| AppError::from(e.to_string()))?;

        if !existing.is_empty() {
            return Ok(existing);
        }

        let pool = all_mission_definitions();
        let indices = self.select_daily_missions(user_id, date);
        let mut new_assignments = Vec::new();
        for &idx in &indices {
            let (type_key, _, _, _, _) = &pool[idx];
            let active = daily_mission::ActiveModel {
                user_id: Set(user_id.0),
                assigned_date: Set(date),
                mission_type: Set(type_key.clone()),
                progress: Set(0),
                completed: Set(false),
                rerolled: Set(false),
                reward_claimed: Set(false),
                ..Default::default()
            };
            let model = ActiveModelTrait::insert(active, self.db.as_ref())
                .await
                .map_err(|e| AppError::from(e.to_string()))?;
            new_assignments.push(model);
        }
        Ok(new_assignments)
    }
}

#[async_trait]
impl MissionApi for MissionServiceImpl {
    async fn on_hand_completed(&self, ctx: &RequestContext, hand_result: &HandResult) -> Result<(), AppError> {
        let user_id = self.extract_user_id(ctx)?;
        let today = Utc::now().date_naive();
        let assignments = self.ensure_daily_assignments(user_id, today).await?;
        let pool = all_mission_definitions();

        for assignment in assignments.iter().filter(|a| !a.completed) {
            let def = pool.iter().find(|(t,_,_,_,_)| t == &assignment.mission_type);
            if def.is_none() { continue; }
            let (_, _, _, target, _) = def.unwrap();
            let new_progress = match assignment.mission_type.as_str() {
                "play_10_hands" | "play_20_hands" => assignment.progress + 1,
                "raise_preflop_10" if hand_result.hero_raised_preflop => assignment.progress + 1,
                "showdown_5" if hand_result.went_to_showdown => assignment.progress + 1,
                "all_in_3" if hand_result.hero_went_allin => assignment.progress + 1,
                _ => assignment.progress,
            };
            if new_progress != assignment.progress {
                let mut active: daily_mission::ActiveModel = assignment.clone().into();
                active.progress = Set(new_progress);
                if new_progress >= *target as i32 {
                    active.completed = Set(true);
                }
                ActiveModelTrait::update(active, self.db.as_ref())
                    .await
                    .map_err(|e| AppError::from(e.to_string()))?;
            }
        }
        Ok(())
    }

    async fn on_share_created(&self, ctx: &RequestContext, share_type: &str) -> Result<(), AppError> {
        if share_type != "replay_card" && share_type != "referral" { return Ok(()); }
        let user_id = self.extract_user_id(ctx)?;
        let today = Utc::now().date_naive();
        let assignments = self.ensure_daily_assignments(user_id, today).await?;
        let share_types = vec!["share_replay", "referral_5_hands"];
        for a in assignments.iter().filter(|a| share_types.contains(&a.mission_type.as_str()) && !a.completed) {
            let mut active: daily_mission::ActiveModel = a.clone().into();
            active.completed = Set(true);
            ActiveModelTrait::update(active, self.db.as_ref())
                .await
                .map_err(|e| AppError::from(e.to_string()))?;
        }
        Ok(())
    }

    async fn get_today_missions(&self, ctx: &RequestContext) -> Result<Vec<Mission>, AppError> {
        let user_id = self.extract_user_id(ctx)?;
        let today = Utc::now().date_naive();
        let assignments = self.ensure_daily_assignments(user_id, today).await?;
        let pool = all_mission_definitions();
        let mut missions = Vec::new();
        for (i, a) in assignments.iter().enumerate() {
            if let Some((_, desc, reward, target, category)) = pool.iter().find(|(t,_,_,_,_)| t == &a.mission_type) {
                missions.push(Mission {
                    id: MissionId(i as u32),
                    mission_type: a.mission_type.clone(),
                    description: desc.clone(),
                    reward_chips: *reward,
                    completed: a.completed,
                    progress: a.progress as u32,
                    target: *target,
                    category: category.clone(),
                });
            }
        }
        Ok(missions)
    }

    async fn reroll_mission(&self, ctx: &RequestContext, mission_id: MissionId) -> Result<Mission, AppError> {
        let user_id = self.extract_user_id(ctx)?;
        let today = Utc::now().date_naive();
        let assignments = self.ensure_daily_assignments(user_id, today).await?;
        let idx = mission_id.0 as usize;
        if idx >= assignments.len() { return Err(AppError::from("Invalid mission id")); }
        if assignments[idx].rerolled { return Err(AppError::from("Already rerolled")); }
        if assignments[idx].completed { return Err(AppError::from("Cannot reroll completed mission")); }

        let mut active: daily_mission::ActiveModel = assignments[idx].clone().into();
        active.mission_type = Set("play_10_hands".to_string());
        active.progress = Set(0);
        active.rerolled = Set(true);
        let updated = ActiveModelTrait::update(active, self.db.as_ref())
            .await
            .map_err(|e| AppError::from(e.to_string()))?;

        let pool = all_mission_definitions();
        let def = pool.iter().find(|(t,_,_,_,_)| t == "play_10_hands").unwrap();
        Ok(Mission {
            id: mission_id,
            mission_type: updated.mission_type.clone(),
            description: def.1.clone(),
            reward_chips: def.2,
            completed: updated.completed,
            progress: updated.progress as u32,
            target: def.3,
            category: def.4.clone(),
        })
    }

    async fn claim_daily_reward(&self, ctx: &RequestContext) -> Result<ClaimResult, AppError> {
        let user_id = self.extract_user_id(ctx)?;
        let today = Utc::now().date_naive();
        let assignments = self.ensure_daily_assignments(user_id, today).await?;

        if assignments.iter().any(|a| !a.completed || a.reward_claimed) {
            return Err(AppError::from("Not all missions completed or reward already claimed"));
        }

        let pool = all_mission_definitions();
        let mut total_chips: i64 = 0;
        let txn = self.db.begin().await.map_err(|e| AppError::from(e.to_string()))?;

        for a in assignments.iter() {
            let mut active: daily_mission::ActiveModel = a.clone().into();
            active.reward_claimed = Set(true);
            ActiveModelTrait::update(active, &txn).await.map_err(|e| AppError::from(e.to_string()))?;
            if let Some((_, _, reward, _, _)) = pool.iter().find(|(t,_,_,_,_)| t == &a.mission_type) {
                total_chips += reward;
            }
        }

        total_chips += 2000;

        let streak_model = streak::Entity::find_by_id(user_id.0)
            .one(&txn)
            .await
            .map_err(|e| AppError::from(e.to_string()))?
            .unwrap_or_else(|| streak::Model {
                user_id: user_id.0,
                current_streak: 0,
                longest_streak: 0,
                last_completion_date: None,
                streak_shield_available: 0,
                weekly_bonus_awarded_streak: 0,
            });

        let last_date = streak_model.last_completion_date;
        let today_streak: i32 = if let Some(last) = last_date {
            if today == last.succ_opt().unwrap_or(last) { streak_model.current_streak + 1 }
            else if today.succ_opt() == Some(last) { streak_model.current_streak }
            else { 1 }
        } else { 1 };

        let longest = std::cmp::max(streak_model.longest_streak, today_streak);
        let mut weekly_bonus = false;
        let mut shield_gain = 0;
        if today_streak % 7 == 0 && today_streak > streak_model.weekly_bonus_awarded_streak {
            total_chips += 10000;
            shield_gain = 1;
            weekly_bonus = true;
        }

        let mut streak_active: streak::ActiveModel = streak_model.into();
        streak_active.current_streak = Set(today_streak);
        streak_active.longest_streak = Set(longest);
        streak_active.last_completion_date = Set(Some(today));
        streak_active.streak_shield_available = Set(streak_active.streak_shield_available.unwrap() + shield_gain);
        if weekly_bonus {
            streak_active.weekly_bonus_awarded_streak = Set(today_streak);
        }
        ActiveModelTrait::update(streak_active, &txn).await.map_err(|e| AppError::from(e.to_string()))?;

        let chip_amount = ChipAmount::new(total_chips)
            .ok_or_else(|| AppError::from("Invalid chip amount"))?;
        self.user_service.award_chips(user_id, chip_amount).await?;

        txn.commit().await.map_err(|e| AppError::from(e.to_string()))?;

        Ok(ClaimResult {
            chips_awarded: chip_amount,
            streak_count: today_streak as u32,
            weekly_bonus_awarded: weekly_bonus,
        })
    }
}
