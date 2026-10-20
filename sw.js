/* offline-first service worker: app shell cached, search APIs stay live */
var CACHE = 'kimi1040-v1';
var ASSETS = ['./', 'index.html', 'manifest.webmanifest', 'icon.svg',
  'css/style.css', 'css/fonts.css',
  'js/music.js', 'js/harp.js', 'js/midiparse.js', 'js/melody.js', 'js/lyrics.js',
  'js/library.js', 'js/search.js', 'js/synth.js', 'js/midiwrite.js', 'js/exportmp3.js',
  'js/exportpdf.js', 'js/i18n.js', 'js/app.js',
  'vendor/jspdf.umd.min.js', 'vendor/html2canvas.min.js', 'vendor/lame.min.js'];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return; /* let internet search go direct */
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(function (hit) {
    return hit || fetch(e.request).then(function (r) {
      var cp = r.clone();
      caches.open(CACHE).then(function (c) { c.put(e.request, cp); });
      return r;
    });
  }));
});
