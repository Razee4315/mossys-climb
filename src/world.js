// =====================================================================
//  WORLD — level loading, collision, hazards, props, events, camera
// =====================================================================
const T = { EMPTY: 0, SOLID: 1, ONEWAY: 2, SPIKE_U: 3, SPIKE_D: 4, SPIKE_L: 5, SPIKE_R: 6, ICE: 7, LAVA: 8, COLLAPSE: 9 };
const SPIKE_BOX = { 3: [1, 8, 14, 8], 4: [1, 0, 14, 8], 5: [8, 1, 8, 14], 6: [0, 1, 8, 14] };
const ENEMY_CHARS = { B: 'beetle', N: 'spiny', Y: 'bat', Q: 'plant', W: 'wasp', U: 'waspV', G: 'slime', M: 'mimic', D: 'boss' };

let level = null;          // current level runtime
const fx = { particles: [], texts: [], weather: [], banners: [], shake: 0, hitstop: 0, flash: 0, flashCol: '#ffffff' };
const cam = { x: 0, y: 0, look: 0, lock: null, shakeX: 0, shakeY: 0, lookDown: 0 };

// ---------------------------------------------------------------------
//  Loading
// ---------------------------------------------------------------------
function parseLevel(idx) {
  const def = LEVELS[idx];
  const src = def.map;
  const h = src.length, w = src[0].length;
  src.forEach((r, i) => { if (r.length !== w) throw new Error(`Level ${idx + 1} row ${i} has width ${r.length}, expected ${w}`); });
  const L = {
    idx, def, theme: def.theme, w, h, rows: [], grid: new Uint8Array(w * h), grid0: null,
    spawn: null, checkpoints: [], finish: null, gems: [], hearts: [], signs: [], springs: [], platforms: [],
    crumbles: [], collapses: [], secrets: [], stals: [], crushers: [], enemySpawns: [], markers: {}, triggers: {},
    stops: new Set(), events: [], lava: null, lavaTiles: [], gates: [],
  };
  let signI = 0, gemI = 0;
  const collapseCells = [], secretCells = [];
  for (let ty = 0; ty < h; ty++) {
    let art = '';
    for (let tx = 0; tx < w; tx++) {
      const ch = src[ty][tx];
      const px = tx * TS, py = ty * TS;
      const set = (t) => (L.grid[ty * w + tx] = t);
      let a = '.';
      switch (ch) {
        case '#': set(T.SOLID); a = '#'; break;
        case 'I': set(T.ICE); a = 'I'; break;
        case '=': set(T.ONEWAY); a = '='; break;
        case '^': set(T.SPIKE_U); a = ch; break;
        case 'v': set(T.SPIKE_D); a = ch; break;
        case '<': set(T.SPIKE_L); a = ch; break;
        case '>': set(T.SPIKE_R); a = ch; break;
        case 'L': set(T.LAVA); L.lavaTiles.push({ tx, ty }); break;
        case 'X': set(T.COLLAPSE); a = 'X'; collapseCells.push([tx, ty]); break;
        case '%': a = '%'; secretCells.push([tx, ty]); break;
        case 'C': L.crumbles.push({ x: px, y: py, w: TS, h: TS, state: 'idle', t: 0 }); break;
        case 'P': L.spawn = { x: px + 3, y: py + TS - 14 }; break;
        case 'S': L.checkpoints.push({ x: px, y: py, active: false, idx: L.checkpoints.length }); break;
        case 'F': L.finish = { x: px, y: py, hops: 0, hop: null }; break;
        case '*': L.gems.push({ id: gemI++, x: px + 2, y: py + 3, got: false, bob: tx * 0.7 }); break;
        case '+': L.hearts.push({ x: px + 3, y: py + 4, got: false }); break;
        case '?': L.signs.push({ x: px, y: py }); break;
        case 'T': L.springs.push({ x: px, y: py, t: 0 }); break;
        case 'H': case 'V': L.platforms.push({ tx, ty, axis: ch === 'H' ? 'x' : 'y' }); break;
        case ':': L.stops.add(ty * w + tx); break;
        case 'K': L.crushers.push({ tx, ty }); break;
        case '!': L.stals.push({ x: px, y: py }); break;
        default:
          if (ENEMY_CHARS[ch]) {
            const sp = { type: ENEMY_CHARS[ch], tx, ty };
            if (ch === 'M') { sp.gemId = gemI++; L.gems.push({ id: sp.gemId, mimic: true, got: false }); } // mimics hold a gem
            L.enemySpawns.push(sp);
          } else if (ch >= '1' && ch <= '9') {
            (L.triggers[ch] = L.triggers[ch] || []).push({ x: px, y: py, w: TS, h: TS });
          } else if (ch >= 'a' && ch <= 'z') {
            (L.markers[ch] = L.markers[ch] || []).push({ tx, ty, x: px, y: py });
          } else if (ch !== '.') {
            throw new Error(`Level ${idx + 1}: unknown map char '${ch}' at ${tx},${ty}`);
          }
      }
      art += a;
    }
    L.rows.push(art);
  }
  if (!L.spawn) throw new Error(`Level ${idx + 1} has no P`);
  L.signs.sort((a, b) => (def.vertical ? b.y - a.y || a.x - b.x : a.x - b.x || a.y - b.y));
  L.signs.forEach((s) => (s.text = (def.signs || [])[signI++] || '...'));
  L.gemTotal = gemI;
  L.grid0 = L.grid.slice();
  // moving platform travel ranges
  L.platforms = L.platforms.map((p) => buildPlatform(L, p));
  // group collapse & secret cells into connected sets
  L.collapses = groupCells(collapseCells).map((cells) => ({ cells, state: 'idle', t: 0 }));
  L.secrets = groupCells(secretCells).map((cells) => ({ cells, alpha: 1, found: false, ...cellBounds(cells) }));
  L.crushers = L.crushers.map(({ tx, ty }) => ({ x: tx * TS, y: ty * TS, y0: ty * TS, w: 32, h: 32, state: 'idle', t: 0, vy: 0 }));
  L.stals = L.stals.map((s) => ({ ...s, x0: s.x, y0: s.y, state: 'idle', t: 0, vy: 0 }));
  L.events = (def.events || []).map((e) => ({ ...e, fired: false }));
  return L;
}

function groupCells(cells) {
  const key = (x, y) => x + ',' + y;
  const left = new Map(cells.map((c) => [key(c[0], c[1]), c]));
  const groups = [];
  for (const c of cells) {
    if (!left.has(key(c[0], c[1]))) continue;
    const g = [], stack = [c];
    left.delete(key(c[0], c[1]));
    while (stack.length) {
      const [x, y] = stack.pop(); g.push([x, y]);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const k = key(x + dx, y + dy);
        if (left.has(k)) { stack.push(left.get(k)); left.delete(k); }
      }
    }
    groups.push(g);
  }
  return groups;
}
function cellBounds(cells) {
  const xs = cells.map((c) => c[0]), ys = cells.map((c) => c[1]);
  const x0 = Math.min(...xs), y0 = Math.min(...ys);
  return { bx: x0 * TS, by: y0 * TS, bw: (Math.max(...xs) - x0 + 1) * TS, bh: (Math.max(...ys) - y0 + 1) * TS };
}

function buildPlatform(L, { tx, ty, axis }) {
  const blocked = (x, y) => x < 0 || y < 0 || x >= L.w || y >= L.h || L.stops.has(y * L.w + x) || isSolidT(L.grid[y * L.w + x]);
  let a, b;
  if (axis === 'x') {
    a = tx; while (!blocked(a - 1, ty)) a--;
    b = tx + 1; while (!blocked(b + 1, ty)) b++;
    return { axis, x: tx * TS, y: ty * TS, min: a * TS, max: (b + 1) * TS - 32, w: 32, h: 6, dir: 1, pause: 0, dx: 0, dy: 0, remX: 0, remY: 0, x0: tx * TS, y0: ty * TS };
  }
  a = ty; while (!blocked(tx, a - 1) && !blocked(tx + 1, a - 1)) a--;
  b = ty; while (!blocked(tx, b + 1) && !blocked(tx + 1, b + 1)) b++;
  return { axis, x: tx * TS, y: ty * TS, min: a * TS, max: b * TS + 10, w: 32, h: 6, dir: -1, pause: 0, dx: 0, dy: 0, remX: 0, remY: 0, x0: tx * TS, y0: ty * TS };
}

// Build everything needed to play a level (art included)
function startLevel(idx) {
  level = parseLevel(idx);
  const L = level;
  const art = buildLevelArt(L);
  L.art = art.canvas; L.lights = art.lights;
  L.props = buildThemeProps(L.theme);
  L.bg = buildBackground(L.theme);
  for (const c of L.collapses) c.tiles = c.cells.map(([x, y]) => buildTileCanvas(L, x, y, true));
  L.wallPattern = ctx.createPattern(buildWallTile(L.theme), 'repeat');
  for (const s of L.secrets) {
    const cv = newCanvas(s.bw, s.bh); const g = cv.getContext('2d');
    for (const [x, y] of s.cells) g.drawImage(buildTileCanvas(L, x, y, false), x * TS - s.bx, y * TS - s.by);
    s.canvas = cv;
  }
  L.time = 0; L.deaths = 0; L.kills = 0; L.secretsFound = 0;
  L.checkpoint = null;
  L.darkness = THEMES[L.theme].darkness; L.darkTarget = L.darkness;
  L.weather = { gusts: !!(L.def.weather && L.def.weather.gusts), lightning: !!(L.def.weather && L.def.weather.lightning), gustT: 4, boltT: 5, gust: null, bolts: [] };
  L.weather0 = { ...L.weather };
  L.rocks = []; L.boulders = []; L.popSpikes = [];
  L.bannerSeen = {};
  resetDynamic(true);
  return L;
}

// y of the first floor surface at or below world point (x, y)
function groundYAt(x, y) {
  const tx = Math.floor(x / TS);
  for (let ty = Math.max(0, Math.floor(y / TS)); ty < level.h; ty++) { const t = tileAt(tx, ty); if (isSolidT(t) || t === T.ONEWAY) return ty * TS; }
  return level.h * TS;
}
function isSolidT(t) { return t === T.SOLID || t === T.ICE || t === T.COLLAPSE; }
function tileAt(tx, ty) {
  if (tx < 0 || tx >= level.w || ty < 0) return T.SOLID;
  if (ty >= level.h) return T.EMPTY;
  return level.grid[ty * level.w + tx];
}

// Is the rectangle overlapping any solid (tiles + dynamic solids)?
function solidRect(x, y, w, h, ignore) {
  const tx0 = Math.floor(x / TS), tx1 = Math.floor((x + w - 1) / TS);
  const ty0 = Math.floor(y / TS), ty1 = Math.floor((y + h - 1) / TS);
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) if (isSolidT(tileAt(tx, ty))) return true;
  for (const c of level.crumbles) if (c.state !== 'gone' && rectHit(x, y, w, h, c.x, c.y, c.w, c.h)) return true;
  for (const k of level.crushers) if (k !== ignore && rectHit(x, y, w, h, k.x, k.y, k.w, k.h)) return true;
  for (const g of level.gates) if (g.closed && rectHit(x, y, w, h, g.x, g.y, TS, TS)) return true;
  return false;
}

// Is there a one-way surface exactly under the rect's bottom edge?
function onewayUnder(x, y, w, h) {
  const bottom = y + h;
  if (bottom % TS === 0) {
    const ty = bottom / TS;
    for (let tx = Math.floor(x / TS); tx <= Math.floor((x + w - 1) / TS); tx++) if (tileAt(tx, ty) === T.ONEWAY) return { kind: 'oneway' };
  }
  for (const p of level.platforms) if (p.y === bottom && x + w > p.x && x < p.x + p.w) return { kind: 'platform', plat: p };
  return null;
}

// Generic integer mover with sub-pixel remainders. Returns true when blocked.
function moveX(e, amt) {
  e.remX += amt;
  let move = Math.round(e.remX);
  if (!move) return false;
  e.remX -= move;
  const s = Math.sign(move);
  while (move) {
    if (!solidRect(e.x + s, e.y, e.w, e.h)) { e.x += s; move -= s; } else { e.remX = 0; return true; }
  }
  return false;
}
function moveY(e, amt, oneway = true) {
  e.remY += amt;
  let move = Math.round(e.remY);
  if (!move) return false;
  e.remY -= move;
  const s = Math.sign(move);
  while (move) {
    if (solidRect(e.x, e.y + s, e.w, e.h) || (s > 0 && oneway && !e.drop && onewayUnder(e.x, e.y, e.w, e.h))) { e.remY = 0; return true; }
    e.y += s; move -= s;
  }
  return false;
}
function groundUnder(e) {
  if (solidRect(e.x, e.y + 1, e.w, e.h)) {
    // what are we standing on?
    const ty = Math.floor((e.y + e.h) / TS);
    let kind = 'solid';
    for (let tx = Math.floor(e.x / TS); tx <= Math.floor((e.x + e.w - 1) / TS); tx++) {
      const t = tileAt(tx, ty);
      if (t === T.ICE) kind = 'ice';
      if (t === T.COLLAPSE) { kind = 'collapse'; break; }
      if (t === T.SOLID) { kind = 'solid'; break; }
    }
    for (const c of level.crumbles) if (c.state !== 'gone' && rectHit(e.x, e.y + 1, e.w, e.h, c.x, c.y, c.w, c.h)) { kind = 'crumble'; c.touched = true; }
    for (const k of level.crushers) if (rectHit(e.x, e.y + 1, e.w, e.h, k.x, k.y, k.w, k.h) && e.y + e.h <= k.y) return { kind: 'crusher', crusher: k };
    return { kind };
  }
  if (!e.drop) return onewayUnder(e.x, e.y, e.w, e.h);
  return null;
}

// Hazard tile overlap: returns 'spike' | 'lava' | null
function hazardAt(x, y, w, h) {
  const tx0 = Math.floor(x / TS), tx1 = Math.floor((x + w - 1) / TS);
  const ty0 = Math.floor(y / TS), ty1 = Math.floor((y + h - 1) / TS);
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    const t = tileAt(tx, ty);
    if (SPIKE_BOX[t]) {
      const b = SPIKE_BOX[t];
      if (rectHit(x, y, w, h, tx * TS + b[0], ty * TS + b[1], b[2], b[3])) return 'spike';
    } else if (t === T.LAVA) {
      if (rectHit(x, y, w, h, tx * TS, ty * TS + 5, TS, 11)) return 'lava';
    }
  }
  return null;
}

// ---------------------------------------------------------------------
//  Reset of everything that respawns when the player dies
// ---------------------------------------------------------------------
function resetDynamic(first = false) {
  const L = level;
  L.grid.set(L.grid0);
  for (const c of L.crumbles) { c.state = 'idle'; c.t = 0; c.touched = false; }
  for (const c of L.collapses) { c.state = 'idle'; c.t = 0; }
  for (const p of L.platforms) { p.x = p.x0; p.y = p.y0; p.dir = p.axis === 'x' ? 1 : -1; p.pause = 0; p.remX = p.remY = 0; }
  for (const k of L.crushers) { k.y = k.y0; k.state = 'idle'; k.t = 0; k.vy = 0; }
  for (const s of L.stals) { s.x = s.x0; s.y = s.y0; s.state = 'idle'; s.t = 0; s.vy = 0; }
  for (const g of L.gates) g.closed = false;
  L.rocks = []; L.boulders = []; L.popSpikes = []; L.projectiles = [];
  L.weather = { ...L.weather0, gust: null, bolts: [] };
  L.darkTarget = THEMES[L.theme].darkness;
  cam.lock = null; L.arena = null;
  for (const e of L.events) if (!e.persist) e.fired = false;
  // rising lava: restore (and resume if the checkpoint was taken mid-chase)
  const rise = L.events.find((e) => e.type === 'rise');
  if (rise) {
    const startY = L.h * TS + 8;
    L.lava = { y: startY, active: false, pause: 0, speed: rise.speed || 22, stopY: rise.stopRow != null ? rise.stopRow * TS : -9999 };
    if (!first && L.checkpoint && L.checkpoint.midRise) {
      L.lava.active = true; rise.fired = true;
      L.lava.y = Math.min(startY, L.checkpoint.y + TS * 7);
      L.lava.pause = 1.6;
    }
  } else L.lava = null;
  spawnEnemies();
}

// ---------------------------------------------------------------------
//  Dynamic props
// ---------------------------------------------------------------------
function updatePlatforms(dt) {
  for (const p of level.platforms) {
    const ox = p.x, oy = p.y;
    if (p.pause > 0) { p.pause -= dt; p.dx = p.dy = 0; continue; }
    const speed = 42;
    if (p.axis === 'x') {
      p.remX += p.dir * speed * dt;
      const m = Math.round(p.remX); p.remX -= m; p.x += m;
      if (p.x <= p.min) { p.x = p.min; p.dir = 1; p.pause = 0.5; }
      if (p.x >= p.max) { p.x = p.max; p.dir = -1; p.pause = 0.5; }
    } else {
      p.remY += p.dir * speed * dt;
      const m = Math.round(p.remY); p.remY -= m; p.y += m;
      if (p.y <= p.min) { p.y = p.min; p.dir = 1; p.pause = 0.5; }
      if (p.y >= p.max) { p.y = p.max; p.dir = -1; p.pause = 0.5; }
    }
    p.dx = p.x - ox; p.dy = p.y - oy;
  }
}

function updateCrumbles(dt) {
  for (const c of level.crumbles) {
    if (c.state === 'idle' && c.touched) { c.state = 'shake'; c.t = 0.45; Sound.sfx('crumble'); }
    c.touched = false;
    if (c.state === 'shake') {
      c.t -= dt;
      if (c.t <= 0) {
        c.state = 'gone'; c.t = 2.6;
        burst(c.x + 8, c.y + 8, THEMES[level.theme].stone, 10, 60);
      }
    } else if (c.state === 'gone') {
      c.t -= dt;
      if (c.t <= 0 && !rectHit(player.x, player.y, player.w, player.h, c.x, c.y, c.w, c.h)) {
        c.state = 'idle';
        burst(c.x + 8, c.y + 8, '#ffffff', 5, 25);
      }
    }
  }
}

function triggerCollapse(group) {
  if (group.state !== 'idle') return;
  group.state = 'shake'; group.t = 0.38;
  Sound.sfx('crack');
  addShake(1.5);
}
function updateCollapses(dt) {
  for (const g of level.collapses) {
    if (g.state !== 'shake') continue;
    g.t -= dt;
    if (g.t <= 0) {
      g.state = 'gone';
      Sound.sfx('collapse'); addShake(4);
      g.cells.forEach(([x, y], i) => {
        level.grid[y * level.w + x] = T.EMPTY;
        level.rocks.push({ kind: 'debris', img: g.tiles[i], x: x * TS, y: y * TS, vx: rand(-20, 20), vy: rand(-40, 0), w: TS, h: TS, life: 1.4, rot: 0, vr: rand(-3, 3) });
        burst(x * TS + 8, y * TS + 8, THEMES[level.theme].base, 4, 50);
      });
    }
  }
}

function updateSprings(dt) {
  for (const s of level.springs) if (s.t > 0) s.t -= dt;
}

function updateCrushers(dt) {
  for (const k of level.crushers) {
    const px = player.x + player.w / 2;
    if (k.state === 'idle') {
      if (!player.dead && px > k.x - 6 && px < k.x + k.w + 6 && player.y > k.y && player.y < k.y + 13 * TS) {
        // only slam if nothing solid is between the crusher and the player
        let clear = true;
        for (let y = k.y + k.h; y < player.y; y += TS) if (solidRect(k.x + 4, y, k.w - 8, 4, k)) { clear = false; break; }
        if (clear) { k.state = 'warn'; k.t = 0.4; Sound.sfx('warn'); }
      }
    } else if (k.state === 'warn') {
      k.t -= dt; if (k.t <= 0) { k.state = 'fall'; k.vy = 60; }
    } else if (k.state === 'fall') {
      k.vy = Math.min(k.vy + 1400 * dt, 480);
      const steps = Math.round(k.vy * dt);
      for (let i = 0; i < steps; i++) {
        if (solidRect(k.x, k.y + 1, k.w, k.h, k)) { k.state = 'land'; k.t = 0.9; addShake(5); Sound.sfx('slam'); burst(k.x + 16, k.y + 32, '#c8c0d8', 14, 80); break; }
        k.y += 1;
        if (!player.dead && rectHit(player.x, player.y, player.w, player.h, k.x + 2, k.y + k.h - 6, k.w - 4, 6) && player.y + player.h > k.y + k.h - 2) {
          if (solidRect(player.x, player.y + 1, player.w, player.h, k)) { killPlayer('crush'); }
          else player.y += 1;
        }
      }
      for (const e of enemies) if (e.alive && rectHit(e.x, e.y, e.w, e.h, k.x, k.y, k.w, k.h)) killEnemy(e, 'crush');
    } else if (k.state === 'land') {
      k.t -= dt; if (k.t <= 0) k.state = 'rise';
    } else if (k.state === 'rise') {
      const riding = !player.dead && player.y + player.h === k.y && player.x + player.w > k.x && player.x < k.x + k.w;
      const dy = Math.min(1, k.y - k.y0);
      if (dy > 0 && Math.random() < 0.6) {
        k.y -= dy;
        if (riding) moveY(player, -dy, false);
      }
      if (k.y <= k.y0) { k.y = k.y0; k.state = 'idle'; }
    }
  }
}

function updateStals(dt) {
  for (const s of level.stals) {
    if (s.state === 'idle') {
      const px = player.x + player.w / 2;
      if (!player.dead && Math.abs(px - (s.x + 8)) < 22 && player.y > s.y && player.y - s.y < 10 * TS) { s.state = 'shake'; s.t = 0.45; Sound.sfx('crack'); }
    } else if (s.state === 'shake') {
      s.t -= dt; if (s.t <= 0) { s.state = 'fall'; s.vy = 0; }
    } else if (s.state === 'fall') {
      s.vy = Math.min(s.vy + 900 * dt, 360);
      s.y += s.vy * dt;
      if (solidRect(s.x + 4, s.y + 4, 8, 10)) { s.state = 'gone'; burst(s.x + 8, s.y + 12, THEMES[level.theme].stone, 10, 70); Sound.sfx('crack'); }
      else if (!player.dead && rectHit(player.x, player.y, player.w, player.h, s.x + 4, s.y + 2, 8, 12)) { hurtPlayer(s.x + 8); s.state = 'gone'; burst(s.x + 8, s.y + 12, THEMES[level.theme].stone, 10, 70); }
      if (s.y > level.h * TS) s.state = 'gone';
    }
  }
}

// falling rocks (events), debris from collapses, boulders
function spawnRock(x, y, delay = 0.6) {
  level.rocks.push({ kind: 'rock', x: x - 6, y, w: 12, h: 10, vx: 0, vy: 0, warn: delay, life: 6 });
}
function updateRocks(dt) {
  const R = level.rocks;
  for (let i = R.length - 1; i >= 0; i--) {
    const r = R[i];
    if (r.kind === 'debris') {
      r.vy += 700 * dt; r.x += r.vx * dt; r.y += r.vy * dt; r.rot += r.vr * dt; r.life -= dt;
      if (r.life <= 0) R.splice(i, 1);
      continue;
    }
    if (r.warn > 0) {
      r.warn -= dt;
      if (Math.random() < 0.4) addParticle(r.x + rand(0, 12), r.y + rand(-2, 4), { vy: rand(20, 60), col: '#b8b0c4', life: 0.4, g: 200 });
      continue;
    }
    r.vy = Math.min(r.vy + 800 * dt, 380);
    r.y += r.vy * dt; r.life -= dt;
    if (solidRect(r.x + 2, r.y + 2, r.w - 4, r.h - 2) || r.life <= 0 || r.y > level.h * TS) {
      burst(r.x + 6, r.y + 8, THEMES[level.theme].stone, 8, 60); Sound.sfx('crack');
      R.splice(i, 1); continue;
    }
    if (!player.dead && rectHit(player.x, player.y, player.w, player.h, r.x + 1, r.y + 1, r.w - 2, r.h - 2)) {
      hurtPlayer(r.x + 6);
      burst(r.x + 6, r.y + 8, THEMES[level.theme].stone, 8, 60);
      R.splice(i, 1);
    }
  }
}

function spawnBoulder(x, y, dir, snow) {
  level.boulders.push({ x, y, w: 28, h: 28, remX: 0, remY: 0, vx: 0, vy: 0, dir, rot: 0, snow, wait: 0.75 });
  Sound.sfx('rumble'); addShake(3);
}
function updateBoulders(dt) {
  const B = level.boulders;
  for (let i = B.length - 1; i >= 0; i--) {
    const b = B[i];
    if (b.wait > 0) { b.wait -= dt; addShake(0.6); continue; }
    b.vx = approach(b.vx, b.dir * 94, 150 * dt);
    b.vy = Math.min(b.vy + 900 * dt, 400);
    const hitX = moveX(b, b.vx * dt);
    const hitY = moveY(b, b.vy * dt, true);
    if (hitY) { if (b.vy > 150) { addShake(2.5); Sound.sfx('land'); } b.vy = 0; }
    b.rot += (b.vx * dt) / 14;
    if (Math.random() < 0.3 && hitY) addParticle(b.x + 14 - b.dir * 12, b.y + 28, { vx: -b.dir * rand(10, 40), vy: rand(-30, -5), col: b.snow ? '#ffffff' : '#a89a8a', life: 0.5 });
    for (const e of enemies) if (e.alive && boxHit(e, b)) killEnemy(e, 'crush');
    if (!player.dead && rectHit(player.x, player.y, player.w, player.h, b.x + 3, b.y + 3, 22, 22)) killPlayer('boulder');
    if (hitX || b.y > level.h * TS + 40) {
      burst(b.x + 14, b.y + 14, b.snow ? '#ffffff' : '#a89a8a', 30, 120);
      burst(b.x + 14, b.y + 14, b.snow ? '#cfe4ff' : '#6a5e6e', 20, 90);
      addShake(6); Sound.sfx('explode');
      B.splice(i, 1);
    }
  }
}

function updateLava(dt) {
  const lv = level.lava;
  if (!lv || !lv.active) return;
  if (lv.pause > 0) { lv.pause -= dt; return; }
  const gap = lv.y - (player.y + player.h);
  let sp = lv.speed;
  if (gap > TS * 9) sp *= 2.6; else if (gap < TS * 3) sp *= 0.7;
  if (Save.data.settings.assist) sp *= 0.6;
  lv.y = Math.max(lv.stopY, lv.y - sp * dt);
  if (Math.random() < 0.3) addParticle(cam.x + rand(0, VW), lv.y - 2, { vy: rand(-60, -20), vx: rand(-10, 10), col: pick(['#ff7a1a', '#ffd25a']), life: 0.8, g: 40 });
  if (!player.dead && player.y + player.h > lv.y + 4) killPlayer('lava');
  for (const e of enemies) if (e.alive && e.y + e.h > lv.y + 4) killEnemy(e, 'lava');
}

// ---------------------------------------------------------------------
//  Weather surprises: gusts of wind and lightning strikes
// ---------------------------------------------------------------------
function updateWeather(dt) {
  const W = level.weather;
  if (W.gusts) {
    if (W.gust) {
      W.gust.t -= dt;
      if (W.gust.t < 1.6 && W.gust.t > 0) { W.gust.active = true; }
      if (W.gust.t <= 0) { W.gust = null; W.gustT = rand(5, 9); }
    } else {
      W.gustT -= dt;
      if (W.gustT <= 0) {
        const dir = Math.random() < 0.5 ? -1 : 1;
        W.gust = { dir, t: 2.4, active: false };
        banner(dir > 0 ? 'GUST  ▶▶' : '◀◀  GUST', '#bfe4ff', 1.2);
        Sound.sfx('gust');
      }
    }
  }
  {
    W.boltT -= dt;
    if (W.lightning && W.boltT <= 0 && !player.dead) {
      W.boltT = rand(2.6, 4.2);
      // strike near (sometimes right on) the player, telegraphed for 0.9s
      const bx = clamp(player.x + player.w / 2 + pick([-48, -24, 0, 0, 24, 48]) + rand(-6, 6), 8, level.w * TS - 8);
      W.bolts.push({ x: bx, ground: groundYAt(bx, player.y), t: 0.9, strike: 0 });
    }
    for (let i = W.bolts.length - 1; i >= 0; i--) {
      const b = W.bolts[i];
      if (b.t > 0) {
        b.t -= dt;
        if (Math.floor(b.t * 10) !== Math.floor((b.t + dt) * 10)) Sound.sfx('zap');
        if (b.t <= 0) {
          b.strike = 0.25; Sound.sfx('thunder'); addShake(4); fx.flash = 0.35; fx.flashCol = '#e8f0ff';
          burst(b.x, b.ground, '#ffffaa', 18, 110);
          if (!player.dead && Math.abs(player.x + player.w / 2 - b.x) < 10 && player.y < b.ground) hurtPlayer(b.x);
          for (const e of enemies) if (e.alive && Math.abs(e.x + e.w / 2 - b.x) < 10 && e.y < b.ground) killEnemy(e, 'zap');
        }
      } else {
        b.strike -= dt;
        if (b.strike <= 0) W.bolts.splice(i, 1);
      }
    }
  }
}

// ---------------------------------------------------------------------
//  Scripted "unexpected" events
// ---------------------------------------------------------------------
function updateEvents(dt) {
  const L = level;
  for (const ev of L.events) {
    if (ev.fired && ev.type !== 'flagRun') { if (ev.update) ev.update(dt); continue; }
    if (ev.type === 'flagRun') { updateFlagRun(ev); continue; }
    const zone = L.triggers[ev.trigger];
    if (!zone || player.dead) continue;
    if (zone.some((r) => rectHit(player.x, player.y, player.w, player.h, r.x, r.y, r.w, r.h))) fireEvent(ev);
  }
  // quakes keep dropping rocks for a while
  for (const ev of L.events) {
    if (ev.type !== 'quake' || !ev.fired || !(ev.left > 0)) continue;
    ev.left -= dt; ev.tick -= dt; addShake(1.2);
    if (ev.tick <= 0) {
      ev.tick = ev.every || 0.5;
      const tx = Math.floor((player.x + player.vx * 0.5) / TS) + randi(-6, 6);
      let ty = Math.floor(player.y / TS);
      while (ty > 0 && !isSolidT(tileAt(tx, ty - 1)) && player.y - ty * TS < VH * 0.7) ty--;
      if (!isSolidT(tileAt(tx, ty))) spawnRock(tx * TS + 8, ty * TS + 2, 0.7);
    }
  }
}

function fireEvent(ev) {
  const L = level;
  ev.fired = true;
  if (ev.msg) banner(ev.msg, ev.col || '#ffd84a', ev.msgTime || 1.8);
  const marks = (m) => L.markers[m] || [];
  switch (ev.type) {
    case 'rockfall':
      Sound.sfx('rumble'); addShake(2);
      marks(ev.marker).forEach((m, i) => spawnRock(m.x + 8, m.y + 2, (ev.delay || 0.55) + i * (ev.stagger || 0.12)));
      break;
    case 'ambush':
      Sound.sfx('alarm');
      marks(ev.marker).forEach((m, i) => {
        const e = makeEnemy(ev.enemy || 'beetle', m.tx, m.ty);
        e.dropIn = 0.6 + i * 0.15; e.ambush = true;
        enemies.push(e);
      });
      break;
    case 'quake':
      Sound.sfx('rumble'); ev.left = ev.duration || 5; ev.tick = 0.3;
      break;
    case 'rise':
      if (L.lava && !L.lava.active) { L.lava.active = true; L.lava.pause = ev.pause != null ? ev.pause : 0.8; Sound.sfx('lavaRise'); addShake(3); }
      break;
    case 'boulder':
      marks(ev.marker).forEach((m) => spawnBoulder(m.x, m.y, ev.dir || 1, !!ev.snow));
      break;
    case 'dark':
      L.darkTarget = ev.level != null ? ev.level : 0.94;
      if (ev.level === 0 || ev.restore) L.darkTarget = THEMES[L.theme].darkness;
      Sound.sfx(ev.restore ? 'select' : 'collapse');
      break;
    case 'spikes':
      Sound.sfx('warn');
      marks(ev.marker).forEach((m) => L.popSpikes.push({ tx: m.tx, ty: m.ty, t: ev.delay || 0.45, up: 0 }));
      break;
    case 'weather':
      if (ev.gusts != null) { L.weather.gusts = ev.gusts; L.weather.gustT = 1.5; }
      if (ev.lightning != null) { L.weather.lightning = ev.lightning; L.weather.boltT = 1.2; }
      break;
    case 'arena': {
      const a = marks(ev.from || 'q')[0], b = marks(ev.to || 'p')[0];
      const aw = b.x + TS - a.x, ah = b.y + TS - a.y;
      L.arena = { x: a.x, y: a.y, w: aw, h: ah };
      // camera frames the arena, centred if the screen is wider than it
      cam.lock = { x: a.x - Math.max(0, VW - aw) / 2, y: a.y, w: Math.max(VW, aw), h: Math.max(VH, ah) };
      L.gates = marks(ev.gate || 'g').map((m) => ({ x: m.x, y: m.y, closed: true }));
      Sound.sfx('slam'); addShake(4);
      Sound.Music.play('boss');
      const boss = enemies.find((e) => e.type === 'boss');
      if (boss) boss.awake = true;
      break;
    }
    case 'message':
      break;
  }
}

function updateFlagRun(ev) {
  const F = level.finish;
  if (!F) return;
  if (F.hop) return;
  const hops = ev.markers || [];
  if (F.hops >= hops.length) return;
  const d = Math.abs(player.x + 5 - (F.x + 8)) + Math.abs(player.y - F.y);
  if (d < 46 && !player.dead) {
    const m = (level.markers[hops[F.hops]] || [])[0];
    if (!m) return;
    F.hop = { sx: F.x, sy: F.y, tx: m.x, ty: m.y, t: 0, dur: 0.9 + Math.min(1.2, Math.hypot(m.x - F.x, m.y - F.y) / 200) };
    F.hops++;
    Sound.sfx('nope');
    floatText(F.x + 8, F.y - 18, pick(ev.lines || ['NOPE!', 'NOT YET!', 'CATCH ME!']), '#ffd84a');
  }
}
function updateFinishHop(dt) {
  const F = level.finish;
  if (!F || !F.hop) return;
  const h = F.hop;
  h.t += dt / h.dur;
  const t = Math.min(1, h.t);
  F.x = lerp(h.sx, h.tx, easeInOut(t));
  F.y = lerp(h.sy, h.ty, t) - Math.sin(t * Math.PI) * (40 + Math.abs(h.ty - h.sy) * 0.4);
  if (Math.random() < 0.5) addParticle(F.x + 8, F.y + 14, { col: '#ffd84a', life: 0.5, vy: rand(-10, 10), vx: rand(-10, 10) });
  if (t >= 1) { F.x = h.tx; F.y = h.ty; F.hop = null; burst(F.x + 8, F.y + 14, '#ffd84a', 12, 60); Sound.sfx('land'); }
}

function updatePopSpikes(dt) {
  for (const s of level.popSpikes) {
    if (s.t > 0) {
      s.t -= dt;
      if (Math.random() < 0.3) addParticle(s.tx * TS + rand(2, 14), s.ty * TS + 14, { col: '#ffffff', life: 0.25, vy: -20 });
      if (s.t <= 0) { level.grid[s.ty * level.w + s.tx] = T.SPIKE_U; Sound.sfx('crack'); }
    } else s.up = Math.min(1, s.up + dt * 8);
  }
}

function updateSecrets(dt) {
  for (const s of level.secrets) {
    const inside = rectHit(player.x, player.y, player.w, player.h, s.bx, s.by, s.bw, s.bh) && s.cells.some(([x, y]) => rectHit(player.x, player.y, player.w, player.h, x * TS, y * TS, TS, TS));
    s.alpha = approach(s.alpha, inside ? 0.18 : 1, dt * 4);
    if (inside && !s.found) {
      s.found = true; level.secretsFound++;
      Sound.sfx('secret'); floatText(player.x + 5, player.y - 10, 'SECRET!', '#ffd84a');
    }
  }
}

// ---------------------------------------------------------------------
//  Particles, floating text, banners, screen shake
// ---------------------------------------------------------------------
function addParticle(x, y, o = {}) {
  if (fx.particles.length > 700) return;
  fx.particles.push({ x, y, vx: o.vx || 0, vy: o.vy || 0, g: o.g != null ? o.g : 300, life: o.life || 0.5, max: o.life || 0.5, col: o.col || '#ffffff', size: o.size || 1, drag: o.drag || 0, glow: !!o.glow });
}
function burst(x, y, col, n = 10, speed = 60, o = {}) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random() * 0.7);
    addParticle(x, y, { vx: Math.cos(a) * s, vy: Math.sin(a) * s - speed * 0.3, col, life: 0.3 + Math.random() * 0.4, size: Math.random() < 0.4 ? 2 : 1, ...o });
  }
}
function dust(x, y, n = 4, col = '#e8e0d0') {
  for (let i = 0; i < n; i++) addParticle(x + rand(-3, 3), y - 1, { vx: rand(-30, 30), vy: rand(-25, -5), g: 20, col, life: rand(0.25, 0.45), drag: 3 });
}
function floatText(x, y, text, col = '#ffffff') { fx.texts.push({ x, y, text, col, t: 1.1 }); }
function banner(text, col = '#ffd84a', time = 1.8) {
  fx.banners = fx.banners.filter((b) => b.text !== text);
  fx.banners.push({ text, col, t: time, max: time });
}
function addShake(a) { if (Save.data.settings.shake) fx.shake = Math.max(fx.shake, a); }

function updateFx(dt) {
  const P = fx.particles;
  for (let i = P.length - 1; i >= 0; i--) {
    const p = P[i];
    p.vy += p.g * dt;
    if (p.drag) { p.vx *= 1 - p.drag * dt; p.vy *= 1 - p.drag * dt; }
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.life -= dt;
    if (p.life <= 0) P.splice(i, 1);
  }
  for (let i = fx.texts.length - 1; i >= 0; i--) { const t = fx.texts[i]; t.t -= dt; t.y -= 18 * dt; if (t.t <= 0) fx.texts.splice(i, 1); }
  for (let i = fx.banners.length - 1; i >= 0; i--) { const b = fx.banners[i]; b.t -= dt; if (b.t <= 0) fx.banners.splice(i, 1); }
  fx.shake = Math.max(0, fx.shake - dt * 14);
  fx.flash = Math.max(0, fx.flash - dt * 2.5);
}

// ---------------------------------------------------------------------
//  Camera
// ---------------------------------------------------------------------
function camBounds() {
  const L = level;
  if (cam.lock) return { x0: cam.lock.x, y0: cam.lock.y, x1: cam.lock.x + cam.lock.w - VW, y1: cam.lock.y + cam.lock.h - VH };
  return { x0: 0, y0: 0, x1: L.w * TS - VW, y1: L.h * TS - VH };
}
function updateCamera(dt, snap = false) {
  const p = player;
  const speed = Math.abs(p.vx);
  const lookTarget = p.facing * (speed > 40 ? 40 : 22);
  cam.look = approach(cam.look, lookTarget, 90 * dt);
  // look down when holding down on the ground
  if (p.onGround && Input.held.down && !p.dead) cam.lookDown = Math.min(1, cam.lookDown + dt * 1.5); else cam.lookDown = Math.max(0, cam.lookDown - dt * 4);
  let tx = p.x + p.w / 2 - VW / 2 + cam.look;
  let ty = p.y + p.h / 2 - VH / 2 - 12 + cam.lookDown * 56;
  if (p.vy > 200) ty += 30;
  const b = camBounds();
  tx = b.x1 < b.x0 ? (b.x0 + b.x1) / 2 : clamp(tx, b.x0, b.x1);
  ty = b.y1 < b.y0 ? (b.y0 + b.y1) / 2 : clamp(ty, b.y0, b.y1);
  if (snap) { cam.x = tx; cam.y = ty; return; }
  cam.x += (tx - cam.x) * Math.min(1, 7 * dt);
  const vyRate = p.vy > 150 ? 10 : 5;
  cam.y += (ty - cam.y) * Math.min(1, vyRate * dt);
  cam.x = b.x1 < b.x0 ? cam.x : clamp(cam.x, b.x0, b.x1);
  cam.y = b.y1 < b.y0 ? cam.y : clamp(cam.y, b.y0, b.y1);
  const s = fx.shake;
  cam.shakeX = s ? rand(-s, s) : 0; cam.shakeY = s ? rand(-s, s) : 0;
}
