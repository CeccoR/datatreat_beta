/* The figure composer, of either kind: a plot's (from its toolbar) and an SEM group's.
   It opens, exports an SVG and a PNG (read back: an svg element with the drawing in it, a
   PNG of the size its footer says), takes the focus (Enter does not press the button
   behind), refuses a second composer of either kind while one is open (the first stays
   usable), and closes on Escape with the focus back on the button that opened it. A plot's
   stays responsive with a tick step far too fine for its values (v566), and refuses an edit
   that would leave a setting by hand out of its ticks, keeping one the data alone stop
   fitting, with a note (v580). Its width for every series takes what each series' own field
   takes (v569, v570), bars saved wider than their slot open at 1 (v570), lines saved thinner
   than 0.2 at 0.2 (v571), and its grips and the colour picker take a mouse's primary button
   alone (v570); an export that fails says why in a compact error in its footer (v571). Its
   presets are kept by the names typed as any other name, __proto__ and constructor too (v582). */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start, openModule, loadFiles, download, settle, keep } from './helpers.mjs';
import { gcCsv } from './fixtures.mjs';

let env;
before(async ()=>{ env = await start(); });
after(()=> env && env.close());

const backdrops = page => page.locator('.fig-backdrop').count();
const png = buf => (assert.ok(buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'a PNG signature'), [buf.readUInt32BE(16), buf.readUInt32BE(20)]);
// A second composer asked for, of each kind, while one is open: both refused (null).
const second = page => page.evaluate(async ()=>{
  const f = await import('./figure.js'), s = await import('./sem-figure.js');
  const a = f.openFigureEditor({ _stored: [] }, { name: 'intruder' });
  const b = s.openSemFigure({ title: 'x', images: ()=> [], getFig: ()=> null, setFig: ()=>{} });
  return [a, b].map(x=> x === null ? 'null' : typeof x);
});
/* Enter right after the composer opens: the focus has gone into the modal, so the button
   behind it, which the click left focused, is not pressed again (two composers open at
   once, the first with no way to close, to v480). */
async function enterBehind(page){
  assert.ok(await page.evaluate(()=> !!(document.activeElement && document.activeElement.closest('.fig-backdrop'))), 'the focus in the modal');
  await page.keyboard.press('Enter');
  await settle(page);
  assert.equal(await backdrops(page), 1);
}
async function exportBoth(page, name){
  const svg = await download(page, ()=> page.click('.fig-backdrop [data-fig-svg]'));
  assert.match(svg.name, /\.svg$/);
  const text = svg.buf.toString('utf8');
  keep(`composer/${name}.svg`, text);
  assert.match(text, /^(<\?xml[^>]*>\s*)?<svg[\s>]/, 'an svg document');
  assert.ok(/<(path|image|polyline|line)\b/.test(text), 'something drawn in it');
  assert.doesNotMatch(text, /data-x|<script/i);
  const p = await download(page, ()=> page.click('.fig-backdrop [data-fig-png]'), 60000);
  assert.match(p.name, /\.png$/);
  const [w, h] = png(p.buf);
  const dim = await page.textContent('.fig-backdrop .fig-dim');
  assert.ok(dim.includes(`${w} × ${h}`) || dim.includes(`${w}×${h}`) || dim.includes(`${w} x ${h}`), `PNG ${w}×${h}, footer says "${dim}"`);
}

test('plots composer: opens, exports SVG and PNG, refuses a second, closes on Escape', async ()=>{
  const { page, errors, csp, close } = await env.page();
  try {
    await openModule(page, 'gc');
    await loadFiles(page, 'gc', env.fx.files.gc);
    const btn = page.locator('button[title="Figure composer (advanced export)"]:visible').first();
    await btn.click();
    await page.waitForSelector('.fig-backdrop .fig-svg path');
    assert.equal(await backdrops(page), 1);
    await enterBehind(page);
    await exportBoth(page, 'gc-plot');
    assert.deepEqual(await second(page), ['null', 'null']);
    assert.equal(await backdrops(page), 1);
    // The open one still works: a width typed in shows in its footer.
    const w = page.locator('.fig-backdrop .fig-controls input[data-k="wmm"]');
    await w.fill('120'); await w.press('Enter');
    await page.waitForFunction(()=> /120/.test(document.querySelector('.fig-backdrop .fig-dim').textContent));
    await page.keyboard.press('Escape');
    await page.waitForFunction(()=> !document.querySelector('.fig-backdrop'));
    assert.ok(await page.evaluate(()=> document.activeElement && document.activeElement.title === 'Figure composer (advanced export)'), 'focus back on the button');
    assert.deepEqual(errors, []);
    assert.deepEqual(await csp(), []);
  } finally { await close(); }
});

/* The composer on a plot of one line, made up (xs 0–19; ys as given), its figure's markup,
   the floating rule of a refused field (utils.js flashFieldInvalid) and a field's text. */
async function composeLine(page, ys){
  await page.evaluate(ys=> import('./figure.js').then(f=>{
    const xs = ys.map((_, i)=> i);
    f.openFigureEditor({ _stored: [{ type: 'line', xs, ys, label: 'line', color: '#3aa0ff' }] }, { name: 'line' });
  }), ys);
  await page.waitForSelector('.fig-backdrop .fig-svg path');
}
const drawnFig = page => page.evaluate(()=> document.querySelector('.fig-backdrop .fig-svg').innerHTML);
// The figure's words, its tick numbers among them.
const tickLabels = page => page.evaluate(()=> [...document.querySelectorAll('.fig-backdrop .fig-svg text')].map(t=> t.textContent));
const floatRule = page => page.evaluate(()=> { const r = document.querySelector('.field-rule-float'); return r ? r.textContent : null; });
const shown = (page, at)=> page.locator(`.fig-backdrop input[${at}]`).inputValue();
/* A control brought into view first, its scroll's event let go by: a scroll closes the
   floating rule (utils.js flashFieldInvalid), and one Playwright makes as it clicks comes
   after the click's handler has put the rule up. */
async function inView(page, el){
  await el.scrollIntoViewIfNeeded();
  await settle(page);
  return el;
}
// A number typed into a field and committed with Enter (bounded: to v565 the tab hung there);
// then a pause past the history's 250 ms, so that each edit is a step of its own.
async function commitNum(page, at, v){
  const f = await inView(page, page.locator(`.fig-backdrop input[${at}]`));
  await f.fill(v);
  await f.press('Enter', { timeout: 10000 });
  await settle(page);
  await page.waitForTimeout(300);
}
// A checkbox or a button clicked (a series' own checkbox, drawn as an icon, by its label).
async function tick(page, at, tag = 'input'){
  const box = page.locator(`.fig-backdrop ${tag}[${at}]`);
  await (await inView(page, (await box.isVisible()) ? box : box.locator('xpath=..'))).click();
  await settle(page);
  await page.waitForTimeout(300);
}
const ys20 = Array.from({ length: 20 }, (_, i)=> i);
const NOTE = '⚠ Y step 10: too many ticks for this range: the automatic ticks drawn.';

/* A Y step by hand far too fine for its values: 1e14 in steps of 10, the grid's minors on. To
   v565 the minors were walked to for ever and the tab hung; v566 took the step and drew the
   automatic ticks; from v580 the step is refused (figure-layout.js tickFaults): the field goes
   back to the step it opened on (the automatic one drawn, 2e13), why under it, the figure's
   ticks as they were, the page answering at once; a step that fits, on X, is followed. */
test('plots composer: a tick step too fine for its values refused at once, the automatic ticks kept (v566, v580)', async ()=>{
  const { page, errors, csp, close } = await env.page();
  try {
    await composeLine(page, ys20.map(x=> 1e14 + x * 3e12));
    await tick(page, 'data-g="y"');
    await tick(page, 'data-g="minor"');
    const auto = await tickLabels(page);
    await tick(page, 'data-k="yStepAuto"');
    await commitNum(page, 'data-k="yStep"', '10');
    assert.equal(await shown(page, 'data-k="yStep"'), '20000000000000', 'the step before: the automatic one');
    assert.equal(await floatRule(page), 'Too many Y ticks for this range: 10 not taken; 20000000000000 kept.');
    assert.deepEqual(await tickLabels(page), auto, 'the ticks as they were');
    await tick(page, 'data-k="xStepAuto"');
    await commitNum(page, 'data-k="xStep"', '2');
    assert.equal(await shown(page, 'data-k="xStep"'), '2');
    assert.notDeepEqual(await tickLabels(page), auto, 'a step that fits followed');
    assert.deepEqual(errors, []);
    assert.deepEqual(await csp(), []);
  } finally { await close(); }
});

/* v580: a step by hand too dense for its range goes back to the step by hand before it (to
   v579 the axis drew its automatic ticks and kept the step typed), as does one whose ticks
   coincide at their values; the history has no step for it: Ctrl+Z takes back the step
   before, Ctrl+Y brings it back. */
test('plots composer: a step too dense refused, the step by hand before kept, no step in the history (v580)', async ()=>{
  const { page, errors, csp, close } = await env.page();
  try {
    await composeLine(page, ys20);
    await tick(page, 'data-k="yStepAuto"');
    await commitNum(page, 'data-k="yStep"', '0.1');
    const fits = await drawnFig(page);
    await commitNum(page, 'data-k="yStep"', '0.001');
    assert.equal(await shown(page, 'data-k="yStep"'), '0.1');
    assert.equal(await floatRule(page), 'Too many Y ticks for this range: 0.001 not taken; 0.1 kept.');
    assert.equal(await drawnFig(page), fits, 'the step before drawn');
    await page.keyboard.press('Control+z'); await settle(page);
    assert.equal(await shown(page, 'data-k="yStep"'), '5', 'Ctrl+Z: the step before 0.1, the automatic one handed over');
    await page.keyboard.press('Control+y'); await settle(page);
    assert.equal(await shown(page, 'data-k="yStep"'), '0.1', 'Ctrl+Y: 0.1 again');
    assert.equal(await drawnFig(page), fits);
    // ticks that coincide at their values: a range by hand of 1e9 to 1e9 + 1 (set with the
    // automatic step, 0.2), a step of 0.005 (twelve digits there: a hundredth)
    await tick(page, 'data-k="yStepAuto"');
    await tick(page, 'data-rauto="y"');
    await commitNum(page, 'data-k="ymax"', '1000000001');
    await commitNum(page, 'data-k="ymin"', '1000000000');
    await tick(page, 'data-k="yStepAuto"');
    assert.equal(await shown(page, 'data-k="yStep"'), '0.2');
    await commitNum(page, 'data-k="yStep"', '0.005');
    assert.equal(await shown(page, 'data-k="yStep"'), '0.2', 'the automatic step handed over kept');
    assert.equal(await floatRule(page), 'Y ticks too close to tell apart at these values: 0.005 not taken; 0.2 kept.');
    assert.deepEqual(errors, []);
    assert.deepEqual(await csp(), []);
  } finally { await close(); }
});

/* v580: a bound of a range by hand that would make the step by hand too dense, refused, the
   bound before kept; one that fits taken (to v579 both taken, the automatic ticks drawn). */
test('plots composer: a bound too wide for the step by hand refused, one that fits taken (v580)', async ()=>{
  const { page, errors, csp, close } = await env.page();
  try {
    await composeLine(page, ys20);
    await tick(page, 'data-k="yStepAuto"');
    await commitNum(page, 'data-k="yStep"', '0.1');
    await tick(page, 'data-rauto="y"');
    assert.deepEqual([await shown(page, 'data-k="ymin"'), await shown(page, 'data-k="ymax"')], ['-0.95', '19.95']);
    await commitNum(page, 'data-k="ymax"', '1e11');
    assert.equal(await shown(page, 'data-k="ymax"'), '19.95');
    assert.equal(await floatRule(page), 'Too many Y ticks for this range: 1e11 not taken; 19.95 kept.');
    await commitNum(page, 'data-k="ymax"', '30');
    assert.equal(await shown(page, 'data-k="ymax"'), '30', 'a bound the step fits taken');
    assert.equal(await page.locator('.fig-backdrop .fig-ticknote').innerHTML(), '', 'no note: no setting by hand left out');
    assert.deepEqual(errors, []);
    assert.deepEqual(await csp(), []);
  } finally { await close(); }
});

/* v580: the automatic step's switch unticked opens the field on the step drawn, as the
   minors' count and the range do (to v579 on the step kept, 0 the first time: the field said
   0 over the automatic ticks); the ticks stay as they were. On a log axis: 1 decade. */
test('plots composer: the automatic step unticked opens the field on the step drawn (v580)', async ()=>{
  const { page, errors, csp, close } = await env.page();
  try {
    await composeLine(page, ys20);
    const autoStep = ax => page.locator(`.fig-backdrop .fig-row:has-text("${ax} major step") input[disabled]`).inputValue();
    assert.deepEqual([await autoStep('X'), await autoStep('Y')], ['5', '5']);
    const before = await tickLabels(page);
    await tick(page, 'data-k="yStepAuto"');
    await tick(page, 'data-k="xStepAuto"');
    assert.deepEqual([await shown(page, 'data-k="xStep"'), await shown(page, 'data-k="yStep"')], ['5', '5']);
    assert.deepEqual(await tickLabels(page), before, 'the ticks as they were');
    // with a range by hand, the step its automatic ticks were drawn at
    await tick(page, 'data-k="yStepAuto"');
    await tick(page, 'data-rauto="y"');
    await commitNum(page, 'data-k="ymax"', '1000');
    assert.equal(await autoStep('Y'), '200');
    await tick(page, 'data-k="yStepAuto"');
    assert.equal(await shown(page, 'data-k="yStep"'), '200');
    // a log axis: its decades, one per major
    await tick(page, 'data-k="xStepAuto"');
    await tick(page, 'data-k="yStepAuto"');
    await tick(page, 'data-k="yLog"');
    await tick(page, 'data-k="yStepAuto"');
    assert.equal(await shown(page, 'data-k="yStep"'), '1');
    assert.deepEqual(errors, []);
    assert.deepEqual(await csp(), []);
  } finally { await close(); }
});

/* v580: a range by hand's min at or above its max is refused (to v579 taken, the axis drawn
   with one tick or none): the bound before kept, the flash and why under the field, no step in
   the history; the figure's shared range and a panel's own alike. */
test('plots composer: a range\'s min at or above its max refused, the bound before kept, no step in the history (v580)', async ()=>{
  const { page, errors, csp, close } = await env.page();
  try {
    await composeLine(page, ys20);
    await tick(page, 'data-rauto="y"');
    const fig = await drawnFig(page);
    await commitNum(page, 'data-k="ymin"', '50');
    assert.equal(await shown(page, 'data-k="ymin"'), '-0.95');
    assert.equal(await floatRule(page), 'Y min must be below max: 50 not taken; -0.95 kept.');
    await commitNum(page, 'data-k="ymax"', '-5');
    assert.equal(await shown(page, 'data-k="ymax"'), '19.95');
    assert.equal(await floatRule(page), 'Y max must be above min: -5 not taken; 19.95 kept.');
    assert.equal(await drawnFig(page), fig, 'the figure as it was');
    // a panel's own range, the X one: sharing off, its range by hand
    await tick(page, 'data-k="shareX"');
    await tick(page, 'data-rauto="x"');
    await commitNum(page, 'data-man="xMan"][data-end="1"', '-3');
    assert.equal(await shown(page, 'data-man="xMan"][data-end="1"'), '19');
    assert.equal(await floatRule(page), 'X max must be above min: -3 not taken; 19 kept.');
    // the history: Ctrl+Z takes back the last step taken, the panel's range by hand
    await page.keyboard.press('Control+z'); await settle(page);
    assert.equal(await page.locator('.fig-backdrop input[data-rauto="x"]').isChecked(), true, 'Ctrl+Z: the X range automatic again');
    assert.deepEqual(errors, []);
    assert.deepEqual(await csp(), []);
  } finally { await close(); }
});

/* v580: a preset is applied but for the axis settings it would leave out of the ticks: a
   preset made on values up to 19 with a Y step of 0.1 and the Y grid on, applied to values
   a thousand times higher, gives the grid and leaves the step automatic, its switch flashed
   with why under it (to v579 the step taken, the automatic ticks drawn and a note); one step
   in the history, the preset's. */
test('plots composer: a preset whose step does not fit applied but for the step, kept as it was (v580)', async ()=>{
  const { page, errors, csp, close } = await env.page();
  try {
    await composeLine(page, ys20);
    await tick(page, 'data-k="yStepAuto"');
    await commitNum(page, 'data-k="yStep"', '0.1');
    await tick(page, 'data-g="y"');
    await page.fill('.fig-backdrop [data-preset="name"]', 'dense');
    await page.click('.fig-backdrop [data-preset="saveas"]');
    await closeComposer(page);
    await composeLine(page, ys20.map(x=> x * 1000));
    assert.equal(await page.locator('.fig-backdrop input[data-g="y"]').isChecked(), false);
    await page.selectOption('.fig-backdrop [data-preset="load"]', 'dense');
    await settle(page);
    assert.equal(await page.locator('.fig-backdrop input[data-g="y"]').isChecked(), true, 'the rest of the preset taken');
    assert.equal(await page.locator('.fig-backdrop input[data-k="yStepAuto"]').isChecked(), true, 'the step automatic, as it was');
    assert.equal(await floatRule(page), 'Too many Y ticks for this range: the preset\'s step 0.1 not taken; the automatic step kept.');
    assert.equal(await page.locator('.fig-backdrop .fig-ticknote').innerHTML(), '', 'no note: nothing by hand left out');
    await page.waitForTimeout(300);
    await page.keyboard.press('Control+z'); await settle(page);
    assert.equal(await page.locator('.fig-backdrop input[data-g="y"]').isChecked(), false, 'Ctrl+Z: the preset taken back');
    assert.equal(await page.locator('.fig-backdrop input[data-k="yStepAuto"]').isChecked(), true);
    assert.deepEqual(errors, []);
    assert.deepEqual(await csp(), []);
  } finally { await close(); }
});

/* v582: the presets are kept by the names typed, read and written as own keys (db.js own,
   setOwn): one named __proto__ is saved, listed and applied as any other (to v581 it set the
   list's prototype, lost on saving); one named constructor deleted on another plot is no longer
   the plot's preset when it opens again (to v581 the list's prototype's constructor read for it,
   its Save and Delete still on). */
test('plots composer: presets named __proto__ and constructor kept, listed, applied and deleted as any other (v582)', async ()=>{
  const { page, errors, csp, close } = await env.page();
  try {
    const presets = ()=> page.evaluate(()=>{ const o = JSON.parse(localStorage.getItem('dt-figure-presets')); return [Object.keys(o).sort(), Object.getPrototypeOf(o) === Object.prototype]; });
    const bar = ()=> page.evaluate(()=>{ const q = s => document.querySelector(`.fig-backdrop [data-preset="${s}"]`); return [[...q('load').options].map(o=> o.value), q('load').value, q('save').disabled, q('del').disabled]; });
    await composeLine(page, ys20);
    await tick(page, 'data-g="y"');
    for (const name of ['__proto__', 'constructor']){
      await page.fill('.fig-backdrop [data-preset="name"]', name);
      await page.click('.fig-backdrop [data-preset="saveas"]'); await settle(page);
    }
    assert.deepEqual(await presets(), [['__proto__', 'constructor'], true], 'both saved, the list\'s prototype untouched');
    assert.deepEqual(await bar(), [['', '__proto__', 'constructor'], 'constructor', false, false]);
    await closeComposer(page);
    // Another plot: __proto__ applied; constructor deleted.
    await page.evaluate(()=> import('./figure.js').then(f=> f.openFigureEditor({ _stored: [{ type: 'line', xs: [0, 1, 2], ys: [1, 3, 2], label: 'other', color: '#3aa0ff' }] }, { name: 'other' })));
    await page.waitForSelector('.fig-backdrop .fig-svg path');
    assert.equal(await page.locator('.fig-backdrop input[data-g="y"]').isChecked(), false);
    await page.selectOption('.fig-backdrop [data-preset="load"]', '__proto__'); await settle(page);
    assert.deepEqual([await page.locator('.fig-backdrop input[data-g="y"]').isChecked(), (await bar()).slice(1)], [true, ['__proto__', false, false]], '__proto__ applied');
    await page.selectOption('.fig-backdrop [data-preset="load"]', 'constructor'); await settle(page);
    await page.click('.fig-backdrop [data-preset="del"]'); await settle(page);
    assert.deepEqual(await presets(), [['__proto__'], true]);
    await closeComposer(page);
    // The first plot again, left on constructor: no preset now.
    await composeLine(page, ys20);
    assert.deepEqual(await bar(), [['', '__proto__'], '', true, true], 'constructor gone: none');
    assert.deepEqual(errors, []);
    assert.deepEqual(await csp(), []);
  } finally { await close(); }
});

/* v580: any other edit that would leave a step by hand out is refused the same way: the Y log
   switch going off with a step of 2 (decades per major, then a linear step on values up to
   1e6), the Y range shared again and a panel removed, each bringing a series of 3000–4000
   into a range a Y step of 10 fits in each panel alone (to v579 each taken, the automatic
   ticks drawn). */
test('plots composer: the log switch, sharing and a panel removed refused where they would leave the step by hand out (v580)', async ()=>{
  const { page, errors, csp, close } = await env.page();
  try {
    await composeLine(page, ys20.map(x=> 1 + x * 5e4));
    await tick(page, 'data-k="yLog"');
    await tick(page, 'data-k="yStepAuto"');
    await commitNum(page, 'data-k="yStep"', '2');
    const log = await drawnFig(page);
    await tick(page, 'data-k="yLog"');
    assert.equal(await page.locator('.fig-backdrop input[data-k="yLog"]').isChecked(), true, 'still logarithmic');
    assert.equal(await floatRule(page), 'Too many Y ticks for this range: left ticked.');
    assert.equal(await drawnFig(page), log);
    await closeComposer(page);
    // two series, each in a panel of its own, the Y range not shared
    await page.evaluate(()=> import('./figure.js').then(f=>{
      const xs = Array.from({ length: 20 }, (_, i)=> i);
      f.openFigureEditor({ _stored: [{ type: 'line', xs, ys: xs.map(x=> x / 2), label: 'low', color: '#3aa0ff' },
                                     { type: 'line', xs, ys: xs.map(x=> 3000 + x * 50), label: 'high', color: '#d62728' }] }, { name: 'two' });
    }));
    await page.waitForSelector('.fig-backdrop .fig-svg path');
    await tick(page, 'data-k="shareY"');
    await tick(page, 'data-add-panel', 'button');
    // the step opened on the second panel's automatic one (200), which the first's range fits too
    await page.selectOption('.fig-backdrop select[data-k="yPanel"]', '1');
    await settle(page);
    await tick(page, 'data-k="yStepAuto"');
    assert.equal(await shown(page, 'data-k="yStep"'), '200');
    await commitNum(page, 'data-k="yStep"', '10');
    assert.equal(await shown(page, 'data-k="yStep"'), '10', 'each panel\'s range fits it');
    const two = await drawnFig(page);
    await tick(page, 'data-k="shareY"');
    assert.equal(await page.locator('.fig-backdrop input[data-k="shareY"]').isChecked(), false, 'not shared');
    assert.equal(await floatRule(page), 'Too many Y ticks for this range: left unticked.');
    await tick(page, 'data-del-panel="1"', 'button');
    assert.equal(await page.locator('.fig-backdrop .fig-panel').count(), 2, 'the panel kept');
    assert.equal(await floatRule(page), 'Too many Y ticks for this range: the panel kept.');
    assert.equal(await drawnFig(page), two);
    assert.deepEqual(errors, []);
    assert.deepEqual(await csp(), []);
  } finally { await close(); }
});

/* v580: a step by hand that the data alone stops fitting (GC's rates: a step of 10 fits one
   file's, a hundred times higher with a file added) is kept: the plot's memory gives it back
   as it was, the axis drawn with its automatic ticks and a note under the Ticks saying so;
   the added file's series hidden, the range fits it again: drawn, the note gone; shown again
   by hand, an edit: refused. Closed, the memory still holds the step. */
test('plots composer: a step by hand the data no longer fits kept and noted, drawn again once it fits (v580)', async ()=>{
  const { page, errors, csp, close } = await env.page();
  try {
    await openModule(page, 'gc');
    await loadFiles(page, 'gc', [env.fx.files.gc[0]]);
    await composeGc(page, 'Svg1');
    await tick(page, 'data-k="yStepAuto"');
    await commitNum(page, 'data-k="yStep"', '10');
    assert.equal(await shown(page, 'data-k="yStep"'), '10');
    await closeComposer(page);
    await loadFiles(page, 'gc', [env.fx.put('high.csv', gcCsv({ h2: [5, 12], seed: 9 }))]);
    await composeGc(page, 'Svg1');
    assert.equal(await page.locator('.fig-backdrop input[data-k="yStepAuto"]').isChecked(), false);
    assert.equal(await shown(page, 'data-k="yStep"'), '10', 'the step kept');
    assert.equal(await page.textContent('.fig-backdrop .fig-ticknote .alert.warn.compact'), NOTE);
    const auto = await drawnFig(page);
    // the added file's series hidden: the step fits the range again
    const high = await page.locator('.fig-backdrop input[data-sk="label"]').evaluateAll(xs=> xs.map(x=> +x.dataset.s).filter((_, i)=> /high/.test(xs[i].value)));
    assert.ok(high.length >= 1, 'the added file among the series');
    for (const s of high) await tick(page, `data-sk="show"][data-s="${s}"`);
    assert.equal(await page.locator('.fig-backdrop .fig-ticknote').innerHTML(), '', 'the note gone');
    const fits = await drawnFig(page);
    assert.notEqual(fits, auto, 'the step drawn');
    // shown again by hand, an edit that would leave the step out: refused
    await tick(page, `data-sk="show"][data-s="${high[0]}"`);
    assert.equal(await page.locator(`.fig-backdrop input[data-sk="show"][data-s="${high[0]}"]`).isChecked(), false);
    assert.equal(await floatRule(page), 'Too many Y ticks for this range: left unticked.');
    assert.equal(await drawnFig(page), fits);
    await closeComposer(page);
    const kept = await page.evaluate(()=> Object.values(JSON.parse(localStorage.getItem('dt-figure-memory'))).map(m=> [m.scalars.yStepAuto, m.scalars.yStep]));
    assert.deepEqual(kept, [[false, 10]]);
    assert.deepEqual(errors, []);
    assert.deepEqual(await csp(), []);
  } finally { await close(); }
});

/* The width for every series (v569): with bars among the series it takes a bar's range, at
   most 1 (a fraction of the category slot), as each bar's own field does; to v568 a line's,
   up to 6: 3 set every bar three slots wide, and each bar's field then showed a value it would
   refuse. With lines alone, up to 6 as before. GC's mean-rate bars and its rates over time. */
test('plots composer: the width for every series, at most a bar\'s 1 where there are bars; a line\'s 6 with lines alone (v569)', async ()=>{
  const { page, errors, csp, close } = await env.page();
  try {
    await openModule(page, 'gc');
    await loadFiles(page, 'gc', env.fx.files.gc);
    const compose = async svg =>{
      await page.locator(`#tab-gc svg[id$="${svg}"]`).first().scrollIntoViewIfNeeded();
      await page.locator(`#tab-gc svg[id$="${svg}"]`).first().locator('xpath=ancestor::div[contains(@class,"plot-wrap")]').locator('button[title="Figure composer (advanced export)"]').click();
      await page.waitForSelector('.fig-backdrop input[data-all="width"]');
    };
    const all = ()=> page.locator('.fig-backdrop input[data-all="width"]');
    const own = ()=> page.locator('.fig-backdrop input[data-sk="width"]').evaluateAll(xs=> xs.map(x=> x.value));
    const type = async v =>{ await all().fill(v); await all().press('Enter'); await settle(page); };
    await compose('SvgBar');
    assert.equal(await all().getAttribute('data-max'), '1');
    const was = await own();
    assert.ok(was.length >= 2, String(was));
    await type('3');
    assert.deepEqual(await own(), was, '3 refused: every bar as it was');
    await type('0.5');
    assert.deepEqual(await own(), was.map(()=> '0.5'), 'within a bar\'s range: every bar\'s');
    await type('1');
    assert.deepEqual(await own(), was.map(()=> '1'));
    await page.keyboard.press('Escape');
    await page.waitForFunction(()=> !document.querySelector('.fig-backdrop'));
    // Lines alone: up to 6, as each line's own field.
    await compose('Svg1');
    assert.equal(await all().getAttribute('data-max'), '6');
    await type('3');
    assert.ok((await own()).every(v=> v === '3'), 'lines: 3 taken');
    await page.keyboard.press('Escape');
    assert.deepEqual(errors, []);
    assert.deepEqual(await csp(), []);
  } finally { await close(); }
});

// GC's plot whose id ends in `svg` opened in the composer (its field for every series there).
async function composeGc(page, svg){
  const plot = page.locator(`#tab-gc svg[id$="${svg}"]`).first();
  await plot.scrollIntoViewIfNeeded();
  await plot.locator('xpath=ancestor::div[contains(@class,"plot-wrap")]').locator('button[title="Figure composer (advanced export)"]').click();
  await page.waitForSelector('.fig-backdrop input[data-all="width"]');
}
const closeComposer = async page =>{ await page.keyboard.press('Escape'); await page.waitForFunction(()=> !document.querySelector('.fig-backdrop')); };
const ownWidths = page => page.locator('.fig-backdrop input[data-sk="width"]').evaluateAll(xs=> xs.map(x=> x.value));
async function typeAll(page, v){
  const all = page.locator('.fig-backdrop input[data-all="width"]');
  await all.fill(v); await all.press('Enter'); await settle(page);
}

/* v570 (as the trace list's grips, v569): in the composer a series row's ≡ grip and a bar's
   (a sample dragged into another division) take a mouse's primary button alone: pressed with
   the right or the middle one and let go over another place, nothing lit, nothing moved (to
   v569 any button dragged them); the left one moves them. The colour picker's field and hue
   strip the same: the right or the middle button picks no colour (to v569 a press with either
   did). GC's rates over time (three lines) and mean-rate bars. */
test('plots composer: a series\' grip, a bar\'s grip and the colour picker take the left button alone (v570)', async ()=>{
  const { page, errors, csp, close } = await env.page();
  try {
    await openModule(page, 'gc');
    await loadFiles(page, 'gc', env.fx.files.gc);
    const lit = ()=> page.locator('.fig-backdrop .dragging, .fig-backdrop .drop-before, .fig-backdrop .drop-after, .fig-backdrop .drop-swap, .fig-backdrop .drag-into').count();
    // A press on `from` with `button`, moved over `to` (at 80 % of its height), let go: what
    // was lit meanwhile.
    const drag = async (from, to, button)=>{
      const a = await page.locator(from).boundingBox(), b = await page.locator(to).boundingBox();
      await page.mouse.move(a.x + a.width/2, a.y + a.height/2);
      await page.mouse.down({ button });
      await page.mouse.move(b.x + b.width/2, b.y + b.height*0.8, { steps: 8 });
      const n = await lit();
      await page.mouse.up({ button });
      await settle(page);
      return n;
    };
    // A series row: the first dragged under the last.
    await composeGc(page, 'Svg1');
    const labels = ()=> page.locator('.fig-backdrop .fig-serie[data-s] input[data-sk="label"]').evaluateAll(xs=> xs.map(x=> x.value));
    const n0 = await labels();
    assert.ok(n0.length >= 3, String(n0));
    const first = '.fig-backdrop .fig-serie[data-s="0"] .fig-grip', last = `.fig-backdrop .fig-serie[data-s="${n0.length - 1}"]`;
    for (const b of ['right', 'middle']){
      assert.equal(await drag(first, last, b), 0, `a series' grip, the ${b} button: nothing lit`);
      assert.deepEqual(await labels(), n0, `a series' grip, the ${b} button: the order as it was`);
    }
    assert.ok(await drag(first, last, 'left') > 0, 'the left button: lit');
    assert.deepEqual(await labels(), [...n0.slice(1), n0[0]], 'the left button: the first series last');
    // The colour picker on the first series' swatch: its field and its hue strip.
    const sw = page.locator('.fig-backdrop .color-swatch[data-sw="0"]');
    const c0 = await sw.getAttribute('data-color');
    await sw.click();
    await page.waitForSelector('.cp-popup .cp-map', { state: 'visible' });
    const press = async (sel, fx, button)=>{
      const r = await page.locator(sel).boundingBox();
      await page.mouse.move(r.x + r.width*fx, r.y + r.height*0.5);
      await page.mouse.down({ button }); await page.mouse.up({ button });
      await settle(page);
    };
    for (const b of ['right', 'middle']){
      await press('.cp-popup .cp-map', 0.3, b);
      await press('.cp-popup .cp-hue', 0.6, b);
      assert.equal(await sw.getAttribute('data-color'), c0, `the colour picker, the ${b} button: no colour picked`);
    }
    await press('.cp-popup .cp-map', 0.3, 'left');
    assert.notEqual(await sw.getAttribute('data-color'), c0, 'the left button: a colour picked');
    const c1 = await sw.getAttribute('data-color');
    await press('.cp-popup .cp-hue', 0.6, 'left');
    assert.notEqual(await sw.getAttribute('data-color'), c1, 'the hue, the left button: another');
    await sw.click();
    await page.waitForSelector('.cp-popup .cp-map', { state: 'hidden' });
    await closeComposer(page);
    // A bar: a division added, a sample dragged into it.
    await composeGc(page, 'SvgBar');
    const add = page.locator('.fig-backdrop [data-adddiv]').first(), i = await add.getAttribute('data-adddiv');
    await add.click(); await settle(page);
    const chip = `.fig-backdrop .fig-barrow[data-bar="${i}:0"]`, into = `.fig-backdrop .fig-dgroup[data-dg="${i}:1"]`;
    const inNew = ()=> page.locator(`${into} .fig-barrow[data-bar="${i}:0"]`).count();
    assert.equal(await inNew(), 0);
    for (const b of ['right', 'middle']){
      assert.equal(await drag(chip + ' .fig-grip', into, b), 0, `a bar's grip, the ${b} button: nothing lit`);
      assert.equal(await inNew(), 0, `a bar's grip, the ${b} button: in its division still`);
    }
    assert.ok(await drag(chip + ' .fig-grip', into, 'left') > 0);
    assert.equal(await inNew(), 1, 'the left button: in the new division');
    await closeComposer(page);
    assert.deepEqual(errors, []);
    assert.deepEqual(await csp(), []);
  } finally { await close(); }
});

/* v570: the width for every series takes what each series' own field takes, the meeting of
   their ranges: with lines alone from a line's 0.2 (to v569 from 0.1: 0.15 gave every line a
   width its own field refused), with bars alone from a bar's 0.1, with both 0.2 to 1. GC's
   lines and bars; a plot of a line and bars made up. */
test('plots composer: the width for every series takes what every series\' own field takes: 0.2–6 lines, 0.1–1 bars, 0.2–1 both (v570)', async ()=>{
  const { page, errors, csp, close } = await env.page();
  try {
    await openModule(page, 'gc');
    await loadFiles(page, 'gc', env.fx.files.gc);
    const range = ()=> page.locator('.fig-backdrop input[data-all="width"]').evaluate(x=> [x.dataset.min, x.dataset.max]);
    await composeGc(page, 'Svg1');
    assert.deepEqual(await range(), ['0.2', '6']);
    const was = await ownWidths(page);
    await typeAll(page, '0.15');
    assert.deepEqual(await ownWidths(page), was, 'lines: 0.15 refused, every line as it was');
    await typeAll(page, '0.2');
    assert.ok((await ownWidths(page)).every(v=> v === '0.2'), 'lines: 0.2 taken');
    await closeComposer(page);
    await composeGc(page, 'SvgBar');
    assert.deepEqual(await range(), ['0.1', '1']);
    await typeAll(page, '0.15');
    assert.ok((await ownWidths(page)).every(v=> v === '0.15'), 'bars: 0.15 taken');
    await closeComposer(page);
    // A line and bars.
    await page.evaluate(async ()=>{
      const f = await import('./figure.js');
      f.openFigureEditor({ xlabel: 'x', ylabel: 'y', _stored: [
        { type: 'ticklabel', xv: 1, text: 'a' }, { type: 'ticklabel', xv: 2, text: 'b' },
        { type: 'barpx', xc: 1, y1: 2, color: '#cc6633', label: 'bars' }, { type: 'barpx', xc: 2, y1: 3, color: '#cc6633', label: 'bars' },
        { type: 'line', xs: [1, 2], ys: [1, 2.5], color: '#3366cc', label: 'line', width: 1.5 },
      ] }, { name: 'mixed' });
    });
    await page.waitForSelector('.fig-backdrop input[data-all="width"]');
    assert.deepEqual(await range(), ['0.2', '1']);
    const w0 = await ownWidths(page);
    for (const v of ['0.15', '1.5']){ await typeAll(page, v); assert.deepEqual(await ownWidths(page), w0, `both: ${v} refused`); }
    await typeAll(page, '0.5');
    assert.deepEqual(await ownWidths(page), w0.map(()=> '0.5'), 'both: 0.5 taken');
    await closeComposer(page);
    assert.deepEqual(errors, []);
    assert.deepEqual(await csp(), []);
  } finally { await close(); }
});

/* v570: a figure saved up to v568 with bars wider than their slot (the field for every series
   took up to 6 there) opens with them at 1, the most a bar's own field takes, not at the width
   the field would refuse; one saved with a bar's width inside its range opens as it was. GC's
   mean-rate bars, the plot's memory of its figure as v568 could have written it. */
test('plots composer: bars saved wider than their slot (to v568) open at 1; a width inside the range as saved (v570)', async ()=>{
  const { page, errors, csp, close } = await env.page();
  try {
    await openModule(page, 'gc');
    await loadFiles(page, 'gc', env.fx.files.gc);
    await composeGc(page, 'SvgBar');
    const n = (await ownWidths(page)).length;
    assert.ok(n >= 2);
    await closeComposer(page);
    // The memory written as v568 could: one bar 3 wide, the other 0.6.
    const saved = ws => page.evaluate(ws=>{
      const all = JSON.parse(localStorage.getItem('dt-figure-memory'));
      const k = Object.keys(all).find(k=> all[k].series.some(e=> e.rest.kind === 'bar'));
      all[k].series.filter(e=> e.rest.kind === 'bar').forEach((e, j)=>{ e.rest.width = ws[j]; });
      localStorage.setItem('dt-figure-memory', JSON.stringify(all));
    }, ws);
    await saved([3, 0.6]);
    await composeGc(page, 'SvgBar');
    assert.deepEqual(await ownWidths(page), ['1', '0.6'], 'the bar 3 wide at 1, the other as saved');
    await closeComposer(page);
    await saved([0.8, 0.35]);
    await composeGc(page, 'SvgBar');
    assert.deepEqual(await ownWidths(page), ['0.8', '0.35'], 'widths inside the range: as saved');
    await closeComposer(page);
    assert.deepEqual(errors, []);
    assert.deepEqual(await csp(), []);
  } finally { await close(); }
});

/* v571 (v570's follow-up): lines saved with a width of 0.1–0.19, which the field for every
   series gave to v569, open at 0.2, the least a line's own field takes, not at a width that
   field would refuse; one inside 0.2–6 as saved. GC's rates over time (lines), the plot's
   memory of its figure as v569 could have written it. */
test('plots composer: lines saved thinner than 0.2 (to v569) open at 0.2; a width inside the range as saved (v571)', async ()=>{
  const { page, errors, csp, close } = await env.page();
  try {
    await openModule(page, 'gc');
    await loadFiles(page, 'gc', env.fx.files.gc);
    await composeGc(page, 'Svg1');
    const n = (await ownWidths(page)).length;
    assert.ok(n >= 3);
    await closeComposer(page);
    const saved = ws => page.evaluate(ws=>{
      const all = JSON.parse(localStorage.getItem('dt-figure-memory'));
      const k = Object.keys(all).find(k=> all[k].series.length && all[k].series.every(e=> e.rest.kind !== 'bar'));
      all[k].series.forEach((e, j)=>{ e.rest.width = ws[j % ws.length]; });
      localStorage.setItem('dt-figure-memory', JSON.stringify(all));
    }, ws);
    await saved([0.15, 0.1, 2.5]);
    await composeGc(page, 'Svg1');
    assert.deepEqual((await ownWidths(page)).slice(0, 3), ['0.2', '0.2', '2.5'], 'the lines under 0.2 at 0.2, the other as saved');
    await closeComposer(page);
    assert.deepEqual(errors, []);
    assert.deepEqual(await csp(), []);
  } finally { await close(); }
});

/* v571 (ALERTS-REVIEW.md C17): an export that fails (the browser making no PNG of the canvas)
   says why in the footer, a compact error (to v570 red text with no box), until the next
   export or drawing. */
test('plots composer: an export that fails says why, a compact error in the footer (v571)', async ()=>{
  const { page, errors, csp, close } = await env.page();
  try {
    await openModule(page, 'gc');
    await loadFiles(page, 'gc', env.fx.files.gc);
    await composeGc(page, 'Svg1');
    await page.evaluate(()=>{ HTMLCanvasElement.prototype.toBlob = function(cb){ cb(null); }; });
    await page.click('.fig-backdrop [data-fig-png]');
    await page.waitForSelector('.fig-backdrop .fig-msg:not([hidden]) .alert.bad.compact');
    assert.match(await page.textContent('.fig-backdrop .fig-msg'), /^✕ The browser could not make the PNG \(\d+ × \d+ px\): try a lower dpi\.$/);
    // (gone with the next drawing: a width typed)
    await typeAll(page, '2');
    assert.equal(await page.locator('.fig-backdrop .fig-msg').isHidden(), true);
    await closeComposer(page);
    assert.deepEqual(errors, []);
    assert.deepEqual(await csp(), []);
  } finally { await close(); }
});

test('SEM composer: opens on a group, exports SVG and PNG, refuses a second, closes on Escape', async ()=>{
  const { page, errors, csp, close } = await env.page();
  try {
    await openModule(page, 'sem');
    await loadFiles(page, 'sem', env.fx.files.sem);
    const btn = page.locator('#semGroups .sem-group-fig:not([disabled])').first();
    await btn.click();
    await page.waitForSelector('.fig-backdrop .fig-svg image');
    await settle(page);
    assert.equal(await backdrops(page), 1);
    await enterBehind(page);
    await exportBoth(page, 'sem-group');
    assert.deepEqual(await second(page), ['null', 'null']);
    assert.equal(await backdrops(page), 1);
    await page.keyboard.press('Escape');
    await page.waitForFunction(()=> !document.querySelector('.fig-backdrop'));
    assert.ok(await page.evaluate(()=> !!(document.activeElement && document.activeElement.matches('.sem-group-fig'))), 'focus back on the button');
    // Opened again after closing: it opens.
    await btn.click();
    await page.waitForSelector('.fig-backdrop');
    await page.keyboard.press('Escape');
    await page.waitForFunction(()=> !document.querySelector('.fig-backdrop'));
    assert.deepEqual(errors, []);
    assert.deepEqual(await csp(), []);
  } finally { await close(); }
});
