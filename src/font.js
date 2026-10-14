// =====================================================================
//  FONT — 5x7 pixel font with inline icons, tinted & cached per colour
// =====================================================================
const Font = (() => {
  const G = {
    A: '.###.|#...#|#...#|#####|#...#|#...#|#...#', B: '####.|#...#|#...#|####.|#...#|#...#|####.',
    C: '.###.|#...#|#....|#....|#....|#...#|.###.', D: '####.|#...#|#...#|#...#|#...#|#...#|####.',
    E: '#####|#....|#....|####.|#....|#....|#####', F: '#####|#....|#....|####.|#....|#....|#....',
    G: '.###.|#...#|#....|#.###|#...#|#...#|.####', H: '#...#|#...#|#...#|#####|#...#|#...#|#...#',
    I: '###|.#.|.#.|.#.|.#.|.#.|###', J: '..###|...#.|...#.|...#.|#..#.|#..#.|.##..',
    K: '#...#|#..#.|#.#..|##...|#.#..|#..#.|#...#', L: '#....|#....|#....|#....|#....|#....|#####',
    M: '#...#|##.##|#.#.#|#.#.#|#...#|#...#|#...#', N: '#...#|#...#|##..#|#.#.#|#..##|#...#|#...#',
    O: '.###.|#...#|#...#|#...#|#...#|#...#|.###.', P: '####.|#...#|#...#|####.|#....|#....|#....',
    Q: '.###.|#...#|#...#|#...#|#.#.#|#..#.|.##.#', R: '####.|#...#|#...#|####.|#.#..|#..#.|#...#',
    S: '.####|#....|#....|.###.|....#|....#|####.', T: '#####|..#..|..#..|..#..|..#..|..#..|..#..',
    U: '#...#|#...#|#...#|#...#|#...#|#...#|.###.', V: '#...#|#...#|#...#|#...#|#...#|.#.#.|..#..',
    W: '#...#|#...#|#...#|#.#.#|#.#.#|#.#.#|.#.#.', X: '#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#',
    Y: '#...#|#...#|.#.#.|..#..|..#..|..#..|..#..', Z: '#####|....#|...#.|..#..|.#...|#....|#####',
    0: '.###.|#...#|#..##|#.#.#|##..#|#...#|.###.', 1: '..#..|.##..|..#..|..#..|..#..|..#..|.###.',
    2: '.###.|#...#|....#|...#.|..#..|.#...|#####', 3: '####.|....#|....#|.###.|....#|....#|####.',
    4: '...#.|..##.|.#.#.|#..#.|#####|...#.|...#.', 5: '#####|#....|####.|....#|....#|#...#|.###.',
    6: '.###.|#....|#....|####.|#...#|#...#|.###.', 7: '#####|....#|...#.|..#..|.#...|.#...|.#...',
    8: '.###.|#...#|#...#|.###.|#...#|#...#|.###.', 9: '.###.|#...#|#...#|.####|....#|....#|.###.',
    '.': '..|..|..|..|..|##|##', ',': '..|..|..|..|..|.#|#.', '!': '#|#|#|#|#|.|#',
    '?': '.###.|#...#|....#|...#.|..#..|.....|..#..', ':': '.|##|##|.|##|##|.'.replace(/##/g, '#'),
    '-': '....|....|....|####|....|....|....', '+': '.....|..#..|..#..|#####|..#..|..#..|.....',
    '/': '....#|....#|...#.|..#..|.#...|#....|#....', "'": '#|#|.|.|.|.|.', '"': '#.#|#.#|...|...|...|...|...',
    '(': '.#|#.|#.|#.|#.|#.|.#', ')': '#.|.#|.#|.#|.#|.#|#.', '%': '##..#|##.#.|...#.|..#..|.#...|.#.##|#..##',
    '*': '.....|#.#.#|.###.|#####|.###.|#.#.#|.....', '<': '...#|..#.|.#..|#...|.#..|..#.|...#',
    '>': '#...|.#..|..#.|...#|..#.|.#..|#...', '=': '.....|.....|#####|.....|#####|.....|.....',
    '_': '.....|.....|.....|.....|.....|.....|#####', '#': '.#.#.|#####|.#.#.|.#.#.|.#.#.|#####|.#.#.',
    '×': '.....|.....|#...#|.#.#.|..#..|.#.#.|#...#',
    '♥': '.##.##.|#######|#######|#######|.#####.|..###..|...#...',
    '◆': '...#...|..###..|.#####.|#######|.#####.|..###..|...#...',
    '★': '...#...|...#...|#######|.#####.|..###..|.##.##.|.#...#.',
    '☠': '.###.|#####|#.#.#|#####|.###.|.#.#.|.....',
    '⏱': '.###.|#.#.#|#.#.#|#.###|#...#|#...#|.###.',
    '▶': '#...|##..|###.|####|###.|##..|#...', '◀': '...#|..##|.###|####|.###|..##|...#',
    '▲': '.......|...#...|..###..|.#####.|#######|.......|.......',
    '▼': '.......|.......|#######|.#####.|..###..|...#...|.......',
    '♪': '..###|..#.#|..#..|..#..|###..|###..|.....', '¤': '.###.|#...#|#...#|#####|##.##|##.##|#####',
    '✓': '......|.....#|....#.|#..#..|.##...|......|......',
  };
  const CELL = 8;
  const chars = Object.keys(G);
  const metrics = {};
  const atlas = document.createElement('canvas');
  atlas.width = CELL * chars.length; atlas.height = CELL;
  const actx = atlas.getContext('2d');
  actx.fillStyle = '#fff';
  chars.forEach((ch, i) => {
    const rows = G[ch].split('|');
    const w = rows[0].length;
    metrics[ch] = { sx: i * CELL, w };
    rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (row[x] === '#') actx.fillRect(i * CELL + x, y, 1, 1); });
  });
  const tinted = new Map();
  function tint(color) {
    let c = tinted.get(color);
    if (!c) {
      c = document.createElement('canvas'); c.width = atlas.width; c.height = atlas.height;
      const g = c.getContext('2d');
      g.drawImage(atlas, 0, 0);
      g.globalCompositeOperation = 'source-in';
      g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
      tinted.set(color, c);
    }
    return c;
  }
  const SPACE = 3;
  function glyphW(ch) {
    if (ch === ' ') return SPACE;
    const m = metrics[ch] || metrics['?'];
    return m.w;
  }
  function lineWidth(line, scale = 1) {
    let w = 0;
    for (let i = 0; i < line.length; i++) w += glyphW(line[i]) + (i < line.length - 1 ? 1 : 0);
    return w * scale;
  }
  function width(str, scale = 1) {
    return Math.max(...String(str).toUpperCase().split('\n').map((l) => lineWidth(l, scale)));
  }
  function drawLine(img, line, x, y, scale, g) {
    let cx = x;
    for (const ch of line) {
      if (ch === ' ') { cx += (SPACE + 1) * scale; continue; }
      const m = metrics[ch] || metrics['?'];
      g.drawImage(img, m.sx, 0, m.w, 7, cx, y, m.w * scale, 7 * scale);
      cx += (m.w + 1) * scale;
    }
  }
  // draw(text, x, y, {color, scale, align, shadow, outline, alpha, g})
  function draw(text, x, y, o = {}) {
    const g = o.g || ctx;
    const scale = o.scale || 1;
    const color = o.color || '#ffffff';
    const lines = String(text).toUpperCase().split('\n');
    const lh = (o.lineHeight || 10) * scale;
    const prevAlpha = g.globalAlpha;
    if (o.alpha != null) g.globalAlpha = prevAlpha * o.alpha;
    lines.forEach((line, li) => {
      const w = lineWidth(line, scale);
      let lx = x;
      if (o.align === 'center') lx = x - Math.floor(w / 2);
      else if (o.align === 'right') lx = x - w;
      lx = Math.round(lx);
      const ly = Math.round(y + li * lh);
      if (o.outline) {
        const oc = tint(o.outline === true ? '#141020' : o.outline);
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) drawLine(oc, line, lx + dx * scale, ly + dy * scale, scale, g);
      } else if (o.shadow !== false) {
        drawLine(tint(o.shadow && o.shadow !== true ? o.shadow : '#141020'), line, lx, ly + scale, scale, g);
      }
      drawLine(tint(color), line, lx, ly, scale, g);
    });
    g.globalAlpha = prevAlpha;
  }
  // word-wrap a string to a pixel width
  function wrap(text, maxW, scale = 1) {
    const out = [];
    for (const para of String(text).toUpperCase().split('\n')) {
      let line = '';
      for (const word of para.split(' ')) {
        const test = line ? line + ' ' + word : word;
        if (lineWidth(test, scale) > maxW && line) { out.push(line); line = word; } else line = test;
      }
      out.push(line);
    }
    return out;
  }
  return { draw, width, wrap, glyphs: G };
})();
