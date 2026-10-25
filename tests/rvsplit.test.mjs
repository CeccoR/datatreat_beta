/* A Rietveld card gone, closed by its × or turned into a Scherrer card, its Settings left
   open (their Escape listened for on the document while they are): no listener of
   xrd-rv.js's stays on the document or the window (those the card registers come off
   together as it is destroyed: createRietveld's AbortController), and its panel, its
   settings window, its section of the Results, its plot and its 3D cell are freed. Every
   action on the card is taken in the page: a Playwright handle on one of its elements would
   keep it alive. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { start, openModule, loadFiles, until } from './helpers.mjs';

let env;
before(async ()=>{ env = await start(); });
after(()=> env && env.close());

for (const how of ['closed', 'switched to Scherrer']) test(`a Rietveld card ${how}: nothing of it stays`, async ()=>{
  const { page, errors, close } = await env.page();
  try {
    const cdp = await page.context().newCDPSession(page), urls = new Map();
    cdp.on('Debugger.scriptParsed', e=> urls.set(e.scriptId, e.url));
    await cdp.send('Debugger.enable');
    // The listeners on the document and the window whose handler is xrd-rv.js's.
    const ours = async ()=>{
      const out = [];
      for (const expr of ['document', 'window']){
        const { result } = await cdp.send('Runtime.evaluate', { expression: expr, objectGroup: 'ls' });
        for (const l of (await cdp.send('DOMDebugger.getEventListeners', { objectId: result.objectId })).listeners) if (/\/xrd-rv\.js$/.test(urls.get(l.scriptId) || '')) out.push(`${expr} ${l.type}${l.useCapture ? ' (capture)' : ''}`);
      }
      await cdp.send('Runtime.releaseObjectGroup', { objectGroup: 'ls' });
      return out;
    };
    await openModule(page, 'xrd');
    await loadFiles(page, 'xrd', env.fx.files.xrd.slice(0, 2));
    await page.evaluate(t=>{ const dt = new DataTransfer(); dt.items.add(new File([t], 'SrTiO3.cif')); const box = document.querySelector('#xrdR2Cifs');
      for (const type of ['dragenter', 'dragover', 'drop']) box.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt })); }, fs.readFileSync(env.fx.cif, 'utf8'));
    await page.waitForFunction(()=> !!document.querySelector('#xrdR2PhaseList input[data-on]'));
    await page.evaluate(()=> document.querySelector('#xrdR2Settings').click());
    await page.waitForFunction(()=> !!document.querySelector('[aria-labelledby="xrdR2SetTitle"] [data-row]'));
    assert.deepEqual(await ours(), ['document keydown (capture)'], 'the settings\' Escape, while they are open');
    await page.evaluate(()=>{ const q = s => document.querySelector(s);
      window.__gone = [q('#xrdR2Svg'), q('#xrdR2PhaseList'), q('[aria-labelledby="xrdR2SetTitle"]').closest('.modal-backdrop'), q('#xrdR2ResSvg'), q('#xrdR2Svg')._plot, q('#xrdR2Cell canvas')].map(o=> new WeakRef(o)); });
    if (how === 'closed') await page.evaluate(()=> document.querySelector('#xrdAnalyses .an-card[data-an="2"] .an-close').click());
    else await page.evaluate(()=>{ document.querySelector('#xrdAnalyses .an-card[data-an="2"] .an-type').click(); document.querySelector('.an-menu:not([hidden]) [data-kind="scherrer"]').click(); });
    await page.waitForFunction(()=> !document.querySelector('#xrdR2Svg') && !document.querySelector('[aria-labelledby="xrdR2SetTitle"]'));
    assert.deepEqual(await ours(), []);
    await until(async ()=>{ await cdp.send('HeapProfiler.collectGarbage'); return page.evaluate(()=> window.__gone.every(r=> !r.deref())); }, { timeout: 15000, every: 250, what: 'the card freed' });
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
