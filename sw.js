const CACHE_NAME = 'go-service-v10';

// Файлы, которые нужны для работы оффлайн (оболочка приложения)
cconst urlsToCache = [
'./',
'./index.html',
'./css/style.css',
'./js/main.js',
'./js/api.js',
'./js/state.js',
'./js/utils.js',
'./js/tab-appointments.js',
'./js/tab-clients.js',
'./js/menu-settings.js',
'./js/tab-records.js',
'./js/tab-stats.js',
'./manifest.json',
'./img/byn.svg',
];

// Установка Service Worker и первичное кэширование
self.addEventListener('install', event => {
    self.skipWaiting(); // Сразу активируем новый SW
    event.waitUntil(
        caches.open(CACHE_NAME)
        .then(cache => cache.addAll(urlsToCache))
    );
});

// Очистка старых кэшей при обновлении версии
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim(); // Захватываем контроль над всеми открытыми вкладками
});

// Стратегия: Network First (Сначала сеть, потом кэш)
self.addEventListener('fetch', event => {
    // Не кэшируем запросы к Firebase и Google Scripts (они должны идти напрямую)
    if (event.request.url.includes('firestore.googleapis.com') ||
        event.request.url.includes('script.google.com')) {
        return;
        }

        event.respondWith(
            fetch(event.request)
            .then(response => {
                // Если сеть доступна, клонируем ответ и обновляем кэш
                if (response && response.status === 200) {
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME)
                    .then(cache => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return response;
            })
            .catch(() => {
                // Если нет интернета (оффлайн), достаем из кэша
                return caches.match(event.request);
            })
        );
});
