// Cours : le programme, le lecteur de leçon interactif, les contrôles, le carnet de l'élève
// et les cours particuliers du professeur.
import { Board } from './board.js';
import { Chess, $, esc, uciToMove, moveToUci, destsFor, checkSquare, sound, moveSound, toast, sanFr, pvToSan, numberedSan, fmtDate } from './util.js';
import { engine, lineWin } from './engine.js';
import { MODULES, leconById, START } from './cours-data.js';
import { etatLecon, positionLecon, noterPosition, noterControle, aReviser, recommandation, prof, saveProf, supprimerNote, bilanEleve, SEUIL } from './eleve.js';
import { hasKey, mountChat, sansCle, contextePosition, refutation, coursParticulier, bulletin, usageTexte, MODE_EXERCICE, matierePourCours } from './prof.js';
import { drawPuzzles, puzzleProfile } from './puzzles.js';
import { reviewMistake, weaknessStats, CATEGORIES } from './games.js';

let L = null; // leçon en cours
if (typeof window !== 'undefined') window.__caissaLecon = () => L; // pour les tests automatiques (tools/)

export function mount(root, params = {}) {
  if (params.l && leconById(params.l)) return openLesson(root, leconById(params.l), !!params.rev);
  if (params.cp) { const c = prof().cours.find(x => x.id === params.cp); if (c) return openLesson(root, leconDepuisCours(c), false); }
  renderHome(root);
}
export function unmount() {
  if (L) { L.token++; engine.cancelAll(); }
  L = null;
}

// =========================================================================================
// Accueil des cours
// =========================================================================================
const ICON = {
  ok: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  go: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
};

function renderHome(root) {
  const reco = recommandation();
  const b = bilanEleve();
  const p = prof();
  const stats = weaknessStats();
  const cats = stats.filter(([, n]) => n >= 2);
  const total = stats.reduce((t, [, n]) => t + n, 0);
  const recoBtn = { continuer: 'Reprendre la leçon', revision: 'Faire la révision', faiblesse: 'Commencer la leçon', suite: 'Commencer la leçon' }[reco.type];
  const recoLabel = { continuer: 'Leçon en cours', revision: 'Révision', faiblesse: 'Choisie pour toi', suite: 'Prochaine leçon', fini: 'Programme terminé' }[reco.type];
  root.innerHTML = `
  <div class="split">
    <div class="stack">
      <div><h2>Cours</h2><p class="muted" style="margin:4px 0 0">Un programme complet, des exercices sur l'échiquier, et un professeur qui suit tes parties.</p></div>
      <div class="card reco">
        <span class="badge">${recoLabel}</span>
        ${reco.lecon ? `<div class="reco-t">${esc(reco.lecon.titre)}</div><p class="small muted" style="margin:0 0 4px">${esc(reco.lecon.module.titre)} · ${reco.lecon.duree} min</p>` : '<div class="reco-t">Bravo !</div>'}
        <p class="small" style="margin:6px 0 12px">${esc(reco.raison)}</p>
        ${reco.lecon ? `<a class="btn primary block" href="#/cours?l=${reco.lecon.id}${reco.type === 'revision' ? '&rev=1' : ''}">${recoBtn}</a>` : '<a class="btn primary block" href="#/problemes">Faire des problèmes</a>'}
      </div>
      <div class="card">
        <div class="row between"><h3>Le programme</h3><span class="muted small">${b.avancement.faites} / ${b.avancement.total} leçons validées</span></div>
        <div class="progress" style="margin:4px 0 6px"><i style="width:${(b.avancement.faites / b.avancement.total) * 100}%"></i></div>
        ${MODULES.map((m, i) => moduleHtml(m, i, reco)).join('')}
      </div>
    </div>
    <div class="side stack">
      <div class="card" id="co-carnet"></div>
      <div class="card" id="co-prive">
        <h3>Cours particulier</h3>
        <p class="small muted" style="margin:0 0 8px">Le professeur reprend les erreurs de <b>tes</b> parties et en fait une leçon : tu rejoues chaque position, il t'explique ce que tu n'avais pas vu.</p>
        ${total >= 2 ? `<div class="chips" id="cp-cats">${[['tout', `Toutes mes erreurs (${total})`], ...cats.map(([k, n]) => [k, `${CATEGORIES[k]} (${n})`])].map(([k, l], i) => `<button class="chip ${i === (cats.length ? 1 : 0) ? 'on' : ''}" data-c="${k}">${esc(l)}</button>`).join('')}</div>
          <button class="btn primary block" id="cp-go" style="margin-top:8px">Préparer mon cours</button><div id="cp-msg" style="margin-top:8px"></div>`
        : `<div class="fb info">Ton carnet d'erreurs est encore trop mince. Joue et analyse deux ou trois parties : le professeur aura de quoi travailler.</div>`}
        ${p.cours.length ? `<div class="list" style="margin-top:8px">${p.cours.map(c => `<a class="list-item" href="#/cours?cp=${c.id}" style="text-decoration:none;color:inherit"><div class="grow"><div class="t">${esc(c.titre)}</div><div class="s">${fmtDate(c.at)} · ${c.items.length} positions de tes parties</div></div>${ICON.go}</a>`).join('')}</div>` : ''}
      </div>
      <div class="card"><h3>Une question ?</h3><p class="small muted" style="margin:0 0 8px">Règle, ouverture, façon de s'entraîner : demande au professeur.</p><div id="co-chat"></div></div>
    </div>
  </div>`;
  renderCarnet($('#co-carnet', root));
  mountChat($('#co-chat', root), { suggestions: ['Comment m\'entraîner cette semaine ?', 'Comment ne plus paniquer face à un humain ?'], sansCle: 'Avec une clé API, tu peux poser ici toutes tes questions au professeur.' });
  const cpCats = $('#cp-cats', root);
  if (cpCats) {
    cpCats.addEventListener('click', e => { const c = e.target.closest('.chip'); if (!c) return; cpCats.querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === c)); });
    $('#cp-go', root).onclick = async () => {
      const msg = $('#cp-msg', root), btn = $('#cp-go', root);
      if (!hasKey()) { sansCle(msg, 'Le cours particulier est rédigé par le professeur : il lui faut une clé API.'); return; }
      const cat = $('#cp-cats .on', root)?.dataset.c || 'tout';
      if (matierePourCours(cat).length < 2) { msg.innerHTML = '<div class="fb info">Pas encore assez d\'erreurs de ce type dans ton carnet. Choisis « Toutes mes erreurs » ou analyse d\'autres parties.</div>'; return; }
      btn.disabled = true;
      msg.innerHTML = '<div class="coach loading">Le professeur prépare ton cours…</div>';
      try {
        const c = await coursParticulier(cat, t => { const el = $('#cp-msg .coach', root); if (el) el.textContent = t; });
        location.hash = `#/cours?cp=${c.id}`;
      } catch (e) { msg.innerHTML = `<div class="fb ko">${esc(e.message)}</div>`; btn.disabled = false; }
    };
  }
}

function moduleHtml(m, i, reco) {
  const done = m.lecons.filter(l => etatLecon(l.id)?.fait).length;
  const open = reco.lecon ? reco.lecon.module.id === m.id : i === 0;
  const due = new Set(aReviser().map(l => l.id));
  return `<details class="module" ${open ? 'open' : ''}>
    <summary><span class="module-n">${i + 1}</span><span class="grow"><b>${esc(m.titre)}</b><small>${esc(m.resume)}</small></span><span class="badge ${done === m.lecons.length ? 'good' : ''}">${done}/${m.lecons.length}</span></summary>
    <div class="list">${m.lecons.map(l => {
    const e = etatLecon(l.id), enCours = positionLecon(l.id) > 0 && !e?.fait;
    const state = due.has(l.id) ? '<span class="badge bad">à réviser</span>' : e?.fait ? `<span class="badge good">${Math.round((e.score || 0) * 100)} %</span>` : enCours ? '<span class="badge">en cours</span>' : e?.essais ? '<span class="badge">à retenter</span>' : '';
    return `<a class="list-item lecon-row ${e?.fait ? 'done' : ''}" href="#/cours?l=${l.id}${due.has(l.id) ? '&rev=1' : ''}"><span class="lecon-dot">${e?.fait ? ICON.ok : ''}</span><div class="grow"><div class="t">${esc(l.titre)}</div><div class="s">${l.duree} min · ${esc(l.but)}</div></div>${state}</a>`;
  }).join('')}</div></details>`;
}

function renderCarnet(el) {
  const b = bilanEleve(), p = prof();
  const bu = p.bulletins[0];
  const max = b.faiblesses[0]?.[1] || 1;
  el.innerHTML = `
    <h3>Carnet de l'élève</h3>
    <div class="carnet-stats">
      <div><b>${b.avancement.faites}<small>/${b.avancement.total}</small></b><span>leçons validées</span></div>
      <div><b>${b.elo}</b><span>Elo Caïssa${b.tendance ? ` (${b.tendance > 0 ? '+' : ''}${b.tendance} en 30 j)` : ''}</span></div>
      <div><b>${b.precision ?? '—'}${b.precision != null ? '<small> %</small>' : ''}</b><span>précision moyenne</span></div>
      <div><b>${b.gaffesParPartie ?? '—'}</b><span>gaffe(s) par partie</span></div>
    </div>
    ${b.faiblesses.length ? `<p class="small muted" style="margin:12px 0 2px">Ce qui te coûte des points</p>${b.faiblesses.slice(0, 3).map(([k, n]) => `<div class="weak-bar"><span>${CATEGORIES[k]}</span><b>${n}</b><div class="bar"><i style="width:${(n / max) * 100}%"></i></div></div>`).join('')}` : '<p class="small muted" style="margin:10px 0 0">Analyse tes parties : le professeur y repère tes erreurs récurrentes et adapte le programme.</p>'}
    <label class="field" style="margin-top:12px">Mon objectif<input id="ca-obj" value="${esc(p.objectif)}" maxlength="160" placeholder="Ce que tu veux travailler"></label>
    <div style="margin-top:12px"><div class="row between"><b>Bulletin du professeur</b><button class="btn sm" id="ca-bu">${bu ? 'Nouveau bulletin' : 'Demander mon bulletin'}</button></div>
      <div id="ca-bu-out" style="margin-top:8px">${bu ? bulletinHtml(bu) : '<p class="small muted" style="margin:0">Un point d\'étape rédigé à partir de tes chiffres, avec un programme pour la semaine.</p>'}</div></div>
    ${p.notes.length ? `<details class="cls-table"><summary>Notes du professeur (${p.notes.length})</summary><p class="tiny muted" style="margin:6px 0">Ce qu'il retient de toi d'une séance à l'autre. Supprime ce qui ne te ressemble plus.</p>
      <div class="list" id="ca-notes">${p.notes.map(n => `<div class="list-item" style="cursor:default"><div class="grow"><div class="small" style="white-space:normal">${esc(n.t)}</div><div class="s">${fmtDate(n.at)}${n.source ? ' · ' + esc(n.source) : ''}</div></div><button class="btn sm ghost" data-del="${n.at}" aria-label="Supprimer la note">✕</button></div>`).join('')}</div></details>` : ''}
    <p class="tiny muted" style="margin:10px 0 0">${esc(usageTexte())}</p>`;
  $('#ca-obj', el).onchange = e => { saveProf({ objectif: e.target.value.trim() }); toast('Objectif enregistré.'); };
  $('#ca-notes', el)?.addEventListener('click', e => { const d = e.target.closest('[data-del]'); if (d) { supprimerNote(+d.dataset.del); renderCarnet(el); } });
  $('#ca-bu', el).onclick = async () => {
    const out = $('#ca-bu-out', el), btn = $('#ca-bu', el);
    if (!hasKey()) { sansCle(out, 'Le bulletin est rédigé par le professeur : il lui faut une clé API.'); return; }
    btn.disabled = true;
    out.innerHTML = '<div class="coach loading">Le professeur relit ton dossier…</div>';
    try { await bulletin(); renderCarnet(el); }
    catch (e) { out.innerHTML = `<div class="fb ko">${esc(e.message)}</div>`; btn.disabled = false; }
  };
}
function bulletinHtml(bu) {
  const part = (t, x) => (x ? `<p class="bu-h">${t}</p><div class="coach">${esc(x)}</div>` : '');
  return `<p class="tiny muted" style="margin:0 0 6px">${fmtDate(bu.at)}${bu.par ? ' · ' + esc(bu.par) : ''}</p>${part('Où tu en es', bu.bilan)}${part('Points forts', bu.forts)}${part('À travailler', bu.travail)}${part('Ton programme de la semaine', bu.programme)}`;
}

// =========================================================================================
// Lecteur de leçon
// =========================================================================================
const fenCache = new WeakMap();
function fenOf(step) {
  if (step.fen) return step.fen;
  if (!step.apres) return null;
  if (!fenCache.has(step)) { const c = new Chess(START); for (const u of step.apres) uciToMove(c, u); fenCache.set(step, c.fen()); }
  return fenCache.get(step);
}
const texteBrut = h => String(h || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const camp = c => (c === 'w' ? 'Blancs' : 'Noirs');
const wait = ms => new Promise(r => setTimeout(r, ms));

function leconDepuisCours(c) {
  return {
    id: c.id, prive: true, titre: c.titre, duree: c.items.length * 2, module: { titre: 'Cours particulier' }, but: '',
    etapes: [
      { t: 'texte', h: `<p>${esc(c.intro)}</p><p class="small muted">Pour chaque position : prends ton temps, fais ta routine, puis joue le coup que tu aurais dû trouver.</p>` },
      ...c.items.map(it => ({
        t: 'trouve', fen: it.fen, moteur: true, mid: it.mid, sol: [it.best], pv: it.pv,
        h: `<p class="small muted" style="margin-bottom:6px">Ta partie contre ${esc(it.opponent || '?')} — tu avais joué <b>${esc(sanFr(it.playedSan))}</b>.</p><p>${esc(it.question)}</p>`,
        ok: it.explication,
      })),
      ...(c.reflexe ? [{ t: 'texte', h: `<p><b>Le réflexe à emporter</b></p><p>${esc(c.reflexe)}</p>` }] : []),
    ],
  };
}

function openLesson(root, lecon, revision) {
  root.innerHTML = `
  <div class="split">
    <div class="board-col"><div class="board-area"><div class="board-wrap"><div id="ls-board"></div></div></div></div>
    <div class="side stack">
      <div class="card">
        <div class="row between" style="flex-wrap:nowrap"><span class="muted small" id="ls-meta" style="min-width:0"></span><a class="btn sm ghost" href="#/cours">Programme</a></div>
        <div class="progress" style="margin:8px 0 12px"><i id="ls-prog"></i></div>
        <div class="lesson-text" id="ls-text"></div>
        <div id="ls-choices"></div>
        <div id="ls-fb"></div>
        <div class="row" id="ls-actions" style="margin-top:12px"></div>
      </div>
      <div class="card" id="ls-prof-card"><h3>Le professeur</h3><div id="ls-prof"></div></div>
    </div>
  </div>`;
  const board = new Board($('#ls-board', root), { onMove: (f, t, p) => onMove(f, t, p) });
  L = { root, board, lecon, mode: lecon.prive ? 'prive' : 'lecon', steps: lecon.etapes, idx: 0, token: 0, lastFen: START, results: [], cur: null, chat: null };
  L.chat = mountChat($('#ls-prof', root), {
    contexte: q => contexteLecon(q),
    mode: () => (L?.cur && !L.cur.done && ['trouve', 'case', 'qcm', 'partie'].includes(L.steps[L.idx]?.t) ? MODE_EXERCICE : undefined),
    suggestions: ['Explique-moi autrement', 'Donne-moi un indice', 'À quoi ça sert en partie ?'],
    sansCle: 'Avec une clé API, le professeur répond à tes questions pendant la leçon.',
  });
  if (revision && !lecon.prive) startControl();
  else show(Math.min(positionLecon(lecon.id), lecon.etapes.length - 1));
}

async function contexteLecon(q) {
  const l = L; if (!l) return '';
  const s = l.steps[l.idx], cur = l.cur;
  let t = `Leçon en cours : « ${l.lecon.titre} » (${l.lecon.module.titre}).${l.lecon.but ? ` But de la leçon : ${l.lecon.but}` : ''}\nÉtape ${l.idx + 1} sur ${l.steps.length}. Texte affiché à l'élève : ${texteBrut(s.h)}`;
  if (s.t === 'qcm') t += `\nQuestion à choix : ${s.choix.map((c, i) => `${i + 1}) ${c}`).join(' ; ')}. Bonne réponse : ${s.bon + 1}.`;
  const fen = cur?.chess ? cur.chess.fen() : fenOf(s);
  if (s.t === 'trouve' && cur) {
    const base = fenOf(s);
    t += `\nExercice : l'élève doit trouver le bon coup. ${cur.done ? 'Il a terminé l\'exercice.' : 'Il cherche encore.'}\nSolution prévue${cur.done ? '' : ' (à ne pas révéler)'} :\n${describeSol(base, s.sol)}`;
  }
  if (s.t === 'case') t += `\nExercice : toucher la bonne case. Réponse attendue${cur?.done ? '' : ' (à ne pas révéler)'} : ${s.cases.join(', ')}.`;
  if (s.t === 'partie') t += `\nExercice : partie contre le moteur, l'élève joue les ${camp(cur?.side || 'w')}. Objectif : ${{ mat: 'donner échec et mat', promo: 'promouvoir son pion', nulle: 'tenir la nulle' }[s.but]}.`;
  if (fen) t += '\n\n' + await contextePosition(fen, q);
  return t;
}
function describeSol(fen, sol) { return numberedSan(fen, pvToSan(fen, sol, 12).map(sanFr)); }

function setFb(html, cls = '') { const el = $('#ls-fb', L.root); el.innerHTML = html ? `<div class="fb ${cls}" style="margin-top:10px">${html}</div>` : ''; }
function arrowsOf(step) { return (step.fl || []).map(a => { const [m, k] = a.split(':'); return { from: m.slice(0, 2), to: m.slice(2, 4), kind: k || 'best' }; }); }

function show(idx) {
  const l = L;
  l.token++;
  engine.cancelAll();
  l.idx = idx;
  const s = l.steps[idx];
  const fen = fenOf(s) || l.lastFen;
  l.lastFen = fen;
  const chess = new Chess(fen);
  const side = s.camp || chess.turn();
  l.cur = { done: false, failed: false, success: false, hinted: 0, i: 0, n: 0, chess, side, found: new Set(), busy: false };
  if (l.mode === 'lecon') noterPosition(l.lecon.id, idx);
  const b = l.board;
  b.setOnSquare(null);
  b.setMovable(null);
  b.setOrientation(s.o || (['trouve', 'partie'].includes(s.t) ? side : s.t === 'case' ? chess.turn() : 'w'));
  b.setArrows(arrowsOf(s));
  b.setMarks(s.mq || {});
  b.setPosition(fen, { animate: false, lastMove: s.dernier || null, check: checkSquare(chess) });
  const n = l.steps.length;
  $('#ls-meta', l.root).textContent = l.mode === 'controle' ? `Contrôle · ${l.lecon.titre} · ${idx + 1}/${n}` : `${l.lecon.module.titre} · ${l.lecon.titre}`;
  $('#ls-prog', l.root).style.width = `${((idx + (l.mode === 'controle' ? 0 : 1)) / n) * 100}%`;
  $('#ls-text', l.root).innerHTML = (idx === 0 && l.mode !== 'controle' ? `<h3 style="margin-bottom:8px">${esc(l.lecon.titre)}</h3>` : '') + s.h + (['trouve', 'partie'].includes(s.t) ? `<p class="small muted" style="margin:6px 0 0">Tu joues les ${camp(side)}.</p>` : '');
  $('#ls-choices', l.root).innerHTML = '';
  $('#ls-prof-card', l.root).classList.toggle('hidden', l.mode === 'controle');
  setFb('');
  l.chat?.reset();
  ({ texte: startTexte, demo: startDemo, trouve: startTrouve, case: startCase, qcm: startQcm, partie: startPartie })[s.t]();
}

/** Boutons sous le texte. extra = boutons propres à l'étape, avant la navigation. */
function actions(extra = []) {
  const l = L, cur = l.cur, last = l.idx === l.steps.length - 1;
  const a = $('#ls-actions', l.root);
  const btns = [];
  if (l.mode !== 'controle' && l.idx > 0) btns.push(`<button class="btn ghost" data-a="prev" aria-label="Étape précédente">◀</button>`);
  btns.push(...extra.map(([id, label, cls = '']) => `<button class="btn ${cls}" data-a="${id}">${label}</button>`));
  const nextLabel = l.mode === 'controle' ? (last ? 'Voir le résultat' : 'Question suivante') : last ? (l.lecon.prive ? 'Terminer' : 'Passer au contrôle') : 'Suivant';
  if (cur.done) btns.push(`<button class="btn primary" data-a="next">${nextLabel}</button>`);
  else if (l.mode !== 'controle') btns.push(`<button class="btn ghost" data-a="next">Passer</button>`);
  a.innerHTML = btns.join('');
  a.onclick = e => {
    const id = e.target.closest('[data-a]')?.dataset.a; if (!id) return;
    if (id === 'prev') show(l.idx - 1);
    else if (id === 'next') next();
    else l.handlers?.[id]?.();
  };
}

function next() {
  const l = L;
  if (l.mode === 'controle') {
    l.results[l.idx] = !!(l.cur.done && l.cur.success && !l.cur.failed);
    if (l.idx < l.steps.length - 1) show(l.idx + 1); else finishControl();
    return;
  }
  if (l.idx < l.steps.length - 1) { show(l.idx + 1); return; }
  if (l.lecon.prive) finishPrivate(); else startControl();
}

function done(success, html, cls) {
  const l = L, cur = l.cur;
  if (cur.done) return;
  cur.done = true; cur.success = success;
  l.board.setMovable(null); l.board.setOnSquare(null);
  if (html) setFb(html, cls || (success ? 'ok' : 'ko'));
  const s = l.steps[l.idx];
  if (s.mid) reviewMistake(s.mid, success && !cur.failed);
  if (l.mode === 'prive' && s.t === 'trouve') l.results.push(success && !cur.failed);
  actions(cur.extraDone || []);
}

// --- texte ----------------------------------------------------------------------------------
function startTexte() { L.cur.done = true; L.cur.success = true; L.handlers = {}; actions(); }

// --- démonstration ----------------------------------------------------------------------------
function startDemo() {
  const l = L, s = l.steps[l.idx];
  l.handlers = { play: () => playDemo() };
  actions([['play', '▶ Voir la suite', 'primary']]);
  async function playDemo() {
    const tok = ++l.token, cur = l.cur;
    cur.chess = new Chess(fenOf(s));
    l.board.setArrows([]); l.board.setMarks({});
    l.board.setPosition(cur.chess.fen(), { animate: false });
    $('#ls-actions', l.root).querySelectorAll('button').forEach(b => { b.disabled = true; });
    await wait(350);
    for (const u of s.coups) {
      if (!L || l.token !== tok) return;
      const m = uciToMove(cur.chess, u); if (!m) break;
      l.board.setPosition(cur.chess.fen(), { lastMove: [m.from, m.to], check: checkSquare(cur.chess) });
      moveSound(m, cur.chess);
      await wait(s.coups.length > 8 ? 650 : 900);
    }
    if (!L || l.token !== tok) return;
    cur.done = true; cur.success = true;
    setFb(`${cur.chess.isCheckmate() ? '<b>Échec et mat.</b> ' : ''}${s.ok || ''}<div class="tiny muted" style="margin-top:4px">${esc(numberedSan(fenOf(s), pvToSan(fenOf(s), s.coups, 20).map(sanFr)))}</div>`, 'info');
    actions([['play', 'Revoir']]);
  }
}

// --- trouver le coup --------------------------------------------------------------------------
function startTrouve() {
  const l = L;
  l.handlers = { hint, sol: () => revealSolution(true) };
  actions(l.mode === 'controle' ? [] : [['hint', 'Indice'], ['sol', 'Solution', 'ghost']]);
  autoReplies(false);
}
// joue les coups de l'adversaire prévus dans la ligne, puis rend la main à l'élève
async function autoReplies(delay = true) {
  const l = L, s = l.steps[l.idx], cur = l.cur, tok = l.token;
  l.board.setMovable(null);
  while (cur.i < s.sol.length && cur.chess.turn() !== cur.side) {
    await wait(delay ? 480 : 550);
    if (!L || l.token !== tok || cur.done) return;
    const m = uciToMove(cur.chess, s.sol[cur.i]); cur.i++;
    if (!m) break;
    l.board.setPosition(cur.chess.fen(), { lastMove: [m.from, m.to], check: checkSquare(cur.chess) });
    moveSound(m, cur.chess);
  }
  if (!L || l.token !== tok || cur.done) return;
  l.board.setDests(destsFor(cur.chess));
  l.board.setMovable(cur.side);
}
function hint() {
  const l = L, s = l.steps[l.idx], cur = l.cur;
  if (cur.done) return;
  const exp = s.sol[cur.i]; if (!exp) return;
  cur.hinted++; cur.failed = true;
  if (cur.hinted === 1 && s.indice) { setFb(esc(s.indice), 'info'); return; }
  if (cur.hinted <= 2) { l.board.setMarks({ [exp.slice(0, 2)]: 'hint' }); setFb('La pièce à jouer est en surbrillance.', 'info'); return; }
  l.board.setArrows([{ from: exp.slice(0, 2), to: exp.slice(2, 4), kind: 'hint' }]);
}
async function revealSolution(byUser) {
  const l = L, s = l.steps[l.idx], cur = l.cur, tok = l.token;
  if (cur.done || cur.busy) return;
  cur.busy = true; cur.failed = true;
  l.board.setMovable(null); l.board.setArrows([]); l.board.setMarks({});
  const startFen = cur.chess.fen(), rest = s.sol.slice(cur.i);
  l.board.setPosition(startFen, { check: checkSquare(cur.chess) });
  for (const u of rest) {
    await wait(700);
    if (!L || l.token !== tok) return;
    const m = uciToMove(cur.chess, u); if (!m) break;
    l.board.setPosition(cur.chess.fen(), { lastMove: [m.from, m.to], check: checkSquare(cur.chess) });
    moveSound(m, cur.chess);
  }
  cur.busy = false;
  const line = esc(numberedSan(startFen, pvToSan(startFen, rest, 12).map(sanFr)));
  done(false, `${byUser ? 'La solution' : 'Il fallait jouer'} : <b>${line}</b>${s.ok ? `<div style="margin-top:4px">${s.ok}</div>` : ''}`, 'info');
}

async function onMove(from, to, promotion) {
  const l = L; if (!l) return false;
  const s = l.steps[l.idx], cur = l.cur;
  if (cur.done || cur.busy) return false;
  if (s.t === 'partie') return partieMove(from, to, promotion);
  if (s.t !== 'trouve') return false;
  const test = new Chess(cur.chess.fen());
  let m;
  try { m = test.move({ from, to, promotion }); } catch { return false; }
  const uci = moveToUci(m), expected = s.sol[cur.i];
  const first = cur.i <= (new Chess(fenOf(s)).turn() === cur.side ? 0 : 1);
  const exact = uci === expected;
  const autre = !exact && !s.strict && ((first && s.alt?.includes(uci)) || test.isCheckmate());
  l.board.setArrows([]); l.board.setMarks({});
  if (exact || autre) return accept(m, autre);
  if (s.moteur) {
    // cours particulier : un coup différent de celui du moteur peut être tout aussi bon
    cur.busy = true; l.board.setMovable(null);
    const fenBefore = cur.chess.fen(), tok = l.token;
    setFb('Vérification…', 'info');
    const rb = await engine.analyse(fenBefore, { depth: 12 }), ra = await engine.analyse(test.fen(), { depth: 12 });
    if (!L || l.token !== tok) return true;
    cur.busy = false;
    if (rb && ra && lineWin(rb.lines[0]) - (100 - lineWin(ra.lines[0])) < 6) return accept(m, true);
    return reject(m, test, fenBefore);
  }
  return reject(m, test, cur.chess.fen());
}

function accept(m, autre) {
  const l = L, s = l.steps[l.idx], cur = l.cur;
  cur.chess.move({ from: m.from, to: m.to, promotion: m.promotion });
  cur.i++;
  l.board.setPosition(cur.chess.fen(), { lastMove: [m.from, m.to], check: checkSquare(cur.chess) });
  moveSound(m, cur.chess);
  l.board.flash(m.to, 'good');
  const fini = autre || cur.i >= s.sol.length || cur.chess.isGameOver();
  if (fini) {
    sound('good');
    const prevu = autre && s.sol[cur.i - 1] && s.sol[cur.i - 1] !== moveToUci(m) && !cur.chess.isCheckmate() ? `<div class="tiny muted" style="margin-top:4px">Le coup prévu était ${esc(sanFr(pvToSan(m.before, [s.sol[cur.i - 1]], 1)[0] || ''))} ; le tien est aussi bon.</div>` : '';
    done(true, `<b>${cur.failed ? 'C\'est ça.' : 'Bien joué !'}</b> ${s.ok || ''}${prevu}`, 'ok');
    return true;
  }
  setFb('<b>Bien vu !</b> Continue.', 'ok');
  autoReplies(true);
  return true;
}

function reject(m, test, fenBefore) {
  const l = L, s = l.steps[l.idx], cur = l.cur, tok = l.token;
  sound('bad');
  l.board.setPosition(test.fen(), { lastMove: [m.from, m.to], check: checkSquare(test) });
  l.board.flash(m.to, 'bad');
  cur.failed = true;
  const san = sanFr(m.san);
  if (l.mode === 'controle') {
    setFb(`<b>${esc(san)}</b> n'est pas le bon coup.`, 'ko');
    l.board.setMovable(null);
    setTimeout(() => { if (L && l.token === tok) { cur.chess = new Chess(fenBefore); revealSolution(false); } }, 700);
    return true;
  }
  l.board.setMovable(null);
  setTimeout(() => {
    if (!L || l.token !== tok || cur.done) return;
    l.board.setPosition(fenBefore, { check: checkSquare(cur.chess) });
    l.board.setDests(destsFor(cur.chess));
    l.board.setMovable(cur.side);
  }, 650);
  const pourquoi = hasKey() ? ` <button class="btn sm" data-why style="margin-top:6px">Pourquoi ?</button>` : '';
  const bind = () => { const w = $('#ls-fb [data-why]', l.root); if (w) w.onclick = () => { w.remove(); l.chat?.ask(`J'ai joué ${san}. Pourquoi ce n'est pas le bon coup ?`); $('#ls-prof-card', l.root).scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }; };
  if (s.strict) { setFb(`<b>${esc(san)}</b> n'est pas le coup du répertoire. Réessaie.`, 'ko'); return true; }
  setFb(`<b>${esc(san)}</b> : pas tout à fait. Réessaie.${pourquoi}`, 'ko'); bind();
  // explication sans IA : la réponse du moteur à ce coup
  (async () => {
    const before = await engine.analyse(fenBefore, { depth: 12 });
    const ref = await refutation(test.fen());
    if (!L || l.token !== tok || cur.done || !ref || !before) return;
    const perte = lineWin(before.lines[0]) - (100 - lineWin(ref.line));
    const rep = new Chess(test.fen()); const r = uciToMove(rep, ref.line.pv[0]);
    const PIECE = { p: 'un pion', n: 'ton cavalier', b: 'ton fou', r: 'ta tour', q: 'ta dame' };
    let txt;
    if (rep.isCheckmate()) txt = `après <b>${esc(san)}</b>, l'adversaire répond ${esc(sanFr(ref.san))} et c'est mat.`;
    else if (perte < 6) txt = `<b>${esc(san)}</b> ne gâche rien, mais ce n'est pas l'idée de la leçon : il y a plus direct.`;
    else if (r?.captured) txt = `après <b>${esc(san)}</b>, l'adversaire répond ${esc(sanFr(ref.san))} et prend ${PIECE[r.captured]}.`;
    else txt = `après <b>${esc(san)}</b>, l'adversaire répond ${esc(sanFr(ref.san))} et l'occasion est passée.`;
    setFb(`Pas tout à fait : ${txt} Réessaie.${pourquoi}`, 'ko'); bind();
  })();
  return true;
}

// --- toucher la case ----------------------------------------------------------------------------
function startCase() {
  const l = L, s = l.steps[l.idx], cur = l.cur;
  l.handlers = { hint: () => { cur.failed = true; setFb(esc(s.indice || 'Regarde ce que chaque pièce adverse attaque.'), 'info'); }, sol: () => reveal(false) };
  actions(l.mode === 'controle' ? [] : [['hint', 'Indice'], ['sol', 'Solution', 'ghost']]);
  const marks = () => Object.fromEntries([...cur.found].map(sq => [sq, 'good']));
  function reveal(success) {
    l.board.setMarks(Object.fromEntries(s.cases.map(sq => [sq, success || cur.found.has(sq) ? 'good' : 'hint'])));
    done(success, success ? `<b>Exact.</b> ${s.ok || ''}` : `La réponse : <b>${s.cases.join(', ')}</b>. ${s.ok || ''}`, success ? 'ok' : 'info');
  }
  l.board.setOnSquare(sq => {
    if (cur.done) return;
    if (s.cases.includes(sq)) {
      cur.found.add(sq); sound('good'); l.board.flash(sq, 'good'); l.board.setMarks(marks());
      if (!s.tous || s.cases.every(x => cur.found.has(x))) reveal(true);
      else setFb(`Oui. Il en reste ${s.cases.length - cur.found.size}.`, 'ok');
      return;
    }
    sound('bad'); l.board.flash(sq, 'bad'); cur.failed = true;
    if (l.mode === 'controle') reveal(false);
    else setFb('Pas celle-ci. Regarde encore.', 'ko');
  });
}

// --- QCM -----------------------------------------------------------------------------------------
function startQcm() {
  const l = L, s = l.steps[l.idx], cur = l.cur;
  l.handlers = {};
  const box = $('#ls-choices', l.root);
  box.innerHTML = `<div class="qcm">${s.choix.map((c, i) => `<button data-i="${i}">${esc(c)}</button>`).join('')}</div>`;
  box.onclick = e => {
    const b = e.target.closest('[data-i]'); if (!b || cur.done) return;
    const i = +b.dataset.i;
    if (i === s.bon) {
      b.classList.add('ok'); sound('good');
      box.querySelectorAll('button').forEach(x => { x.disabled = true; });
      done(true, `<b>Exact.</b> ${s.ok || ''}`, 'ok');
    } else {
      b.classList.add('ko'); b.disabled = true; sound('bad'); cur.failed = true;
      if (l.mode === 'controle') {
        box.querySelectorAll('button').forEach(x => { x.disabled = true; if (+x.dataset.i === s.bon) x.classList.add('ok'); });
        done(false, `La bonne réponse est surlignée. ${s.ok || ''}`, 'info');
      } else setFb('Pas tout à fait. Essaie une autre réponse.', 'ko');
    }
  };
  actions();
}

// --- partie contre le moteur --------------------------------------------------------------------
const BUT = { mat: 'Fais échec et mat', promo: 'Fais une dame', nulle: 'Tiens la nulle' };
function startPartie() {
  const l = L, s = l.steps[l.idx], cur = l.cur;
  l.handlers = {
    restart: () => show(l.idx),
    hint: async () => {
      if (cur.done || cur.busy || cur.chess.turn() !== cur.side) return;
      cur.failed = true;
      const r = await engine.analyse(cur.chess.fen(), { depth: 14 });
      if (r?.best && L === l && !cur.done) l.board.setArrows([{ from: r.best.slice(0, 2), to: r.best.slice(2, 4), kind: 'hint' }]);
    },
  };
  cur.extraDone = [['restart', 'Recommencer']];
  actions(l.mode === 'controle' ? [['restart', 'Recommencer', 'ghost']] : [['hint', 'Indice'], ['restart', 'Recommencer', 'ghost']]);
  partieStatus();
  if (cur.chess.turn() !== cur.side) botReply(); else { l.board.setDests(destsFor(cur.chess)); l.board.setMovable(cur.side); }
}
function partieStatus(extra = '') {
  const s = L.steps[L.idx], cur = L.cur;
  setFb(`<b>${BUT[s.but]}</b> · coup ${Math.min(cur.n + 1, s.max)} sur ${s.max} au maximum.${extra ? ' ' + extra : ''}`, 'info');
}
function has(chess, color, type) { return chess.board().flat().some(p => p && p.color === color && p.type === type); }
/** Renvoie [succès, message] si la partie-exercice est terminée, sinon null. */
function partieVerdict(afterBot) {
  const s = L.steps[L.idx], cur = L.cur, c = cur.chess, me = cur.side, opp = me === 'w' ? 'b' : 'w';
  const mated = c.isCheckmate(), loser = c.turn();
  if (s.but === 'mat') {
    if (mated && loser === opp) return [true, `<b>Échec et mat</b> en ${cur.n} coups. ${s.ok || ''}`];
    if (c.isStalemate()) return [false, '<b>Pat !</b> Le roi adverse n\'est pas en échec et n\'a plus aucun coup : la partie est nulle. Laisse-lui toujours une case tant que tu ne mates pas.'];
    if (c.isDraw() || c.isInsufficientMaterial()) return [false, 'Partie nulle : tu n\'as plus de quoi mater, ou la position s\'est répétée.'];
    if (afterBot && cur.n >= s.max) return [false, `Tu as dépassé les ${s.max} coups. Recommence en enfermant le roi plus méthodiquement.`];
  }
  if (s.but === 'promo') {
    if (mated && loser === opp) return [true, '<b>Mat !</b> Encore mieux qu\'une dame.'];
    if (afterBot && has(c, me, 'q')) return [true, `<b>Le pion est devenu dame.</b> ${s.ok || 'La suite est le mat dame et roi contre roi.'}`];
    if (!has(c, me, 'p') && !has(c, me, 'q') && !has(c, me, 'r')) return [false, 'Ton pion est perdu. Garde ton roi <b>devant</b> lui pour lui ouvrir la route.'];
    if (c.isStalemate()) return [false, '<b>Pat.</b> Le roi adverse n\'avait plus de coup : n\'avance le pion que si son roi garde une case.'];
    if (c.isDraw()) return [false, 'Partie nulle par répétition.'];
    if (afterBot && cur.n >= s.max) return [false, `Tu as dépassé les ${s.max} coups. Recommence : le roi d'abord, le pion ensuite.`];
  }
  if (s.but === 'nulle') {
    if (mated && loser === me) return [false, 'Échec et mat. Recommence.'];
    if (has(c, opp, 'q')) return [false, 'Le pion est allé à dame. Recommence : reste devant lui, et prends l\'opposition quand son roi avance.'];
    if (c.isStalemate()) return [true, `<b>Pat : partie nulle.</b> ${s.ok || 'C\'est exactement la défense à connaître.'}`];
    if (c.isInsufficientMaterial() || !has(c, opp, 'p')) return [true, `<b>Le pion est pris : partie nulle.</b> ${s.ok || ''}`];
    if (c.isDraw()) return [true, `<b>Partie nulle.</b> ${s.ok || ''}`];
    if (afterBot && cur.n >= s.max) return [true, `<b>Tu as tenu ${s.max} coups</b> sans rien lâcher : la nulle est acquise.`];
  }
  return null;
}
function partieEnd(v) {
  sound(v[0] ? 'good' : 'bad');
  if (!v[0]) L.cur.failed = true;
  done(v[0], v[1], v[0] ? 'ok' : 'ko');
}
function partieMove(from, to, promotion) {
  const l = L, cur = l.cur;
  if (cur.chess.turn() !== cur.side) return false;
  let m;
  try { m = cur.chess.move({ from, to, promotion }); } catch { return false; }
  cur.n++;
  l.board.setArrows([]);
  l.board.setPosition(cur.chess.fen(), { lastMove: [from, to], check: checkSquare(cur.chess) });
  moveSound(m, cur.chess);
  l.board.setMovable(null);
  const v = partieVerdict(false);
  if (v) { partieEnd(v); return true; }
  botReply();
  return true;
}
async function botReply() {
  const l = L, cur = l.cur, tok = l.token;
  cur.busy = true;
  const r = await engine.analyse(cur.chess.fen(), { depth: 14 });
  if (!L || l.token !== tok) return;
  await wait(250);
  if (!L || l.token !== tok) return;
  cur.busy = false;
  const u = r?.best || moveToUci(cur.chess.moves({ verbose: true })[0]);
  const m = uciToMove(cur.chess, u);
  if (m) { l.board.setPosition(cur.chess.fen(), { lastMove: [m.from, m.to], check: checkSquare(cur.chess) }); moveSound(m, cur.chess); }
  const v = partieVerdict(true);
  if (v) { partieEnd(v); return; }
  partieStatus();
  l.board.setDests(destsFor(cur.chess));
  l.board.setMovable(cur.side);
}

// =========================================================================================
// Contrôle de fin de leçon
// =========================================================================================
async function startControl() {
  const l = L, tok = ++l.token;
  engine.cancelAll();
  l.board.setMovable(null); l.board.setOnSquare(null); l.board.setArrows([]); l.board.setMarks({});
  noterPosition(l.lecon.id, 0);
  $('#ls-prof-card', l.root).classList.add('hidden');
  $('#ls-choices', l.root).innerHTML = '';
  $('#ls-meta', l.root).textContent = `Contrôle · ${l.lecon.titre}`;
  $('#ls-prog', l.root).style.width = '0%';
  $('#ls-text', l.root).innerHTML = '<p class="muted">Préparation du contrôle…</p>';
  $('#ls-actions', l.root).innerHTML = '';
  setFb('');
  let steps = (l.lecon.controle || []).slice();
  if (l.lecon.pioche) {
    try {
      const pz = await drawPuzzles(l.lecon.pioche.theme, l.lecon.pioche.n, Math.min(puzzleProfile().rating, 1200));
      steps = steps.concat(pz.map(puzzleStep));
    } catch (e) { console.warn(e); }
  }
  if (!L || l.token !== tok) return;
  const need = Math.ceil(steps.length * SEUIL - 1e-9);
  const e = etatLecon(l.lecon.id);
  $('#ls-text', l.root).innerHTML = `<h3 style="margin-bottom:8px">${e?.fait ? 'Révision' : 'Contrôle'} : ${esc(l.lecon.titre)}</h3>
    <p><b>${steps.length} question${steps.length > 1 ? 's' : ''}</b>, sans indice et sans le professeur. Une seule tentative par question.</p>
    <p>Il te faut <b>${need} bonne${need > 1 ? 's' : ''} réponse${need > 1 ? 's' : ''}</b> pour ${e?.fait ? 'confirmer' : 'valider'} la leçon.</p>`;
  $('#ls-actions', l.root).innerHTML = `${e?.fait ? '' : '<button class="btn ghost" data-a="back">Revoir la leçon</button>'}<button class="btn primary" data-a="go">Commencer</button>`;
  $('#ls-actions', l.root).onclick = ev => {
    const id = ev.target.closest('[data-a]')?.dataset.a;
    if (id === 'back') { l.mode = 'lecon'; l.steps = l.lecon.etapes; show(0); }
    if (id === 'go') { l.mode = 'controle'; l.steps = steps; l.results = []; show(0); }
  };
}
function puzzleStep(p) {
  const c = new Chess(p.fen);
  const m = uciToMove(c, p.moves[0]);
  return { t: 'trouve', fen: c.fen(), dernier: m ? [m.from, m.to] : null, sol: p.moves.slice(1), strict: false, h: '<p>Trouve le meilleur coup.</p>' };
}

function finishControl() {
  const l = L;
  l.token++;
  const ok = l.results.filter(Boolean).length, n = l.steps.length, score = n ? ok / n : 0;
  const avant = etatLecon(l.lecon.id);
  const e = noterControle(l.lecon.id, score);
  const reussi = score >= SEUIL;
  sound(reussi ? 'end' : 'bad');
  l.board.setMovable(null); l.board.setOnSquare(null);
  $('#ls-choices', l.root).innerHTML = '';
  $('#ls-prog', l.root).style.width = '100%';
  setFb('');
  const reco = recommandation();
  const suite = reco.lecon && reco.lecon.id !== l.lecon.id ? `<a class="btn primary" href="#/cours?l=${reco.lecon.id}${reco.type === 'revision' ? '&rev=1' : ''}">Leçon suivante : ${esc(reco.lecon.titre)}</a>` : '';
  const th = l.lecon.theme && l.lecon.theme !== 'mix' ? `<a class="btn" href="#/problemes?theme=${l.lecon.theme}">Problèmes sur ce thème</a>` : '';
  $('#ls-text', l.root).innerHTML = `
    <div class="result-big ${reussi ? 'good-t' : 'bad-t'}">${ok} / ${n}</div>
    <p style="text-align:center;font-weight:600">${reussi ? (avant?.fait ? 'Révision réussie.' : 'Leçon validée !') : 'Pas encore validée.'}</p>
    <p class="small muted" style="text-align:center">${reussi
    ? (e.due ? `Le professeur te la fera réviser le ${fmtDate(e.due)}, pour vérifier que c'est resté.` : 'Tu la maîtrises : elle ne reviendra plus en révision.')
    : `Il fallait ${Math.ceil(n * SEUIL - 1e-9)} bonnes réponses. Relis la leçon, puis retente le contrôle.`}</p>
    <div class="dots">${l.results.map(r => `<i class="${r ? 'ok' : 'ko'}"></i>`).join('')}</div>`;
  $('#ls-actions', l.root).innerHTML = reussi
    ? `${suite}${th}<a class="btn ghost" href="#/cours">Programme</a>`
    : `<button class="btn primary" data-a="again">Revoir la leçon</button><button class="btn" data-a="retry">Retenter le contrôle</button><a class="btn ghost" href="#/cours">Programme</a>`;
  $('#ls-actions', l.root).onclick = ev => {
    const id = ev.target.closest('[data-a]')?.dataset.a;
    if (id === 'again') { l.mode = 'lecon'; l.steps = l.lecon.etapes; l.results = []; show(0); }
    if (id === 'retry') { l.mode = 'lecon'; l.steps = l.lecon.etapes; startControl(); }
  };
}

function finishPrivate() {
  const l = L;
  l.token++;
  const ok = l.results.filter(Boolean).length, n = l.results.length;
  l.board.setMovable(null);
  $('#ls-choices', l.root).innerHTML = '';
  setFb('');
  $('#ls-text', l.root).innerHTML = `
    <div class="result-big">${ok} / ${n}</div>
    <p style="text-align:center;font-weight:600">trouvés du premier coup</p>
    <p class="small muted" style="text-align:center">Ces positions restent dans ton carnet d'erreurs : celles que tu as ratées reviendront plus tôt en révision.</p>`;
  $('#ls-actions', l.root).innerHTML = `<a class="btn primary" href="#/cours">Retour aux cours</a><a class="btn" href="#/carnet">Carnet d'erreurs</a>`;
  $('#ls-actions', l.root).onclick = null;
}

