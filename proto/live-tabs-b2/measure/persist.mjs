/* What a tab's record costs the page's thread to write (b2v4: it now takes what the tab shows,
   utils.js shownOf, beside its state): persistTab on the tab on show, an XRPD tab of the 12
   patterns (5384 points each) with its plots zoomed, the call alone (its write queued), median
   of 15; and shownOf alone, median of 15. BASE (default http://127.0.0.1:8990), OUT (the
   results' file, default persist.json). */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { XRD12, med, save } from './lib.mjs';
const r2 = x => Math.round(x*100)/100;

const BASE = process.env.BASE || 'http://127.0.0.1:8990';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 }, serviceWorkers: 'block' })).newPage();
const ready = ()=> page.waitForFunction(()=> !document.documentElement.classList.contains('app-booting') && !!document.querySelector('#tabBar .ptab-add') && !document.querySelector('.module-loader.show, .dz-loading'), null, { timeout: 120000 });
await page.goto(BASE + '/index.html'); await ready();
await page.click('#nav button[data-tab="home"]'); await page.click('.home-card[data-go="xrd"]'); await ready();
await page.setInputFiles('#xrdFiles', XRD12);
await page.waitForFunction(()=> document.querySelectorAll('#xrdFileTableWrap tr.file-row').length === 12); await ready();
// (every plot of the tab zoomed to its middle, as a user's zoom leaves it)
await page.evaluate(()=> document.querySelectorAll('#tab-xrd svg.plot').forEach(s=>{ const P = s._plot; if (!P) return; const dx = (P.xmax - P.xmin)/4, dy = (P.ymax - P.ymin)/4; P.xmin += dx; P.xmax -= dx; P.ymin += dy; P.ymax -= dy; P._refresh(); }));
const r = await page.evaluate(async ()=>{
  const T = await import('./tabs.js'), U = await import('./utils.js'), db = await import('./db.js'), t = T.activeTab(), w = [], s = [];
  for (let k = 0; k < 15; k++){ await db.sweep(); const t0 = performance.now(); T.persistTab(t); w.push(performance.now() - t0); }
  for (let k = 0; k < 15; k++){ if (!U.shownOf) break; const t0 = performance.now(); U.shownOf(t.inst); s.push(performance.now() - t0); }
  await db.sweep();
  const rec = await new Promise(res=>{ const q = indexedDB.open('datatreat'); q.onsuccess = ()=>{ const g = q.result.transaction('tabs').objectStore('tabs').get(t.id); g.onsuccess = ()=>{ res(g.result); q.result.close(); }; }; });
  return { persist: w, shownOf: s, shows: rec && rec.shows ? JSON.stringify(rec.shows).length : 0 };
});
const out = { base: BASE, tab: 'XRPD, 12 patterns of 5384 points, every plot zoomed', persistTabMs: r2(med(r.persist)), shownOfMs: r.shownOf.length ? r2(med(r.shownOf)) : null, showsJsonChars: r.shows, runs: r.persist.map(r2) };
console.log(JSON.stringify(out));
console.log(save(process.env.OUT || 'persist.json', out));
await browser.close();
