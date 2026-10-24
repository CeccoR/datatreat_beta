/* A SEM tab of 8 images (2048 × 2176, 16 bits: 71 MB of files) woken from sleep on b2v2,
   its files' bytes read back from IndexedDB, taken apart (lim-lib.mjs's method):
   - S0 and T SEM tabs (lim-fx.mjs's files, each its own), every hidden one put to sleep in one
     call, their bytes let go (waited for: tabs.js lighten), two forced GCs;
   - each tab woken by a real click (lim-lib timedSwitch: from the pointerdown to two frames
     after the loader is gone), S0 shown again between two; its long tasks;
   - on alternate tabs, before the click, its parked state and history read back alone
     (db.js load, the wake's own read: from the store, nothing held of it in the page), timed
     in the page, then let go and collected; and a CPU profile (CDP Profiler) of the wake:
     the self time of the functions that take most, by file.
   LIM_PROFILE=disk: a profile on disk (lim-lib). node wake-sem.mjs [T = 6] → stdout (JSON) */
import * as L from './lim-lib.mjs';

const T = +(process.argv[2] || 6);
const env = await L.launch('b2', { knobs: { 'datatreat-rv-idle': '1' } });
const page = env.page, out = { profile: process.env.LIM_PROFILE || 'otr', T, wakes: [] };
await L.setLimits(env, { liveMax: 99, sleepMin: 1440 });
const S0 = await L.semTab(env, 0), tabs = [];
for (let k = 1; k <= T; k++) tabs.push(await L.semTab(env, k));
await page.locator('#tabBar .ptab').nth(S0).locator('.ptab-label').click(); await L.settle(page);
await page.evaluate(async ()=> (await import('./tabs.js')).sleepTick(Date.now() + 1441*60000));
const light = ()=> page.evaluate(async ()=>{ const T = await import('./tabs.js'), D = await import('./db.js'), s = T.TABS.filter(t=> !t.inst);
  return s.length && s.every(t=> D.unread(t.state)); });
for (const t1 = Date.now() + 60000; !(await light()) && Date.now() < t1;) await L.sleep(300);
out.allLight = await light();
await env.mem();
for (const [j, i] of tabs.entries()){
  const w = { tab: i };
  if (j % 2){
    // its read alone: the time db.js load takes for its state and history, nothing held
    w.loadMs = await page.evaluate(async i=>{ const D = await import('./db.js'), t = (await import('./tabs.js')).TABS[i], t0 = performance.now();
      const r = await D.load([t.state, t.hist && t.hist.states]); return { ms: Math.round(performance.now() - t0), lost: r.lost.size }; }, i);
    await env.mem();
  } else { await env.cdp.send('Profiler.enable'); await env.cdp.send('Profiler.setSamplingInterval', { interval: 200 }); await env.cdp.send('Profiler.start'); }
  const s = await L.timedSwitch(env, i);
  w.ms = s.ms; w.long = await L.longTasks(env, s.t0, s.t1 + 50);
  if (!(j % 2)){
    const { profile: p } = await env.cdp.send('Profiler.stop');
    // self time by function (ms), the largest
    const dt = new Map(); p.samples.forEach((id, k)=> dt.set(id, (dt.get(id) || 0) + (p.timeDeltas[k] || 0)/1000));
    const by = new Map();
    for (const n of p.nodes){ const f = n.callFrame, k = `${f.functionName || '(anon)'} ${(f.url || '').split('/').pop()}:${f.lineNumber + 1}`; by.set(k, (by.get(k) || 0) + (dt.get(n.id) || 0)); }
    w.top = [...by].filter(([k])=> !/^\(idle\)|^\(program\)/.test(k)).sort((a, b)=> b[1] - a[1]).slice(0, 12).map(([k, v])=> [k, L.r1(v)]);
    w.program = L.r1([...by].filter(([k])=> /^\(program\)/.test(k)).reduce((a, [, v])=> a + v, 0));
  }
  out.wakes.push(w);
  console.error(JSON.stringify(w));
  await L.timedSwitch(env, S0);
}
out.errors = env.errors;
console.log(JSON.stringify(out, null, 1));
await env.close();
