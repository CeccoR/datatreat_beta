/* Arrays fixed, not frozen (b2v3, db.js fixed) against b2v2 (XRPD's frozen, DRS's and EPR's
   copied into a state parked), on a profile on disk (as LIM_PROFILE=disk). One tab measured
   beside a blank GC tab on show: XRPD, the 12 patterns of 5384 points; DRS, 10 Cary 5000
   exports of 1201 points (tests/fixtures.mjs caryCsv); EPR, 10 spectra of 1024 points
   (eprPair). For each: the JS heap after two forced GCs with the tab hidden and awake, with
   it asleep (tabs.js sleepTick), and with it closed, the two first less the third (what the
   tab holds); and, counted in the page, the distinct arrays of numbers of over 100 elements
   the tab holds (its instance's state, or asleep its parked state and its history), their
   elements and how many are frozen. Files dropped as a DragEvent (lib.mjs drop); the
   readings 5.5 s after the last change (the autosave's trailing write holds the tab till
   then). 3 runs a tree, a browser each; medians.
   V2_BASE (b2v2, default http://127.0.0.1:8991), V3_BASE (b2v3, default :8990).
   node fixed.mjs → results/fixed.json */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { FX, med, save, sleep } from './lib.mjs';
import { caryCsv, eprPair } from '../../../tests/fixtures.mjs';

const TREES = { v2: process.env.V2_BASE || 'http://127.0.0.1:8991', v3: process.env.V3_BASE || 'http://127.0.0.1:8990' };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fixed-fx-'));
const put = (n, b)=>{ const p = path.join(tmp, n); fs.writeFileSync(p, b); return p; };
const FILES = {
  xrd: Array.from({ length: 12 }, (_, i)=> path.join(FX, 'xrd', 's' + String(i).padStart(2, '0') + '.xrdml')),
  tauc: Array.from({ length: 10 }, (_, i)=> put(`c${i}.csv`, caryCsv({ name: 'C' + i, Eg: 2.9 + 0.05*i, A: 40 + 3*i, seed: 30 + i }).buffer)),
  epr: Array.from({ length: 10 }, (_, i)=>{ const e = eprPair({ title: 'e' + i, B0: 3380 + 4*i, seed: 50 + i }); return [put(`e${i}.DSC`, e.dsc), put(`e${i}.DTA`, e.dta)]; }).flat(),
};
const ROWS = { xrd: 12, tauc: 10, epr: 10 };
const MB = b => Math.round(b/1048576*1000)/1000;

async function run(base, mod){
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fixed-profile-'));
  const ctx = await chromium.launchPersistentContext(dir, { viewport: { width: 1400, height: 900 }, serviceWorkers: 'block' });
  const page = ctx.pages()[0], cdp = await ctx.newCDPSession(page), errors = [];
  page.on('pageerror', e=> errors.push(e.message));
  const ready = ()=> page.waitForFunction(()=> !document.documentElement.classList.contains('app-booting') && !!document.querySelector('#tabBar .ptab-add') && !document.querySelector('.module-loader.show, .dz-loading'), null, { timeout: 60000 });
  const open = async m =>{ await page.click('#nav button[data-tab="home"]'); await page.click(`.home-card[data-go="${m}"]`); await ready(); };
  const heap = async ()=>{ await sleep(300); for (let i = 0; i < 2; i++){ await cdp.send('HeapProfiler.collectGarbage'); await sleep(200); } return (await cdp.send('Runtime.getHeapUsage')).usedSize; };
  // (the tab's arrays of numbers: distinct, their elements, frozen)
  const count = ()=> page.evaluate(async ()=>{
    const T = await import('./tabs.js'), u = await import('./utils.js'), t = T.TABS[0], seen = new Set();
    const walk = v =>{ if (!v || typeof v !== 'object' || ArrayBuffer.isView(v)) return; if (Array.isArray(v) && v.length > 100 && typeof v[0] === 'number'){ seen.add(v); return; } for (const k in v) walk(v[k]); };
    if (t.inst){ walk(u.getModuleState(t.id)); walk(u.getModuleHistory(t.id).states); } else { walk(t.state); walk(t.hist.states); }
    const a = [...seen];
    return { arrays: a.length, elements: a.reduce((s, x)=> s + x.length, 0), frozen: a.filter(Object.isFrozen).length };
  });
  await page.goto(base + '/index.html'); await ready();
  await open(mod);
  // (dropped as a DragEvent: setInputFiles keeps a hold on the input, and so on the instance)
  const list = FILES[mod].map(f=> [path.basename(f), fs.readFileSync(f).toString('base64')]);
  await page.evaluate(([sel, list])=>{
    const dt = new DataTransfer();
    for (const [name, b64] of list) dt.items.add(new File([Uint8Array.from(atob(b64), c=> c.charCodeAt(0))], name));
    document.querySelector(sel).dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  }, [`#${mod}Dropzone`, list]);
  await page.waitForFunction(([m, n])=> document.querySelectorAll(`#${m}FileTableWrap tr.file-row`).length === n, [mod, ROWS[mod]], { timeout: 60000 });
  await ready();
  await open('gc');
  await sleep(5500);   // (the autosave's trailing write, 5 s after the change, holds the tab till then: sessions.js)
  const awake = await heap(), cAwake = await count();
  await page.evaluate(async ()=> (await import('./tabs.js')).sleepTick(Date.now() + 11*60e3));
  const asleep = await heap(), cAsleep = await count();
  await page.evaluate(async ()=>{ const T = await import('./tabs.js'); T.closeTab(T.TABS[0].id); });
  const none = await heap();
  await ctx.close(); fs.rmSync(dir, { recursive: true, force: true });
  return { awake: awake - none, asleep: asleep - none, cAwake, cAsleep, errors };
}

const out = { method: 'JS heap after two forced GCs, the tab hidden awake / asleep, less the page with it closed; a profile on disk; medians of 3', trees: TREES, files: { xrd: '12 XRDML patterns of 5384 points', tauc: '10 Cary 5000 exports of 1201 points', epr: '10 spectra of 1024 points' } };
for (const mod of ['xrd', 'tauc', 'epr']){
  out[mod] = {};
  for (const [tree, base] of Object.entries(TREES)){
    const rs = []; for (let k = 0; k < 3; k++) rs.push(await run(base, mod));
    out[mod][tree] = { awakeMB: MB(med(rs.map(r=> r.awake))), asleepMB: MB(med(rs.map(r=> r.asleep))), runsAwakeMB: rs.map(r=> MB(r.awake)), runsAsleepMB: rs.map(r=> MB(r.asleep)),
      arraysAwake: rs[0].cAwake, arraysAsleep: rs[0].cAsleep, errors: rs.flatMap(r=> r.errors) };
    console.log(mod, tree, JSON.stringify(out[mod][tree]));
  }
  out[mod].savedMB = { awake: Math.round((out[mod].v2.awakeMB - out[mod].v3.awakeMB)*1000)/1000, asleep: Math.round((out[mod].v2.asleepMB - out[mod].v3.asleepMB)*1000)/1000 };
}
fs.rmSync(tmp, { recursive: true, force: true });
console.log(save('fixed.json', out));
