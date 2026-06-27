use crate::types::BotState;
use anyhow::Context;
use sb_contracts::service_api::CreateTableInput;
use sb_shared_types::ids::{TableId, UserId};
use sb_shared_types::request_context::RequestContext;
use std::sync::Arc;
use std::time::Duration;
use teloxide::types::{CallbackQuery, InlineKeyboardButton, InlineKeyboardMarkup, Message};
use tokio::time::timeout;
use tracing::{error, info, warn};

const SERVICE_TIMEOUT: Duration = Duration::from_secs(2);

async fn resolve_user_with_timeout(
    state: &Arc<BotState>,
    telegram_id: &str,
) -> anyhow::Result<UserId> {
    timeout(
        SERVICE_TIMEOUT,
        state.user_resolution.resolve_telegram_user(telegram_id),
    )
    .await
    .context("User resolution timeout")?
    .map_err(|e| anyhow::anyhow!(e))
}

async fn send_telegram_message_with_timeout(
    state: &Arc<BotState>,
    chat_id: i64,
    text: String,
    keyboard: Option<serde_json::Value>,
) -> anyhow::Result<()> {
    timeout(
        SERVICE_TIMEOUT,
        state
            .notification_service
            .send_telegram_message(chat_id, text, keyboard),
    )
    .await
    .context("Send message timeout")?
    .map_err(|e| anyhow::anyhow!(e))
}

pub async fn handle_poker_command(ctx: &RequestContext, state: &Arc<BotState>, message: &Message) {
    let chat_id = message.chat.id;
    let telegram_user_id = match message.from.as_ref().map(|u| u.id.0.to_string()) {
        Some(id) => id,
        None => {
            error!(request_id = %ctx.request_id, "Message has no sender");
            let _ = send_telegram_message_with_timeout(
                state,
                chat_id.0,
                "❌ Could not identify sender.".to_string(),
                None,
            )
            .await;
            return;
        }
    };

    let user_id = match resolve_user_with_timeout(state, &telegram_user_id).await {
        Ok(uid) => uid,
        Err(e) => {
            error!(request_id = %ctx.request_id, error = %e, "User resolution failed");
            let _ = send_telegram_message_with_timeout(
                state,
                chat_id.0,
                "❌ Could not identify you. Please start the bot in private first.".to_string(),
                None,
            )
            .await;
            return;
        }
    };

    let ctx_with_user = RequestContext::new(ctx.request_id, Some(user_id));

    CreateTableInput {
        table_config: table_config,
        players: players,
        created_by: message.from.as_ref().map(|user| user.id.into()).unwrap_or(0.into()),
        telegram_chat_id: Some(message.chat.id.to_string()),
    }

    let table_id = match timeout(
        SERVICE_TIMEOUT,
        state.table_service.create_table(&ctx_with_user, input),
    )
    .await
    {
        Ok(Ok(id)) => id,
        Ok(Err(e)) => {
            error!(request_id = %ctx_with_user.request_id, user_id = %user_id, error = %e, "Table creation failed");
            let _ = send_telegram_message_with_timeout(
                state,
                chat_id.0,
                "❌ Failed to create table. Try again later.".to_string(),
                None,
            )
            .await;
            return;
        }
        Err(_) => {
            error!(request_id = %ctx_with_user.request_id, user_id = %user_id, "Table creation timeout");
            let _ = send_telegram_message_with_timeout(
                state,
                chat_id.0,
                "❌ Service timeout. Please try again.".to_string(),
                None,
            )
            .await;
            return;
        }
    };

    let join_button =
        InlineKeyboardButton::callback("🎲 Join Table", format!("join_{}", table_id.as_uuid()));
    let keyboard = InlineKeyboardMarkup::new(vec![vec![join_button]]);
    let keyboard_value = match serde_json::to_value(keyboard) {
        Ok(v) => Some(v),
        Err(e) => {
            error!(request_id = %ctx_with_user.request_id, user_id = %user_id, error = %e, "Keyboard serialization failed");
            None
        }
    };
    let text = format!(
        "🎰 New poker table created!\nTable ID: `{}`\nClick below to join:",
        table_id.as_uuid()
    );

    if let Err(e) = send_telegram_message_with_timeout(state, chat_id.0, text, keyboard_value).await
    {
        error!(request_id = %ctx_with_user.request_id, user_id = %user_id, error = %e, "Failed to send message");
    } else {
        info!(request_id = %ctx_with_user.request_id, user_id = %user_id, table_id = %table_id, "Table created and notification sent");
    }
}

pub async fn handle_challenge_command(
    ctx: &RequestContext,
    state: &Arc<BotState>,
    message: &Message,
) {
    let chat_id = message.chat.id;
    let text = message.text().unwrap_or("");
    let parts: Vec<&str> = text.split_whitespace().collect();
    let challenged_username = parts.iter().find(|p| p.starts_with('@')).map(|p| &p[1..]);

    let challenger_telegram = message.from.as_ref().and_then(|u| u.username.clone());
    let challenged_telegram = challenged_username.map(|s| s.to_string());

    if challenged_telegram.is_none() {
        let _ = send_telegram_message_with_timeout(
            state,
            chat_id.0,
            "Usage: /challenge @username".to_string(),
            None,
        )
        .await;
        return;
    }

    let challenger_id =
        match resolve_user_with_timeout(state, &challenger_telegram.unwrap_or_default()).await {
            Ok(uid) => uid,
            Err(e) => {
                error!(request_id = %ctx.request_id, error = %e, "Challenger resolve failed");
                let _ = send_telegram_message_with_timeout(
                    state,
                    chat_id.0,
                    "❌ Could not identify you.".to_string(),
                    None,
                )
                .await;
                return;
            }
        };
    let challenged_id =
        match resolve_user_with_timeout(state, challenged_telegram.as_ref().unwrap()).await {
            Ok(uid) => uid,
            Err(e) => {
                error!(request_id = %ctx.request_id, error = %e, "Challenged resolve failed");
                let _ = send_telegram_message_with_timeout(
                    state,
                    chat_id.0,
                    format!("❌ User @{} not found.", challenged_telegram.unwrap()),
                    None,
                )
                .await;
                return;
            }
        };

    let ctx_with_user = RequestContext::new(ctx.request_id, Some(challenger_id));

    CreateTableInput {
        table_config: table_config,
        players: players,
        created_by: message.from.as_ref().map(|user| user.id.into()).unwrap_or(0.into()),
        telegram_chat_id: Some(message.chat.id.to_string()),
    }

    let table_id = match timeout(
        SERVICE_TIMEOUT,
        state.table_service.create_table(&ctx_with_user, input),
    )
    .await
    {
        Ok(Ok(id)) => id,
        Ok(Err(e)) => {
            error!(request_id = %ctx_with_user.request_id, user_id = %challenger_id, error = %e, "Challenge table creation failed");
            let _ = send_telegram_message_with_timeout(
                state,
                chat_id.0,
                "❌ Failed to create heads-up table.".to_string(),
                None,
            )
            .await;
            return;
        }
        Err(_) => {
            error!(request_id = %ctx_with_user.request_id, user_id = %challenger_id, "Challenge table creation timeout");
            let _ = send_telegram_message_with_timeout(
                state,
                chat_id.0,
                "❌ Service timeout. Try again.".to_string(),
                None,
            )
            .await;
            return;
        }
    };

    let deep_link = format!("{}{}", state.mini_app_url, table_id.as_uuid());
    let message_text = format!(
        "🏆 Challenge accepted! Play heads-up: [Join table]({})",
        deep_link
    );
    let f1 = send_telegram_message_with_timeout(state, chat_id.0, message_text.clone(), None);
    let f2 = state.notification_service.send_telegram_message_to_user(
        challenged_id,
        message_text.clone(),
        None,
    );
    let f3 =
        state
            .notification_service
            .send_telegram_message_to_user(challenger_id, message_text, None);
    let _ = futures::join!(f1, f2, f3);
    info!(request_id = %ctx_with_user.request_id, user_id = %challenger_id, table_id = %table_id, challenged = %challenged_id, "Challenge table created");
}

pub async fn handle_callback_query(
    ctx: &RequestContext,
    state: &Arc<BotState>,
    callback: &CallbackQuery,
) {
    let data = match &callback.data {
        Some(d) => d.clone(),
        None => return,
    };
    if !data.starts_with("join_") {
        return;
    }
    let table_id_str = data.trim_start_matches("join_");
    let table_id = match table_id_str.parse::<TableId>() {
        Ok(id) => id,
        Err(_) => {
            warn!(request_id = %ctx.request_id, "Invalid table id in callback: {}", table_id_str);
            return;
        }
    };

    let telegram_user_id = callback.from.id.0.to_string();
    let user_id = match resolve_user_with_timeout(state, &telegram_user_id).await {
        Ok(uid) => uid,
        Err(e) => {
            error!(request_id = %ctx.request_id, error = %e, "Callback user resolve failed");
            if let Some(msg) = &callback.message {
                let chat_id = msg.chat().id;
                let _ = send_telegram_message_with_timeout(
                    state,
                    chat_id.0,
                    "❌ Please start the bot in private first.".to_string(),
                    None,
                )
                .await;
            }
            return;
        }
    };

    let ctx_with_user = RequestContext::new(ctx.request_id, Some(user_id));
    let deep_link = format!("{}{}", state.mini_app_url, table_id.as_uuid());
    let reply_text = format!("🎮 Click to join the table: [Open Mini App]({})", deep_link);

    if let Some(msg) = &callback.message {
        let chat_id = msg.chat().id;
        let _ = send_telegram_message_with_timeout(state, chat_id.0, reply_text, None).await;
    }
    let _ = state
        .notification_service
        .answer_callback_query(callback.id.to_string(), None)
        .await;
    info!(request_id = %ctx_with_user.request_id, user_id = %user_id, table_id = %table_id, "Callback handled");
}
