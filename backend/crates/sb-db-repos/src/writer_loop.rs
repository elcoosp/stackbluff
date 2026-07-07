use sb_contracts::repo_api::{PersistenceError, UserProfile, UserWithHash};
use sb_shared_types::UserId;
use sea_orm::{
    ActiveModelTrait, ColumnTrait, ConnectionTrait, DatabaseConnection, EntityTrait, QueryFilter,
    TransactionTrait,
};
use tokio::sync::mpsc;
use tokio::sync::watch;
use tokio::time::{Duration, interval};
use tracing::{Instrument, error, info, info_span};

use crate::commands::DbCommand;

const DEFAULT_BATCH_SIZE: usize = 50;
const INITIAL_CHIP_BALANCE: i64 = 100_000;

pub struct WriterLoopHandle {
    pub sender: mpsc::UnboundedSender<DbCommand>,
    pub shutdown: watch::Sender<bool>,
    pub task: tokio::task::JoinHandle<()>,
}

pub fn init_writer_loop(db: DatabaseConnection, batch_size: Option<usize>) -> WriterLoopHandle {
    let (tx, rx) = mpsc::unbounded_channel();
    let (shutdown_tx, shutdown_rx) = watch::channel(false);
    let size = batch_size.unwrap_or(DEFAULT_BATCH_SIZE);
    let handle = tokio::spawn(writer_loop(rx, db, shutdown_rx, size));
    WriterLoopHandle {
        sender: tx,
        shutdown: shutdown_tx,
        task: handle,
    }
}

async fn writer_loop(
    mut rx: mpsc::UnboundedReceiver<DbCommand>,
    db: DatabaseConnection,
    mut shutdown_rx: watch::Receiver<bool>,
    batch_size: usize,
) {
    let mut batch = Vec::with_capacity(batch_size);
    let mut flush_interval = interval(Duration::from_millis(100));

    loop {
        tokio::select! {
            cmd = rx.recv() => {
                match cmd {
                    Some(cmd) => {
                        batch.push(cmd);
                        if batch.len() >= batch_size {
                            process_batch(&mut batch, &db).await;
                        }
                    }
                    None => {
                        if !batch.is_empty() {
                            process_batch(&mut batch, &db).await;
                        }
                        break;
                    }
                }
            }
            _ = flush_interval.tick() => {
                if !batch.is_empty() {
                    process_batch(&mut batch, &db).await;
                }
            }
            _ = shutdown_rx.changed() => {
                if *shutdown_rx.borrow() {
                    info!("Shutdown signal received, processing remaining {} commands", batch.len());
                    if !batch.is_empty() {
                        process_batch(&mut batch, &db).await;
                    }
                    break;
                }
            }
        }
    }
    info!("Writer loop terminated");
}

async fn process_batch(batch: &mut Vec<DbCommand>, db: &DatabaseConnection) {
    let txn = match db.begin().await {
        Ok(txn) => txn,
        Err(e) => {
            error!("Failed to begin transaction: {}", e);
            for cmd in batch.drain(..) {
                respond_err(cmd, PersistenceError::Database(e.to_string()));
            }
            return;
        }
    };

    let mut savepoint_results = Vec::with_capacity(batch.len());
    for (idx, cmd) in batch.iter_mut().enumerate() {
        let sp_name = format!("sp_{}", idx);
        let result = run_command_in_savepoint(cmd, &txn, &sp_name).await;
        savepoint_results.push(result);
    }

    if let Err(e) = txn.commit().await {
        error!("Transaction commit failed: {}", e);
        for (cmd, _) in batch.drain(..).zip(savepoint_results) {
            respond_err(cmd, PersistenceError::Database(e.to_string()));
        }
    } else {
        for (cmd, result) in batch.drain(..).zip(savepoint_results) {
            match result {
                Ok(res) => respond_ok(cmd, res),
                Err(err) => respond_err(cmd, err),
            }
        }
    }
}

async fn run_command_in_savepoint<C: ConnectionTrait>(
    cmd: &mut DbCommand,
    conn: &C,
    sp_name: &str,
) -> Result<Option<String>, PersistenceError> {
    let ctx = match cmd {
        DbCommand::CreateUser { ctx, .. } => ctx,
        DbCommand::GetUser { ctx, .. } => ctx,
        DbCommand::GetUserProfile { ctx, .. } => ctx,
        DbCommand::UpdateChipBalance { ctx, .. } => ctx,
        DbCommand::StoreHandHistory { ctx, .. } => ctx,
        DbCommand::ExecuteRaw { ctx, .. } => ctx,
        DbCommand::FindOrCreateByTelegram { ctx, .. } => ctx,
        DbCommand::FindByTelegram { ctx, .. } => ctx, // <-- ADDED
        DbCommand::CreateEmailUser { ctx, .. } => ctx,
        DbCommand::FindByEmail { ctx, .. } => ctx,
        DbCommand::FindByEmailWithHash { ctx, .. } => ctx,
        DbCommand::MarkEmailVerified { ctx, .. } => ctx,
        DbCommand::UpdatePassword { ctx, .. } => ctx,
        DbCommand::UpdatePasswordWithTimestamp { ctx, .. } => ctx,
        DbCommand::IsEmailVerified { ctx, .. } => ctx,
        DbCommand::CheckClubPro { .. } => {
            // This command doesn't need a context; we'll still create a dummy for the span.
            // We'll handle it separately.
            unimplemented!("CheckClubPro is handled in its own branch");
        }
    };

    let request_id = ctx.request_id;
    let span = info_span!("db_command", savepoint = sp_name, request_id = %request_id);
    async {
        let create_sql = format!("SAVEPOINT {}", sp_name);
        if let Err(e) = conn.execute_unprepared(&create_sql).await {
            return Err(PersistenceError::Database(e.to_string()));
        }

        let result = match cmd {
            DbCommand::CreateUser {
                telegram_id,
                email,
                display_name,
                ..
            } => {
                use sb_db_entities::enums::Platform;
                use sb_db_entities::user;
                use sea_orm::Set;
                let new_user = user::ActiveModel {
                    id: Set(uuid::Uuid::new_v4()),
                    telegram_id: Set(Some(*telegram_id)),
                    email: Set(Some(email.clone())),
                    display_name: Set(display_name.clone()),
                    chip_balance: Set(INITIAL_CHIP_BALANCE),
                    streak_count: Set(0),
                    created_at: Set(chrono::Utc::now()),
                    platform: Set(Platform::Telegram),
                    ..Default::default()
                };
                let model = new_user.insert(conn).await.map_err(map_db_error)?;
                Ok(Some(model.id.to_string()))
            }
            DbCommand::GetUser { id, .. } => {
                use sb_db_entities::user;
                let user_id = id.as_uuid();
                let model = user::Entity::find_by_id(user_id)
                    .one(conn)
                    .await
                    .map_err(map_db_error)?
                    .ok_or(PersistenceError::NotFound)?;
                Ok(Some(model.display_name))
            }
            DbCommand::GetUserProfile { id, .. } => {
                use sb_db_entities::user;
                let user_id = id.as_uuid();
                let model = user::Entity::find_by_id(user_id)
                    .one(conn)
                    .await
                    .map_err(map_db_error)?
                    .ok_or(PersistenceError::NotFound)?;

                let profile = UserProfile {
                    id: UserId::new(model.id),
                    display_name: model.display_name,
                    email: model.email,
                    chip_balance: model.chip_balance,
                    email_verified_at: model.email_verified_at,
                    platform: model.platform.to_string(),
                    club_pro_expires_at: model.club_pro_expires_at,
                    season_pass_id: model.season_pass_id,
                    season_pass_expires_at: model.season_pass_expires_at,
                    registration_order: model.registration_order.map(|o| o as u64), // <-- ADDED
                };

                Ok(Some(
                    serde_json::to_string(&profile)
                        .map_err(|e| PersistenceError::Database(e.to_string()))?,
                ))
            }
            DbCommand::UpdateChipBalance { user_id, delta, .. } => {
                use sb_db_entities::user;
                use sea_orm::Set;
                let uid = user_id.as_uuid();
                let model = user::Entity::find_by_id(uid)
                    .one(conn)
                    .await
                    .map_err(map_db_error)?
                    .ok_or(PersistenceError::NotFound)?;
                let mut active: user::ActiveModel = model.into();
                let current = active.chip_balance.take().unwrap_or(0);
                let new_balance = current + *delta;
                active.chip_balance = Set(new_balance);
                sea_orm::ActiveModelTrait::update(active, conn)
                    .await
                    .map_err(map_db_error)?;
                Ok(Some(new_balance.to_string()))
            }
            DbCommand::StoreHandHistory {
                table_id,
                played_at,
                players_json,
                actions_json,
                result_json,
                ..
            } => {
                use sb_db_entities::hand_history;
                use sb_db_entities::hand_history_json::{HandActions, HandPlayers, HandResult};
                use sea_orm::Set;
                let players: HandPlayers =
                    serde_json::from_value(players_json.clone()).map_err(|e| {
                        PersistenceError::Database(format!("Invalid players_json: {}", e))
                    })?;
                let actions: HandActions =
                    serde_json::from_value(actions_json.clone()).map_err(|e| {
                        PersistenceError::Database(format!("Invalid actions_json: {}", e))
                    })?;
                let result: HandResult =
                    serde_json::from_value(result_json.clone()).map_err(|e| {
                        PersistenceError::Database(format!("Invalid result_json: {}", e))
                    })?;
                let participants = {
                    let user_ids: Vec<String> = players
                        .seats
                        .iter()
                        .filter_map(|p| p.user_id.as_ref().map(|u| u.to_string()))
                        .collect();
                    format!(",{},", user_ids.join(","))
                };

                let new_history = hand_history::ActiveModel {
                    id: Set(uuid::Uuid::new_v4()),
                    table_id: Set(*table_id),
                    played_at: Set(*played_at),
                    players_json: Set(players),
                    actions_json: Set(actions),
                    result_json: Set(result),
                    is_archived: Set(false),
                    participants: Set(participants),
                };
                new_history.insert(conn).await.map_err(map_db_error)?;
                Ok(None)
            }
            DbCommand::ExecuteRaw { sql, .. } => {
                conn.execute_unprepared(sql).await.map_err(map_db_error)?;
                Ok(None)
            }
            DbCommand::FindOrCreateByTelegram { tg_id, .. } => {
                use sb_db_entities::enums::Platform;
                use sb_db_entities::user;
                use sea_orm::Set;
                let user_model = user::Entity::find()
                    .filter(user::Column::TelegramId.eq(Some(*tg_id)))
                    .one(conn)
                    .await
                    .map_err(map_db_error)?;
                let user_id = if let Some(u) = user_model {
                    UserId::new(u.id)
                } else {
                    let new_user = user::ActiveModel {
                        id: Set(uuid::Uuid::new_v4()),
                        telegram_id: Set(Some(*tg_id)),
                        email: Set(Some(format!("telegram_{}@temp.local", tg_id))),
                        display_name: Set(format!("tg_user_{}", tg_id)),
                        chip_balance: Set(INITIAL_CHIP_BALANCE),
                        streak_count: Set(0),
                        created_at: Set(chrono::Utc::now()),
                        updated_at: Set(chrono::Utc::now()),
                        platform: Set(Platform::Telegram),
                        ..Default::default()
                    };
                    let model = new_user.insert(conn).await.map_err(map_db_error)?;
                    UserId::new(model.id)
                };
                Ok(Some(user_id.to_string()))
            }
            DbCommand::FindByTelegram { tg_id, .. } => {
                // <-- ADDED
                use sb_db_entities::user;
                let user_model = user::Entity::find()
                    .filter(user::Column::TelegramId.eq(Some(*tg_id)))
                    .one(conn)
                    .await
                    .map_err(map_db_error)?;
                Ok(user_model.map(|u| UserId::new(u.id).to_string()))
            }
            DbCommand::CreateEmailUser {
                username,
                email,
                password_hash,
                ..
            } => {
                use sb_db_entities::enums::Platform;
                use sb_db_entities::user;
                use sea_orm::Set;
                let new_user = user::ActiveModel {
                    id: Set(uuid::Uuid::new_v4()),
                    email: Set(Some(email.clone())),
                    display_name: Set(username.clone()),
                    password_hash: Set(Some(password_hash.clone())),
                    chip_balance: Set(INITIAL_CHIP_BALANCE),
                    streak_count: Set(0),
                    created_at: Set(chrono::Utc::now()),
                    updated_at: Set(chrono::Utc::now()),
                    platform: Set(Platform::Pwa),
                    ..Default::default()
                };
                let model = new_user.insert(conn).await.map_err(map_db_error)?;
                let user_id = UserId::new(model.id);
                Ok(Some(user_id.to_string()))
            }
            DbCommand::MarkEmailVerified { user_id, .. } => {
                use sb_db_entities::user;
                use sea_orm::Set;
                let uid = user_id.as_uuid();
                let result = user::Entity::update_many()
                    .filter(user::Column::Id.eq(uid))
                    .filter(user::Column::EmailVerifiedAt.is_null())
                    .set(user::ActiveModel {
                        email_verified_at: Set(Some(chrono::Utc::now())),
                        ..Default::default()
                    })
                    .exec(conn)
                    .await
                    .map_err(map_db_error)?;
                Ok(Some(result.rows_affected.to_string()))
            }
            DbCommand::UpdatePassword {
                user_id,
                new_password_hash,
                ..
            } => {
                use sb_db_entities::user;
                use sea_orm::Set;
                let uid = user_id.as_uuid();
                let model = user::Entity::find_by_id(uid)
                    .one(conn)
                    .await
                    .map_err(map_db_error)?
                    .ok_or(PersistenceError::NotFound)?;
                let mut active: user::ActiveModel = model.into();
                active.password_hash = Set(Some(new_password_hash.clone()));
                sea_orm::ActiveModelTrait::update(active, conn)
                    .await
                    .map_err(map_db_error)?;
                Ok(None)
            }
            DbCommand::UpdatePasswordWithTimestamp {
                user_id,
                new_password_hash,
                ..
            } => {
                use sb_db_entities::user;
                use sea_orm::Set;
                let uid = user_id.as_uuid();
                let model = user::Entity::find_by_id(uid)
                    .one(conn)
                    .await
                    .map_err(map_db_error)?
                    .ok_or(PersistenceError::NotFound)?;
                let mut active: user::ActiveModel = model.into();
                active.password_hash = Set(Some(new_password_hash.clone()));
                active.password_changed_at = Set(Some(chrono::Utc::now()));
                sea_orm::ActiveModelTrait::update(active, conn)
                    .await
                    .map_err(map_db_error)?;
                Ok(None)
            }
            DbCommand::IsEmailVerified { user_id, .. } => {
                use sb_db_entities::user;
                let uid = user_id.as_uuid();
                let model = user::Entity::find_by_id(uid)
                    .one(conn)
                    .await
                    .map_err(map_db_error)?
                    .ok_or(PersistenceError::NotFound)?;
                Ok(Some(model.email_verified_at.is_some().to_string()))
            }
            DbCommand::FindByEmail { email, .. } => {
                use sb_db_entities::user;
                let user_model = user::Entity::find()
                    .filter(user::Column::Email.eq(Some(email.clone())))
                    .one(conn)
                    .await
                    .map_err(map_db_error)?;
                let user_id = user_model.map(|u| UserId::new(u.id));
                Ok(user_id.map(|id: UserId| id.to_string()))
            }
            DbCommand::FindByEmailWithHash { email, .. } => {
                use sb_db_entities::user;
                let user_model = user::Entity::find()
                    .filter(user::Column::Email.eq(Some(email.clone())))
                    .one(conn)
                    .await
                    .map_err(map_db_error)?;
                Ok(user_model.map(|u| {
                    let with_hash = UserWithHash {
                        id: UserId::new(u.id),
                        password_hash: u.password_hash.clone(),
                        platform: u.platform.to_string(),
                    };
                    serde_json::to_string(&with_hash).unwrap_or_else(|e| {
                        tracing::error!(error = %e, "Failed to serialize UserWithHash");
                        String::new()
                    })
                }))
            }
            DbCommand::CheckClubPro { user_id, .. } => {
                use sb_db_entities::user;
                use sea_orm::ColumnTrait;
                use sea_orm::EntityTrait;
                use sea_orm::QueryFilter;
                let uid = user_id.as_uuid();
                let model = user::Entity::find()
                    .filter(user::Column::Id.eq(uid))
                    .one(conn)
                    .await
                    .map_err(map_db_error)?;
                let is_active = model
                    .and_then(|u| u.club_pro_expires_at)
                    .map(|exp| exp > chrono::Utc::now())
                    .unwrap_or(false);
                Ok(Some(is_active.to_string()))
            }
        };

        let rollback_sql = format!("ROLLBACK TO {}", sp_name);
        let release_sql = format!("RELEASE {}", sp_name);
        if result.is_err() {
            let _ = conn.execute_unprepared(&rollback_sql).await;
            result
        } else {
            let _ = conn.execute_unprepared(&release_sql).await;
            result
        }
    }
    .instrument(span)
    .await
}

fn map_db_error(e: sea_orm::DbErr) -> PersistenceError {
    match e {
        sea_orm::DbErr::Query(qe) => {
            let msg = qe.to_string();
            if msg.contains("UNIQUE constraint") || msg.contains("CHECK constraint") {
                PersistenceError::UniqueViolation
            } else {
                PersistenceError::Database(msg)
            }
        }
        _ => PersistenceError::Database(e.to_string()),
    }
}

fn respond_ok(cmd: DbCommand, value: Option<String>) {
    match cmd {
        DbCommand::CreateUser { respond, .. }
        | DbCommand::FindOrCreateByTelegram { respond, .. }
        | DbCommand::CreateEmailUser { respond, .. } => {
            let id = match value {
                Some(ref s) => match s.parse::<uuid::Uuid>() {
                    Ok(uuid) => UserId::new(uuid),
                    Err(e) => {
                        tracing::error!(uuid_str = %s, error = %e, "Failed to parse UUID");
                        let _ = respond
                            .send(Err(PersistenceError::Database("Invalid UUID".to_string())));
                        return;
                    }
                },
                None => {
                    let _ = respond.send(Err(PersistenceError::Database(
                        "No UUID returned".to_string(),
                    )));
                    return;
                }
            };
            let _ = respond.send(Ok(id));
        }
        DbCommand::MarkEmailVerified { respond, .. }
        | DbCommand::UpdatePassword { respond, .. }
        | DbCommand::UpdatePasswordWithTimestamp { respond, .. } => {
            let _ = respond.send(Ok(()));
        }
        DbCommand::IsEmailVerified { respond, .. } => {
            let is_verified = match value {
                Some(s) => s.parse::<bool>().unwrap_or(false),
                None => false,
            };
            let _ = respond.send(Ok(is_verified));
        }
        DbCommand::FindByEmail { respond, .. } => {
            let id = value
                .and_then(|s| s.parse::<uuid::Uuid>().ok())
                .map(UserId::new);
            let _ = respond.send(Ok(id));
        }
        DbCommand::FindByEmailWithHash { respond, .. } => {
            let user = value.and_then(|s| {
                if s.is_empty() {
                    None
                } else {
                    serde_json::from_str(&s).ok()
                }
            });
            let _ = respond.send(Ok(user));
        }
        DbCommand::FindByTelegram { respond, .. } => {
            // <-- ADDED
            let id = value
                .and_then(|s| s.parse::<uuid::Uuid>().ok())
                .map(UserId::new);
            let _ = respond.send(Ok(id));
        }
        DbCommand::GetUser { respond, .. } => {
            let _ = respond.send(Ok(value.unwrap_or_default()));
        }
        DbCommand::GetUserProfile { respond, .. } => {
            let profile = value.and_then(|s| serde_json::from_str(&s).ok());
            match profile {
                Some(p) => {
                    let _ = respond.send(Ok(p));
                }
                None => {
                    let _ = respond.send(Err(PersistenceError::Database(
                        "Failed to parse profile".to_string(),
                    )));
                }
            }
        }
        DbCommand::UpdateChipBalance { respond, .. } => {
            let balance = value.and_then(|s| s.parse::<i64>().ok()).unwrap_or(0);
            let _ = respond.send(Ok(balance));
        }
        DbCommand::StoreHandHistory { respond, .. } | DbCommand::ExecuteRaw { respond, .. } => {
            let _ = respond.send(Ok(()));
        }
        DbCommand::CheckClubPro { respond, .. } => {
            let is_active = value
                .map(|s| s.parse::<bool>().unwrap_or(false))
                .unwrap_or(false);
            let _ = respond.send(Ok(is_active));
        }
    }
}

fn respond_err(cmd: DbCommand, err: PersistenceError) {
    match cmd {
        DbCommand::CreateUser { respond, .. } => {
            let _ = respond.send(Err(err));
        }
        DbCommand::GetUser { respond, .. } => {
            let _ = respond.send(Err(err));
        }
        DbCommand::GetUserProfile { respond, .. } => {
            let _ = respond.send(Err(err));
        }
        DbCommand::UpdateChipBalance { respond, .. } => {
            let _ = respond.send(Err(err));
        }
        DbCommand::StoreHandHistory { respond, .. } => {
            let _ = respond.send(Err(err));
        }
        DbCommand::ExecuteRaw { respond, .. } => {
            let _ = respond.send(Err(err));
        }
        DbCommand::FindOrCreateByTelegram { respond, .. } => {
            let _ = respond.send(Err(err));
        }
        DbCommand::FindByTelegram { respond, .. } => {
            // <-- ADDED
            let _ = respond.send(Err(err));
        }
        DbCommand::CreateEmailUser { respond, .. } => {
            let _ = respond.send(Err(err));
        }
        DbCommand::MarkEmailVerified { respond, .. }
        | DbCommand::UpdatePassword { respond, .. }
        | DbCommand::UpdatePasswordWithTimestamp { respond, .. } => {
            let _ = respond.send(Err(err));
        }
        DbCommand::IsEmailVerified { respond, .. } => {
            let _ = respond.send(Err(err));
        }
        DbCommand::FindByEmail { respond, .. } => {
            let _ = respond.send(Err(err));
        }
        DbCommand::FindByEmailWithHash { respond, .. } => {
            let _ = respond.send(Err(err));
        }
        DbCommand::CheckClubPro { respond, .. } => {
            let _ = respond.send(Err(err));
        }
    }
}
