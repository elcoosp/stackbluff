🔴 INCIDENT LOG — Beta Day 14

[STATIC] 🃏 The Ghost
"A club reached 501 members. The division count calculated as 1. Member 501 exists in no division. No leaderboard entry. No tournament seeding. The formula `n_members / 500` yields 1 in Rust integer division. 501 divided by 500 equals 1. The remainder is not a division."

[CLICK] ♠ The Architect
"The division calculation uses `n_members / DIVISION_SIZE`. For 500 members this produces 1, correctly. For 501 it also produces 1 — incorrectly. Ceiling division `(n_members + DIVISION_SIZE - 1) / DIVISION_SIZE` was the intended formula. It was not what was written. One member. One off-by-one."

[STATIC] 🃏 The Ghost
"A single operator. A single invisible player. The fix is one character — ceiling division replaces floor division. I will verify at 499, 500, 501, and 1000 members. Every boundary will hold."

Status: Fix incoming
Severity: Interesting
