This blueprint distills our successful prompting strategy into a reusable system. It outlines the **structural rules** required to generate single busts that you can manually mirror into double-headed court cards, along with the **style variables** for the three aesthetics we successfully developed.

---

# The "Single Bust Card" Prompting Blueprint

## Phase 1: The Immutable Constraints (The Foundation)
*These rules apply to **every** generation to ensure the figure can be flipped and mirrored.*

1.  **Aspect Ratio:** `Vertical 9:16` (Crucial for bust composition).
2.  **Subject:** `Bust Portrait` (Head to chest/waist only).
3.  **Background:** `Solid White` (No card borders, frames, or textures).
4.  **Symmetry:** `Perfectly Symmetrical Frontal Pose` (For standard mirroring) OR `Side Profile` (If you want figures facing each other when mirrored).
    *   *Note:* If you use Profile, the top figure looks Left, and the bottom figure (flipped) looks Left (which is Up), creating the "facing each other" court card look.
5.  **The Hem:** The bottom of the garment must have a `finished, geometric hem` or `patterned trim`. This creates a clean seam when you join the two images.

---

## Phase 2: The Master Template
*Copy this structure. It is the backbone that prevents "broken hands" and "card borders."*

```text
A vertical 9:16 [ART_MEDIUM] illustration. The subject is a [RANK_DESCRIPTION] bust portrait, isolated on a solid white background. The figure is depicted in [POSE].

The art style features [STYLE_KEYWORDS]. The face has [FACIAL_FEATURES]. The figure wears [HEADWEAR] and [ATTIRE_TYPE] adorned with [PATTERN_TYPE] patterns in [PATTERN_COLOR]. The hands are [HAND_STYLE], holding a [PROP].

The color palette uses [MAIN_COLOR], [SECONDARY_COLOR], and [ACCENT_COLOR]. The design is flat with no 3D shading or gradients. The bottom of the attire features a [HEM_STYLE] for seamless mirroring. No card border, no frame, no text, no suit symbols.
```

---

## Phase 3: The Style Dictionary (Injecting "Flavor")
*Use these specific blocks of text to replace the placeholders in the Master Template. We tested these three specific styles successfully.*

### Style A: Stylized Vintage Card (The "Simplified" Look)
*Best for:* Classic Poker aesthetics, Rouennais patterns, minimal realism.

*   **[ART_MEDIUM]:** `Flat vector / Vintage lithograph`
*   **[STYLE_KEYWORDS]:** `Clean black outlines, solid color blocks, simplified lines`
*   **[PATTERN_TYPE]:** `Cross-hatching, checkers, or argyle`
*   **[HAND_STYLE]:** `Simplified geometric shapes`

### Style B: Japanese Ukiyo-e (The "Woodblock" Look)
*Best for:* Samurai/Empress themes, cultural designs, flowing lines.

*   **[ART_MEDIUM]:** `Traditional Ukiyo-e woodblock print`
*   **[STYLE_KEYWORDS]:** `Bold calligraphic outlines, flat color blocking, subtle paper texture`
*   **[PATTERN_TYPE]:** `Seigaiha (waves), Asanoha (hemp), or Kikkō (tortoise shell)`
*   **[HAND_STYLE]:** `Stylized blocky hands`

### Style C: Ligne Claire / Hergé (The "Tintin" Look)
*Best for:* Bright, clean, European comic aesthetics, caricatured features.

*   **[ART_MEDIUM]:** `Ligne Claire (Clear Line) style`
*   **[STYLE_KEYWORDS]:** `Uniform black outlines of equal thickness, flat bright coloring`
*   **[PATTERN_TYPE]:** `Large checkers, polka dots, or stripes`
*   **[HAND_STYLE]:** `Clean graphical shapes`

---

## Phase 4: The "Anti-Fail" Negative Prompt
*Always append this to filter out unwanted artifacts.*

```text
Realistic, photorealistic, 3D render, CG, anime, manga, sketchy, messy lines, variable line width, watercolor, oil painting, heavy shading, shadows, volume, depth, gradient, round shapes, soft edges, card, playing card, rectangle, square, border, frame, container, edge, rounded corners, realistic hair strands, detailed fingers, broken fingers, extra fingers, mutated hands, claw, text, typography, letters, numbers, suit symbols, hearts, spades, diamonds, clubs, pips, grey background, watermark, signature, logo.
```

---

## Phase 5: Example Application (How to Assemble)

*Goal:* Create a **Queen** in **Japanese Style**.

1.  **Base:** "A vertical 9:16 **Traditional Ukiyo-e woodblock print** illustration..."
2.  **Subject:** "...The subject is a **noble Queen** bust portrait, isolated on a solid white background..."
3.  **Pose:** "...The figure is depicted in **side profile**..."
4.  **Style:** "...The art style features **bold calligraphic outlines, flat color blocking**..."
5.  **Details:** "...The face has **painted white face makeup**. The figure wears **a jeweled tiara and a layered Kimono** adorned with **floating clouds** patterns..."
6.  **Props:** "...The hands are **stylized blocky hands**, holding a **Tessen (war fan)**..."
7.  **Colors:** "...The color palette uses **Vermilion red**, **white**, and **gold leaf**..."
8.  **Hem:** "...The bottom of the attire features a **patterned hem** for seamless mirroring..."

**Result:** A prompt that generates a clean, single-bust Japanese Queen with no card frame, ready to be flipped for your double-headed design.
