# Free shape, round 2, step 6 (1): the confirmation on the tuning part

Stage 3 of `../PROTOCOL.md`: the prototype (`proto/engine.patch`, steps 1–5) run at its defaults on the
whole tuning part, 132 truths and 22 spheres (154 runs), against today's search, and each of its tunables
checked on the larger set. A tunable was to change only where the 154 runs showed a clear, explained need.
None did, so none changed; the prototype was frozen (comments and one paragraph of `RIETVELD.md` aside, the
patch is step 5's) before any validation row was drawn. The validation part, scored once on the frozen
version, is `VALIDATION.md`.

All data are synthetic, drawn by round 2's generator (exact lines, Poisson noise), from the tuning part only.
`$W` is the work folder (the session's scratchpad), not in the repository.

## Contents

1. [Summary](#1-summary)
2. [What was run](#2-what-was-run)
3. [The prototype against today's search](#3-the-prototype-against-todays-search)
4. [The start cut](#4-the-start-cut)
5. [Δ* and κ: the two errors](#5-δ-and-κ-the-two-errors)
6. [The per-line check and the jackknife](#6-the-per-line-check-and-the-jackknife)
7. [The keep test](#7-the-keep-test)
8. [The minima stage's cheaper settings, and the family](#8-the-minima-stages-cheaper-settings-and-the-family)
9. [The freeze](#9-the-freeze)
10. [Risks carried into the validation](#10-risks-carried-into-the-validation)
11. [Files](#11-files)

## 1. Summary

**No tunable changed.** Every check below held on the 77 tuning runs the earlier steps had not seen as it had
on the 77 screening runs; the screening rows reproduced steps 4 and 5 exactly. Frozen at 11:02 UTC
(`tables/step6-frozen.md`).

| tunable | checked on the 154 runs | result | verdict |
|---|---|---|---|
| the start cut (`SHAPE_FILL` 0, w0 floor 10⁻³°) | the 10 rows whose isotropic fit read no size, with 4 random starts and with a width floor at the instrument's FWHM | all 10 kept and reached; the fill finds a lower minimum on 1 flagged hump row (46 χ²_ν, further from the truth), the floor gains ≤ 3 χ²_ν on 2 flagged rows | unchanged |
| Δ* 16 / 25, κ 1.2 | coverage of the combined interval on the clean kept truths | 155 of 165 extents (94 %), 59 of 65 principal axes (91 %); Δ* moves the coverage by ≤ 2 extents | unchanged |
| `SHAPE_CHECK.z` 3.09 | false alarms on clean patterns; detections by error kind | 0 of 78 clean (largest z 2.09); 59 of 76 error rows, 25 of 31 spoiled results | unchanged |
| the jackknife (20 groups, 4 iterations) | coverage on the flagged kept truths | 100 of 117 extents (85 %), 41 of 49 axes; the misses texture (7) and size distributions (9) | unchanged |
| the keep test (χ²_{k+1}(0.999) + 2; flagged: also ΔBIC) | the 22 tuning spheres and the 132 truths at the defaults; step 5's 176 mild shapes against the engine's early rejection | no clean sphere kept (0 of 12), 131 of 132 truths kept; the early rejection changes none of the 176 mild shapes' decisions (163 kept) | unchanged |
| `SHAPE_MINIMA.max` 6, `rounds` 10 | max 3 on the 22 rows it can change, rounds 3 on the 5 | max 3: 0.68× their search, −11 % of the whole, but 10 of 46 true minima dropped and 2 intervals lost; rounds 3: −1.5 %, two returned fits 5 and 19 χ²_ν higher | unchanged |
| the family (margins 14 / 35, nested 3.84 / 5.99 / 25) | the 4-search comparison on the 66 tuning truths outside the screening set | clean 18 right / 15 not determined / 0 wrong; with an error 10 / 16 / 7 (the 7 flagged, 37–291 χ²_ν) | unchanged |

**The prototype against today's search on the 154 runs** (`tables/step6-confirm.md`; reach against the best
known on each one's own line):

| | today (v522) | prototype |
|---|---|---|
| truths held / free / rejected (early) | 67 / 55 / 10 (6) | 44 / 87 / 1 (0) |
| truths kept: clean, with an error | 58/66, 64/66 | **66/66, 65/66** |
| spheres keeping a shape: clean, with an error | 2/12, 4/10 | **0/12**, 4/10 |
| reached / judged (Δ ≤ 1) | 117 / 126 | **127 / 132** |
| worst extent, median (90 %); unbounded | +41 % (+278 %); 5 | **+4 % (+179 %)**; 8 |
| thinnest extent; most distinct axis, median (90 %) | +19 %; 6.8° (77.9°) | **+0 %; 1.3° (13.3°)** |
| anisotropy read ÷ true, 58 clean truths both kept: median, median \|ln\|, outside 0.9–1.1 | 0.75, 0.31, 40 | **1.00, 0.017, 10** |
| clean extents within the stated 95 % interval | 39/146 (27 %), today's esds | **155/165 (94 %)** |
| search evaluations; the whole fit's | 612 710; 886 856 | 532 034 (0.87×); 863 227 (0.97×) |
| whole fit's wall, the 77 new rows under one load | 3891 s | 2220 s (0.57×) |

**Shortfalls found** (none a tunable's; §10): three clean truths not reached (Δ 6.5, 59, 131 χ²_ν; random
starts recover two, v522's own fill none); a size distribution or texture still makes a shape of a sphere
(4 of 10 error spheres) and wrong families beyond any margin (7 flagged rows); the jackknife cannot cover
misfit spread over every line; one flagged cubic row's minima stage cost 47 813 evaluations (9 % of all).

## 2. What was run

- **The engine.** `$W/step6-app` is `$W/step5-app` (the patch at step 5). The harness `$W/fs2/step6/h` is
  step 5's with the method `p6` (the search and the card's report kept whole, with the keep test's numbers,
  the family, the minima, the stage's cost and rounds) and three study switches inert when unset
  (`PROTO_FILL`, `PROTO_Y0F`, `FS.min.rmax`). Each run is followed by the truth reference on the same line
  (the solid refined from the truth: the reach's reference). Today's search is the pilot's harness on the
  frozen `b9bef5f` engine; its 77 screening records are the pilot's. Scripts: `scripts/step6/`.
- **Batches.** `batch6.mjs`: nice 15, at most 3 processes, a timeout each, resumable, the job file read again
  as slots free (so variants could be put first); validation rows refused before the freeze.

| tag | what | runs | process time |
|---|---|---|---|
| P | the prototype at its defaults, the 154 tuning runs | 154 | 83 min |
| T | today's search on the 77 tuning runs outside the screening set | 77 | 76 min |
| SC, SF2, SY | the start: 4 random starts, 2 random starts, the width floor at the instrument's FWHM | 13, 2, 12 | 17 min |
| MX, RD | the minima stage with max 3, with rounds 3 (rows a setting can change) | 22, 5 | 17 min |
| FAM | `SHAPE_FAMILY.solids 'general'` on the 66 tuning truths outside the screening set | 66 | 108 min |
| F1, F2 | the frozen engine against P (2 rows) and, with v522's switches, against the pilot (1 row) | 3 | 2 min |

- **Scoring** (`score6.mjs`, `sweep6.mjs`, `cmp6.mjs`, `fam6.mjs`) as steps 1–5 scored: outcome; reach Δ =
  (best exact χ² − the best known)/χ²_ν ≤ 1, the best known over step 6's records of the row's own solid on
  the same line (the run, its truth reference and the variants); accuracy of the kept truths (worst |extent
  error|, +∞ unbounded; the thinnest's signed error; the most distinct axis, modulo the class); the two
  errors' intervals as step 4's (`lib6.mjs`), and the engine's own reported `lo`–`hi` (equal to the offline
  J on every extent); "spoiled" as step 3's (an extent beyond 25 % or unbounded, the axis beyond 10°, a
  sphere kept).

## 3. The prototype against today's search

The table of §1 holds the totals; per row in `tables/step6-confirm.md`.

- **Outcome.** The prototype keeps 131 of 132 truths (today 122); the one it rejects, box-P-3m1-generic
  (11.3 × 15.2 × 15.3 nm, air 0.74), passes the class's need (G 22.8 against 16.1) but its fit is flagged
  and ΔBIC is +23; today rejects it too. It keeps none of the 12 clean spheres (today 2: sphere-Pmmm-1 and
  sphere-P-3-1, 3.4 and 2.5 nm). It returns 87 free and 44 held fits against today's 55 and 67: with the
  exact line the free orientation more often beats the lattice frame by its 95 % χ².
- **Reach.** 127 of 132 against 117 of 126 (today's six early rejections are not judged). The prototype's
  five: two flagged error rows (cylinder-Pm-3m-on, 1514 χ²_ν, step 1's unbounded disc; ellcyl-Pmmm-near,
  46, where 4 random starts found a lower and worse minimum) and three clean truths, §4.
- **Accuracy.** On the 58 clean truths both keep: worst +38 % → +1 %, thinnest +21 % → +0 %, axis
  6.8° → 0.5°, anisotropy 0.75 → 1.00. On the 64 error truths both keep: worst +43 % → +13 %, axis
  7.0° → 3.0°, unbounded extents 4 → 8 (on 8 rows, 6 of them flagged; step 2's reading: the exact line
  takes a model error as shape more readily).
- **The two halves agree.** On the 77 screening runs the clean intervals (78 of 82), the flagged jackknife
  (51 of 56) and the check's catches are steps 3 and 4's to the digit; 64 of 66 reached (against step 6's own
  references), worst +4 %. On the 77 others: 63 of 66 reached, worst +4 % (90 %: +144 %), thinnest −0 %,
  axis 1.3°, anisotropy 1.00 (median |ln| 0.009).
- **Cost.** Search evaluations 0.87× today's (per run median 0.64×; the minima stage is 0.89× the rest of
  the search); the whole fit's evaluations 0.97× (the report and its jackknife cost more: 254 737 against
  201 554). An evaluation costs less (4.4 ms against 10.4, median), so on the 77 new rows, both run under one
  load here, the whole fit took 0.57× today's wall. By class the search is 0.57–0.98× today's except m−3m
  (2.16×): today rejects four cubic truths early there, and one flagged ellipsoid (ellipsoid-Pm-3m-generic,
  a size distribution of 0.77) spent 47 813 evaluations in the minima stage, five candidates at a symmetric
  orientation where every turn is tried (§8.1).

## 4. The start cut

v2 starts from the class's distinct starts alone. Where the isotropic fit reads no size (Y_s = 0) they sit
at w0's floor (10⁻³°, an 8 µm body), where step 1 had lost a shape under the lsq line.

| 10 rows at the floor (4 clean, 6 with an error) | outcome changed | returned χ² lower (> 0.1 χ²_ν) | extents and axes covered | search evaluations |
|---|---|---|---|---|
| P (defaults) | — | — | 34 of 37 | 44 923 |
| SC: 4 random starts (`SHAPE_FILL` 4) | 0 | 1: ellcyl-Pmmm-near (hump 0.67, flagged), −45.9, worst +7 % → +65 % | 33 | 1.01× |
| SY: the width floored at the instrument's FWHM at mid-range | 0 | 2 (flagged): −0.4, −3.1 | 35 | 0.87× |

- **No shape is lost.** Under the exact line all 10 are kept; 9 reach their truth reference (the tenth,
  ellcyl-Pmmm-near, a flagged hump row, ends 3.0 χ²_ν above it). Three of the four clean ones read their
  extents within 1 %; box-P-3m1-near (14 × 30 × 60 nm) reads its 60 nm edge 175 nm, as step 4 found, a
  matter of resolution, not of the start. Step 1's loss was the lsq line's: its Gaussian part has no slope
  at a small width; WPPM's has.
- **The variants buy nothing clear**: the fill's one gain is a lower minimum on a flagged hump row that
  reads the solid worse; the floor's gains are within the flagged rows' misfit. Unchanged: `SHAPE_FILL` 0,
  floor 10⁻³°.
- **The clean truths not reached** are not floor rows. sqbox-P6m-generic (Δ 59: the square's turn about
  its axis), ellcyl-P6m-on (Δ 131: a 10 × 2.4 × 58 nm minimum where the truth is 2.5 × 27 × 8.7) and
  sqbox-Pmmm-generic (Δ 6.5, step 4's). Four random starts recover the first and the third, not the second;
  two (v522's fill in 6/m, from 9 to 11 starts) recover neither, and Pmmm had no fill in v522. So the start
  cut did not lose them: v522's own fill would not have found them either. A larger fill is a new search
  setting with its own cost (1.05× on these 13 rows) and a lottery's gains; it was not tried on all 154
  rows and is left to a later round (§10).

## 5. Δ* and κ: the two errors

`tables/step6-tunables.md` (sweep6.mjs) holds the grid; the clean kept truths, not flagged (66):

| Δ* (flagged 25), κ | extents covered C | median half-width | principal axes, κ_angle 1 / 1.2 / 1.5 | unique | unique and covered |
|---|---|---|---|---|---|
| 12.5, 1.2 | 155/165 (94 %) | 2.9 % | 59 / 61 / 62 of 65 | 46 | 40 |
| **16, 1.2 (frozen)** | **155/165 (94 %)** | **2.9 %** | **59** / 61 / 62 of 65 | **45** | **39** |
| 20, 1.2 | 155/165 (94 %) | 2.9 % | 59 / 61 / 62 | 42 | 36 |
| 16, 1.0 | 150/165 (91 %) | 2.4 % | 59 | 45 | 36 |
| 16, 1.3 | 157/165 (95 %) | 3.2 % | 59 | 45 | 40 |
| 16, 1.5 | 159/165 (96 %) | 3.6 % | 59 | 45 | 40 |

- **κ 1.2 holds.** 155 of 165 (94 %; 95 % would be 156.8, one binomial sd 2.8). The local z on these extents
  has median |z| 0.69 (normal 0.67) and rms 1.14 below 5 (step 4: 1.21), so the factor the clean rows ask is
  1.1–1.2. On the screening half 78 of 82, on the other 77 of 83 (93 %).
- **The ten misses** are two rows in other minima (ellcyl-P6m-on, 3 extents, the unreached one of §4;
  ellcyl-Pm-3m-generic, 2, step 4's) and five near misses: four of 2–4 % at 2.2–3.2 σ and one of 13 % at
  2.8 σ (spheroid-Pm-3-on, 366 counts). κ 1.3 adds two (95 %) for 10 % more width; not a clear need.
- **The axes.** 59 of 65 (91 %; 29 of 32 and 30 of 33 in the halves). The misses: box-P6m-generic (12.6°
  against a radius of 12.1°, step 4's), spheroid-Pm-3-generic (6.0° against 3.9°, step 4's), spheroid-Pm-3-on
  (15.8° against 13.8°, 366 counts), ellcyl-P6m-on (another minimum), two at 0.5–0.9° against 0.5–0.7°.
  Scaling the profile's angle by 1.2 adds two (94 %); one-sided, 1.6 sd under 95 %, and step 4 left the
  angles unscaled on the same reading: unchanged.
- **Δ* moves the coverage by at most two extents** (step 4: the same) and sets the uniqueness verdict: 45 of
  66 clean shapes unique at 16, 39 of them covered by the local error alone. Of the 21 with several minima the
  local error covers 14, the second error adds 5, 2 stay uncovered.
- **Other rows.** Error rows not flagged (16): 26 of 37 extents (70 %), 12 of 16 axes; κ cannot reach them
  (1.5 gives 30). Flagged rows: §6.

## 6. The per-line check and the jackknife

| P, 154 runs | rows | flagged | spoiled | spoiled and flagged | z (worst statistic): median / max |
|---|---|---|---|---|---|
| clean truths | 66 | **0** | 9 | 0 | 0.48 / 2.09 |
| clean spheres | 12 | **0** | 0 | 0 | 0.00 / 1.01 |
| hump | 15 | 14 | 3 | 3 | 22 / 274 |
| size distribution | 16 | 10 | 10 | 8 | 5.6 / 72 |
| impurity | 16 | 16 | 2 | 2 | 44 / 292 |
| air | 15 | 7 | 4 | 1 | 2.8 / 53 |
| texture | 14 | 12 | 12 | 11 | 19 / 144 |
| all with an error | 76 | 59 | 31 | 25 | 14 / 292 |

- **No false alarm** on 78 clean patterns (nominal 0.2 % a pattern: 0.16 expected); the largest z is 2.09
  and 2.06 in the two halves.
- **Detections.** 29 of 38 error rows on the screening half (step 3's), 30 of 38 on the other; humps and
  impurities nearly always, air at about half (the background takes much of it up), texture 12 of 14.
- **Spoiled results caught: 25 of 31** (14 of 15, 11 of 16). The new misses: air at 0.00 and 0.27 and
  texture at 0.05, errors too weak to matter, on rows spoiled as clean ones can be; air at 0.89 taken up by
  the background; and a sphere with a size distribution of 0.95 kept as an ellipsoid (G 482) with no misfit
  left. The 9 clean truths "spoiled" are the
  design's hard rows (an unresolved longest extent, another minimum), not the check's.
- **z stays at 3.09**: no false alarm to remove, and the misses are not near the threshold.

**The jackknife** (flagged kept truths, 49):

| | extents covered | axes covered | median half-width |
|---|---|---|---|
| C (κ local and the minima) | 58/117 (50 %) | 26/49 | 3.8 % |
| **J, with the jackknife (frozen)** | **100/117 (85 %)** | **41/49** | 15.8 % |
| J on the screening half / the other | 51/56 / 49/61 | 21/24 / 20/25 | 18.7 / 11.1 % |

- **What it misses is step 3's**: 16 of the 17 extents it leaves uncovered are texture (7) and size
  distributions (9), whose misfit is spread over every line, so no line's removal moves the fit; one is a
  hump (6 % at a half-width of 6 %). Impurities (34 extents) and air (10) are covered whole.
- **Unchanged** (20 groups, 4 iterations): more groups or iterations cannot widen what no line carries.
  `retest` stays off (not part of the frozen prototype).

## 7. The keep test

- **The 22 tuning spheres at the defaults.** The clean ones: 11 rejected early (brief gains ≤ 6.0, needs
  13.2–24.7) and one rejected after the full search, sphere-P-1-2 (28.8 nm, 21 164 counts, G 21.1 against
  24.7, step 5's triclinic tail). With an error: 4 kept, all far beyond any threshold and 3 of them flagged
  (a hump on a 2.1 nm sphere G 438; size distributions G 482 and 3511; texture G 387), as step 5 found;
  today keeps 4 of the 10 error spheres as well (two of them the same) and 2 clean ones.
- **The 132 truths.** 131 kept; the one rejection is the flagged rule's (box-P-3m1-generic, §3), which today
  shares.
- **The mild shapes.** Step 5 read its 176 mild shapes (anisotropy 1.02–1.6, the tuning truths outside the
  screening set pulled towards a sphere) with the early rejection off. Its records give each one's brief
  gain: none falls under half its need where the rule keeps it, so the engine's defaults decide every one as
  step 5 counted (78 of 86 clean, 85 of 90 with an error; ΔBIC 71 and 81). The same holds for its 660 null
  runs (138 kept, all with an error). No re-run was needed.
- **Unchanged**: χ²_{k+1}(0.999) + 2, flagged also ΔBIC < −10, early 0.5.

## 8. The minima stage's cheaper settings, and the family

### 8.1 max 3 and rounds 3

Run only on the rows a setting can change (P's records: the stage took more than 3 candidates on 22 rows;
a minimum entered a fourth round on 5, a tenth on none: rounds entered 1 on 112 runs, 2 on 18, 4–9 on 5).

| | rows | search evaluations on them | of the whole (154) | outcome changed | returned χ² higher (χ²_ν) | true minima within Δ* | extents and axes covered |
|---|---|---|---|---|---|---|---|
| max 3 | 22 | 0.68× | −11.0 % | 0 | 1 (+0.39, box-P-3m1-near, clean) | 46 → 36 | 72 → 70 of 78 |
| rounds 3 | 5 | 0.77× | −1.5 % | 0 | 2 (+19.5 cylinder-Pm-3m-on, +4.9 ellcyl-Pmmm-near; flagged) | 5 → 6 | 13 → 13 of 14 |

- **Not adopted.** max 3 saves a tenth of the search by dropping a fifth of the true minima within Δ* on
  the rows that have them (the stage's purpose, `PROTOCOL.md`: every true minimum refined to the same level)
  and two covered intervals; a third of its saving is one row. rounds 3 saves 1.5 % and returns two flagged
  fits that further rounds lowered.
- **The cost's tail** is ellipsoid-Pm-3m-generic: five candidates at a symmetric orientation, every turn tried,
  each refinement long under a size distribution of 0.77: 47 813 evaluations in the stage (125 s), 28 538 with
  max 3. A cap on the stage's evaluations would be a new tunable; it is left as a risk (§10).

### 8.2 The family

The 4-search comparison (`solids: 'general'`: the chosen solid's nested partner and the three general
members) on the 66 tuning truths outside the screening set; step 5 set the margins on the screening ones.

| 66 truths | right | not determined (truth among those named) | wrong |
|---|---|---|---|
| clean (33) | **18** | 15 (15) | **0** |
| with an error (33) | 10 | 16 (16) | 7 |
| step 5, the 66 screening truths: clean / error | 19 / 7 | 14 / 23 | 0 / 3 |

- **The margins hold on clean rows**: no clean truth given a wrong family in 132 (both halves). Not
  determined is honest: the truth is among the families named on all 31.
- **Errors make wrong families beyond any margin.** The 7 are all flagged (the 35 margin applied): size
  distributions (3), texture (3), a hump; by 37–291 χ²_ν, all but one far beyond 35. A margin cannot remove
  them (step 5's reading).
- **Nested.** In the winning family when it is the truth's (45): special truths given the special member 20
  of 23 (the other three with an error: texture 0.98, a size distribution, texture 0.05); general truths given
  the general 17 of 22; of the five given the special, four at Δ 1.3–4.2 and one flagged at 21.4 (against 25): there the
  data do not support the extra width.
- **Cost** 4.16× the chosen solid's search evaluations (median 5.1×), 4.4× its wall; the chosen solid's χ²
  equal to its own run's on 66 of 66. Unchanged.

## 9. The freeze

- **What changed in the patch:** nothing that runs. The tunables' block comment says they were confirmed and
  frozen; `retest`'s comment says it is not part of the frozen prototype; `RIETVELD.md` §10.8 gains a
  paragraph "Frozen". `proto/engine.patch` regenerated against `9782d33` (applies cleanly to the branch's
  HEAD); `proto/README.md` gains verification 9.
- **Checks.** The frozen engine equals P to the bit on 2 rows (the isotropic fit, the search's, the stage's
  and the report's evaluations, χ², dimensions, intervals, truth reference); with v522's switches it equals
  the pilot's record of sqbox-P4m-on to the bit. `npm run lint`: clean. The engine's tests (rietveld,
  rvmodel, rvpool, rvsplit, rvlock, rvcif, rvui, smoke, widths, modules): 53 of 53 pass.
- **Written down before any validation row was drawn:** `tables/step6-frozen.md` and `$W/fs2/step6/FROZEN.json`
  (the tunables as the engine read them, the engine files' sha256). The harness refuses a validation row
  unless that file exists and its engine copy matches the hashes.
- **The frozen tunables**: `SHAPE_MODE` { line 'exact', search 'v2' }; `WPPM_OPT` all on; `SHAPE_FILL` 0;
  `SHAPE_CENTRAL` true; `SHAPE_FWD` 'briefs'; `SHAPE_CHECK` { z 3.09, bin 1°, minsep 0.3°, jack, groups 20,
  iter 4, retest off }; `SHAPE_MINIMA` { collect 30, max 6, kick 0.02, rounds 10, gain 0.5, k 2, floors 0.02
  and 1°, cap 10°, Δ* 16 / 25, keep 30, κ 1.2 }; `SHAPE_KEEP` { 'lrt', alpha 0.001, margin 2, misfit, bic 10,
  early 0.5 }; `SHAPE_FAMILY` { 'none', margins 14 / 35, nest 3.84 / 5.99 / 5.99, nestMisfit 25 }.

## 10. Risks carried into the validation

- **Search misses on clean rows.** 3 of 66 clean truths end in a minimum 6.5–131 χ²_ν above the truth
  reference's, two in 6/m. The minima stage cannot refine a minimum no end falls into. Random starts help
  by chance; a measured remedy (a fill, or starts along the truth-like turns of a square section) belongs to a
  later round with its own tuning.
- **Model errors.** A size distribution or texture still keeps a shape on a sphere (4 of 10 error spheres),
  names a wrong family beyond any margin (7 flagged rows) and escapes the jackknife (16 of 17 misses).
  These need the error in the model, not a threshold.
- **Few rows a cell.** The axes' coverage (91 %) and the clean extents' (94 %) sit 1–1.6 sd under 95 %;
  the validation's 33 clean truths will measure them with a binomial sd of about 4 %.
- **The stage's cost tail** at symmetric orientations under a model error (one row 9 % of the search).
- **The truth references are the reach's yardstick.** The best known is over step 6's own records; on the
  screening rows steps 1–5's records (the dense reference among them) are not pooled, so the reach is a
  little more lenient than step 4's completeness.

## 11. Files

- `CONFIRM.md`: this note. `tables/step6-confirm.md`: the comparison per row (154). `tables/step6-tunables.md`:
  the Δ*/κ grid, the variants row by row (SC, SF2, SY, MX, RD), the family per row.
  `tables/step6-frozen.md`: the frozen tunables.
- `proto/engine.patch`, `proto/README.md`: the frozen prototype, verification 9.
- `scripts/step6/` with its `README.md`: `setup.sh`, `batch6.mjs`, `h/run.mjs`, `h/make-eng.mjs`,
  `h/methods/p6.mjs`, `lib6.mjs`, `score6.mjs`, `sweep6.mjs`, `variants6.mjs`, `cmp6.mjs`, `fam6.mjs`,
  `freeze6.mjs`, `frozen-md.mjs`, the job files.
- Not in the repository (`$W`): the records (`fs2/step6/results/`), `FROZEN.json`, the engine copy and the
  app copies `$W/step6-app`, `$W/step6-gitbase`.
