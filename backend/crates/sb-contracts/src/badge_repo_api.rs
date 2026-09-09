use async_trait::async_trait;
use sb_shared_types::ids::UserId;
use sea_orm::DatabaseTransaction;
use std::collections::HashSet;
use thiserror::Error;

#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub enum BadgeType {
    FoundingMember,
}

#[derive(Debug, Error)]
pub enum BadgeTypeError {
    #[error("unknown badge type: {0}")]
    Unknown(String),
}

impl BadgeType {
    pub fn as_str(&self) -> &'static str {
        match self {
            BadgeType::FoundingMember => "founding_member",
        }
    }
}

impl TryFrom<&str> for BadgeType {
    type Error = BadgeTypeError;

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        match value {
            "founding_member" => Ok(BadgeType::FoundingMember),
            _ => Err(BadgeTypeError::Unknown(value.to_string())),
        }
    }
}

#[derive(Debug, Error)]
pub enum BadgeRepoError {
    #[error("database error: {0}")]
    Database(String),
    #[error("transaction error: {0}")]
    Transaction(String),
}

#[async_trait]
pub trait BadgeRepo: Send + Sync {
    /// Atomic upsert via ON CONFLICT DO NOTHING. Returns true if inserted.
    async fn award_badge(
        &self,
        txn: &DatabaseTransaction,
        user_id: UserId,
        badge_type: BadgeType,
    ) -> Result<bool, BadgeRepoError>;

    async fn has_badge(
        &self,
        db: &impl sea_orm::ConnectionTrait,
        user_id: UserId,
        badge_type: &BadgeType,
    ) -> Result<bool, BadgeRepoError>;

    async fn list_badges(
        &self,
        db: &impl sea_orm::ConnectionTrait,
        user_id: UserId,
    ) -> Result<HashSet<BadgeType>, BadgeRepoError>;
}

#[async_trait]
pub trait BadgeEngine: Send + Sync {
    async fn check_founding_member(
        &self,
        txn: &DatabaseTransaction,
        referrer_id: UserId,
    ) -> Result<bool, BadgeRepoError>;
}
