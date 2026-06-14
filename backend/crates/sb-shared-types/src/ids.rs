use derive_more::{Display, From, Into};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, Display, From, Into)]
pub struct UserId(pub Uuid);

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, Display, From, Into)]
pub struct TableId(pub Uuid);

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, Display, From, Into)]
pub struct ClubId(pub Uuid);

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, Display, From, Into)]
pub struct PlayerId(pub Uuid);

impl TableId {
    pub fn new() -> Self {
        Self(uuid::Uuid::new_v4())
    }
}

impl Default for TableId {
    fn default() -> Self {
        Self::new()
    }
}

impl std::str::FromStr for TableId {
    type Err = uuid::Error;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        Ok(TableId(uuid::Uuid::parse_str(s)?))
    }
}

impl TableId {
    pub fn as_uuid(&self) -> uuid::Uuid {
        self.0
    }
}
