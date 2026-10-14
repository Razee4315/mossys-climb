// =====================================================================
//  PLAYER — movement feel, abilities, damage, respawn
// =====================================================================
const PHYS = {
  JUMP_V: 315, G_UP: 900, G_CUT: 2300, G_DOWN: 1150, APEX_V: 40, MAX_FALL: 290, FAST_FALL: 370,
  ACC_G: 1150, DEC_G: 1600, ACC_A: 780, DEC_A: 400, ICE_ACC: 280, ICE_DEC: 110,
  COYOTE: 0.1, BUFFER: 0.13, WJ_X: 150, WJ_V: 300, WJ_LOCK: 0.14, SLIDE: 72, GRIP_SLIDE: 36,
  DJ_V: 285, DASH_V: 300, DASH_T: 0.15, SLAM_V: 430, SPRING_V: 470,
};

const player = {
  x: 0, y: 0, w: 10, h: 14, remX: 0, remY: 0, vx: 0, vy: 0, facing: 1,
  char: CHARACTERS[0], onGround: false, ground: null, wasGround: false, coyote: 0, buffer: 0, varJump: false, springLock: 0,
  wallDir: 0, wallLock: 0, canDouble: true, canDash: true, dashT: 0, dashCd: 0, slam: 0, slamT: 0,
  hearts: 3, maxHearts: 3, invuln: 0, hurtLock: 0, dead: false, deadT: 0, poof: 0, poofTarget: null,
  safe: null, drop: false, dropT: 0, sx: 1, sy: 1, anim: 0, dustT: 0, prevBottom: 0, trail: [], idleT: 0,
};

function has(ability) {
  const a = player.char.ability;
  return a === ability || (a === 'all' && ability !== 'slam');
}

function setupPlayer(charId) {
  const p = player;
  p.char = charById(charId);
  p.maxHearts = p.char.hearts;
  p.hearts = p.maxHearts;
}

function placePlayer(x, y) {
  const p = player;
  Object.assign(p, {
    x, y, remX: 0, remY: 0, vx: 0, vy: 0, onGround: false, ground: null, wasGround: true, coyote: 0, buffer: 0, varJump: false,
    wallDir: 0, wallLock: 0, canDouble: true, canDash: true, dashT: 0, dashCd: 0, slam: 0, slamT: 0, invuln: 0.6, hurtLock: 0,
    dead: false, deadT: 0, poof: 0, poofTarget: null, drop: false, dropT: 0, sx: 1, sy: 1, trail: [], springLock: 0,
  });
  p.safe = { x, y };
}

function respawnAtCheckpoint() {
  const L = level;
  resetDynamic();
  const cp = L.checkpoint;
  const pos = cp ? { x: cp.x + 3, y: cp.y + TS - player.h } : L.spawn;
  placePlayer(pos.x, pos.y);
  player.hearts = player.maxHearts;
  player.facing = 1;
  updateCamera(0, true);
}

// ---------------------------------------------------------------------
function updatePlayer(dt) {
  const p = player, I = Input.held, IP = Input.pressed;
  if (p.dead) {
    p.deadT -= dt;
    return;
  }
  if (p.poof > 0) { // spike / pit: brief freeze, then pop back to safe ground
    p.poof -= dt;
    if (p.poof <= 0) {
      placePlayer(p.poofTarget.x, p.poofTarget.y);
      p.invuln = 1.0;
      burst(p.x + 5, p.y + 7, '#ffffff', 12, 50);
    }
    return;
  }
  p.prevBottom = p.y + p.h;
  p.invuln = Math.max(0, p.invuln - dt);
  p.hurtLock = Math.max(0, p.hurtLock - dt);
  p.wallLock = Math.max(0, p.wallLock - dt);
  p.dashCd = Math.max(0, p.dashCd - dt);
  p.springLock = Math.max(0, p.springLock - dt);
  p.dropT = Math.max(0, p.dropT - dt);
  p.drop = p.dropT > 0;

  // riding a moving platform
  if (p.ground && p.ground.kind === 'platform') {
    const mp = p.ground.plat;
    if (mp.dx) moveX(p, mp.dx);
    if (mp.dy) { if (mp.dy < 0) moveY(p, mp.dy, false); else { p.y += mp.dy; if (solidRect(p.x, p.y, p.w, p.h)) p.y -= mp.dy; } }
  }

  let ix = p.hurtLock > 0 ? 0 : (I.right ? 1 : 0) - (I.left ? 1 : 0);
  const C = p.char;
  const onIce = p.onGround && p.ground && p.ground.kind === 'ice';
  const wind = level.weather.gust && level.weather.gust.active ? level.weather.gust.dir : 0;

  // ---- horizontal ----
  if (p.dashT > 0) {
    p.dashT -= dt;
    p.vx = p.facing * PHYS.DASH_V; p.vy = 0;
    if (Math.random() < 0.9) p.trail.push({ x: p.x, y: p.y, t: 0.25, f: p.facing });
    if (p.dashT <= 0) p.vx = p.facing * C.speed;
  } else if (p.slam === 1) {
    p.vx = 0;
  } else {
    let acc = p.onGround ? (onIce ? PHYS.ICE_ACC : PHYS.ACC_G) : PHYS.ACC_A;
    const dec = p.onGround ? (onIce ? PHYS.ICE_DEC : PHYS.DEC_G) : PHYS.DEC_A;
    if (p.wallLock > 0) { /* keep wall-jump momentum */ }
    else if (ix !== 0) {
      if (p.vx !== 0 && Math.sign(p.vx) !== ix && p.onGround && !onIce) acc *= 1.8;
      if (Math.abs(p.vx) > C.speed && Math.sign(p.vx) === ix) p.vx = approach(p.vx, ix * C.speed, dec * dt);
      else p.vx = approach(p.vx, ix * C.speed, acc * dt);
      p.facing = ix;
    } else p.vx = approach(p.vx, 0, dec * dt);
    if (wind) p.vx += wind * (p.onGround ? 260 : 420) * dt;
  }

  // ---- walls ----
  p.wallDir = 0;
  let nearWall = 0;
  if (!p.onGround && p.dashT <= 0) {
    if (solidRect(p.x + 2, p.y + 2, p.w, p.h - 4)) nearWall = 1;
    else if (solidRect(p.x - 2, p.y + 2, p.w, p.h - 4)) nearWall = -1;
    if (ix !== 0 && ix === nearWall && solidRect(p.x + ix, p.y + 2, p.w, p.h - 4) && p.vy > -20) p.wallDir = ix;
  }

  // ---- timers ----
  if (p.onGround) { p.coyote = PHYS.COYOTE; p.canDouble = true; p.canDash = true; }
  else p.coyote = Math.max(0, p.coyote - dt);
  if (p.wallDir) { p.canDash = true; }
  if (IP.jump) p.buffer = PHYS.BUFFER; else p.buffer = Math.max(0, p.buffer - dt);

  // drop through one-way platforms
  if (p.onGround && p.ground && (p.ground.kind === 'oneway' || p.ground.kind === 'platform') && I.down && IP.jump) {
    p.dropT = 0.18; p.drop = true; p.buffer = 0; p.y += 1; p.onGround = false; p.coyote = 0;
  }

  // ---- jumping ----
  if (p.buffer > 0 && p.slam === 0) {
    if (p.coyote > 0) {
      p.vy = -PHYS.JUMP_V; p.coyote = 0; p.buffer = 0; p.varJump = true;
      if (p.ground && p.ground.kind === 'platform' && p.ground.plat.dy < 0) p.vy += p.ground.plat.dy * 30;
      p.onGround = false; p.ground = null;
      p.sx = 0.72; p.sy = 1.32;
      dust(p.x + 5, p.y + p.h, 5);
      Sound.sfx('jump');
      stats.jumps++;
    } else if (nearWall !== 0) {
      const grip = has('grip');
      p.vx = -nearWall * PHYS.WJ_X; p.vy = -(grip ? PHYS.WJ_V + 30 : PHYS.WJ_V);
      p.wallLock = PHYS.WJ_LOCK; p.facing = -nearWall; p.buffer = 0; p.varJump = true;
      p.sx = 0.75; p.sy = 1.25;
      for (let i = 0; i < 6; i++) addParticle(p.x + (nearWall > 0 ? p.w : 0), p.y + rand(2, 12), { vx: -nearWall * rand(20, 60), vy: rand(-30, 10), col: '#ffffff', life: 0.3, g: 50 });
      Sound.sfx('walljump');
    } else if (has('double') && p.canDouble) {
      p.vy = -PHYS.DJ_V; p.canDouble = false; p.buffer = 0; p.varJump = true;
      p.sx = 0.8; p.sy = 1.25;
      for (let i = 0; i < 8; i++) addParticle(p.x + 5 + rand(-6, 6), p.y + p.h, { vx: rand(-40, 40), vy: rand(10, 50), col: pick(['#ffffff', '#a8dcff']), life: 0.4, g: -40 });
      Sound.sfx('djump');
    }
  }

  // ---- powers ----
  if (IP.action && p.hurtLock <= 0) {
    if (has('dash') && p.canDash && p.dashCd <= 0 && p.slam === 0) {
      if (ix) p.facing = ix;
      p.dashT = PHYS.DASH_T; p.canDash = false; p.dashCd = 0.3; p.varJump = false;
      Sound.sfx('dash'); addShake(1.5);
      burst(p.x + 5, p.y + 7, '#ffc07a', 8, 50);
    } else if (has('slam') && !p.onGround && p.slam === 0 && p.dashT <= 0) {
      p.slam = 1; p.slamT = 0.12; p.vx = 0; p.vy = -40;
      Sound.sfx('pop');
    }
  }

  // ---- gravity ----
  if (p.slam === 1) {
    p.slamT -= dt; p.vy = approach(p.vy, 0, 600 * dt);
    if (p.slamT <= 0) { p.slam = 2; p.vy = PHYS.SLAM_V; }
  } else if (p.slam === 2) {
    p.vy = PHYS.SLAM_V;
    if (Math.random() < 0.8) p.trail.push({ x: p.x, y: p.y, t: 0.18, f: p.facing });
  } else if (p.dashT <= 0) {
    if (!I.jump) p.varJump = false;
    let g;
    if (p.vy < 0) g = p.varJump || p.springLock > 0 ? PHYS.G_UP : PHYS.G_CUT;
    else g = PHYS.G_DOWN;
    if (Math.abs(p.vy) < PHYS.APEX_V && (p.varJump || p.springLock > 0)) g *= 0.5;
    p.vy += g * dt;
    let maxFall = I.down && !p.wallDir ? PHYS.FAST_FALL : PHYS.MAX_FALL;
    if (p.wallDir && p.vy > 0) {
      maxFall = has('grip') ? PHYS.GRIP_SLIDE : PHYS.SLIDE;
      if (Math.random() < 0.3) addParticle(p.x + (p.wallDir > 0 ? p.w : 0), p.y + rand(4, 12), { col: '#e8e0d0', life: 0.3, vy: -10, g: 0 });
    }
    if (p.vy > maxFall) p.vy = approach(p.vy, maxFall, 1800 * dt);
  }

  // ---- move X ----
  if (moveX(p, p.vx * dt)) {
    // ledge assist: pop up onto a ledge we only just missed
    let popped = false;
    if (!p.onGround && p.vy > -60 && p.dashT <= 0) {
      for (let up = 1; up <= 4; up++) {
        if (!solidRect(p.x + Math.sign(p.vx), p.y - up, p.w, p.h)) { p.y -= up; p.x += Math.sign(p.vx); popped = true; break; }
      }
    }
    if (!popped) {
      if (p.dashT > 0) { p.dashT = 0; p.vx = 0; addShake(1); }
      p.vx = 0; p.remX = 0;
    }
  }

  // ---- move Y ----
  const vyBefore = p.vy;
  if (moveY(p, p.vy * dt)) {
    if (vyBefore < 0) {
      // corner correction: slide around ceiling corners
      let fixed = false;
      for (let k = 1; k <= 4 && !fixed; k++) {
        for (const s of [1, -1]) {
          if (!solidRect(p.x + s * k, p.y - 1, p.w, p.h) && !solidRect(p.x + s * k, p.y, p.w, p.h)) { p.x += s * k; fixed = true; break; }
        }
      }
      if (!fixed) { p.vy = 0; p.varJump = false; }
    } else {
      p.vy = 0;
    }
  }

  // ---- ground ----
  p.wasGround = p.onGround;
  p.ground = groundUnder(p);
  p.onGround = !!p.ground && p.vy >= 0;
  if (p.onGround && !p.wasGround) onLand(vyBefore);
  if (p.onGround && p.ground.kind === 'collapse') {
    const ty = Math.floor((p.y + p.h) / TS);
    for (const g of level.collapses) if (g.state === 'idle' && g.cells.some(([x, y]) => y === ty && x >= Math.floor(p.x / TS) && x <= Math.floor((p.x + p.w - 1) / TS))) triggerCollapse(g);
  }
  if (p.onGround && p.ground.kind === 'crusher') { /* rides along via crusher update */ }

  // safe ground for spike / pit recovery
  if (p.onGround && (p.ground.kind === 'solid' || p.ground.kind === 'ice') && !hazardAt(p.x - 10, p.y - 4, p.w + 20, p.h + 8)) {
    const by = p.y + p.h;
    const supported = isSolidT(tileAt(Math.floor(p.x / TS), by / TS)) && isSolidT(tileAt(Math.floor((p.x + p.w - 1) / TS), by / TS));
    if (supported && by % TS === 0) p.safe = { x: p.x, y: p.y };
  }

  // ---- animation & juice ----
  p.sx = approach(p.sx, 1, dt * 3.5); p.sy = approach(p.sy, 1, dt * 3.5);
  p.anim += dt * (p.onGround ? Math.max(4, Math.abs(p.vx) / 9) : 6);
  if (p.onGround && Math.abs(p.vx) > 70) { p.dustT -= dt; if (p.dustT <= 0) { p.dustT = 0.13; dust(p.x + 5 - p.facing * 4, p.y + p.h, 1); } }
  if (p.onGround && Math.abs(p.vx) < 5 && !Input.held.down) p.idleT += dt; else p.idleT = 0;
  for (let i = p.trail.length - 1; i >= 0; i--) { p.trail[i].t -= dt; if (p.trail[i].t <= 0) p.trail.splice(i, 1); }

  // ---- hazards ----
  const hz = hazardAt(p.x + 1, p.y + 2, p.w - 2, p.h - 2);
  if (hz) { hazardHit(hz); return; }
  if (p.y > level.h * TS + 24) { hazardHit('pit'); return; }
}

function onLand(vy) {
  const p = player;
  if (p.slam === 2) {
    p.slam = 0;
    addShake(5); Sound.sfx('slam'); fx.hitstop = 0.05;
    burst(p.x + 5, p.y + p.h, '#e8e0d0', 18, 110);
    for (const e of enemies) {
      if (e.alive && e.type !== 'boss' && Math.abs(e.x + e.w / 2 - (p.x + 5)) < 44 && Math.abs(e.y + e.h - (p.y + p.h)) < 20) killEnemy(e, 'slam');
    }
    for (const c of level.crumbles) if (c.state === 'idle' && Math.abs(c.x + 8 - (p.x + 5)) < 24 && Math.abs(c.y - (p.y + p.h)) < 4) { c.state = 'shake'; c.t = 0.05; }
    p.sx = 1.5; p.sy = 0.6;
    return;
  }
  const k = clamp(vy / PHYS.MAX_FALL, 0, 1.2);
  p.sx = 1 + 0.35 * k; p.sy = 1 - 0.3 * k;
  if (vy > 120) { dust(p.x + 5, p.y + p.h, 4 + Math.floor(k * 4)); Sound.sfx('land'); }
}

function hazardHit(kind) {
  const p = player;
  if (p.dead || p.poof > 0) return;
  stats.hits++;
  if (!Save.data.settings.assist) p.hearts--;
  Sound.sfx('hurt'); addShake(3); fx.hitstop = 0.06;
  burst(p.x + 5, p.y + 7, kind === 'lava' ? '#ff7a1a' : '#ffffff', 14, 70);
  if (p.hearts <= 0) { killPlayer(kind); return; }
  // freeze briefly, then pop back to the last safe ground
  p.poof = 0.4; p.poofTarget = p.safe || { x: level.spawn.x, y: level.spawn.y };
  p.vx = p.vy = 0;
  floatText(p.x + 5, p.y - 4, '-1 ♥', '#ff4d6d');
}

function hurtPlayer(fromX, dmg = 1) {
  const p = player;
  if (p.dead || p.poof > 0 || p.invuln > 0) return;
  stats.hits++;
  if (!Save.data.settings.assist) p.hearts -= dmg;
  Sound.sfx('hurt'); addShake(3); fx.hitstop = 0.07;
  burst(p.x + 5, p.y + 7, '#ff4d6d', 10, 60);
  if (p.hearts <= 0) { killPlayer('hit'); return; }
  const dir = p.x + 5 < fromX ? -1 : 1;
  p.vx = dir * 150; p.vy = -210; p.invuln = 1.3; p.hurtLock = 0.28;
  p.dashT = 0; p.slam = 0; p.varJump = false;
}

function killPlayer(cause) {
  const p = player;
  if (p.dead) return;
  p.dead = true; p.deadT = 1.0; p.hearts = 0;
  stats.deaths++; level.deaths++;
  Save.data.totalDeaths++;
  Sound.sfx('death'); addShake(5); fx.hitstop = 0.12;
  const col = cause === 'lava' ? '#ff7a1a' : p.char.pal.A;
  burst(p.x + 5, p.y + 7, col, 24, 110);
  burst(p.x + 5, p.y + 7, '#ffffff', 12, 80);
}

function bouncePlayer(strong) {
  const p = player;
  p.vy = strong ? -340 : -245;
  p.varJump = strong; p.canDouble = true; p.canDash = true; p.slam = 0;
  p.sx = 0.75; p.sy = 1.3;
}

// ---------------------------------------------------------------------
function drawPlayer() {
  const p = player;
  if (p.dead) return;
  const F = ART.chars[p.char.id];
  let s, flip = p.facing < 0;
  if (p.slam) s = F.crouch;
  else if (!p.onGround) {
    if (p.wallDir) { s = F.fall; flip = p.wallDir > 0; }
    else s = p.vy < 0 ? F.jump : F.fall;
  } else if (Math.abs(p.vx) > 10) s = F.run[Math.floor(p.anim) % 4];
  else if (Input.held.down && p.onGround) s = F.crouch;
  else s = F.idle[Math.floor(p.anim * 0.4) % 2];

  // after-images (dash / slam)
  for (const t of p.trail) {
    ctx.globalAlpha = (t.t / 0.25) * 0.5;
    ctx.drawImage(silhouetteCached(s, t.f < 0, p.char.pal.h), Math.round(t.x) - 4, Math.round(t.y) - 4);
  }
  ctx.globalAlpha = 1;
  if (p.invuln > 0 && Math.floor(p.invuln * 14) % 2 === 0 && p.poof <= 0) return;
  const img = p.poof > 0 ? whiteOf(s, flip) : (flip ? s.f : s.c);
  const cx = Math.round(p.x + p.w / 2), by = Math.round(p.y + p.h);
  if (Math.abs(p.sx - 1) < 0.02 && Math.abs(p.sy - 1) < 0.02) {
    ctx.drawImage(img, cx - 9, by - 18 + 0);
  } else {
    const w = img.width * p.sx, h = img.height * p.sy;
    ctx.drawImage(img, Math.round(cx - w / 2), Math.round(by - h + 1 * p.sy), Math.round(w), Math.round(h));
  }
}
const _silCache = new Map();
function silhouetteCached(s, flip, col) {
  const key = s.c;
  let e = _silCache.get(key);
  if (!e) { const a = silhouette(s.c, col); e = { a, f: flipCanvas(a) }; _silCache.set(key, e); }
  return flip ? e.f : e.a;
}
