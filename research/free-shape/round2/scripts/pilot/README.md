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
  The grid's default is the pilot's decision, 10–100° in 0.01° steps. Writes one JSON.
- `methods/today.mjs`: today's search and report, b9bef5f unchanged. The search is
  `freeShape` as autoRefine calls it. The report is the card's, `bodyShapeOf`: the linear
  esds and the angular profiles, `turnEsds`. The two are timed apart. Run with the truth
  reference, `../harness/methods/truth.mjs`, the default `--method today,truth`.
- `batch.mjs`: rows in parallel, at most 3 processes, nice 15, resumable. It refuses
  validation rows. Results go to `results/<tag>/<row>.json` and `batch.log`.
- `report.mjs`: the tables of PILOT.md from a tag's records. The sections are cost (per run
  and per class), bias (per solid, error kind and class) and baseline (reach, outcome,
  accuracy by solid, class, orientation and error).
- `costgrid.mjs`: the ms per evaluation inside a brief refinement, by grid and cell scale,
  shaped and isotropic. `decide.mjs` turns these ratios and the first cost runs into the
  predicted mean run per configuration.
- `narrow.mjs`: the narrowest exact line of every design row, a lower bound on its FWHM. It
  gives the points per FWHM at a step.
- `lreading.mjs`: what the Lorentzian reads from one exact size line alone, per solid and
  direction.

## Commands

```sh
node run.mjs --row box-P4mmm-generic --out /tmp/x.json            # one run (10–100°/0.01°)
node run.mjs --row box-P4mmm-generic --kernel none                 # the in-model control
node batch.mjs --tag screen --rows screen --jobs 3                 # the 77-run screening set
node report.mjs --tag screen [--sections cost,bias,baseline] [--out f.md]
node costgrid.mjs --rows a,b --variants 10-130-0.01,10-100-0.01 --scales 1,0.8 --cif-dir ../phases/cif-v1
node decide.mjs; node narrow.mjs --hi 100; node lreading.mjs
```

## Results (`results/`)

- `cost/`: the first cost runs, one clean truth per class, on the first cells and 10–130°/0.01°.
- `costgrid/`: the per-evaluation profiles (`costgrid-*.json`, on the first cells) and
  `decide.json`.
- `checks/`: the checks re-run on the new cells: phases, generator, harness and frames.
  `narrow-100.json` is the narrowest-line table.
- `screen/`: today's search and the truth reference on the 77 screening runs, at the decided
  cells and grid. Round 2's reference; the 11 cost truths were run first, as its verification.
- `inmodel/`: three of the pilot truths drawn with the engine's own Lorentzian lines.

## The decision (PILOT.md has the numbers)

- **Cells:** P−1, P2/m and Pmmm scaled by 0.8 in every length (`../phases`, `scale`). The
  other eight are unchanged.
- **Range:** 10–100°.
- **Step:** 0.01°, unchanged.
