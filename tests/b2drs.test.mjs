/* UV-Vis DRS made per tab (b2): each DRS tab an instance of its own in one page. Two tabs
   awake at once, each its own files, cards, parameters, view and undo history; a switch to
   one awake only showing it (its own section, its plots as they were, not drawn again); a
   tab hidden past Settings' minutes asleep (tabs.js sleepTick: the time taken to be later),
   its instance let go (a WeakRef to its section emptied by a GC), woken with its state, its
   cards (an Urbach card added from the kinds' menu, in its layer) and its whole history,
   undone step by step to the empty start and redone. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { start, openModule, loadFiles, switchTab, settle, undo, moduleState, history } from './helpers.mjs';

let env;
before(async ()=>{ env = await start(); });
after(()=> env && env.close());

const tabs = page => page.evaluate(async ()=> (await import('./tabs.js')).tabsNow());
const awake = async page => (await tabs(page)).map(t=> t.awake);
const tick = (page, ms)=> page.evaluate(async ms=> (await import('./tabs.js')).sleepTick(Date.now() + ms), ms);
const MIN = 60000;
const labels = async page => (await moduleState(page, 'tauc')).files.map(f=> f.label);
async function relabel(page, i, v){ const l = page.locator(`#taucFileTableWrap .file-label[data-i="${i}"]`); await l.fill(v); await l.press('Enter'); await settle(page); }
const exponent = async (page, v)=>{ await page.selectOption('#an1A', v); await settle(page); };
const text = (page, sel)=> page.locator(sel).textContent();
/* A new DRS tab, and files dropped (a DragEvent), with no element handle kept: Playwright's
   setInputFiles keeps a hold on the input it filled, and a handle not disposed (openModule's
   waitForSelector) on its element, and so on its instance, which a tab asleep would then
   never let go. */
async function newTab(page){
  await page.click('#nav button[data-tab="home"]');
  await page.click('.home-card[data-go="tauc"]');
  await page.waitForFunction(()=> !!document.querySelector('#tab-tauc.active'));
  await settle(page);
}
async function drop(page, files){
  const n0 = await page.locator('#taucFileTableWrap tr.file-row').count();
  const list = files.map(f=> [path.basename(f), fs.readFileSync(f).toString('base64')]);
  await page.evaluate(list=>{
    const dt = new DataTransfer();
    for (const [name, b64] of list) dt.items.add(new File([Uint8Array.from(atob(b64), c=> c.charCodeAt(0))], name));
    document.querySelector('#taucDropzone').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  }, list);
  await page.waitForFunction(n=> document.querySelectorAll('#taucFileTableWrap tr.file-row').length >= n && !document.querySelector('.dz-loading'), n0 + files.length);
  await settle(page);
}

test('two DRS tabs awake at once: each its own files, cards and undo; a switch to one awake only shows it, its plots not drawn again', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    const [d1, d2] = env.fx.files.tauc;
    await openModule(page, 'tauc'); await loadFiles(page, 'tauc', [d1, d2]);
    await relabel(page, 0, 'a-one');
    await exponent(page, '2');
    const egA = await text(page, '#an1Eg');
    // (its section and a curve of its card's plot, marked: the same elements when it is shown again)
    await page.evaluate(()=>{ document.querySelector('#tab-tauc').dataset.mark = 'A'; document.querySelector('#an1Svg path').dataset.mark = 'A'; });
    await openModule(page, 'tauc'); await loadFiles(page, 'tauc', [d2]);
    assert.deepEqual(await awake(page), [true, true], 'both awake');
    assert.equal(await page.locator('#tab-tauc').count(), 1, 'one DRS section in the page, the one on show');
    assert.equal(await page.inputValue('#an1A'), '0.5', 'B its own card, at the default exponent');
    await relabel(page, 0, 'b-one');
    await switchTab(page, 0);
    assert.equal(await page.evaluate(()=> document.querySelector('#tab-tauc').dataset.mark), 'A', 'tab A\'s own section, shown again');
    assert.equal(await page.locator('#an1Svg path[data-mark="A"]').count(), 1, 'its plot as it was left, not drawn again');
    assert.deepEqual(await labels(page), ['a-one', 'drs2']);
    assert.equal(await page.inputValue('#an1A'), '2');
    assert.equal(await text(page, '#an1Eg'), egA);
    assert.deepEqual(await history(page, 'tauc'), { index: 4, n: 5 }, 'its history: start, files, their lines placed, label, exponent');
    // Undo in A undoes A's steps alone; B keeps its own.
    await undo(page); await undo(page);
    assert.deepEqual(await labels(page), ['drs1', 'drs2']);
    assert.equal(await page.inputValue('#an1A'), '0.5');
    await switchTab(page, 1);
    assert.deepEqual(await labels(page), ['b-one']);
    await undo(page);
    assert.deepEqual(await labels(page), ['drs2']);
    await switchTab(page, 0);
    await undo(page, true); await undo(page, true);
    assert.deepEqual(await labels(page), ['a-one', 'drs2'], 'A\'s redo, after B\'s undo');
    assert.equal(await text(page, '#an1Eg'), egA);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('a DRS tab asleep past Settings\' minutes, its instance let go; woken with its cards and its whole history', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await page.evaluate(async ()=>{ const u = await import('./utils.js'); Object.assign(u.settings, { sleepMin: 10, awakeMax: 7 }); });
    await newTab(page); await drop(page, env.fx.files.tauc);
    await relabel(page, 0, 'x');
    await exponent(page, '2');
    // An Urbach card, from the kinds' menu (in the instance's layer).
    await page.click('#taucAddAn');
    await page.click('.an-menu button[data-kind="urbach"]');
    await page.waitForFunction(()=> !!document.querySelector('#an2Eu')); await settle(page);
    await relabel(page, 1, 'y');
    const before = { state: await moduleState(page, 'tauc'), h: await history(page, 'tauc'), eg: await text(page, '#an1Eg'), eu: await text(page, '#an2Eu') };
    assert.notEqual(before.eu, '-');
    await page.evaluate(async ()=>{ window.__root = new WeakRef((await import('./tabs.js')).TABS[0].inst.root); });
    await openModule(page, 'tauc');
    await tick(page, 9*MIN);
    assert.deepEqual(await awake(page), [true, true], '9 minutes hidden: awake');
    await tick(page, 11*MIN);
    assert.deepEqual(await awake(page), [false, true], '11 minutes: asleep');
    assert.equal((await tabs(page))[0].history, true, 'its history parked with it');
    // Its instance let go: nothing holds its section once the page is collected.
    const cdp = await page.context().newCDPSession(page);
    for (let i = 0; i < 3; i++){ await cdp.send('HeapProfiler.collectGarbage'); await page.waitForTimeout(100); }
    assert.equal(await page.evaluate(()=> window.__root.deref() === undefined), true, 'its section collected');
    // Woken: its state, its cards and their results, its whole history.
    await switchTab(page, 0);
    assert.deepEqual(await awake(page), [true, true]);
    assert.deepEqual(await moduleState(page, 'tauc'), before.state);
    assert.deepEqual(await history(page, 'tauc'), before.h);
    assert.equal(await text(page, '#an1Eg'), before.eg);
    assert.equal(await text(page, '#an2Eu'), before.eu);
    assert.ok(await page.locator('#an2Svg path').count() > 0, 'the Urbach card drawn');
    // Undone step by step to the empty start, and redone to where it was.
    await undo(page); assert.deepEqual(await labels(page), ['x', 'drs2']);
    await undo(page); assert.equal(await page.locator('#an2Eu').count(), 0, 'the Urbach card undone');
    await undo(page); assert.equal(await page.inputValue('#an1A'), '0.5');
    await undo(page); assert.deepEqual(await labels(page), ['drs1', 'drs2']);
    // (the files, then their lines placed: two steps)
    await undo(page); await undo(page); assert.deepEqual(await labels(page), [], 'down to the empty start');
    assert.equal((await history(page, 'tauc')).index, 0);
    for (let i = 0; i < 6; i++) await undo(page, true);
    assert.deepEqual(await moduleState(page, 'tauc'), before.state, 'and up again');
    assert.equal(await text(page, '#an2Eu'), before.eu);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
