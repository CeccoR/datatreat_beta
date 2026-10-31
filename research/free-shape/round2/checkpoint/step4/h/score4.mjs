#!/usr/bin/env node
/* Step 4's scoring of a tag's records (results/<tag>, the minima stage) on the kept truths:
   the reported fit's extents and principal axis against the truth with
   L: the local error (curvature: D·e^(±2σ), σ = Desd/D; a group's members: the group's interval
      and the members' values), the angle 2·esdAngle (profile);
   B: the second error alone (the hull of the fit's value and the paired values of the minima within Δ*);
   C: L and B together (hull; angles max(2σ, spread));
   U: the hull of every minimum's own local interval within Δ* (round 1's P2);
   J: C with the jackknife (flagged rows).
   Δ* from --delta (default 12.5). Also the uniqueness verdicts, the stage's cost, and the changes
   against step 3's P1 (the same search without the stage).
   node score4.mjs [--tag S1] [--delta 12.5] [--rows] [--json out.json] */
import fs from 'node:fs';
import path from 'node:path';
import { readResult, compareSolids, laueRotations, phaseQ, ENG, fromCols, dimOf, mv } from './lib.mjs';
const HERE = path.dirname(new URL(import.meta.url).pathname), FS2 = path.resolve(HERE, '..', '..');
const arg = (k, d) => process.argv.includes('--' + k) ? process.argv[process.argv.indexOf('--' + k) + 1] : d;
const tag = arg('tag', 'S1'), DSTAR = +arg('delta', 12.5), REF = arg('ref', path.join(FS2, 'step3/hp/results/P1'));
const design = JSON.parse(fs.readFileSync(path.join(FS2, 'design', 'design.json'), 'utf8'));
const ONE = new Set(['cylinder', 'spheroid', 'sqbox']), REV = new Set(['cylinder', 'spheroid']);
const BOD = ENG.BODIES;
const qOf = new Map(), qq = (id, type) => { const k = id + type; if (!qOf.has(k)){ const q = phaseQ(id); qOf.set(k, { shapeType: type, laue: q.laue, Bm: q.Bm }); } return qOf.get(k); };
export function load(t = tag, dir = path.join(HERE, 'results', t)){
  const X = [];
  for (const row of design.rows.filter(r=> r.split === 'tuning' && r.screen)){
    const fn = path.join(dir, row.id + '.json'); if (!fs.existsSync(fn)) continue;
    const o = readResult(fs.readFileSync(fn, 'utf8')), r = o.records[0];
    const fr = path.join(REF, row.id + '.json'), p = fs.existsSync(fr) ? readResult(fs.readFileSync(fr, 'utf8')) : null;
    X.push({ row, o, r, p: p && p.records[0], clean: !row.error, ek: row.error ? row.error.kind : 'none', flag: !!(r.check && r.check.flagged), truth: row.kind === 'truth' });
  }
  return X;
}
const lg = d => Math.log(Number.isFinite(d) ? d : 1e4);
const hull = (...iv) => [Math.min(...iv.map(i=> i[0])), Math.max(...iv.map(i=> i[1]))];
// the minima within Δ* paired with the reported fit (engine's minimaMatch)
export function pairedMinima(x, dstar = DSTAR){
  const r = x.r, type = r.solid.type, q = qq(x.o.phase, type), fit = { W: r.solid.W, R: fromCols(r.solid.axes) };
  return (r.info.minima || []).filter(m=> m.delta <= dstar).map(m=> ({ m, p: ENG.minimaMatch(q, fit, { W: m.W, R: m.R }, false) }));
}
// per truth extent and the principal axis: the intervals
export function intervals(x, dstar = DSTAR){
  const r = x.r, T = x.o.truth, type = r.solid.type, rep = r.report, nW = rep.dims.length, wIx = nW === 2 ? [0, 0, 1] : [0, 1, 2];
  const acc = compareSolids(r.solid, T, { rots: laueRotations(x.o.phase) });
  const PM = pairedMinima(x, dstar), out = { ext: [], ax: null, n: PM.length };
  for (const [ri, fi] of acc.pairs){
    if (ONE.has(T.type) && ri === 1) continue;
    const j = wIx[fi], d = rep.dims[j], D = r.solid.dims[fi], Dt = T.dims[ri];
    if (D === Infinity){ out.ext.push({ inf: true, Dt }); continue; }
    const g = rep.groups && rep.groups.find(g=> g.axes.includes(j));
    const s = Number.isFinite(d.Desd) ? d.Desd/D : g && Number.isFinite(g.Desd) ? g.Desd/g.D : 0;
    let L = Number.isFinite(d.Desd) || !g ? [D*Math.exp(-2*s), D*Math.exp(2*s)] : hull([g.D*Math.exp(-2*s), g.D*Math.exp(2*s)], ...g.axes.map(i=> [rep.dims[i].D, rep.dims[i].D]));
    const Lw = 2*s < 1 ? [D/(1 + 2*s), D/(1 - 2*s)] : [D/(1 + 2*s), Infinity];
    const pts = PM.map(({ p })=> dimOf(p.Wb[fi]));
    const B = hull([D, D], ...pts.map(t=> [t, t]));
    const C = hull(L, B);
    const U = hull(L, ...PM.map(({ m, p })=>{ const Wm = BOD[type].axes(m.W), jj = p.p[fi], sm = m.s.w[jj]/Wm[jj], Dm = dimOf(Wm[jj]); return Number.isFinite(sm) && Number.isFinite(Dm) ? [Dm*Math.exp(-2*sm), Dm*Math.exp(2*sm)] : [Dm, Dm]; }));
    const J = x.flag && Number.isFinite(d.jackLo) ? hull(C, [d.jackLo, d.jackHi]) : C;
    const cov = iv => Dt >= iv[0] && Dt <= iv[1], hw = iv => Math.log(iv[1]/Math.max(1e-9, iv[0]))/2;
    out.ext.push({ Dt, D, e: Math.log(D/Dt), s, z: Math.log(D/Dt)/s, L: cov(L), Lw: cov(Lw), B: cov(B), C: cov(C), U: cov(U), J: cov(J), hL: hw(L), hC: hw(C), hU: hw(U), hJ: hw(J), sp: hw(B) });
  }
  // the truth's most distinct axis (step 3's rule)
  const und = new Set();
  if (REV.has(T.type)) [0, 1].forEach(i=> und.add(i));
  if (T.type !== 'box' && T.type !== 'sqbox') for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) if (i !== j && Math.abs(lg(T.dims[i]) - lg(T.dims[j])) < 0.04) und.add(i);
  const gap = i => Math.min(...[0, 1, 2].filter(j=> j !== i).map(j=> Math.abs(lg(T.dims[i]) - lg(T.dims[j]))));
  const prin = [0, 1, 2].filter(i=> !und.has(i)).sort((p, q)=> gap(q) - gap(p))[0];
  if (prin != null && acc.principal != null){
    const fp = acc.pairs.find(p=> p[0] === prin)[1], ax = rep.axes.find(a=> a.axis === fp);
    const rL = ax && Number.isFinite(ax.esdAngle) ? 2*ax.esdAngle : 0;
    const sp = Math.max(0, ...PM.map(({ p })=> p.ang[fp]).filter(Number.isFinite))*180/Math.PI;
    const rC = Math.max(rL, sp), rJ = Math.max(rC, x.flag && ax && Number.isFinite(ax.jackTurn) ? ax.jackTurn : 0);
    out.ax = { e: acc.principal, rL, sp, rC, rJ, L: acc.principal <= rL, C: acc.principal <= rC, J: acc.principal <= rJ };
  }
  out.acc = acc;
  return out;
}
const med = a => { const s = a.filter(x=> x != null && !Number.isNaN(x)).sort((p, q)=> p - q); return s.length ? (s[(s.length - 1) >> 1] + s[s.length >> 1])/2 : NaN; };
const f = (x, d = 2) => x === Infinity ? '∞' : x == null || Number.isNaN(x) ? '—' : (+x).toFixed(d);
const pc = (a, b) => `${a}/${b}`;
if (process.argv[1] && process.argv[1].endsWith('score4.mjs')){
  const X = load();
  const kept = X.filter(x=> x.truth && x.r.kept);
  const L = [];
  L.push(`tag ${tag}, Δ* ${DSTAR}: ${X.length} runs, ${kept.length} kept truths`);
  // the stage: cost, minima, uniqueness, changes against P1
  const st = X.filter(x=> x.r.info && x.r.info.minimaStage);
  const sumS = X.reduce((t, x)=> t + x.r.search.evals - (x.r.min ? x.r.min.evals : 0), 0), sumM = X.reduce((t, x)=> t + (x.r.min ? x.r.min.evals : 0), 0), sumP = X.reduce((t, x)=> t + (x.p ? x.p.search.evals : 0), 0);
  L.push(`cost: stage ${sumM} evaluations, search without it ${sumS} (P1's search ${sumP}): ${f(sumM/sumS, 3)}×; per staged run median ${f(med(st.map(x=> x.r.min.evals/(x.r.search.evals - x.r.min.evals))), 3)}× (max ${f(Math.max(...st.map(x=> x.r.min.evals/(x.r.search.evals - x.r.min.evals))), 2)}); ms ${X.reduce((t, x)=> t + (x.r.min ? x.r.min.ms : 0), 0)} of ${X.reduce((t, x)=> t + x.r.search.ms, 0)}`);
  L.push(`staged runs ${st.length}: ends ${med(st.map(x=> x.r.info.minimaStage.ends))}, candidates ${med(st.map(x=> x.r.info.minimaStage.cands))} (max ${Math.max(...st.map(x=> x.r.info.minimaStage.cands))}), distinct minima within keep ${med(st.map(x=> x.r.info.minima.length))}`);
  for (const D of [6, 10, 12.5, 15, 20]){
    const n = st.map(x=> x.r.info.minima.filter(m=> m.delta <= D).length);
    L.push(`  Δ* ${D}: unique ${n.filter(t=> t === 1).length}/${st.length}, 2: ${n.filter(t=> t === 2).length}, 3+: ${n.filter(t=> t >= 3).length}`);
  }
  const lowered = st.filter(x=> x.r.info.minimaStage.after < x.r.info.minimaStage.before - 1e-6);
  L.push(`stage's lowest below the search's free fit: ${lowered.length} (Δ in χ²_ν: ${lowered.map(x=> f((x.r.info.minimaStage.before - x.r.info.minimaStage.after)/Math.max(1, x.r.chi2nu), 2)).join(', ')})`);
  const oc = x => x.kept ? (x.held ? 'held' : 'free') : 'rej';
  const chg = X.filter(x=> x.p && oc(x.r) !== oc(x.p));
  L.push(`outcome changed against P1: ${chg.length} ${chg.map(x=> x.row.id + ' ' + oc(x.p) + '→' + oc(x.r)).join('; ')}`);
  const dchi = X.filter(x=> x.p && x.r.kept && x.p.kept).map(x=> ({ id: x.row.id, d: (x.r.chi2 - x.p.chi2)/Math.max(1, x.r.chi2nu) }));
  L.push(`returned χ² against P1 (χ²_ν units): lower by >0.5 on ${dchi.filter(t=> t.d < -0.5).length} (${dchi.filter(t=> t.d < -0.5).map(t=> t.id + ' ' + f(t.d, 1)).join(', ')}), higher by >0.5 on ${dchi.filter(t=> t.d > 0.5).length} (${dchi.filter(t=> t.d > 0.5).map(t=> t.id + ' +' + f(t.d, 1)).join(', ')})`);
  // accuracy
  const accOf = r => r && r.acc ? r.acc : null;
  const both = kept.filter(x=> x.p && x.p.kept && accOf(x.p));
  L.push(`accuracy (kept in both, ${both.length}): worst extent median ${f(100*med(both.map(x=> x.r.acc.dimMax)), 1)} % (P1 ${f(100*med(both.map(x=> x.p.acc.dimMax)), 1)} %), principal median ${f(med(both.map(x=> x.r.acc.principal)), 2)}° (P1 ${f(med(both.map(x=> x.p.acc.principal)), 2)}°); changed by >1 %: ${both.filter(x=> Math.abs(x.r.acc.dimMax - x.p.acc.dimMax) > 0.01).map(x=> x.row.id + ' ' + f(100*x.p.acc.dimMax, 0) + '→' + f(100*x.r.acc.dimMax, 0)).join(', ')}`);
  // coverage
  const groups = [['clean, not flagged', x=> x.clean && !x.flag], ['error, not flagged', x=> !x.clean && !x.flag], ['error, flagged', x=> !x.clean && x.flag], ['all kept', x=> true]];
  L.push('', '| kept truths | runs | extents (unbounded) | L local | Lw (in W) | B between alone | C combined | U union | J with jackknife | med half-width L / C / U | principal axes: L / C / J | med radius L / C |', '|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const [nm, g] of groups){
    const G = kept.filter(g), I = G.map(x=> intervals(x)), E = I.flatMap(i=> i.ext.filter(e=> !e.inf)), A = I.map(i=> i.ax).filter(Boolean);
    const c = k => E.filter(e=> e[k]).length;
    L.push(`| ${nm} | ${G.length} | ${E.length} (${I.flatMap(i=> i.ext.filter(e=> e.inf)).length}) | ${pc(c('L'), E.length)} | ${pc(c('Lw'), E.length)} | ${pc(c('B'), E.length)} | ${pc(c('C'), E.length)} | ${pc(c('U'), E.length)} | ${pc(c('J'), E.length)} | ${f(100*med(E.map(e=> e.hL)), 1)} / ${f(100*med(E.map(e=> e.hC)), 1)} / ${f(100*med(E.map(e=> e.hU)), 1)} % | ${pc(A.filter(a=> a.L).length, A.length)} / ${pc(A.filter(a=> a.C).length, A.length)} / ${pc(A.filter(a=> a.J).length, A.length)} | ${f(med(A.map(a=> a.rL)), 1)} / ${f(med(A.map(a=> a.rC)), 1)}° |`);
  }
  // z of the local error, clean rows
  const Ez = kept.filter(x=> x.clean && !x.flag).flatMap(x=> intervals(x).ext.filter(e=> !e.inf && Number.isFinite(e.z) && e.s > 0));
  const zs = Ez.map(e=> Math.abs(e.z)).sort((a, b)=> a - b);
  L.push('', `local z on clean rows (${zs.length}): median |z| ${f(med(zs))} (normal 0.67), 90 % ${f(zs[Math.floor(0.9*zs.length)])}, rms of |z|<5 ${f(Math.sqrt(zs.filter(z=> z < 5).reduce((t, z)=> t + z*z, 0)/zs.filter(z=> z < 5).length))}, |z|>2: ${zs.filter(z=> z > 2).length}, >3: ${zs.filter(z=> z > 3).length}, >5: ${zs.filter(z=> z > 5).length}`);
  // uniqueness verdicts
  L.push('', '| kept truths | unique (one minimum) | unique and L covers all | unique, L misses | several | several: L covers | several: C covers, L not | several: neither |', '|---|---|---|---|---|---|---|---|');
  for (const [nm, g] of groups){
    const G = kept.filter(g).map(x=> ({ x, i: intervals(x) }));
    const okL = ({ i })=> i.ext.every(e=> e.inf || e.L) && (!i.ax || i.ax.L), okC = ({ i })=> i.ext.every(e=> e.inf || e.C) && (!i.ax || i.ax.C);
    const U = G.filter(t=> t.i.n <= 1), S = G.filter(t=> t.i.n > 1);
    L.push(`| ${nm} | ${pc(U.length, G.length)} | ${U.filter(okL).length} | ${U.filter(t=> !okL(t)).length} (${U.filter(t=> !okL(t)).map(t=> t.x.row.id).join(', ')}) | ${S.length} | ${S.filter(okL).length} | ${S.filter(t=> !okL(t) && okC(t)).length} | ${S.filter(t=> !okC(t)).length} (${S.filter(t=> !okC(t)).map(t=> t.x.row.id).join(', ')}) |`);
  }
  if (process.argv.includes('--rows')){
    L.push('', '| row | error | flag | outcome | minima ≤ Δ* (≤ keep) | extents: e (L/C) | principal e°, rL/rC | stage evals × search |', '|---|---|---|---|---|---|---|---|');
    for (const x of kept){
      const i = intervals(x);
      L.push(`| ${x.row.id} | ${x.ek}${x.row.error ? ' ' + f(x.row.error.strength, 2) : ''} | ${x.flag ? 'F' : ''} | ${x.r.held ? 'held' : 'free'} | ${i.n} (${x.r.info.minima ? x.r.info.minima.length : '—'}) | ${i.ext.map(e=> e.inf ? '∞' : f(100*e.e, 0) + '% ' + (e.L ? 'L' : '·') + (e.C ? 'C' : '·')).join('; ')} | ${i.ax ? f(i.ax.e, 1) + ' ' + f(i.ax.rL, 1) + '/' + f(i.ax.rC, 1) : '—'} | ${x.r.min ? f(x.r.min.evals/(x.r.search.evals - x.r.min.evals), 2) : '—'} |`);
    }
  }
  console.log(L.join('\n'));
}
