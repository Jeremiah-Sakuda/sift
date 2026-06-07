/**
 * Generate Sift's extension icons (the funnel mark) as PNGs — no dependencies.
 *
 * Draws each icon at 4x supersampling and box-downsamples for anti-aliasing,
 * then encodes a 32-bit RGBA PNG by hand (IHDR + IDAT via zlib + IEND).
 * WXT auto-detects public/icon/{16,32,48,96,128}.png and wires the manifest.
 *
 * Run: npm run icons
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icon');
const SIZES = [16, 32, 48, 96, 128];
const SS = 4; // supersampling factor

const INDIGO = [79, 70, 229];
const WHITE = [255, 255, 255];
const LIGHT = [199, 210, 254];

const lerp = (a, b, t) => a + (b - a) * t;

/** Rounded-square mask covering the full canvas. */
function inRoundedSquare(u, v, rr = 0.22) {
  const qx = u < rr ? rr - u : u > 1 - rr ? u - (1 - rr) : 0;
  const qy = v < rr ? rr - v : v > 1 - rr ? v - (1 - rr) : 0;
  return qx * qx + qy * qy <= rr * rr;
}

/** Funnel bowl + stem. */
function inFunnel(u, v) {
  const y0 = 0.3,
    y1 = 0.55,
    y2 = 0.66;
  if (v >= y0 && v <= y1) {
    const t = (v - y0) / (y1 - y0);
    return u >= lerp(0.2, 0.43, t) && u <= lerp(0.8, 0.57, t);
  }
  if (v > y1 && v <= y2) return u >= 0.455 && u <= 0.545;
  return false;
}

/** The sifted drop below the funnel. */
function inDrop(u, v) {
  const dx = u - 0.5,
    dy = v - 0.745;
  return dx * dx + dy * dy <= 0.058 * 0.058;
}

function renderPixel(u, v) {
  if (!inRoundedSquare(u, v)) return [0, 0, 0, 0];
  if (inDrop(u, v)) return [...LIGHT, 255];
  if (inFunnel(u, v)) return [...WHITE, 255];
  return [...INDIGO, 255];
}

function renderIcon(size) {
  const data = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0,
        g = 0,
        b = 0,
        a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const u = (x + (sx + 0.5) / SS) / size;
          const v = (y + (sy + 0.5) / SS) / size;
          const [pr, pg, pb, pa] = renderPixel(u, v);
          // premultiply for correct edge AA against transparency
          const af = pa / 255;
          r += pr * af;
          g += pg * af;
          b += pb * af;
          a += pa;
        }
      }
      const n = SS * SS;
      const af = a / 255 / n;
      const i = (y * size + x) * 4;
      data[i] = af > 0 ? Math.round(r / n / af) : 0;
      data[i + 1] = af > 0 ? Math.round(g / n / af) : 0;
      data[i + 2] = af > 0 ? Math.round(b / n / af) : 0;
      data[i + 3] = Math.round(a / n);
    }
  }
  return data;
}

// --- minimal PNG encoder ---------------------------------------------------

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
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  // scanlines with filter byte 0
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

mkdirSync(OUT, { recursive: true });
for (const size of SIZES) {
  const png = encodePng(size, renderIcon(size));
  writeFileSync(resolve(OUT, `${size}.png`), png);
  console.log(`icon/${size}.png  (${png.length} bytes)`);
}
console.log('done');
