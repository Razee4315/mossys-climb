// Renders app-icon.png (1024x1024) from the game's own sprite data.
// The artwork is a 64x64 pixel scene scaled 16x; Mossy sits inside the central
// safe zone so Android's round / squircle launcher masks never crop him.
//   node tools/make-icon.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { makeGame } = require('./verify');

const N = 64, SCALE = 16;
const px = Array.from({ length: N }, () => Array(N).fill(null));
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const put = (x, y, c) => { if (x >= 0 && y >= 0 && x < N && y < N) px[y][x] = typeof c === 'string' ? hex(c) : c; };

// dawn sky, stepped into pixel bands
const top = hex('#2a2a6a'), mid = hex('#c0608a'), bot = hex('#ffb070');
for (let y = 0; y < N; y++) {
  const t = Math.floor((y / N) * 12) / 12;
  const c = t < 0.55 ? mix(top, mid, t / 0.55) : mix(mid, bot, (t - 0.55) / 0.45);
  for (let x = 0; x < N; x++) put(x, y, c);
}
// stars
for (const [x, y] of [[6, 5], [12, 14], [52, 6], [57, 15], [8, 22]]) put(x, y, '#ffffff');
// the dawn: a solid pixel sun behind Mossy's head, with a light ring
const hx = 32, hy = 28;
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
  const r = Math.hypot(x - hx + 0.5, y - hy + 0.5);
  if (r <= 17) px[y][x] = hex('#ffb84a');
  if (r <= 14) px[y][x] = hex('#ffd76a');
  if (r <= 10) px[y][x] = hex('#ffeaa0');
}
// two snowy peaks flanking him (light from the left)
const peak = (pxX, pyY, spread) => {
  for (let y = pyY; y < N; y++) {
    const d = y - pyY;
    const xl = Math.round(pxX - d * spread), xr = Math.round(pxX + d * spread);
    for (let x = xl; x <= xr; x++) {
      const shadow = x > pxX;
      let c = shadow ? '#5a64a8' : '#8090d8';
      if (d < 6 + ((x * 7) % 2)) c = shadow ? '#c8d4f0' : '#f4f8ff';
      if (x === xl || x === xr) c = '#2a2a50';
      put(x, y, c);
    }
  }
};
peak(6, 24, 1.1);
peak(58, 20, 1.1);
// grassy foreground
for (let y = 52; y < N; y++) for (let x = 0; x < N; x++) put(x, y, y === 52 ? '#a4ec7a' : y < 55 ? '#5cc24a' : '#3f9a42');

// Mossy, 2x, standing on the grass in the middle
const game = makeGame();
const rows = game.run("composeChar(charById('mossy'), 0, 'stand')");
const pal = game.run("charById('mossy').pal");
const ox = 16, oy = 53 - 17 * 2;
const filled = (x, y) => y >= 0 && y < rows.length && x >= 0 && x < 16 && rows[y][x] !== '.';
for (let y = -1; y <= 17; y++) for (let x = -1; x <= 16; x++) {
  let c = null;
  if (filled(x, y)) c = pal[rows[y][x]];
  else if (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1)) c = '#13261b';
  if (!c) continue;
  for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) put(ox + x * 2 + i, oy + y * 2 + j, c);
}

// ---- encode PNG ----
const W = N * SCALE;
const raw = Buffer.alloc((W * 4 + 1) * W);
for (let y = 0; y < W; y++) {
  raw[y * (W * 4 + 1)] = 0;
  for (let x = 0; x < W; x++) {
    const c = px[Math.floor(y / SCALE)][Math.floor(x / SCALE)] || [0, 0, 0];
    const o = y * (W * 4 + 1) + 1 + x * 4;
    raw[o] = c[0]; raw[o + 1] = c[1]; raw[o + 2] = c[2]; raw[o + 3] = 255;
  }
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td) >>> 0);
  return Buffer.concat([len, td, crc]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(W, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
fs.writeFileSync(path.join(__dirname, '..', 'app-icon.png'), png);
console.log(`app-icon.png ${W}x${W} (${(png.length / 1024).toFixed(1)} KB)`);
