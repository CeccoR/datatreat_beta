/* The Rietveld card's calculations (xrd-rv-model.js) and its words and markup that need no
   page (xrd-rv-html.js), in Node: no browser. A phase from a CIF (the SrTiO3 fixture; the
   built-in LaB6 as xrd-rv.js writes it) and the cache of the last 32 read; the settings made
   valid, a v428 project's migrated, the engine's options from them; a Refinement setting
   read from its field and the settings cleaned; the worker's payload from the CIF and from
   the last result (each reason a result cannot be started from; the background's terms
   changed with the scales held; a phase ticked off; the standard), the instrument read once;
   a result written and the instrumental profile taken from it; the state saved and read
   back (a v428 sample's, the standard's with a CIF phase, a malformed one); the sizes
   charted by sample and by peak; the CSVs' rows. Then the words: negative Miller indices
   barred (markup, a list's option, a plot's runs, a label of v479 or older), formulae, what
   a phase is refined with, the instrument's line, the solids' captions; every name from a
   CIF escaped, an apostrophe left as it is. The values are HEAD v511's (xrd-rv.js before the
   split), read in its page. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CIF, xrdml } from './fixtures.mjs';
import { readXrdmlScanText } from '../xrd-instr.js';
import * as M from '../xrd-rv-model.js';
import * as H from '../xrd-rv-html.js';

const SRT = fs.readFileSync(CIF, 'utf8');
const BTO = SRT.replace(/SrTiO3/g, 'BaTiO3').replace(/Sr/g, 'Ba').replace(/3\.905/g, '4.00');
// The built-in LaB6's CIF as xrd-rv.js writes it (as tests/cifdl.test.mjs reads it).
const LAB6 = fs.readFileSync(new URL('../xrd-rv.js', import.meta.url), 'utf8').match(/const LAB6_CIF = `([^`]*)`/)[1];
// A pattern as xrd.js keeps it (a fresh object each time: instrOf writes f.instr on it).
const pattern = (name, bytes)=>{ const sc = readXrdmlScanText(new Uint8Array(bytes)); return { name, label: name.replace(/\.xrdml$/, ''), color: '#123456', x: sc.x, y: sc.y, rawBytes: new Uint8Array(bytes) }; };
const DEF = { on: { size: true, wppm: false, strain: true, faults: false, adp: false, occ: false, po: false },
  dep: { size: 'iso', wppm: 'wppm', strain: 'iso', faults: '111:1/6<112>', adp: 'overall', occ: '', po: 'auto' } };
const STD = { on: { ...DEF.on, size: false, strain: false, adp: true }, dep: DEF.dep };
const HOLD_DEFAULT = ['cell', 'instrument', 'sizestrain', 'shape', 'faults', 'adp', 'occ', 'texture'];

test('a phase from its CIF: SrTiO3, the built-in LaB6; one read kept for the same text and name, the last 32', ()=>{
  const q = M.prepPhase(SRT, 'SrTiO3.cif');
  assert.deepEqual({ name: q.name, file: q.file, formula: q.formula, sg: q.sg, sgFrom: q.sgFrom, system: q.system, order: q.order, Z: q.Z, ownCell: q.ownCell, src: q.src, notes: q.notes },
    { name: 'SrTiO3', file: 'SrTiO3.cif', formula: 'Sr1 Ti1 O3', sg: 'Pm-3m', sgFrom: 'cif', system: 'cubic', order: 48, Z: 1, ownCell: false, src: 'znjilf.507', notes: [] });
  assert.deepEqual(q.sites, [{ label: 'Sr1', element: 'Sr', n: 1 }, { label: 'Ti1', element: 'Ti', n: 1 }, { label: 'O1', element: 'O', n: 3 }]);
  assert.deepEqual(q.atoms.map(a=> [a.label, a.element, a.x, a.y, a.z, a.occ]), [['Sr1', 'Sr', 0, 0, 0, 1], ['Ti1', 'Ti', 0.5, 0.5, 0.5, 1], ['O1', 'O', 0.5, 0.5, 0, 1], ['O2', 'O', 0.5, 0, 0.5, 1], ['O3', 'O', 0, 0.5, 0.5, 1]]);
  assert.deepEqual([q.cell.a, q.cell.alpha, q.constraint], [3.905, 90, { kind: 'cubic', params: ['a'] }]);
  assert.ok(Math.abs(q.mass - 183.484) < 1e-9);
  assert.deepEqual(q.warnings, ['The CIF lists only the identity (x, y, z) as its symmetry operation for P m -3 m: the atoms are taken as they are (P1), so the cell is filled only if they are all listed.']);
  assert.equal(M.formulaOf(q), 'SrTiO3');
  // The built-in LaB6: in P1, its symmetry found from the atoms.
  const l = M.prepPhase(LAB6, 'LaB6 (NIST SRM 660c)');
  assert.deepEqual({ name: l.name, formula: l.formula, sg: l.sg, sgFrom: l.sgFrom, system: l.system, order: l.order, Z: l.Z, src: l.src, warnings: l.warnings, n: l.atoms.length, a: l.cell.a },
    { name: 'LaB6', formula: 'La1 B6', sg: 'Pm-3m', sgFrom: 'atoms', system: 'cubic', order: 48, Z: 1, src: 'b8tjx9.550', warnings: [], n: 7, a: 4.156826 });
  assert.deepEqual(l.sites, [{ label: 'La1', element: 'La', n: 1 }, { label: 'B1', element: 'B', n: 6 }]);
  assert.equal(M.formulaOf(l), 'LaB6');
  assert.throws(()=> M.prepPhase('data_x\n', 'bad.cif'), /^Error: No atom sites in the CIF \(_atom_site_fract_x\)\.$/);
  assert.deepEqual([M.textKey(''), M.textKey('abc')], ['ztntfp.0', '7aigaz.3']);
  assert.equal(M.cellKey({ a: '3.9050001', b: 3.905, c: 3.905, alpha: 90, beta: 90.0000004, gamma: 90 }), '3.905,3.905,3.905,90,90,90');
  // prepOf: one object for one text and file name, the last 32 kept (a read moves one to the end).
  const a = M.prepOf(SRT, 'lru-a.cif'), b = M.prepOf(SRT, 'lru-b.cif');
  assert.equal(M.prepOf(SRT, 'lru-a.cif'), a);
  assert.notEqual(M.prepOf(SRT, 'other.cif'), a);
  for (let i = 0; i < 30; i++) M.prepOf(SRT, `lru-${i}.cif`);
  assert.equal(M.prepOf(SRT, 'lru-a.cif'), a, 'read again since: kept');
  assert.notEqual(M.prepOf(SRT, 'lru-b.cif'), b, 'the oldest of 33: read anew');
});

test('the settings made valid, a v428 project\'s migrated, the engine\'s options from them', ()=>{
  assert.deepEqual(M.defSettings(), DEF);
  assert.deepEqual(M.stdSettings(), STD);
  const clean = [[undefined, DEF, DEF],
    [{ on: { size: false, wppm: 'yes', strain: 1, po: true }, dep: { size: 'box', wppm: 'nope', strain: 'aniso', occ: 'Sr1', faults: 3 } }, DEF,
      { on: { ...DEF.on, size: false, po: true }, dep: { ...DEF.dep, size: 'box', strain: 'aniso', occ: 'Sr1' } }],
    [{ on: { size: true, adp: false }, dep: { adp: 'site', po: '111' } }, STD, { on: { ...STD.on, size: true, adp: false }, dep: { ...DEF.dep, adp: 'site', po: '111' } }],
    [{ on: null, dep: 'x' }, DEF, DEF]];
  clean.forEach(([s, d, want], i)=> assert.deepEqual(M.cleanSettings(s, d), want, 'cleanSettings ' + i));
  const migrate = [[{}, false, DEF],
    [{ shape: true, profile: 'lognormal', strain: 'aniso', faults: '100:1/2<111>', po: 'auto', adp: '' }, true,
      { on: { ...DEF.on, wppm: true, faults: true, adp: true, po: true }, dep: { ...DEF.dep, size: 'ellipsoid', wppm: 'lognormal', strain: 'aniso', faults: '100:1/2<111>' } }],
    [{ shape: 'box', profile: 'lorentz', po: '110', adp: 'site' }, false, { on: { ...DEF.on, adp: true, po: true }, dep: { ...DEF.dep, size: 'box', adp: 'site', po: '110' } }],
    [{ shape: 'x', profile: 'x', strain: 'off', faults: 'x', po: 'x', adp: 'cif' }, true, DEF]];
  migrate.forEach(([p, refineB, want], i)=> assert.deepEqual(M.migrateSettings(p, refineB), want, 'migrateSettings ' + i));
  const sto = { id: 1, ...M.defSettings(), prep: M.prepOf(SRT, 'SrTiO3.cif') }, lab = { id: 0, ...M.stdSettings(), prep: M.prepPhase(LAB6, 'x') };
  const all = { on: Object.fromEntries(M.MODES.map(m=> [m.k, true])), dep: { size: 'sqbox', wppm: 'lognormal', strain: 'aniso', faults: '001:1/3<1-10>', adp: 'aniso', occ: 'O1', po: '111' } };
  const deep = { size: true, shape: 'sqbox', profile: 'lognormal', strain: 'aniso', faults: '001:1/3<1-10>', adp: 'aniso', po: '111', occ: ['O1'] };
  const engine = [[sto, false, { size: true, shape: false, profile: 'lorentz', strain: 'iso', faults: null, adp: 'cif', po: null, occ: null }],
    [{ ...sto, ...all }, false, deep],
    // (WPPM is a profile of the size: the size off, the Lorentzian)
    [{ ...sto, on: { ...all.on, size: false }, dep: all.dep }, false, { ...deep, size: false, shape: false, profile: 'lorentz' }],
    // (a site not the phase's: its first)
    [{ ...sto, on: all.on, dep: { ...all.dep, occ: 'x' } }, false, { ...deep, occ: ['Sr1'] }],
    [{ ...lab, ...all }, false, { ...deep, occ: ['La1'] }],
    // The standard: no broadening model of its own.
    [{ ...sto, ...all }, true, { size: true, shape: false, profile: 'lorentz', strain: 'iso', faults: null, adp: 'aniso', po: '111', occ: null }],
    [lab, true, { size: true, shape: false, profile: 'lorentz', strain: 'iso', faults: null, adp: 'overall', po: null, occ: null }]];
  engine.forEach(([q, std, want], i)=> assert.deepEqual(M.engineOf(q, std), want, 'engineOf ' + i));
  // The occupancy of a phase of one site is the scale: not offered.
  const one = { ...sto, prep: { sites: [{ label: 'A', element: 'Na', n: 4 }] } };
  assert.match(M.naOf(one, 'occ'), /^A phase of one site/);
  assert.equal(M.naOf(sto, 'occ'), '');
  assert.match(M.naOf({ ...sto, on: { ...sto.on, size: false } }, 'wppm'), /^WPPM is a profile of the crystallite size/);
  assert.deepEqual(M.siteList(sto), [['Sr1', 'Sr1 (Sr)'], ['Ti1', 'Ti1 (Ti)'], ['O1', 'O1 (O, ×3)']]);
  // The rows each card shows.
  const s = M.rowsFor(false), t = M.rowsFor(true);
  assert.deepEqual([s.fits.map(m=> m.k), s.modes.length, s.holds.length], [['maxIter', 'shiftTol', 'lambda', 'bgDegree', 'bgInv', 'cellRange', 'shapeStarts', 'shapeFull'], 7, 9]);
  assert.deepEqual([t.fits.map(m=> m.k), t.modes.map(m=> m.k), t.holds.map(([k])=> k)], [['maxIter', 'shiftTol', 'lambda', 'bgDegree', 'bgInv', 'zeroRange'], ['adp', 'po'], ['linear', 'cell', 'instrument', 'adp', 'texture']]);
});

test('the Refinement settings: their ranges, an entry read with either mark, the settings cleaned in FITS\' order', ()=>{
  assert.deepEqual(M.FITS.map(m=> [m.k, !!m.int, !!m.pct, !!m.bool, m.role || '', !!m.shape, m.lo, m.hi, m.range, m.rule]), [
    ['maxIter', true, false, false, '', false, 1, 1000, '1–1000', 'a whole number from 1 to 1000'],
    ['shiftTol', false, false, false, '', false, 0.0001, 1, '0.0001–1', 'a number from 0.0001 to 1'],
    ['lambda', false, false, false, '', false, 1e-8, 1000, '1e-8–1000', 'a number from 1e-8 to 1000'],
    ['bgDegree', true, false, false, '', false, 0, 20, '0–20', 'a whole number from 0 to 20'],
    ['bgInv', false, false, true, '', false, undefined, undefined, undefined, undefined],
    ['cellRange', false, true, false, 'sample', false, 0.005, 0.2, '0.5–20', 'a number from 0.5 to 20 %'],
    ['zeroRange', false, false, false, 'std', false, 0.05, 5, '0.05–5', 'a number from 0.05 to 5°'],
    ['shapeStarts', true, false, false, '', true, 1, 100, '1–100', 'a whole number from 1 to 100'],
    ['shapeFull', true, false, false, '', true, 1, 20, '1–20', 'a whole number from 1 to 20']]);
  assert.deepEqual(M.FIT_DEF, { maxIter: 40, shiftTol: 0.01, lambda: 0.001, bgDegree: 6, cellRange: 0.05, zeroRange: 1, shapeStarts: 10, shapeFull: 3, bgInv: 'auto' });
  const read = [['maxIter', '50', 50], ['maxIter', ' 50 ', 50], ['maxIter', '50.0', null], ['maxIter', '1,000', null], ['maxIter', '1e2', 100], ['maxIter', '0', null], ['maxIter', '', null],
    ['maxIter', '0x10', null], ['maxIter', 'Infinity', null], ['shiftTol', '0,05', 0.05], ['shiftTol', '1e-3', 0.001], ['shiftTol', '.5', 0.5], ['shiftTol', '-0', null], ['shiftTol', '1e', null],
    ['lambda', '1e-8', 1e-8], ['lambda', '1e-9', null], ['lambda', '1000', 1000], ['lambda', '1001', null], ['cellRange', '7,3', 0.073], ['cellRange', '7.3', 0.073], ['cellRange', '0', null],
    ['zeroRange', '0,5', 0.5], ['bgDegree', '12', 12], ['bgDegree', '2.5', null]];
  read.forEach(([k, raw, want])=> assert.equal(M.readFit(M.FIT[k], raw), want, `${k} ${JSON.stringify(raw)}`));
  for (const s of [undefined, null, 'x', {}, { shapeFull: 3, bgInv: 'true', maxIter: 1e9, bgDegree: 6 }]) assert.deepEqual(M.cleanFit(s), {}, JSON.stringify(s));
  // (a key unknown, out of range, not whole or at its default dropped; the rest in FITS' order, as text)
  const c = M.cleanFit({ bgDegree: 9, maxIter: 50, lambda: 0.001, x: 1, cellRange: 0.073, bgInv: false, shapeStarts: 2.5, zeroRange: -0, shiftTol: NaN });
  assert.equal(JSON.stringify(c), '{"maxIter":50,"bgDegree":9,"bgInv":false,"cellRange":0.073}');
  // The note on an entry not taken; Defaults offered when one shown is set.
  assert.equal(M.fitRefusal(M.FIT.maxIter, ' 1.000 ', '40'), 'Max iterations: a whole number from 1 to 1000, without a point or comma — “1.000” not taken; kept 40.');
  assert.equal(M.fitRefusal(M.FIT.cellRange, 'twenty percent', '5'), 'Cell search range (%): a number from 0.5 to 20 % — “twenty perce…” not taken; kept 5.');
  assert.equal(M.fitRefusal(M.FIT.lambda, '', '0.001'), 'Starting damping λ: a number from 1e-8 to 1000; kept 0.001.');
  const [s, t] = [M.rowsFor(false).fits, M.rowsFor(true).fits];
  assert.deepEqual([M.fitShown({}, false, s), M.fitShown({ zeroRange: 0.5 }, false, s), M.fitShown({ cellRange: 0.1 }, true, t), M.fitShown({ zeroRange: 0.5 }, true, t)], [false, true, false, true]);
  // The automatic 1/2θ term: on from below 20°, never from 0°.
  assert.deepEqual(M.autoInvOf(pattern('s00.xrdml', xrdml(0))), { on: true, why: ' Here automatic gives on: s00 starts at 10°.' });
  assert.deepEqual(M.autoInvOf(null), { on: false, why: '' });
});

// A result to start from (its parameters are not the engine's: only what the payload takes).
const P = { U: 0.01, V: -0.002, W: 0.003, X: 0.02, Y: 0.01, zero: 0.012, 'p1.scale': 1, 'p1.a': 3.905 };
const res = o => ({ params: P, free: ['p1.a'], held: ['zero'], models: { 1: { size: true } }, textures: {}, isoParams: null, detected: [1], fit: {}, phases: [1], ...o });
const START = { params: P, free: ['p1.a'], held: ['zero'], models: { 1: { size: true } }, textures: {}, shapes: {}, isoParams: null, detected: [1], irf: null };
const ENG = { size: true, shape: false, profile: 'lorentz', strain: 'iso', faults: null, adp: 'cif', po: null, occ: null };

test('the worker\'s payload: from the CIF, from the last result, each reason a result cannot be started from', ()=>{
  const sto = { id: 1, ...M.defSettings(), prep: M.prepOf(SRT, 'SrTiO3.cif'), color: '#d4a72c', off: {} };
  const bto = { id: 2, ...M.defSettings(), on: { ...M.defSettings().on, adp: true }, prep: M.prepOf(BTO, 'BaTiO3.cif'), color: '#c77dff', off: {} };
  const lab = { id: M.LAB6_ID, ...M.stdSettings(), prep: M.prepPhase(LAB6, 'x'), color: '#4cc9a0', off: {} };
  const copy = q => ({ ...q, on: { ...q.on }, dep: { ...q.dep }, off: { ...q.off } });
  const runOf = o => ({ ph: [copy(sto)], std: copy(lab), start: 'cif', hold: ['linear', 'cell'], fit: {}, irf: null, fell: [], bgFreed: [], n: 1, done: 0, ...o });
  // The payload, its phases without their structure; what the run collected.
  const pay = (run, results, std = false, f = pattern('s00.xrdml', xrdml(0)))=>{
    const p = M.payloadFor(f, run, results, std);
    assert.deepEqual(Object.keys(p), ['x', 'y', 'varMul', 'instr', 'phases', 'opts', 'list']);
    assert.ok(Array.isArray(p.x) && p.x !== f.x && p.x.length === 5384 && p.x[0] === 10 && p.x[5383] === 80 && p.y[0] === 232 && p.varMul === null);
    assert.equal(p.instr, f.instr, 'the instrument read and kept on the file');
    assert.equal(p.instr.lam1, 1.540598);
    return { phases: p.phases.map(({ cell, constraint, ops, atoms, mass, ...q })=> q), opts: p.opts, list: p.list.map(q=> q.id), fell: run.fell, bgFreed: run.bgFreed };
  };
  const ph1 = [{ id: 1, name: 'SrTiO3', color: '#d4a72c', ...ENG }];
  assert.deepEqual(pay(runOf({ fit: { maxIter: 20 }, irf: { U: 1 } }), {}), { phases: ph1, opts: { standard: false, irf: { U: 1 }, fit: { maxIter: 20 } }, list: [1], fell: [], bgFreed: [] });
  const last = runOf({ start: 'last' });
  assert.deepEqual(pay(last, { 's00.xrdml': res() }), { phases: ph1, opts: { standard: false, irf: null, fit: {}, start: START, hold: ['linear', 'cell'] }, list: [1], fell: [], bgFreed: [] });
  // (a result of v428 or older: no held, shapes, isoParams nor irf)
  assert.deepEqual(pay(runOf({ start: 'last' }), { 's00.xrdml': res({ held: undefined, isoParams: undefined, irf: undefined, fit: undefined }) }).opts.start, { ...START, held: [] });
  assert.deepEqual(pay(runOf({ start: 'last' }), { 's00.xrdml': res({ cells: { 1: M.cellKey(sto.prep.cell) } }) }).opts.start, START);
  // From the CIF instead, said why.
  for (const [results, why] of [[{}, 'not refined yet'], [{ 's00.xrdml': res({ params: null }) }, 'not refined yet'], [{ 's00.xrdml': res({ phases: [1, 2] }) }, 'refined with other phases'],
    [{ 's00.xrdml': res({ standard: true }) }, 'refined in the other role'], [{ 's00.xrdml': res({ cells: { 1: '3.9,3.9,3.9,90,90,90' } }) }, 'a phase refined in another cell since']])
    assert.deepEqual(pay(runOf({ start: 'last' }), results), { phases: ph1, opts: { standard: false, irf: null, fit: {} }, list: [1], fell: [`s00 (${why})`], bgFreed: [] }, why);
  // The background's terms changed since: the scales and background refined, not held.
  assert.deepEqual(pay(runOf({ start: 'last', fit: { bgDegree: 9 } }), { 's00.xrdml': res() }), { phases: ph1, opts: { standard: false, irf: null, fit: { bgDegree: 9 }, start: START, hold: ['cell'] }, list: [1], fell: [], bgFreed: ['s00'] });
  assert.deepEqual(pay(runOf({ start: 'last', hold: ['cell'], fit: { bgInv: true } }), { 's00.xrdml': res() }).bgFreed, [], 'not held: nothing to say');
  // A phase ticked off for the pattern; two phases.
  const bto1 = { id: 2, name: 'BaTiO3', color: '#c77dff', ...ENG, adp: 'overall' };
  assert.deepEqual(pay(runOf({ ph: [{ ...copy(sto), off: { 's00.xrdml': true } }, copy(bto)] }), {}), { phases: [bto1], opts: { standard: false, irf: null, fit: {} }, list: [2], fell: [], bgFreed: [] });
  assert.deepEqual(pay(runOf({ ph: [copy(sto), copy(bto)] }), {}).list, [1, 2]);
  // The standard: its chosen phase, the profile's own options.
  const std = { size: true, shape: false, profile: 'lorentz', strain: 'iso', faults: null, adp: 'overall', po: null, occ: null };
  assert.deepEqual(pay(runOf({ start: 'last' }), { 's00.xrdml': res({ phases: [0] }) }, true), { phases: [{ id: 0, name: 'LaB6', color: '#4cc9a0', ...std }], opts: { standard: true, irf: null, fit: {}, start: START, hold: ['linear', 'cell'] }, list: [0], fell: [], bgFreed: [] });
  assert.deepEqual(pay(runOf({ std: copy({ ...sto, ...M.stdSettings() }) }), {}, true), { phases: [{ id: 1, name: 'SrTiO3', color: '#d4a72c', ...std }], opts: { standard: true, irf: null, fit: {} }, list: [1], fell: [], bgFreed: [] });
  assert.equal(M.lastUnusable(null, res({ phases: [0] }), [lab], true), '');
  assert.equal(M.lastUnusable(null, res({ phases: [0] }), [lab], false), 'refined in the other role');
  assert.equal(M.lastUnusable(null, res({ phases: [0], standard: false }), [lab], false), '');
});

test('the instrument read once from the file\'s own bytes; a result written; the profile taken from it', ()=>{
  const f = pattern('s00.xrdml', xrdml(0)), i1 = M.instrOf(f);
  assert.equal(M.instrOf(f), i1, 'kept on the file');
  assert.deepEqual([i1.lam1, i1.lam2, i1.ratio, i1.radius, i1.monochromators], [1.540598, 1.544426, 0.5, 240, []]);
  // (bytes come back from a saved state as a plain array; one read before v426 lacks the monochromators: read again)
  const g = { ...pattern('s00.xrdml', xrdml(0)), rawBytes: Array.from(xrdml(0)) };
  assert.equal(M.instrOf(g).lam1, 1.540598);
  const old = { lam1: 1.5, monochromator: false };
  g.instr = old;
  assert.notEqual(M.instrOf(g), old);
  assert.equal(M.instrOf({ x: [], instr: old }), old, 'no bytes: the one it has');
  // A result as kept: the worker's, then its role, phases, profile, time and cells; frozen through.
  const ph = [{ id: 1, prep: M.prepOf(SRT, 'SrTiO3.cif') }];
  const r = M.resultRecord({ params: { a: 1 }, stats: { Rwp: 0.1 }, irf: { U: 1 }, ms: 3 }, ph, false, 1234);
  assert.deepEqual(Object.keys(r), ['params', 'stats', 'irf', 'ms', 'standard', 'phases', 'at', 'cells']);
  assert.deepEqual(r, { params: { a: 1 }, stats: { Rwp: 0.1 }, irf: { U: 1 }, ms: 3, standard: false, phases: [1], at: 1234, cells: { 1: '3.905,3.905,3.905,90,90,90' } });
  assert.ok(Object.isFrozen(r) && Object.isFrozen(r.params) && Object.isFrozen(r.stats) && Object.isFrozen(r.cells));
  assert.equal(M.resultRecord({ irf: { U: 1 } }, ph, true, 1).irf, null, 'the standard\'s: no profile of another');
  assert.equal(M.resultRecord({}, ph, false, 1).irf, null);
  // The profile: the standard's file's result in that role (or one too old to say), with the file's λ1 and radius.
  const fs = pattern('s11.xrdml', xrdml(11)), irf = r => M.irfOf(fs, r ? { 's11.xrdml': r } : {});
  const base = { U: 0.01, V: -0.002, W: 0.003, X: 0.02, Y: 0.01, asym: 0, zero: 0.012, lam1: 1.540598, radius: 240 };
  assert.equal(irf(), null);
  assert.deepEqual(irf(res({ phases: [0], standard: true })), base);
  assert.deepEqual(irf(res({ phases: [0] })), base, 'before v429: LaB6 alone was the standard\'s');
  assert.equal(irf(res({ phases: [1], standard: false })), null);
  assert.equal(irf(res({ phases: [3, 4] })), null);
  assert.equal(irf(res({ phases: [0], standard: true, params: null })), null);
  const ax = irf(res({ phases: [0], standard: true, params: { ...P, asym: 0.2, transp: 0.001, axL: 12 } }));
  assert.deepEqual(Object.keys(ax), ['U', 'V', 'W', 'X', 'Y', 'asym', 'zero', 'transp', 'axL', 'axP1', 'axP2', 'lam1', 'radius']);
  assert.deepEqual([ax.asym, ax.transp, ax.axL, ax.axP1], [0.2, 0.001, 12, undefined]);
  assert.equal(M.irfOf(undefined, {}), null);
  // A result's profile against the standard's now (an old one's has no λ1: U … zero decide).
  assert.ok(M.sameIrf({ U: 1, V: 0, zero: 0.1 }, { U: 1, zero: 0.1, lam1: 1.54, radius: 240 }));
  assert.ok(!M.sameIrf({ U: 1, zero: 0.1 }, { U: 1, zero: 0.2 }) && !M.sameIrf(null, { U: 1 }) && !M.sameIrf({ U: 1 }, null));
  // The Refinement settings a result was refined with, not the defaults, those of its role.
  assert.deepEqual(M.fitUsed(null, false), []);
  assert.deepEqual(M.fitUsed({}, false), []);
  assert.deepEqual(M.fitUsed({ fit: { cellRange: 0.1, zeroRange: 0.5, maxIter: 20, bgInv: false, shapeStarts: 3 } }, false),
    [{ k: 'maxIter', v: 20, said: 'max 20 iterations' }, { k: 'bgInv', v: false, said: '1/2θ term off' }, { k: 'cellRange', v: 0.1, said: 'cell search ±10 %' }]);
  assert.deepEqual(M.fitUsed({ fit: { cellRange: 0.1, zeroRange: 0.5, maxIter: 20 } }, true), [{ k: 'maxIter', v: 20, said: 'max 20 iterations' }, { k: 'zeroRange', v: 0.5, said: 'zero scan ±0.5°' }]);
  assert.deepEqual(M.fitUsed({ fit: { cellRange: 0.1, zeroRange: 0.5 }, standard: true }, false), [{ k: 'zeroRange', v: 0.5, said: 'zero scan ±0.5°' }], 'its own role');
  assert.deepEqual(M.fitUsed({ fit: { shapeStarts: 3, shapeFull: 2 }, models: { 1: { shape: 'box' } } }, false), [{ k: 'shapeStarts', v: 3, said: '3 shape starts' }, { k: 'shapeFull', v: 2, said: '2 shape starts refined fully' }]);
  assert.deepEqual(M.fitUsed({ fit: { lambda: 0.1, shiftTol: 0.01, bgDegree: 6 } }, false), [{ k: 'lambda', v: 0.1, said: 'starting λ 0.1' }]);
  // The phases a result was refined with, and the ticks before one.
  const sto = { id: 1, prep: ph[0].prep, color: '#d4a72c', off: {} }, bto = { id: 2, prep: M.prepOf(BTO, 'BaTiO3.cif'), color: '#c77dff', off: {} };
  assert.deepEqual(M.resultPhases(res({ phases: [1, 2] }), [sto, bto], [sto]).map(q=> q.id), [1, 2]);
  assert.deepEqual(M.resultPhases(res({ phases: undefined }), [sto, bto], [bto]).map(q=> q.id), [2], 'none named: those of the pattern');
  assert.throws(()=> M.resultPhases(res({ phases: [1, 9] }), [sto, bto], []), /^Error: The phases changed since this refinement\.$/);
  assert.throws(()=> M.resultPhases(res({ phases: [1], cells: { 1: '1,1,1,90,90,90' } }), [sto], []), /^Error: A phase is refined in another cell since this refinement\.$/);
  const tk = M.tickRows(f, [sto]);
  assert.deepEqual(tk.map(t=> [t.color, t.name, t.tt.length]), [['#d4a72c', 'SrTiO3', 10]]);
  assert.ok(Math.abs(tk[0].tt[0] - 22.753514761442876) < 1e-9 && Math.abs(tk[0].tt[2] - 39.95654424563906) < 1e-9);
  assert.deepEqual(M.groupTicks([{ phase: 1, tt: 22 }, { phase: 2, tt: 23 }, { phase: 1, tt: 32 }], [bto, sto]), [{ name: 'BaTiO3', color: '#c77dff', tt: [23] }, { name: 'SrTiO3', color: '#d4a72c', tt: [22, 32] }]);
});

test('the state saved and read back: a v428 sample\'s, the standard\'s with a CIF phase, a malformed one', ()=>{
  const lab6 = { id: M.LAB6_ID, ...M.stdSettings(), prep: M.prepPhase(LAB6, 'x'), off: {} };
  // As the card's restore and snapshot do (the views' choices are the card's: here as the state has them).
  const round = (s, std)=>{
    const t = M.readState(s, std);
    if (std) Object.assign(lab6, t.std);
    const view = std ? null : { sizeBy: s.sizeBy === 'peak' ? 'peak' : 'sample', resNorm: s.resNorm };
    return JSON.stringify(M.stateOf({ phases: t.phases, std, lab6, pick: t.pick, start: t.start, hold: t.hold, fit: t.fit, nextId: t.nextId, sel: Number.isInteger(s.sel) ? s.sel : null, results: M.resultsOf(s), view }),
      (k, v)=> k === 'cif' ? '<cif>' : v);
  };
  const v428 = { phases: [{ id: 1, cif: SRT, file: 'SrTiO3.cif', color: '#d4a72c', shape: 'box', profile: 'lognormal', strain: 'aniso', faults: '100:1/2<111>', po: 'auto', adp: '' }, { id: 4, cif: 'data_x', file: 'bad.cif', color: '#c77dff' }],
    refineB: true, start: 'last', hold: ['cell', 'nope', 'linear'], fit: { bgDegree: 9, x: 1 }, sel: 1, results: { 's00.xrdml': { at: 5, phases: [1], params: { a: 1 } } }, sizeBy: 'peak', resNorm: 'local' };
  assert.equal(round(v428, false), '{"phases":[{"id":1,"cif":"<cif>","file":"SrTiO3.cif","color":"#d4a72c","on":{"size":true,"wppm":true,"strain":true,"faults":true,"adp":true,"occ":false,"po":true},'
    + '"dep":{"size":"box","wppm":"lognormal","strain":"aniso","faults":"100:1/2<111>","adp":"overall","occ":"","po":"auto"},"off":{},"shape":"box","po":"auto","profile":"lognormal","strain":"aniso",'
    + '"faults":"100:1/2<111>","adp":"overall","occ":null}],"start":"last","hold":["linear","cell"],"fit":{"bgDegree":9},"nextId":2,"sel":1,"results":{"s00.xrdml":{"at":5,"phases":[1],"params":{"a":1}}},'
    + '"sizeBy":"peak","resNorm":"local"}');
  assert.ok(Object.isFrozen(v428.results['s00.xrdml'].params), 'the results frozen as they come');
  // The standard's: the rows that do not apply to it off, on a CIF phase too; its choice kept when there.
  const stdS = { phases: [{ id: 1, cif: SRT, file: 'SrTiO3.cif', color: '#c77dff', on: { size: true, wppm: true, strain: true, faults: true, adp: true, occ: true, po: true }, dep: { size: 'box', adp: 'site', po: '111', occ: 'Sr1' }, off: { a: 1, b: 0 } }],
    std: { on: { size: true, adp: true, po: 'x' }, dep: { adp: 'site' } }, pick: 1, start: 'cif', hold: 'x', fit: { zeroRange: 0.5, cellRange: 0.2 }, nextId: 7, sel: 1.5 };
  const stdWant = (adp, pick)=> '{"phases":[{"id":1,"cif":"<cif>","file":"SrTiO3.cif","color":"#c77dff","on":{"size":false,"wppm":false,"strain":false,"faults":false,"adp":true,"occ":false,"po":true},'
    + '"dep":{"size":"box","wppm":"wppm","strain":"iso","faults":"111:1/6<112>","adp":"site","occ":"Sr1","po":"111"},"off":{"a":true},"shape":false,"po":"111","profile":"lorentz","strain":"iso","faults":"",'
    + `"adp":"site","occ":null}],"std":{"on":{"size":false,"wppm":false,"strain":false,"faults":false,"adp":true,"occ":false,"po":false},"dep":{"size":"iso","wppm":"wppm","strain":"iso","faults":"111:1/6<112>","adp":"${adp}","occ":"","po":"auto"}},`
    + `"pick":${pick},"start":"cif","hold":["cell","instrument","sizestrain","shape","faults","adp","occ","texture"],"fit":{"cellRange":0.2,"zeroRange":0.5},"nextId":7,"sel":null,"results":{}}`;
  assert.equal(round(stdS, true), stdWant('site', 1));
  assert.equal(round({ ...stdS, pick: 9, std: undefined }, true), stdWant('overall', 0));
  assert.equal(round({}, false), '{"phases":[],"start":"cif","hold":' + JSON.stringify(HOLD_DEFAULT) + ',"fit":{},"nextId":1,"sel":null,"results":{},"sizeBy":"sample"}');
  // Phases that are no list: thrown before anything is read, as the restore threw.
  for (const phases of ['abc', 5, {}]) assert.throws(()=> M.readState({ phases }, false), TypeError);
  assert.deepEqual(M.resultsOf({ results: 'x' }), {});
});

test('the sizes charted, by sample (each phase its kinds) and by peak (a column a reflection)', ()=>{
  const tb = (phase, name, value, esd)=> ({ phase, name, value, esd });
  const results = { 's00.xrdml': { table: [tb('SrTiO3', 'crystallite_size_nm', 12.5, 0.5), tb('SrTiO3', 'cell_a', 3.9, 0.001), tb('BaTiO3', 'sphere_diameter_nm', 30, 2), tb('BaTiO3', 'shape_a_nm', 20, 1),
    tb('BaTiO3', 'shape_min_nm', 5, 1), tb('', 'crystallite_size_nm', 3, 1), tb('SrTiO3', 'size_volume_mean_nm', 14, NaN)] }, 's01.xrdml': { table: [tb('SrTiO3', 'size_volume_mean_nm', 15, 1)] } };
  const fs = [{ name: 's00.xrdml', label: 's00', color: '#111' }, { name: 's01.xrdml', label: 's01', color: '#222' }];
  assert.deepEqual([...M.sizesOf(results['s00.xrdml'])], [['SrTiO3', [{ v: 12.5, e: 0.5, shape: false, kind: 'scherrer' }]], ['BaTiO3', [{ v: 30, e: 2, shape: false, kind: 'sphere' }, { v: 20, e: 1, shape: true, kind: 'shape' }]]]);
  assert.deepEqual([M.sizeKinds(fs, results), M.sizeKinds(fs, results, 'SrTiO3'), M.sizeKinds(fs, results, 'BaTiO3')], [['scherrer', 'sphere', 'volume', 'shape'], ['scherrer', 'volume'], ['sphere', 'shape']]);
  const colorOf = n => ({ SrTiO3: '#d4a72c', BaTiO3: '#c77dff' })[n];
  assert.deepEqual(M.sizeMarks(fs, results, 'sample', colorOf), {
    cols: [{ label: 's00', name: 's00.xrdml' }, { label: 's01', name: 's01.xrdml' }],
    marks: [{ x: 1, v: 12.5, e: 0.5, color: '#d4a72c', dx: -9 }, { x: 1, top: 13, dx: -9, label: '12.5±0.5 Scherrer' },
      { x: 1, v: 30, e: 2, color: '#c77dff', dx: 9 }, { x: 1, v: 20, e: 1, color: '#c77dff', dx: 9 }, { x: 1, top: 32, dx: 9, label: '30.0±2.0 / 20.0±1.0 sphere' },
      { x: 2, v: 15, e: 1, color: '#d4a72c', dx: -9 }, { x: 2, top: 16, dx: -9, label: '15.0±1.0 volume mean' }],
    series: [{ name: 'SrTiO3: Scherrer size / volume-weighted mean diameter (WPPM)', color: '#d4a72c' }, { name: 'BaTiO3: sphere diameter (WPPM) / free shape\'s dimensions', color: '#c77dff' }] });
  // By peak: the reflections the tests use, matched across the patterns by their indices (a
  // label of v479 or older has no plain one).
  const w = (label, tt, D, o)=> ({ label, plain: label, tt, D, Desd: 1, ...o });
  const byPeak = { 's00.xrdml': { widths: { phases: [{ name: 'SrTiO3', rows: [w('100', 22.7, 10), w('1-10', 32.4, 12, { Desd: 2 }), w('111', 40, 9, { weak: true })] }] } },
    's01.xrdml': { widths: { phases: [{ name: 'SrTiO3', rows: [w('100', 22.8, 11, { plain: undefined })] }] } } };
  assert.deepEqual(M.sizeMarks(fs, byPeak, 'peak', colorOf), {
    cols: [{ label: '100', name: 'SrTiO3 (100)', hkl: '100' }, { label: '1-10', name: 'SrTiO3 (1-10)', hkl: '1-10' }],
    marks: [{ x: 1, v: 10, e: 1, color: '#111', dx: -5 }, { x: 1, v: 11, e: 1, color: '#222', dx: 5 }, { x: 2, v: 12, e: 2, color: '#111', dx: -5 }],
    series: [{ name: 's00', color: '#111' }, { name: 's01', color: '#222' }] });
});

test('the CSVs: the curves, a row per pattern and quantity (the stale profile, the settings used), the peak widths', ()=>{
  // utils.js fmtData and csvLine as v511 has them (it needs a page to load), for a decimal mark and ';'.
  const fmt = dec => (v, decimals)=>{ if (!isFinite(v)) return ''; const d = Math.max(0, Math.round(decimals) || 0);
    return (v !== 0 && Math.abs(v) < Math.pow(10, 2 - d) ? String(parseFloat(v.toPrecision(Math.max(3, d)))) : v.toFixed(d)).replace('.', dec); };
  const line = vals => vals.map(v=>{ const s = v == null ? '' : String(v); return s.includes(';') || /["\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(';') + '\n';
  const files = [{ name: 's00.xrdml', label: 's00; "a"', x: [10, 10.5], y: [100, 120] }, { name: 's01.xrdml', label: 's01', x: [10], y: [5] }, { name: 's02.xrdml', label: 's02', x: [10], y: [5] }];
  const wd = { corrected: false, phases: [{ name: 'SrTiO3', shaped: true, rows: [
    { plain: '1-10', tt: 32.4, rel: 1, H: 0.2, Hesd: 0.01, eta: 0.5, Hs: 0.15, HsEsd: 0.01, D: 12, Desd: 1, dd: 0.004, ddEsd: 0.0002, model: { iso: 0.16, shape: 0.15 }, HsEsdFit: 0.005 },
    { plain: '100', tt: 22.7, rel: 0.5, H: 0.1, Hesd: 0.01, eta: 0.4, flat: true, HsMax: 0.01, Hs: 0.001, HsEsd: 0.002, D: 50, Desd: 5, dd: 0.001, ddEsd: 0.0001, model: { iso: 0.1, shape: 0.11 } }] }] };
  const results = { 's00.xrdml': { params: {}, stats: { Rwp: 0.1, Rexp: 0.05, chi2: 4 }, fit: { cellRange: 0.1, bgInv: false }, irfRefused: true, widths: wd,
    table: [{ phase: 'SrTiO3', name: 'cell_a', value: 3.905123456789, esd: 3e-7 }, { phase: null, name: 'zero', value: null, esd: null }] },
    's01.xrdml': { params: {}, stats: {}, phases: [9] }, 's02.xrdml': { table: [] } };
  const curves = (f, r)=>{ if (r.phases) throw new Error('The phases changed since this refinement.'); return { c: { yc: [90, 110], bg: [10, 12] } }; };
  const out = M.csvTables('Rv - ', files, results, { curves, stale: f=> f.name === 's00.xrdml', std: false }, { data: fmt(','), line, decimal: ',' });
  assert.deepEqual(out.map(o=> o.name), ['Rv - rietveld_pattern.csv', 'Rv - rietveld_results.csv', 'Rv - rietveld_peaks.csv']);
  assert.equal(out[0].text, '"2Theta_s00; ""a"""' + ';"Observed_s00; ""a""";"Calculated_s00; ""a""";"Background_s00; ""a""";"Difference_s00; ""a"""\n10,00000;100,000;90,000;10,000;10,000\n10,50000;120,000;110,000;12,000;10,000\n');
  const L = '"s00; ""a"""';
  assert.equal(out[1].text, 'Pattern;Phase;Quantity;Value;Esd;Rwp;Rexp;chi2\n'
    + `${L};SrTiO3;cell_a;3,90512346;3e-7;10,000;5,000;4,000\n${L};;zero;;;10,000;5,000;4,000\n${L};;standard_changed_since;1;;10,000;5,000;4,000\n`
    + `${L};;fit_bgInv;0;;10,000;5,000;4,000\n${L};;fit_cellRange;0,1;;10,000;5,000;4,000\n`);
  assert.equal(out[2].text, 'Pattern;Phase;hkl;2Theta_deg;Relative_intensity;FWHM_deg;FWHM_esd_deg;eta;FWHM_corr_deg;FWHM_corr_esd_deg;Size_corr_nm;Size_corr_esd_nm;Delta_dstar_invA;Delta_dstar_esd_invA;Model_isotropic_FWHM_corr_deg;Model_free_shape_FWHM_corr_deg;Used_by_tests;Note\n'
    + `${L};SrTiO3;1-10;32,40000;1,0000;0,20000;0,01000;0,500;0,15000;0,01000;12,0000;1,0000;0,004000;0,000200;0,16000;0,15000;yes;"not corrected: the standard is of another wavelength; esds widened from the fit's 0,00500 deg by what a misfitting phase's reflections could do to it"\n`
    + `${L};SrTiO3;100;22,70000;0,5000;0,10000;0,01000;0,400;0,01000;;50,0000;5,0000;;;0,10000;0,11000;no;"no broadening above the instrument (the corrected FWHM an upper limit, 2 esd); not corrected: the standard is of another wavelength"\n`);
  // Nothing refined: no file.
  assert.deepEqual(M.csvTables('', files, {}, { curves, stale: ()=> false, std: false }, { data: fmt('.'), line, decimal: '.' }), []);
});

test('the words: indices barred, formulae, what a phase is refined with, the instrument, the solids; names from a CIF escaped', ()=>{
  assert.deepEqual(['1-10', '1 -1 11', '300 + 221', '11̅0', '-1-1-1'].map(M.hklRuns), [[['1', false], ['1', true], ['0', false]], [['1 ', false], ['1', true], [' 11', false]], [['300 + 221', false]],
    [['1', false], ['1', true], ['0', false]], [['1', true], ['1', true], ['1', true]]]);
  assert.equal(H.hklHtml('1-10'), '1<span class="hkl-bar"><span class="hkl-sign">-</span>1</span>0');
  assert.equal(H.hklHtml('-1-1'), '<span class="hkl-bar"><span class="hkl-sign">-</span>1</span><span class="hkl-bar hkl-bar2"><span class="hkl-sign">-</span>1</span>');
  assert.equal(H.barIdx('plates ⟂ ⟨1-10⟩ and (1 -1 11), not (110)'), 'plates ⟂ ⟨1<span class="hkl-bar"><span class="hkl-sign">-</span>1</span>0⟩ and (1 <span class="hkl-bar"><span class="hkl-sign">-</span>1</span> 11), not (110)');
  assert.deepEqual([H.optBars('(1-10)'), H.optBars('(-1-10)'), H.optBars('(110)')], ['(11̅0)', '(1̅ 1̅0)', '(110)']);
  assert.deepEqual([M.plotRuns('SrTiO3 1-10', '1-10'), M.plotRuns('110', '110'), M.plotRuns('…0', '1-10')], [[['SrTiO3 ', false], ['1', false], ['1', true], ['0', false]], null, null]);
  assert.deepEqual([M.hklShow('300/221'), M.hklPlain('300 / 221')], ['300 + 221', '300 + 221']);
  assert.equal(H.formulaPretty('Sr0.5Ba0.5TiO3 <b>'), 'Sr₀.₅Ba₀.₅TiO₃ &lt;b&gt;');
  const sto = { id: 1, ...M.defSettings(), prep: M.prepOf(SRT, 'SrTiO3.cif') }, lab = { id: 0, ...M.stdSettings(), prep: M.prepPhase(LAB6, 'x') };
  const all = { on: Object.fromEntries(M.MODES.map(m=> [m.k, true])), dep: { size: 'sqbox', wppm: 'lognormal', strain: 'aniso', faults: '001:1/3<1-10>', adp: 'aniso', occ: 'O1', po: '111' } };
  assert.deepEqual([H.summaryOf(sto, false), H.summaryOf({ ...sto, ...all }, false), H.summaryOf(lab, true)], ['isotropic size · Lorentzian · microstrain isotropic · B from the CIF',
    'free shape: square-based box · WPPM, log-normal sizes · microstrain anisotropic (Stephens) · planar faults (001) ⅓⟨1-10⟩ · U per site, anisotropic · occupancy of O1 · preferred orientation (111)',
    'the instrument\'s profile · one ΔB']);
  assert.equal(H.modelsLine({ size: true, shape: false, profile: 'lorentz', strain: 'iso', faults: null, adp: 'cif', po: null, occ: null }, false, 'box'), 'isotropic size (a free box searched, not kept) · Lorentzian · microstrain isotropic · B from the CIF');
  assert.deepEqual([H.refinedOf(sto, { models: { 1: { size: true, shape: 'box', profile: 'wppm', strain: 'aniso', adp: 'site', occ: ['Sr1'] } }, shapes: { 1: {} }, textures: { 1: { hkl: [1, 1, 0] } } }, false),
    H.refinedOf(sto, { models: { 1: { shape: 'box' } } }, false), H.refinedOf(sto, {}, false)],
  ['free shape: box · WPPM, one size · microstrain anisotropic (Stephens) · B per site · occupancy of Sr1 · preferred orientation (110)',
    'isotropic size (a free box searched, not kept) · Lorentzian · microstrain isotropic · B from the CIF', 'isotropic size · Lorentzian · microstrain isotropic · B from the CIF']);
  assert.equal(H.instrLine(null), '');
  assert.equal(H.instrLine(M.instrOf(pattern('s00.xrdml', xrdml(0)))), ' Kα₁ 1.540598 Å, Kα₂ 1.544426 Å (×0.5) · R 240 mm — ⚠ No goniometer radius in the file: 240 mm assumed (the specimen displacement in mm depends on it); No divergence slit in the file: a fixed slit is assumed');
  assert.equal(H.instrLine({ lam1: 1.5406, lam2: 1.5444, ratio: 0.5, anode: 'Cu', radius: 240, divergence: { type: 'Fixed', deg: 0.25 }, soller: { incident: 0.04 }, filter: { material: 'Ni' }, monochromator: true,
    monochromators: [{ side: 'diffracted', crystal: 'graphite', reflections: 1 }, { side: 'incident', crystal: 'Ge(111)', reflections: 2 }], monoK: 0.7998, detector: { name: 'PIXcel' }, warnings: ['a', 'b'] }),
  'Cu Kα₁ 1.5406 Å, Kα₂ 1.5444 Å (×0.5) · R 240 mm · Fixed divergence slit 0.25° · Soller 0.04 rad · Ni filter · diffracted graphite + incident Ge(111)×2 monochromator (K 0.800) · PIXcel — ⚠ a; b');
  assert.deepEqual(['ellipsoid', 'spheroid', 'cylinder', 'ellcyl', 'box', 'sqbox'].map((type, i)=> H.solidCaption({ type, kind: 'free', dims: [9.95, 10, i ? 123.4 : Infinity] })),
    ['ellipsoid, free: axes 9.9 × 10 × ∞ nm', 'spheroid, free: 9.9 nm across, 123 nm along its axis', 'cylinder, free: diameter 9.9 nm, height 123 nm', 'elliptic cylinder, free: 9.9 × 10 nm across, height 123 nm',
      'box, free: 9.9 × 10 × 123 nm', 'square-based box, free: base 9.9 × 9.9 nm, height 123 nm']);
  assert.deepEqual([NaN, 0, 0.00041234, 0.0999, 0.1, 1.23456].map(H.f3), ['—', '0.000', '0.000412', '0.0999', '0.100', '1.235']);
  assert.deepEqual([1e-301, 2e-4, 0.0012345, 0.5].map(H.fmtP), ['< 1e-300', '2e-4', '0.0012', '0.5']);
  assert.equal(H.group('Fit', '<b>x</b>', true), '<div class="rv-group"><div class="txt-mini rv-phase-name">Fit</div><b>x</b></div>');
  assert.equal(H.warnNote('t'), '<div class="rv-note rv-wide rv-warn">⚠ t</div>');
  // A CIF's name, file and notes go in as text: no element made, an apostrophe as it is (xrd-rv.js's own esc).
  assert.equal(H.esc(`<a href="x">it's & co</a>`), '&lt;a href=&quot;x&quot;&gt;it\'s &amp; co&lt;/a&gt;');
  const evil = `"'><i data-x=1></i>`, q = { id: 3, color: '#000', file: evil + '.cif', ...M.defSettings(), off: {}, prep: { ...M.prepOf(SRT, 'SrTiO3.cif'), name: evil, notes: [evil] } };
  const rows = H.phaseRowsHtml([q], { p: 'zz', std: false, pick: 0, sel: 3, f: null, lab6: null, dlIcon: ()=> '', xIcon: ()=> '' });
  const cell = H.cellDetailsHtml(q, false), body = H.settingsBodyHtml([q], { p: 'zz', std: false, lab6: null, ...M.rowsFor(false), normOptions: '' });
  for (const html of [rows, cell, body]) assert.ok(!html.includes('<i data-x') && html.includes('&quot;\'&gt;&lt;i data-x=1&gt;&lt;/i&gt;'), 'escaped');
  assert.ok(cell.includes('<div class="rv-ci-note">&quot;\'&gt;&lt;i data-x=1&gt;&lt;/i&gt;.</div>'));
});
