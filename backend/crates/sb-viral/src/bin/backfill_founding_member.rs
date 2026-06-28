use sea_orm::{Database, EntityTrait, QueryFilter, ColumnTrait, TransactionTrait};
use sb_contracts::badge_repo_api::{BadgeRepo, BadgeType};
use sb_db_repos::badge_repo::BadgeRepoImpl;
use sb_shared_types::ids::UserId;
use std::env;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let database_url = env::var("DATABASE_URL")
        .unwrap_or_else(|_| "sqlite:./stackbluff.db".to_string());
    let db = Database::connect(&database_url).await?;

    let badge_repo = BadgeRepoImpl::new();

    use sb_db_entities::referral::{self, Entity as ReferralEntity};

    let all_referrals = ReferralEntity::find()
        .filter(referral::Column::HandCount.gte(5))
        .filter(referral::Column::BonusAwarded.eq(true))
        .all(&db)
        .await?;

    let mut counts: std::collections::HashMap<String, u64> = std::collections::HashMap::new();
    for r in &all_referrals {
        *counts.entry(r.referrer_id.clone()).or_insert(0) += 1;
    }

    let mut awarded = 0;
    for (referrer_id_str, count) in counts {
        if count >= 10 {
            let uuid = uuid::Uuid::parse_str(&referrer_id_str)?;
            let user_id = UserId::new(uuid);

            let txn = db.begin().await?;
            match badge_repo.award_badge(&txn, user_id, BadgeType::FoundingMember).await {
                Ok(true) => {
                    println!("Awarded founding_member badge to {}", referrer_id_str);
                    awarded += 1;
                }
                Ok(false) => {
                    println!("Badge already exists for {}", referrer_id_str);
                }
                Err(e) => {
                    eprintln!("Error awarding badge to {}: {}", referrer_id_str, e);
                }
            }
            txn.commit().await?;
        }
    }

    println!("Backfill complete. New badges awarded: {}", awarded);
    Ok(())
}
