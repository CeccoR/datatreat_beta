/* Track A's size line in the model: per member, the Gaussian and Lorentzian FWHM of its size
   line as multipliers [kg, kl] on the engine's own Lorentzian width w (FWHM 0.675/⟨L⟩_V in d*,
   the sphere-calibrated width of the member's ⟨L⟩_V). The engine then draws its TCH line with
   HG² += (kg·w/cosθ)² and HL += kl·w/cosθ (A/make-eng.mjs). The mode is the environment's
   FS2A_LINE:
   - lor  today's: [0, 1];
   - ib   (a) the breadth convention: a Lorentzian of integral breadth 1/⟨L⟩_V, FWHM 2/(π⟨L⟩_V);
   - mom  (b1) the TCH line with the exact line's Porod tail and integral breadth;
   - lsq  (b2) the TCH line that best fits the exact line (weighted least squares);
   both (b) from tables.json (build-tables.mjs) in the member's reduced shape along it:
   the ball's one entry (sphere, ellipsoid, spheroid), the cylinder's angle ψ from its axis in
   the scaled body (elliptic cylinder too), the box's two ratios of the sorted scaled
   direction components. FS2A_TABLES names another table file. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SIZE_MODE = process.env.FS2A_LINE || 'lor';
export const NO_EARLY = process.env.FS2A_NOEARLY === '1';   // freeShape's early rejection off (cross-solid fits)
// [fix] FS2A_WPPM_BALL=1: in the WPPM profile every member's size line is the ball's at the member's own
// ⟨L⟩_V (the same line shape in every direction): the control for what the direction-dependent shape adds
export const WPPM_BALL = process.env.FS2A_WPPM_BALL === '1';
const G0 = 0.675;
let TAB = null, key = null;
if (SIZE_MODE === 'mom' || SIZE_MODE === 'lsq'){
  TAB = JSON.parse(fs.readFileSync(process.env.FS2A_TABLES || path.join(HERE, 'tables.json'), 'utf8'));
  key = SIZE_MODE;
}
const k2 = e => [e[key][0]/G0, e[key][1]/G0];
export const BALL_K = SIZE_MODE === 'lor' ? [0, 1] : SIZE_MODE === 'ib' ? [0, 2/Math.PI/G0] : k2(TAB.ball);
const CYL = TAB && TAB.cyl.e.map(k2), BOX = TAB && TAB.box.e.map(r=> r.map(k2));
const CS = TAB && TAB.cyl.stepDeg, BS = TAB && TAB.box.step, BN = TAB && TAB.box.n;
/* sizeKs(base, t1, t2, t3, out, o): out[o], out[o + 1] = kg, kl for a member whose direction
   in the scaled base body is t (any length; the engine's shapeTs). */
export function sizeKs(base, t1, t2, t3, out, o){
  if (!TAB || base === 'ball'){ out[o] = BALL_K[0]; out[o + 1] = BALL_K[1]; return; }
  const a1 = Math.abs(t1), a2 = Math.abs(t2), a3 = Math.abs(t3);
  if (base === 'cylinder'){
    const f = Math.min(CYL.length - 1 - 1e-9, Math.atan2(Math.hypot(a1, a2), a3)*180/Math.PI/CS), i = Math.floor(f), u = f - i;
    out[o] = CYL[i][0] + u*(CYL[i + 1][0] - CYL[i][0]); out[o + 1] = CYL[i][1] + u*(CYL[i + 1][1] - CYL[i][1]);
    return;
  }
  // box: sorted a ≥ b ≥ c, β = b/a, γ = c/a, bilinear
  let a = a1, b = a2, c = a3, t;
  if (b > a){ t = a; a = b; b = t; } if (c > a){ t = a; a = c; c = t; } if (c > b){ t = b; b = c; c = t; }
  if (!(a > 0)){ out[o] = BALL_K[0]; out[o + 1] = BALL_K[1]; return; }
  const fb = Math.min(BN - 1 - 1e-9, b/a/BS), fc = Math.min(BN - 1 - 1e-9, c/a/BS), i = Math.floor(fb), j = Math.floor(fc), u = fb - i, v = fc - j;
  const p00 = BOX[i][j], p10 = BOX[i + 1][j], p01 = BOX[i][j + 1], p11 = BOX[i + 1][j + 1];
  for (let k = 0; k < 2; k++) out[o + k] = (1 - u)*(1 - v)*p00[k] + u*(1 - v)*p10[k] + (1 - u)*v*p01[k] + u*v*p11[k];
}
