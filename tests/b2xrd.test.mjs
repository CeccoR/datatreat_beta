/* XRPD made per tab (b2): each XRPD tab an instance of its own, awake while it is shown or
   was lately, in one page. Two tabs awake at once, each its own files, view and undo
   history, a switch to one awake only showing it (the same section, nothing restored, no
   loader); a refinement going on in a tab left, on the workers' pool, its results those of
   one refined on show, written into its history and its record, its tab marked unsaved; a
   tab hidden past Settings' minutes asleep (tabs.js sleepTick: the time taken to be later),
   one busy not until its job's end, the one shown least lately asleep beyond the tabs
   awake allowed, woken with its whole history; a hidden tab saved as
   it is closed, reopened from Projects; a reload, the tab on show awake and the others
   asleep until shown. The workers' answers held where a run must go on (window.__hold). */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start, openModule, loadFiles, switchTab, settle, undo, moduleState, history, idb, banner, answer, saveAs,
         openProject, until, tabLabels, ready } from './helpers.mjs';

let env;
before(async ()=>{ env = await start(); });
after(()=> env && env.close());

const P = '#xrdR2';
// The shell's tabs (tabs.js tabsNow), and its rules run as if `ms` had passed.
const tabs = page => page.evaluate(async ()=> (await import('./tabs.js')).tabsNow());
const awake = async page => (await tabs(page)).map(t=> t.awake);
const tick = (page, ms)=> page.evaluate(async ms=> (await import('./tabs.js')).sleepTick(Date.now() + ms), ms);
const MIN = 60000;
const labels = async page => (await moduleState(page, 'xrd')).files.map(f=> f.label);
async function relabel(page, i, v){ const l = page.locator(`#xrdFileTableWrap .file-label[data-i="${i}"]`); await l.fill(v); await l.press('Enter'); await settle(page); }
// The workers' results held while __hold, delivered by __release(); before any worker is made.
const holdWorkers = page => page.evaluate(()=>{
  const W = window.Worker; window.__held = []; window.__hold = false;
  const wrap = fn => e=>{ if (window.__hold && e.data && e.data.type === 'result') window.__held.push(()=> fn(e)); else fn(e); };
  window.Worker = class extends W {
    addEventListener(t, fn, o){ if (t !== 'message') return super.addEventListener(t, fn, o); const g = wrap(fn); (this.__m || (this.__m = new Map())).set(fn, g); return super.addEventListener(t, g, o); }
    removeEventListener(t, fn, o){ return super.removeEventListener(t, (t === 'message' && this.__m && this.__m.get(fn)) || fn, o); }
  };
  window.__release = ()=>{ window.__hold = false; window.__held.splice(0).forEach(f=> f()); };
});
const press = async (page, sel)=>{ await page.waitForTimeout(650); await page.click(sel); };
async function refineAll(page){
  await press(page, P + 'RefineAll');
  await page.waitForSelector('.confirm-modal');
  await page.click('.confirm-modal .btn:not(.primary)');
  await page.waitForFunction(s=> document.querySelector(s).textContent === 'Cancel', P + 'Refine');
}
// A new XRPD tab of n patterns and the CIF on its Rietveld card.
async function xrdTab(page, n){
  await openModule(page, 'xrd');
  await loadFiles(page, 'xrd', env.fx.files.xrd.slice(0, n));
  await page.setInputFiles(P + 'CifInput', env.fx.cif);
  await page.waitForSelector(P + 'PhaseList input[data-on]');
  await settle(page);
}
const results = async page => (((await moduleState(page, 'xrd')).cards.find(c=> c.id === 2) || {}).states?.rietveld?.results || {});
// (what the worker gave, its times left out)
const strip = r => JSON.parse(JSON.stringify(r, (k, v)=> k === 'at' || k === 'ms' ? undefined : v));

test('two XRPD tabs awake at once: each its own files, view and undo; a switch to one awake only shows it', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'xrd'); await loadFiles(page, 'xrd', env.fx.files.xrd.slice(0, 2));
    await relabel(page, 0, 'a-one');
    // (its section, marked: the same element when it is shown again, not a restore's)
    await page.evaluate(()=>{ document.querySelector('#tab-xrd').dataset.mark = 'A'; });
    await openModule(page, 'xrd'); await loadFiles(page, 'xrd', env.fx.files.xrd.slice(2, 3));
    assert.deepEqual(await awake(page), [true, true], 'both awake');
    assert.equal(await page.locator('#tab-xrd').count(), 1, 'one XRPD section in the page, the one on show');
    assert.equal(await page.locator('#xrdFileTableWrap tr.file-row').count(), 1);
    await relabel(page, 0, 'b-one');
    await switchTab(page, 0);
    assert.equal(await page.evaluate(()=> document.querySelector('#tab-xrd').dataset.mark), 'A', 'tab A\'s own section, shown again');
    assert.deepEqual(await labels(page), ['a-one', 's01']);
    assert.deepEqual(await history(page, 'xrd'), { index: 2, n: 3 }, 'its history: start, files, label');
    await relabel(page, 1, 'a-two');
    // Undo in A undoes A's steps alone; B keeps its own.
    await undo(page); await undo(page);
    assert.deepEqual(await labels(page), ['s00', 's01']);
    await switchTab(page, 1);
    assert.deepEqual(await labels(page), ['b-one']);
    await undo(page);
    assert.deepEqual(await labels(page), ['s02']);
    await switchTab(page, 0);
    await undo(page, true);
    assert.deepEqual(await labels(page), ['a-one', 's01'], 'A\'s redo, after B\'s undo');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('a refinement goes on in a tab left, on the pool: the results of one refined on show, its history\'s step, its record, its "*"', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await xrdTab(page, 3);
    await refineAll(page);
    // Left at once for another XRPD tab: nothing asked, the run goes on there.
    await openModule(page, 'xrd');
    assert.equal(await banner(page), null, 'nothing asked');
    assert.equal((await tabs(page))[0].busy, true, 'still refining, hidden');
    await until(async ()=> !(await tabs(page))[0].busy, { timeout: 120000, what: 'the hidden run\'s end' });
    // Its record has the results (the autosave of a tab not on show), its label the "*".
    await until(async ()=> { const r = (await idb(page, 'tabs')).find(x=> x.order === 0); return r && Object.keys(r.state.cards.find(c=> c.id === 2).states.rietveld.results || {}).length === 3; }, { what: 'the record' });
    assert.match((await tabLabels(page))[0], /\*$/);
    assert.deepEqual(await labels(page), [], 'the tab on show untouched');
    await switchTab(page, 0);
    const hidden = strip(await results(page));
    assert.deepEqual(Object.keys(hidden), ['s00.xrdml', 's01.xrdml', 's02.xrdml']);
    // Its plot drawn as it is shown: the observed, calculated, background and difference.
    assert.ok(await page.locator(P + 'Svg path').count() >= 4, 'drawn on show');
    const h = await history(page, 'xrd');
    await undo(page);
    assert.deepEqual(Object.keys(await results(page)), [], 'its step undone');
    await undo(page, true);
    assert.equal((await history(page, 'xrd')).index, h.index);
    // The same refined on show, in a third tab.
    await xrdTab(page, 3);
    await refineAll(page);
    await page.waitForFunction(s=> document.querySelector(s).textContent === 'Refine', P + 'Refine', { timeout: 120000 });
    await settle(page);
    assert.deepEqual(strip(await results(page)), hidden, 'bit for bit');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('asleep past Settings\' minutes, a busy tab not until its job\'s end, the one shown least lately beyond the tabs awake allowed; woken with its whole history', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await holdWorkers(page);
    // Settings › Tabs in the background: 10 minutes, two tabs awake, the one on show among them.
    await page.click('#nav button[data-tab="settings"]');
    await page.fill('#settingSleepMin', '10'); await page.press('#settingSleepMin', 'Enter');
    await page.fill('#settingAwakeMax', '2'); await page.press('#settingAwakeMax', 'Enter');
    await settle(page);
    // A: two patterns, three steps of labels.
    await openModule(page, 'xrd'); await loadFiles(page, 'xrd', env.fx.files.xrd.slice(0, 2));
    for (const v of ['x', 'y', 'z']) await relabel(page, 0, v);
    const hA = await history(page, 'xrd');
    // B: refining, its results held.
    await xrdTab(page, 1);
    await page.evaluate(()=>{ window.__hold = true; });
    await refineAll(page);
    // C on show: two hidden, two allowed awake: A, shown least lately, sleeps; B refines on.
    await openModule(page, 'xrd');
    assert.deepEqual(await awake(page), [false, true, true]);
    assert.equal((await tabs(page))[0].history, true, 'A\'s history parked with it');
    // Past the minutes: B is busy and stays awake.
    await tick(page, 11*MIN);
    assert.deepEqual(await awake(page), [false, true, true], 'busy: awake');
    // Its job ends: its time hidden counted from then.
    await page.evaluate(()=> window.__release());
    await until(async ()=> !(await tabs(page))[1].busy, { timeout: 120000, what: 'B\'s run\'s end' });
    await tick(page, 9*MIN);
    assert.deepEqual(await awake(page), [false, true, true], '9 minutes after its end: awake');
    await tick(page, 11*MIN);
    assert.deepEqual(await awake(page), [false, false, true], '11 minutes after: asleep');
    // A woken: its state and its whole history, step by step.
    await switchTab(page, 0);
    assert.deepEqual(await labels(page), ['z', 's01']);
    assert.deepEqual(await history(page, 'xrd'), hA);
    for (const v of ['y', 'x', 's00']){ await undo(page); assert.equal((await labels(page))[0], v); }
    await undo(page);
    assert.deepEqual(await labels(page), [], 'down to the empty start');
    for (let i = 0; i < 4; i++) await undo(page, true);
    assert.deepEqual(await labels(page), ['z', 's01'], 'and up again');
    // (two awake allowed: C, hidden, stays; B woken, C, shown least lately, sleeps)
    assert.deepEqual(await awake(page), [true, false, true]);
    // B woken with its run's results and the run's step.
    await switchTab(page, 1);
    assert.deepEqual(await awake(page), [true, true, false]);
    assert.deepEqual(Object.keys(await results(page)), ['s00.xrdml']);
    await undo(page);
    assert.deepEqual(Object.keys(await results(page)), [], 'the run\'s step undone');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('the LRU: beyond three tabs awake, the one not shown for longest sleeps, a woken one counting from its show', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await page.evaluate(async ()=>{ const u = await import('./utils.js'); u.settings.awakeMax = 3; });
    for (let i = 0; i < 4; i++){ await openModule(page, 'xrd'); await loadFiles(page, 'xrd', env.fx.files.xrd.slice(i % 3, i % 3 + 1)); }
    assert.deepEqual(await awake(page), [false, true, true, true]);
    await switchTab(page, 0);
    assert.deepEqual(await awake(page), [true, false, true, true], 'T1 woken, T2 the one hidden longest');
    await switchTab(page, 2);
    assert.deepEqual(await awake(page), [true, false, true, true], 'T3 shown: T1 and T4 hidden, two');
    assert.deepEqual(await labels(page), ['s02']);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('a hidden tab saved as it is closed, reopened from Projects; a reload: the tab on show awake, the others woken as shown', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'xrd'); await loadFiles(page, 'xrd', env.fx.files.xrd.slice(0, 2));
    await saveAs(page, 'Alpha');
    await relabel(page, 0, 'edited');
    await openModule(page, 'xrd'); await loadFiles(page, 'xrd', env.fx.files.xrd.slice(2, 3));
    assert.deepEqual(await tabLabels(page), ['XRPD · Alpha*', 'XRPD · Untitled project*']);
    // Closed hidden, Save: saved as it is, not shown first.
    await page.locator('#tabBar .ptab').nth(0).locator('.ptab-x').click();
    assert.match((await banner(page)).text, /Save “Alpha” before closing/);
    await answer(page, 'ok');
    await page.waitForFunction(()=> document.querySelectorAll('#tabBar .ptab').length === 1);
    assert.deepEqual(await labels(page), ['s02'], 'the tab on show untouched');
    const rec = (await idb(page)).find(r=> r.title === 'Alpha');
    assert.deepEqual(rec.state.files.map(f=> f.label), ['edited', 's01']);
    await openProject(page, 'xrd', 'Alpha');
    assert.deepEqual(await labels(page), ['edited', 's01']);
    // A reload: two tabs, Alpha on show awake, the other asleep until shown.
    await page.reload(); await ready(page); await settle(page);
    assert.deepEqual(await awake(page), [false, true]);
    assert.deepEqual(await labels(page), ['edited', 's01']);
    await switchTab(page, 0);
    assert.deepEqual(await labels(page), ['s02']);
    assert.deepEqual(await awake(page), [true, true]);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
