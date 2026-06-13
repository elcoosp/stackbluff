use sb_shared_types::UserId;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio::time::{Duration, Instant};

const MAX_ANALYSES: u32 = 3;
const INACTIVITY_RESET: Duration = Duration::from_secs(8 * 3600);

<<<<<<< HEAD
#[derive(Debug, Clone)]
struct UserSession {
    count: u32,
    last_active: Instant,
}

pub struct SessionManager {
    inner: Arc<Mutex<HashMap<UserId, UserSession>>>,
||||||| parent of 7b2689b (fix(oracle): final compilation fixes and template diversity)
=======
/// In-memory session manager. Sessions are lost if the server restarts.
/// This is intentional per the specification (counted in memory, keyed by user_id).
/// For persistence across restarts, a database-backed store would be required.
/// Volatility: sessions expire after 8 hours of inactivity, but restart resets all counters.
/// This is acceptable for the current requirements but should be noted for production deployments.
pub struct SessionManager {
    inner: Arc<Mutex<HashMap<UserId, UserSession>>>,
}

#[derive(Debug, Clone)]
struct UserSession {
    count: u32,
    last_active: Instant,
}

impl Default for SessionManager {
    fn default() -> Self {
        Self::new()
    }
>>>>>>> 7b2689b (fix(oracle): final compilation fixes and template diversity)
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
