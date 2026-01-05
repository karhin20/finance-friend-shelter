

const CACHE_NAME = 'diligence-finance-cache-v1';
const DATA_CACHE_NAME = 'diligence-finance-data-cache-v1';
const OFFLINE_URL = '/offline.html';

const urlsToCache = [
  '/',
  '/index.html',
  '/offline.html',
  '/assets/index.css',
  '/assets/index.js',
  '/manifest.json',
  '/favicon.ico',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Install event - cache assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting();
});

// Activate event - cleanup old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== DATA_CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Helper function to determine if a request is an API request
const isApiRequest = (url) => {
  // Ensure the check is robust for your Supabase URL
  // You might want to make this more specific if other APIs are used
  const supabaseUrl = 'hqgkctyvbbaxjyjhvchy.supabase.co'; // Replace with your actual Supabase domain if different
  return url.includes(supabaseUrl);
};

// Helper to check if URL is a navigation request
const isNavigationRequest = (request) => {
  return request.mode === 'navigate';
};

// Fetch event - serve cached content when offline
self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests that are not to Supabase
  if (!event.request.url.startsWith(self.location.origin) &&
      !isApiRequest(event.request.url)) {
    // If it's neither same-origin nor a Supabase request, ignore it
    return;
  }

  // For API requests (Supabase), try cache first, then network
  if (isApiRequest(event.request.url)) {
    event.respondWith(
      caches.open(DATA_CACHE_NAME).then((cache) => {
        // 1. Try to get the response from the cache
        return cache.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            // If found in cache, return it
            // console.log('Serving API request from cache:', event.request.url);
            return cachedResponse;
          }

          // 2. If not in cache, fetch from the network
          // console.log('Fetching API request from network:', event.request.url);
          return fetch(event.request).then((networkResponse) => {
            // Clone the response to put in cache
            const responseToCache = networkResponse.clone();

            // Cache the successful network response
            // Use .then() to avoid blocking the return of the network response
            if (networkResponse.ok || networkResponse.status === 0) { // Cache successful or opaque responses
              cache.put(event.request, responseToCache).catch(err => {
                console.error('Failed to cache API response:', err);
              });
            }

            // Return the network response
            return networkResponse;
          }).catch(error => {
            // Handle fetch errors for API requests (e.g., offline)
            console.error('API fetch failed:', error);
            // Optionally return a custom offline response for API errors
            // return new Response(JSON.stringify({ error: 'Offline or network issue' }), {
            //   headers: { 'Content-Type': 'application/json' },
            //   status: 503,
            //   statusText: 'Service Unavailable'
            // });
            // Or just re-throw to indicate failure
            throw error;
          });
        });
      })
    );
  } else {
    // For non-API requests, use the existing cache-first strategy
    event.respondWith(
      caches.match(event.request)
        .then((response) => {
          // If found in cache, return it
          if (response) {
            return response;
          }

          // Otherwise, fetch from network
          return fetch(event.request)
            .then((networkResponse) => {
              // Basic check for valid response to cache
              if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                 // Don't cache redirects, errors, or opaque responses for app shell files
                return networkResponse;
              }

              // Clone the response
              const responseToCache = networkResponse.clone();

              // Store the response in the main app shell cache
              caches.open(CACHE_NAME)
                .then((cache) => {
                  cache.put(event.request, responseToCache);
                });

              return networkResponse;
            })
            .catch((error) => {
              // If it's a navigation request and fails, show offline page
              if (isNavigationRequest(event.request)) {
                return caches.match(OFFLINE_URL); // Use the constant
              }

              console.error('Non-API fetch failed:', error);
              // Avoid returning generic error for assets, let the browser handle it
              // Consider what to return here based on request type if needed
              return new Response('Network error occurred.', { status: 503, statusText: 'Service Unavailable' });
            });
        })
    );
  }
});

// Listen for messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
}); 