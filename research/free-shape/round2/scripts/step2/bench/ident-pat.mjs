/* Bit identity of WPPM patterns: engine A against engine B (default eng0 = step 1's, eng = step 2's),
   per row the solid at the truth and at 6 random displacements of every non-linear parameter, and the
   sphere (no shape). node bench/ident-pat.mjs [rows] [--a dir --b dir] */
import fs from 'node:fs';
const a = process.argv.slice(2), opt = {}; const pos = [];
for (let i = 0; i < a.length; i++){ if (a[i].startsWith('--')){ opt[a[i].slice(2)] = a[i + 1]; i++; } else pos.push(a[i]); }
const EA = await import('../' + (opt.a || 'eng0') + '/xrd-rietveld.js'), EB = await import('../' + (opt.b || 'eng') + '/xrd-rietveld.js');
const { phaseOf, FS2, rng, hash } = await import('../lib.mjs');
const { drawRow } = await import('../../../gen/gen.mjs');
const design = JSON.parse(fs.readFileSync(FS2 + '/design/design.json', 'utf8'));
const DEF = 'box-P-1-near,ellcyl-P2m-generic,ellipsoid-Pmmm-generic,box-P4m-near,cylinder-P4mmm-on,spheroid-P-3-near,box-P-3m1-near,cylinder-P6m-on,ellipsoid-P6mmm-generic,sqbox-Pm-3-on,ellcyl-Pm-3m-generic';
let bad = 0, tot = 0, maxRel = 0;
for (const id of (pos[0] || DEF).split(',')){
  const row = design.rows.find(r=> r.id === id), pat = drawRow(row, {});
  const mk = E => { const m = E.buildModel({ x: pat.x, y: Array.from(pat.y), instr: pat.instr, phases: [{ ...phaseOf(row.phase, row.solid), profile: opt.profile || 'wppm' }] });
    const v = m.v.slice(); const TP = { ...pat.truth.P, 'p1.Ys': 0 }; for (const k in TP){ const i = m.index[k]; if (i != null) v[i] = TP[k]; } E.setParams(m, v); return m; };
  const mA = mk(EA), mB = mk(EB), R = rng(hash(id));
  const vs = [mA.v.slice()];
  for (let s = 0; s < 6; s++){ const v = mA.v.slice(); mA.par.forEach((p, j)=> { if (!p.linear && p.step && !p.tied) v[j] = Math.min(p.hi, Math.max(p.lo, v[j] + 3*p.step*R.n())); }); vs.push(v); }
  { const v = mA.v.slice(); mA.phases[0].iW.forEach(i=> { v[i] = 0; }); v[mA.phases[0].iYs] = 0.3; vs.push(v); }
  let rowBad = 0;
  for (const v of vs){
    const pa = new Float64Array(mA.n), pb = new Float64Array(mB.n);
    EA.ENG.phasePattern(mA, v, 0, pa); EB.ENG.phasePattern(mB, v, 0, pb);
    let pk = 0; for (let i = 0; i < pa.length; i++) pk = Math.max(pk, Math.abs(pa[i]));
    for (let i = 0; i < pa.length; i++){ tot++; if (pa[i] !== pb[i]){ bad++; rowBad++; maxRel = Math.max(maxRel, Math.abs(pa[i] - pb[i])/pk); } }
  }
  console.log(id, rowBad ? 'DIFFERENT ' + rowBad : 'identical', vs.length + ' points');
}
console.log(`${bad} of ${tot} values differ; max |Δ|/peak ${maxRel.toExponential(2)}`);
