/* v583, CLAUDE.md's backward compatibility: an old project opens as this version reads it. The
   modules with no saved results (GC's Production Rate, DRS, EPR, SEM's figure), each from a
   project of now made here and reshaped as older versions saved theirs (synthetic: never a
   user's file), signed and imported through Projects › Import: it opens with no error, its old
   fields ignored (settings at the top level, before the cards; old keys and units), the
   defaults in their place, its data read again from its files' bytes where it holds other
   arrays (an older reader's), what the cards show worked out anew from them (the CSVs those of
   the same files loaded now), and a file whose bytes are numbers (to v483) one of no bytes:
   its data the project's, said under the drop zone (ALERTS-REVIEW.md U8), its download none. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start, openModule, loadFiles, settle, moduleState, exportProject, projectFile, importProject, openProject, download, readZip, banner, answer } from './helpers.mjs';

let env;
before(async ()=>{ env = await start(); });
after(()=> env && env.close());

// The project bar's CSVs, by name.
const csvs = async page => Object.fromEntries(readZip((await download(page, ()=> page.click('.proj-csv'))).buf).map(e=> [e.name, e.data.toString('utf8')]));
// A file's bytes as an export holds them ({ __t: 'u8', v }), as numbers (a .json of v473–v483).
const numbers = b => [...Buffer.from(b.v, 'base64')];
/* `files` loaded into a new tab of `mod`, its CSVs taken, the project exported, reshaped by
   `old` (its state, in place), signed again, imported as `title` and opened. → { now: the state
   exported, csv: the CSVs of the files loaded now } */
async function reopenOld(page, mod, files, title, old){
  await openModule(page, mod);
  await loadFiles(page, mod, files);
  const csv = await csvs(page), { obj } = await exportProject(page), st = JSON.parse(JSON.stringify(obj.state));
  old(st);
  await importProject(page, projectFile(env, title + '.datatreat', { ...obj, title, state: st }, { sign: true }));
  await openProject(page, mod, title);
  return { now: obj.state, csv };
}
// What the drop zone's alerts say a project opened holds of no bytes (U8): the names said so.
async function heldSaid(page, mod){
  const t = await page.locator(`#${mod}Alerts`).innerText();
  return [...t.matchAll(/^(.*): its bytes are not stored: its data are those the project holds\.$/gm)].map(m=> m[1]);
}
// A file's download, its bytes not there: said so, nothing downloaded.
async function noDownload(page, mod, i, name){
  await page.locator(`#${mod}FileTableWrap .dl-file`).nth(i).click();
  await page.waitForSelector('.pwa-confirm.show');
  assert.equal((await banner(page)).text, `“${name}”: its original bytes are not stored in this browser any more: it cannot be downloaded.`);
  await answer(page, 'ok');
}

test('GC: a project from before the cards, one interval, the paired modes, the single gas selector, no T; a table read again, one of no bytes', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    const { now, csv } = await reopenOld(page, 'gc', env.fx.files.gc, 'GC old', st=>{
      const c = st.cards[0];
      delete st.cards;
      Object.assign(st, { plateauStart: '0.5', plateauEnd: '3', mqMode: 'one', intMode: 'one', gasMode: { a: 'h2' }, ms: c.ms.map(()=> 10) });
      st.files[0].gas.h2 = st.files[0].gas.h2.map(v=> v == null ? v : v*2);
      st.files[1].rawBytes = numbers(st.files[1].rawBytes);
    });
    const s = await moduleState(page, 'gc', true), c = s.cards;
    assert.deepEqual(c.map(k=> [k.type, k.mMode, k.qMode, k.startMode, k.endMode, k.startShared, k.endShared, k.tShared, k.ms]),
      [['rate', 'all', 'all', 'all', 'all', 0, 24, 25, [15, 15]]], 'one card of the defaults: 25 °C, all, every gas');
    assert.deepEqual(c[0].gasSel, { a: ['h2', 'o2'], r: ['h2', 'o2'] });
    assert.deepEqual(s.files[0].gas, now.files[0].gas, 'read again from its bytes');
    assert.deepEqual([s.files[1].rawBytes, s.files[1].gas], [null, now.files[1].gas]);
    assert.deepEqual(await heldSaid(page, 'gc'), ['beta.csv']);
    assert.deepEqual(await csvs(page), csv, 'the rates of those files loaded now');
    await noDownload(page, 'gc', 1, 'beta.csv');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('DRS: a project from before the cards, its fields by their ids, its lines at the top, widths in eV, energies held; a spectrum read again, one of no bytes', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    const { now } = await reopenOld(page, 'tauc', env.fx.files.tauc, 'DRS old', st=>{
      const t = st.analyses[0].states.tauc;
      delete st.analyses;
      Object.assign(st, { mode: 'per', shared: { a: 2, w: 0.03, W: 0.25 }, vlines: t.sharedVlines, params: { taucA: '2', taucN: '4' }, urbachOn: true, urbach: { shared: { W: 0.2 } } });
      st.files[0].FR = st.files[0].FR.map(v=> v*2);
      st.files[0].hv = [1, 2];
      st.files[1].rawBytes = numbers(st.files[1].rawBytes);
    });
    const s = await moduleState(page, 'tauc', true), a = s.analyses;
    assert.deepEqual(a.map(k=> [k.type, k.states.tauc.mode, k.states.tauc.shared]), [['tauc', 'shared', { a: 0.5, N: 1, N2: 20, M: 25, M2: 100 }]], 'one Tauc card of the defaults');
    assert.deepEqual([s.files[0].FR, 'hv' in s.files[0]], [now.files[0].FR, false], 'read again from its bytes');
    assert.deepEqual([s.files[1].rawBytes, s.files[1].FR], [null, now.files[1].FR]);
    assert.deepEqual(await heldSaid(page, 'tauc'), ['drs2.csv']);
    const eg = Object.entries(await csvs(page)).find(([k])=> k.endsWith(' - Eg.csv'))[1].trim().split('\n');
    assert.deepEqual(eg.slice(1).map(r=> r.split(';')[0]), ['drs1', 'drs2'], 'E_g worked out for each');
    await noDownload(page, 'tauc', 1, 'drs2.csv');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('EPR: a project from before the cards, its smoothing in points; a spectrum read again, a pair of no bytes', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    const { now, csv } = await reopenOld(page, 'epr', env.fx.files.epr, 'EPR old', st=>{
      delete st.cards;
      Object.assign(st, { smooth: '4', norm: 'local' });
      st.files[0].a = st.files[0].a.map(v=> v + 1);
      st.files[1].rawFiles = st.files[1].rawFiles.map(f=> ({ ...f, bytes: numbers(f.bytes) }));
    });
    const s = await moduleState(page, 'epr', true);
    assert.deepEqual(s.cards.map(k=> [k.type, k.norm, k.smoothW, 'smooth' in k]), [['spectra', 'global', 0.2, false]], 'one card of the defaults');
    assert.deepEqual(s.files[0].a, now.files[0].a, 'read again from its bytes');
    assert.deepEqual([s.files[1].rawFiles.map(f=> f.bytes), s.files[1].a], [[null, null], now.files[1].a]);
    assert.deepEqual(await heldSaid(page, 'epr'), ['e2.DTA + e2.DSC']);
    assert.deepEqual(await csvs(page), csv, 'the spectra of those files loaded now');
    await noDownload(page, 'epr', 1, 'e2.DTA');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('SEM: a figure of v439–v449 (positions as corners and sides, the middle row as m, a height from the layout) and one for every group: the composer opens on the defaults', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await reopenOld(page, 'sem', env.fx.files.sem, 'SEM old', st=>{
      st.figures = Object.fromEntries(st.groups.map(g=> [g.id, { wmm: 120, align: 'mc', hAuto: false, hmm: 50, label: { pos: 'tl' }, letter: { on: true, pos: 'below' }, bar: { pos: 'left' } }]));
      st.figure = { wmm: 99 };
    });
    await page.waitForFunction(()=> document.querySelectorAll('#semThumbs .sem-thumb').length === 3);
    await page.locator('#semGroups .sem-group-fig:not([disabled])').first().click();
    await page.waitForSelector('.fig-backdrop .fig-svg image');
    await settle(page);
    // (the names placed by row, the letters and the bars inside, as a new figure's)
    const pos = await page.$$eval('.fig-backdrop select[data-p$=".pos"]', ss=> ss.map(s=> [s.dataset.p, s.value]));
    assert.deepEqual(pos, [['label.pos', 'auto'], ['letter.pos', 'in'], ['bar.pos', 'in']], 'the old positions none: the defaults');
    await page.keyboard.press('Escape');
    await page.waitForFunction(()=> !document.querySelector('.fig-backdrop'));
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
