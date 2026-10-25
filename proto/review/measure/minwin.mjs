/* Headful Chromium (Xvfb): the window minimized (CDP Browser.setWindowBounds) while Refine all
   runs: visibilityState, animation frames, and the run's time; head (on show), live (the XRPD
   frame hidden behind a DRS tab, the window minimized), bg (parked, window minimized).
   node minwin.mjs <tree> [minutes to stay minimized before starting = 0] */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { BASE, XRD12, CIF, DRS, sleep } from './rlib.mjs';
const tree = process.argv[2], live = tree.startsWith('live');
const browser = await chromium.launch({ headless: false, args: ['--window-size=1400,950'], ignoreDefaultArgs: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] });
const ctx = await browser.newContext({ viewport: null, serviceWorkers: 'block' });
await ctx.addInitScript(l=>{ window.__T = ()=> performance.timeOrigin + performance.now(); if (l) try { localStorage.setItem('datatreat-live-tabs', 'on'); } catch(e){} }, live);
const page = await ctx.newPage();
await page.goto(BASE[tree] + '/index.html');
await page.waitForFunction(()=> !document.documentElement.classList.contains('app-booting') && document.querySelector('#tabBar .ptab-add'));
const realmOf = async i =>{ if (!live) return page; const id = await page.locator('#tabBar .ptab').nth(i).getAttribute('data-id'); const h = await page.waitForSelector(`.live-frames iframe[src*="embed=${id}"]`, { state: 'attached' }); const f = await h.contentFrame(); await f.waitForFunction(()=> !document.documentElement.classList.contains('app-booting') && !document.querySelector('.module-loader.show')); return f; };
const newTab = async mod =>{ await page.click('#nav button[data-tab="home"]'); const n = await page.locator('#tabBar .ptab').count(); await page.click(`.home-card[data-go="${mod}"]`); await page.waitForFunction(n=> document.querySelectorAll('#tabBar .ptab').length > n, n); const s = await realmOf(n); await s.waitForSelector(`#tab-${mod}.active`); await sleep(300); return [n, s]; };
let [A, s] = await newTab('xrd');
await s.setInputFiles('#xrdFiles', XRD12);
await s.waitForFunction(()=> document.querySelectorAll('#xrdFileTableWrap tr.file-row').length === 12 && !document.querySelector('.dz-loading'));
await s.setInputFiles('#xrdR2CifInput', CIF);
await s.waitForSelector('#xrdR2PhaseList input[data-on]');
const [B, sb] = await newTab('tauc');
await sb.setInputFiles('#taucFiles', DRS);
await page.locator('#tabBar .ptab').nth(A).locator('.ptab-label').click();
s = await realmOf(A); await sleep(1500);
const cdp = await ctx.newCDPSession(page);
const { windowId } = await cdp.send('Browser.getWindowForTarget');
const start = async ()=>{
  await s.evaluate(()=> document.querySelector('#xrdR2RefineAll').click());
  await s.waitForFunction(()=> document.querySelector('.confirm-modal'));
  return s.evaluate(()=>{ const t0 = window.__T(); document.querySelector('.confirm-modal .btn:not(.primary)').click(); return t0; });
};
const ended = ()=> tree === 'bg' ? page.evaluate(()=> import('./tabs.js').then(T=> !T.TABS.some(t=> t.jobs && t.jobs.length) && document.querySelector('#xrdR2Refine').textContent !== 'Cancel'))
                                 : s.evaluate(()=> document.querySelector('#xrdR2Refine').textContent === 'Refine');
for (const minimized of [false, true]){
  await sleep(1500);
  const t0 = await start();
  await sleep(300);
  if (tree !== 'head'){ await page.locator('#tabBar .ptab').nth(B).locator('.ptab-label').click(); }
  let other = null;
  if (minimized){ other = await ctx.newPage(); await other.goto('about:blank'); await other.bringToFront(); }
  await sleep(1000);
  const vis = await page.evaluate(()=> document.visibilityState);
  const raf = await s.evaluate(()=> new Promise(r=>{ let n = 0; const t0 = performance.now(); const f = ()=>{ n++; requestAnimationFrame(f); }; requestAnimationFrame(f); setTimeout(()=> r(n), 1000); }));
  const w0 = Date.now(); let ok = false;
  while (Date.now() - w0 < 90000){ if (await ended()){ ok = true; break; } await sleep(50); }
  const t1 = await page.evaluate(()=> window.__T());
  console.log(tree, minimized ? 'BEHIND A TAB' : 'normal   ', 'visibility', vis, 'rAF/s', raf, '| run', ok ? Math.round(t1 - t0) + ' ms (±50)' : 'NOT ENDED in 90 s');
  if (other){ await other.close(); await page.bringToFront(); }
  await sleep(1000);
  if (tree !== 'head'){ await page.locator('#tabBar .ptab').nth(A).locator('.ptab-label').click(); s = await realmOf(A); }
  const n = await s.evaluate(async ()=>{ const u = await import('./utils.js'); const c = u.getModuleState('xrd').cards.find(c=> c.id === 2); return Object.keys(c.states.rietveld.results || {}).length; });
  console.log('   results', n);
}
await browser.close();
