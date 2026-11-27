/* The crystallites' shape in 3D in Node, no browser (v554). Its calculations
   (xrd-shape3d-model.js, out of v553's shapeView): the rotations, a drag and a key, the camera
   saved and read back; the body frame and each solid's model (the extents, the endless ones,
   the mesh closed and convex, its creases); the exact ray test, the fade, the home view, the
   directions and their cones; a frame (the projection, the shading, the fade mask, the lines
   cut where the solid hides them, the cones split, the edges drawn and hidden); the labels
   (the words, the bars over minus signs, the places, kept from frame to frame); the colours,
   the theme, the canvas's size and the words for a screen reader. Then the view as a whole
   (xrd-shape3d.js) on a page as small as it needs (fakePage: elements, a computed style with
   the theme's tokens, the observers, the frames run by hand, and canvases that record every
   call and property set, every number by its shortest round-trip string, measureText a fixed
   width a character): solids of every type (plates, needles, a sheet, rods, blocks, every
   direction's case) set, dragged, turned by keys, put back by setView, exported as a PNG,
   redrawn in the light theme and wider; each case's calls, its getView and its words hashed,
   as v553's shapeView, one function then, drew them: their digests are
   tests/golden/shape3d.json, which npm run test:update writes anew after a change meant to
   alter the drawing. Under 2 s. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as M from '../xrd-shape3d-model.js';
import { fakePage, install } from './page3d.mjs';

const UPDATE = !!process.env.UPDATE_GOLDEN || process.env.npm_lifecycle_event === 'test:update';
const GOLDEN = path.join(path.dirname(fileURLToPath(import.meta.url)), 'golden', 'shape3d.json');
const sha = s => createHash('sha256').update(s).digest('hex');

/* ---- The solids: as the worker sends them (xrd-rietveld.worker.js summarise) ---- */
const r2 = Math.SQRT1_2;
const I3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
const HEX = [[1, 0, 0], [-0.5, Math.sqrt(3) / 2, 0], [0, 0, 1]];
const ROT = (() => { const c = Math.cos(0.4), s = Math.sin(0.4), c2 = Math.cos(0.3), s2 = Math.sin(0.3);
  return [[c, s, 0], [-s * c2, c * c2, s2], [s * s2, -c * s2, c2]]; })();
const SOLIDS = {
  ellipsoid: { type: 'ellipsoid', dims: [8, 5, 3], frame: I3, cell: I3, caption: 'ellipsoid 8 × 5 × 3 nm',
    dirs: [{ label: '[100]', vec: [1, 0, 0], axis: [1, 0, 0], esd: 3.2, off: 0 }, { label: '[010]', vec: [0, 1, 0], axis: [0.05, 0.998, 0.01], esd: 12, off: 2.9 }, { label: '[001]', vec: [0, 0, 1], axis: [0, 0, 1], esd: NaN, off: 0 }] },
  plate: { type: 'spheroid', dims: [20, null, 3], frame: [[r2, r2, 0], [-r2, r2, 0], [0, 0, 1]], cell: I3,
    dirs: [{ label: '[001]', vec: [0, 0, 1], axis: [0, 0, 1], esd: 4, off: 0 }, { label: '[110]', vec: [1, 1, 0], esd: NaN, off: NaN, about: true }, { label: '[1-10]', vec: [1, -1, 0], esd: NaN, off: NaN, about: true }] },
  disc: { type: 'spheroid', dims: [30, 30, 1.2], frame: I3, cell: HEX, caption: 'a disc',
    dirs: [{ label: '[001]', vec: [0, 0, 1], axis: [0, 0, 1], esd: 18, off: 0 }, { label: '[100]', vec: [1, 0, 0], about: true }] },
  needle: { type: 'cylinder', dims: [3, null, 200], frame: I3, cell: I3, caption: 'needle',
    dirs: [{ label: '[001]', vec: [0, 0, 1], axis: [0, 0, 1], esd: 1.5, off: 0 }, { label: '[100]', vec: [1, 0, 0], about: true }] },
  sheet: { type: 'cylinder', dims: [2e5, 2e5, 3], frame: I3, cell: I3,
    dirs: [{ label: '[001]', vec: [0, 0, 1], axis: [0.1, 0, 0.995], esd: 25, off: 5.7 }, { label: '[1-10]', vec: [1, -1, 0], about: true }] },
  rod: { type: 'sqbox', dims: [4, 4, NaN], frame: ROT, cell: I3,
    dirs: [{ label: '[001]', vec: [0, 0, 1], axis: [0.07, 0.02, 0.997], esd: 6, off: 4.2 }, { label: '[100]', vec: [1, 0, 0], esd: 40, off: 0 }] },
  box: { type: 'box', dims: [8, 5, 3], frame: ROT, cell: HEX, caption: 'box 8 × 5 × 3 nm',
    dirs: [{ label: '[1-10]', vec: [1, -1, 0], axis: [r2, -r2, 0], esd: 2, off: 0 }, { label: '[1 -10 0]', vec: [0.1, 0.995, 0], esd: 7, off: 1 }, { label: '[-1-1-1]', vec: [-1, -1, -1], esd: NaN, off: NaN }] },
  ellcyl: { type: 'ellcyl', dims: [10, 4, 30], frame: [[0, 1, 0], [0, 0, 1], [1, 0, 0]], cell: I3,
    dirs: [{ label: '[010]', vec: [0, 1, 0], axis: [0.14, 0.99, 0], esd: 20, off: 8 }, { label: '(001)', vec: [0, 0, 1], axis: [0, 0.2, 0.98], esd: 33, off: 11 }, { label: '<100>', vec: [1, 0, 0], axis: [-1, 0, 0], esd: 9, off: 0.03 }] },
  boxsheet: { type: 'box', dims: [100, 90, 2], frame: I3, cell: null, dirs: [{ label: '[001]', vec: [0, 0, 1], esd: 3, off: 0 }] },
  boxrod: { type: 'box', dims: [3, 4, 500], frame: I3, cell: I3,
    dirs: [{ label: '[001]', vec: [0, 0, 1], esd: 0.5, off: 0 }, { label: '[100]', vec: [1, 0, 0], esd: 15, off: 0 }, { label: '[010]', vec: [0, 1, 0], esd: 15, off: 0 }] },
  degenerate: { type: 'foo', dims: [NaN, NaN, NaN], frame: [[0, 0, 0], [0, 1, 0], [1, 0, 0]], cell: [[1, 0, 0]],
    dirs: [{ label: 'x', vec: [1, 2, 'a'] }, null, { label: '[111]', vec: [1, 1, 1], esd: 0, off: 0.01 }, { label: '[100]', vec: [1, 0, 0], esd: 70 }, { vec: [0, 0, 0] }] },
  five: { type: 'ellipsoid', dims: [6, 6.5, 7], frame: [[1, 0, 0], [0, 1, 0], [0, 0, -1]], cell: I3,
    dirs: [{ label: '[100]', vec: [1, 0, 0], esd: 5 }, { label: '[010]', vec: [0, 1, 0], esd: 5 }, { label: '[001]', vec: [0, 0, 1], esd: 5 },
      { label: '[111]', vec: [1, 1, 1], esd: 9, off: 2 }, { label: '[1-11] a long direction label that will not fit', vec: [1, -1, 1], esd: NaN }] },
  noframe: { type: 'cylinder', dims: ['7', '', 12], dirs: [{ label: '[0-01]', vec: [0, 0, -1], esd: '3', off: '0.2' }, { label: 123, vec: [1, 1, 0], about: 1 }] },
};

/* ---- The calculations ---- */
const near = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} against ${b}`);
const rows = R => [R.slice(0, 3), R.slice(3, 6), R.slice(6, 9)];
function isRotation(R, tol, what){
  const [x, y, z] = rows(R);
  [[x, x, 1], [y, y, 1], [z, z, 1], [x, y, 0], [y, z, 0], [x, z, 0]].forEach(([a, b, v], i) => near(M.dot(a, b), v, tol, `${what}: ${i}`));
  near(M.dot(M.cross(x, y), z), 1, tol, what + ': right-handed');
}
// The angle (°) a rotation T turns from R.
const angleBetween = (R, T) => { const D = M.matMul(T, [R[0], R[3], R[6], R[1], R[4], R[7], R[2], R[5], R[8]]); return Math.acos(Math.min(1, (D[0] + D[4] + D[8] - 1) / 2)) / M.DEG; };

test('the rotations: the home view, a drag, a key, put back to orthonormal, the camera saved and read back', ()=>{
  const R = M.viewAt(M.HOME_AZ, M.HOME_EL);
  isRotation(R, 1e-15, 'home');
  near(R[2], 0, 1e-15, 'the screen\'s right is level');
  assert.ok(R[5] > 0, 'body z up');
  near(Math.asin(R[8]) / M.DEG, 24, 1e-12, 'the elevation');
  // a drag of a third of the side turns 0.4π, about the axis normal to it
  const T = M.turned(R, 100, 0, 300);
  isRotation(T, 1e-14, 'turned');
  near(angleBetween(R, T), 72, 1e-9, 'a third of the side');
  assert.equal(M.turned(R, 0, 0, 300), null, 'no move, no turn');
  near(angleBetween(R, M.turned(R, 0, 26, 0)), 21.6, 1e-9, 'no side yet: 260 px');
  // a key: 10°, Shift 2°; anything else nothing
  for (const [key, shift, deg] of [['ArrowLeft', false, 10], ['ArrowDown', true, 2]]){
    const mv = M.keyTurn(key, shift, 250);
    near(angleBetween(R, M.turned(R, mv[0], mv[1], 250)), deg, 1e-9, key);
  }
  assert.equal(M.keyTurn('Home', false, 250), null);
  assert.deepEqual(M.keyTurn('ArrowUp', false, 250).map(Math.sign), [0, -1]);
  // a thousand small drags creep off orthonormal without reortho: it puts them back
  let D = R;
  for (let i = 0; i < 1000; i++) D = M.turned(D, 1.3, -0.7, 280);
  isRotation(D, 1e-13, 'after 1000 drags');
  isRotation(M.reortho(R.map((x, i) => x + (i % 4 ? 1e-4 : -1e-4))), 1e-15, 'reortho');
  // a double tap: within 350 ms and 24 px of the last
  assert.equal(M.doubleTap({ t: 0, x: 10, y: 10 }, 349, 20, 30), true);
  assert.equal(M.doubleTap({ t: 0, x: 10, y: 10 }, 351, 10, 10), false);
  assert.equal(M.doubleTap({ t: 0, x: 10, y: 10 }, 100, 40, 10), false);
  assert.equal(M.doubleTap(null, 100, 10, 10), false);
  // the camera, as JSON, read back the same; the labels' places with it
  const st = JSON.parse(JSON.stringify(M.viewState(T, new Map([[0, [3.5, -4]], [2, [-20, 8]]]))));
  assert.deepEqual(st, { v: 1, R: T, labels: [[0, 3.5, -4], [2, -20, 8]] });
  assert.deepEqual(M.viewFromState(st), { R: T, labels: [[0, [3.5, -4]], [2, [-20, 8]]] });
  // a mirror, a squashed matrix, ten numbers, no number: not a view
  for (const bad of [{ R: [1, 0, 0, 0, 1, 0, 0, 0, -1] }, { R: [2, 0, 0, 0, 1, 0, 0, 0, 1] }, { R: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0] }, { R: [1, 0, 0, 0, 1, 0, 0, 0, 'x'] }, null, {}])
    assert.equal(M.viewFromState(bad), null, JSON.stringify(bad));
  // near a rotation: put right; a label that is no [slot, x, y] left out; numbers as strings taken
  const v = M.viewFromState({ R: T.map((x, i) => x + (i === 4 ? 2e-5 : 0)), labels: [[1, 'a', 3], [0, 1, 2], [2, 1, 2, 3], 'x'] });
  isRotation(v.R, 1e-15, 'put right');
  assert.ok(angleBetween(T, v.R) < 0.01);
  assert.deepEqual(v.labels, [[0, [1, 2]]]);
  assert.deepEqual(M.viewFromState({ R: ['1', 0, 0, 0, '1', 0, 0, 0, 1] }).R, [1, 0, 0, 0, 1, 0, 0, 0, 1]);
});

test('the body frame and each solid\'s model: the extents, the endless ones, the mesh closed and convex', ()=>{
  // z is x × y: a left-handed frame mirrored back; a missing y from z; nothing: the identity
  assert.deepEqual(M.bodyFrame([[1, 0, 0], [0, 1, 0], [0, 0, -1]]), I3);
  assert.deepEqual(M.bodyFrame([[2, 0, 0], null, [0, 0, 3]]), I3);
  assert.deepEqual(M.bodyFrame(undefined), I3);
  const F = M.bodyFrame(ROT);
  isRotation(F.flat(), 1e-15, 'a frame');
  const solids = [
    // [solid, A (the half extents drawn), open, V, F, E, creases]
    [SOLIDS.ellipsoid, [4, 2.5, 1.5], [false, false, false], 1082, 1120, 2200, 0],
    [SOLIDS.box, [4, 2.5, 1.5], [false, false, false], 8, 6, 12, 12],
    [{ type: 'cylinder', dims: [6, null, 9] }, [3, 3, 4.5], [false, false, false], 114, 168, 280, 112],
    // a needle 200 nm long and 3 across: endless, drawn 20 times the diameter, no caps
    [SOLIDS.needle, [1.5, 1.5, 30], [false, false, true], 1064, 1008, 2072, 112],
    // a sheet: both wide extents endless, against the smallest (not against each other)
    [SOLIDS.sheet, [30, 30, 1.5], [true, true, false], 1122, 1176, 2296, 112],
    [SOLIDS.rod, [2, 2, 40], [false, false, true], 68, 64, 132, 72],
    // no size known: a unit sphere, nothing endless
    [SOLIDS.degenerate, [0.5, 0.5, 0.5], [false, false, false], 1082, 1120, 2200, 0],
  ];
  for (const [s, A, open, nV, nF, nE, nC] of solids){
    const m = M.buildModel(s), { V, F: faces, edges, vf } = m.mesh, what = s.type + ' ' + JSON.stringify(s.dims);
    assert.deepEqual([m.A, m.open, V.length, faces.length, edges.length, edges.filter(e => e.crease).length], [A, open, nV, nF, nE, nC], what);
    // closed (every edge has two faces, Euler's 2) unless an end is open; every normal outward and of unit length
    if (!open.some(Boolean)){ assert.ok(edges.every(e => e.f2 >= 0), what + ': closed'); assert.equal(nV - nE + nF, 2); }
    for (const f of faces){ near(Math.hypot(...f.n), 1, 1e-12, what); assert.ok(M.dot(f.n, f.v.map(i => V[i]).reduce((c, p) => c.map((x, k) => x + p[k]), [0, 0, 0])) > 0, what + ': outward'); }
    // fading only towards an open end
    assert.equal(vf.every(f => f === 1), !open.some(Boolean), what + ': the fade');
  }
  assert.equal(M.buildModel(SOLIDS.degenerate).type, 'ellipsoid', 'a type unknown: an ellipsoid');
  assert.equal(M.buildModel(SOLIDS.degenerate).known, false);
  assert.deepEqual(M.buildModel(SOLIDS.plate).raw, [20, 20, 3], 'a spheroid\'s missing Dy is Dx');
  assert.deepEqual(M.buildModel(SOLIDS.noframe).raw, [7, 7, 12], 'numbers as strings; a missing Dy');
});

test('the exact ray test, the fade, the home view, the directions and their cones', ()=>{
  const ell = M.buildModel(SOLIDS.ellipsoid), box = M.buildModel(SOLIDS.box), cyl = M.buildModel({ type: 'cylinder', dims: [6, 6, 9] });
  assert.equal(M.rayExit(ell, 0, 0, 0, 1, 0, 0), 4);
  assert.equal(M.rayExit(ell, 0, 0, 0, 0, 0, -1), 1.5);
  assert.ok(Number.isNaN(M.rayExit(ell, 0, 5, 0, 1, 0, 0)), 'a miss');
  near(M.rayExit(box, 0, 0, 0, 1 / Math.sqrt(3), 1 / Math.sqrt(3), 1 / Math.sqrt(3)), 1.5 * Math.sqrt(3), 1e-12, 'the box: its nearest slab');
  assert.equal(M.rayExit(box, -10, 0, 0, 1, 0, 0), 14, 'from outside: where it leaves');
  assert.equal(M.rayExit(cyl, 0, 0, 0, 0, 0, 1), 4.5, 'along the axis: the cap');
  assert.ok(Number.isNaN(M.rayExit(cyl, 4, 0, 0, 0, 0, 1)), 'along the axis, outside');
  assert.equal(M.rayExit(cyl, 0, 0, 0, 1, 0, 0), 3, 'across: the wall');
  // the fade: whole to 45 % of an open half extent, gone at its end
  const ndl = M.buildModel(SOLIDS.needle);
  assert.deepEqual([0, 0.45 * 30, 30].map(z => M.fadeOf(ndl, 0, 0, z)), [1, 1, 0]);
  near(M.fadeOf(ndl, 0, 0, 0.725 * 30), 0.5, 1e-12, 'half way');
  assert.equal(M.fadeOf(ell, 4, 0, 0), 1, 'a closed solid does not fade');
  // the home view: every pair of directions 12° apart on the screen, none end-on
  for (const n of ['ellipsoid', 'plate', 'box', 'ellcyl', 'boxrod']){
    const m = M.buildModel(SOLIDS[n]), R = m.home;
    const s2 = m.dirs.map(d => [M.dot(R.slice(0, 3), d.u), M.dot(R.slice(3, 6), d.u)]);
    s2.forEach((a, i) => { assert.ok(Math.hypot(...a) > 0.25, n + ': not end-on');
      s2.slice(i + 1).forEach(b => assert.ok(Math.acos(Math.abs(a[0]*b[0] + a[1]*b[1]) / Math.hypot(...a) / Math.hypot(...b)) / M.DEG >= 12, n + ': apart')); });
  }
  // the directions: determined, on the axis or off it, about it, not determined; a bad one left out, its slot kept
  const m = M.buildModel(SOLIDS.ellcyl);
  assert.deepEqual(m.dirs.map(d => [d.slot, d.det, d.esd, d.off, d.about]), [[0, true, 20, 8, false], [1, true, 33, 11, false], [2, true, 9, 0.03, false]]);
  for (const d of m.dirs){
    assert.ok(d.L >= 0.62 * m.Rs && d.L >= d.t + 0.28 * m.Rs - 1e-12, 'out past the surface');
    near(d.t, M.rayExit(m, 0, 0, 0, ...d.u), 0, 'where it leaves the solid');
    assert.ok(M.dot(d.ax, d.u) > 0, 'the cone\'s axis on the arrow\'s side');
    assert.equal(d.cones.length, 2, 'a cone at each end');
    for (const cn of d.cones){ assert.equal(cn.patches.length, 8 * 16); assert.equal(cn.corners.length, 9 * 16);
      near(Math.acos(M.dot(M.unit(cn.at(1, 0.3)), M.unit(cn.c))) / M.DEG, d.esd, 1e-9, 'the cone\'s half angle: the esd'); }
  }
  const dg = M.buildModel(SOLIDS.degenerate);
  assert.deepEqual(dg.dirs.map(d => [d.slot, d.det, d.cones.length]), [[2, true, 0], [3, false, 0]], 'no vector, no direction; an esd of 0: no cone; over 60°: not determined');
  assert.equal(dg.cell, null, 'a cell of one axis: no triad');
  assert.deepEqual(M.buildModel(SOLIDS.plate).dirs.map(d => d.about), [false, true, true]);
  assert.deepEqual(M.solidKey(m, SOLIDS.ellcyl), JSON.stringify(['ellcyl', [10, 4, 30], SOLIDS.ellcyl.frame, SOLIDS.ellcyl.cell]));
});

test('a frame: the projection, the shading, the fade mask, the lines cut where the solid hides them, the cones, the edges', ()=>{
  const box = M.buildModel(SOLIDS.box), pj = M.projection(box, box.home, 300, 260);
  assert.deepEqual(pj.P([0, 0, 0]), [150, 130, 0], 'the centre');
  near(pj.k, (130 - 32) / box.Rb, 1e-15, 'the solid and its arrows fit the shorter side');
  // a box from a general view: three faces, nine edges in front, three hidden
  const front = M.frontFaces(box.mesh.F, pj.r2);
  assert.equal(front.filter(Boolean).length, 3);
  assert.deepEqual([false, true].map(h => M.edgeLists(box.mesh, front, h).lines.length), [9, 3]);
  // the shading: the front faces each at one of 96 steps
  const steps = M.shadeSteps(box.mesh.F, front, pj);
  assert.equal([...steps.values()].flat().length, 3);
  assert.ok([...steps.keys()].every(lv => lv >= 0 && lv <= 96));
  assert.equal(M.shadeColour([200, 100, 50, 1], 96), 'rgb(212,106,53)');
  // the lines: each cut into runs over [-L, L] with no gap, the middle hidden (inside), the tips not
  const { runs, heads } = M.dirLines(box, pj, ['a', 'b', 'c']);
  for (const d of box.dirs){
    const own = runs.filter(r => r.d === d).sort((x, y) => x.a - y.a);
    assert.equal(own[0].a, -d.L); assert.equal(own[own.length - 1].b, d.L);
    own.slice(1).forEach((r, i) => assert.equal(r.a, own[i].b));
    assert.equal(own.find(r => r.a < 0 && r.b > 0).hid, true, 'through the solid: hidden');
  }
  assert.ok(runs.every((r, i) => !i || runs[i - 1].z <= r.z), 'back to front');
  assert.deepEqual(heads.map(h => [h.col, h.hid]), [['a', false], ['b', false], ['c', true]], '[-1-1-1]\'s tip behind the box');
  assert.equal(M.arrowHead({ tip: [10, 10], base: [9, 9] }), null, 'end-on: a dot');
  assert.deepEqual(M.arrowHead({ tip: [10, 10], base: [0, 10] }), [[12, 10], [1, 6], [1, 14]]);
  // the cones: through the surface, cut into a hidden part and a visible one; the farther first
  const ell = M.buildModel(SOLIDS.ellcyl), pe = M.projection(ell, ell.home, 300, 300), parts = new Map();
  for (const d of ell.dirs) for (const cn of d.cones) parts.set(cn, M.splitCone(cn, pe, false));
  for (const [cn, { out, rim }] of parts){
    assert.ok(out[0].length && out[1].length, 'hidden and visible');
    assert.ok(out.flat().every(p => p.length >= 3));
    // the rim: once round, each run the other side of the solid from the last
    assert.deepEqual([rim[0].pts[0], rim[rim.length - 1].pts.at(-1)], [pe.P(cn.at(1, 0)), pe.P(cn.at(1, 2*Math.PI))]);
    assert.ok(rim.every((r, i) => r.pts.length >= 2 && (!i || r.hid !== rim[i - 1].hid)));
  }
  for (const hid of [true, false]){
    const { groups, box: b } = M.coneGroups(ell, parts, hid, pe, ['a', 'b', 'c'], 1.5, 300, 300);
    assert.equal(groups.length, 6);
    assert.ok(groups.every((g, i) => !i || groups[i - 1].z <= g.z));
    assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.w <= 300 && b.y + b.h <= 300);
  }
  // fast: fewer pieces
  const cn0 = ell.dirs[0].cones[0];
  assert.ok(M.splitCone(cn0, pe, true).out.flat().length < parts.get(cn0).out.flat().length);
  // the fade mask: none for a closed solid; a needle's whole in its middle, gone past its ends
  assert.equal(M.fadeMask(box, pj, M.solidBox(box.mesh.V.map(pj.P), 1, 300, 260), false), null);
  const ndl = M.buildModel(SOLIDS.needle), pn = M.projection(ndl, [0, 0, 1, 0, 1, 0, -1, 0, 0], 300, 300);   // side on, its axis across
  for (const fast of [false, true]){
    const sb = M.solidBox(ndl.mesh.V.map(pn.P), 2, 300, 300), fm = M.fadeMask(ndl, pn, sb, fast);
    assert.equal(fm.cs, fast ? 6 : 3);
    assert.equal(fm.px.length, 4 * fm.Mw * fm.Mh);
    const alpha = (x, y) => fm.px[4 * ((Math.floor(y / fm.cs) - fm.j0) * fm.Mw + Math.floor(x / fm.cs) - fm.i0) + 3];
    assert.equal(alpha(150, 150), 255, 'the middle');
    assert.ok(alpha(sb.x + fm.cs, 150) < 40, 'the far end: ' + alpha(sb.x + fm.cs, 150));
  }
  // a snapped box: whole pixels of the layer, on it
  assert.deepEqual(M.snap(-3.2, 10.26, 50.01, 400, 2, 300, 200), { x: 0, y: 10, w: 50.5, h: 190 });
  // polygons into one path, all wound one way: a clockwise one turned round, a flat one left out
  const calls = [], sink = { moveTo: (x, y) => calls.push(['M', x, y]), lineTo: (x, y) => calls.push(['L', x, y]) };
  M.addPoly(sink, [[0, 0], [0, 1], [1, 1], [1, 0]]);
  M.addPoly(sink, [[0, 0], [1, 1], [2, 2]]);
  assert.deepEqual(calls, [['M', 1, 0], ['L', 1, 1], ['L', 0, 1], ['L', 0, 0]]);
});

test('the labels: the words, the bars over minus signs, the places kept from frame to frame', ()=>{
  assert.deepEqual(M.millerRuns('[1-10]'), [{ s: '[1', bar: false }, { s: '1', bar: true }, { s: '0]', bar: false }]);
  assert.deepEqual(M.millerRuns('[1 -10 0]'), [{ s: '[1 ', bar: false }, { s: '10', bar: true }, { s: ' 0]', bar: false }]);
  assert.deepEqual(M.millerRuns('(-1-1-1)').map(r => r.bar), [false, true, true, true, false]);
  assert.deepEqual(M.millerRuns('a-1'), [{ s: 'a-1', bar: false }], 'not indices');
  const m = M.buildModel(SOLIDS.ellipsoid), words = m.dirs.map(d => { const t = M.labelTexts(d); return [t.runsL.map(r => r.s).join(''), t.tail, t.sub]; });
  assert.deepEqual(words, [['[100]', ' ±3.2°', ''], ['[010]', '', 'axis 2.9° off, ±12°'], ['[001]', ' not determined', '']]);
  assert.deepEqual(M.labelTexts(M.buildModel(SOLIDS.plate).dirs[1]).sub, 'free about the axis');
  // placed: on the canvas, clear of each other; placed again from where they sat, the same places
  const pj = M.projection(m, m.home, 300, 300), { heads } = M.dirLines(m, pj, ['a', 'b', 'c']);
  const { f1, f2, bar, triad, fixed } = M.marksOf(m, pj, 300, 300);
  assert.deepEqual([f1, f2, triad, fixed.length], [12, 10.5, { x: 270, y: 30, L: 18 }, 2]);
  assert.ok([1, 2, 5].includes(bar.nm) && bar.px > 0.1 * 300 && bar.px < 0.5 * 300 && bar.text === bar.nm + ' nm', JSON.stringify(bar));
  const dg = M.buildModel(SOLIDS.degenerate), dm = M.marksOf(dg, M.projection(dg, dg.home, 200, 250), 200, 250);
  assert.deepEqual([dm.f1, dm.bar, dm.triad, dm.fixed], [11, null, null, []], 'no size known, no scale bar; no cell, no triad');
  const items = () => heads.map(h => { const t = M.labelTexts(h.d); t.runsL.forEach(r => { r.w = 7 * r.s.length; }); return M.labelItem(h, t, 6 * t.tail.length, 5 * t.sub.length, f1, f2, pj); });
  const first = items();
  M.placeLabels(first, M.labelObstacles(heads), fixed, 300, 300, new Map());
  const box = it => [it.x, it.y, it.x + it.w, it.y + it.hgt];
  for (const it of first){
    const [x0, y0, x1, y1] = box(it);
    assert.ok(x0 >= 3 && y0 >= 3 && x1 <= 297 && y1 <= 297, 'on the canvas');
    for (const o of first) if (o !== it){ const [a0, b0, a1, b1] = box(o); assert.ok(x1 <= a0 || a1 <= x0 || y1 <= b0 || b1 <= y0, 'clear of each other'); }
  }
  const was = new Map(first.map(it => [it.slot, M.labelOffset(it)])), again = items();
  M.placeLabels(again, M.labelObstacles(heads), fixed, 300, 300, was);
  assert.deepEqual(again.map(it => [it.x, it.y]), first.map(it => [it.x, it.y]), 'the same places again');
  // nowhere on the canvas at all: straight out from its tip, clamped (one wider than the
  // canvas has its right end on it, its start off it)
  const wide = [{ slot: 0, w: 400, hgt: 14, tip: [150, 150], out: [0, 1] }, { slot: 1, w: 60, hgt: 300, tip: [150, 150], out: [1, 0] }];
  M.placeLabels(wide, [], [], 300, 300, null);
  assert.deepEqual(wide.map(it => [it.x, it.y]), [[-103, 152], [129, -3]]);
  assert.deepEqual([{ x: 0, w: 40, tip: [50] }, { x: 60, w: 40, tip: [50] }, { x: 30, w: 40, tip: [50] }].map(M.labelAlign), [1, 0, 0.5]);
});

test('the colours, the theme, the canvas\'s size, the words for a screen reader', ()=>{
  // the directions' colours: those far from the solid's hue first (the amber solid's ochre last), any order for a grey
  assert.deepEqual(M.dirColours([255, 180, 84, 1], false), ['#bf8cff', '#f07ac0', '#c9d3db', '#4fd1c5', '#e6cf4a']);
  assert.deepEqual(M.dirColours([120, 60, 200, 1], true), ['#b0377f', '#3d4a55', '#0e8478', '#8c7a00', '#7b3fc4'], 'a violet solid: violet last');
  assert.deepEqual(M.dirColours([128, 128, 128, 1], true), ['#7b3fc4', '#b0377f', '#3d4a55', '#0e8478', '#8c7a00']);
  const t = M.themeFrom({ light: false, text: [223, 232, 234, 1], muted: '#7f97a0', under: null, bg: [14, 19, 22, 1], solid: [255, 180, 84, 1], font: 'Inter' });
  assert.deepEqual([t.halo, t.bg, t.edge, t.dirs[0], t.font], ['rgb(14,19,22)', 'rgb(14,19,22)', 'rgb(240,203,151)', '#bf8cff', 'Inter']);
  const p = M.pngThemeOf(t);
  assert.deepEqual([p.light, p.halo, p.bg, p.text, p.dirs[0], p.solid], [true, 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgb(26,35,39)', '#7b3fc4', t.solid]);
  assert.equal(M.rgba([10, 20, 30], 1.5), 'rgba(10,20,30,1.000)');
  // the canvas: a square of 200–320 px; given a height, that and the whole width, down to 120
  assert.deepEqual([M.viewSize(150), M.viewSize(400), M.viewSize(260.4), M.viewSize(90, 140), M.viewSize(500, 180.4)], [[200, 200], [320, 320], [260, 260], [120, 140], [500, 180]]);
  assert.deepEqual([0.0123, 3.456, 12.34, 123.4].map(M.fmtNm), ['0.012', '3.5', '12.3', '123']);
  assert.equal(M.describeSolid(M.buildModel(SOLIDS.rod), ''),
    'Crystallite shape in 3D: square-based box 4 × 4 × ∞ nm. Directions: [001] the axis 4.2° off it, ±6.0°; [100] ±40°. Drag or use the arrow keys to rotate, Home to reset.');
  assert.equal(M.describeSolid(M.buildModel(SOLIDS.plate), 'a plate'),
    'Crystallite shape in 3D: a plate. Directions: [001] ±4.0°; [110] free about the axis; [1-10] free about the axis. Drag or use the arrow keys to rotate, Home to reset.');
  assert.deepEqual(M.triadAxes(I3.flat(), [[0, 0, 1], [1, 0, 0], [0, 1, 0]]).map(a => [a.i, a.sx, a.sy, a.z]), [[1, 1, -0, 0], [2, 0, -1, 0], [0, 0, -0, 1]]);
});

/* ---- The view as a whole, on a page as small as it needs (page3d.mjs fakePage) ---- */
const turn = (a, b) => { const c = Math.cos(a), s = Math.sin(a), c2 = Math.cos(b), s2 = Math.sin(b);
  return [c, -s, 0, s * c2, c * c2, -s2, s * s2, c * s2, c2]; };

/* One case: a view made, the solid set, dragged (a fast frame, then the full one), turned by
   keys (one held), put back end-on, a PNG, the light theme, the next solid, none. */
async function runCase(shapeView, name, i, names){
  const page = fakePage();
  install(page, [1, 2, 3][i % 3]);
  const box = page.document.createElement('div');
  box.clientWidth = [230, 420, 150, 340][i % 4];
  if (i % 2) box.bg = { dark: '#20262b', light: '#f1f3f4' };
  const height = i % 4 === 3 ? 200 : i % 4 === 1 ? () => 180 + i : undefined;
  const view = shapeView(box, { color: [undefined, '--phase2', '#3fa34d', 'rgb(200, 60, 60)', 'notacolor'][i % 5], height });
  const wrap = box.kids[0], canvas = wrap.kids[0], cap = wrap.kids[1];
  const out = [];
  const say = what => out.push(what + ' ' + JSON.stringify(view.getView()) + ' ' + canvas.getAttribute('aria-label') + ' ' + cap.textContent + ' ' + wrap.hidden);
  view.set(SOLIDS[name]); say('set');
  canvas.fire('pointerdown', { clientX: 100, clientY: 100 }); canvas.fire('pointermove', { clientX: 122, clientY: 106 }); canvas.fire('pointermove', { clientX: 137, clientY: 96 }); page.flush();
  canvas.fire('pointerup', { clientX: 137, clientY: 96 }); page.flush(); say('dragged');
  canvas.fire('keydown', { key: 'ArrowRight' }); page.flush();
  canvas.fire('keydown', { key: 'ArrowUp', shiftKey: true, repeat: true }); page.flush(); canvas.fire('keyup', { key: 'ArrowUp' }); page.flush(); say('keys');
  out.push('setView ' + view.setView({ R: turn(0.7, 0.3).map((x, k) => x + (k === 4 ? 2e-5 : 0)), labels: [[0, 30, -12], [1, 'a', 3]] })); page.flush(); say('near');
  out.push('setView ' + view.setView({ R: [1, 0, 0, 0, 1, 0, 0, 0, 1] })); say('end-on');
  out.push('png ' + view.png());
  page.setTheme('light'); page.flush(); say('light');
  box.clientWidth += 60; page.resize(); page.flush(); say('wider');
  canvas.fire('keydown', { key: 'Home' }); page.flush(); say('home');
  view.set(SOLIDS[names[(i + 1) % names.length]]); say('next');
  view.set(null); say('none');
  view.destroy();
  return { digest: sha(page.log.join('\n') + '\n' + out.join('\n')), calls: page.log.length };
}

test('the view, solid by solid, as v553 drew it (golden digests)', async ()=>{
  const { shapeView } = await import('../xrd-shape3d.js');
  const names = Object.keys(SOLIDS), got = {};
  for (let i = 0; i < names.length; i++) got[names[i]] = await runCase(shapeView, names[i], i, names);
  for (const n of names) assert.ok(got[n].calls > 1000, n + ': drawn');
  if (UPDATE){ fs.writeFileSync(GOLDEN, JSON.stringify(got, null, 1) + '\n'); return; }
  const want = JSON.parse(fs.readFileSync(GOLDEN, 'utf8'));
  assert.deepEqual(Object.keys(got), Object.keys(want));
  for (const n of names) assert.deepEqual(got[n], want[n], n);
});

/* ---- The view's events and what follows the page (v564, shapeView split into functions
   at module level) ----
   Cases beyond the drawing, each on a page that keeps the media queries, the fonts, a clock
   and the classes (page3d.mjs): taps (a double tap within 350 ms and 24 px puts the view
   back, a slow one or a mouse's not), a double click, pointers it does not take (the other
   button, a second one, another's moves), a drag cancelled or its capture lost, a press that
   does not move, keys held (fast frames until let go or blurred), with modifiers, Home,
   others, with no solid; a view put in before its solid (kept for it), the same solid again
   (the view kept) and another (home); the screen's pixel ratio and the theme changed, the
   fonts loaded and ready, the container at no width, a PNG before any frame; destroyed (every
   listener let go) and used after. Each case's calls, views, words, classes and listeners
   hashed: golden/shape3dview.json, as v563's shapeView took them. The module's colour cache
   (readTheme's canvas, made once, on the page of its first call) made first on a page of its
   own, so that no case's log depends on the cases before it. */
const GOLDEN_VIEW = path.join(path.dirname(fileURLToPath(import.meta.url)), 'golden', 'shape3dview.json');
const PAGE_O = { media: true, fonts: true, clock: true, classes: true };
export function warmTheme(readTheme){
  const page = fakePage();
  install(page, 1);
  readTheme(page.document.createElement('div'));
}
export async function viewCase({ shapeView, readTheme }, name){
  warmTheme(readTheme);
  const page = fakePage(PAGE_O), perf = globalThis.performance;
  install(page, name === 'page' ? 2 : 1, PAGE_O);
  try {
    const box = page.document.createElement('div');
    box.clientWidth = name === 'page' ? 0 : 300;
    const view = shapeView(box, name === 'early' ? { color: '--phase2' } : {});
    const wrap = box.kids[0], canvas = wrap.kids[0], out = [];
    const say = what => out.push([what, JSON.stringify(view.getView()), canvas.getAttribute('aria-label'), [...canvas.classes].join(), wrap.hidden, wrap.parentElement ? 'in' : 'out',
      page.listening('resolution'), page.listening('color-scheme'), page.fontsListening(), page.frames.length].join(' | '));
    const tap = (x, y, type = 'touch', id = 4) => { canvas.fire('pointerdown', { pointerId: id, pointerType: type, clientX: x, clientY: y }); canvas.fire('pointerup', { pointerId: id, pointerType: type, clientX: x, clientY: y }); };
    if (name === 'taps'){
      view.set(SOLIDS.box); canvas.fire('keydown', { key: 'ArrowLeft' }); page.flush(); say('turned');
      tap(50, 50); page.advance(200); tap(60, 70); page.flush(); say('double tap: home');
      canvas.fire('keydown', { key: 'ArrowUp' }); page.flush();
      tap(50, 50); page.advance(400); tap(50, 50); page.flush(); say('slow: kept');
      page.advance(100); tap(90, 50); page.flush(); say('far: kept');
      tap(10, 10, 'pen', 6); page.advance(50); tap(12, 12, 'pen', 6); page.flush(); say('pen: home');
      canvas.fire('keydown', { key: 'ArrowRight' }); tap(5, 5, 'mouse'); page.advance(10); tap(5, 5, 'mouse'); page.flush(); say('mouse: kept');
      canvas.fire('pointerdown', { pointerId: 4, pointerType: 'touch', clientX: 0, clientY: 0 }); canvas.fire('pointermove', { pointerId: 4, clientX: 30, clientY: 0 });
      canvas.fire('pointerup', { pointerId: 4, pointerType: 'touch', clientX: 30, clientY: 0 }); page.advance(20); tap(30, 0); page.flush(); say('a drag is no tap');
    } else if (name === 'pointers'){
      view.set(SOLIDS.needle); page.flush();
      canvas.fire('pointerdown', { button: 2 }); canvas.fire('pointermove', { clientX: 40 }); say('the other button');
      canvas.fire('pointerdown', { pointerId: 1, pointerType: 'touch', clientX: 10, clientY: 10 }); canvas.fire('pointerdown', { pointerId: 2, pointerType: 'touch' });
      canvas.fire('pointermove', { pointerId: 2, clientX: 90 }); canvas.fire('pointermove', { pointerId: 1, clientX: 12, clientY: 11 }); say('a small move'); page.flush();
      canvas.fire('pointermove', { pointerId: 1, clientX: 60, clientY: 30 }); page.flush(); say('dragging');
      canvas.fire('pointercancel', { pointerId: 1 }); page.flush(); say('cancelled');
      canvas.fire('pointerdown', { pointerId: 3, clientX: 0, clientY: 0 }); canvas.fire('pointermove', { pointerId: 3, clientX: 20, clientY: 40 });
      canvas.fire('lostpointercapture', { pointerId: 3 }); page.flush(); say('capture lost');
      canvas.fire('pointerup', { pointerId: 3 }); canvas.fire('dblclick'); page.flush(); say('double click');
    } else if (name === 'keys'){
      canvas.fire('keydown', { key: 'ArrowLeft' }); canvas.fire('dblclick'); say('no solid');
      view.set(SOLIDS.plate); page.flush();
      for (let k = 0; k < 3; k++){ canvas.fire('keydown', { key: 'ArrowDown', repeat: k > 0 }); page.flush(); }
      say('held'); canvas.fire('blur'); page.flush(); say('blurred');
      canvas.fire('keydown', { key: 'ArrowRight', shiftKey: true, repeat: true }); page.flush(); canvas.fire('keyup'); page.flush(); say('let go');
      for (const m of ['altKey', 'ctrlKey', 'metaKey']) canvas.fire('keydown', { key: 'ArrowUp', [m]: true });
      canvas.fire('keydown', { key: 'a' }); canvas.fire('keydown', { key: 'Enter' }); page.flush(); say('others');
      canvas.fire('keydown', { key: 'Home' }); page.flush(); say('home');
    } else if (name === 'early'){
      out.push('setView ' + view.setView({ R: turn(1.1, 0.4), labels: [[0, 10, -8]] })); say('before its solid');
      view.set(SOLIDS.ellipsoid); page.flush(); say('kept for it');
      canvas.fire('keydown', { key: 'ArrowLeft' }); page.flush();
      view.set(SOLIDS.ellipsoid); page.flush(); say('the same again');
      view.set(SOLIDS.disc); page.flush(); say('another');
      out.push('setView ' + view.setView({ R: [1, 0, 0, 0, 1, 0, 0, 0, -1] })); say('a mirror');
    } else if (name === 'page'){
      out.push('png ' + view.png()); view.set(SOLIDS.rod); say('no width'); out.push('png ' + view.png());
      box.clientWidth = 280; page.resize(); page.flush(); say('a width');
      globalThis.devicePixelRatio = 3; page.mediaChange('resolution'); page.flush(); say('pixel ratio 3');
      page.mediaChange('resolution'); page.flush();
      page.mediaChange('color-scheme'); page.flush(); say('scheme');
      page.fontsDone(); page.flush(); say('a font');
      page.fontsReady(); await new Promise(r => setTimeout(r, 0)); page.flush(); say('fonts ready');
      out.push('png ' + view.png());
    } else if (name === 'destroy'){
      view.set(SOLIDS.box); page.flush(); canvas.fire('keydown', { key: 'ArrowUp' });
      view.destroy(); say('destroyed'); page.flush();
      view.set(SOLIDS.disc); out.push('setView ' + view.setView({ R: turn(0.2, 0.2) }), 'png ' + view.png()); view.destroy();
      canvas.fire('keydown', { key: 'Home' }); page.mediaChange('resolution'); page.fontsDone(); page.flush(); say('after');
    }
    view.destroy();
    return { digest: sha(page.log.join('\n') + '\n' + out.join('\n')), calls: page.log.length, steps: out.length };
  } finally { Object.defineProperty(globalThis, 'performance', { value: perf, configurable: true, writable: true }); }
}
export const VIEW_CASES = ['taps', 'pointers', 'keys', 'early', 'page', 'destroy'];

test('the view\'s events and the page it follows, as v563\'s shapeView took them (golden digests)', async ()=>{
  const S = await import('../xrd-shape3d.js'), got = {};
  for (const n of VIEW_CASES) got[n] = await viewCase(S, n);
  for (const n of VIEW_CASES) assert.ok(got[n].calls > 500, n + ': drawn');
  if (UPDATE){ fs.writeFileSync(GOLDEN_VIEW, JSON.stringify(got, null, 1) + '\n'); return; }
  const want = JSON.parse(fs.readFileSync(GOLDEN_VIEW, 'utf8'));
  assert.deepEqual(Object.keys(got), Object.keys(want));
  for (const n of VIEW_CASES) assert.deepEqual(got[n], want[n], n);
});
