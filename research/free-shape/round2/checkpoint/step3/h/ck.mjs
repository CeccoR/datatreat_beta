/* Step 3's per-line check, shared by the method (methods/check.mjs, in the run) and the offline
   scoring (an3.mjs, from the residuals the run dumps).
   - segments(x, ticks, lines, opt): the 2θ range cut into one segment per line or group of
     overlapping lines: the phase's reflections above 1e-4 of the strongest, each at its Kα
     centroid (Kα1 + a third of the α1–α2 split for a 2:1 doublet), a line within
     max(MINSEP, its and its neighbour's mean FWHM) of the group's last joins the group;
     boundaries at the midpoints between groups. → [{ i0, i1 (inclusive point indices), lo, hi,
     tt (the strongest line's), hkl (up to 6, strongest first), nl, H }].
   - segStats(r, net, segs): per segment n, Σr², Σr, Σ(rᵢ − rᵢ₋₁)², Σ net, max net (r = √w(y − y_c)).
   - zchi(c, n): a χ²_n's upper tail as a normal deviate (Wilson–Hilferty).
   - zOfP / pOfZ: normal tail helpers. */
export const MINSEP = 0.3;
export function lineCentroid(tt, lines){
  if (!lines || lines.length < 2) return tt;
  const th = tt/2*Math.PI/180, s = lines[1].lam/lines[0].lam*Math.sin(th);
  if (!(s < 1)) return tt;
  const d = 2*(Math.asin(s) - th)*180/Math.PI, w2 = lines[1].w/(lines[0].w + lines[1].w);
  return tt + d*w2;
}
export function segments(x, ticks, lines, { minsep = MINSEP, rel = 1e-4 } = {}){
  const n = x.length, Imax = Math.max(0, ...ticks.map(t=> t.I));
  const L = ticks.filter(t=> t.I > rel*Imax && t.tt >= x[0] && t.tt <= x[n - 1])
    .map(t=> ({ c: lineCentroid(t.tt, lines), tt: t.tt, H: t.H > 0 ? t.H : 0.1, I: t.I, hkl: [t.h, t.k, t.l] })).sort((a, b)=> a.c - b.c);
  const G = [];
  for (const l of L){
    const g = G[G.length - 1];
    if (g && l.c - g.last.c < Math.max(minsep, (l.H + g.last.H)/2)){ g.ls.push(l); g.last = l; continue; }
    G.push({ ls: [l], last: l, first: l });
  }
  if (!G.length) return [{ i0: 0, i1: n - 1, lo: x[0], hi: x[n - 1], tt: null, hkl: [], nl: 0, H: null }];
  const cut = [x[0] - 1e-9, ...G.slice(1).map((g, i)=> (G[i].last.c + g.first.c)/2), x[n - 1] + 1e-9];
  const out = []; let i = 0;
  for (let s = 0; s < G.length; s++){
    const i0 = i; while (i < n && x[i] < cut[s + 1]) i++;
    const ls = [...G[s].ls].sort((a, b)=> b.I - a.I);
    out.push({ i0, i1: i - 1, lo: x[i0], hi: x[Math.max(i0, i - 1)], tt: ls[0].tt, hkl: ls.slice(0, 6).map(l=> l.hkl.join(' ')), nl: ls.length, H: ls[0].H, I: ls.reduce((t, l)=> t + l.I, 0) });
  }
  return out.filter(s=> s.i1 >= s.i0);
}
export function segStats(r, net, segs){
  return segs.map(s=> {
    let n = 0, c = 0, s1 = 0, dd = 0, pr = null, nt = 0, nm = 0;
    for (let i = s.i0; i <= s.i1; i++){
      const v = r[i]; if (!Number.isFinite(v)) { pr = null; continue; }
      n++; c += v*v; s1 += v; if (pr != null) dd += (v - pr)**2; pr = v;
      if (net){ nt += net[i]; if (net[i] > nm) nm = net[i]; }
    }
    return { n, c, s1, dd, net: nt, netMax: nm };
  });
}
export const zchi = (c, n) => { if (!(n > 0)) return 0; const a = 2/(9*n); return (Math.cbrt(c/n) - (1 - a))/Math.sqrt(a); };
// the standard normal's upper tail and its inverse (Acklam's rational approximation, refined)
export function pOfZ(z){ const t = 1/(1 + 0.2316419*Math.abs(z)), d = 0.3989422804014327*Math.exp(-z*z/2);
  const p = d*t*(0.319381530 + t*(-0.356563782 + t*(1.781477937 + t*(-1.821255978 + t*1.330274429)))); return z >= 0 ? p : 1 - p; }
export function zOfP(p){
  if (p <= 0) return Infinity; if (p >= 1) return -Infinity;
  const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
  const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
  const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
  const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
  const q0 = 1 - p, pl = 0.02425; let x;
  if (q0 < pl){ const q = Math.sqrt(-2*Math.log(q0)); x = (((((c[0]*q + c[1])*q + c[2])*q + c[3])*q + c[4])*q + c[5])/((((d[0]*q + d[1])*q + d[2])*q + d[3])*q + 1); }
  else if (q0 <= 1 - pl){ const q = q0 - 0.5, r = q*q; x = (((((a[0]*r + a[1])*r + a[2])*r + a[3])*r + a[4])*r + a[5])*q/(((((b[0]*r + b[1])*r + b[2])*r + b[3])*r + b[4])*r + 1); }
  else { const q = Math.sqrt(-2*Math.log(1 - q0)); x = -(((((c[0]*q + c[1])*q + c[2])*q + c[3])*q + c[4])*q + c[5])/((((d[0]*q + d[1])*q + d[2])*q + d[3])*q + 1); }
  return x;
}
export const b64 = a => Buffer.from(new Float32Array(a).buffer).toString('base64');
export const unb64 = s => { const b = Buffer.from(s, 'base64'); return new Float32Array(b.buffer, b.byteOffset, b.length/4); };
