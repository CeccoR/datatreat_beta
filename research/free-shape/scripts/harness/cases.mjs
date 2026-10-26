/* The case list. Every synthetic case is SrTiO₃ (Pm-3m) drawn by the engine's own forward
   model on one grid and instrument (lib.mjs SAMPLE), with Poisson noise.
   dims: the solid's dimensions in nm along its body axes x, y, z (each the Scherrer-read
   dimension the engine reports: D = Kλ/(W·π/180), the Lorentzian calibration of §10.3).
   The body axes: box Wa Wb Wc on x y z; sqbox side on x and y, height on z; ellipsoid Ea Eb
   Ec; spheroid equator on x and y, polar on z; cylinder diameter on x and y, height (axis)
   on z; ellcyl cross-section a b on x y, height (axis) on z.
   frame: z along the lattice direction z, x along x (exactly normal to it), then turned
   by `turn`° about z, then the whole frame tilted by tilt.deg about tilt.about; or
   { random: seed }: a uniform random rotation.
   kind: 'synth' (3 noise realisations, seeds 1–3), 'control' (isotropic truth: the shape
   should be rejected), 'sample' (sample-like proxies of the user's twelve SrTiO₃ samples,
   which are not on this machine: one realisation each, a broad hump the model lacks),
   'fixture' (the repository's test fixtures s00/s05, refined with s11 as the standard).
   type: the truth's solid and, unless run.mjs --shape says otherwise, the class searched. */
const L110 = [1, 1, 0], L1m10 = [1, -1, 0], L001 = [0, 0, 1], L100 = [1, 0, 0], L010 = [0, 1, 0], L111 = [1, 1, 1];
const S3 = [1, 2, 3];
export const CASES = [
  // ---- box ----
  { id: 'box-plate110', type: 'box', dims: [12, 10, 2], frame: { z: L110, x: L1m10 }, note: "the backlog's 12×10×2 nm plate ⟂[110], edges on [1-10] and [001]" },
  { id: 'box-plate110-t20', type: 'box', dims: [12, 10, 2], frame: { z: L110, x: L1m10, turn: 20 }, note: 'the same plate turned 20° in its plane' },
  { id: 'box-plate100', type: 'box', dims: [16, 12, 3], frame: { z: L001, x: L100 } },
  { id: 'box-needle111', type: 'box', dims: [4, 5, 25], frame: { z: L111, x: L1m10 } },
  { id: 'box-ribbon001', type: 'box', dims: [3, 9, 28], frame: { z: L001, x: L110 }, note: 'thin along [110], wide along [1-10], long along [001]' },
  { id: 'box-block-rand', type: 'box', dims: [8, 11, 15], frame: { random: 6 } },
  { id: 'box-plate110-off8', type: 'box', dims: [14, 13, 3], frame: { z: L110, x: L1m10, tilt: { deg: 8, about: L001 } }, note: 'near-square plate, 8° off the lattice' },
  { id: 'box-plate111-big', type: 'box', dims: [30, 25, 2], frame: { z: L111, x: L1m10 } },
  // ---- square-based box ----
  { id: 'sqbox-plate001', type: 'sqbox', dims: [15, 15, 3], frame: { z: L001, x: L100 } },
  { id: 'sqbox-plate110-t15', type: 'sqbox', dims: [14, 14, 2.5], frame: { z: L110, x: L1m10, turn: 15 } },
  { id: 'sqbox-rod111', type: 'sqbox', dims: [5, 5, 24], frame: { z: L111, x: L1m10, turn: 10 } },
  { id: 'sqbox-block-rand', type: 'sqbox', dims: [10, 10, 16], frame: { random: 11 } },
  { id: 'sqbox-plate-rand', type: 'sqbox', dims: [20, 20, 4], frame: { random: 12 } },
  // ---- ellipsoid ----
  { id: 'ell-plate110', type: 'ellipsoid', dims: [16, 12, 3], frame: { z: L110, x: L1m10 } },
  { id: 'ell-needle100', type: 'ellipsoid', dims: [5, 7, 28], frame: { z: L100, x: L010 } },
  { id: 'ell-ribbon-rand', type: 'ellipsoid', dims: [3, 9, 24], frame: { random: 16 } },
  { id: 'ell-block-t25', type: 'ellipsoid', dims: [8, 11, 16], frame: { z: L001, x: L100, turn: 25 } },
  { id: 'ell-plate111', type: 'ellipsoid', dims: [22, 18, 4], frame: { z: L111, x: L1m10 } },
  // ---- spheroid ----
  { id: 'sph-oblate110', type: 'spheroid', dims: [20, 20, 3], frame: { z: L110, x: L1m10 } },
  { id: 'sph-prolate111', type: 'spheroid', dims: [5, 5, 25], frame: { z: L111, x: L1m10 } },
  { id: 'sph-oblate-rand', type: 'spheroid', dims: [24, 24, 4], frame: { random: 22 } },
  { id: 'sph-mild001', type: 'spheroid', dims: [10, 10, 16], frame: { z: L001, x: L100 } },
  // ---- cylinder ----
  { id: 'cyl-disc110', type: 'cylinder', dims: [18, 18, 2.4], frame: { z: L110, x: L1m10 } },
  { id: 'cyl-rod100', type: 'cylinder', dims: [4, 4, 22], frame: { z: L100, x: L010 } },
  { id: 'cyl-disc-rand', type: 'cylinder', dims: [25, 25, 3], frame: { random: 26 } },
  { id: 'cyl-disc111-off8', type: 'cylinder', dims: [15, 15, 2], frame: { z: L111, x: L1m10, tilt: { deg: 8, about: L1m10 } } },
  // ---- elliptic cylinder ----
  { id: 'ecyl-plate110', type: 'ellcyl', dims: [16, 10, 2.5], frame: { z: L110, x: L001 }, note: 'cross-section 16 along [001], 10 along [1-10]; height along [110]' },
  { id: 'ecyl-plate110-t20', type: 'ellcyl', dims: [16, 10, 2.5], frame: { z: L110, x: L001, turn: 20 } },
  { id: 'ecyl-ribbon001', type: 'ellcyl', dims: [4, 12, 30], frame: { z: L001, x: L110 } },
  { id: 'ecyl-rand', type: 'ellcyl', dims: [6, 14, 9], frame: { random: 30 } },
  // ---- isotropic controls (searched as the solid named in run) ----
  { id: 'iso-7', kind: 'control', type: 'sphere', D: 7, run: 'box', note: 'a 7 nm isotropic size: the box should be rejected' },
  { id: 'iso-20', kind: 'control', type: 'sphere', D: 20, run: 'cylinder', note: 'a 20 nm isotropic size: the cylinder should be rejected' },
  // ---- sample-like proxies of the twelve SrTiO₃ samples: {110} plates (box), Sr site at
  // 1 − 0.64/t (0.32 nm Sr-free per face, RIETVELD.md §8.5), a broad hump at 30° (FWHM 6°,
  // 14–37 % of (110)'s area, larger the lower the occupancy, BACKLOG) that the model lacks.
  ...[
    ['u01', [12, 16, 2.4], 0, 0, 0.20, 0.25], ['u02', [14, 19, 2.0], 0, 0, 0.25, 0.15], ['u03', [13, 23, 1.8], 0, 0, 0.33, 0.10],
    ['u04', [15, 18, 2.6], 0, 0, 0.14, 0.30], ['u05', [11, 14, 1.6], 0, 0, 0.37, 0.02], ['u06', [18, 21, 2.2], 5, 0, 0.22, 0.20],
    ['u07', [12, 13, 2.0], 0, 0, 0.26, 0.15], ['u08', [16, 20, 2.3], 0, 6, 0.20, 0.25], ['u09', [10, 22, 2.5], 30, 0, 0.17, 0.35],
    ['u10', [14, 16, 1.9], 45, 0, 0.30, 0.10], ['u11', [20, 23, 2.6], 0, 0, 0.15, 0.38], ['u12', [12, 18, 2.1], 10, 0, 0.24, 0.20],
  ].map(([id, dims, turn, tilt, hump, dB])=> ({ id, kind: 'sample', type: 'box', dims, frame: { z: L110, x: L1m10, turn, ...(tilt ? { tilt: { deg: tilt, about: L001 } } : {}) },
    occ: +(1 - 0.64/dims[2]).toFixed(3), dB, hump: { pos: 30, fwhm: 6, share: hump }, seeds: [1] })),
  // ---- the repository's fixtures (tests/fixtures.mjs xrdml(k)): pseudo-Voigt lines of one
  // width law, no size broadening beyond the standard's (s11, refined as the standard).
  { id: 'fx-s00', kind: 'fixture', file: 's00.xrdml', run: 'box', seeds: [0] },
  { id: 'fx-s05', kind: 'fixture', file: 's05.xrdml', run: 'box', seeds: [0] },
].map(c=> ({ kind: 'synth', seeds: S3, ...c }));
export const caseById = id => { const c = CASES.find(c=> c.id === id); if (!c) throw new Error('no case ' + id); return c; };
