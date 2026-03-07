const CACHE_NAME = 'ai-prioritizer-v1';
const urlsToCache = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './logo.png'
];

// Installa il service worker e aggiungi i file alla cache
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Cache aperta con successo');
                return cache.addAll(urlsToCache);
            })
    );
});

// Intercetta le richieste di rete per servire i file dalla cache se disponibili
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Se troviamo il file nella cache, lo restituiamo subito
                if (response) {
                    return response;
                }
                // Altrimenti, facciamo la normale richiesta di rete
                return fetch(event.request);
            })
    );
});

// Aggiorna la cache se cambia la versione del service worker
self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});
