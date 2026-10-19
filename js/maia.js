// Maia (CSSLab, Université de Toronto) : réseaux de neurones entraînés sur des millions de
// parties Lichess pour jouer comme un humain d'un niveau donné (1100 à 1900).
// Inférence en JavaScript pur : réseau Leela « SE-ResNet 6×64 », entrée classique 112 plans,
// tête de politique convolutive. Aucun calcul de variantes : un seul passage par coup.
import { Chess } from './lib/chess.js';

const EPS = 1e-5;

// --- lecture du fichier binaire produit par convert.py -------------------------------
export function parseModel(buf) {
  const dv = new DataView(buf);
  const hlen = dv.getUint32(0, true);
  const header = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, hlen)));
  const base = 4 + hlen;
  const L = {};
  for (const l of header.layers) {
    const q = new Uint16Array(buf.slice(base + l.offset * 2, base + (l.offset + l.count) * 2));
    const out = new Float32Array(l.count);
    const span = l.max - l.min;
    for (let i = 0; i < l.count; i++) out[i] = l.min + (q[i] / 65535) * span;
    L[l.name] = out;
  }
  const conv = (prefix, cin, cout, k) => {
    const w = L[prefix + '.weights'];
    const b = new Float32Array(cout);
    if (L[prefix + '.bn_means']) {
      // repli de la normalisation (batch norm) dans les poids de la convolution
      const mean = L[prefix + '.bn_means'], v = L[prefix + '.bn_stddivs'];
      const gam = L[prefix + '.bn_gammas'], bet = L[prefix + '.bn_betas'];
      const per = cin * k * k;
      for (let o = 0; o < cout; o++) {
        const s = (gam ? gam[o] : 1) / Math.sqrt(v[o] + EPS);
        for (let i = 0; i < per; i++) w[o * per + i] *= s;
        b[o] = (bet ? bet[o] : 0) - mean[o] * s;
      }
    } else if (L[prefix + '.biases']) b.set(L[prefix + '.biases']);
    return { w, b, cin, cout, k };
  };
  const F = header.filters;
  const m = { input: conv('input', 112, F, 3), res: [] };
  for (let i = 0; i < header.blocks; i++) {
    m.res.push({
      c1: conv(`res${i}.conv1`, F, F, 3), c2: conv(`res${i}.conv2`, F, F, 3),
      se: { w1: L[`res${i}.se.w1`], b1: L[`res${i}.se.b1`], w2: L[`res${i}.se.w2`], b2: L[`res${i}.se.b2`], n: L[`res${i}.se.b1`].length },
    });
  }
  m.pol1 = conv('policy1', F, F, 3);
  m.pol = conv('policy', F, 80, 3);
  m.val = conv('value', F, 32, 1);
  m.ip1w = L.ip1_val_w; m.ip1b = L.ip1_val_b; m.ip2w = L.ip2_val_w; m.ip2b = L.ip2_val_b;
  return m;
}

// --- couches -------------------------------------------------------------------------
// Couples (destination, source) pour chacun des 9 décalages d'un noyau 3×3 sur 8×8
const SHIFTS = (() => {
  const out = [];
  for (let ky = 0; ky < 3; ky++) for (let kx = 0; kx < 3; kx++) {
    const d = [], s = [];
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
      const rr = r + ky - 1, ff = f + kx - 1;
      if (rr < 0 || rr > 7 || ff < 0 || ff > 7) continue;
      d.push(r * 8 + f); s.push(rr * 8 + ff);
    }
    out.push({ d: Int32Array.from(d), s: Int32Array.from(s) });
  }
  return out;
})();

function conv3(x, L, relu) {
  const { w, b, cin, cout } = L;
  const y = new Float32Array(cout * 64);
  for (let o = 0; o < cout; o++) {
    const yo = o * 64;
    for (let j = 0; j < 64; j++) y[yo + j] = b[o];
    for (let c = 0; c < cin; c++) {
      const xc = c * 64, wb = (o * cin + c) * 9;
      for (let k = 0; k < 9; k++) {
        const wv = w[wb + k];
        if (wv === 0) continue;
        const { d, s } = SHIFTS[k];
        for (let j = 0; j < d.length; j++) y[yo + d[j]] += wv * x[xc + s[j]];
      }
    }
    if (relu) for (let j = 0; j < 64; j++) if (y[yo + j] < 0) y[yo + j] = 0;
  }
  return y;
}
function conv1(x, L, relu) {
  const { w, b, cin, cout } = L;
  const y = new Float32Array(cout * 64);
  for (let o = 0; o < cout; o++) {
    const yo = o * 64;
    for (let j = 0; j < 64; j++) y[yo + j] = b[o];
    for (let c = 0; c < cin; c++) {
      const wv = w[o * cin + c], xc = c * 64;
      for (let j = 0; j < 64; j++) y[yo + j] += wv * x[xc + j];
    }
    if (relu) for (let j = 0; j < 64; j++) if (y[yo + j] < 0) y[yo + j] = 0;
  }
  return y;
}
function seBlock(x, skip, se, C) {
  const pooled = new Float32Array(C);
  for (let c = 0; c < C; c++) { let s = 0; for (let j = 0; j < 64; j++) s += x[c * 64 + j]; pooled[c] = s / 64; }
  const h = new Float32Array(se.n);
  for (let i = 0; i < se.n; i++) { let s = se.b1[i]; for (let c = 0; c < C; c++) s += se.w1[i * C + c] * pooled[c]; h[i] = s > 0 ? s : 0; }
  const out = new Float32Array(C * 64);
  for (let c = 0; c < C; c++) {
    let g = se.b2[c], bb = se.b2[C + c];
    for (let i = 0; i < se.n; i++) { g += se.w2[c * se.n + i] * h[i]; bb += se.w2[(C + c) * se.n + i] * h[i]; }
    const sg = 1 / (1 + Math.exp(-g));
    for (let j = 0; j < 64; j++) { const v = sg * x[c * 64 + j] + bb + skip[c * 64 + j]; out[c * 64 + j] = v > 0 ? v : 0; }
  }
  return out;
}

export function forward(m, input) {
  let x = conv3(input, m.input, true);
  for (const r of m.res) {
    const a = conv3(x, r.c1, true);
    const b = conv3(a, r.c2, false);
    x = seBlock(b, x, r.se, m.input.cout);
  }
  const p1 = conv3(x, m.pol1, true);
  const pol = conv3(p1, m.pol, false); // 80 × 64
  const v = conv1(x, m.val, true); // 32 × 64
  const h = new Float32Array(128);
  for (let i = 0; i < 128; i++) { let s = m.ip1b[i]; for (let j = 0; j < 2048; j++) s += m.ip1w[i * 2048 + j] * v[j]; h[i] = s > 0 ? s : 0; }
  const z = [0, 1, 2].map(k => { let s = m.ip2b[k]; for (let i = 0; i < 128; i++) s += m.ip2w[k * 128 + i] * h[i]; return s; });
  const mx = Math.max(...z), e = z.map(t => Math.exp(t - mx)), se = e[0] + e[1] + e[2];
  return { pol, wdl: e.map(t => t / se) };
}

// --- encodage des positions (format Leela « classique », 112 plans) -----------------------
const ORDER = ['p', 'n', 'b', 'r', 'q', 'k'];
function key(fen) { return fen.split(' ').slice(0, 4).join(' '); }

/** fens : positions de la partie, de la première à la position actuelle. */
export function encode(fens, fromStart = true) {
  const x = new Float32Array(112 * 64);
  const cur = fens[fens.length - 1];
  const us = cur.split(' ')[1];
  const flip = us === 'b';
  const seen = new Map();
  const reps = fens.map(f => { const k = key(f); const n = seen.get(k) || 0; seen.set(k, n + 1); return n; });
  for (let i = 0; i < 8; i++) {
    let idx = fens.length - 1 - i;
    if (idx < 0) { if (fromStart) break; idx = 0; }
    const board = fens[idx].split(' ')[0].split('/');
    const base = i * 13 * 64;
    board.forEach((row, r) => {
      let f = 0;
      const rank = 7 - r;
      for (const ch of row) {
        if (/\d/.test(ch)) { f += +ch; continue; }
        const color = ch === ch.toUpperCase() ? 'w' : 'b';
        const t = ORDER.indexOf(ch.toLowerCase());
        const sq = (flip ? 7 - rank : rank) * 8 + f;
        const plane = (color === us ? 0 : 6) + t;
        x[base + plane * 64 + sq] = 1;
        f++;
      }
    });
    if (reps[idx] >= 1) x.fill(1, base + 12 * 64, base + 13 * 64);
  }
  const parts = cur.split(' ');
  const cast = parts[2];
  const has = c => cast.includes(c);
  const [usQ, usK, thQ, thK] = us === 'w' ? ['Q', 'K', 'q', 'k'] : ['q', 'k', 'Q', 'K'];
  const A = 104 * 64;
  if (has(usQ)) x.fill(1, A, A + 64);
  if (has(usK)) x.fill(1, A + 64, A + 128);
  if (has(thQ)) x.fill(1, A + 128, A + 192);
  if (has(thK)) x.fill(1, A + 192, A + 256);
  if (us === 'b') x.fill(1, A + 256, A + 320);
  x.fill(+parts[4] || 0, A + 320, A + 384);
  x.fill(1, A + 448, A + 512);
  return x;
}

// --- politique sur les coups légaux --------------------------------------------------
let POLICY = null; // { moves: [...1858], map: [...4672] }
export function setPolicyTables(t) {
  const index = new Map(t.moves.map((m, i) => [m, i]));
  POLICY = { ...t, index };
}

function mirrorSq(sq) { return sq[0] + (9 - +sq[1]); }

/**
 * Probabilités (somme = 1) des coups légaux de la position actuelle.
 * Renvoie [{ uci, san, p }] triés, et le pronostic gain/nulle/perte du camp au trait.
 */
export function movePolicy(m, fens, fromStart = true) {
  const out = forward(m, encode(fens, fromStart));
  const logits = new Float32Array(1858).fill(-Infinity);
  const map = POLICY.map;
  for (let e = 0; e < map.length; e++) if (map[e] >= 0) logits[map[e]] = out.pol[e];
  const cur = fens[fens.length - 1];
  const chess = new Chess(cur);
  const black = cur.split(' ')[1] === 'b';
  const legal = chess.moves({ verbose: true }).map(mv => {
    let from = mv.from, to = mv.to;
    // le roque est codé « roi prend sa tour » (e1h1, e1a1)
    if (mv.flags.includes('k')) to = 'h' + to[1];
    else if (mv.flags.includes('q')) to = 'a' + to[1];
    if (black) { from = mirrorSq(from); to = mirrorSq(to); }
    const promo = mv.promotion && mv.promotion !== 'n' ? mv.promotion : '';
    const i = POLICY.index.get(from + to + promo);
    return { uci: mv.from + mv.to + (mv.promotion || ''), san: mv.san, logit: i == null ? -1e9 : logits[i] };
  });
  const mx = Math.max(...legal.map(l => l.logit));
  let s = 0;
  for (const l of legal) { l.p = Math.exp(l.logit - mx); s += l.p; }
  for (const l of legal) { l.p /= s; delete l.logit; }
  legal.sort((a, b) => b.p - a.p);
  return { moves: legal, wdl: out.wdl };
}

// --- chargement dans le navigateur ---------------------------------------------------
const cache = new Map();
export async function loadMaia(elo) {
  if (cache.has(elo)) return cache.get(elo);
  const p = (async () => {
    if (!POLICY) setPolicyTables(await (await fetch('maia/policy.json')).json());
    const res = await fetch(`maia/maia-${elo}.bin`);
    if (!res.ok) throw new Error('Modèle Maia introuvable');
    return parseModel(await res.arrayBuffer());
  })();
  cache.set(elo, p);
  p.catch(() => cache.delete(elo));
  return p;
}
