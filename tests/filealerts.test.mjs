/* What the page says of the files dropped (v567, ALERTS-REVIEW.md R1–R4), in every module.
   Every file here is made up for the test.
   - A file whose bytes cannot be read when the module reads them (chosen, then deleted from
     the disk before the drop is read: the browser's NotFoundError, as a file moved or no
     longer accessible gives) is refused with why, "Not loaded:" and "{file}: could not be
     read from the disk (moved, deleted or not accessible).", in DRS, GC, GC's Calibration
     window, Custom, SEM, Iodometry, XRPD (the samples' zone and the standard's window) and
     EPR; the other files of the same drop are loaded, those before it and those after (to
     v566 DRS, GC, Custom, SEM, Iodometry and the Calibration window ended the drop there
     with no word, an unhandled rejection; XRPD and EPR said the browser's own message, EPR
     naming the pair's stem). No page error.
   - Each drop's alerts replace the last drop's, its refusals and its files already loaded,
     a drop that loads nothing too (to v566 an earlier drop's alert stayed after a drop that
     failed, as if it spoke of the new files).
   - The words (R4): one box a kind under the drop zone, error, warning, info in that order;
     "Not loaded:" with "{file}: {why}.", a file the reader cannot take with why (GC's, a
     file neither .DTA nor .DSC); "Already loaded, not loaded again:" an info; "Loaded, to
     check:" and "How these files were read:" (DRS's points left out and its formats, XRPD's
     scans, Iodometry's pairs of columns left out, EPR's spectrum with no microwave
     frequency, a half pair refused saying which half is missing).
   - A save the browser's storage refuses: said, the tab left unsaved (to v566 nothing). */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { start, openModule, loadFiles, settle, moduleState, banner, answer, tabLabels, firstTop } from './helpers.mjs';
import { drsCsv, gcCsv, xrdml, eprPair, tif } from './fixtures.mjs';

let env;
before(async ()=>{ env = await start(); });
after(()=> env && env.close());

const GONE = 'could not be read from the disk (moved, deleted or not accessible).';
const csv = (name, text)=> ({ name, mimeType: 'text/csv', buffer: Buffer.isBuffer(text) ? text : Buffer.from(text) });
/* Files given to a module's file input (`input`, a selector) as a drop would: written to a
   folder of their own, chosen in an input of the test's, those named in `gone` deleted from
   the disk, then handed to the module's input (a File keeps its disk's file: reading one
   deleted since fails). Done when the drop zone has read them. */
async function drop(page, input, files, gone = []){
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'datatreat-gone-'));
  try {
    const paths = files.map(f=>{ const p = path.join(dir, f.name); fs.writeFileSync(p, f.buffer); return p; });
    await page.evaluate(()=>{ const i = document.createElement('input'); i.type = 'file'; i.multiple = true; i.id = 'testPick'; i.style.display = 'none'; document.body.appendChild(i); });
    await page.setInputFiles('#testPick', paths);
    for (const n of gone) fs.rmSync(path.join(dir, n));
    await page.evaluate(sel=>{
      const src = document.getElementById('testPick'), dst = document.querySelector(sel), dt = new DataTransfer();
      for (const f of src.files) dt.items.add(f);
      src.remove();
      dst.files = dt.files;
      dst.dispatchEvent(new Event('change'));
    }, input);
    await page.waitForFunction(()=> !document.querySelector('.dz-loading'), null, { timeout: 30000 });
    await settle(page);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
// The boxes under a drop zone (`sel`, their container), in order: their kind and their lines.
const boxes = (page, sel)=> page.$$eval(`${sel} .alert`, els=> els.map(e=> [e.classList[1], ...e.innerText.split('\n').map(s=> s.trim()).filter(Boolean)]));

/* ---- Each module: three files it reads, one it refuses, the names it loads them under ---- */
// Iodometry: two pairs of columns (time, absorbance), the second of `short` points.
function kinetics(name, short = 40, k = 0){
  let s = 'A,,B,,\r\nTime (sec),Abs,Time (sec),Abs,\r\n';
  for (let j = 0; j < 40; j++) s += `${(0.05 + j).toFixed(2)},${(0.1 + 0.01*k + (j > 10 ? 0.2 : 0) + (j === 10 ? 0.4 : 0)).toFixed(4)},${j < short ? `${(0.05 + j).toFixed(2)},0.1${j}` : ','},\r\n`;
  return csv(name, s);
}
const tifs = ['i1.tif', 'i2.tif', 'i3.tif', 'gone.tif', 'gone2.tif'].map((n, k)=> tif(n, { sign: 'S' + k, seed: 1 + k }));
const pairs = k =>{ const e = eprPair({ title: 't' + k, seed: 11 + k }); return [{ name: `e${k}.DSC`, buffer: e.dsc }, { name: `e${k}.DTA`, buffer: e.dta }]; };
const MODS = {
  tauc: { name: 'DRS', files: k => [csv(`d${k}.csv`, drsCsv({ Eg: 2.8 + 0.1*k, seed: 3 + k }))], junk: csv('junk.csv', 'hello\n'),
    why: 'no header naming its columns: the wavelength in nm, and F(R) or %R', names: st => st.files.map(f=> f.name) },
  gc: { name: 'GC', files: k => [csv(`g${k}.csv`, gcCsv({ seed: 7 + k }))], junk: csv('junk.csv', 'hello\n'),
    why: 'not a GC table: no injection date and H₂ or O₂ column under a header', names: st => st.files.map(f=> f.name) },
  fig: { name: 'Custom', files: k => [csv(`c${k}.csv`, `x,y\n1,${k}\n2,${k + 2}\n3,${k + 1}\n`)], junk: csv('junk.csv', 'hello\n'),
    why: 'no column of numbers found', names: st => st.files.map(f=> f.name) },
  sem: { name: 'SEM', files: k => [tifs[k]], junk: csv('junk.txt', 'hello'), why: 'not a TIFF', names: st => st.files.map(f=> f.name) },
  iodo: { name: 'Iodometry', files: k => [kinetics(`k${k}.csv`, 40, k)], junk: csv('junk.csv', 'hello\n'),
    why: 'no columns of time and absorbance found', names: st => [...new Set(st.files.map(f=> f.src || f.name))] },
  xrd: { name: 'XRPD', files: k => [{ name: `s${k}.xrdml`, buffer: xrdml(k, { n: 400 }) }], junk: csv('junk.xrdml', 'hello'),
    why: 'not well-formed XML', names: st => st.files.map(f=> f.name) },
  epr: { name: 'EPR', files: pairs, junk: csv('junk.txt', 'hello'), why: 'not a .DTA or .DSC file', names: st => st.files.map(f=> f.name) },
};
// The unreadable file of a module's drop, and the lines it gives (EPR: its partner's too).
const goneOf = (mod, n)=> mod === 'sem' ? n + '.tif' : mod === 'epr' ? n + '.DSC' : mod === 'xrd' ? n + '.xrdml' : n + '.csv';
const goneFiles = (mod, n)=> mod === 'sem' ? [tifs[n === 'gone' ? 3 : 4]] : mod === 'epr' ? [{ name: n + '.DSC', buffer: eprPair({ title: n }).dsc }, { name: n + '.DTA', buffer: eprPair({ title: n }).dta }]
  : mod === 'xrd' ? [{ name: n + '.xrdml', buffer: xrdml(5) }] : mod === 'iodo' ? [kinetics(n + '.csv')] : MODS[mod].files(9).map(f=> ({ ...f, name: n + '.csv' }));
const goneLines = (mod, n)=> [`${goneOf(mod, n)}: ${GONE}`, ...(mod === 'epr' ? [`${n}.DTA: its .DSC could not be read.`] : [])];
const loadedName = (mod, f)=> mod === 'epr' ? f.name.replace(/\.[^.]+$/, '') : f.name;

for (const [mod, M] of Object.entries(MODS)){
  test(`${M.name}: a file gone from the disk refused with why, the rest of its drop loaded; each drop's alerts replace the last's`, async ()=>{
    const { page, errors, close } = await env.page();
    try {
      await openModule(page, mod);
      const input = `#${mod}Files`, alerts = `#${mod}Alerts`, [f0, f1, f2] = [0, 1, 2].map(M.files);
      // A drop with a file refused and one already loaded: both said.
      await drop(page, input, f0);
      await drop(page, input, [...f0, M.junk]);
      assert.deepEqual(await boxes(page, alerts), [['bad', '✕ Not loaded:', `${M.junk.name}: ${M.why}.`], ['info', 'Already loaded, not loaded again:', ...f0.map(f=> f.name + '.')]]);
      // A file gone from the disk between two others: refused with why, the others loaded; the
      // last drop's alerts gone.
      await drop(page, input, [...f1, ...goneFiles(mod, 'gone'), ...f2], mod === 'epr' ? ['gone.DSC'] : [goneOf(mod, 'gone')]);
      const st = await moduleState(page, mod);
      assert.deepEqual(M.names(st), [...new Set([...f0, ...f1, ...f2].map(f=> loadedName(mod, f)))], 'the files before and after it loaded');
      assert.deepEqual(await boxes(page, alerts), [['bad', '✕ Not loaded:', ...goneLines(mod, 'gone')]], 'said, with why; the last drop\'s alerts gone');
      // A drop that loads nothing: its own alert, the last drop's gone.
      await drop(page, input, goneFiles(mod, 'gone2'), mod === 'epr' ? ['gone2.DSC'] : [goneOf(mod, 'gone2')]);
      assert.deepEqual(await boxes(page, alerts), [['bad', '✕ Not loaded:', ...goneLines(mod, 'gone2')]]);
      assert.equal(M.names(await moduleState(page, mod)).length, M.names(st).length, 'nothing more loaded');
      assert.deepEqual(errors, [], 'no page error (to v566 an unhandled rejection)');
    } finally { await close(); }
  });
}

/* ---- GC's Calibration window and XRPD's standard's window: the same ---- */
// A GC table and its raw chromatograms (no header, the time and one column a chromatogram).
const T = Array.from({ length: 200 }, (_, i)=> 250 + 0.5*i);
const tcdFile = (name, n)=> csv(name, T.map(t=> [t, ...Array.from({ length: n }, (_, k)=> (100*Math.exp(-(((t - 287)/1.5)**2))*(k + 1) + 50*Math.exp(-(((t - 302)/1.5)**2))).toFixed(4))].join(';') + ';').join('\r\n') + '\r\n');
const gcTable = (name, n)=> csv(name, 'Injection Date,H2 (A) [%Mol],O2 (A) [%Mol]\n' + Array.from({ length: n }, (_, k)=> `11/13/2026 10:${String(10*k).padStart(2, '0')}:00,0.0${k + 1},0.02\n`).join(''));

test('GC\'s Calibration window: a file gone from the disk refused with why, the rest of its drop read; a standard already loaded an info; each drop\'s alerts replace the last\'s', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'gc');
    await loadFiles(page, 'gc', [gcTable('run.csv', 3), tcdFile('run_TCD.csv', 3)], 1);
    const m = page.locator('.gci-cal-modal');
    await page.locator('#tab-gc .an-card .gci-cal').first().click(); await m.waitFor({ state: 'visible' });
    const said = ()=> boxes(page, '.gci-cal-modal .gci-cal-alerts');
    await drop(page, '.gci-cal-modal .gci-cal-in', [gcTable('std.csv', 2), tcdFile('std_TCD.csv', 2)]);
    assert.deepEqual(await said(), [], 'a pair loaded');
    await drop(page, '.gci-cal-modal .gci-cal-in', [gcTable('std.csv', 2), csv('junk.csv', 'hello\n')]);
    assert.deepEqual(await said(), [['bad', '✕ Not loaded:', 'junk.csv: neither raw chromatograms nor a GC table: no injection date and H₂ or O₂ column under a header.'],
      ['info', 'Already loaded, not loaded again:', 'std.csv.']]);
    await drop(page, '.gci-cal-modal .gci-cal-in', [gcTable('two.csv', 2), csv('gone.csv', 'x'), tcdFile('two_TCD.csv', 2)], ['gone.csv']);
    assert.deepEqual(await said(), [['bad', '✕ Not loaded:', `gone.csv: ${GONE}`]]);
    assert.deepEqual(await m.locator('.gci-cal-files .xrd-std-name').allTextContents(), ['std.csv + std_TCD.csv', 'two.csv + two_TCD.csv'], 'the pair around it loaded');
    await drop(page, '.gci-cal-modal .gci-cal-in', [csv('gone2.csv', 'x')], ['gone2.csv']);
    assert.deepEqual(await said(), [['bad', '✕ Not loaded:', `gone2.csv: ${GONE}`]]);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('XRPD\'s standard window: a file gone from the disk refused with why (not the browser\'s words); a drop of several, the first taken, said as an info', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'xrd');
    await loadFiles(page, 'xrd', env.fx.files.xrd.slice(0, 1));
    await page.click('#xrdR2Std');
    await page.waitForSelector('#xrdStdRv', { state: 'visible' });
    const said = ()=> boxes(page, '#xrdStdRv .xrd-std-alerts');
    await drop(page, '#xrdStdRvFiles', [{ name: 'g.xrdml', buffer: xrdml(11) }], ['g.xrdml']);
    assert.deepEqual(await said(), [['bad', '✕ Not loaded:', `g.xrdml: ${GONE}`]]);
    await drop(page, '#xrdStdRvFiles', [{ name: 'std.xrdml', buffer: xrdml(11) }, { name: 'other.xrdml', buffer: xrdml(12) }]);
    assert.deepEqual(await said(), [['info', 'How these files were read:', '2 files dropped: the first, std.xrdml, is the standard; the others are not used.']]);
    assert.match(await page.locator('#xrdStdRv .xrd-std-file').textContent(), /std\.xrdml/);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

/* ---- The words, R4 ---- */
test('DRS: error, warning, info in that order, one box a kind: refused with why, points left out to check, a format read, a file already loaded', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'tauc');
    const ref = drsCsv({ Eg: 3.2 }).toString('utf8'), rows = ref.split('\n'), body = rows.slice(2);
    await drop(page, '#taucFiles', [csv('ref.csv', ref)]);
    // (a header naming F(R) on the first line: no standard format; three values that are no point)
    await drop(page, '#taucFiles', [csv('ref.csv', ref), csv('junk.csv', 'hello\n'), csv('nonstd.csv', 'Wavelength (nm),F(R)\n' + body.join('\n')),
      csv('bad.csv', 'Wavelength (nm),F(R)\n' + body.map((l, i)=> i < 3 ? l.replace(/,.*/, ',-1') : l).join('\n'))]);
    assert.deepEqual(await boxes(page, '#taucAlerts'), [
      ['bad', '✕ Not loaded:', 'junk.csv: no header naming its columns: the wavelength in nm, and F(R) or %R.'],
      ['warn', '⚠ Loaded, to check:', 'bad.csv: 3 points left out: 3 with F(R) < 0.'],
      ['info', 'How these files were read:', 'nonstd.csv: not a standard format: its header names F(R), read as F(R).', 'bad.csv: not a standard format: its header names F(R), read as F(R).'],
      ['info', 'Already loaded, not loaded again:', 'ref.csv.']]);
    // Each its own ×: the info dismissed, the warning stays.
    await page.click('#taucAlerts [data-action="tauc-dismiss-read"]'); await settle(page);
    assert.deepEqual((await boxes(page, '#taucAlerts')).map(b=> b[1]), ['✕ Not loaded:', '⚠ Loaded, to check:', 'Already loaded, not loaded again:']);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('EPR: a half pair refused saying which half is missing; a pair refused named by its files; a spectrum with no microwave frequency said, an info', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'epr');
    const a = eprPair({ title: 'a' }), b = eprPair({ title: 'b' }), dsc = a.dsc.toString('latin1');
    await drop(page, '#eprFiles', [{ name: 'a.DSC', buffer: a.dsc }, { name: 'a.DTA', buffer: a.dta }, { name: 'lone.DTA', buffer: b.dta }, { name: 'solo.DSC', buffer: b.dsc },
      { name: 'x.txt', buffer: Buffer.from('x') }, { name: 'bad.DSC', buffer: Buffer.from(dsc.replace(/XPTS 1024\n/, ''), 'latin1') }, { name: 'bad.DTA', buffer: a.dta },
      { name: 'nf.DSC', buffer: Buffer.from(dsc.replace(/MWFQ .*\n/, ''), 'latin1') }, { name: 'nf.DTA', buffer: a.dta }]);
    assert.deepEqual((await moduleState(page, 'epr')).files.map(f=> f.name), ['a', 'nf']);
    assert.deepEqual(await boxes(page, '#eprAlerts'), [
      ['bad', '✕ Not loaded:', 'x.txt: not a .DTA or .DSC file.', 'lone.DTA: its .DSC is missing: drop the two together.', 'solo.DSC: its .DTA is missing: drop the two together.',
        'bad.DTA + bad.DSC: its .DSC gives no XPTS, the number of points.'],
      ['info', 'How these files were read:', 'nf.DSC: no microwave frequency (MWFQ): plotted on the field measured, not at 9.5 GHz; no g axis.']]);
    assert.equal(await page.locator('#eprPendingWrap').count(), 0, 'no box of its own for the halves (to v566)');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('Iodometry and XRPD: what was left out to check, how the files were read as an info', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'iodo');
    await drop(page, '#iodoFiles', [kinetics('k.csv', 2)]);
    assert.deepEqual(await boxes(page, '#iodoAlerts'), [['warn', '⚠ Loaded, to check:', 'k.csv: 1 pair of columns left out: fewer than 3 points.']]);
    assert.deepEqual((await moduleState(page, 'iodo')).files.map(f=> f.name), ['k.csv (1)']);
    // A reading time past the trace's end: n/a, why in a compact warning under the read-outs, the
    // column's title still on the plot frame's top edge (CLAUDE.md).
    await page.fill('#iodoTRead', '500'); await page.press('#iodoTRead', 'Enter'); await settle(page);
    assert.equal(await page.textContent('#iodoA'), 'n/a');
    assert.match(await page.locator('#iodoAWarn .alert.warn.compact').innerText(), /^⚠ The trace ends [\d.]+ s after the injection: no reading at 500 s\.$/);
    const t = await firstTop(page, '#iodoAnalysis', { frame: 'svg.plot', head: ':scope .col.mw280 > .param-head' });
    assert.ok(Math.abs(t.top - t.frame) <= 1, `the title's top ${t.top}, the plot frame's ${t.frame}`);
    // XRPD: a file of two scans, the second not read: how it was read, an info; the scan not
    // read, to check.
    await openModule(page, 'xrd');
    const one = xrdml(0, { n: 400 }).toString('utf8'), scan = one.slice(one.indexOf('<scan '), one.indexOf('</scan>') + 7);
    const two = one.replace(scan, scan + scan.replace(/<intensities[\s\S]*?<\/intensities>/, ''));
    await drop(page, '#xrdFiles', [{ name: 'two.xrdml', buffer: Buffer.from(two) }]);
    assert.deepEqual(await boxes(page, '#xrdAlerts'), [['warn', '⚠ Loaded, to check:', 'two.xrdml: scan 2 not read: no <intensities> or <counts>.'],
      ['info', 'How these files were read:', 'two.xrdml: 2 scans, 1 of them loaded, each a pattern of its own.']]);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('a save the browser\'s storage refuses: said, the tab left unsaved', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'tauc');
    await loadFiles(page, 'tauc', env.fx.files.tauc);
    await page.evaluate(()=>{ const put = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function(...a){ if (this.name === 'sessions') throw new DOMException('quota (test)', 'QuotaExceededError'); return put.apply(this, a); }; });
    await page.fill('.project-name-input', 'Full');
    await page.click('.proj-save');
    await page.waitForSelector('.pwa-confirm.show');
    assert.equal((await banner(page)).text, '“Full” could not be saved (this browser\'s storage is full): your work is still in its tab.');
    await answer(page, 'ok');
    assert.ok((await tabLabels(page))[0].endsWith('*'), 'still unsaved');
    assert.equal(await page.locator('.proj-save.is-saved').count(), 0);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

/* ---- Where nothing was said (C15, C16) ---- */
test('a project renamed to another\'s name, a palette saved under one that exists: asked first; not taken, as it was', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    for (const name of ['A', 'B']){ await openModule(page, 'tauc'); await loadFiles(page, 'tauc', env.fx.files.tauc.slice(0, 1)); await page.fill('.project-name-input', name); await page.click('.proj-save'); await page.waitForSelector('.proj-save.is-saved'); }
    await page.click('#nav button[data-tab="projects"]');
    await page.waitForSelector('#sessListWrap tr.sess-row');
    const titles = ()=> page.$$eval('#sessListWrap input.proj-rename', s=> s.map(e=> e.value).sort());
    const inp = ()=> page.locator('#sessListWrap input.proj-rename[value="B"]');
    await inp().fill('a'); await inp().press('Enter');
    await page.waitForSelector('.pwa-confirm.show');
    assert.equal((await banner(page)).text, 'Another UV-Vis DRS project is named “A”. Rename it anyway?');
    await answer(page, 'x');
    assert.deepEqual(await titles(), ['A', 'B'], 'not taken');
    await inp().fill('a'); await inp().press('Enter');
    await answer(page, 'ok');
    await page.waitForFunction(()=> [...document.querySelectorAll('#sessListWrap input.proj-rename')].some(e=> e.value === 'a'));
    assert.deepEqual(await titles(), ['A', 'a'], 'taken when asked');
    // The palette: saved, then saved again under its name.
    await page.locator('#tabBar .ptab').first().locator('.ptab-label').click(); await settle(page);
    const save = async ()=>{ await page.click('#taucFileTableWrap button.palette-pick-btn'); await page.fill('.pp-popup .pp-save-name', 'Mine'); await page.click('.pp-popup .pp-save-btn'); };
    await save();
    assert.equal(await page.locator('.pwa-confirm.show').count(), 0, 'a new name: nothing asked');
    await page.keyboard.press('Escape');
    if (await page.locator('.pp-popup').isVisible()) await page.click('#taucFileTableWrap button.palette-pick-btn');
    await save();
    await page.waitForSelector('.pwa-confirm.show');
    assert.equal((await banner(page)).text, 'A palette named “Mine” exists. Replace it?');
    await answer(page, 'x');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('a plot\'s Copy image that fails says so beside it; the figure composer that cannot load says so', async ()=>{
  const { page, errors, close } = await env.page({ clipboard: true });
  try {
    await openModule(page, 'tauc');
    await loadFiles(page, 'tauc', env.fx.files.tauc);
    await page.evaluate(()=>{ navigator.clipboard.write = ()=> Promise.reject(new DOMException('denied (test)', 'NotAllowedError')); });
    const wrap = page.locator('#tab-tauc .an-card .plot-wrap').first();
    await wrap.hover();
    await wrap.locator('.plot-tool-btn[title="Copy image"]').click();
    await page.waitForSelector('#tab-tauc .plot-tool-say');
    assert.equal(await page.locator('#tab-tauc .plot-tool-say').textContent(), 'Copy failed');
    await page.waitForFunction(()=> !document.querySelector('.plot-tool-say'), null, { timeout: 5000 });
    // (figure.js not served: offline with an old cache, say)
    await page.route('**/figure.js', r=> r.abort());
    await wrap.hover();
    await wrap.locator('button[title="Figure composer (advanced export)"]').click();
    await page.waitForSelector('.pwa-confirm.show');
    assert.equal((await banner(page)).text, 'The figure composer could not be loaded: reload the page.');
    await answer(page, 'ok');
    assert.deepEqual(errors.filter(e=> !/figure composer failed to load|figure\.js|net::ERR_FAILED/.test(e)), []);
  } finally { await close(); }
});
