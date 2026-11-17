/* [step4] ENG also carries SHAPE_MINIMA, shapeMinima and minimaMatch; FS.min counts the minima stage's
   evaluations and wall time (shapeMinima wrapped); PROTO_TURNSEED, when set, seeds the search's main
   random stream instead of v522's 0x9e3779b9: the starts' small tilts and, with the stage off, the
   turns before the polish and the refit (with the stage on there are none).
   [step3] ENG also carries SHAPE_CHECK, lineCheck and lineJack where the copy has them.
   Step 2's harness engine (step 1's make-eng.mjs, extended): the patched app copy's engine files
   (an argument, e.g. $W/step2-app or $W/step1-app) copied to eng/, xrd-rietveld.js instrumented with
   fs2/harness/make-eng.mjs's anchors (counters, the refine log, the shapeHook, ENG), no arithmetic
   changed; the tunable SHAPE_FWD read from PROTO_FWD (else the copy's default) and, on step 2's
   engine, WPPM_OPT from PROTO_WPPM when it is set ('' all off; flags fast, pair (implies fast),
   axial), else the copy's defaults. Run after every engine edit. */
import fs from 'node:fs';
import path from 'node:path';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const SRC = process.argv[2] || path.join(HERE, '..', 'app'), DST = path.join(HERE, 'eng');
fs.mkdirSync(DST, { recursive: true });
const files = ['xrd-rietveld.js', 'xrd-cryst.js', 'xrd-data.js', 'xrd-instr.js', 'xrd-broad.js', 'xrd-math.js', 'xrd-sg.js', 'xrd-widths.js', 'xrd-rv-model.js', 'db.js', 'xrd-sizeline.js'];
for (const f of files) if (fs.existsSync(path.join(SRC, f))) fs.copyFileSync(path.join(SRC, f), path.join(DST, f));
const p = path.join(DST, 'xrd-rietveld.js');
let s = fs.readFileSync(p, 'utf8');
const once = (a, b) => { const i = s.indexOf(a); if (i < 0 || s.indexOf(a, i + 1) >= 0) throw new Error('patch anchor not unique: ' + a.slice(0, 60)); s = s.replace(a, b); };
once('function phasePattern(model, v, k, out, ticks){',
`const FS = { evals: 0, log: null, k: -1, t0: 0, min: { evals: 0, ms: 0 } };
function phasePattern(model, v, k, out, ticks){ FS.evals++; return phasePattern_(model, v, k, out, ticks); }
function phasePattern_(model, v, k, out, ticks){`);
once('function refine(model, opts = {}){',
`function refine(model, opts = {}){
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
const ENG = { FS, freeShape, freeShapeRun, ...(typeof SHAPE_CHECK === 'undefined' ? {} : { SHAPE_CHECK, lineCheck, lineJack }),   // [step3]
  ...(typeof SHAPE_MINIMA === 'undefined' ? {} : { SHAPE_MINIMA, shapeMinima, minimaMatch, minimaSigmas }),   // [step4]
  ...(typeof SHAPE_KEEP === 'undefined' ? {} : { SHAPE_KEEP }), ...(typeof SHAPE_FAMILY === 'undefined' ? {} : { SHAPE_FAMILY, familyVerdict }),   // [step5]
  refine, setParams, getParams, evaluate, calc, rStats, bodyFrame, BODIES, quatMat, quatOfMat, quatMul, quatOfRot,
  lowIndexAxes, lattDirection, latticeAcross, shapeWidths, shapeTs, columnLengthV, SHAPE_SOFT, SHAPE_STARTS, SHAPE_FULL, fitSettings, shapeOf, turnEsds,
  bodyShapeOf, SNAP_DEG, D2R, R2D, K_SCHERRER, lowIndexPlanes, memberVectors, phasePattern, cartOp, properOp, SHAPE_MODE: typeof SHAPE_MODE === 'undefined' ? null : SHAPE_MODE };
export { ENG };
`;
{ const m = s.match(/^const SHAPE_FWD = '(\w+)';$/m); if (!m) throw new Error('no SHAPE_FWD');
  s = s.replace(m[0], `const SHAPE_FWD = process.env.PROTO_FWD || '${m[1]}';   // [step1]`); }
s = s.replace('SHAPE_MODE: typeof SHAPE_MODE', 'SHAPE_FWD, SHAPE_MODE: typeof SHAPE_MODE');
// [step4] the minima stage's cost; the turns' seed
if (s.includes('function shapeMinima(model, k, ends, o){')){
  once('function shapeMinima(model, k, ends, o){', `function shapeMinima(model, k, ends, o){ const e0 = FS.evals, t0 = Date.now(); try { return shapeMinima_(model, k, ends, o); } finally { FS.min.evals += FS.evals - e0; FS.min.ms += Date.now() - t0; } }
function shapeMinima_(model, k, ends, o){`);
}
once('const gauss = mulberry(0x9e3779b9);', 'const gauss = mulberry(process.env.PROTO_TURNSEED ? +process.env.PROTO_TURNSEED : 0x9e3779b9);   // [step4]');
fs.writeFileSync(p, s);
// [step2] WPPM_OPT from PROTO_WPPM when it is set ('' all off; flags fast, pair (fast and the pairs), axial),
// else the copy's defaults
{ const b = path.join(DST, 'xrd-broad.js'); let t = fs.readFileSync(b, 'utf8');
  const m = t.match(/^const WPPM_OPT = (\{[^}]*\});/m);
  if (m){
    const E = "(process.env.PROTO_WPPM || '')";
    t = t.replace(m[0], `const WPPM_OPT = process.env.PROTO_WPPM != null ? { fast: /fast|pair/.test(${E}), pair: /pair/.test(${E}), axial: /axial/.test(${E}) } : ${m[1]};   // [step2]`);
    fs.writeFileSync(b, t);
  } }
console.log('eng/ from ' + SRC);
