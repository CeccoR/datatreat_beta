/* The Rietveld card's Phases list while a run goes on: a row's × and tick locked (to v505
   they kept their look until the list was next drawn, which a run did only once the pattern
   on show was refined: never in a run of one pattern, the standard's, or Refine all with a
   later pattern on show; a click on them was refused unsaid).
   A: a sample's card refining (its worker held: the run goes on until stopped): every
   row's × disabled and tick aria-disabled at once as the run starts (by the end of the task
   that turns Refine into Cancel), titled why, the pointer 'not-allowed' over them, the ×
   with no hover colour and as dim hovered as not; a ticked phase's tick still in the accent
   and unlike an unticked one's, dark and light; the download enabled; a click on the × or
   the tick, or Space on the tick, changes nothing, a click on the row still shows its
   structure; + CIF's zone 'not-allowed' over it and its sign; at 375 px the same. Stopped,
   all as before at once. Another card, which does not refine, unaffected.
   B: a run that fails (the worker answers an error) and one that ends: unlocked at once.
   C: the standard's window while the standard refines: its choices and its CIF's × locked,
   the choice made still in the accent and unlike the other, dark and light, an arrow key or
   Space changing nothing; the built-in LaB6's × disabled as before (its own title, the
   arrow); the samples' card unaffected. While a sample refines, the standard's window as before: unlocked. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { start, openModule, loadFiles, settle, history } from './helpers.mjs';

let env;
before(async ()=>{ env = await start(); });
after(()=> env && env.close());

const P = '#xrdR2', S = '#xrdStdR';   // the default deck's Rietveld card; the standard's window
const SRT = fs.readFileSync(new URL('./fixtures/SrTiO3.cif', import.meta.url), 'utf8');
const BTO = SRT.replace(/SrTiO3/g, 'BaTiO3').replace(/Sr/g, 'Ba').replace(/3\.905/g, '4.00');
const cif = (name, text)=> ({ name, mimeType: 'chemical/x-cif', buffer: Buffer.from(text, 'utf8') });
const LOCKED = { del: 'A refinement is running: the phase stays until it ends', on: 'A refinement is running: the tick stays as it is until it ends',
  pick: 'A refinement is running: the phase chosen stays until it ends' };
const IDLE = { del: 'Remove phase', on: 'Refined on this pattern (each pattern its own)', pick: 'The phase the standard is refined with' };
const BUILT = 'Built in: it cannot be removed';

// Every row's ×, tick (or the standard's choice) and download: disabled, aria-disabled,
// locked, titled.
const rows = (page, pre = P)=> page.evaluate(pre=> [...document.querySelectorAll(pre + 'PhaseList .rv-cif')].map(r=>{
  const c = e => e && { dis: e.disabled, aria: e.getAttribute('aria-disabled'), lock: e.classList.contains('is-locked'), title: e.title, built: e.hasAttribute('data-built') };
  return { x: c(r.querySelector('[data-del]')), tick: c(r.querySelector('[data-on], [data-pick]')), dl: c(r.querySelector('[data-dl]')),
    checked: r.querySelector('[data-on], [data-pick]').checked };
}), pre);
const kindOf = pre => pre === S ? 'pick' : 'on';
function locked(r, pre, what){
  r.forEach((x, i)=>{
    const at = `${what}, row ${i + 1}`;
    if (x.x.built) assert.deepEqual(x.x, { dis: true, aria: null, lock: false, title: BUILT, built: true }, at + ': the built-in LaB6\'s × as before');
    else assert.deepEqual(x.x, { dis: true, aria: null, lock: true, title: LOCKED.del, built: false }, at + ': the × locked');
    // (the tick aria-disabled, not disabled: the browser's disabled look draws ticked and not alike)
    assert.deepEqual(x.tick, { dis: false, aria: 'true', lock: true, title: LOCKED[kindOf(pre)], built: false }, at + ': the tick locked');
    assert.deepEqual(x.dl, { dis: false, aria: null, lock: false, title: 'Download the CIF', built: false }, at + ': the download enabled');
  });
}
function unlocked(r, pre, what){
  r.forEach((x, i)=>{
    const at = `${what}, row ${i + 1}`;
    if (x.x.built) assert.deepEqual(x.x, { dis: true, aria: null, lock: false, title: BUILT, built: true }, at + ': the built-in LaB6\'s × as before');
    else assert.deepEqual(x.x, { dis: false, aria: null, lock: false, title: IDLE.del, built: false }, at + ': the × enabled');
    assert.deepEqual(x.tick, { dis: false, aria: null, lock: false, title: IDLE[kindOf(pre)], built: false }, at + ': the tick enabled');
    assert.equal(x.dl.dis, false, at + ': the download enabled');
  });
}
/* The rows as they are each time the card's Refine changes its label, read by the end of
   the task that changed it (a MutationObserver's records come before any timer or frame):
   locked at once means locked by then. */
const watch = (page, pre = P)=> page.evaluate(pre=>{
  const b = document.querySelector(pre + 'Refine'), seen = window.__seen = [];
  new MutationObserver(()=> seen.push({ label: b.textContent, rows: [...document.querySelectorAll(pre + 'PhaseList [data-del]:not([data-built]), ' + pre + 'PhaseList [data-on], ' + pre + 'PhaseList [data-pick]')]
    .map(c=>{ const off = c.matches('input') ? c.getAttribute('aria-disabled') === 'true' && !c.disabled : c.disabled, lock = c.classList.contains('is-locked');
      return off && lock ? 'locked' : !off && !lock && !c.hasAttribute('aria-disabled') && !c.disabled ? 'free' : 'mixed'; }) })).observe(b, { childList: true, subtree: true, characterData: true });
}, pre);
const seen = page => page.evaluate(()=> window.__seen.map(s=> s.label + ': ' + [...new Set(s.rows)].join()));
// The pointer over an element hovered (the deepest element under the mouse: the ×'s glyph),
// and its colour and opacity once its transition is over. Hovered again until it is so: a
// page slow to run had the layout move after the mouse did (a card added coming into view),
// the element no longer under it.
async function hovered(page, sel){
  for (let i = 0; ; i++){
    await page.evaluate(sel=> document.querySelector(sel).scrollIntoView({ block: 'center' }), sel);
    await page.hover(sel, { force: true });
    const ok = await page.waitForFunction(sel=>{ const e = document.querySelector(sel); return e.matches(':hover') && !e.getAnimations().length; }, sel, { timeout: 3000 })
      .then(()=> true, ()=> false);
    if (ok) break;
    if (i === 9) throw new Error(sel + ': not hovered');
  }
  return page.evaluate(sel=>{ const h = [...document.querySelectorAll(':hover')].pop(), e = document.querySelector(sel), cs = getComputedStyle(e);
    return { cursor: getComputedStyle(h).cursor, inside: e.contains(h), color: cs.color, opacity: cs.opacity }; }, sel);
}
const still = async (page, sel)=>{ await page.mouse.move(2, 2); await page.waitForFunction(sel=> !document.querySelector(sel).getAnimations().length, sel);
  return page.evaluate(sel=>{ const cs = getComputedStyle(document.querySelector(sel)); return { color: cs.color, opacity: cs.opacity }; }, sel); };
/* A ticked (chosen) control and an unticked one, locked, as drawn, in each theme: from their
   screenshots, decoded in the page, the most saturated pixel of each (the highest of its
   channels less the lowest: the accent's orange well over 60, a grey under 30) and the mean
   difference of a channel between them. The browser's disabled look draws both grey, alike
   (both under 15, a mean difference under 20). The mouse away (a control hovered is drawn
   otherwise), the theme set as its toggle sets it, the transitions over. */
async function looks(page, on, off){
  const out = {};
  await page.mouse.move(2, 2);
  for (const theme of ['dark', 'light']){
    await page.evaluate(t=> document.documentElement.setAttribute('data-theme', t), theme);
    await page.waitForFunction(s=> s.every(s=>{ const e = document.querySelector(s); return !e.matches(':hover') && !e.closest('.rv-cif').getAnimations({ subtree: true }).length; }), [on, off]);
    const shots = [await page.locator(on).screenshot(), await page.locator(off).screenshot()].map(b=> b.toString('base64'));
    out[theme] = await page.evaluate(async shots=>{
      const px = await Promise.all(shots.map(async b64=>{
        const bin = atob(b64), u = Uint8Array.from(bin, ch=> ch.charCodeAt(0)), bmp = await createImageBitmap(new Blob([u], { type: 'image/png' }));
        const g = new OffscreenCanvas(bmp.width, bmp.height).getContext('2d'); g.drawImage(bmp, 0, 0);
        return g.getImageData(0, 0, bmp.width, bmp.height).data;
      }));
      const sat = d=>{ let m = 0; for (let i = 0; i < d.length; i += 4) m = Math.max(m, Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2])); return m; };
      let diff = 0; const [a, b] = px;
      for (let i = 0; i < a.length; i += 4) for (let k = 0; k < 3; k++) diff += Math.abs(a[i + k] - b[i + k]);
      return { on: sat(a), off: sat(b), diff: Math.round(diff / (a.length / 4 * 3)) };
    }, shots);
  }
  await page.evaluate(()=> document.documentElement.setAttribute('data-theme', 'dark'));
  return out;
}
function readable(l, what){
  for (const [theme, x] of Object.entries(l)){
    assert.ok(x.on > 60, `${what}, ${theme}: the ticked one in the accent (${JSON.stringify(x)})`);
    assert.ok(x.off < 30, `${what}, ${theme}: the other grey (${JSON.stringify(x)})`);
    assert.ok(x.diff > 30, `${what}, ${theme}: unlike each other (${JSON.stringify(x)})`);
  }
}
const label = (page, pre = P)=> page.textContent(pre + 'Refine');
const toLabel = (page, t, pre = P)=> page.waitForFunction(([pre, t])=> document.querySelector(pre + 'Refine').textContent === t, [pre, t], { timeout: 120000 });
// Refine on the pattern on show, without the standard (asked: none refined).
async function refineSample(page){
  await page.click(P + 'Refine');
  await page.waitForSelector('.confirm-modal');
  await page.click('.confirm-modal .btn:not(.primary)');
  await toLabel(page, 'Cancel');
}
async function setup(page, n = 2){
  await openModule(page, 'xrd');
  await loadFiles(page, 'xrd', env.fx.files.xrd.slice(0, n));
  await page.setInputFiles(P + 'CifInput', [cif('SrTiO3.cif', SRT), cif('BaTiO3.cif', BTO)]);
  await page.waitForFunction(p=> document.querySelectorAll(p + 'PhaseList .rv-cif').length === 2, P);
  await settle(page);
}

test('A: a sample refining: its rows\' × and tick locked at once, the download not; stopped, at once as before', async ()=>{
  const { page, errors, close } = await env.page();
  // The worker's script held: the run starts and goes on until it is stopped.
  let held = null;
  await page.route('**/xrd-rietveld.worker.js', r=>{ held = r; });
  try {
    await setup(page);
    // Another Rietveld card, with a phase of its own: it does not refine.
    await page.click('#xrdAddAn');
    await page.click('.an-menu [data-kind="rietveld"]');
    await page.waitForSelector('#xrdR3CifInput', { state: 'attached' });
    await page.setInputFiles('#xrdR3CifInput', [cif('BaTiO3.cif', BTO)]);
    await page.waitForFunction(()=> document.querySelectorAll('#xrdR3PhaseList .rv-cif').length === 1);
    await settle(page);
    unlocked(await rows(page), P, 'before');
    const idleX = await hovered(page, P + 'PhaseList .rv-cif:nth-child(1) [data-del]');
    const restX = await still(page, P + 'PhaseList .rv-cif:nth-child(1) [data-del]');
    assert.equal(idleX.cursor, 'pointer');
    assert.notEqual(idleX.color, restX.color, 'idle, the × lit when hovered');
    // The second phase unticked: one tick of each.
    await page.click(P + 'PhaseList .rv-cif:nth-child(2) [data-on]');
    await settle(page);
    assert.deepEqual((await rows(page)).map(x=> x.checked), [true, false]);
    await watch(page);
    await refineSample(page);
    assert.deepEqual(await seen(page), ['Cancel: locked'], 'locked by the end of the task that started the run');
    locked(await rows(page), P, 'running');
    unlocked(await rows(page, '#xrdR3'), '#xrdR3', 'the card that does not refine');
    // The pointer says so; the × not lit, as dim hovered as not.
    for (const w of [1400, 375]){
      await page.setViewportSize({ width: w, height: w > 1000 ? 900 : 800 });
      await settle(page);
      const x = P + 'PhaseList .rv-cif:nth-child(1) [data-del]', t = P + 'PhaseList .rv-cif:nth-child(2) [data-on]';
      const hx = await hovered(page, x), rx = await still(page, x);
      assert.deepEqual([hx.cursor, hx.inside], ['not-allowed', true], `${w} px: over the ×`);
      assert.deepEqual([hx.color, hx.opacity], [rx.color, rx.opacity], `${w} px: the × not lit when hovered`);
      assert.equal(rx.opacity, '0.3', `${w} px: dimmed as a disabled ×`);
      assert.equal((await hovered(page, t)).cursor, 'not-allowed', `${w} px: over the tick`);
      assert.equal((await still(page, t)).opacity, '0.6', `${w} px: the tick dimmed`);
      readable(await looks(page, P + 'PhaseList .rv-cif:nth-child(1) [data-on]', t), `${w} px, the ticks`);
      assert.equal((await hovered(page, P + 'PhaseList .rv-cif:nth-child(1) [data-dl]')).cursor, 'pointer', `${w} px: over the download`);
      for (const z of [P + 'AddCif', P + 'AddCif .rv-cifdz-plus']) assert.equal((await hovered(page, z)).cursor, 'not-allowed', `${w} px: over ${z}`);
      assert.equal(await page.$eval(P + 'CifDz', z=> z.getAttribute('aria-disabled') === 'true' && getComputedStyle(z).cursor), 'not-allowed', 'the drop zone of no phase so too');
      assert.equal((await hovered(page, '#xrdR3PhaseList [data-del]')).cursor, 'pointer', `${w} px: the other card's × as it was`);
    }
    await page.setViewportSize({ width: 1400, height: 900 });
    await settle(page);
    // A click on the × or either tick, or Space on one, changes nothing; one on the row
    // shows its structure.
    const h0 = await history(page, 'xrd'), before = await rows(page);
    await page.click(P + 'PhaseList .rv-cif:nth-child(1) [data-del]', { force: true });
    await page.click(P + 'PhaseList .rv-cif:nth-child(1) [data-on]', { force: true });
    await page.click(P + 'PhaseList .rv-cif:nth-child(2) [data-on]', { force: true });
    await page.focus(P + 'PhaseList .rv-cif:nth-child(2) [data-on]');
    await page.keyboard.press('Space');
    await settle(page);
    assert.deepEqual(await rows(page), before, 'nothing changed');
    assert.deepEqual(before.map(x=> x.checked), [true, false]);
    assert.deepEqual(await history(page, 'xrd'), h0, 'no step of the history');
    await page.click(P + 'PhaseList .rv-cif:nth-child(2) .rv-cif-f');
    assert.equal(await page.textContent(P + 'CellName'), 'BaTiO3', 'the row selected');
    assert.equal(await label(page), 'Cancel', 'the run goes on');
    // Stopped: as before at once.
    await page.waitForTimeout(650);   // (a press within 600 ms of Refine turning into Cancel is not taken)
    await page.click(P + 'Refine');
    await toLabel(page, 'Refine');
    assert.deepEqual(await seen(page), ['Cancel: locked', 'Refine: free'], 'enabled by the end of the task that stopped it');
    unlocked(await rows(page), P, 'stopped');
    const backX = await hovered(page, P + 'PhaseList .rv-cif:nth-child(1) [data-del]');
    assert.deepEqual([backX.cursor, backX.color], [idleX.cursor, idleX.color], 'the × lit again when hovered');
    assert.equal(await page.locator(P + 'PhaseList .rv-cif').count(), 2, 'both phases kept');
    assert.deepEqual((await rows(page)).map(x=> x.checked), [true, false], 'the ticks as they were');
    assert.deepEqual(errors, []);
  } finally { if (held) await held.abort().catch(()=>{}); await close(); }
});

test('B: a run that fails, and one that ends: the rows as before at once', async ()=>{
  const { page, errors, close } = await env.page();
  // The worker answers every job with an error, as the engine's does when it throws.
  await page.route('**/xrd-rietveld.worker.js', r=> r.fulfill({ contentType: 'text/javascript',
    body: "self.addEventListener('message', e=> setTimeout(()=> self.postMessage({ id: e.data.id, type: 'error', message: 'Refinement failed on purpose' }), 300));" }));
  try {
    await setup(page, 1);
    await watch(page);
    await refineSample(page);
    await toLabel(page, 'Refine');
    assert.match(await page.textContent(P + 'Status'), /⚠ Refinement failed on purpose/);
    assert.deepEqual(await seen(page), ['Cancel: locked', 'Refine: free'], 'failed: enabled by the end of the task that ended it');
    unlocked(await rows(page), P, 'failed');
    assert.deepEqual(errors, []);
  } finally { await close(); }
  // The engine's own worker: the refinement ends.
  const p2 = await env.page(), page2 = p2.page;
  try {
    await setup(page2, 1);
    await watch(page2);
    await refineSample(page2);
    await toLabel(page2, 'Refine');
    assert.deepEqual(await seen(page2), ['Cancel: locked', 'Refine: free'], 'ended: enabled by the end of the task that ended it');
    unlocked(await rows(page2), P, 'ended');
    const st = await page2.evaluate(async ()=> Object.keys((await import('./utils.js')).getModuleState('xrd').cards.find(c=> c.id === 2).states.rietveld.results));
    assert.deepEqual(st, ['s00.xrdml'], 'refined');
    assert.deepEqual(p2.errors, []);
  } finally { await p2.close(); }
});

test('C: the standard\'s window locks its rows while the standard refines, not while a sample does', async ()=>{
  const { page, errors, close } = await env.page();
  let held = null;
  await page.route('**/xrd-rietveld.worker.js', r=>{ held = r; });
  try {
    await setup(page, 1);
    // The standard's file and a CIF of its own, in its window.
    await page.click(P + 'Std');
    await page.waitForSelector('#xrdStdRv', { state: 'visible' });
    await page.setInputFiles('#xrdStdRvFiles', env.fx.std);
    await page.waitForFunction(()=> /s11/.test(document.querySelector('#xrdStdRv .xrd-std-file').textContent));
    await page.setInputFiles(S + 'CifInput', [cif('BaTiO3.cif', BTO)]);
    await page.waitForFunction(s=> document.querySelectorAll(s + 'PhaseList .rv-cif').length === 2, S);
    await settle(page);
    unlocked(await rows(page, S), S, 'the standard idle');
    const lab6 = S + 'PhaseList .rv-cif:nth-child(1) [data-del]';
    const builtCursor = (await hovered(page, lab6)).cursor;
    assert.equal(builtCursor, 'default', 'the built-in\'s × with its arrow');
    // The standard refines.
    await watch(page, S);
    await page.click(S + 'Refine');
    await toLabel(page, 'Cancel', S);
    assert.deepEqual(await seen(page), ['Cancel: locked'], 'the standard\'s rows locked at once');
    const r = await rows(page, S);
    locked(r, S, 'the standard refining');
    assert.deepEqual(r.map(x=> x.checked), [true, false], 'LaB6 chosen, as it was');
    readable(await looks(page, S + 'PhaseList .rv-cif:nth-child(1) [data-pick]', S + 'PhaseList .rv-cif:nth-child(2) [data-pick]'), 'the standard\'s choices');
    assert.equal((await hovered(page, lab6)).cursor, builtCursor, 'the built-in\'s × as before');
    assert.equal((await hovered(page, S + 'PhaseList .rv-cif:nth-child(2) [data-del]')).cursor, 'not-allowed');
    assert.equal((await hovered(page, S + 'PhaseList .rv-cif:nth-child(2) [data-pick]')).cursor, 'not-allowed');
    // A click on the other choice changes nothing, nor an arrow key from the one made (the
    // focus moves, the choice not), nor Space.
    const h0 = await history(page, 'xrd');
    await page.click(S + 'PhaseList .rv-cif:nth-child(2) [data-pick]', { force: true });
    assert.deepEqual((await rows(page, S)).map(x=> x.checked), [true, false]);
    await page.focus(S + 'PhaseList .rv-cif:nth-child(1) [data-pick]');
    await page.keyboard.press('ArrowDown');
    assert.equal(await page.evaluate(s=> document.activeElement === document.querySelector(s + 'PhaseList .rv-cif:nth-child(2) [data-pick]'), S), true, 'the focus moved');
    await page.keyboard.press('Space');
    await settle(page);
    assert.deepEqual((await rows(page, S)).map(x=> x.checked), [true, false], 'LaB6 still chosen');
    assert.deepEqual(await history(page, 'xrd'), h0, 'no step of the history');
    // The samples' card, which does not refine, as it was.
    unlocked(await rows(page), P, 'the sample\'s card while the standard refines');
    await page.waitForTimeout(650);
    await page.click(S + 'Refine');   // (Cancel)
    await toLabel(page, 'Refine', S);
    assert.deepEqual(await seen(page), ['Cancel: locked', 'Refine: free'], 'stopped: at once');
    unlocked(await rows(page, S), S, 'the standard stopped');
    assert.deepEqual((await rows(page, S)).map(x=> x.checked), [true, false], 'LaB6 chosen, as it was');
    await page.keyboard.press('Escape');
    await page.waitForSelector('#xrdStdRv', { state: 'hidden' });
    if (held){ await held.abort().catch(()=>{}); held = null; }
    // A sample refines (the standard not refined: without it): its rows locked, the
    // standard's window's not, as before (the run took the standard's profile, none, as it
    // started).
    await refineSample(page);
    locked(await rows(page), P, 'the sample refining');
    await page.click(P + 'Std');
    await page.waitForSelector('#xrdStdRv', { state: 'visible' });
    await settle(page);
    unlocked(await rows(page, S), S, 'the standard\'s window while a sample refines');
    await page.keyboard.press('Escape');
    await page.waitForSelector('#xrdStdRv', { state: 'hidden' });
    await page.waitForTimeout(650);
    await page.click(P + 'Refine');   // (Cancel)
    await toLabel(page, 'Refine');
    unlocked(await rows(page), P, 'the sample stopped');
    assert.deepEqual(errors, []);
  } finally { if (held) await held.abort().catch(()=>{}); await close(); }
});
