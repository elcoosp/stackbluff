use teloxide::prelude::*;
use std::env;
use url::Url;

pub async fn setup_webhook() -> Result<(), Box<dyn std::error::Error>> {
    let token = env::var("TELEGRAM_BOT_TOKEN")?;
    let bot = Bot::new(token);
    let webhook_url = env::var("WEBHOOK_URL")?;
    let url = Url::parse(&webhook_url)?;
    bot.set_webhook(url).await?;
    Ok(())
}
