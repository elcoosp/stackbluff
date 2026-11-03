#!/usr/bin/env node
/**
 * Generates `assets/felt-noise.png` — a 256×256 RGBA tileable fractal-ish
 * noise texture that replaces the PWA's inline SVG feTurbulence data-URI on
 * the felt (RN cannot render SVG filters). Pure Node (zlib deflate only),
 * no external dependencies.
 *
 * Usage:  node scripts/gen-felt-noise.mjs
 * Output: ../assets/felt-noise.png (committed to the repo)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const SIZE = 256;

/* ── deterministic PRNG (mulberry32) so regeneration is reproducible ── */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ── tileable value noise: periodic lattice + smoothstep bilinear ── */
function makeOctave(freq, rand) {
  const lattice = new Float64Array(freq * freq);
  for (let i = 0; i < lattice.length; i++) lattice[i] = rand();
  return (x, y) => {
    const fx = x * freq;
    const fy = y * freq;
    const x0 = Math.floor(fx) % freq;
    const y0 = Math.floor(fy) % freq;
    const x1 = (x0 + 1) % freq;
    const y1 = (y0 + 1) % freq;
    const tx = fx - Math.floor(fx);
    const ty = fy - Math.floor(fy);
    const sx = tx * tx * (3 - 2 * tx); // smoothstep
    const sy = ty * ty * (3 - 2 * ty);
    const n00 = lattice[y0 * freq + x0];
    const n10 = lattice[y0 * freq + x1];
    const n01 = lattice[y1 * freq + x0];
    const n11 = lattice[y1 * freq + x1];
    const top = n00 + (n10 - n00) * sx;
    const bottom = n01 + (n11 - n01) * sx;
    return top + (bottom - top) * sy;
  };
}

const rand = mulberry32(0x5b17ff);

/* fractal sum — like feTurbulence baseFrequency 0.9, numOctaves 4 */
const octaves = [
  { freq: 4, amp: 0.45 },
  { freq: 8, amp: 0.27 },
  { freq: 16, amp: 0.16 },
  { freq: 32, amp: 0.12 },
].map(({ freq, amp }) => ({ noise: makeOctave(freq, rand), amp }));

function fractalNoise(x, y) {
  let sum = 0;
  let norm = 0;
  for (const { noise, amp } of octaves) {
    sum += noise(x, y) * amp;
    norm += amp;
  }
  return sum / norm;
}

/* ── RGBA raster: mid-gray speckle with full alpha ── */
const pixels = Buffer.alloc(SIZE * SIZE * 4);
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const v = fractalNoise(x / SIZE, y / SIZE);
    const gray = Math.round(96 + v * 128); // ≈ 96..224, mid ≈ 160
    const i = (y * SIZE + x) * 4;
    pixels[i] = gray;
    pixels[i + 1] = gray;
    pixels[i + 2] = gray;
    pixels[i + 3] = 255;
  }
}

/* ── minimal PNG encoder ── */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
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
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  // filter 0 bytes per row
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0;
    rgba.copy(raw, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets');
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, 'felt-noise.png');
writeFileSync(outPath, encodePng(SIZE, SIZE, pixels));
console.log(`felt-noise.png written: ${SIZE}x${SIZE} RGBA → ${outPath}`);
