/* The analysis cards and the XRPD Scherrer card:
   - + Add peak left as its card is folded by the arrow, clicked or by Enter (the button
     off, the guide gone, no peak placed), not by a move's folds; and as the standard's
     window closes (4b);
   - the baseline's box undone and redone, step by step, the box and the state together, in
     both all / one modes and in the standard's window; a select undone with the focus on it;
     Ctrl+Z with the focus still on the box just ticked (5b: the key is the history's on a
     box, utils.js);
   - a card an undo or a redo brings back (closed by its ×, or added) brought into view, in
     every module with cards (XRPD, DRS, GC, EPR); not on a tab switch nor a project opened
     (N1). */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start, openModule, loadFiles, settle, moduleState, history, undo, switchTab } from './helpers.mjs';

let env;
before(async ()=>{ env = await start(); });
after(()=> env && env.close());

// The add-peak mode of a Scherrer panel (prefix p): its button, its guide, the plot's
// readout (held off while a peak is placed).
const addMode = (page, p)=> page.evaluate(p=>{
  const svg = document.getElementById(p + 'Svg');
  return { on: document.getElementById(p + 'AddPeak').classList.contains('is-on'), guide: svg.querySelectorAll('.add-guide').length, readout: !svg._suppressReadout };
}, p);
const OFF = { on: false, guide: 0, readout: true };
async function arm(page, p){
  await page.click('#' + p + 'AddPeak');
  const b = await page.locator('#' + p + 'Svg').boundingBox();
  await page.mouse.move(b.x + b.width*0.5, b.y + b.height*0.5);
  await page.mouse.move(b.x + b.width*0.55, b.y + b.height*0.5);
  const m = await addMode(page, p);
  assert.ok(m.on && m.guide > 0 && !m.readout, 'armed, its guide drawn: ' + JSON.stringify(m));
}
const card = (mod, id)=> `#tab-${mod} .an-card[data-an="${id}"]`;
// Fold or unfold a card by its arrow, the animation over.
async function foldBtn(page, mod, id){ await page.click(card(mod, id) + ' .an-fold'); await page.waitForTimeout(450); await settle(page); }

test('4b: + Add peak is left as its card folds, and as the standard\'s window closes', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'xrd');
    await loadFiles(page, 'xrd', env.fx.files.xrd);
    await arm(page, 'xrdA1');
    await foldBtn(page, 'xrd', 1);
    assert.deepEqual(await addMode(page, 'xrdA1'), OFF, 'folded: the mode left');
    await foldBtn(page, 'xrd', 1);
    assert.deepEqual(await addMode(page, 'xrdA1'), OFF, 'unfolded again: still off');
    // A move folds every card for a while: no fold of the user's, the mode stays.
    await arm(page, 'xrdA1');
    const g = await page.locator(card('xrd', 1) + ' .an-grip').boundingBox();
    await page.mouse.move(g.x + g.width/2, g.y + g.height/2);
    await page.mouse.down(); await page.waitForTimeout(150); await page.mouse.up();
    await page.waitForTimeout(500); await settle(page);
    assert.equal((await addMode(page, 'xrdA1')).on, true, 'a move leaves it on');
    await page.click('#xrdA1AddPeak');
    assert.deepEqual(await addMode(page, 'xrdA1'), OFF, 'its button again: off');
    // By the keyboard: the guide moved by → (the mode's), Shift+Tab to the arrow, Enter folds
    // it and places no peak (to v499 Enter placed one there and the card stayed open).
    await arm(page, 'xrdA1');
    await page.keyboard.press('ArrowRight'); await settle(page);
    const h1 = await history(page, 'xrd');
    for (let i = 0; i < 40 && !(await page.evaluate(()=> document.activeElement.classList.contains('an-fold'))); i++) await page.keyboard.press('Shift+Tab');
    assert.equal(await page.evaluate(()=> document.activeElement.closest('.an-card').dataset.an), '1', 'on the card\'s arrow');
    assert.equal((await addMode(page, 'xrdA1')).on, true, 'Tab leaves it on');
    await page.keyboard.press('Enter'); await page.waitForTimeout(450); await settle(page);
    assert.equal(await page.isVisible(card('xrd', 1) + '.is-folded'), true, 'folded by Enter');
    assert.deepEqual(await addMode(page, 'xrdA1'), OFF, 'folded by Enter: the mode left');
    assert.deepEqual((await moduleState(page, 'xrd')).cards[0].states.scherrer.manualPeaks[0], [], 'no peak placed');
    assert.equal((await history(page, 'xrd')).index, h1.index + 1, 'one step, the fold\'s');
    await page.keyboard.press('Enter'); await page.waitForTimeout(450); await settle(page);
    assert.equal(await page.isVisible(card('xrd', 1) + '.is-folded'), false, 'unfolded by Enter');
    // A button clicked while armed (an all / one chip) does not keep Enter once → moved the
    // guide: Enter places the peak.
    await page.evaluate(()=> document.activeElement.blur());
    await arm(page, 'xrdA1');
    await page.click('#xrdA1ModeBl'); await settle(page);
    await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter'); await settle(page);
    assert.deepEqual(await addMode(page, 'xrdA1'), OFF, 'placed: the mode left');
    assert.equal((await moduleState(page, 'xrd')).cards[0].states.scherrer.manualPeaks[0].length, 1, 'Enter placed the peak');
    // The standard's window: closed by its × or a click beside it, the mode is left.
    await page.click('#xrdA1Std');
    await page.setInputFiles('#xrdStdPeaksFiles', env.fx.std);
    await page.waitForSelector('#xrdStdPeaks .xrd-std-name');
    await settle(page);
    await arm(page, 'xrdStdA');
    await page.click('#xrdStdPeaks .xrd-std-x'); await settle(page);
    assert.deepEqual(await addMode(page, 'xrdStdA'), OFF, 'window closed by ×: the mode left');
    await page.click('#xrdA1Std'); await settle(page);
    assert.deepEqual(await addMode(page, 'xrdStdA'), OFF, 'opened again: off');
    await arm(page, 'xrdStdA');
    await page.mouse.click(8, 450); await settle(page);
    assert.equal(await page.isVisible('#xrdStdPeaks'), false, 'closed by a click beside it');
    assert.deepEqual(await addMode(page, 'xrdStdA'), OFF, 'window closed by a click beside it: the mode left');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

// The box on show and the state's, of the card's shared values (or the sample's own).
const blState = async (page, p = 'xrdA1')=>{
  const s = await moduleState(page, 'xrd');
  const sc = p === 'xrdStdA' ? s.stdPeaks : s.cards[0].states.scherrer;
  const own = sc.paramMode && sc.paramMode.blWin === 'per';
  return { box: await page.isChecked('#' + p + 'BlOn'), win: await page.isDisabled('#' + p + 'BlWin'), state: own ? sc.perParams[s.curIdx].blOn : sc.shared.blOn };
};
const on = { box: true, win: false, state: true }, off = { box: false, win: true, state: false };
// The live state is the one the history holds at its index: an undo re-committed nothing.
const inStep = page => page.evaluate(async ()=>{
  const u = await import('./utils.js'), h = u.getModuleHistory('xrd');
  return u.moduleStateKey('xrd') === u.stateKey(h.states[h.index]);
});

test('5b: the baseline box undone and redone, step by step, in all / one and in the standard\'s window', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'xrd');
    await loadFiles(page, 'xrd', env.fx.files.xrd);
    const h0 = await history(page, 'xrd');
    assert.deepEqual(await blState(page), on);
    await page.click('#xrdA1BlOn'); await settle(page);
    assert.deepEqual(await blState(page), off);
    assert.equal((await history(page, 'xrd')).index, h0.index + 1, 'one step');
    for (const [redo, want, idx] of [[false, on, 0], [true, off, 1], [false, on, 0], [true, off, 1]]){
      await undo(page, redo);
      assert.deepEqual(await blState(page), want, (redo ? 'redo' : 'undo') + ' → ' + JSON.stringify(want));
      assert.equal((await history(page, 'xrd')).index, h0.index + idx);
      assert.ok(await inStep(page), 'the live state is the step\'s');
    }
    // Another edit after an undo drops the redo; undone, the box as it was before it.
    await undo(page);
    await page.fill('#xrdA1PkHeight', '7'); await page.press('#xrdA1PkHeight', 'Enter'); await settle(page);
    assert.equal((await history(page, 'xrd')).n, h0.index + 2);
    await undo(page, true);
    assert.equal((await history(page, 'xrd')).index, h0.index + 1, 'nothing to redo');
    await page.click('#xrdA1BlOn'); await settle(page);
    assert.deepEqual(await blState(page), off);
    await undo(page);
    assert.deepEqual(await blState(page), on);
    assert.equal(await page.inputValue('#xrdA1PkHeight'), '7');
    await undo(page);
    assert.equal(await page.inputValue('#xrdA1PkHeight'), '5');
    assert.deepEqual(await blState(page), on);
    // One per sample: the sample's own box.
    await page.click('#xrdA1ModeBl'); await settle(page);
    await page.click('#xrdA1BlOn'); await settle(page);
    assert.deepEqual(await blState(page), off);
    await undo(page);
    assert.deepEqual(await blState(page), on);
    await undo(page, true);
    assert.deepEqual(await blState(page), off);
    assert.ok(await inStep(page));
    // A select keeps the focus as a box does: undone with the focus on it.
    await page.focus('#xrdA1Norm');
    await page.selectOption('#xrdA1Norm', 'local'); await settle(page);
    assert.equal(await page.evaluate(()=> document.activeElement.id), 'xrdA1Norm');
    await page.keyboard.press('Control+z'); await settle(page);
    assert.equal(await page.inputValue('#xrdA1Norm'), 'global', 'the select undone with the focus on it');
    // The standard's window, its own box.
    await page.click('#xrdA1Std');
    await page.setInputFiles('#xrdStdPeaksFiles', env.fx.std);
    await page.waitForSelector('#xrdStdPeaks .xrd-std-name'); await settle(page);
    assert.deepEqual(await blState(page, 'xrdStdA'), on);
    await page.click('#xrdStdABlOn'); await settle(page);
    assert.deepEqual(await blState(page, 'xrdStdA'), off);
    await undo(page);
    assert.deepEqual(await blState(page, 'xrdStdA'), on);
    await undo(page, true);
    assert.deepEqual(await blState(page, 'xrdStdA'), off);
    assert.ok(await inStep(page));
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

// Clicked, a box keeps the focus. A box has no undo of its own, so Ctrl+Z is the history's
// (up to v499 utils.js left it to any INPUT with the focus, and nothing happened).
test('5b: Ctrl+Z at once, the focus still on the box just clicked', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'xrd');
    await loadFiles(page, 'xrd', env.fx.files.xrd);
    await page.click('#xrdA1BlOn'); await settle(page);
    assert.equal(await page.evaluate(()=> document.activeElement.id), 'xrdA1BlOn');
    await page.keyboard.press('Control+z'); await settle(page);
    assert.deepEqual(await blState(page), on, 'undone with the focus on the box');
    await page.keyboard.press('Control+y'); await settle(page);
    assert.deepEqual(await blState(page), off, 'redone with the focus on the box');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

/* ---- N1: a card brought back by an undo or a redo, into view ---- */
// The page at rest: no smooth scroll going on.
async function still(page){
  let y = -1, n = 0;
  for (let i = 0; i < 100 && n < 4; i++){ const v = await page.evaluate(()=> scrollY); n = v === y ? n + 1 : 0; y = v; await page.waitForTimeout(50); }
  await settle(page);
  return y;
}
// Whether a card's head is whole on screen, under the sticky bar (null: no such card).
const headInView = (page, mod, id)=> page.evaluate(sel=>{
  const c = document.querySelector(sel);
  if (!c) return null;
  const h = c.querySelector('.an-head').getBoundingClientRect(), top = document.getElementById('topbar').getBoundingClientRect().bottom;
  return h.top >= top && h.bottom <= innerHeight;
}, card(mod, id));
const ids = (page, mod)=> page.$$eval(`#tab-${mod} .an-card`, cs=> cs.map(c=> +c.dataset.an));
const toBottom = async page =>{ await page.evaluate(()=> window.scrollTo(0, document.documentElement.scrollHeight)); return still(page); };
// Ctrl+Z / Ctrl+Y, no field focused.
async function key(page, redo){ await page.evaluate(()=> document.activeElement && document.activeElement.blur && document.activeElement.blur()); await page.keyboard.press(redo ? 'Control+y' : 'Control+z'); return still(page); }
async function close1(page, mod, id){
  await page.locator(card(mod, id) + ' .an-close').scrollIntoViewIfNeeded();
  await page.click(card(mod, id) + ' .an-close'); await settle(page);
}

test('N1: a card an undo or a redo brings back comes into view (XRPD, DRS, GC, EPR)', async ()=>{
  // (a window short enough for EPR's page, two spectra, to scroll the cards out of view)
  const { page, errors, close } = await env.page({ viewport: { width: 1400, height: 640 } });
  try {
    for (const mod of ['xrd', 'tauc', 'gc', 'epr']){
      await openModule(page, mod);
      await loadFiles(page, mod, env.fx.files[mod]);
      // A second card, added by "+" (the first kind of the menu, where there is one).
      await page.click(`#${mod}AddAn`);
      if (await page.locator('.an-menu:not([hidden]) [data-kind]').count()) await page.locator('.an-menu:not([hidden]) [data-kind]').first().click();
      await page.waitForTimeout(500); await settle(page);
      const list = await ids(page, mod), first = list[0], last = list[list.length - 1];
      // The first card closed, the page scrolled to its end, away from where the card was.
      await close1(page, mod, first);
      await toBottom(page);
      assert.equal(await page.evaluate(m=> document.getElementById(m + 'Analyses').getBoundingClientRect().top < 0, mod), true, mod + ': the cards out of view, above');
      await key(page);
      assert.equal(await headInView(page, mod, first), true, mod + ': the card closed, back by an undo, is in view');
      // Redo closes it again; undo brings it back again, in view (it is already).
      await key(page, true);
      assert.equal(await headInView(page, mod, first), null, mod + ': closed again by the redo');
      await key(page);
      assert.equal(await headInView(page, mod, first), true);
      // The card added: undone (gone), the page at its top, redone: back, and in view.
      await key(page);
      assert.equal(await headInView(page, mod, last), null, mod + ': the card added, undone');
      await page.evaluate(()=> window.scrollTo(0, 0)); await still(page);
      assert.equal(await page.evaluate(m=> document.getElementById(m + 'AddBar').getBoundingClientRect().top > innerHeight, mod), true, mod + ': the end of the cards out of view, below');
      await key(page, true);
      assert.equal(await headInView(page, mod, last), true, mod + ': the card added, redone, is in view');
    }
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('N1: a tab switched to, or a project opened, that has a card more brings nothing into view', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    // Tab 1 with both cards; tab 2 with the first closed (an undo and a redo of it first:
    // the history's keys are behind it), the page at its end.
    await openModule(page, 'xrd');
    await loadFiles(page, 'xrd', env.fx.files.xrd);
    // (kept in the page as a project holds it: db.js encode)
    await page.evaluate(async ()=>{ const u = await import('./utils.js'), db = await import('./db.js'); window.__both = db.encode(u.getModuleState('xrd')); });
    await openModule(page, 'xrd');
    await loadFiles(page, 'xrd', env.fx.files.xrd);
    await close1(page, 'xrd', 1);
    await key(page); await key(page, true);
    assert.deepEqual(await ids(page, 'xrd'), [2]);
    let y0 = await toBottom(page);
    await switchTab(page, 0);
    const y1 = await still(page);
    assert.deepEqual(await ids(page, 'xrd'), [1, 2]);
    assert.equal(await headInView(page, 'xrd', 1), false, 'tab switch: the card not brought into view');
    // (the page kept where it was, or lower: the card put in above the window pushes it)
    assert.ok(y1 >= y0, `tab switch: not scrolled up to the card (${y0} → ${y1})`);
    // A project opened (the restore a tab makes of it) in tab 2: nothing scrolled either.
    await switchTab(page, 1);
    assert.deepEqual(await ids(page, 'xrd'), [2]);
    y0 = await toBottom(page);
    await page.evaluate(async ()=>{ const u = await import('./utils.js'), db = await import('./db.js'); u.restoreModuleState('xrd', db.decode(window.__both)); });
    const y2 = await still(page);
    assert.deepEqual(await ids(page, 'xrd'), [1, 2]);
    assert.equal(await headInView(page, 'xrd', 1), false, 'project opened: the card not brought into view');
    assert.ok(y2 >= y0, `project opened: not scrolled up to the card (${y0} → ${y2})`);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
