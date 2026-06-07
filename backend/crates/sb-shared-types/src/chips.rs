use serde::{Serialize, Deserialize};
use derive_more::{Display, From, Into, Add, Sub};

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize, Display, From, Into, Add, Sub, Default)]
pub struct ChipAmount(i64);

impl ChipAmount {
    pub fn new(value: i64) -> Option<Self> {
        if value >= 0 {
            Some(Self(value))
        } else {
            None
        }
    }

    pub fn checked_add(&self, other: Self) -> Option<Self> {
        self.0.checked_add(other.0).map(ChipAmount)
    }

    pub fn checked_sub(&self, other: Self) -> Option<Self> {
        self.0.checked_sub(other.0).and_then(|v| if v >= 0 { Some(ChipAmount(v)) } else { None })
    }

    pub fn as_i64(&self) -> i64 {
        self.0
    }
}
