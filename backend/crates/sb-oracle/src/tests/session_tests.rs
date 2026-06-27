use crate::SessionManager;
use sb_shared_types::UserId;

#[tokio::test]
async fn remaining_returns_max_for_new_user() {
    let session = SessionManager::new();
    let remaining = session.remaining(UserId::default()).await;
    assert_eq!(remaining, 3);
}

#[tokio::test]
async fn remaining_decreases_after_consume() {
    let session = SessionManager::new();
    let user_id = UserId::default();

    session.try_consume(user_id).await;
    let remaining = session.remaining(user_id).await;
    assert_eq!(remaining, 2);
}

#[tokio::test]
async fn remaining_zero_after_max() {
    let session = SessionManager::new();
    let user_id = UserId::default();

    for _ in 0..5 {
        session.try_consume(user_id).await;
    }

    let remaining = session.remaining(user_id).await;
    assert_eq!(remaining, 0);
}
