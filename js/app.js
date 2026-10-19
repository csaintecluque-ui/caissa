// Caïssa — coque de l'application, navigation, accueil et réglages.
import { $, esc, modal, toast, confirmDialog } from './util.js';
import { store, settings } from './store.js';
import * as puzzles from './puzzles.js';
import * as play from './play.js';
import * as analysis from './analysis.js';
import * as notebook from './notebook.js';
import { puzzleProfile, THEMES } from './puzzles.js';
import { dueMistakes, weaknessStats, CATEGORIES, listGames } from './games.js';
import { advice } from './notebook.js';
import { engine } from './engine.js';
import { playerRating, setInitialElo } from './rating.js';

export const VERSION = '1.1.1';

const ROUTES = { '': home(), problemes: puzzles, jouer: play, analyse: analysis, carnet: notebook };
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
        <div class="actions">
          <a class="action" href="#/problemes">${ICONS.puzzle}<b>Problèmes</b><span>Thème : ${THEMES[theme] || 'Mélange'} · adaptés à ton niveau</span></a>
          <a class="action" href="#/jouer">${ICONS.play}<b>${cur ? 'Reprendre' : 'Jouer'}</b><span>${cur ? 'Ta partie t\'attend' : '11 personnages de 250 à 3000 Elo'}</span></a>
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
        <b>Explications par Claude</b>
        <p class="muted small" style="margin:4px 0 8px">Ta clé API reste uniquement sur cet appareil. Elle sert aux boutons « Expliquer ».</p>
        <label class="field">Clé API<input id="st-key" type="password" value="${esc(s.apiKey)}" placeholder="sk-ant-…" autocomplete="off"></label>
        <label class="field" style="margin-top:8px">Modèle<input id="st-model" value="${esc(s.model)}" autocomplete="off"></label>
        <button class="btn sm" id="st-test" style="margin-top:8px">Tester la clé</button>
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
      <p class="muted small" style="margin:0">Caïssa ${VERSION} · Moteur Stockfish 19 (GPL v3) · pièces cburnett · problèmes Lichess (CC0) et générés par Stockfish.</p>
      <div class="row end"><button class="btn ghost" data-close>Annuler</button><button class="btn primary" id="st-save">Enregistrer</button></div>
    </div>`, {
    onMount: (m, close) => {
      const segv = id => $(id + ' .on', m)?.dataset.v;
      ['#st-depth', '#st-theme', '#st-names'].forEach(id => $(id, m).addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return;
        $(id, m).querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
      }));
      const collect = () => ({
        playerName: $('#st-name', m).value.trim() || 'Moi', apiKey: $('#st-key', m).value.trim(), model: $('#st-model', m).value.trim() || 'claude-sonnet-5-5',
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
      $('#st-test', m).onclick = async () => {
        settings.set(collect());
        const { askClaude } = await import('./coach.js');
        try { const t = await askClaude('Réponds juste « Prêt ! » en un mot.', { maxTokens: 20 }); toast('Clé valide : ' + t); }
        catch (e) { toast(e.message, 4000); }
      };
      $('#st-export', m).onclick = () => {
        const data = store.exportAll();
        delete data.settings?.apiKey;
        if (data.settings) data.settings = { ...data.settings, apiKey: '' };
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
          const keep = settings.get().apiKey;
          store.importAll(j.data);
          if (keep) settings.set({ apiKey: keep });
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
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 01-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 010-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 014 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 010 4h-.1a1.7 1.7 0 00-1.5 1z"/></svg>',
};

// --- démarrage --------------------------------------------------------------------------
function boot() {
  applyTheme();
  $('#tabs').innerHTML = `<div class="tabbar-in">
    <a class="tab" data-r="" href="#/">${ICONS.home}Accueil</a>
    <a class="tab" data-r="problemes" href="#/problemes">${ICONS.puzzle}Problèmes</a>
    <a class="tab" data-r="jouer" href="#/jouer">${ICONS.play}Jouer</a>
    <a class="tab" data-r="analyse" href="#/analyse">${ICONS.analyse}Analyse</a>
    <a class="tab" data-r="carnet" href="#/carnet">${ICONS.book}Carnet</a></div>`;
  $('#btn-settings').innerHTML = ICONS.gear;
  $('#btn-settings').onclick = openSettings;
  window.addEventListener('hashchange', route);
  route();
  // le moteur démarre en arrière-plan pour être prêt plus vite
  setTimeout(() => engine.start().catch(e => { console.error(e); toast('Le moteur Stockfish n\'a pas pu démarrer sur cet appareil.', 5000); }), 300);
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

boot();
