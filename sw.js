// Service worker: guarda o app e os pedaços de mapa já vistos, para abrir sem internet.
// Ao mudar o app, aumente o número da versão abaixo.
const V = 'encomendas-v4';
const TILES = 'tiles-v1';
const ASSETS = ['./', './index.html', './manifest.json', './icon.svg', './icon-192.png', './icon-512.png', './leaflet.js', './leaflet.css'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(V).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== V && k !== TILES).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function trimTiles(cache) {
  const keys = await cache.keys();
  if (keys.length > 1500) {
    for (const k of keys.slice(0, keys.length - 1200)) await cache.delete(k);
  }
}

async function tileResponse(req) {
  const cache = await caches.open(TILES);
  const hit = await cache.match(req, { ignoreVary: true });
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res && res.ok) {
      cache.put(req, res.clone());
      if (Math.random() < 0.03) trimTiles(cache);
    }
    return res;
  } catch (err) {
    return Response.error();
  }
}

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.hostname === 'tile.openstreetmap.org') {
    e.respondWith(tileResponse(e.request));
    return;
  }
  if (url.origin !== location.origin) return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((cached) => {
      const net = fetch(e.request)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(V).then((c) => c.put(e.request, copy));
          }
          return res;
        })
        .catch(() => cached || caches.match('./index.html'));
      return cached || net;
    })
  );
});
