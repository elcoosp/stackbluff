[INTERCEPTED DOCUMENT - DAY 22]
# ██████████ — Software Requirements Specification
## 3.2 Feature: Core █████ ███████'██ Game Engine

**Goal:** Provide a correct, fair, and fast █████ ███████'██ game loop for 2–9 players.

REQ-FUNC-010: The game engine shall correctly evaluate all 2,598,960 possible 5-card hand combinations and rank them according to standard █████ ███████'██ rules.
REQ-FUNC-011: The system shall use a cryptographically secure pseudo-random number generator (CSPRNG) for all deck shuffles.
REQ-FUNC-013: Each █████ table shall operate as an isolated Tokio async task. The failure of one table task shall not affect other running tables.

[AUTHENTICATION: ████████████]
