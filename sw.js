const CACHE_NAME = 'ex-yu-radio-shell-v8';
const FILES = ['./', './index.html', './styles.css?v=8', './app.js?v=8', './online.js?v=8', './statistika.html', './version.json', './manifest.webmanifest', './assets/icon-192.png', './assets/icon-512.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))), self.clients.claim()]));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Never intercept radio/audio streams or catalog APIs.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(response => response.ok ? response : caches.match('./index.html')).catch(() => caches.match('./index.html')));
    return;
  }
  event.respondWith(caches.match(request).then(cached => cached || fetch(request)));
});
