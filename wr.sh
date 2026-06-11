#!/usr/bin/env bash
set -uo pipefail

COMPILE_OK=true
INCOMPLETE=false

BASE="tools/sbdc"

echo "Fixing Serve match arm type mismatch — server already returns SbdcResult<()>"
OLD_TMP=$(mktemp) || { echo "ERROR: cannot create temp file"; exit 1; }
NEW_TMP=$(mktemp)
cat > "$OLD_TMP" << 'OLD_SERVE_F7xM2'
        Commands::Serve { port } => sbdc_service::server::run_server(db, cli.project_dir, port).await.map_err(|e| anyhow::anyhow!(e.to_string())),
OLD_SERVE_F7xM2
cat > "$NEW_TMP" << 'NEW_SERVE_K9pW5'
        Commands::Serve { port } => sbdc_service::server::run_server(db, cli.project_dir, port).await,
NEW_SERVE_K9pW5
if python3 - "$OLD_TMP" "$NEW_TMP" "$BASE/sbdc-cli/src/main.rs" << 'PYEOF_FIX'
import sys
with open(sys.argv[1], 'r') as f: old = f.read()
with open(sys.argv[2], 'r') as f: new = f.read()
with open(sys.argv[3], 'r') as f: content = f.read()
content = content.replace(old, new)
with open(sys.argv[3], 'w') as f: f.write(content)
PYEOF_FIX
then
  echo "Fixed Serve arm to return SbdcResult directly"
  rm "$OLD_TMP" "$NEW_TMP"
else
  echo "ERROR: Python patch failed for Serve arm fix"
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
  git commit -m "fix(sbdc): serve arm returns SbdcResult directly, no type mismatch"
else
  echo "Tests failed. Fix errors then run the next script."
  exit 1
fi
