/* v583, CLAUDE.md's backward compatibility: an old project opens as this version reads it. The
   modules with no saved results (GC's Production Rate, DRS, EPR, SEM's figure), each from a
   project of now made here and reshaped as older versions saved theirs (synthetic: never a
   user's file), signed and imported through Projects › Import: it opens with no error, its old
   fields ignored (settings at the top level, before the cards; old keys and units), the
   defaults in their place, its data read again from its files' bytes where it holds other
   arrays (an older reader's), what the cards show worked out anew from them (the CSVs those of
   the same files loaded now), and a file whose bytes are numbers (to v483) one of no bytes:
   its data the project's, said under the drop zone (ALERTS-REVIEW.md U8), its download none.
   v586: the card made for a project that has none a new card (DRS: its lines suggested, E_g
   worked out; to v585 the default lines), as the cards of the same files loaded now; XRPD (a
   project from before the cards, the standard named among the samples, arrays an older version
   read, an instrument an older reader read; a Scherrer card's widths in points, the steps'
   note, no CIFs): a new project's cards, the arrays and the instrument read from the bytes,
   the default widths, nothing said of the old ones. v588: GC's Integration card (results of no
   engine's id, to v587, and of another engine's, a calibration of v544–v548 with no table):
   every chromatogram integrated again with the windows applied, the calibration none, nothing
   said; an undo, a redo and the page reloaded integrate nothing. v589: a DRS project opened with
   every file left out, its cards waiting for their lines: suggested as a file is taken in. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { start, openModule, loadFiles, settle, moduleState, exportProject, projectFile, importProject, openProject, download, readZip, banner, answer, undo, ready, until, saveAs, ROOT } from './helpers.mjs';

const TCD = await import(pathToFileURL(path.join(ROOT, 'gc-tcd.js')).href);

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
    assert.deepEqual(c, now.cards, 'a new card, as the files loaded now have (v586)');
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
    const { now, csv } = await reopenOld(page, 'tauc', env.fx.files.tauc, 'DRS old', st=>{
      const t = st.analyses[0].states.tauc;
      delete st.analyses;
      Object.assign(st, { mode: 'per', shared: { a: 2, w: 0.03, W: 0.25 }, vlines: t.sharedVlines, params: { taucA: '2', taucN: '4' }, urbachOn: true, urbach: { shared: { W: 0.2 } } });
      st.files[0].FR = st.files[0].FR.map(v=> v*2);
      st.files[0].hv = [1, 2];
      st.files[1].rawBytes = numbers(st.files[1].rawBytes);
    });
    const s = await moduleState(page, 'tauc', true), a = s.analyses;
    assert.deepEqual(a.map(k=> [k.type, k.states.tauc.mode, k.states.tauc.shared]), [['tauc', 'shared', { a: 0.5, N: 1, N2: 20, M: 25, M2: 100 }]], 'one Tauc card of the defaults');
    // (v586: a new card, its lines suggested as on the files loaded now, its E_g theirs; to v585
    // the default lines, E_g none where they fell outside the edge)
    assert.deepEqual([a, a[0].states.tauc.suggested], [now.analyses, true], 'a new card');
    assert.deepEqual(await csvs(page), csv, 'the CSVs of those files loaded now');
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
    assert.deepEqual(s.cards, now.cards, 'a new card, as the files loaded now have (v586)');
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

/* v587: an Urbach card as versions to v568 saved it: its lines common (sharedVlines), none of
   its samples' own, no flag. Its common lines no parameter any more: the card's state a new
   card's, its lines suggested on its reference's regions as those of a card added now (to v586
   its common lines counted as placed: the default lines, kept with them). */
test('DRS: an Urbach card of common lines (to v568): its lines suggested as a card added now has them (v587)', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await reopenOld(page, 'tauc', env.fx.files.tauc, 'Urbach old', st=>{
      const t = st.analyses[0];
      st.analyses.push({ ...t, id: 2, type: 'urbach', ref: 1, refAuto: true, states: { urbach: { mode: 'shared', shared: {}, sharedVlines: { v1: 2.5, v2: 2.7 }, per: t.states.tauc.per.map(()=> ({})) } } });
    });
    await page.click('#taucAddAn'); await page.click('.an-menu:not([hidden]) [data-kind="urbach"]'); await settle(page);
    const a = (await moduleState(page, 'tauc')).analyses, old = a[1].states.urbach, added = a[2].states.urbach;
    assert.deepEqual([a.map(k=> [k.type, k.ref]), old.sharedVlines, old.suggested], [[['tauc', null], ['urbach', 1], ['urbach', 1]], {}, true]);
    assert.deepEqual(old.per.map(q=> q.vlines), added.per.map(q=> q.vlines), 'its lines a new card\'s');
    assert.ok(old.per.every(q=> q.vlines && Number.isFinite(q.vlines.v1)));
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

/* v589: a DRS project opened with every file left out, its cards waiting for their lines: the
   Tauc card's state a new card's (no lines, no flag: the one made for a project with none, or an
   older version's), an Urbach card's as v587 saved a card added with no file there (no lines, its
   flag false). Hidden while no file is in; a file taken back in, their lines suggested as those
   of the cards added now (to v588 the default lines: their suggestion only as the project
   opened, with no file to suggest from). */
test('DRS: a project opened with every file left out, its cards waiting for their lines: suggested as a file is taken in, as cards added now (v589)', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await reopenOld(page, 'tauc', env.fx.files.tauc, 'DRS left out', st=>{
      st.files.forEach(f=>{ f.included = false; f.held = {}; });
      const t = st.analyses[0];
      t.states = { tauc: { mode: 'shared', shared: {}, sharedVlines: {}, per: [] } };
      st.analyses.push({ ...t, id: 2, type: 'urbach', ref: 1, refAuto: true, states: { urbach: { mode: 'shared', shared: {}, per: [], suggested: false } } });
    });
    assert.equal(await page.locator('#taucAnalyses').isVisible(), false, 'no file in: the cards hidden');
    await page.locator('#taucFileTableWrap .incl-all').click(); await settle(page);
    // Cards added now, on the same files: a Tauc card (3), an Urbach card read against it (4).
    for (const k of ['tauc', 'urbach']){ await page.click('#taucAddAn'); await page.click(`.an-menu:not([hidden]) [data-kind="${k}"]`); await settle(page); }
    const a = (await moduleState(page, 'tauc')).analyses, st = (i, k)=> a[i].states[k];
    assert.deepEqual(a.map(x=> [x.id, x.type, x.ref]), [[1, 'tauc', null], [2, 'urbach', 1], [3, 'tauc', null], [4, 'urbach', 3]]);
    assert.ok(Number.isFinite(st(2, 'tauc').sharedVlines.v1) && st(3, 'urbach').per.every(q=> q.vlines && Number.isFinite(q.vlines.v1)), 'the cards added: lines');
    assert.deepEqual([st(0, 'tauc').suggested, st(0, 'tauc').sharedVlines], [true, st(2, 'tauc').sharedVlines], 'the Tauc card: a card added\'s lines');
    assert.deepEqual([st(1, 'urbach').suggested, st(1, 'urbach').per.map(q=> q.vlines)], [true, st(3, 'urbach').per.map(q=> q.vlines)], 'the Urbach card: a card added\'s lines');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

/* v586: an XRPD project from before the cards (to v459: one Analysis's settings at the top
   level, the standard a sample named in standardName, a Rietveld at `rv`), a pattern whose
   intensities the project holds with their minimum subtracted (to v262), one whose instrument
   an older reader read (other values, no measurement's index). */
test('XRPD: a project from before the cards, arrays and an instrument an older version read: a new project\'s cards, the bytes\' arrays and instrument, nothing said (v586)', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    const { now, csv } = await reopenOld(page, 'xrd', env.fx.files.xrd, 'XRPD old', st=>{
      const sc = st.cards[0].states.scherrer;
      delete st.cards; delete st.stdPeaks; delete st.stdRv;
      Object.assign(st, { standardName: st.files[1].name, stdParams: { smoothW: 0 }, perParams: sc.perParams.map(q=> ({ ...q, pkHeight: 9 })), manualPeaks: [[30], [], []],
        removedPeaks: [[], [], []], shared: { ...sc.shared, smoothW: 0.5 }, paramMode: sc.paramMode, rv: { results: {}, fit: { maxIter: 3 } }, curIdx: 2 });
      const y = st.files[0].y, lo = Math.min(...y);
      st.files[0].y = y.map(v=> v - lo);
      st.files[2].instr = { lam1: 1.6, lam2: 1.61, ratio: 0.4, radius: 200, monochromator: false, monochromators: [], warnings: [] };
    });
    const s = await moduleState(page, 'xrd', true);
    // (v587: a sample's own settings in a Scherrer card made with the files there the shared
    // values, as in the first card of a tab, there before them: the same state; to v586 {blOn: true})
    assert.deepEqual(s.cards, now.cards, 'a new project\'s cards, its settings ignored');
    assert.deepEqual([s.std, s.files.map(f=> f.name)], [null, now.files.map(f=> f.name)], 'the standard named a sample');
    assert.deepEqual(s.files[0].y, now.files[0].y, 'read again from its bytes');
    assert.equal(await page.locator('#xrdAlerts .alert').count(), 0, 'nothing said');
    assert.deepEqual(await csvs(page), csv, 'the CSVs of those files loaded now');
    // s02 on show: its instrument read from its file's bytes, not the one the project held
    await page.waitForFunction(()=> /\S/.test(document.querySelector('#xrdR2Instr').textContent));
    assert.match(await page.textContent('#xrdR2Instr'), /Kα₁ 1\.540598 Å/);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

/* v586: a Scherrer card's settings as older versions saved them: the widths in points (N, blWin,
   to v510), the note of patterns at different steps and the points held for files left out
   (v511-v585), and no samples' CIFs, its peaks matched across its samples (to v574). */
test('XRPD: a Scherrer card\'s widths in points, the steps\' note, no CIFs: the default widths, no CIF, nothing said (v586)', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    const { now, csv } = await reopenOld(page, 'xrd', env.fx.files.xrd, 'Scherrer old', st=>{
      const sc = st.cards[0].states.scherrer, pts = ({ smoothW: _s, snipW: _w, ...q })=> ({ ...q, N: 10, blWin: 150 });
      delete sc.cif; delete sc.cifTexts;
      Object.assign(sc, { shared: pts(sc.shared), perParams: sc.perParams.map(pts), stepNote: ['N', 'blWin'], heldPts: { N: 9, blWin: 120, blOn: false }, oldGroups: true, sizeBy: 'peak' });
    });
    const sc = (await moduleState(page, 'xrd')).cards[0].states.scherrer, was = now.cards[0].states.scherrer;
    assert.deepEqual([sc.shared, sc.perParams, sc.paramMode, sc.cif], [was.shared, was.perParams.map(({ smoothW: _s, snipW: _w, ...q })=> q), was.paramMode, [null, null, null]]);
    assert.ok(['stepNote', 'heldPts', 'oldGroups', 'N', 'blWin'].every(k=> !(k in sc) && !(k in sc.shared)), 'the old fields none');
    assert.deepEqual([await page.locator('#xrdA1StepNote').count(), await page.innerHTML('#xrdA1CifNote')], [0, ''], 'nothing said in the card');
    assert.deepEqual(await csvs(page), csv, 'the CSVs of those files loaded now');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

/* ---- GC's raw chromatograms (synthetic, as gctcd-ui.test.mjs draws them): the engine's own peak
   model at known areas, a seeded noise, on 250–340 s; the GC table of the same injections, one
   every 20 min; the standards' table (UTF-16, its Analysis column) ---- */
const TT = Array.from({ length: 451 }, (_, i)=> (1250 + i)/5);
const gcRuns = (k0, n)=> Array.from({ length: n }, (_, k)=> [0.05 + 0.01*(k + k0), 0.03 + 0.002*(k + k0)]);
function tcdFile(name, rows){
  const shape = (A, mu)=> ({ A, mu, sigma: 0.5, dmu: 0.35, fc: 0.25, tau1: 0.7, tau2: 4.0, w2: 0.06 });
  let s = 7919*name.length;
  const u = ()=>{ s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return (s + 0.5)/4294967296; }, z = ()=> Math.sqrt(-2*Math.log(u()))*Math.cos(2*Math.PI*u());
  const ys = rows.map(([h, o])=>{ const P = [TCD.peakShape(TT, shape(h*40000, 287.0)), TCD.peakShape(TT, shape(o*12000, 302.0)), TCD.peakShape(TT, shape(300, 310.1))]; return TT.map((t, i)=> -5000 + 0.8*(t - 297) + TCD.step(t, -12, 305.6, 0.8) + P[0][i] + P[1][i] + P[2][i] + z()); });
  const n = v => String(+v.toFixed(5)).replace('.', ',');
  return { name, mimeType: 'text/csv', buffer: Buffer.from(TT.map((t, i)=> [n(t), ...ys.map(y=> n(y[i]))].join(';') + ';').join('\r\n') + '\r\n') };
}
const gcTable = (name, rows)=> ({ name, mimeType: 'text/csv', buffer: Buffer.from('Injection Date,H2 (A) [%Mol],O2 (A) [%Mol]\n'
  + rows.map(([h, o], k)=>{ const m = 600 + 20*k; return `11/13/2026 ${Math.floor(m/60)}:${String(m % 60).padStart(2, '0')}:00,${h},${o}\n`; }).join('')) });
const STD = [[0.05, 0], [0.1, 0], [0.2, 0], [0, 0.02], [0, 0.05], [0, 0.1]];
const stdTable = name => ({ name, mimeType: 'text/csv', buffer: Buffer.from('﻿' + ['"Analysis";"Injection date";"H2 (B) [%Mol]";"O2 (B) [%Mol]";',
  ...STD.map((_, k)=> `"cal_${k + 1}";10/29/2026 10:${String(10 + 5*k).padStart(2, '0')}:36 AM;0.00000;0.00000;`)].join('\r\n') + '\r\n', 'utf16le') });
const fitted = page => page.evaluate(async ()=> (await import('./utils.js')).kept.made['gc-tcd'] || 0);
const winTo = async (card, v)=>{ const f = card.locator('.gci-method input[data-k="w0:to"]'); await f.fill(String(v)); await f.press('Enter'); };
const stateOf = card => card.locator('.gci-status').getAttribute('data-state');

/* v588: an Integration card's project as older versions saved it, made here from one of now: its
   results (areas made double, so that any taken would show) under keys of no engine's id (as to
   v587) and of another engine's, its windows applied (to 328 s) and others edited (330 s), its
   calibration of v544–v548 (raw chromatograms alone, levels typed). It opens with every
   chromatogram of its files integrated again, once, with the windows applied (its CSVs those of
   the same files integrated now, before the standards), the windows edited still pending, the
   calibration none (its window the drop zone alone), nothing said; its results this engine's
   from then on: an undo, a redo and the page reloaded integrate nothing. Fails on v586. */
test('GC Integration: results of no engine\'s id and of another\'s integrated again with the windows applied, a calibration of no table none; then nothing integrated (v588)', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'gc');
    await loadFiles(page, 'gc', [gcTable('a.csv', gcRuns(0, 4)), tcdFile('a_TCD.csv', gcRuns(0, 4)), gcTable('bb.csv', gcRuns(4, 4)), tcdFile('bb_TCD.csv', gcRuns(4, 4))], 2);
    const card = page.locator('#tab-gc .an-card').nth(0), m = page.locator('.gci-cal-modal');
    await until(async ()=> await stateOf(card) === 'done', { timeout: 60000, what: 'the files integrated' });
    await winTo(card, 328); await settle(page);
    await page.waitForTimeout(650); await card.locator('.gci-integ').click();
    await until(async ()=> await stateOf(card) === 'done', { timeout: 60000, what: 'Integrate' });
    await settle(page);
    const csv = await csvs(page);
    await card.locator('.gci-cal').click(); await m.waitFor({ state: 'visible' });
    await m.locator('.gci-cal-in').setInputFiles([stdTable('std.csv'), tcdFile('std_TCD.csv', STD)]);
    await page.waitForFunction(()=> /^6 chromatograms integrated\.$/.test(document.querySelector('.gci-cal-modal .gci-cal-status').textContent), null, { timeout: 60000 });
    for (const j of [0, 1, 2]){ const f = m.locator(`input[data-j="${j}"][data-g="h2"]`); await f.fill(String(STD[j][0])); await f.press('Enter'); await settle(page); }
    await m.locator('.xrd-std-x').click(); await settle(page);
    assert.notDeepEqual(await csvs(page), csv, 'the standards\' line taken');
    await winTo(card, 330); await settle(page);
    const n0 = await fitted(page), { obj } = await exportProject(page), st = obj.state, stamp = `|${TCD.ENGINE_ID}|`, keys = Object.keys(st.integ);
    assert.ok(keys.length === 3 && keys.every(k=> k.includes(stamp + '[["H2O2",268,328],')), keys.join(' '));
    const twice = rs => rs.map(r=> r && { ...r, gases: Object.fromEntries(Object.entries(r.gases).map(([g, x])=> [g, { ...x, area: 2*x.area }])) });
    st.integ = Object.fromEntries(keys.map((k, i)=> [k.replace(stamp, i ? '|tcd-0|' : '|'), twice(st.integ[k])]));
    const c0 = st.cards.find(c=> c.type === 'integ');
    c0.cal.files = c0.cal.files.map(({ table: _t, ...f })=> f);
    assert.ok(c0.cal.files[0].levels.some(l=> l.h2 === 0.1), 'its levels typed');
    await importProject(page, projectFile(env, 'GC integ old.datatreat', { ...obj, title: 'GC integ old', state: st }, { sign: true }));
    await openProject(page, 'gc', 'GC integ old');
    const card2 = page.locator('#tab-gc .an-card').nth(0);
    await until(async ()=> (await fitted(page)) >= n0 + 8, { timeout: 60000, what: 'its chromatograms integrated' });
    await page.waitForTimeout(1000); await settle(page);
    assert.equal(await fitted(page), n0 + 8, 'each chromatogram of its files once, no standard');
    const s = await moduleState(page, 'gc'), integ = s.cards.find(c=> c.type === 'integ');
    assert.ok(Object.keys(s.integ).length === 2 && Object.keys(s.integ).every(k=> k.includes(stamp + '[["H2O2",268,328],')), 'this engine\'s, the windows applied: ' + Object.keys(s.integ).join(' '));
    assert.deepEqual([integ.method.windows[0].to, integ.edit.windows[0].to, integ.cal.files, await stateOf(card2)], [328, 330, [], 'pending'], 'the windows edited pending still; the calibration none');
    assert.deepEqual(await csvs(page), csv, 'the CSVs of those files integrated now');
    await card2.locator('.gci-cal').click(); await m.waitFor({ state: 'visible' }); await settle(page);
    assert.deepEqual(await m.evaluate(M=> [M.classList.contains('gci-cal-none'), M.querySelectorAll('.xrd-std-row, .gci-cal-levels tbody tr, .alert').length]), [true, 0], 'the drop zone alone, nothing said');
    await m.locator('.xrd-std-x').click(); await settle(page);
    // an undo and a redo (the overview's gas, a step), then the project saved and the page
    // reloaded: nothing integrated
    await card2.locator('.gci-ov-chip[data-g="o2"]').click(); await settle(page);
    await undo(page); await undo(page, true); await page.waitForTimeout(500);
    assert.equal(await fitted(page), n0 + 8, 'undo and redo: nothing');
    await saveAs(page, 'GC integ old');
    await page.reload(); await ready(page);
    await page.waitForSelector('#tab-gc.active'); await page.waitForTimeout(1000); await settle(page);
    assert.deepEqual([await fitted(page), Object.keys((await moduleState(page, 'gc')).integ)], [0, Object.keys(s.integ)], 'reloaded: nothing');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
