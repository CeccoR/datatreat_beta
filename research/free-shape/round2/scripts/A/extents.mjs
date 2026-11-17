// Kept solids of today's search: thinnest, middle, longest (median, 10–90 %), axis, and the anisotropy read ÷ true, clean and error rows.
import fs from 'node:fs';
const D = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const num = x => typeof x === 'number' ? x : x === 'Infinity' ? Infinity : x === '-Infinity' ? -Infinity : NaN;
const qtl = (xs, p) => { const s = xs.filter(x=> !Number.isNaN(x)).sort((a, b)=> a - b); if (!s.length) return NaN; const i = (s.length - 1)*p, lo = Math.floor(i), hi = Math.ceil(i); return lo === hi || s[lo] === s[hi] ? s[lo] : !Number.isFinite(s[hi]) || !Number.isFinite(s[lo]) ? s[hi] : s[lo] + (s[hi] - s[lo])*(i - lo); };
const pc = x => x === Infinity ? '+∞' : Number.isNaN(x) ? '—' : (x >= 0 ? '+' : '') + (100*x).toFixed(0) + ' %';
for (const v of [...new Set(D.map(d=> d.v))]) for (const [nm, f] of [['clean', d=> d.err === 'none'], ['error', d=> d.err !== 'none']]){
  const g = D.filter(d=> d.v === v && d.solid !== 'sphere' && d.acc && d.dimT && f(d));
  const col = j => g.map(d=> num(d.dimT[j])), an = g.map(d=> (1 + num(d.dimT[2]))/(1 + num(d.dimT[0]))), ax = g.map(d=> num(d.acc.principal));
  const r3 = xs => `${pc(qtl(xs, 0.5))} (${pc(qtl(xs, 0.1))}…${pc(qtl(xs, 0.9))})`;
  console.log(`| ${v} | ${nm} | ${g.length} | ${r3(col(0))} | ${r3(col(1))} | ${r3(col(2))} | ${qtl(ax, 0.5).toFixed(1)} (${qtl(ax, 0.9).toFixed(1)}) | ${qtl(an, 0.5).toFixed(2)} (${qtl(an, 0.1).toFixed(2)}…${qtl(an, 0.9).toFixed(2)}) |`);
}
