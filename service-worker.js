/**
 * service-worker.js — The Turrelle Sisters Big Munny
 * Network-first with cache fallback for offline/kiosk support.
 * CACHE_NAME is the ONLY place the version string lives — never hardcode it elsewhere.
 * Bump CACHE_NAME on every build that changes any cached file.
 */

const CACHE_NAME  = 'turrelle-v8.5.0';
const VER = '?v=8.5.0'; // must always match CACHE_NAME suffix
const CACHE_FILES = [
  './', './index.html',
  './style.css' + VER,
  './wabc.js',
  './paytable.js' + VER, './state.js' + VER, './audio.js' + VER,
  './game.js' + VER, './bonuses.js' + VER, './ui.js' + VER,
  './operator.js' + VER, './cashout.js',
  './wallet_module.js' + VER,
  './manifest.json',
  './assets/splash_screen.jpg',
  './assets/sisters_celebrate.png',
  './assets/sasha_solo_celebrate.png',
  './assets/TSistsersBigMunnyTitle.png',
  './assets/josie.png',
  './assets/sasha.png',
  './assets/scott.png',
  './assets/maxine.png',
  './assets/sisters.png',
  './assets/symbols/seven.svg',
  './assets/symbols/lipstick.svg', './assets/symbols/dollar_bills.svg',
  ,   ,   './assets/symbols/single_bar.svg', './assets/symbols/double_bar.svg',
  './assets/symbols/triple_bar.svg', './assets/symbols/diamond.svg',
  './assets/symbols/letter_b.svg',
  './assets/symbols/letter_o.svg',
  './assets/symbols/letter_n.svg',
  './assets/symbols/letter_u.svg',
  './assets/symbols/letter_s.svg',
  './assets/audio/ring1.mp3',
  './assets/audio/theme_music.mp3',
  './assets/audio/red_spin_music.mp3',
  './assets/audio/pick_music.mp3',


  './assets/audio/credits_addup.wav',
  './assets/audio/pick_reveal.wav',
  './assets/audio/splash_welcome.wav',
  './assets/icons/icon-72x72.png',   './assets/icons/icon-96x96.png',
  './assets/icons/icon-128x128.png', './assets/icons/icon-144x144.png',
  './assets/icons/icon-152x152.png', './assets/icons/icon-192x192.png',
  './assets/icons/icon-384x384.png', './assets/icons/icon-512x512.png',
  './assets/icons/apple-touch-icon.png',
];

// Install — cache everything
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CACHE_FILES))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('[SW] Cache install error:', err))
  );
});

// Activate — remove old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Fetch — NETWORK FIRST, cache as fallback
// Cache busting: versioned URLs (?v=X) are cached as-is.
// On cache miss, also tries the bare URL to handle SW upgrade edge cases.
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    fetch(event.request)
      .then(networkResponse => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return networkResponse;
      })
      .catch(() => {
        // Network failed — serve from cache (offline mode)
        return caches.match(event.request)
          .then(cached => cached || caches.match('./index.html'));
      })
  );
});
