use async_trait::async_trait;
use sb_contracts::{MissionRepository, PersistenceResult};
use sb_shared_types::UserId;

pub struct MissionRepositoryImpl;

#[async_trait]
impl MissionRepository for MissionRepositoryImpl {
    async fn complete_mission(
        &self,
        _user_id: UserId,
        _mission_type: String,
    ) -> PersistenceResult<()> {
        // TODO: implement
        Ok(())
    }
}
