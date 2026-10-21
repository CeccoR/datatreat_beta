/* The plots, against their golden hashes: every plot SVG of each module with its fixtures
   loaded, every card unfolded and stepped once (tests/golden/<module>.json). A plot that
   draws differently fails with its name, and its new markup is written to
   tests/out/plots/<module>/ for a look; after an intended change, npm run test:update
   writes the hashes again. The markup is taken with the fonts loaded, at 1400 × 900, in
   UTC, after the redraw a window resize makes (a plot's first drawing, made while the page
   is still laid out, can differ in its last digit from run to run): the hashes hold for
   this Chromium and these fonts. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start, openModule, loadFiles, poke, plotSvgs, golden, settle, UPDATE } from './helpers.mjs';

// Every plot drawn again for the page as it is, through the app's resize path (its full
// redraw comes 180 ms after the last resize event).
async function redraw(page){
  await page.evaluate(()=> window.dispatchEvent(new Event('resize')));
  await page.waitForTimeout(300);
  await settle(page);
}

let env;
before(async ()=>{ env = await start(); });
after(()=> env && env.close());

for (const mod of ['tauc', 'xrd', 'gc', 'epr']){
  test(`${mod}: plots match their golden hashes`, async t=>{
    const { page, errors, close } = await env.page();
    try {
      await openModule(page, mod);
      await loadFiles(page, mod, env.fx.files[mod]);
      await poke(page);
      await page.evaluate(()=> document.fonts.ready);
      await redraw(page);
      const plots = await plotSvgs(page, mod);
      assert.ok(Object.keys(plots).length > 0, 'no plot found');
      // Drawn again as it is, the same: what the hash takes is settled.
      await redraw(page);
      const again = await plotSvgs(page, mod);
      for (const k in plots) assert.equal(again[k] && again[k].svg, plots[k].svg, `${k} changed with nothing done`);
      const diff = golden(mod, plots);
      if (UPDATE) t.diagnostic(`${mod}: ${Object.keys(plots).length} hashes written`);
      assert.deepEqual(diff, [], 'plots differing from tests/golden/' + mod + '.json (new markup in tests/out/plots/' + mod + '/)');
      assert.deepEqual(errors, []);
    } finally { await close(); }
  });
}
