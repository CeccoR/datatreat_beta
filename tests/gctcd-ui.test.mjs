/* GC's raw chromatograms (v544; v545: the card's layout, its selectors, the chromatogram over
   its residuals, the run overview, no trapezoids, the suspicious rule; v546: the toolbar back
   over the plot, the chromatogram's selector over the overview, the boxes aligned, Peaks'
   notes, the overview's marks, the 10 % rule): the TCD files beside
   their tables, paired in the trace list, integrated again by the Integration card, and the
   Production Rate cards below it taking the re-integrated values. Every file here is made up for the test: the
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
   - The Integration card: its two selectors (the file's over the chromatogram, the plot's
     toolbar at the right of their line as a Tauc plot's; the chromatogram's over the run
     overview, the overview's toolbar at the right of theirs; no "Run overview" title) and
     arrows, Windows aligned (its title on the selector's line, its box's top on the plot's
     frame's), the chromatogram over its residuals (their x linked, each its own y), the
     overview one gas at a time (one colour for every gas's fits, the table's crosses half
     the size; a point hovered and clicked drawn lighter and a tenth larger, nothing round
     it, the one on show too), no trapezoid anywhere.
   - The suspicious rule (10 %): one injection out of proportion with the table marked (red
     in the selector and its list, on the overview, said in Peaks and the CSV), one within
     10 % not, a scale off alike at every injection none.
   - The calibration window: levels typed, free and zero intercept, %mol and ppm, its line.
   - No standards: the GC software's scale taken over (k = median of area/table value), said
     in an info alert in Integration (its message alone) and in the rate card, the file's k
     under its Peaks, the units said plainly, no superscript.
   - The rates from the re-integrated values against a hand calculation from the known areas.
   - The project saved and reloaded: pairs, method, calibration and results, nothing fitted
     again; a method changed (a step) and undone, nothing fitted again; results coming in no
     step. A project as v544 saved it (its method's trapezoids, its results' keys and their
     trapezoid areas) opens with nothing fitted again. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { start, openModule, settle, moduleState, history, undo, download, readZip, parseCsv, tabLabels, saveAs, ready, ROOT, exportProject, projectFile, importProject, openProject } from './helpers.mjs';

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
// Every Integration card idle with nothing left to integrate (its calibration's too): its
// status line says nothing (v545: no "N chromatograms integrated"), or that there is none.
async function integrated(page){
  await page.waitForFunction(()=>{
    const st = [...document.querySelectorAll('#tab-gc .gci-status')];
    return st.length && st.every(s=> s.dataset.state === 'done' || s.dataset.state === 'none');
  }, null, { timeout: 60000 });
  await settle(page);
}
// A selector's list (snav.js): opened by its name, its items read, closed by Escape.
async function listOf(page, sel){
  await page.locator(`${sel} .snav-pick`).click();
  await page.waitForSelector('.snav-menu');
  const items = await page.$$eval('.snav-menu [data-i]', bs=> bs.map(b=> ({ text: b.querySelector('.snav-item').textContent, bad: b.classList.contains('is-bad'), cur: b.classList.contains('is-current') })));
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=> !document.querySelector('.snav-menu'));
  return items;
}
const idxOf = (card, which)=> card.locator(`[id$="${which}Idx"]`).textContent();
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
    // Integration: both raw chromatograms' files (its file selector's list), said.
    assert.deepEqual((await listOf(page, '#tab-gc .gci-fsel')).map(x=> x.text), ['P_TCD (no table)', 'P_TCD · Q_TCD.csv (no table)']);
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
    assert.equal(await idxOf(card, 'Inj'), `1/${N - 1}`, 'every chromatogram integrated and shown');
    // (all integrated: the status line says nothing and folds away, v545)
    assert.equal(await card.locator('.gci-status').textContent(), '');
    assert.equal(await card.locator('.gci-bar').isVisible(), false);
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

test('the Integration card: its two selectors, the chromatogram over its residuals (their x linked), the overview one gas at a time, hovered and clicked; no trapezoid', async ()=>{
  const { page, errors, csp, close } = await env.page();
  try {
    await openModule(page, 'gc');
    await load(page, [table('one.csv', tableRows()), tcd('one_TCD.csv', areas()), table('two.csv', tableRows()), tcd('two_TCD.csv', areas())], 2);
    await integrated(page);
    const card = page.locator('#tab-gc .an-card').nth(0);
    // The selectors (v546): the file's over the plot at its left, the chromatogram's over the
    // run overview at its left; each `‹ n/N ›` then its name.
    assert.deepEqual((await listOf(page, '#tab-gc .gci-fsel')).map(x=> x.text), ['one', 'two']);
    const inj = await listOf(page, '#tab-gc .gci-ksel');
    assert.equal(inj.length, N);
    assert.equal(inj[0].text, '#1 · 13/11 10:00'); assert.ok(inj[0].cur);
    assert.equal(await card.locator('.gci-ksel .snav-name').getAttribute('title'), 'Injection 1 · 13/11 10:00 of 12', 'its tooltip whole');
    assert.deepEqual(inj.filter(x=> x.bad), [], 'nothing suspicious: the table proportional to the areas');
    /* Where they sit: the file's on the line over the chromatogram, at its left, the plot's
       toolbar at the right of that line, as a Tauc plot's (to v545 between the selectors);
       the chromatogram's on the line over the run overview (under the chromatogram's
       legend), at its left, the overview's toolbar at the right of its line; each plot 6 px
       under its line; no "Run overview" title. Then Windows: its title on the file
       selector's line, its box's top on the chromatogram's frame's (CLAUDE.md). */
    const geo = await card.evaluate(c=>{
      const r = s => c.querySelector(s).getBoundingClientRect(), mid = b => (b.top + b.bottom)/2;
      const nav = r('.gci-nav'), ovn = r('.gci-ov-nav'), tb = r('.gci-pair > .plot-btn-col'), otb = r('.plot-wrap:has(> svg.gci-over) > .plot-btn-col');
      const ch = r('svg.gci-chrom'), ov = r('svg.gci-over'), lg = r('[id$="ChromLegend"]');
      return { order: [r('.gci-fsel .snav-steps').right <= r('.gci-fsel .snav-pick').left, r('.gci-ksel .snav-steps').right <= r('.gci-ksel .snav-pick').left],
        f: [r('.gci-fsel').left - ch.left, mid(r('.gci-fsel')) - mid(nav), mid(tb) - mid(nav), tb.right - ch.right, ch.top - nav.bottom].map(v=> Math.round(v*10)/10),
        k: [r('.gci-ksel').left - ov.left, mid(r('.gci-ksel')) - mid(ovn), mid(otb) - mid(ovn), otb.right - ov.right, ov.top - ovn.bottom].map(v=> Math.round(v*10)/10),
        below: ovn.top - lg.bottom, steps: [r('.gci-fsel .snav-steps').width, r('.gci-ksel .snav-steps').width],
        caps: [...c.querySelectorAll('.txt-caption')].map(x=> x.textContent), text: c.innerText,
        win: [r('.gci-win-box').top - ch.top, mid(r('.gci-win-head')) - mid(nav), r('.gci-win-box').left - ch.right] };
    });
    assert.deepEqual(geo.order, [true, true], 'the arrows first, then the name');
    const zero = (xs, what)=> xs.forEach((v, i)=> assert.ok(Math.abs(v - [0, 0, 0, 0, 6][i]) <= 1, `${what}: ${xs}`));
    zero(geo.f, 'the file\'s selector over the chromatogram at its left, the plot\'s toolbar at the right of its line');
    zero(geo.k, 'the chromatogram\'s selector over the overview at its left, the overview\'s toolbar at the right of its line');
    assert.ok(geo.below > 0, 'the overview\'s line under the chromatogram\'s legend');
    assert.ok(geo.steps[0] === geo.steps[1] && geo.steps[0] > 100, `the arrows' groups one width: ${geo.steps}`);
    assert.ok(!geo.caps.includes('Run overview') && !/Run overview/i.test(geo.text), 'no "Run overview" title');
    assert.ok(Math.abs(geo.win[0]) <= 1 && Math.abs(geo.win[1]) <= 1 && geo.win[2] > 0, `Windows: the box's top on the frame's, its title on the selector's line: ${geo.win}`);
    // The chromatogram: the raw data, the model, the baseline, H₂, O₂ and S310, the window's lines;
    // its residuals under it. One plot: the two touch, together as tall as a standard plot.
    const chrom = card.locator('svg.plot[id$="Chrom"]'), resid = card.locator('svg.plot[id$="Resid"]');
    assert.ok(await chrom.locator('.plot-gdata path').count() >= 6, 'its curves');
    assert.equal(await chrom.locator('.plot-goverlay circle').count(), 2, 'the window\'s two edges, draggable');
    assert.ok(await resid.locator('.plot-gdata path').count() >= 2, 'the residual');
    const box = await card.evaluate(c=>{ const a = c.querySelector('svg.gci-chrom').getBoundingClientRect(), b = c.querySelector('svg.gci-resid').getBoundingClientRect(), o = c.querySelector('svg.gci-over').getBoundingClientRect(); return { w: a.width, h: a.height + b.height, gap: b.top - a.bottom, ratio: a.height/b.height, wb: b.width, ow: o.width, oh: o.height }; });
    assert.ok(Math.abs(box.h - box.w/1.618) < 1 && Math.abs(box.gap) < 0.5 && Math.abs(box.ratio - 3) < 0.02 && box.wb === box.w, `a standard plot's size, 3 : 1: ${JSON.stringify(box)}`);
    assert.ok(box.ow === box.w && Math.abs(box.oh - box.h/2) < 1, 'the overview as wide, half as tall');
    assert.equal(await card.locator('.gci-pair .plot-tool-btn[title="Zoom area"]').count(), 1, 'one toolbar for both, the plot\'s own');
    assert.equal(await card.locator('.gci-tools').count(), 0);
    // Only the residuals' axis carries the time's numbers and title; the two y axes aligned.
    const ax = await card.evaluate(c=>{ const P = c.querySelector('svg.gci-chrom')._plot, Q = c.querySelector('svg.gci-resid')._plot;
      const labels = s => [...c.querySelector(s).querySelectorAll('.plot-gaxes .plot-label')].map(t=> t.textContent);
      return { cl: labels('svg.gci-chrom'), rl: labels('svg.gci-resid'), ct: P.noXTickLabels, rt: Q.noXTickLabels, ml: [P.margin.l, Q.margin.l], mb: P.margin.b, mt: Q.margin.t,
        raw: P._stored.find(e=> e.key === 'raw').xs, view: [P.xmin, P.xmax], res: Q._stored.find(e=> e.key === 'residual').xs }; });
    assert.deepEqual(ax.cl, ['TCD signal']); assert.deepEqual(ax.rl, ['Retention time (s)', 'Residual']);
    assert.ok(ax.ct && !ax.rt && ax.ml[0] === ax.ml[1] && ax.mb === 0 && ax.mt === 0);
    // The whole chromatogram held, the view on the H₂/O₂ zone; the residuals in the fit window only.
    assert.ok(ax.raw[0] === T[0] && ax.raw[ax.raw.length - 1] === T[T.length - 1] && ax.view[0] > T[0], `the whole chromatogram, the zone shown: ${ax.view}`);
    assert.ok(ax.res[0] >= 268 && ax.res[ax.res.length - 1] <= 326, 'residuals inside the fit window');
    // Zoomed in one panel (the one under the pointer): the other's x follows, its y does not.
    const views = ()=> card.evaluate(c=> ['svg.gci-chrom', 'svg.gci-resid'].map(s=>{ const P = c.querySelector(s)._plot; return [P.xmin, P.xmax, P.ymin, P.ymax]; }));
    const at = (sel, x, y)=> card.evaluate((c, [sel, x, y])=>{ const s = c.querySelector(sel), r = s.getBoundingClientRect(), P = s._plot; return { x: r.left + P.px(x), y: r.top + P.py(y) }; }, [sel, x, y]);
    const v0 = await views();
    await card.locator('.gci-pair .plot-tool-btn[title="Zoom area"]').click();
    assert.equal(await resid.evaluate(s=> s._plot._mode), 'zoom', 'the tool armed in both');
    const [cy0, cy1] = [v0[0][2] + 0.3*(v0[0][3] - v0[0][2]), v0[0][2] + 0.8*(v0[0][3] - v0[0][2])];
    await chrom.scrollIntoViewIfNeeded();
    let a = await at('svg.gci-chrom', 284, cy1), b = await at('svg.gci-chrom', 306, cy0);
    await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: 6 }); await page.mouse.up(); await settle(page);
    const v1 = await views();
    assert.ok(Math.abs(v1[0][0] - 284) < 0.3 && Math.abs(v1[0][1] - 306) < 0.3, `the chromatogram zoomed: ${v1[0]}`);
    assert.deepEqual(v1[1].slice(0, 2), v1[0].slice(0, 2), 'the residuals\' x with it');
    assert.deepEqual(v1[1].slice(2), v0[1].slice(2), 'their y not');
    const ry = [v1[1][2]*0.5, v1[1][3]*0.5];
    await resid.scrollIntoViewIfNeeded();
    a = await at('svg.gci-resid', 290, ry[1]); b = await at('svg.gci-resid', 300, ry[0]);
    await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: 6 }); await page.mouse.up(); await settle(page);
    const v2 = await views();
    assert.ok(Math.abs(v2[1][0] - 290) < 0.3 && Math.abs(v2[1][1] - 300) < 0.3, `the residuals zoomed: ${v2[1]} (${JSON.stringify([a, b])})`);
    assert.deepEqual(v2[0].slice(0, 2), v2[1].slice(0, 2), 'the chromatogram\'s x with the residuals\'');
    assert.deepEqual(v2[0].slice(2), v1[0].slice(2), 'its y not');
    // A reset (double click with the tool on): the zone again, in both.
    await chrom.scrollIntoViewIfNeeded();
    a = await at('svg.gci-chrom', 295, (v2[0][2] + v2[0][3])/2);
    await page.mouse.dblclick(a.x, a.y); await settle(page);
    const v3 = await views();
    assert.deepEqual(v3[0], v0[0]); assert.deepEqual(v3[1].slice(0, 2), v0[0].slice(0, 2));
    await card.locator('.gci-pair .plot-tool-btn[title="Zoom area"]').click();
    // One toolbar for both: the image (current view) of the two, stacked; the CSV of both, the
    // whole chromatogram; the composer takes them as two panels, either of which can go.
    const png = await download(page, ()=> card.locator('.gci-pair .plot-tool-btn[title="Download current view"]').click());
    assert.ok(png.buf.readUInt32BE(20)/2 > box.h, `the image as tall as the two: ${png.buf.readUInt32BE(20)/2} px for ${box.h}`);
    const cz = await download(page, ()=> card.locator('.gci-pair .plot-csv-btn').click());
    const crows = parseCsv(cz.buf.toString('utf8').replace(/^\uFEFF/, ''), ';');
    assert.ok(cz.name.endsWith('chromatogram.csv') && ['Time (s)', 'TCD signal', 'model H2O2', 'residual H2O2'].every(h=> crows[0].includes(h)), crows[0].join(' | '));
    assert.equal(crows.length - 1, T.length, 'the whole chromatogram');
    await card.locator('.gci-pair .plot-tool-btn[title="Figure composer (advanced export)"]').click();
    await page.waitForSelector('.fig-backdrop .fig-svg path');
    const groups = ()=> page.$$eval('.fig-backdrop .fig-group', gs=> gs.map(g=> [...g.querySelectorAll('.fig-slabel')].map(i=> i.value)));
    let gr = await groups();
    assert.equal(gr.length, 2, 'two panels');
    assert.ok(gr[0].includes('raw') && gr[1].includes('residual') && !gr[0].includes('residual'), JSON.stringify(gr));
    assert.deepEqual(await page.$$eval('.fig-backdrop .fig-panel input[data-pk="ylabel"]', xs=> xs.map(x=> x.value)), ['TCD signal', 'Residual'], 'each its own Y title');
    await page.locator('.fig-backdrop [data-del-panel="1"]').click();
    gr = await groups();
    assert.ok(gr.length === 1 && !gr[0].includes('residual') && gr[0].includes('raw'), 'the residuals left out with their panel');
    await page.keyboard.press('Escape');
    await page.waitForFunction(()=> !document.querySelector('.fig-backdrop'));
    // The values of the chromatogram on show (Peaks): H₂ and O₂, area within the fit's error of the truth.
    const vals = await card.locator('table.gci-values tbody tr').evaluateAll(trs=> trs.map(tr=> [...tr.cells].map(c=> c.textContent)));
    assert.deepEqual(vals.map(v=> v[0]), ['H2', 'O2']);
    assert.ok(Math.abs(num(vals[0][1]) - areas()[0][0]) < 0.01*areas()[0][0], `H₂ area ${vals[0][1]}`);
    // No trapezoid anywhere: neither in the Windows, nor in Peaks, nor in the CSV, nor on the plot.
    assert.deepEqual(await card.locator('.gci-method input').evaluateAll(xs=> xs.map(x=> x.dataset.k)), ['w0:from', 'w0:to']);
    assert.deepEqual(await card.locator('table.gci-values th').allTextContents(), ['Gas', 'Area ± sd', 'Apex (s)', 'χ²r', 'Conc.', 'GC table']);
    assert.equal(await card.locator('.gci-win-head > span').textContent(), 'Windows');
    assert.equal(await card.locator('.gci-values-head > span').textContent(), 'Peaks');
    const integ = (await zip(page))['integration.csv'];
    assert.ok(!integ[0].some(h=> /trap/i.test(h)), integ[0].join(' | '));
    assert.ok(!/trap/i.test(await card.locator('.gci-legend').first().textContent()));
    // Calibration… at the foot of the side column, as wide as it.
    const cb = await card.evaluate(c=>{ const s = c.querySelector('.gci-side').getBoundingClientRect(), b = c.querySelector('.gci-side > .gci-cal').getBoundingClientRect(); return [b.width - s.width, b.height]; });
    assert.ok(Math.abs(cb[0]) < 1 && cb[1] > 30 && cb[1] < 36, `the button ${cb}`);
    // The arrows: the next chromatogram (the keys too), the next file; the list straight to one.
    await card.locator('.gci-knext').click(); await settle(page);
    assert.equal(await idxOf(card, 'Inj'), '2/12');
    await page.keyboard.press('ArrowRight'); await settle(page);
    assert.equal(await idxOf(card, 'Inj'), '3/12', '→ steps the chromatograms');
    await card.locator('.gci-fnext').click(); await settle(page);
    assert.equal(await idxOf(card, 'File'), '2/2');
    assert.equal(await card.locator('[id$="File"]').textContent(), 'two');
    assert.equal(await idxOf(card, 'Inj'), '1/12');
    await card.locator('.gci-ksel .snav-pick').click(); await page.keyboard.press('End'); await page.keyboard.press('Enter'); await settle(page);
    assert.equal(await idxOf(card, 'Inj'), '12/12', 'the list: the last one');
    await card.locator('.gci-knext').click(); await settle(page);
    assert.equal(await idxOf(card, 'Inj'), '1/12');
    // The overview: one gas at a time; each injection's fit and the table's value.
    const over = card.locator('svg.plot[id$="Over"]');
    const chips = ()=> card.locator('.gci-ov-chip').evaluateAll(cs=> cs.map(c=> c.classList.contains('is-on')));
    assert.deepEqual(await chips(), [true, false]);
    assert.ok(await over.locator('.plot-gdata circle').count() >= N, 'the fits');
    assert.ok(await over.locator('.plot-gdata path').count() >= N, 'the table\'s values');
    assert.equal(await over.locator('.plot-gdata rect').count(), 0, 'no trapezoids');
    await card.locator('.gci-ov-chip[data-g="o2"]').click(); await settle(page);
    assert.deepEqual(await chips(), [false, true], 'O₂ alone');
    assert.match(await over.evaluate(s=> s._plot.ylabel), /^O₂/);
    // One colour for every gas's fits (H₂'s blue, v546), on the plot and on its key; the GC
    // table's crosses half the size they were (v545: 3.5), under the fits' dots.
    const marks = await over.evaluate(s=>{ const st = s._plot._stored, f = st.find(x=> x.key === 'o2 fit'), t = st.find(x=> x.key === 'o2 table'); return { fit: f.color, r: f.r, cross: [t.shape, t.r, t.sw, t.color] }; });
    assert.equal(marks.fit, '#3aa0ff', 'O₂\'s fits blue');
    assert.equal(await card.locator('[id$="OverLegend"] .gci-mk-dot').first().evaluate(i=> getComputedStyle(i).color), 'rgb(58, 160, 255)', 'its key too');
    assert.deepEqual(marks.cross, ['cross', 1.75, 1.4, '#9aa3ad'], 'the crosses half the size, grey');
    assert.ok(marks.cross[1] + marks.cross[2]/2 < marks.r, 'a cross under a dot hidden by it');
    await card.locator('.gci-ov-chip[data-g="h2"]').click(); await settle(page);
    // As area, the table's value times the run's k: on the fits' scale.
    await card.locator('.gci-ovy-chip[data-y="area"]').click(); await settle(page);
    const sc = await over.evaluate(s=>{ const st = s._plot._stored; return { fit: st.find(e=> e.key === 'h2 fit').ys, tab: st.find(e=> e.key === 'h2 table').ys }; });
    sc.fit.forEach((v, k)=> assert.ok(Math.abs(sc.tab[k] - v) < 0.02*v, `injection ${k + 1}: table × k ${sc.tab[k]}, fit ${v}`));
    /* Hovered (v546): its point alone drawn again, in a lighter shade of its colour and a
       tenth larger (no halo, no ring, no white centre), its label as before; the one on
       show too. */
    const hl = ()=> over.evaluate(s=>{ const g = s.querySelector('.gci-hl'); return g ? { sel: g.dataset.sel, hov: g.dataset.hov, pts: [...g.querySelectorAll('.gci-hl-pt')].map(c=> c.getAttribute('fill')),
      r: [...g.querySelectorAll('.gci-hl-pt')].map(c=> +c.getAttribute('r') + (c.getAttribute('stroke') && c.getAttribute('stroke') !== 'none' ? (+c.getAttribute('stroke-width') || 1)/2 : 0)), stroke: [...g.querySelectorAll('.gci-hl-pt')].map(c=> c.getAttribute('stroke')), more: g.querySelectorAll('circle:not(.gci-hl-pt), .gci-hl-halo').length,
      label: g.querySelector('.plot-pick-label') ? g.querySelector('.plot-pick-label').textContent : '' } : null; });
    /* Sizes as seen (v547): a radius plus half its stroke, read from the drawn circles (to
       v546 the r attributes alone were compared, and the dot's ring outgrew the point). */
    const fitR = await over.evaluate(s=>{ const c = s._plot._stored.find(x=> x.key === 'h2 fit')._el.querySelector('circle'), st = c.getAttribute('stroke');
      return +c.getAttribute('r') + (st && st !== 'none' ? (+c.getAttribute('stroke-width') || 1)/2 : 0); });
    const h0 = await hl(), lit = /^rgb\((\d+),(\d+),(\d+)\)$/.exec(h0.pts[0] || '');
    assert.ok(Math.abs(h0.r[0]/fitR - 1.1) <= 0.01, `the point on show a tenth larger than the dot as seen: ${h0.r[0]} against ${fitR}`);
    assert.deepEqual({ ...h0, pts: h0.pts.length, r: h0.r.length }, { sel: '0', hov: '', pts: 1, r: 1, stroke: ['none'], more: 0, label: '' }, 'the chromatogram on show: lighter, a tenth larger, nothing round it');
    assert.ok(lit && [0x3a, 0xa0, 0xff].every((c, i)=> +lit[i + 1] >= c) && +lit[1] > 0x3a + 40 && +lit[1] < 0xd0 && +lit[2] < 0xf0, `a lighter shade of the fits' blue, not white: ${h0.pts[0]}`);
    const pt = k => over.evaluate((s, k)=>{ const P = s._plot, b = s.getBoundingClientRect(), e = P._stored.find(x=> x.key === 'h2 fit'); return { x: b.left + P.px(e.xs[k]), y: b.top + P.py(e.ys[k]) }; }, k);
    let q = await pt(3);
    await page.mouse.move(q.x + 2, q.y - 2); await settle(page);
    let h = await hl();
    assert.equal(h.hov, '3'); assert.equal(h.pts.length, 2);
    assert.ok(Math.abs(h.r[1]/fitR - 1.1) <= 0.01, `hovered: a tenth larger than the dot as seen: ${h.r[1]} against ${fitR}`);
    assert.deepEqual([h.r[1], h.stroke[1], h.more, h.pts[1]], [h0.r[0], 'none', 0, h0.pts[0]], 'hovered: as the one on show');
    assert.match(h.label, /^Injection 4 · 13\/11 11:00fit: [\d.]+GC table: 0\.08 %molχ²ᵣ: [\d.]+$/);
    q = await pt(7);
    await page.mouse.click(q.x, q.y); await settle(page);
    assert.equal(await idxOf(card, 'Inj'), '8/12', 'the injection clicked shown');
    await page.mouse.move(5, 5); await settle(page);
    h = await hl();
    assert.equal(h.sel, '7'); assert.equal(h.hov, ''); assert.equal(h.pts.length, 1, 'its brightening kept');
    // Chosen by the arrows: its point brightened. The old dashed line is gone.
    await card.locator('.gci-knext').click(); await settle(page);
    assert.equal((await hl()).sel, '8');
    assert.equal(await over.locator('.gc-int-hl').count(), 0);
    // The Windows' numbers: an edge in a neighbour said; a step, undone.
    const s0 = await steps(page), field = k => card.locator(`.gci-method input[data-k="${k}"]`);
    await field('w0:from').fill('263'); await field('w0:from').press('Enter'); await settle(page);
    assert.match(await card.locator('.gci-method .gci-flag').textContent(), /reaches S264 \(262–267.5 s\), which its model has no peak for/);
    assert.equal(await steps(page), s0 + 1);
    await undo(page);
    assert.equal(await card.locator('.gci-method .gci-flag').count(), 0);
    assert.equal(await steps(page), s0);
    assert.deepEqual(errors, []); assert.deepEqual(await csp(), []);
  } finally { await close(); }
});

test('suspicious: an injection out of proportion with the GC table (beyond 10 %) marked, in red, one within 10 % not, a scale off alike at every injection none', async ()=>{
  const { page, errors, csp, close } = await env.page();
  try {
    await openModule(page, 'gc');
    /* Both tables 10 % high (the software's own scale off); "odd" with its 6th H₂ 20 % higher
       still (its area 16.7 % under k × its table value: marked) and its 3rd 6 % higher (5.7 %
       under: within v546's 10 %, which v545's 3 % marked). */
    const odd = tableRows(1.1).map(([hh, o], k)=> [k === 5 ? +(hh*1.2).toFixed(6) : k === 2 ? +(hh*1.06).toFixed(6) : hh, o]);
    await load(page, [table('even.csv', tableRows(1.1)), tcd('even_TCD.csv', areas()), table('odd.csv', odd), tcd('odd_TCD.csv', areas())], 2);
    await integrated(page);
    const card = page.locator('#tab-gc .an-card').nth(0), over = card.locator('svg.plot[id$="Over"]');
    const reds = gas => over.evaluate((s, g)=>{ const e = s._plot._stored.find(x=> x.key === g + ' suspicious'); return e ? e.ys.map((v, k)=> Number.isFinite(v) ? k : -1).filter(k=> k >= 0) : []; }, gas);
    // A scale off alike: nothing.
    assert.deepEqual((await listOf(page, '#tab-gc .gci-ksel')).filter(x=> x.bad), []);
    assert.deepEqual(await reds('h2'), []);
    // One injection off: it alone, for H₂ alone; its name red in the selector and in the list.
    await card.locator('.gci-fsel .snav-pick').click(); await page.locator('.snav-menu [data-i="1"]').click(); await settle(page);
    assert.equal(await card.locator('[id$="File"]').textContent(), 'odd');
    assert.deepEqual((await listOf(page, '#tab-gc .gci-ksel')).map((x, k)=> x.bad ? k : -1).filter(k=> k >= 0), [5]);
    assert.deepEqual(await reds('h2'), [5], 'its fit red on the overview');
    assert.equal(await over.evaluate(s=> s._plot._stored.find(x=> x.key === 'h2 table').color), '#9aa3ad', 'the table\'s values grey');
    assert.equal(await card.locator('.gci-ksel .snav-name.is-bad').count(), 0);
    for (let i = 0; i < 5; i++) await card.locator('.gci-knext').click();
    await settle(page);
    assert.equal(await idxOf(card, 'Inj'), '6/12');
    assert.equal(await card.locator('.gci-ksel .snav-name.is-bad').count(), 1, 'its name red');
    assert.equal(await card.locator('.gci-ksel .snav-name').evaluate(e=> getComputedStyle(e).color), await page.evaluate(()=> { const d = document.createElement('i'); d.style.color = 'var(--bad)'; document.body.appendChild(d); const c = getComputedStyle(d).color; d.remove(); return c; }));
    const flag = await card.locator('.gci-values-box .gci-flag').textContent();
    assert.match(flag, /H₂: -1[67]\.\d % off the GC table's proportion \(k = /, flag);
    assert.equal(await card.locator('table.gci-values tbody tr').first().locator('td').nth(1).evaluate(td=> td.classList.contains('gci-bad')), true);
    await card.locator('.gci-ov-chip[data-g="o2"]').click(); await settle(page);
    assert.deepEqual(await reds('o2'), [], 'O₂ in proportion');
    const integ = (await zip(page))['integration.csv'], rows = integ.slice(1).filter(r=> r[0] === 'odd_TCD.csv');
    assert.deepEqual(rows.map(r=> r[integ[0].indexOf('H2 suspicious')]), Array.from({ length: N }, (_, k)=> k === 5 ? 'yes' : 'no'));
    assert.ok(rows.every(r=> r[integ[0].indexOf('O2 suspicious')] === 'no'));
    // The 3rd, 5.7 % off: not marked, nothing said in its Peaks.
    for (let i = 0; i < 9; i++) await card.locator('.gci-knext').click();
    await settle(page);
    assert.equal(await idxOf(card, 'Inj'), '3/12');
    assert.equal(await card.locator('.gci-ksel .snav-name.is-bad').count(), 0);
    assert.equal(await card.locator('.gci-values-box .gci-flag').count(), 0);
    // The rule as the card's instructions give it.
    assert.match(await card.evaluate(c=> c.querySelector('.instr-block').textContent), /further from k × its table value than 10 % of that, and than k × 15 ppm/);
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
    // Peaks: the concentration in the calibration's unit, said under the table.
    assert.equal(await card.locator('.gci-values-box .gci-units').textContent(), 'Conc. in ppm; GC table in %mol.');
    assert.equal(await card.locator('.gci-values-box .gci-from').count(), 0, 'standards: nothing taken from the software');
    assert.deepEqual(errors, []); assert.deepEqual(await csp(), []);
  } finally { await close(); }
});

test('no standards: the GC software\'s scale taken over (k, the median of area/table value), said in an info alert; the rates the table\'s', async ()=>{
  const { page, errors, csp, close } = await env.page();
  try {
    await openModule(page, 'gc');
    await load(page, [table('sw.csv', tableRows(1.1)), tcd('sw_TCD.csv', areas())], 1);
    await integrated(page);
    // The alert: its message alone (v546: no line per file); the file's k under its Peaks, the
    // units said plainly, no superscript on the values.
    assert.deepEqual(await alerts(page, '#tab-gc .gci-alerts'), ['Calibration taken from the GC software\'s table (no standards for the gas): see the risks in this card\'s instructions.']);
    const vbox = page.locator('#tab-gc .an-card .gci-values-box'), from = await vbox.locator('.gci-from').textContent();
    assert.match(from, /^Concentrations from the GC software's table: k = [\d.]+ area per %mol \(H2, median of 12 injections\), [\d.]+ \(O2, median of 12 injections\)\.$/, from);
    assert.equal(await vbox.locator('.gci-units').textContent(), 'Conc. and GC table in %mol.');
    assert.ok(!/ᵗ/.test(await vbox.textContent()), 'no superscript t');
    const k = num(/k = ([\d.]+) area/.exec(from)[1]);
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

/* A project as v544 saved it: its card's method held the trapezoids (`trapezoid`, and its fit's
   spikes.roundsTrapezoid: 3), the results' keys hold the method's JSON (so theirs differ from
   v545's), and each result's gases a trapezoid area (`trap`). Made from v545's export, as v544
   wrote them (the keys checked against v544's own engine once, by hand: the same strings). */
const V544_TRAP = { h2: { left: [281, 283.6], right: [295, 300.5], valley: 'right' }, o2: { left: [295, 300.5], right: [304.8, 305.6] } };
const v544Method = m => ({ windows: m.windows, trapezoid: V544_TRAP, ...Object.fromEntries(Object.entries(m).filter(([k])=> k !== 'windows')),
  fit: { ...m.fit, spikes: { ...m.fit.spikes, roundsTrapezoid: 3 } } });
function v544Key(k){
  const i = k.indexOf('|'), a = JSON.parse(k.slice(i + 1));
  a[a.length - 1] = JSON.stringify(v544Method(JSON.parse(a[a.length - 1])));
  return k.slice(0, i + 1) + JSON.stringify(a);
}
test('a project saved by v544 (trapezoids in its method, its results\' keys and their areas) opens with nothing fitted again', async ()=>{
  const { page, errors, csp, close } = await env.page();
  try {
    await openModule(page, 'gc');
    await load(page, [table('old.csv', tableRows(1.1)), tcd('old_TCD.csv', areas())], 1);
    await integrated(page);
    const rates = (await zip(page))['mean_rates.csv'][1];
    const { obj } = await exportProject(page), st = obj.state;
    assert.ok(st.integ && Object.keys(st.integ).length === 1);
    const [k] = Object.keys(st.integ), card0 = st.cards.find(c=> c.type === 'integ');
    const old = { ...st, cards: st.cards.map(c=> c === card0 ? { ...c, method: v544Method(c.method) } : c),
      integ: { [v544Key(k)]: st.integ[k].map(r=> r && { ...r, gases: Object.fromEntries(Object.entries(r.gases).map(([g, x])=> [g, { ...x, trap: x.area*0.97 }])) }) } };
    assert.notEqual(v544Key(k), k, 'v544\'s key is not v545\'s');
    const n0 = await fitted(page);
    await importProject(page, projectFile(env, 'v544.datatreat', { ...obj, title: 'Old v544', appVersion: 'v544', state: old }, { sign: true }));
    await openProject(page, 'gc', 'Old v544');
    await integrated(page);
    assert.equal(await fitted(page), n0, 'nothing fitted again');
    const now = await moduleState(page, 'gc');
    assert.deepEqual(Object.keys(now.integ), [k], 'its results under v545\'s key');
    assert.ok(!JSON.stringify(now).includes('trap'), 'no trapezoid left in the state');
    assert.equal(await page.locator('#tab-gc .an-card').nth(0).locator('table.gci-values tbody tr').count(), 2, 'its values drawn from the results');
    assert.deepEqual((await zip(page))['mean_rates.csv'][1], rates, 'the same rates');
    assert.deepEqual(errors, []); assert.deepEqual(await csp(), []);
  } finally { await close(); }
});
