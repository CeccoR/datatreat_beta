/* make-diag.mjs: the diagnostic harness hd/ (STEP1.md §5): ../h's lib.mjs, run.mjs, batch.mjs, data
   and eng/ copied, and eng/xrd-rietveld.js given two switches that are not in the app:
   - DIAG_FILL=1: search v2 with v522's random fill kept (the same random starts, from the
     main stream), in place of skipping its draws;
   - PROTO_FWD=none: v2 with central differences in the brief trials too (no forward
     differences anywhere).
   Run from hd/ after ../h/make-eng.mjs. Jobs: DIAG_FILL=1 node batch.mjs jobs-fill.txt;
   node batch.mjs jobs-none.txt. */
import fs from 'node:fs';
import path from 'node:path';
const HERE = path.dirname(new URL(import.meta.url).pathname), H = path.join(HERE, '..', 'h');
for (const f of ['lib.mjs', 'run.mjs', 'batch.mjs']) fs.copyFileSync(path.join(H, f), path.join(HERE, f));
fs.cpSync(path.join(H, 'data'), path.join(HERE, 'data'), { recursive: true });
fs.cpSync(path.join(H, 'eng'), path.join(HERE, 'eng'), { recursive: true });
const p = path.join(HERE, 'eng', 'xrd-rietveld.js');
let s = fs.readFileSync(p, 'utf8');
const once = (a, b) => { const i = s.indexOf(a); if (i < 0 || s.indexOf(a, i + 1) >= 0) throw new Error('anchor: ' + a.slice(0, 60)); s = s.replace(a, b); };
once(`      for (let c = starts.length; c < nStarts + 1; c++) for (let d = 0; d < 7; d++) gauss();`,
`      if (process.env.DIAG_FILL === '1') while (starts.length < nStarts + 1) starts.push(put(Wof(...[0, 1, 2].map(()=> w0*Math.exp(0.8*gauss()))), randomTurn()));   // [diagnostic] v522's fill kept
      else for (let c = starts.length; c < nStarts + 1; c++) for (let d = 0; d < 7; d++) gauss();`);
once(`  const lmBrief = { maxIter: Math.min(8, F.maxIter), shiftTol: F.shiftTol, lambda: F.lambda, ...lmX };`,
`  const lmBrief = { maxIter: Math.min(8, F.maxIter), shiftTol: F.shiftTol, lambda: F.lambda, ...lmX, ...(v2 && SHAPE_FWD === 'none' ? { forward: false } : null) };   // [diagnostic] 'none'`);
once(`...(v2 && SHAPE_FWD === 'briefs' ? { forward: false } : null) };`, `...(v2 && (SHAPE_FWD === 'briefs' || SHAPE_FWD === 'none') ? { forward: false } : null) };`);
fs.writeFileSync(p, s);
let r = fs.readFileSync(path.join(HERE, 'run.mjs'), 'utf8');
r = r.replace(`out.mode = { ...ENG.SHAPE_MODE, fwd: ENG.SHAPE_FWD,`, `out.mode = { ...ENG.SHAPE_MODE, fwd: ENG.SHAPE_FWD, diagFill: process.env.DIAG_FILL === '1',`);
fs.writeFileSync(path.join(HERE, 'run.mjs'), r);
console.log('hd/ written');
