const CACHE_NAME = 'disaster-response-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/register.html',
  '/dashboard.html',
  '/emergency.html',
  '/authority.html',
  '/volunteer.html',
  '/css/style.css',
  '/css/dashboard.css',
  '/css/auth.css',
  '/js/auth.js',
  '/js/dashboard.js',
  '/js/emergency.js',
  '/js/authority.js',
  '/js/volunteer.js',
  '/js/firebase-config.js',
  '/images/logo.png'
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching static assets');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate Event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Cleaning old cache:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event (Network-First Fallback-to-Cache Strategy)
self.addEventListener('fetch', (event) => {
  // Avoid caching external Firebase/Google API calls to prevent conflicts
  if (event.request.url.includes('googleapis') || event.request.url.includes('firebase')) {
    return;
  }
  
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // If network request succeeds, clone and store it in cache
        if (response && response.status === 200) {
          const responseCopy = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseCopy);
          });
        }
        return response;
      })
      .catch(() => {
        // If offline / network fails, serve from cache
        return caches.match(event.request);
      })
  );
});
