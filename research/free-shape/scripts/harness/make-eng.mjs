/* Builds harness/eng/: the frozen engine (fs/engine, git archive of bf228ee) copied, its
   xrd-rietveld.js instrumented. Nothing in the engine's arithmetic changes:
   - phasePattern is wrapped to count one pattern evaluation per call (one phase's
     pattern: the unit every refinement, Jacobian column and audit pays for);
   - refine is wrapped to log each call made while FS.log is on (the free-shape search):
     its iterations, evaluations, time, χ² at the end and the shape's parameters there;
   - autoRefine's call of freeShape goes through opts.shapeHook when one is given;
   - internals the methods need are exported as ENG.
   Run: node make-eng.mjs (idempotent; writes eng/ and eng.diff). */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const SRC = path.join(HERE, '..', 'engine'), DST = path.join(HERE, 'eng');
fs.mkdirSync(DST, { recursive: true });
const files = ['xrd-rietveld.js', 'xrd-cryst.js', 'xrd-data.js', 'xrd-instr.js', 'xrd-broad.js', 'xrd-math.js', 'xrd-sg.js', 'xrd-widths.js', 'xrd-rv-model.js', 'db.js'];
for (const f of files) fs.copyFileSync(path.join(SRC, f), path.join(DST, f));
const p = path.join(DST, 'xrd-rietveld.js');
let s = fs.readFileSync(p, 'utf8');
const once = (a, b) => { const i = s.indexOf(a); if (i < 0 || s.indexOf(a, i + 1) >= 0) throw new Error('patch anchor not unique: ' + a.slice(0, 60)); s = s.replace(a, b); };
once('function phasePattern(model, v, k, out, ticks){',
`// [harness] one pattern evaluation per call
const FS = { evals: 0, log: null, k: -1, t0: 0 };
function phasePattern(model, v, k, out, ticks){ FS.evals++; return phasePattern_(model, v, k, out, ticks); }
function phasePattern_(model, v, k, out, ticks){`);
once('function refine(model, opts = {}){',
`// [harness] each refine() of the search logged
function refine(model, opts = {}){
  if (!FS.log) return refine_(model, opts);
  const q = model.phases[FS.k], e0 = FS.evals, t0 = Date.now(), idx = q ? [...(q.iW || q.iL || []), ...(q.iR || []), ...(q.iQ || [])] : [];
  const at = () => idx.map(i=> model.v[i]);
  const rec = { maxIter: opts.maxIter, audit: opts.audit !== false, nFree: (opts.free || []).length, soft: !!model.shapeSoft, rotFree: !!(q && q.iR && q.iR.some(i=> (opts.free || []).includes(model.par[i].name))), from: at() };
  try {
    const r = refine_(model, opts);
    Object.assign(rec, { iterations: r.iterations, evals: FS.evals - e0, ms: Date.now() - t0, chi2: r.stats.chi2*Math.max(1, r.stats.N - r.stats.P), chi2nu: r.stats.chi2, P: r.stats.P, to: at(), evalsAt: FS.evals, tAt: Date.now() - FS.t0 });
    return r;
  } catch(e){ Object.assign(rec, { error: String(e && e.message || e), evals: FS.evals - e0, ms: Date.now() - t0, evalsAt: FS.evals, tAt: Date.now() - FS.t0 }); throw e; }
  finally { FS.log.push(rec); }
}
function refine_(model, opts = {}){`);
once('const r = freeShape(model, k, res, lastFree, {', 'const r = (opts.shapeHook || freeShape)(model, k, res, lastFree, {');
s += `
// [harness] internals for the methods
const ENG = { FS, freeShape, freeShapeRun, refine, setParams, getParams, evaluate, calc, rStats, bodyFrame, BODIES, quatMat, quatOfMat, quatMul, quatOfRot,
  lowIndexAxes, lattDirection, latticeAcross, shapeWidths, shapeTs, columnLengthV, SHAPE_SOFT, SHAPE_STARTS, SHAPE_FULL, fitSettings, shapeOf, turnEsds,
  bodyShapeOf, SNAP_DEG, D2R, R2D, K_SCHERRER, lowIndexPlanes, memberVectors, phasePattern };
export { ENG };
`;
fs.writeFileSync(p, s);
try { execFileSync('diff', ['-u', path.join(SRC, 'xrd-rietveld.js'), p], { encoding: 'utf8' }); }
catch(e){ fs.writeFileSync(path.join(HERE, 'eng.diff'), e.stdout); }
console.log('eng/ written');
