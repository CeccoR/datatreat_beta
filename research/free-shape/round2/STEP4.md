# Free shape, round 2, step 4: every true minimum, and two errors per parameter

Step 4 carries out the user's point 3 of `../PROTOCOL.md` ("What round 2 works on"): every true
minimum refined to the same level, symmetry-equivalent and within-resolution duplicates merged, two
errors per parameter kept apart (the local one: curvature for the extents, profile for the angles;
the spread over the true minima within a calibrated Δχ²), one minimum meaning a unique shape; and
point 4: extents not told apart give their directions as an unordered set, with the error of the
turn about the normal. It also takes over what AB.md §1 left open: a random 0.02 rad turn before the
polish and the refit decided the free minimum in flat valleys.

The engine is the prototype (`proto/engine.patch`) at its defaults: the exact (WPPM) line with its
shortcuts, search v2 ('briefs'), the per-line check (`SHAPE_CHECK`). All data are synthetic, drawn by
round 2's generator. Only the 77 screening rows of the tuning part were run (39 clean, 38 with a
model error); no validation row was run or read. `$W` is the work folder (the session's
scratchpad), not in the repository.

## Contents

1. [Summary](#1-summary)
2. [What was run](#2-what-was-run)
3. [The minima stage](#3-the-minima-stage)
4. [Completeness](#4-completeness)
5. [The threshold Δ*](#5-the-threshold-δ)
6. [The two errors](#6-the-two-errors)
7. [Uniqueness](#7-uniqueness)
8. [Directions as sets](#8-directions-as-sets)
9. [Cost](#9-cost)
10. [The prototype](#10-the-prototype)
11. [Decision and risks](#11-decision-and-risks)
12. [Files](#12-files)

## 1. Summary

**Decision.** The minima stage is adopted and on by default (`SHAPE_MINIMA` in `xrd-rietveld.js`).
- **The stage.** Where the search keeps a body's shape, every end of the search within 30 χ²_ν of
  the lowest (one of each minimum, at most 6) is refined to the same level: exact faces, central
  differences, the orientation free, then turns of ±0.02 rad about its softest turn, refined again
  while that gains (at most 10 rounds). The refined ones are merged within each other's 2σ. The
  lowest replaces the search's free fit when lower; the held frame is then tested against it.
- **No random turn.** With the stage on, the search's polish and its held fit's refit, each from a
  random 0.02 rad turn, are not made. Nothing random is left in a fit.
- **Δ* = 16 χ²_ν, 25 where the per-line check fired**, from a parametric bootstrap on 68 tuning
  rows. Round 1's model and its 12.5 are reproduced (c 8.5, Δ* 12.6), but at the data's Δ the
  competitor still wins 10 % of the replicas beyond 12.5; with a model error 12–17 %.
- **Two errors.** Local: the curvature's esd of each extent, the profile's of each angle, as today.
  Second: each extent's range and each axis's largest angle over the true minima. One 95 % interval
  (`lo`–`hi`): the hull of D·e^(±2κσ) with κ = 1.2, the minima's range and, where the check fired,
  the jackknife's. One minimum within Δ*: unique, no second error.
- **Directions.** A box's edges not told apart and a square box's sides are given as unordered sets,
  with the error of the turn about the set's normal.

| 66 kept truths, Δ* 16 / 25, κ 1.2 | extents covered | median half-width (ln) | principal axes covered | median radius |
|---|---|---|---|---|
| clean (33): local alone, κ = 1 (today's esds, the group's for a grouped extent) | 73/82 (89 %) | 2.6 % | 25/32 | 2.3° |
| clean: local, κ = 1.2 | 77/82 (94 %) | 3.1 % | 25/32 | 2.3° |
| **clean: both errors (adopted)** | **78/82 (95 %)** | **3.1 %** | **29/32 (91 %)** | **3.8°** |
| error, not flagged (9): both | 17/23 | 5.3 % | 8/9 | 6.2° |
| error, flagged (24): both | 31/56 | 4.4 % | 14/24 | 4.2° |
| **error, flagged: both and the jackknife (adopted)** | **51/56** | — | **21/24** | — |

- **Uniqueness.** 44 of the 68 kept shapes have one minimum within Δ*. On clean rows 21 of 33 are
  unique, and their local error covers the truth on 19. Of the 12 with several, the second error is
  needed (the local alone misses) on 4 and still misses on 2. Against the dense reference the
  default's "unique" was the reference's too on 12 of 12 rows, though on one (a flagged error row)
  the reference's single minimum is another, 1514 χ²_ν lower.
- **Completeness** against a dense reference (40 starts, 10 full refinements, 24 candidates; 18
  rows): 13 of 17 true minima found on clean rows, the lowest reached on 10 of 10; on error rows 10
  of 17, reach 5 of 8.
- **The random stream.** Over three seeds of the starts' small tilts, 9 of 10 clean rows return the
  same lowest within 0.1 χ²_ν. box-P4m-near differs by 7.5 χ²_ν: one seed's ends miss its lowest
  minimum. Two flagged error rows differ by 2 and 31 χ²_ν (§3).
- **Cost.** 0.86× the search's evaluations (median 0.53× a run), 0.28× the whole fit's; the whole
  fit 1.33× step 3's evaluations, 1.18× its CPU.

## 2. What was run

- **The engines.** `$W/step4-app` is `$W/step3-app` (step 3's prototype) with this step's changes
  (§10). The harness `$W/fs2/step4/h` is step 3's `hp/` with two methods:
  - `methods/min.mjs`: the search and the card's report, the report kept whole;
  - `methods/boot.mjs`: the parametric bootstrap.
- **`make-eng.mjs`** adds two things to step 3's copy:
  - `FS.min`, the stage's evaluations and wall time (`shapeMinima` wrapped);
  - `PROTO_TURNSEED`, which seeds the search's main random stream: the starts' small tilts and,
    with the stage off, the random turns.
- **`batch2.mjs`** takes a ninth column, the job's environment. Every run is deterministic, at nice
  15, at most three processes; validation rows are refused.

| tag | what | runs | wall |
|---|---|---|---|
| S1 | the first version: the search's random polish and refit kept, the stage after them; one turn direction, 3 rounds | 77 | 11 min |
| T1, T2 | S1's engine, the main stream seeded 12345 and 777 | 20 | 3 min |
| V1–V6, K | settle variants on cylinder-Pm-3m-on, sphere-P6mmm-1, box-P-3m1-near, box-P4m-near (rounds 10, gain 0.1, shiftTol 0.001, kicks 0.005 and 0.05, every turn at a symmetric orientation, no random polish) | 31 | 10 min |
| **S2** | **the final stage at the defaults** | **77** | **13 min** |
| U1, U2 | S2's engine, the main stream seeded 12345 and 777 | 24 | 4 min |
| DR2 | the dense reference: `shapeStarts` 40 (30 random starts beside the class's distinct ones), `shapeFull` 10, the stage with `max` 24 and `collect` 60 | 18 | 7 min |
| BT2 | the bootstrap: the search and the stage, then up to 4 minima within 30 refitted on 16 F and 16 T replicas and on both means without noise | 68 | 29 min |
| F0, F1 | the final engine: the stage off on 2 rows (against step 3's P1), at its defaults on 3 (against S2) | 5 | 2 min |

- **The dense reference's rows** are the screening truths of three classes, 2/m, −3m and m−3m, one
  per solid: 18 rows, 10 clean.
- **The bootstrap's rows** are all 68 kept shapes (BOOT_ALL), so that the local error is checked
  too.
- **Scoring.** As in step 3: each extent is paired with the truth's by `compareSolids` modulo the
  class, and a two-extent solid's section counts once. The principal axis is the truth's most
  distinct one.
  - Intervals in ln D. An unbounded extent counts apart (4 of 161).
  - A grouped extent (not told apart) takes the group's interval and its members' values. Step 3
    scored such an extent with no width, which is part of its 65 of 82.
- **Not done.** No validation row. No run with another background. The confirmation on the 154
  tuning runs is the next stage of the protocol.

## 3. The minima stage

**The recipe** (`shapeMinima`, `minimaMatch`, `minimaSigmas` in `xrd-rietveld.js`):

1. **The ends.** The search keeps every refinement end with its vector: the brief trials (soft faces,
   8 iterations), the full refinements, the exact faces' fit and the held frames. Those within 30·ν
   of the lowest are taken, ν being its χ²_ν floored at 1.
2. **One of each before refinement.** Two ends are one minimum when, over the class's operations and
   the body's relabellings, every width lies within 10 % of the larger and every axis within 5°.
   - The relabellings: a box's or an ellipsoid's three axes with their widths; a square box's or an
     elliptic cylinder's two across; a body of revolution's axis alone.
   - At most 6 ends, the lowest first.
   - A median run has 15 ends and keeps 2.
3. **Each refined to the same level.**
   - Exact faces, central differences, the orientation free, at most 60 iterations, the covariance
     at the end.
   - Then turned by ±0.02 rad about its softest turn (the turns' covariance's largest-variance
     direction) and refined again, the lower kept.
   - Where even that turn's σ is over 10°, a symmetric orientation where a turn has no first-order
     effect, every turn's direction is tried.
   - Repeated while a round gains, at most 10 rounds, a further round only after a gain over 0.5·ν.
4. **Merged again.** Two refined minima are one when every width lies within 2 times the larger
   local σ (at least 2 %) and every axis within 2 times the larger tilt σ (at least 1°, at most 10°).
5. **The free fit.** The lowest minimum replaces the search's free fit when lower. A held frame is
   then tested against it as before: held only while the free fit is no better by the 95 % χ² of its
   turns.
6. **The record.** `info.minima` lists the minima within 30, each with Δ, its widths, frame, local
   σ, the ends merged into it, and its vector.

**Why no random turn.** The first version (S1) kept the search's polish and refit, each from a
random 0.02 rad turn, and ran the stage after them, with one turn direction and 3 rounds.
- On the clean rows it changed nothing that mattered: across three seeds the lowest moved by at
  most 0.09 χ²_ν, as today's search (0.03).
- On two flagged error rows it did not remove the dependence: cylinder-Pm-3m-on spread 26.7 χ²_ν
  today and 20.6 with the stage; sphere-P6mmm-1 2.6 and 4.7.
- In both a flat valley kept descending round after round: 3 rounds stopped the stage at the seed's
  own depth.
- The variants:
  - 10 rounds took cylinder-Pm-3m-on from 22 154 to 22 093.
  - With one seed the held lattice frame (22 162) stays the only fit. From it, turns of 0.02 rad
    about the softest turn or about every turn refine to 22 229, above it; turns of 0.005 and
    0.05 rad find nothing lower either.
  - shiftTol 0.001 and a gain of 0.1 changed little (22 119 and 22 093).
- So the final stage takes 10 rounds, tries every turn at a symmetric orientation, and drops the
  random polish and refit. A fit then depends only on the ends the search provides.

**The random stream with the final stage** (S2, U1, U2: the main stream seeded three ways). The
seed now sets only the starts' small tilts (`tables/step4-minima.md`).

| 12 rows | today: free fit's spread (χ²_ν) | the stage: lowest's spread | outcomes |
|---|---|---|---|
| 8 clean rows | 0.00–0.19 | **0.00–0.09** | the same |
| box-P-3m1-near (clean) | 0.04 | 0.04 (the long edge 175–195 nm along a flat valley) | the same |
| box-P4m-near (clean) | 7.46 | **7.46** | the same (free) |
| cylinder-Pm-3m-on (size distribution 0.72, flagged) | 26.7 (986 without the polish) | **31.0** | free, held, held |
| sphere-P6mmm-1 (texture 0.59, flagged) | 2.60 (4.97 without the polish) | **1.96** | free ×3 |

- **The two error rows.** Each is a misfit landscape where the held frame is a stable point and the
  free valley below it is reached only along some turns.
- **box-P4m-near** is a completeness failure: with seed 777 no end of the search falls in the
  lowest minimum's basin (§4).

**On the 77 screening runs** (S2 against step 3's P1, `tables/step4-minima.md`):
- **The stage ran on 68 kept shapes:** 66 truths and 2 spheres kept with a shape.
- **Distinct minima within 30:** 1 in a median run.
- **Unique:** 44 of 68 have one minimum within Δ* (16, 25 flagged). At Δ* 6, 10, 12.5 and 20: 51,
  49, 45 and 42.
- **The stage's lowest against the search's own free fit:**
  - lower in 49 runs, by under 0.05 χ²_ν in most, and by 0.2–11 χ²_ν in 11;
  - on two rows by 909 and 6331 χ²_ν, where the dropped polish had done that work.
- **Two outcomes changed, both flagged error rows:**
  - cylinder-Pm-3m-on, held → free, 31.1 χ²_ν lower;
  - spheroid-P2m-on, held → free, 6.0 χ²_ν lower.
- **The returned χ²:** lower by over 0.5 χ²_ν on 4 rows; higher on sqbox-P4m-on by 0.8 (air 0.81,
  flagged).
- **Accuracy:** the medians are unchanged: worst extent 4.1 %, principal axis 1.30° (1.23°).
  - box-P-3m1-near went from 11 % to 191 %. Two minima lie 0.39 χ²_ν apart: the long edge is 175 nm
    in one (local interval 9–3370 nm) and 53 nm in the other, against a truth of 60 nm. The new best
    is the deeper by noise, and both intervals cover the truth.
  - The other changes are 1–4 points.

## 4. Completeness

The dense reference (DR2) has 40 starts (30 of them random), 10 full refinements and the stage on up
to 24 candidates within 60. That is 2.97× the default's search with its stage. The true minima are
the reference's minima within Δ* of the lowest found by either run. One is found when a default
minimum matches it within each other's local error (`comp4.mjs`, `tables/step4-minima.md`).

| 18 rows | true minima | found | default's lowest = reference's (Δ ≤ 1) | verdict "unique" the same |
|---|---|---|---|---|
| clean (10) | 17 | **13 (76 %)** | **10/10** | 9/10 |
| error (8) | 17 | **10 (59 %)** | 5/8 | 8/8 |

(Δ* 16 on every row here, the flagged ones included.)

- **The misses.**
  - box-P-3m1-near: the reference has 6 minima within 6.8. They are relabellings of one box whose
    long edge is poorly bounded (30–605 nm), turned 11–23° apart. The default found 3.
  - ellcyl-Pm-3m-generic: the reference has 3 minima, the default 2. The third (Δ 12.2, a 16 nm ×
    unbounded section) is the one that brings the truth's 52 nm edge into the interval. This is the
    clean row both errors miss (§6).
  - On the error rows the reach misses are cylinder-Pm-3m-on, ellcyl-P-3m1-near (4.0 χ²_ν) and
    sqbox-P-3m1-on (5.0).
- **cylinder-Pm-3m-on.** The reference finds an unbounded disc 3.2 nm thick, 1514 χ²_ν below the
  22 × 3.8 nm cylinder every default seed returns. The size distribution is better fitted by a disc
  of infinite diameter, and none of the default's ends falls in that basin.
- **What completeness costs.** A minimum the search's ends never reach stays unseen. The stage
  refines; it does not search. Its completeness is the search's: more starts or more full
  refinements, at 3× the cost here.

## 5. The threshold Δ*

**The bootstrap** (`methods/boot.mjs`, `bootan.mjs`, `tables/step4-delta.md`). For each of the 68
kept shapes, up to 4 minima within 30 of the lowest are each refined again (central differences,
exact faces, the orientation free, at most 30 iterations) from their own vector on:
- **F replicas:** Poisson draws of the lowest minimum's calculated pattern (round 1's §5.3);
- **T replicas:** Poisson draws of the generator's own counts, the truth with its model error if
  any (round 1's §5.3b);
- 16 of each, and on both means without noise (δ).

A replica's target and weights are as buildModel makes them (Mighell's χ²_γ). A flip is the
competitor beating the lowest on a replica. A replica where both refits end at one minimum (every
width within 2 %) is no contest and is left out: 28–76 per group.

| 38 pairs on 27 rows | replicas | round 1's model, Δ_r ~ N(δ, 4δ + c): c, Δ* | the rule on the data's Δ, Φ(−Δ/√(4Δ + c)): c, Δ* | flips at Δ < 6 | 6–12.5 | over 12.5 |
|---|---|---|---|---|---|---|
| F, clean rows (14 rows) | 237 | 8.5, **12.6** | 29.8, **15.9** | 0.29 | 0.13 | 0.10 |
| T, clean rows | 244 | 11.4, 13.2 | 42.0, **17.4** | 0.34 | 0.17 | 0.08 |
| F, error rows (13 rows) | 260 | 16.8, 14.1 | 190, 28.7 | 0.37 | 0.17 | 0.17 |
| T, error rows (the model error) | 286 | 166, 27.3 | 129, **24.9** | 0.51 | 0.16 | 0.12 |

- **Round 1 reproduced.** Fitted as round 1 fitted it (each pair's replicas about the noise-free
  δ), the clean rows give c = 8.5 and Δ* = 12.6. Round 1 had 8 and 12.55.
- **But the rule is applied to the data's Δ, not to δ.** The data's Δ is itself a noisy reading
  (δ/Δ median 0.77 on F, 0.52 on T).
  - The flips beyond 12.5 are 10 % of 40 replicas, against the 2 % the rule predicts with c = 8.
  - Fitted on the flips against the data's Δ directly, the rule needs c = 30–42: Δ* 15.9 (F) and
    17.4 (T).
- **Adopted: Δ* = 16** where the per-line check does not fire.
- **With a model error the ranking is noisier,** as round 1's §5.3b found. On T replicas of the
  error rows the competitor wins 51 % below 6, 16 % at 6–12.5 and 12 % beyond.
  - Both fits give Δ* 25–27 (F, the fitted model as truth: 28.7 on the rule).
  - **Adopted: Δ* = 25 where the check fired** (`deltaMisfit`).
  - Error rows the check misses keep 16: their errors are weak or taken up whole (`STEP3.md` §3).
- **The pairs are few.** 17 pairs on the clean rows, 21 on the error rows. Two or three pairs
  dominate the tail: cylinder-P6m-on (Δ 16.1, δ 7.6, 2 of 16 flips) and cylinder-P-3-near (Δ 17.7,
  where most replicas merge the two). To confirm on the 154 tuning runs.
- **The coverage hardly moves with Δ*.** On S2 the combined interval covers 123, 124, 126 and 127
  of 161 extents at Δ* 6, 12.5, 20 and 30. Δ* matters for the uniqueness verdict (§7).

## 6. The two errors

**The intervals** (`score4.mjs`, `tables/step4-errors.md`):
- **L**, the local error alone: D·e^(±2κσ) with σ = Desd/D (the curvature's); angles 2·esdAngle
  (the profile's, `turnEsds`).
- **B**, the minima's range alone.
- **C**, both: the hull of L and B; for an axis, the larger of 2·esdAngle and the largest angle
  over the minima.
- **U**, the hull of every true minimum's own local interval (round 1's P2).
- **J**, C with the jackknife where the check fired (step 3's D·e^(±2 sd) and 2·rms turn).

| kept truths (Δ* 16 / 25) | extents | L, κ 1 | L, κ 1.2 | B | **C, κ 1.2** | U | J | half-width L / C / U | principal axes L / C / J | radius L / C |
|---|---|---|---|---|---|---|---|---|---|---|
| clean (33) | 82 | 73 | 77 | 13 | **78** | 80 | 78 | 3.1 / 3.1 / 3.5 % | 25 / **29** / 29 of 32 | 2.3 / 3.8° |
| error, not flagged (9) | 23 | 15 | 15 | 6 | **17** | 18 | 17 | 2.9 / 5.3 / 5.3 % | 8 / 8 / 8 of 9 | 6.2 / 6.2° |
| error, flagged (24) | 56 (4 ∞) | 28 | 29 | 8 | 31 | 33 | **51** | 3.9 / 4.4 / 4.9 % | 10 / 14 / **21** of 24 | 3.0 / 4.2° |
| all (66) | 161 | 116 | 121 | 27 | 126 | 131 | **146** | 3.4 / 3.9 / 3.9 % | 43 / 51 / **58** of 65 | 2.8 / 4.3° |

**The curvature's coverage.** Today's esds cover 73 of the 82 clean extents (89 %) once a grouped
extent takes its group's esd; step 3's 65 scored a grouped extent with no width.
- **On the clean rows the truth lies 1.21 σ rms off** (|z| < 5): 10 of 82 extents beyond 2σ, 3
  beyond 3σ, one at 13σ (ellcyl-Pm-3m-generic, a missed minimum, §4).
- **The bootstrap separates the causes** (`esdboot.mjs`, 82 clean extents):
  - against noise the curvature is right: F replicas spread 0.97 σ rms about the noise-free fit;
  - against the truth (T replicas) the fit is biased by 0.41 σ rms (median 0.25 σ). That is the
    instrument's profile from the refined standard and the exact line's residual difference.
  - Bias and noise together make about 1.05 σ. The rest of the 1.21 is where a fit settles in a flat
    valley, which a refit from the minimum does not redo.
- **κ = 1.2,** the observed rms, brings the local interval to 77 of 82 (94 %). The combined one
  reaches 78 (95 %) at a median half-width of 3.1 % in ln D (κ 1: 2.6 %).
  - A floor of 1 % in ln D instead of κ gives the same 77 at a median half-width of 3.3 %.
  - With κ the z of the clean extents has median |z| 0.66 and rms 1.01.
- **The angles' profile is not scaled.**
  - Its misses on the clean rows are mostly other minima, which the second error covers (25 → 29 of
    32).
  - The two left: box-P6m-generic, 12.6° against a radius of 12.1°; spheroid-Pm-3-generic, 6.0°
    against 3.9°, unique.
  - Scaling the angles by 1.5 would add one.

**The second error.** Alone, B covers little: it is a spread of points, zero on a unique shape. With
the local error it adds:
- 1 clean extent and 4 clean principal axes (the rows with several minima: box-P-3m1-near,
  sqbox-Pmmm-generic, ellcyl-P6m-generic, spheroid-P-3-near);
- on the error rows, 4 extents and 4 axes.

**Flagged rows: with the jackknife.** Where the check fires, the misfit dominates. The combined
interval covers 31 of 56 extents and 14 of 24 axes; with the jackknife, 51 and 21.
- The adopted interval is the hull of the three: the local one with κ, the minima's range, the
  jackknife's.
- The jackknife adds what a misfit moves. The minima add what a near-equivalent minimum holds: on
  the flagged rows 2 extents and 4 axes beyond the local error.
- What stays uncovered is step 3's: texture and size distributions spread over every line, and held
  frames.

## 7. Uniqueness

"Unique" means one minimum within Δ*; then no second error is given. Is the verdict right?
- **Against the truth:** a unique shape's local interval should cover it.
- **Against the dense reference:** the reference should also find one minimum.

| kept truths (κ 1.2) | unique | unique, local covers | several | several, local covers | several, only both cover | several, neither | with the jackknife: unique / several covered |
|---|---|---|---|---|---|---|---|
| clean (33) | 21 | **19** | 12 | 6 | 4 | 2 | 19/21 / 10/12 |
| error, not flagged (9) | 7 | 3 | 2 | 0 | 1 | 1 | 4/7 / 1/2 |
| error, flagged (24) | 15 | 3 | 9 | 0 | 2 | 7 | **12/15 / 6/9** |

- **On the clean rows "unique" is right on 19 of 21.** The two misses are small.
  - ellipsoid-Pmmm-generic: −4 % at 2.2σ.
  - spheroid-Pm-3-generic: +3 % and the axis 6.0° against 3.9°. One minimum, slightly off.
- **"Several" on 12 clean rows.** The local error alone covers 6, both errors 4 more, and 2 stay
  uncovered:
  - box-P6m-generic, the axis at 12.6° against 12.1°;
  - ellcyl-Pm-3m-generic, whose third minimum the default missed (§4).
- **Against the dense reference** (18 rows) the default said "unique" on 12, and the reference
  agrees on all 12.
  - On cylinder-Pm-3m-on the reference's one minimum is another one (§4).
  - Of the 6 "several", the reference agrees on 5. On ellipsoid-P-3m1-on (held) the reference has
    one minimum where the default has two, 0.34 χ²_ν apart.
- **On the flagged rows "unique" says little.** The local error covers 3 of 15 unique fits; with
  the jackknife, 12. Under a misfit a single minimum is not a determined shape. The card should say
  so where `misfit` fires (the result card, later).

## 8. Directions as sets

`bodyShapeOf` gives each axis its set (`set`: an index in `sets`, else −1):
- **A box:** the edges in a group, not told apart by step 3's z test against the χ² quantile.
- **A square box:** its two sides always; all three when its side and height are not told apart (a
  cube).
- **The error:** each set is `{ axes, normal, esdAngle, betweenDeg, radius }`. esdAngle is the
  profile's σ of the turn about the normal (sig[normal]); for a set of three, the rms of the three
  turns.
- **Where a turn is a true symmetry it is lost:** an ellipsoid's or an elliptic section's equal pair,
  a body of revolution. They get no direction, as before.

Scored against the truth modulo the class and, within a set, modulo the swap (`dirs4.mjs`,
`tables/step4-dirs.md`; 144 axes the report gives a direction for, the truth's defined ones):

| axes | n | covered: each alone / as sets | median error ° | beyond 10° | median radius ° |
|---|---|---|---|---|---|
| all | 144 | 105 / **106** | 2.0 / 2.2 | 29 / 29 | 3.3 / 4.3 (in sets) |
| clean | 69 | 61 / **63** | 1.4 / 1.4 | 8 / 8 | — |
| in a set | 24 | 17 / 18 | 2.0 / 2.2 | — | 3.3 / 4.3 |

- **Few sets on these rows.** 22 of the 24 axes in sets are square boxes' sides. Their truth is
  tied, so `compareSolids` already pairs them modulo the swap. The set changes their stated error
  from the tilt's (the mean of two turns) to the turn's about the height.
- **One box had a pair not told apart:** box-P6m-generic, 60 × 30 × 5.9 nm read 82 × 27 × 6.0 nm,
  its two long edges not told apart.
  - Each alone, its in-plane edges were 22.7° and 54.6° off; the swap put the second 90° wrong.
  - As a set both are 24.1° off, within the set's radius of 28.6°.
  - The third axis, scored under the same rotation of the class, goes from 59.2° to 12.6°.
- **The rule's reach.** It matters where two edges are close, which the design's ratios (1–6,
  log-uniform) make rare. Its value is that the stated error is the right one: the turn about the
  normal, not a tilt.

## 9. Cost

| 77 screening runs | evaluations | against step 3 |
|---|---|---|
| the search without the stage (no polish, no refit) | 141 981 | 0.91× step 3's search (156 033) |
| **the stage** | **122 742** | **0.86× the search; median 0.53× a staged run, at most 6.8×** |
| the whole fit (isotropic fit + search + stage + report) | 437 524 | **1.33×** step 3's (330 223); CPU 2317 s against 1972 s (1.18×) |

- **The stage's share.** 28 % of the whole fit's evaluations (median 19 % a run); 38 % of the
  search's wall time with it.
- **Where it goes:**
  - each candidate's settle from its end;
  - the turned refinements: 62 of 107 minima need 2 (one round, no gain), 13 need 4, 26 need 6 and
    6 need 8–20 (flat valleys, or every turn tried at a symmetric orientation).
  - The heaviest rows are ellipsoid-P-3-generic (14 201: 5 candidates merging into one), then
    ellipsoid-P6m-near, box-P6m-generic, sphere-P6mmm-1 and box-P-3m1-near (6000–7900).
- **Cheaper settings to weigh** on the 154 runs: `max` 3 (the median run has 2 candidates), or
  `rounds` 3 (the first version: 0.47× the search, but the flat valleys stop where the round count
  does).
- **The calibration runs are not for the app.** The dense reference cost 3.0× the default's search
  with the stage, the bootstrap 3.1× those rows' searches.

## 10. The prototype

**The patch.** `proto/engine.patch`, regenerated against `9782d33`, changes two files.
- **`xrd-rietveld.js`** (+650 −58 in all, step 4 adding about 260 lines):
  - `SHAPE_MINIMA` in the tunables' block (`on: true`, `collect: 30`, `preLn: 0.1`, `preDeg: 5`,
    `max: 6`, `kick: 0.02`, `rounds: 10`, `gain: 0.5`, `shift: 0`, `k: 2`, `floorLn: 0.02`,
    `floorDeg: 1`, `capDeg: 10`, `delta: 16`, `deltaMisfit: 25`, `keep: 30`, `kappa: 1.2`);
  - `minimaMatch`, `minimaSigmas`, `shapeMinima`;
  - in `freeShapeRun`: the ends kept, the stage after the held frames, no polish and no refit with
    it on, the result's `info.minima` and `info.minimaStage`;
  - in `bodyShapeOf`: the sets, `betweenLo`, `betweenHi`, `betweenDeg`, `sLocal`, `lo`, `hi`,
    `radius` and `minima` (`delta`, `n`, `unique`, `list`).
  - `SHAPE_MINIMA` is exported.
- **`RIETVELD.md` §10.8:** the minima stage, its figures and its limits.
- The card's texts are not touched.

**Verification.**
- **The stage off** (F0, `SHAPE_MINIMA.on = false`, 2 rows) equals step 3's P1 to the bit: the
  isotropic fit, the search's evaluations, χ², dimensions, the report's evaluations, esds,
  jackknife and angular esds. The report adds only `sets`, `set` and `minima: null`.
- **The final defaults** (F1, 3 rows: a clean row with two minima, a flagged row, a held row)
  equal S2 to the bit: the search's and the stage's evaluations, χ², the minima and the report's
  evaluations.
  - `lo`–`hi` and `radius` equal the offline intervals.
  - Δ* is 25 on the flagged row and 16 elsewhere.
- **Lint and tests.** `npm run lint` is clean. The engine's tests (rietveld, rvmodel, rvpool,
  rvsplit, rvlock, rvcif, rvui, smoke, widths, modules) pass, 53 of 53. No test asks for a free
  shape, so no test runs the stage.

## 11. Decision and risks

**Decision.**
- **On by default:**
  - the minima stage with no random turn;
  - Δ* 16, and 25 where the per-line check fired;
  - the two errors in the report, joined as `lo`–`hi` with κ 1.2 and as `radius`;
  - the uniqueness verdict;
  - directions as sets.
- **On flagged rows:** the jackknife joins the interval (the hull of the three).
- **To confirm on the 154 tuning runs:**
  - Δ* (the bootstrap's pairs are few);
  - κ (82 clean extents);
  - the stage's completeness;
  - `max` and `rounds` against the cost.
  - Then validate once.
- **Not adopted:**
  - round 1's Δ* 12.5: its own model is reproduced, but it under-predicts the flips at the data's Δ;
  - scaling the angles' profile;
  - the union of every minimum's interval (U: 80 of 82 clean extents, at 3.5 %).

**Risks.**
- **Completeness is the search's.**
  - The stage refines the ends it is given: 76 % of the true minima on clean rows, 59 % on error
    rows.
  - A missed minimum leaves the truth uncovered (ellcyl-Pm-3m-generic) or a far better fit unseen
    (cylinder-Pm-3m-on, 1514 χ²_ν).
  - The starts' tilts alone moved a clean row by 7.5 χ²_ν.
- **Misfit landscapes.** Under a size distribution or texture the held frame and the free valley
  below it are reached along some turns only: 31 χ²_ν between seeds on one row. The check flags both
  rows, and the interval there takes the jackknife.
- **Small numbers.**
  - 33 clean rows set κ.
  - 38 bootstrap pairs set Δ*.
  - 18 rows measure completeness.
  - The figures are tuning-set figures, scored where they were set.
- **The local error's κ is empirical.** It is the noise right, plus a bias of 0.4 σ rms (the
  instrument, the line), plus where flat valleys settle. Real data with a different instrument
  model may need another.
- **Cost.** The whole fit is 1.33× step 3's evaluations. The rounds on flat valleys can take a run
  to 6.8× its search.
- **What the user sees.** A kept shape's report carries `lo`–`hi`, `radius`, `minima` and `sets`.
  The card does not show them yet (the result card, later). Desd and esdAngle are unchanged.

## 12. Files

- `STEP4.md`: this note.
- `proto/engine.patch`, `proto/README.md`: the prototype with `SHAPE_MINIMA`, and this step's
  verification (7).
- `tables/step4-minima.md`: the stage on the 77 runs, completeness per row, the random stream.
- `tables/step4-delta.md`: the bootstrap per group and per pair, and the local error against the
  replicas.
- `tables/step4-errors.md`: coverage, widths and uniqueness for κ 1 and 1.2, and a row per kept
  truth.
- `tables/step4-dirs.md`: the directions, each alone and as sets.
- `scripts/step4/`, with its `README.md` for the commands:
  - `setup.sh`;
  - `make-eng.mjs`, `run.mjs`, `batch2.mjs`, `methods/min.mjs`, `methods/boot.mjs`;
  - `score4.mjs`, `dirs4.mjs`, `comp4.mjs`, `turn4.mjs`, `bootan.mjs`, `esdboot.mjs`, `show.mjs`,
    `diag-esd.mjs`;
  - the job files.
- Not in the repository:
  - the records in `$W/fs2/step4/h/results/` (S1, S2, T1, T2, U1, U2, V*, K*, DR, DR2, BT2, F0,
    F1);
  - the app copies `$W/step4-app` and `$W/step4-gitbase`.
