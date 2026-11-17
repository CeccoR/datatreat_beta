import fs from 'node:fs';
const D = JSON.parse(fs.readFileSync('results/screen-final-digest.json', 'utf8'));
const num = x => typeof x === 'number' ? x : x === 'Infinity' ? Infinity : NaN;
for (const v of ['lor', 'lsq', 'wppm']){
  const g = D.filter(d=> d.v === v && d.solid !== 'sphere' && d.err === 'none' && d.dimT && d.acc);
  const r = g.map(d=> (1 + num(d.dimT[2]))/(1 + num(d.dimT[0])));
  const s = r.slice().sort((a, b)=> a - b), lnm = r.map(x=> Math.abs(Math.log(x))).sort((a, b)=> a - b);
  console.log(v, 'kept clean', g.length, 'median', s[(s.length - 1) >> 1].toFixed(2), 'median|ln|', lnm[(lnm.length - 1) >> 1].toFixed(3), 'outside', r.filter(x=> x < 0.9 || x > 1.1).length, 'range', s[0].toFixed(2), s[s.length - 1].toFixed(2));
}
