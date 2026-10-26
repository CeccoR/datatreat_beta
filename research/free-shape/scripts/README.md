# Scripts behind FREE-SHAPE.md

Every number and figure in `../FREE-SHAPE.md` comes from these scripts, run in Node 22 on a
frozen copy of the engine at commit `bf228ee` (v521). They are research code: none of them
is loaded by the app, and nothing in the app was changed to run them.

The folders keep the layout of the work folder they ran in: each study imports the
harness as `../harness/`, and the harness finds its inputs two levels up. The results
(one JSON per run, about 75 MB in all) are not in the repository; `../tables/` holds the
summary tables the write-up quotes.

| Folder | Study | Main entry points |
|---|---|---|
| `harness/` | the harness: cases, the instrumented engine, the baseline, the truth reference | `make-eng.mjs`, `run.mjs`, `batch.mjs`, `table.mjs`, `ends.mjs`, `fig.mjs`, `svg2png.mjs`; `README.md` documents the API |
| `starts/` | widths-screened starts | `batch.mjs`, `methods/ws-core.mjs` (round 1), `methods/ws-core-r3.mjs` (rounds 2–4), `methods/v-*.mjs`, `methods/r3-*.mjs`, `tools/*.mjs` |
| `optimizer/` | the least-squares step: forward differences, halving, Broyden, member Jacobian; the barrier test | `make-opt.mjs`, `variants.mjs`, `methods/opt.mjs`, `methods/uniq.mjs`, `pbatch.mjs`, `run-all.sh`, `cmp.mjs` |
| `uniqueness/` | minima merged by resolution, bootstrap, jackknife, profiles, nulls, verdicts | `ubatch.mjs`, `methods/uniq-core.mjs`, `methods/u-*.mjs`, `score.mjs`, `verdicts.mjs`, `boot*.mjs`, `null.mjs`, `jackan.mjs`, `fig-*.mjs` |
| `presentation/` | one result: intervals, cross-class runs, background degree, cards | `eval.mjs`, `approaches.mjs`, `oneresult.mjs`, `cards.mjs`, `refit.mjs`, `sys.mjs`, `pbatch.mjs`, `fig-*.mjs` |
| `writer/` | the write-up's own analyses (results only, no pattern evaluated) | `common.mjs`, `cross.mjs`, `ends-check.mjs`, `fig-synthesis.mjs` |

## Setting up a work folder

```sh
R=/path/to/datatreat_beta                  # this repository
W=/path/to/work                            # any empty folder
mkdir -p $W/fs/engine $W/wf-xrd/rv-busy $W/e2e/xrd
git -C $R archive bf228ee | tar -x -C $W/fs/engine          # the frozen engine (read-only)
cp -r $R/research/free-shape/scripts/. $W/fs/
cp $R/tests/fixtures/SrTiO3.cif $W/wf-xrd/rv-busy/          # the phase every case refines
cd $W/fs/harness && node make-eng.mjs                       # eng/ and eng.diff: counters and logs only
mkdir -p $W/fs/optimizer/h/eng && cp $W/fs/harness/eng/*.js $W/fs/optimizer/h/eng/
cd $W/fs/optimizer && node make-opt.mjs                     # h/eng/xrd-rietveld.js: the solver options
```

- Only the two fixture controls (`fx-s00`, `fx-s05`) read `$W/e2e/xrd/s00.xrdml`,
  `s05.xrdml` and `s11.xrdml` (s11 refined as their standard). `xrdml(k)` of
  `tests/fixtures.mjs` writes them (`fs.writeFileSync(..., xrdml(k))`); the files used here
  came from an earlier draw: same header and lines, another noise.
- `harness/data/irf.json` caches the LaB6 standard the samples are drawn with (refined to
  χ²_ν 1.000 from a drawn pattern); delete it to redraw and refine it (about 3 s).
- Commands below run from the folder named, with `node` = Node 22. Batches run one
  process per run under `nice -n 15`, at most 2 at a time, and resume where they stopped.

**Check.** From this copy, on 2026-10-26: `cd harness && node run.mjs --case box-plate110
--seed 1 --method methods/baseline.mjs` gives 4225 evaluations and χ² 5458.6, as the
baseline batch; `--method ../starts/methods/r3-a4.mjs` 1799; from `optimizer/h`,
`--method ../methods/v-c1.mjs` 1383. Evaluations are deterministic; wall times are not.

## Reproducing each part

**Baseline** (`harness/`, 23 min at 2 processes):
`node batch.mjs --tag baseline --method methods/baseline.mjs,methods/truth.mjs`, then
`node table.mjs --tag baseline`, `node ends.mjs --tag baseline`, `node fig.mjs --tag baseline`
(`results/baseline/fig-cases.svg`; `node svg2png.mjs in.svg out.png` renders any SVG with
Playwright's Chromium).

**Starts** (`starts/`; methods made by `methods/mk.sh name '{options}'`):
- `node batch.mjs --tag screen --method methods/v-screen.mjs` (screen only, 110 runs);
- `node batch.mjs --tag r1 --seeds 1 --method methods/v-ws6.mjs,methods/v-ws4.mjs,methods/v-ws3.mjs,methods/v-ws2.mjs,methods/v-ws6s.mjs,methods/v-wsfam.mjs,methods/v-wsbud.mjs,methods/v-ws4l.mjs,methods/v-ws4b5.mjs,methods/v-ws4dd.mjs,methods/v-ws4rej.mjs,methods/v-ws4hs.mjs` (46 runs);
- `node batch.mjs --tag r2b --method methods/r3-a3.mjs,methods/r3-c6.mjs,methods/r3-cfam.mjs` (110 runs);
- `node batch.mjs --tag r3 --seeds 1 --method methods/r3-a3.mjs,../harness/methods/baseline.mjs,methods/r3-curv4.mjs,methods/r3-c6hf.mjs,methods/r3-a4.mjs`;
- `node batch.mjs --tag r4 --seeds 2,3 --method methods/r3-a4.mjs` (the other 64 runs);
- tables: `node tools/compare.mjs --tags r3,r4,r2b`, `node tools/stages.mjs --tags ...`,
  `node tools/coverage.mjs --tags ...`; figures: `node tools/fig.mjs cost|scatter ...`
  (usage in each file's header).

**Optimiser** (`optimizer/`): `run-all.sh` lists every run, table and figure in order
(about 6 h at 2 processes): the Jacobian check, 23 pilot variants (18 runs each), 4 on the
robust set (27 runs), `fwd`, `c1`, `c4` on all 110 runs, the barrier analysis after c1
(`methods/u-c1.mjs`), paired wall times (`timing.sh`), `bench.sh`, then `cmp.mjs`,
`stages.mjs`, `acc.mjs`, `tsum.mjs`, `uniq-sum.mjs` and the `fig-*.mjs`.

**Uniqueness** (`uniqueness/`):
- `node ubatch.mjs --tag main --method methods/u-main.mjs` (110 runs: the app's search, then the analysis; 50 min);
- `UJACK_FROM=main node ubatch.mjs --tag jack --method methods/u-jack.mjs --list lists/jack-list.txt`;
- `UBOOT_FROM=main UBOOT_R=20 UBOOT_RJ=10 node ubatch.mjs --tag boot --method methods/u-boot.mjs --list lists/boot-list.txt` (33 runs, 3854 s of computation);
- `node ubatch.mjs --tag null --method ../harness/methods/baseline.mjs --cases iso-7,iso-20 --seeds 4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23`;
- analyses: `node score.mjs main --ref baseline --angTol 10 --out score10` (and 15),
  `node verdicts.mjs score10 condD`, `node card.mjs main <runs> --md ...`, `node boot.mjs boot`,
  `node bootflip.mjs boot 8`, `node bootcal.mjs boot`, `node null.mjs null`, `node jackan.mjs jack`,
  `node fisher.mjs main`, `node fishercheck.mjs`, `node obs.mjs`, `node obsan.mjs main`,
  `node classes2.mjs 8`, `node costs.mjs main`, `node plaus.mjs`; figures `fig-*.mjs`.

**Presentation** (`presentation/`; reads the baseline and `uniqueness/results/main`):
- `node pbatch.mjs --tag xclass --method methods/xc.mjs --list jobs-xclass.txt` (the app's
  search as each of the other five solids, 220 runs, seed 1);
- `sh run-refit.sh` (the kept solid refined again at background degree 6, 12, 18; 126 refits);
- `node sys.mjs --set sample` and `--set synth`, `node eval.mjs --set synth` and `--set sample`,
  `node cards.mjs --set synth --sys --misfit` (and sample), `node invariants.mjs`,
  `node seeds.mjs`, `node classes.mjs`, `node classcal.mjs`; figures `fig-cover.mjs`,
  `fig-forest.mjs`, `fig-invariants.mjs`, `fig-mock.mjs`.

**The write-up's own tables and figure** (`writer/`; they read the other folders' results
and evaluate no pattern, about 4 s in all):
- `node common.mjs $W/fs --md common.md --json common.json`: every full-set search on one
  χ² reference (`../tables/common-reference.md`);
- `node cross.mjs $W/fs --md cross.md --json cross.json`: the presentation and uniqueness
  rules scored alike, and the recommended merged rule (`../tables/rules-scored-alike.md`);
- `node ends-check.mjs $W/fs --md ends-check.md`: the recommended interval built from the
  ends of the cheaper searches (`../tables/ends-from-cheaper-searches.md`);
- `node fig-synthesis.mjs . synthesis.svg` (`../fig/synthesis.svg`).
