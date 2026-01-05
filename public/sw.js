const CACHE_NAME = 'syncroedit-v2';
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
  '/js/ui/authController.js',
  '/js/editor/editor.js',
  '/js/managers/PageManager.js',
  '/js/managers/BorderManager.js',
  '/js/managers/CursorManager.js',
  '/js/managers/ImageManager.js',
  '/js/managers/LibraryManager.js',
  '/js/managers/ReadabilityManager.js',
  '/js/managers/SelectionManager.js',
  '/js/managers/NavigationManager.js',
  '/js/ui/ToolbarController.js',
  '/js/ui/UIManager.js',
  '/pages/login.html',
  '/pages/start.html',
  '/pages/forgot-password.html',
  '/pages/reset-password.html',
  '/pages/verify.html',
  // External CDNs - Cache them for performance/offline
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdn.quilljs.com/1.3.6/quill.snow.css',
  'https://cdn.quilljs.com/1.3.6/quill.js',
  'https://unpkg.com/idb-keyval@6.2.1/dist/index.js',
  'https://esm.sh/yjs@13.6.28',
  'https://esm.sh/y-quill@1.0.0?deps=yjs@13.6.28',
  '/js/vendor/y-websocket.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Service Worker: Caching App Shell');
      // Use cache.addAll cautiously, if one fails, the whole install fails.
      // Better to map and catch errors if some assets might be missing.
      return Promise.allSettled(
        ASSETS_TO_CACHE.map(url => cache.add(url).catch(err => console.warn(`Failed to cache ${url}:`, err)))
      );
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

// Handle messages safely
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  // Explicitly return nothing to indicate synchronous handling (or no handling)
});

// Stale-While-Revalidate Strategy
self.addEventListener('fetch', (event) => {
  // Ignore API requests, WebSocket upgrades, and non-http/https schemes
  if (
      event.request.url.includes('/api/') || 
      event.request.url.includes('/ws/') ||
      event.request.url.includes('socket.io') ||
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
      // If we have a cached response, return it and update in background
      if (cachedResponse) {
          const fetchPromise = fetch(event.request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
                const responseClone = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseClone);
                });
            }
            return networkResponse;
          }).catch(err => {
              console.debug('Service Worker: Background fetch failed, using cache:', event.request.url);
              return cachedResponse;
          });
          return cachedResponse;
      }

      // If NOT in cache, just fetch from network normally
      return fetch(event.request).catch(err => {
          console.warn('Service Worker: Fetch failed:', event.request.url);
          // Return a 404 or offline page if desired, instead of letting the error bubble up
          return new Response('Network Error', { status: 404, statusText: 'Network Error' });
      });
    })
  );
});