// The synthetic hold-out (seeds 4 and 5 of the 30 synthetic cases, fix/root6): the misfit flag's
// worst segment on clean data (the threshold 1.25 was set between 1.207, the worst of the first 80
// runs, and 1.311, the mildest proxy), what the app keeps and rejects, and on the rejected runs the
// truth's own gain over one size against the isotropic nulls' maxima (7.6 three widths, 6.1 two).
//   node holdout.mjs <fs>
import fs from 'node:fs';
import path from 'node:path';
const FS = path.resolve(process.argv[2]);
const R = f => JSON.parse(fs.readFileSync(f, 'utf8').replace(/\bInfinity\b/g, '1e308'));
const dir = path.join(FS, 'fix/root6/uniqueness/results/main');
const NMAX = { 3: 7.6, 2: 6.1 }, nW = { box: 3, sqbox: 2, ellipsoid: 3, spheroid: 2, cylinder: 2, ellcyl: 3 };
const worst = [], rej = [];
let n = 0, kept = 0, held = 0;
for (const fn of fs.readdirSync(dir).filter(f=> f.endsWith('.json')).sort()){
  const j = R(path.join(dir, fn)); if (j.kind !== 'synth' || j.seed < 4) continue;
  n++; const m = j.records[0], t = j.records.find(x=> x.method === 'truth');
  if (m.kept){ kept++; if (m.held) held++; const jk = m.info && m.info.jack; if (jk) worst.push({ run: `${j.case}#${j.seed}`, w: jk.worst }); }
  else { const g = t && Number.isFinite(t.chi2Best) ? (j.iso.chi2 - t.chi2Best)/Math.max(1, j.iso.chi2nu) : NaN; rej.push({ run: `${j.case}#${j.seed}`, shape: j.shape, early: m.early, dBIC: m.dBIC, g, above: g > NMAX[nW[j.shape]] }); }
}
worst.sort((a, b)=> b.w - a.w);
console.log(`${n} hold-out runs: ${kept} kept (${held} held), ${n - kept} rejected`);
console.log(`worst segment χ²_ν on the kept runs: max ${worst[0].w.toFixed(3)} (${worst[0].run}), then ${worst.slice(1, 4).map(x=> `${x.w.toFixed(3)} (${x.run})`).join(', ')}; over 1.25: ${worst.filter(x=> x.w > 1.25).length}; over 1.207: ${worst.filter(x=> x.w > 1.207).length}`);
console.log(`rejected: ${rej.map(r=> `${r.run} ${r.early ? 'early' : 'late'} ΔBIC ${r.dBIC.toFixed(0)} truth gain ${Number.isFinite(r.g) ? r.g.toFixed(1) : '—'}${r.above ? ' (above every null)' : ''}`).join('; ')}`);
console.log(`rejected runs whose truth gains more than every null of its width count: ${rej.filter(r=> r.above).length} of ${rej.length}`);
