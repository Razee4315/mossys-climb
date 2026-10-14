// =====================================================================
//  THEMES — terrain auto-tiling (baked per level) + parallax backdrops
// =====================================================================
const THEMES = {
  meadow: {
    pattern: 'dirt', base: '#8a5a34', dark: '#6a4224', light: '#a8744a', edge: '#2e1a0e',
    cap: 'grass', top: '#5cc24a', topHi: '#a4ec7a', topDark: '#2f8a3a',
    deco: ['tuft', 'tuft', 'flower', 'flowerY', 'pebble', 'tuft'], decoRate: 0.4, under: 'roots', plank: 'wood',
    sky: ['#3f9cf5', '#a8e0ff'], skyHigh: ['#2a6ad0', '#8ccaf5'], sun: '#fff4c0', clouds: true,
    bg: 'meadow', weather: 'leaves', darkness: 0, music: 'meadow', stone: '#9a8f9e',
  },
  forest: {
    pattern: 'dirt', base: '#5e4030', dark: '#43291c', light: '#7a5640', edge: '#1c120c',
    cap: 'grass', top: '#3fa04e', topHi: '#78d56e', topDark: '#226c3a',
    deco: ['fern', 'mushroom', 'tuft', 'tuft', 'fern'], decoRate: 0.45, under: 'vines', plank: 'wood',
    sky: ['#17394a', '#5f9c84'], skyHigh: ['#17394a', '#5f9c84'], clouds: false,
    bg: 'forest', weather: 'fireflies', darkness: 0.18, music: 'forest', stone: '#8a8478',
  },
  cave: {
    pattern: 'rock', base: '#4a4262', dark: '#342e48', light: '#5f577c', edge: '#16121f',
    cap: 'stone', top: '#6c6492', topHi: '#8f88b6', topDark: '#4a4262',
    deco: ['glowshroom', 'crystal', 'pebble', 'glowshroom'], decoRate: 0.3, under: 'stalactites', plank: 'stone',
    sky: ['#0b0914', '#1f1a30'], skyHigh: ['#0b0914', '#1f1a30'], clouds: false,
    bg: 'cave', weather: 'spores', backwall: false, darkness: 0.6, music: 'cave', stone: '#7a7090',
  },
  magma: {
    pattern: 'rock', base: '#3e2e30', dark: '#2a1e20', light: '#54403f', edge: '#120a0c', cracks: true,
    cap: 'stone', top: '#5c4642', topHi: '#7c605a', topDark: '#3e2e30',
    deco: ['ember', 'pebble'], decoRate: 0.2, under: 'drips', plank: 'stone',
    sky: ['#1a0707', '#4a120e'], skyHigh: ['#0e0408', '#30101a'], clouds: false,
    bg: 'magma', weather: 'embers', backwall: false, darkness: 0.42, music: 'magma', stone: '#6a5050',
  },
  ruins: {
    pattern: 'brick', base: '#c9a66b', dark: '#a07c46', light: '#e4c58c', mortar: '#7d6038', edge: '#3a2a14',
    cap: 'grass', top: '#79c24e', topHi: '#b0e878', topDark: '#4a8a34',
    deco: ['tuft', 'flowerY', 'tuft', 'flower'], decoRate: 0.3, under: 'vines', plank: 'wood',
    sky: ['#ff8a5a', '#ffd8a0'], skyHigh: ['#c05a8a', '#ffb08a'], sun: '#fff0b0', clouds: true,
    bg: 'ruins', weather: 'petals', darkness: 0, music: 'ruins', stone: '#a89070',
  },
  ice: {
    pattern: 'rock', base: '#7090bc', dark: '#526f9a', light: '#94b4dc', edge: '#1e2c48',
    cap: 'snow', top: '#eef6ff', topHi: '#ffffff', topDark: '#b8d0ec',
    deco: ['snowlump', 'pine', 'snowlump'], decoRate: 0.25, under: 'icicles', plank: 'ice',
    sky: ['#6ab0e8', '#e0f4ff'], skyHigh: ['#3a78c8', '#bfe4ff'], sun: '#ffffff', clouds: true,
    bg: 'ice', weather: 'snow', darkness: 0, music: 'ice', stone: '#a0b8d8',
  },
  storm: {
    pattern: 'brick', base: '#535c78', dark: '#3a4158', light: '#6c7694', mortar: '#2a3044', edge: '#141824',
    cap: 'stone', top: '#8590b0', topHi: '#aab4d0', topDark: '#5c6582',
    deco: ['rubble', 'rubble', 'tuftGrey'], decoRate: 0.15, under: 'chains', plank: 'metal',
    sky: ['#10152a', '#323c60'], skyHigh: ['#080a18', '#252c4c'], clouds: false,
    bg: 'storm', weather: 'rain', darkness: 0.2, music: 'storm', stone: '#7a84a0',
  },
  summit: {
    pattern: 'brick', base: '#5a6280', dark: '#3c4460', light: '#747e9e', mortar: '#2a3044', edge: '#141824',
    cap: 'snow', top: '#e8f0ff', topHi: '#ffffff', topDark: '#a8b8d8',
    deco: ['rubble', 'snowlump'], decoRate: 0.15, under: 'icicles', plank: 'metal',
    sky: ['#0c1024', '#2c2a50'], skyHigh: ['#0c1024', '#2c2a50'], clouds: false,
    bg: 'summit', weather: 'rain', darkness: 0.1, music: 'boss', stone: '#8a94b0',
  },
};

function hash2(x, y, s = 0) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const _u32 = {};
function toU32(hex) {
  if (_u32[hex] !== undefined) return _u32[hex];
  const [r, g, b] = hexToRgb(hex);
  return (_u32[hex] = ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0);
}

// A pixel buffer we can paint into and turn into a canvas
function PixBuf(w, h) {
  const c = newCanvas(w, h);
  const g = c.getContext('2d');
  const img = g.createImageData(w, h);
  const buf = new Uint32Array(img.data.buffer);
  return {
    w, h, c,
    put(x, y, hex) { x |= 0; y |= 0; if (x >= 0 && y >= 0 && x < w && y < h) buf[y * w + x] = toU32(hex); },
    rect(x, y, rw, rh, hex) { for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) this.put(x + i, y + j, hex); },
    clear(x, y) { if (x >= 0 && y >= 0 && x < w && y < h) buf[y * w + x] = 0; },
    isEmpty(x, y) { return x < 0 || y < 0 || x >= w || y >= h || buf[y * w + x] === 0; },
    done() { g.putImageData(img, 0, 0); return c; },
  };
}

const SOLID_ART = new Set(['#', 'X', '%']);

function basePixel(th, wx, wy) {
  if (th.pattern === 'brick') {
    const row = Math.floor(wy / 8);
    const bx = wx + (row % 2) * 8;
    if (wy % 8 === 7 || bx % 16 === 15) return th.mortar;
    const tone = hash2(Math.floor(bx / 16), row, 11);
    let col = tone < 0.25 ? th.dark : tone > 0.8 ? th.light : th.base;
    if (wy % 8 === 0) col = shade(col, 0.12);
    const n = hash2(wx, wy, 4);
    if (n < 0.05) col = shade(col, -0.15);
    return col;
  }
  if (th.pattern === 'rock') {
    const band = hash2(wx >> 3, wy >> 2, 3);
    let col = band < 0.28 ? th.dark : band > 0.82 ? th.light : th.base;
    const n = hash2(wx >> 1, wy >> 1, 5);
    if (n < 0.07) col = th.dark; else if (n > 0.96) col = th.light;
    return col;
  }
  // dirt with pebbles
  const n = hash2(wx >> 1, wy >> 1, 1);
  let col = n < 0.1 ? th.dark : n > 0.93 ? th.light : th.base;
  const cx = wx >> 3, cy = wy >> 3;
  if (hash2(cx, cy, 7) < 0.22) {
    const px = cx * 8 + 1 + Math.floor(hash2(cx, cy, 8) * 4), py = cy * 8 + 1 + Math.floor(hash2(cx, cy, 9) * 4);
    if (wx >= px && wx < px + 3 && wy >= py && wy < py + 2) col = wy === py + 1 ? th.dark : th.stone || th.light;
  }
  return col;
}

function capDepth(th, wx) {
  if (th.cap === 'snow') return 4 + Math.floor(hash2(wx >> 2, 0, 21) * 2.5);
  if (th.cap === 'stone') return 2 + Math.floor(hash2(wx >> 1, 0, 22) * 2);
  return 3 + Math.floor(hash2(wx >> 1, 0, 23) * 3);
}

// Paint one solid tile. P(x,y,hex) paints in tile-local coords; nb = neighbour solidity.
function paintSolid(P, Pclear, th, cx, cy, nb, cracked) {
  const ox = cx * TS, oy = cy * TS;
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
    const wx = ox + x, wy = oy + y;
    // rounded outer corners
    if (!nb.u && !nb.l && ((x === 0 && y < 2) || (x === 1 && y === 0))) { Pclear(x, y); continue; }
    if (!nb.u && !nb.r && ((x === 15 && y < 2) || (x === 14 && y === 0))) { Pclear(x, y); continue; }
    if (!nb.d && !nb.l && ((x === 0 && y > 13) || (x === 1 && y === 15))) { Pclear(x, y); continue; }
    if (!nb.d && !nb.r && ((x === 15 && y > 13) || (x === 14 && y === 15))) { Pclear(x, y); continue; }
    let col = basePixel(th, wx, wy);
    if (!nb.l && x === 1) col = shade(col, 0.1);
    if (!nb.r && x === 14) col = shade(col, -0.18);
    if (!nb.d && y === 14) col = shade(col, -0.2);
    if (!nb.l && x === 0) col = th.edge;
    if (!nb.r && x === 15) col = th.edge;
    if (!nb.d && y === 15) col = th.edge;
    if (!nb.u) {
      const d = capDepth(th, wx);
      if (y < d) {
        col = y === 0 ? th.topHi : y === d - 1 ? th.topDark : th.top;
        if (th.cap === 'grass' && y > 0 && y < d - 1 && hash2(wx, wy, 31) < 0.12) col = th.topHi;
        if ((!nb.l && x === 0) || (!nb.r && x === 15)) col = th.topDark;
      } else if (y === d && th.cap !== 'stone') col = shade(col, -0.25);
    } else if (!nb.l && x < 2 && !nb.ul) {
      // keep side edge
    }
    // inner shadow below an overhang
    if (nb.u && !nb.ul && nb.l && x === 0 && y === 0) col = shade(col, -0.2);
    P(x, y, col);
  }
  if (th.cracks && hash2(cx, cy, 41) < 0.4) {
    let x = 2 + Math.floor(hash2(cx, cy, 42) * 12), y = nb.u ? 1 : 5;
    const len = 5 + Math.floor(hash2(cx, cy, 43) * 7);
    for (let i = 0; i < len && y < 15; i++) {
      P(x, y, '#ff7a1a'); if (x + 1 < 15) P(x + 1, y, '#8a2a12');
      y++; x = clamp(x + Math.round(hash2(cx * 7 + i, cy, 44) * 2 - 1), 1, 14);
    }
  }
  if (cracked) {
    const cxp = 6 + Math.floor(hash2(cx, cy, 51) * 4);
    for (const [dx, dy] of [[0, 0], [1, 1], [1, 2], [2, 3], [1, 4], [-1, 2]]) P(cxp + dx, 5 + dy, th.edge);
  }
}

function paintSpike(P, dir) {
  const draw = (x, y, col) => {
    if (dir === '^') P(x, y, col);
    else if (dir === 'v') P(x, 15 - y, col);
    else if (dir === '>') P(15 - y, x, col);
    else P(y, x, col);
  };
  for (let x = 0; x < 16; x++) { draw(x, 15, '#4a5064'); draw(x, 14, '#7a8296'); }
  for (let i = 0; i < 4; i++) {
    const x0 = i * 4;
    for (let y = 7; y < 14; y++) {
      const half = ((y - 7) / 6) * 2;
      for (let x = 0; x < 4; x++) {
        const dx = x - 1.5;
        if (Math.abs(dx) <= half + 0.01) draw(x0 + x, y, dx < 0 ? '#eef2fa' : '#9aa4b8');
      }
    }
    draw(x0 + 1, 7, '#ffffff');
  }
}

function paintPlank(P, kind) {
  const C = {
    wood: ['#f0c488', '#c88a4a', '#7a4a20', '#5a3418'], stone: ['#a49cc0', '#7a7296', '#4a4462', '#2e2a40'],
    metal: ['#c8d0e0', '#8a94ac', '#4c546a', '#2c3242'], ice: ['#ffffff', '#b8e4ff', '#6aa8d8', '#3a6a9a'],
  }[kind] || ['#f0c488', '#c88a4a', '#7a4a20', '#5a3418'];
  for (let x = 0; x < 16; x++) {
    P(x, 0, C[0]); P(x, 1, C[1]); P(x, 2, C[1]); P(x, 3, C[1]); P(x, 4, C[2]); P(x, 5, C[3]);
    if (x % 8 === 7) { P(x, 1, C[2]); P(x, 2, C[2]); P(x, 3, C[2]); }
    if (x % 8 === 2) P(x, 2, C[3]);
  }
}

function paintIce(P, nb) {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    let col = (x - y + 64) % 11 < 2 ? '#e8f8ff' : (x + y) % 13 === 0 ? '#c4ecff' : '#9fd6ff';
    if (y === 0 && !nb.u) col = '#ffffff';
    if (y === 1 && !nb.u) col = '#d8f2ff';
    if ((x === 0 && !nb.l) || (x === 15 && !nb.r) || (y === 15 && !nb.d)) col = '#2a5a8a';
    else if ((x === 14 && !nb.r) || (y === 14 && !nb.d)) col = '#5aa0d8';
    P(x, y, col);
  }
}

// Small decorations sitting on top of ground (drawn into the empty cell above)
function paintDeco(B, kind, x, y, seed, lights) {
  // x,y = world pixel of the ground surface (deco grows upward from y-1)
  const r = (k) => hash2(x, y, seed + k);
  switch (kind) {
    case 'tuft': case 'tuftGrey': {
      const c1 = kind === 'tuft' ? '#7ad85a' : '#8a94a8', c2 = kind === 'tuft' ? '#3a9a3a' : '#5a6276';
      for (let i = 0; i < 4; i++) { const h = 2 + Math.floor(r(i) * 3); for (let j = 0; j < h; j++) B.put(x + i * 2, y - 1 - j, j === h - 1 ? c1 : c2); }
      break;
    }
    case 'flower': case 'flowerY': {
      const petal = kind === 'flowerY' ? '#ffd84a' : pick2(['#ff7aa8', '#ffffff', '#b07aff'], r(1));
      B.put(x + 2, y - 1, '#2f8a3a'); B.put(x + 2, y - 2, '#2f8a3a'); B.put(x + 3, y - 2, '#4cc24a');
      B.put(x + 2, y - 4, petal); B.put(x + 1, y - 3, petal); B.put(x + 3, y - 3, petal); B.put(x + 2, y - 3, '#ffcf3a');
      break;
    }
    case 'pebble': case 'rubble':
      B.rect(x + 1, y - 2, 3, 2, '#8a8296'); B.put(x + 1, y - 2, '#b8b0c4'); B.put(x + 5, y - 1, '#6a6278');
      break;
    case 'mushroom':
      B.rect(x + 2, y - 2, 2, 2, '#f4e8d0'); B.rect(x + 1, y - 4, 4, 2, '#e8434f'); B.put(x, y - 3, '#e8434f'); B.put(x + 5, y - 3, '#b02a3a');
      B.put(x + 2, y - 4, '#ffffff'); B.put(x + 4, y - 3, '#ffffff');
      break;
    case 'fern':
      for (let i = 0; i < 5; i++) { B.put(x + 3, y - 1 - i, '#2f8a3a'); if (i > 0) { B.put(x + 2 - (i % 2), y - 1 - i, '#4cc24a'); B.put(x + 4 + (i % 2), y - 1 - i, '#4cc24a'); } }
      break;
    case 'glowshroom':
      B.rect(x + 2, y - 2, 1, 2, '#c8f0ff'); B.rect(x + 1, y - 4, 3, 2, '#5af0ff'); B.put(x + 1, y - 4, '#d8ffff');
      B.rect(x + 6, y - 2, 1, 2, '#c8f0ff'); B.rect(x + 5, y - 3, 3, 1, '#5af0ff');
      lights.push({ x: x + 3, y: y - 4, r: 26, col: 'cyan' });
      break;
    case 'crystal':
      B.rect(x + 2, y - 5, 2, 5, '#c08aff'); B.put(x + 2, y - 5, '#f0d8ff'); B.put(x + 2, y - 4, '#f0d8ff'); B.rect(x + 4, y - 3, 2, 3, '#8a5ae0'); B.put(x + 4, y - 3, '#c08aff');
      lights.push({ x: x + 3, y: y - 3, r: 22, col: 'violet' });
      break;
    case 'ember':
      B.rect(x + 2, y - 2, 2, 2, '#ff8a2a'); B.put(x + 2, y - 2, '#ffe07a');
      lights.push({ x: x + 3, y: y - 2, r: 16, col: 'orange' });
      break;
    case 'snowlump':
      B.rect(x + 1, y - 2, 6, 2, '#ffffff'); B.rect(x + 2, y - 3, 3, 1, '#ffffff'); B.put(x + 6, y - 1, '#d0e2f4');
      break;
    case 'pine':
      B.rect(x + 3, y - 2, 1, 2, '#6a4a30');
      for (let i = 0; i < 4; i++) B.rect(x + 3 - (3 - i), y - 3 - i * 2, 1 + (3 - i) * 2, 2, i % 2 ? '#2f6a5a' : '#3f8a6a');
      B.put(x + 3, y - 10, '#ffffff'); B.rect(x + 1, y - 5, 2, 1, '#ffffff');
      break;
  }
}
function pick2(arr, r) { return arr[Math.floor(r * arr.length) % arr.length]; }

function paintUnder(B, kind, x, y, seed, lights) {
  // x,y = world pixel just below the ceiling tile
  const r = (k) => hash2(x, y, seed + k);
  const len = 2 + Math.floor(r(1) * 6);
  switch (kind) {
    case 'roots': for (let i = 0; i < len - 1; i++) B.put(x + (i > 2 ? 1 : 0), y + i, '#5a3a20'); break;
    case 'vines': for (let i = 0; i < len + 3; i++) { B.put(x, y + i, '#3a8a3a'); if (i % 3 === 1) B.put(x + 1, y + i, '#6ac85a'); } break;
    case 'stalactites': for (let i = 0; i < len; i++) { const w = Math.max(1, 3 - i); B.rect(x - (w >> 1), y + i, w, 1, i === 0 ? '#5f577c' : '#4a4262'); } break;
    case 'icicles': for (let i = 0; i < len; i++) { const w = Math.max(1, 3 - Math.floor(i / 2)); B.rect(x - (w >> 1), y + i, w, 1, i < 2 ? '#ffffff' : '#b8e4ff'); } break;
    case 'drips': for (let i = 0; i < Math.min(len, 4); i++) B.put(x, y + i, i === Math.min(len, 4) - 1 ? '#ffd25a' : '#ff7a1a'); lights.push({ x, y: y + 2, r: 12, col: 'orange' }); break;
    case 'chains': for (let i = 0; i < len + 4; i++) B.put(x, y + i, i % 2 ? '#5a6276' : '#9aa4b8'); break;
  }
}

// Bake the static terrain of a level into one canvas.
function buildLevelArt(L) {
  const th = THEMES[L.theme];
  const W = L.w * TS, H = L.h * TS;
  const B = PixBuf(W, H);
  const lights = [];
  const at = (cx, cy) => (cx < 0 || cy < 0 || cx >= L.w || cy >= L.h ? '#' : L.rows[cy][cx]);
  const solid = (cx, cy) => SOLID_ART.has(at(cx, cy));
  const nbOf = (cx, cy, fn) => ({
    u: fn(cx, cy - 1), d: fn(cx, cy + 1), l: fn(cx - 1, cy), r: fn(cx + 1, cy),
    ul: fn(cx - 1, cy - 1), ur: fn(cx + 1, cy - 1),
  });
  const openAbove = (ch) => !SOLID_ART.has(ch) && ch !== 'I' && ch !== '=' && ch !== 'L' && !'^v<>'.includes(ch);
  // enclosed pockets (secret caves, rooms behind fake walls) get a dark back wall
  if (th.backwall !== false) {
    const outside = new Uint8Array(L.w * L.h);
    const stack = [];
    const blocks = (c) => SOLID_ART.has(c) || c === 'I';
    for (let x = 0; x < L.w; x++) if (!blocks(at(x, 0))) { outside[x] = 1; stack.push(x); }
    while (stack.length) {
      const i = stack.pop(), x = i % L.w, y = (i / L.w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= L.w || ny >= L.h) continue;
        const j = ny * L.w + nx;
        if (!outside[j] && !blocks(at(nx, ny))) { outside[j] = 1; stack.push(j); }
      }
    }
    for (let cy = 0; cy < L.h; cy++) for (let cx = 0; cx < L.w; cx++) {
      if (outside[cy * L.w + cx] || SOLID_ART.has(at(cx, cy)) || at(cx, cy) === 'I') continue;
      for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
        const wx = cx * TS + x, wy = cy * TS + y;
        B.put(wx, wy, shade(basePixel(th, wx, wy), solid(cx, cy - 1) && y < 3 ? -0.72 : -0.58));
      }
    }
  }
  for (let cy = 0; cy < L.h; cy++) for (let cx = 0; cx < L.w; cx++) {
    const ch = at(cx, cy);
    const ox = cx * TS, oy = cy * TS;
    const P = (x, y, col) => B.put(ox + x, oy + y, col);
    const Pc = (x, y) => B.clear(ox + x, oy + y);
    if (ch === '#') {
      const nb = nbOf(cx, cy, solid);
      paintSolid(P, Pc, th, cx, cy, nb, false);
      // grass blades poking above the surface
      if (!nb.u && openAbove(at(cx, cy - 1))) {
        if (th.cap === 'grass') for (let x = 0; x < 16; x++) if (hash2(ox + x, oy, 61) < 0.28) { B.put(ox + x, oy - 1, th.top); if (hash2(ox + x, oy, 62) < 0.4) B.put(ox + x, oy - 2, th.topHi); }
        if (th.cap === 'snow') for (let x = 1; x < 15; x++) if (hash2(ox + x, oy, 63) < 0.2) B.put(ox + x, oy - 1, '#ffffff');
        if (hash2(cx, cy, 71) < th.decoRate && at(cx, cy - 1) === '.') {
          const kind = th.deco[Math.floor(hash2(cx, cy, 72) * th.deco.length)];
          paintDeco(B, kind, ox + 2 + Math.floor(hash2(cx, cy, 73) * 7), oy, cx * 31 + cy, lights);
        }
      }
      if (!nb.d && openAbove(at(cx, cy + 1)) && at(cx, cy + 1) !== '=') {
        for (let x = 2; x < 14; x++) if (hash2(ox + x, oy, 81) < 0.09) paintUnder(B, th.under, ox + x, oy + 16, 5, lights);
      }
    } else if (ch === 'I') {
      paintIce(P, nbOf(cx, cy, (x, y) => at(x, y) === 'I' || solid(x, y)));
    } else if (ch === '=') {
      paintPlank(P, th.plank);
    } else if ('^v<>'.includes(ch)) {
      paintSpike(P, ch);
    }
  }
  return { canvas: B.done(), lights };
}

// Canvas for a single collapsing tile (looks like ground, with a faint crack)
function buildTileCanvas(L, cx, cy, cracked) {
  const th = THEMES[L.theme];
  const B = PixBuf(TS, TS);
  const at = (x, y) => (x < 0 || y < 0 || x >= L.w || y >= L.h ? '#' : L.rows[y][x]);
  const solid = (x, y) => SOLID_ART.has(at(x, y));
  const nb = { u: solid(cx, cy - 1), d: solid(cx, cy + 1), l: solid(cx - 1, cy), r: solid(cx + 1, cy), ul: solid(cx - 1, cy - 1), ur: solid(cx + 1, cy - 1) };
  paintSolid((x, y, c) => B.put(x, y, c), (x, y) => B.clear(x, y), th, cx, cy, nb, cracked);
  return B.done();
}

// Fully-enclosed rock tile, used to fill the view beyond a level's left/right edge
function buildWallTile(themeId) {
  const th = THEMES[themeId];
  const B = PixBuf(32, 32);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) B.put(x, y, shade(basePixel(th, x + 4096, y + 4096), -0.25));
  return B.done();
}

// Crumble block, moving platform and stalactite art per theme
function buildThemeProps(themeId) {
  const th = THEMES[themeId];
  const B = PixBuf(TS, TS);
  for (let y = 0; y < 14; y++) for (let x = 0; x < 16; x++) {
    let col = hash2(x >> 1, y >> 1, 91) < 0.18 ? shade(th.stone, -0.25) : th.stone;
    if (y === 0) col = shade(th.stone, 0.35);
    if (y === 13 || x === 0 || x === 15) col = shade(th.stone, -0.5);
    B.put(x, y, col);
  }
  for (const [x, y] of [[4, 2], [5, 3], [5, 4], [6, 5], [10, 6], [11, 7], [10, 8], [9, 9], [3, 9], [4, 10]]) B.put(x, y, shade(th.stone, -0.55));
  const crumble = B.done();

  const plat = PixBuf(32, 8);
  const pc = { wood: ['#f0c488', '#c88a4a', '#7a4a20'], stone: ['#b0a8cc', '#7a7296', '#3e3854'], metal: ['#d8e0f0', '#8a94ac', '#3c4458'], ice: ['#ffffff', '#a8dcff', '#4a88c0'] }[th.plank];
  for (let x = 0; x < 32; x++) {
    plat.put(x, 0, pc[0]); for (let y = 1; y < 5; y++) plat.put(x, y, pc[1]); plat.put(x, 5, pc[2]);
    if (x % 8 === 7) for (let y = 1; y < 5; y++) plat.put(x, y, pc[2]);
  }
  for (const x of [1, 2, 29, 30]) { plat.put(x, 2, '#ffd84a'); plat.put(x, 3, '#c98a1c'); }
  plat.rect(6, 6, 3, 2, pc[2]); plat.rect(23, 6, 3, 2, pc[2]);
  const platform = wrapSprite(plat.done());

  const stalPal = { A: th.stone, a: shade(th.stone, -0.4), h: shade(th.stone, 0.4) };
  const stal = makeSprite(SPRITE_ROWS.stalactite, themeId === 'ice' ? { A: '#b8e4ff', a: '#5aa0d8', h: '#ffffff' } : stalPal, '#141020', 'stal');
  return { crumble, platform, stal };
}

// ---------------------------------------------------------------------
//  Parallax backgrounds
// ---------------------------------------------------------------------
function periodicNoise(rng, n) {
  const pts = Array.from({ length: n }, () => rng());
  return (x) => {
    const xf = ((x % n) + n) % n;
    const i = Math.floor(xf), f = xf - i;
    const t = (1 - Math.cos(f * Math.PI)) / 2;
    return lerp(pts[i], pts[(i + 1) % n], t);
  };
}

function ridgeLayer(W, H, seed, o) {
  const rng = mulberry32(seed);
  const n1 = periodicNoise(rng, o.freq || 6), n2 = periodicNoise(rng, (o.freq || 6) * 3);
  const B = PixBuf(W, H);
  const hts = [];
  for (let x = 0; x < W; x++) {
    let v = n1((x / W) * (o.freq || 6)) * 0.7 + n2((x / W) * (o.freq || 6) * 3) * 0.3;
    if (o.sharp) v = Math.pow(v, 1.6);
    hts.push(Math.floor(o.base + v * o.amp));
  }
  // light comes from the left: faces that descend to the right are in shadow
  const shadowCol = [];
  // hysteresis keeps each face one solid region instead of flickering stripes
  let inShadow = false;
  for (let i = 0; i < W * 2; i++) {
    const x = i % W, d = hts[(x + 6) % W] - hts[(x - 6 + W) % W];
    if (inShadow && d > 0) inShadow = false;
    else if (!inShadow && d < -4) inShadow = true;
    if (i >= W) shadowCol[x] = inShadow;
  }
  for (let x = 0; x < W; x++) {
    const top = H - hts[x];
    const sh = shadowCol[x];
    const snowLine = o.base + o.amp * 0.5;
    for (let y = Math.max(0, top); y < H; y++) {
      let col = sh ? o.shadow || shade(o.color, -0.15) : o.color;
      if (o.snow && hts[x] > snowLine && y < top + Math.min(14, hts[x] - snowLine) + ((x * 7) % 3)) col = sh ? o.snowShadow : o.snow;
      if (y === top && o.rim) col = o.rim;
      B.put(x, y, col);
    }
  }
  return B.done();
}

function treeLayer(W, H, seed, o) {
  const rng = mulberry32(seed);
  const B = PixBuf(W, H);
  const groundH = o.ground || 8;
  B.rect(0, H - groundH, W, groundH, o.color);
  let x = 0;
  while (x < W) {
    const kind = o.kinds[Math.floor(rng() * o.kinds.length)];
    const th = o.minH + Math.floor(rng() * (o.maxH - o.minH));
    const base = H - groundH + 1;
    if (kind === 'pine') {
      const w = Math.floor(th * 0.45);
      for (let y = 0; y < th; y++) {
        const half = Math.floor(((y % Math.floor(th / 3 + 1)) + y * 0.35) * (w / th) + 1);
        for (let i = -half; i <= half; i++) B.put(((x + i) % W + W) % W, base - th + y, o.color);
      }
      if (o.snow) for (let i = -1; i <= 1; i++) B.put(x + i, base - th + 1, o.snow);
    } else if (kind === 'round') {
      B.rect(x - 1, base - th * 0.5, 3, th * 0.5, o.trunk || o.color);
      const r = Math.floor(th * 0.38);
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r) B.put(((x + dx) % W + W) % W, base - th + r + dy, o.color);
    } else if (kind === 'pillar') {
      const w = 10 + Math.floor(rng() * 6);
      B.rect(x, base - th, w, th, o.color);
      B.rect(x - 2, base - th, w + 4, 3, o.color);
      if (rng() < 0.5) B.rect(x - 2, base - th - 4 - Math.floor(rng() * 6), Math.floor(w / 2), 4, o.color);
      for (let y = base - th + 6; y < base; y += 6) B.rect(x + 2, y, 1, 3, shade(o.color, -0.2));
    } else if (kind === 'arch') {
      const w = 34;
      B.rect(x, base - th, 8, th, o.color); B.rect(x + w - 8, base - th, 8, th, o.color);
      for (let i = 0; i < w; i++) { const a = Math.sin((i / w) * Math.PI) * 10; B.rect(x + i, base - th - Math.floor(a), 1, 8, o.color); }
    } else if (kind === 'tower') {
      const w = 14 + Math.floor(rng() * 8);
      B.rect(x, base - th, w, th, o.color);
      for (let i = 0; i < w; i += 4) B.rect(x + i, base - th - 3, 2, 3, o.color);
      for (let y = base - th + 8; y < base - 6; y += 10) if (rng() < 0.6) B.rect(x + 3 + Math.floor(rng() * (w - 6)), y, 2, 3, o.window || '#ffd84a');
    } else if (kind === 'spire') {
      for (let y = 0; y < th; y++) { const half = Math.floor((y / th) * 6); B.rect(x - half, base - th + y, half * 2 + 1, 1, o.color); }
    } else if (kind === 'bush') {
      const r = Math.floor(th * 0.5);
      for (let dy = -r; dy <= 0; dy++) for (let dx = -r * 2; dx <= r * 2; dx++) if ((dx * dx) / 4 + dy * dy <= r * r) B.put(((x + dx) % W + W) % W, base + dy - 1, o.color);
    }
    x += o.gapMin + Math.floor(rng() * (o.gapMax - o.gapMin));
  }
  return B.done();
}

function caveLayer(W, H, seed, o) {
  const rng = mulberry32(seed);
  const B = PixBuf(W, H);
  const top = periodicNoise(rng, 10), bot = periodicNoise(rng, 8);
  for (let x = 0; x < W; x++) {
    const t = Math.floor(10 + top((x / W) * 10) * 30), b = Math.floor(14 + bot((x / W) * 8) * 34);
    for (let y = 0; y < t; y++) B.put(x, y, o.color);
    for (let y = H - b; y < H; y++) B.put(x, y, o.color);
  }
  for (let i = 0; i < 26; i++) {
    const x = Math.floor(rng() * W), len = 10 + Math.floor(rng() * 40), up = rng() < 0.5;
    for (let j = 0; j < len; j++) { const w = Math.max(1, Math.floor((1 - j / len) * 5)); B.rect(x - (w >> 1), up ? 30 + j : H - 40 - j, w, 1, o.color); }
  }
  if (o.glow) for (let i = 0; i < 30; i++) B.put(Math.floor(rng() * W), Math.floor(rng() * H), pick2(o.glow, rng()));
  return B.done();
}

function buildBackground(themeId) {
  const W = 512;
  const out = { layers: [], stars: false };
  const L = (c, f, yOff = 0, anchor = 'bottom') => out.layers.push({ c, f, yOff, anchor });
  switch (themeId) {
    case 'meadow':
      L(ridgeLayer(W, 170, 11, { base: 30, amp: 135, color: '#7a88d0', shadow: '#6672bc', snow: '#f4f8ff', snowShadow: '#c8d4f0', sharp: true, freq: 5 }), 0.06, 10);
      L(ridgeLayer(W, 90, 12, { base: 26, amp: 40, color: '#5aa860', shadow: '#4a9852', rim: '#7ac878', freq: 4 }), 0.2, 6);
      L(treeLayer(W, 70, 13, { color: '#2f7a40', trunk: '#2a5a30', kinds: ['round', 'round', 'pine', 'bush'], minH: 26, maxH: 54, gapMin: 18, gapMax: 46, ground: 10 }), 0.42, 4);
      break;
    case 'forest':
      L(ridgeLayer(W, 130, 21, { base: 40, amp: 70, color: '#2f5a5a', shadow: '#28504f', freq: 5 }), 0.06, 10);
      L(treeLayer(W, 130, 22, { color: '#1f4a3c', kinds: ['pine', 'pine', 'round'], minH: 60, maxH: 110, gapMin: 14, gapMax: 30, ground: 10 }), 0.22, 6);
      L(treeLayer(W, 150, 23, { color: '#12302a', trunk: '#12302a', kinds: ['pine', 'round', 'pine'], minH: 80, maxH: 140, gapMin: 30, gapMax: 70, ground: 12 }), 0.45, 4);
      break;
    case 'cave':
      L(caveLayer(W, 216, 31, { color: '#1a1528', glow: ['#5af0ff', '#c08aff', '#3a6a8a'] }), 0.15, 0, 'center');
      L(caveLayer(W, 216, 32, { color: '#120e1c' }), 0.35, 0, 'center');
      break;
    case 'magma':
      L(caveLayer(W, 216, 41, { color: '#2a0e10', glow: ['#ff7a1a', '#ffd25a'] }), 0.15, 0, 'center');
      L(caveLayer(W, 216, 42, { color: '#1a0708' }), 0.35, 0, 'center');
      break;
    case 'ruins':
      L(ridgeLayer(W, 140, 51, { base: 40, amp: 80, color: '#c0708a', shadow: '#a85e78', freq: 4 }), 0.06, 10);
      L(treeLayer(W, 110, 52, { color: '#a8705e', kinds: ['pillar', 'arch', 'pillar', 'pillar'], minH: 40, maxH: 90, gapMin: 30, gapMax: 70, ground: 12 }), 0.22, 6);
      L(treeLayer(W, 60, 53, { color: '#5a6a3a', kinds: ['bush', 'bush', 'round'], minH: 16, maxH: 40, gapMin: 20, gapMax: 50, ground: 8 }), 0.45, 4);
      break;
    case 'ice':
      L(ridgeLayer(W, 160, 61, { base: 60, amp: 95, color: '#9ab8e0', shadow: '#86a4cc', snow: '#ffffff', snowShadow: '#d4e4f8', sharp: true, freq: 4 }), 0.06, 10);
      L(ridgeLayer(W, 100, 62, { base: 30, amp: 50, color: '#d8e8f8', shadow: '#c0d4ec', freq: 5 }), 0.18, 6);
      L(treeLayer(W, 80, 63, { color: '#3a5a7a', snow: '#ffffff', kinds: ['pine', 'pine'], minH: 30, maxH: 64, gapMin: 16, gapMax: 40, ground: 8 }), 0.42, 4);
      break;
    case 'storm':
    case 'summit':
      out.stars = themeId === 'summit';
      L(ridgeLayer(W, 150, 71, { base: 40, amp: 100, color: '#252c48', shadow: '#1e243c', sharp: true, freq: 6 }), 0.06, 10);
      L(treeLayer(W, 130, 72, { color: '#181d32', window: '#ffd84a', kinds: ['tower', 'spire', 'tower'], minH: 50, maxH: 120, gapMin: 40, gapMax: 90, ground: 10 }), 0.22, 6);
      break;
  }
  return out;
}
