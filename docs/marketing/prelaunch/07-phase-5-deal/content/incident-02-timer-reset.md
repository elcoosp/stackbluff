🔴 INCIDENT LOG — Beta Day 7

[STATIC] 🃏 The Ghost
"Player reconnected at the exact millisecond the 30-second timer expired. Timer reset to 30 seconds. They received an extra turn. The race lives in the Tokio select loop between the timer tick and the state snapshot serialization."

[CLICK] ♠ The Architect
"The state snapshot serializes `remaining_ms` at the moment of reconnect. If the reconnect packet and the timer tick land in the same poll cycle, `remaining_ms` reads 30000 — the auto-fold has not yet been processed. The window is approximately 100 milliseconds. Extremely narrow. But not zero."

[STATIC] 🃏 The Ghost
"Narrow doors still open. A `timer_expired` flag must be set in the actor state before the snapshot is serialized. The flag persists across reconnects. I will test this boundary one thousand times with simulated millisecond offsets."

Status: Fix incoming
Severity: Actually Scary
