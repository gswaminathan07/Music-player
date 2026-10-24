// Vettify Service Worker - Instant PWA App Shell Caching & Background Audio Engine
const STATIC_CACHE = 'vettify-app-shell-v8';
const AUDIO_CACHE = 'vettify-audio-v1';

const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icon.svg',
  '/pwa-192.png',
  '/pwa-512.png',
  '/pwa-maskable.png',
  '/apple-touch-icon.png',
];

// Install: precache static app shell assets and activate immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('SW static prefetch note:', err);
      });
    })
  );
});

// Activate: purge obsolete cache versions immediately and claim all active clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== STATIC_CACHE && key !== AUDIO_CACHE) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Helper: check if request is for audio streaming
function isAudioRequest(request) {
  const url = new URL(request.url);
  const audioExtensions = /\.(mp3|wav|ogg|flac|m4a|aac|weba)(\?.*)?$/i;
  return (
    request.destination === 'audio' ||
    audioExtensions.test(url.pathname) ||
    url.pathname.includes('/audio/') ||
    (request.headers.get('accept') && request.headers.get('accept').includes('audio'))
  );
}

// Handle audio requests with HTTP 206 Range header support for mobile HTML5 Audio
async function handleAudioFetch(request) {
  const rangeHeader = request.headers.get('range');
  const cache = await caches.open(AUDIO_CACHE);
  const cleanUrl = request.url;

  let cachedResponse = await cache.match(cleanUrl);

  if (!cachedResponse) {
    try {
      const networkResponse = await fetch(request);
      if (networkResponse && networkResponse.status === 200) {
        cache.put(cleanUrl, networkResponse.clone());
      }
      return networkResponse;
    } catch (err) {
      if (cachedResponse) return cachedResponse;
      throw err;
    }
  }

  // If Range header requested by audio player, synthesize a 206 Partial Content response
  if (rangeHeader) {
    const arrayBuffer = await cachedResponse.clone().arrayBuffer();
    const bytesMatch = rangeHeader.match(/bytes=(\d+)-(\d*)/);

    if (bytesMatch) {
      const totalLength = arrayBuffer.byteLength;
      const start = parseInt(bytesMatch[1], 10);
      const end = bytesMatch[2] ? parseInt(bytesMatch[2], 10) : totalLength - 1;

      if (start < totalLength) {
        const slicedBuffer = arrayBuffer.slice(start, end + 1);
        const headers = new Headers();
        headers.set('Content-Range', `bytes ${start}-${end}/${totalLength}`);
        headers.set('Accept-Ranges', 'bytes');
        headers.set('Content-Length', slicedBuffer.byteLength.toString());
        headers.set(
          'Content-Type',
          cachedResponse.headers.get('content-type') || 'audio/mpeg'
        );

        return new Response(slicedBuffer, {
          status: 206,
          statusText: 'Partial Content',
          headers,
        });
      }
    }
  }

  return cachedResponse;
}

// Fetch event listener - Instant Launch Architecture (<300ms)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Pass through non-GET requests or backend server API routes directly
  if (event.request.method !== 'GET' || url.pathname.startsWith('/api/')) {
    return;
  }

  // 2. Audio requests (streaming or offline range requests)
  if (isAudioRequest(event.request)) {
    event.respondWith(handleAudioFetch(event.request));
    return;
  }

  // 3. Compiled Static Bundles (/assets/*.js, /assets/*.css): Cache-First for instant execution!
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(STATIC_CACHE).then((c) => c.put(event.request, clone));
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // 4. HTML Page Navigation: Fast Network-First with Instant Offline Cache Fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((c) => c.put(event.request, clone));
            return response;
          }
          return caches.match(event.request).then((cached) => cached || response);
        })
        .catch(async () => {
          const cached = await caches.match(event.request);
          if (cached) return cached;
          const cachedRoot = await caches.match('/');
          if (cachedRoot) return cachedRoot;
          return caches.match('/index.html');
        })
    );
    return;
  }

  // 5. General static assets (icons, manifest, webfonts): Stale-While-Revalidate
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(STATIC_CACHE).then((c) => c.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(() => cached);

      return cached || fetchPromise;
    })
  );
});

// Background Keep-Alive & Audio Pre-caching Message Channel
self.addEventListener('message', (event) => {
  if (!event.data) return;

  const { type, url } = event.data;

  if (type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  // Keep Audio Context and tab event loop active on mobile devices
  if (type === 'KEEP_AUDIO_ACTIVE') {
    if (event.source) {
      event.source.postMessage({
        type: 'KEEP_AUDIO_ACTIVE_ACK',
        timestamp: Date.now(),
      });
    }
  } else if (type === 'PRECACHE_AUDIO' && url) {
    // Pre-cache full audio in background so queued song starts instantly without pause
    caches.open(AUDIO_CACHE).then(async (cache) => {
      const match = await cache.match(url);
      if (!match) {
        try {
          const response = await fetch(url, { mode: 'cors' });
          if (response && response.ok) {
            await cache.put(url, response);
            if (event.source) {
              event.source.postMessage({ type: 'AUDIO_PRECACHED', url, success: true });
            }
          }
        } catch (err) {
          console.warn('Audio pre-cache notice:', url, err);
        }
      }
    });
  }
});
