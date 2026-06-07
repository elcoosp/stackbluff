#!/usr/bin/env bash
set -euo pipefail

ISSUE_NUM="$1"
if [[ -z "$ISSUE_NUM" ]]; then
    echo "Usage: $0 <issue-number>"
    exit 1
fi

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

# Locate issue file
shopt -s nullglob
issue_files=(docs/issues/"$ISSUE_NUM"-*.md)
if [[ ${#issue_files[@]} -eq 0 ]]; then
    echo "No issue file found matching docs/issues/$ISSUE_NUM-*.md"
    exit 1
fi
ISSUE_FILE="${issue_files[0]}"

# Read context
PROJECT_STRUCTURE="$(cat docs/project-structure.md 2>/dev/null || echo "# project-structure.md not found")"
TECH_STACK="$(cat docs/tech-stack.md 2>/dev/null || echo "# tech-stack.md not found")"
ISSUE_BODY="$(cat "$ISSUE_FILE")"

# Worktree details
WORKTREE_PARENT="../stackbluff-worktrees"
WORKTREE_DIR="$WORKTREE_PARENT/issue-$ISSUE_NUM"
BRANCH="issue/$ISSUE_NUM"

cat <<'EOF'
You are an expert Rust + TypeScript developer. Output a **single bash script** inside ```bash.

## Context
- Project structure: see `docs/project-structure.md` (attached above)
- Tech stack: see `docs/tech-stack.md` (attached above)
- Issue: see content above (it includes acceptance criteria)

## Script requirements (must follow exactly)

### 1. Worktree setup (idempotent)
```bash
WORKTREE_DIR="../stackbluff-worktrees/issue-$ISSUE_NUM"
BRANCH="issue/$ISSUE_NUM"
mkdir -p ../stackbluff-worktrees
if [ -d "$WORKTREE_DIR" ]; then
    cd "$WORKTREE_DIR"
    git fetch origin main
    git rebase origin/main
else
    git worktree add -b "$BRANCH" "$WORKTREE_DIR" main
    cd "$WORKTREE_DIR"
fi
```

### 2. Modify files safely
- **To read an existing file** from `main`: `git show main:relative/path`
- **To modify a file**: Choose one method:
  - **Full rewrite** – safe and simple: use `cat > file <<'EOF'` with complete new content.
  - **Patch** – use `git show main:file | sed 's/old/new/g' > file` (if simple).
  - **Do NOT** use `>>` or append unless you are sure the file doesn't exist.
- **To create a new file**: `cat > newfile <<'EOF' … EOF`
- **To delete a file**: `git rm file`

### 3. Run tests only on affected areas
After changes, compute which areas changed:
```bash
changed_rust=$(git diff --cached --name-only | grep -c '\.rs$' || true)
changed_frontend=$(git diff --cached --name-only | grep -cE '\.(ts|tsx|css|vue|svelte)$' || true)
if [ $changed_rust -gt 0 ]; then
    cargo test --workspace
    cargo clippy --workspace -- -D warnings
fi
if [ $changed_frontend -gt 0 ]; then
    pnpm install --frozen-lockfile
    pnpm test
    pnpm lint
fi
```
(If both, run all; if none, still run cargo check? – optional)

### 4. Commit and push only if changes exist
```bash
if ! git diff --cached --quiet; then
    if git rev-parse --verify HEAD >/dev/null 2>&1 && [ $(git rev-list --count HEAD) -gt 0 ]; then
        git commit --amend --no-edit
    else
        git commit -m "feat(scope): implement #$ISSUE_NUM (partial)"
    fi
    git push --force-with-lease -u origin "$BRANCH"
fi
```

### 5. Create PR (only when issue is **fully solved**)
- If **you** (the AI) believe all acceptance criteria are met, **add** this block after push:
```bash
PR_BODY="$(cat <<PR_EOF
# Pull Request

## Summary
[One paragraph describing what this PR achieves]

## Changes
- `path/to/file`: [explain modification]
- ...

## Breaking changes
[None, or list]

## Testing
- [x] cargo test
- [x] cargo clippy
- [x] pnpm test & lint (if frontend changed)

Closes #$ISSUE_NUM
PR_EOF
)"
gh pr create --title "feat(scope): title from issue" --body "$PR_BODY" --base main
```
- Otherwise **omit** the PR block entirely – just commit and push.

### 6. Error handling
- If any command fails, the script should exit immediately (`set -e` is already at top).
- Print the exact error output.

## Important rules
- **Never ask for file contents** – use `git show` to retrieve them.
- **Never create a PR unless you are certain** the issue is complete. It's better to skip PR and let the user run another script.
- **Keep commits atomic** – amend previous commit for fixups, don't create multiple commits unless it's a new logical change.
- **Use `--force-with-lease`** when amending, never `--force`.

Now produce the bash script.
EOF
