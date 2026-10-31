#!/usr/bin/env node
/* A variant's records against the reference's, row by row (rows the variant ran): outcome, the returned χ²
   (in χ²_ν), the solid (extents within 5 %, axis within 2°), accuracy, the minima within Δ*, the extents and
   principal axis covered (the engine's lo–hi and radius), the search's and the stage's evaluations.
   node cmp6.mjs --v SC [--ref P] [--part tuning] */
import { rowsOf, loadX, byId, intervals, outc, accOf, f, pc, sum, med } from './lib6.mjs';
import { compareSolids, laueRotations } from './h/lib.mjs';
const a = process.argv.slice(2), opt = {};
for (let i = 0; i < a.length; i++){ if (a[i].startsWith('--')){ opt[a[i].slice(2)] = a[i + 1]; i++; } }
const rows = rowsOf(opt.part || 'tuning'), V = loadX(rows, [opt.v]), R = byId(loadX(rows, [opt.ref || 'P']));
const L = [`| row | error | outcome ref → ${opt.v} | Δχ² (χ²_ν) | solid changed | worst ref → var | minima ≤ Δ* | covered E (extents, axis) ref → var | search ev ref → var (stage) |`, '|---|---|---|---|---|---|---|---|---|'];
let nOut = 0, nLow = 0, nHigh = 0, nSolid = 0, evR = 0, evV = 0, minR = 0, minV = 0, covR = 0, covV = 0, nE = 0;
const cov = x => { if (!x.truth || !x.r.kept) return null; const i = intervals(x); return { e: i.ext.filter(e=> e.inf || e.E).length, n: i.ext.length, ax: i.ax ? i.ax.E : null, m: i.n }; };
for (const v of V){
  const r = R[v.row.id]; if (!r) continue;
  const nu = Math.max(1, r.r.chi2nu), d = (v.r.chi2 - r.r.chi2)/nu, ov = outc(v.r), or = outc(r.r);
  let solid = '';
  if (v.r.kept && r.r.kept){ const c = compareSolids(v.r.solid, r.r.solid, { rots: laueRotations(v.o.phase) }); const nInf = s => s.dims.filter(d=> d === Infinity).length, bothInf = nInf(v.r.solid) > 0 && nInf(v.r.solid) === nInf(r.r.solid); if (c.dimErr.some(e=> Number.isNaN(e) ? !bothInf : !(Math.abs(e) <= 0.05)) || (c.orient != null && c.orient > 2)) solid = c.dimErr.map(e=> pc(e)).join(', ') + '; ' + f(c.orient) + '°'; }
  const av = accOf(v), ar = accOf(r), cv = cov(v), cr = cov(r);
  if (ov !== or) nOut++; if (d < -0.1) nLow++; if (d > 0.1) nHigh++; if (solid) nSolid++;
  evR += r.r.search.evals; evV += v.r.search.evals; minR += r.r.min ? r.r.min.evals : 0; minV += v.r.min ? v.r.min.evals : 0;
  if (cv && cr){ covR += cr.e + (cr.ax ? 1 : 0); covV += cv.e + (cv.ax ? 1 : 0); nE += cr.n + (cr.ax != null ? 1 : 0); }
  L.push(`| ${v.row.id} | ${v.ek} | ${or} → ${ov} | ${f(d, 2)} | ${solid} | ${ar ? pc(ar.worst) : '—'} → ${av ? pc(av.worst) : '—'} | ${cr ? cr.m : '—'} → ${cv ? cv.m : '—'} | ${cr ? cr.e + '/' + cr.n + (cr.ax == null ? '' : cr.ax ? ', ax' : ', ·') : '—'} → ${cv ? cv.e + '/' + cv.n + (cv.ax == null ? '' : cv.ax ? ', ax' : ', ·') : '—'} | ${r.r.search.evals} → ${v.r.search.evals} (${r.r.min ? r.r.min.evals : 0} → ${v.r.min ? v.r.min.evals : 0}) |`);
}
L.push('', `${opt.v} against ${opt.ref || 'P'} on ${V.length} rows: outcome changed ${nOut}; returned χ² lower by more than 0.1 χ²_ν on ${nLow}, higher on ${nHigh}; solid changed ${nSolid}; search evaluations ${evR} → ${evV} (${f(evV/evR, 3)}×), the stage's ${minR} → ${minV} (${f(minV/Math.max(1, minR), 3)}×); extents and axes covered ${covR} → ${covV} of ${nE}.`);
console.log(L.join('\n'));
