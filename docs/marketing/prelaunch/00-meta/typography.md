# StackBluff — Typography Specification

| Field | Value |
|-------|-------|
| Document | Typography & Text Hierarchy |
| Version | 1.0 |
| Purpose | Authoritative font and text styling reference |

---

## 1. Font Stack

| Font | Weight | Usage | Fallback |
|------|--------|-------|----------|
| **JetBrains Mono** | Bold (700) | Sound tags (`[CLICK]`), day numbers, terminal text, code, leaks | `Courier New`, monospace |
| **JetBrains Mono** | Regular (400) | Secondary code/terminal text | `Courier New`, monospace |
| **Inter** | Bold (700) | Crew names, Oracle "SPEAKS" header, phase titles | `-system-ui`, `sans-serif` |
| **Inter** | Regular (400) | Body text on all cards, log content, descriptions | `-system-ui`, `sans-serif` |

## 2. Text Hierarchy (Card Images)

| Element | Font | Size (px) | Color | Weight |
|---------|------|-----------|-------|--------|
| Sound Tag (e.g., `[CLICK]`) | JetBrains Mono | 24 | Crew Color | Bold |
| Day Number (e.g., `· Day 8`) | JetBrains Mono | 24 | #ffffff | Bold |
| Log Body Text | Inter | 28 | #ffffff | Regular |
| Crew Name (Phase 2+) | Inter | 32 | Crew Color | Bold |
| Suit Symbol | N/A (icon) | 48 | Crew Color | N/A |
| Incident Header | JetBrains Mono | 24 | #cc0000 | Bold |
| Oracle Header | Inter | 28 | #f9a826 | Bold |
| Oracle Body | Inter | 24 | #ffffff | Regular |

## 3. Text Layout Rules

1. **Maximum 80 characters per line** on card images. Any text longer must be line-broken manually before rendering.
2. **Maximum 4 lines of body text** per crew log card.
3. **Sound tag and day are always on the same line**, separated by a center dot: `[CLICK] · Day 8`
4. **Line height**: 1.4× font size for body text, 1.2× for headers.
5. **Text alignment**: Always left-aligned for log cards. Center-aligned for Oracle readings and phase transition cards.
6. **Padding**: 40px minimum from all edges on card images.

## 4. Social Media Text (Non-Image)

For posts that are text-only (no image card attached):

- **Line breaks are content.** Every line break is intentional. Single-spaced within a thought, double-spaced between thoughts.
- **No emojis in Phase 0 or 1.** Emojis are permitted from Phase 2 onward, but only ♠ ♥ ♦ ♣ 🃏 and 🔮.
- **No Markdown formatting** in Telegram/X posts. The formatting is the line break.
- **Threads on X/Twitter**: Number each tweet (1/7, 2/7, etc.). Each tweet must be self-contained and valuable even if the reader doesn't see the rest of the thread.

---

*End of Document — Typography v1.0*
