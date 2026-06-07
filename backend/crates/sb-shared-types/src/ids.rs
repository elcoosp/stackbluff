use uuid::Uuid;
use serde::{Serialize, Deserialize};
use derive_more::{Display, From, Into};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, Display, From, Into)]
pub struct UserId(pub Uuid);

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, Display, From, Into)]
pub struct TableId(pub Uuid);

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, Display, From, Into)]
pub struct ClubId(pub Uuid);

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, Display, From, Into)]
pub struct PlayerId(pub Uuid);
