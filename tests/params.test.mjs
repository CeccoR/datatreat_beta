/* The parameters of the plot-style cards (v531): in every module's card with a plot on the
   left and its parameters on the right (DRS's Tauc and Urbach cards, XRPD's Scherrer card,
   EPR's spectra, SEM's crop and intensity; Custom's in fig.test.mjs), each parameter a row
   of the shared grid (.param-grid), its name on three fifths of the column and its field on
   two: each field starting at 3/5 of the column and 2/5 wide, the grid the column's width,
   nothing in it past its right edge, no name cut short. At 1100, 1400 and 1920 px.
   v546, CLAUDE.md's rule: plot on the left, boxes on the right, tops aligned. The first
   box's top edge on the plot's frame's (±1 px), a title above it on the line of the plot's
   selector and toolbar (their middles ±1 px): DRS's Tauc and Urbach cards, XRPD's Peaks
   and Rietveld cards and its standard's window, EPR (its toolbar's own line), SEM's
   settings (and its thumbnails' box), Iodometry; Custom's in fig.test.mjs, GC's in
   gctcd-ui.test.mjs. */
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

/* Where a card's plot and its right column stand: the middle of the line over the plot (its
   selector's line, else its toolbar's own) and of the toolbar, the plot frame's top, the
   middle of the right column's title (null: none) and the top of its first box. */
const tops = (page, root, { line, frame, head, block })=> page.evaluate(([root, line, frame, head, block])=>{
  const base = typeof root === 'string' ? document.querySelector(root) : null;
  const r = s =>{ const e = s && base.querySelector(s); return e && e.getClientRects().length ? e.getBoundingClientRect() : null; }, mid = b => b && (b.top + b.bottom)/2;
  const tb = base.querySelector('.plot-btn-col');
  return { line: mid(r(line)), tb: mid(tb.getBoundingClientRect()), frame: r(frame).top, head: mid(r(head)), block: r(block).top };
}, [root, line, frame, head, block]);
function aligned(t, what){
  assert.ok(Math.abs(t.block - t.frame) <= 1, `${what}: the first box's top ${t.block}, the plot frame's ${t.frame}`);
  assert.ok(Math.abs(t.tb - t.line) <= 1, `${what}: the toolbar on the selector's line (${t.tb}, ${t.line})`);
  if (t.head != null) assert.ok(Math.abs(t.head - t.line) <= 1, `${what}: the title on the selector's and the toolbar's line (${t.head}, ${t.line})`);
}
const PLOT = { line: '.plot-nav-row', frame: 'svg.plot', head: ':scope .col.mw280 > .param-head', block: ':scope .col.mw280 > .param-grid' };

test('Plot on the left, boxes on the right: the first box\'s top on the plot frame\'s, its title on the selector\'s and the toolbar\'s line (CLAUDE.md)', async ()=>{
  const { page, errors, close } = await env.page({ viewport: { width: 1400, height: 1000 } });
  try {
    await openModule(page, 'tauc'); await loadFiles(page, 'tauc', env.fx.files.tauc); await card(page, 'tauc', 'urbach');
    for (const n of [1, 2]) aligned(await tops(page, `#tab-tauc .an-card:nth-child(${n})`, PLOT), `DRS card ${n}`);
    await openModule(page, 'xrd'); await loadFiles(page, 'xrd', env.fx.files.xrd);
    aligned(await tops(page, '#tab-xrd .an-card:nth-child(1)', PLOT), 'XRPD Peaks/Scherrer');
    aligned(await tops(page, '#tab-xrd .an-card:nth-child(2)', { line: '.plot-nav-row', frame: 'svg.plot', head: null, block: '.pside-col > .rv-boxes' }), 'XRPD Rietveld (its boxes\' titles in them)');
    await page.click('#xrdA1Std'); await page.setInputFiles('#xrdStdPeaksFiles', env.fx.std);
    await page.waitForSelector('#xrdStdPeaks .xrd-std-name'); await settle(page);
    aligned(await tops(page, '.xrd-std-modal:not([style*="none"]) .xrd-std-box', { line: '.plot-nav-row', frame: 'svg.plot', head: '.xrd-std-side > .param-head', block: '.xrd-std-side > .param-grid' }), 'XRPD standard');
    await page.keyboard.press('Escape'); await settle(page);
    await openModule(page, 'epr'); await loadFiles(page, 'epr', env.fx.files.epr);
    aligned(await tops(page, '#tab-epr .an-card:nth-child(1)', { line: '.plot-btn-col', frame: 'svg.plot', head: '.col.mw260 > .param-head', block: '.col.mw260 > .param-grid' }), 'EPR (no selector: the toolbar\'s own line)');
    await openModule(page, 'sem'); await loadFiles(page, 'sem', env.fx.files.sem);
    aligned(await tops(page, '#semWorkspace', { line: '.sem-work-nav', frame: '.sem-crop-view', head: '.sem-col-set > .sem-set-head', block: '.sem-col-set > .sem-pg' }), 'SEM\'s settings');
    aligned(await tops(page, '#semWorkspace', { line: '.sem-work-nav', frame: '.sem-crop-view', head: null, block: '.sem-col-imgs .sem-box' }), 'SEM\'s thumbnails (its title in its box)');
    await openModule(page, 'iodo');
    const t = Array.from({ length: 300 }, (_, j)=> +(0.05 + 0.2*j).toFixed(2));
    const csv = 'blank,,s1,,\r\nTime (sec),Abs,Time (sec),Abs,\r\n' + t.map((tt, j)=> [0, 1].map(k=> `${tt.toFixed(2)},${(0.2 + 0.1*k + (j >= 50 ? 0.3*(1 - Math.exp(-(tt - 10)/20)) : 0) + (j === 50 ? 0.1 : 0)).toFixed(6)},`).join('')).join('\r\n') + '\r\n\r\n';
    await loadFiles(page, 'iodo', [env.fx.put('kin3.csv', csv)], 2);
    aligned(await tops(page, '#iodoAnalysis', PLOT), 'Iodometry');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
