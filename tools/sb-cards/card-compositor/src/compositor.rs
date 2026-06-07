use anyhow::{Context, Result};
use fontdue::Font;
use lazy_static::lazy_static;
use std::path::{Path, PathBuf};
use tiny_skia::{Color, IntSize, Pixmap, PixmapPaint, Transform};

use crate::assets::{self, fit_pixmap_to_box, load_cropped_pixmap};
use crate::geometry::*;

const SUITS: [&str; 4] = ["spades", "hearts", "diamonds", "clubs"];
const RANKS: [&str; 13] = [
    "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A",
];
const FACE_RANKS: [&str; 3] = ["J", "Q", "K"];

const RANK_TO_FILENAME: &[(&str, &str)] =
    &[("A", "ace"), ("J", "jack"), ("Q", "queen"), ("K", "king")];

fn rank_to_filename(rank: &str) -> &str {
    for (r, f) in RANK_TO_FILENAME {
        if *r == rank {
            return f;
        }
    }
    rank
}

// Font loading – looks for "fonts/" folder next to the executable
lazy_static! {
    static ref FONT: Font = {
        let font_paths = [
            "fonts/Cinzel-Bold.ttf",
            "fonts/PlayfairDisplay-Bold.ttf",
            "/System/Library/Fonts/NewYork.ttf",
            "C:\\Windows\\Fonts\\GEORGIA.TTF",
            "/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf",
        ];
        let mut font_data = None;
        for path in font_paths {
            if let Ok(data) = std::fs::read(path) {
                eprintln!("Loaded font: {}", path);
                font_data = Some(data);
                break;
            }
        }
        let font_data = font_data.expect(
            "No font file found. Please place Cinzel-Bold.ttf or PlayfairDisplay-Bold.ttf in the 'fonts/' directory."
        );
        Font::from_bytes(font_data, fontdue::FontSettings::default()).unwrap()
    };
}

// -----------------------------------------------------------------------------
// Main deck builder (unchanged)
// -----------------------------------------------------------------------------
pub fn build_deck(
    base_dir: &str,
    suffix: &str,
    corner_plaque: Option<&Pixmap>,
    border: Option<&Pixmap>,
    corner_light: &Pixmap,
    center_band: Option<&Pixmap>,
) -> Result<()> {
    let out_dir = PathBuf::from(base_dir).join("3-game-cards");
    let kling_dir = PathBuf::from(base_dir).join("1-raw/kling-input");
    std::fs::create_dir_all(&out_dir)?;
    std::fs::create_dir_all(&kling_dir)?;

    let back_art = assets::resolve_raw_path(base_dir, &format!("back{}.png", suffix));
    composite_standard_card(
        "",
        "",
        &back_art,
        &out_dir,
        &kling_dir,
        true,
        false,
        1.0,
        corner_plaque,
        border,
        None,
        false,
    )?;

    for suit in SUITS {
        let art_path = assets::resolve_raw_path(base_dir, &format!("ace-{}{}.png", suit, suffix));
        composite_standard_card(
            "A",
            suit,
            &art_path,
            &out_dir,
            &kling_dir,
            false,
            false,
            1.0,
            corner_plaque,
            border,
            Some(corner_light),
            false,
        )?;
    }

    for suit in SUITS {
        for rank in FACE_RANKS {
            let base_name = rank_to_filename(rank);
            let fname = format!("{}-{}{}.png", base_name, suit, suffix);
            let art_path = assets::resolve_raw_path(base_dir, &fname);
            composite_reversible_card(
                rank,
                suit,
                &art_path,
                &out_dir,
                &kling_dir,
                corner_plaque,
                border,
                corner_light,
                center_band,
            )?;
        }
    }

    let template_path =
        assets::resolve_raw_path(base_dir, &format!("number-template{}.png", suffix));
    for suit in SUITS {
        for rank in &RANKS[0..9] {
            let specific_path =
                assets::resolve_raw_path(base_dir, &format!("{}-{}{}.png", rank, suit, suffix));
            let (art_path, no_padding, opacity, draw_full_pip_layout) = if specific_path.exists() {
                (specific_path, false, 1.0, false)
            } else {
                (template_path.clone(), true, 0.5, true)
            };
            composite_standard_card(
                rank,
                suit,
                &art_path,
                &out_dir,
                &kling_dir,
                false,
                no_padding,
                opacity,
                corner_plaque,
                border,
                Some(corner_light),
                draw_full_pip_layout,
            )?;
        }
    }

    for i in 1..=2 {
        let art = assets::resolve_raw_path(base_dir, &format!("joker-{}{}.png", i, suffix));
        composite_standard_card(
            "JOKER",
            "",
            &art,
            &out_dir,
            &kling_dir,
            false,
            false,
            1.0,
            corner_plaque,
            border,
            Some(corner_light),
            false,
        )?;
    }
    Ok(())
}

// -----------------------------------------------------------------------------
// Standard card (non‑reversible)
// -----------------------------------------------------------------------------
fn composite_standard_card(
    rank: &str,
    suit: &str,
    art_path: &Path,
    out_dir: &Path,
    kling_dir: &Path,
    is_back: bool,
    no_padding: bool,
    art_opacity: f32,
    corner_plaque: Option<&Pixmap>,
    border: Option<&Pixmap>,
    corner_light: Option<&Pixmap>,
    draw_full_pip_layout: bool,
) -> Result<()> {
    let mut canvas = Pixmap::new(W, H).unwrap();
    canvas.fill(Color::WHITE);

    if let Some(border_img) = border {
        draw_pixmap(&mut canvas, border_img, 0, 0);
    }

    let mut art = load_cropped_pixmap(art_path)
        .with_context(|| format!("Loading artwork: {}", art_path.display()))?;
    if art_opacity < 1.0 {
        apply_opacity(&mut art, art_opacity);
    }

    let (box_x, box_y, box_w, box_h) = if no_padding || is_back {
        (0, 0, W, H)
    } else {
        (50, 200, W - 100, H - 400)
    };
    let art_resized = fit_pixmap_to_box(&art, box_w, box_h);
    let art_x = box_x as i32 + (box_w as i32 - art_resized.width() as i32) / 2;
    let art_y = box_y as i32 + (box_h as i32 - art_resized.height() as i32) / 2;
    draw_pixmap(&mut canvas, &art_resized, art_x, art_y);

    if let Some(light) = corner_light {
        if !is_back {
            canvas.draw_pixmap(
                0,
                0,
                light.as_ref(),
                &PixmapPaint::default(),
                Transform::identity(),
                None,
            );
        }
    }

    if !is_back && !rank.is_empty() {
        draw_corner_group(&mut canvas, rank, suit, corner_plaque);
        if draw_full_pip_layout && !suit.is_empty() {
            if let Some(layout) = PIP_LAYOUTS.get(rank) {
                draw_pip_pattern(&mut canvas, suit, layout);
            }
        }
    }

    save_pixmap(&canvas, out_dir, kling_dir, rank, suit)
}

// -----------------------------------------------------------------------------
// Reversible card (mirrored art, center band)
// -----------------------------------------------------------------------------
fn composite_reversible_card(
    rank: &str,
    suit: &str,
    art_path: &Path,
    out_dir: &Path,
    kling_dir: &Path,
    corner_plaque: Option<&Pixmap>,
    border: Option<&Pixmap>,
    corner_light: &Pixmap,
    center_band: Option<&Pixmap>,
) -> Result<()> {
    let mut canvas = Pixmap::new(W, H).unwrap();
    canvas.fill(Color::WHITE);

    if let Some(border_img) = border {
        draw_pixmap(&mut canvas, border_img, 0, 0);
    }

    let art = load_cropped_pixmap(art_path)
        .with_context(|| format!("Loading reversible artwork: {}", art_path.display()))?;
    let box_w = W - 100;
    let box_h = H / 2 - 60;
    let art_resized = fit_pixmap_to_box(&art, box_w, box_h);
    let x_offset = (W as i32 - art_resized.width() as i32) / 2;
    let y_top = (H as i32 / 2) - 10 - art_resized.height() as i32;
    draw_pixmap(&mut canvas, &art_resized, x_offset, y_top);

    let mut art_rotated = art_resized.clone();
    rotate_180(&mut art_rotated);
    let y_bottom = (H as i32 / 2) + 10;
    draw_pixmap(&mut canvas, &art_rotated, x_offset, y_bottom);

    if let Some(band) = center_band {
        let band_y = (H as i32 / 2) - (band.height() as i32 / 2);
        draw_pixmap(&mut canvas, band, 0, band_y);
    }

    canvas.draw_pixmap(
        0,
        0,
        corner_light.as_ref(),
        &PixmapPaint::default(),
        Transform::identity(),
        None,
    );
    draw_corner_group(&mut canvas, rank, suit, corner_plaque);

    save_pixmap(&canvas, out_dir, kling_dir, rank, suit)
}

// -----------------------------------------------------------------------------
// Corner group creation (matching Python's draw_corners)
// -----------------------------------------------------------------------------
fn draw_corner_group(canvas: &mut Pixmap, rank: &str, suit: &str, plaque_opt: Option<&Pixmap>) {
    let color = suit_color(suit);
    let font_size = 120.0;

    let (group, _group_w, _group_h) = if let Some(plaque) = plaque_opt {
        let plaque_size = PLAQUE_DISPLAY_SIZE;
        let pad = 10;
        let gap = 10;
        let pip_h = if suit.is_empty() { 0 } else { PIP_SIZE_PLAQUE };
        let group_w = pad * 2 + plaque_size.max(pip_h);
        let group_h = pad * 2 + plaque_size + (if suit.is_empty() { 0 } else { gap }) + pip_h;
        let mut group = Pixmap::new(group_w, group_h).unwrap();
        group.fill(Color::TRANSPARENT);

        let plaque_resized = fit_pixmap_to_box(plaque, plaque_size, plaque_size);
        let plaque_x = (group_w as i32 - plaque_resized.width() as i32) / 2;
        let plaque_y = pad as i32;
        draw_pixmap(&mut group, &plaque_resized, plaque_x, plaque_y);
        let center_x = plaque_x + plaque_resized.width() as i32 / 2;
        let center_y = plaque_y + plaque_resized.height() as i32 / 2;
        draw_text(
            &mut group,
            rank,
            center_x as f32,
            center_y as f32,
            font_size,
            color,
        );
        if !suit.is_empty() {
            let base_dir = std::env::var("BASE_DIR")
                .unwrap_or_else(|_| "../2026-Q1/01-poison-gardenia".into());
            let pip_path = assets::resolve_raw_path(
                &base_dir,
                &format!("2-pips/{}-{}.png", suit, PIP_SIZE_PLAQUE),
            );
            if let Ok(pip_img) = image::open(&pip_path).map(|i| i.into_rgba8()) {
                let size = IntSize::from_wh(pip_img.width(), pip_img.height()).unwrap();
                if let Some(pip) = Pixmap::from_vec(pip_img.into_raw(), size) {
                    let pip_x = (group_w as i32 - pip.width() as i32) / 2;
                    let pip_y = plaque_y + plaque_resized.height() as i32 + gap as i32;
                    draw_pixmap(&mut group, &pip, pip_x, pip_y);
                }
            }
        }
        (group, group_w, group_h)
    } else {
        let text_w = measure_text_width(rank, font_size);
        let text_h = measure_text_height(rank, font_size);
        let pad = 15;
        let gap = if suit.is_empty() { 0 } else { 10 };
        let pip_h = if suit.is_empty() { 0 } else { PIP_SIZE_CORNER };
        let group_w = pad * 2 + text_w.max(pip_h);
        let group_h = pad * 2 + text_h + gap + pip_h;
        let mut group = Pixmap::new(group_w, group_h).unwrap();
        group.fill(Color::TRANSPARENT);

        let center_x = group_w as f32 / 2.0;
        let center_y = pad as f32 + text_h as f32 / 2.0;
        draw_text(&mut group, rank, center_x, center_y, font_size, color);
        if !suit.is_empty() {
            let base_dir = std::env::var("BASE_DIR")
                .unwrap_or_else(|_| "../2026-Q1/01-poison-gardenia".into());
            let pip_path = assets::resolve_raw_path(
                &base_dir,
                &format!("2-pips/{}-{}.png", suit, PIP_SIZE_CORNER),
            );
            if let Ok(pip_img) = image::open(&pip_path).map(|i| i.into_rgba8()) {
                let size = IntSize::from_wh(pip_img.width(), pip_img.height()).unwrap();
                if let Some(pip) = Pixmap::from_vec(pip_img.into_raw(), size) {
                    let pip_x = (group_w as i32 - pip.width() as i32) / 2;
                    let pip_y = pad as i32 + text_h as i32 + gap as i32;
                    draw_pixmap(&mut group, &pip, pip_x, pip_y);
                }
            }
        }
        (group, group_w, group_h)
    };

    draw_pixmap(canvas, &group, 35, 35);
    let mut group_rot = group.clone();
    rotate_180(&mut group_rot);
    let rot_x = W as i32 - 35 - group_rot.width() as i32;
    let rot_y = H as i32 - 35 - group_rot.height() as i32;
    draw_pixmap(canvas, &group_rot, rot_x, rot_y);
}

// -----------------------------------------------------------------------------
// Text helpers
// -----------------------------------------------------------------------------
fn measure_text_width(text: &str, size: f32) -> u32 {
    let mut total = 0;
    for ch in text.chars() {
        let (metrics, _) = FONT.rasterize(ch, size);
        total += metrics.width;
    }
    total as u32
}

fn measure_text_height(text: &str, size: f32) -> u32 {
    text.chars()
        .map(|ch| FONT.rasterize(ch, size).0.height)
        .max()
        .unwrap_or(0) as u32
}

fn draw_text(pixmap: &mut Pixmap, text: &str, x: f32, y: f32, size: f32, color: Color) {
    let mut cur_x = x - measure_text_width(text, size) as f32 / 2.0;
    for ch in text.chars() {
        let (metrics, raster) = FONT.rasterize(ch, size);
        let w = metrics.width;
        let h = metrics.height;
        let x_pos = cur_x as i32;
        let y_pos = (y - h as f32 / 2.0) as i32;
        draw_raster(pixmap, &raster, w as usize, h as usize, x_pos, y_pos, color);
        cur_x += w as f32;
    }
}

// -----------------------------------------------------------------------------
// Pip pattern for number cards
// -----------------------------------------------------------------------------
fn draw_pip_pattern(canvas: &mut Pixmap, suit: &str, layout: &[(usize, usize)]) {
    let base_dir =
        std::env::var("BASE_DIR").unwrap_or_else(|_| "../2026-Q1/01-poison-gardenia".into());
    let pip_path = assets::resolve_raw_path(
        &base_dir,
        &format!("2-pips/{}-{}.png", suit, PIP_SIZE_LAYOUT),
    );
    let pip_img = match image::open(&pip_path).map(|i| i.into_rgba8()) {
        Ok(img) => img,
        Err(_) => return,
    };
    let size = IntSize::from_wh(pip_img.width(), pip_img.height()).unwrap();
    let Some(pip) = Pixmap::from_vec(pip_img.into_raw(), size) else {
        return;
    };
    for (xi, yi) in layout {
        let x = PIP_GRID_X[*xi] as i32 - pip.width() as i32 / 2;
        let y = PIP_GRID_Y[*yi] as i32 - pip.height() as i32 / 2;
        draw_pixmap(canvas, &pip, x, y);
    }
}

// -----------------------------------------------------------------------------
// Basic drawing helpers
// -----------------------------------------------------------------------------
fn draw_pixmap(canvas: &mut Pixmap, src: &Pixmap, x: i32, y: i32) {
    let paint = PixmapPaint::default();
    canvas.draw_pixmap(x, y, src.as_ref(), &paint, Transform::identity(), None);
}

fn apply_opacity(pix: &mut Pixmap, opacity: f32) {
    for pixel in pix.pixels_mut() {
        let a = pixel.alpha() as u32;
        let r = pixel.red() as u32;
        let g = pixel.green() as u32;
        let b = pixel.blue() as u32;
        let new_a = (a as f32 * opacity) as u32;
        let new_r = (r as f32 * opacity) as u32;
        let new_g = (g as f32 * opacity) as u32;
        let new_b = (b as f32 * opacity) as u32;
        let new_r = new_r.min(new_a) as u8;
        let new_g = new_g.min(new_a) as u8;
        let new_b = new_b.min(new_a) as u8;
        let new_a = new_a as u8;
        *pixel = tiny_skia::PremultipliedColorU8::from_rgba(new_r, new_g, new_b, new_a)
            .expect("Failed to create premultiplied color in apply_opacity");
    }
}

fn rotate_180(pix: &mut Pixmap) {
    let w = pix.width();
    let h = pix.height();
    let data = pix.data_mut();
    for y in 0..h / 2 {
        for x in 0..w {
            let top = (y * w + x) as usize;
            let bottom = ((h - 1 - y) * w + (w - 1 - x)) as usize;
            data.swap(top * 4, bottom * 4);
            data.swap(top * 4 + 1, bottom * 4 + 1);
            data.swap(top * 4 + 2, bottom * 4 + 2);
            data.swap(top * 4 + 3, bottom * 4 + 3);
        }
    }
}

// -----------------------------------------------------------------------------
// Direct pixel blending with clamping to premultiply condition
// -----------------------------------------------------------------------------
fn draw_raster(
    canvas: &mut Pixmap,
    raster: &[u8],
    width: usize,
    height: usize,
    x: i32,
    y: i32,
    color: Color,
) {
    let w = canvas.width();
    let h = canvas.height();
    let (r, g, b, _a) = (color.red(), color.green(), color.blue(), color.alpha());
    for row in 0..height {
        for col in 0..width {
            let alpha = raster[row * width + col];
            if alpha == 0 {
                continue;
            }
            let px_x = x + col as i32;
            let px_y = y + row as i32;
            if px_x < 0 || px_x >= w as i32 || px_y < 0 || px_y >= h as i32 {
                continue;
            }
            let idx = (px_y as usize) * (w as usize) + (px_x as usize);
            let pixel = &mut canvas.pixels_mut()[idx];
            let dst_r = pixel.red() as u32;
            let dst_g = pixel.green() as u32;
            let dst_b = pixel.blue() as u32;
            let dst_a = pixel.alpha() as u32;
            let src_a = alpha as u32;
            let out_a = dst_a + src_a - (dst_a * src_a / 255);
            let out_r = (dst_r * (255 - src_a) + r as u32 * src_a) / 255;
            let out_g = (dst_g * (255 - src_a) + g as u32 * src_a) / 255;
            let out_b = (dst_b * (255 - src_a) + b as u32 * src_a) / 255;
            // Clamp to satisfy premultiplied condition
            let out_r = out_r.min(out_a) as u8;
            let out_g = out_g.min(out_a) as u8;
            let out_b = out_b.min(out_a) as u8;
            let out_a = out_a as u8;
            *pixel = tiny_skia::PremultipliedColorU8::from_rgba(out_r, out_g, out_b, out_a)
                .expect("Premultiplied color creation failed after clamping");
        }
    }
}

fn suit_color(suit: &str) -> Color {
    match suit {
        "hearts" | "diamonds" => Color::from_rgba8(184, 43, 75, 255),
        _ => Color::from_rgba8(28, 27, 30, 255),
    }
}

fn save_pixmap(
    pixmap: &Pixmap,
    out_dir: &Path,
    kling_dir: &Path,
    rank: &str,
    suit: &str,
) -> Result<()> {
    let data = pixmap.encode_png()?;
    let filename = format!("{}-{}.png", rank.to_lowercase(), suit);
    let out_path = out_dir.join(&filename);
    let kling_path = kling_dir.join(filename);
    std::fs::write(&out_path, &data)
        .with_context(|| format!("Writing output image to {}", out_path.display()))?;
    std::fs::write(&kling_path, data)
        .with_context(|| format!("Writing kling image to {}", kling_path.display()))?;
    Ok(())
}
