#!/usr/bin/env bash
set -euo pipefail

ISSUE_NUM="$1"
if [[ -z "$ISSUE_NUM" ]]; then
    echo "Usage: $0 <issue-number>"
    exit 1
fi

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

# Find issue file
shopt -s nullglob
issue_files=(docs/issues/"$ISSUE_NUM"-*.md)
if [[ ${#issue_files[@]} -eq 0 ]]; then
    echo "No issue file found matching docs/issues/$ISSUE_NUM-*.md"
    exit 1
fi
ISSUE_FILE="${issue_files[0]}"

# Read context
PROJECT_STRUCTURE="$(cat docs/project-structure.md)"
TECH_STACK="$(cat docs/tech-stack.md)"
ISSUE_BODY="$(cat "$ISSUE_FILE")"

# Compute integer issue number (strip leading zeros)
ISSUE_NUM_INT="$(echo "$ISSUE_NUM" | sed 's/^0*//')"

cat <<EOF
You are an expert Rust + TypeScript developer. Produce a **single bash script** that implements the issue below.

**Output format:** Exactly one \`\`\`bash code block. No text outside it (except optional analysis inside \`# comments\` inside the script).

## Project structure
$PROJECT_STRUCTURE

## Tech stack
$TECH_STACK

## Issue
$ISSUE_BODY

## Mandatory rules for your script

### 1. Worktree setup (idempotent, non‑destructive)
\`\`\`bash
WORKTREE_DIR="../stackbluff-worktrees/issue-\$ISSUE_NUM"
BRANCH="issue/\$ISSUE_NUM"
mkdir -p ../stackbluff-worktrees
if [ -d "\$WORKTREE_DIR" ]; then
    cd "\$WORKTREE_DIR"
    # DO NOT fetch or rebase – worktree may have uncommitted changes.
    # The user will sync manually if needed.
else
    git worktree add -b "\$BRANCH" "\$WORKTREE_DIR" main
    cd "\$WORKTREE_DIR"
fi
\`\`\`

### 2. Rectification vs. initial implementation
- **If the branch already has at least one commit** (i.e., this is a rectification), your script should:
  - Only modify files that are **directly related to the error**.
  - **Do not recreate** files that already exist and are correct.
  - Use \`git add . && git commit --amend --no-edit\` to fix the previous commit.
- **If the branch has no commits** (fresh worktree), create new files normally.

### 3. Reading and modifying files
- **Read existing file from \`main\`**: \`git show main:relative/path\`
- **Check existence**: \`git cat-file -e main:relative/path 2>/dev/null\`
- **Modify existing file**: First try \`sed -i '' 's/old/new/g' file\`. If \`sed\` fails, **fallback to rewriting the whole file** using a here‑doc with the complete new content.
- **Create new file**: \`cat > file <<'EOF' ... EOF\`
- **Delete file**: \`git rm file\`

### 4. Atomic commits per logical change
- After each successful test run, commit only the files you changed:
  \`git commit -m "feat(scope): description"\`
- For rectifications (branch already has commits), **amend** the previous commit:
  \`git add . && git commit --amend --no-edit\`
- Then push: \`git push --force-with-lease -u origin "\$BRANCH"\`

### 5. Testing only affected areas
- **Rust**: Compute changed crates from staged files:
\`\`\`bash
changed_crates=\$(git diff --cached --name-only | grep '^backend/crates/' | cut -d/ -f3 | sort -u | sed 's/^/-p /' | tr '\n' ' ')
if [ -n "\$changed_crates" ]; then
    cargo test \$changed_crates
    cargo clippy \$changed_crates -- -D warnings
fi
\`\`\`
- **Frontend**: If any frontend file (\`.ts\`, \`.tsx\`, \`.css\`, \`.vue\`, \`.svelte\`) changed:
\`\`\`bash
pnpm install --frozen-lockfile
pnpm test
pnpm lint
pnpm build
\`\`\`

### 6. Error handling & debugging
- At the top: \`set -euo pipefail\`
- Add \`trap 'echo "ERROR on line \$LINENO"; git checkout -- .; exit 1' ERR\` to revert unstaged changes on failure.
- Enable \`set -x\` if \`DEBUG=1\` is set.

### 7. PR creation (only when issue is fully solved)
- Before creating the PR, **explicitly verify all acceptance criteria** (e.g., file exists, contains expected code). Use \`if\` checks.
- If all pass, create the PR. **Important:** Use the integer issue number (without leading zeros) in the `Closes` line.
  \`\`\`bash
  ISSUE_NUM_INT="$ISSUE_NUM_INT"
  gh pr create --title "feat(scope): title" --body "Closes #\$ISSUE_NUM_INT" --base main
  \`\`\`
- Otherwise **omit** the PR block – just commit and push.

Now produce the bash script.
EOF
