#!/usr/bin/env node
/* (b) The keep rules scored on keep5.json (keep5.mjs). G = the larger of the free and held routes'
   gains before the stage, in χ²/χ²_ν,iso (an early rejection: the brief trials' gain). Thresholds are
   set on the nulls' draws 0–2 (--cal) and scored on draws 3–4 (fresh) and on all.
   node keep-rules.mjs [--nulls] [--sys] [--rules] [--mild] */
import fs from 'node:fs';
import { q, f } from './lib5.mjs';
const a = process.argv.slice(2), opt = {}; for (let i = 0; i < a.length; i++) if (a[i].startsWith('--')) opt[a[i].slice(2)] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true;
const D = JSON.parse(fs.readFileSync('keep5.json', 'utf8'));
const SOL = ['box', 'sqbox', 'cylinder', 'ellcyl', 'ellipsoid', 'spheroid'];
for (const o of D){
  const gs = [o.gainFree, o.gainHeld, o.gain].filter(Number.isFinite);
  o.G = gs.length ? Math.max(...gs) : o.gainBrief;
  o.lnN = Math.log(o.N);
  // today's ΔBIC on the route the search chose (held when held)
  o.dBIC = Number.isFinite(o.gain) ? -o.gain + o.dP*o.lnN : -o.gainBrief + o.dPheld*o.lnN;
  o.flag = !!o.flagKeep;
}
const nulls = D.filter(o=> o.set === 'null'), cal = nulls.filter(o=> o.draw <= 2), test = nulls.filter(o=> o.draw >= 3);
const mild = D.filter(o=> o.set === 'mild'), strong = D.filter(o=> o.set === 'strong');
const cl = s => s.filter(o=> !o.error), er = s => s.filter(o=> o.error);
console.log(`nulls ${nulls.length} (cal ${cal.length}, test ${test.length}), mild ${mild.length}, strong ${strong.length}`);
if (opt.nulls){
  console.log('\n| body | clean nulls: n, median, 90 %, 95 %, 99 %, max G | kept by ΔBIC < −10 | error nulls: n, median, 95 %, max G | kept by ΔBIC | flagged (error) |');
  console.log('|---|---|---|---|---|---|');
  for (const s of SOL){ const c = cl(nulls).filter(o=> o.solid === s), e = er(nulls).filter(o=> o.solid === s), G = x=> x.map(o=> o.G);
    console.log(`| ${s} | ${c.length}: ${f(q(G(c), .5))}, ${f(q(G(c), .9))}, ${f(q(G(c), .95))}, ${f(q(G(c), .99))}, ${f(Math.max(...G(c)))} | ${c.filter(o=> o.dBIC < -10).length} | ${e.length}: ${f(q(G(e), .5))}, ${f(q(G(e), .95))}, ${f(Math.max(...G(e)))} | ${e.filter(o=> o.dBIC < -10).length} | ${e.filter(o=> o.flag).length} |`); }
}
if (opt.sys){
  console.log('\n| body | system | clean nulls n | mean G | median | max | error nulls: mean, max |');
  for (const s of SOL) for (const y of ['tric', 'mono', 'orth', 'tetr', 'trig', 'hex', 'cub']){
    const c = cl(nulls).filter(o=> o.solid === s && o.sys === y), e = er(nulls).filter(o=> o.solid === s && o.sys === y); if (!c.length && !e.length) continue;
    const m = x => x.length ? x.reduce((t, o)=> t + o.G, 0)/x.length : NaN;
    console.log(`| ${s} | ${y} | ${c.length} | ${f(m(c))} | ${f(q(c.map(o=> o.G), .5))} | ${f(Math.max(...c.map(o=> o.G)))} | ${f(m(e))}, ${f(Math.max(...e.map(o=> o.G)))} |`); }
}
export { D, nulls, cal, test, mild, strong };
// ---- the rules: each { name, keep(o) } ----
const chi2q = (k, p) => { // the χ²_k quantile (Wilson–Hilferty, k ≥ 1), p the upper tail
  const z = (()=>{ let lo = -10, hi = 10; for (let i = 0; i < 80; i++){ const m = (lo + hi)/2, t = 1/(1 + 0.2316419*Math.abs(m)), d = 0.3989422804014327*Math.exp(-m*m/2), u = d*t*(0.319381530 + t*(-0.356563782 + t*(1.781477937 + t*(-1.821255978 + t*1.330274429)))), up = m >= 0 ? u : 1 - u; if (up > p) lo = m; else hi = m; } return (lo + hi)/2; })();
  return k*Math.pow(1 - 2/(9*k) + z*Math.sqrt(2/(9*k)), 3); };
export { chi2q };
const by = (set, key) => { const m = {}; for (const o of set){ (m[key(o)] = m[key(o)] || []).push(o); } return m; };
function calib(set, p, margin, key = o=> o.solid){ const g = by(set, key), T = {}; for (const k in g) T[k] = q(g[k].map(o=> o.G), p) + margin; return T; }
function score(rule){
  const k = s => s.filter(rule.keep).length;
  return { nullCal: k(cl(cal)), nCal: cl(cal).length, nullTest: k(cl(test)), nTest: cl(test).length, nullErr: k(er(nulls)), nErr: er(nulls).length,
    mildC: k(cl(mild)), nMildC: cl(mild).length, mildE: k(er(mild)), nMildE: er(mild).length, strong: k(strong), nStrong: strong.length };
}
export function rules(extra = []){
  const L = [{ name: 'ΔBIC < −10 (today)', keep: o=> o.dBIC < -10 }];
  for (const [p, m] of [[0.95, 0], [0.95, 2], [0.99, 0], [0.99, 2], [1, 0], [1, 2]]){
    const T = calib(cl(cal), p, m);
    L.push({ name: `G > clean nulls' ${p === 1 ? 'max' : (100*p) + ' %'} per body${m ? ' + ' + m : ''}`, keep: o=> o.G > T[o.solid], T });
  }
  return L.concat(extra);
}
export function table(L){
  console.log('\n| rule | clean nulls kept: draws 0–2 (set) | draws 3–4 (fresh) | error nulls kept | mild clean kept | mild error kept | strong kept |');
  console.log('|---|---|---|---|---|---|---|');
  for (const r of L){ const s = score(r); console.log(`| ${r.name} | ${s.nullCal}/${s.nCal} | ${s.nullTest}/${s.nTest} | ${s.nullErr}/${s.nErr} | ${s.mildC}/${s.nMildC} | ${s.mildE}/${s.nMildE} | ${s.strong}/${s.nStrong} |`); }
}
export { cl, er, calib, score, by };
if (opt.rules) table(rules());
// ---- step 5's candidates: per body, per body and symmetry (k: the class's visible terms), with the check ----
const K = { tric: 5, mono: 3, orth: 2, tetr: 1, trig: 1, hex: 1, cub: 0 };
const grp = o => K[o.sys] >= 3 ? 'low' : 'high';
export function candidates(margin = 2){
  const L = [];
  const Tb = calib(cl(cal), 0.99, margin), Tm = calib(cl(cal), 1, margin), Tbs = calib(cl(cal), 1, margin, o=> o.solid + '|' + grp(o));
  const Tpool = Math.max(...cl(cal).map(o=> o.G)) + margin;
  const withCheck = (r, nm) => ({ name: r.name + nm, keep: o=> r.keep(o) && (!o.flag || o.dBIC < -10) });
  const base = [
    { name: `G > ${(Tpool).toFixed(1)} (every body: the clean nulls' max + ${margin})`, keep: o=> o.G > Tpool },
    { name: `G > the body's clean nulls' 99 % + ${margin}`, keep: o=> o.G > Tb[o.solid], T: Tb },
    { name: `G > the body's clean nulls' max + ${margin}`, keep: o=> o.G > Tm[o.solid], T: Tm },
    { name: `G > the body's max + ${margin} in its symmetry group (−1, 2/m | the rest)`, keep: o=> o.G > Tbs[o.solid + '|' + grp(o)], T: Tbs },
  ];
  for (const r of base){ L.push(r); L.push(withCheck(r, '; flagged: also ΔBIC < −10')); }
  return L;
}
if (opt.cand){ const L = candidates(+(opt.margin ?? 2)); table([rules()[0], ...L]); for (const r of L) if (r.T) console.log(r.name, JSON.stringify(Object.fromEntries(Object.entries(r.T).map(([k, v])=> [k, +v.toFixed(1)])))); }
// ---- the likelihood-ratio test with the class's dof: G > χ²_{k+1}(1 − α) + margin ----
export function lrtRules(){
  const L = [];
  for (const [a, m] of [[0.01, 0], [0.001, 0], [0.001, 2], [0.0001, 0]]){
    const T = o => chi2q(K[o.sys] + 1, a) + m;
    const r = { name: `G > χ²_{k+1}(${1 - a}) + ${m}`, keep: o=> o.G > T(o), Tk: [0, 1, 2, 3, 5].map(k=> chi2q(k + 1, a) + m) };
    L.push(r, { name: r.name + '; flagged: also ΔBIC < −10', keep: o=> r.keep(o) && (!o.flag || o.dBIC < -10) });
  }
  return L;
}
if (opt.lrt){ const L = lrtRules(); table(L); for (const r of L) if (r.Tk) console.log(r.name, 'k = 0, 1, 2, 3, 5:', r.Tk.map(x=> x.toFixed(1)).join(', ')); }
