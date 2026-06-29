use sb_contracts::{ClubError, ClubRepo, ClubService, LeaderboardPage};
use sb_shared_types::{ClubId, RequestContext, UserId};
use std::sync::Arc;
use prometheus::{IntCounter, Histogram, HistogramOpts, register_int_counter, register_histogram};
use std::sync::OnceLock;

// Metrics
static LEADERBOARD_QUERIES: OnceLock<IntCounter> = OnceLock::new();
static LEADERBOARD_QUERY_DURATION: OnceLock<Histogram> = OnceLock::new();
static REBALANCE_OPERATIONS: OnceLock<IntCounter> = OnceLock::new();
static REBALANCE_DURATION: OnceLock<Histogram> = OnceLock::new();

fn get_leaderboard_queries() -> &'static IntCounter {
    LEADERBOARD_QUERIES.get_or_init(|| {
        register_int_counter!(
            "club_leaderboard_queries_total",
            "Total number of leaderboard queries"
        ).unwrap()
    })
}

fn get_leaderboard_query_duration() -> &'static Histogram {
    LEADERBOARD_QUERY_DURATION.get_or_init(|| {
        register_histogram!(
            HistogramOpts::new(
                "club_leaderboard_query_duration_seconds",
                "Duration of leaderboard queries in seconds"
            )
        ).unwrap()
    })
}

fn get_rebalance_operations() -> &'static IntCounter {
    REBALANCE_OPERATIONS.get_or_init(|| {
        register_int_counter!(
            "club_rebalance_operations_total",
            "Total number of rebalance operations"
        ).unwrap()
    })
}

fn get_rebalance_duration() -> &'static Histogram {
    REBALANCE_DURATION.get_or_init(|| {
        register_histogram!(
            HistogramOpts::new(
                "club_rebalance_duration_seconds",
                "Duration of rebalance operations in seconds"
            )
        ).unwrap()
    })
}

pub struct ClubServiceImpl {
    repo: Arc<dyn ClubRepo>,
}

impl ClubServiceImpl {
    pub fn new(repo: Arc<dyn ClubRepo>) -> Self {
        Self { repo }
    }
}

#[async_trait::async_trait]
impl ClubService for ClubServiceImpl {
    async fn create_club(
        &self,
        ctx: &RequestContext,
        name: &str,
        logo_url: Option<&str>,
        created_by: UserId,
    ) -> Result<ClubId, ClubError> {
        if name.trim().is_empty() {
            return Err(ClubError::validation("club name must not be empty"));
        }
        tracing::debug!(
            request_id = %ctx.request_id,
            user_id = ?ctx.user_id,
            "create_club: name={}",
            name
        );
        self.repo.create_club(name, logo_url, created_by).await
    }

    async fn join_club(
        &self,
        ctx: &RequestContext,
        club_id: ClubId,
        user_id: UserId,
    ) -> Result<(), ClubError> {
        tracing::debug!(
            request_id = %ctx.request_id,
            club_id = %club_id,
            user_id = %user_id,
            "join_club"
        );
        self.repo.join_club(club_id, user_id).await
    }

    async fn get_leaderboard(
        &self,
        _ctx: &RequestContext,
        club_id: ClubId,
        division: u32,
    ) -> Result<LeaderboardPage, ClubError> {
        let start = std::time::Instant::now();

        let club = self.repo.find_club_by_id(club_id).await?;
        if club.is_none() {
            return Err(ClubError::not_found(club_id));
        }
        let result = self.repo.get_leaderboard_page(club_id, division).await;

        let duration = start.elapsed().as_secs_f64();
        get_leaderboard_queries().inc();
        get_leaderboard_query_duration().observe(duration);

        result
    }

    async fn add_xp(
        &self,
        ctx: &RequestContext,
        club_id: ClubId,
        user_id: UserId,
        xp: i64,
    ) -> Result<(), ClubError> {
        tracing::debug!(
            request_id = %ctx.request_id,
            club_id = %club_id,
            user_id = %user_id,
            xp = xp,
            "add_xp"
        );
        self.repo.increment_weekly_xp(club_id, user_id, xp).await
    }

    async fn get_user_division(
        &self,
        ctx: &RequestContext,
        club_id: ClubId,
        user_id: UserId,
    ) -> Result<Option<u32>, ClubError> {
        tracing::debug!(
            request_id = %ctx.request_id,
            club_id = %club_id,
            user_id = %user_id,
            "get_user_division"
        );
        self.repo.get_user_division(club_id, user_id).await
    }

    async fn rebalance_divisions(
        &self,
        ctx: &RequestContext,
        club_id: ClubId,
        requested_by: UserId,
    ) -> Result<(), ClubError> {
        tracing::info!(
            request_id = %ctx.request_id,
            club_id = %club_id,
            user_id = %requested_by,
            "rebalance_divisions"
        );

        // Check if user is the club owner
        let club = self.repo.find_club_by_id(club_id).await?;
        match club {
            Some(c) if c.created_by == requested_by => {
                // User is the owner, proceed
            }
            Some(_) => {
                return Err(ClubError::PermissionDenied);
            }
            None => {
                return Err(ClubError::not_found(club_id));
            }
        }

        let start = std::time::Instant::now();
        let result = self.repo.rebalance_divisions(club_id).await;

        let duration = start.elapsed().as_secs_f64();
        get_rebalance_operations().inc();
        get_rebalance_duration().observe(duration);

        result
    }
}
