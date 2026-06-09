#!/usr/bin/env python3
"""
assemble_brief.py - Generates a complete brief.md without placeholders.
All illustrations use precise Hergé/Tintin comic style keywords.
"""

import argparse
import json
from pathlib import Path
from typing import Any, Dict, List

# ----------------------------------------------------------------------
# Helper functions (unchanged)
# ----------------------------------------------------------------------


def load_json(path: Path) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def get_character_state(character: Dict, state_key: str) -> str:
    evo = character.get("evolution_track", {}).get(state_key, {})
    return evo.get("visual_changes", "")


def build_character_description(
    character: Dict, state_key: str, rarity_mods: str = ""
) -> str:
    vis = character.get("visual_description", {})
    base = vis.get("base_appearance", {})
    clothing = vis.get("clothing", {})
    desc = (
        f"{base.get('face', '')}, {base.get('eyes', '')}, {base.get('hair', '')}, {base.get('build', '')}. "
        f"Wearing {clothing.get('primary', '')} with {clothing.get('details', '')}. "
        f"Holds {vis.get('weapon', '')}. Distinctive mark: {vis.get('distinctive_marks', '')}. "
        f"Evolution state: {get_character_state(character, state_key)}. "
        f"Mannerisms: {vis.get('mannerisms', '')}."
    )
    if rarity_mods:
        desc += f" Rarity effects: {rarity_mods}"
    return desc


def get_rarity_modifiers(rarity_config: Dict, card_rarity: str) -> str:
    mods = rarity_config.get(card_rarity, {}).get("visual_modifiers", {})
    return ", ".join([f"{k}: {v}" for k, v in mods.items()])


def get_color_palette_from_clans(clans: Dict, deck: Dict) -> tuple:
    first_clan_id = next(iter(deck.get("clan_per_suit", {}).values()))
    clan = clans.get(first_clan_id, {})
    vis = clan.get("visual_dna", {})
    return (
        vis.get("primary_dark", "#000000"),
        vis.get("primary_accent", "#FFFFFF"),
        vis.get("secondary", "#888888"),
    )


def generate_theme_description(deck: Dict, clans: Dict, suit_hint: str = "") -> str:
    """Return a rich theme description (no placeholders)."""
    theme = deck.get("theme", "")
    clan_id = deck.get("clan_per_suit", {}).get(
        suit_hint
        if suit_hint in ["spades", "hearts", "diamonds", "clubs"]
        else "spades",
        "",
    )
    clan = clans.get(clan_id, {})
    vis = clan.get("visual_dna", {})
    style_hint = vis.get("silhouette", "ornate")
    return f"{theme}, rendered in {style_hint} Hergé Tintin style with {vis.get('border_accent', 'delicate linework')}"


# ----------------------------------------------------------------------
# CONSTANT NEGATIVE PROMPT (precise anti‑Tintin keywords)
# ----------------------------------------------------------------------
NEGATIVE_BUST = """Moebius, Jean Giraud, Enki Bilal, Francois Schuiten, Yves Chaland, atomic style, Incal, Casterman, watercolor texture, shading, 3D render, anime, manga, CG, sketchy lines, photo-realistic, heavy shading, shadows, volume, depth, gradient, round shapes, soft edges, card, playing card, rectangle, square, border, frame, container, edge, rounded corners, realistic hair strands, detailed fingers, broken fingers, extra fingers, mutated hands, claw, text, typography, letters, numbers, suit symbols, hearts, spades, diamonds, clubs, pips, grey background, watermark, signature, logo."""

NEGATIVE_PIP = """Moebius, Jean Giraud, Enki Bilal, Francois Schuiten, Yves Chaland, atomic style, Incal, Casterman, watercolor texture, shading, 3D render, anime, manga, CG, sketchy lines, photo-realistic, multiple symbols, borders, text, letters, numbers, colored background, scenery, dark background, card shape, frame"""

NEGATIVE_BORDER = """Moebius, Jean Giraud, Enki Bilal, Francois Schuiten, Yves Chaland, atomic style, Incal, Casterman, watercolor texture, shading, 3D render, anime, manga, CG, sketchy lines, photo-realistic, text, letters, numbers, dark background, grey background, filled centre, solid shapes, scenery, realistic"""

# ----------------------------------------------------------------------
# Section generators (all in precise Hergé Tintin style)
# ----------------------------------------------------------------------


def generate_header(
    deck: Dict, primary_dark: str, primary_accent: str, secondary: str
) -> List[str]:
    lines = []
    lines.append(f"# {deck['deck_name'].replace('_', ' ').title()} — Design Brief")
    lines.append("")
    lines.append("## DECK NAME")
    lines.append(deck["deck_name"].replace("_", " ").title())
    lines.append("")
    lines.append("## COLOR PALETTE")
    lines.append(f"- Primary dark (Rim color): {primary_dark}")
    lines.append(f"- Primary accent (Frame color): {primary_accent}")
    lines.append(f"- Secondary accent: {secondary}")
    lines.append("")
    return lines


def generate_visual_style_rules() -> List[str]:
    return [
        "## VISUAL STYLE & LAYOUT RULES",
        "MANDATORY POSITIVE KEYWORDS: Hergé Tintin comic style, uniform line weight, ligne claire (clear line), no hatching, flat bright coloring, pure solid color fills, simple geometric shapes for clothing.",
        "MANDATORY NEGATIVE KEYWORDS: Moebius, Jean Giraud, Enki Bilal, Francois Schuiten, Yves Chaland, atomic style, Incal, Casterman, watercolor texture, shading, 3D render, anime, manga, CG, sketchy lines.",
        "Character busts (Kings, Queens, Jacks, Aces, Jokers): 9:16 vertical, solid white background, perfectly symmetrical frontal pose (except jokers in side profile).",
        "No rank letters, no suit symbols, no card borders, no text on character illustrations.",
        "",
    ]


def generate_hidden_gems(deck: Dict) -> List[str]:
    lines = ["## HIDDEN GEMS SYSTEM"]
    lines.append(
        f"1. **Narrative Arc:** The {deck['narrative_arc_suit'].upper()} suit tells a story from 2 to 10."
    )
    for i, step in enumerate(deck.get("narrative_steps", []), start=2):
        lines.append(f"   - {i}{deck['narrative_arc_suit'].upper()}: {step}")
    mascot = deck.get("recurring_mascot", {})
    lines.append(
        f"2. **Recurring Mascot:** {mascot.get('name', 'Mascot')} – {mascot.get('description', '')}. Hidden on every face card and the typography grid."
    )
    secret = deck.get("reflection_secret", {})
    lines.append(
        f"3. **Reflection Secret:** The two Jokers overlay – Left: {secret.get('joker_left', '')} / Right: {secret.get('joker_right', '')}"
    )
    lines.append("")
    return lines


def generate_custom_pip_designs(clans: Dict, deck: Dict) -> List[str]:
    lines = [
        "## CUSTOM PIP DESIGNS",
        "The four suit symbols follow the clan visual DNA of the suit they belong to (Hergé Tintin style).",
    ]
    for suit, clan_id in deck.get("clan_per_suit", {}).items():
        clan = clans.get(clan_id, {})
        vis = clan.get("visual_dna", {})
        color = (
            vis.get("primary_accent", "#000")
            if suit in ["hearts", "diamonds"]
            else vis.get("primary_dark", "#000")
        )
        lines.append(
            f"- **{suit.upper()}** : {vis.get('silhouette', 'stylised')} shape, interior {vis.get('pip_texture', 'textured')}, edge {vis.get('border_accent', 'simple')}, color {color}"
        )
    lines.append("")
    return lines


def generate_pip_prompts(deck: Dict, clans: Dict) -> List[str]:
    lines = []
    theme_desc = generate_theme_description(deck, clans)
    for suit in ["spade", "heart", "diamond", "club"]:
        lines.append(f"### [pip-{suit}] [SQUARE]")
        lines.append(
            f"Positive: A stylized {suit} symbol (♠♥♦♣), Hergé Tintin comic style, uniform black outlines, flat bright coloring, {theme_desc}, single centered symbol, pure white background, high detail, vector-like clarity, 1:1 aspect ratio"
        )
        lines.append(f"Negative: {NEGATIVE_PIP}")
        lines.append("")
    return lines


def generate_corner_plaque(deck: Dict, clans: Dict) -> List[str]:
    theme_desc = generate_theme_description(deck, clans)
    lines = ["## CORNER INDEX PLAQUE", "### [corner-plaque] [SQUARE]"]
    lines.append(
        f"Positive: An ornate corner index plaque, Hergé Tintin style, uniform black outlines, {theme_desc}, empty centre, pure white background, 1:1 aspect ratio"
    )
    lines.append(f"Negative: {NEGATIVE_PIP}")
    lines.append("")
    return lines


def generate_typography_grid(
    primary_dark: str, primary_accent: str, mascot_name: str, deck: Dict, clans: Dict
) -> List[str]:
    theme_desc = generate_theme_description(deck, clans)
    lines = ["## UNIFIED TYPOGRAPHY GRID", "### [grid-typography] [LANDSCAPE] (16:9)"]
    lines.append(
        f"Positive: A 2x13 grid of characters. Top row: 'A','K','Q','J','2','3','4','5','6','7','8','9','10' in {primary_dark}. Bottom row: same sequence in {primary_accent}. Each character isolated with generous white space. No grid lines, no borders. Hergé Tintin comic style, {theme_desc} forming each character. The {mascot_name} is hidden once within the linework of one character. pure white background, 16:9 aspect ratio."
    )
    lines.append(
        "Negative: grid lines, borders, cell outlines, text outside grid, lowercase, 3d render, shadows, dark/grey background, blurry, misaligned, duplicate/missing/touching/overlapping characters, line break inside row."
    )
    lines.append("")
    return lines


def generate_card_border(deck: Dict, clans: Dict) -> List[str]:
    theme_desc = generate_theme_description(deck, clans)
    lines = ["## CARD BORDER", "### [border] [PORTRAIT] (2:3)"]
    lines.append(
        f"Positive: Ornate vintage card border, symmetrical, empty centre, corner flourishes, Hergé Tintin style, uniform black outlines, {theme_desc}, delicate linework, pure white background, 2:3 aspect ratio"
    )
    lines.append(f"Negative: {NEGATIVE_BORDER}")
    lines.append("")
    return lines


def generate_card_back(deck: Dict, clans: Dict) -> List[str]:
    theme_desc = generate_theme_description(deck, clans)
    lines = ["## CARD BACK", "### [back] [PORTRAIT] (2:3)"]
    lines.append(
        f"Positive: A symmetrical, ornate pattern, featuring {theme_desc} as the centerpiece, radiating motifs. Hergé Tintin style, uniform black outlines, flat bright coloring, pure white background, 2:3 aspect ratio"
    )
    lines.append(f"Negative: {NEGATIVE_BORDER}")
    lines.append("")
    return lines


def generate_aces(
    deck: Dict, characters: Dict, rarity_config: Dict, clans: Dict
) -> List[str]:
    """Aces are character busts (9:16), Hergé Tintin style."""
    lines = ["## ACES (4 cards)"]
    for suit in ["spades", "hearts", "diamonds", "clubs"]:
        char_id = deck.get("face_card_assignment", {}).get("ace", {}).get(suit, "")
        if not char_id:
            continue
        character = characters.get(char_id, {})
        clan_id = deck.get("clan_per_suit", {}).get(suit, "")
        clan = clans.get(clan_id, {})
        state_key = deck.get("character_state_map", {}).get(char_id, "deck_1")
        desc = build_character_description(character, state_key, "")
        primary = clan.get("visual_dna", {}).get("primary_accent", "#000")
        secondary = clan.get("visual_dna", {}).get("secondary", "#fff")
        positive = (
            f"A vertical 9:16 illustration in the Hergé Tintin comic style. "
            f"The subject is an Ace bust portrait, isolated on a solid white background. "
            f"The figure is depicted in a perfectly symmetrical frontal pose, flat composition. "
            f"The style uses uniform line weight (ligne claire/clear line) with consistent width outlines and no hatching. "
            f"Flat, bright coloring with no shading or gradients, pure solid color fills. "
            f"Face design: {desc} "
            f"Clothing folds and details are drawn with simple geometric shapes. "
            f"The color palette uses {primary}, {secondary}, and white. "
            f"The bottom of the attire features a finished geometric hem for seamless mirroring. "
            f"No card border, no frame, no text, no suit symbols."
        )
        lines.append(f"### [ace-{suit}] [PORTRAIT]")
        lines.append(f"Positive: {positive}")
        lines.append(f"Negative: {NEGATIVE_BUST}")
        lines.append("")
    return lines


def generate_face_cards(
    deck: Dict,
    characters: Dict,
    clans: Dict,
    rarity_config: Dict,
    mascot_name: str,
    theme: str,
    global_event: str,
) -> List[str]:
    lines = ["## FACE CARDS (12 cards)"]
    for rank in ["king", "queen", "jack"]:
        for suit in ["spades", "hearts", "diamonds", "clubs"]:
            char_id = deck.get("face_card_assignment", {}).get(rank, {}).get(suit, "")
            if not char_id:
                continue
            character = characters.get(char_id, {})
            clan_id = deck.get("clan_per_suit", {}).get(suit, "")
            clan = clans.get(clan_id, {})
            state_key = deck.get("character_state_map", {}).get(char_id, "deck_1")
            desc = build_character_description(character, state_key, "")
            rank_title = rank.capitalize()
            primary = clan.get("visual_dna", {}).get("primary_accent", "#000")
            secondary = clan.get("visual_dna", {}).get("secondary", "#fff")
            positive = (
                f"A vertical 9:16 illustration in the Hergé Tintin comic style. "
                f"The subject is a {rank_title} bust portrait, isolated on a solid white background. "
                f"The figure is depicted in a perfectly symmetrical frontal pose, flat composition. "
                f"The style uses uniform line weight (ligne claire/clear line) with consistent width outlines and no hatching. "
                f"Flat, bright coloring with no shading or gradients, pure solid color fills. "
                f"Face design: {desc} "
                f"Clothing folds and details are drawn with simple geometric shapes. "
                f"The color palette uses {primary}, {secondary}, and white. "
                f"The bottom of the attire features a finished geometric hem for seamless mirroring. "
                f"No card border, no frame, no text, no suit symbols. "
                f"Background hints at {global_event}. "
                f"The {mascot_name} is hidden once in the linework."
            )
            lines.append(f"### [{rank}-{suit}] [SQUARE]")
            lines.append(f"Positive: {positive}")
            lines.append(f"Negative: {NEGATIVE_BUST}")
            lines.append("")
    return lines


def generate_number_cards(deck: Dict, global_event: str) -> List[str]:
    lines = []
    suit = deck.get("narrative_arc_suit", "clubs")
    steps = deck.get("narrative_steps", [])
    if not steps:
        return lines
    lines.append(f"## NUMBER CARDS – NARRATIVE ARC ({suit.upper()} suit, 9 cards)")
    for i, step in enumerate(steps, start=2):
        positive = (
            f"A vertical 9:16 illustration in the Hergé Tintin comic style. "
            f"The scene is isolated on a solid white background. "
            f"Depict: {step} "
            f"Uniform black outlines, flat bright coloring, no shading, simple geometric shapes. "
            f"No text, no numbers, no borders, no card elements. "
            f"The composition is centered and balanced. "
            f"Background hints at {global_event}."
        )
        lines.append(f"### [{i}-{suit}] [PORTRAIT]")
        lines.append(f"Positive: {positive}")
        lines.append(f"Negative: {NEGATIVE_BUST}")
        lines.append("")
    return lines


def generate_number_template(deck: Dict, clans: Dict) -> List[str]:
    theme_desc = generate_theme_description(deck, clans)
    lines = [
        "## NUMBER CARD TEMPLATE (for non‑narrative suits)",
        "### [number-template] [PORTRAIT]",
    ]
    lines.append(
        f"Positive: A repeating decorative pattern of {theme_desc} arranged in a grid, Hergé Tintin style, uniform black outlines, flat bright coloring, pure white background, 2:3 aspect ratio"
    )
    lines.append(f"Negative: {NEGATIVE_BORDER}")
    lines.append("")
    return lines


def generate_jokers(deck: Dict, characters: Dict, global_event: str) -> List[str]:
    lines = ["## JOKERS (2 cards)"]
    secret = deck.get("reflection_secret", {})
    left_desc = secret.get("joker_left", "")
    right_desc = secret.get("joker_right", "")
    char_id = "calculus"  # adjust if your deck uses another character
    character = characters.get(char_id, {})
    state_key = deck.get("character_state_map", {}).get(char_id, "deck_1")
    desc = build_character_description(character, state_key, "")
    # Left joker – facing left
    positive_left = (
        f"A vertical 9:16 illustration in the Hergé Tintin comic style. "
        f"The subject is a Joker bust portrait, isolated on a solid white background. "
        f"The figure is depicted in side profile, facing left, flat composition. "
        f"The style uses uniform line weight (ligne claire/clear line) with consistent width outlines and no hatching. "
        f"Flat, bright coloring with no shading or gradients, pure solid color fills. "
        f"Face design: {desc} "
        f"Additional detail: {left_desc}. "
        f"Clothing folds are drawn with simple geometric shapes. "
        f"The bottom of the attire features a finished geometric hem for seamless mirroring. "
        f"No card border, no frame, no text, no suit symbols. "
        f"Background hints at {global_event}."
    )
    # Right joker – facing right
    positive_right = (
        f"A vertical 9:16 illustration in the Hergé Tintin comic style. "
        f"The subject is a Joker bust portrait, isolated on a solid white background. "
        f"The figure is depicted in side profile, facing right, flat composition. "
        f"The style uses uniform line weight (ligne claire/clear line) with consistent width outlines and no hatching. "
        f"Flat, bright coloring with no shading or gradients, pure solid color fills. "
        f"Face design: {desc} "
        f"Additional detail: {right_desc}. "
        f"Clothing folds are drawn with simple geometric shapes. "
        f"The bottom of the attire features a finished geometric hem for seamless mirroring. "
        f"No card border, no frame, no text, no suit symbols. "
        f"Background hints at {global_event}."
    )
    lines.append("### [joker-1] [PORTRAIT]")
    lines.append(f"Positive: {positive_left}")
    lines.append(f"Negative: {NEGATIVE_BUST}")
    lines.append("")
    lines.append("### [joker-2] [PORTRAIT]")
    lines.append(f"Positive: {positive_right}")
    lines.append(f"Negative: {NEGATIVE_BUST}")
    lines.append("")
    return lines


def generate_animation_descriptions(deck: Dict) -> List[str]:
    lines = ["## ANIMATION DESCRIPTIONS (For Kling AI, 16 items)"]
    for suit in ["spades", "hearts", "diamonds", "clubs"]:
        lines.append(
            f"- [ace-{suit}]: The character slowly blinks and looks around, clothing sways gently (Hergé animation style)."
        )
    for rank in ["king", "queen", "jack"]:
        for suit in ["spades", "hearts", "diamonds", "clubs"]:
            lines.append(
                f"- [{rank}-{suit}]: A subtle slow motion of the character's hand or prop, background remains still."
            )
    lines.append("")
    return lines


# ----------------------------------------------------------------------
# Main
# ----------------------------------------------------------------------


def main():
    parser = argparse.ArgumentParser(
        description="Assemble brief.md from universe and deck configs (fully fledged, precise Hergé Tintin style)"
    )
    parser.add_argument("--universe", required=True, help="Path to universe folder")
    parser.add_argument(
        "--season", required=True, help="Season folder name (e.g., season_1)"
    )
    parser.add_argument(
        "--deck", required=True, help="Deck folder name (e.g., crimson_wave)"
    )
    parser.add_argument("--output", required=True, help="Output path for brief.md")
    args = parser.parse_args()

    universe_path = Path(args.universe)
    season_path = universe_path / "seasons" / args.season
    deck_path = season_path / "decks" / args.deck

    clans = load_json(universe_path / "clans.json")
    characters = load_json(universe_path / "characters.json")
    rarity = load_json(universe_path / "rarity.json")
    season = load_json(season_path / "season.json")
    deck = load_json(deck_path / "deck.json")

    theme = deck.get("theme", "")
    global_event = deck.get("global_event", season.get("global_event", ""))
    mascot_name = deck.get("recurring_mascot", {}).get("name", "the mascot")
    primary_dark, primary_accent, secondary = get_color_palette_from_clans(clans, deck)

    brief_lines = []
    brief_lines.extend(generate_header(deck, primary_dark, primary_accent, secondary))
    brief_lines.extend(generate_visual_style_rules())
    brief_lines.extend(generate_hidden_gems(deck))
    brief_lines.extend(generate_custom_pip_designs(clans, deck))
    brief_lines.extend(generate_pip_prompts(deck, clans))
    brief_lines.extend(generate_corner_plaque(deck, clans))
    brief_lines.extend(
        generate_typography_grid(primary_dark, primary_accent, mascot_name, deck, clans)
    )
    brief_lines.extend(generate_card_border(deck, clans))
    brief_lines.extend(generate_card_back(deck, clans))
    brief_lines.extend(generate_aces(deck, characters, rarity, clans))
    brief_lines.extend(
        generate_face_cards(
            deck, characters, clans, rarity, mascot_name, theme, global_event
        )
    )
    brief_lines.extend(generate_number_cards(deck, global_event))
    brief_lines.extend(generate_number_template(deck, clans))
    brief_lines.extend(generate_jokers(deck, characters, global_event))
    brief_lines.extend(generate_animation_descriptions(deck))

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write("\n".join(brief_lines))

    print(f"✅ Brief written to {output_path}")


if __name__ == "__main__":
    main()
