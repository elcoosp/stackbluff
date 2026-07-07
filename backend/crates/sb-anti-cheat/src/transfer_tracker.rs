use chrono::{DateTime, Duration, Utc};
use dashmap::DashMap;
use metrics;
use sb_shared_types::{ChipAmount, UserId};
use std::collections::VecDeque;

type Pair = (UserId, UserId);

#[derive(Clone)]
struct TransferWindow {
    deque: VecDeque<(DateTime<Utc>, i64)>,
    net: i64,
}

impl TransferWindow {
    fn new() -> Self {
        Self {
            deque: VecDeque::new(),
            net: 0,
        }
    }

    fn add(
        &mut self,
        timestamp: DateTime<Utc>,
        amount: i64,
        cutoff: DateTime<Utc>,
        limit: i64,
    ) -> Result<bool, &'static str> {
        // Clean expired
        while let Some(&(ts, amt)) = self.deque.front() {
            if ts < cutoff {
                self.net -= amt;
                self.deque.pop_front();
            } else {
                break;
            }
        }
        let new_net = self.net.checked_add(amount).ok_or("overflow")?;
        if new_net > limit {
            return Ok(false);
        }
        self.deque.push_back((timestamp, amount));
        self.net = new_net;
        Ok(true)
    }
}

pub struct TransferTracker {
    transfers: DashMap<Pair, TransferWindow>,
    limit: i64,
}

impl TransferTracker {
    pub fn new() -> Self {
        let limit = std::env::var("TRANSFER_LIMIT")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(5000);
        Self {
            transfers: DashMap::new(),
            limit,
        }
    }
    pub fn limit(&self) -> i64 {
        self.limit
    }

    pub fn check_and_record(
        &self,
        from: UserId,
        to: UserId,
        amount: ChipAmount,
    ) -> Result<bool, &'static str> {
        if from == to {
            return Err("self-transfer");
        }
        let now = Utc::now();
        let cutoff = now - Duration::hours(24);
        let amount_i64: i64 = amount.into();

        let mut entry = self
            .transfers
            .entry((from, to))
            .or_insert_with(TransferWindow::new);
        match entry.add(now, amount_i64, cutoff, self.limit) {
            Ok(allowed) => {
                if !allowed {
                    metrics::counter!("anti_cheat_transfers_blocked").increment(1);
                }
                Ok(allowed)
            }
            Err(e) => Err(e),
        }
    }

    pub fn net_24h(&self, from: UserId, to: UserId) -> i64 {
        let now = Utc::now();
        let cutoff = now - Duration::hours(24);
        self.transfers
            .get(&(from, to))
            .map(|entry| {
                entry
                    .deque
                    .iter()
                    .filter(|(ts, _)| *ts >= cutoff)
                    .map(|(_, amt)| amt)
                    .sum()
            })
            .unwrap_or(0)
    }

    pub fn cleanup_expired(&self) {
        let now = Utc::now();
        let cutoff = now - Duration::hours(24);
        self.transfers.retain(|_, window| {
            while let Some(&(ts, amt)) = window.deque.front() {
                if ts < cutoff {
                    window.net -= amt;
                    window.deque.pop_front();
                } else {
                    break;
                }
            }
            !window.deque.is_empty()
        });
    }
}

impl Default for TransferTracker {
    fn default() -> Self {
        Self::new()
    }
}
impl Clone for TransferTracker {
    fn clone(&self) -> Self {
        Self {
            transfers: self.transfers.clone(),
            limit: self.limit,
        }
    }
}
