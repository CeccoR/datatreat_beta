/* The Figure module (v527): two CSV files read (',' with '.' decimals and a header with
   units; ';' with ',' decimals and none), the Data card's roles and their rules (several x,
   an error of y set where its y has one already turning that one into a y, the roles of
   the file shown given to every file with a warning for the file with fewer columns), the
   series' names (the header's, else "file N, series M", typed over); the + adding an XY, a
   bar and a box card with series of both files, each series' operations, the composer of a
   card opened and its figure kept with the card; the project saved and opened again; a tab
   asleep and woken as it was; a file removed taking its series out of the plots and the
   numbers following. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { start, openModule, loadFiles, settle, undo, moduleState, saveAs, openProject } from './helpers.mjs';

let env, dir;
before(async ()=>{
  env = await start();
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'datatreat-fig-'));
  // A: ',' and '.', a header with units; B: ';' and ',', no header.
  fs.writeFileSync(path.join(dir, 'a.csv'), 'Time (s),Signal (mV),err,Ref [mV]\r\n' + [1, 2, 3, 4, 5, 6].map(t=> `${t},${10 + t*1.5},${(0.1*t).toFixed(1)},${(3 + t/4).toFixed(2)}`).join('\r\n') + '\r\n');
  fs.writeFileSync(path.join(dir, 'b.csv'), [1, 2, 3, 4, 5, 6, 7].map(t=> `${t},0;${(8 + t*0.25).toFixed(2).replace('.', ',')};0,${t}`).join('\n') + '\n');
});
after(()=>{ if (dir) fs.rmSync(dir, { recursive: true, force: true }); return env && env.close(); });

const tick = (page, ms)=> page.evaluate(async ms=> (await import('./tabs.js')).sleepTick(Date.now() + ms), ms);
const awake = async page => (await page.evaluate(async ()=> (await import('./tabs.js')).tabsNow())).map(t=> t.awake);
const roles = async page => (await moduleState(page, 'fig')).files.map(f=> f.roles);
const heads = page => page.$$eval('#figHead thead select', s=> s.map(e=> e.value));
const names = page => page.$$eval('#figSeries input', s=> s.map(e=> e.value));
async function role(page, col, v){ await page.selectOption(`#figHead select[data-col="${col}"]`, v); await settle(page); }
async function showFile(page, i){ await page.selectOption('#figFileSel', String(i)); await settle(page); }
async function addCard(page, kind){
  await page.click('#figAddAn');
  await page.click(`.an-menu:not([hidden]) [data-kind="${kind}"]`);
  await settle(page);
}
// A series added to card n by its name in the card's menu.
async function addSeries(page, n, name){
  const v = await page.$eval(`#fig${n}Add`, (s, name)=> [...s.options].find(o=> o.textContent === name).value, name);
  await page.selectOption(`#fig${n}Add`, v);
  await settle(page);
}
async function op(page, n, k, key, v){
  const f = page.locator(`#fig${n}List .fig-ser`).nth(k).locator(`[data-op="${key}"]`);
  if (key === 'norm') await f.setChecked(v); else { await f.fill(v); await f.press('Enter'); }
  await settle(page);
}
// What card n's plot holds, as the page drew it.
const stored = (page, n, type)=> page.$eval(`#fig${n}Svg`, (s, type)=> s._plot._stored.filter(e=> e.type === type)
  .map(e=> ({ label: e.label, xs: e.xs && [...e.xs], ys: e.ys && [...e.ys], xc: e.xc, y1: e.y1, med: e.med, text: e.full })), type);
const cardSeries = async page => (await moduleState(page, 'fig')).cards.map(c=> c.series.map(r=> `${r.file}#${r.col}`));

test('Figure: two CSVs, roles and their rules, names, XY / bar / box cards, operations, composer, project, sleep, a file removed', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'fig');
    assert.equal(await page.locator('#figDataCard').isVisible(), false, 'no Data card before a file');
    await loadFiles(page, 'fig', [path.join(dir, 'a.csv'), path.join(dir, 'b.csv')]);
    assert.equal(await page.locator('#tab-fig .an-card').count(), 0, 'no plot card at the start');
    // The head of A: its header, the first 5 rows, the default roles; B read with its ',' decimals.
    assert.deepEqual(await page.$$eval('#figHead .fig-hd th', t=> t.map(e=> e.textContent)), ['Time (s)', 'Signal (mV)', 'err', 'Ref [mV]']);
    assert.equal(await page.locator('#figHead tbody tr').count(), 5);
    assert.deepEqual(await heads(page), ['x', 'y', 'y', 'y']);
    assert.deepEqual(await names(page), ['Signal', 'err', 'Ref']);
    await showFile(page, 1);
    assert.equal(await page.locator('#figHead .fig-hd').count(), 0, 'B: no header');
    assert.deepEqual(await page.$$eval('#figHead tbody tr:first-child td', t=> t.map(e=> e.textContent)), ['1,0', '8,25', '0,1']);
    assert.deepEqual(await names(page), ['file 2, series 1', 'file 2, series 2']);
    // The roles of A: an error of y; another one for the same y turns the first into a y.
    await showFile(page, 0);
    await role(page, 2, 'ey');
    assert.deepEqual(await heads(page), ['x', 'y', 'ey', 'y']);
    assert.deepEqual(await names(page), ['Signal', 'Ref']);
    await role(page, 3, 'ey');
    assert.deepEqual(await heads(page), ['x', 'y', 'y', 'ey'], 'the error it had becomes a y');
    await undo(page);
    assert.deepEqual(await heads(page), ['x', 'y', 'ey', 'y']);
    // Several x: the last y of A has an x of its own (its time), the one before keeps the first.
    await role(page, 3, 'x');
    assert.deepEqual(await names(page), ['Signal']);
    await role(page, 3, 'y');
    // Same roles for all files: B takes A's first three, and is said to have fewer columns.
    await page.check('#figSame'); await settle(page);
    assert.deepEqual(await roles(page), [['x', 'y', 'ey', 'y'], ['x', 'y', 'ey']]);
    assert.match(await page.textContent('#figWarn'), /b has 3 columns, fewer than the 4 of a/);
    await page.uncheck('#figSame'); await settle(page);
    assert.equal(await page.textContent('#figWarn'), '');
    // A series renamed; B's by its number.
    await page.fill('#figSeries input[data-col="1"]', 'Sig A'); await page.press('#figSeries input[data-col="1"]', 'Enter'); await settle(page);
    assert.deepEqual(await names(page), ['Sig A', 'Ref']);

    // + XY: an empty card, then a series of each file; the operations of each.
    await addCard(page, 'xy');
    assert.equal(await page.inputValue('#tab-fig .an-card .an-name'), 'Plot 1');
    assert.equal(await page.textContent('#tab-fig .an-card .an-type'), 'XY plot');
    assert.equal(await page.locator('#fig1Box').isVisible(), false, 'empty: no plot');
    await addSeries(page, 1, 'Sig A');
    await addSeries(page, 1, 'file 2, series 1');
    let lines = await stored(page, 1, 'line');
    assert.deepEqual(lines.map(l=> l.label), ['Sig A', 'file 2, series 1']);
    assert.deepEqual(lines[0].ys, [11.5, 13, 14.5, 16, 17.5, 19]);
    assert.deepEqual(lines[1].ys, [8.25, 8.5, 8.75, 9, 9.25, 9.5, 9.75], 'B read with its decimal commas');
    assert.equal((await stored(page, 1, 'segments')).length, 2, 'each its error bars');
    assert.equal(await page.textContent('#fig1Svg .plot-label'), 'Time (s)', 'the unit in the axis title');
    await op(page, 1, 0, 'scale', '2');
    await op(page, 1, 0, 'offset', '1');
    await op(page, 1, 1, 'xlo', '2'); await op(page, 1, 1, 'xhi', '4');
    await op(page, 1, 1, 'norm', true);
    lines = await stored(page, 1, 'line');
    assert.deepEqual(lines[0].ys, [24, 27, 30, 33, 36, 39], '×2 + 1');
    assert.deepEqual(lines[1].xs, [2, 3, 4], 'cropped in x');
    assert.deepEqual(lines[1].ys.map(v=> +v.toFixed(6)), [0.944444, 0.972222, 1], 'normalised in the crop');
    await op(page, 1, 0, 'scale', 'abc');
    assert.equal(await page.inputValue('#fig1List .fig-ser >> nth=0 >> [data-op="scale"]'), '2', 'a value refused, the field set back');

    // + Bar: categories from the x, a series of each file side by side.
    await addCard(page, 'bar');
    await addSeries(page, 2, 'Sig A'); await addSeries(page, 2, 'file 2, series 1');
    const bars = await stored(page, 2, 'barpx');
    assert.equal(bars.length, 13, '6 bars of A and 7 of B');
    assert.deepEqual([...new Set(bars.map(b=> b.label))], ['Sig A', 'file 2, series 1']);
    assert.deepEqual((await stored(page, 2, 'ticklabel')).map(t=> t.text), ['1', '2', '3', '4', '5', '6', '7']);
    assert.ok((await stored(page, 2, 'errbar')).length >= 13, 'the error bars');
    // + Box: each series a group, named as it.
    await addCard(page, 'box');
    await addSeries(page, 3, 'Ref'); await addSeries(page, 3, 'file 2, series 1');
    const boxes = await stored(page, 3, 'box');
    assert.deepEqual(boxes.map(b=> b.label), ['Ref', 'file 2, series 1']);
    assert.equal(boxes[1].med, 9);
    await op(page, 3, 1, 'scale', '10');
    assert.equal((await stored(page, 3, 'box'))[1].med, 90);
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
    assert.deepEqual((await stored(page, 1, 'line')).map(l=> l.ys.length), [6, 3]);
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
    assert.equal(await page.inputValue('#figFileSel'), '1', 'the file it showed');
    assert.equal((await stored(page, 3, 'box'))[1].med, 90);

    // A file removed: its series leave the plots, the others' numbers follow.
    await page.click('#figFileTableWrap tr.file-row:nth-child(1) .row-del'); await settle(page);
    assert.deepEqual(await cardSeries(page), [['b.csv#1'], ['b.csv#1'], ['b.csv#1']]);
    assert.deepEqual((await stored(page, 1, 'line')).map(l=> l.label), ['file 1, series 1']);
    await undo(page);
    assert.deepEqual(await cardSeries(page), S.cards.map(c=> c.series.map(r=> `${r.file}#${r.col}`)));
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
