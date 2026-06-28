//! Oracle heuristic engine.
mod session;
mod templates;

pub use session::SessionManager;
pub use templates::TemplateLibrary;

use async_trait::async_trait;
use sb_contracts::repo_api::{PersistenceError, UserRepo};
use sb_contracts::service_api::OracleService;
use sb_shared_types::RequestContext;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use thiserror::Error;
use tracing::{info, warn};

const DEFAULT_UPGRADE_URL: &str = "https://stackbluff.com/upgrade";

#[derive(Debug, Error)]
pub enum OracleError {
    #[error("analysis limit reached for this session")]
    LimitReached { upgrade_url: String },
    #[error("unauthorized: {0}")]
    Unauthorized(String),
    #[error("unauthorized: {0}")]
    Engine(String),
    #[error("persistence error: {0}")]
    Persistence(#[from] PersistenceError),
}

#[derive(Debug, Deserialize, Clone)]
pub struct HandAnalysisParams {
    pub hole_cards: [String; 2],
    pub community_cards: Vec<String>,
    pub pot_size: u64,
    pub stack_size: u64,
    pub pot_odds_ratio: f64,
    pub hand_strength: f64,
    pub position: String,
    pub stack_bb: f64,
    pub is_bluff_catching: bool,
    pub is_cbet_situation: bool,
}

#[derive(Debug, Serialize)]
pub struct AnalysisResult {
    pub recommendation: String,
    pub confidence: f64,
}

#[derive(Debug, Serialize)]
pub struct RemainingResponse {
    pub remaining: u32,
    pub unlimited: bool,
}

pub struct OracleServiceImpl {
    session_manager: SessionManager,
    user_repo: Arc<dyn UserRepo>,
    upgrade_url: String,
}

impl OracleServiceImpl {
    pub fn new(
        session_manager: SessionManager,
        user_repo: Arc<dyn UserRepo>,
        upgrade_url: Option<String>,
    ) -> Self {
        Self {
            session_manager,
            user_repo,
            upgrade_url: upgrade_url
                .or_else(|| std::env::var("UPGRADE_URL").ok())
                .unwrap_or_else(|| DEFAULT_UPGRADE_URL.to_string()),
        }
    }

    pub async fn remaining_analyses(
        &self,
        ctx: &RequestContext,
    ) -> Result<RemainingResponse, OracleError> {
        let user_id = ctx.user_id.ok_or_else(|| {
            OracleError::Unauthorized("missing user_id in request context".to_string())
        })?;
        let has_pass = self
            .user_repo
            .has_active_season_pass(ctx.clone(), user_id)
            .await?;

        if has_pass {
            Ok(RemainingResponse {
                remaining: 0,
                unlimited: true,
            })
        } else {
            let remaining = self.session_manager.remaining(user_id).await;
            Ok(RemainingResponse {
                remaining,
                unlimited: false,
            })
        }
    }
}

#[async_trait]
impl OracleService for OracleServiceImpl {
    type Params = HandAnalysisParams;
    type Output = AnalysisResult;
    type Error = OracleError;

    async fn analyze(
        &self,
        ctx: &RequestContext,
        _______params: Self::Params,
    ) -> Result<Self::Output, Self::Error> {
        let user_id = ctx.user_id.ok_or_else(|| {
            OracleError::Unauthorized("missing user_id in request context".to_string())
        })?;

        let has_pass = self
            .user_repo
            .has_active_season_pass(ctx.clone(), user_id)
            .await?;

        if !has_pass {
            let remaining = self.session_manager.remaining(user_id).await;
            info!(%user_id, remaining, "oracle analysis request");
            if !self.session_manager.try_consume(user_id).await {
                warn!(%user_id, "oracle analysis limit reached");
                return Err(OracleError::LimitReached {
                    upgrade_url: self.upgrade_url.clone(),
                });
            }
        } else {
            info!(%user_id, "oracle analysis request with active season pass");
        }

        Ok(AnalysisResult {
            recommendation: "fold".to_string(),
            confidence: 0.85,
        })
    }

    async fn answer_callback_query(
        &self,
        _callback_id: String,
        _text: Option<String>,
    ) -> Result<(), Self::Error> {
        Ok(())
    }
}

mod tests;
