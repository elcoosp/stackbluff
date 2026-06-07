use anyhow::{anyhow, Context, Result};
use image::RgbaImage;
use std::path::{Path, PathBuf};
use tiny_skia::{IntSize, Pixmap, PixmapPaint, Transform};

use crate::geometry::*;

pub fn resolve_raw_path(base_dir: &str, filename: &str) -> PathBuf {
    let suffix = "_inspyrenet";
    let without_suffix = filename.replace(suffix, "");
    let candidates = [
        PathBuf::from(base_dir).join("1-raw/art").join(filename),
        PathBuf::from(base_dir)
            .join("1-raw/art/all_background_removal_results")
            .join(filename),
        PathBuf::from(base_dir)
            .join("1-raw/art")
            .join(&without_suffix),
        PathBuf::from(base_dir)
            .join("1-raw/art/all_background_removal_results")
            .join(&without_suffix),
    ];
    for path in candidates {
        if path.exists() {
            return path;
        }
    }
    PathBuf::from(base_dir).join("1-raw/art").join(filename)
}

pub fn load_cropped_pixmap(path: &Path) -> Result<Pixmap> {
    let img = image::open(path)
        .with_context(|| format!("Failed to open image: {}", path.display()))?
        .into_rgba8();
    let cropped = auto_crop(&img);
    let size = IntSize::from_wh(cropped.width(), cropped.height())
        .ok_or_else(|| anyhow!("Invalid image dimensions in {}", path.display()))?;
    Pixmap::from_vec(cropped.into_raw(), size).context("Failed to create Pixmap from image data")
}

pub fn fit_pixmap_to_box(pixmap: &Pixmap, box_w: u32, box_h: u32) -> Pixmap {
    let (w, h) = (pixmap.width() as f32, pixmap.height() as f32);
    let target_ratio = box_w as f32 / box_h as f32;
    let (new_w, new_h) = if w / h > target_ratio {
        (box_w, (box_w as f32 * h / w) as u32)
    } else {
        ((box_h as f32 * w / h) as u32, box_h)
    };
    let new_w = new_w.max(1);
    let new_h = new_h.max(1);
    let mut scaled = Pixmap::new(new_w, new_h).unwrap();
    let scale_x = new_w as f32 / w;
    let scale_y = new_h as f32 / h;
    let transform = Transform::from_scale(scale_x, scale_y);
    let paint = PixmapPaint::default();
    scaled.draw_pixmap(0, 0, pixmap.as_ref(), &paint, transform, None);
    scaled
}

pub fn create_corner_light(w: u32, h: u32) -> Result<Pixmap> {
    let tile_size = 300;
    let circle_radius = 140;
    let blur_radius = 80;

    let mut mask_pix =
        Pixmap::new(tile_size, tile_size).ok_or_else(|| anyhow!("Failed to create mask Pixmap"))?;
    mask_pix.fill(tiny_skia::Color::TRANSPARENT);
    let circle_rect = tiny_skia::Rect::from_xywh(
        (tile_size as f32 - circle_radius as f32 * 2.0) / 2.0,
        (tile_size as f32 - circle_radius as f32 * 2.0) / 2.0,
        circle_radius as f32 * 2.0,
        circle_radius as f32 * 2.0,
    )
    .ok_or_else(|| anyhow!("Invalid circle rectangle"))?;
    let mut paint = tiny_skia::Paint::default();
    paint.set_color(tiny_skia::Color::WHITE);
    mask_pix.fill_rect(circle_rect, &paint, Transform::identity(), None);

    let mask_data = mask_pix.take();
    let mask_img = RgbaImage::from_raw(tile_size, tile_size, mask_data)
        .ok_or_else(|| anyhow!("Failed to create RgbaImage from mask"))?;
    let blurred_img = image::imageops::blur(&mask_img, blur_radius as f32);
    let blurred_data = blurred_img.into_raw();
    let blurred_size = IntSize::from_wh(tile_size, tile_size).unwrap();
    let blurred_pix = Pixmap::from_vec(blurred_data, blurred_size)
        .ok_or_else(|| anyhow!("Failed to create blurred Pixmap"))?;

    let mut tile =
        Pixmap::new(tile_size, tile_size).ok_or_else(|| anyhow!("Failed to create tile Pixmap"))?;
    tile.fill(tiny_skia::Color::WHITE);
    for (i, p) in tile.pixels_mut().iter_mut().enumerate() {
        let mask_alpha = blurred_pix.pixels()[i].alpha();
        // Directly create premultiplied white with alpha = mask_alpha
        *p = tiny_skia::PremultipliedColorU8::from_rgba(
            mask_alpha, mask_alpha, mask_alpha, mask_alpha,
        )
        .expect("premultiplied white tile creation");
    }

    let mut full = Pixmap::new(w, h).ok_or_else(|| anyhow!("Failed to create full Pixmap"))?;
    full.fill(tiny_skia::Color::TRANSPARENT);
    let paint = PixmapPaint::default();
    full.draw_pixmap(0, 0, tile.as_ref(), &paint, Transform::identity(), None);

    let mut tile_rot = tile.clone();
    rotate_180(&mut tile_rot);
    let rot_w = tile_rot.width() as i32;
    let rot_h = tile_rot.height() as i32;
    full.draw_pixmap(
        w as i32 - rot_w,
        h as i32 - rot_h,
        tile_rot.as_ref(),
        &paint,
        Transform::identity(),
        None,
    );

    Ok(full)
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

pub fn process_pips(base_dir: &str, suffix: &str) -> Result<()> {
    let suits = ["spades", "hearts", "diamonds", "clubs"];
    let out_dir = PathBuf::from(base_dir).join("2-pips");
    std::fs::create_dir_all(&out_dir)?;

    for suit in suits {
        let raw_path = resolve_raw_path(base_dir, &format!("pip-{}{}.png", suit, suffix));
        if !raw_path.exists() {
            eprintln!("Warning: missing pip {}", raw_path.display());
            continue;
        }
        let img = image::open(&raw_path)?.into_rgba8();
        for &size in &[
            PIP_SIZE_CORNER,
            PIP_SIZE_PLAQUE,
            PIP_SIZE_LAYOUT,
            PIP_SIZE_CENTER,
        ] {
            let resized =
                image::imageops::resize(&img, size, size, image::imageops::FilterType::Lanczos3);
            resized.save(out_dir.join(format!("{}-{}.png", suit, size)))?;
        }
    }
    Ok(())
}

pub fn load_corner_plaque(base_dir: &str, suffix: &str) -> Result<Option<Pixmap>> {
    let path = resolve_raw_path(base_dir, &format!("corner-plaque{}.png", suffix));
    if !path.exists() {
        return Ok(None);
    }
    Ok(Some(load_cropped_pixmap(&path)?))
}

pub fn load_border(base_dir: &str, suffix: &str) -> Result<Option<Pixmap>> {
    let path = resolve_raw_path(base_dir, &format!("border{}.png", suffix));
    if !path.exists() {
        return Ok(None);
    }
    let pix = load_cropped_pixmap(&path)?;
    let resized = fit_pixmap_to_box(&pix, W, H);
    Ok(Some(resized))
}

pub fn load_center_band(base_dir: &str, suffix: &str) -> Result<Option<Pixmap>> {
    let path = resolve_raw_path(base_dir, &format!("center-band{}.png", suffix));
    if !path.exists() {
        return Ok(None);
    }
    let pix = load_cropped_pixmap(&path)?;
    let new_h = (pix.height() as f32 * W as f32 / pix.width() as f32) as u32;
    let resized = fit_pixmap_to_box(&pix, W, new_h);
    Ok(Some(resized))
}

fn auto_crop(img: &RgbaImage) -> RgbaImage {
    if let Some(bbox) = bounding_box(img) {
        let mut cropped = img.clone();
        image::imageops::crop(&mut cropped, bbox.0, bbox.1, bbox.2, bbox.3).to_image()
    } else {
        img.clone()
    }
}

fn bounding_box(img: &RgbaImage) -> Option<(u32, u32, u32, u32)> {
    let (w, h) = (img.width(), img.height());
    let mut min_x = w;
    let mut min_y = h;
    let mut max_x = 0;
    let mut max_y = 0;
    for y in 0..h {
        for x in 0..w {
            if img.get_pixel(x, y).0[3] != 0 {
                min_x = min_x.min(x);
                min_y = min_y.min(y);
                max_x = max_x.max(x);
                max_y = max_y.max(y);
            }
        }
    }
    if min_x > max_x || min_y > max_y {
        None
    } else {
        Some((min_x, min_y, max_x - min_x + 1, max_y - min_y + 1))
    }
}
