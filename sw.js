/* DataTreat service worker — cache-first offline app shell.
   Bump CACHE when any precached asset changes to force a refresh. */
const CACHE = 'datatreat-v7';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './favicon.svg',
  './manifest.webmanifest',
  './utils.js',
  './plot.js',
  './tauc.js',
  './xrd.js',
  './epr.js',
  './gc.js',
  './xrd-fit-core.js',
  './xrd-fit.worker.js'
];

self.addEventListener('install', (e)=>{
  e.waitUntil(
    caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate', (e)=>{
  e.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch', (e)=>{
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // don't touch cross-origin requests

  // Cache-first: serve from cache, else fetch and cache the result.
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res=>{
      if (res && res.status === 200 && res.type === 'basic'){
        const copy = res.clone();
        caches.open(CACHE).then(c=>c.put(req, copy));
      }
      return res;
    }).catch(()=> req.mode === 'navigate' ? caches.match('./index.html') : Response.error()))
  );
});
