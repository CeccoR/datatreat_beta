# The round-2 pilot

The pilot of `research/free-shape/PROTOCOL.md`: one command that draws a design row and runs
today's search on it, the cost of a run in every Laue class, the choice of cells, range and step
by that cost, the bias of the model's Lorentzian on exact lines, and today's search on the
77-run screening set, round 2's reference. The write-up is
`research/free-shape/round2/PILOT.md`. Paths are relative to this folder,
`/tmp/claude-0/-home-user-datatreat-beta/51d5ad4e-64c4-51d8-8fdc-0e18be5b5240/scratchpad/fs2/pilot`.
Node 22: `/opt/node22/bin/node`.

## Files

- `run.mjs`: one row, drawn and refined. The generator draws the row in memory
  (`../gen/gen.mjs` drawRow, exact lines, or `--kernel none` for the engine's own), and the
  harness refines it (`../harness/lib.mjs` runCase) with each method, all from one isotropic fit.
  The grid's default is the generator's `GRID`, the pilot's decision: 10–110° in 0.01° steps.
  Writes one JSON (`writeResult`: unbounded extents as "Infinity").
- `methods/today.mjs`: today's search and report, b9bef5f unchanged. The search is
  `freeShape` as autoRefine calls it. The report is the card's, `bodyShapeOf`: the linear
  esds and the angular profiles, `turnEsds`. The two are timed apart. Run with the truth
  reference, `../harness/methods/truth.mjs`, the default `--method today,truth`.
- `batch.mjs`: rows in parallel, at most 3 processes, nice 15, resumable. It refuses
  validation rows. Results go to `results/<tag>/<row>.json` and `batch.log`.
- `report.mjs`: the tables of PILOT.md from a tag's records. The sections are cost (per run
  and per class), bias (per solid, error kind and class) and baseline (reach, outcome,
  accuracy by solid, class, orientation and error) and minima (today's minimum against the
  truth reference's; the elliptic cylinders' height on another extent). Medians and
  percentiles keep unbounded extents (+∞, the largest error); the tables count them.
- `inmodel.mjs`: the in-model controls (the `inmodel` tag) against the same truths with exact
  lines (the `screen` tag), run by run and in medians.
- `costgrid.mjs`: the ms per evaluation inside a brief refinement, by grid and cell scale,
  shaped and isotropic. `decide.mjs` turns these ratios and the first cost runs into the
  predicted mean run per configuration.
- `narrow.mjs`: the narrowest exact line of every design row, a lower bound on its FWHM. It
  gives the points per FWHM at a step.
- `lreading.mjs`: what the Lorentzian reads from one exact size line alone, per solid and
  direction.
- `fix/`: the pilot's verification fixes (PILOT.md §10).
  - `errors-check.mjs`: the hump's, impurity lines' and air's realised strength on every design
    row with one (`errors-check.json`).
  - `pattern110.mjs`: the verifier's direct synthesis of the exact-line correction against the
    generator, on 10–110° and the final cells, with the engine's window and the whole-pattern
    one (`pattern110.json`).
  - `rescore.mjs`: the first baseline (`results/screen-c3`) scored again with the fixed harness,
    no run repeated (`results/screen-c3-rescored`).
  - `compare-c3.mjs`, `cost-compare.mjs`: the final baseline against the first one, row by row,
    and the cost of the rows both hold.
  - `*.before.*` (work folder only; the repository's history holds them): the files as they
    were before the fixes.

## Commands

```sh
node run.mjs --row box-P4mmm-generic --out /tmp/x.json            # one run (10–110°/0.01°)
node run.mjs --row box-P4mmm-generic --kernel none                 # the in-model control
node batch.mjs --tag screen --rows screen --jobs 3                 # the 77-run screening set
node report.mjs --tag screen [--sections cost,bias,baseline,minima] [--out f.md] [--json f.json]
node inmodel.mjs [--exact screen] [--none inmodel] [--out f.md]
node costgrid.mjs --rows a,b --variants 10-130-0.01,10-100-0.01 --scales 1,0.8 --cif-dir ../phases/cif-v1
node batch.mjs --tag inmodel --rows <the 11 cost truths> --kernel none --jobs 3   # the in-model controls
node decide.mjs; node narrow.mjs --hi 110; node lreading.mjs
```

## Results (`results/`)

- `cost/`: the first cost runs, one clean truth per class, on the first cells and 10–130°/0.01°.
- `costgrid/`: the per-evaluation profiles (`costgrid-*.json`, on the first cells) and
  `decide.json`.
- `checks/`: the checks on the final cells and grid: phases (`phases-check.out`), generator
  (`gen-checks.out`), harness (`harness-test.out`), frames (`check-frames.out`), the errors'
  strengths (`errors-check.json`), the correction against a direct synthesis
  (`pattern110.json`), the narrowest line (`narrow-110.json`). `checks-c3/`: the same as run for
  the first decision.
- `screen/`: today's search and the truth reference on the 77 screening runs, at the final cells
  and grid. Round 2's reference; the 11 cost truths were run first, as the cost's verification.
- `inmodel/`: the 11 cost truths drawn with the engine's own Lorentzian lines.
- `screen-c3/`, `inmodel-c3/`: the same at the first decision (C3: P−1, P2/m and Pmmm × 0.8,
  10–100°), superseded; `screen-c3-rescored/` is `screen-c3` scored with the fixed harness.
- `<tag>/report.md`: `report.mjs`'s tables for each tag (in the repository as
  `research/free-shape/round2/tables/pilot-*.md`). `<tag>-digest.json` holds one line per run,
  as `report.mjs --json` writes it.

## The decision (PILOT.md has the numbers)

- **Cells:** every cell scaled by 0.8 in every length (`../phases`, `scale`).
- **Range:** 10–110°.
- **Step:** 0.01°, unchanged.

The first decision (only P−1, P2/m and Pmmm scaled, 10–100°) was set aside after the pilot's
verification: it was dearer and left those three classes with half the others' members.
