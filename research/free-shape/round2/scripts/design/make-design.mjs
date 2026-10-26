/* Writes design.json, the round-2 design (PROTOCOL.md "The design", "The split"), with
   fixed seeds, and design.md, its balance tables and the hypercube's figures.
   - 198 truths: 6 solids × 11 Laue classes (one fictitious phase each, ../phases) × 3
     orientation classes, each once; 33 spheres: 3 per class.
   - The split: in each solid × class cell, 2 truths to tuning and 1 to validation, the
     orientation sent to validation rotating over the cells, (11·solid + class) mod 3;
     spheres: 2 and 1 per class, rotating likewise. The screening set: in each cell the
     tuning truth of orientation (validation + 1) mod 3, and per class the sphere after the
     validation one: 66 + 11 = 77 runs.
   - The model error: half the truths none, the rest five kinds (20, 20, 20, 20, 19),
     assigned by annealing so that solid, class, orientation and the split (tuning in the
     screening set, tuning outside it, validation) are balanced, and solid × split (squared
     deviations from the proportional counts); spheres: 16 of 33 with an error, balanced
     over class and split. Each sphere is searched as one of
     the six solids (6, 6, 6, 5, 5, 5), balanced over split, screening and error.
   - The continuous factors: one maximin Latin hypercube over the 198 truths, 7 columns
     (smallest extent, two ratios, counts, peak to background, ε, error strength),
     sliced: each solid's 33 rows are a Latin hypercube of their own in the first six
     columns, each error kind's rows (and the error-free ones) in the strength column;
     annealed by swaps that keep the slices, for the Morris–Mitchell φ₅₀ (maximin) with a
     penalty on the columns' correlations (the strength's over the rows with an error). Spheres: their own, 33 rows, 5 columns
     (diameter, counts, peak to background, ε, strength), strength sliced by error.
   - Orientation: 'on' the body's most telling axis (the engine's rule: the width farthest
     from the other two) on one of the phase's lowIndexAxes, and for three-turn bodies a
     second axis on one of the three simplest lattice rows exactly normal to it
     (latticeAcross(q, e, null, 0.01, 64)): the frames the search holds; 'near' such a
     frame turned 2–10° about a random axis (for a cylinder or spheroid, an axis normal to
     its own: the solid is its axis alone, so its axis is turned by the full 2–10°);
     'generic' uniform.
   Run: node make-design.mjs (a few seconds; deterministic). */
import fs from 'node:fs';
import path from 'node:path';
import { PHASES, phaseQ, ENG, unit, cross, dot, mv, fromCols, rotAbout, principalAxis, rng, hash, randomRotation, dirLabel, canonicalDir } from '../harness/lib.mjs';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const VERSION = 'fs2-design-v1';        // a new validation draw: a new version, new seeds
const SEED = 20261026;
const R = rng(SEED);
const { lowIndexAxes, latticeAcross, BODIES } = ENG;

const SOLIDS = ['box', 'sqbox', 'cylinder', 'ellcyl', 'ellipsoid', 'spheroid'];
const TWO = new Set(['sqbox', 'cylinder', 'spheroid']);           // two extents: axis/section
const ORIENTS = ['on', 'near', 'generic'];
const KINDS = ['none', 'hump', 'sizedist', 'impurity', 'air', 'po'];
const NK = { none: 99, hump: 20, sizedist: 20, impurity: 20, air: 20, po: 19 };
const NK_SPH = { none: 17, hump: 4, sizedist: 3, impurity: 3, air: 3, po: 3 };
const SPH_SEARCH = { box: 6, sqbox: 6, cylinder: 6, ellcyl: 5, ellipsoid: 5, spheroid: 5 };
const CLS = PHASES.map(p=> p.id);
const LO = { s: 2, s2: 15, r: 6, cnt: [300, 30000], pb: [1, 20], eps: 0.003, D: [2, 30], Lmax: 60 };

/* ---------- the rows and the split ---------- */
const truths = [];
SOLIDS.forEach((solid, i)=> CLS.forEach((ph, j)=> ORIENTS.forEach((orient, o)=> {
  const v = (11*i + j) % 3, split = o === v ? 'validation' : 'tuning', screen = o === (v + 1) % 3;
  truths.push({ id: `${solid}-${ph}-${orient}`, kind: 'truth', phase: ph, laue: PHASES[j].laue, solid, search: solid, orient, split, screen, i, j, o });
})));
const spheres = [];
CLS.forEach((ph, j)=> [0, 1, 2].forEach(k=> {
  const v = j % 3, split = k === v ? 'validation' : 'tuning', screen = k === (v + 1) % 3;
  spheres.push({ id: `sphere-${ph}-${k + 1}`, kind: 'sphere', phase: ph, laue: PHASES[j].laue, solid: 'sphere', search: null, orient: null, split, screen, j, k });
}));

/* ---------- balancing a categorical assignment by annealing ---------- */
// labels: a multiset to place on rows; margins: functions row → category; the objective
// Σ over margins, categories and labels of (count − proportional count)².
function balance(rows, labels, margins, iters = 200000, r = R){
  const L = [...new Set(labels)], n = rows.length, tot = Object.fromEntries(L.map(l=> [l, labels.filter(x=> x === l).length]));
  const a = labels.slice(); for (let i = n - 1; i > 0; i--){ const k = Math.floor(r.u()*(i + 1)); [a[i], a[k]] = [a[k], a[i]]; }
  const cats = margins.map(f=> rows.map(f));
  const size = cats.map(c=> { const m = new Map(); c.forEach(x=> m.set(x, (m.get(x) || 0) + 1)); return m; });
  const cnt = cats.map(c=> { const m = new Map(); c.forEach((x, i)=> { const key = x + '|' + a[i]; m.set(key, (m.get(key) || 0) + 1); }); return m; });
  const dev = (mi, cat, lab, d) => { const e = size[mi].get(cat)*tot[lab]/n, c = (cnt[mi].get(cat + '|' + lab) || 0) + d; return (c - e)**2; };
  const delta = (i, k) => {        // the objective's change if rows i and k swap labels
    let s = 0;
    for (let mi = 0; mi < cats.length; mi++){
      const ci = cats[mi][i], ck = cats[mi][k]; if (ci === ck) continue;
      s += dev(mi, ci, a[i], -1) - dev(mi, ci, a[i], 0) + dev(mi, ci, a[k], +1) - dev(mi, ci, a[k], 0);
      s += dev(mi, ck, a[k], -1) - dev(mi, ck, a[k], 0) + dev(mi, ck, a[i], +1) - dev(mi, ck, a[i], 0);
    }
    return s;
  };
  for (let t = 0; t < iters; t++){
    const i = Math.floor(r.u()*n), k = Math.floor(r.u()*n);
    if (a[i] === a[k]) continue;
    const d = delta(i, k), T = 2*(1 - t/iters) + 1e-3;
    if (d <= 0 || r.u() < Math.exp(-d/T)){
      for (let mi = 0; mi < cats.length; mi++){
        const ci = cats[mi][i], ck = cats[mi][k];
        cnt[mi].set(ci + '|' + a[i], cnt[mi].get(ci + '|' + a[i]) - 1); cnt[mi].set(ck + '|' + a[k], cnt[mi].get(ck + '|' + a[k]) - 1);
        cnt[mi].set(ci + '|' + a[k], (cnt[mi].get(ci + '|' + a[k]) || 0) + 1); cnt[mi].set(ck + '|' + a[i], (cnt[mi].get(ck + '|' + a[i]) || 0) + 1);
      }
      [a[i], a[k]] = [a[k], a[i]];
    }
  }
  return a;
}
const multiset = counts => Object.entries(counts).flatMap(([k, n])=> Array(n).fill(k));
// the split and the screening set as one three-level factor: tuning in the screening set,
// tuning outside it, validation
const grp = r => r.split === 'validation' ? 'validation' : r.screen ? 'screening' : 'tuning';
const err = balance(truths, multiset(NK), [r=> r.solid, r=> r.phase, r=> r.orient, grp, r=> r.solid + grp(r)]);
truths.forEach((r, i)=> { r.errKind = err[i]; });
const errS = balance(spheres, multiset(NK_SPH).map(k=> k === 'none' ? 'none' : 'err'), [r=> r.phase, grp]);
// the kinds among the spheres with an error, balanced over split and screening
const sphE = spheres.filter((_, i)=> errS[i] === 'err'), kindsS = balance(sphE, multiset({ ...NK_SPH, none: 0 }), [grp]);
spheres.forEach((r, i)=> { r.errKind = errS[i] === 'none' ? 'none' : kindsS[sphE.indexOf(r)]; });
const srch = balance(spheres, multiset(SPH_SEARCH), [grp, r=> r.errKind === 'none' ? 'none' : 'err']);
spheres.forEach((r, i)=> { r.search = srch[i]; });

/* ---------- the sliced maximin Latin hypercube ---------- */
/* lhs(n, d, slicesPerCol) → an n × d array in (0, 1): each column the n centred levels
   (k + ½)/n, dealt so that each slice of the column's slice labels covers (0, 1) as its own
   Latin hypercube would (its rows' levels near (m + U)/n_s); then annealed by swaps within
   a slice (which keep every slice's set of levels) for φ_p = (Σ d⁻ᵖ)^(1/p), p = 50, plus
   λ·Σ ρ² over column pairs. */
function slicedLHS(n, d, slices, { iters = 400000, p = 50, lambda = 20, r = R, masks = null } = {}){
  const X = Array.from({ length: n }, ()=> new Float64Array(d));
  for (let c = 0; c < d; c++){
    const lab = slices[c], groups = new Map();
    lab.forEach((s, i)=> { if (!groups.has(s)) groups.set(s, []); groups.get(s).push(i); });
    const targets = [];
    for (const rows of groups.values()){
      const ns = rows.length, perm = rows.slice(); for (let i = ns - 1; i > 0; i--){ const k = Math.floor(r.u()*(i + 1)); [perm[i], perm[k]] = [perm[k], perm[i]]; }
      perm.forEach((row, m)=> targets.push({ row, q: (m + r.u())/ns }));
    }
    targets.sort((a, b)=> a.q - b.q).forEach((t, k)=> { X[t.row][c] = (k + 0.5)/n; });
  }
  // distances, φ's sum, column cross-products
  const D2 = Array.from({ length: n }, ()=> new Float64Array(n));
  const dist2 = (a, b) => { let s = 0; for (let c = 0; c < d; c++){ const t = X[a][c] - X[b][c]; s += t*t; } return s; };
  let S = 0;
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++){ D2[a][b] = D2[b][a] = dist2(a, b); S += Math.pow(D2[a][b], -p/2); }
  // correlations over the rows where both columns mean something (masks: a column's rows
  // in use, e.g. the strength's rows with an error), about the levels' mean ½ and with
  // the uniform variance 1/12: a proxy the annealing can update by O(d) per swap
  const mean = 0.5, M = Array.from({ length: d }, (_, c)=> masks && masks[c] ? masks[c] : new Array(n).fill(1));
  const NN = Array.from({ length: d }, (_, k)=> Array.from({ length: d }, (_, l)=> { let t = 0; for (let i = 0; i < n; i++) t += M[k][i]*M[l][i]; return Math.max(1, t)/12; }));
  const C = Array.from({ length: d }, (_, k)=> Array.from({ length: d }, (_, l)=> X.reduce((t, x, i)=> t + M[k][i]*M[l][i]*(x[k] - mean)*(x[l] - mean), 0)));
  const rho2 = () => { let s = 0; for (let k = 0; k < d; k++) for (let l = k + 1; l < d; l++) s += (C[k][l]/NN[k][l])**2; return s; };
  let R2 = rho2();
  const obj = (S_, R2_) => Math.log(S_)/p + lambda*R2_;
  const byCol = slices.map(lab=> { const g = new Map(); lab.forEach((s, i)=> { if (!g.has(s)) g.set(s, []); g.get(s).push(i); }); return [...g.values()].filter(x=> x.length > 1); });
  let cur = obj(S, R2);
  for (let t = 0; t < iters; t++){
    const c = Math.floor(r.u()*d), gs = byCol[c], g = gs[Math.floor(r.u()*gs.length)];
    const a = g[Math.floor(r.u()*g.length)], b = g[Math.floor(r.u()*g.length)];
    if (a === b) continue;
    const xa = X[a][c], xb = X[b][c], dS = [];
    let S2 = S;
    for (let k = 0; k < n; k++){
      if (k === a || k === b) continue;
      const na = D2[a][k] - (xa - X[k][c])**2 + (xb - X[k][c])**2, nb = D2[b][k] - (xb - X[k][c])**2 + (xa - X[k][c])**2;
      S2 += Math.pow(na, -p/2) - Math.pow(D2[a][k], -p/2) + Math.pow(nb, -p/2) - Math.pow(D2[b][k], -p/2);
      dS.push([k, na, nb]);
    }
    // the cross-products with column c change by (xb − xa)(x_a,l − x_b,l)
    const dC = Array.from({ length: d }, (_, l)=> l === c ? 0 : M[c][a]*M[l][a]*(xb - xa)*(X[a][l] - mean) + M[c][b]*M[l][b]*(xa - xb)*(X[b][l] - mean));
    let R2n = 0; for (let k = 0; k < d; k++) for (let l = k + 1; l < d; l++){ const ck = k === c ? C[k][l] + dC[l] : l === c ? C[k][l] + dC[k] : C[k][l]; R2n += (ck/NN[k][l])**2; }
    const nw = obj(S2, R2n), T = 0.02*(1 - t/iters) + 1e-6;
    if (nw <= cur || r.u() < Math.exp(-(nw - cur)/T)){
      X[a][c] = xb; X[b][c] = xa; S = S2; R2 = R2n; cur = nw;
      for (const [k, na, nb] of dS){ D2[a][k] = D2[k][a] = na; D2[b][k] = D2[k][b] = nb; }
      for (let l = 0; l < d; l++) if (l !== c){ C[c][l] += dC[l]; C[l][c] = C[c][l]; }
    }
  }
  return X;
}
// the minimum distance, and the largest correlation between two columns, each over the
// rows where it means something: masks[c] the rows column c is in use on (the strength:
// the rows with an error), null all
function lhsStats(X, masks = null){
  const n = X.length, d = X[0].length;
  let dmin = Infinity; for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++){ let s = 0; for (let c = 0; c < d; c++) s += (X[a][c] - X[b][c])**2; dmin = Math.min(dmin, Math.sqrt(s)); }
  const corr = (k, l, idx) => { const xs = idx.map(i=> X[i][k]), ys = idx.map(i=> X[i][l]); const mx = xs.reduce((a, b)=> a + b)/xs.length, my = ys.reduce((a, b)=> a + b)/ys.length;
    let sxy = 0, sx = 0, sy = 0; xs.forEach((x, i)=> { sxy += (x - mx)*(ys[i] - my); sx += (x - mx)**2; sy += (ys[i] - my)**2; }); return sxy/Math.sqrt(sx*sy); };
  const all = X.map((_, i)=> i);
  let rmax = { r: 0 };
  const use = c => masks && masks[c] ? all.filter(i=> masks[c][i]) : all;
  for (let k = 0; k < d; k++) for (let l = k + 1; l < d; l++){ const idx = use(k).filter(i=> use(l).includes(i)), r = corr(k, l, idx); if (Math.abs(r) > Math.abs(rmax.r)) rmax = { r, k, l, n: idx.length }; }
  return { dmin, rmax, corr };
}
// truths: columns s, r1, r2, counts, pb, eps (sliced by solid), strength (sliced by error kind)
const colsT = ['smallest', 'ratio1', 'ratio2', 'counts', 'pb', 'eps', 'strength'];
const slicesT = colsT.map((_, c)=> c < 6 ? truths.map(r=> r.solid) : truths.map(r=> r.errKind));
const maskT = colsT.map((_, c)=> c < 6 ? null : truths.map(r=> r.errKind === 'none' ? 0 : 1));
const XT = slicedLHS(truths.length, 7, slicesT, { masks: maskT });
const colsS = ['D', 'counts', 'pb', 'eps', 'strength'];
const XS = slicedLHS(spheres.length, 5, colsS.map((_, c)=> c < 4 ? spheres.map(()=> 0) : spheres.map(r=> r.errKind === 'none' ? 'none' : 'err')), { iters: 200000, masks: colsS.map((_, c)=> c < 4 ? null : spheres.map(r=> r.errKind === 'none' ? 0 : 1)) });
// the same LHS structure unannealed (for the minimum distance's reference): 20 draws
const ref = (n, d, sl) => { const ds = []; for (let k = 0; k < 20; k++) ds.push(lhsStats(slicedLHS(n, d, sl, { iters: 0, r: rng(SEED + 1000 + k) })).dmin); return ds.sort((a, b)=> a - b)[10]; };
const refT = ref(truths.length, 7, slicesT), refS = ref(spheres.length, 5, colsS.map((_, c)=> c < 4 ? spheres.map(()=> 0) : spheres.map(r=> r.errKind === 'none' ? 'none' : 'err')));

/* ---------- the factors from the hypercube ---------- */
const logU = (u, a, b) => a*Math.pow(b/a, u);
let capped = 0;
truths.forEach((r, n)=> {
  const u = XT[n];
  r.lhs = Array.from(u, x=> +x.toFixed(6));
  const s = logU(u[0], LO.s, LO.s2);
  if (TWO.has(r.solid)){
    // axis/section, 1/6–6 (plate to needle); the smaller extent s; the larger ≤ 60 nm
    let lr = (2*u[1] - 1)*Math.log(LO.r);
    if (s*Math.exp(Math.abs(lr)) > LO.Lmax){ lr = Math.sign(lr)*Math.log(LO.Lmax/s); capped++; }
    const sec = lr >= 0 ? s : s*Math.exp(-lr), ax = lr >= 0 ? s*Math.exp(lr) : s;
    r.dims = [sec, sec, ax]; r.ratio = +Math.exp(lr).toFixed(4);
  } else {
    // middle/smallest and largest/middle, 1–6 each; shrunk in proportion where the largest
    // would pass 60 nm
    let l1 = u[1]*Math.log(LO.r), l2 = u[2]*Math.log(LO.r);
    if (s*Math.exp(l1 + l2) > LO.Lmax){ const f = Math.log(LO.Lmax/s)/(l1 + l2); l1 *= f; l2 *= f; capped++; }
    const e = [s, s*Math.exp(l1), s*Math.exp(l1 + l2)];
    // an elliptic cylinder's height: the smallest, middle or largest extent, rotating
    // over class and orientation ((class + orientation) mod 3: 11 each)
    if (r.solid === 'ellcyl'){ const h = (r.j + r.o) % 3, sec = e.filter((_, k)=> k !== h); r.dims = [sec[0], sec[1], e[h]]; r.heightRank = ['smallest', 'middle', 'largest'][h]; }
    else r.dims = e;
    r.ratios = [+Math.exp(l1).toFixed(4), +Math.exp(l2).toFixed(4)];
  }
  r.dims = r.dims.map(x=> +x.toFixed(4));
  r.counts = Math.round(logU(u[3], ...LO.cnt));
  r.pb = +logU(u[4], ...LO.pb).toFixed(4);
  r.eps = +(LO.eps*u[5]).toFixed(7);
  r.error = r.errKind === 'none' ? null : { kind: r.errKind, strength: +u[6].toFixed(6) };
});
spheres.forEach((r, n)=> {
  const u = XS[n];
  r.lhs = Array.from(u, x=> +x.toFixed(6));
  r.D = +logU(u[0], ...LO.D).toFixed(4); r.dims = [r.D, r.D, r.D];
  r.counts = Math.round(logU(u[1], ...LO.cnt)); r.pb = +logU(u[2], ...LO.pb).toFixed(4); r.eps = +(LO.eps*u[3]).toFixed(7);
  r.error = r.errKind === 'none' ? null : { kind: r.errKind, strength: +u[4].toFixed(6) };
});

/* ---------- orientations ---------- */
// The frames on the lattice the search can hold, per phase: each low-index axis (the first
// axis's candidates) with the three simplest rows exactly normal to it.
const FRAMES = Object.fromEntries(CLS.map(id=> { const q = phaseQ(id);
  const lab = v => { const a = dirLabel(q, v), b = dirLabel(q, v.map(t=> -t)); return (a.match(/-/g) || []).length <= (b.match(/-/g) || []).length ? a : b; };
  return [id, lowIndexAxes(q).map(e=> ({ e: unit(e), label: lab(unit(e)), across: latticeAcross(q, e, null, 0.01, 64).slice(0, 3).map(a=> ({ vec: unit(a.vec), label: lab(unit(a.vec)) })) }))]; }));
function onFrame(r, rr){
  const fr = FRAMES[r.phase], rev = BODIES[r.solid].rot === 2;
  const cands = rev ? fr : fr.filter(f=> f.across.length);
  const f = cands[Math.floor(rr.u()*cands.length)];
  const p = principalAxis({ type: r.solid, dims: r.dims });
  const sg = () => rr.u() < 0.5 ? 1 : -1;
  const sz = sg(), z = f.e.map(t=> sz*t);
  let s, xs, label2 = null;
  if (rev){
    const ref = Math.abs(z[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0], a0 = unit(cross(z, ref)), phi = 2*Math.PI*rr.u();
    xs = unit(mv(rotAbout(z, phi*180/Math.PI), a0)); s = p === 2 ? 0 : 2;
  } else {
    const a = f.across[Math.floor(rr.u()*f.across.length)];
    const sx = sg(); xs = a.vec.map(t=> sx*t); label2 = a.label;
    const others = [0, 1, 2].filter(i=> i !== p); s = others[Math.floor(rr.u()*2)];
  }
  const t = 3 - p - s, cyc = (s - p + 3) % 3 === 1, C = []; C[p] = z; C[s] = xs; C[t] = unit(cyc ? cross(z, xs) : cross(xs, z));
  return { R: fromCols(C), frame: { first: f.label, firstAxis: 'xyz'[p], second: label2, secondAxis: rev ? null : 'xyz'[s] } };
}
for (const r of truths){
  r.seed = hash(VERSION + '|' + r.id);
  const rr = rng(hash(VERSION + '|frame|' + r.id));
  if (r.orient === 'generic'){ r.R = randomRotation(rr); r.frame = null; }
  else {
    const o = onFrame(r, rr);
    r.R = o.R; r.frame = o.frame;
    if (r.orient === 'near'){
      let ax = unit([rr.n(), rr.n(), rr.n()]); const deg = 2 + 8*rr.u();
      const C0 = [[r.R[0], r.R[3], r.R[6]], [r.R[1], r.R[4], r.R[7]], [r.R[2], r.R[5], r.R[8]]];
      // a solid of revolution is its axis alone: a turn about an axis near its own moves it
      // by less than the turn (the first draw: 3 of the 22 under 2°), so the turn is about
      // the random axis's part normal to it, and the solid's axis is turned by deg exactly
      if (BODIES[r.solid].rot === 2){ const z = C0[2]; ax = unit(ax.map((t, i)=> t - dot(ax, z)*z[i])); }
      const T = rotAbout(ax, deg);
      r.R = fromCols(C0.map(c=> mv(T, c)));
      r.frame.R0 = o.R; r.frame.tiltDeg = deg; r.frame.tiltAxis = ax;
    }
  }
}
for (const r of spheres){ r.seed = hash(VERSION + '|' + r.id); r.R = null; r.frame = null; }

/* ---------- write ---------- */
const clean = r => { const { i, j, o, k, errKind, ...rest } = r; return rest; };
const rows = [...truths, ...spheres].map(clean);
const maskS = colsS.map((_, c)=> c < 4 ? null : spheres.map(r=> r.errKind === 'none' ? 0 : 1));
const sT = lhsStats(XT, maskT), sS = lhsStats(XS, maskS);
// the strength column among the rows with an error alone
const errIdx = truths.map((r, i)=> r.errKind !== 'none' ? i : -1).filter(i=> i >= 0);
let rStr = 0; for (let k = 0; k < 6; k++){ const rr = sT.corr(k, 6, errIdx); if (Math.abs(rr) > Math.abs(rStr)) rStr = rr; }
const design = {
  version: VERSION, seed: SEED, protocol: 'research/free-shape/PROTOCOL.md',
  // the seeds keep VERSION; revision 2 (the pilot's verification): a near cylinder's or
  // spheroid's axis is turned by its full tilt (22 rows' R; the rest unchanged)
  revision: 2,
  factors: { smallest: '2–15 nm log-uniform', ratios: 'three-extent solids: middle/smallest, largest/middle 1–6 log-uniform; two-extent: axis/section 1/6–6 log-uniform; largest ≤ 60 nm (both log-ratios shrunk in proportion where it would pass)',
    sphere: 'D 2–30 nm log-uniform', counts: '300–30000 log-uniform (strongest point of the phase above the background)', pb: '1–20 log-uniform', eps: '0–0.003 uniform (fraction)', strength: '0–1 uniform' },
  lhs: { truths: { columns: colsT, n: truths.length, minDist: +sT.dmin.toFixed(4), minDistUnannealed: +refT.toFixed(4), maxCorr: { r: +sT.rmax.r.toFixed(4), between: [colsT[sT.rmax.k], colsT[sT.rmax.l]], rows: sT.rmax.n }, maxCorrStrengthOnErrorRows: +rStr.toFixed(4), capped },
         spheres: { columns: colsS, n: spheres.length, minDist: +sS.dmin.toFixed(4), minDistUnannealed: +refS.toFixed(4), maxCorr: { r: +sS.rmax.r.toFixed(4), between: [colsS[sS.rmax.k], colsS[sS.rmax.l]], rows: sS.rmax.n } } },
  counts: { truths: truths.length, spheres: spheres.length, tuning: rows.filter(r=> r.split === 'tuning').length, validation: rows.filter(r=> r.split === 'validation').length, screening: rows.filter(r=> r.screen).length },
  rows,
};
fs.writeFileSync(path.join(HERE, 'design.json'), JSON.stringify(design, null, 1));

/* ---------- the factors as drawn ----------
   Pearson correlations on the drawn factors (log scale for the log-uniform ones): the
   60 nm cap shrinks the ratios of the truths with a large smallest extent, which the
   cube's coordinates do not show. And each error kind's strength levels against its own
   1/n bins. */
const pear = (xs, ys) => { const n = xs.length, mx = xs.reduce((a, b)=> a + b)/n, my = ys.reduce((a, b)=> a + b)/n; let sxy = 0, sx = 0, sy = 0; for (let i = 0; i < n; i++){ sxy += (xs[i] - mx)*(ys[i] - my); sx += (xs[i] - mx)**2; sy += (ys[i] - my)**2; } return sxy/Math.sqrt(sx*sy); };
const drawnStats = (()=> {
  const lnS = r => Math.log(Math.min(...r.dims)), lnA = r => Math.log(Math.max(...r.dims)/Math.min(...r.dims));
  const three = truths.filter(r=> !TWO.has(r.solid)), lr = (r, k) => Math.log(r.ratios[k]);
  const F = { 'ln smallest': lnS, 'ln largest/smallest': lnA, 'ln counts': r=> Math.log(r.counts), 'ln pb': r=> Math.log(r.pb), 'ε': r=> r.eps };
  const names = Object.keys(F); let worst = { r: 0 };
  for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++){ if (i === 0 && j === 1) continue; const r = pear(truths.map(F[names[i]]), truths.map(F[names[j]])); if (Math.abs(r) > Math.abs(worst.r)) worst = { r, a: names[i], b: names[j] }; }
  const er = truths.filter(r=> r.error);
  for (const nm of names){ const r = pear(er.map(F[nm]), er.map(x=> x.error.strength)); if (Math.abs(r) > Math.abs(worst.r)) worst = { r, a: nm, b: 'strength' }; }
  const terc = [...truths].sort((a, b)=> lnS(a) - lnS(b)), k = Math.round(terc.length/3);
  const tmean = g => (g.reduce((t, r)=> t + lnA(r), 0)/g.length).toFixed(2);
  const capT = g => g.filter(r=> Math.max(...r.dims) > 59.99).length;
  const groups = [terc.slice(0, k), terc.slice(k, 2*k), terc.slice(2*k)];
  const lines = [
    `ρ(ln smallest, ln largest/smallest) ${pear(truths.map(lnS), truths.map(lnA)).toFixed(3)} over the 198 truths`,
    `for the three-extent solids ρ(ln smallest, ln middle/smallest) ${pear(three.map(lnS), three.map(r=> lr(r, 0))).toFixed(3)}, ρ(ln smallest, ln largest/middle) ${pear(three.map(lnS), three.map(r=> lr(r, 1))).toFixed(3)}`,
    `mean ln(largest/smallest) by tercile of the smallest extent ${groups.map(tmean).join(', ')} (at the cap ${groups.map(capT).join(', ')})`,
    `every other pair under |ρ| ${Math.abs(worst.r).toFixed(3)} (${worst.a} × ${worst.b})`];
  return { lines };
})();
const strengthBins = ['hump', 'sizedist', 'impurity', 'air', 'po'].map(kind=> {
  const xs = truths.filter(r=> r.error && r.error.kind === kind).map(r=> r.error.strength), n = xs.length;
  const hit = new Set(xs.map(x=> Math.min(n - 1, Math.floor(x*n))));
  return { kind, n, empty: n - hit.size };
});

/* ---------- design.md: the balance tables ---------- */
const tab = (rowsX, rowKey, rowVals, colKey, colVals, title) => {
  const lines = [`| ${title} | ${colVals.join(' | ')} | all |`, `|${'---|'.repeat(colVals.length + 2)}`];
  for (const v of rowVals){ const sub = rowsX.filter(r=> rowKey(r) === v); lines.push(`| ${v} | ${colVals.map(c=> sub.filter(r=> colKey(r) === c).length).join(' | ')} | ${sub.length} |`); }
  lines.push(`| all | ${colVals.map(c=> rowsX.filter(r=> colKey(r) === c).length).join(' | ')} | ${rowsX.length} |`);
  return lines.join('\n');
};
const ek = r => r.error ? r.error.kind : 'none';
const q = (xs, f) => { const s = xs.map(f).sort((a, b)=> a - b); return [s[0], s[Math.floor(s.length/2)], s[s.length - 1]]; };
const f2 = x => x < 10 ? x.toFixed(2) : x.toFixed(0);
const md = [`# Design ${VERSION} (seed ${SEED})`, '',
  `${truths.length} truths, ${spheres.length} spheres; tuning ${design.counts.tuning}, validation ${design.counts.validation}; screening set ${design.counts.screening}.`, '',
  '## Model error × solid (truths)', tab(truths, r=> r.solid, SOLIDS, ek, KINDS, 'solid'), '',
  '## Model error × Laue class (truths)', tab(truths, r=> r.laue, PHASES.map(p=> p.laue), ek, KINDS, 'class'), '',
  '## Model error × orientation (truths)', tab(truths, r=> r.orient, ORIENTS, ek, KINDS, 'orientation'), '',
  '## Model error × split, and the screening set (truths)', tab(truths, r=> r.split + (r.screen ? ' (screening)' : ''), ['tuning (screening)', 'tuning', 'validation'], ek, KINDS, 'split'), '',
  '## Orientation × split (truths)', tab(truths, r=> r.orient, ORIENTS, r=> r.split + (r.screen ? '+screen' : ''), ['tuning+screen', 'tuning', 'validation'], 'orientation'), '',
  '## Spheres: model error × split', tab(spheres, r=> r.split + (r.screen ? ' (screening)' : ''), ['tuning (screening)', 'tuning', 'validation'], ek, KINDS, 'split'), '',
  '## Spheres: solid searched × split', tab(spheres, r=> r.search, SOLIDS, r=> r.split + (r.screen ? '+screen' : ''), ['tuning+screen', 'tuning', 'validation'], 'searched as'), '',
  '## Spheres: model error × class', tab(spheres, r=> r.laue, PHASES.map(p=> p.laue), r=> r.error ? 'error' : 'none', ['none', 'error'], 'class'), '',
  '## The hypercube',
  `- Truths: 7 columns (${colsT.join(', ')}), sliced by solid (first six) and by error kind (strength). Minimum distance between two of the 198 points in the unit cube ${sT.dmin.toFixed(4)} (the same sliced structure before annealing: median of 20 draws ${refT.toFixed(4)}). Largest correlation between two columns ${sT.rmax.r.toFixed(4)} (${colsT[sT.rmax.k]} × ${colsT[sT.rmax.l]}, over ${sT.rmax.n} rows: the strength's correlations over the rows with an error, the others' over all), Pearson on the unit-cube coordinates.`,
  `- Spheres: 5 columns (${colsS.join(', ')}). Minimum distance ${sS.dmin.toFixed(4)} (unannealed median ${refS.toFixed(4)}); largest correlation ${sS.rmax.r.toFixed(4)} (${colsS[sS.rmax.k]} × ${colsS[sS.rmax.l]}, over ${sS.rmax.n} rows).`,
  `- ${capped} of the 198 truths had their ratios shrunk to keep the largest extent at 60 nm.`,
  `- On the factors as drawn (the cap acts on them, not on the cube): ${drawnStats.lines.join('; ')}.`,
  `- The strength column, by error-kind slice (rows, empty 1/n bins): ${strengthBins.map(b=> b.kind + ' ' + b.n + ', ' + b.empty).join('; ')}. The slices are dealt near (m + U)/n each and then given the global levels (k + ½)/198, so a slice of unequal size can miss a bin of its own.`, '',
  '## The factors per solid (min, median, max)',
  '| solid | smallest nm | largest nm | counts | peak/bg | ε % | strength (with an error) |', '|---|---|---|---|---|---|---|',
  ...SOLIDS.map(s=> { const xs = truths.filter(r=> r.solid === s), er = xs.filter(r=> r.error);
    return `| ${s} | ${q(xs, r=> Math.min(...r.dims)).map(f2).join(', ')} | ${q(xs, r=> Math.max(...r.dims)).map(f2).join(', ')} | ${q(xs, r=> r.counts).map(f2).join(', ')} | ${q(xs, r=> r.pb).map(f2).join(', ')} | ${q(xs, r=> 100*r.eps).map(x=> x.toFixed(3)).join(', ')} | ${q(er, r=> r.error.strength).map(x=> x.toFixed(2)).join(', ')} |`; }),
  '', '## Orientation frames on the lattice (first axis: second axes)',
  ...CLS.map(id=> `- ${id}: ${FRAMES[id].map(f=> `${f.label}: ${f.across.map(a=> a.label).join(' ') || '—'}`).join('; ')}`),
];
fs.writeFileSync(path.join(HERE, 'design.md'), md.join('\n') + '\n');
console.log(md.join('\n'));
