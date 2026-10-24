/* Cancel, the history and the workers with the pool, at the workers' real speed (pool.patch,
   k workers, default 3): the XRPD tab (12 patterns, the CIF on card 2) refined once to its
   end (the reference, every pattern's result), then ROUNDS rounds of:
   - Clear all; Refine all; once 4 results are written, card 1 folded or unfolded (a step
     taken during the run); once 7 are, Cancel (clicked, timed to the button back to Refine);
   - at once: the results written (in the patterns' order, each identical to the
     reference's), the patterns that were under way not written, nothing written 1.5 s
     after; the pool's workers (xrd-rv-pool.js poolNow: those under way terminated, the
     others idle);
   - the history: the run's step right after the state it started from, the fold's step
     after it with the results in it (v509's hold and release, as a run of one lane);
     undo: the fold, then the results; redo both back;
   - Refine all to its end: the 12 identical to the reference (new workers made for those
     terminated).
   node safety.mjs [rounds, default 5] [k, default 3] → results/safety.json */
import { launch, save, load, sleep, med } from './lib.mjs';
const [ROUNDS = '5', K = '3'] = process.argv.slice(2);
const env = await launch('pool', { storage: { 'datatreat-rv-workers': K } });
const { app, page } = env;
await app.goto();
await app.xrdTab();
await app.clearAndRefine(); await app.runEnd(); await app.settle();
const strip = `(r => JSON.stringify(r, (k, v)=> k === 'at' || k === 'ms' ? undefined : v))`;
// Each pattern's result (its JSON, the times left out), card 1 folded, the history.
const look = ()=> page.evaluate(strip=>{
  const s = eval(strip), u = window.__u, st = u.getModuleState('xrd'), r = st.cards.find(c=> c.id === 2).states.rietveld.results || {};
  const h = u.getModuleHistory('xrd');
  const of = x =>{ const c2 = x.cards.find(c=> c.id === 2), rr = (c2 && c2.states.rietveld && c2.states.rietveld.results) || {}; return { n: Object.keys(rr).length, fold: !!x.cards.find(c=> c.id === 1).collapsed }; };
  return { keys: Object.keys(r), res: Object.fromEntries(Object.entries(r).map(([k, v])=> [k, s(v)])), fold: !!st.cards.find(c=> c.id === 1).collapsed,
    hist: { index: h.index, n: h.states.length, tail: h.states.slice(-4).map(of) } };
}, strip);
const written = ()=> page.evaluate(()=> Object.keys(window.__u.getModuleState('xrd').cards.find(c=> c.id === 2).states.rietveld.results || {}).length);
const poolNow = ()=> page.evaluate(async ()=> (await import('./xrd-rv-pool.js')).poolNow());
const status = ()=> page.textContent('#xrdR2Status');
const ref = (await look()).res;
const NAMES = Object.keys(ref);
const out = { k: +K, rounds: [] };
for (let r = 0; r < +ROUNDS; r++){
  const v = {};
  await app.clearAndRefine();
  await page.waitForFunction(()=> Object.keys(window.__u.getModuleState('xrd').cards.find(c=> c.id === 2).states.rietveld.results || {}).length >= 4, null, { polling: 20, timeout: 60000 });
  const fold0 = (await look()).fold;
  await page.evaluate(()=> document.querySelector('#xrdAnalyses .an-card[data-an="1"] .an-fold').click());
  await page.waitForFunction(()=> Object.keys(window.__u.getModuleState('xrd').cards.find(c=> c.id === 2).states.rietveld.results || {}).length >= 7, null, { polling: 20, timeout: 60000 });
  const under = await page.evaluate(()=> document.querySelector('#xrdR2Status').textContent);
  const pool0 = await poolNow();
  const tc = await page.evaluate(()=>{ const t = window.__now(); document.querySelector('#xrdR2Refine').click(); return t; });
  const te = await app.runEnd();
  v.cancelMs = Math.round(te - tc);
  v.statusBefore = under; v.statusAfter = await status();
  v.poolBefore = pool0;
  const a = await look();
  v.written = a.keys;
  v.inOrder = a.keys.every((k, i)=> i === 0 || NAMES.indexOf(k) > NAMES.indexOf(a.keys[i - 1]));
  v.identical = a.keys.every(k=> a.res[k] === ref[k]);
  v.gaps = NAMES.slice(0, NAMES.indexOf(a.keys[a.keys.length - 1]) + 1).filter(k=> !a.keys.includes(k));
  await sleep(1500);
  v.after = (await look()).keys.length;
  v.poolAfter = await poolNow();
  v.hist = a.hist;
  // (the tail: start (none), the run (its results, fold as before), the fold (its results, folded the other way))
  const t = a.hist.tail.slice(-3);
  v.histRight = a.hist.index === a.hist.n - 1 && t[0].n === 0 && t[0].fold === fold0 && t[1].n === a.keys.length && t[1].fold === fold0 && t[2].n === a.keys.length && t[2].fold !== fold0;
  await page.evaluate(()=> document.activeElement && document.activeElement.blur && document.activeElement.blur()); await page.keyboard.press('Control+z'); await app.settle();
  const u1 = await look();
  await page.evaluate(()=> document.activeElement && document.activeElement.blur && document.activeElement.blur()); await page.keyboard.press('Control+z'); await app.settle();
  const u2 = await look();
  await page.keyboard.press('Control+y'); await app.settle();
  await page.keyboard.press('Control+y'); await app.settle();
  const r2 = await look();
  v.undo = { foldUndone: u1.fold === fold0 && u1.keys.length === a.keys.length, resultsUndone: u2.keys.length === 0, redone: r2.keys.join() === a.keys.join() && r2.fold !== fold0 };
  // Refine all to its end: the 12 again, identical.
  await app.clearAndRefine();
  await app.runEnd(); await app.settle();
  const f = await look();
  v.full = { n: f.keys.length, identical: f.keys.length === 12 && f.keys.every(k=> f.res[k] === ref[k]), inOrder: f.keys.join() === NAMES.join() };
  v.poolEnd = await poolNow();
  out.rounds.push(v);
  console.log('round', r, JSON.stringify({ ...v, hist: undefined }));
  await sleep(800);
}
out.sum = { rounds: out.rounds.length, cancelMsMed: med(out.rounds.map(v=> v.cancelMs)), writtenAtCancel: out.rounds.map(v=> v.written.length), gaps: out.rounds.map(v=> v.gaps.length),
  allInOrder: out.rounds.every(v=> v.inOrder), allIdentical: out.rounds.every(v=> v.identical), nothingAfter: out.rounds.every(v=> v.after === v.written.length),
  histRight: out.rounds.every(v=> v.histRight), undoRight: out.rounds.every(v=> v.undo.foldUndone && v.undo.resultsUndone && v.undo.redone),
  fullAfter: out.rounds.every(v=> v.full.identical && v.full.inOrder), poolAfterCancel: out.rounds.map(v=> v.poolAfter), errors: env.errors };
console.log(JSON.stringify(out.sum, null, 1));
out.load = load();
save('safety.json', out);
await env.close();
