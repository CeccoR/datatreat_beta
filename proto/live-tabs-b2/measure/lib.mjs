/* What the b2 measurements share: the browser with its CDP sessions (memory after a forced
   GC: the page's JS heap, Blink's DOM counters, the renderer's RSS from /proc), the app's
   steps (a tab, its files, the CIF, Refine all), the shell's own state (tabs.js tabsNow) and
   timing in the page. Each tree is served on its own port (B2_BASE, HEAD_BASE). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const FX = path.resolve(HERE, '../../live-tabs/fixtures');
export const RESULTS = path.resolve(HERE, '../results');
export const BASES = { b2: process.env.B2_BASE || 'http://127.0.0.1:8993', head: process.env.HEAD_BASE || 'http://127.0.0.1:8994' };
export const XRD12 = Array.from({ length: 12 }, (_, i)=> path.join(FX, 'xrd', 's' + String(i).padStart(2, '0') + '.xrdml'));
export const CIF = path.join(FX, 'SrTiO3.cif');
export const med = a =>{ const s = a.filter(Number.isFinite).sort((x, y)=> x - y), n = s.length; return n ? (n % 2 ? s[(n - 1)/2] : (s[n/2 - 1] + s[n/2])/2) : NaN; };
export const r1 = x => Number.isFinite(x) ? Math.round(x*10)/10 : x;
export const sleep = ms => new Promise(r=> setTimeout(r, ms));
export function save(name, obj){ fs.mkdirSync(RESULTS, { recursive: true }); const f = path.join(RESULTS, name); fs.writeFileSync(f, JSON.stringify(obj, null, 1) + '\n'); return f; }

const INIT = ()=>{
  window.__lt = [];
  try { new PerformanceObserver(l=> l.getEntries().forEach(e=> window.__lt.push([performance.timeOrigin + e.startTime, e.duration]))).observe({ type: 'longtask', buffered: true }); } catch(e){}
  window.__now = ()=> performance.timeOrigin + performance.now();
};
// knobs: localStorage entries set before the app starts ({ 'datatreat-rv-lanes': '1' })
export async function launch(base, { knobs = {}, viewport = { width: 1400, height: 900 } } = {}){
  const browser = await chromium.launch({ args: ['--enable-precise-memory-info'] });
  const ctx = await browser.newContext({ viewport, serviceWorkers: 'block', acceptDownloads: true, timezoneId: 'UTC', locale: 'en-US', colorScheme: 'dark' });
  await ctx.addInitScript(INIT);
  if (Object.keys(knobs).length) await ctx.addInitScript(k=>{ try { for (const [a, b] of Object.entries(k)) localStorage.setItem(a, String(b)); } catch(e){} }, knobs);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e=> errors.push('pageerror: ' + e.message));
  page.on('console', m=>{ if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('dialog', d=> d.dismiss());
  const cdp = await ctx.newCDPSession(page);
  const bcdp = await browser.newBrowserCDPSession();
  const kb = (txt, k)=> +((txt.match(new RegExp('^' + k + ':\\s+(\\d+)', 'm')) || [])[1] || 0)/1024;
  // Memory after a forced GC (MB): the page's heap, the DOM (Blink's counters: nodes alive,
  // in the page or not), the renderer's RSS.
  async function mem(){
    for (let i = 0; i < 2; i++){ await cdp.send('HeapProfiler.collectGarbage'); await sleep(150); }
    const h = await cdp.send('Runtime.getHeapUsage');
    const d = await cdp.send('Memory.getDOMCounters');
    const ps = (await bcdp.send('SystemInfo.getProcessInfo')).processInfo.filter(p=> p.type === 'renderer');
    let rss = 0;
    for (const p of ps){ try { rss = Math.max(rss, kb(fs.readFileSync(`/proc/${p.id}/status`, 'utf8'), 'VmRSS')); } catch(e){} }
    return { heap: r1(h.usedSize/1048576), nodes: d.nodes, listeners: d.jsEventListeners, rss: r1(rss) };
  }
  const app = new App(page, base);
  await app.goto();
  return { browser, ctx, page, cdp, app, mem, errors, close: ()=> browser.close() };
}

export class App {
  constructor(page, base){ this.page = page; this.base = base; }
  async goto(){ await this.page.goto(this.base + '/index.html'); await this.page.waitForFunction(()=> !document.documentElement.classList.contains('app-booting') && document.querySelector('#tabBar .ptab-add'), null, { timeout: 60000 }); }
  count(){ return this.page.locator('#tabBar .ptab').count(); }
  async settle(){
    await this.page.waitForFunction(()=> !document.querySelector('.dz-loading, .module-loader.show'), null, { timeout: 120000 });
    await this.page.evaluate(()=> new Promise(r=> requestAnimationFrame(()=> requestAnimationFrame(()=> setTimeout(r, 20)))));
  }
  async newTab(mod){
    await this.page.click('#nav button[data-tab="home"]');
    const n = await this.count();
    await this.page.click(`.home-card[data-go="${mod}"]`);
    await this.page.waitForFunction(n=> document.querySelectorAll('#tabBar .ptab').length > n, n);
    // (the handle let go: one kept holds the section, and its instance, from the page's GC)
    await (await this.page.waitForSelector(`#tab-${mod}.active`)).dispose();
    await this.settle();
    return n;
  }
  async show(i){ await this.page.locator('#tabBar .ptab').nth(i).locator('.ptab-label').click(); await this.settle(); }
  /* Files dropped on a drop zone (a DragEvent in the page, the files' bytes passed in):
     Playwright's setInputFiles keeps a hold on the input it fills, and so on the section of
     its instance, which a tab put to sleep then never lets go (measured: a WeakRef to it
     still set after the GC). */
  async drop(sel, files){
    const list = files.map(f=> [path.basename(f), fs.readFileSync(f).toString('base64')]);
    await this.page.evaluate(([sel, list])=>{
      const dt = new DataTransfer();
      for (const [name, b64] of list) dt.items.add(new File([Uint8Array.from(atob(b64), c=> c.charCodeAt(0))], name));
      document.querySelector(sel).dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
    }, [sel, list]);
  }
  async files(mod, files){
    const sel = `#${mod}FileTableWrap tr.file-row`, n0 = await this.page.locator(sel).count();
    await this.drop(`#${mod}Dropzone`, files);
    await this.page.waitForFunction(([sel, n])=> document.querySelectorAll(sel).length >= n && !document.querySelector('.dz-loading'), [sel, n0 + files.length], { timeout: 180000 });
    await this.settle();
  }
  async cif(){ await this.drop('#xrdR2CifDz', [CIF]); await (await this.page.waitForSelector('#xrdR2PhaseList input[data-on]')).dispose(); await this.settle(); }
  // Refine all on card 2, 'Refine without the standard'; resolves once it runs.
  async refineAll(){
    await this.page.waitForTimeout(650);   // (a press within 600 ms of the last is not taken)
    await this.page.click('#xrdR2RefineAll');
    await (await this.page.waitForSelector('.confirm-modal')).dispose();
    await this.page.click('.confirm-modal .btn:not(.primary)');
    await this.page.waitForFunction(()=> document.querySelector('#xrdR2Refine').textContent === 'Cancel', null, { timeout: 30000 });
  }
  refineDone(timeout = 600000){ return this.page.waitForFunction(()=> document.querySelector('#xrdR2Refine').textContent === 'Refine', null, { timeout, polling: 50 }); }
  // An XRPD tab of the 12 patterns, the CIF, refined (Refine all): its index.
  async xrdRefined(){ const i = await this.newTab('xrd'); await this.files('xrd', XRD12); await this.cif(); await this.refineAll(); await this.refineDone(); await this.settle(); return i; }
  tabs(){ return this.page.evaluate(async ()=> (await import('./tabs.js')).tabsNow()); }
  // The shell's rules run as if `ms` had passed (tabs.js sleepTick).
  tick(ms){ return this.page.evaluate(async ms=> (await import('./tabs.js')).sleepTick(Date.now() + ms), ms); }
}
// A tab chosen in the bar: from the click's dispatch to two frames after the loader is
// gone (ms, in the page), and the long tasks meanwhile.
export async function timedShow(page, i){
  const t = await page.evaluate(i=> new Promise(res=>{
    const el = document.querySelectorAll('#tabBar .ptab')[i].querySelector('.ptab-label'), t0 = window.__now();
    el.click();
    const wait = ()=>{ if (document.querySelector('.module-loader.show')) return requestAnimationFrame(wait); requestAnimationFrame(()=> requestAnimationFrame(()=> res({ t0, ms: window.__now() - t0 }))); };
    requestAnimationFrame(wait);
  }), i);
  await sleep(300);
  const lt = await page.evaluate(t0=> window.__lt.filter(([s])=> s >= t0 - 1).map(([, d])=> d), t.t0);
  return { ms: r1(t.ms), longTasks: lt.length, longMs: Math.round(lt.reduce((a, b)=> a + b, 0)) };
}
