// Runs inside the game's VM context (has access to all game globals).
function __verify(idx, opt) {
  const problems = [], warnings = [];
  startLevel(idx);
  const L = level, def = L.def;
  const at = (tx, ty) => (tx < 0 || ty < 0 || tx >= L.w || ty >= L.h ? (ty >= L.h ? '.' : '#') : def.map[ty][tx]);
  const solidCh = (c) => '#IX()ER[]'.includes(c);
  const floorCh = (c) => solidCh(c) || c === '=' || c === '~';

  // ------------------------------------------------------------ static checks
  if (!THEMES[def.theme]) problems.push(`unknown theme ${def.theme}`);
  if (!def.par) warnings.push('no par time');
  const signCount = def.map.join('').split('?').length - 1;
  if (signCount !== (def.signs || []).length) problems.push(`${signCount} signs in map but ${(def.signs || []).length} sign texts`);
  for (const ev of L.events) {
    if (ev.trigger && !L.triggers[ev.trigger]) problems.push(`event ${ev.type} trigger '${ev.trigger}' not in map`);
    for (const m of [ev.marker, ev.from, ev.to, ev.gate, ...(ev.markers || [])].filter(Boolean)) if (!L.markers[m]) problems.push(`event ${ev.type} marker '${m}' not in map`);
  }
  const usedTriggers = new Set(L.events.map((e) => e.trigger));
  for (const t in L.triggers) if (!usedTriggers.has(t)) warnings.push(`trigger '${t}' has no event`);
  for (let ty = 0; ty < L.h; ty++) for (let tx = 0; tx < L.w; tx++) {
    const c = def.map[ty][tx], below = at(tx, ty + 1), above = at(tx, ty - 1);
    const where = `'${c}' at ${tx},${ty}`;
    if ('PSF?TBNQGMA{_'.includes(c) && !floorCh(below)) problems.push(`${where} is not standing on ground`);
    if (c === '`' && !L.enemySpawns.some((e) => e.type === 'cloudy')) problems.push(`${where} cloud missing`);
    if ((c === 'Y' || c === '!') && !solidCh(above)) problems.push(`${where} needs a ceiling right above`);
    if (c === 'H' || c === 'V') {
      if (at(tx + 1, ty) !== '.') problems.push(`${where}: platform needs an empty tile to its right`);
    }
    if (c === 'K' && (at(tx + 1, ty) !== '.' || at(tx, ty + 1) !== '.' || at(tx + 1, ty + 1) !== '.')) problems.push(`${where}: crusher needs a 2x2 empty space`);
    if (c === '*' && solidCh(at(tx, ty))) problems.push(`${where} gem inside ground`);
  }
  for (const s of L.saws) if (s.axis && s.max - s.min < 16) problems.push(`saw at ${Math.floor(s.x0 / TS)},${Math.floor(s.y0 / TS)} has no room to move`);
  for (const p of L.platforms) if (p.max - p.min < 16) problems.push(`platform at ${p.x0 / TS},${p.y0 / TS} has no room to move (${p.max - p.min}px)`);
  for (const k of L.crushers) {
    let found = false;
    for (let y = k.y / TS + 2; y < k.y / TS + 14; y++) if (solidCh(at(k.x / TS, y))) { found = true; break; }
    if (!found) problems.push(`crusher at ${k.x / TS},${k.y / TS} has no floor below`);
  }
  for (const c of L.collapses) {
    const [x, y] = c.cells[c.cells.length - 1];
    let floor = false;
    for (let yy = y + 1; yy < L.h; yy++) if (floorCh(at(x, yy))) { floor = true; break; }
    if (!floor) warnings.push(`collapse group near ${x},${y} drops into a bottomless pit`);
  }
  {
    const s = L.spawn;
    if (solidRect(s.x, s.y, 10, 14)) problems.push('spawn inside a wall');
  }

  // ------------------------------------------------------------ search
  enemies = [];
  const ghosts = [];
  for (const p of L.platforms) {
    if (p.axis === 'x') for (let x = p.min; x <= p.max; x += 8) ghosts.push({ ...p, x, dx: 0, dy: 0 });
    else for (let y = p.min; y <= p.max; y += 8) ghosts.push({ ...p, y, dx: 0, dy: 0 });
  }
  L.platforms = ghosts;
  setupPlayer('bruno');
  player.char = opt.char === 'base' ? { ...charById('bruno'), ability: 'none', speed: 106 } : charById(opt.char);
  const P = player;

  const targets = [];
  L.gems.forEach((g) => { if (!g.mimic) targets.push({ kind: 'gem', x: g.x, y: g.y, w: 12, h: 10, tile: [Math.floor(g.x / TS), Math.floor(g.y / TS)] }); });
  L.enemySpawns.filter((s) => s.type === 'mimic').forEach((s) => targets.push({ kind: 'gem', x: s.tx * TS - 8, y: s.ty * TS - 8, w: 32, h: 24, tile: [s.tx, s.ty], mimic: true }));
  L.checkpoints.forEach((c) => targets.push({ kind: 'cp', x: c.x - 2, y: c.y - 8, w: 20, h: 24, tile: [c.x / TS, c.y / TS] }));
  L.hearts.forEach((h) => targets.push({ kind: 'heart', x: h.x, y: h.y, w: 9, h: 8, tile: [Math.floor(h.x / TS), Math.floor(h.y / TS)] }));
  if (L.finish) targets.push({ kind: 'finish', x: L.finish.x - 2, y: L.finish.y - 16, w: 20, h: 32, tile: [L.finish.x / TS, L.finish.y / TS] });
  const run = L.events.find((e) => e.type === 'flagRun');
  if (run) for (const m of run.markers || []) for (const mk of L.markers[m] || []) targets.push({ kind: 'finish', x: mk.x - 2, y: mk.y - 16, w: 20, h: 32, tile: [mk.tx, mk.ty], hop: m });
  const arena = L.events.find((e) => e.type === 'arena');
  if (arena) for (const r of L.triggers[arena.trigger] || []) targets.push({ kind: 'finish', x: r.x, y: r.y, w: r.w, h: r.h, tile: [r.x / TS, r.y / TS], arena: true });

  const usesAbility = P.char.ability !== 'none' && P.char.ability !== 'grip';
  const ACTIONS = [];
  for (const ix of [-1, 0, 1]) for (const j of ['press', 'hold', 'off']) {
    ACTIONS.push({ ix, j, a: false, d: false });
    if (usesAbility && j !== 'hold') ACTIONS.push({ ix, j, a: true, d: false });
  }
  ACTIONS.push({ ix: 0, j: 'press', a: false, d: true }); // drop through planks
  const beats = L.beats.length > 0;
  let bt = 0; // beat clock of the state being expanded
  const applyBeat = (t) => { const ph = Math.floor(t / BEAT_PERIOD) % 2; for (const b of L.beats) L.grid[b.ty * L.w + b.tx] = b.group === ph ? T.BEAT : T.EMPTY; };
  const FIELDS = ['x', 'y', 'remX', 'remY', 'vx', 'vy', 'facing', 'onGround', 'ground', 'wasGround', 'coyote', 'buffer', 'varJump', 'springLock', 'wallDir', 'wallLock', 'canDouble', 'canDash', 'dashT', 'dashCd', 'slam', 'slamT', 'dropT', 'drop', 'prevBottom'];
  const snap = () => { const s = { bt }; for (const f of FIELDS) s[f] = P[f]; return s; };
  const restore = (s) => { for (const f of FIELDS) P[f] = s[f]; bt = s.bt; P.dead = false; P.poof = 0; P.invuln = 0; P.hurtLock = 0; P.trail.length = 0; P.power = null; P.shield = false; };
  // the beat clock only matters near beat blocks; elsewhere states merge regardless of timing
  const nearBeat = (x, y) => L.beats.some((b) => Math.abs(b.tx * TS - x) < TS * 5 && Math.abs(b.ty * TS - y) < TS * 7);
  const beatKey = () => (beats && nearBeat(P.x, P.y) ? '|' + (Math.floor(bt * 5) % Math.round(BEAT_PERIOD * 10)) : '');
  // coarse state key: grounded states only care about position + speed; airborne ones about velocity too
  const key = () => (P.onGround
    ? `g${P.x >> 2},${P.y >> 2},${Math.round(P.vx / 40)}`
    : `a${P.x >> 2},${P.y >> 2},${Math.round(P.vx / 40)},${Math.round(P.vy / 50)},${+P.varJump}${+P.canDouble}${+P.canDash}${+(P.wallLock > 0)}${P.slam}${+(P.rollT > 0)}`) + beatKey();
  const H = Input.held, PR = Input.pressed;

  function sim(a, frames, tg, hit) {
    for (let f = 0; f < frames; f++) {
      H.left = a.ix < 0; H.right = a.ix > 0; H.down = a.d; H.up = false;
      H.jump = a.j !== 'off'; H.action = a.a;
      PR.jump = a.j === 'press' && f === 0; PR.action = a.a && f === 0; PR.down = a.d && f === 0;
      PR.left = PR.right = PR.up = false;
      fx.particles.length = 0;
      if (beats) { bt += STEP; applyBeat(bt); }
      updatePlayer(STEP);
      springContacts();
      if (P.dead || P.poof > 0) return false;
      for (let i = 0; i < tg.length; i++) if (!hit.has(i) && rectHit(P.x, P.y, P.w, P.h, tg[i].x, tg[i].y, tg[i].w, tg[i].h)) hit.add(i);
    }
    return true;
  }

  function search(sx, sy, tg, max, stopWhenAll) {
    placePlayer(sx, sy); P.invuln = 0; bt = 0; if (beats) applyBeat(0);
    const hit = new Set();
    const seen = new Set();
    const queue = [snap()];
    seen.add(key());
    let head = 0;
    while (head < queue.length && seen.size < max) {
      const s = queue[head++];
      for (const a of ACTIONS) {
        if (a.j === 'hold' && !s.varJump) continue; // identical to releasing
        restore(s);
        if (!sim(a, opt.frames, tg, hit)) continue;
        const k = key();
        if (seen.has(k)) continue;
        seen.add(k); queue.push(snap());
      }
      if (stopWhenAll && hit.size === tg.length) break;
    }
    return { hit, states: seen.size, capped: seen.size >= max };
  }

  let sx = L.spawn.x, sy = L.spawn.y;
  if (opt.start) { const [tx, ty] = String(opt.start).split(',').map(Number); sx = tx * TS + 3; sy = ty * TS + TS - 14; }
  const main = search(sx, sy, targets, opt.max, true);
  // second world: every cracked floor has collapsed (stepping on it does that in game)
  const setCollapsed = (on) => { for (const c of L.collapses) for (const [x, y] of c.cells) L.grid[y * L.w + x] = on ? T.EMPTY : T.COLLAPSE; };
  const collapseProbes = [];
  if (L.collapses.length) {
    setCollapsed(true);
    const rest = targets.map((t, i) => (main.hit.has(i) ? null : t));
    const idxs = rest.map((t, i) => (t ? i : -1)).filter((i) => i >= 0);
    if (idxs.length) {
      const r = search(L.spawn.x, L.spawn.y, idxs.map((i) => targets[i]), opt.max, true);
      r.hit.forEach((j) => main.hit.add(idxs[j]));
    }
    for (const c of L.collapses) {
      const [x, y0] = c.cells[0];
      for (let y = y0 + 1; y < L.h; y++) if (isSolidT(tileAt(x, y)) || tileAt(x, y) === T.ONEWAY) { collapseProbes.push({ x: x * TS + 3, y: y * TS - 14, name: `the pit under cracked floor at ${x},${y0}` }); break; }
    }
    setCollapsed(false);
  }
  if (L.powerups.some((o) => o.kind === 'wings')) {
    const idxs = targets.map((t, i) => (main.hit.has(i) ? -1 : i)).filter((i) => i >= 0);
    if (idxs.length) {
      const saved = P.char;
      P.char = { ...saved, ability: 'double' };
      const r = search(sx, sy, idxs.map((i) => targets[i]), opt.max, true);
      r.hit.forEach((j) => { main.hit.add(idxs[j]); warnings.push(`${targets[idxs[j]].kind} at ${targets[idxs[j]].tile} needs the wings (or a double jump)`); });
      P.char = saved;
    }
  }
  const missed = targets.filter((t, i) => !main.hit.has(i));
  for (const t of missed) {
    if (t.kind === 'finish') problems.push(`FINISH${t.hop ? ' (hop ' + t.hop + ')' : t.arena ? ' (boss arena)' : ''} unreachable at ${t.tile}`);
    else if (t.kind === 'gem') problems.push(`gem${t.mimic ? ' mimic' : ''} unreachable at ${t.tile}`);
    else if (t.kind === 'cp') problems.push(`checkpoint unreachable at ${t.tile}`);
    else problems.push(`heart unreachable at ${t.tile}`);
  }
  if (main.capped) warnings.push(`search capped at ${opt.max} states`);

  // no soft-locks: the finish must be reachable from every checkpoint and probe point
  const finishTargets = targets.filter((t) => t.kind === 'finish' && !t.hop);
  const probes = L.checkpoints.map((c) => ({ x: c.x + 3, y: c.y + TS - 14, name: `checkpoint ${c.x / TS},${c.y / TS}` }));
  for (const [tx, ty] of (def.verify && def.verify.from) || []) probes.push({ x: tx * TS + 3, y: ty * TS + TS - 14, name: `probe ${tx},${ty}` });
  const tgFinish = (run ? targets.filter((t) => t.kind === 'finish') : finishTargets).slice(-1);
  if (!opt.noProbe) for (const pr of probes) {
    const r = search(pr.x, pr.y, tgFinish, opt.max, true);
    if (r.hit.size === 0) problems.push(`soft-lock: cannot reach the finish from ${pr.name}${r.capped ? ' (search capped)' : ''}`);
  }
  if (!opt.noProbe && collapseProbes.length) {
    setCollapsed(true);
    for (const pr of collapseProbes) {
      const r = search(pr.x, pr.y, tgFinish, opt.max, true);
      if (r.hit.size === 0) problems.push(`soft-lock: cannot reach the finish from ${pr.name}${r.capped ? ' (search capped)' : ''}`);
    }
    setCollapsed(false);
  }

  return {
    name: def.name, w: L.w, h: L.h, states: main.states,
    gemTotal: targets.filter((t) => t.kind === 'gem').length, gemsReached: targets.filter((t, i) => t.kind === 'gem' && main.hit.has(i)).length,
    cpTotal: L.checkpoints.length, cpReached: targets.filter((t, i) => t.kind === 'cp' && main.hit.has(i)).length,
    heartTotal: L.hearts.length, heartsReached: targets.filter((t, i) => t.kind === 'heart' && main.hit.has(i)).length,
    finish: missed.some((t) => t.kind === 'finish') ? 'NO' : 'yes', problems, warnings,
  };
}
