/* Working in the XRPD tab on show (12 patterns refined) while other tabs are open, idle,
   refining or reading. Real keys (rlib key): → (next sample) and a smoothing width typed in
   card 1 and Enter, alternately, 250 ms apart; ms from the key's own timestamp (so the time
   it waited for a busy main thread counts) to two frames after its handlers; the Event
   Timing duration beside it; long tasks of every realm over the phase.
   Tabs: X0 (on show), X1–X3 XRPD refined, S SEM 8 images, D DRS.
   node interact.mjs <tree> [n per phase = 16]
   phases: idle; own run (X0's Refine all going on); 1 / 3 other tabs refining (live: hidden
   frames; bg: parked, each started by showing its tab); live: a new SEM tab reading its 8
   images while X0 is on show (3 times). */
import { launch, xrdTab, plainTab, newTab, loadFiles, realm, show, startRefine, runEnd, key, longTasks, sleep, stats, save, loadavg, DRS, SEM8 } from './rlib.mjs';
const [tree, N = '16'] = process.argv.slice(2);
const n = +N;
const env = await launch(tree);
const page = env.page;
const X0 = await xrdTab(env), X = [await xrdTab(env), await xrdTab(env), await xrdTab(env)];
const S = await plainTab(env, 'sem', SEM8), D = await plainTab(env, 'tauc', DRS);
const idOf = i => page.locator('#tabBar .ptab').nth(i).getAttribute('data-id');
const clickTab = i => page.locator('#tabBar .ptab').nth(i).locator('.ptab-label').click();
const phases = [];
async function sample(s, label, okNow = async ()=> true, until = null){
  const rec = { label, next: [], smooth: [], nextEv: [], smoothEv: [], delay: [] };
  const t0 = Date.now();
  let i = 0, abs0 = null, abs1 = null;
  while (until ? !(await until()) : (rec.next.length + rec.smooth.length) < n){
    if (Date.now() - t0 > 240000) break;
    const what = until ? 'next' : (i++ % 2 ? 'smooth' : 'next');
    if (!(await okNow())){ await sleep(100); continue; }
    const r = await key(env, s, what);
    if (!(await okNow())) continue;          // (a run ended meanwhile: not counted)
    rec[what].push(r.ms); rec[what + 'Ev'].push(r.evDur); rec.delay.push(r.delay);
    abs0 = abs0 ?? r.t0; abs1 = r.t1;
    await sleep(until ? 60 : 250);
  }
  const lt = abs0 ? await longTasks(page, abs0, abs1) : { n: 0, sum: 0, max: 0 };
  const out = { label, next: rec.next.length ? stats(rec.next) : null, smooth: rec.smooth.length ? stats(rec.smooth) : null,
    nextEv: rec.nextEv.length ? stats(rec.nextEv.filter(x=> x != null)) : null, smoothEv: rec.smoothEv.length ? stats(rec.smoothEv.filter(x=> x != null)) : null,
    delay: stats(rec.delay), long: lt, span: abs1 - abs0, raw: rec, load: loadavg() };
  phases.push(out);
  console.log(tree, label.padEnd(22), 'next', JSON.stringify(out.next), '| smooth', JSON.stringify(out.smooth), '| delay max', out.delay.max, '| long', JSON.stringify(lt));
}
let s0 = await show(env, X0);
await sleep(1500);
await sample(s0, 'idle');

// X0's own run
{
  let on = true;
  const loop = (async ()=>{ while (on){ await startRefine(s0); await runEnd(s0); } })();
  await sleep(1200);
  await sample(s0, 'own run', ()=> s0.evaluate(()=> document.querySelector('#xrdR2Refine').textContent === 'Cancel'));
  on = false; await loop;
}

for (const k of [1, 3]){
  if (env.live){
    const fr = []; for (const i of X.slice(0, k)) fr.push(await realm(env, i));
    let on = true;
    const loops = fr.map(f=> (async ()=>{ while (on){ await startRefine(f); await runEnd(f); } })());
    await sleep(1500);
    const running = ()=> Promise.all(fr.map(f=> f.evaluate(()=> document.querySelector('#xrdR2Refine').textContent === 'Cancel'))).then(a=> a.every(Boolean));
    await sample(s0, k + ' hidden refining', running);
    on = false; await Promise.all(loops);
  } else if (tree === 'head' || tree === 'pool'){
    continue;   // (today: a switch away from a run asks to stop it)
  } else {
    // bg: parked runs, each started by showing its tab; restarted when any has ended
    const ids = await Promise.all(X.slice(0, k).map(idOf));
    const allRunning = ()=> page.evaluate(ids=> import('./tabs.js').then(T=> ids.every(id=>{ const t = T.TABS.find(t=> t.id === id); return t && t.jobs && t.jobs.length; })), ids);
    const start = async ()=>{ for (const i of X.slice(0, k)){ const s = await show(env, i); await sleep(200); await startRefine(s); } s0 = await show(env, X0); await sleep(800); };
    const rec = [];
    let got = 0;
    while (got < n){
      await start();
      const before = phases.length;
      const nn = n;
      // sample until any run ends, then restart
      const r = { label: k + ' parked refining', next: [], smooth: [] };
      let i = 0;
      while (await allRunning() && got < nn){
        const what = i++ % 2 ? 'smooth' : 'next';
        const x = await key(env, s0, what);
        if (!(await allRunning())) break;
        rec.push({ what, ...x }); got++;
        await sleep(250);
      }
      // let the runs end before the next start
      for (const tEnd = Date.now() + 120000; Date.now() < tEnd; await sleep(100)){
        const idle = await page.evaluate(ids=> import('./tabs.js').then(T=> ids.every(id=>{ const t = T.TABS.find(t=> t.id === id); return !(t.jobs && t.jobs.length) && !(T.isLive(t) && document.querySelector('#xrdR2Refine').textContent === 'Cancel'); })), ids);
        if (idle) break;
      }
      await sleep(500);
    }
    const nx = rec.filter(r=> r.what === 'next'), sm = rec.filter(r=> r.what === 'smooth');
    const lt = await longTasks(page, rec[0].t0, rec[rec.length - 1].t1);
    const out = { label: k + ' parked refining', next: stats(nx.map(r=> r.ms)), smooth: stats(sm.map(r=> r.ms)), delay: stats(rec.map(r=> r.delay)), long: lt, raw: rec, load: loadavg() };
    phases.push(out);
    console.log(tree, out.label.padEnd(22), 'next', JSON.stringify(out.next), '| smooth', JSON.stringify(out.smooth), '| delay max', out.delay.max, '| long(span, incl. restarts)', JSON.stringify(lt));
  }
}

// live: a hidden SEM tab reading 8 images while X0 is on show
if (env.live){
  for (let r = 0; r < 3; r++){
    const i = await newTab(env, 'sem');
    const f = await realm(env, i);
    const t0 = Date.now();
    await loadFiles(f, 'sem', SEM8, false);
    await clickTab(X0);
    s0 = await realm(env, X0);
    await sleep(50);
    const done = ()=> f.evaluate(()=> !document.querySelector('.dz-loading') && document.querySelectorAll('#semFileTableWrap tr.file-row').length >= 8 && document.querySelectorAll('#semThumbs .sem-thumb').length === document.querySelectorAll('#semFileTableWrap .file-incl:checked').length);
    await sample(s0, 'hidden SEM reading ' + r, async ()=> true, done);
    phases[phases.length - 1].readMs = Date.now() - t0;
    console.log('  SEM read (node clock, from setInputFiles):', Date.now() - t0, 'ms');
  }
  // the same reading with its tab on show, for its own time
  const i = await newTab(env, 'sem');
  const f = await realm(env, i);
  const t0 = Date.now();
  await loadFiles(f, 'sem', SEM8, true);
  console.log('  SEM read on show (node clock):', Date.now() - t0, 'ms');
  phases.push({ label: 'SEM read on show', readMs: Date.now() - t0 });
}
console.log('errors', env.errors);
save(`interact-${tree}.json`, { tree, phases, errors: env.errors });
await env.close();
