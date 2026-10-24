/* What a background tab's own work costs the tab on show, in b2 (lim-lib.mjs: its method).
   node lim-bgjobs.mjs → results/lim-b2-bgjobs.json
   Tabs: X0 (XRPD, the 12 patterns refined: the one on show), X1–X3 (the same, files of their
   own), every tab kept awake (liveMax 99, sleepMin 1440, in the page). Each job is run twice:
   with X0 idle, so that every long task over it is the background's (the click that leaves
   the job's tab left out), and with → pressed in X0 every 100 ms (the keys' times).
   A. A SEM reading left at once (3 + 3 times): a new SEM tab, its 8 images (2048 × 2176, 16
      bits) dropped, X0 shown by a real click; the reading's span seen in the page (its tab
      busy, tabs.js tabsNow, polled every 5 ms from before the drop).
   B. Three hidden runs (once idle, once with keys): X1–X3 each shown and its Refine all
      pressed, X0 shown; until every run has ended.
   C. The same reading on show, for its own time.
   D. Bursts, as a page whose timers were held back would get them (Chrome throttles a
      hidden page's timers): every hidden tab trimmed in one call (tabs.js sleepTick 61 s
      on), then every one put to sleep in one (sleepTick 1441 min on), each timed in the page;
      4 tabs then woken by real clicks, each timed, with its long tasks. */
import * as L from './lim-lib.mjs';

const env = await L.launch('b2');
const page = env.page, out = { tree: 'b2', started: new Date().toISOString(), errors: env.errors };
await L.setLimits(env, { liveMax: 99, sleepMin: 1440 });
const X0 = await L.xrdTab(env, 0), XS = [await L.xrdTab(env, 1), await L.xrdTab(env, 2), await L.xrdTab(env, 3)];
const show = async i =>{ await page.locator('#tabBar .ptab').nth(i).locator('.ptab-label').click(); await L.settle(page); };
const tabs = ()=> L.tabsNow(env);
// The span of the busy tabs given, seen in the page every 5 ms: from the first busy to none.
const watch = idx => page.evaluate(async idx=>{
  const T = await import('./tabs.js');
  window.__busy = { t0: null, t1: null };
  const id = setInterval(()=>{ const b = idx.some(i=> T.tabsNow()[i].busy), w = window.__busy;
    if (b && w.t0 == null) w.t0 = window.__T(); if (!b && w.t0 != null){ w.t1 = window.__T(); clearInterval(id); } }, 5);
}, idx);
const busySpan = ()=> page.waitForFunction(()=> window.__busy.t1 != null && window.__busy, null, { timeout: 300000, polling: 50 }).then(async h=>{ const v = await h.jsonValue(); await h.dispose(); return v; });
// → in X0 every 100 ms until the span has ended.
async function keysUntilEnd(){
  const ms = [];
  while (!(await page.evaluate(()=> window.__busy.t1 != null))){ ms.push((await L.key(env, page, 'next')).ms); await L.sleep(100); }
  return ms;
}
await show(X0); await L.sleep(1500);

// A. a SEM reading left at once
out.hiddenReading = [];
for (let r = 0; r < 6; r++){
  const keys = r % 2 === 1;
  const i = await L.newTab(env, 'sem');
  await watch([i]);
  await L.drop(page, '#semDropzone', L.SEM(20 + r));
  const sw = await L.timedSwitch(env, X0);
  const ms = keys ? await keysUntilEnd() : [];
  const span = await busySpan();
  await L.sleep(300);
  const row = { keys, readMs: Math.round(span.t1 - span.t0), switchMs: sw.ms, long: await L.longTasksBut(env, span.t0, span.t1, [[sw.t0, sw.t1]]),
    keyMs: keys ? L.stats(ms) : null, raw: ms };
  out.hiddenReading.push(row);
  console.log('A hidden reading', r, JSON.stringify({ ...row, raw: undefined }));
  await L.sleep(1500);
}

// B. three hidden runs ending, X0 idle, then with keys
out.hiddenRuns = [];
for (const keys of [false, true]){
  for (const i of XS){ await show(i); await L.sleep(650); await L.pressRefineAll(page); }
  await watch(XS);
  const sw = await L.timedSwitch(env, X0);
  const ms = keys ? await keysUntilEnd() : [];
  const span = await busySpan();
  await L.sleep(300);
  const row = { keys, ms: Math.round(span.t1 - span.t0), long: await L.longTasksBut(env, sw.t1, span.t1 + 300, [[sw.t0, sw.t1]]), keyMs: keys ? L.stats(ms) : null, raw: ms };
  out.hiddenRuns.push(row);
  console.log('B hidden runs', JSON.stringify({ ...row, raw: undefined }));
  await L.sleep(1500);
}

// C. the reading on show
{
  await L.newTab(env, 'sem');
  const t0 = await L.now(env);
  await L.files(page, 'sem', L.SEM(23), 8);
  const t1 = await L.now(env);
  out.shownReading = { readMs: Math.round(t1 - t0), long: await L.longTasks(env, t0, t1) };
  console.log('C reading on show', JSON.stringify(out.shownReading));
}

// D. bursts: every hidden tab trimmed, then put to sleep, each in one call; 4 woken
{
  await show(X0); await L.sleep(1000);
  const burst = ms => page.evaluate(async ms=>{ const T = await import('./tabs.js'), t0 = performance.now(); T.sleepTick(Date.now() + ms); return performance.now() - t0; }, ms);
  const n = async ()=>{ const t = await tabs(); return { awake: t.filter(x=> x.awake).length, trimmed: t.filter(x=> x.trimmed).length }; };
  const before = await n(), trimMs = await burst(61000), afterTrim = await n();
  await L.sleep(1500);
  const sleepMs = await burst(1441*60000), afterSleep = await n();
  out.bursts = { before, trim: { ms: L.r1(trimMs), ...afterTrim }, sleep: { ms: L.r1(sleepMs), ...afterSleep } };
  await L.sleep(1500);
  const all = await page.evaluate(()=> document.querySelectorAll('#tabBar .ptab').length);
  out.wakes = [];
  for (const i of [XS[0], XS[1], all - 1, all - 2]){
    const was = (await tabs())[i];
    const s = await L.timedSwitch(env, i);
    out.wakes.push({ module: was.module, awake: was.awake, ms: s.ms, long: await L.longTasks(env, s.t0, s.t1 + 50) });
    await L.timedSwitch(env, X0);
  }
  console.log('D bursts', JSON.stringify(out.bursts), 'wakes', JSON.stringify(out.wakes));
}
out.load = L.loadavg();
console.log('saved', L.save('lim-b2-bgjobs.json', out), 'errors', env.errors);
await env.close();
