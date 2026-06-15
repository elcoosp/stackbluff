# Stage all changes across frontend and backend
git add .

# Commit with a descriptive message
git commit -m "feat: wire up auth routes, fix CORS, and repair DB entities/migrations

- Frontend: Fix canContinue logic to validate schema instead of just non-empty, fix getErrorMessage typo
- Server: Add CORS layer, initialize writer loop, wire up sb-auth router
- Server: Add sb-auth and sb-db-repos dependencies to Cargo.toml
- DB Repos: Fix PersistenceError variants, add missing trait methods, add 100ms flush interval to writer loop
- DB Repos: Fix malformed match arms and add explicit type annotations for SeaORM queries
- DB Entities: Expose all modules in lib.rs, fix `use super::` imports to `use crate::enums::` / `use crate::hand_history_json::`
- DB Entities: Add `registration_order` field to User model
- Migrations: Register all missing migrations in Migrator
- Migrations: Fix enum imports and type annotations in create_all_tables
- Migrations: Fix SQLite syntax error in payment_intents index
- Migrations: Fix table name from 'user' to 'users' in registration_order migration
- Migrations: Fix drop_index syntax in add_referrer_id_index"
