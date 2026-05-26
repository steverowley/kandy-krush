// Sweet Match service worker — cache-first with stale-while-revalidate
// (Phase 17w / D5).
//
// Old behavior: network-first → cache fallback. On a slow / flaky
// network the player had to wait for the network round-trip before
// painting, even though the cache had a perfectly good copy. The
// perf review flagged this as the main reason the start screen
// "feels slow" on mid-tier Android with a weak signal.
//
// New behavior:
//   - Cache hit returns immediately (fast paint).
//   - In the background, we still fetch + put the latest copy so
//     the next visit gets fresh code. The next reload picks up the
//     updated cache.
//   - Cache miss falls through to the network.
//
// SHELL is exhaustive — `install` precaches every source module +
// asset so an offline cold-boot works even without a prior online
// visit.

const VERSION = 'sweet-match-v77';
const SHELL = [
  './',
  './index.html',
  './styles/main.css',
  './manifest.json',
  './src/main.js',
  './src/telemetry.js',
  './src/purchases.js',
  './src/i18n.js',
  './src/strings.en.js',
  './src/game/rng.js',
  './src/game/event-bus.js',
  './src/game/run-effects.js',
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
    caches.match(req).then((cached) => {
      // 🚀 Cache-first: return cached response immediately.
      // 🔄 Stale-while-revalidate: regardless of cache hit, kick off
      //    a network fetch in the background and put the result back
      //    in the cache so the NEXT load sees fresh bytes. Silent on
      //    error (offline, etc.) — the cache stays whatever we had.
      const networkUpdate = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(VERSION).then((cache) => cache.put(req, clone)).catch(() => {});
          }
          return res;
        })
        .catch(() => null);
      // Prefer cache; fall back to network if not cached.
      return cached || networkUpdate;
    })
  );
});
