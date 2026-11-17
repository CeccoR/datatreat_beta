import fs from 'node:fs';
const [f, ...nms] = process.argv.slice(2);
const o = JSON.parse(fs.readFileSync(f));
const F = (x, d = 2) => x == null ? '∞' : typeof x === 'number' ? x.toFixed(d) : x;
for (const r of o.per) for (const nm of nms){
  const s = r.sc[nm]; if (!s || !s.dims) continue;
  const bad = [...Object.entries(s.dims).filter(([, d])=> !d.cov).map(([k, d])=> `${k} ${F(d.truth)} est ${F(d.est)} [${F(d.lo)}, ${F(d.hi)}]`),
    ...Object.entries(s.ang).filter(([, d])=> d.claimed && !d.cov).map(([k, d])=> `${k} ${F(d.angle, 1)}° > ${F(d.cone, 1)}°`)];
  if (bad.length) console.log(`${r.id}-${r.seed} ${nm} held ${r.held}: ${bad.join('; ')}`);
}
