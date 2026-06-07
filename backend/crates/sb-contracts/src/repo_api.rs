use crate::persistence_error::PersistenceError;
use async_trait::async_trait;
use sb_shared_types::{ChipAmount, ClubId, RequestContext, UserId};

#[async_trait]
pub trait UserRepo: Send + Sync {
    async fn get_balance(
        &self,
        user_id: UserId,
        ctx: &RequestContext,
    ) -> Result<ChipAmount, PersistenceError>;
    async fn update_balance(
        &self,
        user_id: UserId,
        amount: ChipAmount,
        ctx: &RequestContext,
    ) -> Result<(), PersistenceError>;
}

#[async_trait]
pub trait HandHistoryRepo: Send + Sync {
    async fn record_hand(
        &self,
        hand_data: &str,
        ctx: &RequestContext,
    ) -> Result<(), PersistenceError>;
}

#[async_trait]
pub trait ClubRepo: Send + Sync {
    async fn get_club_members(
        &self,
        club_id: ClubId,
        ctx: &RequestContext,
    ) -> Result<Vec<UserId>, PersistenceError>;
}
