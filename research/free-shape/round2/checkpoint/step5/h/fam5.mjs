#!/usr/bin/env node
/* (a) The family: every screening row fitted as each of the six solids (X1; a truth's own solid from
   step 4's S2). Per row: each family's χ² (its best member; the ball family holds the isotropic fit),
   the margin of the runner-up family over the winner in χ²/χ²_ν,iso and in BIC (χ²/ν + P ln N), the
   true family's margin, the nested verdict (general against special member) in the winning family.
   node fam5.mjs [--tag X1] [--rows] [--json out.json] */
import fs from 'node:fs';
import { SOLIDS, FAM, GEN, SPEC, design, fitOf, S2, rec5, f, q } from './lib5.mjs';
const a = process.argv.slice(2), opt = {}; for (let i = 0; i < a.length; i++) if (a[i].startsWith('--')) opt[a[i].slice(2)] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true;
const tag = opt.tag || 'X2';
const rows = design.rows.filter(r=> r.screen && !r.from);
const out = [];
for (const r of rows){
  const fits = {};
  // X2: every solid without the stage (the true one too); a sphere row: X1 (the stage on)
  for (const s of SOLIDS) fits[s] = r.kind === 'sphere' ? fitOf(rec5('X1', r.key, s), s) : tag === 'X2' ? fitOf(rec5('X2', r.key, s), s) : r.solid === s ? fitOf(S2(r.id), s) : fitOf(rec5(tag, r.key, s), s);
  const have = SOLIDS.filter(s=> fits[s]);
  if (have.length < (opt.min ? +opt.min : 6) || !fits.box || !fits.ellcyl || !fits.ellipsoid) continue;
  const any = fits[have[0]], nu = any.nu, lnN = Math.log(any.N);
  const isoSame = have.every(s=> Math.abs(fits[s].iso - any.iso) < 1e-6*any.iso);
  const c = s => s === 'sphere' ? any.iso/nu : fits[s].chi2/nu, P = s => s === 'sphere' ? any.Piso : fits[s].P;
  const bic = s => c(s) + P(s)*lnN;
  const members = { box: ['box', 'sqbox'], cyl: ['cylinder', 'ellcyl'], ball: ['ellipsoid', 'spheroid', 'sphere'] };
  const famv = (fn) => Object.fromEntries(Object.entries(members).map(([F, ms])=> { const b = ms.filter(s=> s === 'sphere' || fits[s]).reduce((x, s)=> fn(s) < fn(x) ? s : x); return [F, { v: fn(b), by: b }]; }));
  const res = { key: r.key, solid: r.solid, laue: r.laue, counts: r.counts, D: r.solid === 'sphere' ? r.D : null, error: r.error ? r.error.kind : null, strength: r.error ? r.error.strength : null,
    trueFam: FAM[r.solid], nu, isoSame, have, fits: Object.fromEntries(have.map(s=> [s, { c: c(s) - c('sphere'), P: P(s), kept: fits[s].kept, flagged: fits[s].flagged, z: fits[s].z, gain: fits[s].gain, ms: fits[s].ms, evals: fits[s].evals }])) };
  for (const [nm, fn] of [['chi', c], ['bic', bic]]){
    const fv = famv(fn), order = Object.keys(fv).sort((x, y)=> fv[x].v - fv[y].v), W = order[0], R = order[1];
    res[nm] = { win: W, by: fv[W].by, runner: R, runnerBy: fv[R].by, margin: fv[R].v - fv[W].v, trueMargin: Math.min(...Object.keys(fv).filter(F=> F !== res.trueFam).map(F=> fv[F].v)) - fv[res.trueFam].v,
      fam: Object.fromEntries(order.map(F=> [F, fv[F].v - fv[W].v])), best: order.length ? fv[W].by : null };
  }
  // the winner's fit flagged by the per-line check (the ball family's sphere: the isotropic fit's own check is not kept here)
  const wb = res.chi.by; res.winFlag = wb === 'sphere' ? null : fits[wb].flagged;
  res.anyFlag = have.some(s=> fits[s].flagged);
  // nested: general against special member, in χ²/ν, in each family
  res.nest = Object.fromEntries(Object.keys(members).map(F=> [F, fits[SPEC[F]] && fits[GEN[F]] ? c(SPEC[F]) - c(GEN[F]) : NaN]));
  res.nestSphere = fits.spheroid ? c('sphere') - c('spheroid') : NaN;
  out.push(res);
}
if (opt.json) fs.writeFileSync(opt.json, JSON.stringify(out));
const truths = out.filter(o=> o.solid !== 'sphere');
console.log(`rows ${out.length} (truths ${truths.length}); iso χ² identical across the six solids on ${out.filter(o=> o.isoSame).length}`);
// counts at margins
const score = (set, nm, m, flagM = m) => { let right = 0, nd = 0, wrong = 0, ndHonest = 0, ndSaved = 0;
  for (const o of set){ const x = o[nm], M = o.winFlag ? flagM : m;
    if (x.margin >= M){ if (x.win === o.trueFam) right++; else wrong++; }
    else { nd++; if (o[nm].fam[o.trueFam] < M) ndHonest++; if (x.win !== o.trueFam) ndSaved++; } }
  return `${right} / ${nd} / ${wrong} (n.d.: truth within the margin ${ndHonest}, winner wrong ${ndSaved})`; };
for (const nm of ['chi', 'bic']){
  console.log(`\n${nm}: right / not determined / wrong`);
  for (const m of [0, 3, 6, 10, 16, 25]) console.log(`  m ${m}: all ${score(truths, nm, m)} | clean ${score(truths.filter(o=> !o.error), nm, m)} | error ${score(truths.filter(o=> o.error), nm, m)}`);
}
if (opt.rows){
  console.log('\n| row | error | flag | win (by) χ² | margin χ² | true margin χ² | win BIC | margin BIC | nested Δ (box, cyl, ball) | spheroid − sphere |');
  for (const o of out) console.log(`| ${o.key} | ${o.error ? o.error + ' ' + f(o.strength, 2) : '—'} | ${o.winFlag ? 'F' : ''} | ${o.chi.win} (${o.chi.by}) | ${f(o.chi.margin)} | ${f(o.chi.trueMargin)} | ${o.bic.win} (${o.bic.by}) | ${f(o.bic.margin)} | ${f(o.nest.box)}, ${f(o.nest.cyl)}, ${f(o.nest.ball)} | ${f(o.nestSphere)} |`);
}
