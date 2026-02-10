// Service Worker for QUIZZER App
// Provides offline support and caching for better performance

const CACHE_NAME = 'quizzer-v1';
const STATIC_CACHE = 'quizzer-static-v1';
const DYNAMIC_CACHE = 'quizzer-dynamic-v1';

// Files to cache immediately
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/styles.css',
    '/optimized-quiz-app.js',
    '/offline.html' // Create a simple offline fallback page
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('Service Worker: Installing...');
    
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => {
                console.log('Service Worker: Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .catch((error) => {
                console.error('Service Worker: Cache failed', error);
            })
    );
    
    // Force the waiting service worker to become the active service worker
    self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activating...');
    
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== STATIC_CACHE && cache !== DYNAMIC_CACHE) {
                        console.log('Service Worker: Clearing old cache', cache);
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
    
    // Claim all clients immediately
    return self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    const { request } = event;
    
    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }
    
    // Skip Firebase and external API requests (always fetch fresh)
    if (request.url.includes('firebaseapp.com') || 
        request.url.includes('googleapis.com') ||
        request.url.includes('gstatic.com')) {
        event.respondWith(fetch(request));
        return;
    }
    
    // Network-first strategy for HTML files
    if (request.headers.get('accept').includes('text/html')) {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    // Clone the response before caching
                    const responseClone = response.clone();
                    caches.open(DYNAMIC_CACHE).then((cache) => {
                        cache.put(request, responseClone);
                    });
                    return response;
                })
                .catch(() => {
                    // Fallback to cache if network fails
                    return caches.match(request).then((response) => {
                        return response || caches.match('/offline.html');
                    });
                })
        );
        return;
    }
    
    // Cache-first strategy for static assets (CSS, JS, images)
    event.respondWith(
        caches.match(request)
            .then((response) => {
                if (response) {
                    return response;
                }
                
                // If not in cache, fetch from network
                return fetch(request).then((response) => {
                    // Don't cache if not a valid response
                    if (!response || response.status !== 200 || response.type === 'error') {
                        return response;
                    }
                    
                    // Clone the response before caching
                    const responseClone = response.clone();
                    
                    caches.open(DYNAMIC_CACHE).then((cache) => {
                        cache.put(request, responseClone);
                    });
                    
                    return response;
                });
            })
            .catch(() => {
                // Fallback for failed requests
                if (request.url.includes('.jpg') || request.url.includes('.png') || request.url.includes('.svg')) {
                    // Return a placeholder image if you have one
                    return caches.match('/placeholder.png');
                }
            })
    );
});

// Background sync for offline quiz submissions (optional enhancement)
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-quiz-results') {
        event.waitUntil(syncQuizResults());
    }
});

async function syncQuizResults() {
    // This would sync any pending quiz submissions made while offline
    console.log('Service Worker: Syncing quiz results...');
    
    // Implementation would go here to sync with Firebase
    // when connection is restored
}

// Push notifications for exam reminders (optional enhancement)
self.addEventListener('push', (event) => {
    const data = event.data.json();
    
    const options = {
        body: data.body,
        icon: '/icon.png',
        badge: '/badge.png',
        vibrate: [200, 100, 200],
        data: {
            url: data.url || '/'
        }
    };
    
    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    event.waitUntil(
        clients.openWindow(event.notification.data.url)
    );
});
