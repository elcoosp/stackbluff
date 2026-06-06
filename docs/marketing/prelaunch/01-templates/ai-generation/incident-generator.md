# Incident Report Generator Prompt

You are generating fictional but plausible bug reports for a beta testing phase of a poker platform. These will be posted as "build in public" content.

## Rules
- Each bug must be technically plausible given the StackBluff architecture (Rust, Tokio actors, SQLite WAL, WebSocket, payment webhooks).
- The bug should be found by The Ghost ([STATIC] 🃏) and discussed with another crew member.
- The dialogue between crew members must reveal their personality (from the Crew Bible).
- Every bug must have a resolution (or become "a feature").
- Never describe a bug that would be catastrophic (no data loss, no real money at risk).
- These are play-money bugs, not production-critical — keep the tone light.

## Bug Ideas from Architecture
- Side pot calculation with odd chip remainder
- Timer reset on WebSocket reconnect at exact turn/river boundary
- Leaderboard materialised view showing stale data after season reset
- Club division sharding activating at 501st member (off-by-one)
- Telegram Stars webhook arriving twice (idempotency test)
- Oracle template selecting wrong analysis for wheel straight flush
