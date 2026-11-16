// Vérifie toutes les positions du programme de cours (js/cours-data.js) avec Stockfish :
// positions légales, coups jouables, solutions confirmées par le moteur.
//   node tools/verifier-cours.mjs            (résumé)
//   node tools/verifier-cours.mjs --detail   (chaque étape)
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { Chess } from '../js/lib/chess.js';
import { MODULES, START } from '../js/cours-data.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DETAIL = process.argv.includes('--detail');

class Engine {
  constructor() {
    this.proc = spawn(process.execPath, [path.join(ROOT, 'engine/stockfish-19-lite-single.js')], { stdio: ['pipe', 'pipe', 'ignore'] });
    this.buf = ''; this.lines = []; this.waiter = null;
    this.proc.stdout.on('data', d => {
      this.buf += d.toString();
      let i;
      while ((i = this.buf.indexOf('\n')) >= 0) {
        const line = this.buf.slice(0, i).trim(); this.buf = this.buf.slice(i + 1);
        this.lines.push(line);
        if (this.waiter && this.waiter.re.test(line)) { const w = this.waiter; this.waiter = null; w.resolve(this.lines.splice(0)); }
      }
    });
  }
  send(c) { this.proc.stdin.write(c + '\n'); }
  wait(re) { return new Promise(resolve => { this.waiter = { re, resolve }; }); }
  async init() { this.send('uci'); await this.wait(/^uciok/); this.send('setoption name Hash value 64'); this.send('isready'); await this.wait(/^readyok/); }
  async analyse(fen, { depth = 16, multipv = 1 } = {}) {
    this.lines = [];
    this.send(`setoption name MultiPV value ${multipv}`);
    this.send(`position fen ${fen}`);
    this.send(`go depth ${depth}`);
    const out = await this.wait(/^bestmove/);
    const by = {};
    for (const l of out) {
      const m = l.match(/ multipv (\d+) score (cp|mate) (-?\d+)(?! (?:upper|lower)bound).* pv (.+)$/);
      if (m) by[m[1]] = { cp: m[2] === 'cp' ? +m[3] : null, mate: m[2] === 'mate' ? +m[3] : null, pv: m[4].split(' '), move: m[4].split(' ')[0] };
    }
    return Object.keys(by).sort((a, b) => a - b).map(k => by[k]);
  }
  quit() { this.send('quit'); setTimeout(() => this.proc.kill(), 200); }
}

const winPct = l => (l.mate != null ? (l.mate > 0 ? 100 : 0) : 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * Math.max(-1500, Math.min(1500, l.cp)))) - 1));
const ev = l => (l.mate != null ? `#${l.mate}` : (l.cp / 100).toFixed(1));
const play = (c, u) => { try { return c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }); } catch { return null; } };

export function fenOf(step) {
  if (step.fen) return step.fen;
  if (step.apres) { const c = new Chess(START); for (const u of step.apres) if (!play(c, u)) throw new Error('coup illégal dans « apres » : ' + u); return c.fen(); }
  return null;
}

const eng = new Engine();
await eng.init();
let errors = 0, warnings = 0, count = 0;
const err = (where, msg) => { errors++; console.log(`  ✗ ${where} — ${msg}`); };
const warn = (where, msg) => { warnings++; console.log(`  ! ${where} — ${msg}`); };
const info = (where, msg) => { if (DETAIL) console.log(`    ${where} — ${msg}`); };

for (const mod of MODULES) {
  for (const le of mod.lecons) {
    console.log(`${mod.titre} › ${le.titre}`);
    const all = [...le.etapes.map((s, i) => [s, `étape ${i + 1}`]), ...(le.controle || []).map((s, i) => [s, `contrôle ${i + 1}`])];
    for (const [s, where0] of all) {
      count++;
      const where = `${where0} (${s.t})`;
      let fen;
      try { fen = fenOf(s); } catch (e) { err(where, e.message); continue; }
      if (!s.h) err(where, 'texte manquant');
      if (!fen) { if (['demo', 'trouve', 'case', 'partie'].includes(s.t)) err(where, 'position manquante'); continue; }
      let c;
      try { c = new Chess(fen); } catch (e) { err(where, 'FEN invalide : ' + e.message); continue; }
      // le camp qui n'a pas le trait ne doit pas être en échec
      const parts = fen.split(' ');
      const other = new Chess([parts[0], parts[1] === 'w' ? 'b' : 'w', '-', '-', '0', '1'].join(' '), { skipValidation: true });
      if (other.inCheck()) err(where, 'le camp qui n\'a pas le trait est en échec');
      for (const a of s.fl || []) { if (!/^[a-h][1-8][a-h][1-8](:(bad|hint|best))?$/.test(a)) err(where, 'flèche invalide ' + a); }

      if (s.t === 'demo') {
        for (const u of s.coups) if (!play(c, u)) { err(where, `coup illégal ${u}`); break; }
        info(where, `fin : ${c.isCheckmate() ? 'mat' : c.fen()}`);
      }
      if (s.t === 'qcm') { if (!(s.bon >= 0 && s.bon < s.choix.length)) err(where, 'bonne réponse hors liste'); }
      if (s.t === 'case') { for (const sq of s.cases) if (!c.get(sq)) warn(where, `case ${sq} vide`); }
      if (s.t === 'trouve') {
        const camp = s.camp || c.turn();
        const first = c.turn() === camp ? 0 : 1;
        // ligne jouable
        const line = new Chess(fen);
        let legal = true;
        for (const u of s.sol) if (!play(line, u)) { err(where, `coup illégal dans la solution : ${u}`); legal = false; break; }
        if (!legal || s.strict) { if (legal) info(where, 'ligne de répertoire jouable'); continue; }
        // le premier coup de l'élève est-il le meilleur ?
        const pos = new Chess(fen);
        for (let i = 0; i < first; i++) play(pos, s.sol[i]);
        const lines = await eng.analyse(pos.fen(), { depth: 16, multipv: 4 });
        const best = lines[0];
        const accepted = [s.sol[first], ...(s.alt || [])];
        const mine = lines.find(l => l.move === s.sol[first]);
        let wMine;
        if (mine) wMine = winPct(mine);
        else { const p2 = new Chess(pos.fen()); play(p2, s.sol[first]); if (p2.isCheckmate()) wMine = 100; else { const r = await eng.analyse(p2.fen(), { depth: 16 }); wMine = 100 - winPct(r[0]); } }
        if (winPct(best) - wMine > 6) err(where, `la solution ${s.sol[first]} n'est pas le meilleur coup : moteur ${best.move} (${ev(best)}), solution ${wMine.toFixed(0)} %`);
        if (best.mate != null && best.mate > 0 && mine && (mine.mate == null || mine.mate > best.mate)) err(where, `mat plus court disponible : ${best.move} (#${best.mate})`);
        if (wMine < 60 && !['opposition', 'carre', 'berger', 'pieges', 'routine', 'pire-piece'].includes(le.id)) warn(where, `position peu décisive après la solution (${wMine.toFixed(0)} %)`);
        // rivaux : coups non prévus aussi forts que la solution (à ajouter dans « alt » s'ils sont du même ordre d'idée)
        const val = l => (l.mate != null ? (l.mate > 0 ? 100000 - l.mate : -100000 - l.mate) : l.cp);
        const ref = mine || best;
        const rivals = lines.filter(l => !accepted.includes(l.move) && (ref.mate != null ? l.mate != null && l.mate > 0 && l.mate <= ref.mate : val(ref) - val(l) <= 40));
        if (rivals.length) warn(where, `coups non prévus aussi forts (solution ${ev(ref)}) : ${rivals.map(l => `${l.move} ${ev(l)}`).join(', ')}`);
        for (const a of s.alt || []) { const l = lines.find(x => x.move === a); if (l && winPct(best) - winPct(l) > 8) err(where, `variante acceptée ${a} trop faible (${ev(l)})`); }
        // les réponses prévues de l'adversaire sont-elles raisonnables ?
        info(where, `ok ${s.sol[first]} (${ev(mine || best)})${line.isCheckmate() ? ' → mat' : ''}`);
      }
      if (s.t === 'partie') {
        const camp = s.camp || c.turn();
        const lines = await eng.analyse(fen, { depth: 24 });
        const l = lines[0];
        const forMe = c.turn() === camp ? 1 : -1;
        if (s.but === 'mat') { if (l.mate == null && l.cp * forMe > 500) info(where, `gain élémentaire (${ev(l)}), limite ${s.max}`); else if (!(l.mate != null && l.mate * forMe > 0)) err(where, `pas de mat forcé trouvé (${ev(l)})`); else if (Math.abs(l.mate) > s.max - 3) err(where, `mat en ${Math.abs(l.mate)} : limite de ${s.max} coups trop juste`); else info(where, `mat en ${Math.abs(l.mate)}, limite ${s.max}`); }
        if (s.but === 'promo') { const v = l.mate != null ? 9999 * Math.sign(l.mate) : l.cp; if (v * forMe < 300) err(where, `position non gagnante (${ev(l)})`); else info(where, `gagnant (${ev(l)})`); }
        if (s.but === 'nulle') { if (l.mate != null || Math.abs(l.cp) > 60) err(where, `position non nulle (${ev(l)})`); else info(where, `nulle (${ev(l)})`); }
      }
    }
  }
}
console.log(`\n${count} étapes vérifiées — ${errors} erreur(s), ${warnings} avertissement(s).`);
eng.quit();
process.exitCode = errors ? 1 : 0;
