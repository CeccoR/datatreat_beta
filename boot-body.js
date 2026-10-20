/* Run at the end of <body>, before the modules. A file of its own, not an inline script:
   the page's Content-Security-Policy runs scripts from the app's own files only. */

/* The section in the URL hash shown before the first paint, so a reload lands there
   instead of flashing Home first. Only the fixed sections are addressable; module
   sections are reached through an open project tab. */
(function(){
  try {
    var t = location.hash.slice(1);
    if (['home','projects','settings'].indexOf(t) < 0) return;
    var sec = document.getElementById('tab-'+t);
    var btn = document.querySelector('#nav button[data-tab="'+t+'"]');
    if (sec && btn){
      document.querySelectorAll('.tab.active').forEach(function(e){ e.classList.remove('active'); });
      document.querySelectorAll('#nav button.active').forEach(function(e){ e.classList.remove('active'); e.setAttribute('aria-selected','false'); });
      sec.classList.add('active'); btn.classList.add('active'); btn.setAttribute('aria-selected','true');
    }
  } catch(e){}
})();

/* The service worker, for offline / installable use (secure contexts only), and the
   prompt shown when a new version of it is ready. */
function showPwaUpdate(worker){
  const t = document.getElementById('pwaUpdateToast');
  if (!t || t.classList.contains('show')) return;
  t.classList.add('show');
  document.getElementById('pwaUpdateBtn').onclick = () => {
    worker.postMessage('SKIP_WAITING');   // activate the waiting SW → controllerchange → reload
    t.classList.remove('show');
  };
  document.getElementById('pwaUpdateDismiss').onclick = () => t.classList.remove('show');
}
if ('serviceWorker' in navigator) {
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return; reloading = true; location.reload();
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then(reg => {
      // Already-waiting worker (update downloaded on a previous visit)
      if (reg.waiting && navigator.serviceWorker.controller) showPwaUpdate(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener('statechange', () => {
          // "installed" + an existing controller ⇒ this is an update, not first install
          if (nw.state === 'installed' && navigator.serviceWorker.controller) showPwaUpdate(nw);
        });
      });
    }).catch(() => {});
  });
}
