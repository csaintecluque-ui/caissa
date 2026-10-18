// Échiquier tactile maison : sélection au toucher, glisser-déposer, promotion,
// animations, flèches et surbrillances. Aucune dépendance.
const FILES = 'abcdefgh';
const TYPES = { p: 'p', n: 'n', b: 'b', r: 'r', q: 'q', k: 'k' };

export function parseFenBoard(fen) {
  const rows = fen.split(' ')[0].split('/');
  const out = {};
  rows.forEach((row, r) => {
    let f = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) { f += +ch; continue; }
      const color = ch === ch.toUpperCase() ? 'w' : 'b';
      out[FILES[f] + (8 - r)] = color + ch.toLowerCase();
      f++;
    }
  });
  return out;
}

export class Board {
  constructor(el, opts = {}) {
    this.el = el;
    this.orientation = opts.orientation || 'w';
    this.onMove = opts.onMove || (() => false);
    this.destsFn = opts.dests || (() => []);
    this.movable = opts.movable ?? null; // 'w' | 'b' | 'both' | null
    this.coords = opts.coords !== false;
    this.pieces = {}; // square -> code
    this.els = new Map(); // element -> {code, sq}
    this.selected = null;
    this.lastMove = null;
    this.check = null;
    this.arrows = [];
    this.marks = {};
    this.build();
  }

  build() {
    this.el.classList.add('board');
    this.el.innerHTML = `
      <div class="b-squares"></div>
      <div class="b-hl"></div>
      <div class="b-pieces"></div>
      <svg class="b-arrows" viewBox="0 0 8 8" aria-hidden="true">
        <defs>
          <marker id="ah-best" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="2.6" markerHeight="2.6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="var(--arrow-best)"/></marker>
          <marker id="ah-bad" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="2.6" markerHeight="2.6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="var(--arrow-bad)"/></marker>
          <marker id="ah-hint" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="2.6" markerHeight="2.6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="var(--arrow-hint)"/></marker>
        </defs>
        <g class="arrows"></g>
      </svg>
      <div class="b-coords"></div>
      <div class="b-promo" hidden></div>`;
    this.hl = this.el.querySelector('.b-hl');
    this.piecesLayer = this.el.querySelector('.b-pieces');
    this.arrowsG = this.el.querySelector('.arrows');
    this.coordsEl = this.el.querySelector('.b-coords');
    this.promoEl = this.el.querySelector('.b-promo');
    this.el.addEventListener('pointerdown', e => this.pointerDown(e));
    this.el.addEventListener('pointermove', e => this.pointerMove(e));
    this.el.addEventListener('pointerup', e => this.pointerUp(e));
    this.el.addEventListener('pointercancel', () => this.cancelDrag());
    this.el.addEventListener('contextmenu', e => e.preventDefault());
    this.renderCoords();
  }

  // --- géométrie ---------------------------------------------------------
  xy(sq) {
    const f = FILES.indexOf(sq[0]), r = +sq[1] - 1;
    return this.orientation === 'w' ? [f, 7 - r] : [7 - f, r];
  }
  sqAt(clientX, clientY) {
    const rect = this.el.getBoundingClientRect();
    const x = Math.floor(((clientX - rect.left) / rect.width) * 8);
    const y = Math.floor(((clientY - rect.top) / rect.height) * 8);
    if (x < 0 || x > 7 || y < 0 || y > 7) return null;
    const f = this.orientation === 'w' ? x : 7 - x;
    const r = this.orientation === 'w' ? 7 - y : y;
    return FILES[f] + (r + 1);
  }
  place(node, sq) {
    const [x, y] = this.xy(sq);
    node.style.transform = `translate(${x * 100}%, ${y * 100}%)`;
  }

  renderCoords() {
    if (!this.coords) { this.coordsEl.innerHTML = ''; return; }
    let h = '';
    for (let i = 0; i < 8; i++) {
      const file = this.orientation === 'w' ? FILES[i] : FILES[7 - i];
      const rank = this.orientation === 'w' ? 8 - i : i + 1;
      h += `<span class="cf ${i % 2 ? 'on-dark' : 'on-light'}" style="left:${i * 12.5}%">${file}</span>`;
      h += `<span class="cr ${i % 2 ? 'on-light' : 'on-dark'}" style="top:${i * 12.5}%">${rank}</span>`;
    }
    this.coordsEl.innerHTML = h;
  }

  // --- état ---------------------------------------------------------------
  setOrientation(c) {
    if (c === this.orientation) return;
    this.orientation = c;
    this.renderCoords();
    for (const [node, info] of this.els) { node.classList.add('no-anim'); this.place(node, info.sq); }
    requestAnimationFrame(() => { for (const node of this.els.keys()) node.classList.remove('no-anim'); });
    this.renderHL(); this.renderArrows();
  }
  flip() { this.setOrientation(this.orientation === 'w' ? 'b' : 'w'); }

  setPosition(fen, { lastMove = null, check = null, animate = true } = {}) {
    const next = parseFenBoard(fen);
    this.pieces = next;
    this.lastMove = lastMove;
    this.check = check;
    this.selected = null;
    this.hidePromo();
    // réconciliation des éléments pour animer les déplacements
    const existing = [...this.els.entries()];
    const keep = new Set();
    const need = [];
    for (const [sq, code] of Object.entries(next)) {
      const same = existing.find(([n, i]) => !keep.has(n) && i.sq === sq && i.code === code);
      if (same) keep.add(same[0]); else need.push([sq, code]);
    }
    const leftovers = existing.filter(([n]) => !keep.has(n));
    for (const [sq, code] of need) {
      let cand = leftovers.filter(([n, i]) => !keep.has(n) && i.code === code);
      if (cand.length) {
        cand.sort((a, b) => dist(a[1].sq, sq) - dist(b[1].sq, sq));
        const [node, info] = cand[0];
        keep.add(node); info.sq = sq;
        if (!animate) node.classList.add('no-anim');
        this.place(node, sq);
        if (!animate) requestAnimationFrame(() => node.classList.remove('no-anim'));
      } else {
        const node = document.createElement('div');
        node.className = `pc ${code} no-anim`;
        this.place(node, sq);
        this.piecesLayer.appendChild(node);
        this.els.set(node, { code, sq });
        keep.add(node);
        requestAnimationFrame(() => node.classList.remove('no-anim'));
      }
    }
    for (const [node] of existing) {
      if (!keep.has(node)) { this.els.delete(node); node.classList.add('fade'); setTimeout(() => node.remove(), 160); }
    }
    this.renderHL();
  }

  setMovable(m) { this.movable = m; this.selected = null; this.renderHL(); }
  setDests(fn) { this.destsFn = fn; }
  setArrows(arrows) { this.arrows = arrows || []; this.renderArrows(); }
  setMarks(marks) { this.marks = marks || {}; this.renderHL(); }
  flash(sq, kind = 'good') {
    const d = document.createElement('div');
    d.className = `sq-flash ${kind}`;
    this.place(d, sq);
    this.hl.appendChild(d);
    setTimeout(() => d.remove(), 900);
  }

  renderHL() {
    let h = '';
    const put = (sq, cls) => { const [x, y] = this.xy(sq); h += `<div class="${cls}" style="transform:translate(${x * 100}%,${y * 100}%)"></div>`; };
    if (this.lastMove) { put(this.lastMove[0], 'sq-last'); put(this.lastMove[1], 'sq-last'); }
    if (this.check) put(this.check, 'sq-check');
    for (const [sq, cls] of Object.entries(this.marks)) put(sq, 'sq-mark ' + cls);
    if (this.selected) {
      put(this.selected, 'sq-sel');
      for (const d of this.destsFn(this.selected)) put(d, this.pieces[d] ? 'sq-dest cap' : 'sq-dest');
    }
    const flashes = [...this.hl.querySelectorAll('.sq-flash')];
    this.hl.innerHTML = h;
    flashes.forEach(f => this.hl.appendChild(f));
  }

  renderArrows() {
    let h = '';
    for (const a of this.arrows) {
      const [x1, y1] = this.xy(a.from), [x2, y2] = this.xy(a.to);
      const cx1 = x1 + 0.5, cy1 = y1 + 0.5, cx2 = x2 + 0.5, cy2 = y2 + 0.5;
      const len = Math.hypot(cx2 - cx1, cy2 - cy1);
      const ex = cx2 - ((cx2 - cx1) / len) * 0.32, ey = cy2 - ((cy2 - cy1) / len) * 0.32;
      const kind = a.kind || 'best';
      h += `<line x1="${cx1}" y1="${cy1}" x2="${ex}" y2="${ey}" class="ar ar-${kind}" marker-end="url(#ah-${kind})"/>`;
    }
    this.arrowsG.innerHTML = h;
  }

  // --- interaction -------------------------------------------------------
  canMove(sq) {
    const code = this.pieces[sq];
    if (!code || !this.movable) return false;
    return this.movable === 'both' || code[0] === this.movable;
  }
  pointerDown(e) {
    if (e.button !== undefined && e.button !== 0) return;
    if (!this.promoEl.hidden) return;
    const sq = this.sqAt(e.clientX, e.clientY);
    if (!sq) return;
    if (this.selected && sq !== this.selected && this.destsFn(this.selected).includes(sq)) {
      e.preventDefault();
      this.tryMove(this.selected, sq);
      return;
    }
    if (this.canMove(sq)) {
      e.preventDefault();
      const wasSelected = this.selected === sq;
      this.selected = sq;
      this.renderHL();
      const node = this.nodeAt(sq);
      if (node) {
        this.drag = { node, from: sq, startX: e.clientX, startY: e.clientY, moved: false, wasSelected };
        this.el.setPointerCapture?.(e.pointerId);
      }
    } else {
      this.selected = null;
      this.renderHL();
    }
  }
  nodeAt(sq) { for (const [n, i] of this.els) if (i.sq === sq) return n; return null; }
  pointerMove(e) {
    const d = this.drag;
    if (!d) return;
    const dx = e.clientX - d.startX, dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) < 6) return;
    d.moved = true;
    const rect = this.el.getBoundingClientRect();
    const size = rect.width / 8;
    const x = (e.clientX - rect.left) / size - 0.5, y = (e.clientY - rect.top) / size - 0.5;
    d.node.classList.add('dragging');
    d.node.style.transform = `translate(${x * 100}%, ${y * 100}%) scale(1.12)`;
    const over = this.sqAt(e.clientX, e.clientY);
    this.el.querySelector('.sq-hover')?.remove();
    if (over && this.destsFn(d.from).includes(over)) {
      const hv = document.createElement('div');
      hv.className = 'sq-hover';
      this.place(hv, over);
      this.hl.appendChild(hv);
    }
  }
  pointerUp(e) {
    const d = this.drag;
    this.drag = null;
    this.el.querySelector('.sq-hover')?.remove();
    if (!d) return;
    d.node.classList.remove('dragging');
    if (!d.moved) {
      // simple toucher : un second toucher sur la pièce sélectionnée la désélectionne
      if (d.wasSelected) { this.selected = null; this.renderHL(); }
      return;
    }
    const to = this.sqAt(e.clientX, e.clientY);
    d.node.classList.add('no-anim');
    this.place(d.node, d.from);
    requestAnimationFrame(() => d.node.classList.remove('no-anim'));
    if (to && to !== d.from && this.destsFn(d.from).includes(to)) this.tryMove(d.from, to, true);
  }
  cancelDrag() {
    if (!this.drag) return;
    this.drag.node.classList.remove('dragging');
    this.place(this.drag.node, this.drag.from);
    this.drag = null;
  }

  async tryMove(from, to, dropped = false) {
    const code = this.pieces[from];
    let promotion;
    if (code && code[1] === 'p' && (to[1] === '8' || to[1] === '1')) {
      promotion = await this.askPromotion(to, code[0]);
      if (!promotion) { this.selected = null; this.renderHL(); return; }
    }
    this.selected = null;
    // déplacement optimiste (sans animation si la pièce a été glissée)
    const node = this.nodeAt(from);
    if (node) {
      if (dropped) node.classList.add('no-anim');
      const victim = this.nodeAt(to);
      if (victim) { this.els.delete(victim); victim.remove(); }
      this.els.get(node).sq = to;
      this.place(node, to);
      if (dropped) requestAnimationFrame(() => node.classList.remove('no-anim'));
      delete this.pieces[from]; this.pieces[to] = code;
    }
    this.renderHL();
    const ok = await this.onMove(from, to, promotion);
    if (ok === false && node) {
      // coup refusé : retour
      const info = this.els.get(node);
      if (info) { info.sq = from; this.place(node, from); }
      this.pieces[from] = code; delete this.pieces[to];
    }
  }

  askPromotion(to, color) {
    return new Promise(resolve => {
      const [x] = this.xy(to);
      const top = this.xy(to)[1] === 0;
      this.promoEl.innerHTML = ['q', 'n', 'r', 'b'].map((t, i) =>
        `<button class="promo-btn" data-t="${t}" style="left:${x * 12.5}%;top:${top ? i * 12.5 : (7 - i) * 12.5}%"><span class="pc ${color}${t}"></span></button>`).join('');
      this.promoEl.hidden = false;
      const done = t => { this.hidePromo(); resolve(t); };
      this.promoEl.onclick = ev => {
        const b = ev.target.closest('.promo-btn');
        done(b ? b.dataset.t : null);
      };
    });
  }
  hidePromo() { this.promoEl.hidden = true; this.promoEl.innerHTML = ''; this.promoEl.onclick = null; }
}

function dist(a, b) {
  return Math.abs(FILES.indexOf(a[0]) - FILES.indexOf(b[0])) + Math.abs(+a[1] - +b[1]);
}
void TYPES;
