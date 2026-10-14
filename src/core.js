'use strict';
// =====================================================================
//  CORE — constants, math helpers, save data, input
// =====================================================================

// The view is always 216 pixels tall; its width follows the screen's shape
// (16:9 = 384 up to ~20:9 = 480) so wide phones fill the screen with no bars.
const VH = 216, TS = 16;
const VW = (() => {
  const w = window.innerWidth || 16, h = window.innerHeight || 9;
  const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  // phones may boot in portrait before rotating: assume they'll be held sideways
  const ratio = coarse ? Math.max(w, h) / Math.min(w, h) : w / h;
  const v = Math.round((VH * ratio) / 2) * 2;
  return v < 384 ? 384 : v > 480 ? 480 : v;
})();
const STEP = 1 / 60;

const canvas = document.getElementById('game');
canvas.width = VW; canvas.height = VH;
const ctx = canvas.getContext('2d', { alpha: false });
ctx.imageSmoothingEnabled = false;

// ---------- math ----------
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const approach = (v, t, d) => (v < t ? Math.min(v + d, t) : Math.max(v - d, t));
const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const rectHit = (ax, ay, aw, ah, bx, by, bw, bh) => ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
const boxHit = (a, b) => rectHit(a.x, a.y, a.w, a.h, b.x, b.y, b.w, b.h);
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t) => -(Math.cos(Math.PI * t) - 1) / 2;
const easeOutBack = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
}
function mixColor(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return rgbToHex(lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t));
}
function shade(hex, amt) { return amt >= 0 ? mixColor(hex, '#ffffff', amt) : mixColor(hex, '#000000', -amt); }

function formatTime(sec, withMs = true) {
  if (sec == null || !isFinite(sec)) return '--:--';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const cs = Math.floor((sec % 1) * 100);
  const base = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return withMs ? `${base}.${String(cs).padStart(2, '0')}` : base;
}

// ---------- save data ----------
const SAVE_KEY = 'mossys-climb-save-v2';
const Save = {
  data: null,
  defaults() {
    return {
      version: 2,
      unlocked: 1,
      char: 'mossy',
      secret: false,
      seenIntro: false,
      levels: {},
      totalDeaths: 0,
      settings: { music: 0.55, sfx: 0.8, shake: true, timer: true, assist: false, touch: 'auto', touchSize: 1, vibrate: true },
    };
  },
  load() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { d = null; }
    const def = this.defaults();
    if (!d || typeof d !== 'object') d = def;
    for (const k in def) if (!(k in d)) d[k] = def[k];
    for (const k in def.settings) if (!(k in d.settings)) d.settings[k] = def.settings[k];
    this.data = d;
  },
  write() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.data)); } catch (e) { /* storage unavailable */ }
  },
  level(i) {
    if (!this.data.levels[i]) this.data.levels[i] = { done: false, best: null, gems: [], deaths: 0, stars: [false, false, false] };
    return this.data.levels[i];
  },
  reset() {
    const keepSettings = this.data.settings;
    this.data = this.defaults();
    this.data.settings = keepSettings;
    this.write();
  },
};
Save.load();
const settings = () => Save.data.settings;

// ---------- input ----------
const Input = (() => {
  const KEYMAP = {
    left: ['ArrowLeft', 'KeyA'],
    right: ['ArrowRight', 'KeyD'],
    up: ['ArrowUp', 'KeyW'],
    down: ['ArrowDown', 'KeyS'],
    jump: ['Space', 'KeyZ', 'KeyK', 'ArrowUp', 'KeyW'],
    action: ['KeyX', 'KeyJ', 'KeyC', 'ShiftLeft', 'ShiftRight'],
    confirm: ['Enter', 'NumpadEnter', 'Space', 'KeyZ'],
    back: ['Escape', 'Backspace', 'KeyX'],
    pause: ['Escape', 'KeyP', 'Enter'],
    retry: ['KeyR'],
    mute: ['KeyM'],
    fullscreen: ['KeyF'],
  };
  const PADMAP = {
    left: [14], right: [15], up: [12], down: [13],
    jump: [0], action: [2, 1, 5, 7], confirm: [0], back: [1], pause: [9], retry: [8],
    mute: [], fullscreen: [],
  };
  const ACTIONS = Object.keys(KEYMAP);
  const keysDown = new Set();
  const keyLatch = new Set();
  const touchState = {};
  const touchLatch = new Set();
  const padLatchPrev = {};
  const cur = {}, prev = {}, pressed = {}, released = {};
  let anyPressed = false, anyLatch = false;
  let device = 'kb';
  const pointer = { x: -1, y: -1, moved: false, clicked: false, down: false, active: false };
  let clickLatch = false;
  let onAnyInput = null;

  const PREVENT = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'Backspace']);
  window.addEventListener('keydown', (e) => {
    if (PREVENT.has(e.code)) e.preventDefault();
    if (e.repeat) return;
    keysDown.add(e.code); keyLatch.add(e.code); anyLatch = true;
    device = 'kb';
    if (onAnyInput) onAnyInput();
  });
  window.addEventListener('keyup', (e) => { keysDown.delete(e.code); });
  window.addEventListener('blur', () => { keysDown.clear(); for (const k in touchState) touchState[k] = false; });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { keysDown.clear(); for (const k in touchState) touchState[k] = false; } });

  // pointer on canvas (menus, HUD buttons)
  function toLogical(e) {
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * VW, y: ((e.clientY - r.top) / r.height) * VH };
  }
  canvas.addEventListener('pointermove', (e) => {
    const p = toLogical(e); pointer.x = p.x; pointer.y = p.y; pointer.moved = true;
    if (e.pointerType === 'mouse') pointer.active = true;
  });
  canvas.addEventListener('pointerdown', (e) => {
    const p = toLogical(e); pointer.x = p.x; pointer.y = p.y;
    pointer.down = true; clickLatch = true; anyLatch = true;
    pointer.active = true;
    if (e.pointerType === 'touch') device = 'touch';
    if (onAnyInput) onAnyInput();
  });
  window.addEventListener('pointerup', () => { pointer.down = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // On-screen controls. Rather than demanding exact button hits, the screen is split into
  // forgiving zones: the left 45% is movement (left/right decided by which side of the gap
  // between the two arrows the thumb is on, so it can rock or slide between them), and the
  // whole lower right is JUMP except the POWER button. Every touch is re-evaluated on every
  // event, so multi-touch and sliding fingers just work.
  const TOUCH_ACTS = ['left', 'right', 'down', 'jump', 'action', 'pause'];
  function bindTouchPad(root) {
    if (!root) return;
    const el = (id) => document.getElementById(id);
    const btn = { left: el('b-left'), right: el('b-right'), down: el('b-down'), jump: el('b-jump'), action: el('b-act'), pause: el('b-pause') };
    const box = (e, pad = 0) => { const r = e.getBoundingClientRect(); return { l: r.left - pad, t: r.top - pad, r: r.right + pad, b: r.bottom + pad }; };
    const inside = (x, y, R) => x >= R.l && x <= R.r && y >= R.t && y <= R.b;
    const recompute = (e) => {
      if (e.cancelable) e.preventDefault();
      const W = window.innerWidth, H = window.innerHeight;
      const L = box(btn.left), R = box(btn.right), D = box(btn.down, 8), A = box(btn.action, 12), Pz = box(btn.pause, 12);
      const mid = (L.r + R.l) / 2;
      const hasPower = btn.action.style.visibility !== 'hidden';
      const next = {};
      for (const t of e.touches) {
        const x = t.clientX, y = t.clientY;
        if (inside(x, y, Pz)) { next.pause = true; continue; }
        if (x < W * 0.45) {
          if (y < H * 0.28) continue;
          if (inside(x, y, D)) next.down = true;
          else if (x < mid) next.left = true;
          else next.right = true;
        } else if (y > H * 0.24) {
          if (hasPower && inside(x, y, A)) next.action = true;
          else next.jump = true;
        }
      }
      for (const a of TOUCH_ACTS) {
        if (next[a] && !touchState[a]) {
          touchLatch.add(a);
          if ((a === 'jump' || a === 'action') && Save.data.settings.vibrate && navigator.vibrate) { try { navigator.vibrate(10); } catch (err) { /* unsupported */ } }
        }
        touchState[a] = !!next[a];
        if (btn[a]) btn[a].classList.toggle('on', !!next[a]);
      }
      device = 'touch'; anyLatch = true;
      if (onAnyInput) onAnyInput();
    };
    for (const ev of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) root.addEventListener(ev, recompute, { passive: false });
  }
  function releaseTouches() { for (const a of TOUCH_ACTS) touchState[a] = false; }

  function pollPad(curOut, latchOut) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const gp of pads) {
      if (!gp || !gp.connected) continue;
      const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
      for (const a of ACTIONS) {
        let v = PADMAP[a].some((i) => gp.buttons[i] && gp.buttons[i].pressed);
        if (a === 'left' && ax < -0.45) v = true;
        if (a === 'right' && ax > 0.45) v = true;
        if (a === 'up' && ay < -0.6) v = true;
        if (a === 'down' && ay > 0.6) v = true;
        if (v) {
          curOut[a] = true;
          if (!padLatchPrev[gp.index + a]) { latchOut.add(a); device = 'pad'; if (onAnyInput) onAnyInput(); }
        }
        padLatchPrev[gp.index + a] = v;
      }
    }
  }

  function poll() {
    const padCur = {}; const padLatch = new Set();
    pollPad(padCur, padLatch);
    anyPressed = anyLatch || padLatch.size > 0;
    anyLatch = false;
    for (const a of ACTIONS) {
      const k = KEYMAP[a].some((c) => keysDown.has(c));
      const t = !!touchState[a];
      const now = k || t || !!padCur[a];
      const latched = KEYMAP[a].some((c) => keyLatch.has(c)) || touchLatch.has(a) || padLatch.has(a);
      pressed[a] = (now && !prev[a]) || latched;
      released[a] = !now && prev[a];
      prev[a] = now;
      cur[a] = now;
    }
    keyLatch.clear(); touchLatch.clear();
    pointer.clicked = clickLatch; clickLatch = false;
  }

  function consume(a) { pressed[a] = false; }
  function clearAll() { for (const a of ACTIONS) { pressed[a] = false; } pointer.clicked = false; anyPressed = false; }

  return {
    poll, consume, clearAll, bindTouchPad, releaseTouches, pointer,
    held: cur, pressed, released,
    get any() { return anyPressed; },
    get device() { return device; },
    set onAny(fn) { onAnyInput = fn; },
    hasTouch: ('ontouchstart' in window) || (navigator.maxTouchPoints > 0),
  };
})();

// Human-readable control names for the current input device
function keyName(action) {
  const d = Input.device;
  if (d === 'pad') return { jump: 'A', action: 'X', pause: 'START', confirm: 'A', back: 'B', retry: 'SELECT', down: 'DOWN' }[action] || action.toUpperCase();
  if (d === 'touch') return { jump: 'JUMP', action: 'POWER', pause: 'II', confirm: 'TAP', back: 'BACK', retry: 'RETRY', down: 'DOWN' }[action] || action.toUpperCase();
  return { jump: 'SPACE', action: 'X', pause: 'ESC', confirm: 'ENTER', back: 'ESC', retry: 'R', down: 'DOWN' }[action] || action.toUpperCase();
}
