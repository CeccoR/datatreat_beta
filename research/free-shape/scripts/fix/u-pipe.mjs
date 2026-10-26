/* The report pipeline the write-up recommends, on one run, at the background degree the
   model was built with (FS_BG): the app's search (ENG.freeShape, unchanged), then
   uniq-core with no extra starts, no profile and no other minimum (maxExtra 0): the app's
   own report (bodyShapeOf: linear esds, the held/free difference, angular esds by profile)
   and the best free exact fit (the reported one, or refitted from the search's free exact
   end when held). Then, at that best free fit, as methods/u-jack.mjs does it:
   the misfit flag (one 2θ segment per line position, χ²_ν per segment, the worst against
   1.25; Durbin–Watson d) and the delete-one-segment jackknife (12 iterations, every
   parameter free, the orientation free): always when FS_JACK=always, only when the flag
   fires when FS_JACK=flag (the default). The jackknife's refinements stay out of the
   search's log; model.v is left at the reported fit. info.jack has u-jack's layout. */
import { makeUniq } from './uniq-core.mjs';
import { solidOf } from '../../harness/lib.mjs';
const core = makeUniq({ name: 'u-pipe', extraStarts: false, profile: false, noiseFree: false, boot: 0, maxExtra: 0 });
const SEG = 1.25;
export default { name: 'u-pipe', search(model, k, res, free, opts, E, ctx){
  const r = core.search(model, k, res, free, opts, E, ctx);
  if (!r || !r.res || !r.info || !r.info.uniq || !r.info.uniq.minima || !r.info.uniq.minima.length) return r;
  const q = model.phases[k], type = q.shapeType, pf = q.pfx, F = E.fitSettings(opts.fit);
  const vRep = model.v.slice(), keepLog = E.FS.log; E.FS.log = null;
  const names = free.filter(n=> n !== pf + 'Ys').concat([...q.iW, ...q.iR].map(i=> model.par[i].name));
  const lmB = { maxIter: 12, shiftTol: F.shiftTol, lambda: F.lambda };
  const best = r.info.uniq.minima[0], vb = Float64Array.from(best.v);
  const ev0 = E.FS.evals, t0 = Date.now();
  const y = model.y, w0 = model.w, x = model.x, n = model.n;
  E.setParams(model, vb);
  const yc = E.evaluate(model, vb).yc;
  const ticks = E.calc(model).ticks.filter(t=> t.phase === q.id), Imax = Math.max(0, ...ticks.map(t=> t.I));
  const lo = x[0], hi = x[n - 1], pos = [];
  for (const t of ticks.filter(t=> t.I > 1e-4*Imax && t.tt > lo && t.tt < hi).sort((a, b)=> a.tt - b.tt)){
    const p = pos[pos.length - 1];
    if (p && t.tt - p.tt < 0.3){ p.hkl.push([t.h, t.k, t.l]); continue; }
    pos.push({ tt: t.tt, hkl: [[t.h, t.k, t.l]] });
  }
  const edges = [lo, ...pos.slice(1).map((p, i)=> (pos[i].tt + p.tt)/2), hi + 1e-9];
  const segOf = i => { let s = 0; while (s < pos.length - 1 && x[i] >= edges[s + 1]) s++; return s; };
  let s2 = 0, sd = 0, prevR = null;
  const seg = pos.map(p=> ({ tt: p.tt, hkl: p.hkl, chi: 0, n: 0 }));
  for (let i = 0; i < n; i++){
    if (!(w0[i] > 0)) continue;
    const rr = Math.sqrt(w0[i])*(y[i] - yc[i]); s2 += rr*rr;
    if (prevR != null) sd += (rr - prevR)**2; prevR = rr;
    const s = seg[segOf(i)]; s.chi += rr*rr; s.n++;
  }
  const segs = seg.map(s=> ({ tt: s.tt, hkl: s.hkl, n: s.n, chi2nu: s.chi/Math.max(1, s.n) }));
  const worst = Math.max(...segs.map(s=> s.chi2nu)), flag = worst > SEG;
  const out = { from: 'u-pipe', bg: model.bgDegree, chi2nu: best.chi2nu, chi: best.chi, dw: sd/s2, segs, worst, flag, drops: [] };
  const mode = process.env.FS_JACK || 'flag';
  if (mode === 'always' || (mode === 'flag' && flag)){
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
  } else out.drops = null;
  out.evals = E.FS.evals - ev0; out.ms = Date.now() - t0;
  E.setParams(model, vRep); E.FS.log = keepLog;
  r.info.jack = out;
  return r;
} };
