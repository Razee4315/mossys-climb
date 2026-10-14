// =====================================================================
//  AUDIO — procedural sound effects + chiptune music sequencer
// =====================================================================
const Sound = (() => {
  let ac = null, sfxBus = null, musicBus = null, noiseBuf = null;
  const waves = {};

  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { ac = new AC(); } catch (e) { ac = null; return; }
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -12; comp.ratio.value = 3.5;
    comp.connect(ac.destination);
    sfxBus = ac.createGain(); sfxBus.connect(comp);
    musicBus = ac.createGain(); musicBus.connect(comp);
    applyVolumes();
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    for (const duty of [0.125, 0.25]) {
      const n = 32, re = new Float32Array(n), im = new Float32Array(n);
      for (let k = 1; k < n; k++) {
        re[k] = Math.sin(2 * Math.PI * k * duty) / (k * Math.PI);
        im[k] = (1 - Math.cos(2 * Math.PI * k * duty)) / (k * Math.PI);
      }
      waves[duty === 0.25 ? 'pulse25' : 'pulse12'] = ac.createPeriodicWave(re, im);
    }
    Music._start();
  }

  function applyVolumes() {
    if (!ac) return;
    const s = settings();
    sfxBus.gain.setTargetAtTime(s.sfx * 0.9, ac.currentTime, 0.02);
    musicBus.gain.setTargetAtTime(s.music * 0.42 * Music._duck, ac.currentTime, 0.08);
  }

  function osc(wave) {
    const o = ac.createOscillator();
    if (waves[wave]) o.setPeriodicWave(waves[wave]); else o.type = wave;
    return o;
  }

  function tone({ wave = 'square', f = 440, f1 = 0, dur = 0.1, vol = 0.15, attack = 0.004, delay = 0, lin = false, bus = sfxBus, at = 0 }) {
    if (!ac) return;
    const t = (at || ac.currentTime) + delay;
    const o = osc(wave), g = ac.createGain();
    o.frequency.setValueAtTime(f, t);
    if (f1) { if (lin) o.frequency.linearRampToValueAtTime(f1, t + dur); else o.frequency.exponentialRampToValueAtTime(f1, t + dur); }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus);
    o.start(t); o.stop(t + dur + 0.03);
  }

  function noise({ dur = 0.2, vol = 0.15, delay = 0, type = 'lowpass', f = 2000, f1 = 0, q = 0.8, attack = 0.003, bus = sfxBus, at = 0 }) {
    if (!ac) return;
    const t = (at || ac.currentTime) + delay;
    const src = ac.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const bq = ac.createBiquadFilter(); bq.type = type; bq.Q.value = q;
    bq.frequency.setValueAtTime(f, t);
    if (f1) bq.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bq); bq.connect(g); g.connect(bus);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.03);
  }

  const N = (m) => 440 * Math.pow(2, (m - 69) / 12);
  function arp(notes, step, wave = 'pulse25', vol = 0.1, dur = 0.09) {
    notes.forEach((m, i) => tone({ wave, f: N(m), dur, vol, delay: i * step }));
  }

  let lastPlay = {};
  const FX = {
    jump: () => tone({ wave: 'square', f: rand(210, 230), f1: 520, dur: 0.11, vol: 0.09 }),
    djump: () => { tone({ wave: 'pulse25', f: 380, f1: 900, dur: 0.12, vol: 0.09 }); tone({ wave: 'triangle', f: 1400, f1: 1800, dur: 0.08, vol: 0.06, delay: 0.03 }); },
    walljump: () => { tone({ wave: 'square', f: 260, f1: 640, dur: 0.1, vol: 0.09 }); noise({ dur: 0.05, vol: 0.06, f: 3000 }); },
    land: () => noise({ dur: 0.07, vol: 0.12, f: 700, f1: 200 }),
    dash: () => { noise({ dur: 0.2, vol: 0.2, type: 'bandpass', f: 2200, f1: 500, q: 1.2 }); tone({ wave: 'square', f: 700, f1: 240, dur: 0.14, vol: 0.06 }); },
    slam: () => { tone({ wave: 'sine', f: 140, f1: 38, dur: 0.32, vol: 0.4 }); noise({ dur: 0.3, vol: 0.25, f: 900, f1: 120 }); },
    stomp: () => { tone({ wave: 'square', f: 420, f1: 110, dur: 0.12, vol: 0.12 }); noise({ dur: 0.06, vol: 0.1, f: 1800 }); },
    hurt: () => { tone({ wave: 'square', f: 520, f1: 140, dur: 0.22, vol: 0.12 }); tone({ wave: 'sawtooth', f: 500, f1: 130, dur: 0.22, vol: 0.05 }); },
    death: () => { tone({ wave: 'square', f: 660, f1: 70, dur: 0.55, vol: 0.13 }); noise({ dur: 0.35, vol: 0.12, f: 1200, f1: 150 }); },
    gem: (combo = 0) => { const b = 76 + Math.min(combo, 10); tone({ wave: 'triangle', f: N(b), dur: 0.07, vol: 0.14 }); tone({ wave: 'triangle', f: N(b + 5), dur: 0.16, vol: 0.14, delay: 0.06 }); tone({ wave: 'pulse12', f: N(b + 12), dur: 0.1, vol: 0.03, delay: 0.06 }); },
    heart: () => arp([72, 76, 79, 84], 0.06, 'triangle', 0.14, 0.12),
    checkpoint: () => arp([72, 76, 79, 84, 88], 0.07, 'pulse25', 0.09, 0.14),
    spring: () => { tone({ wave: 'sine', f: 180, f1: 920, dur: 0.28, vol: 0.2 }); tone({ wave: 'triangle', f: 360, f1: 1400, dur: 0.18, vol: 0.06 }); },
    crumble: () => noise({ dur: 0.16, vol: 0.1, f: 1100, f1: 300 }),
    collapse: () => { noise({ dur: 0.6, vol: 0.3, f: 500, f1: 80 }); tone({ wave: 'sine', f: 90, f1: 35, dur: 0.5, vol: 0.25 }); },
    rumble: () => { noise({ dur: 1.6, vol: 0.28, f: 220, f1: 60, attack: 0.2 }); tone({ wave: 'sine', f: 50, f1: 32, dur: 1.4, vol: 0.2, attack: 0.2 }); },
    alarm: () => { for (let i = 0; i < 4; i++) tone({ wave: 'square', f: i % 2 ? 660 : 880, dur: 0.14, vol: 0.07, delay: i * 0.16 }); },
    nope: () => { tone({ wave: 'triangle', f: 700, f1: 260, dur: 0.18, vol: 0.16 }); tone({ wave: 'triangle', f: 260, f1: 760, dur: 0.18, vol: 0.16, delay: 0.18 }); },
    move: () => tone({ wave: 'pulse25', f: 880, dur: 0.035, vol: 0.06 }),
    select: () => { tone({ wave: 'pulse25', f: 660, f1: 1320, dur: 0.09, vol: 0.08 }); },
    back: () => tone({ wave: 'pulse25', f: 660, f1: 330, dur: 0.09, vol: 0.07 }),
    pause: () => arp([79, 72], 0.07, 'triangle', 0.12, 0.1),
    clear: () => { arp([72, 76, 79, 84], 0.09, 'square', 0.08, 0.16); tone({ wave: 'square', f: N(88), dur: 0.5, vol: 0.08, delay: 0.38 }); tone({ wave: 'triangle', f: N(48), dur: 0.8, vol: 0.18, delay: 0.38 }); },
    screech: () => { tone({ wave: 'sawtooth', f: 900, f1: 1500, dur: 0.45, vol: 0.08 }); noise({ dur: 0.4, vol: 0.08, type: 'highpass', f: 3000 }); },
    bosshit: () => { tone({ wave: 'square', f: 240, f1: 50, dur: 0.35, vol: 0.18 }); noise({ dur: 0.3, vol: 0.2, f: 2400, f1: 200 }); },
    explode: () => { noise({ dur: 0.8, vol: 0.4, f: 1400, f1: 60 }); tone({ wave: 'sine', f: 100, f1: 28, dur: 0.7, vol: 0.35 }); },
    thunder: () => { noise({ dur: 0.08, vol: 0.3, type: 'highpass', f: 2500 }); noise({ dur: 1.3, vol: 0.38, f: 1800, f1: 90, delay: 0.04 }); },
    zap: () => tone({ wave: 'pulse12', f: 1200, dur: 0.035, vol: 0.05 }),
    gust: () => noise({ dur: 1.6, vol: 0.16, type: 'bandpass', f: 300, f1: 1400, q: 1.5, attack: 0.4 }),
    spit: () => { noise({ dur: 0.05, vol: 0.08, f: 2500 }); tone({ wave: 'square', f: 520, f1: 200, dur: 0.08, vol: 0.06 }); },
    squeak: () => { tone({ wave: 'triangle', f: 1900, f1: 2400, dur: 0.05, vol: 0.06 }); tone({ wave: 'triangle', f: 2000, f1: 2500, dur: 0.05, vol: 0.06, delay: 0.08 }); },
    unlock: () => arp([72, 76, 79, 83, 84, 88], 0.08, 'pulse25', 0.09, 0.18),
    secret: () => arp([79, 78, 75, 69, 68, 76, 80, 84], 0.07, 'pulse25', 0.08, 0.1),
    crack: () => noise({ dur: 0.09, vol: 0.14, type: 'highpass', f: 1800 }),
    pop: () => tone({ wave: 'sine', f: 300, f1: 900, dur: 0.07, vol: 0.12 }),
    warn: () => tone({ wave: 'square', f: 988, dur: 0.05, vol: 0.05 }),
    bounce: () => tone({ wave: 'sine', f: 240, f1: 600, dur: 0.12, vol: 0.14 }),
    lavaRise: () => { noise({ dur: 1.2, vol: 0.18, f: 300, f1: 100, attack: 0.3 }); tone({ wave: 'sawtooth', f: 55, f1: 45, dur: 1.2, vol: 0.06, attack: 0.3 }); },
  };

  function sfx(name, arg) {
    if (!ac || !FX[name]) return;
    const now = performance.now();
    if (lastPlay[name] && now - lastPlay[name] < 30) return; // de-dupe same-frame spam
    lastPlay[name] = now;
    FX[name](arg);
  }

  // ------------------------------------------------------------------
  //  Music: songs are a chord progression + hand-written melody;
  //  bass / arpeggio / drums are generated from the chords.
  // ------------------------------------------------------------------
  const SCALES = {
    major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10],
    lydian: [0, 2, 4, 6, 7, 9, 11], harmonic: [0, 2, 3, 5, 7, 8, 11],
  };
  const DRUMS = {
    light: { k: 'x.......x.......', s: '....x.......x...', h: '..x...x...x...x.' },
    march: { k: 'x.......x.x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
    rock: { k: 'x..x....x..x....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
    fast: { k: 'x.x...x.x.x...x.', s: '....x.......x..x', h: 'xxxxxxxxxxxxxxxx' },
    soft: { k: 'x...............', s: '................', h: '....x.......x...' },
    none: { k: '', s: '', h: '' },
  };
  const SONGS = {
    title: { bpm: 96, key: 60, scale: 'major', prog: [0, 5, 3, 4, 0, 5, 3, 4], drums: 'light', bass: 'pulse', arp: true,
      mel: '5 - 3 - 5 6 5 - | 6 - 1^ - 6 5 3 - | 4 - 6 - 1^ - 6 - | 5 - - - 2 3 4 - | 5 - 3 - 5 6 5 - | 6 - 1^ - 2^ 1^ 6 - | 4 - 6 - 5 - 4 3 | 2 - - - 1 - - -' },
    meadow: { bpm: 128, key: 67, scale: 'major', prog: [0, 3, 4, 0, 5, 3, 4, 4], drums: 'march', bass: 'walk', arp: true,
      mel: '1 . 3 . 5 . 3 5 | 4 . 6 . 1^ - 6 . | 5 . 7 . 2^ - 7 5 | 1^ - - - 5 . 3 . | 6 . 5 . 6 . 1^ . | 4 . 3 . 4 . 6 . | 5 . 4 . 3 . 2 . | 5v - 6v - 7v - 2 .' },
    forest: { bpm: 104, key: 64, scale: 'minor', prog: [0, 5, 2, 6, 0, 5, 3, 4], drums: 'soft', bass: 'pulse', arp: true,
      mel: '1 . 3 . 5 - 4 3 | 3 - 1 . 6v - . . | 3 . 5 . 7 - 6 5 | 5 - 4 - 2 - . . | 1^ . 7 . 5 - 3 . | 4 . 3 . 1 - . . | 4 . 6 . 1^ - 7 6 | 5 - - - 7v - . .' },
    cave: { bpm: 88, key: 62, scale: 'minor', prog: [0, 5, 0, 4, 0, 5, 3, 4], drums: 'soft', bass: 'long', arp: false,
      mel: '1 - - . 3 - 2 . | 1 - 7v - 6v - . . | 1 - - . 4 - 3 . | 2 - - - 5v - . . | 5 - - . 6 - 5 . | 4 - 3 - 1 - . . | 2 - 3 - 4 - 6 . | 5 - - - 4 3 2 .' },
    magma: { bpm: 150, key: 57, scale: 'harmonic', prog: [0, 0, 5, 4, 0, 0, 3, 4], drums: 'fast', bass: 'octave', arp: false,
      mel: '1 . 1 . 3 . 1 . | 4 . 3 . 2 . 3 . | 1 . 1 . 3 . 5 . | 6 . 5 . 7v . 1 . | 5 . 5 . 6 . 5 . | 4 . 3 . 2 . 3 . | 4 . 4 . 3 . 2 . | 7v - 2 - 5 - 7 .' },
    ruins: { bpm: 112, key: 62, scale: 'dorian', prog: [0, 3, 0, 6, 0, 3, 4, 6], drums: 'rock', bass: 'walk', arp: true,
      mel: '1 . 3 4 5 - 3 . | 6 - 5 - 4 3 4 . | 5 . 3 1 2 - 1 . | 7v - 1 2 1 - . . | 5 . 6 7 1^ - 7 . | 6 - 5 - 6 7 6 . | 5 . 4 3 4 - 3 . | 2 - 3 - 1 - . .' },
    ice: { bpm: 96, key: 65, scale: 'lydian', prog: [0, 1, 0, 4, 0, 1, 3, 4], drums: 'soft', bass: 'long', arp: true,
      mel: '3 - 5 - 7 - 5 . | 2^ - 1^ - 7 - 6 . | 5 - 3 - 4 - 5 . | 2 - - - . . . . | 3 - 5 - 1^ - 7 . | 6 - 5 - 6 - 7 . | 1^ - 7 - 5 - 4 . | 3 - - - 2 - . .' },
    storm: { bpm: 138, key: 60, scale: 'minor', prog: [0, 0, 5, 6, 0, 0, 3, 4], drums: 'rock', bass: 'octave', arp: true,
      mel: '1 . 3 . 5 . 1^ . | 7 . 5 . 3 . 5 . | 6 . 5 . 6 . 1^ . | 2^ - 1^ - 7 - 5 . | 1^ . 7 . 6 . 5 . | 4 . 5 . 6 . 5 . | 4 . 3 . 4 . 6 . | 5 - - - 7v - 2 .' },
    boss: { bpm: 160, key: 64, scale: 'harmonic', prog: [0, 5, 3, 4, 0, 5, 3, 4], drums: 'fast', bass: 'octave', arp: true,
      mel: '1 1 . 1 3 . 1 . | 6v . 6v . 7v . 1 . | 4 4 . 4 6 . 4 . | 5 . 7 . 5 . 7v . | 1^ . 7 . 6 . 5 . | 6 . 5 . 4 . 3 . | 4 . 3 . 2 . 3 . | 7v - - - 5 - 7 .' },
    victory: { bpm: 120, key: 60, scale: 'major', prog: [0, 3, 4, 0, 5, 3, 4, 0], drums: 'march', bass: 'walk', arp: true,
      mel: '1 - 3 - 5 - 1^ - | 6 - 1^ - 6 - 4 - | 5 - 7 - 2^ - 7 - | 1^ - - - - - . . | 3^ - 2^ - 1^ - 6 - | 4 - 6 - 1^ - 6 - | 5 - 4 - 3 - 2 - | 1 - - - . . . .' },
  };

  function compile(song) {
    const sc = SCALES[song.scale];
    const deg = (d) => song.key + sc[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);
    const toks = song.mel.replace(/\|/g, ' ').trim().split(/\s+/);
    const bars = song.prog.length, steps = bars * 16;
    const lead = new Array(steps).fill(null);
    toks.forEach((t, i) => {
      if (t === '.' || t === '-') return;
      const num = parseInt(t, 10);
      const oct = (t.match(/\^/g) || []).length - (t.match(/v/g) || []).length;
      let len = 1; while (toks[i + len] === '-') len++;
      lead[i * 2] = { m: deg(num - 1 + oct * 7), len: len * 2 };
    });
    const bass = new Array(steps).fill(null), arpN = new Array(steps).fill(null);
    for (let b = 0; b < bars; b++) {
      const r = song.prog[b];
      const chord = [deg(r), deg(r + 2), deg(r + 4)];
      const root = chord[0] - 24, fifth = deg(r + 4) - 24;
      const o = b * 16;
      if (song.bass === 'pulse') [0, 4, 8, 12].forEach((s) => (bass[o + s] = { m: root, len: 3 }));
      else if (song.bass === 'octave') for (let s = 0; s < 16; s += 2) bass[o + s] = { m: s % 4 ? root + 12 : root, len: 2 };
      else if (song.bass === 'walk') [[0, root], [4, fifth], [8, root + 12], [12, fifth]].forEach(([s, m]) => (bass[o + s] = { m, len: 3 }));
      else bass[o] = { m: root, len: 16 };
      if (song.arp) for (let s = 0; s < 16; s++) arpN[o + s] = { m: chord[s % 3] + (s % 6 >= 3 ? 12 : 0), len: 1 };
    }
    return { steps, lead, bass, arp: arpN, drums: DRUMS[song.drums], stepDur: 60 / song.bpm / 4 };
  }
  const compiled = {};
  for (const k in SONGS) compiled[k] = compile(SONGS[k]);

  const Music = {
    _duck: 1, cur: null, want: null, step: 0, nextTime: 0, timer: null,
    play(name) {
      this.want = name;
      if (!ac || this.cur === name) return;
      const t = ac.currentTime;
      musicBus.gain.cancelScheduledValues(t);
      musicBus.gain.setValueAtTime(musicBus.gain.value, t);
      musicBus.gain.linearRampToValueAtTime(0.0001, t + 0.25);
      this.cur = name; this.step = 0; this.nextTime = t + 0.3;
      setTimeout(applyVolumes, 320);
    },
    stop() { this.want = null; this.cur = null; },
    duck(on) { this._duck = on ? 0.35 : 1; applyVolumes(); },
    _start() {
      if (this.timer) return;
      this.timer = setInterval(() => this._tick(), 25);
      if (this.want) { const w = this.want; this.cur = null; this.play(w); }
    },
    _tick() {
      if (!ac || !this.cur) return;
      const song = compiled[this.cur];
      if (this.nextTime < ac.currentTime - 0.5) this.nextTime = ac.currentTime + 0.05; // resumed after a stall
      while (this.nextTime < ac.currentTime + 0.15) {
        this._schedule(song, this.step % song.steps, this.nextTime);
        this.nextTime += song.stepDur; this.step++;
      }
    },
    _schedule(song, s, t) {
      const sd = song.stepDur, bus = musicBus;
      const L = song.lead[s], B = song.bass[s], A = song.arp[s];
      if (L) tone({ wave: 'pulse25', f: N(L.m), dur: L.len * sd * 0.95, vol: 0.11, attack: 0.01, bus, at: t });
      if (B) tone({ wave: 'triangle', f: N(B.m), dur: B.len * sd * 0.9, vol: 0.22, attack: 0.01, bus, at: t });
      if (A) tone({ wave: 'pulse12', f: N(A.m), dur: sd * 0.8, vol: 0.035, attack: 0.004, bus, at: t });
      const ds = s % 16, D = song.drums;
      if (D.k[ds] === 'x') tone({ wave: 'sine', f: 150, f1: 42, dur: 0.14, vol: 0.4, bus, at: t });
      if (D.s[ds] === 'x') noise({ dur: 0.12, vol: 0.13, type: 'bandpass', f: 1800, q: 0.7, bus, at: t });
      if (D.h[ds] === 'x') noise({ dur: 0.035, vol: 0.05, type: 'highpass', f: 7000, bus, at: t });
    },
  };

  // Android suspends audio in the background; let the page do it too and resume on return
  function suspend() { try { if (ac && ac.state === 'running') ac.suspend(); } catch (e) { /* ignore */ } }
  function resume() { try { if (ac && ac.state === 'suspended') ac.resume(); } catch (e) { /* ignore */ } }

  return { init, sfx, applyVolumes, suspend, resume, Music, get ready() { return !!ac; } };
})();
