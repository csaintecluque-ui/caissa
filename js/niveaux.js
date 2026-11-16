// Ce qui fait évoluer l'entraînement avec l'élève : un niveau par thème tactique,
// l'objectif Elo du moment et ses leviers, la séance du jour et sa régularité.
import { store, settings } from './store.js';
import { playerRating } from './rating.js';
import { MODULES } from './cours-data.js';
import { etatLecon, bilanEleve } from './eleve.js';
import { BOTS } from './bots.js';

const JOUR = 86400000;

// --- thèmes de travail : dans l'ordre où le professeur les introduit --------------------------
// [identifiant Lichess, nom, idée en une ou deux phrases, réflexe]
export const THEMES_TRAVAIL = [
  ['hangingPiece', 'Pièce en prise', 'Une pièce adverse n\'est pas défendue, ou pas assez : il suffit de la prendre. C\'est le gain le plus fréquent à tous les niveaux.', 'Après chaque coup adverse : quelle pièce n\'est plus défendue ?'],
  ['mateIn1', 'Mat en 1', 'Le roi adverse n\'a plus de case et un échec suffit. Encore faut-il regarder tous ses échecs.', 'Commence toujours ta réflexion par tes échecs.'],
  ['fork', 'Fourchette', 'Une pièce en attaque deux à la fois : l\'adversaire ne peut en sauver qu\'une.', 'Cherche les pièces non défendues et le roi exposé : peuvent-ils être attaqués ensemble ?'],
  ['pin', 'Clouage', 'Une pièce ne peut pas bouger parce qu\'elle protège plus précieux derrière elle. On l\'attaque, ou on profite de ce qu\'elle ne défend plus rien.', 'Pièce clouée : attaque-la, de préférence avec un pion.'],
  ['backRankMate', 'Mat du couloir', 'Le roi est enfermé derrière ses pions : un échec sur la dernière rangée le mate.', 'Roi sans case de fuite : compte les défenseurs de la dernière rangée.'],
  ['skewer', 'Enfilade', 'Deux pièces sur la même ligne, la plus précieuse devant : elle doit fuir et celle de derrière tombe.', 'Roi et dame sur la même ligne : cherche l\'échec en enfilade.'],
  ['discoveredAttack', 'Attaque à la découverte', 'Une pièce s\'écarte et démasque l\'attaque de celle qui est derrière : deux menaces en un coup.', 'Une de tes pièces masque ta tour ou ton fou ? Regarde ce qui se passe si elle bouge.'],
  ['mateIn2', 'Mat en 2', 'Un premier coup forçant — souvent un échec ou un sacrifice — ne laisse qu\'une réponse, puis le mat tombe.', 'Échecs d\'abord, même ceux qui donnent du matériel.'],
  ['trappedPiece', 'Pièce piégée', 'Une pièce adverse n\'a plus aucune case de fuite : il suffit de l\'attaquer.', 'Pièce avancée dans ton camp : compte ses cases de retraite.'],
  ['capturingDefender', 'Éliminer le défenseur', 'La pièce visée est défendue par une seule pièce : prends, chasse ou échange ce défenseur, et elle tombe.', 'Cible défendue : qui la défend, et puis-je m\'en débarrasser ?'],
  ['doubleCheck', 'Échec double', 'Deux pièces donnent échec en même temps : le roi est obligé de bouger, on ne peut ni prendre ni couvrir.', 'Échec à la découverte possible ? Regarde si la pièce qui s\'écarte peut donner échec aussi.'],
  ['deflection', 'Déviation', 'On force une pièce adverse à quitter la case ou la ligne qu\'elle gardait.', 'Quelle pièce adverse fait un travail indispensable ? Force-la à partir.'],
  ['attraction', 'Attraction', 'On attire une pièce adverse, souvent le roi, sur une mauvaise case par un sacrifice.', 'Si son roi était sur telle case, y aurait-il une fourchette ou un mat ?'],
  ['sacrifice', 'Sacrifice', 'Donner du matériel pour gagner mieux : un mat, plus de matériel, une attaque décisive.', 'Un coup « impossible » parce qu\'il perd une pièce ? Calcule-le quand même.'],
  ['promotion', 'Promotion', 'Un pion va à dame, ou la menace de promotion gagne du matériel.', 'Pion sur la 6e ou la 7e rangée : rien n\'est trop cher pour le faire passer.'],
  ['advancedPawn', 'Pion avancé', 'Un pion très avancé crée des menaces tactiques : il gêne le roi, soutient un mat ou va à dame.', 'Ton pion avancé est un attaquant de plus : compte-le.'],
  ['pawnEndgame', 'Finale de pions', 'Rois et pions seulement : tout se joue sur l\'opposition, le carré et le compte des temps.', 'Le roi d\'abord, les pions ensuite.'],
  ['rookEndgame', 'Finale de tours', 'La finale la plus fréquente. Tour active, roi actif, tour derrière le pion passé.', 'Une tour active vaut mieux qu\'un pion de plus.'],
  ['exposedKing', 'Roi exposé', 'Le roi adverse a perdu son abri de pions : les échecs s\'enchaînent et gagnent du matériel ou matent.', 'Roi à découvert : garde les dames et cherche les échecs.'],
  ['kingsideAttack', 'Attaque sur le roque', 'Plusieurs pièces convergent vers le roi roqué : il y a souvent un sacrifice qui ouvre la position.', 'Compte tes attaquants et ses défenseurs près du roi.'],
  ['intermezzo', 'Coup intermédiaire', 'Au lieu de la reprise évidente, on glisse d\'abord un coup plus fort — souvent un échec — puis on reprend.', 'Avant de reprendre : ai-je un échec ou une menace plus forte ?'],
  ['defensiveMove', 'Coup défensif', 'La position est menacée : un seul coup précis pare tout et garde l\'avantage.', 'Menace sérieuse : liste toutes les façons de la parer avant de choisir.'],
  ['quietMove', 'Coup tranquille', 'Ni échec ni prise : un coup calme qui crée une menace imparable.', 'Quand les échecs ne donnent rien : quel coup prépare une menace que l\'on ne peut pas parer ?'],
  ['mateIn3', 'Mat en 3', 'Une suite forcée de trois coups. Chaque coup doit laisser le moins de réponses possible.', 'Calcule les suites où l\'adversaire n\'a qu\'une réponse.'],
  ['smotheredMate', 'Mat à l\'étouffée', 'Le roi est entouré de ses propres pièces : un cavalier le mate seul.', 'Roi dans le coin, entouré des siens : cherche l\'échec de cavalier.'],
  ['xRayAttack', 'Rayons X', 'Une pièce attaque ou défend à travers une autre pièce placée sur sa ligne.', 'Regarde ce que tes pièces visent « à travers » les autres.'],
  ['interference', 'Interférence', 'On place une pièce entre deux pièces adverses pour couper leur liaison.', 'Deux pièces adverses se protègent sur une ligne : puis-je la couper ?'],
  ['clearance', 'Dégagement', 'On libère une case ou une ligne occupée par sa propre pièce, souvent en la sacrifiant avec gain de temps.', 'Ma pièce gêne mon attaque : peut-elle partir en menaçant quelque chose ?'],
  ['zugzwang', 'Zugzwang', 'L\'adversaire n\'est pas menacé, mais tous ses coups aggravent sa position : il perd parce qu\'il doit jouer.', 'En finale : quel coup d\'attente le force à lâcher quelque chose ?'],
  ['queenEndgame', 'Finale de dames', 'Dames et pions : les échecs perpétuels et les pions passés décident de tout.', 'Mets ton roi à l\'abri des échecs avant de pousser ton pion.'],
  ['bishopEndgame', 'Finale de fous', 'Fous et pions : la couleur des cases des pions et l\'activité du roi font la différence.', 'Tes pions sur la couleur opposée à ton fou.'],
  ['knightEndgame', 'Finale de cavaliers', 'Cavaliers et pions : proche d\'une finale de pions, le pion passé éloigné est roi.', 'Le cavalier est lent : crée un pion passé loin de lui.'],
];
export const THEME = Object.fromEntries(THEMES_TRAVAIL.map(([id, nom, idee, reflexe], i) => [id, { id, nom, idee, reflexe, rang: i }]));

// --- niveau par thème (Elo propre à chaque thème) ------------------------------------------------
function base() { return store.get('puzzleProfile', {}).rating || 1000; }
export function niveauxThemes() { return store.get('themes', {}); }
export function niveauTheme(id) {
  const t = niveauxThemes()[id];
  return t ? { ...t } : { r: base(), n: 0, ok: 0, neuf: true };
}
/** À appeler après chaque problème : met à jour le niveau de chacun de ses thèmes de travail. */
export function noterThemes(puzzle, score) {
  const all = niveauxThemes();
  for (const id of puzzle.themes || []) {
    if (!THEME[id]) continue;
    const t = all[id] || { r: base(), n: 0, ok: 0 };
    const K = t.n < 12 ? 40 : 24;
    const exp = 1 / (1 + Math.pow(10, ((puzzle.rating || t.r) - t.r) / 400));
    t.r = Math.max(400, Math.round(t.r + K * (score - exp)));
    t.n++; if (score >= 1) t.ok++;
    t.at = Date.now();
    all[id] = t;
  }
  store.set('themes', all);
}
/** Thèmes ouverts à ce niveau : le programme s'élargit quand le niveau aux problèmes monte. */
export function themesOuverts() {
  const n = Math.min(THEMES_TRAVAIL.length, 8 + Math.max(0, Math.floor((base() - 900) / 100)) * 3);
  return THEMES_TRAVAIL.slice(0, n).map(t => THEME[t[0]]);
}
/** Les thèmes à travailler en priorité : les plus faibles, les jamais vus d'abord explorés. */
export function themesPrioritaires(max = 3) {
  const s = seances();
  const b = base();
  return themesOuverts()
    .map(t => { const n = niveauTheme(t.id); return { ...t, niveau: n, cle: (n.neuf ? b - 60 : n.r) + (s.dernierTheme === t.id ? 500 : 0) + t.rang }; })
    .sort((a, b2) => a.cle - b2.cle).slice(0, max);
}

// --- objectif Elo et leviers -----------------------------------------------------------------------
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export function objectif() {
  const r = playerRating(), b = bilanEleve();
  const cible = clamp(Math.floor(r.elo / 100) * 100 + 100, 600, 2400);
  const depart = cible - 100;
  const pz = base();
  const themes = niveauxThemes();
  const gaffesMax = Math.round(clamp(3.7 - cible / 500, 0.3, 2.5) * 10) / 10;
  const precisionMin = clamp(Math.round(48 + cible / 50), 60, 90);
  const modulesRequis = cible <= 1000 ? ['m1'] : cible <= 1100 ? ['m1', 'm2'] : cible <= 1200 ? ['m1', 'm2', 'm3', 'm4'] : MODULES.map(m => m.id);
  const lecons = MODULES.filter(m => modulesRequis.includes(m.id)).flatMap(m => m.lecons);
  const leconsOk = lecons.filter(l => etatLecon(l.id)?.fait).length;
  const themesCible = clamp(3 + Math.round((cible - 1000) / 100) * 2, 3, 20);
  const themesOk = Object.entries(themes).filter(([id, t]) => THEME[id] && t.n >= 6 && t.r >= cible).length;
  const s = seances();
  const semaine = s.hist.filter(h => h.t > Date.now() - 7 * JOUR).length;
  const assez = b.analysees >= 3;
  const leviers = [
    { id: 'problemes', nom: 'Niveau aux problèmes', val: pz, cible: pz >= cible + 150 ? pz : cible + 150, txt: `${pz} / ${cible + 150}`, pct: clamp((pz - (cible - 150)) / 300, 0, 1), ok: pz >= cible + 150, aide: 'Les séances du jour et les ateliers le font monter.' },
    { id: 'gaffes', nom: 'Gaffes par partie', txt: assez ? `${b.gaffesParPartie} (objectif : ${gaffesMax} ou moins)` : 'à mesurer', pct: assez ? clamp(1 - (b.gaffesParPartie - gaffesMax) / 2, 0, 1) : 0, ok: assez && b.gaffesParPartie <= gaffesMax, aide: assez ? 'La routine avant chaque coup, et la révision de ton carnet d\'erreurs.' : 'Analyse au moins 3 de tes parties pour que le professeur puisse mesurer.' },
    { id: 'precision', nom: 'Précision moyenne', txt: assez && b.precision != null ? `${b.precision} % (objectif : ${precisionMin} %)` : 'à mesurer', pct: assez && b.precision != null ? clamp((b.precision - (precisionMin - 20)) / 20, 0, 1) : 0, ok: assez && b.precision >= precisionMin, aide: 'Elle monte quand les gaffes baissent : débriefe chaque partie.' },
    { id: 'bases', nom: 'Leçons du programme', txt: `${leconsOk} / ${lecons.length}`, pct: lecons.length ? leconsOk / lecons.length : 1, ok: leconsOk >= lecons.length, aide: 'Les modules à maîtriser pour ce palier.' },
    { id: 'themes', nom: `Thèmes au niveau ${cible}`, txt: `${themesOk} / ${themesCible}`, pct: clamp(themesOk / themesCible, 0, 1), ok: themesOk >= themesCible, aide: 'Un thème compte quand tu y as résolu au moins 6 problèmes et que ton niveau y atteint le palier.' },
    { id: 'regularite', nom: 'Séances cette semaine', txt: `${semaine} / 4`, pct: clamp(semaine / 4, 0, 1), ok: semaine >= 4, aide: 'Quinze minutes quatre fois par semaine valent mieux que deux heures le dimanche.' },
  ];
  return { elo: r.elo, parties: r.games, provisoire: r.games < 10, cible, depart, pct: clamp((r.elo - depart) / 100, 0, 1), leviers, faits: leviers.filter(l => l.ok).length };
}

// --- séances -----------------------------------------------------------------------------------------
const jourDe = t => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export function seances() { return { total: 0, serie: 0, record: 0, dernier: null, dernierTheme: null, hist: [], ...store.get('seances', {}) }; }
export function seanceFaiteAujourdhui() { return seances().dernier === jourDe(Date.now()); }
export function serieEnCours() { const s = seances(); return s.dernier === jourDe(Date.now()) || s.dernier === jourDe(Date.now() - JOUR) ? s.serie : 0; }
export function noterSeance(theme, ok, n) {
  const s = seances(), today = jourDe(Date.now());
  if (s.dernier !== today) {
    s.serie = s.dernier === jourDe(Date.now() - JOUR) ? s.serie + 1 : 1;
    s.record = Math.max(s.record, s.serie);
    s.total++;
  }
  s.dernier = today; s.dernierTheme = theme;
  s.hist.push({ t: Date.now(), theme, ok, n });
  s.hist = s.hist.slice(-120);
  store.set('seances', s);
  return s;
}

// --- la partie conseillée après la séance ----------------------------------------------------------------
const CONSIGNES = {
  hanging: 'Avant de lâcher chaque coup : ma pièce est-elle défendue sur sa case d\'arrivée ?',
  allowedTactic: 'Après chaque coup adverse, avant de penser à ton plan : que veut-il ?',
  allowedMate: 'À chaque coup, vérifie la sécurité de ton roi : ses échecs, tes cases de fuite.',
  missedTactic: 'À chaque coup, regarde d\'abord tes échecs et tes prises, même ceux qui paraissent absurdes.',
  missedMate: 'Quand son roi est exposé, cherche tous tes échecs avant tout autre coup.',
  other: 'Rien à prendre, rien à parer ? Améliore ta pièce la moins active.',
};
export function partieConseillee() {
  const elo = playerRating().elo, b = bilanEleve();
  const cands = BOTS.filter(x => x.elo <= 2000);
  const bot = cands.slice().sort((a, c) => Math.abs(a.elo - (elo + 60)) - Math.abs(c.elo - (elo + 60)))[0];
  const cat = b.faiblesses[0]?.[0] || 'hanging';
  return { bot, consigne: CONSIGNES[cat] || CONSIGNES.hanging };
}
export function preparerPartie(botId) { store.set('playPrefs', { ...store.get('playPrefs', {}), botId, mode: 'classee', cadence: '15+10' }); }

// --- classements en ligne (Lichess, Chess.com) : le vrai juge de paix ---------------------------------------
export function classementsEnLigne() { return store.get('enLigne', null); }
export async function rafraichirClassements(force = false) {
  const s = settings.get(), cur = classementsEnLigne();
  if (!s.lichessUser && !s.chesscomUser) return null;
  if (!force && cur && Date.now() - cur.at < 6 * 3600000 && cur.li === s.lichessUser && cur.cc === s.chesscomUser) return cur;
  const out = { at: Date.now(), li: s.lichessUser, cc: s.chesscomUser, lichess: null, chesscom: null, hist: cur?.hist || [] };
  try {
    if (s.lichessUser) { const r = await fetch(`https://lichess.org/api/user/${encodeURIComponent(s.lichessUser)}`, { headers: { Accept: 'application/json' } }); if (r.ok) { const j = await r.json(); const p = j.perfs || {}; out.lichess = { rapide: p.rapid?.games ? p.rapid.rating : null, blitz: p.blitz?.games ? p.blitz.rating : null }; } }
  } catch { /* hors ligne */ }
  try {
    if (s.chesscomUser) { const r = await fetch(`https://api.chess.com/pub/player/${encodeURIComponent(s.chesscomUser.toLowerCase())}/stats`); if (r.ok) { const j = await r.json(); out.chesscom = { rapide: j.chess_rapid?.last?.rating ?? null, blitz: j.chess_blitz?.last?.rating ?? null }; } }
  } catch { /* hors ligne */ }
  if (!out.lichess && !out.chesscom) return cur;
  const v = out.lichess?.rapide ?? out.chesscom?.rapide ?? out.lichess?.blitz ?? out.chesscom?.blitz;
  if (v && out.hist[out.hist.length - 1]?.v !== v) out.hist.push({ t: Date.now(), v });
  out.hist = out.hist.slice(-60);
  store.set('enLigne', out);
  return out;
}
