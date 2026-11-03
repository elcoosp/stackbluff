#!/usr/bin/env node

/**
 * StackBluff branded asset generator (Agent-06 / Task 2-c).
 *
 * Pure Node (zlib only — no new dependencies). Generates the template
 * assets referenced by app.json into apps/mobile/assets/images/:
 *
 *   icon.png                     1024x1024  #131313 bg + green spade
 *   android-icon-foreground.png  1024x1024  transparent + green spade (safe zone)
 *   android-icon-background.png  1024x1024  solid #131313
 *   android-icon-monochrome.png  1024x1024  transparent + white spade
 *   splash-icon.png              1024x1024  transparent + centered green spade
 *   favicon.png                    64x64    #131313 bg + green spade
 *
 * Usage: node scripts/gen-assets.mjs   (from apps/mobile)
 * The assets/expo.icon directory is intentionally left untouched.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'images');

// Brand tokens (frozen contract: ui-native tokens.ts)
const BG = [0x13, 0x13, 0x13, 0xff]; // #131313
const GREEN = [0x4e, 0xde, 0xa3, 0xff]; // #4edea3
const WHITE = [0xff, 0xff, 0xff, 0xff];
const TRANSPARENT = [0, 0, 0, 0];

// -- Minimal PNG encoder (RGBA, 8-bit, filter 0) ----------------------------
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (let i = 0; i < buffer.length; i++) c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// -- Spade glyph (approximate raster path) ----------------------------------
/**
 * Coverage test for a spade in normalized [0,1]x[0,1] space, optionally
 * scaled about the canvas center. Composition:
 *   - two circles (the top lobes)
 *   - a curved-sided triangle converging to the bottom tip
 *   - a flared stem below the tip
 */
function makeSpadeTest(scale) {
  return (nx, ny) => {
    // scale about center (0.5, 0.5)
    const x = 0.5 + (nx - 0.5) / scale;
    const y = 0.5 + (ny - 0.5) / scale;
    const cx = 0.5;
    const lobeR = 0.165;
    const lobeDx = 0.132;
    const lobeCy = 0.355;
    // Lobes
    const inLeft = (x - (cx - lobeDx)) ** 2 + (y - lobeCy) ** 2 <= lobeR ** 2;
    const inRight = (x - (cx + lobeDx)) ** 2 + (y - lobeCy) ** 2 <= lobeR ** 2;
    if (inLeft || inRight) return true;
    // Body triangle: tip (0.5, 0.72) -> base y=0.355 half-width 0.297
    const tipY = 0.72;
    if (y >= lobeCy && y <= tipY) {
      const t = (tipY - y) / (tipY - lobeCy); // 0 at tip, 1 at base
      const halfWidth = 0.297 * t ** 0.9;
      if (Math.abs(x - cx) <= halfWidth) return true;
    }
    // Stem: y 0.60 -> 0.90, flares toward the base
    const stemTop = 0.6;
    const stemBottom = 0.9;
    if (y >= stemTop && y <= stemBottom) {
      const t = (y - stemTop) / (stemBottom - stemTop);
      const halfWidth = 0.042 + 0.062 * t ** 1.5;
      if (Math.abs(x - cx) <= halfWidth) return true;
    }
    return false;
  };
}

/** Render an RGBA buffer with 2x2 supersampled glyph coverage. */
function renderSpade({ size, background, glyph, glyphScale }) {
  const rgba = Buffer.alloc(size * size * 4);
  const inside = makeSpadeTest(glyphScale);
  const offsets = [
    [0.25, 0.25],
    [0.75, 0.25],
    [0.25, 0.75],
    [0.75, 0.75],
  ];
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let hits = 0;
      for (const [ox, oy] of offsets) {
        const nx = (px + ox) / size;
        const ny = (py + oy) / size;
        if (inside(nx, ny)) hits++;
      }
      const coverage = hits / offsets.length;
      const i = (py * size + px) * 4;
      const bg = background ?? TRANSPARENT;
      const fg = glyph;
      for (let c = 0; c < 4; c++) {
        rgba[i + c] = Math.round(bg[c] * (1 - coverage) + fg[c] * coverage);
      }
    }
  }
  return rgba;
}

// -- Generate + write --------------------------------------------------------
const jobs = [
  {
    file: 'icon.png',
    size: 1024,
    render: () => renderSpade({ size: 1024, background: BG, glyph: GREEN, glyphScale: 0.78 }),
  },
  {
    file: 'android-icon-foreground.png',
    size: 1024,
    render: () =>
      renderSpade({ size: 1024, background: TRANSPARENT, glyph: GREEN, glyphScale: 0.6 }),
  },
  {
    file: 'android-icon-background.png',
    size: 1024,
    render: () => {
      const rgba = Buffer.alloc(1024 * 1024 * 4);
      for (let i = 0; i < rgba.length; i += 4) {
        rgba[i] = BG[0];
        rgba[i + 1] = BG[1];
        rgba[i + 2] = BG[2];
        rgba[i + 3] = BG[3];
      }
      return rgba;
    },
  },
  {
    file: 'android-icon-monochrome.png',
    size: 1024,
    render: () =>
      renderSpade({ size: 1024, background: TRANSPARENT, glyph: WHITE, glyphScale: 0.6 }),
  },
  {
    file: 'splash-icon.png',
    size: 1024,
    render: () =>
      renderSpade({ size: 1024, background: TRANSPARENT, glyph: GREEN, glyphScale: 0.85 }),
  },
  {
    file: 'favicon.png',
    size: 64,
    render: () => renderSpade({ size: 64, background: BG, glyph: GREEN, glyphScale: 0.8 }),
  },
];

mkdirSync(OUT_DIR, { recursive: true });
for (const job of jobs) {
  const png = encodePng(job.size, job.size, job.render());
  const out = join(OUT_DIR, job.file);
  writeFileSync(out, png);
  console.log(`wrote ${out} (${job.size}x${job.size}, ${png.length} bytes)`);
}
console.log('done.');
