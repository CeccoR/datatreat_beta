// By solid, class, error: today's search (kept solids) and the truth reference, per variant, from analyse.mjs --json digests.
import fs from 'node:fs';
const files = process.argv.slice(2);
const num = x => typeof x === 'number' ? x : x === 'Infinity' ? Infinity : x === '-Infinity' ? -Infinity : NaN;
const qtl = (xs, p) => { const s = xs.filter(x=> !Number.isNaN(x)).sort((a, b)=> a - b); if (!s.length) return NaN; const i = (s.length - 1)*p, lo = Math.floor(i), hi = Math.ceil(i); return lo === hi || s[lo] === s[hi] ? s[lo] : !Number.isFinite(s[hi]) || !Number.isFinite(s[lo]) ? s[hi] : s[lo] + (s[hi] - s[lo])*(i - lo); };
const pc = x => x === Infinity ? '+∞' : Number.isNaN(x) ? '—' : (x >= 0 ? '+' : '') + (100*x).toFixed(0) + ' %';
const D = files.flatMap(f=> JSON.parse(fs.readFileSync(f, 'utf8')));
const V = [...new Set(D.map(d=> d.v))];
const groups = { solid: ['box', 'sqbox', 'cylinder', 'ellcyl', 'ellipsoid', 'spheroid'], laue: ['-1', '2/m', 'mmm', '4/m', '4/mmm', '-3', '-3m', '6/m', '6/mmm', 'm-3', 'm-3m'], err: ['none', 'hump', 'sizedist', 'impurity', 'air', 'po'] };
for (const [key, ks] of Object.entries(groups)){
  console.log(`\n| ${key} | ` + V.map(v=> `${v}: kept/runs, worst, thinnest, axis °`).join(' | ') + ' |');
  console.log('|---|' + V.map(()=> '---|').join(''));
  for (const k of ks){
    const cells = V.map(v=> {
      const g = D.filter(d=> d.v === v && d.solid !== 'sphere' && d[key] === k && d.out); if (!g.length) return '—';
      const kept = g.filter(d=> d.acc);
      const w = kept.map(d=> num(d.acc.dimMax)), t = kept.map(d=> num(d.dimT ? d.dimT[0] : NaN)), a = kept.map(d=> num(d.acc.principal));
      return `${kept.length}/${g.length}, ${pc(qtl(w, 0.5))}, ${pc(qtl(t, 0.5))}, ${qtl(a, 0.5).toFixed(1)}`;
    });
    console.log(`| ${k} | ${cells.join(' | ')} |`);
  }
}
