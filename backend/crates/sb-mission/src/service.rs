use async_trait::async_trait;
use chrono::{NaiveDate, Utc};
use rand::RngExt; // for gen_range
use rand::SeedableRng;
use rand::rngs::StdRng;
use sb_contracts::service_api::{ClaimResult, MissionApi, UserService};
use sb_shared_types::chips::ChipAmount;
use sb_shared_types::errors::AppError;
use sb_shared_types::game_types::HandResult;
use sb_shared_types::ids::UserId;
use sb_shared_types::missions::*;
use sb_shared_types::request_context::RequestContext;
use sea_orm::*;
use std::collections::HashSet;
use std::sync::Arc;

use crate::entities::{daily_mission, streak};

/// H-3 FIX: the pool of mission types whose progress handlers are
/// actually implemented in `progress_from_hand`. The audit found
/// 28 of 33 declared types were unreachable, so users were assigned
/// impossible daily missions and could not complete the reward.
const IMPLEMENTABLE_DAILY: &[&str] = &[
    "play_10_hands",
    "play_20_hands",
    "raise_preflop_10",
    "showdown_5",
    "all_in_3",
];

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

    async fn ensure_daily_assignments(
        &self,
        user_id: UserId,
        date: NaiveDate,
    ) -> Result<Vec<daily_mission::Model>, AppError> {
        let existing = daily_mission::Entity::find()
            .filter(daily_mission::Column::UserId.eq(user_id.0))
            .filter(daily_mission::Column::AssignedDate.eq(date))
            
            .order_by_asc(daily_mission::Column::MissionType).all(self.db.as_ref())
            .await
            .map_err(|e| AppError::from(e.to_string()))?;

        if !existing.is_empty() {
            return Ok(existing);
        }

        let pool: Vec<_> = all_mission_definitions()
            .into_iter()
            // H-3 FIX: only pool implementable mission types.
            .filter(|(t, _, _, _, _)| IMPLEMENTABLE_DAILY.contains(&t.as_str()))
            .collect();
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
    async fn on_hand_completed(
        &self,
        ctx: &RequestContext,
        hand_result: &HandResult,
    ) -> Result<(), AppError> {
        let user_id = self.extract_user_id(ctx)?;
        let today = Utc::now().date_naive();
        let assignments = self.ensure_daily_assignments(user_id, today).await?;
        let pool = all_mission_definitions();

        for assignment in assignments.iter().filter(|a| !a.completed) {
            let def = pool
                .iter()
                .find(|(t, _, _, _, _)| t == &assignment.mission_type);
            if def.is_none() {
                continue;
            }
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

    async fn on_share_created(
        &self,
        ctx: &RequestContext,
        share_type: &str,
    ) -> Result<(), AppError> {
        if share_type != "replay_card" && share_type != "referral" {
            return Ok(());
        }
        let user_id = self.extract_user_id(ctx)?;
        let today = Utc::now().date_naive();
        let assignments = self.ensure_daily_assignments(user_id, today).await?;
        let share_types = ["share_replay", "referral_5_hands"];
        for a in assignments
            .iter()
            .filter(|a| share_types.contains(&a.mission_type.as_str()) && !a.completed)
        {
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
            if let Some((_, desc, reward, target, category)) =
                pool.iter().find(|(t, _, _, _, _)| t == &a.mission_type)
            {
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

    async fn reroll_mission(
        &self,
        ctx: &RequestContext,
        mission_id: MissionId,
    ) -> Result<Mission, AppError> {
        let user_id = self.extract_user_id(ctx)?;
        let today = Utc::now().date_naive();
        let assignments = self.ensure_daily_assignments(user_id, today).await?;
        let idx = mission_id.0 as usize;
        if idx >= assignments.len() {
            return Err(AppError::from("Invalid mission id"));
        }
        if assignments[idx].rerolled {
            return Err(AppError::from("Already rerolled"));
        }
        if assignments[idx].completed {
            return Err(AppError::from("Cannot reroll completed mission"));
        }

        // Collect all mission types already assigned today (excluding the one being rerolled)
        let mut assigned_types = std::collections::HashSet::new();
        for (i, assignment) in assignments.iter().enumerate() {
            if i != idx {
                assigned_types.insert(assignment.mission_type.clone());
            }
        }

        // B-19 FIX: also filter out mission types the progress handler
        // does not implement — the previous filter only excluded the ones
        // already assigned today, so a reroll could land on another dead
        // type. Restrict to the same IMPLEMENTABLE_DAILY list used by
        // `ensure_daily_assignments`, and exclude the current mission's
        // own type so a reroll never reassigns the identical mission
        // (which would reset progress while consuming the reroll).
        let current_type = assignments[idx].mission_type.clone();
        let pool = all_mission_definitions();
        let mut candidates: Vec<_> = pool
            .iter()
            .filter(|(t, _, _, _, _)| {
                IMPLEMENTABLE_DAILY.contains(&t.as_str())
                    && !assigned_types.contains(t.as_str())
                    && *t != current_type
            })
            .collect();

        if candidates.is_empty() {
            // Fallback: reroll to a mission type that is not the current
            // one and is still implementable.
            candidates = pool
                .iter()
                .filter(|(t, _, _, _, _)| {
                    IMPLEMENTABLE_DAILY.contains(&t.as_str()) && *t != current_type
                })
                .collect();
            if candidates.is_empty() {
                candidates = pool
                    .iter()
                    .filter(|(t, _, _, _, _)| IMPLEMENTABLE_DAILY.contains(&t.as_str()))
                    .collect();
            }
            if candidates.is_empty() {
                return Err(AppError::from("No available mission types to reroll to"));
            }
        }

        // Pick a random index to avoid trait issues
        let idx_choice = rand::rng().random_range(0..candidates.len());
        let (new_type, desc, reward, target, category) = candidates[idx_choice];

        let mut active: daily_mission::ActiveModel = assignments[idx].clone().into();
        active.mission_type = Set(new_type.to_string());
        active.progress = Set(0);
        active.rerolled = Set(true);
        let updated = ActiveModelTrait::update(active, self.db.as_ref())
            .await
            .map_err(|e| AppError::from(e.to_string()))?;

        Ok(Mission {
            id: mission_id,
            mission_type: updated.mission_type.clone(),
            description: desc.clone(),
            reward_chips: *reward,
            completed: updated.completed,
            progress: updated.progress as u32,
            target: *target,
            category: category.clone(),
        })
    }

    async fn claim_daily_reward(&self, ctx: &RequestContext) -> Result<ClaimResult, AppError> {
        let user_id = self.extract_user_id(ctx)?;
        let today = Utc::now().date_naive();
        let assignments = self.ensure_daily_assignments(user_id, today).await?;

        // H-1 FIX: the "all completed and unclaimed" precheck is only a
        // hint — two concurrent calls can both see reward_claimed=false,
        // and the check happens before the txn begins. Do the real gate
        // inside the transaction with a conditional UPDATE that only
        // succeeds on the row that is still unclaimed; if any mission
        // turns out to be already claimed (or incomplete), roll back.
        let pool = all_mission_definitions();
        let mut total_chips: i64 = 0;
        let txn = self
            .db
            .begin()
            .await
            .map_err(|e| AppError::from(e.to_string()))?;

        for a in assignments.iter() {
            use sea_orm::{ColumnTrait, EntityTrait, QueryFilter};
            let res = daily_mission::Entity::update_many()
                .col_expr(
                    daily_mission::Column::RewardClaimed,
                    sea_orm::sea_query::Expr::value(true),
                )
                .filter(daily_mission::Column::Id.eq(a.id))
                .filter(daily_mission::Column::RewardClaimed.eq(false))
                .filter(daily_mission::Column::Completed.eq(true))
                .exec(&txn)
                .await
                .map_err(|e| AppError::from(e.to_string()))?;
            if res.rows_affected == 0 {
                let _ = txn.rollback().await;
                return Err(AppError::from(
                    "Not all missions completed or reward already claimed",
                ));
            }
            if let Some((_, _, reward, _, _)) =
                pool.iter().find(|(t, _, _, _, _)| t == &a.mission_type)
            {
                total_chips += reward;
            }
        }

        total_chips += 2000;

        let streak_model = streak::Entity::find_by_id(user_id.0)
            .one(&txn)
            .await
            .map_err(|e| AppError::from(e.to_string()))?
            .unwrap_or(streak::Model {
                user_id: user_id.0,
                current_streak: 0,
                longest_streak: 0,
                last_completion_date: None,
                streak_shield_available: 0,
                weekly_bonus_awarded_streak: 0,
            });

        let last_date = streak_model.last_completion_date;
        // H-2 FIX: track whether the streak just broke (i.e. the previous
        // completion was before yesterday). If so we must reset the
        // weekly-bonus watermark, otherwise the 7-day bonus can never be
        // earned again: after reaching 14, missing a day resets the streak
        // to 1, and `7 > 14` stays false forever.
        let mut streak_broken = false;
        let today_streak: i32 = if let Some(last) = last_date {
            if today == last.succ_opt().unwrap_or(last) {
                streak_model.current_streak + 1
            } else if today.succ_opt() == Some(last) {
                streak_model.current_streak
            } else {
                streak_broken = true;
                1
            }
        } else {
            1
        };

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
        streak_active.streak_shield_available =
            Set(streak_active.streak_shield_available.unwrap() + shield_gain);
        if weekly_bonus {
            streak_active.weekly_bonus_awarded_streak = Set(today_streak);
        } else if streak_broken {
            // H-2 FIX: clear the watermark on a break so the next full
            // 7-day run can earn the bonus again.
            streak_active.weekly_bonus_awarded_streak = Set(0);
        }
        ActiveModelTrait::update(streak_active, &txn)
            .await
            .map_err(|e| AppError::from(e.to_string()))?;

        let chip_amount =
            ChipAmount::new(total_chips).ok_or_else(|| AppError::from("Invalid chip amount"))?;
        self.user_service.award_chips(user_id, chip_amount).await?;

        txn.commit()
            .await
            .map_err(|e| AppError::from(e.to_string()))?;

        Ok(ClaimResult {
            chips_awarded: chip_amount,
            streak_count: today_streak as u32,
            weekly_bonus_awarded: weekly_bonus,
        })
    }
}
