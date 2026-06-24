use sb_contracts::tournament_api::BlindLevel;
use sb_shared_types::ChipAmount;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant};

/// Tracks blind level progression for tournaments.
///
/// The timer sets `pending_advance = true` every `level.duration_seconds`.
/// The actual advance happens in `on_hand_completed` so blinds never
/// change mid-hand.
pub struct BlindScheduler {
    levels: Vec<BlindLevel>,
    current_level_index: usize,
    level_start: Instant,
    pending_advance: Arc<AtomicBool>,
    _timer: Option<tokio::task::JoinHandle<()>>,
}

impl BlindScheduler {
    pub fn new(levels: Vec<BlindLevel>) -> Self {
        assert!(
            !levels.is_empty(),
            "BlindScheduler requires at least one level"
        );
        Self {
            levels,
            current_level_index: 0,
            level_start: Instant::now(),
            pending_advance: Arc::new(AtomicBool::new(false)),
            _timer: None,
        }
    }

    /// Call on each HandCompletedEvent.
    /// Returns `Some(new_level, small_blind, big_blind, ante)` if blinds advanced,
    /// or `None` if the current level continues.
    pub fn on_hand_completed(&mut self) -> Option<(u32, ChipAmount, ChipAmount, i64)> {
        if self.pending_advance.load(Ordering::SeqCst) {
            self.pending_advance.store(false, Ordering::SeqCst);
            self.advance_level()
        } else {
            // Check if we should advance based on elapsed time
            let level = &self.levels[self.current_level_index];
            if self.level_start.elapsed().as_secs() >= level.duration_seconds as u64 {
                self.advance_level()
            } else {
                None
            }
        }
    }

    /// Force immediate level advance (for testing). Returns new blinds info.
    pub fn force_advance(&mut self) -> Option<(u32, ChipAmount, ChipAmount, i64)> {
        self.advance_level()
    }

    /// Current blinds (small, big, ante).
    pub fn current_blinds(&self) -> (ChipAmount, ChipAmount, i64) {
        let level = &self.levels[self.current_level_index];
        (
            ChipAmount::new(level.small_blind).unwrap_or_default(),
            ChipAmount::new(level.big_blind).unwrap_or_default(),
            level.ante,
        )
    }

    /// Current level index and metadata.
    pub fn current_level(&self) -> (u32, u32) {
        let level = &self.levels[self.current_level_index];
        (level.level, level.duration_seconds)
    }

    /// Start the real-time timer. Sets `pending_advance = true` every
    /// `level.duration_seconds`. Returns the JoinHandle for the background task.
    pub fn start_timer(&mut self) -> tokio::task::JoinHandle<()> {
        let pending = self.pending_advance.clone();
        let levels = self.levels.clone();
        let handle = tokio::spawn(async move {
            for level in &levels {
                let dur = Duration::from_secs(level.duration_seconds as u64);
                tokio::time::sleep(dur).await;
                pending.store(true, Ordering::SeqCst);
            }
        });
        self._timer = Some(handle);
        // Return a new handle for the caller (the original is stored in self._timer)
        let pending = self.pending_advance.clone();
        let levels = self.levels.clone();
        tokio::spawn(async move {
            for level in &levels {
                let dur = Duration::from_secs(level.duration_seconds as u64);
                tokio::time::sleep(dur).await;
                pending.store(true, Ordering::SeqCst);
            }
        })
    }

    fn advance_level(&mut self) -> Option<(u32, ChipAmount, ChipAmount, i64)> {
        if self.current_level_index + 1 >= self.levels.len() {
            return None; // Already at max level
        }
        self.current_level_index += 1;
        self.level_start = Instant::now();
        let level = &self.levels[self.current_level_index];
        Some((
            level.level,
            ChipAmount::new(level.small_blind).unwrap_or_default(),
            ChipAmount::new(level.big_blind).unwrap_or_default(),
            level.ante,
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_level(level: u32, sb: i64, bb: i64, dur: u32) -> BlindLevel {
        BlindLevel {
            level,
            small_blind: sb,
            big_blind: bb,
            ante: 0,
            duration_seconds: dur,
        }
    }

    #[test]
    fn test_initial_blinds() {
        let levels = vec![make_level(1, 10, 20, 300), make_level(2, 20, 40, 300)];
        let scheduler = BlindScheduler::new(levels);
        let (sb, bb, ante) = scheduler.current_blinds();
        assert_eq!(sb.as_i64(), 10);
        assert_eq!(bb.as_i64(), 20);
        assert_eq!(ante, 0);
    }

    #[test]
    fn test_force_advance() {
        let levels = vec![
            make_level(1, 10, 20, 300),
            make_level(2, 20, 40, 300),
            make_level(3, 40, 80, 300),
        ];
        let mut scheduler = BlindScheduler::new(levels);
        let advance = scheduler.force_advance();
        assert!(advance.is_some());
        let (level, sb, bb, _) = advance.unwrap();
        assert_eq!(level, 2);
        assert_eq!(sb.as_i64(), 20);
        assert_eq!(bb.as_i64(), 40);
    }

    #[test]
    fn test_advance_at_max_returns_none() {
        let levels = vec![make_level(1, 10, 20, 300)];
        let mut scheduler = BlindScheduler::new(levels);
        assert!(scheduler.force_advance().is_none());
        assert!(scheduler.force_advance().is_none());
    }

    #[tokio::test]
    async fn test_timer_sets_pending_advance() {
        let levels = vec![
            make_level(1, 10, 20, 1), // 1 second
            make_level(2, 20, 40, 10),
        ];
        let mut scheduler = BlindScheduler::new(levels);
        let _handle = scheduler.start_timer();
        tokio::time::sleep(Duration::from_millis(1100)).await;
        assert!(scheduler.pending_advance.load(Ordering::SeqCst));
        let advance = scheduler.on_hand_completed();
        assert!(advance.is_some());
        let (level, sb, bb, _) = advance.unwrap();
        assert_eq!(level, 2);
        assert_eq!(sb.as_i64(), 20);
        assert_eq!(bb.as_i64(), 40);
    }
}
