const CACHE_NAME = 'ai-prioritizer-v5';
const urlsToCache = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json'
];

// Installa il service worker
self.addEventListener('install', event => {
    // Forza il Service Worker a diventare attivo immediatamente
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Cache v2 aperta');
                return cache.addAll(urlsToCache);
            })
    );
});

// Strategia Stale-While-Revalidate: serve dalla cache e aggiorna in background
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.open(CACHE_NAME).then(cache => {
            return cache.match(event.request).then(response => {
                const fetchPromise = fetch(event.request).then(networkResponse => {
                    // Salva la versione aggiornata nella cache per la prossima volta
                    if (networkResponse && networkResponse.status === 200) {
                        cache.put(event.request, networkResponse.clone());
                    }
                    return networkResponse;
                }).catch(() => {
                    // Fallback se siamo offline e il file non è in cache
                    return response;
                });

                // Restituisce la cache subito (se c'è), altrimenti aspetta la rete
                return response || fetchPromise;
            });
        })
    );
});

// Pulisci le vecchie cache
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Eliminandola vecchia cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim()) // Prendi il controllo immediato delle pagine aperte
    );
});
