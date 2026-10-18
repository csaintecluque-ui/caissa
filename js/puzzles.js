// Problèmes : base hors ligne générée avec Stockfish + puzzles Lichess (en ligne),
// classement adaptatif type Elo.
import { Board } from './board.js';
import { Chess, $, esc, uciToMove, moveToUci, destsFor, checkSquare, sound, moveSound, toast, sanFr, pvToSan, numberedSan } from './util.js';
import { store } from './store.js';
import { askClaude, explainPuzzlePrompt, hasKey } from './coach.js';

export const THEMES = {
  mix: 'Mélange', hangingPiece: 'Pièce en prise', fork: 'Fourchette', pin: 'Clouage', skewer: 'Enfilade',
  discoveredAttack: 'Attaque à la découverte', mateIn1: 'Mat en 1', mateIn2: 'Mat en 2', mateIn3: 'Mat en 3',
  backRankMate: 'Mat du couloir', trappedPiece: 'Pièce piégée', capturingDefender: 'Éliminer le défenseur',
  deflection: 'Déviation', attraction: 'Attraction', sacrifice: 'Sacrifice', doubleCheck: 'Échec double',
  endgame: 'Finale', opening: 'Ouverture', middlegame: 'Milieu de partie', mate: 'Mat', advantage: 'Avantage',
  crushing: 'Écrasant', short: 'Court', long: 'Long', oneMove: 'Un coup', veryLong: 'Très long', promotion: 'Promotion',
  exposedKing: 'Roi exposé', kingsideAttack: "Attaque à l'aile roi", queensideAttack: "Attaque à l'aile dame",
  quietMove: 'Coup tranquille', defensiveMove: 'Coup défensif', intermezzo: 'Coup intermédiaire', xRayAttack: 'Rayons X',
  interference: 'Interférence', clearance: 'Dégagement', smotheredMate: "Mat à l'étouffée", rookEndgame: 'Finale de tours',
  pawnEndgame: 'Finale de pions', bishopEndgame: 'Finale de fous', knightEndgame: 'Finale de cavaliers', queenEndgame: 'Finale de dames',
  equality: 'Égalité', zugzwang: 'Zugzwang', advancedPawn: 'Pion avancé', attackingF2F7: 'Attaque sur f2/f7', enPassant: 'En passant',
  castling: 'Roque', underPromotion: 'Sous-promotion', master: 'Partie de maître', masterVsMaster: 'Maître contre maître',
  superGM: 'Super GMI', mateIn4: 'Mat en 4', mateIn5: 'Mat en 5', hookMate: 'Mat de l’hameçon', anastasiaMate: "Mat d'Anastasia",
  arabianMate: 'Mat arabe', bodenMate: 'Mat de Boden', doubleBishopMate: 'Mat des deux fous', dovetailMate: 'Mat de la colombe',
};
const FILTERS = ['mix', 'hangingPiece', 'fork', 'pin', 'skewer', 'discoveredAttack', 'mateIn1', 'mateIn2', 'backRankMate', 'trappedPiece', 'endgame'];

// --- profil ---------------------------------------------------------------------
export function puzzleProfile() {
  return { rating: 1000, games: 0, solved: 0, streak: 0, bestStreak: 0, history: [], ...store.get('puzzleProfile', {}) };
}
function saveProfile(p) { store.set('puzzleProfile', p); }
function updateRating(puzzleRating, score) {
  const p = puzzleProfile();
  const K = p.games < 30 ? 40 : 24;
  const exp = 1 / (1 + Math.pow(10, (puzzleRating - p.rating) / 400));
  const delta = Math.round(K * (score - exp));
  p.rating = Math.max(400, p.rating + delta);
  p.games++;
  if (score >= 1) { p.solved++; p.streak++; p.bestStreak = Math.max(p.bestStreak, p.streak); } else p.streak = 0;
  p.history.push({ t: Date.now(), r: p.rating, ok: score >= 1 });
  p.history = p.history.slice(-300);
  saveProfile(p);
  return { delta, rating: p.rating };
}

// --- réservoir de problèmes -------------------------------------------------------
let localPool = null;
async function loadLocal() {
  if (localPool) return localPool;
  try { localPool = await (await fetch('data/puzzles.json')).json(); } catch { localPool = []; }
  return localPool;
}
function lichessPool() { return store.get('lichessPool', []); }
function seenSet() { return new Set(store.get('puzzleSeen', [])); }
function markSeen(id) {
  const a = store.get('puzzleSeen', []);
  a.push(id);
  store.set('puzzleSeen', a.slice(-4000));
}

function lichessDifficulty(rating) {
  if (rating < 1100) return 'easiest';
  if (rating < 1400) return 'easier';
  if (rating < 1700) return 'normal';
  if (rating < 2000) return 'harder';
  return 'hardest';
}

export function convertLichess(item) {
  const c = new Chess();
  const sans = item.game.pgn.split(/\s+/).filter(Boolean);
  let fenBefore = c.fen(), last = null;
  for (const s of sans) { fenBefore = c.fen(); last = c.move(s); }
  if (!last) return null;
  return { id: 'li-' + item.puzzle.id, fen: fenBefore, moves: [moveToUci(last), ...item.puzzle.solution], rating: item.puzzle.rating, themes: item.puzzle.themes, src: 'lichess' };
}

async function fetchLichess(theme, rating) {
  const url = `https://lichess.org/api/puzzle/batch/${theme}?nb=30&difficulty=${lichessDifficulty(rating)}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error('Lichess ' + res.status);
  const j = await res.json();
  const items = (j.puzzles || []).map(p => { try { return convertLichess(p); } catch { return null; } }).filter(Boolean);
  items.forEach(p => { if (theme !== 'mix' && !p.themes.includes(theme)) p.themes.push(theme); });
  const pool = lichessPool();
  const ids = new Set(pool.map(p => p.id));
  for (const p of items) if (!ids.has(p.id)) pool.push(p);
  store.set('lichessPool', pool.slice(-900));
  return items.length;
}

async function pickPuzzle(theme) {
  const prof = puzzleProfile();
  const seen = seenSet();
  const local = await loadLocal();
  const match = p => theme === 'mix' || p.themes.includes(theme);
  let pool = [...local, ...lichessPool()].filter(match);
  let fresh = pool.filter(p => !seen.has(p.id));
  const near = fresh.filter(p => Math.abs(p.rating - prof.rating) <= 200);
  if (near.length < 4 && navigator.onLine) {
    try { await fetchLichess(theme, prof.rating); } catch (e) { console.warn(e); }
    pool = [...local, ...lichessPool()].filter(match);
    fresh = pool.filter(p => !seen.has(p.id));
  }
  if (!fresh.length) fresh = pool; // tout a été vu : on recycle
  if (!fresh.length) return null;
  for (const w of [150, 250, 400, 700, 5000]) {
    const c = fresh.filter(p => Math.abs(p.rating - prof.rating) <= w);
    if (c.length) return c[Math.floor(Math.random() * c.length)];
  }
  return fresh[0];
}

// --- vue ------------------------------------------------------------------------
let state = null;

export function mount(root, params = {}) {
  const theme = params.theme || store.get('puzzleTheme', 'mix');
  root.innerHTML = `
  <div class="split">
    <div class="board-col">
      <div class="board-area"><div class="board-wrap"><div id="pz-board"></div></div></div>
    </div>
    <div class="side stack">
      <div class="card">
        <div class="row between"><span class="muted small" id="pz-meta">Chargement…</span><span class="badge" id="pz-rating"></span></div>
        <div class="status" id="pz-status" style="margin-top:8px">Préparation du problème…</div>
        <p class="muted small" id="pz-sub" style="margin-top:6px"></p>
        <div class="row" id="pz-actions" style="margin-top:10px"></div>
        <div id="pz-coach" style="margin-top:10px"></div>
      </div>
      <div class="card">
        <div class="row between"><h3>Thème</h3><span class="muted small" id="pz-streak"></span></div>
        <div class="chips" id="pz-themes">${FILTERS.map(t => `<button class="chip ${t === theme ? 'on' : ''}" data-t="${t}">${THEMES[t]}</button>`).join('')}</div>
        <p class="muted small" style="margin:8px 0 0">Les thèmes marqués par Lichess (clouage, enfilade…) se chargent quand tu es connecté. Une réserve hors ligne est intégrée à l'appli.</p>
      </div>
    </div>
  </div>`;
  const board = new Board($('#pz-board', root), { coords: true, onMove: (f, t, p) => onUserMove(f, t, p) });
  state = { root, board, theme, puzzle: null, step: 0, chess: null, failed: false, hinted: 0, done: false, wrongFirst: null };
  $('#pz-themes', root).addEventListener('click', e => {
    const b = e.target.closest('.chip'); if (!b) return;
    root.querySelectorAll('#pz-themes .chip').forEach(c => c.classList.toggle('on', c === b));
    state.theme = b.dataset.t; store.set('puzzleTheme', state.theme);
    next();
  });
  if (params.id) startById(params.id); else next();
}

export function unmount() { state = null; }

async function startById(id) {
  const all = [...(await loadLocal()), ...lichessPool()];
  const p = all.find(x => x.id === id);
  if (p) start(p); else next();
}

async function next() {
  if (!state) return;
  $('#pz-status', state.root).textContent = 'Recherche d\'un problème…';
  const p = await pickPuzzle(state.theme);
  if (!state) return;
  if (!p) {
    $('#pz-status', state.root).textContent = 'Aucun problème disponible pour ce thème hors ligne.';
    $('#pz-sub', state.root).textContent = 'Connecte-toi à Internet pour en charger depuis Lichess, ou choisis « Mélange ».';
    return;
  }
  start(p);
}

function start(p) {
  const s = state;
  Object.assign(s, { puzzle: p, step: 0, failed: false, hinted: 0, done: false, wrongFirst: null });
  s.chess = new Chess(p.fen);
  s.solver = s.chess.turn() === 'w' ? 'b' : 'w';
  s.board.setOrientation(s.solver);
  s.board.setArrows([]); s.board.setMarks({});
  s.board.setMovable(null);
  s.board.setPosition(p.fen, { animate: false });
  const prof = puzzleProfile();
  $('#pz-rating', s.root).textContent = `Ton niveau : ${prof.rating}`;
  $('#pz-meta', s.root).textContent = `Problème ${p.src === 'lichess' ? 'Lichess' : 'Caïssa'} · difficulté ${p.rating}`;
  $('#pz-streak', s.root).textContent = prof.streak > 1 ? `Série : ${prof.streak} 🔥` : '';
  $('#pz-coach', s.root).innerHTML = '';
  setStatus('Observe la position…', '');
  $('#pz-sub', s.root).textContent = '';
  renderActions();
  setTimeout(() => {
    if (state !== s || s.puzzle !== p) return;
    const m = uciToMove(s.chess, p.moves[0]);
    s.step = 1;
    s.board.setPosition(s.chess.fen(), { lastMove: [m.from, m.to], check: checkSquare(s.chess) });
    moveSound(m, s.chess);
    s.board.setDests(destsFor(s.chess));
    s.board.setMovable(s.solver);
    setStatus(`À toi : trouve le meilleur coup pour les ${s.solver === 'w' ? 'Blancs' : 'Noirs'}.`, '');
    $('#pz-sub', s.root).textContent = 'Routine : quels échecs ? quelles prises ? quelles menaces ?';
  }, 650);
}

function setStatus(t, cls) { const el = $('#pz-status', state.root); el.textContent = t; el.className = 'status ' + (cls || ''); }

function renderActions() {
  const s = state;
  const a = $('#pz-actions', s.root);
  if (!s.done) {
    a.innerHTML = `<button class="btn" id="pz-hint">Indice</button><button class="btn ghost" id="pz-sol">Solution</button><button class="btn ghost" id="pz-skip">Passer</button>`;
    $('#pz-hint', a).onclick = hint;
    $('#pz-sol', a).onclick = showSolution;
    $('#pz-skip', a).onclick = () => { if (!s.failed && s.step > 0) record(0); next(); };
  } else {
    a.innerHTML = `<button class="btn primary" id="pz-next">Problème suivant</button><button class="btn" id="pz-explain">Expliquer</button><button class="btn ghost" id="pz-analyse">Analyser</button><button class="btn ghost" id="pz-retry">Rejouer</button>`;
    $('#pz-next', a).onclick = next;
    $('#pz-retry', a).onclick = () => start(s.puzzle);
    $('#pz-analyse', a).onclick = () => { location.hash = `#/analyse?fen=${encodeURIComponent(afterFirst(s.puzzle))}`; };
    $('#pz-explain', a).onclick = explain;
  }
}
function afterFirst(p) { const c = new Chess(p.fen); uciToMove(c, p.moves[0]); return c.fen(); }

let recorded = new WeakSet();
function record(score) {
  const p = state.puzzle;
  if (recorded.has(p)) return null;
  recorded.add(p);
  markSeen(p.id);
  return updateRating(p.rating, score);
}

async function onUserMove(from, to, promotion) {
  const s = state;
  if (!s || s.done) return false;
  const expected = s.puzzle.moves[s.step];
  const test = new Chess(s.chess.fen());
  let m;
  try { m = test.move({ from, to, promotion }); } catch { return false; }
  const uci = moveToUci(m);
  const ok = uci === expected || test.isCheckmate();
  if (!ok) {
    sound('bad');
    s.board.flash(to, 'bad');
    if (!s.failed) { s.failed = true; s.wrongFirst = sanFr(m.san); const r = record(0); if (r) toast(`Raté — niveau ${r.rating} (${r.delta})`); }
    setStatus('Pas tout à fait… Cherche encore.', 'bad');
    $('#pz-sub', s.root).textContent = `${sanFr(m.san)} ne marche pas. Regarde ce que l'adversaire peut répondre.`;
    setTimeout(() => { if (state === s) s.board.setPosition(s.chess.fen(), { lastMove: lastOf(s), check: checkSquare(s.chess) }); }, 450);
    return false;
  }
  s.chess.move({ from, to, promotion });
  s.step++;
  s.board.setPosition(s.chess.fen(), { lastMove: [from, to], check: checkSquare(s.chess) });
  moveSound(m, s.chess);
  s.board.setArrows([]); s.board.setMarks({});
  if (s.step >= s.puzzle.moves.length || s.chess.isCheckmate()) { finish(true); return true; }
  s.board.flash(to, 'good');
  setStatus('Bien vu ! Continue…', 'good');
  s.board.setMovable(null);
  setTimeout(() => {
    if (state !== s) return;
    const r = uciToMove(s.chess, s.puzzle.moves[s.step]);
    s.step++;
    s.board.setPosition(s.chess.fen(), { lastMove: [r.from, r.to], check: checkSquare(s.chess) });
    moveSound(r, s.chess);
    s.board.setDests(destsFor(s.chess));
    s.board.setMovable(s.solver);
    setStatus('À toi de jouer.', '');
  }, 480);
  return true;
}
function lastOf(s) { const h = s.chess.history({ verbose: true }); const l = h[h.length - 1]; return l ? [l.from, l.to] : null; }

function finish(success) {
  const s = state;
  s.done = true;
  s.board.setMovable(null);
  if (success && !s.failed) {
    sound('good');
    const r = record(s.hinted ? 0.5 : 1);
    setStatus(s.hinted ? 'Résolu avec un indice.' : 'Bravo, résolu !', 'good');
    if (r) $('#pz-sub', s.root).textContent = `Niveau problèmes : ${r.rating} (${r.delta >= 0 ? '+' : ''}${r.delta})`;
  } else if (success) {
    setStatus('Résolu après une erreur.', '');
    $('#pz-sub', s.root).textContent = 'Le problème compte comme raté, mais refais-le plus tard pour ancrer le motif.';
  }
  const prof = puzzleProfile();
  $('#pz-rating', s.root).textContent = `Ton niveau : ${prof.rating}`;
  $('#pz-streak', s.root).textContent = prof.streak > 1 ? `Série : ${prof.streak} 🔥` : '';
  $('#pz-meta', s.root).textContent += ' · ' + s.puzzle.themes.filter(t => THEMES[t]).slice(0, 4).map(t => THEMES[t]).join(', ');
  renderActions();
}

function hint() {
  const s = state;
  if (s.done || s.step === 0) return;
  const exp = s.puzzle.moves[s.step];
  s.hinted++;
  if (s.hinted === 1) {
    s.board.setMarks({ [exp.slice(0, 2)]: 'hint' });
    s.board.flash(exp.slice(0, 2), 'good');
    $('#pz-sub', s.root).textContent = 'La pièce à jouer est en surbrillance.';
  } else {
    s.board.setArrows([{ from: exp.slice(0, 2), to: exp.slice(2, 4), kind: 'hint' }]);
    $('#pz-sub', s.root).textContent = 'Le coup est indiqué par la flèche bleue.';
  }
}

async function showSolution() {
  const s = state;
  if (s.done) return;
  if (!s.failed) { s.failed = true; record(0); }
  s.board.setMovable(null);
  while (state === s && s.step < s.puzzle.moves.length) {
    const m = uciToMove(s.chess, s.puzzle.moves[s.step]);
    s.step++;
    s.board.setPosition(s.chess.fen(), { lastMove: [m.from, m.to], check: checkSquare(s.chess) });
    moveSound(m, s.chess);
    await new Promise(r => setTimeout(r, 700));
  }
  if (state !== s) return;
  s.done = true;
  const start = afterFirst(s.puzzle);
  const line = numberedSan(start, pvToSan(start, s.puzzle.moves.slice(1), 12).map(sanFr));
  setStatus('Solution', '');
  $('#pz-sub', s.root).textContent = line;
  renderActions();
}

async function explain() {
  const s = state;
  const box = $('#pz-coach', s.root);
  if (!hasKey()) { box.innerHTML = `<div class="coach">Pour des explications rédigées, ajoute ta clé API Claude dans les réglages (⚙︎ en haut à droite).</div>`; return; }
  box.innerHTML = '<div class="coach loading">Caïssa réfléchit…</div>';
  const start = afterFirst(s.puzzle);
  try {
    const txt = await askClaude(explainPuzzlePrompt({
      fen: start, turn: start.split(' ')[1],
      solution: numberedSan(start, pvToSan(start, s.puzzle.moves.slice(1), 12).map(sanFr)),
      themes: s.puzzle.themes.filter(t => THEMES[t]).map(t => THEMES[t]).join(', '),
      wrong: s.wrongFirst,
    }));
    box.innerHTML = `<div class="coach">${esc(txt)}</div>`;
  } catch (e) { box.innerHTML = `<div class="coach">${esc(e.message)}</div>`; }
}
