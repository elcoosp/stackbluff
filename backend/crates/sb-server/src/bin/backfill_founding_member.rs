use sea_orm::{Database, EntityTrait, QuerySelect, ColumnTrait, QueryFilter};
use sb_db_entities::{referral, user_badges};
use sb_shared_types::ids::UserId;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let database_url = std::env::var("DATABASE_URL")
        .expect("DATABASE_URL must be set");

    let db = Database::connect(&database_url).await?;

    // Find all referrers with >= 10 completed referrals
    let mut cursor = referral::Entity::find()
        .filter(referral::Column::HandCount.gte(5))
        .filter(referral::Column::BonusAwarded.eq(true))
        .cursor_by(referral::Column::ReferrerId)
        .first(10);

    // Alternative: iterate all users and count
    let all_users = sb_db_entities::users::Entity::find().all(&db).await?;

    for user in all_users {
        let count = referral::Entity::find()
            .filter(referral::Column::ReferrerId.eq(user.id))
            .filter(referral::Column::HandCount.gte(5))
            .filter(referral::Column::BonusAwarded.eq(true))
            .count(&db)
            .await?;

        if count >= 10 {
            let existing = user_badges::Entity::find()
                .filter(user_badges::Column::UserId.eq(user.id))
                .filter(user_badges::Column::BadgeType.eq("founding_member"))
                .one(&db)
                .await?;

            if existing.is_none() {
                let active = user_badges::ActiveModel {
                    user_id: sea_orm::ActiveValue::Set(user.id),
                    badge_type: sea_orm::ActiveValue::Set("founding_member".to_string()),
                    awarded_at: sea_orm::ActiveValue::Set(chrono::Utc::now()),
                };
                active.insert(&db).await?;
                println!("Awarded founding_member badge to user {}", user.id);
            }
        }
    }

    println!("Backfill complete");
    Ok(())
}
