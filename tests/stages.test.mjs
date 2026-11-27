/* The long numeric and parsing routines split into named stages in v565, in Node, no browser:
   parseCif and findSymmetry (xrd-cryst.js; findSymmetry through structureCell and
   prepPhase), buildModel, refineHeld (through autoRefine's options), bodyShapeOf (through
   shapeOf) and freeShapeRun (through autoRefine's free shape) (xrd-rietveld.js),
   measureWidths (xrd-widths.js) and the worker's summarise (xrd-rietveld.worker.js, run on
   its messages with a stand-in `self`). Their outputs on synthetic inputs through their
   branches — CIFs written from space groups closed from their generators in every crystal
   system, with their variants and faults; the cells' contents in P1, noisy, shifted, in a
   supercell, partly empty; models of every option; refinements from bodies of each kind,
   their records varied; the worker's message sequences, a standard, a sample with every
   option, a tetragonal phase with Stephens' strain, faults and its sites' B, an absent
   phase, the free shape, errors — as v564's one-piece functions gave them, bit for bit:
   SHA-256 digests of a canonical dump (every number by its shortest round-trip string, the
   keys in order, a shared reference as one; the model after, the progress, the clock's
   readings and Math.random's calls with them) in tests/golden/stages.json, which npm run
   test:update writes anew. About 40 s. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { CIF } from './fixtures.mjs';
import * as C from '../xrd-cryst.js';
import * as R from '../xrd-rietveld.js';
import { measureWidths } from '../xrd-widths.js';
import { prepPhase } from '../xrd-rv-model.js';

const UPDATE = !!process.env.UPDATE_GOLDEN || process.env.npm_lifecycle_event === 'test:update';
const GOLDEN = path.join(path.dirname(fileURLToPath(import.meta.url)), 'golden', 'stages.json');
const got = {};

// ---- a canonical dump, and the run of a case on a counted clock and a seeded Math.random
function canon(root){
  const seen = new Map(), out = [];
  const walk = (x, p) => {
    if (x === null){ out.push('null'); return; }
    const t = typeof x;
    if (t === 'number'){ out.push(Object.is(x, -0) ? '-0' : String(x)); return; }
    if (t === 'string'){ out.push(JSON.stringify(x)); return; }
    if (t === 'boolean' || t === 'undefined' || t === 'bigint'){ out.push(String(x)); return; }
    if (t === 'function'){ out.push('fn:' + x.name); return; }
    if (seen.has(x)){ out.push('ref:' + seen.get(x)); return; }
    seen.set(x, p);
    if (ArrayBuffer.isView(x)){ out.push(x.constructor.name + '['); for (let i = 0; i < x.length; i++){ if (i) out.push(','); walk(x[i], p + '.' + i); } out.push(']'); return; }
    if (x instanceof Map){ out.push('Map{'); let i = 0; for (const [k, v] of x){ if (i) out.push(','); walk(k, p + '.k' + i); out.push('=>'); walk(v, p + '.v' + i); i++; } out.push('}'); return; }
    if (x instanceof Set){ out.push('Set{'); let i = 0; for (const v of x){ if (i) out.push(','); walk(v, p + '.s' + i); i++; } out.push('}'); return; }
    if (Array.isArray(x)){ out.push('['); for (let i = 0; i < x.length; i++){ if (i) out.push(','); if (!(i in x)) out.push('<hole>'); else walk(x[i], p + '.' + i); } out.push(']'); return; }
    out.push('{');
    Object.keys(x).forEach((k, i)=> { if (i) out.push(','); out.push(JSON.stringify(k) + ':'); walk(x[k], p + '.' + k); });
    out.push('}');
  };
  walk(root, '$');
  return out.join('');
}
const digest = x => createHash('sha256').update(canon(x)).digest('hex');
function seeded(seed){
  let s = seed >>> 0;
  const u = ()=> { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0)/4294967296; };
  return { u, n: ()=> Math.sqrt(-2*Math.log(u() || 1e-300))*Math.cos(2*Math.PI*u()), int: k => Math.floor(u()*k) };
}
// Each case's output, or its error, with the clock's readings and Math.random's calls.
function run(f){
  const realNow = Date.now, realRandom = Math.random, g = seeded(99);
  let tick = 0, randoms = 0;
  Date.now = ()=> 1e12 + 1000*(++tick);
  Math.random = ()=> { randoms++; return g.u(); };
  try { return { value: f(), ticks: tick, randoms }; }
  catch(e){ return { error: String(e && e.message || e), ticks: tick, randoms }; }
  finally { Date.now = realNow; Math.random = realRandom; }
}
const keep = (name, x) => { got[name] = digest(x); };

// ---- CIFs from space groups closed from their generators
const parseOp = s => {
  const Rm = [], t = [];
  s.split(',').forEach(c=> {
    const r = [0, 0, 0]; let tt = 0;
    for (const m of c.replace(/\s/g, '').matchAll(/([+-]?)(\d+\/\d+|[xyz])/g)){
      const sg = m[1] === '-' ? -1 : 1;
      if ('xyz'.includes(m[2])) r['xyz'.indexOf(m[2])] = sg; else { const [a, b] = m[2].split('/'); tt += sg*a/b; }
    }
    Rm.push(...r); t.push(tt - Math.floor(tt));
  });
  return { R: Rm, t };
};
const mulOp = (A, B) => ({ R: [0, 1, 2].flatMap(i=> [0, 1, 2].map(j=> A.R[3*i]*B.R[j] + A.R[3*i + 1]*B.R[3 + j] + A.R[3*i + 2]*B.R[6 + j])),
  t: [0, 1, 2].map(i=> { const v = A.R[3*i]*B.t[0] + A.R[3*i + 1]*B.t[1] + A.R[3*i + 2]*B.t[2] + A.t[i]; const w = Math.round((v - Math.floor(v))*24)/24; return w >= 1 ? 0 : w; }) });
const keyOp = o => o.R.join() + '|' + o.t.map(v=> Math.round(v*24)).join();
function closeGroup(gens){
  const ops = [parseOp('x,y,z')], seen = new Set([keyOp(ops[0])]);
  for (let i = 0; i < ops.length; i++) for (const g of gens.map(parseOp)) for (const p of [mulOp(ops[i], g), mulOp(g, ops[i])]){ const k = keyOp(p); if (!seen.has(k)){ seen.add(k); ops.push(p); } }
  return ops;
}
const frac = v => { const k = Math.round(v*24); if (!k) return ''; const gcd = (a, b)=> b ? gcd(b, a % b) : a, d = gcd(k, 24); return '+' + (k/d) + '/' + (24/d); };
const opText = o => [0, 1, 2].map(i=> { let s = ''; for (let j = 0; j < 3; j++){ const c = o.R[3*i + j]; if (c) s += (c < 0 ? '-' : s ? '+' : '') + 'xyz'[j]; } return s + frac(o.t[i]); }).join(', ');
const cell = (a, b, c, al, be, ga) => ({ a, b, c, alpha: al, beta: be, gamma: ga });
const GROUPS = [
  ['P -1', 2, cell(5.1, 6.2, 7.3, 81, 97, 103), ['-x,-y,-z']],
  ['P 1 21/c 1', 14, cell(5.1, 6.2, 7.3, 90, 105.3, 90), ['-x,y+1/2,-z+1/2', '-x,-y,-z']],
  ['C 1 2/c 1', 15, cell(9.1, 6.2, 7.3, 90, 111.2, 90), ['-x,y,-z+1/2', '-x,-y,-z', 'x+1/2,y+1/2,z']],
  ['P n m a', 62, cell(5.5, 7.7, 5.4, 90, 90, 90), ['-x+1/2,-y,z+1/2', '-x,y+1/2,-z', '-x,-y,-z']],
  ['I 4/m m m', 139, cell(3.9, 3.9, 12.4, 90, 90, 90), ['-y,x,z', 'x,-y,-z', '-x,-y,-z', 'x+1/2,y+1/2,z+1/2']],
  ['P 42/m n m', 136, cell(4.594, 4.594, 2.959, 90, 90, 90), ['-y+1/2,x+1/2,z+1/2', 'x+1/2,-y+1/2,-z+1/2', '-x,-y,-z']],
  ['R -3 m :H', 166, cell(3.1, 3.1, 15.2, 90, 90, 120), ['-y,x-y,z', 'y,x,-z', '-x,-y,-z', 'x+2/3,y+1/3,z+1/3']],
  ['P 63/m m c', 194, cell(3.21, 3.21, 5.21, 90, 90, 120), ['-y,x-y,z', '-x,-y,z+1/2', 'y,x,-z', '-x,-y,-z']],
  ['P 21 3', 198, cell(6.1, 6.1, 6.1, 90, 90, 90), ['z,x,y', '-x+1/2,-y,z+1/2']],
  ['F m -3 m', 225, cell(5.64, 5.64, 5.64, 90, 90, 90), ['z,x,y', '-y,x,z', '-x,-y,-z', 'x,y+1/2,z+1/2', 'x+1/2,y,z+1/2']],
];
const EL = ['Sr', 'Ti', 'O', 'Ba', 'La', 'Na', 'Cl', 'Zn'];
function writeCif(hm, it, c, ops, sites, o = {}){
  const L = ['data_g'];
  for (const k of ['a', 'b', 'c']) L.push(`_cell_length_${k} ${c[k].toFixed(o.lenDigits ?? 4)}`);
  for (const k of ['alpha', 'beta', 'gamma']) if (o.noAng !== k) L.push(`_cell_angle_${k} ${+c[k].toFixed(3)}`);
  if (!o.noHm) L.push(`_symmetry_space_group_name_H-M '${hm}'`);
  if (o.it) L.push(`_symmetry_Int_Tables_number ${it}`);
  if (o.formula) L.push(`_chemical_formula_sum '${o.formula}'`, '_cell_formula_units_Z 1');
  if (ops && !o.noOps){
    const list = o.noId ? ops.slice(1) : o.dropOp ? ops.filter((_, i)=> i !== 3) : ops;
    L.push('loop_', '_symmetry_equiv_pos_as_xyz', ...list.map(op=> `'${opText(op)}'`));
    if (o.badOp) L.push("'x, y, q'");
  }
  L.push('loop_', '_atom_site_label', ...(o.noType ? [] : ['_atom_site_type_symbol']), '_atom_site_fract_x', '_atom_site_fract_y', '_atom_site_fract_z', '_atom_site_occupancy', o.U ? '_atom_site_U_iso_or_equiv' : '_atom_site_B_iso_or_equiv');
  sites.forEach((s, i)=> L.push([`${s.el}${i + 1}`, ...(o.noType ? [] : [s.el]), ...[s.x, s.y, s.z].map(v=> v.toFixed(o.digits ?? 5)), String(s.occ), (o.U ? s.B/79 : s.B).toFixed(3)].join(' ')));
  if (o.aniso) L.push('loop_', '_atom_site_aniso_label', '_atom_site_aniso_B_11', '_atom_site_aniso_B_22', '_atom_site_aniso_B_33', ...sites.map((s, i)=> `${s.el}${i + 1} 0.${3 + i} 0.4 0.5`));
  return L.join('\n') + '\n';
}
const VARIANTS = [{}, { it: true, noHm: true }, { noId: true }, { dropOp: true }, { badOp: true }, { noAng: 'gamma' }, { noType: true, U: true, aniso: true }, { digits: 2 }, { noOps: true }, { noOps: true, it: true, noHm: true }];
const LAB6 = fs.readFileSync(new URL('../xrd-rv.js', import.meta.url), 'utf8').match(/const LAB6_CIF = `([^`]*)`/)[1];

test('parseCif, and findSymmetry through structureCell and prepPhase: v564\'s outputs on 10 groups\' CIFs in 10 variants, their contents in P1 in 6', ()=>{
  const g = seeded(7);
  for (const [hm, it, c, gens] of GROUPS){
    const ops = closeGroup(gens), parsed = [], phases = [], cells = [];
    for (let v = 0; v < VARIANTS.length; v++){
      const sites = Array.from({ length: 1 + g.int(3) }, (_, i)=> ({ el: EL[(i + v) % EL.length], x: g.u(), y: g.u(), z: g.u(), occ: g.u() < 0.2 ? 0.5 : 1, B: 0.2 + g.u() }));
      if (v % 3 === 0) Object.assign(sites[0], { x: 0, y: 0, z: 0 });
      const text = writeCif(hm, it, c, ops, sites, VARIANTS[v]);
      parsed.push(run(()=> C.parseCif(text)));
      if (v < 4) phases.push(run(()=> prepPhase(text, 'g.cif')));
      if (v) continue;
      // the cell's contents in P1: as they are, with noise, rounded, shifted, in a supercell, partly empty
      const P = C.parseCif(text), at = C.expandAtoms(P.ops, P.sites).map(a=> ({ ...a, eps: undefined }));
      const named = writeCif(hm, it, c, null, at.map(a=> ({ el: a.element, x: a.x, y: a.y, z: a.z, occ: a.occ, B: a.Biso })), { noOps: true, formula: at.map(a=> a.element).join(' ') });
      parsed.push(run(()=> C.parseCif(named)));
      for (const [atoms, cl, tol] of [[at, c, 0.01], [at.map(a=> ({ ...a, x: a.x + 0.001*g.n(), y: a.y + 0.001*g.n(), z: a.z + 0.001*g.n() })), c, 0.01],
        [at.map(a=> ({ ...a, x: +a.x.toFixed(2), y: +a.y.toFixed(2), z: +a.z.toFixed(2), eps: [0.005, 0.005, 0.005] })), c, 0.01], [at.map(a=> ({ ...a, x: a.x + 0.123, z: a.z - 0.21 })), c, 0.05],
        [[...at.map(a=> ({ ...a, x: a.x/2 })), ...at.map(a=> ({ ...a, x: a.x/2 + 0.5 }))], { ...c, a: 2*c.a }, 0.01], [at.map((a, i)=> i % 3 === 1 ? { ...a, occ: 0, Biso: a.Biso + 0.3 } : a), c, 0.002]])
        cells.push(run(()=> C.structureCell(cl, structuredClone(atoms), tol)));
    }
    keep('cif ' + hm, { parsed, phases, cells });
  }
  // the fixture's, LaB6, and what cannot be read
  // (charges with no form factor of their own, the nearest taken or a mix; a species unknown; elements read from labels)
  const species = "data_s\n_cell_length_a 5.1\n_cell_length_b 5.2\n_cell_length_c 5.3\n_chemical_formula_sum 'Ho Mn Cr Fe U O2 D'\nloop_\n_atom_site_label\n_atom_site_type_symbol\n_atom_site_fract_x\n_atom_site_fract_y\n_atom_site_fract_z\n"
    + 'A1 Mn3.5+ 0 0 0\nA2 Cr6+ 0.5 0 0\nA3 Fe2.7+ 0 0.5 0\nA4 U5+ 0 0 0.5\nA5 O2- 0.5 0.5 0\nA6 Qq 0.5 0.5 0.5\nHO1 ? 0.25 0.25 0.25\nD1 . 0.75 0.25 0.25\nX9 Pb9+ 0.1 0.6 0.3\n';
  for (const [nm, t] of [['SrTiO3', fs.readFileSync(CIF, 'utf8')], ['LaB6', LAB6], ['species', species], ['empty', ''], ['cartesian', 'data_c\n_cell_length_a 5\nloop_\n_atom_site_label\n_atom_site_Cartn_x\nFe1 0\n'],
    ['magnetic', 'data_m\n_cell_length_a 5\n_cell_length_b 5\n_cell_length_c 5\n_space_group_magn_name_BNS \'P m\'\nloop_\n_space_group_symop_magn_operation.xyz\nx,y,z,+1\n-x,y,z,-1\nloop_\n_space_group_symop_magn_centering.xyz\nx,y,z,+1\nx+1/2,y+1/2,z,+1\nloop_\n_atom_site_label\n_atom_site_fract_x\n_atom_site_fract_y\n_atom_site_fract_z\nFe1 0.1 0.2 0.3\n']])
    keep('cif ' + nm, { parsed: run(()=> C.parseCif(t)), phase: run(()=> prepPhase(t, nm + '.cif')) });
  compare(/^cif /);
});

// ---- the phases and patterns (the engine draws them)
const LAM1 = 1.540598;
const X = Array.from({ length: 2001 }, (_, i)=> +(20 + i*0.04).toFixed(6));
const INSTR = { lam1: LAM1, lam2: 1.544426, ratio: 0.5, radius: 240, monochromator: false };
const INSTR_SOL = { ...INSTR, soller: { incident: 0.04, diffracted: 0.04 } };
const IRF = { U: 0.0012, V: -0.0008, W: 0.0006, X: 0.006, Y: 0.012, asym: 0, zero: 0, transp: 0, lam1: LAM1, radius: 240 };
const PROF = { U: 0.0012, V: -0.0008, W: 0.0006, X: 0.006, Y: 0.012, asym: 0, zero: 0, transp: 0 };
const STO = fs.readFileSync(CIF, 'utf8');
const SRT = prepPhase(STO, 'SrTiO3.cif'), BTO = prepPhase(STO.replace(/SrTiO3/g, 'BaTiO3').replace(/Sr/g, 'Ba').replace(/3\.905/g, '4.00'), 'BaTiO3.cif');
const LAB = prepPhase(LAB6, 'LaB6');
const RUT = prepPhase(`data_rutile\n_cell_length_a 4.594\n_cell_length_b 4.594\n_cell_length_c 2.959\n_cell_angle_alpha 90\n_cell_angle_beta 90\n_cell_angle_gamma 90\nloop_\n_symmetry_equiv_pos_as_xyz\n'x, y, z'\nloop_\n_atom_site_label\n_atom_site_type_symbol\n_atom_site_fract_x\n_atom_site_fract_y\n_atom_site_fract_z\n_atom_site_B_iso_or_equiv\nTi1 Ti 0 0 0 0.4\nTi2 Ti 0.5 0.5 0.5 0.4\nO1 O 0.305 0.305 0 0.6\nO2 O 0.695 0.695 0 0.6\nO3 O 0.805 0.195 0.5 0.6\nO4 O 0.195 0.805 0.5 0.6\n`, 'rutile.cif');
const ph = (Q, id, more = {}) => ({ id, name: Q.name, cell: Q.cell, constraint: Q.constraint, ops: Q.ops, atoms: Q.atoms, mass: Q.mass, color: '#888',
  size: true, shape: false, profile: 'lorentz', strain: 'iso', adp: 'cif', po: null, occ: null, faults: null, ...more });
const widthOf = D => R.K_SCHERRER*LAM1/(D*10)*180/Math.PI;
function draw({ phases, instr = INSTR, P, top = 2e4, seed = 12345, shapeLine }){
  const g = seeded(seed);
  const m = R.buildModel({ x: X, y: X.map(()=> 1), instr, phases, ...(shapeLine ? { shapeLine } : null) });
  const yc = R.calc(m, { ...R.getParams(m), bg0: 0, ...P }).yc, sc = top/Math.max(...yc);
  return X.map((t, i)=> { const l = yc[i]*sc + 200 + 30*Math.exp(-(t - 20)/30); return Math.max(0, Math.round(l + Math.sqrt(l)*g.n())); });
}
const once = f => { let y = null; return ()=> y || (y = f()); };
const pat = {
  sto: once(()=> draw({ phases: [ph(SRT, 1)], P: { ...PROF, W: 0.004, Y: 0.05, zero: 0.02, 'p1.a': 3.9087, 'p1.scale': 1 } })),
  wppm: once(()=> draw({ phases: [ph(SRT, 1, { profile: 'wppm' })], P: { ...PROF, 'p1.a': 3.9071, 'p1.Ys': widthOf(14), 'p1.Xs': 0.02, 'p1.scale': 1 } })),
  lab6: once(()=> draw({ instr: INSTR_SOL, phases: [ph(LAB, 1)], P: { ...PROF, zero: -0.03, axL: 15, transp: -0.01, 'p1.scale': 1 } })),
  two: once(()=> draw({ phases: [ph(SRT, 1), ph(BTO, 2)], P: { ...PROF, 'p1.a': 3.9071, 'p2.a': 3.998, 'p1.Ys': widthOf(30), 'p2.Ys': widthOf(12), 'p1.scale': 1, 'p2.scale': 0.6 } })),
  box: once(()=> draw({ phases: [ph(SRT, 1, { shape: 'box', profile: 'wppm' })], shapeLine: 'exact', P: { ...PROF, 'p1.scale': 1, 'p1.Wa': widthOf(8), 'p1.Wb': widthOf(5), 'p1.Wc': widthOf(3) } })),
  rut: once(()=> draw({ phases: [ph(RUT, 1, { strain: 'aniso' })], P: { ...PROF, 'p1.Ys': widthOf(25), 'p1.Xs': 0.05, 'p1.S1': 400, 'p1.S2': -300, 'p1.scale': 1 }, seed: 5 })),
  disc: once(()=> draw({ phases: [ph(SRT, 1, { shape: 'cylinder', profile: 'wppm' })], shapeLine: 'exact', P: { ...PROF, 'p1.scale': 1, 'p1.Wd': widthOf(12), 'p1.Wh': widthOf(3) }, seed: 4 })),
};

test('buildModel: v564\'s models of 40 settings (instruments, scans reversed, masked, rates, every phase option, the background\'s terms, errors)', ()=>{
  const g = seeded(5), y0 = X.map((t, i)=> 200 + 1000*Math.exp(-(((t - 32.4)/0.2)**2)) + (i % 7));
  const INS = [null, {}, INSTR, INSTR_SOL, { ...INSTR, monochromator: true }, { ...INSTR, monochromator: true, monoAngle: 26.6 }, { lam1: 1.6, lam2: 1.6, ratio: 0 }, { lam1: 0.7093, lam2: 0.71359, ratio: 0.5, radius: 200 }];
  const OPT = [{}, { shape: 'box' }, { shape: 'ellipsoidL' }, { shape: 'spheroid', profile: 'lognormal' }, { shape: 'ellcyl', lorentzShape: true }, { profile: 'wppm', strain: 'aniso' }, { strain: 'off' },
    { size: false, shape: 'box', profile: 'lognormal' }, { faults: '111:1/6<112>' }, { adp: 'site' }, { adp: 'aniso' }, { occ: ['Sr1'] }, { po: '100' }, { po: 'auto' }, { po: 'xyz' }];
  const PH = [SRT, BTO, RUT, LAB];
  for (let c = 0; c < 40; c++){
    const phases = Array.from({ length: g.int(3) }, (_, i)=> ph(PH[g.int(4)], i + 1, OPT[g.int(OPT.length)]));
    if (c === 13) phases.push(ph(SRT, 1));
    const x = c % 5 === 1 ? X.slice().reverse() : c % 7 === 3 ? X.map(t=> t - 21) : X;
    let y = c % 5 === 1 ? y0.slice().reverse() : y0.slice();
    if (c % 3 === 2) y = y.map((v, i)=> i % 17 ? v : NaN);
    if (c % 7 === 5) y = y.map(v=> v*0.013);
    const args = { x, y, varMul: c % 9 === 4 ? x.map((_, i)=> i % 31 ? 1 + (i % 3) : 0) : null, instr: INS[c % INS.length], phases,
      ...(c % 4 === 1 ? { prof: { W: 0.004, Y: 0.05, Xs: 0.01, Ys: 0.02, axL: 12, transp: -0.01 } } : null), ...(c % 6 === 2 ? { bgDegree: [0, 3, 12.7][c % 3], bgInv: [true, false, 'auto'][c % 3] } : null),
      ...(c % 8 === 3 ? { cellRange: 0.15, shapeLine: 'exact' } : null) };
    keep('model ' + c, run(()=> R.buildModel(args)));
  }
  keep('model too few', run(()=> R.buildModel({ x: X.slice(0, 6), y: y0.slice(0, 6), phases: [] })));
  keep('model nan', run(()=> R.buildModel({ x: X.map((t, i)=> i === 9 ? NaN : t), y: y0, phases: [] })));
  compare(/^model /);
});

// The worker, its module run in Node: `self` a stand-in that keeps what it posts.
let posted = null, handler = null;
globalThis.self = { addEventListener: (t, f)=> { if (t === 'message') handler = f; }, postMessage: m => posted.push(structuredClone(m)) };
const W = await import('../xrd-rietveld.worker.js');
const worker = data => run(()=> { posted = []; handler({ data }); return posted; });

test('refineHeld, freeShapeRun, bodyShapeOf, measureWidths and summarise: v564\'s refinements, shapes, widths and worker messages', ()=>{
  const startOf = r => ({ params: r.params, free: r.free, held: r.held || [], models: r.models, textures: r.textures, shapes: r.shapes || {}, isoParams: r.isoParams || null, detected: r.detected, irf: r.irf || null });
  // refineHeld through autoRefine's settings: few iterations, a large λ, a loose shift test
  for (const [nm, fit] of [['iter3', { maxIter: 3 }], ['lambda', { lambda: 1e3, shiftTol: 0.5 }], ['bg', { bgDegree: 12, bgInv: true }]]){
    keep('refine ' + nm, run(()=> { const m = R.buildModel({ x: X, y: pat.sto(), instr: INSTR, phases: [ph(SRT, 1, { adp: 'overall' })], bgDegree: fit.bgDegree, bgInv: fit.bgInv }), prog = [];
      return { res: R.autoRefine(m, { fit, onProgress: (f, s)=> prog.push([f, s]) }), prog, v: m.v }; }));
  }
  // the free shape: a box kept (held on the lattice), a cylinder; shapeOf on each, its record varied; the widths
  for (const [nm, y, type, fit] of [['box', pat.box, 'box', { shapeLine: 'exact' }], ['cylinder', pat.disc, 'cylinder', { shapeLine: 'exact', shapeFull: 2 }]]){
    let model, res;
    keep('shape ' + nm, run(()=> { model = R.buildModel({ x: X, y: y(), instr: INSTR, phases: [ph(SRT, 1, { shape: type })], shapeLine: 'exact' }); const prog = [];
      res = R.autoRefine(model, { irf: IRF, fit, onProgress: (f, s)=> prog.push([f, s]) }); return { res, prog, v: model.v }; }));
    const info = (res.shapes || {})[1] || {};
    for (const [vn, rr] of [['as', res], ['held', { ...res, shapes: { 1: { ...info, held: true, freeW: model.phases[0].iW.map(i=> model.v[i]*1.1), freeOff: [3, 7, 1] } } }],
      ['flagged', { ...res, shapes: { 1: { ...info, check: info.check && { ...info.check, flagged: true } } } }], ['nocov', { ...res, cov: null }]])
      keep(`shapeOf ${nm} ${vn}`, run(()=> R.shapeOf(model, model.v.slice(), 0, rr)));
    keep('widths ' + nm, run(()=> { const prog = []; return { w: measureWidths(model, res, { irf: IRF, isoParams: res.isoParams, shapeIds: Object.keys(res.shapes || {}), onProgress: (i, n)=> prog.push([i, n]) }), prog }; }));
  }
  keep('widths two', run(()=> { const m = R.buildModel({ x: X, y: pat.two(), instr: INSTR, phases: [ph(SRT, 1), ph(BTO, 2)] }), res = R.autoRefine(m, { irf: IRF }); return measureWidths(m, res, { irf: IRF }); }));
  // the worker's messages: a standard, a sample with every option, an absent phase, from the last result, errors
  const msg = (id, y, phases, opts, instr = INSTR) => ({ id, x: X, y, varMul: null, instr, phases, opts });
  const std = worker(msg(1, pat.lab6(), [ph(LAB, 1, { adp: 'overall', po: '100' })], { standard: true }, INSTR_SOL));
  keep('worker standard', std);
  const all = worker(msg(2, pat.wppm(), [ph(SRT, 1, { profile: 'lognormal', strain: 'aniso', faults: '111:1/6<112>', adp: 'site', occ: ['Sr1'], po: '100' })], { irf: IRF }));
  keep('worker everything', all);
  keep('worker aniso adp', worker(msg(3, pat.wppm(), [ph(SRT, 1, { profile: 'wppm', adp: 'aniso' })], { irf: IRF })));
  const two = worker(msg(4, pat.two(), [ph(SRT, 1), ph(BTO, 2), ph(RUT, 3)], { irf: IRF }));
  keep('worker absent', two);
  keep('worker held', worker(msg(5, pat.two(), [ph(SRT, 1, { adp: 'site' }), ph(BTO, 2), ph(RUT, 3)], { irf: IRF, start: startOf(two.value.at(-1).res), hold: ['cell', 'linear'] })));
  keep('worker off', worker(msg(6, pat.sto(), [ph(SRT, 1, { strain: 'off', size: false })], {})));
  keep('worker ellipsoidL', worker(msg(7, pat.wppm(), [ph(SRT, 1, { shape: 'ellipsoidL' })], { irf: IRF })));
  keep('worker rutile', worker(msg(10, pat.rut(), [ph(RUT, 1, { strain: 'aniso', adp: 'site', faults: '110:1/2<001>', po: '001' })], { irf: IRF })));
  keep('worker errors', [worker(msg(8, pat.sto().slice(0, 5), [ph(SRT, 1)], {})), worker({ id: 9, x: X, y: pat.sto(), phases: [] }), worker(null)]);
  compare(/^(refine|shape|shapeOf|widths|worker) /);
  assert.equal(std.value.at(-1).type, 'result');
  assert.ok(all.value.at(-1).res.table.some(r=> r.name === 'stephens_anisotropy_rms_1e-6'));
  assert.match(two.value.at(-1).res.warnings.map(m=> `${m.kind}: ${m.text}`).join('|'), /warn: rutile: not detected/);
});

/* v568: the free shape's line against the isotropic size gives the search's ΔBIC (its keep
   test's), which the line's title says is under −10 where the per-line check fired (28; to
   v567 the ΔBIC of the fit after the search, refined again, which could stand above −10
   beside that title); a shape kept by ΔBIC before v523's keep test, which has no keep: its
   fit's, as before. */
test('the free shape against the isotropic size: the search\'s ΔBIC, which its title is about', ()=>{
  // the fit's own: (4900 − 5000)/2.5 + 6·ln 2001 = −40 + 45.6
  const info = { chi2Iso: 5000, chi2: 4900, Piso: 20, P: 26, N: 2001, chi2redIso: 2.5, keep: { G: 30, need: 20, k: 5, flagged: true, dBIC: -12.4 } };
  const own = (info.chi2 - info.chi2Iso)/info.chi2redIso + (info.P - info.Piso)*Math.log(info.N);
  const line = i => { const S = { table: [] }, lines = []; W.isoCompareLine(S, 'SrTiO3', lines, i); return [lines[0].value, S.table[0].value, lines[0].title]; };
  const [v, row, title] = line(info);
  assert.deepEqual([v, row], ['ΔBIC -12', -12.4]);
  assert.match(title, /as the fit misses some lines \(the per-line check\) its ΔBIC is under −10 too/);
  assert.deepEqual(line({ ...info, keep: { ...info.keep, flagged: false } }).slice(0, 2), ['ΔBIC -12', -12.4]);
  assert.deepEqual(line({ ...info, keep: undefined }).slice(0, 2), [`ΔBIC ${own.toFixed(0)} (shape supported: under −10)`, own]);
  // v569: the title's χ² and parameters those the ΔBIC comes from, the search's best fit's
  // (5000 + (−12.4 − 6·ln 2001)·2.5 = 4855), the fit's after it beside them (to v568 the
  // fit's alone: 5000 → 4900, which give −40 + 45.6, not −12).
  const dP = 6, cs = info.chi2Iso + (info.keep.dBIC - dP*Math.log(info.N))*info.chi2redIso;
  assert.equal(cs.toFixed(0), '4855');
  const t2 = line({ ...info, keep: { ...info.keep, dP } })[2];
  assert.match(t2, /χ² 5000 → 4855 with 6 more parameters \(the search's best fit; refined again after it, χ² 4900 with 6\); BIC with χ² divided by the isotropic fit's χ²_ν \(2\.50\)/);
  assert.ok(Math.abs((cs - info.chi2Iso)/info.chi2redIso + dP*Math.log(info.N) - info.keep.dBIC) < 1e-9, 'they give the ΔBIC shown');
  // the search's own fit the last: no aside; a χ²_ν under 1 said taken as 1; none kept: the fit's, as before
  const same = { ...info, chi2: Math.round(cs), keep: { ...info.keep, dP } };
  assert.match(line(same)[2], /χ² 5000 → 4855 with 6 more parameters; BIC/);
  assert.match(line({ ...same, chi2redIso: 0.8 })[2], /χ²_ν \(0\.80, taken as 1\)/);
  assert.match(line({ ...info, keep: undefined })[2], /χ² 5000 → 4900 with 6 more parameters; BIC/);
});

/* v569: an axis's angular esd of 0 (reachable: sdOf clamps a variance ≤ 0 to 0, an axis fixed
   by the symmetry's constraints) is given with no ± in the results' lines and titles, as the
   3D view's labels give it since v568 (to v568 "±0°"). */
test('the shape\'s lines: an angular esd of 0 with no ±, as the 3D view\'s labels', ()=>{
  const a = (esdAngle)=> ({ angle: 2.34, uvw: '[001]', label: '[001]', esdAngle });
  const sh = { type: 'ellipsoidL' };
  assert.deepEqual([1.5, 0, NaN, 70].map(e=> W.pmTxt(a(e))), [' ±1.5°', '', '', '']);
  assert.deepEqual([1.5, 0, 70].map(e=> W.turnCost(a(e))), [', which a turn of ±1.5° (1σ, every other parameter refined again) would cost χ²_ν', '', '']);
  assert.match(W.angTitle(sh, a(1.5)), /; it is fixed to ±1\.5° \(1σ, from the covariance/);
  assert.match(W.angTitle(sh, a(0)), /; it is fixed \(1σ, from the covariance/);
  assert.doesNotMatch(W.angTitle(sh, a(0)), /±/);
  assert.match(W.angTitle(sh, a(70)), /not fixed by the data within 60°/);
});

// Every digest of the cases named so far against the golden file (written by npm run test:update).
function compare(re){
  const want = fs.existsSync(GOLDEN) ? JSON.parse(fs.readFileSync(GOLDEN, 'utf8')) : {};
  if (UPDATE){ fs.writeFileSync(GOLDEN, JSON.stringify({ ...want, ...Object.fromEntries(Object.entries(got).filter(([k])=> re.test(k))) }, null, 1) + '\n'); return; }
  const names = [...new Set([...Object.keys(want).filter(k=> re.test(k)), ...Object.keys(got).filter(k=> re.test(k))])];
  assert.deepEqual(names.filter(k=> want[k] !== got[k]), [], 'v564\'s outputs differ: ' + re);
}
