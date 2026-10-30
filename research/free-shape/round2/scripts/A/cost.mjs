// Cost per run by Laue class and variant, from an analyse.mjs --json digest: mean search, report and
// isotropic-fit seconds, search evaluations, and the median ms per search evaluation; the sum over the set.
// node cost.mjs results/screen-final-digest.json
import fs from 'node:fs';
const D = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).filter(d=> !d.missing && d.out);
const V = [...new Set(D.map(d=> d.v))], LAUE = ['-1', '2/m', 'mmm', '4/m', '4/mmm', '-3', '-3m', '6/m', '6/mmm', 'm-3', 'm-3m'];
const mean = xs => xs.reduce((t, x)=> t + x, 0)/xs.length, med = xs => { const s = xs.slice().sort((a, b)=> a - b); return s[(s.length - 1) >> 1]; };
const tot = d => (d.sMs + d.rMs + d.iso.ms)/1000;
console.log(`| class | runs | ${V.map(v=> v + ': s/run (search ev, ms/ev)').join(' | ')} |`);
console.log('|---|---|' + V.map(()=> '---|').join(''));
for (const l of [...LAUE, 'all']){
  const g = v => D.filter(d=> d.v === v && (l === 'all' || d.laue === l));
  console.log(`| ${l} | ${g(V[0]).length} | ${V.map(v=> `${mean(g(v).map(tot)).toFixed(0)} (${mean(g(v).map(d=> d.sEv)).toFixed(0)}, ${med(g(v).map(d=> d.msEv)).toFixed(1)})`).join(' | ')} |`);
}
console.log('\nSum over the set (runs\' own time, min): ' + V.map(v=> `${v} ${(D.filter(d=> d.v === v).reduce((t, d)=> t + tot(d), 0)/60).toFixed(0)}`).join(', '));
