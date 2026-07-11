// One-off PWA icon generator — zero npm deps (node builtins only).
// Rasterizes the inline-SVG favicon design from index.html:
//   viewBox 0 0 100 100
//   <rect width=100 height=100 rx=18 fill=#0B1424>            navy plate
//   <rect x=16 y=48 w=34 h=32 rx=4 fill=#2F7FE8>              blue district
//   <rect x=50 y=48 w=34 h=32 rx=4 fill=#E4463F>              red district
//   <rect x=40 y=18 w=20 h=36 rx=3 rotate(12 50 36) #F5B942>  gold sliver
// 4×4 supersampling per output pixel. Run: node scripts/generate-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const PUB = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

const NAVY = [0x0b, 0x14, 0x24];
const BLUE = [0x2f, 0x7f, 0xe8];
const RED = [0xe4, 0x46, 0x3f];
const GOLD = [0xf5, 0xb9, 0x42];

// Signed-distance test: point inside an axis-aligned rounded rect?
function inRoundRect(px, py, x, y, w, h, r) {
  const cx = x + w / 2, cy = y + h / 2;
  const dx = Math.max(Math.abs(px - cx) - (w / 2 - r), 0);
  const dy = Math.max(Math.abs(py - cy) - (h / 2 - r), 0);
  return dx * dx + dy * dy <= r * r;
}

const ROT = (-12 * Math.PI) / 180; // inverse of the SVG's rotate(12 50 36)
const COS = Math.cos(ROT), SIN = Math.sin(ROT);

// Scene sample in viewBox units (0..100). Returns [r,g,b,a].
// opaque: fill the full square with navy (maskable / apple-touch);
// otherwise outside the rx-18 plate is transparent.
function sample(px, py, opaque) {
  let color = null;
  if (opaque || inRoundRect(px, py, 0, 0, 100, 100, 18)) color = NAVY;
  if (color === null) return [0, 0, 0, 0];
  if (inRoundRect(px, py, 16, 48, 34, 32, 4)) color = BLUE;
  if (inRoundRect(px, py, 50, 48, 34, 32, 4)) color = RED;
  const rx = 50 + (px - 50) * COS - (py - 36) * SIN;
  const ry = 36 + (px - 50) * SIN + (py - 36) * COS;
  if (inRoundRect(rx, ry, 40, 18, 20, 36, 3)) color = GOLD;
  return [color[0], color[1], color[2], 255];
}

// contentScale < 1 shrinks the drawing toward the center (maskable safe zone).
function raster(size, { opaque = false, contentScale = 1 } = {}) {
  const SS = 4; // 4×4 subsamples per pixel
  const px = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          let ux = ((x + (sx + 0.5) / SS) / size) * 100;
          let uy = ((y + (sy + 0.5) / SS) / size) * 100;
          ux = 50 + (ux - 50) / contentScale;
          uy = 50 + (uy - 50) / contentScale;
          const [cr, cg, cb, ca] = sample(ux, uy, opaque);
          r += cr * ca; g += cg * ca; b += cb * ca; a += ca;
        }
      }
      const i = (y * size + x) * 4;
      const n = SS * SS;
      px[i] = a ? Math.round(r / a) : 0;
      px[i + 1] = a ? Math.round(g / a) : 0;
      px[i + 2] = a ? Math.round(b / a) : 0;
      px[i + 3] = Math.round(a / n);
    }
  }
  return px;
}

// --- Minimal PNG writer (8-bit RGBA, filter 0) ---
const CRC_TABLE = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
function crc32(buf) {
  let c = -1;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}
function png(size, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    Buffer.from(pixels.buffer, y * size * 4, size * 4).copy(raw, y * (size * 4 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const jobs = [
  ['icon-192.png', 192, {}],
  ['icon-512.png', 512, {}],
  // Maskable: full-bleed navy, art shrunk into the ~80% safe zone.
  ['icon-512-maskable.png', 512, { opaque: true, contentScale: 0.8 }],
  // iOS masks its own corners — opaque full square, art at full scale.
  ['apple-touch-icon.png', 180, { opaque: true }],
];
for (const [name, size, opts] of jobs) {
  const file = join(PUB, name);
  writeFileSync(file, png(size, raster(size, opts)));
  console.log(`${name} — ${size}×${size}`);
}
