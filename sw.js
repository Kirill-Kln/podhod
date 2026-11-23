// Офлайн: сначала пробуем сеть (до 2,5 с), без сети или на медленной — отдаём из кэша.
// Так обновления прилетают сразу, а в зале без интернета приложение всё равно открывается.
const CACHE = 'podhod-0.4.0';
const FILES = ['./', 'index.html', 'style.css', 'app.js', 'manifest.webmanifest', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const net = fetch(e.request, { cache: 'no-store' }).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; });
    const timeout = new Promise(res => setTimeout(res, 2500));
    try {
      const r = await Promise.race([net, timeout]);
      if (r) return r;
    } catch (err) { /* нет сети */ }
    const hit = await c.match(e.request, { ignoreSearch: true });
    return hit || net;
  })());
});
