/* EPR's list as GC's (v581): a row a .DTA and its .DSC, the two files under it in FILE, each
   with a grip of its own, always; files dropped paired by their names, with each other or with
   a half waiting in the list; a half alone waiting there (to v580 refused: "drop the two
   together"), not plotted, said to check under the drop zone; a file dragged by its grip onto
   another pairs them whatever their names (onto one paired, they swap), off every file it
   stands alone; each a step and a change, undone; the row's menu's download a pair's two files
   (a zip, as GC's pair rows give) and a half's one; the project saved and opened again with its
   rows as they were. Files named constructor, __proto__ and toString pair and plot as any
   other (bug 23: to v580 grouped in a plain object, such a pair was lost with no word, and
   __proto__'s written onto every object's prototype). A label renamed kept a file, as GC
   keeps it: the row's its first file's, a second's given back when the pair is split, through
   undo and redo and the project saved (v582). Every file made up. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start, openModule, settle, moduleState, history, undo, download, readZip, tabLabels, saveAs, openProject, firstTop } from './helpers.mjs';
import { eprPair } from './fixtures.mjs';

let env;
before(async ()=>{ env = await start(); });
after(()=> env && env.close());

const bin = (name, buffer)=> ({ name, mimeType: 'application/octet-stream', buffer });
const pair = (stem, title, seed = 11)=>{ const e = eprPair({ title, seed }); return [bin(stem + '.DSC', e.dsc), bin(stem + '.DTA', e.dta)]; };
async function drop(page, files, rows){
  await page.setInputFiles('#eprFiles', files);
  await page.waitForFunction(n=> document.querySelectorAll('#eprFileTableWrap tr.file-row').length === n && !document.querySelector('.dz-loading'), rows, { timeout: 20000 });
  await settle(page);
}
const rowsOf = page => page.$$eval('#eprFileTableWrap tr.file-row', trs=> trs.map(tr=> ({
  label: tr.querySelector('.file-label').value, files: [...tr.querySelectorAll('.fname-text')].map(e=> e.textContent),
  grips: tr.querySelectorAll('.fpart-grip').length, warn: [...tr.querySelectorAll('.fpart.is-warn .fname-text')].map(e=> e.textContent) })));
const names = async page => (await rowsOf(page)).map(r=> r.files.join(' + '));
// The lines the first card's plot draws: their labels.
const lines = page => page.evaluate(()=>{ const s = document.querySelector('#tab-epr svg[id$="Svg"]'); return s && s._plot ? s._plot._stored.filter(e=> e.type === 'line').map(e=> e.label) : []; });
const boxes = page => page.$$eval('#eprAlerts .alert', els=> els.map(e=> [e.classList[1], ...e.innerText.split('\n').map(s=> s.trim()).filter(Boolean)]));
const steps = async page => (await history(page, 'epr')).index;
const starred = async page => (await tabLabels(page))[0].endsWith('*');
const part = (page, name)=> page.locator('#eprFileTableWrap .fpart').filter({ has: page.locator('.fname-text', { hasText: new RegExp(`^${name.replace(/[.()]/g, '\\$&')}$`) }) });
async function dragFile(page, name, to){
  const g = await part(page, name).locator('.fpart-grip').boundingBox();
  const b = to ? await part(page, to).boundingBox() : await page.locator('#eprFileTableWrap thead th').nth(3).boundingBox();
  await page.mouse.move(g.x + g.width/2, g.y + g.height/2);
  await page.mouse.down();
  await page.mouse.move(g.x + g.width/2 + 10, g.y + g.height/2 + 6, { steps: 3 });
  await page.mouse.move(b.x + b.width/2, b.y + b.height/2, { steps: 8 });
  await page.mouse.up();
  await settle(page);
}
const ALONE = f => `${f}: its ${/\.DTA$/i.test(f) ? '.DSC' : '.DTA'} is missing: not plotted until it is paired; drop it, or drag one onto it by its own grip.`;

test('bug 23: files named constructor, __proto__ and toString pair, load and plot as any other', async ()=>{
  const { page, errors, csp, close } = await env.page();
  try {
    await openModule(page, 'epr');
    await drop(page, [...pair('constructor', 'C', 11), ...pair('__proto__', 'P', 12), ...pair('toString', 'T', 13)], 3);
    assert.deepEqual(await names(page), ['constructor.DTA + constructor.DSC', '__proto__.DTA + __proto__.DSC', 'toString.DTA + toString.DSC']);
    const st = await moduleState(page, 'epr');
    assert.deepEqual(st.files.map(f=> [f.name, f.label, Array.isArray(f.b) && f.b.length > 1]), [['constructor', 'C', true], ['__proto__', 'P', true], ['toString', 'T', true]]);
    assert.deepEqual(await lines(page), ['C', 'P', 'T'], 'each plotted');
    assert.deepEqual(await boxes(page), [], 'nothing said');
    assert.deepEqual(await page.evaluate(()=> [({}).dsc === undefined, ({}).dta === undefined, Object.getPrototypeOf({}) === Object.prototype]), [true, true, true], 'no object\'s prototype written');
    assert.deepEqual(errors, []); assert.deepEqual(await csp(), []);
  } finally { await close(); }
});

test('a half waits in the list, said, not plotted; paired by its name later or by a file\'s grip whatever its name; swapped, unpaired; each a step, undone', async ()=>{
  const { page, errors, csp, close } = await env.page();
  try {
    await openModule(page, 'epr');
    const b = eprPair({ title: 'B', seed: 12 });
    await drop(page, [...pair('a', 'A'), bin('lone.DTA', b.dta), bin('x.DSC', b.dsc)], 3);
    await saveAs(page, 'halves');
    let rows = await rowsOf(page);
    assert.deepEqual(rows.map(r=> r.files), [['a.DTA', 'a.DSC'], ['lone.DTA'], ['x.DSC']], 'a pair\'s .DTA first; each half a row of its own');
    assert.deepEqual(rows.map(r=> r.grips), [2, 1, 1], 'a grip a file, a half\'s too');
    assert.deepEqual(rows.map(r=> r.warn), [[], ['lone.DTA'], ['x.DSC']], 'the halves marked');
    assert.deepEqual(rows.map(r=> r.label), ['A', 'lone', 'B'], 'a half\'s label its .DSC\'s title, else its name');
    assert.deepEqual(await boxes(page), [['warn', '⚠ Loaded, to check:', ALONE('lone.DTA'), ALONE('x.DSC')]], 'to check, not refused');
    assert.deepEqual(await lines(page), ['A'], 'the halves not plotted');
    const st = await moduleState(page, 'epr');
    assert.deepEqual(st.files.map(f=> [f.name, f.rawFiles.map(x=> x.name), 'b' in f]), [['a', ['a.DTA', 'a.DSC'], true], ['lone.DTA', ['lone.DTA'], false], ['x.DSC', ['x.DSC'], false]]);
    const s0 = await steps(page);
    // The .DSC onto the .DTA alone: paired, their names apart; plotted, nothing said.
    await dragFile(page, 'x.DSC', 'lone.DTA');
    assert.deepEqual(await names(page), ['a.DTA + a.DSC', 'lone.DTA + x.DSC']);
    assert.deepEqual([await lines(page), await boxes(page), await steps(page), await starred(page)], [['A', 'B'], [], s0 + 1, true]);
    // Onto a file paired: the two swap (two .DTA files, two .DSC: neither plotted, said); its own partner: swapped back.
    await dragFile(page, 'lone.DTA', 'a.DTA');
    assert.deepEqual(await names(page), ['lone.DTA + a.DSC', 'a.DTA + x.DSC']);
    assert.deepEqual(await lines(page), ['A', 'B'], 'each still a .DTA and a .DSC: plotted, labelled by its .DSC');
    await dragFile(page, 'x.DSC', 'a.DSC');
    assert.deepEqual(await names(page), ['lone.DTA + x.DSC', 'a.DTA + a.DSC']);
    // Off every file: alone, under its row, said again.
    await dragFile(page, 'a.DSC', null);
    assert.deepEqual(await names(page), ['lone.DTA + x.DSC', 'a.DTA', 'a.DSC']);
    assert.deepEqual(await boxes(page), [['warn', '⚠ Loaded, to check:', ALONE('a.DTA'), ALONE('a.DSC')]]);
    assert.equal((await lines(page)).length, 1);
    assert.equal(await steps(page), s0 + 4);
    // A file dropped later pairs by its name with a half waiting.
    await drop(page, [bin('w.DTA', b.dta)], 4);
    await drop(page, [bin('w.DSC', b.dsc)], 4);
    assert.deepEqual((await names(page)).slice(-1), ['w.DTA + w.DSC']);
    // Undone to the project saved: as it was.
    for (let i = 0; i < 6; i++) await undo(page);
    assert.deepEqual(await names(page), ['a.DTA + a.DSC', 'lone.DTA', 'x.DSC']);
    assert.equal(await starred(page), false, 'back to the saved project');
    await undo(page, true);
    assert.deepEqual(await names(page), ['a.DTA + a.DSC', 'lone.DTA + x.DSC']);
    // The card's right column's first title still on the plot frame's top (CLAUDE.md).
    const t = await firstTop(page, '#tab-epr .an-card', { frame: 'svg.plot', head: '.param-head' });
    assert.ok(Math.abs(t.top - t.frame) <= 1, `Parameters' top on the plot frame's: ${JSON.stringify(t)}`);
    assert.deepEqual(errors, []); assert.deepEqual(await csp(), []);
  } finally { await close(); }
});

test('the row\'s menu: a pair\'s download its two files (a zip, as GC\'s pair rows), a half\'s its one; the project opened again with its rows', async ()=>{
  const { page, errors, csp, close } = await env.page();
  try {
    await openModule(page, 'epr');
    const files = [...pair('a', 'A'), bin('lone.DTA', eprPair({ title: 'L', seed: 14 }).dta)];
    await drop(page, files, 2);
    const viaMenu = async k =>{
      await page.locator('#eprFileTableWrap tr.file-row').nth(k).click({ button: 'right', position: { x: 40, y: 10 } });
      await page.waitForSelector('.row-menu');
      return download(page, ()=> page.click('.row-menu [data-ctl="dl-file"]'));
    };
    const z = await viaMenu(0);
    assert.equal(z.name, 'a.zip');
    const ents = Object.fromEntries(readZip(z.buf).map(e=> [e.name, e.data]));
    assert.deepEqual(Object.keys(ents).sort(), ['a.DSC', 'a.DTA']);
    assert.ok(ents['a.DSC'].equals(files[0].buffer) && ents['a.DTA'].equals(files[1].buffer), 'byte for byte');
    const one = await viaMenu(1);
    assert.deepEqual([one.name, one.buf.equals(files[2].buffer)], ['lone.DTA', true]);
    // Saved, closed and opened again: its rows, the half waiting and said.
    await saveAs(page, 'menu rows');
    await page.locator('#tabBar .ptab.is-on .ptab-x').click(); await settle(page);
    await openProject(page, 'epr', 'menu rows');
    assert.deepEqual(await names(page), ['a.DTA + a.DSC', 'lone.DTA']);
    assert.deepEqual(await boxes(page), [['warn', '⚠ Loaded, to check:', ALONE('lone.DTA')]]);
    assert.deepEqual(await lines(page), ['A']);
    assert.deepEqual(errors, []); assert.deepEqual(await csp(), []);
  } finally { await close(); }
});

/* v582: a label kept a file, as GC keeps one. A half renamed, then paired as a .DTA's second
   by its grip: the row's label its .DTA's; split again, the half its own label back (to v581
   lost, its row labelled anew by its .DSC's title). Through undo and redo, and a project saved
   while it is paired. */
async function relabel(page, i, v){ const l = page.locator(`#eprFileTableWrap .file-label[data-i="${i}"]`); await l.fill(v); await l.press('Enter'); await settle(page); }
test('a label renamed kept a file: a pair split gives its second file its own back (v582)', async ()=>{
  const { page, errors, csp, close } = await env.page();
  try {
    await openModule(page, 'epr');
    const b = eprPair({ title: 'B', seed: 12 });
    await drop(page, [bin('lone.DTA', b.dta), bin('x.DSC', b.dsc)], 2);
    await relabel(page, 1, 'mine');
    assert.deepEqual((await rowsOf(page)).map(r=> r.label), ['lone', 'mine']);
    await dragFile(page, 'x.DSC', 'lone.DTA');
    assert.deepEqual((await rowsOf(page)).map(r=> [r.files.join(' + '), r.label]), [['lone.DTA + x.DSC', 'B']], 'paired: the row\'s label its .DTA\'s');
    await saveAs(page, 'labels');
    await page.locator('#tabBar .ptab.is-on .ptab-x').click(); await settle(page);
    await openProject(page, 'epr', 'labels');
    await dragFile(page, 'x.DSC', null);
    assert.deepEqual((await rowsOf(page)).map(r=> [r.files.join(' + '), r.label]), [['lone.DTA', 'lone'], ['x.DSC', 'mine']], 'split: each its own label back');
    await undo(page);
    assert.deepEqual((await rowsOf(page)).map(r=> r.label), ['B']);
    await undo(page, true);
    assert.deepEqual((await rowsOf(page)).map(r=> r.label), ['lone', 'mine'], 'redone');
    assert.deepEqual(errors, []); assert.deepEqual(await csp(), []);
  } finally { await close(); }
});
