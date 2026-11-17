/* The round-2 generator: one powder pattern from one truth (one row of the design).
   The phase is drawn by the engine (gen/eng: the frozen b9bef5f engine with one hook,
   make-eng.mjs) at the truth's parameters with its Lorentzian size widths, and to every
   line that carries a size width the hook adds the difference between the exact size line
   and that Lorentzian, convolved with the rest of the line (instrument and microstrain,
   the line's own Kα1/Kα2 and axial nodes):
     line = engine's pV(H(HG, HL_rest + Γ)) + I·F⁻¹[ pV_rest(L) · (A(L) − e^{−πΓL}) · Σ_k w_k e^{−2πiLδ_k} ]
   in d* = 2 sinθ/λ (the size line is symmetric there), read at each 2θ through the exact
   map (xrd-broad wppmLine, the engine's own WPPM synthesis). Γ = 0.675/⟨L⟩_V (Å⁻¹) is the
   engine's size FWHM in d*; A(L) the solid's own common-volume function along the member
   (kernels.mjs). With A(L) = e^{−πΓL} the difference vanishes and the pattern is the
   engine's: the only difference from the engine's calc is the size line's shape.
   Then: the scale (strongest point of the phase = counts), the background (Chebyshev +
   1/2θ, the model's own family, at the row's peak to background), the row's model error,
   Poisson noise from the row's seed. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildModel, calc, autoRefine, setParams, addPeak, ENG } from './eng/xrd-rietveld.js';
import { prepPhase } from './eng/xrd-rv-model.js';
import { wppmLine } from './eng/xrd-broad.js';
import { body, kernel, flatR } from './kernels.mjs';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(HERE, 'data');
const { D2R, R2D, K_SCHERRER, BODIES, quatOfMat, tch, profileAtTheta } = ENG;

/* ---------- the instrument (fixed) and the grid ----------
   A high-resolution lab Bragg–Brentano: Cu Kα1 + Kα2 (ratio 0.5), R 240 mm, Sollers of
   0.02 rad on both sides (the narrow set such instruments offer; round 1 had 0.04), a
   12 mm line focus, sample and receiver 15 mm long axially. Caglioti U 0.0012, V −0.0008,
   W 0.0006 °², X 0.006, Y 0.012 °: LaB6 lines 0.030° FWHM at 20–40°, 0.045° at 90°, 0.09°
   at 130° — a fine-slit diffractometer with a strip detector, about 0.01–0.03° narrower
   than round 1's. The samples' narrowest size lines (a 60 nm extent, the design's largest,
   along the diffraction vector) are 0.10°/cosθ wide: three times the instrument's at low
   angles, so the size dominates every line, and the step (0.01°) gives each 12 points a
   FWHM or more. */
export const INSTR = { lam1: 1.540598, lam2: 1.544426, ratio: 0.5, radius: 240, soller: { incident: 0.02, diffracted: 0.02 }, focusLength: 12, monochromator: false };
export const STD_TRUTH = { U: 0.0012, V: -0.0008, W: 0.0006, X: 0.006, Y: 0.012, axL: 15, transp: -0.0171, zero: 0.008, disp: 0 };
// The grid round 2 draws on: the pilot's decision (research/free-shape/round2/PILOT.md,
// 10–110° in 0.01°), the default of every caller (gen/draw.mjs, harness/run.mjs --draw,
// pilot/run.mjs). The standard keeps the 10–130° it was drawn and refined on (STD_GRID).
export const GRID = { lo: 10, hi: 110, step: 0.01 };
export const STD_GRID = { lo: 10, hi: 130, step: 0.01 };
export const gridX = (g = GRID) => { const n = Math.round((g.hi - g.lo)/g.step) + 1; return Array.from({ length: n }, (_, i)=> +(g.lo + i*g.step).toFixed(6)); };
const LAM1 = INSTR.lam1;

/* ---------- random numbers (round 1's) ---------- */
export function rng(seed){
  let s = seed >>> 0;
  const u = ()=> { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0)/4294967296; };
  const n = ()=> Math.sqrt(-2*Math.log(u() || 1e-300))*Math.cos(2*Math.PI*u());
  return { u, n };
}
export const hash = s => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
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

/* ---------- phases ---------- */
const memo = new Map();
const once = (k, f) => memo.has(k) ? memo.get(k) : (memo.set(k, f()), memo.get(k));
export const phasePrep = file => once('cif:' + path.resolve(file), ()=> prepPhase(fs.readFileSync(file, 'utf8'), path.basename(file)));
const LAB6_CIF = fs.readFileSync(path.join(HERE, '..', 'engine', 'xrd-rv.js'), 'utf8').match(/const LAB6_CIF = `([^`]*)`/)[1];
const phaseOf = (prep, o) => ({ id: 1, name: prep.name, cell: prep.cell, constraint: prep.constraint, ops: prep.ops, atoms: prep.atoms, mass: prep.mass, color: '#888',
  size: true, shape: false, profile: 'lorentz', strain: 'iso', faults: null, adp: 'overall', po: null, occ: null, ...o });
/* The phase's frame (the engine's Cartesian frame, memberVectors): Bm row-major (a
   reflection hkl is Bm·h), and the direct cell's vectors in it (a lattice direction [uvw]
   is Am·uvw). For the design's "on the lattice" frames. */
export function phaseFrame(file){
  const prep = phasePrep(cifPath(file)), x = Array.from({ length: 16 }, (_, i)=> 20 + i/16);
  const m = buildModel({ x, y: x.map(()=> 1), instr: INSTR, phases: [phaseOf(prep, { shape: 'box' })] }), B = m.phases[0].Bm;
  const det = B[0]*B[4]*B[8], A = [1/B[0], -B[1]/(B[0]*B[4]), (B[1]*B[5] - B[2]*B[4])/det, 0, 1/B[4], -B[5]/(B[4]*B[8]), 0, 0, 1/B[8]];
  // A = (B⁻¹)ᵀ: Am's columns are a, b, c
  const Am = [A[0], A[3], A[6], A[1], A[4], A[7], A[2], A[5], A[8]];
  return { cell: prep.cell, Bm: B, Am, laue: m.phases[0].laue };
}

/* ---------- the standard (as round 1, with this instrument) ----------
   LaB6 (the card's built-in CIF, xrd-rv.js) drawn with STD_TRUTH on the grid, 15 000 counts
   at its strongest line on 150, Poisson noise, refined by autoRefine({ standard: true })
   with one ΔB; its profile taken as irfOf takes it. Cached in data/irf.json. */
export function standardIrf(){
  return once('irf', ()=> {
    const f = path.join(DATA, 'irf.json');
    if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
    const prep = prepPhase(LAB6_CIF, 'LaB6 (NIST SRM 660c)'), ph = { ...phaseOf(prep, {}), id: 0 };
    const x = gridX(STD_GRID);
    const m0 = buildModel({ x, y: x.map(()=> 1), instr: INSTR, phases: [ph] });
    const P = { ...STD_TRUTH, 'p0.scale': 1, 'p0.B': 0, bg0: 150, bg1: -20, bgInv: 300 };
    setParams(m0, vecWith(m0, P));
    const c1 = calc(m0, null, { internal: true });
    const S = 15000/Math.max(...c1.perPhase[0]);
    setParams(m0, vecWith(m0, { ...P, 'p0.scale': S }));
    const yc = calc(m0, null, { internal: true }).yc, r = rng(hash('LaB6-fs2'));
    const y = Array.from(yc, l=> poisson(l, r.u));
    const m = buildModel({ x, y, instr: INSTR, phases: [ph] });
    const t0 = Date.now(), res = autoRefine(m, { standard: true });
    const p = res.params;
    const irf = { U: p.U, V: p.V, W: p.W, X: p.X, Y: p.Y, asym: p.asym || 0, zero: p.zero, transp: p.transp, axL: p.axL, axP1: INSTR.soller.incident, axP2: INSTR.soller.diffracted,
      lam1: INSTR.lam1, radius: INSTR.radius, _chi2nu: res.stats.chi2, _Rwp: res.stats.Rwp, _ms: Date.now() - t0, _truth: STD_TRUTH, _grid: STD_GRID, _counts: 15000 };
    fs.mkdirSync(DATA, { recursive: true }); fs.writeFileSync(f, JSON.stringify(irf, null, 1));
    return irf;
  });
}
const vecWith = (model, P) => { const v = model.v.slice(); for (const k in P){ const i = model.index[k]; if (i == null) throw new Error('no parameter ' + k); v[i] = P[k]; } return v; };

/* ---------- a row ----------
   { id, solid, dims (nm, along the body's own axes x, y, z; a sphere's D: dims, [D] or D),
   R (3×3 body → Cartesian, nested or row-major flat; the engine's Cartesian frame, see
   phaseFrame), phase (a phase id of ../phases/cif, 'P-1', or a CIF path), counts
   (strongest point of the phase above the background, counts; or peak), pb (peak to
   background there; or p2b), eps (microstrain ε as a fraction; or strain in %), error
   ({ kind, strength, …given draws }, null or { kind: 'none' }), seed }. Error kinds: hump,
   sizedist, impurity, air, po (aliases accepted). */
const KIND = { hump: 'hump', amorphous: 'hump', 'amorphous hump': 'hump', sizedist: 'sizedist', 'size distribution': 'sizedist', 'size-distribution': 'sizedist', distribution: 'sizedist',
  impurity: 'impurity', impurities: 'impurity', air: 'air', 'air scatter': 'air', 'air-scatter': 'air', po: 'po', texture: 'po', 'preferred orientation': 'po', 'preferred-orientation': 'po', none: null };
export const PHASES_DIR = path.join(HERE, '..', 'phases', 'cif');
export const cifPath = ph => /\.cif$/i.test(ph) ? path.resolve(ph) : path.join(PHASES_DIR, ph + '.cif');
export function normRow(row){
  const solid = row.solid === 'square-based box' ? 'sqbox' : row.solid === 'elliptic cylinder' ? 'ellcyl' : row.solid;
  let dims = solid === 'sphere' && row.D != null ? [row.D] : typeof row.dims === 'number' ? [row.dims] : row.dims;
  if (!dims) throw new Error(`row ${row.id}: no dims`);
  if (solid === 'sphere') dims = [dims[0], dims[0], dims[0]];
  else if (dims.length === 2) dims = ['sqbox', 'spheroid', 'cylinder'].includes(solid) ? [dims[0], dims[0], dims[1]] : null;
  if (!dims || dims.length !== 3) throw new Error(`row ${row.id}: dims of ${solid}`);
  let R = row.R ? flatR(row.R) : [1, 0, 0, 0, 1, 0, 0, 0, 1];
  const det = R[0]*(R[4]*R[8] - R[5]*R[7]) - R[1]*(R[3]*R[8] - R[5]*R[6]) + R[2]*(R[3]*R[7] - R[4]*R[6]);
  if (Math.abs(Math.abs(det) - 1) > 1e-6) throw new Error(`row ${row.id}: R is not a rotation (det ${det})`);
  // an improper frame: the z axis turned over (every solid is centrosymmetric: the same body)
  if (det < 0) R = [R[0], R[1], -R[2], R[3], R[4], -R[5], R[6], R[7], -R[8]];
  const ek = row.error && row.error.kind != null ? String(row.error.kind).toLowerCase() : null;
  if (ek != null && !(ek in KIND)) throw new Error(`row ${row.id}: error kind ${row.error.kind}`);
  const e = ek && KIND[ek] ? { ...row.error, kind: KIND[ek], strength: +row.error.strength || 0 } : null;
  const eps = row.eps != null ? +row.eps : row.strain != null ? row.strain/100 : 0;
  const counts = +(row.counts ?? row.peak), pb = +(row.pb ?? row.p2b);
  if (!(counts > 0) || !(pb > 0)) throw new Error(`row ${row.id}: counts and pb`);
  return { ...row, solid, dims: dims.map(Number), R, error: e, counts, pb, eps, phase: cifPath(row.phase), seed: row.seed ?? 1 };
}

/* The model errors' draws (PROTOCOL.md's table; strength s ∈ [0, 1], linear). Every area
   is within the pattern, as the strongest line's is measured (its α1 + α2 as drawn on the
   grid): the stated share is the share the data hold.
   - hump: area (5 + 35 s) % of the strongest line's within the range; centre uniform over
     the range's lower half (lo + 5° to its middle), FWHM 3–10° uniform; a pseudo-Voigt,
     η 0.5, scaled to that area over the grid (the tails beyond the range would otherwise
     take up to 14 % of it: a hump at 15° with an 8° FWHM).
   - sizedist: σ = 0.1 + 0.4 s (ln of the solid's scale), volume-weighted, ⟨L⟩_V kept.
   - impurity: 1–3 lines (uniform), each (1 + 9 s) % of the strongest line's area, at
     positions uniform over lo + 2° … hi − 2°, each a Kα1/Kα2 pair with the instrument's
     profile and a 100 nm Lorentzian size, drawn over the whole pattern (no window: the
     engine's addPeak at ±40 FWHM, lowered at its edge, kept 98.5 % of it) and scaled to
     that area over the grid.
   - air: (0.5 + 2.5 s) × the background at the range's start, decaying as e^{−(2θ − lo)/τ},
     τ 2–6° uniform.
   - po: March–Dollase r = 0.95 − 0.25 s, or 1/r (half the draws), on a low-index axis drawn
     uniformly among the phase's distinct families of ⟨100⟩, ⟨110⟩, ⟨111⟩ (the engine's
     lowIndexPlanes set), drawn with the engine's own member weights.
   A field the row gives (centre, fwhm, sigma, lines [{ pos, frac }], k, tau, r, axis)
   is used as given. */
function errorDraws(row, prep, g){
  const e = row.error;
  if (!e) return null;
  const s = Math.min(1, Math.max(0, e.strength)), r = rng(hash(row.id + '|err') ^ Math.imul((row.seed | 0) + 7, 0x85EBCA6B)), U = (a, b)=> a + (b - a)*r.u();
  if (e.kind === 'hump') return { kind: 'hump', strength: s, frac: e.frac ?? 0.05 + 0.35*s, centre: e.centre ?? U(g.lo + 5, (g.lo + g.hi)/2), fwhm: e.fwhm ?? U(3, 10), eta: 0.5 };
  if (e.kind === 'sizedist') return { kind: 'sizedist', strength: s, sigma: e.sigma ?? 0.1 + 0.4*s };
  if (e.kind === 'impurity'){
    const n = e.lines ? e.lines.length : 1 + Math.min(2, Math.floor(3*r.u())), frac = 0.01 + 0.09*s;
    const lines = e.lines || Array.from({ length: n }, ()=> ({ pos: U(g.lo + 2, g.hi - 2), frac }));
    return { kind: 'impurity', strength: s, lines, D: 100 };
  }
  if (e.kind === 'air') return { kind: 'air', strength: s, k: e.k ?? 0.5 + 2.5*s, tau: e.tau ?? U(2, 6) };
  if (e.kind === 'po'){
    const r0 = 0.95 - 0.25*s, needle = r.u() < 0.5, fams = lowIndexFamilies(prep);
    const axis = e.axis || fams[Math.min(fams.length - 1, Math.floor(r.u()*fams.length))];
    return { kind: 'po', strength: s, r: e.r ?? (needle ? 1/r0 : r0), axis, families: fams };
  }
  throw new Error('error kind ' + e.kind);
}
// The distinct Laue families among the seven low-index planes (the engine's lowIndexPlanes
// set; the operations act on indices as memberVectors applies them: h·M, ±).
function lowIndexFamilies(prep){
  const seen = new Set(), out = [];
  for (const h of [[1,0,0],[0,1,0],[0,0,1],[1,1,0],[1,0,1],[0,1,1],[1,1,1]]){
    if (seen.has(h.join())) continue;
    out.push(h);
    for (const { R } of prep.ops) for (const sg of [1, -1]) seen.add([0, 1, 2].map(j=> sg*(h[0]*R[j] + h[1]*R[3 + j] + h[2]*R[6 + j])).join());
  }
  return out;
}

/* The truth's parameters (engine names) besides the scale and the background. */
const widthOf = Dnm => K_SCHERRER*LAM1/(Dnm*10)*R2D;
function truthParams(row, irf, er){
  const P = { U: irf.U, V: irf.V, W: irf.W, X: irf.X, Y: irf.Y, axL: irf.axL, transp: irf.transp, zero: irf.zero, disp: 0, asym: irf.asym || 0,
    'p1.B': 0, 'p1.Xs': 4*row.eps*R2D, 'p1.Ys': 0 };
  let solid;
  if (row.solid === 'sphere'){ P['p1.Ys'] = widthOf(row.dims[0]); solid = { type: 'sphere', dims: [...row.dims], axes: null, W: [P['p1.Ys']] }; }
  else {
    const B = BODIES[row.solid], w = row.dims.map(widthOf), W = B.W.length === 2 ? [w[0], w[2]] : w;
    W.forEach((t, i)=> { P['p1.' + B.W[i]] = t; });
    const Q = quatOfMat(row.R);
    Q.forEach((t, i)=> { P['p1.Q' + i] = t; });
    for (let i = 0; i < B.rot; i++) P['p1.R' + (i + 1)] = 0;
    const R = row.R;
    solid = { type: row.solid, dims: [...row.dims], axes: [[R[0], R[3], R[6]], [R[1], R[4], R[7]], [R[2], R[5], R[8]]], W, Q };
  }
  if (er && er.kind === 'po') P['p1.PO'] = er.r;
  return { P, solid };
}

/* ---------- the exact size lines: the engine's hook ----------
   mode 'exact': the solid's A(L) (its σ for a size distribution); 'lorentz': e^{−0.675πL/⟨L⟩_V}
   with ⟨L⟩_V = 2∫A dL from kernels.mjs (the Lorentzian-limit check: the difference then
   tests the conventions, not the shape); 'sub': draws only the subtracted term
   (rest ⊗ the engine's Lorentzian, by Fourier synthesis) into `into` (the plumbing check). */
/* Each correction is synthesised as the engine synthesises a WPPM line (wppmLine): by FFT
   over a window of ±max(40 FWHM, the line's half-window), lowered by its value at the
   window's edge. Against a direct synthesis with no window and no lowering (the pilot's
   verification, ../pilot/fix/pattern110.mjs, 6 rows on 10–110°), the drawn correction is
   off by at most 5·10⁻⁴ of the peak, 3·10⁻⁴ once the background's family (quadratic +
   1/2θ) is taken out: for the broadest lines (a 3 nm sphere) a smooth offset of 2.6·10⁻⁴,
   which comes from the FFT's period (the folded tails, less the edge value), not from the
   40-FWHM window. `whole` sets the window to hold the whole pattern: it changed the
   correction by under 5·10⁻⁶ of the peak, so it is off by default. */
const wholeWin = (tt, g) => { const t0 = tt*D2R/2, s0 = Math.sin(t0), c = Math.cos(t0)*D2R;
  return Math.max(2*(s0 - Math.sin(g.lo*D2R/2)), 2*(Math.sin(Math.min(179, g.hi)*D2R/2) - s0))/c + 1; };
function makeHook(b, mode, into, g, whole = false){
  const cache = new Map(), grow = b.sigma > 0 ? Math.exp(-3*b.sigma + 0.5*b.sigma*b.sigma) : 1;
  return (out, c) => {
    const key = c.i < 0 ? 'iso' : c.r + ',' + c.i;
    let K = cache.get(key);
    if (!K){ const mv = c.q.mv, n = c.i < 0 || !mv ? [0, 0, 1] : [mv[c.r][3*c.i], mv[c.r][3*c.i + 1], mv[c.r][3*c.i + 2]]; K = kernel(b, n); cache.set(key, K); }
    const gam = c.w*D2R/LAM1;                       // the engine's size FWHM in d* (Å⁻¹): 0.675/⟨L⟩_V
    const pg = Math.PI*gam, lv = Math.PI*0.75*K_SCHERRER/K.Lv;
    let size;
    if (mode === 'sub') size = (a, n, dL)=> { for (let i = 0; i < n; i++) a[i] += Math.exp(-pg*i*dL); };
    else if (mode === 'lorentz') size = (a, n, dL)=> { for (let i = 0; i < n; i++){ const L = i*dL; a[i] += Math.exp(-lv*L) - Math.exp(-pg*L); } };
    else size = (a, n, dL)=> { const A = K.A; for (let i = 0; i < n; i++){ const L = i*dL; a[i] += A(L) - Math.exp(-pg*L); } };
    // the grid's step from the line's narrowest part (a size distribution's largest crystallites)
    const Hmin = grow < 1 ? tch(c.rest.HG, c.rest.HL + c.w*(c.lam/LAM1)/Math.cos(c.th)*grow).H : c.H;
    wppmLine({ x: c.q._x, out: mode === 'sub' ? into : out, tt: c.tt, lam: c.lam, I: c.I, Hi: c.rest.H, etai: c.rest.eta, WL: 0, nodes: c.nodes,
      win: 40, winMin: whole ? Math.max(c.half, wholeWin(c.tt, g)) : c.half, Hest: c.H, Hmin, size });
  };
}

/* drawRow(row, { kernel: 'exact' | 'lorentz' | 'none', grid, noise, irf, whole }) → the pattern
   (whole: the corrections' window over the whole pattern, a comparison only):
   { id, x, y (counts; the expectation without noise: false), yc (expectation), parts
   { phase, bg, error }, instr, irf, truth { P (engine names, scale and background on the
   model's own basis for this grid), solid { type, dims nm, axes (R's columns), W, Q },
   error (its draws) }, info { S, peak2t, peak, bgAtPeak, strongest { hkl, tt, area },
   nRefl, nMembers, ms } }. */
export function drawRow(row0, { kernel: kmode = 'exact', grid = GRID, noise = true, irf = standardIrf(), sub = false, ticks = false, whole = false } = {}){
  const t0 = performance.now(), row = normRow(row0), prep = phasePrep(row.phase), er = errorDraws(row, prep, grid);
  const ph = phaseOf(prep, { shape: row.solid === 'sphere' ? false : row.solid, po: er && er.kind === 'po' ? er.axis : null });
  const x = gridX(grid), n = x.length, step = grid.step;
  const model = buildModel({ x, y: x.map(()=> 1), instr: INSTR, phases: [ph] });
  // every line drawn over the whole pattern (its tails whole): the phase's pattern is then
  // linear in its scale, which is set after
  model.noise0 = 1e-30;
  const q = model.phases[0]; q._x = model.x;
  const { P, solid } = truthParams(row, irf, er);
  setParams(model, vecWith(model, { ...P, 'p1.scale': 1 }));
  const b = body(row.solid, row.dims.map(d=> 10*d), row.R, er && er.kind === 'sizedist' ? er.sigma : 0);
  const subArr = sub ? new Float64Array(n) : null;
  if (kmode !== 'none') model.sizeHook = makeHook(b, sub ? 'sub' : kmode, subArr, grid, whole);
  const c1 = calc(model, null, { internal: true }), net = c1.perPhase[0];
  let iMax = 0; for (let i = 1; i < n; i++) if (net[i] > net[iMax]) iMax = i;
  const S = row.counts/net[iMax], phase = Float64Array.from(net, t=> t*S);
  // the strongest line (largest integrated intensity): its α1 + α2 area as drawn
  const tk = c1.ticks.reduce((a, t)=> !a || t.I > a.I ? t : a, null);
  // (the subtracted term of the plumbing check is drawn once, by the whole pattern's calc)
  if (sub) model.sizeHook = null;
  const only = calc(model, null, { internal: true, only: { k: 0, rs: new Set([tk.r]) } }).perPhase[0];
  let area = 0; for (let i = 0; i < n; i++) area += only[i]*S*step;
  // the background: B·(0.9 − 0.15u + 0.2u²) + 4B·(1°)/2θ, u = (2θ − 70°)/60°, B from pb
  const bgShape = t => { const u = (t - 70)/60; return 0.9 - 0.15*u + 0.2*u*u + 4/t; };
  const B = row.counts/row.pb/bgShape(x[iMax]), bg = Float64Array.from(x, t=> B*bgShape(t));
  // the error
  const err = new Float64Array(n), em = er ? { ...er } : null;
  // (a profile scaled to an area A over the grid, as the strongest line's is measured)
  const toArea = (v, A) => { let t = 0; for (let i = 0; i < n; i++) t += v[i]*step; const k = A/t; for (let i = 0; i < n; i++) v[i] *= k; return t; };
  if (er && er.kind === 'hump'){
    const A = er.frac*area, hw = er.fwhm/2, hL = 1/(Math.PI*hw), hG = Math.sqrt(Math.LN2/Math.PI)/hw;
    for (let i = 0; i < n; i++){ const d = (x[i] - er.centre)/hw; err[i] = er.eta*hL/(1 + d*d) + (1 - er.eta)*hG*Math.exp(-Math.LN2*d*d); }
    em.inRange = toArea(err, A);          // the share of the whole pseudo-Voigt within the range
    em.area = A;
  } else if (er && er.kind === 'impurity'){
    const Yd = widthOf(er.D);
    em.lines = er.lines.map(ln=> {
      const th1 = ln.pos/2*D2R, d = LAM1/(2*Math.sin(th1)), one = new Float64Array(n);
      for (const [lam, w] of [[INSTR.lam1, 1], [INSTR.lam2, INSTR.ratio]]){
        const th = Math.asin(Math.min(1, lam/(2*d))), tt = 2*th*R2D + P.zero + P.transp*Math.sin(2*th), pr = profileAtTheta(th, P.U, P.V, P.W, P.X, P.Y + lam/LAM1*Yd);
        // the window holds the whole pattern: the line's tails whole, its edge value ~10⁻⁷
        addPeak(one, model.x, tt, pr.H, pr.eta, w/(1 + INSTR.ratio), (Math.max(tt - grid.lo, grid.hi - tt) + 1)/pr.H);
      }
      const inRange = toArea(one, ln.frac*area);
      for (let i = 0; i < n; i++) err[i] += one[i];
      return { ...ln, area: ln.frac*area, inRange };
    });
  } else if (er && er.kind === 'air'){
    const a0 = er.k*B*bgShape(grid.lo);
    for (let i = 0; i < n; i++) err[i] = a0*Math.exp(-(x[i] - grid.lo)/er.tau);
    em.at0 = a0; em.bgAt0 = B*bgShape(grid.lo);
  }
  const yc = new Float64Array(n);
  for (let i = 0; i < n; i++) yc[i] = Math.max(0, phase[i] + bg[i] + err[i]);
  const nr = rng(hash(row.id) ^ Math.imul((row.seed | 0) + 1, 0x9E3779B1));
  const y = noise ? Array.from(yc, l=> poisson(l, nr.u)) : Array.from(yc);
  // the background on the model's own basis for this grid (T0, T1, T2 over the grid, 1/2θ)
  const bgP = bgOnBasis(x, bg);
  return {
    id: row.id, x, y, yc, parts: { phase, bg, error: err, sub: subArr ? Float64Array.from(subArr, t=> t*S) : null }, instr: INSTR, irf,
    truth: { P: { ...P, 'p1.scale': S, ...bgP }, solid, error: em, row: row0 },
    info: { S, peak2t: x[iMax], peak: phase[iMax], bgAtPeak: bg[iMax], strongest: { hkl: [tk.h, tk.k, tk.l], tt: tk.tt, area },
      nRefl: c1.ticks.length, nMembers: q.mv ? c1.ticks.reduce((t, k)=> t + q.mv[k.r].length/3, 0) : null, ms: performance.now() - t0, kernel: kmode,
      ...(ticks ? { ticks: c1.ticks } : {}) },
  };
}
// Exact: the background is a quadratic in 2θ plus a 1/2θ term, in the span of T0..T2 and 1/2θ.
function bgOnBasis(x, bg){
  const n = x.length, x0 = x[0], span = x[n - 1] - x0, f = t => { const u = 2*(t - x0)/span - 1; return [1, u, 2*u*u - 1, 1/t]; };
  const M = Array.from({ length: 4 }, ()=> new Float64Array(5));
  for (let i = 0; i < n; i += 7){ const b = f(x[i]); for (let r = 0; r < 4; r++){ for (let c = 0; c < 4; c++) M[r][c] += b[r]*b[c]; M[r][4] += b[r]*bg[i]; } }
  for (let c = 0; c < 4; c++){ let p = c; for (let r = c + 1; r < 4; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r; [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < 4; r++) if (r !== c){ const k = M[r][c]/M[c][c]; for (let j = c; j < 5; j++) M[r][j] -= k*M[c][j]; } }
  const s = M.map((r, i)=> r[4]/r[i]);
  return { bg0: s[0], bg1: s[1], bg2: s[2], bgInv: s[3] };
}

/* A pattern as the fitting harness reads it (one JSON per row). */
export function savePattern(file, pat){
  const o = { id: pat.id, x: pat.x, y: pat.y, instr: pat.instr, irf: pat.irf, truth: pat.truth, info: pat.info };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(o));
}
