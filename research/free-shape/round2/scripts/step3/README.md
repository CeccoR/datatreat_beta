# Step 3's scripts (`../../STEP3.md`)

The per-line check and the jackknife over lines, on the exact line with search v2 (the prototype's
defaults after step 2). They ran in `$W/fs2/step3/h/` and `$W/fs2/step3/hp/` beside the shared `fs2/`
folders (`setup.sh <repository>`, run from `$W/fs2/step3` after copying `h/` and `hp/` there, makes
both and the two app copies). Every run is deterministic; validation rows are refused by `batch2.mjs`
(step 2's: at most 3 processes, nice 15, a timeout each, resumable).

- **`h/`: the measurements, on step 2's engine** (`$W/step2-app`, the C1 runs). `methods/check.mjs`
  runs today's search and report (the pilot's `methods/today.mjs`, unchanged; the records equal step
  2's W4 on 77 of 77, `ident3.mjs`) and then, at the fit returned, with the refine log off and the
  state restored: (1) the segments (`ck.mjs segments`: one per line or group of overlapping lines)
  and their sums, the global χ² and Durbin–Watson, the residuals dumped (`<row>.res.json`); (2) on a
  kept shape the jackknife over lines (at most `CK_GMAX` = 20 contiguous groups, each weighted 0 and
  the fit refined from itself, 4 iterations then up to 8 more: the solid after 4 and after 12);
  (3) the refits without the k most significant segments (k in `CK_KS` = 1, 2, 3, 5: the shape from
  the kept fit, the isotropic fit from its own). `an3.mjs` computes the statistics from the records
  and dumps (`load`), `rep-flag.mjs` the detection tables, `rep-jack.mjs` the jackknife's coverage
  and cost (`FLAG`, `ZSEG`), `rep-fix.mjs` the remedies from the top-k refits, `aniso.mjs` the
  anisotropy's jackknife spread.
- **`hp/`: the prototype** (`$W/step3-app`, `SHAPE_CHECK` in `xrd-rietveld.js`). `methods/proto.mjs`
  runs the search and the report with the engine's defaults and keeps the report whole (`misfit`,
  `jackLo`, `jackHi`, `jackTurn`) and the check; with `CK_MEASURE` (on) it refits a flagged kept fit
  without all its flagged segments and without the worst third; `CK_RETEST=1` sets
  `SHAPE_CHECK.retest`, `CK_OFF=1` clears `SHAPE_CHECK.on`. `cmpP.mjs` compares with `h/` (the search,
  the flag, the flagged segments, the jackknife, its cost), `rep-fixP.mjs` scores the remedies and the
  report's coverage, `verify.mjs` the retest and the final engine.

```sh
cd $W/fs2/step3/h
node batch2.mjs jobs-C1.txt                                # 77 runs, ≈ 17 min
node ident3.mjs results/C1 ../../step2/h/results/W4        # 77 identical
node rep-flag.mjs --rows                                   # ../../tables/step3-flag.md
node rep-jack.mjs --rows                                   # ../../tables/step3-jack.md
node rep-fix.mjs --rows; node aniso.mjs
cd ../hp
node batch2.mjs jobs-P1.txt                                # 77 runs, ≈ 18 min
node cmpP.mjs                                              # 77 / 77 / 77; jackknife 26 of 26
node rep-fixP.mjs --rows                                   # ../../tables/step3-fix.md
CK_RETEST=1 CK_MEASURE=0 node batch2.mjs jobs-P2.txt       # the 26 flagged kept fits, retest on
node batch2.mjs jobs-F1.txt; CK_OFF=1 CK_MEASURE=0 node batch2.mjs jobs-F0.txt
node verify.mjs                                            # 26 of 26; 3 of 3; 2 of 2
```

Not in the repository: the records (`h/results/C1`, 15 MB with the dumps; `hp/results/P1`, `P2`,
`F1`, `F0`), the engine copies (`h/eng`, `hp/eng`) and the app copies.
