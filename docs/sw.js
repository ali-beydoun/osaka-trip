// Offline support. Caches only the public app shell and the ENCRYPTED trip file.
// Decrypted trip data is never written to any cache or storage by this worker.
const REV = '20261108T220553Z';
const CACHE = `osaka-${REV}`;
const SHELL = [
  './',
  'index.html',
  'app.css',
  'tokens.css',
  'icons.svg',
  'js/theme.js',
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

// Each revision's shell is atomic: a page controlled by this worker gets every shell file, including the page
// itself and the encrypted trip, from THIS worker's cache. A newer revision installs alongside, waits, and takes
// over only when the person taps Reload on the "Trip updated" notice. Network is the fallback for anything missing.
async function fromOwnCache(req, key) {
  const cache = await caches.open(CACHE);
  return (await cache.match(key || req, { ignoreSearch: true })) || null;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return; // never touch other origins
  if (req.mode === 'navigate') {
    // The URL fragment never reaches here.
    event.respondWith((async () => (await fromOwnCache(req, 'index.html')) || fetch(req).catch(() => Response.error()))());
    return;
  }
  event.respondWith((async () => (await fromOwnCache(req)) || fetch(req))());
});
