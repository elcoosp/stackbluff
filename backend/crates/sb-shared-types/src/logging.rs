#[macro_export]
macro_rules! sb_log {
    (info, $ctx:expr, $($arg:tt)*) => {
        tracing::info!(
            request_id = %$ctx.request_id,
            user_id = ?$ctx.user_id,
            $($arg)*
        )
    };
    (error, $ctx:expr, $($arg:tt)*) => {
        tracing::error!(
            request_id = %$ctx.request_id,
            user_id = ?$ctx.user_id,
            $($arg)*
        )
    };
    (warn, $ctx:expr, $($arg:tt)*) => {
        tracing::warn!(
            request_id = %$ctx.request_id,
            user_id = ?$ctx.user_id,
            $($arg)*
        )
    };
    (debug, $ctx:expr, $($arg:tt)*) => {
        tracing::debug!(
            request_id = %$ctx.request_id,
            user_id = ?$ctx.user_id,
            $($arg)*
        )
    };
}
