/* GC's raw chromatograms (v544; v545: the card's layout, its selectors, the chromatogram over
   its residuals, the run overview, no trapezoids, the suspicious rule; v546: the toolbar back
   over the plot, the chromatogram's selector over the overview, the boxes aligned, Peaks'
   notes, the overview's marks, the 10 % rule): the TCD files beside
   their tables, paired in the trace list, integrated again by the Integration card, and the
   Production Rate cards below it taking the re-integrated values. Every file here is made up for the test: the
   chromatograms drawn from the engine's own peak model (gc-tcd.js) with known areas, a
   seeded noise, on 250–340 s (the H₂/O₂ window, 268–326 s, inside).
   - Tables alone: a grip a file (v581: to v580 none, as v543), two tables paired by hand,
     unpaired and paired again; no Integration card, "+" adds a Production Rate card with no
     menu, no key more in the state.
   - Auto-pairing by name: a final _TCD, any case, a browser's " (1)" on either name, the .txt
     table; a file of raw chromatograms told by its content (no _TCD in its name); one row a
     pair, both names in FILE, the table's label, one Sample select (none for raw
     chromatograms alone), the row's download both files.
   - The two grips: a file onto a file alone pairs (its partner left alone), onto a paired one
     swaps, off every file stands alone; the row's ≡ reorders; each a step, "*", undone.
   - Two tables paired (the first used, the second ignored, said) and two files of raw
     chromatograms paired (shown in Integration, no sample, said); raw chromatograms alone.
     v573: a pair's note dismissed marks that pair alone: the file paired wrongly again with
     another is said again, the same pair made again is not. v574: a note dismissed marks its
     file where a state holds it as a pair's second too: undone to it and unpaired, not said.
   - v581: a Stop holds its own card's files alone, another Integration card's go on; windows
     edited on a card with no result applied as they are, the files loaded after integrated
     with them; the window's red rule and an edge in a neighbour name it H₂-O₂.
   - A count that differs: said in Integration, the table's values in Analysis, gc_raw.csv's
     source column saying why.
   - The Integration card: its two selectors (the file's over the chromatogram, the plot's
     toolbar at the right of their line as a Tauc plot's; the chromatogram's over the run
     overview, the overview's toolbar at the right of theirs; no "Run overview" title) and
     arrows, Windows aligned (v549: its title's top on the plot frame's, CLAUDE.md; Default
     on its line), the chromatogram over its residuals (their x linked, each its own y), the
     overview one gas at a time (one colour for every gas's fits, the table's crosses half
     the size; a point hovered and clicked drawn lighter and half again as large, nothing
     round it, the one on show too), no trapezoid anywhere.
   - The suspicious rule (10 %): one injection out of proportion with the table marked (red
     in the selector and its list, on the overview, said in Peaks and the CSV), one within
     10 % not, a scale off alike at every injection none.
   - The calibration window: levels typed, free and zero intercept, %mol and ppm, its line.
     v549: its standards a GC table and its raw chromatograms, dropped together (either alone
     not loaded, said, waiting for its partner; counts that differ refused, nothing
     integrated); each standard named by the table's Analysis column (a UTF-16 table; the
     .txt export's by number), in its row and in the selector over its chromatogram, drawn
     as the card's (row click, selector, arrows, ← →), its title's top on the plot frame's;
     at 375 px nothing scrolls sideways. A calibration saved by v544–v548 (raw chromatograms
     alone) opens as it was, nothing fitted again, named by column, said until the box's ×
     marks its file seen (v573: no step, kept through undo and redo, the window opened again
     and the project reopened); its table dropped names it.
   - No standards: the GC software's scale taken over (k = median of area/table value), said
     in an info alert in Integration (its message alone) and in the rate card, the file's k
     under its Peaks, the units said plainly, no superscript.
   - The rates from the re-integrated values against a hand calculation from the known areas.
   - No sample (v569): every table left out, or removed with raw chromatograms left: the
     Production Rate card as one that never had any, no CSV of its. After a Stop (v569):
     standards dropped in the Calibration window integrated; stopped with standards left, the
     window says so.
   - The project saved and reloaded: pairs, method, calibration and results, nothing fitted
     again; a method changed (a step) and undone, nothing fitted again; results coming in no
     step. A project as v544 saved it (its method's trapezoids, its results' keys and their
     trapezoid areas) opens with nothing fitted again. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { start, openModule, settle, moduleState, history, undo, download, readZip, parseCsv, tabLabels, saveAs, ready, ROOT, exportProject, projectFile, importProject, openProject, firstTop, until } from './helpers.mjs';

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
   times `sw` (tableRows: a software calibration off by that much). */
const S_H2 = 40000, S_O2 = 12000, N = 12;
const truth = Array.from({ length: N }, (_, k)=> [0.05 + 0.01*k, 0.03 + 0.002*k]);
const areas = (rows = truth)=> rows.map(([h, o])=> [h*S_H2, o*S_O2]);
const tableRows = (sw = 1, rows = truth)=> rows.map(([h, o])=> [+(h*sw).toFixed(6), +(o*sw).toFixed(6)]);
// The standards: H₂ at 0.05, 0.1, 0.2 %mol (no O₂), O₂ at 0.02, 0.05, 0.1 %mol (no H₂).
const STD = [[0.05, 0], [0.1, 0], [0.2, 0], [0, 0.02], [0, 0.05], [0, 0.1]];
const stdTcd = name => tcd(name, STD.map(([h, o])=> [h*S_H2, o*S_O2]));
/* Their GC table (v549) as the GC software writes a calibration's: UTF-16 LE with its mark,
   ';' between quoted names and the cells, CRLF, an Analysis column naming each injection
   (the last name long, to be cut in its column), other gases beside H₂ and O₂. Only the
   names are read: the values here, nonsense on purpose, must go nowhere. */
const STD_NAMES = ['cal_H2_0.05%_001', 'cal_H2_0.1%_001', 'cal_H2_0.2%_001', 'cal_O2_0.02%_001', 'cal_O2_0.05%_001', 'cal_O2_0.1%_001 and a long remark the software kept'];
function calTable(name, names = STD_NAMES){
  const head = '"Analysis";"Injection date";"CH4 (A) [%Mol]";"H2 (B) [%Mol]";"O2 (B) [%Mol]";"N2 (B) [%Mol]";"Total (%)";';
  const rows = names.map((nm, k)=>{ const m = 10*60 + 33*k, h = Math.floor(m/60); return `"${nm}";10/29/2026 ${h % 12 || 12}:${String(m % 60).padStart(2, '0')}:36 ${h < 12 ? 'AM' : 'PM'};0.00000;${(7 + k).toFixed(5)};${(3 + k).toFixed(5)};57.87601;157.68375;`; });
  return { name, mimeType: 'text/csv', buffer: Buffer.from('\ufeff' + [head, ...rows].join('\r\n') + '\r\n', 'utf16le') };
}
// A standard's chromatogram as the browser reads it back from stdTcd(name)'s file (k: its column).
const stdY = (name, k)=> chromatogram(STD[k][0]*S_H2, STD[k][1]*S_O2, 101 + 7*k + name.length).map(v=> +v.toFixed(5));

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
/* Integrate (v578): its button's label, whether disabled and highlighted; the job seen running
   (a card's status, or the calibration window's); every chromatogram's integration slowed by
   `ms` (its message to its worker held back: a run to stop under way; 0, as before); a press
   past the button's turn (utils.js quickPress takes none within 600 ms of it). */
const integ = loc => loc.evaluate(b=> [b.textContent, b.disabled, b.classList.contains('primary')]);
const running = (page, sel = '#tab-gc .gci-status')=> page.waitForFunction(s=> document.querySelector(s)?.dataset.state === 'running', sel, { timeout: 20000 });
// (each chromatogram handed to a worker noted, its first values: window.__posts)
const slow = (page, ms)=> page.evaluate(ms=>{
  const W = window.__Worker || (window.__Worker = window.Worker);
  window.__posts = [];
  window.Worker = class extends W { postMessage(d){ window.__posts.push(Array.from(d.y.slice(0, 4))); if (ms) setTimeout(()=> super.postMessage(d), ms); else super.postMessage(d); } };
}, ms);
async function pressAfterTurn(page, btn){ await page.waitForTimeout(650); await btn.click(); await settle(page); }
const chroms = n => `${n} chromatogram${n === 1 ? '' : 's'}`;
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

test('tables alone: a grip each (v581), two paired by hand, unpaired and paired again; no Integration card, "+" a Production Rate card with no menu, the state as v543\'s', async ()=>{
  const { page, errors, csp, close } = await env.page();
  try {
    await openModule(page, 'gc');
    await load(page, [table('plain.csv', tableRows()), altTable('plain-alt.txt', tableRows())], 2);
    assert.deepEqual((await rowsOf(page)).map(r=> [r.files, r.grips]), [[['plain.csv'], 1], [['plain-alt.txt'], 1]], 'a grip a file (to v580 none)');
    assert.equal(await page.locator('#tab-gc .an-card').count(), 1);
    assert.equal(await page.locator('#tab-gc .an-card .gci-body').count(), 0, 'no Integration card');
    assert.equal(await page.locator('#tab-gc .an-card .an-type.is-fixed').count(), 1, 'the title names its kind');
    const st = await moduleState(page, 'gc');
    assert.deepEqual(Object.keys(st).sort(), ['cards', 'files']);
    assert.ok(st.files.every(f=> !('mate' in f) && !('tcd' in f)));
    assert.equal(await fitted(page), 0);
    assert.equal(await page.locator('#tab-gc .gc-src .alert').count(), 0, 'nothing said of a source');
    // Paired by hand (two tables: the first used, said), unpaired, paired again: each a step.
    const s0 = await steps(page), files = async ()=> (await rowsOf(page)).map(r=> r.files.join(' + '));
    await dragFile(page, 'plain-alt.txt', 'plain.csv');
    assert.deepEqual(await files(), ['plain.csv + plain-alt.txt']);
    assert.ok((await alerts(page)).some(a=> a.includes('two tables paired (plain.csv, plain-alt.txt)')));
    await dragFile(page, 'plain-alt.txt', null);
    assert.deepEqual(await files(), ['plain.csv', 'plain-alt.txt']);
    assert.deepEqual((await rowsOf(page)).map(r=> r.grips), [1, 1], 'the grips still there (to v580 gone with the pair)');
    await dragFile(page, 'plain-alt.txt', 'plain.csv');
    assert.deepEqual(await files(), ['plain.csv + plain-alt.txt'], 'paired again by hand');
    assert.equal(await steps(page), s0 + 3);
    assert.equal(await page.locator('#tab-gc .an-card .gci-body').count(), 0, 'still no Integration card');
    await page.click('#gcAddAn'); await settle(page);
    assert.equal(await page.locator('.an-menu:not([hidden])').count(), 0, 'no menu');
    assert.equal(await page.locator('#tab-gc .an-card').count(), 2, 'a Production Rate card added');
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
    // (v567: to check under the drop zone; here a grey line names them)
    assert.deepEqual(await page.locator('#tab-gc .gci-alerts .gci-shown').allTextContents(), ['P_TCD: shown here, no injection times.', 'P_TCD · Q_TCD.csv: shown here, no injection times.']);
    await integrated(page);
    const z = await zip(page);
    const raw = z['gc_raw.csv'];
    assert.deepEqual(column(raw, 'H2 (%mol) [twin]').slice(1, 3).map(num), tableRows().slice(0, 2).map(r=> r[0]), 'the first table\'s values');
    assert.deepEqual(errors, []); assert.deepEqual(await csp(), []);
  } finally { await close(); }
});

/* A pair's note under the drop zone (v573): its × marks the row for that pair alone; paired
   wrongly again with another file, said again; the same pair made again, seen (to v572 the
   row's file marked for the box, whatever it was paired with later). */
test('a pair\'s note: its × marks that pair; the file paired wrongly again with another said again, the same pair made again not', async ()=>{
  const { page, errors, csp, close } = await env.page();
  try {
    await openModule(page, 'gc');
    await load(page, [table('twin.csv', tableRows()), table('twin_TCD.csv', tableRows(2)), table('other.csv', tableRows(3))], 2);
    const pairs = async ()=> (await alerts(page)).join(' ').match(/two tables paired \([^)]*\)/g) || [];
    assert.deepEqual(await pairs(), ['two tables paired (twin.csv, twin_TCD.csv)']);
    const h = await history(page, 'gc');
    await page.click('#gcAlerts [data-action="gc-dismiss-check"]'); await settle(page);
    assert.deepEqual(await pairs(), [], 'dismissed');
    assert.deepEqual(await history(page, 'gc'), h, 'no step of the history');
    // (a file onto a paired one: the two swap; the grips are there while a pair is)
    await dragFile(page, 'other.csv', 'twin_TCD.csv');
    assert.deepEqual((await rowsOf(page)).map(r=> r.files), [['twin.csv', 'other.csv'], ['twin_TCD.csv']]);
    assert.deepEqual(await pairs(), ['two tables paired (twin.csv, other.csv)'], 'paired wrongly again, with another file: said');
    await dragFile(page, 'twin_TCD.csv', 'other.csv');
    assert.deepEqual((await rowsOf(page)).map(r=> r.files), [['twin.csv', 'twin_TCD.csv'], ['other.csv']]);
    assert.deepEqual(await pairs(), [], 'the pair dismissed, made again: seen');
    await undo(page);
    assert.deepEqual(await pairs(), ['two tables paired (twin.csv, other.csv)'], 'undone to the other pair: said');
    assert.deepEqual((await moduleState(page, 'gc')).files[0].seen, ['check:pair:twin_TCD.csv'], 'the row marked for the pair dismissed alone');
    assert.deepEqual(errors, []); assert.deepEqual(await csp(), []);
  } finally { await close(); }
});

/* A file's note dismissed while it heads its row (v574): marked in every state, those that
   hold it as a pair's second too; undone to one and unpaired again, not said (to v573 marked
   there only where it headed a row, and said again). */
test('a note dismissed marks its file where a state holds it paired: undone to that state and unpaired, not said again', async ()=>{
  const { page, errors, csp, close } = await env.page();
  try {
    await openModule(page, 'gc');
    // (twin_TCD.txt a table, the alternative export: paired by its name with twin.csv)
    await load(page, [table('twin.csv', tableRows()), altTable('twin_TCD.txt', tableRows(2)), table('other.csv', tableRows(3))], 2);
    const alt = async ()=> (await alerts(page)).filter(a=> a.includes('twin_TCD.txt: the alternative export'));
    assert.deepEqual((await rowsOf(page)).map(r=> r.files), [['twin.csv', 'twin_TCD.txt'], ['other.csv']]);
    assert.equal((await alt()).length, 0, 'a pair\'s second: no note of its own');
    await dragFile(page, 'twin_TCD.txt', null);
    assert.deepEqual((await rowsOf(page)).map(r=> r.files), [['twin.csv'], ['twin_TCD.txt'], ['other.csv']]);
    assert.equal((await alt()).length, 1, 'heading its row: said');
    const h = await history(page, 'gc');
    await page.click('#gcAlerts [data-action="gc-dismiss-read"]'); await settle(page);
    assert.equal((await alt()).length, 0, 'dismissed');
    assert.deepEqual(await history(page, 'gc'), h, 'no step of the history');
    await undo(page);
    assert.deepEqual((await rowsOf(page)).map(r=> r.files), [['twin.csv', 'twin_TCD.txt'], ['other.csv']]);
    assert.deepEqual((await moduleState(page, 'gc')).files[0].mate.seen, ['read'], 'the pair\'s second marked in the state undone to');
    await dragFile(page, 'twin_TCD.txt', null);
    assert.equal((await alt()).length, 0, 'unpaired again: seen');
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
    assert.ok(ia.includes(`short: ${N} injections in the table, ${N - 1} chromatograms: not aligned: integrated all the same`), ia);
    // (a compact box with no ×: worked out again with the files, v571, G07; to v570 a × that held
    // until the next drawing)
    assert.equal(await card.locator('.gci-alerts .alert.warn.compact').count(), 1);
    assert.equal(await card.locator('.gci-alerts .alert-dismiss').count(), 0);
    const at = await firstTop(page, '#tab-gc .an-card:nth-child(1)', { frame: 'svg.gci-chrom', head: '.gci-win-head' });
    assert.ok(Math.abs(at.top - at.frame) <= 1, `Windows' top on the frame's under the card's alert: ${JSON.stringify(at)}`);
    assert.equal(await idxOf(card, 'Inj'), `1/${N - 1}`, 'every chromatogram integrated and shown');
    // (all integrated: the status line says nothing and folds away, v545; Integrate quiet, v578)
    assert.equal(await card.locator('.gci-status').textContent(), '');
    assert.equal(await card.locator('.gci-status').isVisible(), false);
    assert.deepEqual(await card.locator('.gci-integ').evaluate(b=> [b.textContent, b.disabled, b.classList.contains('primary')]), ['Integrate', true, false]);
    const ra = (await alerts(page, '#tab-gc .gc-src')).join(' ');
    assert.ok(ra.includes(`short: ${N} injections in the table, ${N - 1} chromatograms: see the Integration card`), ra);
    const raw = (await zip(page))['gc_raw.csv'];
    assert.deepEqual(column(raw, 'H2 (%mol) [short]').slice(1).map(num), tableRows().map(r=> r[0]), 'the table\'s values');
    assert.ok(column(raw, 'H2 source [short]').slice(1).every(s=> s === `table (${N} injections in the table, ${N - 1} chromatograms)`));
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

/* A Production Rate card with no sample (v569): every table left out, or removed with raw
   chromatograms left, lets go of the tables it had, as a card that never had any: its
   plots, legends and chips empty, its Results hidden, no CSV of its in the project's (to
   v568 the last tables stayed: in the project's CSVs, and on show beside the raw
   chromatograms). */
const rateCard = page => page.locator('#tab-gc .an-card').filter({ has: page.locator('svg[id$="Svg1"]') });
const blankCard = page => rateCard(page).evaluate((card)=>{
  const res = document.querySelector(`#gcResList [data-an="${card.dataset.an}"]`);
  const svgs = [...card.querySelectorAll('svg.plot'), ...(res ? res.querySelectorAll('svg.plot') : [])];
  const legends = [...card.querySelectorAll('.legend'), ...(res ? res.querySelectorAll('.legend') : [])];
  return { drawn: svgs.filter(s=> s.childElementCount).length, tools: card.querySelectorAll('.plot-tool-btns').length, dl: card.querySelectorAll('.plot-wrap > .plot-dl-btn').length,
    legends: legends.map(l=> l.textContent).join(''), chips: card.querySelectorAll('.gc-gas-chip').length, src: card.querySelector('.gc-src').textContent };
});
const BLANK = { drawn: 0, tools: 0, dl: 1, legends: '', chips: 0, src: '' };
async function csvNames(page){
  const [d] = await Promise.all([page.waitForEvent('download', { timeout: 2500 }).catch(()=> null), page.click('.proj-csv')]);
  return d ? readZip(fs.readFileSync(await d.path())).map(e=> e.name.replace(/^.* - /, '')).sort() : null;
}

test('no sample (v569): every table left out, or the table removed with raw chromatograms left, the Production Rate card lets go of its tables: no plot, no legend, no CSV', async ()=>{
  const { page, errors, csp, close } = await env.page();
  try {
    await openModule(page, 'gc');
    await load(page, [table('one.csv', tableRows()), table('two.csv', tableRows(2))], 2);
    assert.ok((await blankCard(page)).drawn > 0, 'drawn');
    assert.deepEqual(await csvNames(page), ['gc_info.csv', 'gc_raw.csv', 'gc_results.csv', 'mean_rates.csv']);
    // Every table left out: the card as one that never had any, no CSV.
    await page.locator('#gcFileTableWrap .incl-all').click(); await settle(page);
    assert.equal(await page.locator('#gcFileTableWrap tr.file-row.is-excluded').count(), 2);
    assert.equal(await csvNames(page), null, 'no CSV of the tables left out');
    assert.deepEqual(await blankCard(page), BLANK);
    // Taken back in (an undo, then the box again): drawn and written again.
    await undo(page);
    assert.deepEqual(await csvNames(page), ['gc_info.csv', 'gc_raw.csv', 'gc_results.csv', 'mean_rates.csv']);
    assert.ok((await blankCard(page)).drawn > 0, 'drawn again');
    await undo(page, true);
    assert.deepEqual(await blankCard(page), BLANK);
    await page.locator('#gcFileTableWrap .incl-all').click(); await settle(page);
    assert.equal((await blankCard(page)).tools, 1, 'its toolbar back');
    assert.deepEqual(await csvNames(page), ['gc_info.csv', 'gc_raw.csv', 'gc_results.csv', 'mean_rates.csv']);
    // A table and raw chromatograms of another run; the tables removed, the raw chromatograms left.
    await load(page, [tcd('zz_TCD.csv', areas())], 3);
    await integrated(page);
    for (let k = 0; k < 2; k++){ await page.locator('#gcFileTableWrap .row-del').first().click(); await settle(page); }
    assert.deepEqual((await rowsOf(page)).map(r=> r.files), [['zz_TCD.csv']]);
    assert.ok(await page.locator('#gcAnalyses').isVisible(), 'the cards shown (Integration\'s)');
    assert.deepEqual(await blankCard(page), BLANK);
    assert.equal(await rateCard(page).locator('[id$="Legend"]').first().textContent(), '', 'no "one H₂ / one O₂" left');
    const left = await csvNames(page);
    assert.ok(!left || !left.some(n=> /^(gc_raw|gc_results|mean_rates|gc_info)\.csv$/.test(n)), String(left));
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
       under its line; no "Run overview" title. Then Windows: its title's top (its letters')
       on the chromatogram frame's top edge (CLAUDE.md, v549; v546–v548 on the selector's
       line), its box under it, right of the plot. */
    const geo = await card.evaluate(c=>{
      const r = s => c.querySelector(s).getBoundingClientRect(), mid = b => (b.top + b.bottom)/2;
      const nav = r('.gci-nav'), ovn = r('.gci-ov-nav'), tb = r('.gci-pair > .plot-btn-col'), otb = r('.plot-wrap:has(> svg.gci-over) > .plot-btn-col');
      const ch = r('svg.gci-chrom'), ov = r('svg.gci-over'), lg = r('[id$="ChromLegend"]');
      return { order: [r('.gci-fsel .snav-steps').right <= r('.gci-fsel .snav-pick').left, r('.gci-ksel .snav-steps').right <= r('.gci-ksel .snav-pick').left],
        f: [r('.gci-fsel').left - ch.left, mid(r('.gci-fsel')) - mid(nav), mid(tb) - mid(nav), tb.right - ch.right, ch.top - nav.bottom].map(v=> Math.round(v*10)/10),
        k: [r('.gci-ksel').left - ov.left, mid(r('.gci-ksel')) - mid(ovn), mid(otb) - mid(ovn), otb.right - ov.right, ov.top - ovn.bottom].map(v=> Math.round(v*10)/10),
        below: ovn.top - lg.bottom, steps: [r('.gci-fsel .snav-steps').width, r('.gci-ksel .snav-steps').width],
        caps: [...c.querySelectorAll('.txt-caption')].map(x=> x.textContent), text: c.innerText,
        win: [r('.gci-win-box').top - ch.top, r('.gci-win-box').left - ch.right] };
    });
    assert.deepEqual(geo.order, [true, true], 'the arrows first, then the name');
    const zero = (xs, what)=> xs.forEach((v, i)=> assert.ok(Math.abs(v - [0, 0, 0, 0, 6][i]) <= 1, `${what}: ${xs}`));
    zero(geo.f, 'the file\'s selector over the chromatogram at its left, the plot\'s toolbar at the right of its line');
    zero(geo.k, 'the chromatogram\'s selector over the overview at its left, the overview\'s toolbar at the right of its line');
    assert.ok(geo.below > 0, 'the overview\'s line under the chromatogram\'s legend');
    assert.ok(geo.steps[0] === geo.steps[1] && geo.steps[0] > 100, `the arrows' groups one width: ${geo.steps}`);
    assert.ok(!geo.caps.includes('Run overview') && !/Run overview/i.test(geo.text), 'no "Run overview" title');
    const wt = await firstTop(page, '#tab-gc .an-card:nth-child(1)', { frame: 'svg.gci-chrom', head: '.gci-win-head' });
    assert.ok(Math.abs(wt.top - wt.frame) <= 1 && wt.text === 'WINDOWS', `Windows: its title's top on the frame's: ${JSON.stringify(wt)}`);
    assert.ok(geo.win[0] > 10 && geo.win[1] > 0, `its box under its title, right of the plot: ${geo.win}`);
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
    // (v582: each window named in ASCII as the legend names it, H2-O2; to v581 by its key, H2O2)
    assert.ok(cz.name.endsWith('chromatogram.csv') && ['Time (s)', 'TCD signal', 'model (H2-O2)', 'baseline (H2-O2)', 'residual (H2-O2)', 'H2-O2 window from (s)'].every(h=> crows[0].includes(h)) && !crows[0].some(h=> h.includes('H2O2')), crows[0].join(' | '));
    assert.equal(crows.length - 1, T.length, 'the whole chromatogram');
    await card.locator('.gci-pair .plot-tool-btn[title="Figure composer (advanced export)"]').click();
    await page.waitForSelector('.fig-backdrop .fig-svg path');
    const groups = ()=> page.$$eval('.fig-backdrop .fig-group', gs=> gs.map(g=> [...g.querySelectorAll('.fig-slabel')].map(i=> i.value)));
    let gr = await groups();
    assert.equal(gr.length, 2, 'two panels');
    assert.ok(gr[0].includes('raw') && gr[1].includes('residual') && !gr[0].includes('residual'), JSON.stringify(gr));
    // (v582: the window's lines named as Windows names it, H₂-O₂; to v581 by its key, "model (H2O2)")
    assert.ok(gr[0].includes('model (H₂-O₂)') && gr[0].includes('baseline (H₂-O₂)') && !gr.flat().some(n=> n.includes('H2O2')), JSON.stringify(gr));
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
    /* Hovered (v546): its point alone drawn again, in a lighter shade of its colour and
       half again as large (v548; a tenth larger to v547), with no halo, no ring, no white
       centre, its label as before; the one on show too. */
    const hl = ()=> over.evaluate(s=>{ const g = s.querySelector('.gci-hl'); return g ? { sel: g.dataset.sel, hov: g.dataset.hov, pts: [...g.querySelectorAll('.gci-hl-pt')].map(c=> c.getAttribute('fill')),
      r: [...g.querySelectorAll('.gci-hl-pt')].map(c=> +c.getAttribute('r') + (c.getAttribute('stroke') && c.getAttribute('stroke') !== 'none' ? (+c.getAttribute('stroke-width') || 1)/2 : 0)), stroke: [...g.querySelectorAll('.gci-hl-pt')].map(c=> c.getAttribute('stroke')), more: g.querySelectorAll('circle:not(.gci-hl-pt), .gci-hl-halo').length,
      label: g.querySelector('.plot-pick-label') ? g.querySelector('.plot-pick-label').textContent : '' } : null; });
    /* Sizes as seen (v547): a radius plus half its stroke, read from the drawn circles (to
       v546 the r attributes alone were compared, and the dot's ring outgrew the point). */
    const fitR = await over.evaluate(s=>{ const c = s._plot._stored.find(x=> x.key === 'h2 fit')._el.querySelector('circle'), st = c.getAttribute('stroke');
      return +c.getAttribute('r') + (st && st !== 'none' ? (+c.getAttribute('stroke-width') || 1)/2 : 0); });
    const h0 = await hl(), lit = /^rgb\((\d+),(\d+),(\d+)\)$/.exec(h0.pts[0] || '');
    assert.ok(Math.abs(h0.r[0]/fitR - 1.5) <= 0.01, `the point on show half again as large as the dot as seen: ${h0.r[0]} against ${fitR}`);
    assert.deepEqual({ ...h0, pts: h0.pts.length, r: h0.r.length }, { sel: '0', hov: '', pts: 1, r: 1, stroke: ['none'], more: 0, label: '' }, 'the chromatogram on show: lighter, half again as large, nothing round it');
    assert.ok(lit && [0x3a, 0xa0, 0xff].every((c, i)=> +lit[i + 1] >= c) && +lit[1] > 0x3a + 40 && +lit[1] < 0xd0 && +lit[2] < 0xf0, `a lighter shade of the fits' blue, not white: ${h0.pts[0]}`);
    const pt = k => over.evaluate((s, k)=>{ const P = s._plot, b = s.getBoundingClientRect(), e = P._stored.find(x=> x.key === 'h2 fit'); return { x: b.left + P.px(e.xs[k]), y: b.top + P.py(e.ys[k]) }; }, k);
    let q = await pt(3);
    await page.mouse.move(q.x + 2, q.y - 2); await settle(page);
    let h = await hl();
    assert.equal(h.hov, '3'); assert.equal(h.pts.length, 2);
    assert.ok(Math.abs(h.r[1]/fitR - 1.5) <= 0.01, `hovered: half again as large as the dot as seen: ${h.r[1]} against ${fitR}`);
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
    // (v581: the window named as Windows names it, H₂-O₂; to v580 by its key, H2O2)
    assert.equal(await card.locator('.gci-method .gci-flag').textContent(), '⚠ The H₂-O₂ window (263–326 s) reaches S264 (262–267.5 s), which its model has no peak for: the fit degrades there.');
    // (a compact warning, v571, G08: to v570 an amber line)
    assert.equal(await card.locator('.gci-method .alert.warn.compact.gci-flag').count(), 1);
    assert.equal(await steps(page), s0 + 1);
    await undo(page);
    assert.equal(await card.locator('.gci-method .gci-flag').count(), 0);
    assert.equal(await steps(page), s0);
    // A window made too short: not taken, its field flashing, its rule in red under the window
    // (v571, C19 and G11: to v570 a warning box "Not taken:" over the chromatogram); no step; the
    // next drawing lets it go. Windows' title still on the plot frame's top.
    const was = await field('w0:from').inputValue(), to = +(await field('w0:to').inputValue());
    await field('w0:from').fill(String(to - 2)); await field('w0:from').press('Enter');
    await page.waitForSelector('#tab-gc .gci-method input[data-k="w0:from"].field-invalid');
    await settle(page);
    assert.equal(await card.locator('.gci-method .gci-win-rule').textContent(), 'The H₂-O₂ window must start at least 5 s before it ends.');
    assert.equal(await field('w0:from').inputValue(), was, 'the edge as it was');
    assert.equal(await card.locator('.gci-notice .alert').count(), 0, 'no box over the chromatogram');
    assert.equal(await steps(page), s0, 'no step');
    const rt = await firstTop(page, '#tab-gc .an-card:nth-child(1)', { frame: 'svg.gci-chrom', head: '.gci-win-head' });
    assert.ok(Math.abs(rt.top - rt.frame) <= 1, `Windows' top on the frame's with the rule under a window: ${JSON.stringify(rt)}`);
    await card.locator('.gci-knext').click(); await settle(page);
    assert.equal(await card.locator('.gci-method .gci-win-rule').count(), 0, 'gone at the next drawing');
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
    // (a compact warning, v571, G08; the previous method's not said here, G10)
    assert.match(await card.locator('.gci-values-box .alert.warn.compact.gci-flag').textContent(), /^⚠ Suspicious: H₂: /);
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
    await m.locator('.gci-cal-in').setInputFiles([calTable('standards.csv'), stdTcd('standards_TCD.csv')]);
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

const calDone = page => page.waitForFunction(()=> /^\d+ chromatograms? integrated\.$/.test(document.querySelector('.gci-cal-modal .gci-cal-status').textContent), null, { timeout: 60000 });
test('the calibration window (v549): a GC table and its raw chromatograms, both needed, as many; each standard named by the table, drawn as the card\'s chromatogram, chosen by its row, the selector, the arrows and ← →; its title aligned; 375 px', async ()=>{
  const { page, errors, csp, close } = await env.page();
  try {
    await openModule(page, 'gc');
    await load(page, [table('run.csv', tableRows()), tcd('run_TCD.csv', areas())], 1);
    await integrated(page);
    const card = page.locator('#tab-gc .an-card').nth(0), m = page.locator('.gci-cal-modal');
    await card.locator('.gci-cal').click(); await m.waitFor({ state: 'visible' });
    const n0 = await fitted(page), s0 = await steps(page);
    const said = async ()=> (await m.locator('.gci-cal-alerts .alert').allInnerTexts()).map(t=> t.replace(/\s+/g, ' ').trim());
    const rows = ()=> m.locator('.gci-cal-levels tbody tr[data-row]').count();
    // Raw chromatograms alone: not loaded, said in red, nothing integrated, no step; nothing but
    // the drop zone and what it said (v578: to v577 "No standards…" and an empty table).
    await m.locator('.gci-cal-in').setInputFiles([stdTcd('std_TCD.csv')]); await settle(page);
    let a = await said();
    assert.equal(a.length, 1); assert.equal(await m.locator('.gci-cal-alerts .alert.bad').count(), 1);
    assert.match(a[0], /Not loaded: std_TCD\.csv: raw chromatograms without their GC table: drop the table too, the same name without _TCD \(\.csv or \.txt\); this file waits here for it\./);
    assert.equal(await rows(), 0, 'no standard');
    assert.equal(await m.locator('.gci-cal-status').isVisible(), false);
    // A table alone (of another name): the same; the raw chromatograms still said.
    await m.locator('.gci-cal-in').setInputFiles([calTable('other.csv')]); await settle(page);
    a = await said();
    assert.match(a[0], /std_TCD\.csv: raw chromatograms without their GC table/);
    assert.match(a[0], /other\.csv: a GC table without its raw chromatograms: drop them too, the same name with _TCD; this file waits here for them\./);
    assert.equal(await rows(), 0);
    // A pair whose counts differ (5 injections in the table, 6 chromatograms): refused, nothing integrated.
    await m.locator('.gci-cal-in').setInputFiles([calTable('five.csv', STD_NAMES.slice(0, 5)), stdTcd('five_TCD.csv')]); await settle(page);
    a = await said();
    assert.ok(a[0].includes('five.csv + five_TCD.csv: 5 injections in the table, 6 chromatograms: they must be as many, a name for each chromatogram: nothing integrated.'), a[0]);
    assert.equal(await rows(), 0);
    assert.equal(await fitted(page), n0, 'nothing integrated');
    assert.equal(await steps(page), s0, 'no step');
    // The table of the raw chromatograms waiting dropped: the pair loaded, one step; the alert
    // says only what is left.
    await m.locator('.gci-cal-in').setInputFiles([calTable('std.csv')]);
    await calDone(page); await settle(page);
    a = await said();
    assert.ok(a.length === 1 && !a[0].includes('std_TCD.csv') && a[0].includes('other.csv'), a.join(' | '));
    assert.equal(await steps(page), s0 + 1, 'one step');
    assert.equal(await fitted(page), n0 + 6, 'its six chromatograms integrated');
    assert.deepEqual(await m.locator('.xrd-std-row .xrd-std-name').allTextContents(), ['std.csv + std_TCD.csv']);
    // Each standard named by the table's Analysis column (UTF-16 LE, ';', quoted); nothing
    // else read from it: no concentration.
    assert.deepEqual(await m.locator('.gci-cal-levels tbody .gci-cal-name').allTextContents(), STD_NAMES);
    assert.deepEqual(await m.locator('.gci-cal-levels thead th').allTextContents(), ['#', '', 'Injection', 'H2 area', 'O2 area', 'H2 (%mol)', 'O2 (%mol)', 'Use']);
    const long = await m.locator('.gci-cal-levels tbody tr').nth(5).locator('td.gci-cal-src').evaluate(td=>{ const n = td.querySelector('.gci-cal-name'); return { cut: n.scrollWidth > n.clientWidth + 0.5, title: td.title }; });
    assert.ok(long.cut && long.title === `${STD_NAMES[5]} (std.csv, std_TCD.csv, column 6)`, `the long name cut, whole in its tooltip: ${JSON.stringify(long)}`);
    assert.deepEqual(await m.locator('.gci-cal-levels tbody input[type="text"]').evaluateAll(xs=> xs.map(x=> x.value)), Array(12).fill(''), 'no concentration read');
    // The standard on show: the selector's name the table's, the plot its chromatogram
    // (the file's own values), the model, its residuals; the windows' edges fixed.
    const shown = ()=> page.evaluate(()=>{
      const M = document.querySelector('.gci-cal-modal'), P = M.querySelector('svg.gci-chrom')._plot, Q = M.querySelector('svg.gci-resid')._plot, raw = P._stored.find(e=> e.key === 'raw');
      return { ys: raw ? Array.from(raw.ys.slice(100, 106)) : null, model: P._stored.some(e=> /^model /.test(e.key || '')), resid: Q._stored.some(e=> e.key === 'residual'),
        idx: M.querySelector('.gci-csel .nav-count').textContent, name: M.querySelector('.gci-csel .snav-name').textContent, sel: [...M.querySelectorAll('tbody tr.selected')].map(tr=> +tr.dataset.row),
        grips: M.querySelectorAll('svg.gci-chrom .plot-goverlay circle').length, edges: P._stored.filter(e=> e.type === 'vline').length, fit: M.querySelector('.gci-cal-fit').textContent };
    });
    const showing = async (k, what)=>{
      const v = await shown();
      assert.deepEqual(v.ys, stdY('std_TCD.csv', k).slice(100, 106), `${what}: standard ${k + 1}'s chromatogram`);
      assert.ok(v.model && v.resid, `${what}: its model and residuals`);
      assert.deepEqual([v.idx, v.name, v.sel], [`${k + 1}/6`, STD_NAMES[k], [k]], what);
      assert.ok(v.grips === 0 && v.edges === 2, `${what}: the window's two edges, fixed`);
      assert.match(v.fit, /^H2: area -?[\d.]+ ± [\d.]+, χ²r [\d.]+ · O2: area -?[\d.]+/, what);
    };
    await showing(0, 'loaded: the first standard');
    await m.locator('.gci-cal-levels tbody tr').nth(2).locator('td').first().click(); await settle(page);
    await showing(2, 'its row clicked');
    await m.locator('.gci-cnext').click(); await settle(page);
    await showing(3, 'the selector\'s next arrow');
    await m.locator('.gci-cal-box').focus();
    await page.keyboard.press('ArrowRight'); await settle(page);
    await showing(4, '→');
    await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowLeft'); await settle(page);
    await showing(2, '← twice');
    // (a field of a row taken shows its standard; ← → there move in the field, not the standards)
    await m.locator('input[data-j="1"][data-g="o2"]').click(); await settle(page);
    await showing(1, 'a field of its row taken');
    await page.keyboard.press('ArrowRight'); await settle(page);
    await showing(1, '→ in a field');
    assert.equal(await card.locator('.gci-ksel .nav-count').textContent(), '1/12', 'the card behind the window unmoved');
    const list = await listOf(page, '.gci-cal-modal .gci-csel');
    assert.deepEqual(list.map(x=> x.text), STD_NAMES, 'its list: the table\'s names');
    await page.locator('.gci-cal-modal .gci-csel .snav-pick').click();
    await page.locator('.snav-menu [data-i="5"]').click(); await settle(page);
    await showing(5, 'the list');
    // The toolbar the card's: one for both panels; the CSV the standard's whole chromatogram.
    assert.equal(await m.locator('.gci-cal-pair .plot-tool-btn[title="Zoom area"]').count(), 1);
    const cz = await download(page, ()=> m.locator('.gci-cal-pair .plot-csv-btn').click());
    const crows = parseCsv(cz.buf.toString('utf8').replace(/^﻿/, ''), ';');
    assert.ok(cz.name.endsWith(' - standard_chromatogram.csv') && ['Time (s)', 'TCD signal', 'model (H2-O2)', 'residual (H2-O2)'].every(h=> crows[0].includes(h)), `${cz.name}: ${crows[0].join(' | ')}`);
    assert.equal(crows.length - 1, T.length);
    assert.ok(Math.abs(num(crows[101][1]) - stdY('std_TCD.csv', 5)[100]) < 1e-3, 'the standard on show\'s');
    // CLAUDE.md: the plot on the left, the table on the right: Standards' top (its letters') on
    // the plot frame's, the toolbar on the selector's line, the column down to the plot's foot:
    // the table's box, then Integrate (v578: to v577 the table's box to the foot).
    const st = await firstTop(page, '.gci-cal-modal', { frame: '.gci-cal-pair svg.gci-chrom', head: '.gci-cal-side > .param-head' });
    assert.ok(Math.abs(st.top - st.frame) <= 1 && st.text === 'STANDARDS', `Standards' top on the frame's: ${JSON.stringify(st)}`);
    const lay = await m.evaluate(M=>{ const r = s => M.querySelector(s).getBoundingClientRect(), mid = b => (b.top + b.bottom)/2;
      return { tb: mid(r('.gci-cal-pair > .plot-btn-col')) - mid(r('.gci-cal-nav')), foot: r('.gci-cal-side .gci-integ').bottom - r('.gci-cal-pair svg.gci-resid').bottom,
        under: r('.gci-cal-side .gci-integ').top - r('.gci-cal-table').bottom, left: r('.gci-cal-side').left - r('.gci-cal-pair svg.gci-chrom').right }; });
    assert.ok(Math.abs(lay.tb) <= 1 && Math.abs(lay.foot) <= 1 && lay.under > 0 && lay.left > 0, JSON.stringify(lay));
    // The .txt export's table, no name column: its standards by number.
    await m.locator('.gci-cal-in').setInputFiles([altTable('alt.txt', [[0.1, 0], [0, 0.05]]), tcd('alt_TCD.csv', [[0.1*S_H2, 0], [0, 0.05*S_O2]])]);
    await page.waitForFunction(()=> document.querySelectorAll('.gci-cal-modal tbody tr[data-row]').length === 8);
    await calDone(page); await settle(page);
    assert.deepEqual((await m.locator('.gci-cal-levels tbody .gci-cal-name').allTextContents()).slice(6), ['injection 1', 'injection 2']);
    assert.equal(await m.locator('.gci-csel .nav-count').textContent(), '7/8', 'the first new standard shown');
    // 375 px: nothing scrolls sideways, neither the window nor its table; the plot over the
    // table; the names in their column.
    await page.setViewportSize({ width: 375, height: 800 }); await settle(page);
    const narrow = await m.evaluate(M=>{ const sc = M.querySelector('.xrd-std-scroll'), tb = M.querySelector('.gci-cal-table'), r = s => M.querySelector(s).getBoundingClientRect();
      return { sc: sc.scrollWidth - sc.clientWidth, page: document.documentElement.scrollWidth - window.innerWidth, tb: tb.scrollWidth - tb.clientWidth, below: r('.gci-cal-side').top - r('.gci-cal-pair svg.gci-resid').bottom,
        name: M.querySelector('tbody tr .gci-cal-name').clientWidth, right: r('.gci-cal-table').right - window.innerWidth }; });
    assert.ok(narrow.sc <= 0 && narrow.page <= 0 && narrow.tb <= 0 && narrow.right <= 0, `no sideways scroll: ${JSON.stringify(narrow)}`);
    assert.ok(narrow.below > 0 && narrow.name > 90, `the table under the plot, the names shown: ${JSON.stringify(narrow)}`);
    // Closed and opened again: the file waiting let go, nothing said.
    await page.keyboard.press('Escape'); await settle(page);
    await card.locator('.gci-cal').click(); await m.waitFor({ state: 'visible' });
    assert.deepEqual(await said(), []);
    await m.locator('.gci-cal-in').setInputFiles([stdTcd('other_TCD.csv')]); await settle(page);
    assert.match((await said())[0], /other_TCD\.csv: raw chromatograms without their GC table/, 'other.csv no longer waits');
    assert.deepEqual(errors, []); assert.deepEqual(await csp(), []);
  } finally { await close(); }
});

test('after a Stop (v569): standards dropped in the Calibration window are integrated, as files dropped on the module are; the window never says "Integrating" while nothing runs; v578: Stop is Integrate while it runs, the window\'s the card\'s', async ()=>{
  const { page, errors, csp, close } = await env.page();
  try {
    await openModule(page, 'gc');
    await slow(page, 400);
    await load(page, [table('run.csv', tableRows()), tcd('run_TCD.csv', areas())], 1);
    const card = page.locator('#tab-gc .an-card').nth(0), m = page.locator('.gci-cal-modal');
    // Stopped part way (Integrate is Stop while it runs, highlighted): what is done kept, the rest said.
    await running(page);
    assert.deepEqual(await integ(card.locator('.gci-integ')), ['Stop', false, true]);
    await pressAfterTurn(page, card.locator('.gci-integ'));
    const n0 = await fitted(page);
    assert.ok(n0 < N, `stopped part way: ${n0}`);
    assert.equal(await card.locator('.gci-status').getAttribute('data-state'), 'stopped');
    assert.equal(await card.locator('.gci-status').textContent(), `Stopped: ${chroms(N - n0)} not integrated.`);
    assert.deepEqual(await integ(card.locator('.gci-integ')), ['Integrate', false, true]);
    await page.waitForTimeout(600);
    assert.equal(await fitted(page), n0, 'nothing runs');
    // The window opened, standards dropped: integrated, and the card's rest with them.
    await slow(page, 0);
    await card.locator('.gci-cal').click(); await m.waitFor({ state: 'visible' });
    await m.locator('.gci-cal-in').setInputFiles([calTable('std.csv'), stdTcd('std_TCD.csv')]);
    await calDone(page); await integrated(page);
    assert.equal(await fitted(page), N + 6, 'the standards and the card\'s rest integrated');
    assert.equal(await m.locator('.gci-cal-status').textContent(), '6 chromatograms integrated.');
    assert.equal(await card.locator('.gci-status').getAttribute('data-state'), 'done');
    assert.deepEqual(await integ(m.locator('.gci-integ')), ['Integrate', true, false], 'nothing to integrate: quiet');
    // Stopped from the window with standards left: it says so, not "Integrating"; nothing runs;
    // its Integrate, the card's, integrates them.
    await slow(page, 400);
    await m.locator('.gci-cal-in').setInputFiles([calTable('second.csv'), stdTcd('second_TCD.csv')]);
    await running(page, '.gci-cal-modal .gci-cal-status');
    assert.deepEqual(await integ(m.locator('.gci-integ')), ['Stop', false, true]);
    await pressAfterTurn(page, m.locator('.gci-integ'));
    const n1 = await fitted(page);
    assert.ok(n1 < N + 12, `stopped part way: ${n1}`);
    assert.equal(await m.locator('.gci-cal-status').textContent(), `Stopped: ${chroms(N + 12 - n1)} of the standards not integrated.`);
    assert.equal(await card.locator('.gci-status').textContent(), `Stopped: ${chroms(N + 12 - n1)} not integrated.`);
    await page.waitForTimeout(600);
    assert.equal(await fitted(page), n1, 'nothing runs');
    await slow(page, 0);
    await m.locator('.gci-integ').click();
    await page.waitForFunction(()=> document.querySelector('.gci-cal-modal .gci-cal-status').textContent === '12 chromatograms integrated.', null, { timeout: 60000 });
    assert.equal(await fitted(page), N + 12, 'the standards left integrated');
    assert.deepEqual(errors, []); assert.deepEqual(await csp(), []);
  } finally { await close(); }
});

/* v571 (ALERTS-REVIEW.md C17, X07; the review's (iii)): a run that fails (no worker can be
   made here) says why, a compact error in the card's status line (to v570 red text with no
   box) and in the calibration window's (to v570 "Stopped…", as a stop); Windows' title still
   on the plot frame's top. */
test('an integration that fails says why: a compact error in the card\'s status and in the calibration window\'s, not "Stopped" (v571)', async ()=>{
  const { page, errors, csp, close } = await env.page();
  try {
    await openModule(page, 'gc');
    await page.evaluate(()=>{ window.Worker = class { constructor(){ throw new Error('no worker here (test)'); } }; });
    await load(page, [table('run.csv', tableRows()), tcd('run_TCD.csv', areas())], 1);
    await page.waitForFunction(()=> document.querySelector('#tab-gc .gci-status')?.dataset.state === 'failed', null, { timeout: 30000 });
    await settle(page);
    const card = page.locator('#tab-gc .an-card').nth(0), m = page.locator('.gci-cal-modal');
    const said = '✕ The integration failed: no worker here (test).';
    assert.equal(await card.locator('.gci-status .alert.bad.compact').textContent(), said);
    assert.equal(await card.locator('.gci-status .gci-bad').count(), 0, 'no red text with no box');
    const wt = await firstTop(page, '#tab-gc .an-card:nth-child(1)', { frame: 'svg.gci-chrom', head: '.gci-win-head' });
    assert.ok(Math.abs(wt.top - wt.frame) <= 1, `Windows' top on the frame's: ${JSON.stringify(wt)}`);
    // The standards dropped: none integrated, the window says why, not that it was stopped.
    await card.locator('.gci-cal').click(); await m.waitFor({ state: 'visible' });
    await m.locator('.gci-cal-in').setInputFiles([calTable('std.csv'), stdTcd('std_TCD.csv')]);
    await page.waitForFunction(()=> document.querySelectorAll('.gci-cal-modal tbody tr[data-row]').length === 6);
    await page.waitForFunction(()=> !!document.querySelector('.gci-cal-modal .gci-cal-status .alert.bad.compact'), null, { timeout: 30000 });
    await settle(page);
    assert.equal(await m.locator('.gci-cal-status').textContent(), said);
    assert.ok(!/Stopped/.test(await m.locator('.gci-cal-status').textContent()));
    const st = await firstTop(page, '.gci-cal-modal', { frame: '.gci-cal-pair svg.gci-chrom', head: '.gci-cal-side > .param-head' });
    assert.ok(Math.abs(st.top - st.frame) <= 1, `Standards' top on the frame's: ${JSON.stringify(st)}`);
    assert.deepEqual(errors, []); assert.deepEqual(await csp(), []);
  } finally { await close(); }
});

test('a calibration saved by v544–v548 (raw chromatograms alone) opens as it was: its levels and rates, nothing fitted again, its standards named by column, said until its × (kept); its table dropped names them', async ()=>{
  const { page, errors, csp, close } = await env.page();
  try {
    await openModule(page, 'gc');
    await load(page, [table('run.csv', tableRows()), tcd('run_TCD.csv', areas())], 1);
    await integrated(page);
    let card = page.locator('#tab-gc .an-card').nth(0);
    const m = page.locator('.gci-cal-modal');
    await card.locator('.gci-cal').click(); await m.waitFor({ state: 'visible' });
    await m.locator('.gci-cal-in').setInputFiles([calTable('std.csv'), stdTcd('std_TCD.csv')]);
    await calDone(page);
    for (const [i, [h, o]] of STD.entries()) for (const [g, v] of [['h2', h], ['o2', o]]) if (v){ const f = m.locator(`input[data-j="${i}"][data-g="${g}"]`); await f.fill(String(v)); await f.press('Enter'); await settle(page); }
    await m.locator('.xrd-std-x').click(); await settle(page);
    const rates = (await zip(page))['mean_rates.csv'][1];
    const { obj } = await exportProject(page), st = obj.state, c0 = st.cards.find(c=> c.type === 'integ');
    assert.equal(c0.cal.files[0].table.name, 'std.csv', 'v549 keeps the table');
    // As v544–v548 saved it: the calibration's files their raw chromatograms alone.
    const old = { ...st, cards: st.cards.map(c=> c === c0 ? { ...c, cal: { ...c.cal, files: c.cal.files.map(({ table: _t, ...f })=> f) } } : c) };
    const n0 = await fitted(page);
    await importProject(page, projectFile(env, 'v548.datatreat', { ...obj, title: 'Old v548', appVersion: 'v548', state: old }, { sign: true }));
    await openProject(page, 'gc', 'Old v548');
    await integrated(page);
    assert.equal(await fitted(page), n0, 'nothing fitted again');
    const cal = (await moduleState(page, 'gc')).cards.find(c=> c.type === 'integ').cal;
    assert.deepEqual(cal.files.map(f=> [f.name, 'table' in f]), [['std_TCD.csv', false]], 'nothing added');
    assert.deepEqual(cal.files[0].levels, c0.cal.files[0].levels, 'its levels as they were');
    assert.deepEqual((await zip(page))['mean_rates.csv'][1], rates, 'the same rates');
    // The window: its standards by column, their levels in their fields; the table missing said.
    card = page.locator('#tab-gc .an-card').nth(0);
    await card.locator('.gci-cal').click(); await m.waitFor({ state: 'visible' }); await settle(page);
    assert.deepEqual(await m.locator('.gci-cal-levels tbody .gci-cal-name').allTextContents(), STD.map((_, j)=> `column ${j + 1}`));
    assert.deepEqual(await m.locator('.gci-cal-levels tbody input[data-g="h2"]').evaluateAll(xs=> xs.map(x=> x.value)), ['0.05', '0.1', '0.2', '', '', '']);
    assert.equal(await m.locator('.gci-csel .snav-name').textContent(), 'column 1');
    assert.deepEqual(await m.locator('.xrd-std-row .xrd-std-name').allTextContents(), ['std_TCD.csv (no table)']);
    const w = (await m.locator('.gci-cal-warn .alert.warn').innerText()).replace(/\s+/g, ' ');
    assert.match(w, /^⚠ Opened, to check: std_TCD\.csv: saved by an older version without its GC table: its standards are named by column\. Drop the table \(the same name without _TCD\) to name them\.$/);
    assert.match(await m.locator('.gci-cal-status').textContent(), /6 chromatograms integrated/);
    assert.equal(await fitted(page), n0, 'nothing fitted with the window open');
    // Its × (v573): the file marked seen in the card's calibration, no step of the history; kept
    // through undo and redo (a step taken before it, the unit), as the window opens again, and in
    // the project saved and opened again (to v572 the box removed alone, back at the next opening).
    const warned = ()=> m.locator('.gci-cal-warn .alert').count(), unit = ()=> m.locator('.gci-cal-unit-in').inputValue();
    await m.locator('.gci-cal-unit-in').selectOption('ppm'); await settle(page);
    const h1 = await history(page, 'gc');
    await m.locator('.gci-cal-warn .alert-dismiss').click(); await settle(page);
    assert.equal(await warned(), 0, 'dismissed');
    assert.deepEqual(await history(page, 'gc'), h1, 'no step of the history');
    assert.deepEqual((await moduleState(page, 'gc')).cards.find(c=> c.type === 'integ').cal.files[0].seen, ['opened'], 'its file marked in the state');
    await undo(page);
    assert.deepEqual([await unit(), await warned()], ['%mol', 0], 'the unit undone: dismissed still');
    await undo(page, true);
    assert.deepEqual([await unit(), await warned()], ['ppm', 0], 'redone: dismissed still');
    await undo(page);
    await m.locator('.xrd-std-x').click(); await settle(page);
    await card.locator('.gci-cal').click(); await m.waitFor({ state: 'visible' }); await settle(page);
    assert.equal(await warned(), 0, 'the window opened again: dismissed still');
    await m.locator('.xrd-std-x').click(); await settle(page);
    await saveAs(page, 'Old v548 seen');
    await page.locator('#tabBar .ptab.is-on .ptab-x').click(); await settle(page);
    await openProject(page, 'gc', 'Old v548 seen');
    await integrated(page);
    card = page.locator('#tab-gc .an-card').nth(0);
    await card.locator('.gci-cal').click(); await m.waitFor({ state: 'visible' }); await settle(page);
    assert.deepEqual([await unit(), await warned()], ['%mol', 0], 'the project opened again: dismissed still');
    assert.equal(await fitted(page), n0, 'nothing fitted');
    // Its table dropped alone: it names them, one step; nothing else changes, nothing said.
    const s1 = await steps(page);
    await m.locator('.gci-cal-in').setInputFiles([calTable('std.csv')]); await settle(page);
    assert.deepEqual(await m.locator('.gci-cal-levels tbody .gci-cal-name').allTextContents(), STD_NAMES);
    assert.deepEqual(await m.locator('.gci-cal-alerts .alert, .gci-cal-warn .alert').count(), 0);
    assert.equal(await steps(page), s1 + 1);
    const cal2 = (await moduleState(page, 'gc')).cards.find(c=> c.type === 'integ').cal;
    assert.deepEqual([cal2.files[0].table.name, cal2.files[0].levels], ['std.csv', c0.cal.files[0].levels]);
    assert.equal(await fitted(page), n0, 'nothing fitted');
    await m.locator('.xrd-std-x').click(); await settle(page);
    assert.deepEqual((await zip(page))['mean_rates.csv'][1], rates, 'the same rates');
    assert.deepEqual(errors, []); assert.deepEqual(await csp(), []);
  } finally { await close(); }
});

test('no standards: the GC software\'s scale taken over (k, the median of area/table value), said in an info alert; the rates the table\'s', async ()=>{
  const { page, errors, csp, close } = await env.page();
  try {
    await openModule(page, 'gc');
    await load(page, [table('sw.csv', tableRows(1.1)), tcd('sw_TCD.csv', areas())], 1);
    await integrated(page);
    // No alert in the card (v567: the Production Rate card says it, with where its risks are
    // written); the file's k under its Peaks, the units said plainly, no superscript on the values.
    assert.deepEqual(await alerts(page, '#tab-gc .gci-alerts'), []);
    const vbox = page.locator('#tab-gc .an-card .gci-values-box'), from = await vbox.locator('.gci-from').textContent();
    assert.match(from, /^Concentrations from the GC software's scale \(k\): k = [\d.]+ area per %mol \(H2, median of 12 injections\), [\d.]+ \(O2, median of 12 injections\)\.$/, from);
    assert.equal(await vbox.locator('.gci-units').textContent(), 'Conc. and GC table in %mol.');
    assert.ok(!/ᵗ/.test(await vbox.textContent()), 'no superscript t');
    const k = num(/k = ([\d.]+) area/.exec(from)[1]);
    const z = await zip(page), integ = z['integration.csv'];
    const A = column(integ, 'H2 area').map(num), tv = tableRows(1.1).map(r=> r[0]);
    const ratios = A.map((a, i)=> a/tv[i]).sort((x, y)=> x - y), med = (ratios[5] + ratios[6])/2;
    assert.ok(Math.abs(k - med) < 1e-4*med, `k ${k}, by hand ${med}`);
    assert.ok(column(integ, 'H2 source').every(s=> s.startsWith('transfer (k = ')));
    const ra = (await alerts(page, '#tab-gc .gc-src')).join(' ');
    assert.ok(ra.includes('H₂ by the GC software\'s scale (k = ') && ra.includes('The GC software\'s scale (k): its risks are in the instructions of '), ra);
    // Area / k: the table's scale, so the table's rates within the fit's noise.
    const mean = z['mean_rates.csv'][1], want = meanRate(tableRows(1.1).map(r=> r[0]));
    assert.ok(Math.abs(num(mean[1]) - want) < 0.01*want, `H₂ ${mean[1]} for ${want}`);
    assert.deepEqual(errors, []); assert.deepEqual(await csp(), []);
  } finally { await close(); }
});

test('the project: saved and reloaded with its pairs, method, calibration and results, nothing fitted again; a method changed a step, Integrate a step, undone, no step for results', async ()=>{
  const { page, errors, csp, close } = await env.page();
  try {
    await openModule(page, 'gc');
    await load(page, [table('keep.csv', tableRows()), tcd('keep_TCD.csv', areas())], 1);
    await integrated(page);
    const card = page.locator('#tab-gc .an-card').nth(0);
    const n0 = await fitted(page), s0 = await steps(page);
    assert.equal(n0, N);
    // A window's edge typed: a step, pending (v578); Integrate a step, results coming in none of their own.
    const to = card.locator('.gci-method input[data-k="w0:to"]');
    await to.fill('328'); await to.press('Enter'); await settle(page);
    assert.equal(await steps(page), s0 + 1);
    // Default shown (not the engine's windows) on Windows' line, centred on its letters; the
    // title's top still on the chromatogram frame's (CLAUDE.md).
    const wt = await firstTop(page, '#tab-gc .an-card:nth-child(1)', { frame: 'svg.gci-chrom', head: '.gci-win-head' });
    const def = await card.evaluate(c=>{ const b = c.querySelector('.gci-reset'), r = b.getBoundingClientRect(), t = c.querySelector('.gci-win-head > span').getBoundingClientRect(); return { hidden: b.hidden, mid: (r.top + r.bottom)/2 - (t.top + t.bottom)/2, right: c.querySelector('.gci-side').getBoundingClientRect().right - r.right }; });
    assert.ok(!def.hidden && Math.abs(def.mid) <= 1 && Math.abs(def.right) <= 1, `Default on the title's line, at its right: ${JSON.stringify(def)}`);
    assert.ok(Math.abs(wt.top - wt.frame) <= 1, `the title's top on the frame's: ${JSON.stringify(wt)}`);
    assert.equal(await card.locator('.gci-status').getAttribute('data-state'), 'pending');
    assert.equal(await fitted(page), N);
    await pressAfterTurn(page, card.locator('.gci-integ'));
    await integrated(page);
    assert.equal(await fitted(page), 2*N);
    assert.equal(await steps(page), s0 + 2, 'the swap a step, results coming in none');
    // Undone: the first method's results, kept, nothing fitted; the edit pending again, then gone.
    await undo(page);
    assert.equal(await card.locator('.gci-method input[data-k="w0:to"]').inputValue(), '328');
    assert.equal(await card.locator('.gci-status').getAttribute('data-state'), 'pending');
    await undo(page);
    assert.equal(await card.locator('.gci-method input[data-k="w0:to"]').inputValue(), '326');
    await settle(page);
    assert.equal(await fitted(page), 2*N);
    await undo(page, true); await undo(page, true);
    assert.equal(await card.locator('.gci-status').getAttribute('data-state'), 'done');
    // Standards and a level: then saved, the page reloaded.
    await card.locator('.gci-cal').click();
    const m = page.locator('.gci-cal-modal');
    await m.locator('.gci-cal-in').setInputFiles([calTable('std.csv'), stdTcd('std_TCD.csv')]);
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
    assert.deepEqual([after.cards[0].cal.files[0].name, after.cards[0].cal.files[0].table.name], ['std_TCD.csv', 'std.csv'], 'the pair kept, its table too');
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

/* ---- Integrate (v578): windows edited are pending, integrated on demand, applied at once ----
   What the card shows, the cards below it and its calibration window (while open), read from the
   page (`shown`): Peaks, the run overview's fits, the chromatogram's model, the first Production
   Rate card's plot, the window's areas and H₂ line; sampled at every frame while a run goes on
   (`sampling`, `samples`: each with the card's state then). */
async function sampling(page){
  await page.evaluate(()=>{
    const sum = st => st.filter(e=> e.ys).map(e=> e.key + ':' + Array.from(e.ys).reduce((a, b)=> a + (Number.isFinite(b) ? b : 0), 0).toFixed(6)).join('|');
    const plotOf = el => el && el._plot ? el._plot._stored : [];
    window.__shown = ()=>{
      const cards = document.querySelectorAll('#tab-gc .an-card'), card = cards[0], m = document.querySelector('.gci-cal-modal'), open = !!m && m.style.display !== 'none';
      if (!card) return null;
      return [card.querySelector('[id$="Values"]').textContent, sum(plotOf(card.querySelector('svg.gci-over'))), sum(plotOf(card.querySelector('svg.gci-chrom')).filter(e=> /^model /.test(e.key || ''))),
        cards[1] ? sum(plotOf(cards[1].querySelector('svg.plot'))) : '', open ? [...m.querySelectorAll('.gci-cal-levels td.gci-cal-a')].map(td=> td.textContent).join() : '',
        open ? (m.querySelector('.gci-cal-gas[data-g="h2"] .gci-cal-line') || {}).textContent || '' : ''];
    };
    window.__samples = []; window.__sampling = true;
    const tick = ()=>{ if (!window.__sampling) return; const st = document.querySelector('#tab-gc .gci-status'); window.__samples.push({ st: st && st.dataset.state, v: window.__shown() }); requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
}
const shown = page => page.evaluate(()=> window.__shown());
const samples = page => page.evaluate(()=>{ window.__sampling = false; return window.__samples; });
// Every sample the state before or the state after, whole, never parts of each; some while it ran.
function oneSwap(all, was, now, what){
  const same = (a, b)=> JSON.stringify(a) === JSON.stringify(b);
  assert.ok(all.some(x=> x.st === 'running'), `${what}: sampled while it ran`);
  all.forEach((x, i)=> assert.ok(same(x.v, was) || same(x.v, now), `${what}: sample ${i} (${x.st}) neither before nor after: ${JSON.stringify(x.v).slice(0, 400)}`));
  const at = all.findIndex(x=> same(x.v, now));
  assert.ok(at > 0 && all.slice(at).every(x=> same(x.v, now)), `${what}: before, then after, once`);
}
const edge = async (card, k, v)=>{ const f = card.locator(`.gci-method input[data-k="${k}"]`); await f.fill(String(v)); await f.press('Enter'); };
const AB = ()=> [table('a.csv', tableRows()), tcd('a_TCD.csv', areas()), table('bb.csv', tableRows(1.05)), tcd('bb_TCD.csv', areas())];
const integCard = async page => (await moduleState(page, 'gc')).cards.find(c=> c.type === 'integ');
const applied = (keys, to)=> keys.every(k=> k.includes(`[["H2O2",268,${to}],`));

test('a window edited (v578): not integrated, pending, said in grey, Integrate highlighted; the results, plots, rates and CSVs the windows applied; a file added integrated with them', async ()=>{
  const { page, errors, csp, close } = await env.page();
  try {
    await openModule(page, 'gc');
    await load(page, AB(), 2);
    await integrated(page);
    const card = page.locator('#tab-gc .an-card').nth(0), btn = card.locator('.gci-integ');
    assert.equal(await btn.count(), 1, 'an Integrate button');
    assert.deepEqual(await integ(btn), ['Integrate', true, false], 'nothing pending: quiet, disabled');
    await sampling(page);
    const n0 = await fitted(page), s0 = await steps(page), was = await shown(page), z0 = await zip(page);
    await edge(card, 'w0:to', 328);
    await page.waitForTimeout(1600);
    await settle(page);
    assert.equal(await fitted(page), n0, 'nothing integrated (to v577 integrated again a second after)');
    assert.deepEqual(await shown(page), was, 'the results, plots and rates as they were');
    assert.equal(await steps(page), s0 + 1, 'the edit a step');
    const c0 = await integCard(page);
    assert.deepEqual([c0.method.windows[0].to, c0.edit.windows[0].to], [326, 328], 'the method applied, the windows as edited');
    assert.equal(await card.locator('.gci-status').getAttribute('data-state'), 'pending');
    const line = await card.locator('.gci-status').textContent();
    assert.equal(line, 'The results shown come from H₂-O₂ fit 268–326 s, not from these windows.');
    assert.ok(!/[!—]|v\d{3}/.test(line), 'facts alone (ALERTS-REVIEW.md R4)');
    assert.equal(await card.locator('.gci-status .alert').count(), 0, 'grey, no box');
    assert.deepEqual(await integ(btn), ['Integrate', false, true], 'highlighted, enabled');
    assert.equal(await card.locator('.gci-notice .alert').count(), 0, 'no notice over the chromatogram');
    assert.ok(!/previous method|Method changed/.test(await card.innerText()));
    // The Windows: the edit, its name and peaks with their subscripts, its line on the chromatogram.
    assert.equal(await card.locator('.gci-method input[data-k="w0:to"]').inputValue(), '328');
    assert.deepEqual([await card.locator('.gci-win-name').textContent(), await card.locator('.gci-win-peaks').textContent(), await card.locator('.gci-method input[data-k="w0:from"]').getAttribute('aria-label')],
      ['H₂-O₂ fit', 'H₂ 287.3 · O₂ 302.3 · S310 310.2', 'H₂-O₂ window from (s)']);
    assert.deepEqual(await card.locator('svg.gci-chrom').evaluate(s=> s._plot._stored.filter(e=> e.type === 'vline').map(e=> e.xv)), [268, 328]);
    // The CSVs: the results shown with the windows applied, never the edited ones.
    const z1 = await zip(page);
    for (const f of ['integration.csv', 'chromatogram.csv', 'gc_raw.csv', 'mean_rates.csv']) assert.deepEqual(z1[f], z0[f], f);
    for (const f of ['integration.csv', 'chromatogram.csv']){
      assert.deepEqual(z1[f][0].slice(-2), ['H2-O2 window from (s)', 'H2-O2 window to (s)'], f);
      assert.ok(z1[f].slice(1).every(r=> r.slice(-2).join() === '268.00,326.00'), `${f}: the windows applied`);
    }
    // Back to the windows applied: nothing pending, quiet; a step.
    await edge(card, 'w0:to', 326); await settle(page);
    assert.deepEqual([await card.locator('.gci-status').getAttribute('data-state'), await card.locator('.gci-status').isVisible(), await integ(btn), await steps(page)], ['done', false, ['Integrate', true, false], s0 + 2]);
    assert.ok(!('edit' in (await integCard(page))), 'none in the state');
    // A file added with the windows edited: integrated with those applied, the card's results one method's.
    await edge(card, 'w0:to', 328); await settle(page);
    await load(page, [table('ccc.csv', tableRows()), tcd('ccc_TCD.csv', areas())], 3);
    await until(async ()=> (await fitted(page)) === n0 + N, { what: 'the file added integrated' });
    await settle(page);
    assert.equal(await card.locator('.gci-status').getAttribute('data-state'), 'pending', 'still pending');
    const keys = Object.keys((await moduleState(page, 'gc')).integ);
    assert.ok(keys.length === 3 && applied(keys, 326), 'every result the windows applied');
    await card.locator('.gci-fsel .snav-pick').click(); await page.locator('.snav-menu [data-i="2"]').click(); await settle(page);
    assert.equal(await card.locator('table.gci-values tbody tr').count(), 2, 'its values drawn');
    assert.equal((await zip(page))['integration.csv'].filter(r=> r[0] === 'ccc_TCD.csv' && r.slice(-2).join() === '268.00,326.00').length, N);
    assert.deepEqual(errors, []); assert.deepEqual(await csp(), []);
  } finally { await close(); }
});

test('Integrate (v578): every file and standard with the windows edited, the chromatogram in view first, its progress beside it; applied at once, no state between, one step; undone and redone with nothing fitted', async ()=>{
  const { page, errors, csp, close } = await env.page();
  try {
    await openModule(page, 'gc');
    await load(page, AB(), 2);
    await integrated(page);
    const card = page.locator('#tab-gc .an-card').nth(0), btn = card.locator('.gci-integ'), m = page.locator('.gci-cal-modal');
    assert.equal(await btn.count(), 1, 'an Integrate button');
    // Standards and their H₂ levels: the calibration takes part in the swap.
    await card.locator('.gci-cal').click(); await m.waitFor({ state: 'visible' });
    await m.locator('.gci-cal-in').setInputFiles([calTable('std.csv'), stdTcd('std_TCD.csv')]);
    await calDone(page);
    for (const [i, [h]] of STD.entries()) if (h){ const f = m.locator(`input[data-j="${i}"][data-g="h2"]`); await f.fill(String(h)); await f.press('Enter'); await settle(page); }
    await m.locator('.xrd-std-x').click(); await settle(page);
    await edge(card, 'w0:to', 328); await settle(page);
    // The chromatogram in view: the second file's 5th.
    await card.locator('.gci-fnext').click();
    for (let i = 0; i < 4; i++) await card.locator('.gci-knext').click();
    await settle(page);
    assert.equal(await idxOf(card, 'Inj'), '5/12');
    const inView = await card.locator('svg.gci-chrom').evaluate(s=> Array.from(s._plot._stored.find(e=> e.key === 'raw').ys.slice(0, 4)));
    await sampling(page);
    const n0 = await fitted(page), s0 = await steps(page), was = await shown(page), z0 = await zip(page);
    await slow(page, 60);
    await pressAfterTurn(page, btn);
    await running(page);
    // Its progress where the Rietveld card's is: its words, its bar (.rv-prog), the button turned into Stop.
    assert.match(await card.locator('.gci-status').textContent(), /^Integrating… \d+ \/ 30 chromatograms · (a|bb|std)_TCD\.csv$/);
    assert.deepEqual(await integ(btn), ['Stop', false, true]);
    assert.ok(await card.locator('.gci-side > .rv-prog').isVisible(), 'its bar');
    const wt = await firstTop(page, '#tab-gc .an-card:nth-child(1)', { frame: 'svg.gci-chrom', head: '.gci-win-head' });
    assert.ok(Math.abs(wt.top - wt.frame) <= 1, `Windows' top on the frame's while it runs: ${JSON.stringify(wt)}`);
    await integrated(page);
    const all = await samples(page), now = await shown(page);
    assert.equal(await fitted(page), n0 + 2*N + 6, 'every file and standard');
    assert.deepEqual((await page.evaluate(()=> window.__posts))[0], inView, 'the chromatogram in view first');
    assert.ok(now[0] !== was[0] && now[1] !== was[1] && now[2] !== was[2], 'Peaks, the overview and the model changed');
    oneSwap(all, was, now, 'Integrate');
    assert.equal(await steps(page), s0 + 1, 'one step');
    const c1 = await integCard(page);
    assert.deepEqual([c1.method.windows[0].to, 'edit' in c1], [328, false]);
    assert.ok(applied(Object.keys((await moduleState(page, 'gc')).integ), 328), 'the results saved the windows applied');
    assert.deepEqual([await card.locator('.gci-status').textContent(), await integ(btn)], ['', ['Integrate', true, false]]);
    const z1 = await zip(page);
    assert.ok(z1['integration.csv'].slice(1).every(r=> r.slice(-2).join() === '268.00,328.00'));
    assert.notDeepEqual(z1['integration.csv'], z0['integration.csv']);
    // Undone: the results before, the edit pending again; redone: those after; nothing fitted.
    await undo(page);
    assert.deepEqual(await shown(page), was, 'undone: the results before');
    assert.deepEqual([await card.locator('.gci-status').getAttribute('data-state'), await card.locator('.gci-method input[data-k="w0:to"]').inputValue(), await integ(btn)], ['pending', '328', ['Integrate', false, true]]);
    assert.deepEqual((await zip(page))['integration.csv'], z0['integration.csv']);
    await undo(page, true);
    assert.deepEqual(await shown(page), now, 'redone: the results after');
    assert.equal(await card.locator('.gci-status').getAttribute('data-state'), 'done');
    await page.waitForTimeout(400);
    assert.equal(await fitted(page), n0 + 2*N + 6, 'nothing fitted by undo or redo');
    // Integrate again after an undo: the results held, applied at once, nothing fitted.
    await undo(page);
    await pressAfterTurn(page, btn);
    assert.deepEqual([await shown(page), await fitted(page), await steps(page)], [now, n0 + 2*N + 6, s0 + 1]);
    assert.deepEqual(errors, []); assert.deepEqual(await csp(), []);
  } finally { await close(); }
});

test('Stop (v578): Integrate stopped part way keeps everything as it was, its results not applied, no step; its words say so; Integrate after it takes up what it did', async ()=>{
  const { page, errors, csp, close } = await env.page();
  try {
    await openModule(page, 'gc');
    await load(page, AB(), 2);
    await integrated(page);
    const card = page.locator('#tab-gc .an-card').nth(0), btn = card.locator('.gci-integ');
    assert.equal(await btn.count(), 1, 'an Integrate button');
    await edge(card, 'w0:to', 328); await settle(page);
    await sampling(page);
    const n0 = await fitted(page), h0 = await history(page, 'gc'), was = await shown(page), z0 = await zip(page);
    await slow(page, 300);
    await pressAfterTurn(page, btn);
    await running(page);
    // CLAUDE.md, the side's order: Windows' top on the frame's; Peaks, the words, the bar, the button, Calibration….
    const lay = await card.evaluate(c=>{ const r = s => c.querySelector(s).getBoundingClientRect(), side = r('.gci-side');
      const ys = ['.gci-values-box', '.gci-side > .rv-status', '.gci-side > .rv-prog', '.gci-side > .rv-btns', '.gci-side > .gci-cal'].map(s=> [r(s).top, r(s).bottom]);
      return { order: ys.every((y, i)=> !i || y[0] >= ys[i - 1][1] - 0.5), wide: r('.gci-integ').width - side.width, h: r('.gci-integ').height }; });
    assert.ok(lay.order && Math.abs(lay.wide) < 1 && Math.abs(lay.h - 33) < 1, JSON.stringify(lay));
    const wt = await firstTop(page, '#tab-gc .an-card:nth-child(1)', { frame: 'svg.gci-chrom', head: '.gci-win-head' });
    assert.ok(Math.abs(wt.top - wt.frame) <= 1, `Windows' top on the frame's: ${JSON.stringify(wt)}`);
    await until(async ()=> (await fitted(page)) > n0, { what: 'a chromatogram done' });
    await pressAfterTurn(page, btn);
    assert.deepEqual(await shown(page), was, 'everything as it was');
    assert.ok((await samples(page)).every(x=> JSON.stringify(x.v) === JSON.stringify(was)), 'all along');
    const n1 = await fitted(page);
    assert.ok(n1 > n0 && n1 < n0 + 2*N, `stopped part way: ${n1 - n0}`);
    assert.deepEqual(await history(page, 'gc'), h0, 'no step, the history as it was');
    const c0 = await integCard(page);
    assert.deepEqual([c0.method.windows[0].to, c0.edit.windows[0].to], [326, 328]);
    assert.ok(applied(Object.keys((await moduleState(page, 'gc')).integ), 326), 'none of its results in the state');
    const z1 = await zip(page);
    for (const f of ['integration.csv', 'chromatogram.csv', 'mean_rates.csv']) assert.deepEqual(z1[f], z0[f], f);
    assert.deepEqual([await card.locator('.gci-status').getAttribute('data-state'), await card.locator('.gci-status').textContent(), await integ(btn), await card.locator('.gci-side > .rv-prog').isVisible()],
      ['stopped', 'Stopped: the results shown come from H₂-O₂ fit 268–326 s, not from these windows.', ['Integrate', false, true], false]);
    await page.waitForTimeout(700);
    assert.equal(await fitted(page), n1, 'nothing runs');
    // Integrate again: what the stopped run did taken up, the rest integrated, applied.
    await slow(page, 0);
    await btn.click();
    await integrated(page);
    assert.equal(await fitted(page), n0 + 2*N, 'every chromatogram once');
    assert.equal((await integCard(page)).method.windows[0].to, 328);
    assert.notDeepEqual(await shown(page), was);
    assert.deepEqual(errors, []); assert.deepEqual(await csp(), []);
  } finally { await close(); }
});

/* v581: a Stop holds its own card's files alone (to v580 every Integration card's of the tab):
   two cards integrating the same files, the first stopped, the second's run on, every
   chromatogram integrated once. v582: the first stays stopped to the end and applies nothing,
   its results those it had at its Stop (its words, integration.csv and the Production Rate card
   under it the same), none of what the second's run brought (to v581 shown as they came, the
   card done at its end); Integrate on it then takes them, nothing fitted again. */
const cardCsv = async (page, name)=> readZip((await download(page, ()=> page.click('.proj-csv'))).buf).find(e=> e.name.endsWith(` - ${name}`)).data.toString('utf8');
test('Stop (v581, v582): a card\'s Stop holds its own files alone, applying nothing; another Integration card\'s run on', async ()=>{
  const { page, errors, csp, close } = await env.page();
  try {
    await openModule(page, 'gc');
    await slow(page, 250);
    await load(page, AB(), 2);
    await page.click('#gcAddAn'); await page.click('.an-menu:not([hidden]) [data-kind="integ"]'); await settle(page);
    const cs = page.locator('#tab-gc .an-card'), c1 = cs.nth(0), c2 = cs.nth(2);
    assert.equal(await c2.locator('.gci-body').count(), 1, 'a second Integration card');
    await running(page);
    await until(async ()=> (await fitted(page)) > 0, { what: 'a chromatogram done' });
    await pressAfterTurn(page, c1.locator('.gci-integ'));
    const n1 = await fitted(page);
    assert.ok(n1 < 2*N, `stopped part way: ${n1}`);
    assert.deepEqual([await c1.locator('.gci-status').getAttribute('data-state'), await c2.locator('.gci-status').getAttribute('data-state')], ['stopped', 'running'], 'the first stopped, the second running');
    const said = await c1.locator('.gci-status').textContent(), csv1 = await cardCsv(page, 'integration.csv'), rate = await cs.nth(1).locator('.gc-src').textContent();
    assert.match(said, /^Stopped: \d+ chromatograms? not integrated\.$/);
    assert.ok(rate.includes(': its integration was stopped before its end'), 'the card under it says so at once: ' + rate);
    await until(async ()=> (await fitted(page)) === 2*N, { timeout: 60000, what: 'the second card\'s files integrated' });
    await until(async ()=> (await c2.locator('.gci-status').getAttribute('data-state')) === 'done', { what: 'the second card done' });
    await settle(page);
    assert.equal(await fitted(page), 2*N, 'every chromatogram once');
    assert.deepEqual([await c1.locator('.gci-status').getAttribute('data-state'), await c2.locator('.gci-status').getAttribute('data-state'), await c1.locator('.gci-status').textContent()],
      ['stopped', 'done', said], 'the first still stopped, saying as much, the second done');
    assert.deepEqual([await cardCsv(page, 'integration.csv'), await cs.nth(1).locator('.gc-src').textContent()], [csv1, rate], 'its results those of its Stop, the card under it the same');
    // Integrate on it: the second's results taken, nothing fitted again.
    await c1.locator('.gci-integ').click(); await settle(page); await integrated(page);
    assert.deepEqual([await fitted(page), await c1.locator('.gci-status').getAttribute('data-state')], [2*N, 'done']);
    assert.notEqual(await cardCsv(page, 'integration.csv'), csv1, 'its results now the run\'s');
    assert.deepEqual(errors, []); assert.deepEqual(await csp(), []);
  } finally { await close(); }
});

/* v581: windows edited on a card with no result (here its raw chromatograms taken out of the
   list, the table kept) applied as they are, nothing pending; the raw chromatograms dropped
   again integrated with them (to v580 pending, the files loaded after them integrated with the
   windows before). */
test('a window edited on a card with no result (v581): applied as it is, the files loaded after it integrated with it', async ()=>{
  const { page, errors, csp, close } = await env.page();
  try {
    await openModule(page, 'gc');
    await load(page, [table('a.csv', tableRows()), tcd('a_TCD.csv', areas())], 1);
    await integrated(page);
    const card = page.locator('#tab-gc .an-card').nth(0), n0 = await fitted(page);
    await dragFile(page, 'a_TCD.csv', null);
    await page.locator('#gcFileTableWrap tr.file-row').nth(1).locator('.row-del').click(); await settle(page);
    assert.deepEqual((await rowsOf(page)).map(r=> r.files), [['a.csv']], 'its raw chromatograms out of the list');
    const s0 = await steps(page);
    await edge(card, 'w0:to', 328); await settle(page);
    const c = await integCard(page);
    assert.deepEqual([c.method.windows[0].to, 'edit' in c, await steps(page)], [328, false, s0 + 1], 'applied, a step, nothing pending');
    assert.notEqual(await card.locator('.gci-status').getAttribute('data-state'), 'pending');
    await load(page, [tcd('a_TCD.csv', areas())], 1);
    await integrated(page);
    assert.equal(await fitted(page), n0 + N, 'integrated again, with the windows edited');
    const keys = Object.keys((await moduleState(page, 'gc')).integ);
    assert.ok(keys.length === 1 && applied(keys, 328), 'its results the windows edited: ' + keys.map(k=> k.slice(-60)).join());
    assert.deepEqual(errors, []); assert.deepEqual(await csp(), []);
  } finally { await close(); }
});

test('the project (v578): saved with its windows pending, opened again as it was, nothing fitted, Integrate highlighted; one saved while v576 showed the previous method\'s results opens as any project, its windows the method, and integrates', async ()=>{
  const { page, errors, csp, close } = await env.page();
  try {
    await openModule(page, 'gc');
    await load(page, AB(), 2);
    await integrated(page);
    let card = page.locator('#tab-gc .an-card').nth(0);
    assert.equal(await card.locator('.gci-integ').count(), 1, 'an Integrate button');
    await edge(card, 'w0:to', 328); await settle(page);
    await sampling(page);
    const was = await shown(page);
    await saveAs(page, 'pending');
    await page.locator('#tabBar .ptab.is-on .ptab-x').click(); await settle(page);
    const n0 = await fitted(page);
    await openProject(page, 'gc', 'pending');
    await page.waitForTimeout(600); await settle(page);
    card = page.locator('#tab-gc .an-card').nth(0);
    await sampling(page);
    assert.deepEqual(await shown(page), was, 'the results as saved');
    assert.equal(await fitted(page), n0, 'nothing fitted');
    assert.deepEqual([await card.locator('.gci-status').getAttribute('data-state'), await card.locator('.gci-method input[data-k="w0:to"]').inputValue(), await integ(card.locator('.gci-integ'))], ['pending', '328', ['Integrate', false, true]]);
    await card.locator('.gci-integ').click();
    await integrated(page);
    assert.equal(await fitted(page), n0 + 2*N);
    /* As v576 saved a project while it showed the previous method's results: its windows the
       method (328), the results of the files done with them (a's), none of the others' (bb's,
       shown then with the method before's, which it never saved). It opens as any project
       (CLAUDE.md, backward compatibility: no path of its own): its windows the method, nothing
       pending, nothing said, integrated on loading with the current engine. */
    const { obj } = await exportProject(page), st = obj.state;
    const aKey = await page.evaluate(async ()=>{ const u = await import('./utils.js'), s = u.getModuleState('gc'); return u.bytesKey(s.files.find(f=> f.name === 'a.csv').mate.rawBytes) + '|'; });
    const aOnly = Object.fromEntries(Object.entries(st.integ).filter(([k])=> k.startsWith(aKey)));
    assert.equal(Object.keys(aOnly).length, 1);
    const old = { ...st, cards: st.cards.map(c=> c.type === 'integ' ? { ...c, method: { windows: [{ key: 'H2O2', from: 268, to: 328 }] } } : c), integ: aOnly };
    await importProject(page, projectFile(env, 'v576.datatreat', { ...obj, title: 'Old v576', appVersion: 'v576', state: old }, { sign: true }));
    const n1 = await fitted(page);
    await openProject(page, 'gc', 'Old v576');
    await integrated(page);
    card = page.locator('#tab-gc .an-card').nth(0);
    assert.ok(await fitted(page) >= n1 + N, 'integrated on loading');
    const c = await integCard(page);
    assert.deepEqual([c.method.windows[0].to, 'edit' in c], [328, false], 'its windows the method');
    assert.deepEqual([await card.locator('.gci-status').getAttribute('data-state'), await integ(card.locator('.gci-integ')), await card.locator('.gci-notice .alert').count()], ['done', ['Integrate', true, false], 0]);
    assert.ok(applied(Object.keys((await moduleState(page, 'gc')).integ), 328));
    assert.deepEqual(errors, []); assert.deepEqual(await csp(), []);
  } finally { await close(); }
});

/* The calibration window (v578): with no standards, the drop zone alone (and what a drop said),
   nothing drawn; with them, its Integrate the card's (one method, one run, one swap). */
const visibleIn = m => m.evaluate(M=> [...M.querySelectorAll('.xrd-std-scroll > *')].filter(e=> e.offsetHeight > 0).map(e=> e.className));
const stdCsv = async m => parseCsv((await download(m.page(), ()=> m.locator('.gci-cal-pair .plot-csv-btn').click())).buf.toString('utf8').replace(/^﻿/, ''), ';');
test('the calibration window (v578): with no standards the drop zone alone; its Integrate the card\'s: an edit not integrated, its areas, line and CSV the windows applied; the standard in view first, one swap with the card, one step; Stop; undo and redo', async ()=>{
  const { page, errors, csp, close } = await env.page();
  try {
    await openModule(page, 'gc');
    await load(page, [table('a.csv', tableRows()), tcd('a_TCD.csv', areas())], 1);
    await integrated(page);
    const card = page.locator('#tab-gc .an-card').nth(0), m = page.locator('.gci-cal-modal'), wbtn = m.locator('.gci-integ');
    await card.locator('.gci-cal').click(); await m.waitFor({ state: 'visible' }); await settle(page);
    // No standards: the drop zone alone; no table, plot, line, button or words, nothing drawn.
    assert.deepEqual(await visibleIn(m), ['dropzone xrd-std-dz gci-cal-dz'], 'the drop zone alone');
    assert.deepEqual(await m.evaluate(M=> [M.querySelectorAll('.gci-cal-fits *').length, M.querySelector('svg.gci-chrom').childElementCount, [...M.querySelectorAll('svg.plot, table, button.gci-integ, .gci-cal-status')].filter(e=> e.getClientRects().length).length]), [0, 0, 0]);
    // What a drop said: shown, and nothing else.
    await m.locator('.gci-cal-in').setInputFiles([stdTcd('std_TCD.csv')]); await settle(page);
    assert.deepEqual(await visibleIn(m), ['dropzone xrd-std-dz gci-cal-dz', 'xrd-std-alerts gci-cal-alerts']);
    await m.locator('.gci-cal-in').setInputFiles([calTable('std.csv')]);
    await calDone(page); await settle(page);
    assert.deepEqual(await visibleIn(m), ['dropzone xrd-std-dz gci-cal-dz', 'gci-cal-files', 'gci-cal-unit', 'pside gci-cal-pside', 'row gci-cal-fits']);
    for (const [i, [h, o]] of STD.entries()) for (const [g, v] of [['h2', h], ['o2', o]]) if (v){ const f = m.locator(`input[data-j="${i}"][data-g="${g}"]`); await f.fill(String(v)); await f.press('Enter'); await settle(page); }
    assert.deepEqual([await m.locator('.gci-cal-status').textContent(), await integ(wbtn)], ['6 chromatograms integrated.', ['Integrate', true, false]]);
    await sampling(page);
    const n0 = await fitted(page), was = await shown(page), c0 = await stdCsv(m);
    assert.ok(was[4] && was[5].startsWith('slope'), 'its areas and line read');
    // The card's windows edited: nothing integrated; the window says so, its Integrate highlighted;
    // its areas, its line and its standard's CSV the windows applied.
    await m.locator('.xrd-std-x').click(); await settle(page);
    await edge(card, 'w0:to', 328); await page.waitForTimeout(1500); await settle(page);
    await card.locator('.gci-cal').click(); await m.waitFor({ state: 'visible' }); await settle(page);
    assert.equal(await fitted(page), n0, 'nothing integrated');
    assert.deepEqual(await shown(page), was, 'its areas, line and the card as they were');
    assert.deepEqual([await m.locator('.gci-cal-status').textContent(), await integ(wbtn)], ['The results shown come from H₂-O₂ fit 268–326 s, not from these windows.', ['Integrate', false, true]]);
    const c1 = await stdCsv(m);
    assert.deepEqual(c1, c0, 'its CSV as it was');
    assert.ok(c1[0].slice(-2).join() === 'H2-O2 window from (s),H2-O2 window to (s)' && c1.slice(1).every(r=> r.slice(-2).join() === '268.00,326.00'), 'the windows applied');
    // Integrate here: the standard in view first; the window and the card at once, one step.
    await m.locator('.gci-cal-levels tbody tr').nth(3).locator('td').first().click(); await settle(page);
    const inView = await m.locator('svg.gci-chrom').evaluate(s=> Array.from(s._plot._stored.find(e=> e.key === 'raw').ys.slice(0, 4)));
    await sampling(page);
    const s0 = await steps(page);
    await slow(page, 60);
    await pressAfterTurn(page, wbtn);
    await running(page, '.gci-cal-modal .gci-cal-status');
    assert.match(await m.locator('.gci-cal-status').textContent(), /^Integrating… \d+ \/ 18 chromatograms · (a|std)_TCD\.csv$/);
    assert.deepEqual(await integ(wbtn), ['Stop', false, true]);
    assert.deepEqual(await integ(card.locator('.gci-integ')), ['Stop', false, true], 'the card\'s the same run');
    assert.ok(await m.locator('.gci-cal-side > .rv-prog').isVisible(), 'its bar');
    const st = await firstTop(page, '.gci-cal-modal', { frame: '.gci-cal-pair svg.gci-chrom', head: '.gci-cal-side > .param-head' });
    assert.ok(Math.abs(st.top - st.frame) <= 1, `Standards' top on the frame's while it runs: ${JSON.stringify(st)}`);
    await page.waitForFunction(()=> document.querySelector('.gci-cal-modal .gci-cal-status').textContent === '6 chromatograms integrated.', null, { timeout: 60000 });
    await integrated(page);
    const all = await samples(page), now = await shown(page);
    assert.deepEqual((await page.evaluate(()=> window.__posts))[0], inView, 'the standard in view first');
    assert.equal(await fitted(page), n0 + N + 6);
    assert.ok(now[4] !== was[4] && now[5] !== was[5] && now[0] !== was[0], 'its areas, its line and the card changed');
    oneSwap(all, was, now, 'Integrate in the window');
    assert.equal(await steps(page), s0 + 1, 'one step');
    assert.ok((await stdCsv(m)).slice(1).every(r=> r.slice(-2).join() === '268.00,328.00'));
    // Undone and redone with the window open: its areas and line before, the edit pending; after.
    await undo(page);
    assert.deepEqual([await shown(page), await m.locator('.gci-cal-status').textContent()], [was, 'The results shown come from H₂-O₂ fit 268–326 s, not from these windows.']);
    await undo(page, true);
    assert.deepEqual(await shown(page), now);
    assert.equal(await fitted(page), n0 + N + 6, 'nothing fitted');
    // Stopped from the window: everything as it was, no step, said.
    await undo(page);
    const h0 = await history(page, 'gc');
    await sampling(page);
    await slow(page, 300);
    await m.locator('.gci-cal-levels tbody tr').nth(0).locator('td').first().click(); await settle(page);
    const was2 = await shown(page);
    // (its results held from the run undone: the windows tried here are others)
    await m.locator('.xrd-std-x').click(); await settle(page);
    await edge(card, 'w0:to', 330); await settle(page);
    await card.locator('.gci-cal').click(); await m.waitFor({ state: 'visible' }); await settle(page);
    const h1 = await history(page, 'gc');
    assert.equal(h1.index, h0.index + 1);
    await pressAfterTurn(page, wbtn);
    await running(page, '.gci-cal-modal .gci-cal-status');
    await pressAfterTurn(page, wbtn);
    assert.deepEqual(await shown(page), was2, 'everything as it was');
    assert.deepEqual(await history(page, 'gc'), h1, 'no step');
    assert.deepEqual([await m.locator('.gci-cal-status').textContent(), await integ(wbtn), await m.locator('.gci-cal-side > .rv-prog').isVisible()],
      ['Stopped: the results shown come from H₂-O₂ fit 268–326 s, not from these windows.', ['Integrate', false, true], false]);
    // Its standards removed: the drop zone alone again.
    await slow(page, 0);
    await m.locator('[data-cal-del="0"]').click(); await settle(page);
    assert.deepEqual(await visibleIn(m), ['dropzone xrd-std-dz gci-cal-dz']);
    assert.deepEqual(errors, []); assert.deepEqual(await csp(), []);
  } finally { await close(); }
});

/* Speed (v578): Integrate on 36 chromatograms (three pairs of 12), from the press to the swap
   drawn: no task of the page's thread over 100 ms (PerformanceObserver, longtask: Chromium's
   tasks over 50 ms; alone none was, the swap's script about 30 ms); the selectors answer while
   it runs. A machine busy with something else can stretch a task now and then (once 165 ms in
   a full run beside another suite): a run with one over 100 ms is run again, other windows, and
   the better of the two must be under it, neither over 250. */
test('Integrate on 36 chromatograms (v578): no task of the page\'s thread over 100 ms from the press to the swap drawn; the selector answers while it runs', async ()=>{
  const { page, errors, csp, close } = await env.page();
  try {
    await openModule(page, 'gc');
    await load(page, [...AB(), table('ccc.csv', tableRows()), tcd('ccc_TCD.csv', areas())], 3);
    await integrated(page);
    const card = page.locator('#tab-gc .an-card').nth(0), btn = card.locator('.gci-integ');
    assert.equal(await btn.count(), 1, 'an Integrate button');
    const once = async to =>{
      await edge(card, 'w0:to', to); await settle(page);
      await page.evaluate(()=>{ window.__long = []; new PerformanceObserver(l=> l.getEntries().forEach(e=> window.__long.push(Math.round(e.duration)))).observe({ type: 'longtask' }); });
      await pressAfterTurn(page, btn);
      await running(page);
      const k0 = await idxOf(card, 'Inj');
      await card.locator('.gci-knext').click(); await settle(page);
      assert.notEqual(await idxOf(card, 'Inj'), k0, 'the selector answers while it runs');
      await integrated(page);
      await settle(page);
      assert.equal((await integCard(page)).method.windows[0].to, to, 'applied');
      return page.evaluate(()=> window.__long);
    };
    const runs = [await once(328)];
    if (Math.max(0, ...runs[0]) > 100) runs.push(await once(330));
    const worst = runs.map(l=> Math.max(0, ...l));
    assert.ok(Math.min(...worst) <= 100 && Math.max(...worst) <= 250, `the page's thread's long tasks (ms), each run: ${JSON.stringify(runs)}`);
    assert.deepEqual(errors, []); assert.deepEqual(await csp(), []);
  } finally { await close(); }
});
