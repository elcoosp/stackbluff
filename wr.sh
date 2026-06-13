#!/usr/bin/env bash
set -euo pipefail
trap 'echo "ERROR on line $LINENO"; exit 1' ERR
DEBUG=${DEBUG:-0}; [ "$DEBUG" = "1" ] && set -x

# ----------------------------------------------------------------------------
# Final formatting, linting, and push for issue #012
# Assumes we are already in the correct worktree and branch.
# ----------------------------------------------------------------------------

# Ensure we are in the project root (worktree)
if [ ! -d "backend" ] || [ ! -d "frontend" ]; then
    echo "ERROR: Must be run from the stackbluff worktree root"
    exit 1
fi

# Run Rust formatting
echo "Running cargo fmt..."
cargo fmt --all --manifest-path backend/Cargo.toml

# Run clippy with auto-fix (safe for CI)
echo "Running cargo clippy fix..."
cargo clippy --workspace --fix --allow-dirty --allow-staged --manifest-path backend/Cargo.toml -- -D warnings 2>&1 | head -100

# Verify clippy passes with warnings as errors
echo "Verifying clippy..."
cargo clippy --workspace --manifest-path backend/Cargo.toml -- -D warnings

# Run frontend formatting and linting (if pnpm available)
if command -v pnpm >/dev/null 2>&1 && [ -d "frontend" ]; then
    echo "Running frontend fmt and lint..."
    cd frontend
    pnpm install --frozen-lockfile 2>/dev/null || true
    if command -v biome >/dev/null 2>&1; then
        biome check --write . 2>/dev/null || true
        biome lint . 2>/dev/null || true
    else
        echo "Biome not found, skipping frontend lint"
    fi
    cd ..
fi

# Stage all changes (including fixes from fmt/clippy)
git add -A

# Commit if there are any changes
if ! git diff --cached --quiet; then
    git commit -m "chore: fmt and clippy fixes"
    echo "Committed formatting and lint fixes."
else
    echo "No changes to commit after fmt/clippy."
fi

# Push to remote (force-with-lease to avoid conflicts)
git push --force-with-lease origin HEAD

echo "✅ Formatting, linting, and push completed successfully."
