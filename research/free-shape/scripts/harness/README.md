# Free-shape harness

A Node harness for the free crystallite shape (RIETVELD.md §10) on a frozen copy of the
engine: it draws synthetic patterns with the engine's own forward model, refines them as
the app does up to the shape search, runs one or more search methods there from the same
isotropic fit, and measures each: pattern evaluations, wall time, every refinement it made
(each start's end, the χ² path), the solid it reports and the free fit behind it, and
their errors against the truth. Nothing here touches the app's files.

Paths below are relative to this folder,
`/tmp/claude-0/-home-user-datatreat-beta/51d5ad4e-64c4-51d8-8fdc-0e18be5b5240/scratchpad/fs/harness`.
Node 22: `/opt/node22/bin/node`.

## What the fixtures are (and the user's samples are not here)

`e2e/xrd/s00..s11.xrdml` are **not** the user's twelve SrTiO₃ samples (33A…38D). They are
the repository's test fixtures, written by `tests/fixtures.mjs` `xrdml(k)`: a cubic
perovskite drawn with pseudo-Voigt lines (η 0.5, FWHM 0.10 + 0.0016·2θ °: one width law,
no anisotropic broadening), Kα1/Kα2, a sloping background and noise 0.3√y, 10–80° in 5384
points, the cell 0.035 % smaller per k; the tests load s00–s02 as samples and s11 as a
"standard-like" pattern, and refine them without a standard. Their header has the
wavelengths only (no Sollers, no radius). RIETVELD.md's runs on the user's samples
(33A_STO_WCL, 36D, 37D …, with the standard LaB6_real) used the user's own files, which
§14 says are kept outside the repository; they are not on this machine (searched: no
other .xrdml, no LaB6 file). So:

- the harness's **sample-like cases** `u01`–`u12` stand in for the twelve: {110} plates
  (boxes 1.6–2.6 nm thick, 10–23 nm across, normal on [110], in-plane turns 0–45°, one 6°
  off), the Sr site at 1 − 0.64/t (RIETVELD.md §8.5: 0.32 nm of Sr-free site per face,
  0.60–0.75), one ΔB 0.02–0.38 Å², and a broad hump at 30° (FWHM 6°, 14–37 % of (110)'s
  area, larger the lower the occupancy: BACKLOG's "broad component") that the model does
  not have, so that χ²_ν is above 1 (1.3–1.6) and the minimum is not the truth's, as on
  real data. One noise realisation each.
- the fixtures themselves are two **negative controls**, `fx-s00` and `fx-s05`, refined as
  the app would with s11 refined as the standard (SrTiO3 as its phase, FCJ): their lines
  are as sharp as the standard's, so the shape must be rejected.

## The instrument and the grid

- The samples' grid: the fixtures' (10–80°, 5384 points, 0.0130°).
- The instrument: Cu Kα1/Kα2 (0.5), R 240 mm, Sollers 0.04 rad both sides, 12 mm focus
  (the Soller model, §3.7.1, as the user's files give it).
- **The standard**, as the app makes it: LaB6 (the card's built-in CIF, from
  `xrd-rv.js`) drawn on 10–120° (8463 points, 15 000 counts at the strongest line on
  150) with U 0.0020, V −0.0012, W 0.0010 °², X 0.010, Y 0.018 °, L 30.7 mm, sin 2θ shift
  −0.0171°, zero 0.008°, Poisson noise, refined by `autoRefine({ standard: true })` with
  one ΔB (2.1 s), its profile taken as `irfOf` takes it. It refines to χ²_ν 1.000,
  U 0.00182, V −0.00085, W 0.00090, X 0.0076, Y 0.0188, L 37.7 mm, zero 0.0050°
  (`data/irf.json`). The samples are **drawn with that refined profile**, the one
  autoRefine holds on them: the errors measured are the search's and the noise's, not
  the standard's.
- A sample's state besides its solid (`lib.mjs` SAMPLE): a 3.916 Å (the CIF's 3.905: the
  cell search runs), Sr site 0.70, ΔB 0.2 Å², X_s 0.02°, displacement 0.02°, a Chebyshev
  background of about 200 counts and a 1/2θ term, the strongest line scaled to 1100
  counts above it (33A's strongest: 1124). The phase is refined as the card sends it with
  *free shape*, *one ΔB* and *Site occupancy Sr1* (the backlog prototype's set).

## Cases (`cases.mjs`; `node run.mjs --list`)

46 cases, 110 runs:

- 30 synthetic truths, 3 noise realisations each (seeds 1–3), every solid: box 8
  (plates ⟂[110] on the lattice, turned 20° in plane, 8° off; ⟂[100]; ⟂[111] 30×25×2; a
  needle ∥[111]; a ribbon; a block at random), square-based box 5, ellipsoid 5, spheroid 4,
  cylinder 4, elliptic cylinder 4; sizes 2–30 nm; orientations on the lattice, turned in
  plane, a few degrees off, at random. Each is searched as its own solid.
- 2 isotropic controls (7 nm searched as a box, 20 nm as a cylinder), 3 realisations each.
- 12 sample-like proxies `u01`–`u12` (boxes, above), one realisation each.
- 2 fixture controls `fx-s00`, `fx-s05` (searched as a box).

## Running

```sh
node run.mjs --list
node run.mjs --case box-plate110 --seed 1 --method methods/baseline.mjs,methods/truth.mjs --out /tmp/x.json
node batch.mjs --tag mymethod --method methods/mine.mjs,methods/truth.mjs [--cases synth|sample|control|fixture|all|id,id] [--seeds 1] [--jobs 2]
node table.mjs --tag mymethod --ref baseline     # Δ against the best of both tags' runs
```

- `run.mjs`: one (case, seed); `--shape` searches another solid than the truth's (the
  truth's errors are then not computed), `--fit '{"shapeStarts":20}'` passes the card's
  fit settings, `--nolog` drops the per-refinement log.
- `batch.mjs`: one process per (case, seed) under `nice -n 15`, at most 2 at a time;
  `results/<tag>/<case>-<seed>.json`, skipped when present (a batch resumes);
  `results/<tag>/batch.log`.
- `table.mjs`: `results/<tag>/summary.json` and `table.md`.
- Put `methods/truth.mjs` beside a method in each run (as above) when its runs are to
  be judged on their own: it is cheap (3 refinements, 3–8 s) and gives the minimum next
  to the truth for "the best χ² any run found". Or pass `--ref baseline` to table.mjs,
  which holds the baseline's and the truth's.

### As a library

```js
import { runCase, loadMethod, CASES, compareSolids, sameSolid, basins, solidOf, ENG } from './lib.mjs';
const m = await loadMethod('methods/baseline.mjs');
const out = runCase({ id: 'u03', seed: 1, methods: [m], shape: null, fit: {} });
```

## A method

A module whose default export is `{ name, search(model, k, res, free, opts, ENG, ctx), reference? }`.

- It is called where autoRefine calls `freeShape` (stage "free shape"), with the same
  arguments: the model at the isotropic fit, the phase index, the isotropic fit's
  result, the names free there, autoRefine's options (`opts.fit` the fit settings).
- It returns what `freeShape` returns: `{ res, info }` with `model.v` at the solid kept,
  `{ rejected: true, dBIC, early }` with `model.v` back at the isotropic fit, or `null`.
- `ENG` is the engine's internals (`eng/xrd-rietveld.js` ENG): `freeShape`,
  `freeShapeRun`, `refine`, `setParams`, `evaluate`, `calc`, `bodyFrame`, `BODIES`,
  `quatMat`, `quatOfMat`, `quatMul`, `quatOfRot`, `lowIndexAxes`, `lattDirection`,
  `latticeAcross`, `shapeWidths`, `columnLengthV`, `SHAPE_SOFT`, `fitSettings`,
  `shapeOf`, `turnEsds`, `phasePattern`, `FS` (the counters). The widths of §12 are
  `eng/xrd-widths.js` `measureWidths`.
- `ctx`: `{ case, seed, shape, iso, rng, truth }`; `truth` is null unless the method
  says `reference: true` (a search must not read it).
- A method that copies `freeShapeRun` to change it can import the engine's other
  internals from `ENG` (or copy `eng/xrd-rietveld.js` into its own folder).
- Several methods in one `--method` list run in turn from the same isotropic fit
  (`model.v` reset between them). Evaluations are exact either way; for wall times
  compare the first method of each process (the line caches are warm for the later
  ones).

## What is measured (each record of `results/<tag>/<case>-<seed>.json`)

- `iso`: the isotropic fit's χ² (total Σw(y − y_c)², Mighell's weights), χ²_ν, N, P,
  its evaluations and time (from the CIF: about 330–420 evaluations, 1–1.6 s).
- `evals`: pattern evaluations in the search: calls of `phasePattern` (one phase's
  pattern; every trial step, every Jacobian column's two sides, the FCJ audit).
- `ms`: the search's wall time, in one Node process, under `nice -n 15`, 2 runs at a
  time, on this 4-vCPU machine shared with another job: the repeatability of the times
  was not measured; evaluations are the measure to compare, the times their scale.
- `refines`, `iterations`; `log`: every refine() of the search: its maxIter, iterations,
  evaluations, time, χ² at its end, whether the faces were rounded (`soft`) and the
  orientation free (`rot`), the solid it started from and ended at (`from`, `to`: type,
  W, dims, axes), and `at`/`t` (evaluations and ms since the search began): the χ² path
  and every start's end.
- `kept`, `held`, `rejected`, `early`, `dBIC` (against the isotropic fit, as the card's).
- `chi2` at the end; `chi2Free` (the lowest χ² of the exact solid with its orientation
  free among its refinements, and `freeSolid`), `chi2Held` (held on the lattice),
  `chi2Best` (the lower: the free model's minimum is at most either). A rounded-face
  refinement does not count (an ellipsoid's or a spheroid's has no faces).
- `solid`: the solid reported (`dims` in nm along body x, y, z, `axes` its axes in the
  crystal's Cartesian frame, `W`); `acc` and `accFree`: `compareSolids` of the reported
  and of the free solid against the truth; `accLoose`: the reported solid's three extents
  against the truth's whatever their class (an elliptic cylinder whose axis lies on the
  truth's thin extent). The output's `truth` is the truth's solid.
- `compareSolids(fit, ref)`: dimensions paired by size within the body's axis classes (a
  box's three, an ellipsoid's three, a cylinder's diameter against its height, an
  elliptic cylinder's section against its height); `dimErr` relative, per axis of the
  ref; `orient`: after the best of the 24 proper rotations of m-3m, the worst angle
  between paired axes (axes without sign), axes the ref ties within 4 % tried in every
  order (a cube's) or left out (a ball's, a round section's); `principal`: the same for
  the ref's most distinct axis alone (a plate's normal, a needle's axis). Cubic only.
- `table.mjs`: Δ = (chi2Best − the best chi2Best any run of the case and seed found, any
  tag given)/max(1, χ²_ν); **reached** Δ ≤ 1; per case the precision over its
  realisations: the sd of each dimension's relative error, and the mean pairwise
  misorientation of the reported solids.
- JSON writes an unbounded dimension as null: read results with `readResult(text)` (lib).
- `ends.mjs --tag <t>`: where each run's starts ended (`ends.md`, `ends.json`).
- `basins(record)`: a record's refinement ends grouped into morphologies (8°, e^0.25:
  the backlog's step 7), from the lowest χ²; `sameSolid(a, b)`.

## The engine copy

`make-eng.mjs` copies the frozen engine (`../engine`, `git archive bf228ee`) into `eng/`
and instruments `xrd-rietveld.js` only (`eng.diff`): `phasePattern` and `refine` wrapped
(counting, logging), autoRefine's call of `freeShape` through `opts.shapeHook`, the
internals exported as `ENG`. No arithmetic changes: the baseline's search is the app's.

## Files

- `lib.mjs` the API; `cases.mjs` the case list; `run.mjs`, `batch.mjs`, `table.mjs`;
  `methods/baseline.mjs` (the app's `freeShape`), `methods/truth.mjs` (the reference);
  `make-eng.mjs`, `eng/`, `eng.diff`; `ends.mjs`; `fig.mjs` (the per-case figure) and
  `svg2png.mjs` (renders an SVG with Playwright's Chromium); `data/irf.json`, `data/irf-fx.json` (the
  standards' profiles); `results/baseline/` (the baseline: one JSON per run,
  `summary.json`, `table.md`, `ends.md`, `fig-cases.svg`/`.png`, `batch.log`); `tmp/` scratch.

## The baseline: the app's search as it is (bf228ee)

All 46 cases, 110 runs, `node batch.mjs --tag baseline --method methods/baseline.mjs,methods/truth.mjs`:
23.2 min with 2 processes under `nice -n 15` (on a machine shared with another job).
Per run: `results/baseline/<case>-<seed>.json`; `table.md` (per set, per solid, per case,
per run), `summary.json`, `ends.md`/`ends.json` (where the starts ended),
`fig-cases.svg`/`.png` (per case and realisation: evaluations, Δ, the normal's error, the
largest dimension's error).

**Cost.** 390 577 evaluations in 2232 s of search over the 110 runs: 5.7 ms an evaluation
(one SrTiO₃ pattern, 5384 points, the Soller model, this machine, niced). Mean per run:

| set | runs | evaluations | s |
|---|---|---|---|
| synthetic | 90 | 3577 | 20.1 |
| sample-like | 12 | 4367 | 28.6 |
| isotropic controls (rejected early) | 6 | 2235 | 11.5 |
| fixtures (rejected early) | 2 | 1405 | 4.3 |

By solid (synthetic, mean evaluations): spheroid 2381, cylinder 2927, sqbox 3389,
ellipsoid 3741, box 3973, elliptic cylinder 4663. The isotropic fit before the search: 353
evaluations, 1.0 s. The truth reference: 682 evaluations, 3.8 s. The backlog's prototype
had 4195 evaluations a run for the box on its 20 cases.

**Reached** (Δ ≤ 1 against the best exact χ² of the baseline's or the truth reference's
refinements): 85 of 86 synthetic runs that reached a full refinement (box-plate110-off8
seed 2 at Δ 2.0: held on [110]; the truth reference's minimum, 8° off as the truth, 2.1 lower in χ²), 12 of 12
sample-like. Outcomes of the 90 synthetic runs: 65 held on the lattice, 15 free, 10
rejected (5 early). The rejections are the data's, not the search's: for the same
patterns the truth's own refinement has ΔBIC −1 to +40 against the isotropic size (mild
blocks: box 8×11×15 and square box 10×10×16 at random, elliptic cylinder 6×14×9 at
random, ellipsoid 8×11×16, spheroid 10×10×16), above the −10 the app asks. Every control
is rejected early (ΔBIC +3 to +17).

**Accuracy** (the 80 synthetic runs that kept a solid): largest dimension error median
7 %, 90th percentile 29 %; the smallest dimension (a plate's thickness, a needle's
section) median 1.5 %, 90th percentile 6 %; the truth's most distinct axis (normal or
needle axis) median 0.0°, 90th percentile 8.0°, worst 24.9° (ecyl-rand). Where it fails it
is the poorly resolved long dimensions: a plate's in-plane edges (box 30×25×2: 34 %), a ribbon's length; and in-plane turns of plates
(box-plate110-t20, sqbox-plate110-t15: 13° worst-axis error, 23.5° between
realisations). An elliptic cylinder may put its axis on the thin extent instead of the
long one at Δ 0.1 (ecyl-ribbon001, 2 seeds of 3: section 37×11, height 3.7 for section
4×12, height 30; by class 167 % off, by extent 28 %, case means; an elliptic plate 16×10×2.5 likewise in 1 seed of 3, 246 % and 19 %).

**Precision** (per case, over the 3 realisations): `table.md`, last two columns; on-lattice
plates and rods 0° misorientation and 1–8 % sd of the dimensions; in-plane turns and
random orientations 2–40°.

**Sample-like proxies** (the hump unmodelled, χ²_ν 1.37–2.54 isotropic, 1.04–1.42 with
the box): the thickness reads 6–28 % thin (median 17 %), the normal 4.9–9.0° off [110] on 10
of 12 (on it on u04, 1.8° from the truth's 6° tilt on u08), the longest dimension
unbounded or 2–11 times too long on 5 of 12, 1.6–1.8 times on 3 more. The search reaches its best (Δ 0, u08 Δ 0.8
behind the truth reference) but the best is not the truth: the misfit, not the search,
sets the solid.

**Where the starts end** (`ends.md`; brief ends grouped at 8° and e^0.25, rounded faces
included): synthetic 990 starts in 556 groups, 304 (31 %) in the best fit's morphology;
65 of 90 runs have more than one morphology within Δ 10 (303 in all); sample-like 132
starts in 99 groups, 24 in the best's, 11 of 12 runs with more than one within Δ 10 (34
in all; u09 and u10 five each). Many of these differ only along a poorly resolved long
dimension (a 25 nm needle 23–64 nm long, a plate's edge 68 or 2000 nm), which the e^0.25 rule
splits: a grouping for uniqueness should weigh dimensions by their resolution.
