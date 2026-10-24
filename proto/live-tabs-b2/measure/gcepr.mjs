/* GC and EPR made per tab (gc-epr.patch) against v517. The tabs measured: GC, 10 exports of
   72 injections (18 h, one every 15 min) with H2 and O2 (tests/fixtures.mjs gcCsv), one
   card; EPR, 10 BES3T pairs of 1024 points (fixtures.mjs eprPair), one card; each beside a
   blank tab of its module on show. Memory after a forced GC (lib.mjs mem: JS heap, Blink's
   DOM nodes, renderer RSS); times from the click to two frames after the loader is gone
   (lib.mjs timedShow), medians.
   - tiers: the tab hidden and awake; its plots let go (plot.js releasePlot on each: what a
     trim would give); asleep. v517: the tab parked.
   - times: a switch between the two tabs awake; the loaded tab shown again after the window
     was resized while it was hidden (its whole redraw); woken; v517's switch.
   - withState: a state read out for its CSVs (a saved project's, from Projects), the loaded
     tab on show: b2 utils.withState, v517 runWithModuleState.
   - record: a state's JSON without the files' bytes.
   - perTab: what a tab awake and hidden holds beyond its sleeping form, for bytes(): 5 such
     tabs and a blank one on show, kept awake (6 allowed) or each put to sleep as it is left
     (0 allowed), the difference over 5.
   - keep: EPR, the heap of the page after the loaded tab was put to sleep and woken, with
     its spectra kept by their bytes (keepSpectrum) and without (NOKEEP_BASE: the same tree,
     keepSpectrum returning its file as it is); and whether the woken tab's arrays are its
     history's.
   B2_BASE (HEAD + core.patch + gc-epr.patch), HEAD_BASE (HEAD), NOKEEP_BASE.
   node gcepr.mjs → results/gcepr.json */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { launch, timedShow, med, r1, save } from './lib.mjs';
import { gcCsv, eprPair } from '../../../tests/fixtures.mjs';
const B2 = process.env.B2_BASE || 'http://127.0.0.1:8966', HEAD = process.env.HEAD_BASE || 'http://127.0.0.1:8967', NOKEEP = process.env.NOKEEP_BASE || 'http://127.0.0.1:8968';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gcepr-m-'));
const put = (name, buf)=>{ const p = path.join(dir, name); fs.writeFileSync(p, buf); return p; };
const FX = {
  gc: Array.from({ length: 10 }, (_, i)=> put(`g${i}.csv`, gcCsv({ n: 72, h2: [0.04 + 0.01*i, 0.1 + 0.01*i], o2: [0.02, 0.04 + 0.005*i], seed: 40 + i }))),
  epr: Array.from({ length: 10 }, (_, i)=>{ const e = eprPair({ title: 'E' + i, B0: 3380 + 4*i, w: 3 + 0.3*i, amp: 400 + 30*i, seed: 60 + i }); return [put(`e${i}.DSC`, e.dsc), put(`e${i}.DTA`, e.dta)]; }),
};
const PER = { gc: 1, epr: 2 };   // files dropped per row of the list
const N = 7, out = { fixture: { gc: '10 GC exports of 72 injections (H2 and O2), one card', epr: '10 EPR pairs of 1024 points, one card' } };
async function files(app, page, mod, list){
  const sel = `#${mod}FileTableWrap tr.file-row`, n0 = await page.locator(sel).count();
  await app.drop(`#${mod}Dropzone`, list);
  await page.waitForFunction(([sel, n])=> document.querySelectorAll(sel).length >= n && !document.querySelector('.dz-loading'), [sel, n0 + list.length/PER[mod]], { timeout: 60000 });
  await app.settle();
}
const fixture = (mod, n)=> mod === 'epr' ? FX.epr.slice(0, n).flat() : FX.gc.slice(0, n);
async function tab(app, page, mod, n = 10, cards = 1){
  await app.newTab(mod);
  if (n) await files(app, page, mod, fixture(mod, n));
  for (let k = 1; k < cards; k++){ await page.click(`#${mod}AddAn`); await app.settle(); }
}
const recordKB = (page, mod)=> page.evaluate(async mod=>{ const u = await import('./utils.js'); return Math.round(JSON.stringify(u.getModuleState(mod), (k, v)=> k === 'rawBytes' || k === 'rawFiles' ? undefined : v).length/1024); }, mod);
const timeIt = (page, mod, how)=> page.evaluate(async ([mod, how])=>{
  const u = await import('./utils.js'), s = u.getModuleState(mod), t = [];
  for (let k = 0; k < 5; k++){ const t0 = performance.now(); if (how === 'b2') u.withState(mod, s, ()=> 0); else u.runWithModuleState(mod, s, ()=> 0); t.push(performance.now() - t0); }
  return t.sort((a, b)=> a - b)[2];
}, [mod, how]);

for (const mod of ['gc', 'epr']){
  out[mod] = {};
  { // b2: tiers and times
    const { app, page, mem, errors, close } = await launch(B2);
    await tab(app, page, mod); await app.newTab(mod);
    const awake = await mem(), estimate = (await app.tabs())[0].bytes;
    const sw = []; for (let k = 0; k < N; k++){ sw.push((await timedShow(page, 0)).ms); sw.push((await timedShow(page, 1)).ms); }
    const rd = []; for (let k = 0; k < N; k++){ await page.setViewportSize({ width: k % 2 ? 1400 : 1300, height: 900 }); rd.push((await timedShow(page, 0)).ms); await timedShow(page, 1); }
    await page.setViewportSize({ width: 1400, height: 900 }); await timedShow(page, 0); await timedShow(page, 1);
    await page.evaluate(async ()=>{ const T = await import('./tabs.js'), P = await import('./plot.js'); T.TABS[0].inst.root.querySelectorAll('svg.plot').forEach(P.releasePlot); });
    const released = await mem();
    await timedShow(page, 0); await timedShow(page, 1);
    await app.tick(11*60e3);
    const asleep = await mem();
    const wk = []; for (let k = 0; k < 5; k++){ wk.push((await timedShow(page, 0)).ms); await timedShow(page, 1); await app.tick(11*60e3); }
    await timedShow(page, 0);
    out[mod].b2 = { awake, released, asleep, estimateMB: r1(estimate/1048576), switchAwake: med(sw), showAfterResize: med(rd), wake: med(wk), record: await recordKB(page, mod),
      withState: r1(await timeIt(page, mod, 'b2')), samples: { sw, rd, wk }, errors };
    await close();
  }
  { // v517
    const { app, page, mem, errors, close } = await launch(HEAD);
    await tab(app, page, mod); await app.newTab(mod);
    const parked = await mem();
    const sw = []; for (let k = 0; k < N; k++){ sw.push((await timedShow(page, 0)).ms); sw.push((await timedShow(page, 1)).ms); }
    await timedShow(page, 0);
    out[mod].v517 = { parked, switchToLoaded: med(sw.filter((_, i)=> i % 2 === 0)), switchToBlank: med(sw.filter((_, i)=> i % 2)), record: await recordKB(page, mod),
      withState: r1(await timeIt(page, mod, 'v517')), samples: { sw }, errors };
    await close();
  }
  console.log(mod, JSON.stringify({ b2: { ...out[mod].b2, samples: undefined }, v517: { ...out[mod].v517, samples: undefined } }));
  // b2: what a tab awake and hidden holds beyond asleep, by config
  out[mod].perTab = {};
  for (const [name, [n, cards]] of Object.entries({ blank: [0, 1], '3 files': [3, 1], '10 files': [10, 1], '10 files, 2 cards': [10, 2] })){
    const run = async liveMax =>{
      const { app, page, mem, errors, close } = await launch(B2);
      await page.evaluate(async m=>{ const u = await import('./utils.js'); Object.assign(u.settings, { livePolicy: 'count', liveMax: m }); }, liveMax);
      for (let k = 0; k < 5; k++) await tab(app, page, mod, n, cards);
      await app.newTab(mod);
      const m = await mem(), t = await app.tabs();
      await close();
      return { ...m, awake: t.filter(x=> x.awake).length, estimate: t[0].bytes, errors };
    };
    const a = await run(6), s = await run(0);
    out[mod].perTab[name] = { heapMB: r1((a.heap - s.heap)/5*100)/100, nodes: Math.round((a.nodes - s.nodes)/5), rssMB: r1((a.rss - s.rss)/5), estimateMB: r1(a.estimate/1048576*100)/100, awake: [a.awake, s.awake], errors: a.errors.concat(s.errors) };
    console.log(mod, name, JSON.stringify(out[mod].perTab[name]));
  }
}
// EPR: a woken tab's spectra, kept by their bytes or not
out.keep = {};
for (const [name, base] of Object.entries({ kept: B2, notKept: NOKEEP })){
  const runs = [];
  for (let r = 0; r < 3; r++){
    const { app, page, mem, errors, close } = await launch(base);
    await tab(app, page, 'epr'); await app.newTab('epr');
    await app.tick(11*60e3); await timedShow(page, 0);
    const m = await mem();
    const same = await page.evaluate(async ()=>{ const u = await import('./utils.js'), h = u.getModuleHistory('epr'), s = u.getModuleState('epr'), st = h.states[h.index];
      return s.files.every((f, i)=> f.b === st.files[i].b && f.a === st.files[i].a); });
    runs.push({ heap: m.heap, rss: m.rss, sameArrays: same, errors });
    await close();
  }
  out.keep[name] = { heapMB: med(runs.map(x=> x.heap)), rssMB: med(runs.map(x=> x.rss)), runs };
}
out.keep.computedMB = r1(10*2*1024*8/1048576*100)/100;
console.log('keep', JSON.stringify(out.keep));
fs.rmSync(dir, { recursive: true, force: true });
console.log(save('gcepr.json', out));
