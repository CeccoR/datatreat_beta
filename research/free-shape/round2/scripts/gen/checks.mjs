/* The generator's checks (README.md "Checks"): node checks.mjs [--only name,name] → results/checks.json
   1 lv       2∫A dL against the engine's ⟨L⟩_V (shapeWidths) at 50 random directions per solid,
              and a size distribution's ⟨L⟩_V against the dims' (σ 0.5)
   2 mc       A(L) against a Monte Carlo common volume (kernels.mcCommon), 3 directions × 3 L
              per solid; a size distribution's table against a Monte Carlo average over s
   3 limit    the Lorentzian-limit identity: kernel 'lorentz' against the engine's calc, every
              solid, a cubic and the triclinic cell
   4 plumb    the subtracted term (rest ⊗ the engine's Lorentzian, synthesised in d*) against
              the engine's own lines: the real instrument, and a Lorentzian one (U = V = W = 0)
   5 breadth  the integral breadth of a drawn size line against 1/⟨L⟩_V, one member per solid
   6 errors   each model error on one drawn pattern against its spec
   7 time     drawing time per pattern, one row per Laue class; the exact lines' least value */
import fs from 'node:fs';
import path from 'node:path';
import { ENG } from './eng/xrd-rietveld.js';
import { wppmLine } from './eng/xrd-broad.js';
import { body, kernel, along, mcCommon, BASE } from './kernels.mjs';
import { drawRow, standardIrf, rng, phaseFrame, INSTR, HERE } from './gen.mjs';

const { BODIES, shapeWidths, quatOfMat, K_SCHERRER, D2R, R2D } = ENG;
const PH = path.join(HERE, '..', 'phases', 'cif');
const LAUE = ['P-1', 'P2m', 'Pmmm', 'P4m', 'P4mmm', 'P-3', 'P-3m1', 'P6m', 'P6mmm', 'Pm-3', 'Pm-3m'];
const SOLIDS = ['box', 'sqbox', 'cylinder', 'ellcyl', 'ellipsoid', 'spheroid', 'sphere'];
const args = process.argv.slice(2), onlyArg = args.includes('--only') ? args[args.indexOf('--only') + 1].split(',') : null;
const want = k => !onlyArg || onlyArg.includes(k);
const out = fs.existsSync(path.join(HERE, 'results', 'checks.json')) ? JSON.parse(fs.readFileSync(path.join(HERE, 'results', 'checks.json'), 'utf8')) : {};
const save = () => { fs.mkdirSync(path.join(HERE, 'results'), { recursive: true }); fs.writeFileSync(path.join(HERE, 'results', 'checks.json'), JSON.stringify(out, null, 1)); };
const LAM1 = INSTR.lam1, r = rng(20261026);
const unit = v => { const n = Math.hypot(...v); return v.map(t=> t/n); };
const randDir = () => unit([r.n(), r.n(), r.n()]);
// a random rotation (row-major; columns the body axes) from a random unit quaternion
const randR = () => ENG.quatMat(unit([r.n(), r.n(), r.n(), r.n()]));
// random dims (nm) in the design's ranges: smallest 2–15, ratios 1–6 (two-extent 1/6–6)
function randDims(type){
  const lu = (a, b)=> Math.exp(Math.log(a) + (Math.log(b) - Math.log(a))*r.u());
  if (type === 'sphere'){ const D = lu(2, 30); return [D, D, D]; }
  const s = lu(2, 15);
  if (['sqbox', 'cylinder', 'spheroid'].includes(type)){ const q = lu(1/6, 6); return q >= 1 ? [s, s, s*q] : [s/q, s/q, s]; }
  const a = s, b = a*lu(1, 6), c = b*lu(1, 6), d = [a, b, c].map(t=> Math.min(t, 60));
  for (let i = 2; i > 0; i--){ const j = Math.floor(r.u()*(i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
  return d;
}
const fmt = x => Number.isFinite(x) ? +x.toPrecision(3) : x;

/* 1. ⟨L⟩_V */
if (want('lv')){
  const res = {};
  for (const type of SOLIDS){
    const dims = randDims(type), R = randR(), b = body(type, dims.map(d=> 10*d), R);
    const dirs = Array.from({ length: 50 }, randDir);
    let lvEng;
    if (type === 'sphere') lvEng = dirs.map(()=> 0.75*K_SCHERRER*LAM1*R2D/(K_SCHERRER*LAM1/(dims[0]*10)*R2D));
    else {
      // the engine's own path: W from the dims, the quaternion from R, shapeWidths on members
      const B = BODIES[type], w = dims.map(d=> K_SCHERRER*LAM1/(d*10)*R2D), W = B.W.length === 2 ? [w[0], w[2]] : w;
      const nW = W.length, Q = quatOfMat(b.R), v = [...W, ...Array(B.rot).fill(0), ...Q];
      const q = { shapeType: type, iW: W.map((_, i)=> i), iR: Array.from({ length: B.rot }, (_, i)=> nW + i), iQ: [0, 1, 2, 3].map(i=> nW + B.rot + i), mv: [Float64Array.from(dirs.flat())] };
      lvEng = Array.from(shapeWidths({ shapeSoft: null }, q, v)[0], wi=> 0.75*K_SCHERRER*LAM1*R2D/wi);
    }
    let e = 0; dirs.forEach((n, i)=> { e = Math.max(e, Math.abs(kernel(b, n).Lv/lvEng[i] - 1)); });
    // a size distribution keeps ⟨L⟩_V (σ 0.5)
    const bm = body(type, dims.map(d=> 10*d), R, 0.5);
    let em = 0; dirs.slice(0, 10).forEach(n=> { em = Math.max(em, Math.abs(kernel(bm, n).Lv/kernel(b, n).Lv - 1)); });
    res[type] = { dims: dims.map(fmt), maxRel: fmt(e), sigma05MaxRel: fmt(em), Lv: [Math.min(...lvEng), Math.max(...lvEng)].map(t=> fmt(t/10)) };
    console.log('lv', type, JSON.stringify(res[type]));
  }
  out.lv = res; save();
}

/* 2. Monte Carlo */
if (want('mc')){
  const res = {}, N = 400000;
  for (const type of SOLIDS){
    const dims = randDims(type), R = randR(), b = body(type, dims.map(d=> 10*d), R);
    let zMax = 0, dMax = 0; const rows = [];
    for (let k = 0; k < 3; k++){
      const n = randDir(), a = along(b, n);
      for (const f of [0.15, 0.4, 0.7]){
        const L = f*a.T, mc = mcCommon(type, b.D, a.m, L, N, r.u), A = a.A(L), z = (A - mc.A)/mc.se;
        zMax = Math.max(zMax, Math.abs(z)); dMax = Math.max(dMax, Math.abs(A - mc.A)); rows.push([f, fmt(A), fmt(mc.A), fmt(z)]);
      }
    }
    // a size distribution: the table against a Monte Carlo average over s (volume-weighted)
    const sig = 0.4, bm = body(type, b.D, b.R, sig), n = randDir(), a = along(b, n), K = kernel(bm, n);
    const ss = Array.from({ length: 200000 }, ()=> Math.exp(-0.5*sig*sig + sig*r.n()));
    let dm = 0; for (const f of [0.1, 0.3, 0.6, 1.0, 1.5]){ const L = f*a.T; let t = 0; for (const s of ss) t += a.A(L/s); dm = Math.max(dm, Math.abs(K.A(L) - t/ss.length)); }
    res[type] = { dims: dims.map(fmt), N, maxZ: fmt(zMax), maxAbs: fmt(dMax), rows, sigma04MaxAbs: fmt(dm) };
    console.log('mc', type, 'max|z|', fmt(zMax), 'max|ΔA|', fmt(dMax), 'σ 0.4 table vs MC', fmt(dm));
  }
  out.mc = res; save();
}

/* a row of the design's form */
const rowOf = (type, cif, o = {}) => ({ id: 'chk-' + type + '-' + cif, solid: type, dims: o.dims || randDims(type), R: o.R || randR(), phase: path.join(PH, cif + '.cif'), counts: 10000, pb: 5, strain: 0.1, error: o.error || null, seed: 1 });
const maxRelDiff = (a, Sa, b, Sb) => { let d = 0, m = 0; for (let i = 0; i < a.length; i++){ m = Math.max(m, a[i]/Sa); d = Math.max(d, Math.abs(a[i]/Sa - b[i]/Sb)); } return d/m; };

/* 3. the Lorentzian limit */
if (want('limit')){
  const irf = standardIrf(), res = {};
  for (const cif of ['Pm-3m', 'P-1']) for (const type of SOLIDS){
    const row = rowOf(type, cif), e = drawRow(row, { kernel: 'none', noise: false, irf }), l = drawRow(row, { kernel: 'lorentz', noise: false, irf }), x = drawRow(row, { kernel: 'exact', noise: false, irf });
    res[cif + ' ' + type] = { dims: row.dims.map(fmt), lorentz: fmt(maxRelDiff(e.parts.phase, e.info.S, l.parts.phase, l.info.S)), exact: fmt(maxRelDiff(e.parts.phase, e.info.S, x.parts.phase, x.info.S)) };
    console.log('limit', cif, type, JSON.stringify(res[cif + ' ' + type]));
  }
  out.limit = res; save();
}

/* 4. plumbing: the subtracted term against the engine's lines */
if (want('plumb')){
  const irf = standardIrf(), res = {};
  const R = randR();
  for (const [lab, I] of [['instrument', irf], ['lorentzian instrument', { ...irf, U: 0, V: 0, W: 0 }]]) for (const dims of [[10, 15, 25], [3, 4, 6]]) for (const cif of ['Pm-3m', 'P-1']){
    const row = rowOf('box', cif, { dims, R }), p = drawRow(row, { kernel: 'exact', noise: false, irf: I, sub: true });
    // with sub the hook draws only the subtracted term into parts.sub; parts.phase is the engine's alone
    const k = `${lab} box ${dims.join('x')} ${cif}`;
    res[k] = fmt(maxRelDiff(p.parts.phase, 1, p.parts.sub, 1));
    console.log('plumb', k, res[k]);
  }
  out.plumb = res; save();
}

/* 5. integral breadth of a drawn size line */
if (want('breadth')){
  const res = {};
  for (const type of SOLIDS){
    const dims = randDims(type), b = body(type, dims.map(d=> 10*d), randR()), n = randDir(), K = kernel(b, n);
    const tt = 60, th = tt/2*D2R, c1 = Math.cos(th)*D2R/LAM1, G = 0.675/K.Lv/c1;   // the Lorentzian's FWHM in 2θ (°)
    const half = Math.min(55, 400*G), step = Math.min(G/40, 0.01), x = Float64Array.from({ length: Math.round(2*half/step) + 1 }, (_, i)=> tt - half + i*step);
    const y = new Float64Array(x.length);
    wppmLine({ x, out: y, tt, lam: LAM1, I: 1, Hi: 1e-6, etai: 1, WL: 0, nodes: null, win: 40, winMin: half, Hest: G, Hmin: G/2,
      size: (a, m, dL)=> { for (let i = 0; i < m; i++) a[i] += K.A(i*dL); } });
    let area = 0, pk = 0; for (let i = 0; i < x.length; i++){ area += y[i]*step; pk = Math.max(pk, y[i]); }
    // in d*: the peak over the area (I = 1 is the untruncated line's area)
    const bPeak = 1/(pk/c1), bArea = area/(pk/c1);
    res[type] = { dims: dims.map(fmt), Lv_nm: fmt(K.Lv/10), betaPeak_x_Lv: fmt(bPeak*K.Lv), betaWindow_x_Lv: fmt(bArea*K.Lv), areaInWindow: fmt(area), windowDeg: fmt(half) };
    console.log('breadth', type, JSON.stringify(res[type]));
  }
  out.breadth = res; save();
}

/* 6. the model errors on one drawn pattern each */
if (want('errors')){
  const irf = standardIrf(), res = {}, s = 0.5, cif = 'Pm-3m', dims = [5, 9, 16], R = randR();
  const base = drawRow(rowOf('box', cif, { dims, R }), { noise: false, irf }), x = base.x, step = x[1] - x[0];
  const measure = {
    hump: p => { const e = p.parts.error; let a = 0, m = 0, im = 0; e.forEach((v, i)=> { a += v*step; if (v > m){ m = v; im = i; } });
      let lo = im, hi = im; while (lo > 0 && e[lo] > m/2) lo--; while (hi < e.length - 1 && e[hi] > m/2) hi++;
      return { specFrac: p.truth.error.frac, frac: a/p.info.strongest.area, inRange: p.truth.error.inRange, specFwhm: p.truth.error.fwhm, fwhm: x[hi] - x[lo], centre: p.truth.error.centre, at: x[im] }; },
    // the error's whole area over the grid against the lines' stated shares, and each line's
    // share of its whole profile within the range
    impurity: p => { let a = 0; p.parts.error.forEach(v=> { a += v*step; }); const spec = p.truth.error.lines.reduce((t, ln)=> t + ln.frac, 0);
      return { specFrac: spec, frac: a/p.info.strongest.area, lines: p.truth.error.lines.map(ln=> ({ pos: ln.pos, specFrac: ln.frac, inRange: ln.inRange })) }; },
    air: p => ({ specK: p.truth.error.k, k: p.parts.error[0]/p.parts.bg[0], tau: p.truth.error.tau }),
    sizedist: p => {
      // the strongest line's integral breadth and FWHM against the same truth without the distribution
      const line = q => { const ph = q.parts.phase, t = q.info.strongest.tt; let a = 0, m = 0, im = 0; ph.forEach((v, i)=> { if (Math.abs(x[i] - t) < 3){ a += v*step; if (v > m){ m = v; im = i; } } });
        let lo = im, hi = im; while (ph[lo] > m/2) lo--; while (ph[hi] > m/2) hi++; return { beta: a/m, fwhm: x[hi] - x[lo] }; };
      const a = line(p), b0 = line(base);
      return { sigma: p.truth.error.sigma, betaRatio: a.beta/b0.beta, fwhmRatio: a.fwhm/b0.fwhm };
    },
    po: p => {
      // the reflections' intensities with and without, against March–Dollase averaged over
      // each reflection's members (computed here from the phase's frame, not the engine's)
      const fr = phaseFrame(p.truth.row.phase), Bm = fr.Bm, ax = p.truth.error.axis, rr = p.truth.error.r;
      const cart = h => unit([Bm[0]*h[0] + Bm[1]*h[1] + Bm[2]*h[2], Bm[4]*h[1] + Bm[5]*h[2], Bm[8]*h[2]]);
      const a = cart(ax), ops = fr.laue;
      const t0 = drawRow({ ...p.truth.row, error: null }, { noise: false, irf, ticks: true });
      let worst = 0, lo = Infinity, hi = 0;
      for (const tk of p.info.ticks){
        const t1 = t0.info.ticks.find(t=> t.r === tk.r); if (!t1) continue;
        const seen = new Set(); let sum = 0, m = 0;
        for (const M of ops){ const h = [0, 1, 2].map(j=> tk.h*M[j] + tk.k*M[3 + j] + tk.l*M[6 + j]); if (seen.has(h.join()) || seen.has(h.map(t=> -t).join())) continue; seen.add(h.join());
          const c = cart(h).reduce((s, t, j)=> s + t*a[j], 0); sum += Math.pow(rr*rr*c*c + (1 - c*c)/rr, -1.5); m++; }
        const md = sum/m, got = tk.I/t1.I;   // (ticks at scale 1)
        worst = Math.max(worst, Math.abs(got/md - 1)); lo = Math.min(lo, got); hi = Math.max(hi, got);
      }
      return { r: rr, axis: ax, families: p.truth.error.families, maxRelVsMD: worst, ratioRange: [lo, hi] };
    },
  };
  for (const kind of ['hump', 'sizedist', 'impurity', 'air', 'po']){
    const p = drawRow(rowOf('box', cif, { dims, R, error: { kind, strength: s } }), { noise: false, irf, ticks: kind === 'po' });
    res[kind] = JSON.parse(JSON.stringify(measure[kind](p), (k, v)=> typeof v === 'number' ? fmt(v) : v));
    console.log('errors', kind, JSON.stringify(res[kind]));
  }
  out.errors = res; save();
}

/* 7. time per pattern, one row per Laue class (a box at random, exact lines, noise) */
if (want('time')){
  const irf = standardIrf(), res = {};
  for (const cif of LAUE){
    const row = rowOf('box', cif), p = drawRow(row, { irf }), q = drawRow({ ...row, error: { kind: 'sizedist', strength: 1 } }, { irf });
    let mn = Infinity, mx = 0; p.parts.phase.forEach(v=> { mn = Math.min(mn, v); mx = Math.max(mx, v); });
    res[cif] = { ms: Math.round(p.info.ms), msSizedist: Math.round(q.info.ms), nRefl: p.info.nRefl, members: p.info.nMembers, minOverPeak: fmt(mn/mx) };
    console.log('time', cif, JSON.stringify(res[cif]));
  }
  out.time = res; save();
}
