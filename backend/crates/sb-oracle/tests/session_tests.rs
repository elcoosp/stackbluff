use sb_contracts::service_api::OracleService;
use sb_oracle::{HandAnalysisParams, OracleServiceImpl};
use sb_shared_types::{RequestContext, UserId};
use tokio::time::{Duration as TokioDuration, advance, pause};
use uuid::Uuid;

#[tokio::test]
async fn session_resets_after_8_hours() {
    pause();
    let oracle = OracleServiceImpl::new();
    let user_id = UserId(Uuid::new_v4());
    let ctx = RequestContext {
        ip: String::new(),
        request_id: Uuid::new_v4(),
        user_id: Some(user_id),
    };
    let params = HandAnalysisParams::new("late".into(), 2.0, 30.0, 0.5, false, false, false);

    for _ in 0..3 {
        assert!(oracle.analyze(&ctx, params.clone()).await.is_ok());
    }
    assert!(oracle.analyze(&ctx, params.clone()).await.is_err());

    advance(TokioDuration::from_secs(8 * 3600 + 1)).await;
    assert!(oracle.analyze(&ctx, params.clone()).await.is_ok());
}
