// The start cut after the random-stream fix, on the rows of tag symfix: symA (fixed) against
// symA0 (the first version), fwd/fwdH* (the same configuration with today's starts and the
// same turns) and, where B-verify ran it, the skeptic's symAs (should be identical to symA).
// Evaluations are the C accounting (search less the covOnly); fwdH*C = fwd less the covOnly
// and the flagged duplicate held refinements. Per run: outcome, best exact χ² (chi2Best),
// the stages that differ from fwd's, and the returned solid against fwd's (modulo the class).
// node cmp-sym.mjs [--variant symA|symC|cuts]
import fs from 'node:fs';
import path from 'node:path';
import { readResult, compareSolids, laueRotations } from './h/lib.mjs';
const a = process.argv.slice(2), opt = {};
for (let i = 0; i < a.length; i++){ if (a[i].startsWith('--')){ const k = a[i].slice(2); opt[k] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true; } }
const V = opt.variant || 'symA', V0 = V + '0';
const rd = f => readResult(fs.readFileSync(f, 'utf8'));
const find = (id, m, tags) => { for (const t of tags){ const f = `results/${t}/${id}.json`; if (!fs.existsSync(f)) continue; const o = rd(f), r = o.records.find(x=> x.method === m); if (r) return { o, r, t }; } return null; };
const evC = r => r.search.evals - (r.var.covOnly ? r.var.covOnly.ev : 0);
const out = r => r.kept ? (r.held ? 'held' : 'free') : r.rejected ? (r.early ? 'early' : 'rej') : 'none';
const ids = fs.readdirSync('results/symfix').filter(f=> f.endsWith('.json')).map(f=> f.slice(0, -5)).sort();
const OLD = { symA: ['sub2s', 'sym25'], symC: ['sub2s'], cuts: ['fullsub', 'full'] }[V];
let S = { n: 0, v: 0, v0: 0, f: 0 }, ident = 0, nAs = 0;
for (const id of ids){
  const N = find(id, V, ['symfix']); if (!N) continue;
  const O = find(id, V, OLD), F = find(id, 'fwd', ['sub1', 'full']);
  const n = N.r, o = O.r, f = F.r, rots = laueRotations(N.o.phase);
  const dupEv = (f.var.heldDup || []).reduce((t, d)=> t + (d.ev || 0), 0), fH = evC(f) - dupEv;
  const sol = (x, y) => { if (!x.solid || !y.solid) return '—'; const c = compareSolids(x.solid, y.solid, { rots }); return `${(100*Math.max(...c.dimErr.map(e=> Math.abs(e)))).toFixed(1)}%/${(c.principal ?? 0).toFixed(1)}°`; };
  // stages that differ from fwd's after the full refinements (polish onward): same turns now
  const tail = r => r.var.stages.filter(s=> s.st !== 'brief' && s.st !== 'full').map(s=> `${s.st[0]}${s.ev}`).join(' ');
  let as = '';
  const fa = `../B-verify/symAs/${id}.json`;
  if (V === 'symA' && fs.existsSync(fa)){
    nAs++;
    const s = rd(fa).records[0], same = s.search.evals === n.search.evals && s.var.stages.length === n.var.stages.length && s.var.stages.every((x, i)=> x.ev === n.var.stages[i].ev && x.chi === n.var.stages[i].chi);
    if (same) ident++;
    as = ` | symAs ${same ? 'identical' : 'DIFFERS ' + s.search.evals}`;
  }
  S.n++; S.v += evC(n); S.v0 += evC(o); S.f += fH;
  console.log(`${id.padEnd(26)} ev ${V} ${evC(n)} ${V0} ${evC(o)} fwdH*C ${fH} | ${out(n)}/${out(o)}/${out(f)} | χ²best ${n.chi2Best?.toFixed(2)} / ${o.chi2Best?.toFixed(2)} / ${f.chi2Best?.toFixed(2)} | solid vs fwd ${sol(n, f)} (${V0} ${sol(o, f)}) | after full: ${tail(n)} :: fwd ${tail(f)}${as}`);
}
console.log(`${S.n} runs: ${V} ${S.v}, ${V0} ${S.v0}, fwdH*C ${S.f}; ${V}/fwdH*C ${(S.v/S.f).toFixed(3)}, ${V0}/fwdH*C ${(S.v0/S.f).toFixed(3)}` + (nAs ? `; identical to B-verify's symAs on ${ident}/${nAs}` : ''));
