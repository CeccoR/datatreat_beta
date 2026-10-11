/* =========================================================
   XRD PEAK WIDTHS — what the peaks' own widths say, before any model of the shape.
   For every reflection of a refined phase the peak is fitted alone: the pattern less
   everything else the Rietveld model puts there (the other reflections, of every
   phase, and the background) is fitted, over a window about the peak, with one
   pseudo-Voigt per line (Kα1 and Kα2, at the file's ratio and the Lorentz–polarisation
   factor of each line's θ, with the instrument's axial-divergence asymmetry) on a
   straight background — so a neighbour's tail does
   not widen it, and nothing else of the model enters. The fit is made in the sample's
   own widths, the instrument's (the standard's profile at that angle) convolved in as
   the engine does, and three tests read them:
   - Williamson–Hall: H·cosθ against 4·sinθ, H the corrected FWHM (not the integral
     breadth β; the size is read with K = 0.9, the FWHM's). An isotropic size gives a
     constant Kλ/D, a microstrain a slope ε: the points lie on one line. Points off it,
     by hkl, mean a broadening that depends on the direction: the crystallites' shape
     (or faults).
   - Orders: the same direction at two orders, (h k l) and (n·h n·k n·l). In
     Δd* = H·cosθ/λ a size broadens both alike (ratio 1), a strain in proportion to d*
     (ratio n), and planar faults by h·R modulo 1, which can leave an order sharp (ratio < 1).
   - Prediction: the same measurement on the model's own curve for each reflection,
     the isotropic model's and the free shape's: a model of the shape should give the
     widths it was not told.
   Pure functions on the engine's model (xrd-rietveld.js): the worker runs them after
   a refinement.
========================================================= */
import { calc, fcjNodes, addPeak, addPeakFCJ, tch, lpFactor, HG2_FLOOR, K_SCHERRER } from './xrd-rietveld.js';

const D2R = Math.PI/180;

function instrumentAt(irf, th){
  const t = Math.tan(th), c = Math.cos(th);
  return { HG: Math.sqrt(Math.max(HG2_FLOOR, irf.U*t*t + irf.V*t + irf.W)), HL: Math.max(0, irf.X*t + irf.Y/c) };
}

/* The sample's FWHM from its Lorentzian hl and Gaussian u = h_G², by TCH; a width below 0
   (at most the instrument's: peakProfile) reflects the rise it gives: for u < 0,
   2·hl − TCH(√−u, hl), for hl < 0, 2·h_G − TCH(h_G, −hl), both, −TCH. Monotonic in each
   and continuous, so that noise about 0 averages out of it. */
function sampleFwhm(hl, u){
  const g = Math.sqrt(Math.abs(u)), T = tch(g, Math.abs(hl)).H;
  return u >= 0 ? (hl >= 0 ? T : 2*g - T) : hl >= 0 ? 2*hl - T : -T;
}
/* The whole peak's pseudo-Voigt for the sample's widths u, hl on the instrument's ins
   (HG, HL): TCH, the Gaussian widths in quadrature, the Lorentzian ones added. The
   sample's may go below 0 as far as the whole peak's do not: u + HG² ≥ 0 and
   hl + HL ≥ 0, the instrument's widths being a measurement too. Without a standard both
   are the whole peak's, not below 0. → { H, eta } or null. */
function peakProfile(u, hl, ins){
  const LT = hl + ins.HL, G2 = u + ins.HG*ins.HG;
  return LT >= 0 && G2 >= 0 ? tch(Math.sqrt(G2), LT) : null;
}

/* One peak's model on the window points xs: a pseudo-Voigt per line of the model (Kα1
   at c, Kα2 where its wavelength puts it), with the axial divergence A, its widths the
   instrument's at that angle (instAt) and the sample's on top as in the engine: the
   Lorentzian widths add, the Gaussian ones in quadrature (hl, and u = hg²), and the
   pseudo-Voigt follows by Thompson–Cox–Hastings. hl and u are Kα1's: a line of another
   wavelength at θ_j has them times tanθ_j/tanθ_1 (squared for u), as has any broadening
   of d* (Δ2θ = Δd*·λ/cosθ = Δd*·2d·tanθ, size and strain alike); taken as Kα1's (and
   the lines weighed by the file's ratio alone), the model's own peaks had read 0.26 %
   wide at 127° and 0.7 % at 146°, now within 0.2 % at any angle (synthetic SrTiO₃,
   rutile, ZnO, samples wider than the instrument, noise-free, to 146°). One as narrow
   as the instrument reads within 0.4 % (v425 0.8 %): the Kα2 is placed from c, the zero
   and displacement in it (0.12 % without them). Fitting the sample's widths directly
   (rather than a free H and η, corrected afterwards) needs no inversion of the
   pseudo-Voigt, keeps η where the widths put it, and lets a sample no broader than
   the instrument come out about zero. Nodes held at `held` (one count per line) when
   given, so that derivatives are not jumps of the quadrature. → { f, counts }, or null
   where the widths give no profile (peakProfile). */
function peakShape(xs, c, hl, u, lines, A, instAt, held){
  const out = new Float64Array(xs.length), th1 = c/2*D2R, counts = [];
  for (let j = 0; j < lines.length; j++){
    const L = lines[j], st = L.lam/lines[0].lam*Math.sin(th1);
    if (st >= 1) continue;
    const th = Math.asin(st), tt = 2*th/D2R, ins = instAt(th), r = j ? Math.tan(th)/Math.tan(th1) : 1;
    const pr = peakProfile(u*r*r, hl*r, ins);
    if (!pr) return null;
    const nodes = A > 0 ? fcjNodes(th, A, pr.H, held ? held[j] : undefined) : null;
    counts.push(nodes ? nodes.n : 0);
    if (!nodes) addPeak(out, xs, tt, pr.H, pr.eta, L.w, 40);
    else if (nodes.length === 1) addPeak(out, xs, tt + nodes[0].d, pr.H, pr.eta, L.w, 40);
    else addPeakFCJ(out, xs, tt, pr.H, pr.eta, L.w, nodes, 40);
  }
  return { f: out, counts };
}

/* The single-peak fit: nonlinear c and the sample's widths, hl (its Lorentzian FWHM) and
   u (its Gaussian FWHM squared), by Nelder–Mead (each trial with its linear amplitude and
   straight background solved exactly); then Gauss–Newton's covariance at the optimum,
   scaled by the fit's own χ²_ν. The sample's widths may go below 0 as far as the whole
   peak's stay at or above it (peakProfile): bounded at 0 themselves, noise could only
   push them up, and a purely Lorentzian sample read 1–7 % wide (z +0.3 to +0.6) with
   esds 1.2–1.5× too large.
   Two fits, as the data choose between them: the sample's broadening Lorentzian (u = 0,
   as the engine models it), and with its Gaussian part; Hs is their mean by their Akaike
   weights (u one parameter more, χ² in units of χ²_ν), its variance with the spread
   between them added (Burnham & Anderson's model averaging). With u always free, where
   the sample has no Gaussian part Hs = TCH(√u, hl) bends as √u wherever |u| passes about
   hl²/5, and its esds, read at the fit, missed its spread: the rows' z had sd 1.2–1.4 on
   samples 0.03–0.05° wide (the instrument's 0.038°), and on synthetic SrTiO₃ 0.02° wider
   than the instrument the Williamson–Hall test called 7 of 30 isotropic patterns
   anisotropic. Held at 0 always, a Gaussian part would read as a Lorentzian one.
   opts.wG: the Gaussian fit's weight, given (0 or 1: that fit alone), as the models'
   curves are read with the data's. Hs = sampleFwhm(hl, u) and the observed FWHM get their
   esds by secants over ± one esd of hl and u. → { c, hl, u, wG, Hs, HsEsd, HsMax, H, Hesd,
   Hinst, eta (observed), A, Aesd, chi2nu } or null. */
function fitPeak(xs, ys, ws, c0, H0, lines, Aasym, instAt, opts = {}){
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
  const total = (c, hl, u) => peakProfile(u, hl, instAt(c/2*D2R));
  // The peak stays itself: its centre within half its expected width of the model's
  // position, its width within a factor 4 of the expected one.
  const evalAt = (c, hl, u) => {
    if (Math.abs(c - c0) > 0.5*H0) return Infinity;
    const pr = total(c, hl, u);
    if (!pr || pr.H < 0.25*H0 || pr.H > 4*H0) return Infinity;
    const sh = peakShape(xs, c, hl, u, lines, Aasym, instAt), r = sh && linear(sh.f);
    return r && r.sol[0] > 0 ? r.chi : Infinity;
  };
  const ex = Math.max(H0 - Hi, 0.1*H0);
  const fitOf = gauss => {
    const S = gauss ? nelderMead(v=> evalAt(...v), [[c0, 0.8*ex, 0.09*ex*ex], [c0 + 0.15*H0, 0.8*ex, 0.09*ex*ex], [c0, 1.1*ex, 0.09*ex*ex], [c0, 0.8*ex, 0.36*ex*ex]], 500)
      : nelderMead(v=> evalAt(v[0], v[1], 0), [[c0, 0.8*ex], [c0 + 0.15*H0, 0.8*ex], [c0, 1.1*ex]], 500);
    if (!isFinite(S[0].f)) return null;
    const p0 = gauss ? S[0].v : [...S[0].v, 0], [c, hl, u] = p0, kk = gauss ? [0, 1, 2] : [0, 1];
    // Covariance: Jacobian of the full model (c, hl, u when fitted, amplitude, b0, b1),
    // nodes held; a one-sided difference where a step leaves the widths that give a profile.
    const base = peakShape(xs, c, hl, u, lines, Aasym, instAt), lin = base && linear(base.f);
    if (!lin) return null;
    const [Amp, b0, b1] = lin.sol, held = base.counts;
    const model = (cc, h2, u2) => { const sh = peakShape(xs, cc, h2, u2, lines, Aasym, instAt, held); return sh && sh.f; };
    const steps = [1e-4*H0, 1e-4*H0, Math.max(1e-8, 1e-4*H0*H0)];
    const cols = kk.map(k=>{
      const pp = p0.slice(), pm = p0.slice();
      pp[k] += steps[k]; pm[k] -= steps[k];
      let fp = model(...pp), fm = model(...pm), dk = 2*steps[k];
      if (!fp){ fp = base.f; dk = steps[k]; }
      if (!fm){ fm = base.f; dk = steps[k]; }
      return Float64Array.from(fp, (v, i)=> Amp*(v - fm[i])/dk);
    });
    cols.push(base.f, Float64Array.from(xs, ()=> 1), Float64Array.from(xs, x=> x - xm));
    const m = cols.length, JtJ = Array.from({ length: m }, ()=> new Array(m).fill(0));
    for (let a = 0; a < m; a++) for (let b = a; b < m; b++){ let t = 0; for (let i = 0; i < n; i++) t += ws[i]*cols[a][i]*cols[b][i]; JtJ[a][b] = JtJ[b][a] = t; }
    const inv = invert(JtJ);
    const chi2nu = S[0].f/Math.max(1, n - m);
    // The covariance of c, hl and u (0 for a u held).
    const C = inv ? [0, 1, 2].map(a=> [0, 1, 2].map(b=> a < kk.length && b < kk.length ? inv[a][b]*chi2nu : 0)) : null;
    // Secant esds: the change of a width over ± one esd of hl and of u.
    const secant = (fn) => {
      if (!C) return null;
      return [1, 2].map(k=>{
        const s = Math.sqrt(Math.max(0, C[k][k])); if (!(s > 0)) return 0;
        const pp = p0.slice(), pm = p0.slice(); pp[k] += s; pm[k] -= s;
        let fp = fn(...pp), fm = fn(...pm), dk = 2*s;
        if (!Number.isFinite(fp)){ fp = fn(...p0); dk = s; }
        if (!Number.isFinite(fm)){ fm = fn(...p0); dk = s; }
        return (fp - fm)/dk;
      });
    };
    const sdOf = g => g ? Math.sqrt(Math.max(0, g[0]*g[0]*C[1][1] + 2*g[0]*g[1]*C[1][2] + g[1]*g[1]*C[2][2])) : NaN;
    const HsOf = (cc, h2, u2) => sampleFwhm(h2, u2), HtOf = (cc, h2, u2) => { const pr = total(cc, h2, u2); return pr ? pr.H : NaN; };
    // Whether the peak is broadened is the whole width's to say, against Hinst, the
    // instrument's alone: where both the sample's widths are about 0 Hs goes as ±√|u|,
    // its linear esd half its spread.
    const tot = total(c, hl, u), Hesd = sdOf(secant(HtOf)), insC = instAt(c/2*D2R);
    return { c, hl, u, gauss, chi: S[0].f, Hs: sampleFwhm(hl, u), HsEsd: sdOf(secant(HsOf)), H: tot.H, Hesd, Hinst: tch(insC.HG, insC.HL).H, ins: insC, eta: tot.eta,
             A: Amp, Aesd: inv ? Math.sqrt(Math.max(0, inv[kk.length][kk.length]*chi2nu)) : NaN, b0, b1, chi2nu };
  };
  /* A peak not broadened gets its corrected FWHM as an upper limit, HsMax: the widest
     sample whose whole peak is no wider than 2 esd over the width found (over the
     instrument's when it came out below). The data tell its shape no better than its
     width, so the whole width is the fit's with the Gaussian part (with u = 0 a Gaussian
     sample's whole width reads low), and the sample whichever mix of Lorentzian and
     Gaussian gives the widest (widestSample). Taken along the covariance of hl and u
     instead, the limit lay under a Gaussian sample 0.01° wide (the instrument's 0.038°)
     in 59 of the 61 draws of 200 that read it as not broadened; now in 2. */
  const limit = (r, g = r) => ({ ...r, HsMax: g.Hesd > 0 ? widestSample(Math.max(g.H, g.Hinst) + 2*g.Hesd, g.ins) : NaN });
  const wG = Number.isFinite(opts.wG) ? opts.wG : NaN;
  const L = wG === 1 ? null : fitOf(false), G = wG === 0 ? null : fitOf(true);
  if (!L || !G) return L || G ? limit({ ...(L || G), wG: L ? 0 : 1 }) : null;
  // The two by their Akaike weights (u one parameter more), χ² read in units of χ²_ν.
  const w = Number.isFinite(wG) ? wG : 1/(1 + Math.exp(-((L.chi - G.chi)/G.chi2nu - 2)/2));
  const Hs = (1 - w)*L.Hs + w*G.Hs, best = w > 0.5 ? G : L;
  return limit({ ...best, wG: w, Hs, HsEsd: Math.sqrt((1 - w)*(L.HsEsd**2 + (L.Hs - Hs)**2) + w*(G.HsEsd**2 + (G.Hs - Hs)**2)) }, G);
}
/* The widest sample a whole width Hup allows on the instrument's ins (HG, HL): along
   H(hl, u) = Hup, from all of it Gaussian to all of it Lorentzian, the largest
   TCH(√u, hl). A Gaussian adds in quadrature, so a rise of the whole width is a wider
   Gaussian sample than a Lorentzian one. */
function widestSample(Hup, ins){
  const Ht = (hl, u) => tch(Math.sqrt(u + ins.HG*ins.HG), hl + ins.HL).H;
  if (!(Hup > Ht(0, 0))) return 0;
  // f increasing from below Hup at 0: where it reaches Hup
  const reach = (f, hi) => { let a = 0, b = hi; while (f(b) < Hup) b *= 2; for (let i = 0; i < 60; i++){ const m = (a + b)/2; if (f(m) < Hup) a = m; else b = m; } return (a + b)/2; };
  const hlMax = reach(h => Ht(h, 0), Hup);
  let best = hlMax;
  for (let i = 0; i < 32; i++){ const hl = hlMax*i/32; best = Math.max(best, tch(Math.sqrt(reach(v => Ht(hl, v), Hup*Hup)), hl).H); }
  return best;
}

// Nelder–Mead from the simplex S0 (n + 1 points of n values) → the simplex sorted, best first.
function nelderMead(fn, S0, maxIt){
  const n = S0.length - 1;
  let S = S0.map(v=> ({ v, f: fn(v) }));
  for (let it = 0; it < maxIt; it++){
    S.sort((a, b)=> a.f - b.f);
    if (Math.abs(S[n].f - S[0].f) < 1e-10*Math.max(1, S[0].f) && it > 40) break;
    const cen = S[0].v.map((_, k)=> { let t = 0; for (let i = 0; i < n; i++) t += S[i].v[k]; return t/n; }), w = S[n];
    const at = t => { const v = cen.map((ck, k)=> ck + t*(w.v[k] - ck)); return { v, f: fn(v) }; };
    const r = at(-1);
    if (r.f < S[0].f){ const e = at(-2); S[n] = e.f < r.f ? e : r; }
    else if (r.f < S[n - 1].f) S[n] = r;
    else {
      const k = at(0.5);
      if (k.f < w.f) S[n] = k;
      else for (let i = 1; i <= n; i++){ const v = S[i].v.map((t, j)=> S[0].v[j] + 0.5*(t - S[0].v[j])); S[i] = { v, f: fn(v) }; }
    }
  }
  return S.sort((a, b)=> a.f - b.f);
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
   { label, hkl, tt, H, Hesd, eta, Hs, HsEsd (corrected FWHM, °), HsMax (a flat row's
   upper limit of it), wG (the sample's Gaussian fit's weight), D, Desd (nm,
   Kλ/(Hs·cosθ), K = 0.9 as the Analysis card), dd, ddEsd (Δd*, Å⁻¹), area, rel,
   overlapped, edge, weak, flat, unread (why a peak was not read: its row has no widths),
   model: { iso, shape } (the isotropic model's and, for a shaped phase, the free shape's
   corrected FWHM, measured the same way) }. */
function measureWidths(model, res, opts = {}){
  const params = res.params, irf = opts.irf || null, lam = model.lines[0].lam;
  const A = Number.isFinite(params.asym) ? params.asym : 0;
  const x = model.x, y = model.y, w = model.w, step = Math.abs(model.x1 - model.x0)/Math.max(1, model.n - 1);
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
    // A group's indices in one order, h then k then l descending: in 2θ order, reflections
    // of one d swapped with the refined cell's last digits (SrTiO₃'s 411/330 read 330/411
    // in 20 of 200 refined states), and a row is matched across files by its label.
    groups.forEach(g=> g.labels.sort((a, b)=> b.h - a.h || b.k - a.k || b.l - a.l));
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
      const label = g.labels.map(t=> hklText(t.h, t.k, t.l)).join('/'), plain = g.labels.map(t=> [t.h, t.k, t.l].join(' ')).join(' / ');
      const hkl = g.labels.length === 1 ? [g.labels[0].h, g.labels[0].k, g.labels[0].l] : null;
      // The window: ± 2.5 FWHM, at least 0.4° and 7.5 steps (15 points for the fit's six
      // parameters: on scans coarser than 0.055° no peak 0.05° wide was read at all), cut by
      // the pattern's ends; a peak whose top half (± 1.2 FWHM) is not all inside is at an
      // edge and not read.
      const half = Math.max(2.5*g.H, 0.4, 7.5*step);
      const edge = g.tt - 1.2*g.H < model.x0 || g.tt + 1.2*g.H > model.x1;
      const idx = [];
      for (let i = 0; i < model.n; i++) if (x[i] >= g.tt - half && x[i] <= g.tt + half && w[i] > 0) idx.push(i);
      // A peak not read keeps its row, with the reason (the table and the CSV give it).
      const unread = why => rows.push({ label, plain, hkl, tt: g.tt, ttCalc: g.tt, H: NaN, Hesd: NaN, eta: NaN, Hs: NaN, HsEsd: NaN, HsMax: NaN,
        W: NaN, Wesd: NaN, D: NaN, Desd: NaN, dd: NaN, ddEsd: NaN, sin: Math.sin(g.tt/2*D2R), cos: Math.cos(g.tt/2*D2R), area: NaN,
        overlapped: false, edge, weak: false, flat: false, unread: why, model: { iso: NaN, shape: NaN } });
      if (idx.length < 15){ unread(`${idx.length} points to fit, 15 needed (the others masked or past the pattern's end)`); continue; }
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
      // The lines' weights at this peak: the file's ratio times the Lorentz–polarisation
      // factor at each line's own θ, as the engine draws them (with the ratio alone the
      // model's own peaks read 0.4 % wide at 127° and 1 % at 146°, the shape taking up
      // the Kα2's intensity).
      const th1 = g.tt/2*D2R, lines = model.lines.map(L=>{ const st = L.lam/lam*Math.sin(th1); return st < 1 ? { lam: L.lam, w: L.w*lpFactor(model, Math.asin(st))/lpFactor(model, th1) } : L; });
      const fit = fitPeak(xs, ys, ws, g.tt, g.H, lines, A, instAt);
      if (!fit){ unread('no fit within its expected position and width'); continue; }
      const th = fit.c/2*D2R, cosT = Math.cos(th);
      // No measurable broadening: the whole width less the instrument's under two of its
      // esds (it is then no size to quote, the tests leave it out, and its corrected
      // width is the upper limit HsMax).
      const flat = !(fit.H - fit.Hinst > 2*fit.Hesd) || !(fit.Hs > 0);
      const D = !flat ? K_SCHERRER*lam/(fit.Hs*D2R*cosT)/10 : NaN;
      // The models' widths, read off their own curves for this peak alone, with the
      // same fit as the data's (the sample's Gaussian fitted or not as there).
      const predict = curve => { const r = fitPeak(xs, curve, ws, g.tt, g.H, lines, A, instAt, { wG: fit.wG }); return r ? r.Hs : NaN; };
      rows.push({
        label, plain, hkl, tt: fit.c, ttCalc: g.tt, H: fit.H, Hesd: fit.Hesd, eta: fit.eta, Hs: fit.Hs, HsEsd: fit.HsEsd, HsMax: flat ? fit.HsMax : NaN, hl: fit.hl, hg: Math.sign(fit.u)*Math.sqrt(Math.abs(fit.u)),
        W: fit.Hs, Wesd: fit.HsEsd, D, Desd: !flat ? D*fit.HsEsd/fit.Hs : NaN,
        dd: fit.Hs*D2R*cosT/lam, ddEsd: fit.HsEsd*D2R*cosT/lam, sin: Math.sin(th), cos: cosT,
        area: fit.A, overlapped, edge, weak: !(fit.A > 3*fit.Aesd), flat, wG: fit.wG,
        model: { iso: predict(own), shape: shaped ? predict(ownOf(params)) : NaN },
      });
    }
    rows.sort((a, b)=> a.tt - b.tt);
    // Relative to the strongest peak read; none for a peak cut by the pattern's end, or a
    // weak one whose area came out above it (a 212 cut at 80° read 115 %).
    const amax = Math.max(...rows.filter(r=> !r.weak && !r.edge && !r.unread).map(r=> r.area), 0);
    rows.forEach(r=> { r.rel = amax > 0 && !r.edge && r.area <= amax ? r.area/amax : NaN; });
    phases.push({ id: q.id, name: q.name, shaped, rows, wh: williamsonHall(rows, lam), orders: orderTests(rows) });
  }
  if (opts.onProgress) opts.onProgress(total, total);
  return { lam, corrected: !!irf, phases };
}

/* Williamson–Hall on the usable rows (not overlapped, not at an edge, a width above the
   instrument's): y = H·cosθ (rad, H the corrected FWHM) against x = 4·sinθ, weighted by
   the widths' esds: y = Kλ/D + ε·x. → { n, a, aEsd, b, bEsd (= ε), D, Desd (nm), chi2,
   nu, chi2nu, p, points: [{ x, y, yEsd, label }] } (p: the probability of so large a χ²
   were the broadening isotropic, i.e. the points on one line within their esds). */
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
  let chi2 = 0;
  for (const p of pts) chi2 += ((p.y - a - b*p.x)/p.yEsd)**2;
  const nu = pts.length - 2;
  // The esds scaled by √χ²_ν (not below 1), as every other fit here: points scattered
  // beyond their own esds (33A: χ²_ν 57) left D's at 0.35 nm where the scatter gives 2.6.
  const sc = Math.sqrt(Math.max(1, chi2/nu)), aEsd = Math.sqrt(Sxx/det)*sc, bEsd = Math.sqrt(S/det)*sc;
  return { ...out, a, aEsd, b, bEsd, D: a > 0 ? K_SCHERRER*lam/a/10 : NaN, Desd: a > 0 ? K_SCHERRER*lam/a/10*aEsd/a : NaN,
           chi2, nu, chi2nu: chi2/nu, p: chi2Survival(chi2, nu) };
}

/* Order pairs: (h k l) and (n·h n·k n·l), n = 2, 3, 4, both usable. R = Δd*(n)/Δd*(1):
   a size gives 1, a strain n, faults (by h·R modulo 1) an order sharper (R < 1). */
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
