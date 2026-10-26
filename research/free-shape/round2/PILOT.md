# Free shape, round 2: the pilot

This is stage 1 of `../PROTOCOL.md`. The pilot integrates the parts built before it (the
phases, the generator, the harness, the design). It measures the cost of a run in every Laue
class and sets cells, range and step by that cost. It measures the bias of the model's
Lorentzian on exact line shapes, and runs today's search on the 77-run screening set:
round 2's reference.

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

## 1. Summary

- **Cost as first drawn was 2.7× the budget.** The budget is the 77 screening runs in about
  1 h on 3 processes, so 140 s a run. On the first cells and 10–130°/0.01°, one clean truth per
  class took 375 s on average for the isotropic fit, today's search and its report. P−1 took
  1331 s and P2/m 889 s: their model lists are long, so an evaluation costs 85–142 ms against
  22–50 ms elsewhere.
- **Decided, in the protocol's order:**
  - **cells:** P−1, P2/m and Pmmm scaled by 0.8 in every length;
  - **range:** 10–100°;
  - **step:** 0.01°, unchanged.

  The checks that depend on the cells were run again and pass. On the screening set a run now
  costs 134 s (mean, isotropic fit + search + report). The 77 runs took 67 min on 3
  processes with the truth reference; without it they would take about 57 min (the runs'
  times summed, over 3). There were no failures.
- **The Lorentzian is biased on exact lines, and the bias goes with the symmetry.**
  - A single exact size line, fitted alone, is read 13–20 % long, whatever the solid and
    direction.
  - Fitted from the truth, the solids are pulled toward equant shapes. The thinnest extent
    reads +28 % (median over the 33 clean truths). Longest over thinnest, read and divided by
    the truth's, is 0.94–1.05 in −1, 2/m and mmm, 0.70–0.93 in the tetragonal and trigonal
    classes, 0.48–0.86 in the hexagonal ones, 0.72 in m−3 and 0.26 in m−3m.
  - This fits where the shape shows. Where a class averages the anisotropy out of the line
    breadths, only the line shapes carry it, and the line shapes are what the Lorentzian gets
    wrong.
  - Drawn with the engine's own lines instead, the same truths come back within 1 % (box,
    elliptic cylinder). The cubic ellipsoid is weakly determined even then.
- **Today's search on the screening set (round 2's reference):**
  - **Reach:** 61 of 62 judged truths are within Δ 1 of the truth reference. The miss is at
    Δ 1.65.
  - **Kept:** 59 of 66 truths. The 7 rejected are five cubic truths and two near-equant
    square boxes (4/m, 6/m). The data do not support them even from the truth: the truth
    reference's ΔBIC is +9 to +28.
  - **Spheres:** 4 of 11 keep a shape. Three are small spheres (2.5–3.7 nm) read as
    near-equant bodies, the fourth a sphere with preferred orientation.
  - **Accuracy of the kept solids:** worst extent +35 % (median; 90th percentile +130 %),
    thinnest +18 %, the most distinct axis 7.7° (90th percentile 32°).
  - **The lowest minimum is not the one next to the truth.** In 32 of 59 kept truths today's
    minimum lies more than one χ²_ν below the truth reference's, 19 of them at another solid.

## 2. What was built

In the work folder `fs2/pilot` (`scripts/pilot/`):

- **`run.mjs`: one command per row.**
  - The generator draws the design row in memory (`gen.mjs` drawRow). The lines are exact,
    or with `--kernel none` the engine's own.
  - The harness refines it (`lib.mjs` runCase): autoRefine from the CIF with the standard's
    profile, up to the shape search, where each method runs from the same isotropic fit.
  - It writes one JSON per run:
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
  - `report.mjs`: every table below.
  - `costgrid.mjs` and `decide.mjs`: the cost decision.
  - `narrow.mjs`: the narrowest line, for the step.
  - `lreading.mjs`: the Lorentzian's reading of one exact line.

## 3. The checks

The parts were checked when built (their READMEs):
- the generator: the ⟨L⟩_V identity, A(L) against Monte Carlo, the Lorentzian limit, the
  plumbing, the integral breadth, the errors;
- the harness: 15 814 tests;
- the phases against the engine;
- the design's frames against the search's held route.

After the cell change (§5) every check that reads the cells was run again on the new ones.
All pass:

| Check | Result on the new cells |
|---|---|
| phases (`check.mjs`) | All 11 read to the intended group and class, with the class's order of operations; members = mult/2 for every reflection; no notes or warnings. New volumes: P−1 28.4, P2/m 27.6, Pmmm 26.7 Å³. Shortest distances 1.53, 1.51, 2.62 Å. Closest pair of distinct reflections 0.011°, 0.021°, 0.233° (none under 0.01°). Isotropic fit from the CIF (10 nm, ε 0.1 %): χ²_ν 0.971, 1.014, 0.984; cell within 2·10⁻⁵; D 10.01, 10.06, 9.94 nm. |
| generator (`checks.mjs`) | ⟨L⟩_V identity ≤ 4.6·10⁻¹²; Monte Carlo \|z\| ≤ 2.37; the Lorentzian limit on Pm−3m and the new P−1 ≤ 3.1·10⁻¹² of the peak (cylinders; 1.2·10⁻¹⁵ for the rest), the exact lines 13–19 % off it; plumbing 0.16–0.22 % of the peak; breadths 1.000 |
| harness (`test.mjs`) | 15 814 checks, 0 failed |
| design (`check-frames.mjs`) | 'on' 66 of 66 held exactly; 'near' 66 of 66 snap back to their frame; 12 of 65 'generic' have no held frame; normRow reads all 231 rows |

The eight cells not scaled are byte for byte the same CIFs. A uniform scale leaves every
lattice direction where it was in the Cartesian frame, so the design's frames still hold.
`design.json` was not drawn again.

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

| class | members in range (list) | reflections (list) | ms/eval, search | evals: iso / search / report | s: iso / search / report | iso + search + report, s | truth reference, s |
|---|---|---|---|---|---|---|---|
| −1 | 58 (170) | 58 (170) | 44.8 | 1393 / 4435 / 1071 | 88 / 199 / 48 | 336 | 42 |
| 2/m | 56 (122) | 37 (76) | 23.9 | 815 / 4556 / 1374 | 27 / 111 / 33 | 172 | 30 |
| mmm | 53 (75) | 25 (34) | 15.1 | 426 / 4214 / 1337 | 7 / 64 / 20 | 91 | 12 |
| 4/m | 110 (146) | 35 (45) | 21.5 | 377 / 5135 / 796 | 7 / 114 / 19 | 140 | 33 |
| 4/mmm | 105 (153) | 27 (36) | 23.7 | 501 / 3901 / 1346 | 9 / 92 / 29 | 130 | 19 |
| −3 | 110 (149) | 40 (53) | 19.8 | 400 / 4162 / 1786 | 7 / 85 / 34 | 126 | 19 |
| −3m | 104 (156) | 31 (44) | 18.1 | 382 / 3737 / 1873 | 5 / 68 / 33 | 107 | 17 |
| 6/m | 102 (151) | 23 (33) | 16.4 | 307 / 3410 / 1625 | 3 / 55 / 25 | 84 | 11 |
| 6/mmm | 112 (152) | 22 (29) | 22.0 | 413 / 3988 / 1937 | 6 / 89 / 42 | 137 | 27 |
| m−3 | 101 (152) | 16 (22) | 19.0 | 325 / 3590 / 880 | 2 / 73 / 17 | 92 | 19 |
| m−3m | 101 (152) | 13 (17) | 17.5 | 268 / 2873 / 373 | 2 / 51 / 7 | 59 | 12 |

- The mean is 134 s a run (median 108). The longest run is ellcyl-P-1-near at 477 s.
- With the truth reference and the drawing (0.26–1.2 s a pattern), the mean is 157 s.
- The search's evaluations cost 20 ms (median; 10–50).
- **Where the time goes:** 68 % in the search, 21 % in the report, 11 % in the isotropic fit.
  P−1 still costs 2.5× the mean, through its evaluations: a 6-parameter cell and an
  isotropic fit of about 1400 evaluations, a quarter of its time.

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

| configuration | predicted mean, s |
|---|---|
| C0 as first drawn | 375 |
| C1 the costliest cells × 0.8 (P−1, P2/m, Pmmm: 85–142 ms an evaluation against 22–42 elsewhere) | 241 |
| C2 C1 and 10–110° | 170 |
| **C3 C1 and 10–100°** | **138** |
| C4 C1, 10–110° and 0.02° (step coarsened before the range is exhausted, for comparison) | 141 |
| D1 every cell × 0.8 | 168 |
| D2 every cell × 0.8 and 10–110° | 115 |

- **The choice is C3**, the first configuration in the order within the budget. The cells
  scaled are the three whose evaluation cost stood out. At 0.8 their shaped evaluation costs
  34–57 ms at 10–130°, near the others' 26–31.
- **D2 is not chosen.** It reaches the budget by shrinking cells that were not the costly ones,
  which would halve every class's members. The order puts the costliest cells first.
- **Verified** on the same 11 truths at C3: 116 s mean (median 98; P−1 291 s), against 138
  predicted. A search's evaluation cost 15.8 ms (median), against 33.5. The search took 3942
  evaluations on average, against 4985 before: a narrower range also converges sooner.
  The screening set then gave 134 s (§4.2).

**The step stays at 0.01°.** No coarsening was needed.
- `narrow.mjs` finds every design row's narrowest line, a lower bound on its FWHM: the
  member's exact size line (its A(L), the row's size distribution) convolved with the
  instrument's pseudo-Voigt and the row's strain, the axial wings and Kα2 left out.
- Over all 231 rows on 10–100° the narrowest is 0.156°: box-Pm-3-on, ⟨L⟩_V 60 nm at 41.7°.
  That is 15.6 points per FWHM at 0.01°.
- At 0.02° it would still be 7.8, so the step remains in reserve.
- Only the truths' geometry was read, no result.

**What changed in the data:**
- **Cells.** P−1 is now 2.84, 3.096, 3.352 Å (96, 104, 90°). P2/m is 3.056, 2.624,
  3.496 Å (β 100°), and Pmmm 2.688, 2.872, 3.456 Å. Angles and atoms' fractional coordinates
  are kept. In 10–100° they have 58, 56 and 53 members, against 101–112 for the other
  classes. The first cells are kept in `scripts/phases/cif-v1/`.
- **Range.** 10–100°, 9001 points. The pilot's `run.mjs` defaults to it. The generator's
  own default, `GRID`, is left at 10–130°.
- The background shape, the instrument and the error draws are unchanged. Hump centres
  and impurity positions are drawn over the new range, as their rules say.

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
percentiles; "axis" is the truth's most distinct axis (median, 90th percentile).

**By solid** (66 truths, errors included):

| solid | thinnest | middle | longest | axis ° | χ²_ν |
|---|---|---|---|---|---|
| box | +31 % (+9…+86) | −1 % (−18…+33) | −12 % (−52…+37) | 5.3 (22.7) | 1.79 |
| square box | +16 % (−5…+56) | +16 % (−5…+36) | +4 % (−24…+26) | 7.9 (27.1) | 1.56 |
| cylinder | +19 % (+2…+33) | +14 % (+2…+22) | +12 % (−2…+141) | 4.6 (18.9) | 1.24 |
| elliptic cylinder | +18 % (+5…+56) | +1 % (−18…+51) | −15 % (−44…+10) | 11.5 (21.6) | 1.25 |
| ellipsoid | +9 % (+1…+60) | +3 % (−29…+12) | −10 % (−55…+29) | 3.0 (30.0) | 1.14 |
| spheroid | +24 % (+3…+79) | +2 % (−45…+12) | −26 % (−45…+8) | 1.1 (43.3) | 1.81 |

**By Laue class** (the 33 clean truths). The anisotropy column is longest/thinnest as read,
over the truth's (median, 10th–90th percentiles):

| class | runs | thinnest | longest | anisotropy read ÷ true | axis ° |
|---|---|---|---|---|---|
| −1 | 3 | +14 % | +15 % | 1.05 (0.91…1.08) | 3.6 |
| 2/m | 3 | +7 % | +14 % | 0.99 (0.99…1.05) | 11.8 |
| mmm | 3 | +9 % | −0 % | 0.94 (0.85…0.97) | 1.5 |
| 4/m | 3 | +37 % | −4 % | 0.70 (0.68…0.71) | 18.9 |
| 4/mmm | 3 | +13 % | +5 % | 0.93 (0.46…1.06) | 0.0 |
| −3 | 2 | +22 % | +4 % | 0.86 (0.80…0.92) | 23.8 |
| −3m | 3 | +31 % | −19 % | 0.74 (0.58…0.81) | 1.1 |
| 6/m | 5 | +56 % | −23 % | 0.48 (0.32…0.91) | 12.6 |
| 6/mmm | 1 | +17 % | +1 % | 0.86 | 0.0 |
| m−3 | 3 | +33 % | −5 % | 0.72 (0.39…0.80) | 0.0 |
| m−3m | 4 | +96 % | −52 % | 0.26 (0.20…0.36) | 24.4 |

**By the model error** (all solids): none (33) thinnest +28 %, longest −3 %, χ²_ν 1.29; hump
(7) +32 %, −14 %, 1.99; size distribution (7) +8 %, −12 %, 1.51; impurity (7) +28 %, +10 %,
2.51; air (6) +11 %, −1 %, 1.30; preferred orientation (6) +6 %, +17 %, axis 16.9° (90th
percentile 43.6°), 1.59.

**What this says:**
- **On top of the uniform +13–20 %, the solid is pulled toward equant, and how far follows the
  class.** In −1, 2/m and mmm the anisotropy is read as it is (0.94–1.05). The cubic classes
  lose most of it: m−3m reads a quarter of it, and its ellipsoid, spheroid and square box
  refine from the truth to a sphere or cube (ellipsoid-Pm-3m-near 14×37×60 nm → 26.5 nm in all
  three).
- **This fits where the shape shows** (a reading, not a test). A class's symmetry averages
  part of a deformation of the sphere out of the reflections' breadths, the more of it the
  higher the class: in cubic all of it, to first order (`freeShape`'s own comment). There a
  family's members differ in width, but the family's line is their sum at one 2θ, so only its
  shape carries the anisotropy. The exact lines' shapes differ from the Lorentzian's by 13–19 %
  of the peak (the generator's limit check), so the anisotropy has little left to be read
  from.
- **χ²_ν at the truth reference** is 1.50 (median; 90th percentile 5.9, at most 29.9). The
  misfit is the line shape. It grows with counts: the isotropic fit's χ²_ν runs from 1.02 to
  75.7 over the 66 truths.
- **The first 11 cost truths, on the first cells and 10–130°,** gave the same picture. The
  thinnest read +9 to +88 %, the longest down to −56 %. ellipsoid-Pm-3m-near and sqbox-Pm-3-on
  refined to a sphere and a cube.

### 6.3 In-model controls (the engine's own lines)

Three of the pilot truths were drawn with `--kernel none`, the engine's own Lorentzian lines,
the rest the same:

| run | with exact lines | with the engine's lines |
|---|---|---|
| box-P4mmm-generic, 2.9×8.8×17.2 nm | truth reference +31 %, −18 %, −55 %, axis 14°, χ²_ν 4.6; today the same minimum | today and the truth reference: −0 %, +0 %, +1 %, axis 0.1°, χ²_ν 1.01 (ΔBIC −6058) |
| ellcyl-P6mmm-on, 4.3×11.7×34.2 nm | truth reference +17 %, +56 %, +1 %, χ²_ν 10.8; today the same | −0 %, −1 %, +1 %, axis 0.0°, χ²_ν 0.99 (held, ΔBIC −8587) |
| ellipsoid-Pm-3m-near, 14.0×36.6×60.0 nm | truth reference → a 26.5 nm sphere; today rejected early (ΔBIC +18) | kept narrowly (ΔBIC −14): +4 %, −10 %, +150 %, axis 27° |

The harness and the generator agree. The search finds the truth when the line shape is the
model's. The bias of §6.2 is the line shape's. In m−3m the shape is weakly determined even in
the model's own lines: the longest extent is free to 2.5×.

### 6.4 Today's minimum against the truth reference's

The truth reference stops at the minimum next to the truth. With exact lines that is often
not the model's lowest:
- In 32 of the 59 kept truths, today's best χ² lies more than one χ²_ν below the truth
  reference's.
- In 19 of these the solid differs beyond 8° or 28 % (`sameSolid`).
- In 3 more the solid differs within one χ²_ν: equivalent minima.
- The rest are the same minimum.

So with exact lines, accuracy is lost in two ways:
- the minimum next to the truth is biased (§6.2);
- the lowest minimum is often another solid, which a perfect search would report.

Today's accuracy (§7) includes both.

## 7. Today's search on the screening set

The screening set is 77 runs: 66 tuning truths, one per solid × class, and 11 spheres. It ran
at the decided cells and range, with 3 processes, nice 15, resumable, and no failures. Reach
is Δ = (today's best exact χ² − the lower of today's and the truth reference's)/max(1,
χ²_ν). It is judged on truths, but not on early rejections, whose only ends are brief
refinements (round 1's rule). Accuracy is the reported solid against the truth, modulo the
class's rotations and the body's symmetry. The extents are paired within the body's axis
classes; "axis" is the truth's most distinct axis.

**Overall:**

| set | runs | held | free | rejected (early) | reached / judged | worst extent, median (90 %) | thinnest, median | axis °, median (90 %) | evals: search | s: search / report / iso |
|---|---|---|---|---|---|---|---|---|---|---|
| truths | 66 | 34 | 25 | 7 (4) | 61 / 62 | +35 % (+130 %) | +18 % | 7.7 (32.4) | 4131 | 94 / 31 / 16 |
| spheres | 11 | 1 | 3 | 7 (4) | — | — | — | — | 3215 | 75 / 13 / 8 |

- **The one Δ over 1** is cylinder-Pm-3m-on, with a size distribution at strength 0.72: Δ 1.65,
  held. Five runs are over Δ 0.1.
- **No rejection is a miss.** All 7 rejected truths have a truth-reference ΔBIC of +9 to +28:
  even from the truth the data do not support the shape against the isotropic size. They are
  spheroid-Pm-3m-on, spheroid-Pm-3-generic, ellipsoid-Pm-3m-near and cylinder-Pm-3-generic
  (early), and sqbox-Pm-3m-near, sqbox-P4m-on (9.1×9.1×9.0 nm) and sqbox-P6m-near (late).
- **Spheres (the nulls):** 4 of 11 keep a shape.
  - sphere-P-3-1, 2.5 nm, searched as a box: 1.7×1.7×2.0 nm, ΔBIC −633;
  - sphere-Pmmm-1, 3.4 nm, cylinder: 2.8×2.8×2.4, ΔBIC −370;
  - sphere-P-3m1-2, 3.7 nm, square box: 2.8×2.8×2.5, ΔBIC −30;
  - sphere-P6mmm-1, 9.9 nm, preferred orientation at strength 0.59, box: 14.6×8.1×7.6,
    ΔBIC −397.

  The first three are the three smallest spheres of the set (isotropic χ²_ν 1.6–5.8). Each
  is kept as a near-equant body, which takes up part of the sphere's line-shape error. The
  fourth is texture read as shape. The 7 rejected spheres include every error kind but
  texture.

**By solid** (truths):

| solid | held / free / rejected | reached / judged | worst extent (90 %) | thinnest | axis ° (90 %) |
|---|---|---|---|---|---|
| box | 5 / 6 / 0 | 11 / 11 | +36 % (+109 %) | +31 % | 6.9 (17.7) |
| square box | 4 / 4 / 3 | 11 / 11 | +38 % (+89 %) | +14 % | 12.1 (34.2) |
| cylinder | 6 / 4 / 1 | 9 / 10 | +29 % (+90 %) | +20 % | 9.6 (86.6) |
| elliptic cylinder | 6 / 5 / 0 | 11 / 11 | +109 % (+265 %) | +161 % | 8.1 (26.8) |
| ellipsoid | 6 / 4 / 1 | 10 / 10 | +29 % (+55 %) | +9 % | 4.5 (24.9) |
| spheroid | 7 / 2 / 2 | 9 / 9 | +39 % (+59 %) | +10 % | 19.0 (35.6) |

The elliptic cylinder's errors are mostly another assignment of its height. In 7 of 11 the
reported height is another of the truth's extents (its thinnest, middle or longest), at the
truth reference's χ² or a lower one: round 1's elliptic-cylinder confusion. Paired whatever
their class (`accLoose`), the extents' worst error is +56 % (median) against +161 % paired
within the classes.

**By class** (kept truths; worst extent, thinnest, axis):
- −1: +39 %, +14 %, 4.5°;
- 2/m: +18 %, +11 %, 2.8°;
- mmm: +16 %, +9 %, 2.9°;
- 4/m: +36 %, +29 %, 5.5°;
- 4/mmm: +18 %, +13 %, 3.2°;
- −3: +37 %, +30 %, 22.0° (8.0° modulo the holohedry);
- −3m: +54 %, +20 %, 12.7°;
- 6/m: +61 %, +61 %, 23.7°;
- 6/mmm: +56 %, +41 %, 15.7°;
- m−3: +33 %, +20 %, 2.1°, 2 of 6 truths rejected (early);
- m−3m: +108 %, +108 %, 19.7°, 3 of 6 truths rejected.

The low classes are read best, as §6.2 predicts. −3 is the one merohedral class whose axis
error drops modulo the holohedry (22.0° to 8.0°). Its errors include twin-like images, which
only the intensities of reflections at the same d tell apart.

**By orientation** (truths):
- on: 14 held, axis 0.0° (90th percentile 19°), worst extent +33 %;
- near: 14 held, 7.7° (44°), +32 %;
- generic: 6 held, 19.0° (33°), +55 %.

The held route snaps the 'on' truths exactly. A truth 2–10° off its frame reads about as far
off as its frame lies from it (the design's near frames: 6° median).

**By model error** (truths; worst extent, axis):
- none (33): +31 %, 8.6°;
- hump (7): +61 %, 15.8°;
- size distribution (7): +33 %, 4.4°;
- impurity (7): +72 %, 8.1°;
- air (6): +18 %, 4.3°;
- preferred orientation (6): +44 %, 22.9°.

Hump, impurity and texture cost the most.

**Evaluations and time:**
- search: 4131 evaluations and 94 s on the truths, 3215 and 75 s on the spheres;
- report: 1600 evaluations and 34 s on a kept solid;
- the whole set: 67 min of wall time on 3 processes with the truth reference, about 57 min
  without it (the runs' times summed, over 3).

The per-run tables are in `tables/pilot-screen.md`.

## 8. What it means for round 2

- **The cost is now set.**
  - A screening of a variant costs about 1 h on 3 processes. The truth reference adds 17 %.
  - A confirmation on the 154 tuning runs costs about 2 h.
  - P−1 is 2.5× the mean; its isotropic fit is a quarter of that.
- **The line shape, not the search, sets today's accuracy.**
  - Reach against the truth reference is 61 of 62.
  - The kept solids' extents are still 18–35 % off (median) and their axes 8°, worse in the
    higher classes.
  - The same truths drawn with the model's own lines come back to 1 %.
  - The search's efficiency, round 2's first task, can be screened as planned. But accuracy
    figures will measure the model's line shape as much as the search.
- **Reach needs a better reference than the truth's minimum.** In 32 of 59 runs today's
  minimum lies below it. The best known per run must be the lowest over every method run on
  it, as the protocol says (Δ ≤ 1 against the best known), with the dense reference search
  for completeness.
- **The keep criterion meets false shapes on exact lines.** 4 of 11 spheres keep one (ΔBIC
  −30 to −633). The isotropic model's own misfit (χ²_ν up to 5.8 on a 2.5 nm sphere) is taken
  for evidence even with χ² divided by its χ²_ν. This is the protocol's keep-criterion
  question, now with numbers.
- **Cubic is the weak class.** 3 of 6 m−3m truths and 2 of 6 m−3 are rejected. In m−3m the
  model reads a quarter of the true anisotropy, and in-model the longest extent is free to 2.5×.
  A better search will not help there. A line shape nearer the exact one might: the protocol's
  "why the solids are confused".
- **Merohedral classes.** −3's axis error drops from 22° to 8° modulo the holohedry. The
  other four show no twin-like error at median.

## 9. Files

- `scripts/`: the scripts and small inputs: phases, generator, harness, design, pilot. Its
  README sets up a work folder from this repository.
- `scripts/pilot/README.md`: the pilot's commands and results layout.
- `tables/pilot-cost.md`: §4.1's runs, with the bias and search tables on the first cells.
- `tables/pilot-screen.md`: every table of §4.2, §6.2 and §7, and the per-run tables.
- `tables/pilot-inmodel.md`: §6.3.
- The run records (one JSON per run) and the profiles are in the work folder,
  `fs2/pilot/results/`, not in the repository.
