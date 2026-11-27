/* A short Rietveld refinement of the synthetic perovskite pattern with the SrTiO3 CIF
   (no instrumental standard: the question answered "Refine without the standard"), its
   result kept for that pattern alone; then Refine all on two patterns, cancelled: nothing
   more written, the button back to Refine, the module no longer busy. What a refinement says
   (v572, ALERTS-REVIEW.md X11, U4): each message of the kind the engine gives, kept so in the
   state a project saves, said in a compact box a kind under the results; a result an older
   version saved, its words alone, said as a warning. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start, openModule, loadFiles, moduleState, until, settle, firstTop } from './helpers.mjs';
// The question about the standard (a window, utils.js confirmModal): its message, and the answer 'Refine without the standard'.
const asked = async page => (await page.waitForSelector('.confirm-modal'), page.textContent('.confirm-modal .confirm-msg'));
const without = async page =>{ await page.click('.confirm-modal .btn:not(.primary)'); await page.waitForFunction(()=> !document.querySelector('.confirm-modal')); await settle(page); };

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
    // (a run's patterns one at a time: on the pool's lanes the two would be done before the Cancel)
    await page.evaluate(()=> localStorage.setItem('datatreat-rv-lanes', '1'));
    await openModule(page, 'xrd');
    await loadFiles(page, 'xrd', env.fx.files.xrd.slice(0, 2));
    await page.setInputFiles(P + 'CifInput', env.fx.cif);
    await page.waitForSelector(P + 'PhaseList input[data-on]');
    // Refine, on the pattern on show: asked about the standard first.
    await page.click(P + 'Refine');
    assert.match(await asked(page), /No instrumental standard is loaded/);
    await without(page);
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
    /* (v571, ALERTS-REVIEW.md X05, X10) The instrument's line, the facts alone; what was assumed
       (no radius, no slit in the file: choices that hold in the normal case) an info box under
       it. No instrumental profile, said once, a compact warning in the results; the peak widths'
       title says they are not corrected; no grey note nor amber line of it besides. */
    assert.ok(!/⚠|assumed/.test(await page.textContent(P + 'Instr')), await page.textContent(P + 'Instr'));
    assert.deepEqual(await page.$$eval(P + 'InstrNotes .alert', as=> as.map(a=> [a.className, a.innerText])),
      [['alert info compact', 'No goniometer radius in the file: 240 mm assumed (the specimen displacement in mm depends on it).\nNo divergence slit in the file: a fixed slit is assumed.']]);
    const res = await page.$$eval(P + 'Results .alert, ' + P + 'Results .rv-note', es=> es.map(e=> [e.className, e.textContent]));
    const noIrf = res.filter(([, t])=> /instrumental profile|include the instrument/.test(t));
    assert.equal(noIrf.length, 1, JSON.stringify(res));
    assert.equal(noIrf[0][0], 'alert warn compact rv-wide');
    assert.match(noIrf[0][1], /^⚠ No instrumental profile: the widths, and the sizes from them, include the instrument's\. Refine the standard first: Instrumental standard…\./);
    assert.ok(!res.some(([, t])=> /No instrument description/.test(t)), 'the instrument\'s assumptions not among the results');
    if (await page.isVisible(P + 'Widths')){
      assert.equal(await page.textContent(P + 'WNote'), '(not corrected for the instrument)');
      assert.equal(await page.locator(P + 'PkWrap .rv-note').count(), 0, 'no note of it under the table');
    }
    // Refine all, cancelled while it runs.
    const before = await results(page);
    await page.waitForTimeout(700);   // (a press within 600 ms of the last is not taken: a double click)
    await page.click(P + 'RefineAll');
    await asked(page);
    await without(page);
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

test('Rietveld\'s messages: of the engine\'s kind, kept so; a compact box a kind; an older version\'s words, a warning', async ()=>{
  const { page, errors, close } = await env.page();
  const refine = async ()=>{
    await page.click(P + 'Refine'); await asked(page); await without(page);
    await page.waitForFunction(p=> document.querySelector(p + 'Refine').textContent === 'Refine', P, { timeout: 120000 }); await settle(page);
  };
  const shown = ()=> page.$$eval(P + 'Results .alert, ' + P + 'Results .rv-warn', es=> es.map(e=> [e.className, e.innerText]));
  const top = async what =>{
    const t = await firstTop(page, '#tab-xrd .an-card:nth-child(2)', { frame: 'svg.plot', block: '.pside-col > .rv-boxes' });
    assert.ok(Math.abs(t.top - t.frame) <= 1, `${what}: the boxes' top ${t.top}, the plot frame's ${t.frame}`);
  };
  try {
    await openModule(page, 'xrd');
    await loadFiles(page, 'xrd', env.fx.files.xrd.slice(0, 1));
    await page.setInputFiles(P + 'CifInput', env.fx.cif);
    await page.waitForSelector(P + 'PhaseList input[data-on]');
    await refine();
    // Again, from the last result: what it started from and held, a report (an info).
    await page.click(P + 'Settings');
    await page.locator('[data-start="last"]:visible').click();
    await page.keyboard.press('Escape'); await settle(page);
    await page.waitForTimeout(700);   // (a press within 600 ms of the last is not taken: a double click)
    await refine();
    const r = (await resultsOf(page))['s00.xrdml'];
    assert.ok(r.warnings.length > 0 && r.warnings.every(w=> ['info', 'warn', 'bad'].includes(w.kind) && typeof w.text === 'string'), JSON.stringify(r.warnings));
    assert.ok(r.warnings.some(w=> w.kind === 'info' && w.text.startsWith('Refined from the last result.')), JSON.stringify(r.warnings));
    const now = await shown();
    assert.ok(now.some(([c, t])=> c === 'alert info compact rv-wide' && t.includes('Refined from the last result.')), JSON.stringify(now));
    assert.ok(now.every(([c])=> /^alert (bad|warn|info) compact rv-wide$/.test(c)), 'no amber line: ' + JSON.stringify(now));
    await top('refined');
    // A result an older version saved: its words alone, read as warnings (U4).
    await page.evaluate(async ()=>{
      const u = await import('./utils.js'), s = u.getModuleState('xrd'), c = s.cards.find(x=> x.id === 2), rv = c.states.rietveld, r = rv.results['s00.xrdml'];
      const old = { ...rv, results: { ...rv.results, 's00.xrdml': { ...r, warnings: r.warnings.map(w=> w.text) } } };
      u.restoreModuleState('xrd', { ...s, cards: s.cards.map(x=> x === c ? { ...c, states: { ...c.states, rietveld: old } } : x) });
    });
    await settle(page);
    const then = await shown();
    assert.ok(then.some(([c, t])=> c === 'alert warn compact rv-wide' && t.includes('Refined from the last result.')), JSON.stringify(then));
    assert.ok(!then.some(([c])=> c.includes('info')), 'none an info: ' + JSON.stringify(then));
    await top('an older result');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
