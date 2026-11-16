// Le dossier de l'élève : progression dans les leçons, révisions espacées,
// prochaine leçon conseillée et carnet tenu par le professeur. Tout reste sur l'appareil.
import { store } from './store.js';
import { MODULES, LECONS, leconById, POUR_CATEGORIE } from './cours-data.js';
import { weaknessStats, listGames, listMistakes, CATEGORIES } from './games.js';
import { playerRating } from './rating.js';

const JOUR = 86400000;
const REVISIONS = [3, 10, 30]; // jours avant chaque révision d'une leçon validée
export const SEUIL = 0.75;      // part de bonnes réponses pour valider un contrôle

// --- progression ----------------------------------------------------------------------
export function progres() { const p = store.get('cours', {}); return { le: {}, pos: {}, ...p }; }
function save(p) { store.set('cours', p); }
export function etatLecon(id) { return progres().le[id] || null; }
export function positionLecon(id) { return progres().pos[id] || 0; }
export function noterPosition(id, idx) { const p = progres(); if (idx > 0) p.pos[id] = idx; else delete p.pos[id]; save(p); }

/** Enregistre le résultat d'un contrôle. Renvoie l'état de la leçon. */
export function noterControle(id, score) {
  const p = progres();
  const e = p.le[id] || { essais: 0, score: 0, box: -1 };
  const reussi = score >= SEUIL;
  e.essais++;
  e.dernier = Date.now();
  e.dernierScore = score;
  if (reussi) {
    if (!e.fait) e.fait = Date.now();
    e.score = Math.max(e.score || 0, score);
    e.box = Math.min(REVISIONS.length, (e.box ?? -1) + 1);
    e.due = e.box < REVISIONS.length ? Date.now() + REVISIONS[e.box] * JOUR : null;
  } else if (e.fait) {
    // révision ratée : on la reverra vite
    e.box = -1;
    e.due = Date.now() + JOUR;
  }
  p.le[id] = e;
  delete p.pos[id];
  save(p);
  return e;
}

export function aReviser() {
  const now = Date.now(), p = progres();
  return LECONS.filter(l => p.le[l.id]?.fait && p.le[l.id].due && p.le[l.id].due <= now).sort((a, b) => p.le[a.id].due - p.le[b.id].due);
}
export function avancement() {
  const p = progres();
  const faites = LECONS.filter(l => p.le[l.id]?.fait).length;
  return { faites, total: LECONS.length, modules: MODULES.map(m => ({ id: m.id, faites: m.lecons.filter(l => p.le[l.id]?.fait).length, total: m.lecons.length })) };
}

/** Ce que le professeur propose de faire maintenant, et pourquoi. */
export function recommandation() {
  const p = progres();
  const fait = id => !!p.le[id]?.fait;
  const enCours = LECONS.find(l => p.pos[l.id] > 0 && !fait(l.id));
  if (enCours) return { type: 'continuer', lecon: enCours, raison: 'Tu t\'étais arrêté au milieu de cette leçon.' };
  const rev = aReviser()[0];
  if (rev) return { type: 'revision', lecon: rev, raison: 'Leçon validée il y a quelque temps : un contrôle rapide pour vérifier que c\'est resté.' };
  const weak = weaknessStats()[0];
  if (weak && weak[1] >= 2) {
    const id = (POUR_CATEGORIE[weak[0]] || []).find(x => !fait(x));
    if (id) return { type: 'faiblesse', lecon: leconById(id), raison: `Dans tes parties, ce qui te coûte le plus : « ${CATEGORIES[weak[0]]} » (${weak[1]} fois). Cette leçon s'y attaque directement.` };
  }
  const next = LECONS.find(l => !fait(l.id));
  if (next) return { type: 'suite', lecon: next, raison: faitCount(p) ? 'La suite du programme.' : 'Le début du programme : avant de gagner des pièces, on arrête d\'en donner.' };
  return { type: 'fini', lecon: null, raison: 'Tu as validé tout le programme. Continue les révisions, les problèmes et les cours particuliers sur tes parties.' };
}
function faitCount(p) { return LECONS.filter(l => p.le[l.id]?.fait).length; }

// --- carnet du professeur ---------------------------------------------------------------
export const OBJECTIF_DEFAUT = 'Ne plus donner de pièces et garder mon calme face aux humains.';
export function prof() { return { objectif: OBJECTIF_DEFAUT, notes: [], bulletins: [], cours: [], ...store.get('prof', {}) }; }
export function saveProf(patch) { store.set('prof', { ...prof(), ...patch }); }
export function ajouterNote(texte, source = '') {
  const t = String(texte || '').replace(/\s+/g, ' ').trim().slice(0, 220);
  if (!t) return;
  const notes = prof().notes.filter(n => n.t !== t);
  notes.unshift({ t, at: Date.now(), source });
  saveProf({ notes: notes.slice(0, 12) });
}
export function supprimerNote(at) { saveProf({ notes: prof().notes.filter(n => n.at !== at) }); }

// --- chiffres de l'élève (affichés dans le carnet et transmis au professeur) -----------------
export function bilanEleve() {
  const games = listGames();
  const mine = games.filter(g => g.you && g.analysis);
  const recent = mine.slice(0, 10);
  const moy = a => (a.length ? Math.round(a.reduce((s, x) => s + x, 0) / a.length) : null);
  const acc = moy(recent.map(g => g.analysis.acc?.[g.you]).filter(x => x != null));
  const phase = ph => moy(recent.map(g => g.analysis.phases?.[g.you]?.[ph]).filter(x => x != null));
  const gaffes = recent.length ? Math.round((recent.reduce((s, g) => s + (g.analysis.counts?.[g.you]?.blunder || 0), 0) / recent.length) * 10) / 10 : null;
  const res = { v: 0, n: 0, d: 0 };
  for (const g of games.filter(x => x.you && x.result !== '*').slice(0, 20)) {
    if (g.result === '1/2-1/2') res.n++;
    else if ((g.result === '1-0') === (g.you === 'w')) res.v++; else res.d++;
  }
  const r = playerRating();
  const il30 = r.history.filter(h => h.t > Date.now() - 30 * JOUR);
  return {
    elo: r.elo, parties: r.games, tendance: il30.length >= 2 ? r.elo - il30[0].elo : null,
    analysees: mine.length, precision: acc, phases: { ouverture: phase('opening'), milieu: phase('middlegame'), finale: phase('endgame') },
    gaffesParPartie: gaffes, resultats: res, faiblesses: weaknessStats(), erreurs: listMistakes().length, avancement: avancement(),
  };
}
