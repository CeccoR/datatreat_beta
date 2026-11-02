/* The parameters of the plot-style cards (v531): in every module's card with a plot on the
   left and its parameters on the right (DRS's Tauc and Urbach cards, XRPD's Scherrer card,
   EPR's spectra, SEM's crop and intensity; Custom's in fig.test.mjs), each parameter a row
   of the shared grid (.param-grid), its name on three fifths of the column and its field on
   two: each field starting at 3/5 of the column and 2/5 wide, the grid the column's width,
   nothing in it past its right edge, no name cut short. At 1100, 1400 and 1920 px. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start, openModule, loadFiles, settle } from './helpers.mjs';

let env;
before(async ()=>{ env = await start(); });
after(()=> env && env.close());

// Every parameter grid on show in the module: its field rows' place and width in fifths of
// the column, the grid's width less the column's, what passes its edge, the names cut.
const grids = (page, mod)=> page.$$eval(`#tab-${mod}.active .param-grid`, gs=> gs.filter(g=> g.offsetWidth).map(g=>{
  const r = g.getBoundingClientRect(), col = g.parentElement.getBoundingClientRect();
  return {
    fields: [...g.querySelectorAll(':scope > .pg-field')].filter(f=> f.offsetWidth).map(f=>{ const q = f.getBoundingClientRect(); return [+((q.left - col.left)/col.width*5).toFixed(2), +(q.width/col.width*5).toFixed(2)]; }),
    wider: Math.round(r.width - col.width),
    past: [...g.querySelectorAll('*')].filter(e=> e.offsetWidth && e.getBoundingClientRect().right > r.right + 1).map(e=> e.id || e.className),
    cut: [...g.querySelectorAll(':scope > .txt-label, :scope > .pg-title')].filter(l=> l.scrollWidth > l.clientWidth + 0.5).map(l=> l.textContent.trim()),
  };
}));
async function card(page, mod, kind){
  await page.click(`#${mod}AddAn`);
  if (kind) await page.click(`.an-menu:not([hidden]) [data-kind="${kind}"]`);
  await settle(page);
}

test('Parameters: the name on three fifths, the field on two, in every plot-style card', async ()=>{
  for (const width of [1100, 1400, 1920]){
    const { page, errors, close } = await env.page({ viewport: { width, height: 1000 } });
    try {
      for (const [mod, kinds, least] of [['tauc', ['urbach'], 9], ['xrd', [], 8], ['epr', [], 2], ['sem', [], 15]]){
        await openModule(page, mod);
        await loadFiles(page, mod, env.fx.files[mod]);
        for (const k of kinds) await card(page, mod, k);
        const gs = await grids(page, mod), fields = gs.flatMap(g=> g.fields);
        assert.ok(fields.length >= least, `${width} ${mod}: ${fields.length} fields`);
        for (const [at, w] of fields) assert.ok(Math.abs(at - 3) < 0.02 && Math.abs(w - 2) < 0.02, `${width} ${mod}: a field at 3/5 of the column, 2/5 wide (${at}, ${w})`);
        assert.deepEqual(gs.map(g=> g.wider), gs.map(()=> 0), `${width} ${mod}: the grids the column's width`);
        assert.deepEqual(gs.flatMap(g=> g.past), [], `${width} ${mod}: nothing past the column`);
        assert.deepEqual(gs.flatMap(g=> g.cut), [], `${width} ${mod}: no name cut short`);
      }
      assert.deepEqual(errors, []);
    } finally { await close(); }
  }
});
