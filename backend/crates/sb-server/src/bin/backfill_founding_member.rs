use sb_contracts::repo_api::BadgeRepo;
use sb_db_entities::{referral, user}; // changed users -> user
use sb_db_repos::badge_repo::BadgeRepoImpl;
use sea_orm::{ColumnTrait, Database, EntityTrait, PaginatorTrait, QueryFilter};

const FOUNDING_MEMBER_THRESHOLD: i64 = 10;
const COMPLETED_REFERRAL_HANDS: i32 = 5;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let database_url = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");

    let db = Database::connect(&database_url).await?;

    let all_users = user::Entity::find().all(&db).await?; // changed users -> user

    for user in all_users {
        let count: u64 = referral::Entity::find()
            .filter(referral::Column::ReferrerId.eq(user.id))
            .filter(referral::Column::HandCount.gte(COMPLETED_REFERRAL_HANDS))
            .filter(referral::Column::BonusAwarded.eq(true))
            .count(&db)
            .await?;

        if count >= FOUNDING_MEMBER_THRESHOLD as u64 {
            let badge_repo = BadgeRepoImpl::new(db.clone()); // removed &, use clone
            let newly_awarded = badge_repo
                .award_badge(
                    sb_shared_types::ids::UserId::new(user.id),
                    "founding_member",
                )
                .await?;

            if newly_awarded {
                tracing::info!(
                    user_id = %user.id,
                    badge_type = "founding_member",
                    "Awarded founding_member badge via backfill"
                );
            }
        }
    }

    tracing::info!("Backfill complete");
    Ok(())
}
