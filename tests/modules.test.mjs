/* DRS, GC and EPR:
   - a card unfolded keeps its zoom only on the data it was set on (the same files, the
     same full range), else draws the full range, at the size it is laid out at (28);
   - DRS: the cards stay on the sample on show when another is removed or moved, on the
     nearest when it is removed; a label changed is the card's caption at once (29);
   - GC: an interval bound flipped back to "all" is refused, with the words a value typed
     is refused with, where it would end an interval before it starts (30c);
   - EPR: a .DSC with fewer than two points refused, with why; spectra all flat drawn under
     the global normalisation (30e);
   - GC: the temperature T of the flow, all/one, 25 °C by default, 0 °C in a project saved
     before it; V_m = RT/P; in the table and the CSVs (37);
   - DRS: R% recognised by its header and read as F(R) = (1 − R)²/2R; the standard format
     the Cary 5000's layout alone (the name, then "Wavelength (nm)" and "%R" or "F(R)" on the
     second line, the data from the third), any other file said with how it was read; the
     points that are no physical value left out, and counted (38, 39);
   - DRS: the Cary 5000's %R export loaded with no alert, as a standard F(R) one is; how
     each file was read in the file list's note, right of the label; R (%) against λ in the
     Results, beside F(R), the log plot under them;
   - a malformed project (every value of its state replaced by one of another type, a file
     with nothing to show) restores without a throw or a page error (22). */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { start, openModule, loadFiles, settle, moduleState, banner, answer, download, readZip, parseCsv, undo } from './helpers.mjs';
import { drsCsv, caryCsv, gcCsv, eprPair } from './fixtures.mjs';

let env;
before(async ()=>{ env = await start(); });
after(()=> env && env.close());

const file = (name, buffer)=> ({ name, mimeType: 'text/plain', buffer: Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer) });
// A fixture as a buffer, to go beside files made here (setInputFiles takes paths or buffers, not both).
const fx = p => file(path.basename(p), fs.readFileSync(p));
// A module's state put in as a tab opening a project puts it (db.js decode, then the restore).
// (the tab's redraw comes a frame after: `frames` waited for)
const restore = (page, mod, st, frames = 2)=> page.evaluate(async ([mod, st, frames])=>{
  const u = await import('./utils.js'), db = await import('./db.js');
  try { u.restoreModuleState(mod, db.decode(st)); } catch(e){ return 'threw: ' + e.message; }
  for (let i = 0; i < frames; i++) await new Promise(r=> requestAnimationFrame(r));
  return 'ok';
}, [mod, st, frames]);
// The state as a project file holds it (db.js encode).
const encoded = (page, mod)=> page.evaluate(async mod=>{ const u = await import('./utils.js'), db = await import('./db.js'); return db.encode(u.getModuleState(mod)); }, mod);
// A card's plot: its view, its full range, and whether it was drawn at the width it is laid out at.
const plotOf = (page, sel)=> page.evaluate(sel=>{
  const svg = document.querySelector(sel), p = svg._plot, b = svg.querySelector('.plot-border');
  return { x: [p.xmin, p.xmax], home: [p._origXmin, p._origXmax], fits: Math.abs(+b.getAttribute('width') - (svg.getBoundingClientRect().width - p.margin.l - p.margin.r)) < 1 };
}, sel);
const zoom = (page, sel, x0, x1)=> page.evaluate(([sel, x0, x1])=>{ const p = document.querySelector(sel)._plot; p.xmin = x0; p.xmax = x1; p._refresh(); }, [sel, x0, x1]);
const fold = async (page, mod)=>{ await page.click(`#tab-${mod} .an-card .an-fold`); await page.waitForTimeout(400); await settle(page); };
const csvOf = async (page, end)=>{
  const z = await download(page, ()=> page.click('.proj-csv'));
  const e = readZip(z.buf).find(x=> x.name.endsWith(end));
  return parseCsv(e.data.toString('utf8').replace(/^﻿/, ''), ';');
};

test('28: a card unfolded keeps its zoom on the same data only, drawn at its size (EPR, GC)', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    // EPR: unfolded with nothing changed, the zoom is kept; with a file removed meanwhile,
    // the full range.
    await openModule(page, 'epr');
    await loadFiles(page, 'epr', env.fx.files.epr);
    const E = '#tab-epr .an-card svg.plot';
    await zoom(page, E, 338, 342);
    await fold(page, 'epr'); await fold(page, 'epr');
    let p = await plotOf(page, E);
    assert.deepEqual(p.x, [338, 342], 'EPR: the zoom on the same spectra');
    assert.ok(p.fits, 'EPR: drawn at the width it has unfolded');
    await fold(page, 'epr');
    await page.click('#eprFileTableWrap tr.file-row:nth-child(2) .row-del'); await settle(page);
    await fold(page, 'epr');
    p = await plotOf(page, E);
    assert.deepEqual(p.x, p.home, 'EPR: a file removed while folded, the full range');
    assert.ok(p.fits);
    // GC: the same, with a file left out while folded; a resize keeps the zoom.
    await openModule(page, 'gc');
    await loadFiles(page, 'gc', env.fx.files.gc);
    const G = '#tab-gc .an-card svg.plot';
    await zoom(page, G, 1, 2);
    await page.evaluate(()=> window.dispatchEvent(new Event('resize'))); await page.waitForTimeout(300); await settle(page);
    assert.deepEqual((await plotOf(page, G)).x, [1, 2], 'GC: a resize keeps the zoom');
    // Folded, a label changed: the same data, the zoom kept (the card is not drawn folded).
    await fold(page, 'gc');
    const lab = page.locator('#gcFileTableWrap tr.file-row:nth-child(1) .file-label');
    await lab.fill('alpha 2'); await lab.press('Enter'); await settle(page);
    await fold(page, 'gc');
    p = await plotOf(page, G);
    assert.deepEqual(p.x, [1, 2], 'GC: the zoom on the same samples');
    assert.ok(p.fits, 'GC: drawn at the width it has unfolded');
    await fold(page, 'gc');
    await page.click('#gcFileTableWrap tr.file-row:nth-child(2) .file-incl'); await settle(page);
    await fold(page, 'gc');
    p = await plotOf(page, G);
    assert.deepEqual(p.x, p.home, 'GC: a file left out while folded, the full range');
    assert.ok(p.fits);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('29: DRS follows the sample on show through a removal and a move; a label is the caption at once', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'tauc');
    await loadFiles(page, 'tauc', [...env.fx.files.tauc.map(fx), file('drs3.csv', drsCsv({ Eg: 2.6, A: 30, seed: 5 }))]);
    const cap = ()=> page.locator('#tab-tauc .an-card [id$="CurrentLabel"]').first().textContent();
    const idx = ()=> page.locator('#tab-tauc .an-card [id$="Idx"]').first().textContent();
    await page.click('#tab-tauc .an-next'); await settle(page);
    assert.equal(await cap(), 'drs2');
    // Another removed, before it: the same sample, now the first of two.
    await page.click('#taucFileTableWrap tr.file-row:nth-child(1) .row-del'); await settle(page);
    assert.equal(await cap(), 'drs2'); assert.equal(await idx(), '1/2');
    // Moved: the drag of the file list, by its callback (moveFileTo) as the drop calls it.
    await page.click('#taucFileTableWrap tr.file-row:nth-child(2) .row-del'); await settle(page);
    await loadFiles(page, 'tauc', [file('drs3.csv', drsCsv({ Eg: 2.6, A: 30, seed: 5 })), file('drs4.csv', drsCsv({ Eg: 2.4, A: 20, seed: 6 }))]);
    // drs2, drs3, drs4: on drs3, then drs4 dragged to the top.
    await page.click('#tab-tauc .an-next'); await settle(page);
    assert.equal(await cap(), 'drs3');
    const rows = page.locator('#taucFileTableWrap tr.file-row');
    const from = await rows.nth(2).locator('.drag-handle').boundingBox(), to = await rows.nth(0).boundingBox();
    await page.mouse.move(from.x + from.width/2, from.y + from.height/2); await page.mouse.down();
    await page.mouse.move(from.x + from.width/2, to.y + 3, { steps: 8 }); await page.mouse.up(); await settle(page);
    assert.deepEqual(await page.locator('#taucFileTableWrap .fname-text').allTextContents(), ['drs4.csv', 'drs2.csv', 'drs3.csv'], 'the move');
    assert.equal(await cap(), 'drs3', 'the sample on show after a move'); assert.equal(await idx(), '3/3');
    // The one on show removed: the one now in its place, the last if it was the last.
    await page.click('#taucFileTableWrap tr.file-row:nth-child(3) .row-del'); await settle(page);
    assert.equal(await cap(), 'drs2'); assert.equal(await idx(), '2/2');
    // A label changed: the caption at once, and back with an undo.
    const lab = page.locator('#taucFileTableWrap tr.file-row:nth-child(2) .file-label');
    await lab.fill('renamed'); await lab.press('Enter'); await settle(page);
    assert.equal(await cap(), 'renamed');
    await undo(page);
    assert.equal(await cap(), 'drs2');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('30c: GC refuses an interval bound back to "all" that would end an interval before it starts', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'gc');
    await loadFiles(page, 'gc', env.fx.files.gc);
    const pair = async k =>{ await page.click(`#tab-gc .gc-toggle[data-pair="${k}"]`); await settle(page); };
    const cell = async (i, f, v)=>{ const s = `#tab-gc .gcCell[data-i="${i}"][data-f="${f}"]`; await page.fill(s, String(v)); await page.press(s, 'Enter'); await settle(page); };
    const card = async ()=> (await moduleState(page, 'gc')).cards[0];
    await pair('start'); await pair('end');
    await cell(0, 'start', 10); await cell(1, 'end', 5);
    // alpha 10–24 h, beta 0–5 h: a start of 10 for both would end beta's before it starts.
    await pair('start');
    const said = await banner(page);
    assert.match(said && said.text || '', /^The interval must start before it ends: 10 h is not before the end of beta, 5 h\.$/);
    await answer(page, 'ok');
    let c = await card();
    assert.equal(c.startMode, 'one', 'the flip refused');
    assert.deepEqual(c.startArr, [10, 0]);
    // A value typed and refused: the same words.
    await cell(1, 'start', 7);
    const typed = await banner(page);
    assert.match(typed && typed.text || '', /^The interval must start before it ends: 7 h is not before the end of beta, 5 h\.$/);
    await answer(page, 'ok');
    assert.deepEqual((await card()).startArr, [10, 0], 'the value typed refused');
    // The end flipped back the same way: alpha's 24 for both is after both starts, taken.
    await pair('end');
    assert.equal(await banner(page), null);
    c = await card();
    assert.equal(c.endMode, 'all'); assert.equal(c.endShared, 24);
    // Now the start can go back to all.
    await pair('start');
    c = await card();
    assert.equal(c.startMode, 'all'); assert.equal(c.startShared, 10);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('30e: EPR refuses a .DSC of fewer than two points, saying why; flat spectra are drawn', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'epr');
    const e = eprPair({ title: 'x' }), dsc = e.dsc.toString('latin1');
    await page.setInputFiles('#eprFiles', [file('one.DSC', dsc.replace('XPTS 1024', 'XPTS 1')), file('one.DTA', e.dta),
      file('none.DSC', dsc.replace(/XPTS 1024\n/, '')), file('none.DTA', e.dta), file('ok.DSC', dsc), file('ok.DTA', e.dta)]);
    await page.waitForFunction(()=> document.querySelectorAll('#eprFileTableWrap tr.file-row').length === 1); await settle(page);
    const alerts = await page.locator('#eprAlerts').textContent();
    assert.match(alerts, /one \(XPTS 1: a spectrum needs two points at least\)/);
    assert.match(alerts, /none \(its \.DSC gives no XPTS, the number of points\)/);
    // Two spectra all flat, global normalisation: each a line in its slot, no NaN.
    await openModule(page, 'epr');
    const flat = Buffer.alloc(1024*8);
    await loadFiles(page, 'epr', [file('f1.DSC', dsc), file('f1.DTA', flat), file('f2.DSC', dsc), file('f2.DTA', flat)], 2);
    const d = await page.$$eval('#tab-epr .an-card svg.plot .plot-gdata path', ps=> ps.map(p=> p.getAttribute('d') || ''));
    assert.equal(d.length, 2);
    for (const x of d){ assert.ok(x.length > 100, 'a flat spectrum drawn'); assert.doesNotMatch(x, /NaN/); }
    assert.notEqual(d[0], d[1], 'each in its own slot');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('37: GC takes the flow at its temperature, 25 °C by default, 0 °C in a project saved before', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'gc');
    await loadFiles(page, 'gc', [env.fx.files.gc[0]]);
    const shared = '#tab-gc .gcShared[data-f="t"]';
    assert.equal(await page.inputValue(shared), '25');
    assert.equal(await page.inputValue('#tab-gc .gcCell[data-i="0"][data-f="t"]'), '25');
    const mean = async ()=>{ const r = await csvOf(page, 'mean_rates.csv'); return { head: r[0], row: r[1], h2: parseFloat(r[1][1].replace(',', '.')) }; };
    const at25 = await mean();
    assert.equal(at25.head[at25.head.length - 1], 'T (°C)');
    assert.equal(at25.row[at25.row.length - 1], '25');
    const info = await csvOf(page, 'gc_info.csv');
    assert.deepEqual(info[0].slice(0, 4), ['Sample', 'm (mg)', 'Q (mL/min)', 'T (°C)']);
    assert.equal(info[1][3], '25');
    // At 0 °C the molar volume is 22.414 L/mol, at 25 °C 24.465: the rate goes up by their ratio.
    await page.fill(shared, '0'); await page.press(shared, 'Enter'); await settle(page);
    const at0 = await mean();
    assert.ok(Math.abs(at0.h2/at25.h2 - 298.15/273.15) < 2e-4, `rate at 0 °C / at 25 °C: ${at0.h2/at25.h2}`);
    // all/one: one sample at 25 °C of its own, the shared field off.
    await page.click('#tab-gc .gc-toggle[data-pair="t"]'); await settle(page);
    assert.equal((await moduleState(page, 'gc')).cards[0].tMode, 'one');
    // A project saved before T: no T in its state, 0 °C, and its rates as they were.
    const st = await encoded(page, 'gc');
    for (const k of ['tMode', 'tShared', 'Ts']) delete st.cards[0][k];
    assert.equal(await restore(page, 'gc', st), 'ok');
    assert.equal(await page.inputValue(shared), '0');
    assert.ok(Math.abs((await mean()).h2 - at0.h2) < 1e-4, 'an old project keeps its rates');
    // A file added to it in one mode starts at 25 °C, as a new file does.
    await page.click('#tab-gc .gc-toggle[data-pair="t"]'); await settle(page);
    await loadFiles(page, 'gc', [env.fx.files.gc[1]]);
    const c = (await moduleState(page, 'gc')).cards[0];
    assert.deepEqual([c.tMode, c.Ts], ['one', [0, 25]]);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

// The fixture's F(R) as reflectance in percent: R = 1 + F − √(F² + 2F), the inverse of
// F = (1 − R)²/2R.
function asReflectance(text, head){
  const lines = text.trim().split('\n');
  return [lines[0], head, ...lines.slice(2).map(l=>{ const [w, f] = l.split(','), F = +f; return w + ',' + (100*(1 + F - Math.sqrt(F*F + 2*F))).toFixed(6); })].join('\n') + '\n';
}
test('38, 39: DRS reads R% by its header; only the Cary layout is standard, any other file said with how it was read; non-physical points left out', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'tauc');
    const ref = drsCsv({ Eg: 3.2 }).toString('utf8');
    const R = asReflectance(ref, 'Wavelength (nm),R%');
    const spaced = R.replace('Wavelength (nm),R%', 'Wavelength (nm)   R %').replace(/,/g, '   ');
    const files = [file('ref.csv', ref), file('r.csv', R), file('pr.csv', R.replace('R%', '%R')), file('refl.csv', R.replace('R%', 'Reflectance (%)')),
      file('spaced.txt', spaced), file('semi.csv', R.replace(/,/g, ';').replace(/(\d)\.(\d)/g, '$1,$2')),
      // Non-physical points: R of 0, 150 and −1 %; F(R) below 0, NaN, past the doubles.
      file('bad-r.csv', R.replace(/\n251,[^\n]+/, '\n251,0').replace(/\n252,[^\n]+/, '\n252,150').replace(/\n253,[^\n]+/, '\n253,-1')),
      file('bad-f.csv', ref.replace(/\n251,[^\n]+/, '\n251,-0.2').replace(/\n252,[^\n]+/, '\n252,NaN').replace(/\n253,[^\n]+/, '\n253,1e999')),
      file('noheader.csv', ref.split('\n').slice(2).join('\n')),
      file('all-bad.csv', 'Wavelength (nm),R%\n300,0\n301,120\n'),
      // The columns' header decides, not a line above it; a line naming no wavelength is
      // passed over unless it names R% (a JASCO export); a header in quotes under spaces.
      file('meta-r.csv', 'Title,abc\nOperator,R%\nWavelength (nm),KM\n' + ref.split('\n').slice(2).join('\n')),
      file('meta-r.txt', 'Operator   R%\nnm   KM\n' + ref.split('\n').slice(2).join('\n').replace(/,/g, '   ')),
      file('jasco.csv', 'TITLE,x\nXUNITS,NANOMETERS\nYUNITS,%R\nXYDATA\n' + R.split('\n').slice(2).join('\n')),
      file('quoted.txt', '"Sample"\n"Wavelength (nm)"   "R%"\n' + R.split('\n').slice(2).join('\n').replace(/,/g, '   ')),
      // The Cary layout under ';' and decimal ',', any case, in quotes: standard; its header
      // on the first line or the third, F(R)'s too, or a unit after F(R): not.
      file('prsemi.csv', R.replace('R%', '%r').replace(/,/g, ';').replace(/(\d)\.(\d)/g, '$1,$2').replace('Wavelength (nm)', '"WAVELENGTH (nm)"')),
      file('pr1.csv', R.replace('R%', '%R').split('\n').slice(1).join('\n')),
      file('pr3.csv', 'Run 4\n' + R.replace('R%', '%R')),
      file('fr1.csv', ref.split('\n').slice(1).join('\n')), file('fru.csv', ref.replace('F(R)', 'F(R) (a.u.)'))];
    await page.setInputFiles('#taucFiles', files);
    await page.waitForFunction(()=> document.querySelectorAll('#taucFileTableWrap tr.file-row').length === 18); await settle(page);
    const st = await moduleState(page, 'tauc', true), by = Object.fromEntries(st.files.map(f=> [f.name, f]));
    // R% read as F(R) = (1 − R)²/2R: the fixture's F(R) again, to the digits R was written with;
    // with no warning only in the Cary layout ("%R" on the second line, the data from the third).
    const STD_R = ['pr.csv', 'prsemi.csv'];
    for (const n of ['r.csv', 'pr.csv', 'refl.csv', 'spaced.txt', 'semi.csv', 'jasco.csv', 'quoted.txt', 'prsemi.csv', 'pr1.csv', 'pr3.csv']){
      assert.equal(by[n].read, 'R%', n);
      assert.equal(by[n].warn, !STD_R.includes(n), n);
      assert.equal(by[n].head, undefined, n);
      assert.deepEqual(by[n].wl, by['ref.csv'].wl, n);
      by[n].FR.forEach((v, i)=> assert.ok(Math.abs(v - by['ref.csv'].FR[i]) < 1e-4*Math.max(1, by['ref.csv'].FR[i]), `${n}: F(R) at ${by[n].wl[i]} nm, ${v} for ${by['ref.csv'].FR[i]}`));
    }
    assert.equal(by['ref.csv'].read, undefined); assert.equal(by['ref.csv'].warn, false);
    assert.equal(by['noheader.csv'].read, undefined); assert.equal(by['noheader.csv'].warn, true); assert.equal(by['noheader.csv'].head, undefined);
    // F(R) named on the first line, or with a unit after it: read as F(R), not the standard.
    for (const n of ['fr1.csv', 'fru.csv']){
      assert.deepEqual([by[n].read, by[n].warn, by[n].head], [undefined, true, true], n);
      assert.deepEqual([by[n].wl, by[n].FR], [by['ref.csv'].wl, by['ref.csv'].FR], n);
    }
    for (const n of ['meta-r.csv', 'meta-r.txt']){
      assert.equal(by[n].read, undefined, n); assert.equal(by[n].warn, true, n);
      assert.deepEqual([by[n].wl, by[n].FR], [by['ref.csv'].wl, by['ref.csv'].FR], n);
    }
    // The points left out, by why; the others kept.
    assert.deepEqual(by['bad-r.csv'].left, { zero: 1, r: 2 });
    assert.equal(by['bad-r.csv'].wl.length, 548);
    assert.deepEqual(by['bad-f.csv'].left, { neg: 1, inf: 2 });
    assert.equal(by['bad-f.csv'].wl.length, 548);
    assert.ok(!by['bad-f.csv'].wl.includes(251));
    const alerts = await page.locator('#taucAlerts').innerText();
    assert.match(alerts, /Invalid file\(s\):\s*all-bad\.csv \(no point with a physical value: 2 points left out \(1 with R outside 0–100 %, 1 with R = 0 %, where F\(R\) is infinite\)\)/);
    assert.match(alerts, /Verify how these files were read:/);
    assert.match(alerts, /^noheader\.csv: no header naming the columns F\(R\) or R%: read as F\(R\)$/m);
    assert.match(alerts, /^meta-r\.csv: no header naming the columns F\(R\) or R%: read as F\(R\)$/m);
    // A header naming the reflectance in any other layout: read as %R, and said.
    for (const n of ['r.csv', 'refl.csv', 'spaced.txt', 'semi.csv', 'jasco.csv', 'quoted.txt', 'pr1.csv', 'pr3.csv'])
      assert.match(alerts, new RegExp('^' + n.replace('.', '\\.') + ': not a standard format: its header names the reflectance in %, read as %R$', 'm'), n);
    for (const n of ['fr1', 'fru']) assert.match(alerts, new RegExp('^' + n + '\\.csv: not a standard format: its header names F\\(R\\), read as F\\(R\\)$', 'm'), n);
    // The standard format, F(R) or %R, has no note on how it was read (the file list says it);
    // the points left out keep theirs.
    assert.match(alerts, /^bad-r\.csv: not a standard format: its header names the reflectance in %, read as %R; 3 points left out \(2 with R outside 0–100 %, 1 with R = 0 %, where F\(R\) is infinite\)$/m);
    assert.match(alerts, /^bad-f\.csv: 3 points left out \(1 with F\(R\) < 0, 2 with a value that is no finite number\)$/m);
    assert.doesNotMatch(alerts, /^(ref|pr|prsemi)\.csv/m, 'the standard format, read as such: no note');
    // The file itself is downloaded as it came.
    const d = await download(page, ()=> page.locator('#taucFileTableWrap tr.file-row:nth-child(2) .dl-file').click());
    assert.equal(d.buf.toString('utf8'), R);
    // The notes come back with the project.
    const s = await encoded(page, 'tauc');
    assert.equal(await restore(page, 'tauc', s), 'ok');
    assert.match(await page.locator('#taucAlerts').innerText(), /^bad-f\.csv: 3 points left out/m);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

/* The Cary 5000's own %R export, a standard F(R) export and a file of no standard format: in
   the file list, in the note right of each label (a column with no header), how its second
   column was read (%R, F(R)), the title saying it in full; an alert for the one of no
   standard format only. The Results' top: F(R) and R (%) against λ side by side, the log plot under them
   across the card (2φ : 1); the R (%) plot, for every sample whatever it was read as, gives
   the Cary's values back, and so does its CSV (reflectance_R.csv); a file left out is left
   out of it. */
test('DRS: a Cary %R export loads with no alert, the file list says how each file was read, R (%) is plotted', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'tauc');
    const cary = caryCsv(), ref = drsCsv({ Eg: 3.2 }).toString('utf8');
    await loadFiles(page, 'tauc', [file('cary.csv', cary.buffer), file('ref.csv', ref)]);
    assert.equal((await page.locator('#taucAlerts').innerText()).trim(), '', 'standard formats: no alert');
    await loadFiles(page, 'tauc', [file('noheader.csv', ref.split('\n').slice(2).join('\n'))]);
    assert.match(await page.locator('#taucAlerts').innerText(), /^⚠ Verify how these files were read:\s*noheader\.csv: no header naming the columns F\(R\) or R%: read as F\(R\)\s*$/);
    const st = await moduleState(page, 'tauc', true), by = Object.fromEntries(st.files.map(f=> [f.name, f]));
    assert.deepEqual([by['cary.csv'].read, by['cary.csv'].warn, by['cary.csv'].wl.length], ['R%', false, 1201]);
    assert.deepEqual(by['cary.csv'].wl, cary.wl, 'its wavelengths, 800 down to 200 nm');
    // F(R) = (1 − R)²/2R of the values written, to round-off.
    by['cary.csv'].FR.forEach((v, i)=>{ const R = cary.R[i]/100, F = (1 - R)**2/(2*R); assert.ok(Math.abs(v - F) <= 1e-12*Math.max(1, F), `F(R) at ${cary.wl[i]} nm: ${v} for ${F}`); });
    // The file list: the note right of the label, with no header.
    const list = await page.$$eval('#taucFileTableWrap tr.file-row', rs=> rs.map(r=>{
      const c = r.querySelector('td.note-cell'), s = c && c.querySelector('[title]');
      return [c && c.textContent, s && s.title, !!(c && c.previousElementSibling.querySelector('.file-label'))];
    }));
    assert.deepEqual(list, [
      ['%R', 'second column read as the reflectance in %, converted to F(R)', true],
      ['F(R)', 'second column read as F(R)', true],
      ['F(R)', 'second column read as F(R), with no header naming it', true]]);
    const heads = await page.$$eval('#taucFileTableWrap thead th', ts=> ts.map(t=> t.textContent.trim()));
    assert.deepEqual(heads.slice(2, 5), ['FILE', 'SAMPLE LABEL', '']);
    // The Results' top: the pair side by side, the log plot under both, across the card at 2φ : 1.
    const box = await page.$$eval('#taucResults svg.plot', ss=> Object.fromEntries(ss.slice(0, 3).map(s=>{ const r = s.getBoundingClientRect(); return [s.id, [r.left, r.top, r.width, r.bottom]]; })));
    const [f0, rr, lg] = ['taucResSvg0', 'taucResSvgR', 'taucResSvgLog'].map(k=> box[k]);
    assert.ok(f0 && rr && lg, 'the three plots, in that order: ' + Object.keys(box));
    assert.ok(Math.abs(f0[1] - rr[1]) < 1 && rr[0] > f0[0] + f0[2], 'F(R) and R (%) side by side');
    assert.ok(lg[1] > Math.max(f0[3], rr[3]) && lg[2] > 1.9*f0[2], 'the log plot under both, across the card');
    assert.ok(Math.abs(lg[2]/(lg[3] - lg[1]) - 3.236) < 0.02, `the log plot at 2φ : 1, ${lg[2]/(lg[3] - lg[1])}`);
    // The R (%) plot: the Cary's values back; for the F(R) files, R whose F(R) is theirs.
    const lines = await page.evaluate(()=> Object.fromEntries(document.getElementById('taucResSvgR')._plot._stored.filter(e=> e.type === 'line').map(e=> [e.key, [e.label, e.xs, e.ys]])));
    assert.deepEqual(Object.keys(lines), ['cary.csv', 'ref.csv', 'noheader.csv']);
    assert.equal(lines['cary.csv'][0], 'cary');
    lines['cary.csv'][2].forEach((v, i)=> assert.ok(Math.abs(v - cary.R[i]) < 1e-9, `R at ${cary.wl[i]} nm: ${v} for ${cary.R[i]}`));
    lines['ref.csv'][2].forEach((v, i)=>{ const R = v/100, F = by['ref.csv'].FR[i]; assert.ok(v > 0 && v <= 100 && Math.abs((1 - R)**2/(2*R) - F) < 1e-9*Math.max(1, F), `ref.csv at ${by['ref.csv'].wl[i]} nm`); });
    assert.equal(await page.getAttribute('#taucResults .plot-dl-btn[data-dl-svg="taucResSvgR"]', 'data-csv-names'), 'reflectance_R.csv');
    assert.match(await page.locator('#taucResLegendR').innerText(), /cary\s*ref\s*noheader/);
    // Its CSV: each sample's wavelength and R in %, beside the others; a file left out, left out.
    await page.click('#taucFileTableWrap tr.file-row:nth-child(2) .file-incl'); await settle(page);
    const R = await csvOf(page, 'reflectance_R.csv');
    assert.deepEqual(R[0], ['wavelength_nm_cary', 'R_percent_cary', 'wavelength_nm_noheader', 'R_percent_noheader']);
    assert.equal(R.length, 1202);
    // (six decimals: within half the last of the value written)
    R.slice(1).forEach((r, i)=> assert.ok(Math.abs(+r[1] - cary.R[i]) <= 5.000001e-7 && +r[0] === cary.wl[i], `reflectance_R.csv row ${i + 1}: ${r}`));
    assert.deepEqual(await page.evaluate(()=> document.getElementById('taucResSvgR')._plot._stored.filter(e=> e.type === 'line').map(e=> e.key)), ['cary.csv', 'noheader.csv']);
    // A project from before the reading was kept (no `read`): F(R), as it was read.
    const s = await encoded(page, 'tauc');
    s.files.forEach(f=>{ delete f.read; });
    assert.equal(await restore(page, 'tauc', s), 'ok');
    assert.deepEqual(await page.$$eval('#taucFileTableWrap td.note-cell', cs=> cs.map(c=> c.textContent)), ['F(R)', 'F(R)', 'F(R)']);
    // The R (%) plot's figure composer opens with the samples' traces.
    await page.locator('#taucResSvgR').locator('xpath=..').locator('button[title="Figure composer (advanced export)"]').click();
    await page.waitForSelector('.fig-backdrop .fig-svg path');
    await page.keyboard.press('Escape');
    await page.waitForFunction(()=> !document.querySelector('.fig-backdrop'));
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

/* Every value of the state, down its objects and arrays (a list of numbers as one; of a
   list of anything else, its first entry; the first two files, one left out of the
   analysis), put in as one of another type in turn, and restored as a project is opened: no throw, no page
   error, the cards unfolded and stepped after; then the true state again, drawn as before. */
// (null: no string, number, object or array; 'x': a string where a number, an array or
// an object is due; an object where an array or a number is)
const JUNK = [null, 'x', { a: 1 }];
for (const mod of ['tauc', 'gc', 'epr']){
  test(`22: ${mod} restores a malformed project without a throw or a page error`, async ()=>{
    const { page, errors, close } = await env.page();
    try {
      await openModule(page, mod);
      await loadFiles(page, mod, mod === 'tauc' ? [fx(env.fx.files.tauc[0]), file('r.csv', asReflectance(drsCsv({ Eg: 3.0, seed: 9 }).toString('utf8'), 'Wavelength (nm),R%'))] : env.fx.files[mod]);
      // Settings of every kind: per-sample values, a file left out.
      if (mod === 'gc'){ await page.click('#tab-gc .gc-toggle[data-pair="m"]'); await page.click('#tab-gc .gc-toggle[data-pair="end"]'); }
      if (mod === 'tauc'){
        await page.click('#tab-tauc [id$="ModeAll"]');
        // The card turned Urbach and back: the settings of the kind not on show kept.
        const kind = async k =>{ await page.click('#tab-tauc .an-card .an-type'); await page.click(`.an-menu:not([hidden]) [data-kind="${k}"]`); await settle(page); };
        await kind('urbach'); await kind('tauc');
      }
      await page.click(`#${mod}FileTableWrap tr.file-row:nth-child(1) .file-incl`);
      await settle(page);
      const good = await encoded(page, mod), plots0 = await page.$$eval(`#tab-${mod} svg.plot`, s=> s.length);
      const paths = [];
      (function walk(v, p){
        paths.push(p);
        if (!v || typeof v !== 'object' || v.__t) return;
        if (Array.isArray(v)){ if (!v.every(x=> typeof x === 'number' || x === null)) v.slice(0, p[0] === 'files' ? 2 : 1).forEach((x, i)=> walk(x, [...p, i])); return; }
        for (const k of Object.keys(v)) if (k !== 'rawBytes' && k !== 'rawFiles') walk(v[k], [...p, k]);
      })(good, []);
      const bad = [];
      for (const p of paths) for (const j of JUNK){
        const st = structuredClone(good);
        let o = st; for (const k of p.slice(0, -1)) o = o[k];
        const s = p.length ? (o[p[p.length - 1]] = structuredClone(j), st) : structuredClone(j);
        const e0 = errors.length, r = await restore(page, mod, s, 1);
        await page.evaluate(m=>{ for (const b of document.querySelectorAll(`#tab-${m} .an-card.is-folded .an-fold`)) b.click(); for (const b of document.querySelectorAll(`#tab-${m} .an-next`)) b.click(); }, mod);
        if (r !== 'ok' || errors.length > e0) bad.push(`${p.join('.') || '(the state)'} = ${JSON.stringify(j)}: ${r} ${errors.slice(e0).join(' | ').slice(0, 160)}`);
      }
      assert.deepEqual(bad, [], `${bad.length} of ${paths.length*JUNK.length} restores`);
      // A file with nothing to show is left out, said, and takes its own settings with it.
      const st = structuredClone(good);
      st.files.splice(1, 0, { name: 'empty', label: 'empty' });
      assert.equal(await restore(page, mod, st), 'ok');
      assert.match(await page.locator(`#${mod}Alerts`).textContent(), /1 file in the project with no data to show: left out\./);
      assert.deepEqual((await moduleState(page, mod)).files.map(f=> f.name), good.files.map(f=> f.name));
      // The true state again: drawn as before.
      assert.equal(await restore(page, mod, good), 'ok');
      assert.equal(await page.$$eval(`#tab-${mod} svg.plot`, s=> s.length), plots0);
      assert.deepEqual(errors, []);
    } finally { await close(); }
  });
}

test('22: a file left out by the restore takes its per-sample settings with it (GC)', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'gc');
    await loadFiles(page, 'gc', env.fx.files.gc);
    await page.click('#tab-gc .gc-toggle[data-pair="m"]'); await settle(page);
    const s = '#tab-gc .gcCell[data-i="1"][data-f="m"]';
    await page.fill(s, '30'); await page.press(s, 'Enter'); await settle(page);
    const st = await encoded(page, 'gc');
    st.files[0] = { name: 'alpha.csv', injDates: 'none', gas: {} };
    assert.equal(await restore(page, 'gc', st), 'ok');
    const c = (await moduleState(page, 'gc')).cards[0];
    assert.deepEqual(c.ms, [30], "beta keeps its own mass");
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
