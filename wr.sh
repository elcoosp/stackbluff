#!/usr/bin/env bash
set -uo pipefail

COMPILE_OK=true
INCOMPLETE=false

BASE="tools/sbdc"

echo "Fixing demo.sh — REPO_ROOT path resolution is wrong (one level too shallow)"
OLD_TMP=$(mktemp) || { echo "ERROR: cannot create temp file"; exit 1; }
NEW_TMP=$(mktemp)
cat > "$OLD_TMP" << 'OLD_PATH_J7mK2'
REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
OLD_PATH_J7mK2
cat > "$NEW_TMP" << 'NEW_PATH_Q3nR8'
REPO_ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
NEW_PATH_Q3nR8
if python3 - "$OLD_TMP" "$NEW_TMP" "$BASE/sbdc-cli/src/demo.sh" << 'PYEOF_PATH'
import sys
with open(sys.argv[1], 'r') as f: old = f.read()
with open(sys.argv[2], 'r') as f: new = f.read()
with open(sys.argv[3], 'r') as f: content = f.read()
content = content.replace(old, new)
with open(sys.argv[3], 'w') as f: f.write(content)
PYEOF_PATH
then
  echo "Fixed REPO_ROOT path: ../../.. → ../../../.. (4 levels up from src/)"
  rm "$OLD_TMP" "$NEW_TMP"
else
  echo "ERROR: Python patch failed for demo.sh path fix"
  rm -f "$OLD_TMP" "$NEW_TMP"
fi

echo "Verifying the fix by simulating the path resolution"
DEMO_SRC="$BASE/sbdc-cli/src"
RESOLVED="$(cd "$DEMO_SRC/../../../.." 2>/dev/null && pwd)"
echo "REPO_ROOT would resolve to: $RESOLVED"
if [ -f "$RESOLVED/tools/sbdc/Cargo.toml" ]; then
  echo "✅ Cargo.toml found at correct path"
else
  echo "❌ Cargo.toml NOT found — path still wrong"
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
  git commit -m "fix(sbdc): demo.sh REPO_ROOT off by one — need 4 levels up from src/"
else
  echo "Tests failed. Fix errors then run the next script."
  exit 1
fi
