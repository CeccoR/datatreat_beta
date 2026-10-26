#!/usr/bin/env node
/* node eval.mjs [--set synth|sample] [--out results/eval-<set>.json]
   Every approach on every run that has its inputs; coverage of the truth (95 % intervals,
   cones), tightness; a markdown table on stdout. Pure computation: no pattern evaluated. */
import fs from 'node:fs';
import path from 'node:path';
import { loadRun, CASES, align, alignL, Lprin, inside, median, quantile, fmt, pct, HERE } from './plib.mjs';
import { P0_app, P1_profile, P2_envelope, P3_credible, P3_mixture, P3_points, P3_pointsH, P4_classes, P5_occam, P6_all, E_app, E_prof, P0w, E_appW, E_L, withSys, withMisfit, withPick } from './approaches.mjs';

const a = process.argv.slice(2), opt = {};
for (let i = 0; i < a.length; i++){ if (a[i].startsWith('--')){ const k = a[i].slice(2); opt[k] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true; } }
const SET = opt.set || 'synth';
const SYF = path.join(HERE, 'results', `sys-${SET}.json`), SY = fs.existsSync(SYF) ? JSON.parse(fs.readFileSync(SYF, 'utf8')) : null;
const runs = [];
for (const c of CASES.filter(c=> c.kind === SET)) for (const s of c.seeds) runs.push([c.id, s]);

const SAME = { P0_app, P0w, 'E_app2': E_app(2), 'E_app6': E_app(6), 'E_app2c': E_app(2, { conv: true }), 'E_appW2': E_appW(2), 'E_appW4': E_appW(4), 'E_appW6': E_appW(6), 'E_appW10': E_appW(10), P1_profile, 'E_prof2': E_prof(2), 'E_prof6': E_prof(6), 'P2_env2': P2_envelope(2), 'P2_env6': P2_envelope(6), 'P2_env10': P2_envelope(10), P3_credible, P3_mixture, P3_points, P3_pointsH };
// in column lengths, paired by alignL: every run (no other solid needed)
const LEN = { 'E_L2': E_L(2), 'E_L4': E_L(4), 'E_L6': E_L(6), 'E_L10': E_L(10) };
const CROSS = { P4_classes: (R, o)=> P4_classes(R, o), 'P4_classes68': (R, o)=> P4_classes(R, { ...o, p: 0.68 }), P5_occam: (R, o)=> P5_occam(R, o), 'P5_occam4': (R, o)=> P5_occam(R, { ...o, tau: 4 }), P6_all: (R, o)=> P6_all(R, o), P6_occam: (R, o)=> P6_all(R, { ...o, occam: true }) };

/* evaluations an approach needs beyond the app's search: the app's own report (turnEsds),
   the width profiles, the refined minima (with the extra lattice starts and the free fit of
   a held result), the other five solids' searches */
function costOf(nm, R){
  const c = (R.uq && R.uq.cost) || {}, g = k => (c[k] && c[k].evals) || 0;
  const app = g('app'), prof = g('profile'), mins = g('minima') + g('extra') + g('freeOfHeld');
  const xc = Object.values(R.xc).reduce((t, x)=> t + (x.evals || 0), 0);
  if (nm.startsWith('P0') || nm.startsWith('E_app') || nm.startsWith('E_L')) return app;
  if (nm === 'P1_profile' || nm.startsWith('E_prof')) return app + prof;
  if (nm.startsWith('P2') || nm.startsWith('P3')) return app + prof + mins;
  if (nm.startsWith('P6')) return app + prof + mins + xc;
  return app + prof + xc;                      // P4, P5
}
function score(res, truth, L){
  if (!res) return null;
  const al = L ? alignL(res.solid, truth) : align(res.solid, truth);
  const tv = L ? Lprin(truth) : truth.dims;
  const ord = [0, 1, 2].sort((x, y)=> tv[x] - tv[y]);
  const role = { thin: ord[0], mid: ord[1], long: ord[2] };
  const out = { dims: {}, ang: {} };
  for (const [k, ri] of Object.entries(role)){
    const p = al.per[ri], iv = res.iv[p.fi];
    const est = L ? Lprin(res.solid)[p.fi] : res.solid.dims[p.fi], t = tv[ri];
    // use: |log(truth/est)| over the interval's half-width on the truth's side (a calibrated
    // Gaussian 95 % interval: median 0.34; over 1 outside)
    const side = t >= est ? iv[1] : iv[0], hw = Math.abs(Math.log(side/est));
    const use = !Number.isFinite(est) ? NaN : Number.isFinite(hw) && hw > 0 ? Math.abs(Math.log(t/est))/hw : (Number.isFinite(side) ? Infinity : 0);
    out.dims[k] = { truth: t, est, lo: iv[0], hi: iv[1], cov: inside(t, iv), factor: iv[1]/Math.max(iv[0], 1e-9), use };
  }
  const prin = al.prin;
  al.per.forEach((p, ri)=> {
    if (p.angle == null) return;
    const k = ri === prin ? 'prin' : 'other' + ri;
    out.ang[k] = { angle: p.angle, cone: res.cone[p.fi], claimed: res.cone[p.fi] < 180, cov: p.angle <= res.cone[p.fi], use: p.angle/res.cone[p.fi] };
  });
  return out;
}

const per = [];
for (const [id, seed] of runs){
  const R = loadRun(id, seed);
  if (!R.base){ continue; }
  const row = { id, seed, type: R.type, truth: R.truth, kept: R.base.kept, held: R.base.held, hasU: !!(R.uq && R.uq.reported), xc: Object.keys(R.xc).length, sc: {} };
  if (!R.truth || !R.base.kept || !row.hasU){ per.push(row); continue; }
  let p0 = null;
  for (const [nm, f] of Object.entries(SAME)){
    try { const r = f(R); if (nm === 'P0_app') p0 = r; row.sc[nm] = { ...score(r, R.truth, false), n: r.n, spread: r.spread, cost: costOf(nm, R) }; }
    catch(e){ row.sc[nm] = { error: String(e.stack || e) }; }
  }
  for (const [nm, f] of Object.entries(LEN)){
    try { const r = f(R); row.sc[nm] = { ...score(r, R.truth, true), cost: costOf(nm, R) }; }
    catch(e){ row.sc[nm] = { error: String(e.stack || e) }; }
  }
  // the model terms on E_L6: the misfit bound (every run), the background variants (runs refined again)
  { const r6 = E_L(6)(R);
    row.sc['E_L6mis'] = { ...score(withMisfit(r6, R), R.truth, true), cost: costOf('E_L6', R) };
    const sr = SY && SY.rows.find(x=> x.id === id && x.seed === seed);
    if (sr){ const v = withSys(r6, sr); const extra = (sr.evals || 0); row.sc['E_L6bg'] = { ...score(v, R.truth, true), cost: costOf('E_L6', R) + extra };
      const p = withPick(r6, sr), pu = withPick(r6, sr, { union: true });
      row.sc['E_L6pick'] = { ...score(p, R.truth, true), cost: costOf('E_L6', R) + extra, pickBg: p.pickBg };
      row.sc['E_L6pick+'] = { ...score(pu, R.truth, true), cost: costOf('E_L6', R) + extra };
      const nuP = sr.vs.find(v=> v.dBIC === 0).chi2nu;
      row.sc['E_L6pick+m'] = { ...score(withMisfit(p, R, nuP), R.truth, true), cost: costOf('E_L6', R) + extra }; } }
  if (row.xc >= 5){
    for (const [nm, f] of Object.entries(CROSS)){
      try { const r = f(R, { cone0: p0 && p0.cone }); row.sc[nm] = r ? { ...score(r, R.truth, true), set: r.set, chosen: r.chosen, ref: r.ref, cost: costOf(nm, R) } : null; }
      catch(e){ row.sc[nm] = { error: String(e.stack || e) }; }
    }
  }
  per.push(row);
}

// ---- the table
const names = [...Object.keys(SAME), ...Object.keys(LEN), 'E_L6mis', 'E_L6bg', 'E_L6pick', 'E_L6pick+', 'E_L6pick+m', ...Object.keys(CROSS)];
const lines = [];
lines.push(`Set ${SET}: ${per.length} runs; scored (kept, with minima): ${per.filter(r=> Object.keys(r.sc).length).length}; across solids: ${per.filter(r=> r.sc.P4_classes).length}.`);
lines.push('');
lines.push('| approach | n | thin: covered | thin: hi/lo | mid: covered | mid: hi/lo, open | long: covered | long: hi/lo, open | normal/axis: covered of claimed, claimed, cone | other axes: covered of claimed, claimed, cone | evaluations beyond the search: mean |');
lines.push('|---|---|---|---|---|---|---|---|---|---|---|');
const summary = {};
for (const nm of names){
  const S = per.map(r=> r.sc[nm]).filter(x=> x && !x.error && x.dims);
  if (!S.length) continue;
  const d = k => { const v = S.map(s=> s.dims[k]); const cl = v.filter(x=> Number.isFinite(x.hi));
    return { n: v.length, cov: v.filter(x=> x.cov).length, open: v.length - cl.length, fmed: median(cl.map(x=> x.factor)), f90: quantile(cl.map(x=> x.factor), 0.9), use: median(v.map(x=> x.use)) }; };
  const g = pred => { const v = S.flatMap(s=> Object.entries(s.ang).filter(([k])=> pred(k)).map(([, x])=> x)); const cl = v.filter(x=> x.claimed);
    return { n: v.length, claimed: cl.length, cov: cl.filter(x=> x.cov).length, cmed: median(cl.map(x=> x.cone)), use: median(cl.map(x=> x.use)) }; };
  const th = d('thin'), mi = d('mid'), lo = d('long'), pr = g(k=> k === 'prin'), ot = g(k=> k !== 'prin');
  const cost = S.reduce((t, s)=> t + (s.cost || 0), 0)/S.length;
  summary[nm] = { n: S.length, thin: th, mid: mi, long: lo, prin: pr, other: ot, cost };
  const dc = x => `${pct(x.cov, x.n)}, use ${fmt(x.use, 2)}`, df = x => `${fmt(x.fmed, 2)} (90 %: ${fmt(x.f90, 2)})${x.open ? `, ${x.open} open` : ''}`;
  const ac = x => `${pct(x.cov, x.claimed)}, ${x.claimed}/${x.n}, ${fmt(x.cmed, 1)}°, use ${fmt(x.use, 2)}`;
  lines.push(`| ${nm} | ${S.length} | ${dc(th)} | ${df(th)} | ${dc(mi)} | ${df(mi)} | ${dc(lo)} | ${df(lo)} | ${ac(pr)} | ${ac(ot)} | ${Math.round(cost)} |`);
}
const md = lines.join('\n');
console.log(md);
const out = opt.out || path.join(HERE, 'results', `eval-${SET}.json`);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ set: SET, at: new Date().toISOString(), summary, per }, null, 0));
fs.writeFileSync(out.replace(/\.json$/, '.md'), md + '\n');
