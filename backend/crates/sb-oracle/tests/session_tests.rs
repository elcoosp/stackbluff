use sb_oracle::{OracleServiceImpl, HandAnalysisParams};
use sb_shared_types::{RequestContext, UserId};
use tokio::time::{pause, advance, Duration as TokioDuration};
use uuid::Uuid;
use sb_contracts::service_api::OracleService;

#[tokio::test]
async fn session_resets_after_8_hours() {
    pause();
    let oracle = OracleServiceImpl::new();
    let user_id = UserId::from(Uuid::new_v4());
    let ctx = RequestContext { request_id: Uuid::new_v4(), user_id: Some(user_id) };
    let params = HandAnalysisParams::new(
        "late".into(), 2.0, 30.0, 0.5, false, false, false
    );

    for _ in 0..3 {
        assert!(oracle.analyze(&ctx, params.clone()).await.is_ok());
    }
    assert!(oracle.analyze(&ctx, params.clone()).await.is_err());

    advance(TokioDuration::from_secs(8 * 3600 + 1)).await;
    assert!(oracle.analyze(&ctx, params.clone()).await.is_ok());
}
