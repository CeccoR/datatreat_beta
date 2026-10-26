// node showlog.mjs file.json method[,method]: each refine() of the methods' searches
import fs from 'node:fs';
const { readResult } = await import(new URL('../../', import.meta.url).pathname + 'harness/lib.mjs');
const r = readResult(fs.readFileSync(process.argv[2], 'utf8')), ms = process.argv[3].split(',');
const d = s => s ? s.dims.map(x=> Number.isFinite(x) ? x.toFixed(1) : 'inf').join('x') : '';
for (const m of r.records.filter(m=> ms.includes(m.method))){ console.log(m.method, m.evals, 'evals', m.kept ? (m.held ? 'held' : 'free') : 'rej', 'chi2Best', m.chi2Best && m.chi2Best.toFixed(1));
  for (const e of m.log) console.log('  ', e.mi, e.it, e.ev, e.c.toFixed(1), e.soft ? 'soft' : 'exact', e.rot ? 'rot' : 'held', d(e.from), '->', d(e.to)); }
