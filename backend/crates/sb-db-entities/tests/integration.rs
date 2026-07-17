use chrono::Utc;
use migration::Migrator;
use sb_db_entities::enums::Platform;
use sb_db_entities::user;
use sea_orm::Set;
use sea_orm::{ActiveModelTrait, Database, EntityTrait, IntoActiveModel, ModelTrait};
use sea_orm_migration::migrator::MigratorTrait;
use uuid::Uuid;

#[tokio::test]
async fn test_migration_and_basic_ops() {
    let db = Database::connect("sqlite::memory:").await.unwrap();
    Migrator::up(&db, None).await.unwrap();

    let user_active = user::ActiveModel {
        id: sea_orm::ActiveValue::Set(Uuid::now_v7()),
        telegram_id: sea_orm::ActiveValue::Set(Some(123456789)),
        email: sea_orm::ActiveValue::Set(Some("test@example.com".to_string())),
        display_name: sea_orm::ActiveValue::Set("tester".to_string()),
        chip_balance: sea_orm::ActiveValue::Set(1000),
        streak_count: sea_orm::ActiveValue::Set(0),
        created_at: sea_orm::ActiveValue::Set(Utc::now()),
        updated_at: sea_orm::ActiveValue::Set(Utc::now()),
        season_pass_id: sea_orm::ActiveValue::Set(None),
        season_pass_expires_at: sea_orm::ActiveValue::Set(None),
        platform: sea_orm::ActiveValue::Set(Platform::Telegram),
        email_verified_at: sea_orm::ActiveValue::Set(None),
        password_changed_at: sea_orm::ActiveValue::Set(None),
        password_hash: sea_orm::ActiveValue::Set(None),
        registration_order: sea_orm::ActiveValue::Set(None),
        deleted_at: sea_orm::ActiveValue::Set(None),
        // FIX: Added the missing club_pro_expires_at field
        club_pro_expires_at: sea_orm::ActiveValue::Set(None),
        push_subscription: sea_orm::ActiveValue::Set(None),
                is_bot: Set(false),
            bot_profile: Set(None),
            bot_bankroll: Set(Some(0)),
};
    let user = user_active.insert(&db).await.unwrap();

    let mut bad_user = user.clone().into_active_model();
    bad_user.chip_balance = sea_orm::ActiveValue::Set(-1);
    let err: sea_orm::DbErr = bad_user.update(&db).await.unwrap_err();
    assert!(err.to_string().contains("CHECK constraint"));

    let season = sb_db_entities::season::ActiveModel {
        processed: Set(false),
        id: sea_orm::ActiveValue::Set(1),
        name: sea_orm::ActiveValue::Set("Season 1".to_string()),
        starts_at: sea_orm::ActiveValue::Set(Utc::now()),
        ends_at: sea_orm::ActiveValue::Set(Utc::now() + chrono::Duration::weeks(8)),
    };
    season.insert(&db).await.unwrap();

    let rank = sb_db_entities::player_rank::ActiveModel {
        user_id: sea_orm::ActiveValue::Set(user.id),
        season_id: sea_orm::ActiveValue::Set(1),
        rank_tier: sea_orm::ActiveValue::Set(sb_db_entities::enums::RankTier::Gold),
        rank_points: sea_orm::ActiveValue::Set(1200),
    };
    rank.insert(&db).await.unwrap();

    user.delete(&db).await.unwrap();
    let ranks = sb_db_entities::player_rank::Entity::find()
        .all(&db)
        .await
        .unwrap();
    assert!(ranks.is_empty());
}
