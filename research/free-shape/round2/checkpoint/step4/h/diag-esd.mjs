// step 4 diagnostic: today's esds against the truth on step 3's P1 clean kept truths (z per extent)
import fs from 'node:fs';
import path from 'node:path';
import { readResult, compareSolids, laueRotations } from './lib.mjs';
const FS2 = path.resolve('../..');
const design = JSON.parse(fs.readFileSync(path.join(FS2, 'design', 'design.json'), 'utf8'));
const ONE = new Set(['cylinder', 'spheroid', 'sqbox']);
const out = [];
for (const row of design.rows.filter(r=> r.split === 'tuning' && r.screen)){
  const fn = path.join(FS2, 'step3/hp/results/P1', row.id + '.json'); if (!fs.existsSync(fn)) continue;
  const o = readResult(fs.readFileSync(fn, 'utf8')), r = o.records[0];
  if (!r.kept || !o.truth || row.error) continue;
  const T = o.truth, acc = compareSolids(r.solid, T, { rots: laueRotations(o.phase) }), rep = r.report, nW = rep.dims.length;
  const slot = i => nW === 2 ? (i === 2 ? 1 : 0) : i;
  for (const [ri, fi] of acc.pairs){
    if (ONE.has(T.type) && ri === 1) continue;
    const d = rep.dims[slot(fi)], D = r.solid.dims[fi], Dt = T.dims[ri];
    const g = rep.groups && rep.groups.find(g=> g.axes.includes(slot(fi)));
    const s = Number.isFinite(d.Desd) ? d.Desd/D : g ? g.Desd/g.D : NaN;
    out.push({ id: row.id, held: r.held, D: +D.toFixed(2), Dt: +Dt.toFixed(2), e: +Math.log(D/Dt).toFixed(4), s: +s.toFixed(4), z: +(Math.log(D/Dt)/s).toFixed(2), grp: !!g, chi2nu: +r.chi2nu.toFixed(3) });
  }
}
out.sort((a, b)=> Math.abs(b.z) - Math.abs(a.z));
for (const x of out) console.log(JSON.stringify(x));
const zs = out.map(x=> Math.abs(x.z)).filter(Number.isFinite);
console.log('n', out.length, 'covered |z|<=2', zs.filter(z=> z <= 2).length, 'z<=3', zs.filter(z=> z <= 3).length, 'rms z (|z|<10)', Math.sqrt(zs.filter(z=> z < 10).reduce((t, z)=> t + z*z, 0)/zs.filter(z=> z < 10).length).toFixed(2));
