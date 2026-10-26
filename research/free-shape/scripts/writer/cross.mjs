// The presentation study's intervals and the uniqueness study's, scored the same way on the same
// runs, and the merged rule the write-up recommends: E_L6 (presentation: today's esds in the width,
// widened to the search's ends within Δ 6, as column lengths), its directions only where their
// extent is told apart (the D rule), and, where the residuals flag a misfit (worst line segment's
// χ²_ν > 1.25), widened by the delete-one-line jackknife (uniqueness): D·e^(±2 sd) and 2·rms turn.
// Reads results only; runs nothing.
//   node cross.mjs <fs folder> [--md out.md]
import fs from 'node:fs';
import path from 'node:path';

const FS = path.resolve(process.argv[2] || '.');
const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const J = f => JSON.parse(fs.readFileSync(path.join(FS, f), 'utf8'));
const pres = { synth: J('presentation/results/eval-synth.json').per, sample: J('presentation/results/eval-sample.json').per };
const uniq = new Map(J('uniqueness/results/score10/score.json').map(r => [r.run, r]));
const LT = Math.log(1.25), ANG = 10, DET = 1.25 * 1.25;
const ROLES = ['thin', 'mid', 'long'];
// JSON writes Infinity as null: an open interval's upper end, an unbounded estimate.
const hiInf = v => v == null ? Infinity : v, lo0 = v => v == null ? 0 : v;

// One rule's quantities for one run, in one form: dims[role] = { T, est, lo, hi }, ang[role] = { angle, cone } | null.
function fromPres(sc) {
  const d = {}, a = {};
  for (const r of ROLES) { const x = sc.dims[r]; d[r] = x ? { T: x.truth, est: x.est, lo: lo0(x.lo), hi: hiInf(x.hi) } : null; }
  return { d, a: sc.ang };
}
// Pair the presentation's angle entries (prin, other0, other1) with the truth's roles through the
// uniqueness record's angles (the same fitted solid, the same pairing: equal angles).
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

function score(set, rule) {
  const S = { n: 0, cov: { thin: 0, mid: 0, long: 0 }, nr: { thin: 0, mid: 0, long: 0 }, dDet: 0, dAcc: 0, aDet: 0, aAcc: 0, aN: 0, aCov: 0, flagged: 0, thinWidth: [], res: 0, resAcc: 0 };
  for (const P of pres[set]) {
    if (!P.kept) continue;
    const u = uniq.get(`${P.id}#${P.seed}`);
    const q = rule(P, u);
    if (!q) continue;
    S.n++; if (q.flag) S.flagged++;
    for (const r of ROLES) {
      const x = q.d[r]; if (!x) continue;
      S.nr[r]++;
      if (x.T >= x.lo * 0.999 && x.T <= x.hi * 1.001) S.cov[r]++;
      const det = x.hi / Math.max(1e-9, x.lo) <= DET, acc = Math.abs(Math.log(x.est / x.T)) <= LT;
      if (det) { S.dDet++; if (acc) S.dAcc++; }
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
      if (x.cone <= ANG) { S.aDet++; if (x.angle <= ANG) S.aAcc++; }
    }
  }
  return S;
}

// Rules.
const presRule = (name, D = false, jack = false) => (P, u) => {
  const sc = P.sc[name]; if (!sc) return null;
  const { d } = fromPres(sc);
  const a = angByRole(sc.ang, u);
  const flag = !!(u && u.misfit);
  if (jack && flag && u.jack && u.iv && u.iv.app) {
    for (const t of u.iv.app.truthQ) {
      const x = d[t.role], j = u.jack.J[t.fi]; if (!x || !j) continue;
      x.lo = Math.min(x.lo, x.est * Math.exp(-2 * j.sdLog)); x.hi = Math.max(x.hi, x.est * Math.exp(2 * j.sdLog));
      if (a[t.role]) a[t.role] = { ...a[t.role], cone: Math.max(a[t.role].cone, 2 * j.rmsAng) };
    }
  }
  if (D) for (const r of ROLES) if (a[r] && d[r] && !disjoint(d[r], ROLES.filter(o => o !== r).map(o => d[o]))) a[r] = { ...a[r], cone: 180 };
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
  return { d, a, flag: !!u.misfit };
};

// E_L6's extents with today's angular radius (turnEsds, as the uniqueness study's app rule takes it)
// for the directions, then the D rule on E_L6's extents and the jackknife when flagged.
const hybridRule = (P, u) => {
  const base = presRule('E_L6', false, false)(P, u), ua = uniqRule('app')(P, u);
  if (!base || !ua) return null;
  const { d } = base, a = { ...ua.a }, flag = !!(u && u.misfit);
  if (flag && u.jack) for (const t of u.iv.app.truthQ) {
    const x = d[t.role], j = u.jack.J[t.fi]; if (!x || !j) continue;
    x.lo = Math.min(x.lo, x.est * Math.exp(-2 * j.sdLog)); x.hi = Math.max(x.hi, x.est * Math.exp(2 * j.sdLog));
    if (a[t.role]) a[t.role] = { ...a[t.role], cone: Math.max(a[t.role].cone, 2 * j.rmsAng) };
  }
  for (const r of ROLES) if (a[r] && d[r] && !disjoint(d[r], ROLES.filter(o => o !== r).map(o => d[o]))) a[r] = { ...a[r], cone: 180 };
  return { d, a, flag };
};
const RULES = [
  ['app today (presentation\'s P0_app: linear esds, held/free in quadrature, cones 2.45σ)', presRule('P0_app')],
  ['app today (uniqueness\'s app: linear esds, 2σ)', uniqRule('app')],
  ['E_L6', presRule('E_L6')],
  ['E_L6 + D rule', presRule('E_L6', true)],
  ['E_L6 + D rule + jackknife when flagged', presRule('E_L6', true, true)],
  ["E_L6 extents, today's angular radius, D rule, jackknife when flagged", hybridRule],
  ['E_L6 at the BIC-picked background + D + jackknife', presRule('E_L6pick', true, true)],
  ['condP (uniqueness)', uniqRule('condP')],
  ['condD (uniqueness)', uniqRule('condD')],
];

const OUT = {};
const L = [];
L.push('Scored alike: covered = the truth inside the stated interval (role by role: the truth\'s thinnest, middle, longest extent); determined = interval hi/lo ≤ 1.25² (extent) or radius ≤ 10° (direction); accurate = the estimate within 25 % (|ln| ≤ ln 1.25) or 10° of the truth. Directions: the truth\'s defined axes paired with the fit\'s.', '');
for (const set of ['synth', 'sample']) {
  L.push(`### ${set === 'synth' ? 'Synthetic runs that kept a solid' : 'Sample-like proxies'}`, '');
  L.push('| rule | runs | flagged | thinnest covered | middle covered | longest covered | extents determined: accurate | directions covered | directions determined: accurate | runs resolved in full: accurate in full | thinnest hi/lo (median) |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|');
  for (const [name, rule] of RULES) {
    const S = score(set, rule);
    (OUT[set] = OUT[set] || {})[name] = S;
    const tw = S.thinWidth.sort((a, b) => a - b), med = tw.length ? tw[Math.floor(tw.length / 2)] : NaN;
    L.push(`| ${name} | ${S.n} | ${S.flagged} | ${S.cov.thin}/${S.nr.thin} | ${S.cov.mid}/${S.nr.mid} | ${S.cov.long}/${S.nr.long} | ${S.dAcc}/${S.dDet} | ${S.aCov}/${S.aN} | ${S.aAcc}/${S.aDet} | ${S.resAcc}/${S.res} | ${med.toFixed(2)} |`);
  }
  L.push('');
}
const md = L.join('\n');
console.log(md);
if (arg('--md')) fs.writeFileSync(arg('--md'), md + '\n');
if (arg('--json')) fs.writeFileSync(arg('--json'), JSON.stringify(OUT, null, 1));
