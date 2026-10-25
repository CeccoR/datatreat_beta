/* Run in <head>, before the first paint: the saved (or the system's) theme, so the page
   never flashes the other one; and the app kept hidden until its shell is assembled
   (tabs.js fades it in). A file of its own, not an inline script: the page's
   Content-Security-Policy runs scripts from the app's own files only. */
(function(){
  try {
    var saved = localStorage.getItem('datatreat-theme');
    var theme = saved || (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    document.documentElement.setAttribute('data-theme', theme);
  } catch(e){ document.documentElement.setAttribute('data-theme','dark'); }
  document.documentElement.classList.add('app-booting');
})();
