/* The free-shape harness, round 2: round 1's (fs/harness/lib.mjs) on the frozen b9bef5f
   engine (eng/: make-eng.mjs, instrumented only), generalised from the cubic SrTiO3 to the
   eleven fictitious phases of ../phases, one per Laue class, and driven by a design row
   and a pattern drawn by the generator (../gen) instead of a case list.
   - The phases: their CIFs (../phases/cif), each read with prepPhase, refined as the card
     sends it with Crystallite size: the row's solid, ADP overall, strain refined.
   - The symmetry: the Laue class's proper rotations in the engine's Cartesian frame, from
     the engine's own operations (q.laue, the group memberVectors builds) through its own
     cartOp; the lattice's holohedry the same way (integer operations that keep the
     metric), for the merohedral classes' twin-like errors.
   - compareSolids(fit, ref, rots): round 1's, the best over the given rotations.
   - canonical(q, solid): a solid's frame in the class's fundamental zone (README).
   - runCase({ row, pattern, methods, shape, fit, log }): the pattern refined by autoRefine
     from the CIF with the pattern's instrumental profile up to the shape search; there
     each method runs in turn from the same isotropic fit, as in round 1. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildModel, calc, autoRefine, setParams, ENG } from './eng/xrd-rietveld.js';
import { prepPhase } from './eng/xrd-rv-model.js';
import { metric } from './eng/xrd-cryst.js';
import { PHASES } from '../phases/make-phases.mjs';

export { ENG, PHASES };
export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const FS2 = path.resolve(HERE, '..');
const { D2R, R2D, K_SCHERRER, BODIES, quatMat, quatMul, quatOfRot, quatOfMat, bodyFrame, evaluate, FS, cartOp, lattDirection, SNAP_DEG } = ENG;

/* ---------- the phases ---------- */
// The phase's options as the card sends them with Crystallite size and the solid: one ΔB,
// the isotropic strain, no texture, no occupancy refined.
export const PHASE_OPTS = { size: true, profile: 'lorentz', strain: 'iso', faults: null, adp: 'overall', po: null, occ: null };
const memo = new Map();
const once = (k, f) => memo.has(k) ? memo.get(k) : (memo.set(k, f()), memo.get(k));
export const phaseIds = () => PHASES.map(p=> p.id);
export const phaseInfo = id => PHASES.find(p=> p.id === id) || (()=> { throw new Error('no phase ' + id); })();
export const cifText = id => fs.readFileSync(path.join(FS2, 'phases', 'cif', phaseInfo(id).id + '.cif'), 'utf8');
export const phasePrep = id => once('prep:' + id, ()=> prepPhase(cifText(id), id + '.cif'));
// The phase as buildModel takes it (id 1: parameters 'p1.…'), with the solid `shape`
// (false: the isotropic size alone).
export function phaseOf(id, shape){
  const p = phasePrep(id);
  return { id: 1, name: p.name, cell: p.cell, constraint: p.constraint, ops: p.ops, atoms: p.atoms, mass: p.mass, color: '#888', ...PHASE_OPTS, shape };
}
/* The phase as the free shape sets it up (shapeSetup → memberVectors): q.Bm (the
   Cartesian frame: a* along x, b* in the x–y plane), q.laue (the Laue group on the
   reflections' indices, as rows), q.mv (each reflection's members), q.constraint. From a
   small model over the round-2 range: the frame does not depend on the grid. */
export function phaseQ(id){
  return once('q:' + id, ()=> {
    const x = Array.from({ length: 121 }, (_, i)=> 10 + i);
    return buildModel({ x, y: x.map(()=> 1), phases: [phaseOf(id, 'box')] }).phases[0];
  });
}

/* ---------- vectors ---------- */
export const unit = v => { const n = Math.hypot(...v); return v.map(t=> t/n); };
export const dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
export const cross = (a, b) => [a[1]*b[2] - a[2]*b[1], a[2]*b[0] - a[0]*b[2], a[0]*b[1] - a[1]*b[0]];
export const mv = (M, v) => [M[0]*v[0] + M[1]*v[1] + M[2]*v[2], M[3]*v[0] + M[4]*v[1] + M[5]*v[2], M[6]*v[0] + M[7]*v[1] + M[8]*v[2]];
export const mm = (A, B) => [0, 1, 2].flatMap(i=> [0, 1, 2].map(j=> A[3*i]*B[j] + A[3*i + 1]*B[3 + j] + A[3*i + 2]*B[6 + j]));
export const cols = R => [[R[0], R[3], R[6]], [R[1], R[4], R[7]], [R[2], R[5], R[8]]];
export const fromCols = ([x, y, z]) => [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]];
const det3 = R => R[0]*(R[4]*R[8] - R[5]*R[7]) - R[1]*(R[3]*R[8] - R[5]*R[6]) + R[2]*(R[3]*R[7] - R[4]*R[6]);
export const rotAbout = (n, deg) => { const [x, y, z] = unit(n), c = Math.cos(deg*D2R), s = Math.sin(deg*D2R), C = 1 - c;
  return [c + x*x*C, x*y*C - z*s, x*z*C + y*s, y*x*C + z*s, c + y*y*C, y*z*C - x*s, z*x*C - y*s, z*y*C + x*s, c + z*z*C]; };
export const angAx = (a, b) => Math.acos(Math.min(1, Math.abs(dot(unit(a), unit(b)))))*R2D;
// the angle (rad) between two unit vectors, accurate near 0 (acos is not: 1e-8 rad at a
// coincidence)
const angle = (a, b) => Math.atan2(Math.hypot(...cross(a, b)), dot(a, b));

/* ---------- the symmetry ---------- */
// The Laue class's proper rotations, Cartesian (the engine's frame): q.laue's operations of
// determinant +1 through cartOp, C = B·Rᵀ·B⁻¹. Every solid's column lengths are
// centrosymmetric, so these, with axes taken without sign, cover the whole Laue group.
export function laueRotations(id){
  return once('rot:' + id, ()=> {
    const q = phaseQ(id), out = [];
    for (const R of q.laue) if (det3(R) > 0){ const C = cartOp(q.Bm, R); if (!out.some(D=> D.every((t, i)=> Math.abs(t - C[i]) < 1e-9))) out.push(C); }
    return out;
  });
}
// The lattice's holohedry (the metric's own point group): integer operations on the
// reflections' indices (rows, as q.laue; entries −1…1) that keep the reciprocal metric,
// R·G*·Rᵀ = G*, the proper ones, Cartesian. Larger than the Laue group for 4/m, −3, −3m,
// 6/m, m−3: a body and its image by an operation of the holohedry outside the class give
// patterns that differ only through the intensities of reflections at the same d.
export function holoRotations(id){
  return once('holo:' + id, ()=> {
    const q = phaseQ(id), Gs = metric(q.cell).Gs, out = [];
    for (let n = 0; n < 19683; n++){
      const R = []; let m = n; for (let i = 0; i < 9; i++){ R.push(m % 3 - 1); m = Math.floor(m/3); }
      if (det3(R) !== 1) continue;
      const T = mm(mm(R, Gs), [R[0], R[3], R[6], R[1], R[4], R[7], R[2], R[5], R[8]]);
      if (T.every((t, i)=> Math.abs(t - Gs[i]) <= 1e-6*Math.sqrt(Gs[4*Math.floor(i/3)]*Gs[4*(i % 3)]))) out.push(cartOp(q.Bm, R));
    }
    return out;
  });
}

/* ---------- directions and canonical frames ---------- */
// A Cartesian vector's lattice coordinates (direct, the conventional cell's): u = A·t with
// A = (B⁻¹)ᵀ, so t = Bᵀ·u; with a conventional basis M, M⁻¹·t.
export function lattCoords(q, u){
  const B = q.Bm, t = [B[0]*u[0], B[1]*u[0] + B[4]*u[1], B[2]*u[0] + B[5]*u[1] + B[8]*u[2]];
  const M = q.constraint && q.constraint.basis;
  if (!M) return t;
  const d = det3(M), Mi = [(M[4]*M[8] - M[5]*M[7])/d, (M[2]*M[7] - M[1]*M[8])/d, (M[1]*M[5] - M[2]*M[4])/d, (M[5]*M[6] - M[3]*M[8])/d, (M[0]*M[8] - M[2]*M[6])/d, (M[2]*M[3] - M[0]*M[5])/d, (M[3]*M[7] - M[4]*M[6])/d, (M[1]*M[6] - M[0]*M[7])/d, (M[0]*M[4] - M[1]*M[3])/d];
  return mv(Mi, t);
}
/* The order directions are compared in, the engine's own for naming one member of a
   family (lattDirection, tickLabels): fewest negative lattice coordinates, then the
   largest first coordinate, then second, then third; a coordinate within TOL of 0 counts
   as 0, two within TOL as equal (TOL relative to the vector's largest coordinate). */
export const TOL = 1e-7;
function dirCmp(a, b){            // < 0: a comes first (is the nicer)
  const sa = Math.max(...a.map(Math.abs)), sb = Math.max(...b.map(Math.abs));
  const A = a.map(t=> t/sa), Bv = b.map(t=> t/sb);
  const neg = v => v.filter(t=> t < -TOL).length;
  if (neg(A) !== neg(Bv)) return neg(A) - neg(Bv);
  for (let i = 0; i < 3; i++) if (Math.abs(A[i] - Bv[i]) > TOL) return Bv[i] - A[i];
  return 0;
}
// An axis (without sign) as its nicer sense.
const signed = (q, u) => dirCmp(lattCoords(q, u), lattCoords(q, u.map(t=> -t))) <= 0 ? u : u.map(t=> -t);
// A direction's label: [uvw] when within 0.5° of one with indices up to 12, else its
// coordinates scaled to the largest 1.
export function dirLabel(q, u){
  const t = lattCoords(q, u), s = Math.max(...t.map(Math.abs)), f = t.map(x=> x/s);
  for (let n = 1; n <= 12; n++){
    const r = f.map(x=> Math.round(x*n));
    if (r.every(x=> !x) ) continue;
    const g = r.reduce((a, b)=> { const gg = (x, y)=> y ? gg(y, x % y) : Math.abs(x); return gg(a, b); });
    const rr = r.map(x=> x/g), c = unit(mv(cartOfQ(q), rr));
    if (angAx(c, u) < 0.5) return '[' + rr.map(x=> x < 0 ? '-' + -x : '' + x).join('') + ']';
  }
  return '[' + f.map(x=> x.toFixed(3)).join(' ') + ']';
}
// The direct-lattice basis (conventional) as Cartesian columns: A = (B⁻¹)ᵀ (·M).
function cartOfQ(q){
  const B = q.Bm, [b11, b12, b13, , b22, b23, , , b33] = B;
  const Bi = [1/b11, -b12/(b11*b22), (b12*b23 - b13*b22)/(b11*b22*b33), 0, 1/b22, -b23/(b22*b33), 0, 0, 1/b33];
  const A = [Bi[0], Bi[3], Bi[6], Bi[1], Bi[4], Bi[7], Bi[2], Bi[5], Bi[8]];
  const M = q.constraint && q.constraint.basis;
  return M ? mm(A, M) : A;
}
/* The family an axis is read against, as the engine names directions (lattDirection: the
   simplest row, indices up to 4, within SNAP_DEG = 10°, else the nearest), made
   independent of which image of the axis is given: over the images G·u, the simplest row
   found within 10° (then the nearest), else the nearest of all. Its first member (the
   engine's: fewest negative indices, then the largest) as a Cartesian unit vector. */
function familyRep(id, u, rots){
  const q = phaseQ(id), A = cartOfQ(q);
  let best = null;
  for (const G of rots){
    const L = lattDirection(q, unit(mv(G, u))), cx = L.tc.reduce((t, x)=> t + x*x, 0), within = L.angle <= SNAP_DEG;
    const key = within ? [0, cx, L.angle] : [1, L.angle, cx];
    if (!best || key[0] < best.key[0] || (key[0] === best.key[0] && (key[1] < best.key[1] - 1e-6 || (Math.abs(key[1] - best.key[1]) <= 1e-6 && key[2] < best.key[2] - 1e-6)))) best = { key, L };
  }
  return { vec: unit(mv(A, best.L.dir)), label: best.L.label, dir: best.L.dir };
}
/* canonicalDir(id, u) → { vec, t, label, family }: the axis u (without sign) in the class's
   fundamental zone. Its family as the engine names it (familyRep); of the images G·u
   (either sense), the one nearest that family's first member, ties by dirCmp; in the sense
   that points toward it. An axis on a lattice row is the family's first member: in m−3m
   ⟨110⟩ is [110], never [−1−10] or [011]; in 4/m [120] and [210] stay two families. An axis
   a few degrees off a row reads next to that row's name, not next to another member of
   its family (the zone is the region nearest the name, not a sector cut at the rows). */
export function canonicalDir(id, u, rots = laueRotations(id)){
  const q = phaseQ(id), rep = familyRep(id, u, rots);
  let best = null;
  for (const G of rots){
    let v = unit(mv(G, u)); v = Math.abs(dot(v, rep.vec)) < 1e-9 ? signed(q, v) : dot(v, rep.vec) < 0 ? v.map(t=> -t) : v;
    const a = angle(v, rep.vec);
    if (!best || a < best.a - 1e-9 || (Math.abs(a - best.a) <= 1e-9 && dirCmp(lattCoords(q, v), lattCoords(q, best.v)) < 0)) best = { v, a };
  }
  return { vec: best.v, t: lattCoords(q, best.v), label: dirLabel(q, best.v), family: rep.label, off: best.a*R2D };
}

/* The bodies' axis classes (round 1): the axes a turn of the base body permutes, whether
   a tie among them leaves their directions undefined (a ball's, a round section's) or
   only permuted (a cube's, a square's). */
export const CLASSES = { box: [[0, 1, 2]], sqbox: [[0, 1, 2]], ellipsoid: [[0, 1, 2]], spheroid: [[0, 1, 2]], cylinder: [[0, 1], [2]], ellcyl: [[0, 1], [2]] };
const CONT = { box: false, sqbox: false, ellipsoid: true, spheroid: true, cylinder: true, ellcyl: true };
export const REVOLUTION = new Set(['cylinder', 'spheroid']);
const lg = d => Math.log(Number.isFinite(d) ? d : 1e4);
const TIE = 0.04;
const perms = a => a.length <= 1 ? [a] : a.flatMap((x, i)=> perms([...a.slice(0, i), ...a.slice(i + 1)]).map(p=> [x, ...p]));
/* The most telling axis, as the engine's held frames choose it (freeShapeRun's snaps):
   the one whose width (∝ 1/extent) is farthest from the other two's — a plate's normal,
   a needle's axis; the axis of revolution of a cylinder or spheroid. Ties: the first. */
export function principalAxis(solid){
  if (REVOLUTION.has(solid.type)) return 2;
  const w = solid.dims.map(d=> Number.isFinite(d) && d > 0 ? 1/d : 0);
  const gap = i => Math.min(...[0, 1, 2].filter(j=> j !== i).map(j=> Math.abs(w[i] - w[j])));
  let p = 0; for (const i of [1, 2]) if (gap(i) > gap(p)*(1 + 1e-9)) p = i;
  return p;
}
/* canonical(id, solid) → { type, dims, axes, R, normal, second, labels, families }: the
   solid's frame in the class's fundamental zone, as a whole.
   1. The normal: the principal axis (principalAxis, the engine's most telling axis). The
      second axis: of the other two, the one of larger extent; where their extents are
      equal (a square box's two edges, a cube's), each in turn (the body's own symmetry).
   2. The normal goes where canonicalDir puts it: over the class's rotations G (and those
      choices), the G·n nearest its family's first member. Among the G that do so equally
      (within 10⁻⁹ rad: the stabiliser, four of them for a plate normal on a 4-fold), the
      one whose second axis G·e is nearest its own family's first member; remaining ties
      by dirCmp on the normal, then the second axis.
   3. Each axis is given in the sense toward its family's member; the third axis is the
      cross product that keeps the frame proper (R, as the engine's quaternions need).
   A cylinder's or spheroid's frame is its axis alone: the canonical axis, with x along
   (axis × z_Cartesian), or along x_Cartesian when the axis is along z.
   Idempotent, and equal for frames related by the class's rotations or the body's own
   symmetry (test.mjs). */
export function canonical(id, solid, rots = laueRotations(id)){
  const q = phaseQ(id), ax = solid.axes.map(unit), type = solid.type;
  const p = principalAxis(solid);
  if (REVOLUTION.has(type)){
    const c = canonicalDir(id, ax[2], rots), z = c.vec;
    const ref = Math.abs(z[2]) < 0.99 ? [0, 0, 1] : [1, 0, 0];
    const x = unit(cross(z, ref)), y = cross(z, x);
    return { type, dims: [...solid.dims], axes: [x, y, z], R: fromCols([x, y, z]), normal: 2, second: null, labels: [null, null, c.label], families: [null, null, c.family] };
  }
  const others = [0, 1, 2].filter(i=> i !== p);
  const same = (i, j) => Math.abs(lg(solid.dims[i]) - lg(solid.dims[j])) < 1e-12;
  const seconds = same(others[0], others[1]) ? others : [solid.dims[others[0]] >= solid.dims[others[1]] ? others[0] : others[1]];
  // a cube: every axis may be the normal
  const normals = [0, 1, 2].every(i=> same(i, p)) ? [0, 1, 2] : [p];
  const rep = new Map(), repOf = i => rep.get(i) || (rep.set(i, familyRep(id, ax[i], rots)), rep.get(i));
  // the sense toward the family's member; normal to it (a tie the sign cannot break), the
  // nicer sense by dirCmp
  const toward = (v, r) => Math.abs(dot(v, r)) < 1e-9 ? signed(q, v) : dot(v, r) < 0 ? v.map(t=> -t) : v;
  let best = null;
  for (const G of rots) for (const pn of normals) for (const s of (normals.length > 1 ? [0, 1, 2].filter(i=> i !== pn) : seconds)){
    const rn = repOf(pn), re = repOf(s);
    const n = toward(unit(mv(G, ax[pn])), rn.vec), e = toward(unit(mv(G, ax[s])), re.vec);
    const an = angle(n, rn.vec), ae = angle(e, re.vec);
    const cand = { n, e, an, ae, tn: lattCoords(q, n), te: lattCoords(q, e), rn, re };
    if (best){
      const dn = an - best.an, de = ae - best.ae;
      if (dn > 1e-9) continue;
      if (Math.abs(dn) <= 1e-9){
        if (de > 1e-9) continue;
        if (Math.abs(de) <= 1e-9){ const c = dirCmp(cand.tn, best.tn); if (c > 0 || (c === 0 && dirCmp(cand.te, best.te) >= 0)) continue; }
      }
    }
    best = cand;
  }
  // the frame: the normal in the body's slot p, the second axis in slot s — where two or
  // three extents are equal (a square's edges, a cube's) the first of the tied slots,
  // whichever axis it came from: their extents are equal — the third proper
  const s = seconds.length > 1 ? others[0] : seconds[0];
  const t = 3 - p - s, cyc = (s - p + 3) % 3 === 1;
  const C = []; C[p] = best.n; C[s] = best.e; C[t] = unit(cyc ? cross(best.n, best.e) : cross(best.e, best.n));
  const fam = []; fam[p] = best.rn.label; fam[s] = best.re.label; fam[t] = null;
  return { type, dims: [...solid.dims], axes: C, R: fromCols(C), normal: p, second: s, labels: C.map(c=> dirLabel(q, c)), families: fam };
}

/* compareSolids(fit, ref, { rots, loose }) → { dimErr [rel, per paired axis, ref's
   order], dimMax, orient (° the worst defined axis after the best rotation of rots),
   principal (° the ref's most distinct axis), pairs }. Round 1's, with the rotations
   given (default: none but the identity). Within a class the axes are paired by size;
   axes the ref ties (within 4 %) are tried in every order (a cube's) or left out of the
   orientation (a ball's, a round section's); axes are compared without sign. */
export function compareSolids(fit, ref, { rots = [[1, 0, 0, 0, 1, 0, 0, 0, 1]], loose = false } = {}){
  const type = ref.type, cls = loose ? [[0, 1, 2]] : CLASSES[type];
  const pairsets = [[]];
  const undefinedAx = new Set();
  for (const c of cls){
    const rs = [...c].sort((a, b)=> ref.dims[a] - ref.dims[b]), fs = [...c].sort((a, b)=> fit.dims[a] - fit.dims[b]);
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
  const gap = i => Math.min(...[0, 1, 2].filter(j=> j !== i).map(j=> Math.abs(lg(ref.dims[i]) - lg(ref.dims[j]))));
  const prin = [0, 1, 2].filter(i=> !undefinedAx.has(i)).sort((a, b)=> gap(b) - gap(a))[0];
  let best = null;
  for (const pairs of pairsets){
    let orient = Infinity, principal = Infinity, G0 = null;
    for (const G of rots){
      let worst = 0, pa = Infinity;
      for (const [ri, fi] of pairs){
        if (undefinedAx.has(ri)) continue;
        const a = angAx(fit.axes[fi], mv(G, ref.axes[ri]));
        worst = Math.max(worst, a);
        if (ri === prin) pa = a;
      }
      if (worst < orient){ orient = worst; G0 = G; }
      principal = Math.min(principal, pa);
    }
    const dimErr = pairs.map(([ri, fi])=> fit.dims[fi]/ref.dims[ri] - 1);
    const dimMax = Math.max(...dimErr.map(Math.abs));
    const score = orient + 100*dimMax;
    if (!best || score < best.score) best = { score, orient, principal, dimErr: [0, 1, 2].map(ri=> dimErr[pairs.findIndex(p=> p[0] === ri)]), dimMax, pairs, G: G0 };
  }
  if (!Number.isFinite(best.principal)) best.principal = null;
  if (!Number.isFinite(best.orient) || undefinedAx.size === 3) best.orient = null;
  delete best.G;
  return best;
}
// Accuracy against the truth in a phase: modulo the Laue class (orient, principal) and
// modulo the lattice's holohedry (orientHolo, principalHolo: equal unless the error is a
// merohedral twin's).
export function accuracy(id, fit, ref, opts = {}){
  const a = compareSolids(fit, ref, { rots: laueRotations(id), ...opts });
  const h = compareSolids(fit, ref, { rots: holoRotations(id), ...opts });
  return { ...a, orientHolo: h.orient, principalHolo: h.principal };
}

/* ---------- widths, dimensions, solids ---------- */
export const LAM1 = 1.540598;
// A dimension (nm) and a sphere-equivalent width (°): D = Kλ/(W·π/180).
export const widthOf = D => K_SCHERRER*LAM1/(D*10)*R2D;
export const dimOf = W => W > 0 ? K_SCHERRER*LAM1/(W*D2R)/10 : Infinity;
// The body's W parameters from its widths along x, y, z.
export const Wparams = (type, w) => BODIES[type].W.length === 2 ? [w[0], w[2]] : w;
// A solid { type, dims [x, y, z] nm, axes [x, y, z] } from the shape's parameters: v the
// whole vector, or a refine log's `to` ([...iW, ...iR, ...iQ], packed).
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
/* The truth of a design row: { solid: { type, dims, axes }, P: the shape's parameters by
   name as the model's Lorentzian reads the dimensions (sphere-equivalent widths, the
   quaternion of R) — the truth reference's start, not the generator's line shapes }. */
export function truthOf(row){
  if (row.solid === 'sphere') return { solid: null, sphere: row.D, P: { 'p1.Ys': widthOf(row.D) } };
  const B = BODIES[row.solid], w = row.dims.map(widthOf), P = {};
  Wparams(row.solid, w).forEach((t, i)=> { P['p1.' + B.W[i]] = t; });
  quatOfMat(row.R).forEach((t, i)=> { P['p1.Q' + i] = t; });
  return { solid: { type: row.solid, W: Wparams(row.solid, w), dims: [...row.dims], axes: cols(row.R) }, P };
}

/* ---------- random numbers ---------- */
export function rng(seed){
  let s = seed >>> 0;
  const u = ()=> { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0)/4294967296; };
  const n = ()=> Math.sqrt(-2*Math.log(u() || 1e-300))*Math.cos(2*Math.PI*u());
  return { u, n };
}
export const hash = s => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
export const randomRotation = r => quatMat(unit([r.n(), r.n(), r.n(), r.n()]));

/* ---------- running methods on a row ---------- */
const STOP = { stop: true };
export async function loadMethod(file){
  const mod = await import(pathToFileURL(path.resolve(file)).href);
  const m = mod.default || mod;
  if (typeof m.search !== 'function') throw new Error(file + ': no search(model, k, res, free, opts, ENG, ctx)');
  return { name: m.name || path.basename(file, '.mjs'), file, ...m };
}
/* runCase({ row, pattern, methods, shape?, fit?, log? }) → { row, shape, iso, records }.
   row: a design row (../design/design.json); pattern: { x, y, varMul?, instr, irf } (the
   generator's, the standard's refined profile in irf). The phase (row.phase) is refined
   from its CIF by autoRefine with pattern.irf, its solid `shape` (default row.search: the
   truth's own solid, or the one a sphere row is searched as), ADP overall, strain
   refined, up to the shape search; there each method runs in turn from the same
   isotropic fit (model.v reset between them), and autoRefine is stopped. A method is
   { name, search(model, k, res, free, opts, ENG, ctx), reference? } returning what
   freeShape returns. ctx: { row, shape, iso, rng, rots (the class's rotations), id (the
   phase), truth (reference methods only: a search must not read it) }. */
export function runCase({ row, pattern, methods, shape = null, fit = {}, log = true }){
  const type = shape || row.search || row.solid;
  if (!BODIES[type]) throw new Error('no solid ' + type + ' to search');
  const id = row.phase, rots = laueRotations(id);
  const model = buildModel({ x: pattern.x, y: pattern.y, varMul: pattern.varMul || null, instr: pattern.instr, phases: [phaseOf(id, type)] });
  const T = truthOf(row), truth = T.solid && T.solid.type === type ? T : null;
  const out = { row: row.id, phase: id, laue: row.laue, shape: type, truthType: row.solid, truth: T.solid, iso: null, records: [] };
  const t0 = Date.now(), e0 = FS.evals;
  const hook = (model, k, res, free, opts) => {
    const q = model.phases[k];
    out.iso = { evals: FS.evals - e0, ms: Date.now() - t0, chi2: res.stats.chi2*Math.max(1, res.stats.N - res.stats.P), chi2nu: res.stats.chi2, N: res.stats.N, P: res.stats.P, Ys: model.v[q.iYs], free: [...free] };
    const vIso = model.v.slice();
    for (const m of methods){
      setParams(model, vIso); model.shapeSoft = null;
      FS.log = log ? [] : null; FS.k = k;
      const ctx = { row, id, shape: type, iso: out.iso, rots, truth: m.reference ? truth : null, rng: rng(hash(m.name) ^ (row.seed >>> 0)) };
      const ev0 = FS.evals, tm = Date.now(); FS.t0 = tm;
      let r = null, err = null;
      try { r = m.search(model, k, res, free, opts, ENG, ctx); } catch(e){ err = String(e && e.stack || e); }
      const ms = Date.now() - tm, evals = FS.evals - ev0, lg = FS.log || []; FS.log = null; model.shapeSoft = null;
      out.records.push(summarise({ m, r, err, ms, evals, lg, model, q, type, truth, iso: out.iso, id }));
    }
    setParams(model, vIso);
    throw STOP;
  };
  try { autoRefine(model, { standard: false, irf: pattern.irf, fit, shapeHook: hook }); }
  catch(e){ if (e !== STOP) throw e; }
  if (!out.iso) out.error = 'the shape search was not reached (the phase left out, or no standard profile)';
  return out;
}
function summarise({ m, r, err, ms, evals, lg, model, q, type, truth, iso, id }){
  const st = evaluate(model, model.v), base = BODIES[type].base;
  const kept = !!(r && r.res), P = kept ? r.res.stats.P : iso.P, N = iso.N;
  const rec = { method: m.name, ms, evals, refines: lg.length, iterations: lg.reduce((t, e)=> t + (e.iterations || 0), 0), error: err,
    kept, rejected: !!(r && r.rejected), early: !!(r && r.early), dBIC: r ? (r.info ? null : r.dBIC) : null,
    held: !!(r && r.info && r.info.held), info: r && r.info ? { ...r.info, freeW: undefined } : null,
    chi2: st.chi2, chi2nu: st.chi2/Math.max(1, N - P), P };
  if (r && r.info && Number.isFinite(r.info.chi2)) rec.dBIC = (r.info.chi2 - r.info.chi2Iso)/Math.max(1, r.info.chi2redIso) + (r.info.P - r.info.Piso)*Math.log(r.info.N);
  if (kept){ rec.solid = solidOf(q, type, model.v); rec.canonical = canonical(id, rec.solid); }
  const exact = e => !e.error && Number.isFinite(e.chi2) && (!e.soft || base === 'ball');
  const free = lg.filter(e=> exact(e) && e.rotFree).sort((a, b)=> a.chi2 - b.chi2)[0];
  const held = lg.filter(e=> exact(e) && !e.rotFree).sort((a, b)=> a.chi2 - b.chi2)[0];
  const anyBest = lg.filter(e=> !e.error && Number.isFinite(e.chi2)).sort((a, b)=> a.chi2 - b.chi2)[0];
  if (free){ rec.chi2Free = free.chi2; rec.chi2nuFree = free.chi2nu; rec.freeSolid = solidOf(q, type, free.to, true); }
  if (held) rec.chi2Held = held.chi2;
  if (anyBest) rec.chi2Any = anyBest.chi2;
  const ex = [rec.chi2Free, rec.chi2Held].filter(Number.isFinite);
  if (ex.length) rec.chi2Best = Math.min(...ex);
  if (truth && truth.solid){
    if (rec.solid){ rec.acc = accuracy(id, rec.solid, truth.solid); rec.accLoose = compareSolids(rec.solid, truth.solid, { rots: laueRotations(id), loose: true }); }
    if (rec.freeSolid) rec.accFree = accuracy(id, rec.freeSolid, truth.solid);
  }
  rec.log = lg.map(e=> ({ mi: e.maxIter, it: e.iterations, ev: e.evals, ms: e.ms, c: e.chi2, soft: e.soft, rot: e.rotFree, nf: e.nFree, at: e.evalsAt, t: e.tAt, err: e.error,
    to: e.to && solidOf(q, type, e.to, true), from: e.from && solidOf(q, type, e.from, true) }));
  return rec;
}

/* ---------- grouping ends into morphologies ---------- */
// Two solids of one type are one morphology when, modulo the class's rotations and the
// body's symmetry, their worst defined axis is within deg and every dimension within ratio.
export function sameSolid(id, a, b, { deg = 8, ratio = Math.exp(0.25) - 1 } = {}){
  const s = compareSolids(a, b, { rots: laueRotations(id) });
  return (s.orient == null || s.orient <= deg) && s.dimErr.every(e=> Number.isFinite(e) ? Math.abs(e) <= ratio : true);
}
export function basins(id, rec, { exactOnly = false, deg, ratio } = {}){
  const ends = (rec.log || []).filter(e=> e.to && Number.isFinite(e.c) && (!exactOnly || !e.soft)).sort((x, y)=> x.c - y.c);
  const out = [];
  for (const e of ends){
    const g = out.find(g=> sameSolid(id, e.to, g.solid, { deg, ratio }));
    if (g) g.n++; else out.push({ chi2: e.c, solid: e.to, n: 1, soft: e.soft, rot: e.rot });
  }
  return out;
}
// JSON writes an unbounded dimension (Infinity) as null: read results back with this.
export const readResult = text => JSON.parse(text, (k, v)=> k === 'dims' && Array.isArray(v) ? v.map(d=> d == null ? Infinity : d) : v);

/* patternFor(row, { file, draw, kernel }) → the row's pattern: the generator's file
   (default ../gen/patterns/<id>.json, gen/draw.mjs), or drawn in memory by gen/gen.mjs
   drawRow (kernel 'exact', or 'none': the engine's own Lorentzian lines, a control). */
export async function patternFor(row, { file = null, draw = false, kernel = 'exact' } = {}){
  if (draw){ const g = await import(pathToFileURL(path.join(FS2, 'gen', 'gen.mjs')).href); return g.drawRow(row, { kernel }); }
  const f = file || path.join(FS2, 'gen', 'patterns', row.id + '.json');
  if (!fs.existsSync(f)) throw new Error(`no pattern ${f} (gen/draw.mjs --ids ${row.id}, or --draw)`);
  return JSON.parse(fs.readFileSync(f, 'utf8'));
}

/* ---------- a stand-in pattern (tests only) ---------- */
/* modelPattern(row, { lo, hi, step, peak, bg }) → a pattern drawn with the MODEL's own
   forward model (Lorentzian size lines of the sphere-equivalent widths, as round 1), not
   the protocol's exact line shapes: for the harness's own tests, never for results. The
   instrument and profile are round 1's (data/irf-r1.json: LaB6 refined, Soller model). */
export const INSTR_R1 = { lam1: LAM1, lam2: 1.544426, ratio: 0.5, radius: 240, soller: { incident: 0.04, diffracted: 0.04 }, focusLength: 12, monochromator: false };
export function modelPattern(row, { lo = 10, hi = 130, step = 0.01, peak = 3000, bg = 150 } = {}){
  const irf = JSON.parse(fs.readFileSync(path.join(HERE, 'data', 'irf-r1.json'), 'utf8'));
  const x = Array.from({ length: Math.round((hi - lo)/step) + 1 }, (_, i)=> +(lo + i*step).toFixed(6));
  const type = row.solid === 'sphere' ? false : row.solid;
  const m = buildModel({ x, y: x.map(()=> 1), instr: INSTR_R1, phases: [phaseOf(row.phase, type)] });
  const T = truthOf(row);
  const P = { U: irf.U, V: irf.V, W: irf.W, X: irf.X, Y: irf.Y, axL: irf.axL, transp: irf.transp, zero: irf.zero, disp: 0.01,
    'p1.B': 0.3, 'p1.Xs': (row.eps || 0)*4*R2D, bg0: bg, bgInv: 2*bg, ...T.P };
  if (type) P['p1.Ys'] = 0;
  const set = (Q) => { const v = m.v.slice(); for (const k in Q){ const i = m.index[k]; if (i == null) throw new Error('no parameter ' + k); v[i] = Q[k]; } setParams(m, v); };
  set({ ...P, 'p1.scale': 1 });
  const net = calc(m, null, { internal: true }).perPhase[0], S = peak/Math.max(...net);
  set({ ...P, 'p1.scale': S });
  const yc = calc(m, null, { internal: true }).yc, r = rng(hash(row.id) ^ (row.seed >>> 0));
  const pois = lam => { if (!(lam > 0)) return 0; if (lam < 30){ const L = Math.exp(-lam); let k = 0, p = 1; do { k++; p *= r.u(); } while (p > L); return k - 1; } return Math.max(0, Math.round(lam + Math.sqrt(lam)*r.n())); };
  return { x, y: Array.from(yc, pois), varMul: null, instr: INSTR_R1, irf, stand_in: 'model forward model (Lorentzian), round 1 instrument' };
}
