/* SEM made per tab (v518): each SEM tab an instance of its own, awake while it is shown or
   was lately, in one page. Two tabs awake at once, each its own files, view and undo
   history, a switch to one awake only showing it (the same section, nothing restored); a
   file in both one array of bytes, and one reading worker for both; a reading going on in
   a tab left, nothing asked, its files landing in its own list as one step, its record
   and its "*", its tab awake till then and its time hidden counted from its end; a tab
   hidden letting go of the editor's image at once (made again as it is shown) and of
   nothing else till it sleeps;
   asleep past Settings' minutes, woken with its whole history. A tab asleep lets go of its
   files' bytes once the store holds them (WeakRefs emptied by a GC; a file shared with a
   tab awake kept; not while the tabs' records are being written), its record holding its
   history's files from the sweep; woken from the store with its state, history,
   thumbnails, editor and figure, an undo bringing back a file only
   its history held; one read for two wakes asked, a wake left or closed meanwhile given up,
   no key reaching another tab under the loader; files no longer stored lost and said, the
   rest of the tab as it was; a tab asleep closed hidden with Save, saved with its files,
   reopened from Projects; Projects' CSV of its project while it sleeps; a reload bringing
   the tabs not on show back without their bytes, read as they wake.
   The worker's answers held where a reading must go on (window.__hold); the bytes store's
   reads held where a wake must wait (window.__holdTx). */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { start, openModule, loadFiles, switchTab, settle, undo, moduleState, history, idb, banner, answer, until, tabLabels,
         saveAs, download, readZip, openProject, ready } from './helpers.mjs';
import { tif } from './fixtures.mjs';

let env;
before(async ()=>{ env = await start(); });
after(()=> env && env.close());

// The shell's tabs (tabs.js tabsNow), and its rules run as if `ms` had passed.
const tabs = page => page.evaluate(async ()=> (await import('./tabs.js')).tabsNow());
const awake = async page => (await tabs(page)).map(t=> t.awake);
const tick = (page, ms)=> page.evaluate(async ms=> (await import('./tabs.js')).sleepTick(Date.now() + ms), ms);
const MIN = 60000;
const labels = async page => (await moduleState(page, 'sem')).files.map(f=> f.label);
async function relabel(page, i, v){ const l = page.locator(`#semFileTableWrap .file-label[data-i="${i}"]`); await l.fill(v); await l.press('Enter'); await settle(page); }
const thumbs = (page, n)=> page.waitForFunction(n=> document.querySelectorAll('#semThumbs .sem-thumb canvas').length === n, n);
// (a: 16 bits, its image a view of its bytes; b, c: 8 bits, a copy)
const A = ()=> tif('a.tif', { sign: 'A', seed: 1, pixelNm: 25, mag: 5000, bits: 16 });
const B = ()=> tif('b.tif', { sign: 'B', seed: 2, pixelNm: 25, mag: 5000 });
const C = ()=> tif('c.tif', { sign: 'C', seed: 3, pixelNm: 100, mag: 1250 });
const sha = b => createHash('sha256').update(b).digest('hex');
// The reading worker's answers held while __hold, delivered by __release(); the workers made counted.
const holdWorkers = page => page.evaluate(()=>{
  const W = window.Worker; window.__held = []; window.__hold = false; window.__made = 0;
  const wrap = fn => e=>{ if (window.__hold && e.data && e.data.seq != null) window.__held.push(()=> fn(e)); else fn(e); };
  window.Worker = class extends W {
    constructor(...a){ super(...a); window.__made++; }
    set onmessage(fn){ super.onmessage = fn && wrap(fn); }
    get onmessage(){ return super.onmessage; }
  };
  window.__release = ()=>{ window.__hold = false; window.__held.splice(0).forEach(f=> f()); };
});
/* A new SEM tab and files dropped on it (a DragEvent), with no element handle kept:
   Playwright's setInputFiles keeps a hold on the input it filled, and openModule's
   waitForSelector a handle to the section, either holding its instance and its files'
   bytes, which a tab asleep would then never let go. */
async function newTab(page){
  await page.click('#nav button[data-tab="home"]');
  await page.click('.home-card[data-go="sem"]');
  await page.waitForFunction(()=> !!document.querySelector('#tab-sem.active'));
  await settle(page);
}
async function drop(page, files){
  const n0 = await page.locator('#semFileTableWrap tr.file-row').count();
  await page.evaluate(list=>{
    const dt = new DataTransfer();
    for (const [name, b64] of list) dt.items.add(new File([Uint8Array.from(atob(b64), c=> c.charCodeAt(0))], name));
    document.querySelector('#semDropzone').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  }, files.map(f=> [f.name, f.buffer.toString('base64')]));
  await page.waitForFunction(n=> document.querySelectorAll('#semFileTableWrap tr.file-row').length >= n && !document.querySelector('.dz-loading'), n0 + files.length, { timeout: 20000 });
  await page.waitForFunction(()=> document.querySelectorAll('#semThumbs .sem-thumb canvas').length === document.querySelectorAll('#semFileTableWrap .file-incl:checked').length, null, { timeout: 20000 });
  await settle(page);
}
// A forced GC (CDP), twice.
async function gc(page){ const c = await page.context().newCDPSession(page); for (let i = 0; i < 2; i++) await c.send('HeapProfiler.collectGarbage'); await c.detach(); }
// Tab i asleep holds its files' references, not their bytes (tabs.js lighten done).
const light = (page, i)=> page.evaluate(async i=>{ const t = (await import('./tabs.js')).TABS[i]; return !t.inst && (await import('./db.js')).unread(t.state); }, i);
// The hashes the bytes store holds.
const storeKeys = page => page.evaluate(()=> new Promise((res, rej)=>{
  const r = indexedDB.open('datatreat');
  r.onsuccess = ()=>{ const q = r.result.transaction('bytes').objectStore('bytes').getAllKeys(); q.onsuccess = ()=>{ res(q.result); r.result.close(); }; q.onerror = ()=> rej(q.error); };
  r.onerror = ()=> rej(r.error);
}));
const shown = (page, i)=> page.locator('#tabBar .ptab').nth(i).locator('.ptab-label').click();
// Tab i's history, by file: [its RawRefs, its arrays of bytes], one of each a file (not a
// copy of the array at each step that held its file, nor RawRefs other than the file's own).
const census = (page, i)=> page.evaluate(async i=>{ const u = await import('./utils.js'), t = (await import('./tabs.js')).TABS[i], refs = {}, arrs = {};
  for (const s of u.getModuleHistory(t.id).states) for (const f of s.files){ (refs[f.name] ||= new Set()).add(f.raw); (arrs[f.name] ||= new Set()).add(f.raw.bytes); }
  return Object.fromEntries(Object.keys(refs).sort().map(k=> [k, [refs[k].size, arrs[k].size]])); }, i);
const made = page => page.evaluate(async ()=> ({ ...(await import('./utils.js')).kept.made }));
/* The bytes store's reads (a readonly transaction of it alone: db.js load) counted, and their
   end held while __holdTx; the end of the writes of the tabs' records (and so the write
   queue's) held while __holdW; both delivered by __releaseTx(). */
const holdTx = page => page.evaluate(()=>{
  window.__reads = 0; window.__heldTx = []; window.__holdTx = window.__holdW = false;
  const d = Object.getOwnPropertyDescriptor(IDBTransaction.prototype, 'oncomplete');
  Object.defineProperty(IDBTransaction.prototype, 'oncomplete', { configurable: true, get(){ return d.get.call(this); }, set(fn){
    const n = this.objectStoreNames, read = this.mode === 'readonly' && n.length === 1 && n.contains('bytes'), write = this.mode === 'readwrite' && n.contains('tabs');
    if (read) window.__reads++;
    d.set.call(this, !fn || !(read || write) ? fn : e=>{ if (read ? window.__holdTx : window.__holdW) window.__heldTx.push(()=> fn.call(this, e)); else fn.call(this, e); });
  } });
  window.__releaseTx = ()=>{ window.__holdTx = window.__holdW = false; window.__heldTx.splice(0).forEach(f=> f()); };
});

test('two SEM tabs awake at once: each its own files, view and undo; a file in both one array, one worker for both', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await holdWorkers(page);
    await openModule(page, 'sem'); await loadFiles(page, 'sem', [A(), B()]);
    await relabel(page, 0, 'a-one');
    // (its section, marked: the same element when it is shown again, not a restore's)
    await page.evaluate(()=>{ document.querySelector('#tab-sem').dataset.mark = 'A'; });
    await openModule(page, 'sem'); await loadFiles(page, 'sem', [C(), A()]);
    assert.deepEqual(await awake(page), [true, true], 'both awake');
    assert.equal(await page.locator('#tab-sem').count(), 1, 'one SEM section in the page, the one on show');
    assert.equal(await page.locator('#semFileTableWrap tr.file-row').count(), 2);
    assert.equal(await page.evaluate(()=> window.__made), 1, 'one reading worker for both tabs');
    assert.ok(await page.evaluate(async ()=>{
      const u = await import('./utils.js'), [a, b] = (await import('./tabs.js')).tabsNow().map(t=> u.getModuleState(t.id));
      return a.files[0].raw.bytes === b.files[1].raw.bytes;
    }), 'a.tif in both tabs: one array of its bytes');
    await relabel(page, 0, 'c-one');
    await switchTab(page, 0);
    assert.equal(await page.evaluate(()=> document.querySelector('#tab-sem').dataset.mark), 'A', 'tab A\'s own section, shown again');
    assert.deepEqual(await labels(page), ['a-one', 'B']);
    await thumbs(page, 2);
    assert.deepEqual(await history(page, 'sem'), { index: 2, n: 3 }, 'its history: start, files, label');
    await relabel(page, 1, 'b-two');
    // Undo in A undoes A's steps alone; B keeps its own.
    await undo(page); await undo(page);
    assert.deepEqual(await labels(page), ['A', 'B']);
    await switchTab(page, 1);
    assert.deepEqual(await labels(page), ['c-one', 'A']);
    await undo(page);
    assert.deepEqual(await labels(page), ['C', 'A']);
    await switchTab(page, 0);
    await undo(page, true);
    assert.deepEqual(await labels(page), ['a-one', 'B'], 'A\'s redo, after B\'s undo');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('a reading goes on in a tab left: nothing asked, its files in its own list as one step, its record and its "*"; awake till its end, its time hidden counted from then', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await holdWorkers(page);
    await openModule(page, 'sem');
    await page.evaluate(()=>{ window.__hold = true; });
    await page.setInputFiles('#semFiles', [A(), C()]);
    await until(()=> page.evaluate(()=> window.__held.length), { what: 'the worker\'s answer' });
    // Left for another SEM tab: nothing asked, the reading goes on there.
    await openModule(page, 'sem');
    assert.equal(await banner(page), null, 'nothing asked');
    assert.equal((await tabs(page))[0].busy, true, 'still reading, hidden');
    await tick(page, 11*MIN);
    assert.deepEqual(await awake(page), [true, true], 'busy: awake past the minutes');
    await page.evaluate(()=> window.__release());
    await until(async ()=> !(await tabs(page))[0].busy, { what: 'the reading\'s end' });
    assert.deepEqual(await labels(page), [], 'the tab on show untouched');
    // Its record has the files (the autosave of a tab not on show), its label the "*".
    await until(async ()=>{ const r = (await idb(page, 'tabs')).find(x=> x.order === 0); return r && r.state.files.length === 2; }, { what: 'the record' });
    assert.match((await tabLabels(page))[0], /\*$/);
    await tick(page, 9*MIN);
    assert.deepEqual(await awake(page), [true, true], '9 minutes after its end: awake');
    await tick(page, 11*MIN);
    assert.deepEqual(await awake(page), [false, true], '11 minutes after: asleep');
    // Woken with what it read, drawn.
    await switchTab(page, 0);
    assert.deepEqual(await labels(page), ['A', 'C']);
    await thumbs(page, 2);
    assert.ok(await page.locator('#semGroups .sem-gimg canvas').count() === 2, 'its cards drawn on show');
    await undo(page);
    assert.deepEqual(await labels(page), [], 'its files one step');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('hidden: the editor\'s image let go at once and nothing else till it sleeps; asleep past Settings\' minutes, woken with its whole history', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await page.click('#nav button[data-tab="settings"]');
    await page.fill('#settingSleepMin', '10'); await page.press('#settingSleepMin', 'Enter');
    await settle(page);
    await openModule(page, 'sem'); await loadFiles(page, 'sem', [A(), B(), C()]);
    for (const v of ['x', 'y']) await relabel(page, 0, v);
    const hA = await history(page, 'sem');
    await thumbs(page, 3);
    // (its thumbnails' and cards' canvases marked: the same elements when it is shown again)
    await page.evaluate(()=> document.querySelectorAll('#semThumbs .sem-thumb canvas, #semGroups .sem-gimg canvas').forEach(c=>{ c.dataset.mark = '1'; }));
    // Hidden 9 minutes: as it was left, its thumbnails and cards drawn.
    await openModule(page, 'sem');
    await tick(page, 9*MIN);
    assert.deepEqual(await page.evaluate(async ()=>{ const r = (await import('./tabs.js')).TABS[0].inst.root;
      return [r.querySelectorAll('#semThumbs .sem-thumb canvas[data-mark]').length, r.querySelectorAll('#semGroups .sem-gimg canvas[data-mark]').length]; }), [3, 3]);
    // Shown: its editor's image (256 px wide: its canvas, and its pixels while kept), let go
    // as it was hidden, made again (the canvases made counted); its thumbnails and cards not.
    await page.evaluate(()=>{ const make = document.createElement.bind(document); window.__canvases = [];
      document.createElement = (t, o)=>{ const e = make(t, o); if (/^canvas$/i.test(t)) window.__canvases.push(e); return e; }; });
    await switchTab(page, 0);
    await thumbs(page, 3);
    assert.ok(await page.evaluate(()=> window.__canvases.some(c=> c.width === 256)), 'its editor\'s image made again');
    assert.equal(await page.locator('#semThumbs .sem-thumb canvas[data-mark], #semGroups .sem-gimg canvas[data-mark]').count(), 6, 'its thumbnails and cards as they were');
    assert.ok(await page.evaluate(()=> document.querySelector('#semCropCanvas').width > 0), 'its editor drawn again');
    assert.deepEqual(await labels(page), ['y', 'B', 'C']);
    // Asleep after the minutes set, its history parked with it.
    await switchTab(page, 1);
    await tick(page, 11*MIN);
    assert.deepEqual(await awake(page), [false, true]);
    assert.equal((await tabs(page))[0].history, true);
    // Woken: its state and its whole history, step by step.
    await switchTab(page, 0);
    assert.deepEqual(await awake(page), [true, true]);
    assert.deepEqual(await labels(page), ['y', 'B', 'C']);
    await thumbs(page, 3);
    assert.deepEqual(await history(page, 'sem'), hA);
    for (const v of ['x', 'A']){ await undo(page); assert.equal((await labels(page))[0], v); }
    await undo(page);
    assert.deepEqual(await labels(page), [], 'down to the empty start');
    for (let i = 0; i < 3; i++) await undo(page, true);
    assert.deepEqual(await labels(page), ['y', 'B', 'C'], 'and up again');
    await thumbs(page, 3);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('asleep, its files\' bytes let go once the store holds them, one a tab awake holds kept; woken from the store as it was, history, thumbnails and editor; an undo bringing back a file only its history held', async ()=>{
  const { page, errors, csp, close } = await env.page();
  try {
    await newTab(page); await drop(page, [A(), B(), C()]);
    await relabel(page, 0, 'x');
    // (each file's bytes, held weakly)
    await page.evaluate(async ()=>{ const u = await import('./utils.js'), [t] = (await import('./tabs.js')).TABS;
      window.__w = Object.fromEntries(u.getModuleState(t.id).files.map(f=> [f.name, new WeakRef(f.raw.bytes)])); });
    // c.tif removed: its bytes in the history alone.
    await page.locator('#semFileTableWrap .row-del[data-i="2"]').click(); await settle(page);
    assert.deepEqual(await labels(page), ['x', 'B']);
    const hA = await history(page, 'sem');
    const one = { 'a.tif': [1, 1], 'b.tif': [1, 1], 'c.tif': [1, 1] };
    assert.deepEqual(await census(page, 0), one, 'one RawRef and one array a file');
    // A second tab holding a.tif, awake.
    await newTab(page); await drop(page, [A()]);
    // Asleep while the tabs' records are being written (the write queue's end held): its
    // bytes kept till its own record is written.
    await holdTx(page);
    await page.evaluate(()=>{ window.__holdW = true; });
    await tick(page, 11*MIN);
    assert.deepEqual(await awake(page), [false, true]);
    await until(()=> page.evaluate(()=> window.__heldTx.length), { what: 'a write' });
    await gc(page);
    assert.equal(await light(page, 0), false, 'its arrays, its record not written yet');
    assert.ok(await page.evaluate(()=> !!window.__w['b.tif'].deref()), 'b.tif\'s bytes held');
    await page.evaluate(()=> window.__releaseTx());
    await until(()=> light(page, 0), { what: 'its bytes let go' });
    // Nothing holds them now but the tab awake its a.tif.
    await gc(page);
    assert.deepEqual(await page.evaluate(()=> Object.fromEntries(Object.entries(window.__w).map(([k, w])=> [k, !!w.deref()]))),
      { 'a.tif': true, 'b.tif': false, 'c.tif': false });
    // The store holds the three, c.tif's too, its record holding them from the sweep.
    await page.evaluate(async ()=> (await import('./db.js')).sweep());
    const rec = (await idb(page, 'tabs')).find(r=> r.order === 0), keys = await storeKeys(page);
    for (const f of [A(), B(), C()]){ assert.ok(rec.refs.includes(sha(f.buffer)), f.name + ' held by its record'); assert.ok(keys.includes(sha(f.buffer)), f.name + ' stored'); }
    // Woken: read back from the store, as it was.
    await switchTab(page, 0);
    assert.deepEqual(await awake(page), [true, true]);
    assert.deepEqual(await labels(page), ['x', 'B']);
    await thumbs(page, 2);
    assert.equal(await page.locator('#semGroups .sem-gimg canvas').count(), 2, 'its cards drawn');
    assert.ok(await page.evaluate(()=> document.querySelector('#semCropCanvas').width > 0), 'its editor drawn');
    assert.deepEqual(await history(page, 'sem'), hA, 'its whole history');
    assert.deepEqual(await census(page, 0), one, 'woken: one RawRef and one array a file still, c.tif in two steps');
    assert.ok(await page.evaluate(async ()=>{ const u = await import('./utils.js'), [a, b] = (await import('./tabs.js')).TABS;
      return u.getModuleState(a.id).files[0].raw.bytes === u.getModuleState(b.id).files[0].raw.bytes; }), 'a.tif one array, the tab awake\'s, not read again');
    assert.ok((await download(page, ()=> page.locator('#semFileTableWrap .dl-file[data-i="1"]').click())).buf.equals(B().buffer), 'b.tif byte for byte');
    // Its group's figure composer drawn from them.
    await page.evaluate(()=> document.querySelector('#semGroups .sem-group-fig:not([disabled])').click());
    await page.waitForFunction(()=> document.querySelectorAll('.fig-backdrop .fig-svg image').length === 2);
    await page.keyboard.press('Escape');
    await page.waitForFunction(()=> !document.querySelector('.fig-backdrop'));
    // Undone: c.tif back from the store, its thumbnail and card as they were made before the
    // sleep (its history alone held it), then down to the empty start and up again.
    const m0 = await made(page);
    await undo(page);
    assert.deepEqual(await labels(page), ['x', 'B', 'C']);
    await thumbs(page, 3);
    await page.waitForFunction(()=> document.querySelectorAll('#semGroups .sem-gimg canvas').length === 3);
    const m1 = await made(page);
    assert.deepEqual(['sem-reduced', 'sem-card'].map(k=> (m1[k] || 0) - (m0[k] || 0)), [0, 0], 'c.tif\'s thumbnail and card not made again');
    await undo(page);
    assert.deepEqual(await labels(page), ['A', 'B', 'C']);
    await undo(page);
    assert.deepEqual(await labels(page), [], 'down to the empty start');
    for (let i = 0; i < 3; i++) await undo(page, true);
    assert.deepEqual(await labels(page), ['x', 'B'], 'and up again');
    await thumbs(page, 2);
    assert.deepEqual(errors, []);
    assert.deepEqual(await csp(), []);
  } finally { await close(); }
});

test('a wake reading its files: one read for two wakes asked, left or closed meanwhile given up, no key reaching another tab; files no longer stored lost and said, the rest as it was', async ()=>{
  const { page, errors, csp, close } = await env.page();
  try {
    await holdTx(page);
    await newTab(page); await drop(page, [A(), B()]);
    await relabel(page, 1, 'b-one');
    await newTab(page); await drop(page, [C()]);
    await tick(page, 11*MIN);
    await until(()=> light(page, 0), { what: 'its bytes let go' });
    // (collected: else the arrays the page still holds of them are taken, nothing read)
    await gc(page);
    // Shown, its read held: the loader on, no SEM section in the page, Ctrl+Z reaching no tab.
    await page.evaluate(()=>{ window.__holdTx = true; });
    await shown(page, 0);
    await until(()=> page.evaluate(()=> window.__heldTx.length), { what: 'the read' });
    assert.ok(await page.evaluate(()=> !!document.querySelector('.module-loader.show')), 'the loader on');
    assert.equal(await page.locator('#tab-sem').count(), 0, 'no SEM section meanwhile');
    await page.keyboard.press('Control+z');
    // Left meanwhile: given up as the read ends, the tab asleep as it was.
    await shown(page, 1); await settle(page);
    await page.evaluate(()=> window.__releaseTx()); await settle(page);
    assert.deepEqual(await awake(page), [false, true]);
    assert.ok(await light(page, 0), 'still its references');
    assert.deepEqual(await labels(page), ['C'], 'the other tab on show, untouched by the undo');
    // Shown, left and shown again while one read is held: that one read wakes it.
    await gc(page);
    await page.evaluate(()=>{ window.__holdTx = true; });
    await shown(page, 0);
    await until(()=> page.evaluate(()=> window.__heldTx.length), { what: 'the read' });
    await shown(page, 1); await settle(page);
    await shown(page, 0);
    await page.evaluate(()=> new Promise(r=> requestAnimationFrame(()=> requestAnimationFrame(()=> setTimeout(r, 50)))));
    assert.equal(await page.evaluate(()=> window.__reads), 2, 'the second wake asked reads nothing more');
    await page.evaluate(()=> window.__releaseTx()); await settle(page);
    assert.deepEqual(await awake(page), [true, true]);
    assert.deepEqual(await labels(page), ['A', 'b-one']);
    await thumbs(page, 2);
    // Closed while it wakes (Don't save): gone, the other tab on show.
    await switchTab(page, 1); await tick(page, 11*MIN);
    await until(()=> light(page, 0), { what: 'its bytes let go' });
    await gc(page);
    await page.evaluate(()=>{ window.__holdTx = true; });
    await shown(page, 0);
    await until(()=> page.evaluate(()=> window.__heldTx.length), { what: 'the read' });
    await page.locator('#tabBar .ptab').nth(0).locator('.ptab-x').click();
    assert.match((await banner(page)).text, /^Save “Untitled project” before closing/);
    await page.click('.pwa-confirm.show .btn:not(.primary)');
    await page.waitForFunction(()=> document.querySelectorAll('#tabBar .ptab').length === 1);
    await page.evaluate(()=> window.__releaseTx()); await settle(page);
    assert.deepEqual(await labels(page), ['C'], 'the other tab on show');
    // Its files no longer stored (a.tif's bytes deleted): woken without it, said so.
    await newTab(page); await drop(page, [A(), B()]);
    await relabel(page, 1, 'b-two');
    await switchTab(page, 0); await tick(page, 11*MIN);
    await until(()=> light(page, 1), { what: 'its bytes let go' });
    await gc(page);
    await page.evaluate(h=> new Promise(res=>{ const q = indexedDB.open('datatreat'); q.onsuccess = ()=>{ const t = q.result.transaction('bytes', 'readwrite');
      t.objectStore('bytes').delete(h); t.oncomplete = ()=>{ q.result.close(); res(); }; }; }), sha(A().buffer));
    await shown(page, 1);
    await page.waitForSelector('.pwa-confirm.show');
    assert.match((await banner(page)).text, /^“[^”]+”: 1 of its files is not stored in this browser any more: it comes back without it\.$/);
    await answer(page, 'ok');
    assert.deepEqual(await awake(page), [true, true]);
    assert.deepEqual(await labels(page), ['b-two'], 'the rest as it was');
    assert.match(await page.locator('#semAlerts').innerText(), /a\.tif/);
    await thumbs(page, 1);
    await undo(page);
    assert.deepEqual(await labels(page), ['B'], 'an undo, a.tif lost there too');
    // Its files' read failing as a whole (an error injected): the wake given up, the tab
    // asleep as it was, Home on show, said so; its record and the store holding its files
    // still (not woken without them, its record written so, its files swept); shown again,
    // read and woken.
    await tick(page, 11*MIN);
    await until(()=> light(page, 0), { what: 'its bytes let go' });
    await gc(page);
    await page.evaluate(()=>{ const T = IDBDatabase.prototype.transaction; window.__T = T;
      IDBDatabase.prototype.transaction = function(s, m){ if (m !== 'readwrite' && [].concat(s).join() === 'bytes') throw new DOMException('injected', 'UnknownError'); return T.apply(this, arguments); }; });
    await shown(page, 0);
    await page.waitForSelector('.pwa-confirm.show');
    assert.match((await banner(page)).text, /^“[^”]+”: its files could not be read from this browser's storage\. The tab stays as it was: show it again to read them again\.$/);
    await answer(page, 'ok');
    assert.deepEqual(await awake(page), [false, true]);
    assert.ok(await light(page, 0), 'still its references');
    assert.ok(await page.evaluate(()=> document.querySelector('#tab-home').classList.contains('active') && !document.querySelector('.module-loader.show')), 'Home on show, the loader off');
    await page.evaluate(()=>{ IDBDatabase.prototype.transaction = window.__T; });
    // (the first tab's record: its order is its own number, kept since the tab before it was
    // closed (v518; to v517 its place in the bar))
    const id0 = await page.evaluate(async ()=> (await import('./tabs.js')).TABS[0].id);
    await until(async ()=>{ const r = (await idb(page, 'tabs')).find(x=> x.id === id0); return r && r.state.files.length === 1 && r.refs.includes(sha(C().buffer)); }, { what: 'its record as it was' });
    await page.evaluate(async ()=> (await import('./db.js')).sweep());
    assert.ok((await storeKeys(page)).includes(sha(C().buffer)), 'c.tif stored still');
    await shown(page, 0); await settle(page);
    assert.deepEqual(await awake(page), [true, true]);
    assert.deepEqual(await labels(page), ['C'], 'woken with its file');
    await thumbs(page, 1);
    assert.deepEqual(errors, []);
    assert.deepEqual(await csp(), []);
  } finally { await close(); }
});

test('a tab asleep without its bytes: Projects\' CSV of its project; closed hidden with Save, saved with its files, reopened from Projects; a reload, the tab not on show back without its bytes, read as it wakes', async ()=>{
  const { page, errors, csp, close } = await env.page();
  try {
    await newTab(page); await drop(page, [A(), B()]);
    await saveAs(page, 'S1');
    const bar = readZip((await download(page, ()=> page.click('.proj-csv'))).buf);
    await relabel(page, 0, 'a-edited');
    await newTab(page); await drop(page, [C()]);
    await tick(page, 11*MIN);
    await until(()=> light(page, 0), { what: 'its bytes let go' });
    // Projects › CSV of S1, its tab asleep: the saved project's, as its bar gave it.
    await page.click('#nav button[data-tab="projects"]');
    const row = page.locator('#sessListWrap tr.sess-row').filter({ has: page.locator('input.proj-rename[value="S1"]') });
    const list = readZip((await download(page, ()=> row.locator('.pr-csv').click())).buf);
    assert.deepEqual(list.map(e=> e.name), bar.map(e=> e.name));
    list.forEach((e, i)=> assert.ok(e.data.equals(bar[i].data), e.name + ' differs'));
    assert.ok(await light(page, 0), 'the tab asleep as it was');
    // Closed hidden, with Save: saved as it is, its files by their hashes.
    await switchTab(page, 1);
    await page.locator('#tabBar .ptab').nth(0).locator('.ptab-x').click();
    assert.match((await banner(page)).text, /^Save “S1” before closing/);
    await answer(page, 'ok');
    await page.waitForFunction(()=> document.querySelectorAll('#tabBar .ptab').length === 1);
    const p = (await idb(page)).find(r=> r.title === 'S1');
    assert.deepEqual(p.state.files.map(f=> f.label), ['a-edited', 'B']);
    assert.deepEqual(p.refs.slice().sort(), [sha(A().buffer), sha(B().buffer)].sort());
    await page.evaluate(async ()=> (await import('./db.js')).sweep());
    // Reopened from Projects: its files byte for byte.
    await openProject(page, 'sem', 'S1');
    assert.deepEqual(await labels(page), ['a-edited', 'B']);
    await thumbs(page, 2);
    assert.ok((await download(page, ()=> page.locator('#semFileTableWrap .dl-file[data-i="0"]').click())).buf.equals(A().buffer), 'a.tif byte for byte');
    // A reload: the tab on show awake, the other back with its references, unread till shown.
    await page.reload(); await ready(page); await settle(page);
    assert.deepEqual(await awake(page), [false, true]);
    assert.ok(await light(page, 0), 'its references, not its bytes');
    await switchTab(page, 0);
    assert.deepEqual(await labels(page), ['C']);
    await thumbs(page, 1);
    assert.ok((await download(page, ()=> page.locator('#semFileTableWrap .dl-file[data-i="0"]').click())).buf.equals(C().buffer), 'c.tif byte for byte');
    assert.deepEqual(errors, []);
    assert.deepEqual(await csp(), []);
  } finally { await close(); }
});
