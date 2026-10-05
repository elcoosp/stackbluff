use crate::config::PaymentConfig;
use crate::db::PaymentRepo;
use async_trait::async_trait;
use sb_contracts::service_api::{PaymentService, UserService};
use sb_shared_types::{AppError, ChipAmount, UserId};
use sea_orm::DatabaseConnection;
use std::collections::HashMap;
use std::sync::Arc;
use tracing::{info, warn};
use uuid::Uuid;

use stripe::Client;
use stripe_checkout::CheckoutSessionMode;
use stripe_checkout::checkout_session::{
    CreateCheckoutSession, CreateCheckoutSessionLineItems, CreateCheckoutSessionLineItemsPriceData,
    CreateCheckoutSessionPaymentMethodTypes, ProductData,
};
use stripe_types::Currency;

/// Stripe expects amounts in the smallest currency unit (e.g., cents for USD).
/// We treat 1 chip = 1 cent, so multiply by 100 for Stripe.
const CHIP_TO_CENT_MULTIPLIER: i64 = 100;

pub struct RealPaymentService {
    pub db: DatabaseConnection,
    stripe_client: Client,
    pub user_service: Arc<dyn UserService>,
    config: PaymentConfig,
}

impl RealPaymentService {
    /// P-3 FIX: atomic "confirm this payment once" entry point used by the
    /// webhooks. Returns `true` only when THIS call performed the transition
    /// `pending -> succeeded`; retries see `false` and must skip awarding.
    pub async fn confirm_payment_idempotent(
        &self,
        payment_id: &str,
        completed_at: Option<chrono::DateTime<chrono::Utc>>,
    ) -> Result<bool, AppError> {
        crate::db::PaymentRepo::try_mark_succeeded(&self.db, payment_id, completed_at).await
    }

    pub fn new(
        db: DatabaseConnection,
        stripe_secret_key: String,
        user_service: Arc<dyn UserService>,
        config: PaymentConfig,
    ) -> Self {
        Self {
            db,
            stripe_client: Client::new(stripe_secret_key),
            user_service,
            config,
        }
    }
}

fn currency_from_str(s: &str) -> Result<Currency, AppError> {
    s.parse::<Currency>()
        .map_err(|_| AppError::InvalidInput("Unsupported currency".into()))
}

#[async_trait]
impl PaymentService for RealPaymentService {
    async fn create_intent(
        &self,
        user_id: UserId,
        amount: ChipAmount,
        currency: String,
        provider: String,
        metadata: serde_json::Value,
    ) -> Result<String, AppError> {
        // Check platform first - only PWA users need email verification
        let profile = self.user_service.get_user_profile(user_id).await?;
        if profile.platform == "pwa" {
            let is_verified = self.user_service.is_email_verified(user_id).await?;
            if !is_verified {
                return Err(AppError::Forbidden(
                    "Please verify your email address before making a purchase.".to_string(),
                ));
            }
        }

        match provider.as_str() {
            "stripe" => {
                let currency_enum = currency_from_str(&currency)?;
                let mut metadata_map: HashMap<String, String> =
                    serde_json::from_value(metadata).unwrap_or_default();
                metadata_map.insert("user_id".to_string(), user_id.as_uuid().to_string());

                let amount_cents = amount.as_i64() * CHIP_TO_CENT_MULTIPLIER;

                let product_data = ProductData::new("Chip Purchase");
                let price_data = CreateCheckoutSessionLineItemsPriceData {
                    currency: currency_enum.clone(),
                    product_data: Some(product_data),
                    unit_amount: Some(amount_cents),
                    product: None,
                    recurring: None,
                    tax_behavior: None,
                    unit_amount_decimal: None,
                };
                let line_item = CreateCheckoutSessionLineItems {
                    price_data: Some(price_data),
                    quantity: Some(1),
                    adjustable_quantity: None,
                    dynamic_tax_rates: None,
                    metadata: None,
                    price: None,
                    tax_rates: None,
                };

                let metadata_for_session = metadata_map.clone();
                let session = CreateCheckoutSession::new()
                    .success_url(&self.config.stripe_success_url)
                    .cancel_url(&self.config.stripe_cancel_url)
                    .payment_method_types(vec![CreateCheckoutSessionPaymentMethodTypes::Card])
                    .mode(CheckoutSessionMode::Payment)
                    .line_items(vec![line_item])
                    .metadata(metadata_for_session)
                    .send(&self.stripe_client)
                    .await
                    .map_err(|e| AppError::External(e.to_string()))?;

                let payment_id = session.id.clone();
                let client_secret = session
                    .client_secret
                    .ok_or_else(|| AppError::Internal("No client secret".into()))?;
                let checkout_url = session.url.clone();

                PaymentRepo::insert_pending(
                    &self.db,
                    &payment_id,
                    user_id.as_uuid(),
                    amount.as_i64(),
                    &currency_enum.to_string(),
                    "stripe",
                    serde_json::to_value(&metadata_map).unwrap_or_default(),
                )
                .await?;

                info!(
                    payment_id = %payment_id,
                    user_id = %user_id.as_uuid(),
                    chips = amount.as_i64(),
                    cents = amount_cents,
                    "Created Stripe Checkout Session and pending record"
                );

                Ok(serde_json::json!({
                    "client_secret": client_secret,
                    "checkout_url": checkout_url
                })
                .to_string())
            }
            "telegram_stars" => {
                // P-4 FIX: the previous implementation returned a fake URL
                // of the form `https://t.me/<bot_token>/stars?amount=...`
                // — which is not a valid Telegram payments URL, and worse,
                // embedded the FULL bot token in the client response. A
                // single user inspecting the JSON got complete control of
                // the bot (message send, invoice creation, …).
                //
                // Proper support requires calling the Bot API
                // `createInvoiceLink` server-side and storing the returned
                // invoice id on the payment row, plus a real webhook flow
                // (see P-2). Reject explicitly until that is built.
                let _ = user_id;
                let _ = amount;
                let _ = currency;
                Err(AppError::Internal(
                    "Telegram Stars checkout is not yet implemented; \
                     please use Stripe for now"
                        .into(),
                ))
            }
            _ => Err(AppError::InvalidInput("Unsupported provider".into())),
        }
    }

    async fn create_product_purchase(
        &self,
        user_id: UserId,
        product_id: Uuid,
        provider: String,
        metadata: serde_json::Value,
    ) -> Result<String, AppError> {
        use sb_db_entities::products;
        use sea_orm::{ColumnTrait, EntityTrait, QueryFilter};

        let product = products::Entity::find()
            .filter(products::Column::Id.eq(product_id))
            .one(&self.db)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?
            .ok_or_else(|| AppError::NotFound("Product not found".into()))?;

        // P-1 FIX:
        //  * `product.price` is stored in CENTS already (499 = €4.99). The
        //    old code treated it as a chip amount and multiplied by 100
        //    inside `create_intent`, charging 100x the advertised price.
        //  * The advertised chip grant lives in `product.metadata["chips"]`,
        //    not in the price. The old flow derived chips from
        //    `amount_cents / 100`, awarding `price/100` chips.
        //
        // This rewrite bypasses `create_intent` and passes `product.price`
        // as `unit_amount` directly, and stores the chip grant in both the
        // pending payment record and the Stripe session metadata so the
        // webhook can use it.
        let chips_amount: i64 = product
            .metadata
            .get("chips")
            .and_then(|v| v.as_i64())
            .unwrap_or(0);
        let duration_days: i64 = product
            .metadata
            .get("duration_days")
            .and_then(|v| v.as_i64())
            .unwrap_or(0);
        let currency = product.currency.clone();

        let mut meta: serde_json::Value = metadata;
        meta["product_id"] = serde_json::to_value(product_id).unwrap_or_default();
        meta["product_type"] = serde_json::to_value(product.product_type.clone()).unwrap_or_default();
        meta["chips"] = serde_json::json!(chips_amount);
        meta["duration_days"] = serde_json::json!(duration_days);

        match provider.as_str() {
            "stripe" => {
                let currency_enum = currency_from_str(&currency)?;

                // Metadata for Stripe must be HashMap<String, String>.
                let mut metadata_map: HashMap<String, String> = HashMap::new();
                metadata_map.insert("user_id".into(), user_id.as_uuid().to_string());
                metadata_map.insert("product_id".into(), product_id.to_string());
                metadata_map.insert("product_type".into(), product.product_type.clone());
                metadata_map.insert("chips".into(), chips_amount.to_string());
                metadata_map.insert("duration_days".into(), duration_days.to_string());

                // P-1 FIX: cents directly — no multiply.
                let amount_cents: i64 = product.price;

                let product_data = ProductData::new(product.name.clone());
                let price_data = CreateCheckoutSessionLineItemsPriceData {
                    currency: currency_enum.clone(),
                    product_data: Some(product_data),
                    unit_amount: Some(amount_cents),
                    product: None,
                    recurring: None,
                    tax_behavior: None,
                    unit_amount_decimal: None,
                };
                let line_item = CreateCheckoutSessionLineItems {
                    price_data: Some(price_data),
                    quantity: Some(1),
                    adjustable_quantity: None,
                    dynamic_tax_rates: None,
                    metadata: None,
                    price: None,
                    tax_rates: None,
                };

                let session = CreateCheckoutSession::new()
                    .success_url(&self.config.stripe_success_url)
                    .cancel_url(&self.config.stripe_cancel_url)
                    .payment_method_types(vec![CreateCheckoutSessionPaymentMethodTypes::Card])
                    .mode(CheckoutSessionMode::Payment)
                    .line_items(vec![line_item])
                    .metadata(metadata_map.clone())
                    .send(&self.stripe_client)
                    .await
                    .map_err(|e| AppError::External(e.to_string()))?;

                let payment_id = session.id.clone();
                let client_secret = session
                    .client_secret
                    .ok_or_else(|| AppError::Internal("No client secret".into()))?;
                let checkout_url = session.url.clone();

                // Store the CHIPS amount (not the price) in `amount` so the
                // confirmation path can award the correct quantity even for
                // legacy rows created before this fix.
                PaymentRepo::insert_pending(
                    &self.db,
                    &payment_id,
                    user_id.as_uuid(),
                    chips_amount,
                    &currency_enum.to_string(),
                    "stripe",
                    serde_json::to_value(&metadata_map).unwrap_or_default(),
                )
                .await?;

                info!(
                    payment_id = %payment_id,
                    user_id = %user_id.as_uuid(),
                    chips = chips_amount,
                    cents = amount_cents,
                    product_id = %product_id,
                    "Created Stripe Checkout Session for product"
                );

                Ok(serde_json::json!({
                    "client_secret": client_secret,
                    "checkout_url": checkout_url
                })
                .to_string())
            }
            "telegram_stars" => {
                // Telegram Stars has its own price column (`stars_price`).
                // Defer to create_intent for the shape; the whole path is
                // currently broken by P-2 and is slated for a full rewrite.
                let stars = product.stars_price as i64;
                let amount = ChipAmount::new(stars)
                    .ok_or_else(|| AppError::InvalidInput("Invalid stars price".into()))?;
                self.create_intent(user_id, amount, currency, provider, meta)
                    .await
            }
            _ => Err(AppError::InvalidInput("Unsupported provider".into())),
        }
    }

    async fn confirm_payment(
        &self,
        payment_id: &str,
        provider: &str,
        status: &str,
        completed_at: Option<chrono::DateTime<chrono::Utc>>,
    ) -> Result<(), AppError> {
        let existing = PaymentRepo::find_by_payment_id(&self.db, payment_id).await?;
        match existing {
            Some(existing) => {
                if existing.status == "succeeded" {
                    warn!(payment_id = %payment_id, "Duplicate confirmation ignored");
                    return Ok(());
                }
                if existing.status == "failed" || existing.status == "expired" {
                    return Err(AppError::Conflict("Payment already failed/expired".into()));
                }
                PaymentRepo::update_status(&self.db, payment_id, status, completed_at).await?;
                info!(payment_id = %payment_id, status = %status, "Payment confirmed");
            }
            None => {
                warn!(payment_id = %payment_id, "Confirming unknown payment – missing pending record");
                PaymentRepo::insert_pending(
                    &self.db,
                    payment_id,
                    Uuid::nil(),
                    0,
                    "",
                    provider,
                    serde_json::Value::Null,
                )
                .await?;
                PaymentRepo::update_status(&self.db, payment_id, status, completed_at).await?;
            }
        }
        Ok(())
    }

    async fn award_chips_on_success(
        &self,
        user_id: UserId,
        amount: ChipAmount,
    ) -> Result<(), AppError> {
        self.user_service.award_chips(user_id, amount).await
    }
}
