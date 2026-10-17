/* =========================================================
   XRPD — a phase's space group, as its Hermann–Mauguin symbol.
   A CIF that names its group says it (spaceGroupName). One in P1, as the Materials
   Project serves them, has only the symmetry found from its atoms (findSymmetry):
   the symbol is then read off those operations (spaceGroupSymbol). In the conventional
   cell, along each of the crystal system's symmetry directions, the operations whose
   axis lies along it give the rotation or screw axis there (the intrinsic translation
   along the axis, in periods of the lattice along it, its sense from the Cartesian
   frame), and those whose plane is normal to it the mirror or glide plane (the
   intrinsic translation in the plane); the lattice's centring gives the letter. Where
   a centring gives several elements at one place, the symbol's rules choose: a
   rotation before a screw, m before e, before a, b, c, before n, before d. Checked on
   the 230 groups in their standard settings, each built from a general position.
========================================================= */

const det3 = m => m[0]*(m[4]*m[8]-m[5]*m[7]) - m[1]*(m[3]*m[8]-m[5]*m[6]) + m[2]*(m[3]*m[7]-m[4]*m[6]);
function inv3(m){
  const d = det3(m);
  return [ (m[4]*m[8]-m[5]*m[7])/d, (m[2]*m[7]-m[1]*m[8])/d, (m[1]*m[5]-m[2]*m[4])/d,
           (m[5]*m[6]-m[3]*m[8])/d, (m[0]*m[8]-m[2]*m[6])/d, (m[2]*m[3]-m[0]*m[5])/d,
           (m[3]*m[7]-m[4]*m[6])/d, (m[1]*m[6]-m[0]*m[7])/d, (m[0]*m[4]-m[1]*m[3])/d ];
}
const mul3 = (a, b) => { const c = new Array(9); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) c[3*i+j] = a[3*i]*b[j] + a[3*i+1]*b[3+j] + a[3*i+2]*b[6+j]; return c; };
const app3 = (m, v) => [m[0]*v[0]+m[1]*v[1]+m[2]*v[2], m[3]*v[0]+m[4]*v[1]+m[5]*v[2], m[6]*v[0]+m[7]*v[1]+m[8]*v[2]];
const neg = m => m.map(v => -v);
const isI = m => m.every((v, i) => v === (i % 4 === 0 ? 1 : 0));
const eq3 = (a, b) => a.every((v, i) => v === b[i]);
const tr = m => m[0] + m[4] + m[8];
// A fraction to [0, 1), its rounding to the 1/24 grid every space group's translations lie on.
const mod1 = v => { let x = Math.round(v*24)/24; x -= Math.floor(x); return x > 1 - 1e-9 ? 0 : x; };
const red = t => t.map(mod1);
const key = t => red(t).map(v => Math.round(v*24)).join();
// The order of a proper rotation from its trace.
const ORDER = { 3: 1, '-1': 2, 0: 3, 1: 4, 2: 6 };

// The cell's axes in Cartesian coordinates (columns, row-major), a along x.
function cartOf(c){
  const r = Math.PI/180, ca = Math.cos(c.alpha*r), cb = Math.cos(c.beta*r), cg = Math.cos(c.gamma*r), sg = Math.sin(c.gamma*r);
  const cx = c.c*cb, cy = c.c*(ca - cb*cg)/sg, cz = Math.sqrt(Math.max(0, c.c*c.c - cx*cx - cy*cy));
  return [c.a, c.b*cg, cx, 0, c.b*sg, cy, 0, 0, cz];
}
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const dot = (a, b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];

// The space group a CIF names, as it is usually written ('P m -3 m' → 'Pm-3m', 'P 1 21/c 1'
// → 'P2_1/c', 'R -3 m :H' → 'R-3m'); null for P1 or none.
export function spaceGroupName(hm){
  if (!hm || typeof hm !== 'string') return null;
  let s = hm.trim().replace(/^['"]|['"]$/g, '').replace(/\s*:.*$/, '').trim();
  if (!s || /^p\s*1$/i.test(s)) return null;
  const parts = s.split(/\s+/);
  // The full monoclinic symbol (P 1 21/c 1) is short without its 1s.
  if (parts.length === 4 && parts[1] === '1' && parts[3] === '1') parts.splice(3, 1), parts.splice(1, 1);
  else if (parts.length === 4 && parts[1] === '1' && parts[2] === '1') parts.splice(1, 2);
  else if (parts.length === 4 && parts[2] === '1' && parts[3] === '1') parts.splice(2, 2);
  return parts.map((p, i)=> i ? p.replace(/(\d)(\d)/g, (m, a, b)=> a + '_' + b) : p).join('');
}

/* The symbol of the group of the operations ops (R, t in the cell's fractions), the cell
   given, its constraint (findSymmetry's: a conventional basis when the cell is not in a
   standard setting). null when no conventional cell was found, or the centring is not
   one of the lattice types. */
export function spaceGroupSymbol(cell, ops, constraint){
  const k = constraint && constraint.kind;
  if (!ops || !ops.length || k === 'isotropic') return null;
  // The conventional basis: columns in the cell's fractions.
  const M0 = constraint.basis ? constraint.basis.slice()
    : k === 'rhombohedral' ? [1, 0, 1, -1, 1, 1, 0, -1, 1]      // obverse hexagonal axes
    : [1, 0, 0, 0, 1, 0, 0, 0, 1];
  const sym = symbolIn(cell, ops, M0);
  /* An orthorhombic cell's axes found from the atoms (a primitive cell of a centred
     lattice, as the Materials Project serves them) are in no particular order: the
     symbol is given in the standard setting, the axes permuted to the one that has it. */
  if (sym && isOrtho(sym) && !ORTHO.has(sym)){
    for (const P of PERMS){ const s = symbolIn(cell, ops, mul3(M0, P)); if (ORTHO.has(s)) return s; }
  }
  return sym;
}
const ORTHO = new Set(('P222 P222_1 P2_12_12 P2_12_12_1 C222_1 C222 F222 I222 I2_12_12_1 Pmm2 Pmc2_1 Pcc2 Pma2 Pca2_1 Pnc2 Pmn2_1 Pba2 Pna2_1 Pnn2 '
  + 'Cmm2 Cmc2_1 Ccc2 Amm2 Aem2 Ama2 Aea2 Fmm2 Fdd2 Imm2 Iba2 Ima2 Pmmm Pnnn Pccm Pban Pmma Pnna Pmna Pcca Pbam Pccn Pbcm Pnnm Pmmn Pbcn Pbca Pnma '
  + 'Cmcm Cmce Cmmm Cccm Cmme Ccce Fmmm Fddd Immm Ibam Ibca Imma').split(' '));
// An orthorhombic symbol: three positions, each a 2-fold, a screw or a plane.
const isOrtho = s => /^[PABCFI]((2(_1)?)|[mabcden]){3}$/.test(s);
// The axes' six orders, right-handed (the odd ones with one axis reversed).
const PERMS = [[0, 1, 0, 0, 0, 1, 1, 0, 0], [0, 0, 1, 1, 0, 0, 0, 1, 0], [0, 1, 0, 1, 0, 0, 0, 0, -1], [1, 0, 0, 0, 0, 1, 0, -1, 0], [0, 0, -1, 0, 1, 0, 1, 0, 0]];
function symbolIn(cell, ops, M){
  const Mi = inv3(M);
  const A = mul3(cartOf(cell), M), Ai = inv3(A);
  // The centrings: the cell's lattice in the conventional cell, and the pure translations.
  const cen = new Map([['0,0,0', [0, 0, 0]]]);
  for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) for (let l = -3; l <= 3; l++){ const t = red(app3(Mi, [i, j, l])); cen.set(key(t), t); }
  const ops2 = ops.map(o => ({ R: mul3(mul3(Mi, o.R), M).map(v => Math.round(v)), t: red(app3(Mi, o.t)) }));
  ops2.forEach(o => { if (isI(o.R)) cen.set(key(o.t), o.t); });
  const C = [...cen.values()];
  const all = new Map();
  for (const o of ops2) for (const c of C){ const t = red([o.t[0]+c[0], o.t[1]+c[1], o.t[2]+c[2]]); all.set(o.R.join() + '|' + key(t), { R: o.R, t }); }
  const G = [...all.values()];
  const Rs = []; for (const { R } of G) if (!Rs.some(Q => eq3(Q, R))) Rs.push(R);
  const has = R => Rs.some(Q => eq3(Q, R));
  const inv = has(neg([1, 0, 0, 0, 1, 0, 0, 0, 1]));

  // The lattice letter.
  const tr0 = C.filter(t => t.some(v => v));
  const at = v => tr0.some(t => t.every((x, i) => Math.abs(x - v[i]) < 1e-6));
  const h = 1/2, t1 = 1/3, t2 = 2/3;
  const L = !tr0.length ? 'P' : tr0.length === 1 && at([h, h, h]) ? 'I' : tr0.length === 3 && at([0, h, h]) && at([h, 0, h]) && at([h, h, 0]) ? 'F'
    : tr0.length === 1 && at([0, h, h]) ? 'A' : tr0.length === 1 && at([h, 0, h]) ? 'B' : tr0.length === 1 && at([h, h, 0]) ? 'C'
    : tr0.length === 2 && at([t2, t1, t1]) && at([t1, t2, t2]) ? 'R' : null;
  if (!L) return null;

  // The crystal system from the point group.
  const props = Rs.map(R => det3(R) > 0 ? R : neg(R)), ords = props.map(P => ORDER[tr(P)]);
  const n3 = ords.filter(o => o === 3).length, n2 = ords.filter(o => o === 2).length;
  const sys = n3 >= 8 ? 'cubic' : ords.includes(6) ? 'hexagonal' : n3 ? 'trigonal' : ords.includes(4) ? 'tetragonal'
    : n2 >= 3 ? 'orthorhombic' : n2 ? 'monoclinic' : 'triclinic';

  // The lattice's period along d (a primitive integer direction), as a fraction of d.
  const period = d => { for (let n = 6; n >= 1; n--) if (cen.has(key(d.map(v => v/n)))) return 1/n; return 1; };
  // How far along d a translation w parallel to it goes, in units of d.
  const along = (w, d) => { const i = [0, 1, 2].reduce((b, j) => Math.abs(d[j]) > Math.abs(d[b]) ? j : b, 0); return w[i]/d[i]; };
  // Each operation with every lattice translation of the cell around it added: the
  // intrinsic part of a rotation or reflection about an axis or plane not along the cell's
  // axes (a 2-fold along [110], a mirror normal to it) changes by half a period with them.
  const SHIFTS = []; for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let l = -1; l <= 1; l++) SHIFTS.push([i, j, l]);
  const shifted = t => SHIFTS.map(n => [t[0]+n[0], t[1]+n[1], t[2]+n[2]]);
  // The rotation or screw axis along d ('4_2', '-4', '2_1'…), or null. A rotoinversion of a
  // higher order than the rotations there is the axis (-4 over the 2-fold it holds).
  function axis(d){
    let best = 0, bar = 0;
    for (const { R } of G){
      if (det3(R) > 0){ if (!isI(R) && eq3(app3(R, d), d)) best = Math.max(best, ORDER[tr(R)]); }
      else if (eq3(app3(R, d), neg(d))){ const n = ORDER[tr(neg(R))]; if (n >= 3) bar = Math.max(bar, n); }
    }
    if (bar > best) return '-' + bar;
    if (!best) return null;
    const dc = app3(A, d), u = Math.abs(dc[0]) < 0.9*Math.hypot(...dc) ? [1, 0, 0] : [0, 1, 0], v = cross(dc, u);
    const p = period(d), screws = new Set();
    for (const { R, t: t0 } of G){
      if (det3(R) < 0 || !eq3(app3(R, d), d) || ORDER[tr(R)] !== best) continue;
      // The positive turn about d (counterclockwise looking down it).
      if (best > 2 && dot(cross(v, app3(mul3(mul3(A, R), Ai), v)), dc) < 0) continue;
      for (const t of shifted(t0)){
        let w = [0, 0, 0], P = [1, 0, 0, 0, 1, 0, 0, 0, 1];
        for (let k = 0; k < best; k++){ const s = app3(P, t); w = [w[0]+s[0], w[1]+s[1], w[2]+s[2]]; P = mul3(R, P); }
        w = w.map(x => x/best);
        let f = along(w, d)/p; f -= Math.floor(f + 1e-9);
        screws.add(Math.round(f*best) % best);
      }
    }
    const m = screws.has(0) ? 0 : Math.min(...screws);
    return best + (m ? '_' + m : '');
  }
  /* The mirror or glide plane normal to d ('m', 'c', 'n', 'd', 'e'…), or null. Where a
     centring puts several glides in one plane, the symbol's: an axial one before n, and
     of the axial ones, c in a tetragonal group (I4cm, I4₁/acd), else the first; n before
     c across the cube's face diagonals of a primitive cubic group (Pm-3n, P-43n). */
  function plane(d, nFirst){
    const S = new Set();
    for (const { R, t: t0 } of G){
      if (det3(R) > 0 || tr(R) !== 1 || !eq3(app3(R, d), neg(d))) continue;
      for (const t of shifted(t0)){
        const Rt = app3(R, t), w = [0, 1, 2].map(i => { let x = mod1((t[i] + Rt[i])/2); if (x > 0.5 + 1e-9) x -= 1; return Math.abs(x); });
        const halves = w.filter(x => Math.abs(x - 0.5) < 1e-6).length, quarters = w.filter(x => Math.abs(x - 0.25) < 1e-6).length;
        if (w.every(x => x < 1e-6)) S.add('m');
        else if (quarters) S.add('d');
        else if (halves === 1) S.add('abc'[w.findIndex(x => Math.abs(x - 0.5) < 1e-6)]);
        else S.add('n');
      }
    }
    if (S.has('m')) return 'm';
    if (nFirst && S.has('n')) return 'n';
    const ax = (sys === 'tetragonal' ? ['c', 'a', 'b'] : ['a', 'b', 'c']).filter(x => S.has(x));
    // Two axial glides in one plane, a centring in it apart: the double glide e.
    if (ax.length > 1 && 'ABC'.includes(L) && sys === 'orthorhombic') return 'e';
    if (ax.length) return ax[0];
    return S.has('n') ? 'n' : S.has('d') ? 'd' : null;
  }
  const either = d => plane(d) || axis(d);
  let sym;
  if (sys === 'triclinic') sym = L + (inv ? '-1' : '1');
  else if (sys === 'monoclinic'){
    // The unique axis: the 2-fold's, or the mirror's normal (the axis of -R).
    const R2 = Rs.find(R => !isI(R) && tr(det3(R) > 0 ? R : neg(R)) === -1);
    const P2 = R2 && (det3(R2) > 0 ? R2 : neg(R2));
    const d = P2 && [[1, 0, 0], [0, 1, 0], [0, 0, 1]].find(u => eq3(app3(P2, u), u));
    if (!d) return null;
    const a = axis(d), pl = plane(d);
    sym = L + (a && pl ? a + '/' + pl : a || pl);
  } else if (sys === 'orthorhombic'){
    sym = L + [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map(d => either(d) || '1').join('');
    // I222 and I2₁2₁2₁ both hold 2 and 2₁ along every axis: in I222 the 2-fold axes meet.
    if (sym === 'I222' && !axesMeet(G, [[1, 0, 0], [0, 1, 0], [0, 0, 1]])) sym = 'I2_12_12_1';
    // Every plane of Ibca holds two glides (the centring between them): the symbol's are b, c, a.
    if (sym === 'Ibaa') sym = 'Ibca';
  } else if (sys === 'tetragonal'){
    const c = [0, 0, 1], a = axis(c), pl = plane(c);
    const s2 = either([1, 0, 0]), s3 = either([1, -1, 0]);
    sym = L + (pl && a && a[0] !== '-' ? a + '/' + pl : a) + (s2 || s3 ? (s2 || '1') + (s3 || '1') : '');
  } else if (sys === 'trigonal' || sys === 'hexagonal'){
    const c = [0, 0, 1];
    let a = axis(c);
    const pl = plane(c);
    if (sys === 'trigonal' && inv) a = '-3';
    const first = sys === 'hexagonal' && pl && a && a[0] !== '-' ? a + '/' + pl : a;
    const s2 = either([1, 0, 0]), s3 = either([1, -1, 0]);
    sym = L + first + (L === 'R' ? (s2 || '') : s2 || s3 ? (s2 || '1') + (s3 || '1') : '');
  } else {
    const s1 = either([0, 0, 1]), s3 = plane([1, -1, 0], L === 'P') || axis([1, -1, 0]);
    sym = L + s1 + (inv ? '-3' : '3') + (s3 || '');
    if (sym === 'I23' && !axesMeet(G, [[1, 0, 0], [0, 1, 0], [0, 0, 1]])) sym = 'I2_13';
  }
  return sym;
}
// Do pure 2-fold rotations about the given directions pass through one point? (On the
// 1/8 grid, where every such point of these groups lies.)
function axesMeet(G, dirs){
  const pure = dirs.map(d => G.filter(({ R, t }) => det3(R) > 0 && tr(R) === -1 && eq3(app3(R, d), d)
    && Math.abs(mod1((t[0] + app3(R, t)[0])/2)) + Math.abs(mod1((t[1] + app3(R, t)[1])/2)) + Math.abs(mod1((t[2] + app3(R, t)[2])/2)) < 1e-6));
  if (pure.some(l => !l.length)) return false;
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) for (let k = 0; k < 8; k++){
    const p = [i/8, j/8, k/8];
    if (pure.every(l => l.some(({ R, t }) => { const q = app3(R, p); return [0, 1, 2].every(n => { const x = mod1(q[n] + t[n] - p[n]); return x < 1e-6 || x > 1 - 1e-6; }); }))) return true;
  }
  return false;
}
// The symbol written with subscript screws (P2₁/c, P6₃/mmc) for the page.
const SUB = { 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅' };
export const sgPretty = s => s ? s.replace(/_(\d)/g, (m, d)=> SUB[d] || d) : '';
