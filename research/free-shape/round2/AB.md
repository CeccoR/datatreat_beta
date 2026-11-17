# Free shape, round 2: the size line and the search's efficiency

This is stage 2 of `../PROTOCOL.md` (screening) for two of round 2's items, run side by side:

- **Track A, the size line's shape in the model.** The pilot found that the engine's Lorentzian
  size line, not the search, sets most of today's error on exact data (`PILOT.md` §6, §8).
  Track A tried other line models in the engine, measured their accuracy and cost, and asked
  why the solids are confused and what tells them apart.
- **Track B, the fit's efficiency.** No covariance in intermediate refinements, forward
  differences with one central pass on the returned fit, held frames de-duplicated, symmetry
  used to cut the starts.

All data are synthetic, drawn by round 2's generator with exact lines. Only tuning rows were
run; no validation row was run or read. The engine is a frozen copy of `b9bef5f`, instrumented
or switched by environment flags; nothing in the app was changed. Today's search on the 77-run
screening set (`PILOT.md` §7) is the reference. A skeptic checked each track with their own
code; every problem they found held and was fixed at its root (§5), and every number below is
from after the fixes. The scripts are in `scripts/A/` and `scripts/B/`, the tables in `tables/`.

## Contents

1. [Summary](#1-summary)
2. [How it was measured](#2-how-it-was-measured)
3. [Track A: the size line](#3-track-a-the-size-line)
4. [Track B: the search's efficiency](#4-track-b-the-searchs-efficiency)
5. [The verification](#5-the-verification)
6. [Next steps for round 2](#6-next-steps-for-round-2)
7. [Files](#7-files)

## 1. Summary

**What to adopt.**

1. **Track B's combination, now.** Forward differences in every refinement of the search, no
   covariance in intermediate refinements, the returned fit refined once more with central
   differences (its covariance taken from that pass), held frames de-duplicated by the
   canonical form, and only the class's distinct low-index starts (no random fill). On the 77
   screening runs against today's search:
   - **0.492× the evaluations** (151 007 against 307 235) and **0.55× the search's wall time**
     (42 s against 77 s a run);
   - the same outcome (held, free, rejected) on 76 of 77; reach 57/63 against 55/63; the solid
     changed on 2 of 63 kept runs; accuracy as today.
   - Risk: it was measured on today's Lorentzian line only.
2. **The lsq line as the default size line, now.** Each member's line is the engine's own TCH
   pseudo-Voigt with the (g, l) that best fits the solid's exact line along the member, from
   tables. It costs what today costs (0.99× CPU).
3. **WPPM (the exact line) for the search where the solid must be told apart or accuracy
   matters.** It costs 2.88× today's CPU (3.6× in −1 and −3).

**The gains of the line models** (77-run screening set, today's search with each line;
medians over the kept truths unless said):

| | today (lor) | lsq | WPPM |
|---|---|---|---|
| truths kept | 60/66 | 65/66 | 66/66 |
| reach (Δ ≤ 1 against the model's own truth reference) | 58/63 | 65/66 | 62/66 |
| worst extent (90 %) | +42 % (+290 %) | +16 % (+232 %) | +4 % (+335 %) |
| thinnest extent | +20 % | +1 % | +0 % |
| most distinct axis (90 %) | 6.8° (79.0) | 4.3° (31.8) | 1.6° (14.4) |
| anisotropy read ÷ true, 28 clean rows every model kept: median, median \|ln\|, rows outside 0.9–1.1 | 0.74, 0.33, 21 | 0.96, 0.09, 14 | 1.00, 0.02, 6 |
| spheres keeping a false shape | 3/11 | 2/11 | 2/11 |
| solid family, expected margin on exact data (11 rows): right / within ±3 / wrong | 4 / 3 / 4 | 8 / 1 / 2 | 8 / 3 / 0 |
| CPU a run, iso + search + report (22 rows, one load) | 48 s | 48 s (0.99×) | 140 s (2.88×) |

**What they cost besides time.**
- lsq keeps a line error of 2.5–8 % of the peak. In expectation it puts two of the 11 rows in
  the wrong family: cylinder-P6m-on goes to the ellipsoid by 8.9 χ²/χ²_ν,iso, ellcyl-P6m-generic
  by about 11.
- WPPM reads model errors as shape more readily. All 6 of its unbounded extents are on rows
  with a model error, and the 4.4 nm sphere with a size distribution keeps a spheroid at ΔBIC
  −3483.
- Track B's halving was measured with today's line. If it carried over unchanged, WPPM with B
  would cost about 2.88 × 0.55 ≈ 1.6× today's wall time; that is arithmetic, not a measurement.

**Why the Lorentzian fails, in one paragraph.** At one ⟨L⟩_V the Lorentzian is 11.5–21 % of the
peak off every solid's exact line, and fitted alone it reads ⟨L⟩_V 13–25 % long. A reflection
carries several members, and a sum of lines of different widths looks more Lorentzian than one
line, so the fit collapses the spread: solids are pulled toward equant, the more members a
reflection has (the higher the symmetry), the more (m−3m reads a quarter of the true anisotropy
from the truth). Near families of solids have column lengths within 0.8–2.6 % rms; what tells
them apart is that the exact line's shape changes with direction. With the exact lines the
in-model separation of such pairs is 13× that of a ball-shaped line of the same ⟨L⟩_V, which is
itself 1.8× the Lorentzian's (§3.7).

**What stays open.**
- B on A's line models: forward differences, the central pass and the start cut were measured
  on lor only.
- WPPM's cost: lsq for the brief trials with WPPM for full refinements, fewer Fourier nodes,
  cached member transforms; all untested.
- A better few-parameter line than TCH, to close lsq's two family errors at today's cost.
- Three rows are within 3 χ²/χ²_ν,iso of another family even with exact lines; the family is
  not determined at these counts. The reporting rule ("family not determined", nested ratio
  supported or not) and its margin are not yet calibrated.
- Model errors with exact lines: the per-line χ²_ν flag and the jackknife are the protocol's
  answer, not yet built.
- The solids rest on 11 clean rows (one to three per solid); the confirmation on 154 tuning
  runs should repeat the cross-solid fits with the adopted line, error rows included.
- A random 0.02 rad turn before each polish and the refit decides the free minimum in flat
  valleys (up to 7.5 χ²_ν on one run): the minima stage of the protocol has to take it over.

## 2. How it was measured

- **Rows.** The 77-run screening set (66 truths, one per solid × Laue class, and 11 spheres) and
  two subsets fixed before any variant ran:
  - the **sub-screen**: 22 truths, two per Laue class, the solids rotated over the classes
    (`scripts/A/subscreen.txt`, `scripts/B/subscreen.txt`: the same rule; 11 clean, 11 with an
    error);
  - the **11 clean sub-screen rows** for the cross-solid fits (one to three per solid).
- **Runs.** One process per row draws the pattern (exact lines, Poisson noise), fits it
  isotropically from the CIF and runs each method from that fit, as in the pilot. Batches ran at
  most 2 processes per track at nice 15, two tracks at once on 4 vCPUs. Everything is
  deterministic: a re-run gives the same evaluations and χ² bit for bit.
- **Scoring** is the pilot's (`report.mjs` rules): extents compared modulo the class and the
  solid's symmetry; an unbounded extent counts as +∞ in medians and percentiles; "worst" is a
  run's largest |extent error|; "axis" is the truth's most distinct axis. Anisotropy is
  longest/thinnest read divided by the truth's.
- **Reach** has two references, kept apart:
  - track A: Δ ≤ 1 χ²_ν against the line model's own truth reference (the solid refined from
    the truth with that line), so each model is on its own χ² scale;
  - track B: Δ ≤ 1 against the best known, the lowest exact χ² over every method run on the
    row (pilot, truth reference, every variant). Against it today reaches 55/63, against the
    truth reference 58/63.
- **Cost.**
  - Evaluations (calls of `phasePattern`) are independent of the machine.
  - Track A's times are **CPU time** of the isotropic fit + search + report, the 22 sub-screen
    rows run with every line back to back, two rows at a time, under one load. CPU runs about
    7 % over the main thread's wall (the GC's helper threads); walls under the same load give
    the same ratios.
  - Track B's times are the **search's wall time**. Forward differences against today were run
    in the same process (paired, 22 rows); the other variants ran in other processes, and the
    pilot's today ran on an otherwise idle machine. The load was heavier during B's runs (2
    processes beside the other track's 2–3), which biases the ratios against the variants.
- **Margins** for the solids are in χ²/χ²_ν,iso: a χ² difference divided by the row's isotropic
  fit's χ²_ν. The "expected margin" is from noise-free fits to the generator's exact pattern
  with Poisson weights at the row's counts: the margin a model shows on average, without the
  noise draw.

## 3. Track A: the size line

### 3.1 The line models

Each member's size line is drawn by the engine's own TCH pseudo-Voigt; what changes is the
Gaussian and Lorentzian FWHM fed to it, as multipliers [k_g, k_l] on today's width w (FWHM
0.675/⟨L⟩_V in d*). The isotropic sphere's line changes the same way, so the keep criterion
compares like with like.

| model | what | how |
|---|---|---|
| **lor** | today's Lorentzian, FWHM 0.675/⟨L⟩_V | [0, 1]; bit-identical to the frozen engine (22 of 22 timing runs reproduce the pilot's χ² and evaluations) |
| **ib** (a) | a Lorentzian of integral breadth 1/⟨L⟩_V: the breadth convention alone | [0, 0.943] |
| **mom** (b1) | the TCH line with the exact line's integral breadth and Porod tail | tables |
| **lsq** (b2) | the TCH line that best fits the exact line by weighted least squares (\|x\| ≤ 6/⟨L⟩_V, weights 1/(p + 0.2)) | tables |
| **wppm** (c) | the exact line by the Fourier route: the engine's own WPPM profile, each member's line the transform of the solid's analytic A(L) times instrument and strain | engine |
| hyb | today's search with lsq, then up to 3 ends and the isotropic fit refined again in WPPM, the keep criterion in WPPM | |

- **The tables** (`lines/build-tables.mjs`, 18 s): the reduced line along a member depends on
  one entry for the ball family (sphere, ellipsoid, spheroid), one ratio for the cylinder and
  elliptic cylinder (ψ, the angle from the axis in the scaled body, every 0.5°), two for the box
  (the sorted scaled direction components' ratios, every 0.025). The exact lines are this
  folder's own Fourier transforms of A(L) (`lines/profiles.mjs`), within 3·10⁻¹⁵ of the peak of
  the generator's A(L). The model never calls the generator.
- **The inverse-crime caveat for (c).** The WPPM model and the generator's correction term
  share the engine's `wppmLine` and A(L) formulas (written separately). Read (c) as the ceiling
  for an exact model. Drawn by this folder's own model at the truth, its pattern is 0.06–0.22 %
  of the peak off the generator's exact one. The (b) tables are independent: the skeptic's own
  transform and TCH reproduced them (§5.1).

### 3.2 The line alone and in the pattern

The line alone: 200 random members per solid in the design's ranges, unit area, fitted by each
model with area and width free. In the pattern: the generator's pattern without noise against
the model, both at the truth, on the 21 sub-screen rows without texture (`tables/A-lines.md`).

| model | line alone: max \|Δ\| of the peak, median (90 %) | ⟨L⟩_V read ÷ true | in the pattern: max \|Δ\| of the peak, median (90 %) | excess χ²_ν, median (max) |
|---|---|---|---|---|
| lor | 17.5 % (18.6) | 1.163 (1.131–1.252 with other weights) | 13.0 % (16.1) | 0.81 (36.8, cylinder-P4mmm-on) |
| ib | 17.0 % (18.3) | 1.097 (1.066–1.180) | 11.7 % (15.3) | 0.66 (29.2) |
| mom | 5.4 % (6.9) | 1.042 (1.032–1.061) | 4.2 % (6.0) | 0.10 (4.9) |
| lsq | 4.5 % (6.4), in sample | 1.000 by construction; 0.986–1.013 out of sample | 3.6 % (5.6) | 0.04 (2.8) |
| wppm | — | — | 0.29 % (0.65) | 0.000 (2.5) |

- **lsq's line figures are in sample.** They are scored with the cost that built the tables,
  so ⟨L⟩_V reads 1.000 by construction. Read with other weights on the same 1200 members it
  reads 1.013 (10–90 %: 1.004–1.027) with the tails weighted (1/(p + 0.02), |x| ≤ 10) and 0.986
  (0.978–0.991) nearly flat (1/(p + 2)). The max |Δ| sits at the line's top and does not move
  with the weights. The out-of-sample test that counts is the pattern: 3.6 % of the peak.
- **The exact lines differ by solid and direction.** At one ⟨L⟩_V they differ from each other by
  1–12 % of the peak (`linediff.mjs`): the ball against a box edge 4.8 %, against a cylinder
  across 1.7 %; a box edge and a cylinder along its axis are the same line. The Lorentzian is
  11.5–21 % off every one of them, the lsq line 2.5–8 %. Their FWHM·⟨L⟩_V runs from 0.74 (box
  body diagonal) to 0.89 (box edge), against the Lorentzian's 0.675.
- **About 6 points of the Lorentzian's 16 % come from the breadth convention**, the rest from its
  shape: ib reads 1.097 where lor reads 1.163, at the same max |Δ| (17.0 against 17.5 %).
- **The two-member family test** (`family.mjs`): two lines of ⟨L⟩_V 1 ± δ in one reflection, read
  as one family of two members. lor reads no spread up to δ 0.5. lsq reads none at δ 0.1, and
  for the ball 0.48 of it at δ 0.2, 0.90 at 0.3. For a box edge (or a cylinder along its axis)
  lsq still reads none at δ 0.2, then 0.90 at 0.3 and 1.03 at 0.5.

### 3.3 The screening set

Today's search with lor (the pilot's run), lsq and wppm on the 77 runs, each with its own truth
reference (`tables/A-screen.md`).

**The truth reference** (the model's minimum next to the truth; 66 truths):

| model | thinnest | middle | longest | worst (90 %) | unbounded | axis ° (90 %) | χ²_ν | ΔBIC > −10 (not supported even from the truth) |
|---|---|---|---|---|---|---|---|---|
| lor | +19 % | +6 % | +2 % | +38 % (+101 %) | 4 | 5.0 (28.3) | 1.40 | 8 |
| lsq | +1 % | −1 % | +0 % | +13 % (+338 %) | 5 | 3.1 (19.4) | 1.06 | 2 |
| wppm | +0 % | −0 % | +0 % | +4 % (+410 %) | 6 | 1.3 (9.7) | 1.01 | 1 |

On the 33 clean truths: lor +29 % thinnest, +37 % worst (+105 %), 4.2°; lsq +4 %, +9 % (+42 %),
2.8°; wppm +0 %, +2 % (+26 %), 0.7°, with no unbounded extent for lsq or wppm.

**Today's search with each line:**

| model | held / free / rejected | reached | unbounded | worst (90 %) | thinnest | axis ° (90 %) | search evaluations (mean) |
|---|---|---|---|---|---|---|---|
| lor | 32 / 28 / 6 | 58/63 | 3 | +42 % (+290 %) | +20 % | 6.8 (79.0) | 4122 |
| lsq | 22 / 43 / 1 | 65/66 | 2 | +16 % (+232 %) | +1 % | 4.3 (31.8) | 3721 |
| wppm | 24 / 42 / 0 | 62/66 | 6 | +4 % (+335 %) | +0 % | 1.6 (14.4) | 3486 |

- **Kept.** lor rejects 6 (four cubic truths, two square boxes); lsq rejects only
  ellipsoid-Pm-3m-near (ΔBIC −9; its truth reference is +18); wppm keeps it at −18 although its
  own truth reference is at +10.
- **Reach.** lsq misses ellcyl-P6mmm-on by 807 χ²_ν, a basin WPPM finds exactly. WPPM misses
  four, three of them with a model error: cylinder-Pm-3m-on (size distribution) by 1502,
  ellipsoid-Pm-3-on (texture) by 216, ellcyl-P-3m1-near (size distribution) by 1.5, and the clean
  sqbox-Pmmm-generic by 6.6.
- **The unbounded extents.** lor's 3 include one clean truth (cylinder-P-1-generic). lsq's 2 and
  wppm's 6 are all on error rows: for wppm three with texture, two with a size distribution, one
  with an impurity.
- **More free fits.** With a line nearer the exact one the search finds free minima below the
  held frame more often (free 28 → 43 and 42).
- **The spheres.** lor keeps 3 of 11: the two smallest (2.5 and 3.4 nm, whose isotropic fit
  already misfits: χ²_ν 4.91 and 2.89) and one with texture. lsq and wppm both keep 2: the
  textured one, and the 4.4 nm sphere with a size distribution (ΔBIC −1775 and −3483), which lor
  rejected. The Lorentzian's misfit made the small spheres' false shapes; the size distribution
  now makes one.

**Anisotropy like for like** (`tables/A-aniso.md`). On the 28 clean rows every model kept, the
median ratio is lor 0.74, lsq 0.96, wppm 1.00, and the median |ln ratio| 0.33, 0.09, 0.02. Rows
outside 0.9–1.1: lor 21, lsq 14 (0.04–1.91), wppm 6 of 28. WPPM's six: ellcyl-Pm-3m-generic 0.70,
box-P-3m1-near 0.84, spheroid-P-3-near 1.11, ellipsoid-P-3m1-on 1.15, box-P6m-generic 1.34,
ellipsoid-P6m-near 1.72. So even the exact line does not read every solid's anisotropy within
10 %: per row it reads 0.70–1.72 in the search and 0.69–1.68 from the truth.

### 3.4 Per Laue class, solid and error kind

Truth reference, every clean row (the same rows for each model): anisotropy read ÷ true, median
(`tables/A-screen-groups.md`, `tables/A-aniso.md`):

| class | rows | lor | lsq | wppm | wppm ÷ lor CPU |
|---|---|---|---|---|---|
| −1 | 3 | 1.10 | 1.00 | 1.00 | 3.6 |
| 2/m | 3 | 1.01 | 1.01 | 0.98 | 2.9 |
| mmm | 3 | 0.91 | 0.94 | 0.97 | 3.3 |
| 4/m | 3 | 0.73 | 0.90 | 0.98 | 2.7 |
| 4/mmm | 3 | 0.95 | 0.99 | 1.00 | 2.3 |
| −3 | 2 | 0.86 | 1.04 | 1.09 | 3.6 |
| −3m | 3 | 0.75 | 0.95 | 1.01 | 2.8 |
| 6/m | 5 | 0.59 | 0.96 | 0.99 | 2.5 |
| 6/mmm | 1 | 0.84 | 0.94 | 1.00 | 1.5 |
| m−3 | 3 | 0.69 | 0.89 | 1.01 | 1.8 |
| m−3m | 4 | 0.26 | 1.21 (rows 0.73, 15.0, 1.53, 0.88) | 0.96 | 2.1 |
| all | 33 | 0.77 | 0.95 (\|ln\| 0.11) | 0.99 (\|ln\| 0.02) | 2.88 |

- **The equant pull goes with the symmetry.** lor reads 0.91–1.10 in −1, 2/m and mmm, 0.59–0.95
  in the tetragonal, trigonal and hexagonal classes, 0.69 in m−3 and 0.26 in m−3m.
- **lsq removes the pull at the class median, not per row.** In m−3m its four rows read 0.73 to
  15.0 (median |ln| 0.37); ellcyl-Pm-3m-generic's longest extent runs away (+2061 %).
- **WPPM's class medians are 0.96–1.09**; per row 5 of 33 lie outside 0.9–1.1.
- **The axis in the search**, all rows: 6/mmm lor 82.0°, lsq 12.9°, wppm 1.6°; −3m 25.8°, 17.4°,
  9.3°; 6/m 16.5°, 18.5°, 7.0°.

Today's search by solid and by error kind, kept truths' worst extent (median):

| solid | lor | lsq | wppm |
|---|---|---|---|
| box | +54 % | +21 % | +4 % |
| square box | +43 % (8/11 kept) | +17 % | +1 % |
| cylinder | +30 % | +8 % | +2 % |
| elliptic cylinder | +191 % | +199 % | +7 % |
| ellipsoid | +24 % (10/11) | +17 % (10/11) | +14 % |
| spheroid | +47 % (9/11) | +10 % | +4 % |

| error | rows | lor | lsq | wppm |
|---|---|---|---|---|
| none | 33 | +32 % | +10 % | +2 % |
| hump | 7 | +71 % | +44 % | +7 % |
| size distribution | 7 | +39 % | +21 % | +16 % |
| impurity | 7 | +50 % | +21 % | +19 % |
| air | 6 | +19 % | +10 % | +2 % |
| texture | 6 | +136 % | +162 % | +∞ |

The elliptic cylinder is lsq's weak solid: its height runs away (ellcyl-P6m-generic +307 %,
ellcyl-Pm-3m-generic +199 %, ellcyl-P4mmm-generic +266 %). Under a size distribution or an
impurity WPPM gains little on lsq (+16 and +19 % against +21 %), and under texture neither reads
the solid: there the model error, not the line, sets the error.

### 3.5 The cost

The 22 sub-screen rows, each with lor, lsq, mom and wppm back to back, two rows at a time, under
one load; CPU s of the isotropic fit + search + report, mean a run (`tables/A-cost.md`). The 66
runs with a reference record reproduced its χ² and evaluations exactly.

| model | CPU s a run | ÷ lor (ratio of sums; per row median, range) | evaluations a run (search) | CPU ms an evaluation (median) | screening set, estimated CPU |
|---|---|---|---|---|---|
| lor | 48 | 1 | 6066 (4040) | 6.3 | 62 min |
| lsq | 48 | 0.99 (1.02, 0.63–1.49) | 5710 (3525) | 6.5 | 62 min |
| mom | 50 | 1.04 (0.99, 0.69–1.36) | 5773 (3809) | 6.5 | 65 min |
| wppm | 140 | **2.88** (2.47, 1.20–4.77) | 5334 (3217) | 18.1 | 179 min |

- **WPPM by class** (CPU ÷ lor): −1 3.6 (572 s a run against 158), 2/m 2.9, mmm 3.3, 4/m 2.7,
  4/mmm 2.3, −3 3.6, −3m 2.8, 6/m 2.5, 6/mmm 1.5, m−3 1.8, m−3m 2.1. Walls under the same load:
  2.95×.
- **Why WPPM costs 2.9×.** It makes about as many evaluations (5334 against 6066) but each costs
  18.1 ms CPU against 6.3. The cost grows with the member count and the model list: most in −1
  and −3, least in 6/mmm and cubic.
- **lsq costs what lor costs.** It makes 6 % fewer evaluations; per row it is 0.63–1.49× lor.
- The screening set is estimated as 7 runs × each class's mean. The pilot's 115 s a run and 147
  min were walls under a heavier load: the same deterministic lor runs took 110 s then and 45 s
  now.

### 3.6 The solids: which are confused

Each of the 11 clean sub-screen rows was searched as each of the six solids, early rejection off
(`tables/A-solids.md`). Three families nest: box ⊃ square box, elliptic cylinder ⊃ cylinder,
ellipsoid ⊃ spheroid; a nested partner of the true solid counts as its family.

**Confusion by the lowest χ²** (rows: the true solid, how many rows; cells: the solids chosen,
lor / lsq / wppm):

| true (rows) | lor | lsq | wppm |
|---|---|---|---|
| box (3) | box, square box, elliptic cylinder | box 2, square box | box 3 |
| square box (1) | square box | box | box |
| cylinder (2) | cylinder, box | elliptic cylinder, spheroid | elliptic cylinder 2 |
| elliptic cylinder (3) | elliptic cylinder 2, square box | elliptic cylinder 3 | elliptic cylinder 3 |
| ellipsoid (1) | box | ellipsoid | ellipsoid |
| spheroid (1) | elliptic cylinder | spheroid | ellipsoid |
| right solid / nested / another family | 5 / 1 / 5 | 7 / 3 / 1 | 7 / 4 / 0 |

By BIC: lor 6 / 1 / 4, lsq 6 / 2 / 3, wppm 7 / 3 / 1. BIC prefers the simple member of a nested
family unless the data support the extra ratio (wppm picks the cylinder for 2 of 3 elliptic
cylinders).

**With a margin.** A row counts as the right family only if the true family beats the best
other family by more than m χ²/χ²_ν,iso, and as another family only if another family wins by
more than m; in between it is undetermined. One noise draw a row:

| model | m = 3 by χ²: right / undetermined / other | by BIC | m = 10 by χ² |
|---|---|---|---|
| lor | 4 / 4 / 3 | 5 / 3 / 3 | 3 / 5 / 3 |
| lsq | 9 / 1 / 1 | 8 / 1 / 2 | 6 / 5 / 0 |
| wppm | 9 / 2 / 0 | 10 / 0 / 1 | 7 / 4 / 0 |

**Expected margins.** Each row is one noise draw, so the margin each model shows on average was
computed too: noise-free fits of the true solid and of each other family's general member (box,
elliptic cylinder, ellipsoid) to the generator's exact pattern, Poisson weights at the row's
counts. Margin of the nearest other family (negative: another family wins):

| row | counts | truth, nm | expected: lor / lsq / wppm | one draw: lor / lsq / wppm |
|---|---|---|---|---|
| box-P-1-near | 971 | 6.7 × 13.7 × 60.0 | −2.1 / 25.7 / 46.9 | −2.5 / 8.5 / 26.0 |
| ellcyl-P2m-generic | 18 195 | 27.3 × 60.0 × 14.6 | 3.3 / 17.2 / 30.3 | 5.5 / 16.1 / 31.8 |
| ellipsoid-Pmmm-generic | 1066 | 5.2 × 20.1 × 21.1 | −33.3 / 13.9 / 30.7 | −31.2 / 12.3 / 15.1 |
| box-P4m-near | 9487 | 9.1 × 18.2 × 60.0 | 25.9 / 25.5 / 23.3 | 28.7 / 30.2 / 21.8 |
| cylinder-P4mmm-on | 21 916 | 6.3 × 6.3 × 6.5 | −112.5 / 297 / 412 | −45.6 / 392 / 288 |
| spheroid-P-3-near | 1225 | 15.5 × 15.5 × 13.1 | 1.6 / 5.6 / 16.1 | −1.6 / 3.5 / 11.1 |
| box-P-3m1-near | 906 | 14.3 × 29.6 × 60.0 | 1.0 / 0.5 / 3.0 | 0.0 / 2.4 / 1.6 |
| cylinder-P6m-on | 949 | 5.7 × 5.7 × 6.4 | −13.6 / −8.9 / 6.5 | 0.1 / −7.2 / 9.3 |
| ellcyl-P6m-generic | 4107 | 44.8 × 58.5 × 9.8 | 23.5 / −11.0 / 1.6 | 22.5 / 5.8 / 0.3 |
| sqbox-Pm-3-on | 4203 | 10.9 × 10.9 × 15.2 | 92.9 / 73.8 / 269 | 100.6 / 141 / 241 |
| ellcyl-Pm-3m-generic | 2192 | 17.0 × 52.1 × 6.7 | −17.4 / 4.6 / 2.7 | −17.0 / 12.7 / 4.5 |
| right / within ±3 / wrong | | | 4/3/4, 8/1/2, 8/3/0 | |

- **lor is wrong on 4 rows in expectation**, all toward the box: cylinder-P4mmm-on by 112,
  ellipsoid-Pmmm-generic by 33, ellcyl-Pm-3m-generic by 17, cylinder-P6m-on by 14.
- **lsq is wrong on 2, systematically**: cylinder-P6m-on to the ellipsoid by 8.9,
  ellcyl-P6m-generic to the ellipsoid and the box by 11.0 and 10.4. Its one noisy draw of the
  latter landed +5.8 the right way.
- **WPPM's expected margins are never negative.** Three rows lie within 3: ellcyl-P6m-generic
  1.6 (the wide plate, 45 × 58 × 10 nm), ellcyl-Pm-3m-generic 2.7, box-P-3m1-near 3.0 (906
  counts). Their family is not determined at these counts by any line model: their in-model
  separations with exact lines are 1.5–4.3.
- The noisy margins scatter about the expected ones as expected (wppm cylinder-P6m-on 9.3 noisy,
  6.5 expected; ellcyl-Pm-3m-generic 4.5 and 2.7). lsq and wppm place the same number of rows
  decisively (9 of 11 at m = 3); the difference is that lsq is wrong on two rows in expectation
  and WPPM on none.
- A search as one solid takes about as many evaluations under each line: 3776, 3780 and 3713.

### 3.7 Why they are confused, and what tells them apart

**Column lengths alone** (`colmatch.mjs`). For each candidate solid, the best match of the
truth's ⟨L⟩_V over all members, as the rms of ln ⟨L⟩_V. Different families come within 0.8–2.6 %
rms of each other (box against elliptic cylinder 1.1–1.7 %). Nested families match exactly in
the special case. A mismatch of 12–25 % rms separates families by hundreds of χ² at high counts
only: box-P-3m1-near (14–60 nm, 906 counts) separates from the square box, cylinder and spheroid
by only 0.6–1.0 at 12–15 %, and ellcyl-Pm-3m-generic (2192 counts) by 3.7–6.2 at 15–16 %.

**The isolating test** (`fix/shapesep.mjs --data inmodel`). For the 17 pairs within 2.6 % rms,
each model's own lines are drawn at the truth without noise, and the other family's best fit is
read in that model. Three models:
- lor: the Lorentzian;
- **ball**: every member the ball's exact line at its own ⟨L⟩_V, as compact as an exact line but
  with the same shape in every direction (`FS2A_WPPM_BALL=1`);
- wppm: the exact lines, whose shape changes with direction.

| pair | lor | ball | wppm |
|---|---|---|---|
| box-P-1-near against the elliptic cylinder | 3.6 | 5.2 | 117 |
| ellcyl-P2m-generic against the box | 7.8 | 9.1 | 127 |
| ellipsoid-Pmmm-generic against the box | 3.2 | 11.0 | 181 |
| spheroid-P-3-near against the box | 0.1 | 0.2 | 35 |
| ellcyl-P6m-generic against the box | 0.2 | 0.1 | 1.5 |
| median ratio over the 17 pairs | | ball ÷ lor 1.8 (0.7–5.3) | wppm ÷ ball 13 (1.5–150) |

A compact line reads ⟨L⟩_V more precisely (by the skeptic's Cramér–Rao bound, §5.1, the
Lorentzian's σ is 1.7–2.9× the exact lines'); here that compactness alone adds a factor of about
1.8. The factor 13 is the line's shape changing with direction: the information that ⟨L⟩_V
lacks, and what tells near families apart.

**So the solids are confused for three reasons:**
1. **Nested families** have identical column lengths in the special case. χ² prefers the general
   member; BIC the simple one unless the data support the extra ratio.
2. **Different families with near-equal column lengths** separate little on ⟨L⟩_V alone. The
   exact line's direction-dependent shape separates them, at counts high enough.
3. **A model whose own line error is as large as the differences between solids' lines** gets
   some pairs systematically wrong: lor on 4 of 11 rows (its error is 11.5–21 % of the peak, the
   solids' lines differ by 1–12 %), lsq on 2 (2.5–8 %), WPPM on none.

**Why the equant pull grows with symmetry.** A high-symmetry reflection carries many members at
one 2θ, so the solid's anisotropy shows only as the spread of widths inside a reflection. A sum
of lines of different widths is more Lorentzian-like than one line, and a Lorentzian model
reads it as one width (the family test, §3.2: lor reads no spread up to δ 0.5).

**Why model errors leak into the shape with exact lines.** A family's spread of widths imitates a
size distribution, and texture re-weights members; a free shape absorbs both.

**The extents at the truth, in each model's own world** (`tables/A-floors.md`). The truth
reference on data drawn by each model's own lines, 11 clean rows × 2 noise draws:

| model | worst extent, median (90 %) | axis, median (90 %) |
|---|---|---|
| lor | +8.0 % (+19.6 %) | 1.5° (17.1) |
| ball | +4.7 % (+59.1 %) | 1.0° (12.7) |
| wppm | +2.8 % (+12.0 %) | 0.6° (6.4) |

Paired by row and draw, ball beats lor in 11 of 22 (median change +1.0 point), wppm beats ball in
15 of 22 (−0.4) and lor in 16 of 22 (−2.5). One model's two draws differ by as much (lor +5.6 and
+8.7 %). In its own world the exact model reads the extents a few points better, and these runs
cannot split that between compactness and direction-dependent shape. On exact data, the extent
gains of lsq and WPPM over lor are the removal of the line misfit.

### 3.8 The models not kept

- **ib (a), the breadth convention alone.** It rescales the size and leaves the shape: on the
  sub-screen's truth reference the thinnest extent reads +15 % (lor +22 %), the worst +31 %
  (+68 %) as lor, the axis 4.2° (5.5), χ²_ν 1.43 as lor.
- **mom (b1).** Its extents do not separate it from lsq: on the sub-screen's truth reference, clean rows, worst
  +9 % (+36 %) and axis 2.2° against lsq's +16 % (+43 %) and 2.6°; its search (22 rows) worst +17 %
  (+248 %) against lsq's +16 % (+195 %). lsq is kept for:
  - its fit: pattern 3.6 % against 4.2 % of the peak, excess χ²_ν 0.04 against 0.10, χ²_ν at the
    truth 3.02 against 3.83 on cylinder-P4mmm-on;
  - its bias: mom reads the middle and longest extents 4–8 % short;
  - its reach (22/22 against at most 20/22) and its tail: mom reads ellcyl-P6m-generic unbounded
    and ellcyl-Pm-3m-generic +762 %.
- **hyb, an lsq search with a WPPM end.** On the sub-screen worst +6 % (+334 %), axis 2.8°
  (24.8), against WPPM's +6 % (+29 %) and 1.9°. Five rows fail: ellcyl-P6m-generic +2892 %,
  ellcyl-Pm-3m-generic +342 %, ellcyl-P4mmm-generic +266 %, spheroid-P6mmm-near +243 %,
  cylinder-Pm-3m-on unbounded. The line used in the search decides the basin, and a WPPM polish
  cannot leave it. Its search costs 4475 evaluations against WPPM's 3217 and lsq's 3525.

## 4. Track B: the search's efficiency

All on today's line (lor) and exact data. Each variant is a copy of `b9bef5f`'s
`freeShapeRun` with knobs (`B/methods/var.mjs`), on an engine copy whose solver options are
opt-in (`B/make-eng.mjs`). Its replica of today ("today", no knob) matches the pilot's records
on all 22 sub-screen runs refinement by refinement (88 881 evaluations), so each variant differs
from today only by its knobs.

### 4.1 Where the evaluations go

Today's search, sub-screen means a run (`tables/B-sub.md`):

| stage | evaluations | iterations a refinement | share |
|---|---|---|---|
| 11 briefs (8 iterations each) | 2431 | 7.9 | 60 % |
| 3 full refinements | 910 | 11.5 | 23 % |
| held frames | 421 | 13.1 | 10 % |
| polish, exact, refit | 278 | 2.5–4.4 | 7 % |

An iteration is a Jacobian (2 evaluations a non-linear column, central) plus about 1.2 trial
steps. Every refinement also ended with a covariance: 1 + 2 evaluations a non-linear parameter,
about 20 a refinement, 10 % of a brief.

### 4.2 Each step

Evaluations × today's (sum over the runs); "wall" is the search's wall time × the today
replica's (paired = in the same process); reach is against the best known (`tables/B-sub.md`,
`tables/B-screen.md`, `tables/B-sym35.md`):

| step | what | evaluations × today | wall | outcome, reach, solids | verdict |
|---|---|---|---|---|---|
| nocov (1) | no covariance in intermediate refinements; the returned fit's once, central | 0.908 (22 runs) | 0.915 paired | every minimum identical to today's | kept: nothing it leaves out was ever read |
| fwd (1)+(2) | forward differences in every refinement (one displaced point a column, the pattern at v reused, backward at an upper bound) | 0.527 (22); 0.525 (77) | 0.593 paired | same outcome 76/77; reach 57/63 (today 55/63); solid changed 2/63; iterations unchanged | kept: the core of the gain |
| central pass (2) | the minimum fwd returns refined once more with central differences; its covariance from that pass | +24 evaluations a run (0.531 against 0.525) | 0.599 against 0.594 | χ² lowered by 0.0003 χ²_ν (median), at most 0.61; no outcome changed | kept, as the user asked |
| fwdH (3) | held frames de-duplicated by `canonical()` modulo the class and the body | −28 a run (0.518) | — | identical by construction | kept: free |
| symA (4) | only the class's distinct low-index starts; no random fill | 0.441 against fwdH's 0.521 (10 runs); −15 % on the 35 runs where a fill exists | — | same outcome 35/35; reach 25/27 as fwd; solids as fwd | kept |
| symC (4) | random starts restricted to the fundamental zone, 20° apart | 0.489 (10 runs) | — | reach 9/10: misses cylinder-Pm-3m-on by 1.1 | rejected: dearer than symA, reaches less |
| fullDrop (4b) | full refinements only from distinct brief ends (8°, e^0.25) | 0.482 against 0.519 (22) | — | reach 21/22; on the 77 every serious loss (box-Pmmm-on Δ 21 → 191 χ²_ν) | rejected |
| fullRep (4b) | the duplicate brief end replaced by the next distinct one | 0.563 (22) | — | reach 22/22 as fwdH | rejected: dearer, no gain |
| fwdB (2') | forward differences in the briefs only | not run | | fwd already reached today's minima with the same iterations | dropped |
| cuts | all of the kept steps and fullDrop | 0.452 (77) | 0.499 × pilot | reach 55/63; solid changed 6/63 | rejected because of fullDrop |

- **(1) No intermediate covariance** cannot change a step: the covariance is made after
  convergence, and only the returned fit's is read. Same minima on 22/22.
- **(2) Forward differences** halve each Jacobian. Iterations a refinement did not change (brief
  7.9 against 7.9; full 11.4 against 11.5; on the 55 other rows full 14.4 against 14.9, held 8.6
  against 9.0). Where the path diverged the fit ended at the same χ² (cylinder-P4mmm-on: 45
  against 32 full iterations).
- **The one changed outcome**: ellipsoid-P4m-on went from held to free. Forward differences
  found a free minimum 11.7 χ²_ν below today's held fit. It is less accurate: the longest extent
  +33 % against +14 %, the axis 4.5° against 0.0°. On exact data the lowest minimum is not always
  the one nearest the truth.
- **The central pass** costs one iteration (44 evaluations median, 28–159) against 18 for the
  covariance alone. Its few moves are free fits in flat valleys where the shift test had
  stopped: 4 runs by more than 0.1 χ²_ν (box-P4mmm-generic 0.61, sqbox-P6mmm-generic 0.25,
  ellipsoid-P-3-generic 0.17, box-Pmmm-on 0.14), none by more than 1; extents by at most 4.5 %
  (spheroid-P2m-on) and under 0.4 % in every other run; axes by at most 1.7°.
- **(3) Held frames.** The refinement is equivariant under the class's rotations, so equivalent
  frames end at the same χ² in the same evaluations (the pilot's 29 repeats, to 0.01). They exist
  only where a rotation of the class maps one candidate frame onto another: 29 of 124 held
  refinements on the 77 runs. The held stage draws no random numbers, so skipping changes
  nothing later. Run for real against derived from flags, 52 rows: 117 364 against 117 372
  evaluations, the 8 in one row. Round 1's dedupe by axis signs would catch 19 of the 29.
- **(4) Symmetry and the starts.** `lowIndexAxes` already gives one axis per Laue family, and a
  plate and a needle along one family are different starts, so no deterministic start is
  equivalent to another. The only redundancy is the random fill to 11 starts, which exists only
  where the class has fewer than 5 low-index families. Dropping it costs nothing measurable with
  the turns held fixed: the best χ² as fwd's in 33/35 runs (the other two ±0.3 χ²_ν). A uniform
  random rotation is already uniform in the zone modulo symmetry, and the deterministic starts
  reach the fill's basins anyway; restricting the fill to the zone (symC) bought nothing.
- **(4b) Full refinements from distinct brief ends.** The 3 best brief ends are often duplicates
  by an 8°/28 % test (52 of 77 runs), and on the pilot's logs 69 of 78 duplicates ended alike.
  Dropping them still costs reach: a brief of 8 iterations is not converged, and ends that close
  can lead to different minima.

### 4.3 The recommended combination on the screening set

Forward differences + no intermediate covariance + the central pass + held frames de-duplicated
+ the class's distinct starts. It ran as symA (fixed random stream, §4.6) in the five classes
whose starts it changes (35 runs) and as fwdH in the six where it changes none (42 runs). All are
real runs. Against today's run in the pilot (`tables/B-screen.md`, variant bestC):

- **Evaluations:** 151 007 against 307 235 (0.492×; median per run 0.499). By part: forward
  differences + no covariance 0.525×; the central pass +0.006×; held dedupe −0.007×; symmetric
  starts −0.032×.
- **Search time:** 42.4 s against 76.9 s a run (54.5 against 98.7 min summed), 0.552×, under the
  heavier load. Against the today replica on the 22 sub-screen runs, from separate processes,
  0.535×; forward differences alone, paired, 0.593×.
- **Outcome:** the same on 76/77, including all 11 spheres (3 kept, 8 rejected) and all 7 early
  rejections. The one change is ellipsoid-P4m-on (§4.2).
- **Reach** (Δ ≤ 1 against the best known): 57/63 against 55/63. Gained box-P4mmm-generic,
  ellcyl-P6m-generic, ellipsoid-P4m-on; lost sqbox-P4mmm-near (Δ 2.7, a free fit beside a held
  result identical to today's).
- **The returned fit's χ²** against today's, in χ²_ν of the best fit: within 0.1 on 54/63 kept
  runs; lower on 6 (ellipsoid-P4m-on −11.68, box-P4mmm-generic −1.19, ellcyl-P6m-generic −1.05,
  sqbox-P6mmm-generic −0.35, box-P6m-generic −0.29, ellipsoid-P-3-generic −0.17); higher on 3
  (box-Pmmm-on +1.81, ellcyl-P-3-on +0.83, ellcyl-P-3m1-near +0.16).
- **Solids changed** (an extent by more than 5 % or the axis by more than 2°): 2 of 63, the same
  two as fwd: ellipsoid-P4m-on, and ellcyl-P-3m1-near, an equivalent minimum with the height on
  another extent (Δ 0.01 against today's 0.03).
- **Accuracy:** worst extent +42 % (+290 %) as today; thinnest +22 % against +20 %; axis 6.8° as
  today.
- **The engine.** The fill's random numbers can still be drawn and thrown away, as here, so that
  the polish and refit turns stay today's.

### 4.4 Per Laue class

Starts today → with the combination; repeated held frames on the 77 fwd runs; evaluations and
wall time × today's (`tables/B-screen.md`):

| class | starts | repeated held frames | forward differences + central pass: evaluations / wall paired / wall × pilot | combination: evaluations / wall × pilot |
|---|---|---|---|---|
| −1 | 11 → 11 | 0 | 0.50 / 0.57 / 0.58 | 0.50 / 0.58 |
| 2/m | 11 → 11 | 0 | 0.50 / 0.52 / 0.56 | 0.50 / 0.55 |
| mmm | 11 → 11 | 0 | 0.52 / 0.63 / 0.59 | 0.52 / 0.59 |
| 4/m | 11 → 11 | 3 | 0.51 / 0.58 / 0.60 | 0.51 / 0.57 |
| 4/mmm | 11 → 11 | 3 | 0.58 / 0.71 / 0.65 | 0.58 / 0.63 |
| −3 | 11 → 11 | 2 | 0.54 / 0.60 / 0.58 | 0.53 / 0.56 |
| −3m | 11 → 9 | 5 | 0.52 / 0.60 / 0.62 | 0.45 / 0.50 |
| 6/m | 11 → 9 | 1 | 0.54 / 0.67 / 0.72 | 0.49 / 0.54 |
| 6/mmm | 11 → 9 | 6 | 0.54 / 0.56 / 0.61 | 0.47 / 0.50 |
| m−3 | 11 → 7 | 5 | 0.57 / 0.69 / 0.61 | 0.43 / 0.44 |
| m−3m | 11 → 7 | 4 | 0.53 / 0.63 / 0.60 | 0.36 / 0.36 |

- **Round 1's halving holds in every class**: 0.50–0.58× the evaluations, 7 runs a class.
  Cubic reproduces round 1 (m−3m 0.53×). Wall time does not halve: 0.56–0.72× against the
  pilot, 0.52–0.71× paired (2 runs a class).
- **The ratio is highest in 4/mmm and m−3**, where trial steps and audits weigh more in a run.
- **Higher symmetry already lowers the distinct starts**: 5 low-index families in the six lower
  classes, 4 in −3m, 6/m, 6/mmm, 3 in cubic. Only there does the combination cut starts, and
  those five classes then run at 0.36–0.49× today's evaluations.
- **Repeated held frames exist only in the eight classes with a 3-, 4- or 6-fold axis.** The held
  stage is small, so the saving is too: 28 evaluations a run.

### 4.5 Why wall time falls less than evaluations

The profile (`prof.mjs`, an engine copy with a timer around `phasePattern` and a flag inside the
Jacobians, no arithmetic change; `tables/B-prof.md`), five pairs on three rows:
- 96–98 % of the search's time is in pattern evaluations;
- an evaluation outside a Jacobian (trial step, FCJ audit, covariance) costs 1.5–2.5× a Jacobian
  column: box-Pm-3-near 20.1 against 13.5 ms, ellcyl-P2m-generic 48.6 against 19.5 ms;
- forward differences halve only the cheap evaluations, so the dear ones become a larger share:
  16 → 27 % (box-Pm-3-near), 6 → 12 % (ellcyl-P2m-generic). At today's per-evaluation costs this
  mix alone raises the mean cost an evaluation by 5–8 %;
- measured, it rose by 4.5–23 % over the five pairs, and the same fwd search of
  ellcyl-P2m-generic took 56.8 s in one profile run and 49.0 s in the other (16 % apart).

The mix accounts for 5–8 of the 12 % by which fwd's paired wall ratio (0.593×) exceeds its
evaluation ratio (0.527×); the rest is within the load noise. Why an evaluation outside a
Jacobian costs more (caches the engine keeps when one parameter moves) was not traced. Under
forward differences those evaluations are the next lever.

### 4.6 The random turn

One seeded stream feeds the random fill and then a 0.02 rad turn about a random axis before
each polish and before the refit. In flat valleys **the turn alone decides which free minimum is
returned**. On cylinder-Pm-3m-on every method refines from the same held fit (16 949.54), and the
refit ends at 16 943.18–16 955.81 depending only on the turn: up to 7.5 χ²_ν of the best fit.
Shifting the stream changed a run's cost by up to 29 % (box-P6m-generic), and moved
sphere-P6mmm-1, kept as a box, by 1.2–2.6 % and 1.7–2.7° against today. Start modes are compared
like for like only with the turns held fixed, which is how symA, symC and cuts now run (§5.2).
The same noise is in today's search: a reach Δ near 1–3 χ²_ν is partly turn noise.

## 5. The verification

A skeptic checked each track from scratch with their own code (`scripts/A/verify/`,
`scripts/B/verify/`). Every problem held; none was rejected. The tracks fixed each at its root and
re-ran what it touched.

### 5.1 Track A

**What the skeptic reproduced.** Among the rest:
- the line alone (`line-errors.mjs --n 200`) and the line in the pattern for lor, lsq and wppm,
  byte for byte;
- refinements re-run (lor, lsq, wppm, the cross-solid fits) to the same χ², evaluations and dims;
  under lsq the spheroid beats the true cylinder-P6m-on by 9999.6 − 9992.4 = 7.2 χ², as claimed;
- every table re-scored from the records: identical;
- **an independent check of the (b) tables** (`indep-line.mjs`: their own Simpson transform of
  A(ξ), TCH typed from Thompson, Cox & Hastings, grid search and Nelder–Mead; no import of A's
  code, the generator or the engine). At 11 shapes it reproduces the lsq (g, l) to 4 decimals and
  the max deviations 2.45–8.00 % of the peak; the Lorentzian reads ⟨L⟩_V 1.131–1.196× the truth.
  The (b) tables are not an inverse crime;
- **their own rival fits** (`methods/rival.mjs`) on spheroid-P-3-near under wppm, from the best
  column-length starts: box 10 009.7, square box 10 012.5, elliptic cylinder 9992.8, against the
  searches' 10 009.7, 10 013.1 and 9990.6. The wppm separations on that row are not search
  failures;
- no validation row among the records; every batch script refuses them.

**What they found, and what was done:**

| | problem | severity | fix | re-run |
|---|---|---|---|---|
| A1 | The costs compared the runs' own walls under different loads: "WPPM 2.2×, 254 s a run", "lsq 99 s against 115". One deterministic lor run (box-P-1-near, iso + search + report) took 131 s or 323 s with the load. | major | Re-timed under one load: the 22 sub-screen rows with every line back to back, CPU time recorded. WPPM 2.88× (−1 3.6×), lsq 0.99×: not cheaper. The old figures are withdrawn. | 88 timing runs |
| A2 | "11/11 in the right family" counted two near ties as right (wppm margins 0.3 and 1.6). | major | Margins (§3.6) and expected margins from noise-free fits to the exact pattern. lsq and wppm both place 9/11 decisively at m = 3; wppm is wrong on none in expectation, lsq on two. | noise-free fits of 3 models |
| A3 | "The exact lines carry information beyond ⟨L⟩_V" rested on Lorentzian data read by a Lorentzian against exact data read by the exact model. By their Cramér–Rao bound (`fisher-line.mjs`: one line, area, width and background free, Poisson noise) the Lorentzian reads ⟨L⟩_V with a σ 1.67–2.86× the exact lines', which alone would explain extent errors about 2× smaller. | major | In-model floors redone like for like, with the ball-line control and two noise draws (§3.7); the isolating test on the 17 near pairs. The verdict on the extents is withdrawn; for telling the families apart the direction-dependent shape is what counts (13× against 1.8×). | 66 truth references, 6 noise-free separations |
| A4 | The per-class anisotropy before/after ("m−3m 0.11 → 0.88", "WPPM about 1 in every class") were medians over kept runs only, so each model on different rows, lor's m−3m on one row. | major | Like for like: common rows, and every clean row on the truth reference; per row WPPM reads 0.70–1.72, 6 of 28 outside 0.9–1.1. | — |
| A5 | lsq's median anisotropy 0.95 hid its spread. | minor | Median \|ln ratio\| reported: lor 0.33, lsq 0.09, wppm 0.02 on the common rows. | — |
| A6 | "mom is a little worse than lsq on every figure" was contradicted by A's own table. | minor | mom's search run (the timing runs); the reason for lsq corrected: its fit, bias, reach and tail, not its extents (§3.8). | 22 runs |
| A7 | lsq's line figures (4.5 %, read 1.000) were in sample. | minor | Read out of sample with other weights: 0.986–1.013 (§3.2). | — |
| A8 | The family test was quoted for the ball only. | minor | The box edge quoted: no spread read at δ 0.2. | — |

### 5.2 Track B

**What the skeptic reproduced.** The today replica bit for bit (two rows in both method orders);
symA on cylinder-Pm-3m-on; the headline sums from the raw records with their own script
(`indep.mjs`: 0.493×, fwd 0.525×, fwdC 0.531×, wall 0.560×, every per-class ratio); that no
deterministic start is equivalent to another; the held dedupe's 29 repeats and 2178 evaluations;
the central pass's moves; iterations unchanged under forward differences (`iters.mjs`); no
validation row. Their wall-time pairing, 4 rows in both orders as concurrent process pairs, gives
fwd/today 0.62 pooled against B's 0.645 on the same rows, with no order bias, but a single row's
paired ratio varies by up to 17 %.

| | problem | severity | fix | re-run |
|---|---|---|---|---|
| B1 | symA and symC shifted the random stream: one stream feeds the fill and the turns before each polish and the refit, so dropping or redrawing the fill changed every later turn. Three results charged to the start cut came from the shift: symA's reach loss on cylinder-Pm-3m-on (Δ 2.6), symC's larger miss, and a third changed solid (sphere-P6mmm-1). | major | `var.mjs`: the fill is drawn as today and thrown away; symC draws its candidates from a copy. symA now equals the skeptic's symAs on its 14 rows; the old modes are kept as symA0, symC0, cuts0 and reproduce their records. symA's reach loss and the third changed solid are gone; symC still misses (Δ 1.1 against 3.7) and stays rejected. | 35 runs, 15 min |
| B2 | The reach bullet's χ² comparison was before the central pass. | minor | Quoted for the returned fit (bestC): 54/63 within 0.1, 6 lower, box-Pmmm-on +1.81; `score.mjs` prints it for every variant. | — |
| B3 | Repeated held frames "3–6 per class" was wrong. | minor | 1–6 per class in 8 classes, none in −1, 2/m, mmm (`heldcls.mjs`). | — |
| B4 | "The mean cost an evaluation rises by 10–20 %" did not match the profiles. | minor | 4.5–23 % measured, 5–8 % from the mix alone, load noise up to 16 % between two runs of one search. | — |

## 6. Next steps for round 2

In the order of `../PROTOCOL.md`, with what tracks A and B change in it:

1. **One engine copy for the rest of the round**: track B's combination with the lsq line, WPPM
   as a switch. Re-check B on both lines on the 22 sub-screen runs before anything builds on it:
   iterations a refinement, reach, the central pass's moves, and whether the random fill buys
   anything under lsq and WPPM. B's mechanisms (the Jacobian halving, equivariant held frames, the
   fill) should carry over; their measured sizes were on lor only.
2. **Make WPPM cheaper, measured as B was**: lsq for the brief trials and WPPM for every full
   refinement and comparison, so the basin is chosen in WPPM (the hybrid failed because its basin
   was chosen in lsq); fewer Fourier nodes; cached member transforms. The target is WPPM's 18 ms
   an evaluation against 6.3. A better few-parameter line (two pseudo-Voigts a member, or a third
   shape parameter in the tables) is the alternative, measured against lsq's two family errors.
3. **Every true minimum refined to the same level, with the two errors** (the protocol's item):
   - on the adopted line, since the line decides the basin;
   - merging symmetry-equivalent and within-resolution duplicates (the canonical form already
     does this for held frames);
   - the local error (curvature for the extents, profile for the angles) kept apart from the
     spread over the true minima within a calibrated Δχ². That spread also absorbs the random
     turn's noise (§4.6): refining every minimum within Δ, rather than the one a turn falls into,
     makes the result independent of the turn;
   - the Δχ² calibrated on tuning rows (round 1's parametric bootstrap).
4. **The solids' reporting rule**: the family, whether a nested member's extra ratio is
   supported, and an explicit "family not determined" when families lie within the margin.
   Calibrate the margin (3–10 χ²/χ²_ν,iso, or a ΔBIC) on tuning rows, with expected margins and
   noise draws as in §3.6.
5. **The per-line χ²_ν flag, always checked, and the jackknife where it fires.** Measure how often
   it fires with and without a model error, on the adopted line. Its targets are known: WPPM's 6
   unbounded extents (texture 3, size distribution 2, impurity 1) and the size-distribution
   sphere kept as a spheroid at ΔBIC −3483.
6. **The keep criterion**: alternatives to ΔBIC < −10, on the 22 tuning spheres with the adopted
   line. lsq and WPPM already remove the two small spheres' false shapes (they were the
   Lorentzian's misfit); the textured sphere and the size-distribution sphere remain.
7. **Confirmation on the 154 tuning runs** of the promoted version, including the cross-solid fits
   with the adopted line on error rows, and the dense reference search for completeness. Then the
   validation, once. At WPPM's present cost the screening set is 179 min CPU; the confirmation is
   twice that unless step 2 or B's halving lowers it.

Two decisions for the user come out of this round:
- **lsq now and WPPM where it matters, or WPPM everywhere once cheaper.** The figures are in §1.
- **Whether a size distribution and texture belong in the model.** The protocol leaves them out as
  model errors; with exact lines a free shape absorbs both (§3.7).

## 7. Files

- `scripts/A/`: track A's scripts. `README.md` (commands, flags, results layout); `make-eng.mjs`
  and `eng.diff` (the engine copy with switchable line models: `FS2A_LINE`, `FS2A_PROFILE`,
  `FS2A_WPPM_BALL`, `FS2A_NOEARLY`); `lines/` (exact lines, tables, line-level checks); `run.mjs`,
  `batch.mjs`, `analyse.mjs` and the readings (`xconf.mjs`, `colmatch.mjs`, `colsep.mjs`,
  `why.mjs`, `perclass.mjs`, `bygroup.mjs`, `nested.mjs`); `fix/` (the fix round: timing,
  margins, separations, floors, anisotropy, mom, out-of-sample line); `verify/` (the skeptic's
  checks).
- `scripts/B/`: track B's scripts. `README.md`; `make-eng.mjs` and `eng.diff` (opt-in `noCov`,
  `covOnly`, `fwd`); `methods/var.mjs` (today's search with the knobs) and `variants.mjs`;
  `run.mjs`, `batch.mjs`, `score.mjs`; `prof.mjs` with `hp/`; the readings of the pilot's records
  (`stages.mjs`, `helddup*.mjs`, `briefdup*.mjs`, `randstarts.mjs`, `axes.mjs`, `heldcls.mjs`);
  `verify/` (the skeptic's checks and symAs).
- `tables/A-lines.md` (§3.2), `A-screen.md` and `A-screen-groups.md` (§3.3, §3.4), `A-aniso.md`,
  `A-cost.md` (§3.5), `A-sub.md` (the sub-screen with every line model, mom's search, hyb, the
  spheres), `A-solids.md` (§3.6, §3.7: confusion, margins, expected margins, the isolating test,
  column lengths), `A-floors.md` (§3.7).
- `tables/B-screen.md` (§4.3, §4.4), `B-sub.md` (§4.1, §4.2), `B-sym35.md` (the start cut on the
  35 runs with a fill), `B-prof.md` (§4.5).
- The run records (one JSON per run: 15 MB for A, 9 MB for B) are in the work folder,
  `$W/fs2/A/results/` and `$W/fs2/B/results/`, not in the repository. `checkpoint/` holds a raw
  copy of the work folder taken while the work ran.
