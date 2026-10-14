// =====================================================================
//  OPENING — "tap to start" over the night summit, then a short cinematic:
//  the Dawn Gem glows, Stormbeak steals it, the camera drops down the mountain
//  to Mossy and friends, and the logo slams in. Any tap skips.
// =====================================================================
const OP_H = VH * 3;                // the scene is three screens tall
const OP_PEAK = { x: 0, y: 64 };
const OP_END = 8.8;

const OpeningScreen = {
  canvas: null, t: 0, state: 'wait', rain: [], dust: [], shake: 0, flash: 0,

  // the mountain is painted once into a tall pixel buffer
  prepare() {
    if (this.canvas) return;
    OP_PEAK.x = Math.round(VW * 0.56);
    const B = PixBuf(VW, OP_H);
    const rng = mulberry32(5);
    const nL = periodicNoise(rng, 24), nR = periodicNoise(rng, 24), nS = periodicNoise(rng, 16);
    for (let y = OP_PEAK.y; y < OP_H; y++) {
      const d = y - OP_PEAK.y;
      const xl = OP_PEAK.x - d * 0.62 - nL(d * 0.05) * 14 * Math.min(1, d / 60);
      const xr = OP_PEAK.x + d * 0.7 + nR(d * 0.05) * 14 * Math.min(1, d / 60);
      const ridge = OP_PEAK.x + d * 0.12 + Math.sin(d * 0.03) * 6;
      const snowLine = 64 + nS((OP_PEAK.x) * 0.02) * 10;
      for (let x = Math.max(0, Math.floor(xl)); x < Math.min(VW, xr); x++) {
        const shadow = x > ridge;
        const k = clamp((y - 330) / 260, 0, 1);   // greener toward the foot
        let col = shadow ? mixColor('#5a64a8', '#2f6a4a', k) : mixColor('#8090d8', '#4a9a5a', k);
        if (hash2(x >> 1, y >> 1, 9) < 0.06) col = shade(col, -0.12);
        const snowEdge = snowLine + nS(x * 0.08) * 16;
        if (d < snowEdge) col = shadow ? '#c8d4f0' : '#f4f8ff';
        if (x < xl + 1.5 || x > xr - 1.5) col = shade(col, -0.35);
        B.put(x, y, col);
      }
    }
    // a few pines on the lower slopes
    for (let i = 0; i < 70; i++) {
      const y = 380 + Math.floor(rng() * 240), d = y - OP_PEAK.y;
      const x = Math.floor(OP_PEAK.x - d * 0.55 + rng() * d * 1.2);
      if (x < 2 || x > VW - 4) continue;
      B.rect(x + 1, y - 4, 1, 1, '#1f5a34'); B.rect(x, y - 3, 3, 2, '#2a6a3e'); B.rect(x + 1, y - 1, 1, 2, '#4a3020');
    }
    this.canvas = B.done();
    this.bg = buildBackground('meadow');
  },

  enter() {
    this.prepare();
    this.t = 0; this.state = 'wait'; this.rain = []; this.dust = []; this.shake = 0; this.flash = 0;
    this.played = {};
  },

  begin() {
    Sound.init();
    this.state = 'play'; this.t = 0;
    Sound.sfx('rumble');
  },

  finish() {
    TitleScreen.started = true;
    TitleScreen.fromOpening = true;
    Screens.now(TitleScreen);
  },

  cue(name, at, fn) { if (this.t >= at && !this.played[name]) { this.played[name] = true; fn(); } },

  update(dt) {
    if (this.state === 'wait') {
      this.t += dt;
      if (Input.any && this.t > 0.25) { Input.clearAll(); this.begin(); }
      return;
    }
    this.t += dt;
    const t = this.t;
    if (Input.any && t > 0.5) { Input.clearAll(); Sound.Music.play('title'); this.finish(); return; }
    this.cue('bolt', 2.35, () => { this.flash = 1; Sound.sfx('thunder'); this.shake = 3; });
    this.cue('screech', 2.7, () => Sound.sfx('screech'));
    this.cue('grab', 3.45, () => { Sound.sfx('nope'); this.shake = 2; });
    this.cue('bolt2', 4.2, () => { this.flash = 0.7; Sound.sfx('thunder'); });
    this.cue('bang', 6.9, () => Sound.sfx('pop'));
    this.cue('logo1', 7.45, () => { Sound.sfx('land'); this.shake = 2; });
    this.cue('logo2', 7.85, () => {
      Sound.sfx('slam'); this.shake = 6; Sound.Music.play('title');
      for (let i = 0; i < 40; i++) this.dust.push({ x: VW / 2 + rand(-90, 90), y: 64 + rand(-4, 6), vx: rand(-90, 90), vy: rand(-80, 10), life: rand(0.4, 0.9) });
    });
    if (t >= OP_END) { this.finish(); return; }
    this.shake = Math.max(0, this.shake - dt * 10);
    this.flash = Math.max(0, this.flash - dt * 2.2);
    // rain while the storm is up
    const storm = this.storm();
    if (storm > 0.2 && this.rain.length < 120 * storm) this.rain.push({ x: rand(-20, VW + 20), y: rand(-20, 0), v: rand(260, 360) });
    for (const r of this.rain) { r.x -= 70 * dt; r.y += r.v * dt; }
    this.rain = this.rain.filter((r) => r.y < VH + 10 && (storm > 0.1 || Math.random() > 0.05));
    for (const d of this.dust) { d.vy += 240 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.life -= dt; }
    this.dust = this.dust.filter((d) => d.life > 0);
  },

  storm() { const t = this.t; if (this.state === 'wait') return 0; return clamp((t - 2.35) / 0.8, 0, 1) * (1 - clamp((t - 7.85) / 0.6, 0, 1)); },
  camY() { return this.state === 'wait' ? 0 : easeInOut(clamp((this.t - 4.6) / 1.9, 0, 1)) * (OP_H - VH); },

  render() {
    const t = this.t, storm = this.storm(), camY = Math.round(this.camY());
    const clear = this.state === 'wait' ? 0 : clamp((t - 7.85) / 0.6, 0, 1);
    const sx = this.shake ? Math.round(rand(-this.shake, this.shake)) : 0, sy = this.shake ? Math.round(rand(-this.shake, this.shake)) : 0;
    // sky: night (waiting) -> dawn -> storm -> bright morning
    const dawn = this.state === 'wait' ? 0 : clamp(t / 1.2, 0, 1);
    let top = mixColor('#0c0a24', '#3a2a6a', dawn), bot = mixColor('#1c1840', '#ff9a6a', dawn);
    top = mixColor(top, '#0a0c18', storm); bot = mixColor(bot, '#262a46', storm);
    top = mixColor(top, '#3f9cf5', clear); bot = mixColor(bot, '#b8e8ff', clear);
    const g = ctx.createLinearGradient(0, 0, 0, VH); g.addColorStop(0, top); g.addColorStop(1, bot);
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
    // stars fade with the dawn
    const starA = (1 - dawn) * 0.9 + 0.1 * (1 - storm);
    for (let i = 0; i < 50; i++) {
      const x = (i * 97 + 13) % VW, y = ((i * 53) % 150) - camY * 0.1;
      if (y < 0 || Math.sin(t * 2 + i) > 0.7) continue;
      ctx.globalAlpha = starA * (1 - clear); ctx.fillStyle = '#ffffff'; ctx.fillRect(x, Math.round(y), 1, 1);
    }
    ctx.globalAlpha = 1;
    // morning sun
    if (clear > 0) { ctx.globalAlpha = clear; ctx.fillStyle = 'rgba(255,255,220,0.3)'; circle(VW - 74, 34, 18); ctx.fillStyle = '#fff4c0'; circle(VW - 74, 34, 12); ctx.globalAlpha = 1; }
    ctx.save(); ctx.translate(sx, sy - camY);
    ctx.globalAlpha = 1 - clear;
    ctx.drawImage(this.canvas, 0, 0);
    ctx.globalAlpha = 1;
    // the Dawn Gem on the summit (until it's stolen)
    const gemX = OP_PEAK.x - 8, gemY = OP_PEAK.y - 18;
    const bird = this.birdPos();
    const stolen = this.state === 'play' && t >= 3.45;
    if (!stolen) {
      const pulse = 0.5 + Math.sin(t * 3) * 0.2;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.16 * pulse * (1 - storm * 0.5); ctx.fillStyle = '#ffb040'; circle(OP_PEAK.x, gemY + 7, 30);
      ctx.globalAlpha = 0.22 * pulse * (1 - storm * 0.5); circle(OP_PEAK.x, gemY + 7, 17);
      ctx.globalAlpha = 0.55; ctx.fillStyle = '#fff4b0';
      for (let i = 0; i < 8; i++) {
        const a = t * 0.6 + (i * Math.PI) / 4, len = 18 + Math.sin(t * 4 + i) * 4;
        for (let r = 12; r < 12 + len; r += 2) ctx.fillRect(Math.round(OP_PEAK.x + Math.cos(a) * r), Math.round(gemY + 7 + Math.sin(a) * r), 1, 1);
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      spr(ART.dawnGem, gemX, gemY + Math.round(Math.sin(t * 2) * 1.5));
    }
    // meadow at the foot of the mountain
    // (same layers, positions and scroll as the title screen, so the hand-off is seamless)
    MenuBG.x += STEP * 14 * (this.state === 'play' ? 1 : 0);
    for (const l of MenuBG.bg.layers) {
      const y = OP_H - l.c.height + l.yOff;
      const ox = -Math.floor((MenuBG.x * l.f * 3) % l.c.width);
      for (let x = ox; x < VW; x += l.c.width) ctx.drawImage(l.c, x, y);
    }
    ctx.fillStyle = '#5cc24a'; ctx.fillRect(0, OP_H - 20, VW, 4); ctx.fillStyle = '#a4ec7a'; ctx.fillRect(0, OP_H - 20, VW, 1);
    ctx.fillStyle = '#8a5a34'; ctx.fillRect(0, OP_H - 16, VW, 16);
    // the heroes run in and look up
    if (this.state === 'play' && t > 5.9) {
      CHARACTERS.slice(0, 4).forEach((c, i) => {
        const F = ART.chars[c.id];
        const start = 5.9 + i * 0.18, k = clamp((t - start) / 0.9, 0, 1);
        const x = Math.round(lerp(-30 - i * 18, 46 + i * 30, easeOutCubic(k)));
        const running = k < 1;
        const look = t > 6.9;
        const s = running ? F.run[Math.floor(t * 12 + i) % 4] : look && i === 0 && t < 7.4 ? F.jump : F.idle[Math.floor(t * 2 + i) % 2];
        const hop = i === 0 && look && t < 7.4 ? -Math.round(Math.sin(clamp((t - 6.9) / 0.5, 0, 1) * Math.PI) * 10) : 0;
        ctx.drawImage(s.c, x, OP_H - 20 - 18 + hop);
        if (i === 0 && t > 6.9 && t < 7.6) Font.draw('!', x + 7, OP_H - 52 + hop, { color: '#ffd84a', outline: true, scale: 2 });
      });
    }
    ctx.restore();
    if (storm > 0) { ctx.globalAlpha = storm * 0.38; ctx.fillStyle = '#0a0c1e'; ctx.fillRect(0, 0, VW, VH); ctx.globalAlpha = 1; }
    // Stormbeak (screen space so it can fly off the top)
    if (bird) {
      const set = ART.boss;
      const s = [set.up, set.mid, set.down, set.mid][Math.floor(t * 12) % 4];
      const w = s.c.width * 2, h = s.c.height * 2;
      const img = bird.flip ? s.f : s.c;
      ctx.drawImage(img, Math.round(bird.x - w / 2 + sx), Math.round(bird.y - h / 2 + sy - camY), w, h);
      if (stolen) spr(ART.dawnGem, bird.x - 8 + sx, bird.y + 18 + sy - camY);
    }
    // rain + lightning
    ctx.fillStyle = 'rgba(170,200,255,0.55)';
    for (const r of this.rain) ctx.fillRect(Math.round(r.x), Math.round(r.y), 1, 6);
    if (this.flash > 0) { ctx.globalAlpha = Math.min(0.8, this.flash); ctx.fillStyle = '#eef2ff'; ctx.fillRect(0, 0, VW, VH); ctx.globalAlpha = 1; }
    // captions
    const caps = [[0.4, 2.3, 'HIGH ATOP MOUNT MOSSMORE GLOWS THE DAWN GEM.'], [2.6, 4.5, 'UNTIL ONE NIGHT, STORMBEAK SNATCHED IT AWAY!'], [4.8, 6.8, 'NOW SOMEONE SMALL HAS TO CLIMB VERY HIGH...']];
    if (this.state === 'play') for (const [a, b, text] of caps) {
      if (t < a || t > b) continue;
      const al = clamp((t - a) * 4, 0, 1) * clamp((b - t) * 4, 0, 1);
      ctx.globalAlpha = al * 0.7; ctx.fillStyle = '#0a0812'; ctx.fillRect(0, VH - 30, VW, 20); ctx.globalAlpha = 1;
      Font.draw(text.slice(0, Math.floor((t - a) * 40)), VW / 2, VH - 24, { color: '#fff4e0', align: 'center', alpha: al });
    }
    // logo slam
    if (this.state === 'play' && t > 7.2) {
      const k1 = clamp((t - 7.2) / 0.25, 0, 1), k2 = clamp((t - 7.6) / 0.25, 0, 1);
      Font.draw("MOSSY'S", VW / 2, Math.round(lerp(-30, 22, easeOutBack(k1))), { color: '#a6f27c', align: 'center', outline: '#13261b', scale: 2 });
      if (k2 > 0) Font.draw('CLIMB', VW / 2, Math.round(lerp(-60, 40, k2 * k2)), { color: '#ffd84a', align: 'center', outline: '#3a2408', scale: 4 });
      if (t > 8.0) Font.draw('A VERY TALL ADVENTURE', VW / 2, 74, { color: '#ffffff', align: 'center', outline: true, alpha: clamp((t - 8) * 3, 0, 1) });
    }
    for (const d of this.dust) { ctx.globalAlpha = clamp(d.life * 2, 0, 1); ctx.fillStyle = '#fff4d0'; ctx.fillRect(Math.round(d.x), Math.round(d.y), 2, 2); }
    ctx.globalAlpha = 1;
    // prompts
    if (this.state === 'wait') {
      ctx.fillStyle = 'rgba(10,8,18,0.35)'; ctx.fillRect(0, 0, VW, VH);
      Font.draw("MOSSY'S CLIMB", VW / 2, 92, { color: '#ffd84a', align: 'center', outline: '#3a2408', scale: 2 });
      if (Math.floor(t * 1.8) % 2 === 0) Font.draw(Input.hasTouch ? 'TAP TO START' : 'PRESS ANY KEY', VW / 2, 124, { color: '#ffffff', align: 'center', outline: true, scale: 2 });
      Font.draw('BEST WITH SOUND ON ♪', VW / 2, VH - 16, { color: '#a8a0c0', align: 'center', outline: true });
    } else if (t > 0.6 && t < 7.2) {
      Font.draw(Input.device === 'touch' ? 'TAP TO SKIP ▶' : 'ANY KEY TO SKIP ▶', VW - 8, 8, { color: '#ffffff', align: 'right', outline: true, alpha: 0.75 });
    }
  },

  // Stormbeak's flight path, in scene coordinates
  birdPos() {
    if (this.state !== 'play') return null;
    const t = this.t;
    const gem = { x: OP_PEAK.x, y: OP_PEAK.y - 24 };
    const bez = (a, b, c, k) => ({ x: (1 - k) * (1 - k) * a.x + 2 * (1 - k) * k * b.x + k * k * c.x, y: (1 - k) * (1 - k) * a.y + 2 * (1 - k) * k * b.y + k * k * c.y });
    if (t < 2.5 || t > 4.9) return null;
    if (t < 3.45) { const p = bez({ x: VW + 60, y: -40 }, { x: VW - 40, y: 120 }, gem, easeInOut((t - 2.5) / 0.95)); return { ...p, flip: true }; }
    const p = bez(gem, { x: OP_PEAK.x - 120, y: 10 }, { x: -80, y: -90 }, easeInOut((t - 3.45) / 1.45));
    return { ...p, flip: true };
  },
};
