mod assets;
mod compositor;
mod geometry;

use anyhow::Result;

const BASE_DIR: &str = "../2026-Q1/01-poison-gardenia";
const BG_SUFFIX: &str = "_inspyrenet";

fn main() -> Result<()> {
    println!("Rust card compositor (tiny-skia + fontdue)");
    println!("Base dir: {}", BASE_DIR);

    assets::process_pips(BASE_DIR, BG_SUFFIX)?;

    let corner_plaque = assets::load_corner_plaque(BASE_DIR, BG_SUFFIX)?;
    let border = assets::load_border(BASE_DIR, BG_SUFFIX)?;
    let corner_light = assets::create_corner_light(geometry::W, geometry::H)?; // Note: `create_corner_light` (singular)
    let center_band = assets::load_center_band(BASE_DIR, BG_SUFFIX)?;

    compositor::build_deck(
        BASE_DIR,
        BG_SUFFIX,
        corner_plaque.as_ref(),
        border.as_ref(),
        &corner_light,
        center_band.as_ref(),
    )?;

    println!("Deck compositing complete!");
    Ok(())
}
