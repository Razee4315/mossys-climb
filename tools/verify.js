// Headless level verifier: runs the REAL game physics (all src files compiled
// into one function, same as the browser bundle) and searches the space of
// inputs to prove every level can be finished and every gem / checkpoint /
// heart can be reached.
//
//   node tools/verify.js              -> all levels
//   node tools/verify.js 3            -> level 3 only
//   node tools/verify.js 3 --char=pip --max=600000 --noProbe
const fs = require('fs');
const path = require('path');

const ORDER = ['core', 'font', 'audio', 'art', 'themes', 'levels', 'world', 'hazards', 'powerups', 'player', 'enemies', 'game', 'ui', 'opening'];
const SRC = path.join(__dirname, '..', 'src');

function fakeCtx(canvas) {
  const base = {
    canvas,
    createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
  };
  return new Proxy(base, { get: (t, k) => (k in t ? t[k] : () => {}), set: (t, k, v) => ((t[k] = v), true) });
}
function fakeCanvas() {
  const c = { width: 300, height: 150, style: {}, addEventListener() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 384, height: 216 }), classList: { toggle() {} } };
  c.getContext = () => c._ctx || (c._ctx = fakeCtx(c));
  return c;
}

// Compile the game into a plain function; returns { verify, run(code) }
function makeGame() {
  const gameCanvas = fakeCanvas();
  const env = {
    document: { getElementById: (id) => (id === 'game' ? gameCanvas : null), createElement: () => fakeCanvas(), addEventListener() {}, hidden: false, documentElement: {} },
    navigator: { maxTouchPoints: 0, getGamepads: () => [] },
    localStorage: { getItem: () => null, setItem() {} },
    requestAnimationFrame: () => 0, setInterval: () => 0, setTimeout: () => 0, clearInterval() {},
    location: { search: '' },
  };
  env.window = { addEventListener() {}, AudioContext: undefined };
  const code = ORDER.map((f) => fs.readFileSync(path.join(SRC, f + '.js'), 'utf8').replace(/^'use strict';/, '')).join('\n')
    + '\n' + fs.readFileSync(path.join(__dirname, 'verify-inside.js'), 'utf8')
    + '\nreturn { verify: __verify, run: (s) => eval(s) };';
  const names = Object.keys(env);
  const fn = new Function(...names, code);
  return fn(...names.map((n) => env[n]));
}

module.exports = { makeGame };

if (require.main === module) {
  const args = process.argv.slice(2);
  const only = args.find((a) => /^\d+$/.test(a));
  const opt = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => { const [k, v] = a.slice(2).split('='); return [k, v == null ? true : v]; }));
  const game = makeGame();
  const n = game.run('LEVELS.length');
  let failed = 0;
  for (let i = 0; i < n; i++) {
    if (only && Number(only) !== i + 1) continue;
    const t0 = Date.now();
    const r = game.verify(i, { char: opt.char || 'base', max: Number(opt.max || 600000), frames: Number(opt.frames || 4), noProbe: !!opt.noProbe, start: opt.start });
    const dt = ((Date.now() - t0) / 1000).toFixed(1);
    const ok = r.problems.length === 0;
    if (!ok) failed++;
    console.log(`\nLEVEL ${i + 1} ${r.name}  [${r.w}x${r.h}]  ${ok ? 'OK' : 'PROBLEMS'}  (${r.states} states, ${dt}s)`);
    console.log(`  gems ${r.gemsReached}/${r.gemTotal}   checkpoints ${r.cpReached}/${r.cpTotal}   hearts ${r.heartsReached}/${r.heartTotal}   finish ${r.finish}`);
    for (const p of r.problems) console.log('  ✗ ' + p);
    for (const w of r.warnings) console.log('  ! ' + w);
  }
  process.exit(failed ? 1 : 0);
}
