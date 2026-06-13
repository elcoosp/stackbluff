use crate::types::BotState;
use sb_shared_types::request_context::RequestContext;
use sb_shared_types::ids::{UserId, TableId};
use sb_contracts::service_api::CreateTableInput;
use teloxide::types::{Message, CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton};
use std::sync::Arc;
use tracing::{info, error, warn};

pub async fn handle_poker_command(
    ctx: &RequestContext,
    state: &Arc<BotState>,
    message: &Message,
) {
    let chat_id = message.chat.id;
    let telegram_user_id = message.from().map(|u| u.id.0.to_string());

    let user_id = match resolve_user(state, telegram_user_id.as_deref()).await {
        Ok(uid) => uid,
        Err(e) => {
            error!(request_id = %ctx.request_id, "User resolution failed: {}", e);
            let _ = state.notification_service.send_telegram_message(chat_id.0, "❌ Could not identify you. Please start the bot in private first.".to_string(), None).await;
            return;
        }
    };

    let input = CreateTableInput {
        name: format!("Poker table from group {}", chat_id.0),
        stake_level: sb_shared_types::game_types::StakeLevel::Micro,
        variant: sb_shared_types::game_types::GameVariant::TexasHoldem,
        created_by: user_id,
        is_private: false,
        invited_users: vec![],
    };

    let table_id = match state.table_service.create_table(ctx, input).await {
        Ok(id) => id,
        Err(e) => {
            error!(request_id = %ctx.request_id, "Table creation failed: {}", e);
            let _ = state.notification_service.send_telegram_message(chat_id.0, "❌ Failed to create table. Try again later.".to_string(), None).await;
            return;
        }
    };

    let join_button = InlineKeyboardButton::callback("🎲 Join Table", format!("join_{}", table_id.as_uuid()));
    let keyboard = InlineKeyboardMarkup::new(vec![vec![join_button]]);
    let text = format!("🎰 New poker table created!\nTable ID: `{}`\nClick below to join:", table_id.as_uuid());

    if let Err(e) = state.notification_service.send_telegram_message(chat_id.0, text, Some(serde_json::to_value(keyboard).unwrap())).await {
        error!(request_id = %ctx.request_id, "Failed to send telegram message: {}", e);
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

    let challenger_telegram = message.from().and_then(|u| u.username.clone());
    let challenged_telegram = challenged_username.map(|s| s.to_string());

    if challenged_telegram.is_none() {
        let _ = state.notification_service.send_telegram_message(chat_id.0, "Usage: /challenge @username".to_string(), None).await;
        return;
    }

    let challenger_id = match resolve_user(state, challenger_telegram.as_deref()).await {
        Ok(uid) => uid,
        Err(e) => {
            error!(request_id = %ctx.request_id, "Challenger resolve failed: {}", e);
            let _ = state.notification_service.send_telegram_message(chat_id.0, "❌ Could not identify you.".to_string(), None).await;
            return;
        }
    };
    let challenged_id = match resolve_user(state, Some(&challenged_telegram.as_ref().unwrap())).await {
        Ok(uid) => uid,
        Err(e) => {
            error!(request_id = %ctx.request_id, "Challenged resolve failed: {}", e);
            let _ = state.notification_service.send_telegram_message(chat_id.0, format!("❌ User @{} not found.", challenged_telegram.unwrap()), None).await;
            return;
        }
    };

    let input = CreateTableInput {
        name: format!("Heads-up: {} vs {}", challenger_id, challenged_id),
        stake_level: sb_shared_types::game_types::StakeLevel::Micro,
        variant: sb_shared_types::game_types::GameVariant::TexasHoldem,
        created_by: challenger_id,
        is_private: true,
        invited_users: vec![challenger_id, challenged_id],
    };

    let table_id = match state.table_service.create_table(ctx, input).await {
        Ok(id) => id,
        Err(e) => {
            error!(request_id = %ctx.request_id, "Challenge table creation failed: {}", e);
            let _ = state.notification_service.send_telegram_message(chat_id.0, "❌ Failed to create heads-up table.".to_string(), None).await;
            return;
        }
    };

    let deep_link = format!("{}{}", state.mini_app_url, table_id.as_uuid());
    let message_text = format!("🏆 Challenge accepted! Play heads-up: [Join table]({})", deep_link);
    if let Err(e) = state.notification_service.send_telegram_message_to_user(challenger_id, message_text.clone(), None).await {
        error!(request_id = %ctx.request_id, "Failed to notify challenger: {}", e);
    }
    if let Err(e) = state.notification_service.send_telegram_message_to_user(challenged_id, message_text, None).await {
        error!(request_id = %ctx.request_id, "Failed to notify challenged: {}", e);
    }
}

pub async fn handle_callback_query(
    ctx: &RequestContext,
    state: &Arc<BotState>,
    callback: CallbackQuery,
) {
    let data = match callback.data {
        Some(d) => d,
        None => return,
    };
    if !data.starts_with("join_") {
        return;
    }
    let table_id_str = data.trim_start_matches("join_");
    let table_id = match TableId::from_str(table_id_str) {
        Ok(id) => id,
        Err(_) => {
            warn!(request_id = %ctx.request_id, "Invalid table id in callback: {}", table_id_str);
            return;
        }
    };

    let telegram_user_id = callback.from.id.0.to_string();
    let user_id = match resolve_user(state, Some(&telegram_user_id)).await {
        Ok(uid) => uid,
        Err(e) => {
            error!(request_id = %ctx.request_id, "Callback user resolve failed: {}", e);
            if let Some(msg) = callback.message {
                let _ = state.notification_service.send_telegram_message(msg.chat.id.0, "❌ Please start the bot in private first.".to_string(), None).await;
            }
            return;
        }
    };

    let deep_link = format!("{}{}", state.mini_app_url, table_id.as_uuid());
    let reply_text = format!("🎮 Click to join the table: [Open Mini App]({})", deep_link);

    if let Some(msg) = callback.message {
        let _ = state.notification_service.send_telegram_message(msg.chat.id.0, reply_text, None).await;
    }
    let _ = state.notification_service.answer_callback_query(callback.id, None).await;
}

async fn resolve_user(state: &Arc<BotState>, telegram_identifier: Option<&str>) -> anyhow::Result<UserId> {
    let ident = telegram_identifier.ok_or_else(|| anyhow::anyhow!("No telegram identifier"))?;
    Ok(state.user_resolution.resolve_telegram_user(ident).await?)
}
