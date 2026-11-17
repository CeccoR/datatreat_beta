#!/usr/bin/env node
/* node null.mjs [tag=null]: is there a shape at all? The χ² gain of the app's search over the
   isotropic size when the truth is isotropic (iso-7 searched as a box, iso-20 as a cylinder:
   results/<tag>/ with seeds 4–23, plus the baseline's seeds 1–3), against the gain the
   rejected anisotropic truths reach (the baseline's rejected synthetic runs: the search's
   own gain, and the truth reference's). Gain G = (χ²_iso − χ²_shape)/max(1, χ²_ν iso), read
   back from the early route's ΔBIC = dPmin ln N − G (dPmin = widths − 1, the body held on
   the lattice) or from a full rejection's ΔBIC. The app keeps a shape at ΔBIC < −10:
   G > 10 + dPmin ln N held, 10 + dP ln N free. AIC: G > 2 dPmin. The calibrated threshold:
   the null's 99th percentile (and its maximum), per body. Prints the table; writes
   results/null.json. */
import fs from 'node:fs';
import path from 'node:path';
import { readResult, ENG } from '../harness/lib.mjs';
import { fmt, quantile } from './ulib.mjs';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const tag = process.argv[2] || 'null';
const lnN = Math.log(5384);
const gainOf = (m, shape) => { const nW = ENG.BODIES[shape].W.length, dPmin = nW - 1; return m.early ? dPmin*lnN - m.dBIC : NaN; };
const nul = { box: [], cylinder: [] }, alt = [];
const dirs = [path.join(HERE, 'results', tag), path.join(HERE, '..', 'harness', 'results', 'baseline')];
for (const d of dirs) for (const fn of fs.readdirSync(d).filter(f=> f.endsWith('.json') && !f.startsWith('summary'))){
  const r = readResult(fs.readFileSync(path.join(d, fn), 'utf8')); if (!r.records) continue;
  const m = r.records[0];
  if (/^iso-/.test(r.case)){ if (!m.kept) nul[r.shape].push({ run: `${r.case}#${r.seed}`, G: gainOf(m, r.shape), early: m.early, dBIC: m.dBIC }); else nul[r.shape].push({ run: `${r.case}#${r.seed}`, kept: true, dBIC: m.dBIC }); continue; }
  if (d === dirs[1] && r.kind === 'synth' && !m.kept){
    const t = r.records.find(x=> x.method === 'truth');
    alt.push({ run: `${r.case}#${r.seed}`, shape: r.shape, G: gainOf(m, r.shape), early: m.early, dBIC: m.dBIC, Gtruth: t && Number.isFinite(t.chi2Best) ? (r.iso.chi2 - t.chi2Best)/Math.max(1, r.iso.chi2nu) : NaN });
  }
}
const out = { tag, lnN, body: {} };
for (const [b, xs] of Object.entries(nul)){
  const G = xs.filter(x=> Number.isFinite(x.G)).map(x=> x.G), nW = ENG.BODIES[b].W.length, dPmin = nW - 1;
  const q95 = quantile(G, 0.95), q99 = quantile(G, 0.99), mx = Math.max(...G);
  out.body[b] = { n: xs.length, kept: xs.filter(x=> x.kept).length, G, median: quantile(G, 0.5), q95, q99, max: mx, bicHeld: 10 + dPmin*lnN, aic: 2*dPmin };
  console.log(`${b}: ${xs.length} isotropic runs, ${xs.filter(x=> x.kept).length} kept by the app; gain median ${fmt(quantile(G, 0.5), 1)}, 95th ${fmt(q95, 1)}, 99th ${fmt(q99, 1)}, max ${fmt(mx, 1)}; the app's need (held) ${fmt(10 + dPmin*lnN, 1)}, AIC's ${2*dPmin}; over AIC's: ${G.filter(g=> g > 2*dPmin).length}/${G.length}`);
}
console.log('\nrejected anisotropic synthetic runs (baseline): gain reached by the search (early route) and by the truth\'s own refinement');
for (const a of alt.sort((x, y)=> x.run.localeCompare(y.run))){
  const nb = out.body[ENG.BODIES[a.shape].W.length === 2 ? 'cylinder' : 'box'];   // the null of a body with as many widths
  console.log(`${a.run.padEnd(20)} ${a.shape.padEnd(9)} ${a.early ? 'early' : 'full '} ΔBIC ${fmt(a.dBIC, 1).padStart(5)} G ${fmt(a.G, 1).padStart(5)} G_truth ${fmt(a.Gtruth, 1).padStart(5)}${nb && Number.isFinite(a.Gtruth) && a.Gtruth > nb.max ? '  over the null max' : ''}`);
}
out.alt = alt; out.nul = nul;
fs.writeFileSync(path.join(HERE, 'results', 'null.json'), JSON.stringify(out, null, 1));
