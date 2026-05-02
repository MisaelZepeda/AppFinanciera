const CACHE_NAME = 'dashpro-v1';

// Instalación básica
self.addEventListener('install', (e) => {
  console.log('Service Worker instalado');
});

// Activación
self.addEventListener('activate', (e) => {
  console.log('Service Worker activo');
});

// Este evento es OBLIGATORIO para que sea PWA
self.addEventListener('fetch', (e) => {
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
const CACHE_NAME = 'dashpro-cache-v1';
const urlsToCache = [ './', './index.html', './styles.css', './app.js', './logo.svg' ];
self.addEventListener('install', event => { event.waitUntil( caches.open(CACHE_NAME).then(cache => { return cache.addAll(urlsToCache); }) ); });
self.addEventListener('fetch', event => { event.respondWith( caches.match(event.request).then(response => { return response || fetch(event.request); }) ); });