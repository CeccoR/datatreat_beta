# Free shape, round 2, step 3: the per-line check and the jackknife over lines

Step 3 carries out the user's point 6 of `../PROTOCOL.md`: always check the reduced χ² of every
peak, and where the check fires, run the jackknife over lines (the user prefers this to refitting
with another background). It does so on the exact (WPPM) size line, the prototype's default since
step 2 (`STEP2.md`), which reads model errors as shape more readily (AB §1): the four unbounded
extents of the 77 screening runs and both spheres kept with a shape all carry an error.

The engine is the prototype (`proto/engine.patch`) at its defaults: the exact line, search v2
('briefs'), WPPM's shortcuts. All data are synthetic, drawn by round 2's generator with exact lines.
Only the 77 screening rows of the tuning part were run. They hold 38 rows with one of the five model
errors and 39 clean ones (33 truths, 6 spheres). `$W` is the work folder (the session's scratchpad),
not in the repository.

## Contents

1. [Summary](#1-summary)
2. [What was run](#2-what-was-run)
3. [The check](#3-the-check)
4. [The jackknife over lines](#4-the-jackknife-over-lines)
5. [Beyond widening](#5-beyond-widening)
6. [The prototype](#6-the-prototype)
7. [Decision and risks](#7-decision-and-risks)
8. [Files](#8-files)

## 1. Summary

**Decision.** The check is adopted and is on by default (`SHAPE_CHECK` in `xrd-rietveld.js`); it
runs on every fit the search returns.
- **The segments.** The pattern is cut into one segment per line, or per group of overlapping lines.
- **Two statistics.** For each segment, its χ²; and over each 1° of the pattern, the sum of the
  residuals. Each is made family-wise over the pattern (Bonferroni).
- **The threshold.** The flag fires when either statistic exceeds z = 3.09 (p = 0.001 each).
- **The jackknife.** Where the flag fires, the report runs the jackknife over lines, with 4
  iterations a refit. It widens each extent to D·e^(±2 sd) and each axis to 2·rms turn, and marks
  the fit as affected by misfit.
- **Retest.** A keep test made again without the worst flagged lines is in the prototype, switched
  off (`retest`). It is to be confirmed on the 154 tuning runs.
- **Not adopted.** Reporting the shape refitted without the flagged lines, and declaring every
  flagged shape unsupported.

| 77 screening runs | clean (39) | hump (8) | size distribution (8) | impurity (8) | air (7) | texture (7) |
|---|---|---|---|---|---|---|
| **the check fires** | **0** (worst 2.08) | **7** | **5** | **8** | **3** | **6** |
| missed (strength; * spoiled) | — | 0.06 | 0.12, 0.19, 0.84* | — | 0.13, 0.17, 0.32, 0.97 | 0.23 |
| spoiled results caught | — | 2/2 | 3/4 | 2/2 | 1/1 | 6/6 |
| per-line χ² alone (family-wise, 3.09) | 0 | 6 | 5 | 8 | 2 | 4 |
| round 1's worst segment χ²_ν > 1.25 | 2 | 6 | 3 | 8 | 2 | 4 |

- **Spoiled results.** "Spoiled" means the error spoiled the result: an extent beyond 25 % or
  unbounded, the most distinct axis beyond 10°, or a sphere kept with a shape.
- **Detection.**
  - The check catches 29 of the 38 error rows and 14 of the 15 spoiled results.
  - At strength ≥ 0.5 it catches 19 of 21.
  - It fires on none of the 39 clean rows.
- **The one spoiled result missed.** A size distribution of strength 0.84 that a held spheroid takes
  up whole (χ²_ν 1.003, extent +179 %).
- **The other misses are harmless.** They are weak errors, and air taken up by the background.
- **Why two statistics.** Texture is a misfit of a line's intensity, which the 1° sums see. The
  per-line χ² alone catches 11 of the 15 spoiled results.

| 24 flagged kept truths with an error | extents covered (4 unbounded apart) | beyond 25 %: covered | axes covered (beyond 10°) | median half-width, ln D | axis radius | evaluations × the fit's |
|---|---|---|---|---|---|---|
| esds alone (today) | 28/56 | 2/11 | 11/24 (0/7) | 3.2 % | 3.1° | — |
| **jackknife, 4 iterations (adopted)** | **51/56** | **7/11** | **19/24 (2/7)** | **16.8 %** | **11.9°** | **0.24** (0.08–0.69) |
| jackknife, 12 iterations (round 1's) | 51/56 | 7/11 | 19/24 (2/7) | 18.6 % | 14.7° | 0.44 (0.12–1.13) ¹ |
| only the groups holding a flagged line | 49/56 | 6/11 | 17/24 (2/7) | 16.4 % | 10.2° | 0.18 ¹ |
| one refit without the flagged lines, ±2\|Δ\| | 42/56 | 3/11 | 16/24 (2/7) | 9.5 % | 8.8° | 0.06 ¹ |

¹ Over every kept truth; the adopted line is the prototype's own measure, on the flagged fits.

- **Clean rows are not widened.** No clean row is flagged, so none is widened.
- **What the jackknife misses.** The 5 extents it leaves uncovered come from texture (4) and a size
  distribution (1), whose misfit is spread over every line.
- **False shapes and unbounded extents** (§5).
  - Marking flags both false shapes (spheres kept with a shape) and 12 of the 13 spoiled shapes,
    and no clean row.
  - The keep test redone without the worst flagged lines rejects 1 of the 2 false shapes and 4 of
    the 13 spoiled shapes. It rejects no shape that was read well; the 4 unbounded extents stay.
  - Declaring every flagged shape unsupported removes both false shapes and all 4 unbounded
    extents. It also loses 24 of the 33 shapes on error rows, 12 of them read well.
  - Refitting without the flagged lines mends 5 spoiled results, spoils one read well and worsens
    another. It turns 3 unbounded extents into finite ones of 19–57 times the truth.
- **Why the false shapes stay.** Both are spread over every line. A textured sphere kept as a box,
  and a 4.4 nm sphere with a size distribution kept as a spheroid, have anisotropies of 7.4 and 12.8
  jackknife sd.

## 2. What was run

- **The engines.**
  - *Step 2's engine*, the prototype as step 2 left it (`$W/step2-app`, copied to `$W/step3-app`
    before any edit), ran in step 3's harness `$W/fs2/step3/h`.
  - *The prototype with the check*, `$W/step3-app` after the edit (§6), ran in `$W/fs2/step3/hp`.
  - Each was copied into its harness by step 2's `make-eng.mjs`, which adds counters and the refine
    log and changes no arithmetic.
  - `setup.sh` rebuilds both (`scripts/step3/README.md`).
- **The measurements (C1, 77 runs, `h/methods/check.mjs`).**
  - Today's search and report are unchanged. The records equal step 2's W4 runs on 77 of 77: the
    isotropic fit, the search's evaluations and χ², the outcome, the solid, ΔBIC and the report's
    evaluations.
  - Then, at the fit returned (the kept shape, else the isotropic fit), with the refine log off and
    the state restored:
    1. **The check's data.** The segments and their sums, and the residuals, the net pattern and the
       background, dumped.
    2. **The jackknife, on every kept fit.** The segments go into at most 20 contiguous groups. Each
       group in turn is weighted 0 (the engine's background sums cleared), and the fit is refined from
       itself with its own free parameters. A held frame stays held. The refits run 4 iterations, then
       up to 8 more, so the solid is recorded after 4 and after 12.
    3. **The refits without the k most significant segments** (k = 1, 2, 3, 5): the shape from the
       kept fit, the isotropic fit from its own.
  - Every statistic of §3 is computed offline from the records (`h/an3.mjs`).
  - Wall time: 17 min, three processes at nice 15, no failure.
- **The prototype's runs.**
  - **P1** (77 runs, `hp/methods/proto.mjs`). The engine's check, its jackknife and its report as
    they are. On every flagged kept fit the method also refits without all the flagged segments, and
    without at most a third of the segments, the worst first. It took 11 min.
  - **P2** (the 26 flagged kept fits). `retest` on.
  - **F1 and F0.** The final engine at its defaults on 3 rows, and with the check off on 2.
- **Scoring.**
  - *Detection* per error kind and strength (the design's strength 0–1); *false alarms* on the 39
    clean rows; *spoiled results*, as defined in §1.
  - *Coverage* of each extent against the truth: the pairing and the most distinct axis as in
    `STEP1.md`/`STEP2.md`, through `compareSolids` modulo the class. A section of two equal extents
    counts once.
    - The esds' interval is D ± 2 Desd. The jackknife's is D·e^(±2 sd): sd is that of ln D over the
      groups, scaled by (G − 1)/G. An infinite sd opens the upper end only, and an unbounded extent
      keeps its own interval.
    - Axes: within max(2·esdAngle, 2·rms turn).
  - *Cost* in pattern evaluations, against the fit's own (isotropic fit + search + report) in the
    same process.
- **Not done.** No row was refitted with another background (the user's preference). No validation
  row was run, scored or used. While the design file's layout was being inspected, its first entry
  was printed once: one validation row's design factors.
- **Round 1's jackknife** (`scripts/uniqueness/methods/u-jack.mjs`) changed the weights without
  clearing the engine's cache of background sums (`model._bgSums`). Its linear polish therefore
  solved with the full pattern's background sums. The step is accepted only where it lowers χ², so
  this slowed those refits rather than biasing them. Step 3 clears the cache.

## 3. The check

**The segments.**
- Each segment is one line, or a group of overlapping lines. The phase's reflections above 10⁻⁴ of
  the strongest are taken at their Kα centroids: Kα1 plus a third of the α1–α2 split.
- A line within max(0.3°, the mean FWHM of it and the group's last line) of that line joins the
  group. This is the "reflection family where lines overlap". The cuts lie at the midpoints.
- A pattern has 7–43 segments (median 12). In −1 there are 7–43, depending on the widths; in cubic
  there are 9.

**The candidates.** All are statistics of the normalised residuals r = √w(y − y_c) at the fit
returned (`tables/step3-flag.md`, with a row per run).
- Global χ²_ν, and the global Durbin–Watson.
- Per segment:
  - its χ²_ν (round 1's statistic);
  - its χ² as a normal deviate (Wilson–Hilferty);
  - its Durbin–Watson;
  - its residual sum Σr/√n;
  - the share of the excess χ² that the worst one and the worst three segments hold.
- The smooth residual: sums of r over fixed bins of 0.25°, 1° and 4°. Two forms: the χ² of the bins'
  z against its expectation, and the worst bin.
- The worst segment and the worst bin are made family-wise (Bonferroni) over the pattern's segments
  or bins. So under independent Poisson residuals each statistic is a normal deviate, whatever the
  number of segments. A threshold of 3.09 then means p = 0.001 a pattern.

| statistic | clean: median, 90 %, max | hump: median (above clean max) | size distr. | impurity | air | texture |
|---|---|---|---|---|---|---|
| global χ²_ν | 1.00, 1.01, 1.02 | 1.25 (7/8) | 1.04 (7/8) | 1.67 (8/8) | 1.01 (2/7) | 1.10 (5/7) |
| worst segment χ²_ν | 1.08, 1.18, 1.30 | 2.23 (6/8) | 1.19 (3/8) | 6.68 (8/8) | 1.22 (2/7) | 1.39 (4/7) |
| worst segment χ², family-wise z | 0.00, 0.55, 1.40 | 17.8 (7/8) | 4.25 (6/8) | 62.5 (8/8) | 0.17 (2/7) | 7.05 (5/7) |
| worst segment Durbin–Watson, fw z | 0.00, 1.53, 2.56 | 17.0 (7/8) | 4.76 (5/8) | 28.3 (8/8) | 2.41 (3/7) | 10.6 (5/7) |
| worst 1° bin, fw z | 0.00, 0.94, 2.08 | 20.8 (8/8) | 5.18 (6/8) | 47.3 (8/8) | 2.82 (4/7) | 12.1 (6/7) |
| 1° bins, Σz² as z | −0.23, 1.41, 3.53 | 178 (8/8) | 11.9 (7/8) | 182 (8/8) | 6.61 (4/7) | 67.8 (6/7) |
| excess χ² share, worst segment | 0.36, 0.63, 1.00 | 0.52 (0/8) | 0.42 (0/8) | 0.55 (0/8) | 0.31 (0/7) | 0.34 (0/7) |

| rule | clean false alarms | error rows caught | spoiled caught | harmless caught |
|---|---|---|---|---|
| round 1: worst segment χ²_ν > 1.25 | 2/39 | 23/38 | 9/15 | 14/23 |
| global χ², z > 3.09 | 0/39 | 24/38 | 10/15 | 14/23 |
| global Durbin–Watson, z > 3.09 | 0/39 | 27/38 | 12/15 | 15/23 |
| worst segment χ², fw z > 3.09 | 0/39 | 25/38 | 11/15 | 14/23 |
| worst segment Durbin–Watson, fw z > 3.09 | 0/39 | 28/38 | 13/15 | 15/23 |
| worst 1° bin, fw z > 3.09 | 0/39 | 29/38 | 14/15 | 15/23 |
| 1° bins, Σz² z > 3.09 | 1/39 | 33/38 | 14/15 | 19/23 |
| **worst segment χ² or worst 1° bin, fw z > 3.09 (adopted)** | **0/39** | **29/38** | **14/15** | **15/23** |
| the same at 2.33 | 0/39 | 32/38 | 14/15 | 18/23 |

- **Round 1's χ²_ν > 1.25 does not carry over.**
  - A pattern here has more segments than round 1's cubic SrTiO₃, so its worst segment reaches
    1.30 on clean rows by chance alone.
  - The family-wise forms are calibrated by construction. Their clean maxima are 1.40 for the χ²
    and 2.08 for the bins: no excess over the nominal null shows.
- **The bins' χ² form is over-dispersed** on two clean rows (box-P-3m1-near: 3.5 at 1°, 4.5 at 4°)
  and is not used.
- **The excess-χ² share does not detect.** It is a descriptor (an impurity's excess sits in one or
  two segments: 0.97 on two rows), not a test.
- **Why the χ² and the 1° sums together.** The per-segment χ² sees a line's shape and its intensity.
  The 1° sums see an intensity or level misfit spread over a line, which a segment's χ²_ν dilutes in
  its background.
  - Texture on sqbox-P-3m1-on gives a χ² z of 2.4 and a 1° z of 5.6; on cylinder-P-3m1-generic,
    0.0 and 8.0.
  - The weak hump of sqbox-P-3-generic gives 1.8 and 7.3.
  - The Durbin–Watson per segment comes second (13 of 15).
- **The misses** are 9 error rows: 8 harmless, and 1 that no residual statistic can see.
  - Air of strength 0.13, 0.17 and 0.32 (taken up by the background); 0.97 on a spheroid (χ²_ν
    0.982, read within 1 %).
  - A hump of 0.06 (5 % of the strongest line).
  - Size distributions of 0.12 and 0.19.
  - Texture of 0.23.
  - The size distribution of 0.84 on spheroid-P6m-on (864 counts): a held spheroid takes it up with
    χ²_ν 1.003 and every statistic under 2.1, for an equatorial extent +179 % and a polar one −78 %.
- **Round 1's two misses.** Round 1's flag "missed mild humps and never fired on size distributions".
  Here the check catches 7 of 8 humps (from strength 0.11) and 5 of 8 size distributions (3 of the 4
  spoiled).
- **The threshold.** 3.09 was set from the null (p = 0.001 for each statistic, about 0.2 % a pattern
  for both), not tuned on the error rows. On these tuning rows the clean maximum is 2.08, and 2.33
  would add only three harmless catches.
- **How it will be checked.**
  1. On the 154-run tuning part: about 77 clean rows; nominally no false alarm is expected, and one
     would be within the noise.
  2. Against fresh noise drawn on clean truths, and against the in-model control (kernel 'none'): the
     two family-wise z should stay under 3.09 on 99.8 % of patterns. This tests the calibration
     itself, apart from the design.
  3. Then once on the validation part.
  - With 39 clean rows a false-alarm rate can be bounded only to a few per cent. The nominal rate
    rests on the null.
- **Its cost.** Two pattern evaluations a fit (the residuals and the lines' positions).

## 4. The jackknife over lines

**The jackknife.**
- **The groups.** It drops the segments of §3 in at most 20 contiguous groups, one segment each when
  there are fewer. A run has 7–20 groups (median 13).
- **Each refit.** The group's points are weighted 0, and the fit is refined from itself with its own
  free parameters, so a held frame stays held.
- **The widening.** sd is that of ln D of each extent over the groups, scaled by (G − 1)/G, and rms
  is that of the turn of each axis. The extents widen to D·e^(±2 sd) and the axes to 2·rms turn.
  This is round 1's widening.
- **Measured on all kept truths** (C1; `tables/step3-jack.md`). It was run on every kept fit and then
  read where the check fires.

| kept truths | report | extents covered | beyond 25 % covered | axes covered (beyond 10°) | median half-width | axis radius |
|---|---|---|---|---|---|---|
| flagged, with an error (24) | esds alone | 28/56 | 2/11 | 11/24 (0/7) | 3.2 % | 3.1° |
| | jackknife, 12 iterations | 51/56 | 7/11 | 19/24 (2/7) | 18.6 % (4.9× the esds) | 14.7° |
| | jackknife, 4 iterations | 51/56 | 7/11 | 19/24 (2/7) | 16.8 % (4.6×) | 11.9° |
| | only the groups holding a flagged segment | 49/56 | 6/11 | 17/24 (2/7) | 16.4 % | 10.2° |
| | one refit without the flagged segments, ±2\|Δ\| | 42/56 | 3/11 | 16/24 (2/7) | 9.5 % | 8.8° |
| not flagged, with an error (9) | esds alone | 15/23 | 0/2 | 8/9 (0/1) | 2.4 % | 7.5° |
| not flagged, clean (33) | esds alone | 65/82 | 1/3 | 26/32 (1/3) | 1.6 % | 2.3° |
| | (jackknife, were it run) | 79/82 | 3/3 | 28/32 (1/3) | 3.5 % (1.3×) | 4.3° |

**Coverage.**
- On the flagged error rows the jackknife brings the extents from 50 % covered to 91 %, at about
  five times the esds' width.
- It leaves 5 extents uncovered.
  - Texture: ellcyl-P-1-near (its two finite extents, 1.76 and −1.59 off in ln against half-widths
    of 0.58 and 0.12; the third unbounded), spheroid-P-1-generic (−0.61 against 0.21),
    sqbox-P-3m1-on (−0.36 against 0.31).
  - A size distribution: ellipsoid-P4mmm-near (−0.09 against 0.06).
  - Dropping a group of lines cannot reveal a misfit that every line carries.
- The 5 axes it misses:
  - two held frames: sqbox-P4m-on, held 90° off by air, and cylinder-P-3m1-generic, 13.4° off by
    texture; a held frame is not turned by the jackknife;
  - three texture rows, 20–88° off with radii of 12–27°.

**Cost.**
- 4 iterations cover exactly as 12 do, at 0.27× against 0.44× the fit's evaluations (all kept truths).
  The 12-iteration refits stopped at the cap in 75 of 877.
- The cheaper versions lose coverage, at 0.18× and 0.06×:
  - dropping only the groups that hold a flagged segment: 49/56;
  - one refit without the flagged segments: 42/56.
- The adopted version, in the prototype, on the flagged fits:
  - 1032 evaluations (median; 486–2570);
  - 0.24× the fit's (0.08–0.69);
  - 3.9 s of wall time (nice 15, three processes).

**Clean rows are not widened.** No clean row is flagged. Were the jackknife run on every clean fit,
it would widen the extents 1.3× and cover 79 of 82 against the esds' 65. The esds under-cover even
clean fits on the exact line (79 % against the 95 % stated). That belongs to the minima stage and
the presentation of the errors, not to the misfit.

## 5. Beyond widening

**The rules.** On the prototype's runs with the engine's own flagged segments (P1;
`tables/step3-fix.md`), each rule is applied to a kept fit whose check fired:
- R1: marked "affected by misfit";
- R2: the shape refitted without the flagged segments and reported so;
  - a: all of them, where 2 are left;
  - t: at most a third of the segments, the worst first;
- R3: the keep test made again without them (ΔBIC as the search's on the points left; kept below −10);
- R4: R2 and R3 together;
- R5: not supported, so the isotropic size is reported.

| rule | false shapes (11 spheres) | error truths kept / rejected | unbounded | spoiled kept (marked) | read well, rejected | clean rejected / marked |
|---|---|---|---|---|---|---|
| R0 (today) | 2 | 33 / 0 | 4 | 13 (0) | 0 | 0 / 0 |
| R1 mark | 2 (both marked) | 33 / 0 | 4 | 13 (12) | 0 | 0 / 0 |
| R2a refit without all | 2 | 33 / 0 | 2 ² | 11 | 0 | 0 / 0 |
| R2t refit without a third | 2 | 33 / 0 | 1 ² | 11 | 0 | 0 / 0 |
| R3a keep test without all | 1 | 26 / 7 | 3 | 8 | 2 | 0 / 0 |
| **R3t keep test without a third (`retest`)** | **1** | **29 / 4** | **4** | **9** | **0** | **0 / 0** |
| R4t | 1 | 29 / 4 | 1 ² | 9 | 0 | 0 / 0 |
| R5 not supported | 0 | 9 / 24 | 0 | 1 | 12 | 0 / 0 |

² The unbounded extents "removed" become finite ones of 19–57 times the truth: box-P6mmm-on 5740 %,
ellipsoid-P4mmm-near 1919 %, ellcyl-P-1-near 2442 % (R2t).

- **Marking (R1)** is exact on these rows.
  - It names both false shapes and 12 of the 13 spoiled shapes (all but spheroid-P6m-on, §3), plus
    12 shapes read well under a real error.
  - No clean row is marked.
- **Refitting without the flagged lines (R2)** is not a recipe. The figures below are R2t's.
  - It mends 5 spoiled results:
    - box-Pmmm-on, +342 % → +34 %;
    - ellipsoid-P-3-generic, +117 % → +6 %;
    - sqbox-P-3m1-on, 30 %/20° → 16 %/8°;
    - cylinder-Pm-3-generic, 14° → 7°;
    - sqbox-P6mmm-generic, 21 % → 12 %.
  - It spoils a result that was read well, and worsens a spoiled one:
    - cylinder-Pm-3m-on, a held cylinder with a size distribution, +19 % → +174 %;
    - spheroid-P-1-generic, +308 % → +648 %.
  - Unbounded extents become merely large.
- **The keep test without the worst third (R3t)** rejects 5 shapes:
  - the false box of the textured sphere (ΔBIC −348 → +12);
  - 4 spoiled truths: sqbox-P4m-on (held 90° off, +2), sqbox-P-3m1-on (+5),
    cylinder-P-3m1-generic (+1) and cylinder-Pm-3-generic (−4).
  - The 12 shapes read well keep ΔBIC' between −388 and −7382. So on these rows it loses nothing,
    and the margin is wide.
  - Dropping all the flagged segments (R3a) rejected 2 shapes read well as well (spheroid-P6mmm-near,
    sqbox-P6mmm-generic: 9 and 10 of 12 segments dropped).
  - It costs two refits: 340 evaluations (median; 177–758), about 0.07× the fit.
- **Declaring every flagged shape unsupported (R5)**, the user's "a sphere kept with a shape under a
  fired flag as not supported", is the only rule that removes both false shapes and every unbounded
  extent. It costs 24 of the 33 error-row shapes, 12 of them read well (impurities beside lines, humps,
  air at strength 0.94).
- **What no rule removes.** The size distribution on the 4.4 nm sphere (sphere-Pm-3m-3) is kept as a
  spheroid by every rule but R5: ΔBIC' −216 without its flagged lines, anisotropy 12.8 jackknife sd.
  The size distribution is in every line, and a spheroid's spread of member widths mimics it.
- **The unbounded extents.** None is bounded honestly: they sit on texture (ellcyl-P-1-near), size
  distributions (ellcyl-P-3m1-near, ellipsoid-P4mmm-near) and an impurity (box-P6mmm-on). All four
  are flagged and marked. Size distributions are caught with the least margin: the false spheroid
  of sphere-Pm-3m-3 at z 4.5, the unbounded ellipsoid-P4mmm-near at 6.0. A threshold above 4.5 would
  lose the first.

## 6. The prototype

**The patch.** `proto/engine.patch`, regenerated against `9782d33` (`proto/README.md`), changes two
files.
- `xrd-rietveld.js` (+395 −53 in all, step 3 adding about 140 lines):
  - `SHAPE_CHECK` in the tunables' block: `on: true`, `z: 3.09`, `bin: 1`, `minsep: 0.3`,
    `jack: true`, `groups: 20`, `iter: 4`, `retest: false`;
  - `lineCheck`, the segments and the two statistics, and `refitWithout`;
  - `lineJack`.
- `RIETVELD.md` §10.8: the check, its figures and its limits.

**In the search and the report.**
- `freeShapeRun` checks every fit it returns: `info.check` on a kept shape, `check` beside a
  rejection, the isotropic fit's.
- With `retest`, a kept shape whose check fired goes through the keep test again without the worst
  flagged segments.
- `bodyShapeOf` gives the check as `misfit`. Where it fired it runs `lineJack` and adds `jackLo` and
  `jackHi` to each dimension and `jackTurn` to each axis, beside the esds.
- The card's texts are not touched: what the card says of `misfit` belongs to the result card
  (later). `SHAPE_CHECK` is exported.

**Verification** (`scripts/step3/hp/`).
- **The search.** The prototype's search equals C1's on 77 of 77 (χ², outcome, solid, ΔBIC), with
  two more evaluations for the check.
- **The check.** Its flag and its flagged segments equal the offline statistics on 77 of 77 (|Δz| at
  most 3·10⁻⁷).
- **The jackknife.** It equals the offline 4-iteration spread on the 26 flagged kept fits, within
  2·10⁻⁶ (the offline solids were stored rounded).
- **`retest` on** (P2): each outcome as the measured refits predict, on 26 of 26.
- **The final engine.** Its defaults equal P1 to the bit on 3 of 3 rows. With `SHAPE_CHECK.on =
  false` it equals step 2's fits on 2 of 2: χ², and the search's and the report's evaluations.
- **Lint and tests.** `npm run lint` is clean. The engine's tests (rietveld, rvmodel, rvpool, rvsplit,
  rvlock, rvcif, rvui, smoke, widths, modules) pass, 53 of 53. No test asks for a free shape, so no
  test runs the check.

## 7. Decision and risks

**Decision.**
- **On by default:** the check (both statistics, 3.09 family-wise), and the jackknife over lines with
  4 iterations where the check fires, with the mark.
- **Switchable, off:** the keep test without the worst flagged third (`retest`). It removed one false
  shape and four spoiled shapes and lost none read well, but on 26 flagged fits.
- **To confirm** with `retest` on the 154 tuning runs, then validate once.
- **Not adopted:**
  - reporting the refit without the flagged lines (R2: it mended 5 spoiled results but spoiled one
    read well, worsened another, and only made the unbounded extents large);
  - declaring every flagged shape unsupported (R5: 12 of the error rows' 20 shapes read well lost).

**Risks.**
- **Small numbers.**
  - 39 clean rows bound the false-alarm rate only to a few per cent; the nominal 0.2 % rests on the
    residuals' null. The confirmation's clean rows and fresh-noise replicas are the check (§3).
  - The error kinds have 7–8 rows each, and the spoiled results are 15.
- **Real data.** Any misfit fires the check: the instrument's profile, the background's form, a
  phase left out. Round 1's sample-like proxies all fired. On real patterns the mark and the
  widening will be common. That is the intended reading of a misfit, but the card must say what
  `misfit` means.
- **What the jackknife cannot see.**
  - A misfit carried by every line: texture, size distributions. These leave 5 of 56 extents
    uncovered and keep both false shapes.
  - A held frame, which stays held: a square box held 90° off by air keeps a 1.5° radius.
  - A model error that leaves no residual: the size distribution a held spheroid takes up whole goes
    unseen.
- **Segments from the lines' widths.** Very broad lines merge into few segments: 7 in a −1 row, which
  makes 7 jackknife groups. The check needs 3 segments for the jackknife and `retest`. The 1° bins
  are fixed in 2θ: lines several degrees broad are cut, which a broad line's misfit survives (it
  spans bins), but the threshold has been seen on these widths only.
- **4 iterations measure sensitivity, not a converged refit.** 12 gave the same coverage on these
  rows. A slower valley could need more.
- **The cost** is 0.24× the fit (median, up to 0.69×) on a flagged fit, and two evaluations on any
  other. `retest`, when on, adds about 0.07×.

## 8. Files

- `STEP3.md`: this note.
- `proto/engine.patch`, `proto/README.md`: the prototype with `SHAPE_CHECK`, and this step's
  verification (6).
- `tables/step3-flag.md`: the statistics, the rules, the adopted rule by kind and strength, and a row
  per run (§3).
- `tables/step3-jack.md`: the jackknife's coverage, width and cost per version, and a row per error
  row (§4).
- `tables/step3-fix.md`: the rules beyond widening, the prototype's report's coverage, and a row per
  flagged fit (§5).
- `scripts/step3/`, with its `README.md` for the commands:
  - `setup.sh`;
  - `h/`: `methods/check.mjs`, `ck.mjs`, `an3.mjs`, `rep-flag.mjs`, `rep-jack.mjs`, `rep-fix.mjs`,
    `aniso.mjs`, `ident3.mjs`, `run.mjs`, `batch2.mjs`, the job file;
  - `hp/`: `methods/proto.mjs`, `make-eng.mjs`, `cmpP.mjs`, `rep-fixP.mjs`, `verify.mjs`, `run.mjs`,
    `batch2.mjs`, the job files.
- Not in the repository:
  - the records in `$W/fs2/step3/h/results/C1` (15 MB with the residuals' dumps) and
    `$W/fs2/step3/hp/results/` (`P1`, `P2`, `F1`, `F0`);
  - the app copies `$W/step2-app` and `$W/step3-app`, and `$W/step3-gitbase`, which the patch was
    diffed in.
