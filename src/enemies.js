// =====================================================================
//  ENEMIES — walkers, flyers, shooters, mimic and the Stormbeak boss
// =====================================================================
let enemies = [];

function makeEnemy(type, tx, ty, extra = {}) {
  const px = tx * TS, py = ty * TS;
  const b = { type, alive: true, dying: false, remX: 0, remY: 0, vx: 0, vy: 0, dir: -1, t: rand(0, 1), anim: rand(0, 2), stompable: true, harmful: true, flash: 0, dropIn: 0, ...extra };
  switch (type) {
    case 'beetle': return { ...b, x: px + 2, y: py + 7, w: 12, h: 9, speed: 30 };
    case 'spiny': return { ...b, x: px + 2, y: py + 7, w: 12, h: 9, speed: 22, stompable: false };
    case 'bat': return { ...b, x: px + 2, y: py + 1, w: 12, h: 8, state: 'hang', hx: px + 2, hy: py + 1 };
    case 'plant': return { ...b, x: px + 2, y: py + 4, w: 12, h: 12, state: 'idle', t: 1.2 + rand(0, 0.8) };
    case 'wasp': return { ...b, x: px + 2, y: py + 4, w: 12, h: 8, ox: px + 2, oy: py + 4, axis: 'x', range: 44 };
    case 'waspV': return { ...b, x: px + 2, y: py + 4, w: 12, h: 8, ox: px + 2, oy: py + 4, axis: 'y', range: 36 };
    case 'slime': return { ...b, x: px + 2, y: py + 8, w: 12, h: 8, t: 0.8 + rand(0, 0.8) };
    case 'mimic': return { ...b, x: px + 2, y: py + 6, w: 12, h: 10, state: 'hidden', harmful: false, stompable: false };
    case 'boss': return { ...b, x: px, y: py, w: 26, h: 22, hp: 3, state: 'sleep', awake: false, phase: 1, stompable: false, dives: 0, hx: px, hy: py };
  }
  throw new Error('unknown enemy ' + type);
}

function spawnEnemies() {
  enemies = [];
  for (const s of level.enemySpawns) {
    if (s.type === 'mimic' && level.gems.some((g) => g.id === s.gemId && g.got)) continue;
    enemies.push(makeEnemy(s.type, s.tx, s.ty, { gemId: s.gemId }));
  }
}

function standable(x, y) {
  const t = tileAt(Math.floor(x / TS), Math.floor(y / TS));
  if (isSolidT(t)) return true;
  if (t === T.ONEWAY && y % TS === 0) return true;
  for (const c of level.crumbles) if (c.state !== 'gone' && rectHit(x, y, 1, 1, c.x, c.y, c.w, c.h)) return true;
  return false;
}

function killEnemy(e, how) {
  if (!e.alive) return;
  if (e.type === 'boss') return;
  e.alive = false; e.dying = true; e.vy = -170; e.vx = how === 'slam' ? rand(-60, 60) : rand(-30, 30);
  level.kills++; stats.kills++;
  const col = { beetle: '#e8434f', spiny: '#a8693f', bat: '#8a64e0', plant: '#ff5a7a', wasp: '#ffd84a', waspV: '#ffd84a', slime: '#3ad1b5' }[e.type] || '#ffffff';
  burst(e.x + e.w / 2, e.y + e.h / 2, col, 12, 80);
  if (how !== 'lava' && how !== 'crush') Sound.sfx('stomp');
}

function walk(e, dt) {
  e.vy = Math.min(e.vy + 900 * dt, 300);
  if (moveY(e, e.vy * dt)) e.vy = 0;
  const g = groundUnder(e);
  if (g) {
    const ahead = e.dir > 0 ? e.x + e.w : e.x - 1;
    if (!standable(ahead, e.y + e.h) || hazardAt(ahead - (e.dir > 0 ? 0 : 1), e.y, 2, e.h + 2)) e.dir *= -1;
    if (g.kind === 'platform') { e.x += g.plat.dx; e.y += g.plat.dy; }
  }
  if (moveX(e, e.dir * e.speed * dt)) e.dir *= -1;
}

function updateEnemies(dt) {
  const px = player.x + player.w / 2, py = player.y + player.h / 2;
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    e.anim += dt; e.flash = Math.max(0, e.flash - dt);
    if (e.dying) {
      e.vy += 700 * dt; e.x += e.vx * dt; e.y += e.vy * dt;
      if (e.y > cam.y + VH + 60) enemies.splice(i, 1);
      continue;
    }
    if (!e.alive) continue;
    if (e.dropIn > 0) { e.dropIn -= dt; if (e.dropIn <= 0) burst(e.x + 6, e.y, '#ffffff', 6, 40); continue; }
    const ex = e.x + e.w / 2, ey = e.y + e.h / 2;
    switch (e.type) {
      case 'beetle': case 'spiny': walk(e, dt); break;
      case 'bat': updateBat(e, dt, px, py, ex, ey); break;
      case 'plant':
        e.dir = px < ex ? -1 : 1;
        if (Math.abs(px - ex) < 170 && Math.abs(py - ey) < 64 && !player.dead) {
          e.t -= dt;
          e.state = e.t < 0.45 ? 'open' : 'idle';
          if (e.t <= 0) {
            e.t = 2.2; e.state = 'idle';
            level.projectiles.push({ kind: 'seed', x: ex + e.dir * 6 - 2, y: e.y + 4, w: 5, h: 5, vx: e.dir * 115, vy: 0, g: 0, life: 3 });
            Sound.sfx('spit');
          }
        } else { e.t = Math.max(e.t, 0.8); e.state = 'idle'; }
        break;
      case 'wasp': case 'waspV': {
        e.t += dt;
        const s = Math.sin(e.t * 1.6);
        if (e.axis === 'x') { e.x = Math.round(e.ox + s * e.range); e.dir = Math.cos(e.t * 1.6) >= 0 ? 1 : -1; e.y = Math.round(e.oy + Math.sin(e.t * 5) * 2); }
        else { e.y = Math.round(e.oy + s * e.range); e.dir = px < ex ? -1 : 1; }
        break;
      }
      case 'slime': {
        e.vy = Math.min(e.vy + 900 * dt, 300);
        const hitX = moveX(e, e.vx * dt);
        if (hitX) e.vx = -e.vx * 0.5;
        if (moveY(e, e.vy * dt)) { if (e.vy > 0) { e.vx = 0; } e.vy = 0; }
        e.onGround = !!groundUnder(e);
        if (e.onGround) {
          e.t -= dt;
          if (e.t <= 0 && Math.abs(px - ex) < 150 && Math.abs(py - ey) < 80) {
            e.dir = px < ex ? -1 : 1;
            e.vy = -230; e.vx = e.dir * 62; e.t = 1.3; Sound.sfx('bounce');
            // don't hop off a ledge into a hazard
            if (!standable(ex + e.dir * 30, e.y + e.h) && !standable(ex + e.dir * 46, e.y + e.h)) e.vx = 0;
          }
        }
        break;
      }
      case 'mimic': updateMimic(e, dt, px, py, ex, ey); break;
      case 'boss': updateBoss(e, dt, px, py); break;
    }
    if (e.y > level.h * TS + 32) { e.alive = false; enemies.splice(i, 1); }
  }
  updateProjectiles(dt);
}

function updateBat(e, dt, px, py, ex, ey) {
  if (e.state === 'hang') {
    if (!player.dead && Math.abs(px - ex) < 78 && py > e.y && py - e.y < 140) { e.state = 'wake'; e.t = 0.4; Sound.sfx('squeak'); }
    return;
  }
  if (e.state === 'wake') { e.t -= dt; if (e.t <= 0) { e.state = 'chase'; e.t = 0; } return; }
  if (e.state === 'chase') {
    e.t += dt;
    const dx = px - ex, dy = py - ey, d = Math.hypot(dx, dy) || 1;
    e.vx = approach(e.vx, (dx / d) * 62, 140 * dt);
    e.vy = approach(e.vy, (dy / d) * 62 + Math.sin(e.t * 7) * 30, 160 * dt);
    e.dir = dx < 0 ? -1 : 1;
    if (e.t > 6 || Math.hypot(ex - e.hx, ey - e.hy) > 230 || player.dead) e.state = 'return';
  } else if (e.state === 'return') {
    const dx = e.hx - e.x, dy = e.hy - e.y, d = Math.hypot(dx, dy) || 1;
    e.vx = (dx / d) * 55; e.vy = (dy / d) * 55;
    if (d < 3) { e.x = e.hx; e.y = e.hy; e.vx = e.vy = 0; e.state = 'hang'; return; }
  }
  if (moveX(e, e.vx * dt)) e.vx = -e.vx;
  if (moveY(e, e.vy * dt, false)) e.vy = -e.vy * 0.5;
}

function updateMimic(e, dt, px, py, ex, ey) {
  if (e.state === 'hidden') {
    if (!player.dead && Math.hypot(px - ex, py - ey) < 60) {
      e.state = 'alert'; e.t = 0.45; e.vy = -170; Sound.sfx('nope');
      floatText(ex, e.y - 8, '!', '#ff3a5a');
    }
    return;
  }
  e.vy = Math.min(e.vy + 900 * dt, 300);
  if (moveY(e, e.vy * dt)) e.vy = 0;
  const g = groundUnder(e);
  if (e.state === 'alert') { e.t -= dt; if (e.t <= 0 && g) e.state = 'flee'; return; }
  // run away from the player, hop over things
  e.dir = px < ex ? 1 : -1;
  const ahead = e.dir > 0 ? e.x + e.w : e.x - 1;
  let speed = 74;
  if (g && (!standable(ahead, e.y + e.h) || solidRect(e.x + e.dir * 3, e.y, e.w, e.h))) {
    if (Math.random() < 0.06) e.vy = -240; else speed = 0;
  }
  if (g && Math.random() < 0.012) e.vy = -200;
  moveX(e, e.dir * speed * dt);
}

// ---------------------------------------------------------------------
function updateProjectiles(dt) {
  const P = level.projectiles;
  for (let i = P.length - 1; i >= 0; i--) {
    const p = P[i];
    p.vy += (p.g || 0) * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
    if (p.kind === 'wave' && Math.random() < 0.5) addParticle(p.x + 5, p.y + 6, { col: '#bfe4ff', life: 0.25, vy: rand(-40, -10), g: 0 });
    const hitWall = p.kind === 'wave' ? solidRect(p.x + 2, p.y, p.w - 4, p.h - 2) : solidRect(p.x, p.y, p.w, p.h);
    if (hitWall || p.life <= 0) {
      burst(p.x + p.w / 2, p.y + p.h / 2, p.kind === 'seed' ? '#ffcf5a' : '#bfe4ff', 5, 40);
      P.splice(i, 1); continue;
    }
    if (!player.dead && rectHit(player.x + 1, player.y + 1, player.w - 2, player.h - 2, p.x, p.y, p.w, p.h)) {
      hurtPlayer(p.x + p.w / 2);
      P.splice(i, 1);
    }
  }
}

// Player vs enemy contact
function enemyContacts() {
  const p = player;
  if (p.dead || p.poof > 0) return;
  for (const e of enemies) {
    if (!e.alive || e.dropIn > 0) continue;
    if (!rectHit(p.x, p.y, p.w, p.h, e.x, e.y, e.w, e.h)) continue;
    if (e.type === 'mimic') {
      if (e.state !== 'alert' || e.t < 0.3) catchMimic(e);
      continue;
    }
    if (e.type === 'boss') { bossContact(e); continue; }
    const fromAbove = p.vy > 0 && p.prevBottom <= e.y + 6;
    if (p.slam === 2) { killEnemy(e, 'slam'); fx.hitstop = 0.04; continue; }
    if (p.dashT > 0 && e.stompable) { killEnemy(e, 'dash'); fx.hitstop = 0.05; addShake(2); continue; }
    if (fromAbove && e.stompable) {
      killEnemy(e, 'stomp'); bouncePlayer(Input.held.jump); fx.hitstop = 0.05; addShake(1.5);
      continue;
    }
    if (fromAbove && !e.stompable) { hurtPlayer(e.x + e.w / 2); if (!p.dead) p.vy = -260; continue; }
    hurtPlayer(e.x + e.w / 2);
  }
}

function catchMimic(e) {
  e.alive = false;
  const g = level.gems.find((g) => g.id === e.gemId);
  if (g) g.got = true;
  collectGemFx(e.x + 6, e.y + 5);
  floatText(e.x + 6, e.y - 6, 'GOTCHA!', '#4ae0ff');
  enemies.splice(enemies.indexOf(e), 1);
}

// ---------------------------------------------------------------------
//  STORMBEAK — the boss
// ---------------------------------------------------------------------
function bossArena() { return level.arena || { x: level.spawn.x - VW / 2, y: 0, w: VW, h: VH }; }

function updateBoss(b, dt, px, py) {
  const A = bossArena();
  const hoverY = A.y + 34;
  b.t += dt;
  const fly = (tx, ty, sp) => {
    const dx = tx - b.x, dy = ty - b.y, d = Math.hypot(dx, dy);
    if (d < 2) { b.x = tx; b.y = ty; return true; }
    const s = Math.min(d, sp * dt); b.x += (dx / d) * s; b.y += (dy / d) * s; return false;
  };
  b.dir = px < b.x + b.w / 2 ? -1 : 1;
  switch (b.state) {
    case 'sleep':
      if (b.awake) { b.state = 'intro'; b.t = 0; Sound.sfx('screech'); banner('STORMBEAK', '#ff3a5a', 2.2); addShake(4); }
      break;
    case 'intro':
      fly(A.x + A.w / 2 - b.w / 2, hoverY, 90);
      if (b.t > 2.2) { b.state = 'hover'; b.t = 0; b.shot = false; }
      break;
    case 'hover': {
      const tx = clamp(px - b.w / 2, A.x + 8, A.x + A.w - b.w - 8);
      b.x = approach(b.x, tx, (60 + b.phase * 18) * dt);
      b.y = approach(b.y, hoverY + Math.sin(b.t * 3) * 6, 80 * dt);
      const dur = [0, 2.0, 1.7, 1.4][b.phase];
      if (b.phase >= 2 && !b.shot && b.t > dur * 0.45) {
        b.shot = true; Sound.sfx('spit');
        const ang = Math.atan2(py - (b.y + 12), px - (b.x + 13));
        const n = b.phase === 3 ? 5 : 3;
        for (let i = 0; i < n; i++) {
          const a = ang + (i - (n - 1) / 2) * 0.28;
          level.projectiles.push({ kind: 'feather', x: b.x + 11, y: b.y + 12, w: 6, h: 5, vx: Math.cos(a) * 125, vy: Math.sin(a) * 125, g: 0, life: 4 });
        }
      }
      if (b.phase === 3 && !b.bolted && b.t > dur * 0.2) {
        b.bolted = true;
        for (const off of [-56, 56]) {
          const bx = clamp(px + off, A.x + 12, A.x + A.w - 12);
          level.weather.bolts.push({ x: bx, ground: groundYAt(bx, A.y + 40), t: 0.9, strike: 0 });
        }
      }
      if (b.t > dur) { b.state = 'aim'; b.t = 0; b.bolted = false; Sound.sfx('screech'); }
      break;
    }
    case 'aim':
      b.y = approach(b.y, hoverY - 8, 40 * dt);
      b.targetX = clamp(px - b.w / 2, A.x + 4, A.x + A.w - b.w - 4);
      b.x = approach(b.x, b.targetX, 120 * dt);
      if (b.t > [0, 0.6, 0.5, 0.42][b.phase]) { b.state = 'dive'; b.t = 0; b.vy = 80; }
      break;
    case 'dive': {
      b.vy = Math.min(b.vy + 1600 * dt, 460);
      let landed = false;
      for (let i = 0, n = Math.round(b.vy * dt); i < n; i++) {
        if (solidRect(b.x, b.y + 1, b.w, b.h) || onewayUnder(b.x, b.y, b.w, b.h)) { landed = true; break; }
        b.y += 1;
      }
      if (landed) {
        b.state = 'stunned'; b.t = 0; b.dives++;
        addShake(5); Sound.sfx('slam');
        burst(b.x + 13, b.y + b.h, '#c8d0e0', 20, 110);
        if (b.phase >= 2) for (const d of [-1, 1]) level.projectiles.push({ kind: 'wave', x: b.x + 13 - 5 + d * 14, y: b.y + b.h - 10, w: 10, h: 10, vx: d * 120, vy: 0, g: 0, life: 3 });
      }
      break;
    }
    case 'stunned':
      if (b.t > [0, 2.0, 1.7, 1.4][b.phase]) {
        if (b.phase >= 2 && b.dives % 2 === 1) { b.state = 'aim'; b.t = 0; b.y -= 4; } else { b.state = 'recover'; b.t = 0; }
      }
      break;
    case 'hurt':
      b.y = approach(b.y, hoverY, 140 * dt);
      if (b.t > 0.9) { b.state = b.hp <= 0 ? 'dying' : 'recover'; b.t = 0; }
      break;
    case 'recover':
      if (fly(b.x, hoverY, 120)) { b.state = 'hover'; b.t = 0; b.shot = false; }
      break;
    case 'dying':
      b.y += 14 * dt;
      if (Math.random() < 0.25) { burst(b.x + rand(0, 26), b.y + rand(0, 22), pick(['#ffd84a', '#2f3566', '#ffffff']), 8, 80); Sound.sfx('crack'); }
      addShake(1.5);
      if (b.t > 2.4) {
        b.alive = false;
        Sound.sfx('explode'); addShake(8); fx.flash = 0.8; fx.flashCol = '#ffffff';
        for (let i = 0; i < 40; i++) addParticle(b.x + 13, b.y + 11, { vx: rand(-120, 120), vy: rand(-160, 40), col: pick(['#2f3566', '#56609e', '#ffd84a']), life: rand(0.8, 1.6), g: 120, size: 2 });
        bossDefeated(b);
      }
      break;
  }
}

function bossContact(b) {
  const p = player;
  if (['sleep', 'dying', 'hurt'].includes(b.state) || !b.alive) return;
  const fromAbove = p.vy > 0 && p.prevBottom <= b.y + 8;
  if (b.state === 'stunned') {
    if (fromAbove || p.slam === 2) {
      b.hp--; b.phase = Math.min(3, 4 - b.hp); b.state = 'hurt'; b.t = 0; b.flash = 0.9;
      Sound.sfx('bosshit'); addShake(6); fx.hitstop = 0.12;
      burst(b.x + 13, b.y + 4, '#ffd84a', 16, 100);
      bouncePlayer(true); p.vy = -360;
      if (b.hp > 0) banner(b.hp === 2 ? 'IT\'S GETTING ANGRY!' : 'ONE MORE HIT!', '#ff9a5a', 1.5);
    }
    return; // stunned boss doesn't hurt on touch
  }
  if (fromAbove) { bouncePlayer(Input.held.jump); Sound.sfx('bounce'); return; }
  hurtPlayer(b.x + b.w / 2);
}

function bossDefeated(b) {
  const A = bossArena();
  level.dawnGem = { x: A.x + A.w / 2 - 8, y: A.y + 20, ty: groundYAt(A.x + A.w / 2, A.y + 40) - 40, got: false, t: 0 };
  level.sunrise = 0.001;
  level.weather.lightning = false; level.weather.bolts = [];
  banner('STORMBEAK DEFEATED!', '#ffd84a', 2.6);
  Sound.Music.play('victory');
}

// ---------------------------------------------------------------------
function drawEnemies() {
  for (const e of enemies) {
    if (e.dropIn > 0) {
      if (Math.floor(e.dropIn * 8) % 2 === 0) Font.draw('!', e.x + 4, e.y - 2, { color: '#ff3a5a', outline: true });
      continue;
    }
    const flip = e.dir < 0;
    const f2 = Math.floor(e.anim * 6) % 2;
    let s = null, ox = 2, oy = 1;
    switch (e.type) {
      case 'beetle': s = ART.beetle[f2]; ox = 2; oy = 1; break;
      case 'spiny': s = ART.spiny[f2]; ox = 2; oy = 1; break;
      case 'bat': s = e.state === 'hang' ? ART.batHang : ART.bat[Math.floor(e.anim * 9) % 2]; ox = 2; oy = e.state === 'hang' ? 1 : 1; break;
      case 'plant': s = ART.plant[e.state === 'open' ? 1 : 0]; ox = 2; oy = 0; break;
      case 'wasp': case 'waspV': s = ART.wasp[Math.floor(e.anim * 14) % 2]; ox = 2; oy = 1; break;
      case 'slime': s = ART.slime[e.vy !== 0 ? 1 : 0]; ox = 2; oy = 0; break;
      case 'mimic':
        if (e.state === 'hidden') { s = ART.gem[0]; ox = 0; oy = Math.round(Math.sin(level.time * 4 + e.x) * 1.5); }
        else s = ART.mimic[Math.floor(e.anim * 10) % 2], ox = 0, oy = 0;
        break;
      case 'boss': drawBoss(e); continue;
    }
    if (!s) continue;
    const img = e.flash > 0 ? whiteOf(s, flip) : flip ? s.f : s.c;
    if (e.dying) {
      ctx.save(); ctx.translate(Math.round(e.x + e.w / 2), Math.round(e.y + e.h / 2)); ctx.scale(1, -1);
      ctx.drawImage(img, -Math.floor(img.width / 2), -Math.floor(img.height / 2)); ctx.restore();
      continue;
    }
    ctx.drawImage(img, Math.round(e.x) - ox - 1, Math.round(e.y) - oy - 1);
    if (e.type === 'bat' && e.state === 'wake') Font.draw('!', e.x + 4, e.y - 10, { color: '#ffd84a', outline: true });
  }
  for (const p of level.projectiles) {
    const s = p.kind === 'seed' ? ART.seed : p.kind === 'feather' ? ART.feather : null;
    if (s) ctx.drawImage(p.vx < 0 ? s.f : s.c, Math.round(p.x) - 1, Math.round(p.y) - 1);
    else { // energy wave
      ctx.fillStyle = '#bfe4ff'; ctx.fillRect(Math.round(p.x) + 2, Math.round(p.y) + 2, 6, 8);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(p.x) + 4, Math.round(p.y), 2, 10);
    }
  }
}

function drawBoss(b) {
  if (!b.alive) return;
  const set = b.flash > 0 && Math.floor(b.flash * 12) % 2 ? ART.bossHurt : ART.boss;
  let s;
  if (b.state === 'stunned') s = set.stun;
  else if (b.state === 'dive') s = set.down;
  else s = [set.up, set.mid, set.down, set.mid][Math.floor(b.t * 10) % 4];
  const flip = b.dir < 0;
  let dx = 0;
  if (b.state === 'aim' || b.state === 'dying') dx = rand(-1.5, 1.5);
  ctx.drawImage(flip ? s.f : s.c, Math.round(b.x + dx) - (flip ? 9 : 7), Math.round(b.y) - 10);
  if (b.state === 'aim' && Math.floor(b.t * 12) % 2 === 0) {
    ctx.fillStyle = 'rgba(255,58,90,0.35)';
    ctx.fillRect(Math.round(b.targetX), b.y + b.h, b.w, bossArena().y + bossArena().h - b.y);
  }
  if (b.state === 'stunned') {
    for (let i = 0; i < 3; i++) {
      const a = b.t * 5 + (i * Math.PI * 2) / 3;
      Font.draw('★', b.x + 13 + Math.cos(a) * 12 - 3, b.y - 6 + Math.sin(a) * 3, { color: '#ffd84a', shadow: false });
    }
  }
}
