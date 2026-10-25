/* What writing a run's results into a parked tab would cost (option A), on HEAD's own
   pieces, with a 12-pattern XRPD project refined (SrTiO3, card 2): the module's state read
   (getModuleState), parked (db.js park), keyed (stateKey: the "*" check), decoded, stored
   (putTabRec, IndexedDB: the persist of a parked tab), and a history's release (UndoStack:
   hold, 79 commits, release with a patch that writes a result into card 2's state, as
   runPatch does) — each REPS times, the median, ms. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { save, med, BASE } from './lib.mjs';
const REPS = +(process.argv[2] || 7);
const FX = '/tmp/claude-0/-home-user-datatreat-beta/51d5ad4e-64c4-51d8-8fdc-0e18be5b5240/scratchpad/e2e/xrd/';
const CIF = '/tmp/claude-0/-home-user-datatreat-beta/51d5ad4e-64c4-51d8-8fdc-0e18be5b5240/scratchpad/wf-xrd/rv-busy/SrTiO3.cif';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, serviceWorkers: 'block' });
const app = await ctx.newPage();
await app.goto(BASE + '/index.html');
await app.waitForFunction(()=> !document.documentElement.classList.contains('app-booting') && document.querySelector('#tabBar .ptab-add'));
await app.click('#nav button[data-tab="home"]');
await app.click('.home-card[data-go="xrd"]');
await app.waitForSelector('#tab-xrd.active');
await app.setInputFiles('#xrdFiles', Array.from({ length: 12 }, (_, i)=> FX + 's' + String(i).padStart(2, '0') + '.xrdml'));
await app.waitForFunction(()=> document.querySelectorAll('#xrdFileTableWrap tr.file-row').length >= 12 && !document.querySelector('.dz-loading'));
await app.setInputFiles('#xrdR2CifInput', CIF);
await app.waitForSelector('#xrdR2PhaseList input[data-on]');
await app.waitForTimeout(800);
await app.click('#xrdR2RefineAll');
await app.waitForSelector('.confirm-modal');
await app.click('.confirm-modal .btn:not(.primary)');
await app.waitForFunction(()=> document.querySelector('#xrdR2Refine').textContent === 'Cancel');
await app.waitForFunction(()=> document.querySelector('#xrdR2Refine').textContent === 'Refine', null, { timeout: 120000 });
await app.waitForTimeout(500);
const r = await app.evaluate(async REPS=>{
  const u = await import('./utils.js'), db = await import('./db.js');
  const T = { get: [], park: [], key: [], decode: [], put: [], release80: [], patchOne: [] };
  const time = (k, f)=>{ const t = performance.now(); const v = f(); T[k].push(performance.now() - t); return v; };
  let sizes = null;
  for (let i = 0; i < REPS; i++){
    const s = time('get', ()=> u.getModuleState('xrd'));
    const p = time('park', ()=> db.park(s));
    time('key', ()=> u.stateKey(s));
    time('decode', ()=> db.decode(p));
    const t0 = performance.now(); await db.putTabRec({ id: 'bench-' + i, module: 'xrd', title: 'bench', projectId: null, dirty: true, order: 99, active: false, state: p, updatedAt: Date.now() }); T.put.push(performance.now() - t0);
    const res = s.cards.find(c=> c.id === 2).states.rietveld.results, one = Object.values(res)[0];
    sizes = { results: Object.keys(res).length, oneResultJson: JSON.stringify(one).length, stateJsonNoBytes: JSON.stringify(s, (k, v)=> v instanceof Uint8Array ? v.length : v).length };
    // A patch as runPatch writes one result into card 2's Rietveld state (a copy where it changes).
    const patch = st =>{ const c = st.cards.find(x=> x.id === 2), rv = c.states.rietveld;
      return { ...st, cards: st.cards.map(x=> x === c ? { ...c, states: { ...c.states, rietveld: { ...rv, results: { ...rv.results, 's00.xrdml': { ...one, at: 1 } } } } } : x) }; };
    time('patchOne', ()=> patch(s));
    // A history of 80 states (the limit), the mark on the first: release writes into all.
    let n = 0;
    const stack = { states: Array.from({ length: 80 }, (_, j)=> j ? { ...s, curIdx: j } : s) };
    // (UndoStack is not exported: its release is reproduced on a plain record, as a parked history would need)
    const t1 = performance.now();
    const h = { i: 0, redo: [] };
    for (let j = h.i + 1; j < stack.states.length; j++){ const x = patch(stack.states[j]); if (x !== stack.states[j]){ stack.states[j] = x; n++; } }
    const x0 = patch(stack.states[h.i]); stack.states.splice(h.i + 1, 0, x0); stack.states.shift();
    T.release80.push(performance.now() - t1);
  }
  const m = a => { const s = a.slice().sort((x, y)=> x - y); return s[Math.floor(s.length/2)]; };
  return { med: Object.fromEntries(Object.entries(T).map(([k, v])=> [k, +m(v).toFixed(2)])), raw: T, sizes };
}, REPS);
console.log(JSON.stringify({ med: r.med, sizes: r.sizes }, null, 1));
save('parked.json', r);
await browser.close();
