/* Cases the fix runs add to the harness's list (fix/patch-mirror.mjs appends them).
   VPROX: twelve fresh sample-like proxies v01–v12, drawn once from the ranges of u01–u12
   (harness/cases.mjs) by a fixed LCG: {110} box plates 1.6–2.6 nm thick, 10–20 nm and
   1.05–1.6× that across (≤ 25 nm), turned in plane 0° (half of them) or 0–45°, tilted 3–8°
   about [001] in a quarter, Sr site 1 − 0.64/t, ΔB 0.02–0.38, and the same unmodelled hump
   at 30° (FWHM 6°) with a share of (110)'s area 0.14 + 0.23·(2.6 − t) ± 0.04. None of them
   was used to set any threshold or rule.
   MISFIT: four synthetic plates of the harness's list with a misfit the model lacks that is
   not a hump: 'air', a low-angle exponential A·e^{−(2θ − 10°)/τ} (A 600 counts, τ 5°: 3.5×
   the background at 10°, 0.6× at 22.8°), outside the Chebyshev + 1/2θ family; 'mix', a
   second population of the same solid and orientation at half the dimensions with 30 % of
   the volume (a size distribution the one-solid model lacks). */
const L110 = [1, 1, 0], L1m10 = [1, -1, 0], L001 = [0, 0, 1];
let s = 20261026;
const U = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0)/4294967296;
const r1 = x => Math.round(10*x)/10;
export const VPROX = [];
for (let i = 1; i <= 12; i++){
  const t = r1(1.6 + U()*1.0), a = r1(10 + U()*10), b = r1(Math.min(25, a*(1.05 + U()*0.55)));
  const turn = U() < 0.5 ? 0 : Math.round(U()*45), tilt = U() < 0.75 ? 0 : Math.round(3 + U()*5);
  const share = +Math.min(0.40, Math.max(0.12, 0.14 + 0.23*(2.6 - t) + (U() - 0.5)*0.08)).toFixed(2);
  const dB = +(0.02 + U()*0.36).toFixed(2);
  VPROX.push({ id: 'v' + String(i).padStart(2, '0'), kind: 'sample', type: 'box', dims: [a, b, t],
    frame: { z: L110, x: L1m10, turn, ...(tilt ? { tilt: { deg: tilt, about: L001 } } : {}) },
    occ: +(1 - 0.64/t).toFixed(3), dB, hump: { pos: 30, fwhm: 6, share }, seeds: [1], fresh: true });
}
export const MISFIT = [];
for (const base of ['box-plate110', 'cyl-disc110', 'ell-plate110', 'sqbox-plate001']){
  MISFIT.push({ base, id: base + '-air', kind: 'misfit', air: { A: 600, tau: 5 }, seeds: [1] });
  MISFIT.push({ base, id: base + '-mix', kind: 'misfit', mix: { scale: 0.5, f: 0.3 }, seeds: [1] });
}
