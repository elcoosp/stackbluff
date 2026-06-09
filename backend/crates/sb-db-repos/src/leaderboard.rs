use chrono::Utc;
use sb_db_entities::leaderboard_global_mv;
use sb_db_entities::user;
use sea_orm::{
    ActiveModelTrait, ActiveValue::Set, DatabaseConnection, EntityTrait, FromQueryResult,
    QuerySelect,
};
use uuid::Uuid;

#[derive(FromQueryResult)]
struct RankEntry {
    user_id: Uuid,
    total_chips_won: i64,
    display_name: String,
}

pub async fn refresh_leaderboard(
    db: &DatabaseConnection,
) -> Result<(), Box<dyn std::error::Error>> {
    let results = user::Entity::find()
        .select_only()
        .column(user::Column::Id)
        .column(user::Column::DisplayName)
        .column_as(user::Column::ChipBalance, "total_chips_won")
        .into_model::<RankEntry>()
        .all(db)
        .await?;

    let mut entries: Vec<_> = results.into_iter().collect();
    entries.sort_by(|a, b| b.total_chips_won.cmp(&a.total_chips_won));

    leaderboard_global_mv::Entity::delete_many()
        .exec(db)
        .await?;

    for (rank, entry) in entries.iter().enumerate() {
        let rank_pos = (rank + 1) as i32;
        let mv = leaderboard_global_mv::ActiveModel {
            user_id: Set(entry.user_id),
            display_name: Set(entry.display_name.clone()),
            total_chips_won: Set(entry.total_chips_won),
            rank_position: Set(rank_pos),
            refreshed_at: Set(Utc::now()),
        };
        mv.insert(db).await?;
    }
    Ok(())
}
