/* Service Worker - Jempol KIA Sindangsari
 *
 * Tugas: membuat aplikasi bisa DIPASANG (installable) dan menampilkan
 * cangkang (shell) aplikasi saat offline.
 *
 * PENTING: yang di-cache hanya berkas milik situs PWA ini (GitHub Pages).
 * Web app Apps Script (data pengajuan, login petugas) TIDAK pernah di-cache,
 * karena itu data sensitif dan harus selalu diambil langsung dari server.
 */

const VERSION = 'v1';
const CACHE_NAME = 'jempol-kia-' + VERSION;

const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) { return cache.addAll(SHELL); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys
          .filter(function (k) { return k.indexOf('jempol-kia-') === 0 && k !== CACHE_NAME; })
          .map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  const req = event.request;

  // Hanya tangani GET dari origin yang sama (situs PWA). Lainnya (Apps Script, CDN) lewat jaringan.
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Navigasi halaman: jaringan dulu, jika offline pakai index.html dari cache
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(function (res) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(function (c) { c.put('./index.html', copy); });
          return res;
        })
        .catch(function () {
          return caches.match('./index.html').then(function (hit) {
            return hit || caches.match('./');
          });
        })
    );
    return;
  }

  // Berkas statis (ikon, manifest, dll): cache dulu, perbarui di latar belakang
  event.respondWith(
    caches.match(req).then(function (hit) {
      const fetchAndUpdate = fetch(req)
        .then(function (res) {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then(function (c) { c.put(req, copy); });
          }
          return res;
        })
        .catch(function () { return hit; });
      return hit || fetchAndUpdate;
    })
  );
});

// Memungkinkan halaman meminta pembaruan SW segera aktif
self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
