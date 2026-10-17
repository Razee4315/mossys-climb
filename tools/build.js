// Bundles src/*.js into a single self-contained HTML file.
//   node tools/build.js   -> writes 04-platformer.html and dist/index.html
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const ORDER = ['core', 'font', 'audio', 'art', 'themes', 'levels', 'world', 'hazards', 'powerups', 'player', 'enemies', 'game', 'ui', 'opening'];
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

// ---- pixel art -> SVG (merged horizontal runs, crisp edges) ----
function gridToSvg(grid, id) {
  const h = grid.length, w = grid[0].length;
  let rects = '';
  for (let y = 0; y < h; y++) {
    let x = 0;
    while (x < w) {
      const c = grid[y][x];
      if (!c) { x++; continue; }
      let n = 1;
      while (x + n < w && grid[y][x + n] === c) n++;
      rects += `<rect x="${x}" y="${y}" width="${n}" height="1" fill="${c}"/>`;
      x += n;
    }
  }
  return `<svg id="${id}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w * 4}" height="${h * 4}" shape-rendering="crispEdges" aria-hidden="true">${rects}</svg>`;
}
function outline(grid, color, r) {
  const h = grid.length, w = grid[0].length;
  const out = grid.map((row) => row.slice());
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (grid[y][x]) continue;
    let near = false;
    for (let dy = -r; dy <= r && !near; dy++) for (let dx = -r; dx <= r && !near; dx++) {
      const yy = y + dy, xx = x + dx;
      if (yy >= 0 && yy < h && xx >= 0 && xx < w && grid[yy][xx]) near = true;
    }
    if (near) out[y][x] = color;
  }
  return out;
}

function loaderArt() {
  const { makeGame } = require('./verify');
  const game = makeGame();
  const G = game.run('Font.glyphs');
  const glyph = (ch) => (ch === ' ' ? null : G[ch].split('|'));
  const textWidth = (s) => [...s].reduce((a, ch, i) => a + (ch === ' ' ? 3 : glyph(ch)[0].length) + (i ? 1 : 0), 0);
  const lines = [["MOSSY'S", 2, '#a6f27c'], ['CLIMB', 4, '#ffd84a']];
  const pad = 3, gap = 4;
  const W = Math.max(...lines.map(([s, sc]) => textWidth(s) * sc)) + pad * 2;
  const H = lines.reduce((a, [, sc]) => a + 7 * sc, 0) + gap + pad * 2;
  const grid = Array.from({ length: H }, () => Array(W).fill(null));
  let y0 = pad;
  for (const [s, sc, col] of lines) {
    let x = Math.floor((W - textWidth(s) * sc) / 2);
    for (const ch of s) {
      if (ch === ' ') { x += 4 * sc; continue; }
      const rows = glyph(ch);
      rows.forEach((row, gy) => { for (let gx = 0; gx < row.length; gx++) if (row[gx] === '#') for (let i = 0; i < sc; i++) for (let j = 0; j < sc; j++) grid[y0 + gy * sc + j][x + gx * sc + i] = col; });
      x += (rows[0].length + 1) * sc;
    }
    y0 += 7 * sc + gap;
  }
  const logo = gridToSvg(outline(grid, '#1a1428', 2), 'ld-logo');
  // the frog
  const rows = game.run("composeChar(charById('mossy'), 0, 'stand')");
  const pal = game.run("charById('mossy').pal");
  const fg = [Array(18).fill(null)].concat(rows.map((r) => [null, ...[...r].map((c) => (c === '.' ? null : pal[c])), null]), [Array(18).fill(null)]);
  const frog = gridToSvg(outline(fg, '#13261b', 1), 'ld-frog');
  return { logo, frog };
}

const shell = fs.readFileSync(path.join(SRC, 'shell.html'), 'utf8');
const js = ORDER.map((n) => `// ---- ${n}.js ----\n` + fs.readFileSync(path.join(SRC, n + '.js'), 'utf8').replace(/^'use strict';\s*/, '')).join('\n')
  .replace(/__APP_VERSION__/g, pkg.version);
const bundle = `<script>\n(() => {\n'use strict';\n${js}\nboot();\n})();\n</script>`;
const art = loaderArt();
const out = shell
  .replace('<!-- LOADER_LOGO -->', () => art.logo)
  .replace('<!-- LOADER_FROG -->', () => art.frog)
  .replace('<!-- SCRIPTS -->', () => bundle);
fs.writeFileSync(path.join(ROOT, '04-platformer.html'), out);
fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'dist', 'index.html'), out);
console.log(`built 04-platformer.html + dist/index.html  v${pkg.version}  (${(out.length / 1024).toFixed(1)} KB)`);
module.exports = { ORDER };
