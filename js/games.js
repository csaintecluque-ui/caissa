// Parties enregistrées, import PGN / Lichess / Chess.com, analyse Stockfish
// complète d'une partie et carnet d'erreurs.
import { Chess, uciToMove, moveToUci, pvToSan, sanFr, PIECE_VAL } from './util.js';
import { store, settings, uid } from './store.js';
import { engine, lineWin, lineValue } from './engine.js';

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
  g.extId = h.Site || h.Link || '';
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

export function classify(dropPct) {
  if (dropPct >= 15) return 'blunder';
  if (dropPct >= 10) return 'mistake';
  if (dropPct >= 5) return 'inaccuracy';
  return null;
}
export function moveAccuracy(dropPct) {
  return Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * Math.max(0, dropPct)) - 3.1669));
}

/**
 * Analyse complète. onProgress(i, total, partial) est appelé après chaque position.
 * Résultat : positions[i] = { fen, line (meilleure ligne, pov camp au trait), win (pov Blancs) }
 *            moves[i] = { san, uci, label, drop, best, bestSan, category }
 */
export async function analyseGame(g, { depth, onProgress, isCancelled } = {}) {
  depth = depth || settings.get().analysisDepth || 13;
  const c = new Chess(g.startFen);
  const fens = [c.fen()];
  const sans = [];
  for (const u of g.moves) { const m = uciToMove(c, u); if (!m) break; sans.push(m.san); fens.push(c.fen()); }
  const positions = [];
  for (let i = 0; i < fens.length; i++) {
    if (isCancelled?.()) return null;
    const pos = new Chess(fens[i]);
    let line = null;
    if (pos.isCheckmate()) line = { mate: 0, cp: null, pv: [], move: null, over: 'mate' };
    else if (pos.isGameOver()) line = { cp: 0, mate: null, pv: [], move: null, over: 'draw' };
    else {
      const r = await engine.analyse(fens[i], { depth, multipv: 1 });
      if (!r) return null;
      line = r.lines[0] || { cp: 0, mate: null, pv: [r.best], move: r.best };
    }
    const turn = fens[i].split(' ')[1];
    let winSide;
    if (line.over === 'mate') winSide = 0; else winSide = lineWin(line);
    const winWhite = turn === 'w' ? winSide : 100 - winSide;
    positions.push({ fen: fens[i], line, win: winWhite, turn });
    onProgress?.(i + 1, fens.length, positions);
  }
  const moves = [];
  for (let i = 0; i < sans.length; i++) {
    const before = positions[i], after = positions[i + 1];
    const mover = before.turn;
    const winBefore = mover === 'w' ? before.win : 100 - before.win;
    const winAfter = mover === 'w' ? after.win : 100 - after.win;
    const drop = Math.max(0, winBefore - winAfter);
    let label = classify(drop);
    const best = before.line?.move || null;
    if (best && best === g.moves[i]) label = null;
    // une « gaffe » qui ne change pas l'issue (déjà gagné/perdu) n'est qu'une erreur
    if (label === 'blunder' && (winAfter > 85 || winBefore < 15)) label = 'mistake';
    const entry = { san: sans[i], uci: g.moves[i], label, drop: Math.round(drop * 10) / 10, best, bestSan: best ? pvToSan(before.fen, [best])[0] : null, acc: moveAccuracy(drop) };
    if (label === 'blunder' || label === 'mistake') entry.category = categorize(before, after, g.moves[i]);
    moves.push(entry);
  }
  const acc = { w: avg(moves.filter((_, i) => positions[i].turn === 'w').map(m => m.acc)), b: avg(moves.filter((_, i) => positions[i].turn === 'b').map(m => m.acc)) };
  const counts = { w: count(moves, positions, 'w'), b: count(moves, positions, 'b') };
  return { depth, positions, moves, acc, counts, at: Date.now() };
}

function avg(a) { return a.length ? Math.round(a.reduce((s, x) => s + x, 0) / a.length) : null; }
function count(moves, positions, side) {
  const o = { blunder: 0, mistake: 0, inaccuracy: 0 };
  moves.forEach((m, i) => { if (positions[i].turn === side && m.label) o[m.label]++; });
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
