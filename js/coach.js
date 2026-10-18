// Explications en français via l'API Claude (clé saisie dans les réglages,
// stockée uniquement sur l'appareil).
import { settings } from './store.js';

export function hasKey() { return !!settings.get().apiKey; }

export async function askClaude(prompt, { maxTokens = 600 } = {}) {
  const s = settings.get();
  if (!s.apiKey) throw new Error('Ajoute ta clé API Claude dans les réglages (⚙︎) pour activer les explications.');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': s.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: s.model || 'claude-sonnet-5-5',
      max_tokens: maxTokens,
      system: SYSTEM,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) {
    let msg = `Erreur ${res.status}`;
    try { const j = await res.json(); msg += ' — ' + (j.error?.message || ''); } catch { /* rien */ }
    if (res.status === 401) msg = 'Clé API refusée. Vérifie-la dans les réglages.';
    throw new Error(msg);
  }
  const j = await res.json();
  return j.content.filter(c => c.type === 'text').map(c => c.text).join('\n').trim();
}

const SYSTEM = `Tu es un entraîneur d'échecs bienveillant et concret qui parle français.
Ton élève est un joueur amateur d'environ 800 à 1200 Elo qui perd surtout sur des pièces laissées en prise et des tactiques simples, et qui perd ses moyens face aux humains.
Règles :
- Appuie-toi UNIQUEMENT sur les variantes du moteur fournies : n'invente jamais de coup ni de position. Si les données ne suffisent pas, dis-le simplement.
- Utilise la notation française (R, D, T, F, C) telle qu'elle t'est donnée.
- Sois bref : 3 à 5 phrases, puis une ligne « À retenir : … » avec un réflexe simple et réutilisable (par ex. la routine Échecs · Prises · Menaces).
- Pas de jargon inutile, pas de titres, pas de listes longues.`;

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
