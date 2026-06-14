#!/usr/bin/env bash
set -euo pipefail
trap 'echo "ERROR on line $LINENO"; exit 1' ERR
DEBUG=${DEBUG:-0}; [ "$DEBUG" = "1" ] && set -x

WORKTREE_DIR=$(git worktree list | grep issue-014 | awk '{print $1}')
cd "$WORKTREE_DIR/backend"

# ── Fix 1: Add re-exports back to sb-contracts lib.rs ───────────
echo "=== Fix 1: Add missing re-exports ==="

python3 << 'PYEOF'
with open("crates/sb-contracts/src/lib.rs", "r") as f:
    content = f.read()

# Add re-exports if missing
if "pub use repo_api::ClubService" not in content:
    content = content.replace(
        "pub use repo_api::ClubRepo;",
        "pub use repo_api::{ClubRepo, LeaderboardPage, LeaderboardEntry, Club, ClubMembership, DIVISION_SIZE};\npub use service_api::ClubService;"
    )

with open("crates/sb-contracts/src/lib.rs", "w") as f:
    f.write(content)

print("  Added re-exports")
PYEOF

# ── Fix 2: Update sb-club imports ────────────────────────────────
echo "=== Fix 2: Fix sb-club imports ==="

# service.rs
cat > crates/sb-club/src/service.rs << 'EOF'
use sb_contracts::{ClubRepo, ClubService, ClubError, LeaderboardPage};
use sb_shared_types::{ClubId, RequestContext, UserId};
use std::sync::Arc;

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
        ctx: &RequestContext,
        club_id: ClubId,
        division: u32,
    ) -> Result<LeaderboardPage, ClubError> {
        let club = self.repo.find_club_by_id(club_id).await?;
        if club.is_none() {
            return Err(ClubError::not_found(club_id));
        }
        self.repo.get_leaderboard_page(club_id, division).await
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
}
EOF

# handlers.rs
cat > crates/sb-club/src/handlers.rs << 'EOF'
use axum::{
    extract::{Path, State},
    http::StatusCode,
    Extension, Json,
};
use sb_contracts::{ClubService, ClubError};
use sb_shared_types::{ClubId, RequestContext, UserId};
use std::sync::Arc;

use crate::models::{
    CreateClubRequest, CreateClubResponse, GetLeaderboardResponse, JoinClubResponse,
};

#[derive(Clone)]
pub struct ClubState {
    pub service: Arc<dyn ClubService>,
}

fn extract_user_id(ctx: &RequestContext) -> Result<UserId, (StatusCode, String)> {
    ctx.user_id.ok_or_else(|| {
        (StatusCode::UNAUTHORIZED, "authentication required".to_string())
    })
}

pub async fn create_club(
    State(state): State<ClubState>,
    Extension(ctx): Extension<RequestContext>,
    Json(req): Json<CreateClubRequest>,
) -> Result<(StatusCode, Json<CreateClubResponse>), (StatusCode, String)> {
    let user_id = extract_user_id(&ctx)?;

    let club_id = state
        .service
        .create_club(&ctx, &req.name, req.logo_url.as_deref(), user_id)
        .await
        .map_err(|e| map_club_error(e))?;

    Ok((StatusCode::CREATED, Json(CreateClubResponse { club_id })))
}

pub async fn join_club(
    State(state): State<ClubState>,
    Extension(ctx): Extension<RequestContext>,
    Path(club_id): Path<ClubId>,
) -> Result<Json<JoinClubResponse>, (StatusCode, String)> {
    let user_id = extract_user_id(&ctx)?;

    state
        .service
        .join_club(&ctx, club_id, user_id)
        .await
        .map_err(|e| map_club_error(e))?;

    Ok(Json(JoinClubResponse { success: true }))
}

pub async fn get_leaderboard(
    State(state): State<ClubState>,
    Extension(ctx): Extension<RequestContext>,
    Path(club_id): Path<ClubId>,
) -> Result<Json<GetLeaderboardResponse>, (StatusCode, String)> {
    let page = state
        .service
        .get_leaderboard(&ctx, club_id, 1)
        .await
        .map_err(|e| map_club_error(e))?;

    Ok(Json(GetLeaderboardResponse::from(page)))
}

fn map_club_error(e: ClubError) -> (StatusCode, String) {
    match e {
        ClubError::NotFound { .. } => (StatusCode::NOT_FOUND, e.to_string()),
        ClubError::AlreadyMember { .. } => (StatusCode::CONFLICT, e.to_string()),
        ClubError::NotAMember { .. } => (StatusCode::FORBIDDEN, e.to_string()),
        ClubError::Validation { .. } => (StatusCode::BAD_REQUEST, e.to_string()),
        ClubError::Database { .. } => {
            tracing::error!(error = %e, "club database error");
            (StatusCode::INTERNAL_SERVER_ERROR, "internal error".to_string())
        }
    }
}
EOF

echo "  Fixed sb-club"

# ── Fix 3: sb-club/Cargo.toml — add sb-contracts full dep ─────
# Make sure sb-club can access ClubError etc
grep -q "sb-contracts" crates/sb-club
