/* Every module made per tab (v518), together in one page: two tabs of each module (ten), each
   its own files, labels and undo history; switches across modules; the tabs awake beyond
   Settings' limit asleep, the one not shown for longest first (LRU), woken as shown with
   their whole history; every tab hidden past Settings' minutes asleep, its instance let go
   (WeakRefs to the sections emptied by a GC), woken. A refinement going on, on the workers'
   pool, in an XRPD tab left while a SEM tab and a DRS tab are worked in: each history its
   own, the run's step and record its tab's. One saved project of each module: a hidden tab
   closed with Save, saved as it is; a reload, the tab on show awake and the others asleep
   until shown, their edits kept; reopened from Projects; Projects' CSVs of each the same as
   its project bar's (read through an instance of its own, utils.js withState). */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { start, openModule, loadFiles, switchTab, settle, undo, moduleState, history, idb, banner, answer, saveAs,
         openProject, until, tabLabels, ready, download, readZip, MODS } from './helpers.mjs';

let env;
before(async ()=>{ env = await start(); });
after(()=> env && env.close());

const tabs = page => page.evaluate(async ()=> (await import('./tabs.js')).tabsNow());
const awake = async page => (await tabs(page)).map(t=> t.awake);
const tick = (page, ms)=> page.evaluate(async ms=> (await import('./tabs.js')).sleepTick(Date.now() + ms), ms);
const MIN = 60000;
const labels = async (page, mod)=> (await moduleState(page, mod)).files.map(f=> f.label);
async function relabel(page, mod, i, v){ const l = page.locator(`#${mod}FileTableWrap .file-label[data-i="${i}"]`); await l.fill(v); await l.press('Enter'); await settle(page); }
const shownMod = page => page.evaluate(()=> (document.querySelector('section.tab.active') || {}).id);
// Each module's files for its tab A and tab B (an EPR pair is one row).
const SETS = { tauc: [[0], [1]], xrd: [[0, 1], [2]], gc: [[0], [1]], epr: [[0, 1], [2, 3]], sem: [[0, 1], [2]] };
const rowsOf = (mod, n)=> mod === 'epr' ? n/2 : n;
/* A new tab of the module and its files dropped (a DragEvent), with no element handle kept:
   Playwright's setInputFiles keeps a hold on the input it filled, and so on its instance,
   which a tab asleep would then never let go. */
async function newTab(page, mod){
  await page.click('#nav button[data-tab="home"]');
  await page.click(`.home-card[data-go="${mod}"]`);
  await page.waitForFunction(mod=> !!document.querySelector(`#tab-${mod}.active`), mod);
  await settle(page);
}
async function drop(page, mod, files){
  const n0 = await page.locator(`#${mod}FileTableWrap tr.file-row`).count(), rows = rowsOf(mod, files.length);
  const list = files.map(f=> [path.basename(f), fs.readFileSync(f).toString('base64')]);
  await page.evaluate(([mod, list])=>{
    const dt = new DataTransfer();
    for (const [name, b64] of list) dt.items.add(new File([Uint8Array.from(atob(b64), c=> c.charCodeAt(0))], name));
    document.querySelector(`#${mod}Dropzone`).dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  }, [mod, list]);
  await page.waitForFunction(([mod, n])=> document.querySelectorAll(`#${mod}FileTableWrap tr.file-row`).length >= n && !document.querySelector('.dz-loading'), [mod, n0 + rows], { timeout: 20000 });
  if (mod === 'sem') await page.waitForFunction(()=> document.querySelectorAll('#semThumbs .sem-thumb canvas').length === document.querySelectorAll('#semFileTableWrap .file-incl:checked').length, null, { timeout: 20000 });
  await settle(page);
}
// The workers' Rietveld results held while __hold, delivered by __release(); before any worker is made.
const holdWorkers = page => page.evaluate(()=>{
  const W = window.Worker; window.__held = []; window.__hold = false;
  const wrap = fn => e=>{ if (window.__hold && e.data && e.data.type === 'result') window.__held.push(()=> fn(e)); else fn(e); };
  window.Worker = class extends W {
    addEventListener(t, fn, o){ if (t !== 'message') return super.addEventListener(t, fn, o); const g = wrap(fn); (this.__m || (this.__m = new Map())).set(fn, g); return super.addEventListener(t, g, o); }
    removeEventListener(t, fn, o){ return super.removeEventListener(t, (t === 'message' && this.__m && this.__m.get(fn)) || fn, o); }
  };
  window.__release = ()=>{ window.__hold = false; window.__held.splice(0).forEach(f=> f()); };
});

test('ten tabs, two of each module: each its own files and undo across switches; beyond the limit the one not shown for longest asleep; all asleep past the minutes, let go, woken with their histories', async ()=>{
  const { page, errors, csp, close } = await env.page();
  try {
    await page.evaluate(async ()=>{ const u = await import('./utils.js'); Object.assign(u.settings, { sleepMin: 10, awakeMax: 7 }); });
    const fx = env.fx.files, T = [];
    for (const k of [0, 1]) for (const mod of MODS){
      await newTab(page, mod);
      await drop(page, mod, SETS[mod][k].map(i=> fx[mod][i]));
      const plain = await labels(page, mod), mine = `${mod}-${'AB'[k]}`;
      await relabel(page, mod, 0, mine);
      T.push({ mod, plain, mine: [mine, ...plain.slice(1)], h: await history(page, mod) });
    }
    // Ten tabs, seven awake allowed (the one on show among them): the three opened first asleep.
    assert.deepEqual(await awake(page), [false, false, false, true, true, true, true, true, true, true]);
    assert.equal(await page.locator('section.tab[id^="tab-"]:is(#tab-tauc,#tab-xrd,#tab-gc,#tab-epr,#tab-sem)').count(), 5, 'one section of each module in the page');
    // Each shown in turn: its own files and history; each woken wakes one, the one not shown for longest asleep.
    for (let i = 0; i < 10; i++){
      await switchTab(page, i);
      assert.equal(await shownMod(page), 'tab-' + T[i].mod);
      assert.deepEqual(await labels(page, T[i].mod), T[i].mine, `tab ${i} its own files`);
      assert.deepEqual(await history(page, T[i].mod), T[i].h, `tab ${i} its whole history`);
      assert.equal((await awake(page)).filter(Boolean).length, 7, 'six awake hidden and the one on show');
    }
    assert.deepEqual(await awake(page), [false, false, false, true, true, true, true, true, true, true], 'the LRU: those not shown for longest asleep');
    // Undo in each: its own step undone, no other tab's.
    for (let i = 0; i < 10; i++){ await switchTab(page, i); await undo(page); assert.deepEqual(await labels(page, T[i].mod), T[i].plain, `tab ${i} undone`); }
    for (let i = 0; i < 10; i++){
      await switchTab(page, i);
      assert.deepEqual(await labels(page, T[i].mod), T[i].plain, `tab ${i} as its own undo left it`);
      await undo(page, true);
      assert.deepEqual(await labels(page, T[i].mod), T[i].mine, `tab ${i} redone`);
    }
    // Every tab hidden past Settings' minutes: asleep, its instance let go.
    await page.evaluate(async ()=>{ window.__roots = (await import('./tabs.js')).TABS.filter((t, i)=> t.inst && i !== 9).map(t=> new WeakRef(t.inst.root)); });
    await tick(page, 9*MIN);
    assert.equal((await awake(page)).filter(Boolean).length, 7, '9 minutes hidden: awake');
    await tick(page, 11*MIN);
    assert.deepEqual(await awake(page), [false, false, false, false, false, false, false, false, false, true], '11 minutes: asleep but the tab on show');
    assert.ok((await tabs(page)).slice(0, 9).every(t=> t.history), 'their histories parked');
    const cdp = await page.context().newCDPSession(page);
    for (let i = 0; i < 3; i++){ await cdp.send('HeapProfiler.collectGarbage'); await page.waitForTimeout(100); }
    assert.deepEqual(await page.evaluate(()=> window.__roots.map(r=> r.deref() === undefined)), [true, true, true, true, true, true], 'their sections collected');
    // Woken, each as it was.
    for (let i = 0; i < 9; i++){
      await switchTab(page, i);
      assert.deepEqual(await labels(page, T[i].mod), T[i].mine, `tab ${i} woken`);
      assert.deepEqual(await history(page, T[i].mod), T[i].h);
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(await csp(), []);
  } finally { await close(); }
});

test('a refinement on the pool in an XRPD tab left, while a SEM and a DRS tab are worked in: each history its own, the run\'s step and record its tab\'s', async ()=>{
  const { page, errors, csp, close } = await env.page();
  try {
    await holdWorkers(page);
    await openModule(page, 'xrd'); await loadFiles(page, 'xrd', env.fx.files.xrd);
    await page.setInputFiles('#xrdR2CifInput', env.fx.cif);
    await page.waitForSelector('#xrdR2PhaseList input[data-on]');
    await settle(page);
    const hx = await history(page, 'xrd');
    await page.evaluate(()=>{ window.__hold = true; });
    await page.waitForTimeout(650); await page.click('#xrdR2RefineAll');
    await page.waitForSelector('.confirm-modal');
    await page.click('.confirm-modal .btn:not(.primary)');
    await page.waitForFunction(()=> document.querySelector('#xrdR2Refine').textContent === 'Cancel');
    // Left for SEM: nothing asked; the run goes on hidden while SEM's files are read and edited.
    await openModule(page, 'sem');
    assert.equal(await banner(page), null, 'nothing asked');
    await loadFiles(page, 'sem', env.fx.files.sem);
    await relabel(page, 'sem', 0, 'sem-one');
    await relabel(page, 'sem', 1, 'sem-two');
    await undo(page);
    assert.deepEqual(await labels(page, 'sem'), ['sem-one', 'S2', 'S3']);
    assert.equal((await tabs(page))[0].busy, true, 'XRPD still refining, hidden');
    // and for DRS, then SEM again; past Settings' minutes the busy tab stays awake.
    await openModule(page, 'tauc'); await loadFiles(page, 'tauc', env.fx.files.tauc);
    await relabel(page, 'tauc', 0, 'drs-one');
    await switchTab(page, 1);
    await tick(page, 11*MIN);
    assert.deepEqual(await awake(page), [true, true, false], 'XRPD busy: awake; DRS asleep');
    const hs = await history(page, 'sem');
    // The run's end: its step in its own history, its record, its "*"; SEM's untouched.
    await page.evaluate(()=> window.__release());
    await until(async ()=> !(await tabs(page))[0].busy, { timeout: 120000, what: 'the hidden run\'s end' });
    await until(async ()=>{ const r = (await idb(page, 'tabs')).find(x=> x.order === 0); return r && Object.keys(r.state.cards.find(c=> c.id === 2).states.rietveld.results || {}).length === 3; }, { what: 'the XRPD record' });
    assert.match((await tabLabels(page))[0], /\*$/);
    assert.deepEqual(await history(page, 'sem'), hs, 'SEM\'s history untouched by the run');
    await undo(page, true);
    assert.deepEqual(await labels(page, 'sem'), ['sem-one', 'sem-two', 'S3'], 'SEM\'s redo its own');
    await switchTab(page, 0);
    const res = ()=> moduleState(page, 'xrd').then(s=> Object.keys(s.cards.find(c=> c.id === 2).states.rietveld.results || {}));
    assert.deepEqual(await res(), ['s00.xrdml', 's01.xrdml', 's02.xrdml']);
    assert.equal((await history(page, 'xrd')).index, hx.index + 1, 'the run one step of its own');
    assert.ok(await page.locator('#xrdR2Svg path').count() >= 4, 'drawn on show');
    await undo(page);
    assert.deepEqual(await res(), [], 'the run\'s step undone');
    await switchTab(page, 2);
    assert.deepEqual(await labels(page, 'tauc'), ['drs-one', 'drs2'], 'DRS woken as it was');
    assert.deepEqual(errors, []);
    assert.deepEqual(await csp(), []);
  } finally { await close(); }
});

test('a saved project of each module: a hidden tab closed with Save, saved as it is; a reload, the others asleep until shown; reopened; Projects\' CSVs those of the project bar', async ()=>{
  const { page, errors, csp, close } = await env.page();
  try {
    const bar = {};
    for (const mod of MODS){
      await openModule(page, mod); await loadFiles(page, mod, env.fx.files[mod]);
      await saveAs(page, 'P-' + mod);
      bar[mod] = readZip((await download(page, ()=> page.click('.proj-csv'))).buf);
      await relabel(page, mod, 0, mod + '-edited');
    }
    assert.ok((await tabLabels(page)).every(l=> /\*$/.test(l)), 'each edited, unsaved');
    // Closed hidden, with Save: saved as it is, not shown.
    await page.locator('#tabBar .ptab').nth(1).locator('.ptab-x').click();
    assert.match((await banner(page)).text, /Save “P-xrd” before closing/);
    await answer(page, 'ok');
    await page.waitForFunction(()=> document.querySelectorAll('#tabBar .ptab').length === 4);
    assert.equal(await shownMod(page), 'tab-sem', 'the tab on show untouched');
    assert.deepEqual((await idb(page)).find(r=> r.title === 'P-xrd').state.files.map(f=> f.label), ['xrd-edited', 's01', 's02']);
    // A reload: the tab on show awake, the others asleep, each with its edit.
    await page.reload(); await ready(page); await settle(page);
    assert.deepEqual(await awake(page), [false, false, false, true]);
    const mods = ['tauc', 'gc', 'epr', 'sem'];
    for (let i = 0; i < 4; i++){
      await switchTab(page, i);
      assert.equal((await labels(page, mods[i]))[0], mods[i] + '-edited', mods[i] + ' as it was left');
    }
    await openProject(page, 'xrd', 'P-xrd');
    assert.deepEqual(await labels(page, 'xrd'), ['xrd-edited', 's01', 's02'], 'reopened as saved');
    bar.xrd = readZip((await download(page, ()=> page.click('.proj-csv'))).buf);
    // Projects › CSV of each saved project: an instance of its own, the same files as its bar's.
    await page.click('#nav button[data-tab="projects"]');
    for (const mod of MODS){
      const row = page.locator('#sessListWrap tr.sess-row').filter({ has: page.locator(`input.proj-rename[value="P-${mod}"]`) });
      const list = readZip((await download(page, ()=> row.locator('.pr-csv').click())).buf);
      assert.deepEqual(list.map(e=> e.name), bar[mod].map(e=> e.name), mod + ': the same files');
      list.forEach((e, i)=> assert.ok(e.data.equals(bar[mod][i].data), mod + ': ' + e.name + ' differs'));
    }
    assert.deepEqual(await awake(page), [true, true, true, true, true], 'the CSVs read, the tabs as they were');
    assert.deepEqual(errors, []);
    assert.deepEqual(await csp(), []);
  } finally { await close(); }
});
