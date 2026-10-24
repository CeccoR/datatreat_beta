/* Data safety of a refinement that goes on in the tab left (bg, pool), with the workers' real
   timing (nothing held, unlike tests/bgruns.test.mjs). Tabs: R, A, B, C (XRPD: 12 patterns,
   the CIF on card 2), D (DRS).
   1. Reference: Refine all in R, on show to its end.
   2. Left: Refine all in A, B shown after its first result, its end waited for parked. At
      once (the end seen, polled every 20 ms): A's parked state, its parked history (the
      run's step after the state it started from, no hold left), its record in IndexedDB
      (polled until it holds the 12: how long after the end), its "*". Then A shown: the
      results on show, one undo (the state before the run), one redo.
   3. Back and forth: Refine all in A; B shown after 1 result, A after 4, B after 6, A after
      9; its end on show; one step.
   4. Reloaded: Refine all in C; D shown after its first result; the page reloaded once 3
      results are in its parked state (no wait for the database): what comes back.
   Results compared pattern by pattern with R's (everything the worker gave, its times left
   out), and as a whole (lib.mjs resHash).
   node safety.mjs [bg|pool] [reps, default 5]  → results/safety-<mode>.json */
import { launch, save, load, sleep, now, App, DRS } from './lib.mjs';
const [mode = 'bg', reps = '5'] = process.argv.slice(2);
const env = await launch(mode);
const { app, page } = env;
await app.goto();
const R = await app.xrdTab(), A = await app.xrdTab(), B = await app.xrdTab(), C = await app.xrdTab();
const D = await app.newTab('tauc'); await app.files('tauc', DRS);
const strip = r => JSON.stringify(r, (k, v)=> k === 'at' || k === 'ms' ? undefined : v);
const resOf = st => App.res(st);
const perPattern = (a, b)=> Object.keys(b).every(k=> k in a ? strip(a[k]) === strip(b[k]) : true) && Object.keys(a).every(k=> k in b);
const recOf = id => page.evaluate(id=> new Promise(res=>{ const r = indexedDB.open('datatreat'); r.onsuccess = ()=>{ const q = r.result.transaction('tabs').objectStore('tabs').get(id);
  q.onsuccess = ()=>{ const x = q.result; r.result.close(); if (!x) return res(null); const c = (x.state.cards || []).find(c=> c.id === 2);
    res({ dirty: x.dirty, res: (c && c.states.rietveld && c.states.rietveld.results) || {} }); }; }; }), id);
const histOf = i => page.evaluate(i=>{ const T = window.__T, t = T.TABS[i], h = T.isLive(t) ? window.__u.getModuleHistory(t.module) : t.hist;
  const n = s => Object.keys(((s.cards.find(c=> c.id === 2) || {}).states || {}).rietveld?.results || {}).length;
  return { index: h.index, of: h.states.map(n), marks: (h.marks || []).length }; }, i);

await app.show(R); await app.clearAndRefine(); await app.runEnd(); await app.settle();
const ref = resOf((await app.tab(R)).state), refHash = await app.resHash(R);
const out = { left: [], pingpong: [], reload: [] };
for (let r = 0; r < +reps; r++){
  // 2. left
  await app.show(A);
  const h0 = await histOf(A);
  await app.clearAndRefine();
  await app.liveResults(1);
  await app.show(B);
  const tEnd = await app.parkedEnd(A);
  const a = await app.tab(A), hp = await histOf(A), hashP = await app.resHash(A);
  const tAsk = await now(page);
  let rec = await recOf(a.id), tRec = await now(page);
  const firstN = Object.keys(rec.res).length, readMs = Math.round(tRec - tAsk);
  while (Object.keys(rec.res).length < 12){ await sleep(10); rec = await recOf(a.id); tRec = await now(page); }
  const label = await page.locator('#tabBar .ptab').nth(A).textContent();
  await app.show(A);
  const shown = await app.resHash(A);
  await page.evaluate(()=> document.activeElement && document.activeElement.blur && document.activeElement.blur());
  await page.keyboard.press('Control+z'); await app.settle();
  const undone = Object.keys(resOf((await app.tab(A)).state)).length;
  await page.keyboard.press('Control+y'); await app.settle();
  const redone = await app.resHash(A);
  const v = { parked: { n: Object.keys(resOf(a.state)).length, identical: hashP.hash === refHash.hash && perPattern(resOf(a.state), ref), dirty: a.dirty, star: /\*$/.test(label.trim()) },
    // (one step on top, 12 results, after the state it started from, none, Clear all's; no hold left)
    hist: { before: h0.of.length, after: hp.of.length, oneStep: hp.index === hp.of.length - 1 && hp.of[hp.index] === 12 && hp.of[hp.index - 1] === 0 && hp.marks === 0 && hp.of.length - h0.of.length <= 2 },
    // (firstN: what the first read after the end found; readMs: that read's own time, the
    // database opened for it; msAfterEnd: from the end seen to the read that found the 12)
    record: { n: Object.keys(rec.res).length, firstN, readMs, identical: perPattern(rec.res, ref), dirty: rec.dirty, msAfterEnd: Math.round(tRec - tEnd) },
    shown: shown.hash === refHash.hash, undo: undone, redo: redone.hash === refHash.hash };
  out.left.push(v); console.log('left', JSON.stringify(v));
  // 3. back and forth
  const g0 = await histOf(A);
  await app.clearAndRefine();
  await app.liveResults(1); await app.show(B);
  await app.parkedResults(A, 4); await app.show(A);
  await app.liveResults(6); await app.show(B);
  await app.parkedResults(A, 9); await app.show(A);
  await app.runEnd(); await app.settle();
  const g1 = await histOf(A), hb = await app.resHash(A);
  const w = { identical: hb.hash === refHash.hash, n: hb.n, steps: g1.of.length - g0.of.length, top: g1.of[g1.index] };
  out.pingpong.push(w); console.log('pingpong', JSON.stringify(w));
  // 4. reloaded mid-run
  await app.show(C);
  await app.clearAndRefine();
  await app.liveResults(1); await app.show(D);
  await app.parkedResults(C, 3);
  const before = await app.tab(C), nBefore = Object.keys(resOf(before.state)).length, recBefore = Object.keys((await recOf(before.id)).res).length;
  await page.reload();
  await page.waitForFunction(()=> !document.documentElement.classList.contains('app-booting') && document.querySelector('#tabBar .ptab'), null, { timeout: 60000 });
  await app.mods(); await app.settle();
  const after = await app.tab(C), resAfter = resOf(after.state);
  const x = { parkedAtReload: nBefore, recordAtReload: recBefore, back: Object.keys(resAfter).length, identical: perPattern(resAfter, ref), running: after.running, dirty: after.dirty };
  out.reload.push(x); console.log('reload', JSON.stringify(x));
  await sleep(1000);
}
console.log('errors', env.errors);
save(`safety-${mode}.json`, { mode, out, refHash, load: load(), errors: env.errors });
await env.close();
