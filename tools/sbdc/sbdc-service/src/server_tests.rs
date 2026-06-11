#[cfg(test)]
mod tests {
    use crate::init;
    use crate::scaffold;
    use crate::build_prompts;
    use crate::server;
    use base64::Engine;
    use sbdc_migration::Migrator;
    use sbdc_migration::MigratorTrait;
    use sbdc_entity::generated_prompt;
    use sea_orm::{ColumnTrait, ConnectionTrait, Database, DatabaseConnection, EntityTrait, PaginatorTrait, QueryFilter};
    use std::collections::HashMap;
    use std::sync::Arc;
    use tempfile::tempdir;
    use tokio::sync::Mutex;

    async fn setup_test_db() -> DatabaseConnection {
        let db = Database::connect("sqlite::memory:").await.unwrap();
        db.execute_unprepared("PRAGMA foreign_keys = ON;")
            .await
            .unwrap();
        Migrator::up(&db, None).await.unwrap();
        db
    }

    async fn setup_full_deck(db: &DatabaseConnection, project_dir: &std::path::Path) {
        init::run_init(db, project_dir).await.unwrap();
        scaffold::run_scaffold(db, project_dir, "test-deck", "default_season")
            .await
            .unwrap();
        build_prompts::run_build_prompts(db, "test-deck")
            .await
            .unwrap();
    }

    fn make_state(
        db: DatabaseConnection,
        project_dir: std::path::PathBuf,
    ) -> Arc<server::AppState> {
        Arc::new(server::AppState {
            db,
            project_dir,
            takes_target: Mutex::new(HashMap::new()),
        })
    }

    #[tokio::test]
    async fn test_deck_status_not_found() {
        let db = setup_test_db().await;
        let dir = tempdir().unwrap();
        let state = make_state(db, dir.path().to_path_buf());

        let result = server::deck_status(
            axum::extract::State(state),
            axum::extract::Path("nonexistent".to_string()),
        )
        .await;

        assert!(result.is_err());
        let err = result.unwrap_err();
        assert_eq!(err.0, axum::http::StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn test_start_and_status_flow() {
        let db = setup_test_db().await;
        let dir = tempdir().unwrap();
        setup_full_deck(&db, dir.path()).await;

        let state = make_state(db.clone(), dir.path().to_path_buf());

        let start_req = server::StartRequest {
            takes_per_prompt: Some(2),
        };
        let result = server::start_deck(
            axum::extract::State(state.clone()),
            axum::extract::Path("test-deck".to_string()),
            axum::Json(start_req),
        )
        .await
        .unwrap();

        let data = result.0;
        assert_eq!(data["deck_id"], "test-deck");
        assert_eq!(data["takes_per_prompt"], 2);
        assert!(data["prompts_ready"].as_u64().unwrap() > 0);

        let status_result = server::deck_status(
            axum::extract::State(state.clone()),
            axum::extract::Path("test-deck".to_string()),
        )
        .await
        .unwrap();

        let status = status_result.0;
        assert_eq!(status["status"], "generating");
        assert_eq!(status["takes_per_prompt"], 2);
    }

    #[tokio::test]
    async fn test_next_prompt_and_submit() {
        let db = setup_test_db().await;
        let dir = tempdir().unwrap();
        setup_full_deck(&db, dir.path()).await;

        let state = make_state(db.clone(), dir.path().to_path_buf());

        let _start_result = server::start_deck(
            axum::extract::State(state.clone()),
            axum::extract::Path("test-deck".to_string()),
            axum::Json(server::StartRequest {
                takes_per_prompt: Some(2),
            }),
        )
        .await
        .unwrap();

        let next = server::next_prompt(
            axum::extract::State(state.clone()),
            axum::extract::Path("test-deck".to_string()),
        )
        .await
        .unwrap()
        .0;

        assert!(next["prompt_id"].is_number());
        assert!(next["positive"].is_string());
        let prompt_id = next["prompt_id"].as_i64().unwrap() as i32;

        let fake_png_b64 = base64::engine::general_purpose::STANDARD
            .encode(&[0x89u8, 0x50, 0x4Eu8, 0x47u8]);
        let submit = server::SubmitTakesRequest {
            images: vec![
                server::ImageData {
                    index: 0,
                    data: format!("data:image/png;base64,{}", fake_png_b64),
                },
                server::ImageData {
                    index: 1,
                    data: format!("data:image/png;base64,{}", fake_png_b64),
                },
            ],
        };

        let result = server::submit_takes(
            axum::extract::State(state.clone()),
            axum::extract::Path(("test-deck".to_string(), prompt_id)),
            axum::Json(submit),
        )
        .await
        .unwrap();

        let data = result.0;
        assert_eq!(data["count"], 2);

        let takes = server::list_takes(
            axum::extract::State(state.clone()),
            axum::extract::Path("test-deck".to_string()),
        )
        .await
        .unwrap()
        .0;

        let take_list = takes["takes"].as_array().unwrap();
        assert_eq!(take_list.len(), 2);

        let take_id = take_list[0]["take_id"].as_i64().unwrap() as i32;
        let select_result = server::select_take(
            axum::extract::State(state.clone()),
            axum::extract::Path(("test-deck".to_string(), take_id)),
        )
        .await
        .unwrap();

        assert_eq!(select_result.0["selected"], take_id);
    }

    #[tokio::test]
    async fn test_next_prompt_returns_no_more_when_exhausted() {
        let db = setup_test_db().await;
        let dir = tempdir().unwrap();
        setup_full_deck(&db, dir.path()).await;

        let state = make_state(db.clone(), dir.path().to_path_buf());

        let _start_result = server::start_deck(
            axum::extract::State(state.clone()),
            axum::extract::Path("test-deck".to_string()),
            axum::Json(server::StartRequest {
                takes_per_prompt: Some(1),
            }),
        )
        .await
        .unwrap();

        let prompt_count = generated_prompt::Entity::find()
            .filter(generated_prompt::Column::DeckId.eq("test-deck"))
            .filter(generated_prompt::Column::Status.eq("ready_to_generate"))
            .count(&db)
            .await
            .unwrap();

        for _ in 0..prompt_count {
            let next = server::next_prompt(
                axum::extract::State(state.clone()),
                axum::extract::Path("test-deck".to_string()),
            )
            .await
            .unwrap()
            .0;
            assert!(next["prompt_id"].is_number());
        }

        let exhausted = server::next_prompt(
            axum::extract::State(state.clone()),
            axum::extract::Path("test-deck".to_string()),
        )
        .await
        .unwrap()
        .0;
        assert_eq!(exhausted["status"], "no_more_prompts");
    }

    #[tokio::test]
    async fn test_submit_wrong_deck_rejected() {
        let db = setup_test_db().await;
        let dir = tempdir().unwrap();
        setup_full_deck(&db, dir.path()).await;

        let state = make_state(db.clone(), dir.path().to_path_buf());

        let _ = server::start_deck(
            axum::extract::State(state.clone()),
            axum::extract::Path("test-deck".to_string()),
            axum::Json(server::StartRequest {
                takes_per_prompt: Some(1),
            }),
        )
        .await
        .unwrap();

        let next = server::next_prompt(
            axum::extract::State(state.clone()),
            axum::extract::Path("test-deck".to_string()),
        )
        .await
        .unwrap()
        .0;
        let prompt_id = next["prompt_id"].as_i64().unwrap() as i32;

        let fake_png_b64 = base64::engine::general_purpose::STANDARD
            .encode(&[0x89u8, 0x50u8, 0x4Eu8, 0x47u8]);
        let submit = server::SubmitTakesRequest {
            images: vec![server::ImageData {
                index: 0,
                data: format!("data:image/png;base64,{}", fake_png_b64),
            }],
        };

        let result = server::submit_takes(
            axum::extract::State(state.clone()),
            axum::extract::Path(("wrong-deck".to_string(), prompt_id)),
            axum::Json(submit),
        )
        .await;

        assert!(result.is_err());
        assert_eq!(result.unwrap_err().0, axum::http::StatusCode::BAD_REQUEST);
    }
}
