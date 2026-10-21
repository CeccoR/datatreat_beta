/* Every module opens in a tab of its own and takes its fixtures with no page error and no
   Content-Security-Policy violation; the page's own pieces under the CSP (the theme set
   before the first paint, the Rietveld worker, an alert's dismiss button with no inline
   handler). */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start, openModule, loadFiles, poke, fileRows, tabLabels, MODS } from './helpers.mjs';
import { ROWS } from './fixtures.mjs';

let env;
before(async ()=>{ env = await start(); });
after(()=> env && env.close());

for (const mod of MODS){
  test(`${mod}: opens and loads its fixtures, no page error, no CSP violation`, async ()=>{
    const { page, errors, csp, close } = await env.page();
    try {
      await openModule(page, mod);
      assert.equal(await page.locator('#tabBar .ptab').count(), 1, 'one tab');
      await loadFiles(page, mod, env.fx.files[mod]);
      assert.equal(await fileRows(page, mod), ROWS[mod], 'file rows');
      await poke(page);
      if (mod !== 'sem') assert.ok(await page.locator(`#tab-${mod} svg.plot path`).count() > 0, 'a plot drawn');
      else assert.equal(await page.locator('#semThumbs .sem-thumb').count(), ROWS.sem, 'thumbnails');
      assert.match((await tabLabels(page))[0], /\*$/, 'the new tab marked unsaved');
      assert.deepEqual(errors, []);
      assert.deepEqual(await csp(), []);
    } finally { await close(); }
  });
}

test('every module in its own tab at once; Home and back', async ()=>{
  const { page, errors, csp, close } = await env.page();
  try {
    for (const mod of MODS){ await openModule(page, mod); await loadFiles(page, mod, env.fx.files[mod]); }
    assert.equal(await page.locator('#tabBar .ptab').count(), MODS.length);
    for (let i = 0; i < MODS.length; i++){
      await page.locator('#tabBar .ptab').nth(i).locator('.ptab-label').click();
      await page.waitForSelector(`#tab-${MODS[i]}.active`);
      await page.waitForFunction(([sel, n])=> document.querySelectorAll(sel).length === n && !document.querySelector('.module-loader.show'), [`#${MODS[i]}FileTableWrap tr.file-row`, ROWS[MODS[i]]]);
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(await csp(), []);
  } finally { await close(); }
});

test('under the CSP: theme before paint, the Rietveld worker, an alert dismissed', async ()=>{
  const { page, errors, csp, close } = await env.page();
  try {
    assert.equal(await page.evaluate(()=> document.documentElement.getAttribute('data-theme')), 'dark');
    // The worker loads as a module from the app's origin and answers.
    const w = await page.evaluate(()=> new Promise(res=>{
      const wk = new Worker(new URL('./xrd-rietveld.worker.js', location.href), { type: 'module' });
      wk.onerror = e=> res('error: ' + (e.message || 'load failed'));
      wk.onmessage = m=>{ res('reply'); wk.terminate(); };
      wk.postMessage({ id: 1, x: [1, 2], y: [1, 2], phases: [], opts: {} });
      setTimeout(()=> res('alive, no reply in 5 s'), 5000);
    }));
    assert.equal(w, 'reply');
    // The dismiss button of buildAlertsHtml works through the delegated listener.
    await page.evaluate(async ()=>{ const u = await import('./utils.js'); const d = document.createElement('div'); d.id = 'tA'; d.innerHTML = u.buildAlertsHtml(['x'], []); document.body.appendChild(d); });
    await page.click('#tA [data-dismiss-alert]');
    assert.equal(await page.locator('#tA .alert').count(), 0);
    assert.deepEqual(errors, []);
    assert.deepEqual(await csp(), []);
  } finally { await close(); }
});
