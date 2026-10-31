# Free shape, round 2, step 6 (2): the validation part, scored once

Stage 4 of `../PROTOCOL.md`: the frozen prototype (`CONFIRM.md` §9, `tables/step6-frozen.md`) and today's
search on the 77 validation runs, 66 truths and 11 spheres, drawn now for the first time (their patterns were
never made before). Scored exactly as the confirmation scored the 154 tuning runs, against today's search.
Nothing was changed after the results were seen; the shortfalls are reported as found (§9). The validation
set is therefore not spent: it was scored once, on the final version.

All data are synthetic, drawn by round 2's generator (exact lines, Poisson noise). `$W` is the work folder
(the session's scratchpad), not in the repository.

## Contents

1. [Summary](#1-summary)
2. [What was run](#2-what-was-run)
3. [Outcome, reach, accuracy, cost](#3-outcome-reach-accuracy-cost)
4. [The two errors](#4-the-two-errors)
5. [Uniqueness](#5-uniqueness)
6. [The per-line check and the jackknife](#6-the-per-line-check-and-the-jackknife)
7. [The keep test](#7-the-keep-test)
8. [The family](#8-the-family)
9. [Shortfalls](#9-shortfalls)
10. [Files](#10-files)

## 1. Summary

| 77 validation runs | today (v522) | frozen prototype |
|---|---|---|
| truths held / free / rejected (early) | 40 / 21 / 5 (3) | 23 / 42 / 1 (1) |
| truths kept: clean, with an error | 30/33, 31/33 | **32/33, 33/33** |
| spheres keeping a shape: clean, with an error | 2/5, 3/6 | **0/5, 2/6** |
| reached / judged (Δ ≤ 1, each on its own line) | 62 / 63 | **64 / 65** |
| worst extent, median (90 %); unbounded | +29 % (+111 %); 2 | **+2 %** (+256 %); 6 |
| thinnest extent; most distinct axis, median (90 %) | +19 %; 6.1° (34.2°) | **−0 %; 1.5° (14.6°)** |
| anisotropy read ÷ true, 30 clean truths both kept: median, median \|ln\|, outside 0.9–1.1 | 0.77, 0.35, 20 | **1.00, 0.009, 3** |
| clean extents within the stated 95 % interval | 17/76 (22 %), today's esds | **80/80 (100 %)**, median half-width 2.3 % |
| clean principal axes within it | 13/30 | 27/32 (84 %) |
| search evaluations; the whole fit's | 327 537; 469 399 | **244 121 (0.75×); 401 264 (0.85×)** |
| whole fit's wall, one load | 4098 s | **2164 s (0.53×)** |

Against what the confirmation measured on the tuning part (`CONFIRM.md`):

| figure | tuning part (154) | validation (77) | reading |
|---|---|---|---|
| clean extents covered (combined interval) | 155/165 (94 %) | 80/80 (100 %) | held (together 235/245, 96 %) |
| clean principal axes covered | 59/65 (91 %) | 27/32 (84 %) | **short** (together 86/97, 89 %) |
| clean shapes unique, the local error covering | 39 of 45 | 22 of 26 (+1 flagged, covered) | held |
| false alarms of the check on clean patterns | 0/78 | 1/38 (z 3.14) | within the nominal 0.2 % (0.23 expected over 116) |
| error rows flagged; spoiled results caught | 59/76; 25/31 | 28/39; 13/18 | held |
| the jackknife, flagged kept truths: extents, axes | 100/117 (85 %), 41/49 | 50/56 (89 %), 24/24 | held |
| clean spheres kept; error spheres kept | 0/12; 4/10 | 0/5; 2/6 | held |
| truths kept | 131/132 | 65/66 | held |
| reach | 127/132 | 64/65 | held |
| family: clean truths given a wrong family | 0/33 (and 0/33 in step 5) | 0/33 | held |

**What it shows.** On data it never saw, the frozen prototype keeps the real shapes (65 of 66; the one
rejected holds no shape the data support), keeps no clean sphere, reads the clean solids within 1 % (worst
extent, median) and their anisotropy at 1.00, states extents' intervals that hold, reaches as often as today,
and costs 0.85× today's evaluations and 0.53× its wall. Today's search, on the same rows, reads the extents
29 % long (worst, median), the anisotropy at 0.77, and its esds cover 22 % of the clean extents.
**Shortfalls** (§9): the angles' intervals cover 84 % of the clean axes; size distributions remain the
prototype's blind spot (an unflagged false shape on a sphere, 4 of the 5 spoiled error rows the check missed,
4 of the 6 extents the jackknife left out, 6 unbounded extents with an error); and three flagged error rows given a wrong family by 64–147 χ²_ν.

## 2. What was run

- **The engine** is the frozen one: the harness's copy was checked against `FROZEN.json`'s hashes by every
  validation run (`h/run.mjs` refuses a validation row otherwise). Each run is followed by its truth
  reference on the same line. Today's search is the pilot's harness on the frozen `b9bef5f` engine.
- **The rows**: the design's 66 validation truths (one per solid × Laue cell, the orientation rotating
  over the cells) and 11 spheres, drawn in memory by the generator from their design rows.

| tag | what | runs | process time |
|---|---|---|---|
| VP | the frozen prototype at its defaults | 77 | 40 min |
| VT | today's search | 77 | 79 min |
| VFAM | `SHAPE_FAMILY.solids 'general'` (the 4-search comparison) on the 66 truths | 66 | 109 min |

- **Scoring** is the confirmation's (`score6.mjs --part validation --p VP --t VT`, `fam6.mjs`): reach against
  the best known of each line over the run and its truth reference (no variants were run here, so the best
  known is the two); the rest as `CONFIRM.md` §2. Per row: `tables/step6-validation.md`.

## 3. Outcome, reach, accuracy, cost

- **Outcome.** The prototype keeps 65 of 66 truths (today 61). The one it rejects, spheroid-P4mmm-generic
  (7.9 × 7.9 × 7.7 nm, clean, 2831 counts), stops at the brief trials (gain 2.3 against a need of 16.1);
  its truth reference gains 2.3 as well, so the data hold no shape to keep, and today rejects it early too.
  It returns 42 free and 23 held fits against today's 21 and 40, as on the tuning part.
- **Reach.** 64 of 65 judged; the miss is sqbox-P4m-generic (a size distribution of 0.08), 2.0 χ²_ν above
  its truth reference. Every clean truth is reached. Today: 62 of 63, ellcyl-P4m-on 31 χ²_ν short.
- **Accuracy.** On the 30 clean truths both keep: worst +28 % → +1 % (90 %: +108 % → +6 %), thinnest
  +21 % → −0 %, axis 4.4° → 0.2°, anisotropy 0.77 → 1.00 (3 of 30 outside 0.9–1.1 against 20). On the 31
  error truths both keep: worst +35 % → +9 %, thinnest +18 % → +0 %, axis 8.3° → 3.2°; the 90th percentile
  is +∞ for the prototype: 6 unbounded extents (today 2), 5 of them on flagged rows (texture 3, a size
  distribution, an impurity) and one not (box-P6m-near, a size distribution of 0.42).
- **Cost.** Search evaluations 0.75× today's (per run median 0.56×), the minima stage 0.85× the rest of the
  search; with the report and its jackknife (121 459 against 108 164) and the isotropic fit, 0.85× the whole
  fit's evaluations. An evaluation costs 4.2 ms against 6.3 (median), so the whole fit took 0.53× today's
  wall (both parts run three at a time here). By class the search is 0.40–0.90× today's except 4/m (1.20)
  and −3m (1.30); the largest stage is a flagged hump row's (ellipsoid-P-3m1-generic: 18 652 of its 20 773
  search evaluations), the cost tail `CONFIRM.md` §8.1 found.

## 4. The two errors

| kept truths, the frozen intervals | runs | extents (unbounded) | local κ 1.2 | with the minima (C) | with the jackknife (J) = reported `lo`–`hi` | median half-width L / C / J | principal axes L / C / J of | median radius L / C / J |
|---|---|---|---|---|---|---|---|---|
| clean | 31 | 78 (0) | 78 (100 %) | 78 | 78 (100 %) | 2.2 / 2.2 / 2.2 % | 25 / 26 / 26 of 31 | 1.5 / 1.9 / 1.9° |
| clean, flagged | 1 | 2 | 2 | 2 | 2 | 2.2 / 2.2 / 2.4 % | 1 / 1 / 1 of 1 | 4.5 / 4.5 / 13.0° |
| error, not flagged | 9 | 21 (1) | 18 | 18 (86 %) | 18 (86 %) | 5.8 / 9.8 / 9.8 % | 5 / 5 / 5 of 9 | 4.1 / 8.6 / 8.6° |
| error, flagged | 24 | 56 (5) | 30 | 33 (59 %) | **50 (89 %)** | 2.5 / 3.2 / 13.4 % | 11 / 16 / **24** of 24 | 2.0 / 7.3 / 15.0° |
| all kept | 65 | 157 (6) | 128 | 131 | 148 (94 %) | 2.4 / 2.9 / 4.1 % | 42 / 48 / 56 of 65 | 2.5 / 3.6 / 5.0° |
| today's esds (κ 1), clean / error | 30 / 31 | 76 / 76 (2) | 17 (22 %) / 19 (25 %) | — | — | 4.6 / 7.8 % | 13 of 30 / 14 of 31 | 2.7 / 4.0° |

- **The extents' interval holds**, and here with room: 80 of 80 clean extents, the local z median |z| 0.68
  and rms 0.99 (tuning: 1.14), so κ 1.2 is on the safe side on these rows. Together with the tuning part 235
  of 245 (96 %).
- **The axes' does not quite.** 27 of 32 clean principal axes (84 %; one binomial sd under 95 % is 3.9 %, so
  2.8 sd short). The five misses are well-determined fits read 1.1–1.9 times their stated radius: box-P-3-generic
  (4.9° against 2.8°, 333 counts), sqbox-Pmmm-near (2.9° against 1.5°), cylinder-Pm-3-near (3.0° against
  1.9°), ellcyl-P4mmm-near (4.4° against 3.7°), box-P6mmm-generic (1.6° against 1.4°, two minima). Four are
  unique minima, so the radius is the profile's 2·esdAngle alone, which step 4 left unscaled. The tuning part
  was 1.6 sd short on the same reading (91 %); together 86 of 97 (89 %). A factor of about 2 on the angles'
  profile would cover all five; it is not applied, since changing it now would spend the validation set.
- **The error rows** behave as on the tuning part: where the check fires the jackknife takes the extents from
  59 % to 89 % and the axes to 24 of 24; error rows the check misses keep 86 % of their extents.

## 5. Uniqueness

| kept truths (Δ* 16 / 25) | unique | unique, the local error covering | several | several: local covers | only both | neither | with the jackknife: unique / several covered |
|---|---|---|---|---|---|---|---|
| clean | 26/31 | 22 | 5 | 3 | 1 | 1 | 22/26 / 4/5 |
| clean, flagged | 1/1 | 1 | 0 | — | — | — | 1/1 |
| error, not flagged | 5/9 | 2 | 4 | 3 | 0 | 1 | 2/5 / 3/4 |
| error, flagged | 14/24 | 5 | 10 | 2 | 1 | 7 | 12/14 / 7/10 |

- "Unique" on a clean row is right on 22 of 26 (tuning: 39 of 45); the four misses are the four unique axis
  misses of §4, their extents all covered.

## 6. The per-line check and the jackknife

| VP, 77 runs | rows | flagged | spoiled | spoiled and flagged | z (worst statistic): median / max |
|---|---|---|---|---|---|
| clean truths | 33 | 1 | 2 | 0 | 0.18 / 3.14 |
| clean spheres | 5 | 0 | 0 | 0 | 1.29 / 2.08 |
| hump | 9 | 7 | 3 | 2 | 21 / 234 |
| size distribution | 7 | 3 | 6 | 2 | 0.98 / 10.0 |
| impurity | 7 | 7 | 2 | 2 | 75 / 154 |
| air | 8 | 5 | 2 | 2 | 5.1 / 88 |
| texture | 8 | 6 | 5 | 5 | 18 / 295 |
| all with an error | 39 | 28 | 18 | 13 | 8.7 / 295 |

- **One false alarm**: spheroid-Pm-3-near (clean, 16 × 16 × 8.9 nm), its worst segment at z 3.14 against
  3.09. At the nominal 0.2 % a pattern, 116 clean patterns over both parts expect 0.23; one is consistent with
  it. Its cost: Δ* 25 and the jackknife (its intervals widened from 2.2 to 2.4 %, its axis radius to 13°); the shape is kept (ΔBIC −437) and its extents and axis covered.
- **Detections**: 28 of 39 error rows; humps, impurities and texture nearly always, air 5 of 8, size
  distributions 3 of 7.
- **Spoiled results caught: 13 of 18** (tuning: 25 of 31). Missed: four size distributions (0.08, 0.41 on a
  sphere kept with a shape, 0.42, 0.96) and a hump of 0.36; the two clean spoiled rows are not the check's.
- **The jackknife** misses 6 of 56 extents: size distributions (4, on three rows), texture (1: cylinder-P4m-near, an
  11 × 40 nm needle read as a 54 × 5.9 nm disc), a hump (2 % at a half-width of 2 %). As on the
  tuning part, misfit spread over every line is out of its reach.

## 7. The keep test

| shapes kept | rows | today | prototype |
|---|---|---|---|
| clean truths | 33 | 30 | **32** |
| truths with an error | 33 | 31 | **33** |
| clean spheres | 5 | 2 | **0** |
| spheres with an error | 6 | 3 | 2 |

- **No clean sphere kept** (today keeps a 2.3 nm and a 3.1 nm one). All five clean spheres stop at the
  brief trials; the largest brief gain is 3.4 against 13.2 (sphere-Pm-3m-2, 17.6 nm).
- **Error spheres kept**: sphere-P-1-1 (texture 0.77 on a 2.7 nm sphere, G 3489, flagged; today keeps it too)
  and sphere-P4mmm-2 (a size distribution of 0.41 on 13.8 nm, G 78 against 16.1, **not flagged**; today
  rejects it). The flagged rule rejected sphere-P6m-2 (a hump, G 20.0 above its 16.1, ΔBIC not under −10).
- **Real shapes kept**: 65 of 66 against 61; the one rejected is §3's near-sphere (anisotropy 1.03).

## 8. The family

The 4-search comparison (`solids: 'general'`) on the 66 validation truths, the frozen margins
(`tables/step6-family-val.md`):

| 66 truths | right | not determined (truth among those named) | wrong |
|---|---|---|---|
| clean (33) | **22** | 11 (11) | **0** |
| with an error (33) | 9 | 21 (21) | 3 |
| the tuning part, clean / error (step 5 and `CONFIRM.md`, 132) | 37 / 17 | 29 / 39 | 0 / 10 |

- **No clean truth is given a wrong family** (0 of 33; 0 of 99 clean truths over the three sets), and
  "not determined" always names the truth's family among those within the margin (32 of 32).
- **The three wrong verdicts are flagged error rows**, by 64–147 χ²_ν against the 35 the flag asks: a hump
  of 0.71 makes a cylinder a box, a size distribution of 0.31 a cylinder a ball, texture of 0.61 an ellipsoid
  a cylinder. As on the tuning part (10 of 66 error truths), a model error moves the family beyond any margin
  the noise sets.
- **Nested.** Where the winner is the truth's family (57): on the clean rows every one is right (special
  truths the special member 17 of 17, general truths the general 15 of 15). The seven exceptions are error
  rows: two special truths given the general member (texture 0.67, Δ 520; an impurity of 0.09, Δ 28.1 against
  25) and five general truths given the special one (Δ −0.0 to 22.6, each under its need: a hump, texture,
  a size distribution, air).
- **Cost** 4.75× the chosen solid's search evaluations (median 5.2×), 4.8× its wall; the chosen solid's χ²
  equal to its own run's on 66 of 66.

## 9. Shortfalls

Reported as found; nothing was changed after the results were seen.

1. **The angles' intervals are too narrow on unique fits**: 27 of 32 clean principal axes (84 %), 86 of 97
   over both parts. The profile's 2·esdAngle alone under-states a well-determined axis by up to 1.9×.
   To fix in a later round (a factor on the angles, set on tuning rows), with a new validation set.
2. **Size distributions.** A 13.8 nm sphere with a size distribution of 0.41 (σ 0.26) is kept as a cylinder with no flag (G 78); four of the five
   spoiled error rows the check misses and four of the six extents the jackknife leaves out are size
   distributions; one unflagged unbounded extent. Step 5's reading holds: this needs the distribution in the
   model.
3. **Model errors and the family**: three flagged error rows are given a wrong family (a hump, a size distribution, texture) by 64–147 χ²_ν, beyond the 35 the flag asks; no clean truth is (0 of 33). A margin cannot remove these.
4. **Cost tail.** One flagged row spends 18 652 evaluations in the minima stage; 4/m and −3m cost 1.2–1.3×
   today's search there. The whole fit is still 0.53× today's wall.
5. **Small counts.** 33 clean truths and 5 clean spheres: the coverage figures carry a binomial sd of about
   4 %, the false-alarm rate is read from one event.

## 10. Files

- `VALIDATION.md`: this note. `tables/step6-validation.md`: the comparison per row (77).
  `tables/step6-family-val.md`: the family verdicts per row.
- The scripts are step 6's (`scripts/step6/`, `jobs-R.txt` / `jobs-VAL.txt`).
- Not in the repository (`$W`): the records (`fs2/step6/results/VP`, `VT`, `VFAM`).
