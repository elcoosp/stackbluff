//! Service traits for business logic.
use async_trait::async_trait;
use sb_shared_types::RequestContext;

#[async_trait]
pub trait OracleService {
    type Params;
    type Output;
    type Error;

    async fn analyze(&self, ctx: &RequestContext, params: Self::Params) -> Result<Self::Output, Self::Error>;
}
