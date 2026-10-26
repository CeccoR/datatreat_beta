// The pipeline at the picked background degree, run by run (results only):
//   degree 6: the app's search (u-proxies: the uniqueness main batch, the same search; v-proxies and
//             misfit cases: fix/root6) — kept solid, errors, the misfit flag (worst line segment);
//   the pick: BIC = χ²/max(1, χ²_ν of the lowest) + P ln N over the refits at degrees 6, 12, 18 from
//             the degree-6 kept solid (presentation/results/refit for u, fix/root6/presentation/results/refit
//             for the rest), as sys.mjs takes it;
//   degree 18: the app's search again with a degree-18 background (fix/root18) — kept solid, errors,
//             the flag again, the evaluations of search, report and jackknife.
// Errors: compareSolids against the truth (dims paired within the body's classes, modulo m-3m):
// the thinnest dimension's error, the largest error, the angle of the most distinct axis.
//   node pipe-sum.mjs <fs> [--set u|v|misfit] [--md out.md] [--json out.json]
import fs from 'node:fs';
import path from 'node:path';
const FS = path.resolve(process.argv[2]);
const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const SET = arg('--set') || 'u';
const R = f => fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8').replace(/\bInfinity\b/g, '1e308')) : null;
const lnN = Math.log(5384);
const ids = SET === 'u' ? Array.from({ length: 12 }, (_, i)=> 'u' + String(i + 1).padStart(2, '0'))
  : SET === 'v' ? Array.from({ length: 12 }, (_, i)=> 'v' + String(i + 1).padStart(2, '0'))
  : ['box-plate110', 'cyl-disc110', 'ell-plate110', 'sqbox-plate001'].flatMap(b=> [b + '-air', b + '-mix']);
const at6 = id => SET === 'u' ? R(path.join(FS, 'uniqueness/results/main', `${id}-1.json`)) : R(path.join(FS, 'fix/root6/uniqueness/results/main', `${id}-1.json`));
const jack6 = id => SET === 'u' ? R(path.join(FS, 'uniqueness/results/jack', `${id}-1.json`)) : at6(id);
const refit = (id, d) => R(path.join(FS, SET === 'u' ? 'presentation/results/refit' : 'fix/root6/presentation/results/refit', `${id}-1-bg${d}.json`));
const at18 = id => R(path.join(FS, 'fix/root18/uniqueness/results/main', `${id}-1.json`));
const pc = x => (100*x).toFixed(0);
const errs = m => m && m.acc ? { thin: m.acc.dimErr[m.acc.dimErr.length - 1], max: m.acc.dimMax, normal: m.acc.principal, orient: m.acc.orient } : null;
const rows = [];
for (const id of ids){
  const r6 = at6(id); if (!r6) continue;
  const m6 = r6.records[0], j6 = jack6(id), jk6 = j6 && j6.records[0].info && j6.records[0].info.jack;
  const worst6 = jk6 ? Math.max(...jk6.segs.map(s=> s.chi2nu)) : NaN;
  const vs = [6, 12, 18].map(d=> { const f = refit(id, d); if (!f || !f.keep) return null; const k = f[f.keep]; return { d, chi: k.chi, chi2nu: k.chi2nu, P: k.P, keep: f.keep, solid: k.solid, acc: f.acc, evals: f.evals }; }).filter(Boolean);
  let pick = null;
  if (vs.length){ const nu0 = Math.max(1, Math.min(...vs.map(v=> v.chi2nu))); for (const v of vs) v.bic = v.chi/nu0 + v.P*lnN; const b = Math.min(...vs.map(v=> v.bic)); vs.forEach(v=> { v.dBIC = v.bic - b; }); pick = vs.find(v=> v.dBIC === 0); }
  const r18 = at18(id), m18 = r18 && r18.records[0], jk18 = m18 && m18.info && m18.info.jack;
  rows.push({ id, truth: r6.truth, kept6: m6.kept, held6: m6.held, e6: errs(m6), worst6, flag6: worst6 > 1.25, chi2nu6: m6.chi2nu,
    pick: pick && pick.d, picks: vs.map(v=> ({ d: v.d, dBIC: v.dBIC, chi2nu: v.chi2nu, keep: v.keep, e: v.acc ? { thin: v.acc.dimErr[v.acc.dimErr.length - 1], max: v.acc.dimMax, normal: v.acc.principal } : null, evals: v.evals })),
    kept18: m18 && m18.kept, held18: m18 && m18.held, e18: errs(m18), chi2nu18: m18 && m18.chi2nu, worst18: jk18 ? jk18.worst : NaN, flag18: jk18 ? jk18.flag : null,
    cost18: m18 && m18.info && m18.info.uniq ? { search: m18.info.uniq.cost.search.evals, report: m18.info.uniq.cost.app.evals, jack: jk18 ? jk18.evals : 0, iso: r18.iso.evals } : null,
    solid18: m18 && m18.solid ? m18.solid.dims : null });
}
const L = [`| run | degree 6: kept, thin / max / normal error | worst segment χ²_ν | BIC pick (ΔBIC of 6, 12) | refit at the pick: thin / max / normal | searched at 18: kept, thin / max / normal | worst segment at 18 | evaluations at 18: search, report, jackknife |`, '|---|---|---|---|---|---|---|---|'];
const f1 = x => Number.isFinite(x) ? x.toFixed(1) : '—';
for (const r of rows){
  const e = x => x ? `${pc(x.thin)} % / ${pc(x.max)} % / ${f1(x.normal)}°` : '—';
  const pv = r.picks.find(v=> v.d === r.pick);
  L.push(`| ${r.id} | ${r.kept6 ? (r.held6 ? 'held' : 'free') : 'rejected'}, ${e(r.e6)} | ${f1(r.worst6 === r.worst6 ? r.worst6 : NaN)} | ${r.pick ?? '—'} (${r.picks.filter(v=> v.d !== 18).map(v=> v.dBIC.toFixed(0)).join(', ')}) | ${pv ? e(pv.e) : '—'} | ${r.kept18 == null ? 'not run' : (r.kept18 ? (r.held18 ? 'held' : 'free') : 'rejected') + ', ' + e(r.e18)} | ${f1(r.worst18)} | ${r.cost18 ? `${r.cost18.search}, ${r.cost18.report}, ${r.cost18.jack}` : '—'} |`);
}
const med = a => { const s = a.filter(Number.isFinite).sort((x, y)=> x - y); return s.length ? s[Math.floor((s.length - 1)/2)]/2 + s[Math.ceil((s.length - 1)/2)]/2 : NaN; };
const sum = [];
const K6 = rows.filter(r=> r.e6), K18 = rows.filter(r=> r.e18);
sum.push(`${SET}: ${rows.length} runs; degree 6: ${K6.length} kept, flag ${rows.filter(r=> r.flag6).length}; median |thin| ${pc(med(K6.map(r=> Math.abs(r.e6.thin))))} %, median max ${pc(med(K6.map(r=> r.e6.max)))} %, median normal ${f1(med(K6.map(r=> r.e6.normal)))}°, held ${K6.filter(r=> r.held6).length}`);
sum.push(`pick: ${JSON.stringify(rows.reduce((o, r)=> (o[r.pick] = (o[r.pick] || 0) + 1, o), {}))}; refit at the pick: median |thin| ${pc(med(rows.map(r=> { const v = r.picks.find(x=> x.d === r.pick); return v && v.e ? Math.abs(v.e.thin) : NaN; })))} %, median normal ${f1(med(rows.map(r=> { const v = r.picks.find(x=> x.d === r.pick); return v && v.e ? v.e.normal : NaN; })))}°`);
if (K18.length) sum.push(`degree 18 searched: ${K18.length} kept, held ${K18.filter(r=> r.held18).length}; median |thin| ${pc(med(K18.map(r=> Math.abs(r.e18.thin))))} %, max |thin| ${pc(Math.max(...K18.map(r=> Math.abs(r.e18.thin))))} %, median max ${pc(med(K18.map(r=> r.e18.max)))} %, median normal ${f1(med(K18.map(r=> r.e18.normal)))}°, max normal ${f1(Math.max(...K18.map(r=> r.e18.normal)))}°; flag at 18 ${K18.filter(r=> r.flag18).length}; worst segment ${f1(Math.min(...K18.map(r=> r.worst18)))}–${f1(Math.max(...K18.map(r=> r.worst18)))}; evaluations mean search ${Math.round(K18.reduce((t, r)=> t + r.cost18.search, 0)/K18.length)}, report ${Math.round(K18.reduce((t, r)=> t + r.cost18.report, 0)/K18.length)}, jackknife ${Math.round(K18.reduce((t, r)=> t + r.cost18.jack, 0)/K18.length)}, iso ${Math.round(K18.reduce((t, r)=> t + r.cost18.iso, 0)/K18.length)}`);
const md = sum.join('\n') + '\n\n' + L.join('\n');
console.log(md);
if (arg('--md')) fs.writeFileSync(arg('--md'), md + '\n');
if (arg('--json')) fs.writeFileSync(arg('--json'), JSON.stringify(rows, null, 1));
