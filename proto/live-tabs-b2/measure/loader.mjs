/* The loader over every step that may take noticeable time (b2v3 part B, the user's 4-loader):
   each long task (over 100 ms, a PerformanceObserver) on the paths a user takes between tabs,
   and whether the loader was on the screen before it began (shown, and a frame drawn since:
   a requestAnimationFrame between the two) and still on as it ended.
   Tabs (LIM_PROFILE=disk forced: a profile on disk): X, XRPD of the 12 patterns and the CIF,
   refined; D, DRS of 10 Cary exports with a Tauc and an Urbach card; G, GC of 10 files; E,
   EPR of 10 spectra; S, SEM of 8 images of 2048 × 2176 at 16 bits (lim-fx.mjs's fx/, served
   with the tree). Steps:
     switch    each tab shown from the one before, all awake (twice round);
     resize    the window narrowed while S is on show, then X, D, G, E shown; widened back
               while X is on show, then S, D shown;
     ran       a Refine all in X left at once for D, its end awaited, X shown back;
     wake      every tab but the one on show put to sleep, each then shown;
     new       a new tab of each module (Home);
     project   X saved, closed, opened from Projects (asleep) and shown;
     undo      a label changed in X, undone and redone (Ctrl+Z, Ctrl+Y);
     reload    the page reloaded with the tabs open, till the tab on show is loaded.
   node loader.mjs <base> [tag] → results/loader-<tag>.json */
import * as L from './lim-lib.mjs';

process.env.LIM_PROFILE = 'disk';
const [base, tag = 'b2v3'] = process.argv.slice(2);
process.env.LIM_B2 = base || process.env.LIM_B2;
L.BASE.b2 = process.env.LIM_B2;
const INSTR = ()=>{
  window.__lt2 = []; window.__ld = []; window.__raf = [];
  try { new PerformanceObserver(l=> l.getEntries().forEach(e=> window.__lt2.push([e.startTime, e.duration]))).observe({ type: 'longtask', buffered: true }); } catch(e){}
  const loop = ()=>{ window.__raf.push(performance.now()); if (window.__raf.length > 20000) window.__raf.splice(0, 10000); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  // (the loader is made the first time it is shown: the body watched for it, its class
  // then; a MutationObserver's answer comes in the task that changed it)
  let on = false;
  const seen = ()=>{ const el = document.querySelector('.module-loader'), now = !!el && el.classList.contains('show'); if (now !== on){ on = now; window.__ld.push([performance.now(), now ? 1 : 0]); } };
  const watch = ()=> new MutationObserver(seen).observe(document.body, { attributes: true, attributeFilter: ['class'], childList: true, subtree: true });
  if (document.body) watch(); else document.addEventListener('DOMContentLoaded', watch);
};
const env = await L.launch('b2');
await env.ctx.addInitScript(INSTR);
await env.page.reload();
await env.page.waitForFunction(()=> !document.documentElement.classList.contains('app-booting') && !!document.querySelector('#tabBar .ptab-add'), null, { timeout: 60000 });
const page = env.page, out = { tag, base: L.BASE.b2, method: 'long tasks (PerformanceObserver, over 100 ms) during each step; covered: the loader shown before the task began with a frame drawn between, and still shown as it ended; a profile on disk, headless, 1400 × 900', steps: {} };
await L.setLimits(env, { awakeMax: 20, liveMax: 19, sleepMin: 1440 });

// The long tasks of a step (from t0, page time) and whether each was under the loader.
async function step(name, fn){
  const t0 = await page.evaluate(()=> performance.now());
  const r = await fn();
  await L.sleep(400);
  const got = await page.evaluate(t0=>{
    const lt = window.__lt2.filter(([s])=> s >= t0 - 5), ld = window.__ld, raf = window.__raf;
    const onAt = t =>{ let on = false; for (const [s, v] of ld){ if (s > t) break; on = !!v; } return on; };
    return lt.map(([s, d])=>{
      const shown = ld.filter(([t, v])=> v && t < s).pop(), hid = ld.find(([t, v])=> !v && t > s);
      const frame = !!shown && raf.some(f=> f > shown[0] && f < s);
      return { start: Math.round(s - t0), ms: Math.round(d), loaderOn: onAt(s), frameFirst: frame, offAfter: !hid || hid[0] >= s + d - 1, covered: onAt(s) && frame && (!hid || hid[0] >= s + d - 1) };
    });
  }, t0);
  const long = got.filter(x=> x.ms > 100);
  (out.steps[name] = out.steps[name] || []).push({ ...r, longTasks: got, over100: long.length, uncovered: long.filter(x=> !x.covered).length });
  console.log(name, JSON.stringify(r), '| long', got.map(x=> x.ms + (x.covered ? '' : '!')).join(' '));
}
const idx = {};
const tab = k => idx[k];
// The tabs
idx.X = await L.xrdTab(env, 0);
idx.D = await L.newTab(env, 'tauc');
await L.files(page, 'tauc', Array.from({ length: 10 }, (_, k)=> `fx/ten/c${k}.csv`), 10);
await page.click('#taucAddAn'); await page.click('.an-menu:not([hidden]) [data-kind="urbach"]'); await L.settle(page);
idx.G = await L.newTab(env, 'gc'); await L.files(page, 'gc', Array.from({ length: 10 }, (_, k)=> `fx/ten/g${k}.csv`), 10);
idx.E = await L.newTab(env, 'epr'); await L.files(page, 'epr', Array.from({ length: 10 }, (_, k)=> [`fx/ten/e${k}.DSC`, `fx/ten/e${k}.DTA`]).flat(), 10);
idx.S = await L.semTab(env, 0);
await L.sleep(6000);
const order = ['X', 'D', 'G', 'E', 'S'];
const sw = async k =>{ const s = await L.timedSwitch(env, tab(k)); return { to: k, ms: s.ms }; };
for (let r = 0; r < 2; r++) for (const k of order) await step('switch', ()=> sw(k));
// resize while another tab is on show
await page.setViewportSize({ width: 1180, height: 860 }); await L.sleep(800);
for (const k of ['X', 'D', 'G', 'E']) await step('resize', ()=> sw(k));
await page.setViewportSize({ width: 1400, height: 900 }); await L.sleep(800);
for (const k of ['S', 'D']) await step('resize', ()=> sw(k));
// a run ended while hidden
await sw('X'); await L.sleep(650); await L.pressRefineAll(page);
await sw('D');
await page.evaluate(async ()=>{ window.__tabs = await import('./tabs.js'); });
await page.waitForFunction(()=> !window.__tabs.tabsNow().some(t=> t.busy), null, { timeout: 600000, polling: 200 });
await L.sleep(500);
await step('ran', ()=> sw('X'));
// wakes
await sw('S');
await page.evaluate(async ()=> (await import('./tabs.js')).sleepTick(Date.now() + 1441*60e3));
await L.sleep(3000);
for (const k of ['X', 'D', 'G', 'E', 'S']) await step('wake', async ()=>{ const was = (await L.tabsNow(env))[tab(k)].awake; const r = await sw(k); return { ...r, was: was ? 'awake' : 'asleep' }; });
// new tabs
for (const m of ['xrd', 'tauc', 'gc', 'epr', 'sem']) await step('new', async ()=>{ const t0 = Date.now(); await L.newTab(env, m); return { module: m, ms: Date.now() - t0 }; });
// a project: saved, closed, opened from Projects, shown
await sw('X');
await page.fill('.project-name-input', 'loader-x'); await page.click('.proj-save'); await page.waitForSelector('.proj-save.is-saved');
await page.evaluate(async i=>{ const T = await import('./tabs.js'); T.closeTab(T.TABS[i].id); }, tab('X'));
await L.settle(page);
await step('project', async ()=>{
  await page.click('#nav button[data-tab="projects"]');
  const row = page.locator('#sessListWrap tr.sess-row').filter({ has: page.locator('input.proj-rename[value$="loader-x"]') });
  await row.first().locator('td').nth(3).click();
  const t = page.locator('#tabBar .ptab', { hasText: 'loader-x' });
  await t.first().waitFor();
  const i = await page.evaluate(()=> [...document.querySelectorAll('#tabBar .ptab')].findIndex(e=> e.textContent.includes('loader-x')));
  return { ...(await sw0(i)), what: 'opened from Projects, then shown' };
});
async function sw0(i){ const s = await L.timedSwitch(env, i); return { ms: s.ms }; }
// undo and redo in the project's tab (on show)
await step('undo', async ()=>{
  await page.locator('#xrdFileTableWrap input.file-label').first().fill('relabelled'); await page.keyboard.press('Enter'); await L.settle(page);
  await page.evaluate(()=> document.activeElement && document.activeElement.blur && document.activeElement.blur());
  const t0 = Date.now(); await page.keyboard.press('Control+z'); await L.settle(page); await page.keyboard.press('Control+y'); await L.settle(page);
  return { ms: Date.now() - t0 };
});
// reload
await L.sleep(6000);
await step('reload', async ()=>{
  const t0 = Date.now();
  await page.reload();
  await page.waitForFunction(()=> !document.documentElement.classList.contains('app-booting') && !!document.querySelector('#tabBar .ptab-add'), null, { timeout: 60000 });
  await L.settle(page);
  return { ms: Date.now() - t0, tabs: await L.nTabs(env) };
});
// (the reload's page: its own clock from navigation, the step's t0 not in it: read from 0)
out.steps.reload[0].longTasks = await page.evaluate(()=>{
  const ld = window.__ld, raf = window.__raf, onAt = t =>{ let on = false; for (const [s, v] of ld){ if (s > t) break; on = !!v; } return on; };
  return window.__lt2.map(([s, d])=>{ const shown = ld.filter(([t, v])=> v && t < s).pop(), hid = ld.find(([t, v])=> !v && t > s);
    const frame = !!shown && raf.some(f=> f > shown[0] && f < s);
    return { start: Math.round(s), ms: Math.round(d), loaderOn: onAt(s), frameFirst: frame, offAfter: !hid || hid[0] >= s + d - 1, covered: onAt(s) && frame && (!hid || hid[0] >= s + d - 1) }; });
});
{ const r = out.steps.reload[0], long = r.longTasks.filter(x=> x.ms > 100); r.over100 = long.length; r.uncovered = long.filter(x=> !x.covered).length;
  console.log('reload (from navigation)', r.longTasks.map(x=> x.ms + (x.covered ? '' : '!')).join(' ')); }
out.summary = Object.fromEntries(Object.entries(out.steps).map(([k, v])=> [k, { steps: v.length, over100: v.reduce((a, x)=> a + x.over100, 0), uncovered: v.reduce((a, x)=> a + x.uncovered, 0),
  longest: Math.max(0, ...v.flatMap(x=> x.longTasks.map(t=> t.ms))), longestUncovered: Math.max(0, ...v.flatMap(x=> x.longTasks.filter(t=> !t.covered).map(t=> t.ms))) }]));
out.errors = env.errors;
console.log(JSON.stringify(out.summary));
console.log(L.save(`loader-${tag}.json`, out));
await env.close();
