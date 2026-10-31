# Step 4's scripts (`../../STEP4.md`)

The minima stage, the two errors per parameter, the threshold Δ* and the directions as sets, on the
prototype (`../../proto/engine.patch`, `SHAPE_MINIMA`) at its defaults. They ran in `$W/fs2/step4/h/`
beside the shared `fs2/` folders (`setup.sh <repository>`, run from `$W/fs2/step4` with this folder's
files copied into `h/`, makes it and the app copy). Every run is deterministic; validation rows are
refused by `batch2.mjs` (step 3's: at most 3 processes, nice 15, a timeout each, resumable; a ninth
column of a job line sets the job's environment: `CK_METHOD`, `MIN_OFF`, `MIN_SET` with `;` between
its pairs, `FIT_STARTS`, `FIT_FULL`, `PROTO_TURNSEED`, `BOOT_*`).

- `make-eng.mjs`: step 3's, with `FS.min` (the stage's evaluations and wall time) and
  `PROTO_TURNSEED` (the main random stream's seed: the starts' small tilts; with the stage off also
  the polish's and the refit's turns).
- `run.mjs`: step 3's, with the methods `min` and `boot`; a record keeps `min`, `settings`, `boot`.
- `methods/min.mjs`: the search and the card's report (bodyShapeOf), the report kept whole (the
  local errors, the second errors, `lo`–`hi`, `radius`, `sets`, `minima`); `MIN_OFF=1` the stage off,
  `MIN_SET='max=24,collect=60'` its tunables, `FIT_STARTS`, `FIT_FULL` the search's (the dense
  reference).
- `methods/boot.mjs`: the parametric bootstrap: up to `BOOT_M` (4) minima within `BOOT_KEEP` (30)
  refitted on `BOOT_R` (16) Poisson draws of the lowest minimum's pattern (F) and of the generator's
  own counts (T), and on both without noise; `BOOT_ALL=1` a single minimum too.
- `score4.mjs`: the stage, the changes against step 3's P1, accuracy, the coverage and width of the
  local error (L), the second (B), both (C), the union (U), with the jackknife (J), the local z, the
  uniqueness verdicts (`--delta`, `--deltaF` for flagged rows, `--kappa`, `--kappaA`, `--rows`).
- `dirs4.mjs`: the directions, each axis alone and as sets, against the truth modulo the class.
- `comp4.mjs`: completeness against the dense reference; `turn4.mjs`: the random stream
  (`TAGS=S2,U1,U2`); `bootan.mjs`: Δ* (round 1's model and the rule fitted on the data's Δ);
  `esdboot.mjs`: the local error against the replicas; `show.mjs`: one record's stage, minima and
  report; `diag-esd.mjs`: step 3's esds against the truth.
- `jobs-step4.txt`: S2 (77), U1 and U2 (12 each), DR2 (18), BT2 (68), F0 and F1 (5).
- `first/`: the job files of the first version's runs (S1, T1, T2) and of the settle variants (V*, K*),
  made on intermediate engines (`../../STEP4.md` §3: the search's random polish kept, 3 rounds, one
  turn direction); the final patch does not reproduce them.

```sh
cd $W/fs2/step4/h
node batch2.mjs jobs-step4.txt                                       # 192 runs, ≈ 75 min
node score4.mjs --tag S2 --delta 16 --deltaF 25 --kappa 1.2 --rows   # ../../tables/step4-errors.md
node score4.mjs --tag S2 --delta 16 --deltaF 25 --kappa 1
node dirs4.mjs --tag S2 --rows                                       # ../../tables/step4-dirs.md
node comp4.mjs --ref DR2 --tag S2 --delta 16                         # ../../tables/step4-minima.md
TAGS=S2,U1,U2 node turn4.mjs
node bootan.mjs --tag BT2; node esdboot.mjs --tag BT2 --ref S2       # ../../tables/step4-delta.md
```

Not in the repository: the records (`h/results/`), the engine copy (`h/eng`) and the app copies.
