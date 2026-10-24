/* The heavy modules together, the whole b2 against v517: one session of ten tabs, two of each
   module, the SEM and XRPD ones at full size. Each tree on its own port (B2_BASE, HEAD_BASE).
   Tabs, in this order: DRS ×2, GC ×2, EPR ×2 (proto/live-tabs/fixtures), XRPD X1 (the 12
   patterns, the CIF, refined on show), SEM A and B (8 images each of 2048 × 2176, 16 bits,
   as the assessment's, 16 files in all), XRPD X2 (the same 12 and the CIF).
   - run: b2: X2's Refine all on the pool, X2 left at once for SEM A; while it runs, SEM B
     and A shown and A's next image (#semNext) pressed in turn, each timed in the page (a
     click to two frames after the loader is gone, lib.mjs timedShow; the same for the
     button); then 15 of the same with nothing running. The run's time from Cancel shown to
     its end (b2 hidden: seen in the page every 20 ms; on show: lib.mjs refineDone). X2's
     results against X1's (refined on show), times left out. v517 asks to stop a run before
     its tab is left: there X2 is refined on show, and the SEM times are taken idle only.
   - memory, after forced GCs, SEM A on show: b2 with every tab awake (Settings' limit 19),
     at the default limit (6 awake hidden), trimmed (tabs.js sleepTick past 60 s), asleep
     (past 10 min); v517 with every other tab parked. The page's JS heap, its ArrayBuffers
     (Runtime.getHeapUsage backingStorageSize), Blink's DOM nodes, the renderer's and the
     GPU process's RSS (/proc VmRSS), the workers alive (b2's pool workers kept 1 s idle,
     localStorage datatreat-rv-idle, so that none is left in the numbers).
   - shows: X1, SEM B and DRS 1 shown from SEM A, 3 times each (b2: each asleep, woken).
   node session.mjs [b2|head …] → results/session.json */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, timedShow, med, r1, save, sleep, FX, XRD12, BASES } from './lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const { makeTiff } = await import(path.resolve(HERE, '../../../tests/fixtures.mjs'));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-session-'));
const tifs = (s, k0)=> Array.from({ length: 8 }, (_, i)=>{
  const p = path.join(dir, `${s}${i + 1}.tif`);
  fs.writeFileSync(p, makeTiff({ W: 2048, H: 2176, bits: 16, strip: 128, sign: s + (i + 1), pixelNm: 25, mag: 5000, seed: k0 + i }));
  return p;
});
const SA = tifs('A', 1), SB = tifs('B', 9);
const SMALL = { tauc: [['drs1.csv'], ['drs2.csv']], gc: [['alpha.csv'], ['beta.csv']], epr: [['e1.DSC', 'e1.DTA'], ['e1.DSC', 'e1.DTA']] };
const MIN = 60000, ONLY = process.argv.slice(2);
const kb = (txt, k)=> +((txt.match(new RegExp('^' + k + ':\\s+(\\d+)', 'm')) || [])[1] || 0)/1024;

async function run(tree){
  const L = await launch(BASES[tree], { knobs: { 'datatreat-rv-idle': '1' } });
  const { page, app } = L, b2 = tree === 'b2', out = { tree };
  const bcdp = await L.browser.newBrowserCDPSession();
  const memAll = async ()=>{
    const m = await L.mem(), u = await L.cdp.send('Runtime.getHeapUsage');
    const g = (await bcdp.send('SystemInfo.getProcessInfo')).processInfo.filter(p=> p.type === 'gpu');
    let gpu = 0; for (const p of g){ try { gpu += kb(fs.readFileSync(`/proc/${p.id}/status`, 'utf8'), 'VmRSS'); } catch(e){} }
    return { ...m, ab: r1((u.backingStorageSize || 0)/1048576), gpu: r1(gpu), workers: page.workers().length };
  };
  const setLimit = n => page.evaluate(async n=>{ const u = await import('./utils.js'); Object.assign(u.settings, { livePolicy: 'count', liveMax: n }); (await import('./tabs.js')).sleepTick(); }, n);
  if (b2) await setLimit(19);
  // (a press timed in the page: the click to two frames after)
  const timedClick = sel => page.evaluate(sel=> new Promise(res=>{ const t0 = performance.now(); document.querySelector(sel).click(); requestAnimationFrame(()=> requestAnimationFrame(()=> res(performance.now() - t0))); }), sel);
  const semFiles = async files =>{ await app.files('sem', files); await page.waitForFunction(n=> document.querySelectorAll('#semThumbs .sem-thumb canvas').length >= n, files.length, { timeout: 120000 }); await app.settle(); };
  const results = async i => page.evaluate(async i=>{
    const u = await import('./utils.js'), t = (await import('./tabs.js')).TABS[i];
    const st = u.getModuleState(t.inst ? t.id : 'xrd');
    return JSON.stringify(st.cards.find(c=> c.id === 2).states.rietveld.results, (k, v)=> k === 'at' || k === 'ms' ? undefined : v);
  }, i);
  // (an EPR pair is one row of its list)
  for (const k of [0, 1]) for (const mod of ['tauc', 'gc', 'epr']){
    await app.newTab(mod); await app.drop(`#${mod}Dropzone`, SMALL[mod][k].map(f=> path.join(FX, f)));
    await page.waitForFunction(mod=> document.querySelectorAll(`#${mod}FileTableWrap tr.file-row`).length >= 1 && !document.querySelector('.dz-loading'), mod); await app.settle();
  }
  // X1 (6), refined on show (from the run under way, Cancel shown, to its end).
  await app.newTab('xrd'); await app.files('xrd', XRD12); await app.cif();
  await app.refineAll(); let t0 = Date.now(); await app.refineDone(); out.refineShownMs = Date.now() - t0; await app.settle();
  // SEM A (7), B (8).
  await app.newTab('sem'); await semFiles(SA);
  await app.newTab('sem'); await semFiles(SB);
  // X2 (9).
  await app.newTab('xrd'); await app.files('xrd', XRD12); await app.cif();
  // SEM: B shown, A shown, A's next image, in turn, while `go()`; ends on A.
  const semTimes = async go =>{
    const sw = [], nx = [];
    for (let k = 0; await go(k); k++){
      if (k % 3 === 2){ nx.push(r1(await timedClick('#semNext'))); await sleep(150); }
      else sw.push((await timedShow(page, k % 3 ? 7 : 8)).ms);
    }
    if (sw.length % 2) sw.push((await timedShow(page, 7)).ms);
    return { switchAB: { med: r1(med(sw)), max: r1(Math.max(...sw)), n: sw.length }, next: { med: r1(med(nx)), max: r1(Math.max(...nx)), n: nx.length } };
  };
  if (b2){
    // X2's run, its end seen in the page (tabs.js tabsNow, every 20 ms)
    await app.refineAll();
    await page.evaluate(async ()=>{ const T = await import('./tabs.js'), t0 = performance.now(); window.__run = 0;
      const id = setInterval(()=>{ if (!T.tabsNow()[9].busy){ window.__run = performance.now() - t0; clearInterval(id); } }, 20); });
    await app.show(7);
    out.semDuringRun = await semTimes(async ()=> !(await page.evaluate(()=> window.__run)));
    out.refineHiddenMs = Math.round(await page.evaluate(()=> window.__run));
    out.sameResults = (await results(9)) === (await results(6));
    await sleep(1500);
  }
  else { await app.refineAll(); t0 = Date.now(); await app.refineDone(); out.refineShownMs2 = Date.now() - t0; await app.show(7); }
  out.semIdle = await semTimes(async k=> k < 15);
  if (b2) out.tabs = (await app.tabs()).map(t=> t.module + (t.awake ? '' : ' (asleep)'));
  out.mem = {};
  if (b2){
    out.mem.allAwake = await memAll();
    await setLimit(6); out.mem.limit6 = await memAll(); out.awakeAtLimit = (await app.tabs()).filter(t=> t.awake).length;
    await app.tick(61000); out.mem.trimmed = await memAll();
    await app.tick(11*MIN); out.mem.asleep = await memAll();
    out.bytes = (await app.tabs()).map(t=> t.bytes);
  }
  else out.mem.parked = await memAll();
  // Shown from SEM A (7): X1 (6), SEM B (8), DRS 1 (0); b2: each asleep first, woken.
  const shows = { x1: [], semB: [], drs1: [] };
  for (let k = 0; k < 3; k++) for (const [n, i] of [['x1', 6], ['semB', 8], ['drs1', 0]]){
    if (b2) await app.tick(11*MIN);
    shows[n].push((await timedShow(page, i)).ms);
    await app.show(7);
  }
  out.shows = Object.fromEntries(Object.entries(shows).map(([k, v])=> [k, { med: r1(med(v)), all: v }]));
  out.errors = L.errors;
  await L.close();
  return out;
}
const res = {};
for (const tree of ['b2', 'head'].filter(t=> !ONLY.length || ONLY.includes(t))){ res[tree] = await run(tree); console.log(JSON.stringify(res[tree])); }
fs.rmSync(dir, { recursive: true, force: true });
console.log(save('session.json', { method: 'measure/session.mjs: headless Chromium, 4 vCPUs, one tree at a time, forced GCs before each memory reading', ...res }));
