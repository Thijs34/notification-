// Generates the PWA icons (a white bell on an indigo background) as PNGs,
// using only Node built-ins. Run with: npm run icons
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

const OUT_DIR = new URL('../public/icons/', import.meta.url);
mkdirSync(OUT_DIR, { recursive: true });

const BG = [79, 70, 229]; // #4f46e5
const FG = [255, 255, 255];

// Is the normalized point (u, v) inside the bell shape?
function inBell(u, v) {
  const dx = u - 0.5;
  const circle = (cx, cy, r) => (u - cx) ** 2 + (v - cy) ** 2 <= r * r;
  if (circle(0.5, 0.215, 0.04)) return true; // top knob
  if (v <= 0.42 && circle(0.5, 0.42, 0.2)) return true; // dome
  if (v >= 0.42 && v <= 0.62 && Math.abs(dx) <= 0.2 + (v - 0.42) * 0.35) return true; // body
  if (v >= 0.615 && v <= 0.67 && Math.abs(dx) <= 0.29) return true; // rim
  if (circle(0.5, 0.715, 0.06)) return true; // clapper
  return false;
}

function crc32(buf) {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([len, typeAndData, crc]);
}

function png(size, { transparentBg = false } = {}) {
  const SS = 4; // supersampling for smooth edges
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1);
    raw[row] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      let hits = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          if (inBell((x + (sx + 0.5) / SS) / size, (y + (sy + 0.5) / SS) / size)) hits++;
        }
      }
      const a = hits / (SS * SS);
      const i = row + 1 + x * 4;
      if (transparentBg) {
        raw.set([...FG, Math.round(a * 255)], i);
      } else {
        raw.set([...BG.map((b, k) => Math.round(b + (FG[k] - b) * a)), 255], i);
      }
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const files = {
  'icon-192.png': png(192),
  'icon-512.png': png(512),
  'apple-touch-icon.png': png(180),
  // Monochrome small icon shown in the Android status bar.
  'badge-96.png': png(96, { transparentBg: true }),
};

for (const [name, data] of Object.entries(files)) {
  writeFileSync(new URL(name, OUT_DIR), data);
  console.log(`wrote public/icons/${name}`);
}
