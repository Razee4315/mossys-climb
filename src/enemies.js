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
    case 'boar': return { ...b, x: px + 1, y: py + 5, w: 14, h: 11, speed: 24, state: 'walk' };
    case 'bomb': return { ...b, x: px + 2, y: py + 6, w: 11, h: 10, speed: 22, state: 'walk' };
    case 'ghost': return { ...b, x: px + 1, y: py + 2, w: 12, h: 12, stompable: false, shy: false, alpha: 0.9, hx: px + 1, hy: py + 2 };
    case 'leaper': return { ...b, x: px + 2, y: py + 4, w: 10, h: 10, stompable: false, hy: py + 4, state: 'wait', t: rand(0.6, 2.2) };
    case 'cloudy': return { ...b, x: px - 2, y: py + 2, w: 18, h: 10, hx: px - 2, hy: py + 2, state: 'drift', t: rand(1.5, 2.5) };
    case 'penguin': return { ...b, x: px + 2, y: py + 4, w: 12, h: 12, speed: 18, state: 'walk', t: 0 };
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
  const col = { beetle: '#e8434f', spiny: '#a8693f', bat: '#8a64e0', plant: '#ff5a7a', wasp: '#ffd84a', waspV: '#ffd84a', slime: '#3ad1b5', boar: '#c08a6a', bomb: '#3c3c62', ghost: '#f2eeff', leaper: '#ff7a1a', cloudy: '#c8d0ea', penguin: '#2c3450' }[e.type] || '#ffffff';
  burst(e.x + e.w / 2, e.y + e.h / 2, col, 12, 80);
  burst(e.x + e.w / 2, e.y + e.h / 2, '#ffffff', 5, 50);
  if (how !== 'lava' && how !== 'crush') Sound.sfx('stomp');
  if (how === 'star' || how === 'roll') { Sound.sfx('kapow'); floatText(e.x + e.w / 2, e.y - 4, pick(['POW!', 'BAM!', 'WHAM!', 'BONK!']), '#ffd84a'); }
}

// chained stomps without touching the ground climb in pitch and praise
function stompCombo(e) {
  const p = player;
  p.combo = (p.combo || 0) + 1;
  if (p.combo >= 2) {
    const words = ['', '', 'DOUBLE!', 'TRIPLE!', 'SUPER!', 'AMAZING!', 'UNSTOPPABLE!'];
    floatText(e.x + e.w / 2, e.y - 8, words[Math.min(p.combo, 6)] || 'WOW!', ['#7aff9a', '#4ae0ff', '#ffd84a', '#ff7aa8'][p.combo % 4]);
    Sound.sfx('combo', p.combo);
  }
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
      case 'boar': updateBoar(e, dt, px, py, ex, ey); break;
      case 'bomb': updateBomb(e, dt); break;
      case 'ghost': updateGhost(e, dt, px, py, ex, ey); break;
      case 'leaper': updateLeaper(e, dt); break;
      case 'cloudy': updateCloudy(e, dt, px, py, ex, ey); break;
      case 'penguin': updatePenguin(e, dt, px, py, ex, ey); break;
    }
    if (e.y > level.h * TS + 32 && e.type !== 'leaper') { e.alive = false; enemies.splice(i, 1); }
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

// Boar: trots about, spots you, scrapes a hoof... and CHARGES
function updateBoar(e, dt, px, py, ex, ey) {
  e.t += dt;
  if (e.state === 'walk') {
    walk(e, dt);
    const ahead = (px - ex) * e.dir > 0;
    if (!player.dead && ahead && Math.abs(px - ex) < 150 && Math.abs(py - ey) < 22) {
      e.state = 'alert'; e.t = 0; Sound.sfx('snort'); floatText(ex, e.y - 6, '!', '#ff3a5a');
    }
  } else if (e.state === 'alert') {
    e.vy = Math.min(e.vy + 900 * dt, 300); if (moveY(e, e.vy * dt)) e.vy = 0;
    if (Math.random() < 0.4) addParticle(e.x + e.w / 2 - e.dir * 6, e.y + e.h, { vx: -e.dir * rand(20, 60), vy: rand(-30, -5), col: '#d8c8a8', life: 0.35 });
    if (e.t > 0.55) { e.state = 'charge'; e.t = 0; }
  } else if (e.state === 'charge') {
    e.vy = Math.min(e.vy + 900 * dt, 300); if (moveY(e, e.vy * dt)) e.vy = 0;
    const g = groundUnder(e);
    const ahead = e.dir > 0 ? e.x + e.w : e.x - 1;
    const edge = g && !standable(ahead + e.dir * 2, e.y + e.h);
    if (Math.random() < 0.6) addParticle(e.x + e.w / 2 - e.dir * 7, e.y + e.h, { vx: -e.dir * rand(30, 80), vy: rand(-40, -10), col: '#d8c8a8', life: 0.3 });
    if (edge) { e.state = 'skid'; e.t = 0; e.vx = e.dir * 60; }
    else if (moveX(e, e.dir * 150 * dt)) { e.state = 'dizzy'; e.t = 0; addShake(3); Sound.sfx('slam'); burst(ahead, e.y + 5, '#ffffff', 10, 60); }
  } else if (e.state === 'skid') {
    e.vx = approach(e.vx, 0, 300 * dt);
    const ahead = e.dir > 0 ? e.x + e.w : e.x - 1;
    if (standable(ahead + e.dir, e.y + e.h)) moveX(e, e.vx * dt); else e.vx = 0;
    if (Math.random() < 0.8) addParticle(e.x + e.w / 2 + e.dir * 6, e.y + e.h, { vx: rand(-20, 20), vy: rand(-30, -5), col: '#d8c8a8', life: 0.3 });
    if (e.vx === 0) { e.state = 'dizzy'; e.t = 0.6; }
  } else if (e.state === 'dizzy') {
    if (e.t > 1.3) { e.state = 'walk'; e.t = 0; e.dir *= -1; }
  }
}

// Bomb beetle: stomp it and the fuse lights. Kick it, or RUN.
function updateBomb(e, dt) {
  if (e.state === 'walk') { walk(e, dt); return; }
  e.t -= dt;
  e.vy = Math.min(e.vy + 900 * dt, 300);
  if (moveY(e, e.vy * dt)) e.vy = 0;
  // a kicked bomb slides until it thuds into something, then sits there fizzing
  if (e.vx) { if (moveX(e, e.vx * dt)) { e.vx = 0; Sound.sfx('land'); addShake(1); } e.vx = approach(e.vx, 0, 40 * dt); }
  if (Math.random() < 0.6) addParticle(e.x + 9, e.y - 2, { col: pick(['#ffd84a', '#ff7a1a', '#ffffff']), vy: rand(-40, -10), vx: rand(-15, 15), life: 0.3, g: 60, glow: true });
  const rate = e.t < 0.6 ? 16 : 8;
  if (Math.floor(e.t * rate) !== Math.floor((e.t + dt) * rate)) Sound.sfx('fuse');
  if (e.t <= 0) {
    e.alive = false; enemies.splice(enemies.indexOf(e), 1);
    level.kills++; stats.kills++;
    explode(e.x + e.w / 2, e.y + e.h / 2, 34);
  }
}

// Ghost: shy when you look at it, creeps closer when you turn your back
function updateGhost(e, dt, px, py, ex, ey) {
  const facingIt = Math.sign(ex - px) === player.facing || Math.abs(ex - px) < 4;
  e.shy = facingIt && !player.dead;
  const d = Math.hypot(px - ex, py - ey) || 1;
  if (d > 260) { e.vx = approach(e.vx, 0, 60 * dt); e.vy = approach(e.vy, 0, 60 * dt); }
  else if (e.shy) { e.vx = approach(e.vx, 0, 120 * dt); e.vy = approach(e.vy, Math.sin(e.anim * 2) * 6, 60 * dt); }
  else {
    const sp = 38;
    e.vx = approach(e.vx, ((px - ex) / d) * sp, 80 * dt); e.vy = approach(e.vy, ((py - ey) / d) * sp, 80 * dt);
    e.dir = px < ex ? -1 : 1;
    if (Math.random() < 0.004) Sound.sfx('boo');
  }
  e.x += e.vx * dt; e.y += e.vy * dt;
  e.alpha = approach(e.alpha, e.shy ? 0.5 : 0.92, dt * 3);
}

// Lava leaper: bursts out of the lava in a high arc
function updateLeaper(e, dt) {
  if (e.state === 'wait') {
    e.y = e.hy + 14;
    e.t -= dt;
    if (e.t < 0.5 && Math.random() < 0.5) addParticle(e.x + rand(0, 10), e.hy + 2, { col: pick(['#ffd25a', '#ff7a1a']), vy: rand(-60, -20), life: 0.4, g: 200 });
    if (e.t <= 0) { e.state = 'jump'; e.vy = -(e.power || 300); Sound.sfx('splash'); burst(e.x + 5, e.hy + 4, '#ffd25a', 10, 60); }
    return;
  }
  e.vy += 640 * dt; e.y += e.vy * dt;
  if (Math.random() < 0.5) addParticle(e.x + rand(2, 8), e.y + 10, { col: pick(['#ffd25a', '#ff7a1a', '#c82a10']), vy: rand(0, 20), life: 0.35, g: 0 });
  if (e.vy > 0 && e.y > e.hy + 14) { e.state = 'wait'; e.t = rand(1.2, 2.4); burst(e.x + 5, e.hy + 4, '#ff7a1a', 8, 50); }
}

// Grumble cloud: follows overhead and calls down lightning (it's stompable!)
function updateCloudy(e, dt, px, py, ex, ey) {
  const near = Math.abs(px - ex) < 280 && py > e.y && !player.dead;
  // it stalks you, but only within its own patch of sky
  if (near) e.x = clamp(approach(e.x, px - e.w / 2, (e.state === 'charge' ? 16 : 56) * dt), e.hx - 200, e.hx + 200);
  e.y = e.hy + Math.sin(e.anim * 2) * 3;
  e.dir = px < ex ? -1 : 1;
  if (!near) return;
  e.t -= dt;
  if (e.state === 'drift' && e.t <= 0.75) { e.state = 'charge'; Sound.sfx('zap'); }
  if (e.state === 'charge') {
    if (Math.random() < 0.6) addParticle(e.x + rand(2, 16), e.y + 10, { col: '#ffff8a', vy: rand(20, 60), life: 0.2, g: 0, glow: true });
    if (e.t <= 0) {
      e.state = 'drift'; e.t = rand(2.6, 3.4);
      const bx = e.x + e.w / 2;
      level.weather.bolts.push({ x: bx, ground: groundYAt(bx, e.y + e.h + 2), t: 0.6, strike: 0, top: e.y + e.h });
    }
  }
}

// Penguin: waddles, then belly-slides at you
function updatePenguin(e, dt, px, py, ex, ey) {
  e.t -= dt;
  if (e.state === 'walk') {
    walk(e, dt);
    if (!player.dead && e.t <= 0 && Math.abs(px - ex) < 140 && Math.abs(py - ey) < 24) {
      e.state = 'slide'; e.t = 2.2; e.dir = px < ex ? -1 : 1; e.vy = -120; Sound.sfx('whee');
    }
  } else {
    e.vy = Math.min(e.vy + 900 * dt, 300); if (moveY(e, e.vy * dt)) e.vy = 0;
    const g = groundUnder(e);
    const ahead = e.dir > 0 ? e.x + e.w : e.x - 1;
    if (g && !standable(ahead + e.dir * 2, e.y + e.h)) e.dir *= -1;
    if (moveX(e, e.dir * 120 * dt)) { e.dir *= -1; Sound.sfx('bounce'); }
    if (g && Math.random() < 0.4) addParticle(e.x + e.w / 2 - e.dir * 6, e.y + e.h, { vx: -e.dir * rand(20, 50), vy: rand(-30, -5), col: '#ffffff', life: 0.3 });
    if (e.t <= 0) { e.state = 'walk'; e.t = 1.5; }
  }
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
      burst(p.x + p.w / 2, p.y + p.h / 2, p.kind === 'seed' ? '#ffcf5a' : p.kind === 'ball' ? '#6a6a90' : '#bfe4ff', 5, 40);
      if (p.kind === 'ball') Sound.sfx('crack');
      P.splice(i, 1); continue;
    }
    if (!player.dead && player.poof <= 0 && rectHit(player.x + 1, player.y + 1, player.w - 2, player.h - 2, p.x, p.y, p.w, p.h)) {
      if (p.stomp && player.vy > 0 && player.prevBottom <= p.y + 4) {
        bouncePlayer(Input.held.jump); Sound.sfx('stomp'); fx.hitstop = 0.04;
        burst(p.x + 5, p.y + 5, '#6a6a90', 10, 60);
      } else if (starOn() || player.rollT > 0) { burst(p.x + 5, p.y + 5, '#ffd84a', 8, 60); Sound.sfx('kapow'); }
      else hurtPlayer(p.x + p.w / 2);
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
    if (e.type === 'leaper' && e.state === 'wait') continue;
    const fromAbove = p.vy > 0 && p.prevBottom <= e.y + 6;
    if (starOn()) { killEnemy(e, 'star'); fx.hitstop = 0.04; addShake(2); continue; }
    if (p.rollT > 0) { killEnemy(e, 'roll'); fx.hitstop = 0.05; addShake(2); p.rollT = Math.max(p.rollT, 0.15); continue; }
    if (e.type === 'bomb') { bombContact(e, fromAbove); continue; }
    if (p.slam === 2) { killEnemy(e, 'slam'); fx.hitstop = 0.04; continue; }
    if (p.dashT > 0 && e.stompable) { killEnemy(e, 'dash'); fx.hitstop = 0.05; addShake(2); continue; }
    if (fromAbove && e.stompable) {
      stompCombo(e);
      killEnemy(e, 'stomp'); bouncePlayer(Input.held.jump); fx.hitstop = 0.05; addShake(1.5);
      continue;
    }
    if (e.type === 'boar' && e.state === 'dizzy') continue; // a dizzy boar is harmless
    if (fromAbove && !e.stompable) { hurtPlayer(e.x + e.w / 2); if (!p.dead) p.vy = -260; continue; }
    hurtPlayer(e.x + e.w / 2);
  }
}

function bombContact(e, fromAbove) {
  const p = player;
  if (e.state === 'walk') {
    if (fromAbove || p.slam === 2 || p.dashT > 0) {
      e.state = 'lit'; e.t = 1.7; e.vx = 0; Sound.sfx('fuse'); stompCombo(e);
      floatText(e.x + 6, e.y - 6, 'UH OH!', '#ff7a1a');
      bouncePlayer(Input.held.jump); fx.hitstop = 0.05;
      return;
    }
    hurtPlayer(e.x + e.w / 2); return;
  }
  // a lit bomb: stand on it, or kick it away from you
  if (fromAbove) { bouncePlayer(Input.held.jump); return; }
  if (Math.abs(e.vx) < 30) { e.vx = (p.x + 5 < e.x + e.w / 2 ? 1 : -1) * 170; e.vy = -90; Sound.sfx('kick'); floatText(e.x + 6, e.y - 6, 'KICK!', '#ffd84a'); }
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
      case 'boar':
        s = e.state === 'charge' || e.state === 'alert' || e.state === 'skid' ? ART.boarMad : ART.boar[Math.floor(e.anim * (e.state === 'walk' ? 6 : 0)) % 2];
        ox = 1; oy = e.state === 'charge' ? Math.floor(e.anim * 16) % 2 : 0;
        if (e.state === 'alert') ox += Math.floor(e.anim * 30) % 2;
        break;
      case 'bomb': {
        const lit = e.state === 'lit';
        const fl = lit && Math.floor(e.t * (e.t < 0.6 ? 20 : 10)) % 2;
        s = (fl ? ART.bombLit : ART.bomb)[Math.floor(e.anim * (lit ? 0 : 6)) % 2]; ox = 1; oy = 2;
        if (lit) glow('orange', e.x + 9, e.y - 2, 8, 0.8);
        break;
      }
      case 'ghost': {
        const g = e.shy ? ART.ghostShy : ART.ghost;
        ctx.globalAlpha = e.alpha;
        ctx.drawImage(flip ? g.f : g.c, Math.round(e.x) - 2, Math.round(e.y + Math.sin(e.anim * 3) * 1.5) - 1);
        ctx.globalAlpha = 1;
        continue;
      }
      case 'leaper':
        if (e.state === 'wait') continue;
        glow('orange', e.x + 5, e.y + 5, 14, 0.8);
        s = ART.leaper[Math.floor(e.anim * 10) % 2]; ox = 1; oy = 1;
        if (e.vy > 0) { // falling: upside down
          ctx.save(); ctx.translate(Math.round(e.x + 5), Math.round(e.y + 5)); ctx.scale(1, -1);
          ctx.drawImage(s.c, -7, -7); ctx.restore(); continue;
        }
        break;
      case 'cloudy':
        s = ART.cloudy[Math.floor(e.anim * 3) % 2]; ox = 1; oy = 1;
        if (e.state === 'charge') { glow('gold', e.x + 9, e.y + 8, 16, 0.4 + Math.random() * 0.4); if (Math.floor(e.anim * 20) % 2) s = { c: whiteOf(s, false), f: whiteOf(s, true) }; }
        break;
      case 'penguin':
        s = e.state === 'slide' ? ART.penguinSlide : ART.penguin[Math.floor(e.anim * 5) % 2]; ox = 1; oy = 0;
        break;
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
    if (e.type === 'boar' && e.state === 'dizzy') {
      for (let i = 0; i < 3; i++) { const a = e.anim * 6 + (i * Math.PI * 2) / 3; Font.draw('★', e.x + 5 + Math.cos(a) * 8, e.y - 7 + Math.sin(a) * 2, { color: '#ffd84a', shadow: false }); }
    }
  }
  for (const p of level.projectiles) {
    if (p.kind === 'ball') {
      ctx.drawImage(p.vx < 0 ? ART.cannonball.f : ART.cannonball.c, Math.round(p.x) - 1, Math.round(p.y) - 1);
      if (Math.random() < 0.4) addParticle(p.x + 5 - Math.sign(p.vx) * 6, p.y + 5, { col: 'rgba(200,192,216,0.7)', vy: rand(-10, 10), vx: -p.vx * 0.1, life: 0.35, g: -10 });
      continue;
    }
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
