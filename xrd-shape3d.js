/* =========================================================
   XRPD — the crystallites' shape in 3D.
   A small view of the solid a free-shape refinement gives (ellipsoid, spheroid,
   cylinder, elliptic cylinder or box, in nm) with up to three crystal directions
   drawn through it, each with its 1σ angular uncertainty as a translucent cone.
   Software 3D on a 2D canvas: no WebGL, no library. The solid is drawn axis-aligned
   in its own body frame and the directions are brought into that frame, so only the
   camera moves: a drag (mouse, pen or touch) or the arrow keys rotate it, a double
   click or tap (or Home) resets it. Nothing runs while the view is idle. The camera
   can be read and put back (getView / setView), so a card can keep a user's turn
   across a re-render.

   The solid is convex, which makes a translucent one easy to draw right without
   sorting its faces: only its front faces are painted, opaque, on a layer of
   their own (no two of them overlap), and that layer is laid over the scene at a
   fixed alpha. Every bit of line or cone is classed by a ray test against the exact
   solid as hidden (inside it, or behind it from the viewer) or not: the hidden bits
   go under the solid's layer and show through it dimmed, the others on top.
========================================================= */

const DEG = Math.PI / 180;
const SOLID_ALPHA = 0.66;    // the solid over what it hides: the lines through it stay readable
const CONE_ALPHA = 0.16;     // the uncertainty cones: there, but not in the way
const ESD_MAX = 60;          // a wider 1σ than this (or none) means the direction is not determined
const OFF_MIN = 0.05;        // an angle off the axis under this is none (the card says 'held' then)
const OPEN_RATIO = 20;       // an extent over 20x the smallest other one counts as endless (a rod, a sheet)
const OPEN_CAP = 4;          // an endless or unknown extent is drawn 4x the largest closed one, fading out
const SIZE_MIN = 200, SIZE_MAX = 320;
// The offscreen layers at 2 pixels per CSS pixel at most (the solid), or 1.5 on screen
// (the cones, faint and soft): they are fills under crisp edges and lines drawn at full
// resolution, and on a 3x screen the full ratio would more than double their cost for
// nothing one can see. A PNG takes the cones at 2 as well.
const LAYER_MAX = 2, CONE_LAYER_MAX = 1.5;
const TYPE_NAMES = { ellipsoid: 'ellipsoid', spheroid: 'spheroid', cylinder: 'cylinder', ellcyl: 'elliptic cylinder', box: 'box' };
// The home view: the camera 38° round from body x towards y and 24° above the xy
// plane, body z up. No body axis is end-on or edge-on, and a disc shows its face.
const HOME_AZ = 38 * DEG, HOME_EL = 24 * DEG;
// Light from the upper left, in front: fixed to the camera, so the shading reads the
// same whichever way the solid is turned.
const LIGHT = (() => { const l = [-0.42, 0.58, 0.70], n = Math.hypot(...l); return l.map(v => v / n); })();

const dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
const cross = (a, b) => [a[1]*b[2] - a[2]*b[1], a[2]*b[0] - a[0]*b[2], a[0]*b[1] - a[1]*b[0]];
const unit = a => { const n = Math.hypot(a[0], a[1], a[2]); return n > 1e-12 ? [a[0]/n, a[1]/n, a[2]/n] : null; };
const vec3 = v => (v && typeof v.length === 'number' && v.length >= 3) ? [Number(v[0]), Number(v[1]), Number(v[2])] : null;
const num = v => (v == null || v === '') ? NaN : Number(v);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
// Degrees as the card gives them: whole ones from 10°, one decimal under; under 0.05° one
// significant figure, so that a tight angle never reads as a flat ±0.0°.
const fmtDeg = x => !(x > 0) ? '0' : x >= 9.95 ? String(Math.round(x)) : x >= 0.05 ? x.toFixed(1)
  : x >= 0.0005 ? String(+x.toPrecision(1)) : '0.000';
const fmtNm = x => x >= 100 ? String(Math.round(x)) : x >= 10 ? String(+x.toFixed(1)) : String(+x.toPrecision(2));
// The angle off the nearest body axis, worth a mention only for a determined direction and
// when it is there at all (a direction held on the axis has 0).
const offShown = d => d.det && Number.isFinite(d.off) && d.off >= OFF_MIN;

/* ---------- 3x3 rotations (row-major arrays of 9) ---------- */
const matMul = (A, B) => {
  const C = new Array(9);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) C[3*i + j] = A[3*i]*B[j] + A[3*i + 1]*B[3 + j] + A[3*i + 2]*B[6 + j];
  return C;
};
function axisAngle(k, t){                       // Rodrigues
  const c = Math.cos(t), s = Math.sin(t), v = 1 - c, [x, y, z] = k;
  return [c + x*x*v, x*y*v - z*s, x*z*v + y*s,
          y*x*v + z*s, c + y*y*v, y*z*v - x*s,
          z*x*v - y*s, z*y*v + x*s, c + z*z*v];
}
// Many small drag steps let rounding creep in: put the rows back to orthonormal.
function reortho(R){
  const x = unit(R.slice(0, 3)), y0 = R.slice(3, 6), d = dot(x, y0);
  const y = unit([y0[0] - d*x[0], y0[1] - d*x[1], y0[2] - d*x[2]]), z = cross(x, y);
  return [...x, ...y, ...z];
}
// The camera at azimuth az round body z from x, elevation el above the xy plane, z up.
function viewAt(az, el){
  const zc = [Math.cos(el)*Math.cos(az), Math.cos(el)*Math.sin(az), Math.sin(el)];
  const xc = unit(cross([0, 0, 1], zc)), yc = cross(zc, xc);
  return [...xc, ...yc, ...zc];               // rows: screen right, screen up, towards the viewer
}
/* The home view of one solid: the standard one, unless two of its directions would lie
   (nearly) on one line on the screen there, one hiding the other, or one would point at
   the viewer as a dot. Then the camera is turned round body z, a few degrees at a time
   (the elevation stays, so a disc still shows its face), to the first azimuth that
   separates them by 12° or more; failing that, to the one that separates them most. */
function homeFor(dirs){
  const ok = 12;
  let best = null, bestScore = -1;
  for (const da of [0, 8, -8, 16, -16, 24, -24, 32, -32, 40, -40]){
    const R = viewAt(HOME_AZ + da*DEG, HOME_EL);
    const s2 = dirs.map(d => [R[0]*d.u[0] + R[1]*d.u[1] + R[2]*d.u[2], R[3]*d.u[0] + R[4]*d.u[1] + R[5]*d.u[2]]);
    let worst = 90;
    s2.forEach((a, i) => {
      const la = Math.hypot(a[0], a[1]);
      if (la < 0.25) worst = Math.min(worst, ok * la / 0.25);
      for (let j = i + 1; j < s2.length; j++){
        const b = s2[j], lb = Math.hypot(b[0], b[1]);
        if (la < 1e-6 || lb < 1e-6) continue;
        // between lines, not arrows: a direction and one opposite hide each other too
        worst = Math.min(worst, Math.acos(Math.min(1, Math.abs(a[0]*b[0] + a[1]*b[1]) / (la*lb))) / DEG);
      }
    });
    if (worst >= ok) return R;
    if (worst > bestScore){ bestScore = worst; best = R; }
  }
  return best;
}

/* The body axes in the crystal frame, made orthonormal. z is always x × y: if the
   frame given were left-handed this flips every direction's z, which mirrors the
   picture back to the true one, since each of these solids is symmetric under z → −z. */
function bodyFrame(frame){
  const f = Array.isArray(frame) ? frame.map(vec3) : [];
  const ok = v => v && v.every(Number.isFinite) ? unit(v) : null;
  let ex = ok(f[0]), ey = ok(f[1]);
  const ez = ok(f[2]);
  if (!ex) ex = [1, 0, 0];
  if (!ey && ez) ey = cross(ez, ex);
  if (ey){ const d = dot(ex, ey); ey = unit([ey[0] - d*ex[0], ey[1] - d*ex[1], ey[2] - d*ex[2]]); }
  if (!ey){ ey = unit(cross([0, 0, 1], ex)) || [0, 1, 0]; }
  return [ex, ey, cross(ex, ey)];
}

/* Where the ray p + s·d leaves the solid (the larger s of the stretch inside it), or NaN
   if it misses. Exact for each body (slabs for the box, a quadric for the curved walls),
   so the classing of lines and cones as hidden or not has no tessellation error. Scalars
   in, a scalar out, no closures: it runs some thousands of times a frame. */
function rayExit(m, px, py, pz, dx, dy, dz){
  const a = m.A[0], b = m.A[1], c = m.A[2];
  if (m.kind === 'ell'){
    const qx = px/a, qy = py/b, qz = pz/c, ex = dx/a, ey = dy/b, ez = dz/c;
    const A = ex*ex + ey*ey + ez*ez, B = qx*ex + qy*ey + qz*ez, C = qx*qx + qy*qy + qz*qz - 1;
    const D = B*B - A*C;
    return D < 0 ? NaN : (-B + Math.sqrt(D)) / A;
  }
  let s0 = -Infinity, s1 = Infinity;
  if (m.kind === 'cyl'){
    const qx = px/a, qy = py/b, ex = dx/a, ey = dy/b, A = ex*ex + ey*ey, C = qx*qx + qy*qy - 1;
    if (dx*dx + dy*dy < 1e-18){ if (C > 0) return NaN; }          // along the axis
    else {
      const B = qx*ex + qy*ey, D = B*B - A*C;
      if (D < 0) return NaN;
      const r = Math.sqrt(D);
      s0 = (-B - r) / A; s1 = (-B + r) / A;
    }
    if (Math.abs(dz) < 1e-12){ if (Math.abs(pz) > c) return NaN; } // the caps: a slab in z
    else {
      let u = (-c - pz) / dz, v = (c - pz) / dz;
      if (u > v){ const w = u; u = v; v = w; }
      if (u > s0) s0 = u;
      if (v < s1) s1 = v;
    }
    return s0 <= s1 ? s1 : NaN;
  }
  for (let i = 0; i < 3; i++){                                     // the box: three slabs
    const p = i === 0 ? px : i === 1 ? py : pz, d = i === 0 ? dx : i === 1 ? dy : dz, h = m.A[i];
    if (Math.abs(d) < 1e-12){ if (Math.abs(p) > h) return NaN; continue; }
    let u = (-h - p) / d, v = (h - p) / d;
    if (u > v){ const w = u; u = v; v = w; }
    if (u > s0) s0 = u;
    if (v < s1) s1 = v;
  }
  return s0 <= s1 ? s1 : NaN;
}

/* ---------- meshes ---------- */
// Fading towards an open end: full up to 45 % of the half extent, gone at the end.
function fadeAt(s){ const x = clamp((s - 0.45) / 0.55, 0, 1); return 1 - x*x*(3 - 2*x); }
/* The fade of a point of the body: by its reach along each open axis; but for a round
   body (cylinder, ellipsoid) open across both x and y, a sheet, by its radius, so that
   the rim fades evenly all round instead of leaving a square cushion. A sheet fades
   over the outer 38 % of its radius only: its flat face has no shading or outline to
   hold the eye, as a rod's sides do, and a softer middle reads as a blur, not a plate. */
function fadeOf(m, x, y, z){
  const [a, b, c] = m.A, o = m.open;
  let f = 1;
  if (m.kind !== 'box' && o[0] && o[1]) f = fadeAt(0.45 + (Math.hypot(x / a, y / b) - 0.62) * 0.55 / 0.38);
  else { if (o[0]) f *= fadeAt(Math.abs(x) / a); if (o[1]) f *= fadeAt(Math.abs(y) / b); }
  if (o[2]) f *= fadeAt(Math.abs(z) / c);
  return f;
}

/* The solid's faces (quads, and triangles where a quad's corners weld: at the poles, at
   a cap's centre), in its body frame. Quads, not two triangles each: a third fewer edges
   for the rasteriser, which is where the time of a frame goes. Vertices are shared
   through a key on their rounded position, which welds the poles, the seam and the cap
   rims for free and lets the edges know both their faces (for silhouettes and creases).
   Faces carry a group: an edge between two groups (a cap's rim, a box edge) is a
   crease, always drawn. */
function buildMesh(m){
  const [a, b, c] = m.A, open = m.open, V = [], F = [], keys = new Map();
  const q = 1e6 / Math.max(a, b, c);
  const vtx = (x, y, z) => {
    const k = Math.round(x*q) + ',' + Math.round(y*q) + ',' + Math.round(z*q);
    let i = keys.get(k);
    if (i === undefined){ i = V.length; V.push([x, y, z]); keys.set(k, i); }
    return i;
  };
  const face = (ids, g) => {
    const v = ids.filter((x, i) => x !== ids[(i + 1) % ids.length]);
    if (v.length >= 3) F.push({ v, g });
  };
  const grid = (nu, nv, at, g) => {             // a (nu+1) x (nv+1) patch of quads
    const id = [];
    for (let i = 0; i <= nu; i++){ id.push([]); for (let j = 0; j <= nv; j++) id[i].push(vtx(...at(i / nu, j / nv))); }
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) face([id[i][j], id[i + 1][j], id[i + 1][j + 1], id[i][j + 1]], g);
  };
  if (m.kind === 'ell'){
    grid(40, 28, (u, v) => {
      const ph = u * 2*Math.PI, th = v * Math.PI;
      return [a*Math.sin(th)*Math.cos(ph), b*Math.sin(th)*Math.sin(ph), c*Math.cos(th)];
    }, 0);
  } else if (m.kind === 'cyl'){
    const ns = 56, nz = open[2] ? 18 : 1, nr = (open[0] || open[1]) ? 10 : 1;
    grid(ns, nz, (u, v) => [a*Math.cos(u*2*Math.PI), b*Math.sin(u*2*Math.PI), c*(2*v - 1)], 0);
    // No cap on an open end: the wall fades out there instead.
    if (!open[2]) for (const [sz, g] of [[1, 1], [-1, 2]])
      grid(ns, nr, (u, r) => [a*r*Math.cos(u*2*Math.PI), b*r*Math.sin(u*2*Math.PI), sz*c], g);
  } else {
    const n = i => open[i] ? 16 : 1;
    for (let k = 0; k < 3; k++){
      if (open[k]) continue;                   // the open ends have no face
      const i = (k + 1) % 3, j = (k + 2) % 3;
      for (const sk of [1, -1]) grid(n(i), n(j), (u, v) => {
        const p = [0, 0, 0]; p[k] = sk*m.A[k]; p[i] = (2*u - 1)*m.A[i]; p[j] = (2*v - 1)*m.A[j]; return p;
      }, 2*k + (sk > 0 ? 0 : 1));
    }
  }
  // The fade of each vertex (towards open ends), then each face's outward normal (the
  // solid is convex about its centre; for a quad, across its diagonals, which averages
  // a corner set not quite flat) and the most it shows of itself.
  const vf = V.map(p => fadeOf(m, p[0], p[1], p[2]));
  for (const f of F){
    const P = f.v.map(i => V[i]), n4 = P.length === 4;
    const cen = [0, 1, 2].map(i => P.reduce((s, p) => s + p[i], 0) / P.length);
    const d1 = n4 ? P[2] : P[1], d2 = n4 ? P[3] : P[2], o1 = P[0], o2 = n4 ? P[1] : P[0];
    let n = unit(cross([d1[0] - o1[0], d1[1] - o1[1], d1[2] - o1[2]], [d2[0] - o2[0], d2[1] - o2[1], d2[2] - o2[2]])) || [0, 0, 1];
    if (dot(n, cen) < 0) n = n.map(x => -x);
    f.n = n;
    f.fade = Math.max(...f.v.map(i => vf[i]));
  }
  const E = new Map();
  F.forEach((f, fi) => {
    for (let e = 0, L = f.v.length; e < L; e++){
      const i = f.v[e], j = f.v[(e + 1) % L], k = i < j ? i * 1e6 + j : j * 1e6 + i;
      const ed = E.get(k);
      if (ed) ed.f2 = fi; else E.set(k, { i, j, f1: fi, f2: -1 });
    }
  });
  const edges = [...E.values()];
  for (const ed of edges){
    ed.crease = ed.f2 < 0 || F[ed.f1].g !== F[ed.f2].g;
    ed.fade = Math.max(vf[ed.i], vf[ed.j]);
  }
  return { V, F, edges, vf };
}

// Two unit vectors normal to w and to each other.
function perpBasis(w){
  const t = Math.abs(w[0]) < 0.8 ? [1, 0, 0] : [0, 1, 0];
  const p1 = unit(cross(w, t));
  return [p1, cross(w, p1)];
}

/* The model of one solid: clamped extents, the mesh, and the directions in the body
   frame with their lines and cones laid out (in body coordinates, projected per draw). */
function buildModel(solid){
  const type = TYPE_NAMES[solid.type] ? solid.type : 'ellipsoid';
  const kind = type === 'box' ? 'box' : (type === 'cylinder' || type === 'ellcyl') ? 'cyl' : 'ell';
  const raw = vec3(solid.dims) || [NaN, NaN, NaN];
  // A spheroid's and a round cylinder's cross-section is a circle: a missing Dy is Dx.
  if ((type === 'spheroid' || type === 'cylinder') && !(raw[1] > 0)) raw[1] = raw[0];
  const good = raw.map(v => Number.isFinite(v) && v > 0);
  const known = good.some(Boolean);
  /* Endless: unknown, or more than OPEN_RATIO times the smallest other known extent.
     Against the smallest, not the largest: a sheet [2e5, 2e5, 3] has both its wide
     extents endless, where matching each against the other wide one kept both closed
     and drew a disc 2e5 nm across. The smallest extent is never endless, so there is
     always a closed one to size the endless ones by. */
  const open = [0, 1, 2].map(i => {
    if (!known) return false;
    if (!good[i]) return true;
    let small = Infinity;
    for (let j = 0; j < 3; j++) if (j !== i && good[j]) small = Math.min(small, raw[j]);
    return raw[i] > OPEN_RATIO * small;
  });
  let big = 0;
  for (let i = 0; i < 3; i++) if (known && !open[i]) big = Math.max(big, raw[i]);
  const D = raw.map((v, i) => !known ? 1 : open[i] ? OPEN_CAP * big : v);
  // A sliver thinner than 1 % of the largest extent draws as that, not as nothing.
  const Dmax = Math.max(...D);
  const A = D.map(v => Math.max(v, 0.01 * Dmax) / 2);
  const m = { type, kind, raw, known, A, open };
  m.Rs = kind === 'ell' ? Math.max(...A) : kind === 'cyl' ? Math.hypot(Math.max(A[0], A[1]), A[2]) : Math.hypot(...A);
  m.mesh = buildMesh(m);

  const E = bodyFrame(solid.frame);
  m.dirs = [];
  (Array.isArray(solid.dirs) ? solid.dirs : []).forEach((d, slot) => {
    const v = d && vec3(d.vec);
    if (!v || !v.every(Number.isFinite)) return;
    const u = unit([dot(v, E[0]), dot(v, E[1]), dot(v, E[2])]);
    if (!u) return;
    const esd = num(d.esd), off = num(d.off);
    const det = Number.isFinite(esd) && esd >= 0 && esd <= ESD_MAX;
    const s1 = rayExit(m, 0, 0, 0, u[0], u[1], u[2]);
    const t = s1 > 0 ? s1 : 0;
    // Out past the surface by a margin, and never so short that a thin dimension
    // (a disc's axis) leaves only a stub.
    const L = Math.max(t + 0.28 * m.Rs, 0.62 * m.Rs);
    m.dirs.push({ slot, u, L, t, det, esd: det ? esd : NaN, off: Number.isFinite(off) ? off : NaN, label: String(d.label == null ? '' : d.label) });
  });
  m.Rb = Math.max(m.Rs, ...m.dirs.map(d => d.L));
  m.home = homeFor(m.dirs);

  // The cones' surface, cut into patches (slant rings x sectors), each classed on its
  // own: a wide cone round an in-plane direction of a thin disc rises out of the disc's
  // faces though its axis runs inside.
  const NK = 8, NM = 16;
  for (const d of m.dirs){
    d.cones = [];
    if (!d.det || !(d.esd > 0)) continue;
    const th = d.esd * DEG, ca = Math.cos(th) * d.L, ra = Math.sin(th) * d.L;
    for (const sg of [1, -1]){
      const w = d.u.map(x => x * sg), [p1, p2] = perpBasis(w);
      // f runs along the slant (0 at the apex, 1 at the rim), ph round the axis
      const at = (f, ph) => { const cs = Math.cos(ph), sn = Math.sin(ph);
        return [f*ca*w[0] + f*ra*(cs*p1[0] + sn*p2[0]), f*ca*w[1] + f*ra*(cs*p1[1] + sn*p2[1]), f*ca*w[2] + f*ra*(cs*p1[2] + sn*p2[2])]; };
      const patches = [];
      for (let k = 0; k < NK; k++) for (let s = 0; s < NM; s++){
        const f0 = k / NK, f1 = (k + 1) / NK, a0 = s / NM * 2*Math.PI, a1 = (s + 1) / NM * 2*Math.PI;
        patches.push({ k, s, f0, f1, a0, a1, c: at((f0 + f1) / 2, (a0 + a1) / 2) });
      }
      // the grid's corners: ring k (k = 0 the apex), sector boundary s
      const corners = [];
      for (let k = 0; k <= NK; k++) for (let s = 0; s < NM; s++) corners.push(at(k / NK, s / NM * 2*Math.PI));
      d.cones.push({ patches, corners, at, NK, NM, c: w.map(x => x * ca) });
    }
  }
  return m;
}

/* ---------- colours ---------- */
let probeCtx = null;
const rgbCache = new Map();
// Any CSS colour → [r, g, b, a], through a canvas, which normalises what it is given.
function rgbOf(str){
  str = String(str || '').trim();
  if (rgbCache.has(str)) return rgbCache.get(str);
  if (!probeCtx) probeCtx = document.createElement('canvas').getContext('2d');
  probeCtx.fillStyle = '#000';
  probeCtx.fillStyle = str;
  const s = probeCtx.fillStyle;
  let out = null;
  if (s[0] === '#') out = [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16), 1];
  else { const m = s.match(/[\d.]+/g); if (m) out = [+m[0], +m[1], +m[2], m[3] != null ? +m[3] : 1]; }
  // '#000' back for something that is not black means the string was no colour.
  if (out && !out[0] && !out[1] && !out[2] && !/^(#0{3,8}|black|rgba?\(\s*0[\s,]+0[\s,]+0\b)/i.test(str)) out = null;
  if (rgbCache.size > 200) rgbCache.clear();
  rgbCache.set(str, out);
  return out;
}
const css = c => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp(a, 0, 1).toFixed(3)})`;
const mix = (a, b, t) => [a[0] + (b[0] - a[0])*t, a[1] + (b[1] - a[1])*t, a[2] + (b[2] - a[2])*t];
const luma = c => (0.2126*c[0] + 0.7152*c[1] + 0.0722*c[2]) / 255;
// A colour's hue in degrees, and its chroma (0 for a grey, whose hue means nothing).
function hueOf(c){
  const r = c[0] / 255, g = c[1] / 255, b = c[2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), ch = mx - mn;
  if (ch < 1e-6) return { h: 0, ch: 0 };
  const h = mx === r ? ((g - b) / ch + 6) % 6 : mx === g ? (b - r) / ch + 2 : (r - g) / ch + 4;
  return { h: h * 60, ch };
}

/* The directions' colours: six hues, each in a shade for the light theme (dark enough on
   white) and one for the dark (light enough on near-black), in order of preference. The
   directions take, in turn, the hues at least HUE_GAP from the solid's, so a line never
   melts into the solid it runs through: a blue phase gets no blue line, a green one no
   green. Six hues about 60° apart leave at least four free whatever the solid. */
const DIR_HUES = [
  { h: 211, light: '#1d6fc4', dark: '#6cb6ff' },   // blue, the farthest from the default amber
  { h: 306, light: '#9c4b93', dark: '#d98fd1' },   // magenta (the app's second accent)
  { h: 125, light: '#2e8b3a', dark: '#7fd17f' },   // green
  { h: 27,  light: '#b9560f', dark: '#ffa04d' },   // orange
  { h: 178, light: '#0e7f86', dark: '#4fd1c5' },   // teal
  { h: 348, light: '#c42b4f', dark: '#ff7b93' },   // crimson
];
const HUE_GAP = 45;
function dirColours(solid, light){
  const { h, ch } = hueOf(solid);
  const far = e => ch < 0.12 || Math.abs(((e.h - h) % 360 + 540) % 360 - 180) >= HUE_GAP;
  const pick = e => light ? e.light : e.dark;
  return [...DIR_HUES.filter(far).map(pick), ...DIR_HUES.filter(e => !far(e)).map(pick)];
}

// The theme, read from the tokens. The view keeps what this gives until the theme
// changes (getComputedStyle at every frame of a drag is not free).
function readTheme(el, colorOpt){
  const cs = getComputedStyle(el);
  const tok = (n, f) => cs.getPropertyValue(n).trim() || f;
  const bg = rgbOf(tok('--bg', '#0e1316')) || [14, 19, 22, 1];
  const light = luma(bg) > 0.5;
  // What the canvas sits on: the first ancestor with a background of its own.
  let under = null;
  for (let e = el; e && e.nodeType === 1; e = e.parentElement){
    const c = rgbOf(getComputedStyle(e).backgroundColor);
    if (c && c[3] > 0.5){ under = c; break; }
  }
  let solid = null;
  const co = String(colorOpt || '').trim();
  if (co.startsWith('--')) solid = rgbOf(tok(co, ''));
  else if (co.startsWith('var(')) solid = rgbOf(tok(co.slice(4, -1).split(',')[0].trim(), ''));
  else if (co) solid = rgbOf(co);
  if (!solid) solid = rgbOf(tok('--accent', '#ffb454')) || [255, 180, 84, 1];
  const text = rgbOf(tok('--text', light ? '#1a2327' : '#dfe8ea')) || [223, 232, 234, 1];
  const edge = mix(solid, text, 0.45);
  return {
    light, text: css(text), muted: tok('--muted', light ? '#56676f' : '#7f97a0'),
    halo: css(under || bg), bg: css(under || bg), solid,
    edge: css(edge), edgeRgb: edge,
    dirs: dirColours(solid, light),
    font: cs.fontFamily || 'sans-serif',
  };
}

/* ---------- labels ---------- */
/* '[1-10]' → '[', '1', '1' under a bar, '0', ']': crystallographers write an index's
   minus as a bar over it. With spaces or commas between the indices ('[1 -10 0]') the
   bar covers the whole number; without, every index is one digit. */
function millerRuns(label){
  const s = String(label);
  if (!/^[[(<{]?[-−\d\s,]+[\])>}]?$/.test(s) || !/[-−]\d/.test(s)) return [{ s, bar: false }];
  const sep = /\d[\s,]+[-−\d]/.test(s), out = [];
  for (let i = 0; i < s.length; i++){
    const ch = s[i];
    if ((ch === '-' || ch === '−') && /\d/.test(s[i + 1] || '')){
      let j = i + 1;
      if (sep) while (/\d/.test(s[j + 1] || '')) j++;
      out.push({ s: s.slice(i + 1, j + 1), bar: true });
      i = j;
      continue;
    }
    const last = out[out.length - 1];
    if (last && !last.bar) last.s += ch; else out.push({ s: ch, bar: false });
  }
  return out;
}

/* How much of the segment s lies over the box [x, x + w] × [y, y + h] grown by gr, in
   pixels along it; -1 if none (Liang–Barsky, unrolled: it runs for every place of every
   label against every line, some thousands of times a frame). */
function segInBox(s, x, y, w, h, gr){
  const dx = s.x1 - s.x0, dy = s.y1 - s.y0;
  let t0 = 0, t1 = 1;
  const clip = (p, q) => {
    if (p === 0) return q >= 0;
    const t = q / p;
    if (p < 0){ if (t > t1) return false; if (t > t0) t0 = t; }
    else { if (t < t0) return false; if (t < t1) t1 = t; }
    return true;
  };
  if (!clip(-dx, s.x0 - (x - gr)) || !clip(dx, x + w + gr - s.x0) || !clip(-dy, s.y0 - (y - gr)) || !clip(dy, y + h + gr - s.y0)) return -1;
  return (t1 - t0) * Math.hypot(dx, dy);
}
// The distance from the point (px, py) to the box, and to the segment s.
const ptBox = (px, py, x, y, w, h) => Math.hypot(Math.max(x - px, 0, px - x - w), Math.max(y - py, 0, py - y - h));
function ptSeg(px, py, s){
  const dx = s.x1 - s.x0, dy = s.y1 - s.y0, L2 = dx*dx + dy*dy;
  const t = L2 ? clamp(((px - s.x0)*dx + (py - s.y0)*dy) / L2, 0, 1) : 0;
  return Math.hypot(px - s.x0 - t*dx, py - s.y0 - t*dy);
}
// The distance between the segment s and the box, which it does not cross: the nearest
// pair is an end of the one and a point of the other.
function segBoxDist(s, x, y, w, h){
  return Math.min(ptBox(s.x0, s.y0, x, y, w, h), ptBox(s.x1, s.y1, x, y, w, h),
    ptSeg(x, y, s), ptSeg(x + w, y, s), ptSeg(x, y + h, s), ptSeg(x + w, y + h, s));
}

/* Where the labels go. Each sits by its own tip; a place is scored by what it covers (a
   direction line or arrowhead, its own included; another label; the scale bar) or comes
   close to, how far it strays from the tip and how far it turns from straight out along
   its line. Places off the canvas are not taken at all: clamping one back in is what
   pushed a label back over its own line. Besides the places round the tip there are
   places beside the line, back along it, so a label at the canvas's edge slides along
   its line instead. Up to four labels, every order of placing them is tried (each placed
   against those before it) and the best overall kept.
   The near-misses cost a little, more the nearer: so of two places otherwise alike the
   roomier wins, and a label moves over gradually as a line comes near. A move from where
   the label sat in the last frame (prev: its centre's offset from the tip) costs too,
   mostly for swinging round the tip, so labels keep their side while the solid turns
   instead of hopping from one side of a line to the other. That cost is a distance (it
   obeys the triangle inequality), so where the last frame put a label is still the best
   place for it when nothing has moved (were another better by more than the move, it
   would have been taken then): a redraw of an unchanged view puts the labels back
   exactly. */
function placeLabels(items, obstacles, fixed, Sz, prev){
  const MG = 3;                               // kept off the canvas's edge
  const cands = it => {
    const out = [], [ox, oy] = it.out, [tx, ty] = it.tip, w = it.w, h = it.hgt;
    // the box that touches, from outside, the point g past (sx, sy) along (dx, dy)
    const at = (dx, dy, g, sx, sy, cost) => {
      const ex = Math.abs(dx) > 1e-9 ? w / 2 / Math.abs(dx) : Infinity, ey = Math.abs(dy) > 1e-9 ? h / 2 / Math.abs(dy) : Infinity;
      const e = Math.min(ex, ey);
      out.push({ x: sx + dx*(g + e) - w / 2, y: sy + dy*(g + e) - h / 2, cost });
    };
    // A fine grid: as the solid turns, the best place should move a few pixels at a
    // time, not hop.
    for (let deg = -180; deg < 180; deg += 7.5){
      const t = deg * DEG, c = Math.cos(t), s = Math.sin(t);
      for (const g of [6, 9, 13, 18, 25, 34]) at(ox*c - oy*s, ox*s + oy*c, g, tx, ty, Math.abs(deg) * 0.25 + g * 0.6);
    }
    for (const back of [10, 18, 28, 40, 54, 70]) for (const sd of [1, -1])
      at(-oy*sd, ox*sd, 5, tx - ox*back, ty - oy*back, 30 + back * 0.6);
    return out;
  };
  for (const s of obstacles){
    const r = s.hw + 10;
    s.rx0 = Math.min(s.x0, s.x1) - r; s.rx1 = Math.max(s.x0, s.x1) + r; s.ry0 = Math.min(s.y0, s.y1) - r; s.ry1 = Math.max(s.y0, s.y1) + r;
  }
  // What each place costs on its own (the canvas, the lines, the move), worked out once.
  const pre = items.map(it => {
    const was = prev && prev.get(it.slot);
    return cands(it).map(b => {
      if (b.x < MG || b.y < MG || b.x + it.w > Sz - MG || b.y + it.hgt > Sz - MG) return null;
      let c = b.cost;
      for (const s of obstacles){
        // past its reach (half-width and the 10 px of a near miss): nothing to add
        if (b.x > s.rx1 || b.x + it.w < s.rx0 || b.y > s.ry1 || b.y + it.hgt < s.ry0) continue;
        const l = segInBox(s, b.x, b.y, it.w, it.hgt, s.hw);
        if (l >= 0){ c += 300 + 30 * l; continue; }
        const d = segBoxDist(s, b.x, b.y, it.w, it.hgt) - s.hw;
        if (d < 10) c += 40 * (1 - d / 10);
      }
      if (was){
        // round the tip from where it was (radians, ~0.4 a degree), and a little for the
        // distance: the angle is what makes a hop, while a label pushed out should be
        // free to come back in
        const dx = b.x + it.w / 2 - it.tip[0], dy = b.y + it.hgt / 2 - it.tip[1];
        const turn = Math.abs(Math.atan2(dx*was[1] - dy*was[0], dx*was[0] + dy*was[1]));
        c += 25 * turn + 0.25 * Math.hypot(dx - was[0], dy - was[1]);
      }
      return { x: b.x, y: b.y, c };
    }).filter(Boolean);
  });
  const near = (b, w, h, o) => {
    const ox = Math.min(b.x + w, o.x + o.w) - Math.max(b.x, o.x), oy = Math.min(b.y + h, o.y + o.hgt) - Math.max(b.y, o.y);
    if (ox > -2 && oy > -2) return 600 + 2 * (ox + 2) * (oy + 2);
    const gap = Math.max(-ox, -oy);           // the clear space between, along the axis that has it
    return gap < 8 ? 30 * (1 - gap / 8) : 0;
  };
  const perms = [];
  const permute = (rest, acc) => {
    if (!rest.length){ perms.push(acc); return; }
    rest.forEach((x, i) => permute([...rest.slice(0, i), ...rest.slice(i + 1)], [...acc, x]));
  };
  if (items.length <= 4) permute(items.map((_, i) => i), []);
  else perms.push(items.map((_, i) => i));
  let best = null, bestCost = Infinity;
  for (const order of perms){
    const placed = fixed.slice(), at = [];
    let total = 0;
    for (const i of order){
      const it = items[i];
      let pick = null, pc = Infinity;
      for (const b of pre[i]){
        let c = b.c;
        for (const o of placed){ c += near(b, it.w, it.hgt, o); if (c >= pc) break; }
        if (c < pc){ pc = c; pick = b; }
      }
      // Nowhere on the canvas at all (a label wider than it): straight out, kept on it.
      if (!pick){
        pick = { x: clamp(it.tip[0] + it.out[0] * 9 - it.w / 2, MG, Sz - MG - it.w), y: clamp(it.tip[1] + it.out[1] * 9 - it.hgt / 2, MG, Sz - MG - it.hgt) };
        pc = 1e6;
      }
      at[i] = pick;
      placed.push({ x: pick.x, y: pick.y, w: it.w, hgt: it.hgt });
      total += pc;
      if (total >= bestCost) break;
    }
    if (total < bestCost){ bestCost = total; best = at; }
  }
  items.forEach((it, i) => { it.x = best[i].x; it.y = best[i].y; });
}

/* ---------- the view ---------- */
export function shapeView(container, opts = {}){
  const wrap = document.createElement('div');
  wrap.className = 'shape3d';
  wrap.hidden = true;
  const canvas = document.createElement('canvas');
  canvas.className = 'shape3d-canvas';
  canvas.tabIndex = 0;
  // A widget with keys of its own (the arrows turn it): as an application a screen reader
  // passes them through, and the role description says what it is.
  canvas.setAttribute('role', 'application');
  canvas.setAttribute('aria-roledescription', '3D view');
  canvas.setAttribute('aria-keyshortcuts', 'ArrowLeft ArrowRight ArrowUp ArrowDown Home');
  canvas.style.touchAction = 'none';    // the drag is the view's, not the page's scroll (also in the CSS)
  const cap = document.createElement('div');
  cap.className = 'shape3d-cap';
  wrap.append(canvas, cap);
  container.appendChild(wrap);
  const ctx = canvas.getContext('2d');

  let model = null, sig = '', caption = '', keepView = false;
  let R = viewAt(HOME_AZ, HOME_EL);
  let S = 0, ratio = 1, raf = 0, dead = false;
  let theme = null;                     // readTheme's answer, until the theme changes
  // slot → where its label's centre sat in the last frame, relative to its tip: labels
  // keep their places as the solid turns. Forgotten on a reset and with a new solid (so
  // the home view always looks the same), kept in getView.
  const labelsWere = new Map();
  const themeOf = () => theme || (theme = readTheme(container, opts.color));
  const layers = [];                    // offscreen canvases: the solid, the hidden cones, the visible cones
  let mask = null;                      // the open ends' fade mask (small)
  // Exactly the mask's size: scaled up, a larger canvas's stale pixels past its edge
  // could bleed into it.
  const maskCanvas = (w, h) => {
    if (!mask) mask = document.createElement('canvas');
    if (mask.width !== w || mask.height !== h){ mask.width = w; mask.height = h; }
    return mask;
  };

  /* An offscreen layer at lr pixels per CSS pixel. Only the box is drawn in and copied
     out, so a narrow solid (a rod) costs a narrow strip, not the whole square. It is
     cleared over that box and over the last frame's, a little grown: a scaled copy of
     part of a canvas may sample a pixel or two outside it, which must be empty there,
     not what an earlier frame left (the same view must always give the same pixels). */
  const layer = (i, Sz, lr, box) => {
    let c = layers[i];
    if (!c){ c = document.createElement('canvas'); layers[i] = c; }
    const W = Math.round(Sz * lr);
    if (c.width !== W || c.height !== W){ c.width = W; c.height = W; c.lastBox = null; }
    const g = c.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    for (const b of [c.lastBox, [box.x * lr, box.y * lr, box.w * lr, box.h * lr]]) if (b) g.clearRect(b[0] - 2, b[1] - 2, b[2] + 4, b[3] + 4);
    c.lastBox = [box.x * lr, box.y * lr, box.w * lr, box.h * lr];
    g.setTransform(lr, 0, 0, lr, 0, 0);
    return g;
  };
  const blit = (g, i, lr, box, alpha) => {
    if (!(box.w > 0 && box.h > 0)) return;
    g.globalAlpha = alpha;
    g.drawImage(layers[i], box.x * lr, box.y * lr, box.w * lr, box.h * lr, box.x, box.y, box.w, box.h);
    g.globalAlpha = 1;
  };
  // A box in CSS pixels, grown out to whole pixels of a layer at lr and kept on it.
  const snap = (x0, y0, x1, y1, lr, Sz) => {
    const W = Math.round(Sz * lr);
    const a = clamp(Math.floor(x0 * lr), 0, W), b = clamp(Math.floor(y0 * lr), 0, W);
    const c = clamp(Math.ceil(x1 * lr), 0, W), d = clamp(Math.ceil(y1 * lr), 0, W);
    return { x: a / lr, y: b / lr, w: Math.max(0, c - a) / lr, h: Math.max(0, d - b) / lr };
  };

  /* Everything, in CSS pixels on a square of side Sz (g already scaled by r). A fast
     paint (during a drag, or while an arrow key is held) coarsens what costs most and
     shows least while the solid moves: the open ends' fade mask and the cones' fine cut
     at the solid's surface. The frame after it is let go is a full one. */
  function paint(g, Sz, r, fast, forPng = false){
    const m = model, T = themeOf();
    const pad = 0.1 * Sz + 6;           // room for the labels past the tips
    const k = (Sz / 2 - pad) / m.Rb, cx = Sz / 2, cy = Sz / 2;
    const [r00, r01, r02, r10, r11, r12, r20, r21, r22] = R;
    const r0 = [r00, r01, r02], r1 = [r10, r11, r12], r2 = [r20, r21, r22];
    const P = p => [cx + k*(r00*p[0] + r01*p[1] + r02*p[2]), cy - k*(r10*p[0] + r11*p[1] + r12*p[2]), r20*p[0] + r21*p[1] + r22*p[2]];
    const hidden = p => rayExit(m, p[0], p[1], p[2], r20, r21, r22) >= 0;
    const lr = Math.min(r, LAYER_MAX), cr = Math.min(r, forPng ? LAYER_MAX : CONE_LAYER_MAX);
    /* Many polygons into one path, all wound the same way: filled at once (nonzero)
       they make their union, with no seams inside it and one draw call instead of a
       few thousand. Polygons that overlap (a cone's near and far sides) unite rather
       than cancel because none runs the other way round. */
    const addPoly = (h, pts) => {
      let a = 0;
      for (let i = 0, n = pts.length; i < n; i++){ const p = pts[i], q = pts[(i + 1) % n]; a += p[0]*q[1] - q[0]*p[1]; }
      if (Math.abs(a) < 1e-9) return;
      const n = pts.length, fwd = a > 0;
      h.moveTo(pts[fwd ? 0 : n - 1][0], pts[fwd ? 0 : n - 1][1]);
      // No closePath: a fill closes every subpath itself, and closePath is not free
      // with thousands of subpaths.
      for (let i = 1; i < n; i++){ const p = pts[fwd ? i : n - 1 - i]; h.lineTo(p[0], p[1]); }
    };

    /* The solid's front faces, opaque, on their own layer, over the box it covers. */
    const { V, F, edges, vf } = m.mesh;
    const Q = V.map(P);
    const front = F.map(f => dot(r2, f.n) > 1e-9);
    let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
    for (const q of Q){ if (q[0] < bx0) bx0 = q[0]; if (q[0] > bx1) bx1 = q[0]; if (q[1] < by0) by0 = q[1]; if (q[1] > by1) by1 = q[1]; }
    const sb = snap(bx0 - 2, by0 - 2, bx1 + 2, by1 + 2, lr, Sz);
    const gs = layer(0, Sz, lr, sb);
    // Lambert shading, in 96 steps: the faces of one step go into one path.
    const shades = new Map();
    F.forEach((f, i) => {
      if (!front[i] || f.fade < 0.01) return;
      const lv = Math.round(96 * Math.max(0, dot([dot(r0, f.n), dot(r1, f.n), dot(r2, f.n)], LIGHT)));
      let list = shades.get(lv);
      if (!list){ list = []; shades.set(lv, list); }
      list.push(f);
    });
    // Inside one shade the triangles are one path, filled as a union: no seams. Where
    // one shade meets the next, the anti-aliasing of both leaves a hairline not quite
    // covered (a faint wireframe once the layer is translucent). Filling every shade a
    // second time takes such a pixel from 75 % to 94 % covered, in the colours of its
    // two neighbours only: invisible, and far cheaper than stroking every face.
    // (Growing each triangle by a pixel instead trips the rasteriser: near-coincident
    // overlapping edges in one path come out with a seam of their own.)
    const shadePaths = [...shades].map(([lv, list]) => {
      const l = 0.40 + 0.66 * lv / 96, path = new Path2D();
      for (const f of list) addPoly(path, f.v.map(i => Q[i]));
      return [css(T.solid.map(x => Math.min(255, x * l))), path];
    });
    for (let pass = 0; pass < 2; pass++) for (const [col, path] of shadePaths){ gs.fillStyle = col; gs.fill(path); }
    /* Towards an open end the solid fades out. Fading each triangle by its own alpha
       would show every seam between them; instead the opaque layer's alpha is
       multiplied by a mask cast analytically, a cell every 3 CSS pixels (6 during a
       drag) over the solid's box (each cell's ray meets the exact front surface, whose
       place along the open axes gives the fade), smoothed up when drawn: seamless, and
       cheap. */
    if (m.open.some(Boolean) && sb.w > 0 && sb.h > 0){
      const cs = fast ? 6 : 3;
      const i0 = Math.floor(sb.x / cs) - 1, j0 = Math.floor(sb.y / cs) - 1;
      const Mw = Math.ceil((sb.x + sb.w) / cs) + 1 - i0, Mh = Math.ceil((sb.y + sb.h) / cs) + 1 - j0;
      const mc = maskCanvas(Mw, Mh), mg = mc.getContext('2d');
      const img = mg.createImageData(Mw, Mh), px = img.data, fa = new Float32Array(Mw*Mh).fill(-1);
      for (let j = 0; j < Mh; j++) for (let i = 0; i < Mw; i++){
        const x = ((i0 + i + 0.5) * cs - cx) / k, y = (cy - (j0 + j + 0.5) * cs) / k;
        const p0 = x*r00 + y*r10, p1 = x*r01 + y*r11, p2 = x*r02 + y*r12;
        const s = rayExit(m, p0, p1, p2, r20, r21, r22);
        if (!(s === s)) continue;          // NaN: off the solid
        fa[j*Mw + i] = fadeOf(m, p0 + s*r20, p1 + s*r21, p2 + s*r22);
      }
      // A cell just off the solid takes its neighbours' fade: the smoothing blends it
      // into the solid's own edge pixels, which must not pick up a value from nowhere.
      for (let j = 0; j < Mh; j++) for (let i = 0; i < Mw; i++){
        let f = fa[j*Mw + i];
        if (f < 0){
          let sum = 0, n = 0;
          for (let b = Math.max(0, j - 1); b <= Math.min(Mh - 1, j + 1); b++)
            for (let a = Math.max(0, i - 1); a <= Math.min(Mw - 1, i + 1); a++){ const v = fa[b*Mw + a]; if (v >= 0){ sum += v; n++; } }
          f = n ? sum / n : 0;
        }
        const o = 4 * (j*Mw + i);
        px[o] = px[o + 1] = px[o + 2] = 255;
        px[o + 3] = Math.round(255 * f);
      }
      mg.putImageData(img, 0, 0);
      gs.save();
      gs.globalCompositeOperation = 'destination-in';
      gs.imageSmoothingEnabled = true;
      gs.imageSmoothingQuality = 'low';     // bilinear: all a smooth ramp needs, and far cheaper than 'high'
      gs.drawImage(mc, i0 * cs, j0 * cs, Mw * cs, Mh * cs);
      gs.restore();
    }

    /* A stretch [t0, t1] of a curve cut where cls(t) changes: sampled at n points, each
       change then pinned down by bisection, so a line or a rim goes under the solid
       exactly where it meets the surface or the outline, not at the nearest sample. */
    const classRuns = (t0, t1, n, cls) => {
      const step = (t1 - t0) / n, out = [];
      let prev = cls(t0 + step / 2), start = t0;
      for (let i = 1; i < n; i++){
        const t = t0 + (i + 0.5) * step, c = cls(t);
        if (c === prev) continue;
        let lo = t - step, hi = t;
        for (let it = 0; it < 10; it++){ const mid = (lo + hi) / 2; if (cls(mid) === prev) lo = mid; else hi = mid; }
        const b = (lo + hi) / 2;
        out.push({ a: start, b, hid: prev });
        start = b; prev = c;
      }
      out.push({ a: start, b: t1, hid: prev });
      return out;
    };

    /* Lines: each axis classed along its length and cut into runs. */
    const runs = [], heads = [];
    for (const d of m.dirs){
      const col = T.dirs[d.slot % T.dirs.length], u = d.u;
      for (const rn of classRuns(-d.L, d.L, 48, s => hidden([u[0]*s, u[1]*s, u[2]*s]))){
        rn.d = d; rn.col = col;
        rn.p0 = P([u[0]*rn.a, u[1]*rn.a, u[2]*rn.a]); rn.p1 = P([u[0]*rn.b, u[1]*rn.b, u[2]*rn.b]);
        rn.z = (rn.p0[2] + rn.p1[2]) / 2;
        runs.push(rn);
      }
      const tip = u.map(x => x * d.L);
      heads.push({ d, col, hid: hidden(tip), tip: P(tip), base: P(u.map(x => x * d.L * 0.9)), tail: P(u.map(x => -x * d.L)) });
    }
    runs.sort((x, y) => x.z - y.z);
    const pxPerNm = d => k * Math.hypot(dot(r0, d.u), dot(r1, d.u));
    const drawRuns = hid => {
      g.lineCap = 'round';
      for (const rn of runs){
        if (rn.hid !== hid) continue;
        g.strokeStyle = rn.col;
        g.lineWidth = 2;
        if (rn.d.det) g.setLineDash([]);
        // The dashes run on from one run to the next: a run starts at the phase of its
        // distance from the line's far end.
        else { g.setLineDash([5, 4]); g.lineDashOffset = (rn.a + rn.d.L) * pxPerNm(rn.d); }
        g.beginPath(); g.moveTo(rn.p0[0], rn.p0[1]); g.lineTo(rn.p1[0], rn.p1[1]); g.stroke();
      }
      g.setLineDash([]);
      for (const h of heads){
        if (h.hid !== hid) continue;
        const dx = h.tip[0] - h.base[0], dy = h.tip[1] - h.base[1], n = Math.hypot(dx, dy);
        g.fillStyle = h.col;
        // Pointing (almost) straight at the viewer or away: a dot, not a squashed arrow.
        if (n < 2.5){ g.beginPath(); g.arc(h.tip[0], h.tip[1], 3.5, 0, 2*Math.PI); g.fill(); continue; }
        const ux = dx / n, uy = dy / n, len = 9, hw = 4;
        g.beginPath();
        g.moveTo(h.tip[0] + ux*2, h.tip[1] + uy*2);
        g.lineTo(h.tip[0] - ux*len + uy*hw, h.tip[1] - uy*len - ux*hw);
        g.lineTo(h.tip[0] - ux*len - uy*hw, h.tip[1] - uy*len + ux*hw);
        g.closePath(); g.fill();
      }
    };

    /* Cones: each one's surface split into what the solid hides and the rest, as screen
       polygons, then painted opaque on a layer per side of the solid (so overlaps of a
       cone with itself do not darken), each layer laid on at one low alpha.
       A patch whose corners, centre and neighbours all agree goes whole. Any other holds
       the curve where the cone passes through the solid's surface or out from behind
       its outline: it is cut in four, again and again, down to pieces under 8 pixels
       across; there the curve is found on each side a piece's corners disagree across
       (by bisection) and the piece is cut along the chord between, a fraction of a pixel
       off the curve at that size. So the curve comes out smooth at any width of cone
       instead of following a grid in steps. In a fast frame a boundary patch is only
       cut in four, each quarter going by its centre. */
    const CUT = 8, DMAX = 7;
    const splitCone = cn => {
      const out = [[], []], { NK, NM, at } = cn;
      const cc = cn.corners.map(hidden), ce = cn.patches.map(pa => hidden(pa.c));
      const cAt = (k, s) => cc[k*NM + ((s % NM) + NM) % NM];
      const pAt = (k, s) => ce[k*NM + ((s % NM) + NM) % NM];
      const emit = (h, pts) => out[h ? 0 : 1].push(pts);
      // bisection along one side of a piece, from (fa, aa) of class h to (fb, ab) of the other
      const edgeCut = (fa, aa, fb, ab, h) => {
        let lo = 0, hi = 1;
        for (let it = 0; it < 6; it++){ const t = (lo + hi) / 2; if (hidden(at(fa + (fb - fa)*t, aa + (ab - aa)*t)) === h) lo = t; else hi = t; }
        const t = (lo + hi) / 2;
        return P(at(fa + (fb - fa)*t, aa + (ab - aa)*t));
      };
      // A piece [f0, f1] x [a0, a1]; corners in the order (f0,a0) (f0,a1) (f1,a1) (f1,a0),
      // with their classes h and screen points q.
      const piece = (f0, f1, a0, a1, h, q, depth) => {
        const size = Math.max(Math.hypot(q[0][0] - q[2][0], q[0][1] - q[2][1]), Math.hypot(q[1][0] - q[3][0], q[1][1] - q[3][1]));
        const fm = (f0 + f1) / 2, am = (a0 + a1) / 2, pm = at(fm, am), hm = hidden(pm);
        const same = h[0] === h[1] && h[1] === h[2] && h[2] === h[3];
        const changes = (h[0] !== h[1]) + (h[1] !== h[2]) + (h[2] !== h[3]) + (h[3] !== h[0]);
        const canSplit = depth < DMAX && size > 1.5;
        if (same && hm === h[0] && (depth >= 2 || size < 2 || fast)){ emit(h[0], q); return; }
        if (fast && depth >= 1){ emit(hm, q); return; }
        if (!same && changes === 2 && (size <= CUT || !canSplit)){
          // the cut: walk round the piece, each corner to its side, each change of side
          // a point on both
          const F = [f0, f0, f1, f1], A = [a0, a1, a1, a0], sides = [[], []];
          for (let i = 0; i < 4; i++){
            const j = (i + 1) & 3;
            sides[h[i] ? 0 : 1].push(q[i]);
            if (h[i] !== h[j]){ const x = edgeCut(F[i], A[i], F[j], A[j], h[i]); sides[0].push(x); sides[1].push(x); }
          }
          if (sides[0].length >= 3) out[0].push(sides[0]);
          if (sides[1].length >= 3) out[1].push(sides[1]);
          return;
        }
        if (!canSplit){ emit(hm, q); return; }
        // in four: the sides' midpoints and the centre are the children's new corners
        const P01 = at(f0, am), P12 = at(fm, a1), P23 = at(f1, am), P30 = at(fm, a0);
        const h01 = hidden(P01), h12 = hidden(P12), h23 = hidden(P23), h30 = hidden(P30);
        const q01 = P(P01), q12 = P(P12), q23 = P(P23), q30 = P(P30), qm = P(pm);
        piece(f0, fm, a0, am, [h[0], h01, hm, h30], [q[0], q01, qm, q30], depth + 1);
        piece(f0, fm, am, a1, [h01, h[1], h12, hm], [q01, q[1], q12, qm], depth + 1);
        piece(fm, f1, am, a1, [hm, h12, h[2], h23], [qm, q12, q[2], q23], depth + 1);
        piece(fm, f1, a0, am, [h30, hm, h23, h[3]], [q30, qm, q23, q[3]], depth + 1);
      };
      // Quiet patches go whole, and those of one sector next to each other on one side
      // go as one strip: the cone is the rim scaled towards the apex, so a strip's outline
      // is exactly the union of its patches', with a fraction of their edges.
      const quiet = cn.patches.map((pa, i) => {
        const { k: pk, s } = pa, h = ce[i];
        return cAt(pk, s) === h && cAt(pk, s + 1) === h && cAt(pk + 1, s + 1) === h && cAt(pk + 1, s) === h
          && (pk === 0 || pAt(pk - 1, s) === h) && (pk === NK - 1 || pAt(pk + 1, s) === h) && pAt(pk, s - 1) === h && pAt(pk, s + 1) === h;
      });
      for (let s = 0; s < NM; s++){
        const a0 = s / NM * 2*Math.PI, a1 = (s + 1) / NM * 2*Math.PI, am = (a0 + a1) / 2;
        for (let k0 = 0; k0 < NK;){
          const i0 = k0*NM + s;
          if (!quiet[i0]){
            const pa = cn.patches[i0];
            const hc = [cAt(k0, s), cAt(k0, s + 1), cAt(k0 + 1, s + 1), cAt(k0 + 1, s)];
            const qc = [cn.corners[k0*NM + s], cn.corners[k0*NM + (s + 1) % NM], cn.corners[(k0 + 1)*NM + (s + 1) % NM], cn.corners[(k0 + 1)*NM + s]].map(P);
            piece(pa.f0, pa.f1, pa.a0, pa.a1, hc, qc, 0);
            k0++;
            continue;
          }
          let k1 = k0 + 1;
          while (k1 < NK && quiet[k1*NM + s] && ce[k1*NM + s] === ce[i0]) k1++;
          const fl = k0 / NK, fh = k1 / NK;
          emit(ce[i0], (k0 === 0 ? [at(0, 0)] : [at(fl, a0), at(fl, am), at(fl, a1)]).concat([at(fh, a1), at(fh, am), at(fh, a0)]).map(P));
          k0 = k1;
        }
      }
      // The rim, cut where it passes behind the solid or into it.
      const rim = classRuns(0, 2*Math.PI, 48, a => hidden(at(1, a))).map(rn => {
        const pts = [P(at(1, rn.a))];
        for (let a = (Math.floor(rn.a / (2*Math.PI / 48)) + 1) * 2*Math.PI / 48; a < rn.b; a += 2*Math.PI / 48) pts.push(P(at(1, a)));
        pts.push(P(at(1, rn.b)));
        return { hid: rn.hid, pts };
      });
      return { out, rim };
    };
    const coneParts = new Map();          // cone → { out: [hidden polygons, visible polygons], rim }
    for (const d of m.dirs) for (const cn of d.cones) coneParts.set(cn, splitCone(cn));
    const conePass = (hid, li) => {
      // One path per cone end, the farther ends first: where two cones overlap the
      // nearer one's colour is on top.
      const groups = [];
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const d of m.dirs) for (const cn of d.cones){
        const polys = coneParts.get(cn).out[hid ? 0 : 1];
        if (!polys.length) continue;
        for (const pts of polys) for (const p of pts){ if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
        groups.push({ polys, z: dot(r2, cn.c), col: T.dirs[d.slot % T.dirs.length] });
      }
      if (groups.length){
        groups.sort((x, y) => x.z - y.z);
        const box = snap(x0 - 1, y0 - 1, x1 + 1, y1 + 1, cr, Sz), gc = layer(li, Sz, cr, box);
        for (const gr of groups){
          gc.fillStyle = gr.col;
          gc.beginPath();
          for (const pts of gr.polys) addPoly(gc, pts);
          gc.fill();
        }
        blit(g, li, cr, box, CONE_ALPHA);
      }
      g.globalAlpha = 0.5;
      g.lineWidth = 1;
      g.lineCap = 'butt';
      g.lineJoin = 'round';
      for (const d of m.dirs) for (const cn of d.cones){
        g.strokeStyle = T.dirs[d.slot % T.dirs.length];
        g.beginPath();
        for (const rn of coneParts.get(cn).rim){
          if (rn.hid !== hid) continue;
          g.moveTo(rn.pts[0][0], rn.pts[0][1]);
          for (let i = 1; i < rn.pts.length; i++) g.lineTo(rn.pts[i][0], rn.pts[i][1]);
        }
        g.stroke();
      }
      g.globalAlpha = 1;
    };

    /* Edges: the silhouette (between a face turned to the viewer and one turned away)
       and the creases (caps' rims, box edges); hidden creases dashed, under the solid. */
    const edgePass = hid => {
      g.lineCap = 'round';
      g.lineWidth = hid ? 0.9 : 1.1;
      g.setLineDash(hid ? [3, 3] : []);
      g.globalAlpha = hid ? 0.7 : 1;
      const faded = [];
      g.strokeStyle = T.edge;
      g.beginPath();
      for (const ed of edges){
        if (ed.fade < 0.02) continue;
        const a = front[ed.f1], b = ed.f2 < 0 ? a : front[ed.f2];
        const show = hid ? (ed.crease && !a && !b) : ((ed.crease && (a || b)) || (a !== b));
        if (!show) continue;
        if (vf[ed.i] < 0.999 || vf[ed.j] < 0.999){ faded.push(ed); continue; }
        const p = Q[ed.i], q = Q[ed.j];
        g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]);
      }
      g.stroke();
      // Edges running into an open end fade along their length, as the faces do.
      g.lineCap = 'butt';
      for (const ed of faded){
        const p = Q[ed.i], q = Q[ed.j];
        const gr = g.createLinearGradient(p[0], p[1], q[0], q[1]);
        // Squared: a line shows more than a translucent face, so it goes sooner.
        gr.addColorStop(0, rgba(T.edgeRgb, vf[ed.i] ** 2));
        gr.addColorStop(1, rgba(T.edgeRgb, vf[ed.j] ** 2));
        g.strokeStyle = gr;
        g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); g.stroke();
      }
      g.globalAlpha = 1;
      g.setLineDash([]);
    };

    // Under the solid: what it hides.
    conePass(true, 1);
    edgePass(true);
    drawRuns(true);
    // The solid.
    blit(g, 0, lr, sb, SOLID_ALPHA);
    edgePass(false);
    // On top: what is in front of it or beside it.
    conePass(false, 2);
    drawRuns(false);

    /* Labels at the + ends, placed clear of the lines (placeLabels). */
    const f1 = Sz >= 280 ? 12 : 11, f2 = f1 - 1.5;
    const items = heads.map(h => {
      const d = h.d, runsL = millerRuns(d.label);
      const tail = d.det ? ` ±${fmtDeg(d.esd)}°` : ' not determined';
      // The angle off the nearest body axis, under a determined direction that has one
      // (an undetermined one has no meaningful angle to give).
      const sub = offShown(d) ? `${fmtDeg(d.off)}° off axis` : '';
      g.font = `600 ${f1}px ${T.font}`;
      runsL.forEach(rn => { rn.w = g.measureText(rn.s).width; });
      g.font = `400 ${f1}px ${T.font}`;
      const tw = g.measureText(tail).width;
      g.font = `400 ${f2}px ${T.font}`;
      const sw = sub ? g.measureText(sub).width : 0;
      const w1 = runsL.reduce((s, rn) => s + rn.w, 0) + tw;
      // Straight out is along the line; for a line seen end-on (a dot), out from the centre.
      let ox = h.tip[0] - h.base[0], oy = h.tip[1] - h.base[1], n = Math.hypot(ox, oy);
      if (n < 2.5){ ox = h.tip[0] - cx; oy = h.tip[1] - cy; n = Math.hypot(ox, oy); }
      if (n < 1){ ox = Math.SQRT1_2; oy = -Math.SQRT1_2; n = 1; }
      return { h, slot: d.slot, runsL, tail, sub, sw, w1, w: Math.max(w1, sw), hgt: f1 * 1.2 + (sub ? f2 * 1.25 : 0), tip: h.tip, out: [ox / n, oy / n] };
    });
    // What a label must not cover: every direction line (all of it, through the solid
    // and behind it too, which shows dimmed) and arrowhead (its broad base, then its
    // point; or the dot of one seen end-on).
    const obstacles = [];
    for (const h of heads){
      obstacles.push({ x0: h.tail[0], y0: h.tail[1], x1: h.tip[0], y1: h.tip[1], hw: 2.5 });
      const dx = h.tip[0] - h.base[0], dy = h.tip[1] - h.base[1], n = Math.hypot(dx, dy);
      if (n < 2.5){ obstacles.push({ x0: h.tip[0], y0: h.tip[1], x1: h.tip[0], y1: h.tip[1], hw: 6.5 }); continue; }
      const ux = dx / n, uy = dy / n, [tx, ty] = h.tip;
      obstacles.push({ x0: tx - 9*ux, y0: ty - 9*uy, x1: tx - 4*ux, y1: ty - 4*uy, hw: 6.5 },
        { x0: tx - 4*ux, y0: ty - 4*uy, x1: tx + 2*ux, y1: ty + 2*uy, hw: 4.5 });
    }
    // The scale bar's corner is taken.
    const bar = m.known ? (() => {
      const want = 0.22 * Sz / k, e = Math.pow(10, Math.floor(Math.log10(want))), f = want / e;
      const nm = (f >= 5 ? 5 : f >= 2 ? 2 : 1) * e;
      return { nm, px: nm * k, x: 10, y: Sz - 10 };
    })() : null;
    const fixed = bar ? [{ x: 4, y: Sz - 28, w: bar.px + 14, hgt: 26 }] : [];
    if (items.length){
      placeLabels(items, obstacles, fixed, Sz, labelsWere);
      // where they sat, for the next frame (a PNG takes the screen's places, as they are)
      if (!forPng){ labelsWere.clear(); for (const it of items) labelsWere.set(it.slot, [it.x + it.w / 2 - it.tip[0], it.y + it.hgt / 2 - it.tip[1]]); }
    }
    g.textBaseline = 'alphabetic';
    g.lineJoin = 'round';
    for (const b of items){
      const col = b.h.col;
      // Each line of text towards the tip: right-aligned in a label left of it,
      // left-aligned right of it, centred over or under it.
      const al = b.x + b.w <= b.tip[0] + 6 ? 1 : b.x >= b.tip[0] - 6 ? 0 : 0.5;
      let x = b.x + (b.w - b.w1) * al;
      const y = b.y + f1 * 0.95;
      g.lineWidth = 3;
      g.strokeStyle = T.halo;
      g.fillStyle = col;
      g.font = `600 ${f1}px ${T.font}`;
      for (const rn of b.runsL){
        g.strokeText(rn.s, x, y);
        g.fillText(rn.s, x, y);
        if (rn.bar){
          const yb = y - f1 * 0.80;
          g.lineWidth = 3.4; g.beginPath(); g.moveTo(x + 0.5, yb); g.lineTo(x + rn.w - 0.5, yb); g.stroke();
          g.strokeStyle = col; g.lineWidth = 1.1; g.stroke();
          g.strokeStyle = T.halo; g.lineWidth = 3;
        }
        x += rn.w;
      }
      g.font = `400 ${f1}px ${T.font}`;
      g.strokeText(b.tail, x, y);
      g.fillText(b.tail, x, y);
      if (b.sub){
        g.font = `400 ${f2}px ${T.font}`;
        const xs = b.x + (b.w - b.sw) * al;
        g.fillStyle = T.muted;
        g.strokeText(b.sub, xs, y + f2 * 1.25);
        g.fillText(b.sub, xs, y + f2 * 1.25);
      }
    }

    /* The scale bar: a round number of nm. */
    if (bar){
      g.strokeStyle = T.muted;
      g.lineWidth = 1.5;
      g.lineCap = 'butt';
      g.beginPath();
      g.moveTo(bar.x, bar.y - 4); g.lineTo(bar.x, bar.y); g.lineTo(bar.x + bar.px, bar.y); g.lineTo(bar.x + bar.px, bar.y - 4);
      g.stroke();
      g.font = `400 ${f2}px ${T.font}`;
      g.fillStyle = T.muted;
      g.textAlign = 'center';
      g.fillText(`${fmtNm(bar.nm)} nm`, bar.x + bar.px / 2, bar.y - 5);
      g.textAlign = 'start';
    }
  }

  function measure(){
    const cs = getComputedStyle(container);
    const w = container.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
    return w > 0 ? Math.round(clamp(w, SIZE_MIN, SIZE_MAX)) : 0;
  }
  function draw(fast = false){
    if (dead || !model) return;
    const s = measure() || S;
    if (!s) return;
    const r = window.devicePixelRatio || 1;
    if (s !== S || r !== ratio){
      S = s; ratio = r;
      canvas.style.width = canvas.style.height = S + 'px';
      canvas.width = canvas.height = Math.round(S * ratio);
      cap.style.maxWidth = S + 'px';
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Every frame from the context's defaults: a line join or dash left by the last one
    // would make the same view come out different from one frame to the next.
    ctx.save();
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    paint(ctx, S, ratio, fast);
    ctx.restore();
  }
  // A frame is fast while the solid is being turned continuously (a drag, a held key).
  let drag = null, lastTap = null, keyHeld = false;
  const busy = () => !!(drag && drag.moved) || keyHeld;
  const request = () => { if (!raf && !dead) raf = requestAnimationFrame(() => { raf = 0; draw(busy()); }); };

  /* ---------- interaction ---------- */
  const rotate = (dx, dy) => {           // screen pixels → a turn about the axis normal to the drag
    const n = Math.hypot(dx, dy);
    if (!n) return;
    R = reortho(matMul(axisAngle([dy / n, dx / n, 0], n * 1.2 * Math.PI / (S || 260)), R));
    request();
  };
  const reset = () => { R = model ? model.home.slice() : viewAt(HOME_AZ, HOME_EL); labelsWere.clear(); request(); };
  const onDown = e => {
    if (!model || drag || (e.pointerType === 'mouse' && e.button !== 0)) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, moved: false };
    try { canvas.setPointerCapture(e.pointerId); } catch(_){}
    canvas.classList.add('is-grabbing');
    e.preventDefault();
    // Keys work after a drag too; but a ring drawn on a mouse or touch focus is noise.
    canvas.focus({ preventScroll: true, focusVisible: false });
  };
  const onMove = e => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX; drag.y = e.clientY;
    if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 4) drag.moved = true;
    rotate(dx, dy);
  };
  const onUp = e => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    canvas.classList.remove('is-grabbing');
    try { canvas.releasePointerCapture(e.pointerId); } catch(_){}
    // The drag's frames were fast ones: the view where it was left, at full quality.
    if (d.moved) request();
    // A double tap resets (touch and pen; a mouse has dblclick). Taps only, not drags.
    if (e.type !== 'pointerup' || d.moved || e.pointerType === 'mouse') return;
    const now = performance.now();
    if (lastTap && now - lastTap.t < 350 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 24){ lastTap = null; reset(); }
    else lastTap = { t: now, x: e.clientX, y: e.clientY };
  };
  const onDbl = e => { if (model){ e.preventDefault(); reset(); } };
  const onKey = e => {
    if (!model || e.altKey || e.ctrlKey || e.metaKey) return;
    const st = e.shiftKey ? 2 : 10, px = st * DEG * (S || 260) / (1.2 * Math.PI);
    const mv = { ArrowLeft: [-px, 0], ArrowRight: [px, 0], ArrowUp: [0, -px], ArrowDown: [0, px] }[e.key];
    if (!mv && e.key !== 'Home') return;
    // The key is the view's: no page scroll, and no document-level handler (← / → step
    // through the samples there) may act on it too.
    e.preventDefault();
    e.stopPropagation();
    if (!mv){ reset(); return; }
    // A held key repeats: fast frames, as a drag, until it is let go.
    if (e.repeat) keyHeld = true;
    rotate(mv[0], mv[1]);
  };
  const onKeyUp = () => { if (keyHeld){ keyHeld = false; request(); } };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('lostpointercapture', onUp);
  canvas.addEventListener('dblclick', onDbl);
  canvas.addEventListener('keydown', onKey);
  canvas.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('blur', onKeyUp);

  /* ---------- follow the container, the theme and the screen ---------- */
  // Only the container's width sets the view's size (its height follows the canvas).
  // The draw waits for the next frame: resizing the canvas inside the observer's own
  // delivery changes the layout it is observing, which the browser reports as a loop.
  let seenW = -1;
  const ro = new ResizeObserver(entries => {
    const w = Math.round(entries[entries.length - 1].contentRect.width);
    if (w === seenW) return;
    seenW = w;
    if (model) request();
  });
  ro.observe(container);
  const onTheme = () => { theme = null; request(); };
  const mo = new MutationObserver(onTheme);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  const mql = window.matchMedia ? matchMedia('(prefers-color-scheme: light)') : null;
  if (mql) mql.addEventListener('change', onTheme);
  // A window moved to a screen of another pixel ratio: redraw sharp there.
  let dprMql = null;
  const onDpr = () => { watchDpr(); request(); };
  const watchDpr = () => {
    if (dprMql) dprMql.removeEventListener('change', onDpr);
    dprMql = window.matchMedia ? matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`) : null;
    if (dprMql) dprMql.addEventListener('change', onDpr);
  };
  watchDpr();
  // The labels are text in the app's web font: drawn before it has loaded, they would
  // keep the fallback face until the next redraw.
  const fonts = document.fonts;
  if (fonts){
    fonts.addEventListener('loadingdone', request);
    fonts.ready.then(() => { if (model) request(); });
  }

  // What a screen reader says on focus: the solid once (the caption, which the card
  // writes with its sizes, or else its type and sizes), the directions as the canvas
  // gives them, and the keys.
  function describe(m){
    const what = caption || `${TYPE_NAMES[m.type]} ${m.raw.map(v => Number.isFinite(v) && v > 0 ? fmtNm(v) : '∞').join(' × ')} nm`;
    const ds = m.dirs.map(d => d.label + ' '
      + (d.det ? `±${fmtDeg(d.esd)}°` + (offShown(d) ? `, ${fmtDeg(d.off)}° off axis` : '') : 'not determined')).join('; ');
    return `Crystallite shape in 3D: ${what}${ds ? '. Directions: ' + ds : ''}. Drag or use the arrow keys to rotate, Home to reset.`;
  }

  return {
    set(solid){
      if (dead) return;
      if (!solid){
        model = null; sig = ''; caption = '';
        wrap.hidden = true;
        cap.textContent = '';
        canvas.removeAttribute('aria-label');
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }
      model = buildModel(solid);
      theme = null;                     // the container may have moved since
      // The same solid again (a re-render) keeps the user's view; another one starts
      // from its home view (unless a view was put in for it before it came).
      const s = JSON.stringify([model.type, model.raw, solid.frame]);
      if (s !== sig){ sig = s; if (!keepView){ R = model.home.slice(); labelsWere.clear(); } }
      keepView = false;
      caption = solid.caption ? String(solid.caption) : '';
      cap.textContent = caption;
      cap.hidden = !caption;
      canvas.setAttribute('aria-label', describe(model));
      wrap.hidden = false;
      draw();
    },
    // The camera, as plain numbers (JSON-safe), with where the labels sat: give it back
    // to setView to see the solid turned the same way again, labelled the same way.
    getView(){
      return { v: 1, R: R.slice(), labels: [...labelsWere].map(([slot, o]) => [slot, o[0], o[1]]) };
    },
    setView(state){
      if (dead || !state || !Array.isArray(state.R) || state.R.length !== 9) return false;
      const M = state.R.map(Number);
      if (!M.every(Number.isFinite)) return false;
      // A rotation, or near enough to be put right; anything else (a mirror, a
      // squashed matrix) is not a view and is ignored.
      const rows = [M.slice(0, 3), M.slice(3, 6), M.slice(6, 9)];
      const err = Math.max(...rows.map(v => Math.abs(dot(v, v) - 1)), Math.abs(dot(rows[0], rows[1])), Math.abs(dot(rows[1], rows[2])), Math.abs(dot(rows[0], rows[2])));
      if (err > 1e-3 || dot(cross(rows[0], rows[1]), rows[2]) < 0.5) return false;
      R = err < 1e-12 ? M : reortho(M);
      labelsWere.clear();
      if (Array.isArray(state.labels)) for (const l of state.labels)
        if (Array.isArray(l) && l.length === 3 && l.every(Number.isFinite)) labelsWere.set(l[0], [l[1], l[2]]);
      if (model) draw(); else keepView = true;
      return true;
    },
    destroy(){
      if (dead) return;
      dead = true;
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect(); mo.disconnect();
      if (mql) mql.removeEventListener('change', onTheme);
      if (dprMql) dprMql.removeEventListener('change', onDpr);
      if (fonts) fonts.removeEventListener('loadingdone', request);
      wrap.remove();
      layers.length = 0;
      model = null;
    },
    // The view as a PNG (labels and caption in), at twice the CSS size at least.
    png(){
      if (dead || !model) return null;
      const Sz = S || measure() || SIZE_MAX, r = Math.max(2, window.devicePixelRatio || 1);
      const T = themeOf();
      const capH = caption ? 24 : 0;
      const c = document.createElement('canvas');
      c.width = Math.round(Sz * r); c.height = Math.round((Sz + capH) * r);
      const g = c.getContext('2d');
      g.setTransform(r, 0, 0, r, 0, 0);
      g.fillStyle = T.bg;
      g.fillRect(0, 0, Sz, Sz + capH);
      paint(g, Sz, r, false, true);
      if (caption){
        g.font = `400 12px ${T.font}`;
        g.fillStyle = T.muted;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(caption, Sz / 2, Sz + capH / 2 - 2, Sz - 12);
      }
      return c.toDataURL('image/png');
    },
  };
}
