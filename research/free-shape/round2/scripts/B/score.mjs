#!/usr/bin/env node
/* Track B's scoring. node score.mjs --tags a,b [--rows sub|screen] [--variants v1,v2] [--out f.md] [--json f.json]
   Reads results/<tag>/*.json (run.mjs records) and the pilot's screen records (today, the
   engine's own search, and the truth reference), and scores each variant per run:
   - accountings from one record: a variant run with final 'central' gives
     <name> (the fit before the central pass: its cost less the central pass, its χ² from the
     refinements before it) and <name>C (with the central pass: less the covOnly);
     'fwd' (held: 'count') also gives fwdH* = fwd less the flagged held duplicates (their
     refinements end where the first did: checked);
   - best known: per run, the lowest exact χ² over every method run on it (pilot's today and
     truth reference, every variant here, before and after the central pass);
   - Δ = (method's best exact χ² − best known)/max(1, χ²_ν of the best), on truths, not on the
     method's early rejections; reached: Δ ≤ 1;
   - outcome (held, free, rejected, early) against the pilot's today on the same run;
   - the solid against today's (modulo the class): changed when an extent differs by > 5 % or
     the principal axis by > 2°;
   - accuracy against the truth: worst extent, thinnest, principal axis (°), as the pilot;
   - evaluations and wall ms of the search (the paired today replica gives the wall ratio).
   - the reported fit's χ² (held or free, as returned) against today's, on runs both keep: within
     0.1 χ²_ν (of the best known), lower or higher; for <name> it is the fit before the central
     pass (var.pre.chi), for <name>C the returned fit;
   --compose best=symA,fwdH: a variant read per run from the first of the named records there.
   --supersede: a record of a method in a later tag replaces one of the same name on the same
     run in an earlier tag; the earlier is kept as <name>0 (still in the best known). Used for
     symA, symC and cuts, re-run in tag symfix after the random-stream fix (var.mjs: 'distinct'
     and 'fz' draw today's fill; the first versions, 'distinctShift' and 'fzShift', are symA0,
     symC0 and cuts0).
   Medians and percentiles keep unbounded extents (+∞). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readResult, compareSolids, laueRotations } from './h/lib.mjs';
import { VARIANTS } from './methods/variants.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const a = process.argv.slice(2), opt = {};
for (let i = 0; i < a.length; i++){ if (a[i].startsWith('--')){ const k = a[i].slice(2); opt[k] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true; } }
const design = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'design', 'design.json'), 'utf8'));
const rowOf = id => design.rows.find(r=> r.id === id);
const sub = fs.readFileSync(path.join(HERE, 'subscreen.txt'), 'utf8').split('\n').filter(l=> l && !l.startsWith('#')).map(l=> l.split('\t')[0]);
const sel = String(opt.rows || 'sub');
const ids = sel === 'sub' ? sub : sel === 'screen' ? design.rows.filter(r=> r.screen).map(r=> r.id) : sel.split(',');
const LAUE = ['-1', '2/m', 'mmm', '4/m', '4/mmm', '-3', '-3m', '6/m', '6/mmm', 'm-3', 'm-3m'];

// ---- read: the pilot's records and ours ----
const P = {};
for (const id of ids){ const f = path.join(HERE, '..', 'pilot', 'results', 'screen', id + '.json'); if (fs.existsSync(f)) P[id] = readResult(fs.readFileSync(f, 'utf8')); }
const OURS = {};   // id → [record with .tag]
const tags = String(opt.tags || '').split(',').filter(Boolean);
for (const tag of tags){
  const dir = path.join(HERE, 'results', tag); if (!fs.existsSync(dir)) continue;
  for (const id of ids){ const f = path.join(dir, id + '.json'); if (!fs.existsSync(f)) continue;
    const o = readResult(fs.readFileSync(f, 'utf8')), L = OURS[id] = OURS[id] || [];
    for (const r of o.records){
      if (opt.supersede) for (const x of L) if (x.method === r.method) x.method = r.method + '0';
      L.push({ ...r, tag, iso: o.iso, wall: o.wall });
    } }
}

// ---- one method's view of one record (an accounting) ----
const exactOf = (rec, type, drop) => {
  // the best exact χ² over the log, leaving out the last `drop` entries (the central pass)
  const base = { ellipsoid: 'ball', spheroid: 'ball' }[type] === 'ball';
  const lg = drop ? rec.log.slice(0, rec.log.length - drop) : rec.log;
  const ok = lg.filter(e=> !e.err && Number.isFinite(e.c) && (!e.soft || base));
  return ok.length ? Math.min(...ok.map(e=> e.c)) : NaN;
};
const outcome = r => r.error ? 'error' : r.kept ? (r.held ? 'held' : 'free') : r.rejected ? (r.early ? 'early' : 'rejected') : 'none';
function views(rec, type){
  const v = rec.var || {}, out = [];
  const nm = rec.method, cen = v.central && Number.isFinite(v.central.ev) ? v.central : null, cov = v.covOnly || null;
  const base = { out: outcome(rec), P: rec.P, dBIC: rec.dBIC, held: rec.held, chiRep: rec.kept ? rec.chi2 : NaN };
  if (!cen && VARIANTS[nm] && VARIANTS[nm].final === 'central'){
    // no central pass (a rejection: nothing returned): both accountings are the run itself
    const x = { ...base, ev: rec.search.evals, ms: rec.search.ms, chi: rec.chi2Best ?? exactOf(rec, type, 0), acc: rec.acc, solid: rec.solid, stages: v.stages };
    out.push({ ...x, name: nm }, { ...x, name: nm + 'C' });
    if (nm === 'fwd'){ const hd = v.heldDup || [], dEv = hd.reduce((t, d)=> t + (d.ev || 0), 0); out.push({ ...x, name: 'fwdH*', ev: rec.search.evals - dEv, ms: NaN, heldDupEv: dEv, heldDupN: hd.length }); }
  } else if (cen){
    // before the central pass
    out.push({ ...base, name: nm, ev: rec.search.evals - cen.ev, ms: rec.search.ms - cen.ms, chi: exactOf(rec, type, 1), chiRep: v.pre ? v.pre.chi : NaN, acc: v.pre && v.pre.acc, solid: v.pre && v.pre.solid, cenDchi: cen.dChi, stages: v.stages });
    out.push({ ...base, name: nm + 'C', ev: rec.search.evals - (cov ? cov.ev : 0), ms: rec.search.ms - (cov ? cov.ms : 0), chi: exactOf(rec, type, 0), acc: rec.acc, solid: rec.solid, central: cen, stages: v.stages });
    if (nm === 'fwd'){
      const hd = v.heldDup || [], dEv = hd.reduce((t, d)=> t + (d.ev || 0), 0);
      out.push({ ...base, name: 'fwdH*', ev: rec.search.evals - cen.ev - dEv, ms: NaN, chi: exactOf(rec, type, 1), chiRep: v.pre ? v.pre.chi : NaN, acc: v.pre && v.pre.acc, solid: v.pre && v.pre.solid, heldDupEv: dEv, heldDupN: hd.length });
    }
  } else out.push({ ...base, name: nm, ev: rec.search.evals, ms: rec.search.ms, chi: rec.chi2Best ?? exactOf(rec, type, 0), acc: rec.acc, solid: rec.solid, stages: v.stages });
  for (const x of out) x.kind = x.out;
  return out;
}

// ---- per run ----
const runs = [];
for (const id of ids){
  const row = rowOf(id), p = P[id]; if (!p) continue;
  const today = p.records.find(r=> r.method === 'today'), truth = p.records.find(r=> r.method === 'truth');
  const type = p.shape, N = p.iso.N;
  const V = { pilot: { name: 'pilot', out: outcome(today), ev: today.search.evals, ms: today.search.ms, chi: today.chi2Best, chiRep: today.kept ? today.chi2 : NaN, acc: today.acc, solid: today.solid, P: today.P, dBIC: today.dBIC } };
  for (const rec of OURS[id] || []) for (const x of views(rec, type)) V[x.name] = x;
  // --compose name=a,b: per run the first of a, b that ran (one configuration recorded under
  // different names: 'symA' is the combination where the class has the random fill, 'fwdH'
  // the same configuration elsewhere, where 'distinct' starts change nothing); name+'C' alike
  for (const c of String(opt.compose || '').split(';').filter(Boolean)){
    const [nm, list] = c.split('='), srcs = list.split(',');
    for (const suf of ['', 'C']){ const src = srcs.find(sn=> V[sn + suf]); if (src) V[nm + suf] = { ...V[src + suf], name: nm + suf, from: src }; }
  }
  // the best known: every exact χ² any method reached on the run
  const cands = [[today.chi2Best, today.P], [truth && truth.chi2Best, truth && truth.P], ...Object.values(V).map(x=> [x.chi, x.P])].filter(c=> Number.isFinite(c[0]));
  const bestC = cands.reduce((b, c)=> !b || c[0] < b[0] ? c : b, null);
  const best = bestC ? bestC[0] : NaN, nuB = bestC ? bestC[0]/Math.max(1, N - (bestC[1] || p.iso.P)) : 1;
  for (const x of Object.values(V)){
    x.delta = row.kind === 'truth' && x.out !== 'early' && Number.isFinite(x.chi) && Number.isFinite(best) ? (x.chi - best)/Math.max(1, nuB) : NaN;
    x.sameOut = x.out === V.pilot.out;
    x.dRep = Number.isFinite(x.chiRep) && Number.isFinite(V.pilot.chiRep) ? (x.chiRep - V.pilot.chiRep)/Math.max(1, nuB) : NaN;
    if (x.solid && V.pilot.solid){
      const c = compareSolids(x.solid, V.pilot.solid, { rots: laueRotations(p.phase) });
      x.vsToday = { dim: Math.max(...c.dimErr.map(e=> Number.isFinite(e) ? Math.abs(e) : (e === Infinity ? Infinity : 0))), ax: c.principal };
      x.solidChanged = x.vsToday.dim > 0.05 || (x.vsToday.ax != null && x.vsToday.ax > 2);
    }
    if (x.acc && row.kind === 'truth'){
      const ord = [0, 1, 2].sort((i, j)=> row.dims[i] - row.dims[j]);
      x.worst = Math.max(...x.acc.dimErr.map(e=> Number.isFinite(e) ? Math.abs(e) : Infinity));
      x.thin = x.acc.dimErr[ord[0]]; x.axis = x.acc.principal;
    }
  }
  const todayR = V.today;   // the replica, in the same process as the variants: wall pairs
  runs.push({ id, row, laue: row.laue, solid: row.solid, kind: row.kind, err: row.error ? row.error.kind : 'none', best, nuB, truthChi: truth && truth.chi2Best, V, todayMs: todayR ? todayR.ms : null });
}

// ---- tables ----
const f = (x, d = 1) => x === Infinity ? '∞' : x == null || !Number.isFinite(x) ? '—' : x.toFixed(d);
const pc = x => x === Infinity ? '+∞' : x == null || !Number.isFinite(x) ? '—' : (x >= 0 ? '+' : '') + (100*x).toFixed(0) + ' %';
const num = x => typeof x === 'number' && !Number.isNaN(x);
const qtl = (xs, p) => { const s = xs.filter(num).sort((x, y)=> x - y); if (!s.length) return NaN; const i = (s.length - 1)*p, lo = Math.floor(i), hi = Math.ceil(i); return lo === hi || s[lo] === s[hi] ? s[lo] : !Number.isFinite(s[hi]) || !Number.isFinite(s[lo]) ? s[hi] : s[lo] + (s[hi] - s[lo])*(i - lo); };
const med = xs => qtl(xs, 0.5);
const sum = xs => xs.reduce((t, x)=> t + (Number.isFinite(x) ? x : 0), 0);
const names = opt.variants ? String(opt.variants).split(',') : ['pilot', ...new Set(runs.flatMap(r=> Object.keys(r.V)).filter(n=> n !== 'pilot'))];
const L = [];
L.push(`# Track B scores (${runs.length} runs: ${sel}; tags ${tags.join(', ')})`, '',
  'Best known: the lowest exact χ² over every method run on the run (pilot today and truth reference, every variant). Δ in χ²_ν of that fit; reached Δ ≤ 1 on truths, early rejections not judged. Evaluations and wall s of the search (no report). "vs today": the pilot\'s today on the same run; solid changed: an extent > 5 % or the principal axis > 2° from today\'s (modulo the class). Wall ratio: the variant\'s search s over the today replica\'s (in the same process for the methods run with it, tag sub1; otherwise another process on the same rows, under the load of its time). Wall × pilot: against the pilot\'s own run of today (3 processes on an otherwise idle machine; these ran 2 beside another agent\'s 2–3: a load bias against the variants).', '',
  '| variant | runs | evals (sum) | × today | median per-run ratio | wall × today replica (runs) | wall × pilot | ms/ev | held / free / rej (early) | same outcome | reported χ² vs today: within 0.1 / lower / higher (kept both) | solid changed (kept both) | reached / judged | Δ>1 runs | worst extent, median (90 %) | thinnest, median | axis °, median (90 %) |',
  '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
const judged = (x, r) => r.kind === 'truth' && x.out !== 'early' && Number.isFinite(x.delta);
const stats = {};
for (const n of names){
  const g = runs.filter(r=> r.V[n] && r.V.pilot); if (!g.length) continue;
  const X = g.map(r=> r.V[n]);
  const ev = sum(X.map(x=> x.ev)), evT = sum(g.map(r=> r.V.pilot.ev));
  const ratio = g.map(r=> r.V[n].ev/r.V.pilot.ev);
  const wp = g.filter(r=> r.V.today && Number.isFinite(r.V[n].ms)), wall = wp.length ? sum(wp.map(r=> r.V[n].ms))/sum(wp.map(r=> r.V.today.ms)) : NaN;
  const cnt = k => X.filter(x=> x.out === k).length;
  const J = g.filter(r=> judged(r.V[n], r)), reached = J.filter(r=> r.V[n].delta <= 1).length;
  const miss = J.filter(r=> r.V[n].delta > 1).map(r=> `${r.id} ${f(r.V[n].delta)}`);
  const kept = g.filter(r=> r.kind === 'truth' && r.V[n].acc);
  const both = g.filter(r=> r.V[n].solid && r.V.pilot.solid);
  const ch = both.filter(r=> r.V[n].solidChanged).map(r=> r.id);
  const rp = g.filter(r=> Number.isFinite(r.V[n].dRep)), lo = rp.filter(r=> r.V[n].dRep < -0.1), hi = rp.filter(r=> r.V[n].dRep > 0.1);
  const rep = { both: rp.length, within: rp.length - lo.length - hi.length, lower: lo.map(r=> [r.id, r.V[n].dRep]), higher: hi.map(r=> [r.id, r.V[n].dRep]) };
  stats[n] = { runs: g.length, ev, evT, ratioSum: ev/evT, ratioMed: med(ratio), wall, out: { held: cnt('held'), free: cnt('free'), rej: cnt('rejected') + cnt('early'), early: cnt('early') }, same: X.filter(x=> x.sameOut).length,
    changed: ch, rep, reached, judged: J.length, miss, worst: med(kept.map(r=> r.V[n].worst)), worst90: qtl(kept.map(r=> r.V[n].worst), 0.9), thin: med(kept.map(r=> r.V[n].thin)), axis: med(kept.map(r=> r.V[n].axis)), axis90: qtl(kept.map(r=> r.V[n].axis), 0.9) };
  const s = stats[n];
  const wm = g.filter(r=> Number.isFinite(r.V[n].ms)), msEv = sum(wm.map(r=> r.V[n].ms))/sum(wm.map(r=> r.V[n].ev)); s.msEv = msEv;
  const wq = g.filter(r=> Number.isFinite(r.V[n].ms)), wPil = wq.length ? sum(wq.map(r=> r.V[n].ms))/sum(wq.map(r=> r.V.pilot.ms)) : NaN; s.wallPilot = wPil;
  L.push(`| ${n} | ${g.length} | ${ev} | ${f(s.ratioSum, 3)} | ${f(s.ratioMed, 3)} | ${f(wall, 3)} (${wp.length}) | ${f(wPil, 3)} | ${f(msEv, 1)} | ${s.out.held} / ${s.out.free} / ${s.out.rej} (${s.out.early}) | ${s.same}/${g.length} | ${rep.within} / ${lo.length} / ${hi.length} (${rep.both})${lo.length + hi.length ? ': ' + [...rep.lower, ...rep.higher].map(([id, d])=> `${id} ${d > 0 ? '+' : ''}${f(d, 2)}`).join('; ') : ''} | ${ch.length}/${both.length} | ${reached}/${J.length} | ${miss.join('; ') || '—'} | ${pc(s.worst)} (${pc(s.worst90)}) | ${pc(s.thin)} | ${f(s.axis)} (${f(s.axis90)}) |`);
}
// per class: evaluations and wall against today
L.push('', '## Per Laue class: evaluations × today (sum over the class\'s runs) / wall × the today replica (runs with one) / wall × the pilot\'s today', '', `| class | runs | ${names.filter(n=> n !== 'pilot').join(' | ')} |`, `|---|---|${names.filter(n=> n !== 'pilot').map(()=> '---').join('|')}|`);
for (const l of LAUE){
  const g = runs.filter(r=> r.laue === l); if (!g.length) continue;
  const cell = n => { const h = g.filter(r=> r.V[n]); if (!h.length) return '—'; const e = sum(h.map(r=> r.V[n].ev))/sum(h.map(r=> r.V.pilot.ev)); const w = h.filter(r=> r.V.today && Number.isFinite(r.V[n].ms)); const ws = w.length ? sum(w.map(r=> r.V[n].ms))/sum(w.map(r=> r.V.today.ms)) : NaN;
    const wq = h.filter(r=> Number.isFinite(r.V[n].ms)), wp = wq.length ? sum(wq.map(r=> r.V[n].ms))/sum(wq.map(r=> r.V.pilot.ms)) : NaN; return `${f(e, 2)} / ${f(ws, 2)} / ${f(wp, 2)}`; };
  L.push(`| ${l} | ${g.length} | ${names.filter(n=> n !== 'pilot').map(cell).join(' | ')} |`);
}
// per run
L.push('', '## Per run: evaluations, outcome, Δ', '', `| run | class | best known | truth ref Δ | ${names.join(' | ')} |`, `|---|---|---|---|${names.map(()=> '---').join('|')}|`);
for (const r of runs){
  const tr = Number.isFinite(r.truthChi) ? (r.truthChi - r.best)/Math.max(1, r.nuB) : NaN;
  L.push(`| ${r.id} | ${r.laue} | ${f(r.best, 1)} | ${f(tr, 2)} | ${names.map(n=> { const x = r.V[n]; return x ? `${x.ev} ${x.out[0]}${x.sameOut ? '' : '!'} Δ${f(x.delta, 2)}${x.solidChanged ? ' ≠' : ''}` : '—'; }).join(' | ')} |`);
}
// where the evaluations go: per stage, mean evaluations a run and mean iterations a refinement
const ST = ['brief', 'full', 'polish', 'exact', 'held', 'refit', 'central'];
const withSt = names.filter(n=> !/[C*]$/.test(n) && runs.some(r=> r.V[n] && r.V[n].stages));
if (withSt.length){
  L.push('', '## By stage: evaluations a run (mean over the runs the variant ran), iterations a refinement (mean) in brackets; cov: the returned fit\'s covariance alone', '', `| variant | runs | ${ST.join(' | ')} | cov |`, `|---|---|${ST.map(()=> '---').join('|')}|---|`);
  for (const n of withSt){
    const g = runs.filter(r=> r.V[n] && r.V[n].stages);
    const cell = s => { const all = g.flatMap(r=> r.V[n].stages.filter(e=> e.st === s)); return `${f(sum(all.map(e=> e.ev))/g.length, 0)} (${f(all.length ? sum(all.map(e=> e.it))/all.length : NaN, 1)})`; };
    const covEv = sum(g.map(r=> { const rec = (OURS[r.id] || []).find(x=> x.method === n.replace(/C$/, '')); return rec && rec.var && rec.var.covOnly ? rec.var.covOnly.ev : 0; }))/g.length;
    L.push(`| ${n} | ${g.length} | ${ST.map(cell).join(' | ')} | ${f(covEv, 0)} |`);
  }
}
// the central pass
const cen =runs.flatMap(r=> Object.values(r.V).filter(x=> x.central).map(x=> ({ id: r.id, name: x.name, ...x.central, nu: r.nuB, pre: r.V[x.name.slice(0, -1)] })));
if (cen.length){
  L.push('', '## The central pass (the returned fit refined once more with central differences)', '');
  for (const n of [...new Set(cen.map(c=> c.name))]){
    const g = cen.filter(c=> c.name === n);
    const d = g.map(c=> -c.dChi/Math.max(1, c.nu));
    L.push(`- ${n}: ${g.length} kept runs; ${f(med(g.map(c=> c.ev)), 0)} evaluations (median; ${Math.min(...g.map(c=> c.ev))}–${Math.max(...g.map(c=> c.ev))}), iterations ${f(med(g.map(c=> c.it)), 0)}; χ² lowered by ${f(med(d), 4)} χ²_ν (median), ${f(Math.max(...d), 3)} at most; ${d.filter(x=> x > 0.1).length} runs by more than 0.1, ${d.filter(x=> x > 1).length} by more than 1.`);
  }
}
const txt = L.join('\n') + '\n';
if (opt.out) fs.writeFileSync(opt.out, txt); else console.log(txt);
if (opt.json) fs.writeFileSync(opt.json, JSON.stringify({ stats, runs: runs.map(r=> ({ id: r.id, laue: r.laue, solid: r.solid, kind: r.kind, err: r.err, best: r.best, nuB: r.nuB, V: Object.fromEntries(Object.entries(r.V).map(([k, x])=> [k, { out: x.out, ev: x.ev, ms: x.ms, chi: x.chi, delta: x.delta, chiRep: x.chiRep, dRep: x.dRep, from: x.from, sameOut: x.sameOut, solidChanged: x.solidChanged, vsToday: x.vsToday, worst: x.worst, thin: x.thin, axis: x.axis, central: x.central, heldDupEv: x.heldDupEv }])) })) }, (k, v)=> typeof v === 'number' && !Number.isFinite(v) ? String(v) : v, 1));
