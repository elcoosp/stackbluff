//! In-memory service stubs for testing only.
//! Conditionally compiled under the "test-stubs" feature flag.

#[cfg(feature = "test-stubs")]
pub mod notification_service;
#[cfg(feature = "test-stubs")]
pub mod table_service;
#[cfg(feature = "test-stubs")]
pub mod user_resolution_service;
