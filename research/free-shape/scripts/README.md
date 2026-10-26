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
and evaluate no pattern, a few seconds each):
- `node common.mjs $W/fs --md common.md --json common.json`: every full-set search on one
  χ² reference (`../tables/common-reference.md`);
- `node ends-check.mjs $W/fs --tau 12.5 --md ends-check.md`: the recommended interval built
  from the ends of the cheaper searches (`../tables/ends-from-cheaper-searches.md`);
- `cross.mjs`, `cards.mjs` and `fig-synthesis.mjs` run in the analysis roots of `fix/`
  (below).

## The review (`fix/`, 2026-10-26)

A review of the first write-up found 15 problems. The fixes are in this folder and in four
corrected study scripts:
- `uniqueness/score.mjs` and `presentation/approaches.mjs`: a spheroid's or a cylinder's
  diameter now carries the esd the app's card shows (the reported fit's D·σ(ln W), with
  the held/free difference in quadrature); it had been left at zero width in the first and
  open in the second;
- `presentation/eval.mjs`: E_L(12.5) beside E_L(2…10);
- `writer/cross.mjs`: claims scored against their own stated intervals too; an unbounded
  estimate keeps its interval under the jackknife (it had been given a lower limit of 0);
  `--flag6` forces the jackknife on named runs; `--only` selects runs by prefix;
- `writer/cards.mjs` (new): the result card written from the records, with a check
  against the truth; `writer/fig-synthesis.mjs`: the three-panel summary figure.

**Analysis roots.** The scoring scripts expect a root with `harness/`, `uniqueness/`,
`presentation/` and `writer/`. `fix/fixed` rescores the studies' own results: make it with
`harness` a symlink to `../../harness`, `uniqueness/results/{main,jack}` symlinks to the
study's, `presentation/results/{xclass,refit,sys-synth.json,sys-sample.json}` symlinks to the
study's, then `sh fix/sync.sh`. `fix/root6`, `fix/root12` and `fix/root18` hold the
review's runs; `sh fix/setup.sh` makes them (copies of the harness with the background degree
taken from `FS_BG`, the cases of `fix/cases-extra.mjs` added, and two misfits in
`patternOf`: `air` and `mix`).

**Runs** (`sh fix/gen-jobs.sh`, then `xargs -P 2 -d '\n' -n 1 sh -c < fix/jobs.txt`, then
`sh fix/queue2.sh`; about 2 h at 2 processes on this machine; each line a run of
`fix/run1.sh`, which runs `fix/u-pipe.mjs`: the app's search, its report, the best free fit,
the misfit flag and the jackknife):
- the 12 proxies with a degree-18 background (`root18`);
- the 12 fresh proxies v01–v12 at degree 6 (`root6`) and at degree 18 (`root18`);
- the 8 misfit runs (four plates × air, mix) at degree 6, then at the BIC-picked degree
  where it is above 6 (`queue2.sh`; it picked 6 on all 8, so none ran);
- refits of the kept solid at degrees 6, 12 and 18 (`presentation/refit.mjs` in `root6`) for
  the fresh proxies and the misfit runs;
- the bootstrap under misfit (`fix/u-bootmis.mjs`, 12 generator replicas a proxy);
- 46 fresh isotropic nulls (seeds 24–46);
- the synthetic hold-out, seeds 4 and 5 of the 30 synthetic cases (seed 6 was dropped for
  time: `fix/skip-6`).

**Scoring** (results only): in each root, `node uniqueness/score.mjs main --angTol 10 --out
score10`, `node presentation/eval.mjs --set synth|sample`, then `node writer/cross.mjs <root>`
(with `--sets`, `--only`, `--flag6`), `node writer/cards.mjs <root> --tau 12.5 case#seed …`.
Tools (`fix/tools/`): `pipe-sum.mjs` (the pipeline at the picked degree, run by run),
`bootmis-sum.mjs`, `null-hold.mjs`, `holdout.mjs`, `merge-ends.mjs` (164 against 24–41),
`misc.mjs` (normal error by lattice, far plausible minima by solid, the one-size check,
class ranks), `fwdsame.mjs` and `proxacc.mjs` (adapted from the review's own tools),
`pick-list.mjs` (used by `queue2.sh`). Figure: `node writer/fig-synthesis.mjs
writer/common.json fix/fixed/writer/cross.json pipe-u.json pipe-v.json synthesis.svg`.
