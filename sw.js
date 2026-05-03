const CACHE_NAME = 'dashpro-cache-v2'; // Cambiamos a v2 para que tu teléfono detecte la actualización

const urlsToCache = [ 
    './', 
    './index.html', 
    './styles.css', 
    './app.js', 
    './logo.svg',
    './manifest.json' // Agregado para proteger la instalación PWA
];

// Instalación: Guardar archivos esenciales
self.addEventListener('install', event => { 
    console.log('Service Worker instalado');
    event.waitUntil( 
        caches.open(CACHE_NAME).then(cache => { 
            return cache.addAll(urlsToCache); 
        }) 
    ); 
});

// Activación: Limpiar cachés de versiones anteriores
self.addEventListener('activate', (e) => {
    console.log('Service Worker activo');
    e.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// Fetch: Estrategia "Stale-While-Revalidate" (Favorita de PWABuilder)
self.addEventListener('fetch', event => {
    // Solo manejamos peticiones GET (ignoramos POST de Firebase)
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            // 1. Iniciamos la petición a internet en segundo plano para actualizar el caché
            const fetchPromise = fetch(event.request).then(networkResponse => {
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, networkResponse.clone());
                });
                return networkResponse;
            }).catch(() => {
                // Falla silenciosa si no hay internet
            });

            // 2. Si hay algo en caché, lo mostramos de INMEDIATO (super rápido)
            // Si no hay nada en caché, esperamos la respuesta de internet
            return cachedResponse || fetchPromise;
        })
    );
});