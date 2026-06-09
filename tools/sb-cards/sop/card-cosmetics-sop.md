You are correct. The master prompt template should **not** impose English Pattern rules (reversible face cards, one‑eyed royals, suicide king). Those are specific to the Poison‑Gardenia deck, not to every deck. The template must be truly style‑agnostic: let the AI invent its own visual language, layout rules, and character depictions based solely on the theme.

Below is the **corrected SOP v14.14** with a **style‑agnostic** master prompt template. The template only asks for the deck theme and enforces the minimal technical requirements (pure white background, self‑contained prompts, naming and aspect ratio). All design choices – face card composition, pip shapes, symmetry, etc. – are left to the AI to invent.

---

# StackBluff Cosmetic Deck Production — Automated SOP (v14.14)

**Budget:** $0 (No API Keys, Free Tiers Only)

**Core Principles:**
- Modular pipeline: separate tools for slicing, compositing, and video conversion.
- **Style‑agnostic master brief** – works for any theme, any visual style.
- No embedded code in SOP; refer to external scripts in `tools/` and `engine/`.
- Typography uses a single Ideogram 2×13 grid (dark top row, accent bottom row) with reliable slicing via `slice_typo.py`.

---

## 1. Folder Structure

```
stackbluff-cosmetics/
│
├── tools/
│   ├── slice_typo.py            # Standalone slicer for 2×13 grid
│   └── convert-video.sh         # FFmpeg MP4 → WebP
│
├── engine/                      # React/Node compositor (external)
│   └── (card builder scripts)
│
└── [DECK-ID]/
    ├── 0-brief/
    ├── 1-raw/
    │   ├── art/                 # Raw AI images + sliced outputs
    │   ├── kling-input/         # Dark‑bg images for Kling
    │   └── video/               # MP4s from Kling
    ├── 2-pips/                  # (optional) resized pips
    ├── 3-game-cards/            # Final 200×300 PNGs
    ├── 4-animated/              # Final 200×300 WebPs
    └── manifest.json
```

---

## 2. Phase 1: Concept & Briefing (DeepSeek)

**Time:** 15 min

1. Open DeepSeek.
2. Paste the **Master Brief Prompt Template** (below). It is **style‑agnostic** – no fixed design rules.
3. Let the AI invent a fully original deck theme, including its own visual language, card layouts, and special features.
4. Save output as `0-brief/brief.md`.

### Master Brief Prompt Template (Style‑Agnostic)

```text
I am designing a cosmetic deck of playing cards for a poker game. 

Your task is to invent a highly detailed, original, and cohesive theme for this deck (e.g., "Bioluminescent Deep Sea", "Clockwork Renaissance", "Neon Cyberpunk Samurais"). Do not use standard themes like "Fantasy" or "Dragons" without a unique twist.

Based on the theme you invent, you will generate a complete design brief. For each image generation prompt, you must decide the appropriate composition, aspect ratio, and visual details that fit the theme.

CRITICAL TECHNICAL REQUIREMENTS (must be followed for every prompt):
1. **Pure white background** – Every generated image must have a pure white background. No dark colors, no gradients, no grey.
2. **Self‑contained prompts** – Every prompt block must contain a "Positive:" field and a "Negative:" field, fully spelled out (no placeholders).
3. **Naming & aspect ratio** – Every prompt block must be prefixed with its exact kebab‑case filename and aspect ratio tag in brackets, like `### [filename] [ASPECT]`. Use `[SQUARE]` for 1:1, `[PORTRAIT]` for 2:3, `[LANDSCAPE]` for 16:9 or other widths.

All other design decisions (face card poses, pip styles, borders, symmetry, reversibility, special rules, etc.) are yours to define based on the theme. Be creative and original.

Output EXACTLY this structure (fill in your invented details):

## DECK NAME
[2-3 word catchy name, hyphenated]

## COLOR PALETTE
- Primary dark (Rim color): [hex]
- Primary accent (Frame color): [hex]
- Secondary accent: [hex]

## VISUAL STYLE & LAYOUT RULES
(Describe the card layout conventions you have invented for this deck. For example: Are face cards reversible? Are they full‑body or bust? Are any royals in profile? Any unique weapon placements? Describe how pips are styled, etc.)

## HIDDEN GEMS SYSTEM
1. Narrative Arc: Which suit tells a story from 2 to 10? What is the story? (List 9 steps)
2. Recurring Mascot: What tiny element is hidden in the 12 face card illustrations and also in the typography grid?
3. Reflection Secret: What image do the two Jokers form when overlaid?

## CUSTOM PIP DESIGNS
(Describe the four suit symbols – spade, heart, diamond, club – with their shapes, interior treatments, edge styles, and colors. No glow unless theme requires it.)

## PIP GENERATION PROMPTS (4 images)
Create a prompt for each pip symbol (spade, heart, diamond, club). All pips must be square (1:1), single centered symbol, pure white background. Use the following structure:

### [pip-spade] [SQUARE]
Positive: A stylized spade symbol (♠), vintage copperplate engraving style (adapted to your theme), [your interior/edge details], single centered symbol, pure white background, high detail, vector-like clarity, 1:1 aspect ratio
Negative: multiple symbols, borders, text, letters, numbers, 3d render, photorealistic, colored background, scenery, dark background

(Repeat for heart, diamond, club with same structure)

## CORNER INDEX PLAQUE (1 image)
### [corner-plaque] [SQUARE]
Positive: An ornate corner index plaque, vintage copperplate engraving style, [theme‑specific ornaments], empty centre (pure white void), decorative frame, pure white background, high detail, sharp lines, 1:1 aspect ratio
Negative: text, letters, numbers, symbols, suit pips, dark background, grey background, scenery, shadows

## UNIFIED TYPOGRAPHY GRID (1 image)
We generate a single 16:9 image with two rows of 13 characters each. The top row uses the primary dark color, the bottom row uses the primary accent color. Order left to right: A, K, Q, J, 2, 3, 4, 5, 6, 7, 8, 9, 10.

### [grid-typography] [LANDSCAPE] (16:9)
Positive: A 2x13 grid of characters. Top row: 'A','K','Q','J','2','3','4','5','6','7','8','9','10' in [Primary Dark Hex]. Bottom row: same sequence in [Primary Accent Hex]. Each character isolated with generous pure white space (at least 30% width on sides). No grid lines, no borders – only white background. Vintage copperplate engraving style, [theme‑specific motifs] forming each character. The [Recurring Mascot] is hidden once within the linework of one character. pure white background, high contrast, sharp lines, 16:9 aspect ratio.
Negative: grid lines, borders, frames, cell outlines, text outside the grid, lowercase, 3d render, shadows, dark/grey background, blurry, misaligned, duplicate characters, missing characters, touching characters, overlapping characters, line break inside a row, more than two rows.

## CARD BORDER (1 image)
### [border] [PORTRAIT] (2:3)
Positive: Ornate vintage card border, symmetrical, empty centre (transparent void), corner flourishes with theme‑specific motifs, delicate linework, pure white background, high detail, sharp lines, 2:3 aspect ratio
Negative: text, letters, numbers, dark background, grey background, filled centre, solid shapes, scenery

## CARD BACK (1 image)
### [back] [PORTRAIT] (2:3)
Positive: A symmetrical, ornate pattern for the card back, featuring [theme‑specific centerpiece and radiating motifs]. Rendered in fine copperplate lines. pure white background, 2:3 aspect ratio
Negative: text, letters, numbers, asymmetrical, bordered, card shape, dark background, grey background

## ACES (4 images)
Create prompts for ace of spades, hearts, diamonds, clubs. Each ace should be an ornate object that incorporates the suit symbol as the central focus. No characters. Use portrait 2:3 aspect ratio.

### [ace-spades] [PORTRAIT]
Positive: [Fully detailed ornate object with spade shape], isolated, centered. vintage copperplate engraving style, pure white background, 2:3 aspect ratio
Negative: text, letters, numbers, characters, people, scenery, borders, card shape, dark background

(Repeat for hearts, diamonds, clubs)

## FACE CARDS (12 images)
Create prompts for King, Queen, Jack of each suit (12 total). Follow the visual layout rules you defined earlier (reversible? full‑body? bust? etc.). Each must hide the Recurring Mascot somewhere. Use the aspect ratio you defined for face cards (typically SQUARE 1:1 for reversible, but you may choose another). End each positive prompt with: "vintage copperplate engraving style, traditional French‑suited playing card aesthetic, pure white background, [your aspect ratio]"

Include the special variants you invented (e.g., profile royals, weapon‑behind‑head, etc.) if they fit your theme.

### [king-spades] [SQUARE]
Positive: [Your character description], vintage copperplate engraving style, traditional French‑suited playing card aesthetic, pure white background, [aspect ratio]
Negative: full body, legs, action pose, dynamic pose, scenery, landscapes, borders, card edges, text, letters, numbers, multiple figures, blurry, dark background

(Repeat for all 12 face cards)

## NUMBER CARDS – NARRATIVE ARC (9 images)
For the suit you chose for the narrative arc (2 through 10), create one prompt per rank. Use portrait 2:3 aspect ratio. Each prompt should depict the corresponding story step (from the hidden gems system).

### [2-spades] [PORTRAIT]
Positive: [Story step 1 description], pure white background, vintage copperplate engraving style, 2:3 aspect ratio
Negative: text, letters, numbers, borders, card shape, people, faces, dark background

(Repeat for 3 through 10)

## NUMBER CARD TEMPLATE (1 image)
For the other three suits (non‑narrative), create a single template prompt that generates a repeating decorative pattern. Use portrait 2:3 aspect ratio.

### [number-template] [PORTRAIT]
Positive: [Repeating decorative suit pattern description], vintage copperplate engraving style, pure white background, 2:3 aspect ratio
Negative: text, letters, numbers, borders, card shape, people, faces, dark background

## JOKERS (2 images)
Create two prompts for Jokers that form a single cohesive image when overlaid (the reflection secret). Use portrait 2:3 aspect ratio.

### [joker-1] [PORTRAIT]
Positive: [Left half of reflection secret], pure white background, vintage copperplate engraving style, 2:3 aspect ratio
Negative: text, letters, numbers, borders, card shape, right half, dark background

### [joker-2] [PORTRAIT]
Positive: [Right half of reflection secret], pure white background, vintage copperplate engraving style, 2:3 aspect ratio
Negative: text, letters, numbers, borders, card shape, left half, dark background

## ANIMATION DESCRIPTIONS (For Kling AI, 16 items)
Provide a subtle 2‑second animation description for each of the 16 animated cards (4 Aces + 12 Face Cards). Describe what moves, glows, or pulses.

- [ace-spades]: [animation description]
- [king-spades]: [animation description]
... (continue for all 16)

End of brief.
```

---

## 3. Phase 2: Asset Generation

**Time:** ~40 min

### A. Flux (Perchance / FluxGen) – most assets

Generate and save to `1-raw/art/`:
- Pips (4)
- Border, Plaque, Back (3)
- Aces (4)
- Jokers (2)
- Face Cards (12)
- Number Cards (narrative suit, 9)
- Number Template (1)

### B. Ideogram – typography grid

- **Tool:** ideogram.ai
- **Aspect ratio:** 16:9
- **Prompt:** Copy the `### [grid-typography]` positive prompt from the brief.
- Download `grid-typography.png` → `1-raw/art/`

---

## 4. Phase 2.5: Background Removal (bgbye.io)

**Time:** ~15 min

1. Upload all Flux‑generated assets (not the Ideogram grid if already pure white).
2. Process and download.
3. Move all `*_birefnet.png` (or `_inspyrene.png`) into `1-raw/art/`.

---

## 5. Phase 3: Slice Typography (Standalone)

**Time:** 1 min

Run the external script `tools/slice_typo.py` (provided separately). It:
- Uses OpenCV connected components.
- Merges multi‑part characters and handles `10`.
- Outputs `char-*_dark.png`, `char-*_accent.png`, `num-*_dark.png`, `num-*_accent.png`.

**Command:**
```bash
cd tools
python slice_typo.py ../[DECK-ID]/1-raw/art/grid-typography.png ../[DECK-ID]/1-raw/art "_inspyrene"
```

---

## 6. Phase 4: Card Compositing (External Renderer)

**Time:** 2 min (automated)

The React/Node compositor (maintained in `engine/`) reads the raw assets and sliced typography, then produces:
- Final 200×300 PNG cards → `3-game-cards/`
- Dark‑background Kling inputs → `1-raw/kling-input/`

**Command (example):**
```bash
cd engine
npm run compose -- --deck [DECK-ID] --suffix _inspyrene
```

---

## 7. Phase 5: Video Generation (Kling AI)

**Target:** 16 animations (4 Aces + 12 Face Cards)

1. Go to klingai.com → Image to Video.
2. Upload each image from `1-raw/kling-input/`.
3. Paste the animation description from the brief.
4. Append the suffix:  
   `"Subtle slow motion, smooth motion, cinematic, no fast movements, no camera shake, background remains completely stable, 2 seconds"`
5. Download MP4 → `1-raw/video/`.

---

## 8. Phase 6: Video Conversion (FFmpeg)

**Time:** 5 min

Run `tools/convert-video.sh` (provided separately).

**Command:**
```bash
cd tools
bash convert-video.sh
```

---

## 9. Weekly Production Schedule (v14.14)

| Day | Task | Time |
|-----|------|------|
| Monday | Phase 1 (DeepSeek Brief with style‑agnostic template) | 15 min |
| Tuesday | Phase 2 (FluxGen + Ideogram) + bgbye.io | 40 min |
| Wednesday | Phase 3 (slice_typo.py) + Phase 4 (compositing) | 10 min |
| Thursday | Phase 5 (Kling: first 6 videos) | 15 min |
| Friday | Phase 5 (remaining 10 videos) | 15 min |
| Next Monday | Phase 6 (FFmpeg conversion) + deploy | 15 min |

**Total active human time per deck: ~2 hours**

---

**End of SOP v14.14**
