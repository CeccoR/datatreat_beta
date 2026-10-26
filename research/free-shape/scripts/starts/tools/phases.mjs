// Where a method's evaluations go: brief (mi<=8, soft), full soft rot (mi 60), exact rot (not soft), held (not rot)
import fs from 'node:fs'; import path from 'node:path';
const H = new URL('../../', import.meta.url).pathname + 'harness';
const { readResult } = await import(H + '/lib.mjs');
const dir = process.argv[2], meth = process.argv[3] || null;
const files = fs.readdirSync(dir).filter(f=> f.endsWith('.json') && f !== 'summary.json');
const acc = {}; let n = 0;
const byKind = {};
for (const f of files){
  const r = readResult(fs.readFileSync(path.join(dir, f), "utf8")); if (!r.records) continue;
  const m = r.records.find(x=> meth ? x.method === meth : x.method !== 'truth'); if (!m) continue;
  const k = r.kind; byKind[k] ??= { n: 0, ph: {} }; byKind[k].n++;
  const ph = byKind[k].ph;
  for (const e of m.log){
    const cls = e.mi <= 8 ? 'brief' : (e.soft && e.rot) ? 'fullSoft' : (!e.soft && e.rot) ? 'exactFree' : (!e.rot ? 'held' : 'other');
    ph[cls] ??= { ev: 0, cnt: 0, it: 0 }; ph[cls].ev += e.ev; ph[cls].cnt++; ph[cls].it += e.it;
  }
}
for (const k in byKind){ const { n, ph } = byKind[k]; console.log(k, n); for (const c in ph) console.log('  ', c.padEnd(10), 'evals/run', (ph[c].ev/n).toFixed(0), 'refines/run', (ph[c].cnt/n).toFixed(1), 'evals/refine', (ph[c].ev/ph[c].cnt).toFixed(0), 'iters/refine', (ph[c].it/ph[c].cnt).toFixed(1)); }
