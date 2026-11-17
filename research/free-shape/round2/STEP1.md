# Free shape, round 2, step 1: search v2 on the screening set, with the lsq line and with WPPM

Step 1 of `AB.md` §6: one engine for the rest of the round, track B's search (v2) on track A's
size lines, measured on the whole 77-run screening set before anything builds on it. The engine is
the prototype `proto/engine.patch` (the lsq line and search v2, each behind a switch), with one
switch added here: where forward differences apply. The prototype's verification had found one
loss on the 22 sub-screen rows with lsq + v2 (cylinder-Pm-3m-on, an unbounded disc at +1693 χ²_ν)
and traced it to forward differences in the full refinements (`proto/README.md`, verification 2).
All data are synthetic, drawn by round 2's generator with exact lines (`../PROTOCOL.md`). Only
tuning rows were run; no validation row was run or read. `$W` is the work folder (the session's
scratchpad), not in the repository.

## Contents

1. [Summary](#1-summary)
2. [What was run](#2-what-was-run)
3. [The lsq line: 'all' and 'briefs' against today's search](#3-the-lsq-line-all-and-briefs-against-todays-search)
4. [WPPM: 'briefs' against today's search](#4-wppm-briefs-against-todays-search)
5. [The causes, checked](#5-the-causes-checked)
6. [The decision and its risks](#6-the-decision-and-its-risks)
7. [Files](#7-files)

## 1. Summary

**Decision.** On both lines the search is v2 with forward differences in the brief trials only
(`SHAPE_FWD = 'briefs'`): the full refinements, the polish, the exact faces, the held frames and
the refit keep central differences; no refinement of the search makes a covariance; the kept fit
is refined once more centrally (`SHAPE_CENTRAL`). It is now the patch's default.

| 77 screening runs | lsq, today | lsq, v2 'all' | lsq, v2 'briefs' | WPPM, today | WPPM, v2 'briefs' |
|---|---|---|---|---|---|
| search evaluations (× today) | 273 482 | 130 254 (0.476) | 168 157 (0.615) | 256 493 | 158 335 (0.617) |
| CPU of a fit, 22 sub-screen runs, one load (× today) | 1068 s | 778 s (0.73) | 859 s (0.80) | 3072 s ¹ | 2313 s (0.75) |
| held / free / rejected (early), truths | 22 / 43 / 1 (0) | 20 / 44 / 2 (1) | 21 / 43 / 2 (1) | 24 / 42 / 0 | 24 / 42 / 0 |
| outcome changed against today (of 77) | — | 2 | 1 | — | 2 |
| reached / judged (Δ ≤ 1 against the best known) | 64 / 66 | 61 / 65 | 64 / 65 | 62 / 66 | 62 / 66 |
| unbounded extents | 2 | 3 | 2 | 6 | 4 |
| worst extent, median (90 %) | +16 % (+232 %) | +15 % (+246 %) | +13 % (+187 %) | +4 % (+335 %) | +4 % (+148 %) |
| thinnest extent, median | +1 % | +1 % | +1 % | +0 % | +0 % |
| axis °, median (90 %) | 4.3 (31.8) | 4.5 (29.4) | 4.1 (29.4) | 1.6 (14.4) | 1.3 (14.4) |
| anisotropy ÷ true, clean rows all kept: median, median \|ln\|, outside 0.9–1.1 | 0.95, 0.11, 18 of 32 | 0.95, 0.09, 15 | 0.95, 0.09, 15 | 0.99, 0.02, 7 of 33 | 0.99, 0.02, 7 |
| spheres keeping a shape | 2 / 11 | 2 / 11 | 2 / 11 | 2 / 11 | 2 / 11 |

¹ Track A's one-load measure (`tables/A-cost.md`, two processes); the same measure gave lsq today
1055 s against 1068 s here, so the loads compare (§2).

- **lsq.** 'all' is the cheapest (0.476× the evaluations) but loses twice: cylinder-Pm-3m-on
  becomes an unbounded disc at +1693 χ²_ν (forward differences stall the full refinements in a
  flat valley), and the reach falls to 61 of 65. 'briefs' costs 1.29× the evaluations of 'all'
  and 1.11× its CPU, reaches 64 of 65, and changes one outcome against today's search,
  ellipsoid-Pm-3-on, an early rejection that 'all' shares and that comes from the start cut, not
  from forward differences.
- **WPPM** with 'briefs': 0.617× the evaluations, 0.75× the CPU, the same reach as today (62 of
  66, one lost and one won), two outcomes changed, accuracy as today's or better at the tail
  (90th percentile of the worst extent +148 % against +335 %, unbounded extents 4 against 6).
  With v2 a WPPM fit costs 105 s CPU a run on the 22 sub-screen rows, 2.7× lsq with v2 and 2.2×
  today's lsq (or lor) fit.
- **Every loss and its cause** (§3–§5):
  - ellipsoid-Pm-3-on, lsq, both settings: held → early rejection. Its isotropic fit read no size
    (Ys = 0), so every start sits at the floor w0 = 10⁻³°; all 7 starts of the class stop within
    1–3 iterations at the isotropic χ², and today kept the shape only through one of v522's random
    fill starts, which v2 drops. With that fill restored, v2 holds it as today.
  - cylinder-Pm-3m-on, lsq 'all': forward-difference full refinements crawl (60 and 73
    iterations) and end above the unbounded disc's χ², which the polish then cannot leave.
    'briefs' recovers the held fit, by a margin of 23 χ² (15 χ²_ν of the fits there) at the end of the full stage.
  - ellcyl-P-3-on (lsq, both) and sqbox-P-3m1-on (WPPM): forward differences in a brief trial
    end it in a neighbouring valley, or reorder brief ends 1 χ² apart, so the full refinements
    start elsewhere: +2.7 and +4.9 χ²_ν. The same mechanism wins ellcyl-P6mmm-on (lsq, −765
    χ²_ν, the solid found: worst +253 % → +5 %) and ellipsoid-Pm-3-on (WPPM, −211 χ²_ν, held at
    +3 %). Central briefs reproduce today's ends exactly.
  - box-P6mmm-on (lsq 'all'): a forward full refinement stopped on a disc; the result (held) is
    today's, only the free fit's χ² is 1.3 χ²_ν above the best known.
  - spheroid-P2m-on (WPPM): the free fit came out 0.33 χ²_ν lower and crossed the held test's
    threshold (6.04 against 5.99; today 5.71): free, 1.4° and 5 % from today's held fit.

## 2. What was run

- **The engine.** `HEAD` exported by `git archive` (the main tree untouched) and the prototype
  patch applied, then one tunable added in the patch's block of `xrd-rietveld.js`:
  `SHAPE_FWD`, `'all'` (every refinement of the search by forward differences, the prototype's
  behaviour) or `'briefs'` (the brief trials only; the full refinements, the polish, the exact
  faces, the held frames and the refit by central differences, all still without a covariance).
  In code it is one spread in freeShapeRun's `lmFull`. The prototype's diagnostic of
  cylinder-Pm-3m-on (central `lmFull`) is exactly 'briefs'.
- **The harness** is the prototype's verification harness (`proto/verify/`): `fs2/harness/lib.mjs`
  runCase, the pilot's `run.mjs` and `methods/today.mjs` (freeShape as autoRefine calls it, then
  the card's report), on an engine copy instrumented without arithmetic change. The switches come
  from the environment: `PROTO_LINE`, `PROTO_SEARCH`, `PROTO_FWD`, and `PROTO_PROFILE` for the
  phase's size profile (WPPM as track A ran it: `FS2A_PROFILE=wppm` set only that). Each row is
  drawn, fitted isotropically from its CIF and searched in one process; 3 processes at nice 15
  on 4 vCPUs, resumable, a timeout per run (30 min lsq, 60 min WPPM); no run failed.
- **The references are track A's records of today's search** on each line
  (`$W/fs2/A/results/screen-lsq`, `screen-wppm`), not re-run. Identity checks:
  - today's search re-run on two rows a line (spheroid-Pm-3-generic and ellipsoid-P6m-near with
    lsq; spheroid-Pm-3-generic and spheroid-Pm-3m-on with WPPM): equal to the bit on all four
    (isotropic fit's evaluations and χ², search evaluations, χ², outcome, dimensions, report);
  - 'all' equal to the bit with the prototype's lsq + v2 runs on their 22 rows (so the new
    switch leaves 'all' unchanged); 'briefs' on cylinder-Pm-3m-on equal to the prototype's
    diagnostic (4477 evaluations, χ² 12 939.54); the final default ('briefs', no switch set)
    equal to the 'briefs' runs on two rows.
- **Scoring** is the pilot's and AB.md's. Reach: Δ = (a run's best exact χ² − the best known) /
  max(1, χ²_ν of the best known) ≤ 1, the best known being the lowest exact χ² of every record on
  the same line (track A's today and truth reference, its sub-screen, sphere and cross-solid
  records of the row's own solid, the prototype's runs, every run of this step); judged on truths,
  not on early rejections. Accuracy as A's: the worst |extent error| (+∞ for an unbounded extent),
  the truth's thinnest extent, its most distinct axis, modulo the class and the solid; anisotropy
  longest/thinnest read ÷ true, on the clean truths every variant kept. "Solid changed": an extent
  by more than 5 % or the axis by more than 2°.
- **Cost.** Evaluations are machine-independent. CPU (`process.cpuUsage` of the isotropic fit +
  search + report) and walls: 'all' and 'briefs' ran interleaved row by row in one batch, so they
  are paired under one load. Today's search was not re-run for time; its CPU under this load is
  the prototype's paired run on the 22 sub-screen rows (`$W/proto-h/results/t2`), which is valid
  here because 'all' on the same 22 rows took 778 s CPU against the prototype's 784 s
  (bit-identical runs). For WPPM today, track A's one-load CPU on the 22 rows (two processes;
  lsq today 1055 s there, 1068 s here).

## 3. The lsq line: 'all' and 'briefs' against today's search

**Outcome and reach** (`tables/step1-lsq.md`, per run):

- **'all'**: outcome changed on 2 (cylinder-Pm-3m-on held → free, unbounded; ellipsoid-Pm-3-on
  held → early); reach lost on 3 (cylinder-Pm-3m-on Δ 1696, ellcyl-P-3-on 2.7, box-P6mmm-on 1.3)
  and won on 1 (ellcyl-P6mmm-on, 828 → 0); ellipsoid-P2m-near, a miss for today too, goes from
  Δ 1.2 to 1.9. The returned χ² is within 0.1 χ²_ν of today's on 60 of the 66 runs both kept, lower
  on 3 (ellcyl-P6mmm-on −765, sqbox-P6m-near −0.47, sphere-P6mmm-1 −0.32), higher on 3
  (cylinder-Pm-3m-on +1693, ellcyl-P-3-on +2.67, sqbox-Pm-3-on +0.33).
- **'briefs'**: outcome changed on 1 (ellipsoid-Pm-3-on); reach lost on 1 (ellcyl-P-3-on) and won
  on 2 (ellcyl-P6mmm-on; ellipsoid-P2m-near 1.2 → 0). The returned χ² within 0.1 χ²_ν on 60 of 66,
  lower on 4 (ellcyl-P6mmm-on, sqbox-P6m-near, box-P-3-on −0.42, sphere-P6mmm-1), higher on 2
  (ellcyl-P-3-on +2.66, sqbox-Pm-3-on +0.33). The solid changed on 5, of which two gain accuracy
  (ellcyl-P6mmm-on, box-P6m-generic: worst +33 % → +12 %), two are flat turns at the same extents
  (box-P-3-on 8.9°, sphere-P6mmm-1 2.4°), and one is the loss ellcyl-P-3-on (axis 25.1° → 8.7°,
  worst +29 % → +32 %).
- **Spheres**: the same 2 of 11 keep a shape in all three (sphere-P6mmm-1, texture, ΔBIC −365;
  sphere-Pm-3m-3, size distribution, −1775); every sphere's outcome and ΔBIC (to within 1) is
  today's.
- **The kept truths' accuracy** moves little, and 'briefs' is the best of the three at the tail:
  worst +13 % (90 %: +187 %) against today's +16 % (+232 %); thinnest +1 % in all; axis 4.1°
  against 4.3°. On the 32 clean truths all three kept, the anisotropy reads 0.95 in all, with
  15 rows outside 0.9–1.1 against today's 18.

**Where the evaluations go** (sums over the 77 runs; refinements; iterations a refinement;
evaluations an iteration, the covariance included where one is made):

| stage | lsq today | lsq 'all' | lsq 'briefs' | WPPM today | WPPM 'briefs' |
|---|---|---|---|---|---|
| brief trials | 180 236 (847; 7.8; 27.3) | 81 546 (749; 7.8; 14.0) | 81 546 (749; 7.8; 14.0) | 177 530 (847; 7.8; 26.9) | 79 095 (749; 7.8; 13.6) |
| full refinements and polish | 69 242 (282; 9.2; 26.6) | 35 617 (277; 9.6; 13.4) | 65 281 (278; 9.9; 23.8) | 56 891 (279; 7.5; 27.2) | 58 022 (277; 8.7; 24.0) |
| exact faces and refit | 7 819 (57; 4.7) | 3 553 (57; 4.4) | 6 649 (59; 4.6) | 7 985 (53; 5.3) | 7 364 (53; 5.7) |
| held frames | 16 185 (111; 7.7) | 6 288 (88; 7.6) | 11 388 (88; 7.6) | 14 087 (107; 6.8) | 10 556 (89; 6.9) |
| central pass on the kept fit | — | 3 250 (66; 1.2) | 3 293 (66; 1.2) | — | 3 298 (68; 1.2) |

- The brief trials are 66 % of today's evaluations; forward differences and the start cut (847 →
  749 trials) cut them to 0.45× today's. 'briefs' then pays central Jacobians in the full, exact and held
  stages (+37 900 evaluations against 'all'), whose iterations do not change (9.9 against 9.6 a
  full refinement).
- Per run 'briefs' makes 1.23× the evaluations of 'all' (median; 1.00–1.91) and costs 1.09× its
  CPU (0.91–1.70): the evaluations added are cheap Jacobian columns, and the isotropic fit and the
  report (identical in both) take 44–49 % of a fit's wall time.
- **Per Laue class** (search evaluations × today's):

| class | −1 | 2/m | mmm | 4/m | 4/mmm | −3 | −3m | 6/m | 6/mmm | m−3 | m−3m |
|---|---|---|---|---|---|---|---|---|---|---|---|
| lsq 'all' | 0.50 | 0.49 | 0.51 | 0.52 | 0.54 | 0.49 | 0.45 | 0.44 | 0.46 | 0.36 | 0.46 |
| lsq 'briefs' | 0.61 | 0.60 | 0.61 | 0.70 | 0.68 | 0.61 | 0.55 | 0.55 | 0.62 | 0.46 | 0.73 |
| WPPM 'briefs' | 0.60 | 0.63 | 0.59 | 0.69 | 0.68 | 0.70 | 0.58 | 0.51 | 0.58 | 0.65 | 0.54 |

**Time** (77 runs, one load; CPU of iso + search + report, and walls). 'all' 2636 s CPU (34.2 s a
run), search wall 1285 s; 'briefs' 2938 s (38.2 s), 1564 s: 1.11× the CPU and 1.22× the search
wall of 'all', for 1.29× its evaluations. On the 22 sub-screen runs against today's search under
the same load: CPU 0.73× ('all') and 0.80× ('briefs'), the search's wall 0.56× and 0.67×,
evaluations 0.48× and 0.62×.

**Each loss.**

- **cylinder-Pm-3m-on** (m−3m, 18.7 × 18.7 × 3.7 nm, size distribution 0.72; 'all' only). Today
  holds 19.2 × 3.6 nm at χ² 12 939.5; two of its three best brief ends came from v522's random
  fill (14 826.3, an unbounded disc, and 17 388.6, from which a central full refinement reaches
  13 090 in 28 iterations). v2's three best brief ends are the class's (26 180, 26 830, 32 625).
  Under 'all' the full refinements from them end at 14 819.6 (the disc), 15 190.5 (60
  iterations, the cap) and 15 089.0 (73); the polish from the disc stays on it, and the result is
  the disc, unbounded, 3.15 nm thick, at +1693 χ²_ν. Under 'briefs' the same full refinements end
  at 14 819.6, 14 796.6 (60 iterations) and 15 810.5: the second ends 23 χ² below the disc, the
  polish continues it to 12 998.1 and the held fit is today's (4477 evaluations against today's
  3797 and 'all''s 2340). So central differences keep descending where forward ones stall, but
  the recovery rests on a 23 χ² margin (15 χ²_ν) and on a polish from a refinement stopped by its cap.
  With WPPM, today and 'briefs' both miss this row by 1502 χ²_ν (track A's known miss).
- **ellipsoid-Pm-3-on** (m−3, 2.39 × 11.65 × 60 nm, texture 0.23, 885 counts; both settings).
  §5.
- **ellcyl-P-3-on** (−3, 3.5 × 5.1 × 5.2 nm, impurity; both settings). The trial from the
  sphere-like start ends at 5.52 × 4.30 × 3.50 by forward differences against 5.69 × 4.13 × 3.74
  by central ones; the full refinements then settle in the valley at 16 017.6 (4.21 × 3.55) rather
  than 16 013.7 (4.06 × 3.70), and the result is 2.7 χ²_ν above today's: worst +32 % against
  +29 %, the axis 8.7° against 25.1° off. Central briefs reproduce today's end exactly (§5).
- **box-P6mmm-on** (6/mmm, impurity; 'all' only). The result, held, is today's (χ² 13 400.25
  against 13 400.28). The reach counts the free fit: one forward full refinement stopped on a disc
  (13 648) where the central one went to 13 394; the exact refinement brought it to 13 393.7,
  1.3 χ²_ν above 'briefs'' 13 391.9.
- **sqbox-Pm-3-on** (m−3, a 12.7 nm near-cube; both, +0.33 χ²_ν, reached). A flat landscape:
  today's third full refinement started from a fill trial's end; v2's start from the class's, stop
  after one iteration, and the polish lands 1.1 χ² higher. The extents are today's within 0.5 %.

**The gains.** ellcyl-P6mmm-on (clean, 4.3 × 11.7 × 34.2 nm), today's worst miss (828 χ²_ν, a
41 × 12 × 3.7 nm plate, the axis 87° off): in v2 the forward-difference trial from the sphere-like
start ends at 21 040 (4.42 × 11.6 × 58.7) instead of 26 061, and the search goes on to 4.29 ×
11.60 × 32.6 nm, worst +5 %, axis 0.5°, in both settings; central briefs reproduce today's miss
(§5). box-P6m-generic: worst +33 % → +12 %; ellipsoid-P2m-near reached by 'briefs'.

## 4. WPPM: 'briefs' against today's search

(`tables/step1-wppm.md`.) WPPM ran with the setting the lsq line chose ('briefs'), since it was
clearly the better of the two there; 'all' was not run with WPPM.

- **Outcome** the same on 75 of 77. ellipsoid-Pm-3-on free → held: today's is an unbounded
  plate (∞ × 2.36 × ∞) 217 χ²_ν above the best known; in v2 the forward-difference trial from
  the first plate start ends at 10 183 (against 10 807), the full refinement reaches 10 140.9, and
  the held fit is 11.86 × 62.0 × 2.43 nm against the truth's 11.65 × 60 × 2.39 (worst +3 %).
  spheroid-P2m-on held → free (§1; 2/m, impurity 0.85, isotropic χ²_ν 61.5): the same held fit,
  a free fit 0.33 χ²_ν lower whose gain over the held one crosses the 95 % χ² of 2 turns (6.04
  against 5.99); worst +11 % against +6 %, axis 1.4° against 0°.
- **Reach** 62 of 66 as today. Lost sqbox-P-3m1-on (−3m, 13.0 × 13.0 × 6.6 nm, texture 0.70, 341
  counts): the trial from one start ends 1.0 χ² lower by forward differences (10 266.2 against
  10 267.2), which pushes the needle's trial end (10 266.9) out of the three refined fully; today
  refined it and returned the needle (6.35 × 6.35 × ∞, the lowest χ², axis 62° off), v2 returns a
  12.7 × 12.7 × 4.6 nm plate 4.9 χ²_ν higher (worst +30 %, axis 20°): a loss in χ² and a gain in
  accuracy, on a row whose texture the model leaves out. Won ellipsoid-Pm-3-on. The other misses
  are today's: sqbox-Pmmm-generic 6.6, cylinder-Pm-3m-on 1502, ellcyl-P-3m1-near 1.5 → 1.3.
- **The returned χ²** within 0.1 χ²_ν of today's on 62 of 68 kept runs; lower on 4
  (ellipsoid-Pm-3-on −211, spheroid-P2m-on −6.19, ellcyl-P-3m1-near −0.24, ellcyl-P-1-near −0.20),
  higher on 2 (sqbox-P-3m1-on +4.89, sphere-P6mmm-1 +0.14).
- **Accuracy** of the kept truths: worst +4 % (90 %: +148 % against +335 %), thinnest +0 %, axis
  1.3° against 1.6°; unbounded extents 4 against 6 (ellipsoid-Pm-3-on and sqbox-P-3m1-on are
  bounded now; box-P6mmm-on, ellcyl-P-1-near, ellcyl-P-3m1-near, ellipsoid-P4mmm-near remain, all
  with a model error). Anisotropy on the 33 clean truths as today (0.99, |ln| 0.02, 7 outside).
- **Spheres**: the same 2 of 11 (sphere-P6mmm-1 ΔBIC −326, sphere-Pm-3m-3 −3483).
- **Cost**: 0.617× the search evaluations (per run median 0.564; per class 0.51–0.70); 8439 s
  CPU on the 77 runs (110 s a run), 2.87× lsq with 'briefs' under the same load; on the 22
  sub-screen runs 2313 s against today's 3072 s (0.75×), and against lsq: 2.7× 'briefs', 2.2×
  today's lsq. AB §1 had estimated WPPM with B's search at about 1.6× today's lor wall time; the
  measured CPU is 2.2× (the isotropic fit and the report, 47 % of a WPPM fit's wall time here, are
  not cut by the search).

## 5. The causes, checked

Two switches that are not in the app, on a diagnostic copy of the harness engine (`hd/`): v522's
random fill restored inside v2 (`DIAG_FILL=1`: the same random starts, from the main stream), and
central differences in the brief trials too (`PROTO_FWD=none`: no forward differences anywhere).

| run | v2 'briefs' | diagnostic | today |
|---|---|---|---|
| ellipsoid-Pm-3-on, lsq, + v522's fill | early rejection (ΔBIC +18), 228 evaluations | held 71.9 × 12.3 × 2.44 nm, χ² 10 191.97, 1670 evaluations | held, χ² 10 191.97, 2409 |
| ellcyl-P-3-on, lsq, central briefs | free, χ² 16 014.83 | free, χ² 16 010.55, 5979 evaluations | free, χ² 16 010.55, 6308 |
| ellcyl-P6mmm-on, lsq, central briefs | free, χ² 19 540.28 | free, χ² 21 161.60 (today's miss) | free, χ² 21 161.66 |

- **ellipsoid-Pm-3-on: the start cut, where the isotropic fit reads no size.** The isotropic fit
  put all the broadening in the strain (Ys = 0), so the search starts from w0 = max(Ys, 10⁻³°): a
  body of about 8 µm. From there the 7 starts of m−3 stop after 1–3 iterations at χ² 15 159–15 162
  (the isotropic 15 159.6), their extents running to ∞; v522's fill draws widths around w0 with a
  spread, and its start #9 (10× wider) reached 10 817 and the held minimum. Under lor (the pilot)
  three of the seven class starts got away from the same floor; under lsq none, which fits the
  lsq line's shape at a small width (the ball's [kg, kl] = [0.93, 0.40]: a Gaussian in quadrature,
  with no slope at zero width, and a Lorentzian at 0.40 of lor's). 5 of the 77 runs have Ys = 0;
  this is the one that fails. Forward differences play no part: the class's trials end at the same
  χ² by either.
- **ellcyl-P-3-on and ellcyl-P6mmm-on: forward differences in the brief trials.** With central
  briefs v2 ends where today ends on both, the miss included. A brief trial is 8 iterations of an
  unconverged path; forward differences change the path, and in a landscape with neighbouring
  valleys the end, both ways. AB §4.2 saw the same on lor (one outcome of 77).
- **cylinder-Pm-3m-on: forward differences in the full refinements**, as the prototype found; v2
  with v522's fill kept loses it too (the prototype's t5), so the start cut alone does not
  explain it, and central full refinements recover it (§3).

## 6. The decision and its risks

**lsq: v2 with `SHAPE_FWD = 'briefs'`.** Against 'all' it removes the one serious loss (an
unbounded disc at +1693 χ²_ν on a held cylinder) and three reach losses, for 1.29× the
evaluations and 1.11× the CPU; against today it makes 0.615× the evaluations and 0.80× the CPU of
a whole fit, reaches as often (64 of 65 against 64 of 66), keeps the same spheres, and reads the
solids as well or a little better (worst +13 % against +16 %, its 90th percentile +187 % against
+232 %).

**WPPM: v2 with `SHAPE_FWD = 'briefs'`** (the same default; `SHAPE_FWD` is one tunable for both
lines). 0.617× the evaluations, 0.75× the CPU, the reach and the spheres as today, a long tail
shortened (unbounded extents 4 against 6), one held fit turned free on a threshold.

**The patch** (`proto/engine.patch`, regenerated against `9782d33`): `SHAPE_FWD` in the block of
tunables, default 'briefs'; its comment, the search's comments, `SHAPE_FILL`'s, and
`RIETVELD.md` §10.5 say what was measured. `npm run lint` is clean; the engine's tests
(rietveld, rvmodel, rvpool, rvsplit, rvlock, rvcif, rvui, smoke, widths, modules) pass, 53 of 53.
`proto/README.md` has the switch and this step as verification 4.

**Risks.**

- **The start cut is not free under lsq.** v2 has no random start, and when the isotropic fit
  reads no size every start of the class sits at w0's floor, where the lsq line hardly moves.
  One run of 77 lost its shape to an early rejection; the fill had saved it by chance (one random
  start in four). A floor for w0 from the instrument's width, or a few random starts
  (`SHAPE_FILL`), are the candidates; they change runs, so they belong to the tuning runs (154),
  measured as here.
- **Forward-difference trials reorder near-equal ends.** Two losses (2.7 and 4.9 χ²_ν) and two
  gains (765 and 211) on 154 line × row runs: noise of the same kind as the random turn (AB §4.6),
  which decides among flat-valley minima. The minima stage of the protocol (every true minimum
  refined to one level, the spread within a calibrated Δχ²) should make the result independent of
  it; until then a returned free fit can differ from today's by a few χ²_ν on such rows.
- **cylinder-Pm-3m-on is kept by a margin**, not by a mechanism: the class's starts lead its full
  refinements into a crawl (60 iterations at the cap) and the held basin is reached through the
  polish of one of them, 23 χ² below the disc. A fourth full refinement or a central re-refinement
  of the best brief ends would make it robust; untested. WPPM misses this row either way.
- **Timing against today** is not re-run on the 77: the CPU ratios against today come from the 22
  sub-screen rows (paired with the prototype's run under the same load, the load checked to 1 %),
  and for WPPM from track A's one-load measure.
- **Held or free on a threshold.** spheroid-P2m-on shows that a free fit 0.3 χ²_ν lower can turn
  a held result free; any search change moves such cases. The held test is not part of this step.

## 7. Files

- `STEP1.md`: this note.
- `proto/engine.patch`, `proto/README.md`: the prototype with `SHAPE_FWD` ('briefs' by default)
  and this step's verification.
- `tables/step1-lsq.md`, `tables/step1-wppm.md`: the score tables (overall, anisotropy, changes
  against today, cost, per class, every run with its outcome, evaluations, Δ, worst, thinnest and
  axis).
- `scripts/step1/` (ran in `$W/fs2/step1/h/`, beside the shared `fs2/` folders):
  - `setup.sh <repository>`: the patched app copy (`git archive` and `git apply`) and the
    harness folder; `make-eng.mjs [patched tree]`: the instrumented engine copy, `SHAPE_FWD` from
    `PROTO_FWD`;
  - `run.mjs` (the pilot's one command, the switches from `PROTO_LINE`, `PROTO_SEARCH`,
    `PROTO_FWD`, `PROTO_PROFILE`), `batch.mjs <jobs file>` (≤ 3 processes, nice 15, timeouts,
    resumable, validation rows refused), `mkjobs.mjs` and the job files `jobs0.txt` (identity
    checks), `jobs1.txt` (lsq 'all' and 'briefs', interleaved), `jobs2.txt` (WPPM 'briefs');
  - `ident.mjs <mine> <reference>` (bit identity), `score.mjs --line --v --best` (the tables, with
    `best-lsq.txt`, `best-wppm.txt`: the records the best known is taken over), `stages.mjs`
    (evaluations by stage), `cost.mjs` (CPU and walls), `why.mjs <row> <dir>…` (a run's
    refinements, stage by stage), `ls-a.mjs` (track A's records at a glance);
  - `hd/make-diag.mjs` and `hd/jobs-fill.txt`, `hd/jobs-none.txt`: the diagnostics of §5.
- Not in the repository: the records (one JSON per run) in `$W/fs2/step1/h/results/` (`id-lsq`,
  `id-wppm`, `chk-v2b`, `v2a-lsq`, `v2b-lsq`, `v2b-wppm`, `def-lsq`) and
  `$W/fs2/step1/hd/results/`; the patched copy in `$W/step1-app` (`setup.sh` makes it
  as `fs2/step1/app`; it was moved out of `fs2/step1` so that the work folder's checkpoint does not
  copy it; `make-eng.mjs $W/step1-app` builds the engine from it).
