/* A phase's unit cell in 3D in Node, no browser (v564). What it draws (xrd-cell3d-model.js,
   out of v563's cellView): the cell's axes from its lengths and angles, its model (every image
   of an atom in the cell's closed box: eight of one at a corner, two on a face; wrapped into
   the cell, an occupancy capped at 1, an element unknown in pink at 1.5 Å), the radius that
   holds it, a, b and c; a frame's projection (the centre in the middle, the cell inside its
   margin), the edges behind the centre and those in front of it, the spheres back to front
   and their shading, the triad's corner and size, the square's side, the words for a screen
   reader, the view kept (none at home) and put back (a rotation, one near enough put right; a
   mirror, a squashed matrix, eight numbers or none refused). Then the view as a whole
   (xrd-cell3d.js) on page3d.mjs's page, keeping the media queries, the fonts, a clock and the
   classes: phases of every cell set at pixel ratios 1–3 and widths, a side given by the card,
   dragged, turned by keys, double tapped and double clicked, read and put back, exported as a
   PNG, redrawn in the light theme and wider, none, destroyed and used after; each case's calls,
   views, words and classes hashed: golden/cell3d.json, as v563's cellView, one closure then,
   drew them (npm run test:update writes them anew). Under a second. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import * as C from '../xrd-cell3d-model.js';
import { viewAt, DEG } from '../xrd-shape3d-model.js';
import { fakePage, install } from './page3d.mjs';

const UPDATE = !!process.env.UPDATE_GOLDEN || process.env.npm_lifecycle_event === 'test:update';
const GOLDEN = new URL('./golden/cell3d.json', import.meta.url);
const sha = s => createHash('sha256').update(s).digest('hex');
const near = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} against ${b}`);
const CUBIC = { a: 3.905, b: 3.905, c: 3.905, alpha: 90, beta: 90, gamma: 90 };
const HEXA = { a: 3, b: 3, c: 5, alpha: 90, beta: 90, gamma: 120 };
const TRI = { a: 5, b: 6, c: 7, alpha: 80, beta: 100, gamma: 110 };
const SRTIO3 = { name: 'SrTiO3', cell: CUBIC, atoms: [{ element: 'Sr', x: 0, y: 0, z: 0 }, { element: 'Ti', x: 0.5, y: 0.5, z: 0.5 }, { element: 'O', x: 0.5, y: 0.5, z: 0, occ: 0.5 }] };

test('the cell\'s model: its axes, every image of an atom in its box, the radius, a, b and c', ()=>{
  const A = C.axesOf(HEXA);
  near(A[1][0], -1.5, 1e-12, 'b at 120°'); near(Math.hypot(...A[1]), 3, 1e-12, '|b|'); assert.deepEqual(A[0], [3, 0, 0]); near(A[2][2], 5, 1e-12, 'c up');
  const T = C.axesOf(TRI);
  near(Math.hypot(...T[2]), 7, 1e-12, '|c|');
  near(Math.acos((T[1][0]*T[2][0] + T[1][1]*T[2][1] + T[1][2]*T[2][2]) / 42) / DEG, 80, 1e-9, 'α');
  const m = C.buildModel(SRTIO3);
  // a corner atom at all eight corners, one in the body once, one on a face twice
  assert.deepEqual(['Sr', 'Ti', 'O'].map(el => m.balls.filter(b => b.el === el).length), [8, 1, 2]);
  assert.deepEqual(m.balls.find(b => b.el === 'Ti').p, [0, 0, 0], 'about the centre');
  assert.equal(m.corners.length, 8);
  near(m.Rb, Math.hypot(3.905/2, 3.905/2, 3.905/2) + C.BALL*C.RADII.Sr, 1e-12, 'the radius that holds the corner spheres');
  m.axes.forEach((v, i) => v.forEach((x, j) => near(x, i === j ? 1 : 0, 1e-15, 'a, b, c as unit vectors')));
  assert.equal(m.balls.find(b => b.el === 'O').occ, 0.5);
  // wrapped into the cell, a coordinate a hair under 1 taken as 0, the occupancy capped, an
  // element unknown: pink, 1.5 Å; none: X
  const w = C.buildModel({ cell: CUBIC, atoms: [{ element: 'Xx', x: 1.25, y: -0.5, z: 0.9995, occ: 1.7 }, { x: 0.3, y: 0.3, z: 0.3 }] });
  assert.equal(w.balls.length, 3, 'the first on a face (z 0 and 1), the second once');
  assert.deepEqual([w.balls[0].occ, w.balls[0].r, w.balls[0].col, w.balls[2].el], [1, C.BALL*1.5, [255, 102, 204], 'X']);
  assert.equal(C.elementColor('Fe'), '#E06633'); assert.equal(C.elementColor('Zz'), '#ff66cc');
  assert.deepEqual(C.rgb('#E06633'), [224, 102, 51]);
  assert.deepEqual([C.css([100, 200, 250]), C.css([100, 200, 250], 1.25), C.css([100, 200, 250], 0.45)], ['rgb(100,200,250)', 'rgb(125,250,255)', 'rgb(45,90,113)']);
  assert.equal(C.EDGES.length, 12);
  assert.ok(C.EDGES.every(([i, j]) => [1, 2, 4].includes(i ^ j)), 'each edge joins corners one axis apart');
});

test('a frame: the projection, the edges behind and in front, the spheres back to front, the triad, the words', ()=>{
  const m = C.buildModel(SRTIO3), R = C.homeView(), Sz = 260;
  assert.deepEqual(R, viewAt(C.HOME_AZ, C.HOME_EL));
  const { k, P, C: Q } = C.frameOf(m, R, Sz);
  assert.deepEqual(P([0, 0, 0]), [130, 130, 0], 'the centre in the middle');
  near(k, (130 - 14 - 0.04*260)/m.Rb, 1e-12, 'the scale: the radius inside the margin');
  for (const q of Q) assert.ok(Math.hypot(q[0] - 130, q[1] - 130) <= 130 - 24.4 + 1e-9, 'every corner inside');
  // seen along c: the edges along it run through the centre's depth (0), and are in front
  const Z = C.frameOf(m, [1, 0, 0, 0, 1, 0, 0, 0, 1], Sz).C;
  assert.deepEqual(C.edgesOf(Z, false).length, 4, 'the face behind');
  assert.deepEqual(C.edgesOf(Z, true).filter(e => Z[e[0]][2] + Z[e[1]][2] === 0), [[0, 4], [1, 5], [2, 6], [3, 7]]);
  const back = C.edgesOf(Q, false), front = C.edgesOf(Q, true);
  assert.equal(back.length + front.length, 12);
  assert.ok(back.length >= 3 && front.length >= 3);
  for (const e of back) assert.ok(Q[e[0]][2] + Q[e[1]][2] < 0);
  const order = C.ballsInOrder(m, P);
  assert.equal(order.length, 11);
  for (let i = 1; i < order.length; i++) assert.ok(order[i].q[2] >= order[i - 1].q[2], 'back to front');
  const L = C.ballLook({ r: 0.001, occ: 0.5, col: [100, 200, 250] }, [10, 20, 0], 5);
  assert.deepEqual(L, { rr: 1.5, grad: [10 - 0.525, 20 - 0.525, 0.15000000000000002, 10, 20, 1.5], stops: [[0, 'rgb(125,250,255)'], [0.55, 'rgb(100,200,250)'], [1, 'rgb(45,90,113)']], alpha: 0.45 + 0.55*0.5 });
  assert.deepEqual(C.triadOf(300), { at: { x: 270, y: 30, L: 18 }, fs: 12 });
  assert.equal(C.triadOf(279).fs, 11);
  assert.deepEqual([C.sideOf(260.4), C.sideOf(0), C.sideOf(-5), C.sideOf(NaN), C.sideOf(undefined)], [260, 0, 0, 0, 0]);
  assert.equal(C.describeCell(SRTIO3), 'The unit cell of SrTiO3 in 3D: 3 atoms. Drag or use the arrow keys to rotate, Home to reset.');
});

test('the view kept and put back: none at home, a rotation, one near enough put right, the rest refused', ()=>{
  assert.equal(C.viewOf(C.homeView()), null);
  const T = viewAt(0.4, 0.3);
  assert.deepEqual(C.viewOf(T), { R: T });
  assert.deepEqual(C.rotationIn({ R: T }), T);
  assert.deepEqual(C.rotationIn({ R: T.map(String) }), T, 'numbers as strings');
  const N = C.rotationIn({ R: T.map((x, i) => x + (i === 4 ? 2e-5 : 0)) });
  assert.notDeepEqual(N, T); near(N[4], T[4], 1e-4, 'put right');
  for (const bad of [{ R: [1, 0, 0, 0, 1, 0, 0, 0, -1] }, { R: [2, 0, 0, 0, 1, 0, 0, 0, 1] }, { R: [1, 0, 0, 0, 1, 0, 0, 0] }, { R: [1, 0, 0, 0, 1, 0, 0, 0, 'x'] }, { R: T.map((x, i) => i === 0 ? x + 0.01 : x) }, null, {}, { R: 'R' }])
    assert.equal(C.rotationIn(bad), null, JSON.stringify(bad));
});

/* ---- The view as a whole ---- */
const PAGE_O = { media: true, fonts: true, clock: true, classes: true };
// The shape's colour cache (xrd-shape3d.js readTheme, which the cell's theme is read with)
// made first on a page of its own, so that no case's log depends on the cases before it.
function warmTheme(readTheme){ const page = fakePage(); install(page, 1); readTheme(page.document.createElement('div')); }
const FE2O3 = { name: 'Fe2O3 <a>', cell: HEXA, atoms: [{ element: 'Fe', x: 0, y: 0, z: 0.355 }, { element: 'O', x: 0.306, y: 0, z: 0.25 }, { element: 'Fe', x: 1, y: 1, z: 0 }] };
const TRIP = { name: 'tri', cell: TRI, atoms: [{ element: 'La', x: 0.1, y: 0.2, z: 0.3, occ: 0.4 }, { element: 'Cu', x: 0, y: 0.5, z: 0 }, { element: 'H', x: 0.9, y: 0.9, z: 0.9 }] };
const turn = (a, b) => { const c = Math.cos(a), s = Math.sin(a), c2 = Math.cos(b), s2 = Math.sin(b); return [c, -s, 0, s*c2, c*c2, -s2, s*s2, c*s2, c2]; };
export async function viewCase({ cellView, readTheme }, name){
  warmTheme(readTheme);
  const page = fakePage(PAGE_O), perf = globalThis.performance;
  install(page, { draw: 2, side: 3 }[name] || 1, PAGE_O);
  try {
    const box = page.document.createElement('div');
    box.clientWidth = name === 'side' ? 0 : 316;
    if (name === 'draw') box.bg = { dark: '#20262b', light: '#f1f3f4' };
    let side = 240;
    const view = name === 'side' ? cellView(box, { side: () => side }) : cellView(box);
    const canvas = box.kids[0], out = [];
    const say = what => out.push([what, JSON.stringify(view.getView()), canvas.getAttribute('aria-label'), [...canvas.classes].join(), canvas.hidden, canvas.style.display, canvas.style.width, canvas.parentElement ? 'in' : 'out', page.frames.length].join(' | '));
    const drag = (x, y, dx, dy, o = {}) => { canvas.fire('pointerdown', { clientX: x, clientY: y, ...o }); canvas.fire('pointermove', { clientX: x + dx/2, clientY: y + dy/2, ...o }); canvas.fire('pointermove', { clientX: x + dx, clientY: y + dy, ...o }); canvas.fire('pointerup', { clientX: x + dx, clientY: y + dy, ...o }); };
    const tap = (x, y, type = 'touch') => { canvas.fire('pointerdown', { pointerId: 4, pointerType: type, clientX: x, clientY: y }); canvas.fire('pointerup', { pointerId: 4, pointerType: type, clientX: x, clientY: y }); };
    if (name === 'draw'){
      view.set(SRTIO3); say('set'); drag(100, 100, 37, -10); page.flush(); say('dragged');
      canvas.fire('keydown', { key: 'ArrowRight' }); canvas.fire('keydown', { key: 'ArrowUp', shiftKey: true }); page.flush(); say('keys');
      out.push('png ' + view.png());
      page.setTheme('light'); page.flush(); say('light');
      box.clientWidth = 216; page.resize(); page.flush(); say('narrower');
      view.set(FE2O3); say('another'); view.set(TRIP); page.flush(); say('a third'); out.push('png ' + view.png());
      view.set(null); say('none'); out.push('png ' + view.png()); view.set(TRIP); say('back');
    } else if (name === 'side'){
      view.set(FE2O3); say('given by its card'); side = 301.6; view.redraw(); page.flush(); say('larger');
      side = 0; view.redraw(); page.flush(); say('none given: kept');
      out.push('png ' + view.png());
    } else if (name === 'taps'){
      view.set(TRIP); canvas.fire('keydown', { key: 'ArrowLeft' }); page.flush(); say('turned');
      tap(50, 50); page.advance(200); tap(60, 70); page.flush(); say('double tap: home');
      canvas.fire('keydown', { key: 'ArrowDown' }); tap(50, 50); page.advance(400); tap(50, 50); page.advance(100); tap(90, 50); page.flush(); say('slow, far: kept');
      tap(10, 10, 'pen'); page.advance(50); tap(12, 12, 'pen'); page.flush(); say('pen: home');
      canvas.fire('keydown', { key: 'ArrowRight' }); tap(5, 5, 'mouse'); tap(5, 5, 'mouse'); page.flush(); say('mouse: kept');
      canvas.fire('dblclick'); page.flush(); say('double click: home');
    } else if (name === 'pointers'){
      view.set(SRTIO3); page.flush();
      canvas.fire('pointerdown', { button: 2 }); canvas.fire('pointermove', { clientX: 40 }); say('the other button');
      canvas.fire('pointerdown', { pointerId: 1, pointerType: 'touch', clientX: 10, clientY: 10 }); canvas.fire('pointerdown', { pointerId: 2, pointerType: 'touch' });
      canvas.fire('pointermove', { pointerId: 2, clientX: 90 }); canvas.fire('pointermove', { pointerId: 1, clientX: 12, clientY: 11 }); page.flush(); say('a small move');
      canvas.fire('pointermove', { pointerId: 1, clientX: 60, clientY: 30 }); page.flush(); say('dragging');
      canvas.fire('pointercancel', { pointerId: 1 }); say('cancelled');
      canvas.fire('pointerdown', { pointerId: 3 }); canvas.fire('lostpointercapture', { pointerId: 3 }); say('capture lost');
      for (const m of ['altKey', 'ctrlKey', 'metaKey']) canvas.fire('keydown', { key: 'ArrowUp', [m]: true });
      canvas.fire('keydown', { key: 'a' }); page.flush(); say('keys not its own');
      canvas.fire('keydown', { key: 'Home' }); page.flush(); say('home');
    } else if (name === 'views'){
      canvas.fire('keydown', { key: 'ArrowLeft' }); canvas.fire('dblclick');
      out.push('setView ' + view.setView({ R: turn(1, 0.5) })); say('no phase');
      view.set(SRTIO3); page.flush(); say('home: none');
      for (const v of [{ R: turn(1, 0.5) }, { R: turn(0.7, 0.3).map((x, i) => x + (i === 4 ? 2e-5 : 0)) }, { R: [1, 0, 0, 0, 1, 0, 0, 0, -1] }, { R: [1, 2, 3] }, null, { R: turn(0.2, 0.1).map(String) }, { R: [1, 0, 0, 0, 1, 0, 0, 0, 1] }]){
        out.push('setView ' + view.setView(v)); page.flush(); say('put');
      }
      view.set({ ...SRTIO3 }); page.flush(); say('the same name: kept');
      view.set({ ...SRTIO3, name: 'other' }); page.flush(); say('another name: home');
    } else if (name === 'destroy'){
      view.set(FE2O3); page.flush(); canvas.fire('keydown', { key: 'ArrowUp' });
      view.destroy(); say('destroyed'); page.flush();
      view.set(SRTIO3); out.push('setView ' + view.setView({ R: turn(0.2, 0.2) }), 'png ' + view.png()); view.redraw(); view.destroy();
      canvas.fire('keydown', { key: 'Home' }); page.setTheme('light'); page.resize(); page.flush(); say('after');
    }
    view.destroy();
    return { digest: sha(page.log.join('\n') + '\n' + out.join('\n')), calls: page.log.length, steps: out.length };
  } finally { Object.defineProperty(globalThis, 'performance', { value: perf, configurable: true, writable: true }); }
}
export const VIEW_CASES = ['draw', 'side', 'taps', 'pointers', 'views', 'destroy'];

test('the view, case by case, as v563\'s cellView drew it (golden digests)', async ()=>{
  const { cellView } = await import('../xrd-cell3d.js'), { readTheme } = await import('../xrd-shape3d.js');
  const got = { views: {} };
  for (const n of VIEW_CASES) got.views[n] = await viewCase({ cellView, readTheme }, n);
  for (const n of VIEW_CASES) assert.ok(got.views[n].calls > 300, n + ': drawn');
  if (UPDATE){ fs.writeFileSync(GOLDEN, JSON.stringify(got, null, 1) + '\n'); return; }
  const want = JSON.parse(fs.readFileSync(GOLDEN, 'utf8'));
  assert.deepEqual(Object.keys(got.views), Object.keys(want.views));
  for (const n of VIEW_CASES) assert.deepEqual(got.views[n], want.views[n], n);
});
