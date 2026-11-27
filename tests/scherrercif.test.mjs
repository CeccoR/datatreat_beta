/* XRPD's Scherrer card: each sample's CIF (v575), one or none, in place of v574's peaks
   matched across samples.
   - a CIF read for a sample by its selector's Add CIF… (the file chooser opened from it),
     another sample given another (the tetragonal one) and a third none: the first's peaks
     named (100) to (310), the second's with (101)/(110) where two reflections fall within half
     a FWHM, the third's listed with no hkl; the rule in grey under the table; the size chart
     by sample, a series a species (two), the third not charted and said so; by peak, a box per
     species' reflection; the CSVs with the species and hkl;
   - the pool: a sample's CIF offered to the others, a Rietveld card's phase too;
   - a choice undone and redone, the selector, the table and the state with it;
   - the project exported and opened again: the CIFs, the table, the chart as they were;
   - a project of an older version (no CIFs: its peaks were matched across samples): opened
     with no error, no CIF, its peaks not grouped, an info box saying so in the card, gone with
     the first CIF chosen, back with its undo;
   - the right column's first title level with the plot frame's top (CLAUDE.md), with the CIF's
     row and the note under it;
   - (v576) by peak, each reflection by its hkl alone, whole (to v575 its species before it, cut
     in the middle), each box of one sample seen in its colour (to v575 its lines alone);
   - (v576) the CIFs' texts saved once (a pool in the card's state, the samples referring to
     it), undone, redone, exported and opened again as before; a project of v575 (each sample
     its text) opened as it was; a card switched to Rietveld and back, a sample left out and
     taken back in meanwhile, its CIF kept;
   - (v576) a pattern whose Kα2 peaks are resolved (115° to 140°): each named "(hkl) Kα2" (to
     v575 unassigned), out of the sizes and the chart, the rule in grey saying so;
   - (v577) a sample left out holding its CIF by the card's pool in the project (to v576 its
     text whole, once more), with the card a Scherrer and a Rietveld one, the text in the pool
     though no sample in use has it; the project opened again, the sample taken back in with
     its CIF, undone and redone.
   No page error, no CSP violation. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start, openModule, loadFiles, settle, moduleState, undo, download, readZip, parseCsv, exportProject, importProject, projectFile, openProject, firstTop } from './helpers.mjs';
import { xrdml, PEROV_HI } from './fixtures.mjs';

let env;
before(async ()=>{ env = await start(); });
after(()=> env && env.close());

const P = '#xrdA1';
// The table's head and its rows' cells; the selector's value, its options' texts; the card's state.
const table = page => page.$eval(P + 'PeakTableWrap', w=> ({ head: [...w.querySelectorAll('th')].map(t=> t.textContent), rows: [...w.querySelectorAll('.peak-row')].map(r=> [...r.cells].map(c=> c.textContent)),
  rule: (w.querySelector('.xrd-hkl-rule') || {}).textContent || null }));
const sel = page => page.$eval(P + 'Cif', s=> ({ value: s.value, shown: s.selectedOptions[0] ? s.selectedOptions[0].textContent : null, options: [...s.options].map(o=> o.textContent), disabled: s.disabled }));
const scherrer = async page => (await moduleState(page, 'xrd')).cards[0].states.scherrer;
const cifFiles = async page => (await scherrer(page)).cif.map(q=> q && q.file);
// The size chart: its legend, its names under it, its boxes' colours and least height (px), the note under it.
const chart = page => page.evaluate(p=>{
  const svg = document.querySelector(p + 'SizeBarSvg'), wrap = svg.closest('.plot-wrap'), rects = [...svg.querySelectorAll('rect')].filter(r=> /^#/.test(r.getAttribute('fill')));
  return { shown: wrap.style.display !== 'none', legend: [...document.querySelectorAll(p + 'SizeBarLegend span')].map(s=> s.textContent),
    names: [...svg.querySelectorAll('.plot-tick')].map(t=> t.textContent).filter(t=> !/^[\d.]+$/.test(t)),
    boxes: rects.map(r=> r.getAttribute('fill')), least: Math.min(...rects.map(r=> r.getBoundingClientRect().height)), note: document.querySelector(p + 'SizeByNote').textContent,
    chips: [...document.querySelectorAll(p + 'SizeBy [data-size-by]')].map(b=> b.dataset.sizeBy + (b.disabled ? ':off' : '')) };
}, P);
const step = async page =>{ await page.click(P + 'Next'); await settle(page); };
// A CIF read for the sample on show, as a person does: Add CIF… chosen by the keyboard (a
// gesture: the file chooser opens), the file given to it.
async function addCif(page, file){
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), (async ()=>{ await page.focus(P + 'Cif'); await page.keyboard.press('End'); })()]);
  await fc.setFiles(file);
  await page.waitForFunction(p=> [...document.querySelectorAll(p + 'PeakTableWrap th')].some(t=> t.textContent === 'hkl'), P);
  await settle(page);
}
// The card made another kind; a file left out or taken back in (what: its box ticked after).
async function kindOf(page, k){ await page.click('#tab-xrd .an-card[data-an="1"] .an-type'); await page.click(`.an-menu:not([hidden]) [data-kind="${k}"]`); await settle(page); }
async function leave(page, i, what){ await page.locator('#xrdFileTableWrap .file-incl').nth(i).click(); await settle(page); assert.ok(what === await page.locator('#xrdFileTableWrap .file-incl').nth(i).isChecked()); }
const HKL = ['(100)', '(110)', '(111)', '(200)', '(211)', '(220)', '(310)'];
const filesOf = d => Object.fromEntries(readZip(d.buf).map(e=> [e.name.replace(/^.* - /, ''), parseCsv(e.data.toString('utf8').replace(/^﻿/, ''), ';')]));

test('a CIF a sample: the hkl, the species\' series, the samples with none, the pool, the CSVs, undo and redo, the project opened again', async ()=>{
  const { page, errors, close } = await env.page({ viewport: { width: 1400, height: 1000 } });
  try {
    await openModule(page, 'xrd');
    await loadFiles(page, 'xrd', env.fx.files.xrd);
    assert.deepEqual(await sel(page), { value: '', shown: 'none', options: ['none', 'Add CIF…'], disabled: false });
    assert.deepEqual((await chart(page)).shown, false, 'no CIF: nothing charted');
    assert.equal((await chart(page)).note, 'Not charted, no CIF: s00, s01, s02.');
    // s00: the fixture's SrTiO₃, read by Add CIF….
    await addCif(page, env.fx.cif);
    let t = await table(page);
    assert.deepEqual(t.head.slice(0, 4), ['#', '2θ (°)', 'hkl', 'Relative Intensity']);
    assert.deepEqual(t.rows.map(r=> r[2]), HKL);
    assert.equal(t.rule, 'hkl: the reflections of SrTiO3 at λ 1.540598 Å within 0.5 FWHM of a peak\'s 2θ, 0.1° at least.');
    assert.deepEqual(await sel(page), { value: '0', shown: 'SrTiO3', options: ['none', 'SrTiO3', 'Add CIF…'], disabled: false });
    // s01: the tetragonal one (its (101) and (110) both within half the FWHM of a peak).
    await step(page);
    assert.deepEqual((await sel(page)).shown, 'none');
    await addCif(page, env.fx.tetra);
    t = await table(page);
    assert.deepEqual(t.rows.map(r=> r[2]), ['(100)', '(101)/(110)', '(111)', '(200)', '(211)', '(220)', '(301)/(310)']);
    assert.deepEqual((await sel(page)).options, ['none', 'SrTiO3', 'BaTiO3', 'Add CIF…']);
    // s02: none: its peaks listed, no hkl, not charted.
    await step(page);
    t = await table(page);
    assert.deepEqual([t.head.includes('hkl'), t.rows.length, t.rule], [false, 7, null]);
    assert.deepEqual(await cifFiles(page), ['SrTiO3.cif', 'BaTiO3_tetra.cif', null]);
    let c = await chart(page);
    assert.deepEqual([c.shown, c.legend, c.names, c.boxes, c.note, c.chips], [true, ['SrTiO3', 'BaTiO3'], ['s00', 's01'], ['#3aa0ff', '#ff7a59'], 'Not charted, no CIF: s02.', ['sample', 'peak']]);
    assert.ok(c.least >= 6.5, `a box of several sizes, at least the mean's cross tall: ${c.least}`);
    // By peak: a box per species' reflection, over its samples (one each here): each seen in
    // its colour, its name its hkl alone, whole (v576); its species its colour's, in the legend.
    await page.click(P + 'SizeBy [data-size-by="peak"]'); await settle(page);
    c = await chart(page);
    const TET_HKL = ['(100)', '(101)/(110)', '(111)', '(200)', '(211)', '(220)', '(301)/(310)'], byPeak = [...HKL.map(h=> 'SrTiO3 ' + h), ...TET_HKL.map(h=> 'BaTiO3 ' + h)];
    assert.deepEqual(c.names, [...HKL, ...TET_HKL]);
    assert.deepEqual([c.legend, c.boxes, c.least >= 6.5], [['SrTiO3', 'BaTiO3'], [...HKL.map(()=> '#3aa0ff'), ...TET_HKL.map(()=> '#ff7a59')], true], `one sample a box, seen: ${c.least} px`);
    // The CSVs: the species and hkl of each peak, the sizes by species and hkl.
    const z = filesOf(await download(page, ()=> page.click('.proj-csv')));
    const pk = z['peaks.csv'], colOf = h => pk.slice(1).map(r=> r[pk[0].indexOf(h)]).filter(v=> v !== '');
    assert.deepEqual([colOf('Peak_hkl_s00'), colOf('Peak_hkl_s01').slice(0, 2), colOf('Peak_Species_s01')[0], colOf('Peak_hkl_s02'), colOf('Peak_Species_s02')], [HKL, ['(100)', '(101)/(110)'], 'BaTiO3', [], []]);
    assert.deepEqual(z['crystallite_size.csv'].map(r=> r.slice(0, 2)), [['Sample', 'Species'], ['s00', 'SrTiO3'], ['s01', 'BaTiO3'], ['s02', '']]);
    const bp = z['crystallite_size_by_peak.csv'];
    assert.deepEqual([bp[0].slice(0, 3), bp[0].slice(-2), bp.slice(1).map(r=> r[0] + ' ' + r[1])], [['Species', 'hkl', 'Crystallite_size_nm'], ['Crystallite_size_nm_s00', 'Crystallite_size_nm_s01'], byPeak]);
    // The pool: s02 given s00's CIF from its selector; a Rietveld card's phase offered too.
    await page.selectOption(P + 'Cif', { label: 'SrTiO3' }); await settle(page);
    assert.deepEqual([(await table(page)).rows.map(r=> r[2]).filter(h=> h !== 'unassigned').length > 0, await cifFiles(page)], [true, ['SrTiO3.cif', 'BaTiO3_tetra.cif', 'SrTiO3.cif']]);
    // Its text saved once (v576): the state's pool, two texts for three samples.
    const sc = await scherrer(page);
    assert.deepEqual([sc.cif.map(q=> q.ref), sc.cifTexts.length, JSON.stringify(sc).split('data_SrTiO3').length - 1], [[0, 1, 0], 2, 1]);
    assert.deepEqual((await chart(page)).note, '');
    const cu = env.fx.put('Cu_fcc.cif', "data_Cu\n_cell_length_a 3.615\n_cell_length_b 3.615\n_cell_length_c 3.615\n_cell_angle_alpha 90\n_cell_angle_beta 90\n_cell_angle_gamma 90\n_chemical_formula_sum 'Cu4'\n"
      + "loop_\n_symmetry_equiv_pos_as_xyz\n'x, y, z'\nloop_\n_atom_site_label\n_atom_site_type_symbol\n_atom_site_fract_x\n_atom_site_fract_y\n_atom_site_fract_z\nCu1 Cu 0 0 0\nCu2 Cu 0.5 0.5 0\nCu3 Cu 0.5 0 0.5\nCu4 Cu 0 0.5 0.5\n");
    await page.setInputFiles('#xrdR2CifInput', cu);
    await page.waitForSelector('#xrdR2PhaseList input[data-on]'); await settle(page);
    assert.deepEqual((await sel(page)).options, ['none', 'SrTiO3', 'BaTiO3', 'Cu4', 'Add CIF…'], 'the cards\' in their order, each once');
    // Undo and redo, a step each: the Rietveld card's phase, then s02's CIF.
    await undo(page);
    assert.deepEqual((await sel(page)).options, ['none', 'SrTiO3', 'BaTiO3', 'Add CIF…']);
    await undo(page);
    assert.deepEqual([await cifFiles(page), (await sel(page)).value, (await table(page)).head.includes('hkl'), (await chart(page)).note], [['SrTiO3.cif', 'BaTiO3_tetra.cif', null], '', false, 'Not charted, no CIF: s02.']);
    await undo(page, true);
    assert.deepEqual([await cifFiles(page), (await sel(page)).shown, (await table(page)).head.includes('hkl')], [['SrTiO3.cif', 'BaTiO3_tetra.cif', 'SrTiO3.cif'], 'SrTiO3', true]);
    // None again for s02, then the project exported and opened again from its file.
    await page.selectOption(P + 'Cif', ''); await settle(page);
    const { obj } = await exportProject(page);
    await importProject(page, projectFile(env, 'cifs.datatreat', { ...obj, title: 'CIFs again' }));
    await openProject(page, 'xrd', 'CIFs again');
    assert.deepEqual(await cifFiles(page), ['SrTiO3.cif', 'BaTiO3_tetra.cif', null]);
    assert.equal((await table(page)).head.includes('hkl'), false, 's02 on show, as it was saved');
    for (const want of [HKL, ['(100)', '(101)/(110)', '(111)', '(200)', '(211)', '(220)', '(301)/(310)']]){
      await step(page);
      assert.deepEqual((await table(page)).rows.map(r=> r[2]), want);
    }
    c = await chart(page);
    assert.deepEqual([c.legend, c.note, c.chips, c.names.length], [['SrTiO3', 'BaTiO3'], 'Not charted, no CIF: s02.', ['sample', 'peak'], 14], 'by peak, as it was left');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('an older version\'s project: no CIF, its peaks not grouped, the note in the card until a CIF is chosen; the tops aligned (CLAUDE.md)', async ()=>{
  const { page, errors, close } = await env.page({ viewport: { width: 1400, height: 1000 } });
  try {
    await openModule(page, 'xrd');
    await loadFiles(page, 'xrd', env.fx.files.xrd);
    // As v574 saved it: no samples' CIFs, the chart by peak (its peaks matched across samples).
    const { obj } = await exportProject(page), st = obj.state;
    const cards = st.cards.map(a=> a.type !== 'scherrer' ? a : { ...a, states: { ...a.states, scherrer: (({ cif, ...s })=> ({ ...s, sizeBy: 'peak' }))(a.states.scherrer) } });
    assert.ok(!('cif' in cards[0].states.scherrer));
    await importProject(page, projectFile(env, 'v574.datatreat', { ...obj, title: 'Old XRPD', appVersion: 'v574', state: { ...st, cards } }, { sign: true }));
    await openProject(page, 'xrd', 'Old XRPD');
    const note = page => page.$eval(P + 'CifNote', n=> [...n.querySelectorAll('.alert')].map(a=> a.className + ': ' + a.textContent));
    assert.deepEqual(await note(page), ['alert info compact: Opened from an older version: its peaks were matched across samples, which is no longer done. A sample\'s peaks are grouped by the reflections of the CIF chosen for it.']);
    assert.deepEqual([await cifFiles(page), (await scherrer(page)).oldGroups, (await table(page)).head.includes('hkl'), (await table(page)).rows.length], [[null, null, null], true, false, 7]);
    const c = await chart(page);
    assert.deepEqual([c.shown, c.chips, c.note], [false, [], 'Not charted, no CIF: s00, s01, s02.']);
    // The right column's first title on the plot frame's top, the note under the CIF's row.
    const top = await firstTop(page, '#tab-xrd .an-card:nth-child(1)', { frame: 'svg.plot', head: ':scope .col.mw280 > .param-head' });
    assert.ok(Math.abs(top.top - top.frame) <= 1, `the title ${top.text}'s top ${top.top}, the plot frame's ${top.frame}`);
    const order = await page.$eval(P + 'Cif', s=>{ const col = s.closest('.col'), at = e => e.getBoundingClientRect(); return { below: at(col.querySelector('[id$="CifNote"]')).top >= at(s).bottom, inCol: at(s).right <= at(col).right + 0.5 }; });
    assert.deepEqual(order, { below: true, inCol: true });
    // A CIF chosen: the note goes, the state's with it; undone, it comes back.
    await addCif(page, env.fx.cif);
    assert.deepEqual([await note(page), 'oldGroups' in (await scherrer(page))], [[], false]);
    await undo(page);
    assert.equal((await note(page)).length, 1);
    assert.deepEqual([await cifFiles(page), (await scherrer(page)).oldGroups], [[null, null, null], true]);
    // A CIF that cannot be read: said under the selector, nothing chosen.
    const bad = env.fx.put('bad.cif', 'nothing here');
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), (async ()=>{ await page.focus(P + 'Cif'); await page.keyboard.press('End'); })()]);
    await fc.setFiles(bad);
    await page.waitForSelector(P + 'CifNote .alert.bad'); await settle(page);
    assert.deepEqual((await note(page)).pop(), 'alert bad compact: ✕ Not added: bad.cif: not a CIF: no data_ block found.');
    assert.deepEqual([await cifFiles(page), (await sel(page)).value], [[null, null, null], '']);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

/* v576: the CIFs' texts saved once. A project of v575 (each sample its CIF's text in its entry)
   opened as it was, saved anew with the pool; the card switched to Rietveld (its Scherrer
   settings kept, the samples referring to the pool), a sample left out, the card a Scherrer one
   again, the sample taken back in: its CIF with it (held whole, as the pool it comes back to
   may be another); undone and redone. */
test('the CIFs\' texts once: a project of v575 opened as it was; a card switched to Rietveld and back, a sample left out meanwhile, its CIF kept (v576)', async ()=>{
  const { page, errors, csp, close } = await env.page({ viewport: { width: 1400, height: 1000 } });
  try {
    await openModule(page, 'xrd');
    await loadFiles(page, 'xrd', env.fx.files.xrd);
    await addCif(page, env.fx.cif);
    await step(page);
    await page.selectOption(P + 'Cif', { label: 'SrTiO3' }); await settle(page);
    const rows = (await table(page)).rows.map(r=> r[2]);
    const { obj } = await exportProject(page), st = obj.state, sc = st.cards[0].states.scherrer;
    assert.deepEqual([sc.cif, sc.cifTexts.length, JSON.stringify(obj).split('data_SrTiO3').length - 1], [[{ file: 'SrTiO3.cif', ref: 0 }, { file: 'SrTiO3.cif', ref: 0 }, null], 1, 1], 'the text once in the project');
    // As v575 saved it: each sample its text.
    const inline = (({ cifTexts, ...s })=> ({ ...s, cif: s.cif.map(q=> q && { file: q.file, cif: cifTexts[q.ref] }) }))(sc);
    const cards = st.cards.map((a, i)=> i ? a : { ...a, states: { ...a.states, scherrer: inline } });
    await importProject(page, projectFile(env, 'v575cifs.datatreat', { ...obj, title: 'Inline CIFs', appVersion: 'v575', state: { ...st, cards } }, { sign: true }));
    await openProject(page, 'xrd', 'Inline CIFs');
    assert.deepEqual([await cifFiles(page), (await sel(page)).shown, (await table(page)).rows.map(r=> r[2])], [['SrTiO3.cif', 'SrTiO3.cif', null], 'SrTiO3', rows], 'opened as it was');
    const again = await scherrer(page);
    assert.deepEqual([again.cif, again.cifTexts], [sc.cif, sc.cifTexts], 'saved with the pool');
    // The card a Rietveld one, s00 left out, the card a Scherrer one again, s00 back in: its CIF kept.
    await kindOf(page, 'rietveld');
    assert.deepEqual([(await scherrer(page)).cif, (await scherrer(page)).cifTexts.length], [sc.cif, 1], 'kept with the pool');
    await leave(page, 0, false);
    await kindOf(page, 'scherrer');
    assert.deepEqual(await cifFiles(page), ['SrTiO3.cif', null]);
    await leave(page, 0, true);
    assert.deepEqual(await cifFiles(page), ['SrTiO3.cif', 'SrTiO3.cif', null]);
    assert.deepEqual([(await scherrer(page)).cif, (await scherrer(page)).cifTexts.length], [sc.cif, 1]);
    await undo(page);
    assert.deepEqual(await cifFiles(page), ['SrTiO3.cif', null]);
    await undo(page, true);
    assert.deepEqual(await cifFiles(page), ['SrTiO3.cif', 'SrTiO3.cif', null]);
    assert.deepEqual(errors, []); assert.deepEqual(await csp(), []);
  } finally { await close(); }
});

/* v577: a sample left out holds its CIF by the pool of its card's settings in the state saved,
   as a sample in use does (to v576 its text whole, once more in the project for each such
   sample): s00 and s01 given SrTiO3, s00 left out (the card a Scherrer one), s01 given none
   (the text in the pool for s00's alone), the card a Rietveld one: the text once in the project
   each time. The project opened again, the card a Scherrer one, s00 taken back in: its CIF
   with it; undone and redone. */
test('a sample left out holds its CIF by the card\'s pool in the project, its text once; opened again, taken back in with it (v577)', async ()=>{
  const { page, errors, csp, close } = await env.page({ viewport: { width: 1400, height: 1000 } });
  // The project as exported: s00's held CIF, the pool of the card's Scherrer settings, the text's count.
  const saved = async ()=>{ const { obj } = await exportProject(page), s = obj.state.cards[0].states.scherrer;
    return { obj, held: obj.state.files[0].held['A1:cif'], cif: s.cif, texts: s.cifTexts.length, n: JSON.stringify(obj).split('data_SrTiO3').length - 1 }; };
  const REF = { file: 'SrTiO3.cif', ref: 0 };
  try {
    await openModule(page, 'xrd');
    await loadFiles(page, 'xrd', env.fx.files.xrd);
    await addCif(page, env.fx.cif);
    await step(page);
    await page.selectOption(P + 'Cif', { label: 'SrTiO3' }); await settle(page);
    await leave(page, 0, false);
    let o = await saved();
    assert.deepEqual([o.held, o.cif, o.texts, o.n], [REF, [REF, null], 1, 1], 'left out: by the pool, the text once');
    await page.selectOption(P + 'Cif', { label: 'none' }); await settle(page);
    assert.deepEqual(await cifFiles(page), [null, null]);
    o = await saved();
    assert.deepEqual([o.held, o.cif, o.texts, o.n], [REF, [null, null], 1, 1], 'its text in the pool for it alone');
    await kindOf(page, 'rietveld');
    o = await saved();
    assert.deepEqual([o.held, o.cif, o.texts, o.n], [REF, [null, null], 1, 1], 'the card a Rietveld one');
    // Opened again: the card a Scherrer one, s00 taken back in with its CIF; undone, redone.
    await importProject(page, projectFile(env, 'leftout.datatreat', { ...o.obj, title: 'Left out CIF' }, { sign: true }));
    await openProject(page, 'xrd', 'Left out CIF');
    await kindOf(page, 'scherrer');
    assert.deepEqual(await cifFiles(page), [null, null]);
    await leave(page, 0, true);
    assert.deepEqual(await cifFiles(page), ['SrTiO3.cif', null, null]);
    await undo(page);
    assert.deepEqual(await cifFiles(page), [null, null]);
    await undo(page, true);
    assert.deepEqual(await cifFiles(page), ['SrTiO3.cif', null, null]);
    for (let k = 0; k < 3 && !(await page.textContent(P + 'CurrentLabel')).includes('s00'); k++) await step(page);
    assert.deepEqual([(await sel(page)).shown, (await table(page)).rows.map(r=> r[2])], ['SrTiO3', HKL], 's00 shown, its peaks named');
    assert.deepEqual(errors, []); assert.deepEqual(await csp(), []);
  } finally { await close(); }
});

/* v576: the fixture's perovskite from 115° to 140°, its Kα2 peaks resolved: each named "(hkl)
   Kα2" at its reflection's Kα2 (to v575 unassigned), in the table and peaks.csv, out of the
   sizes (the mean, the chart by peak), the rule in grey saying so. λ a Kα2 itself (Cu Kα2): no
   Kα2 to look at, the peaks named at λ alone, as before. */
test('Kα2 peaks resolved: each "(hkl) Kα2", in the table and peaks.csv, out of the sizes and the chart, the rule saying so; λ a Kα2 itself, none (v576)', async ()=>{
  const { page, errors, csp, close } = await env.page({ viewport: { width: 1400, height: 1000 } });
  try {
    await openModule(page, 'xrd');
    await loadFiles(page, 'xrd', [env.fx.put('hi.xrdml', xrdml(0, { lo: 115, hi: 140, n: 1924, refl: PEROV_HI }))]);
    await addCif(page, env.fx.cif);
    const K2 = ['(331)', '(331) Kα2', '(420)', '(420) Kα2', '(421)', '(421) Kα2', '(332)', '(332) Kα2'];
    let t = await table(page);
    assert.deepEqual(t.rows.map(r=> r[2]), K2);
    assert.equal(t.rule, 'hkl: the reflections of SrTiO3 at λ 1.540598 Å within 0.5 FWHM of a peak\'s 2θ, 0.1° at least; 4 of 8 peaks at a reflection\'s Kα2 (λ 1.544426 Å), the nearest line within their tolerance, with a taller peak below at that reflection\'s λ: named so and left out of its sizes, as each repeats its Kα1 peak.');
    // The mean over the Kα1 peaks' sizes alone (the table's own, rows 1, 3, 5, 7).
    const sizes = t.rows.filter((_, i)=> i % 2 === 0).map(r=> +r[5]), mean = sizes.reduce((a, v)=> a + v, 0)/sizes.length;
    const said = await page.$eval(P + 'PeakTableWrap .size-summary b', b=> parseFloat(b.textContent));
    assert.ok(Math.abs(said - mean) < 0.1, `the mean ${said}, the Kα1 peaks' ${mean}`);
    await page.click(P + 'SizeBy [data-size-by="peak"]'); await settle(page);
    const c = await chart(page);
    assert.deepEqual([c.names, c.boxes.length, c.least >= 6.5], [['(331)', '(420)', '(421)', '(332)'], 4, true]);
    const z = filesOf(await download(page, ()=> page.click('.proj-csv')));
    const pk = z['peaks.csv'];
    assert.deepEqual(pk.slice(1).map(r=> r[pk[0].indexOf('Peak_hkl_hi')]).filter(v=> v !== ''), K2);
    assert.deepEqual(z['crystallite_size_by_peak.csv'].slice(1).map(r=> r[1]), ['(331)', '(420)', '(421)', '(332)']);
    // λ Cu Kα2: no Kα2 to look at; the peaks named at λ alone.
    await page.selectOption(P + 'LambdaSel', '1.544426'); await settle(page);
    t = await table(page);
    assert.ok(t.rows.every(r=> !/Kα2/.test(r[2])) && !/Kα2/.test(t.rule), t.rows.map(r=> r[2]).join(' | '));
    assert.deepEqual(errors, []); assert.deepEqual(await csp(), []);
  } finally { await close(); }
});
