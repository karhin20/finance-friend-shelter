// Service Worker for Finance Friend PWA

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
  return url.includes('/api/') || url.includes('supabase.co');
};

// Helper to check if URL is a navigation request
const isNavigationRequest = (request) => {
  return request.mode === 'navigate';
};

// Fetch event - serve cached content when offline
self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin) && 
      !event.request.url.includes('supabase.co')) {
    return;
  }

  // For API requests, try network first, then cache
  if (isApiRequest(event.request.url)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Clone the response
          const responseToCache = response.clone();
          
          // Store the response in the data cache
          caches.open(DATA_CACHE_NAME)
            .then((cache) => {
              // Only cache successful responses
              if (response.status === 200) {
                cache.put(event.request, responseToCache);
              }
            });
          
          return response;
        })
        .catch(() => {
          // If network fails, try to get from cache
          return caches.match(event.request);
        })
    );
  } else {
    // For non-API requests, try cache first, then network
    event.respondWith(
      caches.match(event.request)
        .then((response) => {
          // If found in cache, return the cached version
          if (response) {
            return response;
          }
          
          // Otherwise, fetch from network
          return fetch(event.request)
            .then((response) => {
              // If not a valid response, just return it
              if (!response || response.status !== 200 || response.type !== 'basic') {
                return response;
              }
              
              // Clone the response
              const responseToCache = response.clone();
              
              // Store the response in the main cache
              caches.open(CACHE_NAME)
                .then((cache) => {
                  cache.put(event.request, responseToCache);
                });
              
              return response;
            })
            .catch((error) => {
              // If it's a navigation request and fails, show offline page
              if (isNavigationRequest(event.request)) {
                return caches.match('/offline.html');
              }
              
              console.error('Fetch failed:', error);
              return new Response('Network error', { status: 503, statusText: 'Service Unavailable' });
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