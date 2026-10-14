// =====================================================================
//  ART — pixel sprites (auto-outlined), characters, enemies, items
// =====================================================================
function newCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

function flipCanvas(src) {
  const c = newCanvas(src.width, src.height);
  const g = c.getContext('2d');
  g.translate(src.width, 0); g.scale(-1, 1); g.drawImage(src, 0, 0);
  return c;
}

function silhouette(src, color) {
  const c = newCanvas(src.width, src.height);
  const g = c.getContext('2d');
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
  return c;
}

// Sprite from rows of palette letters. 1px transparent padding holds the auto-outline.
function makeSprite(rows, pal, outline = '#1a1428', name = '?') {
  const h = rows.length, w = rows[0].length;
  rows.forEach((r, i) => { if (r.length !== w) throw new Error(`sprite ${name} row ${i} width ${r.length} != ${w}`); });
  const W = w + 2, H = h + 2;
  const c = newCanvas(W, H);
  const g = c.getContext('2d');
  const img = g.createImageData(W, H);
  const d = img.data;
  const filled = new Uint8Array(W * H);
  const put = (i, hex, a = 255) => { const [r, gg, b] = hexToRgb(hex); d[i * 4] = r; d[i * 4 + 1] = gg; d[i * 4 + 2] = b; d[i * 4 + 3] = a; };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const ch = rows[y][x];
    if (ch === '.') continue;
    const col = pal[ch];
    if (!col) throw new Error(`sprite ${name}: no colour for '${ch}'`);
    const i = (y + 1) * W + (x + 1);
    put(i, col); filled[i] = 1;
  }
  if (outline) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (filled[i]) continue;
      if ((x > 0 && filled[i - 1] === 1) || (x < W - 1 && filled[i + 1] === 1) || (y > 0 && filled[i - W] === 1) || (y < H - 1 && filled[i + W] === 1)) {
        put(i, outline); filled[i] = 2;
      }
    }
  }
  g.putImageData(img, 0, 0);
  return wrapSprite(c);
}
function wrapSprite(c) {
  return { c, f: flipCanvas(c), w: c.width, h: c.height, _wh: null, _whf: null };
}
function whiteOf(s, flip) {
  if (!s._wh) { s._wh = silhouette(s.c, '#ffffff'); s._whf = flipCanvas(s._wh); }
  return flip ? s._whf : s._wh;
}
// draw sprite with its top-left (inner, unpadded) at x,y
function spr(s, x, y, flip = false, g = ctx) { g.drawImage(flip ? s.f : s.c, Math.round(x) - 1, Math.round(y) - 1); }

// ---------------------------------------------------------------------
//  Playable characters (16x17 frames built from a body + legs)
// ---------------------------------------------------------------------
const BODIES = {
  frog: [
    '...hAh....hAh...',
    '..hwwwA..hwwwA..',
    '..Awwkk..Awwkk..',
    '.hAAwkkAAAAwkkA.',
    '.hAAAAAAAAAAAAA.',
    '.hAAAAAAAAAAAAA.',
    '.AAAAAAAAAAkAAk.',
    '.ACCAAAAAAAAkkA.',
    '.AABBBBBBBBAAAa.',
    '.aABBBBBBBBBAa..',
    '..aABBBBBBBAa...',
    '..aAbbbbbbbAa...',
    '...aaaaaaaaa....',
  ],
  bird: [
    '......aa........',
    '.....aAAa.......',
    '....hAAAAAA.....',
    '...hAAAAAwwA....',
    '..hAAAAAAwkA....',
    '..hAAAAAAAACC...',
    '.hAAaaAAAACCCc..',
    '.AAaaaaAABBc....',
    'aAAaaaaABBBB....',
    'aaAAaaABBBBB....',
    '.aaAAABBBBBb....',
    '...aAAbbbbb.....',
    '....aaaaaa......',
  ],
  fox: [
    '.......k...k....',
    '.......Ak..Ak...',
    '.......AAA.AAA..',
    '......AAAAAAAAA.',
    '......AAAAAwkAA.',
    '......hAAAAwkBBB',
    '......AAAAAABBBk',
    'BB....AAAAAAAbb.',
    'BAA..aABBBBBA...',
    'aAAAaAABBBBBA...',
    '.aAAAaABBBBBa...',
    '..aaAAaBBBBa....',
    '......aaaaaa....',
  ],
  bear: [
    '...aa.....aa....',
    '..aCCa...aCCa...',
    '..aAAAAAAAAAa...',
    '.aAAAAAAAAAAAa..',
    '.AAAAAAAAwkAAA..',
    '.hAAAAAAAwkABBB.',
    '.hAAAAAAAAABBBkk',
    '.AAAAAAAAAAABBb.',
    '.AAABBBBBBAAA...',
    '.aABBBBBBBBAa...',
    '.aABBBBBBBBAa...',
    '..aaBBBBBBaa....',
    '...aaaaaaaa.....',
  ],
};
const LEGS = {
  chunky: {
    stand: ['....LL....LL....', '....LL....LL....', '....LFF...LFF...'],
    runA: ['...LL......LL...', '..LL........LL..', '.FF..........FF.'],
    runB: ['.....LL.LL......', '.....LLLLF......', '.....FF.........'],
    jump: ['....LL...LL.....', '...LL...LL......', '..FF...FF.......'],
    fall: ['...LL.....LL....', '..LL.......LL...', '..F.........F...'],
  },
  thin: {
    stand: ['.....L...L......', '.....L...L......', '.....LF..LF.....'],
    runA: ['....L.....L.....', '...L.......L....', '..FF.......FF...'],
    runB: ['.....L..L.......', '......LLL.......', '......FF........'],
    jump: ['.....L..L.......', '....L..L........', '...F..F.........'],
    fall: ['....L....L......', '...L......L.....', '..F........F....'],
  },
};

const CHARACTERS = [
  {
    id: 'mossy', name: 'MOSSY', species: 'TREE FROG', body: 'frog', legs: 'chunky', outline: '#13261b',
    pal: { A: '#5ccf5a', a: '#2f8d47', h: '#a6f27c', B: '#f4ec8e', b: '#cfc25f', w: '#ffffff', k: '#1b1b2e', C: '#ff8fae', c: '#c9507a', L: '#46b452', F: '#2f8d47' },
    speed: 112, hearts: 3, ability: 'grip',
    tagline: 'STICKY FINGERS, BRAVE HEART.',
    power: 'WALL GRIP: SLIDES SLOWLY AND KICKS OFF WALLS HIGHER.',
    stats: { speed: 3, jump: 3, wall: 5, tough: 3 },
  },
  {
    id: 'pip', name: 'PIP', species: 'BLUEBIRD', body: 'bird', legs: 'thin', outline: '#101a38',
    pal: { A: '#4aa8ff', a: '#2a5fc0', h: '#a8dcff', B: '#f4f8ff', b: '#c8d4ea', w: '#ffffff', k: '#14182a', C: '#ffb02e', c: '#d06a14', L: '#ffb02e', F: '#d06a14' },
    speed: 108, hearts: 3, ability: 'double',
    tagline: 'TOO SMALL TO FLY. TOO STUBBORN TO FALL.',
    power: 'FLUTTER: PRESS JUMP AGAIN IN THE AIR FOR A DOUBLE JUMP.',
    stats: { speed: 3, jump: 5, wall: 3, tough: 3 },
  },
  {
    id: 'ember', name: 'EMBER', species: 'RED FOX', body: 'fox', legs: 'chunky', outline: '#2a140c',
    pal: { A: '#ff8a2e', a: '#c4521a', h: '#ffc07a', B: '#fff4e8', b: '#e0c8b4', w: '#ffffff', k: '#1e1420', C: '#ff8a2e', c: '#c4521a', L: '#c4521a', F: '#3a2020' },
    speed: 124, hearts: 3, ability: 'dash',
    tagline: 'FASTEST PAWS ON THE MOUNTAIN.',
    power: 'DASH: PRESS POWER TO BURST SIDEWAYS. DASHING THROUGH ENEMIES DEFEATS THEM.',
    stats: { speed: 5, jump: 3, wall: 3, tough: 3 },
  },
  {
    id: 'bruno', name: 'BRUNO', species: 'BEAR CUB', body: 'bear', legs: 'chunky', outline: '#22140a',
    pal: { A: '#a86a3c', a: '#6e4022', h: '#d29a62', B: '#f0d0a0', b: '#c8a070', w: '#ffffff', k: '#1e1410', C: '#ff9aa8', c: '#c86a7a', L: '#6e4022', F: '#3e2414' },
    speed: 106, hearts: 5, ability: 'slam',
    tagline: 'SOFT FUR. HARD HEAD. FIVE HEARTS.',
    power: 'GROUND SLAM: PRESS POWER IN THE AIR TO SMASH DOWN. CRUSHES EVEN SPIKY FOES.',
    stats: { speed: 2, jump: 3, wall: 3, tough: 5 },
  },
  {
    id: 'golden', name: 'GOLDEN MOSSY', species: 'LEGEND', body: 'frog', legs: 'chunky', outline: '#3a2408', secret: true,
    pal: { A: '#ffd34a', a: '#c98a1c', h: '#fff3a8', B: '#fff7d6', b: '#e8cf8a', w: '#ffffff', k: '#2a1a0a', C: '#ff9a6a', c: '#b85a2a', L: '#f0b832', F: '#b07a18' },
    speed: 118, hearts: 3, ability: 'all',
    tagline: 'THE FROG WHO REACHED THE SUMMIT.',
    power: 'ALL POWERS: WALL GRIP, DOUBLE JUMP AND DASH.',
    stats: { speed: 4, jump: 5, wall: 5, tough: 3 },
  },
];
const charById = (id) => CHARACTERS.find((c) => c.id === id) || CHARACTERS[0];

function composeChar(def, bob, legKey) {
  const rows = Array.from({ length: 17 }, () => '................'.split(''));
  LEGS[def.legs][legKey].forEach((r, i) => { for (let x = 0; x < 16; x++) if (r[x] !== '.') rows[14 + i][x] = r[x]; });
  BODIES[def.body].forEach((r, i) => {
    const y = 1 + bob + i;
    if (y < 0 || y > 16) return;
    for (let x = 0; x < 16; x++) if (r[x] !== '.') rows[y][x] = r[x];
  });
  return rows.map((r) => r.join(''));
}
function buildCharFrames(def) {
  const mk = (bob, legs) => makeSprite(composeChar(def, bob, legs), def.pal, def.outline, def.id);
  return {
    idle: [mk(0, 'stand'), mk(1, 'stand')],
    run: [mk(0, 'runA'), mk(-1, 'runB'), mk(0, 'runA'), mk(-1, 'runB')],
    jump: mk(-1, 'jump'), fall: mk(0, 'fall'), crouch: mk(1, 'jump'),
  };
}

// ---------------------------------------------------------------------
//  Enemies, items, props
// ---------------------------------------------------------------------
const PAL = {
  beetle: { A: '#e8434f', a: '#9b1d3a', h: '#ff9aa0', k: '#1d1a2b', w: '#ffffff' },
  spiny: { S: '#dfe6f2', s: '#8a93ad', A: '#a8693f', a: '#6b3f22', k: '#1d1a2b', w: '#ffffff' },
  bat: { A: '#8a64e0', a: '#4f3596', w: '#ffd84a', k: '#1d1a2b' },
  plant: { R: '#ff5a7a', r: '#b02a50', w: '#ffffff', k: '#1d1a2b', G: '#4cc95a', g: '#2f8a45' },
  wasp: { Y: '#ffd84a', k: '#1d1a2b', w: '#e6f7ff' },
  slime: { A: '#3ad1b5', a: '#1e8a86', h: '#b0fff0', w: '#ffffff', k: '#14202a' },
  gem: { A: '#4ae0ff', a: '#1b8ac0', h: '#b8f6ff', w: '#ffffff' },
  mimic: { A: '#4ae0ff', a: '#1b8ac0', h: '#b8f6ff', w: '#ffffff', k: '#1d1a2b', r: '#ff3a5a', L: '#1b8ac0' },
  heart: { R: '#ff4d6d', r: '#b81d45', w: '#ffffff' },
  heartEmpty: { R: '#4a3f5c', r: '#2e2640', w: '#6a5f80' },
  spring: { T: '#ff5a5a', t: '#c62a3a', k: '#2a2030', S: '#d8dde8', s: '#8890a8', M: '#6a7088', m: '#4a4f66' },
  sign: { W: '#c88a4a', w: '#e8b878', m: '#5a3418', k: '#8a5a2a' },
  rock: { A: '#9a8f9e', a: '#5e5466', h: '#cfc6d4' },
  seed: { A: '#ffcf5a', a: '#b0701a', h: '#fff2b0' },
  feather: { A: '#3a4278', a: '#1c2048', h: '#ffd84a' },
  boss: { A: '#2f3566', a: '#191c3a', h: '#56609e', Y: '#ffd84a', y: '#c98a1c', w: '#ffffff', r: '#ff3a5a', k: '#0c0c18' },
  bossHurt: { A: '#ff6a7a', a: '#b02a4a', h: '#ffb0b8', Y: '#ffd84a', y: '#c98a1c', w: '#ffffff', r: '#ffffff', k: '#0c0c18' },
};

const SPRITE_ROWS = {
  beetle0: ['....aaaaa.......', '..aAAAAAAAa.....', '.aAhhAAAAAAa....', '.AhAAAAAAAAAkk..', '.AAAAAaAAAAkwkk.', '.aAAAAaAAAAkkkk.', '.aaAAAaAAAaakkk.', '..aaaaaaaaaakk..', '..k..k...k..k...', '.k..k...k..k....'],
  beetle1: ['....aaaaa.......', '..aAAAAAAAa.....', '.aAhhAAAAAAa....', '.AhAAAAAAAAAkk..', '.AAAAAaAAAAkwkk.', '.aAAAAaAAAAkkkk.', '.aaAAAaAAAaakkk.', '..aaaaaaaaaakk..', '...k..k...k..k..', '..k..k...k..k...'],
  spiny0: ['...s.s.s.s......', '..sSsSsSsSs.....', '.sSSSSSSSSSs....', '.SSAAAAAAAAAs...', 'sSAAAAAAAAwkA...', 'SAAAAAAAAAAAAk..', '.AAAAAAAAAAAAa..', '.aaAAAAAAAAaa...', '..k..k...k..k...', '.k..k...k..k....'],
  spiny1: ['...s.s.s.s......', '..sSsSsSsSs.....', '.sSSSSSSSSSs....', '.SSAAAAAAAAAs...', 'sSAAAAAAAAwkA...', 'SAAAAAAAAAAAAk..', '.AAAAAAAAAAAAa..', '.aaAAAAAAAAaa...', '...k..k...k..k..', '..k..k...k..k...'],
  bat0: ['k..............k', 'Ak............kA', 'AAk...a..a...kAA', '.AAk.aAAAAa.kAA.', '..AAAAwAAwAAAA..', '...AAAAAAAAAA...', '....aAkkkkAa....', '.....aAAAAa.....', '......a..a......'],
  bat1: ['......a..a......', '.....aAAAAa.....', '....aAwAAwAa....', '..kAAAAAAAAAAk..', '.kAAAAkkkkAAAAk.', 'kAA..aAAAAa..AAk', 'Ak....a..a....kA', 'k..............k', '................'],
  batHang: ['......k..k......', '......aAAa......', '.....aAAAAa.....', '.....AAAAAA.....', '.....AAAAAA.....', '.....AaAAaA.....', '......AAAA......', '.......aa.......', '................'],
  plant0: ['....RRRRR.......', '...RRRRRRR......', '..RRwkRRRRR.....', '..RRRRRRRRRk....', '..RRRRRRkkkk....', '..rRRRRRRRRk....', '...rrRRRRR......', '......GG........', '..GGG.GG.GGG....', '.GGgGGGGGGgGG...', '..ggGGGGGGgg....', '....gggggg......'],
  plant1: ['...RRRRRR.......', '..RRRRRRRRR.....', '.RRwkRRRRRRRR...', '.RRRRRRRRRkkkk..', '.RRRRRRRkk......', '.RRRRRRRRkkkk...', '.rRRRRRRRRRRk...', '..rrRRRRRRR.....', '......GG........', '..GGG.GG.GGG....', '.GGgGGGGGGgGG...', '....gggggg......'],
  wasp0: ['....ww.ww.......', '...wwwwwww......', '....ww.ww.......', '..kYYkkYYkY.....', '.kYYYkYYkYYwk...', 'kkYYYkYYkYYYYk..', '.kYYYkYYkYYYk...', '..kkkkkkkkkk....', '................'],
  wasp1: ['................', '................', '..wwwwwww.......', '..kYYkkYYkY.....', '.kYYYkYYkYYwk...', 'kkYYYkYYkYYYYk..', '.kYYYkYYkYYYk...', '..kkkkkkkkkk....', '................'],
  slime0: ['......hhh.......', '....hAAAAAA.....', '...hAAAAAAAA....', '..AAAAAwkAwkA...', '..AAAAAwkAwkA...', '.AAAAAAAAAAAAA..', '.aAAAAAAAAAAAa..', '..aaaaaaaaaaa...'],
  slime1: ['.....hhh........', '....hAAAA.......', '...hAAAAAA......', '...AAAAwkAwk....', '...AAAAwkAwk....', '...aAAAAAAAa....', '....aAAAAAa.....', '.....aaaaa......'],
  gem0: ['...hhhhhh...', '..hwwAAAAh..', '.hwAAAAAAAh.', 'hAAAAAAAAAAa', 'aAAAAAAAAAAa', '.aAAAAAAAAa.', '..aAAAAAAa..', '...aAAAAa...', '....aAAa....', '.....aa.....'],
  gem1: ['....hhhh....', '...hwAAAh...', '..hwAAAAAh..', '..hAAAAAAa..', '..aAAAAAAa..', '...aAAAAa...', '...aAAAAa...', '....aAAa....', '....aAAa....', '.....aa.....'],
  gem2: ['.....hh.....', '....hwAh....', '....hAAa....', '....hAAa....', '....aAAa....', '....aAAa....', '....aAAa....', '.....aa.....', '.....aa.....', '.....aa.....'],
  mimic0: ['...hhhhhh...', '..hwwAAAAh..', '.hwAAAAAAAh.', 'hAkrAAAkrAAa', 'aAkkAAAkkAAa', '.aAAAAAAAAa.', '..aAkkkkAa..', '...aAAAAa...', '...L....L...', '..LL....LL..'],
  mimic1: ['...hhhhhh...', '..hwwAAAAh..', '.hwAAAAAAAh.', 'hAkrAAAkrAAa', 'aAkkAAAkkAAa', '.aAAAAAAAAa.', '..aAkkkkAa..', '...aAAAAa...', '....L..L....', '....LL.LL...'],
  heart: ['.RR...RR.', 'RwRR.RRRR', 'RwRRRRRRR', 'RRRRRRRRr', '.RRRRRRr.', '..RRRRr..', '...RRr...', '....r....'],
  spring0: ['..TTTTTTTTTTTT..', '.TttttttttttttT.', '..kkkkkkkkkkkk..', '...SSSSSSSSSS...', '....ssssssss....', '...SSSSSSSSSS...', '....ssssssss....', '...SSSSSSSSSS...', '.mmmmmmmmmmmmmm.', 'mMMMMMMMMMMMMMMm'],
  spring1: ['................', '................', '................', '..TTTTTTTTTTTT..', '.TttttttttttttT.', '..kkkkkkkkkkkk..', '...SSSSSSSSSS...', '....ssssssss....', '.mmmmmmmmmmmmmm.', 'mMMMMMMMMMMMMMMm'],
  sign: ['................', '.mmmmmmmmmmmmmm.', 'mWWWWWWWWWWWWWWm', 'mWwwwwwwwwwwwwWm', 'mWwkkkwwwkkkwwWm', 'mWwwwwwwwwwwwwWm', 'mWwkkkkwwkkwwwWm', 'mWwwwwwwwwwwwwWm', 'mWWWWWWWWWWWWWWm', '.mmmmmmmmmmmmmm.', '......mWWm......', '......mWWm......', '......mWWm......', '......mWWm......', '.....mmWWmm.....'],
  rock: ['...aAAAa....', '..aAhhAAAa..', '.aAhAAAAAAa.', 'aAhAAAAAAAAa', 'aAAAAAAaAAAa', 'aAAAAAaAAAAa', 'aaAAAAAAAAaa', '.aAAAAAAAAa.', '..aaAAAAaa..', '....aaaa....'],
  seed: ['.hA.', 'hAAa', 'AAaa', '.aa.'],
  feather: ['....hh', '..aAAh', '.aAAa.', 'aAAa..', 'Aaa...'],
  stalactite: ['aAAAAAAAAAAAAAAa', '.aAAAAAAAAAAAAa.', '..aAAAAhAAAAAa..', '..aAAAhAAAAAAa..', '...aAAhAAAAAa...', '...aAhAAAAAAa...', '....aAhAAAAa....', '....aAhAAAAa....', '.....aAAAAa.....', '.....aAAAAa.....', '......aAAa......', '......aAAa......', '.......aa.......'],
  bossBody: [
    '...............aaa......',
    '..............aAAAa.....',
    '.............aAAAAAa....',
    '............aAAAAwwAa...',
    '............AAAAAwrkAYY.',
    '...........aAAAAAAAAYYYy',
    '...........AAAAAAAAAAyy.',
    '......aaa.aAAAAAAAAAa...',
    '...aaaAAAaAAAAhhhAAAa...',
    '..aAAAAAAAAAAhhhhAAAa...',
    '.aAAAAAAAAAAAAhhhAAAa...',
    'aAAaaaAAAAAAAAAAAAa.....',
    'aAa...aAAAAAAAAAAa......',
    'aa.....aaAAAAAAaa.......',
    '.........YY..YY.........',
    '........YYY.YYY.........',
  ],
  wingUp: ['aa............', 'aAa...........', 'aAAa..........', '.aAAa.........', '.aAhAa........', '..aAhAa.......', '..aAAhAaa.....', '...aAAAAAAa...', '....aaAAAAAAa.', '......aaaaaaa.'],
  wingMid: ['..............', '..............', '..............', 'aaaa..........', 'aAAAaaa.......', '.aAhhAAAaaa...', '..aaAAhhAAAAa.', '....aaaAAAAAa.', '.......aaaaaa.', '..............'],
  wingDown: ['..............', '..............', '..............', '..............', '.........aaaa.', '......aaAAAAa.', '...aaAAhAAAa..', '.aaAAhAAAaa...', 'aAAhAAaaa.....', 'aaaaa.........'],
};

const ART = {};
function buildArt() {
  const S = SPRITE_ROWS, mk = (k, pal, ol) => makeSprite(S[k], pal, ol, k);
  ART.chars = {};
  for (const c of CHARACTERS) ART.chars[c.id] = buildCharFrames(c);
  ART.beetle = [mk('beetle0', PAL.beetle, '#1d0f18'), mk('beetle1', PAL.beetle, '#1d0f18')];
  ART.spiny = [mk('spiny0', PAL.spiny, '#1d0f18'), mk('spiny1', PAL.spiny, '#1d0f18')];
  ART.bat = [mk('bat0', PAL.bat, '#160e2a'), mk('bat1', PAL.bat, '#160e2a')];
  ART.batHang = mk('batHang', PAL.bat, '#160e2a');
  ART.plant = [mk('plant0', PAL.plant, '#1d0f18'), mk('plant1', PAL.plant, '#1d0f18')];
  ART.wasp = [mk('wasp0', PAL.wasp, '#1d150a'), mk('wasp1', PAL.wasp, '#1d150a')];
  ART.slime = [mk('slime0', PAL.slime, '#0c2224'), mk('slime1', PAL.slime, '#0c2224')];
  const g1 = mk('gem1', PAL.gem, '#0b2a44');
  ART.gem = [mk('gem0', PAL.gem, '#0b2a44'), g1, mk('gem2', PAL.gem, '#0b2a44'), { ...g1, c: g1.f, f: g1.c }];
  ART.mimic = [mk('mimic0', PAL.mimic, '#0b2a44'), mk('mimic1', PAL.mimic, '#0b2a44')];
  ART.heart = mk('heart', PAL.heart, '#2a0a14');
  ART.heartEmpty = mk('heart', PAL.heartEmpty, '#140c20');
  ART.spring = [mk('spring0', PAL.spring, '#1a1428'), mk('spring1', PAL.spring, '#1a1428')];
  ART.sign = mk('sign', PAL.sign, '#2a1808');
  ART.rock = mk('rock', PAL.rock, '#241c2a');
  ART.seed = mk('seed', PAL.seed, '#2a1a08');
  ART.feather = mk('feather', PAL.feather, '#0c0c18');
  ART.boss = buildBossFrames(PAL.boss);
  ART.bossHurt = buildBossFrames(PAL.bossHurt);
  ART.crusher = [buildCrusher(false), buildCrusher(true)];
  ART.boulder = buildBoulder(14, '#8a7f8e', '#5e5466', '#b8aec0');
  ART.snowball = buildBoulder(14, '#e8f2ff', '#9ab4d8', '#ffffff');
  ART.dawnGem = buildDawnGem();
  ART.clouds = [buildCloud(34, 12, 1), buildCloud(52, 16, 2), buildCloud(26, 10, 3), buildCloud(64, 18, 4)];
}

// Boss frames: far wing (dark) + body + near wing, 40x30 canvas
function buildBossFrames(pal) {
  const S = SPRITE_ROWS;
  const farPal = { ...pal, A: pal.a, h: pal.A, a: '#0c0c18' };
  const out = {};
  const body = makeSprite(S.bossBody, pal, '#0c0c18', 'bossBody');
  const wings = { up: S.wingUp, mid: S.wingMid, down: S.wingDown };
  const stunnedPal = { ...pal, w: pal.k, r: pal.k };
  const stunBody = makeSprite(S.bossBody, stunnedPal, '#0c0c18', 'bossStun');
  for (const k in wings) {
    const near = makeSprite(wings[k], pal, '#0c0c18', 'wing');
    const far = makeSprite(wings[k], farPal, '#0c0c18', 'wingFar');
    const build = (b) => {
      const c = newCanvas(42, 32); const g = c.getContext('2d');
      g.drawImage(far.c, 9, 6 + (k === 'up' ? -2 : 0));
      g.drawImage(b.c, 8, 10);
      g.drawImage(near.c, 4, 8 + (k === 'up' ? -4 : 0));
      return wrapSprite(c);
    };
    out[k] = build(body);
    if (k === 'down') out.stun = build(stunBody);
  }
  return out;
}

function buildCrusher(angry) {
  const c = newCanvas(34, 34); const g = c.getContext('2d');
  const R = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x + 1, y + 1, w, h); };
  R(0, 0, 32, 32, '#2a2438');
  R(1, 1, 30, 30, '#7d7690');
  R(1, 1, 30, 2, '#a59ebb');
  R(1, 1, 2, 30, '#958eaa');
  R(29, 3, 2, 28, '#5a536c');
  R(3, 29, 28, 2, '#5a536c');
  // bricks
  g.fillStyle = '#5a536c';
  for (const [x, y, w] of [[6, 8, 7], [20, 6, 6], [4, 22, 6], [22, 24, 6]]) g.fillRect(x + 1, y + 1, w, 1);
  // spikes on the bottom
  for (let i = 0; i < 4; i++) {
    R(3 + i * 7, 31, 6, 1, '#cfd6e4');
  }
  // face
  if (angry) {
    R(6, 9, 7, 2, '#2a2438'); R(19, 9, 7, 2, '#2a2438');
    R(7, 11, 5, 5, '#ffffff'); R(20, 11, 5, 5, '#ffffff');
    R(9, 12, 3, 3, '#ff3a5a'); R(20, 12, 3, 3, '#ff3a5a');
    R(9, 20, 14, 5, '#2a2438'); R(10, 21, 2, 2, '#ffffff'); R(14, 21, 2, 2, '#ffffff'); R(18, 21, 2, 2, '#ffffff');
  } else {
    R(7, 11, 5, 5, '#ffffff'); R(20, 11, 5, 5, '#ffffff');
    R(9, 13, 2, 2, '#2a2438'); R(22, 13, 2, 2, '#2a2438');
    R(6, 9, 7, 1, '#2a2438'); R(19, 9, 7, 1, '#2a2438');
    R(10, 21, 12, 2, '#2a2438');
  }
  return wrapSprite(c);
}

function buildBoulder(r, base, dark, light) {
  const frames = [];
  for (let f = 0; f < 8; f++) {
    const d = r * 2 + 2;
    const c = newCanvas(d + 2, d + 2); const g = c.getContext('2d');
    const cx = r + 1.5, cy = r + 1.5;
    for (let y = 0; y < d; y++) for (let x = 0; x < d; x++) {
      const dx = x - cx + 0.5, dy = y - cy + 0.5;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > r + 0.5) continue;
      let col = base;
      if (dist > r - 1) col = '#1a1428';
      else if (dx + dy > r * 0.7) col = dark;
      else if (dx + dy < -r * 0.6) col = light;
      g.fillStyle = col; g.fillRect(x + 1, y + 1, 1, 1);
    }
    // rotating cracks
    const ang = (f / 8) * Math.PI * 2;
    g.fillStyle = dark;
    for (const off of [0, 2.1, 4.2]) {
      for (let t = 2; t < r - 2; t++) {
        const a = ang + off + t * 0.08;
        g.fillRect(Math.round(cx + Math.cos(a) * t) + 1, Math.round(cy + Math.sin(a) * t) + 1, 1, 1);
      }
    }
    frames.push(wrapSprite(c));
  }
  return frames;
}

function buildDawnGem() {
  const rows = [
    '.....hhhhhh.....', '....hwwYYYYh....', '...hwYYYYYYYh...', '..hwYYYYYYYYYh..', '.hYYYYYYYYYYYYy.',
    'hYYYYYYYYYYYYYYy', 'yYYYYYYYYYYYYYYy', '.yYYYYYYYYYYYYy.', '..yYYYYYYYYYYy..', '...yYYYYYYYYy...',
    '....yYYYYYYy....', '.....yYYYYy.....', '......yYYy......', '.......yy.......',
  ];
  return makeSprite(rows, { Y: '#ffcf3a', y: '#d07a10', h: '#fff4b0', w: '#ffffff' }, '#3a2008', 'dawnGem');
}

function buildCloud(w, h, seed) {
  const c = newCanvas(w, h); const g = c.getContext('2d');
  const rng = mulberry32(seed * 97);
  const puffs = [];
  for (let i = 0; i < 5; i++) puffs.push({ x: 6 + rng() * (w - 12), y: h * 0.55 + rng() * h * 0.2, r: h * (0.3 + rng() * 0.25) });
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let inside = false, top = false;
    for (const p of puffs) {
      const dx = x - p.x, dy = y - p.y;
      if (dx * dx + dy * dy <= p.r * p.r) { inside = true; if (dy < -p.r * 0.35) top = true; }
    }
    if (y > h - 3) inside = inside && x > 3 && x < w - 3;
    if (inside) { g.fillStyle = top ? '#ffffff' : (y > h * 0.7 ? '#c8d8f0' : '#eef4ff'); g.fillRect(x, y, 1, 1); }
  }
  return c;
}
