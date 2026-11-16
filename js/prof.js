// Le professeur de Caïssa : une IA qui connaît le dossier de l'élève.
// Règle d'or : l'IA ne calcule jamais elle-même. Chaque position lui est décrite pièce par pièce,
// avec les variantes de Stockfish ; elle explique, le moteur vérifie.
import { Chess, $, esc, sanFr, uciToMove, moveToUci, pvToSan } from './util.js';
import { settings } from './store.js';
import { chat, hasKey, aiName, aiUsage } from './ai.js';
import { describePosition, describeLine } from './coach.js';
import { engine, formatEval } from './engine.js';
import { puzzleProfile } from './puzzles.js';
import { listMistakes, CATEGORIES, CLASSES, saveGame, describeResult } from './games.js';
import { LECONS, leconById, POUR_CATEGORIE } from './cours-data.js';
import { prof, saveProf, ajouterNote, bilanEleve, etatLecon } from './eleve.js';

export { hasKey, aiName, aiUsage };

// --- fiche de l'élève et consignes --------------------------------------------------------
export function ficheEleve() {
  const s = settings.get(), b = bilanEleve(), p = prof(), pz = puzzleProfile();
  const nom = s.playerName && s.playerName !== 'Moi' ? s.playerName : null;
  const out = [];
  out.push(`${nom ? `Prénom : ${nom}. ` : ''}Elo Caïssa : ${b.elo} (${b.parties} parties classées${b.tendance != null ? `, ${b.tendance >= 0 ? '+' : ''}${b.tendance} sur 30 jours` : ''}). Niveau aux problèmes : ${pz.rating}.`);
  if (p.objectif) out.push(`Son objectif : ${p.objectif}`);
  const faites = LECONS.filter(l => etatLecon(l.id)?.fait);
  out.push(`Leçons validées : ${faites.length}/${LECONS.length}${faites.length ? ` (${faites.slice(-6).map(l => l.titre).join(' ; ')})` : ''}.`);
  if (b.precision != null) out.push(`Sur ses ${Math.min(10, b.analysees)} dernières parties analysées : précision moyenne ${b.precision} %, ${b.gaffesParPartie} gaffe(s) par partie ; par phase : ouverture ${b.phases.ouverture ?? '—'}, milieu ${b.phases.milieu ?? '—'}, finale ${b.phases.finale ?? '—'}.`);
  if (b.faiblesses.length) out.push(`Erreurs les plus fréquentes en partie : ${b.faiblesses.slice(0, 4).map(([k, n]) => `${CATEGORIES[k]} (${n})`).join(', ')}.`);
  if (p.notes.length) out.push(`Tes notes des séances précédentes :\n${p.notes.slice(0, 8).map(n => `- ${n.t}`).join('\n')}`);
  return out.join('\n');
}

const REGLES = `Règles absolues :
- Tu ne calcules jamais toi-même. Appuie-toi UNIQUEMENT sur la liste des pièces et sur les variantes du moteur qui te sont fournies. N'invente aucun coup, aucune pièce, aucune case. Si les données ne suffisent pas pour répondre, dis-le simplement.
- Notation française : R = roi, D = dame, T = tour, F = fou, C = cavalier, rien pour un pion. La description en toutes lettres de chaque coup fait foi. Nomme la pièce en toutes lettres la première fois que tu cites un coup.
- Texte simple : pas de markdown, pas de titres, pas d'astérisques, pas de listes à puces.`;

export function profSystem(mode = '') {
  return `Tu es le professeur d'échecs particulier de l'appli Caïssa. Tu parles français, tu tutoies ton élève, tu es chaleureux, exigeant et concret, comme un bon entraîneur de club qui suit le même élève depuis des mois.

Fiche de ton élève :
${ficheEleve()}

Ta pédagogie :
- Explique l'idée avant la variante, avec des mots simples, au niveau de l'élève.
- Rattache chaque explication à un réflexe réutilisable (par exemple la routine Échecs · Prises · Menaces, compter attaquants et défenseurs).
- Quand c'est utile, relie ce que tu vois à ce que tu sais déjà de lui (ses erreurs fréquentes, ses notes) : c'est ce qui fait de toi son professeur et non un commentateur.
- Encourage ce qui est bien fait, sans flatterie. Dis clairement ce qui est faux.
${mode}
${REGLES}`;
}

// --- moteur : la vérité sur la position ------------------------------------------------------
async function lignes(fen, n = 3, depth = 12) {
  const c = new Chess(fen);
  if (c.isGameOver()) return [];
  try { const r = await engine.analyse(fen, { depth, multipv: n }); return r?.lines || []; } catch { return []; }
}
const evalBlancs = (l, fen) => `${formatEval(l, true, fen.split(' ')[1])} (point de vue des Blancs)`;

const FR_EN = { R: 'K', D: 'Q', T: 'R', F: 'B', C: 'N' };
/** Coups cités par l'élève dans sa question (« pourquoi pas Cf3 ? ») et jouables dans la position. */
export function movesInText(text, fen) {
  const out = [];
  const re = /(^|[^A-Za-zÀ-ÿ0-9])((?:[RDTFC][a-h]?[1-8]?x?[a-h][1-8]|[a-h]x[a-h][1-8](?:=[DTFC])?|[a-h][1-8](?:=[DTFC])?|O-O-O|O-O|0-0-0|0-0)[+#]?)(?![A-Za-zÀ-ÿ0-9])/g;
  let m;
  while ((m = re.exec(text))) {
    const tok = m[2];
    // « en e5 », « la case e5 » : une case, pas un coup de pion
    if (/^[a-h][1-8]$/.test(tok) && /(?:\ben|case|sur|vers|à)\s*$/i.test(text.slice(0, m.index + m[1].length))) continue;
    const san = tok.replace(/0/g, 'O').replace(/^[RDTFC]/, p => FR_EN[p]).replace(/=([DTFC])/, (_, p) => '=' + FR_EN[p]);
    try {
      const c = new Chess(fen);
      const mv = c.move(san);
      if (mv && !out.some(o => o.uci === moveToUci(mv))) out.push({ san: mv.san, uci: moveToUci(mv), fen: c.fen() });
    } catch { /* pas un coup jouable ici */ }
    if (out.length >= 2) break;
  }
  return out;
}

/** Bloc « position » transmis à l'IA : pièces, variantes du moteur, coups envisagés par l'élève. */
export async function contextePosition(fen, question = '', { lines = null } = {}) {
  const c = new Chess(fen);
  let t = `Position actuelle (liste exacte des pièces) :\n${describePosition(fen)}`;
  if (c.isCheckmate()) return t + '\nLa partie est terminée : échec et mat.';
  if (c.isGameOver()) return t + '\nLa partie est terminée : nulle.';
  const ls = lines?.length ? lines : await lignes(fen, 3, 12);
  if (ls.length) t += `\n\nMeilleures suites selon le moteur :\n${ls.slice(0, 3).map((l, i) => `Suite ${i + 1} — évaluation ${evalBlancs(l, fen)} :\n${describeLine(fen, l.pv, 6)}`).join('\n\n')}`;
  else t += '\n\n(Variantes du moteur indisponibles pour cette position.)';
  for (const mv of movesInText(question, fen)) {
    const after = await lignes(mv.fen, 1, 12);
    const over = new Chess(mv.fen);
    t += `\n\nCoup envisagé par l'élève dans sa question :\n${describeLine(fen, [mv.uci], 1)}`;
    if (over.isCheckmate()) t += '\nCe coup fait échec et mat.';
    else if (after[0]) t += `\nÉvaluation après ce coup : ${evalBlancs(after[0], mv.fen)}.\nMeilleure réponse adverse et suite :\n${describeLine(mv.fen, after[0].pv, 5)}`;
  }
  return t;
}

/** Réfutation d'un coup par le moteur, pour les corrections sans IA : { san, pv, cp } ou null. */
export async function refutation(fenApres) {
  const l = (await lignes(fenApres, 1, 12))[0];
  if (!l?.pv?.length) return null;
  return { line: l, san: pvToSan(fenApres, l.pv, 1)[0] };
}

// --- réponses structurées : [TITRE] … [SECTION] … ---------------------------------------------
function sections(text) {
  const out = {};
  const re = /^\s*\[([A-ZÀ-Ü0-9 ]+)\]\s*:?\s*/gm;
  let m, last = null, start = 0;
  while ((m = re.exec(text))) {
    if (last) out[last] = text.slice(start, m.index).trim();
    last = m[1].trim().replace(/\s+/g, ' ');
    start = re.lastIndex;
  }
  if (last) out[last] = text.slice(start).trim();
  return out;
}
const propre = t => String(t || '').replace(/\*\*/g, '').replace(/^#+\s*/gm, '').trim();

// --- conversation ----------------------------------------------------------------------------
export function sansCle(el, texte = 'Le professeur a besoin d\'une clé API pour te répondre.') {
  el.innerHTML = `<div class="fb info">${esc(texte)} <button class="btn sm" data-ai-settings style="margin-top:6px">Configurer le professeur</button></div>`;
  el.querySelector('[data-ai-settings]').onclick = () => document.dispatchEvent(new CustomEvent('caissa:ai-settings'));
}

/**
 * Conversation avec le professeur.
 * opts.contexte(question) → texte décrivant la situation (position, leçon…) joint à chaque question ;
 * opts.mode → consignes propres à l'écran (leçon, partie en cours…) ; opts.suggestions → questions toutes prêtes.
 */
export function mountChat(el, opts = {}) {
  let hist = [];
  let busy = false;
  const render = () => {
    if (!hasKey()) { sansCle(el, opts.sansCle || 'Avec une clé API, tu peux poser tes questions au professeur ici.'); return; }
    el.innerHTML = `
      <div class="chat">
        <div class="chat-log" aria-live="polite"></div>
        ${opts.suggestions?.length ? `<div class="chips chat-sugg">${opts.suggestions.map(s => `<button class="chip" type="button">${esc(s)}</button>`).join('')}</div>` : ''}
        <form class="chat-form"><textarea rows="1" placeholder="${esc(opts.placeholder || 'Pose ta question au professeur…')}" enterkeyhint="send"></textarea><button class="btn primary sm" type="submit">Envoyer</button></form>
      </div>`;
    const ta = $('textarea', el);
    $('form', el).onsubmit = e => { e.preventDefault(); const q = ta.value.trim(); if (q) { ta.value = ''; ask(q); } };
    ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('form', el).requestSubmit(); } });
    el.querySelectorAll('.chat-sugg .chip').forEach(b => { b.onclick = () => ask(b.textContent); });
    draw();
  };
  const draw = pending => {
    const log = $('.chat-log', el); if (!log) return;
    log.innerHTML = hist.map(h => `<div class="msg me">${esc(h.q)}</div>${h.a != null ? `<div class="msg prof ${h.err ? 'err' : ''}">${esc(h.a)}</div>` : ''}`).join('') + (pending ? '<div class="msg prof loading">Le professeur réfléchit…</div>' : '');
    log.scrollTop = log.scrollHeight;
  };
  async function ask(q) {
    if (busy) return;
    busy = true;
    const turn = { q, a: null };
    hist.push(turn);
    draw(true);
    try {
      const ctx = opts.contexte ? await opts.contexte(q) : '';
      const past = hist.slice(0, -1).filter(h => h.a && !h.err).slice(-5);
      const messages = [];
      for (const h of past) { messages.push({ role: 'user', content: h.q }); messages.push({ role: 'assistant', content: h.a }); }
      messages.push({ role: 'user', content: `${ctx ? ctx + '\n\n' : ''}Question de l'élève : ${q}` });
      const mode = typeof opts.mode === 'function' ? opts.mode() : opts.mode;
      turn.a = propre(await chat(messages, { system: profSystem(mode || MODE_CHAT), maxTokens: 600 }));
    } catch (e) { turn.a = e.message; turn.err = true; }
    busy = false;
    draw();
  }
  render();
  return { ask, reset() { hist = []; if (!busy) render(); }, refresh: render };
}
const MODE_CHAT = '- Réponds en 2 à 6 phrases. Termine par une question courte seulement si elle aide l\'élève à trouver lui-même.';
export const MODE_EXERCICE = `- L'élève est en plein exercice : ne donne PAS la solution. Guide-le par une question ou un indice (quelle pièce n'est pas défendue ? quel échec ?). Donne la solution seulement s'il la demande explicitement.
- Réponds en 2 à 4 phrases.`;
export const MODE_PARTIE = `- L'élève est en pleine partie d'entraînement : ne lui donne PAS le meilleur coup. Aide-le à réfléchir : que menace l'adversaire, quelles pièces ne sont pas défendues, quel plan. S'il propose un coup, dis-lui ce que le moteur en pense et pourquoi.
- Réponds en 2 à 4 phrases.`;

// --- débrief de partie -------------------------------------------------------------------------
/** Les moments de la partie sur lesquels le professeur revient (choisis par le moteur, pas par l'IA). */
export function momentsCles(g) {
  const an = g.analysis; if (!an || !g.you) return [];
  const mine = an.moves.map((m, k) => ({ m, k })).filter(x => an.positions[x.k].turn === g.you);
  let bad = mine.filter(x => ['blunder', 'miss', 'mistake'].includes(x.m.cls)).sort((a, b) => b.m.drop - a.m.drop).slice(0, 3);
  if (!bad.length) bad = mine.filter(x => x.m.cls === 'inaccuracy').sort((a, b) => b.m.drop - a.m.drop).slice(0, 2);
  const good = mine.find(x => ['brilliant', 'great'].includes(x.m.cls));
  const out = bad.slice(0, good ? 2 : 3);
  if (good) out.push(good);
  return out.sort((a, b) => a.k - b.k);
}

function momentTexte(g, x, i) {
  const an = g.analysis, before = an.positions[x.k], after = an.positions[x.k + 1], mv = x.m;
  const n = Math.floor(x.k / 2) + 1;
  const bon = ['brilliant', 'great'].includes(mv.cls);
  let t = `=== MOMENT ${i + 1} — ${n}${before.turn === 'w' ? '.' : '…'} ${sanFr(mv.san)}, classé « ${CLASSES[mv.cls]?.name} »${mv.category ? `, type d'erreur : ${CATEGORIES[mv.category]}` : ''} ===
Position avant le coup :
${describePosition(before.fen)}
Coup joué par l'élève :
${describeLine(before.fen, [mv.uci], 1)}
Évaluation après ce coup : ${evalBlancs(after.line, after.fen)}.`;
  if (!bon) {
    t += `\nMeilleure suite à la place (évaluation ${evalBlancs(before.line, before.fen)}) :\n${describeLine(before.fen, before.line?.pv || [], 5)}`;
    if (after.line?.pv?.length) t += `\nCe que l'adversaire pouvait répondre au coup joué :\n${describeLine(after.fen, after.line.pv, 5)}`;
  } else t += `\nSuite prévue par le moteur :\n${describeLine(after.fen, after.line?.pv || [], 4)}`;
  return t;
}

export function leconPour(categories) {
  const count = {};
  for (const c of categories) if (c) count[c] = (count[c] || 0) + 1;
  const top = Object.entries(count).sort((a, b) => b[1] - a[1])[0]?.[0];
  if (!top) return null;
  const ids = POUR_CATEGORIE[top] || [];
  return leconById(ids.find(id => !etatLecon(id)?.fait) || ids[0]) || null;
}

export async function debrief(g) {
  const an = g.analysis;
  if (!an || !g.you) throw new Error('Analyse d\'abord la partie et indique quel camp tu jouais.');
  const moments = momentsCles(g);
  const me = g.you, opp = me === 'w' ? 'b' : 'w';
  const res = describeResult(g);
  const c = an.counts[me], cl = an.classes[me];
  const prompt = `Fais le débrief de cette partie pour ton élève.

Partie : ${g.white} contre ${g.black}. L'élève avait les ${me === 'w' ? 'Blancs' : 'Noirs'}. Résultat : ${g.result} (${res.txt || 'non terminé'})${g.termination ? `, fin : ${g.termination}` : ''}.
Adversaire : ${me === 'w' ? g.black : g.white}${g.botElo ? ` (environ ${g.botElo} Elo)` : ''}.${g.timeControl ? ` Cadence : ${g.timeControl}.` : ''} ${an.moves.length} demi-coups.
${an.opening?.name ? `Ouverture : ${an.opening.name}.` : ''}
Précision de l'élève : ${an.acc[me] ?? '—'} % (adversaire : ${an.acc[opp] ?? '—'} %). Par phase : ouverture ${an.phases[me].opening ?? '—'}, milieu de partie ${an.phases[me].middlegame ?? '—'}, finale ${an.phases[me].endgame ?? '—'}.
Coups de l'élève : ${c.blunder} gaffe(s), ${c.mistake} erreur(s), ${c.inaccuracy} imprécision(s), ${cl.miss} occasion(s) manquée(s), ${cl.best + cl.excellent + cl.great + cl.brilliant} coups excellents ou meilleurs.

${moments.length ? `Moments clés retenus par le moteur :\n\n${moments.map((x, i) => momentTexte(g, x, i)).join('\n\n')}` : 'Aucune erreur notable de l\'élève dans cette partie.'}

Écris le débrief exactement dans ce format, avec les balises entre crochets seules sur leur ligne :
[RESUME]
2 ou 3 phrases : l'histoire de la partie, ce que l'élève a bien fait, le moment où elle a basculé.
${moments.map((_, i) => `[MOMENT ${i + 1}]\n3 ou 4 phrases : ce que l'élève n'a pas vu ou a bien vu, ce qu'il fallait jouer et pourquoi, et la question qu'il devait se poser à ce moment-là.`).join('\n')}
[A TRAVAILLER]
Une seule priorité pour la prochaine partie, formulée comme un réflexe concret.
[NOTE]
Une ligne de 20 mots maximum pour ta fiche de suivi : la tendance observée chez l'élève dans cette partie.`;
  const txt = propre(await chat([{ role: 'user', content: prompt }], { system: profSystem(), maxTokens: 1300 }));
  const s = sections(txt);
  const d = {
    at: Date.now(), par: aiName(),
    resume: s.RESUME || s['RÉSUMÉ'] || s['RESUMÉ'] || (Object.keys(s).length ? '' : txt),
    moments: moments.map((x, i) => ({ k: x.k, san: x.m.san, cls: x.m.cls, texte: s[`MOMENT ${i + 1}`] || '' })).filter(m => m.texte),
    travail: s['A TRAVAILLER'] || s['À TRAVAILLER'] || '',
    lecon: leconPour(moments.map(x => x.m.category))?.id || null,
  };
  if (s.NOTE) ajouterNote(s.NOTE, 'débrief');
  g.debrief = d;
  saveGame(g);
  return d;
}

// --- cours particulier : une leçon bâtie sur les erreurs de l'élève -------------------------------
export function matierePourCours(cat) {
  const all = listMistakes().filter(m => m.best && (cat === 'tout' || m.category === cat));
  return all.sort((a, b) => (a.solved / Math.max(1, a.reviews)) - (b.solved / Math.max(1, b.reviews)) || b.drop - a.drop).slice(0, 4);
}

export async function coursParticulier(cat, onEtape) {
  const items = matierePourCours(cat);
  if (items.length < 2) throw new Error('Il me faut au moins deux erreurs de ce type dans ton carnet. Analyse quelques parties, puis reviens.');
  const blocs = [];
  for (let i = 0; i < items.length; i++) {
    const m = items[i];
    onEtape?.(`Je revois ta position ${i + 1} sur ${items.length} avec le moteur…`);
    const c = new Chess(m.fen);
    const played = uciToMove(c, m.played);
    const ref = played ? await refutation(c.fen()) : null;
    blocs.push(`=== POSITION ${i + 1} — partie contre ${m.opponent || '?'}, type d'erreur : ${CATEGORIES[m.category] || 'autre'} ===
${describePosition(m.fen)}
Coup joué par l'élève en partie :
${describeLine(m.fen, [m.played], 1)}
${ref ? `Ce que l'adversaire pouvait répondre :\n${describeLine(c.fen(), ref.line.pv, 4)}` : ''}
Meilleure suite selon le moteur :
${describeLine(m.fen, m.pv?.length ? m.pv : [m.best], 5)}`);
  }
  onEtape?.('Je prépare ton cours…');
  const prompt = `Prépare un cours particulier pour ton élève à partir de ${items.length} positions tirées de SES propres parties, où il s'est trompé${cat !== 'tout' ? ` (thème : ${CATEGORIES[cat]})` : ''}. Il va rejouer chaque position et chercher le bon coup.

${blocs.join('\n\n')}

Écris le cours exactement dans ce format, avec les balises entre crochets seules sur leur ligne :
[TITRE]
Un titre court pour ce cours (6 mots maximum).
[INTRO]
3 phrases : le point commun entre ces erreurs et l'idée que l'élève doit retenir aujourd'hui.
${items.map((_, i) => `[QUESTION ${i + 1}]\nUne phrase ou deux pour orienter son regard sur la position ${i + 1} SANS donner le coup ni la pièce à jouer.\n[EXPLICATION ${i + 1}]\n3 phrases, à lire après sa réponse : pourquoi son coup en partie échouait, pourquoi le bon coup marche.`).join('\n')}
[REFLEXE]
Le réflexe à emporter, en une ou deux phrases.
[NOTE]
Une ligne de 20 mots maximum pour ta fiche de suivi de l'élève.`;
  const txt = propre(await chat([{ role: 'user', content: prompt }], { system: profSystem(), maxTokens: 1600 }));
  const s = sections(txt);
  const cours = {
    id: 'cp-' + Date.now().toString(36), at: Date.now(), cat, par: aiName(),
    titre: (s.TITRE || (cat === 'tout' ? 'Tes erreurs récentes' : CATEGORIES[cat])).split('\n')[0].slice(0, 80),
    intro: s.INTRO || 'Voici des positions de tes parties. Dans chacune, tu avais mieux à jouer.',
    reflexe: s.REFLEXE || s['RÉFLEXE'] || '',
    items: items.map((m, i) => ({
      mid: m.id, fen: m.fen, best: m.best, pv: m.pv || [m.best], played: m.played, playedSan: m.playedSan, bestSan: m.bestSan, opponent: m.opponent || '',
      question: s[`QUESTION ${i + 1}`] || 'Regarde bien la position : échecs, prises, menaces.', explication: s[`EXPLICATION ${i + 1}`] || '',
    })),
  };
  if (s.NOTE) ajouterNote(s.NOTE, 'cours particulier');
  saveProf({ cours: [cours, ...prof().cours].slice(0, 8) });
  return cours;
}

// --- bulletin : le point d'étape du professeur ----------------------------------------------------
export async function bulletin() {
  const b = bilanEleve();
  const reste = LECONS.filter(l => !etatLecon(l.id)?.fait);
  const prompt = `Rédige le bulletin de ton élève : un point d'étape honnête et motivant.

Chiffres :
- Elo Caïssa ${b.elo} sur ${b.parties} parties classées${b.tendance != null ? `, évolution sur 30 jours : ${b.tendance >= 0 ? '+' : ''}${b.tendance}` : ''}.
- 20 dernières parties : ${b.resultats.v} victoires, ${b.resultats.n} nulles, ${b.resultats.d} défaites.
- Programme : ${b.avancement.faites} leçons validées sur ${b.avancement.total}.
- Carnet d'erreurs : ${b.erreurs} positions.
(Le reste de sa fiche t'a été donné plus haut.)

Leçons du programme qu'il n'a pas encore validées : ${reste.length ? reste.map(l => `« ${l.titre} »`).join(', ') : 'aucune, tout est validé'}.
Autres outils de l'appli que tu peux lui prescrire : problèmes par thème, parties d'entraînement contre des personnages qui jouent comme des humains, parties classées, révision du carnet d'erreurs, cours particulier sur ses erreurs.

Format exact, balises entre crochets seules sur leur ligne :
[BILAN]
2 ou 3 phrases : où il en est vraiment.
[POINTS FORTS]
2 phrases.
[A TRAVAILLER]
2 ou 3 phrases : la priorité, et pourquoi d'après ses chiffres.
[PROGRAMME]
Le programme de la semaine en trois actions précises, numérotées 1, 2, 3, une par ligne, en citant des leçons ou des outils ci-dessus.
[NOTE]
Une ligne de 20 mots maximum pour ta fiche de suivi.`;
  const txt = propre(await chat([{ role: 'user', content: prompt }], { system: profSystem(), maxTokens: 1000 }));
  const s = sections(txt);
  const bu = { at: Date.now(), par: aiName(), bilan: s.BILAN || (Object.keys(s).length ? '' : txt), forts: s['POINTS FORTS'] || '', travail: s['A TRAVAILLER'] || s['À TRAVAILLER'] || '', programme: s.PROGRAMME || '' };
  if (s.NOTE) ajouterNote(s.NOTE, 'bulletin');
  saveProf({ bulletins: [bu, ...prof().bulletins].slice(0, 6) });
  return bu;
}

export function usageTexte() {
  const u = aiUsage();
  if (!u.calls) return 'Aucune demande au professeur ce mois-ci.';
  const k = n => (n >= 1000 ? `${Math.round(n / 100) / 10} k` : String(n));
  return `Ce mois-ci : ${u.calls} demande${u.calls > 1 ? 's' : ''} au professeur · ${k(u.in)} tokens envoyés · ${k(u.out)} tokens reçus.`;
}
