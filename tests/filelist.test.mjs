/* The file list (utils.js renderUnifiedFileList), the same in every module (DRS, XRPD, GC,
   EPR, SEM): the grip and the include box 26 px each, then FILE, LABEL and a note with no
   header but GC's (SAMPLE) sharing what is left as 3 : 3 : 2, then the actions 58 px,
   measured in the browser at several widths, a phone's among them (no horizontal scroll,
   the label field inside its cell, laid over the note while typed in on the phone); the
   note right of the label, DRS's how each file's second column was read (%R or F(R), its
   title in full), GC's a select of the sample the file is (its own), the others' empty. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start, openModule, loadFiles, MODS } from './helpers.mjs';
import { ROWS, caryCsv, drsCsv } from './fixtures.mjs';

let env;
before(async ()=>{ env = await start(); });
after(()=> env && env.close());

// Each module's list measured: the cells of every row and of the head, their widths, the
// notes, the box's horizontal scroll and the page's, each label field against its cell.
const measure = (page, mod)=> page.evaluate(mod=>{
  const wrap = document.getElementById(mod + 'FileTableWrap'), box = wrap.querySelector('.table-wrap-box'), table = box.querySelector('table');
  const w = el => el.getBoundingClientRect().width;
  return {
    table: table.clientWidth,
    heads: [...table.querySelectorAll('thead th')].map(t=> t.textContent.trim()),
    headW: [...table.querySelectorAll('thead th')].map(w),
    rows: [...table.querySelectorAll('tr.file-row')].map(r=>{
      const tds = [...r.children], inp = r.querySelector('.file-label'), note = r.querySelector('td.note-cell'), t = note.querySelector('[title]');
      const ir = inp.getBoundingClientRect(), cr = inp.parentElement.getBoundingClientRect();
      // (GC's: its select's value, the sample the file is)
      const sel = note.querySelector('select');
      return { w: tds.map(w), cls: tds.map(t=> t.className), note: sel ? sel.value : note.textContent, title: t && t.title,
        noteRightOfLabel: note.previousElementSibling === inp.parentElement, inCell: ir.left >= cr.left - 0.5 && ir.right <= cr.right + 0.5 };
    }),
    lead: wrap.querySelectorAll('.lead-cell').length,
    boxScroll: box.scrollWidth - box.clientWidth,
    pageScroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
}, mod);

const NOTES = { tauc: ['F(R)', 'F(R)'], gc: ['alpha.csv', 'beta.csv'] };
for (const [vw, vh] of [[1400, 900], [800, 800], [375, 740]]){
  test(`the file list at ${vw} px: FILE, LABEL and the note at 3 : 3 : 2 in every module, the note right of the label`, async ()=>{
    const { page, errors, close } = await env.page({ viewport: { width: vw, height: vh } });
    try {
      for (const mod of MODS){
        await openModule(page, mod);
        await loadFiles(page, mod, env.fx.files[mod]);
        const m = await measure(page, mod), left = m.table - 26 - 26 - 58;
        assert.deepEqual(m.heads, ['', '', 'FILE', 'LABEL', mod === 'gc' ? 'SAMPLE' : '', ''], mod + ': the heads, the note with none but GC\'s');
        assert.equal(m.rows.length, ROWS[mod], mod);
        assert.equal(m.lead, 0, mod + ': no column left of the label');
        const want = [26, 26, left*3/8, left*3/8, left*2/8, 58];
        for (const [k, r] of [['head', { w: m.headW }], ...m.rows.map((r, i)=> ['row ' + i, r])])
          r.w.forEach((x, j)=> assert.ok(Math.abs(x - want[j]) < 0.6, `${mod} ${k}: column ${j} ${x} px for ${want[j].toFixed(2)} (${r.w.join(', ')})`));
        m.rows.forEach((r, i)=>{
          assert.deepEqual(r.cls, ['drag-cell', 'incl-cell', 'fname', '', 'note-cell', 'row-acts'], `${mod} row ${i}`);
          assert.ok(r.noteRightOfLabel, `${mod} row ${i}: the note right of the label`);
          assert.equal(r.note, (NOTES[mod] || [])[i] || '', `${mod} row ${i}: its note`);
          assert.ok(r.inCell, `${mod} row ${i}: the label field inside its cell`);
        });
        assert.equal(m.boxScroll, 0, mod + ': the list does not scroll sideways');
        assert.equal(m.pageScroll, 0, mod + ': nor the page');
      }
      assert.deepEqual(errors, []);
    } finally { await close(); }
  });
}

// DRS: the Cary's %R export beside an F(R) one, each note right of its label with its title
// and shown whole down to 320 px; on a phone the label field typed in is laid over the note,
// to the note's right padding, the note hidden meanwhile (an excluded file's field, dimmed,
// let it show through), and back in its cell after.
for (const vw of [320, 375]){
  test(`DRS at ${vw} px: the note says %R or F(R), whole, its title in full; the label field typed in widens over the note, hidden meanwhile`, async ()=>{
    const { page, errors, close } = await env.page({ viewport: { width: vw, height: 740 } });
    try {
      await openModule(page, 'tauc');
      await loadFiles(page, 'tauc', [{ name: 'cary.csv', mimeType: 'text/csv', buffer: caryCsv().buffer }, { name: 'drs1.csv', mimeType: 'text/csv', buffer: drsCsv({ Eg: 3.2 }) }]);
      const m = await measure(page, 'tauc');
      assert.deepEqual(m.rows.map(r=> [r.note, r.title, r.noteRightOfLabel]), [
        ['%R', 'second column read as the reflectance in %, converted to F(R)', true],
        ['F(R)', 'second column read as F(R)', true]]);
      assert.equal(m.boxScroll, 0, 'the list does not scroll sideways');
      const notes = ()=> page.evaluate(()=> [...document.querySelectorAll('#taucFileTableWrap td.note-cell')].map(n=> ({ cut: n.scrollWidth > n.clientWidth, vis: getComputedStyle(n).visibility })));
      assert.deepEqual(await notes(), [{ cut: false, vis: 'visible' }, { cut: false, vis: 'visible' }], 'each note whole');
      // Typed in, in an included row (the second) and in an excluded one (the first, unticked).
      await page.locator('#taucFileTableWrap .file-incl').first().click();
      await page.waitForFunction(()=> document.querySelector('#taucFileTableWrap tr.file-row').classList.contains('is-excluded'));
      for (const k of [1, 0]){
        const lab = page.locator('#taucFileTableWrap .file-label').nth(k);
        await lab.click();
        const g = await page.evaluate(k=>{
          const r = document.querySelectorAll('#taucFileTableWrap tr.file-row')[k], box = el => el.getBoundingClientRect(), note = r.querySelector('td.note-cell');
          const i = box(r.querySelector('.file-label')), n = box(note), a = box(r.querySelector('td.row-acts'));
          return { i: [i.left, i.right], n: [n.left, n.right], pad: parseFloat(getComputedStyle(note).paddingRight), a: a.left, z: getComputedStyle(r.querySelector('.file-label')).zIndex };
        }, k);
        assert.ok(Math.abs(g.i[1] - (g.n[1] - g.pad)) < 0.6 && g.i[1] < g.a, `row ${k}: the field over the note to its right padding, short of the actions: ${JSON.stringify(g)}`);
        assert.equal(g.z, '1');
        assert.deepEqual((await notes()).map(n=> n.vis), k ? ['visible', 'hidden'] : ['hidden', 'visible'], `row ${k}: its note hidden under the field, the other shown`);
        await lab.fill('label ' + k); await lab.press('Enter');
      }
      await page.locator('#taucFileTableWrap .file-label').first().blur();
      const after = await measure(page, 'tauc');
      assert.ok(after.rows.every(r=> r.inCell), 'back in its cell');
      assert.deepEqual((await notes()).map(n=> n.vis), ['visible', 'visible'], 'the notes back');
      assert.deepEqual(await page.locator('#taucFileTableWrap .file-label').evaluateAll(l=> l.map(i=> i.value)), ['label 0', 'label 1']);
      assert.deepEqual(errors, []);
    } finally { await close(); }
  });
}
