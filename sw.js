const CACHE = 'goldent-odontograma-v2-2-r6';
const ROOT = new URL('./', self.location.href);
const FILES = [
  './', './index.html', './styles.css', './app.js',
  './manifest.webmanifest', './goldent-logo.png', './goldent-logo.svg'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(FILES.map(file => new Request(
      new URL(file, ROOT).href, { cache: 'reload' }
    )));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(
      names.filter(name =>
        name.startsWith('goldent-odontograma-') && name !== CACHE
      ).map(name => caches.delete(name))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (
    request.method !== 'GET' ||
    url.origin !== ROOT.origin ||
    !url.pathname.startsWith(ROOT.pathname)
  ) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(request, { cache: 'no-store' });
      if (!response.ok) throw new Error('Descarga no disponible');
      await cache.put(request, response.clone()).catch(() => {});
      return response;
    } catch {
      const saved = await cache.match(request);
      if (saved) return saved;
      if (request.mode === 'navigate') {
        const home = await cache.match(new URL('index.html', ROOT).href);
        if (home) return home;
      }
      return Response.error();
    }
  })());
});
