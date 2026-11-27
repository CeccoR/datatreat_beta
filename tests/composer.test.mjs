/* The figure composer, of either kind: a plot's (from its toolbar) and an SEM group's.
   It opens, exports an SVG and a PNG (read back: an svg element with the drawing in it, a
   PNG of the size its footer says), takes the focus (Enter does not press the button
   behind), refuses a second composer of either kind while one is open (the first stays
   usable), and closes on Escape with the focus back on the button that opened it. A plot's
   stays responsive with a tick step far too fine for its values (v566). */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start, openModule, loadFiles, download, settle, keep } from './helpers.mjs';

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

/* A Y step by hand far too fine for its values: 1e14 in steps of 10, the grid's minors on. To
   v565 the minors were walked to for ever and the tab hung; now the page answers at once and
   the axis keeps its automatic ticks (figure-layout.js MAX_TICKS), while a step that fits, on
   X, is followed. */
test('plots composer: a tick step too fine for its values leaves the page responsive', async ()=>{
  const { page, errors, csp, close } = await env.page();
  try {
    await page.evaluate(async ()=>{
      const f = await import('./figure.js');
      const xs = Array.from({ length: 20 }, (_, i)=> i);
      f.openFigureEditor({ _stored: [{ type: 'line', xs, ys: xs.map(x=> 1e14 + x * 3e12), label: 'big', color: '#3aa0ff' }] }, { name: 'big' });
    });
    await page.waitForSelector('.fig-backdrop .fig-svg path');
    const drawn = ()=> page.evaluate(()=> document.querySelector('.fig-backdrop .fig-svg').innerHTML);
    const step = async (k, v)=>{
      await page.click(`.fig-backdrop input[data-k="${k}Auto"]`);
      const field = page.locator(`.fig-backdrop input[data-k="${k}"]`);
      await field.fill(v);
      await field.press('Enter', { timeout: 10000 });
      assert.equal(await field.inputValue({ timeout: 10000 }), v);
    };
    await page.click('.fig-backdrop input[data-g="y"]');
    await page.click('.fig-backdrop input[data-g="minor"]');
    const auto = await drawn();
    await step('yStep', '10');
    assert.equal(await drawn(), auto, 'the automatic ticks');
    await step('xStep', '2');
    assert.notEqual(await drawn(), auto, 'a step that fits followed');
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
