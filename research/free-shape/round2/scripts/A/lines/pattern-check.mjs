/* The size line as a pattern: each row drawn by the generator without noise (exact lines),
   against Track A's model (FS2A_LINE) at the truth's own parameters, the error's part taken
   out (and the texture rows skipped: the model here has none), both with every line's tails
   whole (noise0 10⁻³⁰, as the generator). Per row: max |Δ| over the phase's peak, and the
   excess χ²_ν Σ(Δ²/y)/N that the truth would show at the row's counts (no refinement).
   node pattern-check.mjs [--rows a,b|subscreen|spheres] [--out file.json] */
import fs from 'node:fs';
import path from 'node:path';
import { drawRow } from '../../gen/gen.mjs';
import { buildModel, calc, setParams } from '../eng/xrd-rietveld.js';
import { phaseOf, ENG } from '../harness/lib.mjs';
const a = process.argv.slice(2), opt = {};
for (let i = 0; i < a.length; i++) if (a[i].startsWith('--')) opt[a[i].slice(2)] = a[i + 1];
const HERE = path.dirname(new URL(import.meta.url).pathname);
const design = JSON.parse(fs.readFileSync(path.join(HERE, '..', '..', 'design', 'design.json'), 'utf8'));
const sub = fs.readFileSync(path.join(HERE, '..', 'subscreen.txt'), 'utf8').split('\n').filter(l=> l && !l.startsWith('#')).map(l=> l.trim().split(/\s+/)[0]);
const sel = opt.rows || 'subscreen';
const ids = sel === 'subscreen' ? sub : sel === 'spheres' ? design.rows.filter(r=> r.screen && r.kind === 'sphere').map(r=> r.id) : sel.split(',');
const out = [];
for (const id of ids){
  const row = design.rows.find(r=> r.id === id);
  if (row.split === 'validation') throw new Error('validation row');
  if (row.error && row.error.kind === 'po'){ out.push({ id, skipped: 'po' }); continue; }
  const pat = drawRow(row, { noise: false });
  const shape = row.solid === 'sphere' ? false : row.solid;
  const model = buildModel({ x: pat.x, y: Array.from(pat.yc), instr: pat.instr, phases: [phaseOf(row.phase, shape)] });
  model.noise0 = 1e-30;
  const v = model.v.slice(), P = { ...pat.truth.P, 'p1.scale': 1 };
  for (const k in P){ const i = model.index[k]; if (i != null) v[i] = P[k]; }
  setParams(model, v);
  const net = calc(model, null, { internal: true }).perPhase[0], S = pat.truth.P['p1.scale'];
  const ph = pat.parts.phase, bg = pat.parts.bg;
  let mx = 0, pk = 0, ex = 0, n = ph.length;
  for (let i = 0; i < n; i++){ const d = S*net[i] - ph[i]; pk = Math.max(pk, ph[i]); mx = Math.max(mx, Math.abs(d)); ex += d*d/Math.max(1, ph[i] + bg[i]); }
  const r = { id, solid: row.solid, laue: row.laue, error: row.error ? row.error.kind : 'none', counts: row.counts, maxDev: mx/pk, excess: ex/n };
  out.push(r);
  console.log(`${ENG.SIZE_MODE} ${id.padEnd(26)} max|Δ| ${(100*r.maxDev).toFixed(2)} % of the peak, excess χ²_ν ${r.excess.toFixed(3)} (counts ${row.counts})`);
}
if (opt.out) fs.writeFileSync(opt.out, JSON.stringify({ mode: ENG.SIZE_MODE, rows: out }, null, 1));
