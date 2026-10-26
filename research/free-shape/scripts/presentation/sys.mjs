#!/usr/bin/env node
/* node sys.mjs [--set sample|synth] [--base E_app6] [--bgs 6,12,18]
   A model term in the stated uncertainty. The statistical intervals miss the sample-like
   proxies' thickness (the unmodelled hump biases it 6–28 %): no width of noise covers a
   bias. Here the solid the search kept is refined again (no search: from itself, faces
   rounded, exact free, exact held; refit.mjs) with the background's Chebyshev degree
   changed (6, the harness's; 12, 18): a model change that takes up part of a broad
   component. Per run:
   - the kept solid of each variant, its χ²_ν, aligned to the reported solid;
   - the variant chosen by BIC (χ²/max(1, χ²_ν of the lowest) + P ln N): does it move the
     solid towards the truth?
   - the base approach's intervals widened to the variants' points (union) and their cones
     to the variants' angles: coverage and tightness on the truths.
   Pure computation on results/refit/ and results/eval-<set>.json's inputs. */
import fs from 'node:fs';
import path from 'node:path';
import { loadRun, CASES, align, inside, median, quantile, fmt, pct, HERE } from './plib.mjs';
import * as AP from './approaches.mjs';
const a = process.argv.slice(2), opt = {};
for (let i = 0; i < a.length; i++){ if (a[i].startsWith('--')){ const k = a[i].slice(2); opt[k] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true; } }
const SET = opt.set || 'sample';
const BGS = (opt.bgs || (SET === 'sample' ? '6,12,18' : '6,12')).split(',').map(Number);
const BASES = { E_app6: AP.E_app(6), E_app2: AP.E_app(2), P0_app: AP.P0_app, P1_profile: AP.P1_profile, P2_env2: AP.P2_envelope(2), P3_points: AP.P3_points };
const baseName = opt.base || 'E_app6', baseF = BASES[baseName];
// JSON writes an unbounded dimension as null: back to Infinity in every 'dims'
const fixDims = o => { if (o && typeof o === 'object'){ for (const [k, v] of Object.entries(o)){ if (k === 'dims' && Array.isArray(v)) o[k] = v.map(d=> d === null ? Infinity : d); else fixDims(v); } } return o; };
const rd = f => fs.existsSync(f) ? fixDims(JSON.parse(fs.readFileSync(f, 'utf8'))) : null;
const union = (x, y) => [Math.min(x[0], y[0]), Math.max(x[1], y[1])];
const rows = [];
for (const c of CASES.filter(c=> c.kind === SET)){
  const seed = 1, R = loadRun(c.id, seed);
  if (!R.base || !R.base.kept || !R.truth || !R.uq) continue;
  const V = BGS.map(bg=> ({ bg, r: rd(path.join(HERE, 'results', 'refit', `${c.id}-${seed}-bg${bg}.json`)) })).filter(v=> v.r && v.r.keep);
  if (V.length < BGS.length) continue;
  const rep = R.base.solid, N = R.iso.N;
  // each variant's kept solid, aligned to the reported one; its BIC
  const vs = V.map(({ bg, r })=> { const k = r[r.keep]; return { bg, keep: r.keep, chi: k.chi, chi2nu: k.chi2nu, P: k.P, isoNu: r.iso.chi2nu, solid: k.solid, al: align(k.solid, rep) }; });
  const nu0 = Math.max(1, Math.min(...vs.map(v=> v.chi2nu)));
  for (const v of vs) v.bic = v.chi/nu0 + v.P*Math.log(N);
  const bmin = Math.min(...vs.map(v=> v.bic)); for (const v of vs) v.dBIC = v.bic - bmin;
  const best = vs.find(v=> v.dBIC === 0);
  // the base approach, then widened by the variants
  const b = baseF(R), iv = b.iv.map(x=> x.slice()), cone = b.cone.slice();
  for (const v of vs){
    v.al.per.forEach((p, i)=> { const D = v.solid.dims[p.fi]; iv[i] = union(iv[i], [D, D]); if (p.angle != null && cone[i] < 180) cone[i] = Math.max(cone[i], b.cone[i] + p.angle); });
  }
  // score both against the truth: per truth role, covered and hi/lo (as eval.mjs)
  const sc = res => {
    const al = align(res.solid, R.truth), tv = R.truth.dims, ord = [0, 1, 2].sort((x, y)=> tv[x] - tv[y]);
    const out = {};
    for (const [k, ri] of Object.entries({ thin: ord[0], mid: ord[1], long: ord[2] })){
      const p = al.per[ri], I = res.iv[p.fi];
      out[k] = { truth: tv[ri], est: res.solid.dims[p.fi], lo: I[0], hi: I[1], cov: inside(tv[ri], I), factor: I[1]/Math.max(I[0], 1e-9) };
    }
    const pp = al.per[al.prin]; out.prin = { angle: pp.angle, cone: res.cone[pp.fi], cov: pp.angle != null && pp.angle <= res.cone[pp.fi] };
    return out;
  };
  // the BIC-chosen variant's solid against the truth (as a point)
  const bt = align(best.solid, R.truth), tv = R.truth.dims, ord = [0, 1, 2].sort((x, y)=> tv[x] - tv[y]);
  const thinErr = s => { const al = align(s, R.truth); return s.dims[al.per[ord[0]].fi]/tv[ord[0]] - 1; };
  const prinErr = s => { const al = align(s, R.truth); return al.per[al.prin].angle; };
  rows.push({ id: c.id, seed, vs: vs.map(v=> ({ bg: v.bg, keep: v.keep, chi2nu: v.chi2nu, isoNu: v.isoNu, dBIC: v.dBIC, dims: v.solid.dims, mapped: v.al.per.map(p=> ({ D: v.solid.dims[p.fi], angle: p.angle })), thinErr: thinErr(v.solid), prinErr: prinErr(v.solid) })),
    bestBg: best.bg, base: sc(b), sys: sc({ ...b, iv, cone }), evals: V.filter(x=> x.bg !== 6).reduce((t, x)=> t + (x.r.evals || 0), 0), repThinErr: thinErr(rep), repPrinErr: prinErr(rep) });
}
// ---- report
console.log(`${SET}: ${rows.length} runs with the variants ${BGS.join(', ')} refined; base ${baseName}`);
console.log('\nPer run: thickness error (and the normal\'s angle) of the reported fit and of each background variant; the variant chosen by BIC');
console.log(`| run | reported | ${BGS.map(b=> `bg ${b}: χ²_ν iso → shape, thickness, normal`).join(' | ')} | BIC picks |`);
console.log(`|---|---|${BGS.map(()=> '---').join('|')}|---|`);
for (const r of rows) console.log(`| ${r.id} | ${fmt(100*r.repThinErr, 0)} %, ${fmt(r.repPrinErr, 1)}° | ${r.vs.map(v=> `${fmt(v.isoNu, 2)} → ${fmt(v.chi2nu, 3)}, ${fmt(100*v.thinErr, 0)} %, ${fmt(v.prinErr, 1)}°`).join(' | ')} | ${r.bestBg} |`);
const S = k => rows.map(r=> r[k]);
const cov = (set, q) => pct(set.filter(s=> s[q].cov).length, set.length);
const fac = (set, q) => { const f = set.map(s=> s[q].factor).filter(Number.isFinite); return `${fmt(median(f), 2)} (90 %: ${fmt(quantile(f, 0.9), 2)})`; };
console.log('\n| intervals | thin covered | thin hi/lo | mid covered | mid hi/lo | long covered | long hi/lo | normal covered (claimed) | normal cone, median |');
console.log('|---|---|---|---|---|---|---|---|---|');
for (const [nm, set] of [[baseName, S('base')], [baseName + ' + background variants', S('sys')]]){
  const cl = set.filter(s=> s.prin.cone < 180);
  console.log(`| ${nm} | ${cov(set, 'thin')} | ${fac(set, 'thin')} | ${cov(set, 'mid')} | ${fac(set, 'mid')} | ${cov(set, 'long')} | ${fac(set, 'long')} | ${pct(cl.filter(s=> s.prin.cov).length, cl.length)} | ${fmt(median(cl.map(s=> s.prin.cone)), 1)}° |`);
}
const bestRows = rows.map(r=> r.vs.find(v=> v.bg === r.bestBg));
console.log(`\nThickness error, median |.|: reported ${fmt(100*median(rows.map(r=> Math.abs(r.repThinErr))), 1)} %; ${BGS.map(b=> `bg ${b} ${fmt(100*median(rows.map(r=> Math.abs(r.vs.find(v=> v.bg === b).thinErr))), 1)} %`).join('; ')}; BIC's pick ${fmt(100*median(bestRows.map(v=> Math.abs(v.thinErr))), 1)} %.`);
console.log(`Normal's angle, median: reported ${fmt(median(rows.map(r=> r.repPrinErr)), 1)}°; ${BGS.map(b=> `bg ${b} ${fmt(median(rows.map(r=> r.vs.find(v=> v.bg === b).prinErr)), 1)}°`).join('; ')}; BIC's pick ${fmt(median(bestRows.map(v=> v.prinErr)), 1)}°.`);
console.log(`BIC picks: ${BGS.map(b=> `bg ${b} ${rows.filter(r=> r.bestBg === b).length}`).join(', ')}.`);
fs.writeFileSync(path.join(HERE, 'results', `sys-${SET}.json`), JSON.stringify({ bgs: BGS, base: baseName, rows }));
