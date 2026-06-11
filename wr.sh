#!/usr/bin/env bash
set -uo pipefail

COMPILE_OK=true
INCOMPLETE=false

REPO_ROOT="$(git rev-parse --show-toplevel)"
BASE="$REPO_ROOT/tools/sbdc"

echo "=== Fix 1: Clippy — double_ended_iterator_last in server.rs ==="
OLD_TMP=$(mktemp) || { echo "ERROR: cannot create temp file"; exit 1; }
NEW_TMP=$(mktemp)
cat > "$OLD_TMP" << 'OLD_LAST_M2vP4'
            img.data.split(',').last().unwrap_or(&img.data)
OLD_LAST_M2vP4
cat > "$NEW_TMP" << 'NEW_LAST_K8nR6'
            img.data.split(',').next_back().unwrap_or(&img.data)
NEW_LAST_K8nR6
if python3 - "$OLD_TMP" "$NEW_TMP" "$BASE/sbdc-service/src/server.rs" << 'PYEOF_LAST'
import sys
with open(sys.argv[1], 'r') as f: old = f.read()
with open(sys.argv[2], 'r') as f: new = f.read()
with open(sys.argv[3], 'r') as f: content = f.read()
content = content.replace(old, new)
with open(sys.argv[3], 'w') as f: f.write(content)
PYEOF_LAST
then
  echo "Fixed: split(',').last() → split(',').next_back()"
  rm "$OLD_TMP" "$NEW_TMP"
else
  echo "ERROR: Python patch failed for last() fix"
  rm -f "$OLD_TMP" "$NEW_TMP"
fi

echo "=== Fix 2: Clippy — io_other_error in server.rs ==="
OLD_TMP=$(mktemp) || { echo "ERROR: cannot create temp file"; exit 1; }
NEW_TMP=$(mktemp)
cat > "$OLD_TMP" << 'OLD_IO_J5wQ9'
        .map_err(|e| SbdcError::Io(std::io::Error::new(std::io::ErrorKind::Other, e)))?;
OLD_IO_J5wQ9
cat > "$NEW_TMP" << 'NEW_IO_P3mL7'
        .map_err(|e| SbdcError::Io(std::io::Error::other(e)))?;
NEW_IO_P3mL7
if python3 - "$OLD_TMP" "$NEW_TMP" "$BASE/sbdc-service/src/server.rs" << 'PYEOF_IO'
import sys
with open(sys.argv[1], 'r') as f: old = f.read()
with open(sys.argv[2], 'r') as f: new = f.read()
with open(sys.argv[3], 'r') as f: content = f.read()
content = content.replace(old, new)
with open(sys.argv[3], 'w') as f: f.write(content)
PYEOF_IO
then
  echo "Fixed: io::Error::new(Other, e) → io::Error::other(e)"
  rm "$OLD_TMP" "$NEW_TMP"
else
  echo "ERROR: Python patch failed for io_other fix"
  rm -f "$OLD_TMP" "$NEW_TMP"
fi

echo "=== Fix 3: Unused Json warning in server_tests.rs ==="
cat "$BASE/sbdc-service/src/server_tests.rs" | grep -n "server::start_deck" | head -10

echo "Checking for the exact pattern around line 232"
sed -n '228,245p' "$BASE/sbdc-service/src/server_tests.rs"

echo "Patching the fourth start_deck call"
OLD_TMP=$(mktemp) || { echo "ERROR: cannot create temp file"; exit 1; }
NEW_TMP=$(mktemp)
cat > "$OLD_TMP" << 'OLD_START_W7tN2'
        server::start_deck(
            axum::extract::State(state.clone()),
            axum::extract::Path("test-deck".to_string()),
            axum::Json(server::StartRequest {
                takes_per_prompt: Some(1),
            }),
        )
        .await
        .unwrap();

        let prompt_count
OLD_START_W7tN2
cat > "$NEW_TMP" << 'NEW_START_F4kR8'
        let _start_result = server::start_deck(
            axum::extract::State(state.clone()),
            axum::extract::Path("test-deck".to_string()),
            axum::Json(server::StartRequest {
                takes_per_prompt: Some(1),
            }),
        )
        .await
        .unwrap();

        let prompt_count
NEW_START_F4kR8
if python3 - "$OLD_TMP" "$NEW_TMP" "$BASE/sbdc-service/src/server_tests.rs" << 'PYEOF_START'
import sys
with open(sys.argv[1], 'r') as f: old = f.read()
with open(sys.argv[2], 'r') as f: new = f.read()
with open(sys.argv[3], 'r') as f: content = f.read()
content = content.replace(old, new)
with open(sys.argv[3], 'w') as f: f.write(content)
PYEOF_START
then
  echo "Fixed: added let _start_result for last start_deck call"
  rm "$OLD_TMP" "$NEW_TMP"
else
  echo "ERROR: Python patch failed for start_deck fix"
  rm -f "$OLD_TMP" "$NEW_TMP"
fi

echo ""
echo "Running clippy"
cargo clippy --workspace --manifest-path "$BASE/Cargo.toml" -- -D warnings 2>&1
CLIPPY_RESULT=$?

echo ""
echo "Running tests"
cargo test --workspace --manifest-path "$BASE/Cargo.toml" 2>&1
TEST_RESULT=$?

if [ $CLIPPY_RESULT -ne 0 ]; then
  echo "Clippy still has errors"
  COMPILE_OK=false
fi

if [ "$INCOMPLETE" = true ] || [ "$COMPILE_OK" = false ]; then
  echo "Skipping commit due to clippy errors"
  exit 1
fi

if [ $TEST_RESULT -eq 0 ]; then
  echo "All tests passed and clippy clean. Committing."
  git add -A
  git commit -m "fix(sbdc): resolve all clippy warnings

- Replace .last() with .next_back() on DoubleEndedIterator
- Replace io::Error::new(Other, e) with io::Error::other(e)
- Add let _start_result for unused Json in test"
else
  echo "Tests failed. Fix errors then run the next script."
  exit 1
fi
