/* The WPPM line in the pattern, as track A's lines/pattern-check.mjs (each row drawn by the generator
   without noise, exact lines; the model at the truth's own parameters, the error's part taken out,
   texture rows skipped, every line's tails whole: noise0 10⁻³⁰): per row the max |Δ| over the phase's
   peak and the excess χ²_ν Σ(Δ²/y)/N at the row's counts, for step 1's engine (eng0, WPPM as A ran it)
   and step 2's (eng, WPPM_OPT from PROTO_WPPM), and the two against each other. The pattern by
   phasePattern without ticks (the paired lines are drawn so).
   PROTO_PROFILE=wppm PROTO_WPPM=<flags> node bench/pattern2.mjs [--rows subscreen|a,b] [--out file.json] */
import fs from 'node:fs';
const a = process.argv.slice(2), opt = {};
for (let i = 0; i < a.length; i++) if (a[i].startsWith('--')) opt[a[i].slice(2)] = a[i + 1];
const E0 = await import('../eng0/xrd-rietveld.js'), E1 = await import('../' + (process.env.ENGDIR || 'eng') + '/xrd-rietveld.js');
const { phaseOf, FS2 } = await import('../lib.mjs');
const { drawRow } = await import('../../../gen/gen.mjs');
const design = JSON.parse(fs.readFileSync(FS2 + '/design/design.json', 'utf8'));
const sub = fs.readFileSync(FS2 + '/A/subscreen.txt', 'utf8').split('\n').filter(l=> l && !l.startsWith('#')).map(l=> l.trim().split(/\s+/)[0]);
const ids = !opt.rows || opt.rows === 'subscreen' ? sub : opt.rows.split(',');
const out = [], f = (x, d = 3) => x.toFixed(d);
for (const id of ids){
  const row = design.rows.find(r=> r.id === id);
  if (row.split === 'validation') throw new Error('validation row');
  if (row.error && row.error.kind === 'po'){ out.push({ id, skipped: 'po' }); continue; }
  const pat = drawRow(row, { noise: false }), shape = row.solid === 'sphere' ? false : row.solid;
  const one = E => { const model = E.buildModel({ x: pat.x, y: Array.from(pat.yc), instr: pat.instr, phases: [{ ...phaseOf(row.phase, shape), profile: 'wppm' }] });
    model.noise0 = 1e-30;
    const v = model.v.slice(), P = { ...pat.truth.P, 'p1.scale': 1 };
    for (const k in P){ const i = model.index[k]; if (i != null) v[i] = P[k]; }
    E.setParams(model, v);
    const o = new Float64Array(model.n), t0 = performance.now(); E.ENG.phasePattern(model, model.v, 0, o); return { o, ms: performance.now() - t0 }; };
  const A = one(E0), B = one(E1), S = pat.truth.P['p1.scale'], ph = pat.parts.phase, bg = pat.parts.bg, n = ph.length;
  let pk = 0, mA = 0, mB = 0, eA = 0, eB = 0, mAB = 0;
  for (let i = 0; i < n; i++){ pk = Math.max(pk, ph[i]); const dA = S*A.o[i] - ph[i], dB = S*B.o[i] - ph[i], w = 1/Math.max(1, ph[i] + bg[i]);
    mA = Math.max(mA, Math.abs(dA)); mB = Math.max(mB, Math.abs(dB)); eA += dA*dA*w; eB += dB*dB*w; mAB = Math.max(mAB, Math.abs(S*(A.o[i] - B.o[i]))); }
  const r = { id, error: row.error ? row.error.kind : 'none', counts: row.counts, wppm: { maxDev: mA/pk, excess: eA/n, ms: A.ms }, mode: { maxDev: mB/pk, excess: eB/n, ms: B.ms }, vsWppm: mAB/pk };
  out.push(r);
  console.log(`${id.padEnd(26)} WPPM ${f(100*r.wppm.maxDev)} % ${f(r.wppm.excess, 4)} | ${process.env.PROTO_WPPM || 'default'} ${f(100*r.mode.maxDev)} % ${f(r.mode.excess, 4)} | against WPPM ${r.vsWppm.toExponential(2)} of the peak`);
}
const ok = out.filter(r=> !r.skipped), med = xs => { const s = xs.slice().sort((p, q)=> p - q); return s[Math.floor((s.length - 1)/2)]; }, p90 = xs => { const s = xs.slice().sort((p, q)=> p - q); return s[Math.ceil(0.9*s.length) - 1]; };
const M = k => ok.map(r=> r[k].maxDev), X = k => ok.map(r=> r[k].excess);
console.log(`${ok.length} rows: WPPM max|Δ| ${f(100*med(M('wppm')), 2)} % (90 %: ${f(100*p90(M('wppm')), 2)}), excess ${f(med(X('wppm')), 4)} (max ${f(Math.max(...X('wppm')), 3)}); ${process.env.PROTO_WPPM || 'default'} ${f(100*med(M('mode')), 2)} % (${f(100*p90(M('mode')), 2)}), ${f(med(X('mode')), 4)} (${f(Math.max(...X('mode')), 3)}); against WPPM max ${Math.max(...ok.map(r=> r.vsWppm)).toExponential(2)} (median ${med(ok.map(r=> r.vsWppm)).toExponential(2)})`);
if (opt.out) fs.writeFileSync(opt.out, JSON.stringify({ flags: process.env.PROTO_WPPM || '', rows: out }, null, 1));
