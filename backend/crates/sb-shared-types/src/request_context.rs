use uuid::Uuid;
use serde::{Serialize, Deserialize};
use crate::ids::UserId;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RequestContext {
    pub request_id: Uuid,
    pub user_id: Option<UserId>,
}

impl RequestContext {
    pub fn new(request_id: Uuid, user_id: Option<UserId>) -> Self {
        Self { request_id, user_id }
    }
}
