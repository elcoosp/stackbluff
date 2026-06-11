#!/usr/bin/env bash
set -uo pipefail

COMPILE_OK=true
INCOMPLETE=false

REPO_ROOT="$(git rev-parse --show-toplevel)"
BASE="$REPO_ROOT/tools/sbdc"

echo "=== Reading exact content around line 232 of server_tests.rs ==="
sed -n '228,248p' "$BASE/sbdc-service/src/server_tests.rs"

echo ""
echo "=== Surgical fix: add 'let _ =' before the bare start_deck call on line 232 ==="
OLD_TMP=$(mktemp) || { echo "ERROR: cannot create temp file"; exit 1; }
NEW_TMP=$(mktemp)
cat > "$OLD_TMP" << 'OLD_BARE_J7mK3'
        server::start_deck(
            axum::extract::State(state.clone()),
            axum::extract::Path("test-deck".to_string()),
            axum::Json(server::StartRequest {
                takes_per_prompt: Some(1),
            }),
        )
        .await
        .unwrap();

        let next = server::next_prompt(
OLD_BARE_J7mK3
cat > "$NEW_TMP" << 'NEW_LET_P4qW8'
        let _ = server::start_deck(
            axum::extract::State(state.clone()),
            axum::extract::Path("test-deck".to_string()),
            axum::Json(server::StartRequest {
                takes_per_prompt: Some(1),
            }),
        )
        .await
        .unwrap();

        let next = server::next_prompt(
NEW_LET_P4qW8
if python3 - "$OLD_TMP" "$NEW_TMP" "$BASE/sbdc-service/src/server_tests.rs" << 'PYEOF_BARE'
import sys
with open(sys.argv[1], 'r') as f: old = f.read()
with open(sys.argv[2], 'r') as f: new = f.read()
with open(sys.argv[3], 'r') as f: content = f.read()
content = content.replace(old, new)
with open(sys.argv[3], 'w') as f: f.write(content)
PYEOF_BARE
then
  echo "Fixed: bare start_deck → let _ = start_deck"
  rm "$OLD_TMP" "$NEW_TMP"
else
  echo "ERROR: Python patch failed"
  rm -f "$OLD_TMP" "$NEW_TMP"
fi

echo ""
echo "=== Verify no more bare start_deck calls ==="
grep -n "server::start_deck" "$BASE/sbdc-service/src/server_tests.rs"

echo ""
echo "Running clippy"
cargo clippy --workspace --manifest-path "$BASE/Cargo.toml" -- -D warnings 2>&1
CLIPPY_RESULT=$?

echo ""
echo "Running tests"
cargo test --workspace --manifest-path "$BASE/Cargo.toml" 2>&1
TEST_RESULT=$?

if [ $CLIPPY_RESULT -ne 0 ]; then
  COMPILE_OK=false
fi

if [ "$INCOMPLETE" = true ] || [ "$COMPILE_OK" = false ]; then
  echo "Skipping commit due to issues"
  exit 1
fi

if [ $TEST_RESULT -eq 0 ]; then
  echo "All tests passed and clippy clean. Committing."
  git add -A
  git commit -m "fix(sbdc): suppress last unused Json must_use warning in test"
else
  echo "Tests failed."
  exit 1
fi
