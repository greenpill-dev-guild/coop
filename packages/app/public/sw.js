const SHELL_CACHE = 'coop-receiver-shell-v3';
const ASSET_CACHE = 'coop-receiver-assets-v3';
const ROUTE_SHELLS = ['/', '/landing', '/pair', '/receiver', '/inbox'];
const STATIC_ASSETS = [
  '/manifest.webmanifest',
  '/branding/coop-mark-flat-192.png',
  '/branding/coop-mark-flat-512.png',
  '/branding/coop-mark-flat.png',
  '/branding/coop-mark-glow-512.png',
  '/branding/coop-mark-glow.png',
  '/branding/coop-wordmark-flat.png',
  '/branding/coop-wordmark-glow.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll([...ROUTE_SHELLS, ...STATIC_ASSETS])),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => ![SHELL_CACHE, ASSET_CACHE].includes(key))
            .map((key) => caches.delete(key)),
        ),
      ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);
  const includesSensitivePairingMaterial =
    url.pathname === '/pair' && (url.searchParams.has('payload') || url.search.length > 0);
  const includesReceiverSharePayload =
    url.pathname === '/receiver' &&
    (url.searchParams.has('title') || url.searchParams.has('text') || url.searchParams.has('url'));

  // Sensitive routes (pairing payload, share params) are network-first.
  // Offline fallback intentionally serves the bare shell without query params
  // to avoid caching secrets. The app handles missing params gracefully.
  if (includesSensitivePairingMaterial || includesReceiverSharePayload) {
    event.respondWith(
      fetch(request).catch(async () => {
        const shell = await caches.match(url.pathname === '/pair' ? '/pair' : '/receiver');
        return shell || (await caches.match('/')) || new Response('Offline', { status: 503 });
      }),
    );
    return;
  }

  if (
    request.mode === 'navigate' &&
    (ROUTE_SHELLS.includes(url.pathname) || url.pathname.startsWith('/board/'))
  ) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const responseClone = response.clone();
          void caches.open(SHELL_CACHE).then((cache) => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(async () => {
          const direct = await caches.match(request);
          if (direct) {
            return direct;
          }
          return (await caches.match('/receiver')) || (await caches.match('/'));
        }),
    );
    return;
  }

  if (url.origin !== self.location.origin) {
    return;
  }

  if (
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'image' ||
    request.destination === 'font'
  ) {
    event.respondWith(
      caches.match(request).then(async (cached) => {
        const network = fetch(request)
          .then((response) => {
            const responseClone = response.clone();
            void caches.open(ASSET_CACHE).then((cache) => cache.put(request, responseClone));
            return response;
          })
          .catch(() => cached);

        return cached || network;
      }),
    );
  }
});
