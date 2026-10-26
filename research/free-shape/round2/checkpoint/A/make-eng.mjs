/* Track A's engine and harness, built from the shared ones (read-only):
   - eng/: ../harness/eng (b9bef5f, instrumented only) copied, and xrd-rietveld.js patched so
     that the size line of every member, and the isotropic sphere's, is the TCH line of a
     Gaussian and a Lorentzian size width given by lines/sizeline.mjs (mode FS2A_LINE: lor, the
     frozen engine's arithmetic exactly; ib; mom; lsq). Nothing else changes.
   - harness/lib.mjs: ../harness/lib.mjs with its imports on eng/ here and the shared fs2
     folders, and the phase's profile from FS2A_PROFILE (lorentz, or wppm: the engine's own
     Fourier route, option c).
   Run: node make-eng.mjs (idempotent; writes eng/, eng.diff, harness/lib.mjs). */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const HERE = path.dirname(new URL(import.meta.url).pathname), FS2 = path.resolve(HERE, '..');
const SRC = path.join(FS2, 'harness', 'eng'), DST = path.join(HERE, 'eng');
fs.mkdirSync(DST, { recursive: true });
for (const f of fs.readdirSync(SRC)) if (f !== 'xrd-rietveld.js'){ fs.copyFileSync(path.join(SRC, f), path.join(DST, f) + '.tmp'); fs.renameSync(path.join(DST, f) + '.tmp', path.join(DST, f)); }
const p = path.join(DST, 'xrd-rietveld.js');
let s = fs.readFileSync(path.join(SRC, 'xrd-rietveld.js'), 'utf8');
const once = (a, b) => { const i = s.indexOf(a); if (i < 0 || s.indexOf(a, i + 1) >= 0) throw new Error('patch anchor not unique: ' + a.slice(0, 70)); s = s.replace(a, b); };
once(`import { gaussLegendre, lowerBound, inv3n, hklText } from './xrd-math.js';`,
`import { gaussLegendre, lowerBound, inv3n, hklText } from './xrd-math.js';
// [A] the size line's Gaussian and Lorentzian parts (Track A)
import { SIZE_MODE, BALL_K, sizeKs, NO_EARLY } from '../lines/sizeline.mjs';`);
once(`function profileAtTheta(th, U, V, W, X, Y){`,
`// [A] the same with a Gaussian size width G (°, before the 1/cosθ) added in quadrature
function profileAtThetaG(th, U, V, W, X, Y, G){
  const t = Math.tan(th), c = Math.cos(th), g = G/c;
  const HG = Math.sqrt(Math.max(HG2_FLOOR, U*t*t + V*t + W) + g*g);
  const HL = Math.max(0, X*t + Y/c);
  return tch(HG, HL);
}
function profileAtTheta(th, U, V, W, X, Y){`);
once(`function shapeMatrix(L){`,
`// [A] each member's Gaussian and Lorentzian multipliers [kg, kl] on its width (sizeline.mjs)
function shapeKs(model, q, v){
  const base = BODIES[q.shapeType].base;
  return shapeTs(model, q, v).map(t=>{
    const m = t.length/3, out = new Float64Array(2*m);
    for (let i = 0; i < m; i++) sizeKs(base, t[3*i], t[3*i + 1], t[3*i + 2], out, 2*i);
    return out;
  });
}
function shapeMatrix(L){`);
once(`  const shp = act && !wppm ? shapeWidths(model, q, v) : null, ts = act && wppm ? shapeTs(model, q, v) : null;`,
`  const shp = act && !wppm ? shapeWidths(model, q, v) : null, ts = act && wppm ? shapeTs(model, q, v) : null;
  const shk = shp && q.iW && SIZE_MODE !== 'lor' ? shapeKs(model, q, v) : null;   // [A]`);
once(`{ U, V, W, X: Xr, Y: Yr, A, ws: lr }`, `{ U, V, W, X: Xr, Y: Yr, A, ws: lr, ks: shk ? shk[r] : null }`);
once(`  const { U, V, W, X, Y, A, ws = 1 } = prof;`, `  const { U, V, W, X, Y, A, ws = 1, ks = null } = prof;`);
once(`    const pr = profileAtTheta(th, U, V, W, X, Y + ws*wv[i]), ti = tw ? tw[i] : 1;`,
`    const pr = ks ? profileAtThetaG(th, U, V, W, X, Y + ws*wv[i]*ks[2*i + 1], ws*wv[i]*ks[2*i]) : profileAtTheta(th, U, V, W, X, Y + ws*wv[i]), ti = tw ? tw[i] : 1;`);
once(`      const pr = profileAtTheta(th, U, V, W, Xr, Yr);`,
`      // [A] the isotropic sphere's line: its Gaussian and Lorentzian parts
      const pr = SIZE_MODE !== 'lor' && Ys > 0 && !q.iL ? profileAtThetaG(th, U, V, W, Xr, Yr - lr*Ys*(1 - BALL_K[1]), lr*Ys*BALL_K[0]) : profileAtTheta(th, U, V, W, Xr, Yr);`);
// [A] FS2A_NOEARLY=1: no early rejection (the cross-solid fits: every solid refined to its minimum)
once(`  if (!(gain > (10 + dPmin*Math.log(N))/2)){ setParams(model, vIso); return { rejected: true, dBIC: dPmin*Math.log(N) - gain, early: true }; }`,
`  if (!NO_EARLY && !(gain > (10 + dPmin*Math.log(N))/2)){ setParams(model, vIso); return { rejected: true, dBIC: dPmin*Math.log(N) - gain, early: true }; }`);
once(`const ENG = { FS, freeShape,`, `const ENG = { SIZE_MODE, BALL_K, NO_EARLY, shapeKs, profileAtThetaG, profileAtTheta, tch, FS, freeShape,`);
fs.writeFileSync(p + '.tmp', s); fs.renameSync(p + '.tmp', p);   // (atomic: runs may be starting)
try { execFileSync('diff', ['-u', path.join(SRC, 'xrd-rietveld.js'), p], { encoding: 'utf8' }); }
catch(e){ fs.writeFileSync(path.join(HERE, 'eng.diff'), e.stdout); }
// the harness
let L = fs.readFileSync(path.join(FS2, 'harness', 'lib.mjs'), 'utf8');
const rep = (a, b) => { if (L.indexOf(a) < 0) throw new Error('lib anchor: ' + a); L = L.split(a).join(b); };
rep(`from './eng/`, `from '../eng/`);
rep(`import { PHASES } from '../phases/make-phases.mjs';`, `import { PHASES } from '../../phases/make-phases.mjs';`);
rep(`export const FS2 = path.resolve(HERE, '..');`, `export const FS2 = path.resolve(HERE, '..', '..');   // [A] the shared fs2 folders`);
rep(`export const PHASE_OPTS = { size: true, profile: 'lorentz',`, `export const PHASE_OPTS = { size: true, profile: process.env.FS2A_PROFILE || 'lorentz',`);
fs.mkdirSync(path.join(HERE, 'harness'), { recursive: true });
fs.writeFileSync(path.join(HERE, 'harness', 'lib.mjs.tmp'), '/* [A] Track A copy of ../../harness/lib.mjs (make-eng.mjs): engine ../eng, size line by FS2A_LINE, profile by FS2A_PROFILE. */\n' + L);
fs.renameSync(path.join(HERE, 'harness', 'lib.mjs.tmp'), path.join(HERE, 'harness', 'lib.mjs'));
console.log('eng/ and harness/lib.mjs written');
