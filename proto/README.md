# proto/: tabs that work in the background (backlog 23)

These are prototypes and measurements, not part of the app. The app loads nothing from here,
and sw.js does not cache any of it: none of it is in sw.js's ASSETS. No app file of v517
(b93ed5c) was changed. The changes exist only as patches, applied in copies of the tree.

**`ASSESSMENT.md` is the result**: the question, the method, the numbers for each option, the
review's corrections and the recommendation. Every number in it points to a raw file in the
folders below.

## What each folder holds

| folder | what | read first |
|---|---|---|
| `live-tabs/` | option b1: every tab an iframe running the app in an embedded mode, under a shell holding the tab bar. It is a setting, off by default | `live-tabs/README.md` |
| `bg-runs/` | option A: a Rietveld refinement goes on when its tab is left, its results written into the parked tab and its history | `bg-runs/README.md` |
| `workers/` | the pool: Refine all over several workers, one cap for the whole browser (Web Locks), for HEAD, b1 or A | `workers/README.md` |
| `map/singletons/` | the inventory of what assumes one instance per module: `scan.mjs` (acorn AST scan) → `scan.json`, `probe.mjs` (runtime probe, listeners through CDP) → `probe.json`, `counts.sh` (greps of HEAD) → `counts.txt` | this page |
| `map/runs/` | the Rietveld runs mapped before the prototypes: the app's worker benched alone (one at a time, then pools of k), the app's Refine all, the tab on show beside k workers, and option A's cost of writing into a parked tab. Scripts, the bench page and `results/` | this page |
| `review/` | the independent review's own scripts (`measure/`, real mouse and keyboard input) and raw outputs (`results/`: JSON, logs and test logs) | this page |

Each prototype folder holds:

- `README.md`: the verdict, how it works, how to apply and run it, the method, the tables,
  the limits, the optimisations and the effort;
- its patches;
- `measure/`: one script per measurement, plus `run-all.sh` and `summary.mjs`;
- `results/`: each run's JSON and log, plus `summary.txt` and the full test-suite logs;
- `fixtures/`: the XRPD, CIF, DRS, GC and EPR files the scripts read.

The 8 SEM TIFFs (2048 × 2176, 16-bit) are not stored. tests/fixtures.mjs `makeTiff` makes
them.

## Applying a patch

Every patch is a git diff against v517 (b93ed5c). Apply from the repo root, with
`git apply --check` first:

| to try | apply, in this order | then |
|---|---|---|
| the pool alone | `proto/workers/pool.patch` | `node --test tests/rvpool.test.mjs` |
| b1, live tabs | `proto/live-tabs/live-tabs.patch`, optionally `proto/live-tabs/live-tabs-lean.patch` | Settings › Tabs › "Each live (prototype)"; `node --test tests/livetabs.test.mjs` |
| b1 + pool | `live-tabs.patch` (with or without `live-tabs-lean.patch`), then `workers/pool.patch`. The pool may also go first | both tests above |
| A, background runs | `proto/bg-runs/bg-runs.patch` | `node --test tests/bgruns.test.mjs` |
| A + pool | `bg-runs.patch`, then `proto/workers/pool-on-bg-runs.patch` | `node --test tests/bgruns.test.mjs tests/rvpool.test.mjs` |

What does not go together:

- `pool.patch` does not apply on bg-runs: use `pool-on-bg-runs.patch` there.
- `bg-runs/bg-runs-pool.patch` is the older pool for A, capped within the page only.
  `workers/pool-on-bg-runs.patch` replaces it; use one or the other.
- `live-tabs.patch` and `bg-runs.patch` do not apply on each other (tabs.js, sessions.js and
  utils.js conflict), and A is not needed with b1.

These combinations were checked on git-archive copies of HEAD. `npm test` runs the whole
suite. It passes on:

- HEAD + `live-tabs.patch` (184 tests);
- HEAD + `bg-runs.patch` (190);
- HEAD + `pool.patch` (187);
- HEAD + `bg-runs.patch` + `pool-on-bg-runs.patch` (195).

To take a patch out again, use `git apply -R` with the patches in reverse order.

## Running the measurements again

Each prototype's README gives the exact commands:

1. build git-archive copies of HEAD;
2. apply the patches;
3. serve each copy on its port;
4. run `measure/run-all.sh`;
5. run `node measure/summary.mjs`.

The ports are 8971–8973 for `live-tabs/`, 8980–8982 for `bg-runs/` and 8970–8976 for
`workers/`; each script's `*_BASE` variables change them. Machine time on 4 CPUs, with
nothing else running: about 2.5 h for live-tabs, 40 min for bg-runs and 50 min for workers,
plus about 10 min per full test suite. Playwright is the global one
(`/opt/node22/lib/node_modules/playwright`).

`map/` and `review/` are kept as they ran, as the record behind ASSESSMENT.md's numbers.
Their fixture paths point to the session's scratchpad, which is gone:

- in `map/runs/*.mjs` the `FX` and `CIF` constants;
- in `review/measure/rlib.mjs`, `SP`, `OUT` and the `BASE` ports 8984–8989;
- in `map/singletons/probe.mjs`, `S`.

To run them again, point those at `live-tabs/fixtures/`, and make the SEM TIFFs with
`review/measure/mksem.mjs`.

- **`map/runs/` bench**: copy `map/runs/bench/` into a served HEAD copy as `bench/`, together
  with the 12 XRDML files and the CIF, then set `BASE`. Results go to `map/runs/results/`.
  The four large JSON files there are gzipped (`zcat`).
- **`map/singletons/`**: `node map/singletons/scan.mjs <tree>` prints the scan;
  `sh proto/map/singletons/counts.sh` (from the repo root) prints the counts.
