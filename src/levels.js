// =====================================================================
//  LEVELS — hand-built from horizontal / vertical segments
// ---------------------------------------------------------------------
//  #  ground        =  one-way plank   I  ice        X  cracked ground (collapses!)
//  %  fake wall     C  crumble block   L  lava       ^ v < >  spikes
//  P  start         S  checkpoint      F  finish     *  gem     +  heart
//  ?  sign          T  spring          H/V moving platform (2 wide)  :  platform stop
//  K  crusher 2x2   !  stalactite
//  B beetle  N spiny  Y bat  Q snapper plant  W wasp  U wasp (vertical)  G slime  M gem mimic  D boss
//  A boar  { bomb beetle  ; ghost  , lava leaper (sits in lava)  ` grumble cloud  _ penguin
//  O saw  Z saw on a horizontal rail  J saw on a vertical rail  E fire bar  R cannon
//  ( ) conveyor belt (left / right)  [ ] beat blocks (red / blue)  ~ puff cloud  | updraft
//  @ star  & shield  " wings  $ magnet   (power-up orbs)
//  1-9  event trigger zones      a-z (not v)  event markers
// =====================================================================

// pad a segment with sky rows on top so it is exactly h rows tall
function seg(h, rows, name) {
  const w = rows[0].length;
  rows.forEach((r, i) => { if (r.length !== w) throw new Error(`segment ${name} row ${i} width ${r.length} != ${w}: "${r}"`); });
  if (rows.length > h) throw new Error(`segment ${name} too tall (${rows.length} > ${h})`);
  return Array(h - rows.length).fill('.'.repeat(w)).concat(rows);
}
// join segments left-to-right
function hjoin(h, segs) {
  const out = Array(h).fill('');
  segs.forEach((s, i) => seg(h, s, i).forEach((r, y) => (out[y] += r)));
  return out;
}
// stack segments top-to-bottom (all must share a width)
function vstack(segs) {
  const w = segs[0][0].length;
  const out = [];
  segs.forEach((s, i) => s.forEach((r, y) => { if (r.length !== w) throw new Error(`vstack seg ${i} row ${y} width ${r.length} != ${w}: "${r}"`); out.push(r); }));
  return out;
}
const solid = (w, n = 1) => Array(n).fill('#'.repeat(w));

const LEVELS = [];

// ---------------------------------------------------------------------
//  1. MOSSY MEADOW — learn the ropes (and meet a very shy flag)
// ---------------------------------------------------------------------
LEVELS.push({
  name: 'MOSSY MEADOW', theme: 'meadow', par: 75,
  blurb: 'A GENTLE START.\nOR IS IT?',
  signs: [
    'WELCOME, CLIMBER! MOVE WITH ◀ ▶ AND PRESS {jump} TO JUMP.',
    'HOLD {jump} TO JUMP HIGHER. A QUICK TAP GIVES A LITTLE HOP.',
    'BEETLES ARE GRUMPY. BONK THEM BY LANDING ON THEIR HEADS!',
    'SPIKES COST YOU A ♥ AND HOP YOU BACK TO SAFE GROUND.',
    'FLAGS ARE CHECKPOINTS. THEY ALSO REFILL YOUR ♥.',
    'JUMP UP THROUGH PLANKS. {drop} TO DROP BACK DOWN.',
    'GLOWING ORBS GIVE YOU A SUPER POWER. GRAB THE STAR, THEN BONK EVERYTHING!',
    'THE GOLDEN FLAG ENDS THE LEVEL. JUST WALK UP AND TOUCH IT!',
  ],
  events: [
    { type: 'ambush', trigger: '1', marker: 'a', enemy: 'beetle', msg: 'BEETLE PARADE!', col: '#ff9a5a' },
    { type: 'flagRun', markers: ['f', 'g'], lines: ['NOPE!', 'CATCH ME!'] },
  ],
  map: hjoin(18, [
    [ // start
      '..............',
      '..............',
      '.P....?.......',
      ...solid(14, 5),
    ],
    [ // first hops
      '................',
      '......*.*.......',
      '.....*....*.....',
      '................',
      '.......##.......',
      ...solid(16, 5),
    ],
    [ // a tall step: hold jump
      '................',
      '........*.*.....',
      '.........*......',
      '........###.....',
      '........###.....',
      '..?.....###.....',
      ...solid(16, 5),
    ],
    [ // beetle
      '....................',
      '...........*........',
      '..?.......B.........',
      ...solid(20, 5),
    ],
    [ // spike pit
      '..................',
      '........*.........',
      '..?...............',
      '#######...########',
      '#######^^^########',
      ...solid(18, 3),
    ],
    [ // checkpoint and planks
      '....................',
      '...............*....',
      '.............====...',
      '....................',
      '..........====......',
      '....................',
      '.?.S...?....+.......',
      ...solid(20, 5),
    ],
    [ // star parade: grab the star... then here come the beetles
      '................................',
      '......@...........a...a...a...a.',
      '.....===........................',
      '..........1.....................',
      '..?.......1.....................',
      ...solid(32, 5),
    ],
    [ // cracked ground drops into a gem cave
      '......................',
      '......................',
      '#####XXXXX############',
      '####............######',
      '####.*.*.*.*.*..######',
      ...solid(22, 2),
    ],
    [ // hill with a beetle on top
      '........................',
      '............*.B.*.......',
      '............######......',
      '..........##########....',
      '........##############..',
      ...solid(24, 5),
    ],
    [ // the flag that runs away
      '............................',
      '......................g.....',
      '.....................####...',
      '............................',
      '.................====.......',
      '............f...............',
      '...........####.............',
      '............................',
      '..?..F......................',
      ...solid(28, 5),
    ],
  ]),
});

// place rectangles / strings by coordinate (used for the tall vertical levels)
function build(w, h, fn) {
  const g = Array.from({ length: h }, () => Array(w).fill('.'));
  const b = {
    fill(x, y, ww, hh, ch = '#') {
      for (let j = y; j < y + hh; j++) for (let i = x; i < x + ww; i++) {
        if (i < 0 || j < 0 || i >= w || j >= h) throw new Error(`build: ${i},${j} is outside ${w}x${h}`);
        g[j][i] = ch;
      }
    },
    put(x, y, s) { [...s].forEach((ch, i) => { if (ch !== ' ') b.fill(x + i, y, 1, 1, ch); }); },
  };
  fn(b);
  return g.map((r) => r.join(''));
}
const empty = (w, n) => Array(n).fill('.'.repeat(w));

// ---------------------------------------------------------------------
//  2. WHISPERWOOD — wall jumps, springs, canopy and an ambush
// ---------------------------------------------------------------------
LEVELS.push({
  name: 'WHISPERWOOD', theme: 'forest', par: 110,
  blurb: 'WALL JUMPS, SPRINGS\nAND SNAPPY PLANTS.',
  signs: [
    'WALL JUMP! JUMP INTO A WALL, THEN PRESS {jump} AGAIN TO KICK OFF IT. ZIG-ZAG UP!',
    'SPRINGS LAUNCH YOU SKY-HIGH. LAND ON ONE!',
    'SNAPPER PLANTS SPIT SEEDS. HOP OVER THEM, THEN BONK THE PLANT.',
    'BOARS CHARGE WHEN THEY SPOT YOU. JUMP OVER - LET THEM BONK INTO THE STUMP!',
    "MOSSY STONES CRUMBLE UNDER YOUR FEET. DON'T STOP RUNNING!",
  ],
  events: [{ type: 'ambush', trigger: '1', marker: 'a', enemy: 'beetle', msg: 'AMBUSH!', col: '#ff5a5a' }],
  map: hjoin(20, [
    ['............', '.P..........', ...solid(12, 5)],
    [ // wall-jump chimney
      '..................',
      '..........*.......',
      '..................',
      '........#...######',
      '........#.*.######',
      '........#...######',
      '........#...######',
      '........#.*.######',
      '............######',
      '...?........######',
      ...solid(18, 5),
    ],
    [ // plateau with a hidden room, then a spring to the canopy
      '..............*.......',
      '######.......=====....',
      '######..............*.',
      '######................',
      '######................',
      '######................',
      '##...%................',
      '##*.*%...?....T.......',
      ...solid(22, 5),
    ],
    [ // canopy planks guarded by wasps
      '.....W..........W.........',
      '..*.....*...*.......*..*..',
      '=====...=====...=====...==',
      ...empty(26, 5),
      '...."....Q.......T........',
      ...solid(26, 5),
    ],
    ['..S..?....Q...', ...solid(14, 5)],
    [ // boar meadow: a stump to crash into
      '............................',
      '..........*.....*...........',
      '##..........................',
      '##?..................A......',
      ...solid(28, 5),
    ],
    [ // moving platform over spikes
      '........................',
      '......*....*....*.......',
      '........................',
      '..:H.................:..',
      '........................',
      '###..................###',
      '###..................###',
      '###..................###',
      '###^^^^^^^^^^^^^^^^^^###',
      ...solid(24, 1),
    ],
    [ // crumbling bridge
      '......*...*...*.....',
      '....................',
      '...?................',
      '####CCCCCCCCCCCC####',
      ...Array(4).fill('####............####'),
    ],
    [ // the quiet clearing...
      ...empty(28, 4),
      '..............a...a...a.....',
      ...empty(28, 1),
      '........1...................',
      '........1.......*...*.......',
      '........1...................',
      '........1................G..',
      ...solid(28, 5),
    ],
    [
      '..........*.........',
      '.........###........',
      '....+...#####.......',
      '.......#######...F..',
      ...solid(20, 5),
    ],
  ]),
});

// ---------------------------------------------------------------------
//  3. GLOWCAP CAVERNS — darkness, bats, falling rocks... and RUN
// ---------------------------------------------------------------------
LEVELS.push({
  name: 'GLOWCAP CAVERNS', theme: 'cave', par: 120,
  blurb: 'DARK CAVES. SOMETHING\nBIG IS ROLLING...',
  signs: [
    "IT'S DARK DOWN HERE. GLOWING MUSHROOMS AND GEMS LIGHT THE WAY.",
    'WATCH THE CEILING... AND NEVER STOMP A SPIKY HEDGEHOG!',
    'BOMB BEETLES! STOMP ONE TO LIGHT IT, THEN KICK IT AT THAT CRACKED WALL.',
    'HEAR THAT RUMBLE? KEEP YOUR LEGS READY...',
  ],
  events: [
    { type: 'dark', trigger: '2', level: 0.94, msg: 'LIGHTS OUT!', col: '#c08aff' },
    { type: 'dark', trigger: '3', restore: true, msg: 'LIGHT AGAIN!', col: '#7aff9a' },
    { type: 'boulder', trigger: '4', marker: 'o', dir: 1, msg: 'RUN!!!', col: '#ff5a3a' },
  ],
  map: hjoin(20, [
    [...solid(12, 3), ...empty(12, 11), '.P...?......', ...solid(12, 5)],
    [ // stalactites and a hedgehog
      ...solid(24, 8),
      '......!.....!.....!.....',
      ...empty(24, 4),
      '........*.......*.......',
      '...?...........N........',
      ...solid(24, 5),
    ],
    [ // ledges over a spike chasm, bats above
      ...solid(26, 3),
      '......Y.........Y.........',
      '..........................',
      '..............*...........',
      '..........................',
      '..........................',
      '.............===..........',
      '........*.........*.......',
      '........===.......===.....',
      '..........................',
      '...===....................',
      '..........................',
      '..........................',
      '##......................##',
      '##......................##',
      '##......................##',
      '##^^^^^^^^^^^^^^^^^^^^^^##',
      ...solid(26, 1),
    ],
    [...solid(16, 3), ...empty(16, 8), '..........2.....', '..........2.....', '..........2.....', '..S...&...2.....', ...solid(16, 5)],
    [ // in the dark
      ...solid(30, 3),
      ...empty(30, 5),
      '......................;.......',
      ...empty(30, 1),
      '..............................',
      '......*.*.........*...........',
      '..............................',
      '..............#####...........',
      '..............#####.......N...',
      '######...###########...#######',
      '######...###########...#######',
      '######...###########...#######',
      '######^^^###########^^^#######',
      ...solid(30, 1),
    ],
    [ // light returns; cracked floor over a tunnel
      ...solid(22, 3),
      ...empty(22, 7),
      '......................',
      '...3..................',
      '...3..................',
      '...3..................',
      '...3.....*............',
      '########XXXXX##..#####',
      '#######..........#####',
      '#######.*.*.*...T#####',
      ...solid(22, 2),
    ],
    [ // a bomb beetle and a suspicious crack in the rock
      ...solid(22, 3),
      ...empty(22, 9),
      '...............#######',
      '...............XX*.*.#',
      '...?....{......XX....#',
      ...solid(22, 5),
    ],
    [...solid(12, 3), ...empty(12, 11), '...S..+.?...', ...solid(12, 5)],
    [ // the boulder run
      ...solid(40, 3),
      ...empty(40, 7),
      '.....4..................................',
      '.....4....*.......*.......*.............',
      'o....4..............................####',
      '.....4..............................####',
      '.....4..............................####',
      '##########.#######.#######.#############',
      '##########^#######^#######^#############',
      ...solid(40, 3),
    ],
    [...solid(16, 3), ...empty(16, 8), '......*....F....', ...solid(16, 8)],
  ]),
});

// ---------------------------------------------------------------------
//  4. MAGMA SHAFT — climb before the lava catches you
// ---------------------------------------------------------------------
LEVELS.push({
  name: 'MAGMA SHAFT', theme: 'magma', par: 100, vertical: true,
  blurb: 'CLIMB! THE LAVA\nWILL NOT WAIT.',
  signs: ["IT'S GETTING VERY WARM DOWN HERE... BETTER START CLIMBING. FAST. (THAT BUBBLE ORB IS A SHIELD!)"],
  events: [{ type: 'rise', trigger: '1', speed: 22, stopRow: 9, msg: 'THE LAVA IS RISING!', col: '#ff7a3a' }],
  map: build(24, 72, (b) => {
    b.fill(0, 0, 1, 72); b.fill(23, 0, 1, 72); b.fill(0, 69, 24, 3);
    b.put(1, 68, 'P   ?   &   +');
    b.put(16, 35, 'E'); b.put(22, 10, 'R');
    b.put(3, 66, '====');
    b.put(8, 63, '====');
    b.fill(1, 62, 22, 1, '1');
    b.put(15, 60, '====');
    b.put(10, 57, 'CCCC'); b.put(11, 56, '*');
    b.fill(1, 54, 4, 1); b.put(5, 54, '====='); b.put(8, 53, 'S');
    b.fill(4, 42, 2, 10); // chimney pillar
    b.put(2, 48, '*'); b.put(2, 45, '*'); b.put(4, 41, '*');
    b.put(8, 39, '===='); b.put(13, 36, '===='); b.put(15, 35, '*');
    b.put(18, 33, '===='); b.put(20, 32, '*');
    b.put(12, 30, '===='); b.put(14, 29, '*');
    b.put(13, 27, '===');
    b.fill(17, 24, 5, 2); b.put(19, 23, 'S'); b.put(19, 26, 'Y');
    b.put(11, 21, 'CCCC');
    b.put(5, 18, '===='); b.put(6, 17, 'T'); b.put(6, 15, '*'); b.put(6, 12, '*');
    b.put(3, 11, '======');
    b.put(11, 8, '====');
    b.fill(15, 6, 9, 2); b.put(20, 5, 'F'); b.put(20, 4, '*');
  }),
});

// ---------------------------------------------------------------------
//  5. SKY RUINS — guardians, traps and a very shaky afternoon
// ---------------------------------------------------------------------
LEVELS.push({
  name: 'SKY RUINS', theme: 'ruins', par: 130,
  blurb: 'ANCIENT TRAPS AND\nSHAKY GROUND.',
  signs: [
    'ANCIENT RUINS! STONE GUARDIANS SLAM DOWN ON ANYONE WHO LINGERS BELOW. KEEP MOVING!',
    'SOME RUIN WALLS ARE NOT AS SOLID AS THEY LOOK...',
  ],
  events: [
    { type: 'spikes', trigger: '1', marker: 's', delay: 0.45, msg: 'TRAP!', col: '#ff5a5a' },
    { type: 'quake', trigger: '2', duration: 6, msg: 'EARTHQUAKE!', col: '#ffb05a' },
    { type: 'spikes', trigger: '3', marker: 'u', delay: 0.3, msg: 'NOT SO FAST!', col: '#ff5a5a' },
  ],
  map: hjoin(20, [
    ['............', '.P..?.......', ...solid(12, 5)],
    [ // guardian hall
      ...solid(26, 3),
      '......K......K......K.....',
      ...empty(26, 4),
      '...*.....*......*......*..',
      ...solid(26, 5),
    ],
    [ // a quiet stretch of floor...
      '...1................',
      '...1................',
      '...1.......*........',
      '...1.....sss........',
      ...solid(20, 5),
    ],
    [ // elevator up the tower, secret room inside
      '.................W........',
      '..........................',
      '...........:.....*..Q.....',
      '..............############',
      '..............############',
      '..............%%%.*.*.*.##',
      '..............%%%.......##',
      '..............############',
      '..............############',
      '..............############',
      '..............############',
      '..S..?.....V..############',
      ...solid(26, 5),
    ],
    [ // sky crossing
      '..........................',
      '........*......U.*........',
      '......................R.M.',
      'H.....................####',
      ...Array(13).fill('......................####'),
    ],
    [ // down the stairs into the quake
      '####....................',
      '####....................',
      '####....................',
      '########................',
      '########................',
      '########......2.........',
      '############..2....*....',
      '############..2.........',
      '############..2..+.....Q',
      '################..######',
      '################..######',
      '################^^######',
      ...solid(24, 2),
    ],
    [ // last guardians
      ...solid(22, 2),
      '....K.......K.........',
      '.......*......*.......',
      '...........3..........',
      '...........3..........',
      '.S....{....3....uuF...',
      ...solid(22, 5),
    ],
  ]),
});

// ---------------------------------------------------------------------
//  6. FROSTBITE PEAKS — ice, wind and an avalanche
// ---------------------------------------------------------------------
LEVELS.push({
  name: 'FROSTBITE PEAKS', theme: 'ice', par: 120,
  blurb: 'SLIPPERY ICE AND\nWILD MOUNTAIN WIND.',
  signs: [
    'ICE IS SLIPPERY! LET GO EARLY TO STOP IN TIME. PENGUINS LOVE IT...',
    'THE WIND UP HERE IS WILD. WATCH FOR THE ◀◀ ▶▶ ARROWS BEFORE A GUST.',
  ],
  events: [
    { type: 'weather', trigger: '1', gusts: true, msg: 'THE WIND PICKS UP!', col: '#bfe4ff' },
    { type: 'weather', trigger: '2', gusts: false },
    { type: 'boulder', trigger: '2', marker: 'o', dir: 1, snow: true, msg: 'AVALANCHE!!', col: '#ffffff' },
    { type: 'weather', trigger: '3', gusts: true },
  ],
  map: hjoin(20, [
    ['.P..?.......', ...solid(12, 5)],
    [ // ice field
      '........*.......*.......*...',
      '............................',
      '............_.......___.....',
      'IIIIIII...IIIIIII...IIIIIIII',
      '#######...#######...########',
      '#######...#######...########',
      '#######^^^#######^^^########',
      ...solid(28, 1),
    ],
    [ // windy ledges
      '.....1......*......*......',
      '.."..1....................',
      '.....1....###....###...###',
      '..S?.1....................',
      ...Array(5).fill('########..................'),
    ],
    [ // avalanche run
      'o.............................',
      '.....2........................',
      '.....2........................',
      '.....2....*.......*.......*...',
      '########......................',
      '################..............',
      '####################.####.####',
      '####################^####^####',
      ...solid(30, 3),
    ],
    ['......*.........', '......##########', '......##########', '......##########', ...solid(16, 5)],
    [ // icy summit steps
      '......................F...',
      '..................*..#####',
      '.....................#####',
      '.................III.#####',
      '....3................#####',
      '....3........III.....#####',
      '..S.3......*.........#####',
      '######CCCCCC.........#####',
      ...Array(7).fill('######...............#####'),
    ],
  ]),
});

// ---------------------------------------------------------------------
//  7. THUNDER SPIRE — a tower climb in a lightning storm
// ---------------------------------------------------------------------
LEVELS.push({
  name: 'THUNDER SPIRE', theme: 'storm', par: 140, vertical: true,
  blurb: 'A TOWER IN THE STORM.\nMIND THE LIGHTNING!',
  signs: ["LIGHTNING STRIKES WHERE THE YELLOW MARKS FLASH. DON'T STAND ON THEM! (GRUMBLE CLOUDS CAN BE BONKED.)"],
  weather: { lightning: true },
  events: [
    { type: 'weather', trigger: '2', gusts: true, msg: 'STORM WINDS!', col: '#bfe4ff' },
    { type: 'flagRun', markers: ['f'], lines: ['TOO SLOW!', 'OVER HERE!'] },
  ],
  map: build(24, 76, (b) => {
    b.fill(0, 0, 1, 76); b.fill(23, 0, 1, 76); b.fill(0, 73, 24, 3);
    b.put(2, 72, 'P  ?  &');
    b.put(7, 18, 'E'); b.put(22, 38, 'R'); b.put(10, 30, '`');
    b.put(8, 70, '===='); b.put(9, 69, '*');
    b.put(14, 67, '====');
    b.put(18, 64, '=====');
    b.fill(18, 45, 2, 17); // chimney pillar
    b.put(21, 58, '*'); b.put(21, 52, '*'); b.put(21, 47, '*');
    b.put(12, 42, '====');
    b.fill(1, 40, 22, 1, '2');
    b.put(7, 39, 'CCC');
    b.fill(1, 36, 4, 2); b.put(2, 35, 'S');
    b.put(4, 33, ':H'); b.put(19, 33, ':');
    b.put(11, 31, '*');
    b.fill(20, 30, 3, 2); b.put(21, 29, '+');
    b.fill(14, 28, 4, 1); b.put(16, 22, 'K');
    b.put(9, 25, '===='); b.put(10, 24, '*');
    b.put(3, 22, '===='); b.put(4, 21, 'T'); b.put(4, 18, '*');
    b.put(2, 15, '======');
    b.put(9, 12, '===='); b.put(10, 11, '*');
    b.put(14, 9, '====');
    b.fill(18, 7, 5, 2); b.put(21, 6, 'F');
    b.fill(1, 7, 5, 2); b.put(3, 6, 'f'); b.put(2, 6, '*');
    b.put(10, 7, 'H');
    b.put(12, 4, '*');
  }),
});

// ---------------------------------------------------------------------
//  8. STORMBEAK'S ROOST — the summit
// ---------------------------------------------------------------------
LEVELS.push({
  name: "STORMBEAK'S ROOST", theme: 'summit', par: 150, music: 'storm',
  blurb: 'THE SUMMIT.\nFACE STORMBEAK.',
  signs: [
    'THE SUMMIT! ONE LAST GAUNTLET STANDS BETWEEN YOU AND THE NEST.',
    "STORMBEAK IS DIZZY AFTER EVERY DIVE. THAT'S YOUR CHANCE: BONK IT ON THE HEAD!",
  ],
  events: [{ type: 'arena', trigger: '9', from: 'q', to: 'p', gate: 'g' }],
  map: build(88, 20, (b) => {
    b.fill(0, 17, 88, 3);
    // the gauntlet: a saw, a fire bar, beat blocks over spikes, a grumble cloud
    b.put(1, 16, 'P  ?'); b.put(9, 16, 'O'); b.put(9, 12, '*');
    b.fill(13, 14, 3, 3); b.put(14, 13, 'E'); b.put(14, 10, '*');
    b.put(19, 12, '*'); b.fill(20, 17, 12, 1, '^');
    b.put(21, 14, '[['); b.put(25, 14, ']]'); b.put(29, 14, '[['); b.put(27, 11, '*');
    b.put(36, 9, '`'); b.put(37, 16, '&');
    // the nest
    b.put(46, 16, '?');
    b.fill(48, 15, 3, 2); b.put(49, 14, '*');
    b.fill(52, 13, 3, 4); b.put(53, 12, '*');
    b.fill(56, 15, 3, 2); b.put(57, 14, '*');
    b.put(59, 16, '+'); b.put(61, 16, 'S');
    b.fill(64, 6, 1, 8);
    b.put(64, 14, 'g'); b.put(64, 15, 'g'); b.put(64, 16, 'g');
    b.put(64, 5, 'q'); b.put(87, 16, 'p');
    b.put(67, 13, '===='); b.put(81, 13, '====');
    b.fill(67, 14, 1, 3, '9');
    b.put(75, 8, 'D');
  }),
});

// ---------------------------------------------------------------------
//  NEW: TIMBERLINE SAWMILL — belts, blades, bombs... and the BIG SAW
// ---------------------------------------------------------------------
const SAWMILL = {
  name: 'TIMBERLINE SAWMILL', theme: 'sawmill', par: 150,
  blurb: 'AN OLD MILL THAT\nNEVER STOPPED RUNNING.',
  signs: [
    'THE OLD SAWMILL STILL RUNS ALL BY ITSELF. MIND THE BLADES!',
    'SAW BLADES BITE. JUMP CLEAN OVER THEM.',
    'CONVEYOR BELTS PUSH YOU AROUND. KEEP YOUR FEET MOVING!',
    'BOMB BEETLES! STOMP ONE, THEN KICK IT AWAY... OR RUN.',
    'CANNONS FIRE IRON BALLS. JUMP THEM - OR STOMP ONE FOR A BIG BOUNCE!',
    'A STAR ORB! GRAB IT AND NOTHING CAN STOP YOU FOR A FEW SECONDS.',
    "HEAR THAT? THE BIG SAW IS WAKING UP... RUN, AND DON'T LOOK BACK!",
  ],
  events: [{ type: 'chase', trigger: '5', marker: 'w', stop: 'x', speed: 80, msg: 'THE BIG SAW!!', col: '#ff5a3a' }],
  map: hjoin(20, [
    ['..............', '.P...?........', ...solid(14, 5)],
    [ // half-buried blades
      '....................',
      '........*.*.........',
      '....................',
      '.?......O.....O.....',
      ...solid(20, 5),
    ],
    [ // belts that push you back toward a blade
      '........................',
      '.........*....*....*....',
      '........................',
      '...?....................',
      '##O#((((((((((((((((####',
      ...solid(24, 4),
    ],
    [ // a blade sweeps the floor: take the planks, or time it
      '..........................',
      '.....*......*......*......',
      '..........................',
      '....====...====...====....',
      '..........................',
      '..:Z..................:...',
      ...solid(26, 5),
    ],
    [ // log deck: a bomb beetle, crumbly logs and a boar
      '..............................',
      '...................*..*.......',
      '..................CCCCCC......',
      '..............................',
      '.?..........{..........A......',
      ...solid(30, 5),
    ],
    ['............', '..S...?.....', ...solid(12, 5)],
    [ // cannon alley over the spike pits
      '..............................',
      '.....*.......*.......*........',
      '..............................',
      '.............................R',
      '##....###....###....##########',
      '##....###....###....##########',
      '##....###....###....##########',
      '##^^^^###^^^^###^^^^##########',
      ...solid(30, 1),
    ],
    [ // star power on a runaway belt full of critters
      '..................................',
      '..................................',
      '...@..............................',
      '..===.............................',
      '..................................',
      '..?.....B....A.....{....B....A....',
      '########))))))))))))))))))########',
      ...solid(34, 4),
    ],
    [ // bobbing blades
      '........................',
      '........................',
      '.....:....*...:..*......',
      '........................',
      '........................',
      '..S..J........J.......?.',
      ...solid(24, 5),
    ],
    [ // THE BIG SAW
      '............................................................',
      '............................................................',
      '............................................................',
      '..5.............*.........*.............*...........*.......',
      '..5.........................................................',
      '..5...........................##............................',
      'w.5...........................##...........A.........x......',
      '##########))))))))))))CCCC########....))))))))))))##########',
      '######################....########^^^^######################',
      '######################^^^^##################################',
      ...solid(60, 2),
    ],
    ['................', '....+.....F.....', ...solid(16, 5)],
  ]),
};

// ---------------------------------------------------------------------
//  NEW: CLOUD GARDEN — melting clouds, updrafts and beat blocks
// ---------------------------------------------------------------------
const CLOUDS = {
  name: 'CLOUD GARDEN', theme: 'clouds', par: 140,
  blurb: 'SOFT CLOUDS, HARD\nLANDINGS.',
  signs: [
    'CLOUD GARDEN! FLUFFY CLOUDS MELT A MOMENT AFTER YOU LAND. HOP, HOP, HOP!',
    'WARM AIR RISES. STEP INTO THE UPDRAFT AND RIDE IT UP!',
    'RED AND BLUE BLOCKS SWAP PLACES ON THE BEAT. LISTEN FOR THE TICKS... THEN JUMP!',
    'WHAT A LOVELY, STURDY CLOUD BRIDGE. NOTHING COULD POSSIBLY GO WRONG.',
    'WINGS! TAP {jump} IN THE AIR TO FLAP. THE HIGH GEMS ARE YOURS!',
  ],
  events: [{ type: 'dissolve', trigger: '6', from: 'd', to: 'e', delay: 0.35, stagger: 0.04, msg: 'UH OH...', col: '#ffffff' }],
  map: hjoin(22, [
    ['..............', '.P..?.........', ...solid(14, 4)],
    [ // melting stepping stones
      '.....*......*......*....',
      '...........~~~..........',
      '....~~~...........~~~...',
      ...empty(24, 5),
    ],
    [ // the first updraft
      '......................',
      '...........*..*.......',
      '........||............',
      '........||............',
      '........||.###########',
      ...Array(7).fill('........||.###########'),
      '.?......||.###########',
      ...Array(4).fill('########||.###########'),
    ],
    [ // beat blocks over the void
      '............................',
      '.......*.......*.......*....',
      '............................',
      '..S..?......................',
      '######[[..]]..[[..]]..[[..##',
      ...Array(11).fill('######....................##'),
    ],
    [ // the bridge...
      '....................................',
      '....................................',
      '............6.......................',
      '............6.......................',
      '..?.........6.......................',
      '###~~~~~~~~~~~~~~~~~~~~~~~~~~~......',
      '...d.........................e######',
      '...........................#########',
      '..................`........#########',
      '...........................#########',
      '........................############',
      '......*.....*.........*.############',
      '........................############',
      ...solid(36, 3),
    ],
    [ // wings over the floating islands
      '..........*.....*.....*.......',
      '..............................',
      '..........W...................',
      '...................U..........',
      '..............................',
      '.S.."..?......T...............',
      '#########...######...#########',
      ...Array(9).fill('#########...######...#########'),
    ],
    ['................', '..+.......F.....', ...solid(16, 10)],
  ]),
};

LEVELS.splice(3, 0, SAWMILL);
LEVELS.splice(7, 0, CLOUDS);
