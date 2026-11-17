// Which brief (in start order: the screen's rank) ended in the final solid's morphology?
import fs from 'node:fs'; import path from 'node:path';
const { readResult, sameSolid } = await import(new URL('../../', import.meta.url).pathname + 'harness/lib.mjs');
const [tag, meth] = process.argv.slice(2), dir = path.resolve('results', tag);
const hist = {};
for (const f of fs.readdirSync(dir).filter(f=> f.endsWith('.json'))){
  const r = readResult(fs.readFileSync(path.join(dir, f), 'utf8')); if (!r.records) continue;
  const m = r.records.find(m=> m.method === meth); if (!m || !(m.solid || m.freeSolid)) continue;
  const fin = m.freeSolid || m.solid, br = m.log.filter(e=> e.mi <= 8);
  const i = br.findIndex(e=> sameSolid(e.to, fin));
  hist[r.kind] ??= {}; hist[r.kind][i] = (hist[r.kind][i] || 0) + 1;
}
console.log(meth, JSON.stringify(hist), '(index of the first brief in the final free solid\'s morphology; -1 none)');
