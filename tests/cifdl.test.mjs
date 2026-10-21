/* The Rietveld card's Phases list: each phase's CIF downloaded by its own button, left of
   its × (v503; up to v502 a CIF could not be had back from the card).
   A: in a samples' card, the button on every row (the file list's download glyph and look,
   titled, named for its phase, as tall as the × and just left of it); a click downloads the
   CIF under its file's name: a UTF-8 file byte for byte (its line ends and non-ASCII
   characters kept), a UTF-16 one as its text in UTF-8, a UTF-8 one with its mark without
   the mark; a phase with no file name under its name. The row is not selected by it, the
   history takes no step, and Tab, Enter and Space reach it.
   B: the standard's window: the built-in LaB6's CIF, as the card writes it, under
   LaB6_NIST-SRM-660c.cif; a CIF added there, its own, one named with no extension under
   its name as it is (no '.csv' added).
   C: while a run goes on, the button is enabled and downloads, with no step of the
   history.
   D: on a list under 155 px (a phone, a window of 1150 px) the row leaves out its space
   group, the × in the row and the formula with room; on a wider one (a window of 1200 px, a
   1280 px laptop) the space group shown, the × in the row with the widest common symbols
   (P4₂/mnm) too. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { start, openModule, loadFiles, settle, history, download, ROOT } from './helpers.mjs';

// Chromium names a download in the file system's encoding, which the C locale (a bare
// container's) makes ASCII: a name with ü became "download". The browser gets a UTF-8 one.
if (!/utf-?8/i.test(process.env.LC_ALL || process.env.LC_CTYPE || process.env.LANG || '')) process.env.LC_ALL = 'C.UTF-8';

let env;
before(async ()=>{ env = await start(); });
after(()=> env && env.close());

const P = '#xrdR2';   // the default deck's second card, a Rietveld one
const SRT = fs.readFileSync(new URL('./fixtures/SrTiO3.cif', import.meta.url), 'utf8');
// CIFs with what an encoding can lose: CRLF line ends, non-ASCII characters in a comment, an
// author and a title (ü, Å, —, a Greek letter, an emoji outside the BMP).
const rich = (name, el, a)=> SRT.replace(/SrTiO3/g, name).replace(/Sr/g, el).replace(/3\.905/g, a)
  .replace('_cell_length_a', `# Ti–O octahedra, a in Å (é, ü, β)\n_publ_author_name 'Müller, Jörg'\n_publ_section_title 'Pérovskite 🧪 — ${name}'\n_cell_length_a`)
  .replace(/\n/g, '\r\n');
const U8 = Buffer.from(rich('SrTiO3', 'Sr', '3.905'), 'utf8');
const U16TEXT = rich('BaTiO3', 'Ba', '4.00');
const U16 = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(U16TEXT, 'utf16le')]);
const BOMTEXT = rich('CaTiO3', 'Ca', '3.84');
const BOM8 = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(BOMTEXT, 'utf8')]);
// The built-in LaB6's CIF as xrd-rv.js writes it.
// A CIF with one of the widest common space-group symbols (P4₂/mnm, as rutile's).
const WIDE = Buffer.from(SRT.replace('data_SrTiO3', 'data_wide').replace("'P m -3 m'", "'P 42/m n m'"), 'utf8');
const LAB6 = fs.readFileSync(`${ROOT}/xrd-rv.js`, 'utf8').match(/const LAB6_CIF = `([^`]*)`/)[1];

// Each row of a list: its download button and its ×, as laid out and named.
const rows = (page, pre = P)=> page.evaluate(pre=> [...document.querySelectorAll(pre + 'PhaseList .rv-cif')].map(r=>{
  const d = r.querySelector('[data-dl]'), x = r.querySelector('[data-del]');
  if (!d) return { formula: r.querySelector('.rv-cif-f').textContent, dl: null };
  const a = d.getBoundingClientRect(), b = x.getBoundingClientRect(), g = d.querySelector('svg'), list = r.parentElement;
  return { formula: r.querySelector('.rv-cif-f').textContent, sel: r.classList.contains('is-sel'), tag: d.tagName, cls: d.className, title: d.title,
    fw: r.querySelector('.rv-cif-f').getBoundingClientRect().width, sg: getComputedStyle(r.querySelector('.rv-cif-sg')).display !== 'none',
    rowW: r.getBoundingClientRect().width, listW: list.clientWidth, sideways: list.scrollWidth > list.clientWidth,
    label: d.getAttribute('aria-label'), disabled: d.disabled, delDisabled: x.disabled, next: d.nextElementSibling === x, icon: g && g.getAttribute('class'),
    gap: b.left - a.right, dy: Math.abs((a.top + a.bottom)/2 - (b.top + b.bottom)/2), h: a.height, xh: b.height, w: a.width, xw: b.width,
    inRow: a.left >= r.getBoundingClientRect().left && b.right <= r.getBoundingClientRect().right };
}), pre);
// A file as the picker gives it, by its bytes (a path with a non-ASCII name, Playwright
// leaves out of the files it sets).
const file = (name, buffer)=> ({ name, mimeType: 'chemical/x-cif', buffer });
const dlRow = (page, i, pre = P)=> download(page, ()=> page.click(`${pre}PhaseList .rv-cif:nth-child(${i + 1}) [data-dl]`));

test('A: a samples\' card: each phase\'s CIF downloaded, as read, under its file\'s name', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'xrd');
    await loadFiles(page, 'xrd', env.fx.files.xrd.slice(0, 1));
    await page.setInputFiles(P + 'CifInput', [file('SrTiO3 Müller.cif', U8), file('BaTiO3_utf16.cif', U16), file('CaTiO3_bom.cif', BOM8)]);
    await settle(page);
    let r = await rows(page);
    assert.deepEqual(r.map(x=> x.formula), ['SrTiO₃', 'BaTiO₃', 'CaTiO₃'], 'the three read');
    r.forEach((x, i)=>{
      const w = `row ${i + 1}`;
      assert.equal(x.tag, 'BUTTON', w + ': a button (Tab reaches it)');
      assert.match(x.cls, /\bdel-bare\b/); assert.match(x.cls, /\bdl-bare\b/); assert.match(x.cls, /\bidle-dim\b/);
      assert.equal(x.icon, 'dl-icon', w + ': the file list\'s download glyph');
      assert.equal(x.title, 'Download the CIF');
      assert.equal(x.label, `Download the CIF of ${['SrTiO3', 'BaTiO3', 'CaTiO3'][i]}`, w + ': named for its phase');
      assert.equal(x.disabled, false);
      assert.ok(x.next, w + ': just before the ×');
      assert.ok(x.gap >= 0 && x.gap <= 4, `${w}: left of the ×, next to it (${x.gap} px between the buttons)`);
      assert.ok(x.dy < 1 && Math.abs(x.h - x.xh) < 1 && Math.abs(x.w - x.xw) < 1, `${w}: sized as the × (${x.w}×${x.h} against ${x.xw}×${x.xh}, centres ${x.dy} px apart)`);
      assert.ok(x.inRow, w + ': inside its row');
    });
    assert.deepEqual(r.map(x=> x.sel), [true, false, false], 'the first added selected');
    const h0 = await history(page, 'xrd'), name0 = await page.textContent(P + 'CellName');
    // UTF-8: the file's bytes. UTF-16: its text, in UTF-8. UTF-8 with its mark: without it.
    let d = await dlRow(page, 0);
    assert.equal(d.name, 'SrTiO3 Müller.cif');
    assert.ok(d.buf.equals(U8), 'the UTF-8 file byte for byte');
    d = await dlRow(page, 1);
    assert.equal(d.name, 'BaTiO3_utf16.cif');
    assert.ok(d.buf.equals(Buffer.from(U16TEXT, 'utf8')), 'the UTF-16 file\'s text in UTF-8');
    assert.ok(!d.buf.equals(U16));
    d = await dlRow(page, 2);
    assert.equal(d.name, 'CaTiO3_bom.cif');
    assert.ok(d.buf.equals(BOM8.subarray(3)), 'the UTF-8 file less its mark');
    // The row not selected by it, the structure on show the same, no step of the history.
    r = await rows(page);
    assert.deepEqual(r.map(x=> x.sel), [true, false, false], 'no row selected by the button');
    assert.equal(await page.textContent(P + 'CellName'), name0);
    assert.deepEqual(await history(page, 'xrd'), h0, 'no step of the history');
    // A click on the row beside it still selects it.
    await page.click(`${P}PhaseList .rv-cif:nth-child(2) .rv-cif-f`);
    assert.deepEqual((await rows(page)).map(x=> x.sel), [false, true, false]);
    // The keyboard: Tab from the row's box to the button, Enter and Space download, Tab
    // goes on to the ×.
    await page.focus(`${P}PhaseList .rv-cif:nth-child(3) input[data-on]`);
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(()=> document.activeElement.getAttribute('aria-label')), 'Download the CIF of CaTiO3', 'Tab reaches it');
    d = await download(page, ()=> page.keyboard.press('Enter'));
    assert.equal(d.name, 'CaTiO3_bom.cif');
    d = await download(page, ()=> page.keyboard.press('Space'));
    assert.ok(d.buf.equals(BOM8.subarray(3)), 'Space too');
    assert.deepEqual((await rows(page)).map(x=> x.sel), [false, true, false], 'the keys select no row either');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(()=> document.activeElement.dataset.del != null), true, 'then the ×');
    assert.deepEqual(await history(page, 'xrd'), h0, 'the keys: no step of the history either');
    // A phase with no file name (a project that has none): under its name.
    await page.evaluate(async ()=>{
      const u = await import('./utils.js'), s = u.getModuleState('xrd');
      s.cards.forEach(c=> ((c.states.rietveld || {}).phases || []).forEach(q=> { q.file = ''; }));
      u.restoreModuleState('xrd', s);
    });
    await settle(page);
    d = await dlRow(page, 1);
    assert.equal(d.name, 'BaTiO3.cif');
    assert.ok(d.buf.equals(Buffer.from(U16TEXT, 'utf8')));
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('B: the standard\'s window: the built-in LaB6\'s CIF, and a CIF added there', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'xrd');
    await loadFiles(page, 'xrd', env.fx.files.xrd.slice(0, 1));
    await page.click(P + 'Std');
    await page.waitForSelector('#xrdStdRv', { state: 'visible' });
    await settle(page);
    const S = '#xrdStdR';
    // (a CIF under a name with no extension, read all the same: downloaded under it as it is)
    await page.setInputFiles(S + 'CifInput', [file('SrTiO3 Müller.cif', U8), file('perovskite', BOM8)]);
    await settle(page);
    const r = await rows(page, S);
    assert.deepEqual(r.map(x=> x.formula), ['LaB₆', 'SrTiO₃', 'CaTiO₃']);
    assert.equal(r[0].label, 'Download the CIF of LaB₆ (NIST SRM 660c)');
    assert.equal(r[0].disabled, false, 'the built-in\'s enabled');
    assert.equal(r[0].delDisabled, true, 'its × not (it cannot be removed)');
    r.forEach((x, i)=> assert.ok(x.next && x.gap >= 0 && x.gap <= 4 && x.dy < 1, `row ${i + 1}: left of the ×`));
    const h0 = await history(page, 'xrd');
    let d = await dlRow(page, 0, S);
    assert.equal(d.name, 'LaB6_NIST-SRM-660c.cif');
    assert.equal(d.buf.toString('utf8'), LAB6, 'the CIF the card refines it with');
    assert.match(d.buf.toString('utf8'), /^data_LaB6_SRM660c\n_cell_length_a 4\.156826\n/);
    d = await dlRow(page, 1, S);
    assert.equal(d.name, 'SrTiO3 Müller.cif');
    assert.ok(d.buf.equals(U8));
    d = await dlRow(page, 2, S);
    assert.equal(d.name, 'perovskite', 'no extension added');
    assert.ok(d.buf.equals(BOM8.subarray(3)));
    assert.equal(await page.isVisible('#xrdStdRv'), true, 'the window stays open');
    assert.deepEqual(await history(page, 'xrd'), h0, 'no step of the history');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('C: while a run goes on, the CIF is downloaded all the same, with no step of the history', async ()=>{
  const { page, errors, close } = await env.page();
  // The worker's script held: the run starts and goes on until it is cancelled.
  let held = null;
  await page.route('**/xrd-rietveld.worker.js', r=>{ held = r; });
  try {
    await openModule(page, 'xrd');
    await loadFiles(page, 'xrd', env.fx.files.xrd.slice(0, 1));
    await page.setInputFiles(P + 'CifInput', [file('SrTiO3 Müller.cif', U8), file('BaTiO3_utf16.cif', U16)]);
    await settle(page);
    await page.click(P + 'Refine');
    await page.waitForSelector('.confirm-modal');
    await page.click('.confirm-modal .btn:not(.primary)');   // Refine without the standard
    await page.waitForFunction(p=> document.querySelector(p + 'Refine').textContent === 'Cancel', P);
    const r = await rows(page);
    assert.deepEqual(r.map(x=> x.disabled), [false, false], 'the downloads enabled');
    const h0 = await history(page, 'xrd');
    let d = await dlRow(page, 0);
    assert.ok(d.buf.equals(U8));
    d = await dlRow(page, 1);
    assert.equal(d.name, 'BaTiO3_utf16.cif');
    assert.ok(d.buf.equals(Buffer.from(U16TEXT, 'utf8')));
    assert.equal(await page.textContent(P + 'Refine'), 'Cancel', 'the run goes on');
    assert.deepEqual(await history(page, 'xrd'), h0, 'no step of the history');
    await page.waitForTimeout(650);
    await page.click(P + 'Refine');   // (Cancel)
    await page.waitForFunction(p=> document.querySelector(p + 'Refine').textContent === 'Refine', P);
    assert.deepEqual(errors, []);
  } finally { if (held) await held.abort().catch(()=>{}); await close(); }
});

test('D: a list under 155 px leaves out the space group: the × stays in the row, the formula has room', async ()=>{
  const { page, errors, close } = await env.page({ viewport: { width: 375, height: 800 } });
  try {
    await openModule(page, 'xrd');
    await loadFiles(page, 'xrd', env.fx.files.xrd.slice(0, 1));
    await page.setInputFiles(P + 'CifInput', [file('SrTiO3 Müller.cif', U8), file('BaTiO3_utf16.cif', U16), file('wide.cif', WIDE)]);
    await settle(page);
    assert.equal(await page.textContent(`${P}PhaseList .rv-cif:nth-child(3) .rv-cif-sg`), 'P4₂/mnm');
    for (const [w, sg] of [[375, false], [360, false], [414, false], [1000, false], [1150, false], [1200, true], [1280, true], [1400, true], [375, false]]){
      await page.setViewportSize({ width: w, height: 800 });
      await settle(page);
      (await rows(page)).forEach((x, i)=>{
        const at = `${w} px, row ${i + 1} (the list ${x.listW} px wide)`;
        assert.equal(x.sg, sg, `${at}: the space group ${sg ? 'shown' : 'left out'}`);
        assert.equal(x.sg, x.listW > 155, at + ': left out under 155 px');
        assert.ok(x.inRow, at + ': the download and the × inside the row');
        assert.equal(x.sideways, false, at + ': the list does not scroll sideways');
        assert.ok(x.next && x.gap >= 0 && x.gap <= 4, at + ': left of the ×');
        if (!sg) assert.ok(x.fw >= 25, `${at}: the formula has room (${Math.round(x.fw)} px)`);
      });
    }
    // Still a button that downloads, on a phone.
    const d = await dlRow(page, 1);
    assert.equal(d.name, 'BaTiO3_utf16.cif');
    assert.ok(d.buf.equals(Buffer.from(U16TEXT, 'utf8')));
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
