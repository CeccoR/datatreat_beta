# Free shape, round 2, step 2: the exact (WPPM) size line made cheaper than lsq

Step 2 of `AB.md` §6: make WPPM, the size line that never puts a solid in the wrong family (AB
§3.6: expected family margins 8 right / 3 within ±3 / 0 wrong), cheap enough to be the free
shape's default, keeping its accuracy. Before this step a WPPM fit with search v2 cost 2.13× the
CPU of today's fit (the Lorentzian with v522's search) and lsq's 0.74× (22 sub-screen runs, one
load). The engine is the prototype (`proto/engine.patch`), search v2 at its defaults ('briefs').
All data are synthetic, drawn by round 2's generator with exact lines (`../PROTOCOL.md`); only
tuning rows were run, no validation row was run or read. `$W` is the work folder (the session's
scratchpad), not in the repository.

## Contents

1. [Summary](#1-summary)
2. [What was run](#2-what-was-run)
3. [Where WPPM's cost went](#3-where-wppms-cost-went)
4. [Each step, cheapest first](#4-each-step-cheapest-first)
5. [The line and the pattern](#5-the-line-and-the-pattern)
6. [The fits](#6-the-fits)
7. [The solids](#7-the-solids)
8. [The prototype](#8-the-prototype)
9. [Decision and risks](#9-decision-and-risks)
10. [Files](#10-files)

## 1. Summary

**Decision.** WPPM's evaluation is made about five times cheaper by three shortcuts (`WPPM_OPT` in
`xrd-broad.js`: `fast`, `pair`, `axial`, all on) beside two changes that leave every number as it
was, and the exact line becomes the free shape's default size line (`SHAPE_MODE.line` 'exact': a
phase with a body for its free shape is a WPPM phase). The finalist, W4 (all of it), costs 0.42×
today's CPU, below lsq's 0.74×, with WPPM's outcome, reach, accuracy and family margins.

| 22 sub-screen runs, one load | today (lor, v522) | lsq, v2 | WPPM, v2 (step 1) | W1: bit for bit | W3: + fast, pair | W5: + fast, axial | **W4: + fast, pair, axial** |
|---|---|---|---|---|---|---|---|
| CPU of a fit (iso + search + report), s (× today) | 1100 (1.00) | 815 (0.74) | 2342 (2.13) | 1295 (1.18) | 875 (0.80) | 576 (0.52) | **458 (0.42)** |
| per run: median (range) × today | 1 | 0.76 (0.47–1.40) | 1.81 (0.86–3.58) | 0.97 (0.44–1.91) | 0.74 (0.30–1.27) | 0.50 (0.22–0.95) | **0.41 (0.19–0.76)** |
| ms CPU an evaluation | 8.2 | 8.5 | 26.9 | 14.9 | 10.2 | 6.6 | **5.3** |
| pattern against step 1's WPPM, max of the peak | — | — | — | 0 | 1.3·10⁻⁵ | 1.7·10⁻¹⁰ | **1.3·10⁻⁵** |
| held / free / rejected; reached (Δ ≤ 1); worst; thinnest; axis | | | 8 / 14 / 0; 20/22; +6 %; +0 %; 1.9° | the same runs | the same | the same | **the same** |

| 77 screening runs | WPPM, v2 (step 1) | W5 | **W4** |
|---|---|---|---|
| held / free / rejected (early); outcome changed | 24 / 42 / 0 (0) | 23 / 43 / 0 (0); 1 | **25 / 41 / 0 (0); 1** |
| reached / judged; unbounded extents | 62 / 66; 4 | 62 / 66; 4 | **62 / 66; 4** |
| worst extent (90 %); thinnest; axis ° (90 %) | +4 % (+148 %); +0 %; 1.3 (14.4) | +4 % (+148 %); +0 %; 1.3 (14.3) | **+4 % (+148 %); +0 %; 1.2 (14.3)** |
| anisotropy ÷ true, 33 clean: median, median \|ln\|, outside 0.9–1.1 | 0.99, 0.02, 7 | 0.99, 0.02, 7 | **0.99, 0.02, 7** |
| spheres keeping a shape | 2 / 11 | 2 / 11 | **2 / 11** |
| search evaluations | 158 335 | 0.984× | **0.984×** |
| CPU of the 77 fits ¹ | 8439 s | 2048 s (0.24×) | **1678 s (0.20×)** |
| expected family margins (11 clean rows): right / within ±3 / wrong | 8 / 3 / 0 (track A) | — | **8 / 3 / 0** |

¹ Step 1's runs under a like load (three processes), not the same one; step 1's lsq with v2 took
2938 s there, so W4 costs about 0.57× lsq on the 77.

- **Where the cost went** (§3): 96 % of a WPPM fit's CPU was in `phasePattern`; of it the read-out
  62 % (each line read at every point of its ±40-FWHM window with a sine, a cosine and
  `Math.floor` a point), the axial divergence's nodes 23 % (the Soller cells computed again for
  every θ a Jacobian's cell column or a trial step visits), the FFTs 7 %, the common factor 3 %,
  the members' size coefficients A(L) 1.2 %. A non-linear Jacobian column always recomputed the
  whole pattern, whichever the parameter. Caching a member's size transform for the non-shape
  columns would have saved at most the 1.2 %.
- **What worked** (§4): the read-out from a table of the points' sinθ and cosθ and an integer
  floor, and a least-recently-used Soller cache (W1: the same numbers to the bit, 0.55× step 1's
  WPPM CPU); recurrences and reciprocals (`fast`); a reflection's Kα1 and Kα2 lines by one FFT
  (`pair`); the axial shift of a one-node line interpolated in θ between Soller cells kept at
  multiples of 10⁻⁴ rad (`axial`, the largest single gain after the read-out).
- **What was not needed**: a coarser grid (the FFT is now a small part, and a step of H/6
  instead of H/8 already moves the pattern by up to 10⁻³ of the peak, H/4 by 6.5·10⁻³ and the
  error against the generator from 0.29 % to 0.45 %), tabulated exact lines with analytic
  convolutions, and the split (lsq in the brief trials): a WPPM evaluation now costs less than an
  lsq one (5.3 against 8.5 ms).
- **The cross-solid searches** (one noise draw, track A's xconf) with W4 and search v2 give track
  A's WPPM confusion matrices and margin counts exactly (by χ² at m = 3: right family 9,
  undetermined 2, other 0), at 2232 evaluations and 14.8 s a search against 3713 and 187 s.

## 2. What was run

- **The engines.** Step 1's (`$W/step1-app`, the prototype as `STEP1.md` left it) and step 2's
  (`$W/step2-app`, a copy edited here; `setup.sh` rebuilds both from the repository), each copied
  into the harness by `make-eng.mjs` (counters and the refine log, no arithmetic change), the
  switches from the environment (`PROTO_LINE`, `PROTO_SEARCH`, `PROTO_FWD`, `PROTO_PROFILE`, and
  `PROTO_WPPM` for `WPPM_OPT`). The runs used a frozen copy (`eng2`) made before the 'exact'
  option and the defaults were written; the final engine reproduces its records bit for bit (§8).
- **The harness** is step 1's (`fs2/harness/lib.mjs` runCase, the pilot's `run.mjs` and
  `methods/today.mjs`): one process a row draws the pattern, fits it isotropically from the CIF,
  runs freeShape as autoRefine does and the card's report; WPPM as track A ran it (the phase's
  size profile WPPM). Batches of at most three processes at nice 15 on 4 vCPUs, resumable, with
  timeouts (`batch2.mjs`); no run failed.
- **Profiles** (§3): the same runs on an engine copy with timers around WPPM's parts
  (`prof/make-prof.mjs`), one row a Laue class; a central refinement from the truth for the
  Jacobian's columns (`prof/prof.mjs`); `node --cpu-prof` and a micro-benchmark of the read-out
  (`bench/rd.mjs`).
- **The variants** (§4), each measured against WPPM itself: the pattern at the truth against
  step 1's engine and against the generator's exact pattern (`bench/ident-pat.mjs`,
  `bench/pattern2.mjs`); then the fits.
- **The sub-screen** (22 rows, `fs2/A/subscreen.txt`), 154 runs interleaved row by row under one
  load: T (today: the Lorentzian and v522's search, on step 1's engine), W0 (WPPM with v2 on step
  1's engine), W1, W3, W5, W4 (step 2's engine with the switches), L1 (lsq with v2 on step 2's).
  Identity: T equals the pilot's records on 22 of 22 (the iso fit's evaluations and χ², the
  search's evaluations and χ², outcome, dimensions, the report's evaluations); W0 and W1 equal
  step 1's WPPM records (`v2b-wppm`) on 22 of 22; L1 equals step 1's lsq records on 22 of 22.
- **The 77 screening runs** for the two finalists, W4 and W5 (the other 55 rows as one batch),
  against step 1's WPPM records.
- **Scoring** is step 1's (`score.mjs`, the sub-screen added): outcome, reach (Δ ≤ 1 χ²_ν against
  the best known exact χ² over every WPPM record: track A's, step 1's and step 2's), the returned
  χ² against the reference, the solid changed (an extent by more than 5 % or the axis by more
  than 2°), accuracy of the kept truths (worst |extent error|, thinnest, most distinct axis),
  anisotropy on the clean truths every variant kept, spheres kept; CPU of iso + search + report
  (`process.cpuUsage`) and evaluations (`cost2.mjs`).
- **The solids** (§7): track A's expected margins (noise-free fits to the exact pattern,
  `bench/shapesep2.mjs`) and its cross-solid searches (each clean row searched as each solid,
  early rejection off, `runxs.sh`; read by track A's `xconf.mjs`), with W4.

## 3. Where WPPM's cost went

Eleven whole WPPM runs on step 1's engine, one a Laue class, with timers inside `phasePattern`
(`tables/step2-prof.md`):

| | read-out | axial nodes | FFT | common factor | fill | size A(L) | ms an evaluation |
|---|---|---|---|---|---|---|---|
| share of `phasePattern` (all 11) | 62 % | 23 % | 7 % | 3 % | 1.5 % | 1.2 % | 7.7 (m−3m) – 72.3 (−1) |
| range over the rows | 51–74 % | 12–31 % | 5–11 % | 2–5 % | 1–2 % | 1–3 % | |

- **The read-out.** Each line is synthesised on a grid of an eighth of its narrowest width over
  its window (±40 FWHM, or further for a strong line) and read at every pattern point of the
  window: 3700–8900 points a line, 24 lines an evaluation in m−3m and 194 in −1. Each point took
  a `Math.sin`, a `Math.cos`, a `Math.floor` and a modulo: 16–20 ns a point in the
  micro-benchmark, against 1.1–1.3 ns for a pseudo-Voigt point of the lsq line. So WPPM cost most
  where a reflection has one member (−1: 3.6× today in AB §3.5) and least in cubic.
- **The axial nodes.** A line's Soller cells (a few thousand arccosines) depend on θ alone and were
  kept for 512 lines, oldest first. A Jacobian column of a cell parameter moves every line's θ, so
  each column computed every line's cells twice, and with 428 lines (−1) the first such column
  pushed the lines at v out of the cache for the next column. In a central refinement of
  box-P-1-near with the cell free the cells took 26 % of a WPPM evaluation and about four fifths
  of an lsq one: an lsq cell column cost 71–86 ms against 7–8 ms for the others. The same cost
  sits in today's fit.
- **The Jacobian.** Every non-linear column of a WPPM refinement recomputed the whole pattern:
  B, Xs, the widths and the turns 99–117 ms a column on box-P-1-near, the cell's 175–193 (the
  cells again). Nothing was reused within a Jacobian. The part a per-shape cache of the members'
  transforms would keep is the 1.2 % of A(L); the FFT's length was 1024 for 63–100 % of the
  lines.

## 4. Each step, cheapest first

Each step on top of the one before, measured against WPPM itself (the pattern at the truth, the
fits; §5, §6):

| step | what | pattern against WPPM, max of the peak | CPU × today (22 runs) |
|---|---|---|---|
| — | WPPM with v2 on step 1's engine (W0) | — | 2.13 |
| 1 (W1) | the read-out: each point's sinθ and cosθ from a table made once per grid, its cell by an integer truncation, the period unwrapped (no modulo); the Soller cells kept for the 2048 lines last used | 0 (bit for bit; the 22 runs identical to step 1's) | 1.18 |
| 2 (`fast`) | the common factor's exponentials by recurrence in L (two products a point against three exponentials); the read-out by reciprocals, the edge value taken off the period first | 1.6·10⁻¹² | — |
| 3 (`pair`, W3) | a reflection's Kα1 and Kα2 lines on one grid (the finer step, the wider window) by one FFT: the line's coefficients are Hermitian, so one line in the real part and the other in the imaginary part come back as the two profiles; the size coefficients, a function of L alone, made once | 1.3·10⁻⁵ | 0.80 |
| 4 (`axial`, W5 without `pair`, W4 with it) | a line with one axial node (nearly all of a sample's lines) takes its shift, spread and reach from the Soller cells at the two nearest multiples of 10⁻⁴ rad in θ, linearly | 1.7·10⁻¹⁰ | 0.52 (W5), 0.42 (W4) |

- **Step 1 is free.** The table holds the same sines and cosines; the integer truncation gives
  the same cell (`m = ⌊f⌋` as `f | 0`, less one where f is negative and not whole); the cache
  returns the same cells. The 22 runs are step 1's to the bit, at 0.55× its CPU. In the
  micro-benchmark a read-out point costs 9 ns against 16–20.
- **Step 2** removes the read-out's three divisions a point (5 ns) and the common factor's
  exponentials; only rounding changes (1.6·10⁻¹² of the peak).
- **Step 3** halves the FFTs and the size coefficients. The Kα2 line is then drawn over the Kα1
  line's window when that is the wider: its edge value, taken off at the window's edge, changes,
  hence the 10⁻⁵.
- **Step 4** is the largest single gain after the read-out. A cell column or a trial step moves θ
  by far less than 10⁻⁴ rad, so the two cells it interpolates between are already kept, and a
  pattern's lines need two cells each instead of a new one at every θ. The shift is linear in θ
  over 10⁻⁴ rad within about 10⁻⁷° at 2θ = 10° (its second derivative there is about 14°/rad²)
  and continuous in θ. Lines with two or more nodes (narrow lines at low angle) still compute their
  cells exactly. It applies to WPPM's lines only; the lsq and Lorentzian lines are as before.
- **Not done.**
  - Caching the members' size transforms across a Jacobian: they were 1.2 % of an evaluation.
    `pair` makes them once for both lines, which is all a cache within one evaluation could do.
  - A coarser grid where the line is broad: after step 4 the FFT is a small part of an evaluation
    and the read-out does not shrink with the grid. Measured on W4 (§5), a step of H_min/6
    instead of H_min/8 moves the pattern by up to 1.0·10⁻³ of the peak (2.7·10⁻⁴ median), and
    H_min/4 by 6.5·10⁻³, its error against the generator 0.45 % of the peak (median) against
    0.29 %.
  - Exact lines tabulated in reduced variables and convolved analytically or as sums of
    pseudo-Voigts: each member would cost one or more pseudo-Voigt passes over the window, the
    lsq line's cost or more, and the line would no longer be exact.
  - The split (lsq in the brief trials, WPPM in the rest): a WPPM evaluation is now the cheaper
    one (5.3 against 8.5 ms CPU, the whole fit), so there is nothing to split for.

After the steps (`tables/step2-prof.md`) the paired drawing (read-out, FFT, coefficients) takes
84–91 % of `phasePattern`, the axial nodes 4–11 %, and an evaluation 1.9–15.6 ms against
7.7–72.3; every Jacobian column of box-P-1-near costs 23–33 ms.

## 5. The line and the pattern

Track A's pattern check (its `lines/pattern-check.mjs`; here `bench/pattern2.mjs`): the 21
sub-screen rows without texture drawn by the generator without noise, against the model at the
truth, every line's tails whole (`tables/step2-sub.md`).

| engine | max \|Δ\| against the generator, of the peak: median (90 %) | excess χ²_ν: median (max) | against step 1's WPPM, of the peak: median, max |
|---|---|---|---|
| WPPM, step 1's engine | 0.29 % (0.65 %) | 0.0002 (2.503) | — |
| W1 | 0.29 % (0.65 %) | 0.0002 (2.503) | 0, 0 |
| W5 | 0.29 % (0.65 %) | 0.0002 (2.503) | 4.5·10⁻¹¹, 1.7·10⁻¹⁰ |
| W4 | 0.29 % (0.65 %) | 0.0002 (2.504) | 7.5·10⁻⁶, 1.3·10⁻⁵ |

The line alone is WPPM's (the transform of the solid's A(L)); what the shortcuts change is
arithmetic and the Kα2 line's window, three orders of magnitude below WPPM's own distance from the
generator (0.06–0.22 % of the peak at the truth, AB §3.1, the inverse-crime caveat).

## 6. The fits

**The 22 sub-screen runs** against W0 (WPPM itself; `tables/step2-sub.md`): every variant keeps
W0's outcome on 22 of 22 (8 held, 14 free), reaches 20 of 22 as W0, and reads the same accuracy
(worst +6 % (90 %: +29 %), thinnest +0 %, axis 1.9°; anisotropy on the 11 clean rows 0.98, |ln|
0.04, 3 outside 0.9–1.1).
- W5: the returned χ² within 0.1 χ²_ν of W0's on 21 of 22, lower on box-P-3m1-near (−0.13).
- W3 and W4 (the same five rows): within 0.1 on 17; lower on 3 (box-P-3m1-near −0.11,
  sqbox-P-1-on −0.36, sqbox-P4m-on −0.88), higher on 2 (cylinder-P4mmm-on +0.15,
  cylinder-Pm-3m-on +41.7). cylinder-Pm-3m-on (size distribution) is WPPM's known miss, 1502 χ²_ν
  above the best known in W0 and 1546 in W4: the same held basin, 22.2 × 3.9 nm against
  21.5 × 3.8. The search's evaluations: W4 0.977× W0's (0.87–1.16 by class).
- Cost by class (CPU × today): W4 0.41 (−1), 0.39 (2/m), 0.53 (mmm), 0.45 (4/m), 0.41 (4/mmm),
  0.66 (−3), 0.50 (−3m), 0.41 (6/m), 0.25 (6/mmm), 0.28 (m−3), 0.40 (m−3m); W0 1.12–2.98; lsq
  0.54–1.22. The gain is largest where WPPM had cost most (−1: 2.58 → 0.41).

**The 77 screening runs** against step 1's WPPM runs (`tables/step2-screen.md`):
- **W4**: outcome changed on 1, spheroid-P2m-on free → held. That is step 1's threshold case
  (2/m, impurity, isotropic χ²_ν 61.5): its free fit came out 22 χ² (0.36 χ²_ν) above step 1's,
  its gain over the held fit fell back under the 95 % χ² of two turns, and the held fit is
  returned as v522's search returned it (worst +6 % against +11 %). Reach 62 of 66 as before, no
  run lost or gained. Returned χ² within 0.1 χ²_ν on 56 of 68 kept runs; lower on 7
  (sphere-P6mmm-1 −22.2, a textured sphere kept as a box either way; sqbox-P4m-on −0.88,
  box-Pmmm-on −0.71, sqbox-P-1-on −0.36, box-P-3-on −0.19, sqbox-P6mmm-generic −0.19,
  box-P-3m1-near −0.11), higher on 5 (cylinder-Pm-3m-on +41.7, spheroid-P2m-on +6.19,
  ellcyl-P-3m1-near +0.52, cylinder-P4mmm-on +0.15, sqbox-P4mmm-near +0.13). The solid changed
  on 3: box-P-3m1-near (the axis 3.1°, a flat turn), spheroid-P2m-on (held), sphere-P6mmm-1.
- **W5**: outcome changed on 1, box-Pm-3m-generic held → free, 2.30 χ²_ν lower (worst +14 %
  against +3 %, a hump row). Returned χ² within 0.1 on 64; lower on 3, higher on 1
  (ellcyl-P-1-near +0.20).
- Both: accuracy, anisotropy, unbounded extents (4, all with a model error) and spheres (2 of
  11: the textured one and the 4.4 nm sphere with a size distribution) as step 1's WPPM. The
  changes are of the kind any search change makes in flat valleys and at the held test's
  threshold (STEP1.md §6), both ways.
- Cost on the 77 (CPU × step 1's WPPM, under a like load): W4 0.20 (0.16 in −1 to 0.27 in
  m−3m), W5 0.24; step 1's lsq 0.35.

## 7. The solids

**Expected family margins** (AB §3.6: noise-free fits to the generator's exact pattern of the 11
clean sub-screen rows, the true solid against each other family's general member, in
χ²/χ²_ν,iso; `tables/step2-solids.md`): W4 places 8 rows right, 3 within ±3 and none wrong, as
track A's WPPM; lsq 8 / 1 / 2. Row by row W4's margin is WPPM's within 0.6 but sqbox-Pm-3-on
(261.0 against 268.9, both decisive): box-P-1-near 46.9, ellcyl-P2m-generic 30.3,
ellipsoid-Pmmm-generic 30.7, box-P4m-near 23.3, cylinder-P4mmm-on 412.1, spheroid-P-3-near 16.1,
box-P-3m1-near 3.0, cylinder-P6m-on 6.5, ellcyl-P6m-generic 1.6, ellcyl-Pm-3m-generic 2.7. The
three rows within 3 are those no line model determines at these counts (AB §3.6).

**Cross-solid searches** (one noise draw, track A's xconf: each clean row searched as each of the
six solids, early rejection off), W4 with search v2 against track A's WPPM with v522's search:
the same confusion by χ² (7 of 11 the true solid, the other 4 its nested partner) and by BIC (7
the true solid, 3 the nested partner, 1 another family: box-P-3m1-near as the cylinder), the same
counts with a margin (by χ² at m = 3: 5 right solid, 4 nested, 2 undetermined, 0 other; at m =
10: 4 / 3 / 4 / 0), and per row the same margins within 0.5 χ²/χ²_ν,iso but box-P-3m1-near
(−2.1 against −1.6). A search took 2232 evaluations and 14.8 s against 3713 and 187 s (v522's
search, another load).

## 8. The prototype

`proto/engine.patch`, regenerated against `9782d33` (`proto/README.md`):
- `xrd-broad.js` (+157 −13): `WPPM_OPT` (`fast`, `pair`, `axial`; all `true`, `false` keeps
  v522's arithmetic), the read-out's tables (`trigOf`), `wppmPair`;
- `xrd-rietveld.js` (+254 −49 against `9782d33`, step 1's changes included): `SHAPE_MODE.line`
  'exact', the default (read by `broadeningSetup` when a model is built: a phase with a body for
  its free shape is a WPPM phase); a reflection's two lines handed to `wppmPair`; `sollerStats`
  and the `interp` argument from `wppmLineOf` to `sollerNodes`; the Soller cells' cache (least
  recently used, 2048); `WPPM_OPT` exported;
- `RIETVELD.md` §7.3 (the shortcuts) and §10.3 (the exact line).

**Verification** (step 2's harness on the final engine):
- the defaults (no switch set: 'exact', the shortcuts on, the phase's profile the Lorentzian)
  equal W4's runs to the bit on 3 of 3 rows (box-P-1-near, cylinder-P6m-on, sqbox-Pm-3-on);
- `SHAPE_MODE.line` 'lor' with search 'today' equals the pilot's (v522's) records on 2 of 2;
  'lsq' with v2 equals step 1's lsq records on 2 of 2; a WPPM phase with `WPPM_OPT` all off
  equals step 1's WPPM records on 2 of 2;
- the patterns: `WPPM_OPT` off, step 2's engine equals step 1's to the bit (11 rows × 8 points,
  WPPM and the Lorentzian profile);
- `npm run lint`: clean; the engine's tests (rietveld, rvmodel, rvpool, rvsplit, rvlock, rvcif,
  rvui, smoke, widths, modules): 53 of 53 pass. No test asks for a free shape, so the default line
  changes no test; a WPPM phase in a test is drawn by the shortcuts and still passes.

## 9. Decision and risks

**Decision.** `WPPM_OPT` on, `SHAPE_MODE.line` 'exact' by default: the exact line costs 0.42×
today's CPU against lsq's 0.74×, with WPPM's accuracy and family margins, so the reason to prefer
lsq (its cost, AB §1) is gone. 'lsq' and 'lor' stay one switch away. W5 (`pair` off: 0.52×) is the
alternative if a reflection's two lines on one grid ever matter: it changes the pattern by
1.7·10⁻¹⁰ of the peak instead of 1.3·10⁻⁵.

**Risks.**
- **What WPPM brings with it.** WPPM reads model errors as shape more readily (AB §1): the four
  unbounded extents of the 77 are all on rows with a model error, and the 4.4 nm sphere with a
  size distribution keeps a spheroid (ΔBIC −3483). The per-line χ²_ν flag and the jackknife
  (AB §6 item 5) now carry that, with the exact line as the default.
- **What the user sees.** A phase with a free shape asked for is now a WPPM phase whatever its
  size profile: its isotropic size (when the shape is rejected) is read as WPPM reads a sphere,
  the true diameter (1.23× the Lorentzian's Y_s reading, `RIETVELD.md` §7.3); a project saved with
  a Lorentzian free shape is searched again when refined (the profile changed, autoRefine's
  `fromLast`); the card's texts and the version are not touched.
- **Path noise.** `pair` changes the pattern by 10⁻⁵ of the peak, and in flat valleys and at the
  held test's threshold a search then ends a few χ²_ν elsewhere, both ways (§6). Of the same kind
  as forward differences in step 1 and the random turn (AB §4.6); the minima stage of the protocol
  is to make the result independent of it.
- **The lsq and Lorentzian lines** still compute the Soller cells at every θ (about four fifths
  of an lsq evaluation in a triclinic refinement with the cell free): the same interpolation
  would cut them, untested.
- **Not measured with the shortcuts:** the log-normal profile (`pair` shares its size
  coefficients; the axial rule is the same), FCJ's axial model (the interpolation is the Soller
  model's only), a single wavelength (no pair), a phase whose lines need more than one axial node
  (exact, as before). The Soller cache holds up to 2048 lines' cells (about 10 kB each).
- **Timing** against today is from the 22 sub-screen runs under one load; on the 77 against step
  1's runs under a like load.

## 10. Files

- `STEP2.md`: this note.
- `proto/engine.patch`, `proto/README.md`: the prototype with `WPPM_OPT` and 'exact', and this
  step's verification (5).
- `tables/step2-prof.md` (§3: the profiles, before and after, and the Jacobian's columns),
  `tables/step2-sub.md` (§5, §6: the patterns, the cost under one load, the 22 runs scored),
  `tables/step2-screen.md` (§6: the 77 runs), `tables/step2-solids.md` (§7).
- `scripts/step2/` (ran in `$W/fs2/step2/h/`; its `README.md` has the commands): `setup.sh`,
  `make-eng.mjs`, `run.mjs`, `batch2.mjs`, `mkjobs2.mjs`, the job files, `runxs.sh`, `score.mjs`,
  `cost.mjs`, `cost2.mjs`, `ident.mjs`, `best-wppm2.txt`; `prof/` (the timers' engine, the
  profiles); `bench/` (pattern identity and checks, the read-out benchmark, the expected margins).
- Not in the repository: the records (one JSON per run) in `$W/fs2/step2/h/results/` (`T`, `W0`,
  `W1`, `W3`, `W4`, `W5`, `L1`, `D3*`, `xs-W4`, `prof-run0`, `prof-run4`, `pattern/`,
  `margins/`); the app copies `$W/step1-app` and `$W/step2-app`.
