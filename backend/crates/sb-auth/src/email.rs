use crate::config::AuthConfig;
use reqwest::Client;
use serde::Serialize;
use tracing::{error, info};

#[derive(Clone)]
pub struct EmailService {
    client: Client,
    api_key: String,
    from: String,
    app_base_url: String,
}

#[derive(Serialize)]
struct ResendEmailRequest {
    from: String,
    to: String,
    subject: String,
    html: String,
}

impl EmailService {
    pub fn new(config: &AuthConfig) -> Self {
        Self {
            client: Client::new(),
            api_key: config.resend_api_key_str().to_string(),
            from: config.email_from.clone(),
            app_base_url: config.app_base_url.clone(),
        }
    }

    pub async fn send_verification_email(&self, to: &str, token: &str) -> Result<(), String> {
        let verify_url = format!("{}/verify-email?token={}", self.app_base_url, token);
        let html = format!(
            r#"<html><body>
                <h1>Welcome to StackBluff!</h1>
                <p>Please verify your email address by clicking the link below:</p>
                <p><a href="{}">Verify Email</a></p>
                <p>This link will expire in 24 hours.</p>
                <p>If you did not create an account, please ignore this email.</p>
            </body></html>"#,
            verify_url
        );

        self.send_email(to, "Verify your email address", html).await
    }

    pub async fn send_password_reset_email(&self, to: &str, token: &str) -> Result<(), String> {
        let reset_url = format!("{}/reset-password?token={}", self.app_base_url, token);
        let html = format!(
            r#"<html><body>
                <h1>Password Reset Request</h1>
                <p>You requested a password reset. Click the link below to set a new password:</p>
                <p><a href="{}">Reset Password</a></p>
                <p>This link will expire in 1 hour.</p>
                <p>If you did not request a password reset, please ignore this email.</p>
            </body></html>"#,
            reset_url
        );

        self.send_email(to, "Reset your password", html).await
    }

    async fn send_email(&self, to: &str, subject: &str, html: String) -> Result<(), String> {
        if self.api_key.is_empty() {
            error!("Resend API key not configured, skipping email send");
            return Err("Email service not configured".to_string());
        }

        let email_request = ResendEmailRequest {
            from: self.from.clone(),
            to: to.to_string(),
            subject: subject.to_string(),
            html,
        };

        let response = self
            .client
            .post("https://api.resend.com/emails")
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&email_request)
            .send()
            .await
            .map_err(|e| format!("Failed to send email: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            error!(
                "Resend API error: status={}, error={}",
                status, error_text
            );
            return Err(format!("Email send failed with status: {}", status));
        }

        info!("Email sent successfully to {}", to);
        Ok(())
    }
}
