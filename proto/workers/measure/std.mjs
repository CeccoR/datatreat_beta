/* The instrumental standard and the samples (default settings). The standard: s11 loaded in
   the standard's window, SrTiO3 added there and chosen as its phase (as tests/rvlock does:
   a profile to time, not to read). The samples: the 12 patterns, the CIF on card 2.
   chain   Refine all with no refined standard, answered 'Refine the standard first': the
           standard's run, then the samples' (today's only way to have both). From the
           click on the answer: the standard's run's end (its card's button back to Refine),
           the samples' first status, the samples' end. HEAD (one worker) against the pool
           (k = 3). The first chain of a browser is cold (no worker made yet): COLD browsers
           of their own for it, with and without the samples' workers made as the standard
           starts (xrd-rv-pool.js warm(3), called by the script at the click: what press()
           would do); then REPS chains in one browser, warm.
   along   (measurement only: the 'noblock' tree, the pool with the guard lifted, xrd.js's
           two host.blocked returning '') The samples' Refine all started with the
           standard's profile as it is (s11 refined); meanwhile another file loaded as the
           standard (s10) and refined: both times, and the samples' results checked against
           the standard's profile at the end (xrd-rv-model.js sameIrf, as the card's note
           does): stale, refined with the profile from before.
   node std.mjs [reps, default 5] [cold, default 5] → results/std.json
   Trees: head, pool, and NOBLOCK_BASE (default http://127.0.0.1:8976: a copy of the pool tree
   with the guard lifted, README). */
import { launch, med, save, load, sleep, CIF, XRD12, BASES } from './lib.mjs';
const [REPS = '5', COLD = '5'] = process.argv.slice(2);
BASES.noblock = process.env.NOBLOCK_BASE || 'http://127.0.0.1:8976';
const STD = XRD12[11];
async function setup(mode, k, extra = {}){
  const env = await launch(mode === 'noblock' ? 'pool' : mode, { storage: mode === 'head' ? {} : { 'datatreat-rv-workers': k, ...extra } });
  if (mode === 'noblock') env.app.base = BASES.noblock;
  const { app, page } = env;
  await app.goto();
  await app.xrdTab();
  await page.click('#xrdR2Std');
  await page.waitForSelector('#xrdStdRv', { state: 'visible' });
  await page.setInputFiles('#xrdStdRvFiles', STD);
  await page.waitForFunction(()=> /s11/.test(document.querySelector('#xrdStdRv .xrd-std-file').textContent));
  await page.setInputFiles('#xrdStdRCifInput', CIF);
  await page.waitForFunction(()=> document.querySelectorAll('#xrdStdRPhaseList .rv-cif').length === 2);
  await page.click('#xrdStdRPhaseList .rv-cif:nth-child(2) [data-pick]');
  await app.settle();
  await page.keyboard.press('Escape');
  await page.waitForSelector('#xrdStdRv', { state: 'hidden' });
  await app.settle();
  return env;
}
// Every 10 ms in the page: the two cards' buttons and the samples' status, with the time of
// each change.
const watch = page => page.evaluate(()=>{ window.__w = []; let last = '';
  window.__wIv = setInterval(()=>{ const s = document.querySelector('#xrdStdRRefine').textContent + '|' + document.querySelector('#xrdR2Refine').textContent + '|' + document.querySelector('#xrdR2Status').textContent.slice(0, 40);
    if (s !== last){ last = s; window.__w.push([window.__now(), s]); } }, 10); });
const unwatch = page => page.evaluate(()=>{ clearInterval(window.__wIv); return window.__w; });
async function clearAll(env){
  const { page, app } = env;
  for (const id of ['#xrdR2ClearAll', '#xrdStdRClear']){
    if (await page.evaluate(id=> !document.querySelector(id).disabled, id)){ await page.waitForTimeout(650); await page.evaluate(id=> document.querySelector(id).click(), id); await app.settle(); }
  }
}
async function chain(env, warmAtClick = false){
  const { page, app } = env;
  await clearAll(env);
  await page.waitForTimeout(650);
  await page.evaluate(()=> document.querySelector('#xrdR2RefineAll').click());
  await page.waitForSelector('.confirm-modal');
  await watch(page);
  const t0 = await page.evaluate(async warm=>{ const t = window.__now(); document.querySelector('.confirm-modal .btn.primary').click(); if (warm) (await import('./xrd-rv-pool.js')).warm(3); return t; }, warmAtClick);
  await page.waitForFunction(()=> document.querySelector('#xrdR2Refine').textContent === 'Cancel');
  await app.runEnd();
  const w = await unwatch(page);
  const stdEnd = (w.find(([, s], i)=> i > 0 && s.startsWith('Refine|') && w.slice(0, i).some(([, x])=> x.startsWith('Cancel|'))) || [])[0];
  const samplesStart = (w.find(([, s])=> /\|Refining s\d\d/.test(s)) || [])[0];
  const end = w[w.length - 1][0];
  const n = await page.evaluate(()=> Object.keys(window.__u.getModuleState('xrd').cards.find(c=> c.id === 2).states.rietveld.results || {}).length);
  return { std: Math.round(stdEnd - t0), gap: Math.round(samplesStart - stdEnd), samples: Math.round(end - samplesStart), total: Math.round(end - t0), n };
}
const out = { chain: {}, along: [] };
for (const [mode, k] of [['head', 1], ['pool', 3]]){
  const o = out.chain[mode] = { cold: [], coldWarmed: [], warm: [] };
  for (let c = 0; c < +COLD; c++){
    for (const w of mode === 'pool' ? [false, true] : [false]){
      const env = await setup(mode, k);
      const v = await chain(env, w);
      (w ? o.coldWarmed : o.cold).push(v);
      console.log(mode, w ? 'cold+warm()' : 'cold', JSON.stringify(v));
      await env.close(); await sleep(800);
    }
  }
  const env = await setup(mode, k);
  await chain(env);   // (a first one: not kept)
  for (let r = 0; r < +REPS; r++){ await sleep(800); const v = await chain(env); o.warm.push(v); console.log(mode, 'warm', JSON.stringify(v)); }
  o.errors = env.errors;
  await env.close(); await sleep(1500);
}
// The standard and the samples at once (the guard lifted): the samples' Refine all started
// with the profile of the standard as it is (s11's), then another file loaded as the
// standard (s10, as when the standard is changed) and its Refine started; at the end, the
// samples' results against the standard's profile then. Before each round the standard
// is s11 again and the chain run (its profile the samples' start).
{
  const env = await setup('noblock', 3);
  const { page, app } = env;
  const stdFile = async f =>{ await page.setInputFiles('#xrdStdRvFiles', f); await page.waitForFunction(n=> new RegExp(n).test(document.querySelector('#xrdStdRv .xrd-std-file').textContent), f.match(/s\d\d/)[0]); await app.settle(); };
  await chain(env);   // (the standard refined, its profile the samples'; the workers warm)
  for (let r = 0; r < +REPS; r++){
    await sleep(800);
    await page.waitForTimeout(650);
    if (await page.evaluate(()=> !document.querySelector('#xrdR2ClearAll').disabled)){ await page.evaluate(()=> document.querySelector('#xrdR2ClearAll').click()); await app.settle(); await page.waitForTimeout(650); }
    const irfBefore = await page.evaluate(async ()=>{ const M = await import('./xrd-rv-model.js'), st = window.__u.getModuleState('xrd'); return JSON.stringify(M.irfOf(st.std, (st.stdRv || {}).results || {})); });
    await watch(page);
    // (Refine all asks nothing: the standard is refined)
    const t0 = await page.evaluate(()=>{ const t = window.__now(); document.querySelector('#xrdR2RefineAll').click(); return t; });
    await page.waitForFunction(()=> document.querySelector('#xrdR2Refine').textContent === 'Cancel');
    await stdFile(XRD12[10]);
    await page.waitForTimeout(650);
    const t0s = await page.evaluate(()=>{ const t = window.__now(); document.querySelector('#xrdStdRRefine').click(); return t; });
    await page.waitForFunction(()=> document.querySelector('#xrdStdRRefine').textContent === 'Refine' && document.querySelector('#xrdR2Refine').textContent === 'Refine', null, { polling: 20, timeout: 120000 });
    const w = await unwatch(page);
    const stdRan = w.some(([t, x])=> t > t0s && x.startsWith('Cancel|'));
    const stdEnd = (w.filter(([t, x])=> t > t0s && x.startsWith('Refine|')).shift() || [])[0];
    const sEnd = (w.filter(([, x])=> x.split('|')[1] === 'Refine').pop() || [])[0];
    const chk = await page.evaluate(async ()=>{ const M = await import('./xrd-rv-model.js'), st = window.__u.getModuleState('xrd'), irf = M.irfOf(st.std, (st.stdRv || {}).results || {});
      const r = st.cards.find(c=> c.id === 2).states.rietveld.results || {};
      return { irf: JSON.stringify(irf), n: Object.keys(r).length, stale: Object.values(r).filter(x=> !!x.irf && !M.sameIrf(x.irf, irf)).length,
        note: document.body.textContent.includes('The standard has been refined again since this result') }; });
    const v = { stdRan, std: Math.round(stdEnd - t0s), samples: Math.round(sEnd - t0), both: Math.round(Math.max(stdEnd, sEnd) - t0), stdStartedAfter: Math.round(t0s - t0),
      profileChanged: chk.irf !== irfBefore, n: chk.n, stale: chk.stale, note: chk.note };
    out.along.push(v);
    console.log('along', JSON.stringify(v));
    // (the next round: s11 the standard again, refined first, the samples with its profile)
    await stdFile(STD);
    await chain(env);
  }
  out.alongErrors = env.errors;
  await env.close();
}
const s = a => ({ std: med(a.map(v=> v.std)), gap: med(a.map(v=> v.gap)), samples: med(a.map(v=> v.samples)), total: med(a.map(v=> v.total)), n: a.length });
out.sum = { head: { cold: s(out.chain.head.cold), warm: s(out.chain.head.warm) }, pool: { cold: s(out.chain.pool.cold), coldWarmed: s(out.chain.pool.coldWarmed), warm: s(out.chain.pool.warm) },
  along: { std: med(out.along.map(v=> v.std)), samples: med(out.along.map(v=> v.samples)), both: med(out.along.map(v=> v.both)), stale: out.along.map(v=> v.stale + '/' + v.n), profileChanged: out.along.map(v=> v.profileChanged) } };
console.log(JSON.stringify(out.sum, null, 1));
out.load = load();
save('std.json', out);
