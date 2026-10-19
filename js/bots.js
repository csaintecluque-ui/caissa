// Personnages de Caïssa : chacun a un Elo indicatif, une façon de jouer et quelques répliques.
// Le moteur est le même (Stockfish) ; la force et le style viennent du choix parmi plusieurs
// coups candidats, d'une part d'erreurs « humaines » et de préférences de style.
import { Chess } from './util.js';
import { lineValue } from './engine.js';

export const BOTS = [
  { id: 'leon', name: 'Léon', elo: 250, color: '#7a9a5c', style: 'hasard',
    bio: "Vient d'apprendre la marche des pièces. Joue un peu au hasard.",
    hello: ['Salut ! Je connais toutes les règles… enfin presque.', 'On joue ? Je suis prêt !'],
    win: ['J\'ai gagné ?! Incroyable !'], lose: ['Bien joué ! Tu m\'apprendras ?'], draw: ['Match nul, c\'est déjà pas mal !'] },
  { id: 'margaux', name: 'Margaux', elo: 450, color: '#c0607a', style: 'dame',
    bio: 'Adore sortir sa dame très tôt… parfois trop tôt.',
    hello: ['Ma dame est impatiente de jouer !'], win: ['La dame a encore frappé !'], lose: ['Il faut peut-être que je ménage ma dame…'], draw: ['Égalité, on remet ça ?'] },
  { id: 'bastien', name: 'Bastien', elo: 650, color: '#d08a3a', style: 'gourmand',
    bio: 'Prend tout ce qui traîne, sans toujours regarder derrière.',
    hello: ['Laisse traîner une pièce, pour voir…'], win: ['Miam, merci pour les pièces !'], lose: ['J\'ai trop mangé, je crois.'], draw: ['Partage des points !'] },
  { id: 'ines', name: 'Inès', elo: 850, color: '#4f86a8', style: 'prudent',
    bio: 'Prudente : elle roque vite et aime échanger les pièces.',
    hello: ['Doucement mais sûrement.'], win: ['La patience paie toujours.'], lose: ['Bravo, tu as été plus solide que moi.'], draw: ['Une nulle bien méritée.'] },
  { id: 'victor', name: 'Victor', elo: 1000, color: '#a8553a', style: 'attaque',
    bio: 'Joueur de club qui cherche l\'attaque sur ton roi dès qu\'il peut.',
    hello: ['Ton roi a intérêt à être bien protégé.'], win: ['L\'attaque, toujours l\'attaque !'], lose: ['Ta défense a tenu, chapeau.'], draw: ['Pas mal, pas mal…'] },
  { id: 'chloe', name: 'Chloé', elo: 1200, color: '#6b5ea8', style: 'positionnel',
    bio: 'Solide et méthodique, elle punit les pièces laissées en prise.',
    hello: ['Développe tes pièces, et que la meilleure gagne.'], win: ['Chaque pièce non défendue se paie.'], lose: ['Belle partie, tu m\'as eue.'], draw: ['Une partie équilibrée.'] },
  { id: 'hugo', name: 'Hugo', elo: 1400, color: '#2f8a7a', style: 'tacticien',
    bio: 'Tacticien : fourchettes et clouages sont son terrain de jeu.',
    hello: ['Attention aux fourchettes…'], win: ['Tu l\'avais vue venir, celle-là ?'], lose: ['Joli, tu as évité mes pièges.'], draw: ['Nulle, on était à deux doigts !'] },
  { id: 'solene', name: 'Solène', elo: 1600, color: '#b8862e', style: 'positionnel',
    bio: 'Fine stratège, rarement prise en défaut.',
    hello: ['Je te laisse les Blancs ? Non, on tire au sort.'], win: ['Il faut améliorer tes pièces une par une.'], lose: ['Impressionnant. Tu progresses vite.'], draw: ['Nulle méritée.'] },
  { id: 'professeur', name: 'Le Professeur', elo: 1800, color: '#5a4636', style: 'equilibre',
    bio: 'Ancien entraîneur de club : il exploite chaque imprécision.',
    hello: ['Montre-moi ce que tu as appris.'], win: ['Revois tes imprécisions dans le bilan.'], lose: ['Excellent travail, élève !'], draw: ['Une partie très instructive.'] },
  { id: 'sentinelle', name: 'La Sentinelle', elo: 2200, color: '#2c3e50', style: 'equilibre',
    bio: 'Presque aucune erreur. Pour les jours de très grande forme.',
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

export function customBot(elo) {
  return { id: 'custom', name: 'Caïssa', elo, color: '#a65f2c', style: 'equilibre', custom: true,
    bio: 'Adversaire réglable : choisis exactement son niveau.',
    hello: ['Prêt·e ? C\'est parti.'], win: ['Je gagne cette fois-ci.'], lose: ['Bien joué !'], draw: ['Partie nulle.'] };
}

export function botById(id, elo) {
  if (id === 'custom') return customBot(elo || 1000);
  return BOTS.find(b => b.id === id) || BOTS[4];
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
  const P = paramsForElo(bot.elo);
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
