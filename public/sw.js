/**
 * ⚡ Sonic Bingo Agent Portal Service Worker (sw.js)
 * High-performance PWA shell caching with a STRICT NON-INTERFERENCE FIREWALL
 * for all Live APIs, WebSockets, Cashier Floats, and Telegram callbacks.
 */

const CACHE_NAME = 'sonic-agent-shell-v1';

// Static Shell Assets for Instant Standalone Startup
const PRECACHE_ASSETS = [
  '/',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-512-maskable.png',
  '/icons/apple-touch-icon.png'
];

// 1. Install Event: Precache App Shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Precache asset fetch ignored during install:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// 2. Activate Event: Purge Stale Caches & Claim Immediate Control
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log(`[SW] Purging outdated cache: ${name}`);
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Fetch Event: Strict Zero-Regression Dynamic Traffic Bypass
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // A. Only intercept HTTP/HTTPS GET requests
  if (request.method !== 'GET' || !url.protocol.startsWith('http')) {
    return; // Pass through to browser network stack
  }

  // B. 🛑 FIREWALL 1: STRICT NETWORK-ONLY BYPASS
  // Under NO circumstances should live APIs, Socket.io, WebSockets, or Backend routes be cached!
  const isDynamicApi =
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/socket.io') ||
    url.pathname.includes('/telegram') ||
    url.pathname.includes('/webhook') ||
    url.hostname.includes('onrender.com') ||
    url.hostname.includes('neon.tech');

  if (isDynamicApi) {
    // Explicit bypass: do not call event.respondWith(), let browser handle directly
    return;
  }

  // C. Static Bundles & Hashed Assets (/assets/*, /icons/*): Cache-First Strategy
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // D. HTML Documents & Navigation: Network-First with Cache Fallback
  // Guarantees agents and users always get latest deployed version if online
  if (request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname === '/') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // If offline, serve cached shell
          return caches.match(request).then((cachedResponse) => {
            return cachedResponse || caches.match('/');
          });
        })
    );
    return;
  }

  // E. All other requests: Network-First
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});

