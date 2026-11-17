// The presentation study's intervals and the uniqueness study's, scored the same way on the same
// runs, and the merged rule the write-up recommends: E_L6 (presentation: today's esds in the width,
// widened to the search's ends within Δ 6, as column lengths), today's angular radius (2σ of
// turnEsds) for the directions, a direction only where its extent is told apart (the D rule), and,
// where the residuals flag a misfit (worst line segment's χ²_ν > 1.25), widened by the
// delete-one-line jackknife (uniqueness): D·e^(±2 sd) and 2·rms turn.
// Reads results only; runs nothing.
//   node cross.mjs <fs root> [--sets synth,sample] [--md out.md] [--json out.json] [--misses out.txt]
//                            [--flag6 runs.json] [--only u,v]
// Fixed after review (2026-10-26):
//  - an unbounded estimate (JSON null) no longer gets a lower limit of 0 from the jackknife
//    (est·e^(−2sd) with est null was 0: an open interval [0, ∞) counted as covering the truth);
//  - every claim is also scored against its own stated interval or radius ("holds as stated"),
//    not only against the 25 % / 10° tolerance;
//  - the row that applied degree 6's flag and jackknife spreads to the degree-18 values is gone
//    (the pipelines at the picked degree are scored on their own runs, fix/root18 (the review's runs));
//  - --flag6: runs whose degree-6 residuals flagged a misfit (a JSON list of "case#seed"): the
//    jackknife is applied to them whatever the flag reads at the root's own degree;
//  - today's report is the presentation's rebuild (P0_app, cones 2.45σ) with the round section's
//    diameter esd restored (presentation/approaches.mjs), and the uniqueness study's (2σ) likewise
//    (uniqueness/score.mjs).
import fs from 'node:fs';
import path from 'node:path';

const FS = path.resolve(process.argv[2] || '.');
const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const J = f => JSON.parse(fs.readFileSync(path.join(FS, f), 'utf8'));
const SETS = (arg('--sets') || 'synth,sample').split(',');
const ONLY = arg('--only') ? arg('--only').split(',') : null;
const pres = {}; for (const s of SETS) pres[s] = J(`presentation/results/eval-${s}.json`).per.filter(P=> !ONLY || ONLY.some(p=> P.id.startsWith(p)));
const uniq = new Map(J('uniqueness/results/score10/score.json').map(r => [r.run, r]));
const FLAG6 = arg('--flag6') ? new Set(JSON.parse(fs.readFileSync(arg('--flag6'), 'utf8'))) : null;
const LT = Math.log(1.25), ANG = 10, DET = 1.25 * 1.25;
const ROLES = ['thin', 'mid', 'long'];
// JSON writes Infinity as null: an open interval's upper end, an unbounded estimate.
const hiInf = v => v == null ? Infinity : v, lo0 = v => v == null ? 0 : v, estInf = v => v == null ? Infinity : v;

function fromPres(sc) {
  const d = {};
  for (const r of ROLES) { const x = sc.dims[r]; d[r] = x ? { T: x.truth, est: estInf(x.est), lo: lo0(x.lo), hi: hiInf(x.hi) } : null; }
  return { d, a: sc.ang };
}
// Pair the presentation's angle entries with the truth's roles through the uniqueness record's
// angles (the same fitted solid, the same pairing: equal angles).
function angByRole(presAng, u) {
  const out = {};
  const q = u && u.iv && u.iv.app && u.iv.app.truthQ;
  if (!q) return out;
  for (const t of q) {
    if (t.angErr == null) continue;
    let best = null;
    for (const [k, x] of Object.entries(presAng)) if (x && x.angle != null && (best == null || Math.abs(x.angle - t.angErr) < Math.abs(presAng[best].angle - t.angErr))) best = k;
    if (best != null && Math.abs(presAng[best].angle - t.angErr) < 0.05) out[t.role] = { ...presAng[best], cone: presAng[best].cone == null ? 180 : presAng[best].cone, key: best, fi: t.fi };
  }
  return out;
}
const disjoint = (x, ys) => ys.every(y => !y || x.hi < y.lo || x.lo > y.hi);
const flagOf = (P, u) => !!(u && u.misfit) || !!(FLAG6 && FLAG6.has(`${P.id}#${P.seed}`));
const covered = x => x.T >= x.lo * 0.999 && x.T <= x.hi * 1.001;

function score(set, rule, misses) {
  const S = { n: 0, cov: { thin: 0, mid: 0, long: 0 }, nr: { thin: 0, mid: 0, long: 0 }, dDet: 0, dAcc: 0, dHold: 0, dBoth: 0, aBoth: 0, aDet: 0, aAcc: 0, aHold: 0, aN: 0, aCov: 0, flagged: 0, thinWidth: [], res: 0, resAcc: 0, zero: 0 };
  for (const P of pres[set]) {
    if (!P.kept) continue;
    const key = `${P.id}#${P.seed}`, u = uniq.get(key);
    const q = rule(P, u);
    if (!q) continue;
    S.n++; if (q.flag) S.flagged++;
    for (const r of ROLES) {
      const x = q.d[r]; if (!x) continue;
      S.nr[r]++;
      if (covered(x)) S.cov[r]++;
      if (!(x.lo > 0)) S.zero++;
      const det = x.hi / Math.max(1e-9, x.lo) <= DET, acc = Math.abs(Math.log(x.est / x.T)) <= LT;
      if (det) { S.dDet++; if (acc) S.dAcc++; if (acc && covered(x)) S.dBoth++; if (covered(x)) S.dHold++; else if (misses) misses.push(`${key} ${r} extent ${x.est.toFixed(2)} (${x.lo.toFixed(2)}–${x.hi.toFixed(2)}) nm, truth ${x.T.toFixed(2)}${acc ? '' : ', beyond 25 %'}`); }
      if (r === 'thin') S.thinWidth.push(x.hi / x.lo);
    }
    const ds = ROLES.map(r => q.d[r]).filter(Boolean), as = ROLES.map(r => q.a[r]).filter(Boolean);
    if (ds.every(x => x.hi / Math.max(1e-9, x.lo) <= DET) && as.every(x => x.cone <= ANG)) {
      S.res++;
      if (ds.every(x => Math.abs(Math.log(x.est / x.T)) <= LT) && as.every(x => x.angle <= ANG)) S.resAcc++;
    }
    for (const r of ROLES) {
      const x = q.a[r]; if (!x) continue;
      S.aN++;
      if (x.angle <= x.cone) S.aCov++;
      if (x.cone <= ANG) { S.aDet++; if (x.angle <= ANG) S.aAcc++; if (x.angle <= ANG && x.angle <= x.cone + 1e-6) S.aBoth++; if (x.angle <= x.cone + 1e-6) S.aHold++; else if (misses) misses.push(`${key} ${r} direction ${x.angle.toFixed(1)}° off, radius ${x.cone.toFixed(1)}°${x.angle <= ANG ? '' : ', beyond 10°'}`); }
    }
  }
  return S;
}

// The jackknife's widening, per truth role, on an estimate that has a value (an unbounded one keeps its interval).
function widenJack(d, a, u) {
  for (const t of u.iv.app.truthQ) {
    const x = d[t.role], j = u.jack && u.jack.J[t.fi]; if (!x || !j) continue;
    const s = j.sdLog == null ? Infinity : j.sdLog;
    // an infinite sd (a drop that left the extent unbounded) opens the upper end only: it is no
    // evidence of a smaller extent
    if (Number.isFinite(x.est)) { if (Number.isFinite(s)) x.lo = Math.min(x.lo, x.est * Math.exp(-2 * s)); x.hi = Math.max(x.hi, Number.isFinite(s) ? x.est * Math.exp(2 * s) : Infinity); }
    if (a[t.role] && j.rmsAng != null) a[t.role] = { ...a[t.role], cone: Math.max(a[t.role].cone, 2 * j.rmsAng) };
  }
}
const Drule = (d, a) => { for (const r of ROLES) if (a[r] && d[r] && !disjoint(d[r], ROLES.filter(o => o !== r).map(o => d[o]))) a[r] = { ...a[r], cone: 180 }; };

const presRule = (name, D = false, jack = false) => (P, u) => {
  const sc = P.sc[name]; if (!sc) return null;
  const { d } = fromPres(sc);
  const a = angByRole(sc.ang, u);
  const flag = flagOf(P, u);
  if (jack && flag && u && u.jack && u.iv && u.iv.app) widenJack(d, a, u);
  if (D) Drule(d, a);
  return { d, a, flag };
};
const uniqRule = name => (P, u) => {
  if (!u || !u.iv || !u.iv[name] || !u.iv[name].truthQ) return null;
  const v = u.iv[name], d = {}, a = {};
  for (const t of v.truthQ) {
    const iq = v.q[t.fi];
    d[t.role] = { T: t.T, est: u.dims[t.fi] == null ? Infinity : u.dims[t.fi], lo: lo0(iq.d[0]), hi: hiInf(iq.d[1]) };
    if (t.angErr != null) a[t.role] = { angle: t.angErr, cone: iq.ang == null ? 180 : (iq.detAng === false && iq.ang <= ANG ? 180 : iq.ang) };
  }
  return { d, a, flag: flagOf(P, u) };
};
// The merged rule: E_L6's extents, today's angular radius (2σ of turnEsds, as the uniqueness study's
// app rule takes it), the jackknife when flagged, then the D rule on the extents.
const mergedRule = (tau = 'E_L6') => (P, u) => {
  const base = presRule(tau, false, false)(P, u), ua = uniqRule('app')(P, u);
  if (!base || !ua) return null;
  const { d } = base, a = { ...ua.a }, flag = flagOf(P, u);
  if (flag && u.jack) widenJack(d, a, u);
  Drule(d, a);
  return { d, a, flag };
};
const RULES = [
  ['today (P0_app: linear esds, held/free in quadrature, cones 2.45σ)', presRule('P0_app')],
  ['today (uniqueness rebuild: linear esds, 2σ)', uniqRule('app')],
  ['E_L6', presRule('E_L6')],
  ['E_L6 + D rule', presRule('E_L6', true)],
  ['E_L6 + D rule + jackknife when flagged', presRule('E_L6', true, true)],
  ['merged rule: E_L6, today\'s radius, D rule, jackknife when flagged', mergedRule('E_L6')],
  ['merged rule with E_L10', mergedRule('E_L10')],
  ['merged rule with E_L12 (Δ 12.5)', mergedRule('E_L12')],
  ['condP (uniqueness)', uniqRule('condP')],
  ['condD (uniqueness)', uniqRule('condD')],
];

const OUT = {}, L = [], MISS = [];
L.push('Scored alike: covered = the truth inside the stated interval (role by role: the truth\'s thinnest, middle, longest extent); determined = interval hi/lo ≤ 1.25² (extent) or radius ≤ 10° (direction); accurate = the estimate within 25 % (|ln| ≤ ln 1.25) or 10° of the truth; holds as stated = a determined quantity whose truth lies inside its own interval or radius. Directions: the truth\'s defined axes paired with the fit\'s. Lower limit 0: intervals reaching 0 nm.', '');
for (const set of SETS) {
  L.push(`### ${set === 'synth' ? 'Synthetic runs that kept a solid' : set === 'sample' ? 'Sample-like proxies' : set}`, '');
  L.push('| rule | runs | flagged | thinnest covered | middle covered | longest covered | lower limit 0 | extents determined: accurate | determined extents holding as stated | directions covered | directions determined: accurate | determined directions holding as stated | runs resolved in full: accurate in full | thinnest hi/lo (median) |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const [name, rule] of RULES) {
    const mm = [];
    const S = score(set, rule, mm);
    if (!S.n) continue;
    (OUT[set] = OUT[set] || {})[name] = S;
    MISS.push(`== ${set}: ${name}: ${mm.length} determined quantities outside their stated interval or radius`, ...mm.map(s=> '   ' + s));
    const tw = S.thinWidth.sort((a, b) => a - b), med = tw.length ? tw[Math.floor(tw.length / 2)] : NaN;
    L.push(`| ${name} | ${S.n} | ${S.flagged} | ${S.cov.thin}/${S.nr.thin} | ${S.cov.mid}/${S.nr.mid} | ${S.cov.long}/${S.nr.long} | ${S.zero} | ${S.dAcc}/${S.dDet} | ${S.dHold}/${S.dDet} | ${S.aCov}/${S.aN} | ${S.aAcc}/${S.aDet} | ${S.aHold}/${S.aDet} | ${S.resAcc}/${S.res} | ${med.toFixed(2)} |`);
  }
  L.push('');
}
const md = L.join('\n');
console.log(md);
if (arg('--md')) fs.writeFileSync(arg('--md'), md + '\n');
if (arg('--json')) fs.writeFileSync(arg('--json'), JSON.stringify(OUT, null, 1));
if (arg('--misses')) fs.writeFileSync(arg('--misses'), MISS.join('\n') + '\n');
