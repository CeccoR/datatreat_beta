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
