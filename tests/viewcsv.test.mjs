/* The CSVs never follow a selector of the view (v530). A chart's selector of what it draws is
   a view alone, no change unsaved (v528, viewdirty.test.mjs), so what is exported is the same
   whichever it shows: every option, side by side.
   - GC: the gas chips (H₂ / O₂, Analysis and Results): every CSV has every gas the samples
     have (to v529 the Results' choice alone);
   - XRPD: the size chart by sample / by peak, of a Scherrer card and of a Rietveld one: its
     CSV button gives both files (to v529 the one on show), the module's export the same;
   - DRS: the E_g chips (x-axis / baseline): Eg.csv has both readings (as it had).
   Each export taken whole (the project bar's CSV) and from the chart's own button, before
   and after the chips. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start, openModule, loadFiles, settle, moduleState, download, readZip, parseCsv } from './helpers.mjs';

let env;
before(async ()=>{ env = await start(); });
after(()=> env && env.close());

// A download's files by name: a zip's entries, or the one CSV.
const filesOf = d => d.name.endsWith('.zip')
  ? Object.fromEntries(readZip(d.buf).map(e=> [e.name, e.data.toString('utf8')]))
  : { [d.name]: d.buf.toString('utf8') };
const all = async page => filesOf(await download(page, ()=> page.click('.proj-csv')));
// The CSV button of the chart drawn in `svg` (its tool column built by attachTools), clicked
// as a person does (a click from a script is no gesture: the browser holds back a run of them).
async function chartCsv(page, svg){
  const wrap = page.locator(svg).locator('xpath=ancestor::div[contains(concat(" ", @class, " "), " plot-wrap ")][1]'), b = wrap.locator('.plot-csv-btn');
  await wrap.scrollIntoViewIfNeeded(); await wrap.hover();
  return filesOf(await download(page, ()=> b.click()));
}
const head = text => parseCsv(text.replace(/^﻿/, ''), ';')[0];
const chip = async (page, sel)=>{ await page.locator(sel).first().scrollIntoViewIfNeeded(); await page.locator(sel).first().click(); await settle(page); };

test('GC: every CSV has both gases, whichever the chips show', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'gc');
    await loadFiles(page, 'gc', env.fx.files.gc);
    const z0 = await all(page), c0 = await chartCsv(page, '#gc1SvgBar'), r0 = await chartCsv(page, '#gc1SvgRate');
    const name = k => Object.keys(z0).find(n=> n.endsWith(k));
    for (const k of ['gc_raw.csv', 'gc_results.csv', 'mean_rates.csv']){
      const h = head(z0[name(k)]).join('|');
      assert.match(h, /H2 /, k + ': H₂'); assert.match(h, /O2 /, k + ': O₂');
    }
    const sel = async ()=> (await moduleState(page, 'gc')).cards[0].gasSel;
    const s0 = await sel();
    // Each chip of each section: what the plots show changes, the CSVs not.
    for (const [sec, gas] of [['r', 'h2'], ['r', 'o2'], ['a', 'o2'], ['a', 'h2']]){
      await chip(page, `#tab-gc .gc-gas-chip[data-sec="${sec}"][data-gas="${gas}"]`);
      assert.deepEqual(await all(page), z0, `${sec} ${gas}: the export as it was`);
      assert.deepEqual(await chartCsv(page, '#gc1SvgBar'), c0, `${sec} ${gas}: mean_rates.csv as it was`);
      assert.deepEqual(await chartCsv(page, '#gc1SvgRate'), r0, `${sec} ${gas}: gc_results.csv as it was`);
    }
    assert.notDeepEqual(await sel(), s0, 'the chips changed what is shown');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('XRPD Scherrer: the size chart\'s CSV by sample and by peak, whichever it shows', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'xrd');
    await loadFiles(page, 'xrd', env.fx.files.xrd);
    const peak = '#xrdA1SizeBy [data-size-by="peak"]', sample = '#xrdA1SizeBy [data-size-by="sample"]';
    await page.waitForSelector(peak, { state: 'attached' });
    const z0 = await all(page), c0 = await chartCsv(page, '#xrdA1SizeBarSvg');
    assert.deepEqual(Object.keys(c0).map(n=> n.replace(/^.* - /, '')).sort(), ['crystallite_size.csv', 'crystallite_size_by_peak.csv']);
    for (const n in c0) assert.equal(c0[n], z0[n], n + ': as in the export');
    const by = async ()=> (await moduleState(page, 'xrd')).cards[0].states.scherrer.sizeBy;
    await chip(page, peak);
    assert.equal(await by(), 'peak');
    assert.deepEqual(await chartCsv(page, '#xrdA1SizeBarSvg'), c0, 'by peak: the same');
    assert.deepEqual(await all(page), z0, 'by peak: the export the same');
    await chip(page, sample);
    assert.equal(await by(), 'sample');
    assert.deepEqual(await chartCsv(page, '#xrdA1SizeBarSvg'), c0, 'by sample again: the same');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('XRPD Rietveld: the size chart\'s CSV by sample and by peak, whichever it shows', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    const P = '#xrdR2';
    await openModule(page, 'xrd');
    await loadFiles(page, 'xrd', env.fx.files.xrd.slice(0, 2));
    await page.setInputFiles(P + 'CifInput', env.fx.cif);
    await page.waitForSelector(P + 'PhaseList input[data-on]');
    await page.click(P + 'Refine');
    await page.waitForSelector('.confirm-modal');
    await page.click('.confirm-modal button:has-text("Refine without the standard")');
    await page.waitForFunction(s=> document.querySelector(s).textContent === 'Refine', P + 'Refine', { timeout: 120000 });
    await settle(page);
    const svg = '#tab-xrd [id$="SizeSvg"]';
    await page.waitForFunction(s=> { const w = document.querySelector(s).closest('.plot-wrap'); return w.style.display !== 'none' && w.querySelector('.plot-csv-btn'); }, svg);
    const z0 = await all(page), c0 = await chartCsv(page, svg);
    const names = Object.keys(c0).map(n=> n.replace(/^.* - /, '')).sort();
    assert.deepEqual(names, ['rietveld_peaks.csv', 'rietveld_results.csv'], 'both, by sample and by peak');
    for (const n in c0) assert.equal(c0[n], z0[n], n + ': as in the export');
    const peak = (await page.$eval(svg, s=> s.id.replace(/SizeSvg$/, ''))) + 'SizeBy [data-size-by="peak"]';
    assert.equal(await page.$eval('#' + peak, b=> b.disabled), false, 'by peak possible');
    await chip(page, '#' + peak);
    assert.equal((await moduleState(page, 'xrd')).cards.find(c=> c.id === 2).states.rietveld.sizeBy, 'peak');
    assert.deepEqual(await chartCsv(page, svg), c0, 'by peak: the same');
    assert.deepEqual(await all(page), z0, 'by peak: the export the same');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('DRS: Eg.csv has both readings (x-axis and baseline), whichever the chips show', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'tauc');
    await loadFiles(page, 'tauc', env.fx.files.tauc);
    const z0 = await all(page), eg = Object.keys(z0).find(n=> n.endsWith('Eg.csv'));
    assert.deepEqual(head(z0[eg]), ['Sample', 'Eg', 'Eg_err', 'Eg_baseline', 'Eg_baseline_err']);
    const sel = async ()=> (await moduleState(page, 'tauc')).analyses[0].egSel;
    const s0 = await sel();
    await chip(page, '#an1EgSel [data-eg]');
    assert.notDeepEqual(await sel(), s0);
    assert.deepEqual(await all(page), z0, 'the export the same');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
