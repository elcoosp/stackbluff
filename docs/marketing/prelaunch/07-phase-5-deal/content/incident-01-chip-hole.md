🔴 INCIDENT LOG — Beta Day 3

[STATIC] 🃏 The Ghost
"Found a black hole. Three-way split of a 101-chip side pot. Each player receives 33 chips. One chip vanishes. Rust integer division truncates the remainder. The economy leaks 1 chip per occurrence."

[CLICK] ♠ The Architect
"The division 101 / 3 = 33 is correct per Rust's native integer semantics. The remainder is discarded. The side pot allocator was verified for even splits. The odd-chip rule — first seat in order receives the remainder — was not implemented. 1 chip lost per odd split. The math is honest. The rule was incomplete."

[STATIC] 🃏 The Ghost
"One chip. Every time it occurs. Over ten thousand hands the leak compounds. Patch the allocator with remainder distribution to first-active seat. I will verify every odd split from 3 to 101."

Status: Fix incoming
Severity: Interesting
