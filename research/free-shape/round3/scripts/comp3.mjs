#!/usr/bin/env node
/* Point 5: completeness and reach of the search's variants against the dense reference (step 4's comp4.mjs).
   node comp3.mjs --ref DR --base S0 --tags TL,TF,RF [--part tuning --sub screen] [--rows]
   True minima: the reference's minima within Δ* (16; 25 where the check fired) of the lowest χ² over every
   record of the row (each tag's minima and the truth references); one is found when a minimum of the tag
   matches it within each other's local error (minimaMatch post). Reach: the tag's lowest within 1 χ²_ν of the
   best known (every record of the row, the truth references included). Cost: search evaluations × base. */
import { loadX, rowsOf, bestOf, med, sum, f, phaseQ, ENG } from './lib3.mjs';
const arg = (k, d) => process.argv.includes('--' + k) ? process.argv[process.argv.indexOf('--' + k) + 1] : d;
const REF = arg('ref', 'DR'), BASE = arg('base', 'S0'), TAGS = [BASE, ...arg('tags', 'TL,TF,RF').split(',').filter(Boolean), REF];
let rows = rowsOf(arg('part', 'tuning')).filter(r=> r.kind === 'truth');
if (arg('sub', 'screen') === 'screen') rows = rows.filter(r=> r.screen);
const X = Object.fromEntries(TAGS.map(t=> [t, Object.fromEntries(loadX(rows, [t]).map(x=> [x.row.id, x]))]));
const best = bestOf(TAGS.map(t=> Object.values(X[t])));
const mins = x => x && x.r.kept && x.r.info && x.r.info.minima ? x.r.info.minima : null;
const S = Object.fromEntries(TAGS.map(t=> [t, { rows: 0, clean: { T: 0, F: 0, reach: 0, n: 0 }, error: { T: 0, F: 0, reach: 0, n: 0 }, ev: 0, evB: 0, gain: [], loss: [], miss: [] }]));
const lines = [];
for (const r of rows){
  const xr = X[REF][r.id]; if (!xr) continue;
  const b = best[r.id], nuB = b ? Math.max(1, b.chi2/Math.max(1, b.N - b.P)) : 1;
  const q0 = phaseQ(r.phase), q = { shapeType: r.solid, laue: q0.laue, Bm: q0.Bm };
  const cells = [];
  for (const t of TAGS){
    const x = X[t][r.id], xb = X[BASE][r.id]; if (!x) { cells.push('—'); continue; }
    const s = S[t], g = r.error ? s.error : s.clean; s.rows++; g.n++;
    s.ev += x.r.search.evals; s.evB += xb ? xb.r.search.evals : 0;
    const dl = Number.isFinite(x.r.chi2Best) && b ? (x.r.chi2Best - b.chi2)/nuB : NaN;
    if (dl <= 1) g.reach++; else s.miss.push(`${r.id}${r.error ? ' (' + r.error.kind + ')' : ''} ${f(dl, 1)}`);
    if (xb && t !== BASE && Number.isFinite(x.r.chi2Best) && Number.isFinite(xb.r.chi2Best)){ const d = (xb.r.chi2Best - x.r.chi2Best)/nuB; if (d > 1) s.gain.push(`${r.id} ${f(d, 1)}`); if (d < -1) s.loss.push(`${r.id} ${f(-d, 1)}`); }
    const MR = mins(xr), MT = mins(x);
    let cell = `${f(dl, 1)}`;
    if (MR && MT && t !== REF){
      const DS = x.flag ? 25 : 16, nu = Math.max(1, xr.r.chi2nu || 1), lo = Math.min(MR[0].chi2, MT[0].chi2);
      const ref = MR.filter(m=> (m.chi2 - lo)/nu <= DS), found = ref.filter(m=> MT.some(d=> ENG.minimaMatch(q, m, d, true).r <= 1));
      g.T += ref.length; g.F += found.length; cell += ` ${found.length}/${ref.length}`;
    }
    cells.push(cell);
  }
  lines.push(`| ${r.id} | ${r.error ? r.error.kind + ' ' + f(r.error.strength, 2) : ''} | ${cells.join(' | ')} |`);
}
const L = [`completeness and reach on ${rows.length} rows; reference ${REF}, base ${BASE}`, '', '| tag | rows | clean: true minima found | reach | error: found | reach | search evals × base | lower than base by > 1 χ²_ν | higher | not reached |', '|---|---|---|---|---|---|---|---|---|---|'];
for (const t of TAGS){ const s = S[t];
  L.push(`| ${t} | ${s.rows} | ${t === REF ? '—' : s.clean.F + '/' + s.clean.T} | ${s.clean.reach}/${s.clean.n} | ${t === REF ? '—' : s.error.F + '/' + s.error.T} | ${s.error.reach}/${s.error.n} | ${f(s.ev/s.evB, 2)} | ${s.gain.join(', ') || '—'} | ${s.loss.join(', ') || '—'} | ${s.miss.join(', ') || '—'} |`); }
if (process.argv.includes('--rows')) L.push('', `| row | error | ${TAGS.map(t=> t + ': Δ, found/true').join(' | ')} |`, `|---|---|${TAGS.map(()=> '---|').join('')}`, ...lines);
console.log(L.join('\n'));
