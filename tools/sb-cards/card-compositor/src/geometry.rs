use once_cell::sync::Lazy;
use std::collections::HashMap;

pub const W: u32 = 1000;
pub const H: u32 = 1400;

pub const PIP_GRID_X: [i32; 3] = [250, 500, 750];
pub const PIP_GRID_Y: [i32; 5] = [300, 500, 700, 900, 1100];

pub const PLAQUE_DISPLAY_SIZE: u32 = 160;
pub const PIP_SIZE_CORNER: u32 = 100;
pub const PIP_SIZE_PLAQUE: u32 = 90;
pub const PIP_SIZE_LAYOUT: u32 = 160;
pub const PIP_SIZE_CENTER: u32 = 320;

pub static PIP_LAYOUTS: Lazy<HashMap<&'static str, Vec<(usize, usize)>>> = Lazy::new(|| {
    let mut m = HashMap::new();
    m.insert("2", vec![(1, 0), (1, 4)]);
    m.insert("3", vec![(1, 0), (1, 2), (1, 4)]);
    m.insert("4", vec![(0, 0), (2, 0), (0, 4), (2, 4)]);
    m.insert("5", vec![(0, 0), (2, 0), (1, 2), (0, 4), (2, 4)]);
    m.insert("6", vec![(0, 0), (2, 0), (0, 2), (2, 2), (0, 4), (2, 4)]);
    m.insert(
        "7",
        vec![(0, 0), (2, 0), (1, 1), (0, 2), (2, 2), (0, 4), (2, 4)],
    );
    m.insert(
        "8",
        vec![
            (0, 0),
            (2, 0),
            (1, 1),
            (0, 2),
            (2, 2),
            (1, 3),
            (0, 4),
            (2, 4),
        ],
    );
    m.insert(
        "9",
        vec![
            (0, 0),
            (2, 0),
            (0, 1),
            (2, 1),
            (1, 2),
            (0, 3),
            (2, 3),
            (0, 4),
            (2, 4),
        ],
    );
    m.insert(
        "10",
        vec![
            (0, 0),
            (2, 0),
            (1, 1),
            (0, 1),
            (2, 1),
            (0, 3),
            (2, 3),
            (1, 3),
            (0, 4),
            (2, 4),
        ],
    );
    m
});
