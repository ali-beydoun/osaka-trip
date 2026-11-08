// Offline support. Caches only the public app shell and the ENCRYPTED trip file.
// Decrypted trip data is never written to any cache or storage by this worker.
const REV = '20261108T100236Z';
const CACHE = `osaka-${REV}`;
const SHELL = [
  './',
  'index.html',
  'app.css',
  'tokens.css',
  'icons.svg',
  'js/app.js',
  'js/vault.js',
  'js/keystore.js',
  'js/trip.js',
  'js/ui.js',
  'js/model.js',
  'js/dom.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'data/trip.enc.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map((p) => new Request(p, { cache: 'reload' })))));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('osaka-') && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return; // never touch other origins
  if (req.mode === 'navigate') {
    // App shell: network first so updates land, cached shell offline. The URL fragment never reaches here.
    event.respondWith(fetch(req).catch(async () => (await caches.match('index.html', { ignoreSearch: true })) || Response.error()));
    return;
  }
  event.respondWith((async () => {
    const cached = await caches.match(req, { ignoreSearch: true });
    if (cached) return cached;
    return fetch(req);
  })());
});
