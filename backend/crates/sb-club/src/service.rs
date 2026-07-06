//! Club service implementation with division sharding support.
//!
//! # Division Sharding
//! Clubs with more than 500 members are automatically split into divisions.
//! Each division maintains its own leaderboard ranked by weekly XP.
//!
//! # Performance Optimizations
//! - Owner authorization checks are cached (5 minute TTL)
//! - Leaderboard queries are instrumented with Prometheus metrics
//! - Rebalance operations use single UPDATE with CTE for O(1) DB operations
//!
//! # Metrics
//! - `club_leaderboard_queries_total`: Total leaderboard queries
//! - `club_leaderboard_query_duration_seconds`: Leaderboard query latency
//! - `club_rebalance_operations_total`: Total rebalance operations
//! - `club_rebalance_duration_seconds`: Rebalance operation latency
//!
//! # Caching
//! - Owner cache: 5 minute TTL, 10,000 max entries
//! - Automatically reduces database load for repeated authorization checks

use sb_contracts::{ClubError, ClubRepo, ClubService, LeaderboardPage};
use sb_shared_types::{ClubId, RequestContext, UserId};
use std::sync::Arc;
use sb_contracts::service_api::{ClubProSettings, UpdateClubSettingsRequest};
use moka::future::Cache;
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
    owner_cache: Cache<(ClubId, UserId), bool>,
}

impl ClubServiceImpl {
    pub fn new(repo: Arc<dyn ClubRepo>) -> Self {
        let owner_cache = moka::future::Cache::builder()
            .max_capacity(10_000)
            .time_to_live(std::time::Duration::from_secs(300)) // 5 minutes
            .build();

        Self { repo, owner_cache }
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

    async fn update_pro_settings(
        &self,
        _ctx: &RequestContext,
        club_id: ClubId,
        settings: UpdateClubSettingsRequest,
    ) -> Result<ClubProSettings, ClubError> {
        let existing = self.repo.get_club_pro_settings(club_id).await
            .map_err(|e| ClubError::Internal(e.to_string()))?
            .and_then(|v| serde_json::from_value::<ClubProSettings>(v).ok())
            .unwrap_or(ClubProSettings {
                banner_url: None,
                chip_preset_id: None,
                felt_color: None,
            });

        let merged = ClubProSettings {
            banner_url: settings.banner_url.or(existing.banner_url),
            chip_preset_id: settings.chip_preset_id.or(existing.chip_preset_id),
            felt_color: settings.felt_color.or(existing.felt_color),
        };

        let json = serde_json::to_value(&merged).map_err(|e| ClubError::Internal(e.to_string()))?;
        self.repo.update_club_pro_settings(club_id, json).await
            .map_err(|e| ClubError::Internal(e.to_string()))?;

        Ok(merged)
    }

    async fn get_pro_settings(
        &self,
        club_id: ClubId,
    ) -> Result<Option<ClubProSettings>, ClubError> {
        let settings = self.repo.get_club_pro_settings(club_id).await
            .map_err(|e| ClubError::Internal(e.to_string()))?;

        match settings {
            Some(v) => serde_json::from_value(v).map_err(|e| ClubError::Internal(e.to_string())),
            None => Ok(None),
        }
    }

    async fn find_club_owner(&self, club_id: ClubId) -> Result<Option<UserId>, ClubError> {
        let club = self.repo.find_club_by_id(club_id).await?;
        Ok(club.map(|c| c.created_by))
    }

    async fn is_club_pro_active(
        &self,
        _user_id: UserId,
    ) -> Result<bool, ClubError> {
        Ok(true)
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

        // Check if user is the club owner using cache
        let cache_key = (club_id, requested_by);
        let is_owner = match self.owner_cache.get(&cache_key).await {
            Some(cached) => cached,
            None => {
                let is_owner = self.repo.is_club_owner(club_id, requested_by).await?;
                self.owner_cache.insert(cache_key, is_owner).await;
                is_owner
            }
        };

        if !is_owner {
            // Check if club exists to return appropriate error
            let club_exists = self.repo.find_club_by_id(club_id).await?.is_some();
            if !club_exists {
                return Err(ClubError::not_found(club_id));
            }
            return Err(ClubError::PermissionDenied);
        }

        let start = std::time::Instant::now();
        let result = self.repo.rebalance_divisions(club_id).await;

        let duration = start.elapsed().as_secs_f64();
        get_rebalance_operations().inc();
        get_rebalance_duration().observe(duration);

        result
    }
}
