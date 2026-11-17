#!/usr/bin/env node
/* score.mjs: step 1's tables, one size line at a time, scored as the pilot and AB.md score.
   node score.mjs --line lsq|wppm --v today=<dir>,v2a=<dir>,... --best <dir>,<dir>,... [--out file.md] [--json file.json]
   Paths relative to this folder. The first variant is the reference (today's search on the
   same line: track A's records); each record's 'today' method is read.
   - outcome (held / free / rejected, early apart) and its changes against the reference;
   - reach: Δ = (the variant's best exact χ² − the best known)/max(1, χ²_ν of the best known) ≤ 1,
     the best known the lowest exact χ² (chi2Best) of every record on this line in --best (every
     method: today's, the truth reference, the variants, the cross-solid fit of the row's own
     solid); judged on truths, not on early rejections (round 1's rule);
   - the returned fit's χ² against the reference's, in χ²_ν of the reference's fit; the solid
     changed (an extent by more than 5 % or the axis by more than 2°, modulo the class);
   - accuracy of the kept truths (A's rules: worst |extent error|, +∞ unbounded; the thinnest
     extent's signed error; the truth's most distinct axis); anisotropy longest/thinnest read
     ÷ true on the clean rows every variant kept;
   - spheres kept;
   - cost: search evaluations (sum, ratio, per run median), CPU of the fit (iso + search +
     report, out.cpu) and the walls, where the records have them, per Laue class. */
import fs from 'node:fs';
import path from 'node:path';
import { readResult, compareSolids, laueRotations } from './lib.mjs';
const HERE = path.dirname(new URL(import.meta.url).pathname), FS2 = path.resolve(HERE, '..', '..');
const a = process.argv.slice(2), opt = {};
for (let i = 0; i < a.length; i++){ if (a[i].startsWith('--')){ opt[a[i].slice(2)] = a[i + 1]; i++; } }
const design = JSON.parse(fs.readFileSync(path.join(FS2, 'design', 'design.json'), 'utf8'));
const rows = design.rows.filter(r=> r.screen && r.split !== 'validation');
const V = opt.v.split(',').map(s=> { const [name, d] = s.split('='); return { name, dir: path.resolve(HERE, d) }; });
const bestDirs = (opt.best || '').split(',').filter(Boolean).map(d=> path.resolve(HERE, d));
const rd = f => fs.existsSync(f) ? readResult(fs.readFileSync(f, 'utf8')) : null;
const outc = r => !r ? null : r.error ? 'error' : r.kept ? (r.held ? 'held' : 'free') : r.rejected ? (r.early ? 'early' : 'rejected') : 'none';
const num = x => typeof x === 'number' && !Number.isNaN(x);
const qtl = (xs, p) => { const s = xs.filter(num).sort((x, y)=> x - y); if (!s.length) return NaN; const i = (s.length - 1)*p, lo = Math.floor(i), hi = Math.ceil(i); return lo === hi || s[lo] === s[hi] ? s[lo] : !Number.isFinite(s[hi]) || !Number.isFinite(s[lo]) ? (i - lo < 1e-12 ? s[lo] : s[hi]) : s[lo] + (s[hi] - s[lo])*(i - lo); };
const med = xs => qtl(xs, 0.5);
const sum = xs => xs.reduce((t, x)=> t + x, 0);
const f = (x, d = 1) => x === Infinity ? '∞' : x == null || !Number.isFinite(x) ? '—' : x.toFixed(d);
const pc = (x, d = 0) => x === Infinity ? '+∞' : x == null || !Number.isFinite(x) ? '—' : (x >= 0 ? '+' : '') + (100*x).toFixed(d) + ' %';
// the best known exact χ² of each row on this line, over every record
const best = {};
for (const d of bestDirs){
  if (!fs.existsSync(d)) continue;
  for (const fn of fs.readdirSync(d).filter(x=> x.endsWith('.json'))){
    const parts = fn.slice(0, -5).split('.'), id = parts[0], row = rows.find(r=> r.id === id);
    if (!row) continue;
    if (parts[1] && parts[1] !== row.search) continue;   // a cross-solid fit of another solid
    const o = rd(path.join(d, fn));
    for (const r of o.records){
      if (r.method !== 'today' && r.method !== 'truth') continue;
      if (!Number.isFinite(r.chi2Best)) continue;
      if (!best[id] || r.chi2Best < best[id].chi2) best[id] = { chi2: r.chi2Best, P: r.P, N: o.iso.N, from: path.basename(d) + ':' + r.method };
    }
  }
}
const D = {};
for (const v of V) for (const row of rows){
  const o = rd(path.join(v.dir, row.id + '.json'));
  if (!o){ (D[v.name] ||= {})[row.id] = null; continue; }
  const r = o.records.find(x=> x.method === 'today');
  const ord = [0, 1, 2].sort((p, q)=> row.dims ? row.dims[p] - row.dims[q] : 0);
  const d = { id: row.id, laue: o.laue, kind: row.kind, err: row.error ? row.error.kind : 'none', out: outc(r), r, o,
    ev: r.search.evals, sMs: r.search.ms, rMs: r.report ? r.report.ms : 0, rEv: r.report ? r.report.evals : 0, isoMs: o.iso.ms, isoEv: o.iso.evals, cpu: o.cpu ? o.cpu.fitMs : null };
  const b = best[row.id];
  if (row.kind === 'truth' && d.out !== 'early' && Number.isFinite(r.chi2Best) && b) d.delta = (r.chi2Best - b.chi2)/Math.max(1, b.chi2/Math.max(1, b.N - b.P));
  if (row.kind === 'truth' && r.acc){ d.dim = ord.map(i=> r.acc.dimErr[i]); d.worst = r.acc.dimMax; d.thin = d.dim[0]; d.axis = r.acc.principal; d.aniso = (1 + d.dim[2])/(1 + d.dim[0]); }
  (D[v.name] ||= {})[row.id] = d;
}
const R0 = V[0].name, L = [];
const truths = rows.filter(r=> r.kind === 'truth'), spheres = rows.filter(r=> r.kind === 'sphere');
const kept = x => x && (x.out === 'held' || x.out === 'free');
// 1. overall
L.push(`## ${opt.line}: the 77 screening runs`, '', `Reference: ${R0}. Reach against the best known exact χ² of each run over every record on this line (${bestDirs.map(d=> '$W/' + path.relative(path.resolve(FS2, '..'), d)).join(', ')}).`, '');
L.push('| variant | runs | held / free / rejected (early) | outcome ≠ ' + R0 + ' | reached / judged | unbounded | worst (90 %) | thinnest | axis ° (90 %) | spheres kept | search evaluations | × ' + R0 + ' (per run median) |', '|---|---|---|---|---|---|---|---|---|---|---|---|');
const evRef = sum(rows.map(r=> D[R0][r.id] ? D[R0][r.id].ev : 0));
for (const v of V){
  const g = truths.map(r=> D[v.name][r.id]).filter(Boolean), ks = g.filter(d=> d.worst != null), j = g.filter(d=> num(d.delta));
  const all = rows.map(r=> D[v.name][r.id]).filter(Boolean), ev = sum(all.map(d=> d.ev));
  const chg = rows.filter(r=> D[v.name][r.id] && D[R0][r.id] && D[v.name][r.id].out !== D[R0][r.id].out).length;
  const ratio = rows.filter(r=> D[v.name][r.id] && D[R0][r.id]).map(r=> D[v.name][r.id].ev/D[R0][r.id].ev);
  L.push(`| ${v.name} | ${all.length} | ${g.filter(d=> d.out === 'held').length} / ${g.filter(d=> d.out === 'free').length} / ${g.filter(d=> d.out === 'rejected' || d.out === 'early').length} (${g.filter(d=> d.out === 'early').length}) | ${chg} | ${j.filter(d=> d.delta <= 1).length} / ${j.length} | ${ks.filter(d=> d.worst === Infinity).length} | ${pc(med(ks.map(d=> d.worst)))} (${pc(qtl(ks.map(d=> d.worst), 0.9))}) | ${pc(med(ks.map(d=> d.thin)))} | ${f(med(ks.map(d=> d.axis)))} (${f(qtl(ks.map(d=> d.axis), 0.9))}) | ${spheres.filter(r=> kept(D[v.name][r.id])).length} / ${spheres.filter(r=> D[v.name][r.id]).length} | ${ev} | ${f(ev/evRef, 3)} (${f(med(ratio), 3)}) |`);
}
L.push('');
// 2. anisotropy, clean rows every variant kept
const clean = truths.filter(r=> !r.error && V.every(v=> D[v.name][r.id] && D[v.name][r.id].aniso != null));
L.push(`Anisotropy (longest/thinnest read ÷ true) on the ${clean.length} clean truths every variant kept: median, median |ln|, rows outside 0.9–1.1:`, '');
for (const v of V){ const x = clean.map(r=> D[v.name][r.id].aniso); L.push(`- ${v.name}: ${f(med(x), 2)}, ${f(med(x.map(y=> Math.abs(Math.log(y)))), 2)}, ${x.filter(y=> y < 0.9 || y > 1.1).length}`); }
L.push('');
// 3. against the reference, row by row
for (const v of V.slice(1)){
  const ch = [], lost = [], gained = [], up = [], down = [], within = [], solid = [];
  for (const r of rows){
    const x = D[v.name][r.id], y = D[R0][r.id];
    if (!x || !y) continue;
    if (x.out !== y.out) ch.push(`${r.id} ${y.out} → ${x.out}`);
    if (num(x.delta) && num(y.delta)){ if (y.delta <= 1 && x.delta > 1) lost.push(`${r.id} (Δ ${f(y.delta, 2)} → ${f(x.delta, 1)})`); if (y.delta > 1 && x.delta <= 1) gained.push(`${r.id} (Δ ${f(y.delta, 1)} → ${f(x.delta, 2)})`); }
    if (kept(x) && kept(y)){
      const dc = (x.r.chi2 - y.r.chi2)/Math.max(1, y.r.chi2nu);
      if (Math.abs(dc) <= 0.1) within.push(r.id); else if (dc < 0) down.push(`${r.id} ${f(dc, 2)}`); else up.push(`${r.id} +${f(dc, 2)}`);
      const c = compareSolids(x.r.solid, y.r.solid, { rots: laueRotations(x.o.phase) });
      const nInf = s => s.dims.filter(d=> d === Infinity).length, bothInf = nInf(x.r.solid) > 0 && nInf(x.r.solid) === nInf(y.r.solid);
      if (c.dimErr.some(e=> Number.isNaN(e) ? !bothInf : !(Math.abs(e) <= 0.05)) || (c.orient != null && c.orient > 2)) solid.push(`${r.id} (extents ${c.dimErr.map(e=> pc(e)).join(', ')}; ${c.orient == null ? '—' : f(c.orient) + '°'})`);
    }
  }
  L.push(`**${v.name} against ${R0}.** Outcome changed on ${ch.length}${ch.length ? ': ' + ch.join('; ') : ''}. Reach lost on ${lost.length}${lost.length ? ': ' + lost.join('; ') : ''}; gained on ${gained.length}${gained.length ? ': ' + gained.join('; ') : ''}. Returned χ² (both kept), in χ²_ν: within 0.1 on ${within.length}, lower on ${down.length}${down.length ? ' (' + down.join(', ') + ')' : ''}, higher on ${up.length}${up.length ? ' (' + up.join(', ') + ')' : ''}. Solid changed on ${solid.length}${solid.length ? ': ' + solid.join('; ') : ''}.`, '');
}
// 4. cost
const haveCpu = V.filter(v=> rows.every(r=> D[v.name][r.id] && D[v.name][r.id].cpu != null));
L.push('**Cost** (sums over the runs; CPU of iso + search + report, and walls, s):', '', '| variant | search ev | report ev | iso ev | CPU | wall: search | report | iso | ms an evaluation (search wall, median) |', '|---|---|---|---|---|---|---|---|---|');
for (const v of V){
  const g = rows.map(r=> D[v.name][r.id]).filter(Boolean);
  L.push(`| ${v.name} | ${sum(g.map(d=> d.ev))} | ${sum(g.map(d=> d.rEv))} | ${sum(g.map(d=> d.isoEv))} | ${haveCpu.includes(v) ? f(sum(g.map(d=> d.cpu))/1000, 0) : '—'} | ${f(sum(g.map(d=> d.sMs))/1000, 0)} | ${f(sum(g.map(d=> d.rMs))/1000, 0)} | ${f(sum(g.map(d=> d.isoMs))/1000, 0)} | ${f(med(g.map(d=> d.sMs/d.ev)), 2)} |`);
}
L.push('');
const LAUE = ['-1', '2/m', 'mmm', '4/m', '4/mmm', '-3', '-3m', '6/m', '6/mmm', 'm-3', 'm-3m'];
L.push(`Search evaluations per Laue class, × ${R0}:`, '', `| class | ${V.slice(1).map(v=> v.name).join(' | ')} |`, `|---|${V.slice(1).map(()=> '---|').join('')}`);
for (const l of LAUE){
  const rs = rows.filter(r=> D[R0][r.id] && D[R0][r.id].laue === l);
  L.push(`| ${l} | ${V.slice(1).map(v=> f(sum(rs.map(r=> D[v.name][r.id] ? D[v.name][r.id].ev : NaN))/sum(rs.map(r=> D[R0][r.id].ev)), 2)).join(' | ')} |`);
}
L.push('');
// 5. per run
L.push(`| run | class | error | ${V.map(v=> v.name + ': outcome, ev, Δ, worst, thinnest, axis').join(' | ')} |`, `|---|---|---|${V.map(()=> '---|').join('')}`);
for (const r of rows){
  L.push(`| ${r.id} | ${r.laue} | ${r.error ? r.error.kind : 'none'} | ${V.map(v=> { const x = D[v.name][r.id]; return !x ? '—' : `${x.out}, ${x.ev}, ${f(x.delta, 2)}, ${x.worst != null ? pc(x.worst) + ', ' + pc(x.thin) + ', ' + f(x.axis) + '°' : '—'}`; }).join(' | ')} |`);
}
L.push('');
const text = L.join('\n') + '\n';
if (opt.out) fs.writeFileSync(path.resolve(HERE, opt.out), text);
if (opt.json) fs.writeFileSync(path.resolve(HERE, opt.json), JSON.stringify({ best, D: Object.fromEntries(Object.entries(D).map(([k, m])=> [k, Object.fromEntries(Object.entries(m).map(([id, x])=> [id, x && { ...x, r: undefined, o: undefined, solid: x.r.solid || null, chi2: x.r.chi2, chi2nu: x.r.chi2nu, chi2Best: x.r.chi2Best, dBIC: x.r.dBIC }]))])) }, (k, v)=> typeof v === 'number' && !Number.isFinite(v) ? String(v) : v));
console.log(text);
