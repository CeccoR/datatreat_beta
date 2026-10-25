/* Undo and redo while a job runs: the history held from the job's start (utils.js
   UndoStack.hold). While a Rietveld refinement runs, Ctrl+Z goes over the steps taken
   meanwhile and stops at the state on show when it started, silently (no banner, no window,
   no alert: to v508 every undo and redo waited for the run's end, a banner saying so), the
   running card's panel as it was (its Cancel, its progress, its rows locked, the Settings
   read only); Ctrl+Y goes back up. Its results come in as a step of their own at its start,
   written into every state saved meanwhile: walking back from the end undoes the steps taken
   during the run (the results kept in each), then the results, then the steps before it. A
   run cancelled with a pattern done gives that step, one cancelled before any none; the
   standard's run the same, and the standard's then a sample's (Refine the standard first) a
   step each, in that order; a card closed during its run comes back by an undo with the
   patterns done, one switched to Scherrer keeps them; the 80-state limit crossed during a
   run; a saved project marked unsaved by the run's end, its results saved. Two runs at
   once: a redo branch set aside by the later one takes the earlier one's results, and one
   set aside under Refine the standard first comes back where neither wrote, one set aside
   before two runs held from one state goes with a result of either; a sample
   waiting for the standard's run has what its run takes locked as during it; the standard
   bearing a sample's name, a run's end adds no step. SEM: Ctrl+Z
   during a reading silent at its start, the files landing as one step, the list and the
   groups right. The workers' answers are held (window.__hold) so that a job runs as long
   as the test needs. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start, openModule, loadFiles, moduleState, history, settle, until, saveAs, activeLabel, idb, undo } from './helpers.mjs';
import { tif } from './fixtures.mjs';

let env;
before(async ()=>{ env = await start(); });
after(()=> env && env.close());

const P = '#xrdR2', S = '#xrdStdR';
/* The workers' answers held while window.__hold: a refinement's result (the Rietveld
   worker's), every answer of the SEM reader's (onmessage); __one() delivers the first held,
   __release() every one and holds no more. With window.__fail the next refinement's result
   comes as the worker's error. Before any worker is made. */
const holdWorkers = page => page.evaluate(()=>{
  // (a run's patterns one at a time, as these tests take them: the pool's lanes, rvpool.test.mjs)
  localStorage.setItem('datatreat-rv-lanes', '1');
  const W = window.Worker; window.__held = []; window.__hold = false; window.__fail = false;
  const wrap = fn => e=>{
    if (window.__fail && e.data && e.data.type === 'result'){ window.__fail = false; return fn({ data: { ...e.data, type: 'error', message: 'failed for the test' } }); }
    if (window.__hold && e.data && (e.data.type === 'result' || e.data.seq != null)) window.__held.push(()=> fn(e)); else fn(e); };
  window.Worker = class extends W {
    addEventListener(t, fn, o){ if (t !== 'message') return super.addEventListener(t, fn, o); const g = wrap(fn); (this.__m || (this.__m = new Map())).set(fn, g); return super.addEventListener(t, g, o); }
    removeEventListener(t, fn, o){ return super.removeEventListener(t, (t === 'message' && this.__m && this.__m.get(fn)) || fn, o); }
    set onmessage(fn){ super.onmessage = fn && wrap(fn); }
    get onmessage(){ return super.onmessage; }
  };
  window.__one = ()=>{ const f = window.__held.shift(); if (f) f(); return !!f; };
  window.__release = ()=>{ window.__hold = false; window.__held.splice(0).forEach(f=> f()); };
});
const held = page => until(()=> page.evaluate(()=> window.__held.length), { timeout: 120000, what: 'the worker\'s answer' });
// Nothing said: no banner, no window over the page, no alert (dialogs counted per page).
const said = page => page.evaluate(()=> document.querySelectorAll('.pwa-confirm.show, .confirm-modal').length);
const label = (page, p = P)=> page.textContent(p + 'Refine');
const running = (page, p = P)=> page.waitForFunction(s=> document.querySelector(s).textContent === 'Cancel', p + 'Refine');
const idle = (page, p = P)=> page.waitForFunction(s=> document.querySelector(s).textContent === 'Refine', p + 'Refine', { timeout: 120000 });
// (a press within 600 ms of the last, or of Refine turning to Cancel or back, is not taken)
const press = async (page, sel)=>{ await page.waitForTimeout(650); await page.click(sel); };
// Refine or Refine all with no refined standard: asked, refined without it.
async function refine(page, all){
  await press(page, P + (all ? 'RefineAll' : 'Refine'));
  await page.waitForSelector('.confirm-modal');
  await page.click('.confirm-modal .btn:not(.primary)');
  await running(page);
}
const rvOf = (s, id = 2)=> ((s.cards.find(c=> c.id === id) || {}).states || {}).rietveld || {};
const resOf = (s, id = 2)=> Object.keys(rvOf(s, id).results || {});
const look = async page =>{ const s = await moduleState(page, 'xrd');
  return { fold: s.cards.find(c=> c.id === 1).collapsed, labels: s.files.map(f=> f.label), colors: s.files.map(f=> f.color), start: rvOf(s).start, results: resOf(s) }; };
const fold1 = async page =>{ await page.click('#xrdAnalyses .an-card[data-an="1"] .an-fold'); await settle(page); };
async function relabel(page, i, v, mod = 'xrd'){ const l = page.locator(`#${mod}FileTableWrap .file-label[data-i="${i}"]`); await l.fill(v); await l.press('Enter'); await settle(page); }
// Every state of the history: the standard's results and card 2's (its kind's initial, '-' with no card 2).
const states = page => page.evaluate(async ()=>{ const u = await import('./utils.js'), h = u.getModuleHistory('xrd');
  return { index: h.index, n: h.states.length, of: h.states.map(s=>{ const c = s.cards.find(c=> c.id === 2);
    return Object.keys((s.stdRv || {}).results || {}).join(',') + '|' + (c ? c.type[0] + ':' + Object.keys(((c.states || {}).rietveld || {}).results || {}).join(',') : '-'); }) }; });
async function setup(page, n = 2){
  await holdWorkers(page);
  await openModule(page, 'xrd');
  await loadFiles(page, 'xrd', env.fx.files.xrd.slice(0, n));
  await page.setInputFiles(P + 'CifInput', env.fx.cif);
  await page.waitForSelector(P + 'PhaseList input[data-on]');
  await settle(page);
}
async function loadStd(page){
  await page.click(P + 'Std');
  await page.waitForSelector('#xrdStdRv', { state: 'visible' });
  await page.setInputFiles('#xrdStdRvFiles', env.fx.std);
  await page.waitForFunction(()=> /s11/.test(document.querySelector('#xrdStdRv .xrd-std-file').textContent));
  await page.keyboard.press('Escape');
  await page.waitForSelector('#xrdStdRv', { state: 'hidden' });
  await settle(page);
}
// The running panel: its Refine (Cancel), its progress, its rows locked, the same elements.
const panel = (page, p = P)=> page.evaluate(p=>{ const b = document.querySelector(p + 'Refine');
  return { label: b.textContent, same: b.__mark === 1, prog: document.querySelector(p + 'ProgWrap').style.display !== 'none',
    locked: [...document.querySelectorAll(p + 'PhaseList [data-del]:not([data-built]), ' + p + 'PhaseList [data-on], ' + p + 'PhaseList [data-pick]')].every(c=> c.classList.contains('is-locked')) }; }, p);
const markPanel = (page, p = P)=> page.evaluate(p=>{ document.querySelector(p + 'Refine').__mark = 1; }, p);

test('a run: undo goes down to its start, silently, the panel as it was; its results a step of their own there', async ()=>{
  const { page, errors, close } = await env.page();
  let dialogs = 0; page.on('dialog', ()=> dialogs++);
  try {
    await setup(page);
    // Steps before the run: a Rietveld setting, the Scherrer card folded, a label.
    await page.click(P + 'Settings');
    await page.click('.modal-backdrop[style*="flex"] [data-start="last"]');
    await page.click('.modal-backdrop[style*="flex"] [data-done]');
    await settle(page);
    const s0 = await look(page);
    await fold1(page);
    const s1 = await look(page);
    await relabel(page, 1, 'two');
    const s2 = await look(page);
    assert.deepEqual([s0.start, s1.fold, s2.labels], ['last', true, ['s00', 'two']]);
    await page.evaluate(()=>{ window.__hold = true; });
    await refine(page);
    await markPanel(page);
    // Steps during it: the other card unfolded, a label, a file's colour.
    await fold1(page);
    const d1 = await look(page);
    await relabel(page, 0, 'one');
    const d2 = await look(page);
    await page.click('#xrdFileTableWrap .color-swatch[data-i="1"]');
    await page.click('.cp-popup .cp-preset >> nth=3');
    await page.click('#xrdFileTableWrap thead th:nth-child(4)');   // (the picker closed)
    await settle(page);
    const d3 = await look(page);
    assert.notEqual(d3.colors[1], d2.colors[1], 'the colour changed');
    // The Settings open, read only.
    await page.click(P + 'Settings');
    const setBox = '.modal-backdrop[style*="flex"] .rvs-box';
    await page.waitForSelector(setBox + ' [data-row]');
    await page.evaluate(b=>{ document.querySelector(b + ' .rvs-sec').__mark = 1; }, setBox);
    const readOnly = ()=> page.evaluate(b=>{ const m = document.querySelector(b);
      return !!m && !m.querySelector('.rvs-busy').hidden && m.querySelector('.rvs-sec').__mark === 1 && [...m.querySelectorAll('input, select')].every(c=> c.disabled); }, setBox);
    assert.ok(await readOnly(), 'the Settings read only');
    // Ctrl+Z: the three steps taken during the run, one by one, then nothing.
    for (const want of [d2, d1, s2]){ await undo(page); assert.deepEqual(await look(page), want); }
    const atStart = await moduleState(page, 'xrd');
    for (let i = 0; i < 2; i++){
      await undo(page);
      assert.deepEqual(await moduleState(page, 'xrd'), atStart, 'nothing undone below the run\'s start');
      assert.equal(await page.$eval('#xrdAnalyses .an-card[data-an="1"]', c=> c.classList.contains('is-folded')), true, 'the card folded as the state has it');
    }
    assert.equal(await said(page), 0, 'nothing said'); assert.equal(dialogs, 0, 'no alert');
    assert.deepEqual(await panel(page), { label: 'Cancel', same: true, prog: true, locked: true }, 'the run\'s panel as it was');
    assert.ok(await readOnly(), 'the Settings still open, read only, not built again');
    // Ctrl+Y: back up, then nothing.
    for (const want of [d1, d2, d3, d3]){ await undo(page, true); assert.deepEqual(await look(page), want); }
    await page.keyboard.press('Escape');
    assert.deepEqual(await panel(page), { label: 'Cancel', same: true, prog: true, locked: true });
    // Its result: written, at once a step after the run's start.
    await held(page);
    await page.evaluate(()=> window.__release());
    await idle(page);
    await settle(page);
    const end = await look(page);
    assert.deepEqual(end, { ...d3, results: ['s00.xrdml'] });
    // Walked back: the steps during the run (the result kept in each), the result, then
    // the steps before it; and up again to the end.
    for (const want of [{ ...d2, results: end.results }, { ...d1, results: end.results }, { ...s2, results: end.results }, s2, s1, s0]){
      await undo(page); assert.deepEqual(await look(page), want); }
    for (let i = 0; i < 6; i++) await undo(page, true);
    assert.deepEqual(await look(page), end);
    assert.equal(await said(page), 0); assert.equal(dialogs, 0);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('Refine all with steps between its patterns: no state holds a part of its results; the live ones kept through an undo', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await setup(page, 3);
    const h0 = await states(page);
    await page.evaluate(()=>{ window.__hold = true; });
    await refine(page, true);
    await held(page); await page.evaluate(()=> window.__one());
    await until(async ()=> resOf(await moduleState(page, 'xrd')).length === 1, { what: 'the first pattern' });
    await fold1(page);
    // Undone to the run's start, the first pattern stays in the card (the run's own).
    await undo(page);
    assert.deepEqual([(await look(page)).fold, (await look(page)).results], [false, ['s00.xrdml']]);
    await undo(page, true);
    await held(page); await page.evaluate(()=> window.__one());
    await until(async ()=> resOf(await moduleState(page, 'xrd')).length === 2, { what: 'the second pattern' });
    await relabel(page, 0, 'one');
    await held(page); await page.evaluate(()=> window.__release());
    await idle(page);
    await settle(page);
    const all = 's00.xrdml,s01.xrdml,s02.xrdml', h = await states(page);
    // The run's start, its step, the fold, the label: every state the whole run or none of it.
    assert.deepEqual(h.of.slice(h0.index), ['|r:', '|r:' + all, '|r:' + all, '|r:' + all]);
    assert.deepEqual([h.index, h.n], [h0.index + 3, h0.index + 4]);
    assert.ok(h.of.every(x=> x === '|r:' || x === '|r:' + all), 'no state with a part of the run');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('a run cancelled: one pattern done is its step, the saved project marked unsaved; none done, no step', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await setup(page, 3);
    await saveAs(page, 'Run');
    assert.equal(await activeLabel(page), 'XRPD · Run');
    const h0 = await states(page);
    await page.evaluate(()=>{ window.__hold = true; });
    await refine(page, true);
    await held(page); await page.evaluate(()=> window.__one());
    await until(async ()=> resOf(await moduleState(page, 'xrd')).length === 1, { what: 'the first pattern' });
    assert.equal(await activeLabel(page), 'XRPD · Run', 'saved while it runs: nothing changed yet in the history');
    await press(page, P + 'Refine');   // (Cancel)
    await idle(page);
    await settle(page);
    await page.evaluate(()=>{ window.__held.length = 0; });
    let h = await states(page);
    assert.deepEqual([h.index, h.n], [h0.index + 1, h0.n + 1], 'one step');
    assert.deepEqual(h.of.slice(h0.index), ['|r:', '|r:s00.xrdml']);
    assert.equal(await activeLabel(page), 'XRPD · Run*', 'unsaved by the run\'s end');
    await page.click('.proj-save');
    await page.waitForSelector('.proj-save.is-saved');
    const rec = (await idb(page)).find(r=> r.title === 'Run');
    assert.deepEqual(resOf(rec.state), ['s00.xrdml'], 'saved with its result');
    // Another, cancelled before any pattern: no step, the project still saved.
    const s1 = await moduleState(page, 'xrd');
    await refine(page, true);
    await press(page, P + 'Refine');
    await idle(page);
    await settle(page);
    h = await states(page);
    assert.deepEqual([h.index, h.n], [h0.index + 1, h0.n + 1], 'no step');
    assert.deepEqual(await moduleState(page, 'xrd'), s1);
    assert.equal(await activeLabel(page), 'XRPD · Run');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('the standard\'s run: undo stops at its start, its window\'s panel as it was; then Refine the standard first, a step each in order', async ()=>{
  const { page, errors, close } = await env.page();
  let dialogs = 0; page.on('dialog', ()=> dialogs++);
  try {
    await setup(page);
    await loadStd(page);
    const h0 = await states(page);
    await page.evaluate(()=>{ window.__hold = true; });
    await page.click(P + 'Std');
    await page.waitForSelector('#xrdStdRv', { state: 'visible' });
    await page.click(S + 'Refine');
    await running(page, S);
    await markPanel(page, S);
    await page.keyboard.press('Escape');
    await page.waitForSelector('#xrdStdRv', { state: 'hidden' });
    await fold1(page);
    await relabel(page, 0, 'one');
    // The window open again; Ctrl+Z: the label, the fold, then nothing.
    await page.click(P + 'Std');
    await page.waitForSelector('#xrdStdRv', { state: 'visible' });
    await undo(page);
    assert.deepEqual((await look(page)).labels, ['s00', 's01']);
    await undo(page);
    const atStart = await moduleState(page, 'xrd');
    assert.equal(atStart.cards[0].collapsed, false);
    await undo(page);
    assert.deepEqual(await moduleState(page, 'xrd'), atStart, 'nothing undone below the run\'s start');
    assert.equal(await page.locator('.pwa-confirm.show').count(), 0); assert.equal(dialogs, 0);
    assert.ok(await page.isVisible('#xrdStdRv'), 'its window still open');
    assert.deepEqual(await panel(page, S), { label: 'Cancel', same: true, prog: true, locked: true });
    await page.keyboard.press('Escape');
    await undo(page, true); await undo(page, true);
    assert.deepEqual((await look(page)).labels, ['one', 's01']);
    await held(page); await page.evaluate(()=> window.__release());
    await idle(page, S);
    await settle(page);
    let h = await states(page);
    assert.deepEqual(h.of.slice(h0.index), ['|r:', 's11.xrdml|r:', 's11.xrdml|r:', 's11.xrdml|r:'], 'its step at its start, the steps after it with it');
    // Cancelled before its result: no step.
    await page.evaluate(()=>{ window.__hold = true; });
    await page.click(P + 'Std');
    await page.waitForSelector('#xrdStdRv', { state: 'visible' });
    await press(page, S + 'Refine');
    await running(page, S);
    await press(page, S + 'Refine');
    await idle(page, S);
    await page.keyboard.press('Escape');
    await settle(page);
    await page.evaluate(()=>{ window.__held.length = 0; });
    assert.deepEqual(await states(page), h, 'no step');
    // Refine the standard first: the standard's run, the sample waiting; a step taken
    // meanwhile undone and redone; the standard's step, then the sample's.
    await page.click(P + 'Std');
    await page.waitForSelector('#xrdStdRv', { state: 'visible' });
    await press(page, S + 'Clear');
    await page.keyboard.press('Escape');
    await page.waitForSelector('#xrdStdRv', { state: 'hidden' });
    await settle(page);
    const h1 = await states(page);
    await press(page, P + 'Refine');
    await page.waitForSelector('.confirm-modal');
    await page.click('.confirm-modal .btn.primary');
    await running(page, S); await running(page);
    await fold1(page);
    await undo(page); await undo(page);
    assert.equal((await moduleState(page, 'xrd')).cards[0].collapsed, true, 'stopped at the run\'s start');
    assert.equal(await page.locator('.pwa-confirm.show').count(), 0); assert.equal(dialogs, 0);
    await undo(page, true);
    await held(page); await page.evaluate(()=> window.__one());
    await idle(page, S);
    await held(page); await page.evaluate(()=> window.__release());
    await idle(page);
    await settle(page);
    h = await states(page);
    assert.deepEqual(h.of.slice(h1.index), ['|r:', 's11.xrdml|r:', 's11.xrdml|r:s00.xrdml', 's11.xrdml|r:s00.xrdml']);
    assert.deepEqual([h.index, h.n], [h1.index + 3, h1.index + 4]);
    assert.equal((await moduleState(page, 'xrd')).cards[0].collapsed, false, 'the step taken meanwhile last');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('a card closed during its run comes back by an undo with the patterns done; one switched keeps them', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await setup(page, 3);
    const h0 = await states(page);
    await page.evaluate(()=>{ window.__hold = true; });
    await refine(page, true);
    await held(page); await page.evaluate(()=> window.__one());
    await until(async ()=> resOf(await moduleState(page, 'xrd')).length === 1, { what: 'the first pattern' });
    await page.click('#xrdAnalyses .an-card[data-an="2"] .an-close');
    await settle(page);
    await page.evaluate(()=>{ window.__held.length = 0; });
    assert.equal(await page.evaluate(async ()=> (await import('./utils.js')).moduleBusy('xrd')), null, 'its run ended');
    let h = await states(page);
    assert.deepEqual(h.of.slice(h0.index), ['|r:', '|r:s00.xrdml', '|-'], 'the pattern done a step, then the close');
    await undo(page);
    await page.waitForSelector(P + 'Refine');
    const first = rvOf(await moduleState(page, 'xrd')).results['s00.xrdml'];
    assert.ok(first && first.params, 'back with the pattern done');
    assert.equal(await label(page), 'Refine');
    // Refined again, switched to Scherrer during its run: the pattern done in its Rietveld settings.
    await page.evaluate(()=>{ window.__hold = true; });
    await refine(page, true);
    await held(page); await page.evaluate(()=> window.__one());
    await until(async ()=> rvOf(await moduleState(page, 'xrd')).results['s00.xrdml'].at !== first.at, { what: 'the first pattern again' });
    await page.click('#xrdAnalyses .an-card[data-an="2"] .an-type');
    await page.click('.an-menu:not([hidden]) [data-kind="scherrer"]');
    await settle(page);
    await page.evaluate(()=>{ window.__held.length = 0; });
    h = await states(page);
    assert.deepEqual(h.of.slice(h.index - 2), ['|r:s00.xrdml', '|r:s00.xrdml', '|s:s00.xrdml'], 'the run\'s step, then the switch, which keeps it');
    await undo(page);
    await page.waitForSelector(P + 'Refine');
    assert.notEqual(rvOf(await moduleState(page, 'xrd')).results['s00.xrdml'].at, first.at, 'the switch undone: the new result');
    await undo(page);
    assert.equal(rvOf(await moduleState(page, 'xrd')).results['s00.xrdml'].at, first.at, 'its step undone: the first');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('the 80-state limit crossed during a run: undo to the oldest state kept, the results in every state', async ()=>{
  const { page, errors, close } = await env.page();
  let dialogs = 0; page.on('dialog', ()=> dialogs++);
  try {
    await setup(page);
    await page.evaluate(()=>{ window.__hold = true; });
    await refine(page);
    await page.evaluate(()=>{ const b = document.querySelector('#xrdAnalyses .an-card[data-an="1"] .an-fold'); for (let i = 0; i < 85; i++) b.click(); });
    await settle(page);
    assert.deepEqual(await history(page, 'xrd'), { index: 79, n: 80 });
    await page.evaluate(()=> document.activeElement && document.activeElement.blur());
    for (let i = 0; i < 82; i++) await page.keyboard.press('Control+z');
    await settle(page);
    assert.deepEqual(await history(page, 'xrd'), { index: 0, n: 80 }, 'down to the oldest state kept');
    assert.equal(await said(page), 0); assert.equal(dialogs, 0);
    assert.equal(await label(page), 'Cancel');
    for (let i = 0; i < 82; i++) await page.keyboard.press('Control+y');
    await settle(page);
    await held(page); await page.evaluate(()=> window.__release());
    await idle(page);
    await settle(page);
    const h = await states(page);
    assert.deepEqual([h.index, h.n], [79, 80], 'no step of its own: its start is gone');
    assert.deepEqual([...new Set(h.of)], ['|r:s00.xrdml'], 'the result in every state');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('two sample cards refining at once: the redo branch the later one set aside takes the earlier one\'s result', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await setup(page);
    // A second Rietveld card, with the CIF.
    await page.click('#xrdAddAn');
    await page.click('.an-menu:not([hidden]) [data-kind="rietveld"]');
    await page.waitForSelector('#xrdR3CifInput', { state: 'attached' });
    await page.setInputFiles('#xrdR3CifInput', env.fx.cif);
    await page.waitForSelector('#xrdR3PhaseList input[data-on]');
    await settle(page);
    const h0 = await states(page);
    await page.evaluate(()=>{ window.__hold = true; });
    await refine(page);
    await held(page);
    // Card 2 running: two steps, the second undone (a redo branch), then card 3 refines.
    await fold1(page);
    await relabel(page, 1, 'two');
    await undo(page);
    await press(page, '#xrdR3Refine');
    await page.waitForSelector('.confirm-modal');
    await page.click('.confirm-modal .btn:not(.primary)');
    await running(page, '#xrdR3');
    // Card 2's result (the first held): its run ends; card 3's stopped before its own.
    await page.evaluate(()=> window.__one());
    await idle(page);
    assert.equal(await label(page, '#xrdR3'), 'Cancel');
    await press(page, '#xrdR3Refine');
    await idle(page, '#xrdR3');
    await settle(page);
    await page.evaluate(()=>{ window.__held.length = 0; });
    const h = await states(page);
    assert.deepEqual(h.of.slice(h0.index), ['|r:', '|r:s00.xrdml', '|r:s00.xrdml', '|r:s00.xrdml'], 'the result in the branch given back too');
    assert.deepEqual([h.index, h.n], [h0.index + 2, h0.index + 4]);
    // Redone: the label, card 2's result kept.
    await undo(page, true);
    const l = await look(page);
    assert.deepEqual([l.fold, l.labels, l.results], [true, ['s00', 'two'], ['s00.xrdml']]);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('two sample cards held from one state, a redo branch there: a result of either drops it, in either order', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await setup(page);
    await page.click('#xrdAddAn');
    await page.click('.an-menu:not([hidden]) [data-kind="rietveld"]');
    await page.waitForSelector('#xrdR3CifInput', { state: 'attached' });
    await page.setInputFiles('#xrdR3CifInput', env.fx.cif);
    await page.waitForSelector('#xrdR3PhaseList input[data-on]');
    await settle(page);
    const both = async ()=>{
      await refine(page);
      await held(page);
      await press(page, '#xrdR3Refine');
      await page.waitForSelector('.confirm-modal');
      await page.click('.confirm-modal .btn:not(.primary)');
      await running(page, '#xrdR3');
      await until(()=> page.evaluate(()=> window.__held.length >= 2), { timeout: 120000, what: 'card 3\'s answer' });
    };
    for (const card3first of [true, false]){
      const what = card3first ? 'card 3\'s result, then card 2 stopped' : 'card 2 stopped, then card 3\'s result';
      await fold1(page);
      await undo(page);
      const h0 = await states(page);
      assert.equal(h0.n, h0.index + 2, what + ': a redo branch');
      await page.evaluate(()=>{ window.__hold = true; });
      await both();
      const card3 = async ()=>{ await page.evaluate(()=> window.__held.pop()()); await idle(page, '#xrdR3'); };
      const stop2 = async ()=>{ await press(page, P + 'Refine'); await idle(page); };
      if (card3first){ await card3(); await stop2(); } else { await stop2(); await card3(); }
      await settle(page);
      await page.evaluate(()=>{ window.__held.length = 0; window.__hold = false; });
      const h = await states(page);
      assert.deepEqual([h.index, h.n], [h0.index + 1, h0.index + 2], what + ': card 3\'s step, the branch gone');
      assert.deepEqual(resOf(await moduleState(page, 'xrd'), 3), ['s00.xrdml'], what + ': card 3\'s result');
      await undo(page, true);
      assert.equal((await look(page)).fold, false, what + ': nothing to redo');
    }
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('Refine the standard first stopped or failed before any result: the redo branch there comes back', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await setup(page);
    await loadStd(page);
    await fold1(page);
    await undo(page);
    const h0 = await states(page), s0 = await moduleState(page, 'xrd');
    assert.equal(h0.n, h0.index + 2, 'a redo branch');
    // Stopped while the standard refines for the sample.
    await page.evaluate(()=>{ window.__hold = true; });
    await press(page, P + 'Refine');
    await page.waitForSelector('.confirm-modal');
    await page.click('.confirm-modal .btn.primary');
    await running(page, S); await running(page);
    await held(page);
    await press(page, P + 'Refine');   // (Cancel: the standard's run with it)
    await idle(page, S); await idle(page);
    await settle(page);
    await page.evaluate(()=>{ window.__held.length = 0; window.__hold = false; });
    assert.match(await page.textContent(P + 'Status'), /^Stopped, the standard's refinement with it/);
    assert.deepEqual(await states(page), h0, 'the history as it was');
    assert.deepEqual(await moduleState(page, 'xrd'), s0);
    await undo(page, true);
    assert.equal((await look(page)).fold, true, 'redone');
    await undo(page);
    // The standard's run failing.
    await page.evaluate(()=>{ window.__fail = true; });
    await press(page, P + 'Refine');
    await page.waitForSelector('.confirm-modal');
    await page.click('.confirm-modal .btn.primary');
    await page.waitForFunction(p=> /failed/.test(document.querySelector(p + 'Status').textContent), P, { timeout: 120000 });
    await idle(page, S); await idle(page);
    await settle(page);
    assert.deepEqual(await states(page), h0, 'the history as it was');
    await undo(page, true);
    assert.equal((await look(page)).fold, true, 'redone');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('a sample waiting for the standard\'s run: what its run takes locked from its Refine; an undo during its run leaves the card and the state on show alike', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await setup(page);
    await loadStd(page);
    const h0 = await states(page);
    // Card 2's inputs as the card and as the state on show have them, alike or not.
    const alike = ()=> page.evaluate(async ()=>{ const u = await import('./utils.js'), h = u.getModuleHistory('xrd');
      const k = s =>{ const r = ((s.cards.find(c=> c.id === 2) || {}).states || {}).rietveld || {}; return JSON.stringify([r.phases, r.start, r.hold, r.fit]); };
      return k(u.getModuleState('xrd')) === k(h.states[h.index]); });
    await page.evaluate(()=>{ window.__hold = true; });
    await press(page, P + 'Refine');
    await page.waitForSelector('.confirm-modal');
    await page.click('.confirm-modal .btn.primary');
    await running(page, S); await running(page);
    await held(page);
    // Waiting: the rows locked, + CIF and Clear off, the Settings read only, a click on
    // them changing nothing.
    const p0 = await panel(page);
    assert.deepEqual([p0.label, p0.locked], ['Cancel', true]);
    assert.equal(await page.getAttribute(P + 'AddCif', 'aria-disabled'), 'true');
    assert.equal(await page.isDisabled(P + 'Clear'), true);
    await page.click(P + 'Settings');
    const setBox = '.modal-backdrop[style*="flex"] .rvs-box';
    await page.waitForSelector(setBox + ' [data-row]');
    assert.equal(await page.evaluate(b=>{ const m = document.querySelector(b);
      return !m.querySelector('.rvs-busy').hidden && [...m.querySelectorAll('input, select, [data-start], [data-fit-def]')].every(c=> c.disabled); }, setBox), true, 'the Settings read only');
    await page.click(setBox + ' [data-start="last"]', { force: true });
    await page.click('.modal-backdrop[style*="flex"] [data-done]');
    await settle(page);
    assert.deepEqual(await states(page), h0, 'no step');
    assert.equal(rvOf(await moduleState(page, 'xrd')).start, 'cif');
    // A step taken meanwhile; the standard's result; the sample's run, the step undone.
    await fold1(page);
    await page.evaluate(()=> window.__one());
    await idle(page, S);
    await running(page);
    await held(page);
    await undo(page);
    assert.equal((await look(page)).fold, false);
    assert.equal(await alike(), true, 'the card as the state on show');
    await undo(page);
    assert.equal((await look(page)).fold, false, 'stopped at its start');
    assert.equal(await said(page), 0);
    await undo(page, true);
    assert.equal(await alike(), true);
    await page.evaluate(()=> window.__release());
    await idle(page);
    await settle(page);
    const h = await states(page);
    assert.deepEqual(h.of.slice(h0.index), ['|r:', 's11.xrdml|r:', 's11.xrdml|r:s00.xrdml', 's11.xrdml|r:s00.xrdml'], 'no step at the end');
    assert.deepEqual([h.index, h.n], [h0.index + 3, h0.index + 4]);
    // Ended: free again.
    assert.equal(await page.getAttribute(P + 'AddCif', 'aria-disabled'), 'false');
    assert.equal((await panel(page)).locked, false);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('the standard bearing a sample\'s name: a run ends in one step', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await holdWorkers(page);
    await openModule(page, 'xrd');
    await loadFiles(page, 'xrd', [env.fx.files.xrd[0], env.fx.std]);
    await page.setInputFiles(P + 'CifInput', env.fx.cif);
    await page.waitForSelector(P + 'PhaseList input[data-on]');
    await settle(page);
    await loadStd(page);
    const h0 = await states(page);
    await refine(page, true);
    await idle(page);
    await settle(page);
    const h = await states(page);
    assert.deepEqual(h.of.slice(h0.index), ['|r:', '|r:s00.xrdml,s11.xrdml'], 'one step, nothing after it');
    assert.deepEqual([h.index, h.n], [h0.index + 1, h0.index + 2]);
    await undo(page);
    assert.deepEqual((await look(page)).results, []);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('SEM: Ctrl+Z during a reading stops silently at its start; the files land, one step, the list and the groups right', async ()=>{
  const { page, errors, close } = await env.page();
  let dialogs = 0; page.on('dialog', ()=> dialogs++);
  try {
    await holdWorkers(page);
    await openModule(page, 'sem');
    await loadFiles(page, 'sem', [tif('a.tif', { sign: 'A', seed: 1, pixelNm: 25, mag: 5000 })]);
    await relabel(page, 0, 'A1', 'sem');
    const labels = async ()=> (await moduleState(page, 'sem')).files.map(f=> f.label);
    const groups = ()=> page.evaluate(()=> [...document.querySelectorAll('#semGroups .sem-group')].filter(g=> g.getClientRects().length)
      .map(g=> g.querySelector('.sem-group-name').value + ' {' + [...g.querySelectorAll('.sem-gimg .sem-thumb-cap')].map(c=> c.textContent).join(',') + '}'));
    const key = async k =>{ await page.evaluate(()=> document.activeElement && document.activeElement.blur()); await page.keyboard.press(k); await page.evaluate(()=> new Promise(r=> requestAnimationFrame(()=> requestAnimationFrame(r)))); };
    await page.evaluate(()=>{ window.__hold = true; });
    await page.setInputFiles('#semFiles', [tif('b.tif', { sign: 'B', seed: 2, pixelNm: 25, mag: 5000 }), tif('c.tif', { sign: 'C', seed: 3, pixelNm: 100, mag: 1250 })]);
    await held(page);
    assert.equal(await page.evaluate(async ()=> (await import('./utils.js')).moduleBusy('sem')), 'The reading of SEM files');
    const lab = page.locator('#semFileTableWrap .file-label[data-i="0"]');
    await lab.fill('A2'); await lab.press('Enter');
    assert.deepEqual(await labels(), ['A2']);
    await key('Control+z');
    assert.deepEqual(await labels(), ['A1'], 'the step taken during the reading undone');
    const atStart = await moduleState(page, 'sem');
    await key('Control+z');
    assert.deepEqual(await moduleState(page, 'sem'), atStart, 'nothing undone below its start');
    assert.equal(await said(page), 0); assert.equal(dialogs, 0);
    assert.ok(await page.isVisible('#semDropzone.dz-loading'), 'still reading');
    await key('Control+y');
    assert.deepEqual(await labels(), ['A2'], 'redone');
    await page.evaluate(()=> window.__release());
    await page.waitForFunction(()=> document.querySelectorAll('#semFileTableWrap tr.file-row').length === 3 && !document.querySelector('.dz-loading'), null, { timeout: 20000 });
    await page.waitForFunction(()=> document.querySelectorAll('#semThumbs .sem-thumb').length === 3, null, { timeout: 20000 });
    await settle(page);
    assert.deepEqual(await labels(), ['A2', 'B', 'C'], 'the files landed after it');
    assert.deepEqual(await groups(), ['1.25 kx {C}', '5.00 kx {A2,B}']);
    assert.equal(await page.evaluate(async ()=> (await import('./utils.js')).moduleBusy('sem')), null);
    // One step: undone, the files go; then the label.
    await undo(page);
    assert.deepEqual(await labels(), ['A2']);
    await undo(page);
    assert.deepEqual(await labels(), ['A1']);
    await undo(page, true); await undo(page, true);
    assert.deepEqual(await labels(), ['A2', 'B', 'C']);
    assert.deepEqual(await groups(), ['1.25 kx {C}', '5.00 kx {A2,B}']);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
