/* A short Rietveld refinement of the synthetic perovskite pattern with the SrTiO3 CIF
   (no instrumental standard: the question answered "Refine without the standard"), its
   result kept for that pattern alone; then Refine all on two patterns, cancelled: nothing
   more written, the button back to Refine, the module no longer busy. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start, openModule, loadFiles, banner, answer, moduleState, until, settle } from './helpers.mjs';

let env;
before(async ()=>{ env = await start(); });
after(()=> env && env.close());

const P = '#xrdR2';   // the default deck's second card, a Rietveld one
const resultsOf = async page => ((await moduleState(page, 'xrd')).cards.find(c=> c.id === 2) || {}).states?.rietveld?.results || {};
const results = async page => Object.keys(await resultsOf(page));
const busy = page => page.evaluate(async ()=> (await import('./utils.js')).moduleBusy('xrd'));
const label = page => page.textContent(P + 'Refine');

test('Rietveld: one pattern refined, then Refine all cancelled', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'xrd');
    await loadFiles(page, 'xrd', env.fx.files.xrd.slice(0, 2));
    await page.setInputFiles(P + 'CifInput', env.fx.cif);
    await page.waitForSelector(P + 'PhaseList input[data-on]');
    // Refine, on the pattern on show: asked about the standard first.
    await page.click(P + 'Refine');
    await page.waitForSelector('.pwa-confirm.show');
    assert.match((await banner(page)).text, /No instrumental standard is loaded/);
    await answer(page, 'alt');
    assert.equal(await label(page), 'Cancel');
    assert.match(await busy(page), /Rietveld/i);
    await page.waitForFunction(p=> document.querySelector(p + 'Refine').textContent === 'Refine', P, { timeout: 120000 });
    await settle(page);
    assert.deepEqual(await results(page), ['s00.xrdml'], 'one result, for the pattern on show');
    // s00 was made with a = 3.905 Å: the cell found again, and a fit of a sensible quality.
    const r = (await resultsOf(page))['s00.xrdml'];
    assert.ok(Math.abs(r.params['p1.a'] - 3.905) < 0.002, 'a = ' + r.params['p1.a']);
    assert.ok(r.stats.Rwp > 0 && r.stats.Rwp < 0.2, 'Rwp = ' + r.stats.Rwp);
    assert.equal(r.stats.N, 5384);
    assert.equal(await busy(page), null);
    // Refine all, cancelled while it runs.
    const before = await results(page);
    await page.waitForTimeout(700);   // (a press within 600 ms of the last is not taken: a double click)
    await page.click(P + 'RefineAll');
    await answer(page, 'alt');
    await until(async ()=> (await label(page)) === 'Cancel', { what: 'the run to start' });
    await page.waitForTimeout(700);
    await page.click(P + 'Refine');
    await until(async ()=> (await label(page)) === 'Refine', { what: 'the cancel' });
    const status = await page.textContent(P + 'Status');
    assert.match(status, /Stopped/);
    assert.equal(await busy(page), null);
    const after1 = await results(page);
    await page.waitForTimeout(1500);
    assert.deepEqual(await results(page), after1, 'nothing written after the cancel');
    assert.equal(await page.textContent(P + 'Status'), status);
    assert.ok(after1.length >= before.length);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
