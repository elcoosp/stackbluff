//! Oracle heuristic engine.
mod session;
mod templates;

pub use session::SessionManager;
pub use templates::TemplateLibrary;

use async_trait::async_trait;
use sb_contracts::service_api::OracleService;
use sb_shared_types::RequestContext;
use serde::{Deserialize, Serialize};
use thiserror::Error;
use tracing::{error, info, warn};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HandAnalysisParams {
    pub position: String,
    pub pot_odds_ratio: f64,
    pub stack_bb: f64,
    pub hand_strength: f64,
    pub is_bluff_catching: bool,
    pub is_cbet_situation: bool,
    pub is_all_in: bool,
}

impl HandAnalysisParams {
    pub fn new(
        position: String,
        pot_odds_ratio: f64,
        stack_bb: f64,
        hand_strength: f64,
        is_bluff_catching: bool,
        is_cbet_situation: bool,
        is_all_in: bool,
    ) -> Self {
        Self {
            position,
            pot_odds_ratio,
            stack_bb,
            hand_strength,
            is_bluff_catching,
            is_cbet_situation,
            is_all_in,
        }
    }

    /// Validates that all parameters are within reasonable ranges.
    pub fn validate(&self) -> Result<(), &'static str> {
        if self.hand_strength < 0.0 || self.hand_strength > 1.0 {
            return Err("hand_strength must be between 0 and 1");
        }
        if self.pot_odds_ratio <= 0.0 {
            return Err("pot_odds_ratio must be positive");
        }
        if self.stack_bb <= 0.0 {
            return Err("stack_bb must be positive");
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisOutput {
    pub text: String,
    pub template_id: String,
}

#[derive(Error, Debug)]
pub enum OracleError {
    #[error("Free tier limit reached (3 analyses per session)")]
    LimitReached,
    #[error("No matching template found for given parameters")]
    NoMatchingTemplate,
    #[error("Internal error: {0}")]
    Internal(String),
}

pub struct OracleServiceImpl {
    templates: TemplateLibrary,
    sessions: SessionManager,
}

impl Default for OracleServiceImpl {
    fn default() -> Self {
        Self::new()
    }
}

impl OracleServiceImpl {
    pub fn new() -> Self {
        Self {
            templates: TemplateLibrary::load(),
            sessions: SessionManager::new(),
        }
    }
}

#[async_trait]
impl OracleService for OracleServiceImpl {
    type Params = HandAnalysisParams;
    type Output = AnalysisOutput;
    type Error = OracleError;

    async fn analyze(
        &self,
        ctx: &RequestContext,
        params: Self::Params,
    ) -> Result<Self::Output, Self::Error> {
        let user_id = ctx
            .user_id
            .ok_or_else(|| OracleError::Internal("missing user_id".into()))?;
        info!("Oracle analysis requested for user {:?}", user_id);
        if !self.sessions.try_consume(user_id).await {
            warn!("Oracle limit reached for user {:?}", user_id);
            return Err(OracleError::LimitReached);
        }
        let template = match self.templates.select(&params) {
            Some(t) => t,
            None => {
                error!(
                    "No matching template for user {:?}, params: {:?}",
                    user_id, params
                );
                return Err(OracleError::NoMatchingTemplate);
            }
        };
        let text = template.render(&params);
        info!(
            "Oracle analysis completed for user {:?} using template {}",
            user_id, template.id
        );
        Ok(AnalysisOutput {
            text,
            template_id: template.id.clone(),
        })
    }

    async fn answer_callback_query(
        &self,
        _callback_id: String,
        _text: Option<String>,
    ) -> Result<(), Self::Error> {
        // Oracle service does not handle callback queries; no-op
        Ok(())
    }
}
