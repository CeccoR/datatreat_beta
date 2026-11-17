// The best brief χ²_ν of a method (the pattern's misfit once a shape is in), by set
import fs from 'node:fs'; import path from 'node:path';
const { readResult } = await import(new URL('../../', import.meta.url).pathname + 'harness/lib.mjs');
const [tag, meth] = process.argv.slice(2), dir = path.resolve('results', tag), by = {};
for (const f of fs.readdirSync(dir).filter(f=> f.endsWith('.json'))){
  const r = readResult(fs.readFileSync(path.join(dir, f), 'utf8')); if (!r.records) continue;
  const m = r.records.find(m=> m.method === meth); const br = m.log.filter(e=> e.mi <= 8); if (!br.length) continue;
  const nu = Math.min(...br.map(e=> e.c))/(r.iso.N - r.iso.P - 5);
  (by[r.kind] ??= []).push([r.case + '#' + r.seed, nu]);
}
for (const k in by){ const v = by[k].sort((a, b)=> a[1] - b[1]); console.log(k, v.map(x=> x[0] + ' ' + x[1].toFixed(3)).join(', ')); }
