// Elo Caïssa du joueur : mis à jour après chaque partie classée contre un adversaire d'Elo connu.
import { store } from './store.js';

const START = 1000;

export function playerRating() {
  return { elo: START, games: 0, peak: START, history: [], ...store.get('rating', {}) };
}

export function setInitialElo(elo) {
  const r = playerRating();
  r.elo = Math.max(100, Math.min(3000, Math.round(elo)));
  r.peak = Math.max(r.peak, r.elo);
  store.set('rating', r);
}

export function expectedScore(me, opp) { return 1 / (1 + Math.pow(10, (opp - me) / 400)); }

/** score : 1 victoire, 0.5 nulle, 0 défaite. Renvoie { before, after, delta }. */
export function applyResult(oppElo, score, meta = {}) {
  const r = playerRating();
  const K = r.games < 15 ? 40 : r.games < 40 ? 28 : 20;
  const before = r.elo;
  const delta = Math.round(K * (score - expectedScore(before, oppElo)));
  r.elo = Math.max(100, before + delta);
  r.games++;
  r.peak = Math.max(r.peak, r.elo);
  r.history.push({ t: Date.now(), elo: r.elo, opp: oppElo, score, bot: meta.bot || '' });
  r.history = r.history.slice(-200);
  store.set('rating', r);
  return { before, after: r.elo, delta };
}

/** Variation prévue avant la partie (affichée comme sur les sites : +gain / −perte) */
export function stakes(oppElo) {
  const r = playerRating();
  const K = r.games < 15 ? 40 : r.games < 40 ? 28 : 20;
  const e = expectedScore(r.elo, oppElo);
  return { win: Math.round(K * (1 - e)), draw: Math.round(K * (0.5 - e)), loss: Math.round(K * (0 - e)) };
}

/**
 * Elo estimé sur une partie, à partir de la perte moyenne en centipions (ACPL).
 * Approximation courante : Elo ≈ 3100 · e^(−0,01 · ACPL). Indicatif.
 */
export function eloFromAcpl(acpl) {
  if (acpl == null || !isFinite(acpl)) return null;
  const v = 3100 * Math.exp(-0.01 * acpl);
  return Math.max(100, Math.min(3000, Math.round(v / 25) * 25));
}
