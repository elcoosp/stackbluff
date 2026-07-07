use crate::email::EmailService;
use std::sync::Arc;
use tokio::sync::mpsc;
use tracing::{error, info};

#[derive(Debug)]
pub enum EmailJob {
    Verification { to: String, token: String },
    PasswordReset { to: String, token: String },
}

pub struct EmailQueue {
    sender: mpsc::UnboundedSender<EmailJob>,
}

impl EmailQueue {
    pub fn new(email_service: Arc<EmailService>) -> Self {
        let (sender, receiver) = mpsc::unbounded_channel();

        // Spawn background task to process emails
        tokio::spawn(async move {
            Self::process_emails(receiver, email_service).await;
        });

        Self { sender }
    }

    #[tracing::instrument(skip(self, token), fields(email = to))]
    pub fn queue_verification_email(&self, to: String, token: String) {
        if let Err(e) = self.sender.send(EmailJob::Verification { to, token }) {
            error!("Failed to queue verification email: {}", e);
        }
    }

    #[tracing::instrument(skip(self, token), fields(email = to))]
    pub fn queue_password_reset_email(&self, to: String, token: String) {
        if let Err(e) = self.sender.send(EmailJob::PasswordReset { to, token }) {
            error!("Failed to queue password reset email: {}", e);
        }
    }

    async fn process_emails(
    mut receiver: mpsc::UnboundedReceiver<EmailJob>,
    email_service: Arc<EmailService>,
) {
    info!("Email queue processor started");
    while let Some(job) = receiver.recv().await {
        match job {
            EmailJob::Verification { to, token } => {
                info!("Processing verification email for {}", to);
                let mut attempts = 0;
                while attempts < 3 {
                    match email_service.send_verification_email(&to, &token).await {
                        Ok(()) => break,
                        Err(e) => {
                            attempts += 1;
                            let delay = tokio::time::Duration::from_secs(2_u64.pow(attempts));
                            error!("Failed to send verification email to {} (attempt {}): {}", to, attempts, e);
                            if attempts < 3 {
                                tokio::time::sleep(delay).await;
                            }
                        }
                    }
                }
            }
            EmailJob::PasswordReset { to, token } => {
                info!("Processing password reset email for {}", to);
                let mut attempts = 0;
                while attempts < 3 {
                    match email_service.send_password_reset_email(&to, &token).await {
                        Ok(()) => break,
                        Err(e) => {
                            attempts += 1;
                            let delay = tokio::time::Duration::from_secs(2_u64.pow(attempts));
                            error!("Failed to send password reset email to {} (attempt {}): {}", to, attempts, e);
                            if attempts < 3 {
                                tokio::time::sleep(delay).await;
                            }
                        }
                    }
                }
            }
        }
    }
    info!("Email queue processor stopped");
}
}
