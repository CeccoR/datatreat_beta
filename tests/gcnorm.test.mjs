/* GC: what a card's rates are normalised by (v540), the photocatalyst's mass (as to v539) or,
   for a film, its area. Every file here is made up for the test.
   - One choice a card, made in the m column's header (v581: to v580 "Normalize by: mass |
     area" on the injection delay's row, gone), a select named for screen readers, m (mg) by
     default, A (cm²); with A the column is A, with its own all/one and per-sample values, an
     area at least 0.001 as a mass is.
   - v585 (the user's decision): every sample has its value. An empty field, 0, below it or no
     number is refused, shared or a sample's, m or A: the field shaken, its rule in red under
     it ("A number, at least 0.001."), its value kept, no step of the history; the rates always
     normalised by the one chosen (v581–v584 took an empty field as none, the rates then not
     normalised, an info under the parameters naming the samples: gone).
   - The rates by hand: a gas's flow in µmol/h over A in cm² (µmol cm⁻² h⁻¹), over m in g
     (µmol g⁻¹ h⁻¹, v541: to v540 mmol g⁻¹ h⁻¹, µmol/h over m in mg, the numbers 1000 times
     smaller); the mean rate of constant concentrations over an interval, with area and with
     mass, in mean_rates.csv.
   - Both in µmol (v541): every rate and production with mass 1000 times v540's number, which
     is the flow over m in mg, as area gives it with A the same number as m (gc_raw.csv,
     gc_results.csv, mean_rates.csv of the fixtures, every column); a project saved before
     v540 opening so.
   - The card's instructions (v542): "From the reading to the rates", a box of numbered
     steps, each formula typeset in MathML (display math) and read back as its structure,
     the formulas the rates are worked out with; drawn as typeset, and at 320 px within the
     window; their example worked through the same steps, its numbers those of the hand
     calculation here.
   - The labels follow the choice: the axis titles of the Analysis plot, the two Results
     plots and the bar chart (their superscripts), the parameter table's column, the CSV
     headers (gc_raw.csv, gc_results.csv, mean_rates.csv with replicates and its SD,
     gc_info.csv's A (cm^2)).
   - The bar chart's value labels, the mean and its ± (with replicates), to 2 decimals with
     mass and with area (v543: to v542, 4): the numbers by hand, rounded.
   - Switching back and forth keeps both the masses and the areas, each with its all/one;
     the choice a step of the history (undo, redo) and a change unsaved ("*").
   - A project saved before v540 (no choice in its state) opens with mass and the same
     CSVs, byte for byte; v540–v580's choice, `norm`, a parameter no longer, ignored: opened
     with m (v581, CLAUDE.md); one saved with A opens with A and its areas, an area or a mass
     none (as v581–v584 saved one left empty) or missing taking the default, 1 cm², 15 mg (v585);
     a choice edited by hand to anything else opens with m. Its rates and production,
     with mass, in µmol: 1000 times the numbers it gave to v540. */
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
// (the m column's header: its select's choice, as it reads)
const head = async page => page.$eval('#tab-gc .gc-param-table:not(.gc-delay) thead th:nth-child(2) .gc-th span select', e=> e.selectedOptions[0].textContent);
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
// The bar chart's value labels, sample by sample, each shown gas in turn (H₂, O₂).
const barLabels = page => page.$eval('#tab-gc svg[id$="SvgBar"]', s=> s._plot._stored.filter(e=> e.type === 'barlabel').map(e=> e.text));
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
/* A value of m or A refused (v585): an empty field, 0, below it, no number; each shaken, its
   rule in red under it, the field given its value back (`shown`), the state's (`get`, a key of
   the card or a function of it) as it was (`was`), no step of the history. The field filled
   where it is, Playwright scrolling it into view (v587: to v586 that scroll's event, a frame
   late, took the rule away; v585 took the field into view first). */
async function refused(page, sel, get, was, shown){
  const h = (await history(page, 'gc')).index, of = c => typeof get === 'function' ? get(c) : c[get + 'Shared'];
  for (const v of ['', '0', '-1', 'abc']){
    await page.fill(sel, v); await page.press(sel, 'Enter');
    assert.ok(await page.$eval(sel, e=> e.classList.contains('field-invalid')), `"${v}" shaken`);
    assert.equal(await page.locator('.field-rule-float').textContent(), 'A number, at least 0.001.', `"${v}": its rule`);
    await settle(page);
    assert.deepEqual([of(await card(page)), await page.inputValue(sel), (await history(page, 'gc')).index], [was, shown, h], `"${v}" refused`);
  }
}
const meanOf = (rows, lab, gas)=> parseFloat(rows.slice(1).find(r=> r[0] === lab)[rows[0].findIndex(h=> h.startsWith(`Mean ${gas} `))]);

test('area: the rates per cm² by hand; every label and CSV header follows the choice; both sets of values kept; a step and a change', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'gc');
    await loadFiles(page, 'gc', [film('film-a.csv', '0.05', '0.02'), film('film-b.csv', '0.08', '0.03')]);
    await saveAs(page, 'norm test');
    // m by default, as before, chosen in the column's header, named for screen readers; no
    // "Normalize by" on the delay's row (v581).
    let c = await card(page);
    assert.equal(c.normBy, 'm');
    assert.ok(!('norm' in c), 'no norm in the state');
    assert.equal(await page.inputValue(NORM), 'm');
    assert.deepEqual(await page.$$eval(`${NORM} option`, os=> os.map(o=> [o.value, o.textContent])), [['m', 'm (mg)'], ['A', 'A (cm²)']]);
    assert.equal(await page.getByRole('combobox', { name: 'Normalize the rates by m or A' }).count(), 1);
    assert.equal(await page.locator('#tab-gc .gc-delay').evaluate(t=> /Normalize/.test(t.textContent) || !!t.querySelector('select')), false, 'none on the delay\'s row');
    assert.equal(await head(page), 'm (mg)');
    await type(page, '#tab-gc .gcShared[data-f="start"]', '0.5');
    await type(page, '#tab-gc .gcShared[data-f="end"]', '1.2');
    await type(page, SH('m'), '20');
    await refused(page, SH('m'), 'm', 20, '20');
    let z = await zip(page), m = csv(z['mean_rates.csv']);
    assert.equal(m[0][1], 'Mean H2 Production Rate (umol g^-1 h^-1)');
    assert.ok(!Object.values(z).some(t=> /mmol/.test(t)), 'no mmol in any CSV');
    // Constant concentrations: the mean rate is the rate, the flow over m in g (µmol g⁻¹ h⁻¹),
    // 1000 times v540's (the flow over m in mg, mmol g⁻¹ h⁻¹).
    assert.ok(Math.abs(meanOf(m, 'film-a', 'H2') - perG(0.05, 20)) <= 1e-6, `mass: ${meanOf(m, 'film-a', 'H2')} for ${perG(0.05, 20)}`);
    assert.ok(Math.abs(meanOf(m, 'film-a', 'H2')/1e3 - v540(0.05, 20)) <= 1e-9, 'mass: 1000 times v540\'s number');
    await massTitles(page);
    // The bars' labels to 2 decimals (v543): 122.62, 49.05, 196.20, 73.57.
    assert.deepEqual(await barLabels(page), [[0.05, 0.02], [0.08, 0.03]].flat().map(p=> perG(p, 20).toFixed(2)), 'mass: the bar labels');
    assert.equal((await tabLabels(page))[0].endsWith('*'), true, 'the masses typed: unsaved');
    await saveAs(page, 'norm test');
    const h0 = (await history(page, 'gc')).index;

    // Area: the column A (cm²), 1 cm² for each to start with, the mass kept.
    await norm(page, 'A');
    c = await card(page);
    assert.deepEqual([c.normBy, c.aMode, c.aShared, c.As, c.mShared, c.mMode], ['A', 'all', 1, [1, 1], 20, 'all']);
    assert.equal(await head(page), 'A (cm²)');
    assert.equal(await page.inputValue(SH('a')), '1');
    assert.equal(await page.locator(SH('m')).count(), 0, 'the m column is A');
    assert.equal(await page.evaluate(()=> document.activeElement && document.activeElement.classList.contains('gc-norm')), true, 'the focus kept on the select');
    assert.equal((await history(page, 'gc')).index, h0 + 1, 'a step of the history');
    assert.equal((await tabLabels(page))[0].endsWith('*'), true, 'a change unsaved');
    /* Refused as a mass is (v585: empty too, the user's decision; v581–v584 took it as none, the
       rates then not normalised): the field shaken, its rule in red under it, its value kept,
       no step of the history; nothing said under the parameters. */
    await refused(page, SH('a'), 'a', 1, '1');
    assert.equal(await page.locator('#tab-gc .gc-norm-info, #tab-gc [id$="NormInfo"]').count(), 0, 'no info under the parameters');
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
    // The bars' labels to 2 decimals (v543): 0.98, 0.39, 1.57, 0.59.
    assert.deepEqual(await barLabels(page), [0.05, 0.02, 0.08, 0.03].map(p=> (umolH(p)/2.5).toFixed(2)), 'area: the bar labels');
    // The axis titles, with their superscripts.
    const ys = await yTitles(page);
    assert.deepEqual(ys.map(y=> y.id).sort(), ['Svg1', 'SvgBar', 'SvgCum', 'SvgRate']);
    for (const y of ys){
      const cum = y.id === 'SvgCum';
      assert.equal(y.text, cum ? 'Production(µmolcm-2)' : 'ProductionRate(µmolcm-2h-1)', y.id);
      assert.deepEqual(y.sup, cum ? ['-2'] : ['-2', '-1'], y.id + ': superscripts');
    }
    // Per sample: A one each, film-b's 4 cm²; its rate halves against 2 cm². A sample's field
    // refused as the shared one is (v585), its value kept.
    await page.click('#tab-gc .gc-toggle[data-pair="a"]'); await settle(page);
    await refused(page, CELL(1, 'a'), c => c.As[1], 2.5, '2.5');
    await type(page, CELL(1, 'a'), '4');
    c = await card(page);
    assert.deepEqual([c.aMode, c.As], ['one', [2.5, 4]]);
    m = csv((await zip(page))['mean_rates.csv']);
    assert.ok(Math.abs(meanOf(m, 'film-b', 'H2') - umolH(0.08)/4) <= 1e-6);
    // With replicates: the SD in the card's unit.
    await page.selectOption('#gcFileTableWrap select.file-sample[data-i="1"]', 'film-a.csv'); await settle(page);
    m = csv((await zip(page))['mean_rates.csv']);
    assert.ok(m[0].includes('H2 SD (umol cm^-2 h^-1)'), m[0].join(' | '));
    // Its labels, the mean ± the SD, both to 2 decimals: 0.98±0.00 (the same rate, 0.02 %mol
    // per cm² each), 0.38±0.02.
    const mean = a => (a[0] + a[1])/2, sd = a => Math.abs(a[0] - a[1])/Math.SQRT2;
    const h2 = [umolH(0.05)/2.5, umolH(0.08)/4], o2 = [umolH(0.02)/2.5, umolH(0.03)/4];
    assert.deepEqual(await barLabels(page), [h2, o2].map(a=> `${mean(a).toFixed(2)}±${sd(a).toFixed(2)}`), 'area with replicates: the bar labels');

    // Back to mass: the masses as they were, the labels and the numbers mass's again.
    await norm(page, 'm');
    c = await card(page);
    assert.deepEqual([c.normBy, c.mShared, c.mMode, c.aMode, c.As], ['m', 20, 'all', 'one', [2.5, 4]], 'both kept');
    assert.equal(await head(page), 'm (mg)');
    assert.equal(await page.inputValue(SH('m')), '20');
    z = await zip(page); m = csv(z['mean_rates_by_file.csv']);
    assert.ok(Math.abs(meanOf(m, 'film-b', 'H2') - perG(0.08, 20)) <= 1e-6);
    assert.ok(csv(z['mean_rates.csv'])[0].includes('H2 SD (umol g^-1 h^-1)'));
    assert.deepEqual(csv(z['gc_info.csv'])[0][1], 'm (mg)');
    await massTitles(page);
    // And to area again: the areas per sample as they were.
    await norm(page, 'A');
    assert.deepEqual(await page.$$eval('#tab-gc .gcCell[data-f="a"]', is=> is.map(i=> i.value)), ['2.5', '4']);
    // Undo and redo the choice: one step each way.
    const h1 = (await history(page, 'gc')).index;
    await undo(page);
    assert.equal((await history(page, 'gc')).index, h1 - 1);
    assert.equal((await card(page)).normBy, 'm');
    assert.equal(await page.inputValue(NORM), 'm');
    assert.equal(await head(page), 'm (mg)');
    await undo(page, true);
    assert.equal((await card(page)).normBy, 'A');
    assert.equal(await page.inputValue(NORM), 'A');
    assert.deepEqual(await page.$$eval('#tab-gc .gcCell[data-f="a"]', is=> is.map(i=> i.value)), ['2.5', '4']);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

/* The card's instructions (v542): "From the reading to the rates", a box of its own, its
   steps numbered, each a title, what it means, its formula typeset in MathML (display math)
   and the units of its symbols; then the example worked through the same steps. Each
   formula read back as its structure (MathML's elements as functions: frac(a,b), sub(a,b),
   sup(a,b), subsup and underover(a,b,c), over(a,mark), table(cell|cell;row)), against the
   formulas the module works the rates out with; the example's numbers those of the hand
   calculation here. Drawn: every formula on lines of its own, a fraction's numerator over
   its denominator, a subscript under its base's top and a superscript over its bottom, the
   integral's limits beside it, the sum's under and over it, the cases one under the other;
   at 320 px nothing past the window, a formula wider than the box scrolling inside its own. */
const BOX = '#tab-gc .an-instr .instr-math';
const openInstr = async page =>{
  await loadFiles(page, 'gc', [film('film-a.csv', '0.05', '0.02')]);
  await page.click('#tab-gc .an-card .an-head .instr-info');
  await page.waitForSelector(BOX, { state: 'visible' });
};
test('the instructions: from the reading to the rates, numbered steps in a box of their own, each formula typeset in MathML; their example by hand', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'gc');
    await openInstr(page);
    const box = await page.$eval(BOX, b=>{
      const MATH = 'http://www.w3.org/1998/Math/MathML';
      const lin = e =>{
        const k = [...e.children].map(lin), n = e.localName;
        if (n === 'mfrac') return `frac(${k[0]},${k[1]})`;
        if (n === 'msub') return `sub(${k[0]},${k[1]})`;
        if (n === 'msup') return `sup(${k[0]},${k[1]})`;
        if (n === 'msubsup') return `subsup(${k.join(',')})`;
        if (n === 'munderover') return `underover(${k.join(',')})`;
        if (n === 'mover') return `over(${k.join(',')})`;
        if (n === 'mtable') return `table(${k.join(';')})`;
        if (n === 'mtr') return k.join('|');
        if (n === 'mspace') return ' ';
        return e.children.length ? k.join('') : e.textContent.replace(/ /g, ' ');
      };
      const txt = e => e.textContent.replace(/\s+/g, ' ').trim();
      const steps = ol => [...ol.children].map(li=> ({
        title: li.querySelector(':scope > b').textContent,
        eqs: [...li.querySelectorAll(':scope > .instr-eqbox > math')].map(m=> ({ ns: m.namespaceURI === MATH, block: m.getAttribute('display') === 'block' && getComputedStyle(m).display === 'block math', f: lin(m) })),
        lines: [...li.querySelectorAll(':scope > .instr-units')].map(txt),
      }));
      const ols = b.querySelectorAll(':scope > ol.instr-steps');
      return { heads: [...b.querySelectorAll(':scope > .instr-math-head')].map(txt), lead: txt(b.querySelector('.instr-math-lead')), n: ols.length, steps: steps(ols[0]), example: steps(ols[1]),
        bg: [getComputedStyle(b).backgroundColor, getComputedStyle(b.closest('.instr-block')).backgroundColor] };
    });
    assert.deepEqual(box.heads, ['From the reading to the rates', 'Worked example']);
    assert.notEqual(box.bg[0], box.bg[1], 'the box set apart from the instructions around it');
    assert.equal(box.lead, "As they are worked out for each gas, from each injection's reading c:");
    assert.equal(box.n, 2);
    const S = box.steps;
    assert.deepEqual(S.map(s=> s.title), ['Mole fraction from the reading.', 'Molar flow of the carrier.', 'Flow of the gas produced.', 'Rate.', 'Time.', 'Production.', 'Mean rate.']);
    for (const s of [...S, ...box.example]) assert.ok(s.eqs.length && s.eqs.every(e=> e.ns && e.block), s.title + ': display MathML');
    assert.ok(S.every(s=> s.lines.length), 'each step its units');
    // The formulas, as tablesOf, cumAt and computeRates work them out.
    assert.deepEqual(S.map(s=> s.eqs.map(e=> e.f)), [
      ['x={table(frac(c,100),|c in %mol;c⋅sup(10,−6),|c in ppm)'],
      ['sub(V,m)=frac(R(T+273.15),p/101325)', 'over(n,˙)=frac(Q,1000)⋅frac(60,sub(V,m))'],
      ['F=x⋅over(n,˙)⋅sup(10,6)'],
      ['r={table(frac(F,m/1000),|by mass;frac(F,A),|by area)'],
      ['t=frac(sub(t,inj)+Δsub(t,delay)−sub(t,on),3600)'],
      ['P(t)=subsup(∫,sub(t,s),t)r dsup(t,′)', 'P(t)=underover(∑,i=0,n−1)frac(sub(r,i)+sub(r,i+1),2)⋅(sub(t,i+1)−sub(t,i))'],
      ['over(r,¯)=frac(P(sub(t,e)),sub(t,e)−sub(t,s))'],
    ]);
    // Their units and notes: R, the molar volume at 0 °C and 25 °C by hand, the assumption.
    assert.ok(S[1].lines[0].includes('R = 0.0820573661 L atm mol⁻¹ K⁻¹; T: °C; p: Pa (101325 Pa atm⁻¹); Q: mL min⁻¹'), S[1].lines[0]);
    assert.equal(S[1].lines[1], `At 1 atm, Vm is ${(R*273.15).toFixed(3)} L mol⁻¹ at 0 °C and ${(R*298.15).toFixed(3)} L mol⁻¹ at 25 °C.`);
    assert.match(S[1].lines[0], /Q: mL min⁻¹, at the controller's reference T and p/);
    assert.match(S[2].lines[1], /^Assumed: the carrier's flow n˙ is the total flow leaving the reactor.*\(ppm to a few %mol\)\.$/);
    assert.match(S[3].lines[0], /^r: µmol g⁻¹ h⁻¹ with m in mg \(1000 mg g⁻¹\), or µmol cm⁻² h⁻¹ with A in cm²\.$/);
    assert.match(S[4].lines[1], /^At light-on, t=0: a point with the last reading before it \(r=0 if there is none\)\.$/);
    // The example, 0.05 %mol of 2 mL/min at 25 °C and 1 atm over 15 mg or 2.5 cm², step by step as worked out here.
    const vm = (R*298.15).toFixed(3), nd = (F*1e3).toFixed(4), fl = umolH(0.05).toFixed(4);
    assert.deepEqual(box.example.map(s=> s.title), ['Mole fraction.', 'Molar flow.', 'Flow of the gas.', 'Rate.']);
    assert.deepEqual(box.example.map(s=> s.eqs.map(e=> e.f)), [
      ['x=frac(0.05,100)=5×sup(10,−4)'],
      [`sub(V,m)=frac(0.0820573661×(25+273.15),101325/101325)=${vm} L sup(mol,−1)`, `over(n,˙)=frac(2,1000)⋅frac(60,${vm})=${nd}×sup(10,−3) mol sup(h,−1)`],
      [`F=(5×sup(10,−4))×(${nd}×sup(10,−3))×sup(10,6)=${fl} µmol sup(h,−1)`],
      [`r=frac(${fl},15/1000)=${perG(0.05, 15).toFixed(2)} µmol sup(g,−1) sup(h,−1)`, `r=frac(${fl},2.5)=${(umolH(0.05)/2.5).toFixed(5)} µmol sup(cm,−2) sup(h,−1)`],
    ]);
    assert.deepEqual([vm, nd, fl, perG(0.05, 15).toFixed(2), (umolH(0.05)/2.5).toFixed(5)], ['24.465', '4.9049', '2.4524', '163.50', '0.98098']);
    // Drawn as typeset: each part where it belongs.
    const drawn = await page.$eval(BOX, b=>{
      const r = e => e.getBoundingClientRect(), out = [], all = s => [...b.querySelectorAll(s)];
      for (const m of all('math')){ const q = r(m); if (!(q.width > 0 && q.height > 0)) out.push('empty math'); }
      for (const f of all('mfrac')){ const [a, d] = [...f.children].map(r); if (!(a.bottom <= d.top + 0.5 && a.height && d.height)) out.push('frac ' + f.textContent); }
      for (const s of all('msub')){ const [a, x] = [...s.children].map(r); if (!(x.bottom > a.bottom && x.left >= a.right - 1)) out.push('sub ' + s.textContent); }
      for (const s of all('msup')){ const [a, x] = [...s.children].map(r); if (!(x.top < a.top + 0.5 && x.left >= a.right - 1)) out.push('sup ' + s.textContent); }
      for (const s of all('msubsup')){ const [a, lo, hi] = [...s.children].map(r); if (!(lo.top >= hi.bottom && lo.left >= a.left && hi.left >= a.left)) out.push('subsup ' + s.textContent); }
      for (const s of all('munderover')){ const [a, lo, hi] = [...s.children].map(r); if (!(lo.top >= a.bottom - 1 && hi.bottom <= a.top + 1)) out.push('underover ' + s.textContent); }
      for (const t of all('mtable')){ const [a, c] = [...t.children].map(r); if (!(c.top >= a.bottom - 0.5)) out.push('table ' + t.textContent); }
      for (const e of all('.instr-eqbox')) if (getComputedStyle(e).overflowX !== 'auto') out.push('eqbox overflow');
      return { out, n: ['math', 'mfrac', 'msub', 'msup', 'msubsup', 'munderover', 'mtable'].map(s=> all(s).length) };
    });
    assert.deepEqual(drawn.out, []);
    assert.ok(drawn.n.every(k=> k > 0), 'each kind checked: ' + drawn.n);
    assert.deepEqual(errors, []);
  } finally { await close(); }
  // At 320 px: nothing past the window, the page not scrolling sideways.
  const narrow = await env.page({ viewport: { width: 320, height: 700 } });
  try {
    await openModule(narrow.page, 'gc');
    await openInstr(narrow.page);
    const m = await narrow.page.$eval(BOX, b=> ({ scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      right: Math.max(...[b, ...b.querySelectorAll('.instr-eqbox, .instr-units, li, p')].map(e=> e.getBoundingClientRect().right)) }));
    assert.equal(m.scroll, 0, 'the page scrolls sideways');
    assert.ok(m.right <= 320, 'past the window: ' + m.right);
    assert.deepEqual(narrow.errors, []);
  } finally { await narrow.close(); }
});

test('projects: one saved before v540 opens with mass and the same CSVs; v540–v580\'s choice ignored (m); one with A, with A, an area or a mass none or missing the default (v585); a choice edited by hand, m', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'gc');
    await loadFiles(page, 'gc', [...env.fx.files.gc]);
    await type(page, SH('m'), '12.5');
    const before = await zip(page), st = await encoded(page);
    // As v539 saved it: no choice, no areas.
    const old = JSON.parse(JSON.stringify(st));
    for (const a of old.cards){ for (const k of ['normBy', 'As', 'aMode', 'aShared']){ assert.ok(k in a, k); delete a[k]; } }
    await type(page, SH('m'), '30');
    await restore(page, old);
    let c = await card(page);
    assert.deepEqual([c.normBy, c.mShared, c.aMode, c.aShared, c.As], ['m', 12.5, 'all', 1, [1, 1]]);
    assert.deepEqual(await zip(page), before, 'the CSVs byte for byte');
    assert.ok(csv(before['mean_rates.csv'])[0].includes('Mean H2 Production Rate (umol g^-1 h^-1)'));
    // Its rates and production in µmol: 1000 times the numbers v540 wrote, the flow over m in
    // mg, which area gives with A 12.5 cm² for m 12.5 mg.
    await norm(page, 'A');
    await type(page, SH('a'), '12.5');
    x1000(before, await zip(page));
    // Saved with A: opened with it.
    await type(page, SH('a'), '3');
    const withArea = await encoded(page), areaCsv = await zip(page);
    await norm(page, 'm');
    await restore(page, withArea);
    c = await card(page);
    assert.deepEqual([c.normBy, c.aShared, c.mShared], ['A', 3, 12.5]);
    assert.equal(await page.inputValue(NORM), 'A');
    assert.deepEqual(await zip(page), areaCsv);
    // v540–v580's choice, `norm` (area), a parameter no longer: ignored, opened with m (v581).
    const v580 = JSON.parse(JSON.stringify(withArea));
    delete v580.cards[0].normBy; v580.cards[0].norm = 'area';
    await restore(page, v580);
    c = await card(page);
    assert.deepEqual([c.normBy, 'norm' in c, c.aShared, await page.inputValue(NORM)], ['m', false, 3, 'm']);
    /* An area or a mass none, as v581–v584 saved one left empty (null), or missing: the default
       (v585, CLAUDE.md: a missing parameter takes its default), 1 cm², 15 mg; the rates
       normalised by it, nothing said. */
    for (const k of ['null', 'missing']){
      const none = JSON.parse(JSON.stringify(withArea));
      if (k === 'null'){ none.cards[0].aShared = null; none.cards[0].mShared = null; none.cards[0].ms = [null, null]; }
      else for (const f of ['aShared', 'mShared', 'ms', 'As']) delete none.cards[0][f];
      await restore(page, none);
      c = await card(page);
      assert.deepEqual([c.normBy, c.aShared, c.mShared, c.ms, await page.inputValue(SH('a'))], ['A', 1, 15, [15, 15], '1'], k);
      const mr = csv((await zip(page))['mean_rates.csv']);
      assert.equal(mr[0][1], 'Mean H2 Production Rate (umol cm^-2 h^-1)', k);
      const at3 = +csv(areaCsv['mean_rates.csv'])[1][1];
      assert.ok(Math.abs(+mr[1][1] - 3*at3) <= 1e-5*Math.abs(3*at3), `${k}: over 1 cm², 3 times its rate over 3 cm²: ${mr[1][1]}, ${at3}`);
      assert.equal(await page.locator('#tab-gc .gc-norm-info, #tab-gc [id$="NormInfo"]').count(), 0, k + ': nothing said');
    }
    // By hand: anything but 'A' is m; an area that is no number above 0, 1 cm².
    for (const v of ['a', 'area', 'mass', 1, null, true]){
      const ed = JSON.parse(JSON.stringify(withArea));
      ed.cards[0].normBy = v; ed.cards[0].aShared = -2; ed.cards[0].As = ['x', 0];
      await restore(page, ed);
      c = await card(page);
      assert.deepEqual([c.normBy, c.aShared, c.As], ['m', 1, [1, 1]], JSON.stringify(v));
    }
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
