// Which near-equivalent morphologies each method's refinement ends reach.
// node coverage.mjs --tags r1 [--methods a,b] [--within 10]
// Per run (case, seed), every refine() end of every method (the baseline's too) with χ²
// within `within`·χ²_ν of the best exact χ² any record found is grouped into morphologies
// (lib sameSolid: 8°, e^0.25, greedy from the lowest χ²). Brief ends have rounded faces:
// their χ² is approximate (within ~1 % in widths), as in the harness's ends.mjs. Per
// method: the mean number of morphologies its ends reach, and the share of the union.
import fs from 'node:fs'; import path from 'node:path';
const H = new URL('../../', import.meta.url).pathname + 'harness';
const ST = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const { readResult, sameSolid } = await import(H + '/lib.mjs');
const a = process.argv.slice(2), opt = {};
for (let i = 0; i < a.length; i++){ if (a[i].startsWith('--')){ const k = a[i].slice(2); opt[k] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true; } }
const within = +(opt.within || 10);
const load = d => fs.existsSync(d) ? fs.readdirSync(d).filter(f=> f.endsWith('.json') && f !== 'summary.json').map(f=> readResult(fs.readFileSync(path.join(d, f), 'utf8'))).filter(r=> r.records) : [];
const tags = String(opt.tags || '').split(',').filter(Boolean);
const byRun = new Map();
for (const r of [...load(path.join(H, 'results', 'baseline')), ...tags.flatMap(t=> load(path.join(ST, 'results', t)))]){
  const k = `${r.case}|${r.seed}`; if (!byRun.has(k)) byRun.set(k, []); byRun.get(k).push(r);
}
let methods = opt.methods ? String(opt.methods).split(',') : null;
const stat = {};
let nRuns = 0, unionTot = 0, multi = 0;
for (const [k, rs] of byRun){
  const recs = rs.flatMap(r=> r.records.map(m=> ({ r, m }))).filter(x=> x.m.method !== 'truth');
  if (opt.kinds && !String(opt.kinds).split(',').includes(rs[0].kind)) continue;
  const ms = methods || [...new Set(recs.map(x=> x.m.method))];
  if (!ms.every(m=> recs.some(x=> x.m.method === m))) continue;
  const bestC = Math.min(...rs.flatMap(r=> r.records.map(m=> m.chi2Best)).filter(Number.isFinite));
  if (!Number.isFinite(bestC)) continue;
  const r0 = rs[0], nu = Math.max(1, bestC/Math.max(1, r0.iso.N - r0.iso.P));
  const ends = recs.filter(x=> ms.includes(x.m.method)).flatMap(x=> (x.m.log || []).filter(e=> e.to && Number.isFinite(e.c) && (e.c - bestC)/nu <= within).map(e=> ({ c: e.c, s: e.to, by: x.m.method }))).sort((p, q)=> p.c - q.c);
  const groups = [];
  for (const e of ends){ const g = groups.find(g=> sameSolid(e.s, g.s)); if (g) g.by.add(e.by); else groups.push({ s: e.s, c: e.c, by: new Set([e.by]) }); }
  nRuns++; unionTot += groups.length; if (groups.length > 1) multi++;
  for (const m of ms){ stat[m] ??= { found: 0, share: 0 }; const f = groups.filter(g=> g.by.has(m)).length; stat[m].found += f; stat[m].share += groups.length ? f/groups.length : 1; }
}
console.log(`${nRuns} runs; morphologies within Δ ${within} (union of all methods' ends): ${(unionTot/nRuns).toFixed(2)} a run, ${multi} runs with more than one`);
console.log('| method | morphologies reached a run | share of the union |'); console.log('|---|---|---|');
for (const m in stat) console.log(`| ${m} | ${(stat[m].found/nRuns).toFixed(2)} | ${(100*stat[m].share/nRuns).toFixed(0)} % |`);
