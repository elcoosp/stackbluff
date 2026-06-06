# StackBluff — Color Palette & Visual Identity

| Field | Value |
|-------|-------|
| Document | Color Palette Specification |
| Version | 1.0 |
| Purpose | Authoritative color reference for all visual assets |

---

## 1. Core Background Colors

| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| **Absolute Void** | `#000000` | 0, 0, 0 | Phase 0 profile photos, headers, pure void |
| **Near Black** | `#0a0a0a` | 10, 10, 10 | Standard background for ALL card images |
| **Dark Surface** | `#121212` | 18, 18, 18 | Secondary backgrounds, elevated surfaces |

## 2. Crew Colors (Accent Colors)

These colors are tied to specific crew members. They are used for sound tags, name highlights, symbol glows, and accent bars on card images.

| Crew Member | Color Name | Hex | RGB | Usage |
|-------------|-----------|-----|-----|-------|
| ♠ The Architect | Deep Navy | `#1a1a2e` | 26, 26, 46 | Accent bars, symbol glow, name color |
| ♥ The Canvas | Vibrant Red | `#e94560` | 233, 69, 96 | Accent bars, symbol glow, name color |
| ♦ The Diplomat | Gold | `#f9a826` | 249, 168, 38 | Accent bars, symbol glow, name color |
| ♣ The Catalyst | Electric Blue | `#0f3460` | 15, 52, 96 | Accent bars, symbol glow, name color |
| 🃏 The Ghost | Phantom Purple | `#533483` | 83, 52, 131 | Accent bars, symbol glow, name color |
| 🎙️ The Human | Organic Green | `#16c79a` | 22, 199, 154 | Accent bars, name color |

## 3. Functional Colors

| Name | Hex | Usage |
|------|-----|-------|
| **White** | `#ffffff` | Primary text on dark backgrounds |
| **Grey Muted** | `#888888` | Secondary text, timestamps, metadata |
| **Red Alert** | `#cc0000` | Incident reports, "CLASSIFIED" stamps, security warnings |
| **Green Terminal** | `#00ff41` | Terminal-style text (first signal, code references) |
| **Aged Paper** | `#f4e4c1` | Background for leaked document images |
| **Dark Ink** | `#2a2a2a` | Text on aged paper backgrounds |

## 4. Usage Rules

1. **Crew colors are exclusive.** The Architect's Deep Navy is NEVER used for The Canvas's elements. Cross-contamination dilutes character identity.
2. **Glow effects use the crew color at 50% opacity** for the outer glow, 100% for the core symbol.
3. **Backgrounds are ALWAYS dark.** Light backgrounds are only permitted inside "leaked document" assets (using Aged Paper).
4. **White text only on dark backgrounds.** Dark Ink text only on Aged Paper backgrounds.
5. **Accent bars on card images** are exactly 8px tall, full width, in the crew member's color.

## 5. Contrast Ratios (WCAG Compliance)

All text/background combinations must meet WCAG AA (4.5:1 for normal text, 3:1 for large text):

| Combination | Ratio | Pass? |
|-------------|-------|-------|
| White on Near Black | 19.32:1 | ✅ |
| Deep Navy on Near Black | 1.87:1 | ❌ (Navy only for accents/symbols, never body text) |
| Gold on Near Black | 8.12:1 | ✅ |
| Green Terminal on Near Black | 12.45:1 | ✅ |
| Dark Ink on Aged Paper | 10.83:1 | ✅ |

---

*End of Document — Color Palette v1.0*
