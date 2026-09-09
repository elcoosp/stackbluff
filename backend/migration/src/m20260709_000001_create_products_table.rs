use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(Products::Table)
                    .if_not_exists()
                    .col(ColumnDef::new(Products::Id).text().not_null().primary_key())
                    .col(ColumnDef::new(Products::Name).string().not_null())
                    .col(ColumnDef::new(Products::Description).string().not_null())
                    .col(ColumnDef::new(Products::Price).big_integer().not_null())
                    .col(
                        ColumnDef::new(Products::StarsPrice)
                            .big_integer()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(Products::Currency)
                            .string()
                            .not_null()
                            .default("USD"),
                    )
                    .col(
                        ColumnDef::new(Products::ProductType)
                            .string()
                            .not_null()
                            .default("chips"),
                    )
                    .col(ColumnDef::new(Products::Metadata).json())
                    .col(
                        ColumnDef::new(Products::CreatedAt)
                            .timestamp_with_time_zone()
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .col(
                        ColumnDef::new(Products::UpdatedAt)
                            .timestamp_with_time_zone()
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .to_owned(),
            )
            .await?;

        let db = manager.get_connection();
        let products = vec![
            (
                "Starter Pack",
                "20,000 chips to start your journey.",
                499,
                499,
                "chips",
                serde_json::json!({ "chips": 20000 }),
            ),
            (
                "Booster Pack",
                "50,000 chips to boost your stack.",
                999,
                999,
                "chips",
                serde_json::json!({ "chips": 50000 }),
            ),
            (
                "Pro Pack",
                "125,000 chips for serious play.",
                1999,
                1999,
                "chips",
                serde_json::json!({ "chips": 125000 }),
            ),
            (
                "High Roller Pack",
                "400,000 chips for high rollers.",
                4999,
                4999,
                "chips",
                serde_json::json!({ "chips": 400000 }),
            ),
            (
                "Season Pass",
                "30 days of unlimited Oracle access & daily rewards.",
                1999,
                1999,
                "season_pass",
                serde_json::json!({ "duration_days": 30 }),
            ),
            (
                "Club Pro",
                "Unlock all club customization features.",
                999,
                999,
                "club_pro",
                serde_json::json!({ "duration_days": 30 }),
            ),
        ];

        for (name, desc, price, stars, ptype, metadata) in products {
            let id = uuid::Uuid::new_v4().to_string();
            let now = chrono::Utc::now().to_rfc3339();
            let sql = format!(
                "INSERT INTO products (id, name, description, price, stars_price, currency, product_type, metadata, created_at, updated_at) VALUES ('{}', '{}', '{}', {}, {}, 'USD', '{}', '{}', '{}', '{}')",
                id,
                name,
                desc,
                price,
                stars,
                ptype,
                metadata.to_string().replace('\'', "''"),
                now,
                now
            );
            db.execute_unprepared(&sql).await?;
        }
        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(Products::Table).to_owned())
            .await
    }
}

#[derive(DeriveIden)]
enum Products {
    Table,
    Id,
    Name,
    Description,
    Price,
    StarsPrice,
    Currency,
    ProductType,
    Metadata,
    CreatedAt,
    UpdatedAt,
}
