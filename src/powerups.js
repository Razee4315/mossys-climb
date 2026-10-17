// =====================================================================
//  POWER-UPS — energy orbs that grant a special power for a while
//    @ STAR    invincible, faster, plough through foes and spikes
//    & SHIELD  a bubble that soaks up one hit (any hit)
//    " WINGS   flap in mid-air as often as you like
//    $ MAGNET  gems fly to you
// =====================================================================
const POWERS = {
  star: { name: 'SUPER STAR', time: 8, col: '#ffd84a', glow: 'gold', text: 'UNSTOPPABLE!' },
  shield: { name: 'BUBBLE SHIELD', time: 0, col: '#4ab4ff', glow: 'cyan', text: 'SHIELD UP!' },
  wings: { name: 'SKY WINGS', time: 9, col: '#ffffff', glow: 'white', text: 'FLY!' },
  magnet: { name: 'GEM MAGNET', time: 12, col: '#ff4d6d', glow: 'pink', text: 'GEM MAGNET!' },
};
const starOn = () => player.power && player.power.kind === 'star' && !player.dead;
const wingsOn = () => player.power && player.power.kind === 'wings' && !player.dead;

function grantPower(kind) {
  const p = player, P = POWERS[kind];
  if (kind === 'shield') { p.shield = true; p.shieldT = 0; }
  else { p.power = { kind, t: P.time, max: P.time }; }
  if (kind === 'star') Sound.Music.play('star');
  Sound.sfx('powerup');
  banner(P.text, P.col, 1.3);
  fx.flash = Math.max(fx.flash, 0.3); fx.flashCol = P.col;
  fx.hitstop = Math.max(fx.hitstop, 0.08);
  for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; addParticle(p.x + 5, p.y + 7, { vx: Math.cos(a) * 110, vy: Math.sin(a) * 110, col: i % 2 ? P.col : '#ffffff', life: 0.5, g: 0, drag: 3, size: 2 }); }
  stats.powers = (stats.powers || 0) + 1;
}

function endPower(quiet) {
  const p = player;
  if (!p.power) return;
  const was = p.power.kind;
  p.power = null;
  if (was === 'star') Sound.Music.play(level.def.music || THEMES[level.theme].music);
  if (!quiet) { Sound.sfx('powerdown'); burst(p.x + 5, p.y + 7, POWERS[was].col, 10, 50); }
}

function popShield(fromX) {
  const p = player;
  p.shield = false; p.invuln = Math.max(p.invuln, 1.1);
  Sound.sfx('shieldpop'); addShake(3); fx.hitstop = Math.max(fx.hitstop, 0.06);
  for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2; addParticle(p.x + 5 + Math.cos(a) * 11, p.y + 7 + Math.sin(a) * 11, { vx: Math.cos(a) * 70, vy: Math.sin(a) * 70, col: i % 3 ? '#b8ecff' : '#ffffff', life: 0.4, g: 0, drag: 2 }); }
  floatText(p.x + 5, p.y - 6, 'POP!', '#b8ecff');
  if (fromX != null) { p.vx = (p.x + 5 < fromX ? -1 : 1) * 120; p.vy = -200; }
}

function updatePowerups(dt) {
  const p = player, L = level;
  // pickups
  if (!p.dead && p.poof <= 0) for (const o of L.powerups) {
    if (o.got) continue;
    if (rectHit(p.x - 2, p.y - 2, p.w + 4, p.h + 4, o.x, o.y, 12, 12)) { o.got = true; grantPower(o.kind); }
  }
  if (p.shield) p.shieldT = (p.shieldT || 0) + dt;
  if (!p.power) return;
  p.power.t -= dt;
  const P = p.power;
  if (P.kind === 'star') {
    if (Math.random() < 0.7) addParticle(p.x + rand(0, 10), p.y + rand(0, 14), { col: pick(['#ffd84a', '#ff7aa8', '#7aff9a', '#4ae0ff', '#ffffff']), life: 0.4, vy: rand(-20, 10), vx: -p.vx * 0.1, g: 30, glow: true });
    if (Math.floor(L.time * 30) % 2) p.trail.push({ x: p.x, y: p.y, t: 0.2, f: p.facing, col: pick(['#ffd84a', '#ff7aa8', '#4ae0ff']) });
  }
  if (P.kind === 'magnet') {
    for (const g of L.gems) {
      if (g.got || g.mimic) continue;
      const dx = p.x + 5 - (g.x + 6), dy = p.y + 7 - (g.y + 5), d = Math.hypot(dx, dy);
      if (d < 110) { const s = Math.min(d, (140 + (110 - d) * 3) * dt); g.x += (dx / d) * s; g.y += (dy / d) * s; g.pulled = true; }
    }
  }
  if (P.t <= 2 && Math.floor(P.t * 4) !== Math.floor((P.t + dt) * 4)) Sound.sfx('warn');
  if (P.t <= 0) endPower();
}

function drawPowerups(t) {
  for (const o of level.powerups) {
    if (o.got) continue;
    const P = POWERS[o.kind];
    const bob = Math.sin(t * 3 + o.bob) * 2;
    const cx = o.x + 6, cy = o.y + 6 + bob;
    glow(P.glow, cx, cy, 20 + Math.sin(t * 6) * 3, 0.9);
    // orb shell
    ctx.globalAlpha = 0.35; ctx.fillStyle = P.col; circle(cx, cy, 8); ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillRect(Math.round(cx) - 5, Math.round(cy) - 6, 2, 1); ctx.fillRect(Math.round(cx) - 6, Math.round(cy) - 5, 1, 2);
    const s = ART.power[o.kind];
    ctx.drawImage(s.c, Math.round(cx - s.w / 2), Math.round(cy - s.h / 2));
    // orbiting sparkles
    for (let i = 0; i < 3; i++) {
      const a = t * 3 + (i * Math.PI * 2) / 3;
      ctx.fillStyle = i ? P.col : '#ffffff';
      ctx.fillRect(Math.round(cx + Math.cos(a) * 11), Math.round(cy + Math.sin(a) * 5), 1, 1);
    }
  }
}

// drawn around the player: bubble, wings, star shimmer
function drawPlayerPowerFx(back) {
  const p = player;
  if (p.dead) return;
  const cx = Math.round(p.x + p.w / 2), cy = Math.round(p.y + p.h / 2) - 1;
  if (back && wingsOn()) {
    const flap = p.onGround ? 0 : Math.sin(level.time * 22) * 3;
    const w = ART.power.wings;
    ctx.save(); ctx.translate(cx - p.facing * 3, cy - 4 + flap * 0.3);
    ctx.scale(-p.facing * 0.85, 0.85 + flap * 0.05);
    ctx.drawImage(w.c, -12, -8);
    ctx.restore();
  }
  if (!back && p.shield) {
    const r = 12 + Math.sin(level.time * 5) * 0.8;
    glow('cyan', cx, cy, 20, 0.5);
    ctx.globalAlpha = 0.18; ctx.fillStyle = '#4ab4ff'; circle(cx, cy, Math.round(r)); ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(184,236,255,0.8)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx + 0.5, cy + 0.5, r, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.fillRect(cx - 7, cy - 7, 3, 1); ctx.fillRect(cx - 8, cy - 6, 1, 2);
  }
  if (!back && starOn()) glow('gold', cx, cy, 22, 0.55 + Math.sin(level.time * 20) * 0.15);
}

function drawPowerHUD(x, y) {
  const p = player;
  let n = 0;
  if (p.power) {
    const P = POWERS[p.power.kind], k = clamp(p.power.t / p.power.max, 0, 1);
    const blink = p.power.t < 2 && Math.floor(p.power.t * 8) % 2;
    ctx.fillStyle = 'rgba(16,12,28,0.6)'; ctx.fillRect(x, y, 46, 12);
    if (!blink) spr(ART.power[p.power.kind], x + 1, y);
    ctx.fillStyle = '#2a2438'; ctx.fillRect(x + 15, y + 4, 29, 4);
    ctx.fillStyle = P.col; ctx.fillRect(x + 15, y + 4, Math.round(29 * k), 4);
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(x + 15, y + 4, Math.round(29 * k), 1);
    n++;
  }
  if (p.shield) {
    const sx = x + (n ? 50 : 0);
    ctx.fillStyle = 'rgba(16,12,28,0.6)'; ctx.fillRect(sx, y, 14, 12);
    spr(ART.power.shield, sx + 1, y);
  }
}
