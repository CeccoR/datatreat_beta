# Round 2 prototype: the exact and lsq size lines and search v2 in the engine

A patch of the app's Rietveld engine that carries round 2's two adopted results (`../AB.md` §1):
the lsq size line (track A) and the cheaper search (track B), each the free shape's default behind
a switch that keeps v522's behaviour reachable. It is a prototype, ready to swap in once round 2's
tuning runs confirm the results. Round 2's step 1 (`../STEP1.md`) measured it on the 77 screening
runs with both lines and set forward differences to the brief trials only (`SHAPE_FWD`). Step 2
(`../STEP2.md`) made WPPM, the exact line, cheaper than lsq (`WPPM_OPT` in `xrd-broad.js`, three
shortcuts) and made it the free shape's default size line (`SHAPE_MODE.line` 'exact'). Step 3
(`../STEP3.md`) added the per-line check of every fit the search returns, the jackknife over lines
where it fires, and a switchable keep test without the flagged lines (`SHAPE_CHECK`). It is not
applied: the branch is unchanged. Its base is
`9782d33` (claude/repo-code-review-sr6c8m), whose engine files equal the frozen `b9bef5f` byte for
byte (`git diff b9bef5f 9782d33 -- 'xrd-*.js'` is empty), so the research diffs ported directly.

`$W` below is the work folder (the session's scratchpad) that holds round 2's `fs2/` and the
prototype's runs; none of it is in the repository.

## Files

- `engine.patch`: `git diff` against `9782d33` of the app's files:
  - `xrd-rietveld.js` (+395 −53): the switches and tunables, the lsq line, the exact line's
    option (`broadeningSetup`), refine's options `forward`, `noCov` and `covOnly`, freeShapeRun's
    search v2, `sameFrame`; for WPPM a reflection's two lines handed to `wppmPair`, the axial
    shift interpolated in θ (`sollerStats`), the Soller cells' cache (least recently used, 2048);
    the per-line check (`SHAPE_CHECK`, `lineCheck`, `refitWithout`, `lineJack`: in freeShapeRun's
    outcomes and in `bodyShapeOf`'s report);
  - `xrd-broad.js` (+157 −13): `WPPM_OPT`, the read-out from a table of the points' sinθ, cosθ,
    `wppmPair`;
  - `xrd-sizeline.js` (new, 44 kB): the lsq tables, precomputed;
  - `sw.js`: the new module in `ASSETS` (one line; `CACHE` not bumped, nor `index.html`);
  - `RIETVELD.md`: §7.3 (WPPM's shortcuts), §10.3 (the exact and lsq lines), §10.5 (search v2,
    with step 1's figures), §10.7 (held frames), §10.8 (the per-line check).
- `xrd-sizeline.js`: the tables module as the patch adds it.
- `build-sizeline.mjs`: rebuilds it (10 s) from track A's exact lines
  (`../scripts/A/lines/profiles.mjs`). `--check <A's tables.json>` compares with track A's tables:
  1863 of 1863 entries equal to the bit.
- `verify/`: the verification's scripts, run in `$W/proto-h/` beside `$W/fs2/` (`lib.mjs` there
  is `fs2/harness/lib.mjs` with its two paths moved to `../fs2`): `make-eng.mjs [patched tree]`
  (the harness's engine copy from a checkout with the patch applied; during the work
  `$W/proto-wt`, a worktree since removed), `run.mjs` (the
  pilot's, the switches from `PROTO_LINE` and `PROTO_SEARCH`), `job.sh <tag> <line> <search> <row>`
  (one run, nice 15; three at a time through `xargs -P 3`), `cmp.mjs <tag> pilot|A|B|<tag>` (run
  by run against a reference), `sum.mjs <tag> <tag>` (two searches on one line: outcome, reach,
  χ², solid, accuracy, cost).

## How to apply

From the repository's root:

```sh
git apply --check research/free-shape/round2/proto/engine.patch
git apply research/free-shape/round2/proto/engine.patch        # git apply -R to take it back
node research/free-shape/round2/proto/build-sizeline.mjs        # only to rebuild the tables
```

v522's behaviour stays reachable without reverting: `SHAPE_MODE` and `WPPM_OPT` are exported by
`xrd-rietveld.js`; set `SHAPE_MODE.line = 'lor'` (or 'lsq', step 1's default) and/or
`SHAPE_MODE.search = 'today'` before a model is built ('exact' is read when the model is built,
'lsq' and 'lor' at every pattern evaluation, the search at each `freeShape`), and
`WPPM_OPT.fast`, `.pair`, `.axial = false` for WPPM's arithmetic as v522 had it (read at every
evaluation). `SHAPE_CHECK.on = false` removes the per-line check (read at each `freeShape`; the
search and the report are then step 2's to the bit), `.jack = false` its jackknife alone (read by
`bodyShapeOf`).

## What changes and why

**The exact size line, by default** (`SHAPE_MODE.line` 'exact'; `../STEP2.md`). A phase with a body
for its free shape is built as a WPPM phase whatever size profile it names (`broadeningSetup`): its
members' lines are the transforms of the solid's common-volume function along each (the engine's
own WPPM, `wppmLineOf` with `shapeTs`, unchanged), and its isotropic sphere is the ball's. The
switch is read when a model is built. Why: in expectation it puts none of the 11 clean rows in
another family of solid where lsq puts two (AB §3.6), reads the extents and the anisotropy
closest to the truth (AB §3.3), and with step 2's shortcuts a fit by it costs 0.42× v522's CPU
against lsq's 0.74× (22 sub-screen rows, one load). 'lsq' and 'lor' stay reachable.

**WPPM's shortcuts** (`WPPM_OPT` in `xrd-broad.js`, all on; `../STEP2.md`; `RIETVELD.md` §7.3).
On step 1's engine a WPPM fit spent 96 % of its CPU in `phasePattern`: the read-out 62 %, the axial
nodes 23 %, the FFTs 7 %, the common factor 3 %, the members' size coefficients 1 %. Bit for bit
(no switch): the read-out takes the points' sinθ and cosθ from a table made once per grid and its
cell by an integer truncation (a sine, a cosine and `Math.floor` a point: 16–20 ns, now 9), and the Soller
cells are kept for the 2048 lines last used (512, oldest first, before). `fast`: the common
factor's exponentials by recurrence, the read-out by reciprocals (2·10⁻¹² of the peak). `pair`: a
reflection's Kα1 and Kα2 lines on one grid by one FFT, one in the real part and one in the
imaginary part, the size coefficients made once (`wppmPair`; 1.5·10⁻⁵ of the peak). `axial`: a
line with one axial node takes its shift from the cells at the two nearest multiples of 10⁻⁴ rad in
θ, linearly (`sollerStats`; 10⁻⁹ of the peak), so a cell parameter's Jacobian column no longer
computes every line's cells again. `false` gives v522's arithmetic.

**The lsq size line** (`SHAPE_MODE.line` 'lsq', step 1's default, AB §1 item 2, §3.1–§3.5). Each member's size line is
still the engine's TCH pseudo-Voigt, but its width w (the sphere-calibrated 0.675/⟨L⟩_V) enters as
a Gaussian kg·w, in quadrature with the instrument's, and a Lorentzian kl·w, where (kg, kl) make
the TCH line that best fits the solid's exact line along that member (weighted least squares over
|x| ≤ 6/⟨L⟩_V, weights 1/(p + 0.2)). `sizeLineKs` reads them from `xrd-sizeline.js` by the reduced
shape along the member, as track A's `lines/sizeline.mjs` did: one entry for the ball family,
the angle ψ from the axis for the cylinder and elliptic cylinder (every 0.5°, linear), the sorted
direction ratios β, γ for the box (every 0.025, bilinear; the table is symmetric, its lower half
is stored). The isotropic sphere of a phase whose free shape is asked for takes the ball's entry,
so that ΔBIC compares like with like (A's engine changed every phase's sphere: there every phase
had a shape); other phases, WPPM phases and the legacy ellipsoid are untouched. Why: the
Lorentzian is 11.5–21 % of the peak off every solid's exact line, reads ⟨L⟩_V 13–25 % long and
pulls the solids toward equant with the symmetry (m−3m read a quarter of the anisotropy); lsq is
2.5–8 % off at the same cost (0.99× the CPU) and on the 77 screening runs kept 65 of 66 truths
against 60, with the thinnest extent +1 % against +20 % and the worst +16 % against +42 %.

**Forward differences in the brief trials, no intermediate covariance, one central pass**
(`SHAPE_MODE.search` 'v2', AB §1 item 1, §4.2 (1), (2); `../STEP1.md`). `refine` takes three
options: `forward` (the Jacobian by forward differences: one displaced point a non-linear column,
the pattern at v reused from the state, the point below at an upper bound; the covariance stays
central), `noCov` (no covariance at the end) and `covOnly` (no iterations, the covariance alone).
Every refinement of the search runs with `noCov`; the brief trials also with `forward`, and with
`SHAPE_FWD` 'all' the full refinements, the polish, the exact faces, the held frames and the
refit as well. Once the outcome is decided, the fit kept is refined once more as v522 refines
(central, with its covariance: `SHAPE_CENTRAL`), so that what autoRefine reads (esds, covariance)
is made as before. Why: the intermediate covariances were never read, and forward differences
halve a Jacobian. On lor (B) they changed one outcome of 77 in every refinement; under lsq, in
the full refinements they stall short in flat valleys (cylinder-Pm-3m-on, verification 2), and on
the 77 screening runs 'all' reached 61 of 65 runs where 'briefs' reached 64 (v522 64 of 66), at
0.476× against 0.615× v522's evaluations (step 1, verification 4). Track B ran a covariance-only
pass before its central pass and accounted it out of the cost; the prototype does not run it,
and ends bit for bit where B's accounting said (verification 2).

**Held frames once per orbit** (search v2, AB §4.2 (3)). A lattice frame that a rotation of the
Laue class takes onto one already tried, axis for axis without sign (equal axes either way where
the body lets them swap: a square box's edges, any equal axes of a box or an ellipsoid, never an
elliptic cylinder's height), ends where that one did (the refinement is equivariant) and is not
refined again (`sameFrame`, from `q.laue` through `cartOp`). B decided by the harness's
canonical form (`canonical()`, the fundamental zone: over 100 lines with its helpers); the
direct test decides alike (every evaluation count of B's 22 runs reproduced) at a fraction of
the code.

**The class's distinct starts, the turns on their own stream** (search v2, AB §4.2 (4), §4.3,
§4.6, §5.2 B1). The starts are the sphere-like one and a plate and a needle per low-index family
(11 in the six lower classes, 9 in −3m, 6/m and 6/mmm, 7 in cubic), with no random fill
(`SHAPE_FILL` = 0). The 0.02 rad turns before each polish and the refit keep v522's random
numbers: the seeded stream first skips the draws v522's fill would make (7 deviates a start), so
a start mode never shifts them (the skeptic's B1: one shared stream had made the start cut look
like it lost minima the shifted turns lost). Random starts, when any are asked for (`SHAPE_FILL`,
or the setting `shapeStarts` above its default 10, one each), come from a second stream. The
legacy ellipsoid (`ellipsoidL`) keeps v522's search.

**The per-line check** (`SHAPE_CHECK`, step 3; `../STEP3.md`, `RIETVELD.md` §10.8). The exact
line reads a model error the refinement does not carry as shape more readily (the four unbounded
extents of the 77 screening runs and both spheres kept with a shape all had one), so every fit the
search returns is checked, the shape kept or the isotropic fit (`info.check`, or `check` beside a
rejection). The range is cut into one segment per line or group of overlapping lines (the phase's
reflections at their Kα centroids, a line within max(0.3°, the mean FWHM) of the group's last joining
it, the cuts at the midpoints); of the residuals r = √w(y − y_c) the worst segment's χ² (as a normal
deviate, Wilson–Hilferty) and the worst sum of r over 1° (two-sided) are each made family-wise
(Bonferroni) over the pattern, and the flag fires when either exceeds 3.09 (p = 0.001 each). It costs
two evaluations. On the screening runs: no false alarm on the 39 clean rows (the worst 2.08), 29 of
the 38 error rows caught, 14 of the 15 whose result the error had spoiled; round 1's worst segment
χ²_ν > 1.25 fired on 2 clean rows and 23 error rows, and the χ²_ν statistic alone (family-wise)
caught 11 of the 15 (the 1° sums catch texture, whose misfit is a line's intensity). Where it
fires, `bodyShapeOf` runs the jackknife over lines (at most 20 contiguous groups of segments, each
weighted 0 and the fit refined from itself, 4 iterations, its own free parameters, a held frame held)
and gives each dimension D·e^(±2 sd) (`jackLo`, `jackHi`; an infinite sd opens the upper end only)
and each axis 2·rms turn (`jackTurn`) beside its esds, with the check as `misfit`: on the 24 flagged
truths with an error it covers 51 of 56 extents (the esds alone 28) and 19 of 24 axes (11), at 0.24×
the fit's evaluations; the 12 iterations of round 1 covered the same at 1.6× the cost. `retest`
(off): the keep test made again without the worst flagged segments, at most a third of them; on the
screening runs it rejected 1 of the 2 false shapes and 4 of the 13 shapes an error had spoiled, and
no shape that was read well, at 0.07× the fit's evaluations where it ran. Neither widening nor a
refit removes the false shapes of a textured sphere or of a sphere with a size distribution: their
misfit is spread over every line.

**WPPM itself is the engine's.** Track A's WPPM runs only set the phase's size profile to WPPM
(`FS2A_PROFILE=wppm`; `FS2A_WPPM_BALL` was a control, not a model), and step 1 measured search v2
on it so. 'exact' makes that profile the free shape's default; a phase whose profile is WPPM or
log-normal is a WPPM phase under any line setting.

## Switches and tunables

All in one block of `xrd-rietveld.js` (before `shapeActive`), but the tables' own, which
`build-sizeline.mjs` writes into `xrd-sizeline.js`, and `WPPM_OPT`, in `xrd-broad.js` (exported by
both modules). Every tunable is to be tuned on round 2's tuning runs.

| name | default | v522 | what |
|---|---|---|---|
| `SHAPE_MODE.line` | `'exact'` (step 1: `'lsq'`) | `'lor'` | the size line of a free shape's members and of its phase's isotropic sphere; 'exact' read when a model is built |
| `WPPM_OPT.fast`, `.pair`, `.axial` | `true` | `false` | WPPM's shortcuts (any WPPM phase): the arithmetic, a reflection's two lines by one FFT, the axial shift interpolated in θ |
| `SHAPE_MODE.search` | `'v2'` | `'today'` | freeShapeRun's search |
| `SHAPE_FILL` | 0 | (fill to 11) | v2: random starts beside the class's distinct ones |
| `SHAPE_CENTRAL` | `true` | — | v2: the kept fit refined once more by central differences (`false`: its covariance alone) |
| `SHAPE_FWD` | `'briefs'` | (central everywhere) | v2: the refinements by forward differences: the brief trials alone, or `'all'` |
| `cylStep`, `boxStep` | 0.5°, 0.025 | — | the tables' steps (`build-sizeline.mjs --psi --box`) |
| `fit.X`, `fit.b` | 6, 0.2 | — | the lsq fit's span (in 1/⟨L⟩_V) and weights 1/(p + b) (`--X --b`) |
| `lowIndexAxes` | 5 families | the same | the families the deterministic starts take (unchanged) |
| `SHAPE_CHECK.on` | `true` | — | the per-line check of the fit returned (`info.check`, `check`) |
| `SHAPE_CHECK.z`, `.bin`, `.minsep` | 3.09, 1°, 0.3° | — | the flag's family-wise threshold (both statistics), the residual sums' width, the least separation of two segments |
| `SHAPE_CHECK.jack`, `.groups`, `.iter` | `true`, 20, 4 | — | the jackknife over lines where the check fires: at most that many groups, that many iterations a refit |
| `SHAPE_CHECK.retest` | `false` | — | where it fires, the keep test again without the worst flagged segments (at most a third) |

## Verification

The harness is round 2's (`fs2/harness/lib.mjs` runCase, the pilot's `run.mjs` and
`methods/today.mjs`: freeShape as autoRefine calls it, then the card's report, `bodyShapeOf`), on
an engine copy made from the patched files by `verify/make-eng.mjs` (the harness's counters and
refine log, no arithmetic change). Each row is drawn by round 2's generator (exact lines, Poisson
noise) and fitted isotropically from its CIF, as in the pilot. `PROTO_LINE` and `PROTO_SEARCH` set
the switches. Runs at nice 15, three processes on 4 vCPUs; records in `$W/proto-h/results/`
(t1–t4) and `$W/proto-h2/results/t5`. Every run is deterministic.

**1. Switches on v522's: bit-identical.** Line 'lor', search 'today', 4 rows against the pilot's
records (`fs2/pilot/results/screen`, made by the `b9bef5f` engine, which `9782d33`'s engine files
equal). Equal to the bit on every row: the isotropic fit's evaluations and χ², the search's
evaluations and χ², the outcome, the dimensions, the report's evaluations.

| row | class | iso evaluations, χ² | search evaluations | χ² | outcome | report evaluations |
|---|---|---|---|---|---|---|
| sqbox-P4m-on | 4/m | 337, 13 958.114 | 3062 | 13 958.114 | rejected | — |
| spheroid-P-3-near | −3 | 286, 11 592.639 | 2698 | 11 540.147 | held | 1791 |
| sqbox-Pm-3-on | m−3 | 296, 15 867.496 | 3095 | 15 492.826 | held | 766 |
| ellipsoid-Pmmm-generic | mmm | 289, 12 350.510 | 3069 | 11 313.543 | free | 2186 |

**2. Each part reproduces its track; the defaults.** The 22 sub-screen rows (`fs2/A/subscreen.txt`).
- **'lsq' with search 'today' against track A's lsq** (`fs2/A/results/s-lsq`, today's search):
  equal to the bit on 22 of 22 rows: the isotropic fit (evaluations, χ²), the search's
  evaluations (77 547 in all), χ², outcome (11 held, 11 free), dimensions, the report's
  evaluations.
- **'lor' with search 'v2' against track B's recommended combination** (B's `symA`, tag symfix, in
  the five classes with a fill, `fwdH`, tag sub2, elsewhere; B's search evaluations less its
  covariance-only pass): equal to the bit on 22 of 22: evaluations (43 526), χ² after the central
  pass, outcome, dimensions, the isotropic fit. The held dedupe skipped exactly B's frames, and the
  central pass ends where B's did without the covariance-only pass before it.
- **The defaults, 'lsq' with 'v2'** (the combination AB §6 step 1 asks to re-check), against
  'lsq' with 'today', the two run interleaved under one load:
  - search evaluations 37 134 against 77 547 (0.479×), the search's wall time 356 s against 636 s
    (0.560×), the whole fit's CPU (isotropic fit + search + report) 784 s against 1068 s (0.734×;
    the isotropic fit and the report cost the same in both);
  - the same outcome on 21 of 22, the returned χ² within 0.1 χ²_ν on 20 (sqbox-Pm-3-on +0.33,
    the same free solid within 1 %);
  - **one loss: cylinder-Pm-3m-on** (m−3m, 18.7 × 3.7 nm, with a size distribution): free, an
    unbounded disc 3.15 nm thick, at +1693 χ²_ν, where today's search with lsq holds 19.2 × 3.6 nm.
    So the reach against A's lsq truth reference is 21/22 against 22/22, and the kept solids'
    medians are worst +17 % against +16 %, thinnest +1 % against +1 %, axis 3.8° against 2.8°.
  - **The cause is forward differences, not the start cut.** v2 with v522's random fill kept (t5,
    the 10 rows of the five classes with a fill) gives the same outcome and χ² as v2 on all 10,
    cylinder-Pm-3m-on's loss included, at 1.09× v2's evaluations: under lsq too the fill buys
    nothing there. On that row, from the same brief end (χ² 17 388.6 central, 17 388.8 forward),
    the full refinement by central differences reaches 13 090.0 in 28 iterations, by forward
    differences stops at 14 965.4 in 9; in v2 itself two full refinements crawl to 60 and 73
    iterations. Forward differences in the briefs only (the full refinements
    central) recover the held 19.2 × 3.6 nm fit (χ² 12 939.54, as today's) at 4477 evaluations
    against today's 3797; a central polish alone does not. Under 'lor' (B, 77 runs) forward
    differences changed one outcome of 77; under 'lsq' this is one of 22.

**3. The app's tests on the patched copy.** `npm run lint`: clean (no error, no warning).
`npm test` (Playwright 1.56.1, Chromium): 220 of 220 pass, in 11 min (the smoke test loads the
Rietveld worker, and so the new module, under the CSP). No test fails, so there are no goldens to
update: none pins a free-shape number, since no fixture asks for a free shape (the Rietveld tests
refine SrTiO₃ isotropically), and the lsq line only touches phases with a free shape. The flip
side: the browser never runs the free-shape path in the tests; it is verified in Node only (1, 2),
on the same module.

**4. Step 1: the 77 screening runs** (`../STEP1.md`; `$W/fs2/step1/`). The patched copy with
`SHAPE_FWD` added, driven by the same harness, against track A's records of today's search on
each line (lsq: `fs2/A/results/screen-lsq`; WPPM: `screen-wppm`, the phase's profile WPPM as A ran
it). Today's search re-run on 2 rows a line: equal to the bit (iso, evaluations, χ², outcome,
dimensions, report); 'all' equal to the bit with verification 2's lsq + v2 on its 22 rows; the
default 'briefs' run without the switch on 2 rows equal to the bit with the 'briefs' runs.
- lsq: 'all' 0.476× today's search evaluations, outcome changed on 2 (cylinder-Pm-3m-on held →
  free unbounded, +1693 χ²_ν; ellipsoid-Pm-3-on held → early rejection), reach 61/65; 'briefs'
  0.615×, outcome changed on 1 (ellipsoid-Pm-3-on), reach 64/65 against today's 64/66; CPU of the
  whole fit on the 22 sub-screen rows, one load, 0.80× today's ('all' 0.73×).
- WPPM with 'briefs': 0.617× the evaluations, CPU 0.75× on the 22 rows (against track A's one-load
  measure), outcome changed on 2 (ellipsoid-Pm-3-on free → held, a 217 χ²_ν gain;
  spheroid-P2m-on held → free), reach 62/66 as today.
- `npm run lint` clean; the engine's tests (rietveld, rvmodel, rvpool, rvsplit, rvlock, rvcif,
  rvui, smoke, widths, modules): 53 of 53 pass.

**5. Step 2: WPPM's shortcuts and the exact line** (`../STEP2.md`; `$W/fs2/step2/h/`). Step 2's
harness (`../scripts/step2/`: step 1's with `WPPM_OPT` from `PROTO_WPPM`) on frozen copies of step
1's engine and step 2's; runs at nice 15, three processes.
- No switch (`WPPM_OPT` all off; step 2's read-out tables and Soller cache only): the patterns
  equal step 1's to the bit (11 rows × 8 parameter points, WPPM and the Lorentzian profile), and
  the 22 sub-screen WPPM runs equal step 1's records on 22 of 22 (iso, evaluations, χ², outcome,
  dimensions, report), at 0.55× their CPU; lsq with v2 equals step 1's lsq records on 22 of 22.
- The switches against step 1's WPPM: patterns within 1.6·10⁻¹² of the peak (`fast`),
  1.3·10⁻⁵ (`pair`), 1.7·10⁻¹⁰ (`fast`, `axial`); against the generator 0.29 % of the peak
  (median) for all, as before. CPU of a fit on the 22 sub-screen runs under one load, × today
  (the Lorentzian, v522's search, equal to the pilot's records on 22 of 22): step 1's WPPM 2.13,
  no switch 1.18, `fast`+`pair` 0.80, `fast`+`axial` 0.52, all three 0.42; lsq with v2 0.74. The
  same outcome on 22 of 22 for each; on the 77 screening runs all three: outcome changed on 1
  (spheroid-P2m-on free → held, step 1's threshold case), reach 62/66, accuracy, anisotropy and
  spheres as step 1's WPPM, 0.98× its search evaluations, 0.20× its CPU; expected family margins
  8 / 3 / 0 as track A's WPPM; the cross-solid searches give its confusion and margin counts.
- The final engine with no switch set ('exact', the shortcuts on, the phase's profile the
  Lorentzian) equals those runs to the bit on 3 of 3 rows; 'lor' with 'today' equals the pilot's
  records on 2 of 2; 'lsq' with v2 step 1's lsq records on 2 of 2; a WPPM phase with `WPPM_OPT`
  off step 1's WPPM records on 2 of 2.
- `npm run lint`: clean; the engine's tests (rietveld, rvmodel, rvpool, rvsplit, rvlock, rvcif,
  rvui, smoke, widths, modules): 53 of 53 pass.

**6. Step 3: the per-line check** (`../STEP3.md`; `$W/fs2/step3/`). Step 3's harness
(`../scripts/step3/`) on step 2's engine (C1: the fits equal step 2's W4 records on 77 of 77, the
check's statistics, the jackknife and the refits computed by the method) and on the prototype's (P1).
- The prototype's search equals C1's on 77 of 77 (χ², outcome, solid, ΔBIC; its evaluations 2 more,
  the check's); its flag and its flagged segments equal the offline statistics on 77 of 77 (|Δz| at
  most 3·10⁻⁷); its jackknife equals the offline 4-iteration spread on the 26 flagged kept fits
  (within 2·10⁻⁶, the offline solids being rounded).
- `retest` on (P2, the 26 flagged kept fits): each outcome as the measured refits predict, 26 of 26
  (5 rejected: sqbox-P4m-on, cylinder-P-3m1-generic, sqbox-P-3m1-on, cylinder-Pm-3-generic,
  sphere-P6mmm-1).
- The final engine: its defaults equal P1 to the bit on 3 of 3 rows; `SHAPE_CHECK.on = false` equals
  step 2's fits on 2 of 2 (χ², the search's and the report's evaluations).
- `npm run lint`: clean; the engine's tests (rietveld, rvmodel, rvpool, rvsplit, rvlock, rvcif,
  rvui, smoke, widths, modules): 53 of 53 pass. No test asks for a free shape, so no test runs the
  check.

## What remains to tune

- **What the exact line brings with it** (step 2): WPPM reads model errors as shape more
  readily (its unbounded extents are all on rows with a model error; a 4.4 nm sphere with a size
  distribution keeps a spheroid at ΔBIC −3483). Step 3's check flags 14 of the 15 spoiled results
  and none of 39 clean ones, and its jackknife widens the flagged ones; the false shapes of a
  textured sphere and of a sphere with a size distribution stay (flagged), as do the unbounded
  extents. To confirm on the 154 tuning runs: the flag's false alarms on the clean rows (nominal
  0.2 % a pattern; none of 39 here), its catch of the spoiled results, the jackknife's coverage and
  `retest` (off), then the validation once. What the card says of `misfit` is the result card's
  (later). A phase with a free shape asked for is a WPPM phase whatever its profile: its
  isotropic size is WPPM's sphere's reading, and a project saved with a Lorentzian free shape is
  searched again. `WPPM_OPT.pair` changes the pattern by 10⁻⁵ of the peak (path noise in flat
  valleys, both ways); `false` costs 0.52× today instead of 0.42×. The lsq and Lorentzian lines
  still compute the Soller cells at every θ (about four fifths of an lsq evaluation with the cell
  free); the axial interpolation would serve them too, untested.
- **The starts when the isotropic fit reads no size** (step 1, under lsq): the deterministic starts sit at
  w0's floor (1e-3°, about 8 µm), where the lsq line's slope is small (its Gaussian part enters in
  quadrature); on ellipsoid-Pm-3-on every start of the class stopped at once and only one of
  v522's random fill starts got away (WPPM holds it, in step 1 and here). A floor on w0 tied to the instrument, or `SHAPE_FILL` > 0,
  to be measured on the tuning runs (5 of the 77 runs have the isotropic size at 0).
- `SHAPE_FWD` ('briefs'): forward-difference briefs reorder near-equal brief ends, both ways (step
  1: two losses of 2.7 and 4.9 χ²_ν, two gains of 828 and 217); cylinder-Pm-3m-on is kept by a
  23 χ² margin (15 χ²_ν). A central re-refinement of the best brief ends, or a fourth full refinement, are
  the alternatives to weigh; and whether the table's linear interpolation plays a part.
- `SHAPE_FILL` (0): the fill bought nothing under lor (35/35); under lsq it saved one row of 77
  (above), by a random start.
- `SHAPE_CENTRAL`: under lsq (the 22 rows here) the pass cost 41 evaluations (median, 32–113)
  and lowered χ² by at most 0.004 χ²_ν (under lor, B: at most 0.61); the covariance it makes is the
  reason to keep it, and `false` (the covariance alone, about 18) is the cheaper choice to weigh.
- The tables: steps (0.5°, 0.025), the fit's span and weights (X = 6, b = 0.2), and a better
  few-parameter line (lsq's two expected family errors, AB §3.6).
- The search's settings in v2: `shapeStarts` above its default adds random starts (one each,
  from their own stream), below it changes nothing; the families' cap of 5 (`lowIndexAxes`).
- The random turn (AB §4.6): v2 keeps v522's turns; the minima stage of the protocol is to make
  the result independent of them.
- What the user sees: a phase with a free shape asked for now reports its isotropic size (when
  the shape is rejected) by the ball's exact line (lsq: the ball's lsq line), smaller than the
  Lorentzian's Scherrer reading (which read ⟨L⟩_V 13–25 % long); the card's texts (`RV_INFO`: "a Lorentzian Y_s/cosθ") and the
  version (`sw.js` CACHE, the app's version) are not touched.
- The legacy ellipsoid (v522's search kept) is not measured; WPPM with 'all' was not run (step
  1 ran WPPM with the setting lsq chose). Not measured with WPPM's shortcuts: the log-normal
  profile, FCJ's axial model, a single wavelength.
