// Cache-first with background refresh: the gate paints from the phone, never waits on the network.
const CACHE = 'slowdoor-v1'; // bump to force-drop old files
const FILES = ['./', 'style.css', 'app.js', 'logic.js', 'manifest.webmanifest', 'icon-180.png', 'icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  const key = url.origin + url.pathname; // ignore ?app=... so every gate visit shares one cache entry
  e.respondWith(
    caches.match(key).then((hit) => {
      const fresh = fetch(e.request, { cache: 'no-cache' }) // revalidate, or the host's 10-minute cache hides new deploys
        .then((res) => {
          if (res.ok) caches.open(CACHE).then((c) => c.put(key, res.clone()));
          return res;
        })
        .catch(() => hit);
      return hit || fresh;
    })
  );
});
