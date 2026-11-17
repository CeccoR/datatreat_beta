/* The Custom module (v527, v529, v531; named Figure to v530): three CSV files read (',' with '.' decimals and a header
   with units; ';' with ',' decimals and none; a line of series' titles over the header, which
   sets the first roles and the names), the Data card as an analysis card (the file's arrows,
   its number and name, a view and no step; the head on the left, the series "Series N (Cols
   x,y)" with their names and the roles' box on the right, from the head's top), the roles and
   their rules (several x, an error of y set where its y has one already turning that one into
   a y, the roles of the file shown given to every file with a warning for the file with fewer
   columns), the series' names (the title's, the header's, else "Series M", typed over); the +
   adding an XY, a bar and a box card, the series picked in the Add series window (by file, a
   file's box ticking all its series and a square when some are; Cancel nothing), each
   plot's normalisation (none, local, global) and each series' scale and offset, no crop and
   no swatch, the list from the plot's top; the file list's colours hidden, their place kept;
   the composer of a card opened and its figure kept with the card; the project saved and
   opened again; a tab asleep and woken as it was; a file removed taking its series out of
   the plots. A v528 project, its series normalised each and cropped, opening with the plot's
   normalisation local where all were, else none, and no crop.
   v531: the module named Custom where it shows; the Data card's table whole (every row), in a
   box of a Plot card's chart's size scrolling both ways, its head (the series' names over
   their columns, the roles, the header) staying at its top; the roles' box on the file's
   line, at the table's right; the lists of series in scrolling boxes, their heads and the
   normalisation above them, + Add series under the Plot card's, its bottom on the chart's, the
   list ending just above it and the Data card's at the table's foot; a series' scale and
   offset beside its name; the parameters' three fifths and two fifths.
   v534: the trace list's colours back (a swatch a series, the palette), the plots' colours
   theirs; the Data card's table across the card, as tall as a Plot card's chart, with no
   list of series beside it, the series' names typed over in place in the line over their
   columns (one name with the trace list's, both ways); the page scrolling on at the table's
   end and outside it; the scrollbars of the theme. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { start, openModule, loadFiles, settle, undo, moduleState, history, saveAs, openProject, exportProject, importProject, projectFile, download, tabLabels } from './helpers.mjs';

let env, dir;
before(async ()=>{
  env = await start();
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'datatreat-fig-'));
  // A: ',' and '.', a header with units; B: ';' and ',', no header; C: titles over its header.
  fs.writeFileSync(path.join(dir, 'a.csv'), 'Time (s),Signal (mV),err,Ref [mV]\r\n' + [1, 2, 3, 4, 5, 6].map(t=> `${t},${10 + t*1.5},${(0.1*t).toFixed(1)},${(3 + t/4).toFixed(2)}`).join('\r\n') + '\r\n');
  fs.writeFileSync(path.join(dir, 'b.csv'), [1, 2, 3, 4, 5, 6, 7].map(t=> `${t},0;${(8 + t*0.25).toFixed(2).replace('.', ',')};0,${t}`).join('\n') + '\n');
  fs.writeFileSync(path.join(dir, 'c.csv'), 'series 1,,,series 2,\nTime (s),A,B,Time (s),C\n' + [1, 2, 3].map(t=> `${t},${t + 1},${t + 2},${t},${t + 4}`).join('\n') + '\n');
});
after(()=>{ if (dir) fs.rmSync(dir, { recursive: true, force: true }); return env && env.close(); });

const tick = (page, ms)=> page.evaluate(async ms=> (await import('./tabs.js')).sleepTick(Date.now() + ms), ms);
const awake = async page => (await page.evaluate(async ()=> (await import('./tabs.js')).tabsNow())).map(t=> t.awake);
const roles = async page => (await moduleState(page, 'fig')).files.map(f=> f.roles);
const heads = page => page.$$eval('#figHead thead select', s=> s.map(e=> e.value));
// The series' names, in place over their columns (v534; a series once, its first field), and
// "Series N (Cols x,y)" in their tooltips.
const nameIns = (page, attr)=> page.$$eval('#figHead thead tr.fig-names input[data-col]', (s, attr)=>{ const seen = new Set(); return s.filter(e=> !seen.has(e.dataset.col) && seen.add(e.dataset.col)).map(e=> attr ? e.getAttribute(attr) : e.value); }, attr);
const names = page => nameIns(page);
const labels = page => nameIns(page, 'title');
async function role(page, col, v){ await page.selectOption(`#figHead select[data-col="${col}"]`, v); await settle(page); }
// The file i shown, by the Data card's arrows.
async function showFile(page, i){
  for (let k = 0; k < 5 && !(await page.textContent('#figFileIdx')).startsWith(`${i + 1}/`); k++){ await page.click('#figFileNext'); await settle(page); }
  assert.ok((await page.textContent('#figFileIdx')).startsWith(`${i + 1}/`), 'file ' + i);
}
async function addCard(page, kind){
  await page.click('#figAddAn');
  await page.click(`.an-menu:not([hidden]) [data-kind="${kind}"]`);
  await settle(page);
}
// The Add series window of card n: the boxes of the series named, by file, set; Done or Cancel.
const PICK = '.fig-pick:not([style*="none"])';
const pickFile = (page, file)=> page.locator(`${PICK} .fig-pick-file`).filter({ has: page.locator('.fig-pick-head b', { hasText: new RegExp(`^${file}$`) }) });
const pickBox = (page, file, name)=> pickFile(page, file).locator('label.fig-pick-row:not(.fig-pick-head)').filter({ has: page.locator('.fig-pick-name', { hasText: new RegExp(`^${name.replace(/[()]/g, '\\$&')}$`) }) }).locator('input');
async function pick(page, n, ticks, done = true){
  await page.click(`#fig${n}Add`);
  await page.waitForSelector(PICK);
  for (const [file, name, on = true] of ticks) await pickBox(page, file, name).setChecked(on);
  await page.click(`${PICK} [data-${done ? 'done' : 'cancel'}]`);
  await settle(page);
}
async function op(page, n, k, key, v){
  const f = page.locator(`#fig${n}List .fig-ser`).nth(k).locator(`[data-op="${key}"]`);
  await f.fill(v); await f.press('Enter');
  await settle(page);
}
async function norm(page, n, v){ await page.selectOption(`#fig${n}Norm`, v); await settle(page); }
// What card n's plot holds, as the page drew it.
const stored = (page, n, type)=> page.$eval(`#fig${n}Svg`, (s, type)=> s._plot._stored.filter(e=> e.type === type)
  .map(e=> ({ label: e.label, xs: e.xs && [...e.xs], ys: e.ys && [...e.ys], xc: e.xc, y1: e.y1, med: e.med, text: e.full })), type);
const cardSeries = async page => (await moduleState(page, 'fig')).cards.map(c=> c.series.map(r=> `${r.file}#${r.col}`));
const top = (page, sel)=> page.$eval(sel, e=> e.getBoundingClientRect().top);
const box = (page, sel)=> page.$eval(sel, e=>{ const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height }; });
// The line of the series' names over the head: each cell's text and span.
const nameRow = page => page.$$eval('#figHead thead tr.fig-names th', t=> t.map(e=>{ const i = e.querySelector('input'); return [i ? i.value : e.textContent, e.colSpan]; }));
// A grid's rows' split: where each field starts and how wide it is, in fifths of the grid's width.
const split = (page, sel)=> page.$$eval(sel, gs=> gs.flatMap(g=>{
  const r = g.getBoundingClientRect();
  return [...g.querySelectorAll(':scope > .pg-field, :scope > .fig-ops')].map(f=>{ const q = f.getBoundingClientRect(); return [+((q.left - r.left)/r.width*5).toFixed(2), +(q.width/r.width*5).toFixed(2)]; });
}));
const r2 = a => a.map(v=> +v.toFixed(6));
// The trace list's rows: each trace's name, its file, whether it is included.
const traceRows = page => page.$$eval('#figFileTableWrap tr.file-row', rs=> rs.map(r=> [r.querySelector('.file-label').value, r.querySelector('td.fname').textContent, r.querySelector('.file-incl').checked]));

test('Figure: three CSVs, the Data card, titles, roles, names, XY / bar / box cards, Add series, normalization, composer, project, sleep, a file removed', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'fig');
    assert.equal(await page.locator('#figDataCard').isVisible(), false, 'no Data card before a file');
    await loadFiles(page, 'fig', [path.join(dir, 'a.csv'), path.join(dir, 'b.csv'), path.join(dir, 'c.csv')]);
    assert.equal(await page.locator('#tab-fig .an-card').count(), 0, 'no plot card at the start');
    // The trace list: a row a series (v532), each with its colour (v534: hidden v529–v533) and the palette's button.
    assert.equal(await page.locator('#figFileTableWrap button.color-swatch').count(), 8, 'a swatch a series');
    assert.equal(await page.locator('#figFileTableWrap button.palette-pick-btn').count(), 1, 'the palette');
    assert.equal(await page.locator('#figFileTableWrap .swatch-gap').count(), 0);
    assert.equal(new Set(await page.$$eval('#figFileTableWrap button.color-swatch', s=> s.map(e=> e.dataset.color))).size, 8, 'each its own');
    assert.deepEqual(await traceRows(page), [['Signal', 'a.csv', true], ['err', 'a.csv', true], ['Ref', 'a.csv', true], ['Series 1', 'b.csv', true], ['Series 2', 'b.csv', true],
      ['series 1 – A', 'c.csv', true], ['series 1 – B', 'c.csv', true], ['series 2', 'c.csv', true]]);
    // The Data card: the arrows, the number in the middle, the name on the right; the head on
    // the left, the series' list and the roles' box on the right, from the head's top.
    assert.equal(await page.textContent('#figFileIdx'), '1/3');
    assert.equal(await page.textContent('#figFileName'), 'a');
    // No list of series beside the table (v534): the table across the card.
    const hb = await box(page, '#figHead');
    assert.equal(await page.locator('#figSeries, #figDataCard .fig-side').count(), 0, 'no list of series');
    const cw = await page.$eval('#figDataCard', e=>{ const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return { l: r.left + parseFloat(cs.paddingLeft) + parseFloat(cs.borderLeftWidth), r: r.right - parseFloat(cs.paddingRight) - parseFloat(cs.borderRightWidth) }; });
    assert.ok(Math.abs(hb.l - cw.l) < 1 && Math.abs(hb.r - cw.r) < 1, `the table the card's width (${hb.l}–${hb.r}, ${cw.l}–${cw.r})`);
    // The roles' box on the file's line, at the table's right.
    assert.equal(await page.locator('#figDataCard .fig-data-nav #figSame').count(), 1, 'the roles\' box on the file\'s line');
    const sm = await box(page, '#figDataCard .fig-same'), ix = await box(page, '#figFileIdx');
    assert.ok(Math.abs((sm.t + sm.h/2) - (ix.t + ix.h/2)) < 2, 'level with the file\'s number');
    assert.ok(Math.abs(sm.r - hb.r) < 2, 'its right edge the table\'s');
    // The head of A: its header, the first 5 rows, the default roles; its series, "Series N (Cols x,y)".
    assert.deepEqual(await page.$$eval('#figHead .fig-hd th', t=> t.map(e=> e.textContent)), ['Time (s)', 'Signal (mV)', 'err', 'Ref [mV]']);
    assert.equal(await page.locator('#figHead tbody tr').count(), 6, 'every row');
    assert.deepEqual(await heads(page), ['x', 'y', 'y', 'y']);
    // The series' names over their columns: the x, which all three share, blank.
    assert.deepEqual(await nameRow(page), [['', 1], ['Signal', 1], ['err', 1], ['Ref', 1]]);
    assert.deepEqual(await labels(page), ['Series 1 (Cols 1,2)', 'Series 2 (Cols 1,3)', 'Series 3 (Cols 1,4)']);
    assert.deepEqual(await names(page), ['Signal', 'err', 'Ref']);
    // The file on show a view: no step.
    const h0 = await history(page, 'fig');
    await showFile(page, 1);
    assert.deepEqual(await history(page, 'fig'), h0, 'no step');
    assert.equal(await page.textContent('#figFileName'), 'b');
    assert.equal(await page.locator('#figHead .fig-hd').count(), 0, 'B: no header');
    assert.deepEqual(await page.$$eval('#figHead tbody tr:first-child td', t=> t.map(e=> e.textContent)), ['1,0', '8,25', '0,1']);
    assert.equal(await page.locator('#figHead tbody tr').count(), 7, 'every row of B');
    assert.deepEqual(await names(page), ['Series 1', 'Series 2']);
    assert.deepEqual(await nameRow(page), [['', 1], ['Series 1', 1], ['Series 2', 1]], 'no name typed: the series\' own');
    // C: its titles give the roles (each title's column x, the next ones y) and the names.
    await showFile(page, 2);
    assert.deepEqual(await heads(page), ['x', 'y', 'y', 'x', 'y']);
    assert.deepEqual(await labels(page), ['Series 1 (Cols 1,2)', 'Series 2 (Cols 1,3)', 'Series 3 (Cols 4,5)']);
    assert.deepEqual(await names(page), ['series 1 – A', 'series 1 – B', 'series 2']);
    assert.deepEqual(await nameRow(page), [['', 1], ['series 1 – A', 1], ['series 1 – B', 1], ['series 2', 2]], 'series 2 over its x and its y');
    await page.click('#figFileNext'); await settle(page);
    assert.equal(await page.textContent('#figFileIdx'), '1/3', 'round to the first');
    await page.click('#figFilePrev'); await settle(page);
    assert.equal(await page.textContent('#figFileIdx'), '3/3');
    await showFile(page, 0);
    assert.deepEqual(await history(page, 'fig'), h0, 'still no step');
    // The roles of A: an error of y; another one for the same y turns the first into a y.
    await role(page, 2, 'ey');
    assert.deepEqual(await heads(page), ['x', 'y', 'ey', 'y']);
    assert.deepEqual(await names(page), ['Signal', 'Ref']);
    assert.deepEqual(await nameRow(page), [['', 1], ['Signal', 2], ['Ref', 1]], 'a role changed: Signal over its y and its error');
    await role(page, 3, 'ey');
    assert.deepEqual(await heads(page), ['x', 'y', 'y', 'ey'], 'the error it had becomes a y');
    await undo(page);
    assert.deepEqual(await heads(page), ['x', 'y', 'ey', 'y']);
    // Several x: the last y of A has an x of its own (its time), the one before keeps the first.
    await role(page, 3, 'x');
    assert.deepEqual(await names(page), ['Signal']);
    assert.deepEqual(await nameRow(page), [['Signal', 3], ['', 1]], 'its x its own, and no series over the last x');
    await role(page, 3, 'y');
    // Same roles for all files: B takes A's first three, C A's four and its fifth a y; B said.
    await page.check('#figSame'); await settle(page);
    assert.deepEqual(await roles(page), [['x', 'y', 'ey', 'y'], ['x', 'y', 'ey'], ['x', 'y', 'ey', 'y', 'y']]);
    assert.match(await page.textContent('#figWarn'), /b has 3 columns, fewer than the 4 of a/);
    await page.uncheck('#figSame'); await settle(page);
    assert.equal(await page.textContent('#figWarn'), '');
    await showFile(page, 2); await role(page, 3, 'x'); await showFile(page, 0);
    // A series renamed.
    await page.fill('#figHead input[data-col="1"]', 'Sig A'); await page.press('#figHead input[data-col="1"]', 'Enter'); await settle(page);
    assert.deepEqual(await names(page), ['Sig A', 'Ref']);
    assert.deepEqual(await nameRow(page), [['', 1], ['Sig A', 2], ['Ref', 1]], 'renamed over its columns');

    // + XY: an empty card; the list beside the plot from its top.
    await addCard(page, 'xy');
    assert.equal(await page.inputValue('#tab-fig .an-card .an-name'), 'Plot 1');
    assert.equal(await page.textContent('#tab-fig .an-card .an-type'), 'XY plot');
    assert.equal(await page.locator('#fig1Box .plot-wrap').isVisible(), false, 'empty: no plot');
    assert.equal(await page.locator('#fig1Empty').isVisible(), true);
    assert.equal(await box(page, '#fig1Empty').then(b=> Math.round(b.h)), await box(page, '#figHead').then(b=> Math.round(b.h)), 'its place the chart\'s height, the table\'s');
    // Add series: by file; a file's box ticks all its series, a square with some; Cancel nothing.
    const h1 = await history(page, 'fig');
    await page.click('#fig1Add'); await page.waitForSelector(PICK);
    assert.deepEqual(await page.$$eval(`${PICK} .fig-pick-head b`, b=> b.map(e=> e.textContent)), ['a', 'b', 'c']);
    const fileBox = f => pickFile(page, f).locator('input[data-file]');
    const state = el => el.evaluate(e=> ({ on: e.checked, part: e.indeterminate, mark: getComputedStyle(e, '::before').width }));
    await fileBox('c').check();
    assert.deepEqual(await pickFile(page, 'c').locator('input[data-key]').evaluateAll(l=> l.map(e=> e.checked)), [true, true], 'all of c ticked');
    assert.deepEqual(await state(fileBox('c')), { on: true, part: false, mark: '9px' });
    await pickBox(page, 'c', 'series 2').uncheck();
    assert.deepEqual(await state(fileBox('c')), { on: false, part: true, mark: '7px' }, 'some: a small square');
    assert.deepEqual(await state(fileBox('a')), { on: false, part: false, mark: '9px' });
    await page.click(`${PICK} [data-cancel]`); await settle(page);
    assert.deepEqual(await cardSeries(page), [[]], 'cancelled: nothing');
    assert.deepEqual(await history(page, 'fig'), h1, 'no step');
    await pick(page, 1, [['a', 'Sig A'], ['b', 'Series 1']]);
    assert.deepEqual(await cardSeries(page), [['a.csv#1', 'b.csv#1']]);
    let lines = await stored(page, 1, 'line');
    assert.deepEqual(lines.map(l=> l.label), ['Sig A', 'Series 1']);
    assert.deepEqual(lines[0].ys, [11.5, 13, 14.5, 16, 17.5, 19]);
    assert.deepEqual(lines[1].ys, [8.25, 8.5, 8.75, 9, 9.25, 9.5, 9.75], 'B read with its decimal commas');
    assert.equal((await stored(page, 1, 'segments')).length, 2, 'each its error bars');
    assert.equal(await page.textContent('#fig1Svg .plot-label'), 'Time (s)', 'the unit in the axis title');
    // (as DRS's cards: the svg under the toolbar's row, 36 px down, the column's head 41 px, by the plot's frame)
    const at = await top(page, '#tab-fig .an-card .pside-nav');
    assert.deepEqual([await top(page, '#fig1Svg') - at, await top(page, '#tab-fig .an-card .fig-side .param-head') - at], [36, 41], 'the list from the plot\'s top');
    // The Data card's table as tall as the chart, across the card.
    const sv = await box(page, '#fig1Svg'), tb = await box(page, '#figHead');
    assert.ok(Math.abs(sv.h - tb.h) < 1.5 && tb.w > sv.w + 100, `the table's box the chart's height, wider (${tb.w}×${tb.h}, ${sv.w}×${sv.h})`);
    // A series a row: its scale and offset beside its name; the parameters' 3/5 and 2/5.
    const nm = await box(page, '#fig1List .fig-ser >> nth=0 >> .fig-ser-name'), sc = await box(page, '#fig1List .fig-ser >> nth=0 >> [data-op="scale"]'), of = await box(page, '#fig1List .fig-ser >> nth=0 >> [data-op="offset"]');
    assert.ok(sc.l > nm.r && of.l > sc.r, 'scale and offset right of the name');
    assert.ok(Math.abs((nm.t + nm.h/2) - (sc.t + sc.h/2)) < 3 && Math.abs(sc.t - of.t) < 1, 'on its line');
    for (const sel of ['#tab-fig .an-card .fig-side > .param-grid', '#fig1List .fig-ser'])
      for (const [at, w] of await split(page, sel)) assert.ok(Math.abs(at - 3) < 0.02 && Math.abs(w - 2) < 0.02, `${sel}: the field at 3/5, 2/5 wide (${at}, ${w})`);
    // The window again: the plot's series ticked, a's box a square.
    await page.click('#fig1Add'); await page.waitForSelector(PICK);
    assert.deepEqual(await state(fileBox('a')), { on: false, part: true, mark: '7px' });
    await page.click(`${PICK} [data-cancel]`); await settle(page);
    // Each series' scale and offset; no normalisation of its own, no crop, no swatch.
    assert.equal(await page.locator('#fig1List [data-op="norm"], #fig1List [data-op="xlo"], #fig1List [data-op="xhi"], #fig1List .fig-sw').count(), 0);
    await op(page, 1, 0, 'scale', '2');
    await op(page, 1, 0, 'offset', '1');
    lines = await stored(page, 1, 'line');
    assert.deepEqual(lines[0].ys, [24, 27, 30, 33, 36, 39], '×2 + 1');
    await op(page, 1, 0, 'scale', 'abc');
    assert.equal(await page.inputValue('#fig1List .fig-ser >> nth=0 >> [data-op="scale"]'), '2', 'a value refused, the field set back');
    // The plot's normalisation: none, local (each by its own largest), global (all by the largest).
    assert.deepEqual(await page.$$eval('#fig1Norm option', o=> o.map(e=> e.value)), ['none', 'local', 'global']);
    assert.equal(await page.inputValue('#fig1Norm'), 'none');
    await norm(page, 1, 'local');
    lines = await stored(page, 1, 'line');
    assert.deepEqual(r2([lines[0].ys[5], lines[1].ys[6]]), [3, 1], 'each to its own maximum, then ×2 + 1');
    await norm(page, 1, 'global');
    lines = await stored(page, 1, 'line');
    assert.deepEqual(r2([lines[0].ys[5], lines[1].ys[6]]), r2([3, 9.75/19]), 'all by the common maximum');
    assert.equal((await moduleState(page, 'fig')).cards[0].norm, 'global');
    await undo(page);
    assert.equal(await page.inputValue('#fig1Norm'), 'local', 'a step');
    await undo(page, true);

    // + Bar: categories from the x, a series of each file side by side.
    await addCard(page, 'bar');
    await pick(page, 2, [['a', 'Sig A'], ['b', 'Series 1']]);
    const bars = await stored(page, 2, 'barpx');
    assert.equal(bars.length, 13, '6 bars of A and 7 of B');
    assert.deepEqual([...new Set(bars.map(b=> b.label))], ['Sig A', 'Series 1']);
    assert.deepEqual((await stored(page, 2, 'ticklabel')).map(t=> t.text), ['1', '2', '3', '4', '5', '6', '7']);
    assert.ok((await stored(page, 2, 'errbar')).length >= 13, 'the error bars');
    assert.equal(await page.locator('#fig2List [data-op="offset"]').count(), 0, 'a bar chart: no offset');
    // + Box: each series a group, named as it; C's by its titles.
    await addCard(page, 'box');
    await pick(page, 3, [['a', 'Ref'], ['b', 'Series 1'], ['c', 'series 2']]);
    const boxes = await stored(page, 3, 'box');
    assert.deepEqual(boxes.map(b=> b.label), ['Ref', 'Series 1', 'series 2']);
    assert.equal(boxes[1].med, 9);
    await op(page, 3, 1, 'scale', '10');
    assert.equal((await stored(page, 3, 'box'))[1].med, 90);
    // The window: c's box ticks all of c; one of b out: the plot as ticked, in its order.
    await pick(page, 3, [['b', 'Series 1', false], ['c', 'series 1 – A']]);
    assert.deepEqual((await cardSeries(page))[2], ['a.csv#3', 'c.csv#4', 'c.csv#1']);
    await undo(page);
    assert.deepEqual((await cardSeries(page))[2], ['a.csv#3', 'b.csv#1', 'c.csv#4']);
    assert.deepEqual(await page.$$eval('#tab-fig .an-card .an-type', t=> t.map(e=> e.textContent)), ['XY plot', 'Bar chart', 'Box plot']);

    // The composer of Plot 1: its series, a title typed, kept with the card as it closes.
    await page.locator('#tab-fig .an-card').first().locator('button[title="Figure composer (advanced export)"]').click();
    await page.waitForSelector('.fig-backdrop .fig-svg path');
    assert.equal(await page.locator('.fig-backdrop .fig-serie[data-s]').count(), 2);
    await page.fill('.fig-backdrop input[data-k="xlabel"]', 'Time in s'); await page.press('.fig-backdrop input[data-k="xlabel"]', 'Enter');
    await page.keyboard.press('Escape'); await settle(page);
    assert.equal(await page.locator('.fig-backdrop').count(), 0);
    assert.equal((await moduleState(page, 'fig')).cards[0].fig.scalars.xlabel, 'Time in s', 'the figure in the card');

    // Saved and opened again (a tab of its own): all of it, the composer's figure too.
    const S = await moduleState(page, 'fig');
    await saveAs(page, 'figs');
    await page.click('#tabBar .ptab.is-on .ptab-x');
    await settle(page);
    await openProject(page, 'fig', 'figs');
    assert.deepEqual(await moduleState(page, 'fig'), S);
    assert.deepEqual((await stored(page, 1, 'line')).map(l=> l.ys.length), [6, 7]);
    assert.equal(await page.inputValue('#fig1Norm'), 'global');
    await page.locator('#tab-fig .an-card').first().locator('button[title="Figure composer (advanced export)"]').click();
    await page.waitForSelector('.fig-backdrop .fig-svg path');
    assert.equal(await page.inputValue('.fig-backdrop input[data-k="xlabel"]'), 'Time in s');
    await page.keyboard.press('Escape'); await settle(page);

    // Asleep and woken: its state, the file its Data card showed, its plots.
    await showFile(page, 1);
    await page.evaluate(async ()=>{ const u = await import('./utils.js'); Object.assign(u.settings, { sleepMin: 10 }); });
    const n = await page.locator('#tabBar .ptab').count();
    await openModule(page, 'epr');
    await tick(page, 11*60000);
    assert.equal((await awake(page))[n - 1], false, 'asleep');
    await page.locator('#tabBar .ptab').nth(n - 1).locator('.ptab-label').click(); await settle(page);
    assert.deepEqual(await moduleState(page, 'fig'), S);
    assert.equal(await page.textContent('#figFileIdx'), '2/3', 'the file it showed');
    assert.equal((await stored(page, 3, 'box'))[1].med, 90);

    // A file removed (its traces removed, its last taking the file): its series leave the plots and their lists.
    let steps = 0;
    while ((await traceRows(page))[0][1] === 'a.csv'){ await page.click('#figFileTableWrap tr.file-row:nth-child(1) .row-del'); await settle(page); steps++; }
    assert.ok(steps > 0);
    assert.ok((await traceRows(page)).every(r=> r[1] !== 'a.csv'), 'the file gone');
    assert.deepEqual(await cardSeries(page), [['b.csv#1'], ['b.csv#1'], ['b.csv#1', 'c.csv#4']]);
    assert.deepEqual((await stored(page, 1, 'line')).map(l=> l.label), ['Series 1']);
    assert.deepEqual(await page.$$eval('#fig1List .fig-ser-name', s=> s.map(e=> e.textContent)), ['Series 1']);
    for (let k = 0; k < steps; k++) await undo(page);
    assert.deepEqual(await cardSeries(page), S.cards.map(c=> c.series.map(r=> `${r.file}#${r.col}`)));
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('Figure: a v528 project, its series normalised each and cropped, opens with the plot\'s normalisation and no crop', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'fig');
    await loadFiles(page, 'fig', [path.join(dir, 'a.csv'), path.join(dir, 'b.csv')]);
    await addCard(page, 'xy');
    await pick(page, 1, [['a', 'Signal'], ['b', 'Series 1']]);
    await addCard(page, 'bar');
    await pick(page, 2, [['a', 'Signal'], ['b', 'Series 1']]);
    const { obj } = await exportProject(page);
    // As v528 wrote it: no plot's normalisation, each series its own and its crop.
    const st = JSON.parse(JSON.stringify(obj.state)), cs = st.cards || st.module?.cards;
    assert.ok(Array.isArray(cs), 'the cards in the project');
    cs.forEach((c, i)=>{ delete c.norm; c.series = c.series.map((r, k)=> ({ ...r, norm: i === 0 || k === 0, xlo: 2, xhi: 4 })); });
    await importProject(page, projectFile(env, 'fig528.datatreat', { ...obj, title: 'fig528', appVersion: 'v528', state: st }, { sign: true }));
    await openProject(page, 'fig', 'fig528');
    const s = await moduleState(page, 'fig');
    assert.deepEqual(s.cards.map(c=> c.norm), ['local', 'none'], 'local where every series was normalised, else none');
    assert.deepEqual(s.cards.flatMap(c=> c.series.map(r=> Object.keys(r).sort().join())), Array(4).fill('col,file,offset,scale'), 'no crop, no normalisation of its own');
    const lines = await stored(page, 1, 'line');
    assert.deepEqual(lines.map(l=> l.xs.length), [6, 7], 'not cropped');
    assert.deepEqual(r2(lines.map(l=> Math.max(...l.ys))), [1, 1], 'each to its own maximum');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

/* v531: a file of 25 columns and 80 rows (an x and 24 y): the Data card's table whole,
   scrolling both ways in its box (the chart's size), its head staying at its top; its 24
   series scrolling in theirs, from the table's top to its foot; a Plot card of the 24, its
   list scrolling between the normalisation and + Add series, the button's bottom on the
   chart's; the lists' rows the column's width, their fields at its three fifths. A scroll is
   no step and no change. At 1400, 1100 and 1920 px. */
test('Custom: the table whole and scrolling, the lists of series in their boxes, + Add series at the chart\'s foot', async ()=>{
  const cols = 25, rows = 80;
  fs.writeFileSync(path.join(dir, 'wide.csv'), ['Time (s)', ...Array.from({ length: cols - 1 }, (_, k)=> `Channel ${k + 1} (mV)`)].join(',') + '\n'
    + Array.from({ length: rows }, (_, i)=> [i + 1, ...Array.from({ length: cols - 1 }, (_, k)=> (k + 1)*(i + 1)/10)].join(',')).join('\n') + '\n');
  for (const width of [1400, 1100, 1920]){
    const { page, errors, close } = await env.page({ viewport: { width, height: 1000 } });
    try {
      await openModule(page, 'fig');
      assert.deepEqual([await page.textContent('.home-card[data-go="fig"] .txt-tile'), await page.textContent('[data-new-module="fig"] .txt-tile')], ['Custom', 'Custom']);
      assert.equal(await page.textContent('#projectBar .pbar-tech'), 'Custom', 'named Custom');
      assert.match(await page.title(), /· Custom$/);
      await loadFiles(page, 'fig', [path.join(dir, 'wide.csv')]);
      // The table: every row, in a box scrolling both ways, its head at its top as it scrolls.
      assert.equal(await page.locator('#figHead tbody tr').count(), rows);
      const sc = await page.$eval('#figHead', e=> [e.scrollWidth > e.clientWidth, e.scrollHeight > e.clientHeight, getComputedStyle(e).overflowX, getComputedStyle(e).overflowY]);
      assert.deepEqual(sc, [true, true, 'auto', 'auto'], width + ': scrolling both ways');
      assert.equal((await nameRow(page)).length, cols, 'a cell a column (the x shared: blank)');
      const h0 = await history(page, 'fig');
      await page.$eval('#figHead', e=>{ e.scrollTop = 400; e.scrollLeft = 200; });
      await settle(page);
      const hb = await box(page, '#figHead');
      assert.ok(Math.abs(await top(page, '#figHead thead tr.fig-names') - hb.t) < 2, 'the names\' line at the box\'s top, scrolled');
      assert.deepEqual(await history(page, 'fig'), h0, 'a scroll no step');
      // The 24 names in place over their columns, scrolling with the table (no list beside it, v534).
      assert.equal((await names(page)).length, cols - 1);
      assert.equal(await page.locator('#figSeries').count(), 0);

      // A Plot card of the 24: the list scrolls between the normalisation and + Add series.
      await addCard(page, 'xy');
      await page.click('#fig1Add'); await page.waitForSelector(PICK);
      await pickFile(page, 'wide').locator('input[data-file]').check();
      await page.click(`${PICK} [data-done]`); await settle(page);
      assert.equal(await page.locator('#fig1List .fig-ser').count(), cols - 1);
      const sv = await box(page, '#fig1Svg'), add = await box(page, '#fig1Add'), list = await box(page, '#fig1List'), nb = await box(page, '#fig1Norm');
      assert.ok(Math.abs(add.b - sv.b) <= 2, `${width}: + Add series' bottom the chart's (${add.b}, ${sv.b})`);
      assert.ok(list.b <= add.t && add.t - list.b <= 12, `the list ends just above the button (${list.b}, ${add.t})`);
      assert.ok(nb.b <= list.t, 'the normalisation above the list');
      assert.ok(await page.$eval('#fig1List', e=> e.scrollHeight > e.clientHeight), `the 24 series scroll (${JSON.stringify([sv, add, list])})`);
      assert.equal(await page.locator('#fig1List #fig1Add, #fig1List #fig1Norm, #fig1List .param-head').count(), 0, 'the head, the normalisation and the button outside the list');
      assert.ok(Math.abs(sv.h - hb.h) < 1.5, `${width}: the table the chart's height (${hb.h}, ${sv.h})`);
      const card = await box(page, '#figDataCard');
      assert.ok(hb.w > sv.w + 100 && card.r - hb.r < 40 && hb.l - card.l < 40, `${width}: the table across the card`);
      for (const [at, w] of await split(page, '#fig1List .fig-ser')) assert.ok(Math.abs(at - 3) < 0.02 && Math.abs(w - 2) < 0.02, `a series' operations at 3/5 (${at}, ${w})`);
      // Nothing wider than its column (but the lists' boxes, whose thin scrollbar lies in the card's padding).
      assert.deepEqual(await page.$$eval('#tab-fig .fig-side', ss=> ss.flatMap(s=>{ const r = s.getBoundingClientRect(); return [...s.querySelectorAll('*')].filter(e=>{ const q = e.getBoundingClientRect(); return q.width && q.right > r.right + (e.classList.contains('fig-scroll') ? 11 : 1); }).map(e=> e.className || e.tagName); })), [], 'no overflow');
      assert.deepEqual(errors, []);
    } finally { await close(); }
  }
});

// v532: each series a trace in the trace list, its File its CSV; one name in the list and the
// Data card; a role changed updates the list at once; a trace left out leaves the plots and
// Add series; the list's order is Add series'; a trace removed sets its column to —; the
// file's download its bytes.
test('Custom: the series are the trace list\'s traces: one name, live roles, left out, order, removed, the file\'s bytes', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'fig');
    await loadFiles(page, 'fig', [path.join(dir, 'a.csv'), path.join(dir, 'b.csv')]);
    assert.deepEqual(await traceRows(page), [['Signal', 'a.csv', true], ['err', 'a.csv', true], ['Ref', 'a.csv', true], ['Series 1', 'b.csv', true], ['Series 2', 'b.csv', true]]);
    // Renamed in the list: the Data card's name too; renamed there: the list's.
    const lab = page.locator('#figFileTableWrap .file-label').nth(0);
    await lab.fill('Volt'); await lab.press('Enter'); await settle(page);
    assert.deepEqual(await names(page), ['Volt', 'err', 'Ref']);
    const sn = page.locator('#figHead thead input[data-col="3"]');
    await sn.fill('Reference'); await sn.press('Enter'); await settle(page);
    assert.deepEqual((await traceRows(page)).map(r=> r[0]), ['Volt', 'err', 'Reference', 'Series 1', 'Series 2']);
    // A role changed in the Data card: the list at once (err an error of Signal: no trace of its own).
    await role(page, 2, 'ey');
    assert.deepEqual((await traceRows(page)).map(r=> r[0]), ['Volt', 'Reference', 'Series 1', 'Series 2']);
    // Left out: out of the plot and of Add series, kept in the list.
    await addCard(page, 'xy');
    await pick(page, 1, [['a', 'Volt'], ['b', 'Series 1']]);
    assert.deepEqual((await stored(page, 1, 'line')).map(l=> l.label), ['Volt', 'Series 1']);
    await page.locator('#figFileTableWrap .file-incl').nth(2).click(); await settle(page);
    assert.deepEqual(await traceRows(page), [['Volt', 'a.csv', true], ['Reference', 'a.csv', true], ['Series 1', 'b.csv', false], ['Series 2', 'b.csv', true]]);
    assert.deepEqual((await stored(page, 1, 'line')).map(l=> l.label), ['Volt']);
    await page.click('#fig1Add'); await page.waitForSelector(PICK);
    const listed = ()=> page.$$eval(`${PICK} .fig-pick-name`, s=> s.map(e=> e.textContent));
    assert.deepEqual(await listed(), ['Volt', 'Reference', 'Series 2'], 'Add series: the traces included');
    await page.click(`${PICK} [data-cancel]`); await settle(page);
    // Moved in the list (Series 2 to the top): Add series' order follows.
    const rows = page.locator('#figFileTableWrap tr.file-row');
    await page.locator('#figFileTableWrap').scrollIntoViewIfNeeded();
    const from = await rows.nth(3).locator('.drag-handle').boundingBox(), to = await rows.nth(0).boundingBox();
    await page.mouse.move(from.x + from.width/2, from.y + from.height/2); await page.mouse.down();
    await page.mouse.move(from.x + from.width/2, to.y + 3, { steps: 8 }); await page.mouse.up(); await settle(page);
    assert.deepEqual((await traceRows(page)).map(r=> r[0]), ['Series 2', 'Volt', 'Reference', 'Series 1']);
    await page.click('#fig1Add'); await page.waitForSelector(PICK);
    assert.deepEqual(await listed(), ['Series 2', 'Volt', 'Reference']);
    await page.click(`${PICK} [data-cancel]`); await settle(page);
    // Kept with the project, through an undo too.
    const st = await moduleState(page, 'fig');
    assert.deepEqual(st.order.slice(0, 4), ['b.csv\n2', 'a.csv\n1', 'a.csv\n3', 'b.csv\n1']);
    assert.deepEqual(st.files[1].out, [1]);
    // Its download: the CSV's own bytes.
    const d = await download(page, ()=> page.locator('#figFileTableWrap .dl-file').nth(1).click());
    assert.equal(d.name, 'a.csv');
    assert.ok(d.buf.equals(fs.readFileSync(path.join(dir, 'a.csv'))));
    // Removed: its column (and its error's) no longer used; the plot lets it go.
    await page.locator('#figFileTableWrap .row-del').nth(1).click(); await settle(page);
    assert.deepEqual((await traceRows(page)).map(r=> r[0]), ['Series 2', 'Reference', 'Series 1']);
    assert.deepEqual(await heads(page), ['x', '', '', 'y']);
    assert.equal(await page.locator('#fig1List .fig-ser').count(), 0);
    await undo(page);
    assert.deepEqual((await traceRows(page)).map(r=> r[0]), ['Series 2', 'Volt', 'Reference', 'Series 1']);
    assert.deepEqual(await heads(page), ['x', 'y', 'ey', 'y']);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

/* v534: the trace list's colours: a swatch a series and the palette, the plots drawing each
   series in its trace's colour (a colour picked, a palette given to all), kept with the
   project and undone a step; the series' names typed over in place in the Data card's line
   over their columns, the trace list's name the same both ways (Escape puts back the name);
   a colour a change unsaved, the file shown and the table's scroll none (v528). */
test('Custom v534: colours and palette in the trace list, the plots in them; the names in place, one with the list\'s', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'fig');
    await loadFiles(page, 'fig', [path.join(dir, 'a.csv'), path.join(dir, 'b.csv')]);
    await addCard(page, 'xy');
    await pick(page, 1, [['a', 'Signal'], ['b', 'Series 1']]);
    const swatches = ()=> page.$$eval('#figFileTableWrap button.color-swatch', s=> s.map(e=> e.dataset.color));
    const plotted = ()=> page.$eval('#fig1Svg', s=> s._plot._stored.filter(e=> e.type === 'line').map(e=> e.color));
    const legend = ()=> page.$$eval('#fig1Legend i', is=> is.map(e=> getComputedStyle(e).backgroundColor));
    const rgb = hex => `rgb(${[1, 3, 5].map(i=> parseInt(hex.slice(i, i + 2), 16)).join(', ')})`;
    let sw = await swatches();
    assert.equal(sw.length, 5);
    assert.deepEqual(await plotted(), [sw[0], sw[3]], 'the lines in their traces\' colours');
    assert.deepEqual(await legend(), [rgb(sw[0]), rgb(sw[3])], 'and the legend');
    await saveAs(page, 'colours');
    assert.ok(!(await tabLabels(page))[0].endsWith('*'));
    // A view: the file shown, the table scrolled: no change unsaved.
    await page.click('#figFileNext'); await settle(page);
    await page.$eval('#figHead', e=>{ e.scrollTop = 30; }); await settle(page);
    assert.ok(!(await tabLabels(page))[0].endsWith('*'), 'a view: no change');
    await page.click('#figFilePrev'); await settle(page);
    // A colour picked for Series 1 (b's): its line and its legend follow; a change, a step.
    const h0 = await history(page, 'fig');
    await page.click('#figFileTableWrap .color-swatch[data-i="3"]');
    await page.click('.cp-popup .cp-preset >> nth=3');
    await page.click('#figFileTableWrap thead th:nth-child(4)');
    await settle(page);
    sw = await swatches();
    assert.equal(sw[3], '#f1c40f');
    assert.deepEqual(await plotted(), [sw[0], '#f1c40f']);
    assert.deepEqual(await legend(), [rgb(sw[0]), rgb('#f1c40f')]);
    assert.deepEqual((await moduleState(page, 'fig')).files[1].colors, { 1: '#f1c40f' }, 'kept by its column');
    assert.ok((await tabLabels(page))[0].endsWith('*'), 'a change unsaved');
    assert.ok((await history(page, 'fig')).index > h0.index, 'a step');
    await undo(page);
    assert.notEqual((await swatches())[3], '#f1c40f', 'undone');
    await undo(page, true);
    // The palette: every series its colour, in the list's order.
    await page.click('#figFileTableWrap button.palette-pick-btn');
    const pal = await page.$$eval('.pp-popup .pp-row:nth-child(2) .pp-swatch', s=> s.map(e=> getComputedStyle(e).backgroundColor));
    await page.click('.pp-popup .pp-row:nth-child(2)'); await settle(page);
    sw = await swatches();
    assert.deepEqual(sw.map(rgb), pal.slice(0, 5), 'the palette\'s colours in the list\'s order');
    assert.deepEqual(await plotted(), [sw[0], sw[3]]);
    // Kept with the project.
    await page.click('.proj-save'); await page.waitForSelector('.proj-save.is-saved');
    await openProject(page, 'fig', 'colours');
    assert.deepEqual(await swatches(), sw, 'opened again with its colours');

    // The names in place: typed over a's Ref, the trace list's too; renamed in the list, the field.
    const field = page.locator('#figHead thead input[data-col="3"]');
    assert.equal(await field.getAttribute('title'), 'Series 3 (Cols 1,4)');
    await field.fill('Reference'); await field.press('Enter'); await settle(page);
    assert.deepEqual((await traceRows(page)).map(r=> r[0]), ['Signal', 'err', 'Reference', 'Series 1', 'Series 2']);
    const lab = page.locator('#figFileTableWrap .file-label').nth(1);
    await lab.fill('Error'); await lab.press('Enter'); await settle(page);
    assert.equal(await page.inputValue('#figHead thead input[data-col="2"]'), 'Error');
    // Escape: the name it had; emptied: its own again.
    await field.fill('xyz'); await field.press('Escape'); await settle(page);
    assert.equal(await field.inputValue(), 'Reference');
    await field.fill(''); await field.press('Enter'); await settle(page);
    assert.equal(await field.inputValue(), 'Ref');
    assert.equal((await traceRows(page))[2][0], 'Ref');
    // Typed over, then a click on the next field: the name taken, the focus there.
    await page.locator('#figHead thead input[data-col="1"]').fill('Volt');
    await page.locator('#figHead thead input[data-col="2"]').click(); await settle(page);
    assert.equal((await traceRows(page))[0][0], 'Volt');
    assert.equal(await page.evaluate(()=> document.activeElement.dataset.col), '2', 'the focus on the field clicked');
    assert.deepEqual((await stored(page, 1, 'line')).map(l=> l.label), ['Volt', 'Series 1'], 'the plot\'s names');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

/* v534: the page scrolls on once the table's box is at its end (the wheel over it), and with
   the pointer outside it; every box scrolling inside the page lets the wheel go on at its
   end (only the windows, which hold the page still, keep it); the scrollbars of the theme. */
test('Custom v534: the page scrolls past the table\'s end and outside it; the scrollbars follow the theme', async ()=>{
  const { page, errors, close } = await env.page({ viewport: { width: 1400, height: 800 } });
  try {
    await openModule(page, 'fig');
    fs.writeFileSync(path.join(dir, 'long.csv'), 'x,y\n' + Array.from({ length: 200 }, (_, i)=> `${i},${i*2}`).join('\n') + '\n');
    await loadFiles(page, 'fig', [path.join(dir, 'long.csv')]);
    await addCard(page, 'xy');
    await page.$eval('#figHead', e=> window.scrollTo(0, e.getBoundingClientRect().top + scrollY - 100));
    await settle(page);
    const b = await box(page, '#figHead');
    await page.mouse.move(b.l + b.w/2, b.t + b.h/2);
    const y0 = await page.evaluate(()=> scrollY);
    for (let i = 0; i < 30; i++){ await page.mouse.wheel(0, 300); await page.waitForTimeout(20); }
    await page.waitForTimeout(300);
    const inner = await page.$eval('#figHead', e=> e.scrollHeight - e.clientHeight - e.scrollTop);
    assert.ok(inner < 2, 'the table scrolled to its end');
    const y1 = await page.evaluate(()=> scrollY);
    assert.ok(y1 > y0 + 50, `the wheel at the table's end scrolls the page (${y0} → ${y1})`);
    // Outside it: the page, at once (up, from where it is).
    await page.mouse.move(8, 400);
    for (let i = 0; i < 3; i++){ await page.mouse.wheel(0, -200); await page.waitForTimeout(20); }
    await page.waitForTimeout(300);
    assert.ok(await page.evaluate(()=> scrollY) < y1 - 100, 'outside it, the page scrolls');
    // Every rule that keeps the wheel in its box is a window's.
    const contain = await page.evaluate(()=> [...document.styleSheets].flatMap(s=>{ try { return [...s.cssRules]; } catch(e){ return []; } })
      .filter(r=> r.style && /contain|none/.test(r.style.overscrollBehavior || r.style.overscrollBehaviorY || '')).map(r=> r.selectorText));
    assert.ok(contain.every(sel=> /modal|iodo-cal|xrd-std|xrd-cag/.test(sel)), 'only the windows\' boxes: ' + contain.join(' | '));
    assert.deepEqual(await page.$$eval('#tab-fig *', es=> es.filter(e=> /auto|scroll/.test(getComputedStyle(e).overflowY) && getComputedStyle(e).overscrollBehaviorY !== 'auto').map(e=> e.id || e.className)), [], 'no box of the tab keeps the wheel');
    // The scrollbars: the theme's colours, the dark's not the light's.
    const bars = ()=> page.$eval('#figHead', e=> [getComputedStyle(e).scrollbarColor]);
    const dark = await bars();
    assert.equal(await page.evaluate(()=> document.documentElement.dataset.theme), 'dark');
    await page.evaluate(async ()=> (await import('./utils.js')).applyTheme('light', false));
    const light = await bars();
    assert.notEqual(dark[0], light[0], `the scrollbars' colours differ (${dark[0]}, ${light[0]})`);
    assert.notEqual(await page.$eval('#fig1List', e=> getComputedStyle(e).scrollbarColor), dark[0], 'a list\'s too');
    await page.evaluate(async ()=> (await import('./utils.js')).applyTheme('dark', false));
    assert.equal((await bars())[0], dark[0]);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

/* v534: Custom the last module on the home page and in the "+" new project's chooser, by a
   rule of its own (utils.js customLast, orderModuleCards), whatever module comes after it. */
test('Custom last: the home page, the new project\'s chooser, the modules\' order', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    const order = ()=> page.evaluate(()=> [[...document.querySelectorAll('.home-card[data-go]')].map(e=> e.dataset.go), [...document.querySelectorAll('[data-new-module]')].map(e=> e.dataset.newModule)]);
    const [home, pick] = await order();
    assert.equal(home.at(-1), 'fig');
    assert.equal(pick.at(-1), 'fig');
    assert.deepEqual(home, pick);
    // A module added after it in the page, and to a list: Custom still last.
    const after = await page.evaluate(async ()=>{
      const u = await import('./utils.js');
      for (const [sel, attr] of [['.home-card[data-go="fig"]', 'data-go'], ['[data-new-module="fig"]', 'data-new-module']]){
        const c = document.querySelector(sel), n = c.cloneNode(true);
        n.setAttribute(attr, 'zzz');
        c.after(n);
      }
      u.orderModuleCards();
      return { mods: u.MODULES.at(-1), list: u.customLast(['fig', 'a', 'b']) };
    });
    assert.deepEqual(after, { mods: 'fig', list: ['a', 'b', 'fig'] });
    const [home2, pick2] = await order();
    assert.deepEqual([home2.slice(-2), pick2.slice(-2)], [['zzz', 'fig'], ['zzz', 'fig']]);
    // The "+" chooser opened: Custom its last tile.
    await page.evaluate(()=> document.querySelector('[data-new-module="zzz"]').remove());
    await page.click('#tabBar .ptab-add');
    assert.equal(await page.locator('#projNewModal .newproj-card').last().getAttribute('data-new-module'), 'fig');
    assert.equal(await page.locator('#projNewModal .newproj-card').last().textContent(), 'Custom');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
