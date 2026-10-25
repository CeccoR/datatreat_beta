/* GC: the pressure p of the flow, beside its temperature T (v499):
   - 1 atm in a new card and for a new file; V_m = RT/p, so that at the same T and Q a rate
     at 2 atm is twice the one at 1 atm, and the one at 1 atm 1.01325 times the one at 1 bar;
   - its unit, chosen in the column's header (atm, bar, kPa, mbar, Torr, psi), converts the
     values shown and written, never the pressure: switched through them all and back, the
     same, and the rates too; a value typed with either decimal mark; 0, below it and no
     number refused as m and Q are (the field shaken and given back, no step of the history);
   - all/one, a file added and one left out and taken back; the value and the unit, steps of
     the history (undo, redo);
   - a project saved before p: 1 atm, in atm, its rates those at 1 atm; one with a p that is
     no number, not above 0 or past what the fields take (1e307 Pa, a hand-edited project):
     1 atm, a number in every unit; the most the fields take (1e300 atm) kept through the
     history;
   - p in its unit in gc_info.csv after T, in mean_rates.csv before it (T the last column);
   - the table at the least width it is laid out for, 1000 px, and at 1300: each header's
     pill beside its name and nothing over its cell, p's name, pill and unit level with the
     others', the date field whole. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start, openModule, loadFiles, settle, moduleState, history, download, readZip, parseCsv, undo } from './helpers.mjs';

let env;
before(async ()=>{ env = await start(); });
after(()=> env && env.close());

const SH = '#tab-gc .gcShared[data-f="p"]', CELL = i => `#tab-gc .gcCell[data-i="${i}"][data-f="p"]`, UNIT = '#tab-gc .gc-unit';
const card = async page => (await moduleState(page, 'gc')).cards[0];
const csvOf = async (page, end)=>{
  const z = await download(page, ()=> page.click('.proj-csv'));
  const e = readZip(z.buf).find(x=> x.name.endsWith(end));
  return parseCsv(e.data.toString('utf8').replace(/^﻿/, ''), ';');
};
// mean_rates.csv: its header, its rows, each sample's mean H₂ and O₂ rates.
const mean = async page =>{
  const r = await csvOf(page, 'mean_rates.csv'), h = r[0], at = g => h.findIndex(x=> x.startsWith(`Mean ${g} `));
  return { head: h, rows: r.slice(1), h2: r.slice(1).map(x=> parseFloat(x[at('H2')])), o2: r.slice(1).map(x=> parseFloat(x[at('O2')])) };
};
const type = async (page, sel, v)=>{ await page.fill(sel, v); await page.press(sel, 'Enter'); await settle(page); };
const unit = async (page, u)=>{ await page.selectOption(UNIT, u); await settle(page); };
const near = (a, b, what, tol = 1e-5)=> assert.ok(Math.abs(a/b - 1) < tol, `${what}: ${a} against ${b}`);
// A module's state put in as a tab opening a project puts it (db.js decode, then the restore),
// and the state as a project file holds it (db.js encode).
const restore = (page, st)=> page.evaluate(async st=>{
  const u = await import('./utils.js'), db = await import('./db.js');
  u.restoreModuleState('gc', db.decode(st));
  for (let i = 0; i < 2; i++) await new Promise(r=> requestAnimationFrame(r));
}, st).then(()=> settle(page));
const encoded = page => page.evaluate(async ()=>{ const u = await import('./utils.js'), db = await import('./db.js'); return db.encode(u.getModuleState('gc')); });

test('p: 1 atm by default, V_m = RT/p, its unit converting what is shown and written, not the pressure', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'gc');
    await loadFiles(page, 'gc', [env.fx.files.gc[0]]);
    assert.equal(await page.inputValue(SH), '1');
    assert.equal(await page.inputValue(CELL(0)), '1');
    assert.equal(await page.inputValue(UNIT), 'atm');
    assert.deepEqual(await page.$$eval(`${UNIT} option`, os=> os.map(o=> o.value)), ['atm', 'bar', 'kPa', 'mbar', 'Torr', 'psi']);
    let c = await card(page);
    assert.deepEqual([c.pMode, c.pShared, c.Ps, c.pUnit], ['all', 101325, [101325], 'atm']);
    // The CSVs: p beside T, in mean_rates.csv before it (T stays the last column).
    const at1 = await mean(page);
    assert.deepEqual(at1.head.slice(-2), ['p (atm)', 'T (°C)']);
    assert.deepEqual(at1.rows[0].slice(-2), ['1', '25']);
    let info = await csvOf(page, 'gc_info.csv');
    assert.deepEqual(info[0].slice(0, 6), ['Sample', 'm (mg)', 'Q (mL/min)', 'T (°C)', 'p (atm)', 'Light-on']);
    assert.equal(info[1][4], '1');
    // At 2 atm the molar volume is half: twice the moles in the same flow, twice the rate.
    await type(page, SH, '2');
    assert.equal((await card(page)).pShared, 202650);
    assert.equal(await page.inputValue(CELL(0)), '2', 'the sample\'s cell follows the shared value');
    const at2 = await mean(page);
    near(at2.h2[0]/at1.h2[0], 2, 'H₂ rate at 2 atm / at 1 atm');
    near(at2.o2[0]/at1.o2[0], 2, 'O₂ rate at 2 atm / at 1 atm');
    // The unit switched through all of them and back: the values shown converted, the
    // pressure, and so the rates, untouched; the CSVs in the unit of the moment.
    for (const [u, shown] of [['bar', '2.0265'], ['kPa', '202.65'], ['mbar', '2026.5'], ['Torr', '1520'], ['psi', '29.391897551'], ['atm', '2']]){
      await unit(page, u);
      assert.equal(await page.inputValue(SH), shown, `2 atm in ${u}`);
      assert.equal(await page.inputValue(CELL(0)), shown, `2 atm in ${u}, the sample's cell`);
      c = await card(page);
      assert.deepEqual([c.pShared, c.pUnit], [202650, u]);
      if (u === 'psi'){
        const m = await mean(page);
        assert.deepEqual(m.head.slice(-2), ['p (psi)', 'T (°C)']);
        assert.equal(m.rows[0][m.head.length - 2], shown);
        assert.deepEqual([m.h2, m.o2], [at2.h2, at2.o2], 'the rates are the same in any unit');
        info = await csvOf(page, 'gc_info.csv');
        assert.deepEqual([info[0][4], info[1][4]], ['p (psi)', shown]);
      }
    }
    // 1 bar is 100000 Pa, 1 atm 101325: the rate at 1 atm is 1.01325 times the one at 1 bar.
    await unit(page, 'bar');
    await type(page, SH, '1');
    assert.equal((await card(page)).pShared, 100000);
    const atBar = await mean(page);
    near(at1.h2[0]/atBar.h2[0], 1.01325, 'H₂ rate at 1 atm / at 1 bar');
    near(at1.o2[0]/atBar.o2[0], 1.01325, 'O₂ rate at 1 atm / at 1 bar');
    // Either decimal mark.
    await type(page, SH, '1,5');
    assert.equal((await card(page)).pShared, 150000);
    assert.equal(await page.inputValue(SH), '1.5');
    // 0, below it and no number refused as m and Q are: shaken, given back, no step.
    const h0 = await history(page, 'gc');
    for (const v of ['0', '-2', '-0', 'abc', '']){
      await page.fill(SH, v); await page.press(SH, 'Enter');
      assert.ok(await page.$eval(SH, e=> e.classList.contains('field-invalid')), `"${v}" shaken`);
      await settle(page);
      assert.equal(await page.inputValue(SH), '1.5', `"${v}" refused`);
      assert.equal((await card(page)).pShared, 150000);
    }
    assert.deepEqual(await history(page, 'gc'), h0, 'nothing refused is a step');
    // m is refused the same way (the style p follows).
    await page.fill('#tab-gc .gcShared[data-f="m"]', '0'); await page.press('#tab-gc .gcShared[data-f="m"]', 'Enter');
    assert.ok(await page.$eval('#tab-gc .gcShared[data-f="m"]', e=> e.classList.contains('field-invalid')));
    await settle(page);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('p: all/one, files added and left out, undo and redo, a project saved before it', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'gc');
    await loadFiles(page, 'gc', [env.fx.files.gc[0]]);
    const at1 = await mean(page);
    // The unit is a step of the history, and so is a value.
    await unit(page, 'bar');
    assert.equal(await page.inputValue(SH), '1.01325');
    await undo(page);
    assert.deepEqual([(await card(page)).pUnit, await page.inputValue(UNIT), await page.inputValue(SH)], ['atm', 'atm', '1']);
    await undo(page, true);
    assert.deepEqual([(await card(page)).pUnit, await page.inputValue(UNIT), await page.inputValue(SH)], ['bar', 'bar', '1.01325']);
    await type(page, SH, '2');
    assert.equal((await card(page)).pShared, 200000);
    await undo(page);
    assert.deepEqual([(await card(page)).pShared, await page.inputValue(SH)], [101325, '1.01325']);
    assert.deepEqual((await mean(page)).h2, at1.h2, 'the rates back with the pressure');
    await undo(page, true);
    assert.deepEqual([(await card(page)).pShared, await page.inputValue(SH)], [200000, '2']);
    // all → one: each sample from the shared value, the shared field off.
    await page.click('#tab-gc .gc-toggle[data-pair="p"]'); await settle(page);
    let c = await card(page);
    assert.deepEqual([c.pMode, c.Ps], ['one', [200000]]);
    assert.ok(await page.$eval(SH, e=> e.disabled));
    await type(page, CELL(0), '3');
    assert.deepEqual((await card(page)).Ps, [300000]);
    // A file added starts at 1 atm, shown in the card's unit.
    await loadFiles(page, 'gc', [env.fx.files.gc[1]]);
    assert.deepEqual((await card(page)).Ps, [300000, 101325]);
    assert.equal(await page.inputValue(CELL(1)), '1.01325');
    let m = await mean(page);
    assert.deepEqual(m.rows.map(r=> r[m.head.length - 2]), ['3', '1.01325']);
    // alpha left out and taken back: its p held meanwhile.
    await page.locator('#gcFileTableWrap .file-incl').nth(0).uncheck(); await settle(page);
    assert.deepEqual((await card(page)).Ps, [101325]);
    await page.locator('#gcFileTableWrap .file-incl').nth(0).check(); await settle(page);
    assert.deepEqual((await card(page)).Ps, [300000, 101325]);
    // one → all: sample 0's for every sample.
    await page.click('#tab-gc .gc-toggle[data-pair="p"]'); await settle(page);
    c = await card(page);
    assert.deepEqual([c.pMode, c.pShared], ['all', 300000]);
    assert.equal(await page.inputValue(CELL(1)), '3');
    // The state with p as a project from before it holds it (none of p's keys): 1 atm, in
    // atm, the rates those of the same state at 1 atm.
    const st = await encoded(page);
    Object.assign(st.cards[0], { pMode: 'all', pShared: 101325, pUnit: 'atm' });
    await restore(page, st);
    const ref = await mean(page);
    for (const k of ['pMode', 'pShared', 'Ps', 'pUnit']) delete st.cards[0][k];
    await restore(page, st);
    c = await card(page);
    assert.deepEqual([c.pMode, c.pShared, c.Ps, c.pUnit], ['all', 101325, [101325, 101325], 'atm']);
    assert.deepEqual([await page.inputValue(SH), await page.inputValue(UNIT)], ['1', 'atm']);
    m = await mean(page);
    assert.deepEqual(m.rows, ref.rows, 'a project from before p: its rates at 1 atm');
    assert.deepEqual(m.h2[0], at1.h2[0], 'alpha\'s rate as it was at the start, at 1 atm');
    // A unit that is none of them, a pressure that is no number or not above 0: atm, 1 atm.
    Object.assign(st.cards[0], { pUnit: 'constructor', pShared: -5, pMode: 'one', Ps: [0, 'x'] });
    await restore(page, st);
    c = await card(page);
    assert.deepEqual([c.pMode, c.pShared, c.Ps, c.pUnit], ['one', 101325, [101325, 101325], 'atm']);
    // One past what the fields take (1e307 Pa, more than 1e300 atm), which in Torr would be
    // no number: 1 atm, 760 Torr in the fields and the CSVs, the rates those at 1 atm.
    Object.assign(st.cards[0], { pUnit: 'Torr', pShared: 1e307, pMode: 'all', Ps: [1e307, 2e305] });
    await restore(page, st);
    c = await card(page);
    assert.deepEqual([c.pMode, c.pShared, c.Ps, c.pUnit], ['all', 101325, [101325, 101325], 'Torr']);
    assert.deepEqual([await page.inputValue(SH), await page.inputValue(CELL(0)), await page.inputValue(CELL(1))], ['760', '760', '760']);
    m = await mean(page);
    assert.deepEqual([m.head[m.head.length - 2], m.rows.map(r=> r[m.head.length - 2])], ['p (Torr)', ['760', '760']]);
    assert.deepEqual([m.h2, m.o2], [ref.h2, ref.o2], 'the rates at 1 atm');
    const info = await csvOf(page, 'gc_info.csv');
    assert.deepEqual(info.map(r=> r[4]), ['p (Torr)', '760', '760']);
    // The most the fields take, 1e300 in the largest unit (atm), kept through undo and redo
    // as the restore takes it; past it, refused.
    await unit(page, 'atm');
    await type(page, SH, '1e300');
    assert.equal((await card(page)).pShared, 1e300*101325);
    await type(page, SH, '2e300');
    assert.equal(await page.inputValue(SH), '1e+300', '2e300 atm refused');
    await unit(page, 'Torr');
    assert.equal(await page.inputValue(SH), '7.6e+302');
    m = await mean(page);
    assert.ok(m.rows.every(r=> r[m.head.length - 2] === '7.6e+302') && m.h2.every(Number.isFinite), 'a number in the CSV, and the rates');
    await undo(page); await undo(page);
    assert.deepEqual([(await card(page)).pShared, (await card(page)).pUnit], [101325, 'atm']);
    await undo(page, true);
    assert.deepEqual([(await card(page)).pShared, await page.inputValue(SH)], [1e300*101325, '1e+300']);
    await undo(page, true);
    assert.deepEqual([(await card(page)).pShared, await page.inputValue(SH)], [1e300*101325, '7.6e+302']);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

// The parameter table's headers and date field, as laid out: each header's content within
// its cell, its height, the top of its name and of its pill; the select's box.
const layout = page => page.evaluate(()=>{
  const t = document.querySelectorAll('#tab-gc .gc-param-table')[1], ths = [...t.querySelectorAll('thead .gc-th')];
  const top = h =>{ const r = document.createRange(); r.selectNodeContents(h.firstElementChild.firstChild); return r.getClientRects()[0].top; };
  const box = e => e.getBoundingClientRect();
  const dc = t.querySelector('.gc-date-cell'), sel = t.querySelector('.gc-unit'), p = sel.closest('.gc-th'), m = ths[1];
  return {
    width: Math.round(box(t).width),
    over: ths.filter(h=> h.scrollWidth > h.clientWidth).map(h=> h.textContent.trim()),
    tall: Math.max(...ths.filter(h=> h.querySelector('.mode-chip')).map(h=> box(h).height)),
    dateOver: dc.scrollWidth > dc.clientWidth || dc.firstElementChild.scrollWidth > dc.clientWidth - 16 + 0.5,
    level: { name: top(p) - top(m), pill: box(p.querySelector('.mode-chip')).top - box(m.querySelector('.mode-chip')).top, height: box(p).height - box(m).height },
    unit: (box(sel).top + box(sel).bottom)/2 - (box(p.querySelector('.mode-chip')).top + box(p.querySelector('.mode-chip')).bottom)/2,
  };
});
test('p: the table at 1300 px and at 1000 px, the least width it is laid out for', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'gc');
    await loadFiles(page, 'gc', env.fx.files.gc);
    // At 1300 px (a 1400-px window) every header on one line.
    let l = await layout(page);
    assert.equal(l.width, 1300);
    assert.deepEqual(l.over, []);
    assert.ok(l.tall < 22, `one line: ${l.tall} px`);
    assert.ok(!l.dateOver, 'the date field whole');
    assert.deepEqual(l.level, { name: 0, pill: 0, height: 0 }, 'p\'s name and pill level with m\'s');
    assert.ok(Math.abs(l.unit) <= 1.5, `the unit's box on the pill's middle: ${l.unit}`);
    // At 1000 px (the least width style.css is to give it; forced here) the names on two
    // lines where they must, every pill still beside its name, the date field whole.
    await page.addStyleTag({ content: '.gc-param-table { min-width: 1000px; }' });
    await page.setViewportSize({ width: 900, height: 900 });
    await settle(page);
    l = await layout(page);
    assert.equal(l.width, 1000);
    assert.deepEqual(l.over, []);
    assert.ok(!l.dateOver, 'the date field whole');
    assert.deepEqual(l.level, { name: 0, pill: 0, height: 0 }, 'p\'s name and pill level with m\'s');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
