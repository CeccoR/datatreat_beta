#!/usr/bin/env node
/* node bootcal.mjs [bootTag=boot]: the cheap intervals against the parametric bootstrap. For
   each run of results/<bootTag>/ the best minimum's spread over its R replicas (sd of ln D per
   extent, rms turn of each axis; the replicas refitted from the best, so this is the local
   spread) against what the main run claimed for the same minimum: the linear esd (Fisher,
   σ ln W), the width profile's half-width (2σ crossings, halved), the app's esd (Desd/D) and
   its angular esd. Ratios claimed/bootstrap: 1 is calibrated, above 1 conservative. */
import fs from 'node:fs';
import path from 'node:path';
import { readResult } from '../harness/lib.mjs';
import { align, fmt, median, quantile } from './ulib.mjs';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const bt = process.argv[2] || 'boot';
const sc = new Map(JSON.parse(fs.readFileSync(path.join(HERE, 'results', 'main', 'score.json'), 'utf8')).filter(r=> r.iv).map(r=> [r.run, r]));
const R = { fisher: [], prof: [], app: [], ang: [] }, rows = [];
for (const fn of fs.readdirSync(path.join(HERE, 'results', bt)).filter(f=> f.endsWith('.json')).sort()){
  const r = readResult(fs.readFileSync(path.join(HERE, 'results', bt, fn), 'utf8')); if (!r.records) continue;
  const b = r.records[0].info && r.records[0].info.boot; if (!b || !b.data[0]) continue;
  const mr = readResult(fs.readFileSync(path.join(HERE, 'results', 'main', fn), 'utf8')), u = mr.records[0].info.uniq, best = u.minima[0];
  const s = sc.get(`${r.case}#${r.seed}`); if (!s) continue;
  const rep = u.reported.solid, bestAl = align(best.solid, rep, { loose: true });
  const reps = b.fromBest.map(x=> x[0]).filter(Boolean);
  const al = reps.map(z=> align(z.solid, best.solid, { loose: true }));
  for (let i = 0; i < 3; i++){        // i: the reported solid's axis; bi: the best's
    const bi = bestAl.per[i].fi, D = best.solid.dims[bi];
    if (!Number.isFinite(D)) continue;
    const lr = al.map(a=> Math.log(a.per[bi].ratio)).filter(Number.isFinite);
    const sdB = Math.sqrt(lr.reduce((t, x)=> t + x*x, 0)/Math.max(1, lr.length));
    const ang = al.map(a=> a.per[bi].angle).filter(x=> x != null), rmsB = ang.length ? Math.sqrt(ang.reduce((t, x)=> t + x*x, 0)/ang.length) : null;
    const sF = best.sLogW[bi];
    const pq = s.iv.prof.q[i], pd = s.dims[i], hw = pq && pd && Number.isFinite(pq.d[1]) && pq.d[0] > 0 ? Math.max(Math.log(pq.d[1]/pd), Math.log(pd/pq.d[0]))/2 : Infinity;
    const aq = u.app && u.app.axes ? u.app.axes.find(x=> x.axis === i) : null;
    const g = aq && aq.group >= 0 && u.app.groups[aq.group];
    const sApp = aq ? ((g ? g.Desd : aq.Desd)/(g ? g.D : rep.dims[i])) : NaN;
    const angApp = aq && aq.own && Number.isFinite(aq.esdAngle) ? aq.esdAngle : null;
    const row = { run: `${r.case}#${r.seed}`, kind: r.kind, i, D, sdB, rmsB, sF, hw, sApp, angApp };
    rows.push(row);
    if (sdB > 0.003){ if (Number.isFinite(sF)) R.fisher.push(sF/sdB); if (Number.isFinite(hw)) R.prof.push(hw/sdB); if (Number.isFinite(sApp)) R.app.push(sApp/sdB); }
    if (rmsB != null && rmsB > 0.3 && angApp != null) R.ang.push(angApp/rmsB);
  }
}
const q = xs => xs.length ? `${xs.length} extents: median ${fmt(median(xs), 2)}, 10th ${fmt(quantile(xs, 0.1), 2)}, 90th ${fmt(quantile(xs, 0.9), 2)}; under 0.5: ${xs.filter(x=> x < 0.5).length}` : '—';
console.log(`claimed sd / the bootstrap's sd (${rows.length} extents of ${new Set(rows.map(x=> x.run)).size} runs; replicas: 20 each)`);
console.log('Fisher σ ln W     ', q(R.fisher));
console.log('profile half-width/2', q(R.prof));
console.log('app Desd/D        ', q(R.app));
console.log('app angular esd / rms turn', q(R.ang));
fs.writeFileSync(path.join(HERE, 'results', `bootcal-${bt}.json`), JSON.stringify(rows, null, 1));
