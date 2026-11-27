/* The Rietveld engine's staged strategy (xrd-rietveld.js autoRefine) and its stages (v553), in
   Node, no browser: synthetic patterns drawn by the engine itself with seeded noise (SrTiO3
   from the fixture's CIF, a BaTiO3-like cell made from it, LaB6 as xrd-rv.js writes it, rutile
   and NaCl in P1). Each stage alone: the setup (the standard's profile refused for another λ1
   and kept with a note for another radius, the options that need it switched off without it,
   the optional stages counted, the 1/2θ term, the zero's bounds), the starting profile (with
   and without the standard's: the widths from the estimate, the sample's Ys bisected and
   ÷1.23 for WPPM, the Soller model's length), where the peaks are (a cell 0.1 % off found,
   one 6 % off by the lone phase's wider search, the standard's zero found and one beyond the
   scan left at its start, no phase: the linear start), a pass of the stages and the
   detection's tests (the scale's significance, the χ² total, a phase that only takes up a
   broad hump left out as implausible, a weak phase put back or kept out by what leaving it
   out cost), and from the last result (each parameter's group, a result of other phases,
   what changed and what is held). Then the whole: autoRefine's full output (the result, the
   model after it, the progress, the stages' times on a counted clock, Math.random's calls)
   on 26 cases through its branches, as v552's autoRefine, one function then, gave it, bit
   for bit: their digests are tests/golden/autorefine.json, which npm run test:update writes
   anew after a change meant to alter the numbers. About 10 s. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { CIF } from './fixtures.mjs';
import * as R from '../xrd-rietveld.js';
import { prepPhase } from '../xrd-rv-model.js';

const UPDATE = !!process.env.UPDATE_GOLDEN || process.env.npm_lifecycle_event === 'test:update';
const GOLDEN = path.join(path.dirname(fileURLToPath(import.meta.url)), 'golden', 'autorefine.json');

// ---- the phases
const STO_TEXT = fs.readFileSync(CIF, 'utf8');
const cif = (name, a, c, atoms) => `data_${name}\n_cell_length_a ${a}\n_cell_length_b ${a}\n_cell_length_c ${c}\n_cell_angle_alpha 90\n_cell_angle_beta 90\n_cell_angle_gamma 90\nloop_\n_symmetry_equiv_pos_as_xyz\n'x, y, z'\nloop_\n_atom_site_label\n_atom_site_type_symbol\n_atom_site_fract_x\n_atom_site_fract_y\n_atom_site_fract_z\n_atom_site_B_iso_or_equiv\n${atoms.map(a=> a.join(' ')).join('\n')}\n`;
const SRT = prepPhase(STO_TEXT, 'SrTiO3.cif');
const BTO = prepPhase(STO_TEXT.replace(/SrTiO3/g, 'BaTiO3').replace(/Sr/g, 'Ba').replace(/3\.905/g, '4.00'), 'BaTiO3.cif');
const BT2 = prepPhase(STO_TEXT.replace(/SrTiO3/g, 'BaTiO3').replace(/Sr/g, 'Ba').replace(/3\.905/g, '3.93'), 'BaTiO3b.cif');
const LAB6 = prepPhase(fs.readFileSync(new URL('../xrd-rv.js', import.meta.url), 'utf8').match(/const LAB6_CIF = `([^`]*)`/)[1], 'LaB6');
const RUT = prepPhase(cif('rutile', 4.594, 2.959, [['Ti1','Ti',0,0,0,0.4],['Ti2','Ti',0.5,0.5,0.5,0.4],['O1','O',0.305,0.305,0,0.6],['O2','O',0.695,0.695,0,0.6],['O3','O',0.805,0.195,0.5,0.6],['O4','O',0.195,0.805,0.5,0.6]]), 'rutile.cif');
const NACL = prepPhase(cif('NaCl', 5.64, 5.64, [['Na1','Na',0,0,0,1],['Na2','Na',0,0.5,0.5,1],['Na3','Na',0.5,0,0.5,1],['Na4','Na',0.5,0.5,0,1],['Cl1','Cl',0.5,0.5,0.5,1],['Cl2','Cl',0.5,0,0,1],['Cl3','Cl',0,0.5,0,1],['Cl4','Cl',0,0,0.5,1]]), 'NaCl.cif');
// A phase as the worker passes it: the structure and the card's options.
const ph = (P, id, more = {}) => ({ id, name: P.name, cell: P.cell, constraint: P.constraint, ops: P.ops, atoms: P.atoms, mass: P.mass, color: '#888',
  size: true, shape: false, profile: 'lorentz', strain: 'iso', adp: 'cif', po: null, occ: null, faults: null, ...more });

// ---- the patterns: 20–100° in 0.04° steps, Cu Kα1 + Kα2, drawn by calc, the top at `top`
// counts over a sloping background, Poisson-like noise (normal, √counts, ×k) from a seed
const LAM1 = 1.540598;
const X = Array.from({ length: 2001 }, (_, i)=> +(20 + i*0.04).toFixed(6));
const FEWX = Array.from({ length: 11 }, (_, i)=> 31 + i*0.2);
const INSTR = { lam1: LAM1, lam2: 1.544426, ratio: 0.5, radius: 240, monochromator: false };
const INSTR_SOL = { ...INSTR, soller: { incident: 0.04, diffracted: 0.04 } };
// the standard's profile (xrd-rv-model irfOf's form)
const IRF = { U: 0.0012, V: -0.0008, W: 0.0006, X: 0.006, Y: 0.012, asym: 0, zero: 0, transp: 0, lam1: LAM1, radius: 240 };
const PROF = { U: 0.0012, V: -0.0008, W: 0.0006, X: 0.006, Y: 0.012, asym: 0, zero: 0, transp: 0 };
const widthOf = D => R.K_SCHERRER*LAM1/(D*10)*180/Math.PI;
function normal(seed){
  let s = seed >>> 0;
  const u = ()=> { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0)/4294967296; };
  return ()=> Math.sqrt(-2*Math.log(u() || 1e-300))*Math.cos(2*Math.PI*u());
}
function draw({ x = X, phases, instr = INSTR, P, top = 2e4, bg = 200, seed = 12345, k = 1 }){
  const nrm = normal(seed);
  const m = R.buildModel({ x, y: x.map(()=> 1), instr, phases });
  const yc = R.calc(m, { ...R.getParams(m), bg0: 0, ...P }).yc, S = top/Math.max(...yc);
  return x.map((t, i)=> { const l = yc[i]*S + bg + 30*Math.exp(-(t - 20)/30); return Math.max(0, Math.round(l + k*Math.sqrt(l)*nrm())); });
}
const once = f => { let y = null; return ()=> y || (y = f()); };
const STO = once(()=> draw({ phases: [ph(SRT, 1)], P: { ...PROF, W: 0.004, Y: 0.05, zero: 0.02, 'p1.a': 3.9087, 'p1.scale': 1 } }));
const STO_NOISY = once(()=> draw({ phases: [ph(SRT, 1)], P: { ...PROF, W: 0.004, Y: 0.05, zero: 0.02, 'p1.a': 3.9087, 'p1.scale': 1 }, k: 0.3, seed: 7 }));
const STO_IRF = once(()=> draw({ phases: [ph(SRT, 1, { profile: 'wppm' })], P: { ...PROF, 'p1.a': 3.9071, 'p1.Ys': widthOf(14), 'p1.Xs': 0.02, 'p1.scale': 1 } }));
const STO_FAR = once(()=> draw({ phases: [ph(SRT, 1)], P: { ...PROF, W: 0.004, Y: 0.05, 'p1.a': 4.15, 'p1.scale': 1 } }));
const LAB6_SOL = once(()=> draw({ instr: INSTR_SOL, phases: [ph(LAB6, 1)], P: { ...PROF, zero: -0.03, axL: 15, transp: -0.01, 'p1.scale': 1 } }));
const LAB6_FCJ = once(()=> draw({ phases: [ph(LAB6, 1)], P: { ...PROF, zero: 0.04, asym: 0.03, 'p1.scale': 1 } }));
const LAB6_FAR = once(()=> draw({ phases: [ph(LAB6, 1)], P: { ...PROF, zero: 0.8, asym: 0.03, 'p1.scale': 1 } }));
const TWO = once(()=> draw({ phases: [ph(SRT, 1), ph(BTO, 2)], P: { ...PROF, 'p1.a': 3.9071, 'p2.a': 3.998, 'p1.Ys': widthOf(30), 'p2.Ys': widthOf(12), 'p1.scale': 1, 'p2.scale': 0.6 } }));
const ONE = once(()=> draw({ phases: [ph(SRT, 1)], P: { ...PROF, 'p1.a': 3.9071, 'p1.Ys': widthOf(20), 'p1.scale': 1 } }));
const SPHERE = once(()=> draw({ phases: [ph(SRT, 1, { profile: 'wppm' })], P: { ...PROF, 'p1.Ys': widthOf(5), 'p1.scale': 1 } }));
const FEW = once(()=> draw({ x: FEWX, phases: [ph(SRT, 1)], P: { ...PROF, W: 0.02, 'p1.scale': 1 } }));
// two populations of SrTiO3, the sharp one weak: its scale correlates with the broad one's
const POPS = once(()=> draw({ phases: [ph(SRT, 1), ph(SRT, 2)], P: { ...PROF, 'p1.a': 3.9071, 'p2.a': 3.9071, 'p1.Ys': 0.85, 'p2.Ys': 0.25, 'p1.scale': 1, 'p2.scale': 0.08 }, top: 2000, bg: 150, seed: 1 }));
// sharp rutile beside two broad perovskites whose lines overlap each other's throughout
const OWN3 = once(()=> draw({ phases: [ph(RUT, 1), ph(SRT, 2), ph(BT2, 3)], P: { ...PROF, 'p2.a': 3.9071, 'p3.a': 3.95, 'p1.Ys': 0.15, 'p2.Ys': 1.2, 'p3.Ys': 0.25, 'p1.scale': 0.5, 'p2.scale': 1, 'p3.scale': 0.3 }, top: 4000, bg: 150, seed: 3 }));
// SrTiO3 beside a rutile of 0.9 nm: a hump only
const IMPL = once(()=> draw({ phases: [ph(SRT, 1), ph(RUT, 2)], P: { ...PROF, 'p1.a': 3.9071, 'p1.Ys': 0.4, 'p1.scale': 1, 'p2.Ys': 9, 'p2.scale': 3 }, top: 4000, bg: 150, seed: 3 }));
const modelOf = (y, phases, extra = {}) => R.buildModel({ x: extra.x || X, y, instr: extra.instr === undefined ? INSTR : extra.instr, phases, ...extra.build });
const startOf = (r, irf = null) => ({ params: r.params, free: r.free, held: r.held || [], models: r.models, textures: r.textures, shapes: r.shapes || {}, isoParams: r.isoParams || null, detected: r.detected, irf });
// autoRefine's state as autoRefine makes it, up to where the peaks are
const setup = (model, opts = {}) => { const A = R.autoSetup(model, opts); R.startingProfile(A); A.tS = Date.now(); return A; };

test('the setup: the standard\'s profile refused for another λ1, noted for another radius; what needs it switched off without it; the stages counted', ()=>{
  // another λ1: not used, said; the options that need it then switched off
  const m = modelOf(STO_IRF(), [ph(SRT, 1, { profile: 'lognormal', strain: 'aniso', faults: '111:1/6<112>', adp: 'site', occ: ['Sr1'], po: 'auto' })]);
  const A = R.autoSetup(m, { irf: { ...IRF, lam1: 1.78897 } });
  assert.equal(A.irf, null);
  assert.match(A.warnings[0], /^The standard was measured at λ = 1\.78897 Å, this pattern at 1\.540598 Å: its instrumental profile, in degrees at its own wavelength, does not apply here/);
  assert.match(A.warnings[1], /^SrTiO3: WPPM, anisotropic strain, planar faults: need the standard's instrumental profile/);
  assert.deepEqual([m.phases[0].wppm, m.phases[0].noIrf], [false, true]);
  // what is left of the optional stages: the displacements and the occupancy (the texture is a trial, not counted)
  assert.deepEqual(A.optStages, ['displacement parameters', 'site occupancy']);
  assert.equal(A.nStages, 7);
  assert.deepEqual(A.lin, ['bg0', 'bg1', 'bg2', 'bg3', 'bg4', 'bg5', 'bg6']);
  assert.deepEqual([A.scales, A.lattice, A.share], [['p1.scale'], ['p1.a'], 1]);
  assert.deepEqual(A.linIdx, ['p1.scale', ...A.lin].map(n=> m.index[n]));
  assert.deepEqual(A.lm, { maxIter: 40, shiftTol: 0.01, lambda: 1e-3 });
  // with it, from another radius: used, noted; every optional stage; the free shape's half of the progress
  const m2 = modelOf(STO_IRF(), [ph(SRT, 1, { profile: 'lognormal', strain: 'aniso', faults: '111:1/6<112>', adp: 'site', occ: ['Sr1'], shape: 'box' })]);
  const A2 = R.autoSetup(m2, { irf: { ...IRF, radius: 200 } });
  assert.equal(A2.irf.radius, 200);
  assert.match(A2.warnings.join('|'), /goniometer of radius 200 mm, this pattern on one of 240 mm/);
  assert.deepEqual(A2.optStages, ['anisotropic strain', 'planar faults', 'size distribution', 'displacement parameters', 'site occupancy']);
  assert.deepEqual([A2.nStages, A2.share, m2.phases[0].wppm, !!m2.phases[0].noIrf], [10, 0.5, true, false]);
  // a standard: no lattice; the older keys under fit; the 1/2θ term on; the zero's bounds over a scan of ±1.5°
  const m3 = modelOf(LAB6_FCJ(), [ph(LAB6, 1)]);
  const A3 = R.autoSetup(m3, { standard: true, maxIter: 12, range: 0.02, bgInv: true, fit: { zeroRange: 1.5, maxIter: 30 } });
  assert.deepEqual([A3.lattice, A3.F.maxIter, A3.F.cellRange, A3.F.bgInv, A3.lin.at(-1), m3.useInv], [[], 30, 0.02, true, 'bgInv', true]);
  assert.deepEqual([m3.par[m3.iZero].lo, m3.par[m3.iZero].hi], [-2.5, 2.5]);
  // no instrument, no tabulated wavelength: said
  const m4 = modelOf(STO(), [ph(SRT, 1)], { instr: null });
  assert.match(R.autoSetup(m4, {}).warnings[0], /^No instrument description could be read from the file/);
  const m5 = modelOf(STO(), [ph(SRT, 1)], { instr: { ...INSTR, lam1: 1.6, lam2: 1.6, ratio: 0 } });
  assert.match(R.autoSetup(m5, {}).warnings[0], /^λ = 1\.60000 Å is not one of the lines the anomalous scattering factors are tabulated at/);
});

test('the starting profile: from the width estimate, or the sample\'s width bisected above the standard\'s; the axial divergence\'s parameter', ()=>{
  // no standard's profile: H_G = H_L = h, W = h², Y = h·cosθ_E; the asymmetry from 0.05 (FCJ)
  const m = modelOf(STO(), [ph(SRT, 1)]), A = R.autoSetup(m, {});
  R.startingProfile(A);
  const h = A.est.H/1.635, v = m.v;
  assert.ok(A.est.H > 0.05 && A.est.H < 0.5 && Math.abs(A.est.tt - 32.4) < 0.5, 'the strongest line, ' + A.est.tt);
  assert.deepEqual([v[m.index.U], v[m.index.V], v[m.index.X], v[m.index.W], v[m.index.Y]], [0, 0, 0, h*h, h*Math.cos(A.thE)]);
  assert.deepEqual([A.AS, A.asFree, v[m.iAsym], A.asym0, v[m.iTr], m.axialOff], ['asym', ['asym'], 0.05, 0.05, 0, false]);
  // with it: U … zero the standard's, each phase's Ys bisected to the estimate's width (÷1.23 by WPPM)
  const m2 = modelOf(ONE(), [ph(SRT, 1), ph(SRT, 2, { profile: 'wppm' }), ph(SRT, 3, { size: false })]), A2 = R.autoSetup(m2, { irf: { ...IRF, zero: 0.01 } });
  R.startingProfile(A2);
  const w = m2.v;
  assert.deepEqual(['U', 'V', 'W', 'X', 'Y'].map(k=> w[m2.index[k]]), [IRF.U, IRF.V, IRF.W, IRF.X, IRF.Y]);
  assert.equal(w[m2.iZero], 0.01);
  const ys = m2.phases.map(q=> w[q.iYs]);
  assert.ok(ys[0] > 0.2 && ys[0] < 0.6, 'Ys ' + ys[0]);
  assert.ok(Math.abs(ys[1]*1.23/ys[0] - 1) < 1e-12 && ys[2] === 0);
  assert.ok(m2.phases.every(q=> w[q.iXs] === 0));
  // the Soller model where the file gives its Sollers: its length refined on the standard from AX_START, the sample's the standard's
  const m3 = modelOf(LAB6_SOL(), [ph(LAB6, 1)], { instr: INSTR_SOL }), A3 = R.autoSetup(m3, { standard: true });
  R.startingProfile(A3);
  assert.deepEqual([A3.AS, A3.asFree, m3.v[m3.iAx], m3.v[m3.iAsym]], ['axL', ['axL'], 15, 0]);
  const m4 = modelOf(ONE(), [ph(SRT, 1)], { instr: INSTR_SOL }), A4 = R.autoSetup(m4, { irf: { ...IRF, axL: 12, axP1: 0.04, axP2: 0.05 } });
  R.startingProfile(A4);
  assert.deepEqual([A4.AS, A4.asFree, m4.v[m4.iAx]], ['axL', [], 12]);
  assert.match(A4.warnings.join('|'), /Soller slits of 0\.04 and 0\.05 rad, this pattern with 0\.04 and 0\.04 rad/);
  // a standard refined with FCJ on a sample whose file gives Sollers: drawn with that standard's A
  const m5 = modelOf(ONE(), [ph(SRT, 1)], { instr: INSTR_SOL }), A5 = R.autoSetup(m5, { irf: { ...IRF, asym: 0.02 } });
  R.startingProfile(A5);
  assert.deepEqual([m5.axialOff, A5.AS, m5.v[m5.iAsym]], [true, 'asym', 0.02]);
});

test('where the peaks are: the cell found, a cell 6 % off by the lone phase\'s wider search, the standard\'s zero, a zero beyond the scan, no phase', ()=>{
  // SrTiO3 drawn at 3.9087 Å (the CIF's 3.905) and a zero of 0.02°: placed within the search's resolution
  const m = modelOf(STO(), [ph(SRT, 1)]), A = setup(m);
  const p = R.placePeaks(A);
  assert.ok(Math.abs(m.v[m.index['p1.a']] - 3.9087) < 3e-3, 'a = ' + m.v[m.index['p1.a']]);
  assert.deepEqual([p.cs.phases.length, p.cs.phases[0].found, p.notFound.size, p.len0], [1, true, 0, [[3.905]]]);
  assert.equal(p.cs.f, m.v[m.index['p1.a']]/3.905);
  assert.deepEqual(A.stages.map(s=> s.name), ['cell search']);
  assert.equal(A.stages[0].f, p.cs.f);
  // 4.15 Å: beyond ±5 %, found within ±10 %
  const m2 = modelOf(STO_FAR(), [ph(SRT, 1)]), A2 = setup(m2), p2 = R.placePeaks(A2);
  assert.ok(p2.cs.phases[0].found && Math.abs(m2.v[m2.index['p1.a']] - 4.15) < 3e-3, 'a = ' + m2.v[m2.index['p1.a']]);
  // LaB6 with its zero at +0.04° (and an asymmetry, which the scan takes at its start)
  const m3 = modelOf(LAB6_FCJ(), [ph(LAB6, 1)]), A3 = setup(m3, { standard: true }), p3 = R.placePeaks(A3);
  assert.equal(p3.cs, null);
  const z = A3.stages[0];
  assert.deepEqual([z.name, z.found], ['zero search', true]);
  assert.ok(Math.abs(z.zero - 0.04) < 0.02 && m3.v[m3.iZero] === z.zero, 'zero ' + z.zero);
  // at +0.8°, beyond a ±0.1° scan: left at its start
  const m4 = modelOf(LAB6_FAR(), [ph(LAB6, 1)]), A4 = setup(m4, { standard: true, fit: { zeroRange: 0.1 } });
  R.placePeaks(A4);
  assert.deepEqual([A4.stages[0].found, A4.stages[0].zero], [false, 0]);
  assert.match(A4.warnings.at(-1), /^The zero-shift scan found no minimum within ±0\.1°: the zero is left at its start\.$/);
  // no phase: the background alone, solved
  const m5 = modelOf(STO(), []), A5 = setup(m5);
  assert.equal(R.placePeaks(A5).cs, null);
  assert.deepEqual(A5.stages.map(s=> [s.name, s.free.length, s.iterations]), [['linear start', 0, 0]]);
});

test('a pass of the stages, and the detection\'s tests: the scale\'s significance, a hump taken for a phase, a weak phase put back by what leaving it out cost', ()=>{
  // the scale over its esd (a tied one by its held esd), the χ² total, the words
  const r = { params: { 'p1.scale': 2, 'p2.scale': 3, 'p3.scale': 0 }, esd: { 'p1.scale': 0.5, 'p2.scale': NaN, 'p3.scale': 1 }, esdHeld: { 'p2.scale': 2 }, stats: { chi2: 1.5, N: 100, P: 10 } };
  assert.deepEqual(R.zScale({ phases: [1, 2, 3].map(i=> ({ pfx: `p${i}.` })) }, r), [4, 1.5, 0]);
  assert.equal(R.chiTotal(r), 135);
  assert.equal(R.chiTotal({ stats: { chi2: 2, N: 5, P: 9 } }), 2);
  assert.equal(R.weakWhy(2.99, true), 'its scale is not above 3 esd once the cells and widths are refined (2.9 esd)');
  assert.equal(R.weakWhy(0, false), 'its scale is not above 3 esd');
  // one pass on SrTiO3 and a rutile of 0.9 nm: the stages, then the rutile left out as a hump
  const m = modelOf(IMPL(), [ph(SRT, 1), ph(RUT, 2)]), A = setup(m, { irf: IRF }), D = R.detection(A, R.placePeaks(A));
  assert.deepEqual([D.nSearch, D.out.size, D.vSearch], [1, 0, m.v]);
  assert.notEqual(D.vSearch, m.v);
  const pass = R.stagePass(A, D);
  assert.deepEqual(A.stages.map(s=> s.name), ['cell search', 'scales and background', 'lattice and displacement', 'widths', 'size and strain']);
  assert.deepEqual(pass.free, ['p1.scale', 'p2.scale', ...A.lin, 'p1.a', 'p2.a', 'p2.c', 'disp', 'p1.Ys', 'p2.Ys', 'p1.Xs', 'p2.Xs']);
  assert.deepEqual(pass.res.free, pass.free);
  assert.ok(pass.nIn.n > 0 && pass.nIn.positions > 3);
  assert.equal(R.implausibleWhy(A, 0), null);
  assert.match(R.implausibleWhy(A, 1), /^its crystallites come out 0\.\d nm across, under two cells: it takes up a broad hump or the background$/);
  assert.equal(R.putBackWeak(A, D, pass.res), false);
  assert.equal(R.putBackOwn(A, D, pass.res), false);
  assert.equal(R.leaveOutNext(A, D, pass.res), true);
  assert.deepEqual([[...D.out], D.weakOut, D.ownOut, A.stages.length], [[1], null, null, 1]);
  assert.match(D.outWarn[0], /^rutile: not detected — its crystallites come out 0\.\d nm across/);
  assert.equal(m.v[m.phases[1].iScale], 0);
  assert.deepEqual(m.phases[1].iLat.map(i=> m.v[i]), D.len0[1]);
  // the next pass without it: nothing more to leave out
  const pass2 = R.stagePass(A, D);
  assert.ok(!pass2.free.some(n=> n.startsWith('p2.')));
  assert.equal(R.leaveOutNext(A, D, pass2.res), false);
  // putBackWeak: a phase left out the pass before, at 2 esd, and χ² without it 60 higher for its 4 parameters (the BIC's bar
  // 4·ln N + 10 ≈ 40): put back, its stages to run again from the search's state; 20 higher: kept out, the rise said
  const res0 = pass2.res, chi = R.chiTotal(res0), N = res0.stats.N, P = res0.stats.P;
  const weak = rise => ({ ...D, out: new Set([1]), outWarn: ['x', 'y'], keptBIC: new Map(), weakOut: { k: 1, z: 2.04, idx: 1, chi: chi - rise, chi2: 1, P: P + 4, out: 1 } });
  const D1 = weak(60);
  assert.equal(R.putBackWeak(A, D1, res0), true);
  assert.deepEqual([D1.out.size, D1.outWarn, D1.weakOut, A.stages.length], [0, ['x'], null, D.nSearch]);
  assert.deepEqual(D1.keptBIC.get(1), { z: 2.04, dchi: chi - (chi - 60), dP: 4, need: 4*Math.log(N) });
  assert.deepEqual(m.v, D.vSearch, 'the stages to run again from the search\'s state, the rutile with them');
  const D2 = weak(20);
  assert.equal(R.putBackWeak(A, D2, res0), false);
  assert.equal(D2.outWarn[1], `rutile: not detected — its scale is not above 3 esd once the cells and widths are refined (2.0 esd). Leaving it out raises χ² by 20 for its 4 parameters (fitting noise gives about 4; a BIC would keep it above ${(4*Math.log(N) + 10).toFixed(0)}): more than noise gives, too little to tell.`);
});

/* v568: the own-intensity test's put-back compares χ²_ν, as its warning says (6; to v567 the χ²
   totals, which a fit with fewer parameters has higher by about their number from the noise
   alone); a phase beside its twin alone (two populations of one structure) left out by the
   own-intensity test, its twin named (5; to v567 "…lies under 's peaks"). */
test('the own-intensity test: put back by χ²_ν doubled; beside its twin alone, the twin named', ()=>{
  // a pass without the phase (k = 1, 4 parameters fewer): χ²_ν c; with it, χ²_ν just under c/2,
  // or just over: its χ² total more than doubled both times
  const m = modelOf(ONE(), [ph(SRT, 1), ph(RUT, 2)]), A = setup(m, { irf: IRF }), D0 = R.detection(A, R.placePeaks(A)), pass = R.stagePass(A, D0);
  const res0 = pass.res, c = res0.stats.chi2, N = res0.stats.N, P = res0.stats.P;
  const own = ratio => ({ ...D0, out: new Set([1]), outWarn: ['x', 'y'], keptOwn: new Map(),
    ownOut: { k: 1, idx: 1, chi: c/ratio*(N - P - 4), chi2: c/ratio, sig: 1, why: 'why', out: 1 } });
  const Dn = own(1.999);
  assert.ok(R.chiTotal(res0) > 2*Dn.ownOut.chi, 'the χ² total more than doubled');
  assert.equal(R.putBackOwn(A, Dn, res0), false, 'χ²_ν not doubled: kept out');
  assert.deepEqual([[...Dn.out], Dn.outWarn, Dn.keptOwn.size], [[1], ['x', 'y'], 0]);
  const Dy = own(2.001);
  assert.equal(R.putBackOwn(A, Dy, res0), true, 'χ²_ν more than doubled: put back');
  const b = Dy.keptOwn.get(1);
  assert.deepEqual([[...Dy.out], Dy.outWarn, b.why, b.without], [[], ['x'], 'why', c]);
  assert.ok(b.without > 2*b.chi2, 'the warning\'s χ²_ν, more than twice');
  // two populations of one SrTiO3, the second (sharp) where the data have none of it, both
  // scales significant: left out by the own-intensity test, its twin named
  const m2 = modelOf(ONE(), [ph(SRT, 1), ph(SRT, 2)]), A2 = setup(m2, { irf: IRF }), D2 = R.detection(A2, R.placePeaks(A2)), pass2 = R.stagePass(A2, D2);
  const [q1, q2] = m2.phases, v = m2.v.slice();
  v[q1.iScale] += v[q2.iScale]; v[q2.iScale] = 0.2*v[q1.iScale]; v[q2.iYs] = 0.2*v[q1.iYs]; m2.v = v;
  const sure = { ...pass2.res, params: { ...pass2.res.params, 'p1.scale': 1, 'p2.scale': 1 }, esd: { ...pass2.res.esd, 'p1.scale': 0.01, 'p2.scale': 0.01 } };
  assert.equal(R.leaveOutNext(A2, D2, sure), true);
  assert.deepEqual([...D2.out], [1]);
  assert.match(D2.outWarn[0], /^SrTiO3: not detected — 0 % of its calculated intensity lies under the other phases' peaks \(its twin SrTiO3, the same structure, not weighed against it\), and at its lines clear of theirs \(100 % of it\) the pattern shows -?\d+ ± \d+ % of the intensity calculated: not told from none\.$/);
});

test('from the last result: each parameter\'s group, a result of other phases, what changed and what is held', ()=>{
  const m = modelOf(STO_IRF(), [ph(SRT, 1, { profile: 'lognormal', strain: 'aniso', faults: '111:1/6<112>', adp: 'site', occ: ['Sr1'], po: '100' })], { instr: INSTR_SOL });
  const group = n => R.paramGroup(m, m.index[n]);
  assert.deepEqual(['bg0', 'bgInv', 'p1.scale', 'zero', 'disp', 'transp', 'p1.a', 'U', 'Y', 'asym', 'axL', 'p1.Ys', 'p1.Xs', 'p1.S1', 'p1.LS', 'p1.FA', 'p1.B_Sr1', 'p1.occ_Sr1', 'p1.PO', 'p1.B'].map(group),
    ['linear', 'linear', 'linear', 'cell', 'cell', 'cell', 'cell', 'instrument', 'instrument', 'instrument', 'instrument', 'sizestrain', 'sizestrain', 'sizestrain', 'sizestrain', 'faults', 'adp', 'occ', 'texture', 'adp']);
  // a result of SrTiO3 alone, and models with another phase or one fewer
  const one = modelOf(STO(), [ph(SRT, 1)]), res = R.autoRefine(one, {});
  assert.equal(R.refinedWithOthers(modelOf(STO(), [ph(SRT, 1)]), res), false);
  assert.equal(R.refinedWithOthers(modelOf(STO(), [ph(SRT, 1), ph(BTO, 2)]), res), true);
  assert.equal(R.refinedWithOthers(modelOf(STO(), [ph(SRT, 2)]), res), true);
  // from it, with the displacements per site now and 'cell' and 'adp' held: the cell held (unchanged), the B's new
  const m2 = modelOf(STO(), [ph(SRT, 1, { adp: 'site' })]), A = setup(m2, { start: startOf(res), hold: ['cell', 'adp', 'instrument'] });
  const L = R.lastChanges(A, startOf(res));
  assert.deepEqual([[...L.out], L.liveK, L.irfSame, L.irfMoved], [[], [0], true, false]);
  const c = L.chg[0];
  assert.deepEqual([c.sizestrain, c.shape, c.faults, c.adp, c.occ, c.texture], [false, false, false, true, false, false]);
  assert.deepEqual([L.has('p1.a'), L.has('p1.B_Sr1'), L.was('p1.a'), L.changed(m2.index['p1.a']), L.changed(m2.index['p1.B_Sr1'])], [true, false, true, false, true]);
  const P = R.lastFreeList(A, L);
  assert.deepEqual(P.held, ['p1.a', 'disp', 'W', 'Y', 'X', 'U', 'V', 'asym']);
  assert.deepEqual(P.free, ['p1.scale', ...A.lin, 'p1.B_Sr1', 'p1.B_Ti1', 'p1.B_O1']);
  assert.deepEqual([P.carried, P.search, P.keptIso, P.lsNew, P.poNew, P.zeroMoved, P.axChanged], [[], [], [], [], [], false, false]);
});

// ---- the whole: autoRefine's output, bit for bit
// Every number exactly (String round-trips a double; −0 apart), the keys in their order, a
// shared reference as one, typed arrays, Maps and Sets, an array's own other keys.
function canon(root){
  const seen = new Map(), out = [];
  const walk = (x, p) => {
    if (x === null){ out.push('null'); return; }
    const t = typeof x;
    if (t === 'number'){ out.push(Object.is(x, -0) ? '-0' : String(x)); return; }
    if (t === 'string'){ out.push(JSON.stringify(x)); return; }
    if (t === 'boolean' || t === 'undefined' || t === 'bigint'){ out.push(String(x)); return; }
    if (t === 'function'){ out.push('fn:' + x.name); return; }
    if (t === 'symbol'){ out.push('sym'); return; }
    if (seen.has(x)){ out.push('ref:' + seen.get(x)); return; }
    seen.set(x, p);
    if (ArrayBuffer.isView(x)){ out.push(x.constructor.name + '['); for (let i = 0; i < x.length; i++){ if (i) out.push(','); walk(x[i], p + '.' + i); } out.push(']'); return; }
    if (x instanceof Map){ out.push('Map{'); let i = 0; for (const [k, v] of x){ if (i) out.push(','); walk(k, p + '.k' + i); out.push('=>'); walk(v, p + '.v' + i); i++; } out.push('}'); return; }
    if (x instanceof Set){ out.push('Set{'); let i = 0; for (const v of x){ if (i) out.push(','); walk(v, p + '.s' + i); i++; } out.push('}'); return; }
    if (Array.isArray(x)){
      out.push('[');
      for (let i = 0; i < x.length; i++){ if (i) out.push(','); if (!(i in x)) out.push('<hole>'); else walk(x[i], p + '.' + i); }
      out.push(']');
      const extra = Object.keys(x).filter(k=> !/^\d+$/.test(k));
      if (extra.length){ out.push('+{'); extra.forEach((k, i)=> { if (i) out.push(','); out.push(JSON.stringify(k) + ':'); walk(x[k], p + '.' + k); }); out.push('}'); }
      return;
    }
    const proto = Object.getPrototypeOf(x);
    out.push((proto && proto !== Object.prototype && proto.constructor ? proto.constructor.name : '') + '{');
    Object.keys(x).forEach((k, i)=> { if (i) out.push(','); out.push(JSON.stringify(k) + ':'); walk(x[k], p + '.' + k); });
    out.push('}');
  };
  walk(root, '$');
  return out.join('');
}
// The cases (name, model, options), in order: a start from the last result takes an earlier case's.
const got = {};
const CASES = [
  // no standard: the cell search, the whole profile, ΔB overall; from it with groups held, with other background terms, with other phases
  ['noirf', ()=> [modelOf(STO(), [ph(SRT, 1, { adp: 'overall' })]), {}]],
  ['noirf-last-held', ()=> [modelOf(STO(), [ph(SRT, 1, { adp: 'overall' })]), { start: startOf(got.noirf), hold: ['cell', 'instrument', 'sizestrain', 'adp'] }]],
  ['noirf-last-bg', ()=> [modelOf(STO(), [ph(SRT, 1, { adp: 'site' })], { build: { bgDegree: 4, bgInv: true } }), { start: startOf(got.noirf), hold: ['linear', 'cell', 'adp'], fit: { bgDegree: 4, bgInv: true } }]],
  // no instrument, noise under counts', what needs the standard without it, a texture that cannot be read, the older keys
  ['needirf-noinstr-countscale', ()=> [modelOf(STO_NOISY(), [ph(SRT, 1, { profile: 'wppm', strain: 'aniso', faults: '111:1/6<112>', po: 'xyz' })], { instr: null }), { refineB: true, range: 0.2, maxIter: 30 }]],
  // the optional stages
  ['irf-faults-aniso', ()=> [modelOf(STO_IRF(), [ph(SRT, 1, { profile: 'wppm', faults: '111:1/6<112>', adp: 'aniso' })]), { irf: IRF }]],
  ['irf-texture-occ', ()=> [modelOf(STO_IRF(), [ph(SRT, 1, { po: '100', occ: ['Sr1'], adp: 'overall' })]), { irf: IRF }]],
  // the standard: the zero scan, the Soller model and FCJ, from the last result, one drawn otherwise, a zero beyond the scan
  ['std-soller', ()=> [modelOf(LAB6_SOL(), [ph(LAB6, 1)], { instr: INSTR_SOL }), { standard: true }]],
  ['std-soller-last', ()=> [modelOf(LAB6_SOL(), [ph(LAB6, 1)], { instr: INSTR_SOL }), { standard: true, start: startOf(got['std-soller']), hold: ['linear', 'cell', 'instrument'] }]],
  ['std-fcj', ()=> [modelOf(LAB6_FCJ(), [ph(LAB6, 1)]), { standard: true, fit: { zeroRange: 0.5 } }]],
  ['std-fcj-to-soller', ()=> [modelOf(LAB6_SOL(), [ph(LAB6, 1)], { instr: INSTR_SOL }), { standard: true, start: startOf(got['std-fcj']), hold: ['linear', 'cell', 'instrument'] }]],
  ['std-zero-far', ()=> [modelOf(LAB6_FAR(), [ph(LAB6, 1)]), { standard: true, fit: { zeroRange: 0.1 } }]],
  ['sample-soller-irf', ()=> [modelOf(ONE(), [ph(SRT, 1)], { instr: INSTR_SOL }), { irf: { ...IRF, axL: 12, axP1: 0.04, axP2: 0.05 } }]],
  // two phases with the standard's profile (from another radius); from it with new options
  ['two-phase', ()=> [modelOf(TWO(), [ph(SRT, 1), ph(BTO, 2)]), { irf: { ...IRF, radius: 200 } }]],
  ['two-phase-last-new', ()=> [modelOf(TWO(), [ph(SRT, 1, { profile: 'lognormal', strain: 'aniso', faults: '111:1/6<112>' }), ph(BTO, 2, { profile: 'wppm' })]),
    { irf: { ...IRF, radius: 200 }, start: startOf(got['two-phase'], { ...IRF, radius: 200 }), hold: ['linear', 'cell', 'sizestrain'] }]],
  // the detection: an absent rutile (not above 3 esd, the rise said), an absent NaCl, from it; a weak population put back (BIC),
  // a present phase put back (χ² more than doubled), a hump left out as implausible
  ['absent-rutile', ()=> [modelOf(ONE(), [ph(SRT, 1), ph(RUT, 2)]), { irf: IRF }]],
  ['absent-nacl', ()=> [modelOf(ONE(), [ph(SRT, 1), ph(NACL, 2, { profile: 'wppm' })]), { irf: IRF }]],
  ['absent-nacl-last', ()=> [modelOf(ONE(), [ph(SRT, 1), ph(NACL, 2, { profile: 'wppm' })]), { irf: IRF, start: startOf(got['absent-nacl'], IRF), hold: ['cell'] }]],
  ['kept-bic', ()=> [modelOf(POPS(), [ph(SRT, 1), ph(SRT, 2)]), { irf: IRF }]],
  ['kept-own', ()=> [modelOf(OWN3(), [ph(RUT, 1), ph(SRT, 2), ph(BT2, 3)]), { irf: IRF }]],
  ['implausible', ()=> [modelOf(IMPL(), [ph(SRT, 1), ph(RUT, 2)]), { irf: IRF }]],
  // the lone phase's wider cell search; no phase; fewer points than parameters
  ['cell-wide', ()=> [modelOf(STO_FAR(), [ph(SRT, 1)]), {}]],
  ['no-phase', ()=> [modelOf(STO(), []), {}]],
  ['few-points', ()=> [modelOf(FEW(), [ph(SRT, 1)], { x: FEWX }), {}]],
  // the free shape: v420's ellipsoid (not searched), a sphere's ellipsoid rejected, and from it with the shape held
  ['shape-ellipsoidL', ()=> [modelOf(STO_IRF(), [ph(SRT, 1, { shape: 'ellipsoidL' })]), { irf: IRF }]],
  ['shape-sphere', ()=> [modelOf(SPHERE(), [ph(SRT, 1, { shape: 'ellipsoid' })], { build: { shapeLine: 'exact' } }), { irf: IRF, fit: { shapeLine: 'exact' } }]],
  ['shape-sphere-last', ()=> [modelOf(SPHERE(), [ph(SRT, 1, { shape: 'ellipsoid' })], { build: { shapeLine: 'exact' } }), { irf: IRF, fit: { shapeLine: 'exact' }, start: startOf(got['shape-sphere'], IRF), hold: ['shape', 'cell'] }]],
];

test('autoRefine\'s whole output on 26 cases through its branches: v552\'s, bit for bit', ()=>{
  const now = {}, realNow = Date.now, realRandom = Math.random;
  for (const [name, make] of CASES){
    const [model, opts] = make();
    const prog = [];
    let tick = 0, randoms = 0, res = null, error = null;
    // a counted clock: the stages' times say how many readings came between
    Date.now = ()=> 1e12 + 1000*(++tick);
    Math.random = ()=> { randoms++; return realRandom(); };
    try { res = R.autoRefine(model, { ...opts, onProgress: (f, s)=> prog.push([f, s]) }); }
    catch(e){ error = String(e && e.message || e); }
    finally { Date.now = realNow; Math.random = realRandom; }
    got[name] = res;
    now[name] = { digest: createHash('sha256').update(canon({ res, error, model, prog, ticks: tick, randoms })).digest('hex'), chi2: res ? String(res.stats.chi2) : error };
  }
  if (UPDATE){ fs.writeFileSync(GOLDEN, JSON.stringify(now, null, 1) + '\n'); return; }
  const want = JSON.parse(fs.readFileSync(GOLDEN, 'utf8'));
  const diff = Object.keys({ ...want, ...now }).filter(k=> !want[k] || !now[k] || want[k].digest !== now[k].digest)
    .map(k=> `${k}: χ²_ν ${now[k] ? now[k].chi2 : '(not run)'}, golden ${want[k] ? want[k].chi2 : '(none)'}`);
  assert.deepEqual(diff, [], 'autoRefine\'s output differs from the golden file\'s');
  // and what the cases are there for
  assert.match(got['kept-bic'].warnings.join('|'), /its scale stands at only 2\.\d esd .* above the 40 at which a BIC keeps it: kept/);
  assert.match(got['kept-own'].warnings.join('|'), /SrTiO3: .* but leaving it out raises χ²_ν from 2\.44 to 8\.37, more than twice/);
  assert.match(got.implausible.warnings.join('|'), /rutile: not detected — its crystallites come out 0\.9 nm across/);
  assert.match(got['absent-rutile'].warnings.join('|'), /rutile: not detected — its scale is not above 3 esd once the cells and widths are refined \(2\.6 esd\)\. Leaving it out raises χ² by 16/);
  assert.match(got['few-points'].warnings.join('|'), /The pattern has 11 points for 11 refined parameters/);
  assert.match(got['shape-sphere-last'].warnings.join('|'), /was not supported by the data in the last result, which kept the isotropic size: held so/);
  assert.match(got['std-fcj-to-soller'].warnings.join('|'), /The last result was refined with FCJ’s axial divergence .* this one with the Soller model/);
  assert.deepEqual(got['two-phase-last-new'].stages.map(s=> s.name), ['linear start', 'from the last result', 'size distribution']);
});
