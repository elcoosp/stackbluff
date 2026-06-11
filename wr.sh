#!/usr/bin/env bash
set -uo pipefail

COMPILE_OK=true
INCOMPLETE=false

BASE="tools/sbdc"

echo "Adding missing PaginatorTrait import to server_tests.rs"
OLD_TMP=$(mktemp) || { echo "ERROR: cannot create temp file"; exit 1; }
NEW_TMP=$(mktemp)
cat > "$OLD_TMP" << 'OLD_IMPORT_M2vP8'
    use sea_orm::{ColumnTrait, ConnectionTrait, Database, DatabaseConnection, EntityTrait, QueryFilter};
OLD_IMPORT_M2vP8
cat > "$NEW_TMP" << 'NEW_IMPORT_K7nR3'
    use sea_orm::{ColumnTrait, ConnectionTrait, Database, DatabaseConnection, EntityTrait, PaginatorTrait, QueryFilter};
NEW_IMPORT_K7nR3
if python3 - "$OLD_TMP" "$NEW_TMP" "$BASE/sbdc-service/src/server_tests.rs" << 'PYEOF_IMPORT'
import sys
with open(sys.argv[1], 'r') as f: old = f.read()
with open(sys.argv[2], 'r') as f: new = f.read()
with open(sys.argv[3], 'r') as f: content = f.read()
content = content.replace(old, new)
with open(sys.argv[3], 'w') as f: f.write(content)
PYEOF_IMPORT
then
  echo "Added PaginatorTrait import"
  rm "$OLD_TMP" "$NEW_TMP"
else
  echo "ERROR: Python patch failed for PaginatorTrait import"
  rm -f "$OLD_TMP" "$NEW_TMP"
fi

echo "Checking compilation"
if ! cargo check --workspace --manifest-path "$BASE/Cargo.toml" 2>&1; then
  echo "Compilation failed – will skip commit"
  COMPILE_OK=false
fi

if [ "$INCOMPLETE" = true ] || [ "$COMPILE_OK" = false ]; then
  echo "Skipping tests and commit due to incomplete files or compilation errors"
  exit 1
fi

echo "Running tests"
cargo test --workspace --manifest-path "$BASE/Cargo.toml" 2>&1
if [ $? -eq 0 ]; then
  echo "All tests passed. Committing."
  git add -A
  git commit -m "fix(sbdc): add missing PaginatorTrait import to server_tests.rs"
else
  echo "Tests failed. Fix errors then run the next script."
  exit 1
fi
