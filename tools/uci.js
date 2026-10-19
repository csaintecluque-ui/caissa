// Minimal UCI driver for the Stockfish wasm build running under Node.
const { spawn } = require('child_process');
const path = require('path');

class Engine {
  constructor() {
    const p = path.join(__dirname, '..', 'node_modules/stockfish/bin/stockfish-19-lite-single.js');
    this.proc = spawn(process.execPath, [p], { stdio: ['pipe', 'pipe', 'inherit'] });
    this.buf = '';
    this.waiters = [];
    this.lines = [];
    this.proc.stdout.on('data', d => {
      this.buf += d.toString();
      let i;
      while ((i = this.buf.indexOf('\n')) >= 0) {
        const line = this.buf.slice(0, i).trim();
        this.buf = this.buf.slice(i + 1);
        this.lines.push(line);
        for (const w of [...this.waiters]) {
          if (w.test(line)) {
            this.waiters.splice(this.waiters.indexOf(w), 1);
            w.resolve(this.lines.splice(0));
          }
        }
      }
    });
  }
  send(c) { this.proc.stdin.write(c + '\n'); }
  wait(re) { return new Promise(resolve => this.waiters.push({ test: l => re.test(l), resolve })); }
  async init() {
    this.send('uci'); await this.wait(/^uciok/);
    this.send('setoption name Hash value 32');
    this.send('isready'); await this.wait(/^readyok/);
  }
  async newGame() { this.send('ucinewgame'); this.send('isready'); await this.wait(/^readyok/); }
  // returns [{move, cp, mate, pv}] from the side to move's POV, sorted by multipv
  async analyse(fen, { depth = 14, multipv = 1, skill = 20, searchmoves = null } = {}) {
    this.lines = [];
    this.send(`setoption name Skill Level value ${skill}`);
    this.send(`setoption name MultiPV value ${multipv}`);
    this.send(`position fen ${fen}`);
    this.send(`go depth ${depth}${searchmoves ? ' searchmoves ' + searchmoves.join(' ') : ''}`);
    const out = await this.wait(/^bestmove/);
    const best = out[out.length - 1].split(' ')[1];
    const byPv = {};
    for (const l of out) {
      if (!l.startsWith('info depth')) continue;
      const m = l.match(/ multipv (\d+) score (cp|mate) (-?\d+).* pv (.+)$/);
      if (!m) continue;
      byPv[m[1]] = { cp: m[2] === 'cp' ? +m[3] : null, mate: m[2] === 'mate' ? +m[3] : null, pv: m[4].split(' '), move: m[4].split(' ')[0] };
    }
    const lines = Object.keys(byPv).sort((a, b) => a - b).map(k => byPv[k]);
    return { best, lines };
  }
  quit() { this.send('quit'); setTimeout(() => this.proc.kill(), 200); }
}
module.exports = { Engine };
