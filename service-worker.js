const VERSION = 'sweet-match-v12';
const SHELL = [
  './',
  './index.html',
  './styles/main.css',
  './manifest.json',
  './src/main.js',
  './src/game/board.js',
  './src/game/cascade.js',
  './src/game/match.js',
  './src/game/score.js',
  './src/game/hint.js',
  './src/game/levels.js',
  './src/game/roguelike.js',
  './src/ui/render.js',
  './src/ui/canvas-renderer.js',
  './src/ui/input.js',
  './src/ui/settings.js',
  './src/ui/achievements.js',
  './src/ui/particles.js',
  './src/ui/levelSelect.js',
  './src/audio/sfx.js',
  './src/audio/speech.js',
  './src/audio/haptics.js',
  './src/storage/save.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon.svg',
  './assets/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(VERSION).then((cache) => cache.put(req, clone)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});
