/* DataTreat service worker — cache-first offline app shell.
   Bump CACHE when any precached asset changes to force a refresh. */
const CACHE = 'datatreat-v568';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './inter-latin.woff2',
  './favicon.svg',
  './og-image.png',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png',
  './manifest.webmanifest',
  './boot-head.js',
  './boot-body.js',
  './utils.js',
  './filelist-model.js',
  './filelist-html.js',
  './textdata.js',
  './smooth.js',
  './modkit.js',
  './modcharts.js',
  './cards.js',
  './cards-model.js',
  './cards-html.js',
  './plot.js',
  './snav.js',
  './figure.js',
  './figure-layout.js',
  './figure-model.js',
  './tauc.js',
  './tauc-model.js',
  './tauc-html.js',
  './xrd.js',
  './xrd-model.js',
  './xrd-html.js',
  './epr.js',
  './epr-model.js',
  './epr-html.js',
  './gc.js',
  './gc-model.js',
  './gc-html.js',
  './sem.js',
  './sem-model.js',
  './sem-html.js',
  './fig.js',
  './fig-model.js',
  './fig-html.js',
  './iodo.js',
  './iodo-model.js',
  './iodo-html.js',
  './gc-pair.js',
  './gc-integ.js',
  './gc-integ-model.js',
  './gc-integ-html.js',
  './gc-tcd.js',
  './gc-tcd-pool.js',
  './gc-tcd.worker.js',
  './sem-read.js',
  './sem-read.worker.js',
  './sem-figure.js',
  './db.js',
  './tabs.js',
  './sessions.js',
  './xrd-rv.js',
  './xrd-rv-model.js',
  './xrd-rv-html.js',
  './xrd-rv-pool.js',
  './xrd-data.js',
  './xrd-cryst.js',
  './xrd-instr.js',
  './xrd-math.js',
  './xrd-rietveld.js',
  './xrd-broad.js',
  './xrd-rietveld.worker.js',
  './xrd-widths.js',
  './xrd-shape3d.js',
  './xrd-shape3d-model.js',
  './xrd-peaks.js',
  './xrd-peaks-model.js',
  './xrd-peaks-html.js',
  './xrd-sg.js',
  './xrd-cell3d.js',
  './xrd-cell3d-model.js'
];

self.addEventListener('install', (e)=>{
  // Don't skipWaiting automatically — the page shows an "update" toast and only then
  // asks this worker to activate (via the SKIP_WAITING message below).
  // cache:'reload' on every request: a plain addAll() is allowed to satisfy itself
  // from the browser's own HTTP cache, so a bumped CACHE could still be filled with
  // a stale copy of an asset — leaving the app running mixed versions, e.g. a new
  // index.html beside an old module.
  e.waitUntil(caches.open(CACHE).then(c=>
    c.addAll(ASSETS.map(u=> new Request(u, { cache: 'reload' })))
  ));
});

// The page posts this once the user accepts the update; activating fires
// controllerchange in the page, which reloads to pick up the new assets.
self.addEventListener('message', (e)=>{ if (e.data === 'SKIP_WAITING') self.skipWaiting(); });

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
  // ignoreSearch so cache-busting query strings (e.g. favicon.svg?v=2) still hit
  // the precached asset offline.
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res=>{
      if (res && res.status === 200 && res.type === 'basic'){
        const copy = res.clone();
        caches.open(CACHE).then(c=>c.put(req, copy));
      }
      return res;
    }).catch(()=> req.mode === 'navigate' ? caches.match('./index.html') : Response.error()))
  );
});
