/* =========================================================
   XRD PEAK WIDTHS — what the peaks' own widths say, before any model of the shape.
   For every reflection of a refined phase the peak is fitted alone: the pattern less
   everything else the Rietveld model puts there (the other reflections, of every
   phase, and the background) is fitted, over a window about the peak, with one
   pseudo-Voigt per line (Kα1 and Kα2, at the file's ratio, with the instrument's
   axial-divergence asymmetry) on a straight background — so a neighbour's tail does
   not widen it, and nothing else of the model enters. The fit is made in the sample's
   own widths, the instrument's (the standard's profile at that angle) convolved in as
   the engine does, and three tests read them:
   - Williamson–Hall: β·cosθ against 4·sinθ. An isotropic size gives a constant Kλ/D,
     a microstrain a slope ε: the points lie on one line. Points off it, by hkl, mean
     a broadening that depends on the direction: the crystallites' shape (or faults).
   - Orders: the same direction at two orders, (h k l) and (n·h n·k n·l). In
     Δd* = β·cosθ/λ a size broadens both alike (ratio 1), a strain in proportion to d*
     (ratio n), and planar faults by the indices' parity (one order sharp, ratio < 1).
   - Prediction: the same measurement on the model's own curve for each reflection,
     the isotropic model's and the free shape's: a model of the shape should give the
     widths it was not told.
   Pure functions on the engine's model (xrd-rietveld.js): the worker runs them after
   a refinement.
========================================================= */
import { calc, fcjNodes, addPeak, addPeakFCJ, tch, HG2_FLOOR, K_SCHERRER } from './xrd-rietveld.js';

const D2R = Math.PI/180;

function instrumentAt(irf, th){
  const t = Math.tan(th), c = Math.cos(th);
  return { HG: Math.sqrt(Math.max(HG2_FLOOR, irf.U*t*t + irf.V*t + irf.W)), HL: Math.max(0, irf.X*t + irf.Y/c) };
}

/* One peak's model on the window points xs: a pseudo-Voigt per line of the model (Kα1
   at c, Kα2 where its wavelength puts it), with the axial divergence A, its widths the
   instrument's at that angle (instAt) and the sample's on top as in the engine: the
   Lorentzian widths add, the Gaussian ones in quadrature (hl, and u = hg²), and the
   pseudo-Voigt follows by Thompson–Cox–Hastings. Fitting the sample's widths directly
   (rather than a free H and η, corrected afterwards) needs no inversion of the
   pseudo-Voigt, keeps η where the widths put it, and lets a sample no broader than
   the instrument come out at zero. Nodes held at `held` (one count per line) when
   given, so that derivatives are not jumps of the quadrature. */
function peakShape(xs, c, hl, u, lines, A, instAt, held){
  const out = new Float64Array(xs.length), th1 = c/2*D2R, counts = [];
  lines.forEach((L, j)=>{
    const st = L.lam/lines[0].lam*Math.sin(th1);
    if (st >= 1) return;
    const th = Math.asin(st), tt = 2*th/D2R, ins = instAt(th);
    const pr = tch(Math.sqrt(u + ins.HG*ins.HG), hl + ins.HL);
    const nodes = A > 0 ? fcjNodes(th, A, pr.H, held ? held[j] : undefined) : null;
    counts.push(nodes ? nodes.n : 0);
    if (!nodes) addPeak(out, xs, tt, pr.H, pr.eta, L.w, 40);
    else if (nodes.length === 1) addPeak(out, xs, tt + nodes[0].d, pr.H, pr.eta, L.w, 40);
    else addPeakFCJ(out, xs, tt, pr.H, pr.eta, L.w, nodes, 40);
  });
  return { f: out, counts };
}

/* The single-peak fit: nonlinear c, hl (the sample's Lorentzian FWHM) and u (its
   Gaussian FWHM squared), both ≥ 0, by Nelder–Mead (each trial with its linear
   amplitude and straight background solved exactly); then Gauss–Newton's covariance
   of all six at the optimum, scaled by the fit's own χ²_ν. The sample's FWHM
   Hs = TCH(√u, hl) and the observed one get their esds by secants over ± one esd of
   hl and u (a derivative at u = 0 would be infinite). → { c, hl, u, Hs, HsEsd, H, Hesd,
   eta (observed), A, Aesd, chi2nu } or null. */
function fitPeak(xs, ys, ws, c0, H0, lines, Aasym, instAt){
  const n = xs.length, xm = (xs[0] + xs[n-1])/2;
  const linear = (f) => {
    const M = [[0,0,0],[0,0,0],[0,0,0]], b = [0,0,0];
    for (let i = 0; i < n; i++){
      const r = [f[i], 1, xs[i] - xm];
      for (let a = 0; a < 3; a++){ b[a] += ws[i]*r[a]*ys[i]; for (let d = 0; d < 3; d++) M[a][d] += ws[i]*r[a]*r[d]; }
    }
    const sol = solve(M, b);
    if (!sol) return null;
    let chi = 0;
    for (let i = 0; i < n; i++){ const r = ys[i] - (sol[0]*f[i] + sol[1] + sol[2]*(xs[i] - xm)); chi += ws[i]*r*r; }
    return { chi, sol };
  };
  const ins0 = instAt(c0/2*D2R), Hi = tch(ins0.HG, ins0.HL).H;
  const total = (c, hl, u) => { const ins = instAt(c/2*D2R); return tch(Math.sqrt(u + ins.HG*ins.HG), hl + ins.HL); };
  // The peak stays itself: its centre within half its expected width of the model's
  // position, its width within a factor 4 of the expected one.
  const evalAt = (c, hl, u) => {
    if (hl < 0 || u < 0 || Math.abs(c - c0) > 0.5*H0) return Infinity;
    const Ht = total(c, hl, u).H;
    if (Ht < 0.25*H0 || Ht > 4*H0) return Infinity;
    const r = linear(peakShape(xs, c, hl, u, lines, Aasym, instAt).f);
    return r && r.sol[0] > 0 ? r.chi : Infinity;
  };
  // Nelder–Mead in (c, a, b) with hl = |a|, u = b² (folded: no edge for the simplex).
  const toP = v => [v[0], Math.abs(v[1]), v[2]*v[2]];
  const ex = Math.max(H0 - Hi, 0.1*H0);
  let S = [[c0, 0.8*ex, 0.3*ex], [c0 + 0.15*H0, 0.8*ex, 0.3*ex], [c0, 1.1*ex, 0.3*ex], [c0, 0.8*ex, 0.6*ex]]
    .map(v=> ({ v, f: evalAt(...toP(v)) }));
  for (let it = 0; it < 500; it++){
    S.sort((a, b)=> a.f - b.f);
    if (Math.abs(S[3].f - S[0].f) < 1e-10*Math.max(1, S[0].f) && it > 40) break;
    const cen = [0, 1, 2].map(k=> (S[0].v[k] + S[1].v[k] + S[2].v[k])/3), w = S[3];
    const at = t => { const v = cen.map((ck, k)=> ck + t*(w.v[k] - ck)); return { v, f: evalAt(...toP(v)) }; };
    const r = at(-1);
    if (r.f < S[0].f){ const e = at(-2); S[3] = e.f < r.f ? e : r; }
    else if (r.f < S[2].f) S[3] = r;
    else {
      const k = at(0.5);
      if (k.f < w.f) S[3] = k;
      else for (let i = 1; i < 4; i++){ const v = S[i].v.map((t, j)=> S[0].v[j] + 0.5*(t - S[0].v[j])); S[i] = { v, f: evalAt(...toP(v)) }; }
    }
  }
  S.sort((a, b)=> a.f - b.f);
  if (!isFinite(S[0].f)) return null;
  const [c, hl, u] = toP(S[0].v);
  // Covariance: Jacobian of the full model (c, hl, u, amplitude, b0, b1), nodes held;
  // a one-sided difference where a width sits on its bound 0.
  const base = peakShape(xs, c, hl, u, lines, Aasym, instAt), lin = linear(base.f);
  if (!lin) return null;
  const [Amp, b0, b1] = lin.sol, held = base.counts;
  const model = (cc, h2, u2) => peakShape(xs, cc, h2, u2, lines, Aasym, instAt, held).f;
  const p0 = [c, hl, u], steps = [1e-4*H0, 1e-4*H0, Math.max(1e-8, 1e-4*H0*H0)];
  const cols = [0, 1, 2].map(k=>{
    const pp = p0.slice(), pm = p0.slice();
    pp[k] += steps[k]; pm[k] = k ? Math.max(0, pm[k] - steps[k]) : pm[k] - steps[k];
    const fp = model(...pp), fm = model(...pm), dk = pp[k] - pm[k];
    return Float64Array.from(fp, (v, i)=> Amp*(v - fm[i])/dk);
  });
  cols.push(base.f, Float64Array.from(xs, ()=> 1), Float64Array.from(xs, x=> x - xm));
  const m = 6, JtJ = Array.from({ length: m }, ()=> new Array(m).fill(0));
  for (let a = 0; a < m; a++) for (let b = a; b < m; b++){ let t = 0; for (let i = 0; i < n; i++) t += ws[i]*cols[a][i]*cols[b][i]; JtJ[a][b] = JtJ[b][a] = t; }
  const inv = invert(JtJ);
  const chi2nu = S[0].f/Math.max(1, n - m);
  const C = inv ? [0, 1, 2].map(a=> [0, 1, 2].map(b=> inv[a][b]*chi2nu)) : null;
  // Secant esds: the change of a width over ± one esd of hl and of u (clamped at 0).
  const secant = (fn) => {
    if (!C) return NaN;
    const g = [1, 2].map(k=>{
      const s = Math.sqrt(Math.max(0, C[k][k])); if (!(s > 0)) return 0;
      const pp = p0.slice(), pm = p0.slice(); pp[k] += s; pm[k] = Math.max(0, pm[k] - s);
      return (fn(...pp) - fn(...pm))/(pp[k] - pm[k]);
    });
    return Math.sqrt(Math.max(0, g[0]*g[0]*C[1][1] + 2*g[0]*g[1]*C[1][2] + g[1]*g[1]*C[2][2]));
  };
  const HsOf = (cc, h2, u2) => tch(Math.sqrt(u2), h2).H, HtOf = (cc, h2, u2) => total(cc, h2, u2).H;
  const tot = total(c, hl, u);
  return { c, hl, u, Hs: HsOf(c, hl, u), HsEsd: secant(HsOf), H: tot.H, Hesd: secant(HtOf), eta: tot.eta,
           A: Amp, Aesd: inv ? Math.sqrt(Math.max(0, inv[3][3]*chi2nu)) : NaN, b0, b1, chi2nu };
}
// hkl as crystallographers write it: a negative index with a bar over it.
function hklText(h, k, l){ return [h, k, l].map(v=> v < 0 ? String(-v) + '\u0305' : String(v)).join(''); }
function solve(M, b){
  const n = b.length, a = M.map((r, i)=> [...r, b[i]]);
  for (let i = 0; i < n; i++){
    let p = i; for (let r = i + 1; r < n; r++) if (Math.abs(a[r][i]) > Math.abs(a[p][i])) p = r;
    if (!(Math.abs(a[p][i]) > 1e-300)) return null;
    [a[i], a[p]] = [a[p], a[i]];
    for (let r = 0; r < n; r++){ if (r === i) continue; const f = a[r][i]/a[i][i]; for (let c = i; c <= n; c++) a[r][c] -= f*a[i][c]; }
  }
  return a.map((r, i)=> r[n]/r[i]);
}
function invert(M){
  const n = M.length, out = [];
  for (let j = 0; j < n; j++){ const e = new Array(n).fill(0); e[j] = 1; const col = solve(M, e); if (!col) return null; out.push(col); }
  return M.map((_, i)=> out.map(col=> col[i]));
}

/* measureWidths(model, res, opts) → { lam, corrected, phases: [{ id, name, shaped,
   rows, wh, orders }] }, for the phases detected in res (opts.irf: the standard's
   profile, for the correction; opts.isoParams: the isotropic refinement's parameters
   when a free shape was refined after it; opts.shapeIds: the ids of the phases whose
   free shape was kept — shaped; opts.onProgress(done, total): after each peak). A row:
   { label, hkl, tt, H, Hesd, eta, Hs, HsEsd (corrected FWHM, °), D, Desd (nm,
   Kλ/(Hs·cosθ), K = 0.9 as the Analysis card), dd, ddEsd (Δd*, Å⁻¹), area, rel,
   overlapped, edge, weak, flat, model: { iso, shape } (the isotropic model's and, for
   a shaped phase, the free shape's corrected FWHM, measured the same way) }. */
function measureWidths(model, res, opts = {}){
  const params = res.params, irf = opts.irf || null, lam = model.lines[0].lam;
  const A = Number.isFinite(params.asym) ? params.asym : 0;
  const x = model.x, y = model.y, w = model.w;
  // The data's peaks are isolated with the isotropic refinement's neighbours and
  // background even when a free shape was refined after it: a test of the shape must
  // not read the data through the shape (the (200) of the user's SrTiO3 measured 1.08°
  // or 0.83° depending on which model's neighbouring tails were taken away).
  const dataP = opts.isoParams || params;
  const ref = calc(model, dataP, { internal: true });
  const shapeIds = new Set([...(opts.shapeIds || [])].map(String));
  // The instrument's Gaussian and Lorentzian widths at θ (none without a standard: the
  // widths are then the whole peak's).
  const instAt = irf ? th => instrumentAt(irf, th) : () => ({ HG: 0, HL: 0 });
  const detected = new Set(res.detected || model.phases.map(q=> q.id));
  // The phases' peaks: their reflections in range, grouped where they coincide (300 and
  // 221 of a cubic cell lie at one d): a group is one peak.
  const todo = [];
  model.phases.forEach((q, k)=>{
    if (!detected.has(q.id)) return;
    const groups = [];
    for (const t of ref.ticks.filter(t=> t.pk === k)){
      const g = groups.find(g=> Math.abs(g.tt - t.tt) < 0.2*Math.min(g.H, t.H));
      if (g){ g.rs.add(t.r); g.labels.push(t); g.I += t.I; }
      else groups.push({ tt: t.tt, H: t.H, rs: new Set([t.r]), labels: [t], I: t.I });
    }
    todo.push({ q, k, groups });
  });
  const total = todo.reduce((t, p)=> t + p.groups.length, 0);
  let done = 0;
  const phases = [];
  for (const { q, k, groups } of todo){
    // A free shape's own widths only for a phase whose shape was kept: another phase of
    // the sample is isotropic in both refinements.
    const shaped = !!opts.isoParams && shapeIds.has(String(q.id));
    const rows = [];
    for (const g of groups){
      if (opts.onProgress) opts.onProgress(done++, total);
      // The window: ± 2.5 FWHM (at least 0.4°), cut by the pattern's ends; a peak whose
      // top half (± 1.2 FWHM) is not all inside is at an edge and not read.
      const half = Math.max(2.5*g.H, 0.4);
      const edge = g.tt - 1.2*g.H < model.x0 || g.tt + 1.2*g.H > model.x1;
      const idx = [];
      for (let i = 0; i < model.n; i++) if (x[i] >= g.tt - half && x[i] <= g.tt + half && w[i] > 0) idx.push(i);
      if (idx.length < 15) continue;
      // A model's curve for this peak alone (its reflections, no background): the rest
      // of the pattern is the whole curve less it, with no full calculation per peak.
      const ownOf = P => { const c = calc(model, P, { internal: true, only: { k, rs: g.rs } }); return idx.map(i=> c.yc[i] - c.bg[i]); };
      const own = ownOf(dataP);
      const xs = idx.map(i=> x[i]), ws = idx.map(i=> w[i]);
      // The peak alone: the data less everything else the model puts there, the
      // refined background included (a straight line over ± 2.5 FWHM left the curved
      // background in, and read a broad 310 3 % narrow); the fit's own straight line
      // only corrects what is left.
      const ys = idx.map((i, j)=> y[i] - (ref.yc[i] - own[j]));
      // Overlapped: the other reflections hold more than 30 % of this one's intensity
      // across its top (± H/2), where its width is read.
      let mine = 0, oth = 0;
      idx.forEach((i, j)=> { if (Math.abs(x[i] - g.tt) <= g.H/2){ mine += own[j]; oth += ref.yc[i] - own[j] - ref.bg[i]; } });
      const overlapped = !(mine > 0) || oth > 0.3*mine;
      const fit = fitPeak(xs, ys, ws, g.tt, g.H, model.lines, A, instAt);
      if (!fit) continue;
      const th = fit.c/2*D2R, cosT = Math.cos(th);
      // No measurable broadening: the sample's width under two of its esds (it is then
      // no size to quote, and the tests leave it out).
      const flat = !(fit.Hs > 2*fit.HsEsd);
      const D = !flat ? K_SCHERRER*lam/(fit.Hs*D2R*cosT)/10 : NaN;
      // The models' widths, read off their own curves for this peak alone, with the
      // same fit as the data's.
      const predict = curve => { const r = fitPeak(xs, curve, ws, g.tt, g.H, model.lines, A, instAt); return r ? r.Hs : NaN; };
      rows.push({
        label: g.labels.map(t=> hklText(t.h, t.k, t.l)).join('/'), plain: g.labels.map(t=> [t.h, t.k, t.l].join(' ')).join(' / '),
        hkl: g.labels.length === 1 ? [g.labels[0].h, g.labels[0].k, g.labels[0].l] : null,
        tt: fit.c, ttCalc: g.tt, H: fit.H, Hesd: fit.Hesd, eta: fit.eta, Hs: fit.Hs, HsEsd: fit.HsEsd, hl: fit.hl, hg: Math.sqrt(fit.u),
        W: fit.Hs, Wesd: fit.HsEsd, D, Desd: !flat ? D*fit.HsEsd/fit.Hs : NaN,
        dd: fit.Hs*D2R*cosT/lam, ddEsd: fit.HsEsd*D2R*cosT/lam, sin: Math.sin(th), cos: cosT,
        area: fit.A, overlapped, edge, weak: !(fit.A > 3*fit.Aesd), flat,
        model: { iso: predict(own), shape: shaped ? predict(ownOf(params)) : NaN },
      });
    }
    rows.sort((a, b)=> a.tt - b.tt);
    // Relative to the strongest peak read; none for a peak cut by the pattern's end, or a
    // weak one whose area came out above it (a 212 cut at 80° read 115 %).
    const amax = Math.max(...rows.filter(r=> !r.weak && !r.edge).map(r=> r.area), 0);
    rows.forEach(r=> { r.rel = amax > 0 && !r.edge && r.area <= amax ? r.area/amax : NaN; });
    phases.push({ id: q.id, name: q.name, shaped, rows, wh: williamsonHall(rows, lam), orders: orderTests(rows) });
  }
  if (opts.onProgress) opts.onProgress(total, total);
  return { lam, corrected: !!irf, phases };
}

/* Williamson–Hall on the usable rows (not overlapped, not at an edge, a width above the
   instrument's): y = β·cosθ (rad) against x = 4·sinθ, weighted by the widths' esds:
   y = Kλ/D + ε·x. → { n, a, aEsd, b, bEsd (= ε), D, Desd (nm), chi2, nu, chi2nu, p,
   points: [{ x, y, yEsd, label }] } (p: the probability of so large a χ² were the
   broadening isotropic, i.e. the points on one line within their esds). */
function williamsonHall(rows, lam){
  const pts = rows.filter(r=> !r.overlapped && !r.edge && !r.weak && !r.flat && r.Wesd > 0)
    .map(r=> ({ x: 4*r.sin, y: r.W*D2R*r.cos, yEsd: r.Wesd*D2R*r.cos, label: r.label }));
  const out = { n: pts.length, points: pts };
  if (pts.length < 3) return out;
  let S = 0, Sx = 0, Sy = 0, Sxx = 0, Sxy = 0;
  for (const p of pts){ const w = 1/(p.yEsd*p.yEsd); S += w; Sx += w*p.x; Sy += w*p.y; Sxx += w*p.x*p.x; Sxy += w*p.x*p.y; }
  const det = S*Sxx - Sx*Sx;
  if (!(det > 0)) return out;
  const a = (Sxx*Sy - Sx*Sxy)/det, b = (S*Sxy - Sx*Sy)/det;
  const aEsd = Math.sqrt(Sxx/det), bEsd = Math.sqrt(S/det);
  let chi2 = 0;
  for (const p of pts) chi2 += ((p.y - a - b*p.x)/p.yEsd)**2;
  const nu = pts.length - 2;
  return { ...out, a, aEsd, b, bEsd, D: a > 0 ? K_SCHERRER*lam/a/10 : NaN, Desd: a > 0 ? K_SCHERRER*lam/a/10*aEsd/a : NaN,
           chi2, nu, chi2nu: chi2/nu, p: chi2Survival(chi2, nu) };
}

/* Order pairs: (h k l) and (n·h n·k n·l), n = 2, 3, 4, both usable. R = Δd*(n)/Δd*(1):
   a size gives 1, a strain n, faults that broaden by parity one sharp order (R < 1). */
function orderTests(rows){
  const use = rows.filter(r=> r.hkl && !r.overlapped && !r.edge && !r.weak && !r.flat && r.Wesd > 0);
  const out = [];
  for (const a of use) for (const b of use){
    if (a === b) continue;
    const n = [2, 3, 4].find(n=> a.hkl.every((v, i)=> v*n === b.hkl[i]) || a.hkl.every((v, i)=> -v*n === b.hkl[i]));
    if (!n) continue;
    const R = b.dd/a.dd, Resd = R*Math.sqrt((a.ddEsd/a.dd)**2 + (b.ddEsd/b.dd)**2);
    const near = t => Math.abs(R - t) <= 2*Resd;
    const verdict = near(1) && !near(n) ? 'size' : near(n) && !near(1) ? 'strain'
      : R > 1 + 2*Resd && R < n - 2*Resd ? 'size and strain' : R < 1 - 2*Resd ? 'order-dependent' : R > n + 2*Resd ? 'more than strain' : 'undetermined';
    out.push({ a: a.label, b: b.label, aPlain: a.plain, bPlain: b.plain, n, R, Resd, verdict });
  }
  return out;
}

// P(χ² ≥ x) for ν degrees of freedom: the regularized upper incomplete gamma Q(ν/2, x/2)
// (series below a + 1, continued fraction above: Numerical Recipes' gammq).
function chi2Survival(x, nu){
  const a = nu/2, z = x/2;
  if (!(z > 0)) return 1;
  const gln = lnGamma(a);
  if (z < a + 1){
    let ap = a, sum = 1/a, del = sum;
    for (let n = 0; n < 500; n++){ ap++; del *= z/ap; sum += del; if (Math.abs(del) < Math.abs(sum)*1e-14) break; }
    return Math.max(0, 1 - sum*Math.exp(-z + a*Math.log(z) - gln));
  }
  let b = z + 1 - a, c = 1/1e-300, d = 1/b, h = d;
  for (let i = 1; i < 500; i++){
    const an = -i*(i - a); b += 2;
    d = an*d + b; if (Math.abs(d) < 1e-300) d = 1e-300;
    c = b + an/c; if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1/d; const del = d*c; h *= del;
    if (Math.abs(del - 1) < 1e-14) break;
  }
  return Math.min(1, Math.exp(-z + a*Math.log(z) - gln)*h);
}
function lnGamma(x){
  const g = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x, tmp = x + 5.5; tmp -= (x + 0.5)*Math.log(tmp);
  let ser = 1.000000000190015;
  for (const c of g) ser += c/++y;
  return -tmp + Math.log(2.5066282746310005*ser/x);
}

export { measureWidths, williamsonHall, orderTests, chi2Survival, hklText, fitPeak };
