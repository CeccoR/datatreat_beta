/* UV-Vis DRS made per tab (drs.patch) against v517. The tab measured: 10 Cary 5000 exports
   (tests/fixtures.mjs caryCsv: %R, 800–200 nm by 0.5 nm, 1201 points), a Tauc card and an
   Urbach card, beside a blank DRS tab on show. Memory after a forced GC (lib.mjs mem: JS
   heap, Blink's DOM nodes, renderer RSS); times from the click to two frames after the
   loader is gone (lib.mjs timedShow), medians.
   - tiers: the tab hidden and awake; its plots let go (plot.js releasePlot on each: what a
     trim would give); asleep. v517: the tab parked.
   - times: a switch between the two tabs awake; the loaded tab shown again after the window
     was resized while it was hidden (its whole redraw); woken; v517's switch.
   - perTab: what a tab awake and hidden holds beyond its sleeping form, for bytes(): 5 such
     tabs and a blank one on show, kept awake (6 allowed) or each put to sleep as it is left
     (0 allowed), the difference over 5; blank, 3 spectra and both cards, 10 and a Tauc
     card, 10 and both.
   - record: a state's JSON without the files' bytes (what a saved project and a tab's
     record hold beside them).
   - history: the heap the tab on show takes for 20 steps of the file list (a file left out
     and taken in again, 10 times).
   - withState: a state read out for its CSVs (a saved project's, from Projects), the loaded
     tab on show: b2 utils.withState, v517 runWithModuleState.
   - frozen: the heap an array of doubles takes per element, plain and frozen (Object.freeze,
     as XRPD's patterns and db.js frozenOwn: park shares those), 400 arrays of 5000.
   B2_BASE (HEAD + core.patch + drs.patch), HEAD_BASE (HEAD). node drs.mjs → results/drs.json */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { launch, timedShow, med, r1, save } from './lib.mjs';
import { caryCsv } from '../../../tests/fixtures.mjs';
const B2 = process.env.B2_BASE || 'http://127.0.0.1:8960', HEAD = process.env.HEAD_BASE || 'http://127.0.0.1:8961';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'drs-m-'));
const FX = Array.from({ length: 10 }, (_, i)=>{ const p = path.join(dir, `c${i}.csv`); fs.writeFileSync(p, caryCsv({ name: 'C' + i, Eg: 2.9 + 0.05*i, A: 40 + 3*i, seed: 30 + i }).buffer); return p; });
const N = 7, out = { fixture: '10 Cary 5000 exports (1201 points each), a Tauc card and an Urbach card' };
async function tab(app, page, files = 10, urbach = true){
  await app.newTab('tauc');
  if (files) await app.files('tauc', FX.slice(0, files));
  if (urbach){ await page.click('#taucAddAn'); await page.click('.an-menu button[data-kind="urbach"]'); await app.settle(); }
}
const recordKB = page => page.evaluate(async ()=>{ const u = await import('./utils.js'); return Math.round(JSON.stringify(u.getModuleState('tauc'), (k, v)=> k === 'rawBytes' ? undefined : v).length/1024); });
async function history(app, page, mem){
  const m0 = await mem();
  for (let k = 0; k < 20; k++){ await page.locator('#taucFileTableWrap .file-incl').nth(9).click(); await app.settle(); }
  const m1 = await mem();
  return { heapMB: r1(m1.heap - m0.heap) };
}
const timeIt = (page, how)=> page.evaluate(async how=>{
  const u = await import('./utils.js'), s = u.getModuleState('tauc'), t = [];
  for (let k = 0; k < 5; k++){ const t0 = performance.now(); if (how === 'b2') u.withState('tauc', s, ()=> 0); else u.runWithModuleState('tauc', s, ()=> 0); t.push(performance.now() - t0); }
  return t.sort((a, b)=> a - b)[2];
}, how);

{ // b2: tiers and times
  const { app, page, mem, errors, close } = await launch(B2);
  await tab(app, page); await app.newTab('tauc');
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
  out.b2 = { awake, released, asleep, estimateMB: r1(estimate/1048576), switchAwake: med(sw), showAfterResize: med(rd), wake: med(wk), record: await recordKB(page),
    withState: r1(await timeIt(page, 'b2')), history: await history(app, page, mem), samples: { sw, rd, wk }, errors };
  await close();
}
{ // v517
  const { app, page, mem, errors, close } = await launch(HEAD);
  await tab(app, page); await app.newTab('tauc');
  const parked = await mem();
  const sw = []; for (let k = 0; k < N; k++){ sw.push((await timedShow(page, 0)).ms); sw.push((await timedShow(page, 1)).ms); }
  await timedShow(page, 0);
  out.v517 = { parked, switchToLoaded: med(sw.filter((_, i)=> i % 2 === 0)), switchToBlank: med(sw.filter((_, i)=> i % 2)), record: await recordKB(page),
    withState: r1(await timeIt(page, 'v517')), history: await history(app, page, mem), samples: { sw }, errors };
  await close();
}
{ // the bytes of an array of doubles, plain and frozen
  const { page, cdp, close } = await launch(B2);
  const used = async ()=>{ await cdp.send('HeapProfiler.collectGarbage'); await cdp.send('HeapProfiler.collectGarbage'); return (await cdp.send('Runtime.getHeapUsage')).usedSize; };
  out.frozen = {};
  for (const kind of ['plain', 'frozen']){
    await page.evaluate(()=>{ window.__a = null; });
    const h0 = await used();
    await page.evaluate(kind=>{ const a = []; for (let i = 0; i < 400; i++){ const x = Array.from({ length: 5000 }, (_, j)=> Math.random()*j + 0.5); a.push(kind === 'frozen' ? Object.freeze(x) : x); } window.__a = a; }, kind);
    out.frozen[kind] = r1((await used() - h0)/2e6);
  }
  await close();
}
// b2: what a tab awake and hidden holds beyond asleep, by config
out.perTab = {};
for (const [name, [files, urbach]] of Object.entries({ blank: [0, false], '3 spectra, both cards': [3, true], '10 spectra, Tauc card': [10, false], '10 spectra, both cards': [10, true] })){
  const run = async liveMax =>{
    const { app, page, mem, errors, close } = await launch(B2);
    await page.evaluate(async m=>{ const u = await import('./utils.js'); Object.assign(u.settings, { livePolicy: 'count', liveMax: m }); }, liveMax);
    for (let k = 0; k < 5; k++) await tab(app, page, files, urbach);
    await app.newTab('tauc');
    const m = await mem(), t = await app.tabs();
    await close();
    return { ...m, awake: t.filter(x=> x.awake).length, estimate: t[0].bytes, errors };
  };
  const a = await run(6), s = await run(0);
  out.perTab[name] = { heapMB: r1((a.heap - s.heap)/5*100)/100, nodes: Math.round((a.nodes - s.nodes)/5), rssMB: r1((a.rss - s.rss)/5), estimateMB: r1(a.estimate/1048576), awake: [a.awake, s.awake], errors: a.errors.concat(s.errors) };
  console.log(name, JSON.stringify(out.perTab[name]));
}
fs.rmSync(dir, { recursive: true, force: true });
console.log(JSON.stringify({ b2: { ...out.b2, samples: undefined }, v517: { ...out.v517, samples: undefined } }, null, 1));
console.log(save('drs.json', out));
