/* The Rietveld card's dealings with the instrumental standard.
   A: Refine and Refine all with no refined standard ask in a window at the centre of the
   screen (utils.js confirmModal), not a banner: its primary focused, Tab kept inside,
   Escape, × and a click beside it answering neither, the focus back on the button that
   asked; "Load a standard…" opens the standard's window, "Refine without the standard"
   refines the pattern alone, "Refine the standard first" the standard and then it.
   B: the standard's Settings hold only what applies to it, nothing disabled for good;
   the samples' keep every row.
   C: while the standard refines, its window closed, every Rietveld card's "Instrumental
   standard…" says so (a card added meanwhile, after Home and back, a project opened and
   the question to stop it dismissed, an undo refused), and stops saying so when the run
   ends or is stopped. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start, openModule, loadFiles, moduleState, until, settle, answer } from './helpers.mjs';

let env;
before(async ()=>{ env = await start(); });
after(()=> env && env.close());

const P = '#xrdR2';   // the default deck's second card, a Rietveld one
const modal = page => page.evaluate(()=>{
  const m = document.querySelector('.confirm-modal');
  if (!m) return null;
  const b = m.querySelector('.modal-box'), r = b.getBoundingClientRect(), a = document.activeElement;
  return { role: b.getAttribute('role'), modal: b.getAttribute('aria-modal'), text: m.querySelector('.confirm-msg').textContent,
    buttons: [...m.querySelectorAll('button')].map(x=> x.textContent || x.getAttribute('aria-label')),
    focus: a && b.contains(a) ? (a.textContent || a.getAttribute('aria-label')) : null,
    dx: Math.abs(r.x + r.width/2 - document.documentElement.clientWidth/2), dy: Math.abs(r.y + r.height/2 - innerHeight/2) };
});
const gone = page => page.waitForFunction(()=> !document.querySelector('.confirm-modal'));
const focusId = page => page.evaluate(()=> document.activeElement && document.activeElement.id);
const banners = page => page.locator('.pwa-confirm').count();
const label = (page, id = 'Refine')=> page.textContent(P + id);
const card = async (page, id = 2)=> ((await moduleState(page, 'xrd')).cards.find(c=> c.id === id) || {}).states?.rietveld || {};
// (a press within 600 ms of the last is not taken: a double click)
const press = async (page, sel)=>{ await page.waitForTimeout(650); await page.click(sel); await page.waitForSelector('.confirm-modal'); };
const idle = (page, sel, timeout = 120000)=> page.waitForFunction(s=> document.querySelector(s).textContent === 'Refine', sel, { timeout });
// The settings modal on show (each card has its own, the hidden ones in the page too).
const shownBox = page => page.waitForFunction(()=> [...document.querySelectorAll('.rvs-box')].some(b=> b.closest('.modal-backdrop').style.display === 'flex' && b.querySelector('[data-row]')));

async function setup(page){
  await openModule(page, 'xrd');
  await loadFiles(page, 'xrd', env.fx.files.xrd.slice(0, 2));
  await page.setInputFiles(P + 'CifInput', env.fx.cif);
  await page.waitForSelector(P + 'PhaseList input[data-on]');
}
// The standard's file, given in its window (opened from the card), the window closed after.
async function loadStd(page){
  await page.click(P + 'Std');
  await page.waitForSelector('#xrdStdRv', { state: 'visible' });
  await page.setInputFiles('#xrdStdRvFiles', env.fx.std);
  await page.waitForFunction(()=> /s11/.test(document.querySelector('#xrdStdRv .xrd-std-file').textContent));
  await page.keyboard.press('Escape');
  await page.waitForSelector('#xrdStdRv', { state: 'hidden' });
  await settle(page);
}

test('A: the question about the standard is a centred modal: its three answers, Escape, ×, focus', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await setup(page);
    // No standard loaded: asked, in a window, the primary focused.
    await page.click(P + 'Refine');
    await page.waitForSelector('.confirm-modal');
    let m = await modal(page);
    assert.equal(m.role, 'alertdialog'); assert.equal(m.modal, 'true');
    assert.match(m.text, /No instrumental standard is loaded/);
    assert.deepEqual(m.buttons, ['Cancel', 'Refine without the standard', 'Load a standard…']);
    assert.equal(m.focus, 'Load a standard…');
    assert.ok(m.dx < 20 && m.dy < 20, `centred (off by ${m.dx}, ${m.dy} px)`);
    assert.equal(await banners(page), 0, 'no banner');
    // Tab goes round its buttons only.
    for (let i = 0; i < 4; i++){ await page.keyboard.press(i % 2 ? 'Shift+Tab' : 'Tab'); assert.ok((await modal(page)).focus, 'the focus kept in the window'); }
    // Escape: neither, the focus back on Refine.
    await page.keyboard.press('Escape');
    await gone(page);
    assert.equal(await label(page), 'Refine');
    assert.equal(await focusId(page), 'xrdR2Refine');
    // ×, from Refine all: neither, the focus back on Refine all.
    await press(page, P + 'RefineAll');
    await page.click('.confirm-modal .confirm-x');
    await gone(page);
    assert.equal(await focusId(page), 'xrdR2RefineAll');
    // A click beside the box: neither.
    await press(page, P + 'Refine');
    await page.mouse.click(8, 450);
    await gone(page);
    assert.equal(await label(page), 'Refine');
    assert.deepEqual(Object.keys((await card(page)).results || {}), [], 'nothing refined');
    // "Load a standard…" (Enter on the primary): the standard's window.
    await press(page, P + 'Refine');
    await page.keyboard.press('Enter');
    await page.waitForSelector('#xrdStdRv', { state: 'visible' });
    await page.setInputFiles('#xrdStdRvFiles', env.fx.std);
    await page.waitForFunction(()=> /s11/.test(document.querySelector('#xrdStdRv .xrd-std-file').textContent));
    await page.keyboard.press('Escape');
    await page.waitForSelector('#xrdStdRv', { state: 'hidden' });
    // Loaded, not refined: "Refine without the standard" refines the pattern alone.
    await press(page, P + 'Refine');
    m = await modal(page);
    assert.match(m.text, /The instrumental standard is not refined/);
    assert.deepEqual(m.buttons, ['Cancel', 'Refine without the standard', 'Refine the standard first']);
    assert.equal(m.focus, 'Refine the standard first');
    await page.click('.confirm-modal .btn:not(.primary)');
    await gone(page);
    assert.equal(await focusId(page), 'xrdR2Refine');
    await idle(page, P + 'Refine');
    await settle(page);
    let st = await moduleState(page, 'xrd');
    assert.deepEqual(Object.keys((await card(page)).results), ['s00.xrdml']);
    assert.deepEqual(Object.keys(st.stdRv.results || {}), [], 'the standard not refined');
    // "Refine the standard first": the standard, then the pattern on show.
    await page.click(P + 'Next');
    await press(page, P + 'Refine');
    await page.click('.confirm-modal .btn.primary');
    await gone(page);
    await until(async ()=> Object.keys((await moduleState(page, 'xrd')).stdRv.results || {}).length, { timeout: 120000, what: 'the standard refined' });
    await idle(page, P + 'Refine');
    await settle(page);
    st = await moduleState(page, 'xrd');
    assert.deepEqual(Object.keys(st.stdRv.results), ['s11.xrdml']);
    assert.deepEqual(Object.keys((await card(page)).results).sort(), ['s00.xrdml', 's01.xrdml']);
    assert.ok((await card(page)).results['s01.xrdml'].irf, 'refined with the standard\'s profile');
    // Refined: no question.
    await page.waitForTimeout(650);
    await page.click(P + 'Refine');
    await page.waitForTimeout(300);
    assert.equal(await modal(page), null);
    await page.click(P + 'Refine');   // (Cancel)
    await idle(page, P + 'Refine');
    assert.equal(await banners(page), 0);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('B: the standard\'s Settings show only what applies to it; the samples\' every row', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await setup(page);
    await loadStd(page);
    const box = sel => page.evaluate(sel=>{
      const b = [...document.querySelectorAll('.rvs-box')].find(x=> x.closest('.modal-backdrop').style.display === 'flex');
      const keys = a => [...b.querySelectorAll(`[${a}]`)].map(e=> e.getAttribute(a));
      return { rows: keys('data-row'), holds: keys('data-hold'), fits: keys('data-fit-row'), na: b.querySelectorAll('.is-na').length,
        disabled: [...b.querySelectorAll('input, select, button')].filter(c=> c.disabled).map(c=> c.dataset.on || c.dataset.depth || c.dataset.hold || c.dataset.fit || c.dataset.fitAuto || c.dataset.start || c.textContent) };
    }, sel);
    await page.click(P + 'Std');
    await page.waitForSelector('#xrdStdRv', { state: 'visible' });
    await page.click('#xrdStdRSettings');
    await shownBox(page);
    let s = await box();
    assert.deepEqual(s.rows, ['adp', 'po'], 'the standard\'s rows');
    assert.deepEqual(s.holds, ['linear', 'cell', 'instrument', 'adp', 'texture'], 'the groups it can hold');
    assert.deepEqual(s.fits, ['maxIter', 'shiftTol', 'lambda', 'bgDegree', 'bgInv', 'zeroRange'], 'its Refinement settings');
    assert.equal(s.na, 0);
    // What is disabled now is so only until chosen: the texture's depth, the holds (the start
    // the CIF), the 1/2θ term's value (automatic) and Defaults (nothing changed).
    assert.deepEqual(s.disabled.sort(), ['Defaults', 'adp', 'bgInv', 'cell', 'instrument', 'linear', 'po', 'texture'].sort());
    await page.check('.modal-backdrop[style*="flex"] .rvs-box [data-on="po"]');
    await page.click('.modal-backdrop[style*="flex"] .rvs-box [data-start="last"]');
    await page.uncheck('.modal-backdrop[style*="flex"] .rvs-box [data-fit-auto="bgInv"]');
    await settle(page);
    s = await box();
    assert.deepEqual(s.disabled, [], 'nothing disabled once chosen');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await page.waitForSelector('#xrdStdRv', { state: 'hidden' });
    // The samples' Settings: every row, every group, the cell search and the shape's.
    await page.click(P + 'Settings');
    await shownBox(page);
    s = await box();
    assert.deepEqual(s.rows, ['size', 'wppm', 'strain', 'faults', 'adp', 'occ', 'po']);
    assert.deepEqual(s.holds, ['linear', 'cell', 'instrument', 'sizestrain', 'shape', 'faults', 'adp', 'occ', 'texture']);
    assert.deepEqual(s.fits, ['maxIter', 'shiftTol', 'lambda', 'bgDegree', 'bgInv', 'cellRange', 'shapeStarts', 'shapeFull']);
    await page.keyboard.press('Escape');
    // The standard's settings kept whole (the rows not shown off, the groups kept).
    const st = (await moduleState(page, 'xrd')).stdRv;
    assert.deepEqual(st.std.on, { size: false, wppm: false, strain: false, faults: false, adp: true, occ: false, po: true });
    assert.deepEqual(st.hold, ['cell', 'instrument', 'sizestrain', 'shape', 'faults', 'adp', 'occ', 'texture']);
    // Defaults: on a sample's as before, enabled by any key kept (the zero scan's, which it
    // does not show, too); on the standard's, by a key it shows only (the shape's kept so).
    const defaults = async (w, fit)=>{
      await page.evaluate(async ([w, fit])=>{
        const u = await import('./utils.js'), s = structuredClone(u.getModuleState('xrd'));
        if (w === 'std') s.stdRv.fit = fit; else s.cards.find(c=> c.id === 2).states.rietveld.fit = fit;
        u.restoreModuleState('xrd', s); u.redrawAll();
      }, [w, fit]);
      await settle(page);
      if (w === 'std'){ await page.click(P + 'Std'); await page.waitForSelector('#xrdStdRv', { state: 'visible' }); await page.click('#xrdStdRSettings'); }
      else await page.click(P + 'Settings');
      await shownBox(page);
      const def = '.modal-backdrop[style*="flex"] [data-fit-def]', dis = await page.$eval(def, b=> b.disabled);
      if (!dis) await page.click(def);
      await page.keyboard.press('Escape');
      if (w === 'std'){ await page.keyboard.press('Escape'); await page.waitForSelector('#xrdStdRv', { state: 'hidden' }); }
      const s = await moduleState(page, 'xrd');
      return [dis, w === 'std' ? s.stdRv.fit : (s.cards.find(c=> c.id === 2).states.rietveld.fit || {})];
    };
    assert.deepEqual(await defaults('sample', { zeroRange: 2 }), [false, {}]);
    assert.deepEqual(await defaults('std', { shapeStarts: 20 }), [true, { shapeStarts: 20 }]);
    assert.deepEqual(await defaults('std', { zeroRange: 2 }), [false, {}]);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('C: the standard refining, its window closed: every card\'s Instrumental standard… says so until it ends', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await setup(page);
    await loadStd(page);
    // The worker's answers held until released: a run as long as the test needs.
    await page.evaluate(()=>{
      const W = window.Worker; window.__held = [];
      window.Worker = class extends W {
        addEventListener(t, fn, o){
          if (t !== 'message') return super.addEventListener(t, fn, o);
          const g = e=>{ if (window.__hold && e.data && e.data.type === 'result') window.__held.push(()=> fn(e)); else fn(e); };
          (this.__m || (this.__m = new Map())).set(fn, g);
          return super.addEventListener(t, g, o);
        }
        removeEventListener(t, fn, o){ return super.removeEventListener(t, (t === 'message' && this.__m && this.__m.get(fn)) || fn, o); }
      };
      window.__hold = true;
      window.__release = ()=>{ window.__hold = false; window.__held.splice(0).forEach(f=> f()); };
    });
    const btn = id => page.evaluate(id=>{ const b = document.getElementById(id);
      return { run: b.classList.contains('rv-std-run'), busy: b.getAttribute('aria-busy'), name: b.getAttribute('aria-label'), title: b.title }; }, id);
    const idleTitle = (await btn('xrdR2Std')).title;
    const busyNow = async (id, what)=>{ const b = await btn(id);
      assert.ok(b.run, what + ': the spinner'); assert.equal(b.busy, 'true', what + ': aria-busy');
      assert.match(b.name, /^Instrumental standard… \(refining/, what + ': its name'); assert.match(b.title, /being refined/, what + ': its title'); };
    const idleNow = async (id, what)=>{ assert.deepEqual(await btn(id), { run: false, busy: null, name: null, title: idleTitle }, what); };
    await idleNow('xrdR2Std', 'before');
    // Refined from its window, the window closed.
    await page.click(P + 'Std');
    await page.waitForSelector('#xrdStdRv', { state: 'visible' });
    await page.click('#xrdStdRRefine');
    await page.keyboard.press('Escape');
    await page.waitForSelector('#xrdStdRv', { state: 'hidden' });
    await busyNow('xrdR2Std', 'running');
    await until(()=> page.evaluate(()=> window.__held.length), { timeout: 60000, what: 'the worker\'s answer' });
    await busyNow('xrdR2Std', 'its answer held');
    assert.match((await btn('xrdR2Std')).name, /\d+ %\)$/, 'its progress');
    // A card added meanwhile.
    await page.click('#xrdAddAn');
    await page.click('.an-menu [data-kind="rietveld"]');
    await page.waitForSelector('#xrdR3Std');
    await busyNow('xrdR3Std', 'a card added');
    // Home and back.
    await page.click('#nav button[data-tab="home"]');
    await page.locator('#tabBar .ptab').first().locator('.ptab-label').click();
    await page.waitForSelector('#tab-xrd.active');
    await settle(page);
    await busyNow('xrdR2Std', 'Home and back');
    // Another project opened: leaving asks; dismissed, it opens beside, the run goes on here.
    await page.click('#nav button[data-tab="home"]');
    await page.click('.home-card[data-go="tauc"]');
    await answer(page, 'x');
    await page.locator('#tabBar .ptab').first().locator('.ptab-label').click();
    await page.waitForSelector('#tab-xrd.active');
    await settle(page);
    assert.equal(await page.locator('#tabBar .ptab').count(), 2);
    await busyNow('xrdR2Std', 'the question to leave dismissed');
    // An undo waits for the run: still running.
    await page.evaluate(()=> document.activeElement && document.activeElement.blur());
    await page.keyboard.press('Control+z');
    await page.waitForSelector('.pwa-confirm.show');
    assert.match(await page.textContent('.pwa-confirm span'), /undo and redo wait/);
    await page.keyboard.press('Escape');
    await busyNow('xrdR2Std', 'an undo refused');
    // The window opened again shows the run.
    await page.click(P + 'Std');
    await page.waitForSelector('#xrdStdRv', { state: 'visible' });
    assert.equal(await page.textContent('#xrdStdRRefine'), 'Cancel');
    assert.ok(await page.isVisible('#xrdStdRProgWrap'));
    await page.keyboard.press('Escape');
    await page.waitForSelector('#xrdStdRv', { state: 'hidden' });
    // The run ends: every card's button as before.
    await page.evaluate(()=> window.__release());
    await idle(page, '#xrdStdRRefine');
    await settle(page);
    await idleNow('xrdR2Std', 'ended'); await idleNow('xrdR3Std', 'ended, the card added');
    assert.deepEqual(Object.keys((await moduleState(page, 'xrd')).stdRv.results), ['s11.xrdml']);
    // Another run, stopped from its window: as before at once.
    await page.evaluate(()=>{ window.__hold = true; });
    await page.click(P + 'Std');
    await page.waitForSelector('#xrdStdRv', { state: 'visible' });
    await page.waitForTimeout(650);   // (a press within 600 ms of Cancel turning back to Refine is not taken)
    await page.click('#xrdStdRRefine');
    await busyNow('xrdR2Std', 'a second run');
    await page.waitForTimeout(650);
    await page.click('#xrdStdRRefine');   // (Cancel)
    await idle(page, '#xrdStdRRefine');
    await idleNow('xrdR2Std', 'stopped');
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(async ()=> (await import('./utils.js')).moduleBusy('xrd')), null);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
