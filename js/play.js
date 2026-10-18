// Parties contre Stockfish « humanisé », pendule, routine anti-gaffe et filet.
import { Board } from './board.js';
import { Chess, $, esc, uciToMove, moveToUci, destsFor, checkSquare, sound, moveSound, toast, modal, confirmDialog, fmtClock, sanFr, materialBalance } from './util.js';
import { store, settings } from './store.js';
import { engine, lineValue, lineWin } from './engine.js';
import { gameFromChess, saveGame } from './games.js';

export const LEVELS = [
  { name: 'Débutant', elo: '≈ 600', depth: 3, mpv: 8, T: 260 },
  { name: 'Novice', elo: '≈ 800', depth: 4, mpv: 7, T: 170 },
  { name: 'Club débutant', elo: '≈ 1000', depth: 5, mpv: 6, T: 115 },
  { name: 'Club', elo: '≈ 1200', depth: 6, mpv: 5, T: 80 },
  { name: 'Club confirmé', elo: '≈ 1400', depth: 8, mpv: 4, T: 52 },
  { name: 'Fort', elo: '≈ 1600', depth: 10, mpv: 4, T: 32 },
  { name: 'Expert', elo: '≈ 1800', depth: 12, mpv: 3, T: 18 },
  { name: 'Maître', elo: '2000 +', depth: 15, mpv: 1, T: 0 },
];
const CADENCES = [
  { id: 'none', label: 'Sans pendule', base: 0, inc: 0 },
  { id: '15+10', label: '15 + 10', base: 15 * 60000, inc: 10000 },
  { id: '10+0', label: '10 min', base: 10 * 60000, inc: 0 },
  { id: '5+3', label: '5 + 3', base: 5 * 60000, inc: 3000 },
];
const GUARDS = [
  { id: 'none', label: 'Aucun' },
  { id: 'routine', label: 'Routine' },
  { id: 'filet', label: 'Filet anti-gaffe' },
];

function prefs() { return { level: 3, color: 'w', cadence: '15+10', guard: 'filet', takeback: true, ...store.get('playPrefs', {}) }; }

let S = null; // état de la partie en cours

export function mount(root, params = {}) {
  const saved = store.get('currentGame');
  if (saved && !params.new) startGame(root, saved);
  else renderSetup(root);
}
export function unmount() {
  if (S) { clearInterval(S.timer); persist(); engine.cancelAll(); }
  S = null;
}

// --- écran de réglage -------------------------------------------------------------
function renderSetup(root) {
  const p = prefs();
  root.innerHTML = `
  <div class="stack" style="max-width:560px;margin:0 auto">
    <div>
      <h2>Nouvelle partie</h2>
      <p class="muted">Un adversaire qui joue « humain » : il choisit parmi plusieurs coups plausibles et peut se tromper, comme un joueur de ton niveau.</p>
    </div>
    <div class="card stack">
      <div>
        <div class="row between"><b>Adversaire</b><span class="badge" id="lv-label"></span></div>
        <input type="range" min="1" max="${LEVELS.length}" step="1" value="${p.level}" id="lv" style="margin-top:10px">
        <p class="muted small" style="margin:4px 0 0">Les Elo sont indicatifs. Commence vers ton niveau et monte quand tu gagnes 2 parties sur 3.</p>
      </div>
      <div><b>Tu joues</b><div class="seg" id="col" style="margin-top:8px">
        ${[['w', 'Blancs'], ['r', 'Au hasard'], ['b', 'Noirs']].map(([v, l]) => `<button data-v="${v}" class="${p.color === v ? 'on' : ''}">${l}</button>`).join('')}</div></div>
      <div><b>Cadence</b><div class="seg" id="cad" style="margin-top:8px">
        ${CADENCES.map(c => `<button data-v="${c.id}" class="${p.cadence === c.id ? 'on' : ''}">${c.label}</button>`).join('')}</div>
        <p class="muted small" style="margin:6px 0 0">Avec la pendule, tu t'habitues à la pression du temps, comme face à un humain.</p></div>
      <div><b>Garde-fou</b><div class="seg" id="grd" style="margin-top:8px">
        ${GUARDS.map(g => `<button data-v="${g.id}" class="${p.guard === g.id ? 'on' : ''}">${g.label}</button>`).join('')}</div>
        <p class="muted small" id="grd-help" style="margin:6px 0 0"></p></div>
      <label class="switch"><span>Autoriser la reprise de coup</span><input type="checkbox" id="tb" ${p.takeback ? 'checked' : ''}></label>
      <button class="btn primary block" id="go">Commencer la partie</button>
    </div>
  </div>`;
  const lv = $('#lv', root);
  const upd = () => { const L = LEVELS[lv.value - 1]; $('#lv-label', root).textContent = `${lv.value} · ${L.name} (${L.elo})`; };
  lv.oninput = upd; upd();
  const helps = {
    none: 'Aucune aide : conditions réelles.',
    routine: 'Avant chaque coup, une fiche te rappelle de vérifier échecs, prises et menaces. Idéal pour installer le réflexe.',
    filet: 'Stockfish vérifie ton coup en silence : s\'il perd gros, l\'appli te prévient sans te donner la solution. Tu peux jouer quand même.',
  };
  const seg = (id, key) => $(id, root).addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    $(id, root).querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    if (key === 'guard') $('#grd-help', root).textContent = helps[b.dataset.v];
  });
  seg('#col'); seg('#cad'); seg('#grd', 'guard');
  $('#grd-help', root).textContent = helps[p.guard];
  $('#go', root).onclick = () => {
    const np = {
      level: +lv.value,
      color: $('#col .on', root).dataset.v,
      cadence: $('#cad .on', root).dataset.v,
      guard: $('#grd .on', root).dataset.v,
      takeback: $('#tb', root).checked,
    };
    store.set('playPrefs', np);
    const you = np.color === 'r' ? (Math.random() < .5 ? 'w' : 'b') : np.color;
    const cad = CADENCES.find(c => c.id === np.cadence);
    startGame(root, { prefs: np, you, startFen: new Chess().fen(), moves: [], clocks: cad.base ? { w: cad.base, b: cad.base } : null, created: Date.now(), netUsed: 0 });
  };
}

// --- partie ----------------------------------------------------------------------
function startGame(root, g) {
  const L = LEVELS[g.prefs.level - 1];
  const cad = CADENCES.find(c => c.id === g.prefs.cadence) || CADENCES[0];
  const s = settings.get();
  root.innerHTML = `
  <div class="split">
    <div class="board-col">
      <div class="player" id="pl-top"><span class="dotc ${g.you === 'w' ? 'b' : 'w'}"></span><span class="name"><span>Caïssa · ${esc(L.name)} (${L.elo})</span><span class="captured" id="mat-top"></span></span><span class="clock ${cad.base ? '' : 'hidden'}" id="clk-top"></span></div>
      <div class="board-area"><div class="board-wrap"><div id="pl-board"></div></div></div>
      <div class="player" id="pl-bot"><span class="dotc ${g.you}"></span><span class="name"><span>${esc(s.playerName || 'Moi')}</span><span class="captured" id="mat-bot"></span></span><span class="clock ${cad.base ? '' : 'hidden'}" id="clk-bot"></span></div>
    </div>
    <div class="side stack">
      <div class="card">
        <div class="status" id="pl-status">…</div>
        <p class="muted small" id="pl-sub" style="margin:6px 0 0"></p>
        <div class="toolbar" style="margin-top:12px;justify-content:flex-start">
          <button class="btn sm" id="pl-undo" ${g.prefs.takeback ? '' : 'hidden'}>Reprendre</button>
          <button class="btn sm" id="pl-flip">Retourner</button>
          <button class="btn sm" id="pl-draw">Nulle ?</button>
          <button class="btn sm danger" id="pl-resign">Abandonner</button>
        </div>
      </div>
      <div class="card"><div class="row between" style="margin-bottom:6px"><h3>Coups</h3><span class="muted small">${cad.label}${g.prefs.guard !== 'none' ? ' · ' + GUARDS.find(x => x.id === g.prefs.guard).label : ''}</span></div><div class="moves" id="pl-moves"></div></div>
    </div>
  </div>`;
  const chess = new Chess(g.startFen);
  for (const u of g.moves) uciToMove(chess, u);
  const board = new Board($('#pl-board', root), { orientation: g.you, coords: s.coords, onMove: (f, t, p) => userMove(f, t, p) });
  S = { root, g, chess, board, L, cad, over: false, thinking: false, pending: false, timer: null, turnStart: performance.now() };
  sync(false);
  $('#pl-flip', root).onclick = () => board.flip();
  $('#pl-resign', root).onclick = async () => { if (S.over) return; if (await confirmDialog('Abandonner ?', 'La partie sera enregistrée comme perdue. Tu pourras l\'analyser.', 'Abandonner')) endGame(S.g.you === 'w' ? '0-1' : '1-0', 'Abandon'); };
  $('#pl-draw', root).onclick = offerDraw;
  $('#pl-undo', root).onclick = takeback;
  S.timer = setInterval(tick, 100);
  if (chess.isGameOver()) { store.del('currentGame'); renderSetup(root); return; }
  if (chess.turn() !== g.you) botMove();
}

function persist() {
  if (!S || S.over) return;
  const g = S.g;
  if (g.clocks && !S.over) {
    const c = { ...g.clocks };
    c[S.chess.turn()] -= performance.now() - S.turnStart;
    store.set('currentGame', { ...g, clocks: c });
  } else store.set('currentGame', g);
}

function sync(animate = true) {
  const { chess, board, g } = S;
  const hist = chess.history({ verbose: true });
  const last = hist[hist.length - 1];
  board.setPosition(chess.fen(), { lastMove: last ? [last.from, last.to] : null, check: checkSquare(chess), animate });
  board.setDests(destsFor(chess));
  board.setMovable(!S.over && chess.turn() === g.you && !S.thinking ? g.you : null);
  // matériel
  const bal = materialBalance(chess) * (g.you === 'w' ? 1 : -1);
  $('#mat-bot', S.root).textContent = bal > 0 ? `+${bal}` : '';
  $('#mat-top', S.root).textContent = bal < 0 ? `+${-bal}` : '';
  // liste des coups
  const el = $('#pl-moves', S.root);
  let h = '';
  hist.forEach((m, i) => {
    if (m.color === 'w') h += `<span class="n">${Math.floor(i / 2) + 1}.</span>`;
    else if (i === 0) h += `<span class="n">1.</span><span class="mv">…</span>`;
    h += `<span class="mv ${i === hist.length - 1 ? 'on' : ''}">${sanFr(m.san)}</span>`;
  });
  el.innerHTML = h || '<span class="muted small" style="grid-column:1/-1">La partie commence.</span>';
  el.scrollTop = el.scrollHeight;
  status();
  renderClocks();
}

function status(extra) {
  const { chess, g } = S;
  let t, sub = extra || '';
  if (S.over) t = S.overText;
  else if (S.thinking) t = 'Caïssa réfléchit…';
  else if (chess.turn() === g.you) {
    t = chess.inCheck() ? 'Échec ! À toi de jouer.' : 'À toi de jouer.';
    if (!sub && g.prefs.guard === 'routine') sub = 'Échecs · Prises · Menaces — puis joue.';
  } else t = '…';
  $('#pl-status', S.root).textContent = t;
  $('#pl-sub', S.root).textContent = sub;
}

// --- pendule ------------------------------------------------------------------------
function renderClocks() {
  if (!S?.g.clocks) return;
  const { g, chess } = S;
  const now = performance.now();
  const cur = { ...g.clocks };
  if (!S.over && chess.history().length >= (g.startFen === new Chess().fen() ? 0 : 0)) cur[chess.turn()] -= now - S.turnStart;
  const you = g.you, bot = you === 'w' ? 'b' : 'w';
  const set = (id, col) => {
    const el = $(id, S.root);
    el.textContent = fmtClock(cur[col]);
    el.classList.toggle('run', !S.over && chess.turn() === col);
    el.classList.toggle('low', cur[col] < 30000);
  };
  set('#clk-bot', you); set('#clk-top', bot);
  return cur;
}
function tick() {
  if (!S || S.over || !S.g.clocks) return;
  const cur = renderClocks();
  const t = S.chess.turn();
  if (cur[t] <= 0) {
    S.g.clocks[t] = 0;
    const winner = t === 'w' ? 'b' : 'w';
    const res = insufficientFor(winner) ? '1/2-1/2' : winner === 'w' ? '1-0' : '0-1';
    endGame(res, 'Temps écoulé');
  }
}
function insufficientFor(color) {
  const pcs = S.chess.board().flat().filter(p => p && p.color === color && p.type !== 'k');
  return pcs.length === 0 || (pcs.length === 1 && (pcs[0].type === 'n' || pcs[0].type === 'b'));
}
function pressClock() {
  const { g, chess } = S;
  if (!g.clocks) return;
  const mover = chess.turn() === 'w' ? 'b' : 'w'; // appelé après le coup
  g.clocks[mover] -= performance.now() - S.turnStart;
  g.clocks[mover] += S.cad.inc;
  S.turnStart = performance.now();
}

// --- coups du joueur -----------------------------------------------------------------
async function userMove(from, to, promotion) {
  if (!S || S.over || S.pending || S.chess.turn() !== S.g.you) return false;
  const test = new Chess(S.chess.fen());
  let m;
  try { m = test.move({ from, to, promotion }); } catch { return false; }
  S.pending = true;
  try {
    const guard = S.g.prefs.guard;
    if (guard === 'routine') {
      const ok = await routineCheck(m);
      if (!ok) { sync(false); return false; }
    } else if (guard === 'filet') {
      const ok = await safetyNet(test, m);
      if (!ok) { sync(false); return false; }
    }
    if (!S || S.over) return false;
    S.chess.move({ from, to, promotion });
    S.g.moves.push(moveToUci(m));
    pressClock();
    moveSound(m, S.chess);
    sync();
    persist();
    if (checkEnd()) return true;
    botMove();
    return true;
  } finally { if (S) S.pending = false; }
}

function routineCheck(m) {
  return new Promise(resolve => {
    modal(`<h3>Avant de jouer ${esc(sanFr(m.san))}</h3>
      <ul class="checklist">
        <li><b>1</b><span><b style="font-size:15px;font-family:var(--sans);color:var(--text)">Échecs</b> — l'adversaire peut-il me mettre en échec après ce coup ? Et moi ?</span></li>
        <li><b>2</b><span><b style="font-size:15px;font-family:var(--sans);color:var(--text)">Prises</b> — quelles pièces peuvent être prises ? La pièce que je bouge est-elle défendue sur sa case ?</span></li>
        <li><b>3</b><span><b style="font-size:15px;font-family:var(--sans);color:var(--text)">Menaces</b> — que voulait faire l'adversaire avec son dernier coup ? Est-ce que je l'arrête ?</span></li>
      </ul>
      <div class="row end"><button class="btn ghost" data-a="no">Je change</button><button class="btn primary" data-a="yes">C'est vérifié, je joue</button></div>`,
    { dismissable: false, onMount: (el, close) => {
      el.querySelector('[data-a=yes]').onclick = () => { close(); resolve(true); };
      el.querySelector('[data-a=no]').onclick = () => { close(); resolve(false); };
    } });
  });
}

async function safetyNet(after, m) {
  status('Vérification du coup…');
  const before = S.chess.fen();
  const [rb, ra] = [await engine.analyse(before, { depth: 10 }), after.isGameOver() ? null : await engine.analyse(after.fen(), { depth: 10 })];
  if (!S) return false;
  if (after.isCheckmate()) return true;
  const wb = lineWin(rb?.lines[0]);
  const wa = ra ? 100 - lineWin(ra.lines[0]) : 50;
  const drop = wb - wa;
  if (drop < 18 || wa > 80) { status(); return true; }
  S.g.netUsed = (S.g.netUsed || 0) + 1;
  const reply = ra?.lines[0]?.move;
  const mateAgainst = ra?.lines[0]?.mate > 0;
  const play = await confirmDialog('Attention !',
    `<p>${mateAgainst ? 'Après <b>' + esc(sanFr(m.san)) + '</b>, l\'adversaire a un <b>mat forcé</b>.' : 'Le coup <b>' + esc(sanFr(m.san)) + '</b> semble perdre beaucoup (matériel ou position).'}</p>
     <p class="muted">Refais la routine : quelles pièces adverses attaquent la case d'arrivée ? Que peut prendre l'adversaire ?</p>`,
    'Jouer quand même', 'Réfléchir encore');
  if (!S) return false;
  status();
  if (!play && reply) toast('Indice : regarde la case ' + reply.slice(2, 4) + '…', 3200);
  return play;
}

// --- coups de Caïssa ---------------------------------------------------------------
async function botMove() {
  if (!S || S.over) return;
  const s = S;
  s.thinking = true;
  sync(false);
  const t0 = performance.now();
  const fen = s.chess.fen();
  const r = await engine.analyse(fen, { depth: s.L.depth, multipv: s.L.mpv });
  if (S !== s || s.over || !r) { if (S === s) s.thinking = false; return; }
  const uci = chooseMove(r, s.L);
  // délai « humain »
  let think = 350 + Math.random() * 900;
  if (s.g.clocks) {
    const left = s.g.clocks[s.chess.turn()] - (performance.now() - s.turnStart);
    think = Math.min(think + Math.min(left / 80, 2500) * Math.random(), left / 10);
  }
  const wait = Math.max(0, think - (performance.now() - t0));
  await new Promise(res => setTimeout(res, wait));
  if (S !== s || s.over) return;
  const m = uciToMove(s.chess, uci);
  s.thinking = false;
  if (!m) { sync(); return; }
  s.g.moves.push(moveToUci(m));
  pressClock();
  moveSound(m, s.chess);
  sync();
  persist();
  checkEnd();
}

function chooseMove(r, L) {
  const lines = r.lines.filter(l => l.move);
  if (!lines.length) return r.best;
  if (L.T === 0 || lines.length === 1) return lines[0].move;
  const top = lines[0];
  if (top.mate != null && top.mate > 0 && top.mate <= 2 && Math.random() < 0.6 + 0.05 * LEVELS.indexOf(L)) return top.move;
  const best = lineValue(top);
  const w = lines.map(l => Math.exp(-Math.max(0, best - lineValue(l)) / L.T));
  let x = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < lines.length; i++) { x -= w[i]; if (x <= 0) return lines[i].move; }
  return top.move;
}

// --- fin de partie ---------------------------------------------------------------------
function checkEnd() {
  const c = S.chess;
  if (!c.isGameOver()) return false;
  if (c.isCheckmate()) endGame(c.turn() === 'w' ? '0-1' : '1-0', 'Échec et mat');
  else if (c.isStalemate()) endGame('1/2-1/2', 'Pat');
  else if (c.isThreefoldRepetition()) endGame('1/2-1/2', 'Répétition');
  else if (c.isInsufficientMaterial()) endGame('1/2-1/2', 'Matériel insuffisant');
  else endGame('1/2-1/2', 'Règle des 50 coups');
  return true;
}

async function offerDraw() {
  if (!S || S.over) return;
  if (S.chess.history().length < 30) { toast('Caïssa refuse : c\'est trop tôt pour une nulle.'); return; }
  const r = await engine.analyse(S.chess.fen(), { depth: 10 });
  if (!S) return;
  const v = lineValue(r?.lines[0]) * (S.chess.turn() === S.g.you ? 1 : -1);
  if (Math.abs(v) <= 40) endGame('1/2-1/2', 'Nulle acceptée');
  else toast(v > 0 ? 'Caïssa refuse : tu es mieux, joue pour gagner !' : 'Caïssa refuse la nulle et continue.');
}

async function takeback() {
  if (!S || S.over || !S.g.prefs.takeback) return;
  engine.cancelAll();
  const { chess, g } = S;
  let n = 0;
  if (chess.turn() !== g.you && chess.history().length) { chess.undo(); n++; }
  else if (chess.history().length >= 2) { chess.undo(); chess.undo(); n += 2; }
  else return;
  g.moves.splice(g.moves.length - n, n);
  S.thinking = false;
  S.turnStart = performance.now();
  g.takebacks = (g.takebacks || 0) + 1;
  sync();
  persist();
  if (chess.turn() !== g.you) botMove();
}

function endGame(result, reason) {
  const s = S;
  if (!s || s.over) return;
  s.over = true;
  engine.cancelAll();
  clearInterval(s.timer);
  renderClocks();
  const g = s.g;
  const win = (result === '1-0' && g.you === 'w') || (result === '0-1' && g.you === 'b');
  const draw = result === '1/2-1/2';
  s.overText = `${win ? 'Victoire' : draw ? 'Nulle' : 'Défaite'} — ${reason}`;
  sound('end');
  const name = settings.get().playerName || 'Moi';
  const bot = `Caïssa niv. ${g.prefs.level} (${s.L.elo})`;
  const rec = gameFromChess(s.chess, {
    white: g.you === 'w' ? name : bot, black: g.you === 'b' ? name : bot, result, you: g.you, source: 'caissa',
    event: `Partie contre Caïssa · ${s.cad.label}`, timeControl: s.cad.id, termination: reason,
  });
  rec.level = g.prefs.level; rec.netUsed = g.netUsed || 0; rec.takebacks = g.takebacks || 0;
  if (!rec.moves.length) { store.del('currentGame'); sync(); return; }
  saveGame(rec);
  store.del('currentGame');
  const st = store.get('playStats', { games: 0, wins: 0, draws: 0, losses: 0, byLevel: {} });
  st.games++; if (win) st.wins++; else if (draw) st.draws++; else st.losses++;
  const bl = st.byLevel[g.prefs.level] ||= { w: 0, d: 0, l: 0 };
  if (win) bl.w++; else if (draw) bl.d++; else bl.l++;
  store.set('playStats', st);
  sync();
  modal(`<div class="result-big" style="color:${win ? 'var(--good)' : draw ? 'var(--text)' : 'var(--bad)'}">${win ? 'Victoire' : draw ? 'Nulle' : 'Défaite'}</div>
    <p class="muted" style="text-align:center">${esc(reason)} · ${result}${rec.netUsed ? ` · filet utilisé ${rec.netUsed} fois` : ''}</p>
    <p style="text-align:center">${win ? 'Bien joué. Regarde quand même l\'analyse : les erreurs de l\'adversaire t\'apprennent aussi.' : 'L\'analyse va te montrer les moments clés et les ranger dans ton carnet d\'erreurs.'}</p>
    <div class="stack"><a class="btn primary block" href="#/analyse?game=${rec.id}&auto=1" data-close>Analyser la partie</a>
    <div class="grid2"><a class="btn" href="#/jouer?new=1" data-close>Nouvelle partie</a><button class="btn ghost" data-close>Fermer</button></div></div>`);
}
