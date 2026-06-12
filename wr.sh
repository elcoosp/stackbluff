cd ../stackbluff-worktrees/issue-009
find backend/crates/sb-contracts -type f -name "*.rs" | head -10
cat backend/crates/sb-contracts/src/lib.rs
cat backend/crates/sb-contracts/src/lobby_api.rs 2>/dev/null || echo "File not found"
