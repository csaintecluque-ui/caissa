// Prompts d'explication ; l'appel à l'IA (fournisseur au choix, comme dans Tengen) est dans ai.js.
export { hasKey, ask as askClaude } from './ai.js';

export function explainMovePrompt(d) {
  return `Position (FEN) avant le coup : ${d.fen}
Trait aux ${d.turn === 'w' ? 'Blancs' : 'Noirs'}. L'élève jouait les ${d.side === 'w' ? 'Blancs' : 'Noirs'}.
Coup joué : ${d.playedSan} (évaluation après ce coup : ${d.evalAfter}, catégorie : ${d.label}).
Meilleure suite du moteur à la place : ${d.bestLine} (évaluation : ${d.evalBest}).
Suite probable après le coup joué : ${d.refutation || 'non disponible'}.
${d.category ? 'Type d\'erreur détecté : ' + d.category + '.' : ''}
Explique pourquoi le coup joué est une erreur et ce que l'élève aurait dû voir.`;
}

export function explainPuzzlePrompt(d) {
  return `Problème d'échecs. Position de départ (FEN) : ${d.fen}
Trait aux ${d.turn === 'w' ? 'Blancs' : 'Noirs'}.
Solution : ${d.solution}
Thèmes : ${d.themes || 'non précisés'}.
${d.wrong ? 'L\'élève a d\'abord essayé ' + d.wrong + ', qui ne marche pas.' : ''}
Explique l'idée de la solution (motif tactique, pièce clé) et comment la repérer en partie.`;
}

export function explainPositionPrompt(d) {
  return `Position (FEN) : ${d.fen}. Trait aux ${d.turn === 'w' ? 'Blancs' : 'Noirs'}.
Évaluation du moteur (point de vue des Blancs) : ${d.eval}.
Meilleures suites du moteur :
${d.lines}
Explique simplement le plan principal pour le camp au trait et la principale menace adverse.`;
}
