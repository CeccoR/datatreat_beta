# Step 6's scripts (`../../CONFIRM.md`, `../../VALIDATION.md`)

The confirmation of the prototype on the whole tuning part (154 runs) and the validation part's one scoring
(77 runs), each against today's search. They ran in `$W/fs2/step6/` beside the shared `fs2/` folders
(`setup.sh <repository>`, run from `$W/fs2/step6` with this folder's files copied in, `h/` and `h/methods/`
included, makes `$W/step6-app` and the harness's engine copy `h/eng`). Every run is deterministic, at nice 15,
at most three processes, a timeout each, resumable.

- `batch6.mjs <jobs> [--validation]`: one run a job line `<tag> <row> <p|t> <K=V,...|->`. `p` the prototype
  (`h/run.mjs`, methods `p6` then `truth`: the solid refined from the truth on the same line, the reach's
  reference); `t` today's search (`fs2/pilot/run.mjs` on the frozen `b9bef5f` engine, methods `today`, `truth`).
  The jobs file is read again whenever a slot frees. A validation row is refused unless `--validation` is given
  and `FROZEN.json` exists; `h/run.mjs` then also checks its engine copy against the hashes there.
- `h/run.mjs`: step 5's, with the method `p6` and the freeze gate. `h/make-eng.mjs`: step 5's, with three study
  switches inert when unset: `PROTO_FILL` (`SHAPE_FILL`), `PROTO_Y0F` (the starts' width floored at that
  fraction of the instrument's FWHM at the range's middle, in Y_s's units), `FS.min.rmax` (the most rounds of
  turns a minimum entered). `h/methods/p6.mjs`: the search and the card's report kept whole, the keep test's
  numbers, the family verdict, the check, the minima, the stage's cost and rounds; `MIN_SET`, `KEEP_SET`,
  `FAMILY_SET`, `CHECK_SET` set the tunables of a job.
- `lib6.mjs`: readers and the intervals (step 4's `score4.mjs` generalised; `E` the engine's own `lo`–`hi`).
- `score6.mjs --part tuning|validation --p <tags> --t <tags> [--sub screen|new] [--rows]`: the prototype against
  today: outcome, reach, accuracy, anisotropy, cost, the two errors, uniqueness, the check, the keep test.
- `sweep6.mjs`: Δ* and κ (and κ on the angles) over a grid. `variants6.mjs`: the variant jobs a tunable needs,
  chosen from the P records (rows a setting can change). `cmp6.mjs --v <tag>`: a variant against P row by row.
  `fam6.mjs --tag <tag>`: the family verdicts of 'general' runs.
- `freeze6.mjs`: writes `FROZEN.json` (the engine copy's hashes, the frozen tunables read from the engine).
- `frozen-md.mjs`: `FROZEN.json` as `../../tables/step6-frozen.md`.
- Job files: `jobs-Q.txt` (phase 1 as it ended: P, the variants SC, SY, MX, RD, SF2, FAM, the checks F1 and F2;
  its T lines were moved to `jobs-R.txt` at the freeze), `jobs-V.txt` (the variants `variants6.mjs` chose),
  `jobs-R.txt` (after the freeze: VP, the rest of T, VT, VFAM; run with `--validation`), `jobs-VAL.txt` (the
  validation jobs alone), `jobs-F.txt` and `jobs-C0.txt` (checks of the engine).

```sh
cd $W/fs2/step6
node batch6.mjs jobs-Q.txt                                   # phase 1 (P, variants, FAM; T in jobs-R)
node variants6.mjs > jobs-V.txt                              # the variant jobs, put first in the queue
node score6.mjs --part tuning --p P --best SC,SY,MX,RD,SF2 --rows   # ../../tables/step6-confirm.md
node sweep6.mjs; for v in SC SF2 SY MX RD; do node cmp6.mjs --v $v; done; node fam6.mjs --tag FAM --rows   # step6-tunables.md
node freeze6.mjs && node frozen-md.mjs ../../tables/step6-frozen.md   # after the edits, lint and tests
node batch6.mjs jobs-R.txt --validation                      # phase 2, once (and the rest of T)
node score6.mjs --part validation --p VP --t VT --rows       # ../../tables/step6-validation.md
node fam6.mjs --part validation --tag VFAM --ref VP --rows   # ../../tables/step6-family-val.md
```

Not in the repository: the records (`results/`), the engine copy and the app copies.
