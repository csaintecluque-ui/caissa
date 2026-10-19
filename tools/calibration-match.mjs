// Matchs de calibration : personnages Stockfish contre Maia (niveau Lichess connu).
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { Engine } = require('./uci.js');
import { Chess } from '/home/claude/caissa/js/lib/chess.js';
import { parseModel, setPolicyTables, movePolicy } from '/home/claude/caissa/js/maia.js';
import { chooseMove, paramsForElo, humanMove, humanParams } from '/home/claude/caissa/js/bots.js';
import { lineWin } from '/home/claude/caissa/js/engine.js';

setPolicyTables(JSON.parse(fs.readFileSync('/home/claude/caissa/maia/policy.json')));
const models = {};
function maia(elo) { if (!models[elo]) { const b = fs.readFileSync(`/home/claude/caissa/maia/maia-${elo}.bin`); models[elo] = parseModel(b.buffer.slice(b.byteOffset, b.byteOffset + b.length)); } return models[elo]; }
export function sampleMaia(moves, T = 1, floor = 0.02) {
  let c = moves.filter(m => m.p >= floor); if (!c.length) c = moves.slice(0, 1);
  const w = c.map(m => Math.pow(m.p, 1 / T)); let x = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < c.length; i++) { x -= w[i]; if (x <= 0) return c[i].uci; } return c[0].uci;
}
const spec = s => s.startsWith('hum') ? { kind: 'hum', elo: +s.slice(3) } : s.startsWith('maia') ? { kind: 'maia', elo: +s.slice(4, 8), T: s.includes('t') ? +s.split('t')[1] : 1 } : { kind: 'sf', elo: +s.slice(2), style: 'equilibre' };
const [, , A, B, N = '10', out = '/home/claude/build/gen/res.jsonl'] = process.argv;
const pa = spec(A), pb = spec(B);
const eng = new Engine(); await eng.init();
async function move(p, c, fens) {
  if (p.kind === 'maia') return sampleMaia(movePolicy(maia(p.elo), fens).moves, p.T);
  if (p.kind === 'hum') {
    const pol = movePolicy(maia(humanParams(p.elo).model), fens).moves;
    return humanMove(pol, p.elo, async ucis => {
      const r = await eng.analyse(c.fen(), { depth: 8, multipv: ucis.length, searchmoves: ucis });
      return new Map(r.lines.map(l => [l.move, lineWin(l)]));
    });
  }
  const P = paramsForElo(p.elo);
  const r = await eng.analyse(c.fen(), { depth: P.depth, multipv: P.mpv });
  return chooseMove(r, { elo: p.elo, style: p.style }, c.fen());
}
let score = 0;
for (let g = 0; g < +N; g++) {
  const white = g % 2 === 0 ? pa : pb;
  const c = new Chess(); const fens = [c.fen()];
  while (!c.isGameOver() && c.history().length < 200) {
    const p = c.turn() === 'w' ? white : (white === pa ? pb : pa);
    const u = await move(p, c, fens);
    c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] || undefined });
    fens.push(c.fen());
  }
  let res; // du point de vue des Blancs
  if (c.isCheckmate()) res = c.turn() === 'w' ? 0 : 1;
  else if (c.isGameOver()) res = 0.5;
  else { const r = await eng.analyse(c.fen(), { depth: 12 }); const l = r.lines[0]; const v = (l.mate != null ? (l.mate > 0 ? 9999 : -9999) : l.cp) * (c.turn() === 'w' ? 1 : -1); res = v > 300 ? 1 : v < -300 ? 0 : 0.5; }
  const sA = white === pa ? res : 1 - res;
  score += sA;
  fs.appendFileSync(out, JSON.stringify({ A, B, sA, plies: c.history().length }) + '\n');
}
console.log(A, 'vs', B, score, '/', N);
eng.quit();
