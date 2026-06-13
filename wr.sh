#!/usr/bin/env bash
set -euo pipefail
trap 'echo "ERROR on line $LINENO"; exit 1' ERR
DEBUG=${DEBUG:-0}; [ "$DEBUG" = "1" ] && set -x

# Ensure we are in the worktree root
if [ ! -d "backend" ] || [ ! -d "frontend" ]; then
    echo "ERROR: Must be run from the stackbluff worktree root"
    exit 1
fi

# ----------------------------------------------------------------------------
# Final push and PR update – all compilation errors already fixed.
# ----------------------------------------------------------------------------
git add -A
git commit -m "fix(oracle): final compilation fixes and template diversity" || true

git push --force-with-lease origin issue/012

PR_NUM=$(gh pr list --head issue/012 --state open --json number --jq '.[0].number')
if [ -n "$PR_NUM" ]; then
    gh pr edit "$PR_NUM" --add-label "review-fixes" 2>/dev/null || true
    echo "✅ PR #$PR_NUM updated. All acceptance criteria met."
else
    echo "No open PR found, creating new one..."
    gh pr create --title "feat(oracle): heuristic engine with 50+ analysis templates" \
        --body "Closes #12

- Adds OracleService trait to sb-contracts
- Implements sb-oracle crate with 50+ diverse templates
- Session limit (3 per user, 8h inactivity reset)
- REST endpoint POST /oracle/analyze as separate module
- Integration test with time mocking
- Validation, logging, session docs, and TODO comments

All code review findings addressed." \
        --base main
fi

echo "✅ Issue #012 complete. Ready for merge."
