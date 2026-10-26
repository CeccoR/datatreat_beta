/* The free-shape harness: synthetic patterns from the engine's own forward model, the
   app's refinement up to the shape search (autoRefine, from the CIF, with the standard's
   profile), then one or more search methods run on that same isotropic fit, each
   measured: pattern evaluations (phasePattern calls), wall time, every refine() it made
   (the χ² path, each start's end), the final and the free solid, and their errors against
   the truth. Engine: eng/ (make-eng.mjs: the frozen bf228ee engine, instrumented only). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildModel, calc, autoRefine, setParams, ENG } from './eng/xrd-rietveld.js';
import { prepPhase } from './eng/xrd-rv-model.js';
import { readXrdmlScanText, readXrdmlInstrumentText } from './eng/xrd-instr.js';
import { CASES, caseById } from './cases.mjs';

export { CASES, caseById, ENG };
export const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCRATCH = path.resolve(HERE, '..', '..');
const CIF_PATH = path.join(SCRATCH, 'wf-xrd', 'rv-busy', 'SrTiO3.cif');
const FIX_DIR = path.join(SCRATCH, 'e2e', 'xrd');
const DATA = path.join(HERE, 'data');
const LAB6_CIF = fs.readFileSync(path.join(HERE, '..', 'engine', 'xrd-rv.js'), 'utf8').match(/const LAB6_CIF = `([^`]*)`/)[1];
const { D2R, R2D, K_SCHERRER, BODIES, quatMat, quatMul, quatOfRot, quatOfMat, bodyFrame, evaluate, FS } = ENG;

/* ---------- the instrument, the grid, the sample's state ---------- */
// A PANalytical-like Bragg–Brentano: Cu Kα1/Kα2 (0.5), R 240 mm, Sollers 0.04 rad on both
// sides, a 12 mm focus: the Soller model of §3.7.1, as the user's files give it.
export const INSTR = { lam1: 1.540598, lam2: 1.544426, ratio: 0.5, radius: 240, soller: { incident: 0.04, diffracted: 0.04 }, focusLength: 12, monochromator: false };
// The samples' grid: the fixtures' (10–80°, 5384 points, 0.0130°).
export const GRID = { lo: 10, hi: 80, n: 5384 };
// The standard's truth (LaB6, drawn and refined as the app refines a standard).
export const STD_TRUTH = { U: 0.0020, V: -0.0012, W: 0.0010, X: 0.010, Y: 0.018, axL: 30.7, transp: -0.0171, zero: 0.008, disp: 0 };
// A sample's state besides its solid: the user's SrTiO₃ as RIETVELD.md has it (a 3.916 Å,
// Sr site 0.63–0.74, one ΔB 0.02–0.38 Å², strongest line ~1100 counts on ~200).
export const SAMPLE = { a: 3.916, dB: 0.2, occ: 0.70, Xs: 0.02, disp: 0.02, peak: 1100, bg: { bg0: 200, bg1: -15, bg2: 6, bgInv: 400 } };
// The phase's options as the card sends them with Crystallite size: free shape, one ΔB,
// Site occupancy Sr1 (the backlog's prototype: "the box and the Sr site refined").
const STO_OPTS = { size: true, profile: 'lorentz', strain: 'iso', faults: null, adp: 'overall', po: null, occ: ['Sr1'] };

const memo = new Map();
const once = (k, f) => memo.has(k) ? memo.get(k) : (memo.set(k, f()), memo.get(k));
export const stoPrep = () => once('sto', ()=> prepPhase(fs.readFileSync(CIF_PATH, 'utf8'), 'SrTiO3.cif'));
const lab6Prep = () => once('lab6', ()=> prepPhase(LAB6_CIF, 'LaB6 (NIST SRM 660c)'));
const phaseOf = (prep, id, o) => ({ id, name: prep.name, cell: prep.cell, constraint: prep.constraint, ops: prep.ops, atoms: prep.atoms, mass: prep.mass, color: '#888', ...o });

/* ---------- random numbers ---------- */
export function rng(seed){
  let s = seed >>> 0;
  const u = ()=> { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0)/4294967296; };
  const n = ()=> Math.sqrt(-2*Math.log(u() || 1e-300))*Math.cos(2*Math.PI*u());
  return { u, n };
}
const hash = s => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
function lgamma(x){
  const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  x -= 1; let a = c[0]; const t = x + g + 0.5;
  for (let i = 1; i < 9; i++) a += c[i]/(x + i);
  return 0.5*Math.log(2*Math.PI) + (x + 0.5)*Math.log(t) - t + Math.log(a);
}
// Poisson deviates: by products below 30, Hörmann's PTRS (1993) above.
export function poisson(lam, U){
  if (!(lam > 0)) return 0;
  if (lam < 30){ const L = Math.exp(-lam); let k = 0, p = 1; do { k++; p *= U(); } while (p > L); return k - 1; }
  const sl = Math.sqrt(lam), ll = Math.log(lam), b = 0.931 + 2.53*sl, a = -0.059 + 0.02483*b, ia = 1.1239 + 1.1328/(b - 3.4), vr = 0.9277 - 3.6224/(b - 2);
  for (;;){
    const u = U() - 0.5, v = U(), us = 0.5 - Math.abs(u), k = Math.floor((2*a/us + b)*u + lam + 0.43);
    if (us >= 0.07 && v <= vr) return k;
    if (k < 0 || (us < 0.013 && v > us)) continue;
    if (Math.log(v) + Math.log(ia) - Math.log(a/(us*us) + b) <= -lam + k*ll - lgamma(k + 1)) return k;
  }
}

/* ---------- frames, widths, solids ---------- */
const unit = v => { const n = Math.hypot(...v); return v.map(t=> t/n); };
const dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
const cross = (a, b) => [a[1]*b[2] - a[2]*b[1], a[2]*b[0] - a[0]*b[2], a[0]*b[1] - a[1]*b[0]];
const rotAbout = (n, deg) => { const [x, y, z] = unit(n), c = Math.cos(deg*D2R), s = Math.sin(deg*D2R), C = 1 - c;
  return [c + x*x*C, x*y*C - z*s, x*z*C + y*s, y*x*C + z*s, c + y*y*C, y*z*C - x*s, z*x*C - y*s, z*y*C + x*s, c + z*z*C]; };
const mv = (M, v) => [M[0]*v[0] + M[1]*v[1] + M[2]*v[2], M[3]*v[0] + M[4]*v[1] + M[5]*v[2], M[6]*v[0] + M[7]*v[1] + M[8]*v[2]];
const cols = R => [[R[0], R[3], R[6]], [R[1], R[4], R[7]], [R[2], R[5], R[8]]];
const fromCols = ([x, y, z]) => [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]];
/* The truth's frame (row-major, its columns the body axes x, y, z in the crystal's
   Cartesian frame; on a cubic cell a lattice direction [uvw] is that vector). */
export function frameOf(f){
  if (f.random != null){ const r = rng(0xabc000 + f.random); return quatMat(unit([r.n(), r.n(), r.n(), r.n()])); }
  const z = unit(f.z), x0 = unit(f.x);
  if (Math.abs(dot(z, x0)) > 1e-9) throw new Error('frame: x not normal to z');
  const t = f.turn || 0, x = unit(mv(rotAbout(z, t), x0)), y = cross(z, x);
  let R = fromCols([x, y, z]);
  if (f.tilt){ const T = rotAbout(f.tilt.about, f.tilt.deg); R = fromCols(cols(R).map(c=> mv(T, c))); }
  return R;
}
// A dimension (nm) and a sphere-equivalent width (°): D = Kλ/(W·π/180).
export const widthOf = D => K_SCHERRER*INSTR.lam1/(D*10)*R2D;
export const dimOf = W => W > 0 ? K_SCHERRER*INSTR.lam1/(W*D2R)/10 : Infinity;
// The body's W parameters from its widths along x, y, z.
const Wparams = (type, w) => BODIES[type].W.length === 2 ? [w[0], w[2]] : w;
// A solid { type, dims [x, y, z] nm, axes [x, y, z] } from the shape's parameters: v the
// whole vector (q's indices), or a refine log's `to` ([...iW, ...iR, ...iQ]).
export function solidOf(q, type, v, packed = false){
  const B = BODIES[type];
  let W, R;
  if (packed){
    const nW = q.iW.length, nR = q.iR.length, W0 = v.slice(0, nW), r = [0, 1, 2].map(i=> i < nR ? v[nW + i] : 0), Q = v.slice(nW + nR, nW + nR + 4);
    W = W0; R = quatMat(quatMul(Q, quatOfRot(r)));
  } else { W = q.iW.map(i=> v[i]); R = bodyFrame(q, v); }
  const w = B.axes(W);
  return { type, W, dims: w.map(dimOf), axes: cols(R) };
}

/* ---------- comparing solids, modulo the crystal's and the body's symmetry ---------- */
// The cubic Laue group's proper rotations (24): every solid's column lengths are
// centrosymmetric, so these with the axes taken without sign cover m-3m. (All cases here
// are cubic; another lattice wants its own rotations in Cartesian form.)
export const CUBIC = (()=> {
  const out = [], P = [[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]];
  for (const p of P) for (let s = 0; s < 8; s++){
    const M = new Array(9).fill(0), sg = [s & 1 ? -1 : 1, s & 2 ? -1 : 1, s & 4 ? -1 : 1];
    p.forEach((j, i)=> { M[3*i + j] = sg[i]; });
    const det = M[0]*(M[4]*M[8] - M[5]*M[7]) - M[1]*(M[3]*M[8] - M[5]*M[6]) + M[2]*(M[3]*M[7] - M[4]*M[6]);
    if (det > 0) out.push(M);
  }
  return out;
})();
const angAx = (a, b) => Math.acos(Math.min(1, Math.abs(dot(unit(a), unit(b)))))*R2D;
// Axis classes of each body: the axes a turn of the base body permutes ('perm'), and
// whether a tie among them leaves their directions undefined (ball, round section) or
// only permuted (cube, ellipse's ±).
const CLASSES = { box: [[0, 1, 2]], sqbox: [[0, 1, 2]], ellipsoid: [[0, 1, 2]], spheroid: [[0, 1, 2]], cylinder: [[0, 1], [2]], ellcyl: [[0, 1], [2]] };
const CONT = { box: false, sqbox: false, ellipsoid: true, spheroid: true, cylinder: true, ellcyl: true };
const TIE = 0.04;
const perms = a => a.length <= 1 ? [a] : a.flatMap((x, i)=> perms([...a.slice(0, i), ...a.slice(i + 1)]).map(p=> [x, ...p]));
/* compareSolids(fit, ref) → { dimErr [rel, per paired axis, ref's order], dimMax, orient
   (° the worst defined axis after the best crystal rotation), principal (° the ref's most
   distinct axis), pairs }. Within a class the axes are paired by size; axes the ref ties
   (within 4 %) are tried in every order (a cube's) or left out of the orientation (a
   ball's, a round section's). */
export function compareSolids(fit, ref, { loose = false } = {}){
  // loose: the three extents compared whatever axis class they belong to (an elliptic
  // cylinder whose axis lies along the truth's thin extent instead of its long one)
  const type = ref.type, cls = loose ? [[0, 1, 2]] : CLASSES[type];
  const lg = d => Math.log(Number.isFinite(d) ? d : 1e4);
  const pairsets = [[]];
  const undefinedAx = new Set();
  for (const c of cls){
    const rs = [...c].sort((a, b)=> ref.dims[a] - ref.dims[b]), fs = [...c].sort((a, b)=> fit.dims[a] - fit.dims[b]);
    // groups of tied ref axes (in sorted order)
    const groups = []; for (const i of rs){ const g = groups[groups.length - 1]; if (g && Math.abs(lg(ref.dims[i]) - lg(ref.dims[g[g.length - 1]])) < TIE) g.push(i); else groups.push([i]); }
    if (type === 'cylinder' && c.length === 2) c.forEach(i=> undefinedAx.add(i));
    let pos = 0; const opts = [[]];
    for (const g of groups){
      const fpart = fs.slice(pos, pos + g.length); pos += g.length;
      if (g.length > 1 && CONT[type]) g.forEach(i=> undefinedAx.add(i));
      const ps = g.length > 1 && !CONT[type] ? perms(fpart) : [fpart];
      const next = []; for (const o of opts) for (const p of ps) next.push([...o, ...g.map((ri, j)=> [ri, p[j]])]);
      opts.splice(0, opts.length, ...next);
    }
    const nxt = []; for (const ps of pairsets) for (const o of opts) nxt.push([...ps, ...o]);
    pairsets.splice(0, pairsets.length, ...nxt);
  }
  // the ref's most distinct axis (a plate's normal, a needle's axis)
  const gap = i => Math.min(...[0, 1, 2].filter(j=> j !== i).map(j=> Math.abs(lg(ref.dims[i]) - lg(ref.dims[j]))));
  const prin = [0, 1, 2].filter(i=> !undefinedAx.has(i)).sort((a, b)=> gap(b) - gap(a))[0];
  let best = null;
  for (const pairs of pairsets){
    let orient = Infinity, principal = Infinity;
    for (const G of CUBIC){
      let worst = 0, pa = Infinity;
      for (const [ri, fi] of pairs){
        if (undefinedAx.has(ri)) continue;
        const a = angAx(fit.axes[fi], mv(G, ref.axes[ri]));
        worst = Math.max(worst, a);
        if (ri === prin) pa = a;
      }
      orient = Math.min(orient, worst); principal = Math.min(principal, pa);
    }
    const dimErr = pairs.map(([ri, fi])=> fit.dims[fi]/ref.dims[ri] - 1);
    const dimMax = Math.max(...dimErr.map(Math.abs));
    const score = orient + 100*dimMax;
    if (!best || score < best.score) best = { score, orient, principal, dimErr: [0, 1, 2].map(ri=> dimErr[pairs.findIndex(p=> p[0] === ri)]), dimMax, pairs };
  }
  if (!Number.isFinite(best.principal)) best.principal = null;
  if (!Number.isFinite(best.orient) || undefinedAx.size === 3) best.orient = null;
  return best;
}

/* ---------- the standard and the patterns ---------- */
const gridX = (lo, hi, n) => Array.from({ length: n }, (_, i)=> lo + (hi - lo)*i/(n - 1));
const vecWith = (model, P) => { const v = model.v.slice(); for (const k in P){ const i = model.index[k]; if (i == null) throw new Error('no parameter ' + k); v[i] = P[k]; } return v; };
// The standard: LaB6 drawn with STD_TRUTH on 10–120° (0.013°, peak 15 000 counts on 150),
// Poisson noise, refined as the app refines a standard (autoRefine standard: true, one
// ΔB), its profile taken as irfOf takes it. Cached in data/irf.json.
export function standardIrf(){
  return once('irf', ()=> {
    const f = path.join(DATA, 'irf.json');
    if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
    const prep = lab6Prep(), ph = phaseOf(prep, 0, { size: true, shape: false, profile: 'lorentz', strain: 'iso', faults: null, adp: 'overall', po: null, occ: null });
    const x = gridX(10, 120, 8463);
    const m0 = buildModel({ x, y: x.map(()=> 1), instr: INSTR, phases: [ph] });
    const P = { ...STD_TRUTH, 'p0.scale': 1, 'p0.B': 0, bg0: 150, bg1: -20, bgInv: 300 };
    setParams(m0, vecWith(m0, P));
    const c1 = calc(m0, null, { internal: true });
    const S = 15000/Math.max(...c1.perPhase[0]);
    setParams(m0, vecWith(m0, { ...P, 'p0.scale': S }));
    const yc = calc(m0, null, { internal: true }).yc, r = rng(hash('LaB6'));
    const y = Array.from(yc, l=> poisson(l, r.u));
    const m = buildModel({ x, y, instr: INSTR, phases: [ph] });
    const t0 = Date.now(), res = autoRefine(m, { standard: true });
    const p = res.params;
    const irf = { U: p.U, V: p.V, W: p.W, X: p.X, Y: p.Y, asym: p.asym || 0, zero: p.zero, transp: p.transp, axL: p.axL, axP1: INSTR.soller.incident, axP2: INSTR.soller.diffracted,
      lam1: INSTR.lam1, radius: INSTR.radius, _chi2nu: res.stats.chi2, _Rwp: res.stats.Rwp, _ms: Date.now() - t0, _truth: STD_TRUTH };
    fs.mkdirSync(DATA, { recursive: true }); fs.writeFileSync(f, JSON.stringify(irf, null, 1));
    return irf;
  });
}
// The fixtures' standard: s11.xrdml refined as the standard with SrTiO3 (its file has no
// Sollers: FCJ). Cached in data/irf-fx.json.
function fixtureIrf(){
  return once('irf-fx', ()=> {
    const f = path.join(DATA, 'irf-fx.json');
    if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
    const pat = readFixture('s11.xrdml'), prep = stoPrep();
    const ph = phaseOf(prep, 1, { size: true, shape: false, profile: 'lorentz', strain: 'iso', faults: null, adp: 'overall', po: null, occ: null });
    const m = buildModel({ x: pat.x, y: pat.y, varMul: pat.varMul, instr: pat.instr, phases: [ph] });
    const res = autoRefine(m, { standard: true }), p = res.params, ins = pat.instr || {};
    const irf = { U: p.U, V: p.V, W: p.W, X: p.X, Y: p.Y, asym: p.asym || 0, zero: p.zero, transp: p.transp, ...(Number.isFinite(ins.lam1) ? { lam1: ins.lam1 } : {}), ...(Number.isFinite(ins.radius) ? { radius: ins.radius } : {}), _chi2nu: res.stats.chi2 };
    fs.mkdirSync(DATA, { recursive: true }); fs.writeFileSync(f, JSON.stringify(irf, null, 1));
    return irf;
  });
}
function readFixture(name){
  const u8 = new Uint8Array(fs.readFileSync(path.join(FIX_DIR, name)));
  const sc = readXrdmlScanText(u8), instr = readXrdmlInstrumentText(u8, 0);
  return { x: Array.from(sc.x), y: Array.from(sc.y), varMul: sc.varMul ? Array.from(sc.varMul) : null, instr };
}
/* The truth of a synthetic case: its parameters by name, the solid, the phase as built. */
export function truthOf(c){
  const prep = stoPrep(), sphere = c.type === 'sphere';
  const ph = phaseOf(prep, 1, { ...STO_OPTS, shape: sphere ? false : c.type });
  // The instrument as the refined standard gives it (what autoRefine holds on a sample): the
  // errors measured are the search's and the noise's, not the standard's.
  const I = standardIrf();
  const P = { U: I.U, V: I.V, W: I.W, X: I.X, Y: I.Y, axL: I.axL, transp: I.transp, zero: I.zero,
    disp: SAMPLE.disp, 'p1.a': SAMPLE.a, 'p1.B': c.dB ?? SAMPLE.dB, 'p1.occ_Sr1': c.occ ?? SAMPLE.occ, 'p1.Xs': SAMPLE.Xs, ...SAMPLE.bg };
  let solid = null;
  if (sphere) P['p1.Ys'] = widthOf(c.D);
  else {
    const B = BODIES[c.type], w = c.dims.map(widthOf), R = frameOf(c.frame);
    Wparams(c.type, w).forEach((t, i)=> { P['p1.' + B.W[i]] = t; });
    quatOfMat(R).forEach((t, i)=> { P['p1.Q' + i] = t; });
    solid = { type: c.type, W: Wparams(c.type, w), dims: [...c.dims], axes: cols(R) };
  }
  return { P, ph, solid };
}
// A synthetic pattern: the truth drawn on GRID, scaled to SAMPLE.peak counts at the
// strongest line, a hump added for the sample-like cases, Poisson noise (seeded by the
// case's id and the seed).
export function patternOf(c, seed){
  if (c.kind === 'fixture') return { ...readFixture(c.file), irf: fixtureIrf() };
  const { P, ph, solid } = truthOf(c);
  const x = gridX(GRID.lo, GRID.hi, GRID.n);
  const m = buildModel({ x, y: x.map(()=> 1), instr: INSTR, phases: [ph] });
  setParams(m, vecWith(m, { ...P, 'p1.scale': 1 }));
  const c1 = calc(m, null, { internal: true }), net = c1.perPhase[0];
  const S = SAMPLE.peak/Math.max(...net);
  setParams(m, vecWith(m, { ...P, 'p1.scale': S }));
  const yc = Float64Array.from(calc(m, null, { internal: true }).yc);
  if (c.hump){
    // its area a share of (110)'s: the phase's counts over 29.5–35.5° (the line and its tails)
    const step = (GRID.hi - GRID.lo)/(GRID.n - 1);
    let a110 = 0; x.forEach((t, i)=> { if (t >= 29.5 && t <= 35.5) a110 += S*net[i]*step; });
    const A = c.hump.share*a110, hw = c.hump.fwhm/2, eta = 0.5;
    const hL = A/(Math.PI*hw), hG = A*Math.sqrt(Math.LN2/Math.PI)/hw;
    x.forEach((t, i)=> { const d = (t - c.hump.pos)/hw; yc[i] += eta*hL/(1 + d*d) + (1 - eta)*hG*Math.exp(-Math.LN2*d*d); });
  }
  const r = rng(hash(c.id) ^ Math.imul(seed + 1, 0x9E3779B1));
  const y = Array.from(yc, l=> poisson(l, r.u));
  return { x, y, varMul: null, instr: INSTR, irf: standardIrf(), truth: { P: { ...P, 'p1.scale': S }, solid } };
}

/* ---------- running methods on a case ---------- */
const STOP = { stop: true };
export async function loadMethod(file){
  const mod = await import(pathToFileURL(path.resolve(file)).href);
  const m = mod.default || mod;
  if (typeof m.search !== 'function') throw new Error(file + ': no search(model, k, res, free, opts, ENG, ctx)');
  return { name: m.name || path.basename(file, '.mjs'), file, ...m };
}
/* runCase({ id, seed, methods: [loaded], shape?, fit?, log? }) → { case, seed, shape,
   iso: { evals, ms, chi2, chi2nu, N, P }, records: [one per method] }.
   The pattern is refined from the CIF by autoRefine with the standard's profile, up to the
   shape search; there each method runs in turn from the same isotropic fit (model.v reset
   between them), and autoRefine is stopped (nothing after the search is timed). A method
   is { name, search(model, k, res, free, opts, ENG, ctx) } returning what freeShape
   returns ({ res, info } with model.v at the kept solid, { rejected, dBIC, early } with
   model.v at the isotropic fit, or null). ctx: { case, seed, shape, iso, truth (for
   reference methods only: a search must not read it), rng }. */
export function runCase({ id, seed, methods, shape = null, fit = {}, log = true }){
  const c = caseById(id);
  const type = shape || c.run || c.type;
  const pat = patternOf(c, seed);
  const ph = phaseOf(stoPrep(), 1, { ...STO_OPTS, shape: type });
  const model = buildModel({ x: pat.x, y: pat.y, varMul: pat.varMul, instr: pat.instr, phases: [ph] });
  const truth = pat.truth && pat.truth.solid && pat.truth.solid.type === type ? pat.truth : pat.truth ? { ...pat.truth, solid: null, other: pat.truth.solid } : null;
  const out = { case: id, kind: c.kind, seed, shape: type, truthType: c.type, truth: truth && truth.solid || null, iso: null, records: [], irf: { chi2nu: pat.irf._chi2nu } };
  const t0 = Date.now(), e0 = FS.evals;
  const hook = (model, k, res, free, opts) => {
    const q = model.phases[k];
    out.iso = { evals: FS.evals - e0, ms: Date.now() - t0, chi2: res.stats.chi2*Math.max(1, res.stats.N - res.stats.P), chi2nu: res.stats.chi2, N: res.stats.N, P: res.stats.P, Ys: model.v[q.iYs], free: [...free] };
    const vIso = model.v.slice();
    for (const m of methods){
      setParams(model, vIso); model.shapeSoft = null;
      FS.log = log ? [] : null; FS.k = k;
      const ctx = { case: c, seed, shape: type, iso: out.iso, truth: m.reference ? truth : null, rng: rng(hash(m.name) ^ seed) };
      const ev0 = FS.evals, tm = Date.now(); FS.t0 = tm;
      let r = null, err = null;
      try { r = m.search(model, k, res, free, opts, ENG, ctx); } catch(e){ err = String(e && e.stack || e); }
      const ms = Date.now() - tm, evals = FS.evals - ev0, lg = FS.log || []; FS.log = null; model.shapeSoft = null;
      out.records.push(summarise({ m, r, err, ms, evals, lg, model, q, type, truth, iso: out.iso }));
    }
    setParams(model, vIso);
    throw STOP;
  };
  try { autoRefine(model, { standard: false, irf: pat.irf, fit, shapeHook: hook }); }
  catch(e){ if (e !== STOP) throw e; }
  if (!out.iso) out.error = 'the shape search was not reached (the phase left out, or no standard profile)';
  return out;
}
function summarise({ m, r, err, ms, evals, lg, model, q, type, truth, iso }){
  const st = evaluate(model, model.v), base = BODIES[type].base;
  const kept = !!(r && r.res), P = kept ? r.res.stats.P : iso.P, N = iso.N;
  const rec = { method: m.name, ms, evals, refines: lg.length, iterations: lg.reduce((t, e)=> t + (e.iterations || 0), 0), error: err,
    kept, rejected: !!(r && r.rejected), early: !!(r && r.early), dBIC: r ? (r.info ? null : r.dBIC) : null,
    held: !!(r && r.info && r.info.held), info: r && r.info ? { ...r.info, freeW: undefined } : null,
    chi2: st.chi2, chi2nu: st.chi2/Math.max(1, N - P), P };
  if (r && r.info && Number.isFinite(r.info.chi2)) rec.dBIC = (r.info.chi2 - r.info.chi2Iso)/Math.max(1, r.info.chi2redIso) + (r.info.P - r.info.Piso)*Math.log(r.info.N);
  // The solid reported (kept), and the best free orientation the method's refinements
  // reached with the exact solid (the free fit, which a held result hides); a refinement
  // with rounded faces does not count, an ellipsoid's or spheroid's ball has none.
  if (kept) rec.solid = solidOf(q, type, model.v);
  const exact = e => !e.error && Number.isFinite(e.chi2) && (!e.soft || base === 'ball');
  const free = lg.filter(e=> exact(e) && e.rotFree).sort((a, b)=> a.chi2 - b.chi2)[0];
  const held = lg.filter(e=> exact(e) && !e.rotFree).sort((a, b)=> a.chi2 - b.chi2)[0];
  const anyBest = lg.filter(e=> !e.error && Number.isFinite(e.chi2)).sort((a, b)=> a.chi2 - b.chi2)[0];
  if (free){ rec.chi2Free = free.chi2; rec.chi2nuFree = free.chi2nu; rec.freeSolid = solidOf(q, type, free.to, true); }
  if (held) rec.chi2Held = held.chi2;
  if (anyBest) rec.chi2Any = anyBest.chi2;
  // the lowest χ² of the exact solid the method reached, free or held (the free model's
  // minimum is at most either): what "reached" is judged on
  const ex = [rec.chi2Free, rec.chi2Held].filter(Number.isFinite);
  if (ex.length) rec.chi2Best = Math.min(...ex);
  if (truth && truth.solid){
    if (rec.solid){ rec.acc = compareSolids(rec.solid, truth.solid); rec.accLoose = compareSolids(rec.solid, truth.solid, { loose: true }); }
    if (rec.freeSolid) rec.accFree = compareSolids(rec.freeSolid, truth.solid);
  }
  // The search's refinements: each start's end and the χ² path (evaluations so far, χ²).
  rec.log = lg.map(e=> ({ mi: e.maxIter, it: e.iterations, ev: e.evals, ms: e.ms, c: e.chi2, soft: e.soft, rot: e.rotFree, nf: e.nFree, at: e.evalsAt, t: e.tAt, err: e.error,
    to: e.to && solidOf(q, type, e.to, true), from: e.from && solidOf(q, type, e.from, true) }));
  return rec;
}

/* ---------- grouping ends into morphologies ---------- */
/* sameSolid(a, b, { deg = 8, ratio = Math.exp(0.25) - 1 }): two solids of one type are
   one morphology when, modulo symmetry, their worst defined axis is within deg and every
   dimension within the ratio (the backlog's grouping, step 7: 8°, e^0.25). */
export function sameSolid(a, b, { deg = 8, ratio = Math.exp(0.25) - 1 } = {}){
  const s = compareSolids(a, b);
  return (s.orient == null || s.orient <= deg) && s.dimErr.every(e=> Number.isFinite(e) ? Math.abs(e) <= ratio : true);
}
/* basins(record, { exactOnly, deg, ratio }) → [{ chi2, solid, n }] the record's refine()
   ends grouped greedily from the lowest χ² (each end joins the first group it matches). */
export function basins(rec, { exactOnly = false, deg, ratio } = {}){
  const ends = (rec.log || []).filter(e=> e.to && Number.isFinite(e.c) && (!exactOnly || !e.soft)).sort((x, y)=> x.c - y.c);
  const out = [];
  for (const e of ends){
    const g = out.find(g=> sameSolid(e.to, g.solid, { deg, ratio }));
    if (g) g.n++; else out.push({ chi2: e.c, solid: e.to, n: 1, soft: e.soft, rot: e.rot });
  }
  return out;
}
// JSON writes an unbounded dimension (Infinity) as null: read results back with this.
export const readResult = text => JSON.parse(text, (k, v)=> k === 'dims' && Array.isArray(v) ? v.map(d=> d == null ? Infinity : d) : v);
