use axum::http::StatusCode;
use axum_test::TestServer;
use sb_rest_router::create_router;
use sb_contracts::lobby_api::{TableRepo, TableService, TableInfo};
use sb_table_registry::registry::Registry;
use sb_shared_types::{TableId, StakeLevel};
use std::sync::Arc;
use jsonwebtoken::{encode, EncodingKey, Header};
use serde::{Serialize, Deserialize};
use chrono::{Utc, Duration};

// Dummy JWT claims
#[derive(Debug, Serialize, Deserialize)]
struct Claims {
    sub: String,
    exp: usize,
}

fn generate_token() -> String {
    let claims = Claims {
        sub: "test-user".to_string(),
        exp: (Utc::now() + Duration::hours(1)).timestamp() as usize,
    };
    let key = EncodingKey::from_secret(b"your-secret-key");
    encode(&Header::default(), &claims, &key).unwrap()
}

// Define mocks manually using mockall
mockall::mock! {
    pub TableRepo { }
    #[async_trait::async_trait]
    impl TableRepo for TableRepo {
        async fn list_tables(&self) -> Result<Vec<TableInfo>, sb_shared_types::AppError>;
        async fn create_table(&self, stake_level: StakeLevel, max_players: u32) -> Result<TableId, sb_shared_types::AppError>;
    }
}

mockall::mock! {
    pub TableService { }
    #[async_trait::async_trait]
    impl TableService for TableService {
        async fn create_cash_table(&self, stake_level: StakeLevel, max_players: u32) -> Result<TableId, sb_shared_types::AppError>;
    }
}

#[tokio::test]
async fn test_create_and_list_table() {
    let mut mock_service = MockTableService::new();
    let mut mock_repo = MockTableRepo::new();
    let registry = Arc::new(Registry::new());

    let expected_id = TableId::new();
    mock_service
        .expect_create_cash_table()
        .with(mockall::predicate::eq(StakeLevel::Low), mockall::predicate::eq(6))
        .returning(move |_, _| Ok(expected_id));

    let table_info = TableInfo {
        table_id: expected_id,
        stake_level: StakeLevel::Low,
        current_players: 0,
        max_players: 6,
        status: "waiting".to_string(),
    };
    mock_repo
        .expect_list_tables()
        .returning(move || Ok(vec![table_info.clone()]));

    let app = create_router(Arc::new(mock_service), Arc::new(mock_repo), registry);
    let server = TestServer::new(app).unwrap();

    let token = generate_token();
    let create_body = serde_json::json!({
        "stake_level": "Low",
        "max_players": 6
    });
    let resp = server
        .post("/tables")
        .add_header("Authorization", format!("Bearer {}", token))
        .json(&create_body)
        .await;
    assert_eq!(resp.status_code(), StatusCode::OK);
    let created: serde_json::Value = resp.json();
    assert_eq!(created["table_id"], expected_id.to_string());

    let list_resp = server
        .get("/lobby")
        .add_header("Authorization", format!("Bearer {}", token))
        .await;
    assert_eq!(list_resp.status_code(), StatusCode::OK);
    let tables: Vec<serde_json::Value> = list_resp.json();
    assert_eq!(tables.len(), 1);
    assert_eq!(tables[0]["table_id"], expected_id.to_string());
}

#[tokio::test]
async fn test_unauthenticated_returns_401() {
    let mock_service = MockTableService::new();
    let mock_repo = MockTableRepo::new();
    let registry = Arc::new(Registry::new());
    let app = create_router(Arc::new(mock_service), Arc::new(mock_repo), registry);
    let server = TestServer::new(app).unwrap();
    let resp = server.get("/lobby").await;
    assert_eq!(resp.status_code(), StatusCode::UNAUTHORIZED);
}
