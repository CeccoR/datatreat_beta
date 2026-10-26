# Scripts behind round 2 (`../PILOT.md`)

The pilot's numbers come from these scripts. They run in Node 22 on a frozen copy of the
engine at commit `b9bef5f`. They are research code: the app loads none of them, and nothing
in the app was changed to run them. The results are not in the repository. There is one JSON
per run, under 1 MB in all for the pilot. `../PILOT.md` quotes their tables.

The folders keep the layout of the work folder they ran in (`fs2/`). Each folder has its own
README with its API and its checks.

| Folder | What | Main entry points |
|---|---|---|
| `phases/` | the eleven fictitious phases, one per Laue class: their CIFs and their checks against the engine | `make-phases.mjs` (writes `cif/`), `check.mjs` (`phases.json`), `cost.mjs` |
| `gen/` | the generator: one pattern per design row, with the exact size line of every member | `gen.mjs` (`drawRow`), `kernels.mjs` (A(L)), `checks.mjs`, `draw.mjs`, `make-eng.mjs` |
| `harness/` | the refinement harness: a row refined to the shape search, each method run there, compared with the truth modulo the class | `lib.mjs` (`runCase`, `accuracy`, `canonical`), `test.mjs`, `run.mjs`, `batch.mjs`, `make-eng.mjs`, `methods/` |
| `design/` | the 231-row design: 198 truths, 33 spheres, the split, the hypercube | `make-design.mjs` (`design.json`), `check-frames.mjs` |
| `pilot/` | the pilot: draw-and-run, cost, the decision, the bias, today's search on the screening set, the in-model controls, the verification's checks | `run.mjs`, `batch.mjs`, `report.mjs`, `inmodel.mjs`, `costgrid.mjs`, `decide.mjs`, `narrow.mjs`, `lreading.mjs`, `methods/today.mjs`, `fix/` |

The small inputs are here:
- `phases/cif/`: the CIFs as round 2 uses them, every cell scaled by 0.8. `phases/cif-v1/` holds
  the first cells, `phases/cif-c3/` the pilot's first decision (P−1, P2/m and Pmmm scaled).
  `make-phases.mjs` writes `cif/`.
- `design/design.json` (revision 2: the near cylinders and spheroids turned by their full tilt).
- `gen/data/irf.json`: the generator's LaB6 standard, drawn and refined, cached.
- `harness/data/irf-r1.json`: round 1's standard, for the harness's stand-in tests only.
- `phases/phases.json` and `gen/results/checks.json`: the checks as last run, on the final cells
  and grid. `pilot/fix/errors-check.json` and `pilot/fix/pattern110.json`: the verification's
  checks of the generator.

## Setting up a work folder

```sh
R=/path/to/datatreat_beta                  # this repository
W=/path/to/work                            # any empty folder
mkdir -p $W/fs2/engine $W/fs/harness/data
git -C $R archive b9bef5f | tar -x -C $W/fs2/engine           # the frozen engine (read-only)
cp -r $R/research/free-shape/round2/scripts/. $W/fs2/
cp $R/research/free-shape/scripts/harness/data/irf.json $W/fs/harness/data/   # round 1's LaB6 (phases/check.mjs, cost.mjs)
cd $W/fs2/harness && node make-eng.mjs                         # eng/: counters, refine log, the search's hook
cd $W/fs2/gen && node make-eng.mjs                             # eng/: the exact-line hook
```

Then, from `$W/fs2`:

```sh
node phases/check.mjs                      # the phases against the engine (4 min)
node gen/checks.mjs                        # the generator's checks (1 min)
node harness/test.mjs                      # the harness's tests (1 min)
node design/check-frames.mjs               # the design's frames against the search's held route
cd pilot
node batch.mjs --tag screen --rows screen --jobs 3     # today's search on the 77 screening runs (about 70 min, 3 processes)
node report.mjs --tag screen                           # PILOT.md's tables
node batch.mjs --tag inmodel --rows <the 11 cost truths> --kernel none --jobs 3
node inmodel.mjs                                       # the in-model controls against the exact lines
```

- `pilot/run.mjs` draws each pattern in memory: no pattern files are needed. The grid, 10–110°
  in 0.01° steps, is the pilot's decision and the generator's default (`gen/gen.mjs` `GRID`), so
  every caller uses it.
- Run heavy jobs under `nice -n 15`. `batch.mjs` does this itself.
- `batch.mjs` refuses the validation rows. They are scored once, on the final version
  (`../../PROTOCOL.md`).
- `pilot/costgrid.mjs` reproduces the per-evaluation profiles on the first cells with
  `--cif-dir ../phases/cif-v1`. `pilot/decide.mjs` needs the first cost runs: `node batch.mjs
  --tag cost --rows <the 11 ids in PILOT.md> --lo 10 --hi 130 --jobs 3`, with `phases/cif`
  set back to `cif-v1`. The first decision's runs need `cif-c3` and `--hi 100`.
- Records are written with `harness/lib.mjs` `writeResult` (unbounded extents as "Infinity") and
  read with `readResult`.
