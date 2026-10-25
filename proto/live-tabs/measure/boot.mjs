/* Starting the app with N tabs stored (a reload): today's (HEAD: every tab's record read with
   its bytes, the one on show restored) against live tabs, lazy (the default: the frame of the
   tab on show alone) and eager (every tab's frame at once). The tabs: XRPD (12 patterns,
   refined, on show), SEM (8 images), DRS, GC; for N = 8 also EPR, XRPD, SEM, DRS.
   Times from the navigation's start (the new document's timeOrigin) to two frames in the
   realm that shows the tab on show once its loader is gone; eager also to every frame's
   restore done; the long tasks meanwhile; memory 3 s after (lib.mjs mem). REPS reloads.
   node boot.mjs <head|live> <4|8> [reps, default 5] → results/boot-<mode>-<N>.json */
import { launch, addTab, med, r1, save, load, sleep, longTasks } from './lib.mjs';
const [mode = 'live', N = '4', reps = '5'] = process.argv.slice(2);
const KINDS = ['xrd', 'sem', 'drs', 'gc', 'epr', 'xrd', 'sem', 'drs'].slice(0, +N);
const env = await launch(mode);
const { app, page, mem } = env;
await app.goto();
for (const k of KINDS) await addTab(app, k);
await app.show(0);
await sleep(6000);   // (the autosaves written)
const variants = app.live ? ['lazy', 'eager'] : ['parked'];
const out = { mode, N: +N, kinds: KINDS, variants: {} };
for (const v of variants){
  await page.evaluate(v=>{ if (v === 'eager') localStorage.setItem('datatreat-live-eager', '1'); else localStorage.removeItem('datatreat-live-eager'); }, v);
  const shown = [], all = [], lt = [], mems = [];
  for (let r = 0; r < +reps; r++){
    await page.reload();
    await page.waitForFunction(()=> !document.documentElement.classList.contains('app-booting') && document.querySelector('#tabBar .ptab'), null, { timeout: 120000 });
    const origin = await page.evaluate(()=> performance.timeOrigin);
    let t1, tAll = null;
    if (!app.live){
      t1 = await page.evaluate(()=> new Promise(res=>{ const loop = ()=>{ if (document.querySelector('.module-loader.show') || !document.querySelector('#tab-xrd.active')) return requestAnimationFrame(loop); requestAnimationFrame(()=> requestAnimationFrame(()=> res(window.__now()))); }; requestAnimationFrame(loop); }));
    } else {
      const f = await app.frame(0);
      t1 = await f.evaluate(()=> new Promise(res=>{ const loop = ()=>{ if (document.querySelector('.module-loader.show')) return requestAnimationFrame(loop); requestAnimationFrame(()=> requestAnimationFrame(()=> res(window.__now()))); }; requestAnimationFrame(loop); }));
      if (v === 'eager'){
        const ends = [];
        for (let i = 0; i < KINDS.length; i++){ const g = await app.frame(i); ends.push(await g.evaluate(()=> window.__now())); }
        tAll = Math.max(...ends) - origin;
      }
    }
    shown.push(t1 - origin); if (tAll != null) all.push(tAll);
    lt.push(await longTasks(page, origin, t1));
    await sleep(3000);
    if (r === 0 || r === +reps - 1) mems.push(await mem());
    console.log(mode, N, v, 'rep', r, 'tab on show', Math.round(t1 - origin), 'ms', tAll != null ? 'all frames ' + Math.round(tAll) : '', 'long tasks', JSON.stringify(lt[lt.length - 1]));
  }
  const m = mems[mems.length - 1];
  out.variants[v] = { shownMed: r1(med(shown)), shown: shown.map(r1), allMed: all.length ? r1(med(all)) : null, longMsMed: med(lt.map(x=> x.ms)), longMaxMed: med(lt.map(x=> x.max)),
    mem: { heap: r1(m.heap), rss: r1(m.renderer.rss), pss: r1(m.renderer.pss), workers: m.workers, frames: await page.locator('.live-frames iframe').count() } };
  console.log(mode, N, v, JSON.stringify(out.variants[v]));
}
out.errors = env.errors; out.load = load();
console.log('errors', env.errors);
save(`boot-${mode}-${N}.json`, out);
await env.close();
