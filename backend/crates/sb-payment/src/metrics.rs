use lazy_static::lazy_static;
use prometheus::{Counter, HistogramVec, register_counter, register_histogram_vec};

lazy_static! {
    pub static ref WEBHOOK_COUNTER: Counter = register_counter!(
        "payment_webhook_total",
        "Total number of webhook events processed"
    )
    .unwrap();
    pub static ref WEBHOOK_FAILURES: Counter = register_counter!(
        "payment_webhook_errors_total",
        "Total number of webhook processing failures"
    )
    .unwrap();
    pub static ref PAYMENT_CONFIRMATION_DURATION: HistogramVec = register_histogram_vec!(
        "payment_confirmation_duration_seconds",
        "Time taken to confirm a payment",
        &["provider"]
    )
    .unwrap();
}

pub fn record_webhook_success() {
    WEBHOOK_COUNTER.inc();
}

pub fn record_webhook_failure() {
    WEBHOOK_FAILURES.inc();
}

pub fn record_confirmation_duration(provider: &str, duration: std::time::Duration) {
    PAYMENT_CONFIRMATION_DURATION
        .with_label_values(&[provider])
        .observe(duration.as_secs_f64());
}
