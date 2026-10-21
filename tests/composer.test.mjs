/* The figure composer, of either kind: a plot's (from its toolbar) and an SEM group's.
   It opens, exports an SVG and a PNG (read back: an svg element with the drawing in it, a
   PNG of the size its footer says), takes the focus (Enter does not press the button
   behind), refuses a second composer of either kind while one is open (the first stays
   usable), and closes on Escape with the focus back on the button that opened it. */
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
