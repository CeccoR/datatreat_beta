#!/usr/bin/env node
/* The prototype's runs (results/P1, methods/proto.mjs) against step 3's offline analysis of the same fits
   (../h/results/C1, an3.mjs): the search unchanged; the engine's check equal to the offline statistics;
   the engine's jackknife equal to the offline 4-iteration spread; the cost.
   node cmpP.mjs [--tag P1] */
import fs from 'node:fs';
import path from 'node:path';
import { readResult } from './lib.mjs';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const tag = process.argv.includes('--tag') ? process.argv[process.argv.indexOf('--tag') + 1] : 'P1';
const { load, jackSpread } = await import('../h/an3.mjs');
const X = load('C1').filter(x=> x.st);
let same = 0, sameFlag = 0, sameSegs = 0, jackOK = 0, jackN = 0, n = 0, maxdz = 0, maxjd = 0;
const bad = [], cost = [];
for (const x of X){
  const fn = path.join(HERE, 'results', tag, x.row.id + '.json'); if (!fs.existsSync(fn)) continue;
  const o = readResult(fs.readFileSync(fn, 'utf8')), r = o.records[0], c = x.r; n++;
  const k = y => JSON.stringify([y.kept, y.held, y.rejected, y.early, y.chi2, y.solid && y.solid.dims, y.dBIC]);
  if (k(r) === k(c) && r.search.evals === c.search.evals + 2) same++; else bad.push(x.row.id + ' search');
  const ck = r.check, off = x.st.zseg > 3.09 || x.st.zb1 > 3.09;
  maxdz = Math.max(maxdz, Math.abs(ck.zSeg - x.st.zseg), Math.abs(ck.zBin - x.st.zb1));
  if (ck.flagged === off) sameFlag++; else bad.push(x.row.id + ' flag');
  const offSegs = x.st.segs.filter(s=> s.zsB > 3.09 || s.zbB > 3.09).map(s=> s.i).join(',');
  if (ck.segs.map(s=> s.s).join(',') === offSegs && ck.S === x.st.S) sameSegs++; else bad.push(x.row.id + ' segs');
  const jk = r.report && r.report.misfit && r.report.misfit.jack;
  if (jk){
    jackN++;
    const sp = jackSpread(c, x.ck, 's4');
    // the engine's sd is per width slot (2 for a body of revolution or a square box: section, axis); the offline per body axis
    const slots = jk.sd.length === 2 ? [0, 2] : [0, 1, 2];
    const dd = Math.max(...jk.sd.map((s, i)=> { const t = sp.sd[slots[i]]; return Number.isFinite(s) && Number.isFinite(t) ? Math.abs(s - t) : (s === t ? 0 : Infinity); }));
    maxjd = Math.max(maxjd, dd);
    if (dd < 1e-3) jackOK++; else bad.push(`${x.row.id} jack ${dd.toFixed(4)}`);
    cost.push({ id: x.row.id, jackEv: r.report.evals - c.report.evals, fitEv: o.iso.evals + c.search.evals + c.report.evals, jackMs: r.report.ms - c.report.ms, fitMs: o.iso.ms + c.search.ms + c.report.ms });
  }
}
const med = a => { const s = [...a].sort((p, q)=> p - q); return s.length ? (s[(s.length - 1) >> 1] + s[s.length >> 1])/2 : NaN; };
console.log(`${n} runs: search as C1 (χ², outcome, solid, ΔBIC; evaluations + 2 for the check) ${same}; flag as offline ${sameFlag}; flagged segments as offline ${sameSegs}; largest |Δz| ${maxdz.toExponential(2)}`);
console.log(`jackknife (flagged kept fits): ${jackN}, sd within 1e-3 of the offline 4-iteration spread ${jackOK} (largest difference ${maxjd.toExponential(2)}, the offline solids being rounded)`);
console.log(`its cost: ${med(cost.map(c=> c.jackEv)).toFixed(0)} evaluations a run (median; ${Math.min(...cost.map(c=> c.jackEv))}–${Math.max(...cost.map(c=> c.jackEv))}), ${med(cost.map(c=> c.jackEv/c.fitEv)).toFixed(2)}× the fit's (${Math.min(...cost.map(c=> c.jackEv/c.fitEv)).toFixed(2)}–${Math.max(...cost.map(c=> c.jackEv/c.fitEv)).toFixed(2)}); wall ${(med(cost.map(c=> c.jackMs))/1000).toFixed(1)} s, ${med(cost.map(c=> c.jackMs/c.fitMs)).toFixed(2)}× (runs at nice 15, three at a time)`);
if (bad.length) console.log('differ: ' + bad.join('; '));
