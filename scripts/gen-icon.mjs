// Generates a 1024x1024 branded source PNG (a glowing dragon-heart flame on
// warm ink) with zero dependencies, then `cargo tauri icon` derives every
// platform size from it. Run: npm run gen:icon
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SIZE = 1024;
const __dirname = dirname(fileURLToPath(import.meta.url));

// --- palette (from the design system) ---
const INK = [16, 12, 8];
const EMBER_BRIGHT = [248, 217, 160];
const EMBER = [223, 145, 50];
const GARNET = [186, 70, 50];

const lerp = (a, b, t) => a + (b - a) * t;
const mix = (c1, c2, t) => [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// shape tests in normalized space: x,y in [-1,1], y up
function insideDisk(x, y, cx, cy, r) {
  const dx = x - cx, dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}
function insideTriangle(px, py, a, b, c) {
  const d = (p, q, r) => (p[0] - r[0]) * (q[1] - r[1]) - (q[0] - r[0]) * (p[1] - r[1]);
  const d1 = d([px, py], a, b);
  const d2 = d([px, py], b, c);
  const d3 = d([px, py], c, a);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}

// flame = disk (bulb) ∪ spike (triangle to a point at top)
const BULB = { cx: 0, cy: -0.18, r: 0.5 };
const SPIKE = [[-0.4, -0.02], [0.4, -0.02], [0, 0.86]];
function insideFlame(x, y) {
  return insideDisk(x, y, BULB.cx, BULB.cy, BULB.r) || insideTriangle(x, y, SPIKE[0], SPIKE[1], SPIKE[2]);
}

function sampleColor(x, y) {
  // distance from flame centre drives the ember bloom behind the shape
  const dxg = x - 0.0, dyg = y + 0.05;
  const dist = Math.sqrt(dxg * dxg + dyg * dyg);
  const glow = clamp(1 - dist / 1.15, 0, 1) ** 2.2;
  let col = mix(INK, EMBER, glow * 0.55);

  if (insideFlame(x, y)) {
    // vertical gradient: bright ember tip -> ember -> garnet base
    const t = clamp((0.86 - y) / 1.3, 0, 1);
    const fill = t < 0.5 ? mix(EMBER_BRIGHT, EMBER, t / 0.5) : mix(EMBER, GARNET, (t - 0.5) / 0.5);
    col = fill;
  }
  return col;
}

// build RGBA with 2x2 supersampling for smooth edges
const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));
for (let py = 0; py < SIZE; py++) {
  const rowStart = py * (SIZE * 4 + 1);
  raw[rowStart] = 0; // filter: none
  for (let px = 0; px < SIZE; px++) {
    let r = 0, g = 0, b = 0;
    for (let sy = 0; sy < 2; sy++) {
      for (let sx = 0; sx < 2; sx++) {
        const nx = ((px + (sx + 0.5) / 2) / SIZE) * 2 - 1;
        const ny = 1 - ((py + (sy + 0.5) / 2) / SIZE) * 2;
        const c = sampleColor(nx, ny);
        r += c[0]; g += c[1]; b += c[2];
      }
    }
    const o = rowStart + 1 + px * 4;
    raw[o] = clamp(Math.round(r / 4), 0, 255);
    raw[o + 1] = clamp(Math.round(g / 4), 0, 255);
    raw[o + 2] = clamp(Math.round(b / 4), 0, 255);
    raw[o + 3] = 255;
  }
}

// --- minimal PNG encoder ---
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // RGBA
ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
const idat = deflateSync(raw, { level: 9 });
const png = Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);

const outDir = join(__dirname, "..", "src-tauri");
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, "app-icon.png");
writeFileSync(outPath, png);
console.log(`Wrote ${outPath} (${png.length} bytes)`);
