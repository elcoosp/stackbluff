use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[sea_orm::model]
#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "tournament_registrations")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub tournament_id: Uuid,
    pub user_id: Uuid,
    pub buy_in: i64,
    pub registered_at: DateTimeUtc,
    /// B-3/B-8 follow-up: true when this registration's buy-in was
    /// actually debited from the player's wallet. Crash recovery refunds
    /// only committed rows so a no-op registration cannot mint chips.
    pub chip_committed: bool,
}

impl ActiveModelBehavior for ActiveModel {}
