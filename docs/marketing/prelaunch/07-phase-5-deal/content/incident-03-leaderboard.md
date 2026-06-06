🔴 INCIDENT LOG — Beta Day 11

[STATIC] 🃏 The Ghost
"Season 2 began at 00:00 UTC. The global leaderboard displayed Season 1 rankings until 00:04:37. The materialised view refresh runs every 5 minutes. Season reset did not trigger an immediate refresh. Stale data served for 277 seconds."

[CLICK] ♠ The Architect
"The `leaderboard_global_mv` refreshes on a 5-minute scheduled interval. This is documented in TC-007 with a 300-second tolerance. The last refresh was at 23:55 UTC. The data was not incorrect — it was old. Within the specified contract. A season boundary is a reasonable trigger for an immediate refresh, but it was not in the original requirement."

[STATIC] 🃏 The Ghost
"The contract tolerates staleness under normal operations. A season boundary is not normal. Users saw last season's champion crowned as current. Trigger `REFRESH MATERIALIZED VIEW` on season transition event. I will watch the next reset at 08:00 UTC."

Status: Fix incoming
Severity: Annoying
