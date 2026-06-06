🔴 INCIDENT LOG — Beta Day 19

[STATIC] 🃏 The Ghost
"Two identical Telegram Stars webhooks arrived 47 milliseconds apart. Both passed the idempotency check. Both credited 50,000 chips. User received 100,000 chips for one purchase. The mpsc write queue had not committed the first transaction when the second handler read status as PENDING."

[CLICK] ♠ The Architect
"The payment handler reads transaction status from SQLite before queuing the write command. The single-writer mpsc channel serializes writes — but not the read that precedes them. Two concurrent webhook handlers both read PENDING. Both queue a CONFIRMED write. The two-phase commit is correct in sequence. It fails under concurrency. The read and the write must occur inside the same serialized command."

[STATIC] 🃏 The Ghost
"A 47-millisecond window where idempotency is an illusion. The fix: move the idempotency check inside the mpsc write command. Read and write atomically in the same serial execution. I will send one hundred duplicate webhooks at 10-millisecond intervals and verify zero double credits."

Status: Fix incoming
Severity: Actually Scary
