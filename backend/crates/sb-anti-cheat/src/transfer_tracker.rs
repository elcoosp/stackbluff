use std::collections::VecDeque;
use dashmap::DashMap;
use chrono::{DateTime, Utc, Duration};
use sb_shared_types::{UserId, ChipAmount};
use tracing::warn;

type Pair = (UserId, UserId);

pub struct TransferTracker {
    transfers: DashMap<Pair, VecDeque<(DateTime<Utc>, i64)>>,
}

impl TransferTracker {
    pub fn new() -> Self {
        Self { transfers: DashMap::new() }
    }

    pub fn check_and_record(&self, from: UserId, to: UserId, amount: ChipAmount) -> bool {
        let now = Utc::now();
        let cutoff = now - Duration::hours(24);
        let amount_i64: i64 = amount.into();

        let mut entry = self.transfers.entry((from, to)).or_insert_with(VecDeque::new);
        while let Some(&(ts, _)) = entry.front() {
            if ts < cutoff {
                entry.pop_front();
            } else {
                break;
            }
        }

        let net: i64 = entry.iter().map(|&(_, amt)| amt).sum();
        if net + amount_i64 > 5000 {
            warn!("Transfer blocked: {} -> {} net {}", from, to, net);
            return false;
        }

        entry.push_back((now, amount_i64));
        true
    }

    pub fn net_24h(&self, from: UserId, to: UserId) -> i64 {
        let now = Utc::now();
        let cutoff = now - Duration::hours(24);
        self.transfers
            .get(&(from, to))
            .map(|entry| entry.iter().filter(|(ts,_)| *ts >= cutoff).map(|(_,amt)| amt).sum())
            .unwrap_or(0)
    }
}
