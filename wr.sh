#!/usr/bin/env bash
set -euo pipefail
trap 'echo "ERROR on line $LINENO"' ERR
DEBUG=${DEBUG:-0}; [ "$DEBUG" = "1" ] && set -x

# Run tests for Issue 005 changes (sb-table-registry, sb-ws-handler, and stubs)

WORKTREE_DIR="../stackbluff-worktrees/issue-005"
if [ ! -d "$WORKTREE_DIR" ]; then
    echo "Worktree not found at $WORKTREE_DIR. Please run the implementation script first."
    exit 1
fi

cd "$WORKTREE_DIR"

# Ensure we are on the correct branch
git checkout issue/005 2>/dev/null || true

# Define crates to test (those created or modified)
CRATES=(
    "-p sb-shared-types"
    "-p sb-contracts"
    "-p sb-table-registry"
    "-p sb-ws-handler"
    "-p sb-auth"
)

echo "Running cargo check on all affected crates..."
cargo check "${CRATES[@]}" --workspace

echo "Running cargo clippy (strict warnings)..."
cargo clippy "${CRATES[@]}" -- -D warnings

echo "Running cargo test on affected crates..."
cargo test "${CRATES[@]}"

echo "All tests passed successfully for Issue 005."
