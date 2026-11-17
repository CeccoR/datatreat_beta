/* GC: what a card's rates are normalised by (v540), the photocatalyst's mass (as to v539) or,
   for a film, its area. Every file here is made up for the test.
   - One choice a card, "Normalize by: mass | area" on the injection delay's row; mass by
     default. With area the m column is A (cm²), with its own all/one and per-sample values,
     an area above 0 as a mass is (0, below it, no number refused).
   - The rates by hand: a gas's flow in µmol/h over A in cm² (µmol cm⁻² h⁻¹), over m in g
     (µmol g⁻¹ h⁻¹, v541: to v540 mmol g⁻¹ h⁻¹, µmol/h over m in mg, the numbers 1000 times
     smaller); the mean rate of constant concentrations over an interval, with area and with
     mass, in mean_rates.csv.
   - Both in µmol (v541): every rate and production with mass 1000 times v540's number, which
     is the flow over m in mg, as area gives it with A the same number as m (gc_raw.csv,
     gc_results.csv, mean_rates.csv of the fixtures, every column); a project saved before
     v540 opening so.
   - The card's instructions (v541): the formulas from the reading to the rates, one a line,
     and their example's numbers those of the hand calculation here.
   - The labels follow the choice: the axis titles of the Analysis plot, the two Results
     plots and the bar chart (their superscripts), the parameter table's column, the CSV
     headers (gc_raw.csv, gc_results.csv, mean_rates.csv with replicates and its SD,
     gc_info.csv's A (cm^2)).
   - Switching back and forth keeps both the masses and the areas, each with its all/one;
     the choice a step of the history (undo, redo) and a change unsaved ("*").
   - A project saved before v540 (no choice in its state) opens with mass and the same
     CSVs, byte for byte; one saved with area opens with area and its areas; a choice
     edited by hand to anything else opens with mass. Its rates and production, with mass, in
     µmol: 1000 times the numbers it gave to v540. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start, openModule, loadFiles, settle, moduleState, undo, history, download, readZip, parseCsv, saveAs, tabLabels } from './helpers.mjs';

let env;
before(async ()=>{ env = await start(); });
after(()=> env && env.close());

// A default GC export, H₂ and O₂ constant (%mol), an injection every 20 min from 10:00.
const film = (name, h2, o2)=> ({ name, mimeType: 'text/csv', buffer: Buffer.from('Injection Date,H2 (A) [%Mol],O2 (A) [%Mol]\n' +
  [0, 20, 40, 60, 80, 100].map(m=>{ const h = 10 + Math.floor(m/60); return `11/13/2026 ${h}:${String(m % 60).padStart(2, '0')}:00 AM,${h2},${o2}`; }).join('\n') + '\n') });
// By hand: Q 2 mL/min at 25 °C and 1 atm (a new card's): the flow in mol/h; a gas at pct %mol, in µmol/h.
const R = 8.314462618/101.325, F = 2/1000*60/(R*298.15), umolH = pct => pct/100*F*1e6;
// A rate by mass by hand: as to v540, µmol/h over m in mg (mmol g⁻¹ h⁻¹), and from v541 in
// µmol g⁻¹ h⁻¹, the same rate: 1000 times that number.
const v540 = (pct, mg)=> umolH(pct)/mg, perG = (pct, mg)=> 1e3*v540(pct, mg);

const NORM = '#tab-gc .gc-norm', SH = f => `#tab-gc .gcShared[data-f="${f}"]`, CELL = (i, f)=> `#tab-gc .gcCell[data-i="${i}"][data-f="${f}"]`;
const card = async page => (await moduleState(page, 'gc')).cards[0];
const norm = async (page, v)=>{ await page.selectOption(NORM, v); await settle(page); };
const type = async (page, sel, v)=>{ await page.fill(sel, v); await page.press(sel, 'Enter'); await settle(page); };
const zip = async page =>{
  const z = await download(page, ()=> page.click('.proj-csv'));
  return Object.fromEntries(readZip(z.buf).map(e=> [e.name.replace(/^.* - /, ''), e.data.toString('utf8')]));
};
const csv = text => parseCsv(text.replace(/^﻿/, ''), ';');
const head = async page => page.$eval('#tab-gc .gc-param-table:not(.gc-delay) thead th:nth-child(2) .gc-th span', e=> e.textContent);
// Each plot's y-axis title, its words without spaces (a long one is wrapped), and its superscripts.
const yTitles = page => page.$$eval('#tab-gc svg[id$="Svg1"], #tab-gc svg[id$="SvgRate"], #tab-gc svg[id$="SvgCum"], #tab-gc svg[id$="SvgBar"]', svgs=> svgs.map(s=>{
  const t = s.querySelector('text.plot-label[transform]');
  return { id: s.id.replace(/^gc\d+/, ''), text: t.textContent.replace(/\s+/g, ''), sup: [...t.querySelectorAll('tspan[baseline-shift="super"]')].map(x=> x.textContent) };
}));
// With mass, every axis title in µmol per g, with its superscripts.
const massTitles = async page =>{
  const ys = await yTitles(page);
  assert.deepEqual(ys.map(y=> y.id).sort(), ['Svg1', 'SvgBar', 'SvgCum', 'SvgRate']);
  for (const y of ys){
    const cum = y.id === 'SvgCum';
    assert.equal(y.text, cum ? 'Production(µmolg-1)' : 'ProductionRate(µmolg-1h-1)', y.id);
    assert.deepEqual(y.sup, cum ? ['-1'] : ['-1', '-1'], y.id + ': superscripts');
  }
};
const restore = (page, st)=> page.evaluate(async st=>{
  const u = await import('./utils.js'), db = await import('./db.js');
  u.restoreModuleState('gc', db.decode(st));
  for (let i = 0; i < 2; i++) await new Promise(r=> requestAnimationFrame(r));
}, st).then(()=> settle(page));
const encoded = page => page.evaluate(async ()=>{ const u = await import('./utils.js'), db = await import('./db.js'); return db.encode(u.getModuleState('gc')); });
/* The CSVs with mass (`mass`) against those with area, A the same number as m (`area`): the
   flow over m in mg, the numbers v540 wrote with mass (mmol g⁻¹ h⁻¹, mmol g⁻¹). Every rate
   and production with mass 1000 times area's, to the decimals written; the headers and every
   other column the same. */
function x1000(mass, area){
  const dec = v => (v.split('.')[1] || '').length;
  for (const k of ['gc_raw.csv', 'gc_results.csv', 'mean_rates.csv']){
    const M = csv(mass[k]), A = csv(area[k]);
    assert.deepEqual(M[0].map(h=> h.replace('(umol g^-1', '(umol cm^-2')), A[0], k + ': the headers');
    assert.equal(M.length, A.length, k + ': the rows');
    let n = 0;
    M[0].forEach((h, j)=>{
      const unit = h.includes('(umol g^-1');
      for (let i = 1; i < M.length; i++){
        const b = M[i][j], a = A[i][j];
        if (!unit || a === '' || b === ''){ assert.equal(b, a, `${k} ${h}, row ${i}`); continue; }
        const tol = 1e3*0.5*10**-dec(a) + 0.5*10**-dec(b) + 1e-9*Math.abs(+b);
        assert.ok(Math.abs(+b - 1e3*+a) <= tol, `${k} ${h}, row ${i}: ${b} for 1000 × ${a}`);
        n++;
      }
    });
    assert.ok(n > 0, k + ': its rates compared');
  }
}
const meanOf = (rows, lab, gas)=> parseFloat(rows.slice(1).find(r=> r[0] === lab)[rows[0].findIndex(h=> h.startsWith(`Mean ${gas} `))]);

test('area: the rates per cm² by hand; every label and CSV header follows the choice; both sets of values kept; a step and a change', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'gc');
    await loadFiles(page, 'gc', [film('film-a.csv', '0.05', '0.02'), film('film-b.csv', '0.08', '0.03')]);
    await saveAs(page, 'norm test');
    // Mass by default, as before.
    let c = await card(page);
    assert.equal(c.norm, 'mass');
    assert.equal(await page.inputValue(NORM), 'mass');
    assert.deepEqual(await page.$$eval(`${NORM} option`, os=> os.map(o=> o.value)), ['mass', 'area']);
    assert.equal(await head(page), 'm (mg)');
    await type(page, '#tab-gc .gcShared[data-f="start"]', '0.5');
    await type(page, '#tab-gc .gcShared[data-f="end"]', '1.2');
    await type(page, SH('m'), '20');
    let z = await zip(page), m = csv(z['mean_rates.csv']);
    assert.equal(m[0][1], 'Mean H2 Production Rate (umol g^-1 h^-1)');
    assert.ok(!Object.values(z).some(t=> /mmol/.test(t)), 'no mmol in any CSV');
    // Constant concentrations: the mean rate is the rate, the flow over m in g (µmol g⁻¹ h⁻¹),
    // 1000 times v540's (the flow over m in mg, mmol g⁻¹ h⁻¹).
    assert.ok(Math.abs(meanOf(m, 'film-a', 'H2') - perG(0.05, 20)) <= 1e-6, `mass: ${meanOf(m, 'film-a', 'H2')} for ${perG(0.05, 20)}`);
    assert.ok(Math.abs(meanOf(m, 'film-a', 'H2')/1e3 - v540(0.05, 20)) <= 1e-9, 'mass: 1000 times v540\'s number');
    await massTitles(page);
    assert.equal((await tabLabels(page))[0].endsWith('*'), true, 'the masses typed: unsaved');
    await saveAs(page, 'norm test');
    const h0 = (await history(page, 'gc')).index;

    // Area: the column A (cm²), 1 cm² for each to start with, the mass kept.
    await norm(page, 'area');
    c = await card(page);
    assert.deepEqual([c.norm, c.aMode, c.aShared, c.As, c.mShared, c.mMode], ['area', 'all', 1, [1, 1], 20, 'all']);
    assert.equal(await head(page), 'A (cm²)');
    assert.equal(await page.inputValue(SH('a')), '1');
    assert.equal(await page.locator(SH('m')).count(), 0, 'the m column is A');
    assert.equal(await page.evaluate(()=> document.activeElement && document.activeElement.classList.contains('gc-norm')), true, 'the focus kept on the select');
    assert.equal((await history(page, 'gc')).index, h0 + 1, 'a step of the history');
    assert.equal((await tabLabels(page))[0].endsWith('*'), true, 'a change unsaved');
    // Refused as a mass is: 0, below it, no number.
    for (const v of ['0', '-1', 'abc']){
      await page.fill(SH('a'), v); await page.press(SH('a'), 'Enter');
      assert.ok(await page.$eval(SH('a'), e=> e.classList.contains('field-invalid')), `"${v}" shaken`);
      await settle(page);
      assert.equal((await card(page)).aShared, 1, `"${v}" refused`);
    }
    await type(page, SH('a'), '2.5');
    z = await zip(page); m = csv(z['mean_rates.csv']);
    assert.equal(m[0][1], 'Mean H2 Production Rate (umol cm^-2 h^-1)');
    assert.equal(m[0][2], 'Mean O2 Production Rate (umol cm^-2 h^-1)');
    // By hand: 0.05 %mol of 2 mL/min at 25 °C and 1 atm is 2.4525 µmol/h; over 2.5 cm², 0.98098 µmol cm⁻² h⁻¹.
    assert.ok(Math.abs(umolH(0.05)/2.5 - 0.980977) < 1e-6);
    for (const [lab, gas, pct] of [['film-a', 'H2', 0.05], ['film-a', 'O2', 0.02], ['film-b', 'H2', 0.08], ['film-b', 'O2', 0.03]])
      assert.ok(Math.abs(meanOf(m, lab, gas) - umolH(pct)/2.5) <= 1e-6, `${lab} ${gas}: ${meanOf(m, lab, gas)} for ${umolH(pct)/2.5}`);
    const raw = csv(z['gc_raw.csv'])[0], cut = csv(z['gc_results.csv'])[0], info = csv(z['gc_info.csv']);
    for (const h of ['H2 Production Rate (umol cm^-2 h^-1) [film-a]', 'H2 Production (umol cm^-2) [film-a]', 'O2 Production Rate (umol cm^-2 h^-1) [film-b]']){
      assert.ok(raw.includes(h), 'gc_raw.csv: ' + h); assert.ok(cut.includes(h), 'gc_results.csv: ' + h);
    }
    assert.ok(!raw.concat(cut).some(h=> /mmol|g\^-1/.test(h)), 'no mass unit left');
    assert.deepEqual([info[0][1], info[1][1], info[2][1]], ['A (cm^2)', '2.5', '2.5']);
    // The axis titles, with their superscripts.
    const ys = await yTitles(page);
    assert.deepEqual(ys.map(y=> y.id).sort(), ['Svg1', 'SvgBar', 'SvgCum', 'SvgRate']);
    for (const y of ys){
      const cum = y.id === 'SvgCum';
      assert.equal(y.text, cum ? 'Production(µmolcm-2)' : 'ProductionRate(µmolcm-2h-1)', y.id);
      assert.deepEqual(y.sup, cum ? ['-2'] : ['-2', '-1'], y.id + ': superscripts');
    }
    // Per sample: A one each, film-b's 4 cm²; its rate halves against 2 cm².
    await page.click('#tab-gc .gc-toggle[data-pair="a"]'); await settle(page);
    await type(page, CELL(1, 'a'), '4');
    c = await card(page);
    assert.deepEqual([c.aMode, c.As], ['one', [2.5, 4]]);
    m = csv((await zip(page))['mean_rates.csv']);
    assert.ok(Math.abs(meanOf(m, 'film-b', 'H2') - umolH(0.08)/4) <= 1e-6);
    // With replicates: the SD in the card's unit.
    await page.selectOption('#gcFileTableWrap select.file-sample[data-i="1"]', 'film-a.csv'); await settle(page);
    m = csv((await zip(page))['mean_rates.csv']);
    assert.ok(m[0].includes('H2 SD (umol cm^-2 h^-1)'), m[0].join(' | '));

    // Back to mass: the masses as they were, the labels and the numbers mass's again.
    await norm(page, 'mass');
    c = await card(page);
    assert.deepEqual([c.norm, c.mShared, c.mMode, c.aMode, c.As], ['mass', 20, 'all', 'one', [2.5, 4]], 'both kept');
    assert.equal(await head(page), 'm (mg)');
    assert.equal(await page.inputValue(SH('m')), '20');
    z = await zip(page); m = csv(z['mean_rates_by_file.csv']);
    assert.ok(Math.abs(meanOf(m, 'film-b', 'H2') - perG(0.08, 20)) <= 1e-6);
    assert.ok(csv(z['mean_rates.csv'])[0].includes('H2 SD (umol g^-1 h^-1)'));
    assert.deepEqual(csv(z['gc_info.csv'])[0][1], 'm (mg)');
    await massTitles(page);
    // And to area again: the areas per sample as they were.
    await norm(page, 'area');
    assert.deepEqual(await page.$$eval('#tab-gc .gcCell[data-f="a"]', is=> is.map(i=> i.value)), ['2.5', '4']);
    // Undo and redo the choice.
    await undo(page);
    assert.equal((await card(page)).norm, 'mass');
    assert.equal(await page.inputValue(NORM), 'mass');
    assert.equal(await head(page), 'm (mg)');
    await undo(page, true);
    assert.equal((await card(page)).norm, 'area');
    assert.equal(await page.inputValue(NORM), 'area');
    assert.deepEqual(await page.$$eval('#tab-gc .gcCell[data-f="a"]', is=> is.map(i=> i.value)), ['2.5', '4']);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('the instructions: the formulas from the reading to the rates, one a line; their example by hand', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'gc');
    const eqs = await page.$$eval('#tab-gc .an-instr .instr-eq', es=> es.map(e=> [e.textContent, getComputedStyle(e).display]));
    assert.deepEqual(eqs.map(e=> e[0].split(' ')[0]), ['x', 'ṅ', 'r', 't', 'P(t)', 'r̄'], 'one formula a line');
    assert.ok(eqs.every(e=> e[1] === 'block'));
    assert.match(eqs[1][0], /Q \/ \(1000 mL L⁻¹\) × 60 min h⁻¹ \/ Vm, Vm = R·\(T \+ 273\.15\) \/ \(p \/ 101325 Pa atm⁻¹\).*R = 0\.0820573661 L atm mol⁻¹ K⁻¹/);
    assert.match(eqs[2][0], /^r = x · ṅ · 106 \/ \(m \/ 1000\) in µmol g⁻¹ h⁻¹, m in mg, or r = x · ṅ · 106 \/ A in µmol cm⁻² h⁻¹/);
    // The example: 0.05 %mol of 2 mL/min at 25 °C and 1 atm, as worked out here.
    const text = await page.$eval('#tab-gc .an-instr', e=> e.textContent);
    const ex = `ṅ = ${(F*1e3).toFixed(4)} × 10−3 mol h⁻¹, x · ṅ · 106 = ${umolH(0.05).toFixed(4)} µmol h⁻¹, so r = ${perG(0.05, 15).toFixed(2)} µmol g⁻¹ h⁻¹ over m = 15 mg, or ${(umolH(0.05)/2.5).toFixed(5)} µmol cm⁻² h⁻¹ over A = 2.5 cm²`;
    assert.ok(text.includes(ex), ex);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('projects: one saved before v540 opens with mass and the same CSVs; one with area, with area; a choice edited by hand, mass', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'gc');
    await loadFiles(page, 'gc', [...env.fx.files.gc]);
    await type(page, SH('m'), '12.5');
    const before = await zip(page), st = await encoded(page);
    // As v539 saved it: no choice, no areas.
    const old = JSON.parse(JSON.stringify(st));
    for (const a of old.cards){ for (const k of ['norm', 'As', 'aMode', 'aShared']){ assert.ok(k in a, k); delete a[k]; } }
    await type(page, SH('m'), '30');
    await restore(page, old);
    let c = await card(page);
    assert.deepEqual([c.norm, c.mShared, c.aMode, c.aShared, c.As], ['mass', 12.5, 'all', 1, [1, 1]]);
    assert.deepEqual(await zip(page), before, 'the CSVs byte for byte');
    assert.ok(csv(before['mean_rates.csv'])[0].includes('Mean H2 Production Rate (umol g^-1 h^-1)'));
    // Its rates and production in µmol: 1000 times the numbers v540 wrote, the flow over m in
    // mg, which area gives with A 12.5 cm² for m 12.5 mg.
    await norm(page, 'area');
    await type(page, SH('a'), '12.5');
    x1000(before, await zip(page));
    // Saved with area: opened with it.
    await type(page, SH('a'), '3');
    const withArea = await encoded(page), areaCsv = await zip(page);
    await norm(page, 'mass');
    await restore(page, withArea);
    c = await card(page);
    assert.deepEqual([c.norm, c.aShared, c.mShared], ['area', 3, 12.5]);
    assert.equal(await page.inputValue(NORM), 'area');
    assert.deepEqual(await zip(page), areaCsv);
    // By hand: anything but 'area' is mass; an area that is none, 1 cm².
    for (const v of ['Area', 'volume', 1, null, true]){
      const ed = JSON.parse(JSON.stringify(withArea));
      ed.cards[0].norm = v; ed.cards[0].aShared = -2; ed.cards[0].As = ['x', 0];
      await restore(page, ed);
      c = await card(page);
      assert.deepEqual([c.norm, c.aShared, c.As], ['mass', 1, [1, 1]], JSON.stringify(v));
    }
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
