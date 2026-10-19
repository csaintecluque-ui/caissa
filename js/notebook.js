// Carnet d'erreurs : tes gaffes et erreurs en partie deviennent des exercices,
// révisés à intervalles croissants (1, 3, 7, 16, 35 jours).
import { Board } from './board.js';
import { Chess, $, esc, uciToMove, moveToUci, destsFor, checkSquare, sound, moveSound, sanFr, pvToSan, numberedSan, fmtDate } from './util.js';
import { engine, lineWin, formatEval } from './engine.js';
import { listMistakes, dueMistakes, reviewMistake, weaknessStats, CATEGORIES, LABELS, saveMistakes } from './games.js';
import { askClaude, explainMovePrompt, hasKey } from './coach.js';

let N = null;

export function mount(root, params = {}) {
  if (params.review) return review(root, params.id || null);
  renderList(root);
}
export function unmount() { if (N) engine.cancelAll(); N = null; }

function renderList(root) {
  const all = listMistakes().slice().sort((a, b) => b.date - a.date);
  const due = dueMistakes();
  const stats = weaknessStats();
  const max = stats[0]?.[1] || 1;
  root.innerHTML = `
  <div class="split">
    <div class="stack">
      <div><h2>Carnet d'erreurs</h2>
      <p class="muted">Chaque gaffe ou erreur de tes parties analysées devient un exercice. Tu les revois jusqu'à ce que le bon réflexe soit automatique.</p></div>
      <div class="card">
        <div class="row between"><div><div class="acc">${due.length}</div><span class="muted small">à revoir aujourd'hui</span></div>
        <button class="btn primary" id="nb-go" ${due.length ? '' : 'disabled'}>Réviser</button></div>
      </div>
      <div class="card">
        <h3>Toutes mes erreurs</h3>
        <div class="list" id="nb-list">${all.length ? all.map(row).join('') : '<div class="empty">Ton carnet est vide.<br>Analyse une partie (contre Caïssa ou importée) : tes erreurs y seront rangées automatiquement.</div>'}</div>
      </div>
    </div>
    <div class="side stack">
      <div class="card">
        <h3>Ce qui te coûte des points</h3>
        ${stats.length ? stats.map(([k, n]) => `<div class="weak-bar"><span>${CATEGORIES[k]}</span><b>${n}</b><div class="bar"><i style="width:${(n / max) * 100}%"></i></div></div>`).join('') : '<p class="muted small">Les statistiques apparaîtront après tes premières analyses.</p>'}
        ${stats.length ? `<p class="small" style="margin:10px 0 0">${advice(stats[0][0])}</p>` : ''}
      </div>
    </div>
  </div>`;
  $('#nb-go', root).onclick = () => { location.hash = '#/carnet?review=1'; };
  $('#nb-list', root).addEventListener('click', e => {
    const d = e.target.closest('[data-del]');
    if (d) { e.stopPropagation(); saveMistakes(listMistakes().filter(m => m.id !== d.dataset.del)); renderList(root); return; }
    const it = e.target.closest('.list-item'); if (it) location.hash = `#/carnet?review=1&id=${it.dataset.id}`;
  });
}

function row(m) {
  const next = m.due <= Date.now() ? '<span class="badge bad">à revoir</span>' : `<span class="muted small">revoir le ${fmtDate(m.due)}</span>`;
  return `<div class="list-item" data-id="${m.id}"><div class="grow"><div class="t">${esc(sanFr(m.playedSan))} <span class="gl ${m.label}">${LABELS[m.label]?.sym || ''}</span> — ${CATEGORIES[m.category] || ''}</div>
    <div class="s">contre ${esc(m.opponent || '?')} · ${fmtDate(m.date)} · réussi ${m.solved}/${m.reviews}</div></div>${next}
    <button class="btn sm ghost" data-del="${m.id}" aria-label="Supprimer">✕</button></div>`;
}

export function advice(cat) {
  return {
    hanging: '<b>Conseil :</b> avant de lâcher ta pièce, regarde la case d\'arrivée : combien de pièces adverses l\'attaquent, combien la défendent ?',
    missedTactic: '<b>Conseil :</b> à chaque coup adverse, cherche d\'abord tes échecs et tes prises. Les problèmes « Fourchette » et « Pièce en prise » entraînent ce réflexe.',
    missedMate: '<b>Conseil :</b> quand le roi adverse est exposé, cherche systématiquement les échecs. Travaille les problèmes « Mat en 1 » et « Mat en 2 ».',
    allowedMate: '<b>Conseil :</b> vérifie la sécurité de ton roi à chaque coup : quelles cases autour de lui sont attaquées ? As-tu une case de fuite (« luft ») ?',
    allowedTactic: '<b>Conseil :</b> pose-toi la question « que veut faire l\'adversaire ? » après chacun de ses coups, avant de penser à ton plan.',
    other: '<b>Conseil :</b> en cas de doute, améliore ta pièce la moins active plutôt que de lancer une attaque hasardeuse.',
  }[cat] || '';
}

// --- révision -------------------------------------------------------------------------
function review(root, id) {
  root.innerHTML = `
  <div class="split">
    <div class="board-col"><div class="board-area"><div class="board-wrap"><div id="nb-board"></div></div></div></div>
    <div class="side stack">
      <div class="card">
        <div class="row between"><span class="muted small" id="nb-meta"></span><a class="btn sm ghost" href="#/carnet">Carnet</a></div>
        <div class="status" id="nb-status" style="margin-top:8px"></div>
        <p class="small" id="nb-sub" style="margin:6px 0 0"></p>
        <div class="row" id="nb-actions" style="margin-top:10px"></div>
        <div id="nb-coach" style="margin-top:10px"></div>
      </div>
    </div>
  </div>`;
  const board = new Board($('#nb-board', root), { onMove: (f, t, p) => attempt(f, t, p) });
  N = { root, board, queue: id ? listMistakes().filter(m => m.id === id) : shuffle(dueMistakes()).slice(0, 15), idx: 0, done: 0, ok: 0 };
  nextItem();
}
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

function nextItem() {
  const n = N;
  const m = n.queue[n.idx];
  if (!m) {
    $('#nb-status', n.root).textContent = n.done ? `Séance terminée : ${n.ok}/${n.done}` : 'Rien à revoir pour le moment.';
    $('#nb-sub', n.root).textContent = n.done ? 'Les exercices ratés reviendront plus tôt ; ceux réussis s\'espacent.' : '';
    $('#nb-actions', n.root).innerHTML = `<a class="btn primary" href="#/carnet">Retour au carnet</a><a class="btn" href="#/problemes">Faire des problèmes</a>`;
    n.board.setMovable(null);
    return;
  }
  n.cur = m; n.answered = false;
  const c = new Chess(m.fen);
  n.chess = c;
  n.board.setOrientation(c.turn());
  n.board.setArrows([]); n.board.setMarks({});
  n.board.setPosition(m.fen, { animate: false, check: checkSquare(c) });
  n.board.setDests(destsFor(c));
  n.board.setMovable(c.turn());
  $('#nb-meta', n.root).textContent = `${n.idx + 1} / ${n.queue.length} · ${CATEGORIES[m.category] || ''}`;
  $('#nb-status', n.root).className = 'status';
  $('#nb-status', n.root).textContent = `Trouve mieux que ${sanFr(m.playedSan)}`;
  $('#nb-sub', n.root).innerHTML = `Dans ta partie contre ${esc(m.opponent || '?')}, tu as joué <b>${esc(sanFr(m.playedSan))}</b> (${LABELS[m.label]?.name.toLowerCase()}). Trait aux ${c.turn() === 'w' ? 'Blancs' : 'Noirs'}.`;
  $('#nb-actions', n.root).innerHTML = `<button class="btn ghost" id="nb-show">Je ne trouve pas</button><button class="btn ghost" id="nb-skip">Passer</button>`;
  $('#nb-coach', n.root).innerHTML = '';
  $('#nb-show', n.root).onclick = () => conclude(false, null);
  $('#nb-skip', n.root).onclick = () => { n.idx++; nextItem(); };
}

async function attempt(from, to, promotion) {
  const n = N;
  if (!n || n.answered) return false;
  const m = n.cur;
  const test = new Chess(m.fen);
  let mv;
  try { mv = test.move({ from, to, promotion }); } catch { return false; }
  const uci = moveToUci(mv);
  n.board.setMovable(null);
  moveSound(mv, test);
  n.board.setPosition(test.fen(), { lastMove: [from, to], check: checkSquare(test) });
  if (uci === m.best || test.isCheckmate()) { conclude(true, mv.san); return true; }
  if (uci === m.played) { conclude(false, mv.san, 'C\'est le même coup que dans ta partie.'); return true; }
  $('#nb-status', n.root).textContent = 'Vérification…';
  const [rb, ra] = [await engine.analyse(m.fen, { depth: 12 }), await engine.analyse(test.fen(), { depth: 12 })];
  if (N !== n) return true;
  const wb = lineWin(rb?.lines[0]), wa = 100 - lineWin(ra?.lines[0]);
  if (wb - wa < 6) conclude(true, mv.san, 'Pas le coup du moteur, mais tout aussi bon.');
  else conclude(false, mv.san);
  return true;
}

function conclude(success, san, note) {
  const n = N, m = n.cur;
  n.answered = true;
  n.done++; if (success) n.ok++;
  reviewMistake(m.id, success);
  sound(success ? 'good' : 'bad');
  const st = $('#nb-status', n.root);
  st.className = 'status ' + (success ? 'good' : 'bad');
  st.textContent = success ? 'Bien joué !' : san ? `${sanFr(san)} ne suffit pas.` : 'Voici la solution.';
  const line = numberedSan(m.fen, pvToSan(m.fen, m.pv, 6).map(sanFr));
  $('#nb-sub', n.root).innerHTML = `${note ? esc(note) + '<br>' : ''}Meilleur : <b>${esc(sanFr(m.bestSan))}</b> — ${esc(line)}`;
  n.board.setArrows([{ from: m.best.slice(0, 2), to: m.best.slice(2, 4), kind: 'best' }, { from: m.played.slice(0, 2), to: m.played.slice(2, 4), kind: 'bad' }]);
  n.board.setPosition(m.fen, { check: checkSquare(new Chess(m.fen)) });
  n.board.setMovable(null);
  $('#nb-actions', n.root).innerHTML = `<button class="btn primary" id="nb-next">Suivant</button><button class="btn" id="nb-ex">Expliquer</button><a class="btn ghost" href="#/analyse?game=${m.gameId}">Voir la partie</a>`;
  $('#nb-next', n.root).onclick = () => { n.idx++; nextItem(); };
  $('#nb-ex', n.root).onclick = () => explain(m);
}

async function explain(m) {
  const box = $('#nb-coach', N.root);
  if (!hasKey()) { box.innerHTML = '<div class="coach">Pour une explication rédigée, choisis ton professeur IA et ajoute ta clé dans les réglages (⚙︎ → Professeur IA).</div>'; return; }
  box.innerHTML = '<div class="coach loading">Caïssa réfléchit…</div>';
  const turn = m.fen.split(' ')[1];
  const after = new Chess(m.fen); uciToMove(after, m.played);
  const r = await engine.analyse(after.fen(), { depth: 12 });
  try {
    const txt = await askClaude(explainMovePrompt({
      fen: m.fen, turn, side: turn, playedSan: sanFr(m.playedSan),
      evalAfter: r?.lines[0] ? formatEval(r.lines[0], true, after.turn()) + ' (point de vue des Blancs)' : 'inconnue',
      label: LABELS[m.label]?.name || 'erreur',
      bestLine: numberedSan(m.fen, pvToSan(m.fen, m.pv, 6).map(sanFr)), evalBest: 'nettement meilleure',
      refutation: r?.lines[0]?.pv ? numberedSan(after.fen(), pvToSan(after.fen(), r.lines[0].pv, 6).map(sanFr)) : '',
      category: CATEGORIES[m.category],
    }));
    box.innerHTML = `<div class="coach">${esc(txt)}</div>`;
  } catch (e) { box.innerHTML = `<div class="coach">${esc(e.message)}</div>`; }
}
