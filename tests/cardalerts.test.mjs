/* What the analysis cards and their windows say, and where (v571, ALERTS-REVIEW.md phase 3:
   C17, C19, X05–X17), and the two follow-ups of v570. Every file here is made up for the test.
   - XRPD's Rietveld card: the instrument's line the facts alone, what was assumed in a box under
     it (X05); a CIF that cannot be added, "Not added: {file}: {why}." a compact error in the
     status's place, and a refinement that fails, "Refinement failed: {why}." (X07; to v570 grey
     "⚠ …"); the boxes' top still on the plot frame's with either (CLAUDE.md); a Refinement
     setting refused, its rule in red under its row (X17, C19; to v570 amber in the section's
     note), gone with the next entry taken.
   - XRPD's standard: its Caglioti fit not fitted (fewer than three peaks), a compact warning in
     its box (X15), the window's Parameters title still on the plot frame's top.
   - Iodometry's calibration (C19, C17): a field holding no number flashes as it is confirmed
     and is said in red under its group, the line's or the standards'; a line that is none, every
     field a number, a compact error; Apply held back as before.
   - XRPD's Scherrer card (v576): peaks at a reflection's Kα2 alone, named "(hkl) Kα2", said in
     the grey rule under its table (R1: how the data were treated, no box), in the rules' words.
   - A numeric field's rule said in red under it as a value is refused (utils.js
     guardNumericInput: GC's m), floating, so that nothing moves; gone as the field is typed in.
     (v576) Measured once the field's shake is over: the rule is placed under the field at rest
     and stays there while the field shakes; to v575 the field was measured a frame or two into
     its shake, up to 6 px aside, and the test failed now and then (dx 2.8).
   - Drags start with the primary button of any pointer (v570's follow-up): a pen's barrel
     button (2) or its eraser (5) starts none of the trace list's grip, a card's grip and a
     plot's draggable line; its tip (0) does (to v570 a mouse's other buttons alone were
     refused). */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start, openModule, loadFiles, settle, moduleState, firstTop } from './helpers.mjs';
import { xrdml, PEROV_HI } from './fixtures.mjs';

let env;
before(async ()=>{ env = await start(); });
after(()=> env && env.close());

const P = '#xrdR2';   // the default deck's second card, a Rietveld one
const boxTop = page => firstTop(page, '#tab-xrd .an-card:nth-child(2)', { frame: 'svg.plot', block: '.pside-col > .rv-boxes' });
const aligned = (t, what)=> assert.ok(Math.abs(t.top - t.frame) <= 1, `${what}: the boxes' top ${t.top}, the plot frame's ${t.frame}`);

test('XRPD Rietveld: the instrument\'s assumptions in a box under its line; a CIF not added and a run that fails, a compact error in the status\'s place; a setting refused, its rule under it', async ()=>{
  const { page, errors, csp, close } = await env.page();
  // The workers answer every job with the engine's error for too short a pattern.
  await page.route('**/xrd-rietveld.worker.js', r=> r.fulfill({ contentType: 'text/javascript',
    body: "self.addEventListener('message', e=> setTimeout(()=> self.postMessage({ id: e.data.id, type: 'error', message: 'The pattern has too few points (3) for a refinement.' }), 100));" }));
  try {
    await openModule(page, 'xrd');
    await loadFiles(page, 'xrd', env.fx.files.xrd.slice(0, 1));
    aligned(await boxTop(page), 'loaded');
    // The line: the facts; under it the assumptions, here two that hold in the normal case.
    assert.equal(await page.textContent(P + 'Instr'), ' Kα₁ 1.540598 Å, Kα₂ 1.544426 Å (×0.5) · R 240 mm');
    assert.deepEqual(await page.$$eval(P + 'InstrNotes .alert', as=> as.map(a=> a.className)), ['alert info compact']);
    // A file that is no CIF: not added, said as an error in the status's place.
    await page.setInputFiles(P + 'CifInput', [{ name: 'empty.cif', mimeType: 'text/plain', buffer: Buffer.from('nothing here\n') }]);
    await page.waitForSelector(P + 'Status .alert.bad.compact');
    assert.equal(await page.innerHTML(P + 'Status'), '<div class="alert bad compact">✕ Not added: empty.cif: not a CIF: no data_ block found.</div>');
    aligned(await boxTop(page), 'a CIF not added');
    // A CIF taken; Refine (no standard: refined without), the run failing.
    await page.setInputFiles(P + 'CifInput', env.fx.cif);
    await page.waitForSelector(P + 'PhaseList input[data-on]');
    await page.click(P + 'Refine');
    await page.waitForSelector('.confirm-modal');
    await page.click('.confirm-modal .btn:not(.primary)');
    await page.waitForFunction(p=> !!document.querySelector(p + 'Status .alert.bad.compact') && document.querySelector(p + 'Refine').textContent === 'Refine', P, { timeout: 60000 });
    await settle(page);
    assert.equal(await page.innerHTML(P + 'Status'), '<div class="alert bad compact">✕ Refinement failed: the pattern has too few points (3) for a refinement.</div>');
    aligned(await boxTop(page), 'a run that failed');
    // Settings…: a Refinement setting refused, its rule in red under its row; the section's
    // note as ever; the next entry taken lets it go.
    await page.click(P + 'Settings');
    await page.waitForSelector(P + 'Fit_maxIter', { state: 'visible' });
    const f = page.locator(P + 'Fit_maxIter'), was = await f.inputValue();
    await f.fill('abc'); await f.press('Enter'); await settle(page);
    const rules = ()=> page.locator('[data-fit-rule]').count();
    const r1 = await page.evaluate(p=>{ const row = document.querySelector(`${p}Fit_maxIter`).closest('[data-fit-row]'), n = row.nextElementSibling, note = row.closest('.rvs-fit').querySelector('[data-fit-note]');
      const bad = document.createElement('i'); bad.style.color = 'var(--bad)'; document.body.appendChild(bad); const red = getComputedStyle(bad).color; bad.remove();
      return { rule: n && n.matches('.field-rule') ? n.textContent : null, red: n && getComputedStyle(n).color === red, note: note.textContent, warn: note.classList.contains('is-warn') };
    }, P);
    assert.equal(r1.rule, `A whole number from 1 to 1000: “abc” not taken; ${was} kept.`);
    assert.ok(r1.red, 'in red');
    assert.deepEqual([r1.note, r1.warn], ['For every pattern, from the next refinement. A result refined with other than the defaults says which, under its statistics.', false]);
    assert.equal(await f.inputValue(), was);
    await f.fill('55'); await f.press('Enter'); await settle(page);
    assert.equal(await rules(), 0, 'gone with the next entry taken');
    assert.deepEqual(errors, []); assert.deepEqual(await csp(), []);
  } finally { await close(); }
});

/* The standard's Caglioti fit with fewer than three peaks: not fitted, a compact warning in its
   box (v571, ALERTS-REVIEW.md X15: to v570 a grey note); the window's Parameters title still on
   the plot frame's top (CLAUDE.md). */
test('XRPD standard: the Caglioti fit not fitted, a compact warning in its box; Parameters\' top on the plot frame\'s', async ()=>{
  const { page, errors, csp, close } = await env.page();
  try {
    await openModule(page, 'xrd');
    await loadFiles(page, 'xrd', env.fx.files.xrd.slice(0, 1));
    await page.click('#xrdA1Std'); await page.setInputFiles('#xrdStdPeaksFiles', env.fx.std);
    await page.waitForSelector('#xrdStdPeaks .xrd-std-name'); await settle(page);
    const W = '.xrd-std-modal:not([style*="none"])';
    assert.equal(await page.locator(`${W} .xrd-cag .alert`).count(), 0, 'fitted: no box');
    const h = page.locator(`${W} input[id$="PkHeight"]`);
    await h.fill('70'); await h.press('Enter'); await settle(page);
    assert.match(await page.textContent(`${W} .xrd-cag .alert.warn.compact`), /^⚠ Not fitted: it needs 3 peaks or more\. The instrumental width is /);
    const t = await firstTop(page, `${W} .xrd-std-box`, { frame: 'svg.plot', head: '.xrd-std-side > .param-head' });
    assert.ok(Math.abs(t.top - t.frame) <= 1, `Parameters' top on the frame's: ${JSON.stringify(t)}`);
    assert.deepEqual(errors, []); assert.deepEqual(await csp(), []);
  } finally { await close(); }
});

/* XRPD's Scherrer card (v576): a sample's peaks at a reflection's Kα2 alone (the fixture's
   perovskite from 115° to 140°, its Kα2 peaks resolved), said in the grey rule under the table,
   after the mean: how they were treated, no box (R1); no "!", no "—", no version, a period at
   its end (R4); the Parameters' title still on the plot frame's top (CLAUDE.md). */
test('XRPD Scherrer: peaks at a reflection\'s Kα2 alone said in the grey rule under the table, no box; Parameters\' top on the plot frame\'s', async ()=>{
  const { page, errors, csp, close } = await env.page();
  try {
    await openModule(page, 'xrd');
    await loadFiles(page, 'xrd', [env.fx.put('hi.xrdml', xrdml(0, { lo: 115, hi: 140, n: 1924, refl: PEROV_HI }))]);
    await page.setInputFiles('#xrdA1CifInput', env.fx.cif);
    await page.waitForSelector('#xrdA1PeakTableWrap .xrd-hkl-rule'); await settle(page);
    const r = await page.evaluate(()=>{
      const w = document.querySelector('#xrdA1PeakTableWrap'), rule = w.querySelector('.xrd-hkl-rule');
      const grey = document.createElement('i'); grey.style.color = 'var(--muted)'; document.body.appendChild(grey); const muted = getComputedStyle(grey).color; grey.remove();
      return { text: rule.textContent, grey: getComputedStyle(rule).color === muted && rule.matches('p.txt-meta'), after: rule.previousElementSibling.matches('.size-summary'),
        boxes: w.querySelectorAll('.alert').length, k2: [...w.querySelectorAll('.peak-row')].filter(t=> / Kα2$/.test(t.cells[2].textContent)).length };
    });
    assert.deepEqual([r.grey, r.after, r.boxes, r.k2], [true, true, 0, 4]);
    assert.match(r.text, /; 4 of 8 peaks only at a reflection's Kα2 \(λ 1\.544426 Å\), named so and left out of its sizes, as each repeats its Kα1 peak\.$/);
    assert.ok(!/[!—]|v\d{3}/.test(r.text), r.text);
    const t = await firstTop(page, '#tab-xrd .an-card:nth-child(1)', { frame: 'svg.plot', head: ':scope .col.mw280 > .param-head' });
    assert.ok(Math.abs(t.top - t.frame) <= 1, `the title's top ${t.top}, the plot frame's ${t.frame}`);
    assert.deepEqual(errors, []); assert.deepEqual(await csp(), []);
  } finally { await close(); }
});

test('Iodometry\'s calibration: a field holding no number said in red under its group; a line that is none, a compact error; Apply held back', async ()=>{
  const { page, errors, csp, close } = await env.page();
  try {
    await openModule(page, 'iodo');
    const t = Array.from({ length: 300 }, (_, j)=> +(0.05 + 0.2*j).toFixed(2));
    const csv = 'blank,,s1,,\r\nTime (sec),Abs,Time (sec),Abs,\r\n' + t.map((tt, j)=> [0, 1].map(k=> `${tt.toFixed(2)},${(0.2 + 0.1*k + (j >= 50 ? 0.3*(1 - Math.exp(-(tt - 10)/20)) : 0)).toFixed(6)},`).join('')).join('\r\n') + '\r\n\r\n';
    await loadFiles(page, 'iodo', [env.fx.put('kin.csv', csv)], 2);
    const CAL = '.iodo-cal:not([style*="none"])';
    await page.click('#iodoCalBtn'); await page.waitForSelector(CAL);
    const said = ()=> page.evaluate(c=>{ const q = s => document.querySelector(`${c} ${s}`), vis = e => !!e && e.offsetHeight > 0;
      return { line: vis(q('.iodo-cal-rule[data-rule="line"]')) ? q('.iodo-cal-rule[data-rule="line"]').textContent : null, std: vis(q('.iodo-cal-rule[data-rule="std"]')) ? q('.iodo-cal-rule[data-rule="std"]').textContent : null,
        msg: q('.iodo-cal-msg').innerHTML, apply: q('[data-apply]').disabled };
    }, CAL);
    await page.selectOption('#iodoCalMode', 'line'); await settle(page);
    assert.deepEqual(await said(), { line: null, std: null, msg: '<div class="alert bad compact">✕ A slope (not 0) and an intercept are needed.</div>', apply: true }, 'a line that is none');
    await page.fill('#iodoCalSlope', 'x'); await page.press('#iodoCalSlope', 'Tab');
    await page.waitForSelector('#iodoCalSlope.field-invalid');
    await settle(page);
    assert.deepEqual(await said(), { line: 'Not a number: the slope.', std: null, msg: '', apply: true }, 'the slope, no number');
    await page.fill('#iodoCalSlope', '0,5'); await page.fill('#iodoCalIcpt', '0.01'); await settle(page);
    assert.deepEqual(await said(), { line: null, std: null, msg: '', apply: false }, 'a line');
    await page.selectOption('#iodoCalMode', 'std'); await settle(page);
    const c0 = page.locator(`${CAL} .iodo-std tbody tr`).nth(1).locator('input[data-j="0"]');
    await c0.fill('two'); await c0.press('Tab'); await settle(page);
    const s = await said();
    assert.deepEqual([s.line, s.std, s.apply], [null, 'Not a number: standard 2.', true], 'a standard, no number');
    assert.equal(s.msg, '', 'said under the standards, not at the foot');
    // (the rule under the table, the fit's line under it)
    assert.ok(await page.evaluate(c=> document.querySelector(`${c} .iodo-std`).nextElementSibling.matches('.iodo-cal-rule[data-rule="std"]'), CAL));
    await page.click(`${CAL} [data-cancel]`);
    assert.deepEqual(errors, []); assert.deepEqual(await csp(), []);
  } finally { await close(); }
});

test('a numeric field\'s value refused: its rule in red under it, floating, gone as it is typed in (guardNumericInput)', async ()=>{
  const { page, errors, csp, close } = await env.page();
  try {
    await openModule(page, 'gc');
    await loadFiles(page, 'gc', env.fx.files.gc);
    const m = page.locator('#tab-gc .gcShared[data-f="m"]'), was = await m.inputValue();
    const card = await page.locator('#tab-gc .an-card').first().boundingBox();
    await m.fill('0'); await m.press('Enter');
    await page.waitForSelector('.field-rule-float');
    // The field shakes as it is refused (0.4 s: style.css field-shake, up to 6 px aside); the
    // rule, placed under it at rest, stays put: measured as it comes and once the shake is over.
    const ruleAt = ()=> page.$eval('.field-rule-float', e=>{ const b = e.getBoundingClientRect(); return [b.left, b.top]; });
    const at0 = await ruleAt();
    await page.waitForFunction(()=> document.querySelector('#tab-gc .gcShared[data-f="m"]').getAnimations().length === 0);
    const r = await page.evaluate(()=>{ const e = document.querySelector('.field-rule-float'), f = document.querySelector('#tab-gc .gcShared[data-f="m"]').getBoundingClientRect(), b = e.getBoundingClientRect();
      return { text: e.textContent, dy: b.top - f.bottom, dx: b.left - f.left, pos: getComputedStyle(e).position, n: document.querySelectorAll('.field-rule-float').length }; });
    assert.deepEqual([r.text, r.pos, r.n], ['A number, at least 0.001.', 'fixed', 1]);
    assert.ok(r.dy >= 0 && r.dy <= 6 && Math.abs(r.dx) <= 1, `under the field at rest: ${JSON.stringify(r)}`);
    assert.deepEqual(await ruleAt(), at0, 'the rule still through the shake');
    assert.equal(await m.inputValue(), was, 'the value put back');
    assert.deepEqual(await page.locator('#tab-gc .an-card').first().boundingBox(), card, 'nothing in the card moved');
    await m.focus(); await page.keyboard.type('1');
    assert.equal(await page.locator('.field-rule-float').count(), 0, 'gone as the field is typed in');
    await m.fill(was); await m.press('Enter'); await settle(page);
    assert.deepEqual(errors, []); assert.deepEqual(await csp(), []);
  } finally { await close(); }
});

/* A press of a pen (synthetic pointer events: pointerType 'pen', `button`) on `sel`, moved by
   (dx, dy) and let go, as a drag would be: what was lit while it was held (`lit`, a selector
   under the tab), and whether the element `moving` carried its class. pointerId 1, the mouse's:
   always an active pointer, so that a capture asked for does not throw. */
const penDrag = (page, sel, button, { dx = 0, dy = 40, lit = '.dragging, .an-moving' } = {})=> page.evaluate(([sel, button, dx, dy, lit])=>{
  const el = document.querySelector(sel), b = el.getBoundingClientRect(), x = b.left + b.width/2, y = b.top + b.height/2;
  const ev = (type, t, cx, cy)=> t.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, composed: true, pointerId: 1, pointerType: 'pen', isPrimary: true,
    button: type === 'pointermove' ? -1 : button, buttons: type === 'pointerup' ? 0 : 1 << (button === 5 ? 5 : button === 2 ? 2 : 0), clientX: cx, clientY: cy }));
  ev('pointerdown', el, x, y);
  const held = document.querySelectorAll(lit).length;
  ev('pointermove', el.ownerSVGElement || el, x + dx, y + dy); ev('pointermove', window.document, x + dx, y + dy);
  ev('pointerup', el, x + dx, y + dy); ev('pointerup', window.document, x + dx, y + dy);
  return held;
}, [sel, button, dx, dy, lit]);

test('drags start with the primary button of any pointer: a pen\'s barrel button and eraser start none, its tip does (the trace list, a card\'s grip, a plot\'s line)', async ()=>{
  const { page, errors, csp, close } = await env.page();
  try {
    await openModule(page, 'tauc');
    await loadFiles(page, 'tauc', env.fx.files.tauc);
    const state = async ()=> JSON.stringify(await moduleState(page, 'tauc'));
    const s0 = await state();
    // The trace list's grip and a card's grip: nothing held with 2 or 5, held with 0.
    for (const [sel, what] of [['#taucFileTableWrap tr.file-row .drag-handle', 'the trace list\'s grip'], ['#tab-tauc .an-card .an-grip', 'a card\'s grip']]){
      for (const b of [2, 5]) assert.equal(await penDrag(page, sel, b, { dy: 0 }), 0, `${what}, the pen's button ${b}: nothing held`);
      await settle(page);
      assert.equal(await state(), s0, `${what}: nothing moved`);
      assert.ok(await penDrag(page, sel, 0, { dy: 0 }) > 0, `${what}, the pen's tip: held`);
      await settle(page);
    }
    assert.equal(await state(), s0, 'let go where they were: nothing moved');
    // A plot's draggable line (DRS's interval): moved by the tip alone.
    const line = '#tab-tauc .an-card svg.plot .plot-goverlay circle';
    await page.waitForSelector(line);
    for (const b of [2, 5]){ await penDrag(page, line, b, { dx: -30, dy: 0 }); await settle(page); assert.equal(await state(), s0, `a plot's line, the pen's button ${b}: not moved`); }
    await penDrag(page, line, 0, { dx: -30, dy: 0 }); await settle(page);
    assert.notEqual(await state(), s0, 'a plot\'s line, the pen\'s tip: moved');
    assert.deepEqual(errors, []); assert.deepEqual(await csp(), []);
  } finally { await close(); }
});
