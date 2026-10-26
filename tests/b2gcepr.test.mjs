/* GC and EPR made per tab (v518): each GC or EPR tab an instance of its own in one page. For
   each module, two tabs awake at once, each its own files, parameters, results, view and
   undo history; a switch to one awake only showing it (its own section, its plots as they
   were, not drawn again); undo and redo in one leaving the other's steps alone; a tab hidden
   past Settings' minutes asleep (tabs.js sleepTick: the time taken to be later), its
   instance let go (a WeakRef to its section emptied by a GC), woken with its state, its
   results and its whole history, undone step by step to the empty start and redone. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { start, switchTab, settle, undo, moduleState, history } from './helpers.mjs';

let env;
before(async ()=>{ env = await start(); });
after(()=> env && env.close());

const tabs = page => page.evaluate(async ()=> (await import('./tabs.js')).tabsNow());
const awake = async page => (await tabs(page)).map(t=> t.awake);
const tick = (page, ms)=> page.evaluate(async ms=> (await import('./tabs.js')).sleepTick(Date.now() + ms), ms);
const MIN = 60000;
const labels = async (page, mod)=> (await moduleState(page, mod)).files.map(f=> f.label);
async function relabel(page, mod, v){ const l = page.locator(`#${mod}FileTableWrap .file-label[data-i="0"]`); await l.fill(v); await l.press('Enter'); await settle(page); }
const type = async (page, sel, v)=>{ await page.fill(sel, v); await page.press(sel, 'Enter'); await settle(page); };
/* A new tab of the module, and files dropped (a DragEvent), with no element handle kept:
   Playwright's setInputFiles keeps a hold on the input it filled, and a handle not disposed
   (openModule's waitForSelector) on its element, and so on its instance, which a tab
   asleep would then never let go. */
async function newTab(page, mod){
  await page.click('#nav button[data-tab="home"]');
  await page.click(`.home-card[data-go="${mod}"]`);
  await page.waitForFunction(mod=> !!document.querySelector(`#tab-${mod}.active`), mod);
  await settle(page);
}
async function drop(page, mod, files, rows){
  const n0 = await page.locator(`#${mod}FileTableWrap tr.file-row`).count();
  const list = files.map(f=> [path.basename(f), fs.readFileSync(f).toString('base64')]);
  await page.evaluate(([mod, list])=>{
    const dt = new DataTransfer();
    for (const [name, b64] of list) dt.items.add(new File([Uint8Array.from(atob(b64), c=> c.charCodeAt(0))], name));
    document.querySelector(`#${mod}Dropzone`).dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  }, [mod, list]);
  await page.waitForFunction(([mod, n])=> document.querySelectorAll(`#${mod}FileTableWrap tr.file-row`).length >= n && !document.querySelector('.dz-loading'), [mod, n0 + rows]);
  await settle(page);
}
/* Each module: its files for tab A and tab B, a parameter of its card (its field, its
   default, the value A sets), and what its results show, read in the page: GC's mean-rate
   bars (their labels and values), EPR's plot (its paths' coordinates). A plot drawn during
   a tab's fade in (style.css tab-fade: a redo just after a switch, a wake) measures its box
   moved by a fraction of a pixel, which can turn a coordinate's second decimal: the
   coordinates are the same to 0.02 px. */
const MODS = {
  gc: { a: fx => [fx.gc[0]], b: fx => [fx.gc[1]], rows: 1, field: '#tab-gc .gcShared[data-f="m"]', def: '15', set: '30', plot: '#gc1Svg1',
    shows: page => page.$$eval('#gc1SvgBar text', ts=> ts.map(t=> t.textContent)),
    same: (a, b)=> assert.deepEqual(a, b) },
  epr: { a: fx => fx.epr.slice(0, 2), b: fx => fx.epr.slice(2, 4), rows: 1, field: '#epr1Smooth', def: '0.2', set: '0.5', plot: '#epr1Svg',
    shows: page => page.$$eval('#epr1Svg path', ps=> ps.map(p=> (p.getAttribute('d') || '').match(/-?[\d.]+/g) || []).flat().map(Number)),
    same: (a, b)=>{ assert.equal(a.length, b.length); assert.ok(a.every((v, i)=> Math.abs(v - b[i]) <= 0.02), 'the same plot'); } },
};

for (const [mod, M] of Object.entries(MODS)) test(`${mod.toUpperCase()}: two tabs awake at once, each its own files, parameters, results and undo; one asleep past Settings' minutes, let go, woken with its whole history`, async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await page.evaluate(async ()=>{ const u = await import('./utils.js'); Object.assign(u.settings, { sleepMin: 10, awakeMax: 7 }); });
    const fx = env.fx.files, value = ()=> page.inputValue(M.field);
    // Tab A: its files, its parameter and a label.
    await newTab(page, mod); await drop(page, mod, M.a(fx), M.rows);
    const la = await labels(page, mod);
    await type(page, M.field, M.set);
    await relabel(page, mod, 'a-one');
    const A = { state: await moduleState(page, mod), h: await history(page, mod), shows: await M.shows(page) };
    assert.ok(A.shows.length, 'its results shown');
    // (its section and a curve of its plot, marked: the same elements when it is shown again)
    await page.evaluate(([mod, plot])=>{ document.querySelector(`#tab-${mod}`).dataset.mark = 'A'; document.querySelector(plot + ' path').dataset.mark = 'A'; }, [mod, M.plot]);
    await page.evaluate(async ()=>{ window.__root = new WeakRef((await import('./tabs.js')).TABS[0].inst.root); });
    // Tab B: its own files, the parameter at its default.
    await newTab(page, mod); await drop(page, mod, M.b(fx), M.rows);
    assert.deepEqual(await awake(page), [true, true], 'both awake');
    assert.equal(await page.locator(`#tab-${mod}`).count(), 1, 'one section of the module in the page, the one on show');
    assert.equal(await value(), M.def, 'B its own card, at the default');
    const lb = await labels(page, mod);
    assert.notDeepEqual(lb, la);
    await relabel(page, mod, 'b-one');
    // A shown again: its own section, its plot as it was left, its state, results and history.
    await switchTab(page, 0);
    assert.equal(await page.evaluate(mod=> document.querySelector(`#tab-${mod}`).dataset.mark, mod), 'A', 'tab A\'s own section, shown again');
    assert.equal(await page.locator(M.plot + ' path[data-mark="A"]').count(), 1, 'its plot as it was left, not drawn again');
    assert.deepEqual(await moduleState(page, mod), A.state);
    M.same(await M.shows(page), A.shows);
    assert.deepEqual(await history(page, mod), A.h);
    // Undo in A undoes A's steps alone; B keeps its own.
    await undo(page); assert.deepEqual(await labels(page, mod), la);
    await undo(page); assert.equal(await value(), M.def);
    await switchTab(page, 1);
    assert.deepEqual(await labels(page, mod), ['b-one']);
    await undo(page); assert.deepEqual(await labels(page, mod), lb);
    await switchTab(page, 0);
    await undo(page, true); await undo(page, true);
    assert.deepEqual(await moduleState(page, mod), A.state, 'A\'s redo, after B\'s undo');
    M.same(await M.shows(page), A.shows);
    // A hidden: awake 9 minutes on, asleep at 11, its history parked, its instance let go.
    await switchTab(page, 1);
    await tick(page, 9*MIN);
    assert.deepEqual(await awake(page), [true, true], '9 minutes hidden: awake');
    await tick(page, 11*MIN);
    assert.deepEqual(await awake(page), [false, true], '11 minutes: asleep');
    assert.equal((await tabs(page))[0].history, true, 'its history parked with it');
    const cdp = await page.context().newCDPSession(page);
    for (let i = 0; i < 3; i++){ await cdp.send('HeapProfiler.collectGarbage'); await page.waitForTimeout(100); }
    assert.equal(await page.evaluate(()=> window.__root.deref() === undefined), true, 'its section collected');
    // Woken: its state, its results, its whole history; undone step by step to the empty
    // start, and redone to where it was.
    await switchTab(page, 0);
    assert.deepEqual(await awake(page), [true, true]);
    assert.deepEqual(await moduleState(page, mod), A.state);
    assert.deepEqual(await history(page, mod), A.h);
    M.same(await M.shows(page), A.shows);
    await undo(page); assert.deepEqual(await labels(page, mod), la);
    await undo(page); assert.equal(await value(), M.def);
    for (let i = A.h.index - 2; i > 0; i--) await undo(page);
    assert.deepEqual(await labels(page, mod), [], 'down to the empty start');
    assert.equal((await history(page, mod)).index, 0);
    for (let i = 0; i < A.h.index; i++) await undo(page, true);
    assert.deepEqual(await moduleState(page, mod), A.state, 'and up again');
    M.same(await M.shows(page), A.shows);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
