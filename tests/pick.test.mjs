/* v536. DRS's Urbach Results: the plain plot and the subtracted one side by side (each
   φ : 1, plain on the left), each one's E_U chart under it as wide, no chips. And every
   plot's traces (plot.js): one hovered drawn thicker and named in a square label of its
   colour; clicked, locked, the crosshair in the lock's colour on the trace at the pointer's
   x (its y interpolated); Esc or a click off it lets it go; nothing kept, no step. Where a
   click is the plot's own already (XRPD's Scherrer peaks; Iodometry's injection, in
   iodo.test.mjs) it does what it did. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start, openModule, loadFiles, settle, history, moduleState } from './helpers.mjs';

let env;
before(async ()=>{ env = await start(); });
after(()=> env && env.close());

async function drsWithUrbach(page){
  await openModule(page, 'tauc'); await loadFiles(page, 'tauc', env.fx.files.tauc);
  await page.click('#taucAddAn');
  await page.click('.an-menu button[data-kind="urbach"]');
  await page.waitForFunction(()=> !!document.querySelector('#an2Eu')); await settle(page);
}

test('DRS Urbach Results: plain and subtracted plots side by side at φ : 1, each E_U chart under its plot, no chips', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await drsWithUrbach(page);
    const r = await page.evaluate(()=>{
      const b = id =>{ const q = document.getElementById(id).getBoundingClientRect(); return { l: q.left, r: q.right, t: q.top, b: q.bottom, w: q.width, h: q.height }; };
      const sec = document.querySelector('.res-an[data-kind="urbach"]');
      return { R1: b('an2R1'), R2: b('an2R2'), R3: b('an2R3'), R4: b('an2R4'),
        chips: sec.querySelectorAll('.plot-chip, .plot-chips').length,
        caps: [...sec.querySelectorAll('.txt-caption')].map(c=> c.textContent),
        bars: ['an2R2', 'an2R4'].map(id=> document.getElementById(id)._plot._stored.filter(e=> e.type === 'barpx').map(e=> e.label)) };
    });
    const near = (a, b, tol = 1)=> Math.abs(a - b) <= tol;
    assert.ok(r.R1.r <= r.R3.l && near(r.R1.t, r.R3.t), 'plain left of subtracted, level');
    for (const k of ['R1', 'R3']) assert.ok(Math.abs(r[k].w / r[k].h / 1.618 - 1) <= 0.02, `${k} at φ : 1 (${(r[k].w / r[k].h).toFixed(3)})`);
    assert.ok(near(r.R2.l, r.R1.l) && near(r.R2.w, r.R1.w) && r.R2.t > r.R1.b, 'plain E_U under the plain plot, as wide');
    assert.ok(near(r.R4.l, r.R3.l) && near(r.R4.w, r.R3.w) && r.R4.t > r.R3.b, 'subtracted E_U under the subtracted plot, as wide');
    assert.ok(near(r.R2.t, r.R4.t), 'the two charts level');
    assert.equal(r.chips, 0, 'no chips');
    assert.deepEqual(r.caps, ['Urbach Plot: plain', 'Urbach Energy: plain', 'Urbach Plot: subtracted', 'Urbach Energy: subtracted']);
    assert.ok(r.bars[0].length && r.bars[0].every(l=> l === 'E_U'), 'the plain chart, the plain E_U');
    assert.ok(r.bars[1].length && r.bars[1].every(l=> l === 'E_U (subtracted)'), 'the subtracted chart, the subtracted E_U');
    assert.equal((await moduleState(page, 'tauc')).analyses.some(a=> 'urbSel' in a), false, 'no choice kept');
    // Each plot's own figure composer, its series in it.
    for (const id of ['an2R1', 'an2R2', 'an2R3', 'an2R4']){
      await page.locator(`.plot-wrap:has(#${id}) button[title="Figure composer (advanced export)"]`).click();
      await page.waitForSelector('.fig-backdrop .fig-svg path, .fig-backdrop .fig-svg rect');
      await page.keyboard.press('Escape');
      await page.waitForFunction(()=> !document.querySelector('.fig-backdrop'));
    }
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

// The pixel, in the page, of a trace's point at x (interpolated as plot.js does), and the
// trace's colour and label; `i` the line entry, x picked where it stands furthest from the rest.
const probe = (page, id, k)=> page.evaluate(([id, k])=>{
  const svg = document.getElementById(id); svg.scrollIntoView({ block: 'center' });
  const P = svg._plot, lines = P._stored.filter(e=> e.type === 'line'), e = lines[k], rect = svg.getBoundingClientRect();
  const at = (t, x)=>{ for (let i = 1; i < t.xs.length; i++){ const a = t.xs[i-1], b = t.xs[i]; if ((x - a)*(x - b) <= 0) return a === b ? t.ys[i] : t.ys[i-1] + (t.ys[i] - t.ys[i-1])*(x - a)/(b - a); } return NaN; };
  let best = null, bd = -1;
  for (let j = 0.15; j <= 0.85; j += 0.01){
    const x = P.xmin + j*(P.xmax - P.xmin), y = at(e, x);
    if (!isFinite(y) || y < P.ymin || y > P.ymax) continue;
    const d = Math.min(...lines.filter(o=> o !== e).map(o=> Math.abs(P.py(at(o, x)) - P.py(y))).filter(isFinite), 1e9);
    if (d > bd){ bd = d; best = { x, y }; }
  }
  return { cx: rect.left + P.px(best.x), cy: rect.top + P.py(best.y), x: best.x, color: e.color, width: e.width, label: e.label, sep: bd };
}, [id, k]);

test('a plot\'s trace: hovered, drawn out and named; clicked, locked, the crosshair snapped to it; Esc lets it go; no step', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'tauc'); await loadFiles(page, 'tauc', env.fx.files.tauc);
    const S = 'taucResSvg0', h0 = await history(page, 'tauc'), st0 = await moduleState(page, 'tauc');
    const p = await probe(page, S, 1);
    assert.ok(p.sep > 12, 'a point clear of the other traces');
    await page.mouse.move(p.cx, p.cy);
    const hov = await page.$eval('#' + S, s=>{
      const hl = s.querySelector('.plot-cross .plot-pick-hl'), lb = s.querySelector('.plot-cross .plot-pick-label');
      return { hl: hl && [hl.getAttribute('stroke'), +hl.getAttribute('stroke-width')], rect: lb && lb.querySelector('rect').getAttribute('fill'), rx: lb && lb.querySelector('rect').getAttribute('rx'),
        name: lb && lb.textContent, lock: s.querySelectorAll('.plot-lockcross').length };
    });
    assert.equal(hov.hl[0], p.color); assert.ok(hov.hl[1] >= 2*p.width, 'the trace drawn again, thicker');
    assert.equal(hov.rect, p.color, 'its label in its colour');
    assert.equal(hov.rx, null, 'square-cornered');
    assert.equal(hov.name, p.label, 'named');
    assert.equal(hov.lock, 0, 'not locked');
    // Clicked: locked. The pointer moved off the trace, the crosshair stays on it at the pointer's x.
    await page.mouse.click(p.cx, p.cy);
    const lockColor = await page.evaluate(()=>{ const d = document.createElement('i'); d.style.color = 'var(--plot-lock)'; document.body.append(d); const c = getComputedStyle(d).color; d.remove(); return c; });
    const mx = p.cx + 40, my = p.cy - 60;
    await page.mouse.move(mx, my);
    const lk = await page.$eval('#' + S, (s, [mx, my])=>{
      const P = s._plot, r = s.getBoundingClientRect(), e = P._stored.filter(e=> e.type === 'line')[1];
      const dot = s.querySelector('.plot-lockdot'), line = s.querySelector('.plot-lockcross');
      // (the pointer's x as the page has it, to the pixel; y interpolated at the dot's own x)
      const x = P.invX(+dot.getAttribute('cx')), px = (P.xmax - P.xmin)/(P.size().w - P.margin.l - P.margin.r);
      let y = NaN;
      for (let i = 1; i < e.xs.length; i++){ const a = e.xs[i-1], b = e.xs[i]; if ((x - a)*(x - b) <= 0){ y = e.ys[i-1] + (e.ys[i] - e.ys[i-1])*(x - a)/(b - a); break; } }
      return { x, y, px, mx: P.invX(mx - r.left), dx: P.invX(+dot.getAttribute('cx')), dy: P.invY(+dot.getAttribute('cy')), stroke: getComputedStyle(line).stroke,
        hl: s.querySelector('.plot-pick-hl').getAttribute('stroke'), name: s.querySelector('.plot-pick-label').textContent, span: P.ymax - P.ymin,
        readout: s.querySelector('.plot-readout').textContent };
    }, [mx, my]);
    assert.equal(lk.stroke, lockColor, 'the crosshair in the lock\'s colour');
    assert.equal(lk.hl, p.color); assert.equal(lk.name, p.label, 'the locked trace still drawn out and named');
    assert.ok(Math.abs(lk.dx - lk.mx) <= lk.px, 'at the pointer\'s x');
    assert.ok(Math.abs(lk.dy - lk.y) < 1e-9 * lk.span, `on the trace's y there (${lk.dy} vs ${lk.y})`);
    assert.match(lk.readout, /^Wavelength = [\d.]+ nmF\(R\) = /, 'the read-out of x and y');
    // Esc: let go; the crosshair the pointer's again.
    await page.keyboard.press('Escape');
    await page.mouse.move(mx, my + 1);
    assert.deepEqual(await page.$eval('#' + S, s=> [!!s._pick, s.querySelectorAll('.plot-lockcross, .plot-lockdot').length, s.querySelectorAll('.plot-crosshair').length]), [false, 0, 2]);
    // Locked again, then a click off every trace lets it go.
    await page.mouse.click(p.cx, p.cy);
    assert.equal(await page.$eval('#' + S, s=> !!s._pick), true);
    // (a point of the plot's area with no trace within 30 px)
    const m = await page.$eval('#' + S, s=>{
      const P = s._plot, r = s.getBoundingClientRect(), { w, h } = P.size(), M = P.margin;
      for (let x = M.l + 5; x < w - M.r; x += 10) for (let y = M.t + 5; y < h - M.b; y += 10){
        const lines = P._stored.filter(e=> e.type === 'line');
        if (lines.every(e=> e.xs.every((v, i)=> Math.hypot(P.px(v) - x, P.py(e.ys[i]) - y) > 30))) return { x: r.left + x, y: r.top + y };
      }
    });
    await page.mouse.click(m.x, m.y);
    assert.equal(await page.$eval('#' + S, s=> !!s._pick), false, 'a click on the empty area lets it go');
    // Nothing exported of it, no step, no change.
    await page.mouse.click(p.cx, p.cy);
    const exp = await page.evaluate(async id=>{
      const s = document.getElementById(id), c = s.cloneNode(true);
      c.querySelectorAll('.plot-goverlay, .plot-cross').forEach(el=>{ while (el.firstChild) el.removeChild(el.firstChild); });
      return c.querySelectorAll('.plot-pick-hl, .plot-pick-label, .plot-lockcross').length;
    }, S);
    assert.equal(exp, 0);
    await settle(page);
    assert.deepEqual(await history(page, 'tauc'), h0, 'no step');
    assert.deepEqual(await moduleState(page, 'tauc'), st0, 'no change');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('XRPD\'s Scherrer plot: a click on a peak selects it, as before, and locks no trace', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'xrd'); await loadFiles(page, 'xrd', env.fx.files.xrd);
    const S = '#xrdA1Svg';
    await page.$eval(S, s=> s.scrollIntoView({ block: 'center' }));
    // A peak's hit line on the overlay: its middle.
    const at = await page.$eval(S, s=>{
      const P = s._plot, r = s.getBoundingClientRect();
      const hit = [...s.querySelectorAll('.plot-goverlay line')].find(l=> l.getAttribute('stroke') === 'transparent' && l.getAttribute('x1') === l.getAttribute('x2') && +l.getAttribute('x1') > P.margin.l + 20);
      return { x: r.left + +hit.getAttribute('x1'), y: r.top + (+hit.getAttribute('y1') + +hit.getAttribute('y2'))/2 };
    });
    await page.mouse.move(at.x, at.y); await page.mouse.click(at.x, at.y); await settle(page);
    assert.equal(await page.locator('#xrdA1PeakBox tr.selected').count(), 1, 'the peak selected');
    assert.deepEqual(await page.$eval(S, s=> [!!s._pick, s.querySelectorAll('.plot-pick-hl, .plot-pick-label, .plot-lockcross').length]), [false, 0], 'no trace locked or drawn out');
    // The empty area: the selection cleared, as before.
    const m = await page.$eval(S, s=>{ const P = s._plot, r = s.getBoundingClientRect(); return { x: r.left + P.margin.l + 3, y: r.top + P.margin.t + 3 }; });
    await page.mouse.click(m.x, m.y); await settle(page);
    assert.equal(await page.locator('#xrdA1PeakBox tr.selected').count(), 0, 'cleared');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
