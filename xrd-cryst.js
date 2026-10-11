/* =========================================================
   XRD CRYSTALLOGRAPHY (Rietveld)
   CIF reading, symmetry, reflection lists and structure factors.
   Pure functions: no DOM, importable by the page, a Worker and Node.
========================================================= */
// Conventions shared with xrd-rietveld.js:
// - fractional coordinates; a symmetry operation is {R, t}, R a row-major 3×3 array of
//   numbers, acting as x' = R·x + t. A reflection is a row vector and goes as h' = h·R.
// - a cell is {a, b, c, alpha, beta, gamma} in Å and degrees; s = sinθ/λ = 1/(2d).
import { speciesKey, labelSpecies, f0, fprime, atomicMass } from './xrd-data.js';

const IDENT = [1,0,0, 0,1,0, 0,0,1];
// Å², B of a site the CIF gives none: a middle value of inorganic solids at room temperature
// (0.2–1.5 Å²), only the start, since the card refines one ΔB for such a phase. Held instead, a B
// 0.3–1 Å² off went into the strain and the size (D −13 to +89 % on synthetic patterns, RIETVELD.md §8.1).
const B_DEFAULT = 0.5;
const EIGHT_PI2 = 8*Math.PI*Math.PI;

/* ---------- small linear algebra ---------- */
function det3(m){
  return m[0]*(m[4]*m[8]-m[5]*m[7]) - m[1]*(m[3]*m[8]-m[5]*m[6]) + m[2]*(m[3]*m[7]-m[4]*m[6]);
}
function inv3(m){
  const d = det3(m);
  return [
    (m[4]*m[8]-m[5]*m[7])/d, (m[2]*m[7]-m[1]*m[8])/d, (m[1]*m[5]-m[2]*m[4])/d,
    (m[5]*m[6]-m[3]*m[8])/d, (m[0]*m[8]-m[2]*m[6])/d, (m[2]*m[3]-m[0]*m[5])/d,
    (m[3]*m[7]-m[4]*m[6])/d, (m[1]*m[6]-m[0]*m[7])/d, (m[0]*m[4]-m[1]*m[3])/d,
  ];
}
function mul3(a, b){
  const o = new Array(9);
  for (let i=0;i<3;i++) for (let j=0;j<3;j++) o[3*i+j] = a[3*i]*b[j] + a[3*i+1]*b[3+j] + a[3*i+2]*b[6+j];
  return o;
}
const apply3 = (R, x) => [R[0]*x[0]+R[1]*x[1]+R[2]*x[2], R[3]*x[0]+R[4]*x[1]+R[5]*x[2], R[6]*x[0]+R[7]*x[1]+R[8]*x[2]];

// cos of an angle in degrees, exact at the angles cells are written with, so a cubic or
// hexagonal metric has true zeros (and −½) rather than 6e-17 residues that would split
// the d of reflections that are equal by symmetry.
function cosd(deg){
  if (deg === 90) return 0;
  if (deg === 120) return -0.5;
  if (deg === 60) return 0.5;
  return Math.cos(deg*Math.PI/180);
}
// x mod 1 in [0, 1). A value a rounding error below 1 folds to 0, so 1 − 1e-17 and 0 are
// one position, not two.
function mod1(v){ let w = v - Math.floor(v); if (w > 1 - 1e-9) w = 0; return w; }
// A translation to the nearest multiple of 1/24 (which holds 1/2, 1/3, 1/4, 1/6, 1/8, 1/12)
// when it is within 1.5e-3, so the absence test h·t ∈ ℤ stays exact. For values computed
// (findSymmetry) or written exactly; a decimal of a CIF snaps within its digits (snapOp).
function snapT(v){
  const w = mod1(v), k = Math.round(w*24);
  return Math.abs(w - k/24) < 1.5e-3 ? (k % 24)/24 : w;
}

/* ---------- metric ---------- */
// Direct metric G (a_i·a_j), reciprocal metric G* = G⁻¹ and the cell volume.
function metric(cell){
  const { a, b, c } = cell;
  const ca = cosd(cell.alpha ?? 90), cb = cosd(cell.beta ?? 90), cg = cosd(cell.gamma ?? 90);
  const G = [a*a, a*b*cg, a*c*cb,  a*b*cg, b*b, b*c*ca,  a*c*cb, b*c*ca, c*c];
  return { G, Gs: inv3(G), V: Math.sqrt(det3(G)) };
}
/* The rounding of a cell's metric: what the written digits of its lengths and angles may hide,
   as one term per rounded value p_k, the derivative D_k = ∂G/∂p_k (9 entries) and the rounding
   e_k (parseCif sets cell.dG; cellInBasis carries each D_k to another basis exactly, MᵀD_kM).
   null for an exact cell. A quantity linear in G, Q(G), is then known to Σ_k e_k |Q(D_k)|: the
   first-order worst case, each written value counted once. A metric symmetry is accepted
   within it where it exceeds the 1e-4 relative floor (the floor stays the least tolerance,
   for computed cells; the two are not added): written with the usual four decimals and
   angles to 0.01°, the 530 settings in random bases kept their point group in 96 of 265 cases
   under the floor alone, in all with it. Added to the floor, the rounding had also let a cell
   in its standard basis whose β the file writes 90.01° (no 90° within its digits) pass for
   tetragonal, 11 of 14; with the larger of the two, none, and the random bases still 265 of
   265. A bound on the entries instead, |M|ᵀ|δG||M|, counted one angle several times in an
   oblique or centred basis: an I-centred tetragonal structure with β = 90.2° written to 0.1°
   passed for tetragonal. */
const dGof = cell => (cell && cell.dG) || null;
const dGin = (dG, M) => dG ? dG.map(({ D, e }) => ({ D: mul3(mul3(tr3(M), D), M), e })) : null;
// The rounding of uᵀGv − G_ij (ij = [i, j]; without it, of uᵀGv).
const dGuv = (dG, u, v, ij) => !dG ? 0 : dG.reduce((m, { D, e }) => m + e*Math.abs(qf(D, u, v) - (ij ? D[3*ij[0] + ij[1]] : 0)), 0);
const qf = (D, u, v) => u[0]*(D[0]*v[0] + D[1]*v[1] + D[2]*v[2]) + u[1]*(D[3]*v[0] + D[4]*v[1] + D[5]*v[2]) + u[2]*(D[6]*v[0] + D[7]*v[1] + D[8]*v[2]);
// From the written lengths' and angles' rounding (Å, °): ∂G_ii/∂a_i = 2a_i, ∂G_ij/∂a_i = a_j cos θ_ij,
// ∂G_jk/∂θ_jk = −a_j a_k sin θ_jk.
function metricRounding(cell, eLen, eAng){
  const L = [cell.a, cell.b, cell.c], A = [cell.alpha, cell.beta, cell.gamma], out = [];
  const ang = (i, j) => A[3 - i - j];
  for (let i = 0; i < 3; i++) if (eLen[i] > 0){
    const D = new Array(9).fill(0);
    D[4*i] = 2*L[i];
    for (let j = 0; j < 3; j++) if (j !== i) D[3*i + j] = D[3*j + i] = L[j]*cosd(ang(i, j));
    out.push({ D, e: eLen[i] });
  }
  for (const [j, k, i] of [[1, 2, 0], [0, 2, 1], [0, 1, 2]]) if (eAng[i] > 0){
    const D = new Array(9).fill(0);
    D[3*j + k] = D[3*k + j] = -L[j]*L[k]*Math.sin(A[i]*Math.PI/180);
    out.push({ D, e: eAng[i]*Math.PI/180 });
  }
  return out.length ? out : null;
}
function dSpacing(Gs, h, k, l){
  return 1/Math.sqrt(h*h*Gs[0] + k*k*Gs[4] + l*l*Gs[8] + 2*(h*k*Gs[1] + h*l*Gs[2] + k*l*Gs[5]));
}
const qform = (G, d) => G[0]*d[0]*d[0] + G[4]*d[1]*d[1] + G[8]*d[2]*d[2] + 2*(G[1]*d[0]*d[1] + G[2]*d[0]*d[2] + G[5]*d[1]*d[2]);

/* ---------- precision of written values ---------- */
// Decimals of a value as written: '0.250' 3, '0.1234(5)' 4, '3.3E-1' 2; a number gives its
// shortest form's. A fraction ('1/3') is exact: Infinity.
function decimalsOf(v){
  const s = String(v ?? '').trim();
  if (/^[+-]?\d+\/\d+$/.test(s)) return Infinity;
  const m = /^[+-]?\d*(?:\.(\d*))?(?:\(\d+\))?(?:[eE]([+-]?\d+))?$/.exec(s);
  return m ? Math.max(0, (m[1] || '').length - (m[2] ? +m[2] : 0)) : Infinity;
}
/* The rounding a list of written values may hide: half a unit of the last decimal. The values
   of one row (a site's x, y, z) were written alike, so a shorter one had its zeros dropped
   ('0.93' beside '0.866' is 0.930) and takes the row's longest. A row written with one
   decimal or none ('0', '0.5') is taken as exact — nothing is measured to a tenth — unless
   the list has longer ones: then the list's. So '0.33, 0.67, 0.25' may hide 0.005 (thirds);
   '0.333' 0.0005; a fraction ('1/3') nothing. rows: [[v, …], …] → [[ε, …], …]. */
function roundingOf(rows){
  const ds = rows.map(r => r.map(decimalsOf)), top = r => r.reduce((m, d)=> d !== Infinity && d > m ? d : m, 1);
  const dmax = ds.reduce((m, r)=> Math.max(m, top(r)), 1);
  const half = d => 0.5*Math.pow(10, -d), floor = dmax > 1 ? half(dmax) : 0;
  return ds.map(r => { const dr = top(r); return r.map(d => d === Infinity ? 0 : dr > 1 ? half(dr) : floor); });
}
// Coordinates' rounding (fractions) of sites or atoms: their own eps, else from their digits.
function epsOf(list){
  if (list.every(a => a.eps)) return list.map(a => a.eps);
  const est = roundingOf(list.map(a => [a.x, a.y, a.z]));
  return list.map((a, i) => a.eps || est[i]);
}
// How far the image R·x + t of a point known to ±ea (per axis) and a point known to ±eb may be
// apart, per axis, when they are one position: eb_i + Σ_l |R_il| ea_l.
function allowance(R, ea, eb){
  return [0, 1, 2].map(i => eb[i] + Math.abs(R[3*i])*ea[0] + Math.abs(R[3*i+1])*ea[1] + Math.abs(R[3*i+2])*ea[2]);
}
// The difference d (fractions, wrapped to [−½, ½)) less the allowance b on each axis (0 within
// it; the sign is kept).
function beyond(d, b){
  return [0, 1, 2].map(i => { const v = d[i] - Math.round(d[i]), a = Math.abs(v); return a > b[i] ? Math.sign(v)*(a - b[i]) : 0; });
}
/* Operations S (each with d = R·x + t − x, wrapped) that take x near itself: the shift from x
   to the point their fixed set holds nearest x, by least squares weighted by the rounding e
   of each axis. The mean of the images, x + d̄, is fixed by S (when S is a group); the fixed
   directions are the range of the mean of the R; the point is moved along them. */
function nearestFixed(S, e){
  const nS = S.length, acc = [0, 1, 2].map(i => S.reduce((m, o)=> m + o.d[i], 0)/nS);
  const P = IDENT.map((_, k)=> S.reduce((m, o)=> m + o.R[k], 0)/nS), V = [];
  for (let c = 0; c < 3; c++){
    let v = [P[c], P[3 + c], P[6 + c]];
    for (const u of V){ const f = v[0]*u[0] + v[1]*u[1] + v[2]*u[2]; v = v.map((x, i)=> x - f*u[i]); }
    const nv = Math.hypot(v[0], v[1], v[2]);
    if (nv > 1e-9) V.push(v.map(x => x/nv));
  }
  const w = e.map(v => 1/((v + 1e-9)*(v + 1e-9))), k = V.length;
  if (!k) return acc;
  // (VᵀWV) λ = −VᵀW d̄, by elimination (k ≤ 3)
  const M = V.map(u => [...V.map(v => u[0]*w[0]*v[0] + u[1]*w[1]*v[1] + u[2]*w[2]*v[2]), -(u[0]*w[0]*acc[0] + u[1]*w[1]*acc[1] + u[2]*w[2]*acc[2])]);
  for (let c = 0; c < k; c++){
    let p = c; for (let r = c + 1; r < k; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < k; r++){ if (r === c) continue; const f = M[r][c]/M[c][c]; for (let q = c; q <= k; q++) M[r][q] -= f*M[c][q]; }
  }
  const lam = M.map((row, i)=> row[k]/row[i]);
  return [0, 1, 2].map(i => acc[i] + V.reduce((m, u, j)=> m + lam[j]*u[i], 0));
}
// The radius (Å) of the box ±e (fractions) in the metric G: its longest half-diagonal. A lattice
// symmetry turns the box but keeps that radius, so it bounds the rounding of every image.
function boxRadius(G, e){
  let m = 0;
  for (const s of [[1, 1, 1], [1, 1, -1], [1, -1, 1], [-1, 1, 1]]) m = Math.max(m, qform(G, [s[0]*e[0], s[1]*e[1], s[2]*e[2]]));
  return Math.sqrt(m);
}

/* ---------- symmetry operations ---------- */
// 'x, -y+1/2, z+1/4' → {R, t}. Accepts '1/2+x', '-x+y', '0.5+x', '2*x', upper case,
// spaces, quotes, a typographic minus and the trailing time reversal of a magnetic CIF's
// operations (±1, dropped: parseCif reads them with their centrings, and time reversal does
// not move the atoms). Throws on anything it cannot read or that is not a lattice
// operation (non-integer or non-invertible R): a misread operation would silently
// produce a wrong structure.
// A translation written as a decimal is the multiple of 1/24 its digits may stand for: one it
// rounds or cuts ('0.33', '0.333', '0.6666' are ⅓ and ⅔; '0.30' is no 7/24). Up to v426 all
// snapped within 1.5e-3, which missed two decimals (P3₁ written '0.33' lost its screw, R3 its
// centring) and moved a translation of a shifted origin by up to 1.5e-3 onto the grid. One
// that is no such multiple keeps its value and its rounding, w (per axis: one unit of the last
// decimal), which closure and expansion allow. Exact values (fractions, integers, one decimal)
// snap within 1.5e-3, as before. parseCif decides for the whole list (symopsOf).
function parseSymop(str){ return snapOp(readSymop(str)); }
// The operation as written: t unsnapped, with the range [lo, hi] (per axis) in which the value
// it stands for lies, from the digits of its decimal terms: a term written v with d ≥ 2 decimals
// (unit u) stands for v − u/2 … v + u in magnitude (rounded, or cut). Zero for exact terms.
function readSymop(str){
  if (typeof str !== 'string') throw new Error('Symmetry operation: not a string.');
  const s = str.replace(/[−–]/g, '-').replace(/['"\s]/g, '').toLowerCase().replace(/^\((.*)\)$/, '$1');
  const parts = s.split(',');
  if (parts.length === 4 && /^[+-]?1$/.test(parts[3])) parts.length = 3;
  const bad = why => new Error(`Symmetry operation '${str}': ${why}.`);
  if (parts.length !== 3) throw bad('expected three comma-separated components');
  const R = new Array(9).fill(0), t = [0,0,0], lo = [0,0,0], hi = [0,0,0];
  parts.forEach((p, i)=>{
    if (!p) throw bad(`component ${i+1} is empty`);
    let used = 0;
    for (const m of p.matchAll(/([+-]?)([^+-]+)/g)){
      if (m.index !== used) throw bad(`cannot read '${p}'`);
      used = m.index + m[0].length;
      const tm = /^(\d+\.?\d*|\.\d+)?(?:\/(\d+\.?\d*))?\*?([xyz])?$/.exec(m[2]);
      if (!tm || (!tm[1] && (tm[2] || !tm[3]))) throw bad(`cannot read '${m[2]}'`);
      const v = (m[1] === '-' ? -1 : 1)*(tm[1] ? parseFloat(tm[1]) : 1)/(tm[2] ? parseFloat(tm[2]) : 1);
      if (tm[3]) R[3*i + 'xyz'.indexOf(tm[3])] += v;
      else {
        t[i] += v;
        const d = tm[2] ? 0 : decimalsOf(tm[1]), u = d >= 2 ? Math.pow(10, -d) : 0;
        if (m[1] === '-'){ lo[i] -= u; hi[i] += u/2; } else { lo[i] -= u/2; hi[i] += u; }
      }
    }
    if (used !== p.length) throw bad(`cannot read '${p}'`);
  });
  if (R.some(v => v !== Math.round(v))) throw bad('the coefficients of x, y, z must be integers');
  if (Math.abs(det3(R)) !== 1) throw bad('not a symmetry operation (determinant ≠ ±1)');
  return { R, t, lo, hi };
}
// The multiple of 1/24 within [v + lo, v + hi] nearest v, or null.
function gridIn(v, lo, hi){
  let best = null;
  for (let k = Math.floor((v + lo)*24); k <= Math.ceil((v + hi)*24); k++){
    const d = k/24 - v;
    if (d >= lo - 1e-12 && d <= hi + 1e-12 && (best === null || Math.abs(d) < Math.abs(best/24 - v))) best = k;
  }
  return best === null ? null : (((best % 24) + 24) % 24)/24;
}
// Snapped where the digits allow (w: the rounding of the components left off the grid); with
// keep, every decimal kept as written, with its rounding.
function snapOp({ R, t, lo, hi }, keep = false){
  const w = [0, 0, 0];
  const ts = t.map((v, i)=>{
    if (!(hi[i] > 0)) return snapT(v);
    const g = keep ? null : gridIn(v, lo[i], hi[i]);
    if (g !== null) return g;
    w[i] = Math.max(-lo[i], hi[i]);
    return mod1(v);
  });
  return w.some(v => v) ? { R, t: ts, w } : { R, t: ts };
}
/* A file's operations: snapped onto the 1/24 grid only when every decimal translation in it
   lies within its digits of the grid (a standard origin), else all kept as written. A shifted
   origin puts some translations off the grid, and the ones that fall within their digits of it
   by chance would be moved by up to one unit of the last decimal: over the 530 settings at
   random origins written with two decimals, snapping each where it could moved 3743 of 22164
   translations beyond their writing and filled 379 cells with a wrong number of atoms (53 kept
   as written); with three decimals, 544 and 14 (1). lists: [[read op, …], …], decided together. */
function symopsOf(lists){
  const snapped = lists.map(l => l.map(o => snapOp(o)));
  return snapped.some(l => l.some(o => o.w)) ? lists.map(l => l.map(o => snapOp(o, true))) : snapped;
}

// {R, t} → 'x-y,x,z+1/6', for display and for comparing with printed tables.
function fracStr(v){
  for (const d of [1,2,3,4,6,8,12,24]){ const n = Math.round(v*d); if (Math.abs(v*d - n) < 1e-9) return d === 1 ? String(n) : `${n}/${d}`; }
  return String(+v.toFixed(6));
}
function symopString(op){
  const { R, t } = op;
  return [0,1,2].map(i=>{
    let s = '';
    for (let j=0;j<3;j++){
      const c = R[3*i+j]; if (!c) continue;
      const mag = Math.abs(c) === 1 ? '' : Math.abs(c);
      s += (c < 0 ? '-' : (s ? '+' : '')) + mag + 'xyz'[j];
    }
    const tv = mod1(t[i]), ft = tv ? fracStr(tv) : '0';
    if (ft !== '0' && ft !== '1') s += (s ? '+' : '') + ft;   // (a translation within 5e-7 of a lattice vector reads as none)
    return s || '0';
  }).join(',');
}

/* Two operations with one R are one (modulo lattice translations) when their translations agree
   within the rounding of their written digits (w, parseSymop; 1e-6 for exact ones). Up to v426
   keys rounded to 1e-3 were compared, which split a translation and its rounded copy whenever
   the two fell on either side of a rounding step: 137 of the 530 groups at shifted origins,
   written with four decimals, were called "not a group" (52 with six). */
const sameT = (ta, tb, wa, wb) => [0, 1, 2].every(i => { const d = ta[i] - tb[i]; return Math.abs(d - Math.round(d)) <= (wa ? wa[i] : 0) + (wb ? wb[i] : 0) + 1e-6; });
// Duplicates removed (mod 1); identity kept first.
function uniqueOps(ops){
  const byR = new Map(), out = [];
  for (const op of ops){
    const k = op.R.join(), l = byR.get(k) || [];
    if (!l.some(o => sameT(o.t, op.t, o.w, op.w))){ l.push(op); byR.set(k, l); out.push(op); }
  }
  return out;
}

// Products of operations that are not in the list: an empty array for a group. A list that
// is not closed is usually missing its centring translations (or a line of the loop). A
// product carries the rounding of its factors, wa + |Ra|·wb.
function closureMisses(ops, max = 3){
  const byR = new Map(), out = [], Z = [0, 0, 0];
  for (const o of ops){ const k = o.R.join(); if (!byR.has(k)) byR.set(k, []); byR.get(k).push(o); }
  for (const a of ops) for (const b of ops){
    const R = mul3(a.R, b.R), Rt = apply3(a.R, b.t);
    const t = [Rt[0]+a.t[0], Rt[1]+a.t[1], Rt[2]+a.t[2]];
    const w = a.w || b.w ? allowance(a.R, b.w || Z, a.w || Z) : null;
    if (!(byR.get(R.join()) || []).some(c => sameT(c.t, t, c.w, w))){ out.push({ R, t }); if (out.length >= max) return out; }
  }
  return out;
}

/* ---------- CIF lexer and parser (CIF 1.1 subset, DDLm tag spellings accepted) ---------- */
const isWs = c => c === ' ' || c === '\t';
// One line into tokens {v, q (quoted: never a tag or keyword), line}.
function lexLine(line, n, out){
  const L = line.length;
  let i = 0;
  while (i < L){
    const c = line[i];
    if (isWs(c)){ i++; continue; }
    if (c === '#') break;
    if (c === "'" || c === '"'){
      // A quote closes only when white space or the end of the line follows it, so
      // 'O'Neil' is one value (CIF 1.1).
      let j = i + 1;
      while (j < L && !(line[j] === c && (j + 1 === L || isWs(line[j+1])))) j++;
      out.push({ v: line.slice(i+1, j), q: true, line: n });
      i = j + 1; continue;
    }
    let j = i;
    while (j < L && !isWs(line[j])) j++;
    out.push({ v: line.slice(i, j), q: false, line: n });
    i = j;
  }
}
function cifTokens(text){
  const lines = text.replace(/^﻿/, '').split(/\r\n?|\n/);
  const out = [];
  let n = 0;
  while (n < lines.length){
    let line = lines[n];
    if (line[0] === ';'){
      // A text field runs from a line starting with ';' to the next such line.
      const buf = [line.slice(1)];
      let m = n + 1;
      while (m < lines.length && lines[m][0] !== ';') buf.push(lines[m++]);
      out.push({ v: buf.join('\n').trim(), q: true, line: n });
      if (m >= lines.length) break;
      line = lines[m].slice(1); n = m;
    }
    lexLine(line, n, out);
    n++;
  }
  return out;
}
// CIF 1 (_atom_site_fract_x) and DDLm (_atom_site.fract_x) spellings are one tag here;
// tags are case-insensitive.
const normTag = t => t.toLowerCase().replace(/\./g, '_');
const XYZ_TAGS = ['_space_group_symop_operation_xyz', '_symmetry_equiv_pos_as_xyz'];
const MAGN_TAGS = ['_space_group_symop_magn_operation_xyz', '_space_group_symop_magn_centering_xyz'];

function makeLoop(tags, vals, warnings){
  const n = tags.length, rows = [];
  if (!n) return { tags, rows };
  // Symmetry operations written unquoted with spaces ("1 -x, y, z") split into several
  // values; when every line holds at least a row's worth, read one row per line and join
  // the surplus back into the xyz column. Only when the plain row-major reading fails:
  // quoted operations several rows to a line ('x, y, z' '-x, -y, z') are legal CIF. (A
  // magnetic operation has a fourth part, its time reversal: 'x, y, z, +1'.)
  const xi = tags.findIndex(t => XYZ_TAGS.includes(t) || MAGN_TAGS.includes(t));
  const commas = MAGN_TAGS.includes(tags[xi]) ? 3 : 2;
  const plainOk = xi >= 0 && vals.length % n === 0
    && vals.every((tk, j) => j % n !== xi || (tk.v.match(/,/g) || []).length === commas);
  if (xi >= 0 && !plainOk){
    const byLine = [];
    let last = -1;
    for (const tk of vals){ if (tk.line !== last){ byLine.push([]); last = tk.line; } byLine[byLine.length-1].push(tk.v); }
    if (byLine.length && byLine.every(g => g.length >= n) && byLine.some(g => g.length > n)){
      for (const g of byLine){
        const extra = g.length - n;
        rows.push([...g.slice(0, xi), g.slice(xi, xi+extra+1).join(''), ...g.slice(xi+extra+1)]);
      }
      return { tags, rows };
    }
  }
  if (vals.length % n) warnings.push(`The loop of ${tags[0]} has ${vals.length} values for ${n} columns: the incomplete last row is dropped.`);
  for (let r = 0; r + n <= vals.length; r += n) rows.push(vals.slice(r, r+n).map(tk => tk.v));
  return { tags, rows };
}

// Text → [{name, items:{tag:value}, loops:[{tags, rows}]}]. Save frames and global_
// blocks (dictionary machinery) are skipped.
function cifBlocks(text){
  const toks = cifTokens(text), blocks = [], warnings = [];
  const isTag = tk => !tk.q && tk.v[0] === '_';
  const isKey = tk => !tk.q && /^(data_|save_|loop_$|global_$|stop_$)/i.test(tk.v);
  let cur = null, inSave = false, i = 0;
  while (i < toks.length){
    const tk = toks[i], w = tk.q ? '' : tk.v.toLowerCase();
    if (w.startsWith('data_')){ cur = { name: tk.v.slice(5), items: {}, loops: [] }; blocks.push(cur); inSave = false; i++; continue; }
    if (w.startsWith('save_')){ inSave = w !== 'save_'; i++; continue; }
    if (w === 'global_'){ cur = null; i++; continue; }
    if (!cur || inSave){ i++; continue; }
    if (w === 'loop_'){
      i++;
      const tags = [], vals = [];
      while (i < toks.length && isTag(toks[i])) tags.push(normTag(toks[i++].v));
      while (i < toks.length && !isTag(toks[i]) && !isKey(toks[i])) vals.push(toks[i++]);
      cur.loops.push(makeLoop(tags, vals, warnings));
      continue;
    }
    if (isTag(tk)){
      const nx = toks[i+1];
      if (nx && !isTag(nx) && !isKey(nx)){ cur.items[normTag(tk.v)] = nx.v; i += 2; }
      else { cur.items[normTag(tk.v)] = '?'; i++; }
      continue;
    }
    i++;   // a stray value outside any tag or loop
  }
  return { blocks, warnings };
}
// A column of values, whether the tag is a single item or in a loop; null when absent.
function column(block, tag){
  if (Object.prototype.hasOwnProperty.call(block.items, tag)) return [block.items[tag]];
  for (const lp of block.loops){ const k = lp.tags.indexOf(tag); if (k >= 0) return lp.rows.map(r => r[k]); }
  return null;
}
const isNull = v => v == null || v === '?' || v === '.';
// The first of the tags with a real value.
function item(block, ...tags){
  for (const t of tags){ const c = column(block, t); if (c && c.length && !isNull(c[0])) return c[0]; }
  return null;
}
// '3.905(2)' → 3.905; '1/3' (not CIF, but written) → 0.3333…; '?' and '.' → NaN.
function num(v){
  if (isNull(v)) return NaN;
  const s = String(v).trim();
  let m = /^([+-]?\d+)\/(\d+)$/.exec(s);
  if (m) return +m[1] / +m[2];
  m = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(s);
  return m ? parseFloat(m[0]) : NaN;
}

// 'Sr1 Ti1 O3', 'Ti O2', 'Ca0.5 Sr0.5 Ti O3' → {Sr:1, Ti:1, O:3}; deuterium counts as H
// (as in the scattering tables). null when nothing reads as an element.
function parseFormula(str){
  if (typeof str !== 'string') return null;
  const out = {};
  let any = false;
  for (const m of str.matchAll(/([A-Z][a-z]?)\s*(\d+\.?\d*|\.\d+)?/g)){
    const el = m[1] === 'D' ? 'H' : m[1];
    if (!(atomicMass(el) > 0)) continue;
    out[el] = (out[el] || 0) + (m[2] ? parseFloat(m[2]) : 1);
    any = true;
  }
  return any ? out : null;
}
const formulaText = f => Object.keys(f).map(el => el + (Math.abs(f[el] - 1) < 1e-9 ? '' : fmtCount(f[el]))).join('');

// The crystal system a space group names: from its IT number, else from an H-M symbol with
// its parts spaced as CIFs write them ('P 42/m n m', 'F m -3 m', 'P 1 21/c 1', 'R -3 m :H').
// null where the symbol does not say for sure: a compact 'P4332' is cubic, 'P4322' tetragonal.
/* Is the named group centrosymmetric? From the IT number; else from the symbol: a '/' (an
   axis with a mirror normal to it), −1 or −3 (m-3, Fd-3m, R-3c…), or an orthorhombic
   symbol of mirrors and glides alone (Pnma). Anything else (Fm3m, an old notation) →
   null: not known, not checked. */
const CENTRED_IT = new Set([5, 8, 9, 12, 15, 20, 21, 22, 23, 24, ...Array.from({ length: 12 }, (_, i) => 35 + i), ...Array.from({ length: 12 }, (_, i) => 63 + i),
  79, 80, 82, 87, 88, 97, 98, 107, 108, 109, 110, 119, 120, 121, 122, 139, 140, 141, 142, 146, 148, 155, 160, 161, 166, 167,
  196, 197, 199, 202, 203, 204, 206, 209, 210, 211, 214, 216, 217, 219, 220, 225, 226, 227, 228, 229, 230]);
const CENTRO_IT = [[2, 2], [10, 15], [47, 74], [83, 88], [123, 142], [147, 148], [162, 167], [175, 176], [191, 194], [200, 206], [221, 230]];
function centroOf(hm, n){
  if (n >= 1 && n <= 230) return CENTRO_IT.some(([a, b]) => n >= a && n <= b);
  if (!hm) return null;
  const body = hm.trim().replace(/\s*:.*$/, '').slice(1).replace(/\s+/g, '');
  if (/\/|-1|-3/.test(body)) return true;
  if (symbolSystem(hm, null) === 'orthorhombic' && !/\d/.test(body)) return true;
  return null;
}
function symbolSystem(hm, itNumber){
  const n = itNumber;
  if (n >= 1 && n <= 230) return n <= 2 ? 'triclinic' : n <= 15 ? 'monoclinic' : n <= 74 ? 'orthorhombic' : n <= 142 ? 'tetragonal' : n <= 167 ? 'trigonal' : n <= 194 ? 'hexagonal' : 'cubic';
  if (!hm) return null;
  const parts = hm.trim().replace(/\s*:.*$/, '').slice(1).trim().split(/\s+/).filter(Boolean), p0 = parts[0];
  if (!p0) return null;
  if (parts.length >= 2 && /3/.test(parts[1])) return 'cubic';
  if (/^-?3/.test(p0)) return 'trigonal';
  if (/6/.test(p0)) return 'hexagonal';
  if (parts.length === 1){
    if (/^-?1$/.test(p0)) return 'triclinic';
    if (/^(21?|[mcnab]|21?\/[mcnab])$/.test(p0)) return 'monoclinic';
    return /4/.test(p0) && !/3/.test(p0) ? 'tetragonal' : null;
  }
  if (/4/.test(p0)) return 'tetragonal';
  if (parts.length === 3) return parts.filter(p => p !== '1').length === 1 ? 'monoclinic' : 'orthorhombic';
  return null;
}
// A count: whole within 1e-6, else to three decimals, or more where three would read as a whole
// number (95.9996 is not 96 in a message that says the two differ; a dopant's 0.0004 is not 0).
function fmtCount(n){
  if (Math.abs(n - Math.round(n)) < 1e-6) return String(Math.round(n));
  let d = 3;
  while (d < 6 && Math.abs(+n.toFixed(d) - Math.round(n)) < 1e-12) d++;
  return String(+n.toFixed(d));
}

// Equivalent isotropic B from an anisotropic U or B tensor (Fischer & Tillmanns 1988):
// Ueq = ⅓ Σ_ij U^ij a*_i a*_j (a_i·a_j), which is the mean of U11, U22, U33 only for
// orthogonal axes.
function equivIso(Uij, G, Gs){
  const as = [Math.sqrt(Gs[0]), Math.sqrt(Gs[4]), Math.sqrt(Gs[8])];
  const [u11,u22,u33,u12,u13,u23] = Uij;
  const U = [u11,u12,u13, u12,u22,u23, u13,u23,u33];
  let s = 0;
  for (let i=0;i<3;i++) for (let j=0;j<3;j++) s += U[3*i+j]*as[i]*as[j]*G[3*i+j];
  return s/3;
}

// CIF text → { name, block, cell (with dG, its rounding, when its digits hide some), hm,
// itNumber, hall, ops, sites, formulaSum, formula, Z, defaultB (the labels of the sites given
// no displacement parameter), warnings }. Reads the first data block that has fractional atom
// sites. Throws (with a message for the user) when the file has no data block, no such atom
// sites, or no cell: whatever it returns is usable. Everything else it can work around is in
// `warnings`.
function parseCif(text){
  const { blocks, warnings: lexWarnings } = cifBlocks(String(text ?? ''));
  if (!blocks.length) throw new Error('Not a CIF: no data_ block found.');
  const withAtoms = blocks.filter(b => column(b, '_atom_site_fract_x'));
  if (!withAtoms.length){
    const cart = blocks.some(b => column(b, '_atom_site_cartn_x'));
    throw new Error(cart ? 'The CIF gives only Cartesian atom coordinates; fractional coordinates (_atom_site_fract_x) are needed.'
                         : 'No atom sites in the CIF (_atom_site_fract_x).');
  }
  const b = withAtoms[0];
  const warnings = lexWarnings.slice();
  if (withAtoms.length > 1) warnings.push(`The file holds ${withAtoms.length} structures: the first, data_${b.name}, is used.`);

  // Cell
  const cell = {
    a: num(item(b, '_cell_length_a')), b: num(item(b, '_cell_length_b')), c: num(item(b, '_cell_length_c')),
    alpha: num(item(b, '_cell_angle_alpha')), beta: num(item(b, '_cell_angle_beta')), gamma: num(item(b, '_cell_angle_gamma')),
  };
  if (!(cell.a > 0 && cell.b > 0 && cell.c > 0)) throw new Error('The CIF has no complete unit cell (_cell_length_a, _b, _c).');
  const noAngle = ['alpha','beta','gamma'].filter(k => !(cell[k] > 0 && cell[k] < 180));

  // Symmetry
  const hm = item(b, '_space_group_name_h-m_alt', '_symmetry_space_group_name_h-m', '_space_group_name_h-m');
  const hall = item(b, '_space_group_name_hall', '_symmetry_space_group_name_hall');
  const itn = num(item(b, '_space_group_it_number', '_symmetry_int_tables_number'));
  const itNumber = itn >= 1 && itn <= 230 ? Math.round(itn) : null;
  const opsCol = column(b, XYZ_TAGS[0]) || column(b, XYZ_TAGS[1]);
  const read = col => { const out = []; for (const s of col || []){ if (isNull(s)) continue; try { out.push(readSymop(s)); } catch(e){ warnings.push(e.message + ' It is ignored.'); } } return out; };
  let [ops] = symopsOf([read(opsCol)]);
  /* A magnetic CIF (MAGNDATA, ISODISTORT) gives its group as operations and centrings with
     time reversal: the space-group operations are every centring times every operation,
     time reversal dropped (it does not move the atoms, and the moments scatter X-rays
     negligibly); the pairs that differ only by it are one. A superspace (incommensurate)
     one cannot be read here. */
  const magName = item(b, '_space_group_magn_name_bns', '_space_group_magn_number_bns', '_space_group_magn_name_og', '_space_group_magn_number_og');
  const parent = item(b, '_parent_space_group_name_h-m_alt', '_parent_space_group_it_number');
  const magOps = column(b, MAGN_TAGS[0]);
  if (column(b, '_space_group_symop_magn_ssg_operation_algebraic') || column(b, '_space_group_symop_magn_ssg_centering_algebraic'))
    throw new Error('A magnetic CIF of a modulated (superspace) structure: its operations are not read here. A CIF of its average structure, or of a commensurate approximant, is needed.');
  if (!ops.length && magOps){
    const [g, cen] = symopsOf([read(magOps), read(column(b, MAGN_TAGS[1]))]);
    for (const c of cen.length ? cen : [{ R: IDENT, t: [0, 0, 0] }]) for (const o of g){
      const Rt = apply3(c.R, o.t), w = c.w || o.w ? allowance(c.R, o.w || [0, 0, 0], c.w || [0, 0, 0]) : null;
      ops.push({ R: mul3(c.R, o.R), t: [0, 1, 2].map(i => w ? mod1(Rt[i] + c.t[i]) : snapT(Rt[i] + c.t[i])), ...(w ? { w } : {}) });
    }
    if (ops.length) warnings.push(`A magnetic CIF${magName ? ` (${String(magName).trim()})` : ''}: its ${uniqueOps(ops).length} space-group operations are taken, without time reversal; the magnetic moments are not used (they scatter X-rays negligibly).`);
  }
  ops = uniqueOps(ops);
  // The rounding the written cell may hide: half a unit of the last decimal. Exact: a length
  // with one decimal or none (as roundingOf), an angle of 60, 90 or 120°, or a whole one. An
  // angle to 0.1° (older structures: β = 104.5(2)°) is a measurement: counted exact, the 530
  // settings in a random basis, lengths to three decimals, kept their point group in 134 of 265.
  const half = (v, dmin) => { const d = decimalsOf(v); return d >= dmin && d !== Infinity ? 0.5*Math.pow(10, -d) : 0; };
  const eLen = ['a', 'b', 'c'].map(k => half(item(b, '_cell_length_' + k), 2)), eAngOf = new Map();
  for (const k of ['alpha', 'beta', 'gamma']) if (!noAngle.includes(k)) eAngOf.set(cell[k], [60, 90, 120].includes(cell[k]) ? 0 : half(item(b, '_cell_angle_' + k), 1));
  const eAng = c => ['alpha', 'beta', 'gamma'].map(k => eAngOf.get(c[k]) || 0);
  /* A missing or invalid angle: the one the operations require, when they leave a single
     choice among 90°, 120°, 60° and the angles given (every R keeps the metric, RᵀGR = G,
     within the holohedry's tolerance: 1e-4, or the rounding of the written cell where larger);
     else 90°.
     A hexagonal file without γ read 90° up to v426, and its 3- and 6-fold operations then
     merged reflections of different d. Monoclinic β, or any angle a triclinic file omits, the
     operations do not fix: 90°, warned as before. */
  if (noAngle.length){
    const cands = [...new Set([90, 120, 60, ...eAngOf.keys()])];
    const combos = noAngle.reduce((acc, k)=> acc.flatMap(c => cands.map(v => ({ ...c, [k]: v }))), [{}]);
    const fits = ops.some(o => !isIdent(o.R)) ? combos.filter(c =>{
      const tc = { ...cell, ...c }, { G, V } = metric(tc);
      if (!(V > 1e-6*tc.a*tc.b*tc.c)) return false;
      const dG = metricRounding(tc, eLen, eAng(tc)), col = (R, i) => [R[i], R[3 + i], R[6 + i]];
      // (RᵀGR)_ij = r_iᵀ G r_j, r_i the columns of R
      return ops.every(({ R }) => [0, 1, 2].every(i => [0, 1, 2].every(j =>
        Math.abs(qf(G, col(R, i), col(R, j)) - G[3*i + j]) <= Math.max(1e-4*Math.sqrt(G[4*i]*G[4*j]), dGuv(dG, col(R, i), col(R, j), [i, j])))));
    }) : [];
    const pick = fits.length === 1 ? fits[0] : null;
    for (const k of noAngle){
      cell[k] = pick ? pick[k] : 90;
      warnings.push(pick ? `No valid _cell_angle_${k}: ${cell[k]}°, the angle the symmetry operations require.` : `No valid _cell_angle_${k}: 90° assumed.`);
    }
  }
  // Each angle may lie in (0, 180°) and the three still close no cell (120/120/120°
  // gives V = 0, 60/60/130° a negative G determinant): every d would be NaN.
  const { G, Gs, V } = metric(cell);
  if (!(V > 1e-6*cell.a*cell.b*cell.c)) throw new Error(`The cell angles α, β, γ = ${cell.alpha}°, ${cell.beta}°, ${cell.gamma}° do not form a unit cell.`);
  { const dG = metricRounding(cell, eLen, eAng(cell)); if (dG) cell.dG = dG; }
  const isP1 = s => /^p\s*1$/i.test(s.trim());
  // (a magnetic group by its BNS or OG name or number, P1 being '1.1'; or its parent space group)
  const named = (hm && !isP1(hm)) || itNumber > 1 || (hall && !isP1(hall)) || (magName && !isP1(String(magName)) && String(magName).trim() !== '1.1')
    || (parent && !isP1(String(parent)) && String(parent).trim() !== '1');
  if (ops.length){
    const idIdx = ops.findIndex(o => o.R.every((v, i) => v === IDENT[i]) && o.t.every(v => !v));
    if (idIdx < 0){ warnings.push('The symmetry operations do not include the identity: it is added.'); ops.unshift({ R: IDENT.slice(), t: [0,0,0] }); }
    else if (idIdx > 0) ops.unshift(ops.splice(idIdx, 1)[0]);
    const miss = closureMisses(ops);
    if (miss.length) warnings.push(`The ${ops.length} symmetry operations do not form a group (e.g. ${symopString(miss[0])} is missing): the list looks incomplete, check the CIF.`);
    // A centred symbol needs its centring translations in the list.
    const L = hm ? hm.trim()[0].toUpperCase() : '';
    // (an R group in hexagonal axes: γ = 120° within 0.01° and its written digits)
    const hexAx = Math.abs(cell.gamma - 120) < 0.01 + cellSlack(cell).ang[2];
    const want = { I:1, A:1, B:1, C:1, F:3 }[L] ?? (L === 'R' && hexAx ? 2 : 0);
    const have = ops.filter(o => o.R.every((v, i) => v === IDENT[i]) && o.t.some(v => v)).length;
    if (want && have < want) warnings.push(`${hm.trim()} is centred but the operations hold ${have} of its ${want} centring translation${want > 1 ? 's' : ''}: the cell will be filled incompletely.`);
  }

  // Anisotropic displacements, by label, for sites without an isotropic value.
  const aniso = new Map();
  const aLab = column(b, '_atom_site_aniso_label');
  if (aLab){
    const comps = ['11','22','33','12','13','23'];
    const useU = !!column(b, '_atom_site_aniso_u_11');
    const cols = comps.map(k => column(b, (useU ? '_atom_site_aniso_u_' : '_atom_site_aniso_b_') + k));
    if (cols[0]) aLab.forEach((lab, r)=>{
      const v = cols.map(c => c ? num(c[r]) : 0).map(x => Number.isFinite(x) ? x : 0);
      const eq = equivIso(v, G, Gs);
      if (eq > 0) aniso.set(lab, useU ? EIGHT_PI2*eq : eq);
    });
  }

  // Atom sites
  const fx = column(b, '_atom_site_fract_x'), fy = column(b, '_atom_site_fract_y'), fz = column(b, '_atom_site_fract_z');
  const n = fx.length;
  const col = tag => { const c = column(b, tag); return c && c.length === n ? c : null; };
  const lab = col('_atom_site_label'), typ = col('_atom_site_type_symbol'), occ = col('_atom_site_occupancy');
  const bIso = col('_atom_site_b_iso_or_equiv'), uIso = col('_atom_site_u_iso_or_equiv');
  const flag = col('_atom_site_calc_flag'), mult = col('_atom_site_symmetry_multiplicity');
  // Without a type symbol (or with one that names no species) the label is read, the
  // formula's elements choosing between its readings ('HO1': Ho, or an H on O1).
  const fEls = (f => f && new Set(Object.keys(f)))(parseFormula(item(b, '_chemical_formula_sum')));
  const sites = [], written = [], defaultB = [], fallback = [], mixed = [], doubt = [];
  for (let i = 0; i < n; i++){
    const label = lab && !isNull(lab[i]) ? lab[i] : `${typ && !isNull(typ[i]) ? typ[i] : 'X'}${i+1}`;
    if (flag && /^dum/i.test(flag[i] || '')) continue;   // dummy atoms (ring centroids, …)
    const typed = !!(typ && !isNull(typ[i])), type = typed ? typ[i] : label;
    // (a type symbol decides even when it repeats the label: 'Ho' typed Ho is holmium)
    let sp = typed ? speciesKey(type) : null;
    if (!sp){
      sp = labelSpecies(label, fEls);
      if (sp && sp.alt) doubt.push(`${label} as ${sp.element} (or ${sp.alt})`);
      else if (sp && sp.inFormula === false) doubt.push(`${label} as ${sp.element}, which the formula lacks`);
    }
    if (!sp){ warnings.push(`Site ${label}: no X-ray scattering factor for '${type}', the site is left out.`); continue; }
    if (sp.fallback) fallback.push(`${type} (${label}), taken as ${sp.key === sp.element ? 'the neutral atom' : sp.key} (${Number.isFinite(sp.charge) ? 'the nearest tabulated charge' : 'its charge not read'})`);
    else if (sp.mix) mixed.push(`${type} (${label}) as ${sp.mix.map(([k, w])=> `${+w.toFixed(3)} ${k}`).join(' + ')}`);
    const x = num(fx[i]), y = num(fy ? fy[i] : null), z = num(fz ? fz[i] : null);
    if (![x, y, z].every(Number.isFinite)){ warnings.push(`Site ${label}: incomplete coordinates, the site is left out.`); continue; }
    // Missing, '?' or '.': 1 (the dictionary's default). A negative one, a refined occupancy
    // of an all but empty site (−0.02(3)), is 0 (v426 made it 1: the site full). Above 1 by
    // more than a rounding at three decimals, warned and kept.
    let o = occ ? num(occ[i]) : 1;
    if (Number.isNaN(o)) o = 1;
    if (o < 0){ warnings.push(`Site ${label}: occupancy ${o} < 0, taken as 0 (the site is empty).`); o = 0; }
    if (o > 1.0005) warnings.push(`Site ${label}: occupancy ${o} > 1.`);
    let B = bIso ? num(bIso[i]) : NaN;
    if (!Number.isFinite(B) && uIso){ const u = num(uIso[i]); if (Number.isFinite(u)) B = EIGHT_PI2*u; }
    if (!Number.isFinite(B) && aniso.has(label)) B = aniso.get(label);
    if (!Number.isFinite(B)){ B = B_DEFAULT; defaultB.push(label); }
    const m = mult ? num(mult[i]) : NaN;
    // D scatters as H (speciesKey) but weighs its own: a deuterated cell would otherwise
    // weigh light in the weight fractions.
    // (Only a species read as hydrogen: 'DY3+' is dysprosium.)
    const deut = sp.element === 'H' && /^d/i.test(String(typ && !isNull(typ[i]) ? typ[i] : label).trim());
    sites.push({ label, type, key: sp.key, element: sp.element, x, y, z, occ: o, Biso: B, mult: m > 0 ? Math.round(m) : null, ...(deut ? { massEl: 'D' } : {}) });
    written.push([fx[i], fy[i], fz[i], occ && o < 1 ? occ[i] : null]);
  }
  if (!sites.length) throw new Error('None of the atom sites in the CIF could be read.');
  if (doubt.length) warnings.push(`Element read from the site label, in doubt: ${doubt.join('; ')}. A _atom_site_type_symbol column (or the formula) would settle it.`);
  // The rounding the coordinates and the occupancies may hide, from their digits (a full
  // site is exact).
  const partial = written.filter(w => w[3] != null);
  const epsXYZ = roundingOf(written.map(w => w.slice(0, 3))), epsOcc = roundingOf(partial.map(w => [w[3]]));
  let ip = 0;
  sites.forEach((s, i)=> { s.eps = epsXYZ[i]; s.occEps = written[i][3] != null ? epsOcc[ip++][0] : 0; });
  if (fallback.length) warnings.push(`No tabulated form factor for ${fallback.join('; ')}.`);
  if (mixed.length) warnings.push(`No tabulated form factor of its own, taken as the tabulated charges around it with the same mean charge: ${mixed.join('; ')}.`);
  if (defaultB.length) warnings.push(`No displacement parameter for ${defaultB.join(', ')}: B = ${B_DEFAULT} Å² assumed.`);
  if (sites.some(s => s.Biso < 0)) warnings.push('Negative displacement parameters in the CIF.');

  const formulaSum = item(b, '_chemical_formula_sum');
  const formula = parseFormula(formulaSum);
  const zz = num(item(b, '_cell_formula_units_z'));
  const Z = zz > 0 ? zz : null;

  /* A space group named without its operations: the sites are then, almost always, only
     the asymmetric unit, and the operations are not generated from the symbol here. Read
     as P1 they would fill the cell in part and give a wrong pattern with no error (rutile:
     2 atoms instead of 6, orthorhombic, (211) the strongest line). So the file is refused
     unless the listed atoms are evidently the whole cell: they match the formula × Z given,
     or they show by themselves the crystal system and the lattice centring the symbol
     names. (A lone special position can still pass that test: a site alone in its cell
     shows the lattice's full symmetry.) The formula × Z is evidence only with Z given:
     without it, Z is inferred from the atoms, and an asymmetric unit that holds whole
     formula units passes by construction (NaCl named Fm-3m, given as Na and Cl, read as
     one formula unit in P1). A list holding the identity alone, x, y, z, is the same
     case as none. A centrosymmetric symbol also wants the centre of symmetry: an
     asymmetric unit of P-1 in general positions shows every triclinic P lattice. */
  const onlyIdentity = ops.length === 1 && ops[0].R.every((v, i) => v === IDENT[i]) && ops[0].t.every(v => !v);
  if ((!ops.length || onlyIdentity) && named){
    const atoms = expandAtoms([], sites), comp = checkComposition(atoms, formula, Z);
    let whole = comp.checked && comp.ok;
    const why = [];
    if (comp.checked && !comp.ok) why.push(`the atoms fill the cell with ${Object.keys(comp.found).map(el => `${el} ${fmtCount(comp.found[el])}`).join(', ')}, not the formula × Z`);
    else if (!comp.checked || !(Z > 0)){
      // The lattice letter from the H-M symbol, else from the Hall symbol ('-F 4 2 3'); with
      // only the IT number, whether the lattice is centred at all.
      const hallM = hall ? /^\s*(-?)\s*([pabcifr])/i.exec(hall) : null;
      const want = symbolSystem(hm, itNumber), letter = hm && /^[pabcifr]/i.test(hm.trim()) ? hm.trim()[0].toUpperCase() : hallM ? hallM[2].toUpperCase() : null;
      const sym = findSymmetry(cell, atoms);
      const sysOk = !want || sym.system === want || (want === 'trigonal' && sym.system === 'hexagonal');
      const sl = cellSlack(cell), hexAxes = Math.abs(cell.gamma - 120) < 0.01 + sl.ang[2] && same(cell.a, cell.b, sl.len[0] + sl.len[1]);
      const wantC = letter === 'R' ? (hexAxes ? 'R' : 'P') : letter;
      const centredIT = itNumber && CENTRED_IT.has(itNumber) && !(itNumber >= 143 && itNumber <= 167 && !hexAxes);
      const cenOk = wantC ? sym.centring === wantC : !centredIT || sym.centring !== 'P';
      const centro = centroOf(hm, itNumber) || (hallM && hallM[1] === '-');
      const invOk = !centro || sym.ops.some(o => o.R.every((v, i) => v === -IDENT[i]));
      whole = sysOk && cenOk && invOk;
      if (!sysOk) why.push(`the atoms show ${sym.system} symmetry, the symbol ${want}`);
      if (!cenOk) why.push(`the atoms lack the ${wantC || 'lattice'} centring`);
      if (!invOk) why.push('the atoms lack the centre of symmetry the symbol has');
    }
    const groupName = hm ? `the space group ${hm.trim()}` : hall ? `the space group ${hall.trim()}` : itNumber ? `the space group No. ${itNumber}`
      : magName ? `the magnetic group ${String(magName).trim()}` : `a magnetic group (parent ${String(parent).trim()})`;
    if (!whole) throw new Error(`The CIF names ${groupName} but lists ${onlyIdentity ? 'only the identity (x, y, z) as its symmetry operations' : 'no symmetry operations'}, and they are not generated from the symbol: the ${sites.length} site${sites.length > 1 ? 's' : ''} given cannot be the whole cell (${why.join('; ')}). A CIF with its operations (_space_group_symop_operation_xyz${magName || parent ? '; in a magnetic CIF, _space_group_symop_magn_operation.xyz' : ''}) is needed: COD, ICSD and the Materials Project (symmetrized CIF) give them${magName || parent ? ', MAGNDATA the magnetic ones' : ''}.`);
    warnings.push(`The CIF lists ${onlyIdentity ? 'only the identity (x, y, z) as its symmetry operation' : 'no symmetry operations'}${hm ? ` for ${hm.trim()}` : ''}: the atoms are taken as they are (P1), so the cell is filled only if they are all listed.`);
  }
  const name = item(b, '_chemical_name_mineral') || item(b, '_chemical_formula_structural')
    || (formula ? formulaText(formula) : null) || item(b, '_chemical_name_common') || b.name;
  return { name: String(name).trim(), block: b.name, cell, hm: hm ? hm.trim() : null, itNumber, hall: hall ? hall.trim() : null,
           ops, sites, formulaSum: formulaSum ? formulaSum.trim() : null, formula, Z, defaultB, warnings };
}

/* ---------- cell contents ---------- */
// Every site's orbit under the operations, positions in [0, 1), site by site — so a site on
// a special position gets its true multiplicity, and two sites sharing a position (a mixed
// occupancy) both stay. No operations = P1. The site's own operations are found within the
// rounding its written coordinates may hide (roundingOf: '0.33, 0.67' is 1/3, 2/3 to its
// two decimals, which 1e-3 alone missed: Mg in P6₃/mmc came out 6 atoms instead of 2), the
// site is moved onto the special position they fix, and its orbit is that point's. Each
// atom carries the rounding findSymmetry may allow it (`eps`, fractions per axis): its site's
// in a file without operations (P1); none with operations, under which the atoms are exact
// images of each other and whose group the file names, so findSymmetry finds that group
// exactly and more only within its plain tolerance, as up to v425 (with the rounding allowed,
// a polar P4mm structure written with two decimals on c = 3 Å came out P4/mmm).
function expandAtoms(ops, sites, tol = 1e-3){
  const list = ops && ops.length ? ops : [{ R: IDENT, t: [0,0,0] }];
  // Inclusive (plus rounding slack): a special position written with three decimals,
  // 0.333/0.667, yields images exactly 0.001 apart that are still one position.
  const lim = tol + 1e-7;
  const one = (d, b) => beyond(d, b).every(v => Math.abs(v) <= lim);
  const eps = epsOf(sites), out = [];
  sites.forEach((s, si)=>{
    const sp = s.key && s.element ? null : speciesKey(s.type || s.label || '');
    const key = s.key || (sp ? sp.key : undefined), element = s.element || (sp ? sp.element : undefined);
    const x = [s.x, s.y, s.z], e = eps[si];
    // The candidates, nearest first: d = R·x + t − x within the rounding (the site's, and the
    // operation's own when its translation was written with decimals that are no 1/24).
    const S = [];
    for (const { R, t, w } of list){
      const y = apply3(R, x), d = [0, 1, 2].map(i => { const v = y[i] + t[i] - x[i]; return v - Math.round(v); });
      if (one(d, allowance(R, e, w ? e.map((v, i)=> v + w[i]) : e))) S.push({ R, t, w, d, far: Math.max(...d.map(Math.abs)) });
    }
    S.sort((p, q)=> p.far - q.far);
    // They are the site's own operations when some point they all fix rounds to x as written
    // (the point of their fixed set nearest x, on the scale of each axis's rounding, lies
    // within it), or when each takes x within tol of itself (v425's rule). Else the farthest
    // is dropped. A tie (a point at the edge of the rounding) counts only on a fixed
    // coordinate, a multiple of 1/24: 1/8 written '0.13' is ⅛, but two decimals leave a
    // general position of Fd-3m at (0.95, 0.83, 0.41) at the edge of the mirror y + z = ¼.
    let xm = x;
    for (; S.length > 1; S.pop()){
      const dx = nearestFixed(S, e);
      const xs = x.map((v, i)=> v + dx[i]);
      const within = (v, i) => Math.abs(v) < e[i] - 1e-9 || (Math.abs(v) <= e[i] + 1e-9 && Math.abs(xs[i]*24 - Math.round(xs[i]*24)) < 1e-6);
      const inBox = dx.every(within) || S.every(o => o.far <= lim);
      const fixes = S.every(({ R, t, w }) => { const q = apply3(R, xs); return [0, 1, 2].every(i => { const v = q[i] + t[i] - xs[i]; return Math.abs(v - Math.round(v)) < 1e-7 + (w ? 2*w[i] : 0); }); });
      // (an exact special position is left bit for bit as written)
      if (inBox && fixes){ if (dx.some(v => Math.abs(v) > 1e-12)) xm = xs; break; }
    }
    const pos = [], Z = [0, 0, 0];
    for (const { R, t, w } of list){
      const q = apply3(R, xm);
      const p = [mod1(q[0] + t[0]), mod1(q[1] + t[1]), mod1(q[2] + t[2])];
      if (!pos.some(o => one([p[0] - o[0], p[1] - o[1], p[2] - o[2]], w || o.w ? allowance(IDENT, w || Z, o.w || Z) : Z))){ if (w) p.w = w; pos.push(p); }
    }
    for (const p of pos) out.push({ site: si, label: s.label, key, element, x: p[0], y: p[1], z: p[2],
      occ: s.occ ?? 1, Biso: s.Biso ?? B_DEFAULT, cifMult: s.mult ?? null, eps: list.length > 1 ? p.w || [0, 0, 0] : e,
      ...(s.occEps ? { occEps: s.occEps } : {}), ...(s.massEl ? { massEl: s.massEl } : {}) });
  });
  return out;
}

// { element: atoms per cell, weighted by occupancy }.
function cellContents(atoms){
  const out = {};
  for (const a of atoms) out[a.element] = (out[a.element] || 0) + (a.occ ?? 1);
  return out;
}
// Mass of the cell contents (g/mol per cell, i.e. Z·M), for Hill–Howard weight fractions.
function cellMass(atoms){
  let m = 0;
  for (const a of atoms) m += (a.occ ?? 1)*atomicMass(a.massEl || a.element);
  return m;
}

// The rounding each element's count in a written formula may hide (roundingOf, the counts as
// one row): 'Ca0.33 Sr0.67 Ti O3' 0.005 each.
function formulaRounding(f){
  const ms = typeof f === 'string' ? [...f.matchAll(/([A-Z][a-z]?)\s*(\d+\.?\d*|\.\d+)?/g)].map(m => [m[1] === 'D' ? 'H' : m[1], m[2] || '1']).filter(([el]) => atomicMass(el) > 0)
           : f ? Object.keys(f).map(el => [el, String(f[el])]) : [];
  const eps = ms.length ? roundingOf([ms.map(m => m[1])])[0] : [], out = {};
  ms.forEach(([el], i)=> { out[el] = (out[el] || 0) + eps[i]; });
  return out;
}

/* Does the filled cell hold formula × Z? A mismatch is the signature of coordinates written
   for one origin choice (or setting) read with the operations of another — the anatase
   I4₁/amd origin-1 coordinates with origin-2 operations give Ti8 O16 instead of Ti4 O8 —
   or of an incomplete operation list, or of sites left out. Each element's count may lie
   anywhere from Σ occ (as written) to the count with every partly occupied site full (a
   refined vacancy, O 0.98 in a nominal 'Sr Ti O3', is within), widened by what the written
   occupancies and the formula's numbers may hide (half a unit of their last decimal). A
   whole site missing is then off however large the cell: up to v425 2 % passed, and Si48O95
   passed as SiO2 × 48. Without Z, Z is the whole number that fits every element of the
   formula; when none does, the nearest one is compared, and the check fails (v425 inferred
   Z from the most abundant element alone, and skipped the check when it had no atom). The
   CIF's own site multiplicities, when given, are compared too: they are the most direct
   evidence. H missing from the sites (not located by X-rays) is only noted.
   → { ok, checked, expected, found, Z, message, note (when ok only by counting partly
       occupied sites full) }. */
function checkComposition(atoms, formulaSum, Z){
  const found = cellContents(atoms), full = {}, occSlack = {};
  const occE = roundingOf(atoms.filter(a => a.occEps == null && (a.occ ?? 1) < 1).map(a => [String(a.occ)]));
  let ie = 0;
  for (const a of atoms){
    const o = a.occ ?? 1, el = a.element;
    full[el] = (full[el] || 0) + Math.max(1, o);
    occSlack[el] = (occSlack[el] || 0) + (a.occEps != null ? a.occEps : o < 1 ? occE[ie++][0] : 0);
  }
  const fmt = o => Object.keys(o).map(el => `${el} ${fmtCount(o[el])}`).join(', ');
  const msgs = [];
  let ok = true, checked = false, note = null;

  const bySite = new Map();
  for (const a of atoms){
    const e = bySite.get(a.site) || { label: a.label, n: 0, mult: a.cifMult };
    e.n++; bySite.set(a.site, e);
  }
  const badMult = [...bySite.values()].filter(e => e.mult > 0 && e.n !== e.mult);
  if ([...bySite.values()].some(e => e.mult > 0)) checked = true;
  if (badMult.length){
    ok = false;
    msgs.push(`Site multiplicities differ from the CIF's: ${badMult.map(e => `${e.label} ${e.n} (CIF ${e.mult})`).join(', ')}.`);
  }

  const formula = typeof formulaSum === 'string' ? parseFormula(formulaSum) : formulaSum;
  let expected = null, z = Z > 0 ? Z : null;
  if (formula && Object.keys(formula).length){
    const els = Object.keys(formula), fe = formulaRounding(formulaSum);
    const noH = formula.H && !found.H;
    const cmp = els.filter(el => !(noH && el === 'H'));
    // What element el may count, in atoms: [lo, hi], and the formula's rounding × z.
    const lo = el => (found[el] || 0) - (occSlack[el] || 0) - 1e-6, hi = el => (full[el] || 0) + (occSlack[el] || 0) + 1e-6;
    if (!z){
      // Every element bounds Z; the whole number in all the bounds nearest the least-squares
      // ratio, else the nearest whole number (which then fails).
      let zlo = 0, zhi = Infinity;
      for (const el of cmp){
        const f = formula[el], e = fe[el] || 0;
        zlo = Math.max(zlo, lo(el)/(f + e)); zhi = Math.min(zhi, f > e ? hi(el)/(f - e) : Infinity);
      }
      const r = cmp.reduce((m, el)=> m + (found[el] || 0)*formula[el], 0)/cmp.reduce((m, el)=> m + formula[el]*formula[el], 0);
      const zi = Math.min(Math.max(Math.round(r), Math.ceil(zlo), 1), Math.floor(zhi));
      if (zi >= 1 && zi >= zlo && zi <= zhi){ z = zi; msgs.push(`Z not given: ${zi} from the cell contents.`); }
      else {
        z = Math.max(1, Math.round(r));
        msgs.push(`Z not given, and no whole number of formula units fits the cell contents${zlo <= zhi ? ` (they hold ${fmtCount(+r.toFixed(3))}: give Z in the CIF if it is not whole)` : ''}: compared with the nearest, ${z}.`);
      }
    }
    if (z){
      checked = true;
      expected = {};
      for (const el of els) expected[el] = formula[el]*z;
      const allEls = [...new Set([...cmp, ...Object.keys(found)])];
      const off = allEls.filter(el => { const e = expected[el] || 0, s = z*(fe[el] || 0); return e + s < lo(el) || e - s > hi(el); });
      if (off.length){
        ok = false;
        // One factor k for every element, and not 1 (a whole cell read twice, or half of one):
        // some k puts k × the formula × Z within every element's bounds. v426 asked every
        // ratio within 2 % of the first, which a large cell passes with a site missing
        // (Y24Al40O95 read as 2 × Y3Al5O12 × 4) and a vacancy of a doubled cell may not.
        let klo = 0, khi = Infinity;
        for (const el of allEls){
          const e = expected[el] || 0, sl = z*(fe[el] || 0);
          if (!(e > 0)){ klo = Infinity; break; }
          klo = Math.max(klo, lo(el)/(e + sl)); khi = Math.min(khi, e > sl ? hi(el)/(e - sl) : Infinity);
        }
        const uniform = klo <= khi && !(klo <= 1 && 1 <= khi);
        const r0 = Math.min(Math.max(allEls.reduce((m, el)=> m + (found[el] || 0)*(expected[el] || 0), 0)/allEls.reduce((m, el)=> m + (expected[el] || 0)**2, 0), klo), khi);
        msgs.push(`The symmetry operations fill the cell with ${fmt(found)}, but ${formulaText(formula)} × Z = ${fmtCount(z)} is ${fmt(expected)}`
          + (uniform ? ` (every element ${fmtCount(+r0.toFixed(3))}× the formula: Z is wrong, or the coordinates belong to another origin choice or setting than the operations).`
                     : '. The coordinates and the symmetry operations may belong to different origin choices or settings, or sites are missing.'));
      } else {
        msgs.unshift(`Cell contents ${fmt(found)} = ${formulaText(formula)} × ${fmtCount(z)}.`);
        // Within only by counting partly occupied sites full (a vacancy against a nominal
        // formula): a partly occupied site left out (half of a split site) reads the same, so
        // it is said.
        const short = cmp.filter(el => (expected[el] || 0) - z*(fe[el] || 0) > (found[el] || 0) + (occSlack[el] || 0) + 1e-6);
        if (short.length){
          note = `the occupancies give ${short.map(el => `${el} ${fmtCount(found[el] || 0)}`).join(', ')}, the formula × Z ${short.map(el => fmtCount(expected[el])).join(', ')}: vacancies on sites the formula counts full, or a partly occupied site is missing`;
          msgs.push(note[0].toUpperCase() + note.slice(1) + '.');
        }
      }
      if (noH) msgs.push('No H atoms in the sites (often not located by X-rays): H left out of the check.');
    }
  }
  if (!checked) msgs.push('No formula (or Z) to compare with: composition not checked.');
  return { ok, checked, expected, found, Z: z, message: msgs.join(' '), ...(note ? { note } : {}) };
}

/* ---------- lattices ---------- */
const tr3 = m => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
const isIdent = m => m.every((v, i) => v === IDENT[i]);
const colsOf = vs => [vs[0][0], vs[1][0], vs[2][0], vs[0][1], vs[1][1], vs[2][1], vs[0][2], vs[1][2], vs[2][2]];
// A shorter basis of the same lattice: an axis is replaced by itself plus integer multiples
// of the others (pairs, then the four ±b_j ± b_k) while that shortens it. The axes keep
// their order, and a reduced cell is left as it is. → P (integer, |det| 1; columns: the
// new axes in the old ones' fractions).
function reduceBasis(G){
  const B = [[1,0,0], [0,1,0], [0,0,1]], dot = (u, v) => qform(G, u.map((x, i)=> x + v[i])) - qform(G, u) - qform(G, v);
  const len = u => qform(G, u);
  for (let pass = 0; pass < 200; pass++){
    let changed = false;
    for (let i = 0; i < 3; i++){
      const [j, k] = [0, 1, 2].filter(m => m !== i);
      let best = null, bl = len(B[i])*(1 - 1e-9);
      const tryV = v => { const l = len(v); if (l < bl){ bl = l; best = v; } };
      for (const m of [j, k]){ const n = Math.round(0.5*dot(B[i], B[m])/len(B[m])); if (n) tryV(B[i].map((x, q)=> x - n*B[m][q])); }
      for (const s of [-1, 1]) for (const u of [-1, 1]) tryV(B[i].map((x, q)=> x + s*B[j][q] + u*B[k][q]));
      if (best){ B[i] = best; changed = true; }
    }
    if (!changed) break;
  }
  return colsOf(B);
}
// A basis of the lattice the integer vectors span (Euclid on one row after another); null
// when they do not span three dimensions. → the basis vectors.
function latticeBasis(vecs){
  let v = vecs.map(c => c.slice()).filter(c => c.some(x => x));
  const out = [];
  for (let r = 0; r < 3; r++){
    for (;;){
      const nz = v.filter(c => c[r]);
      if (nz.length <= 1) break;
      const p = nz.reduce((m, c) => Math.abs(c[r]) < Math.abs(m[r]) ? c : m);
      v = v.map(c => { if (c === p || !c[r]) return c; const k = Math.floor(c[r]/p[r]); return c.map((x, m) => x - k*p[m]); }).filter(c => c.some(x => x));
    }
    const i = v.findIndex(c => c[r]);
    if (i < 0) return null;
    out.push(v.splice(i, 1)[0]);
  }
  return out;
}
/* The metric's holohedry in its own basis: integer matrices that keep it (RᵀGR = G within
   rtol, columns = images of the basis vectors, |det| 1), identity first; at most 48. Built
   column by column from the lattice vectors as long as each axis: such a vector's indices
   are bounded, |n_j| = |a*_j·v| ≤ |a*_j||a_i|, so none is missed in any cell (in a reduced
   one the bound is 1 or 2). */
function holohedryOf(G, rtol = 1e-4, dG = null){
  const Gs = inv3(G);
  const dot = (u, v) => u[0]*(G[0]*v[0]+G[1]*v[1]+G[2]*v[2]) + u[1]*(G[3]*v[0]+G[4]*v[1]+G[5]*v[2]) + u[2]*(G[6]*v[0]+G[7]*v[1]+G[8]*v[2]);
  // (within rtol, or the rounding of the difference uᵀGv − G_ij where that is larger)
  const E = [[1,0,0], [0,1,0], [0,0,1]];
  const cols = [0, 1, 2].map(i =>{
    const b = [0, 1, 2].map(j => Math.max(1, Math.floor(Math.sqrt(G[4*i]*Gs[4*j])*(1 + rtol + dGuv(dG, E[i], E[i])/G[4*i]) + 1e-9))), out = [];
    for (let p = -b[0]; p <= b[0]; p++) for (let q = -b[1]; q <= b[1]; q++) for (let r = -b[2]; r <= b[2]; r++){
      const v = [p, q, r];
      if ((p || q || r) && Math.abs(dot(v, v) - G[4*i]) <= Math.max(rtol*G[4*i], dGuv(dG, v, v, [i, i]))) out.push(v);
    }
    return out;
  });
  const tolIJ = (i, j, u, v) => Math.max(rtol*Math.sqrt(G[4*i]*G[4*j]), dGuv(dG, u, v, [i, j]));
  const out = [];
  for (const c0 of cols[0]) for (const c1 of cols[1]){
    if (Math.abs(dot(c0, c1) - G[1]) > tolIJ(0, 1, c0, c1)) continue;
    for (const c2 of cols[2]){
      if (Math.abs(dot(c0, c2) - G[2]) > tolIJ(0, 2, c0, c2) || Math.abs(dot(c1, c2) - G[5]) > tolIJ(1, 2, c1, c2)) continue;
      const R = [c0[0], c1[0], c2[0],  c0[1], c1[1], c2[1],  c0[2], c1[2], c2[2]];
      if (Math.abs(det3(R)) === 1) out.push(R);
    }
  }
  const id = out.findIndex(isIdent);
  if (id > 0) out.unshift(out.splice(id, 1)[0]);
  return out;
}
/* The holohedry of the lattice with basis B (columns, in the cell's fractions; rational for a
   lattice finer than the cell's), expressed in the cell's basis: found in a reduced basis
   of it and turned back. → { Rs: those integer in the cell (its operations), lost: how many
   are not (the cell, a supercell of that lattice, cannot hold them), basis: the reduced
   basis }. */
function latticeSymmetry(G, B = IDENT, dG = null){
  const P = reduceBasis(mul3(mul3(tr3(B), G), B)), Br = mul3(B, P), Bi = inv3(Br);
  const Rs = [];
  let lost = 0;
  for (const h of holohedryOf(mul3(mul3(tr3(Br), G), Br), 1e-4, dGin(dG, Br))){
    const R = mul3(mul3(Br, h), Bi), Ri = R.map(v => Math.round(v) || 0);
    if (R.every((v, i) => Math.abs(v - Ri[i]) < 1e-6)) Rs.push(Ri); else lost++;
  }
  return { Rs, lost, basis: Br };
}
// The lattice holohedry of a cell: every integer matrix that keeps its metric, identity first,
// then in the order of their columns (first column first, each by its entries): the order of
// v425's search, so the operations come out in the same order wherever it found them all.
function holohedry(G, rtol = 1e-4, dG = null){
  const P = reduceBasis(G), Pi = inv3(P).map(v => Math.round(v) || 0);
  const out = isIdent(P) ? holohedryOf(G, rtol, dG) : holohedryOf(mul3(mul3(tr3(P), G), P), rtol, dGin(dG, P)).map(h => mul3(mul3(P, h), Pi));
  const key = R => [R[0], R[3], R[6], R[1], R[4], R[7], R[2], R[5], R[8]];
  return out.sort((p, q)=>{ if (isIdent(p) !== isIdent(q)) return isIdent(p) ? -1 : 1; const a = key(p), b = key(q); for (let i = 0; i < 9; i++) if (a[i] !== b[i]) return a[i] - b[i]; return 0; });
}

/* ---------- symmetry of a structure ---------- */

// Rotation order of the proper part (det·R) from its trace.
const ROT_ORDER = { 3:1, '-1':2, 0:3, 1:4, 2:6 };
const properOf = R => { const d = det3(R); return R.map(v => v*d); };
const rotOrder = R => { const P = properOf(R); return ROT_ORDER[P[0] + P[4] + P[8]]; };
// True when the proper part of R is a rotation about basis axis i that leaves the other
// two axes in their plane (column i and row i are the unit vector).
function aboutAxis(R, i){
  const P = properOf(R);
  for (let j=0;j<3;j++){ const e = j === i ? 1 : 0; if (P[3*j+i] !== e || P[3*i+j] !== e) return false; }
  return true;
}
// Equal within 1e-4 (the holohedry's floor), and the rounding e of the two values.
const same = (x, y, e = 0) => Math.abs(x - y) <= 1e-4*Math.max(Math.abs(x), Math.abs(y)) + e;
// The rounding of a cell's lengths (Å) and angles (°) from its metric's (dGof): ∂a_i = D_ii/(2a_i),
// ∂θ_jk = −(D_jk/(a_j a_k) − cos θ (D_jj/G_jj + D_kk/G_kk)/2)/sin θ, each term times its e_k;
// zeros for an exact cell.
function cellSlack(cell){
  const dG = dGof(cell), L = [cell.a, cell.b, cell.c], A = [cell.alpha, cell.beta, cell.gamma];
  if (!dG) return { len: [0, 0, 0], ang: [0, 0, 0] };
  return { len: L.map((v, i)=> dG.reduce((m, { D, e })=> m + e*Math.abs(D[4*i])/(2*v), 0)),
           ang: [[1, 2, 0], [0, 2, 1], [0, 1, 2]].map(([j, k, i]) =>{
             const c = cosd(A[i]), s = Math.max(Math.sqrt(1 - c*c), 1e-3);
             return dG.reduce((m, { D, e })=> m + e*Math.abs(D[3*j + k]/(L[j]*L[k]) - c*(D[4*j]/(L[j]*L[j]) + D[4*k]/(L[k]*L[k]))/2)/s, 0)*180/Math.PI;
           }) };
}

// The cell spanned by the columns of M (integer combinations of `cell`'s axes, or the
// inverse relation): metric MᵀGM. Angles within 1e-9° of 60, 90 or 120° are made exact,
// so metric() keeps its true zeros.
const snapAngle = d => { for (const s of [60, 90, 120]) if (Math.abs(d - s) < 1e-9) return s; return d; };
function cellInBasis(cell, M){
  const { G } = metric(cell), Mt = [M[0],M[3],M[6], M[1],M[4],M[7], M[2],M[5],M[8]];
  const g = mul3(mul3(Mt, G), M);
  const len = i => Math.sqrt(g[4*i]);
  const ang = (i, j) => snapAngle(Math.acos(Math.max(-1, Math.min(1, g[3*i+j]/(len(i)*len(j)))))*180/Math.PI);
  return { a: len(0), b: len(1), c: len(2), alpha: ang(1, 2), beta: ang(0, 2), gamma: ang(0, 1), ...(cell.dG ? { dG: dGin(cell.dG, M) } : {}) };
}

/* A cell whose symmetry axes are lattice vectors other than its own axes — most often the
   primitive cell of a centred lattice, as the Materials Project serves its P1 files —
   would otherwise be refined by one scale factor, which freezes c/a (and b/a, β) at the
   file's values: a DFT cell's wrong c/a then goes into the displacement and the widths.
   Its metric is parametrised instead through the conventional cell: lattice vectors along
   the symmetry axes, the columns of an integer matrix M in the given cell's fractions, so
   the conventional metric is MᵀGM and a Miller index goes as h_c = h·M. The atoms, the
   operations and the reflection list stay in the given cell; only the way its six
   parameters follow the refined a, c (or a, b, c, β) changes. The axes are found by exact
   integer tests: u lies on the axis of the proper rotation P when Pu = u, and is
   perpendicular to it when the images of u under the rotations about it sum to zero.
   → { kind, params, unique?, basis: M (row-major), conv: the conventional cell } or null
   when the axes are not among the short lattice vectors (indices up to ±3) of the cell, nor
   of a reduced basis of it (searched second, so the axes are v425's wherever it found them). */
function conventionalBasis(system, Rs, cell){
  const P = reduceBasis(metric(cell).G), cb0 = conventionalIn(system, Rs, cell);
  if (cb0 || isIdent(P)) return cb0;
  const Pi = inv3(P).map(v => Math.round(v) || 0);
  const cb = conventionalIn(system, Rs.map(R => mul3(mul3(Pi, R), P)), cellInBasis(cell, P));
  return cb ? { ...cb, basis: mul3(P, cb.basis) } : null;
}
function conventionalIn(system, Rs, cell){
  const { G } = metric(cell);
  const dot = (u, v) => u[0]*(G[0]*v[0]+G[1]*v[1]+G[2]*v[2]) + u[1]*(G[3]*v[0]+G[4]*v[1]+G[5]*v[2]) + u[2]*(G[6]*v[0]+G[7]*v[1]+G[8]*v[2]);
  const vecs = [];
  for (let i=-3;i<=3;i++) for (let j=-3;j<=3;j++) for (let k=-3;k<=3;k++) if (i||j||k) vecs.push([i,j,k]);
  const l2 = new Map(vecs.map(u => [u, dot(u, u)]));
  vecs.sort((u, v) => l2.get(u) - l2.get(v));            // shortest first (stable on ties)
  const eq = (u, v) => u[0] === v[0] && u[1] === v[1] && u[2] === v[2];
  const first = test => vecs.find(test) || null;
  const axisOf = P => first(u => eq(apply3(P, u), u));
  // ⊥ the axis of P (order n): u + Pu + … + P^(n−1)u = 0.
  const perpTo = (P, n) => u => { const s = u.slice(); let w = u; for (let k = 1; k < n; k++){ w = apply3(P, w); s[0] += w[0]; s[1] += w[1]; s[2] += w[2]; } return !s[0] && !s[1] && !s[2]; };
  const props = Rs.map(properOf), ord = props.map(P => ROT_ORDER[P[0] + P[4] + P[8]]);
  const P_ = n => props[ord.indexOf(n)];
  let A, B, Cc, kind, params, unique;
  if (system === 'cubic'){
    // The cube axes: the 4-fold axes when there are any (O, Oh), else the three 2-fold
    // ones (T, Th, whose 2-fold axes all lie along the cube edges).
    const n = ord.includes(4) ? 4 : 2, axes = [];
    props.forEach((P, i)=> { if (ord[i] !== n) return; const u = axisOf(P); if (u && !axes.some(v => eq(v, u) || eq(v, u.map(x => -x)))) axes.push(u); });
    if (axes.length !== 3) return null;
    [A, B, Cc] = axes; kind = 'cubic'; params = ['a'];
  } else if (system === 'tetragonal' || system === 'hexagonal' || system === 'trigonal'){
    const n = system === 'tetragonal' ? 4 : 3, P = ord.includes(n) ? P_(n) : null;
    if (!P) return null;
    Cc = axisOf(P); A = first(perpTo(P, n));
    if (!Cc || !A) return null;
    B = apply3(P, A);                                     // |b| = |a|, at 90° (4-fold) or 120° (3-fold)
    kind = n === 4 ? 'tetragonal' : 'hexagonal'; params = ['a','c'];
  } else if (system === 'orthorhombic'){
    const axes = [];
    props.forEach((P, i)=> { if (ord[i] !== 2) return; const u = axisOf(P); if (u && !axes.some(v => eq(v, u))) axes.push(u); });
    if (axes.length !== 3) return null;
    [A, B, Cc] = axes; kind = 'orthorhombic'; params = ['a','b','c'];
  } else if (system === 'monoclinic'){
    const P = P_(2);
    if (!P) return null;
    B = axisOf(P); A = first(perpTo(P, 2));
    if (!B || !A) return null;
    Cc = first(u => perpTo(P, 2)(u) && (A[1]*u[2] - A[2]*u[1] || A[2]*u[0] - A[0]*u[2] || A[0]*u[1] - A[1]*u[0]));
    if (!Cc) return null;
    if (dot(A, Cc) > 0) Cc = Cc.map(v => -v);             // β ≥ 90°, as usual
    kind = 'monoclinic'; unique = 'b'; params = ['a','b','c','beta'];
  } else return null;
  let M = [A[0], B[0], Cc[0], A[1], B[1], Cc[1], A[2], B[2], Cc[2]];
  const d = det3(M);
  if (!d) return null;
  if (d < 0){                                             // right-handed: flip the axis no other is built from
    if (kind === 'monoclinic') B = B.map(v => -v); else Cc = Cc.map(v => -v);
    M = [A[0], B[0], Cc[0], A[1], B[1], Cc[1], A[2], B[2], Cc[2]];
  }
  const cv = cellInBasis(cell, M);
  // The symmetry makes these equalities hold to the metric's tolerance; they are made exact.
  const conv = { a: cv.a, b: cv.b, c: cv.c, alpha: 90, beta: 90, gamma: 90 };
  if (kind === 'cubic') conv.a = conv.b = conv.c = Math.cbrt(cv.a*cv.b*cv.c);
  if (kind === 'tetragonal' || kind === 'hexagonal'){ conv.a = conv.b = Math.sqrt(cv.a*cv.b); if (kind === 'hexagonal') conv.gamma = 120; }
  if (kind === 'monoclinic') conv.beta = cv.beta;
  // (a length made the mean of others may differ from it by its own rounding and theirs)
  const sl = cellSlack(cv), sameAngle = (k, i) => Math.abs(cv[k] - conv[k]) < 0.01 + sl.ang[i];
  const eMean = Math.max(...sl.len.slice(0, kind === 'cubic' ? 3 : kind === 'tetragonal' || kind === 'hexagonal' ? 2 : 0), 0);
  if (!['a', 'b', 'c'].every((k, i)=> same(cv[k], conv[k], sl.len[i] + eMean)) || !['alpha','beta','gamma'].every(sameAngle)) return null;
  return { kind, params, ...(unique ? { unique } : {}), basis: M, conv, volumeRatio: Math.abs(det3(M)) };
}

// Crystal system and how the cell may be refined, from the point group (distinct R) and
// the cell as given (the cell itself is not transformed). A recognised standard setting
// gets its usual free parameters; a non-standard one is refined through its conventional
// cell (conventionalBasis); anything else falls back to an isotropic scale of the
// lengths — always consistent with the symmetry, only less free.
function classify(Rs, cell){
  const ord = Rs.map(rotOrder);
  const n3 = ord.filter(o => o === 3).length, n2 = ord.filter(o => o === 2).length;
  const has = o => ord.includes(o);
  const system = n3 >= 8 ? 'cubic' : has(6) ? 'hexagonal' : n3 ? 'trigonal' : has(4) ? 'tetragonal'
               : n2 >= 3 ? 'orthorhombic' : n2 ? 'monoclinic' : 'triclinic';
  const iso = why => ({ kind:'isotropic', params:['a'], note: `${why}: the cell lengths are refined by one common scale factor` });
  const conv = why => {
    const cb = conventionalBasis(system, Rs, cell);
    return cb ? { ...cb, note: `${why}: refined as the conventional cell (${cb.params.join(', ')}), ${cb.volumeRatio}× the volume of the cell given` } : iso(why);
  };
  const { a, b, c, alpha, beta, gamma } = cell, sl = cellSlack(cell), [ea, eb, ec] = sl.len, [eal, ebe, ega] = sl.ang;
  let constraint;
  if (system === 'cubic'){
    // One length either way, but in a primitive cell of an F or I lattice (as the Materials
    // Project serves them) that length is not the cube edge the tables quote: such a cell
    // is refined through its conventional one, so a and V come out as the cube's.
    const right = [alpha, beta, gamma].every((x, i) => Math.abs(x - 90) < 0.01 + sl.ang[i]);
    constraint = right && same(a, b, ea + eb) && same(b, c, eb + ec) ? { kind:'cubic', params:['a'] } : conv('cubic symmetry in a non-standard cell');
  } else if (system === 'hexagonal' || system === 'trigonal'){
    const R3 = Rs[ord.indexOf(3)] || Rs[ord.indexOf(6)];   // a 6-fold without its 3-fold only in a set that is not a group
    // (and a = b: an axis along c in a cell that is not reduced, b = a + a′, is no standard setting)
    if (aboutAxis(R3, 2) && same(a, b, ea + eb)) constraint = { kind:'hexagonal', params:['a','c'] };
    else if (same(a, b, ea + eb) && same(b, c, eb + ec) && same(alpha, beta, eal + ebe) && same(beta, gamma, ebe + ega)) constraint = { kind:'rhombohedral', params:['a','alpha'] };
    else constraint = conv(`${system} symmetry in a non-standard cell`);
  } else if (system === 'tetragonal'){
    constraint = aboutAxis(Rs[ord.indexOf(4)], 2) && same(a, b, ea + eb) ? { kind:'tetragonal', params:['a','c'] } : conv('tetragonal axis not along c, or a ≠ b');
  } else if (system === 'orthorhombic'){
    constraint = Rs.every(R => [1,2,3,5,6,7].every(k => R[k] === 0)) ? { kind:'orthorhombic', params:['a','b','c'] }
               : conv('orthorhombic symmetry in a non-standard cell');
  } else if (system === 'monoclinic'){
    const R2 = Rs[ord.indexOf(2)];
    const u = [0,1,2].find(i => aboutAxis(R2, i));
    constraint = u == null ? conv('monoclinic axis not along a cell axis')
               : { kind:'monoclinic', unique:'abc'[u], params:['a','b','c', ['alpha','beta','gamma'][u]] };
  } else constraint = { kind:'triclinic', params:['a','b','c','alpha','beta','gamma'] };
  return { system, constraint };
}

// Lattice type from the pure translations (identity excluded).
function centringOf(trans){
  const has = v => trans.some(t => t.every((x, i) => Math.abs(x - v[i]) < 1e-3));
  const h = 1/2, t1 = 1/3, t2 = 2/3;
  if (!trans.length) return 'P';
  if (trans.length === 1 && has([h,h,h])) return 'I';
  if (trans.length === 3 && has([0,h,h]) && has([h,0,h]) && has([h,h,0])) return 'F';
  if (trans.length === 1 && has([0,h,h])) return 'A';
  if (trans.length === 1 && has([h,0,h])) return 'B';
  if (trans.length === 1 && has([h,h,0])) return 'C';
  if (trans.length === 2 && ((has([t2,t1,t1]) && has([t1,t2,t2])) || (has([t1,t2,t1]) && has([t2,t1,t2])))) return 'R';
  return 'X';   // a supercell or an unusual centring
}

/* The space-group operations the STRUCTURE has (not just the lattice). The atoms are
   grouped by species and occupancy; an operation is kept when every atom lands on an atom
   of its own group within `tol` (Å) beyond the rounding both may hide, axis by axis (`eps`,
   from the written digits: the image's own turned by R, and the target's; allowance). A P1
   file at three decimals hides up to 0.0065 Å per axis on c = 13 Å, and 0.01 Å alone lost
   corundum's R centring.
   Translations come from a reference atom x₀ (of the group with the fewest atoms), are
   fitted to all the atoms they match (matched allowing the rounding of the pair they come
   from, and again from the fitted one if need be), and are snapped to multiples of 1/24
   when the snapped one still maps the structure, so the absence conditions computed from
   them are exact: pure translations within 1.5e-3, the others within 1.5e-3 when all of
   them lie that near (a standard origin), else within the rounding of the fit (snapFit).
   1. The pure translations T (R = 1), closed into a group: with them the structure's
      lattice, which may be finer than the cell's (a centred cell or a supercell). Each is
      made exact, k/m with m = |T|, when that still maps the structure.
   2. That lattice's holohedry (latticeSymmetry: found in a reduced basis, so nothing is
      missed in a cell that is not reduced), in the cell's basis. A matrix that is not
      integer there cannot act on the cell (a hexagonal structure in its orthohexagonal C
      cell, a supercell): it is counted in `lost`, and structureCell re-expresses the
      structure in a cell that holds it.
   3. For each matrix R, one translation that maps the structure: the others are it times
      T, so only one is searched for.
   4. A group: every product of two of them must be among them up to T, or map the
      structure within twice the tolerance (what two operations within it may need: the
      rounding of the atom passed through cancels), and is then added. Where that fails the tolerance is ambiguous for this structure, and the
      search is made again with it (and the rounding allowed) halved, at most three times.
   5. The atoms placed at the mean of their images under the group (`atoms`): exactly
      symmetric, moved at most by the tolerance (an exact file is left as it is); their B the
      mean over their orbit (bSpread: the largest change).
   Atoms are looked up in a grid of their positions, products are checked through the
   matchings found, and the mean of step 5 is taken over T, then over the R's, so the cost
   grows as N·(|T| + |R|), not N²·|group| (v425: a YAG P1 supercell of 1280 atoms took
   6.5 s, the page frozen; v426 about 80 times less).
   → { ops (identity first; for each R in the order of holohedry(G), its translations in the
       order of the reference atoms they reach), order, pointOrder, centring, system,
       constraint, atoms, lost, lattice (when finer than the cell's: its basis, columns in the
       cell's fractions; primitive: its reduced basis), group: false
       (when step 4 failed at every tolerance) }. */
function findSymmetry(cell, atoms, tol = 0.01){
  const { G, Gs } = metric(cell);
  const ident = { R: IDENT.slice(), t: [0,0,0] };
  const trivial = () => ({ ops:[ident], order:1, pointOrder:1, centring:'P', atoms: atoms || [], lost: 0, ...classify([IDENT], cell) });
  if (!atoms || !atoms.length) return trivial();
  const n = atoms.length, eps = epsOf(atoms);
  const X = new Float64Array(3*n), E = new Float64Array(3*n), rho = new Float64Array(n), gOf = new Int32Array(n).fill(-1);
  const groups = new Map();
  atoms.forEach((a, j)=>{
    X[3*j] = mod1(a.x); X[3*j+1] = mod1(a.y); X[3*j+2] = mod1(a.z);
    E[3*j] = eps[j][0]; E[3*j+1] = eps[j][1]; E[3*j+2] = eps[j][2];
    rho[j] = boxRadius(G, eps[j]);
    // An empty site scatters nothing: counted as a species it would only lower the
    // symmetry found (and the Laue merging with it).
    const occ = +(a.occ ?? 1);
    if (!(occ > 0)) return;
    const k = (a.key || a.element || a.label) + '|' + occ.toFixed(3);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(j);
  });
  if (!groups.size) return trivial();
  const sets = [...groups.values()];
  sets.forEach((s, g)=> s.forEach(j => { gOf[j] = g; }));
  const used = Int32Array.from(sets.flat()), nu = used.length;
  const rmax = sets.map(s => s.reduce((m, j)=> Math.max(m, rho[j]), 0));
  const Ns = [Math.sqrt(Gs[0]), Math.sqrt(Gs[4]), Math.sqrt(Gs[8])];
  const ref = sets.reduce((m, s) => s.length < m.length ? s : m), i0 = ref[0];
  const x0 = [X[3*i0], X[3*i0+1], X[3*i0+2]];
  const refPos = new Int32Array(n).fill(-1);
  ref.forEach((j, i)=> { refPos[j] = i; });
  const dG = dGof(cell), rank = new Map(holohedry(G, 1e-4, dG).map((R, i)=> [R.join(), i])), rankOf = R => rank.get(R.join()) ?? 1e6;

  // A grid of each group's positions, about one atom to a cell, no cell narrower than a
  // match (as a fraction of each axis), so a lookup reads two cells per axis.
  const grids = sets.map((set, g)=>{
    const c = Math.max(1, Math.round(Math.cbrt(set.length)));
    const nb = Ns.map(N => Math.max(1, Math.min(c, Math.floor(1/(2*(tol + 2*rmax[g])*N)))));
    const nc = nb[0]*nb[1]*nb[2], start = new Int32Array(nc + 1), at = new Int32Array(set.length);
    const binOf = (u, i) => Math.min(nb[i] - 1, Math.floor(u*nb[i]));
    set.forEach((j, i)=>{ at[i] = (binOf(X[3*j], 0)*nb[1] + binOf(X[3*j+1], 1))*nb[2] + binOf(X[3*j+2], 2); start[at[i] + 1]++; });
    for (let k = 0; k < nc; k++) start[k + 1] += start[k];
    const items = new Int32Array(set.length), fill = start.slice(0, nc);
    set.forEach((j, i)=> { items[fill[at[i]]++] = j; });
    return { nb, start, items };
  });
  // Is d (fractions, wrapped; the image of atom j under R less atom k) within f times the
  // tolerance beyond the rounding allowed on each axis, s·(eps_k + |R|·eps_j), and that of the
  // translation tried (et, when it comes from one atom pair)? (What is left of each
  // component beyond it, in Å.)
  const over = (v, a) => v > a ? v - a : v < -a ? v + a : 0;
  const within = (d0, d1, d2, R, j, k, s, f, et) =>{
    const e0 = over(d0, s*(E[3*k] + Math.abs(R[0])*E[3*j] + Math.abs(R[1])*E[3*j+1] + Math.abs(R[2])*E[3*j+2] + (et ? et[0] : 0)));
    const e1 = over(d1, s*(E[3*k+1] + Math.abs(R[3])*E[3*j] + Math.abs(R[4])*E[3*j+1] + Math.abs(R[5])*E[3*j+2] + (et ? et[1] : 0)));
    const e2 = over(d2, s*(E[3*k+2] + Math.abs(R[6])*E[3*j] + Math.abs(R[7])*E[3*j+1] + Math.abs(R[8])*E[3*j+2] + (et ? et[2] : 0)));
    const B = s*f*tol;
    return G[0]*e0*e0 + G[4]*e1*e1 + G[8]*e2*e2 + 2*(G[1]*e0*e1 + G[2]*e0*e2 + G[5]*e1*e2) <= B*B;
  };
  // The atom of group g nearest to the point y (fractions), the image of atom j under R,
  // within the tolerance beyond the rounding (within), or −1; looked for within L Å.
  const find = (y0, y1, y2, g, R, j0, s, L, et) =>{
    const { nb, start, items } = grids[g], n0 = nb[0], n1 = nb[1], n2 = nb[2];
    const u0 = mod1(y0), u1 = mod1(y1), u2 = mod1(y2);
    // the cells the window ±L Å spans on each axis (all of them when it spans the axis)
    let a0 = Math.floor((u0 - L*Ns[0])*n0), b0 = Math.floor((u0 + L*Ns[0])*n0); if (b0 - a0 + 1 >= n0){ a0 = 0; b0 = n0 - 1; }
    let a1 = Math.floor((u1 - L*Ns[1])*n1), b1 = Math.floor((u1 + L*Ns[1])*n1); if (b1 - a1 + 1 >= n1){ a1 = 0; b1 = n1 - 1; }
    let a2 = Math.floor((u2 - L*Ns[2])*n2), b2 = Math.floor((u2 + L*Ns[2])*n2); if (b2 - a2 + 1 >= n2){ a2 = 0; b2 = n2 - 1; }
    let best = -1, bd = Infinity;
    for (let p = a0; p <= b0; p++){
      const P = ((p % n0) + n0) % n0;
      for (let q = a1; q <= b1; q++){
        const Q = ((q % n1) + n1) % n1;
        for (let r = a2; r <= b2; r++){
          const k = (P*n1 + Q)*n2 + ((r % n2) + n2) % n2;
          for (let m = start[k]; m < start[k + 1]; m++){
            const j = items[m];
            let d0 = u0 - X[3*j], d1 = u1 - X[3*j+1], d2 = u2 - X[3*j+2];
            d0 -= Math.round(d0); d1 -= Math.round(d1); d2 -= Math.round(d2);
            const q2 = G[0]*d0*d0 + G[4]*d1*d1 + G[8]*d2*d2 + 2*(G[1]*d0*d1 + G[2]*d0*d2 + G[5]*d1*d2);
            if (q2 < bd && q2 <= L*L && within(d0, d1, d2, R, j0, j, s, 1, et)){ bd = q2; best = j; }
          }
        }
      }
    }
    return best;
  };
  // Where (R, t) takes each counted atom, or null when one lands on none of its group.
  const scratch = new Int32Array(n).fill(-1);
  const eMax = [0, 1, 2].map(i => used.reduce((m, j)=> Math.max(m, eps[j][i]), 0)), ZERO3 = [0, 0, 0];
  const maps = (R, t, s, et) =>{
    // (the largest a match may lie away: the largest rounding allowed, turned by R)
    const L = s*(tol + boxRadius(G, [0, 1, 2].map(i => eMax[i] + Math.abs(R[3*i])*eMax[0] + Math.abs(R[3*i+1])*eMax[1] + Math.abs(R[3*i+2])*eMax[2] + et[i])));
    for (let m = 0; m < nu; m++){
      const j = used[m], x = X[3*j], y = X[3*j+1], z = X[3*j+2];
      const k = find(R[0]*x + R[1]*y + R[2]*z + t[0], R[3]*x + R[4]*y + R[5]*z + t[1], R[6]*x + R[7]*y + R[8]*z + t[2], gOf[j], R, j, s, L, et);
      if (k < 0) return null;
      scratch[j] = k;
    }
    return scratch.slice();
  };
  // Does (R, t) take every counted atom j onto perm[j] within f times the tolerance? For a
  // product (f = 2) the bound is the sum of its factors' (the rounding of the atom passed
  // through cancels: A(B·e_j − e_m) + (A·e_m − e_k) = C·e_j − e_k).
  const holds = (R, t, perm, s, f) =>{
    for (let m = 0; m < nu; m++){
      const j = used[m], k = perm[j];
      if (k < 0 || gOf[k] !== gOf[j]) return false;
      const x = X[3*j], y = X[3*j+1], z = X[3*j+2];
      let d0 = R[0]*x + R[1]*y + R[2]*z + t[0] - X[3*k], d1 = R[3]*x + R[4]*y + R[5]*z + t[1] - X[3*k+1], d2 = R[6]*x + R[7]*y + R[8]*z + t[2] - X[3*k+2];
      d0 -= Math.round(d0); d1 -= Math.round(d1); d2 -= Math.round(d2);
      if (!within(d0, d1, d2, R, j, k, s, f)) return false;
    }
    return true;
  };
  const compose = (pa, pb) =>{   // pb first, then pa
    const c = new Int32Array(n).fill(-1);
    for (let m = 0; m < nu; m++){ const j = used[m], k = pb[j]; if (k >= 0) c[j] = pa[k]; }
    return c;
  };
  const same3 = (u, v) => u[0] === v[0] && u[1] === v[1] && u[2] === v[2];
  // The translation of (R, t) fitted to its matching: taken from one atom pair, t carries
  // that pair's rounding. On each axis, t plus the middle of the offsets (of the atoms from
  // their matches) that every atom's rounding allows; where none is (noise beyond the
  // rounding), the median offset, which ignores atoms matched to a near twin (a site split
  // across a mirror by less than the tolerance). Then snapped to the nearest multiple of 1/24
  // when that is allowed too (else within the largest rounding): exact data snap only exact
  // translations, and the part of a translation that the origin sets is not snapped by
  // coincidence (v425 snapped within 1.5e-3, and a P41 at a random origin came out not quite
  // a group). Kept when it maps the structure within f times the tolerance (the fit, else t
  // itself, else null).
  const off = [new Float64Array(nu), new Float64Array(nu), new Float64Array(nu)];
  const med = a => { const b = a.slice().sort(), h = b.length >> 1; return b.length % 2 ? b[h] : 0.5*(b[h - 1] + b[h]); };
  const fitOff = (R, t, perm, s) =>{
    const lo = [-Infinity, -Infinity, -Infinity], hi = [Infinity, Infinity, Infinity];
    for (let m = 0; m < nu; m++){
      const j = used[m], k = perm[j], x = X[3*j], y = X[3*j+1], z = X[3*j+2];
      for (let i = 0; i < 3; i++){
        const d = X[3*k+i] - (R[3*i]*x + R[3*i+1]*y + R[3*i+2]*z + t[i]), o = d - Math.round(d);
        const a = s*(E[3*k+i] + Math.abs(R[3*i])*E[3*j] + Math.abs(R[3*i+1])*E[3*j+1] + Math.abs(R[3*i+2])*E[3*j+2]);
        off[i][m] = o; lo[i] = Math.max(lo[i], o - a); hi[i] = Math.min(hi[i], o + a);
      }
    }
    // On each axis the middle of the offsets every atom's rounding allows, else their median.
    return { lo, hi, c: [0, 1, 2].map(i => lo[i] <= hi[i] ? 0.5*(lo[i] + hi[i]) : med(off[i])) };
  };
  // Snapped where a multiple of 1/24 is allowed too (else, without such offsets, where it lies
  // within the largest rounding).
  const snapFit = (R, t, perm, s, f) =>{
    const { lo, hi, c } = fitOff(R, t, perm, s), ft = t.map((v, i)=> mod1(v + c[i])), w = allowance(R, eMax, eMax);
    const fs = ft.map((v, i)=>{ const k = Math.round(v*24), d = k/24 - v, ok = lo[i] <= hi[i] ? c[i] + d >= lo[i] - 1e-12 && c[i] + d <= hi[i] + 1e-12 : Math.abs(d) <= s*w[i] + 1e-12; return ok ? (k % 24)/24 : v; });
    if (!same3(fs, ft) && holds(R, fs, perm, s, f)) return fs;
    return holds(R, ft, perm, s, f) ? ft : holds(R, t, perm, s, f) ? t : null;
  };
  // (R, t) mapping the structure, its translation fitted and snapped: → { t, perm } or null.
  // (When t itself fails, its v425 snap, which a rounded x₀ can need.)
  const tryT = (R, raw, s, j) =>{
    const et = [0, 1, 2].map(i => E[3*j+i] + Math.abs(R[3*i])*E[3*i0] + Math.abs(R[3*i+1])*E[3*i0+1] + Math.abs(R[3*i+2])*E[3*i0+2]);
    let t = raw, perm = maps(R, raw, s, et);
    if (!perm){ t = raw.map(snapT); if (same3(t, raw) || !(perm = maps(R, t, s, et))) return null; }
    const ft = snapFit(R, t, perm, s, 1);
    if (ft) return { t: ft, perm };
    // (matched with t's own rounding allowed, an atom may have taken a near twin: matched
    // again from the fitted translation)
    const { c } = fitOff(R, t, perm, s), t1 = t.map((v, i)=> mod1(v + c[i])), p1 = maps(R, t1, s, ZERO3), f1 = p1 && snapFit(R, t1, p1, s, 1);
    return f1 ? { t: f1, perm: p1 } : null;
  };
  // A sum of exact translations stays exact (no rounding noise left in it).
  const exactT = v =>{ const s = snapT(v), d = Math.abs(s - v); return d < 1e-9 || d > 1 - 1e-9 ? s : v; };
  // The same for a product, whose matching is known: it is checked, not searched (and a
  // product of exact factors is exact).
  const tryProduct = (R, raw, perm, s) =>{ const ex = raw.map(exactT); return holds(R, ex, perm, s, 2) ? ex : snapFit(R, raw, perm, s, 2); };
  // v425's snap, to 1/24 within 1.5e-3, of an operation found: kept when it still maps the
  // structure. Structures symmetric only to within the tolerance (a DFT cell, noise of a few
  // mÅ) get exact translations so.
  const snap425 = (o, R, s) =>{ const sn = o.t.map(snapT); if (!same3(sn, o.t) && holds(R, sn, o.perm, s, 1)) o.t = sn; };
  const onGrid = t => t.every(v => { const w = mod1(v); return Math.abs(w - Math.round(w*24)/24) < 1.5e-3; });
  // Two translations of one R closer than a match are one operation (atoms of a group that
  // close, as a site split across a mirror by less than the rounding, give both).
  const nearT = (t, u, s) =>{
    const d = [0, 1, 2].map(i => { const v = t[i] - u[i]; return v - Math.round(v); }), B = s*(tol + 2*rmax[gOf[i0]]);
    return qform(G, d) <= B*B;
  };

  const attempt = s =>{
    let closed = true;
    // 1. The pure translations, closed into a group (an operation with R = 1 is known by
    //    where it takes x₀).
    const T = [], tAt = new Map();
    for (const j of ref){
      if (tAt.has(j)) continue;
      const r = tryT(IDENT, [mod1(X[3*j] - x0[0]), mod1(X[3*j+1] - x0[1]), mod1(X[3*j+2] - x0[2])], s, j);
      if (r && !tAt.has(r.perm[i0]) && !T.some(o => nearT(o.t, r.t, s))){ snap425(r, IDENT, s); tAt.set(r.perm[i0], T.length); T.push(r); }
    }
    for (let a = 0; a < T.length; a++) for (let b = 1; b <= a; b++){   // (translations commute)
      const j = T[a].perm[T[b].perm[i0]], raw = [0, 1, 2].map(i => mod1(T[a].t[i] + T[b].t[i]));
      if (tAt.has(j) || T.some(o => nearT(o.t, raw, s))) continue;
      const perm = compose(T[a].perm, T[b].perm), t = tryProduct(IDENT, raw, perm, s);
      if (t){ tAt.set(j, T.length); T.push({ t, perm }); } else closed = false;
    }
    // They form a group of order m, so m·t is integral: each is made exact, and the
    // structure's lattice, ℤ³ + Σ ℤt, has a basis.
    const m = T.length;
    let latt = null;
    if (m > 1){
      const ints = [];
      for (const o of T){
        const v = o.t.map(x => Math.round(m*x));
        if (o.t.some((x, i)=> Math.abs(m*x - v[i]) > 0.25)){ ints.length = 0; break; }
        ints.push(v);
        const ex = v.map(k => mod1(k/m));
        if (!same3(ex, o.t) && holds(IDENT, ex, o.perm, s, 1)) o.t = ex;
      }
      const basis = ints.length ? latticeBasis([[m, 0, 0], [0, m, 0], [0, 0, m], ...ints]) : null;
      if (basis) latt = colsOf(basis).map(v => v/m);
    }
    // 2–3. The lattice's holohedry in the cell, and one translation for each matrix. A
    //    candidate that fails rules out its images under T too.
    const lat = latticeSymmetry(G, latt || IDENT, dG);
    const reps = new Map([[IDENT.join(), { R: IDENT.slice(), t: [0, 0, 0], perm: T[0].perm }]]);
    const tried = new Uint8Array(n);
    for (const R of lat.Rs.slice().sort((p, q)=> rankOf(p) - rankOf(q))){
      if (isIdent(R)) continue;
      tried.fill(0);
      const Rx0 = apply3(R, x0);
      for (const j of ref){
        if (tried[j]) continue;
        for (const o of T) if (o.perm[j] >= 0) tried[o.perm[j]] = 1;
        const r = tryT(R, [mod1(X[3*j] - Rx0[0]), mod1(X[3*j+1] - Rx0[1]), mod1(X[3*j+2] - Rx0[2])], s, j);
        if (r){ reps.set(R.join(), { R: R.slice(), ...r }); break; }
      }
    }
    // A translation's part along the symmetry element is rational, its part across it is set
    // by the origin. So v425's snap applies to all or none: all when every one lies near the
    // grid (a standard origin, perhaps with noise), not one that a random origin puts there.
    if ([...reps.values()].every(o => onGrid(o.t))) for (const o of reps.values()) snap425(o, o.R, s);
    // 4. A group. Two operations with one R are one up to T when they take x₀ into one
    //    T-orbit (its least atom stands for it).
    const tOrb = new Int32Array(n).fill(-1);
    for (const j of ref){ let lo = j; for (const o of T){ const k = o.perm[j]; if (k >= 0 && k < lo) lo = k; } tOrb[j] = lo; }
    const list = [...reps.values()];
    for (let a = 0; a < list.length && list.length <= 48; a++) for (let b = 0; b < list.length; b++){
      const A = list[a], B = list[b], R = mul3(A.R, B.R), key = R.join(), j = A.perm[B.perm[i0]], C = reps.get(key);
      const Bt = apply3(A.R, B.t), raw = [0, 1, 2].map(i => mod1(Bt[i] + A.t[i]));
      if (C){
        if (j < 0 || (tOrb[j] !== tOrb[C.perm[i0]] && !T.some(o => { const Rt = apply3(C.R, o.t); return nearT(raw, [0, 1, 2].map(i => Rt[i] + C.t[i]), 2*s); }))) closed = false;
        continue;
      }
      const perm = compose(A.perm, B.perm), t = tryProduct(R, raw, perm, s);
      if (!t){ closed = false; continue; }
      const D = { R, t, perm };
      reps.set(key, D); list.push(D);
    }
    const Rs = [...reps.values()].sort((p, q)=> rankOf(p.R) - rankOf(q.R));
    const ops = [];
    for (const C of Rs){
      const sub = T.map(o =>{
        const Rt = apply3(C.R, o.t);
        return { t: [0, 1, 2].map(i => exactT(mod1(Rt[i] + C.t[i]))), at: refPos[C.perm[o.perm[i0]]] };
      }).sort((p, q)=> p.at - q.at);
      for (const { t } of sub) ops.push({ R: C.R.slice(), t });
    }
    // 5. The atoms at the mean of their images: atom k receives, from every operation, the
    //    image of the atom it takes there. T is normal in the group, so the mean over it is
    //    the mean over T, then over one operation for each R (the maps are affine): the cost
    //    is (|T| + |R|)·N, not |T|·|R|·N.
    const mean = (list, P) =>{
      const acc = new Float64Array(3*n), cnt = new Int32Array(n), Y = new Float64Array(P);
      for (const { R, t, perm } of list) for (let m = 0; m < nu; m++){
        const j = used[m], k = perm[j];
        if (k < 0) continue;
        const x = P[3*j], y = P[3*j+1], z = P[3*j+2];
        let d0 = R[0]*x + R[1]*y + R[2]*z + t[0] - P[3*k], d1 = R[3]*x + R[4]*y + R[5]*z + t[1] - P[3*k+1], d2 = R[6]*x + R[7]*y + R[8]*z + t[2] - P[3*k+2];
        acc[3*k] += d0 - Math.round(d0); acc[3*k+1] += d1 - Math.round(d1); acc[3*k+2] += d2 - Math.round(d2);
        cnt[k]++;
      }
      for (let k = 0; k < n; k++) if (cnt[k] === list.length) for (let i = 0; i < 3; i++) Y[3*k+i] += acc[3*k+i]/list.length; else cnt[k] = -1;
      return { Y, cnt };
    };
    const s1 = mean(T.map(o => ({ R: IDENT, t: o.t, perm: o.perm })), X), s2 = mean(Rs, s1.Y);
    // B too: the key has no B, so atoms the group maps onto each other may differ in it (sites
    // of a lower group, a P1 file with a B per atom), and the reflections it merges would then
    // be wrong (a B spread of ±0.1 Å² put lines 4 % off, median over 176 groups; ±0.5 Å², 21 %).
    // Each atom takes the mean over its orbit, over T then over one operation per R.
    const meanB = (list, Bv) =>{
      const acc = new Float64Array(n), cnt = new Int32Array(n);
      for (const { perm } of list) for (let m = 0; m < nu; m++){ const j = used[m], k = perm[j]; if (k >= 0){ acc[k] += Bv[j]; cnt[k]++; } }
      return Bv.map((v, k)=> cnt[k] === list.length ? acc[k]/list.length : v);
    };
    const B0 = Float64Array.from(atoms, a => Number.isFinite(a.Biso) ? a.Biso : NaN);
    const Bm = B0.some(Number.isNaN) ? B0 : meanB(Rs, meanB(T, B0));
    let bSpread = 0;
    const sym = atoms.map((a, k)=>{
      const d0 = s2.Y[3*k] - X[3*k], d1 = s2.Y[3*k+1] - X[3*k+1], d2 = s2.Y[3*k+2] - X[3*k+2];
      const dB = Math.abs(Bm[k] - B0[k]) > 1e-12 ? Bm[k] : null;
      if (dB != null) bSpread = Math.max(bSpread, Math.abs(Bm[k] - B0[k]));
      const moved = !(s1.cnt[k] < 0 || s2.cnt[k] < 0 || (Math.abs(d0) <= 1e-9 && Math.abs(d1) <= 1e-9 && Math.abs(d2) <= 1e-9));
      if (!moved && dB == null) return a;
      return { ...a, ...(moved ? { x: mod1(s2.Y[3*k]), y: mod1(s2.Y[3*k+1]), z: mod1(s2.Y[3*k+2]) } : {}), ...(dB != null ? { Biso: dB } : {}) };
    });
    const trans = T.filter(o => o.t.some(v => v)).map(o => o.t);
    return { ops, order: ops.length, pointOrder: Rs.length, centring: centringOf(trans), ...classify(Rs.map(C => C.R), cell), atoms: sym, lost: lat.lost, bSpread,
             ...(latt ? { lattice: latt, primitive: lat.basis } : {}), ...(closed ? {} : { group: false }) };
  };
  let r = null;
  for (const s of [1, 1/2, 1/4, 1/8]){ r = attempt(s); if (r.group !== false) break; }
  return r;
}

/* The atoms in the cell whose axes are the columns of B (in the old cell's fractions: a
   finer, coarser or turned lattice basis), each position once: x' = B⁻¹(x + n) for the
   lattice vectors n that bring it into [0, 1)³. Their rounding goes to the new axes as the
   box that holds the old one turned, |B⁻¹|·eps. */
function rebase(atoms, B){
  const Bi = inv3(B), lo = [0, 0, 0], hi = [0, 0, 0];
  for (const c of [[1,0,0], [0,1,0], [0,0,1], [1,1,0], [1,0,1], [0,1,1], [1,1,1]]){
    const v = apply3(B, c);
    for (let i = 0; i < 3; i++){ lo[i] = Math.min(lo[i], Math.floor(v[i] - 1e-9)); hi[i] = Math.max(hi[i], Math.ceil(v[i] + 1e-9)); }
  }
  const eps = epsOf(atoms), out = [], seen = new Map();
  const cellKey = y => y.map(v => Math.floor(v*1e4)), key = (k, c) => k + '|' + c.join();
  atoms.forEach((a, j)=>{
    const x = [mod1(a.x), mod1(a.y), mod1(a.z)], kind = (a.key || a.element || a.label) + '|' + (+(a.occ ?? 1)).toFixed(3);
    const e = eps[j], ne = [0, 1, 2].map(i => Math.abs(Bi[3*i])*e[0] + Math.abs(Bi[3*i+1])*e[1] + Math.abs(Bi[3*i+2])*e[2]);
    for (let p = lo[0] - 1; p <= hi[0]; p++) for (let q = lo[1] - 1; q <= hi[1]; q++) for (let r = lo[2] - 1; r <= hi[2]; r++){
      const y = apply3(Bi, [x[0] + p, x[1] + q, x[2] + r]);
      if (y.some(v => v < -1e-6 || v >= 1 - 1e-6)) continue;
      const u = y.map(mod1), c = cellKey(u);
      let dup = false;
      for (let d0 = -1; d0 <= 1 && !dup; d0++) for (let d1 = -1; d1 <= 1 && !dup; d1++) for (let d2 = -1; d2 <= 1 && !dup; d2++){
        const list = seen.get(key(kind, [(c[0] + d0 + 1e4) % 1e4, (c[1] + d1 + 1e4) % 1e4, (c[2] + d2 + 1e4) % 1e4]));
        if (list) dup = list.some(w => w.every((v, i)=> { const d = Math.abs(v - u[i]); return Math.min(d, 1 - d) < 1e-6; }));
      }
      if (dup) continue;
      const k = key(kind, c);
      if (!seen.has(k)) seen.set(k, []);
      seen.get(k).push(u);
      out.push({ ...a, x: u[0], y: u[1], z: u[2], eps: ne });
    }
  });
  return out;
}

/* The structure in its own cell. A cell carries only the symmetry whose matrices are integer
   in it: a hexagonal structure in its C-centred orthohexagonal cell (a, √3a, c), or a
   supercell (a P1 file of 2×1×1 cells), has a lattice finer than the cell's, and part of that
   lattice's symmetry is not integer in the cell (findSymmetry's `lost`). Refined there, hcp
   Mg came out orthorhombic with b/a free, and the reflections the lost symmetry makes equal
   were split. So when the structure's lattice is finer than the cell given, the structure is
   re-expressed in a cell of its own: the cell given divided along its axes (a/n₁, b/n₂, c/n₃,
   n_i the lattice translations along axis i), which keeps the file's axes and setting, when it
   holds the whole symmetry in a standard setting; else the reduced primitive cell of that
   lattice, and then the conventional cell of the symmetry found there (conventionalBasis):
   kept when it holds symmetry the cell given lost, or is smaller than it (a supercell; a
   centred cell given in its own conventional setting stays as it is). With no conventional
   cell, the primitive one. The pattern is the same; the cell, the atoms and the indices are
   the new cell's.
   → { cell, atoms (symmetrized), sym (findSymmetry's, in that cell), basis (only when
       re-expressed: the new axes, columns in the given cell's fractions) }. */
function structureCell(cell, atoms, tol = 0.01){
  const sym = findSymmetry(cell, atoms, tol), keep = { cell, atoms: sym.atoms, sym };
  if (!sym.primitive || sym.group === false) return keep;
  const P = sym.primitive, pc = cellInBasis(cell, P), pa = rebase(sym.atoms, P);
  if (pa.length !== Math.round(atoms.length*Math.abs(det3(P)))) return keep;   // the translations were not exact
  const ps = findSymmetry(pc, pa, tol);
  if (ps.group === false || ps.lost || ps.pointOrder < sym.pointOrder) return keep;
  const nAx = [0, 1, 2].map(i => 1 + sym.ops.filter(o => isIdent(o.R) && o.t.every((v, j)=> j === i ? v > 1e-6 : v < 1e-6)).length);
  if (nAx[0]*nAx[1]*nAx[2] > 1){
    const D = [1/nAx[0], 0, 0, 0, 1/nAx[1], 0, 0, 0, 1/nAx[2]], dc = cellInBasis(cell, D), da = rebase(sym.atoms, D);
    const ds = da.length*nAx[0]*nAx[1]*nAx[2] === atoms.length ? findSymmetry(dc, da, tol) : null, k = ds && ds.constraint;
    if (ds && ds.group !== false && !ds.lost && ds.pointOrder >= ps.pointOrder && !k.basis && k.kind !== 'isotropic') return { cell: dc, atoms: ds.atoms, sym: ds, basis: D };
  }
  const gains = ps.pointOrder > sym.pointOrder;
  const Rs = [];
  for (const { R } of ps.ops) if (!Rs.some(Q => Q.every((v, i)=> v === R[i]))) Rs.push(R);
  const cb = conventionalBasis(ps.system, Rs, pc);
  const prim = gains || ps.constraint.kind !== 'isotropic' ? { cell: pc, atoms: ps.atoms, sym: ps, basis: P } : keep;
  if (!cb) return prim;
  const M = mul3(P, cb.basis);
  if (!gains && Math.abs(det3(M)) > 1 - 1e-9) return keep;
  const ca = rebase(ps.atoms, cb.basis);
  if (ca.length !== pa.length*cb.volumeRatio) return prim;
  const cs = findSymmetry(cb.conv, ca, tol);
  if (cs.pointOrder < ps.pointOrder || cs.lost || cs.group === false) return prim;
  return { cell: cb.conv, atoms: cs.atoms, sym: cs, basis: M };
}

/* ---------- displacement parameters by site ---------- */
/* atomOrbits(cell, atoms, ops, tol) → { orbit (per atom), R (per atom: the rotation that
   takes its orbit's first atom to it), ref (per orbit: that first atom's index) }: the
   atoms of the filled cell grouped into crystallographic sites under the operations found
   (findSymmetry), within tol Å — the sets that share one displacement parameter (an
   anisotropic one turned by R from atom to atom). A P1 file lists every atom as its own
   site: its orbits come from the symmetry found, not from the file's labels. */
function atomOrbits(cell, atoms, ops, tol = 0.01){
  const { G } = metric(cell), n = atoms.length, tol2 = tol*tol;
  const list = ops && ops.length ? ops : [{ R: IDENT, t: [0,0,0] }];
  const orbit = new Int32Array(n).fill(-1), Rof = new Array(n), ref = [];
  const kind = atoms.map(a => (a.key || a.element || a.label) + '|' + (+(a.occ ?? 1)).toFixed(3));
  const dist2 = (p, q) => {
    let d0 = p[0]-q[0], d1 = p[1]-q[1], d2 = p[2]-q[2];
    d0 -= Math.round(d0); d1 -= Math.round(d1); d2 -= Math.round(d2);
    return G[0]*d0*d0 + G[4]*d1*d1 + G[8]*d2*d2 + 2*(G[1]*d0*d1 + G[2]*d0*d2 + G[5]*d1*d2);
  };
  for (let j = 0; j < n; j++){
    if (orbit[j] >= 0) continue;
    const o = ref.length, kj = kind[j], xj = [atoms[j].x, atoms[j].y, atoms[j].z];
    ref.push(j); orbit[j] = o; Rof[j] = IDENT.slice();
    for (const { R, t } of list){
      const y = apply3(R, xj); y[0] += t[0]; y[1] += t[1]; y[2] += t[2];
      for (let k = 0; k < n; k++){
        if (orbit[k] >= 0 || kind[k] !== kj) continue;
        if (dist2(y, [atoms[k].x, atoms[k].y, atoms[k].z]) < tol2){ orbit[k] = o; Rof[k] = R.slice(); break; }
      }
    }
  }
  return { orbit, R: Rof, ref };
}
/* siteAdpBasis(cell, ops, x, tol) → { names, vecs, bvecs, free }: the anisotropic
   displacement parameters a site at x may have, U^ij in the CIF's convention (Å², on the
   reciprocal axes: β_ij = 2π² a*_i a*_j U^ij, the Debye–Waller factor exp(−hᵀβh)). The
   site's own operations (those that keep x within tol Å) must leave β unchanged, RβRᵀ = β:
   rows on (β11, β22, β33, β12, β13, β23) with integer coefficients and no cell in them, so
   the relations hold whatever the refined cell. (In U they read T U Tᵀ = U, T = N⁻¹RN with
   N = diag(a*, b*, c*), which moves with the cell's axial ratios when R mixes axes of
   different a*: in the primitive cell of a centred orthorhombic lattice, a basis made in U
   at the starting cell broke the site symmetry by 1–3 % once the cell had moved.) Echelon
   form with the columns taken from the last, so the free parameters are the first ones (U11
   rather than U33 on a cubic site, U11 and U33 on a tetragonal axis). The parameters are the
   free U^ij at the current cell (adpU); vecs: each one's U as a 6-vector at this cell;
   bvecs: each one's β pattern (1 at its own component); free: its (i, j). */
const U_NAMES = ['U11', 'U22', 'U33', 'U12', 'U13', 'U23'];
const U_IJ = [[0,0],[1,1],[2,2],[0,1],[0,2],[1,2]];
function siteAdpBasis(cell, ops, x, tol = 0.01){
  const { G, Gs } = metric(cell), N = [Math.sqrt(Gs[0]), Math.sqrt(Gs[4]), Math.sqrt(Gs[8])], tol2 = tol*tol;
  const dist2 = d => { d = d.map(v => v - Math.round(v)); return G[0]*d[0]*d[0] + G[4]*d[1]*d[1] + G[8]*d[2]*d[2] + 2*(G[1]*d[0]*d[1] + G[2]*d[0]*d[2] + G[5]*d[1]*d[2]); };
  const rows = [];
  for (const { R, t } of (ops && ops.length ? ops : [])){
    const y = apply3(R, x);
    if (dist2([y[0] + t[0] - x[0], y[1] + t[1] - x[1], y[2] + t[2] - x[2]]) > tol2) continue;
    const T = (i, j) => R[3*i + j];
    U_IJ.forEach(([a, b], r)=>{
      const row = U_IJ.map(([c, d]) => c === d ? T(a, c)*T(b, d) : T(a, c)*T(b, d) + T(a, d)*T(b, c));
      row[r] -= 1;
      rows.push(row);
    });
  }
  // Echelon form on the columns from the last (β23 … β11).
  const order = [5, 4, 3, 2, 1, 0], A = rows.map(r => order.map(c => r[c])), piv = [];
  let rr = 0;
  for (let c = 0; c < 6 && rr < A.length; c++){
    let p = rr; for (let i = rr + 1; i < A.length; i++) if (Math.abs(A[i][c]) > Math.abs(A[p][c])) p = i;
    if (Math.abs(A[p][c]) < 1e-8) continue;
    [A[rr], A[p]] = [A[p], A[rr]];
    const d = A[rr][c]; for (let k = 0; k < 6; k++) A[rr][k] /= d;
    for (let i = 0; i < A.length; i++){ if (i === rr) continue; const f = A[i][c]; if (f) for (let k = 0; k < 6; k++) A[i][k] -= f*A[rr][k]; }
    piv.push(c); rr++;
  }
  const names = [], bvecs = [];
  for (const f of [0, 1, 2, 3, 4, 5].filter(c => !piv.includes(c))){
    const v = new Array(6).fill(0);
    v[order[f]] = 1;
    piv.forEach((c, i) => { const val = -A[i][f]; if (Math.abs(val) > 1e-12) v[order[c]] = val; });
    names.push(U_NAMES[order[f]]); bvecs.push(v);
  }
  // Free parameters in U11 … U23 order.
  const idx = names.map((_, i) => i).sort((i, j) => U_NAMES.indexOf(names[i]) - U_NAMES.indexOf(names[j]));
  const basis = { names: idx.map(i => names[i]), bvecs: idx.map(i => bvecs[i]), free: idx.map(i => U_IJ[U_NAMES.indexOf(names[i])]) };
  basis.vecs = basis.names.map((_, m)=> adpU(basis, basis.names.map((_, k)=> k === m ? 1 : 0), N));
  return basis;
}
// The U^ij (6-vector, U11 … U23) of a site basis (siteAdpBasis) with free values c, for a cell
// of reciprocal lengths Ns: β = Σ c_m 2π² a*_i a*_j bvec_m (i, j the free component), back
// to U on this cell's axes. Each c_m is then this cell's U^ij of its own component.
function adpU(basis, c, Ns){
  const U = [0, 0, 0, 0, 0, 0];
  basis.bvecs.forEach((b, m)=>{
    const [p, q] = basis.free[m], s = c[m]*Ns[p]*Ns[q];
    b.forEach((v, k)=> { if (v){ const [i, j] = U_IJ[k]; U[k] += s*v/(Ns[i]*Ns[j]); } });
  });
  return U;
}
// U^ij (6-vector, U11 … U23) → β (row-major 3×3, fractional) for the cell's reciprocal lengths.
function betaOf(Uv, Ns){
  const U = [[Uv[0], Uv[3], Uv[4]], [Uv[3], Uv[1], Uv[5]], [Uv[4], Uv[5], Uv[2]]], k = 2*Math.PI*Math.PI;
  return [0, 1, 2].flatMap(i => [0, 1, 2].map(j => k*Ns[i]*Ns[j]*U[i][j]));
}
// U_eq = ⅓ Σ U^ij a*_i a*_j (a_i·a_j) (Fischer & Tillmanns), Å².
function uEquiv(Uv, cell){
  const { G, Gs } = metric(cell), N = [Math.sqrt(Gs[0]), Math.sqrt(Gs[4]), Math.sqrt(Gs[8])];
  const U = [[Uv[0], Uv[3], Uv[4]], [Uv[3], Uv[1], Uv[5]], [Uv[4], Uv[5], Uv[2]]];
  let s = 0;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) s += U[i][j]*N[i]*N[j]*G[3*i + j];
  return s/3;
}

/* ---------- reflections ---------- */
// Powder reflections with d ≥ dmin, sorted by decreasing d: each orbit of h under the Laue
// group (the point group of the operations plus −1, i.e. Friedel pairs merged) once, with
// mult = orbit size; systematically absent ones (h·R = h and h·t ∉ ℤ for some operation)
// left out. Enumeration bound: |h| = |H·a| ≤ |H||a| = |a|/d, so |h| ≤ |a|/dmin holds for
// any cell, however oblique. The representative is the member with fewest negative
// indices, then the largest (h, k, l), so it reads (110), (210), (221) as in the tables.
function reflections(cell, ops, dmin){
  if (!(dmin > 0)) return [];
  const { G, Gs, V } = metric(cell);
  if (!(V > 0)) return [];      // angles that close no cell: no d is defined
  const list = ops && ops.length ? ops : [{ R: IDENT, t: [0,0,0] }];
  const laue = [], lk = new Set();
  for (const { R } of list) for (const M of [R, R.map(v => -v)]){
    const k = M.join(); if (!lk.has(k)){ lk.add(k); laue.push(M); }
  }
  const hm = Math.floor(Math.sqrt(G[0])/dmin + 1e-9), km = Math.floor(Math.sqrt(G[4])/dmin + 1e-9), lm = Math.floor(Math.sqrt(G[8])/dmin + 1e-9);
  const nk = 2*km + 1, nl = 2*lm + 1;
  const seen = new Uint8Array((2*hm + 1)*nk*nl);
  const idx = (h, k, l) => ((h + hm)*nk + (k + km))*nl + (l + lm);
  const inBox = (h, k, l) => Math.abs(h) <= hm && Math.abs(k) <= km && Math.abs(l) <= lm;
  const qmax = (1 + 1e-9)/(dmin*dmin);
  const better = (p, q) => {   // is member p a nicer representative than q?
    const np = (p[0] < 0) + (p[1] < 0) + (p[2] < 0), nq = (q[0] < 0) + (q[1] < 0) + (q[2] < 0);
    if (np !== nq) return np < nq;
    for (let i=0;i<3;i++) if (p[i] !== q[i]) return p[i] > q[i];
    return false;
  };
  const out = [];
  for (let h = -hm; h <= hm; h++) for (let k = -km; k <= km; k++) for (let l = -lm; l <= lm; l++){
    if (seen[idx(h, k, l)] || (!h && !k && !l)) continue;
    const q = h*h*Gs[0] + k*k*Gs[4] + l*l*Gs[8] + 2*(h*k*Gs[1] + h*l*Gs[2] + k*l*Gs[5]);
    if (q > qmax) continue;
    let mult = 0, rep = [h, k, l];
    for (const M of laue){
      const p = [h*M[0] + k*M[3] + l*M[6], h*M[1] + k*M[4] + l*M[7], h*M[2] + k*M[5] + l*M[8]];
      if (!inBox(p[0], p[1], p[2])) continue;
      const j = idx(p[0], p[1], p[2]);
      if (seen[j]) continue;
      seen[j] = 1; mult++;
      if (better(p, rep)) rep = p;
    }
    let absent = false;
    for (const { R, t } of list){
      if (h*R[0] + k*R[3] + l*R[6] !== h || h*R[1] + k*R[4] + l*R[7] !== k || h*R[2] + k*R[5] + l*R[8] !== l) continue;
      const ph = h*t[0] + k*t[1] + l*t[2];
      /* Allowed phases are integers. An operation of order n repeats as a pure translation of
         the group, so for h·R = h on a line the centring allows its phase is a multiple of 1/n
         (n = 2, 3, 4, 6; on a line a centring forbids, kept by a list that lacks it, of 1/(n·m),
         m = 2 or 3 the centring's order: 1/4 for a d-glide, 1/6 for a 2-fold of an R lattice):
         a forbidden one lies ≥ 1/(3n) from an integer, and 1/(4n) = 0.04–0.125 is the bound
         (over the 530 settings, |h| ≤ 8: 1/n and 1/(n·m) exactly). A pure translation (exact, on
         the 1/24 grid or k/|T|): 1/48. Up to v426 0.02 for all, which a translation fitted to
         noisy atoms can exceed at short d: findSymmetry accepts 0.01 Å, so h·t may be off by
         up to 0.01 Å/d (0.036 at d = 0.28 Å, Ag Kα at 180°; measured on P1 files with 3 mÅ of
         noise, up to 0.016 at d ≥ 0.25 Å, 80 % of the old bound). */
      const n = R.every((v, i) => v === IDENT[i]) ? 12 : rotOrder(R) || 12;
      if (Math.abs(ph - Math.round(ph)) > 0.25/n){ absent = true; break; }
    }
    if (!absent) out.push({ h: rep[0], k: rep[1], l: rep[2], d: 1/Math.sqrt(q), mult });
  }
  out.sort((x, y) => {
    if (Math.abs(x.d - y.d) > 1e-9*x.d) return y.d - x.d;
    return better([x.h, x.k, x.l], [y.h, y.k, y.l]) ? -1 : 1;
  });
  return out;
}

/* ---------- structure factors ---------- */
// Scattering amplitudes of every atom at s, each species and element looked up once.
function amplitudes(atoms, s, line){
  const f0c = new Map(), fpc = new Map(), s2 = s*s;
  const n = atoms.length, fr = new Float64Array(n), fi = new Float64Array(n);
  for (let j = 0; j < n; j++){
    const a = atoms[j], key = a.key || a.element || a.label, el = a.element || key;
    let f = f0c.get(key);
    if (f === undefined){ f = f0(key, s); f0c.set(key, f); }
    let fp = fpc.get(el);
    if (fp === undefined){ fp = line ? fprime(el, line) : [0, 0]; fpc.set(el, fp); }
    const w = (a.occ ?? 1)*Math.exp(-(a.Biso ?? 0)*s2);
    fr[j] = w*(f + fp[0]); fi[j] = w*fp[1];
  }
  return { fr, fi };
}
const hklOf = r => Array.isArray(r) ? r : [r.h, r.k, r.l];

// F(h) = Σ occ·exp(−B s²)·(f0 + f′ + i f″)·exp(2πi h·x) over the atoms of the cell.
// `line` is a characteristic line name ('CuKa1', …) for f′, f″; null for none.
function structureFactor(hkl, atoms, s, line){
  const [h, k, l] = hklOf(hkl);
  const { fr, fi } = amplitudes(atoms, s, line);
  let re = 0, im = 0;
  for (let j = 0; j < atoms.length; j++){
    const a = atoms[j], ph = 2*Math.PI*(h*a.x + k*a.y + l*a.z), c = Math.cos(ph), sn = Math.sin(ph);
    re += fr[j]*c - fi[j]*sn; im += fr[j]*sn + fi[j]*c;
  }
  return { re, im };
}
// (|F(h)|² + |F(−h)|²)/2: a powder line holds h and −h, which f″ makes unequal in a
// non-centrosymmetric structure. Both from one pass over the atoms.
function F2(hkl, atoms, s, line){
  const [h, k, l] = hklOf(hkl);
  const { fr, fi } = amplitudes(atoms, s, line);
  let r1 = 0, i1 = 0, r2 = 0, i2 = 0;
  for (let j = 0; j < atoms.length; j++){
    const a = atoms[j], ph = 2*Math.PI*(h*a.x + k*a.y + l*a.z), c = Math.cos(ph), sn = Math.sin(ph);
    r1 += fr[j]*c - fi[j]*sn; i1 += fr[j]*sn + fi[j]*c;   // F(h)
    r2 += fr[j]*c + fi[j]*sn; i2 += fi[j]*c - fr[j]*sn;   // F(−h): phase −ph
  }
  return 0.5*(r1*r1 + i1*i1 + r2*r2 + i2*i2);
}

/* ---------- lattice parameters under a constraint ---------- */
const kindOf = c => typeof c === 'string' ? { kind: c } : (c || { kind:'triclinic' });
// Names of the free lattice values, in the order latticeParams returns them.
function latticeNames(constraint){
  const c = kindOf(constraint);
  if (c.params) return c.params.slice();
  switch (c.kind){
    case 'cubic': case 'isotropic': return ['a'];
    case 'tetragonal': case 'hexagonal': return ['a','c'];
    case 'rhombohedral': return ['a','alpha'];
    case 'orthorhombic': return ['a','b','c'];
    case 'monoclinic': return ['a','b','c', { a:'alpha', c:'gamma' }[c.unique] || 'beta'];
    default: return ['a','b','c','alpha','beta','gamma'];
  }
}
// With a conventional basis (classify), the values are the conventional cell's.
function latticeParams(constraint, cell){
  const c = kindOf(constraint);
  const cc = c.basis && c.conv ? cellInBasis(cell, c.basis) : cell;
  return latticeNames(c).map(n => cc[n]);
}
// The cell from the free values; whatever the constraint fixes comes from `template` (the
// starting cell), except the angles the symmetry fixes, which are set exactly (90°, and 120°
// or 60° for γ of a hexagonal cell): a file's 89.99° or 119.99°, accepted within the rounding of its
// digits, would otherwise stay in the refined metric. With a conventional basis the values
// build the conventional cell (its own template), and the cell returned is the one given, in
// its own basis.
function cellFrom(constraint, values, template){
  const c0 = kindOf(constraint);
  if (c0.basis && c0.conv) return cellInBasis(cellFrom({ kind: c0.kind, unique: c0.unique, params: c0.params }, values, c0.conv), inv3(c0.basis));
  const c = c0, v = values, T = template;
  const cell = { a: T.a, b: T.b, c: T.c, alpha: T.alpha, beta: T.beta, gamma: T.gamma };
  const right = (...ks) => ks.forEach(k => { cell[k] = 90; });
  switch (c.kind){
    case 'cubic': cell.a = cell.b = cell.c = v[0]; right('alpha', 'beta', 'gamma'); break;
    case 'isotropic': { const f = v[0]/T.a; cell.a = v[0]; cell.b = T.b*f; cell.c = T.c*f; break; }
    case 'tetragonal': case 'hexagonal': cell.a = cell.b = v[0]; cell.c = v[1]; right('alpha', 'beta'); cell.gamma = c.kind === 'hexagonal' ? (T.gamma > 90 ? 120 : 60) : 90; break;
    case 'rhombohedral': cell.a = cell.b = cell.c = v[0]; cell.alpha = cell.beta = cell.gamma = v[1]; break;
    case 'orthorhombic': cell.a = v[0]; cell.b = v[1]; cell.c = v[2]; right('alpha', 'beta', 'gamma'); break;
    case 'monoclinic': { const u = latticeNames(c)[3]; cell.a = v[0]; cell.b = v[1]; cell.c = v[2]; right(...['alpha', 'beta', 'gamma'].filter(k => k !== u)); cell[u] = v[3]; break; }
    default: [cell.a, cell.b, cell.c, cell.alpha, cell.beta, cell.gamma] = v;
  }
  return cell;
}

export { parseCif, parseSymop, symopString, parseFormula, metric, dSpacing, expandAtoms, cellContents, cellMass,
         checkComposition, findSymmetry, structureCell, holohedry, reflections, structureFactor, F2, latticeNames, latticeParams, cellFrom,
         atomOrbits, siteAdpBasis, adpU, betaOf, uEquiv, U_NAMES };
