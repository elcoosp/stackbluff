use async_trait::async_trait;
use sb_shared_types::ids::UserId;
use std::collections::HashSet;

/// Badge types supported by the platform.
#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub enum BadgeType {
    FoundingMember,
}

impl BadgeType {
    pub fn as_str(&self) -> &'static str {
        match self {
            BadgeType::FoundingMember => "founding_member",
        }
    }
}

impl TryFrom<&str> for BadgeType {
    type Error = String;

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        match value {
            "founding_member" => Ok(BadgeType::FoundingMember),
            _ => Err(format!("unknown badge type: {value}")),
        }
    }
}

/// Repository trait for badge operations.
#[async_trait]
pub trait BadgeRepo: Send + Sync {
    /// Award a badge to a user. Idempotent: returns Ok(false) if already present.
    async fn award_badge(
        &self,
        user_id: UserId,
        badge_type: BadgeType,
    ) -> Result<bool, crate::persistence_error::PersistenceError>;

    /// Check whether a user has a specific badge.
    async fn has_badge(
        &self,
        user_id: UserId,
        badge_type: &BadgeType,
    ) -> Result<bool, crate::persistence_error::PersistenceError>;

    /// List all badges for a user.
    async fn list_badges(
        &self,
        user_id: UserId,
    ) -> Result<HashSet<BadgeType>, crate::persistence_error::PersistenceError>;
}
