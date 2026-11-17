/* The trace list (utils.js renderUnifiedFileList; the file list to v531), the same in every
   module (DRS, XRPD, GC, EPR, SEM): the grip and the include box 26 px each, then LABEL (the
   colour's swatch and the name's field), FILE and a note with no header but GC's (SAMPLE)
   sharing what is left as 3 : 3 : 2, then the actions 58 px, measured in the browser at
   several widths, a phone's among them (no horizontal scroll, the name's field inside its
   cell, laid over FILE and the note while typed in on the phone); the note right of the
   file, DRS's how each file's second column was read (%R or F(R), its title in full), GC's
   a select of the sample the file is (its own), the others' empty; the name fields where the
   swatch leaves them in every module, SEM's (no colour: its place kept empty) too.
   v532: each row a trace, its FILE the file it comes from: an XRPD file of two scans two
   traces showing the same file, each named after the sample the file names, each one's
   download the file's own bytes, the head's zip the file once; a GC file one trace, a
   sample with both its gases; a project of v531 (a Custom file left out, labels, an order)
   opening as it was.
   v534: the names' column headed LABEL again (TRACE v532–v533), in Custom's list too, its
   series each with its colour's swatch and the palette's button. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { start, openModule, loadFiles, settle, download, readZip, moduleState, MODS } from './helpers.mjs';
import { ROWS, caryCsv, drsCsv, xrdml } from './fixtures.mjs';

let env;
before(async ()=>{ env = await start(); });
after(()=> env && env.close());

// Each module's list measured: the cells of every row and of the head, their widths, the
// notes, the box's horizontal scroll and the page's, each name field against its cell.
const measure = (page, mod)=> page.evaluate(mod=>{
  const wrap = document.getElementById(mod + 'FileTableWrap'), box = wrap.querySelector('.table-wrap-box'), table = box.querySelector('table');
  const w = el => el.getBoundingClientRect().width;
  return {
    table: table.clientWidth,
    heads: [...table.querySelectorAll('thead th')].map(t=> t.textContent.trim()),
    headW: [...table.querySelectorAll('thead th')].map(w),
    rows: [...table.querySelectorAll('tr.file-row')].map(r=>{
      const tds = [...r.children], inp = r.querySelector('.file-label'), note = r.querySelector('td.note-cell'), t = note.querySelector('[title]');
      const ir = inp.getBoundingClientRect(), cr = inp.closest('td').getBoundingClientRect();
      // (GC's: its select's value, the sample the file is)
      const sel = note.querySelector('select');
      const at = el => el.getBoundingClientRect().left - el.closest('td, th').getBoundingClientRect().left;
      return { nameAt: at(inp), w: tds.map(w), cls: tds.map(t=> t.className), note: sel ? sel.value : note.textContent, title: t && t.title,
        label: inp.value, file: r.querySelector('td.fname').textContent,
        order: inp.closest('td').nextElementSibling.matches('td.fname') && note.previousElementSibling.matches('td.fname'),
        inCell: ir.left >= cr.left - 0.5 && ir.right <= cr.right + 0.5 };
    }),
    headAt: (h => h.getBoundingClientRect().left - h.closest('th').getBoundingClientRect().left)([...table.querySelectorAll('.file-head span')].pop()),
    lead: wrap.querySelectorAll('.lead-cell').length,
    boxScroll: box.scrollWidth - box.clientWidth,
    pageScroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
}, mod);

const NOTES = { tauc: ['F(R)', 'F(R)'], gc: ['alpha.csv', 'beta.csv'] };
// Each trace's name and file: named as the file names its sample (EPR's TITL, SEM's), else after it.
const NAMES = {
  tauc: [['drs1', 'drs1.csv'], ['drs2', 'drs2.csv']],
  xrd: [0, 1, 2].map(k=> [`s0${k}`, `s0${k}.xrdml`]),
  gc: [['alpha', 'alpha.csv'], ['beta', 'beta.csv']],
  epr: [['sample one', 'e1'], ['sample two', 'e2']],
  sem: [1, 2, 3].map(k=> [`S${k}`, `img${k}.tif`]),
};
for (const [vw, vh] of [[1400, 900], [800, 800], [375, 740]]){
  test(`the trace list at ${vw} px: LABEL, FILE and the note at 3 : 3 : 2 in every module, the note right of the file`, async ()=>{
    const { page, errors, close } = await env.page({ viewport: { width: vw, height: vh } });
    try {
      let at = null;
      for (const mod of MODS){
        await openModule(page, mod);
        await loadFiles(page, mod, env.fx.files[mod]);
        const m = await measure(page, mod), left = m.table - 26 - 26 - 58;
        assert.deepEqual(m.heads, ['', '', 'LABEL', 'FILE', mod === 'gc' ? 'SAMPLE' : '', ''], mod + ': the heads, the note with none but GC\'s');
        assert.equal(m.rows.length, ROWS[mod], mod);
        assert.equal(m.lead, 0, mod + ': no column left of the trace');
        assert.deepEqual(m.rows.map(r=> [r.label, r.file]), NAMES[mod], mod + ': each trace\'s name and file');
        const want = [26, 26, left*3/8, left*3/8, left*2/8, 58];
        for (const [k, r] of [['head', { w: m.headW }], ...m.rows.map((r, i)=> ['row ' + i, r])])
          r.w.forEach((x, j)=> assert.ok(Math.abs(x - want[j]) < 0.6, `${mod} ${k}: column ${j} ${x} px for ${want[j].toFixed(2)} (${r.w.join(', ')})`));
        m.rows.forEach((r, i)=>{
          assert.deepEqual(r.cls, ['drag-cell', 'incl-cell', 'trace-cell', 'fname', 'note-cell', 'row-acts'], `${mod} row ${i}`);
          assert.ok(r.order, `${mod} row ${i}: the file right of the trace, the note right of the file`);
          assert.equal(r.note, (NOTES[mod] || [])[i] || '', `${mod} row ${i}: its note`);
          assert.ok(r.inCell, `${mod} row ${i}: the name field inside its cell`);
        });
        // (the name fields and LABEL where the swatches leave them: those of the first module)
        at = at || { name: m.rows[0].nameAt, head: m.headAt };
        m.rows.forEach((r, i)=> assert.ok(Math.abs(r.nameAt - at.name) < 0.6, `${mod} row ${i}: its field at ${r.nameAt} px in its cell, for ${at.name}`));
        assert.ok(Math.abs(m.headAt - at.head) < 0.6, `${mod}: LABEL at ${m.headAt} px, for ${at.head}`);
        assert.equal(m.boxScroll, 0, mod + ': the list does not scroll sideways');
        assert.equal(m.pageScroll, 0, mod + ': nor the page');
      }
      assert.deepEqual(errors, []);
    } finally { await close(); }
  });
}

// DRS: the Cary's %R export beside an F(R) one, each note right of its file with its title
// and shown whole down to 320 px; on a phone the name field typed in is laid over FILE and
// the note, to the note's right padding, both hidden meanwhile (an excluded trace's field,
// dimmed, let them show through), and back in its cell after.
for (const vw of [320, 375]){
  test(`DRS at ${vw} px: the note says %R or F(R), whole, its title in full; the name field typed in widens over FILE and the note, hidden meanwhile`, async ()=>{
    const { page, errors, close } = await env.page({ viewport: { width: vw, height: 740 } });
    try {
      await openModule(page, 'tauc');
      await loadFiles(page, 'tauc', [{ name: 'cary.csv', mimeType: 'text/csv', buffer: caryCsv().buffer }, { name: 'drs1.csv', mimeType: 'text/csv', buffer: drsCsv({ Eg: 3.2 }) }]);
      const m = await measure(page, 'tauc');
      assert.deepEqual(m.rows.map(r=> [r.label, r.file, r.note, r.title, r.order]), [
        ['S1', 'cary.csv', '%R', 'second column read as the reflectance in %, converted to F(R)', true],
        ['drs1', 'drs1.csv', 'F(R)', 'second column read as F(R)', true]]);
      assert.equal(m.boxScroll, 0, 'the list does not scroll sideways');
      const cells = ()=> page.evaluate(()=> [...document.querySelectorAll('#taucFileTableWrap tr.file-row')].map(r=>{
        const n = r.querySelector('td.note-cell'), f = r.querySelector('td.fname');
        return { cut: n.scrollWidth > n.clientWidth, vis: getComputedStyle(n).visibility, file: getComputedStyle(f).visibility };
      }));
      assert.deepEqual((await cells()).map(c=> [c.cut, c.vis, c.file]), [[false, 'visible', 'visible'], [false, 'visible', 'visible']], 'each note whole');
      // Typed in, in an included row (the second) and in an excluded one (the first, unticked).
      await page.locator('#taucFileTableWrap .file-incl').first().click();
      await page.waitForFunction(()=> document.querySelector('#taucFileTableWrap tr.file-row').classList.contains('is-excluded'));
      for (const k of [1, 0]){
        const lab = page.locator('#taucFileTableWrap .file-label').nth(k);
        await lab.click();
        const g = await page.evaluate(k=>{
          const r = document.querySelectorAll('#taucFileTableWrap tr.file-row')[k], box = el => el.getBoundingClientRect(), note = r.querySelector('td.note-cell');
          const i = box(r.querySelector('.file-label')), n = box(note), a = box(r.querySelector('td.row-acts')), sw = box(r.querySelector('.color-swatch'));
          return { i: [i.left, i.right], n: [n.left, n.right], sw: sw.right, pad: parseFloat(getComputedStyle(note).paddingRight), a: a.left, z: getComputedStyle(r.querySelector('.file-label')).zIndex };
        }, k);
        assert.ok(Math.abs(g.i[1] - (g.n[1] - g.pad)) < 0.6 && g.i[1] < g.a, `row ${k}: the field over FILE and the note to its right padding, short of the actions: ${JSON.stringify(g)}`);
        assert.ok(g.i[0] > g.sw, `row ${k}: the field right of its swatch`);
        assert.equal(g.z, '1');
        const c = await cells();
        assert.deepEqual(c.map(x=> [x.vis, x.file]), k ? [['visible', 'visible'], ['hidden', 'hidden']] : [['hidden', 'hidden'], ['visible', 'visible']], `row ${k}: its file and note hidden under the field, the other's shown`);
        await lab.fill('label ' + k); await lab.press('Enter');
      }
      await page.locator('#taucFileTableWrap .file-label').first().blur();
      const after = await measure(page, 'tauc');
      assert.ok(after.rows.every(r=> r.inCell), 'back in its cell');
      assert.deepEqual((await cells()).map(c=> [c.vis, c.file]), [['visible', 'visible'], ['visible', 'visible']], 'the file and the note back');
      assert.deepEqual(after.rows.map(r=> [r.label, r.file]), [['label 0', 'cary.csv'], ['label 1', 'drs1.csv']], 'renamed: the trace, not its file');
      assert.deepEqual(errors, []);
    } finally { await close(); }
  });
}

// An XRDML naming its sample, with two scans: one file, two traces.
const twoScans = name =>{
  const s = xrdml(0).toString('utf8').replace(/(<xrdMeasurements[^>]*>)/, `$1\n <sample type="To be analyzed"><id>X1</id><name>${name}</name></sample>`);
  const a = s.indexOf('  <scan '), b = s.indexOf('</scan>') + 7;
  return s.slice(0, b) + '\n' + s.slice(a, b).replace('appendNumber="0"', 'appendNumber="1"') + s.slice(b);
};
const rows = (page, mod)=> page.$$eval(`#${mod}FileTableWrap tr.file-row`, rs=> rs.map(r=> [r.querySelector('.file-label').value, r.querySelector('td.fname').textContent, r.querySelector('.file-incl').checked]));

test('one file, several traces: an XRPD file of two scans is two traces of that file, each its own, each downloading the file\'s bytes; the head\'s zip has it once', async ()=>{
  const { page, errors, close } = await env.page();
  const multi = env.fx.put('multi.xrdml', twoScans('Sample X'));
  try {
    await openModule(page, 'xrd');
    await loadFiles(page, 'xrd', [env.fx.files.xrd[0], multi], 3);
    assert.deepEqual(await rows(page, 'xrd'), [['s00', 's00.xrdml', true], ['Sample X (scan 1)', 'multi.xrdml', true], ['Sample X (scan 2)', 'multi.xrdml', true]],
      'each scan a trace named after the file\'s sample, both showing the file');
    // Each one's download: the file as it came, under its own name.
    for (const k of [1, 2]){
      const d = await download(page, ()=> page.locator('#xrdFileTableWrap .dl-file').nth(k).click());
      assert.equal(d.name, 'multi.xrdml');
      assert.ok(d.buf.equals(fs.readFileSync(multi)), 'scan ' + k + ': the file\'s bytes');
    }
    // Every file once in the zip of all.
    const z = await download(page, ()=> page.click('#xrdFileTableWrap .download-all'));
    assert.deepEqual(readZip(z.buf).map(e=> [e.name, e.data.equals(fs.readFileSync(path.join(env.fx.dir, e.name)))]), [['s00.xrdml', true], ['multi.xrdml', true]]);
    // Independent: one renamed and left out, the other as it was, in the analysis.
    const lab = page.locator('#xrdFileTableWrap .file-label').nth(1);
    await lab.fill('first scan'); await lab.press('Enter'); await settle(page);
    await page.locator('#xrdFileTableWrap .file-incl').nth(1).click(); await settle(page);
    assert.deepEqual(await rows(page, 'xrd'), [['s00', 's00.xrdml', true], ['first scan', 'multi.xrdml', false], ['Sample X (scan 2)', 'multi.xrdml', true]]);
    const shared = await page.evaluate(async ()=>{ const u = await import('./utils.js'); const f = u.getModuleState('xrd').files; return f[1].rawBytes === f[2].rawBytes; });
    assert.ok(shared, 'the two traces share the file\'s bytes, kept once');
    // Removed, one trace goes; the other stays with its file.
    await page.locator('#xrdFileTableWrap .row-del').nth(1).click(); await settle(page);
    assert.deepEqual(await rows(page, 'xrd'), [['s00', 's00.xrdml', true], ['Sample X (scan 2)', 'multi.xrdml', true]]);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('GC: a trace a sample, with both its gases', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'gc');
    await loadFiles(page, 'gc', env.fx.files.gc.slice(0, 1));
    assert.deepEqual(await rows(page, 'gc'), [['alpha', 'alpha.csv', true]], 'one trace, not one a gas');
    const st = await moduleState(page, 'gc', true);
    assert.equal(st.files.length, 1);
    assert.deepEqual(Object.keys(st.files[0].gas).sort(), ['h2', 'o2'], 'its gases, both');
    assert.ok(st.files[0].gas.h2.length > 0 && st.files[0].gas.o2.length > 0);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

// A project saved by v531: its labels (a Cary's the file's, as then), a file left out and its
// order kept; Custom's file left out, its series each a trace left out.
test('a project of v531 opens as it was: labels, inclusion, order; Custom\'s file left out, its series left out', async ()=>{
  const { page, errors, close } = await env.page();
  const enc = mod => page.evaluate(async mod=>{ const u = await import('./utils.js'), db = await import('./db.js'); return db.encode(u.getModuleState(mod)); }, mod);
  const put = (mod, st)=> page.evaluate(async ([mod, st])=>{ const u = await import('./utils.js'), db = await import('./db.js'); u.restoreModuleState(mod, db.decode(st)); for (let i = 0; i < 2; i++) await new Promise(r=> requestAnimationFrame(r)); }, [mod, st]);
  try {
    await openModule(page, 'tauc');
    await loadFiles(page, 'tauc', [{ name: 'cary.csv', mimeType: 'text/csv', buffer: caryCsv().buffer }, ...env.fx.files.tauc.map(p=> ({ name: path.basename(p), mimeType: 'text/csv', buffer: fs.readFileSync(p) }))]);
    const st = await enc('tauc');
    // (as v531 kept it: the Cary's label its file's, the second left out, the third first)
    st.files[0].label = 'cary';
    const [c, d1, d2] = st.files;
    st.files = [{ ...d2, label: 'second' }, c, { ...d1, included: false, held: {} }];
    await put('tauc', st);
    assert.deepEqual(await rows(page, 'tauc'), [['second', 'drs2.csv', true], ['cary', 'cary.csv', true], ['drs1', 'drs1.csv', false]]);
    assert.deepEqual(await page.locator('#tab-tauc .an-card [id$="Idx"]').first().textContent(), '1/2', 'the two included analysed');

    // Custom: a.csv (3 series), b.csv left out by v531 (its 2 series), as v531 saved them.
    const a = 'Time (s),Signal (mV),err,Ref [mV]\n1,2,3,4\n2,3,4,5\n3,4,5,6\n', b = '1;2;3\n2;3;4\n';
    await openModule(page, 'fig');
    await loadFiles(page, 'fig', [{ name: 'a.csv', mimeType: 'text/csv', buffer: Buffer.from(a) }, { name: 'b.csv', mimeType: 'text/csv', buffer: Buffer.from(b) }], 5);
    const fs0 = await enc('fig');
    fs0.files[1] = { ...fs0.files[1], included: false, held: {} };
    fs0.files[0] = { ...fs0.files[0], names: { 1: 'Mine' } };
    await put('fig', fs0);
    assert.deepEqual(await rows(page, 'fig'), [['Mine', 'a.csv', true], ['err', 'a.csv', true], ['Ref', 'a.csv', true], ['Series 1', 'b.csv', false], ['Series 2', 'b.csv', false]]);
    assert.deepEqual(await page.$$eval('#figFileTableWrap thead th', ts=> ts.map(t=> t.textContent.trim())), ['', '', 'LABEL', 'FILE', '', ''], 'Custom: LABEL');
    assert.deepEqual([await page.locator('#figFileTableWrap button.color-swatch').count(), await page.locator('#figFileTableWrap button.palette-pick-btn').count()], [5, 1], 'Custom: a colour a series, the palette');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
