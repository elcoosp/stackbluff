//! Repository layer for fingerprint data access.

use async_trait::async_trait;
use sb_shared_types::UserId;
use sea_orm::ColumnTrait;
use uuid::Uuid;

pub mod models;

/// Repository for device fingerprint records.
#[async_trait]
pub trait FingerprintRepository: Send + Sync {
    async fn get_latest_for_user(
        &self,
        user: UserId,
    ) -> Result<Option<models::DeviceFingerprint>, anyhow::Error>;
    async fn get_latest_for_two_users(
        &self,
        user1: UserId,
        user2: UserId,
    ) -> Result<
        (
            Option<models::DeviceFingerprint>,
            Option<models::DeviceFingerprint>,
        ),
        anyhow::Error,
    >;
    async fn upsert(&self, user: UserId, hash: String, ip: String) -> Result<(), anyhow::Error>;
}

/// SeaORM-based implementation of `FingerprintRepository`.
pub struct SeaFingerprintRepository {
    pub db: sea_orm::DatabaseConnection,
}

#[async_trait]
impl FingerprintRepository for SeaFingerprintRepository {
    async fn get_latest_for_user(
        &self,
        user: UserId,
    ) -> Result<Option<models::DeviceFingerprint>, anyhow::Error> {
        use sb_db_entities::entities::device_fingerprints::{Column, Entity};
        use sea_orm::{EntityTrait, QueryFilter, QueryOrder};

        let uid: Uuid = user.into();
        let record = Entity::find()
            .filter(Column::UserId.eq(uid))
            .order_by_desc(Column::CreatedAt)
            .one(&self.db)
            .await?;
        Ok(record.map(|model| models::DeviceFingerprint {
            user_id: UserId(model.user_id),
            fingerprint_hash: model.fingerprint_hash,
            ip: model.ip,
            created_at: model.created_at,
        }))
    }

    async fn get_latest_for_two_users(
        &self,
        user1: UserId,
        user2: UserId,
    ) -> Result<
        (
            Option<models::DeviceFingerprint>,
            Option<models::DeviceFingerprint>,
        ),
        anyhow::Error,
    > {
        use sb_db_entities::entities::device_fingerprints::{Column, Entity};
        use sea_orm::{EntityTrait, QueryFilter, QueryOrder};

        let uid1: Uuid = user1.into();
        let uid2: Uuid = user2.into();

        let fp1 = Entity::find()
            .filter(Column::UserId.eq(uid1))
            .order_by_desc(Column::CreatedAt)
            .one(&self.db)
            .await?;
        let fp2 = Entity::find()
            .filter(Column::UserId.eq(uid2))
            .order_by_desc(Column::CreatedAt)
            .one(&self.db)
            .await?;

        // Map each option separately to avoid type inference issues in closure
        let fp1 = fp1.map(|model| models::DeviceFingerprint {
            user_id: UserId(model.user_id),
            fingerprint_hash: model.fingerprint_hash,
            ip: model.ip,
            created_at: model.created_at,
        });
        let fp2 = fp2.map(|model| models::DeviceFingerprint {
            user_id: UserId(model.user_id),
            fingerprint_hash: model.fingerprint_hash,
            ip: model.ip,
            created_at: model.created_at,
        });
        Ok((fp1, fp2))
    }

    async fn upsert(&self, user: UserId, hash: String, ip: String) -> Result<(), anyhow::Error> {
        use sb_db_entities::entities::device_fingerprints::{ActiveModel, Column, Entity};
        use sea_orm::{ActiveModelTrait, EntityTrait, QueryFilter, Set};

        let uid: Uuid = user.into();
        let existing = Entity::find()
            .filter(Column::UserId.eq(uid))
            .filter(Column::FingerprintHash.eq(&hash))
            .one(&self.db)
            .await?;

        if let Some(record) = existing {
            let mut active: ActiveModel = record.into();
            active.ip = Set(ip);
            active.created_at = Set(chrono::Utc::now().naive_utc());
            active.update(&self.db).await?;
        } else {
            let new = ActiveModel {
                user_id: Set(uid),
                fingerprint_hash: Set(hash),
                ip: Set(ip),
                created_at: Set(chrono::Utc::now().naive_utc()),
                ..Default::default()
            };
            new.insert(&self.db).await?;
        }
        Ok(())
    }
}
