const CACHE_NAME = 'syncroedit-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/core/app.js',
  '/js/core/network.js',
  '/js/core/utils.js',
  '/js/ui/ui.js',
  '/js/ui/auth.js',
  '/js/ui/theme.js',
  '/js/ui/profile.js',
  '/js/ui/background.js',
  '/js/editor/editor.js',
  '/js/managers/PageManager.js',
  '/js/managers/BorderManager.js',
  '/js/managers/CursorManager.js',
  '/js/managers/ImageManager.js',
  '/js/ui/ToolbarController.js',
  '/pages/login.html',
  '/pages/start.html',
  // External CDNs - Cache them for performance/offline
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdn.quilljs.com/1.3.6/quill.snow.css',
  'https://cdn.quilljs.com/1.3.6/quill.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Service Worker: Caching App Shell');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('Service Worker: Clearing Old Cache');
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Stale-While-Revalidate Strategy
self.addEventListener('fetch', (event) => {
  // Ignore API requests, WebSocket upgrades, and non-http/https schemes (like chrome-extension)
  if (
      event.request.url.includes('/api/') || 
      event.request.url.includes('/ws/') ||
      !event.request.url.startsWith('http')
  ) {
    return;
  }
  
  // Ignore non-GET requests
  if (event.request.method !== 'GET') {
      return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        // Update the cache with the fresh response
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseClone);
            });
        }
        return networkResponse;
      });

      // Return cached response immediately if available, otherwise wait for network
      return cachedResponse || fetchPromise;
    })
  );
});