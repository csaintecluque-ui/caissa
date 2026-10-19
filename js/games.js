// Parties enregistrées, import PGN / Lichess / Chess.com, analyse Stockfish
// complète d'une partie et carnet d'erreurs.
import { Chess, uciToMove, moveToUci, pvToSan, sanFr, PIECE_VAL } from './util.js';
import { store, settings, uid } from './store.js';
import { engine, lineWin, lineValue } from './engine.js';
import { OPENINGS } from './openings.js';
import { eloFromAcpl } from './rating.js';

const MAX_GAMES = 80;

export function listGames() { return store.get('games', []); }
export function getGame(id) { return listGames().find(g => g.id === id) || null; }
export function saveGame(g) {
  const games = listGames().filter(x => x.id !== g.id);
  games.unshift(g);
  store.set('games', games.slice(0, MAX_GAMES));
  return g;
}
export function deleteGame(id) { store.set('games', listGames().filter(g => g.id !== id)); }

// Construit un enregistrement de partie à partir d'un objet Chess
export function gameFromChess(chess, meta = {}) {
  const hist = chess.history({ verbose: true });
  const startFen = hist.length ? hist[0].before : chess.fen();
  return {
    id: meta.id || uid(),
    date: meta.date || Date.now(),
    white: meta.white || 'Blancs',
    black: meta.black || 'Noirs',
    result: meta.result || '*',
    you: meta.you ?? null, // 'w' | 'b' | null
    source: meta.source || 'caissa',
    event: meta.event || '',
    timeControl: meta.timeControl || '',
    termination: meta.termination || '',
    startFen,
    moves: hist.map(moveToUci),
    analysis: null,
  };
}

export function pgnOf(g) {
  const c = new Chess(g.startFen);
  for (const u of g.moves) uciToMove(c, u);
  c.setHeader('Event', g.event || 'Caïssa');
  c.setHeader('Date', new Date(g.date).toISOString().slice(0, 10).replace(/-/g, '.'));
  c.setHeader('White', g.white); c.setHeader('Black', g.black); c.setHeader('Result', g.result);
  if (g.startFen !== new Chess().fen()) { c.setHeader('SetUp', '1'); c.setHeader('FEN', g.startFen); }
  return c.pgn();
}

// --- import -----------------------------------------------------------------
export function splitPgn(text) {
  const t = text.replace(/\r/g, '').trim();
  if (!t) return [];
  const parts = t.split(/\n\s*\n(?=\[Event )/);
  return parts.map(s => s.trim()).filter(Boolean);
}

export function parsePgnGame(pgn, meta = {}) {
  const c = new Chess();
  c.loadPgn(pgn);
  const h = c.getHeaders ? c.getHeaders() : c.header();
  const hist = c.history({ verbose: true });
  if (!hist.length) throw new Error('Aucun coup trouvé dans ce PGN.');
  let date = Date.now();
  const d = (h.UTCDate || h.Date || '').replace(/\./g, '-');
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) date = new Date(d + 'T' + (h.UTCTime || h.StartTime || '12:00:00')).getTime() || date;
  const g = gameFromChess(c, {
    white: h.White || 'Blancs', black: h.Black || 'Noirs', result: h.Result || '*', date,
    source: meta.source || 'pgn', event: h.Event || '', timeControl: h.TimeControl || '', termination: h.Termination || '',
  });
  const s = settings.get();
  const me = [s.lichessUser, s.chesscomUser, meta.user].filter(Boolean).map(x => x.toLowerCase());
  if (me.includes((h.White || '').toLowerCase())) g.you = 'w';
  else if (me.includes((h.Black || '').toLowerCase())) g.you = 'b';
  const site = h.Link || h.Site || '';
  g.extId = site && site !== '?' ? site : '';
  g.key = [g.white, g.black, g.result, g.moves.join(' ')].join('|');
  g.whiteElo = h.WhiteElo || ''; g.blackElo = h.BlackElo || '';
  return g;
}

export async function fetchLichessGames(user, max = 15) {
  const url = `https://lichess.org/api/games/user/${encodeURIComponent(user)}?max=${max}&moves=true&tags=true&clocks=false&evals=false&opening=false`;
  const res = await fetch(url, { headers: { Accept: 'application/x-chess-pgn' } });
  if (res.status === 404) throw new Error(`Compte Lichess « ${user} » introuvable.`);
  if (!res.ok) throw new Error(`Lichess a répondu ${res.status}.`);
  const text = await res.text();
  return splitPgn(text).map(p => { try { return parsePgnGame(p, { source: 'lichess', user }); } catch { return null; } }).filter(Boolean);
}

export async function fetchChesscomGames(user, max = 15) {
  const base = `https://api.chess.com/pub/player/${encodeURIComponent(user.toLowerCase())}/games/archives`;
  const res = await fetch(base);
  if (res.status === 404) throw new Error(`Compte Chess.com « ${user} » introuvable.`);
  if (!res.ok) throw new Error(`Chess.com a répondu ${res.status}.`);
  const { archives = [] } = await res.json();
  const out = [];
  for (const a of archives.slice().reverse()) {
    const r = await fetch(a);
    if (!r.ok) break;
    const { games = [] } = await r.json();
    for (const g of games.slice().reverse()) {
      if (g.rules && g.rules !== 'chess') continue;
      try { out.push(parsePgnGame(g.pgn, { source: 'chesscom', user })); } catch { /* ignore */ }
      if (out.length >= max) return out;
    }
    if (out.length >= max) break;
  }
  return out;
}

export function mergeImported(list) {
  const games = listGames();
  let added = 0;
  for (const g of list) {
    if (g.extId && games.some(x => x.extId === g.extId)) continue;
    if (!g.extId && g.key && games.some(x => x.key === g.key)) continue;
    games.push(g); added++;
  }
  games.sort((a, b) => b.date - a.date);
  store.set('games', games.slice(0, MAX_GAMES));
  return added;
}

// --- analyse ----------------------------------------------------------------
export const LABELS = {
  blunder: { sym: '??', name: 'Gaffe' },
  mistake: { sym: '?', name: 'Erreur' },
  inaccuracy: { sym: '?!', name: 'Imprécision' },
};
// Classification façon « bilan de partie »
export const CLASSES = {
  brilliant: { sym: '!!', name: 'Brillant', color: '#1fa39d' },
  great: { sym: '!', name: 'Très fort', color: '#4a86c5' },
  best: { sym: '★', name: 'Meilleur', color: '#5f9c3b' },
  excellent: { sym: '✓', name: 'Excellent', color: '#76a650' },
  good: { sym: '✓', name: 'Bon', color: '#93a876' },
  book: { sym: '≡', name: 'Théorie', color: '#a5835e' },
  inaccuracy: { sym: '?!', name: 'Imprécision', color: '#d1a114' },
  mistake: { sym: '?', name: 'Erreur', color: '#e07a26' },
  miss: { sym: '×', name: 'Occasion manquée', color: '#d5574b' },
  blunder: { sym: '??', name: 'Gaffe', color: '#c4352a' },
};
export const CLASS_ORDER = ['brilliant', 'great', 'best', 'excellent', 'good', 'book', 'inaccuracy', 'mistake', 'miss', 'blunder'];
export const ANALYSIS_VERSION = 2;

export function classify(dropPct) {
  if (dropPct >= 20) return 'blunder';
  if (dropPct >= 10) return 'mistake';
  if (dropPct >= 5) return 'inaccuracy';
  return null;
}
export function moveAccuracy(dropPct) {
  return Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * Math.max(0, dropPct)) - 3.1669));
}

// Ouverture : plus longue ligne du répertoire qui est un préfixe de la partie
export function detectOpening(sans, startFen) {
  if (startFen && startFen !== new Chess().fen()) return { name: null, plies: 0 };
  let best = { name: null, plies: 0 };
  for (const [name, line] of OPENINGS) {
    const l = line.split(' ');
    if (l.length > sans.length || l.length <= best.plies) continue;
    if (l.every((m, i) => m === sans[i])) best = { name, plies: l.length };
  }
  return best;
}

const cpOf = l => {
  if (!l) return 0;
  if (l.over === 'mate') return -1000;
  if (l.over === 'draw') return 0;
  if (l.mate != null) return l.mate > 0 ? 1000 : -1000;
  return Math.max(-1000, Math.min(1000, l.cp));
};
function nonPawnMaterial(fen) {
  const v = { n: 3, b: 3, r: 5, q: 9 };
  let t = 0, queens = 0;
  for (const ch of fen.split(' ')[0]) { const k = ch.toLowerCase(); if (v[k]) t += v[k]; if (k === 'q') queens++; }
  return { t, queens };
}
function phaseOf(i, fen, bookPlies) {
  const { t, queens } = nonPawnMaterial(fen);
  if (t <= 20 || (queens === 0 && t <= 30)) return 'endgame';
  if (i < Math.max(bookPlies, 16)) return 'opening';
  return 'middlegame';
}
function balance(fen, side) {
  const v = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  let s = 0;
  for (const ch of fen.split(' ')[0]) { const k = ch.toLowerCase(); if (v[k] == null) continue; const col = ch === k ? 'b' : 'w'; s += (col === side ? 1 : -1) * v[k]; }
  return s;
}
function isSacrifice(before, after, uci, mover) {
  const b0 = balance(before.fen, mover);
  const moved = new Chess(before.fen).get(uci.slice(0, 2));
  const target = new Chess(before.fen).get(uci.slice(2, 4));
  const trade = target && PIECE_VAL[target.type] >= PIECE_VAL[moved.type] - 1;
  // 1) le matériel reste en déficit après la meilleure réponse (et notre éventuelle reprise)
  const pv = after.line?.pv || [];
  if (pv[0]) {
    const c = new Chess(after.fen);
    const r = uciToMove(c, pv[0]);
    if (r?.captured) {
      if (pv[1]) { const c2 = new Chess(c.fen()); const r2 = uciToMove(c2, pv[1]); if (r2?.captured) c.load(c2.fen()); }
      if (balance(c.fen(), mover) <= b0 - 2) return true;
    }
  }
  if (trade) return false;
  // 2) pièce offerte que l'adversaire ne prend pas : attaquée par moins fort qu'elle, ou sans défense
  const pos = new Chess(after.fen);
  const piece = pos.get(uci.slice(2, 4));
  if (!piece || PIECE_VAL[piece.type] < 3) return false;
  const opp = mover === 'w' ? 'b' : 'w';
  const attackers = pos.attackers(uci.slice(2, 4), opp);
  if (!attackers.length) return false;
  const defenders = pos.attackers(uci.slice(2, 4), mover);
  const cheaper = attackers.some(sq => PIECE_VAL[pos.get(sq).type] < PIECE_VAL[piece.type]);
  return cheaper || defenders.length === 0;
}

/**
 * Analyse complète (bilan). onProgress(i, total) est appelé après chaque position.
 * positions[i] = { fen, line, alt (2e meilleure ligne), win (pov Blancs), turn }
 * moves[i] = { san, uci, cls, label, drop, best, bestSan, acc, loss, phase, category }
 */
export async function analyseGame(g, { depth, onProgress, isCancelled } = {}) {
  depth = depth || settings.get().analysisDepth || 13;
  const c = new Chess(g.startFen);
  const fens = [c.fen()];
  const sans = [], verbose = [];
  for (const u of g.moves) { const m = uciToMove(c, u); if (!m) break; sans.push(m.san); verbose.push(m); fens.push(c.fen()); }
  const trimPv = l => l && { ...l, pv: (l.pv || []).slice(0, 10) };
  const positions = [];
  for (let i = 0; i < fens.length; i++) {
    if (isCancelled?.()) return null;
    const pos = new Chess(fens[i]);
    let line = null, alt = null;
    if (pos.isCheckmate()) line = { mate: 0, cp: null, pv: [], move: null, over: 'mate' };
    else if (pos.isGameOver()) line = { cp: 0, mate: null, pv: [], move: null, over: 'draw' };
    else {
      const r = await engine.analyse(fens[i], { depth, multipv: 2 });
      if (!r) return null;
      line = trimPv(r.lines[0]) || { cp: 0, mate: null, pv: [r.best], move: r.best };
      alt = trimPv(r.lines[1]) || null;
    }
    const turn = fens[i].split(' ')[1];
    const winSide = line.over === 'mate' ? 0 : lineWin(line);
    positions.push({ fen: fens[i], line, alt, win: turn === 'w' ? winSide : 100 - winSide, turn });
    onProgress?.(i + 1, fens.length, positions);
  }
  const opening = detectOpening(sans, g.startFen);
  const moves = [];
  for (let i = 0; i < sans.length; i++) {
    const before = positions[i], after = positions[i + 1];
    const mover = before.turn;
    const wb = mover === 'w' ? before.win : 100 - before.win;
    const wa = mover === 'w' ? after.win : 100 - after.win;
    const drop = Math.max(0, wb - wa);
    const best = before.line?.move || null;
    const isBest = best && best === g.moves[i];
    let cls;
    if (i < opening.plies && drop < 6) cls = 'book';
    else if (isBest) cls = 'best';
    else if (drop < 2) cls = 'excellent';
    else if (drop < 5) cls = 'good';
    else cls = classify(drop);
    // erreur sans conséquence quand la partie est déjà jouée
    if (cls === 'blunder' && (wa > 85 || wb < 15)) cls = 'mistake';
    if (cls === 'mistake' && (wa > 92 || wb < 8)) cls = 'inaccuracy';
    // occasion manquée : l'adversaire venait de se tromper et on ne le punit pas
    if ((cls === 'mistake' || cls === 'blunder') && i > 0) {
      const w2 = mover === 'w' ? positions[i - 1].win : 100 - positions[i - 1].win;
      const missedMate = before.line?.mate != null && before.line.mate > 0 && !(after.line?.mate != null && after.line.mate > 0);
      const allowsMate = after.line?.mate != null && after.line.mate > 0;
      if (!allowsMate && ((wb - w2 >= 10 && wa <= w2 + 6) || missedMate)) cls = 'miss';
    }
    // très fort : seul bon coup dans une position non décidée
    if ((cls === 'best' || cls === 'excellent') && before.alt) {
      const wAlt = lineWin(before.alt);
      const wTop = lineWin(before.line);
      const prev = verbose[i - 1];
      const recapture = prev?.captured && verbose[i].captured && prev.to === verbose[i].to;
      const legal = new Chess(before.fen).moves().length;
      if (wTop - wAlt >= 15 && wb > 8 && wb < 92 && !recapture && legal > 1) cls = 'great';
    }
    // brillant : bon sacrifice
    if (['best', 'excellent', 'great'].includes(cls) && wb < 95 && wa >= 40 && isSacrifice(before, after, g.moves[i], mover)) cls = 'brilliant';
    const label = ['inaccuracy', 'mistake', 'blunder'].includes(cls) ? cls : cls === 'miss' ? (drop >= 20 ? 'blunder' : 'mistake') : null;
    const loss = Math.max(0, Math.min(1000, cpOf(before.line) + cpOf(after.line)));
    const entry = {
      san: sans[i], uci: g.moves[i], cls, label, drop: Math.round(drop * 10) / 10, best,
      bestSan: best ? pvToSan(before.fen, [best])[0] : null, acc: moveAccuracy(drop), loss: cls === 'book' ? 0 : loss,
      phase: phaseOf(i, before.fen, opening.plies),
    };
    if (label === 'blunder' || label === 'mistake') entry.category = categorize(before, after, g.moves[i]);
    moves.push(entry);
  }
  const side = s => moves.filter((_, i) => positions[i].turn === s);
  const acc = { w: avg(side('w').map(m => m.acc)), b: avg(side('b').map(m => m.acc)) };
  const counts = { w: count(moves, positions, 'w'), b: count(moves, positions, 'b') };
  const classes = { w: countCls(side('w')), b: countCls(side('b')) };
  const acpl = {}, estElo = {}, phases = {};
  for (const s of ['w', 'b']) {
    const ms = side(s).filter(m => m.cls !== 'book');
    acpl[s] = ms.length ? Math.round(ms.reduce((t, m) => t + m.loss, 0) / ms.length) : null;
    estElo[s] = ms.length >= 8 ? eloFromAcpl(acpl[s]) : null;
    phases[s] = {};
    for (const ph of ['opening', 'middlegame', 'endgame']) {
      const p = side(s).filter(m => m.phase === ph);
      phases[s][ph] = p.length >= 2 ? avg(p.map(m => m.acc)) : null;
    }
  }
  return { v: ANALYSIS_VERSION, depth, positions, moves, acc, counts, classes, acpl, estElo, phases, opening, at: Date.now() };
}

function avg(a) { return a.length ? Math.round(a.reduce((s, x) => s + x, 0) / a.length) : null; }
function count(moves, positions, side) {
  const o = { blunder: 0, mistake: 0, inaccuracy: 0 };
  moves.forEach((m, i) => { if (positions[i].turn === side && m.label) o[m.label]++; });
  return o;
}
function countCls(list) {
  const o = Object.fromEntries(CLASS_ORDER.map(k => [k, 0]));
  for (const m of list) o[m.cls]++;
  return o;
}

// Catégorise une erreur pour le carnet et les statistiques
export const CATEGORIES = {
  hanging: 'Pièce laissée en prise',
  missedTactic: 'Tactique manquée',
  missedMate: 'Mat manqué',
  allowedMate: 'Mat permis',
  allowedTactic: 'Tactique adverse permise',
  other: 'Mauvais plan / position',
};
export function categorize(before, after, playedUci) {
  const bl = before.line, al = after.line;
  if (bl?.mate != null && bl.mate > 0) return 'missedMate';
  if (al?.mate != null && al.mate > 0) return 'allowedMate';
  // Après le coup joué : la meilleure réponse adverse gagne-t-elle simplement du matériel ?
  const reply = al?.pv?.[0];
  if (reply) {
    const pos = new Chess(after.fen);
    const m = uciToMove(pos, reply);
    if (m?.captured) {
      const captured = PIECE_VAL[m.captured];
      // la pièce prise n'est pas récupérée ou valait plus que la preneuse
      const defenders = new Chess(after.fen).attackers(m.to, after.fen.split(' ')[1] === 'w' ? 'b' : 'w');
      if (captured >= 3 && (defenders.length === 0 || captured > PIECE_VAL[m.piece])) return 'hanging';
      if (captured === 1 && defenders.length === 0 && m.to === playedUci.slice(2, 4)) return 'hanging';
    }
    if (m) return 'allowedTactic';
  }
  const best = bl?.pv?.[0];
  if (best) {
    const pos = new Chess(before.fen);
    const m = uciToMove(pos, best);
    if (m && (m.captured || pos.inCheck())) return 'missedTactic';
  }
  return 'other';
}

// --- carnet d'erreurs ----------------------------------------------------------
const BOX_DAYS = [0, 1, 3, 7, 16, 35];
export function listMistakes() { return store.get('mistakes', []); }
export function saveMistakes(list) { store.set('mistakes', list); }
export function dueMistakes() { const now = Date.now(); return listMistakes().filter(m => (m.due || 0) <= now); }

export function addMistakesFromAnalysis(g, an) {
  if (!g.you) return 0;
  const list = listMistakes();
  let added = 0;
  an.moves.forEach((mv, i) => {
    const pos = an.positions[i];
    if (pos.turn !== g.you) return;
    if (mv.label !== 'blunder' && mv.label !== 'mistake') return;
    if (!mv.best) return;
    const key = g.id + ':' + i;
    if (list.some(x => x.key === key)) return;
    list.push({
      key, id: uid(), gameId: g.id, ply: i, fen: pos.fen, played: mv.uci, playedSan: mv.san,
      best: mv.best, bestSan: mv.bestSan, pv: pos.line.pv?.slice(0, 6) || [mv.best],
      label: mv.label, category: mv.category || 'other', drop: mv.drop,
      opponent: g.you === 'w' ? g.black : g.white, date: g.date, box: 0, due: Date.now(), reviews: 0, solved: 0,
    });
    added++;
  });
  saveMistakes(list);
  return added;
}

export function reviewMistake(id, success) {
  const list = listMistakes();
  const m = list.find(x => x.id === id);
  if (!m) return;
  m.reviews++;
  if (success) { m.solved++; m.box = Math.min(BOX_DAYS.length - 1, (m.box || 0) + 1); }
  else m.box = 0;
  m.due = Date.now() + BOX_DAYS[m.box] * 86400000 + (success ? 0 : 10 * 60000);
  saveMistakes(list);
}

export function weaknessStats() {
  const list = listMistakes();
  const out = {};
  for (const m of list) out[m.category] = (out[m.category] || 0) + 1;
  return Object.entries(out).sort((a, b) => b[1] - a[1]);
}

export function describeResult(g) {
  if (!g.you || g.result === '*') return { cls: '', txt: g.result === '*' ? '—' : g.result };
  const win = (g.result === '1-0' && g.you === 'w') || (g.result === '0-1' && g.you === 'b');
  const draw = g.result === '1/2-1/2';
  return { cls: win ? 'win' : draw ? '' : 'loss', txt: win ? 'Victoire' : draw ? 'Nulle' : 'Défaite' };
}

export { sanFr, lineValue };
