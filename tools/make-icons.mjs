/* PWA icons (PNG) favicon.svg ke design se banata hai. Chalane ka tareeqa: node tools/make-icons.mjs */
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

const AMBER = [245, 158, 11], DARK = [7, 10, 18];
const RAYS = [[32, 8, 32, 15], [32, 49, 32, 56], [8, 32, 15, 32], [49, 32, 56, 32],
  [15, 15, 20, 20], [44, 44, 49, 49], [15, 49, 20, 44], [44, 20, 49, 15]];

function segDist(px, py, [x1, y1, x2, y2]) {
  const dx = x2 - x1, dy = y2 - y1;
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - x1 - t * dx, py - y1 - t * dy);
}
function inRoundRect(x, y) {
  const r = 14, cx = Math.min(Math.max(x, r), 64 - r), cy = Math.min(Math.max(y, r), 64 - r);
  return x >= 0 && y >= 0 && x <= 64 && y <= 64 && Math.hypot(x - cx, y - cy) <= r;
}
// maskable: background poori jagah, sun 70% size par beech mein (safe zone)
function sample(x, y, maskable) {
  let u = x, v = y;
  if (maskable) { u = 32 + (x - 32) / 0.7; v = 32 + (y - 32) / 0.7; }
  else if (!inRoundRect(x, y)) return null;
  const sun = Math.hypot(u - 32, v - 32) <= 10 || RAYS.some(s => segDist(u, v, s) <= 2);
  return sun ? DARK : AMBER;
}

function png(size, maskable) {
  const SS = 4, raw = Buffer.alloc(size * (size * 4 + 1));
  for (let py = 0; py < size; py++) {
    raw[py * (size * 4 + 1)] = 0;
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
        const c = sample(((px + (sx + 0.5) / SS) / size) * 64, ((py + (sy + 0.5) / SS) / size) * 64, maskable);
        if (c) { r += c[0]; g += c[1]; b += c[2]; a++; }
      }
      const o = py * (size * 4 + 1) + 1 + px * 4;
      raw[o] = a ? r / a : 0; raw[o + 1] = a ? g / a : 0; raw[o + 2] = a ? b / a : 0;
      raw[o + 3] = Math.round((a / (SS * SS)) * 255);
    }
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0;
  });
  const crc = buf => { let c = 0xffffffff; for (const x of buf) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

const out = [["icon-192.png", 192, false], ["icon-512.png", 512, false],
  ["icon-maskable-512.png", 512, true], ["apple-touch-icon.png", 180, true]];
for (const [name, size, maskable] of out) {
  writeFileSync(new URL(`../public/${name}`, import.meta.url), png(size, maskable));
  console.log("✓ public/" + name);
}
