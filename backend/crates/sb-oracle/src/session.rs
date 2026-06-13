use sb_shared_types::UserId;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio::time::{Duration, Instant};

const MAX_ANALYSES: u32 = 3;
const INACTIVITY_RESET: Duration = Duration::from_secs(8 * 3600);

#[derive(Debug, Clone)]
struct UserSession {
    count: u32,
    last_active: Instant,
}

pub struct SessionManager {
    inner: Arc<Mutex<HashMap<UserId, UserSession>>>,
}

impl SessionManager {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(Mutex::new(HashMap::new())),
        }
    }
    pub async fn try_consume(&self, user_id: UserId) -> bool {
        let mut map = self.inner.lock().await;
        let now = Instant::now();
        let entry = map.entry(user_id).or_insert_with(|| UserSession {
            count: 0,
            last_active: now,
        });
        if now.duration_since(entry.last_active) >= INACTIVITY_RESET {
            entry.count = 0;
        }
        if entry.count >= MAX_ANALYSES {
            return false;
        }
        entry.count += 1;
        entry.last_active = now;
        true
    }
}
