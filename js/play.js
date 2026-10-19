// Parties contre les personnages de Caïssa : mode entraînement (aides) ou classé (Elo),
// pendule, navigation dans les coups, indice, menaces, annulation, filet anti-gaffe.
import { Board } from './board.js';
import { Chess, $, esc, uciToMove, moveToUci, destsFor, checkSquare, sound, moveSound, toast, modal, confirmDialog, fmtClock, sanFr, materialBalance, pvToSan } from './util.js';
import { store, settings } from './store.js';
import { engine, lineValue, lineWin } from './engine.js';
import { gameFromChess, saveGame } from './games.js';
import { BOTS, botById, avatar, chooseMove, pick, paramsForElo, humanMove, humanParams } from './bots.js';
import { loadMaia, movePolicy } from './maia.js';
import { playerRating, applyResult, stakes } from './rating.js';

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
const OLD_LEVEL_ELO = [600, 800, 1000, 1200, 1400, 1600, 1800, 2000];
const PIECE_FR = { p: 'pion', n: 'cavalier', b: 'fou', r: 'tour', q: 'dame', k: 'roi' };
const COLOR_FR = { w: 'Blancs', b: 'Noirs' };

function prefs() {
  return { botId: 'victor', customElo: 1000, color: 'w', cadence: '15+10', mode: 'entrainement', guard: 'filet', ...store.get('playPrefs', {}) };
}
function migrate(g) {
  if (g.prefs && g.prefs.level && !g.prefs.botId) {
    g.prefs.botId = 'custom';
    g.prefs.customElo = OLD_LEVEL_ELO[g.prefs.level - 1] || 1000;
    g.prefs.mode = 'entrainement';
  }
  return g;
}
function botOf(p) { return botById(p.botId, p.customElo); }

let S = null;

export function mount(root, params = {}) {
  const saved = store.get('currentGame');
  if (saved && !params.new) startGame(root, migrate(saved));
  else renderSetup(root);
}
export function unmount() {
  if (S) { clearInterval(S.timer); persist(); engine.cancelAll(); if (S.keyHandler) document.removeEventListener('keydown', S.keyHandler); }
  S = null;
}

// --- réglage de la partie -----------------------------------------------------------
function renderSetup(root) {
  const p = prefs();
  const me = playerRating();
  const botStats = store.get('botStats', {});
  const rec = id => { const s = botStats[id]; return s ? `${s.w}V · ${s.d}N · ${s.l}D` : ''; };
  root.innerHTML = `
  <div class="stack" style="max-width:720px;margin:0 auto">
    <div class="row between" style="align-items:flex-end">
      <div><h2>Nouvelle partie</h2><p class="muted" style="margin:4px 0 0">Choisis ton adversaire. De 1100 à 1950, les personnages jouent avec <b>Maia</b>, une IA entraînée sur de vraies parties Lichess : ils jouent et se trompent comme des humains. Tous les Elo affichés ont été mesurés par des matchs entre personnages (échelle Lichess).</p></div>
      <div class="elo-chip"><span>Ton Elo</span><b>${me.elo}</b>${me.games < 10 ? '<em>provisoire</em>' : ''}</div>
    </div>
    <div class="bots" id="bots">
      ${BOTS.map(b => `<button class="bot ${p.botId === b.id ? 'on' : ''}" data-id="${b.id}">
        ${avatar(b, 42)}<span class="bot-t"><b>${esc(b.name)}</b><span class="bot-elo">${b.elo}</span></span>
        <span class="bot-bio">${esc(b.bio)}</span><span class="bot-kind ${b.maia ? 'human' : ''}">${b.maia ? 'Jeu humain · Maia' : b.elo >= 2500 ? 'Moteur Stockfish' : 'Stockfish bridé'}</span>${rec(b.id) ? `<span class="bot-rec">${rec(b.id)}</span>` : ''}</button>`).join('')}
      <button class="bot ${p.botId === 'custom' ? 'on' : ''}" data-id="custom">
        ${avatar(botById('custom'), 42)}<span class="bot-t"><b>Caïssa réglable</b><span class="bot-elo" id="cus-elo">${p.customElo}</span></span>
        <span class="bot-bio">Choisis exactement son niveau, de 150 à 1950 (jeu humain à partir de 1100).</span>${rec('custom') ? `<span class="bot-rec">${rec('custom')}</span>` : ''}</button>
    </div>
    <div class="card ${p.botId === 'custom' ? '' : 'hidden'}" id="cus-box">
      <div class="row between"><b>Niveau de Caïssa réglable</b><span class="badge" id="cus-lab">${p.customElo}</span></div>
      <input type="range" min="150" max="1950" step="50" value="${p.customElo}" id="cus" style="margin-top:10px">
    </div>
    <div class="card stack setup">
      <div><b>Tu joues</b><div class="seg" id="col" style="margin-top:8px">
        ${[['w', 'Blancs (tu commences)'], ['r', 'Au hasard'], ['b', 'Noirs']].map(([v, l]) => `<button data-v="${v}" class="${p.color === v ? 'on' : ''}">${l}</button>`).join('')}</div></div>
      <div><b>Cadence</b><div class="seg" id="cad" style="margin-top:8px">
        ${CADENCES.map(c => `<button data-v="${c.id}" class="${p.cadence === c.id ? 'on' : ''}">${c.label}</button>`).join('')}</div></div>
      <div><b>Mode</b><div class="seg" id="mode" style="margin-top:8px">
        <button data-v="entrainement" class="${p.mode === 'entrainement' ? 'on' : ''}">Entraînement</button>
        <button data-v="classee" class="${p.mode === 'classee' ? 'on' : ''}">Classée</button></div>
        <p class="muted small" id="mode-help" style="margin:6px 0 0"></p></div>
      <div id="guard-box"><b>Garde-fou</b><div class="seg" id="grd" style="margin-top:8px">
        ${GUARDS.map(g => `<button data-v="${g.id}" class="${p.guard === g.id ? 'on' : ''}">${g.label}</button>`).join('')}</div>
        <p class="muted small" id="grd-help" style="margin:6px 0 0"></p></div>
      <button class="btn primary block" id="go"></button>
    </div>
  </div>`;
  const sel = { botId: p.botId, customElo: p.customElo };
  const helps = {
    none: 'Aucune alerte : conditions réelles.',
    routine: 'Avant chaque coup, une fiche te rappelle de vérifier échecs, prises et menaces.',
    filet: 'Stockfish vérifie ton coup en silence : s\'il perd gros, l\'appli te prévient sans te donner la solution.',
  };
  const update = () => {
    const mode = $('#mode .on', root).dataset.v;
    const bot = botById(sel.botId, sel.customElo);
    $('#guard-box', root).classList.toggle('hidden', mode === 'classee');
    if (mode === 'classee') {
      const st = stakes(bot.elo);
      $('#mode-help', root).innerHTML = `Aucune aide. La partie compte pour ton Elo : <b class="good-t">+${st.win}</b> si tu gagnes, <b>${st.draw >= 0 ? '+' : ''}${st.draw}</b> en cas de nulle, <b class="bad-t">−${Math.abs(st.loss)}</b> si tu perds.`;
    } else {
      $('#mode-help', root).textContent = 'Tu peux annuler un coup, demander un indice ou voir les menaces adverses. Ton Elo ne bouge pas, mais le bilan estime quand même ton niveau sur la partie.';
    }
    $('#grd-help', root).textContent = helps[$('#grd .on', root).dataset.v];
    $('#go', root).textContent = `Jouer contre ${bot.custom ? 'Caïssa' : bot.name} (${bot.elo})`;
  };
  $('#bots', root).addEventListener('click', e => {
    const b = e.target.closest('.bot'); if (!b) return;
    sel.botId = b.dataset.id;
    root.querySelectorAll('.bot').forEach(x => x.classList.toggle('on', x === b));
    $('#cus-box', root).classList.toggle('hidden', sel.botId !== 'custom');
    update();
  });
  const cus = $('#cus', root);
  cus.oninput = () => { sel.customElo = +cus.value; $('#cus-lab', root).textContent = cus.value; $('#cus-elo', root).textContent = cus.value; update(); };
  for (const id of ['#col', '#cad', '#mode', '#grd']) $(id, root).addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    $(id, root).querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    update();
  });
  update();
  $('#go', root).onclick = () => {
    const np = {
      botId: sel.botId, customElo: sel.customElo,
      color: $('#col .on', root).dataset.v, cadence: $('#cad .on', root).dataset.v,
      mode: $('#mode .on', root).dataset.v, guard: $('#grd .on', root).dataset.v,
    };
    store.set('playPrefs', np);
    const you = np.color === 'r' ? (Math.random() < .5 ? 'w' : 'b') : np.color;
    const cad = CADENCES.find(c => c.id === np.cadence);
    const bot = botOf(np);
    startGame(root, { prefs: np, you, startFen: new Chess().fen(), moves: [], clocks: cad.base ? { w: cad.base, b: cad.base } : null,
      created: Date.now(), netUsed: 0, takebacks: 0, hints: 0, threats: 0, youElo: playerRating().elo, hello: pick(bot.hello) });
  };
}

// --- partie --------------------------------------------------------------------------
function startGame(root, g) {
  const bot = botOf(g.prefs);
  const cad = CADENCES.find(c => c.id === g.prefs.cadence) || CADENCES[0];
  const rated = g.prefs.mode === 'classee';
  const s = settings.get();
  const botSide = g.you === 'w' ? 'b' : 'w';
  root.innerHTML = `
  <div class="split">
    <div class="board-col">
      <div class="player" id="pl-top">${avatar(bot, 30)}<span class="name"><span>${esc(bot.custom ? 'Caïssa' : bot.name)} <span class="muted">(${bot.elo})</span> · ${COLOR_FR[botSide]}</span><span class="captured" id="mat-top"></span></span><span class="clock ${cad.base ? '' : 'hidden'}" id="clk-top"></span></div>
      <div class="board-area"><div class="board-wrap"><div id="pl-board"></div></div></div>
      <div class="player" id="pl-bot"><span class="dotc ${g.you}"></span><span class="name"><span>${esc(s.playerName || 'Moi')} <span class="muted">(${g.youElo || playerRating().elo})</span> · ${COLOR_FR[g.you]}</span><span class="captured" id="mat-bot"></span></span><span class="clock ${cad.base ? '' : 'hidden'}" id="clk-bot"></span></div>
      <div class="toolbar" id="pl-nav">
        <button class="btn sm" data-n="first" aria-label="Début">⏮</button><button class="btn sm" data-n="prev" aria-label="Coup précédent">◀</button>
        <button class="btn sm" data-n="next" aria-label="Coup suivant">▶</button><button class="btn sm" data-n="last" aria-label="Position actuelle">⏭</button>
        ${rated ? '' : `<button class="btn sm" id="pl-undo">↶ Annuler mon coup</button>`}
      </div>
      ${rated ? '' : `<div class="toolbar"><button class="btn sm" id="pl-hint">Indice</button><button class="btn sm" id="pl-threat">Menace adverse</button></div>`}
    </div>
    <div class="side stack">
      <div class="card">
        <div class="row between" style="margin-bottom:6px"><span class="badge ${rated ? 'bad' : ''}">${rated ? 'Partie classée' : 'Entraînement'}</span><span class="muted small">${cad.label}${!rated && g.prefs.guard !== 'none' ? ' · ' + GUARDS.find(x => x.id === g.prefs.guard).label : ''}</span></div>
        <div class="status" id="pl-status">…</div>
        <p class="small" id="pl-sub" style="margin:6px 0 0"></p>
        <div class="bubble-row">${avatar(bot, 24)}<span class="bubble" id="pl-say">${esc(g.hello || pick(bot.hello))}</span></div>
        <div class="toolbar" style="margin-top:12px;justify-content:flex-start">
          <button class="btn sm" id="pl-flip">Retourner</button>
          <button class="btn sm" id="pl-draw">Proposer nulle</button>
          <button class="btn sm danger" id="pl-resign">Abandonner</button>
        </div>
      </div>
      <div class="card"><div class="row between" style="margin-bottom:6px"><h3>Coups</h3><span class="muted small" id="pl-view"></span></div><div class="moves" id="pl-moves"></div></div>
    </div>
  </div>`;
  const chess = new Chess(g.startFen);
  for (const u of g.moves) uciToMove(chess, u);
  const board = new Board($('#pl-board', root), { orientation: g.you, onMove: (f, t, p) => userMove(f, t, p) });
  S = { root, g, chess, bot, cad, rated, over: false, thinking: false, pending: false, timer: null, turnStart: performance.now(), view: null, info: '' };
  S.board = board;
  sync(false);
  $('#pl-flip', root).onclick = () => board.flip();
  $('#pl-resign', root).onclick = async () => {
    if (S.over) return;
    if (await confirmDialog('Abandonner ?', `La partie sera enregistrée comme perdue${S.rated ? ' et comptera pour ton Elo' : ''}. Tu pourras l'analyser.`, 'Abandonner')) endGame(S.g.you === 'w' ? '0-1' : '1-0', 'Abandon');
  };
  $('#pl-draw', root).onclick = offerDraw;
  $('#pl-undo', root)?.addEventListener('click', takeback);
  $('#pl-hint', root)?.addEventListener('click', hint);
  $('#pl-threat', root)?.addEventListener('click', threat);
  $('#pl-nav', root).addEventListener('click', e => {
    const b = e.target.closest('[data-n]'); if (!b) return;
    const n = S.chess.history().length;
    const cur = S.view ?? n;
    const to = b.dataset.n === 'first' ? 0 : b.dataset.n === 'prev' ? Math.max(0, cur - 1) : b.dataset.n === 'next' ? Math.min(n, cur + 1) : n;
    browse(to);
  });
  $('#pl-moves', root).addEventListener('click', e => { const m = e.target.closest('[data-p]'); if (m) browse(+m.dataset.p); });
  S.keyHandler = e => {
    if (!S || e.target.closest('input,textarea')) return;
    const n = S.chess.history().length, cur = S.view ?? n;
    if (e.key === 'ArrowLeft') browse(Math.max(0, cur - 1));
    if (e.key === 'ArrowRight') browse(Math.min(n, cur + 1));
  };
  document.addEventListener('keydown', S.keyHandler);
  S.timer = setInterval(tick, 100);
  if (chess.isGameOver()) { store.del('currentGame'); renderSetup(root); return; }
  if (chess.turn() !== g.you) botMove();
}

function persist() {
  if (!S || S.over) return;
  const g = S.g;
  if (g.clocks) {
    const c = { ...g.clocks };
    c[S.chess.turn()] -= performance.now() - S.turnStart;
    store.set('currentGame', { ...g, clocks: c });
  } else store.set('currentGame', g);
}

// Affiche une position passée (lecture seule) ; null = position actuelle
function browse(ply) {
  if (!S) return;
  const n = S.chess.history().length;
  S.view = ply >= n ? null : ply;
  S.board.setArrows([]);
  sync();
}

function sync(animate = true) {
  const { chess, board, g } = S;
  const hist = chess.history({ verbose: true });
  const n = hist.length;
  const ply = S.view ?? n;
  let fen, last = null, inCheck = null;
  if (S.view == null) { fen = chess.fen(); const l = hist[n - 1]; if (l) last = [l.from, l.to]; inCheck = checkSquare(chess); }
  else {
    const c = new Chess(g.startFen);
    for (let i = 0; i < ply; i++) c.move(hist[i].san);
    fen = c.fen(); const l = hist[ply - 1]; if (l) last = [l.from, l.to]; inCheck = checkSquare(c);
  }
  board.setPosition(fen, { lastMove: last, check: inCheck, animate });
  board.setDests(destsFor(chess));
  board.setMovable(!S.over && S.view == null && chess.turn() === g.you && !S.thinking ? g.you : null);
  const bal = materialBalance(chess) * (g.you === 'w' ? 1 : -1);
  $('#mat-bot', S.root).textContent = bal > 0 ? `+${bal}` : '';
  $('#mat-top', S.root).textContent = bal < 0 ? `+${-bal}` : '';
  const el = $('#pl-moves', S.root);
  let h = '';
  hist.forEach((m, i) => {
    if (m.color === 'w') h += `<span class="n">${Math.floor(i / 2) + 1}.</span>`;
    else if (i === 0) h += `<span class="n">1.</span><span class="mv">…</span>`;
    h += `<span class="mv ${i === ply - 1 ? 'on' : ''}" data-p="${i + 1}">${sanFr(m.san)}</span>`;
  });
  el.innerHTML = h || '<span class="muted small" style="grid-column:1/-1">La partie commence.</span>';
  if (S.view == null) el.scrollTop = el.scrollHeight;
  $('#pl-view', S.root).innerHTML = S.view != null ? `<button class="btn sm" id="pl-back">Revenir à la partie</button>` : '';
  $('#pl-back', S.root)?.addEventListener('click', () => browse(n));
  status();
  renderClocks();
}

function moveLabel(m, idx) {
  const num = Math.floor(idx / 2) + 1;
  return `${num}${m.color === 'w' ? '.' : '…'} ${sanFr(m.san)}`;
}

function status(extra) {
  if (!S) return;
  const { chess, g, bot } = S;
  const hist = chess.history({ verbose: true });
  const last = hist[hist.length - 1];
  const who = bot.custom ? 'Caïssa' : bot.name;
  let t, sub = extra ?? S.info ?? '';
  if (S.view != null) {
    t = S.view === 0 ? 'Position de départ' : `Après ${moveLabel(hist[S.view - 1], S.view - 1)}`;
    sub = 'Tu regardes un coup précédent. Touche ⏭ pour revenir à la partie.';
  } else if (S.over) t = S.overText;
  else if (S.thinking) t = `${who} réfléchit…`;
  else if (chess.turn() === g.you) {
    const lastTxt = last ? `${who} a joué ${moveLabel(last, hist.length - 1)}` : '';
    t = chess.inCheck() ? `Échec ! ${lastTxt ? lastTxt + '. ' : ''}` : (lastTxt ? `${lastTxt}. À toi.` : `À toi de commencer (${COLOR_FR[g.you]}).`);
    if (chess.inCheck()) t += 'Protège ton roi.';
    if (!sub && last?.captured) sub = `${who} a pris ton ${PIECE_FR[last.captured]} en ${last.to}.`;
    if (!sub && g.prefs.guard === 'routine' && !S.rated) sub = 'Échecs · Prises · Menaces — puis joue.';
  } else t = '…';
  $('#pl-status', S.root).textContent = t;
  $('#pl-sub', S.root).textContent = sub || '';
}

// --- pendule ---------------------------------------------------------------------------
function renderClocks() {
  if (!S?.g.clocks) return;
  const { g, chess } = S;
  const cur = { ...g.clocks };
  if (!S.over) cur[chess.turn()] -= performance.now() - S.turnStart;
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
  const mover = chess.turn() === 'w' ? 'b' : 'w';
  g.clocks[mover] -= performance.now() - S.turnStart;
  g.clocks[mover] += S.cad.inc;
  S.turnStart = performance.now();
}

// --- coups du joueur ----------------------------------------------------------------------
async function userMove(from, to, promotion) {
  if (!S || S.over || S.pending || S.view != null || S.chess.turn() !== S.g.you) return false;
  const test = new Chess(S.chess.fen());
  let m;
  try { m = test.move({ from, to, promotion }); } catch { return false; }
  S.pending = true;
  try {
    if (!S.rated) {
      const guard = S.g.prefs.guard;
      if (guard === 'routine' && !(await routineCheck(m))) { sync(false); return false; }
      if (guard === 'filet' && !(await safetyNet(test, m))) { sync(false); return false; }
    }
    if (!S || S.over) return false;
    S.chess.move({ from, to, promotion });
    S.g.moves.push(moveToUci(m));
    S.info = '';
    S.board.setArrows([]);
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
        <li><b>1</b><span><strong>Échecs</strong> — l'adversaire peut-il me mettre en échec après ce coup ? Et moi ?</span></li>
        <li><b>2</b><span><strong>Prises</strong> — quelles pièces peuvent être prises ? La pièce que je bouge est-elle défendue en ${m.to} ?</span></li>
        <li><b>3</b><span><strong>Menaces</strong> — que voulait faire l'adversaire avec son dernier coup ? Est-ce que je l'arrête ?</span></li>
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
  const rb = await engine.analyse(before, { depth: 10 });
  const ra = after.isGameOver() ? null : await engine.analyse(after.fen(), { depth: 10 });
  if (!S) return false;
  if (after.isCheckmate()) return true;
  const wb = lineWin(rb?.lines[0]);
  const wa = ra ? 100 - lineWin(ra.lines[0]) : 50;
  if (wb - wa < 18 || wa > 80) { status(); return true; }
  S.g.netUsed = (S.g.netUsed || 0) + 1;
  const reply = ra?.lines[0]?.move;
  const mateAgainst = ra?.lines[0]?.mate > 0;
  const play = await confirmDialog('Attention !',
    `<p>${mateAgainst ? 'Après <b>' + esc(sanFr(m.san)) + '</b>, l\'adversaire a un <b>mat forcé</b>.' : 'Le coup <b>' + esc(sanFr(m.san)) + '</b> semble perdre beaucoup (matériel ou position).'}</p>
     <p class="muted">Refais la routine : quelles pièces adverses attaquent la case ${m.to} ? Que peut prendre l'adversaire ?</p>`,
    'Jouer quand même', 'Réfléchir encore');
  if (!S) return false;
  status();
  if (!play && reply) toast('Indice : regarde la case ' + reply.slice(2, 4) + '…', 3200);
  return play;
}

// --- aides (entraînement) -----------------------------------------------------------------
async function hint() {
  if (!S || S.over || S.view != null || S.thinking || S.chess.turn() !== S.g.you) return;
  const s = S;
  status('Recherche d\'un indice…');
  const r = await engine.analyse(s.chess.fen(), { depth: 13 });
  if (S !== s || !r?.best) return;
  s.g.hints = (s.g.hints || 0) + 1;
  const m = new Chess(s.chess.fen()).moves({ verbose: true }).find(x => x.from + x.to + (x.promotion || '') === r.best);
  s.board.setArrows([{ from: r.best.slice(0, 2), to: r.best.slice(2, 4), kind: 'hint' }]);
  s.info = m ? `Indice : joue ${m.piece === 'p' ? 'le pion' : 'ton ' + PIECE_FR[m.piece]} de ${m.from} en ${m.to}${sanFr(m.san) !== m.to ? ` (${sanFr(m.san)})` : ''}.` : '';
  status();
  persist();
}

async function threat() {
  if (!S || S.over || S.view != null || S.thinking || S.chess.turn() !== S.g.you) return;
  const s = S;
  if (s.chess.inCheck()) { s.info = 'Tu es en échec : la menace, c\'est sur ton roi !'; status(); return; }
  const parts = s.chess.fen().split(' ');
  parts[1] = parts[1] === 'w' ? 'b' : 'w'; parts[3] = '-';
  let opp;
  try { opp = new Chess(parts.join(' ')); } catch { return; }
  status('Je regarde ce que prépare l\'adversaire…');
  const r = await engine.analyse(opp.fen(), { depth: 12 });
  if (S !== s || !r?.best) return;
  s.g.threats = (s.g.threats || 0) + 1;
  const m = opp.moves({ verbose: true }).find(x => x.from + x.to + (x.promotion || '') === r.best);
  const l = r.lines[0];
  // gravité : comparer avec l'évaluation actuelle
  const cur = await engine.analyse(s.chess.fen(), { depth: 10 });
  if (S !== s) return;
  const gain = lineValue(l) + lineValue(cur?.lines[0]); // ce que gagnerait l'adversaire s'il rejouait
  let txt;
  if (l.mate != null && l.mate > 0) txt = `Menace de mat ! L'adversaire joue ${sanFr(m.san)} et mate en ${l.mate}.`;
  else if (m?.captured && gain > 120) txt = `Menace : ${sanFr(m.san)}, qui prend ton ${PIECE_FR[m.captured]} en ${m.to}.`;
  else if (gain > 150) txt = `Menace : ${sanFr(m.san)} (${PIECE_FR[m.piece]} ${m.from} → ${m.to}). Regarde ce que ce coup attaque.`;
  else txt = `Pas de menace immédiate. Son meilleur plan serait ${sanFr(m.san)}.`;
  const real = !txt.startsWith('Pas de menace');
  s.board.setArrows([{ from: r.best.slice(0, 2), to: r.best.slice(2, 4), kind: real ? 'bad' : 'hint' }]);
  s.info = txt;
  status();
  persist();
}

async function takeback() {
  if (!S || S.over) return;
  engine.cancelAll();
  const g = S.g;
  const t0 = g.startFen.split(' ')[1];
  const moverOf = k => (k % 2 === 0) === (t0 === 'w') ? 'w' : 'b';
  let k = g.moves.length - 1;
  while (k >= 0 && moverOf(k) !== g.you) k--;
  if (k < 0) { toast('Rien à annuler pour l\'instant.'); return; }
  g.moves = g.moves.slice(0, k);
  const c = new Chess(g.startFen);
  for (const u of g.moves) uciToMove(c, u);
  S.chess = c;
  S.token = (S.token || 0) + 1;
  S.thinking = false;
  S.view = null;
  S.info = 'Coup annulé. Prends le temps de faire la routine : échecs, prises, menaces.';
  S.turnStart = performance.now();
  g.takebacks = (g.takebacks || 0) + 1;
  S.board.setArrows([]);
  sync();
  persist();
}

// --- coups du personnage ------------------------------------------------------------------
async function botMove() {
  if (!S || S.over) return;
  const s = S;
  const token = s.token || 0;
  s.thinking = true;
  sync(false);
  const t0 = performance.now();
  const fen = s.chess.fen();
  let uci = null;
  if (s.bot.maia) {
    try {
      if (!s.maiaReady) status(`${s.bot.custom ? 'Caïssa' : s.bot.name} s'installe… (premier chargement, 1,7 Mo)`);
      if (S !== s) return;
      const level = s.bot.maia;
      const model = await loadMaia(humanParams(level).model);
      s.maiaReady = true;
      if (S !== s || s.over || (s.token || 0) !== token) return;
      await new Promise(r => setTimeout(r, 30)); // laisse l'écran se mettre à jour
      const fens = [s.g.startFen];
      const c = new Chess(s.g.startFen);
      for (const u of s.g.moves) { uciToMove(c, u); fens.push(c.fen()); }
      const pol = movePolicy(model, fens, s.g.startFen === new Chess().fen()).moves;
      uci = await humanMove(pol, level, async ucis => {
        const r = await engine.analyse(fen, { depth: 8, multipv: ucis.length, searchmoves: ucis });
        return r ? new Map(r.lines.map(l => [l.move, lineWin(l)])) : null;
      });
    } catch (e) { console.warn('Maia indisponible, repli sur Stockfish', e); }
  }
  if (!uci) {
    const P = paramsForElo(s.bot.engineElo ?? s.bot.elo);
    const r = await engine.analyse(fen, { depth: P.depth, multipv: P.mpv });
    if (S !== s || s.over || !r || (s.token || 0) !== token) return;
    uci = chooseMove(r, s.bot, fen);
  }
  if (S !== s || s.over || (s.token || 0) !== token) return;
  let think = 350 + Math.random() * 900;
  if (s.g.clocks) {
    const left = s.g.clocks[s.chess.turn()] - (performance.now() - s.turnStart);
    think = Math.min(think + Math.min(left / 80, 2500) * Math.random(), left / 10);
  }
  await new Promise(res => setTimeout(res, Math.max(0, think - (performance.now() - t0))));
  if (S !== s || s.over || (s.token || 0) !== token) return;
  const m = uciToMove(s.chess, uci);
  s.thinking = false;
  if (!m) { sync(); return; }
  s.g.moves.push(moveToUci(m));
  pressClock();
  moveSound(m, s.chess);
  s.view = null;
  sync();
  persist();
  checkEnd();
}

// --- fin de partie -----------------------------------------------------------------------
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
  const who = S.bot.custom ? 'Caïssa' : S.bot.name;
  if (S.chess.history().length < 30) { toast(`${who} refuse : c'est trop tôt pour une nulle.`); return; }
  const r = await engine.analyse(S.chess.fen(), { depth: 10 });
  if (!S) return;
  const v = lineValue(r?.lines[0]) * (S.chess.turn() === S.g.you ? 1 : -1);
  if (Math.abs(v) <= 40) endGame('1/2-1/2', 'Nulle acceptée');
  else toast(v > 0 ? `${who} refuse : tu es mieux, joue pour gagner !` : `${who} refuse la nulle et continue.`);
}

function endGame(result, reason) {
  const s = S;
  if (!s || s.over) return;
  s.over = true;
  s.view = null;
  engine.cancelAll();
  clearInterval(s.timer);
  renderClocks();
  const g = s.g, bot = s.bot;
  const win = (result === '1-0' && g.you === 'w') || (result === '0-1' && g.you === 'b');
  const draw = result === '1/2-1/2';
  s.overText = `${win ? 'Victoire' : draw ? 'Nulle' : 'Défaite'} — ${reason}`;
  sound('end');
  const say = pick(win ? bot.lose : draw ? bot.draw : bot.win);
  $('#pl-say', s.root).textContent = say;
  const name = settings.get().playerName || 'Moi';
  const botName = `${bot.custom ? 'Caïssa' : bot.name} (${bot.elo})`;
  const rec = gameFromChess(s.chess, {
    white: g.you === 'w' ? name : botName, black: g.you === 'b' ? name : botName, result, you: g.you, source: 'caissa',
    event: `Partie contre ${botName} · ${s.cad.label}`, timeControl: s.cad.id, termination: reason,
  });
  Object.assign(rec, { botId: bot.id, botElo: bot.elo, rated: s.rated, netUsed: g.netUsed || 0, takebacks: g.takebacks || 0, hints: g.hints || 0, threats: g.threats || 0 });
  store.del('currentGame');
  if (!rec.moves.length) { sync(); return; }
  let elo = null;
  if (s.rated) { elo = applyResult(bot.elo, win ? 1 : draw ? 0.5 : 0, { bot: bot.id }); rec.eloBefore = elo.before; rec.eloAfter = elo.after; }
  saveGame(rec);
  const st = store.get('playStats', { games: 0, wins: 0, draws: 0, losses: 0 });
  st.games++; if (win) st.wins++; else if (draw) st.draws++; else st.losses++;
  store.set('playStats', st);
  const bs = store.get('botStats', {});
  const b = bs[bot.id] ||= { w: 0, d: 0, l: 0 };
  if (win) b.w++; else if (draw) b.d++; else b.l++;
  store.set('botStats', bs);
  sync();
  const aids = [rec.takebacks && `${rec.takebacks} coup${rec.takebacks > 1 ? 's' : ''} annulé${rec.takebacks > 1 ? 's' : ''}`, rec.hints && `${rec.hints} indice${rec.hints > 1 ? 's' : ''}`, rec.netUsed && `filet ×${rec.netUsed}`].filter(Boolean).join(' · ');
  modal(`<div class="row" style="justify-content:center;gap:10px">${avatar(bot, 40)}<span class="bubble">${esc(say)}</span></div>
    <div class="result-big" style="color:${win ? 'var(--good)' : draw ? 'var(--text)' : 'var(--bad)'}">${win ? 'Victoire' : draw ? 'Nulle' : 'Défaite'}</div>
    <p class="muted" style="text-align:center;margin:0 0 10px">${esc(reason)} · ${result}${aids ? ' · ' + aids : ''}</p>
    ${elo ? `<div class="elo-change"><span>Ton Elo</span><b>${elo.before} → ${elo.after}</b><em class="${elo.delta >= 0 ? 'good-t' : 'bad-t'}">${elo.delta >= 0 ? '+' : ''}${elo.delta}</em></div>`
      : `<p class="small muted" style="text-align:center">Partie d'entraînement : ton Elo ne change pas. Le bilan va estimer ton niveau sur cette partie.</p>`}
    <div class="stack" style="margin-top:12px"><a class="btn primary block" href="#/analyse?game=${rec.id}&auto=1" data-close>Voir le bilan de la partie</a>
    <div class="grid2"><a class="btn" href="#/jouer?new=1" data-close>Nouvelle partie</a><button class="btn ghost" data-close>Fermer</button></div></div>`);
}

void pvToSan;
