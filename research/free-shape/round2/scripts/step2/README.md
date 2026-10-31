# Step 2's scripts (`../../STEP2.md`)

WPPM made cheaper and measured against itself. Ran in `$W/fs2/step2/h/` beside the shared `fs2/`
folders (`setup.sh <repository>` makes it, and the two app copies `$W/step1-app`, `$W/step2-app`;
copy this folder's files into `h/` first). Everything is deterministic; validation rows are refused
by `batch2.mjs`.

- Engines and harness: `make-eng.mjs <app copy>` (the instrumented engine copy; `SHAPE_FWD` from
  `PROTO_FWD`, `WPPM_OPT` from `PROTO_WPPM`), `run.mjs` (step 1's: one row drawn, fitted
  isotropically, searched, reported; `PROTO_LINE`, `PROTO_SEARCH`, `PROTO_FWD`, `PROTO_PROFILE`,
  `PROTO_WPPM`; `--shape` in `hxs/`), `prof/mkhp.sh <dir> <engine dir>` (a harness folder whose
  engine is another copy).
- Batches: `batch2.mjs <jobs>` (≤ 3 processes, nice 15, timeouts, resumable; a job line names its
  harness folder and switches, `default` leaves a variable unset), `mkjobs2.mjs <rows> <variants>`
  (rows longest first, a row's variants together under one load); the job files `jobs-sub.txt` (the
  22 sub-screen rows: T, W0, W1, W3, W4, W5, L1), `jobs-screen.txt` (W4 and W5 on the 77),
  `jobs-def.txt`, `jobs-def2.txt` (the prototype's defaults and switches against earlier records),
  `jobs-xs.txt` with `runxs.sh` (the cross-solid searches, `xargs -P 3 -L 1 ./runxs.sh < jobs-xs.txt`).
- Profile: `prof/make-prof.mjs [engine] [out]` (timers around WPPM's parts, the Soller cells,
  lineNodes and each Jacobian column), `prof/runprof.sh <harness> <out> <row>` (a whole run with
  them), `prof/sum-run.mjs <dir> [--md]`, `prof/prof.mjs [rows] [--it n]` (a central refinement
  from the truth ×1.1: ms an evaluation and a column, WPPM and the Lorentzian profile; `ENGP`, and
  `PROTO_WPPM`). `bench/rd.mjs` (the read-out's variants alone, ns a point), `bench/cpuprof.mjs
  <.cpuprofile> [function]` (self time by function from `node --cpu-prof`).
- Checks: `bench/ident-pat.mjs [rows] [--profile]` (bit identity of patterns, step 1's engine
  against step 2's at the truth and 7 displaced points), `bench/pattern2.mjs` (track A's pattern
  check, against the generator and against WPPM; `ENGDIR`), `ident.mjs <mine> <reference>` (runs
  bit for bit).
- Scoring: `score.mjs --line wppm --v ... --best $(cat best-wppm2.txt) [--rows sub]` (step 1's, the
  sub-screen added), `cost.mjs`, `cost2.mjs <rows> <reference> label=dir ...` (CPU × reference, per
  class), `bench/shapesep2.mjs --data exact` (track A's noise-free cross-family fits on step 2's
  engine; `ENGDIR`, `PROTO_PROFILE`, `PROTO_WPPM`), `bench/margins.mjs W4=<json>` (expected margins
  beside track A's lsq and WPPM); track A's `xconf.mjs` and `fix/xmargin.mjs` read the cross-solid
  searches as they are.

```sh
node batch2.mjs jobs-sub.txt                      # 154 runs, ≈ 40 min
node cost2.mjs sub T T=results/T W0=results/W0 W1=results/W1 W3=results/W3 W5=results/W5 W4=results/W4 L1=results/L1
node ident.mjs results/W1 ../../step1/h/results/v2b-wppm      # 22 of 22 identical
node score.mjs --line wppm --rows sub --v W0=results/W0,W3=results/W3,W5=results/W5,W4=results/W4 --best $(cat best-wppm2.txt)
node batch2.mjs jobs-screen.txt                   # W4 and W5 on the other 55 rows, ≈ 15 min
node score.mjs --line wppm --v v2b=../../step1/h/results/v2b-wppm,W5=results/W5,W4=results/W4 --best $(cat best-wppm2.txt)
for m in "" fast pair fast,axial pair,axial; do PROTO_PROFILE=wppm PROTO_WPPM="$m" node bench/pattern2.mjs; done
ENGDIR=eng2 PROTO_PROFILE=wppm PROTO_WPPM=pair,axial node bench/shapesep2.mjs --data exact --out results/margins/exact-W4.json
node bench/margins.mjs W4=results/margins/exact-W4.json
xargs -P 3 -L 1 ./runxs.sh < jobs-xs.txt; (cd ../../A && node xconf.mjs --m wppm=results/xs-wppm,W4=../step2/h/results/xs-W4)
```
