// Prompts d'explication. L'IA ne lit jamais la position « codée » (FEN) seule : on lui donne
// la liste des pièces case par case et chaque coup décrit en toutes lettres, pour éviter
// qu'elle se trompe de case ou confonde R (roi) et R (rook = tour en anglais).
// L'appel à l'IA (fournisseur au choix, comme dans Tengen) est dans ai.js.
import { Chess } from './lib/chess.js';
import { sanFr } from './util.js';
export { hasKey, ask as askClaude } from './ai.js';

const NAMES = { p: ['le', 'pion'], n: ['le', 'cavalier'], b: ['le', 'fou'], r: ['la', 'tour'], q: ['la', 'dame'], k: ['le', 'roi'] };
const FEM = { r: true, q: true };
const PLURAL = { p: 'Pions', n: 'Cavaliers', b: 'Fous', r: 'Tours', q: 'Dames', k: 'Roi' };
const SINGULAR = { p: 'Pion', n: 'Cavalier', b: 'Fou', r: 'Tour', q: 'Dame', k: 'Roi' };

function piece(type, color) {
  const [art, name] = NAMES[type];
  const adj = color === 'w' ? (FEM[type] ? 'blanche' : 'blanc') : (FEM[type] ? 'noire' : 'noir');
  return `${art} ${name} ${adj}`;
}

/** « Blancs : Roi e1 ; Dame d1 ; Tours c4, g1 ; … » */
export function describePosition(fen) {
  const c = new Chess(fen);
  const out = [];
  for (const color of ['w', 'b']) {
    const parts = [];
    for (const t of ['k', 'q', 'r', 'b', 'n', 'p']) {
      const sq = c.board().flat().filter(p => p && p.color === color && p.type === t).map(p => p.square).sort();
      if (sq.length) parts.push(`${sq.length > 1 ? PLURAL[t] : SINGULAR[t]} ${sq.join(', ')}`);
    }
    out.push(`${color === 'w' ? 'Blancs' : 'Noirs'} : ${parts.join(' ; ')}`);
  }
  const turn = c.turn() === 'w' ? 'Blancs' : 'Noirs';
  return `${out.join('\n')}\nTrait aux ${turn}.${c.inCheck() ? ` Les ${turn} sont en échec.` : ''}`;
}

/** Suite de coups décrite ligne par ligne, en notation française et en toutes lettres. */
export function describeLine(fen, ucis, max = 8) {
  const c = new Chess(fen);
  const lines = [];
  for (const u of (ucis || []).slice(0, max)) {
    const num = c.moveNumber();
    let m;
    try { const mv = { from: u.slice(0, 2), to: u.slice(2, 4) }; if (u[4]) mv.promotion = u[4]; m = c.move(mv); } catch { break; }
    if (!m) break;
    let what;
    if (m.flags.includes('k')) what = `${piece('k', m.color)} roque côté roi`;
    else if (m.flags.includes('q')) what = `${piece('k', m.color)} roque côté dame`;
    else {
      what = `${piece(m.piece, m.color)} de ${m.from} ${m.captured ? `prend ${piece(m.captured, m.color === 'w' ? 'b' : 'w')} en ${m.to}` : `va en ${m.to}`}`;
      if (m.promotion) what += ` et se transforme en ${NAMES[m.promotion][1]}`;
    }
    if (c.isCheckmate()) what += ' : échec et mat';
    else if (c.inCheck()) what += ' : échec';
    lines.push(`${num}${m.color === 'w' ? '.' : '…'} ${sanFr(m.san)} = ${what}`);
  }
  return lines.length ? lines.join('\n') : '(aucun coup)';
}

const RULES = `Rappel de notation : en français R = roi, D = dame, T = tour, F = fou, C = cavalier, et rien pour un pion. La description en toutes lettres de chaque coup fait foi.
Dans ta réponse, cite les coups en notation française comme ci-dessus et nomme toujours la pièce en toutes lettres la première fois (par ex. « Rxg7 : le roi prend la tour en g7 »). Ne place aucune pièce sur une case qui ne figure pas dans la liste.`;

export function explainMovePrompt(d) {
  return `Position avant le coup (liste exacte des pièces) :
${describePosition(d.fen)}
L'élève jouait les ${d.side === 'w' ? 'Blancs' : 'Noirs'}.

Coup joué par l'élève (${d.label}) :
${describeLine(d.fen, [d.played], 1)}
Évaluation après ce coup : ${d.evalAfter}.

Meilleure suite selon le moteur à la place (évaluation : ${d.evalBest}) :
${describeLine(d.fen, d.bestPv, 6)}

Suite probable après le coup joué :
${d.refutationFen ? describeLine(d.refutationFen, d.refutationPv, 6) : 'non disponible'}
${d.category ? `Type d'erreur détecté : ${d.category}.` : ''}

${RULES}
Explique pourquoi le coup joué est une erreur et ce que l'élève aurait dû voir.`;
}

export function explainPuzzlePrompt(d) {
  const c = new Chess(d.fen);
  let mv;
  try { mv = { from: d.moves[0].slice(0, 2), to: d.moves[0].slice(2, 4) }; if (d.moves[0][4]) mv.promotion = d.moves[0][4]; c.move(mv); } catch { /* rien */ }
  const start = c.fen();
  return `Problème d'échecs.
Position avant le dernier coup de l'adversaire :
${describePosition(d.fen)}

Dernier coup de l'adversaire (celui qui crée l'occasion) :
${describeLine(d.fen, d.moves.slice(0, 1), 1)}

Position à résoudre (liste exacte des pièces) :
${describePosition(start)}

Solution :
${describeLine(start, d.moves.slice(1), 12)}
Thèmes : ${d.themes || 'non précisés'}.
${wrongText(start, d.wrong)}

${RULES}
Explique l'idée de la solution (motif tactique, pièce clé) et comment la repérer en partie.`;
}

function wrongText(fen, uci) {
  if (!uci) return '';
  const t = describeLine(fen, [uci], 1);
  return t.startsWith('(') ? '' : `L'élève a d'abord essayé ${t.replace(/^\S+\s/, '')}, qui ne marche pas.`;
}

export function explainPositionPrompt(d) {
  return `Position (liste exacte des pièces) :
${describePosition(d.fen)}
Évaluation du moteur (point de vue des Blancs) : ${d.eval}.

Meilleures suites du moteur :
${d.lines.map((l, i) => `Suite ${i + 1} (${l.eval}) :\n${describeLine(d.fen, l.pv, 6)}`).join('\n\n')}

${RULES}
Explique simplement le plan principal pour le camp au trait et la principale menace adverse.`;
}
