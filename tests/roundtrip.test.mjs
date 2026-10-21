/* Projects keep their files' bytes: a saved project (IndexedDB, base64), the page reloaded,
   a .datatreat export (signed, base64) imported back, a record in the old format (bytes as
   an array of numbers, to v470) and a v473–v483 .json export (bytes as arrays, no header)
   all give each file back byte for byte from its download button. Files that are not a
   project are refused, doubtful ones asked about. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { start, openModule, loadFiles, saveAs, tabLabels, download, idb, ready, settle, exportProject, signature,
  projectFile, importProject, openProject } from './helpers.mjs';

let env;
before(async ()=>{ env = await start(); });
after(()=> env && env.close());

const dlFile = (page, mod, i = 0)=> download(page, ()=> page.locator(`#${mod}FileTableWrap .dl-file`).nth(i).click());
const same = (buf, p, what)=> assert.ok(buf.equals(fs.readFileSync(p)), what + ': not byte for byte the original');
// The state with every file's bytes as an array of numbers (the old forms).
const asArrays = v => Array.isArray(v) ? v.map(asArrays) : v && typeof v === 'object'
  ? (v.__t === 'u8' ? [...Buffer.from(v.v, 'base64')] : Object.fromEntries(Object.entries(v).map(([k, x])=> [k, asArrays(x)]))) : v;

test('XRPD: saved, reloaded, exported, imported, old formats: the originals byte for byte', async ()=>{
  const { page, errors, close } = await env.page();
  const [s0, s1] = env.fx.files.xrd;
  try {
    await openModule(page, 'xrd');
    await loadFiles(page, 'xrd', [s0, s1]);
    await saveAs(page, 'RT');
    // IndexedDB: the bytes as base64, tagged.
    const [rec] = await idb(page);
    assert.equal(rec.state.files[0].rawBytes.__t, 'u8');
    assert.ok(Buffer.from(rec.state.files[0].rawBytes.v, 'base64').equals(fs.readFileSync(s0)), 'stored bytes');
    // Reloaded: the tab comes back saved, its file downloads whole.
    await page.reload(); await ready(page); await settle(page);
    assert.deepEqual(await tabLabels(page), ['XRPD · RT']);
    const d0 = await dlFile(page, 'xrd', 0), d1 = await dlFile(page, 'xrd', 1);
    assert.equal(d0.name, 's00.xrdml');
    same(d0.buf, s0, 'after a reload, s00'); same(d1.buf, s1, 'after a reload, s01');
    // The export: a signed .datatreat, its bytes base64.
    const ex = await exportProject(page);
    assert.match(ex.name, /^xrd_RT\.datatreat$/);
    assert.equal(ex.obj.format, 'datatreat-project');
    assert.equal(ex.obj.signature.value, signature(ex.obj.module, ex.obj.state), 'the signature is SHA-256 of [module, state]');
    assert.ok(Buffer.from(ex.obj.state.files[0].rawBytes.v, 'base64').equals(fs.readFileSync(s0)), 'exported bytes');
    // Imported back with no question, opened: the same bytes.
    const f = projectFile(env, 'rt-copy.datatreat', { ...ex.obj, title: 'RT copy' });
    assert.equal(await importProject(page, f), null, 'a signed file imports with no question');
    await openProject(page, 'xrd', 'RT copy');
    same((await dlFile(page, 'xrd', 1)).buf, s1, 'imported .datatreat, s01');
    // A v473–v483 .json export (bytes as arrays, no header, no signature): asked, opens whole.
    const old = { datatreat_session: 1, module: 'xrd', title: 'RT v483', createdAt: 1, updatedAt: 1, state: asArrays(ex.obj.state) };
    const asked = await importProject(page, projectFile(env, 'xrd_RT_v483.json', old), { expectDoubt: true });
    assert.match(asked.text, /does not end in \.datatreat.*no DataTreat signature/);
    await openProject(page, 'xrd', 'RT v483');
    same((await dlFile(page, 'xrd', 0)).buf, s0, 'v483 .json export, s00');
    // A record stored in the old format (to v470: bytes as arrays) still opens and downloads.
    await page.evaluate(async rec=>{
      const db = await new Promise(res=>{ const r = indexedDB.open('datatreat'); r.onsuccess = ()=> res(r.result); });
      await new Promise(res=>{ const t = db.transaction('sessions', 'readwrite'); t.objectStore('sessions').put(rec); t.oncomplete = res; });
      db.close();
    }, { ...rec, id: 'oldfmt', title: 'Old format', state: asArrays(rec.state) });
    await page.click('#nav button[data-tab="home"]');
    await openProject(page, 'xrd', 'Old format');
    same((await dlFile(page, 'xrd', 0)).buf, s0, 'old-format record, s00');
    same((await dlFile(page, 'xrd', 1)).buf, s1, 'old-format record, s01');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('SEM: a saved project gives its TIFFs back byte for byte after a reload', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'sem');
    await loadFiles(page, 'sem', env.fx.files.sem);
    await saveAs(page, 'Images');
    await page.reload(); await ready(page); await settle(page);
    await page.waitForFunction(()=> document.querySelectorAll('#semThumbs .sem-thumb').length === 3);
    for (let i = 0; i < 3; i++) same((await dlFile(page, 'sem', i)).buf, env.fx.files.sem[i], 'SEM image ' + i);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('import: not a project refused; changed after signing, or newer, asked', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'gc');
    await loadFiles(page, 'gc', env.fx.files.gc);
    const ex = await exportProject(page);
    let said = await importProject(page, env.fx.put('junk.datatreat', 'not json {'), { refused: true });
    assert.match(said.text, /“junk\.datatreat” is not a DataTreat project/);
    said = await importProject(page, projectFile(env, 'arr.datatreat', { ...ex.obj, state: [1, 2] }), { refused: true });
    assert.match(said.text, /is not a DataTreat project/);
    const edited = { ...ex.obj, title: 'Edited', state: { ...ex.obj.state, files: ex.obj.state.files.slice(0, 1) } };
    said = await importProject(page, projectFile(env, 'edited.datatreat', edited), { expectDoubt: true, answerDoubt: 'x' });
    assert.match(said.text, /its content changed after DataTreat signed it/);
    assert.equal(await page.locator('#sessListWrap tr.sess-row').count(), 0, 'not imported when not confirmed');
    said = await importProject(page, projectFile(env, 'newer.datatreat', { ...ex.obj, title: 'Newer', formatVersion: 99, appVersion: 'v999' }), { expectDoubt: true });
    assert.match(said.text, /written by a newer DataTreat \(v999\)/);
    assert.equal(await page.locator('#sessListWrap tr.sess-row').count(), 1);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
