#!/usr/bin/env node
/* node invariants.mjs [--set synth|sample] [--tau 10]
   What near-equivalent minima share. For each run, the minima of the searched solid within
   Δ ≤ τ (the uniqueness study's, the reported one first) and, where searched, the other
   solids' fits within ΔBIC ≤ τ: per reflection family the mean column length of its
   members, L̄_hkl (each member drawn with equal area: the family's integral breadth gives
   the mean of the members' 1/width, i.e. of their ⟨L⟩_V), and its spread over the members
   (sd of log L, the peak's departure from one Lorentzian). Compared across the minima
   (spread) and with the truth (error), beside the dimensions' spread and error. */
import fs from 'node:fs';
import path from 'node:path';
import { loadRun, CASES, FAMILIES, memberLs, align, alignL, Lprin, Lcol, median, quantile, fmt, HERE } from './plib.mjs';
/* the direction-averaged column length (400 Fibonacci directions): the mean ⟨L⟩_V, and the
   harmonic mean (the mean of the widths: what one isotropic size reads) */
const DIRS = Array.from({ length: 400 }, (_, i)=> { const z = 1 - (2*i + 1)/400, r = Math.sqrt(1 - z*z), p = i*Math.PI*(3 - Math.sqrt(5)); return [r*Math.cos(p), r*Math.sin(p), z]; });
const avgL = s => { const L = DIRS.map(u=> Math.min(1e4, Lcol(s, u))); return { mean: L.reduce((t, x)=> t + x, 0)/L.length, harm: L.length/L.reduce((t, x)=> t + 1/x, 0) }; };
// each family's members' column lengths, sorted (invariant under the crystal's symmetry)
const sortedMembers = s => memberLs(s).map(L=> L.map(x=> Math.min(1e4, x)).sort((a, b)=> a - b));
import { minimaOf, classFits } from './approaches.mjs';
const a = process.argv.slice(2), opt = {};
for (let i = 0; i < a.length; i++){ if (a[i].startsWith('--')){ const k = a[i].slice(2); opt[k] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true; } }
const SET = opt.set || 'synth', TAU = +(opt.tau || 10);
const famStats = s => memberLs(s).map(L=> { const f = L.map(x=> Number.isFinite(x) ? x : 1e4), lg = f.map(Math.log), m = lg.reduce((t, x)=> t + x, 0)/lg.length;
  return { mean: f.reduce((t, x)=> t + x, 0)/f.length, sd: Math.sqrt(lg.reduce((t, x)=> t + (x - m)**2, 0)/lg.length) }; });
const rows = [];
for (const c of CASES.filter(c=> c.kind === SET)) for (const seed of c.seeds){
  const R = loadRun(c.id, seed);
  if (!R.uq || !R.uq.reported || !R.truth) continue;
  const ms = minimaOf(R).filter(m=> m.isRep || m.D <= TAU);
  const cf = Object.keys(R.xc).length >= 5 ? classFits(R).fits.filter(f=> f.dBIC <= TAU && f.type !== R.type) : [];
  const sols = [...ms.map(m=> m.solid), ...cf.map(f=> f.solid)];
  const rep = ms[0].solid, T = famStats(R.truth), S = sols.map(famStats);
  // column lengths: spread over the minima (max/min of each family's mean) and the reported one's error
  const famSpread = FAMILIES.map((f, j)=> { const v = S.map(s=> s[j].mean); return Math.max(...v)/Math.min(...v); });
  const famErr = FAMILIES.map((f, j)=> S[0][j].mean/T[j].mean - 1);
  // dimensions (principal column lengths): spread over the minima, paired with the reported one, and its error
  const Lr = Lprin(rep);
  const dimSpread = [0, 1, 2].map(i=> { const v = sols.map(s=> { const al = alignL(s, rep); return Lprin(s)[al.per[i].fi]; }); return Math.max(...v)/Math.min(...v); });
  const at = alignL(rep, R.truth), Lt = Lprin(R.truth);
  const dimErr = [0, 1, 2].map(ri=> Lr[at.per[ri].fi]/Lt[ri] - 1);
  // sorted members: spread over the fits and the reported one's error, per (family, rank)
  const SM = sols.map(sortedMembers), TM = sortedMembers(R.truth);
  const memSpread = [], memErr = [];
  TM.forEach((L, j)=> L.forEach((t, k)=> { const v = SM.map(m=> m[j][k]); memSpread.push(Math.max(...v)/Math.min(...v)); memErr.push(SM[0][j][k]/t - 1); }));
  const shortest = sols.map(x=> Math.min(...sortedMembers(x).map(L=> L[0]))), tShort = Math.min(...TM.map(L=> L[0]));
  const A = sols.map(avgL), AT = avgL(R.truth);
  rows.push({ id: c.id, seed, n: ms.length, nx: cf.length, famSpread, famErr, dimSpread, dimErr, memSpread, memErr,
    shortSpread: Math.max(...shortest)/Math.min(...shortest), shortErr: shortest[0]/tShort - 1,
    meanSpread: Math.max(...A.map(x=> x.mean))/Math.min(...A.map(x=> x.mean)), meanErr: A[0].mean/AT.mean - 1,
    harmSpread: Math.max(...A.map(x=> x.harm))/Math.min(...A.map(x=> x.harm)), harmErr: A[0].harm/AT.harm - 1 });
}
const lgs = x => Math.abs(Math.log(x));
const all = k => rows.flatMap(r=> r[k]);
const multi = rows.filter(r=> r.n + r.nx > 1);
console.log(`${SET}: ${rows.length} runs; ${multi.length} with more than one solid within Δ ≤ ${TAU} (same solid or across solids)`);
console.log(`| quantity | spread over the near-equivalent fits: median, 90 % (max/min) | error of the reported fit vs truth: median, 90 % |`);
console.log(`|---|---|---|`);
const sp = (v)=> `${fmt(median(v), 3)}, ${fmt(quantile(v, 0.9), 3)}`;
const er = (v)=> `${fmt(100*median(v.map(Math.abs)), 1)} %, ${fmt(100*quantile(v.map(Math.abs), 0.9), 1)} %`;
console.log(`| L̄_hkl, every family (${FAMILIES.length} per run) | ${sp(multi.flatMap(r=> r.famSpread))} | ${er(all('famErr').filter(Number.isFinite))} |`);
console.log(`| principal column lengths (3 per run) | ${sp(multi.flatMap(r=> r.dimSpread).filter(Number.isFinite))} | ${er(all('dimErr').filter(Number.isFinite))} |`);
console.log(`| thinnest principal column | ${sp(multi.map(r=> Math.min(...r.dimSpread)))} | |`);
console.log(`| each member's column length, sorted within its family (34 per run) | ${sp(multi.flatMap(r=> r.memSpread).filter(Number.isFinite))} | ${er(all('memErr').filter(Number.isFinite))} |`);
console.log(`| the shortest member's column length | ${sp(multi.map(r=> r.shortSpread))} | ${er(rows.map(r=> r.shortErr))} |`);
console.log(`| mean column length over all directions | ${sp(multi.map(r=> r.meanSpread))} | ${er(rows.map(r=> r.meanErr))} |`);
console.log(`| harmonic mean over all directions (one isotropic size's reading) | ${sp(multi.map(r=> r.harmSpread))} | ${er(rows.map(r=> r.harmErr))} |`);
fs.writeFileSync(path.join(HERE, 'results', `invariants-${SET}.json`), JSON.stringify({ tau: TAU, families: FAMILIES.map(f=> f.hkl), rows }));
