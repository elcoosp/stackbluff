# StackBluff Cosmetic Deck Production — Automated SOP (v14.0)

**Budget:** $0 (No API Keys, Free Tiers Only)  
**Core Updates (v14.0):** 
1. **Unified Raw Folder:** The `1-raw/pips/` folder is removed. All raw AI-generated images (including `pip-*` files) now go directly into `1-raw/art/`. This simplifies the bgbye.io extraction process—just drag and drop the whole unzipped output into one folder.
2. **Script Updated:** `composite-engine.py` updated to look for pips inside the `1-raw/art/` directory.

---

## 1. The "English Pattern" Design Rules

1. **Reversible (Double-Headed):** Face cards are symmetrical. AI generates **a 1:1 SQUARE waist-up bust**. Python duplicates, rotates 180°, and pastes it for the bottom half.
2. **The 'One-Eyed' Royals:** Jack of Spades, Jack of Hearts, King of Diamonds in profile (one eye).
3. **The 'Suicide King':** King of Hearts holds weapon behind his head.
4. **French-Suited Pips:** Standard ♠♥♦♣ shapes (stylized interior).
5. **Copperplate Engraving Style:** Cross-hatching, fine lines, vintage engraving aesthetics.
6. **Absolute White Backgrounds:** Every generated asset must be prompted on a pure white background (cleaned up by bgbye.io).

---

## 2. Master Folder Structure

```text
stackbluff-cosmetics/
│
├── engine/                            # GLOBAL AUTOMATION ENGINE
│   ├── composite-engine.py            # Handles _birefnet/_inspyrenet suffixes natively
│   ├── convert-engine.sh              # FFmpeg: converts MP4s to WebP
│   ├── fonts/
│   │   └── Inter-Bold.ttf
│   └── base-pips/
│
├── 2026-Q1/                           # SEASON 1 & 2 DECKS
│   ├── 01-neon-ronin/
│   └── ...
│
└── [DECK-ID]/                         # TEMPLATE FOR SINGLE DECK
    ├── 0-brief/
    ├── 1-raw/                         
    │   ├── art/                       # ALL raw AI images + bgbye suffixed variants (pips & cards)
    │   ├── kling-input/               # SCRIPT OUTPUT: Dark-bg images to feed Kling
    │   └── video/                     # Raw MP4s from Kling
    ├── 2-pips/                        # SCRIPT OUTPUT: Resized pips
    ├── 3-game-cards/                  # SCRIPT OUTPUT: Final 200x300 PNGs
    ├── 4-animated/                    # SCRIPT OUTPUT: Final 200x300 WebPs
    └── manifest.json                  
```

---

## 3. Phase 1: Concept & Briefing (DeepSeek)

**Time:** 15 minutes  

1. Open DeepSeek.
2. Paste the **Master Brief Prompt Template** below.
3. Do **NOT** replace the theme. Let the AI invent one.
4. Save output as `0-brief/brief.md`.

### Master Brief Prompt Template (Copy/Paste exactly)

```text
I am designing a cosmetic deck of playing cards for a poker game. 

Your first task is to invent a highly detailed, original, and cohesive theme for this deck (e.g., "Bioluminescent Deep Sea", "Clockwork Renaissance", "Neon Cyberpunk Samurais"). Do not use standard themes like "Fantasy" or "Dragons" without a unique twist.

CRITICAL DESIGN RULES FOR IMAGE PROMPTS:
1. English Pattern: Reversible (Double-Headed) face cards. AI MUST generate ONLY a "waist-up bust" in a 1:1 SQUARE aspect ratio. The bottom of the image must be a flat horizontal crop. We duplicate/flip this in code.
2. One-Eyed Royals: Jack of Spades, Jack of Hearts, King of Diamonds drawn in profile (one eye).
3. Suicide King: King of Hearts holds weapon behind his head.
4. Art Style: Vintage copperplate engraving style adapted to the theme.
5. ABSOLUTE WHITE BACKGROUND: EVERY image prompt MUST specify a pure white background. No dark colors, no gradients, no grey.
6. NAMING & ASPECT RATIO: EVERY prompt block must be prefixed with its exact kebab-case filename and aspect ratio tag in brackets, like `### [king-spades] [SQUARE]` or `### [ace-hearts] [PORTRAIT]`.
7. SELF-CONTAINED PROMPTS: You MUST generate fully complete prompts. I will copy-paste these directly into the image generator. Do NOT use placeholders.
8. PROMPT STRUCTURE: Every prompt block MUST contain a "Positive:" field and a "Negative:" field.

Output EXACTLY this format:

## DECK NAME
[2-3 word catchy name, hyphenated]

## COLOR PALETTE
- Primary dark (Rim color): [hex]
- Primary accent (Frame color): [hex]
- Secondary accent: [hex]

## HIDDEN GEMS SYSTEM
1. Narrative Arc: Which suit tells a story from 2 to 10? What is the story?
2. Recurring Mascot: What tiny creature/element is hidden in the 12 face card busts?
3. Reflection Secret: What image do the two Jokers form when overlaid?

## CUSTOM PIP DESIGNS
Standard shapes (♠♥♦♣) with themed interiors.
- ♠ Spade: [describe interior/edge/glow]
- ♥ Heart: [describe]
- ♦ Diamond: [describe]
- ♣ Club: [describe]

## PIP GENERATION PROMPTS
4 prompts. MUST be fully self-contained.
- ♠: 
  "### [pip-spade] [SQUARE]
  Positive: A stylized spade symbol (♠), vintage copperplate engraving style, [YOUR INVENTED THEME DETAILS], [interior detail], [edge treatment], single centered symbol, pure white background, high detail, vector-like clarity, 1:1 aspect ratio
  Negative: multiple symbols, borders, text, letters, numbers, 3d render, photorealistic, dark background, grey background, gradient background, scenery"
- ♥: "### [pip-heart] [SQUARE]..." (same structure)
- ♦: "### [pip-diamond] [SQUARE]..." (same structure)
- ♣: "### [pip-club] [SQUARE]..." (same structure)

## CORNER INDEX PLAQUE
A single small decorative shield or oval frame that will hold the rank and suit pip in the card corners.  
Design it in the same vintage copperplate engraving style as the deck, using the deck's color palette.  
It must be a **centred, isolated emblem on a pure white background**, with empty centre space for placing text and a pip.

Positive: An ornate corner index plaque, vintage copperplate engraving style, [THEMED MOTIFS – e.g., intertwining thorny vines and tiny poison berries], empty centre, decorative frame, pure white background, high detail, sharp lines, 1:1 aspect ratio  
Negative: text, letters, numbers, symbols, suit pips, dark background, grey background, scenery, shadows

The output filename should be corner-plaque. It will be a square (1:1) image—the script will resize it to a fixed corner size.

## CENTRE BAND (Waistline Ornament)
A horizontal decorative band that sits across the exact middle of the reversible face cards.  
It must be purely ornamental, symmetrical left‑to‑right, with the same vintage copperplate engraving style.  
It will be placed over the junction of the two bust halves, so it **must be horizontally centred in a wide frame** with absolutely empty space above and below.

Positive: Horizontal ornamental band, vintage copperplate engraving, [THEMED MOTIFS], symmetrical, delicate, no characters, pure white background, long horizontal composition  
Negative: text, letters, numbers, suit symbols, faces, dark background, grey background, scenery, card edges
The output filename: center-band. The AI will generate a wide‑format image. That’s fine—bgbye.io will remove the white, and your script will resize it to the card width and a fixed height.

## IMAGE GENERATION PROMPTS
EVERY prompt block must have a Positive and Negative field. EVERY Positive prompt must include "pure white background" and end with the correct aspect ratio.
## CARD BORDER
A delicate, symmetrical ornamental border that will frame the entire card.  
Design in the same vintage copperplate engraving style. The border must outline a 2:3 rectangle with an **absolutely empty, transparent centre**. Pure white background.

Positive: Ornate vintage card border, symmetrical, empty centre, corner flourishes, delicate linework, [THEMED MOTIFS], pure white background, high detail, 2:3 aspect ratio  
Negative: text, letters, numbers, dark background, grey background, filled centre, solid shapes, scenery
Generate border.png as a portrait image, then process with bgbye.io → border_birefnet.png and border_inspyrenet.png.
### Card Back
"### [back] [PORTRAIT]
Positive: [Symmetrical ornate pattern fully detailed...], vintage copperplate engraving style, pure white background, 2:3 aspect ratio
Negative: text, letters, numbers, asymmetrical, bordered, card shape, dark background, grey background"

### Aces (4 prompts)
[Translate "Ace" to "Ornate Object". The suit symbol MUST be the central focus. NO characters.]
"### [ace-spades] [PORTRAIT]
Positive: [Fully detailed ornate object...], vintage copperplate engraving style, pure white background, 2:3 aspect ratio
Negative: text, letters, numbers, characters, people, scenery, borders, card shape, full deck, dark background"
... (all 4 aces, self-contained)

### Face Cards (12 prompts)
[Translate to royalty titles. MUST specify regal forward-facing pose holding the suit symbol. MUST mention hiding the Recurring Mascot. APPLY ONE-EYED AND SUICIDE KING RULES. MUST end positive prompt with: "vintage copperplate engraving style, traditional French-suited playing card aesthetic, waist-up bust portrait only with flat bottom edge, pure white background, isolated, centered composition, high contrast cross-hatching, high detail digital art, 1:1 aspect ratio"]
"### [king-spades] [SQUARE]
Positive: [Fully detailed character...], vintage copperplate engraving style, traditional French-suited playing card aesthetic, waist-up bust portrait only with flat bottom edge, holding a spade symbol, pure white background, isolated, centered composition, high contrast cross-hatching, high detail digital art, 1:1 aspect ratio
Negative: full body, legs, action pose, dynamic pose, scenery, landscapes, borders, card edges, text, letters, numbers, multiple figures, blurry, dark background, grey background"

"### [king-hearts] [SQUARE]
Positive: [MUST include: 'holding his weapon behind his head (Suicide King style)'...], vintage copperplate engraving style... pure white background... 1:1 aspect ratio
Negative: full body, legs, action pose..., dark background"

"### [king-diamonds] [SQUARE]
Positive: [MUST include: 'drawn in profile, showing only one eye (One-Eyed Royal)'...], vintage copperplate engraving style... pure white background... 1:1 aspect ratio
Negative: full body, legs, action pose..., dark background"

"### [queen-spades] [SQUARE]..." 
... (all 12 face cards, self-contained)

### Number Cards (9 prompts for the Narrative Arc suit ONLY)
[Translate "2 of X" to story step. MUST include the suit symbol. Use 2:3 aspect ratio.]
"### [2-spades] [PORTRAIT]
Positive: [Fully detailed story scene...], vintage copperplate engraving style, pure white background, 2:3 aspect ratio
Negative: text, letters, numbers, borders, card shape, people, faces, dark background"
... (9 total, self-contained)

### Number Card Template (1 prompt for the remaining 3 suits)
"### [number-template] [PORTRAIT]
Positive: [Fully detailed decorative suit pattern...], vintage copperplate engraving style, pure white background, 2:3 aspect ratio
Negative: text, letters, numbers, borders, card shape, people, faces, dark background"

### Jokers (2 prompts)
[Full figure allowed for Jokers. 2:3 aspect ratio.]
"### [joker-1] [PORTRAIT]
Positive: [Fully detailed left-half trickster...], vintage copperplate engraving style, pure white background, 2:3 aspect ratio
Negative: text, letters, numbers, borders, card shape, right half, dark background"
"### [joker-2] [PORTRAIT]
Positive: [Fully detailed right-half trickster...], vintage copperplate engraving style, pure white background, 2:3 aspect ratio
Negative: text, letters, numbers, borders, card shape, left half, dark background"

## ANIMATION DESCRIPTIONS (For Kling AI)
Describe a subtle 2-second animation for the 16 animated cards (4 Aces + 12 Face Cards).
- [ace-spades]: [what moves/glows/pulses]
... (list all 16)
```

---

## 4. Phase 2: Asset Generation (Perchance / FluxGen)

**Time:** ~30-45 minutes 

1. Go to **https://perchance.org/fluxgen**.
2. Set up the generator. You will be generating in batches.

### Batch Strategy
*   **Batch 1: Pips (4 images)** -> Save as `pip-spade.png`, etc.
*   **Batch 2: Back, Aces, Jokers (7 images)** -> Save as `back.png`, `ace-spades.png`, etc.
*   **Batch 3: Face Cards (12 images)** -> Verify each is a **1:1 SQUARE waist-up bust**. Save as `king-spades.png`, etc.
*   **Batch 4: Number Cards & Template (10 images)** -> Save with kebab-case names.

---

## 5. Phase 2.5: AI Background Removal (bgbye.io)

**Time:** ~15 minutes  

1. Go to **https://bgbye.io/**.
2. Upload **all** the raw generated assets (pips and cards together).
3. Process them. Download the resulting `all_background_removal_results.zip`.
4. Unzip the file.
5. Move **ALL** the files ending in `_birefnet.png` AND `_inspyrenet.png` into the single `1-raw/art/` folder.
6. **Do NOT rename them.** Keep the suffixes (e.g., `pip-spade_birefnet.png`, `king-hearts_inspyrenet.png`). 

---

## 6. Phase 3: Automated Prep & Compositing (Python/Pillow)

**Time:** 2 minutes  

Before running the script, open `engine/composite-engine.py` and set the `BG_SUFFIX` variable at the top to whichever variant produced the cleaner masks for your deck.

Run the script:
```bash
cd engine
python composite-engine.py
```
This will automatically find the suffixed files inside `1-raw/art/`, composite the reversible cards, and output to `2-pips/`, `3-game-cards/`, and `1-raw/kling-input/`.

### `engine/composite-engine.py`

---

## 7. Phase 4: Video Generation (Kling AI Free Tier)

**Target:** 16 Animations (4 Aces + 12 Face Cards).  
**Schedule:** ~6 videos per day. Takes 3 days.

1. Go to klingai.com → Image to Video.
2. Upload the image from **`1-raw/kling-input/`**.
3. Paste the Animation Description.
4. **Suffix the prompt with:** `"Subtle slow motion, smooth motion, cinematic, no fast movements, no camera shake, background remains completely stable, symmetrical elements mirror perfectly, 2 seconds"`
5. Download the MP4 and save it to `1-raw/video/`.

---

## 8. Phase 5: Automated Video Conversion (FFmpeg)

**Time:** 5 minutes  

Run the script:
```bash
cd engine
bash convert-engine.sh
```

---

## 9. The Lean Weekly Production Schedule

| Day | Task | Human Time |
|-----|------|-----------|
| **Monday** | Phase 1 (DeepSeek Brief) | 15 min |
| **Tuesday**| Phase 2 (FluxGen Batch) + Phase 2.5 (bgbye.io unzip to `1-raw/art/`) | 30 min |
| **Wednesday**| Phase 3 (Configure `BG_SUFFIX` + Run `composite-engine.py`) | 10 min |
| **Thursday**| Phase 4 (Kling: First 6 Videos) | 15 min |
| **Friday** | Phase 4 (Kling: Next 6 Videos + 4 Aces) | 15 min |
| **Next Monday**| Phase 5 (Run `convert-engine.sh`) + Phase 6 (Deploy) | 15 min |

**Total Active Human Time Per Deck: ~1.5 - 2 Hours**
