#!/usr/bin/env bash
set -uo pipefail

cd tools/sbdc || { echo "ERROR: cannot cd to tools/sbdc"; exit 1; }

echo "=== Add missing ConnectionTrait import to scaffold.rs ==="

# Add ConnectionTrait to the sea_orm import in scaffold.rs
sed -i '' 's/use sea_orm::{NotSet, ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, Set, TransactionSession, TransactionTrait};/use sea_orm::{NotSet, ActiveModelTrait, ColumnTrait, ConnectionTrait, EntityTrait, QueryFilter, Set, TransactionSession, TransactionTrait};/' sbdc-service/src/scaffold.rs

echo "=== Also ensure ConnectionTrait is imported in generate.rs and clean.rs (for completeness) ==="

# In generate.rs, we don't use ConnectionTrait directly but it may be needed via traits. Add anyway.
sed -i '' 's/use sea_orm::{NotSet, ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, Set};/use sea_orm::{NotSet, ActiveModelTrait, ColumnTrait, ConnectionTrait, EntityTrait, QueryFilter, Set};/' sbdc-service/src/generate.rs

# In clean.rs
sed -i '' 's/use sea_orm::{ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, Set};/use sea_orm::{ActiveModelTrait, ColumnTrait, ConnectionTrait, EntityTrait, QueryFilter, Set};/' sbdc-service/src/clean.rs

echo "=== Re-run tests ==="

if cargo test --workspace -- --nocapture 2>&1; then
  echo "All tests passed"
  COMPILE_OK=true
else
  echo "Tests still failing"
  COMPILE_OK=false
fi

if [ "$COMPILE_OK" = true ]; then
  echo "All fixes applied. Committing."
  git add -A
  git commit -m "fix: add missing ConnectionTrait import in scaffold, generate, clean"
fi

exit 0
