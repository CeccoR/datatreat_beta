#!/usr/bin/env node
/* node cards.mjs [--set synth|sample] [--tau 6] [--sys]
   The one-result cards (oneresult.mjs) scored on the truths: every claim a card makes
   (each length with its label, each direction it states, the habit, the size over all
   directions) and whether the truth bears it out; the labels' distribution; for the
   synthetic cases with three realisations, whether the three cards agree (same habit and
   label, every pair of intervals overlapping, the normals within their cones of each
   other). Beside it, what the user sees today in the near-equivalent minima: how many
   distinct minima (the uniqueness study's, merged by resolution) lie within Δ ≤ 2 and 6. */
import fs from 'node:fs';
import path from 'node:path';
import { loadRun, CASES, median, quantile, fmt, pct, HERE, angAx } from './plib.mjs';
import { oneResult, claimsOf } from './oneresult.mjs';
import { minimaOf } from './approaches.mjs';
const a = process.argv.slice(2), opt = {};
for (let i = 0; i < a.length; i++){ if (a[i].startsWith('--')){ const k = a[i].slice(2); opt[k] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true; } }
const SET = opt.set || 'synth', TAU = +(opt.tau || 6);
const sysF = path.join(HERE, 'results', `sys-${SET}.json`), SY = opt.sys && fs.existsSync(sysF) ? JSON.parse(fs.readFileSync(sysF, 'utf8')) : null;
const cards = [];
for (const c of CASES.filter(c=> c.kind === SET)) for (const seed of c.seeds){
  const R = loadRun(c.id, seed); if (!R.base || !R.uq && R.base.kept) continue;
  const sys = SY && SY.rows.find(r=> r.id === c.id && r.seed === seed) || null;
  if (opt.sys && SY && !sys && R.base.kept) continue;           // with --sys: only the runs refined again
  const o = oneResult(R, { tau: TAU, sys, misfit: opt.misfit === true ? 'widen' : opt.misfit || false });
  const ms = R.uq ? minimaOf(R) : [];
  cards.push({ id: c.id, seed, o, claims: claimsOf(o, R), alt2: ms.filter(m=> m.D <= 2).length, alt6: ms.filter(m=> m.D <= 6).length, truthType: c.type, D: c.D });
}
const shp = cards.filter(x=> x.o.status === 'shape' && x.claims);
console.log(`${SET}: ${cards.length} runs; ${shp.length} with a solid scored, ${cards.filter(x=> x.o.status === 'isotropic').length} one size${SY ? '; model term from the background variants' : ''}${opt.misfit ? `; misfit bound (applied on ${shp.filter(x=> x.o.misfit).length})` : ''}; τ ${TAU}`);
const lab = {}; for (const x of shp) lab[x.o.label] = (lab[x.o.label] || 0) + 1;
console.log('Labels: ' + Object.entries(lab).map(([k, v])=> `${k} ${v}`).join(', ') + '; habits: ' + Object.entries(shp.reduce((t, x)=> (t[x.o.habit] = (t[x.o.habit] || 0) + 1, t), {})).map(([k, v])=> `${k} ${v}`).join(', '));
console.log('\n| claim | n | the truth bears it out | value off the truth: median, 90 % |');
console.log('|---|---|---|---|');
const C = shp.flatMap(x=> x.claims.map(c=> ({ ...c, id: x.id, seed: x.seed })));
const rowOf = (name, v, err) => console.log(`| ${name} | ${v.length} | ${pct(v.filter(c=> c.ok).length, v.length)} | ${err ? err(v) : ''} |`);
const lerr = v => { const e = v.map(c=> Number.isFinite(c.est) ? Math.abs(c.est/c.truth - 1) : Infinity); return `${fmt(100*median(e), 1)} %, ${fmt(100*quantile(e, 0.9), 1)} %`; };
for (const L of ['measured', 'range', 'bound']) for (const r of ['thin', 'mid', 'long']){ const v = C.filter(c=> c.kind === 'length' && c.label === L && c.role === r); if (v.length) rowOf(`length ${L}: ${r}`, v, lerr); }
for (const L of ['measured', 'range', 'bound']){ const v = C.filter(c=> c.kind === 'length' && c.label === L); if (v.length) rowOf(`**length ${L}: all**`, v, lerr); }
const aerr = v => `${fmt(median(v.map(c=> c.angle)), 1)}°, ${fmt(quantile(v.map(c=> c.angle), 0.9), 1)}° (cone median ${fmt(median(v.map(c=> c.cone)), 1)}°)`;
for (const L of ['direction', 'approximate']) { const v = C.filter(c=> c.kind === 'direction' && c.label === L); if (v.length) rowOf(`direction stated (${L === 'direction' ? 'cone ≤ 15°' : '15–30°'})`, v, aerr); }
rowOf('habit stated (plate: thinnest ≤ ½ middle; needle: longest ≥ 2 × middle; lath: both)', C.filter(c=> c.kind === 'habit'));
rowOf('no habit established (block): the truth has none', C.filter(c=> c.kind === 'nohabit'));
const hm = C.filter(c=> (c.kind === 'habit' || c.kind === 'nohabit') && !c.ok); if (hm.length) console.log(`\nHabit wrong or not established: ${hm.map(c=> `${c.id}-${c.seed} ${c.label} (truth ${c.truth})`).join('; ')}`);
rowOf('size over all directions (range of the fits, ± 3 %)', C.filter(c=> c.kind === 'size'), v=> { const e = v.map(c=> Math.abs(c.err)); return `${fmt(100*median(e), 1)} %, ${fmt(100*quantile(e, 0.9), 1)} %`; });
// a resolved card: every claim right?
const res = shp.filter(x=> x.o.label === 'resolved');
console.log(`\n"resolved" cards with every claim borne out: ${pct(res.filter(x=> x.claims.every(c=> c.ok)).length, res.length)}; all cards: ${pct(shp.filter(x=> x.claims.every(c=> c.ok)).length, shp.length)}.`);
// what today's alternatives would show
console.log(`Minima within Δ ≤ 2 per run (what a list of alternatives would show): median ${median(cards.filter(x=> x.o.status === 'shape').map(x=> x.alt2))}, max ${Math.max(...cards.map(x=> x.alt2))}; within Δ ≤ 6: median ${median(cards.filter(x=> x.o.status === 'shape').map(x=> x.alt6))}, max ${Math.max(...cards.map(x=> x.alt6))}.`);
// precision: the three realisations' cards
if (SET === 'synth'){
  const by = new Map(); for (const x of cards){ if (!by.has(x.id)) by.set(x.id, []); by.get(x.id).push(x); }
  let n = 0, sameStatus = 0, sameHabit = 0, sameLabel = 0, ovl = 0, nrm = 0, nrmN = 0;
  const sdThin = [];
  for (const [id, xs] of by){
    if (xs.length < 3) continue; n++;
    if (xs.every(x=> x.o.status === xs[0].o.status)) sameStatus++;
    const S = xs.filter(x=> x.o.status === 'shape'); if (S.length < 3) continue;
    if (S.every(x=> x.o.habit === S[0].o.habit)) sameHabit++;
    if (S.every(x=> x.o.label === S[0].o.label)) sameLabel++;
    // intervals of each role overlap across the three
    const ok = ['thin', 'mid', 'long'].every(r=> { const lo = Math.max(...S.map(x=> x.o.q[r].iv[0])), hi = Math.min(...S.map(x=> x.o.q[r].iv[1])); return lo <= hi; });
    if (ok) ovl++;
    const lg = S.map(x=> Math.log(x.o.q.thin.est)), m = lg.reduce((t, v)=> t + v, 0)/3; sdThin.push(Math.sqrt(lg.reduce((t, v)=> t + (v - m)**2, 0)/2));
    // principal axes within the sum of their cones (modulo the cubic symmetry: compare their lattice names' angles)
    const P = S.map(x=> x.o.habit === 'needle' ? x.o.q.long : x.o.q.thin);
    if (P.every(p=> p.dir !== 'none')){ nrmN++; const fam = new Set(P.map(p=> p.name.label.replace(/[^0-9]/g, '').split('').sort().join(''))); if (fam.size === 1) nrm++; }
  }
  console.log(`\nPrecision over the 3 realisations (${n} cases): same status ${sameStatus}/${n}; with a solid in all three: same habit ${sameHabit}, same label ${sameLabel}, intervals overlapping for all three lengths ${ovl}; principal axis named in the same family ${nrm}/${nrmN}; sd of the thickness over the seeds median ${fmt(100*median(sdThin), 1)} %.`);
}
fs.writeFileSync(path.join(HERE, 'results', `cards-${SET}${SY ? '-sys' : ''}${opt.misfit ? '-mis' + (opt.misfit === 'flag' ? 'flag' : '') : ''}.json`), JSON.stringify(cards.map(x=> ({ id: x.id, seed: x.seed, lines: x.o.lines, label: x.o.label, habit: x.o.habit, claims: x.claims, alt2: x.alt2, alt6: x.alt6 }))));
