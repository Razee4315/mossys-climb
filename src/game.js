// =====================================================================
//  GAMEPLAY — the play screen: update order, pickups, rendering, HUD
// =====================================================================
const stats = { jumps: 0, deaths: 0, kills: 0, hits: 0 };
let gemCombo = 0, gemComboT = 0;
const iris = { t: 0, dir: 0, cb: null, cx: VW / 2, cy: VH / 2 };
let SPIKE_IMG = null;

function collectGemFx(x, y) {
  gemCombo = gemComboT > 0 ? gemCombo + 1 : 0; gemComboT = 0.7;
  Sound.sfx('gem', gemCombo);
  burst(x, y, '#4ae0ff', 8, 55); burst(x, y, '#ffffff', 4, 30);
}
function gemsGot() { return level.gems.filter((g) => g.got).length; }

function springContacts() {
  const p = player;
  for (const s of level.springs) {
    if (p.vy >= 0 && p.prevBottom <= s.y + 10 && rectHit(p.x, p.y, p.w, p.h, s.x + 2, s.y + 7, 12, 9)) {
      p.y = s.y + 7 - p.h; p.remY = 0; p.vy = -PHYS.SPRING_V; p.springLock = 0.55; p.varJump = false;
      p.canDouble = true; p.canDash = true; p.slam = 0; p.onGround = false; p.ground = null; p.coyote = 0;
      p.sx = 0.6; p.sy = 1.45; s.t = 0.22;
      Sound.sfx('spring'); burst(s.x + 8, s.y + 8, '#ffffff', 8, 50);
    }
  }
}

const PlayScreen = {
  levelIdx: 0,
  enter(idx) {
    this.levelIdx = idx;
    startLevel(idx);
    setupPlayer(Save.data.char);
    placePlayer(level.spawn.x, level.spawn.y);
    Object.assign(stats, { jumps: 0, deaths: 0, kills: 0, hits: 0 });
    fx.particles = []; fx.texts = []; fx.banners = []; fx.weather = [];
    updateCamera(0, true);
    this.cleared = false; this.clearOpened = false; this.introT = 3.2; this.clearT = 0;
    const save = Save.level(idx);
    level.ghost = new Set(save.gems);
    Sound.Music.play(level.def.music || THEMES[level.theme].music);
    iris.t = 0; iris.dir = 1; iris.cb = null;
    initWeatherParticles();
    if (!SPIKE_IMG) { const B = PixBuf(TS, TS); paintSpike((x, y, c) => B.put(x, y, c), '^'); SPIKE_IMG = B.done(); }
  },
  restartLevel() { this.enter(this.levelIdx); },

  update(dt) {
    if (iris.dir !== 0) {
      iris.t = clamp(iris.t + iris.dir * dt * 2.6, 0, 1);
      if (iris.dir < 0 && iris.t <= 0) { iris.dir = 1; const cb = iris.cb; iris.cb = null; if (cb) cb(); }
      else if (iris.dir > 0 && iris.t >= 1) iris.dir = 0;
    }
    if (this.cleared) { this.updateCleared(dt); return; }
    if (Input.pressed.pause && iris.dir >= 0) { Screens.open(PauseScreen); return; }
    if (Input.pressed.retry && !player.dead && iris.dir === 0) {
      iris.cx = player.x + 5 - cam.x; iris.cy = player.y + 7 - cam.y;
      iris.dir = -1; iris.cb = () => respawnAtCheckpoint();
      Sound.sfx('back');
    }
    if (fx.hitstop > 0) { fx.hitstop -= dt; updateFx(dt * 0.2); return; }
    this.introT -= dt;
    gemComboT -= dt;
    const L = level;
    if (!player.dead) L.time += dt;
    updatePlatforms(dt);
    updatePlayer(dt);
    updateCrumbles(dt); updateCollapses(dt); updateSprings(dt); updateCrushers(dt); updateStals(dt);
    updateRocks(dt); updateBoulders(dt); updateLava(dt); updateWeather(dt); updateEvents(dt);
    updateFinishHop(dt); updatePopSpikes(dt); updateSecrets(dt);
    updateEnemies(dt); enemyContacts();
    this.pickups(dt);
    L.darkness = approach(L.darkness, L.darkTarget, dt * 0.8);
    if (L.sunrise) L.sunrise = Math.min(1, L.sunrise + dt * 0.25);
    if (player.dead && player.deadT <= 0.55 && iris.dir === 0) {
      iris.cx = player.x + 5 - cam.x; iris.cy = player.y + 7 - cam.y;
      iris.dir = -1; iris.cb = () => respawnAtCheckpoint();
    }
    updateCamera(dt);
    updateFx(dt);
    updateWeatherParticles(dt);
  },

  pickups(dt) {
    const p = player, L = level;
    if (p.dead || p.poof > 0) return;
    for (const g of L.gems) {
      if (g.got || g.mimic) continue;
      if (rectHit(p.x, p.y, p.w, p.h, g.x, g.y, 12, 10)) { g.got = true; collectGemFx(g.x + 6, g.y + 5); }
    }
    for (const h of L.hearts) {
      if (h.got || p.hearts >= p.maxHearts) continue;
      if (rectHit(p.x, p.y, p.w, p.h, h.x, h.y, 9, 8)) {
        h.got = true; p.hearts++; Sound.sfx('heart'); burst(h.x + 4, h.y + 4, '#ff4d6d', 10, 50); floatText(h.x + 4, h.y - 4, '+1 ♥', '#ff4d6d');
      }
    }
    springContacts();
    for (const cp of L.checkpoints) {
      if (cp.active) continue;
      if (rectHit(p.x, p.y, p.w, p.h, cp.x - 2, cp.y - 8, 20, 24)) {
        cp.active = true; cp.t = 0;
        L.checkpoint = cp;
        cp.midRise = !!(L.lava && L.lava.active);
        p.hearts = Math.max(p.hearts, p.maxHearts);
        Sound.sfx('checkpoint'); burst(cp.x + 10, cp.y + 2, '#7aff9a', 16, 70);
        floatText(cp.x + 8, cp.y - 14, 'CHECKPOINT', '#7aff9a');
      }
    }
    L.activeSign = null;
    for (const s of L.signs) if (rectHit(p.x, p.y, p.w, p.h, s.x - 6, s.y, TS + 12, TS)) L.activeSign = s;
    const F = L.finish;
    if (F && !F.hop) {
      const ev = L.events.find((e) => e.type === 'flagRun');
      const pending = ev && F.hops < (ev.markers || []).length;
      if (!pending && rectHit(p.x, p.y, p.w, p.h, F.x - 2, F.y - 16, 20, 32)) this.complete();
    }
    const D = L.dawnGem;
    if (D && !D.got) {
      D.t += dt; D.y = approach(D.y, D.ty, 30 * dt);
      if (rectHit(p.x, p.y, p.w, p.h, D.x, D.y, 16, 14)) { D.got = true; this.complete(); }
    }
  },

  complete() {
    const L = level;
    this.cleared = true; this.clearT = 0;
    Sound.sfx('clear');
    if (!L.dawnGem) Sound.Music.stop();
    burst(player.x + 5, player.y, '#ffd84a', 30, 120);
    player.vx = 0;
    // record results
    const save = Save.level(this.levelIdx);
    const got = L.gems.filter((g) => g.got).map((g) => g.id);
    const newGems = got.filter((id) => !save.gems.includes(id)).length;
    save.gems = [...new Set([...save.gems, ...got])];
    const firstClear = !save.done;
    const newBest = save.best == null || L.time < save.best;
    if (newBest) save.best = L.time;
    save.done = true;
    save.deaths += L.deaths;
    const allGems = got.length >= L.gemTotal;
    const fast = L.time <= (L.def.par || 999);
    save.stars = [true, save.stars[1] || save.gems.length >= L.gemTotal, save.stars[2] || fast];
    const unlockedBefore = Save.data.unlocked;
    Save.data.unlocked = Math.max(Save.data.unlocked, Math.min(LEVELS.length, this.levelIdx + 2));
    let unlockedChar = null;
    if (this.levelIdx === LEVELS.length - 1 && !Save.data.secret) { Save.data.secret = true; unlockedChar = 'golden'; }
    Save.write();
    this.result = {
      time: L.time, best: save.best, newBest: newBest && !firstClear, gems: got.length, total: L.gemTotal, deaths: L.deaths, kills: L.kills,
      secrets: L.secretsFound, secretTotal: L.secrets.length, stars: [true, allGems, fast], newGems, unlockedChar,
      unlockedLevel: Save.data.unlocked > unlockedBefore,
    };
  },

  updateCleared(dt) {
    this.clearT += dt;
    updateFx(dt); updateWeatherParticles(dt);
    updateEnemies(dt);
    // celebratory hops
    const p = player;
    p.vy += 900 * dt; if (moveY(p, p.vy * dt)) { p.vy = 0; }
    p.onGround = !!groundUnder(p);
    if (p.onGround && this.clearT < 1.6 && this.clearT > 0.2) { p.vy = -220; p.sx = 0.8; p.sy = 1.2; }
    p.sx = approach(p.sx, 1, dt * 3); p.sy = approach(p.sy, 1, dt * 3);
    p.anim += dt * 5;
    if (level.sunrise) level.sunrise = Math.min(1, level.sunrise + dt * 0.25);
    updateCamera(dt);
    if (this.clearT > 1.5 && Math.random() < 0.15) burst(cam.x + rand(40, VW - 40), cam.y + rand(30, 100), pick(['#ffd84a', '#4ae0ff', '#ff7aa8', '#7aff9a']), 12, 70, { g: 60 });
    if (this.clearT > 1.8 && !this.clearOpened) { this.clearOpened = true; Screens.open(ClearScreen); }
  },

  render() {
    renderWorld();
    renderHUD();
    if (iris.dir !== 0 || iris.t < 1) drawIris(iris.t, iris.cx, iris.cy);
  },
};

// ---------------------------------------------------------------------
//  Background
// ---------------------------------------------------------------------
function drawBackground() {
  const L = level, th = THEMES[L.theme];
  const maxY = Math.max(1, L.h * TS - VH);
  const alt = L.h * TS > VH * 2 ? 1 - cam.y / maxY : 0;
  let top = mixColor(th.sky[0], th.skyHigh[0], alt), bot = mixColor(th.sky[1], th.skyHigh[1], alt);
  if (L.sunrise) { top = mixColor(top, '#ff9a6a', L.sunrise * 0.8); bot = mixColor(bot, '#ffe0a0', L.sunrise); }
  const g = ctx.createLinearGradient(0, 0, 0, VH);
  g.addColorStop(0, top); g.addColorStop(1, bot);
  ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
  const t = L.time;
  if (L.bg.stars || L.theme === 'storm' || L.theme === 'cave' || alt > 0.6) {
    for (let i = 0; i < 40; i++) {
      const sx = (((i * 97 + 13) % VW) - cam.x * 0.02 + VW * 4) % VW, sy = (i * 53) % 120;
      if (Math.sin(t * 2 + i) > 0.6 || L.theme === 'cave') continue;
      ctx.fillStyle = L.theme === 'cave' ? 'rgba(160,140,255,0.35)' : 'rgba(255,255,255,0.7)';
      ctx.fillRect(Math.floor(sx), sy, 1, 1);
    }
  }
  if (th.sun || L.sunrise) {
    const sy = L.sunrise ? lerp(150, 40, easeOutCubic(L.sunrise)) : 30 + alt * 10;
    const sx = 300 - cam.x * 0.02 % 40;
    ctx.fillStyle = 'rgba(255,255,220,0.25)'; circle(sx, sy, 18);
    ctx.fillStyle = L.sunrise ? '#ffd27a' : th.sun || '#fff4c0'; circle(sx, sy, 12);
  }
  if (th.clouds) {
    const camDY = (maxY - cam.y);
    for (let i = 0; i < 9; i++) {
      const c = ART.clouds[i % ART.clouds.length];
      const wx = (i * 173 + t * (3 + (i % 3) * 2) - cam.x * (0.1 + (i % 3) * 0.04)) % (VW + 140);
      const x = ((wx + VW + 140) % (VW + 140)) - 70;
      const y = 14 + ((i * 37) % 70) + camDY * 0.15 - (i % 2) * 120 * (alt > 0 ? 1 : 0);
      if (y > -30 && y < VH) { ctx.globalAlpha = 0.9; ctx.drawImage(c, Math.round(x), Math.round(y)); ctx.globalAlpha = 1; }
    }
  }
  for (const layer of L.bg.layers) {
    const W = layer.c.width, H = layer.c.height;
    let y;
    if (layer.anchor === 'center') y = Math.round((VH - H) / 2 - ((cam.y - maxY / 2) * layer.f) % H);
    else y = Math.round(VH - H - 58 + layer.yOff + (maxY - cam.y) * layer.f * 1.2);
    if (y >= VH) continue;
    const ox = -Math.floor(((cam.x * layer.f) % W + W) % W);
    for (let x = ox; x < VW; x += W) {
      ctx.drawImage(layer.c, x, y);
      if (layer.anchor === 'center') { ctx.drawImage(layer.c, x, y - H); ctx.drawImage(layer.c, x, y + H); }
    }
    // fill below a bottom-anchored layer so it never shows sky underneath
    if (layer.anchor !== 'center' && y + H < VH) {
      const img = layer.c.getContext('2d');
      ctx.fillStyle = layer.fill || (layer.fill = sampleBottom(layer.c));
      ctx.fillRect(0, y + H, VW, VH - y - H);
    }
  }
  if (L.theme === 'storm' || L.theme === 'summit') {
    if (!L.sunrise && Math.random() < 0.004) fx.flash = Math.max(fx.flash, 0.2);
  }
}
function sampleBottom(c) {
  const d = c.getContext('2d').getImageData(Math.floor(c.width / 2), c.height - 1, 1, 1).data;
  return `rgb(${d[0]},${d[1]},${d[2]})`;
}
function circle(x, y, r) {
  for (let dy = -r; dy <= r; dy++) { const w = Math.floor(Math.sqrt(r * r - dy * dy)); ctx.fillRect(Math.round(x - w), Math.round(y + dy), w * 2 + 1, 1); }
}

// ---------------------------------------------------------------------
//  World rendering
// ---------------------------------------------------------------------
function renderWorld() {
  const L = level;
  drawBackground();
  const cx = Math.round(cam.x + cam.shakeX), cy = Math.round(cam.y + cam.shakeY);
  ctx.save();
  ctx.translate(-cx, -cy);
  const t = L.time;
  // lava pools
  drawLavaTiles(cx, cy, t);
  // static terrain (only the visible slice)
  const sx = clamp(cx, 0, L.art.width), sy = clamp(cy, 0, L.art.height);
  const sw = Math.min(VW + 2, L.art.width - sx), sh = Math.min(VH + 2, L.art.height - sy);
  if (sw > 0 && sh > 0) ctx.drawImage(L.art, sx, sy, sw, sh, sx, sy, sw, sh);
  // beyond the left / right edge of the level: solid rock, not open sky
  const mapW = L.w * TS;
  if (cx < 0 || cx + VW > mapW) {
    ctx.fillStyle = L.wallPattern || THEMES[L.theme].edge;
    if (cx < 0) ctx.fillRect(cx, cy, -cx, VH);
    if (cx + VW > mapW) ctx.fillRect(mapW, cy, cx + VW - mapW, VH);
    ctx.fillStyle = THEMES[L.theme].edge;
    if (cx < 0) ctx.fillRect(-2, cy, 2, VH);
    if (cx + VW > mapW) ctx.fillRect(mapW, cy, 2, VH);
  }
  // collapsing ground
  for (const c of L.collapses) {
    if (c.state === 'gone') continue;
    const j = c.state === 'shake' ? (Math.floor(t * 40) % 2 ? 1 : -1) : 0;
    c.cells.forEach(([x, y], i) => ctx.drawImage(c.tiles[i], x * TS + j, y * TS));
  }
  for (const s of L.popSpikes) if (s.t <= 0) ctx.drawImage(SPIKE_IMG, 0, 0, 16, 16, s.tx * TS, s.ty * TS + Math.round((1 - s.up) * 9), 16, 16 - Math.round((1 - s.up) * 9));
  for (const g of L.gates) if (g.closed) { ctx.fillStyle = '#2a2438'; for (let i = 1; i < 16; i += 4) ctx.fillRect(g.x + i, g.y, 2, 16); ctx.fillStyle = '#7d7690'; ctx.fillRect(g.x, g.y + 3, 16, 2); ctx.fillRect(g.x, g.y + 11, 16, 2); }
  for (const c of L.crumbles) {
    if (c.state === 'gone') continue;
    const j = c.state === 'shake' ? (Math.floor(t * 50) % 2 ? 1 : -1) : 0;
    ctx.drawImage(L.props.crumble, c.x + j, c.y);
  }
  for (const p of L.platforms) ctx.drawImage(L.props.platform.c, p.x - 1, p.y - 1);
  for (const s of L.springs) spr(ART.spring[s.t > 0 ? 1 : 0], s.x, s.y + 6);
  for (const s of L.signs) {
    spr(ART.sign, s.x, s.y + 1);
    if (L.activeSign !== s && Math.abs(player.x - s.x) < 60 && Math.floor(t * 2) % 2) Font.draw('?', s.x + 6, s.y - 9, { color: '#ffd84a', outline: true });
  }
  for (const cp of L.checkpoints) drawCheckpoint(cp, t);
  if (L.finish) drawFinish(L.finish, t);
  for (const g of L.gems) {
    if (g.got || g.mimic) continue;
    const f = ART.gem[Math.floor(t * 8 + g.bob) % 4];
    const ghost = L.ghost.has(g.id);
    if (ghost) ctx.globalAlpha = 0.45;
    spr(f, g.x, g.y + Math.round(Math.sin(t * 3 + g.bob) * 1.5));
    ctx.globalAlpha = 1;
    if (Math.random() < 0.01) addParticle(g.x + rand(0, 12), g.y + rand(0, 10), { col: '#ffffff', life: 0.4, g: 0, vy: -8 });
  }
  for (const h of L.hearts) if (!h.got) spr(ART.heart, h.x, h.y + Math.round(Math.sin(t * 4) * 1.5));
  for (const k of L.crushers) {
    const j = k.state === 'warn' ? (Math.floor(t * 40) % 2 ? 1 : -1) : 0;
    ctx.fillStyle = '#4a4458'; for (let y = k.y0 - 4; y > k.y0 - 40 && y >= 0; y -= 4) ctx.fillRect(k.x + 15, y, 2, 2);
    ctx.drawImage(ART.crusher[k.state === 'idle' || k.state === 'rise' ? 0 : 1].c, k.x - 1 + j, Math.round(k.y) - 1);
  }
  for (const s of L.stals) {
    if (s.state === 'gone') continue;
    const j = s.state === 'shake' ? (Math.floor(t * 40) % 2 ? 1 : -1) : 0;
    spr(L.props.stal, s.x + j, s.y);
  }
  if (L.dawnGem && !L.dawnGem.got) {
    const D = L.dawnGem;
    ctx.globalAlpha = 0.3 + Math.sin(D.t * 4) * 0.1; ctx.fillStyle = '#ffd84a'; circle(D.x + 8, D.y + 7, 14); ctx.globalAlpha = 1;
    spr(ART.dawnGem, D.x, D.y + Math.sin(D.t * 3) * 2);
  }
  drawEnemies();
  drawPlayer();
  for (const r of L.rocks) {
    if (r.kind === 'debris') { ctx.globalAlpha = clamp(r.life, 0, 1); ctx.save(); ctx.translate(r.x + 8, r.y + 8); ctx.rotate(r.rot); ctx.drawImage(r.img, -8, -8); ctx.restore(); ctx.globalAlpha = 1; continue; }
    if (r.warn > 0) { if (Math.floor(r.warn * 10) % 2) Font.draw('!', r.x + 4, r.y + 4, { color: '#ff3a5a', outline: true }); continue; }
    spr(ART.rock, r.x, r.y);
  }
  for (const b of L.boulders) {
    const frames = b.snow ? ART.snowball : ART.boulder;
    const f = frames[((Math.floor(b.rot * 2) % 8) + 8) % 8];
    ctx.drawImage(f.c, Math.round(b.x) - 1, Math.round(b.y) - 1);
    if (b.wait > 0 && Math.floor(b.wait * 8) % 2) Font.draw('!', b.x + 12, b.y - 12, { color: '#ff3a5a', outline: true, scale: 2 });
  }
  drawRisingLava(cx, cy, t);
  for (const s of L.secrets) { if (s.alpha < 0.02) continue; ctx.globalAlpha = s.alpha; ctx.drawImage(s.canvas, s.bx, s.by); ctx.globalAlpha = 1; }
  drawBolts(cx, cy);
  for (const p of fx.particles) {
    ctx.globalAlpha = p.glow ? 1 : clamp(p.life / p.max * 1.5, 0, 1);
    ctx.fillStyle = p.col; ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
  }
  ctx.globalAlpha = 1;
  for (const tx of fx.texts) Font.draw(tx.text, tx.x, tx.y, { color: tx.col, align: 'center', outline: true, alpha: clamp(tx.t * 2, 0, 1) });
  ctx.restore();
  drawLighting(cx, cy);
  drawWeatherParticles();
  if (fx.flash > 0) { ctx.globalAlpha = Math.min(0.85, fx.flash); ctx.fillStyle = fx.flashCol; ctx.fillRect(0, 0, VW, VH); ctx.globalAlpha = 1; }
}

function drawCheckpoint(cp, t) {
  const x = cp.x, y = cp.y;
  ctx.fillStyle = '#4a4458'; ctx.fillRect(x + 4, y + 13, 8, 3);
  ctx.fillStyle = '#c8c0d8'; ctx.fillRect(x + 7, y - 6, 2, 19);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 7, y - 7, 2, 1);
  if (cp.active) cp.t = Math.min(1, (cp.t || 0) + 0.04);
  const raise = cp.active ? easeOutBack(cp.t || 1) : 0;
  const fy = Math.round(lerp(y + 6, y - 5, raise));
  const col = cp.active ? '#4cd96a' : '#d04a5a', dark = cp.active ? '#2a9a4a' : '#8a2a3a';
  for (let i = 0; i < 9; i++) {
    const wave = Math.round(Math.sin(t * 6 + i * 0.7 + x) * (cp.active ? 1 : 0.5));
    ctx.fillStyle = i > 6 ? dark : col; ctx.fillRect(x + 9 + i, fy + wave, 1, 6 - Math.floor(i / 4));
  }
}
function drawFinish(F, t) {
  const x = Math.round(F.x), y = Math.round(F.y);
  if (!F.hop) { ctx.fillStyle = '#8a7a6a'; ctx.fillRect(x + 1, y + 12, 14, 4); ctx.fillStyle = '#b8a890'; ctx.fillRect(x + 1, y + 12, 14, 1); }
  ctx.fillStyle = '#fff4d0'; ctx.fillRect(x + 7, y - 18, 2, 30);
  ctx.fillStyle = '#ffd84a'; ctx.fillRect(x + 6, y - 21, 4, 3);
  for (let i = 0; i < 13; i++) {
    const wave = Math.round(Math.sin(t * 7 + i * 0.6) * 1.5);
    ctx.fillStyle = i % 4 === 3 ? '#ff9a2a' : '#ffd84a'; ctx.fillRect(x + 9 + i, y - 17 + wave, 1, 9 - Math.floor(i / 3));
  }
  if (F.hop) { // little legs while running away
    const l = Math.floor(t * 16) % 2;
    ctx.fillStyle = '#5a3a20'; ctx.fillRect(x + 5 + l, y + 12, 2, 4); ctx.fillRect(x + 9 - l, y + 12, 2, 4);
  }
}

function drawLavaTiles(cx, cy, t) {
  for (const { tx, ty } of level.lavaTiles) {
    const x = tx * TS, y = ty * TS;
    if (x + TS < cx || x > cx + VW || y + TS < cy || y > cy + VH) continue;
    const surface = tileAt(tx, ty - 1) !== T.LAVA;
    ctx.fillStyle = '#c82a10'; ctx.fillRect(x, y + (surface ? 4 : 0), TS, TS - (surface ? 4 : 0));
    ctx.fillStyle = '#ff5a1a'; ctx.fillRect(x, y + (surface ? 6 : 0), TS, 6);
    if (surface) for (let i = 0; i < TS; i += 2) {
      const h = Math.round(Math.sin((x + i) * 0.25 + t * 4) * 1.5 + 1.5);
      ctx.fillStyle = '#ffd25a'; ctx.fillRect(x + i, y + 4 - h + 1, 2, 2);
      ctx.fillStyle = '#ff8a2a'; ctx.fillRect(x + i, y + 6 - h + 1, 2, 2);
    }
    if (surface && Math.random() < 0.01) addParticle(x + rand(2, 14), y + 3, { vy: rand(-50, -20), col: '#ffd25a', life: 0.6, g: 120 });
  }
}
function drawRisingLava(cx, cy, t) {
  const lv = level.lava;
  if (!lv || lv.y > cy + VH + 10) return;
  const top = Math.round(lv.y);
  ctx.fillStyle = '#b8200c'; ctx.fillRect(cx, top + 6, VW, cy + VH - top);
  ctx.fillStyle = '#ff5a1a'; ctx.fillRect(cx, top + 4, VW, 10);
  for (let i = 0; i < VW; i += 2) {
    const x = cx + i;
    const h = Math.round(Math.sin(x * 0.12 + t * 4) * 2 + Math.sin(x * 0.05 - t * 2) * 2);
    ctx.fillStyle = '#ffd25a'; ctx.fillRect(x, top - h, 2, 2);
    ctx.fillStyle = '#ff8a2a'; ctx.fillRect(x, top - h + 2, 2, 3);
  }
  // bubbles
  for (let i = 0; i < 6; i++) {
    const bx = cx + ((i * 71 + Math.floor(t * 20)) % VW), by = top + 16 + ((i * 13 + t * 30) % 30);
    ctx.fillStyle = '#ff8a2a'; ctx.fillRect(Math.round(bx), Math.round(by), 2, 2);
  }
}
function drawBolts(cx, cy) {
  for (const b of level.weather.bolts) {
    if (b.t > 0) {
      if (Math.floor(b.t * 12) % 2 === 0) {
        ctx.fillStyle = 'rgba(255,255,160,0.18)'; ctx.fillRect(Math.round(b.x) - 8, cy, 16, b.ground - cy);
        ctx.fillStyle = '#ffd84a'; ctx.fillRect(Math.round(b.x) - 4, b.ground - 3, 8, 2); ctx.fillRect(Math.round(b.x) - 1, b.ground - 9, 2, 5);
      }
    } else if (b.strike > 0) {
      if (!b.pts) { b.pts = []; for (let y = cy - 10; y < b.ground; y += 10) b.pts.push([b.x + rand(-5, 5), y]); b.pts.push([b.x, b.ground]); }
      for (let i = 0; i < b.pts.length - 1; i++) {
        const [x0, y0] = b.pts[i], [x1, y1] = b.pts[i + 1];
        for (let s = 0; s <= 10; s++) {
          const x = Math.round(lerp(x0, x1, s / 10)), y = Math.round(lerp(y0, y1, s / 10));
          ctx.fillStyle = '#ffffa0'; ctx.fillRect(x - 2, y, 5, 1); ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 1, y, 3, 1);
        }
      }
    }
  }
}

// ---------------------------------------------------------------------
//  Lighting (half-res darkness with soft holes, upscaled for a stepped look)
// ---------------------------------------------------------------------
const lightCanvas = newCanvas(VW / 2, VH / 2);
const lctx = lightCanvas.getContext('2d');
function drawLighting(cx, cy) {
  const L = level;
  const dark = L.darkness;
  if (dark <= 0.01) return;
  lctx.globalCompositeOperation = 'source-over';
  lctx.clearRect(0, 0, VW / 2, VH / 2);
  lctx.fillStyle = L.theme === 'magma' ? `rgba(30,6,8,${dark})` : `rgba(6,4,18,${dark})`;
  lctx.fillRect(0, 0, VW / 2, VH / 2);
  lctx.globalCompositeOperation = 'destination-out';
  const hole = (x, y, r, a = 1) => {
    const sx = (x - cx) / 2, sy = (y - cy) / 2, sr = r / 2;
    if (sx < -sr || sy < -sr || sx > VW / 2 + sr || sy > VH / 2 + sr) return;
    const g = lctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
    g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(0.55, `rgba(0,0,0,${a * 0.7})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    lctx.fillStyle = g; lctx.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
  };
  if (!player.dead) hole(player.x + 5, player.y + 7, L.darkTarget > 0.85 ? 62 : 86);
  for (const l of L.lights) hole(l.x, l.y, l.r * 1.6, 0.8);
  for (const g of L.gems) if (!g.got && !g.mimic) hole(g.x + 6, g.y + 5, 26, 0.6);
  for (const cp of L.checkpoints) hole(cp.x + 8, cp.y, cp.active ? 60 : 30, 0.8);
  if (L.finish) hole(L.finish.x + 12, L.finish.y - 6, 70);
  for (const { tx, ty } of L.lavaTiles) if (tileAt(tx, ty - 1) !== T.LAVA) hole(tx * TS + 8, ty * TS + 4, 46, 0.9);
  if (L.lava && L.lava.y < cy + VH + 40) for (let x = 0; x < VW; x += 48) hole(cx + x + 24, L.lava.y + 8, 110, 1);
  for (const b of L.weather.bolts) if (b.strike > 0) hole(b.x, b.ground - 60, 200);
  for (const e of enemies) if (e.alive && (e.type === 'bat' || e.type === 'boss')) hole(e.x + e.w / 2, e.y + 4, 22, 0.4);
  for (const p of fx.particles) if (p.glow) hole(p.x, p.y, 12, 0.5);
  if (L.dawnGem) hole(L.dawnGem.x + 8, L.dawnGem.y + 7, 90);
  ctx.drawImage(lightCanvas, 0, 0, VW, VH);
}

// ---------------------------------------------------------------------
//  Screen-space weather particles
// ---------------------------------------------------------------------
let lastCam = { x: 0, y: 0 };
function initWeatherParticles() {
  fx.weather = [];
  const kind = THEMES[level.theme].weather;
  const n = { rain: 70, snow: 60, leaves: 14, petals: 16, fireflies: 18, spores: 26, embers: 30 }[kind] || 0;
  for (let i = 0; i < n; i++) fx.weather.push(newWeatherP(kind, true));
  lastCam = { x: cam.x, y: cam.y };
}
function newWeatherP(kind, anywhere) {
  const p = { kind, x: rand(0, VW), y: anywhere ? rand(0, VH) : -6, z: rand(0.4, 1), t: rand(0, 10) };
  if (kind === 'embers' || kind === 'spores') { p.y = anywhere ? rand(0, VH) : VH + 4; }
  return p;
}
function updateWeatherParticles(dt) {
  const dx = cam.x - lastCam.x, dy = cam.y - lastCam.y;
  lastCam = { x: cam.x, y: cam.y };
  const gust = level.weather.gust && level.weather.gust.active ? level.weather.gust.dir : 0;
  for (const p of fx.weather) {
    p.t += dt;
    p.x -= dx * p.z; p.y -= dy * p.z;
    switch (p.kind) {
      case 'rain': p.x += (-60 + gust * 200) * dt; p.y += 300 * p.z * dt; break;
      case 'snow': p.x += (Math.sin(p.t * 1.5) * 12 + gust * 160) * dt; p.y += 26 * p.z * dt; break;
      case 'leaves': case 'petals': p.x += (20 + Math.sin(p.t) * 20 + gust * 160) * dt; p.y += (18 + Math.sin(p.t * 2) * 10) * p.z * dt; break;
      case 'fireflies': p.x += Math.sin(p.t * 0.9) * 10 * dt; p.y += Math.cos(p.t * 1.3) * 8 * dt; break;
      case 'spores': p.x += Math.sin(p.t) * 6 * dt; p.y -= 8 * p.z * dt; break;
      case 'embers': p.x += Math.sin(p.t * 2) * 10 * dt; p.y -= 30 * p.z * dt; break;
    }
    if (p.x < -10) p.x += VW + 20; if (p.x > VW + 10) p.x -= VW + 20;
    if (p.y > VH + 8) { Object.assign(p, newWeatherP(p.kind, false)); p.x = rand(0, VW); }
    if (p.y < -10) { if (p.kind === 'embers' || p.kind === 'spores') { Object.assign(p, newWeatherP(p.kind, false)); p.x = rand(0, VW); } else p.y += VH + 16; }
  }
  if (gust && Math.random() < 0.6) fx.weather.length < 200 && fx.weather.push({ kind: 'streak', x: gust > 0 ? -20 : VW + 20, y: rand(0, VH), z: 1, t: 0, dir: gust });
  fx.weather = fx.weather.filter((p) => p.kind !== 'streak' || (p.x > -40 && p.x < VW + 40 && (p.x += p.dir * 500 * dt, true)));
}
function drawWeatherParticles() {
  for (const p of fx.weather) {
    const x = Math.round(p.x), y = Math.round(p.y);
    switch (p.kind) {
      case 'rain': if (level.sunrise > 0.35) break; ctx.fillStyle = 'rgba(170,200,255,0.5)'; ctx.fillRect(x, y, 1, 4 + Math.round(p.z * 3)); break;
      case 'snow': ctx.fillStyle = p.z > 0.75 ? '#ffffff' : 'rgba(255,255,255,0.6)'; ctx.fillRect(x, y, p.z > 0.8 ? 2 : 1, p.z > 0.8 ? 2 : 1); break;
      case 'leaves': ctx.fillStyle = Math.sin(p.t * 3) > 0 ? '#7ac850' : '#d8c040'; ctx.fillRect(x, y, 2, 1); ctx.fillRect(x + (Math.sin(p.t * 3) > 0 ? 1 : 0), y + 1, 1, 1); break;
      case 'petals': ctx.fillStyle = '#ffb0c8'; ctx.fillRect(x, y, 2, 1); break;
      case 'fireflies': { const a = (Math.sin(p.t * 3) + 1) / 2; ctx.globalAlpha = a; ctx.fillStyle = '#e8ff8a'; ctx.fillRect(x, y, 1, 1); ctx.globalAlpha = a * 0.3; ctx.fillRect(x - 1, y - 1, 3, 3); ctx.globalAlpha = 1; break; }
      case 'spores': ctx.fillStyle = 'rgba(190,160,255,0.6)'; ctx.fillRect(x, y, 1, 1); break;
      case 'embers': ctx.fillStyle = p.z > 0.7 ? '#ffd25a' : '#ff7a1a'; ctx.fillRect(x, y, 1, 1); break;
      case 'streak': ctx.fillStyle = 'rgba(230,245,255,0.55)'; ctx.fillRect(x, y, 18, 1); break;
    }
  }
}

// ---------------------------------------------------------------------
//  HUD
// ---------------------------------------------------------------------
const HUD_PAUSE = { x: VW - 17, y: 3, w: 14, h: 13 };
function renderHUD() {
  const p = player, L = level;
  // hearts
  for (let i = 0; i < p.maxHearts; i++) {
    const s = i < p.hearts ? ART.heart : ART.heartEmpty;
    const bob = i < p.hearts && p.hearts === 1 ? Math.round(Math.sin(L.time * 10) * 1) : 0;
    spr(s, 5 + i * 11, 5 + bob);
  }
  // gems
  const got = gemsGot();
  spr(ART.gem[0], 5, 16);
  Font.draw(`${got}/${L.gemTotal}`, 20, 18, { color: got >= L.gemTotal ? '#ffd84a' : '#bff6ff', outline: true });
  // power indicator
  const pw = p.char.ability;
  let label = null, ready = true;
  if (pw === 'dash' || pw === 'all') { label = 'DASH'; ready = p.canDash && p.dashCd <= 0; }
  if (pw === 'double') { label = 'FLUTTER'; ready = p.canDouble || p.onGround; }
  if (pw === 'slam') { label = 'SLAM'; ready = !p.onGround && !p.slam; }
  if (label) Font.draw(label, 6, 30, { color: ready ? '#ffd84a' : '#6a6080', outline: true });
  // timer & deaths
  const rx = touchShown ? VW - 40 : HUD_PAUSE.x - 5;
  if (Save.data.settings.timer) Font.draw(formatTime(L.time), rx, 5, { color: '#ffffff', align: 'right', outline: true });
  Font.draw(`☠ ${L.deaths}`, rx, 16, { color: '#c8c0d8', align: 'right', outline: true });
  // pause button
  // small pause button for mouse users (touch devices get a big one from the overlay)
  if (!touchShown) {
    const hb = HUD_PAUSE;
    const hover = Input.pointer.active && rectHit(Input.pointer.x, Input.pointer.y, 1, 1, hb.x, hb.y, hb.w, hb.h);
    ctx.fillStyle = hover ? 'rgba(255,255,255,0.35)' : 'rgba(20,16,32,0.55)'; ctx.fillRect(hb.x, hb.y, hb.w, hb.h);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(hb.x + 4, hb.y + 3, 2, 7); ctx.fillRect(hb.x + 8, hb.y + 3, 2, 7);
    if (Input.pointer.clicked && rectHit(Input.pointer.x, Input.pointer.y, 1, 1, hb.x - 4, hb.y - 4, hb.w + 8, hb.h + 8) && !PlayScreen.cleared) { Input.pointer.clicked = false; Screens.open(PauseScreen); }
  }
  // level name intro
  if (PlayScreen.introT > 0 && Screens.top === PlayScreen) {
    const a = clamp(PlayScreen.introT, 0, 1) * clamp((3.2 - PlayScreen.introT) * 3, 0, 1);
    ctx.globalAlpha = a * 0.7; ctx.fillStyle = '#100c1c'; ctx.fillRect(0, 44, VW, 36); ctx.globalAlpha = 1;
    Font.draw(`LEVEL ${L.idx + 1}`, VW / 2, 49, { color: '#ffd84a', align: 'center', outline: true, alpha: a });
    Font.draw(L.def.name, VW / 2, 60, { color: '#ffffff', align: 'center', outline: true, scale: 2, alpha: a });
  }
  // boss bar
  const boss = enemies.find((e) => e.type === 'boss' && e.state !== 'sleep' && e.alive);
  if (boss) {
    const w = 140, x = VW / 2 - w / 2, y = VH - 14;
    Font.draw('STORMBEAK', VW / 2, y - 10, { color: '#ff9aaa', align: 'center', outline: true });
    ctx.fillStyle = '#100c1c'; ctx.fillRect(x - 2, y - 2, w + 4, 8);
    ctx.fillStyle = '#4a2030'; ctx.fillRect(x, y, w, 4);
    ctx.fillStyle = '#ff3a5a'; ctx.fillRect(x, y, Math.round((w * Math.max(0, boss.hp)) / 3), 4);
    ctx.fillStyle = '#ffb0c0'; ctx.fillRect(x, y, Math.round((w * Math.max(0, boss.hp)) / 3), 1);
  }
  // banners
  fx.banners.forEach((b, i) => {
    const age = b.max - b.t;
    const slide = Math.min(1, age * 5), fade = Math.min(1, b.t * 3);
    const y = 86 + i * 22;
    ctx.globalAlpha = fade * 0.75; ctx.fillStyle = '#100c1c';
    ctx.fillRect(VW / 2 - (VW / 2) * slide, y - 4, VW * slide, 22); ctx.globalAlpha = 1;
    Font.draw(b.text, VW / 2, y, { color: b.col, align: 'center', outline: true, scale: 2, alpha: fade * slide });
  });
  // sign dialog
  if (L.activeSign && !PlayScreen.cleared) drawDialog(L.activeSign.text);
  // gust warning arrows
  const G = L.weather.gust;
  if (G && !G.active && Math.floor(G.t * 6) % 2) Font.draw(G.dir > 0 ? '▶▶▶' : '◀◀◀', G.dir > 0 ? VW - 40 : 12, VH / 2, { color: '#bfe4ff', outline: true, scale: 2 });
}

function drawDialog(text) {
  const w = 300, lines = Font.wrap(text.replace(/\{(\w+)\}/g, (_, k) => keyName(k)), w - 20);
  const h = lines.length * 10 + 12, x = Math.round(VW / 2 - w / 2), y = VH - h - 8;
  ctx.fillStyle = 'rgba(16,12,28,0.88)'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#c88a4a'; ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + h - 1, w, 1); ctx.fillRect(x, y, 1, h); ctx.fillRect(x + w - 1, y, 1, h);
  lines.forEach((l, i) => Font.draw(l, x + 10, y + 7 + i * 10, { color: '#fff4e0', shadow: '#3a2a1a' }));
}

function drawIris(t, cx, cy) {
  if (t >= 1) return;
  const r = easeInOut(t) * Math.hypot(VW, VH);
  ctx.fillStyle = '#0a0812';
  ctx.beginPath();
  ctx.rect(0, 0, VW, VH);
  ctx.arc(cx, cy, Math.max(0.1, r), 0, Math.PI * 2, true);
  ctx.fill('evenodd');
}
