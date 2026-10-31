/* cmp.mjs <mine tag> <ref> [rows]: the prototype's runs against a reference, row by row.
   ref: pilot (fs2/pilot/results/screen, today), A (fs2/A/results/s-lsq, today), B (fs2/B
   results: symA of tag symfix where it ran, else fwdH of tag sub2; its search's evaluations
   less the covariance-only pass's, which the prototype does not make), or a tag of ours. */
import fs from 'node:fs';
import path from 'node:path';
import { readResult } from './lib.mjs';
const HERE = path.dirname(new URL(import.meta.url).pathname), FS2 = path.join(HERE, '..', 'fs2');
const [tag, ref, rowsArg] = process.argv.slice(2);
const sub = fs.readFileSync(path.join(FS2, 'A', 'subscreen.txt'), 'utf8').split('\n').filter(l=> l && !l.startsWith('#')).map(l=> l.split(/\s+/)[0]);
const rows = rowsArg ? rowsArg.split(',') : sub;
const rd = f => fs.existsSync(f) ? readResult(fs.readFileSync(f, 'utf8')) : null;
const symfix = new Set(fs.readFileSync(path.join(FS2, 'B', 'results', 'symfix10.txt'), 'utf8').trim().split(','));
function refRec(row){
  if (ref === 'pilot'){ const o = rd(path.join(FS2, 'pilot', 'results', 'screen', row + '.json')); return o && { o, r: o.records.find(r=> r.method === 'today'), ev: x=> x.search.evals }; }
  if (ref === 'A'){ const o = rd(path.join(FS2, 'A', 'results', 's-lsq', row + '.json')); return o && { o, r: o.records.find(r=> r.method === 'today'), ev: x=> x.search.evals }; }
  if (ref === 'B'){
    const o = symfix.has(row) ? rd(path.join(FS2, 'B', 'results', 'symfix', row + '.json')) : rd(path.join(FS2, 'B', 'results', 'sub2', row + '.json'));
    const r = o && o.records.find(r=> r.method === (symfix.has(row) ? 'symA' : 'fwdH'));
    return o && { o, r, ev: x=> x.search.evals - (x.var && x.var.covOnly ? x.var.covOnly.ev : 0), B: true };
  }
  const o = rd(path.join(HERE, 'results', ref, row + '.json')); return o && { o, r: o.records.find(r=> r.method === 'today'), ev: x=> x.search.evals };
}
const out = (r) => !r ? '—' : r.error ? 'error' : r.kept ? (r.held ? 'held' : 'free') : r.rejected ? (r.early ? 'early' : 'rej') : 'none';
const f = (x, d = 1) => x == null || !Number.isFinite(x) ? String(x) : x.toFixed(d);
let n = 0, same = { ev: 0, chi: 0, out: 0, dims: 0, iso: 0, rep: 0 }, sumE = [0, 0], sumC = [0, 0], dchi = [];
for (const row of rows){
  const m = rd(path.join(HERE, 'results', tag, row + '.json'));
  const R = refRec(row);
  if (!m || !R || !R.r){ console.log(row.padEnd(24), 'missing', !m ? tag : ref); continue; }
  const a = m.records[0], b = R.r;
  n++;
  const eA = a.search.evals, eB = R.ev(b);
  const isoSame = m.iso.evals === R.o.iso.evals && m.iso.chi2 === R.o.iso.chi2;
  const dimsA = a.solid ? a.solid.dims : null, dimsB = b.solid ? b.solid.dims : null;
  const dimsSame = JSON.stringify(dimsA) === JSON.stringify(dimsB);
  const rep = R.B ? null : (a.report && b.report ? a.report.evals === b.report.evals : a.report == b.report);
  if (eA === eB) same.ev++; if (a.chi2 === b.chi2) same.chi++; if (out(a) === out(b)) same.out++; if (dimsSame) same.dims++; if (isoSame) same.iso++; if (rep) same.rep++;
  sumE[0] += eA; sumE[1] += eB; if (m.cpu) sumC[0] += m.cpu.fitMs;
  const nu = Math.max(1, a.chi2nu || 1), dc = (a.chi2 - b.chi2)/nu; dchi.push(dc);
  const dmax = dimsA && dimsB ? Math.max(...dimsA.map((d, i)=> Math.abs(Math.log(d/dimsB[i])))) : null;
  console.log(row.padEnd(24), `iso ${isoSame ? '=' : m.iso.evals + '/' + R.o.iso.evals}`, `ev ${eA}/${eB}${eA === eB ? ' =' : ''}`, `χ² ${f(a.chi2, 3)}/${f(b.chi2, 3)} Δ ${dc === 0 ? '0' : dc.toExponential(1)} χ²_ν`,
    `${out(a)}/${out(b)}`, dimsSame ? 'dims =' : `dims ${dimsA ? dimsA.map(d=> f(d, 2)).join('×') : '—'} / ${dimsB ? dimsB.map(d=> f(d, 2)).join('×') : '—'} (max |ln| ${f(dmax, 4)})`,
    rep == null ? '' : rep ? 'report =' : `report ${a.report && a.report.evals}/${b.report && b.report.evals}`, m.cpu ? `cpu ${f(m.cpu.fitMs/1000, 0)} s` : '');
}
const med = a => { const s = [...a].sort((x, y)=> x - y); return s.length ? s[Math.floor(s.length/2)] : NaN; };
console.log(`${n} rows: evaluations equal ${same.ev}, χ² equal ${same.chi}, outcome equal ${same.out}, dims equal ${same.dims}, iso equal ${same.iso}${ref === 'B' ? '' : ', report equal ' + same.rep}; search evaluations ${sumE[0]} / ${sumE[1]} = ${f(sumE[0]/sumE[1], 3)}; |Δχ²| median ${med(dchi.map(Math.abs)).toExponential(1)}, max ${Math.max(...dchi.map(Math.abs)).toExponential(1)} χ²_ν; cpu ${f(sumC[0]/1000, 0)} s`);
