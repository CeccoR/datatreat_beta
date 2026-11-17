/* Track B's engine: the harness's instrumented copy of b9bef5f (../harness/eng, counters
   only) copied to h/eng/, with opt-in options on the least-squares solver read from
   refine()'s opts.x. With no opts.x nothing changes: today's arithmetic, evaluation for
   evaluation (checked: run.mjs --method today against the pilot's records).
   opts.x:
   - noCov: no covariance at the end (no final evaluate + central Jacobian): an intermediate
     refinement whose esds nobody reads.
   - covOnly: no iterations, the covariance alone (central): the returned fit's esds, once.
   - fwd: forward differences in the iterations (one displaced point a non-linear column;
     the pattern at v is the state's, same FCJ node counts); one-sided backward at an upper
     bound. The covariance, when made, stays central.
   Run: node make-eng.mjs (idempotent; writes h/eng/ and eng.diff). */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(HERE, '..', 'harness', 'eng'), DST = path.join(HERE, 'h', 'eng');
fs.mkdirSync(DST, { recursive: true });
for (const f of fs.readdirSync(SRC)) fs.copyFileSync(path.join(SRC, f), path.join(DST, f));
const p = path.join(DST, 'xrd-rietveld.js');
let s = fs.readFileSync(p, 'utf8');
const once = (a, b) => { const i = s.indexOf(a); if (i < 0 || s.indexOf(a, i + 1) >= 0) throw new Error('patch anchor not unique: ' + a.slice(0, 80)); s = s.replace(a, b); };

once(`function refineHeld(model, opts){
  const t0 = Date.now();`, `function refineHeld(model, opts){
  const t0 = Date.now(), X = opts.x || {};`);
once(`  for (; m && it < maxIter; it++){
    jacobian(model, v, st, free, cols);`, `  for (; m && !X.covOnly && it < maxIter; it++){
    if (X.fwd) jacobianFwd(model, v, st, free, cols); else jacobian(model, v, st, free, cols);`);
once(`  st = evaluate(model, v, st);
  const esd = {}, atBound = [], esdHeld = {};
  let corr = null, cov = null, tied = [];
  if (m){`, `  if (!X.noCov) st = evaluate(model, v, st);
  const esd = {}, atBound = [], esdHeld = {};
  let corr = null, cov = null, tied = [];
  if (m && !X.noCov){`);
once(`function normalEq(model, cols, st){`, `/* [track B] jacobian with forward differences: the pattern at v is st's (this
   refinement's, same FCJ node counts), one displaced point a non-linear column; at an
   upper bound the point below. Linear columns exact, as jacobian's. */
function jacobianFwd(model, v, st, free, cols){
  const n = model.n, np = model.phases.length;
  const tmpA = new Float64Array(n);
  free.forEach((j, a)=>{
    const p = model.par[j], col = cols[a];
    if (p.linear){ col.set(p.group === 'bg' ? model.basis[p.basis] : st.pats[p.phase]); return; }
    col.fill(0);
    const h = diffStep(model, j, v);
    let up = v[j] + h, dn = v[j];
    if (up > p.hi){ up = v[j]; dn = Math.max(p.lo, v[j] - h); }
    if (up === dn) return;
    const vd = v.slice(); vd[j] = up === v[j] ? dn : up;
    const ks = p.group === 'phase' ? [p.phase] : [...Array(np).keys()];
    for (const k of ks){
      const S = v[model.phases[k].iScale]; if (!S) continue;
      phasePattern(model, vd, k, tmpA);
      const P0 = st.pats[k], f = S/(up - dn);
      if (up === v[j]) for (let i = 0; i < n; i++) col[i] += f*(P0[i] - tmpA[i]);
      else for (let i = 0; i < n; i++) col[i] += f*(tmpA[i] - P0[i]);
    }
  });
  return cols;
}
function normalEq(model, cols, st){`);
once(`  bodyShapeOf, SNAP_DEG, D2R, R2D, K_SCHERRER, lowIndexPlanes, memberVectors, phasePattern, cartOp, properOp };
export { ENG };`, `  bodyShapeOf, SNAP_DEG, D2R, R2D, K_SCHERRER, lowIndexPlanes, memberVectors, phasePattern, cartOp, properOp,
  jacobian, jacobianFwd, diffStep, solveLinear };
export { ENG };`);
fs.writeFileSync(p, s);
try { execFileSync('diff', ['-u', path.join(SRC, 'xrd-rietveld.js'), p], { encoding: 'utf8' }); }
catch(e){ fs.writeFileSync(path.join(HERE, 'eng.diff'), e.stdout); }
console.log('h/eng written');
