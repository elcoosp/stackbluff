// ... (entire file content, but we only replace the conflicted block)
// We'll use a sed-based approach: replace everything between <<<<<<< and >>>>>>>
// with the resolved block. To avoid re-writing the whole file, we'll use a here-doc.
// But since the whole file is large, we will use a script that uses the conflict
// markers to replace the block. However, we have the final content for the whole
// file? No, we only have the final content for the conflicted portion, not the whole file.
// So we need to extract the portions before and after the conflict.
// Instead, we'll use a perl one-liner or awk to replace the conflict block.
# Actually, we can use a more robust approach: use `git merge-file` with a custom
# resolution, but that's complex. Let's use `sed` to replace the block.
# We'll use a marker-based replacement.
# We'll create a temporary file with the resolved block and replace.

# For simplicity, we'll print the resolved block and use ed or sed to replace.
# Let's define the resolved block as a variable.

resolved_repo_api="
#[derive(Clone, Debug)]
pub struct BadgeRecord {
    pub user_id: UserId,
    pub badge_type: String,
    pub awarded_at: chrono::DateTime<chrono::Utc>,
}

#[async_trait]
pub trait BadgeRepo: Send + Sync {
    async fn award_badge(&self, user_id: UserId, badge_type: &str) -> Result<bool, PersistenceError>;
    async fn has_badge(&self, user_id: UserId, badge_type: &str) -> Result<bool, PersistenceError>;
    async fn list_badges(&self, user_id: UserId) -> Result<Vec<BadgeRecord>, PersistenceError>;
}

#[derive(Clone)]
pub struct NoopBadgeRepo;

#[async_trait::async_trait]
impl BadgeRepo for NoopBadgeRepo {
    async fn award_badge(&self, _user_id: UserId, _badge_type: &str) -> Result<bool, PersistenceError> {
        Ok(false)
    }
    async fn has_badge(&self, _user_id: UserId, _badge_type: &str) -> Result<bool, PersistenceError> {
        Ok(false)
    }
    async fn list_badges(&self, _user_id: UserId) -> Result<Vec<BadgeRecord>, PersistenceError> {
        Ok(vec![])
    }
}

#[async_trait::async_trait]
pub trait GdprRepo: Send + Sync {
    async fn request_deletion(&self, user_id: uuid::Uuid) -> Result<(), PersistenceError>;
    async fn get_pending_deletions(&self, older_than_days: i64) -> Result<Vec<DeletionRequestDto>, PersistenceError>;
    async fn mark_deletion_completed(&self, user_id: uuid::Uuid) -> Result<(), PersistenceError>;
    async fn get_user_data(&self, user_id: uuid::Uuid) -> Result<UserDataExportDto, PersistenceError>;
    async fn anonymize_user(&self, user_id: uuid::Uuid) -> Result<(), PersistenceError>;
    async fn invalidate_sessions(&self, user_id: uuid::Uuid) -> Result<(), PersistenceError>;
    async fn get_user_password_hash(&self, user_id: uuid::Uuid) -> Result<String, PersistenceError>;
}

#[derive(Clone, Debug)]
pub struct DeletionRequestDto {
    pub user_id: uuid::Uuid,
    pub requested_at: chrono::NaiveDateTime,
}

#[derive(Clone, Debug, serde::Serialize)]
pub struct UserDataExportDto {
    pub profile: serde_json::Value,
    pub hand_history: serde_json::Value,
    pub missions: serde_json::Value,
}
"

# Use a Python script or awk to replace the block. We'll use a simple approach:
# Find the line with '<<<<<<< HEAD' and replace everything until '>>>>>>> origin/main'
# with the resolved block.
# We'll use ed (edit file in-place).
# We can do:

ed -s backend/crates/sb-contracts/src/repo_api.rs <<EOF
/<<<<<<< HEAD
.,/>>>>>>> origin-main/c
$resolved_repo_api
.
w
q
