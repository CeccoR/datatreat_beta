// Where each method's evaluations go, on the runs all the methods have:
// brief (maxIter ≤ 8), full and polish (rounded faces, orientation free, 60), exact free
// (exact faces, orientation free), held (orientation held); plus the widths reading and
// screen's time from the side records. node stages.mjs --tags r1 [--methods a,b] [--json f]
import fs from 'node:fs'; import path from 'node:path';
const H = new URL('../../', import.meta.url).pathname + 'harness';
const ST = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const { readResult } = await import(H + '/lib.mjs');
const a = process.argv.slice(2), opt = {};
for (let i = 0; i < a.length; i++){ if (a[i].startsWith('--')){ const k = a[i].slice(2); opt[k] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true; } }
const tags = String(opt.tags || '').split(',').filter(Boolean);
const load = d => fs.existsSync(d) ? fs.readdirSync(d).filter(f=> f.endsWith('.json') && f !== 'summary.json').map(f=> readResult(fs.readFileSync(path.join(d, f), 'utf8'))).filter(r=> r.records) : [];
const runs = [...load(path.join(H, 'results', 'baseline')), ...tags.flatMap(t=> load(path.join(ST, 'results', t)))];
const side = new Map();
for (const t of tags){ const f = path.join(ST, 'results', t, 'side.jsonl'); if (!fs.existsSync(f)) continue;
  for (const l of fs.readFileSync(f, 'utf8').trim().split('\n')){ try { const s = JSON.parse(l); side.set(`${s.method}|${s.case}|${s.seed}`, s); } catch(e){} } }
const recs = new Map();
for (const r of runs) for (const m of r.records){ if (m.method === 'truth') continue; if (!recs.has(m.method)) recs.set(m.method, new Map()); recs.get(m.method).set(`${r.case}|${r.seed}`, { r, m }); }
const methods = (opt.methods ? String(opt.methods).split(',') : [...recs.keys()]).filter(m=> recs.has(m));
const common = [...recs.get(methods[0]).keys()].filter(k=> methods.every(m=> recs.get(m).has(k)) && (!opt.kinds || String(opt.kinds).split(',').includes(recs.get(methods[0]).get(k).r.kind)));
const out = {};
for (const meth of methods){
  const S = { brief: 0, full: 0, exact: 0, held: 0, nBrief: 0, nFull: 0, nExact: 0, nHeld: 0, msWidths: 0, msScreen: 0, evWidths: 0, nSide: 0, evals: 0, ms: 0 };
  for (const k of common){
    const { m } = recs.get(meth).get(k);
    S.evals += m.evals; S.ms += m.ms;
    for (const e of m.log || []){
      const c = e.mi <= 8 ? 'brief' : (e.soft && e.rot) ? 'full' : e.rot ? 'exact' : 'held';
      S[c] += e.ev || 0; S['n' + c[0].toUpperCase() + c.slice(1)]++;
    }
    const s = side.get(`${meth}|${k}`);
    if (s){ S.msWidths += s.msWidths || 0; S.msScreen += s.msScreen || 0; S.evWidths += s.evWidths || 0; S.nSide++; }
  }
  const n = common.length;
  out[meth] = Object.fromEntries(Object.entries(S).map(([k, v])=> [k, k === 'nSide' ? v : /^(msWidths|msScreen|evWidths)$/.test(k) ? (S.nSide ? v/S.nSide : 0) : v/n]));
  out[meth].runs = n;
}
console.log(`${common.length} runs common to ${methods.join(', ')}`);
console.log('| method | evals | brief (n) | full+polish (n) | exact free (n) | held (n) | widths reading: ms, partial evals | screen ms |'); console.log('|---|---|---|---|---|---|---|---|');
const f = (x, d = 0) => Number.isFinite(x) ? x.toFixed(d) : '—';
for (const m of methods){ const o = out[m]; console.log(`| ${m} | ${f(o.evals)} | ${f(o.brief)} (${f(o.nBrief, 1)}) | ${f(o.full)} (${f(o.nFull, 1)}) | ${f(o.exact)} (${f(o.nExact, 1)}) | ${f(o.held)} (${f(o.nHeld, 1)}) | ${o.nSide ? f(o.msWidths) + ', ' + f(o.evWidths) : '—'} | ${o.nSide ? f(o.msScreen) : '—'} |`); }
if (opt.json) fs.writeFileSync(opt.json, JSON.stringify(out, null, 1));
