const CACHE_NAME = 'rt002-cache-v1';

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(clients.claim());
});

self.addEventListener('fetch', (e) => {
  // Vite handles live reload requests directly
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
