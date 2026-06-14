#[macro_export]
macro_rules! counter {
    ($name:expr, $value:expr) => {
        tracing::info!(target: "metrics", metric = $name, value = $value, "metric")
    };
}
pub use counter;
