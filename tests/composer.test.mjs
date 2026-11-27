/* The figure composer, of either kind: a plot's (from its toolbar) and an SEM group's.
   It opens, exports an SVG and a PNG (read back: an svg element with the drawing in it, a
   PNG of the size its footer says), takes the focus (Enter does not press the button
   behind), refuses a second composer of either kind while one is open (the first stays
   usable), and closes on Escape with the focus back on the button that opened it. A plot's
   stays responsive with a tick step far too fine for its values (v566). Its width for every
   series takes what each series' own field takes (v569, v570), bars saved wider than their
   slot open at 1 (v570), lines saved thinner than 0.2 at 0.2 (v571), and its grips and the
   colour picker take a mouse's primary button alone (v570); an export that fails says why in
   a compact error in its footer (v571). */
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
