/* The Rietveld card's Phases and Structure boxes.
   A: the Structure box is empty (no 3D view laid out nor painted, no details, its note)
   wherever there is no phase to show — a card with none, a new project, a tab switched
   to, the phase removed, an undo past its CIF, a card added — and shows the right phase
   otherwise (another project's CIF, the standard's LaB6 in its window). Up to v498 the
   3D view kept the cell drawn last: its hidden attribute lost to its class's display.
   B: with no phase, a drop zone in the list's place takes CIFs (a click, Enter, Space: the
   file picker; files dropped, several at once); from the first, + CIF, a zone of one line
   at the box's foot, does, and CIFs dropped anywhere on the box are taken, the box lit
   while they are dragged over it; a file that is no CIF is said and left out; an undo
   takes a drop's CIFs back at once; the standard's window, which has its LaB6, shows +
   CIF and takes a drop.
   C: while a run goes on the zones are disabled and a drop on the box is refused. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { start, openModule, loadFiles, settle, undo, switchTab, moduleState } from './helpers.mjs';

let env;
before(async ()=>{ env = await start(); });
after(()=> env && env.close());

const P = '#xrdR2';   // the default deck's second card, a Rietveld one
// Another structure than the fixture's SrTiO3: cubic BaTiO3, a = 4.00 Å.
const BTO = fs.readFileSync(new URL('./fixtures/SrTiO3.cif', import.meta.url), 'utf8').replace(/SrTiO3/g, 'BaTiO3').replace(/Sr/g, 'Ba').replace(/3\.905/g, '4.00');

// What the Structure box shows: its canvas laid out and painted, the name by its title,
// the details.
const structure = (page, pre = P)=> page.evaluate(pre=>{
  const c = document.querySelector(pre + 'Cell canvas');
  let painted = 0;
  if (c && c.width) { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for (let i = 3; i < d.length; i += 4) if (d[i]) painted++; }
  return { shown: !!c && c.getBoundingClientRect().width > 0, painted, name: document.querySelector(pre + 'CellName').textContent,
    info: document.querySelector(pre + 'CellInfo').textContent };
}, pre);
const empty = (s, what)=>{
  assert.equal(s.shown, false, what + ': no 3D view laid out');
  assert.equal(s.painted, 0, what + ': nothing painted');
  assert.equal(s.name, '', what + ': no name');
  assert.match(s.info, /^No phase yet/, what + ': its note');
};
const showing = (s, name, what)=>{
  assert.ok(s.shown && s.painted > 500, what + ': the cell drawn');
  assert.equal(s.name, name, what);
  assert.ok(s.info.startsWith(name + 'Formula'), what + ': its details');
};
// The Phases box: which of the list, the zone and + CIF are on show, the phases listed.
const phases = (page, pre = P)=> page.evaluate(pre=>{
  const on = id => { const e = document.querySelector(pre + id); return !!e && !e.hidden && e.getBoundingClientRect().height > 0; };
  return { list: on('PhaseList'), zone: on('CifDz'), mini: on('AddCif'), n: document.querySelectorAll(pre + 'PhaseList .rv-cif').length,
    names: [...document.querySelectorAll(pre + 'PhaseList .rv-cif-f')].map(e=> e.textContent), lit: document.querySelector(pre + 'Cifs').classList.contains('dragover'),
    status: document.querySelector(pre + 'Status').textContent };
}, pre);
// Files dragged over an element and dropped there ({ name, text } each), as a drag from
// the desktop does; or only dragged over it (drop false), or dragged over and away (leave).
// Says whether the page took the dragover (its default prevented: else the browser opens
// the file) and whether the box was lit then. (Its drop effect is not read: a DataTransfer
// made by a script keeps 'none'.)
const drag = (page, sel, files, { drop = true, leave = false, kind = 'files' } = {})=> page.evaluate(([sel, files, drop, leave, kind])=>{
  const el = document.querySelector(sel), dt = new DataTransfer();
  if (kind === 'files') files.forEach(f=> dt.items.add(new File([f.text + 'x'.repeat(f.pad || 0)], f.name)));
  else dt.setData('text/plain', 'some text');
  const ev = t => { const e = new DragEvent(t, { dataTransfer: dt, bubbles: true, cancelable: true }); el.dispatchEvent(e); return e; };
  ev('dragenter');
  const over = ev('dragover');
  const lit = el.closest('.rv-cifs').classList.contains('dragover');
  if (leave) ev('dragleave');
  else if (drop) ev('drop');
  return { taken: over.defaultPrevented, lit };
}, [sel, files, drop, leave, kind]);
const cif = (name, text, pad = 0)=> ({ name, text, pad });
const SRT = fs.readFileSync(new URL('./fixtures/SrTiO3.cif', import.meta.url), 'utf8');
/* The file pickers the page opens, each answered with the files a pick gives it. One
   listener for the whole test: Playwright intercepts a picker only while one is there,
   and one taken off and put back between two picks let the second open unseen. */
function pickers(page){
  const waiting = [];
  let opened = 0;
  page.on('filechooser', fc=>{ opened++; const ok = waiting.shift(); if (ok) ok(fc); });
  return {
    // A click (or a key) opens one; files chosen in it.
    async pick(act, files){
      const got = new Promise((ok, no)=>{ waiting.push(ok); setTimeout(()=> no(new Error('no file picker opened')), 5000); });
      await act();
      const fc = await got;
      assert.equal(fc.isMultiple(), true, 'several CIFs at once');
      await fc.setFiles(files);
      await settle(page);
    },
    async none(act){
      const n = opened;
      await act();
      await page.waitForTimeout(800);
      assert.equal(opened, n, 'no file picker');
    },
  };
}

test('A: the Structure box is empty where there is no phase, and the right phase otherwise', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'xrd');
    await loadFiles(page, 'xrd', env.fx.files.xrd.slice(0, 1));
    empty(await structure(page), 'a card with no phase');
    await page.setInputFiles(P + 'CifInput', env.fx.cif);
    await settle(page);
    showing(await structure(page), 'SrTiO3', 'its CIF added');
    // A new project: the card is the same one, restored with no phase.
    await openModule(page, 'xrd');
    empty(await structure(page), 'a new project');
    await loadFiles(page, 'xrd', env.fx.files.xrd.slice(0, 1));
    empty(await structure(page), 'a new project with a file');
    await switchTab(page, 0);
    showing(await structure(page), 'SrTiO3', 'back on the first project');
    await switchTab(page, 1);
    empty(await structure(page), 'the new project again');
    // Another CIF there: its own structure, each project its own.
    await page.setInputFiles(P + 'CifInput', env.fx.put('BaTiO3.cif', BTO));
    await settle(page);
    showing(await structure(page), 'BaTiO3', 'the second project\'s CIF');
    await switchTab(page, 0);
    showing(await structure(page), 'SrTiO3', 'the first project\'s, after the second\'s');
    // The phase removed, the removal undone, an undo past the CIF, a redo.
    await page.click(P + 'PhaseList [data-del]');
    await settle(page);
    empty(await structure(page), 'the phase removed');
    await undo(page);
    showing(await structure(page), 'SrTiO3', 'the removal undone');
    await undo(page);
    empty(await structure(page), 'an undo past the CIF');
    await undo(page, true);
    showing(await structure(page), 'SrTiO3', 'redone');
    // A card added: none.
    await page.click('#xrdAddAn');
    await page.click('.an-menu [data-kind="rietveld"]');
    await settle(page);
    const pre = await page.evaluate(()=> '#' + [...document.querySelectorAll('#xrdAnalyses [id$="PhaseList"]')].pop().id.replace('PhaseList', ''));
    assert.notEqual(pre, P);
    empty(await structure(page, pre), 'a card added');
    // The standard's window: its LaB6; the samples' card as it was.
    await page.click(P + 'Std');
    await page.waitForSelector('#xrdStdRv', { state: 'visible' });
    await settle(page);
    showing(await structure(page, '#xrdStdR'), 'LaB₆ (NIST SRM 660c)', 'the standard\'s window');
    await page.keyboard.press('Escape');
    await page.waitForSelector('#xrdStdRv', { state: 'hidden' });
    await switchTab(page, 1);
    showing(await structure(page), 'BaTiO3', 'the second project, after the standard\'s window');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('B: the drop zone with no phase, + CIF from the first, CIFs dropped on the box', async ()=>{
  const { page, errors, close } = await env.page();
  const fp = pickers(page);
  try {
    await openModule(page, 'xrd');
    await loadFiles(page, 'xrd', env.fx.files.xrd.slice(0, 1));
    let ph = await phases(page);
    assert.deepEqual([ph.list, ph.zone, ph.mini, ph.n], [false, true, false, 0], 'no phase: the zone alone');
    const z = await page.evaluate(p=>{ const e = document.querySelector(p + 'CifDz'); return { role: e.getAttribute('role'), tab: e.tabIndex, cls: e.className, text: e.textContent.replace(/\s+/g, ' ').trim() }; }, P);
    assert.equal(z.role, 'button'); assert.equal(z.tab, 0);
    assert.match(z.cls, /\bdropzone\b/, 'the app\'s drop zone');
    assert.equal(z.text, '⤒ Drag here CIF files, or click to select them. .cif');
    // A click on it: the picker; the CIF in, the zone gone, + CIF at the box's foot.
    await fp.pick(()=> page.click(P + 'CifDz'), env.fx.cif);
    ph = await phases(page);
    assert.deepEqual([ph.list, ph.zone, ph.mini, ph.n], [true, false, true, 1], 'one phase: the list and + CIF');
    const box = await page.evaluate(p=>{ const b = document.querySelector(p + 'Cifs').getBoundingClientRect(), m = document.querySelector(p + 'AddCif').getBoundingClientRect();
      return { foot: b.bottom - m.bottom, h: m.height, text: document.querySelector(p + 'AddCif').textContent }; }, P);
    assert.ok(box.foot >= 0 && box.foot < 16, `+ CIF at the box's foot (${box.foot} px above it)`);
    assert.ok(box.h < 40, `+ CIF one line (${box.h} px)`);
    assert.equal(box.text, '+ CIF: drop or click');
    // + CIF by a click, by Enter and by Space.
    await fp.pick(()=> page.click(P + 'AddCif'), env.fx.put('BaTiO3.cif', BTO));
    assert.equal((await phases(page)).n, 2);
    await page.focus(P + 'AddCif');
    await fp.pick(()=> page.keyboard.press('Enter'), env.fx.cif);
    await page.focus(P + 'AddCif');
    await fp.pick(()=> page.keyboard.press('Space'), env.fx.cif);
    assert.equal((await phases(page)).n, 4);
    // Removed one by one: the zone back.
    for (let i = 0; i < 4; i++){ await page.click(P + 'PhaseList [data-del]'); await settle(page); }
    ph = await phases(page);
    assert.deepEqual([ph.list, ph.zone, ph.mini, ph.n], [false, true, false, 0], 'none again: the zone');
    // Enter on the zone: the picker.
    await page.focus(P + 'CifDz');
    await fp.pick(()=> page.keyboard.press('Enter'), env.fx.cif);
    assert.equal((await phases(page)).n, 1);
    assert.equal(await page.evaluate(()=> document.activeElement.id), 'xrdR2AddCif', 'the focus on + CIF once the zone goes');
    await undo(page);
    assert.equal((await phases(page)).n, 0);
    // Two CIFs dropped on the zone at once: lit while over it, both in, one undo step.
    let d = await drag(page, P + 'CifDz', [cif('SrTiO3.cif', SRT), cif('BaTiO3.cif', BTO)]);
    assert.equal(d.taken, true); assert.equal(d.lit, true, 'the box lit');
    await settle(page);
    ph = await phases(page);
    assert.deepEqual(ph.names, ['SrTiO₃', 'BaTiO₃']);
    assert.equal(ph.lit, false, 'not lit once dropped');
    assert.deepEqual([ph.zone, ph.mini], [false, true]);
    await undo(page);
    assert.equal((await phases(page)).n, 0, 'one undo takes the drop back');
    await undo(page, true);
    // Dropped on the list, on + CIF, on the box's head: taken alike.
    for (const sel of [P + 'PhaseList', P + 'AddCif', P + 'Cifs .peak-box-head']){
      d = await drag(page, sel, [cif('SrTiO3.cif', SRT)]);
      assert.equal(d.lit, true, sel + ': the box lit');
      await settle(page);
    }
    assert.equal((await phases(page)).n, 5);
    // Dragged over and away: not lit after. Text dragged: not taken, not lit.
    d = await drag(page, P + 'PhaseList', [cif('SrTiO3.cif', SRT)], { leave: true });
    assert.equal((await phases(page)).lit, false, 'not lit once the drag left');
    d = await drag(page, P + 'PhaseList', [], { kind: 'text' });
    assert.deepEqual([d.taken, d.lit], [false, false], 'text dragged: not taken');
    // Files that are no CIF: said, left out (one larger than any CIF, not named so, not read);
    // a CIF beside them taken.
    d = await drag(page, P + 'AddCif', [cif('s00.xrdml', fs.readFileSync(env.fx.files.xrd[0], 'utf8')), cif('BaTiO3.cif', BTO), cif('big.tif', '', 5e6)]);
    await settle(page);
    ph = await phases(page);
    assert.equal(ph.n, 6);
    assert.equal(ph.status, '⚠ s00.xrdml: Not a CIF: no data_ block found. · big.tif: not a CIF file (.cif).');
    // The notes that named + CIF: the Settings' and the results'.
    for (let i = 0; i < 6; i++){ await page.click(P + 'PhaseList [data-del]'); await settle(page); }
    assert.match(await page.textContent(P + 'Results'), /No phase: add one from a CIF, dropped on Phases beside the pattern or selected with a click there\./);
    // The standard's window: its LaB6 and + CIF; a CIF dropped on its box, its own.
    await page.click(P + 'Std');
    await page.waitForSelector('#xrdStdRv', { state: 'visible' });
    await settle(page);
    ph = await phases(page, '#xrdStdR');
    assert.deepEqual([ph.list, ph.zone, ph.mini, ph.n], [true, false, true, 1], 'the standard: LaB6 and + CIF');
    await drag(page, '#xrdStdRPhaseList', [cif('SrTiO3.cif', SRT)]);
    await settle(page);
    assert.deepEqual((await phases(page, '#xrdStdR')).names, ['LaB₆', 'SrTiO₃']);
    assert.equal((await moduleState(page, 'xrd')).stdRv.phases.length, 1, 'the standard\'s own');
    await page.keyboard.press('Escape');
    assert.equal((await phases(page)).n, 0, 'the samples\' card none');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('C: while a run goes on, the zones are disabled and a drop is refused', async ()=>{
  const { page, errors, close } = await env.page();
  const fp = pickers(page);
  // The worker's script held: the run starts and goes on until it is cancelled.
  let held = null;
  await page.route('**/xrd-rietveld.worker.js', r=>{ held = r; });
  try {
    await openModule(page, 'xrd');
    await loadFiles(page, 'xrd', env.fx.files.xrd.slice(0, 1));
    await page.setInputFiles(P + 'CifInput', env.fx.cif);
    await settle(page);
    const dis = ()=> page.evaluate(p=> [p + 'CifDz', p + 'AddCif'].map(s=> document.querySelector(s).getAttribute('aria-disabled')), P);
    assert.deepEqual(await dis(), ['false', 'false']);
    await page.click(P + 'Refine');
    await page.waitForSelector('.confirm-modal');
    await page.click('.confirm-modal .btn:not(.primary)');   // Refine without the standard
    await page.waitForFunction(p=> document.querySelector(p + 'Refine').textContent === 'Cancel', P);
    assert.deepEqual(await dis(), ['true', 'true'], 'disabled while it runs');
    await fp.none(()=> page.click(P + 'AddCif', { force: true }));
    await page.focus(P + 'AddCif');
    await fp.none(()=> page.keyboard.press('Enter'));
    const d = await drag(page, P + 'PhaseList', [cif('BaTiO3.cif', BTO)]);
    assert.deepEqual([d.taken, d.lit], [true, false], 'a drop refused, unlit (taken by the page: the browser opens no file)');
    await settle(page);
    assert.equal((await phases(page)).n, 1, 'nothing added');
    await page.waitForTimeout(650);
    await page.click(P + 'Refine');   // (Cancel)
    await page.waitForFunction(p=> document.querySelector(p + 'Refine').textContent === 'Refine', P);
    assert.deepEqual(await dis(), ['false', 'false'], 'enabled once it ends');
    await fp.pick(()=> page.click(P + 'AddCif'), env.fx.put('BaTiO3.cif', BTO));
    assert.equal((await phases(page)).n, 2);
    assert.deepEqual(errors, []);
  } finally { if (held) await held.abort().catch(()=>{}); await close(); }
});
