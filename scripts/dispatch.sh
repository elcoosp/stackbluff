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

# Integer issue number (strip leading zeros)
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

## ⚠️ CRITICAL RULES – FOLLOW EXACTLY

### 1. Never overwrite existing files without reading first
- Before creating or modifying any file, check if it already exists in \`main\`:
  \`git cat-file -e main:relative/path 2>/dev/null\`
- If it exists, **read its current content** with \`git show main:relative/path\`.
- Make only the **necessary changes** – do not rewrite the whole file unless it's the only safe way.
- Prefer \`sed -i '' 's/old/new/g'\` for small changes. If \`sed\` fails, then fallback to a full rewrite.

### 2. Workspace dependencies must be centralised
- When adding a new dependency to any crate, first check if it already exists in \`backend/Cargo.toml\` under \`[workspace.dependencies]\`.
- If missing, add it there with the correct version and features (use the versions from \`tech-stack.md\`).
- Then reference it in the crate’s Cargo.toml as \`dep = { workspace = true }\`.

### 3. SeaORM 2.0 method usage (non‑negotiable)
- **Do NOT** use \`active.update(&db)\` – that is wrong.
- Use: \`ActiveModel::update(active, &db)\` with \`ActiveModelTrait\` in scope.
- For inserts: \`ActiveModel::insert(&db)\` or \`Model::insert(active, &db)\`.
- Always import: \`use sea_orm::{ActiveModelTrait, ConnectionTrait, EntityTrait};\`.

### 4. Migration file modifications – NEVER use sed to insert code inside functions
- If you must change an existing migration, **generate a new migration** using \`sea-orm-cli migrate generate <name>\` and write the new schema in it.
- If you absolutely must modify an existing migration file, **rewrite the whole file** with a here‑doc (no \`sed\` hacks). Copy the original and only change what is needed.

### 5. Test isolation
- Integration tests inside a crate (e.g., \`sb-db-entities/tests/\`) must **not** depend on other crates (e.g., \`sb-db-repos\`) unless those are declared as dev‑dependencies in that crate’s \`Cargo.toml\`.
- If you need functionality from another crate, move the test to that crate or add the proper dev‑dependency.

### 6. Clippy is a gate – fix all warnings
- After every change, run \`cargo clippy --workspace -- -D warnings\` (or limited to affected crates).
- Do not proceed until all warnings are fixed. Unused imports, unused variables, and incorrect formatting must be cleaned.

### 7. Incremental commits – one logical change per commit
- Commit after each successful compilation or test pass.
- Use a new commit for a new logical change.
- Only use \`git commit --amend\` for the **immediate fix** of the previous change, not for unrelated adjustments.
- Push after every commit (or every amend) with \`git push --force-with-lease\`.

### 8. Worktree setup (idempotent, no automatic rebase)
\`\`\`bash
WORKTREE_DIR="../stackbluff-worktrees/issue-$ISSUE_NUM"
BRANCH="issue/$ISSUE_NUM"
mkdir -p ../stackbluff-worktrees
if [ -d "\$WORKTREE_DIR" ]; then
    cd "\$WORKTREE_DIR"
    # DO NOT fetch or rebase – the worktree may have uncommitted changes.
    # The user will sync manually if needed.
else
    git worktree add -b "\$BRANCH" "\$WORKTREE_DIR" main
    cd "\$WORKTREE_DIR"
fi
\`\`\`

### 9. Reading existing files (always do this)
\`\`\`bash
git show main:relative/path          # to read content
git cat-file -e main:relative/path   # to check existence
\`\`\`

### 10. Testing only affected areas
- **Rust**: Compute changed crates from staged files:
\`\`\`bash
changed_crates=\$(git diff --cached --name-only | grep '^backend/crates/' | cut -d/ -f3 | sort -u | sed 's/^/-p /' | tr '\n' ' ')
if [ -n "\$changed_crates" ]; then
    cargo test \$changed_crates
    cargo clippy \$changed_crates -- -D warnings
fi
\`\`\`
- **Frontend** (if any \`.ts\`, \`.tsx\`, \`.css\`, \`.vue\`, \`.svelte\` changed):
\`\`\`bash
pnpm install --frozen-lockfile
pnpm test
pnpm lint
pnpm build
\`\`\`

### 11. Error handling
\`\`\`bash
set -euo pipefail
trap 'echo "ERROR on line \$LINENO"; git checkout -- .; exit 1' ERR
DEBUG=\${DEBUG:-0}; [ "\$DEBUG" = "1" ] && set -x
\`\`\`

### 12. PR creation (only when issue fully solved)
- Before creating the PR, **explicitly verify all acceptance criteria** with \`if\` checks (e.g., file exists, contains expected code).
- Use the integer issue number (no leading zeros):
\`\`\`bash
ISSUE_NUM_INT="$ISSUE_NUM_INT"
gh pr create --title "feat(scope): title" --body "Closes #\$ISSUE_NUM_INT" --base main
\`\`\`

Now produce the bash script. Follow every rule above. No exceptions.
EOF
