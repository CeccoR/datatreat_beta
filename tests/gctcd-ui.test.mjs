/* GC's raw chromatograms (v544, a prototype): the TCD files beside their tables, paired in
   the trace list, integrated again by the Integration card, and the Production Rate cards
   below it taking the re-integrated values. Every file here is made up for the test: the
   chromatograms drawn from the engine's own peak model (gc-tcd.js) with known areas, a
   seeded noise, on 250–340 s (the H₂/O₂ window, 268–326 s, inside).
   - Tables alone: as v543 (no file grip, no Integration card, "+" adds a Production Rate card
     with no menu, no key more in the state).
   - Auto-pairing by name: a final _TCD, any case, a browser's " (1)" on either name, the .txt
     table; a file of raw chromatograms told by its content (no _TCD in its name); one row a
     pair, both names in FILE, the table's label, one Sample select (none for raw
     chromatograms alone), the row's download both files.
   - The two grips: a file onto a file alone pairs (its partner left alone), onto a paired one
     swaps, off every file stands alone; the row's ≡ reorders; each a step, "*", undone.
   - Two tables paired (the first used, the second ignored, said) and two files of raw
     chromatograms paired (shown in Integration, no sample, said); raw chromatograms alone.
   - A count that differs: said in Integration, the table's values in Analysis, gc_raw.csv's
     source column saying why.
   - The Integration card: its two selectors and arrows, its plots, the overview clicked.
   - The calibration window: levels typed, free and zero intercept, %mol and ppm, its line.
   - No standards: the GC software's scale taken over (k = median of area/table value), said
     in an info alert in Integration and in the rate card.
   - The rates from the re-integrated values against a hand calculation from the known areas.
   - The project saved and reloaded: pairs, method, calibration and results, nothing fitted
     again; a method changed (a step) and undone, nothing fitted again; results coming in no
     step. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { start, openModule, settle, moduleState, history, undo, download, readZip, parseCsv, tabLabels, saveAs, ready, ROOT } from './helpers.mjs';

const G = await import(pathToFileURL(path.join(ROOT, 'gc-tcd.js')).href);

let env;
before(async ()=>{ env = await start(); });
after(()=> env && env.close());

/* ---- The files ---- */
function normal(seed){
  let s = seed >>> 0;
  const u = ()=>{ s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return (s + 0.5)/4294967296; };
  return ()=> Math.sqrt(-2*Math.log(u()))*Math.cos(2*Math.PI*u());
}
const shape = (A, mu)=> ({ A, mu, sigma: 0.5, dmu: 0.35, fc: 0.25, tau1: 0.7, tau2: 4.0, w2: 0.06 });
const T = Array.from({ length: 451 }, (_, i)=> (1250 + i)/5);         // 250–340 s, step 0.2 s
// A chromatogram of known H₂ and O₂ areas (the system peak and the step as the real ones).
function chromatogram(h2, o2, seed){
  const z = normal(seed), P = [G.peakShape(T, shape(h2, 287.0)), G.peakShape(T, shape(o2, 302.0)), G.peakShape(T, shape(300, 310.1))];
  return T.map((t, i)=> -5000 + 0.8*(t - 297) + G.step(t, -12, 305.6, 0.8) + P[0][i] + P[1][i] + P[2][i] + z());
}
// A TCD file as the instrument writes it: `;`, a decimal comma, no header, every line ending
// with `;` (`tab`: tab-separated with a decimal point, as the engine reads too).
function tcd(name, cols, tab = false){
  const ys = cols.map(([h2, o2], k)=> chromatogram(h2, o2, 101 + 7*k + name.length));
  const n = v => tab ? String(+v.toFixed(5)) : String(+v.toFixed(5)).replace('.', ',');
  const text = T.map((t, i)=> tab ? [n(t), ...ys.map(y=> n(y[i]))].join('\t') : [n(t), ...ys.map(y=> n(y[i]))].join(';') + ';').join('\r\n') + '\r\n';
  return { name, mimeType: 'text/csv', buffer: Buffer.from(text) };
}
// A GC table (the default layout): an injection every 20 min from 13 Nov 2026, 10:00.
const when = k =>{ const m = 10*60 + 20*k; return `11/13/2026 ${Math.floor(m/60)}:${String(m % 60).padStart(2, '0')}:00`; };
function table(name, rows){
  const text = 'Injection Date,H2 (A) [%Mol],O2 (A) [%Mol]\n' + rows.map(([h2, o2], k)=> `${when(k)},${h2},${o2}\n`).join('');
  return { name, mimeType: 'text/csv', buffer: Buffer.from(text) };
}
// The alternative export (.txt, ppm), as gcalt.test.mjs writes it.
function altTable(name, rows){
  const TB = '\t', head = [['No. ', 'Inject Time ', 'Area', 'Area', 'Area ', 'Amount', 'Amount ', 'Amount '].join(TB),
    TB + ['', '', 'pA*min', 'pA*min', 'pA*min', '', '', ''].join(TB), TB + ['', '', ...Array(6).fill('PDD_Ch_1')].join(TB),
    TB + ['', '', 'Hydrogen', 'Nitrogen', 'Oxygen', 'Hydrogen', 'Nitrogen', 'Oxygen'].join(TB)];
  const lines = rows.map(([h2, o2], k)=> [String(k + 1), `13/Nov/2026 ${when(k).slice(11, 16)}`, '1', '1', '1', String(h2*1e4), '300', String(o2*1e4)].join(TB));
  return { name, mimeType: 'text/plain', buffer: Buffer.from([...head, ...lines].join('\r\n') + '\r\n') };
}
/* A run: 12 injections, H₂ rising (0.05 + 0.01 k %mol) and O₂ (0.03 + 0.002 k %mol), their
   areas on a known scale (S_H2, S_O2 area per %mol); the table's values those concentrations
   times `swScale` (a software calibration off by that much). */
const S_H2 = 40000, S_O2 = 12000, N = 12;
const truth = Array.from({ length: N }, (_, k)=> [0.05 + 0.01*k, 0.03 + 0.002*k]);
const areas = (rows = truth)=> rows.map(([h, o])=> [h*S_H2, o*S_O2]);
const tableRows = (sw = 1, rows = truth)=> rows.map(([h, o])=> [+(h*sw).toFixed(6), +(o*sw).toFixed(6)]);
// The standards: H₂ at 0.05, 0.1, 0.2 %mol (no O₂), O₂ at 0.02, 0.05, 0.1 %mol (no H₂).
const STD = [[0.05, 0], [0.1, 0], [0.2, 0], [0, 0.02], [0, 0.05], [0, 0.1]];

/* ---- The page ---- */
const rowsOf = page => page.$$eval('#gcFileTableWrap tr.file-row', trs=> trs.map(tr=> ({
  label: tr.querySelector('.file-label').value, files: [...tr.querySelectorAll('.fname-text')].map(e=> e.textContent),
  grips: tr.querySelectorAll('.fpart-grip').length, sample: !!tr.querySelector('select.file-sample'), warn: [...tr.querySelectorAll('.fpart.is-warn .fname-text')].map(e=> e.textContent) })));
async function load(page, files, rows){
  await page.setInputFiles('#gcFiles', files);
  await page.waitForFunction(n=> document.querySelectorAll('#gcFileTableWrap tr.file-row').length === n && !document.querySelector('.dz-loading'), rows, { timeout: 20000 });
  await settle(page);
}
// Every Integration card idle with nothing left to integrate (its calibration's too).
async function integrated(page){
  await page.waitForFunction(()=>{
    const st = [...document.querySelectorAll('#tab-gc .gci-status')];
    return st.length && st.every(s=> !s.querySelector('.gci-prog') && /integrated|No raw/.test(s.textContent));
  }, null, { timeout: 60000 });
  await settle(page);
}
const fitted = page => page.evaluate(async ()=> (await import('./utils.js')).kept.made['gc-tcd'] || 0);
const alerts = (page, sel = '#gcAlerts')=> page.$$eval(`${sel} .alert`, els=> els.map(e=> e.innerText.replace(/\s+/g, ' ').trim()));
const starred = async page => (await tabLabels(page))[0].endsWith('*');
const steps = async page => (await history(page, 'gc')).index;
async function zip(page){
  const z = await download(page, ()=> page.click('.proj-csv'));
  return Object.fromEntries(readZip(z.buf).map(e=> [e.name.replace(/^.* - /, ''), parseCsv(e.data.toString('utf8').replace(/^﻿/, ''), ';')]));
}
const column = (rows, h)=>{ const j = rows[0].indexOf(h); assert.ok(j >= 0, `no column ${h} in ${rows[0].join(' | ')}`); return rows.slice(1).map(r=> r[j]); };
const num = s => parseFloat(String(s).replace(',', '.'));
// A file's own grip dragged onto another file (`to`: its name), or off every file (null).
const part = (page, name)=> page.locator('#gcFileTableWrap .fpart').filter({ has: page.locator('.fname-text', { hasText: new RegExp(`^${name.replace(/[.()]/g, '\\$&')}$`) }) });
async function dragFile(page, name, to){
  const g = await part(page, name).locator('.fpart-grip').boundingBox();
  const b = to ? await part(page, to).boundingBox() : await page.locator('#gcFileTableWrap thead th').nth(3).boundingBox();
  await page.mouse.move(g.x + g.width/2, g.y + g.height/2);
  await page.mouse.down();
  await page.mouse.move(g.x + g.width/2 + 10, g.y + g.height/2 + 6, { steps: 3 });
  await page.mouse.move(b.x + b.width/2, b.y + b.height/2, { steps: 8 });
  const lit = await page.$$eval('#gcFileTableWrap .fpart.drop-on .fname-text, #gcFileTableWrap .fpart.drop-alone .fname-text', els=> els.map(e=> e.textContent));
  await page.mouse.up();
  await settle(page);
  return lit;
}
async function dragRow(page, from, to){
  const h = await page.locator('#gcFileTableWrap tr.file-row').nth(from).locator('.drag-handle').boundingBox();
  const r = await page.locator('#gcFileTableWrap tr.file-row').nth(to).boundingBox();
  await page.mouse.move(h.x + h.width/2, h.y + h.height/2);
  await page.mouse.down();
  await page.mouse.move(h.x + h.width/2, r.y + r.height*0.2, { steps: 8 });
  await page.mouse.up();
  await settle(page);
}

/* ---- By hand: the rates of a run (gcalt.test.mjs's): m 15 mg, Q 2 mL/min, 25 °C, 1 atm, the
   injection delay 60.6 s, light-on at the first injection, the interval 0–24 h ---- */
const R = 8.314462618/101.325, F = 2/1000*60/(R*298.15);
const rateOfPct = pct => 1e3*pct/100*F*1e6/15;      // µmol g⁻¹ h⁻¹
function meanRate(pcts){
  const t = [0, ...pcts.map((_, k)=> (20*60*k + 60.6)/3600)], r = [0, ...pcts.map(rateOfPct)];
  let s = 0; for (let i = 1; i < t.length; i++) s += (t[i] - t[i - 1])*(r[i] + r[i - 1])/2;
  return s/t[t.length - 1];
}

test('tables alone: no grip, no Integration card, "+" a Production Rate card with no menu, the state as v543\'s', async ()=>{
  const { page, errors, csp, close } = await env.page();
  try {
    await openModule(page, 'gc');
    await load(page, [table('plain.csv', tableRows()), altTable('plain-alt.txt', tableRows())], 2);
    assert.equal(await page.locator('#gcFileTableWrap .fpart').count(), 0, 'no file grip');
    assert.deepEqual((await rowsOf(page)).map(r=> r.files), [['plain.csv'], ['plain-alt.txt']]);
    assert.equal(await page.locator('#tab-gc .an-card').count(), 1);
    assert.equal(await page.locator('#tab-gc .an-card .gci-body').count(), 0, 'no Integration card');
    assert.equal(await page.locator('#tab-gc .an-card .an-type.is-fixed').count(), 1, 'the title names its kind');
    await page.click('#gcAddAn'); await settle(page);
    assert.equal(await page.locator('.an-menu:not([hidden])').count(), 0, 'no menu');
    assert.equal(await page.locator('#tab-gc .an-card').count(), 2, 'a Production Rate card added');
    const st = await moduleState(page, 'gc');
    assert.deepEqual(Object.keys(st).sort(), ['cards', 'files']);
    assert.ok(st.files.every(f=> !('mate' in f) && !('tcd' in f)));
    assert.equal(await fitted(page), 0);
    assert.equal(await page.locator('#tab-gc .gc-src .alert').count(), 0, 'nothing said of a source');
    assert.deepEqual(errors, []); assert.deepEqual(await csp(), []);
  } finally { await close(); }
});

test('auto-pairing: _TCD in any case, " (1)" on either name, the .txt table; raw chromatograms told by content; one row, both names, one label, one Sample; the row\'s download both files', async ()=>{
  const { page, errors, csp, close } = await env.page();
  try {
    await openModule(page, 'gc');
    const files = [table('runA.csv', tableRows()), tcd('runA_TCD.csv', areas()),
      table('runB (1).csv', tableRows()), tcd('runB_tcd.csv', areas()),
      altTable('runC.txt', tableRows()), tcd('runC_TCD (1).csv', areas()),
      tcd('mystery.csv', areas(), true), table('lonely.csv', tableRows())];
    await load(page, files, 5);
    const rows = await rowsOf(page);
    assert.deepEqual(rows.map(r=> r.files), [['runA.csv', 'runA_TCD.csv'], ['runB (1).csv', 'runB_tcd.csv'], ['runC.txt', 'runC_TCD (1).csv'], ['mystery.csv'], ['lonely.csv']]);
    assert.deepEqual(rows.map(r=> r.label), ['runA', 'runB (1)', 'runC', 'mystery', 'lonely'], 'the table\'s label');
    assert.deepEqual(rows.map(r=> r.sample), [true, true, true, false, true], 'a Sample select but for raw chromatograms alone');
    assert.deepEqual(rows.map(r=> r.grips), [2, 2, 2, 1, 1], 'a grip a file');
    const st = await moduleState(page, 'gc');
    assert.deepEqual(st.files.map(f=> [f.name, f.mate ? f.mate.name : null, f.tcd ? f.tcd.n : null]),
      [['runA.csv', 'runA_TCD.csv', null], ['runB (1).csv', 'runB_tcd.csv', null], ['runC.txt', 'runC_TCD (1).csv', null], ['mystery.csv', null, N], ['lonely.csv', null, null]]);
    assert.equal(st.cards[0].type, 'integ', 'an Integration card, before the Production Rate card');
    assert.equal(st.cards[1].type, 'rate');
    // A pair's download: both its files, byte for byte.
    const d = await download(page, ()=> page.locator('#gcFileTableWrap tr.file-row').nth(0).locator('.dl-file').click());
    const z = Object.fromEntries(readZip(d.buf).map(e=> [e.name, e.data]));
    assert.deepEqual(Object.keys(z).sort(), ['runA.csv', 'runA_TCD.csv']);
    assert.ok(z['runA_TCD.csv'].equals(files[1].buffer) && z['runA.csv'].equals(files[0].buffer));
    // Raw chromatograms alone: said under the drop zone, left out of Analysis (four samples).
    assert.ok((await alerts(page)).some(a=> a.includes('mystery.csv: raw chromatograms with no table')));
    assert.equal(await page.locator('#tab-gc .an-card').nth(1).locator('.gc-row').count(), 4);
    // A file dropped later pairs with one alone of its name.
    await load(page, [tcd('lonely_TCD.csv', areas())], 5);
    assert.deepEqual((await rowsOf(page))[4].files, ['lonely.csv', 'lonely_TCD.csv']);
    await integrated(page);
    assert.deepEqual(errors, []); assert.deepEqual(await csp(), []);
  } finally { await close(); }
});

test('the two grips: pair, swap, stand alone, reorder; each a step and a change, undone', async ()=>{
  const { page, errors, csp, close } = await env.page();
  try {
    await openModule(page, 'gc');
    await load(page, [table('A.csv', tableRows()), tcd('A_TCD.csv', areas()), table('B.csv', tableRows()), tcd('C_TCD.csv', areas())], 3);
    await integrated(page);
    await saveAs(page, 'grips');
    const names = async ()=> (await rowsOf(page)).map(r=> r.files.join(' + '));
    assert.deepEqual(await names(), ['A.csv + A_TCD.csv', 'B.csv', 'C_TCD.csv']);
    const s0 = await steps(page);
    // Onto a file alone: paired with it; its partner left alone, in its row.
    assert.deepEqual(await dragFile(page, 'A_TCD.csv', 'B.csv'), ['B.csv'], 'the whole target file lit');
    assert.deepEqual(await names(), ['A.csv', 'B.csv + A_TCD.csv', 'C_TCD.csv']);
    assert.equal(await steps(page), s0 + 1); assert.ok(await starred(page));
    // Onto a file paired: the two swap.
    await dragFile(page, 'C_TCD.csv', 'A_TCD.csv');
    assert.deepEqual(await names(), ['A.csv', 'B.csv + C_TCD.csv', 'A_TCD.csv']);
    // A table onto raw chromatograms alone: the table first in their row, its label the row's.
    await dragFile(page, 'A.csv', 'A_TCD.csv');
    assert.deepEqual(await names(), ['B.csv + C_TCD.csv', 'A.csv + A_TCD.csv']);
    assert.deepEqual((await rowsOf(page)).map(r=> r.label), ['B', 'A']);
    // Off every file: it stands alone, under its row.
    assert.deepEqual(await dragFile(page, 'C_TCD.csv', null), ['C_TCD.csv'], 'the file itself lit, dashed');
    assert.deepEqual(await names(), ['B.csv', 'C_TCD.csv', 'A.csv + A_TCD.csv']);
    // The row's grip moves the row, its pair with it.
    await dragRow(page, 2, 0);
    assert.deepEqual(await names(), ['A.csv + A_TCD.csv', 'B.csv', 'C_TCD.csv']);
    assert.equal(await steps(page), s0 + 5);
    // A press on a grip, no move: nothing.
    const g = await part(page, 'A_TCD.csv').locator('.fpart-grip').boundingBox();
    await page.mouse.click(g.x + g.width/2, g.y + g.height/2); await settle(page);
    assert.equal(await steps(page), s0 + 5);
    for (let i = 0; i < 5; i++) await undo(page);
    assert.deepEqual(await names(), ['A.csv + A_TCD.csv', 'B.csv', 'C_TCD.csv']);
    assert.equal(await starred(page), false, 'back to the saved project');
    await undo(page, true);
    assert.deepEqual(await names(), ['A.csv', 'B.csv + A_TCD.csv', 'C_TCD.csv']);
    // The per-sample values follow the tables (a mass typed for B stays B's).
    const st = await moduleState(page, 'gc');
    assert.deepEqual(st.files.map(f=> f.name), ['A.csv', 'B.csv', 'C_TCD.csv']);
    assert.deepEqual(errors, []); assert.deepEqual(await csp(), []);
  } finally { await close(); }
});

test('two tables paired: the first used, the second ignored; two files of raw chromatograms: Integration only; both said', async ()=>{
  const { page, errors, csp, close } = await env.page();
  try {
    await openModule(page, 'gc');
    // (twin_TCD.csv is a table: misnamed, paired by its name all the same)
    await load(page, [table('twin.csv', tableRows()), table('twin_TCD.csv', tableRows(2)), tcd('P_TCD.csv', areas()), tcd('Q_TCD.csv', areas())], 3);
    await dragFile(page, 'Q_TCD.csv', 'P_TCD.csv');
    const rows = await rowsOf(page);
    assert.deepEqual(rows.map(r=> r.files), [['twin.csv', 'twin_TCD.csv'], ['P_TCD.csv', 'Q_TCD.csv']]);
    assert.deepEqual(rows.map(r=> r.warn), [['twin_TCD.csv'], ['P_TCD.csv', 'Q_TCD.csv']], 'the files their pair cannot use marked');
    const al = (await alerts(page)).join(' / ');
    assert.ok(al.includes('two tables paired (twin.csv, twin_TCD.csv): the first is used'), al);
    assert.ok(al.includes('two files of raw chromatograms paired (P_TCD.csv, Q_TCD.csv)'), al);
    // Analysis: one sample, the first table's values.
    const rate = page.locator('#tab-gc .an-card').nth(1);
    assert.equal(await rate.locator('.gc-row').count(), 1);
    // Integration: both raw chromatograms' files, said.
    const card = page.locator('#tab-gc .an-card').nth(0);
    assert.deepEqual(await card.locator('.gci-file option').allTextContents(), ['P_TCD (no table)', 'P_TCD · Q_TCD.csv (no table)']);
    assert.ok((await alerts(page, '#tab-gc .gci-alerts')).join(' ').includes('two files of raw chromatograms paired'));
    await integrated(page);
    const z = await zip(page);
    const raw = z['gc_raw.csv'];
    assert.deepEqual(column(raw, 'H2 (%mol) [twin]').slice(1, 3).map(num), tableRows().slice(0, 2).map(r=> r[0]), 'the first table\'s values');
    assert.deepEqual(errors, []); assert.deepEqual(await csp(), []);
  } finally { await close(); }
});

test('counts that differ: said in Integration, integrated all the same; Analysis keeps the table, gc_raw.csv says why', async ()=>{
  const { page, errors, csp, close } = await env.page();
  try {
    await openModule(page, 'gc');
    await load(page, [table('short.csv', tableRows()), tcd('short_TCD.csv', areas().slice(0, N - 1))], 1);
    await integrated(page);
    const card = page.locator('#tab-gc .an-card').nth(0);
    const ia = (await alerts(page, '#tab-gc .gci-alerts')).join(' ');
    assert.ok(ia.includes(`short: ${N} rows in the table, ${N - 1} chromatograms: not aligned`), ia);
    assert.equal(await card.locator('.gci-inj option').count(), N - 1, 'every chromatogram integrated and shown');
    assert.equal(await card.locator('.gci-status').textContent(), `${N - 1} chromatograms integrated.`);
    const ra = (await alerts(page, '#tab-gc .gc-src')).join(' ');
    assert.ok(ra.includes(`short: ${N} rows in the table, ${N - 1} chromatograms`), ra);
    const raw = (await zip(page))['gc_raw.csv'];
    assert.deepEqual(column(raw, 'H2 (%mol) [short]').slice(1).map(num), tableRows().map(r=> r[0]), 'the table\'s values');
    assert.ok(column(raw, 'H2 source [short]').slice(1).every(s=> s === `table (${N} rows in the table, ${N - 1} chromatograms)`));
    assert.ok(column(raw, 'H2 reintegrated (%mol) [short]').every(s=> s === ''));
    assert.deepEqual(errors, []); assert.deepEqual(await csp(), []);
  } finally { await close(); }
});

test('raw chromatograms alone: an Integration card, no sample, said; its overview by injection', async ()=>{
  const { page, errors, csp, close } = await env.page();
  try {
    await openModule(page, 'gc');
    await load(page, [tcd('alone_TCD.csv', areas())], 1);
    await integrated(page);
    assert.ok(await page.locator('#gcAnalyses').isVisible(), 'the cards shown');
    assert.equal(await page.locator('#tab-gc .an-card').count(), 2);
    assert.ok((await alerts(page)).some(a=> a.includes('alone_TCD.csv: raw chromatograms with no table: shown in Integration, left out of Analysis')));
    assert.equal(await page.locator('#tab-gc .an-card').nth(1).locator('.gc-row').count(), 0, 'no sample');
    const card = page.locator('#tab-gc .an-card').nth(0);
    assert.equal(await card.locator('svg.plot[id$="Over"] .plot-label').first().textContent(), 'Injection');
    // No table, no standards: areas only.
    assert.equal(await card.locator('.gci-ovy-chip[data-y="conc"]').isDisabled(), true);
    assert.equal(await page.locator('#gcResultsBar').isVisible(), false);
    assert.deepEqual(errors, []); assert.deepEqual(await csp(), []);
  } finally { await close(); }
});

test('the Integration card: its selectors and arrows, its plots, an overview point clicked shows its chromatogram', async ()=>{
  const { page, errors, csp, close } = await env.page();
  try {
    await openModule(page, 'gc');
    await load(page, [table('one.csv', tableRows()), tcd('one_TCD.csv', areas()), table('two.csv', tableRows()), tcd('two_TCD.csv', areas())], 2);
    await integrated(page);
    const card = page.locator('#tab-gc .an-card').nth(0), inj = card.locator('.gci-inj');
    assert.deepEqual(await card.locator('.gci-file option').allTextContents(), ['one', 'two']);
    assert.equal(await inj.locator('option').count(), N);
    assert.match(await inj.locator('option').first().textContent(), /^#1 of 12 · 13\/11 10:00/);
    // The chromatogram: the raw data, the model, the baseline, H₂, O₂ and S310, the windows' lines.
    const chrom = card.locator('svg.plot[id$="Chrom"]');
    assert.ok(await chrom.locator('.plot-gdata path').count() >= 6, 'its curves');
    assert.equal(await chrom.locator('.plot-goverlay circle').count(), 2, 'the window\'s two edges, draggable');
    assert.ok(await card.locator('svg.plot[id$="Resid"] .plot-gdata path').count() >= 2, 'the residual');
    // The values of the chromatogram on show: H₂ and O₂, area within the fit's error of the truth.
    const vals = await card.locator('table.gci-values tbody tr').evaluateAll(trs=> trs.map(tr=> [...tr.cells].map(c=> c.textContent)));
    assert.deepEqual(vals.map(v=> v[0]), ['H2', 'O2']);
    assert.ok(Math.abs(num(vals[0][1]) - areas()[0][0]) < 0.01*areas()[0][0], `H₂ area ${vals[0][1]}`);
    // The arrows: the next chromatogram, the next file.
    await card.locator('.gci-knext').click(); await settle(page);
    assert.equal(await inj.inputValue(), '1');
    await page.keyboard.press('ArrowRight'); await settle(page);
    assert.equal(await inj.inputValue(), '2', '→ steps the chromatograms');
    await card.locator('.gci-fnext').click(); await settle(page);
    assert.equal(await card.locator('.gci-file').inputValue(), 'two_TCD.csv');
    assert.equal(await inj.inputValue(), '0');
    // The overview: a point a chromatogram, its fit, trapezoids and the table's value; one clicked shown.
    const over = card.locator('svg.plot[id$="Over"]');
    assert.ok(await over.locator('.plot-gdata circle').count() >= N, 'the fits');
    assert.ok(await over.locator('.plot-gdata rect').count() >= N, 'the trapezoids');
    assert.ok(await over.locator('.plot-gdata path').count() >= N, 'the table\'s values');
    const pt = await over.evaluate(svg=>{ const P = svg._plot, b = svg.getBoundingClientRect(), x = (7*20*60 + 0)/3600; const t0 = P.xmin; void t0;
      return { x: b.left + P.px(x), y: b.top + P.py(0.05 + 0.07) }; });
    await page.mouse.click(pt.x, pt.y); await settle(page);
    assert.equal(await inj.inputValue(), '7', 'the injection clicked');
    // The method's numbers: an edge in a neighbour said, a trapezoid base inverted refused.
    const s0 = await steps(page), field = k => card.locator(`.gci-method input[data-k="${k}"]`);
    await field('w0:from').fill('263'); await field('w0:from').press('Enter'); await settle(page);
    assert.match(await card.locator('.gci-method .gci-flag').textContent(), /reaches S264 \(262–267.5 s\), which its model has no peak for/);
    assert.equal(await steps(page), s0 + 1);
    await undo(page);
    assert.equal(await card.locator('.gci-method .gci-flag').count(), 0);
    await field('th2:left:0').fill('290'); await field('th2:left:0').press('Enter'); await settle(page);
    assert.equal(await field('th2:left:0').inputValue(), '281', 'a start after its end refused');
    assert.equal(await steps(page), s0);
    await field('to2:right:1').fill('305.8'); await field('to2:right:1').press('Enter'); await settle(page);
    assert.equal((await moduleState(page, 'gc')).cards[0].method.trapezoid.o2.right[1], 305.8);
    await undo(page);
    // The overview's chips and what it shows: no change unsaved (a project saved first).
    assert.equal(await starred(page), true);
    assert.deepEqual(errors, []); assert.deepEqual(await csp(), []);
  } finally { await close(); }
});

test('calibration: standards typed by hand, free and zero intercept, %mol and ppm; the rates by hand from the known areas', async ()=>{
  const { page, errors, csp, close } = await env.page();
  try {
    await openModule(page, 'gc');
    // The software's table 10 % high: the standards' scale is the truth.
    await load(page, [table('cal.csv', tableRows(1.1)), tcd('cal_TCD.csv', areas())], 1);
    await integrated(page);
    const card = page.locator('#tab-gc .an-card').nth(0);
    await card.locator('.gci-cal').click();
    const m = page.locator('.gci-cal-modal');
    await m.waitFor({ state: 'visible' });
    await m.locator('.gci-cal-in').setInputFiles([tcd('standards.csv', STD.map(([h, o])=> [h*S_H2, o*S_O2]))]);
    await page.waitForFunction(()=> /integrated/.test(document.querySelector('.gci-cal-modal .gci-cal-status').textContent), null, { timeout: 60000 });
    assert.equal(await m.locator('.gci-cal-levels tbody tr').count(), 6, 'a row a standard');
    assert.equal(await m.locator('.gci-cal-levels tbody tr svg.gci-thumb').count(), 6, 'each its thumbnail');
    const type = async (i, g, v)=>{ const f = m.locator(`input[data-j="${i}"][data-g="${g}"]`); await f.fill(String(v)); await f.press('Enter'); await settle(page); };
    for (const [i, [h, o]] of STD.entries()){ if (h) await type(i, 'h2', h); if (o) await type(i, 'o2', o); }
    const line = async g => (await m.locator(`.gci-cal-gas[data-g="${g}"] .gci-cal-line`).textContent()).replace(/\s+/g, ' ');
    const parse = s =>({ slope: num(/slope (\S+)/.exec(s)[1]), icpt: num(/intercept (\S+)/.exec(s)[1]), r2: num(/R² = (\S+)/.exec(s)[1]) });
    const h = parse(await line('h2')), o = parse(await line('o2'));
    assert.ok(Math.abs(h.slope - S_H2) < 0.01*S_H2 && Math.abs(o.slope - S_O2) < 0.02*S_O2, `slopes ${h.slope}, ${o.slope}`);
    assert.ok(h.r2 > 0.9999 && o.r2 > 0.999);
    assert.equal(await m.locator('.gci-cal-gas[data-g="h2"] .gci-cal-dev tbody tr').count(), 3, 'a deviation a level');
    // Zero intercept: 0, fixed.
    await m.locator('.gci-cal-gas[data-g="h2"] .gci-zero-chip[data-zero="1"]').click(); await settle(page);
    assert.match(await line('h2'), /intercept 0 \(fixed\)/);
    await m.locator('.gci-cal-gas[data-g="h2"] .gci-zero-chip[data-zero="0"]').click(); await settle(page);
    // A standard left out: n one less.
    await m.locator('input[data-j="1"][data-g="on"]').uncheck(); await settle(page);
    assert.match(await line('h2'), /n = 2/);
    await m.locator('input[data-j="1"][data-g="on"]').check(); await settle(page);
    await page.keyboard.press('Escape'); await settle(page);
    // The rates: from the re-integration, calibrated by the standards, the times from the table.
    const ra = (await alerts(page, '#tab-gc .gc-src')).join(' ');
    assert.ok(ra.includes('cal: H₂ calibrated by the standards; O₂ calibrated by the standards'), ra);
    let z = await zip(page);
    const raw = z['gc_raw.csv'], A = column(raw, 'H2 area [cal]').slice(1).map(num), c = column(raw, 'H2 reintegrated (%mol) [cal]').slice(1).map(num);
    assert.ok(column(raw, 'H2 source [cal]').slice(1).every(s=> s === 'reintegrated, calibrated by the standards'));
    A.forEach((a, k)=> assert.ok(Math.abs(c[k] - (a - h.icpt)/h.slope) < 2e-5 + 1e-4*c[k], `injection ${k + 1}: ${c[k]} for (${a} − b)/s`));
    A.forEach((a, k)=> assert.ok(Math.abs(a - areas()[k][0]) < 0.01*areas()[k][0], `area ${k + 1}: ${a} for ${areas()[k][0]}`));
    const mean = z['mean_rates.csv'][1], want = meanRate(truth.map(r=> r[0])), wantO = meanRate(truth.map(r=> r[1]));
    assert.ok(Math.abs(num(mean[1]) - want) < 0.01*want, `H₂ mean ${mean[1]} for ${want} by hand`);
    assert.ok(Math.abs(num(mean[2]) - wantO) < 0.02*wantO, `O₂ mean ${mean[2]} for ${wantO} by hand`);
    assert.ok(Math.abs(num(mean[1]) - 1.1*want) > 0.05*want, 'not the table\'s');
    // ppm: the same standards typed in ppm, the same concentrations.
    await card.locator('.gci-cal').click(); await m.waitFor({ state: 'visible' });
    await m.locator('.gci-cal-unit-in').selectOption('ppm'); await settle(page);
    for (const [i, [hh, oo]] of STD.entries()){ if (hh) await type(i, 'h2', hh*1e4); if (oo) await type(i, 'o2', oo*1e4); }
    const hp = parse(await line('h2'));
    assert.ok(Math.abs(hp.slope*1e4 - h.slope) < 1e-3*h.slope, `per ppm ${hp.slope}, per %mol ${h.slope}`);
    await m.locator('.xrd-std-x').click(); await settle(page);
    z = await zip(page);
    assert.ok(Math.abs(num(z['mean_rates.csv'][1][1]) - num(mean[1])) < 1e-6*num(mean[1]) + 1e-9, 'the same rates');
    // The values table: the concentration in the calibration's unit.
    assert.match(await card.locator('table.gci-values tbody tr').first().locator('td').nth(6).textContent(), / ppm$/);
    assert.deepEqual(errors, []); assert.deepEqual(await csp(), []);
  } finally { await close(); }
});

test('no standards: the GC software\'s scale taken over (k, the median of area/table value), said in an info alert; the rates the table\'s', async ()=>{
  const { page, errors, csp, close } = await env.page();
  try {
    await openModule(page, 'gc');
    await load(page, [table('sw.csv', tableRows(1.1)), tcd('sw_TCD.csv', areas())], 1);
    await integrated(page);
    const ia = (await alerts(page, '#tab-gc .gci-alerts')).join(' ');
    assert.ok(ia.startsWith('Calibration taken from the GC software\'s table'), ia);
    const k = num(/H2 k = (\S+)/.exec(ia.replace('H₂', 'H2'))[1]);
    const z = await zip(page), integ = z['integration.csv'];
    const A = column(integ, 'H2 area').map(num), tv = tableRows(1.1).map(r=> r[0]);
    const ratios = A.map((a, i)=> a/tv[i]).sort((x, y)=> x - y), med = (ratios[5] + ratios[6])/2;
    assert.ok(Math.abs(k - med) < 1e-4*med, `k ${k}, by hand ${med}`);
    assert.ok(column(integ, 'H2 source').every(s=> s.startsWith('transfer (k = ')));
    const ra = (await alerts(page, '#tab-gc .gc-src')).join(' ');
    assert.ok(ra.includes('H₂ calibration taken from the GC software\'s table (k = '), ra);
    // Area / k: the table's scale, so the table's rates within the fit's noise.
    const mean = z['mean_rates.csv'][1], want = meanRate(tableRows(1.1).map(r=> r[0]));
    assert.ok(Math.abs(num(mean[1]) - want) < 0.01*want, `H₂ ${mean[1]} for ${want}`);
    assert.deepEqual(errors, []); assert.deepEqual(await csp(), []);
  } finally { await close(); }
});

test('the project: saved and reloaded with its pairs, method, calibration and results, nothing fitted again; a method changed a step, undone, no step for results', async ()=>{
  const { page, errors, csp, close } = await env.page();
  try {
    await openModule(page, 'gc');
    await load(page, [table('keep.csv', tableRows()), tcd('keep_TCD.csv', areas())], 1);
    await integrated(page);
    const card = page.locator('#tab-gc .an-card').nth(0);
    const n0 = await fitted(page), s0 = await steps(page);
    assert.equal(n0, N);
    // A window's edge typed: a step, the file integrated again a moment after, no step of its own.
    const to = card.locator('.gci-method input[data-k="w0:to"]');
    await to.fill('328'); await to.press('Enter'); await settle(page);
    assert.equal(await steps(page), s0 + 1);
    assert.match(await card.locator('.gci-status').textContent(), /Method changed|Integrating/);
    await integrated(page);
    assert.equal(await fitted(page), 2*N);
    assert.equal(await steps(page), s0 + 1, 'results come in as no step');
    // Undone: the first method's results, kept, nothing fitted.
    await undo(page);
    assert.equal(await card.locator('.gci-method input[data-k="w0:to"]').inputValue(), '326');
    await settle(page);
    assert.equal(await fitted(page), 2*N);
    await undo(page, true);
    // Standards and a level: then saved, the page reloaded.
    await card.locator('.gci-cal').click();
    const m = page.locator('.gci-cal-modal');
    await m.locator('.gci-cal-in').setInputFiles([tcd('std.csv', STD.map(([h, o])=> [h*S_H2, o*S_O2]))]);
    await page.waitForFunction(()=> /integrated/.test(document.querySelector('.gci-cal-modal .gci-cal-status').textContent), null, { timeout: 60000 });
    for (const [i, [h]] of STD.entries()) if (h){ const f = m.locator(`input[data-j="${i}"][data-g="h2"]`); await f.fill(String(h)); await f.press('Enter'); await settle(page); }
    await m.locator('.xrd-std-x').click(); await settle(page);
    const rates = (await zip(page))['mean_rates.csv'][1];
    await saveAs(page, 'tcd-keep');
    const st = await moduleState(page, 'gc');
    assert.ok(st.integ && Object.keys(st.integ).length >= 2, 'the results in the state');
    assert.ok(JSON.stringify(st.integ).length < 60000, 'compact');
    await page.reload(); await ready(page);
    await page.waitForSelector('#tab-gc.active'); await settle(page);
    await integrated(page);
    assert.equal(await fitted(page), 0, 'nothing fitted again');
    const after = await moduleState(page, 'gc');
    assert.equal(after.files[0].mate.name, 'keep_TCD.csv');
    assert.equal(after.cards[0].method.windows[0].to, 328);
    assert.deepEqual(after.cards[0].cal.files[0].levels.map(l=> l.h2), [0.05, 0.1, 0.2, null, null, null]);
    assert.deepEqual((await zip(page))['mean_rates.csv'][1], rates, 'the same rates');
    assert.equal(await page.locator('#tab-gc .an-card').nth(0).locator('table.gci-values tbody tr').count(), 2, 'its curves and values drawn from the results');
    assert.deepEqual(errors, []); assert.deepEqual(await csp(), []);
  } finally { await close(); }
});
