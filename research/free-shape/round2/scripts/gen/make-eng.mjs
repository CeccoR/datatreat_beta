/* Builds gen/eng/: the frozen engine (fs2/engine, b9bef5f) copied, its xrd-rietveld.js
   given one hook and nothing else:
   - after each line the engine draws with a Lorentzian size width (a free-shape member in
     shapeLine, or an isotropic line with Ys > 0), model.sizeHook(out, line), when set, is
     called with what that line was drawn from: the member, the line (α1/α2), θ, 2θ, its
     area, its axial nodes, its window, the profile without the size, and the size width.
     The generator adds there the difference between the exact size line and the
     Lorentzian (gen.mjs). Without model.sizeHook the engine is the frozen one.
   - internals exported as ENG (read-only use).
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
// a free-shape member
once('    addLine(out, x, tt, pr.H, pr.eta, Im, nodes, win);\n',
`    addLine(out, x, tt, pr.H, pr.eta, Im, nodes, win);
    // [gen] the exact size line's difference from this Lorentzian
    if (model.sizeHook) model.sizeHook(out, { q, k, r, j, i, th, tt, I: Im, nodes, half, H: pr.H, eta: pr.eta, rest: profileAtTheta(th, U, V, W, X, Y), w: wv[i], lam: model.lines[j].lam });
`);
// an isotropic line (the sphere)
once('      addLine(out, x, tt, pr.H, pr.eta, I, nodes, win);\n',
`      addLine(out, x, tt, pr.H, pr.eta, I, nodes, win);
      // [gen] the exact size line's difference from this Lorentzian
      if (model.sizeHook && Ys > 0) model.sizeHook(out, { q, k, r, j, i: -1, th, tt, I, nodes, half, H: pr.H, eta: pr.eta, rest: profileAtTheta(th, U, V, W, Xr, Yr - lr*Ys), w: Ys, lam: L.lam });
`);
s += `
// [gen] internals for the generator (read-only)
const ENG = { BODIES, columnLengthV, shapeWidths, shapeTs, bodyFrame, quatMat, quatOfMat, quatMul, quatOfRot, profileAtTheta, tch, lowIndexPlanes,
  textureWeights, textureAxis, memberVectors, phasePattern, lineHalf, K_SCHERRER, D2R, R2D, WIN_FWHM, TAIL_NOISE };
export { ENG };
`;
fs.writeFileSync(p, s);
try { execFileSync('diff', ['-u', path.join(SRC, 'xrd-rietveld.js'), p], { encoding: 'utf8' }); }
catch(e){ fs.writeFileSync(path.join(HERE, 'eng.diff'), e.stdout); }
console.log('eng/ written');
