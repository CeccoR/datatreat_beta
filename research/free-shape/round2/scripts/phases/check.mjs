/* Checks the eleven phases with the frozen engine (harness/eng: b9bef5f, instrumented
   only) and writes phases.json, what the design and the harness read:
   - prepPhase reads the CIF: the space group, the crystal system, the operations the
     engine finds from the atoms (their number must be the class's order), notes, warnings;
   - the Laue group the free shape uses (q.laue) has the class's order, and every
     reflection's members (q.mv, distinct directions, one per ± pair) number mult/2;
   - in 10–130° Cu Kα1 (d ≥ λ/(2 sin 65°)): reflections, members, and the closest pair of
     reflections that the class does not make equivalent (Δ2θ): exact pairs are the
     lattice's holohedry (a merohedral class's (hkl)/(khl)), counted apart;
   - the shortest interatomic distance (fictitious cells: only to see it is not absurd);
   - the frames 'on the lattice' as the search can hold them: lowIndexAxes(q) (the first
     axis's candidates) and, for each, latticeAcross(q, e, null, 0.01, 64) (the second's,
     exactly normal; freeShapeRun's snaps take the 3 simplest);
   - an isotropic Rietveld fit converges: a pattern drawn with the engine's forward model
     (10 nm, ε 0.1 %, ΔB 0.3 Å², the cell 0.2 % larger than the CIF's, the strongest line
     3000 counts on about 150, Poisson noise; round 1's instrument and refined LaB6
     profile; 10–130° in 0.01°) refined by autoRefine from the CIF with that profile, the
     size isotropic, ADP overall, strain refined. Its evaluations and time: the cost of a
     pattern in each class.
   Run: nice -n 15 node check.mjs [--nofit] */
import fs from 'node:fs';
import path from 'node:path';
import { buildModel, calc, autoRefine, setParams, ENG } from '../harness/eng/xrd-rietveld.js';
import { prepPhase } from '../harness/eng/xrd-rv-model.js';
import { reflections, metric } from '../harness/eng/xrd-cryst.js';
import { PHASES } from './make-phases.mjs';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const IRF = JSON.parse(fs.readFileSync(path.join(HERE, '..', '..', 'fs', 'harness', 'data', 'irf.json'), 'utf8'));
const INSTR = { lam1: 1.540598, lam2: 1.544426, ratio: 0.5, radius: 240, soller: { incident: 0.04, diffracted: 0.04 }, focusLength: 12, monochromator: false };
const ORDER = { '-1': 2, '2/m': 4, mmm: 8, '4/m': 8, '4/mmm': 16, '-3': 6, '-3m': 12, '6/m': 12, '6/mmm': 24, 'm-3': 24, 'm-3m': 48 };
const HOLO = { '-1': '-1', '2/m': '2/m', mmm: 'mmm', '4/m': '4/mmm', '4/mmm': '4/mmm', '-3': '6/mmm', '-3m': '6/mmm', '6/m': '6/mmm', '6/mmm': '6/mmm', 'm-3': 'm-3m', 'm-3m': 'm-3m' };
const { FS, D2R, R2D, lowIndexAxes, latticeAcross, lattDirection } = ENG;
const LO = 10, HI = 130, STEP = 0.01;
const dMin = INSTR.lam1/(2*Math.sin(HI/2*D2R)), dMax = INSTR.lam1/(2*Math.sin(LO/2*D2R));
const tt = d => 2*Math.asin(INSTR.lam1/(2*d))*R2D;
const noFit = process.argv.includes('--nofit');

function rng(seed){ let s = seed >>> 0; return ()=> { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0)/4294967296; }; }
function poisson(lam, U){
  if (!(lam > 0)) return 0;
  if (lam < 30){ const L = Math.exp(-lam); let k = 0, p = 1; do { k++; p *= U(); } while (p > L); return k - 1; }
  const n = Math.sqrt(-2*Math.log(U() || 1e-300))*Math.cos(2*Math.PI*U());
  return Math.max(0, Math.round(lam + Math.sqrt(lam)*n));      // (a check only: normal above 30)
}
const phaseOf = (prep, o) => ({ id: 1, name: prep.name, cell: prep.cell, constraint: prep.constraint, ops: prep.ops, atoms: prep.atoms, mass: prep.mass, color: '#888',
  size: true, profile: 'lorentz', strain: 'iso', faults: null, adp: 'overall', po: null, occ: null, ...o });
const vecWith = (model, P) => { const v = model.v.slice(); for (const k in P){ const i = model.index[k]; if (i == null) throw new Error('no parameter ' + k); v[i] = P[k]; } return v; };
const cartOf = c => { const r = D2R, ca = Math.cos(c.alpha*r), cb = Math.cos(c.beta*r), cg = Math.cos(c.gamma*r), sg = Math.sin(c.gamma*r);
  const cx = c.c*cb, cy = c.c*(ca - cb*cg)/sg, cz = Math.sqrt(Math.max(0, c.c*c.c - cx*cx - cy*cy)); return [c.a, c.b*cg, cx, 0, c.b*sg, cy, 0, 0, cz]; };
function minDist(prep){
  const A = cartOf(prep.cell), at = prep.atoms; let best = Infinity;
  for (let i = 0; i < at.length; i++) for (let j = i; j < at.length; j++) for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++){
    if (i === j && !a && !b && !c) continue;
    const d = [at[j].x - at[i].x + a, at[j].y - at[i].y + b, at[j].z - at[i].z + c];
    const x = [0, 1, 2].map(r=> A[3*r]*d[0] + A[3*r + 1]*d[1] + A[3*r + 2]*d[2]);
    best = Math.min(best, Math.hypot(...x));
  }
  return best;
}
// The lattice's holohedry: integer matrices (entries −1…1) that keep the metric, RᵀGR = G.
function holohedry(cell, recip = false){
  const mt = metric(cell), G = recip ? mt.Gs : mt.G, out = [];
  const vals = [-1, 0, 1];
  for (let n = 0; n < 19683; n++){
    const R = []; let m = n; for (let i = 0; i < 9; i++){ R.push(vals[m % 3]); m = Math.floor(m/3); }
    const det = R[0]*(R[4]*R[8] - R[5]*R[7]) - R[1]*(R[3]*R[8] - R[5]*R[6]) + R[2]*(R[3]*R[7] - R[4]*R[6]);
    if (Math.abs(det) !== 1) continue;
    let ok = true;
    for (let i = 0; i < 3 && ok; i++) for (let j = 0; j < 3 && ok; j++){
      let s = 0; for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) s += R[3*a + i]*G[3*a + b]*R[3*b + j];
      if (Math.abs(s - G[3*i + j]) > 1e-6*Math.sqrt(G[4*i]*G[4*j])) ok = false;
    }
    if (ok) out.push(R);
  }
  return out;
}

const out = [];
for (const P of PHASES){
  const text = fs.readFileSync(path.join(HERE, 'cif', P.id + '.cif'), 'utf8');
  const prep = prepPhase(text, P.id + '.cif');
  const r = { id: P.id, laue: P.laue, sg: prep.sg, system: prep.system, constraint: prep.constraint && prep.constraint.kind, basis: prep.constraint && prep.constraint.basis || null,
    order: prep.order, orderWant: ORDER[P.laue], cell: prep.cell, V: +metric(prep.cell).V.toFixed(2), formula: prep.formula, sites: prep.sites, notes: prep.notes, warnings: prep.warnings,
    minDist: +minDist(prep).toFixed(3), holohedry: HOLO[P.laue] };
  // the Laue group and the members, as the free shape sets them up
  const x = Array.from({ length: Math.round((HI - LO)/STEP) + 1 }, (_, i)=> +(LO + i*STEP).toFixed(4));
  const m = buildModel({ x, y: x.map(()=> 1), instr: INSTR, phases: [phaseOf(prep, { shape: 'box' })] });
  const q = m.phases[0];
  r.laueOrder = q.laue.length;
  r.holoOrder = holohedry(prep.cell).length;
  let badMembers = 0; for (let i = 0; i < q.nRefl; i++) if (q.mv[i].length/3 !== q.mult[i]/2) badMembers++;
  r.badMembers = badMembers;
  r.modelRefl = q.nRefl; r.modelMembers = q.mv.reduce((t, a)=> t + a.length/3, 0);
  // in 10–130° (Kα1)
  const list = reflections(prep.cell, prep.ops, dMin).filter(x=> x.d <= dMax);
  r.refl = list.length; r.members = list.reduce((t, x)=> t + x.mult/2, 0); r.multMax = Math.max(...list.map(x=> x.mult));
  r.multHist = Object.fromEntries([...new Set(list.map(x=> x.mult))].sort((a, b)=> a - b).map(k=> [k, list.filter(x=> x.mult === k).length]));
  // closest pair in 2θ: exact coincidences (|Δd/d| < 1e-9) are the holohedry's
  const s = list.map(x=> ({ t: tt(x.d), hkl: [x.h, x.k, x.l] })).sort((a, b)=> a.t - b.t);
  const Hs = holohedry(prep.cell, true), img = (M, h) => [0, 1, 2].map(i=> M[3*i]*h[0] + M[3*i + 1]*h[1] + M[3*i + 2]*h[2]);
  const holoPair = (a, b) => Hs.some(M=> { const t = img(M, a); return t.every((x, i)=> x === b[i]) || t.every((x, i)=> x === -b[i]); });
  let exact = 0, exactInt = [], near = { dt: Infinity }, n001 = 0;
  for (let i = 1; i < s.length; i++){
    const dt = s[i].t - s[i - 1].t;
    if (dt < 1e-7) { if (holoPair(s[i - 1].hkl, s[i].hkl)) exact++; else exactInt.push([s[i - 1].hkl, s[i].hkl]); continue; }
    if (dt < 0.01) n001++;
    if (dt < near.dt) near = { dt: +dt.toFixed(4), at: +s[i].t.toFixed(2), a: s[i - 1].hkl, b: s[i].hkl };
  }
  r.exactPairs = exact; r.exactOther = exactInt; r.closest = near; r.pairsUnder001 = n001;
  r.firstLine = +s[0].t.toFixed(2);
  // members up to 100, 110, 120° (what a narrower range would save)
  r.membersTo = Object.fromEntries([100, 110, 120, 130].map(h=> [h, list.filter(x=> tt(x.d) <= h).reduce((t, x)=> t + x.mult/2, 0)]));
  // frames on the lattice (the search's own candidates)
  r.axes = lowIndexAxes(q).map(e=> {
    const L = lattDirection(q, e);
    const across = latticeAcross(q, e, null, 0.01, 64).slice(0, 3);
    return { uvw: L.tc, label: L.label, vec: e.map(t=> +t.toFixed(6)), across: across.map(a=> ({ uvw: a.uvw, vec: a.vec.map(t=> +t.toFixed(6)) })) };
  });
  // the isotropic fit
  if (!noFit){
    const truth = phaseOf(prep, { shape: false });
    const m0 = buildModel({ x, y: x.map(()=> 1), instr: INSTR, phases: [truth] });
    const lat = {}; for (const p of m0.par) if (/^p1\.(a|b|c)$/.test(p.name)) lat[p.name] = m0.v[m0.index[p.name]]*1.002;
    const D = 10, Ys = 0.9*INSTR.lam1/(D*10)*R2D, Xs = 0.001*4*R2D;    // 10 nm; ε 0.1 %: X_s = 4ε (rad → °)
    const PT = { U: IRF.U, V: IRF.V, W: IRF.W, X: IRF.X, Y: IRF.Y, axL: IRF.axL, transp: IRF.transp, zero: IRF.zero, disp: 0.01,
      'p1.B': 0.3, 'p1.Ys': Ys, 'p1.Xs': Xs, bg0: 150, bg1: -20, bg2: 5, bgInv: 300, ...lat };
    setParams(m0, vecWith(m0, { ...PT, 'p1.scale': 1 }));
    const net = calc(m0, null, { internal: true }).perPhase[0], S = 3000/Math.max(...net);
    setParams(m0, vecWith(m0, { ...PT, 'p1.scale': S }));
    const yc = calc(m0, null, { internal: true }).yc, U = rng(0x5eed + PHASES.indexOf(P));
    const y = Array.from(yc, l=> poisson(l, U));
    const mf = buildModel({ x, y, instr: INSTR, phases: [phaseOf(prep, { shape: false })] });
    const e0 = FS.evals, t0 = Date.now();
    const res = autoRefine(mf, { standard: false, irf: IRF });
    const p = res.params, evals = FS.evals - e0, ms = Date.now() - t0;
    const Dfit = 0.9*INSTR.lam1/(((p.Y + p['p1.Ys']) - IRF.Y)*D2R)/10;
    r.fit = { chi2nu: +res.stats.chi2.toFixed(4), Rwp: +res.stats.Rwp.toFixed(4), evals, ms, msPerEval: +(ms/evals).toFixed(2),
      cellErr: Object.keys(lat).map(k=> +(p[k]/lat[k] - 1).toExponential(2)), D: +Dfit.toFixed(2), Dtrue: D,
      eps: +(((p.X + p['p1.Xs']) - IRF.X)*D2R/4*100).toFixed(4), epsTrue: 0.1, B: +p['p1.B'].toFixed(3), Btrue: 0.3, warnings: res.warnings || [] };
  }
  out.push(r);
  console.log(`${P.id.padEnd(6)} ${String(P.laue).padEnd(5)} sg ${r.sg} ${r.system}/${r.constraint} ops ${r.order}/${r.orderWant} laue ${r.laueOrder} holo ${r.holoOrder} V ${r.V} dmin ${r.minDist} Å | ${r.refl} refl ${r.members} members (to 100/110/120°: ${[100, 110, 120].map(h=> r.membersTo[h]).join('/')}; model ${r.modelRefl}/${r.modelMembers}) badMembers ${r.badMembers} exact ${r.exactPairs} other-exact ${r.exactOther.map(p=> p.map(h=> h.join('')).join('/')).join(' ')} closest ${r.closest.dt}° at ${r.closest.at} (<0.01°: ${r.pairsUnder001}) | first ${r.firstLine}°`
    + (r.fit ? ` | fit χ²_ν ${r.fit.chi2nu} ${r.fit.evals} ev ${r.fit.ms} ms (${r.fit.msPerEval} ms/ev) cell ${r.fit.cellErr.join(',')} D ${r.fit.D} ε ${r.fit.eps}% B ${r.fit.B}` : '')
    + (r.notes.length ? ' | notes: ' + r.notes.join('; ') : '') + (r.warnings.length ? ' | WARN: ' + r.warnings.join('; ') : ''));
}
if (!noFit) fs.writeFileSync(path.join(HERE, 'phases.json'), JSON.stringify(out, null, 1));
else fs.writeFileSync(path.join(HERE, 'phases-nofit.json'), JSON.stringify(out, null, 1));
