import { Chess } from './lib/chess.js';
import { settings } from './store.js';

export { Chess };

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function uciToMove(chess, uci) {
  try {
    const mv = { from: uci.slice(0, 2), to: uci.slice(2, 4) };
    if (uci[4]) mv.promotion = uci[4];
    return chess.move(mv);
  }
  catch { return null; }
}
export function moveToUci(m) { return m.from + m.to + (m.promotion || ''); }

export function pvToSan(fen, pv, max = 8) {
  const c = new Chess(fen);
  const out = [];
  for (const u of pv.slice(0, max)) {
    const m = uciToMove(c, u);
    if (!m) break;
    out.push(m.san);
  }
  return out;
}
export function uciToSan(fen, uci) {
  const c = new Chess(fen);
  const m = uciToMove(c, uci);
  return m ? m.san : uci;
}
// Notation numérotée « 12. Cf3 Fg4 » à partir d'une position
export function numberedSan(fen, sans) {
  const parts = fen.split(' ');
  let n = +parts[5] || 1;
  let white = parts[1] === 'w';
  const out = [];
  sans.forEach((s, i) => {
    if (white) out.push(`${n}. ${s}`);
    else out.push(i === 0 ? `${n}… ${s}` : s);
    if (!white) n++;
    white = !white;
  });
  return out.join(' ');
}
// Conversion des initiales anglaises en notation française (R D T F C)
const FR = { K: 'R', Q: 'D', R: 'T', B: 'F', N: 'C' };
export function sanFr(san) {
  if (!san) return '';
  return san.replace(/^[KQRBN]/, p => FR[p]).replace(/=([QRBN])/, (_, p) => '=' + FR[p]);
}

export function kingSquare(chess, color) {
  for (const row of chess.board()) for (const p of row) if (p && p.type === 'k' && p.color === color) return p.square;
  return null;
}
export function checkSquare(chess) { return chess.inCheck() ? kingSquare(chess, chess.turn()) : null; }

export function destsFor(chess) {
  const map = {};
  for (const m of chess.moves({ verbose: true })) (map[m.from] ||= []).push(m.to);
  return sq => map[sq] || [];
}

const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
export function materialBalance(chess) {
  let s = 0;
  for (const row of chess.board()) for (const p of row) if (p) s += (p.color === 'w' ? 1 : -1) * VAL[p.type];
  return s;
}
export const PIECE_VAL = VAL;

// --- sons (synthétisés, aucun fichier) ------------------------------------
let actx;
export function sound(kind = 'move') {
  if (!settings.get().sound) return;
  try {
    actx ||= new (window.AudioContext || window.webkitAudioContext)();
    const t = actx.currentTime;
    const o = actx.createOscillator(), g = actx.createGain();
    const map = { move: [420, 0.05], capture: [260, 0.08], check: [640, 0.09], good: [880, 0.12], bad: [180, 0.18], end: [520, 0.25] };
    const [f, d] = map[kind] || map.move;
    o.type = kind === 'good' || kind === 'end' ? 'sine' : 'triangle';
    o.frequency.setValueAtTime(f, t);
    if (kind === 'good') o.frequency.exponentialRampToValueAtTime(1320, t + d);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(actx.destination);
    o.start(t); o.stop(t + d + 0.02);
  } catch { /* son indisponible */ }
}
export function moveSound(m, chess) {
  if (chess?.inCheck()) sound('check');
  else if (m?.captured) sound('capture');
  else sound('move');
}

// --- interface : toasts et fenêtres ----------------------------------------
export function toast(msg, ms = 2600) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, ms);
}

export function modal(html, { onMount, dismissable = true, wide = false } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'modal-wrap';
  wrap.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">${html}</div>`;
  document.body.appendChild(wrap);
  requestAnimationFrame(() => wrap.classList.add('show'));
  const close = () => { wrap.classList.remove('show'); setTimeout(() => wrap.remove(), 200); };
  if (dismissable) wrap.addEventListener('click', e => { if (e.target === wrap) close(); });
  wrap.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', close));
  onMount?.(wrap.firstElementChild, close);
  return close;
}

export function confirmDialog(title, body, okLabel = 'Valider', cancelLabel = 'Annuler') {
  return new Promise(resolve => {
    modal(`<h3>${title}</h3><div class="modal-body">${body}</div>
      <div class="row end"><button class="btn ghost" data-a="no">${cancelLabel}</button><button class="btn primary" data-a="yes">${okLabel}</button></div>`,
    { dismissable: false, onMount: (m, close) => {
      m.querySelector('[data-a=yes]').onclick = () => { close(); resolve(true); };
      m.querySelector('[data-a=no]').onclick = () => { close(); resolve(false); };
    } });
  });
}

export function fmtClock(ms) {
  ms = Math.max(0, ms);
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  if (ms < 10000) return `${m}:${String(s % 60).padStart(2, '0')}.${Math.floor((ms % 1000) / 100)}`;
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export function fmtDate(ts) {
  return new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}
