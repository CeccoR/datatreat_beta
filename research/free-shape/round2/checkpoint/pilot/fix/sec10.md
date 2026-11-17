## 10. The verification

Two verifiers checked the pilot from scratch, with their own code: one the generator, the other
the phases, the harness, the design and the pilot's numbers. Their scripts are in the work folder
(`fs2/verify-gen`, `fs2/verify-harness`), not in the repository.

**What they reproduced.** Among the rest:
- A(L) against a Monte Carlo common volume in the crystal's frame (315 points, max |z| 3.10);
  2∫A dL against the engine's own widths on all 28 404 list members of the 198 truths (6.8·10⁻¹²);
  the size distribution against their own log-normal (1.5·10⁻⁴).
- The in-model limit on the frozen engine (≤ 1.6·10⁻¹⁶ of the peak); the exact-line correction
  against their own direct synthesis of every line (≤ 6·10⁻⁴ of the peak); the Poisson sampler;
  the drawn patterns; every frame of the design.
- The phases' point groups, multiplicities and rotations from the atoms, by their own
  enumeration; `compareSolids` against a brute force; `test.mjs`; the design's balance and
  hypercube; the orientations' distributions.
- Pilot runs repeated from scratch: every record field bit-identical but the timings.
- `decide.mjs`'s predictions, and the baseline's figures from the digest.

**What they found, and what was done.** Twelve problems. All were checked here; all twelve hold,
three of them as wording only. None was rejected outright; one cause was refined (G3).

| | problem | verdict | fix | re-run |
|---|---|---|---|---|
| H1 | The report's medians and percentiles dropped every run that read an extent as unbounded (JSON writes Infinity as null; `med` kept finite values only), and the anisotropy ratio read (1 + null) as no error. 5 kept truths and 5 truth references read an extent as unbounded. | real (major) | `writeResult`/`readResult` (harness) spell Infinity out and read old nulls back as Infinity; the report keeps ±∞ in medians and percentiles and counts them. | report only |
| H2 | `compareSolids` paired a spheroid's (and a square box's) extents by size: with the aspect flipped, the truth's symmetry axis was compared with an undefined in-plane axis of the fit (spheroid-P-1-generic: 32° reported for an 89° error). | real (major) | Pairing by role for the spheroid and the square box, as for the cylinders; a spheroid within 4 % of a ball has no defined axis. 160 new tests. | report only |
| H3 | The first decision (C3: P−1, P2/m, Pmmm × 0.8, 10–100°) left those three with 53–58 members against 101–112, tying the Laue class to the member count; D2 (every cell × 0.8, 10–110°) was predicted cheaper (115 s against 138 s) and keeps 60–73 everywhere. The reason given against D2 did not separate the two. | right | D2 adopted (§5): every cell × 0.8, 10–110°. | phases' checks, the screening set, the in-model controls |
| H4 | `canonical()` placed the second axis nearest its family's first member, which is equidistant from several images when that member is the normal's own row: 5 of the 66 'on' frames read a frame 30–90° away when turned 0.01°. A relabelled box got another R and dims order. | real (minor) | The keys are the rows the axes lie on or nearest; slots ordered within each class (harness README). 0 of 66 jump now; 27 648 turned lattice frames and 440 relabelled bodies in the tests. One boundary remains: an axis exactly at the engine's 10° naming limit (a* of P2/m). | tests |
| H5 | The design README said 12 generic truths have no axis within 10° of a row. All have one; the snapped row has no lattice row normal to it. | real (wording) | README and `check-frames.mjs` give the cause. | — |
| H6 | 'near' turned a cylinder's or spheroid's frame about a random axis; a turn about an axis near its own barely moves it: 3 of 22 moved 1.27–1.53°, under the protocol's 2°. | real (minor) | `make-design.mjs`: for a solid of revolution the turn is about the random axis's part normal to its own axis; the 22 rows redrawn (axes turned 2.00–9.81°), the other 209 unchanged (`revision: 2`). | screening set (6 of the 22 are in it) |
| H7 | The correlations quoted (0.0031) are on the cube's coordinates; the 60 nm cap correlates the drawn factors (ρ(ln smallest, ln anisotropy) −0.125). The strength column is not Latin in two error-kind slices. | real (wording) | `design.md` and the README give the drawn factors' correlations and the empty bins. The design was not redrawn: the cap is the protocol's own constraint, and two slices of 19–20 miss one bin each. | — |
| H8 | The budget and the round-2 forecast assumed 3 processes; later stages get 2 per agent. | right | §4.2 and §8 give the process time and the wall time on 2 and 3 processes. | — |
| H9 | Only 2 of 3 in-model controls came back within 1 %; in-model, an axis can be weakly determined (cylinder-P-3-near: 6.0° off, flat within 2 χ² units). The axis error could not be put on the Lorentzian. | right | The claim narrowed (§6.3, §8); the in-model controls extended to the 11 cost truths. | 11 in-model runs |
| G1 | The hump's stated area was the whole pseudo-Voigt's; 86–99 % of it fell inside the range (5.8–37.9 % realised for 5–40 % stated). | real (minor) | The hump is scaled to its area within the range. | screening set |
| G2 | Each impurity line kept 98.5 % of its area (the engine's `addPeak` cuts at ±40 FWHM and lowers at the edge). | real (minor) | Drawn over the whole pattern and scaled to its area within the range. All 47 hump and impurity rows within 10⁻¹⁴ of their stated share. | screening set |
| G3 | The generator README said every line's tails are whole; the correction is lowered at its window's edge: a smooth offset of up to 3·10⁻⁴ of the peak against the exact lines, taken up by the background. | wording right; cause refined | README corrected. The offset is the FFT's period (folded tails, less the edge value), not the 40-FWHM window: drawing the correction over the whole pattern moved it by under 5·10⁻⁶ of the peak (`fix/pattern110.mjs`), so the window was kept. | — |

The data changed (cells, range, the 22 frames, the hump and the impurities), so the whole
screening set was run again, and the in-model controls with it. The first baseline is kept as
`results/screen-c3`, and scored again with the fixed harness without any run
(`fix/rescore.mjs`): there the two scoring fixes alone move the kept truths' worst extent from
+35 % to +46 % (median; 90th percentile +130 % to +274 %), the thinnest from +18 % to +23 %, and
the axis's 90th percentile from 32° to 86°. The median axis stays 7.7°.
