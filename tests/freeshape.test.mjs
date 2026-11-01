/* The free crystallite shape (xrd-rietveld.js freeShape, bodyShapeOf; v523), in Node, no
   browser: synthetic SrTiO3 patterns drawn by the engine itself, the solid by its exact line
   (WPPM) as round 2's generator draws one (research/free-shape/round2/), with Poisson noise
   from a fixed seed, and refined from the CIF as the card refines them, with the standard's
   profile. An 8 × 5 × 3 nm box with its edges on the cube's axes: kept, held on ⟨100⟩, every
   dimension within its stated 95 % interval, the per-line check not firing, the keep test's,
   the check's and the minima stage's records in the result and in the report. A 5 nm sphere
   searched as an ellipsoid and as a spheroid: not kept (the gain under the class's
   threshold), the warning saying so. A result of v522 refined with the Lorentzian line: drawn
   with it (lorentzShape), its solid searched again from it, not carried. No random number
   (v524): Math.random is not called in the box's refinement. The setting shapeTiltSets (v525):
   0 the default's result exactly; 1 the starts run twice, every end into the minima stage, χ² no
   higher, still no random number. Seconds each. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CIF } from './fixtures.mjs';
import { buildModel, calc, autoRefine, shapeOf, getParams, K_SCHERRER } from '../xrd-rietveld.js';
import { prepPhase } from '../xrd-rv-model.js';

const SRT = prepPhase(fs.readFileSync(CIF, 'utf8'), 'SrTiO3.cif');
const LAM1 = 1.540598;
// 20–100° in 0.04° steps, Cu Kα1 + Kα2, no axial divergence; the standard's profile given.
const X = Array.from({ length: 2001 }, (_, i)=> +(20 + i*0.04).toFixed(6));
const INSTR = { lam1: LAM1, lam2: 1.544426, ratio: 0.5, radius: 240, monochromator: false };
const IRF = { U: 0.0012, V: -0.0008, W: 0.0006, X: 0.006, Y: 0.012, asym: 0, zero: 0, transp: 0, lam1: LAM1, radius: 240 };
const phase = (shape, more = {}) => ({ id: 1, name: SRT.name, cell: SRT.cell, constraint: SRT.constraint, ops: SRT.ops, atoms: SRT.atoms, mass: SRT.mass, color: '#888',
  size: true, shape, profile: 'lorentz', strain: 'iso', adp: 'overall', po: null, occ: null, faults: null, ...more });
// The width (°) of a dimension D (nm), as the engine reads one: D = Kλ/(W·π/180).
const widthOf = D => K_SCHERRER*LAM1/(D*10)*180/Math.PI;
// A pattern drawn at P (the engine's names) with the phase as `shape` by WPPM (a sphere's exact
// line too): the strongest point at 2·10⁴ counts over 200, Poisson noise (normal, √counts) from
// a fixed seed.
function draw(shape, P){
  let s = 12345;
  const u = ()=> { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0)/4294967296; };
  const nrm = ()=> Math.sqrt(-2*Math.log(u() || 1e-300))*Math.cos(2*Math.PI*u());
  const m = buildModel({ x: X, y: X.map(()=> 1), instr: INSTR, phases: [phase(shape, { profile: 'wppm' })] });
  const prof = Object.fromEntries(['U', 'V', 'W', 'X', 'Y', 'asym', 'zero', 'transp'].map(k=> [k, IRF[k]]));
  const yc = calc(m, { ...getParams(m), ...prof, bg0: 0, 'p1.scale': 1, ...P }).yc, S = 2e4/Math.max(...yc);
  return X.map((_, i)=> { const l = yc[i]*S + 200; return Math.max(0, Math.round(l + Math.sqrt(l)*nrm())); });
}
const refineAs = (y, shape, start, fit) => {
  const model = buildModel({ x: X, y, instr: INSTR, phases: [phase(shape)] });
  return { model, res: autoRefine(model, { standard: false, irf: IRF, ...(start ? { start, hold: [] } : null), ...(fit ? { fit } : null) }) };
};
const TRUE = [8, 5, 3];
const BOX = draw('box', { 'p1.Wa': widthOf(TRUE[0]), 'p1.Wb': widthOf(TRUE[1]), 'p1.Wc': widthOf(TRUE[2]) });
let boxRun = null;
// (v524: the engine draws no random number; Math.random's calls are counted over the box's refinement)
const counted = f => { const R = Math.random; let n = 0; Math.random = ()=> { n++; return R(); }; try { return { ...f(), randoms: () => n }; } finally { Math.random = R; } };
const boxRes = ()=> boxRun || (boxRun = counted(()=> refineAs(BOX, 'box')));

test('a box of 8 × 5 × 3 nm on the cube\'s axes: kept, held on ⟨100⟩, its dimensions within their 95 % intervals, the check quiet', ()=>{
  const { model, res, randoms } = boxRes(), info = res.shapes[1];
  assert.ok(info, 'the shape kept: ' + res.warnings.join(' | '));
  assert.equal(randoms(), 0, 'no random number drawn');
  assert.equal(res.models[1].profile, 'wppm', 'a body is a WPPM phase whatever the profile asked');
  // The keep test: the gain over the cubic class's threshold (k = 0: χ²₁(0.999) + 2)
  const kp = info.keep;
  assert.equal(kp.k, 0);
  assert.ok(Math.abs(kp.need - 13.2) < 0.1, 'the threshold ' + kp.need);
  assert.ok(kp.kept && kp.G > kp.need && kp.flagged === false);
  // The per-line check on the fit kept, and the minima stage's record
  assert.equal(info.check.flagged, false);
  assert.ok(info.check.zSeg < 3.09 && info.check.zBin < 3.09 && info.check.S > 5);
  assert.ok(Array.isArray(info.minima) && info.minima.length >= 1 && info.minima[0].delta === 0);
  assert.equal(info.minimaStage.explored, true);
  assert.ok(info.minimaStage.evals > 0 && info.minimaStage.flagged === false);
  // The report: each dimension within lo–hi, the intervals' parts, the axes on ⟨100⟩ with a radius
  const sh = shapeOf(model, res.params, 0, res);
  assert.equal(sh.type, 'box');
  assert.equal(info.held, true, 'held on the lattice');
  const dims = [...sh.dims].sort((a, b)=> b.D - a.D);
  dims.forEach((d, i)=> {
    assert.ok(d.lo <= TRUE[i] && TRUE[i] <= d.hi, `${d.name}: ${TRUE[i]} nm within ${d.lo.toFixed(3)}–${d.hi.toFixed(3)} (read ${d.D.toFixed(3)})`);
    assert.ok(Math.abs(d.D/TRUE[i] - 1) < 0.02, `${d.name} read ${d.D.toFixed(3)} nm for ${TRUE[i]}`);
    assert.ok(d.Desd > 0 && d.sLocal > 0 && d.betweenLo <= d.D && d.D <= d.betweenHi && d.jackLo === undefined);
  });
  for (const a of sh.axes){
    assert.ok(['[100]', '[010]', '[001]'].includes(a.uvw) && a.angle < 1e-6, a.uvw + ' ' + a.angle);
    assert.ok(a.radius > 0 && a.radius < 5 && a.radius >= a.betweenDeg && a.jackTurn === undefined, 'radius ' + a.radius);
  }
  assert.deepEqual([sh.misfit.flagged, sh.misfit.jack], [false, undefined]);
  assert.equal(sh.minima.delta, 16);
  assert.equal(sh.minima.explored, true);
  assert.ok(sh.minima.n >= 1 && Array.isArray(sh.minima.list) && Array.isArray(sh.sets));
  assert.equal(sh.keep, kp);
});

test('the extra tilt sets (shapeTiltSets): 0 the default exactly; 1 twice the starts, every end in the minima stage, χ² no higher, no random number', ()=>{
  const { res: r0 } = boxRes(), i0 = r0.shapes[1];
  const z = refineAs(BOX, 'box', null, { shapeTiltSets: 0 }).res;
  assert.deepEqual([z.params, z.stats, z.shapes[1]], [r0.params, r0.stats, i0], '0: the default\'s result');
  assert.equal(i0.tiltSets, undefined);
  const { res: r1, randoms } = counted(()=> refineAs(BOX, 'box', null, { shapeTiltSets: 1 })), i1 = r1.shapes[1];
  assert.equal(randoms(), 0, 'no random number drawn');
  assert.ok(i1, 'the shape kept: ' + r1.warnings.join(' | '));
  assert.equal(i1.tiltSets, 1);
  assert.equal(i1.starts, 2*i0.starts, 'the same starts again');
  assert.ok(i1.full >= i0.full && i1.minimaStage.ends >= i0.minimaStage.ends + i0.starts, `ends ${i1.minimaStage.ends} against ${i0.minimaStage.ends}`);
  assert.ok(r1.stats.chi2 <= r0.stats.chi2*(1 + 1e-9), `χ²_ν ${r1.stats.chi2} against ${r0.stats.chi2}`);
  assert.equal(r1.fit.shapeTiltSets, 1, 'the result says the setting it was refined with');
});

test('a 5 nm sphere searched as an ellipsoid and as a spheroid: not kept, the warning gives the gain and the class\'s need', ()=>{
  const y = draw(false, { 'p1.Ys': widthOf(5) });
  for (const shape of ['ellipsoid', 'spheroid']){
    const { res } = refineAs(y, shape);
    assert.deepEqual(res.shapes, {}, shape);
    assert.equal(res.models[1].shape, shape);
    const w = res.warnings.find(t=> t.includes('is not supported by the data'));
    assert.ok(w && /needs over 13\.2 for its Laue class/.test(w), w);
  }
});

test('a result of v522 with the Lorentzian line: drawn with it, its solid searched again from it', ()=>{
  // Drawn as refined: lorentzShape keeps the Lorentzian line for such a result (the card's curvesFrom)
  const m0 = buildModel({ x: X, y: BOX, instr: INSTR, phases: [phase('box')] }), m1 = buildModel({ x: X, y: BOX, instr: INSTR, phases: [phase('box', { lorentzShape: true })] });
  assert.deepEqual([m0.phases[0].wppm, m1.phases[0].wppm], [true, false]);
  const { res } = boxRes(), P = res.params;
  const yW = calc(m0, P).yc, yL = calc(m1, P).yc;
  assert.ok(yW.some((t, i)=> Math.abs(t - yL[i]) > 1), 'the two lines differ');
  // A v522 result: the same solid in use, the Lorentzian profile in its models, its search's record
  const old = { params: P, free: res.free, held: [], models: { 1: { ...res.models[1], profile: 'lorentz' } }, textures: {}, shapes: { 1: { ...res.shapes[1], keep: undefined, check: undefined, minima: undefined, minimaStage: undefined } },
    isoParams: res.isoParams, detected: res.detected, irf: IRF };
  const again = refineAs(BOX, 'box', old).res;
  assert.ok(!again.warnings.some(t=> t.includes('is the last result\'s')), 'not carried: ' + again.warnings.join(' | '));
  const info = again.shapes[1];
  assert.ok(info && !info.carried && info.keep && info.check && info.minima, 'searched again, with v523\'s records');
  assert.equal(again.models[1].profile, 'wppm');
});
