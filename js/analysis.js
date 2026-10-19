// Analyse : bibliothèque de parties, import, analyse complète Stockfish,
// courbe d'évaluation, annotations, explications et exploration libre.
import { Board } from './board.js';
import { Chess, $, $$, esc, uciToMove, moveToUci, destsFor, checkSquare, moveSound, toast, sanFr, pvToSan, numberedSan, fmtDate } from './util.js';
import { store, settings } from './store.js';
import { engine, lineWin, formatEval } from './engine.js';
import { listGames, getGame, saveGame, deleteGame, analyseGame, addMistakesFromAnalysis, LABELS, CATEGORIES, CLASSES, CLASS_ORDER, ANALYSIS_VERSION, describeResult,
  fetchLichessGames, fetchChesscomGames, mergeImported, splitPgn, parsePgnGame, pgnOf } from './games.js';
import { askClaude, explainMovePrompt, explainPositionPrompt, hasKey } from './coach.js';

let A = null;

export function mount(root, params = {}) {
  if (params.game) { const g = getGame(params.game); if (g) return openGame(root, g, params.auto === '1'); }
  if (params.fen) return openFen(root, decodeURIComponent(params.fen));
  renderLibrary(root);
}
export function unmount() {
  if (A) { A.cancelled = true; engine.cancelAll(); if (A.keyHandler) document.removeEventListener('keydown', A.keyHandler); }
  A = null;
}

// --- bibliothèque -----------------------------------------------------------------
function renderLibrary(root) {
  const s = settings.get();
  const games = listGames();
  root.innerHTML = `
  <div class="split">
    <div class="stack">
      <div><h2>Analyse</h2><p class="muted">Tes parties contre Caïssa sont enregistrées automatiquement. Importe aussi tes vraies parties pour travailler sur tes défaites face aux humains.</p></div>
      <div class="card">
        <div class="row between"><h3>Mes parties</h3><span class="muted small">${games.length} partie${games.length > 1 ? 's' : ''}</span></div>
        <div class="list" id="gl">${games.length ? games.map(gameRow).join('') : '<div class="empty">Aucune partie pour l\'instant.<br>Joue contre Caïssa ou importe tes parties.</div>'}</div>
      </div>
    </div>
    <div class="side stack">
      <div class="card stack">
        <h3>Importer</h3>
        <label class="field">Pseudo Lichess<input id="li-user" value="${esc(s.lichessUser)}" autocomplete="off" autocapitalize="off" placeholder="ton pseudo"></label>
        <button class="btn block" id="li-go">Importer mes 15 dernières parties Lichess</button>
        <label class="field">Pseudo Chess.com<input id="cc-user" value="${esc(s.chesscomUser)}" autocomplete="off" autocapitalize="off" placeholder="ton pseudo"></label>
        <button class="btn block" id="cc-go">Importer mes 15 dernières parties Chess.com</button>
        <details><summary class="muted" style="cursor:pointer">Coller un PGN</summary>
          <textarea id="pgn" placeholder="[Event &quot;…&quot;]&#10;1. e4 e5 2. Cf3 …" style="margin-top:8px"></textarea>
          <button class="btn block" id="pgn-go" style="margin-top:8px">Ajouter</button></details>
      </div>
      <div class="card stack">
        <h3>Analyser une position</h3>
        <label class="field">FEN<input id="fen-in" placeholder="rnbqkbnr/pppppppp/8/8/…" autocomplete="off"></label>
        <div class="grid2"><button class="btn" id="fen-go">Ouvrir</button><button class="btn ghost" id="fen-start">Position de départ</button></div>
      </div>
    </div>
  </div>`;
  $('#gl', root).addEventListener('click', e => {
    const del = e.target.closest('[data-del]');
    if (del) { e.stopPropagation(); deleteGame(del.dataset.del); renderLibrary(root); return; }
    const it = e.target.closest('.list-item'); if (it) location.hash = `#/analyse?game=${it.dataset.id}`;
  });
  const importer = async (btn, fn, key, input) => {
    const user = $(input, root).value.trim();
    if (!user) { toast('Indique ton pseudo.'); return; }
    settings.set({ [key]: user });
    btn.disabled = true; const old = btn.textContent; btn.textContent = 'Import en cours…';
    try {
      const list = await fn(user, 15);
      list.forEach(g => { if (!g.you) g.you = g.white.toLowerCase() === user.toLowerCase() ? 'w' : g.black.toLowerCase() === user.toLowerCase() ? 'b' : null; });
      const n = mergeImported(list);
      toast(n ? `${n} partie${n > 1 ? 's' : ''} importée${n > 1 ? 's' : ''}.` : 'Aucune nouvelle partie.');
      renderLibrary(root);
    } catch (err) {
      toast(navigator.onLine ? err.message : 'Pas de connexion Internet.');
      btn.disabled = false; btn.textContent = old;
    }
  };
  $('#li-go', root).onclick = e => importer(e.target, fetchLichessGames, 'lichessUser', '#li-user');
  $('#cc-go', root).onclick = e => importer(e.target, fetchChesscomGames, 'chesscomUser', '#cc-user');
  $('#pgn-go', root).onclick = () => {
    const parts = splitPgn($('#pgn', root).value);
    const list = [];
    for (const p of parts) { try { list.push(parsePgnGame(p)); } catch (err) { toast('PGN illisible : ' + err.message); } }
    if (list.length) { const n = mergeImported(list); toast(`${n} partie(s) ajoutée(s).`); renderLibrary(root); }
  };
  $('#fen-go', root).onclick = () => {
    const f = $('#fen-in', root).value.trim();
    try { new Chess(f); location.hash = `#/analyse?fen=${encodeURIComponent(f)}`; } catch { toast('FEN invalide.'); }
  };
  $('#fen-start', root).onclick = () => { location.hash = `#/analyse?fen=${encodeURIComponent(new Chess().fen())}`; };
}

function gameRow(g) {
  const r = describeResult(g);
  const src = { caissa: 'Caïssa', lichess: 'Lichess', chesscom: 'Chess.com', pgn: 'PGN' }[g.source] || g.source;
  const acc = g.analysis && g.you ? ` · précision ${g.analysis.acc[g.you] ?? '—'} %` : g.analysis ? ' · analysée' : '';
  return `<div class="list-item" data-id="${g.id}">
    <div class="grow"><div class="t">${esc(g.white)} – ${esc(g.black)}</div>
    <div class="s">${fmtDate(g.date)} · ${src} · ${Math.ceil(g.moves.length / 2)} coups${acc}</div></div>
    <span class="result ${r.cls}">${r.txt}</span>
    <button class="btn sm ghost" data-del="${g.id}" aria-label="Supprimer">✕</button></div>`;
}

// --- vue d'analyse ----------------------------------------------------------------
function layout(root, title, sub) {
  root.innerHTML = `
  <div class="split">
    <div class="board-col">
      <div class="player"><span class="name"><span id="an-title">${title}</span></span><span class="muted small">${sub || ''}</span></div>
      <div class="board-area"><div class="evalbar" id="an-evalbar"><i style="height:50%"></i></div><div class="board-wrap"><div id="an-board"></div></div></div>
      <div class="toolbar" id="an-nav">
        <button class="btn sm" data-n="first" aria-label="Début">⏮</button><button class="btn sm" data-n="prev" aria-label="Précédent">◀</button>
        <button class="btn sm" data-n="next" aria-label="Suivant">▶</button><button class="btn sm" data-n="last" aria-label="Fin">⏭</button>
        <button class="btn sm" data-n="flip">Retourner</button><button class="btn sm" data-n="best">Meilleur coup</button>
      </div>
    </div>
    <div class="side stack" id="an-side"></div>
  </div>`;
}

function openFen(root, fen) {
  layout(root, 'Analyse de position', '');
  const board = new Board($('#an-board', root), { onMove: (f, t, p) => explore(f, t, p) });
  A = { root, board, g: null, base: [new Chess(fen).fen()], sans: [], ply: 0, variation: [], showBest: false, cancelled: false };
  board.setOrientation(fen.split(' ')[1]);
  $('#an-side', root).innerHTML = `<div class="card" id="an-current"></div><div class="card"><div class="row between"><h3>Moteur</h3><span class="muted small" id="an-depth"></span></div><div class="engine-lines" id="an-lines"></div></div>
    <div class="card"><p class="muted small" style="margin:0">Joue des coups sur l'échiquier pour explorer : Stockfish évalue chaque position.</p></div>`;
  bindNav();
  show();
}

function openGame(root, g, auto) {
  if (g.analysis && g.analysis.v !== ANALYSIS_VERSION) { g.analysis = null; g.legacy = true; }
  const r = describeResult(g);
  layout(root, `${esc(g.white)} – ${esc(g.black)}`, `${g.result}${r.txt && g.you ? ' · ' + r.txt : ''}`);
  const board = new Board($('#an-board', root), { orientation: g.you || 'w', onMove: (f, t, p) => explore(f, t, p) });
  const c = new Chess(g.startFen);
  const base = [c.fen()], sans = [], ucis = [];
  for (const u of g.moves) { const m = uciToMove(c, u); if (!m) break; base.push(c.fen()); sans.push(m.san); ucis.push([m.from, m.to]); }
  A = { root, board, g, base, sans, ucis, ply: 0, variation: [], showBest: false, cancelled: false, an: g.analysis };
  $('#an-side', root).innerHTML = `
    <div class="card" id="an-summary"></div>
    <div class="card" id="an-current"></div>
    <div class="card"><div class="row between" style="margin-bottom:6px"><h3>Coups</h3><button class="btn sm ghost" id="an-pgn">Copier le PGN</button></div><div class="moves" id="an-moves" style="max-height:300px"></div></div>
    <div class="card"><div class="row between"><h3>Moteur</h3><span class="muted small" id="an-depth"></span></div><div class="engine-lines" id="an-lines"></div></div>`;
  $('#an-pgn', root).onclick = async () => { try { await navigator.clipboard.writeText(pgnOf(g)); toast('PGN copié.'); } catch { toast('Copie impossible.'); } };
  $('#an-moves', root).addEventListener('click', e => { const m = e.target.closest('[data-p]'); if (m) go(+m.dataset.p); });
  bindNav();
  renderSummary();
  renderMoves();
  go(g.analysis ? firstKeyMoment() : 0);
  if (auto && !g.analysis) runAnalysis();
}

function bindNav() {
  $('#an-nav', A.root).addEventListener('click', e => {
    const b = e.target.closest('[data-n]'); if (!b) return;
    const n = b.dataset.n;
    if (n === 'flip') { A.board.flip(); updateEvalBar(); return; }
    if (n === 'best') { A.showBest = !A.showBest; b.classList.toggle('primary', A.showBest); show(); return; }
    if (A.variation.length) { A.variation = []; }
    const max = A.base.length - 1;
    go(n === 'first' ? 0 : n === 'last' ? max : n === 'prev' ? Math.max(0, A.ply - 1) : Math.min(max, A.ply + 1));
  });
  A.keyHandler = e => {
    if (!A || e.target.closest('input,textarea')) return;
    if (e.key === 'ArrowLeft') { A.variation = []; go(Math.max(0, A.ply - 1)); }
    if (e.key === 'ArrowRight') { A.variation = []; go(Math.min(A.base.length - 1, A.ply + 1)); }
  };
  document.addEventListener('keydown', A.keyHandler);
  // balayage horizontal sur l'échiquier pour naviguer : non (conflit avec les coups) — on garde les boutons
}

function firstKeyMoment() {
  const an = A.g?.analysis;
  if (!an || !A.g.you) return 0;
  let i = an.moves.findIndex((m, k) => (m.cls === 'blunder' || m.cls === 'miss') && an.positions[k].turn === A.g.you);
  if (i < 0) i = an.moves.findIndex((m, k) => m.cls === 'mistake' && an.positions[k].turn === A.g.you);
  return i >= 0 ? i + 1 : 0;
}

function go(ply) {
  A.ply = ply;
  A.variation = [];
  show();
  const el = $('#an-moves', A.root);
  const on = el?.querySelector('.mv.on');
  if (on) {
    const top = on.offsetTop - el.offsetTop;
    if (top < el.scrollTop || top > el.scrollTop + el.clientHeight - 30) el.scrollTop = top - el.clientHeight / 2;
  }
}

function curFen() { return A.variation.length ? A.variation[A.variation.length - 1].fen : A.base[A.ply]; }

function show() {
  const fen = curFen();
  const chess = new Chess(fen);
  let last = null;
  if (A.variation.length) { const v = A.variation[A.variation.length - 1]; last = [v.from, v.to]; }
  else if (A.ply > 0 && A.ucis) last = A.ucis[A.ply - 1];
  A.board.setPosition(fen, { lastMove: last, check: checkSquare(chess) });
  A.board.setDests(destsFor(chess));
  A.board.setMovable(chess.isGameOver() ? null : chess.turn());
  // annotations sur l'échiquier
  const marks = {};
  const an = A.g?.analysis;
  if (an && !A.variation.length && A.ply > 0) {
    const mv = an.moves[A.ply - 1];
    if (mv?.cls) marks[A.ucis[A.ply - 1][1]] = 'c-' + mv.cls;
  }
  A.board.setMarks(marks);
  renderMoves();
  renderCurrent();
  renderGraph();
  // évaluation : stockée si dispo, puis moteur en direct
  const stored = !A.variation.length && an ? an.positions[A.ply] : null;
  A.liveLines = null;
  if (stored) setEval(stored.line, fen);
  arrows();
  live(fen);
}

function arrows() {
  const ar = [];
  const fen = curFen();
  const an = A.g?.analysis;
  let best = null;
  if (A.liveLines?.[0]?.move) best = A.liveLines[0].move;
  else if (!A.variation.length && an) best = an.positions[A.ply]?.line?.move;
  if (A.showBest && best) ar.push({ from: best.slice(0, 2), to: best.slice(2, 4), kind: 'best' });
  if (A.showMistake && !A.variation.length && an && A.ply < an.moves.length) {
    const mv = an.moves[A.ply];
    if (mv.label || mv.cls === 'miss') ar.push({ from: mv.uci.slice(0, 2), to: mv.uci.slice(2, 4), kind: 'bad' });
  }
  A.board.setArrows(ar);
  void fen;
}

let liveToken = 0;
async function live(fen) {
  const token = ++liveToken;
  const pos = new Chess(fen);
  const linesEl = $('#an-lines', A.root);
  if (pos.isGameOver()) {
    linesEl.innerHTML = `<div><span class="muted">${pos.isCheckmate() ? 'Échec et mat.' : 'Partie nulle.'}</span></div>`;
    $('#an-depth', A.root).textContent = '';
    if (pos.isCheckmate()) setEval({ mate: 0, cp: null }, fen, true);
    return;
  }
  if (A.running) { linesEl.innerHTML = '<div><span class="muted">Moteur occupé par l\'analyse de la partie…</span></div>'; return; }
  linesEl.innerHTML = '<div><span class="muted">Calcul…</span></div>';
  const r = await engine.analyse(fen, {
    depth: 18, multipv: 3, priority: 'high',
    onInfo: (lines, depth) => {
      if (token !== liveToken || !A) return;
      A.liveLines = lines;
      renderLines(lines, fen, depth);
      setEval(lines[0], fen);
    },
  });
  if (!r || token !== liveToken || !A) return;
  A.liveLines = r.lines;
  renderLines(r.lines, fen, r.lines[0]?.depth);
  setEval(r.lines[0], fen);
  arrows();
  if (A.judge && A.judge.fen === fen && r.lines[0]) finishJudge(r.lines[0]);
}

function renderLines(lines, fen, depth) {
  $('#an-depth', A.root).textContent = depth ? `profondeur ${depth}` : '';
  const turn = fen.split(' ')[1];
  $('#an-lines', A.root).innerHTML = lines.filter(Boolean).map(l =>
    `<div><b>${formatEval(l, true, turn)}</b><span>${esc(numberedSan(fen, pvToSan(fen, l.pv, 7).map(sanFr)))}</span></div>`).join('');
  if (A.showBest) arrows();
}

function setEval(line, fen, isMateOver) {
  const turn = fen.split(' ')[1];
  let w;
  if (isMateOver || (line && line.mate === 0)) w = turn === 'w' ? 0 : 100;
  else { const s = lineWin(line); w = turn === 'w' ? s : 100 - s; }
  A.evalWhite = w;
  A.evalText = line ? formatEval(line, true, turn) : '';
  updateEvalBar();
}
function updateEvalBar() {
  const bar = $('#an-evalbar', A.root);
  if (!bar) return;
  const flipped = A.board.orientation === 'b';
  bar.classList.toggle('flipped', flipped);
  bar.querySelector('i').style.height = `${A.evalWhite ?? 50}%`;
  bar.title = A.evalText || '';
}

// --- exploration libre ----------------------------------------------------------------
function explore(from, to, promotion) {
  const fen = curFen();
  const c = new Chess(fen);
  let m;
  try { m = c.move({ from, to, promotion }); } catch { return false; }
  // si le coup est celui de la partie, on avance simplement
  if (!A.variation.length && A.ucis && A.ply < A.ucis.length) {
    const [f, t] = A.ucis[A.ply];
    if (f === from && t === to) { moveSound(m, c); go(A.ply + 1); return true; }
  }
  const tr = A.trying;
  if (tr && !A.variation.length && A.ply === tr.k) {
    A.trying = null;
    judgeRetry(tr.k, fen, moveToUci(m), m.san);
  }
  A.variation.push({ fen: c.fen(), san: m.san, from, to, uci: moveToUci(m) });
  moveSound(m, c);
  show();
  return true;
}

function judgeRetry(k, fen, uci, san) {
  const mv = A.g.analysis.moves[k];
  if (uci === mv.best) { toast('Bravo : c\'est le coup de Stockfish !'); return; }
  if (uci === mv.uci) { toast('C\'est le coup joué dans la partie… cherche autre chose.'); return; }
  const c = new Chess(fen); uciToMove(c, uci);
  // le jugement se fait quand le moteur a fini d'évaluer la nouvelle position (voir live())
  A.judge = { k, fen: c.fen(), san };
}
function finishJudge(line) {
  const j = A.judge; A.judge = null;
  const mv = A.g.analysis.moves[j.k];
  const before = A.g.analysis.positions[j.k];
  const winAfter = 100 - lineWin(line);
  const winBest = lineWin(before.line);
  if (winBest - winAfter < 6) toast(`${sanFr(j.san)} est aussi un bon coup. Bien joué !`);
  else toast(`${sanFr(j.san)} reste insuffisant. Le meilleur était ${sanFr(mv.bestSan)}.`, 3500);
}

// --- liste des coups, courbe, carte du coup courant -------------------------------------
const NOTABLE = new Set(['brilliant', 'great', 'inaccuracy', 'mistake', 'miss', 'blunder']);
function clsIcon(cls, big = false) {
  const c = CLASSES[cls];
  return `<span class="cls-ic ${big ? 'big' : ''}" style="background:${c.color}" title="${c.name}">${c.sym}</span>`;
}
function renderMoves() {
  const el = $('#an-moves', A.root);
  if (!el) return;
  const an = A.g?.analysis;
  const firstWhite = A.base[0].split(' ')[1] === 'w';
  let h = '';
  A.sans.forEach((san, i) => {
    const white = (i % 2 === 0) === firstWhite;
    const num = Math.floor((i + (firstWhite ? 0 : 1)) / 2) + (+A.base[0].split(' ')[5] || 1);
    if (white) h += `<span class="n">${num}.</span>`;
    else if (i === 0) h += `<span class="n">${num}.</span><span class="mv">…</span>`;
    const cls = an?.moves[i]?.cls;
    const mark = cls && NOTABLE.has(cls) ? `<span class="gl" style="color:${CLASSES[cls].color}">${CLASSES[cls].sym}</span>` : cls === 'book' ? '<span class="gl book">≡</span>' : '';
    h += `<span class="mv ${A.ply === i + 1 && !A.variation.length ? 'on' : ''}" data-p="${i + 1}">${esc(sanFr(san))}${mark}</span>`;
  });
  el.innerHTML = h;
}

function renderGraph() {
  const an = A.g?.analysis;
  const wrap = $('#an-graphwrap', A.root);
  if (!wrap) return;
  if (!an) { wrap.innerHTML = ''; return; }
  const P = an.positions, n = P.length - 1 || 1, W = 300, H = 80;
  const pts = P.map((p, i) => [(i / n) * W, H - (p.win / 100) * H]);
  const area = `M0,${H} ` + pts.map(p => `L${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ') + ` L${W},${H} Z`;
  const dots = an.moves.map((m, i) => ['blunder', 'mistake', 'miss', 'brilliant', 'great'].includes(m.cls) ? `<circle cx="${pts[i + 1][0].toFixed(1)}" cy="${pts[i + 1][1].toFixed(1)}" r="2.8" fill="${CLASSES[m.cls].color}" stroke="#fff" stroke-width=".6"/>` : '').join('');
  const x = (A.ply / n) * W;
  wrap.innerHTML = `<svg class="graph" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" id="an-graph" role="img" aria-label="Courbe d'évaluation">
    <rect x="0" y="0" width="${W}" height="${H}" fill="#2c2420"/>
    <path d="${area}" fill="#f2e8d6"/>
    <line x1="0" y1="${H / 2}" x2="${W}" y2="${H / 2}" stroke="rgba(201,128,79,.6)" stroke-width=".6" stroke-dasharray="3 3"/>
    ${dots}
    <line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="#C9804F" stroke-width="1.6"/></svg>`;
  const svg = $('#an-graph', A.root);
  const pick = e => { const r = svg.getBoundingClientRect(); const p = Math.round(((e.clientX - r.left) / r.width) * n); go(Math.max(0, Math.min(n, p))); };
  svg.onpointerdown = e => { pick(e); svg.setPointerCapture(e.pointerId); svg.onpointermove = pick; };
  svg.onpointerup = () => { svg.onpointermove = null; };
}

function phaseMark(v) {
  if (v == null) return '<span class="muted">—</span>';
  const c = v >= 85 ? 'good' : v >= 65 ? 'mid' : 'bad';
  return `<span class="ph ${c}">${v}</span>`;
}

function renderSummary() {
  const el = $('#an-summary', A.root);
  if (!el) return;
  const g = A.g, an = g.analysis;
  if (A.running) return;
  if (!an) {
    el.innerHTML = `<h3>Bilan de la partie</h3>
      <p class="muted small">${g.legacy ? 'Le nouveau bilan (coups brillants, occasions manquées, Elo estimé…) est disponible : relance l’analyse. ' : ''}Stockfish va examiner chaque coup (profondeur ${settings.get().analysisDepth}). Compte 1 à 2 secondes par coup sur un téléphone.</p>
      ${sideChooser(g)}
      <button class="btn primary block" id="an-run">${g.legacy ? 'Relancer l’analyse' : 'Lancer l’analyse'}</button>`;
    $('#an-run', el).onclick = runAnalysis;
    bindSideChooser(el);
    return;
  }
  const yc = g.you;
  const names = { w: g.white, b: g.black };
  const elo = s => an.estElo?.[s] ? `≈ ${an.estElo[s]}` : '—';
  const rows = CLASS_ORDER.map(k => `<span class="cls-row">${clsIcon(k)}${CLASSES[k].name}</span><span class="v" style="color:${an.classes.w[k] ? CLASSES[k].color : ''}">${an.classes.w[k]}</span><span class="v" style="color:${an.classes.b[k] ? CLASSES[k].color : ''}">${an.classes.b[k]}</span>`).join('');
  const keyMoves = yc ? an.moves.map((m, i) => ({ m, i })).filter(x => an.positions[x.i].turn === yc && ['blunder', 'miss', 'mistake', 'brilliant', 'great'].includes(x.m.cls)) : [];
  const eloLine = g.rated && g.eloBefore != null ? `<div class="elo-change small"><span>Ton Elo Caïssa</span><b>${g.eloBefore} → ${g.eloAfter}</b><em class="${g.eloAfter >= g.eloBefore ? 'good-t' : 'bad-t'}">${g.eloAfter >= g.eloBefore ? '+' : ''}${g.eloAfter - g.eloBefore}</em></div>` : '';
  el.innerHTML = `
    <div class="row between"><h3>Bilan de la partie</h3>${yc ? `<span class="badge">Tu avais les ${yc === 'w' ? 'Blancs' : 'Noirs'}</span>` : ''}</div>
    ${an.opening?.name ? `<p class="small muted" style="margin:4px 0 0">Ouverture : <b>${esc(an.opening.name)}</b></p>` : ''}
    <div class="summary-grid" style="margin-top:10px">
      <span></span><span class="h">${esc(trim(names.w))}${yc === 'w' ? ' (toi)' : ''}</span><span class="h">${esc(trim(names.b))}${yc === 'b' ? ' (toi)' : ''}</span>
      <span>Précision</span><span class="v acc">${an.acc.w ?? '—'}</span><span class="v acc">${an.acc.b ?? '—'}</span>
      <span>Elo estimé sur la partie</span><span class="v est">${elo('w')}</span><span class="v est">${elo('b')}</span>
    </div>
    ${eloLine}
    <div id="an-graphwrap" style="margin-top:12px"></div>
    <details class="cls-table" open><summary>Détail des coups</summary>
      <div class="summary-grid" style="margin-top:8px">${rows}</div></details>
    <div class="summary-grid phases" style="margin-top:10px">
      <span class="small muted">Par phase</span><span class="h"></span><span class="h"></span>
      <span>Ouverture</span><span class="v">${phaseMark(an.phases?.w.opening)}</span><span class="v">${phaseMark(an.phases?.b.opening)}</span>
      <span>Milieu de partie</span><span class="v">${phaseMark(an.phases?.w.middlegame)}</span><span class="v">${phaseMark(an.phases?.b.middlegame)}</span>
      <span>Finale</span><span class="v">${phaseMark(an.phases?.w.endgame)}</span><span class="v">${phaseMark(an.phases?.b.endgame)}</span>
    </div>
    ${keyMoves.length ? `<p class="small" style="margin:12px 0 4px"><b>Tes moments clés</b></p><div class="chips">${keyMoves.map(x => `<button class="chip" data-k="${x.i}">${clsIcon(x.m.cls)} ${esc(moveLabel(x.i))}</button>`).join('')}</div>` : ''}
    <p class="tiny muted" style="margin:10px 0 0">Elo estimé : d'après la perte moyenne par coup (${an.acpl?.w ?? '—'} / ${an.acpl?.b ?? '—'} centipions). Indicatif, plus fiable sur les parties longues.</p>
    ${!yc ? sideChooser(g) : ''}`;
  el.querySelectorAll('[data-k]').forEach(b => b.onclick = () => go(+b.dataset.k + 1));
  bindSideChooser(el);
  renderGraph();
}
function trim(s) { return s.length > 14 ? s.slice(0, 13) + '…' : s; }
function moveLabel(i) {
  const firstWhite = A.base[0].split(' ')[1] === 'w';
  const white = (i % 2 === 0) === firstWhite;
  const num = Math.floor((i + (firstWhite ? 0 : 1)) / 2) + (+A.base[0].split(' ')[5] || 1);
  return `${num}${white ? '.' : '…'} ${sanFr(A.sans[i])}`;
}
function sideChooser(g) {
  if (g.you) return '';
  return `<div style="margin:10px 0"><p class="small muted" style="margin:0 0 6px">Quel camp jouais-tu ? (pour ranger tes erreurs dans ton carnet)</p>
    <div class="seg" id="an-side-ch"><button data-v="w">${esc(trim(g.white))}</button><button data-v="b">${esc(trim(g.black))}</button></div></div>`;
}
function bindSideChooser(el) {
  const ch = $('#an-side-ch', el);
  if (!ch) return;
  ch.onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    A.g.you = b.dataset.v;
    saveGame(A.g);
    if (A.g.analysis) { const n = addMistakesFromAnalysis(A.g, A.g.analysis); if (n) toast(`${n} erreur${n > 1 ? 's' : ''} ajoutée${n > 1 ? 's' : ''} à ton carnet.`); }
    A.board.setOrientation(A.g.you);
    renderSummary();
  };
}

// Commentaire automatique d'un coup (sans IA)
const PIECE = { p: 'le pion', n: 'le cavalier', b: 'le fou', r: 'la tour', q: 'la dame', k: 'le roi' };
function commentFor(k) {
  const an = A.g.analysis, mv = an.moves[k], before = an.positions[k], after = an.positions[k + 1];
  const best = sanFr(mv.bestSan || '');
  const line = (fen, pv, n = 5) => numberedSan(fen, pvToSan(fen, pv || [], n).map(sanFr));
  let reply = null;
  if (after.line?.pv?.[0]) { const c = new Chess(after.fen); reply = uciToMove(c, after.line.pv[0]); }
  const mateIn = l => (l?.mate != null && l.mate > 0 ? l.mate : null);
  const errText = () => {
    switch (mv.category) {
      case 'hanging': return reply?.captured ? `Ce coup laisse ${PIECE[reply.captured]} en ${reply.to} insuffisamment protégé${reply.captured === 'r' || reply.captured === 'q' ? 'e' : ''} : l'adversaire répond ${sanFr(reply.san)}.` : 'Ce coup laisse une pièce en prise.';
      case 'allowedMate': return `Ce coup permet un mat en ${mateIn(after.line)} : ${line(after.fen, after.line.pv, 6)}.`;
      case 'missedMate': return `Il y avait un mat en ${mateIn(before.line)} : ${line(before.fen, before.line.pv, 6)}.`;
      case 'allowedTactic': return reply ? `Après ce coup, l'adversaire dispose de ${sanFr(reply.san)}, qui lui donne l'avantage.` : 'Ce coup donne l\'avantage à l\'adversaire.';
      case 'missedTactic': return `Il y avait un gain avec ${best} : ${line(before.fen, before.line.pv)}.`;
      default: return `Ce coup affaiblit la position. Il fallait jouer ${best}.`;
    }
  };
  switch (mv.cls) {
    case 'book': return `Coup de théorie${an.opening?.name ? ` (${an.opening.name})` : ''} : il suit les ouvertures connues.`;
    case 'brilliant': return `Coup brillant ! ${sanFr(mv.san)} offre du matériel, mais c'est bien le meilleur coup : ${line(before.fen, before.line.pv, 6)}.`;
    case 'great': return `Très fort : c'était le seul coup qui gardait l'équilibre ou l'avantage. Les autres coups étaient nettement moins bons.`;
    case 'best': return 'Meilleur coup selon Stockfish.';
    case 'excellent': return `Excellent coup, presque aussi fort que ${best}.`;
    case 'good': return `Bon coup. Un peu plus précis : ${best}.`;
    case 'inaccuracy': return `Imprécision : ${best} était plus fort (${line(before.fen, before.line.pv, 4)}).`;
    case 'miss': return `Occasion manquée : l'adversaire venait de se tromper, et ${best} en profitait (${line(before.fen, before.line.pv, 5)}).`;
    case 'mistake': case 'blunder': return errText();
    default: return '';
  }
}

function renderCurrent() {
  const el = $('#an-current', A.root);
  if (!el) return;
  if (A.variation.length) {
    const startFen = A.base[A.ply];
    el.innerHTML = `<div class="row between"><b>Variante</b><button class="btn sm" id="an-back">Revenir à la partie</button></div>
      <p class="small" style="margin:8px 0 0">${esc(numberedSan(startFen, A.variation.map(v => sanFr(v.san))))}</p>`;
    $('#an-back', el).onclick = () => { A.variation = []; show(); };
    return;
  }
  const an = A.g?.analysis;
  const i = A.ply;
  if (!A.g) {
    el.innerHTML = `<div class="row between"><b>Position</b><button class="btn sm" id="an-ex">Expliquer</button></div><div id="an-coach" style="margin-top:8px"></div>`;
    $('#an-ex', el).onclick = () => explainPosition();
    return;
  }
  if (!an) {
    el.innerHTML = `<p class="muted small" style="margin:0">${i === 0 ? 'Position de départ.' : 'Coup ' + moveLabel(i - 1)} — lance l'analyse pour le bilan. Tu peux aussi jouer des coups pour explorer.</p>`;
    return;
  }
  if (i === 0) {
    el.innerHTML = `<p class="small muted" style="margin:0">Position de départ. Avance avec ▶ ou touche un coup dans la liste.</p>`;
    return;
  }
  const k = i - 1;
  const mv = an.moves[k];
  const before = an.positions[k], after = an.positions[k + 1];
  const c = CLASSES[mv.cls];
  const isErr = ['inaccuracy', 'mistake', 'miss', 'blunder'].includes(mv.cls);
  el.innerHTML = `
    <div class="row" style="gap:10px;flex-wrap:nowrap">${clsIcon(mv.cls, true)}<div style="min-width:0"><b>${esc(moveLabel(k))}</b> <span style="color:${c.color};font-weight:700">· ${c.name}</span>
      <div class="muted small">${formatEval(after.line, true, after.turn)}${isErr ? ` (au lieu de ${formatEval(before.line, true, before.turn)})` : ''}</div></div></div>
    <p class="small" style="margin:8px 0 0">${esc(commentFor(k))}</p>
    ${isErr ? `<div class="row" style="margin-top:10px"><button class="btn sm" id="an-show">Voir le meilleur coup</button><button class="btn sm primary" id="an-ex">Expliquer</button><button class="btn sm ghost" id="an-try">Rejouer ce moment</button></div>`
      : `<div class="row" style="margin-top:8px"><button class="btn sm ghost" id="an-ex">Expliquer</button></div>`}
    <div id="an-coach" style="margin-top:8px"></div>`;
  const sh = $('#an-show', el);
  if (sh) sh.onclick = () => {
    A.ply = k; A.variation = []; A.showMistake = true; A.showBest = true;
    $('#an-nav [data-n=best]', A.root).classList.add('primary');
    show();
    A.showMistake = false;
  };
  $('#an-ex', el).onclick = () => explainMove(k);
  const tr = $('#an-try', el);
  if (tr) tr.onclick = () => { A.ply = k; A.variation = []; show(); toast('À toi : trouve mieux que ' + sanFr(mv.san) + '.'); A.trying = { k }; };
}

// --- analyse complète -----------------------------------------------------------------
async function runAnalysis() {
  const g = A.g;
  if (!g || A.running) return;
  engine.cancelAll();
  A.running = true;
  const el = $('#an-summary', A.root);
  el.innerHTML = `<h3>Analyse en cours…</h3><div class="progress" style="margin:10px 0"><i id="an-prog"></i></div><p class="muted small" id="an-prog-t">Démarrage du moteur…</p>`;
  const a = A;
  const an = await analyseGame(g, {
    isCancelled: () => a.cancelled,
    onProgress: (i, total) => {
      if (a.cancelled) return;
      const p = $('#an-prog', a.root); if (p) p.style.width = `${(i / total) * 100}%`;
      const t = $('#an-prog-t', a.root); if (t) t.textContent = `Position ${i} / ${total}`;
    },
  });
  if (!an || a.cancelled) return;
  A.running = false;
  g.analysis = an;
  delete g.legacy;
  saveGame(g);
  const n = addMistakesFromAnalysis(g, an);
  if (n) toast(`${n} erreur${n > 1 ? 's' : ''} ajoutée${n > 1 ? 's' : ''} à ton carnet.`);
  renderSummary();
  go(firstKeyMoment());
}

// --- explications -----------------------------------------------------------------------
async function explainMove(k) {
  const box = $('#an-coach', A.root);
  if (!hasKey()) { box.innerHTML = `<div class="coach">Ajoute ta clé API Claude dans les réglages (⚙︎) pour obtenir une explication rédigée.</div>`; return; }
  const an = A.g.analysis, mv = an.moves[k], before = an.positions[k], after = an.positions[k + 1];
  box.innerHTML = '<div class="coach loading">Caïssa réfléchit…</div>';
  const evalTxt = (l, turn) => { const t = formatEval(l, true, turn); return `${t} (point de vue des Blancs)`; };
  try {
    const txt = await askClaude(explainMovePrompt({
      fen: before.fen, turn: before.turn, side: A.g.you || before.turn,
      playedSan: sanFr(mv.san), evalAfter: evalTxt(after.line, after.turn), label: CLASSES[mv.cls]?.name || 'coup',
      bestLine: numberedSan(before.fen, pvToSan(before.fen, before.line.pv || [], 6).map(sanFr)), evalBest: evalTxt(before.line, before.turn),
      refutation: after.line?.pv?.length ? numberedSan(after.fen, pvToSan(after.fen, after.line.pv, 6).map(sanFr)) : '',
      category: mv.category ? CATEGORIES[mv.category] : '',
    }));
    box.innerHTML = `<div class="coach">${esc(txt)}</div>`;
  } catch (e) { box.innerHTML = `<div class="coach">${esc(e.message)}</div>`; }
}

async function explainPosition() {
  const box = $('#an-coach', A.root);
  if (!hasKey()) { box.innerHTML = `<div class="coach">Ajoute ta clé API Claude dans les réglages (⚙︎) pour obtenir une explication rédigée.</div>`; return; }
  const fen = curFen();
  const lines = A.liveLines || [];
  if (!lines.length) { box.innerHTML = '<div class="coach">Attends que le moteur ait calculé la position.</div>'; return; }
  box.innerHTML = '<div class="coach loading">Caïssa réfléchit…</div>';
  const turn = fen.split(' ')[1];
  try {
    const txt = await askClaude(explainPositionPrompt({
      fen, turn, eval: formatEval(lines[0], true, turn),
      lines: lines.map(l => `- ${formatEval(l, true, turn)} : ${numberedSan(fen, pvToSan(fen, l.pv, 6).map(sanFr))}`).join('\n'),
    }));
    box.innerHTML = `<div class="coach">${esc(txt)}</div>`;
  } catch (e) { box.innerHTML = `<div class="coach">${esc(e.message)}</div>`; }
}

void $$; void store;
