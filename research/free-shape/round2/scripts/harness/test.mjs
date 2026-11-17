#!/usr/bin/env node
/* The harness's own tests: node test.mjs [--run] (--run adds two runCase smoke runs on
   stand-in patterns, about 2 min). Prints each check and FAIL lines; exits 1 on a failure.
   1. The class's rotations: as many as the class has proper operations, orthogonal,
      proper; each maps every reflection's members onto members of the same reflection
      (as lines): the Cartesian action is the one the engine draws with. The holohedry
      contains them.
   2. compareSolids: a truth turned by every rotation of its class (and by its own body's
      symmetry: a square's or a cube's edges swapped, axes reversed) compares to itself
      with no error, for every phase and solid, on random frames and on the lattice; a
      truth turned 3° off does not; in a merohedral class an operation of the holohedry
      outside the class is an error modulo the class, none modulo the holohedry.
   3. canonical: equal for every frame equivalent by the class's rotations and the body's
      symmetry; idempotent; its directions as the engine names a family (lattDirection). */
import { PHASES, laueRotations, holoRotations, phaseQ, compareSolids, accuracy, canonical, canonicalDir, dirLabel, lattCoords,
  rng, randomRotation, mv, mm, cols, fromCols, unit, cross, dot, angAx, rotAbout, ENG, REVOLUTION, runCase, loadMethod, modelPattern, HERE } from './lib.mjs';
import path from 'node:path';
const ORDER = { '-1': 2, '2/m': 4, mmm: 8, '4/m': 8, '4/mmm': 16, '-3': 6, '-3m': 12, '6/m': 12, '6/mmm': 24, 'm-3': 24, 'm-3m': 48 };
const HOLO = { '-1': 2, '2/m': 4, mmm: 8, '4/m': 16, '4/mmm': 16, '-3': 24, '-3m': 24, '6/m': 24, '6/mmm': 24, 'm-3': 48, 'm-3m': 48 };
let fails = 0, checks = 0;
const ok = (c, msg) => { checks++; if (!c){ fails++; console.log('FAIL ' + msg); } };
const SOLIDS = ['box', 'sqbox', 'cylinder', 'ellcyl', 'ellipsoid', 'spheroid'];
const dimsFor = (type, r) => {
  const d = [0, 1, 2].map(()=> 2*Math.exp(2*r.u()));
  if (type === 'sqbox' || type === 'cylinder' || type === 'spheroid') d[1] = d[0];
  return d;
};
// the body's own symmetry: a turn by 180° about any of its axes; a square's or round
// section's x and y swapped (with z reversed, to stay proper)
function bodySym(solid, r){
  let ax = solid.axes.map(a=> [...a]);
  const k = Math.floor(3*r.u()); ax = ax.map((a, i)=> i === k ? a : a.map(t=> -t));
  if ((solid.type === 'sqbox' || REVOLUTION.has(solid.type)) && r.u() < 0.5) ax = [ax[1], ax[0], ax[2].map(t=> -t)];
  return { ...solid, axes: ax };
}
const turned = (solid, G) => ({ ...solid, axes: solid.axes.map(a=> mv(G, a)) });
const sameFrame = (a, b, type) => {
  if (REVOLUTION.has(type)) return Math.abs(dot(a.axes[2], b.axes[2])) > 1 - 1e-9;
  return [0, 1, 2].every(i=> Math.abs(dot(a.axes[i], b.axes[i])) > 1 - 1e-9);
};

const R0 = rng(20261026);
for (const P of PHASES){
  const id = P.id, q = phaseQ(id), rots = laueRotations(id), holo = holoRotations(id);
  // 1. rotations
  ok(rots.length === ORDER[P.laue]/2, `${id}: ${rots.length} rotations, want ${ORDER[P.laue]/2}`);
  ok(holo.length === HOLO[P.laue]/2, `${id}: ${holo.length} holohedry rotations, want ${HOLO[P.laue]/2}`);
  for (const G of rots){
    const GtG = mm([G[0], G[3], G[6], G[1], G[4], G[7], G[2], G[5], G[8]], G);
    ok(GtG.every((t, i)=> Math.abs(t - (i % 4 === 0 ? 1 : 0)) < 1e-9), `${id}: a rotation not orthogonal`);
    ok(holo.some(H=> H.every((t, i)=> Math.abs(t - G[i]) < 1e-9)), `${id}: a class rotation not in the holohedry`);
    for (let r = 0; r < q.nRefl; r++){
      const m = q.mv[r], n = m.length/3;
      for (let i = 0; i < n; i++){
        const u = mv(G, [m[3*i], m[3*i + 1], m[3*i + 2]]);
        let hit = false; for (let j = 0; j < n && !hit; j++) hit = Math.abs(Math.abs(u[0]*m[3*j] + u[1]*m[3*j + 1] + u[2]*m[3*j + 2]) - 1) < 1e-9;
        if (!hit){ ok(false, `${id}: a rotation takes a member of reflection ${r} off its family`); break; }
      }
    }
  }
  // frames to test: random, and on the lattice (a low-index axis, a lattice row across it)
  const frames = [];
  for (let i = 0; i < 4; i++) frames.push(randomRotation(R0));
  for (const e of ENG.lowIndexAxes(q)){
    const acr = ENG.latticeAcross(q, e, null, 0.01, 64).slice(0, 2);
    for (const a of acr){ const z = unit(e), x = unit(a.vec); frames.push(fromCols([x, cross(z, x), z])); }
    if (!acr.length){ const z = unit(e), x = unit(cross(z, Math.abs(z[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0])); frames.push(fromCols([x, cross(z, x), z])); }
  }
  // and those frames turned 3° about a random axis (near the lattice: the zone's ties)
  const nOn = frames.length - 4;
  for (let k = 4; k < 4 + nOn; k++){ const T = rotAbout([R0.n(), R0.n(), R0.n()], 3); frames.push(fromCols(cols(frames[k]).map(c=> mv(T, c)))); }
  // a direction 2° off a low-index row reads next to that row's family name
  let nNear = 0;
  for (const e of ENG.lowIndexAxes(q)){
    const T = rotAbout(cross(e, [R0.n(), R0.n(), R0.n()]), 2), u = mv(T, e), c = canonicalDir(id, u), L = ENG.lattDirection(q, e);
    ok(c.off <= 2 + 1e-6 && c.family === L.label, `${id}: ${L.label} turned 2° reads ${c.label} (${c.family}, ${c.off.toFixed(2)}° off)`); nNear++;
  }
  let nCmp = 0, nCan = 0, worstSelf = 0, worstHolo = 0;
  for (const type of SOLIDS) for (const R of frames){
    const truth = { type, dims: dimsFor(type, R0), axes: cols(R) };
    // 2. compareSolids
    for (const G of rots){
      const fit = bodySym(turned(truth, G), R0);
      const a = compareSolids(fit, truth, { rots });
      worstSelf = Math.max(worstSelf, a.orient || 0, a.principal || 0, 1e3*a.dimMax); nCmp++;
    }
    const off = compareSolids(turned(truth, rotAbout([R0.n(), R0.n(), R0.n()], 3)), truth, { rots });
    ok(off.orient == null || (off.orient > 0.05 && off.orient <= 3 + 1e-6), `${id} ${type}: a 3° turn reads ${off.orient}°`);
    // merohedral: a holohedry operation outside the class
    const outside = holo.filter(H=> !rots.some(G=> G.every((t, i)=> Math.abs(t - H[i]) < 1e-9)));
    if (outside.length && !REVOLUTION.has(type) && type !== 'spheroid'){
      const H = outside[Math.floor(R0.u()*outside.length)], acc = accuracy(id, turned(truth, H), truth);
      worstHolo = Math.max(worstHolo, acc.orientHolo || 0);
      if (frames.indexOf(R) < 4) ok(acc.orient > 0.5, `${id} ${type}: a holohedry operation outside the class reads ${acc.orient}° modulo the class`);
    }
    // 3. canonical
    const c = canonical(id, truth);
    const cc = canonical(id, c);
    ok(sameFrame(c, cc, type), `${id} ${type}: canonical not idempotent`);
    ok(Math.abs(Math.abs(dot(cross(c.axes[0], c.axes[1]), c.axes[2])) - 1) < 1e-9 && dot(cross(c.axes[0], c.axes[1]), c.axes[2]) > 0, `${id} ${type}: canonical frame not proper`);
    for (let k = 0; k < 8; k++){
      const G = rots[Math.floor(R0.u()*rots.length)];
      const e = canonical(id, bodySym(turned(truth, G), R0));
      ok(sameFrame(c, e, type), `${id} ${type}: canonical differs for an equivalent frame`); nCan++;
    }
    // and it is the same solid
    const back = compareSolids(c, truth, { rots });
    ok((back.orient || 0) < 1e-4 && back.dimMax < 1e-12, `${id} ${type}: canonical is another solid (${back.orient}°)`);
  }
  ok(worstSelf < 1e-5, `${id}: a truth turned by its class reads ${worstSelf} (° or 1e-3 rel)`);
  ok(worstHolo < 1e-5, `${id}: a holohedry operation reads ${worstHolo}° modulo the holohedry`);
  // 3b. directions named as the engine names a family (lattDirection's first member)
  let nDir = 0;
  for (let u = -2; u <= 2; u++) for (let v = -2; v <= 2; v++) for (let w = -2; w <= 2; w++){
    if (!u && !v && !w) continue;
    const Bi = (()=> { const [b11, b12, b13, , b22, b23, , , b33] = q.Bm; return [1/b11, -b12/(b11*b22), (b12*b23 - b13*b22)/(b11*b22*b33), 0, 1/b22, -b23/(b22*b33), 0, 0, 1/b33]; })();
    const cart = unit([Bi[0]*u + Bi[3]*v + Bi[6]*w, Bi[1]*u + Bi[4]*v + Bi[7]*w, Bi[2]*u + Bi[5]*v + Bi[8]*w]);
    const L = ENG.lattDirection(q, cart), mine = canonicalDir(id, cart).label;
    const g = (a, b)=> b ? g(b, a % b) : Math.abs(a), d0 = L.dir.reduce((a, b)=> g(a, b)), want = '[' + L.dir.map(x=> x/d0).map(x=> x < 0 ? '-' + -x : '' + x).join('') + ']';
    ok(mine === want, `${id}: [${u}${v}${w}] canonical ${mine}, the engine names its family ${want}`); nDir++;
  }
  console.log(`${id.padEnd(6)} ${P.laue.padEnd(5)} rotations ${rots.length} holohedry ${holo.length} | ${nCmp} self-comparisons worst ${worstSelf.toExponential(1)} | ${nCan} canonical checks | ${nDir} directions named as the engine, ${nNear} read 2° off a row | frames on the lattice ${nOn}, turned 3° ${nOn}`);
}
// a few names spelled out
ok(canonicalDir('Pm-3m', unit([0, -1, -1])).label === '[110]', 'm-3m: [0-1-1] is not [110]');
ok(canonicalDir('Pm-3m', unit([-1, 1, -1])).label === '[111]', 'm-3m: [-11-1] is not [111]');

/* 5. Pairing by role (the pilot's verification): a spheroid or square box is paired with
   the other's symmetry axis whatever their aspects.
   - A spheroid fit with its aspect flipped (an oblate truth read prolate), its axis θ off
     the truth's: principal = θ (axis to axis), the same however the fit is spun about its
     own axis; extents by role.
   - A near-cube square box (6 × 6 × 6.4) read 6.3 × 6.3 × 5.9 with its height θ off:
     principal θ, the height −7.8 %.
   - A spheroid within 4 % of a ball has no defined axis. */
{
  let nRole = 0;
  for (let t = 0; t < 40; t++){
    const F = cols(randomRotation(R0)), th = 90*R0.u(), perp = unit(cross(F[2], [R0.n(), R0.n(), R0.n()]));
    const z2 = mv(rotAbout(perp, th), F[2]), x0 = unit(cross(z2, [R0.n(), R0.n(), R0.n()]));
    const truth = { type: 'spheroid', dims: [16.2, 16.2, 7.6], axes: F };
    const spins = [0, 10, 45, 80].map(a=> { const x = mv(rotAbout(z2, a), x0); return compareSolids({ type: 'spheroid', dims: [8.1, 8.1, 28.3], axes: [x, cross(z2, x), z2] }, truth); });
    ok(spins.every(c=> Math.abs(c.principal - th) < 1e-5 && Math.abs(c.orient - th) < 1e-5), `spheroid flipped, axis ${th.toFixed(1)}° off: principal ${spins.map(c=> c.principal.toFixed(2)).join('/')}`);
    ok(Math.abs(spins[0].dimErr[0] - (8.1/16.2 - 1)) < 1e-12 && Math.abs(spins[0].dimErr[2] - (28.3/7.6 - 1)) < 1e-12, `spheroid flipped: extents not paired by role (${spins[0].dimErr})`);
    const sq = { type: 'sqbox', dims: [6, 6, 6.4], axes: F }, sqFit = compareSolids({ type: 'sqbox', dims: [6.3, 6.3, 5.9], axes: [mv(rotAbout(perp, th), F[0]), mv(rotAbout(perp, th), F[1]), z2] }, sq);
    ok(Math.abs(sqFit.principal - th) < 1e-5 && Math.abs(sqFit.dimErr[2] - (5.9/6.4 - 1)) < 1e-12, `near-cube square box, height ${th.toFixed(1)}° off: principal ${sqFit.principal}, height ${sqFit.dimErr[2]}`);
    const ball = compareSolids({ type: 'spheroid', dims: [8, 8, 8.2], axes: [x0, cross(z2, x0), z2] }, { type: 'spheroid', dims: [7.9, 7.9, 7.7], axes: F });
    ok(ball.orient == null && ball.principal == null, `a near-ball spheroid reads an axis (${ball.orient}°)`);
    nRole += 4;
  }
  console.log(`pairing by role: ${nRole} checks`);
}

/* 6. canonical near the lattice and under relabelling (the pilot's verification):
   - every lattice frame of every phase (each low-index axis with each of its first three
     normal rows, both as the normal and as the second axis), for each solid, turned 10⁻⁶°
     and 0.01° about 8 random axes: the canonical frame stays within twice the turn of the
     unturned frame's, slot by slot (the first form jumped 30–90° on 5 of the design's 66
     'on' frames). Left out and counted: frames with an axis at the engine's naming limit,
     SNAP_DEG (10°) from the simplest row within it, where the axis's family itself changes
     with the turn (in these phases a* of P2/m, 10.000° from [100] as β = 100°);
   - a body relabelled (its slots permuted within their classes, with their extents): the
     same canonical frame and extents, slot by slot. */
{
  let nNear = 0, nRel = 0, worst = 0, nLimit = 0;
  const dimsOf = type => type === 'sqbox' || REVOLUTION.has(type) ? [12, 12, 4] : [4, 7, 12];
  const close = (a, b, type, tol) => REVOLUTION.has(type) ? angAx(a.axes[2], b.axes[2]) <= tol : [0, 1, 2].every(i=> angAx(a.axes[i], b.axes[i]) <= tol && Math.abs(a.dims[i] - b.dims[i]) < 1e-12);
  for (const P of PHASES){
    const id = P.id, q = phaseQ(id), rots = laueRotations(id);
    for (const e of ENG.lowIndexAxes(q)) for (const a of ENG.latticeAcross(q, e, null, 0.01, 64).slice(0, 3)){
      const z = unit(e), x = unit(a.vec);
      const atLimit = [z, x, cross(z, x)].some(v=> { const L = ENG.lattDirection(q, unit(v)); return L.angle > ENG.SNAP_DEG - 0.05 && L.angle < ENG.SNAP_DEG + 0.05; });
      if (atLimit){ nLimit++; continue; }
      for (const F of [[x, cross(z, x), z], [z, cross(x, z), x], [cross(z, x), z, x]]) for (const type of SOLIDS){
        const s = { type, dims: dimsOf(type), axes: F }, c0 = canonical(id, s);
        for (const deg of [1e-6, 0.01]) for (let k = 0; k < 8; k++){
          const T = rotAbout([R0.n(), R0.n(), R0.n()], deg), c1 = canonical(id, { ...s, axes: F.map(v=> mv(T, v)) });
          const d = REVOLUTION.has(type) ? angAx(c0.axes[2], c1.axes[2]) : Math.max(...[0, 1, 2].map(i=> angAx(c0.axes[i], c1.axes[i])));
          worst = Math.max(worst, d - deg);
          ok(close(c0, c1, type, 2*deg + 2e-6), `${id} ${type} [${c0.labels.join(' ')}] turned ${deg}°: canonical [${c1.labels.join(' ')}], ${d.toFixed(4)}° away`); nNear++;
        }
      }
    }
    // relabelled bodies
    for (let t = 0; t < 10; t++){
      const F = cols(randomRotation(R0));
      for (const type of ['box', 'ellipsoid', 'ellcyl', 'sqbox']){
        const d = type === 'sqbox' ? [9, 9, 4] : [3 + 2*R0.u(), 9 + 3*R0.u(), 25 + 5*R0.u()];
        const perm = type === 'box' || type === 'ellipsoid' ? [[1, 2, 0], [2, 0, 1], [1, 0, 2]][t % 3] : [1, 0, 2];
        // a permutation of the slots, the frame kept proper (an odd one turns one axis over)
        const odd = (perm[1] - perm[0])*(perm[2] - perm[0])*(perm[2] - perm[1]) < 0;
        const axes = perm.map((k, i)=> F[k].map(v=> odd && i === 0 ? -v : v));
        const c1 = canonical(id, { type, dims: d, axes: F }), c2 = canonical(id, { type, dims: perm.map(k=> d[k]), axes });
        ok(close(c1, c2, type, 1e-5), `${id} ${type} relabelled ${perm}: canonical [${c1.labels}] ${c1.dims.map(v=> v.toFixed(2))} vs [${c2.labels}] ${c2.dims.map(v=> v.toFixed(2))}`); nRel++;
      }
    }
  }
  console.log(`canonical near the lattice: ${nNear} turned frames (worst ${worst.toExponential(1)}° beyond the turn); lattice frames at the naming limit, left out: ${nLimit}; relabelled: ${nRel}`);
}

if (process.argv.includes('--run')){
  // runCase smoke runs on stand-in patterns (the model's own Lorentzian lines, 10–90° in
  // 0.02°): the run reaches the search, the truth reference refines next to the truth.
  const methods = [await loadMethod(path.join(HERE, 'methods', 'baseline.mjs')), await loadMethod(path.join(HERE, 'methods', 'truth.mjs'))];
  const rows = [
    { id: 'smoke-1', kind: 'truth', phase: 'P4m', laue: '4/m', solid: 'box', search: 'box', dims: [3, 7, 12], R: rotAbout([1, 2, 3], 37), eps: 0.001, seed: 1 },
    { id: 'smoke-2', kind: 'sphere', phase: 'P-3m1', laue: '-3m', solid: 'sphere', search: 'cylinder', D: 8, dims: [8, 8, 8], R: null, eps: 0.001, seed: 2 },
  ];
  for (const row of rows){
    const t0 = Date.now(), pat = modelPattern(row, { lo: 10, hi: 90, step: 0.02 });
    const out = runCase({ row, pattern: pat, methods, fit: {} });
    ok(!!out.iso, `${row.id}: the search not reached`);
    for (const r of out.records){
      console.log(`${row.id} ${r.method}: ${r.error ? 'ERROR ' + r.error.split('\n')[0] : r.kept ? (r.held ? 'held' : 'free') : r.rejected ? 'rejected' + (r.early ? ' early' : '') : 'none'}`
        + ` χ² ${r.chi2.toFixed(1)} ΔBIC ${r.dBIC == null ? '—' : r.dBIC.toFixed(0)} ${r.evals} evals ${r.ms} ms`
        + (r.solid ? ` dims ${r.solid.dims.map(d=> d.toFixed(2)).join('×')}` : '') + (r.acc ? ` | err ${r.acc.dimErr.map(e=> (100*e).toFixed(0) + '%').join(' ')} orient ${r.acc.orient == null ? '—' : r.acc.orient.toFixed(2)}° holo ${r.acc.orientHolo == null ? '—' : r.acc.orientHolo.toFixed(2)}°` : '')
        + (r.canonical ? ` canonical ${r.canonical.labels.join(' ')}` : ''));
      ok(!r.error, `${row.id} ${r.method}: ${r.error}`);
    }
    // the truth reference near the truth (noise and the range leave a few degrees), and
    // the baseline at its minimum
    if (row.kind === 'truth'){
      const t = out.records.find(r=> r.method === 'truth'), b = out.records.find(r=> r.method === 'baseline');
      ok(t && t.acc && t.acc.orient < 10 && t.acc.dimMax < 0.15, `${row.id}: the truth reference is far from the truth`);
      ok(b && t && Math.abs(b.chi2Best - t.chi2Best) <= Math.max(1, b.chi2nu), `${row.id}: the baseline and the truth reference end apart`);
    }
    console.log(`${row.id}: iso χ²_ν ${out.iso.chi2nu.toFixed(3)} ${out.iso.evals} evals; ${((Date.now() - t0)/1000).toFixed(0)} s`);
  }
}
console.log(`${checks} checks, ${fails} failed`);
process.exit(fails ? 1 : 0);
