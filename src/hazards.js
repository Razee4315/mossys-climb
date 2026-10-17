// =====================================================================
//  HAZARDS — saws, fire bars, cannons, conveyors, beat blocks, puff
//  clouds, updrafts, bomb blasts and the big chasing saw wall
// =====================================================================
const BEAT_PERIOD = 2.2;       // seconds each beat-block colour stays solid
const CONVEYOR_V = 46;         // px/s a belt carries whatever stands on it
const DRAFT_LIFT = 230;        // max rise speed inside an updraft

function setupHazards(L) {
  const blocked = (x, y) => x < 0 || y < 0 || x >= L.w || y >= L.h || L.stops.has(y * L.w + x) || isSolidT(L.grid[y * L.w + x]);
  for (const s of L.saws) {
    s.x0 = s.x; s.y0 = s.y;
    if (!s.axis) continue;
    let a, b;
    if (s.axis === 'x') { a = s.tx; while (!blocked(a - 1, s.ty)) a--; b = s.tx; while (!blocked(b + 1, s.ty)) b++; s.min = a * TS + 8; s.max = b * TS + 8; }
    else { a = s.ty; while (!blocked(s.tx, a - 1)) a--; b = s.ty; while (!blocked(s.tx, b + 1)) b++; s.min = a * TS + 8; s.max = b * TS + 8; }
  }
  for (const c of L.cannons) c.t0 = 1 + hash2(c.tx, c.ty, 5) * 1.5;
}

function resetHazards(L) {
  for (const s of L.saws) { s.x = s.x0; s.y = s.y0; s.dir = 1; s.pause = 0; }
  for (const c of L.cannons) { c.t = c.t0; c.warn = 0; c.face = 1; }
  for (const p of L.puffs) { p.state = 'idle'; p.t = 0; }
  L.beatT = 0; L.beatOn = 0; L.beatWarn = false; L.beatPending = [];
  L.chaser = null;
  for (const b of L.beats) b.solid = b.group === 0;
}

// ---------------------------------------------------------------------
function updateHazards(dt) {
  const L = level, t = L.time;
  // moving saws
  for (const s of L.saws) {
    if (!s.axis) continue;
    if (s.pause > 0) { s.pause -= dt; continue; }
    const k = s.axis === 'x' ? 'x' : 'y';
    s[k] += s.dir * (s.speed || 64) * dt;
    if (s[k] >= s.max) { s[k] = s.max; s.dir = -1; s.pause = 0.25; }
    if (s[k] <= s.min) { s[k] = s.min; s.dir = 1; s.pause = 0.25; }
    if (Math.random() < 0.25 && onScreen(s.x, s.y, 20)) addParticle(s.x + rand(-4, 4), s.y + 9, { vx: rand(-40, 40), vy: rand(-60, -20), col: pick(['#ffd84a', '#ffffff']), life: 0.25, g: 300 });
  }
  // cannons wake up when you are on their row, telegraph, then fire
  for (const c of L.cannons) {
    const px = player.x + 5, py = player.y + 7, cx = c.x + 8, cy = c.y + 8;
    c.face = px < cx ? -1 : 1;
    const near = !player.dead && Math.abs(px - cx) < 250 && Math.abs(py - cy) < 64;
    if (!near) { c.t = Math.max(c.t, 0.9); c.warn = 0; continue; }
    c.t -= dt;
    c.warn = c.t < 0.5 ? 1 : 0;
    if (c.warn && Math.random() < 0.5) addParticle(cx + c.face * 9, cy - 2 + rand(-2, 2), { col: '#c8c0d8', vy: rand(-30, -10), vx: c.face * rand(5, 20), life: 0.4, g: -20 });
    if (c.t <= 0) {
      c.t = c.rate || 2.6;
      if (!solidRect(cx + c.face * 14 - 5, cy - 5, 10, 10)) {
        L.projectiles.push({ kind: 'ball', x: cx + c.face * 14 - 5, y: cy - 5, w: 10, h: 10, vx: c.face * 96, vy: 0, g: 0, life: 4.5, stomp: true });
        Sound.sfx('cannon'); addShake(1.5);
        burst(cx + c.face * 10, cy, '#e8e0d0', 8, 50);
      }
    }
  }
  // beat blocks: the two colours trade places to a steady tick
  if (L.beats.length) {
    L.beatT += dt;
    const phase = Math.floor(L.beatT / BEAT_PERIOD) % 2;
    const into = (L.beatT % BEAT_PERIOD) / BEAT_PERIOD;
    const tick = Math.floor(into * 8);
    L.beatWarn = into > 0.62;
    if (L.beatWarn && tick !== L.beatTick && onScreenAnyBeat()) Sound.sfx('tick');
    L.beatTick = tick;
    if (phase !== L.beatOn) {
      L.beatOn = phase;
      if (onScreenAnyBeat()) Sound.sfx('beat');
      for (const b of L.beats) b.solid = b.group === phase;
    }
    for (const b of L.beats) {
      const i = b.ty * L.w + b.tx;
      if (!b.solid) { L.grid[i] = T.EMPTY; continue; }
      // a block never materialises inside the player: it waits until you step out
      if (L.grid[i] !== T.BEAT && rectHit(player.x, player.y, player.w, player.h, b.tx * TS, b.ty * TS, TS, TS)) continue;
      L.grid[i] = T.BEAT;
    }
  }
  // puff clouds dissolve shortly after you land on them, then drift back
  for (const p of L.puffs) {
    if (p.state === 'shake') { p.t -= dt; if (p.t <= 0) { p.state = 'gone'; p.t = 3.2; L.grid[p.ty * L.w + p.tx] = T.EMPTY; burst(p.tx * TS + 8, p.ty * TS + 4, '#ffffff', 6, 40, { g: 40 }); Sound.sfx('poof'); } }
    else if (p.state === 'gone') {
      p.t -= dt;
      if (p.t <= 0 && !rectHit(player.x, player.y, player.w, player.h, p.tx * TS, p.ty * TS, TS, TS)) { p.state = 'idle'; L.grid[p.ty * L.w + p.tx] = T.CLOUD; }
    }
  }
  if (player.onGround && player.ground && player.ground.kind === 'cloud') {
    const g = player.ground;
    for (const p of L.puffs) if (p.state === 'idle' && p.ty === g.ty && Math.abs(p.tx - g.tx) <= 1 && p.tx * TS < player.x + player.w && p.tx * TS + TS > player.x) { p.state = 'shake'; p.t = 0.55; }
  }
  updateChaser(dt);
  updateBlasts(dt);
}
function onScreen(x, y, m = 0) { return x > cam.x - m && x < cam.x + VW + m && y > cam.y - m && y < cam.y + VH + m; }
function onScreenAnyBeat() { return level.beats.some((b) => onScreen(b.tx * TS + 8, b.ty * TS + 8, 40)); }

function firebarBalls(f, t) {
  const out = [], a = t * 1.7 * f.dir + (f.phase || 0);
  for (let i = 1; i <= f.len; i++) out.push([f.x + Math.cos(a) * i * 7, f.y + Math.sin(a) * i * 7]);
  return out;
}

// everything here hurts on touch (star power shrugs it off)
function hazardContacts() {
  const p = player;
  if (p.dead || p.poof > 0) return;
  const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
  const touch = (x, y, r) => Math.abs(cx - x) < r + p.w / 2 - 1 && Math.abs(cy - y) < r + p.h / 2 - 2;
  for (const s of level.saws) if (touch(s.x, s.y, s.r - 2)) { if (!starOn()) hurtPlayer(s.x); }
  for (const f of level.firebars) for (const [x, y] of firebarBalls(f, level.time)) if (touch(x, y, 3)) { if (!starOn()) hurtPlayer(x); break; }
  const C = level.chaser;
  if (C && C.active && p.x < C.x + 6) killPlayer('saw');
}

// ---------------------------------------------------------------------
//  Bomb blasts (bomb beetles): break cracked ground and crumbly blocks
// ---------------------------------------------------------------------
function explode(x, y, r = 30) {
  level.blasts.push({ x, y, r, t: 0 });
  Sound.sfx('explode'); addShake(6); fx.hitstop = Math.max(fx.hitstop, 0.05);
  fx.flash = Math.max(fx.flash, 0.25); fx.flashCol = '#fff0c0';
  for (let i = 0; i < 26; i++) { const a = rand(0, Math.PI * 2), s = rand(40, 150); addParticle(x, y, { vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, col: pick(['#ffd84a', '#ff7a1a', '#ffffff', '#ff4a2a']), life: rand(0.3, 0.7), size: 2, drag: 2, g: 100 }); }
  for (let i = 0; i < 12; i++) addParticle(x + rand(-10, 10), y + rand(-10, 10), { vx: rand(-30, 30), vy: rand(-50, -10), col: pick(['#5a5470', '#7a7090', '#3a3448']), life: rand(0.6, 1.1), size: 3, g: -30, drag: 1.5 });
  const p = player;
  if (!p.dead && Math.hypot(p.x + 5 - x, p.y + 7 - y) < r + 4 && !starOn()) hurtPlayer(x);
  for (const e of enemies) if (e.alive && e.type !== 'boss' && Math.hypot(e.x + e.w / 2 - x, e.y + e.h / 2 - y) < r + 6) {
    if (e.type === 'bomb' && e.state !== 'lit') { e.state = 'lit'; e.t = 0.25; } else if (e.type !== 'bomb') killEnemy(e, 'blast');
  }
  for (const c of level.crumbles) if (c.state !== 'gone' && Math.hypot(c.x + 8 - x, c.y + 8 - y) < r + 10) { c.state = 'gone'; c.t = 6; burst(c.x + 8, c.y + 8, THEMES[level.theme].stone, 8, 70); }
  for (const g of level.collapses) if (g.state === 'idle' && g.cells.some(([cx, cy]) => Math.hypot(cx * TS + 8 - x, cy * TS + 8 - y) < r + 10)) { g.state = 'shake'; g.t = 0.02; }
}
function updateBlasts(dt) {
  const B = level.blasts;
  for (let i = B.length - 1; i >= 0; i--) { B[i].t += dt; if (B[i].t > 0.35) B.splice(i, 1); }
}

// ---------------------------------------------------------------------
//  The big saw wall that chases you (event 'chase')
// ---------------------------------------------------------------------
function startChaser(ev) {
  const m = (level.markers[ev.marker] || [])[0], stop = (level.markers[ev.stop] || [])[0];
  level.chaser = { x: m ? m.x - 40 : cam.x - 40, speed: ev.speed || 70, stopX: stop ? stop.x : level.w * TS, active: true, t: 0, wait: ev.wait != null ? ev.wait : 1.2 };
  Sound.sfx('rumble'); addShake(4);
}
function updateChaser(dt) {
  const C = level.chaser;
  if (!C || !C.active) return;
  C.t += dt;
  if (C.wait > 0) { C.wait -= dt; addShake(0.8); return; }
  // rubber-band: it never falls too far behind, so the chase stays tense
  const gap = player.x - C.x;
  let sp = C.speed;
  if (gap > VW * 0.75) sp *= 2.2; else if (gap < 60) sp *= 0.85;
  if (Save.data.settings.assist) sp *= 0.7;
  C.x = Math.min(C.stopX, C.x + sp * dt);
  if (C.x >= C.stopX) { C.active = false; burst(C.x, player.y, '#ffd84a', 30, 120); Sound.sfx('explode'); addShake(6); banner('PHEW!', '#7aff9a', 1.4); }
  addShake(0.7);
  if (Math.random() < 0.8) addParticle(C.x + 12, cam.y + rand(0, VH), { vx: rand(20, 120), vy: rand(-80, 40), col: pick(['#e8c890', '#c8a070', '#ffd84a']), life: 0.5, g: 200 });
  for (const e of enemies) if (e.alive && e.x < C.x + 8 && e.type !== 'boss') killEnemy(e, 'saw');
}

// ---------------------------------------------------------------------
//  Drawing
// ---------------------------------------------------------------------
function drawHazardsBack(t) {
  const L = level;
  // updraft columns: rising streaks
  for (const { tx, ty } of L.draftCells) {
    const x = tx * TS, y = ty * TS;
    if (!onScreen(x + 8, y + 8, 16)) continue;
    ctx.fillStyle = 'rgba(200,240,255,0.10)'; ctx.fillRect(x, y, TS, TS);
    for (let i = 0; i < 3; i++) {
      const sx = x + 2 + ((i * 5 + tx * 3) % 12), sy = y + 15 - (((t * 90 + i * 37 + tx * 13 + ty * 16) % 32) | 0) + 8;
      if (sy < y || sy > y + 15) continue;
      ctx.fillStyle = i === 1 ? 'rgba(255,255,255,0.55)' : 'rgba(190,235,255,0.4)'; ctx.fillRect(sx, sy, 1, 4);
    }
  }
  // saw rails
  ctx.fillStyle = 'rgba(20,16,32,0.5)';
  for (const s of L.saws) {
    if (!s.axis) continue;
    if (s.axis === 'x') { for (let x = s.min; x <= s.max; x += 4) ctx.fillRect(x - 1, s.y0 - 1, 2, 2); ctx.fillRect(s.min - 2, s.y0 - 3, 3, 6); ctx.fillRect(s.max - 1, s.y0 - 3, 3, 6); }
    else { for (let y = s.min; y <= s.max; y += 4) ctx.fillRect(s.x0 - 1, y - 1, 2, 2); ctx.fillRect(s.x0 - 3, s.min - 2, 6, 3); ctx.fillRect(s.x0 - 3, s.max - 1, 6, 3); }
  }
  // conveyor belts (scrolling treads over the baked ground)
  for (const c of L.conveyors) {
    const x = c.tx * TS, y = c.ty * TS;
    if (!onScreen(x + 8, y + 8, 16)) continue;
    ctx.fillStyle = '#2a2438'; ctx.fillRect(x, y, TS, 6);
    ctx.fillStyle = '#4a4458'; ctx.fillRect(x, y + 1, TS, 4);
    const off = ((t * CONVEYOR_V * c.dir) % 6 + 6) % 6;
    ctx.fillStyle = '#ffd84a';
    for (let i = -6; i < 22; i += 6) { const xx = x + i + off; if (xx >= x && xx < x + TS - 1) { ctx.fillRect(xx, y + 2, 2, 2); } }
    ctx.fillStyle = '#8a84a0'; ctx.fillRect(x, y, TS, 1);
    if (c.tx === 0 || tileAt(c.tx - 1, c.ty) !== tileAt(c.tx, c.ty)) { ctx.fillStyle = '#c8c0d8'; ctx.fillRect(x, y + 1, 3, 4); }
    if (tileAt(c.tx + 1, c.ty) !== tileAt(c.tx, c.ty)) { ctx.fillStyle = '#c8c0d8'; ctx.fillRect(x + 13, y + 1, 3, 4); }
  }
  // beat blocks: solid ones are bright, the others a dotted outline that pulses before the swap
  for (const b of L.beats) {
    const x = b.tx * TS, y = b.ty * TS;
    if (!onScreen(x + 8, y + 8, 16)) continue;
    const [c1, c2, c3] = b.group === 0 ? ['#ff5a7a', '#b02a50', '#ffb0c0'] : ['#4ab4ff', '#1a5ac0', '#b8ecff'];
    const solidNow = L.grid[b.ty * L.w + b.tx] === T.BEAT;
    if (solidNow) {
      const blink = L.beatWarn && Math.floor(t * 12) % 2;
      ctx.fillStyle = c2; ctx.fillRect(x, y, TS, TS);
      ctx.fillStyle = blink ? c3 : c1; ctx.fillRect(x + 1, y + 1, TS - 2, TS - 3);
      ctx.fillStyle = c3; ctx.fillRect(x + 1, y + 1, TS - 2, 1); ctx.fillRect(x + 1, y + 1, 1, TS - 3);
      ctx.fillStyle = c2; ctx.fillRect(x + 5, y + 5, 6, 5); ctx.fillStyle = c3; ctx.fillRect(x + 6, y + 6, 4, 3);
    } else {
      ctx.fillStyle = c1;
      const a = L.beatWarn && Math.floor(t * 12) % 2 ? 0.9 : 0.45;
      ctx.globalAlpha = a;
      for (let i = 0; i < TS; i += 3) { ctx.fillRect(x + i, y, 2, 1); ctx.fillRect(x + i, y + 15, 2, 1); ctx.fillRect(x, y + i, 1, 2); ctx.fillRect(x + 15, y + i, 1, 2); }
      ctx.globalAlpha = 1;
    }
  }
  // puff clouds
  for (const p of L.puffs) {
    if (p.state === 'gone') continue;
    const x = p.tx * TS, y = p.ty * TS;
    if (!onScreen(x + 8, y + 8, 16)) continue;
    const j = p.state === 'shake' ? (Math.floor(t * 30) % 2 ? 1 : -1) : 0;
    const bob = Math.round(Math.sin(t * 2 + p.tx * 0.7) * 1);
    if (p.state === 'shake') ctx.globalAlpha = 0.5 + p.t;
    drawPuffTile(x + j, y + bob, tileAt(p.tx - 1, p.ty) === T.CLOUD || L.puffs.some((q) => q.tx === p.tx - 1 && q.ty === p.ty && q.state !== 'gone'), L.puffs.some((q) => q.tx === p.tx + 1 && q.ty === p.ty && q.state !== 'gone'));
    ctx.globalAlpha = 1;
  }
  // cannons
  for (const c of L.cannons) {
    if (!onScreen(c.x + 8, c.y + 8, 24)) continue;
    drawCannon(c, t);
  }
}
function drawPuffTile(x, y, joinL, joinR) {
  ctx.fillStyle = '#c8d8f0'; ctx.fillRect(x + (joinL ? 0 : 2), y + 3, TS - (joinL ? 0 : 2) - (joinR ? 0 : 2), 5);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x + (joinL ? 0 : 1), y + 1, TS - (joinL ? 0 : 1) - (joinR ? 0 : 1), 4);
  ctx.fillRect(x + 3, y, 5, 1); ctx.fillRect(x + 10, y, 4, 1);
  ctx.fillStyle = '#eef4ff'; ctx.fillRect(x + 2, y + 5, 12, 1);
  ctx.fillStyle = '#a8b8d8'; ctx.fillRect(x + (joinL ? 0 : 3), y + 8, TS - (joinL ? 0 : 3) - (joinR ? 0 : 3), 1);
}
function drawCannon(c, t) {
  const x = c.x, y = c.y, f = c.face;
  const j = c.warn ? (Math.floor(t * 30) % 2 ? 1 : 0) : 0;
  ctx.fillStyle = '#1a1428'; ctx.fillRect(x, y, 16, 16);
  ctx.fillStyle = '#4a4458'; ctx.fillRect(x + 1, y + 1, 14, 14);
  ctx.fillStyle = '#6a6480'; ctx.fillRect(x + 1, y + 1, 14, 2);
  ctx.fillStyle = '#2a2438'; ctx.fillRect(x + 3, y + 12, 10, 2);
  // skull plate
  ctx.fillStyle = c.warn ? '#ff5a5a' : '#c8c0d8'; ctx.fillRect(x + 5, y + 5, 6, 4); ctx.fillRect(x + 6, y + 9, 4, 1);
  ctx.fillStyle = '#1a1428'; ctx.fillRect(x + 6, y + 6, 1, 1); ctx.fillRect(x + 9, y + 6, 1, 1);
  // barrel
  const bx = f > 0 ? x + 14 + j : x - 4 - j;
  ctx.fillStyle = '#1a1428'; ctx.fillRect(bx, y + 3, 6, 10);
  ctx.fillStyle = '#5a5470'; ctx.fillRect(bx + 1, y + 4, 4, 8);
  ctx.fillStyle = '#0c0a14'; ctx.fillRect(f > 0 ? bx + 3 : bx + 1, y + 6, 2, 4);
}

function drawHazardsFront(t) {
  const L = level;
  for (const s of L.saws) {
    if (!onScreen(s.x, s.y, 24)) continue;
    const fr = ART.saw[Math.floor(t * 24) % ART.saw.length];
    ctx.drawImage(fr, Math.round(s.x - fr.width / 2), Math.round(s.y - fr.height / 2));
  }
  for (const f of L.firebars) {
    if (!onScreen(f.x, f.y, 50)) continue;
    const balls = firebarBalls(f, t);
    for (const [x, y] of balls) glow('orange', x, y, 9, 0.9);
    for (const [x, y] of balls) {
      ctx.fillStyle = '#c82a10'; ctx.fillRect(Math.round(x) - 3, Math.round(y) - 3, 6, 6);
      ctx.fillStyle = '#ff7a1a'; ctx.fillRect(Math.round(x) - 3, Math.round(y) - 2, 6, 4); ctx.fillRect(Math.round(x) - 2, Math.round(y) - 3, 4, 6);
      ctx.fillStyle = '#ffe07a'; ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2);
    }
    ctx.fillStyle = '#1a1428'; ctx.fillRect(f.x - 3, f.y - 3, 6, 6); ctx.fillStyle = '#ffd84a'; ctx.fillRect(f.x - 1, f.y - 1, 2, 2);
  }
  for (const b of L.blasts) {
    const k = b.t / 0.35, r = b.r * (0.5 + k * 0.7);
    glow('orange', b.x, b.y, r * 1.6, 1 - k);
    ctx.globalAlpha = 1 - k; ctx.fillStyle = k < 0.3 ? '#ffffff' : '#ffd84a'; circle(b.x, b.y, Math.round(r * (1 - k * 0.6))); ctx.globalAlpha = 1;
  }
  const C = L.chaser;
  if (C) {
    const x = Math.round(C.x);
    if (x > cam.x - 40 && x < cam.x + VW + 20) {
      // a tall timber frame of spinning blades
      ctx.fillStyle = '#3a2418'; ctx.fillRect(x - 60, cam.y - 4, 52, VH + 8);
      ctx.fillStyle = '#5a3a20'; ctx.fillRect(x - 12, cam.y - 4, 6, VH + 8);
      ctx.fillStyle = '#7a4a28'; ctx.fillRect(x - 11, cam.y - 4, 2, VH + 8);
      const top = Math.floor(cam.y / 28) * 28 - 28;
      for (let y = top; y < cam.y + VH + 30; y += 28) {
        const fr = ART.sawBig[Math.floor(t * 30 + y) % ART.sawBig.length];
        ctx.drawImage(fr, x - 8 - fr.width / 2 + 8, y - fr.height / 2);
      }
      if (C.wait > 0 && Math.floor(C.wait * 6) % 2) Font.draw('!!', x + 16, player.y - 20, { color: '#ff3a5a', outline: true, scale: 2 });
    }
  }
}
