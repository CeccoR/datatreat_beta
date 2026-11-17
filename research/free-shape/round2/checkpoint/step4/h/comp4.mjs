#!/usr/bin/env node
/* Step 4: completeness of the minima stage against the dense reference (results/DR: 40 starts, 10 full
   refinements, the stage on up to 24 candidates within 60). The true minima: the reference's minima
   within Δ* of the lowest χ² either run found; a reference minimum is found when one of the default
   run's (results/S1) matches it within each other's local error (the engine's minimaMatch, post).
   Also the reach (the default's lowest within 1 χ²_ν of the reference's), the uniqueness verdicts
   compared, and the cost. node comp4.mjs [--ref DR] [--tag S1] [--delta 12.5] */
import fs from 'node:fs';
import path from 'node:path';
import { readResult, phaseQ, ENG } from './lib.mjs';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const arg = (k, d) => process.argv.includes('--' + k) ? process.argv[process.argv.indexOf('--' + k) + 1] : d;
const REF = arg('ref', 'DR'), TAG = arg('tag', 'S1'), DS = +arg('delta', 12.5);
const rd = (t, f) => readResult(fs.readFileSync(path.join(HERE, 'results', t, f), 'utf8')).records[0];
const f = (x, d = 1) => Number.isFinite(x) ? x.toFixed(d) : '—';
const L = [`completeness: ${TAG} against ${REF}, Δ* ${DS}`, '', '| row | ref. minima ≤ Δ* | found | default ≤ Δ* | default lowest − reference lowest (χ²_ν) | unique: default / ref. | ref. search evals × default | ref. stage candidates |', '|---|---|---|---|---|---|---|---|'];
let nT = 0, nF = 0, nReach = 0, nRows = 0, agree = 0, evR = 0, evD = 0;
for (const fn of fs.readdirSync(path.join(HERE, 'results', REF)).filter(x=> x.endsWith('.json'))){
  const o = readResult(fs.readFileSync(path.join(HERE, 'results', REF, fn), 'utf8')), R = o.records[0], D = rd(TAG, fn);
  if (!R.kept || !D.kept || !R.info.minima || !D.info.minima){ L.push(`| ${o.row} | (${R.kept ? 'kept' : 'rejected'} / ${D.kept ? 'kept' : 'rejected'}) | | | | | | |`); continue; }
  nRows++;
  const q0 = phaseQ(o.phase), q = { shapeType: R.solid.type, laue: q0.laue, Bm: q0.Bm };
  const lo = Math.min(R.info.minima[0].chi2, D.info.minima[0].chi2), nu = Math.max(1, R.chi2nu);
  const ref = R.info.minima.filter(m=> (m.chi2 - lo)/nu <= DS), def = D.info.minima.filter(m=> (m.chi2 - lo)/nu <= DS);
  const found = ref.filter(m=> D.info.minima.some(d=> ENG.minimaMatch(q, m, d, true).r <= 1));
  nT += ref.length; nF += found.length;
  const dl = (D.info.minima[0].chi2 - R.info.minima[0].chi2)/nu; if (dl <= 1) nReach++;
  const uD = D.info.minima.filter(m=> m.delta <= DS).length === 1, uR = R.info.minima.filter(m=> m.delta <= DS).length === 1; if (uD === uR) agree++;
  evR += R.search.evals; evD += D.search.evals;
  L.push(`| ${o.row} | ${ref.length} | ${found.length} | ${def.length} | ${f(dl, 2)} | ${uD ? 'yes' : 'no'} / ${uR ? 'yes' : 'no'} | ${f(R.search.evals/D.search.evals, 1)} | ${R.info.minimaStage.cands} |`);
}
L.push('', `rows ${nRows}: true minima ${nT}, found ${nF} (${f(100*nF/nT, 0)} %); reach ${nReach}/${nRows}; uniqueness verdict the same on ${agree}/${nRows}; reference cost ${f(evR/evD, 2)}× the default's search (stage included)`);
console.log(L.join('\n'));
