// Service worker : l'appli et Stockfish fonctionnent hors ligne après la première visite.
const CACHE = 'caissa-v1.1.0';
const ASSETS = [
  './', 'index.html', 'manifest.webmanifest',
  'css/app.css', 'css/pieces.css',
  'js/app.js', 'js/board.js', 'js/engine.js', 'js/store.js', 'js/util.js', 'js/coach.js',
  'js/games.js', 'js/bots.js', 'js/rating.js', 'js/openings.js', 'js/puzzles.js', 'js/play.js', 'js/analysis.js', 'js/notebook.js', 'js/lib/chess.js',
  'engine/stockfish-19-lite-single.js', 'engine/stockfish-19-lite-single.wasm',
  'data/puzzles.json',
  'fonts/cormorant-garamond-latin-500-normal.woff2', 'fonts/cormorant-garamond-latin-600-normal.woff2',
  'fonts/cormorant-garamond-latin-700-normal.woff2', 'fonts/cormorant-garamond-latin-600-italic.woff2',
  'icons/logo-small.svg', 'icons/caissa-icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon-v2.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // Lichess, Chess.com, Claude : réseau direct
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit => {
      const net = fetch(e.request).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
