// Caïssa — coque de l'application, navigation, accueil et réglages.
import { $, esc, modal, toast, confirmDialog } from './util.js';
import { store, settings } from './store.js';
import * as puzzles from './puzzles.js';
import * as play from './play.js';
import * as analysis from './analysis.js';
import * as notebook from './notebook.js';
import * as cours from './cours.js';
import { recommandation, avancement } from './eleve.js';
import { objectif, seanceFaiteAujourdhui, serieEnCours } from './niveaux.js';
import { puzzleProfile, THEMES } from './puzzles.js';
import { dueMistakes, weaknessStats, CATEGORIES, listGames } from './games.js';
import { advice } from './notebook.js';
import { engine } from './engine.js';
import { playerRating, setInitialElo } from './rating.js';
import { usageTexte } from './prof.js';
import { PROVIDERS, providerById, aiSettings, saveAiSettings, hasKey, aiName, listModels, testAI, cleanKey, guessProvider, tengenAiSettings, configuredProviders } from './ai.js';

export const VERSION = '1.5.2';

const ROUTES = { '': home(), cours, problemes: puzzles, jouer: play, analyse: analysis, carnet: notebook };
let current = null;

function parseHash() {
  const h = location.hash.replace(/^#\/?/, '');
  const [path, q = ''] = h.split('?');
  const params = Object.fromEntries(new URLSearchParams(q));
  return { path: path || '', params };
}

function route() {
  const { path, params } = parseHash();
  const view = ROUTES[path] || ROUTES[''];
  try { current?.unmount?.(); } catch (e) { console.warn(e); }
  current = view;
  document.querySelectorAll('.modal-wrap').forEach(m => m.remove());
  const main = $('#view');
  main.innerHTML = '';
  window.scrollTo(0, 0);
  view.mount(main, params);
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('on', t.dataset.r === (ROUTES[path] ? path : '')));
  updateBadge();
}

function updateBadge() {
  const n = dueMistakes().length;
  const tab = document.querySelector('.tab[data-r=carnet]');
  if (!tab) return;
  tab.querySelector('.dot')?.remove();
  if (n) tab.insertAdjacentHTML('beforeend', `<span class="dot">${n > 99 ? '99+' : n}</span>`);
}

// --- accueil ----------------------------------------------------------------------------
function home() {
  return {
    mount(root) {
      const s = settings.get();
      const prof = puzzleProfile();
      const ps = store.get('playStats', { games: 0, wins: 0, draws: 0, losses: 0 });
      const me = playerRating();
      const due = dueMistakes().length;
      const weak = weaknessStats();
      const cur = store.get('currentGame');
      const toAnalyse = listGames().find(g => !g.analysis);
      const hour = new Date().getHours();
      const hello = hour < 6 || hour >= 18 ? 'Bonsoir' : 'Bonjour';
      const name = s.playerName && s.playerName !== 'Moi' ? `, ${esc(s.playerName)}` : '';
      const theme = store.get('puzzleTheme', 'mix');
      const reco = recommandation(), av = avancement();
      const recoMot = { continuer: 'Reprendre', revision: 'Réviser', faiblesse: 'Choisie pour toi', suite: 'Leçon du jour', fini: 'Programme terminé' }[reco.type];
      root.innerHTML = `
      <div class="stack">
        <div class="hero">
          <div><p class="muted" style="margin:0">${hello}${name}</p>
          <div class="hero-title">Une partie à la fois,<br><em>sans paniquer.</em></div></div>
          <div class="stats">
            <div class="stat"><b>${me.elo}</b><span>ton Elo Caïssa${me.games < 10 ? ' (provisoire)' : ''}</span></div>
            <div class="stat"><b>${prof.rating}</b><span>niveau problèmes${prof.streak > 1 ? ` · série ${prof.streak}` : ''}</span></div>
            <div class="stat"><b>${ps.wins}–${ps.draws}–${ps.losses}</b><span>parties (V–N–D)</span></div>
          </div>
        </div>
        ${seanceFaiteAujourdhui() ? '' : `<a class="card cours-home" href="#/cours?seance=${Date.now()}">
          ${ICONS.school}
          <span class="grow"><span class="badge">Séance du jour</span><b>15 minutes avec le professeur</b>
            <span class="small muted">Objectif ${objectif().cible} Elo${serieEnCours() ? ` · série de ${serieEnCours()} jour${serieEnCours() > 1 ? 's' : ''}` : ''}</span></span>
        </a>`}
        <a class="card cours-home" href="${reco.lecon ? `#/cours?l=${reco.lecon.id}${reco.type === 'revision' ? '&rev=1' : ''}` : '#/cours'}">
          ${ICONS.school}
          <span class="grow"><span class="badge">${recoMot}</span><b>${reco.lecon ? esc(reco.lecon.titre) : 'Tes cours'}</b>
            <span class="small muted">${reco.lecon ? `${esc(reco.lecon.module.titre)} · ${reco.lecon.duree} min · ` : ''}${av.faites}/${av.total} leçons validées</span></span>
        </a>
        <div class="actions">
          <a class="action" href="#/problemes">${ICONS.puzzle}<b>Problèmes</b><span>Thème : ${THEMES[theme] || 'Mélange'} · adaptés à ton niveau</span></a>
          <a class="action" href="#/jouer">${ICONS.play}<b>${cur ? 'Reprendre' : 'Jouer'}</b><span>${cur ? 'Ta partie t\'attend' : '15 personnages, dont 9 qui jouent comme des humains'}</span></a>
          <a class="action" href="${toAnalyse ? '#/analyse?game=' + toAnalyse.id + '&auto=1' : '#/analyse'}">${ICONS.analyse}<b>Analyser</b><span>${toAnalyse ? 'Dernière partie pas encore analysée' : 'Tes parties, Lichess, Chess.com'}</span></a>
          <a class="action" href="${due ? '#/carnet?review=1' : '#/carnet'}">${ICONS.book}<b>Carnet</b><span>${due ? `${due} erreur${due > 1 ? 's' : ''} à revoir` : 'Tes erreurs deviennent des exercices'}</span></a>
        </div>
        <div class="split" style="grid-template-columns:repeat(auto-fit,minmax(280px,1fr))">
          <div class="card ritual">
            <h3>Avant chaque coup</h3>
            <ol>
              <li><b>Échecs</b> — les miens, et ceux de l'adversaire après mon coup.</li>
              <li><b>Prises</b> — qu'est-ce qui peut être pris ? Ma pièce est-elle défendue sur sa nouvelle case ?</li>
              <li><b>Menaces</b> — que veut faire l'adversaire avec son dernier coup ?</li>
            </ol>
            <p class="small muted" style="margin:8px 0 0">Cette routine de 10 secondes évite la majorité des gaffes entre 800 et 1200.</p>
          </div>
          <div class="card">
            <h3>${weak.length ? 'Ta faiblesse du moment' : 'Face à un humain'}</h3>
            ${weak.length ? `<p style="margin:0 0 6px"><b>${CATEGORIES[weak[0][0]]}</b> <span class="muted small">(${weak[0][1]} fois)</span></p><p class="small" style="margin:0">${advice(weak[0][0])}</p>` :
            `<p class="small" style="margin:0">L'adversaire joue vite ? Ce n'est pas une raison pour le suivre. Prends ton temps sur les coups qui changent la position (prises, échecs, poussées de pions) et joue plus vite les coups évidents.</p>`}
          </div>
        </div>
        <div class="card">
          <h3>Les fondamentaux</h3>
          ${LESSONS.map(l => `<details class="lesson"><summary>${l.t}</summary>${l.b}</details>`).join('')}
        </div>
      </div>`;
    },
    unmount() {},
  };
}

const LESSONS = [
  { t: 'Les 3 principes d\'ouverture', b: `<ul><li>Occupe ou contrôle le centre (pions e et d).</li><li>Sors les cavaliers et les fous avant de bouger deux fois la même pièce ; la dame attend.</li><li>Roque tôt, puis relie tes tours.</li></ul>` },
  { t: 'Ne plus laisser de pièce en prise', b: `<p>Avant de lâcher une pièce, compte sur sa case d'arrivée : combien d'attaquants adverses, combien de défenseurs ? Si les attaquants sont plus nombreux, ou si une pièce de moindre valeur l'attaque, ta pièce est en danger.</p><p>Après chaque coup adverse, regarde aussi quelles de tes pièces ne sont plus défendues : c'est souvent là que la tactique se cache.</p>` },
  { t: 'Gérer la pendule et le stress', b: `<ul><li>Préfère les cadences lentes (15 + 10) pour progresser : tu as le temps d'appliquer la routine.</li><li>Une respiration lente avant chaque coup critique fait retomber la pression.</li><li>Quand tu as un avantage, simplifie : échange les pièces, pas les risques.</li><li>Une gaffe n'est pas la fin : à ce niveau, l'adversaire en refera une. Reste concentré.</li></ul>` },
  { t: 'Valeur des pièces', b: `<p>Pion 1 · Cavalier 3 · Fou 3 · Tour 5 · Dame 9. Un échange est bon s'il te rapporte plus que ce que tu donnes, mais un mat vaut toujours plus que tout le matériel.</p>` },
  { t: 'Les mats élémentaires à connaître', b: `<ul><li>Mat du couloir : le roi est enfermé derrière ses propres pions.</li><li>Mat du berger : attaque sur f7 avec dame et fou — apprends à le parer (Cf6, De7 ou g6 au bon moment).</li><li>Roi + dame contre roi, puis roi + tour contre roi : à travailler contre Caïssa en finale.</li></ul>` },
];

// --- réglages --------------------------------------------------------------------------
function openSettings() {
  const s = settings.get();
  const theme = store.get('theme', 'auto');
  modal(`
    <h3>Réglages</h3>
    <div class="stack">
      <label class="field">Ton prénom<input id="st-name" value="${esc(s.playerName && s.playerName !== 'Moi' ? s.playerName : '')}" placeholder="Moi"></label>
      <div class="card" style="box-shadow:none">
        <div class="row between" style="flex-wrap:nowrap"><div style="min-width:0"><b>Professeur IA</b>
          <p class="muted small" style="margin:2px 0 0" id="st-ai-name">${esc(aiLigne())}</p></div>
          <button class="btn sm" id="st-ai">${configuredProviders().length > 1 ? 'Changer d\'IA' : 'Configurer'}</button></div>
        <p class="muted small" style="margin:6px 0 0">Claude, ChatGPT, Gemini, Grok, OpenRouter… comme dans Tengen. Il anime les cours, débriefe tes parties, prépare tes cours particuliers et répond à tes questions.</p>
        <p class="muted tiny" style="margin:4px 0 0">${esc(usageTexte())}</p>
      </div>
      <div class="grid2">
        <label class="field">Pseudo Lichess<input id="st-li" value="${esc(s.lichessUser)}" autocapitalize="off"></label>
        <label class="field">Pseudo Chess.com<input id="st-cc" value="${esc(s.chesscomUser)}" autocapitalize="off"></label>
      </div>
      <div><b>Profondeur d'analyse</b><div class="seg" id="st-depth" style="margin-top:6px">
        ${[[10, 'Rapide'], [13, 'Normale'], [16, 'Approfondie']].map(([v, l]) => `<button data-v="${v}" class="${s.analysisDepth === v ? 'on' : ''}">${l}</button>`).join('')}</div></div>
      <div><b>Noms des cases</b><div class="seg" id="st-names" style="margin-top:6px">
        ${[['bords', 'Sur les bords'], ['toutes', 'Sur chaque case'], ['aucune', 'Masqués']].map(([v, l]) => `<button data-v="${v}" class="${s.squareNames === v ? 'on' : ''}">${l}</button>`).join('')}</div></div>
      <label class="field">Mon Elo Caïssa<input id="st-elo" type="number" inputmode="numeric" min="100" max="3000" step="10" value="${playerRating().elo}"></label>
      <p class="muted small" style="margin:-6px 0 0">Il évolue tout seul après chaque partie classée. Tu peux le corriger ici (par exemple avec ton Elo Lichess ou Chess.com).</p>
      <div><b>Apparence</b><div class="seg" id="st-theme" style="margin-top:6px">
        ${[['auto', 'Auto'], ['light', 'Clair'], ['dark', 'Sombre']].map(([v, l]) => `<button data-v="${v}" class="${theme === v ? 'on' : ''}">${l}</button>`).join('')}</div></div>
      <div>
        <label class="switch"><span>Sons</span><input type="checkbox" id="st-sound" ${s.sound ? 'checked' : ''}></label>

      </div>
      <div><b>Sauvegarde</b><p class="muted small" style="margin:4px 0 8px">Tes données sont stockées sur cet appareil. Exporte-les pour les transférer ou les mettre à l'abri.</p>
        <div class="row"><button class="btn sm" id="st-export">Exporter</button><label class="btn sm">Importer<input type="file" id="st-import" accept="application/json" hidden></label><button class="btn sm danger" id="st-reset">Tout effacer</button></div></div>
      <div class="row between"><b>Caïssa ${VERSION}</b><button class="btn sm" id="st-maj">Rechercher une mise à jour</button></div>
      <p class="muted small" style="margin:0">Moteur Stockfish 19 (GPL v3) · personnages humains Maia, CSSLab Université de Toronto (GPL v3) · pièces cburnett · problèmes Lichess (CC0) et générés par Stockfish.</p>
      <div class="row end"><button class="btn ghost" data-close>Annuler</button><button class="btn primary" id="st-save">Enregistrer</button></div>
    </div>`, {
    onMount: (m, close) => {
      const segv = id => $(id + ' .on', m)?.dataset.v;
      ['#st-depth', '#st-theme', '#st-names'].forEach(id => $(id, m).addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return;
        $(id, m).querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
      }));
      const collect = () => ({
        playerName: $('#st-name', m).value.trim() || 'Moi',
        lichessUser: $('#st-li', m).value.trim(), chesscomUser: $('#st-cc', m).value.trim(), analysisDepth: +segv('#st-depth'),
        sound: $('#st-sound', m).checked, squareNames: segv('#st-names'),
      });
      $('#st-save', m).onclick = () => {
        settings.set(collect());
        const elo = +$('#st-elo', m).value;
        if (elo && elo !== playerRating().elo) setInitialElo(elo);
        const th = segv('#st-theme'); store.set('theme', th); applyTheme();
        close(); toast('Réglages enregistrés.'); route();
      };
      $('#st-ai', m).onclick = () => openAISettings(() => { $('#st-ai-name', m).textContent = aiLigne(); document.dispatchEvent(new CustomEvent('caissa:ai-changed')); });
      $('#st-maj', m).onclick = e => chercherMaj(e.currentTarget);
      $('#st-export', m).onclick = () => {
        const data = store.exportAll();
        if (data.settings) data.settings = { ...data.settings, apiKey: '', ai: data.settings.ai ? { ...data.settings.ai, keys: {} } : undefined };
        const blob = new Blob([JSON.stringify({ app: 'caissa', version: VERSION, at: new Date().toISOString(), data }, null, 1)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `caissa-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      };
      $('#st-import', m).onchange = async e => {
        const f = e.target.files[0]; if (!f) return;
        try {
          const j = JSON.parse(await f.text());
          if (j.app !== 'caissa') throw new Error('Ce fichier ne vient pas de Caïssa.');
          const keep = aiSettings();
          store.importAll(j.data);
          saveAiSettings(keep);
          close(); toast('Sauvegarde restaurée.'); route();
        } catch (err) { toast(err.message); }
      };
      $('#st-reset', m).onclick = async () => {
        if (!await confirmDialog('Tout effacer ?', 'Parties, carnet, niveau et réglages seront supprimés de cet appareil.', 'Effacer')) return;
        for (const k of Object.keys(store.exportAll())) store.del(k);
        close(); toast('Données effacées.'); route();
      };
    },
  });
}

// --- professeur IA (même fonctionnement que Tengen) -------------------------------------
function aiLigne() {
  const n = configuredProviders().length;
  return hasKey() ? `${aiName()}${n > 1 ? ` · ${n} clés enregistrées` : ''}` : n ? 'Choisis l\'IA à utiliser' : 'Pas encore configuré';
}
function openAISettings(onDone) {
  let ai = aiSettings();
  let edit = ai.provider; // fournisseur dont on saisit la clé (pas forcément celui qui est utilisé)
  let key = ai.keys[edit] || '', model = ai.models[edit] || providerById(edit).defaultModel, base = ai.customBase || '';
  let models = null, filter = '', show = false, msg = null;
  const tg = tengenAiSettings();
  const done = () => { onDone?.(); };
  modal('<div id="ai-root"></div>', { wide: true, onMount: (m, close) => {
    const root = $('#ai-root', m);
    const choose = id => {
      edit = id;
      key = ai.keys[id] || ''; model = ai.models[id] || providerById(id).defaultModel; models = null; filter = ''; msg = null;
      render();
    };
    // enregistre la clé et le modèle saisis ; use = en faire l'IA utilisée
    const save = use => {
      ai = { ...ai, keys: { ...ai.keys, [edit]: cleanKey(key) }, models: { ...ai.models, [edit]: model.trim() }, customBase: base.trim() };
      saveAiSettings(ai);
      if (use || !configuredProviders().includes(ai.provider)) { ai.provider = configuredProviders().includes(edit) ? edit : (configuredProviders()[0] || edit); saveAiSettings(ai); }
    };
    const render = () => {
      const pv = providerById(edit);
      const prets = configuredProviders();
      const autreActif = prets.includes(ai.provider) && ai.provider !== edit;
      const shown = (models || []).filter(x => !filter || x.toLowerCase().includes(filter.toLowerCase())).slice(0, 60);
      root.innerHTML = `
        <h3>Professeur IA</h3>
        <p class="small muted" style="margin:0 0 10px">Avec une clé API, une IA devient ton professeur : elle répond pendant les leçons, débriefe tes parties, bâtit des cours sur tes erreurs et rédige ton bulletin. Elle s'appuie toujours sur Stockfish, jamais sur son propre calcul. Tu peux enregistrer <b>plusieurs clés</b> et choisir à tout moment laquelle utiliser. Les clés restent <b>uniquement sur cet appareil</b>.</p>
        ${prets.length ? `<b class="small">IA utilisée par le professeur</b>
          <div class="prov-list" style="margin-bottom:14px">${prets.map(id => `<button class="prov ${ai.provider === id ? 'on' : ''}" data-use="${id}"><span><b>${providerById(id).name}</b><small>${esc(aiName(id).split(' · ').slice(1).join(' · ') || ai.models[id] || '')}</small></span>${ai.provider === id ? '<span class="badge good">Utilisée</span>' : '<span class="badge">Utiliser</span>'}</button>`).join('')}</div>` : ''}
        ${tg ? `<div class="card" style="box-shadow:none;margin-bottom:10px"><div class="row between"><span class="small">Tes réglages d'IA de <b>Tengen</b> sont disponibles ici.</span><button class="btn sm primary" id="ai-tg">Reprendre</button></div></div>` : ''}
        <b class="small">${prets.length ? 'Ajouter ou modifier une clé' : 'Fournisseur'}</b>
        <div class="prov-list">${PROVIDERS.map(p => `<button class="prov ${edit === p.id ? 'on' : ''}" data-p="${p.id}"><span><b>${p.name}</b><small>${p.brand} · ${esc(p.note)}</small></span>${ai.keys[p.id] ? '<span class="badge good">Clé enregistrée</span>' : ''}</button>`).join('')}</div>
        ${pv.id === 'custom' ? `<label class="field" style="margin-top:10px">Adresse du service (https)<input id="ai-base" inputmode="url" autocomplete="off" spellcheck="false" placeholder="https://mon-service.example/v1" value="${esc(base)}"></label>` : ''}
        <label class="field" style="margin-top:10px">Clé API ${pv.name}${pv.console ? ` <span class="muted">· à créer sur ${pv.console}</span>` : ''}
          <span class="row" style="flex-wrap:nowrap;margin-top:5px"><input id="ai-key" type="${show ? 'text' : 'password'}" autocomplete="off" spellcheck="false" placeholder="${pv.keyHint}" value="${esc(key)}" style="margin:0"><button class="btn sm" id="ai-show" type="button">${show ? 'Masquer' : 'Voir'}</button></span></label>
        <div id="ai-guess"></div>
        <div style="margin-top:10px"><b class="small">Modèle ${pv.name}</b>
          ${pv.suggested.length ? `<div class="chips" style="margin-top:6px">${pv.suggested.map(x => `<button class="chip ${model === x.id ? 'on' : ''}" data-m="${esc(x.id)}">${esc(x.label)}</button>`).join('')}</div>` : ''}
          <input id="ai-model" class="ai-input" autocomplete="off" spellcheck="false" placeholder="nom exact du modèle" value="${esc(model)}">
          <button class="btn sm" id="ai-list" style="margin-top:6px" ${!key.trim() && pv.id !== 'openrouter' && pv.id !== 'custom' ? 'disabled' : ''}>Voir les modèles disponibles</button>
          ${models ? `${models.length > 12 ? `<input id="ai-filter" class="ai-input" type="search" placeholder="Filtrer (ex. mistral, gpt, gemini, haiku…)" value="${esc(filter)}">` : ''}
            <div class="list" style="max-height:240px;overflow:auto;margin-top:6px">${shown.map(x => `<div class="list-item" data-pick="${esc(x)}"><span class="grow t" style="word-break:break-all;white-space:normal">${esc(x)}</span>${model === x ? '<span class="badge">Choisi</span>' : ''}</div>`).join('')}</div>` : ''}
        </div>
        <div class="row" style="margin-top:12px">
          <button class="btn primary" id="ai-save">${autreActif ? `Enregistrer et utiliser ${pv.name}` : 'Enregistrer'}</button>
          ${autreActif ? '<button class="btn" id="ai-keep">Enregistrer seulement</button>' : ''}
          <button class="btn" id="ai-test">Tester</button>
          ${ai.keys[edit] ? '<button class="btn danger" id="ai-del">Supprimer la clé</button>' : ''}
          <button class="btn ghost" data-close>Fermer</button>
        </div>
        ${autreActif ? `<p class="tiny muted" style="margin:6px 0 0">« Enregistrer seulement » garde ${providerById(ai.provider).name} comme IA utilisée.</p>` : ''}
        ${msg ? `<div class="fb ${msg.ok ? 'info' : 'ko'}" style="margin-top:10px">${esc(msg.text)}</div>` : ''}`;
      root.querySelectorAll('[data-use]').forEach(b => b.onclick = () => { ai.provider = b.dataset.use; saveAiSettings(ai); msg = { ok: true, text: `Le professeur utilise maintenant ${aiName()}.` }; render(); });
      root.querySelectorAll('[data-p]').forEach(b => b.onclick = () => choose(b.dataset.p));
      root.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { model = b.dataset.m; render(); });
      root.querySelectorAll('[data-pick]').forEach(b => b.onclick = () => { model = b.dataset.pick; render(); });
      root.querySelectorAll('[data-close]').forEach(b => b.onclick = () => { close(); done(); });
      const ki = $('#ai-key', root);
      const updateGuess = () => {
        const g = guessProvider(key), box = $('#ai-guess', root);
        box.innerHTML = g && g !== pv.id && pv.id !== 'custom' ? `<div class="fb ko small" style="margin-top:6px">Cette clé ressemble à une clé <b>${providerById(g).name}</b>, pas ${pv.name}. <button class="btn sm" id="ai-switch">Passer à ${providerById(g).name}</button></div>` : '';
        const sw = $('#ai-switch', root); if (sw) sw.onclick = () => { const k = key; choose(g); key = k; render(); };
        $('#ai-list', root).disabled = !key.trim() && pv.id !== 'openrouter' && pv.id !== 'custom';
      };
      ki.oninput = () => { key = ki.value; updateGuess(); };
      $('#ai-model', root).oninput = e => { model = e.target.value; };
      const bi = $('#ai-base', root); if (bi) bi.oninput = () => { base = bi.value; };
      const fi = $('#ai-filter', root); if (fi) fi.oninput = () => { filter = fi.value; const pos = fi.selectionStart; render(); const f2 = $('#ai-filter', root); f2.focus(); f2.setSelectionRange(pos, pos); };
      $('#ai-show', root).onclick = () => { show = !show; render(); };
      const tgb = $('#ai-tg', root); if (tgb) tgb.onclick = () => { ai = { ...ai, provider: tg.provider, keys: { ...ai.keys, ...Object.fromEntries(Object.entries(tg.keys).filter(([, v]) => v)) }, models: { ...ai.models, ...tg.models }, customBase: tg.customBase || ai.customBase }; edit = ai.provider; key = ai.keys[edit] || ''; model = ai.models[edit] || providerById(edit).defaultModel; base = ai.customBase || ''; saveAiSettings(ai); msg = { ok: true, text: 'Réglages de Tengen repris. Touche « Tester » pour vérifier.' }; render(); };
      updateGuess();
      $('#ai-list', root).onclick = async () => {
        msg = { ok: true, text: 'Chargement des modèles…' }; render();
        try { models = await listModels(edit, cleanKey(key), base); msg = { ok: true, text: `${models.length} modèles disponibles. Choisis-en un.` }; }
        catch (e) { msg = { ok: false, text: e.message }; }
        render();
      };
      $('#ai-save', root).onclick = () => { save(true); toast(`Le professeur utilise ${aiName()}.`); close(); done(); };
      const keep = $('#ai-keep', root); if (keep) keep.onclick = () => { save(false); msg = { ok: true, text: `Clé ${pv.name} enregistrée. Le professeur utilise toujours ${aiName()}.` }; render(); };
      $('#ai-test', root).onclick = async () => {
        save(false); msg = { ok: true, text: `Test de ${pv.name} en cours…` }; render();
        try { const t = await testAI(edit); msg = { ok: true, text: `${pv.name} répond : ${t}` }; }
        catch (e) { msg = { ok: false, text: e.message }; }
        render();
      };
      const del = $('#ai-del', root); if (del) del.onclick = () => {
        key = ''; ai = { ...ai, keys: { ...ai.keys, [edit]: '' } }; saveAiSettings(ai);
        if (ai.provider === edit && configuredProviders().length) { ai.provider = configuredProviders()[0]; saveAiSettings(ai); }
        msg = { ok: true, text: `Clé ${pv.name} supprimée.${hasKey() ? ` Le professeur utilise ${aiName()}.` : ''}` }; render();
      };
    };
    render();
  } });
}

function applyTheme() {
  const t = store.get('theme', 'auto');
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
}

// --- icônes -----------------------------------------------------------------------------
const ICONS = {
  puzzle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l2.4 5 5.6.6-4.2 3.8 1.2 5.5L12 14l-5 2.9 1.2-5.5L4 7.6 9.6 7z"/><path d="M5 21h14"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21h6M8 18h8l-1-5H9z"/><path d="M9 13c-1.5-1.2-2-2.6-2-4a5 5 0 0110 0c0 1.4-.5 2.8-2 4"/><path d="M12 4V2M10.5 3h3"/></svg>',
  analyse: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 20h18"/><path d="M4 16l4-5 4 3 4-7 4 4"/></svg>',
  book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h10a4 4 0 014 4v12H8a4 4 0 01-4-4z"/><path d="M8 20a2 2 0 01-2-2V4"/><path d="M10 9h5M10 13h5"/></svg>',
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/></svg>',
  expand: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
  shrink: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>',
  school: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 9L12 4.5 21.5 9 12 13.5z"/><path d="M6.5 11.2V16c1.6 1.6 3.4 2.4 5.5 2.4s3.9-.8 5.5-2.4v-4.8"/><path d="M21.5 9v5.5"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 01-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 010-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 014 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 010 4h-.1a1.7 1.7 0 00-1.5 1z"/></svg>',
};

// --- pas de zoom involontaire ------------------------------------------------------------
// Le pincement (iOS : événements « gesture* »), le double-tap et Ctrl + molette ne zooment plus.
function blockZoom() {
  const stop = e => e.preventDefault();
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(t => document.addEventListener(t, stop, { passive: false }));
  document.addEventListener('touchmove', e => { if (e.touches.length > 1 || (e.scale && e.scale !== 1)) e.preventDefault(); }, { passive: false });
  document.addEventListener('dblclick', stop, { passive: false });
  window.addEventListener('wheel', e => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
  document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && ['+', '-', '=', '0'].includes(e.key)) e.preventDefault(); });
}

// --- grand échiquier ---------------------------------------------------------------------
function applyFocus(on) {
  document.documentElement.classList.toggle('focus', on);
  $('#btn-focus').setAttribute('aria-pressed', on ? 'true' : 'false');
}
function toggleFocus() {
  const on = !store.get('focus', false);
  store.set('focus', on);
  applyFocus(on);
  window.scrollTo(0, 0);
}

// --- mises à jour ------------------------------------------------------------------------
function annoncerMaj() {
  if ($('.maj')) return;
  const b = document.createElement('div');
  b.className = 'maj';
  b.innerHTML = '<span>Nouvelle version de Caïssa prête.</span><button class="btn sm primary">Mettre à jour</button>';
  b.querySelector('button').onclick = () => location.reload();
  document.body.appendChild(b);
}
async function chercherMaj(btn) {
  btn.disabled = true; btn.textContent = 'Recherche…';
  try {
    const txt = await (await fetch('sw.js', { cache: 'no-store' })).text();
    const v = txt.match(/caissa-v([\d.]+)/)?.[1];
    if (!v || v === VERSION) { toast('Tu as déjà la dernière version.'); btn.disabled = false; btn.textContent = 'Rechercher une mise à jour'; return; }
    btn.textContent = `Installation de la ${v}…`;
    // on recharge les fichiers de l'appli sans passer par le cache du navigateur, on vide l'ancien cache, puis on redémarre
    const files = ['./', 'index.html', ...[...txt.matchAll(/'((?:js|css)\/[^']+)'/g)].map(x => x[1])];
    await Promise.all(files.map(f => fetch(f, { cache: 'reload' }).catch(() => null)));
    if (window.caches) { const keys = await caches.keys(); await Promise.all(keys.filter(k => k.startsWith('caissa-')).map(k => caches.delete(k))); }
    const reg = await navigator.serviceWorker?.getRegistration();
    await reg?.unregister();
    location.reload();
  } catch { toast('Impossible de vérifier : es-tu connecté ?'); btn.disabled = false; btn.textContent = 'Rechercher une mise à jour'; }
}

// --- démarrage --------------------------------------------------------------------------
function boot() {
  applyTheme();
  blockZoom();
  $('#btn-focus').innerHTML = ICONS.expand;
  $('#btn-focus').onclick = toggleFocus;
  $('#btn-focus-exit').innerHTML = ICONS.shrink;
  $('#btn-focus-exit').onclick = toggleFocus;
  applyFocus(store.get('focus', false));
  $('#tabs').innerHTML = `<div class="tabbar-in">
    <a class="tab" data-r="" href="#/">${ICONS.home}Accueil</a>
    <a class="tab" data-r="cours" href="#/cours">${ICONS.school}Cours</a>
    <a class="tab" data-r="problemes" href="#/problemes">${ICONS.puzzle}Problèmes</a>
    <a class="tab" data-r="jouer" href="#/jouer">${ICONS.play}Jouer</a>
    <a class="tab" data-r="analyse" href="#/analyse">${ICONS.analyse}Analyse</a>
    <a class="tab" data-r="carnet" href="#/carnet">${ICONS.book}Carnet</a></div>`;
  $('#btn-settings').innerHTML = ICONS.gear;
  $('#btn-settings').onclick = openSettings;
  // ouvert depuis une leçon, une analyse ou une partie : on ne recharge pas l'écran, on prévient seulement que l'IA a changé
  document.addEventListener('caissa:ai-settings', () => openAISettings(() => document.dispatchEvent(new CustomEvent('caissa:ai-changed'))));
  window.addEventListener('hashchange', route);
  route();
  // le moteur démarre en arrière-plan pour être prêt plus vite
  setTimeout(() => engine.start().catch(e => { console.error(e); toast('Le moteur Stockfish n\'a pas pu démarrer sur cet appareil.', 5000); }), 300);
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    let dejaInstallee = !!navigator.serviceWorker.controller;
    let reg = null;
    navigator.serviceWorker.register('sw.js').then(r => { reg = r; }).catch(() => {});
    // une nouvelle version vient de s'installer en arrière-plan : on le dit, sans interrompre une partie ou une leçon
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (dejaInstallee) annoncerMaj(); dejaInstallee = true; });
    // à chaque retour dans l'appli, on vérifie s'il y a du nouveau
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg?.update().catch(() => {}); });
  }
}

boot();
