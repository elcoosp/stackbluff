use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
#[sea_orm(table_name = "club_memberships")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub club_id: Uuid,
    pub user_id: Uuid,
    pub weekly_xp: i64,
    pub joined_at: DateTimeUtc,
    pub updated_at: DateTimeUtc,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::clubs::Entity",
        from = "Column::ClubId",
        to = "super::clubs::Column::Id"
    )]
    Club,
}

impl Related<super::clubs::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Club.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
