#!/usr/bin/env node
/* [fix] The noise-free separations side by side (fix/shapesep.mjs outputs), per clean sub-screen row
   and rival family (its general member: box, elliptic cylinder, ellipsoid):
   - in-model (each model's own lines in the data): the rival's Δχ² (the true solid ~0) with the
     Lorentzian (lor), the ball's exact line at each member's ⟨L⟩_V (ball: column lengths only, at an
     exact line's compactness) and the exact lines (wppm: the shape changes with direction);
   - exact data: the margin each model would show on average, rival − true solid, in χ²/χ²_ν,iso
     (the cross-solid fits' units: xconf3.json's χ²_ν of the isotropic fit), beside the noisy margin
     of the one draw (xconf3.json) and ~2√Δ, the noisy margin's scatter about it.
   node fix/sepcmp.mjs [--out file.md] [--json file.json] */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const a = process.argv.slice(2), opt = {};
for (let i = 0; i < a.length; i++){ if (a[i].startsWith('--')){ const k = a[i].slice(2); opt[k] = a[i + 1]; i++; } }
const rd = n => { const p = path.join(HERE, 'results', `shapesep-${n}.json`); return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : []; };
const IN = { lor: rd('inmodel-lor'), ball: rd('inmodel-ball'), wppm: rd('inmodel-wppm') }, EX = { lor: rd('exact-lor'), lsq: rd('exact-lsq'), wppm: rd('exact-wppm') };
const X = JSON.parse(fs.readFileSync(path.join(HERE, 'results', 'xconf3.json'), 'utf8'));
const CM = JSON.parse(fs.readFileSync(path.join(HERE, 'results', 'colmatch.json'), 'utf8'));
const FAM = { box: 'box', sqbox: 'box', cylinder: 'cyl', ellcyl: 'cyl', ellipsoid: 'ball', spheroid: 'ball' }, GEN = { box: 'box', cyl: 'ellcyl', ball: 'ellipsoid' };
const f = (x, d = 1) => x == null || !Number.isFinite(x) ? '—' : x.toFixed(d);
const sep = (arr, id, c) => { const r = arr.find(o=> o.id === id); if (!r || !r.cand[c] || r.cand[r.solid].chi2 == null || r.cand[c].chi2 == null) return NaN; return r.cand[c].chi2 - r.cand[r.solid].chi2; };
const design = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'design', 'design.json'), 'utf8'));
const ids = CM.map(c=> c.id), L = [], J = [];
L.push('| row | counts | rival | col rms | in-model Δχ²: lor / ball / wppm | exact data, expected margin χ²/χ²_ν,iso: lor / lsq / wppm | noisy margin (one draw): lor / lsq / wppm |', '|---|---|---|---|---|---|---|');
for (const id of ids){
  const cm = CM.find(c=> c.id === id), t = cm.solid, counts = design.rows.find(r=> r.id === id).counts;
  for (const fam of Object.keys(GEN).filter(k=> k !== FAM[t])){
    const c = GEN[fam];
    const inm = ['lor', 'ball', 'wppm'].map(m=> sep(IN[m], id, c));
    const sc = m => { const r = X[m].find(o=> o.id === id); return r && r.per[c] ? r.per[c].sc : NaN; };
    const noisy = m => { const r = X[m].find(o=> o.id === id); if (!r) return NaN; const s = r.per[t].sc, best = s0 => Math.min(...r.have.filter(s1=> FAM[s1] === s0).map(s1=> r.per[s1].chi2)); return (best(fam) - best(FAM[t]))/s; };
    const ex = ['lor', 'lsq', 'wppm'].map(m=> sep(EX[m], id, c)/sc(m));
    const nz = ['lor', 'lsq', 'wppm'].map(noisy);
    J.push({ id, counts, rival: c, col: cm.cand[c].rms, inmodel: { lor: inm[0], ball: inm[1], wppm: inm[2] }, expected: { lor: ex[0], lsq: ex[1], wppm: ex[2] }, noisy: { lor: nz[0], lsq: nz[1], wppm: nz[2] } });
    L.push(`| ${id} | ${counts} | ${c} | ${f(100*cm.cand[c].rms)} % | ${inm.map(x=> f(x)).join(' / ')} | ${ex.map(x=> f(x)).join(' / ')} | ${nz.map(x=> f(x)).join(' / ')} |`);
  }
}
// per model, the row's expected margin = the nearest rival family's (min over the two); counted at m
L.push('', 'Expected margin per row (the nearest rival family, exact data), counted: right family by more than m / within ±m / another family by more than m:', '', '| model | m = 3 | m = 10 | rows within ±3 or wrong |', '|---|---|---|---|');
for (const m of ['lor', 'lsq', 'wppm']){
  const per = ids.map(id=> ({ id, x: Math.min(...J.filter(o=> o.id === id).map(o=> o.expected[m])) }));
  const cnt = t => `${per.filter(o=> o.x > t).length} / ${per.filter(o=> Math.abs(o.x) <= t).length} / ${per.filter(o=> o.x < -t).length}`;
  L.push(`| ${m} | ${cnt(3)} | ${cnt(10)} | ${per.filter(o=> o.x <= 3).map(o=> `${o.id} ${f(o.x)}`).join(', ')} |`);
}
const near = J.filter(o=> o.col <= 0.026), med = xs => { const t = xs.slice().sort((p, q)=> p - q); return t[(t.length - 1) >> 1]; };
const r1 = near.map(o=> o.inmodel.ball/Math.max(o.inmodel.lor, 0.1)), r2 = near.map(o=> o.inmodel.wppm/Math.max(o.inmodel.ball, 0.1));
L.push('', `In-model, the ${near.length} pairs within 2.6 % rms of column lengths: ball ÷ lor median ${f(med(r1), 2)} (${f(Math.min(...r1), 2)}–${f(Math.max(...r1), 2)}); wppm ÷ ball median ${f(med(r2))} (${f(Math.min(...r2))}–${f(Math.max(...r2))}) (separations under 0.1 counted as 0.1).`);
const text = L.join('\n') + '\n';
if (opt.out) fs.writeFileSync(opt.out, text);
if (opt.json) fs.writeFileSync(opt.json, JSON.stringify(J));
console.log(text);
