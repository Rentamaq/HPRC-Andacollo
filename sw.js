// Modo sin conexión de la guía HPRC Andacollo.
// Al primer ingreso con internet guarda la guía, la revista, los 14 estándares y sus PDF.
// Cambia VERSION cada vez que se suban cambios para que los equipos descarguen lo nuevo.
const PREFIX = 'hprc-andacollo-';
const VERSION = PREFIX + 'v3';
const CODES = ['01','02','03','04','05','06','07','08','09','10','11','12','14','17'];
const CORE = [
  './', './index.html',
  './logos/rentamaq.png', './logos/teck.png',
  './compromisos/', './compromisos/index.html', './compromisos/compromisos-que-salvan-vidas.pdf',
  './pdfjs/pdf.min.js', './pdfjs/pdf.worker.min.js',
  ...CODES.map(c => `./estandares/HPRC-${c}.html`),
  ...CODES.map(c => `./pdf/HPRC-${c}.pdf`)
];
const EXTERNAL = [
  'https://cdn.jsdelivr.net/npm/page-flip@2.0.7/dist/js/page-flip.browser.min.js',
  'https://fonts.googleapis.com/css2?family=Montserrat:wght@300;600;800;900&family=Inter:wght@400;600;700&display=swap'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await cache.addAll(CORE);
    await Promise.all(EXTERNAL.map(async url => {
      try { const r = await fetch(url, {mode: 'cors'}); if (r.ok) await cache.put(url, r); } catch (e) {}
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    // Solo borra versiones antiguas de ESTE sitio: rentamaq.github.io aloja otras apps con sus propios cachés.
    await Promise.all(keys.filter(k => (k.startsWith(PREFIX) || k === 'hprc-v1') && k !== VERSION).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

async function networkFirst(req) {
  const cache = await caches.open(VERSION);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (e) {
    return (await cache.match(req, {ignoreSearch: true})) ||
           (await cache.match(new URL('./index.html', self.registration.scope).href)) ||
           new Response('Sin conexión', {status: 503, headers: {'Content-Type': 'text/plain; charset=utf-8'}});
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(req, {ignoreSearch: true});
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
    return res;
  } catch (e) {
    return new Response('', {status: 504});
  }
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Solo atiende lo de este sitio y sus librerías; no toca otras apps de rentamaq.github.io.
  const scope = self.registration.scope;
  if (url.origin === location.origin && !req.url.startsWith(scope)) return;
  const isPage = req.mode === 'navigate' || (url.origin === location.origin && url.pathname.endsWith('.html'));
  event.respondWith(isPage ? networkFirst(req) : cacheFirst(req));
});
