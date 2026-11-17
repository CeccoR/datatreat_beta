/* What the page stores, and how much it writes (v518). The origin's storage asked to be kept
   (navigator.storage.persist), once a load, only where it is not, saying nothing, and
   nothing broken in a browser without the API. The open tabs' records written only where
   what they hold changed: a hidden tab closed writes none, the tab on show closed the one
   now on show, a move the tab moved, a reload none; the bar's order kept by each record's
   own number across the gaps a close leaves, a move to the front and reloads; records of
   v517's form (orders 0, 1, 2…), and two on show or two of one order (two windows of the
   app on one database), read as the bar had them. SEM's files in v517's form in a tab's
   record, awake and asleep, in a project saved and in a project file, so that v517 reads
   them. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { start, openModule, loadFiles, settle, ready, tabLabels, activeLabel, answer, banner, idb, saveAs, switchTab, exportProject, download } from './helpers.mjs';

let env;
before(async ()=>{ env = await start(); });
after(()=> env && env.close());

const tabs = page => page.evaluate(async ()=> (await import('./tabs.js')).tabsNow());

test('the storage asked to be kept once a load where it is not, saying nothing; without the API nothing breaks', async ()=>{
  // (the API stood in for before the app loads, at a reload: 'ask' not kept, 'kept' kept, 'none' no API)
  const as = async mode =>{
    const o = await env.page();
    await o.page.addInitScript(mode =>{
      window.__asked = { persisted: 0, persist: 0 };
      if (mode === 'none'){ Object.defineProperty(Navigator.prototype, 'storage', { get: ()=> undefined, configurable: true }); return; }
      const s = navigator.storage;
      s.persisted = ()=>{ window.__asked.persisted++; return Promise.resolve(mode === 'kept'); };
      s.persist = ()=>{ window.__asked.persist++; return Promise.resolve(true); };
    }, mode);
    await o.page.reload(); await ready(o.page); await settle(o.page);
    return o;
  };
  const asked = page => page.evaluate(()=> window.__asked);
  for (const mode of ['ask', 'kept']){
    const { page, errors, csp, close } = await as(mode);
    try {
      // (a tab opened, files read, written, switched, closed: no question more)
      await openModule(page, 'gc'); await loadFiles(page, 'gc', env.fx.files.gc.slice(0, 1));
      await openModule(page, 'epr'); await page.locator('#tabBar .ptab').nth(0).locator('.ptab-label').click(); await settle(page);
      assert.deepEqual(await asked(page), { persisted: 1, persist: mode === 'ask' ? 1 : 0 }, mode + ': asked whether it is kept once, and to keep it only where not');
      assert.equal(await banner(page), null, mode + ': nothing said');
      await page.reload(); await ready(page); await settle(page);
      assert.deepEqual(await asked(page), { persisted: 1, persist: mode === 'ask' ? 1 : 0 }, mode + ': once again at a reload');
      assert.deepEqual(errors, []); assert.deepEqual(await csp(), []);
    } finally { await close(); }
  }
  // No API (a browser without it, a page not served over https or localhost): a tab, its
  // files, its record, a reload bringing it back, no error.
  const { page, errors, csp, close } = await as('none');
  try {
    assert.equal(await page.evaluate(()=> navigator.storage), undefined);
    await openModule(page, 'gc'); await loadFiles(page, 'gc', env.fx.files.gc);
    await page.waitForFunction(async ()=> (await (await import('./tabs.js')).TABS.length) === 1);
    await page.reload(); await ready(page); await settle(page);
    assert.deepEqual(await tabLabels(page), ['GC · Untitled project*']);
    assert.equal(await page.locator('#gcFileTableWrap tr.file-row').count(), 2, 'its files back');
    assert.equal(await banner(page), null);
    assert.deepEqual(errors, []); assert.deepEqual(await csp(), []);
  } finally { await close(); }
});

/* Every write and delete of the tabs' store from the page's start ([op, id, order, active]),
   and the steps that write: done once the queue of writes (db.js) is through (its sweep
   comes after them). */
const LOG = ()=>{
  window.__recs = [];
  const put = IDBObjectStore.prototype.put, del = IDBObjectStore.prototype.delete;
  IDBObjectStore.prototype.put = function(v){ if (this.name === 'tabs') window.__recs.push(['put', v.id, v.order, v.active]); return put.apply(this, arguments); };
  IDBObjectStore.prototype.delete = function(k){ if (this.name === 'tabs') window.__recs.push(['delete', k]); return del.apply(this, arguments); };
};
const drained = page => page.evaluate(async ()=> (await import('./db.js')).sweep());
async function writes(page, fn){
  await page.evaluate(()=>{ window.__recs.length = 0; });
  await fn();
  await drained(page);
  return page.evaluate(()=> window.__recs.slice());
}
const ids = async page => (await tabs(page)).map(t=> t.id);
// The bar's tabs by their names, and the one on show (unsaved, each has its "*").
const bar = async page => (await tabLabels(page)).map(l=> l.replace(/^GC · |\*$/g, ''));
const onShow = async page => (await activeLabel(page) || '').replace(/\*$/, '');
async function drag(page, from, to){
  const a = await page.locator('#tabBar .ptab').nth(from).boundingBox(), b = await page.locator('#tabBar .ptab').nth(to).boundingBox();
  const y = a.y + a.height/2, x0 = a.x + a.width/2, x1 = b.x + b.width/2 + (to > from ? 4 : -4);
  await page.mouse.move(x0, y); await page.mouse.down();
  for (let k = 1; k <= 8; k++) await page.mouse.move(x0 + (x1 - x0)*k/8, y);
  await page.mouse.up();
  await settle(page);
}
async function rename(page, name){
  await page.fill('.project-bar .project-name-input', name);
  await settle(page);
}

test('a close, a move and a reload write only the records that changed; the order and the tab on show kept across gaps and reloads', async ()=>{
  const { page, errors, csp, close } = await env.page();
  try {
    await page.addInitScript(LOG);
    await page.reload(); await ready(page);
    for (const n of ['T1', 'T2', 'T3', 'T4', 'T5']){ await openModule(page, 'gc'); await loadFiles(page, 'gc', env.fx.files.gc.slice(0, 1)); await rename(page, n); }
    // (the autosaves' trailing writes, 5 s after the last change, done)
    await page.waitForTimeout(5600); await drained(page);
    const [t1, t2, t3, t4, t5] = await ids(page);
    assert.deepEqual(await bar(page), ['T1', 'T2', 'T3', 'T4', 'T5']);

    // A hidden tab closed: its record deleted, no other written (to v517 the four others again)
    let w = await writes(page, async ()=>{ await page.locator('#tabBar .ptab').nth(1).locator('.ptab-x').click(); await answer(page, 'alt'); });
    assert.deepEqual(w, [['delete', t2]], 'a hidden tab closed: its record deleted, none written');
    // The tab on show closed: the one now on show written, as on show, alone
    w = await writes(page, async ()=>{ await page.locator('#tabBar .ptab').nth(3).locator('.ptab-x').click(); await answer(page, 'alt'); });
    assert.deepEqual(w.map(x=> x.slice(0, 2)), [['delete', t5], ['put', t4]], 'the tab on show closed: the next on show written alone');
    assert.equal(w[1][3], true);
    assert.deepEqual([await bar(page), await onShow(page)], [['T1', 'T3', 'T4'], 'GC · T4']);
    // A move: the tab moved written alone, its order past its new neighbour's
    w = await writes(page, ()=> drag(page, 0, 2));
    assert.deepEqual(await bar(page), ['T3', 'T4', 'T1']);
    assert.deepEqual(w.map(x=> x.slice(0, 2)), [['put', t1]], 'a move: the tab moved written alone');
    let recs = await idb(page, 'tabs');
    const ord = id => recs.find(r=> r.id === id).order;
    assert.ok(ord(t3) < ord(t4) && ord(t4) < ord(t1), 'the records\' orders rise along the bar, with their gaps: ' + recs.map(r=> r.order));
    assert.equal(await onShow(page), 'GC · T4', 'the drag shows no tab');

    // A new tab: the one left and the new one written
    await openModule(page, 'gc'); await rename(page, 'T6');
    await page.waitForTimeout(5600); await drained(page);
    const t6 = (await ids(page))[3];
    // A reload: the same bar and the tab on show, no record written
    await page.reload(); await ready(page); await settle(page); await page.waitForTimeout(300); await drained(page);
    assert.deepEqual([await bar(page), await onShow(page)], [['T3', 'T4', 'T1', 'T6'], 'GC · T6'], 'reloaded: the bar and the tab on show');
    assert.deepEqual(await page.evaluate(()=> window.__recs.filter(x=> x[0] === 'put')), [], 'a reload writes no record');
    // To the front (an order below the first's) and a gap in the middle, reloaded again
    w = await writes(page, ()=> drag(page, 3, 0));
    assert.deepEqual(w.map(x=> x.slice(0, 2)), [['put', t6]]);
    w = await writes(page, async ()=>{ await page.locator('#tabBar .ptab').nth(1).locator('.ptab-x').click(); await answer(page, 'alt'); });
    assert.deepEqual(w, [['delete', t3]]);
    await page.reload(); await ready(page); await settle(page); await page.waitForTimeout(300); await drained(page);
    assert.deepEqual([await bar(page), await onShow(page)], [['T6', 'T4', 'T1'], 'GC · T6']);
    assert.deepEqual(await page.evaluate(()=> window.__recs.filter(x=> x[0] === 'put')), []);
    // A switch writes the tab left and the tab shown, as before
    w = await writes(page, async ()=>{ await page.locator('#tabBar .ptab').nth(2).locator('.ptab-label').click(); await settle(page); });
    assert.deepEqual(w.map(x=> x.slice(0, 2)).sort(), [['put', t1], ['put', t6]].sort());
    await page.reload(); await ready(page); await settle(page);
    assert.deepEqual([await bar(page), await onShow(page)], [['T6', 'T4', 'T1'], 'GC · T1']);
    recs = await idb(page, 'tabs');
    assert.deepEqual(recs.filter(r=> r.active).map(r=> r.id), [t1], 'one record on show');
    assert.deepEqual(errors, []); assert.deepEqual(await csp(), []);
  } finally { await close(); }
});

test('records of v517\'s form read as they were; two on show or two of one order (two windows) read as the bar had them', async ()=>{
  const { page, errors, csp, close } = await env.page();
  try {
    await page.addInitScript(LOG);
    const put = recs => page.evaluate(recs=> new Promise((res, rej)=>{
      const q = indexedDB.open('datatreat');
      q.onsuccess = ()=>{ const t = q.result.transaction('tabs', 'readwrite'), os = t.objectStore('tabs'); os.clear(); recs.forEach(r=> os.put(r)); t.oncomplete = ()=>{ q.result.close(); res(); }; t.onerror = ()=> rej(t.error); };
      q.onerror = ()=> rej(q.error);
    }), recs);
    const rec = (id, order, active, updatedAt = 1)=> ({ id, module: 'gc', title: id, projectId: null, dirty: false, order, active, state: null, updatedAt });
    // v517's: orders 0, 1, 2, the second on show (written in another order than the bar's)
    await put([rec('c', 2, false), rec('a', 0, false), rec('b', 1, true)]);
    await page.reload(); await ready(page); await settle(page); await drained(page);
    assert.deepEqual([await bar(page), await onShow(page)], [['a', 'b', 'c'], 'GC · b']);
    assert.deepEqual(await page.evaluate(()=> window.__recs.filter(x=> x[0] === 'put')), [], 'nothing to write');
    // Two windows: two of one order, two on show; the one on show written last shown, the
    // order rising again (c past b), the other on show no longer: those two written alone
    await put([rec('a', 0, false), rec('b', 1, true, 1000), rec('c', 1, true, 2000)]);
    await page.reload(); await ready(page); await settle(page); await page.waitForTimeout(300); await drained(page);
    assert.deepEqual([await bar(page), await onShow(page)], [['a', 'b', 'c'], 'GC · c']);
    const w = await page.evaluate(()=> window.__recs.filter(x=> x[0] === 'put'));
    assert.deepEqual(w.map(x=> x.slice(1)).sort(), [['b', 1, false], ['c', 2, true]]);
    await page.reload(); await ready(page); await settle(page); await page.waitForTimeout(300); await drained(page);
    assert.deepEqual([await bar(page), await onShow(page)], [['a', 'b', 'c'], 'GC · c']);
    assert.deepEqual(await page.evaluate(()=> window.__recs.filter(x=> x[0] === 'put')), []);
    assert.deepEqual(errors, []); assert.deepEqual(await csp(), []);
  } finally { await close(); }
});

/* SEM's files as v517 writes them, { id, b64 }, the bytes stored once by their SHA-256
   alike, so that v517 (a window of it on the same database, or the app rolled back) reads
   them: { id, bytes } it would read as no file, show none, and write the tab's record
   without them at its next switch, their bytes swept. Read back as ever. */
test('SEM\'s files in v517\'s form: a tab\'s record, awake and asleep, a project saved { id, b64: {__t:\'b64\', h} }, a project file { id, b64 }; read back byte for byte', async ()=>{
  const { page, errors, csp, close } = await env.page();
  const F = env.fx.files.sem.slice(0, 2), sha = p => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
  const v517 = (r, what)=> r.state.files.forEach((f, i)=>{
    assert.deepEqual(Object.keys(f.raw), ['id', 'b64'], what + ': its keys');
    assert.equal(typeof f.raw.id, 'string');
    assert.deepEqual(f.raw.b64, { __t: 'b64', h: sha(F[i]) }, what + ': its bytes by their hash, as v517 stores them');
    assert.ok(r.refs.includes(sha(F[i])), what + ': in its refs');
  });
  const sem = async ()=> (await idb(page, 'tabs')).find(r=> r.module === 'sem');
  const same = async ()=>{ for (let i = 0; i < F.length; i++){ const d = await download(page, ()=> page.locator('#semFileTableWrap .dl-file').nth(i).click()); assert.ok(d.buf.equals(fs.readFileSync(F[i])), d.name + ': byte for byte'); } };
  try {
    await page.addInitScript(LOG);
    await page.reload(); await ready(page);
    await openModule(page, 'gc');
    await openModule(page, 'sem'); await loadFiles(page, 'sem', F);
    await saveAs(page, 'Forms');
    await page.waitForTimeout(5600); await drained(page);
    v517(await sem(), 'the tab\'s record');
    v517((await idb(page, 'sessions')).find(r=> r.title === 'Forms'), 'the project saved');
    const ex = await exportProject(page);
    ex.obj.state.files.forEach((f, i)=>{ assert.deepEqual(Object.keys(f.raw), ['id', 'b64']); assert.ok(Buffer.from(f.raw.b64, 'base64').equals(fs.readFileSync(F[i])), 'the project file: its base64'); });
    // Asleep, its bytes let go, then moved to the front: its record written from what it holds asleep
    await switchTab(page, 0);
    await page.evaluate(async ()=> (await import('./tabs.js')).sleepTick(Date.now() + 11*60000));
    assert.equal((await tabs(page))[1].awake, false);
    await drained(page);
    const w = await writes(page, ()=> drag(page, 1, 0));
    assert.deepEqual(w.map(x=> x[1]), [(await sem()).id], 'the SEM tab\'s record alone');
    v517(await sem(), 'asleep and moved');
    // Reloaded (it comes back asleep), shown: its images byte for byte
    await page.reload(); await ready(page); await settle(page);
    await switchTab(page, 0);
    await page.waitForFunction(()=> document.querySelectorAll('#semThumbs .sem-thumb').length === 2);
    await same();
    v517(await sem(), 'woken');
    assert.deepEqual(errors, []); assert.deepEqual(await csp(), []);
  } finally { await close(); }
});
