// =====================================================================
//  UI — screen manager, menus, title / map / character / options ...
// =====================================================================
const Screens = {
  stack: [], fade: 0, fadeDir: 0, pending: null,
  get top() { return this.stack[this.stack.length - 1]; },
  go(screen, ...args) {
    if (this.fadeDir === 1) return;
    this.pending = () => { this.stack = [screen]; screen.enter && screen.enter(...args); };
    this.fadeDir = 1;
  },
  now(screen, ...args) { this.stack = [screen]; screen.enter && screen.enter(...args); },
  open(screen, ...args) { this.stack.push(screen); screen.enter && screen.enter(...args); },
  close() { this.stack.pop(); const t = this.top; if (t && t.resume) t.resume(); },
  update(dt) {
    if (this.fadeDir) {
      this.fade = clamp(this.fade + this.fadeDir * dt * 4.5, 0, 1);
      if (this.fadeDir === 1 && this.fade >= 1) { const p = this.pending; this.pending = null; if (p) p(); this.fadeDir = -1; Input.clearAll(); }
      else if (this.fadeDir === -1 && this.fade <= 0) this.fadeDir = 0;
      if (this.fadeDir === 1) return;
    }
    const t = this.top; if (t) t.update(dt);
  },
  render() {
    for (const s of this.stack) s.render();
    if (this.fade > 0) { ctx.globalAlpha = this.fade; ctx.fillStyle = '#0a0812'; ctx.fillRect(0, 0, VW, VH); ctx.globalAlpha = 1; }
  },
};

// ---------------------------------------------------------------------
//  Generic vertical menu (keyboard, gamepad, mouse and touch)
// ---------------------------------------------------------------------
class Menu {
  constructor(items, o = {}) { this.items = items; this.sel = 0; this.o = o; this.rects = []; this.t = 0; }
  get item() { return this.items[this.sel]; }
  move(d) {
    const n = this.items.length;
    for (let i = 0; i < n; i++) { this.sel = (this.sel + d + n) % n; if (!this.items[this.sel].disabled || !this.items[this.sel].disabled()) break; }
    Sound.sfx('move');
  }
  update(dt) {
    this.t += dt;
    const I = Input.pressed, it = this.item;
    if (I.up) this.move(-1);
    if (I.down) this.move(1);
    if (I.left && it.left) { it.left(); Sound.sfx('move'); }
    if (I.right && it.right) { it.right(); Sound.sfx('move'); }
    if (I.confirm && it.act && !(it.disabled && it.disabled())) { Sound.sfx('select'); it.act(); return; }
    const pt = Input.pointer;
    if (pt.moved || pt.clicked) {
      this.rects.forEach((r, i) => {
        if (!rectHit(pt.x, pt.y, 1, 1, r.x, r.y, r.w, r.h)) return;
        if (pt.moved && this.sel !== i) { this.sel = i; Sound.sfx('move'); }
        if (pt.clicked) {
          this.sel = i;
          const item = this.items[i];
          if (item.left && item.right) { if (pt.x < r.x + r.w / 2) item.left(); else item.right(); Sound.sfx('move'); }
          else if (item.act && !(item.disabled && item.disabled())) { Sound.sfx('select'); item.act(); }
          pt.clicked = false;
        }
      });
      pt.moved = false;
    }
  }
  render(cx, y, o = {}) {
    const gap = o.gap || 15;
    this.rects = [];
    this.items.forEach((it, i) => {
      const label = typeof it.label === 'function' ? it.label() : it.label;
      const sel = i === this.sel;
      const dis = it.disabled && it.disabled();
      const yy = y + i * gap;
      const w = Font.width(label) + 24;
      this.rects.push({ x: cx - w / 2, y: yy - 4, w, h: gap - 1 });
      if (sel) {
        ctx.fillStyle = 'rgba(255,216,74,0.12)'; ctx.fillRect(Math.round(cx - w / 2), yy - 3, Math.round(w), 13);
        const bob = Math.round(Math.sin(this.t * 8) * 1.5);
        Font.draw('▶', cx - w / 2 + 2 + bob, yy, { color: '#ffd84a', outline: true });
        Font.draw('◀', cx + w / 2 - 6 - bob, yy, { color: '#ffd84a', outline: true });
      }
      Font.draw(label, cx, yy, { color: dis ? '#6a6080' : sel ? '#ffd84a' : o.color || '#ffffff', align: 'center', outline: true });
    });
  }
}

function panel(x, y, w, h, border = '#4ae0ff', a = 0.86) {
  ctx.fillStyle = `rgba(16,12,28,${a})`; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = border; ctx.fillRect(x + 1, y, w - 2, 1); ctx.fillRect(x + 1, y + h - 1, w - 2, 1); ctx.fillRect(x, y + 1, 1, h - 2); ctx.fillRect(x + w - 1, y + 1, 1, h - 2);
  ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(x + 1, y + 1, w - 2, 1);
}
function hint(text) { Font.draw(text, VW / 2, VH - 11, { color: '#a8a0c0', align: 'center', outline: true }); }
function button(label, x, y, w, onClick, col = '#ffffff') {
  const pt = Input.pointer, h = 13;
  const hover = pt.active && rectHit(pt.x, pt.y, 1, 1, x, y, w, h);
  ctx.fillStyle = hover ? 'rgba(255,216,74,0.25)' : 'rgba(16,12,28,0.7)'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = hover ? '#ffd84a' : '#6a6090'; ctx.fillRect(x, y + h - 1, w, 1);
  Font.draw(label, x + w / 2, y + 3, { color: hover ? '#ffd84a' : col, align: 'center', outline: true });
  if (hover && pt.clicked) { pt.clicked = false; Sound.sfx('select'); onClick(); }
}

// Shared animated scenery for menus
const MenuBG = {
  bg: null, t: 0, x: 0,
  init() { if (!this.bg) this.bg = buildBackground('meadow'); },
  draw(dt = 0, dark = 0.0) {
    this.init();
    this.t += dt; this.x += dt * 14;
    const g = ctx.createLinearGradient(0, 0, 0, VH);
    g.addColorStop(0, '#3f9cf5'); g.addColorStop(1, '#b8e8ff');
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
    ctx.fillStyle = 'rgba(255,255,220,0.3)'; circle(VW - 74, 34, 18); ctx.fillStyle = '#fff4c0'; circle(VW - 74, 34, 12);
    for (let i = 0; i < 6; i++) {
      const c = ART.clouds[i % 4];
      const x = ((i * 97 + this.t * (4 + i)) % (VW + 100)) - 60;
      ctx.drawImage(c, Math.round(x), 12 + ((i * 29) % 60));
    }
    this.bg.layers.forEach((l) => {
      const y = VH - l.c.height + l.yOff;
      const ox = -Math.floor((this.x * l.f * 3) % l.c.width);
      for (let x = ox; x < VW; x += l.c.width) ctx.drawImage(l.c, x, y);
    });
    // grassy foreground strip
    ctx.fillStyle = '#5cc24a'; ctx.fillRect(0, VH - 20, VW, 4);
    ctx.fillStyle = '#a4ec7a'; ctx.fillRect(0, VH - 20, VW, 1);
    ctx.fillStyle = '#8a5a34'; ctx.fillRect(0, VH - 16, VW, 16);
    ctx.fillStyle = '#6a4224'; for (let x = 0; x < VW; x += 7) ctx.fillRect(x + ((x * 13) % 5), VH - 10 + ((x * 7) % 6), 2, 2);
    if (dark) { ctx.fillStyle = `rgba(10,8,20,${dark})`; ctx.fillRect(0, 0, VW, VH); }
  },
};

// ---------------------------------------------------------------------
//  Title
// ---------------------------------------------------------------------
const TitleScreen = {
  started: false, t: 0, hops: [0, 0, 0, 0], hopV: [0, 0, 0, 0],
  enter() {
    this.t = 0;
    this.menu = new Menu([
      { label: () => (Save.data.levels[0] && Save.data.levels[0].done ? 'CONTINUE CLIMB' : 'START CLIMB'), act: () => {
        if (!Save.data.seenIntro) Screens.go(StoryScreen, 'intro'); else Screens.go(MapScreen);
      } },
      { label: 'CHARACTERS', act: () => Screens.go(CharScreen, TitleScreen) },
      { label: 'OPTIONS', act: () => Screens.go(OptionsScreen, TitleScreen) },
      { label: 'HOW TO PLAY', act: () => Screens.go(HowToScreen, TitleScreen) },
    ]);
    if (this.started) Sound.Music.play('title');
    this.menuT = this.fromOpening ? 0 : 1; this.fromOpening = false;
    this.exitT = 0;
  },
  update(dt) {
    this.t += dt;
    if (!this.started) { Screens.now(OpeningScreen); return; }
    this.menuT = Math.min(1, this.menuT + dt * 3);
    this.exitT = Math.max(0, this.exitT - dt);
    if (Input.pressed.back && IS_APP) {
      if (this.exitT > 0) { exitApp(); return; }
      this.exitT = 2; Sound.sfx('back');
    }
    this.menu.update(dt);
    for (let i = 0; i < 4; i++) {
      this.hopV[i] += 700 * dt; this.hops[i] += this.hopV[i] * dt;
      if (this.hops[i] >= 0) { this.hops[i] = 0; this.hopV[i] = Math.random() < 0.012 ? -rand(140, 200) : 0; }
    }
  },
  render() {
    MenuBG.draw(STEP);
    // characters on the grass
    CHARACTERS.slice(0, 4).forEach((c, i) => {
      const F = ART.chars[c.id];
      const s = this.hops[i] < 0 ? F.jump : F.idle[Math.floor(this.t * 2 + i) % 2];
      const x = 46 + i * 30;
      ctx.drawImage(i % 2 ? s.c : s.c, x, VH - 20 - 18 + Math.round(this.hops[i]));
    });
    const sel = ART.chars[Save.data.char] || ART.chars.mossy;
    // logo
    const bob = Math.round(Math.sin(this.t * 2) * 2);
    Font.draw("MOSSY'S", VW / 2, 22 + bob, { color: '#a6f27c', align: 'center', outline: '#13261b', scale: 2 });
    Font.draw('CLIMB', VW / 2, 40 + bob, { color: '#ffd84a', align: 'center', outline: '#3a2408', scale: 4 });
    Font.draw('A VERY TALL ADVENTURE', VW / 2, 74, { color: '#ffffff', align: 'center', outline: true });
    const off = Math.round((1 - easeOutCubic(this.menuT)) * 130);
    panel(VW / 2 - 78, 92 + off, 156, 72, '#ffd84a', 0.72);
    this.menu.render(VW / 2, 100 + off);
    if (this.exitT > 0) Font.draw('PRESS BACK AGAIN TO EXIT', VW / 2, VH - 11, { color: '#ffd84a', align: 'center', outline: true });
    else hint(Input.device === 'touch' ? 'TAP TO CHOOSE' : '▲▼ CHOOSE   ' + keyName('confirm') + ' SELECT');
    Font.draw('V' + APP_VERSION, VW - 5, VH - 10, { color: '#ffffff', align: 'right', alpha: 0.45 });
  },
};

// ---------------------------------------------------------------------
//  Story cards (intro + ending)
// ---------------------------------------------------------------------
const STORY = {
  intro: [
    { art: 'gem', text: 'HIGH ABOVE MOSSY MEADOW SITS THE DAWN GEM.\nEVERY MORNING IT WAKES THE SUN.' },
    { art: 'crow', text: 'BUT ONE STORMY NIGHT, STORMBEAK THE THUNDER CROW\nSTOLE IT AND FLEW TO THE SUMMIT.' },
    { art: 'hero', text: 'NOW EVERY DAY IS A LITTLE DARKER...\nSOMEBODY SMALL WILL HAVE TO CLIMB VERY HIGH.' },
  ],
  ending: [
    { art: 'sunrise', text: 'THE DAWN GEM IS HOME AGAIN.\nTHE SUN RISES OVER MOUNT MOSSMORE!' },
    { art: 'hero', text: 'THEY SAY STORMBEAK NOW SLEEPS BY THE SEA.\nAND THE MEADOW HAS NEVER BEEN BRIGHTER.' },
  ],
};
const StoryScreen = {
  enter(which) { this.which = which; this.cards = STORY[which]; this.i = 0; this.t = 0; if (which === 'ending') Sound.Music.play('victory'); },
  update(dt) {
    this.t += dt;
    const next = Input.pressed.confirm || Input.pressed.jump || Input.pointer.clicked;
    if (Input.pressed.back) { this.finish(); return; }
    if (next && this.t > 0.4) {
      Input.pointer.clicked = false;
      Sound.sfx('select');
      if (this.i < this.cards.length - 1) { this.i++; this.t = 0; } else this.finish();
    }
  },
  finish() {
    if (this.which === 'intro') { Save.data.seenIntro = true; Save.write(); Screens.go(PlayScreen, 0); }
    else Screens.go(CreditsScreen);
  },
  render() {
    const c = this.cards[this.i];
    drawStoryArt(c.art, this.t);
    panel(20, VH - 58, VW - 40, 42, '#ffd84a', 0.85);
    const shown = Math.floor(this.t * 45);
    let n = 0;
    c.text.split('\n').forEach((line, li) => {
      const part = line.slice(0, Math.max(0, shown - n)); n += line.length;
      Font.draw(part, VW / 2 - Font.width(line) / 2, VH - 50 + li * 12, { color: '#fff4e0' });
    });
    if (Math.floor(this.t * 3) % 2) Font.draw('▼', VW - 32, VH - 26, { color: '#ffd84a' });
    Font.draw(`${this.i + 1}/${this.cards.length}`, 26, 8, { color: '#ffffff', outline: true });
    Font.draw(keyName('back') + ' SKIP', VW - 8, 8, { color: '#a8a0c0', align: 'right', outline: true });
  },
};
function drawStoryArt(kind, t) {
  if (kind === 'crow') {
    const g = ctx.createLinearGradient(0, 0, 0, VH); g.addColorStop(0, '#0c1024'); g.addColorStop(1, '#3a3a6a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
    if (Math.sin(t * 3) > 0.95) { ctx.fillStyle = 'rgba(220,230,255,0.4)'; ctx.fillRect(0, 0, VW, VH); }
    drawMountain(0.9);
    const x = 120 + t * 30, y = 60 + Math.sin(t * 3) * 6;
    const s = [ART.boss.up, ART.boss.mid, ART.boss.down, ART.boss.mid][Math.floor(t * 8) % 4];
    ctx.drawImage(s.c, Math.round(x), Math.round(y), 84, 64);
    spr(ART.dawnGem, x + 58, y + 46);
  } else if (kind === 'sunrise') {
    const g = ctx.createLinearGradient(0, 0, 0, VH); g.addColorStop(0, '#ff9a6a'); g.addColorStop(1, '#ffe0a0');
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
    ctx.fillStyle = '#fff0b0'; circle(VW / 2, 120 - Math.min(t, 3) * 20, 26);
    drawMountain(0.4);
    const F = ART.chars[Save.data.char];
    ctx.drawImage(F.jump.c, VW / 2 - 18, 54 - Math.abs(Math.sin(t * 3)) * 10, 36, 38);
    spr(ART.dawnGem, VW / 2 - 8, 30 - Math.abs(Math.sin(t * 3)) * 10);
  } else {
    MenuBG.draw(STEP, kind === 'hero' ? 0.25 : 0);
    if (kind === 'gem') {
      drawMountain(0.2);
      ctx.globalAlpha = 0.4 + Math.sin(t * 3) * 0.15; ctx.fillStyle = '#ffd84a'; circle(VW / 2, 34, 18); ctx.globalAlpha = 1;
      spr(ART.dawnGem, VW / 2 - 8, 26 + Math.sin(t * 2) * 2);
    } else {
      drawMountain(0.5);
      const F = ART.chars[Save.data.char];
      ctx.drawImage(F.idle[Math.floor(t * 2) % 2].c, VW / 2 - 18, VH - 20 - 38, 36, 38);
    }
  }
}
function drawMountain(dark) {
  ctx.fillStyle = mixColor('#7a88d0', '#1a1e38', dark);
  ctx.beginPath(); ctx.moveTo(40, VH); ctx.lineTo(VW / 2 - 20, 40); ctx.lineTo(VW / 2, 28); ctx.lineTo(VW / 2 + 24, 44); ctx.lineTo(VW - 30, VH); ctx.fill();
  ctx.fillStyle = mixColor('#f4f8ff', '#3a3e60', dark);
  ctx.beginPath(); ctx.moveTo(VW / 2 - 20, 40); ctx.lineTo(VW / 2, 28); ctx.lineTo(VW / 2 + 24, 44); ctx.lineTo(VW / 2 + 12, 52); ctx.lineTo(VW / 2 - 2, 46); ctx.lineTo(VW / 2 - 14, 54); ctx.fill();
}

// ---------------------------------------------------------------------
//  Level map — a mountain you climb, one world per altitude band
// ---------------------------------------------------------------------
const MAP_H = 640;
// nodes zig-zag up the mountain (same shape formula as buildMapArt)
const mapShape = (y) => { const k = (y - 40) / (MAP_H - 40); return { half: 18 + k * 178 + Math.sin(y * 0.045) * 9 + Math.sin(y * 0.17) * 3, cx: VW / 2 + 6 + Math.sin(y * 0.012) * 14 }; };
const MAP_NODES = [588, 520, 452, 384, 316, 248, 176, 96].map((y, i) => {
  const m = mapShape(y);
  return [Math.round(m.cx + (i === 7 ? 0 : (i % 2 ? 1 : -1)) * Math.min(m.half * 0.45, 110)), y];
});
const MapScreen = {
  canvas: null,
  enter(sel) {
    if (!this.canvas) this.canvas = buildMapArt();
    this.sel = sel != null ? sel : Math.min(Save.data.unlocked - 1, LEVELS.length - 1);
    this.camY = this.targetY();
    this.t = 0; this.walk = null;
    Sound.Music.play('title');
  },
  targetY() { return clamp(MAP_NODES[this.sel][1] - 118, 0, MAP_H - VH + 66); },
  choose(i) {
    if (i < 0 || i >= LEVELS.length || i === this.sel) return;
    this.walk = { from: this.sel, to: i, t: 0 };
    this.sel = i; Sound.sfx('move');
  },
  play() {
    if (this.sel >= Save.data.unlocked) { Sound.sfx('back'); return; }
    Sound.sfx('select');
    Screens.go(PlayScreen, this.sel);
  },
  update(dt) {
    this.t += dt;
    const I = Input.pressed;
    if (this.walk) { this.walk.t += dt * 4; if (this.walk.t >= 1) this.walk = null; }
    // you may peek at the next locked level, but no further
    const maxSel = Math.min(LEVELS.length - 1, Save.data.unlocked);
    if (I.up || I.right) this.choose(Math.min(this.sel + 1, maxSel));
    if (I.down || I.left) this.choose(this.sel - 1);
    if (I.confirm) this.play();
    if (I.action) Screens.go(CharScreen, MapScreen);
    if (I.back) { Sound.sfx('back'); Screens.go(TitleScreen); }
    const pt = Input.pointer;
    if (pt.clicked) {
      MAP_NODES.forEach(([x, y], i) => {
        if (Math.hypot(pt.x - x, pt.y - (y - this.camY)) < 13) {
          pt.clicked = false;
          if (i === this.sel) this.play(); else if (i <= Math.min(LEVELS.length - 1, Save.data.unlocked)) this.choose(i);
        }
      });
    }
    this.camY = lerp(this.camY, this.targetY(), Math.min(1, dt * 5));
  },
  render() {
    const cy = Math.round(this.camY);
    const alt = 1 - cy / (MAP_H - VH);
    const g = ctx.createLinearGradient(0, 0, 0, VH);
    g.addColorStop(0, mixColor('#5fb0ff', '#0c1024', alt)); g.addColorStop(1, mixColor('#c8ecff', '#3a3a6a', alt));
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
    for (let i = 0; i < 5; i++) {
      const c = ART.clouds[i % 4];
      ctx.globalAlpha = 0.85;
      ctx.drawImage(c, Math.round(((i * 131 + this.t * (5 + i * 2)) % (VW + 100)) - 60), Math.round(((i * 120 + 40) % MAP_H) - cy * 0.6));
      ctx.globalAlpha = 1;
    }
    ctx.drawImage(this.canvas, 0, -cy);
    if (MAP_H - cy < VH) { ctx.fillStyle = '#3a8a3e'; ctx.fillRect(0, MAP_H - cy, VW, VH); }
    // path
    for (let i = 0; i < MAP_NODES.length - 1; i++) {
      const [x0, y0] = MAP_NODES[i], [x1, y1] = MAP_NODES[i + 1];
      const open = i + 1 < Save.data.unlocked;
      for (let s = 0; s < 1; s += 0.04) {
        if (Math.floor(s * 25) % 2) continue;
        const x = lerp(x0, x1, s), y = lerp(y0, y1, s) - Math.sin(s * Math.PI) * 18;
        ctx.fillStyle = open ? '#fff4d0' : 'rgba(255,255,255,0.3)'; ctx.fillRect(Math.round(x), Math.round(y - cy), 2, 2);
      }
    }
    // nodes
    MAP_NODES.forEach(([x, y], i) => {
      const yy = y - cy;
      if (yy < -20 || yy > VH + 20) return;
      const lv = LEVELS[i], save = Save.data.levels[i];
      const locked = i >= Save.data.unlocked;
      const col = locked ? '#5a5470' : save && save.done ? '#ffd84a' : '#ffffff';
      ctx.fillStyle = '#100c1c'; circle(x, yy, 10);
      ctx.fillStyle = locked ? '#2a2638' : THEME_COL[lv.theme]; circle(x, yy, 8);
      ctx.fillStyle = col; ctx.fillRect(x - 8, yy - 1, 1, 2);
      if (locked) Font.draw('¤', x - 2, yy - 3, { color: '#8a84a0', shadow: false });
      else Font.draw(String(i + 1), x, yy - 3, { color: '#ffffff', align: 'center', outline: '#100c1c' });
      if (save && save.done) for (let s = 0; s < 3; s++) Font.draw('★', x - 13 + s * 9, yy + 11, { color: save.stars[s] ? '#ffd84a' : '#3a3450', outline: '#100c1c' });
      if (i === this.sel) {
        ctx.strokeStyle = '#ffd84a'; ctx.lineWidth = 1;
        const r = 12 + Math.sin(this.t * 6) * 1.5;
        ctx.beginPath(); ctx.arc(x + 0.5, yy + 0.5, r, 0, Math.PI * 2); ctx.stroke();
      }
    });
    // the player on the map
    let px, py;
    if (this.walk) {
      const [x0, y0] = MAP_NODES[this.walk.from], [x1, y1] = MAP_NODES[this.walk.to], s = easeInOut(this.walk.t);
      px = lerp(x0, x1, s); py = lerp(y0, y1, s) - Math.sin(s * Math.PI) * 18;
    } else [px, py] = MAP_NODES[this.sel];
    const F = ART.chars[Save.data.char];
    const s = this.walk ? F.run[Math.floor(this.t * 12) % 4] : F.idle[Math.floor(this.t * 2) % 2];
    ctx.drawImage((this.walk ? MAP_NODES[this.walk.to][0] < MAP_NODES[this.walk.from][0] : false) ? s.f : s.c, Math.round(px - 9), Math.round(py - cy - 27));
    // info bar
    const lv = LEVELS[this.sel], save = Save.data.levels[this.sel];
    const locked = this.sel >= Save.data.unlocked;
    const by = VH - 66, tc = THEME_COL[lv.theme];
    ctx.fillStyle = 'rgba(16,12,28,0.86)'; ctx.fillRect(0, by, VW, VH - by);
    ctx.fillStyle = tc; ctx.fillRect(0, by, VW, 1);
    Font.draw(`LEVEL ${this.sel + 1}`, 8, by + 6, { color: tc, outline: true });
    Font.draw(locked ? '???' : lv.name, 56, by + 6, { color: '#ffffff', outline: true });
    if (locked) {
      Font.draw('CLEAR THE LEVEL BELOW TO UNLOCK THIS ONE.', 8, by + 18, { color: '#a8a0c0' });
    } else {
      Font.draw((lv.blurb || '').split('\n').join(' '), 8, by + 18, { color: '#c8c0d8' });
      const total = parseLevelGemTotal(this.sel);
      Font.draw(`◆ ${save ? save.gems.length : 0}/${total}`, 8, by + 30, { color: '#4ae0ff', outline: true });
      Font.draw(`BEST ${save && save.best != null ? formatTime(save.best) : '--:--.--'}`, 64, by + 30, { color: '#ffffff', outline: true });
      Font.draw(`PAR ${formatTime(lv.par, false)}`, 160, by + 30, { color: '#a8a0c0', outline: true });
      Font.draw(`☠ ${save ? save.deaths : 0}`, 222, by + 30, { color: '#c8c0d8', outline: true });
      ['CLEAR', 'GEMS', 'PAR'].forEach((k, s) => {
        const on = save && save.stars[s];
        const x = VW - 130 + s * 42;
        Font.draw('★', x, by + 6, { color: on ? '#ffd84a' : '#3a3450', outline: true });
        Font.draw(k, x + 9, by + 6, { color: on ? '#fff4c0' : '#6a6080' });
      });
    }
    button('◀ BACK', 8, VH - 18, 52, () => Screens.go(TitleScreen));
    button('CHARACTER', VW - 78, VH - 18, 70, () => Screens.go(CharScreen, MapScreen));
    button(locked ? 'LOCKED' : '▶ PLAY', VW / 2 - 30, VH - 18, 60, () => this.play(), locked ? '#6a6080' : '#7aff9a');
    Font.draw('CHOOSE A LEVEL', VW / 2, 6, { color: '#ffd84a', align: 'center', outline: true });
    if (Input.device !== 'touch') Font.draw(`▲▼ MOVE   ${keyName('confirm')} PLAY   ${keyName('action')} CHARACTER   ${keyName('back')} BACK`, VW / 2, 17, { color: '#e8e0ff', align: 'center', outline: true });
  },
};
const THEME_COL = { meadow: '#7ad85a', forest: '#3fbf7a', cave: '#a08aff', magma: '#ff7a3a', ruins: '#e8c070', ice: '#8ad4ff', storm: '#8a9aff', summit: '#ffd84a' };
const _gemTotals = {};
function parseLevelGemTotal(i) {
  if (_gemTotals[i] == null) _gemTotals[i] = LEVELS[i].map.join('').split('').filter((c) => c === '*' || c === 'M').length;
  return _gemTotals[i];
}

function buildMapArt() {
  const B = PixBuf(VW, MAP_H);
  const bands = [
    [560, '#5cc24a', '#4aa83e'], [490, '#2f8a4a', '#287a40'], [420, '#5a5278', '#4a4466'], [350, '#5a3a3a', '#4a2e30'],
    [280, '#c9a66b', '#b08e58'], [200, '#e8f2ff', '#c8daf0'], [120, '#5a6280', '#4a5270'], [0, '#3a3e60', '#2e3250'],
  ];
  const edges = [];
  for (let y = 40; y < MAP_H; y++) {
    const k = (y - 40) / (MAP_H - 40);
    const half = 18 + k * 178 + Math.sin(y * 0.045) * 9 + Math.sin(y * 0.17) * 3;
    const cx = VW / 2 + 6 + Math.sin(y * 0.012) * 14;
    edges[y] = [cx - half, cx + half, cx];
    const bi = bands.findIndex((b) => y >= b[0]);
    // dither into the band above near each boundary
    const above = bands[bi - 1];
    for (let x = Math.max(0, Math.floor(cx - half)); x < Math.min(VW, cx + half); x++) {
      let band = bands[bi];
      if (above && y < bands[bi][0] + 5 && (x + y) % 2 === 0 && y < bands[bi][0] + 1 + (x % 5)) band = above;
      // light from the left: the right flank is in shadow
      const t = (x - (cx - half)) / (2 * half);
      let col = t > 0.62 ? band[2] : band[1];
      if (hash2(x >> 1, y >> 1, 3) < 0.07) col = shade(col, -0.12);
      else if (hash2(x >> 1, y >> 1, 4) < 0.04) col = shade(col, 0.12);
      if (x < cx - half + 2) col = shade(band[1], 0.15);
      if (x > cx + half - 3) col = shade(band[2], -0.35);
      if (y < 58 + Math.sin(x * 0.3) * 3) col = t > 0.62 ? '#d8e4f8' : '#ffffff';
      B.put(x, y, col);
    }
  }
  const inside = (x, y) => edges[y] && x > edges[y][0] + 4 && x < edges[y][1] - 4;
  // little details per altitude band
  const rng = mulberry32(77);
  for (let i = 0; i < 260; i++) {
    const x = Math.floor(rng() * VW), y = 60 + Math.floor(rng() * (MAP_H - 70));
    if (!inside(x, y) || !inside(x + 6, y)) continue;
    if (y >= 490) { // trees
      const c = y >= 560 ? '#3a9a44' : '#1f6a3a';
      B.rect(x + 2, y, 1, 3, '#5a3a20'); B.rect(x + 1, y - 3, 3, 3, c); B.put(x + 2, y - 4, c);
    } else if (y >= 420) { // glowing mushrooms
      if (rng() < 0.4) { B.put(x, y, '#5af0ff'); B.put(x, y + 1, '#c8f0ff'); }
    } else if (y >= 350) { // lava cracks
      if (rng() < 0.5) { B.rect(x, y, 3, 1, '#ff7a1a'); B.put(x + 1, y - 1, '#ffd25a'); }
    } else if (y >= 280) { // ruins
      if (rng() < 0.4) { B.rect(x, y - 4, 2, 5, '#a07c46'); B.rect(x - 1, y - 5, 4, 1, '#e4c58c'); }
    } else if (y >= 200) { // snowy pines
      B.rect(x + 1, y - 3, 3, 3, '#3a5a7a'); B.put(x + 2, y - 4, '#ffffff'); B.put(x + 2, y, '#5a3a20');
    } else if (y >= 120) { // storm towers
      if (rng() < 0.3) { B.rect(x, y - 7, 3, 8, '#2a3048'); B.put(x + 1, y - 5, '#ffd84a'); }
    }
  }
  return B.done();
}

// ---------------------------------------------------------------------
//  Character select
// ---------------------------------------------------------------------
const CharScreen = {
  enter(back) {
    this.back = back || TitleScreen;
    this.i = Math.max(0, CHARACTERS.findIndex((c) => c.id === Save.data.char));
    this.t = 0; this.slide = 0;
  },
  unlocked(c) { return !c.secret || Save.data.secret; },
  update(dt) {
    this.t += dt; this.slide = approach(this.slide, 0, dt * 6);
    const I = Input.pressed, n = CHARACTERS.length;
    if (I.left) { this.i = (this.i - 1 + n) % n; this.slide = -1; Sound.sfx('move'); }
    if (I.right) { this.i = (this.i + 1) % n; this.slide = 1; Sound.sfx('move'); }
    if (I.confirm) this.pick();
    if (I.back) { Sound.sfx('back'); Screens.go(this.back); }
    const pt = Input.pointer;
    if (pt.clicked) {
      if (rectHit(pt.x, pt.y, 1, 1, 8, 60, 40, 60)) { pt.clicked = false; this.i = (this.i - 1 + n) % n; this.slide = -1; Sound.sfx('move'); }
      if (rectHit(pt.x, pt.y, 1, 1, VW - 48, 60, 40, 60)) { pt.clicked = false; this.i = (this.i + 1) % n; this.slide = 1; Sound.sfx('move'); }
    }
  },
  pick() {
    const c = CHARACTERS[this.i];
    if (!this.unlocked(c)) { Sound.sfx('back'); return; }
    Save.data.char = c.id; Save.write();
    Sound.sfx('unlock');
    Screens.go(this.back);
  },
  render() {
    MenuBG.draw(STEP, 0.45);
    const c = CHARACTERS[this.i], open = this.unlocked(c);
    Font.draw('CHOOSE YOUR CLIMBER', VW / 2, 8, { color: '#ffd84a', align: 'center', outline: true, scale: 2 });
    // thumbnails
    CHARACTERS.forEach((ch, i) => {
      const x = VW / 2 - (CHARACTERS.length * 24) / 2 + i * 24 + 3, y = 28;
      ctx.fillStyle = i === this.i ? 'rgba(255,216,74,0.35)' : 'rgba(16,12,28,0.6)'; ctx.fillRect(x - 2, y - 2, 22, 22);
      const s = ART.chars[ch.id].idle[0];
      if (this.unlocked(ch)) ctx.drawImage(s.c, x, y); else ctx.drawImage(silhouetteCached(s, false, '#100c1c'), x, y);
      if (Save.data.char === ch.id) Font.draw('✓', x + 14, y + 13, { color: '#7aff9a', outline: true });
    });
    // big preview
    const F = ART.chars[c.id];
    const frames = [F.idle[0], F.idle[1], F.run[0], F.run[1], F.run[2], F.run[3], F.jump, F.fall];
    const s = frames[Math.floor(this.t * 6) % frames.length];
    const bx = 70 + this.slide * 30;
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(bx + 8, 130, 56, 5);
    ctx.drawImage(open ? s.c : silhouetteCached(s, false, '#100c1c'), Math.round(bx), 58, 72, 76);
    Font.draw('◀', 18, 86, { color: '#ffd84a', outline: true, scale: 2 });
    Font.draw('▶', VW - 30, 86, { color: '#ffd84a', outline: true, scale: 2 });
    // details
    const x = 162;
    panel(x - 8, 54, 196, 112, open ? '#ffd84a' : '#5a5470');
    Font.draw(open ? c.name : '???', x, 61, { color: open ? '#ffffff' : '#6a6080', outline: true, scale: 2 });
    Font.draw(open ? c.species : 'SECRET CLIMBER', x, 79, { color: '#a8a0c0' });
    if (open) {
      const bars = [['SPEED', c.stats.speed], ['JUMP', c.stats.jump], ['WALLS', c.stats.wall], ['HEARTS', c.stats.tough]];
      bars.forEach(([k, v], i) => {
        Font.draw(k, x, 92 + i * 10, { color: '#c8c0d8' });
        for (let j = 0; j < 5; j++) { ctx.fillStyle = j < v ? '#ffd84a' : '#3a3450'; ctx.fillRect(x + 44 + j * 9, 93 + i * 10, 7, 5); }
      });
      Font.draw(`♥×${c.hearts}`, x + 100, 92, { color: '#ff4d6d', outline: true });
      const lines = Font.wrap(c.power, 180);
      lines.forEach((l, i) => Font.draw(l, x, 134 + i * 9, { color: '#7aff9a' }));
    } else {
      Font.draw('REACH THE SUMMIT AND\nDEFEAT STORMBEAK TO\nUNLOCK THIS CLIMBER.', x, 96, { color: '#a8a0c0' });
    }
    Font.draw(open ? `"${c.tagline}"` : '', VW / 2, 172, { color: '#fff4c0', align: 'center', outline: true });
    button('◀ BACK', 8, VH - 22, 52, () => Screens.go(this.back));
    button(open ? 'SELECT' : 'LOCKED', VW / 2 - 30, VH - 22, 60, () => this.pick(), open ? '#7aff9a' : '#6a6080');
    if (Input.device !== 'touch') Font.draw(`◀▶ BROWSE   ${keyName('confirm')} SELECT`, VW - 8, VH - 18, { color: '#a8a0c0', align: 'right', outline: true });
  },
};

// ---------------------------------------------------------------------
//  Options
// ---------------------------------------------------------------------
const OptionsScreen = {
  enter(back) {
    this.back = back || TitleScreen;
    const S = () => Save.data.settings;
    const pct = (v) => `${Math.round(v * 100)}%`;
    const vol = (k, label) => ({
      label: () => `${label}  ◀ ${pct(S()[k])} ▶`,
      left: () => { S()[k] = Math.max(0, Math.round((S()[k] - 0.1) * 10) / 10); Sound.applyVolumes(); Save.write(); },
      right: () => { S()[k] = Math.min(1, Math.round((S()[k] + 0.1) * 10) / 10); Sound.applyVolumes(); Save.write(); },
    });
    const tog = (k, label) => ({ label: () => `${label}: ${S()[k] ? 'ON' : 'OFF'}`, act: () => { S()[k] = !S()[k]; Save.write(); }, left: () => { S()[k] = !S()[k]; Save.write(); }, right: () => { S()[k] = !S()[k]; Save.write(); } });
    const touchModes = ['auto', 'on', 'off'];
    const sizes = [0.85, 1, 1.18];
    const cycleSize = (d) => { const i = sizes.indexOf(S().touchSize); S().touchSize = sizes[(Math.max(0, i) + d + 3) % 3]; Save.write(); };
    this.confirmReset = 0;
    this.menu = new Menu([
      vol('music', 'MUSIC'), vol('sfx', 'SOUND'),
      tog('shake', 'SCREEN SHAKE'), tog('timer', 'SPEEDRUN TIMER'), tog('assist', 'ASSIST (INFINITE ♥)'),
      { label: () => `TOUCH CONTROLS: ${S().touch.toUpperCase()}`, act: () => { S().touch = touchModes[(touchModes.indexOf(S().touch) + 1) % 3]; Save.write(); },
        left: () => { S().touch = touchModes[(touchModes.indexOf(S().touch) + 2) % 3]; Save.write(); }, right: () => { S().touch = touchModes[(touchModes.indexOf(S().touch) + 1) % 3]; Save.write(); } },
      { label: () => `BUTTON SIZE: ${{ 0.85: 'SMALL', 1: 'MEDIUM', 1.18: 'LARGE' }[S().touchSize] || 'MEDIUM'}`, act: () => cycleSize(1), left: () => cycleSize(-1), right: () => cycleSize(1) },
      tog('vibrate', 'VIBRATION'),
      ...(IS_APP ? [] : [{ label: () => (document.fullscreenElement ? 'EXIT FULLSCREEN' : 'FULLSCREEN'), act: () => toggleFullscreen() }]),
      { label: () => (this.confirmReset ? 'REALLY ERASE ALL PROGRESS?' : 'RESET PROGRESS'), act: () => {
        if (!this.confirmReset) { this.confirmReset = 3; return; }
        Save.reset(); this.confirmReset = 0; Sound.sfx('death'); banner('PROGRESS ERASED', '#ff4d6d');
      } },
      { label: 'BACK', act: () => this.leave() },
    ]);
  },
  leave() { Sound.sfx('back'); if (this.back === PauseScreen) Screens.close(); else Screens.go(this.back); },
  update(dt) {
    if (this.confirmReset) { this.confirmReset = Math.max(0, this.confirmReset - dt); }
    if (Input.pressed.back) { this.leave(); return; }
    this.menu.update(dt);
  },
  render() {
    if (this.back !== PauseScreen) MenuBG.draw(STEP, 0.5);
    else { ctx.fillStyle = 'rgba(10,8,20,0.6)'; ctx.fillRect(0, 0, VW, VH); }
    Font.draw('OPTIONS', VW / 2, 9, { color: '#ffd84a', align: 'center', outline: true, scale: 2 });
    panel(VW / 2 - 120, 30, 240, 4 + this.menu.items.length * 14 + 8, '#4ae0ff');
    this.menu.render(VW / 2, 38, { gap: 14 });
    hint('◀▶ CHANGE   ' + keyName('back') + ' BACK');
  },
};

function toggleFullscreen() {
  try {
    if (!document.fullscreenElement) (document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen).call(document.documentElement);
    else document.exitFullscreen();
  } catch (e) { /* not supported */ }
}

// ---------------------------------------------------------------------
//  How to play
// ---------------------------------------------------------------------
const HowToScreen = {
  enter(back) { this.back = back || TitleScreen; this.page = 0; },
  update() {
    const I = Input.pressed;
    if (I.left || I.right) { this.page = 1 - this.page; Sound.sfx('move'); }
    if (I.back || I.confirm) { Sound.sfx('back'); Screens.go(this.back); }
    const pt = Input.pointer;
    if (pt.clicked) { pt.clicked = false; if (pt.y > VH - 26) Screens.go(this.back); else { this.page = 1 - this.page; Sound.sfx('move'); } }
  },
  render() {
    MenuBG.draw(STEP, 0.55);
    Font.draw(this.page ? 'SURVIVAL TIPS' : 'CONTROLS', VW / 2, 10, { color: '#ffd84a', align: 'center', outline: true, scale: 2 });
    panel(16, 30, VW - 32, 156, '#ffd84a');
    const rows = this.page === 0 ? [
      ['MOVE', 'ARROWS / WASD', 'D-PAD / STICK'],
      ['JUMP', 'SPACE / Z / UP', 'A'],
      ['POWER', 'X / SHIFT / J', 'X / B / RB'],
      ['DROP DOWN', 'DOWN + JUMP', 'DOWN + A'],
      ['LOOK DOWN', 'HOLD DOWN', 'HOLD DOWN'],
      ['RETRY', 'R', 'SELECT'],
      ['PAUSE', 'ESC / P', 'START'],
      ['MUTE / FULLSCREEN', 'M / F', ''],
    ] : null;
    if (rows) {
      Font.draw('ACTION', 26, 38, { color: '#a8a0c0' }); Font.draw('KEYBOARD', 140, 38, { color: '#a8a0c0' }); Font.draw('GAMEPAD', 270, 38, { color: '#a8a0c0' });
      rows.forEach(([a, k, g], i) => {
        const y = 52 + i * 14;
        Font.draw(a, 26, y, { color: '#ffffff' }); Font.draw(k, 140, y, { color: '#ffd84a' }); Font.draw(g, 270, y, { color: '#4ae0ff' });
      });
      Font.draw('ON PHONES: USE THE ON-SCREEN BUTTONS.', VW / 2, 168, { color: '#7aff9a', align: 'center' });
    } else {
      const tips = [
        'HOLD JUMP TO JUMP HIGHER. TAP FOR A SMALL HOP.',
        'SLIDE DOWN WALLS AND JUMP OFF THEM TO CLIMB.',
        'STOMP ENEMIES - BUT NEVER STOMP A SPIKY ONE.',
        'SPIKES AND PITS COST 1 ♥ AND SEND YOU BACK.',
        'CHECKPOINT FLAGS SAVE YOUR SPOT AND REFILL ♥.',
        'GEMS THAT RUN AWAY CAN BE CAUGHT. GO GET THEM!',
        'CRACKED GROUND MAY NOT HOLD YOUR WEIGHT...',
        'THE MOUNTAIN IS FULL OF SURPRISES. STAY SHARP!',
      ];
      tips.forEach((t, i) => Font.draw('★ ' + t, 28, 42 + i * 17, { color: i % 2 ? '#fff4c0' : '#ffffff' }));
    }
    hint(`◀▶ PAGE ${this.page + 1}/2   ${keyName('back')} BACK`);
  },
};

// ---------------------------------------------------------------------
//  Pause (overlay on top of the play screen)
// ---------------------------------------------------------------------
const PauseScreen = {
  enter() {
    Sound.sfx('pause'); Sound.Music.duck(true);
    this.menu = new Menu([
      { label: 'RESUME', act: () => this.resumeGame() },
      { label: 'RETRY FROM CHECKPOINT', act: () => { this.resumeGame(); iris.dir = -1; iris.cx = VW / 2; iris.cy = VH / 2; iris.cb = () => respawnAtCheckpoint(); } },
      { label: 'RESTART LEVEL', act: () => { Sound.Music.duck(false); Screens.go(PlayScreen, PlayScreen.levelIdx); } },
      { label: 'OPTIONS', act: () => Screens.open(OptionsScreen, PauseScreen) },
      { label: 'LEVEL MAP', act: () => { Sound.Music.duck(false); Screens.go(MapScreen, PlayScreen.levelIdx); } },
    ]);
  },
  resume() { },
  resumeGame() { Sound.Music.duck(false); Screens.close(); Input.clearAll(); },
  update(dt) {
    if (Input.pressed.back || (Input.pressed.pause && !Input.pressed.confirm)) { this.resumeGame(); return; }
    this.menu.update(dt);
  },
  render() {
    ctx.fillStyle = 'rgba(10,8,20,0.65)'; ctx.fillRect(0, 0, VW, VH);
    Font.draw('PAUSED', VW / 2, 22, { color: '#ffd84a', align: 'center', outline: true, scale: 2 });
    Font.draw(`LEVEL ${level.idx + 1}: ${level.def.name}`, VW / 2, 42, { color: '#ffffff', align: 'center', outline: true });
    Font.draw(`⏱ ${formatTime(level.time)}    ◆ ${gemsGot()}/${level.gemTotal}    ☠ ${level.deaths}`, VW / 2, 54, { color: '#c8c0d8', align: 'center', outline: true });
    panel(VW / 2 - 90, 70, 180, 84, '#ffd84a');
    this.menu.render(VW / 2, 78);
    hint(`${keyName('pause')} RESUME`);
  },
};

// ---------------------------------------------------------------------
//  Level clear
// ---------------------------------------------------------------------
const ClearScreen = {
  enter() {
    this.t = 0;
    const R = PlayScreen.result;
    const last = PlayScreen.levelIdx >= LEVELS.length - 1;
    this.menu = new Menu([
      { label: last ? 'SEE THE ENDING' : 'NEXT LEVEL', act: () => (last ? Screens.go(StoryScreen, 'ending') : Screens.go(PlayScreen, PlayScreen.levelIdx + 1)) },
      { label: 'PLAY AGAIN', act: () => Screens.go(PlayScreen, PlayScreen.levelIdx) },
      { label: 'LEVEL MAP', act: () => Screens.go(MapScreen, Math.min(PlayScreen.levelIdx + (last ? 0 : 1), LEVELS.length - 1)) },
    ]);
    this.R = R;
    this.starSounds = 0;
  },
  update(dt) {
    this.t += dt;
    PlayScreen.updateCleared(dt);
    const starTimes = [1.0, 1.35, 1.7];
    while (this.starSounds < 3 && this.t > starTimes[this.starSounds]) { if (this.R.stars[this.starSounds]) Sound.sfx('checkpoint'); this.starSounds++; }
    if (this.t > 0.6) this.menu.update(dt);
    else if (Input.pressed.confirm) this.t = 2;
  },
  render() {
    const R = this.R, t = this.t;
    const a = Math.min(1, t * 3);
    ctx.globalAlpha = a; ctx.fillStyle = 'rgba(10,8,20,0.6)'; ctx.fillRect(0, 0, VW, VH); ctx.globalAlpha = 1;
    const y0 = Math.round(lerp(-120, 14, easeOutBack(Math.min(1, t * 2.2))));
    panel(VW / 2 - 118, y0, 236, 188, '#ffd84a');
    Font.draw(PlayScreen.levelIdx === LEVELS.length - 1 ? 'SUMMIT REACHED!' : 'LEVEL CLEAR!', VW / 2, y0 + 8, { color: '#ffd84a', align: 'center', outline: true, scale: 2 });
    Font.draw(level.def.name, VW / 2, y0 + 26, { color: '#ffffff', align: 'center', outline: true });
    const count = (v, start) => Math.round(v * clamp((t - start) * 2.5, 0, 1));
    const rows = [
      ['TIME', formatTime(R.time * clamp((t - 0.3) * 2.5, 0, 1)) + (R.newBest && t > 0.7 ? '  NEW BEST!' : ''), '#ffffff'],
      ['GEMS', `${count(R.gems, 0.4)} / ${R.total}` + (R.gems >= R.total ? '  ALL!' : ''), '#4ae0ff'],
      ['DEATHS', `${count(R.deaths, 0.5)}`, '#c8c0d8'],
      ['FOES BONKED', `${count(R.kills, 0.6)}`, '#ff9a6a'],
      ['SECRETS', `${R.secrets} / ${R.secretTotal}`, '#7aff9a'],
    ].filter((r) => r[0] !== 'SECRETS' || R.secretTotal > 0);
    rows.forEach(([k, v, c], i) => {
      Font.draw(k, VW / 2 - 100, y0 + 42 + i * 11, { color: '#a8a0c0' });
      Font.draw(v, VW / 2 + 100, y0 + 42 + i * 11, { color: c, align: 'right', outline: true });
    });
    const labels = ['CLEAR', 'ALL GEMS', `UNDER ${formatTime(level.def.par, false)}`];
    for (let s = 0; s < 3; s++) {
      const st = [1.0, 1.35, 1.7][s];
      const on = R.stars[s] && t > st;
      const sc = on ? 1 + Math.max(0, 0.5 - (t - st)) * 2 : 1;
      const x = VW / 2 - 70 + s * 70;
      Font.draw('★', x, y0 + 100 - (sc - 1) * 6, { color: on ? '#ffd84a' : '#3a3450', align: 'center', outline: true, scale: sc > 1.2 ? 3 : 2 });
      Font.draw(labels[s], x, y0 + 118, { color: on ? '#fff4c0' : '#6a6080', align: 'center' });
    }
    if (R.unlockedChar && t > 2) Font.draw('NEW CLIMBER UNLOCKED: GOLDEN MOSSY!', VW / 2, y0 + 130, { color: '#ffd84a', align: 'center', outline: true });
    else if (R.unlockedLevel && t > 2) Font.draw('NEXT LEVEL UNLOCKED - KEEP CLIMBING!', VW / 2, y0 + 130, { color: '#7aff9a', align: 'center', outline: true });
    if (t > 0.6) this.menu.render(VW / 2, y0 + 144, { gap: 13 });
  },
};

// ---------------------------------------------------------------------
//  Credits / final results
// ---------------------------------------------------------------------
const CreditsScreen = {
  enter() { this.t = 0; Sound.Music.play('victory'); },
  update(dt) {
    this.t += dt;
    if ((Input.pressed.confirm || Input.pressed.back || Input.pointer.clicked) && this.t > 1.5) { Input.pointer.clicked = false; Screens.go(TitleScreen); }
  },
  render() {
    const g = ctx.createLinearGradient(0, 0, 0, VH); g.addColorStop(0, '#ff9a6a'); g.addColorStop(1, '#ffe0a0');
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
    drawMountain(0.35);
    let gems = 0, total = 0, best = 0, deaths = Save.data.totalDeaths, stars = 0;
    LEVELS.forEach((_, i) => { const s = Save.data.levels[i]; total += parseLevelGemTotal(i); if (s) { gems += s.gems.length; best += s.best || 0; stars += s.stars.filter(Boolean).length; } });
    panel(VW / 2 - 130, 22, 260, 160, '#ffd84a');
    Font.draw('THANK YOU FOR CLIMBING!', VW / 2, 32, { color: '#ffd84a', align: 'center', outline: true, scale: 2 });
    const lines = [
      ['TOTAL GEMS', `${gems} / ${total}`], ['STARS', `${stars} / ${LEVELS.length * 3}`], ['BEST TIMES SUM', formatTime(best)], ['TOTAL TUMBLES', String(deaths)],
    ];
    lines.forEach(([k, v], i) => { Font.draw(k, VW / 2 - 110, 60 + i * 13, { color: '#c8c0d8' }); Font.draw(v, VW / 2 + 110, 60 + i * 13, { color: '#ffffff', align: 'right', outline: true }); });
    Font.draw('GOLDEN MOSSY IS NOW PLAYABLE!', VW / 2, 120, { color: '#ffd84a', align: 'center', outline: true });
    Font.draw('CAN YOU COLLECT EVERY GEM AND STAR?', VW / 2, 134, { color: '#fff4c0', align: 'center' });
    Font.draw('A GAME ABOUT CLIMBING HIGHER.', VW / 2, 156, { color: '#a8a0c0', align: 'center' });
    CHARACTERS.forEach((c, i) => { const F = ART.chars[c.id]; ctx.drawImage(F.idle[Math.floor(this.t * 2 + i) % 2].c, VW / 2 - 55 + i * 22, 186 - Math.abs(Math.sin(this.t * 4 + i)) * 8); });
    if (this.t > 1.5 && Math.floor(this.t * 2) % 2) hint(Input.device === 'touch' ? 'TAP TO CONTINUE' : 'PRESS ' + keyName('confirm'));
  },
};

// ---------------------------------------------------------------------
//  Boot, scaling, touch overlay, main loop
// ---------------------------------------------------------------------
function resize() {
  const ww = window.innerWidth, wh = window.innerHeight;
  const s = Math.min(ww / VW, wh / VH);
  const si = Math.floor(s);
  const scale = si >= 2 && s - si < 0.25 ? si : s;
  canvas.style.width = Math.floor(VW * scale) + 'px';
  canvas.style.height = Math.floor(VH * scale) + 'px';
}
window.addEventListener('resize', resize);

const touchEl = document.getElementById('touch');
Input.bindTouchPad(touchEl);
let touchShown = false;
function updateTouchVisibility() {
  if (!touchEl) return;
  const S = Save.data.settings;
  const want = S.touch === 'on' || (S.touch === 'auto' && (Input.device === 'touch' || (Input.hasTouch && Input.device !== 'kb' && Input.device !== 'pad')));
  const show = want && Screens.top === PlayScreen && !PlayScreen.cleared && Screens.fadeDir !== 1;
  if (show !== touchShown) {
    touchShown = show;
    touchEl.classList.toggle('show', show);
    if (!show) { Input.releaseTouches(); for (const b of touchEl.querySelectorAll('.on')) b.classList.remove('on'); }
  }
  touchEl.style.setProperty('--s', String(S.touchSize || 1));
  const abil = document.getElementById('b-act');
  if (abil) abil.style.visibility = player.char && player.char.ability !== 'grip' ? 'visible' : 'hidden';
}

// ---------------------------------------------------------------------
//  Running inside the Android / desktop app (Tauri)
// ---------------------------------------------------------------------
const TAURI = window.__TAURI__ || null;
const IS_APP = !!TAURI;
const APP_VERSION = '__APP_VERSION__';
function exitApp() {
  try { if (TAURI && TAURI.app && TAURI.app.exit) { TAURI.app.exit(0); return; } } catch (e) { /* fall through */ }
  try { if (TAURI && TAURI.process && TAURI.process.exit) TAURI.process.exit(0); } catch (e) { /* nothing else to do */ }
}
// Android back button: behave like Escape (pause in game, back in menus) instead of quitting
function hookBackButton() {
  try {
    if (TAURI && TAURI.app && typeof TAURI.app.onBackButtonPress === 'function') {
      TAURI.app.onBackButtonPress(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' }));
        setTimeout(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Escape' })), 60);
      });
    }
  } catch (e) { /* not available: default back behaviour */ }
}

function pauseIfPlaying() { if (Screens.top === PlayScreen && !PlayScreen.cleared) Screens.open(PauseScreen); }
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { pauseIfPlaying(); Sound.suspend(); } else Sound.resume();
});
window.addEventListener('blur', pauseIfPlaying);

let lastT = performance.now(), acc = 0;
function frame(now) {
  let ft = (now - lastT) / 1000; lastT = now;
  if (ft > 0.25) ft = 0.25;
  acc += ft;
  let steps = 0;
  while (acc >= STEP && steps < 5) {
    Input.poll();
    if (Input.pressed.mute) {
      const s = Save.data.settings;
      if (s.music > 0 || s.sfx > 0) { s._m = s.music; s._s = s.sfx; s.music = 0; s.sfx = 0; } else { s.music = s._m || 0.55; s.sfx = s._s || 0.8; }
      Sound.applyVolumes(); Save.write();
    }
    if (Input.pressed.fullscreen) toggleFullscreen();
    if (Input.any) Sound.init();
    Screens.update(STEP);
    acc -= STEP; steps++;
  }
  if (steps === 5) acc = 0;
  // on 90/120Hz screens many frames have no new game step: skip the redraw to save battery
  if (steps > 0) { Screens.render(); updateTouchVisibility(); }
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------------
//  Boot behind the loading screen
// ---------------------------------------------------------------------
function setLoad(p, msg) {
  const f = document.getElementById('ld-fill'), m = document.getElementById('ld-msg');
  if (f) f.style.width = Math.round(p * 100) + '%';
  if (m && msg) m.textContent = msg;
}
// let the loader paint between heavy steps (falls back to a timer if rAF is paused)
const nextPaint = () => new Promise((res) => {
  let done = false;
  const go = () => { if (!done) { done = true; res(); } };
  requestAnimationFrame(() => setTimeout(go, 0));
  setTimeout(go, 100);
});

async function boot() {
  const t0 = performance.now();
  resize();
  setLoad(0.12, 'Waking up Mossy'); await nextPaint();
  buildArt();
  setLoad(0.42, 'Painting the mountain'); await nextPaint();
  MenuBG.init(); MapScreen.canvas = buildMapArt();
  setLoad(0.7, 'Gathering storm clouds'); await nextPaint();
  OpeningScreen.prepare();
  setLoad(0.9, 'Tuning the birds'); await nextPaint();
  hookBackButton();
  const q = new URLSearchParams(location.search);
  if (q.has('level')) {
    Sound.init();
    Screens.now(PlayScreen, clamp(parseInt(q.get('level'), 10) - 1, 0, LEVELS.length - 1));
  } else if (q.has('sprites')) {
    Screens.now(SpriteSheetScreen);
  } else Screens.now(OpeningScreen);
  if (q.has('debug')) exposeDebug();
  setLoad(1, 'Ready!');
  // keep the loader up long enough to be seen, never longer than needed
  await new Promise((r) => setTimeout(r, Math.max(0, 900 - (performance.now() - t0))));
  const ld = document.getElementById('loader');
  if (ld) { ld.classList.add('done'); setTimeout(() => ld.remove(), 600); }
  lastT = performance.now();
  requestAnimationFrame(frame);
}

// ?debug: drive the game deterministically from the console / tests
function exposeDebug() {
  const send = (type, code) => window.dispatchEvent(new KeyboardEvent(type, { code }));
  window.MC = {
    get level() { return level; }, player, enemies: () => enemies, Screens, PlayScreen, MapScreen, TitleScreen, OpeningScreen, OptionsScreen, Save, cam, fx, LEVELS,
    play(i) { Sound.init(); Screens.now(PlayScreen, i); this.step(1); },
    step(n = 1) { for (let i = 0; i < n; i++) { Input.poll(); Screens.update(STEP); } Screens.render(); updateTouchVisibility(); return { x: player.x, y: player.y, dead: player.dead, hearts: player.hearts, screen: Screens.top && Object.keys(window.MC).find((k) => window.MC[k] === Screens.top) }; },
    down(code) { send('keydown', code); }, up(code) { send('keyup', code); },
    tap(code, n = 1) { send('keydown', code); this.step(n); send('keyup', code); return this.step(1); },
    hold(code, n) { send('keydown', code); const r = this.step(n); send('keyup', code); return r; },
    tp(tx, ty) { placePlayer(tx * TS + 3, ty * TS + TS - player.h); updateCamera(0, true); return this.step(1); },
  };
}

// developer view: ?sprites
const SpriteSheetScreen = {
  update() {},
  render() {
    ctx.fillStyle = '#5a6a8a'; ctx.fillRect(0, 0, VW, VH);
    let x = 4, y = 4, rowH = 0;
    const put = (s) => {
      const img = s.c || s;
      if (x + img.width + 4 > VW) { x = 4; y += rowH + 4; rowH = 0; }
      ctx.drawImage(img, x, y); x += img.width + 4; rowH = Math.max(rowH, img.height);
    };
    for (const id in ART.chars) { const F = ART.chars[id]; [...F.idle, ...F.run, F.jump, F.fall, F.crouch].forEach(put); }
    ['beetle', 'spiny', 'bat', 'plant', 'wasp', 'slime', 'gem', 'mimic', 'spring', 'crusher'].forEach((k) => ART[k].forEach(put));
    [ART.batHang, ART.heart, ART.heartEmpty, ART.sign, ART.rock, ART.seed, ART.feather, ART.dawnGem].forEach(put);
    Object.values(ART.boss).forEach(put);
    ART.boulder.slice(0, 2).forEach(put); ART.clouds.forEach(put);
  },
};
