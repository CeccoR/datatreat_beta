/* Step 2: where WPPM's cost goes. Per row (one per Laue class), the solid at the truth (widths
   ×1.1, so the refinement moves), WPPM and lsq: a central refinement as the search's full ones
   (faces rounded, no covariance, 3 iterations), the free set autoRefine's (scale, background,
   cell, B, Xs) + the widths and turns; the parts' times from prof/engp's timers.
   node prof/prof.mjs [rows,...] [--it 3] [--json out] */
import fs from 'node:fs';
const { buildModel, setParams, ENG } = await import(process.env.ENGP || './engp/xrd-rietveld.js');
const { phaseOf, truthOf, FS2 } = await import('../lib.mjs');
const { drawRow } = await import('../../../gen/gen.mjs');
const a = process.argv.slice(2), opt = {}; const pos = [];
for (let i = 0; i < a.length; i++){ if (a[i].startsWith('--')){ opt[a[i].slice(2)] = a[i + 1]; i++; } else pos.push(a[i]); }
const design = JSON.parse(fs.readFileSync(FS2 + '/design/design.json', 'utf8'));
const DEF = 'box-P-1-near,ellcyl-P2m-generic,ellipsoid-Pmmm-generic,box-P4m-near,cylinder-P4mmm-on,spheroid-P-3-near,box-P-3m1-near,cylinder-P6m-on,ellipsoid-P6mmm-generic,sqbox-Pm-3-on,ellcyl-Pm-3m-generic';
const rows = (pos[0] || DEF).split(',');
const P = globalThis.__P, out = [];
const reset = ()=> { P.t = {}; P.n = {}; P.N = {}; P.nL = 0; P.lines = 0; P.members = 0; P.nodes = 0; P.read = 0; P.evals = 0; };
for (const id of rows){
  const row = design.rows.find(r=> r.id === id);
  if (!row || row.split === 'validation') throw new Error('row ' + id);
  const pat = drawRow(row, {}), T = truthOf(row);
  const res = { id, laue: row.laue, solid: row.solid };
  for (const prof of ['wppm', 'lsq']){
    const ph = { ...phaseOf(row.phase, row.solid), profile: prof === 'wppm' ? 'wppm' : 'lorentz' };
    const model = buildModel({ x: pat.x, y: Array.from(pat.y), instr: pat.instr, phases: [ph] }), q = model.phases[0];
    const v = model.v.slice(), TP = { ...pat.truth.P, 'p1.Ys': 0 };
    for (const k in TP){ const i = model.index[k]; if (i != null) v[i] = TP[k]; }
    q.iW.forEach(i=> { v[i] *= 1.1; });
    setParams(model, v);
    const names = ['p1.scale', ...model.iBg.map(i=> model.par[i].name), ...model.par.filter(p=> /^p1\.(a|b|c|alpha|beta|gamma)$/.test(p.name)).map(p=> p.name), 'zero', 'p1.B', 'p1.Xs', ...q.iW.map(i=> model.par[i].name), ...q.iR.map(i=> model.par[i].name)];
    // the cell's free parameters: those the constraint leaves (buildModel's tie)
    const freeNames = names.filter(nm=> { const i = model.index[nm]; return i != null && !model.par[i].tied; });
    reset();
    model.shapeSoft = { q, soft: ENG.SHAPE_SOFT };
    const t0 = performance.now();
    let r; try { r = ENG.refine(model, { free: freeNames, maxIter: +(opt.it || 3), noCov: true }); } catch(e){ r = { error: String(e) }; }
    const ms = performance.now() - t0;
    model.shapeSoft = null;
    res[prof] = { ms, evals: P.evals, msEval: ms/P.evals, iter: r.iterations, t: { ...P.t }, n: { ...P.n }, N: { ...P.N }, lines: P.lines, nLmean: P.nL/Math.max(1, P.lines), membersPerLine: P.members/Math.max(1, P.lines), nodesPerLine: P.nodes/Math.max(1, P.lines), readPerLine: P.read/Math.max(1, P.lines), free: freeNames.length, refl: q.nRefl, members: q.mv.reduce((s, m)=> s + m.length/3, 0) };
  }
  out.push(res);
  const w = res.wppm, l = res.lsq, f = x => x.toFixed(1);
  const sec = ['com', 'size', 'fill', 'fft', 'read', 'pair', 'lineNodes', 'sollerMiss', 'shapeTs'].map(k=> `${k} ${f(100*(w.t[k] || 0)/w.t.phase)}%`).join(' ');
  const lineOther = w.t.lineOf - ['com', 'size', 'fill', 'fft', 'read', 'lineNodes'].reduce((s, k)=> s + (w.t[k] || 0), 0);
  console.log(`   lsq: lineNodesAll ${f(100*(l.t.lineNodesAll || 0)/l.t.phase)}% sollerMiss ${f(100*(l.t.sollerMiss || 0)/l.t.phase)}% misses/ev ${((l.n.scMiss || 0)/l.evals).toFixed(1)}; WPPM misses/ev ${((w.n.scMiss || 0)/w.evals).toFixed(1)}`);
  console.log(`${id} (${row.laue}): refl ${w.refl}, members ${w.members}, free ${w.free} | WPPM ${f(w.msEval)} ms/ev (${w.evals} ev, ${w.iter} it), lsq ${f(l.msEval)} ms/ev (${l.evals} ev) ratio ${(w.msEval/l.msEval).toFixed(2)} | ${sec} lineOf-rest ${f(100*lineOther/w.t.phase)}% phase-rest ${f(100*(w.t.phase - w.t.lineOf - (w.t.shapeTs || 0))/w.t.phase)}% | lines/ev ${(w.lines/w.evals).toFixed(0)}, nL ${w.nLmean.toFixed(0)}, members/line ${w.membersPerLine.toFixed(1)}, nodes/line ${w.nodesPerLine.toFixed(1)}, read/line ${w.readPerLine.toFixed(0)}, N ${JSON.stringify(w.N)}`);
  const cols = Object.keys(w.t).filter(k=> k.startsWith('col:'));
  console.log('   columns ms (WPPM/lsq): ' + cols.map(k=> `${k.slice(4)} ${(w.t[k]/w.n[k]).toFixed(1)}/${l.t[k] ? (l.t[k]/l.n[k]).toFixed(1) : '-'}`).join(' '));
}
if (opt.json) fs.writeFileSync(opt.json, JSON.stringify(out, null, 1));
