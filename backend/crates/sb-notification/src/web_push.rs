use anyhow::Result;
use sb_db_entities::push_subscription::Model;
use std::io::Cursor;
use web_push::WebPushError;
use web_push::*;

pub struct WebPushSender {
    client: IsahcWebPushClient,
    private_key_pem: String,
    subject: String,
}

pub enum SendOutcome {
    Delivered,
    Gone,
}

impl WebPushSender {
    pub fn new(private_key_pem: String, subject: String) -> Result<Self> {
        Ok(Self {
            client: IsahcWebPushClient::new()?,
            private_key_pem,
            subject,
        })
    }

    pub async fn send(&self, sub: &Model, payload: String) -> Result<SendOutcome> {
        let subscription = SubscriptionInfo::new(&sub.endpoint, &sub.p256dh, &sub.auth);

        let mut sig_builder = VapidSignatureBuilder::from_pem(
            Cursor::new(self.private_key_pem.as_bytes()),
            &subscription,
        )?;
        sig_builder.add_claim("sub", self.subject.as_str());
        let signature = sig_builder.build()?;

        let mut builder = WebPushMessageBuilder::new(&subscription);
        builder.set_payload(ContentEncoding::Aes128Gcm, payload.as_bytes());
        builder.set_vapid_signature(signature);

        let message = builder.build()?;

        match self.client.send(message).await {
            Ok(_) => Ok(SendOutcome::Delivered),
            Err(WebPushError::EndpointNotValid(_)) | Err(WebPushError::EndpointNotFound(_)) => {
                Ok(SendOutcome::Gone)
            }
            Err(e) => Err(e.into()),
        }
    }
}
