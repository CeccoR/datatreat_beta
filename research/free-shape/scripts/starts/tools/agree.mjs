// Do a method's brief ends agree? Per run: the brief ends within Δ (in χ²_ν of the iso fit's
// floor 1) of the best brief, grouped by sameSolid (8°, e^0.25, or given) → number of
// morphologies; against whether the method reached (Δ ≤ 1 vs the best any record found).
import fs from 'node:fs'; import path from 'node:path';
const H = new URL('../../', import.meta.url).pathname + 'harness';
const { readResult, sameSolid } = await import(H + '/lib.mjs');
const [tag, meth, nb = '3', within = '10', deg = '8', ratio = '0.25'] = process.argv.slice(2);
const dir = path.resolve('results', tag);
const all = fs.readdirSync(dir).filter(f=> f.endsWith('.json') && f !== 'summary.json').map(f=> readResult(fs.readFileSync(path.join(dir, f), 'utf8'))).filter(r=> r.records);
const base = new Map(fs.readdirSync(H + '/results/baseline').filter(f=> f.endsWith('.json') && f !== 'summary.json').map(f=> readResult(fs.readFileSync(H + '/results/baseline/' + f, 'utf8'))).filter(r=> r.records).map(r=> [r.case + '|' + r.seed, r]));
const tab = {};
for (const r of all){
  const m = r.records.find(m=> m.method === meth); if (!m) continue;
  const bestC = Math.min(...[...r.records, ...(base.get(r.case + '|' + r.seed) || { records: [] }).records].map(x=> x.chi2Best).filter(Number.isFinite));
  const nu = Math.max(1, r.iso.chi2nu);
  const br = m.log.filter(e=> e.mi <= 8).slice(0, +nb);
  if (!br.length) continue;
  const b0 = Math.min(...br.map(e=> e.c));
  const g = [];
  for (const e of br.filter(e=> (e.c - b0)/nu <= +within).sort((x, y)=> x.c - y.c)) if (!g.some(s=> sameSolid(e.to, s, { deg: +deg, ratio: Math.exp(+ratio) - 1 }))) g.push(e.to);
  const reached = Number.isFinite(m.chi2Best) ? (m.chi2Best - bestC)/Math.max(1, bestC/(r.iso.N - r.iso.P)) <= 1 : null;
  const k = r.kind + ' ' + (g.length > 1 ? 'disagree' : 'agree');
  tab[k] ??= { n: 0, reached: 0, judged: 0, ids: [] }; tab[k].n++; if (reached != null){ tab[k].judged++; if (reached) tab[k].reached++; else tab[k].ids.push(r.case + '#' + r.seed); }
}
for (const k of Object.keys(tab).sort()) console.log(k.padEnd(20), 'runs', tab[k].n, 'reached', tab[k].reached + '/' + tab[k].judged, tab[k].ids.join(' '));
