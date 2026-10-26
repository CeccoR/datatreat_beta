/* Checks design.json's frames against what the search can hold, and its rows against the
   generator's reader.
   - Each truth's R is a proper rotation; each 'on' truth's first axis lies exactly on a
     lattice direction of the phase's lowIndexAxes and (three-turn bodies) its second on a
     lattice row exactly normal to it; a 'near' truth is 2–10° from its 'on' frame.
   - The held frames the engine would try for the truth's own frame: freeShapeRun's snaps
     (copied here from xrd-rietveld.js, b9bef5f, as it is: the most telling axis within
     SNAP_DEG of a lattice direction set on it, then the 3 simplest rows exactly normal to
     it and the simplest within SNAP_DEG of each other axis). An 'on' truth must be one of
     them (worst axis ≤ 1e-5°); for 'near' and 'generic' truths, how far the nearest held
     frame is.
   - Every row passes the generator's normRow (../gen/gen.mjs), when it is there.
   Run: node check-frames.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { phaseQ, ENG, unit, cross, dot, cols, angAx, mv, compareSolids, laueRotations } from '../harness/lib.mjs';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const { lattDirection, latticeAcross, BODIES, SNAP_DEG, D2R, quatOfMat, quatMat } = ENG;
const design = JSON.parse(fs.readFileSync(path.join(HERE, 'design.json'), 'utf8'));
const widthOf = D => 0.9*1.540598/(D*10)*180/Math.PI;

// freeShapeRun's snaps(v), on a frame R and widths W (the body's own parameters)
function snaps(q, type, W, R){
  const B = BODIES[type], col = i => [R[i], R[3 + i], R[6 + i]];
  const Wx = B.axes(W), gap = i => Math.min(...[0, 1, 2].filter(j=> j !== i).map(j=> Math.abs(Wx[i] - Wx[j])));
  const cand = (B.rot === 2 ? [2] : [0, 1, 2]).map(i=> ({ i, ...lattDirection(q, col(i)) })).filter(c=> c.angle <= SNAP_DEG).sort((a, b)=> gap(b.i) - gap(a.i));
  if (!cand.length) return [];
  const p = cand[0].i, cp = cand[0].vec.map(t=> t*Math.sign(dot(cand[0].vec, col(p)) || 1));
  const frameOf = (s, ds) => {
    let cs = unit(ds.map((t, j)=> t - dot(ds, cp)*cp[j]));
    if (dot(cs, col(s)) < 0) cs = cs.map(t=> -t);
    const t = 3 - p - s, cyc = (s - p + 3) % 3 === 1, ct = cyc ? cross(cp, cs) : cross(cs, cp);
    const C = []; C[p] = cp; C[s] = cs; C[t] = ct;
    return quatMat(quatOfMat([C[0][0], C[1][0], C[2][0], C[0][1], C[1][1], C[2][1], C[0][2], C[1][2], C[2][2]]));
  };
  if (B.rot === 2) return [frameOf(p === 2 ? 0 : 2, col(p === 2 ? 0 : 2))];
  const others = [0, 1, 2].filter(i=> i !== p), all = latticeAcross(q, cp, null, 0.01, 64), pick = all.slice(0, 3);
  for (const s of others){
    const c = all.find(c=> Math.abs(dot(c.vec, col(s))) >= Math.cos(SNAP_DEG*D2R));
    if (c && !pick.includes(c)) pick.push(c);
  }
  return pick.map(({ vec })=> {
    const s = Math.abs(dot(vec, col(others[0]))) >= Math.abs(dot(vec, col(others[1]))) ? others[0] : others[1];
    return frameOf(s, vec);
  });
}

let fails = 0;
const ok = (c, m) => { if (!c){ fails++; console.log('FAIL ' + m); } };
let nearBack = 0;
const stat = { on: [], near: [], generic: [] }, heldBy = { on: 0, near: 0, generic: 0 }, n = { on: 0, near: 0, generic: 0 };
for (const r of design.rows.filter(r=> r.kind === 'truth')){
  const R = r.R, det = R[0]*(R[4]*R[8] - R[5]*R[7]) - R[1]*(R[3]*R[8] - R[5]*R[6]) + R[2]*(R[3]*R[7] - R[4]*R[6]);
  const RtR = [0, 1, 2].flatMap(i=> [0, 1, 2].map(j=> R[i]*R[j] + R[3 + i]*R[3 + j] + R[6 + i]*R[6 + j]));
  ok(Math.abs(det - 1) < 1e-9 && RtR.every((t, k)=> Math.abs(t - (k % 4 === 0 ? 1 : 0)) < 1e-9), `${r.id}: R not a proper rotation`);
  const q = phaseQ(r.phase), B = BODIES[r.solid], w = r.dims.map(widthOf), W = B.W.length === 2 ? [w[0], w[2]] : w;
  const truth = { type: r.solid, dims: r.dims, axes: cols(R) };
  // the nearest held frame to the truth (its own body, compared as the same solid)
  // (an ellipsoid whose three extents are within 4 % has no defined axis: NaN, left out)
  const held = snaps(q, r.solid, W, R).map(H=> { const c = compareSolids({ type: r.solid, dims: r.dims, axes: cols(H) }, truth); return c.orient ?? c.principal ?? NaN; });
  const best = held.length ? Math.min(...held) : Infinity;
  if (Number.isNaN(best)){ console.log(`${r.id}: no defined axis (extents ${r.dims.join(', ')})`); continue; }
  stat[r.orient].push(best); n[r.orient]++;
  if (best <= 1e-5) heldBy[r.orient]++;
  // a 'near' truth: is its 'on' frame (the tilt undone) among the frames held from it?
  if (r.orient === 'near'){
    const on = { type: r.solid, dims: r.dims, axes: cols(r.frame.R0) };
    // R is R0 turned by tiltDeg about tiltAxis
    const tilt = Math.max(...cols(R).map((v, i)=> angAx(v, on.axes[i])));
    ok(tilt <= r.frame.tiltDeg + 1e-9, `${r.id}: R is ${tilt}° from R0, more than its tilt`);
    const back = snaps(q, r.solid, W, R).map(H=> { const cc = compareSolids({ type: r.solid, dims: r.dims, axes: cols(H) }, on); return cc.orient ?? cc.principal ?? NaN; });
    if (back.some(t=> t <= 1e-5)) nearBack++;
  }
  if (r.orient === 'on'){
    ok(best <= 1e-5, `${r.id}: the 'on' frame is not one the search holds (nearest ${best.toFixed(3)}°)`);
    const ax = cols(R), p = 'xyz'.indexOf(r.frame.firstAxis), L = lattDirection(q, ax[p]);
    ok(L.angle < 1e-5, `${r.id}: first axis ${L.angle}° off ${L.label}`);
  }
}
const med = a => { const s = a.filter(Number.isFinite).sort((x, y)=> x - y); return s.length ? s[Math.floor(s.length/2)] : NaN; };
for (const o of ['on', 'near', 'generic'])
  console.log(`${o}: ${n[o]} truths; the truth's own frame among the held frames: ${heldBy[o]}; nearest held frame median ${med(stat[o]).toFixed(2)}°, max ${Math.max(...stat[o].filter(Number.isFinite)).toFixed(2)}°, none within ${SNAP_DEG}°: ${stat[o].filter(x=> !Number.isFinite(x)).length}`);
// 'near': the turn from the 'on' frame
const tilts = design.rows.filter(r=> r.orient === 'near').map(r=> r.frame.tiltDeg);
ok(tilts.every(t=> t >= 2 && t <= 10), 'a near frame outside 2–10°');
console.log(`near: tilts ${Math.min(...tilts).toFixed(2)}–${Math.max(...tilts).toFixed(2)}°; the frame it was turned from among the frames held from it: ${nearBack} of ${tilts.length}`);
// the generator's reader
const genFile = path.join(HERE, '..', 'gen', 'gen.mjs');
if (fs.existsSync(genFile)){
  const { normRow } = await import(genFile);
  let bad = 0; for (const r of design.rows){ try { normRow(r); } catch(e){ bad++; console.log('FAIL normRow ' + r.id + ': ' + e.message); } }
  ok(!bad, `${bad} rows the generator cannot read`);
  console.log(`the generator's normRow reads ${design.rows.length - bad} of ${design.rows.length} rows`);
}
console.log(fails ? `${fails} failed` : 'all checks passed');
process.exit(fails ? 1 : 0);
