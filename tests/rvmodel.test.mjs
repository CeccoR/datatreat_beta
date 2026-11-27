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
   split), read in its page.
   From v559 (out of v558's createRietveld, xrd-rv.js no longer one closure) the card's own
   state: its phases added and removed, the Refinement entries taken or refused, what a run
   takes and says, the keys its views are kept under and what they are drawn from (the
   pattern's frame, the stacked plot, the sizes' points, Williamson–Hall's), the state put back
   and what the card shows beside it, its markup; and 60 cases as v558's xrd-rv.js gave them,
   run from its source on a page of stubs (below), their digests in tests/golden/rvmodel.json
   (npm run test:update writes them anew after a change meant to alter them). utils.js's
   helpers, which need a page to load, are taken from their source as they stand there. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { CIF, xrdml, rng } from './fixtures.mjs';
import { readXrdmlScanText } from '../xrd-instr.js';
import { buildModel, fitSettings } from '../xrd-rietveld.js';
import * as M from '../xrd-rv-model.js';
import * as H from '../xrd-rv-html.js';
import { ALERT_ICON } from '../alerts.js';

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

/* v568: a CIF whose H-M symbol is written blank (' ', or '' before another tag) names no group,
   nor does a blank Hall symbol or magnetic name (27; to v567 a group of no name: with
   operations listed the file was refused, "Cannot read properties of undefined (reading
   'toUpperCase')", without them its note read "operations for :"). */
test('a CIF whose H-M symbol is blank: read as one that gives none', ()=>{
  const cif = (hm, ops) => `data_x\n_cell_length_a 3.905\n_cell_length_b 3.905\n_cell_length_c 3.905\n_cell_angle_alpha 90\n_cell_angle_beta 90\n_cell_angle_gamma 90\n${hm}`
    + (ops ? "loop_\n_symmetry_equiv_pos_as_xyz\n'x, y, z'\n'-x, -y, -z'\n" : '')
    + 'loop_\n_atom_site_label\n_atom_site_type_symbol\n_atom_site_fract_x\n_atom_site_fract_y\n_atom_site_fract_z\nSr1 Sr 0 0 0\nTi1 Ti 0.5 0.5 0.5\nO1 O 0.5 0.5 0\nO2 O 0.5 0 0.5\nO3 O 0 0.5 0.5\n';
  const B = 'No displacement parameter for Sr1, Ti1, O1, O2, O3: B = 0.5 Å² assumed.';
  const read = (hm, ops)=>{ const q = M.prepPhase(cif(hm, ops), 'blank.cif'); return [q.sg, q.sgFrom, q.order, q.warnings, q.notes]; };
  assert.deepEqual(read("_symmetry_space_group_name_H-M ' '\n", true), ['Pm-3m', 'atoms', 48, [B], ['2 operations in the file; the structure has 48']], 'with its operations: read');
  assert.deepEqual(read("_symmetry_space_group_name_H-M ' '\n", false), ['Pm-3m', 'atoms', 48, [B], []], 'without: no note of a group');
  assert.deepEqual(read("_space_group_name_H-M_alt ''\n_symmetry_space_group_name_H-M 'P m -3 m'\n", false),
    ['Pm-3m', 'cif', 48, [B, 'The CIF lists no symmetry operations for P m -3 m: the atoms are taken as they are (P1), so the cell is filled only if they are all listed.'], []], 'the next tag\'s symbol');
  // (a Hall symbol or a magnetic group's name written blank alike: no group named, no note)
  assert.deepEqual(read("_space_group_name_Hall ' '\n_space_group_magn_name_BNS ' '\n", false), ['Pm-3m', 'atoms', 48, [B], []]);
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
  assert.deepEqual([s.fits.map(m=> m.k), s.modes.length, s.holds.length], [['maxIter', 'shiftTol', 'lambda', 'bgDegree', 'bgInv', 'cellRange', 'shapeFull', 'shapeTiltSets', 'shapeLine'], 7, 9]);
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
    ['shapeFull', true, false, false, '', true, 1, 20, '1–20', 'a whole number from 1 to 20'],
    ['shapeTiltSets', true, false, false, '', true, 0, 8, '0–8', 'a whole number from 0 to 8'],
    ['shapeLine', false, false, false, '', true, undefined, undefined, undefined, undefined]]);
  assert.deepEqual(M.FIT_DEF, { maxIter: 40, shiftTol: 0.01, lambda: 0.001, bgDegree: 6, cellRange: 0.05, zeroRange: 1, shapeFull: 3, shapeTiltSets: 0, bgInv: 'auto', shapeLine: 'lorentz' });
  const read = [['maxIter', '50', 50], ['maxIter', ' 50 ', 50], ['maxIter', '50.0', null], ['maxIter', '1,000', null], ['maxIter', '1e2', 100], ['maxIter', '0', null], ['maxIter', '', null],
    ['maxIter', '0x10', null], ['maxIter', 'Infinity', null], ['shiftTol', '0,05', 0.05], ['shiftTol', '1e-3', 0.001], ['shiftTol', '.5', 0.5], ['shiftTol', '-0', null], ['shiftTol', '1e', null],
    ['lambda', '1e-8', 1e-8], ['lambda', '1e-9', null], ['lambda', '1000', 1000], ['lambda', '1001', null], ['cellRange', '7,3', 0.073], ['cellRange', '7.3', 0.073], ['cellRange', '0', null],
    ['zeroRange', '0,5', 0.5], ['bgDegree', '12', 12], ['bgDegree', '2.5', null], ['shapeTiltSets', '0', 0], ['shapeTiltSets', '8', 8], ['shapeTiltSets', '9', null], ['shapeTiltSets', '1.5', null]];
  read.forEach(([k, raw, want])=> assert.equal(M.readFit(M.FIT[k], raw), want, `${k} ${JSON.stringify(raw)}`));
  for (const s of [undefined, null, 'x', {}, { shapeFull: 3, bgInv: 'true', maxIter: 1e9, bgDegree: 6 }]) assert.deepEqual(M.cleanFit(s), {}, JSON.stringify(s));
  // (v524: the random starts' setting no longer one; a project of v523 or older that set it opens without it)
  assert.deepEqual(M.cleanFit({ shapeStarts: 20, shapeFull: 5 }), { shapeFull: 5 });
  // (v525: the extra tilt sets kept when not 0; a project of v524 or older has none, so 0)
  assert.deepEqual(M.cleanFit({ shapeTiltSets: 2 }), { shapeTiltSets: 2 });
  assert.deepEqual(M.cleanFit({ shapeTiltSets: 0, shapeFull: 3 }), {});
  // (v528: the shape's size line, a choice: the exact line kept, the Lorentzian (default) and anything else dropped)
  assert.deepEqual(M.cleanFit({ shapeLine: 'exact' }), { shapeLine: 'exact' });
  for (const v of ['lorentz', 'wppm', true, 1]) assert.deepEqual(M.cleanFit({ shapeLine: v }), {}, String(v));
  assert.match(M.FIT.shapeLine.full, /more accurate.*13–25 %.*tuned on the exact line.*Default: Lorentzian\.$/s);
  // (a key unknown, out of range, not whole or at its default dropped; the rest in FITS' order, as text)
  const c = M.cleanFit({ bgDegree: 9, maxIter: 50, lambda: 0.001, x: 1, cellRange: 0.073, bgInv: false, shapeStarts: 2.5, zeroRange: -0, shiftTol: NaN });
  assert.equal(JSON.stringify(c), '{"maxIter":50,"bgDegree":9,"bgInv":false,"cellRange":0.073}');
  // The rule of an entry not taken, said under its field (v571: to v570 the note at the
  // section's foot, the setting's name first, "—"); Defaults offered when one shown is set.
  assert.equal(M.fitRefusal(M.FIT.maxIter, ' 1.000 ', '40'), 'A whole number from 1 to 1000, without a point or comma: “1.000” not taken; 40 kept.');
  assert.equal(M.fitRefusal(M.FIT.cellRange, 'twenty percent', '5'), 'A number from 0.5 to 20 %: “twenty perce…” not taken; 5 kept.');
  assert.equal(M.fitRefusal(M.FIT.lambda, '', '0.001'), 'A number from 1e-8 to 1000; 0.001 kept.');
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
  // (a result of v523 or older refined with shapeStarts: not said, no longer a setting)
  assert.deepEqual(M.fitUsed({ fit: { shapeStarts: 3, shapeFull: 2 }, models: { 1: { shape: 'box' } } }, false), [{ k: 'shapeFull', v: 2, said: '2 shape starts refined fully' }]);
  assert.deepEqual(M.fitUsed({ fit: { lambda: 0.1, shiftTol: 0.01, bgDegree: 6 } }, false), [{ k: 'lambda', v: 0.1, said: 'starting λ 0.1' }]);
  // (v525: the extra tilt sets said with a free shape only; 0 and an older result's none not said)
  assert.deepEqual(M.fitUsed({ fit: { shapeTiltSets: 1 }, models: { 1: { shape: 'box' } } }, false), [{ k: 'shapeTiltSets', v: 1, said: '1 extra shape tilt set' }]);
  assert.deepEqual(M.fitUsed({ fit: { shapeTiltSets: 3 } }, false), []);
  assert.deepEqual(M.fitUsed({ fit: { shapeTiltSets: 0, shapeFull: 3 }, models: { 1: { shape: 'box' } } }, false), []);
  // (v528: the exact line said with a free shape; a result of v523–v527, none kept, read from its models: WPPM was the exact line)
  assert.deepEqual(M.fitUsed({ fit: { shapeLine: 'exact' }, models: { 1: { shape: 'box', profile: 'wppm' } } }, false), [{ k: 'shapeLine', v: 'exact', said: "the shape's exact size line" }]);
  assert.deepEqual(M.fitUsed({ fit: { shapeLine: 'lorentz' }, models: { 1: { shape: 'box', profile: 'lorentz' } } }, false), []);
  assert.deepEqual(M.fitUsed({ fit: { shapeFull: 3 }, models: { 1: { shape: 'box', profile: 'wppm' } } }, false).map(u=> u.v), ['exact']);
  assert.deepEqual(M.fitUsed({ fit: { shapeFull: 3 }, models: { 1: { shape: 'box', profile: 'lorentz' } } }, false), [], 'v522: the Lorentzian');
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
  // Phases that are no list: none, the rest read (18, v568; to v567 they threw, and a project
  // holding them stopped halfway through its restore).
  for (const phases of ['abc', 5, {}, null]) assert.equal(round({ phases, start: 'last', nextId: 4 }, false), '{"phases":[],"start":"last","hold":' + JSON.stringify(HOLD_DEFAULT) + ',"fit":{},"nextId":4,"sel":null,"results":{},"sizeBy":"sample"}');
  assert.deepEqual(M.readState({ phases: 'x' }, true).phases, []);
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
  // A phase not detected (left out, its texture unrefined): no texture listed (4, v568; to v567
  // "preferred orientation (110)", the engine's result holding its axis at r = 1); detected, or a
  // result without `detected` (v428's), listed.
  const tx = { models: { 1: { size: true, profile: 'lorentz', strain: 'iso', adp: 'cif' } }, textures: { 1: { hkl: [1, 1, 0], r: 1, spec: [1, 1, 0] } } };
  assert.deepEqual([H.refinedOf(sto, { ...tx, detected: [2] }, false), H.refinedOf(sto, { ...tx, detected: [1] }, false), H.refinedOf(sto, tx, false), H.refinedOf(sto, { ...tx, detected: ['1'] }, false)],
    ['isotropic size · Lorentzian · microstrain isotropic · B from the CIF', ...Array(3).fill('isotropic size · Lorentzian · microstrain isotropic · B from the CIF · preferred orientation (110)')]);
  assert.equal(H.instrLine(null), '');
  // (v571: the line the facts alone; what was assumed in a box of each kind under it, X05; no
  // description at all, what the model assumes, at once, X06)
  const ins0 = M.instrOf(pattern('s00.xrdml', xrdml(0)));
  assert.equal(H.instrLine(ins0), ' Kα₁ 1.540598 Å, Kα₂ 1.544426 Å (×0.5) · R 240 mm');
  assert.equal(H.instrNotesHtml(ins0), '<div class="alert info compact">' + ALERT_ICON.info + 'No goniometer radius in the file: 240 mm assumed (the specimen displacement in mm depends on it).<br>No divergence slit in the file: a fixed slit is assumed.</div>');
  assert.equal(H.instrNotesHtml(null), '<div class="alert warn compact">⚠ No instrument description could be read from the file: Cu Kα₁/Kα₂ (ratio 0.5), a 240 mm goniometer and no monochromator are assumed.</div>');
  // Each assumption's kind: neutral (info) or one that may be wrong (warn), by its words.
  const said = { warnings: ['No wavelength in the file: Cu Kα assumed (Kα₁ 1.540598 Å, Kα₂ 1.544426 Å, Kα₂/Kα₁ 0.5)', 'No Kα₂ in the file: a single wavelength is modelled', 'No Kα₂/Kα₁ ratio in the file: 0.5 assumed',
    'Kα₂/Kα₁ ratio 2 out of range: 0.5 assumed', 'Diffracted-beam monochromator: crystal "x" not recognised, graphite (002) assumed for the polarisation (K = 0.800)',
    'Diffracted-beam monochromator: Ge(333) cannot reflect λ = 2.29 Å, graphite(002) assumed for the polarisation (K = 0.800)', 'Incident-beam monochromator: no reflection given, Ge(111) assumed for the polarisation (K = 0.799)',
    'Incident-beam monochromator: Ge(111) passes Kα₁ alone, so the file\'s Kα₂/Kα₁ ratio of 0.5 is not used', 'Sample mode "Transmission": the model is Bragg–Brentano reflection, whose Lorentz–polarisation and displacement terms do not hold here',
    'Scan axis "Omega": the model assumes a coupled θ–2θ (Gonio) scan, which Bragg–Brentano focusing needs', 'Automatic divergence slit: the intensities grow as sinθ against a fixed slit, which the model does not correct yet (the data need dividing by sinθ)',
    'Programmable divergence slit with no irradiated length in the file: modelled as a fixed slit (if it ran in automatic mode, the data need dividing by sinθ)', 'Divergence slit of unknown kind ("y"): a fixed slit is assumed',
    'Incident-beam monochromator ("z"): it usually passes Kα₁ alone, but the file gives a Kα₂/Kα₁ ratio of 0.5 (check it)', 'something new'] };
  assert.deepEqual(said.warnings.map(M.instrNoteKind), ['warn', 'info', 'info', 'info', 'info', 'warn', 'info', 'info', 'warn', 'warn', 'warn', 'warn', 'info', 'warn', 'warn']);
  const notes = H.instrNotesHtml(said);
  assert.ok(notes.startsWith('<div class="alert warn compact">⚠ No wavelength in the file') && notes.includes('<div class="alert info compact">') && notes.indexOf('alert warn') < notes.indexOf('alert info') && notes.endsWith('a fixed slit is assumed.</div>'), notes);
  assert.equal(H.instrLine({ lam1: 1.5406, lam2: 1.5444, ratio: 0.5, anode: 'Cu', radius: 240, divergence: { type: 'Fixed', deg: 0.25 }, soller: { incident: 0.04 }, filter: { material: 'Ni' }, monochromator: true,
    monochromators: [{ side: 'diffracted', crystal: 'graphite', reflections: 1 }, { side: 'incident', crystal: 'Ge(111)', reflections: 2 }], monoK: 0.7998, detector: { name: 'PIXcel' }, warnings: ['a', 'b'] }),
  'Cu Kα₁ 1.5406 Å, Kα₂ 1.5444 Å (×0.5) · R 240 mm · Fixed divergence slit 0.25° · Soller 0.04 rad · Ni filter · diffracted graphite + incident Ge(111)×2 monochromator (K 0.800) · PIXcel');
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
  // What to check in the structure, a compact warning (v571, X13: to v570 a grey note).
  const qc = { ...q, prep: { ...q.prep, notes: [], cautions: ['the occupancies give O 2, the formula × Z 3: vacancies <b>'] } };
  assert.ok(H.cellDetailsHtml(qc, false).endsWith('<div class="alert warn compact rv-ci-warn">⚠ The occupancies give O 2, the formula × Z 3: vacancies &lt;b&gt;.</div>'));
});

/* ---- v559: the card's state and its views, out of xrd-rv.js's createRietveld ---- */
const UPDATE = !!process.env.UPDATE_GOLDEN || process.env.npm_lifecycle_event === 'test:update';
const GOLDEN = new URL('./golden/rvmodel.json', import.meta.url);
const sha = s => createHash('sha256').update(s).digest('hex');
// A canonical dump: every number by its shortest round-trip string, NaN, ±∞ and −0 too.
const canon = v => JSON.stringify(v, function(k, x){ const o = this[k]; return typeof o === 'number' ? (Object.is(o, -0) ? '#-0' : '#' + o) : x; });
// utils.js's helpers the card takes (it needs a page to load): from its source as they stand.
function decl(file, name){
  const src = fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');
  let i = src.search(new RegExp(`^(export )?function ${name}\\(`, 'm'));
  if (i >= 0){
    let k = src.indexOf(')', i), d = 0;
    for (k = src.indexOf('{', k); k < src.length; k++){ if (src[k] === '{') d++; else if (src[k] === '}' && !--d) break; }
    return src.slice(i, k + 1).replace(/^export /, '');
  }
  i = src.search(new RegExp(`^(export )?const ${name} = `, 'm'));
  assert.ok(i >= 0, name + ' in ' + file);
  const rest = src.slice(i), m = /\n(?=\S)/.exec(rest);
  return rest.slice(0, m ? m.index : rest.length).replace(/^export /, '');
}
const UN = ['fmtData', 'csvField', 'csvJoin', 'csvLine', 'maxArr', 'normOf', 'NORM_OPTIONS', 'X_SVG', 'DL_SVG'];
const PAGE = new Function('settings', UN.map(n=> decl('utils.js', n)).join('\n') + `\nreturn { ${UN.join(', ')} };`)({ decimal: '.', field: ';' });
const U = { maxArr: PAGE.maxArr, normOf: PAGE.normOf };
const HU = { snavHtml: o => `<div class="snav" id="${o.prev}+${o.next}+${o.name}"></div>`, PLOT_DL_ICON: '<svg class="i-dl"></svg>', CSV_ICON: '<svg class="i-csv"></svg>' };
// A card's state as xrd-rv.js cardState makes it (the fields the model reads and sets).
const card = (std, o = {})=> ({ std, res: std ? null : {}, phases: [], nextId: 1, results: {}, startFrom: 'cif', hold: HOLD_DEFAULT.slice(), fit: {}, busy: false, cur: null, waiting: null, wrote: null,
  sel: null, pick: 0, sizeBy: 'sample', resNorm: 'global', fitNote: null, setKey: 'k', solidTurns: new Map(), solidViews: [], pkSel: null, cellV: null, cellKeyShown: '', cellNext: null,
  lab6: { id: M.LAB6_ID, cif: LAB6, file: '', color: '#4cc9a0', ...M.stdSettings(), prep: M.prepPhase(LAB6, 'LaB6'), off: {} }, ...o });

test('the card\'s state: its phases, a phase added and removed, the Refinement entries taken or refused, what a run takes and says', ()=>{
  const S = card(false), prep = M.prepOf(SRT, 'SrTiO3.cif');
  const q1 = M.newPhase(S.nextId++, SRT, 'SrTiO3.cif', prep, 0, false), q2 = M.newPhase(S.nextId++, BTO, 'BaTiO3.cif', M.prepOf(BTO, 'BaTiO3.cif'), 7, false);
  assert.deepEqual(Object.keys(q1), ['id', 'cif', 'file', 'color', 'prep', 'on', 'dep', 'off'], 'the state\'s key order');
  assert.deepEqual([q1.id, q1.color, q2.id, q2.color, q1.on, q1.dep, q1.off], [1, '#d4a72c', 2, '#c77dff', DEF.on, DEF.dep, {}]);
  assert.deepEqual(M.newPhase(9, SRT, 'a.cif', prep, 1, true).on, STD.on, 'the standard\'s own settings');
  S.phases.push(q1, { ...q2, off: { 's00.xrdml': true } });
  assert.deepEqual([M.allPhases(S).map(q=> q.id), M.phasesFor(S, { name: 's00.xrdml' }).map(q=> q.id), M.phasesFor(S, { name: 's01.xrdml' }).map(q=> q.id), M.phasesFor(S, null).length], [[1, 2], [1], [1, 2], 2]);
  const T = card(true, { phases: [q1], pick: 1 });
  assert.deepEqual([M.allPhases(T).map(q=> q.id), M.stdPhase(T).id, M.phasesFor(T, null).map(q=> q.id), M.stdPhase({ ...T, pick: 7 }).id], [[0, 1], 1, [1], 0]);
  assert.deepEqual([M.locked(S), M.locked({ busy: true }), M.locked({ waiting: {} })], [false, true, true]);
  // Removed: the standard's choice of it and every result refined with it go too.
  S.results = { a: { phases: [1, 2] }, b: { phases: [1] }, c: {}, d: { phases: [2] } };
  M.dropPhase(S, 2);
  assert.deepEqual([S.phases.map(q=> q.id), Object.keys(S.results)], [[1], ['b', 'c']]);
  M.dropPhase(T, 1);
  assert.deepEqual([T.phases.length, T.pick], [0, 0]);
  const r = { a: 1, b: 2, 'c d': 3 };
  M.keepLoaded(r, [{ name: 'b' }, { name: 'c d' }]);
  assert.deepEqual(r, { b: 2, 'c d': 3 });
  assert.deepEqual([M.holdWith(['adp', 'cell'], 'linear', true), M.holdWith(['adp', 'cell'], 'cell', false), M.holdWith([], 'x', true)], [['linear', 'cell', 'adp'], ['adp'], []]);
  // A Refinement entry: kept (a value back at its default dropped, in FITS' order), refused with
  // the words a value gets, as it was, or nothing to take.
  const F = M.FIT, e = (value, shown = 'x', o = {})=> ({ auto: false, checked: false, value, shown, ...o }), auto = ()=> true;
  assert.deepEqual(M.fitEntry({ bgDegree: 8 }, F.maxIter, e('50'), auto), { fit: { maxIter: 50, bgDegree: 8 } });
  assert.deepEqual(M.fitEntry({ maxIter: 50 }, F.maxIter, e('40'), auto), { fit: {} });
  assert.deepEqual(M.fitEntry({ maxIter: 50 }, F.maxIter, e('50.0'), auto), { refused: 'A whole number from 1 to 1000, without a point or comma: “50.0” not taken; x kept.' });
  assert.deepEqual(M.fitEntry({}, F.maxIter, e(' 40 '), auto), { same: true });
  assert.deepEqual(M.fitEntry({}, F.cellRange, e('7,3', '5'), auto), { fit: { cellRange: 0.073 } });
  assert.deepEqual(M.fitEntry({}, F.cellRange, e('', '5'), auto), { refused: 'A number from 0.5 to 20 %; 5 kept.' });
  assert.deepEqual(M.fitEntry({}, F.bgInv, e('', '', { auto: true, checked: false }), ()=> false), { fit: { bgInv: false } });
  assert.deepEqual(M.fitEntry({ bgInv: false }, F.bgInv, e('', '', { auto: true, checked: true }), auto), { fit: {} });
  assert.deepEqual(M.fitEntry({}, F.bgInv, e('', '', { checked: true }), auto), { fit: { bgInv: true } });
  assert.deepEqual([M.fitEntry({}, F.shapeLine, e('exact'), auto), M.fitEntry({ shapeLine: 'exact' }, F.shapeLine, e('lorentz'), auto), M.fitEntry({}, F.shapeLine, e('lorentz'), auto), M.fitEntry({}, F.shapeLine, e('x'), auto)],
    [{ fit: { shapeLine: 'exact' } }, { fit: {} }, null, null]);
  let asked = 0;
  M.fitEntry({}, F.maxIter, e('5'), ()=> asked++);
  assert.equal(asked, 0, 'what automatic gives asked only for its box');
  assert.deepEqual([M.fitNoteText(null), M.fitNoteText('n')], ['For every pattern, from the next refinement. A result refined with other than the defaults says which, under its statistics.', 'n']);
  assert.deepEqual([M.modeTitle(M.MODE.size, '', false), M.modeTitle(M.MODE.adp, 'na', true)], [M.MODE.size.title, 'na']);
  assert.match(M.modeTitle(M.MODE.adp, '', true), /^Off: the CIF's B.*\. On the standard, one ΔB is the default: held, a B 0\.1 Å² off moved the profile's X by 10 esd/s);
  assert.equal(M.settingsKeyOf([q1, { ...q2, prep: { name: 'B,T' } }]), '1,#d4a72c,SrTiO3|2,#c77dff,B,T');
  // A run takes copies of what it refines with.
  S.phases = [q1]; S.startFrom = 'last'; S.fit = { maxIter: 9 };
  const run = M.runOf(S, { U: 1 }, 3, null);
  assert.deepEqual(Object.keys(run), ['ph', 'std', 'start', 'hold', 'fit', 'irf', 'fell', 'bgFreed', 'n', 'done', 'tell']);
  assert.ok(run.ph[0] !== q1 && run.ph[0].on !== q1.on && run.ph[0].off !== q1.off && run.ph[0].prep === q1.prep && run.fit !== S.fit && run.hold !== S.hold && run.std.id === 0);
  assert.deepEqual([run.start, run.hold, run.fit, run.irf, run.n, run.done], ['last', HOLD_DEFAULT, { maxIter: 9 }, { U: 1 }, 3, 0]);
  // Its words.
  // (v571: the results' words too, X08)
  assert.deepEqual([M.nothingText(true, 0), M.nothingText(false, 2), M.nothingText(false, 0)], ['Load the standard\'s file to refine it.', 'No phase ticked for this pattern: tick one in the list, or add one from a CIF.', 'Add a phase from a CIF to refine.']);
  // A run that failed, CIFs not added: an error in the status's place (v571, X07).
  assert.deepEqual(['The pattern has too few points (40) for a refinement.', 'Refinement failed', 'The refinement worker failed', 'Refinement failed on purpose', 'SrTiO3: cell <x>', '⚠ No phase with id 3.', '', null].map(M.failText),
    ['Refinement failed: the pattern has too few points (40) for a refinement.', 'Refinement failed.', 'The refinement worker failed.', 'Refinement failed on purpose.', 'Refinement failed: SrTiO3: cell <x>.', 'Refinement failed: no phase with id 3.', 'Refinement failed.', 'Refinement failed.']);
  assert.deepEqual([M.notAddedLines([['a.cif', 'Not a CIF: no data_ block found.']]), M.notAddedLines([['a.cif', 'None of the atom sites in the CIF could be read.'], ['b.tif', 'not a CIF file (.cif).']]), M.notAddedLines([])],
    [['Not added: a.cif: not a CIF: no data_ block found.'], ['Not added:', 'a.cif: none of the atom sites in the CIF could be read.', 'b.tif: not a CIF file (.cif).'], []]);
  assert.deepEqual([M.runEndText({ fell: [], bgFreed: [] }), M.runEndText({ fell: ['a (x)', 'b (y)'], bgFreed: ['a', 'c'] })], ['',
    'From the CIF, no last result to start from: a (x); b (y). Scales and background refined, not held: the background\'s terms changed since the last result (a, c).']);
  const lbl = k => ['s0', 's1', 's2'][k], from = ['', ' from its last result'], R0 = { done: 1, n: 3 };
  assert.deepEqual([[[0, 1], 0, '', 'start'], [[0, 1], 1, '', 'progress'], [[0, 1], 1, 'widths', 'progress'], [[1], 1, '', 'start'], [[2], 0, '', 'done'], [[], 0, '', 'done'], [[1], 1, 'cell', 'progress'], [[1], 1, '', 'progress']]
    .map(([on, k, stage, what])=> M.progressStatus(R0, on, k, stage, what, lbl, from)),
  ['Refining s0, s1… (1 of 3 done)', null, 'Refining s0, s1… (1 of 3 done)', 'Refining s1 from its last result…', 'Refining s2…', null, 'Refining s1: cell…', null]);
  assert.deepEqual([M.progressTell([0, 2], 2, 'cell', lbl), M.progressTell([0, 2], 2, '', lbl), M.progressTell([], 0, '', lbl)], ['s2: cell', 's0, s2', '']);
  assert.deepEqual([M.waitStopText(true), M.waitStopText(false), M.stoppedText({ n: 3, done: 1 }, false), M.stoppedText({ n: 1, done: 0 }, true), M.stoppedText({ n: 1, done: 0 }, false)],
    ['Stopped, the standard\'s refinement with it: nothing refined.', 'Stopped waiting for the standard\'s refinement: nothing refined.', 'Stopped after 1 of 3 patterns: the others keep what they had.',
      'Stopped: the standard keeps what it had.', 'Stopped: the pattern keeps what it had.']);
  assert.deepEqual(M.stdQuestion(true).slice(1), ['Refine the standard first', 'Refine without the standard']);
  assert.deepEqual(M.stdQuestion(false).slice(1), ['Load a standard…', 'Refine without the standard']);
  assert.match(M.stdQuestion(false)[0], /^No instrumental standard is loaded/);
  assert.deepEqual([M.stdFailText({ ok: true }), M.stdFailText({ ok: false, why: 'stopped' }), M.stdFailText({ ok: false, why: 'Bad cell.' }), M.stdFailText({ ok: false })],
    ['The standard\'s refinement gave no profile (its file changed meanwhile?): nothing refined.', 'The standard\'s refinement was stopped: nothing refined.',
      'The standard\'s refinement failed: Bad cell; nothing refined.', 'The standard\'s refinement failed: no reason given; nothing refined.']);
  assert.deepEqual([M.refineTitle(null, 'why'), M.refineTitle({ own: true }, 'x'), M.refineTitle({ own: false }, '')], ['why', 'The standard is refined first: Cancel stops it', 'Waiting for the standard\'s refinement: Cancel stops waiting (the standard goes on)']);
  assert.deepEqual([null, {}, { frac: 0.256 }, { frac: 7 }, { frac: -1 }].map(M.stdRunView).map(v=> [v.key, v.prog, v.label]), [['', '0', 'Instrumental standard… (refining)'], ['run:null', '0', 'Instrumental standard… (refining)'],
    ['run:26', '0.26', 'Instrumental standard… (refining, 26 %)'], ['run:100', '1', 'Instrumental standard… (refining, 100 %)'], ['run:0', '0', 'Instrumental standard… (refining, 0 %)']]);
  assert.equal(M.stdRunView({ frac: 0.5 }).title, 'The instrumental standard is being refined (50 %): its window, this button, shows the run and can stop it');
  assert.deepEqual([['del', false, null], ['del', true, {}], ['on', false, null], ['on', true, {}], ['pick', false, null]].map(([k, lock, f])=> M.rowLock(k, lock, f)), [
    { off: false, title: 'Remove phase' }, { off: true, title: 'A refinement is running: the phase stays until it ends' }, { off: true, title: 'Refined on this pattern (each pattern its own)' },
    { off: false, title: 'A refinement is running: the tick stays as it is until it ends' }, { off: false, title: 'The phase the standard is refined with' }]);
});

test('what the views are drawn from: the keys, the pattern\'s frame and ticks, the stacked plot, the sizes\' points, Williamson–Hall', ()=>{
  // An object a number of its own, the same each time; a value that is no object as itself.
  const a = [1], b = [1];
  assert.equal(M.idOf(a), M.idOf(a));
  assert.notEqual(M.idOf(a), M.idOf(b));
  assert.deepEqual([M.idOf(null), M.idOf(undefined), M.idOf(5), M.idOf('x'), M.idOf(true)], ['-', '-', 'number:5', 'string:x', 'boolean:true']);
  assert.deepEqual([M.resKey(null), M.resKey({ at: 7 }), M.resKey({ at: 'x' }).startsWith('r')], ['-', 'at7', true]);
  const f = pattern('s00.xrdml', xrdml(0, { n: 400 })), prep = M.prepOf(SRT, 'SrTiO3.cif'), q = { id: 1, color: '#d4a72c', prep, ...M.defSettings(), off: {} };
  const S = card(false, { phases: [q] });
  const k1 = M.plotKeyOf(S, f, null, '700x420');
  assert.equal(k1, M.plotKeyOf(S, f, null, '700x420'));
  assert.ok(k1.startsWith('s00.xrdml|') && k1.endsWith('|-||1:#d4a72c:' + M.idOf(prep) + ':1|700x420'), k1);
  assert.notEqual(M.plotKeyOf({ ...S, phases: [{ ...q, off: { 's00.xrdml': true } }] }, f, null, '700x420'), k1, 'a tick changes it');
  assert.ok(M.plotKeyOf(card(true, { pick: 0 }), f, { at: 3 }, '0x0').includes('|at3|0|'), 'the standard\'s choice');
  const r = { params: { a: NaN }, models: {}, textures: null, fit: { bgDegree: 7 }, phases: [1], cells: { 1: 'c' } };
  assert.equal(M.curveKey(f, r, [q], false), M.curveKey(f, { ...r }, [q], false), 'a copy, the same');
  assert.notEqual(M.curveKey(f, { ...r, params: { a: null } }, [q], false), M.curveKey(f, r, [q], false), 'a NaN is not a null');
  assert.notEqual(M.curveKey(f, r, [q], true), M.curveKey(f, r, [q], false), 'the role');
  // The pattern's frame: a row of ticks a phase under its lowest count, the difference under them.
  const ys = [10, 30, 110, 20], fr = M.patternFrame(ys, 2, null, [10, 80]);
  assert.deepEqual(fr, { rowH: 4.5, rowGap: 2, tickTop: 8, off: 0, range: [10, 80, -7, 115] });
  const fd = M.patternFrame(ys, 1, [-4, 6, 2, 0], [10, 80]);
  assert.deepEqual([fd.off, fd.range], [-6.5, [10, 80, -13.5, 115]]);
  assert.deepEqual(M.patternFrame([5, 5], 0, null, [1, 2]).range.map(v=> +v.toFixed(9)), [1, 2, 4.96, 5.05], 'a flat pattern: a span of 1');
  assert.deepEqual(M.tickSegs({ tt: [20, 30] }, 1, fr), { xs: [20, 20, 30, 30], yv: [-3, 1.5, -3, 1.5] });
  // The stacked plot: global, local and none.
  const g = { name: 'g', color: '#111', x: [10, 20, 30] }, h = { name: 'h', color: '#222', x: [30, 15, 50] };
  const shown = [{ f: g, y: [1, 4, 2] }, { f: h, y: [0, 2, 1] }];
  const glob = M.stackOf(U, shown, 'global'), loc = M.stackOf(U, shown, 'local'), none = M.stackOf(U, shown, 'none');
  assert.deepEqual(glob.range, [10, 50, -1.1, 1.1]);
  assert.deepEqual(glob.lines.map(l=> l.norm), [[0.25, 1, 0.5], [0, 0.5, 0.25]]);
  assert.deepEqual(glob.lines[1].ys.map(v=> +v.toFixed(6)), [-1.05, -0.55, -0.8]);
  assert.deepEqual(loc.lines[1].norm, [0, 1, 0.5]);
  assert.deepEqual([none.range, none.lines[0].norm, none.lines[1].ys.map(v=> +v.toFixed(6))], [[10, 50, -4.4, 4.4], [1, 4, 2], [-4.2, -2.2, -3.2]]);
  assert.deepEqual(M.stackOf(U, [], 'global').range, [0, 1, -0, 1.1]);
  assert.equal(M.stackKeyOf('local', '600x360', shown), `local|600x360|g:#111:${M.idOf(g.x)}:${M.idOf(shown[0].y)}|h:#222:${M.idOf(h.x)}:${M.idOf(shown[1].y)}`);
  assert.deepEqual([M.sizeNoteOf('peak', [], {}, false), M.sizeNoteOf('sample', [], {}, false), M.sizeNoteOf('peak', [], {}, true)], ['No peak the tests use.',
    'No size refined: the size is off, or every phase was refined without one.', 'Each reflection\'s own size (Scherrer, K = 0.9, on its FWHM less the instrument\'s), the peaks the tests use.']);
  const sized = { 's00.xrdml': { table: [{ phase: 'SrTiO3', name: 'crystallite_size_nm', value: 12, esd: 1 }, { phase: 'SrTiO3', name: 'shape_a_nm', value: 9, esd: 2 }] } };
  assert.equal(M.sizeNoteOf('sample', [f], sized, true), M.SIZE_KINDS.scherrer[1] + ' ' + M.SIZE_KINDS.shape[1]);
  const groups = M.pointGroups([{ x: 1, v: 5, color: 'a', dx: 0 }, { x: 2, v: 6, color: 'a', dx: 0 }, { x: 1, v: 7, color: 'a', dx: 9 }, { x: 1, v: 8, color: 'b', dx: 0 }], 375, 2);
  assert.deepEqual([...groups.values()], [{ color: 'a', dx: 0, xs: [1, 2], ys: [5, 6] }, { color: 'a', dx: 9, xs: [1.09], ys: [7] }, { color: 'b', dx: 0, xs: [1], ys: [8] }]);
  // The solids', the widths' keys; a peak picked, the same, those marked.
  const s = { id: 1, name: 'S<b>', type: 'box', dims: [1, 2, Infinity], frame: [[1, 0, 0]] };
  assert.deepEqual([M.solidsKeyOf(null, []), M.solidsKeyOf(f, [s]), M.turnKeyOf(f, s), M.solidPngName({ label: 'a b/c' }, s)],
    ['[]', 's00.xrdml[{"id":1,"name":"S<b>","type":"box","dims":[1,2,null],"frame":[[1,0,0]]}]', 's00.xrdml|1|["box",[1,2,null],[[1,0,0]]]', 'XRPD_shape_a_b_c_S_b_.png']);
  assert.equal(M.widthsKeyOf(f, { at: 5 }, [q, { id: 0, color: '#4cc9a0' }], '500x360'), 's00.xrdml|at5|1:#d4a72c,0:#4cc9a0|500x360');
  const p1 = M.pkOf('s00.xrdml', { tt: '32.4', lab: '1-10', ph: '1' }, id=> 'c' + id);
  assert.deepEqual(Object.entries(p1), [['file', 's00.xrdml'], ['tt', 32.4], ['lab', '1-10'], ['ph', 1], ['color', 'c1']]);
  const p2 = { ...p1, tt: 1 }, p3 = { ...p1, lab: '110' };
  assert.deepEqual([M.samePk(p1, p2), M.samePk(p1, p3), M.samePk(null, p1), M.samePk(p1, { ...p1, file: 'x' })], [true, false, false, false]);
  assert.deepEqual([M.markedOf(p1, p2), M.markedOf(p1, p3), M.markedOf(null, p3), M.markedOf(null, null)], [[p1], [p1, p3], [p3], []]);
  // Williamson–Hall: the peaks the tests use, the models' points, the range from 0.
  const row = (o)=> ({ sin: 0.25, cos: 0.95, W: 0.2, Wesd: 0.01, label: '110', model: { iso: 0.21, shape: 0.19 }, ...o });
  const phs = [{ id: 1, shaped: true, rows: [row(), row({ sin: 0.5, W: 0.3, Wesd: 0, label: '1-11', model: { iso: NaN, shape: 0.3 } }), row({ weak: true }), row({ W: 0 })], wh: { a: 0.001, b: 0.0002 } },
    { id: 2, shaped: false, rows: [row({ label: '100' })], wh: { a: NaN } }];
  const { pts, mods } = M.whPoints(phs, id=> 'c' + id), k = 1e3*Math.PI/180*0.95;
  assert.deepEqual(pts.map(p=> [p.x, +p.y.toFixed(9), +p.e.toFixed(9), p.label, p.ph, p.color]), [[1, +(0.2*k).toFixed(9), +(0.01*k).toFixed(9), '110', 1, 'c1'], [2, +(0.3*k).toFixed(9), 0, '1-11', 1, 'c1'], [1, +(0.2*k).toFixed(9), +(0.01*k).toFixed(9), '100', 2, 'c2']]);
  assert.deepEqual(mods.map(m=> [m.x, m.kind]), [[1, 'iso'], [1, 'shape'], [2, 'shape'], [1, 'iso']]);
  const wr = M.whRange(pts, mods, phs), ysAll = [...pts.flatMap(p=> [p.y - p.e, p.y + p.e]), ...mods.map(m=> m.y), 1, 1e3*(0.001 + 0.0002*2.24)];
  assert.deepEqual(wr, [0, 2.24, 0, Math.max(...ysAll) + 0.12*Math.max(...ysAll)]);
  assert.deepEqual(M.whRange([{ x: 1, y: -2, e: 1 }], [], []), [0, 1.12, -3 - 0.08*2, -1 + 0.12*2], 'a line under 0: from below it');
  assert.deepEqual([M.fitSetTitle(true, 0), M.fitSetTitle(false, 2), M.fitSetTitle(false, 0)], ['What this result was refined with', 'What Refine will refine: Settings… changes it', '']);
  assert.equal(M.cellKeyOf(q), '1|3.905,3.905,3.905,90,90,90|znjilf.507|SrTiO3');
});

test('the state saved and put back (every value made valid, a run\'s kept through a step), what the card shows beside it', ()=>{
  const prep = M.prepOf(SRT, 'SrTiO3.cif'), q = { id: 1, cif: SRT, file: 'SrTiO3.cif', color: '#d4a72c', prep, ...M.defSettings(), off: { 's00.xrdml': true } };
  const S = card(false, { phases: [q], nextId: 2, sel: 1, results: { 's00.xrdml': { params: { a: 1 }, at: 3 } }, sizeBy: 'peak', resNorm: 'local' });
  const snap = M.snapshotOf(S);
  assert.deepEqual(Object.keys(snap), ['phases', 'start', 'hold', 'fit', 'nextId', 'sel', 'results', 'sizeBy', 'resNorm']);
  assert.deepEqual(snap.phases[0].off, { 's00.xrdml': true });
  assert.ok(snap.results !== S.results && snap.results['s00.xrdml'] === S.results['s00.xrdml'] && snap.hold !== S.hold && snap.fit !== S.fit, 'copies, each result shared');
  const T = card(true, { phases: [q], pick: 1 }), tsnap = M.snapshotOf(T);
  assert.deepEqual([tsnap.std, tsnap.pick, 'sizeBy' in tsnap], [{ on: STD.on, dep: STD.dep }, 1, false]);
  // Put back: every value made valid; the settings' note and key dropped.
  const R = card(false, { fitNote: 'n', setKey: 'k' });
  M.restoreInto(U, R, JSON.parse(JSON.stringify({ ...snap, sel: 1.5, sizeBy: 'x', resNorm: 'none', fit: { maxIter: 9, bad: 1 }, hold: ['cell', 'x'], start: 'last' })), false);
  assert.deepEqual([R.phases.map(x=> [x.id, x.prep === prep, x.off]), R.sel, R.sizeBy, R.resNorm, R.fit, R.hold, R.startFrom, R.fitNote, R.setKey, R.nextId],
    [[[1, true, { 's00.xrdml': true }]], null, 'sample', 'none', { maxIter: 9 }, ['cell'], 'last', null, null, 2]);
  assert.ok(Object.isFrozen(R.results['s00.xrdml']));
  // Phases that are no list: none, the rest put back (18, v568; to v567 a throw).
  M.restoreInto(U, R, { phases: 5, start: 'last', results: { 's00.xrdml': { a: 1 } }, sizeBy: 'peak' }, false);
  assert.deepEqual([R.phases, R.startFrom, R.results, R.sizeBy], [[], 'last', { 's00.xrdml': { a: 1 } }, 'peak']);
  // A step while a run goes on: its phases and settings kept, the patterns it wrote over the state's.
  const W = card(false, { phases: [q], fit: { maxIter: 5 }, wrote: { 's01.xrdml': { mine: 1 } }, setKey: 'k' });
  M.restoreInto(U, W, { phases: [], fit: {}, results: { 's00.xrdml': { a: 1 }, 's01.xrdml': { theirs: 1 } }, sel: 1, sizeBy: 'peak' }, true);
  assert.deepEqual([W.phases.length, W.fit, W.setKey, W.results, W.sel, W.sizeBy], [1, { maxIter: 5 }, 'k', { 's00.xrdml': { a: 1 }, 's01.xrdml': { mine: 1 } }, 1, 'peak']);
  const T2 = card(true);
  M.restoreInto(U, T2, { std: { on: { adp: false, size: true }, dep: { adp: 'site' } }, pick: 7, phases: [{ ...snap.phases[0], on: { ...DEF.on, size: true } }] }, false);
  assert.deepEqual([T2.lab6.on.adp, T2.lab6.on.size, T2.lab6.dep.adp, T2.pick, T2.phases[0].on.size], [false, false, 'site', 0, false], 'the standard\'s rows that do not apply stay off');
  // What it shows beside its state, and given back.
  const V = card(false, { phases: [q], sel: 1, pkSel: { file: 'f', tt: 1, lab: '110', ph: 1, color: '#000' }, solidTurns: new Map([['a', { R: [1] }]]),
    solidViews: [{ turnKey: 'b', view: { getView: ()=> ({ R: [2] }) } }, { turnKey: 'c', view: {} }], cellV: { getView: ()=> ({ R: [3], k: 9 }) }, cellKeyShown: 'K' });
  const v = M.showsOf(V);
  assert.deepEqual(v, { pk: V.pkSel, turns: [['a', { R: [1] }], ['b', { R: [2] }]], sel: { id: 1, name: 'SrTiO3' }, cell: { key: 'K', R: [3] } });
  assert.notEqual(v.pk, V.pkSel);
  assert.deepEqual(M.showsOf(card(false, { cellNext: { key: 'x', R: [] } })), { cell: { key: 'x', R: [] } });
  assert.equal(M.showsOf(card(false)), null);
  const N = card(false, { phases: [q] });
  M.nextInto(N, { pk: { file: 'f', tt: 2, lab: 'l', ph: 1 }, turns: [['t', { R: [1] }], ['u', 5], [3, {}]], sel: { id: 1, name: 'SrTiO3' }, cell: { key: 'k', R: [1, 2] } });
  assert.deepEqual([N.pkSel, [...N.solidTurns], N.sel, N.cellNext], [{ file: 'f', tt: 2, lab: 'l', ph: 1, color: '#888' }, [['t', { R: [1] }]], 1, { key: 'k', R: [1, 2] }]);
  M.nextInto(N, { pk: { file: 'f', tt: 'x', lab: 'l', ph: 1 }, sel: { id: 1, name: 'other' }, cell: { key: 5 } });
  assert.deepEqual([N.pkSel.tt, N.sel, N.cellNext], [2, 1, null]);
  M.nextInto(N, null);
  assert.equal(N.cellNext, null);
});

test('the card\'s markup: its frame, its section of the Results, its settings window, the legends, the solids, the results; every name escaped', ()=>{
  const card2 = H.cardHtml('xrdR2', false, HU), std = H.cardHtml('xrdStdR', true, HU), res = H.resHtml('xrdR2', HU);
  for (const id of ['Svg', 'Legend', 'Instr', 'InstrNotes', 'WNote', 'Cifs', 'CifInput', 'PhaseList', 'CifDz', 'AddCif', 'CellName', 'Cell', 'CellInfo', 'Status', 'ProgWrap', 'ProgBar', 'Refine', 'Settings', 'Clear',
    'FitSet', 'Results', 'Widths', 'WhSvg', 'WhLegend', 'Tests', 'Solids', 'PkWrap']){ assert.ok(card2.includes(`id="xrdR2${id}"`), id); assert.ok(std.includes(`id="xrdStdR${id}"`), 'std ' + id); }
  for (const id of ['RefineAll', 'Std', 'ClearAll']){ assert.ok(card2.includes(`id="xrdR2${id}"`), id); assert.ok(!std.includes(`id="xrdStdR${id}"`), 'std ' + id); }
  assert.ok(card2.includes('<div class="snav" id="xrdR2Prev+xrdR2Next+xrdR2Label"></div>') && !std.includes('class="snav"'), 'the selector the samples\' alone');
  assert.equal((card2.match(/<svg class="i-dl"><\/svg>/g) || []).length, 2);
  assert.equal((card2.match(/<svg class="i-csv"><\/svg>/g) || []).length, 1);
  for (const id of ['ResNone', 'ResSvg', 'ResLegend', 'SizeSvg', 'SizeBy', 'SizeLegend', 'SizeNote']) assert.ok(res.includes(`id="xrdR2${id}"`), id);
  assert.ok(res.includes('data-size-dl') && res.includes('data-csv-base="rietveld_pattern.csv"'));
  const m1 = H.settingsModalHtml('xrdR2', false), m2 = H.settingsModalHtml('xrdStdR', true);
  assert.ok(m1.includes('aria-labelledby="xrdR2SetTitle"') && m1.includes('>Fitting settings</h3>') && m1.includes('on each phase. A change') && m1.includes('<div class="rvs-body"></div>') && m1.includes('data-done'));
  assert.ok(m2.includes('>Fitting settings: instrumental standard</h3>') && m2.includes('on each phase of the standard. A change'));
  assert.ok(H.RV_INFO.startsWith('Whole-pattern Rietveld refinement.') && H.RV_STD_INFO.startsWith('The instrumental standard\'s own Rietveld refinement'));
  // The legends and chips.
  const evil = `"'><i data-x=1></i>`, esc = '&quot;\'&gt;&lt;i data-x=1&gt;&lt;/i&gt;';
  assert.equal(H.legendHtml([['#123', evil]]), `<span><i style="background:#123"></i>${esc}</span>`);
  assert.equal(H.patternLegendHtml(false, [{ color: '#1', name: 'a' }]), '<span><i style="background:var(--plot-errbar)"></i>observed</span><span><i style="background:#1"></i>a</span>');
  assert.ok(H.patternLegendHtml(true, []).includes('calculated</span><span><i style="background:#ff9933"></i>background</span><span><i style="background:#3aa0ff"></i>difference</span>'));
  assert.equal(H.sizeChipsHtml('peak', true), '<button type="button" class="mode-chip plot-chip" data-size-by="sample" title="Crystallite size by sample">by sample</button><button type="button" class="mode-chip plot-chip is-on" data-size-by="peak" title="Crystallite size by peak">by peak</button>');
  assert.ok(H.sizeChipsHtml('sample', false).includes('data-size-by="peak" disabled title="No peak widths: they are measured on a sample refined with its phases">by peak</button>'));
  assert.match(H.solidsNoneHtml(null), /Isotropic size: no free shape refined/);
  assert.match(H.solidsNoneHtml({ params: {}, models: { 1: { shape: 'box' } } }), /No free shape kept/);
  assert.match(H.solidsNoneHtml({ params: null, models: { 1: { shape: 'box' } } }), /Isotropic size/);
  assert.equal(H.solidHeadHtml({ name: evil }, 2, '<svg></svg>'), `<div class="peak-box-head"><span class="txt-mini">Crystallite shape · ${esc}</span><button class="btn table-csv-btn" title="Download PNG"><svg></svg></button></div><div class="rv-solid-view"></div>`);
  assert.ok(!H.solidHeadHtml({ name: evil }, 1, '').includes(esc));
  assert.equal(H.whLegendHtml([{ id: 1, name: evil }], ()=> '#1', 1, 0), `<span><i style="background:#1"></i>${esc}, measured</span><span><i style="background:#9aa3ad"></i>isotropic model</span>`);
  assert.deepEqual([H.noPatternHtml(true), H.noPatternHtml(false)], ['<div class="rv-note rv-wide">No standard loaded: drop its file above.</div>', '<div class="rv-note rv-wide">No pattern.</div>']);
  // The results: not refined (a phase, none ticked, none at all), refined; the standard's
  // profile asked only where the words need it.
  const q = { prep: { name: evil, warnings: [evil] } }, calls = [];
  const irf = v => ()=>{ calls.push('irf'); return v; }, stale = v => ()=>{ calls.push('stale'); return v; };
  const none = H.resultsHtml({ r: null, std: false, shown: [q], n: 1, any: 1, irf: irf(null), stale: stale(false) });
  // (a CIF's warnings, a compact box a kind per phase, v571, X12: to v570 an amber line each)
  assert.ok(none.startsWith('<div class="rv-note rv-wide">Not refined yet.') && none.endsWith(`<div class="alert warn compact rv-wide">⚠ ${esc}: ${esc}</div>`), none);
  const kinds = { prep: { name: 'P', warnings: ['The file holds 2 structures: the first, data_a, is used.', 'Fm-3m is centred but the operations hold 1 of its 4 centring translations: the cell will be filled incompletely.',
    'Negative displacement parameters in the CIF.', 'No displacement parameter for O1: B = 0.5 Å² assumed.', 'Site X: occupancy 2 > 1.'] } };
  assert.deepEqual(kinds.prep.warnings.map(M.cifNoteKind), ['info', 'bad', 'warn', 'info', 'warn']);
  assert.ok(['A magnetic CIF: its 4 space-group operations are taken, without time reversal; the magnetic moments are not used (they scatter X-rays negligibly).', 'No valid _cell_angle_beta: 90° assumed.',
    'The symmetry operations do not include the identity: it is added.', 'No tabulated form factor of its own, taken as the tabulated charges around it with the same mean charge: Fe2.5+ (Fe1) as 0.5 Fe2+ + 0.5 Fe3+.'].every(w=> M.cifNoteKind(w) === 'info'));
  const kb = H.resultsHtml({ r: null, std: false, shown: [kinds], n: 1, any: 1, irf: irf(null), stale: stale(false) });
  assert.ok(kb.endsWith('<div class="alert bad compact rv-wide">✕ P: Fm-3m is centred but the operations hold 1 of its 4 centring translations: the cell will be filled incompletely.</div>'
    + '<div class="alert warn compact rv-wide">⚠ P: Negative displacement parameters in the CIF.<br>P: Site X: occupancy 2 &gt; 1.</div>'
    + `<div class="alert info compact rv-wide">${ALERT_ICON.info}P: The file holds 2 structures: the first, data_a, is used.<br>P: No displacement parameter for O1: B = 0.5 Å² assumed.</div>`), kb);
  assert.match(H.resultsHtml({ r: {}, std: true, shown: [], n: 1, any: 0 }), /\(the certified one, held fixed\)/);
  assert.match(H.resultsHtml({ r: {}, std: false, shown: [], n: 0, any: 2 }), /No phase ticked for this pattern: tick one in the list, or add one from a CIF\./);
  assert.match(H.resultsHtml({ r: {}, std: false, shown: [], n: 0, any: 0 }), /No phase: add one from a CIF/);
  assert.deepEqual(calls, []);
  const r = { params: {}, stats: { Rwp: 0.1234, Rexp: 0.05, chi2: 6.1 }, phaseResults: [{ name: evil, phase: true, lines: [{ label: 'a (1-10)', value: '1(2)', title: evil }] }], warnings: ['w (-1 1 0)'], irf: { U: 1 } };
  const done = H.resultsHtml({ r, std: false, shown: [q], n: 1, any: 1, irf: irf({ U: 2 }), stale: stale(true) });
  assert.deepEqual(calls, ['stale', 'irf']);
  assert.ok(done.includes('R<sub>wp</sub>: <b>12.34%</b>') && done.includes('χ²: <b>6.10</b>') && done.includes(`<div class="txt-mini rv-phase-name">${esc}</div>`) && done.includes(`title="${esc}"`));
  assert.ok(done.includes('a (1<span class="hkl-bar"><span class="hkl-sign">-</span>1</span>0): <b>1(2)</b>') && done.includes('⚠ w (<span class="hkl-bar"><span class="hkl-sign">-</span>1</span> 1 0)'));
  assert.ok(done.endsWith('The standard has been refined again since this result: its profile, zero and asymmetry are not the ones these numbers rest on. Refine this pattern again, or <b>Refine all</b>.</div>'));
  calls.length = 0;
  // No instrumental profile: one compact warning, what was refined without it in it (v571, X10:
  // to v570 a grey note, two amber warnings and the table's note); no instrument description
  // said under the pattern, not here (X06).
  const NEED = 'P1: WPPM, planar faults; P2: anisotropic strain: need the standard\'s instrumental profile (refine the standard first), else the instrument\'s broadening and the sample\'s are one and the same; refined without.';
  const SHAPE = 'Free shape: needs the standard\'s instrumental profile (refine the standard first), else the shape\'s widths and the instrument\'s are one and the same; P1 refined with an isotropic size.';
  const rn = { ...r, irf: null, warnings: [M.NO_INSTR, NEED, 'w', SHAPE] };
  const noIrf = H.resultsHtml({ r: rn, std: false, shown: [], n: 1, any: 1, irf: irf(null), stale: stale(true) });
  assert.deepEqual(calls, ['irf']);
  assert.ok(noIrf.includes('<div class="alert warn compact rv-wide">⚠ No instrumental profile: the widths, and the sizes from them, include the instrument\'s. Refine the standard first: <b>Instrumental standard…</b>.'
    + '<br>Refined without, as they need it: P1: WPPM, planar faults; P2: anisotropic strain.<br>The free shape needs it: P1 refined with an isotropic size.</div><div class="rv-note rv-wide rv-warn">⚠ w</div>'), noIrf);
  assert.ok(!noIrf.includes('No instrument description') && !noIrf.includes('refined without.') && (noIrf.match(/No instrumental profile/g) || []).length === 1);
  assert.match(H.resultsHtml({ r: { ...r, irf: null }, std: false, shown: [], n: 1, any: 1, irf: irf({}), stale: stale(true) }), /⚠ No instrumental profile: the widths, and the sizes from them, include the instrument's\. Refine this pattern again\.<\/div>/);
  // (the standard's profile refused here: its warning says why; the box only for what was refined without it)
  assert.ok(!H.resultsHtml({ r: { ...r, irf: null, irfRefused: true }, std: false, shown: [], n: 1, any: 1, irf: irf({}), stale: stale(true) }).includes('No instrumental profile'));
  assert.match(H.resultsHtml({ r: { ...rn, irfRefused: true }, std: false, shown: [], n: 1, any: 1, irf: irf({}), stale: stale(true) }), /⚠ No instrumental profile: the standard's does not apply to this pattern \(the warnings say why\)\.<br>Refined without/);
  assert.match(H.resultsHtml({ r: { ...r, irf: null, irfRefused: true }, std: true, shown: [], n: 1, any: 1, irf: irf({}), stale: stale(true) }), /The samples take this profile/);
  // A curve that cannot be drawn, its phases changed since: said (v571, X14: to v570 gone with no word).
  assert.ok(H.resultsHtml({ r, std: false, shown: [], n: 1, any: 1, irf: irf({ U: 1 }), stale: stale(false), lost: true })
    .includes('<div class="alert warn compact rv-wide">⚠ This result\'s curve cannot be drawn: its phases changed since. Refine it again.</div>'));
  assert.deepEqual([H.widthsNote({ corrected: false }), H.widthsNote({ corrected: true }), H.widthsNote(null)], ['(not corrected for the instrument)', '', '']);
  // A number missing (a NaN or ∞ through JSON is null; a project's result without its
  // statistics): a dash, as the CSV leaves its cell empty (16, v568; to v567 null threw, and so
  // did a result with no stats, the draw stopping there and the restore with it).
  const fit = h => [...h.matchAll(/<div class="pg-stat"[^>]*>[^<]*<sub>[^<]*<\/sub>: <b>([^<]*)<\/b>|<div class="pg-stat"[^>]*>χ²: <b>([^<]*)<\/b>/g)].map(m=> m[1] ?? m[2]);
  const st = stats => H.resultsHtml({ r: { ...r, stats }, std: false, shown: [], n: 1, any: 1, irf: irf({}), stale: stale(false) });
  assert.deepEqual([fit(st({ Rwp: 0.1234, Rexp: 0.05, chi2: null })), fit(st(undefined)), fit(st({ Rwp: null, Rexp: 'x', chi2: Infinity })), fit(st({ Rwp: 0.1234, Rexp: 0.05, chi2: 6.1 }))],
    [['12.34%', '5.00%', '—'], ['—', '—', '—'], ['—', '—', '—'], ['12.34%', '5.00%', '6.10']]);
});

/* ---- Cases as v558's xrd-rv.js gave them ----
   A card (a sample's, or the standard's one case in five) given a state as a project holds
   it — its phases from three CIFs with their settings and ticks (some of them junk), results
   with the parameters of each phase's start (the curves drawn from them), their statistics,
   lines, warnings, sizes and peak widths (some refined with other phases or cells, some with
   another background), the start, the groups held, the Refinement settings, the phase on
   show, the size chart's choices — then six steps of its page, as xrd-rv.js wires them, in
   short (below): a mode switched, a depth, a group held, the start, a Refinement entry (taken,
   refused, back at its default), automatic, Defaults, a tick, the standard's choice, a phase
   removed, one shown, the normalisation, Clear, the pattern stepped, another state put back.
   After the state and after each step, what the card shows once drawn: its state, the
   phases' list, the line by the results' title, the results, the settings' body, the
   pattern's frame and legend, and the CSVs. Their digests: tests/golden/rvmodel.json,
   checked against v558's xrd-rv.js run from its source on a page of stubs. */
const LAB6_PREP = ()=> Object.assign(M.prepPhase(LAB6, 'LaB6 (NIST SRM 660c)'), { name: 'LaB₆ (NIST SRM 660c)', notes: [] });
const TEXTS = [['SrTiO3.cif', SRT], ['BaTiO3.cif', BTO], ['LaB6 user.cif', LAB6]];
export function patternsOf(c){ return c.files.map(([name, k, a])=> pattern(name, xrdml(k, { n: 400, ...(a ? { a, seed: 7 } : {}) }))); }
export function caseOf(n){
  const R = rng(5590 + n), u = R.u, pick = a => a[Math.floor(u()*a.length)], int = (a, b)=> a + Math.floor(u()*(b - a + 1));
  const std = n % 5 === 4, junk = ()=> pick([null, 'x', -1, 0, 2.5, NaN, [], {}, true]);
  const files = std ? [['lab6std.xrdml', 0, 4.156826]] : [['s00.xrdml', 0], ['s01.xrdml', 1], ['s02 <b>.xrdml', 2]].slice(0, int(1, 3));
  const phases = Array.from({ length: int(std ? 0 : 1, 3) }, (_, i)=>{
    const [file, cif] = pick(TEXTS), s = M.defSettings();
    M.MODES.forEach(m=>{ if (u() < 0.25) s.on[m.k] = !s.on[m.k]; if (u() < 0.25){ const l = m.sites ? M.siteList({ prep: M.prepOf(cif, file) }) : m.list; if (l.length) s.dep[m.k] = pick(l)[0]; } });
    const q = { id: i + 1 + (u() < 0.2 ? 3 : 0), cif, file, color: pick(M.PHASE_COLORS), ...s, off: u() < 0.3 ? { [files[0][0]]: true } : {} };
    if (u() < 0.1) q.on = junk();
    if (u() < 0.05){ delete q.on; delete q.dep; q.shape = pick([true, 'box', 'x']); q.profile = pick(['wppm', 'lognormal', 'lorentz']); q.po = pick(['110', 'auto', '']); }
    return q;
  });
  const state = { phases, start: pick(['cif', 'last', 'x']), hold: u() < 0.8 ? HOLD_DEFAULT.filter(()=> u() < 0.7) : junk(), fit: u() < 0.6 ? {} : pick([{ maxIter: 9 }, { bgDegree: 8, bgInv: true }, { cellRange: 0.1, shapeLine: 'exact' }, junk()]),
    nextId: phases.length + 4, sel: u() < 0.7 ? pick([...phases.map(q=> q.id), 0, 9]) : junk(), results: {}, sizeBy: pick(['sample', 'peak', 'x']), resNorm: pick(['global', 'local', 'none', 'x']) };
  if (std){ state.std = u() < 0.7 ? { on: { ...STD.on, po: u() < 0.5 }, dep: { ...STD.dep, adp: pick(['overall', 'site']) } } : junk(); state.pick = pick([0, ...phases.map(q=> q.id), 9]); }
  // The results: the parameters of each phase's start (resultOf, as the run's are kept).
  files.forEach(([name], i)=>{ if (u() < 0.7) state.results[name] = { seed: 7*n + i, ids: phases.length && u() < 0.85 ? phases.filter(()=> u() < 0.7).map(q=> q.id) : std ? [0] : [], other: u() < 0.15,
    fit: u() < 0.8 ? {} : { bgDegree: 7 }, widths: !std && u() < 0.5, irf: !std && u() < 0.6, refused: u() < 0.1, warn: u() < 0.5 }; });
  if (u() < 0.15) state.results['gone.xrdml'] = { seed: 1, ids: [] };
  // (a state whose phases are no list: refused, as a whole)
  if (u() < 0.06) state.phases = pick(['x', 5, {}, true]);
  const irf = std || u() < 0.3 ? null : { U: 0.01, V: -0.002, W: 0.003, X: 0.02, Y: 0.01, asym: 0, zero: 0.001 };
  const ops = std ? ['mode', 'depth', 'hold', 'start', 'fit', 'auto', 'bginv', 'def', 'pick', 'del', 'sel', 'clear', 'restore'] : ['mode', 'depth', 'hold', 'start', 'fit', 'auto', 'bginv', 'choice', 'def', 'tick', 'del', 'sel', 'norm', 'clear', 'step', 'restore'];
  const FIELD = { maxIter: ['50', '1,000', '40', 'x'], shiftTol: ['0,02', '0.01', '-1'], lambda: ['1e-3', '1e-9'], bgDegree: ['8', '2.5', '6'], cellRange: ['7,3', '5', '0'], zeroRange: ['2', '0,5', '9'], shapeFull: ['1', '3'], shapeTiltSets: ['2', '9'] };
  const steps = Array.from({ length: 6 }, ()=>{
    const op = pick(ops), i = int(0, 3);
    if (op === 'mode') return [op, i, pick(M.MODES).k, u() < 0.5];
    if (op === 'depth'){ const m = pick(M.MODES); return [op, i, m.k, m.sites ? pick(['Sr1', 'O1', 'B1', 'x']) : pick([...m.list.map(([v])=> v), 'x'])]; }
    if (op === 'hold') return [op, pick(HOLD_DEFAULT.concat('linear')), u() < 0.5];
    if (op === 'start') return [op, pick(['cif', 'last'])];
    if (op === 'fit'){ const k = pick(Object.keys(FIELD)); return [op, k, pick(FIELD[k])]; }
    if (op === 'auto' || op === 'bginv') return [op, u() < 0.5];
    if (op === 'choice') return [op, pick(['exact', 'lorentz', 'x'])];
    if (op === 'norm') return [op, pick(['global', 'local', 'none', 'x'])];
    if (op === 'step') return [op, pick([-1, 1, 2])];
    if (op === 'restore') return [op, n + 100];
    return [op, i];
  });
  return { std, files, state, irf, steps };
}
// A result as the card keeps it, made from the case's words (resultOf: the parameters of the
// phases' start, built as the engine builds its model).
export function resultOf(c, f, d){
  const S = { std: c.std, phases: (Array.isArray(c.state.phases) ? c.state.phases : []).filter(q=> Array.isArray(d.ids) && d.ids.includes(q.id) && q.on && typeof q.on === 'object').map(q=> ({ ...q, prep: M.prepOf(q.cif, q.file) })) };
  const lab = { id: 0, ...M.stdSettings(), prep: LAB6_PREP(), color: '#4cc9a0', off: {} };
  const list = d.ids.includes(0) && c.std ? [lab] : S.phases;
  if (!list.length) return { params: null, phases: d.ids };
  const run = { ph: list, std: list[0], start: 'cif', hold: [], fit: d.fit, irf: null, fell: [], bgFreed: [] };
  const pay = M.payloadFor(f, run, {}, c.std);
  const model = buildModel({ x: pay.x, y: pay.y, instr: pay.instr, phases: pay.phases });
  const R = rng(d.seed), params = Object.fromEntries(model.par.map(p=> [p.name, p.value]));
  const res = { params, esd: {}, stats: d.warn ? { Rwp: 0.1 + R.u()/10, Rexp: 0.05, chi2: 4 + R.u() } : { Rwp: null, Rexp: 'x', chi2: 3 },
    phaseResults: list.map(q=> ({ name: q.prep.name, phase: true, lines: [{ label: 'a (1-10)', value: (3.9 + R.u()/100).toFixed(5) + '(2)', title: d.warn ? 'cell <a>' : '' }] })),
    warnings: d.warn ? ['On a bound (1 -1 0) <b>', 'A second one'] : [], fit: d.fit, models: Object.fromEntries(list.map(q=> [q.id, { size: true, profile: 'lorentz', strain: 'iso', adp: 'cif', shape: R.u() < 0.3 ? 'box' : false }])),
    textures: {}, table: list.map(q=> ({ phase: q.prep.name, name: 'crystallite_size_nm', value: 10 + 20*R.u(), esd: R.u() })),
    irf: d.irf ? { U: 0.01, V: -0.002, W: 0.003, X: 0.02, Y: R.u() < 0.5 ? 0.01 : 0.02, asym: 0, zero: 0.001 } : null, irfRefused: !!d.refused,
    widths: d.widths ? { corrected: R.u() < 0.5, phases: list.map(q=> ({ id: q.id, name: q.prep.name, shaped: R.u() < 0.5, rows: [0, 1, 2].map(j=> ({ label: ['1-10', '100', '111'][j], plain: ['1-10', '100', '111'][j], tt: 22 + 10*j,
      rel: R.u(), H: 0.2, Hesd: 0.01, eta: 0.5, Hs: 0.15, HsEsd: 0.01, D: 12 + j, Desd: 1, dd: 0.004, ddEsd: 0.0002, W: 0.2, Wesd: 0.01, sin: 0.2 + j/10, cos: 0.97, model: { iso: 0.16, shape: 0.15 },
      weak: j === 2 && R.u() < 0.5, flat: j === 1 && R.u() < 0.3, HsMax: 0.05, HsEsdFit: R.u() < 0.3 ? 0.005 : 0 })), wh: {}, orders: [], scores: {} })) } : null };
  const rec = M.resultRecord(res, list, c.std, d.seed);
  return d.other ? { ...rec, cells: Object.fromEntries(list.map(q=> [q.id, '1,1,1,90,90,90'])) } : rec;
}
// The case's state as a project holds it: its results made (a JSON copy, as xrd.js restores).
export function stateOf(c, fs){
  const s = JSON.parse(JSON.stringify(c.state)), byName = new Map(fs.map(f=> [f.name, f]));
  Object.entries(c.state.results).forEach(([name, d])=>{ const f = byName.get(name) || fs[0]; s.results[name] = JSON.parse(JSON.stringify(resultOf(c, f, d))); });
  return s;
}
// The other state a step puts back: another case's, on these patterns.
export const otherState = (c, fs, m)=> stateOf({ ...caseOf(m), std: c.std, files: c.files }, fs);

/* xrd-rv.js's wiring of each step, in short (settingChanged, settingClicked, commitFit,
   phaseClicked, phaseChanged, the buttons, host.step, restore and refresh); what its draw
   changes of the state (the phase on show, the size chart's choice) and what it shows. */
function cardOf(c, fs){
  const S = card(c.std, { setKey: '', lab6: { id: M.LAB6_ID, cif: LAB6, file: '', color: '#4cc9a0', ...M.stdSettings(), prep: LAB6_PREP(), off: {} } });
  const C = { c, S, fs, cur: 0, rows: M.rowsFor(c.std), body: '' };
  C.curFile = ()=> fs[C.cur];
  C.irf = ()=> c.std ? M.irfOf(fs[0], S.results) : c.irf;
  return C;
}
function putState(C, s){
  try { M.restoreInto(U, C.S, s, false); } catch(e){ return 'threw ' + e.message; }
  M.keepLoaded(C.S.results, C.fs);
  return 'ok';
}
function curvesOf(C, f, r){
  const list = M.resultPhases(r, M.allPhases(C.S), M.phasesFor(C.S, f));
  return { c: M.curvesFrom(f, r, list, C.S.std), list };
}
function stepOf(C, [op, a, b, d]){
  const S = C.S, list = M.allPhases(S), f = C.curFile(), q = list.length ? list[a % list.length] : null, F = M.FIT;
  const fsNow = fitSettings(S.fit), shown = m => M.fitTxt(m.pct ? fsNow[m.k]*100 : fsNow[m.k]);
  // (the settings' fields as their body was last built: none where it never was)
  const has = t => C.body.includes(t), row = k => q && has(`data-sec="${q.id}"`) && C.rows.modes.some(m=> m.k === k);
  const take = (m, e)=>{ const t = M.fitEntry(S.fit, m, e, ()=> M.autoInvOf(f).on); if (t && t.fit){ S.fit = t.fit; S.fitNote = null; } else if (t && t.refused) S.fitNote = t.refused; else if (t && t.same) S.fitNote = null; };
  if (op === 'mode'){ if (row(b)) q.on[b] = d; }
  else if (op === 'depth'){ if (row(b) && M.listOf(q, M.MODE[b]).some(([v])=> v === d)) q.dep[b] = d; }
  else if (op === 'hold'){ if (has(`data-hold="${a}"`)) S.hold = M.holdWith(S.hold, a, b); }
  else if (op === 'start'){ if (has('data-start=') && a !== S.startFrom) S.startFrom = a === 'last' ? 'last' : 'cif'; }
  else if (op === 'fit'){ if (has(`data-fit="${a}"`)) take(F[a], { auto: false, checked: false, value: b, shown: shown(F[a]) }); }
  else if (op === 'auto'){ if (has('data-fit-auto=')) take(F.bgInv, { auto: true, checked: a, value: 'on', shown: undefined }); }
  else if (op === 'bginv'){ if (has('data-fit="bgInv"')) take(F.bgInv, { auto: false, checked: a, value: 'on', shown: undefined }); }
  else if (op === 'choice'){ if (has('data-fit="shapeLine"')) take(F.shapeLine, { auto: false, checked: false, value: a, shown: undefined }); }
  else if (op === 'def'){ if (has('data-fit-def') && M.fitShown(S.fit, S.std, C.rows.fits)){ S.fit = {}; S.fitNote = null; } }
  else if (op === 'tick'){ const p = S.phases.length ? S.phases[a % S.phases.length] : null; if (p && f){ if (p.off[f.name]) delete p.off[f.name]; else p.off[f.name] = true; } }
  else if (op === 'pick'){ if (q) S.pick = q.id; }
  else if (op === 'del'){ if (q && q !== S.lab6) M.dropPhase(S, q.id); }
  else if (op === 'sel'){ if (q && q.id !== S.sel) S.sel = q.id; }
  else if (op === 'norm'){ if (has('data-res-norm')) S.resNorm = PAGE.normOf(a); }
  else if (op === 'clear'){ if (f && S.results[f.name]) delete S.results[f.name]; }
  else if (op === 'step') C.cur = Math.max(0, Math.min(C.fs.length - 1, C.cur + a));
  else if (op === 'restore') return putState(C, otherState(C.c, C.fs, a));
  return 'ok';
}
function outputs(C, said){
  const S = C.S, fs = C.fs, f = fs[C.cur], r = S.results[f.name], all = M.allPhases(S);
  // (draw: the phase on show one of the list's; the size chart by peak only with peak widths)
  if (!all.some(q=> q.id === S.sel)) S.sel = all.length ? (S.std ? S.pick : all[0].id) : null;
  if (!S.std && S.sizeBy === 'peak' && !fs.some(g=> S.results[g.name] && S.results[g.name].params && S.results[g.name].widths)) S.sizeBy = 'sample';
  const o = { said, state: M.snapshotOf(S) };
  o.rows = H.phaseRowsHtml(all, { p: C.p, std: S.std, pick: S.pick, sel: S.sel, f, lab6: S.lab6, dlIcon: PAGE.DL_SVG, xIcon: PAGE.X_SVG });
  let cv = null;
  if (r && r.params){ try { cv = curvesOf(C, f, r); } catch(e){ cv = null; } }
  const shown = r && r.params ? (cv ? cv.list : M.phasesFor(S, f)) : M.phasesFor(S, f), done = !!(r && r.params);
  o.fitSet = [H.fitLineHtml(shown, r, done, done ? M.fitUsed(r, S.std) : [], S.std), M.fitSetTitle(done, shown.length)];
  // (lost: a result whose curve cannot be drawn says so, as xrd-rv.js renderResults, v571)
  o.results = H.resultsHtml({ r, std: S.std, shown, n: M.phasesFor(S, f).length, any: S.phases.length, irf: C.irf, stale: ()=> !S.std && !!r.irf && !M.sameIrf(r.irf, C.irf()), lost: done && !cv });
  // (the settings' body built again only when the phases on show change: with none at all, a
  // window opened on them was never built, as since v460)
  const key = M.settingsKeyOf(all);
  if (key !== S.setKey){ S.setKey = key; C.body = H.settingsBodyHtml(all, { p: C.p, std: S.std, lab6: S.lab6, ...C.rows, normOptions: PAGE.NORM_OPTIONS }); }
  o.settings = C.body;
  const groups = cv ? M.groupTicks(cv.c.ticks, cv.list) : M.tickRows(f, M.phasesFor(S, f));
  o.frame = M.patternFrame(f.y, groups.length, cv ? f.y.map((v, i)=> v - cv.c.yc[i]) : null, M.scanRange(f)).range;
  o.legend = H.patternLegendHtml(!!cv, groups);
  o.csv = M.csvTables('', fs, S.results, { curves: (g, x)=> curvesOf(C, g, x), stale: (g, x)=> !S.std && !!x.irf && !M.sameIrf(x.irf, C.irf()), std: S.std },
    { data: PAGE.fmtData, line: PAGE.csvLine, decimal: '.' }).map(e=> [e.name, sha(e.text)]);
  return o;
}
export function runCase(c){
  const fs = patternsOf(c), C = cardOf(c, fs), out = [];
  C.p = c.std ? 'xrdStdR' : 'xrdR2';
  out.push(outputs(C, putState(C, stateOf(c, fs))));
  for (const s of c.steps) out.push(outputs(C, stepOf(C, s)));
  return canon(out);
}

test('60 cases as v558\'s xrd-rv.js gave them: the state, the list, the results, the settings, the pattern\'s frame, the CSVs (golden digests)', ()=>{
  const got = { cases: Array.from({ length: 60 }, (_, n)=> sha(runCase(caseOf(n)))) };
  if (UPDATE){ fs.writeFileSync(GOLDEN, JSON.stringify(got, null, 1) + '\n'); return; }
  const want = JSON.parse(fs.readFileSync(GOLDEN, 'utf8'));
  const off = got.cases.map((h, i)=> h === want.cases[i] ? null : i).filter(i=> i !== null);
  assert.deepEqual(off, [], 'cases whose digest differs');
  assert.equal(got.cases.length, want.cases.length);
});
