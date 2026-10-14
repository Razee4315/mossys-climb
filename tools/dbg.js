// node tools/dbg.js script.js  -> evaluates script.js inside the game's scope
const { makeGame } = require('./verify');
const out = makeGame().run(require('fs').readFileSync(process.argv[2], 'utf8'));
if (out !== undefined) console.log(out);
