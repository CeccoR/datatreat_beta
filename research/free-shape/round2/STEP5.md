# Free shape, round 2, step 5: the solid's family, and the keep test

Step 5 takes up two of the user's points of `../PROTOCOL.md` ("What round 2 works on"): why the solids
are confused and when the data tell them apart, as a rule for "family not determined" (a); and the
keep criterion, one size against a shape, where the data give a founded doubt about ΔBIC < −10 (b).

The engine is the prototype (`proto/engine.patch`) at step 4's defaults: the exact (WPPM) line with
its shortcuts, search v2 ('briefs'), the per-line check, the minima stage (Δ* 16 / 25). All data are
synthetic, drawn by round 2's generator, from the tuning part only: the 77 screening rows, the 22
tuning spheres with four fresh noise draws each, and mild shapes made from the 66 tuning truths outside
the screening set. No validation row was run or read. `$W` is the work folder (the session's
scratchpad), not in the repository.

## Contents

1. [Summary](#1-summary)
2. [What was run](#2-what-was-run)
3. [The family](#3-the-family)
4. [The keep test](#4-the-keep-test)
5. [The prototype](#5-the-prototype)
6. [Decision and risks](#6-decision-and-risks)
7. [Files](#7-files)

## 1. Summary

**(a) The family.** Each family is read by its general member's χ² (box, elliptic cylinder,
ellipsoid: the same number of parameters; the ball family also holds the isotropic fit). It is
determined when the runner-up family lies **14 χ²_ν** above the winner, **35** where the winner's
per-line check fired: the 5 % points of a T bootstrap on 45 tuning rows (m* 14.1 on clean rows, 12.2
not flagged, 35.1 flagged). Within the winner the general member is reported only where it beats its
special one by the 95 % χ² of its extra parameters (3.84 box, 5.99 elliptic cylinder and ellipsoid; 25
flagged): otherwise "a spheroid; an ellipsoid is not supported".

| 66 screening truths, margin 14 / 35 | right | not determined | wrong |
|---|---|---|---|
| clean (33) | **19** | 14 | **0** |
| with a model error (33) | 7 | 23 | 3 (all flagged: a size distribution or a hump, by 77–303 χ²_ν) |
| all | 26 | 37 | 3 |

- **"Not determined" is honest.** The truth is among the families named on 34 of 37. Of the 37, the
  winner was wrong on 15 (a wrong claim avoided) and right on 22 (a right one withheld).
- **The nested case** is read right on 39 of 48 rows: 20 of 22 special truths are given their special
  member; 7 of 26 general truths are given the special one, where the data do not support the extra
  width (Δ 0.3–14).
- **What the app should do.** Not try every solid by default. On request ('compare solids'), search
  the chosen solid's nested partner and the three general members: **4 searches, 4.5× the chosen
  one's**, the verdict of all six (6.7×) on 66 of 66 rows, and on 388 of 396 whichever solid the user
  had picked. A cheaper check against the nearest family alone (3 searches) is right when the user
  picked the right solid (60 of 66 as all six) and fails when not (52 wrong claims on the clean rows).

**(b) The keep test.** Keep the shape when G, the larger gain of the search's free and held fits over
the isotropic fit (χ²/max(1, χ²_ν,iso), before the minima stage), exceeds **χ²_{k+1}(0.999) + 2**, k
the deformations of a sphere the Laue class lets the pattern see to first order (5 in −1, 3 in 2/m, 2
in mmm, 1 uniaxial, 0 cubic): **24.7, 20.7, 18.6, 16.1, 13.2**, whatever the solid and the route.
Where the per-line check fires on the fit tested, ΔBIC < −10 is needed as well.

| rule | clean nulls kept (216 set, 144 fresh) | error nulls kept (300) | mild clean shapes kept (86) | mild error shapes (90) | screening truths (66) |
|---|---|---|---|---|---|
| ΔBIC < −10 (today) | 0, 0 | 133 | 71 | 81 | 66 |
| per solid, its clean nulls' max + 2 | 0, **4** | 147 | 77 | 85 | 66 |
| **χ²_{k+1}(0.999) + 2, flagged: also ΔBIC** | **0, 0** | **138** | **78** | **85** | **66** |

- **The founded doubt.** The clean null gains average about k + 1 per class (the ellipsoid: 7.3 in −1,
  4.4 in 2/m, 3.0 in mmm, 1.5–3.4 uniaxial, 0.7 cubic), and the faceted solids' lie far lower. A
  threshold per solid, set on its nulls, failed on fresh nulls (4–6 of 144), as round 1's had.
- **Model errors are not a threshold's.** A size distribution gives every solid on a sphere a gain of
  300–3700 (60 of 60 such nulls kept by every rule), texture 49–54 of 60. The check flags 33 of the 60
  size distributions. A parametric bootstrap from the isotropic fit cannot see them either.
- **The quick parametric bootstrap** costs about 18 searches a fit (19 replicas) and is not adopted
  (§4.5).
- **Cost:** the same as today's (the early rejection takes half the new need: 953 against 947
  evaluations a null search), plus two evaluations for the check where G passes.

## 2. What was run

- **The engines.** `$W/step5-app` is `$W/step4-app` with this step's changes (§5). The harness
  `$W/fs2/step5/h` is step 4's (`lib.mjs`, `make-eng.mjs`, `run.mjs`, the shared `fs2/` folders), with
  `run.mjs --shape` (the solid searched), rows from `design5.json` (derived rows by their key), and the
  methods `fam` (the search as the app runs it, its keep test's numbers, the fit's vector; no report),
  `fboot` (the family bootstrap) and `lrt` (the quick parametric bootstrap). `batch5.mjs`: one
  `run.mjs` a job, nice 15, at most 3 processes, a timeout each, resumable; a row of the validation
  part is refused. A second copy `$W/fs2/step5/h2` ran the final engine.
- **Study switches** in the engine (§5): `SHAPE_KEEP.rule 'all'` (every shape with a gain over 0 goes
  on, so that every solid gets its full fit and minima stage), `early` (0: the full search on every
  row whose brief trials gain anything), `record` (the keep test's numbers and the per-line check of
  the fit tested, before the stage).
- **The rows** (`mkdesign5.mjs` → `design5.json`, all from the tuning part):
  - the 77 screening rows as they are;
  - **fresh draws** of the 22 tuning spheres: the seed moved, k = 1–4 (on an error row the error's own
    draws are new too);
  - **mild shapes**: each of the 66 tuning truths outside the screening set, its extents pulled
    towards their geometric mean so that the largest over the smallest is r, log-uniform in
    [1.02, 1.6] (2 a truth; 4 for the ellipsoids and spheroids: 176 rows), with a new noise seed; the
    orientation, counts, phase and model error are the truth's.

| tag | what | runs | wall |
|---|---|---|---|
| X1 | the 11 screening spheres × the six solids; rule 'all', early 0, the stage on | 66 | 4 min |
| X2 | the 66 screening truths × the six solids; rule 'all', early 0, **the stage off** (the search's random polish on, as step 2's cross-solid fits) | 396 | 40 min |
| FB | the family bootstrap: 45 rows, the solids of every family within 30 χ²_ν of the winner and the true family's two, 10 T replicas each | 153 | 15 min |
| N | the 22 tuning spheres × the six solids × draws 0–4 (X1's 66 beside); rule 'bic', early 0 | 594 | 36 min |
| M | the 176 mild shapes, the true solid; rule 'bic', early 0 | 176 | 18 min |
| L | the quick parametric bootstrap: the 12 clean tuning spheres as the ellipsoid, 10 mild shapes (`h2`) | 22 | 20 min |
| F0–F2 | the final engine: rule 'bic' against step 4, the defaults, the family on (`h2`) | 9 | 3 min |

- **Why X2 without the stage.** With it every wrong solid's fit ran the stage too, 1–2 minutes a row
  in the triclinic class; the polish is the search's own and the true solid was refitted alike, so
  the margins compare like with like. Step 4's stage changed χ² by under 0.05 χ²_ν on most rows.
- **Scoring.** A family is right, not determined or wrong against the truth's (nested pairs: sphere ⊂
  spheroid ⊂ ellipsoid, cylinder ⊂ elliptic cylinder, square box ⊂ box). Gains and margins are in
  χ²/max(1, χ²_ν,iso), as ΔBIC's. Thresholds for (b) were set on the nulls' draws 0–2 and scored on
  draws 3–4 as well. The tables were read from the runs offline (`fam5.mjs`, `fam-sub.mjs`,
  `fboot-an.mjs`, `keep5.mjs`, `keep-rules.mjs`, `cost5.mjs`).

## 3. The family

### 3.1 Margins on the screening rows

Each row's six fits come from one isotropic fit (its χ² equal across the six on 77 of 77). A family's
χ² is its best member's; the margin is the runner-up family's χ² less the winner's (`tables/step5-family.md`).

| 66 truths, one margin m | m 3: right / n.d. / wrong | m 10 | m 16 | m 25 |
|---|---|---|---|---|
| by χ², clean (33) | 27 / 6 / 0 | 21 / 12 / 0 | 18 / 15 / 0 | 14 / 19 / 0 |
| by χ², error (33) | 16 / 4 / 13 | 12 / 12 / 9 | 9 / 17 / 7 | 5 / 24 / 4 |
| by BIC (each family's member of least χ²/ν + P ln N), clean | 27 / 4 / **2** | 24 / 9 / 0 | 23 / 10 / 0 | 20 / 13 / 0 |
| by BIC, error | 19 / 2 / 12 | 13 / 12 / 8 | 9 / 18 / 6 | 9 / 19 / 5 |

- **On clean rows no family is wrong beyond 3 χ²_ν**, as AB §3.6 expected of the exact line (8 / 3 / 0
  on 11 rows). The nearest rival of a box is the elliptic cylinder (22 of 22 box-family rows), of a
  cylinder the box (18 of 22), of a ball the elliptic cylinder (22 of 22).
- **Model errors pull the family.** At m 10 nine error rows name a wrong family, six of them toward the
  elliptic cylinder; a size distribution, texture or air can also make the wrong family's lead
  systematic: sqbox-P-1-on (a size distribution of σ 0.19, not flagged) is an elliptic cylinder by 13.1
  on the data and 18.9 without noise.
- **BIC** helps the special members (one ln N per width saved) and so the clean special truths, but it
  needs all six searches, put two clean rows wrong at m 3, and its margin is not calibrated. χ² on the
  general members is kept.

### 3.2 The margin's bootstrap

As step 4's Δ*: for 45 rows whose runner-up lies within 30 χ²_ν of the winner, or whose true family
does, each solid's returned fit is refined again (central differences, the orientation free, 30
iterations) on 10 T replicas, Poisson draws of the generator's own counts (the truth with its error),
the same draws for every solid. A flip is the data's runner-up family lower on a replica. Fitted as
P(flip) = Φ(−m/√(4m + c)) on the data's margin m (`fboot-an.mjs`):

| rows | replicas | flips at m < 3 | 3–10 | 10–25 | over 25 | c | m* (5 %) |
|---|---|---|---|---|---|---|---|
| clean (20) | 200 | 0.48 | 0.15 | 0.04 | 0 | 16.8 | **14.1** |
| error (25) | 250 | 0.30 | 0.04 | 0.22 | 0 | 112 | 23.7 |
| the winner not flagged (28) | 280 | 0.40 | 0.13 | 0.03 | 0 | 6.0 | 12.2 |
| **the winner flagged (17)** | 170 | 0.45 | 0.04 | 0.37 | 0 | 313 | **35.1** |

- **Adopted: 14 χ²_ν, 35 where the winner's check fired** (`SHAPE_FAMILY.margin`, `marginMisfit`). The
  clean rows' 14.1 is close to step 4's Δ* 16 for two minima of one solid.
- **Flagged rows flip far out.** sqbox-P4m-on (air 0.81) leads the wrong family by 11.5 on the data
  and loses it on every replica (−11.6 without noise); spheroid-P6mmm-near (a hump) by 18.0, 8 of 10
  flips; sqbox-P-3m1-on (texture) by 16.8, 6 of 10.
- **Scored at 14 / 35** (one table in §1): 26 right, 37 not determined, 3 wrong. The three wrong rows
  are flagged and far beyond any margin: cylinder-Pm-3-generic (a hump of 0.57) a box by 206,
  cylinder-Pm-3m-on (a size distribution of 0.72) a ball by 303, ellcyl-P-3m1-near (0.93) a ball by 77.
  The three "not determined" whose list misses the truth are spheroids with a hump or an impurity,
  the box and cylinder families 42–78 χ²_ν ahead.
- **The spheres** (as a check, the keep test aside): 7 of 11 a ball (the nested verdict a spheroid,
  the ellipsoid not supported), 3 not determined, the textured one an elliptic cylinder.

### 3.3 The nested case

The general member always fits at least as well in principle, so the question is whether its extra
widths are supported. On the replicas of the special truths (the same bootstrap):

| special truths | clean: rows, replicas' Δ = special − general, 95 % (max) | with an error: 95 % (max) |
|---|---|---|
| square box (dP 1) | 1, 0.5 (0.7) | 5, 25.8 (50.5) |
| cylinder (dP 2) | 4, 4.7 (27.1) | 3, 42.7 (50.4) |
| spheroid (dP 2) | 3, 6.4 (8.2) | 4, 26.3 (27.6) |

- **Adopted: the 95 % χ² of the extra parameters** (3.84, 5.99, 5.99), **25 where the general
  member's check fired** (`nest`, `nestMisfit`): a model error lets the extra width absorb misfit.
- **Scored in the winning family when it is the truth's:** special truths given the special member 20
  of 22 (sqbox-Pmmm-generic at Δ 6.4 clean; spheroid-P-1-generic, texture not flagged, at 518);
  general truths given the general 19 of 26. Of the 7 given the special, four are nearly special (two
  widths within 5–17 %: Δ 0.3, 2.7, 10.0, 14.3, the last two flagged); three are not, yet the data do not
  support their third width: an ellipsoid 12 × 26 × 40 nm (Δ 0.3), elliptic sections 45 × 59 and
  17 × 52 nm (Δ 2.6, 4.5). There "an elliptic cylinder is not supported" is what the data say.
- **How to report it:** "a spheroid; an ellipsoid is not supported (Δχ² 0.3 χ²_ν, needs 6.0)", or, where
  the family is not determined, the families within the margin in order with their Δ.

### 3.4 What to try

The verdict from a subset of the six searches against all six (`fam-sub.mjs`; the margin 14 / 35):

| the user's solid | strategy | searches | right / n.d. / wrong (clean) | as all six |
|---|---|---|---|---|
| the truth's | all six | 6 | 26 / 37 / 3 (19 / 14 / 0) | 66/66 |
| the truth's | **its nested partner and the three general members** | **4** | 26 / 37 / 3 (19 / 14 / 0) | **66/66** |
| the truth's | its partner and the nearest family's general member | 3 | 28 / 34 / 4 (19 / 14 / 0) | 60/66 |
| each of the six | all six | 6 | 156 / 222 / 18 (114 / 84 / 0) | 396/396 |
| each of the six | **partner and general members** | **4** | 156 / 218 / 22 (114 / 84 / 0) | **388/396** |
| each of the six | nearest family | 3 | 130 / 172 / 94 (84 / 62 / **52**) | 250/396 |

- **The two special members of the other families never change the verdict**: a family's general
  member is its best on these rows, or within its margin.
- **The nearest family alone** works only if the user's solid is right: picked wrong, its neighbour is
  not the truth's (52 wrong claims on clean rows).
- **Cost** (X2, the stage off): a search as one solid 12.3 s on average; the four 55.5 s (4.5× the
  chosen one's, median 4.5×), the six 81.6 s (6.7×). In the prototype the rivals run as the app runs,
  with the stage: 101 s against the box's own 25 s on box-P-3m1-near, 74 s against 8 s on
  cylinder-P6m-on (§5).
- **What the app should do:** keep the single search by default; offer the comparison on request and
  report its verdict. Without it the report says the family was not tested.

## 4. The keep test

### 4.1 The nulls

The 22 tuning spheres (12 clean, 10 with an error), each searched as each of the six solids, five noise
draws: 360 clean and 300 error null runs. G is the larger gain of the search's free and held fits before
the stage (an early-stopped run: the brief trials'). `tables/step5-keep.md`.

| solid | clean nulls (60): median, 95 %, 99 %, max G | ΔBIC keeps | error nulls (50): median, max G | ΔBIC keeps |
|---|---|---|---|---|
| box | −177, 1.0, 8.7, 13.9 | 0 | 21.5, 3569 | 24 |
| square box | −184, 0.8, 7.5, 13.5 | 0 | 20.1, 3520 | 24 |
| cylinder | −74, 4.6, 10.4, 13.7 | 0 | 20.4, 3489 | 24 |
| elliptic cylinder | −59, 6.9, 12.1, 14.4 | 0 | 29.2, 3669 | 23 |
| ellipsoid | 2.1, 9.9, 15.0, 21.1 | 0 | 8.2, 3683 | 19 |
| spheroid | 1.7, 7.8, 12.9, 18.6 | 0 | 7.4, 3511 | 19 |

- **ΔBIC < −10 keeps no clean null**, but asks 28–56 of a three-width body and 19–47 of a two-width
  one (held route to free, N = 10 001): 1.3–4× the clean nulls' maxima (13.5–21.1).
- **A faceted solid is no sphere.** Its null gains are mostly far below zero; they come near the
  ball's only where the facets are not resolved (a 26.5 nm sphere at 489 counts: 13.9 as a box).

### 4.2 Why the class matters

Near a sphere, a deformation of the widths shows to first order only through its average over each
family's members: the part the Laue class leaves invariant. The symmetric traceless tensors so left
number k = (1/|G|)·Σ (1 + 2cos θ + 2cos 2θ) over the class's operations: 5, 3, 2, 1 and 0 from −1 to the
cubic classes (`laueTerms`, checked on the 11 phases). The rest shows only through the spread of the
members' widths within a line, at second order.

| clean nulls (10 a cell, 5 orth and hex) | −1 | 2/m | mmm | 4/m, 4/mmm | −3, −3m | 6/m, 6/mmm | m−3, m−3m |
|---|---|---|---|---|---|---|---|
| k + 1 | 6 | 4 | 3 | 2 | 2 | 2 | 1 |
| ellipsoid: mean G (max) | 7.3 (21.1) | 4.4 (7.4) | 3.0 (4.6) | 2.1 (3.4) | 3.4 (9.1) | 1.5 (2.8) | 0.7 (3.9) |
| spheroid: mean G (max) | 6.1 (18.6) | 3.4 (5.8) | 2.5 (4.6) | 1.3 (2.8) | 2.7 (8.9) | 1.3 (2.7) | 0.6 (2.4) |
| the four faceted solids: max G | 14.4 | 10.6 | −158 | −193 | −15 | −18 | 6.8 |

The null gain behaves as χ²_{k+1}: the class, not the solid, sets what noise can buy. One threshold for
every class must sit above the triclinic tail (21) and so asks too much of a cubic or uniaxial shape;
one per solid, set on its own nulls, sat too low for the box (6.3) and failed on fresh draws: the
faceted solids' highest nulls (13.5–14.4) are draws 3 and 4 of one 26.5 nm sphere at 489 counts.

### 4.3 The rules compared

Thresholds set on the clean nulls' draws 0–2 (216), scored on the fresh draws 3–4 (144), the error
nulls, the mild shapes and the screening truths (`keep-rules.mjs`):

| rule | clean nulls: set, fresh | error nulls | mild clean | mild error | screening truths |
|---|---|---|---|---|---|
| ΔBIC < −10 (today) | 0/216, 0/144 | 133/300 | 71/86 | 81/90 | 66/66 |
| G > 23.1, every solid (the clean nulls' max + 2) | 0, 0 | 141 (138) | 75 | 83 | 66 |
| G > its solid's clean nulls' 99 % + 2 | 4, **6** | 148 (138) | 79 | 85 | 66 |
| G > its solid's clean nulls' max + 2 | 0, **4** | 147 (138) | 77 | 85 | 66 |
| G > its solid's max + 2 in its symmetry group (k ≥ 3, k ≤ 2) | 0, **6** | 151 (138) | 80 | 85 | 66 |
| G > χ²_{k+1}(0.99) | 3, 0 | 154 (139) | 82 | 85 | 66 |
| **G > χ²_{k+1}(0.999) + 2** | **0, 0** | 142 (**138**) | **78** | **85** | **66** |
| G > χ²_{k+1}(0.9999) | 0, 0 | 141 (138) | 77 | 84 | 66 |

(In brackets: with the check, a flagged shape needing ΔBIC < −10 as well; it changes no mild shape.)

- **Adopted: χ²_{k+1}(0.999) + 2, flagged: also ΔBIC < −10.** No clean null of 360 kept (the 0.99 point
  keeps 3: the triclinic 28.8 nm sphere at 21 164 counts, as the ellipsoid and the spheroid, and a cubic
  4 nm one as an elliptic cylinder at 6.8). Every shape ΔBIC keeps is kept.
- **The mild shapes it adds** (7 clean, 4 with an error); the clean ones rejected today at ΔBIC −9.3 to +11.9:
  e.g. ellipsoid-P-3-on~m1 (r 1.06, G 23.6 against a need of 16.1), ellipsoid-P4m-near~m3 (r 1.11, 31.9),
  cylinder-P2m-near~m1 (r 1.04, 21.5), box-P4m-generic~m2 (r 1.09, 34.1), two cubic spheroids (r 1.40,
  1.50, 17.2–17.3 against 13.2).
- **The clean mild shapes it leaves** (8): four with r ≤ 1.06 and G ≤ 5.5, which no rule keeps; and
  four the 0.99 point would keep: a box at r 1.40 and 582 counts (14.0 against 16.1), a cubic spheroid
  at r 1.31 and 366 counts (8.4 against 13.2), a trigonal ellipsoid at r 1.03 (12.3 against 16.1) and a
  triclinic one at r 1.03 and 374 counts (20.0 against 24.7), a gain the triclinic nulls also reach.
- **By solid** (mild clean, ΔBIC → the adopted rule): box 10 → 11 of 12, square box 10 → 10, cylinder
  10 → 12, elliptic cylinder 12 → 12, ellipsoid 15 → 17 of 20, spheroid 14 → 16 of 20.

### 4.4 Model errors and the check

| error | nulls | kept: ΔBIC | the adopted rule | flagged at keep | real shapes (mild + screening) kept: ΔBIC, adopted |
|---|---|---|---|---|---|
| hump | 60 | 20 | 20 | 32 | 23, 23 of 23 |
| size distribution | 60 | **60** | **60** | 33 | 26, 27 of 27 |
| impurity | 60 | 4 | 4 | 32 | 24, 24 of 25 |
| air | 60 | 0 | 0 | 4 | 19, 22 of 26 |
| texture | 60 | 49 | 54 | 39 | 22, 22 of 22 |

- **A size distribution makes a shape of a sphere every time,** for every solid, at G 300–3700 (σ 0.71
  on a 4.4 nm sphere: 3500), and the check flags 33 of 60. Texture does so in 49–54 of 60, at up to 2300. These gains are
  far beyond any noise threshold; a threshold cannot remove them, nor can a bootstrap from the
  isotropic fit, whose replicas carry no error.
- **The check's part.** Without it the adopted threshold keeps 142 error nulls; with it 138 (ΔBIC
  133). It costs no mild shape: a flagged real shape has a large gain.
- **Declaring every flagged shape unsupported** would drop 89 of the 123 real shapes with an error (step
  3 found the same: 24 of 33) to remove the hump's and texture's flagged false shapes; it is not adopted.

### 4.5 The quick parametric bootstrap

The likelihood-ratio test calibrated per fit: 19 replicas drawn (Poisson) from the isotropic fit's
pattern; on each the isotropic fit refined again and the shape searched as the app does (the class's
starts, one full refinement, no stage, no check); p = (1 + #{G* ≥ G})/20 (`methods/lrt.mjs`).

Run on the 12 clean tuning spheres searched as the ellipsoid (draw 0) and on 10 mild shapes where the
rules differ (`h2`, tag L; `tables/step5-keep.md`):

| 22 fits | kept at 5 % (G above all 19 G*) | the adopted rule | replicas' mean G* against k + 1 | cost beyond the fit's search |
|---|---|---|---|---|
| clean nulls (12) | **1** (the triclinic 28.8 nm sphere, G 21.1, p 0.05) | 0 | 5.3, 5.2 (6); 5.4, 4.7 (4); 3.9 (3); 1.4–3.7 (2); 1.4, 0.8 (1) | **17.6 searches** (median; 7–26) |
| mild shapes (10) | 7 | 5 | — | — |

- **It agrees with the class law.** The replicas' mean gains follow k + 1 class by class; a fit's own null
  is no better known from 19 replicas than from the class's table.
- **It agrees with the adopted rule on 19 of 22.** It keeps two more mild ellipsoids (r 1.03: G 20.0 in
  −1 and 12.3 in −3m) and the triclinic null, each at p = 0.05, the smallest 19 replicas give: at 5 %
  one null in twenty is kept by design, and these runs found it.
- **Its cost is 18 searches a fit** (19 replicas, each the class's brief trials and one full
  refinement; 0.9 of a search each). With the sphere-like start alone a replica costs 0.15 of a search
  but finds a fraction of the null gain (0.3, −0.0, −0.2 against 2.9, 0.2, 1.1 on three replicas of a
  tetragonal sphere): its test would keep noise.
- **It cannot see a model error**: its replicas are drawn from the isotropic model.
- **Not adopted.** The class's χ²_{k+1} gives the same answer at no cost; the bootstrap could serve as a
  check where the class law is in doubt (a phase whose lines overlap heavily, a two-phase pattern).

### 4.6 Cost

- **The search.** The early rejection takes half the rule's need (`early` 0.5): 6.6–12.4 against
  today's 9.6–14.2 (held route). On the 360 clean nulls 9 searches go on to the full refinements
  against 5, 953 evaluations a search against 947 (`cost5.mjs`); on the error nulls 1378 against 1359.
- **The check** at keep: two evaluations, only where G passes the threshold.
- **No other cost.** The rule reads the search's numbers; the class's k is computed once.

## 5. The prototype

**The patch** (`proto/engine.patch`, regenerated against `9782d33`; `xrd-rietveld.js` +785 −59 in
all, step 5 about 135 lines; `RIETVELD.md` §10.8 two paragraphs; the card's texts untouched).

- **`SHAPE_KEEP`** in the tunables' block: `{ rule: 'lrt', alpha: 0.001, margin: 2, misfit: true, bic:
  10, early: 0.5, record: false }`.
  - `rule 'lrt'` (default): G > χ²_{k+1}(1 − alpha) + margin (`laueTerms(q)` from the class's
    operations, `chi2Upper` by Wilson–Hilferty); where `misfit` and the per-line check of the fit
    tested fires, ΔBIC < −bic as well.
  - `rule 'bic'`: v522's ΔBIC < −bic; `'all'`: any gain (a study's).
  - `early`: the brief trials must gain early × the rule's need (by the held route for 'bic').
  - `record`: the check made on every test (a study's).
  - The test's numbers in `info.keep` (or `keep` beside a rejection): `k`, `G`, `gainBrief`,
    `gainFree`, `gainHeld`, `dPfree`, `dPheld`, `gain`, `dP`, `need`, `dBIC`, `flagged` (where made),
    `kept`. `bodyShapeOf` passes them on as `keep`.
- **`SHAPE_FAMILY`**: `{ solids: 'none', margin: 14, marginMisfit: 35, nest: { box: 3.84, cyl: 5.99,
  ball: 5.99 }, nestMisfit: 25 }`.
  - `solids 'general'` (or `'all'`): after the chosen solid's search, `shapeFamily` searches the others,
    each in a sibling model (`siblingModel`: the model built again from `model.build`, which
    `buildModel` now keeps by reference, the phase's solid changed, the isotropic fit's values by name),
    from the same isotropic fit, as the app searches (keep test, stage, check).
  - `familyVerdict(fits, iso, nu, o)`: the verdict, in `info.family` (or `family` beside a rejection),
    passed on by `bodyShapeOf` as `family`: `family`, `by`, `margin`, `need`, `determined`, `within`,
    `solid`, `nested` ({ general, special, delta, need, supported }), `tried`, `rivals`, and each
    solid's `fits` (χ², Δ from the isotropic fit, kept, flagged, ms).
- **`opts.sphereStart`** in `freeShapeRun`: the sphere-like start alone (the bootstrap's study only).
- Exported: `SHAPE_KEEP`, `SHAPE_FAMILY`, `familyVerdict`, `siblingModel`.

**Verification** (`h2`, the final engine, `scripts/step5/jobs-F.txt`).
- **`rule: 'bic'`** (F0, 3 rows: a held spheroid, a box with two minima, the textured sphere kept as a
  box) equals step 4's S2 records to the bit: the isotropic fit, the search's and the stage's
  evaluations, χ², the outcome. The record adds only `keep` and `family: null`.
- **The defaults** (F1, 4 runs): G equals the study's records (spheroid-P-3-near 52.544, its search two
  evaluations more for the check, χ² equal to S2's; ellipsoid-P-3-on~m1 23.557, now kept against a need
  of 16.13 where ΔBIC −5.0 rejected it; the textured sphere 386.9, flagged, kept since ΔBIC −341 passes
  too, χ² and evaluations equal to X1's; sphere-P-1-2 as the ellipsoid 21.143, rejected against 24.68,
  the check not made). k is 1 in the trigonal and hexagonal classes, 5 in −1.
- **The family on** (F2, `solids: 'general'`): box-P-3m1-near a box, not determined (the elliptic
  cylinder 3.9 behind, X2's 3.5), the box supported over the square box (Δ 10.3, X2's 9.9);
  cylinder-P6m-on a cylinder family, not determined (9.3, as X2), the cylinder (the elliptic one not
  supported, Δ 3.4). The verdict reaches the report (`bodyShapeOf`'s `family`). The searches took
  101 s against the box's own 25 s, 74 s against the cylinder's 8 s.
- **Lint and tests.** `npm run lint` is clean. The engine's tests (rietveld, rvmodel, rvpool, rvsplit,
  rvlock, rvcif, rvui, smoke, widths, modules) pass, 53 of 53. No test asks for a free shape.

## 6. Decision and risks

**Decision.**
- **The keep test: χ²_{k+1}(0.999) + 2 on G, by the Laue class; flagged: also ΔBIC < −10.** On by
  default in the prototype (`SHAPE_KEEP.rule 'lrt'`); `'bic'` gives step 4 back to the bit.
- **The family: margin 14 χ²_ν, 35 flagged; the nested test at the 95 % χ², 25 flagged.** In the
  prototype behind `SHAPE_FAMILY.solids` ('none' by default): the comparison is the chosen solid's
  nested partner and the three general members, on request.
- **Not adopted:** a threshold per solid set on its own nulls (fails on fresh draws); a pooled one
  (asks the cubic classes for the triclinic tail); the per-fit bootstrap (§4.5); BIC between families
  (needs all six searches, uncalibrated); declaring flagged shapes unsupported; the nearest-family check
  alone.

**Risks.**
- **Model errors.** No keep rule removes the false shapes a size distribution or texture makes on a
  sphere, and three flagged error rows name a wrong family by 77–303 χ²_ν. The check misses 27 of the
  60 size-distribution nulls. These need a model of the error (a size distribution, texture in the
  fit), not a threshold.
- **Small numbers.** 12 clean spheres (2 a class) set the class law; 5 draws a sphere. The law k + 1 is
  read from means of 5–10 values a cell; the triclinic tail rests on one sphere (28.8 nm, 21 164
  counts, G 21.1 and 18.6). The margin's bootstrap has 20 clean and 17 flagged rows, 10 replicas each.
- **The mild shapes are derived.** Their extents are the tuning truths' pulled towards a sphere; few
  fall where the rules differ (11 of 176).
- **The instrument and line are the generator's.** A real instrument's misfit inflates the nulls'
  gains in a way these do not show; the per-line check is the guard.
- **The rejection's warning** still says "needs under −10" (a card text, not touched); with the new rule
  it must quote the need.
- **To confirm on the 154 tuning runs, then validate once:** the class law and its 0.999 point, the
  margins 14 / 35, the nested needs.

## 7. Files

- `STEP5.md`: this note.
- `proto/engine.patch`, `proto/README.md`: the prototype with `SHAPE_KEEP` and `SHAPE_FAMILY`, and this
  step's verification (8).
- `tables/step5-family.md`: margins by row, the bootstrap per row, the strategies.
- `tables/step5-keep.md`: the nulls per solid and class, the rules, error kinds, the bootstrap per fit,
  the cost.
- `scripts/step5/` with its `README.md`: `mkdesign5.mjs`, `batch5.mjs`, `run.mjs`, `make-eng.mjs`,
  `lib5.mjs`, `methods/fam.mjs`, `methods/fboot.mjs`, `methods/lrt.mjs`, `fam5.mjs`, `famverdict.mjs`,
  `fam-sub.mjs`, `fboot-jobs.mjs`, `fboot-an.mjs`, `keep5.mjs`, `keep-rules.mjs`, `cost5.mjs`,
  `lrt-an.mjs`, `peek*.mjs`, `setup.sh`, the job files.
- Not in the repository (`$W`): the records (`fs2/step5/h/results/`, `h2/results/`), the engine copies,
  the app copies `$W/step5-app` and `$W/step5-gitbase`.
