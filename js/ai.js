// Le professeur IA : appels directs depuis l'appareil vers le fournisseur choisi, avec la clé
// de l'utilisateur (même fonctionnement que Tengen). Les clés restent sur l'appareil.
import { store, settings } from './store.js';

export const PROVIDERS = [
  { id: 'anthropic', name: 'Claude', brand: 'Anthropic', keyHint: 'sk-ant-…', console: 'console.anthropic.com', note: 'Recommandé : excellent pédagogue en français.',
    defaultModel: 'claude-sonnet-5-5', suggested: [{ id: 'claude-haiku-5-5', label: 'Haiku 5.5 · rapide' }, { id: 'claude-sonnet-5-5', label: 'Sonnet 5.5 · équilibré' }, { id: 'claude-opus-5-5', label: 'Opus 5.5 · le plus fin' }] },
  { id: 'openai', name: 'ChatGPT', brand: 'OpenAI', keyHint: 'sk-…', console: 'platform.openai.com', note: 'Les modèles GPT d\'OpenAI.', defaultModel: '', suggested: [] },
  { id: 'google', name: 'Gemini', brand: 'Google', keyHint: 'AIza…', console: 'aistudio.google.com', note: 'Les modèles Gemini de Google (clé gratuite possible avec limites).', defaultModel: '', suggested: [] },
  { id: 'xai', name: 'Grok', brand: 'xAI', keyHint: 'xai-…', console: 'console.x.ai', note: 'Les modèles Grok de xAI.', defaultModel: '', suggested: [] },
  { id: 'openrouter', name: 'OpenRouter', brand: 'OpenRouter', keyHint: 'sk-or-…', console: 'openrouter.ai', note: 'Une seule clé pour des centaines de modèles : Mistral, DeepSeek, Llama, Qwen, et aussi GPT, Gemini ou Claude.',
    defaultModel: 'anthropic/claude-haiku-5.5', suggested: [{ id: 'anthropic/claude-haiku-5.5', label: 'Claude Haiku 5.5 · rapide, économique' }, { id: 'anthropic/claude-sonnet-5.5', label: 'Claude Sonnet 5.5 · plus fin' }] },
  { id: 'custom', name: 'Compatible OpenAI', brand: 'Autre service', keyHint: 'clé (facultative)', console: '', note: 'Pour un service compatible avec l\'API d\'OpenAI (adresse https obligatoire, et le service doit accepter les appels depuis un navigateur).', defaultModel: '', suggested: [] },
];
export function providerById(id) { return PROVIDERS.find(p => p.id === id) || PROVIDERS[0]; }

// Nettoie une clé collée (espaces, retours à la ligne, caractères invisibles)
export function cleanKey(k) { return String(k || '').replace(/[\s​-‍﻿]/g, ''); }

// Devine le fournisseur à partir du début de la clé
export function guessProvider(key) {
  const k = cleanKey(key);
  if (k.startsWith('sk-ant-')) return 'anthropic';
  if (k.startsWith('sk-or-')) return 'openrouter';
  if (k.startsWith('AIza')) return 'google';
  if (k.startsWith('xai-')) return 'xai';
  if (k.startsWith('sk-')) return 'openai';
  return null;
}

export function aiSettings() {
  const s = settings.get();
  const ai = { provider: 'anthropic', keys: {}, models: {}, customBase: '', ...(s.ai || {}) };
  // reprise de l'ancien réglage (une seule clé Claude)
  if (s.apiKey && !ai.keys.anthropic) ai.keys.anthropic = s.apiKey;
  if (s.model && !ai.models.anthropic && s.apiKey) ai.models.anthropic = s.model;
  return ai;
}
export function saveAiSettings(ai) { settings.set({ ai, apiKey: '', model: '' }); }

function conf() {
  const ai = aiSettings();
  const pid = ai.provider;
  return { pid, key: cleanKey(ai.keys[pid]), model: (ai.models[pid] || providerById(pid).defaultModel || '').trim(), base: (ai.customBase || '').trim().replace(/\/+$/, '') };
}
function usable(c) { return c.pid === 'custom' ? !!c.base && !!c.model : !!c.key && !!c.model; }
export function hasKey() { return usable(conf()); }
export function aiName() {
  const c = conf();
  const sug = providerById(c.pid).suggested.find(m => m.id === c.model);
  if (sug) return `${providerById(c.pid).name} · ${sug.label.split(' · ')[0]}`;
  return c.model ? `${providerById(c.pid).name} · ${c.model.split('/').pop()}` : providerById(c.pid).name;
}

export class AIError extends Error { constructor(code, msg) { super(msg); this.code = code; } }

function httpError(status, detail, p) {
  if (status === 401 || status === 403) return new AIError('auth', `Clé refusée par ${p}, ou accès au modèle interdit. Vérifie la clé, le fournisseur choisi et le modèle dans les réglages.${detail ? ' (' + detail + ')' : ''}`);
  if (status === 404) return new AIError('model', `Modèle introuvable chez ${p}. Choisis-en un autre dans les réglages.${detail ? ' (' + detail + ')' : ''}`);
  if (status === 402 || /credit|balance|quota|billing/i.test(detail)) return new AIError('credit', `Crédit épuisé ou quota atteint chez ${p}. ${detail}`);
  if (status === 429) return new AIError('rate', 'Trop de demandes ou plafond atteint. Réessaie dans un moment.');
  if (status >= 500) return new AIError('overloaded', `${p} est surchargé. Réessaie dans un instant.`);
  return new AIError('http', `Erreur de ${p} (${status}). ${detail}`);
}

function partsText(c) {
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) return c.map(p => (typeof p === 'string' ? p : p?.text || '')).join('');
  return '';
}

async function call(prompt, system, budget) {
  const c = conf(), pid = c.pid, pname = providerById(pid).name;
  let url, headers = { 'content-type': 'application/json' }, body;
  if (pid === 'anthropic') {
    url = 'https://api.anthropic.com/v1/messages';
    headers = { ...headers, 'x-api-key': c.key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' };
    body = { model: c.model, max_tokens: budget, system, messages: [{ role: 'user', content: prompt }] };
  } else if (pid === 'google') {
    const m = c.model.replace(/^models\//, '');
    url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent`;
    headers = { ...headers, 'x-goog-api-key': c.key };
    body = { systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: budget } };
  } else {
    const base = pid === 'openai' ? 'https://api.openai.com/v1' : pid === 'xai' ? 'https://api.x.ai/v1' : pid === 'openrouter' ? 'https://openrouter.ai/api/v1' : c.base;
    url = base + '/chat/completions';
    if (c.key) headers.authorization = 'Bearer ' + c.key;
    const extra = pid === 'openai' ? { max_completion_tokens: budget } : { max_tokens: budget };
    if (pid === 'openrouter') {
      headers['HTTP-Referer'] = location.origin + location.pathname; headers['X-Title'] = 'Caïssa';
      extra.reasoning = { effort: 'low', exclude: true };
    }
    body = { model: c.model, messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }], ...extra };
  }
  let res;
  try { res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) }); }
  catch { throw new AIError('network', `Impossible de joindre ${pname}. Vérifie ta connexion${pid === 'custom' ? ', l\'adresse du service et qu\'il accepte les appels depuis un navigateur (CORS)' : ''}.`); }
  if (!res.ok) { let d = ''; try { const j = await res.json(); d = j?.error?.message || j?.message || ''; } catch { /* rien */ } throw httpError(res.status, d, pname); }
  const j = await res.json();
  let text = '', finish = '';
  if (pid === 'anthropic') { text = (j.content || []).filter(b => b.type === 'text').map(b => b.text).join(''); finish = j.stop_reason || ''; }
  else if (pid === 'google') { const cd = j.candidates?.[0]; text = (cd?.content?.parts || []).filter(p => !p.thought).map(p => p.text || '').join(''); finish = cd?.finishReason || ''; }
  else { const ch = j.choices?.[0]; text = partsText(ch?.message?.content); finish = ch?.finish_reason || ''; }
  return { text, finish };
}

export async function ask(prompt, { maxTokens = 700, system = SYSTEM } = {}) {
  if (!hasKey()) throw new AIError('no_key', 'Choisis une IA et ajoute ta clé dans les réglages (⚙︎ → Professeur IA).');
  const pid = conf().pid;
  // marge pour les modèles qui « réfléchissent » avant d'écrire
  const budget = pid === 'anthropic' ? maxTokens : Math.max(maxTokens * 4, 4000);
  let r = await call(prompt, system, budget);
  if (r.text.trim()) return r.text.trim();
  r = await call(prompt, system, Math.max(budget * 2, 8000));
  if (r.text.trim()) return r.text.trim();
  throw new AIError('empty', `Le modèle n'a renvoyé aucun texte${r.finish ? ` (fin : ${r.finish})` : ''}. Choisis un modèle plus direct (par ex. Claude Haiku, une version « mini » ou « flash »).`);
}

/** Liste des modèles disponibles chez le fournisseur (avec la clé saisie). */
export async function listModels(pid, key, customBase = '') {
  const pname = providerById(pid).name;
  try {
    if (pid === 'anthropic') {
      const r = await fetch('https://api.anthropic.com/v1/models?limit=100', { headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' } });
      if (!r.ok) throw httpError(r.status, '', pname);
      const j = await r.json(); return (j.data || []).map(m => m.id);
    }
    if (pid === 'google') {
      const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': key } });
      if (!r.ok) throw httpError(r.status, '', pname);
      const j = await r.json();
      return (j.models || []).filter(m => m.supportedGenerationMethods?.includes('generateContent')).map(m => m.name.replace(/^models\//, ''));
    }
    const base = pid === 'openai' ? 'https://api.openai.com/v1' : pid === 'xai' ? 'https://api.x.ai/v1' : pid === 'openrouter' ? 'https://openrouter.ai/api/v1' : customBase.trim().replace(/\/+$/, '');
    const r = await fetch(base + '/models', { headers: key ? { authorization: 'Bearer ' + key } : {} });
    if (!r.ok) throw httpError(r.status, '', pname);
    const j = await r.json();
    let ids = (j.data || []).map(m => m.id);
    if (pid === 'openai') ids = ids.filter(id => /^(gpt|o\d|chatgpt)/.test(id) && !/(audio|realtime|transcribe|tts|image|search|embedding)/.test(id));
    return ids.sort();
  } catch (e) {
    if (e instanceof AIError) throw e;
    throw new AIError('network', 'Impossible de récupérer la liste des modèles. Vérifie la clé et la connexion.');
  }
}

export function testAI() { return ask('Réponds seulement : « Prêt pour la leçon ! »', { maxTokens: 200 }); }

/** Réglages IA de Tengen, s'ils sont lisibles depuis cette appli (même site, même navigateur). */
export function tengenAiSettings() {
  try {
    const t = JSON.parse(localStorage.getItem('tengen.settings') || 'null');
    if (!t) return null;
    const ai = t.ai || {};
    if (t.apiKey && !(ai.keys || {}).anthropic) ai.keys = { ...(ai.keys || {}), anthropic: t.apiKey };
    const keys = Object.entries(ai.keys || {}).filter(([, v]) => v);
    if (!keys.length && !ai.customBase) return null;
    return { provider: ai.provider || keys[0][0], keys: ai.keys || {}, models: ai.models || {}, customBase: ai.customBase || '' };
  } catch { return null; }
}

export const SYSTEM = `Tu es un entraîneur d'échecs bienveillant et concret qui parle français.
Ton élève est un joueur amateur d'environ 800 à 1200 Elo qui perd surtout sur des pièces laissées en prise et des tactiques simples, et qui perd ses moyens face aux humains.
Règles :
- Appuie-toi UNIQUEMENT sur la liste des pièces et les variantes du moteur fournies : n'invente jamais de coup, de pièce ni de case. Si les données ne suffisent pas, dis-le simplement.
- Utilise la notation française (R, D, T, F, C) telle qu'elle t'est donnée.
- Sois bref : 3 à 5 phrases, puis une ligne « À retenir : … » avec un réflexe simple et réutilisable (par ex. la routine Échecs · Prises · Menaces).
- Pas de jargon inutile, pas de titres, pas de markdown, pas de listes longues.`;

void store;
