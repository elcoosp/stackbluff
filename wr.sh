#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

# Allow passing a custom commit message, or default to a generic one
COMMIT_MSG="${1:-chore: fmt and clippy fixes}"

# Move into the backend directory where the workspace Cargo.toml lives
cd backend

echo "🧹 Running cargo fmt..."
cargo fmt

echo "🔍 Running cargo clippy (treating warnings as errors)..."
if ! cargo clippy --workspace -- -D warnings; then
    echo "❌ Clippy failed! Please fix the warnings/errors before committing."
    exit 1
fi

# Go back to the repo root for Git operations
cd ..

echo "📦 Staging changes..."
git add -A

# Check if there are staged changes to commit
if git diff --staged --quiet; then
    echo "✅ No changes to commit. Pushing any existing commits..."
else
    echo "💾 Committing changes with message: '$COMMIT_MSG'..."
    git commit -m "$COMMIT_MSG"
fi

echo "🚀 Pushing to remote..."
git push

echo "🎉 Done!"
