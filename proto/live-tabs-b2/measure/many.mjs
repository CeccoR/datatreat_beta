/* Many tabs open (b2v3: no limit on the tabs open, 20 awake by default): N XRPD tabs of the 12
   patterns (5384 points each), opened in turn, on a profile on disk (as LIM_PROFILE=disk).
   At N = 20 and N = 60:
   - open: a new blank tab, from the click on Home's card to two frames after its loader;
   - switch: to a tab awake and to a tab asleep (woken), the same;
   - bar: renderTabs alone (the strip drawn again: every switch and every change of a tab);
   - close: a hidden tab closed (closeTab: its record deleted and every tab's written again,
     persistAll), the page's thread in it, and until every write is in the store;
   - reload: from the reload to the shell revealed and the tab on show loaded;
   - the page's long tasks over 50 ms during the close and the reload.
   Medians of 5 (switches, bar, close: 3). BASE (default http://127.0.0.1:8990).
   node many.mjs → results/many.json */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { FX, med, r1, save } from './lib.mjs';

const BASE = process.env.BASE || 'http://127.0.0.1:8990';
const XRD12 = Array.from({ length: 12 }, (_, i)=> path.join(FX, 'xrd', 's' + String(i).padStart(2, '0') + '.xrdml'));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'many-profile-'));
const ctx = await chromium.launchPersistentContext(dir, { viewport: { width: 1400, height: 900 }, serviceWorkers: 'block' });
await ctx.addInitScript(()=>{ window.__lt = []; try { new PerformanceObserver(l=> l.getEntries().forEach(e=> window.__lt.push([e.startTime, e.duration]))).observe({ type: 'longtask', buffered: true }); } catch(e){} });
const page = ctx.pages()[0] || await ctx.newPage();
const errors = [];
page.on('pageerror', e=> errors.push(e.message));
const ready = ()=> page.waitForFunction(()=> !document.documentElement.classList.contains('app-booting') && !!document.querySelector('#tabBar .ptab-add') && !document.querySelector('.module-loader.show, .dz-loading'), null, { timeout: 120000 });
await page.goto(BASE + '/index.html'); await ready();
const frames = 'new Promise(r=> requestAnimationFrame(()=> requestAnimationFrame(r)))';
// A click, timed in the page to two frames after the loader is gone.
async function timed(sel){
  await page.evaluate(()=>{ window.__t0 = null; document.addEventListener('pointerdown', ()=>{ window.__t0 = performance.now(); }, { once: true, capture: true }); });
  await page.click(sel);
  await ready();
  return page.evaluate(`${frames}.then(()=> performance.now() - window.__t0)`);
}
const tabSel = i => `#tabBar .ptab:nth-child(${i + 1}) .ptab-label`;
async function addTab(){
  await page.click('#nav button[data-tab="home"]');
  return timed('.home-card[data-go="xrd"]');
}
const lt = (t0, t1)=> page.evaluate(([a, b])=> window.__lt.filter(([s, d])=> s + d >= a && s <= b).map(([, d])=> Math.round(d)), [t0, t1]);
const out = { base: BASE, files: '12 XRDML patterns of 5384 points a tab, the same files in every tab', at: {} };
let n = 0;
for (const N of [20, 60]){
  while (n < N){ await addTab(); await page.setInputFiles('#xrdFiles', XRD12); await page.waitForFunction(()=> document.querySelectorAll('#xrdFileTableWrap tr.file-row').length === 12); await ready(); n++; }
  const r = { open: [], switchAwake: [], switchAsleep: [], bar: [], close: [], closeAll: [], closeLong: [], reload: null, reloadLong: [] };
  for (let k = 0; k < 5; k++){ r.open.push(await addTab()); n++; }
  for (let k = 0; k < 3; k++){
    r.switchAwake.push(await timed(tabSel(n - 2))); r.switchAwake.push(await timed(tabSel(n - 1)));
    r.switchAsleep.push(await timed(tabSel(k))); await timed(tabSel(n - 1));
    r.bar.push(await page.evaluate(async ()=>{ const T = await import('./tabs.js'), t0 = performance.now(); T.renderTabs(); return performance.now() - t0; }));
  }
  // A hidden tab closed: its own thread time, and until the writes are in (the queue's next sweep).
  for (let k = 0; k < 3; k++){
    const [a, b, t0, t1] = await page.evaluate(async ()=>{
      const T = await import('./tabs.js'), db = await import('./db.js'), t0 = performance.now();
      T.closeTab(T.TABS[1].id);
      const a = performance.now() - t0;
      await db.sweep();
      return [a, performance.now() - t0, t0, performance.now()];
    });
    r.close.push(a); r.closeAll.push(b); r.closeLong.push(...await lt(t0, t1)); n--;
  }
  await page.waitForTimeout(500);
  const w0 = Date.now();
  await page.reload(); await ready();
  await page.evaluate(frames);
  r.reload = Date.now() - w0;
  r.reloadLong = await page.evaluate(()=> window.__lt.map(([, d])=> Math.round(d)).filter(d=> d > 50));
  const t = await page.evaluate(async ()=> (await import('./tabs.js')).tabsNow());
  out.at[N] = { tabs: t.length, awake: t.filter(x=> x.awake).length, open: r1(med(r.open)), switchAwake: r1(med(r.switchAwake)), switchAsleep: r1(med(r.switchAsleep)),
    bar: r1(med(r.bar)), closeThread: r1(med(r.close)), closeAll: r1(med(r.closeAll)), closeLongMax: Math.max(0, ...r.closeLong), reload: r.reload, reloadLongMax: Math.max(0, ...r.reloadLong) };
  console.log(N, JSON.stringify(out.at[N]));
  // (the tabs opened for the opens, then closed down again, the count at N + 2 kept as it is)
}
out.errors = errors;
console.log(save('many.json', out));
await ctx.close(); fs.rmSync(dir, { recursive: true, force: true });
