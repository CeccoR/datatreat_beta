# Free shape, round 2: the pilot

This is stage 1 of `../PROTOCOL.md`. The pilot integrates the parts built before it (the
phases, the generator, the harness, the design). It measures the cost of a run in every Laue
class and sets cells, range and step by that cost. It measures the bias of the model's
Lorentzian on exact line shapes, and runs today's search on the 77-run screening set:
round 2's reference. Two verifiers then checked it; §10 lists what they found and what was
done, and every number below is from after the fixes.

All data are synthetic. Only tuning rows were run; the validation rows were not touched.
The engine is a frozen copy of `b9bef5f`, instrumented only. The scripts and small inputs are
in `scripts/`, which has its own README.

## Contents

1. [Summary](#1-summary)
2. [What was built](#2-what-was-built)
3. [The checks](#3-the-checks)
4. [The cost of a run](#4-the-cost-of-a-run)
5. [Decisions: cells, range, step](#5-decisions-cells-range-step)
6. [The Lorentzian on exact lines](#6-the-lorentzian-on-exact-lines)
7. [Today's search on the screening set](#7-todays-search-on-the-screening-set)
8. [What it means for round 2](#8-what-it-means-for-round-2)
9. [Files](#9-files)
10. [The verification](#10-the-verification)

## 1. Summary

- **Cost as first drawn was 2.7× the budget.** The budget is the 77 screening runs in about
  1 h on 3 processes, so 140 s a run. On the first cells and 10–130°/0.01°, one clean truth per
  class took 375 s on average for the isotropic fit, today's search and its report. P−1 took
  1331 s and P2/m 889 s: their model lists are long, so an evaluation costs 85–142 ms against
  22–50 ms elsewhere.
- **Decided, after the verification:**
  - **cells:** every cell scaled by 0.8 in every length;
  - **range:** 10–110°;
  - **step:** 0.01°, unchanged.

  The pilot first scaled only P−1, P2/m and Pmmm, with 10–100° (C3). That left those three
  classes with half the others' members (53–58 against 101–112), and it cost more. Every class
  now has 60–73 members in range. On the screening set a run costs 115 s (mean, isotropic fit
  + search + report) against 134 s at C3; 133 s with the truth reference and the drawing. The
  runs' times sum to 147 min (171 min with the truth reference): about 49 min (57) on 3
  processes, 74 min (86) on 2. There were no failures.
- **The Lorentzian is biased on exact lines, and the bias goes with the symmetry.**
  - A single exact size line, fitted alone, is read 13–20 % long, whatever the solid and
    direction.
  - Fitted from the truth, the solids are pulled toward equant shapes. The thinnest extent
    reads +29 % (median over the 33 clean truths). Longest over thinnest, read and divided by
    the truth's, is 0.91–1.10 in −1, 2/m and mmm, 0.73–0.95 in the tetragonal and trigonal
    classes, 0.59–0.84 in the hexagonal ones, 0.69 in m−3 and 0.26 in m−3m.
  - Drawn with the engine's own lines, the same 11 cost truths come back with the extents
    within 7 % and the axis within 1.7° (medians; with exact lines 39 % and 11°). Not every run
    does: the cubic ellipsoid, a hexagonal elliptic cylinder and the cylinders' axes (5°) are
    weakly determined even in the model's own lines (§6.3).
- **Today's search on the screening set (round 2's reference):**
  - **Reach:** 58 of 63 judged truths are within Δ 1 of the truth reference. Three of the five
    misses are elliptic cylinders. At C3 it was 61 of 62.
  - **Kept:** 60 of 66 truths. The 6 rejected are four cubic truths and two square boxes in
    4/m and 6/m. The data do not support them even from the truth: the truth reference's ΔBIC
    is +4 to +27.
  - **Spheres:** 3 of 11 keep a shape: the two smallest (2.5 and 3.4 nm) as near-equant
    bodies, and one with preferred orientation.
  - **Accuracy of the kept solids:** worst extent +42 % (median; 90th percentile +290 %), thinnest
    +20 %, the most distinct axis 6.8° (90th percentile 79°). 3 kept truths read an extent as
    unbounded; they count as +∞.
  - **The lowest minimum is often not the one next to the truth.** In 26 of 60 kept truths
    today's minimum lies more than one χ²_ν below the truth reference's, 13 of them at another
    solid.
- **The verification** found twelve problems, all real, three of them wording only (§10). Two
  were major and in the scoring: unbounded extents dropped from the medians, and spheroids and
  square boxes paired by size. On the first baseline alone they move the worst extent from +35 %
  to +46 % (median).

## 2. What was built

In the work folder `fs2/pilot` (`scripts/pilot/`):

- **`run.mjs`: one command per row.**
  - The generator draws the design row in memory (`gen.mjs` drawRow). The lines are exact,
    or with `--kernel none` the engine's own.
  - The harness refines it (`lib.mjs` runCase): autoRefine from the CIF with the standard's
    profile, up to the shape search, where each method runs from the same isotropic fit.
  - It writes one JSON per run (`writeResult`: an unbounded extent is written "Infinity"):
    - evaluations and ms of the isotropic fit, of each method's search and of the report;
    - the refine log;
    - the reported and the free solid;
    - their errors against the truth: the generalised compare, modulo the class and modulo
      the holohedry;
    - ΔBIC and the outcome;
    - the model's list (reflections, members);
    - the generator's info and the error's realised draws.
- **`methods/today.mjs`: today's search and report, unchanged.**
  - The search is `freeShape`, as autoRefine calls it.
  - The report is the card's `bodyShapeOf` on the kept solid: linear esds and angular
    profiles (`turnEsds`), as the worker's summarise calls it.
  - The two are timed apart. The report's refinements are not logged with the search's.
- **The truth reference** is round 1's (`harness/methods/truth.mjs`): the solid refined from
  the truth, first with rounded faces, then exact free and exact held. It is the model's
  minimum next to the truth.
- **The rest:**
  - `batch.mjs`: at most 3 processes, nice 15, resumable; it refuses validation rows.
  - `report.mjs`: every table below. Medians and percentiles keep unbounded extents as +∞.
  - `inmodel.mjs`: the in-model controls against the same truths with exact lines.
  - `costgrid.mjs` and `decide.mjs`: the cost decision.
  - `narrow.mjs`: the narrowest line, for the step.
  - `lreading.mjs`: the Lorentzian's reading of one exact line.
  - `fix/`: the verification's checks and the first baseline rescored (§10).

## 3. The checks

The parts were checked when built (their READMEs):
- the generator: the ⟨L⟩_V identity, A(L) against Monte Carlo, the Lorentzian limit, the
  plumbing, the integral breadth, the errors;
- the harness's tests;
- the phases against the engine;
- the design's frames against the search's held route.

After the final decision (§5) and the verification's fixes (§10) every check was run again on
the final cells and grid. All pass:

| Check | Result on the final cells and grid |
|---|---|
| phases (`check.mjs`) | All 11 read to the intended group and class, with the class's order of operations; members = mult/2 for every reflection; no notes or warnings. Volumes 26.6–28.4 Å³; shortest distances 1.15–2.62 Å. Closest pair of distinct reflections in 10–130°: 0.0109° (P−1, at 94°), 0.021° (P2/m), 0.19° or more for the rest. Isotropic fit from the CIF (10 nm, ε 0.1 %): χ²_ν 0.971–1.030; cell within 7·10⁻⁵; D 9.89–10.14 nm. |
| generator (`checks.mjs`) | ⟨L⟩_V identity ≤ 4.6·10⁻¹²; Monte Carlo \|z\| ≤ 2.37; the Lorentzian limit on Pm−3m and P−1 ≤ 3.1·10⁻¹² of the peak (cylinders; 1.4·10⁻¹⁵ for the rest), the exact lines 13–19 % off it; plumbing 0.12–0.27 % of the peak (0.06–0.15 % with a Lorentzian instrument); breadths 1.000; each error at its spec; 0.15–0.25 s a pattern |
| generator, every row with an error (`fix/errors-check.mjs`) | 24 hump and 23 impurity rows at their stated share of the strongest line within the range, to 10⁻¹⁴; 23 air rows at their stated start, to 2·10⁻¹⁶ |
| generator against a direct synthesis (`fix/pattern110.mjs`, the verifier's code on 10–110°) | 6 rows: the exact-line correction (5–18 % of the peak) within 5.0·10⁻⁴ of the peak, 3.1·10⁻⁴ with the background's family taken out; the in-model limit on the frozen engine ≤ 1.5·10⁻¹⁶ |
| harness (`test.mjs`) | 44 062 checks, 0 failed (15 814 as before, plus 160 for the pairing by role, 27 648 turned lattice frames and 440 relabelled bodies for the canonical form) |
| design (`check-frames.mjs`) | 'on' 66 of 66 held exactly; 'near' 66 of 66 snap back to their frame, the 22 cylinders' and spheroids' axes turned 2.00–9.81° by their tilt; 12 of 65 'generic' have no held frame (no lattice row normal to the axis they snap); normRow reads all 231 rows |
| narrowest line (`narrow.mjs`) | 0.165° over all 231 rows on 10–110°: 16.5 points per FWHM at 0.01° |

A uniform scale leaves every lattice direction where it was in the Cartesian frame, so the
design's frames still hold on the scaled cells: the 209 rows the revision left alone have the
same R to 3·10⁻¹⁶.

## 4. The cost of a run

How measured: wall time of each stage in one Node process. Three processes ran at a time,
each at nice 15, on the 4-vCPU machine with nothing else running (a check of a few seconds
ran beside them twice). An evaluation is one call of `phasePattern`. "Report" is
`bodyShapeOf` on a kept solid; a rejected shape has none.

### 4.1 As first drawn (first cells, 10–130°/0.01°)

One clean truth per class, the solids varied:

| class | run | members in range (model's list) | reflections (list) | ms/eval, search | evals: iso / search / report | s: iso / search / report | iso + search + report, s |
|---|---|---|---|---|---|---|---|
| −1 | box-P-1-near | 187 (553) | 187 (553) | 141.6 | 2114 / 5074 / 1404 | 424 / 718 / 189 | 1331 |
| 2/m | sqbox-P2m-near | 182 (376) | 111 (219) | 84.6 | 498 / 8474 / 1326 | 49 / 717 / 122 | 889 |
| mmm | cylinder-Pmmm-near | 180 (253) | 70 (96) | 50.0 | 368 / 5724 / 951 | 16 / 286 / 44 | 346 |
| 4/m | spheroid-P4m-generic | 177 (259) | 54 (77) | 35.6 | 305 / 3337 / 1585 | 7 / 119 / 61 | 186 |
| 4/mmm | box-P4mmm-generic | 170 (260) | 41 (57) | 42.3 | 279 / 6575 / 997 | 6 / 278 / 45 | 329 |
| −3 | cylinder-P-3-near | 171 (249) | 61 (87) | 31.7 | 391 / 2814 / 1072 | 8 / 89 / 32 | 130 |
| −3m | ellipsoid-P-3m1-on | 180 (256) | 50 (68) | 33.5 | 259 / 4834 / 2417 | 5 / 162 / 69 | 236 |
| 6/m | ellcyl-P6m-generic | 184 (250) | 39 (52) | 26.0 | 354 / 6362 / 3282 | 5 / 166 / 78 | 249 |
| 6/mmm | ellcyl-P6mmm-on | 170 (246) | 32 (43) | 33.3 | 405 / 6561 / 1820 | 9 / 218 / 50 | 277 |
| m−3 | sqbox-Pm-3-on | 182 (242) | 25 (31) | 29.6 | 300 / 2931 / 718 | 3 / 87 / 18 | 108 |
| m−3m | ellipsoid-Pm-3m-near | 182 (242) | 20 (24) | 22.2 | 264 / 2153 / 0 (early) | 3 / 48 / 0 | 50 |

- The mean is 375 s a run (median 249). The truth reference adds 14–183 s.
- **An evaluation's cost follows the model's list, not the members in range.** Every class
  has 170–187 members in range. The list is longer where the cell's free parameters can
  stretch a d (`latticeStretch`: lengths ±10 %, angles ±15°): 553 reflections for P−1
  against 24–96 for the classes from mmm up. Each listed reflection costs its widths and
  axial nodes on every evaluation, drawn or not.
- **Low symmetry costs twice over:** dearer evaluations, and more of them. P−1's isotropic
  fit alone took 2114 evaluations, against 260–500 elsewhere.

### 4.2 At the decided cells and range (the screening set, 7 runs per class)

Every cell × 0.8, 10–110°/0.01° (§5):

| class | members in range (list) | reflections (list) | ms/eval, search | evals: iso / search / report | s: iso / search / report | iso + search + report, s | truth reference, s |
|---|---|---|---|---|---|---|---|
| −1 | 70 (214) | 70 (214) | 51.2 | 1388 / 4447 / 1063 | 99 / 226 / 54 | 379 | 53 |
| 2/m | 71 (144) | 46 (88) | 28.4 | 665 / 4299 / 1391 | 24 / 123 / 38 | 186 | 26 |
| mmm | 68 (94) | 30 (41) | 18.2 | 426 / 3628 / 1325 | 8 / 65 / 25 | 99 | 15 |
| 4/m | 67 (102) | 22 (33) | 15.3 | 396 / 5322 / 946 | 5 / 85 / 15 | 106 | 20 |
| 4/mmm | 68 (93) | 19 (25) | 15.7 | 437 / 4566 / 1317 | 6 / 72 / 19 | 97 | 16 |
| −3 | 61 (91) | 23 (33) | 13.0 | 393 / 4068 / 1786 | 4 / 56 / 23 | 83 | 9 |
| −3m | 67 (104) | 22 (31) | 12.6 | 373 / 3635 / 1866 | 4 / 45 / 21 | 70 | 12 |
| 6/m | 69 (93) | 17 (21) | 10.6 | 294 / 3434 / 1341 | 2 / 36 / 14 | 52 | 10 |
| 6/mmm | 60 (103) | 14 (20) | 14.6 | 378 / 4519 / 2055 | 3 / 66 / 29 | 98 | 14 |
| m−3 | 73 (89) | 12 (14) | 12.4 | 289 / 3253 / 1186 | 2 / 42 / 16 | 59 | 12 |
| m−3m | 73 (89) | 10 (12) | 11.4 | 256 / 2719 / 454 | 2 / 30 / 5 | 36 | 8 |

- The mean is 115 s a run (median 85), against 134 s at C3. The longest run is
  ellcyl-P-1-near at 599 s.
- With the truth reference and the drawing (0.3–0.8 s a pattern), the mean is 133 s.
- The search's evaluations cost 14.6 ms (median; 7–57).
- **Where the time goes:** 67 % in the search, 20 % in the report, 13 % in the isotropic fit.
  P−1 costs 3.3× the mean, through its evaluations: a 6-parameter cell, a model list of 214
  reflections, and an isotropic fit of about 1400 evaluations, a quarter of its time.
- **The whole set.** The runs' own times sum to 147 min for the isotropic fit, search and
  report, and 171 min with the truth reference and the drawing. On 3 processes that is about
  49 and 57 min, on 2 about 74 and 86 min. (The batch ran on 3 processes, nice 15, in 63 min of
  elapsed time; a session limit stopped it once at 40 runs, and it resumed, the 3 runs in
  flight run again from the start.)

## 5. Decisions: cells, range, step

**The rule.** The user asked that no hours be spent on an unlucky choice of phase, and that
cells, range and step be decided by cost after the pilot. The order set for the pilot: if a run
is over budget, these are applied in turn until it fits:
1. shrink the costliest cells, keeping each class;
2. narrow the range to 10–110°, then to 10–100°;
3. coarsen the step, only if the narrowest line keeps at least 5 points per FWHM.

**The profiles** (`costgrid.mjs`, `scripts/pilot/`) are ms per evaluation inside a brief
refinement. The pattern is drawn at the truth and refined for 3 iterations after an untimed
warm-up, with what the search frees: the scale, the background, X_s, the cell and the solid.
Then the same with the isotropic size. Six of the cost truths, one process each, 3 at a time,
on the first cells (×0.8: every length scaled). Each cell is shaped / isotropic ms, then the
members in range:

| run | 1, 10–130/0.01 | 1, 10–110/0.01 | 1, 10–100/0.01 | 1, 10–130/0.02 | 1, 10–110/0.02 | 0.8, 10–130/0.01 | 0.8, 10–110/0.01 | 0.8, 10–100/0.01 | 0.8, 10–130/0.02 | 0.8, 10–110/0.02 |
|---|---|---|---|---|---|---|---|---|---|---|
| box-P-1-near | 146 / 215 (187) | 108 / 150 (140) | 75 / 109 (112) | 116 / 176 (187) | 87 / 123 (140) | 57 / 83 (96) | 39 / 63 (70) | 39 / 57 (58) | 55 / 81 (96) | 38 / 58 (70) |
| sqbox-P2m-near | 113 / 121 (182) | 75 / 99 (142) | 64 / 87 (109) | 75 / 110 (182) | 59 / 79 (142) | 42 / 58 (91) | 29 / 36 (71) | 26 / 33 (56) | 34 / 53 (91) | 32 / 39 (71) |
| cylinder-Pmmm-near | 52 / 68 (180) | 47 / 46 (130) | 34 / 36 (108) | 42 / 65 (180) | 33 / 48 (130) | 34 / 33 (94) | 23 / 22 (68) | 18 / 17 (53) | 26 / 31 (94) | 19 / 21 (68) |
| box-P4mmm-generic | 31 / 25 (170) | 23 / 17 (131) | 17 / 18 (105) | 22 / 23 (170) | 16 / 17 (131) | 15 / 13 (89) | 10 / 7 (68) | 9 / 6 (52) | 12 / 6 (89) | 6 / 6 (68) |
| ellcyl-P6mmm-on | 31 / 22 (170) | 16 / 17 (124) | 15 / 8 (112) | 20 / 20 (170) | 17 / 15 (124) | 14 / 6 (91) | 8 / 6 (60) | 7 / 6 (54) | 7 / 5 (91) | 6 / 4 (60) |
| sqbox-Pm-3-on | 26 / 6 (182) | 21 / 10 (125) | 14 / 5 (101) | 14 / 6 (182) | 13 / 5 (125) | 14 / 4 (89) | 11 / 4 (73) | 9 / 4 (46) | 9 / 3 (89) | 6 / 2 (73) |

**The prediction** (`decide.mjs`). Each class's measured run (§4.1) is scaled by its ratios:
the isotropic fit by the isotropic ratio, the search and report by the shaped one. A class not
profiled takes the median ratio of m−3, 4/mmm and 6/mmm. The evaluations are taken as
unchanged.

| configuration | predicted mean, s | members in range |
|---|---|---|
| C0 as first drawn | 375 | 170–187 |
| C1 the costliest cells × 0.8 (P−1, P2/m, Pmmm: 85–142 ms an evaluation against 22–42 elsewhere) | 241 | 91–96 and 170–187 |
| C2 C1 and 10–110° | 170 | 68–71 and 124–143 |
| C3 C1 and 10–100° | 138 | 53–58 and 101–112 |
| C4 C1, 10–110° and 0.02° (step coarsened before the range is exhausted, for comparison) | 141 | 68–71 and 124–143 |
| D1 every cell × 0.8 | 168 | 86–96 |
| **D2 every cell × 0.8 and 10–110°** | **115** | **60–73** |

**The first choice was C3**, taken as the first configuration in the order within the budget,
and D2 was set aside because it "would halve every class's members". It was verified at 116 s on
the 11 cost truths and 134 s on the screening set. **The verification showed it was the wrong
choice** (§10, H3):
- C3 left −1, 2/m and mmm with 53–58 members in range against 101–112 for the other eight. The
  phases were built with equal members (170–187 in 10–130°), so that the Laue class is not read
  through the member count; C3 undid that.
- The reason given against D2 did not separate the two: C3 cut those three classes harder than
  D2 does, and D2 was predicted cheaper.

**The choice is D2: every cell × 0.8, 10–110°.** It is the first configuration within the budget
when step 1 shrinks every cell, and the only one in the table that keeps the members equal
across classes. Measured, it is cheaper than C3:
- on the same 11 cost truths, 103.5 s a run (iso + search + report, mean) against 115.5 s at
  C3, 10 % less; −1 323 s against 291, 2/m 234 against 205, mmm 92 against 92, the other
  eight 15–43 % cheaper. The prediction (115 against 138 s) missed −1 and 2/m, whose
  evaluations got dearer with 10–110° (49 against 43 ms, 32.5 against 26.3);
- on the screening set, 115 s against 134 s (§4.2), and 133 s against 157 s with the truth
  reference and the drawing.

Members in 10–110°: P−1 70, P2/m 71, Pmmm 68, P4/m 67, P4/mmm 68, −3 61, −3m 67, 6/m 69, 6/mmm
60, m−3 73, m−3m 73. The cubic classes have 10–12 reflections in range.

**The step stays at 0.01°.** No coarsening was needed.
- `narrow.mjs` finds every design row's narrowest line, a lower bound on its FWHM: the
  member's exact size line (its A(L), the row's size distribution) convolved with the
  instrument's pseudo-Voigt and the row's strain, the axial wings and Kα2 left out.
- Over all 231 rows on 10–110° and the final cells, the narrowest is 0.165°: box-Pm-3-on,
  ⟨L⟩_V 60 nm, (111) at 52.8°. That is 16.5 points per FWHM at 0.01°.
- At 0.02° it would still be 8.3, so the step remains in reserve.
- Only the truths' geometry was read, no result.

**What changed in the data:**
- **Cells.** Every length × 0.8; angles and atoms' fractional coordinates kept. P−1 2.84, 3.096,
  3.352 Å (96, 104, 90°); P2/m 3.056, 2.624, 3.496 Å (β 100°); Pmmm 2.688, 2.872, 3.456 Å; P4/m
  2.8, 3.456; P4/mmm 3.128, 2.728; P−3 2.768, 4.08; P−3m1 2.624, 4.512; P6/m 3.28, 2.912; P6/mmm
  2.872, 3.752; Pm−3 3.0; Pm−3m 2.984 Å. Volumes 26.6–28.4 Å³. The first cells are kept in
  `scripts/phases/cif-v1/`, C3's in `cif-c3/`.
- **Range.** 10–110°, 10 001 points: the generator's `GRID`, every caller's default.
- **Design revision 2** (§10, H6): the 22 near cylinders and spheroids turned by their full tilt.
- **Errors** (§10, G1, G2): the hump's and the impurity lines' areas are their stated share
  within the range.
- The background shape, the instrument, the noise and the error draws are unchanged. Hump
  centres and impurity positions are drawn over the new range, as their rules say.

## 6. The Lorentzian on exact lines

The model draws every member's size line as a Lorentzian of FWHM 0.675/⟨L⟩_V in d* (the
engine's convention: Scherrer's K = 0.9 and ⟨L⟩_V = ¾D). The data carry the solid's exact
line, the transform of its A(L) along the member. The two have the same area. Their shapes
differ, and so do their integral breadths: 1/⟨L⟩_V for the exact line (the generator's breadth
check), π/2 · 0.675/⟨L⟩_V = 1.06/⟨L⟩_V for the Lorentzian.

### 6.1 One line alone (`lreading.mjs`)

- **The fit.** The Lorentzian of the same area that best fits one exact size line. It is
  weighted least squares over |s| ≤ 6/⟨L⟩_V, Poisson-like weights over a flat background at a
  fifth of the peak, with no instrument and no strain.
- **The reading.** ⟨L⟩_V read over the true one is 1.13–1.20 with the area fixed, 1.11–1.16
  with the area free:
  - box along an edge 1.20, a face diagonal 1.15, a body diagonal 1.13;
  - a ball (sphere, ellipsoid, spheroid) 1.16 in every direction;
  - a cylinder along its axis 1.20, across it 1.18, at 45° 1.14.
- **The meaning.** Alone, the Lorentzian reads every extent 13–20 % long, nearly the same for
  every solid and direction. Matching the integral breadth alone would read 1.06; the rest is
  the shape. This uniform part would scale a solid without changing its shape.

### 6.2 Fitted from the truth (the truth reference, screening set)

The truth reference is the model's minimum next to the truth: no search in it. Errors are
signed, the truth's thinnest, middle and longest extent. The median is given with the 10th–90th
percentiles; "axis" is the truth's most distinct axis (median, 90th percentile). An extent read
as unbounded counts as +∞ (4 truth references, all in −1 and 2/m).

**By solid** (66 truths, errors included):

| solid | thinnest | middle | longest | axis ° | χ²_ν |
|---|---|---|---|---|---|
| box | +18 % (+12…+77) | −0 % (−38…+32) | +1 % (−54…+23) | 4.4 (22.6) | 1.55 |
| square box | +12 % (−5…+46) | +12 % (−5…+30) | +4 % (−48…+17) | 10.6 (29.0) | 1.52 |
| cylinder | +24 % (+2…+30) | +15 % (−5…+28) | +13 % (−26…+89) | 6.1 (27.7) | 1.18 |
| elliptic cylinder | +20 % (+4…+68) | +4 % (−23…+93) | −15 % (−37…+19) | 10.0 (14.5) | 1.23 |
| ellipsoid | +10 % (+2…+75) | +5 % (−26…+15) | +2 % (−40…+17) | 1.5 (15.6) | 1.13 |
| spheroid | +25 % (+8…+57) | +5 % (−35…+21) | +3 % (−42…+∞) | 5.0 (43.4) | 1.90 |

**By Laue class** (the 33 clean truths). The anisotropy column is longest/thinnest as read,
over the truth's (median, 10th–90th percentiles):

| class | runs | thinnest | longest | anisotropy read ÷ true | axis ° |
|---|---|---|---|---|---|
| −1 | 3 | +15 % | +19 % | 1.10 (1.05…∞) | 3.7 |
| 2/m | 3 | +6 % | +10 % | 1.01 (0.98…1.03) | 11.4 |
| mmm | 3 | +10 % | −3 % | 0.91 (0.84…0.91) | 1.8 |
| 4/m | 3 | +43 % | +5 % | 0.73 (0.68…0.73) | 18.8 |
| 4/mmm | 3 | +19 % | +12 % | 0.95 (0.53…1.01) | 0.0 |
| −3 | 2 | +21 % | +3 % | 0.86 (0.81…0.91) | 22.8 |
| −3m | 3 | +47 % | −17 % | 0.75 (0.50…0.76) | 4.0 |
| 6/m | 5 | +68 % | +2 % | 0.59 (0.28…0.90) | 13.6 |
| 6/mmm | 1 | +20 % | +0 % | 0.84 | 0.0 |
| m−3 | 3 | +37 % | −6 % | 0.69 (0.66…0.71) | 2.5 |
| m−3m | 4 | +101 % | −51 % | 0.26 (0.16…0.35) | 5.3 |

**By the model error** (all solids): none (33) thinnest +29 %, longest +2 %, χ²_ν 1.28; hump
(7) +30 %, −5 %, 2.42; size distribution (7) +12 %, +17 %, 1.47; impurity (7) +10 %, −28 %,
2.59; air (6) +13 %, −3 %, 1.31; preferred orientation (6) +9 %, +52 % (two of six unbounded),
axis 8.2° (90th percentile 46.7°), 1.52.

**What this says:**
- **On top of the uniform +13–20 %, the solid is pulled toward equant, and how far follows the
  class.** In −1, 2/m and mmm the anisotropy is read about as it is (0.91–1.10). The cubic
  classes lose most of it: m−3m reads a quarter of it, and its ellipsoid, spheroid, square box
  and box refine from the truth to a sphere or a near-cube (ellipsoid-Pm-3m-near 14×37×60 nm →
  27.3×27.2×27.2 nm; sqbox-Pm-3m-near 17.6×17.6×6.8 → 14.2 nm in all three).
- **This fits where the shape shows** (a reading, not a test). A class's symmetry averages
  part of a deformation of the sphere out of the reflections' breadths, the more of it the
  higher the class: in cubic all of it, to first order (`freeShape`'s own comment). There a
  family's members differ in width, but the family's line is their sum at one 2θ, so only its
  shape carries the anisotropy. The exact lines' shapes differ from the Lorentzian's by 13–19 %
  of the peak (the generator's limit check), so the anisotropy has little left to be read
  from.
- **χ²_ν at the truth reference** is 1.40 (median; 90th percentile 5.3, at most 36). The
  misfit is the line shape. It grows with counts: the isotropic fit's χ²_ν runs from 1.02 to
  61 over the 66 truths.
- The same picture held on the first cells (§4.1's 11 truths) and at C3 (§10).

### 6.3 In-model controls (the engine's own lines)

The 11 cost truths, all clean, one per class, were drawn again with `--kernel none`: the
engine's own Lorentzian lines, the rest the same (`inmodel.mjs`; `tables/pilot-inmodel.md`
has every run):

| lines | runs | today kept | today's worst extent | today's thinnest | today's axis ° | χ²_ν | truth reference: worst extent | axis ° |
|---|---|---|---|---|---|---|---|---|
| exact | 11 | 10 | +39 % | +34 % | 11.3 | 1.15 | +46 % | 3.2 |
| the engine's | 11 | 10 | +7 % | +0 % | 1.7 | 1.00 | +6 % | 4.0 |

(medians over the kept runs; χ²_ν at today's minimum.)

Run by run, with the engine's lines:
- **Four come back within 3 % and 1.5°:** box-P4mmm-generic, ellcyl-P6mmm-on, sqbox-P2m-near,
  sqbox-Pm-3-on. box-P-1-near comes within 8 % and 1.9°, spheroid-P4m-generic within 11 % and
  6.6°.
- **The cylinders' axes are weakly determined:** cylinder-P-3-near and cylinder-Pmmm-near
  read the axis 5.0° and 4.7° off (both 'near' truths, both free), and the latter its height
  +25 %. The verifier saw the same on cylinder-P-3-near: χ² flat within 2 units between the
  free minimum and the truth's axis.
- **ellipsoid-P-3m1-on** reads its middle and longest extents +19 % and −20 %, with χ²_ν 0.98:
  the two are traded against each other.
- **Two are not determined at all:** ellipsoid-Pm-3m-near is rejected (ΔBIC −2) and its truth
  reference runs its longest extent away (+8442 %); ellcyl-P6m-generic is kept at another solid
  (+416 %, 26°), and its truth reference reads the longest +170 %.

**What it means.** The line shape accounts for most of the bias at the median: the thinnest
extent goes from +34 % to 0 %, the worst from +39 % to +7 %, the axis from 11° to 2°. It does
not account for all of it run by run. The cubic and hexagonal elliptic cases, and the
cylinders' axes, are weakly determined in the model's own lines, at these counts and with
60–73 members. The first write-up's "the same truths come back within 1 %" held for 2 of its
3 controls; it is withdrawn (§10, H9).

### 6.4 Today's minimum against the truth reference's

The truth reference stops at the minimum next to the truth. With exact lines that is often
not the model's lowest (60 kept truths; `report.mjs` minima):
- In 26, today's best χ² lies more than one χ²_ν below the truth reference's; in 13 of these
  the solid differs beyond 8° or 28 % (`sameSolid`).
- In 29 it is within one χ²_ν; in 3 of these the solid differs: equivalent minima.
- In 5 it is more than one χ²_ν above: the misses of §7.

So with exact lines, accuracy is lost in three ways:
- the minimum next to the truth is biased (§6.2);
- the lowest minimum is often another solid, which a perfect search would report;
- the search does not always reach the lowest.

Today's accuracy (§7) includes all three.

## 7. Today's search on the screening set

The screening set is 77 runs: 66 tuning truths, one per solid × class, and 11 spheres. It ran
at the decided cells and range, with 3 processes, nice 15, resumable, and no failures. Reach
is Δ = (today's best exact χ² − the lower of today's and the truth reference's)/max(1,
χ²_ν). It is judged on truths, but not on early rejections, whose only ends are brief
refinements (round 1's rule). Accuracy is the reported solid against the truth, modulo the
class's rotations and the body's symmetry. The extents are paired within the body's axis
classes: by size within a class, by role across them (a spheroid's, cylinder's or square box's
axis with the other's axis; §10, H2). "Axis" is the truth's most distinct axis. An extent read
as unbounded counts as +∞, the largest error.

**Overall:**

| set | runs | held | free | rejected (early) | reached / judged | unbounded | worst extent, median (90 %) | thinnest, median | axis °, median (90 %) | evals: search | s: search / report / iso |
|---|---|---|---|---|---|---|---|---|---|---|---|
| truths | 66 | 32 | 28 | 6 (3) | 58 / 63 | 3 | +42 % (+290 %) | +20 % | 6.8 (79.0) | 4122 | 79 / 26 / 16 |
| spheres | 11 | 0 | 3 | 8 (4) | — | — | — | — | — | 3200 | 64 / 8 / 8 |

- **Five runs miss** (Δ > 1), seven are over Δ 0.1:
  - ellcyl-P6mmm-on (clean), Δ 62.9: held at a 28 × 28 × 4.5 nm plate, the truth 4.3 × 11.7 ×
    34.2;
  - ellcyl-P4m-near (size distribution 0.26), Δ 35.8;
  - box-Pmmm-on (preferred orientation 0.06), Δ 19.1;
  - ellcyl-Pm-3-near (clean), Δ 2.6;
  - sqbox-P2m-near (clean), Δ 1.9.

  At C3 one run missed, at Δ 1.65 (cylinder-Pm-3m-on, which reaches now). Three of the five
  are elliptic cylinders: their height is the extent the search most often puts elsewhere
  (below).
- **No rejection is a miss.** All 6 rejected truths have a truth-reference ΔBIC of +4 to +27:
  even from the truth the data do not support the shape against the isotropic size. They are
  ellipsoid-Pm-3m-near, spheroid-Pm-3-generic and spheroid-Pm-3m-on (early), and
  sqbox-Pm-3m-near, sqbox-P4m-on (9.1×9.1×9.0 nm) and sqbox-P6m-near (late).
- **Spheres (the nulls):** 3 of 11 keep a shape.
  - sphere-P-3-1, 2.5 nm, searched as a box: 2.1 × 1.9 × 2.0 nm, ΔBIC −88;
  - sphere-Pmmm-1, 3.4 nm, cylinder: 2.8 × 2.8 × 2.7, ΔBIC −341;
  - sphere-P6mmm-1, 9.9 nm, preferred orientation at strength 0.59, box: 7.8 × 7.6 × 15.1,
    ΔBIC −442.

  The first two are the two smallest spheres of the set (isotropic χ²_ν 4.9 and 2.9). Each is
  kept as a near-equant body, which takes up part of the sphere's line-shape error. The third
  is texture read as shape. The 8 rejected spheres include every error kind but texture.
  sphere-P-3m1-2 (3.7 nm), kept at C3, is rejected now (ΔBIC +9).

**By solid** (truths):

| solid | held / free / rejected | reached / judged | worst extent (90 %) | thinnest | axis ° (90 %) |
|---|---|---|---|---|---|
| box | 5 / 6 / 0 | 10 / 11 | +54 % (+101 %) | +17 % | 6.3 (19.7) |
| square box | 3 / 5 / 3 | 10 / 11 | +43 % (+110 %) | +22 % | 9.6 (75.1) |
| cylinder | 6 / 5 / 0 | 11 / 11 | +30 % (+100 %) | +24 % | 13.6 (85.6) |
| elliptic cylinder | 6 / 5 / 0 | 8 / 11 | +191 % (+551 %) | +191 % | 18.3 (85.9) |
| ellipsoid | 7 / 3 / 1 | 10 / 10 | +24 % (+77 %) | +9 % | 4.2 (20.5) |
| spheroid | 5 / 4 / 2 | 9 / 9 | +47 % (+446 %) | +21 % | 6.9 (88.8) |

- **The 90th percentiles near 80–90°** are fits with their distinct axis across the truth's: a
  cylinder or spheroid read with its aspect flipped (a needle for a plate), a square box with
  its height on an edge. The pairing by role reports these as they are; size pairing had hidden
  the spheroid's (§10, H2).
- **The elliptic cylinder's errors are mostly another assignment of its height.** In 8 of 11
  the reported height pairs by size with another of the truth's extents, at the truth
  reference's χ² or a lower one: round 1's elliptic-cylinder confusion. Paired whatever their
  role (`accLoose`), the extents' worst error is +66 % (median) against +191 % by role.

**By class** (kept truths; worst extent, thinnest, axis):
- −1: +164 %, +15 %, 4.1° (2 of 6 kept read an extent as unbounded);
- 2/m: +19 %, +9 %, 5.2°;
- mmm: +15 %, +9 %, 4.7°;
- 4/m: +31 %, +31 %, 5.5° (1 of 6 truths rejected);
- 4/mmm: +15 %, +14 %, 2.7°;
- −3: +44 %, +30 %, 17.2° (12.1° modulo the holohedry);
- −3m: +81 %, +29 %, 25.8°;
- 6/m: +76 %, +76 %, 16.5° (1 of 6 rejected);
- 6/mmm: +143 %, +79 %, 82.0°;
- m−3: +46 %, +12 %, 4.2° (1 of 6 rejected, early);
- m−3m: +73 %, +73 %, 8.4° (3 of 6 rejected).

The low classes are read best, as §6.2 predicts. 6/mmm is the worst for the axis: 4 of its 6
kept truths have the distinct axis 78–90° off (at C3, rescored, 3 of 6: 52.5° median). −3 is
the one merohedral class whose axis error drops modulo the holohedry (17.2° to 12.1°).

**By orientation** (truths):
- on: 12 held, axis 4.0° (90th percentile 75°), worst extent +35 %;
- near: 15 held, 6.8° (86°), +32 %;
- generic: 5 held, 16.5° (44°), +58 %.

The held route snaps the 'on' truths exactly. A truth 2–10° off its frame reads about as far
off as its frame lies from it (the design's near frames: 6.2° median).

**By model error** (truths; worst extent, axis):
- none (33): +32 %, 7.6°;
- hump (7): +71 %, 10.5°;
- size distribution (7): +39 %, 3.9°;
- impurity (7): +50 %, 7.4°;
- air (6): +19 %, 6.1°;
- preferred orientation (6): +136 %, 53.5°.

Texture costs the most, then the hump.

**Against the first baseline (C3), row by row** (`fix/compare-c3.mjs`): the same outcome in
67 of 77 runs. Six went from held to free, two from free to held, one early rejection is held
now (cylinder-Pm-3-generic), and one sphere is rejected now. The medians move little: worst
extent +46 % → +42 %, thinnest +23 % → +20 %, axis 7.7° → 6.8° (C3 rescored with the fixed
harness). Reach drops from 61/62 to 58/63. The five misses are in five classes, two of which
gained members with the change (mmm, 2/m), so on this evidence the drop is not tied to the
member count; three of the five are elliptic cylinders.

**Evaluations and time:**
- search: 4122 evaluations and 79 s on the truths, 3200 and 64 s on the spheres;
- report: 1637 evaluations and 29 s on a kept solid;
- the whole set: 147 min of the runs' own time without the truth reference, 171 min with it
  (§4.2).

The per-run tables are in `tables/pilot-screen.md`.

## 8. What it means for round 2

- **The cost is now set.** A run costs 115 s (isotropic fit + search + report), 133 s with the
  truth reference and the drawing. In the runs' own time a screening is 147 min, 171 min with
  the truth reference:
  - on 3 processes, about 49 min (57 with the truth reference): within the hour the pilot was
    given;
  - on 2 processes, as later stages run per agent, about 74 min (86): over the hour;
  - a confirmation on the 154 tuning runs is about 295 min of run time: 2.5 h on 2 processes,
    1.6 h on 3; the validation, once, as a screening.
  - P−1 is 3.3× the mean (379 s); its isotropic fit is a quarter of that.

  The first write-up quoted 1 h a screening and 2 h a confirmation on 3 processes only (§10,
  H8).
- **The line shape sets most of today's extent error, not all of it, and not the axes alone.**
  - The truth reference reads the thinnest extent +29 % on the clean truths; with the engine's
    own lines the same truths come back at 0 % (median), the worst extent at +7 % against
    +39 %.
  - In the model's own lines the cubic ellipsoid and a hexagonal elliptic cylinder are not
    determined, and the cylinders' axes are flat to about 5° (§6.3). The axis error of today's
    solids (6.8°, median) mixes the line shape, the held route's frames (a 'near' truth reads
    about as far off as its frame) and this weak determination.
  - Accuracy figures in later screenings will measure the model's line shape as much as the
    search. The search's own figures are reach, completeness and evaluations.
- **Reach needs a better reference than the truth's minimum.** In 26 of 60 kept truths
  today's minimum lies below it. The best known per run must be the lowest over every method
  run on it, as the protocol says (Δ ≤ 1 against the best known), with the dense reference
  search for completeness. Against the truth reference today misses 5 of 63; three are
  elliptic cylinders, whose height the search puts on another extent in 8 of 11 kept runs.
- **The keep criterion meets false shapes on exact lines.** 3 of 11 spheres keep one (ΔBIC
  −88 to −442): two small spheres (2.5, 3.4 nm) and one with texture. The isotropic model's
  own misfit (χ²_ν up to 4.9 on a 2.5 nm sphere) is taken for evidence even with χ² divided by
  its χ²_ν. This is the protocol's keep-criterion question, now with numbers.
- **Cubic is the weak class, and 6/mmm reads axes across.** 3 of 6 m−3m truths are rejected;
  m−3m reads a quarter of the true anisotropy from the truth, and in the model's own lines the
  cubic ellipsoid is not determined. In 6/mmm 4 of 6 kept truths have their distinct axis
  78–90° off. A better search will not help with the first. A line shape nearer the exact one
  might: the protocol's "why the solids are confused".
- **Merohedral classes.** −3's axis error drops from 17.2° to 12.1° modulo the holohedry. The
  other four show no twin-like error at median.
- **Scoring.** Unbounded extents are +∞ in every median and percentile, and solids with a
  symmetry axis are compared axis to axis (§10). Any later method is scored by the same
  `report.mjs`.

## 9. Files

- `scripts/`: the scripts and small inputs: phases, generator, harness, design, pilot. Its
  README sets up a work folder from this repository.
- `scripts/pilot/README.md`: the pilot's commands and results layout; `scripts/pilot/fix/`: the
  verification's checks (`errors-check.mjs`, `pattern110.mjs`), the first baseline rescored
  (`rescore.mjs`), the row-by-row and cost comparisons with it (`compare-c3.mjs`,
  `cost-compare.mjs`).
- `tables/pilot-cost.md`: §4.1's runs on the first cells, with the bias and search tables
  (scored with the fixed harness).
- `tables/pilot-screen.md`: every table of §4.2, §6.2, §6.4 and §7, and the per-run tables.
- `tables/pilot-inmodel.md`: §6.3, run by run.
- `tables/pilot-screen-c3.md`: the first baseline (C3), scored with the fixed harness (§10).
- The run records (one JSON per run) and the profiles are in the work folder,
  `fs2/pilot/results/`, not in the repository.

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
| H3 | The first decision (C3: P−1, P2/m, Pmmm × 0.8, 10–100°) left those three with 53–58 members against 101–112, tying the Laue class to the member count; D2 (every cell × 0.8, 10–110°) was predicted cheaper (115 s against 138 s) and keeps 60–73 everywhere. The reason given against D2 did not separate the two. | right | D2 adopted (§5): every cell × 0.8, 10–110°. Measured: 103.5 s against 115.5 s on the 11 cost truths, 115 s against 134 s on the screening set; every class 60–73 members. | phases' checks, the screening set, the in-model controls |
| H4 | `canonical()` placed the second axis nearest its family's first member, which is equidistant from several images when that member is the normal's own row: 5 of the 66 'on' frames read a frame 30–90° away when turned 0.01°. A relabelled box got another R and dims order. | real (minor) | The keys are the rows the axes lie on or nearest; slots ordered within each class (harness README). 0 of 66 jump now; 27 648 turned lattice frames and 440 relabelled bodies in the tests. One boundary remains: an axis exactly at the engine's 10° naming limit (a* of P2/m). | tests |
| H5 | The design README said 12 generic truths have no axis within 10° of a row. All have one; the snapped row has no lattice row normal to it. | real (wording) | README and `check-frames.mjs` give the cause. | — |
| H6 | 'near' turned a cylinder's or spheroid's frame about a random axis; a turn about an axis near its own barely moves it: 3 of 22 moved 1.27–1.53°, under the protocol's 2°. | real (minor) | `make-design.mjs`: for a solid of revolution the turn is about the random axis's part normal to its own axis; the 22 rows redrawn (axes turned 2.00–9.81°), the other 209 unchanged (`revision: 2`). | screening set (6 of the 22 are in it) |
| H7 | The correlations quoted (0.0031) are on the cube's coordinates; the 60 nm cap correlates the drawn factors (ρ(ln smallest, ln anisotropy) −0.125). The strength column is not Latin in two error-kind slices. | real (wording) | `design.md` and the README give the drawn factors' correlations and the empty bins. The design was not redrawn: the cap is the protocol's own constraint, and two slices of 19–20 miss one bin each. | — |
| H8 | The budget and the round-2 forecast assumed 3 processes; later stages get 2 per agent. | right | §4.2 and §8 give the process time and the wall time on 2 and 3 processes. | — |
| H9 | Only 2 of 3 in-model controls came back within 1 %; in-model, an axis can be weakly determined (cylinder-P-3-near: 6.0° off, flat within 2 χ² units). The axis error could not be put on the Lorentzian. | right | The in-model controls extended to the 11 cost truths: the extents come back to 7 % and the axis to 1.7° at median, but four are weakly or not determined (§6.3). The claim narrowed accordingly (§1, §8). | 11 in-model runs |
| G1 | The hump's stated area was the whole pseudo-Voigt's; 86–99 % of it fell inside the range (5.8–37.9 % realised for 5–40 % stated). | real (minor) | The hump is scaled to its area within the range. | screening set |
| G2 | Each impurity line kept 98.5 % of its area (the engine's `addPeak` cuts at ±40 FWHM and lowers at the edge). | real (minor) | Drawn over the whole pattern and scaled to its area within the range. All 47 hump and impurity rows within 10⁻¹⁴ of their stated share. | screening set |
| G3 | The generator README said every line's tails are whole; the correction is lowered at its window's edge: a smooth offset of up to 3·10⁻⁴ of the peak against the exact lines, taken up by the background. | wording right; cause refined | README corrected. The offset is the FFT's period (folded tails, less the edge value), not the 40-FWHM window: drawing the correction over the whole pattern moved it by under 5·10⁻⁶ of the peak (`fix/pattern110.mjs`), so the window was kept. | — |

The data changed (cells, range, the 22 frames, the hump and the impurities), so the whole
screening set was run again, and the in-model controls with it. The first baseline is kept as
`results/screen-c3`, and scored again with the fixed harness without any run
(`fix/rescore.mjs`): there the two scoring fixes alone move the kept truths' worst extent from
+35 % to +46 % (median; 90th percentile +130 % to +274 %), the thinnest from +18 % to +23 %, and
the axis's 90th percentile from 32° to 86°. The median axis stays 7.7°.
