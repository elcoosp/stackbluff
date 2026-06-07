import os

from PIL import Image, ImageDraw, ImageFilter, ImageFont

# --- CONFIGURATION ---
DECK_NAME = "01-poison-gardenia"  # CHANGE THIS PER DECK
BASE_DIR = f"../2026-Q1/{DECK_NAME}"
RAW_ART_DIR = f"{BASE_DIR}/1-raw/art"
KLING_INPUT_DIR = f"{BASE_DIR}/1-raw/kling-input"
OUTPUT_DIR = f"{BASE_DIR}/3-game-cards"
FONT_DIR = "../engine/fonts"

BG_SUFFIX = "_inspyrenet"

# Poker Anatomy Rules (True 5:7 Aspect Ratio - Print Ready 1000x1400)
W, H = 1000, 1400
CARD_BG_COLOR = (255, 255, 255, 255)  # Pure White Background

# Typography & Pips
CORNER_FONT_SIZE = 120
PIP_SIZE_CORNER = 100
PIP_SIZE_PLAQUE = 90
PIP_SIZE_LAYOUT = 160
PIP_SIZE_CENTER = 320

# Corner Plaque Config
PLAQUE_DISPLAY_SIZE = 160

# --- CUSTOM SUIT COLORS ---
COLOR_BLACK_HEX = "#1C1B1E"
COLOR_RED_HEX = "#B82B4B"

TEMPLATE_ART_OPACITY = 0.5


def hex_to_rgb(hex_str):
    hex_str = hex_str.lstrip("#")
    return tuple(int(hex_str[i : i + 2], 16) for i in (0, 2, 4))


SUIT_COLORS = {
    "spades": hex_to_rgb(COLOR_BLACK_HEX),
    "clubs": hex_to_rgb(COLOR_BLACK_HEX),
    "hearts": hex_to_rgb(COLOR_RED_HEX),
    "diamonds": hex_to_rgb(COLOR_RED_HEX),
}

SUITS = ["spades", "hearts", "diamonds", "clubs"]
RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"]
FACE_RANKS = ["J", "Q", "K"]

RANK_TO_FILENAME = {"A": "ace", "J": "jack", "Q": "queen", "K": "king"}

# --- PIP LAYOUT ENGINE ---
PIP_GRID = {
    "L": 250,
    "C": 500,
    "R": 750,
    "1": 300,
    "2": 500,
    "3": 700,
    "4": 900,
    "5": 1100,
}

PIP_LAYOUTS = {
    "2": [("C", "1"), ("C", "5")],
    "3": [("C", "1"), ("C", "3"), ("C", "5")],
    "4": [("L", "1"), ("R", "1"), ("L", "5"), ("R", "5")],
    "5": [("L", "1"), ("R", "1"), ("C", "3"), ("L", "5"), ("R", "5")],
    "6": [("L", "1"), ("R", "1"), ("L", "3"), ("R", "3"), ("L", "5"), ("R", "5")],
    "7": [
        ("L", "1"),
        ("R", "1"),
        ("C", "2"),
        ("L", "3"),
        ("R", "3"),
        ("L", "5"),
        ("R", "5"),
    ],
    "8": [
        ("L", "1"),
        ("R", "1"),
        ("C", "2"),
        ("L", "3"),
        ("R", "3"),
        ("C", "4"),
        ("L", "5"),
        ("R", "5"),
    ],
    "9": [
        ("L", "1"),
        ("R", "1"),
        ("L", "2"),
        ("R", "2"),
        ("C", "3"),
        ("L", "4"),
        ("R", "4"),
        ("L", "5"),
        ("R", "5"),
    ],
    "10": [
        ("L", "1"),
        ("R", "1"),
        ("C", "2"),
        ("L", "2"),
        ("R", "2"),
        ("L", "4"),
        ("R", "4"),
        ("C", "4"),
        ("L", "5"),
        ("R", "5"),
    ],
}


def load_font(size):
    try:
        return ImageFont.truetype(os.path.join(FONT_DIR, "Cinzel-Bold.ttf"), size)
    except:
        pass
    try:
        return ImageFont.truetype(
            os.path.join(FONT_DIR, "PlayfairDisplay-Bold.ttf"), size
        )
    except:
        pass
    try:
        return ImageFont.truetype("/Library/Fonts/NewYork.ttf", size)
    except:
        pass
    try:
        return ImageFont.truetype("C:\\Windows\\Fonts\\GEORGIA.TTF", size)
    except:
        pass
    return ImageFont.load_default()


def resolve_raw_path(filename):
    path_base = os.path.join(RAW_ART_DIR, filename)
    if os.path.exists(path_base):
        return path_base
    path_subfolder = os.path.join(
        RAW_ART_DIR, "all_background_removal_results", filename
    )
    if os.path.exists(path_subfolder):
        return path_subfolder
    return path_base


def load_corner_plaque():
    plaque_file = f"corner-plaque{BG_SUFFIX}.png"
    plaque_path = resolve_raw_path(plaque_file)
    if os.path.exists(plaque_path):
        try:
            plaque = Image.open(plaque_path).convert("RGBA")
            bbox = plaque.getbbox()
            if bbox:
                plaque = plaque.crop(bbox)
            return plaque
        except Exception as e:
            print(f"  Warning: could not load corner plaque - {e}")
    return None


def load_border():
    border_file = f"border{BG_SUFFIX}.png"
    path = resolve_raw_path(border_file)
    if os.path.exists(path):
        try:
            border = Image.open(path).convert("RGBA")
            bbox = border.getbbox()
            if bbox:
                border = border.crop(bbox)
            border = border.resize((W, H), Image.LANCZOS)
            return border
        except Exception as e:
            print(f"  Warning: could not load border - {e}")
    return None


def load_center_band():
    """Loads center‑band, preserves aspect ratio, resizes to full card width."""
    band_file = f"center-band{BG_SUFFIX}.png"
    path = resolve_raw_path(band_file)
    if not os.path.exists(path):
        return None
    try:
        band = Image.open(path).convert("RGBA")
        bbox = band.getbbox()
        if bbox:
            band = band.crop(bbox)
        orig_w, orig_h = band.size
        new_h = int(orig_h * W / orig_w)
        band = band.resize((W, new_h), Image.LANCZOS)
        return band
    except Exception as e:
        print(f"  Warning: could not load center band - {e}")
        return None


def create_corner_lights():
    """
    Returns a full‑card (W x H) white‑to‑transparent radial gradient.
    Uses alpha_composite later to avoid gray fringe.
    """
    tile_size = 300
    circle_radius = 180
    blur_radius = 60

    # Create small mask with white circle
    mask = Image.new("L", (tile_size, tile_size), 0)
    draw = ImageDraw.Draw(mask)
    center = tile_size // 2
    draw.ellipse(
        (
            center - circle_radius,
            center - circle_radius,
            center + circle_radius,
            center + circle_radius,
        ),
        fill=255,
    )
    mask = mask.filter(ImageFilter.GaussianBlur(blur_radius))

    # Small white tile with alpha
    tile = Image.new("RGBA", (tile_size, tile_size), (255, 255, 255, 255))
    tile.putalpha(mask)

    # Full‑card canvas
    full_gradient = Image.new("RGBA", (W, H), (0, 0, 0, 0))

    # Top‑left corner
    full_gradient.paste(tile, (0, 0), tile)
    # Bottom‑right corner (rotated)
    tile_rot = tile.rotate(180, expand=True)
    full_gradient.paste(tile_rot, (W - tile_rot.width, H - tile_rot.height), tile_rot)

    return full_gradient


def process_pips():
    print("Processing pips...")
    out_dir = f"{BASE_DIR}/2-pips"
    os.makedirs(out_dir, exist_ok=True)
    for suit in SUITS:
        raw_path = resolve_raw_path(f"pip-{suit}{BG_SUFFIX}.png")
        if not os.path.exists(raw_path):
            print(f"  Missing pip: {raw_path}")
            continue
        img = Image.open(raw_path).convert("RGBA")
        for size in [
            PIP_SIZE_CORNER,
            PIP_SIZE_PLAQUE,
            PIP_SIZE_LAYOUT,
            PIP_SIZE_CENTER,
        ]:
            resized = img.resize((size, size), Image.LANCZOS)
            resized.save(f"{out_dir}/{suit}-{size}.png")


def draw_corners(card, rank, suit, corner_plaque=None):
    color = SUIT_COLORS.get(suit, (0, 0, 0)) if suit else (0, 0, 0)

    # Dynamic font scaling
    font_size = CORNER_FONT_SIZE
    font = load_font(font_size)
    max_text_width = PLAQUE_DISPLAY_SIZE - 20 if corner_plaque else 500

    while True:
        tmp = Image.new("RGBA", (1, 1), (0, 0, 0, 0))
        tmp_draw = ImageDraw.Draw(tmp)
        bbox = tmp_draw.textbbox((0, 0), rank, font=font)
        text_w = bbox[2] - bbox[0]
        text_h = bbox[3] - bbox[1]
        if text_w <= max_text_width or font_size <= 40:
            break
        font_size -= 4
        font = load_font(font_size)

    if corner_plaque:
        # With custom plaque
        plaque_resized = corner_plaque.resize(
            (PLAQUE_DISPLAY_SIZE, PLAQUE_DISPLAY_SIZE), Image.LANCZOS
        )
        pad = 10
        gap = 10
        pip_h = PIP_SIZE_PLAQUE if suit else 0

        cg_w = max(PLAQUE_DISPLAY_SIZE, PIP_SIZE_PLAQUE if suit else 0) + pad * 2
        cg_h = PLAQUE_DISPLAY_SIZE + (gap if suit else 0) + pip_h + pad * 2

        corner_group = Image.new("RGBA", (cg_w, cg_h), (0, 0, 0, 0))
        cg_draw = ImageDraw.Draw(corner_group)

        # Plaque
        plaque_x = (cg_w - PLAQUE_DISPLAY_SIZE) // 2
        plaque_y = pad
        corner_group.paste(plaque_resized, (plaque_x, plaque_y), plaque_resized)

        # Rank text
        center_x_plaque = plaque_x + PLAQUE_DISPLAY_SIZE // 2
        center_y_plaque = plaque_y + PLAQUE_DISPLAY_SIZE // 2
        cg_draw.text(
            (center_x_plaque, center_y_plaque),
            rank,
            fill=color,
            font=font,
            anchor="mm",
            stroke_width=2,
            stroke_fill=(255, 255, 255),
        )

        # Pip below
        if suit:
            pip_path = f"{BASE_DIR}/2-pips/{suit}-{PIP_SIZE_PLAQUE}.png"
            if os.path.exists(pip_path):
                pip_img = Image.open(pip_path).convert("RGBA")
                pip_x = (cg_w - PIP_SIZE_PLAQUE) // 2
                pip_y = plaque_y + PLAQUE_DISPLAY_SIZE + gap
                corner_group.paste(pip_img, (pip_x, pip_y), pip_img)
    else:
        # Fallback (no plaque)
        pip_h = PIP_SIZE_CORNER if suit else 0
        pad = 15
        gap = 10 if suit else 0

        cg_w = max(text_w, PIP_SIZE_CORNER if suit else 0) + pad * 2
        cg_h = text_h + gap + pip_h + pad * 2

        corner_group = Image.new("RGBA", (cg_w, cg_h), (0, 0, 0, 0))
        cg_draw = ImageDraw.Draw(corner_group)

        cg_draw.text(
            (cg_w // 2, pad + text_h // 2),
            rank,
            fill=color,
            font=font,
            anchor="mm",
            stroke_width=2,
            stroke_fill=(255, 255, 255),
        )

        if suit:
            pip_path = f"{BASE_DIR}/2-pips/{suit}-{PIP_SIZE_CORNER}.png"
            if os.path.exists(pip_path):
                pip_img = (
                    Image.open(pip_path)
                    .convert("RGBA")
                    .resize((PIP_SIZE_CORNER, PIP_SIZE_CORNER), Image.LANCZOS)
                )
                pip_x = (cg_w - PIP_SIZE_CORNER) // 2
                pip_y = pad + text_h + gap
                corner_group.paste(pip_img, (pip_x, pip_y), pip_img)

    # Paste top-left
    card.paste(corner_group, (35, 35), corner_group)
    # Rotate and paste bottom-right
    corner_rot = corner_group.rotate(180, expand=True)
    card.paste(
        corner_rot, (W - 35 - corner_rot.width, H - 35 - corner_rot.height), corner_rot
    )

    return card


def draw_pip_pattern(card, rank, suit):
    pip_path = f"{BASE_DIR}/2-pips/{suit}-{PIP_SIZE_LAYOUT}.png"
    if not os.path.exists(pip_path) or rank not in PIP_LAYOUTS:
        return

    pip_img = Image.open(pip_path).convert("RGBA")
    half = PIP_SIZE_LAYOUT // 2

    for x_key, y_key in PIP_LAYOUTS[rank]:
        x = PIP_GRID[x_key]
        y = PIP_GRID[y_key]
        current_pip = pip_img
        if y_key in ["4", "5"]:
            current_pip = pip_img.rotate(180, expand=False)
        card.paste(current_pip, (x - half, y - half), current_pip)


def fit_art_to_box(art, box_w, box_h):
    art_ratio = art.width / art.height
    box_ratio = box_w / box_h
    if art_ratio > box_ratio:
        new_w = box_w
        new_h = int(box_w / art_ratio)
    else:
        new_h = box_h
        new_w = int(box_h * art_ratio)
    return art.resize((new_w, new_h), Image.LANCZOS)


def composite_reversible_card(
    rank,
    suit,
    art_path,
    output_path,
    corner_plaque=None,
    border=None,
    corner_light=None,
    center_band=None,
):
    if not os.path.exists(art_path):
        print(f"  Missing art: {art_path}")
        return

    card = Image.new("RGBA", (W, H), CARD_BG_COLOR)

    # LAYER 0: Border (deepest)
    if border:
        card.paste(border, (0, 0), border)

    # LAYER 1: Mirrored art
    bust = Image.open(art_path).convert("RGBA")
    bbox = bust.getbbox()
    if bbox:
        bust = bust.crop(bbox)
    else:
        print(f"  Warning: Empty art for {art_path}")
        return

    box_w = W - 100
    box_h = (H // 2) - 60
    bust_resized = fit_art_to_box(bust, box_w, box_h)
    x_offset = (W - bust_resized.width) // 2
    y_offset_top = (H // 2) - 10 - bust_resized.height
    card.paste(bust_resized, (x_offset, y_offset_top), bust_resized)

    bust_rotated = bust_resized.rotate(180, expand=True)
    y_offset_bottom = (H // 2) + 10
    card.paste(bust_rotated, (x_offset, y_offset_bottom), bust_rotated)

    # LAYER 2: Center band (exactly on the seam, above art)
    if center_band:
        band_y = (H // 2) - (center_band.height // 2)
        card.paste(center_band, (0, band_y), center_band)

    # LAYER 3: Corner vignette (alpha composite for perfect transparency)
    if corner_light:
        card = Image.alpha_composite(card, corner_light)

    # LAYER 4: Indices & pips
    card = draw_corners(card, rank, suit, corner_plaque)

    # Save outputs
    kling_out = f"{KLING_INPUT_DIR}/{os.path.basename(output_path)}"
    card.save(kling_out, "PNG")
    card.save(output_path, "PNG")


def composite_standard_card(
    rank,
    suit,
    art_path,
    output_path,
    is_back=False,
    no_padding=False,
    art_opacity=1.0,
    draw_full_pip_layout=False,
    corner_plaque=None,
    border=None,
    corner_light=None,
):
    if not os.path.exists(art_path):
        print(f"  Missing art: {art_path}")
        return

    card = Image.new("RGBA", (W, H), CARD_BG_COLOR)
    art = Image.open(art_path).convert("RGBA")

    if not (no_padding or is_back):
        bbox = art.getbbox()
        if bbox:
            art = art.crop(bbox)

    if art_opacity < 1.0:
        alpha = art.split()[3]
        alpha = alpha.point(lambda p: int(p * art_opacity))
        art.putalpha(alpha)

    if no_padding or is_back:
        box_x1, box_y1 = 0, 0
        box_x2, box_y2 = W, H
    else:
        box_x1, box_y1 = 50, 200
        box_x2, box_y2 = W - 50, H - 200

    box_w = box_x2 - box_x1
    box_h = box_y2 - box_y1

    art_resized = fit_art_to_box(art, box_w, box_h)
    x_offset = box_x1 + (box_w - art_resized.width) // 2
    y_offset = box_y1 + (box_h - art_resized.height) // 2

    # LAYER 1: Border
    if border:
        card.paste(border, (0, 0), border)

    # LAYER 2: Art
    card.paste(art_resized, (x_offset, y_offset), art_resized)

    # LAYER 3: Corner light (alpha composite)
    if corner_light and not is_back:
        card = Image.alpha_composite(card, corner_light)

    # LAYER 4: Pips and indices
    if not is_back and rank:
        if draw_full_pip_layout and suit:
            draw_pip_pattern(card, rank, suit)
        card = draw_corners(card, rank, suit, corner_plaque)
        if rank == "A":
            kling_out = f"{KLING_INPUT_DIR}/{os.path.basename(output_path)}"
            card.save(kling_out, "PNG")

    card.save(output_path, "PNG")


def build_deck():
    print(f"Building deck: {DECK_NAME} using {BG_SUFFIX} masks")
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    os.makedirs(KLING_INPUT_DIR, exist_ok=True)

    corner_plaque = load_corner_plaque()
    if corner_plaque:
        print("  Found themed corner plaque!")
    else:
        print("  No corner plaque found, using fallback indices.")

    border = load_border()
    if border:
        print("  Found themed border overlay.")
    else:
        print("  No border found, using edge-to-edge art.")

    print("  Creating white‑to‑transparent corner lights (alpha_composite ready)...")
    corner_light = create_corner_lights()

    center_band = load_center_band()
    if center_band:
        print(
            f"  Found center band (height {center_band.height}px), placing at double‑head seam."
        )
    else:
        print("  No center band found, skipping.")

    # --- Card back ---
    composite_standard_card(
        "",
        "",
        resolve_raw_path(f"back{BG_SUFFIX}.png"),
        f"{OUTPUT_DIR}/back.png",
        is_back=True,
        corner_plaque=corner_plaque,
        border=None,
        corner_light=None,
    )

    # --- Aces ---
    for suit in SUITS:
        fname_base = RANK_TO_FILENAME["A"]
        composite_standard_card(
            "A",
            suit,
            resolve_raw_path(f"{fname_base}-{suit}{BG_SUFFIX}.png"),
            f"{OUTPUT_DIR}/ace-{suit}.png",
            draw_full_pip_layout=False,
            corner_plaque=corner_plaque,
            border=border,
            corner_light=corner_light,
        )

    # --- Face cards (reversible) ---
    for suit in SUITS:
        for rank in FACE_RANKS:
            fname_base = RANK_TO_FILENAME[rank]
            fname = f"{fname_base}-{suit}{BG_SUFFIX}.png"
            out_name = f"{rank.lower()}-{suit}.png"
            composite_reversible_card(
                rank,
                suit,
                resolve_raw_path(fname),
                f"{OUTPUT_DIR}/{out_name}",
                corner_plaque=corner_plaque,
                border=border,
                corner_light=corner_light,
                center_band=center_band,
            )

    # --- Number cards (2-10) ---
    template_path = resolve_raw_path(f"number-template{BG_SUFFIX}.png")
    for suit in SUITS:
        for rank in RANKS[:9]:
            out_path = f"{OUTPUT_DIR}/{rank}-{suit}.png"
            specific_art = resolve_raw_path(f"{rank}-{suit}{BG_SUFFIX}.png")
            is_custom = os.path.exists(specific_art)
            art_src = specific_art if is_custom else template_path
            if os.path.exists(art_src):
                composite_standard_card(
                    rank,
                    suit,
                    art_src,
                    out_path,
                    is_back=False,
                    no_padding=not is_custom,
                    art_opacity=TEMPLATE_ART_OPACITY if not is_custom else 1.0,
                    draw_full_pip_layout=not is_custom,
                    corner_plaque=corner_plaque,
                    border=border,
                    corner_light=corner_light,
                )

    # --- Jokers ---
    composite_standard_card(
        "JOKER",
        "",
        resolve_raw_path(f"joker-1{BG_SUFFIX}.png"),
        f"{OUTPUT_DIR}/joker-1.png",
        draw_full_pip_layout=False,
        corner_plaque=corner_plaque,
        border=border,
        corner_light=corner_light,
    )
    composite_standard_card(
        "JOKER",
        "",
        resolve_raw_path(f"joker-2{BG_SUFFIX}.png"),
        f"{OUTPUT_DIR}/joker-2.png",
        draw_full_pip_layout=False,
        corner_plaque=corner_plaque,
        border=border,
        corner_light=corner_light,
    )

    print("Deck compositing complete!")


if __name__ == "__main__":
    process_pips()
    build_deck()
