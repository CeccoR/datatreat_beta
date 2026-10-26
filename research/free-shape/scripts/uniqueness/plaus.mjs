// how many other minima per run lie within the calibrated 5 % flip range (Δ ≤ D5) and within Δ 10, after merging by resolution
import fs from 'node:fs';
import { pFlip, median } from './ulib.mjs';
const S = JSON.parse(fs.readFileSync(new URL('./results/score10/score.json', import.meta.url), 'utf8')).filter(r=> r.iv);
for (const kind of ['synth', 'sample']){
  const K = S.filter(r=> r.kind === kind);
  const n5 = K.map(r=> r.others.filter(o=> pFlip(o.D, 8) >= 0.05).length), n10 = K.map(r=> r.others.filter(o=> o.D <= 10).length), n30 = K.map(r=> r.others.length);
  const far = K.map(r=> r.others.filter(o=> pFlip(o.D, 8) >= 0.05 && (o.maxRatio > Math.log(1.25) || o.worst > 10)).length);
  console.log(kind, K.length, 'runs; other minima within flip 5 %:', n5.reduce((a, b)=> a + b, 0), 'runs with ≥1:', n5.filter(x=> x > 0).length, '; within Δ 10:', n10.reduce((a, b)=> a + b, 0), '; within Δ 30 (all kept):', n30.reduce((a, b)=> a + b, 0), '; plausible and farther than 25 % or 10°:', far.reduce((a, b)=> a + b, 0), 'in', far.filter(x=> x > 0).length, 'runs');
}
