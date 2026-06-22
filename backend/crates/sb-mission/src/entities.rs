pub mod daily_mission {
    use sea_orm::entity::prelude::*;
    #[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
    #[sea_orm(table_name = "daily_missions")]
    pub struct Model {
        #[sea_orm(primary_key)]
        pub id: i32,
        pub user_id: i32,
        pub assigned_date: Date,
        pub mission_type: String,
        pub progress: i32,
        pub completed: bool,
        pub rerolled: bool,
        pub reward_claimed: bool,
    }
    #[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
    pub enum Relation {}
    impl ActiveModelBehavior for ActiveModel {}
}

pub mod streak {
    use sea_orm::entity::prelude::*;
    #[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
    #[sea_orm(table_name = "streaks")]
    pub struct Model {
        #[sea_orm(primary_key)]
        pub user_id: i32,
        pub current_streak: i32,
        pub longest_streak: i32,
        pub last_completion_date: Option<Date>,
        pub streak_shield_available: i32,
        pub weekly_bonus_awarded_streak: i32,
    }
    #[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
    pub enum Relation {}
    impl ActiveModelBehavior for ActiveModel {}
}

pub mod users {
    pub use sb_db_entities::users::{Entity, Model, ActiveModel, Column};
}
