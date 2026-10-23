/* GC replicates (gc.js REPLICATES, v512):
   - the file list: LABEL over the label in every module (SAMPLE LABEL to v511), and in GC
     alone a SAMPLE column, a select in each row of FILE NAMES: each file its own sample at
     first; a row offers its own file and the heads (the files linked to none), never a
     file linked to another (no chains); a head set to another takes its group along; a
     head removed leaves its group to its next file in list order, the others linked to
     that one; a label renamed changes no link; each choice a step of the history; the
     arrow keys through a select's options, the focus kept, one choice changed (a head's
     group along at each step, back with it to its own; the same links as the pick), the
     focus left and given back a new one;
   - the time plots per file as before; the mean-rate bars one per sample, named after its
     head's label (the first included file's, the head left out), its height the mean of
     its included files' mean rates, each with its own parameters (a T of its own), its
     error bar t(0.995, n − 1)·s/√n, worked out here by hand (t in closed form for 1 and 2
     degrees of freedom), none for one file; a file left out, out of the mean and of n; the
     figure composer keeps the error bars;
   - mean_rates.csv: as before with no replicates (the same bytes as the files' own before
     any link, a sample of one file left alone too); with them a row per sample, each gas's
     mean, ± and n, the duration, p and T one value or all of them joined by '/', and
     mean_rates_by_file.csv the rows per file, as mean_rates.csv was;
   - projects: the links saved and opened; an old project, each file its own; one edited by
     hand (a link that is no name, to the file itself, to a file gone, to a file linked in
     turn, to a name two files have) opens with the links that can be;
   - on a phone (375 px) the select in its cell, as tall as the label field, nothing
     scrolling sideways. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start, openModule, loadFiles, settle, moduleState, history, download, readZip, parseCsv, undo,
  exportProject, projectFile, importProject, openProject } from './helpers.mjs';
import { gcCsv } from './fixtures.mjs';

let env, FILES;
before(async ()=>{
  env = await start();
  // alpha H₂ and O₂, beta H₂ alone (the fixtures'), gamma and delta H₂ and O₂.
  FILES = [...env.fx.files.gc, env.fx.put('gamma.csv', gcCsv({ h2: [0.06, 0.10], o2: [0.03, 0.04], seed: 9 })),
    env.fx.put('delta.csv', gcCsv({ h2: [0.04, 0.09], o2: [0.02, 0.06], seed: 10 }))];
});
after(()=> env && env.close());

const H2 = 'H₂', O2 = 'O₂', NAMES = ['alpha.csv', 'beta.csv', 'gamma.csv', 'delta.csv'];
const open4 = async page =>{ await openModule(page, 'gc'); await loadFiles(page, 'gc', FILES); };
// Each row's select: its value and its options.
const sels = page => page.$$eval('#gcFileTableWrap tr.file-row', rs=> rs.map(r=>{
  const s = r.querySelector('td.note-cell select.file-sample');
  return [s.value, [...s.options].map(o=> o.value)];
}));
const pick = async (page, i, name)=>{ await page.selectOption(`#gcFileTableWrap select.file-sample[data-i="${i}"]`, name); await settle(page); };
// File i's include box clicked: left out, or back in.
const flip = async (page, i)=>{ await page.click(`#gcFileTableWrap tr.file-row:nth-child(${i + 1}) .file-incl`); await settle(page); };
// Each file's link as the state holds it (none: its own).
const links = async page => (await moduleState(page, 'gc')).files.map(f=> f.sample ?? null);
// The mean-rate chart: each slot's name (the whole label), key, bars by gas [height, offset],
// error bars [offset, ±] and value labels.
const bars = page => page.evaluate(()=>{
  const st = document.getElementById('gc1SvgBar')._plot._stored;
  return st.filter(e=> e.type === 'ticklabel').map(t=>({ name: t.full, key: t.key,
    bars: Object.fromEntries(st.filter(e=> e.type === 'barpx' && e.xc === t.xv).map(e=> [e.label, [e.y1, e.dx]])),
    errs: st.filter(e=> e.type === 'errbar' && e.xc === t.xv).map(e=> [e.dx, e.yerr]),
    texts: st.filter(e=> e.type === 'barlabel' && e.xv === t.xv).map(e=> e.text) }));
});
const errOf = (b, gas)=>{ const e = b.errs.find(x=> x[0] === b.bars[gas][1]); return e ? e[1] : null; };
// The CSV export's files, by the end of their names.
const zip = async page =>{
  const z = await download(page, ()=> page.click('.proj-csv'));
  return Object.fromEntries(readZip(z.buf).map(e=> [e.name.replace(/^.* - /, ''), e.data.toString('utf8')]));
};
const rows = text => parseCsv(text.replace(/^﻿/, ''), ';');
// The statistics by hand: the mean, the standard deviation (n − 1), the 99 % CI's half-width.
const mean = a => a.reduce((s, v)=> s + v, 0)/a.length;
const sd = a =>{ const m = mean(a); return Math.sqrt(a.reduce((s, v)=> s + (v - m)**2, 0)/(a.length - 1)); };
// Student's t at 0.995 in closed form: tan(π(p − ½)) for 1 degree of freedom, (2p − 1)/√(2p(1 − p)) for 2.
const T995 = { 1: Math.tan(0.495*Math.PI), 2: 0.99/Math.sqrt(2*0.995*0.005) };
const ci = a => T995[a.length - 1]*sd(a)/Math.sqrt(a.length);
const near = (a, b, what, tol = 1e-9)=> assert.ok(Math.abs(a - b) <= tol*Math.abs(b), `${what}: ${a} for ${b}`);

test('the Sample column: each file its own, a select of its own name and the heads\'; no chains; a group taken along; a head removed; a label renamed; undo and redo', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await open4(page);
    assert.deepEqual(await page.$$eval('#gcFileTableWrap thead th', ts=> ts.map(t=> t.textContent.trim())), ['', '', 'FILE', 'LABEL', 'SAMPLE', '']);
    assert.deepEqual(await sels(page), NAMES.map(n=> [n, NAMES]), 'each file its own sample, every file a head');
    assert.deepEqual(await links(page), [null, null, null, null]);
    assert.deepEqual((await bars(page)).map(b=> [b.name, b.key, b.errs.length]), NAMES.map(n=> [n.replace('.csv', ''), n, 0]), 'a bar per file, no error bar');
    // beta a replicate of alpha: a step of the history; beta no head, offered to no other row.
    const h0 = await history(page, 'gc');
    await pick(page, 1, 'alpha.csv');
    assert.deepEqual(await links(page), [null, 'alpha.csv', null, null]);
    assert.equal((await history(page, 'gc')).index, h0.index + 1, 'a step of the history');
    const heads3 = ['alpha.csv', 'gamma.csv', 'delta.csv'];
    assert.deepEqual(await sels(page), [['alpha.csv', heads3], ['alpha.csv', NAMES], ['gamma.csv', heads3], ['delta.csv', heads3]]);
    // delta joins gamma; gamma, heading delta, joins alpha: delta goes along (no chain).
    await pick(page, 3, 'gamma.csv');
    assert.deepEqual(await sels(page), [['alpha.csv', ['alpha.csv', 'gamma.csv']], ['alpha.csv', ['alpha.csv', 'beta.csv', 'gamma.csv']],
      ['gamma.csv', ['alpha.csv', 'gamma.csv']], ['gamma.csv', ['alpha.csv', 'gamma.csv', 'delta.csv']]]);
    await pick(page, 2, 'alpha.csv');
    assert.deepEqual(await links(page), [null, 'alpha.csv', 'alpha.csv', 'alpha.csv'], 'the group taken along');
    assert.deepEqual(await sels(page), [['alpha.csv', ['alpha.csv']], ['alpha.csv', ['alpha.csv', 'beta.csv']], ['alpha.csv', ['alpha.csv', 'gamma.csv']], ['alpha.csv', ['alpha.csv', 'delta.csv']]]);
    let b = await bars(page);
    assert.deepEqual(b.map(x=> [x.name, x.key]), [['alpha', 'alpha.csv']], 'one bar, the head\'s');
    // The time plots stay per file.
    const lines = await page.evaluate(()=> document.getElementById('gc1SvgRate')._plot._stored.filter(e=> e.type === 'line').map(e=> e.key));
    assert.deepEqual(lines, ['alpha.csv/h2', 'alpha.csv/o2', 'beta.csv/h2', 'gamma.csv/h2', 'gamma.csv/o2', 'delta.csv/h2', 'delta.csv/o2']);
    // A label renamed: no link changes, the bar named by it.
    const lab = page.locator('#gcFileTableWrap .file-label').first();
    await lab.fill('A1'); await lab.press('Enter'); await settle(page);
    assert.deepEqual(await links(page), [null, 'alpha.csv', 'alpha.csv', 'alpha.csv']);
    assert.deepEqual((await bars(page)).map(x=> x.name), ['A1']);
    // Its head left out: the bar named after its first included file; the head still offered.
    await flip(page, 0);
    assert.deepEqual((await bars(page)).map(x=> [x.name, x.key]), [['beta', 'alpha.csv']]);
    assert.deepEqual((await sels(page))[1], ['alpha.csv', ['alpha.csv', 'beta.csv']]);
    await flip(page, 0);
    // The head removed: its group stays, the next file in list order heading it.
    await page.click('#gcFileTableWrap tr.file-row:nth-child(1) .row-del'); await settle(page);
    assert.deepEqual(await links(page), [null, 'beta.csv', 'beta.csv']);
    assert.deepEqual(await sels(page), [['beta.csv', ['beta.csv']], ['beta.csv', ['beta.csv', 'gamma.csv']], ['beta.csv', ['beta.csv', 'delta.csv']]]);
    assert.deepEqual((await bars(page)).map(x=> [x.name, x.key]), [['beta', 'beta.csv']]);
    // Undo and redo, through the choices.
    await undo(page);
    assert.deepEqual(await links(page), [null, 'alpha.csv', 'alpha.csv', 'alpha.csv'], 'undo: the head back with its group');
    assert.equal(await page.inputValue('#gcFileTableWrap .file-label >> nth=0'), 'A1');
    await undo(page); await undo(page); await undo(page);   // its inclusion twice, its label
    await undo(page);
    assert.deepEqual(await links(page), [null, 'alpha.csv', null, 'gamma.csv'], 'undo: gamma heading delta again');
    assert.deepEqual((await bars(page)).map(x=> x.name), ['alpha', 'gamma']);
    await undo(page, true);
    assert.deepEqual(await links(page), [null, 'alpha.csv', 'alpha.csv', 'alpha.csv'], 'redo');
    // A member back to its own: a head again.
    await pick(page, 2, 'gamma.csv');
    assert.deepEqual(await links(page), [null, 'alpha.csv', null, 'alpha.csv']);
    assert.deepEqual((await bars(page)).map(x=> x.name), ['alpha', 'gamma']);
    // An arrow key on a select: a choice at once, the list drawn anew, the focus kept on it.
    await page.focus('#gcFileTableWrap select.file-sample[data-i="3"]');
    await page.keyboard.press('ArrowDown'); await settle(page);
    assert.deepEqual(await links(page), [null, 'alpha.csv', null, 'gamma.csv']);
    assert.ok(await page.evaluate(()=> document.activeElement.matches('#gcFileTableWrap select.file-sample[data-i="3"]')), 'the focus on its select');
    await page.keyboard.press('ArrowDown'); await settle(page);
    assert.deepEqual(await links(page), [null, 'alpha.csv', null, null]);
    /* The arrow keys through a head's options (alpha heads beta; alpha, gamma, delta), the
       focus kept: one choice changed, its group along at each step, each a step of the
       history. Down, Up: the links as they were; Down, Down: as the pick of delta. */
    const S0 = '#gcFileTableWrap select.file-sample[data-i="0"]', S3 = S0.replace('"0"', '"3"'), h1 = (await history(page, 'gc')).index;
    await page.focus(S0);
    await page.keyboard.press('ArrowDown'); await settle(page);
    assert.deepEqual(await links(page), ['gamma.csv', 'gamma.csv', null, null], 'its group along');
    await page.keyboard.press('ArrowUp'); await settle(page);
    assert.deepEqual([await page.inputValue(S0), await links(page)], ['alpha.csv', [null, 'alpha.csv', null, null]], 'back to its own, its group with it');
    assert.deepEqual((await bars(page)).map(x=> x.name), ['alpha', 'gamma', 'delta']);
    await page.keyboard.press('ArrowDown'); await settle(page); await page.keyboard.press('ArrowDown'); await settle(page);
    const walked = await links(page);
    assert.deepEqual([await page.inputValue(S0), walked], ['delta.csv', ['delta.csv', 'delta.csv', null, null]], 'on to delta, its group with it');
    assert.equal((await history(page, 'gc')).index, h1 + 4, 'each key a step of the history');
    for (let k = 0; k < 4; k++) await undo(page);
    assert.deepEqual(await links(page), [null, 'alpha.csv', null, null]);
    await pick(page, 0, 'delta.csv');
    assert.deepEqual(await links(page), walked, 'the pick of delta: the same links');
    // The focus left and given back (Tab, Shift+Tab): a walk of its own, from the links then.
    // delta, heading alpha and beta, on to gamma with them; then back to its own, alone.
    await page.focus(S3);
    await page.keyboard.press('ArrowUp'); await settle(page);
    assert.deepEqual(await links(page), ['gamma.csv', 'gamma.csv', null, 'gamma.csv']);
    await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
    assert.ok(await page.evaluate(s=> document.activeElement.matches(s), S3), 'back on its select');
    await page.keyboard.press('ArrowDown'); await settle(page);
    assert.deepEqual(await links(page), ['gamma.csv', 'gamma.csv', null, null], 'a new walk: delta alone');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('the bars, one per sample: the mean of its files\' rates ± t(0.995, n − 1)·s/√n by hand; mean_rates.csv per sample, mean_rates_by_file.csv; the composer', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await open4(page);
    // t as the tables give it.
    assert.deepEqual([T995[1].toFixed(4), T995[2].toFixed(4)], ['63.6567', '9.9248']);
    // Each file's rates, as drawn before any link, and the CSV as it was.
    const r = Object.fromEntries((await bars(page)).map(x=> [x.key, { h2: x.bars[H2] && x.bars[H2][0], o2: x.bars[O2] && x.bars[O2][0] }]));
    assert.equal(r['beta.csv'].o2, undefined, 'beta has no O₂');
    const z0 = await zip(page);
    assert.deepEqual(Object.keys(z0).sort(), ['gc_info.csv', 'gc_raw.csv', 'gc_results.csv', 'mean_rates.csv']);
    // The info text: a row per sample and mean_rates_by_file.csv with replicates alone.
    assert.match(await page.$eval('#tab-gc .an-instr', e=> e.textContent),
      /\. With replicates \(a sample of more than one included file\), mean_rates\.csv has a row per sample \(each gas's mean, ± and n\) and mean_rates_by_file\.csv a row per file, as mean_rates\.csv has without them\./);
    const T0 = z0['mean_rates.csv'];
    assert.equal(rows(T0)[0].join('|'), 'Sample|Mean H2 Production Rate (mmol g^-1 h^-1)|Mean O2 Production Rate (mmol g^-1 h^-1)|Interval duration (h)|p (atm)|T (°C)');
    // beta and gamma replicates of alpha.
    await pick(page, 1, 'alpha.csv'); await pick(page, 2, 'alpha.csv');
    const h2 = ['alpha.csv', 'beta.csv', 'gamma.csv'].map(k=> r[k].h2), o2 = ['alpha.csv', 'gamma.csv'].map(k=> r[k].o2);
    let b = await bars(page);
    assert.deepEqual(b.map(x=> x.name), ['alpha', 'delta']);
    near(b[0].bars[H2][0], mean(h2), 'H₂ mean'); near(errOf(b[0], H2), ci(h2), 'H₂ ± (n = 3)', 1e-7);
    near(b[0].bars[O2][0], mean(o2), 'O₂ mean'); near(errOf(b[0], O2), ci(o2), 'O₂ ± (n = 2)', 1e-7);
    assert.deepEqual(b[0].texts, [`${mean(h2).toFixed(4)}±${ci(h2).toFixed(4)}`, `${mean(o2).toFixed(4)}±${ci(o2).toFixed(4)}`], 'the value labels');
    assert.deepEqual([b[1].bars[H2][0], b[1].bars[O2][0], b[1].errs, b[1].texts], [r['delta.csv'].h2, r['delta.csv'].o2, [], [r['delta.csv'].h2.toFixed(4), r['delta.csv'].o2.toFixed(4)]], 'delta alone: its own rates, no error bar');
    // The CSVs: a row per sample, and the rows per file as mean_rates.csv was.
    let z = await zip(page);
    assert.equal(z['mean_rates_by_file.csv'], T0, 'mean_rates_by_file.csv: mean_rates.csv as it was');
    let m = rows(z['mean_rates.csv']);
    assert.deepEqual(m[0], ['Sample', 'Mean H2 Production Rate (mmol g^-1 h^-1)', 'H2 ± (99% CI half-width, mmol g^-1 h^-1)', 'H2 n',
      'Mean O2 Production Rate (mmol g^-1 h^-1)', 'O2 ± (99% CI half-width, mmol g^-1 h^-1)', 'O2 n', 'Interval duration (h)', 'p (atm)', 'T (°C)']);
    const dur = rows(T0)[1][3];
    assert.deepEqual(m.slice(1), [
      ['alpha', mean(h2).toFixed(6), ci(h2).toFixed(6), '3', mean(o2).toFixed(6), ci(o2).toFixed(6), '2', dur, '1', '25'],
      ['delta', r['delta.csv'].h2.toFixed(6), '', '1', r['delta.csv'].o2.toFixed(6), '', '1', rows(T0)[4][3], '1', '25']]);
    // The composer: the bars with their error bars (a vertical line, a cap at each end).
    const whiskers = async ()=>{
      await page.locator('#gc1SvgBar').scrollIntoViewIfNeeded();
      await page.locator('#gc1SvgBar').locator('..').locator('button[title="Figure composer (advanced export)"]').click();
      await page.waitForSelector('.fig-backdrop .fig-svg rect');
      const n = await page.$$eval('.fig-backdrop .fig-svg line', ls=>{
        const L = ls.map(l=> ['x1', 'x2', 'y1', 'y2'].map(k=> +l.getAttribute(k)));
        const cap = (x, y)=> L.some(([a, c, d, e])=> d === y && e === y && Math.abs((a + c)/2 - x) < 0.01 && c > a);
        return L.filter(([a, c, d, e])=> a === c && d !== e && cap(a, d) && cap(a, e)).length;
      });
      await page.keyboard.press('Escape'); await page.waitForFunction(()=> !document.querySelector('.fig-backdrop'));
      return n;
    };
    assert.equal(await whiskers(), 2, 'the composer: H₂\'s and O₂\'s error bars');
    // A file left out: out of the mean and of n (O₂ of one file: no ±).
    await flip(page, 2);
    b = await bars(page);
    const h2b = h2.slice(0, 2);
    near(b[0].bars[H2][0], mean(h2b), 'H₂ mean, gamma left out'); near(errOf(b[0], H2), ci(h2b), 'H₂ ± (n = 2)', 1e-7);
    assert.deepEqual([b[0].bars[O2][0], errOf(b[0], O2)], [r['alpha.csv'].o2, null], 'O₂ of alpha alone, no error bar');
    m = rows((await zip(page))['mean_rates.csv']);
    assert.deepEqual(m[1].slice(0, 7), ['alpha', mean(h2b).toFixed(6), ci(h2b).toFixed(6), '2', r['alpha.csv'].o2.toFixed(6), '', '1']);
    // The head left out: named after beta, its first included file.
    await flip(page, 2); await flip(page, 0);
    b = await bars(page);
    assert.deepEqual(b.map(x=> x.name), ['beta', 'delta']);
    const h2c = h2.slice(1);
    near(b[0].bars[H2][0], mean(h2c), 'H₂ mean, alpha left out'); near(b[0].bars[O2][0], r['gamma.csv'].o2, 'O₂ of gamma alone');
    assert.equal(rows((await zip(page))['mean_rates.csv'])[1][0], 'beta');
    await flip(page, 0);
    // A T of its own for gamma: its rate at its molar volume (∝ 1/T), its T joined with the others'.
    await page.click('#tab-gc .gc-toggle[data-pair="t"]'); await settle(page);
    await page.fill('#tab-gc .gcCell[data-i="2"][data-f="t"]', '35'); await page.press('#tab-gc .gcCell[data-i="2"][data-f="t"]', 'Enter'); await settle(page);
    const g35 = r['gamma.csv'].h2*(25 + 273.15)/(35 + 273.15), h2d = [h2[0], h2[1], g35];
    b = await bars(page);
    near(b[0].bars[H2][0], mean(h2d), 'H₂ mean, gamma at 35 °C', 1e-7); near(errOf(b[0], H2), ci(h2d), 'its ±', 1e-6);
    z = await zip(page);
    m = rows(z['mean_rates.csv']);
    assert.deepEqual(m[1].slice(-3), [dur, '1', '25/25/35'], 'T differing: all of them joined');
    assert.deepEqual(rows(z['mean_rates_by_file.csv']).slice(1).map(x=> x.at(-1)), ['25', '25', '35', '25']);
    await page.click('#tab-gc .gc-toggle[data-pair="t"]'); await settle(page);
    // No link left: mean_rates.csv as it was, no file per file.
    await pick(page, 1, 'beta.csv'); await pick(page, 2, 'gamma.csv');
    z = await zip(page);
    assert.equal(z['mean_rates.csv'], T0, 'mean_rates.csv as before');
    assert.equal(z['mean_rates_by_file.csv'], undefined);
    // A sample of one included file (its replicate left out): the rows per file, as before.
    await pick(page, 1, 'alpha.csv'); await flip(page, 1);
    z = await zip(page);
    assert.equal(z['mean_rates_by_file.csv'], undefined);
    assert.deepEqual(rows(z['mean_rates.csv']), rows(T0).filter((_, i)=> i !== 2), 'the rows of the included files');
    assert.equal(await whiskers(), 0, 'no error bar to compose');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('projects: the links saved and opened; an old project each file its own; one edited by hand', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await open4(page);
    await pick(page, 1, 'alpha.csv'); await pick(page, 3, 'gamma.csv');
    const { obj } = await exportProject(page);
    assert.deepEqual(obj.state.files.map(f=> f.sample ?? null), [null, 'alpha.csv', null, 'gamma.csv'], 'saved in the project');
    await importProject(page, projectFile(env, 'rep.datatreat', { ...obj, title: 'Rep links' }));
    await openProject(page, 'gc', 'Rep links');
    assert.deepEqual(await links(page), [null, 'alpha.csv', null, 'gamma.csv'], 'opened with its links');
    assert.deepEqual((await bars(page)).map(x=> x.name), ['alpha', 'gamma']);
    // A project from before replicates: each file its own sample.
    const strip = s => ({ ...s, files: s.files.map(f=> Object.fromEntries(Object.entries(f).filter(([k])=> k !== 'sample'))) });
    await importProject(page, projectFile(env, 'old.datatreat', { ...obj, title: 'Rep old', state: strip(obj.state) }, { sign: true }));
    await openProject(page, 'gc', 'Rep old');
    assert.deepEqual(await sels(page), NAMES.map(n=> [n, NAMES]));
    assert.equal((await bars(page)).length, 4);
    // By hand: a number (none), a file gone (its group headed by its first: beta, gamma
    // linked to it), a link to a file linked in turn (none).
    const s0 = strip(obj.state), edit = (s, ...v)=> ({ ...s, files: s.files.map((f, i)=> v[i] === undefined ? f : { ...f, sample: v[i] }) });
    await importProject(page, projectFile(env, 'hand.datatreat', { ...obj, title: 'Rep hand', state: edit(s0, 42, 'gone.csv', 'gone.csv', 'gamma.csv') }, { sign: true }));
    await openProject(page, 'gc', 'Rep hand');
    assert.deepEqual(await links(page), [null, null, 'beta.csv', null]);
    assert.deepEqual((await bars(page)).map(x=> x.name), ['alpha', 'beta', 'delta']);
    // A link to the file itself (none); to a name two files have (none: which is it?).
    const twice = { ...s0, files: [...s0.files.slice(0, 3), { ...s0.files[0] }] };
    await importProject(page, projectFile(env, 'twice.datatreat', { ...obj, title: 'Rep twice', state: edit(twice, 'alpha.csv', 'alpha.csv', 'beta.csv') }, { sign: true }));
    await openProject(page, 'gc', 'Rep twice');
    assert.deepEqual(await links(page), [null, null, 'beta.csv', null]);
    assert.deepEqual((await bars(page)).map(x=> x.name), ['alpha', 'beta', 'alpha']);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('a phone (375 px): the select in its cell, as tall as the label field; nothing scrolls sideways', async ()=>{
  const { page, errors, close } = await env.page({ viewport: { width: 375, height: 740 } });
  try {
    await open4(page);
    await pick(page, 1, 'alpha.csv');
    const g = await page.evaluate(()=>{
      const box = el => el.getBoundingClientRect();
      return { rows: [...document.querySelectorAll('#gcFileTableWrap tr.file-row')].map(r=>{
          const s = box(r.querySelector('select.file-sample')), c = box(r.querySelector('td.note-cell')), l = box(r.querySelector('.file-label'));
          return { inCell: s.left >= c.left - 0.5 && s.right <= c.right + 0.5, h: Math.round(s.height) === Math.round(l.height) };
        }),
        head: document.querySelector('#gcFileTableWrap thead th.note-cell').textContent,
        box: (b => b.scrollWidth - b.clientWidth)(document.querySelector('#gcFileTableWrap .table-wrap-box')),
        page: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
    assert.deepEqual(g, { rows: NAMES.map(()=> ({ inCell: true, h: true })), head: 'SAMPLE', box: 0, page: 0 });
    assert.deepEqual((await bars(page)).map(x=> x.name), ['alpha', 'gamma', 'delta']);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
