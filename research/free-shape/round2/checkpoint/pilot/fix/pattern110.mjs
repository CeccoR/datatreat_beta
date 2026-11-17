/* The verifier's check (verify-gen/pattern.mjs), copied for the pilot's fix: the grid 10–110°
   and the scaled cells. The generator's corrections (the engine's WPPM window, lowered at
   its edge) and the same with the window over the whole pattern (drawRow whole: true), both
   against the same direct synthesis (each line over ±max(6°, 80 FWHM), not lowered; the
   whole pattern for the 3 nm sphere). Writes pattern110.json.
   The verifier's header follows.
   Skeptic's check of the generator's patterns (drawRow), with my own code:
   A. In-model limit: drawRow(kernel 'none' and 'lorentz') against the FROZEN engine
      (fs2/engine, b9bef5f) with the truth's parameters set by me from the row (W = Kλ1/D,
      Q of R, Xs = 4ε·180/π, the standard's profile), lines over the whole pattern.
   B. The correction (exact − none) against my own direct synthesis of every line:
        I·J(2θ)·2∫₀^∞ F_rest(L)·[A(L) − e^{−πΓL}]·Σ_k w_k cos 2πL(δ − δ_k) dL,
      trapezoid in L on a fine grid (no FFT, no window, no edge lowering), my A(L) (or
      my volume-weighted log-normal), Γ = 0.675/⟨L⟩_V from my ⟨L⟩_V, F_rest the TCH
      pseudo-Voigt of instrument + microstrain at that line's θ (profileAtTheta with my
      parameters), δ = 2(sin θ − sin θ₀)/λ_line, J = cos θ·(π/180)/λ_line. Each line's
      position, intensity, λ and axial nodes are the engine's, read by a recording hook.
   C. My pV_rest ⊗ Lorentzian(Γ) against the engine's TCH line: the TCH error, for scale.
   D. Area: Σ exact = Σ none (the correction's area 0). */
import fs from 'node:fs';
import path from 'node:path';
const FS2 = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const FROZEN = await import(FS2 + '/engine/xrd-rietveld.js');
const GENG = await import(FS2 + '/gen/eng/xrd-rietveld.js');
const { prepPhase } = await import(FS2 + '/engine/xrd-rv-model.js');
const { drawRow } = await import(FS2 + '/gen/gen.mjs');
// residual (gen − mine) after removing its least-squares fit on [1, u, u², 1/2θ] (the background's family)
function detrend(x, r){
  const n = x.length, f = t => { const u = 2*(t - x[0])/(x[n - 1] - x[0]) - 1; return [1, u, 2*u*u - 1, 1/t]; };
  const M = Array.from({ length: 4 }, ()=> new Float64Array(5));
  for (let i = 0; i < n; i++){ const b = f(x[i]); for (let a = 0; a < 4; a++){ for (let c = 0; c < 4; c++) M[a][c] += b[a]*b[c]; M[a][4] += b[a]*r[i]; } }
  for (let c = 0; c < 4; c++){ let p = c; for (let a = c + 1; a < 4; a++) if (Math.abs(M[a][c]) > Math.abs(M[p][c])) p = a; [M[c], M[p]] = [M[p], M[c]];
    for (let a = 0; a < 4; a++) if (a !== c){ const k = M[a][c]/M[c][c]; for (let j = c; j < 5; j++) M[a][j] -= k*M[c][j]; } }
  const s = M.map((row, i)=> row[4]/row[i]);
  return Float64Array.from(x, (t, i)=> { const b = f(t); return r[i] - (s[0]*b[0] + s[1]*b[1] + s[2]*b[2] + s[3]*b[3]); });
}

const { ENG } = GENG;
const D2R = Math.PI/180, R2D = 180/Math.PI, K = 0.9, LAM1 = 1.540598;
const INSTR = { lam1: 1.540598, lam2: 1.544426, ratio: 0.5, radius: 240, soller: { incident: 0.02, diffracted: 0.02 }, focusLength: 12, monochromator: false };
const irf = JSON.parse(fs.readFileSync(FS2 + '/gen/data/irf.json', 'utf8'));
const GRID = { lo: 10, hi: 110, step: 0.01 };
const X = Array.from({ length: Math.round((GRID.hi - GRID.lo)/GRID.step) + 1 }, (_, i)=> +(GRID.lo + i*GRID.step).toFixed(6));

// ---------- my A(L) (as kern.mjs) ----------
const BASE = { box: 'cube', sqbox: 'cube', ellipsoid: 'ball', spheroid: 'ball', sphere: 'ball', cylinder: 'cyl', ellcyl: 'cyl' };
const mulT = (R, n) => [0, 1, 2].map(j=> R[j]*n[0] + R[3 + j]*n[1] + R[6 + j]*n[2]);
const unit = v => { const s = Math.hypot(...v); return v.map(x=> x/s); };
function myA(type, D, R, n){
  const m = mulT(R, unit(n)), b = BASE[type];
  if (b === 'cube'){ const k = m.map((x, i)=> Math.abs(x)/D[i]), T = 1/Math.max(...k); return { T, A: L => L >= T ? 0 : (1 - L*k[0])*(1 - L*k[1])*(1 - L*k[2]) }; }
  if (b === 'ball'){ const g = Math.hypot(m[0]/D[0], m[1]/D[1], m[2]/D[2]), T = 1/g; return { T, A: L => { const x = L*g; return x >= 1 ? 0 : 1 - 1.5*x + 0.5*x**3; } }; }
  const c = Math.abs(m[2])/D[2], s = Math.hypot(m[0]/D[0], m[1]/D[1]), T = 1/Math.max(c, s);
  return { T, A: L => { const z = 1 - L*c, d = L*s; if (z <= 0 || d >= 1) return 0; return z*(2/Math.PI)*(Math.acos(d) - d*Math.sqrt(1 - d*d)); } };
}
function mixOf(a1, sigma){
  if (!sigma) return { A: a1.A, T: a1.T };
  const muN = -3.5*sigma*sigma, M = 1200, zs = [], ws = [];
  let den = 0;
  for (let k = 0; k <= M; k++){ const z = -9 + 18*k/M, s = Math.exp(muN + sigma*z), w = Math.exp(-0.5*z*z)*s**3*(k === 0 || k === M ? 0.5 : 1); zs.push(s); ws.push(w); den += w; }
  return { T: a1.T*Math.exp(muN + 9*sigma), A: L => { if (L === 0) return 1; let t = 0; for (let k = 0; k <= M; k++) t += ws[k]*a1.A(L/zs[k]); return t/den; } };
}
const lvOf = a => { const n = 20000, h = a.T/n; let s = 0.5*(a.A(0) + a.A(a.T)); for (let i = 1; i < n; i++) s += a.A(i*h); return 2*s*h; };

// ---------- my truth parameters ----------
function rowR(row){
  if (!row.R) return [1,0,0, 0,1,0, 0,0,1];
  let R = Array.isArray(row.R[0]) ? row.R.flat() : row.R.slice();
  const det = R[0]*(R[4]*R[8] - R[5]*R[7]) - R[1]*(R[3]*R[8] - R[5]*R[6]) + R[2]*(R[3]*R[7] - R[4]*R[6]);
  if (det < 0) R = [R[0], R[1], -R[2], R[3], R[4], -R[5], R[6], R[7], -R[8]];
  return R;
}
const dims3 = row => row.solid === 'sphere' ? [row.D ?? row.dims[0], row.D ?? row.dims[0], row.D ?? row.dims[0]] : row.dims.length === 2 ? [row.dims[0], row.dims[0], row.dims[1]] : row.dims.slice();
function myParams(row, po){
  const eps = row.eps ?? 0, D = dims3(row), w = D.map(d=> K*LAM1/(10*d)*R2D);
  const P = { U: irf.U, V: irf.V, W: irf.W, X: irf.X, Y: irf.Y, axL: irf.axL, transp: irf.transp, zero: irf.zero, disp: 0, asym: 0, 'p1.B': 0, 'p1.Xs': 4*eps*R2D, 'p1.Ys': 0, 'p1.scale': 1 };
  if (row.solid === 'sphere') P['p1.Ys'] = w[0];
  else {
    const B = ENG.BODIES[row.solid], W = B.W.length === 2 ? [w[0], w[2]] : w;
    B.W.forEach((nm, i)=> { P['p1.' + nm] = W[i]; });
    ENG.quatOfMat(rowR(row)).forEach((t, i)=> { P['p1.Q' + i] = t; });
  }
  if (po) P['p1.PO'] = po.r;
  return P;
}
function myModel(E, row, po){
  const f = path.join(FS2, 'phases', 'cif', row.phase + '.cif'), prep = prepPhase(fs.readFileSync(f, 'utf8'), row.phase + '.cif');
  const ph = { id: 1, name: prep.name, cell: prep.cell, constraint: prep.constraint, ops: prep.ops, atoms: prep.atoms, mass: prep.mass, color: '#888', size: true,
    shape: row.solid === 'sphere' ? false : row.solid, profile: 'lorentz', strain: 'iso', faults: null, adp: 'overall', po: po ? po.axis : null, occ: null };
  const m = E.buildModel({ x: X, y: X.map(()=> 1), instr: INSTR, phases: [ph] });
  m.noise0 = 1e-30;
  const v = m.v.slice(), P = myParams(row, po);
  for (const k in P){ const i = m.index[k]; if (i == null) throw new Error('no ' + k); v[i] = P[k]; }
  E.setParams(m, v);
  return m;
}

// ---------- B. my direct synthesis of the correction ----------
function synth(row, recs, sigma, model){
  const D = dims3(row).map(d=> 10*d), R = rowR(row), out = new Float64Array(X.length), lor = new Float64Array(X.length);
  const kcache = new Map();
  const v = model.v, ix = n => v[model.index[n]];
  const U = ix('U'), V = ix('V'), W = ix('W'), Xp = ix('X') + ix('p1.Xs'), Y = ix('Y');
  const lineStep = GRID.step;
  for (const c of recs){
    const key = c.r + ',' + c.i;
    let k = kcache.get(key);
    if (!k){
      const n = c.i < 0 ? [0, 0, 1] : [c.mv[0], c.mv[1], c.mv[2]];
      const a1 = myA(row.solid, D, R, n), a = mixOf(a1, sigma), lv = lvOf(a1);
      k = { a, lv, gam: 0.75*K/lv };
      // tabulate A on a fine grid once (mixtures are costly)
      const nT = 4000, T = a.T, tab = new Float64Array(nT + 2);
      for (let i = 0; i <= nT + 1; i++) tab[i] = a.A(i*T/nT);
      k.Atab = L => { if (L >= T) return 0; const f = L/T*nT, j = Math.floor(f), u = f - j; return tab[j]*(1 - u) + tab[j + 1]*u; };
      if (!sigma) k.Atab = a.A;
      kcache.set(key, k);
    }
    const rest = ENG.profileAtTheta(c.th, U, V, W, Xp, Y);
    const th0 = c.tt*D2R/2, s0 = Math.sin(th0), c1 = Math.cos(th0)*D2R/c.lam, Hd = rest.H*c1, eta = rest.eta;
    const gq = (Math.PI*Hd)**2/(4*Math.LN2), pg = Math.PI*k.gam;
    const nodes = c.nodes && c.nodes.length ? c.nodes.map(nd=> ({ d: nd.d*c1, w: nd.w })) : [{ d: 0, w: 1 }];
    // window: whole pattern for broad lines, else ±max(6°, 80 FWHM)
    const Htot = ENG.tch(rest.HG, rest.HL + k.gam/c1).H;
    const half = Math.max(6, 80*Htot);
    const i0 = Math.max(0, Math.floor((c.tt - half - GRID.lo)/lineStep)), i1 = Math.min(X.length - 1, Math.ceil((c.tt + half - GRID.lo)/lineStep));
    if (i1 < i0) continue;
    let dmax = 0;
    for (let i = i0; i <= i1; i += Math.max(1, i1 - i0)){ const dl = 2*(Math.sin(X[i]*D2R/2) - s0)/c.lam; for (const nd of nodes) dmax = Math.max(dmax, Math.abs(dl - nd.d)); }
    // L grid: up to where F_rest·max(A, e^{−πΓL}) < 1e-11, step ≤ 1/(12 δmax) and ≤ T/400
    let Lmax = 0; for (let L = 0; ; L += 0.5/ (pg + 1e-9) / 50){ const F = eta*Math.exp(-Math.PI*Hd*L) + (1 - eta)*Math.exp(-gq*L*L); if (F*Math.max(k.Atab(L), Math.exp(-pg*L)) < 1e-11){ Lmax = L; break; } }
    const dL = Math.min(1/(12*dmax), k.a.T/400, Lmax/200), nL = Math.ceil(Lmax/dL);
    // G(L)·Σ_k w_k e^{−2πiLδ_k} (complex), trapezoid weights; the profile at δ is
    // Re Σ_j G_j e^{+2πiL_jδ}
    const Gr = new Float64Array(nL + 1), Gi = new Float64Array(nL + 1), Lr = new Float64Array(nL + 1), Li = new Float64Array(nL + 1);
    for (let j = 0; j <= nL; j++){
      const L = j*dL, F = eta*Math.exp(-Math.PI*Hd*L) + (1 - eta)*Math.exp(-gq*L*L), wt = (j === 0 || j === nL ? 0.5 : 1)*dL;
      let cr = 0, ci = 0; for (const nd of nodes){ const a = -2*Math.PI*L*nd.d; cr += nd.w*Math.cos(a); ci += nd.w*Math.sin(a); }
      const g = 2*F*(k.Atab(L) - Math.exp(-pg*L))*wt, gl = 2*F*Math.exp(-pg*L)*wt;
      Gr[j] = g*cr; Gi[j] = g*ci; Lr[j] = gl*cr; Li[j] = gl*ci;
    }
    for (let i = i0; i <= i1; i++){
      const th = X[i]*D2R/2, dl = 2*(Math.sin(th) - s0)/c.lam, J = Math.cos(th)*D2R/c.lam;
      const a = 2*Math.PI*dl*dL, ca = Math.cos(a), sa = Math.sin(a);
      let cr = 1, ci = 0, t = 0, tl = 0;
      for (let j = 0; j <= nL; j++){
        t += Gr[j]*cr - Gi[j]*ci; tl += Lr[j]*cr - Li[j]*ci;
        const r2 = cr*ca - ci*sa; ci = cr*sa + ci*ca; cr = r2;
      }
      out[i] += c.I*J*t; lor[i] += c.I*J*tl;
    }
  }
  return { corr: out, lor };
}

function record(row, po){
  const m = myModel(GENG, row, po), recs = [];
  m.sizeHook = (o, c)=> { recs.push({ r: c.r, i: c.i, j: c.j, th: c.th, tt: c.tt, I: c.I, lam: c.lam, nodes: c.nodes ? c.nodes.map(n=> ({ d: n.d, w: n.w })) : null, mv: c.i >= 0 ? Array.from(c.q.mv[c.r].slice(3*c.i, 3*c.i + 3)) : null }); };
  const cc = GENG.calc(m, null, { internal: true });
  return { m, recs, phase: cc.perPhase[0] };
}

const CASES = [
  { id: 'v-sphere3', phase: 'Pm-3m', solid: 'sphere', D: 3, dims: [3], counts: 10000, pb: 10, eps: 0.001, error: null, seed: 11 },
  { id: 'v-sphere30', phase: 'Pm-3m', solid: 'sphere', D: 30, dims: [30], counts: 10000, pb: 10, eps: 0.0005, error: null, seed: 12 },
  { id: 'v-sphere30-ln05', phase: 'Pm-3m', solid: 'sphere', D: 30, dims: [30], counts: 10000, pb: 10, eps: 0, error: { kind: 'sizedist', strength: 1 }, seed: 13 },
  { id: 'v-box-gen', phase: 'Pm-3m', solid: 'box', dims: [20, 35, 60], counts: 10000, pb: 10, eps: 0.001, error: null, seed: 14, R: null },
  { id: 'v-ellcyl-gen', phase: 'P-3m1', solid: 'ellcyl', dims: [3, 6, 12], counts: 10000, pb: 10, eps: 0.002, error: null, seed: 15, R: null },
  { id: 'v-box-ln', phase: 'P4mmm', solid: 'box', dims: [8, 15, 40], counts: 10000, pb: 10, eps: 0.001, error: { kind: 'sizedist', strength: 1 }, seed: 16, R: null },
];
// generic rotations
const rot = (ax, t) => { const [x, y, z] = unit(ax), c = Math.cos(t), s = Math.sin(t), C = 1 - c; return [c + x*x*C, x*y*C - z*s, x*z*C + y*s, y*x*C + z*s, c + y*y*C, y*z*C - x*s, z*x*C - y*s, z*y*C + x*s, c + z*z*C]; };
CASES[3].R = rot([0.3, -0.5, 0.81], 0.7); CASES[4].R = rot([-0.6, 0.2, 0.77], 1.1); CASES[5].R = rot([0.2, 0.9, -0.4], 0.45);
export { myModel, record, synth, dims3, rowR, myA, mixOf, lvOf, X, GRID, irf, INSTR };
const MAIN = import.meta.url === (await import('node:url')).pathToFileURL(process.argv[1]).href;
const only = process.argv[2] ? process.argv[2].split(',') : null;
const res = [];
for (const row of MAIN ? CASES.filter(r=> !only || only.includes(r.id)) : []){
  const t0 = Date.now();
  const ex = drawRow(row, { kernel: 'exact', grid: GRID, noise: false, irf }), no = drawRow(row, { kernel: 'none', grid: GRID, noise: false, irf }), lo = drawRow(row, { kernel: 'lorentz', grid: GRID, noise: false, irf });
  const S = ex.info.S, sigma = ex.truth.error && ex.truth.error.kind === 'sizedist' ? ex.truth.error.sigma : 0;
  // A. frozen engine
  const fm = myModel(FROZEN, row, null), fc = FROZEN.calc(fm, null, { internal: true }).perPhase[0];
  const peak1 = Math.max(...fc);
  let dA = 0, dL = 0; for (let i = 0; i < X.length; i++){ dA = Math.max(dA, Math.abs(no.parts.phase[i]/no.info.S - fc[i])); dL = Math.max(dL, Math.abs(lo.parts.phase[i]/lo.info.S - fc[i])); }
  // B.
  const { recs, phase } = record(row, null);
  let dRec = 0; for (let i = 0; i < X.length; i++) dRec = Math.max(dRec, Math.abs(phase[i] - fc[i]));
  const { corr, lor } = synth(row, recs, sigma, fm);
  let dC = 0, iC = 0, cMax = 0, dT = 0, aEx = 0, aNo = 0, dCore = 0;
  for (let i = 0; i < X.length; i++){
    const cg = ex.parts.phase[i]/S - no.parts.phase[i]/no.info.S, d = Math.abs(cg - corr[i]);
    if (d > dC){ dC = d; iC = i; }
    cMax = Math.max(cMax, Math.abs(cg));
    dT = Math.max(dT, Math.abs(lor[i] - fc[i]));
    aEx += ex.parts.phase[i]/S; aNo += no.parts.phase[i]/no.info.S;
  }
  if (process.env.DUMP) fs.writeFileSync("dump-"+row.id+".json", JSON.stringify({ x: X, gen: Array.from(X, (_, i)=> ex.parts.phase[i]/S - no.parts.phase[i]/no.info.S), mine: Array.from(corr), peak: peak1, recs: recs.map(c=> ({tt:c.tt, I:c.I, j:c.j})) })); // DUMP
  const ex1 = drawRow(row, { kernel: 'exact', grid: GRID, noise: false, irf, whole: true }), S1 = ex1.info.S;
  let dC1 = 0, mean0 = 0, mean1 = 0;
  for (let i = 0; i < X.length; i++){ const r0 = ex.parts.phase[i]/S - no.parts.phase[i]/no.info.S - corr[i], r1 = ex1.parts.phase[i]/S1 - no.parts.phase[i]/no.info.S - corr[i]; dC1 = Math.max(dC1, Math.abs(r1)); mean0 += r0/X.length; mean1 += r1/X.length; }
  const resid1 = detrend(X, Array.from(X, (_, i)=> ex1.parts.phase[i]/S1 - no.parts.phase[i]/no.info.S - corr[i]));
  let dD1 = 0; for (let i = 0; i < X.length; i++) dD1 = Math.max(dD1, Math.abs(resid1[i]));
  const resid = detrend(X, Array.from(X, (_, i)=> ex.parts.phase[i]/S - no.parts.phase[i]/no.info.S - corr[i]));
  let dD = 0, iD = 0; for (let i = 0; i < X.length; i++) if (Math.abs(resid[i]) > dD){ dD = Math.abs(resid[i]); iD = i; }
  const r = { id: row.id, wholeWindow: { corrVsMine: dC1/peak1, corrVsMineDetrended: dD1/peak1, meanOffset: mean1/peak1 }, meanOffset: mean0/peak1, corrVsMineDetrended: dD/peak1, at2tD: X[iD], sigma, lines: recs.length, peak: peak1, frozenVsNone: dA/peak1, frozenVsLorentzKernel: dL/peak1, recordModelVsFrozen: dRec/peak1,
    corrMaxRel: cMax/peak1, corrVsMine: dC/peak1, at2t: X[iC], tchErr: dT/peak1, areaRatio: aEx/aNo, s: (Date.now() - t0)/1000 };
  res.push(r);
  console.log(JSON.stringify(r));
}
if (MAIN) fs.writeFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), 'pattern110.json'), JSON.stringify(res, null, 1));
