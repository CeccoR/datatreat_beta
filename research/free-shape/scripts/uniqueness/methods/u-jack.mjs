/* The delete-one-reflection jackknife from the best free exact minimum a previous run found
   (results/<UJACK_FROM, main>/<case>-<seed>.json: uniq.minima[0], its whole vector), without
   the search: the model handed over is the same isotropic fit (the pattern and autoRefine
   are deterministic), so the minimum's vector is set as it was.
   1. The residuals at the minimum: χ²_ν, the Durbin–Watson d of r = √w (y − y_c) (2 for
      independent residuals, below for a misfit that runs over many points), and χ² per
      segment over its points (where the misfit sits).
   2. The 2θ range cut into one segment per line position (the phase's reflections in range,
      positions closer than 0.3° merged; boundaries at the midpoints), and for each segment
      the minimum refitted with that segment's weights set to 0 (every parameter free at the
      minimum, the orientation free; 12 iterations, no FCJ audit): the solid each time.
   Returns the minimum's vector as a free result (the record's accuracy is not the point). */
import fs from 'node:fs';
import path from 'node:path';
import { solidOf, readResult } from '../../harness/lib.mjs';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const FROM = process.env.UJACK_FROM || 'main';
export default { name: 'u-jack', search(model, k, res, free, opts, E, ctx){
  const f = path.join(HERE, '..', 'results', FROM, `${ctx.case.id}-${ctx.seed}.json`);
  if (!fs.existsSync(f)) return null;
  const prev = readResult(fs.readFileSync(f, 'utf8')), u = prev.records[0].info && prev.records[0].info.uniq;
  if (!u || !u.minima || !u.minima.length) return null;
  const q = model.phases[k], type = q.shapeType, pf = q.pfx, F = E.fitSettings(opts.fit);
  const names = free.filter(n=> n !== pf + 'Ys').concat([...q.iW, ...q.iR].map(i=> model.par[i].name));
  const lmB = { maxIter: 12, shiftTol: F.shiftTol, lambda: F.lambda };
  const best = u.minima[0], vb = Float64Array.from(best.v);
  const ev0 = E.FS.evals, t0 = Date.now();
  const y = model.y, w0 = model.w, x = model.x, n = model.n;
  E.setParams(model, vb);
  const st = E.evaluate(model, vb), yc = st.yc;
  // line positions of the phase in range
  const ticks = E.calc(model).ticks.filter(t=> t.phase === q.id), Imax = Math.max(0, ...ticks.map(t=> t.I));
  const lo = x[0], hi = x[n - 1];
  const pos = [];
  for (const t of ticks.filter(t=> t.I > 1e-4*Imax && t.tt > lo && t.tt < hi).sort((a, b)=> a.tt - b.tt)){
    const p = pos[pos.length - 1];
    if (p && t.tt - p.tt < 0.3){ p.hkl.push([t.h, t.k, t.l]); continue; }
    pos.push({ tt: t.tt, hkl: [[t.h, t.k, t.l]] });
  }
  const edges = [lo, ...pos.slice(1).map((p, i)=> (pos[i].tt + p.tt)/2), hi + 1e-9];
  const segOf = i => { let s = 0; while (s < pos.length - 1 && x[i] >= edges[s + 1]) s++; return s; };
  // residuals
  let s2 = 0, sd = 0, prevR = null, m = 0;
  const seg = pos.map(p=> ({ tt: p.tt, hkl: p.hkl, chi: 0, n: 0 }));
  for (let i = 0; i < n; i++){
    if (!(w0[i] > 0)) continue;
    const r = Math.sqrt(w0[i])*(y[i] - yc[i]); s2 += r*r; m++;
    if (prevR != null) sd += (r - prevR)**2; prevR = r;
    const s = seg[segOf(i)]; s.chi += r*r; s.n++;
  }
  const out = { from: FROM, chi2nu: best.chi2nu, chi: best.chi, dw: sd/s2, segs: seg.map(s=> ({ tt: s.tt, hkl: s.hkl, n: s.n, chi2nu: s.chi/Math.max(1, s.n) })), drops: [] };
  try {
    for (let s = 0; s < pos.length; s++){
      const W = Float64Array.from(w0);
      for (let i = 0; i < n; i++) if (segOf(i) === s) W[i] = 0;
      model.w = W; E.setParams(model, vb);
      const e1 = E.FS.evals, t1 = Date.now();
      try {
        const rr = E.refine(model, { free: names, ...lmB, audit: false });
        out.drops.push({ s, tt: pos[s].tt, chi2nu: rr.stats.chi2, it: rr.iterations, solid: solidOf(q, type, model.v), evals: E.FS.evals - e1, ms: Date.now() - t1 });
      } catch(e){ out.drops.push({ s, tt: pos[s].tt, error: String(e && e.message || e) }); }
    }
  } finally { model.w = w0; }
  out.evals = E.FS.evals - ev0; out.ms = Date.now() - t0;
  E.setParams(model, vb);
  return { res: { stats: { chi2: best.chi2nu, N: res.stats.N, P: res.stats.P }, free: names }, info: { type, jack: out } };
} };
