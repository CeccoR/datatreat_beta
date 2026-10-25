/* The files' bytes in a store of their own (v517, db.js): a record of a project or a tab
   holds each file's SHA-256, in its state and in refs, and the bytes are stored once, in
   the same transaction; the page holds them as the module's arrays (park), never as
   base64. In Node: park, stored and decode's forms. In the browser: records small and
   holding hashes, the bytes once, a later write putting none; the files back byte for
   byte after a save, a reload, a switch, an open and an import, and the list's export the
   bar's (state and signature); a database of v516 (version 3) upgraded with its records
   untouched, read as they are and written anew at their next write; the sweep, also with
   two pages on one database; one transaction (a bytes put that fails writes no record);
   bytes missing or unreadable; no WebCrypto; a newer version opened elsewhere; the upgrade
   held back by an older window while a tab is opened; no hashing again after a GC; a save
   that waits on the database (a second press, Save as twice, a tab shown, an edit or a name
   typed, a close that saves, meanwhile). */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { start, ready, settle, openModule, loadFiles, saveAs, switchTab, tabLabels, download, banner, answer,
  exportProject, signature, projectFile, importProject, openProject, readZip } from './helpers.mjs';
import { xrdml } from './fixtures.mjs';

globalThis.btoa ??= s => Buffer.from(s, 'binary').toString('base64');
globalThis.atob ??= s => Buffer.from(s, 'base64').toString('binary');
const db = await import('../db.js');
const sha = b => createHash('sha256').update(b).digest('hex');
const shaOf = p => sha(fs.readFileSync(p));
// A SEM-like RawRef: a file's bytes as base64, written in JSON as its id alone.
class Raw { constructor(id, b64){ this.id = id; this.b64 = b64; } toJSON(){ return 'raw:' + this.id; } }

/* ---- Node: the forms ---- */
test('park keeps the bytes and the text holders as they are, the rest as encode; decode gives them back', ()=>{
  const a = new Uint8Array([1, 2, 3]), r = new Raw('ab-3', Buffer.from([7, 8, 9]).toString('base64'));
  const v = { files: [{ raw: a }, { raw: a }], img: r, d: new Date(5), f: new Float64Array([1.5, -2]), u: undefined, n: null };
  const k = db.park(v);
  assert.equal(k.files[0].raw, a); assert.equal(k.files[1].raw, a); assert.equal(k.img, r);
  assert.deepEqual([k.d, k.f, k.n, 'u' in k], [{ __t: 'date', v: 5 }, [1.5, -2], null, true]);
  assert.equal(JSON.stringify(db.park({ d: v.d, f: v.f, n: null })), JSON.stringify(db.encode({ d: v.d, f: v.f, n: null })));
  const back = db.decode(k);
  assert.equal(back.files[0].raw, a); assert.equal(back.files[1].raw, a); assert.equal(back.img, r);
  assert.ok(back.d instanceof Date);
  // a plain copy of a holder (as a record or a file has it) is copied, as before
  const plain = { id: 'ab-3', b64: r.b64 };
  assert.notEqual(db.decode({ img: plain }).img, plain);
});

test('stored: hashes in the record, the ids of shared bytes, texts by their bytes, a text not canonical inline', async ()=>{
  const a = new Uint8Array(3000).map((_, i)=> i*7), b = Uint8Array.from(a), c = new Uint8Array([9]);
  const t4 = Buffer.from([1, 2, 3, 4]), text = new Raw('t-1', t4.toString('base64')), odd = { id: 'o', b64: 'AAEC\n' };
  const k = db.park({ files: [{ raw: a }, { raw: a }, { raw: b }, { raw: c }], sem: [{ name: 'i', raw: text }, { name: 'j', raw: odd }], n: [1, 2] });
  const s = await db.stored(k);
  const ha = sha(a), hc = sha(c), ht = sha(t4);
  // bytes in several places: the hash and encode's id at each, never encode's ref or the bytes
  assert.deepEqual(s.state.files.map(f=> f.raw), [{ __t: 'u8', h: ha, id: 0 }, { __t: 'u8', h: ha, id: 0 }, { __t: 'u8', h: ha }, { __t: 'u8', h: hc }]);
  assert.deepEqual(Object.keys(s.state.sem[0].raw), ['id', 'b64']);
  assert.deepEqual(s.state.sem[0].raw, { id: 't-1', b64: { __t: 'b64', h: ht } });
  assert.deepEqual(s.state.sem[1].raw, odd, 'a text toB64 does not write back is kept inline');
  assert.equal(s.state.n, k.n, 'what holds no bytes is the parked state\'s own');
  assert.deepEqual(s.refs, [ha, hc, ht]);
  assert.equal(s.put.get(ha)(), a);
  assert.deepEqual([...s.put.get(ht)()], [1, 2, 3, 4]);
  assert.ok(!/"ref"|"v":/.test(JSON.stringify(s.state)));
  assert.deepEqual((await db.stored(s.state)).state, s.state, 'a stored form is kept as it is');
  assert.equal(await db.stored(k), s, 'once per parked state');
});

test('stored without WebCrypto is encode\'s form; without WeakRef it still works', async ()=>{
  const d = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  const v = { files: [{ raw: new Uint8Array([5, 6]) }, { raw: new Uint8Array([5, 6]) }], img: new Raw('x-2', 'BQY=') };
  Object.defineProperty(globalThis, 'crypto', { value: {}, configurable: true, enumerable: true });
  try {
    const s = await db.stored(db.park(v));
    assert.equal(JSON.stringify(s.state), JSON.stringify(db.encode(v)));
    assert.deepEqual(s.refs, []);
  } finally { Object.defineProperty(globalThis, 'crypto', d); }
  const W = globalThis.WeakRef;
  delete globalThis.WeakRef;
  try {
    const s = await db.stored(db.park({ img: new Raw('y-2', 'BQc=') }));
    assert.deepEqual(s.state.img, { id: 'y-2', b64: { __t: 'b64', h: sha(Buffer.from([5, 7])) } });
  } finally { globalThis.WeakRef = W; }
});

test('a reference that reaches decode unread is null and said; a project file\'s references are no bytes', async ()=>{
  const said = [], ce = console.error;
  console.error = (...a)=> said.push(a.join(' '));
  try {
    assert.equal(db.decode({ __t: 'u8', h: 'ab' }), null);
    assert.deepEqual(db.decode({ raw: { id: 'x', b64: { __t: 'b64', h: 'cd' } } }), { raw: { id: 'x', b64: null } });
  } finally { console.error = ce; }
  assert.equal(said.length, 2);
  const [st] = await db.hydrate([{ a: { __t: 'u8', h: 'ab' }, b: { __t: 'u8', v: 'AQI=' }, c: { id: 'i', b64: { __t: 'b64', h: 'cd' } }, d: { id: 'j', b64: 'AQI=' } }], true);
  assert.equal(st.a, null);
  assert.deepEqual([...st.b], [1, 2]);
  assert.deepEqual(st.c, { id: 'i', b64: null });
  assert.deepEqual(st.d, { id: 'j', b64: 'AQI=' });
});

/* ---- The browser ---- */
let env;
before(async ()=>{ env = await start(); });
after(()=> env && env.close());

// Every record of the app's database; the bytes store as { hash: its length (-1: not bytes) }.
const dumpDb = page => page.evaluate(()=> new Promise((res, rej)=>{
  const r = indexedDB.open('datatreat');
  r.onerror = ()=> rej(r.error);
  r.onsuccess = ()=>{
    const d = r.result, names = [...d.objectStoreNames], out = { version: d.version };
    const t = d.transaction(names);
    names.forEach(n=>{ const os = t.objectStore(n), q = os.getAll(), k = os.getAllKeys(); q.onsuccess = ()=>{ k.onsuccess = ()=>{
      out[n] = n === 'bytes' ? Object.fromEntries(k.result.map((h, i)=> [h, q.result[i] instanceof Uint8Array ? q.result[i].length : -1])) : q.result; }; }; });
    t.oncomplete = ()=>{ d.close(); res(out); };
  };
}));
// Every write and delete asked so far done (a sweep is queued behind them), and swept.
const drain = page => page.evaluate(async ()=>{ await (await import('./db.js')).sweep(); });
// What a record holds that is not where it should be: a hash of its state not in its
// refs, one of its refs not in the bytes store.
function unheld(D){
  const miss = [];
  for (const s of ['sessions', 'tabs']) for (const r of D[s] || []){
    for (const [, h] of JSON.stringify(r.state).matchAll(/"h":"([0-9a-f]{64})"/g)) if (!(r.refs || []).includes(h)) miss.push(s + ' ' + r.title + ': not in refs');
    for (const h of r.refs || []) if (!(h in D.bytes)) miss.push(s + ' ' + r.title + ': not stored ' + h.slice(0, 8));
  }
  return miss;
}
const dl = (page, mod, i)=> download(page, ()=> page.locator(`#${mod}FileTableWrap .dl-file`).nth(i).click());
async function same(page, mod, paths){
  for (let i = 0; i < paths.length; i++){ const d = await dl(page, mod, i); assert.ok(d.buf.equals(fs.readFileSync(paths[i])), mod + ' ' + d.name + ': not byte for byte'); }
}
const thumbs = (page, n)=> page.waitForFunction(n=> document.querySelectorAll('#semThumbs .sem-thumb').length === n, n);
const relabel = async (page, mod, v)=>{ const l = page.locator(`#${mod}FileTableWrap .file-label`).first(); await l.fill(v); await l.press('Enter'); await settle(page); };
const row = (page, name)=> page.locator('#sessListWrap tr.sess-row').filter({ has: page.locator(`input.proj-rename[value="${name}"]`) });
// An XRDML of two scans (v485: patterns of one file share its bytes).
const twoScans = ()=>{
  const s = xrdml(0).toString('utf8'), a = s.indexOf('  <scan '), b = s.indexOf('</scan>') + 7;
  return s.slice(0, b) + '\n' + s.slice(a, b).replace('appendNumber="0"', 'appendNumber="1"') + s.slice(b);
};
// A page of a context of our own (as env.page() makes one), opened on `at`; init: a script run before the app's.
async function ownPage(at = '/manifest.webmanifest', init){
  const ctx = await env.browser.newContext({ viewport: { width: 1400, height: 900 }, timezoneId: 'UTC', locale: 'en-US', serviceWorkers: 'block', acceptDownloads: true });
  const errors = [], page = await ctx.newPage();
  const watch = p =>{
    p.on('pageerror', e=> errors.push('pageerror: ' + e.message));
    p.on('console', m=>{ if (m.type() === 'error' && !/^Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
    p.on('dialog', d=> d.dismiss());
  };
  watch(page);
  await ctx.addInitScript(()=> window.addEventListener('unhandledrejection', e=> console.error('unhandledrejection: ' + (e.reason && (e.reason.stack || e.reason.message) || e.reason))));
  if (init) await ctx.addInitScript(init);
  await page.goto(env.base + at);
  return { ctx, page, errors, watch, close: ()=> ctx.close() };
}
// A database as v516 left it (version 3), with these records.
const v3 = (page, recs, hold = false)=> page.evaluate(([recs, hold])=> new Promise((res, rej)=>{
  const q = indexedDB.open('datatreat', 3);
  q.onupgradeneeded = ()=>{ const d = q.result; d.createObjectStore('sessions', { keyPath: 'id' }).createIndex('module', 'module', { unique: false }); d.createObjectStore('tabs', { keyPath: 'id' }); };
  q.onsuccess = ()=>{
    const d = q.result, t = d.transaction(['sessions', 'tabs'], 'readwrite');
    (recs.sessions || []).forEach(r=> t.objectStore('sessions').put(r)); (recs.tabs || []).forEach(r=> t.objectStore('tabs').put(r));
    t.oncomplete = ()=>{ if (hold) window.__hold = d; else d.close(); res(); };   // (held: an older window's connection, which keeps it)
    t.onerror = ()=> rej(t.error);
  };
}), [recs, hold]);

test('saved: records small, holding hashes, each file\'s bytes once; back byte for byte after a reload, a switch, an open, an import; the list\'s export the bar\'s', async ()=>{
  const { page, errors, close } = await env.page();
  const multi = env.fx.put('multi.xrdml', twoScans());
  const X = [...env.fx.files.xrd, multi], X5 = [...X, multi], S = env.fx.files.sem;
  try {
    await openModule(page, 'xrd'); await loadFiles(page, 'xrd', X, 5); await saveAs(page, 'X');
    const barX = await exportProject(page);
    await openModule(page, 'sem'); await loadFiles(page, 'sem', S); await saveAs(page, 'S');
    const barS = await exportProject(page);
    await drain(page);
    let D = await dumpDb(page);
    assert.equal(D.version, 4);
    assert.deepEqual(D.bytes, Object.fromEntries([...X, ...S].map(p=> [shaOf(p), fs.statSync(p).size])), 'each file once, as its bytes');
    const rx = D.sessions.find(r=> r.title === 'X'), rs = D.sessions.find(r=> r.title === 'S'), hm = shaOf(multi);
    const forms = rx.state.files.map(f=> JSON.stringify(f.rawBytes)).sort();
    assert.deepEqual(forms, [...env.fx.files.xrd.map(p=> ({ __t: 'u8', h: shaOf(p) })), { __t: 'u8', h: hm, id: 0 }, { __t: 'u8', h: hm, id: 0 }].map(o=> JSON.stringify(o)).sort());
    assert.deepEqual(rs.state.files.map(f=> f.raw.b64), S.map(p=> ({ __t: 'b64', h: shaOf(p) })));
    for (const r of [...D.sessions, ...D.tabs]) assert.ok(!/[A-Za-z0-9+/]{200}/.test(JSON.stringify(r.state)), r.title + ': base64 in the record');
    for (const r of D.sessions.concat(D.tabs).filter(r=> r.module === 'sem')) assert.ok(JSON.stringify(r).length < 20000, r.title + ': ' + JSON.stringify(r).length + ' characters');
    assert.deepEqual(unheld(D), []);
    // A write after an edit, and a switch there and back, put no bytes.
    await page.evaluate(()=>{ const put = IDBObjectStore.prototype.put; window.__puts = []; IDBObjectStore.prototype.put = function(...a){ window.__puts.push(this.name); return put.apply(this, a); }; });
    await relabel(page, 'sem', 'relabelled');
    await switchTab(page, 0); await switchTab(page, 1);
    await drain(page);
    const puts = await page.evaluate(()=> window.__puts);
    assert.ok(puts.includes('tabs') && !puts.includes('bytes'), JSON.stringify(puts));
    // Reloaded: both tabs, every file byte for byte, across a switch.
    await page.reload(); await ready(page); await settle(page);
    assert.deepEqual(await tabLabels(page), ['XRPD · X', 'SEM · S*']);
    await thumbs(page, 3); await same(page, 'sem', S);
    await switchTab(page, 0); await same(page, 'xrd', X5);
    await switchTab(page, 1); await thumbs(page, 3); await same(page, 'sem', S);
    // The list's exports: the bar's, state and signature.
    await page.click('#nav button[data-tab="projects"]');
    for (const [name, bar] of [['X', barX], ['S', barS]]){
      const o = JSON.parse((await download(page, ()=> row(page, name).locator('.pr-json').click())).buf.toString());
      assert.deepEqual(o.state, bar.obj.state, name + ': the list\'s export is not the bar\'s');
      assert.equal(o.signature.value, bar.obj.signature.value);
      assert.equal(o.signature.value, signature(o.module, o.state));
    }
    // Closed, opened from the list; S's export imported as S2: no bytes stored again, opened whole.
    await page.locator('#tabBar .ptab').nth(0).locator('.ptab-x').click();
    await page.waitForFunction(()=> document.querySelectorAll('#tabBar .ptab').length === 1);
    await openProject(page, 'xrd', 'X'); await same(page, 'xrd', X5);
    assert.equal(await importProject(page, projectFile(env, 's2.datatreat', { ...barS.obj, title: 'S2' })), null);
    await drain(page);
    D = await dumpDb(page);
    assert.equal(Object.keys(D.bytes).length, 7, 'an import of files stored already stores no bytes again');
    assert.deepEqual(D.sessions.find(r=> r.title === 'S2').refs, rs.refs);
    await openProject(page, 'sem', 'S2'); await thumbs(page, 3); await same(page, 'sem', S);
    assert.deepEqual(unheld(await dumpDb(page)), []);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('a database of v516 (version 3): upgraded with its records untouched, read as they are, written anew at their next write', async ()=>{
  let E;
  { const { page, close } = await env.page(); try { await openModule(page, 'xrd'); await loadFiles(page, 'xrd', env.fx.files.xrd); E = (await exportProject(page)).obj; } finally { await close(); } }
  const { page, errors, close } = await ownPage();
  try {
    await v3(page, { sessions: [{ id: 'old1', module: 'xrd', title: 'Old', state: E.state, createdAt: 1, updatedAt: 1 }],
      tabs: [{ id: 'tab1', module: 'xrd', title: 'Old', projectId: 'old1', dirty: false, order: 0, active: true, state: E.state, updatedAt: 1 }] });
    const before = await dumpDb(page);
    assert.equal(before.version, 3);
    await page.goto(env.base + '/index.html'); await ready(page); await settle(page);
    const up = await dumpDb(page);
    assert.equal(up.version, 4);
    assert.deepEqual(up.bytes, {});
    assert.deepEqual([up.sessions, up.tabs], [before.sessions, before.tabs], 'the upgrade changed a record');
    assert.deepEqual(await page.evaluate(()=> new Promise(res=>{ const q = indexedDB.open('datatreat'); q.onsuccess = ()=>{ const t = q.result.transaction(['sessions', 'tabs']);
      res([[...t.objectStore('sessions').indexNames], [...t.objectStore('tabs').indexNames]]); q.result.close(); }; })), [['module', 'refs'], ['refs']]);
    assert.deepEqual(await tabLabels(page), ['XRPD · Old']);
    await same(page, 'xrd', env.fx.files.xrd);
    // The old record exported from the list: as v516 exported it.
    await page.click('#nav button[data-tab="projects"]');
    let o = JSON.parse((await download(page, ()=> row(page, 'Old').locator('.pr-json').click())).buf.toString());
    assert.deepEqual([o.state, o.signature.value], [E.state, E.signature.value]);
    // An edit: the tab's record written anew, its project's left as it was.
    await switchTab(page, 0);
    await relabel(page, 'xrd', 'edited');
    await drain(page);
    let D = await dumpDb(page);
    assert.deepEqual(D.tabs[0].refs.sort(), env.fx.files.xrd.map(shaOf).sort());
    assert.deepEqual(D.sessions, before.sessions);
    assert.deepEqual(unheld(D), []);
    // Saved: the project's record too; its export the bar's.
    await page.click('.proj-save'); await page.waitForSelector('.proj-save.is-saved');
    const bar = await exportProject(page);
    await drain(page);
    D = await dumpDb(page);
    assert.equal(D.sessions[0].refs.length, 3);
    await page.click('#nav button[data-tab="projects"]');
    o = JSON.parse((await download(page, ()=> row(page, 'Old').locator('.pr-json').click())).buf.toString());
    assert.deepEqual([o.state, o.signature.value], [bar.obj.state, bar.obj.signature.value]);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('the sweep: the bytes no record holds go, those a record or another page\'s tab holds stay or come back', async ()=>{
  const { ctx, page, errors, close } = await env.page();
  const [s0, s1, s2] = env.fx.files.xrd, [h0, h1, h2] = [s0, s1, s2].map(shaOf);
  const keys = async p => Object.keys((await dumpDb(p)).bytes).sort();
  try {
    await openModule(page, 'xrd'); await loadFiles(page, 'xrd', [s0, s1]); await saveAs(page, 'A');
    await openModule(page, 'xrd'); await loadFiles(page, 'xrd', [s2]); await saveAs(page, 'B');
    await page.locator('#tabBar .ptab').nth(0).locator('.ptab-x').click();   // (A saved: closed at once)
    await page.waitForFunction(()=> document.querySelectorAll('#tabBar .ptab').length === 1);
    await drain(page);
    assert.deepEqual(await keys(page), [h0, h1, h2].sort(), 'A\'s project still holds its bytes');
    // A deleted: its bytes go, B's stay.
    await page.click('#nav button[data-tab="projects"]');
    await row(page, 'A').locator('.pr-del').click(); await answer(page, 'ok');
    await drain(page);
    assert.deepEqual(await keys(page), [h2]);
    // A file loaded then removed from B's tab: its bytes go once written without it.
    await page.locator('#tabBar .ptab').nth(0).locator('.ptab-label').click(); await settle(page);
    await loadFiles(page, 'xrd', [s0]);
    await drain(page);
    assert.deepEqual(await keys(page), [h0, h2].sort());
    await page.locator('#xrdFileTableWrap .row-del').nth(1).click(); await settle(page);
    await page.evaluate(async ()=>{ const T = await import('./tabs.js'); T.persistTab(T.activeTab()); });
    await drain(page);
    assert.deepEqual(await keys(page), [h2]);
    // Its bytes deleted by hand while the tab holds the file: written again at the next write.
    const kill = (p, h)=> p.evaluate(h=> new Promise(res=>{ const q = indexedDB.open('datatreat'); q.onsuccess = ()=>{ const t = q.result.transaction('bytes', 'readwrite'); t.objectStore('bytes').delete(h); t.oncomplete = ()=>{ q.result.close(); res(); }; }; }), h);
    await kill(page, h2);
    await relabel(page, 'xrd', 'again');
    await drain(page);
    assert.deepEqual(await keys(page), [h2]);
    // Two pages on one database: B deleted in the first (its tab closed there, its bytes swept)
    // while the second shows it; the second's next write puts them back, and a reload there has them.
    const errs2 = [], page2 = await ctx.newPage();
    page2.on('pageerror', e=> errs2.push(e.message));
    page2.on('console', m=>{ if (m.type() === 'error' && !/^Failed to load resource/.test(m.text())) errs2.push(m.text()); });
    await page2.goto(env.base + '/index.html'); await ready(page2); await settle(page2);
    assert.deepEqual(await tabLabels(page2), ['XRPD · B*']);
    await page.click('#nav button[data-tab="projects"]');
    await row(page, 'B').locator('.pr-del').click(); await answer(page, 'ok');
    await drain(page);
    assert.deepEqual(await keys(page), [], 'no record holds B\'s bytes any more');
    await relabel(page2, 'xrd', 'kept');
    await drain(page2);
    assert.deepEqual(await keys(page2), [h2]);
    assert.deepEqual(unheld(await dumpDb(page2)), []);
    await page2.reload(); await ready(page2); await settle(page2);
    await same(page2, 'xrd', [s2]);
    assert.deepEqual([errors, errs2], [[], []]);
  } finally { await close(); }
});

test('one transaction: a bytes put that fails writes no record', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    const res = await page.evaluate(async ()=>{
      const db = await import('./db.js'), put = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function(){ if (this.name === 'bytes') throw new Error('disk full (test)'); return put.apply(this, arguments); };
      try { await db.putTabRec({ id: 'atomic', module: 'gc', title: 'Atomic', order: 0, state: db.park({ files: [{ name: 'n', rawBytes: new Uint8Array([1, 2, 3, 99]) }] }) }); return 'written'; }
      catch(e){ return 'refused'; }
      finally { IDBObjectStore.prototype.put = put; }
    });
    assert.equal(res, 'refused');
    const D = await dumpDb(page);
    assert.deepEqual([D.tabs, D.bytes], [[], {}]);
    assert.deepEqual(errors, ['pageerror: disk full (test)']);
  } finally { await close(); }
});

test('bytes missing or unreadable: the other files and tabs back, said so; XRPD and SEM without them; the list\'s export says it', async ()=>{
  const { page, errors, close } = await env.page();
  const said = [];
  page.on('dialog', d=> said.push(d.message()));
  const [s0, s1] = env.fx.files.xrd, S = env.fx.files.sem;
  try {
    await openModule(page, 'xrd'); await loadFiles(page, 'xrd', [s0, s1]);
    await openModule(page, 'sem'); await loadFiles(page, 'sem', S); await saveAs(page, 'S');
    await drain(page);
    // s0's and img1's bytes gone, img2's not bytes any more
    await page.evaluate(([a, b, c])=> new Promise(res=>{ const q = indexedDB.open('datatreat'); q.onsuccess = ()=>{ const t = q.result.transaction('bytes', 'readwrite');
      t.objectStore('bytes').delete(a); t.objectStore('bytes').delete(b); t.objectStore('bytes').put('not bytes', c); t.oncomplete = ()=>{ q.result.close(); res(); }; }; }), [shaOf(s0), shaOf(S[0]), shaOf(S[1])]);
    await page.reload(); await ready(page);
    await page.waitForSelector('.pwa-confirm.show');
    assert.match((await banner(page)).text, /^3 files of your open tabs are not stored in this browser any more/);
    await answer(page, 'ok');
    await thumbs(page, 1);
    assert.equal(await page.locator('#semFileTableWrap tr.file-row').count(), 1);
    assert.match(await page.locator('#semAlerts').innerText(), /img1\.tif.*\n?.*img2\.tif|img1\.tif, img2\.tif/s);
    await same(page, 'sem', [S[2]]);
    await switchTab(page, 0);
    assert.equal(await page.locator('#xrdFileTableWrap tr.file-row').count(), 2);
    await page.locator('#xrdFileTableWrap .dl-file').nth(0).click();
    await page.waitForTimeout(300);
    assert.deepEqual(said, ['The original file for “s00.xrdml” is not available.']);
    assert.ok((await dl(page, 'xrd', 1)).buf.equals(fs.readFileSync(s1)));
    // The project's record still holds the three: its export says two are not stored, and holds them as null.
    await page.click('#nav button[data-tab="projects"]');
    const d = await download(page, ()=> row(page, 'S').locator('.pr-json').click());
    await page.waitForSelector('.pwa-confirm.show');
    assert.match((await banner(page)).text, /“S”: 2 of its files are not stored in this browser any more; the file holds them without their bytes/);
    await answer(page, 'ok');
    assert.deepEqual(JSON.parse(d.buf.toString()).state.files.map(f=> f.raw.b64 === null), [true, true, false]);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('an EPR pair whose .DTA bytes are not stored: its download says so, not a zip with an empty file', async ()=>{
  const { page, errors, close } = await env.page();
  const said = [], E = env.fx.files.epr;
  page.on('dialog', d=> said.push(d.message()));
  try {
    await openModule(page, 'epr'); await loadFiles(page, 'epr', E);
    await drain(page);
    await page.evaluate(h=> new Promise(res=>{ const q = indexedDB.open('datatreat'); q.onsuccess = ()=>{ const t = q.result.transaction('bytes', 'readwrite');
      t.objectStore('bytes').delete(h); t.oncomplete = ()=>{ q.result.close(); res(); }; }; }), shaOf(E[1]));
    await page.reload(); await ready(page);
    await page.waitForSelector('.pwa-confirm.show');
    assert.match((await banner(page)).text, /^1 file of your open tabs is not stored in this browser any more/);
    await answer(page, 'ok');
    let got = null;
    page.once('download', ()=> got = 'downloaded');
    await page.locator('#eprFileTableWrap .dl-file').nth(0).click();
    await page.waitForTimeout(300);
    assert.deepEqual([said, got], [['The original file for “e1.DTA” is not available.'], null]);
    const z = readZip((await dl(page, 'epr', 1)).buf);
    assert.deepEqual(z.map(e=> e.name), ['e2.DSC', 'e2.DTA']);
    assert.ok(z[0].data.equals(fs.readFileSync(E[2])) && z[1].data.equals(fs.readFileSync(E[3])));
    const all = readZip((await download(page, ()=> page.click('#eprFileTableWrap .download-all'))).buf);
    assert.deepEqual(all.map(e=> e.name), ['e2.DSC', 'e2.DTA']);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('no WebCrypto (a page over plain http): records hold the bytes as before, nothing in the bytes store, all back after a reload', async ()=>{
  const { page, errors, close } = await ownPage('/index.html', ()=> Object.defineProperty(Crypto.prototype, 'subtle', { get(){ return undefined; }, configurable: true }));
  try {
    await ready(page);
    await openModule(page, 'xrd'); await loadFiles(page, 'xrd', env.fx.files.xrd); await saveAs(page, 'NX');
    await openModule(page, 'sem'); await loadFiles(page, 'sem', env.fx.files.sem); await saveAs(page, 'NS');
    await drain(page);
    const D = await dumpDb(page);
    assert.deepEqual(D.bytes, {});
    for (const r of [...D.sessions, ...D.tabs]){ assert.ok(!JSON.stringify(r.state).includes('"h":"'), r.title); assert.deepEqual(r.refs, []); }
    await page.reload(); await ready(page); await settle(page);
    await thumbs(page, 3); await same(page, 'sem', env.fx.files.sem);
    await switchTab(page, 0); await same(page, 'xrd', env.fx.files.xrd);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('a newer version opened in another window: this one writes out its last edit, lets go at once, and says to reload', async ()=>{
  const { ctx, page, errors, close } = await env.page();
  try {
    await openModule(page, 'gc'); await loadFiles(page, 'gc', env.fx.files.gc);
    await relabel(page, 'gc', 'first'); await relabel(page, 'gc', 'last-edit');   // (the second within the autosave's 5 s)
    const other = await ctx.newPage();
    await other.goto(env.base + '/manifest.webmanifest');
    const got = await other.evaluate(()=> new Promise(res=>{
      const t0 = performance.now(), q = indexedDB.open('datatreat', 5);
      q.onsuccess = ()=>{ const d = q.result, r = d.transaction('tabs').objectStore('tabs').getAll(); r.onsuccess = ()=>{ d.close(); res({ ms: performance.now() - t0, labels: r.result.map(x=> x.state.files[0].label) }); }; };
      setTimeout(()=> res('still waiting'), 5000);
    }));
    assert.deepEqual(got.labels, ['last-edit']);
    assert.ok(got.ms < 2500, got.ms + ' ms');
    await page.waitForSelector('.pwa-confirm.show');
    assert.match((await banner(page)).text, /DataTreat was updated in another window: reload this one/);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('the upgrade held back by an older window: said; a tab opened meanwhile keeps its work when the restored tabs come', async ()=>{
  let E;
  { const { page, close } = await env.page(); try { await openModule(page, 'xrd'); await loadFiles(page, 'xrd', env.fx.files.xrd.slice(0, 2)); E = (await exportProject(page)).obj; } finally { await close(); } }
  const { ctx, page: old, watch, errors, close } = await ownPage();
  try {
    await v3(old, { tabs: [{ id: 'tab1', module: 'xrd', title: 'Old', projectId: null, dirty: true, order: 0, active: true, state: E.state, updatedAt: 1 }] }, true);
    const page = await ctx.newPage(); watch(page);
    await page.goto(env.base + '/index.html'); await ready(page);
    await page.waitForSelector('.pwa-confirm.show');
    assert.match((await banner(page)).text, /DataTreat is open in another window of an older version/);
    await answer(page, 'ok');
    assert.deepEqual(await tabLabels(page), []);
    await openModule(page, 'xrd'); await loadFiles(page, 'xrd', [env.fx.files.xrd[2]]);
    await page.fill('.project-name-input', 'Mine'); await page.click('.proj-save');
    assert.match((await banner(page)).text, /Projects cannot be saved yet/);
    await answer(page, 'ok');
    await old.evaluate(()=> window.__hold.close());   // (the older window closed)
    await page.waitForFunction(()=> document.querySelectorAll('#tabBar .ptab').length === 2);
    await settle(page);
    assert.deepEqual(await tabLabels(page), ['XRPD · Old*', 'XRPD · Mine*']);
    assert.equal(await page.locator('#tabBar .ptab.is-on').textContent(), 'XRPD · Mine*');
    await same(page, 'xrd', [env.fx.files.xrd[2]]);
    await switchTab(page, 0); await same(page, 'xrd', env.fx.files.xrd.slice(0, 2));
    await switchTab(page, 1);
    await drain(page);
    await page.reload(); await ready(page); await settle(page);
    assert.deepEqual(await tabLabels(page), ['XRPD · Old*', 'XRPD · Mine*']);
    await same(page, 'xrd', [env.fx.files.xrd[2]]);
    assert.deepEqual((await dumpDb(page)).sessions, [], 'nothing saved while held back');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('no hashing again: a GC, a switch there and back, a reload; the record written at once', async ()=>{
  const { page, errors, close } = await env.page();
  const cdp = await page.context().newCDPSession(page);
  const gc = async ()=>{ await cdp.send('HeapProfiler.collectGarbage'); await cdp.send('HeapProfiler.collectGarbage'); };
  // (the digests of more than 4 kB: a file's, not a signature's)
  const count = ()=> page.evaluate(()=>{ const d = SubtleCrypto.prototype.digest; window.__dig = 0; SubtleCrypto.prototype.digest = function(a, b){ if (b.byteLength > 4096) window.__dig++; return d.call(this, a, b); }; });
  const digests = ()=> page.evaluate(()=> window.__dig);
  const flush = ()=> page.evaluate(async ()=>{ const T = await import('./tabs.js'), db = await import('./db.js'), t0 = performance.now(); T.persistTab(T.activeTab()); await db.sweep(); return performance.now() - t0; });
  try {
    await openModule(page, 'sem'); await loadFiles(page, 'sem', env.fx.files.sem);
    await drain(page);
    await count();
    await gc(); await flush();
    assert.equal(await digests(), 0, 'after a GC');
    await openModule(page, 'gc'); await switchTab(page, 0); await gc(); await flush();
    assert.equal(await digests(), 0, 'after a switch');
    await page.reload(); await ready(page); await settle(page); await thumbs(page, 3);
    await count(); await gc();
    assert.ok(await flush() < 1000);
    assert.equal(await digests(), 0, 'after a reload');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('a rename from the list writes the title alone, and brings back no project another page deleted; a connection lost is opened again', async ()=>{
  const { ctx, page, errors, close } = await env.page();
  try {
    await openModule(page, 'xrd'); await loadFiles(page, 'xrd', env.fx.files.xrd); await saveAs(page, 'R');
    await drain(page);
    const r0 = (await dumpDb(page)).sessions[0];
    await page.click('#nav button[data-tab="projects"]');
    let inp = row(page, 'R').locator('input.proj-rename');
    await inp.fill('R2'); await inp.press('Enter');
    await page.waitForFunction(()=> document.querySelector('#tabBar .ptab').textContent.includes('R2'));
    await drain(page);
    const r1 = (await dumpDb(page)).sessions[0];
    assert.equal(r1.title, 'R2');
    assert.deepEqual([r1.state, r1.refs, r1.createdAt], [r0.state, r0.refs, r0.createdAt]);
    // Another page's list, drawn before this page deletes the project: a rename there brings it not back.
    const p2 = await ctx.newPage();
    await p2.goto(env.base + '/index.html'); await ready(p2); await settle(p2);
    await p2.click('#nav button[data-tab="projects"]'); await p2.waitForSelector('#sessListWrap tr.sess-row');
    await row(page, 'R2').locator('.pr-del').click(); await answer(page, 'ok');
    await drain(page);
    inp = row(p2, 'R2').locator('input.proj-rename');
    await inp.fill('R3'); await inp.press('Enter');
    await p2.waitForSelector('.pwa-confirm.show');
    assert.match((await banner(p2)).text, /“R2” is no longer among your projects: it was deleted in another window/);
    await drain(p2);
    assert.deepEqual((await dumpDb(page)).sessions, []);
    // A connection the browser closed without a word (InvalidStateError): opened again, the write done.
    const done = await page.evaluate(async ()=>{
      const db = await import('./db.js'), tx = IDBDatabase.prototype.transaction;
      let once = true;
      IDBDatabase.prototype.transaction = function(){ if (once){ once = false; throw new DOMException('closed (test)', 'InvalidStateError'); } return tx.apply(this, arguments); };
      try { await db.putTabRec({ id: 'again', module: 'gc', title: 'Again', order: 9, state: db.park({ files: [] }) }); return true; }
      catch(e){ return e.message; }
      finally { IDBDatabase.prototype.transaction = tx; }
    });
    assert.equal(done, true);
    assert.ok((await dumpDb(page)).tabs.some(t=> t.id === 'again'));
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

/* ---- A save that waits on the database ----
   The database's writes held: the next file hashed waits for release(), as the autosave of
   files just dropped holds them a second or so for eight big SEM images, the page answering
   meanwhile (v517; to v516 the encoding held the page). */
const hold = page => page.evaluate(()=>{
  const d = SubtleCrypto.prototype.digest; let go;
  const gate = new Promise(r=> go = r);
  window.__release = ()=>{ SubtleCrypto.prototype.digest = d; go(); };
  SubtleCrypto.prototype.digest = async function(...a){ await gate; return d.apply(this, a); };
});
const release = page => page.evaluate(()=> window.__release());
const press = page => page.evaluate(()=> document.querySelector('.proj-save').click());
const records = async (page, title)=> (await dumpDb(page)).sessions.filter(r=> r.title === title);

test('a save waiting on the database: a second press makes no second project and asks nothing twice; Save as pressed twice makes one copy', async ()=>{
  const { page, errors, close } = await env.page();
  const [s0, s1, s2] = env.fx.files.xrd, s3 = env.fx.put('s03.xrdml', xrdml(3));
  try {
    await openModule(page, 'xrd'); await page.fill('.project-name-input', 'Twice');
    await hold(page); await loadFiles(page, 'xrd', [s0, s1]);
    await press(page); await page.waitForTimeout(100); await press(page);
    await page.waitForTimeout(200); await release(page);
    await page.waitForSelector('.proj-save.is-saved'); await drain(page);
    assert.equal((await records(page, 'Twice')).length, 1, 'two projects of one name');
    // A second tab of that name: the question asked once, its answer the second press's too.
    await openModule(page, 'xrd'); await page.fill('.project-name-input', 'Twice');
    await hold(page); await loadFiles(page, 'xrd', [s2]);
    await press(page); await page.waitForTimeout(100); await press(page);
    await page.waitForSelector('.pwa-confirm.show');
    assert.match((await banner(page)).text, /named “Twice” already exists\. Overwrite it\?/);
    await answer(page, 'x');
    await release(page); await drain(page); await page.waitForTimeout(300);
    assert.equal(await banner(page), null, 'asked again');
    assert.deepEqual((await records(page, 'Twice')).map(r=> r.refs.sort()), [[s0, s1].map(shaOf).sort()]);
    // Save as, its OK pressed twice while the copy waits.
    await hold(page); await loadFiles(page, 'xrd', [s3]);
    await page.click('.proj-saveas'); await page.fill('#projSaveAsInput', 'Copy');
    await page.press('#projSaveAsInput', 'Enter'); await page.press('#projSaveAsInput', 'Enter');
    await page.waitForTimeout(200); await release(page);
    await page.waitForFunction(()=> [...document.querySelectorAll('#tabBar .ptab')].some(t=> t.textContent === 'XRPD · Copy'));
    await drain(page); await page.waitForTimeout(300);
    assert.equal(await banner(page), null);
    assert.equal((await records(page, 'Copy')).length, 1, 'two copies');
    assert.deepEqual(await tabLabels(page), ['XRPD · Twice', 'XRPD · Twice*', 'XRPD · Copy']);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('what changes while a save waits stays unsaved: another tab shown then, an edit, a name typed; a close that saves keeps a tab changed meanwhile', async ()=>{
  const { page, errors, close } = await env.page();
  const [s0, s1, s2] = env.fx.files.xrd, s3 = env.fx.put('s03.xrdml', xrdml(3)), s4 = env.fx.put('s04.xrdml', xrdml(4));
  const rec = async title => (await records(page, title))[0];
  const labels = rec => rec.state.files.map(f=> f.label);
  try {
    await openModule(page, 'gc'); await loadFiles(page, 'gc', env.fx.files.gc); await saveAs(page, 'G');
    await relabel(page, 'gc', 'unsaved');
    // Another tab shown while the save waits: that one keeps its change, unsaved, and asks at its close.
    await openModule(page, 'xrd'); await page.fill('.project-name-input', 'A');
    await hold(page); await loadFiles(page, 'xrd', [s0]);
    await press(page); await switchTab(page, 0); await release(page); await drain(page);
    assert.deepEqual(await tabLabels(page), ['GC · G*', 'XRPD · A']);
    await page.locator('#tabBar .ptab').nth(0).locator('.ptab-x').click();
    await page.waitForSelector('.pwa-confirm.show');
    assert.match((await banner(page)).text, /^Save “G” before closing\?/);
    await answer(page, 'x');
    // An edit while the save waits: the record is what the press saw, the tab unsaved; saved again, the edit too.
    await switchTab(page, 1);
    await hold(page); await loadFiles(page, 'xrd', [s1]);
    await press(page); await relabel(page, 'xrd', 'late'); await release(page); await drain(page);
    assert.deepEqual(await tabLabels(page), ['GC · G*', 'XRPD · A*']);
    let r = await rec('A');
    assert.equal(r.state.files.length, 2); assert.notEqual(labels(r)[0], 'late');
    await press(page); await page.waitForSelector('.proj-save.is-saved'); await drain(page);
    assert.equal(labels(await rec('A'))[0], 'late');
    // A name typed while the save waits: the tab's, unsaved; the record keeps the name saved.
    await hold(page); await loadFiles(page, 'xrd', [s2]);
    await press(page); await page.fill('.project-name-input', 'A2'); await release(page); await drain(page);
    assert.deepEqual(await tabLabels(page), ['GC · G*', 'XRPD · A2*']);
    assert.equal((await rec('A')).state.files.length, 3);
    // Closed with Save, an edit made while that save waits: the tab stays, the edit in it, unsaved.
    await hold(page); await loadFiles(page, 'xrd', [s3]);
    await page.locator('#tabBar .ptab').nth(1).locator('.ptab-x').click();
    await page.waitForSelector('.pwa-confirm.show'); await answer(page, 'ok');
    await relabel(page, 'xrd', 'later'); await release(page); await drain(page);
    assert.deepEqual(await tabLabels(page), ['GC · G*', 'XRPD · A2*']);
    r = await rec('A2');
    assert.deepEqual([r.state.files.length, labels(r)[0]], [4, 'late']);
    // Saved, then closed with Save while that save waits: closed, saved.
    await hold(page); await loadFiles(page, 'xrd', [s4]);
    await press(page);
    await page.locator('#tabBar .ptab').nth(1).locator('.ptab-x').click();
    await page.waitForSelector('.pwa-confirm.show'); await answer(page, 'ok');
    await release(page); await drain(page);
    await page.waitForFunction(()=> document.querySelectorAll('#tabBar .ptab').length === 1);
    r = await rec('A2');
    assert.deepEqual([r.state.files.length, labels(r)[0]], [5, 'later']);
    assert.equal((await dumpDb(page)).sessions.length, 2);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
