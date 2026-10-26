/* The parametric bootstrap from the minima a previous run found (results/<UBOOT_FROM,
   main>/<case>-<seed>.json: uniq.minima, their whole vectors), without the search: the
   model handed over is the same isotropic fit (the pattern and autoRefine are
   deterministic), so each minimum's vector is set as it was. R replicas (UBOOT_R, 20) of the
   best (Poisson on its y_c, weights as buildModel's), every minimum within 30 χ²_ν (at most
   4 besides the best) refitted from its own vector, exact, its orientation free (12
   iterations, one FCJ pass); and from each competitor j's own y_c, R/2 replicas, the best
   and j refitted (does the best win when j is the truth?). Returns the best's vector as a
   free result (the record's accuracy is not the point here). */
import fs from 'node:fs';
import path from 'node:path';
import { solidOf, poisson, rng, readResult } from '../../harness/lib.mjs';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const FROM = process.env.UBOOT_FROM || 'main', R = +(process.env.UBOOT_R || 20), RJ = +(process.env.UBOOT_RJ || 10);
export default { name: 'u-boot', search(model, k, res, free, opts, E, ctx){
  const f = path.join(HERE, '..', 'results', FROM, `${ctx.case.id}-${ctx.seed}.json`);
  if (!fs.existsSync(f)) return null;
  const prev = readResult(fs.readFileSync(f, 'utf8')), u = prev.records[0].info && prev.records[0].info.uniq;
  if (!u || !u.minima || u.minima.length < 2) return null;
  const q = model.phases[k], type = q.shapeType, pf = q.pfx, F = E.fitSettings(opts.fit);
  const names = free.filter(n=> n !== pf + 'Ys').concat([...q.iW, ...q.iR].map(i=> model.par[i].name));
  const nu0 = u.nu0, c0 = u.minima[0].chi;
  const comps = u.minima.filter(x=> (x.chi - c0)/nu0 <= 30).slice(0, 5);
  const lmB = { maxIter: 12, shiftTol: F.shiftTol, lambda: F.lambda };
  const chiTot = rr => rr.stats.chi2*Math.max(1, rr.stats.N - rr.stats.P);
  const fit = v => { E.setParams(model, Float64Array.from(v)); try { const rr = E.refine(model, { free: names, ...lmB, audit: false }); return { chi: chiTot(rr), chi2nu: rr.stats.chi2, solid: solidOf(q, type, model.v), it: rr.iterations }; } catch(e){ return null; } };
  const y0 = model.y, w0 = model.w, n = model.n, U = rng(0xb007 + 7919*ctx.seed + ctx.case.id.length*131).u;
  const muOf = v => { E.setParams(model, Float64Array.from(v)); return Float64Array.from(E.evaluate(model, model.v).yc); };
  const draw = (mu, noise) => { const Y = new Float64Array(n), W = new Float64Array(n);
    for (let i = 0; i < n; i++){ if (w0[i] > 0){ const m = Math.max(mu[i], 0), c = noise ? poisson(m, U) : m; Y[i] = noise ? c + Math.min(c, 1) : c; W[i] = 1/(c + 1); } }
    model.y = Y; model.w = W; };
  // the data's own χ² of each minimum, refitted as the replicas are (12 iterations, one pass)
  const out = { from: FROM, comps: comps.map(x=> u.minima.indexOf(x)), R, RJ, data: null, fromBest: [], fromComp: [] };
  const ev0 = E.FS.evals, t0 = Date.now();
  try {
    out.data = comps.map(x=> fit(x.v));
    const mu0 = muOf(comps[0].v);
    draw(mu0, false); out.free0 = comps.map(x=> fit(x.v));
    for (let b = 0; b < R; b++){ draw(mu0, true); out.fromBest.push(comps.map(x=> fit(x.v))); }
    for (let j = 1; j < comps.length; j++){
      const muj = muOf(comps[j].v), rows = [];
      draw(muj, false); const fr = [fit(comps[0].v), fit(comps[j].v)];
      for (let b = 0; b < RJ; b++){ draw(muj, true); rows.push([fit(comps[0].v), fit(comps[j].v)]); }
      out.fromComp.push({ j, free: fr, rows });
    }
  } finally { model.y = y0; model.w = w0; }
  out.evals = E.FS.evals - ev0; out.ms = Date.now() - t0;
  E.setParams(model, Float64Array.from(comps[0].v));
  const st = E.evaluate(model, model.v);
  return { res: { stats: { chi2: st.chi2/Math.max(1, res.stats.N - res.stats.P), N: res.stats.N, P: res.stats.P }, free: names }, info: { type, boot: out } };
} };
