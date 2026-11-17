/* v536. DRS's Urbach Results: the plain plot and the subtracted one side by side (each
   φ : 1, plain on the left), each one's E_U chart under it as wide, no chips. And every
   plot's traces (plot.js): one hovered drawn thicker and named in a square label;
   clicked, locked, the crosshair in the lock's colour on the trace; Esc or a click off it
   lets it go; nothing kept, no step. Where a click is the plot's own already (XRPD's
   Scherrer peaks; Iodometry's injection, in iodo.test.mjs) it does what it did.
   v538: the trace's line 1.5× as wide, nothing else; the crosshair on a data point of the
   trace, never between two (a dense line: the point nearest the pointer's x; a scatter or
   a sparse line: the point nearest the pointer on screen), hovered, clicked or locked; ←
   and → move the lock one point along the trace, stopping at its ends, and step no
   sample while it holds; the label read on the plot's background in both themes (a white
   trace on a white plot: the background's colour, a dark border and text). */
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
        name: lb && lb.textContent, lock: s.querySelectorAll('.plot-lockcross').length, n: s.querySelectorAll('.plot-cross .plot-pick-hl').length,
        // the hover crosshair's x, in data: one of the trace's own
        cx: s._plot.invX(+s.querySelector('.plot-crosshair').getAttribute('x1')) };
    });
    const onData = await page.$eval('#' + S, (s, x)=>{
      const P = s._plot, e = P._stored.filter(e=> e.type === 'line')[1], px = (P.xmax - P.xmin)/(P.size().w - P.margin.l - P.margin.r);
      return e.xs.some(v=> Math.abs(v - x) <= 1e-6*px);
    }, hov.cx);
    assert.equal(hov.hl[0], p.color); assert.equal(hov.hl[1], 1.5*p.width, 'the trace drawn again, 1.5× as wide');
    assert.equal(hov.rect, p.color, 'its label in its colour');
    assert.equal(hov.rx, null, 'square-cornered');
    assert.equal(hov.name, p.label, 'named');
    assert.equal(hov.lock, 0, 'not locked');
    assert.equal(hov.n, 1, 'one trace drawn out, nothing else');
    assert.ok(onData, 'the hover crosshair on a data point of the trace');
    // Clicked: locked. The pointer moved off the trace, the crosshair stays on it at the pointer's x.
    await page.mouse.click(p.cx, p.cy);
    const lockColor = await page.evaluate(()=>{ const d = document.createElement('i'); d.style.color = 'var(--plot-lock)'; document.body.append(d); const c = getComputedStyle(d).color; d.remove(); return c; });
    const mx = p.cx + 40, my = p.cy - 60;
    await page.mouse.move(mx, my);
    // The lock's point: its index in the trace, and the point a dense line takes for the
    // pointer (nearest its x, then its y).
    const where = (mx, my)=> page.$eval('#' + S, (s, [mx, my])=>{
      const P = s._plot, r = s.getBoundingClientRect(), e = P._stored.filter(e=> e.type === 'line')[1];
      const dot = s.querySelector('.plot-lockdot'), line = s.querySelector('.plot-lockcross');
      const X = +dot.getAttribute('cx'), Y = +dot.getAttribute('cy');
      const i = e.xs.findIndex((v, k)=> Math.abs(P.px(v) - X) < 1e-6 && Math.abs(P.py(e.ys[k]) - Y) < 1e-6);
      let want = -1, bk = Infinity, bd = Infinity;
      if (mx != null) e.xs.forEach((v, k)=>{
        if (!isFinite(v) || !isFinite(e.ys[k]) || v < P.xmin || v > P.xmax) return;
        const kk = Math.round(Math.abs(P.px(v) - (mx - r.left))*2), d = Math.abs(P.py(e.ys[k]) - (my - r.top));
        if (kk < bk || (kk === bk && d < bd)){ bk = kk; bd = d; want = k; }
      });
      return { i, want, n: e.xs.length, x: e.xs[i], y: e.ys[i], dense: e.xs.filter(v=> v >= P.xmin && v <= P.xmax).length*6 > P.size().w - P.margin.l - P.margin.r,
        stroke: getComputedStyle(line).stroke, hl: s.querySelector('.plot-pick-hl').getAttribute('stroke'), name: s.querySelector('.plot-pick-label').textContent,
        readout: s.querySelector('.plot-readout').textContent, pick: s._pick && s._pick.i };
    }, [mx, my]);
    const lk = await where(mx, my);
    assert.equal(lk.stroke, lockColor, 'the crosshair in the lock\'s colour');
    assert.equal(lk.hl, p.color); assert.equal(lk.name, p.label, 'the locked trace still drawn out and named');
    assert.ok(lk.dense, 'a dense line');
    assert.ok(lk.i >= 0, 'the dot on one of the trace\'s own points');
    assert.equal(lk.i, lk.want, 'the point nearest the pointer\'s x');
    assert.match(lk.readout, /^Wavelength = [\d.]+ nmF\(R\) = /, 'the read-out of x and y');
    // → and ←: one point along the trace each; the sample stays.
    await page.keyboard.press('ArrowRight');
    assert.equal((await where()).i, lk.i + 1, '→: the next point');
    await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowLeft');
    const back = await where();
    assert.equal(back.i, lk.i - 1, '←, ←: the point before');
    assert.equal(back.pick, lk.i - 1);
    // The ends: no further.
    await page.$eval('#' + S, s=>{ s._pick.i = s._plot._stored.filter(e=> e.type === 'line')[1].xs.length - 1; });
    await page.keyboard.press('ArrowRight');
    const end = await page.$eval('#' + S, s=> s._pick.i);
    assert.equal(end, lk.n - 1, 'stops at the last point');
    await page.$eval('#' + S, s=>{ s._pick.i = 0; });
    await page.keyboard.press('ArrowLeft');
    assert.equal(await page.$eval('#' + S, s=> s._pick.i), 0, 'stops at the first point');
    assert.deepEqual(await history(page, 'tauc'), h0, 'the arrows stepped no sample');
    assert.deepEqual(await moduleState(page, 'tauc'), st0, 'nor changed anything');
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

// A plot of its own in the app's page: a sparse line of 8 points and a scatter, white or
// black, on the theme's panel colour.
async function ownPlot(page, theme, color){
  await page.evaluate(async ([theme, color])=>{
    document.documentElement.setAttribute('data-theme', theme);
    document.getElementById('ownPlot')?.remove();
    const { Plot } = await import('./plot.js');
    const box = document.createElement('div');
    box.id = 'ownPlot';
    box.style.cssText = 'position:fixed;left:20px;top:20px;width:600px;height:400px;z-index:99999;background:var(--panel)';
    box.innerHTML = '<svg width="600" height="400" style="display:block;width:600px;height:400px"></svg>';
    document.body.append(box);
    const P = new Plot(box.querySelector('svg'), { xlabel: 'x (u)', ylabel: 'y' });
    P.setRange(0, 7, 0, 10); P.drawAxes();
    P.line([0, 1, 2, 3, 4, 5, 6, 7], [1, 3, 2, 5, 4, 7, 6, 8], color, 2, undefined, { label: 'sparse', key: 'sparse' });
    P.points([0.5, 2.5, 4.5, 6.5], [9, 9, 9, 9], '#3a7bd5', 3);
  }, [theme, color]);
}
// The pixel in the page of data (x, y) on it, and what its crosshair layer shows.
const own = {
  at: (page, x, y)=> page.evaluate(([x, y])=>{ const s = document.querySelector('#ownPlot svg'), r = s.getBoundingClientRect(); return { x: r.left + s._plot.px(x), y: r.top + s._plot.py(y) }; }, [x, y]),
  cross: page => page.evaluate(()=>{
    const s = document.querySelector('#ownPlot svg'), P = s._plot;
    const v = s.querySelector('.plot-cross line'), dot = s.querySelector('.plot-lockdot'), lb = s.querySelector('.plot-pick-label');
    const rgb = c =>{ const d = document.createElement('i'); d.style.color = c; document.body.append(d); const m = getComputedStyle(d).color.match(/[\d.]+/g).map(Number); d.remove(); return m.slice(0, 3); };
    const lum = ([r, g, b])=>{ const f = v => (v /= 255) <= 0.03928 ? v/12.92 : ((v + 0.055)/1.055)**2.4; return 0.2126*f(r) + 0.7152*f(g) + 0.0722*f(b); };
    const con = (a, b)=>{ const A = lum(a), B = lum(b); return (Math.max(A, B) + 0.05)/(Math.min(A, B) + 0.05); };
    const bg = rgb(getComputedStyle(document.getElementById('ownPlot')).backgroundColor);
    const rect = lb && lb.querySelector('rect'), text = lb && lb.querySelector('text');
    return { x: v && P.invX(+v.getAttribute('x1')), y: v && P.invY(+s.querySelectorAll('.plot-cross line')[1].getAttribute('y1')), locked: !!dot,
      hl: [...s.querySelectorAll('.plot-pick-hl')].map(h=> h.tagName === 'g' ? +h.querySelector('circle').getAttribute('stroke-width') : +h.getAttribute('stroke-width')),
      name: lb && lb.textContent, readout: s.querySelector('.plot-readout')?.textContent,
      // the label's box against the background (its fill, else its border), its text against its fill
      boxCon: rect && Math.max(con(rgb(rect.getAttribute('fill')), bg), rect.getAttribute('stroke') ? con(rgb(rect.getAttribute('stroke')), bg) : 0),
      textCon: rect && con(rgb(text.getAttribute('fill')), rgb(rect.getAttribute('fill'))), fill: rect && rect.getAttribute('fill'), i: s._pick && s._pick.i };
  }),
};

test('a sparse line and a scatter: the crosshair on the data point nearest the pointer, hovered, clicked, locked; the arrows step it; the label readable in both themes', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    for (const [theme, color] of [['light', '#ffffff'], ['dark', '#ffffff'], ['light', '#000000'], ['dark', '#000000']]){
      await ownPlot(page, theme, color);
      const what = `${color} on ${theme}`;
      // Near (3, 5), off the segments' interpolated y at the pointer's x: hovered, the
      // crosshair on (3, 5) itself.
      const a = await own.at(page, 3.15, 4.75);
      await page.mouse.move(a.x, a.y);
      let c = await own.cross(page);
      assert.equal(c.name, 'sparse', what + ': hovered');
      assert.deepEqual([+c.x.toFixed(9), +c.y.toFixed(9)], [3, 5], what + ': on the nearest point');
      assert.match(c.readout, /^x = 3\.000 uy = 5\.000$/, what + ': its values read');
      assert.deepEqual(c.hl, [3], what + ': drawn 1.5× as wide, alone');
      assert.ok(c.boxCon >= 3, `${what}: the label's box reads on the background (${c.boxCon.toFixed(2)})`);
      assert.ok(c.textCon >= 4.5, `${what}: its text on its box (${c.textCon.toFixed(2)})`);
      // Clicked: locked on that point; the arrows along the line, to its ends.
      await page.mouse.click(a.x, a.y);
      c = await own.cross(page);
      assert.deepEqual([c.locked, c.i, +c.x.toFixed(9), +c.y.toFixed(9)], [true, 3, 3, 5], what + ': locked on (3, 5)');
      await page.keyboard.press('ArrowRight');
      c = await own.cross(page);
      assert.deepEqual([c.i, +c.x.toFixed(9), +c.y.toFixed(9)], [4, 4, 4], what + ': → (4, 4)');
      for (let k = 0; k < 6; k++) await page.keyboard.press('ArrowRight');
      assert.equal((await own.cross(page)).i, 7, what + ': stops at the last point');
      for (let k = 0; k < 10; k++) await page.keyboard.press('ArrowLeft');
      c = await own.cross(page);
      assert.deepEqual([c.i, +c.x.toFixed(9), +c.y.toFixed(9)], [0, 0, 1], what + ': stops at the first');
      // The pointer moved along: the lock on the point nearest it, (6, 6).
      const b = await own.at(page, 5.8, 6.4);
      await page.mouse.move(b.x, b.y);
      c = await own.cross(page);
      assert.deepEqual([c.i, +c.x.toFixed(9), +c.y.toFixed(9)], [6, 6, 6], what + ': follows the pointer, point by point');
      await page.keyboard.press('Escape');
    }
    // The scatter: hovered near one of its points, the crosshair on that point; the circles' stroke 1.5×.
    const d = await own.at(page, 2.55, 8.9);
    await page.mouse.move(d.x, d.y);
    const c = await own.cross(page);
    assert.equal(c.name, 'Series 2');
    assert.deepEqual([+c.x.toFixed(9), +c.y.toFixed(9), c.hl], [2.5, 9, [1.5]]);
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
