/* An interaction in the app's XRPD tab (HEAD; 12 patterns refined, SrTiO3, card 2) while k
   Rietveld workers run in another page of the same browser (the bench, heavy settings: a
   pooled Refine all emulated; k = 0 is idle): the next sample (→, which redraws both cards,
   the refined pattern's curves among them), from the key to two animation frames, REPS
   times per k (one every 400 ms), the median and the largest. Then a parameter change: the
   Rietveld card's Settings… opened and closed (its modal built). */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { save, med, load, BASE } from './lib.mjs';
const KS = (process.argv[2] || '0,1,2,3,4,6').split(',').map(Number);
const REPS = +(process.argv[3] || 12);
const FX = '/tmp/claude-0/-home-user-datatreat-beta/51d5ad4e-64c4-51d8-8fdc-0e18be5b5240/scratchpad/e2e/xrd/';
const CIF = '/tmp/claude-0/-home-user-datatreat-beta/51d5ad4e-64c4-51d8-8fdc-0e18be5b5240/scratchpad/wf-xrd/rv-busy/SrTiO3.cif';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, serviceWorkers: 'block' });
const app = await ctx.newPage();
const errors = [];
app.on('pageerror', e=> errors.push(e.message));
app.on('framenavigated', f=>{ if (f === app.mainFrame()) console.log('NAV', f.url(), new Error().stack.split('\n')[1]); });
app.on('crash', ()=> console.log('CRASH app'));

await app.goto(BASE + '/index.html');
await app.waitForFunction(()=> !document.documentElement.classList.contains('app-booting') && document.querySelector('#tabBar .ptab-add'));
await app.click('#nav button[data-tab="home"]');
await app.click('.home-card[data-go="xrd"]');
await app.waitForSelector('#tab-xrd.active');
await app.setInputFiles('#xrdFiles', Array.from({ length: 12 }, (_, i)=> FX + 's' + String(i).padStart(2, '0') + '.xrdml'));
await app.waitForFunction(()=> document.querySelectorAll('#xrdFileTableWrap tr.file-row').length >= 12 && !document.querySelector('.dz-loading'));
await app.setInputFiles('#xrdR2CifInput', CIF);
await app.waitForSelector('#xrdR2PhaseList input[data-on]');
await app.waitForTimeout(800);
await app.click('#xrdR2RefineAll');
await app.waitForSelector('.confirm-modal');
await app.click('.confirm-modal .btn:not(.primary)');
await app.waitForFunction(()=> document.querySelector('#xrdR2Refine').textContent === 'Cancel');
await app.waitForFunction(()=> document.querySelector('#xrdR2Refine').textContent === 'Refine', null, { timeout: 120000 });
await app.waitForTimeout(500);
const bench = await ctx.newPage();
bench.on('framenavigated', f=>{ if (f === bench.mainFrame()) console.log('BENCH NAV', f.url()); });
bench.on('crash', ()=> console.log('CRASH bench'));
await bench.goto(BASE + '/bench/bench.html');
await bench.waitForFunction(()=> window.benchReady);
await bench.evaluate(()=> window.refineStd());
const step = ()=> app.evaluate(()=> new Promise(r=>{ const t0 = performance.now();
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  requestAnimationFrame(()=> requestAnimationFrame(()=> r(performance.now() - t0))); }));
const settings = ()=> app.evaluate(()=> new Promise(r=>{ const t0 = performance.now();
  document.querySelector('#xrdR2Settings').click();
  requestAnimationFrame(()=> requestAnimationFrame(()=>{ const d = performance.now() - t0; document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); r(d); })); }));
await step(); await step(); await settings().catch(()=> NaN);
const out = [];
for (const k of KS){
  await bench.evaluate(()=> window.killAll());
  if (k) bench.evaluate(k=> window.bench({ k, over: { on: { adp: true, occ: true }, dep: { size: 'ellipsoid', adp: 'overall', occ: 'Sr1' } }, irf: true, fresh: true }).catch(()=> null), k).catch(e=> console.log('bench eval ended:', e.message.split('\n')[0]));
  await app.waitForTimeout(k ? 1500 : 300);
  const st = [], se = [];
  for (let i = 0; i < REPS; i++){ st.push(await step()); await app.waitForTimeout(400); }
  for (let i = 0; i < 5; i++){ se.push(await settings().catch(()=> NaN)); await app.waitForTimeout(400); }
  const running = await bench.evaluate(()=> window.poolSize());
  out.push({ k, stepMed: med(st), stepMax: Math.max(...st), settingsMed: med(se), steps: st, sets: se, workersAlive: running, load: load() });
  console.log('k', k, 'next sample med/max', med(st).toFixed(1), Math.max(...st).toFixed(1), 'settings med', med(se).toFixed(1), 'load', load().join(' '));
}
await bench.evaluate(()=> window.killAll());
save('interact.json', { out, errors });
await browser.close();
