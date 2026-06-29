use sea_orm::{Database, EntityTrait, QueryFilter, ColumnTrait, PaginatorTrait};
use sb_db_entities::{referral, user_badges, users};
use sb_db_repos::badge_repo::BadgeRepoImpl;
use sb_contracts::repo_api::BadgeRepo;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let database_url = std::env::var("DATABASE_URL")
        .expect("DATABASE_URL must be set");

    let db = Database::connect(&database_url).await?;

    let all_users = users::Entity::find().all(&db).await?;

    for user in all_users {
        let count: u64 = referral::Entity::find()
            .filter(referral::Column::ReferrerId.eq(user.id))
            .filter(referral::Column::HandCount.gte(5))
            .filter(referral::Column::BonusAwarded.eq(true))
            .count(&db)
            .await?;

        if count >= 10 {
            let badge_repo = BadgeRepoImpl::new(&db);
            let newly_awarded = badge_repo
                .award_badge(sb_shared_types::ids::UserId::new(user.id), "founding_member")
                .await?;

            if newly_awarded {
                println!("Awarded founding_member badge to user {}", user.id);
            }
        }
    }

    println!("Backfill complete");
    Ok(())
}
