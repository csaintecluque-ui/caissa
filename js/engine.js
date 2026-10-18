// Stockfish (WebAssembly, mono-thread) dans un Web Worker, avec file d'attente.
// Toutes les évaluations sont renvoyées du point de vue du camp au trait.
const ENGINE_URL = 'engine/stockfish-19-lite-single.js';

class Engine {
  constructor() {
    this.worker = null;
    this.ready = null;
    this.queue = [];
    this.current = null;
    this.listeners = new Set();
  }

  start() {
    if (this.ready) return this.ready;
    this.ready = new Promise((resolve, reject) => {
      try {
        this.worker = new Worker(ENGINE_URL);
      } catch (e) { reject(e); return; }
      const onBoot = ev => {
        if (ev.data === 'uciok') {
          this.send('setoption name Hash value 32');
          this.send('setoption name UCI_ShowWDL value false');
          this.send('isready');
        } else if (ev.data === 'readyok') {
          this.worker.removeEventListener('message', onBoot);
          this.worker.addEventListener('message', m => this.onLine(m.data));
          resolve();
        }
      };
      this.worker.addEventListener('message', onBoot);
      this.worker.addEventListener('error', e => reject(e));
      this.send('uci');
    });
    return this.ready;
  }

  send(cmd) { this.worker.postMessage(cmd); }

  onLine(line) {
    const job = this.current;
    if (!job) return;
    if (line.startsWith('info') && line.includes(' pv ')) {
      const m = line.match(/depth (\d+).*? multipv (\d+) score (cp|mate) (-?\d+)(?: (?:upperbound|lowerbound))?.*? pv (.+)$/)
        || line.match(/depth (\d+)() score (cp|mate) (-?\d+)(?: (?:upperbound|lowerbound))?.*? pv (.+)$/);
      if (!m) return;
      if (/upperbound|lowerbound/.test(line)) return;
      const depth = +m[1], idx = (+m[2] || 1) - 1;
      const pv = m[5].trim().split(/\s+/);
      job.lines[idx] = { depth, cp: m[3] === 'cp' ? +m[4] : null, mate: m[3] === 'mate' ? +m[4] : null, pv, move: pv[0] };
      if (idx === 0) job.onInfo?.(job.lines.slice(), depth);
    } else if (line.startsWith('bestmove')) {
      const best = line.split(' ')[1];
      this.current = null;
      if (job.cancelled) job.resolve(null);
      else job.resolve({ best: best === '(none)' ? null : best, lines: job.lines.filter(Boolean) });
      this.next();
    }
  }

  /**
   * Analyse une position.
   * opts: depth | movetime, multipv, onInfo(lines, depth), priority ('high' annule les tâches en cours)
   */
  async analyse(fen, opts = {}) {
    await this.start();
    return new Promise(resolve => {
      const job = { fen, opts, resolve, lines: [], onInfo: opts.onInfo, cancelled: false };
      if (opts.priority === 'high') this.cancelAll();
      this.queue.push(job);
      if (!this.current) this.next();
    });
  }

  next() {
    if (this.current || !this.queue.length) return;
    const job = this.queue.shift();
    if (job.cancelled) { job.resolve(null); this.next(); return; }
    this.current = job;
    const o = job.opts;
    this.send(`setoption name MultiPV value ${o.multipv || 1}`);
    this.send(`position fen ${job.fen}`);
    if (o.movetime) this.send(`go movetime ${o.movetime}`);
    else if (o.infinite) this.send('go infinite');
    else this.send(`go depth ${o.depth || 12}`);
  }

  cancelAll() {
    for (const j of this.queue) { j.cancelled = true; j.resolve(null); }
    this.queue = [];
    if (this.current) { this.current.cancelled = true; this.send('stop'); }
  }

  stop() { if (this.current) this.send('stop'); }
}

export const engine = new Engine();

// --- utilitaires d'évaluation ---------------------------------------------
export function lineValue(l) {
  if (!l) return 0;
  if (l.mate != null) return l.mate > 0 ? 10000 - l.mate * 10 : -10000 - l.mate * 10;
  return l.cp;
}
// Probabilité de gain (0-100) — formule utilisée par Lichess
export function winPct(cp) {
  const c = Math.max(-1500, Math.min(1500, cp));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * c)) - 1);
}
export function lineWin(l) {
  if (!l) return 50;
  if (l.mate != null) return l.mate > 0 ? 100 : 0;
  return winPct(l.cp);
}
export function formatEval(l, whitePov = true, turn = 'w') {
  if (!l) return '…';
  const sign = (turn === 'w') === whitePov ? 1 : -1;
  if (l.mate != null) {
    const m = l.mate * sign;
    return (m > 0 ? '#' : '#-') + Math.abs(l.mate);
  }
  const v = (l.cp * sign) / 100;
  return (v > 0 ? '+' : '') + v.toFixed(1);
}
