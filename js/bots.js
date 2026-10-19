// Personnages de Caïssa : chacun a un Elo indicatif, une façon de jouer et quelques répliques.
// Le moteur est le même (Stockfish) ; la force et le style viennent du choix parmi plusieurs
// coups candidats, d'une part d'erreurs « humaines » et de préférences de style.
import { Chess } from './util.js';
import { lineValue } from './engine.js';

export const BOTS = [
  { id: 'leon', name: 'Léon', elo: 150, engineElo: 250, color: '#7a9a5c', style: 'hasard',
    bio: "Vient d'apprendre la marche des pièces. Joue un peu au hasard.",
    hello: ['Salut ! Je connais toutes les règles… enfin presque.', 'On joue ? Je suis prêt !'],
    win: ['J\'ai gagné ?! Incroyable !'], lose: ['Bien joué ! Tu m\'apprendras ?'], draw: ['Match nul, c\'est déjà pas mal !'] },
  { id: 'margaux', name: 'Margaux', elo: 500, engineElo: 450, color: '#c0607a', style: 'dame',
    bio: 'Adore sortir sa dame très tôt… parfois trop tôt.',
    hello: ['Ma dame est impatiente de jouer !'], win: ['La dame a encore frappé !'], lose: ['Il faut peut-être que je ménage ma dame…'], draw: ['Égalité, on remet ça ?'] },
  { id: 'bastien', name: 'Bastien', elo: 650, engineElo: 650, color: '#d08a3a', style: 'gourmand',
    bio: 'Prend tout ce qui traîne, sans toujours regarder derrière.',
    hello: ['Laisse traîner une pièce, pour voir…'], win: ['Miam, merci pour les pièces !'], lose: ['J\'ai trop mangé, je crois.'], draw: ['Partage des points !'] },
  { id: 'ines', name: 'Inès', elo: 850, engineElo: 770, color: '#4f86a8', style: 'prudent',
    bio: 'Prudente : elle roque vite et aime échanger les pièces.',
    hello: ['Doucement mais sûrement.'], win: ['La patience paie toujours.'], lose: ['Bravo, tu as été plus solide que moi.'], draw: ['Une nulle bien méritée.'] },
  { id: 'victor', name: 'Victor', elo: 1100, maia: 1100, color: '#a8553a',
    bio: 'Joueur de club qui aime attaquer. Fait les erreurs typiques des joueurs à 1100.',
    hello: ['Ton roi a intérêt à être bien protégé.'], win: ['L\'attaque, toujours l\'attaque !'], lose: ['Ta défense a tenu, chapeau.'], draw: ['Pas mal, pas mal…'] },
  { id: 'chloe', name: 'Chloé', elo: 1250, maia: 1200, color: '#6b5ea8',
    bio: 'Solide et méthodique, elle punit souvent les pièces laissées en prise.',
    hello: ['Développe tes pièces, et que la meilleure gagne.'], win: ['Chaque pièce non défendue se paie.'], lose: ['Belle partie, tu m\'as eue.'], draw: ['Une partie équilibrée.'] },
  { id: 'nora', name: 'Nora', elo: 1400, maia: 1300, color: '#3d7f9e',
    bio: 'Connaît ses ouvertures et ne lâche rien en finale.',
    hello: ['On commence par une ouverture classique ?'], win: ['La finale, c\'est là que tout se joue.'], lose: ['Bien joué, je n\'ai rien vu venir.'], draw: ['Nulle, partie serrée !'] },
  { id: 'hugo', name: 'Hugo', elo: 1450, maia: 1400, color: '#2f8a7a',
    bio: 'Tacticien : fourchettes et clouages sont son terrain de jeu.',
    hello: ['Attention aux fourchettes…'], win: ['Tu l\'avais vue venir, celle-là ?'], lose: ['Joli, tu as évité mes pièges.'], draw: ['Nulle, on était à deux doigts !'] },
  { id: 'antoine', name: 'Antoine', elo: 1500, maia: 1500, color: '#8a6d3b',
    bio: 'Joueur régulier de tournois du dimanche. Rarement pressé.',
    hello: ['Bonne partie !'], win: ['Il faut contrôler le centre.'], lose: ['Bravo, joli travail.'], draw: ['Nulle, bonne partie.'] },
  { id: 'solene', name: 'Solène', elo: 1650, maia: 1600, color: '#b8862e',
    bio: 'Fine stratège, rarement prise en défaut.',
    hello: ['Que la meilleure stratégie gagne.'], win: ['Il faut améliorer tes pièces une par une.'], lose: ['Impressionnant. Tu progresses vite.'], draw: ['Nulle méritée.'] },
  { id: 'mathis', name: 'Mathis', elo: 1750, maia: 1700, color: '#5b7a3a',
    bio: 'Joue vite et juste. Il faut le pousser à la faute.',
    hello: ['Prêt ? Je joue vite, moi.'], win: ['Trop lent !'], lose: ['Bien tenu, chapeau.'], draw: ['Match nul.'] },
  { id: 'professeur', name: 'Le Professeur', elo: 1850, maia: 1800, color: '#5a4636',
    bio: 'Ancien entraîneur de club : il exploite chaque imprécision.',
    hello: ['Montre-moi ce que tu as appris.'], win: ['Revois tes imprécisions dans le bilan.'], lose: ['Excellent travail, élève !'], draw: ['Une partie très instructive.'] },
  { id: 'elise', name: 'Élise', elo: 1950, maia: 1900, color: '#7a3d5c',
    bio: 'Le plus haut niveau humain de Caïssa : solide partout.',
    hello: ['Allons-y.'], win: ['Il faudra encore travailler.'], lose: ['Remarquable partie.'], draw: ['Nulle honorable.'] },
  { id: 'sentinelle', name: 'La Sentinelle', elo: 2500, engineElo: 2200, color: '#2c3e50', style: 'equilibre',
    bio: 'Presque aucune erreur : elle a gagné toutes ses parties contre Élise. Au moins 2500.',
    hello: ['…'], win: ['Prévisible.'], lose: ['Remarquable.'], draw: ['Acceptable.'] },
  { id: 'stockfish', name: 'Caïssa sans limite', elo: 3000, color: '#1B1512', style: 'max',
    bio: 'Stockfish à pleine puissance. Pour voir à quoi ressemble la perfection.',
    hello: ['Bonne chance.'], win: ['Le moteur ne pardonne rien.'], lose: ['Exploit historique !'], draw: ['Une nulle contre le moteur, bravo.'] },
];

// Paramètres moteur selon l'Elo : profondeur, nombre de coups candidats, « température »
// (tolérance aux coups moins bons) et part de coups joués sans réfléchir.
const CURVE = [
  [250, { depth: 1, mpv: 10, T: 500, rand: 0.45 }],
  [450, { depth: 2, mpv: 8, T: 300, rand: 0.25 }],
  [650, { depth: 3, mpv: 8, T: 220, rand: 0.14 }],
  [850, { depth: 4, mpv: 7, T: 160, rand: 0.08 }],
  [1000, { depth: 5, mpv: 6, T: 115, rand: 0.045 }],
  [1200, { depth: 6, mpv: 5, T: 80, rand: 0.025 }],
  [1400, { depth: 8, mpv: 4, T: 52, rand: 0.012 }],
  [1600, { depth: 10, mpv: 4, T: 32, rand: 0.006 }],
  [1800, { depth: 12, mpv: 3, T: 18, rand: 0 }],
  [2200, { depth: 15, mpv: 2, T: 6, rand: 0 }],
  [3000, { depth: 18, mpv: 1, T: 0, rand: 0 }],
];
export function paramsForElo(elo) {
  if (elo <= CURVE[0][0]) return { ...CURVE[0][1] };
  for (let i = 1; i < CURVE.length; i++) {
    const [e1, p1] = CURVE[i - 1], [e2, p2] = CURVE[i];
    if (elo <= e2) {
      const t = (elo - e1) / (e2 - e1);
      const lerp = (a, b) => a + (b - a) * t;
      return { depth: Math.round(lerp(p1.depth, p2.depth)), mpv: Math.round(lerp(p1.mpv, p2.mpv)), T: lerp(p1.T, p2.T), rand: lerp(p1.rand, p2.rand) };
    }
  }
  return { ...CURVE[CURVE.length - 1][1] };
}

// Mesures (matchs contre Maia 1100) : réglage moteur → niveau réel
const MEASURED = [[145, 250], [525, 450], [655, 650], [980, 850], [1195, 1000]];
function engineEloFor(target) {
  if (target <= MEASURED[0][0]) return MEASURED[0][1];
  for (let i = 1; i < MEASURED.length; i++) {
    const [m1, e1] = MEASURED[i - 1], [m2, e2] = MEASURED[i];
    if (target <= m2) return Math.round(e1 + ((target - m1) / (m2 - m1)) * (e2 - e1));
  }
  return target;
}

export function customBot(elo) {
  const maia = elo >= 1100 && elo <= 1950 ? humanLevelFor(elo) : null;
  return { id: 'custom', name: 'Caïssa', elo, maia, engineElo: elo < 1100 ? engineEloFor(elo) : elo, color: '#a65f2c', style: 'equilibre', custom: true,
    bio: 'Adversaire réglable : choisis exactement son niveau.',
    hello: ['Prêt·e ? C\'est parti.'], win: ['Je gagne cette fois-ci.'], lose: ['Bien joué !'], draw: ['Partie nulle.'] };
}

export function botById(id, elo) {
  if (id === 'custom') return customBot(elo || 1000);
  return BOTS.find(b => b.id === id) || BOTS[4];
}

// Niveaux « humains » : Maia propose des coups comme un joueur de ce niveau, et Stockfish
// écarte une partie des grosses gaffes (seuil en % de chances de gain, probabilité de veto).
// Les réseaux Maia seuls sont trop proches en force les uns des autres : ce filtre étale
// l'échelle de 1100 à 1900. Paramètres calibrés par des matchs entre personnages.
export const HUMAN_LEVELS = {
  1100: { thr: 100, q: 0 },
  1200: { thr: 40, q: 0.5 },
  1300: { thr: 30, q: 0.6 },
  1400: { thr: 25, q: 0.7 },
  1500: { thr: 20, q: 0.8 },
  1600: { thr: 16, q: 0.85 },
  1700: { thr: 12, q: 0.9 },
  1800: { thr: 9, q: 0.95 },
  1900: { thr: 7, q: 1 },
};
export function humanParams(level) {
  const k = Math.max(1100, Math.min(1900, Math.round(level / 100) * 100));
  return { model: k, ...HUMAN_LEVELS[k] };
}
// Niveau réel mesuré de chaque réglage (matchs en chaîne, ancré sur Maia 1100 = 1100)
export const HUMAN_MEASURED = { 1100: 1100, 1200: 1250, 1300: 1400, 1400: 1460, 1500: 1520, 1600: 1635, 1700: 1750, 1800: 1845, 1900: 1940 };
function humanLevelFor(target) {
  let best = 1100, d = Infinity;
  for (const [k, v] of Object.entries(HUMAN_MEASURED)) if (Math.abs(v - target) < d) { d = Math.abs(v - target); best = +k; }
  return best;
}

/**
 * Coup « humain » : tirage selon Maia, puis veto éventuel de Stockfish sur les gaffes.
 * evaluate(ucis) → Map(uci → chances de gain du camp au trait, 0-100).
 */
export async function humanMove(policyMoves, level, evaluate, floor = 0.02) {
  const P = humanParams(level);
  let cands = policyMoves.filter(m => m.p >= floor);
  if (!cands.length) cands = policyMoves.slice(0, 1);
  if (!P.q) return sampleMaia(cands, 1, 0);
  const wins = await evaluate(cands.map(m => m.uci));
  if (!wins || !wins.size) return sampleMaia(cands, 1, 0);
  const best = Math.max(...wins.values());
  for (let tries = 0; tries < 4 && cands.length > 1; tries++) {
    const u = sampleMaia(cands, 1, 0);
    const w = wins.get(u);
    if (w == null || best - w <= P.thr || Math.random() >= P.q) return u;
    cands = cands.filter(m => m.uci !== u);
  }
  return sampleMaia(cands, 1, 0);
}

/** Tire un coup selon la politique Maia (comme le ferait un humain de ce niveau). */
export function sampleMaia(moves, T = 1, floor = 0.02) {
  let c = moves.filter(m => m.p >= floor);
  if (!c.length) c = moves.slice(0, 1);
  const w = c.map(m => Math.pow(m.p, 1 / T));
  let x = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < c.length; i++) { x -= w[i]; if (x <= 0) return c[i].uci; }
  return c[0].uci;
}

export function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

export function avatar(bot, size = 36) {
  const initial = bot.name.replace(/^(Le|La) /, '')[0];
  return `<span class="avatar" style="width:${size}px;height:${size}px;background:${bot.color};font-size:${Math.round(size * 0.48)}px">${initial}</span>`;
}

// --- choix du coup ----------------------------------------------------------------------
const CENTER = new Set(['d4', 'e4', 'd5', 'e5']);
function dist(a, b) { return Math.max(Math.abs(a.charCodeAt(0) - b.charCodeAt(0)), Math.abs(+a[1] - +b[1])); }

function styleBonus(style, chess, m) {
  const ply = chess.history().length;
  let b = 0;
  const check = m.san.includes('+') || m.san.includes('#');
  const enemyKing = chess.board().flat().find(p => p && p.type === 'k' && p.color !== m.color)?.square;
  switch (style) {
    case 'attaque':
      if (check) b += 35;
      if (m.captured) b += 15;
      if (enemyKing && dist(m.to, enemyKing) <= 2) b += 18;
      break;
    case 'dame':
      if (m.piece === 'q') b += ply < 20 ? 60 : 25;
      if (check) b += 15;
      break;
    case 'gourmand':
      if (m.captured) b += 35 + (m.captured === 'p' ? 15 : 0);
      break;
    case 'prudent':
      if (m.flags.includes('k') || m.flags.includes('q')) b += 45;
      if (m.captured && m.captured === m.piece) b += 20;
      if (m.piece === 'p' && ply > 10 && ['f', 'g', 'h'].includes(m.from[0])) b -= 20;
      break;
    case 'positionnel':
      if (ply < 16 && CENTER.has(m.to)) b += 15;
      if (ply < 16 && (m.piece === 'n' || m.piece === 'b') && (m.from[1] === '1' || m.from[1] === '8')) b += 20;
      if (ply < 12 && m.piece === 'q') b -= 30;
      if (m.flags.includes('k') || m.flags.includes('q')) b += 25;
      break;
    case 'tacticien':
      if (check) b += 20;
      if (m.captured) b += 12;
      break;
    default: break;
  }
  return b;
}

/** r : résultat d'analyse multipv ; renvoie un coup UCI. */
export function chooseMove(r, bot, fen) {
  const P = paramsForElo(bot.engineElo ?? bot.elo);
  const chess = new Chess(fen);
  const legal = chess.moves({ verbose: true });
  if (!legal.length) return null;
  const lines = (r?.lines || []).filter(l => l.move);
  if (!lines.length) return r?.best || legal[0].from + legal[0].to;
  const top = lines[0];
  if (P.T === 0 || bot.style === 'max') return top.move;
  // un mat proche est presque toujours vu à partir d'un certain niveau
  if (top.mate != null && top.mate > 0 && top.mate <= 2 && Math.random() < Math.min(0.97, 0.3 + bot.elo / 1500)) return top.move;
  // coup « sans réfléchir »
  if (Math.random() < P.rand) {
    const m = legal[Math.floor(Math.random() * legal.length)];
    return m.from + m.to + (m.promotion || '');
  }
  const best = lineValue(top);
  const scored = lines.map(l => {
    const m = legal.find(x => x.from + x.to + (x.promotion || '') === l.move);
    const bonus = m ? styleBonus(bot.style, chess, m) : 0;
    // le style n'influence que des coups raisonnables
    const loss = Math.max(0, best - lineValue(l));
    return { l, s: -Math.max(0, loss - Math.min(bonus, loss + 40)) + (loss < 120 ? bonus * 0.4 : 0) };
  });
  const maxS = Math.max(...scored.map(x => x.s));
  const w = scored.map(x => Math.exp((x.s - maxS) / P.T));
  let x = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < scored.length; i++) { x -= w[i]; if (x <= 0) return scored[i].l.move; }
  return top.move;
}
