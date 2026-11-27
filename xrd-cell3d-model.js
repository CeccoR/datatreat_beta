/* =========================================================
   XRPD — a phase's unit cell in 3D: what it draws, and where (v564, out of
   xrd-cell3d.js cellView). The cell's model (its atoms as spheres wherever they reach in
   the cell's closed box, its corners and edges, the radius that holds it, a, b and c), the
   projection of a frame, the edges behind the centre and in front of it, the spheres back
   to front and how each is shaded, the triad's corner, the words for a screen reader, the
   view kept and put back. Plain functions with no page; the turns, the keys and the double
   tap are the crystallites' shape's (xrd-shape3d-model.js turned, keyTurn, doubleTap).
   The canvas, its events and what follows the page: xrd-cell3d.js.
========================================================= */
import { reortho, viewAt } from './xrd-shape3d-model.js';

export const DEG = Math.PI / 180;
export const HOME_AZ = -62 * DEG, HOME_EL = 18 * DEG;
// The view a cell opens on, and goes back to.
export const homeView = () => viewAt(HOME_AZ, HOME_EL);

// Jmol's element colours.
export const COLORS = { H:'#FFFFFF', He:'#D9FFFF', Li:'#CC80FF', Be:'#C2FF00', B:'#FFB5B5', C:'#909090', N:'#3050F8', O:'#FF0D0D', F:'#90E050', Ne:'#B3E3F5',
  Na:'#AB5CF2', Mg:'#8AFF00', Al:'#BFA6A6', Si:'#F0C8A0', P:'#FF8000', S:'#FFFF30', Cl:'#1FF01F', Ar:'#80D1E3', K:'#8F40D4', Ca:'#3DFF00',
  Sc:'#E6E6E6', Ti:'#BFC2C7', V:'#A6A6AB', Cr:'#8A99C7', Mn:'#9C7AC7', Fe:'#E06633', Co:'#F090A0', Ni:'#50D050', Cu:'#C88033', Zn:'#7D80B0',
  Ga:'#C28F8F', Ge:'#668F8F', As:'#BD80E3', Se:'#FFA100', Br:'#A62929', Kr:'#5CB8D1', Rb:'#702EB0', Sr:'#00FF00', Y:'#94FFFF', Zr:'#94E0E0',
  Nb:'#73C2C9', Mo:'#54B5B5', Tc:'#3B9E9E', Ru:'#248F8F', Rh:'#0A7D8C', Pd:'#006985', Ag:'#C0C0C0', Cd:'#FFD98F', In:'#A67573', Sn:'#668080',
  Sb:'#9E63B5', Te:'#D47A00', I:'#940094', Xe:'#429EB0', Cs:'#57178F', Ba:'#00C900', La:'#70D4FF', Ce:'#FFFFC7', Pr:'#D9FFC7', Nd:'#C7FFC7',
  Pm:'#A3FFC7', Sm:'#8FFFC7', Eu:'#61FFC7', Gd:'#45FFC7', Tb:'#30FFC7', Dy:'#1FFFC7', Ho:'#00FF9C', Er:'#00E675', Tm:'#00D452', Yb:'#00BF38',
  Lu:'#00AB24', Hf:'#4DC2FF', Ta:'#4DA6FF', W:'#2194D6', Re:'#267DAB', Os:'#266696', Ir:'#175487', Pt:'#D0D0E0', Au:'#FFD123', Hg:'#B8B8D0',
  Tl:'#A6544D', Pb:'#575961', Bi:'#9E4FB5', Th:'#00BAFF', U:'#008FFF' };
// Covalent radii (Å), for the spheres' sizes.
export const RADII = { H:.31, Li:1.28, Be:.96, B:.84, C:.76, N:.71, O:.66, F:.57, Na:1.66, Mg:1.41, Al:1.21, Si:1.11, P:1.07, S:1.05, Cl:1.02,
  K:2.03, Ca:1.76, Sc:1.70, Ti:1.60, V:1.53, Cr:1.39, Mn:1.39, Fe:1.32, Co:1.26, Ni:1.24, Cu:1.32, Zn:1.22, Ga:1.22, Ge:1.20, As:1.19,
  Se:1.20, Br:1.20, Rb:2.20, Sr:1.95, Y:1.90, Zr:1.75, Nb:1.64, Mo:1.54, Ru:1.46, Rh:1.42, Pd:1.39, Ag:1.45, Cd:1.44, In:1.42, Sn:1.39,
  Sb:1.39, Te:1.38, I:1.39, Cs:2.44, Ba:2.15, La:2.07, Ce:2.04, Pr:2.03, Nd:2.01, Sm:1.98, Eu:1.98, Gd:1.96, Tb:1.94, Dy:1.92, Ho:1.92,
  Er:1.89, Tm:1.90, Yb:1.87, Lu:1.87, Hf:1.75, Ta:1.70, W:1.62, Re:1.51, Os:1.44, Ir:1.41, Pt:1.36, Au:1.36, Hg:1.32, Tl:1.45, Pb:1.46,
  Bi:1.48, Th:2.06, U:1.96 };
// The spheres at this share of the covalent radius: big enough to tell the atoms
// apart, small enough to see through the cell.
export const BALL = 0.42;
export const elementColor = el => COLORS[el] || '#ff66cc';

// The cell's axes in Cartesian coordinates (a along x, b in the xy plane): rows a, b, c.
export function axesOf(c){
  const r = DEG, ca = Math.cos(c.alpha*r), cb = Math.cos(c.beta*r), cg = Math.cos(c.gamma*r), sg = Math.sin(c.gamma*r);
  const cx = c.c*cb, cy = c.c*(ca - cb*cg)/sg, cz = Math.sqrt(Math.max(0, c.c*c.c - cx*cx - cy*cy));
  return [[c.a, 0, 0], [c.b*cg, c.b*sg, 0], [cx, cy, cz]];
}
export const rgb = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
export const css = (c, k = 1) => `rgb(${Math.round(Math.min(255, c[0]*k))},${Math.round(Math.min(255, c[1]*k))},${Math.round(Math.min(255, c[2]*k))})`;

/* The model of a phase: { cell, atoms: [{ element, x, y, z, occ }] } (fractions of the
   cell) → the spheres (every image of an atom within the cell's closed box), the eight
   corners, and the radius that holds it all, about the cell's centre. */
export function buildModel(ph){
  const A = axesOf(ph.cell), at = (f) => [0, 1, 2].map(j => f[0]*A[0][j] + f[1]*A[1][j] + f[2]*A[2][j]);
  const ctr = at([0.5, 0.5, 0.5]);
  const rel = p => [p[0] - ctr[0], p[1] - ctr[1], p[2] - ctr[2]];
  const E = 1e-3, balls = [];
  for (const a of ph.atoms){
    const f = [a.x, a.y, a.z].map(v => { const w = v - Math.floor(v); return w > 1 - E ? 0 : w; });
    const rng = v => v < E ? [0, 1] : [0];
    for (const i of rng(f[0])) for (const j of rng(f[1])) for (const k of rng(f[2])){
      const el = a.element || 'X';
      balls.push({ el, p: rel(at([f[0] + i, f[1] + j, f[2] + k])), r: BALL*(RADII[el] || 1.5), occ: a.occ == null ? 1 : Math.min(1, a.occ), col: rgb(elementColor(el)) });
    }
  }
  const corners = [];
  for (let i = 0; i < 8; i++) corners.push(rel(at([i & 1, (i >> 1) & 1, (i >> 2) & 1])));
  let Rb = 0;
  for (const c of corners) Rb = Math.max(Rb, Math.hypot(...c));
  for (const b of balls) Rb = Math.max(Rb, Math.hypot(...b.p) + b.r);
  // a, b, c as unit vectors, for the triad
  const axes = A.map(v => { const n = Math.hypot(...v) || 1; return v.map(x => x/n); });
  return { balls, corners, Rb, axes };
}
// The cell's twelve edges, as corner pairs.
export const EDGES = [[0, 1], [0, 2], [0, 4], [1, 3], [1, 5], [2, 3], [2, 6], [4, 5], [4, 6], [3, 7], [5, 7], [6, 7]];

/* A frame of a Sz-pixel square (CSS pixels) seen through R: the scale k that fits the
   cell's radius inside a margin, P a point (about the cell's centre) on the canvas with
   its depth towards the viewer, C the eight corners so placed. */
export function frameOf(m, R, Sz){
  const pad = 14 + 0.04*Sz, k = (Sz/2 - pad)/m.Rb, cx = Sz/2, cy = Sz/2;
  const [r00, r01, r02, r10, r11, r12, r20, r21, r22] = R;
  const P = p => [cx + k*(r00*p[0] + r01*p[1] + r02*p[2]), cy - k*(r10*p[0] + r11*p[1] + r12*p[2]), r20*p[0] + r21*p[1] + r22*p[2]];
  return { k, P, C: m.corners.map(P) };
}
// The edges behind the cell's centre (front false), drawn first, or those in front (true),
// over the atoms: each by the depth of its middle.
export function edgesOf(C, front){
  const depth = e => (C[e[0]][2] + C[e[1]][2])/2;
  return EDGES.filter(e => front ? depth(e) >= 0 : depth(e) < 0);
}
// The spheres with their places, back to front.
export const ballsInOrder = (m, P) => m.balls.map(b => ({ b, q: P(b.p) })).sort((u, v) => u.q[2] - v.q[2]);
/* A sphere at q drawn at scale k: its radius on the canvas (1.5 px at least), its radial
   gradient (lit from the top left: from, to) and stops, its opacity by its occupancy. */
export function ballLook(b, q, k){
  const rr = Math.max(1.5, b.r*k);
  return { rr, grad: [q[0] - rr*0.35, q[1] - rr*0.35, rr*0.1, q[0], q[1], rr],
    stops: [[0, css(b.col, 1.25)], [0.55, css(b.col)], [1, css(b.col, 0.45)]], alpha: 0.45 + 0.55*b.occ };
}
// a, b, c in the top right corner of a Sz-pixel square: where and as large as the
// crystallites' shape has them (xrd-shape3d.js drawTriad).
export const triadOf = Sz => ({ at: { x: Sz - 30, y: 30, L: 18 }, fs: Sz >= 280 ? 12 : 11 });
// The square's side, in whole pixels, from what its card gives (none: 0).
export const sideOf = s => s > 0 ? Math.round(s) : 0;
// The canvas's words for a screen reader.
export const describeCell = ph => `The unit cell of ${ph.name} in 3D: ${ph.atoms.length} atoms. Drag or use the arrow keys to rotate, Home to reset.`;

/* How the cell is turned, as plain numbers (JSON-safe), null at the home view; rotationIn
   takes one back: a rotation, or near enough to be put right; anything else (a mirror, a
   squashed matrix, not nine numbers) is not a view: null. */
export function viewOf(R){
  const H = homeView();
  return R.every((x, i) => x === H[i]) ? null : { R: R.slice() };
}
export function rotationIn(v){
  if (!v || !Array.isArray(v.R) || v.R.length !== 9) return null;
  const M = v.R.map(Number);
  if (!M.every(Number.isFinite)) return null;
  const [a, b, c] = [M.slice(0, 3), M.slice(3, 6), M.slice(6, 9)], dot = (u, w) => u[0]*w[0] + u[1]*w[1] + u[2]*w[2];
  const err = Math.max(...[a, b, c].map(u => Math.abs(dot(u, u) - 1)), Math.abs(dot(a, b)), Math.abs(dot(b, c)), Math.abs(dot(a, c)));
  const det = dot(a, [b[1]*c[2] - b[2]*c[1], b[2]*c[0] - b[0]*c[2], b[0]*c[1] - b[1]*c[0]]);
  if (err > 1e-3 || det < 0.5) return null;
  return err < 1e-12 ? M : reortho(M);
}
