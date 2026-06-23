#!/usr/bin/env bash
# ============================================================================
# Fix merge artifacts, verify compilation, update PR description
# ============================================================================
set -euo pipefail
trap 'echo "ERROR on line $LINENO"; exit 1' ERR
DEBUG=${DEBUG:-0}
[ "$DEBUG" = "1" ] && set -x

# ── 0. Worktree setup ──────────────────────────────────────────────────────
WORKTREE_DIR="../stackbluff-worktrees/issue-021"
if [ -d "$WORKTREE_DIR" ]; then
    cd "$WORKTREE_DIR"
else
    echo "[ERROR] Worktree not found at $WORKTREE_DIR"
    exit 1
fi

# ── 1. Restore corrupted file from main ────────────────────────────────────
echo "[INFO] Restoring game_types.rs from origin/main"
git checkout origin/main -- backend/crates/sb-shared-types/src/game_types.rs

# ── 2. Fix duplicate `pub mod missions;` in sb-shared-types lib.rs ────────
LIBS_RS="backend/crates/sb-shared-types/src/lib.rs"
if grep -qx "pub mod missions;" "$LIBS_RS"; then
    echo "[INFO] Removing duplicate pub mod missions; lines"
    awk '!seen[$0]++' "$LIBS_RS" > "${LIBS_RS}.tmp" && mv "${LIBS_RS}.tmp" "$LIBS_RS"
fi

# ── 3. Ensure no leftover conflict markers (using git diff --check) ────────
if ! git diff --check --cached 2>/dev/null; then
    echo "[ERROR] Leftover conflict markers detected!"
    exit 1
fi

# ── 4. Verify notification crates compile and tests pass ──────────────────
cd backend
echo "[INFO] Checking notification crates..."
cargo check -p sb-shared-types -p sb-contracts -p sb-notification

echo "[INFO] Running notification tests..."
cargo test -p sb-notification -- --test-threads=1
cd ..

# ── 5. Stage fixes and commit ──────────────────────────────────────────────
git add backend/crates/sb-shared-types/src/game_types.rs "$LIBS_RS"
if ! git diff --cached --quiet; then
    git commit -m "fix: resolve merge artifacts in sb-shared-types"
fi

# ── 6. Push ────────────────────────────────────────────────────────────────
git push --force-with-lease origin issue/021

# ── 7. Update PR description ───────────────────────────────────────────────
PR_NUMBER=24
gh pr edit "$PR_NUMBER" \
  --repo "elcoosp/stackbluff" \
  --body '
## Summary

Implement the `sb-notification` crate behind the `NotificationService` trait, providing routing for Telegram Bot API (DM) and Web Push notifications based on user platform and subscription status.

## Changes

### 1. Notification contracts (`sb-contracts`)
- **New file:** `crates/sb-contracts/src/notification.rs`
  - `NotificationEvent` enum: `TournamentReminder`, `StreakAlert`, `ReferralBonus`, `MissionComplete`
  - `NotificationService` trait with `send(ctx, user_id, event) -> Result<(), AppError>`
- Registered `pub mod notification;` in `lib.rs`

### 2. Database migration (`migration`)
- **New migration:** `m20260622_000001_add_push_subscription`
  - Adds `push_subscription` column (JSON, nullable) to `users` table

### 3. Notification crate (`sb-notification`)
- **New crate:** `backend/crates/sb-notification`
  - `NotificationRouter` – implements `NotificationService`
    - Routes to `TelegramSender` for `platform = "telegram"`
    - Routes to `WebPushSender` for `platform = "pwa"` if `push_subscription` exists
    - Gracefully skips PWA users without subscription
  - `TelegramSender` – placeholder implementation (logs notification text)
  - `WebPushSender` – stub implementation (real Web Push delivery deferred)
  - `validate_subscription()` helper for the subscription endpoint

### 4. Integration tests
- **File:** `crates/sb-notification/tests/notification_routing.rs`
  - Telegram user routed correctly
  - PWA user with subscription routed to Web Push (stub always succeeds)
  - PWA user without subscription is gracefully skipped

### 5. Workspace configuration
- Added `sb-notification` to `[workspace.members]` and `[workspace.dependencies]`
- Added required external dependencies: `web-push`, `reqwest`, `wiremock`, `figment`

## Merge Conflict Resolution
- Resolved conflicts in `sb-shared-types/src/game_types.rs`, `missions.rs`, and `Cargo.lock` by accepting main branch versions.
- Fixed duplicate module declaration artifact.

## Acceptance Criteria

- [x] Telegram user notification path chosen (placeholder send logs event)
- [x] PWA user with stored subscription routed to Web Push (stub)
- [x] PWA user without subscription gracefully skipped (returns `Ok`)
- [x] Integration tests verify routing logic (3 tests pass)

## Notes

- The `POST /notifications/subscribe` endpoint will be added to `sb-rest-router` in a follow‑up PR.
- Real Web Push delivery will be implemented later when the frontend subscription flow is ready.

Closes #21
'

echo "[DONE] Fixes applied and PR description updated."
