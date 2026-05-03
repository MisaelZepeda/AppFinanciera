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

// Fetch: Intentar red primero, si falla (offline), usar caché
self.addEventListener('fetch', event => { 
    event.respondWith( 
        fetch(event.request)
        .then(response => {
            // Si hay internet, actualizamos el caché silenciosamente para la próxima vez
            if(event.request.method === "GET") {
                const resClone = response.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, resClone));
            }
            return response;
        })
        .catch(() => {
            // Si no hay red (Modo Offline), entregamos los archivos locales
            return caches.match(event.request); 
        }) 
    ); 
});