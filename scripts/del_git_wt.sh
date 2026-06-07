#!/usr/bin/env bash
set -euo pipefail

ISSUE_NUM="$1"
if [[ -z "$ISSUE_NUM" ]]; then
    echo "Usage: $0 <issue-number>"
    exit 1
fi

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

WORKTREE_DIR="../stackbluff-worktrees/issue-${ISSUE_NUM}"
BRANCH="issue/${ISSUE_NUM}"

# Remove worktree if it exists
if [[ -d "$WORKTREE_DIR" ]]; then
    echo "Removing worktree at $WORKTREE_DIR"
    # Ensure we are not inside the worktree itself
    if [[ "$(pwd)" == "$(cd "$WORKTREE_DIR" && pwd)"* ]]; then
        echo "ERROR: Cannot delete worktree while inside it. Please cd out first."
        exit 1
    fi
    git worktree remove --force "$WORKTREE_DIR" || {
        echo "Failed to remove worktree, trying manual removal"
        rm -rf "$WORKTREE_DIR"
        git worktree prune
    }
else
    echo "Worktree directory $WORKTREE_DIR does not exist, skipping removal."
fi

# Delete local branch if it exists
if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
    echo "Deleting local branch $BRANCH"
    git branch -D "$BRANCH"
else
    echo "Local branch $BRANCH does not exist, skipping."
fi

# Delete remote branch if it exists
if git ls-remote --exit-code --heads origin "$BRANCH" >/dev/null 2>&1; then
    echo "Deleting remote branch origin/$BRANCH"
    git push origin --delete "$BRANCH"
else
    echo "Remote branch origin/$BRANCH does not exist, skipping."
fi

echo "Done: issue $ISSUE_NUM worktree and branch have been removed."
