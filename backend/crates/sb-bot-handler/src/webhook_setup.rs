use teloxide::prelude::*;
use std::env;

pub async fn setup_webhook() -> Result<(), Box<dyn std::error::Error>> {
    let token = env::var("TELEGRAM_BOT_TOKEN")?;
    let bot = Bot::new(token);
    let webhook_url = env::var("WEBHOOK_URL")?;
    bot.set_webhook(webhook_url).await?;
    Ok(())
}
