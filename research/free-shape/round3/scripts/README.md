# Round 3's scripts

They ran in `$W/fs2/r3/` beside round 2's shared `$W/fs2/` folders (`harness/`, `gen/`, `phases/`); `$W` is the
work folder (the session's scratchpad). Every run is deterministic, at nice 15, at most three processes, a
timeout each, resumable.

**Setup.** `$W/r3-app`: a copy of round 2's app copy with the frozen patch (`$W/step6-app`) with round 3's changes;
`$W/r3-gitbase`: the branch's HEAD exported (`git archive`, the main tree untouched) and committed in its own
repository, the patch's base. `$W/fs2/r3/h/`: the harness on round 3's engine (`h/lib.mjs` and `h/data/` are round
2's step-6 copies; `node h/make-eng.mjs $W/r3-app` after every engine edit); `$W/fs2/r3/h2/`: the same harness
on round 2's frozen engine (`$W/fs2/step6/h/eng`, its hashes checked against `FROZEN-r2.json`, a copy of round 2's
`FROZEN.json`).

- `make-design3.mjs` (run in `$W/fs2/r3/design/`): the design (`../DESIGN.md`); `check-frames.mjs [design.json]`:
  every row through the generator's `normRow`, the frames against the held route.
- `batch3.mjs <jobs> [--validation] [--timeout s]`: one run a job line `<tag> <row> <p|q> <K=V,...|->`, `p` round
  3's engine (`h/run.mjs`), `q` round 2's (`h2/run.mjs`), both with the method `p3` then `truth` (the solid refined
  from the truth: the reach's reference). K=V: `MIN_SET`, `ANGLE_SET`, `TARGET_SET`, `KEEP_SET`, `CHECK_SET`
  (tunables, `;` for `,`), `PROTO_FILL` (random starts), `FIT_STARTS`, `FIT_FULL` (the dense reference). A
  validation row is refused unless `--validation` is given and `FROZEN3.json` exists; `h/run.mjs` then checks
  its engine copy against `FROZEN3.json`, `h2/run.mjs` against `FROZEN-r2.json`.
- `h/run.mjs`, `h/make-eng.mjs`, `h/methods/p3.mjs`: round 2's step-6 harness with `ANGLE_SET`, `TARGET_SET`, the
  fit settings, the stage's and the targeted starts' records, and the freeze gate.
- `lib3.mjs`: round 2's `lib6.mjs` on round 3's design (readers, the intervals, reach, accuracy).
- `ang3.mjs --tags S0 [--sub screen] [--rows] [--check]`: point 1 offline, every radius rule over a grid from the
  recorded profiles; `--check` the engine's radius against the offline reading. `ang3b.mjs`: the clean axes'
  error over each reading, the profile's trials.
- `comp3.mjs --ref DR --base S0 --tags TL,TF,RF`: point 5, completeness and reach against the dense reference.
- `score3.mjs --part tuning|validation --p P --q Q [--sub screen|new] [--rows]`: round 3 against round 2's frozen
  prototype (outcome, reach, accuracy, cost, the two errors with the engine's own intervals, uniqueness, the
  check, the jackknife by error kind, the keep test, the cap). `cmp3.mjs <tagA> <tagB> [rows]`: two records side
  by side.
- `mkpatch.sh`: `../proto/engine.patch` and `../proto/round3-only.diff`.
- `freeze3.mjs`: `FROZEN3.json` (the engine copy's hashes and the tunables as read).
- Job files: `jobs-T0.txt` (the first check), `jobs-S.txt` (screening: S0, DR, TL, TF, RF, CP), `jobs-F.txt`
  (verification), `jobs-C.txt` (confirmation: P, Q), `jobs-X.txt` (the cap's loss), `jobs-V.txt` (validation:
  VP, VQ).

```sh
cd $W/fs2/r3/design && node make-design3.mjs && node check-frames.mjs
cd $W/fs2/r3 && node batch3.mjs jobs-S.txt                       # screening
node ang3.mjs --tags S0 --sub screen --rows; node ang3b.mjs --tags S0 --sub screen; node comp3.mjs --rows
node batch3.mjs jobs-C.txt && node batch3.mjs jobs-X.txt         # confirmation
node score3.mjs --part tuning --p P --q Q,S0 --rows; node ang3.mjs --tags P --check
node freeze3.mjs                                                 # after lint and tests
node batch3.mjs jobs-V.txt --validation                          # once
node score3.mjs --part validation --p VP --q VQ --rows
```

Not in the repository: the records (`$W/fs2/r3/results/`), `design.json`, the engine copies, the app copies.
