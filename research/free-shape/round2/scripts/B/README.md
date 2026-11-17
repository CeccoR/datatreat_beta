# Track B: the search's efficiency (round 2)

Today's search (`freeShapeRun`, b9bef5f) made cheaper without changing what it finds: no
covariance in intermediate refinements, forward differences with one central pass on the
returned fit, held frames de-duplicated by the canonical form, starts cut by symmetry, and full
refinements only from distinct brief ends. Today's model (the engine's Lorentzian), exact lines,
the pilot's cells and grid. Paths are relative to this folder,
`$W/fs2/B`.
Node 22: `/opt/node22/bin/node`. Nothing in `../gen`, `../phases`, `../harness`, `../design`,
`../pilot` is changed.

**In the repository** (`research/free-shape/round2/scripts/B/`): the scripts only. The write-up is
`../../AB.md`. `h/eng/` is rebuilt by `node make-eng.mjs`; `h/lib.mjs` is the harness's `lib.mjs`
with `FS2` two levels up (kept here). `hp/` (the profile's engine) is `h/` with
`hp/eng-prof.diff` applied: `cp -r h/eng hp/eng && patch hp/eng/xrd-rietveld.js hp/eng-prof.diff`
(run from this folder). `results/*.txt` are the row lists the commands below read; the run records
(`results/<tag>/`, 9 MB) stay in the work folder, and the score tables quoted in AB.md are in
`../../tables/` as `B-*.md`. `verify/` holds the skeptic's checks (`indep.mjs`, `iters.mjs`,
`cmp-symAs.mjs`, and symAs: `run2.mjs`, `var2.mjs`, `variants2.mjs`); they ran from
`$W/fs2/B-verify`: `cp -r verify $W/fs2/B-verify` before running them.

## Files

- `make-eng.mjs`: `h/eng/` = `../harness/eng` (b9bef5f, counters only) with opt-in solver options
  read from `refine()`'s `opts.x`: `noCov`, `covOnly`, `fwd` (`eng.diff`). Without `opts.x`
  the arithmetic is today's.
- `h/lib.mjs`: the harness's `lib.mjs` on `h/eng`, the paths moved (3 lines differ).
- `methods/var.mjs`: `freeShapeRun` for the bodies copied, with the knobs (its header lists
  them); `make({})` is today's search evaluation for evaluation. One seeded stream feeds the
  random fill and then the random turns before each polish and the refit. The start modes
  `distinct` (symA) and `fz` (symC) draw today's fill from it all the same, thrown away (`fz`
  takes its candidates from a copy), so their turns are today's and they differ from fwdH by
  their starts alone. Their first versions shifted the stream (the skeptic's finding); they are
  kept as `distinctShift` and `fzShift` (variants symA0, symC0, cuts0) to reproduce the records
  of tags sub2s, sym25, full and fullsub.
- `methods/variants.mjs`: the variants by name.
- `run.mjs`: one design row drawn (exact lines) and refined; the methods run in turn from one
  isotropic fit, in one process. No report (`bodyShapeOf`).
- `batch.mjs`: rows in parallel (at most 2, nice 15), resumable, validation rows refused.
- `subscreen.txt`, `make-subscreen.mjs`: the 22-row sub-screen and its rule.
- `check-replica.mjs`: the replica against the pilot's records (every refinement's
  evaluations and χ²). `check-legacy.mjs`: the legacy start modes against the first records.
- `cmp-sym.mjs`: symA, symC or cuts of tag symfix against their first versions and fwd/fwdH*,
  run by run (evaluations, outcome, best χ², the stages after the full refinements; symA
  against B-verify's symAs, which it should equal).
- `score.mjs`: reach against the best known, outcome and solid against today's, the reported
  fit's χ² against today's, accuracy, evaluations and wall time, per class, per stage, the
  central pass. `--supersede` keeps a re-run method's earlier records as `<name>0`.
- `prof.mjs` with `hp/` (= `h/` with a timer around `phasePattern` and a flag inside the
  Jacobians, no arithmetic change): where the search's wall time goes.
- `stages.mjs`, `helddup.mjs`, `helddup2.mjs`, `briefdup.mjs`, `briefdup2.mjs`,
  `randstarts.mjs`, `axes.mjs`, `heldcls.mjs` (repeated held frames per class): readings of the pilot's records and the phases that set the
  variants up (where the evaluations go, repeated held frames, duplicate brief ends among the
  full refinements' starts, what the random starts reach, the low-index axes per class).

## Commands

```sh
node make-eng.mjs; node make-subscreen.mjs
node batch.mjs --tag sub1 --rows sub --method today,nocov,fwd
node batch.mjs --tag sub2 --rows sub --method fwdH,fullDrop,fullRep
node batch.mjs --tag sub2s --rows <the 10 rows of -3m, 6/m, 6/mmm, m-3, m-3m> --method symA,symC
node batch.mjs --tag full --rows <the 55 screening rows not in the sub-screen> --method fwd,cuts
node batch.mjs --tag fullsub --rows sub --method cuts
node batch.mjs --tag sym25 --rows $(cat results/sym25.txt) --method symA     # symA on its classes' other 25 rows
node batch.mjs --tag held30 --rows $(cat results/held30.txt) --method fwdH   # fwdH on the other classes' other 30 rows
# after the random-stream fix: symA, symC, cuts again where the fill exists (the 35 rows of
# -3m, 6/m, 6/mmm, m-3, m-3m; elsewhere nothing is drawn and the first records stand)
node batch.mjs --tag symfix --rows $(cat results/symfix10.txt) --method symA,symC,cuts
node batch.mjs --tag symfix --rows $(cat results/sym25.txt) --method symA,cuts
node batch.mjs --tag legacy --rows sqbox-Pm-3-on --method today,symA0,symC0,cuts0   # the old modes reproduce
node check-replica.mjs results/sub1 results/legacy; node check-legacy.mjs results/legacy
node cmp-sym.mjs --variant symA; node cmp-sym.mjs --variant symC; node cmp-sym.mjs --variant cuts
node heldcls.mjs
T=sub1,sub2,sub2s,full,fullsub,sym25,held30,symfix   # symfix last, with --supersede
node score.mjs --supersede --tags $T --rows sub --out results/sub-score.md --json results/sub-score.json \
  --variants pilot,today,nocov,fwd,fwdC,fwdH*,fwdH,fwdHC,fullDrop,fullDropC,fullRep,fullRepC,symA,symAC,symA0,symA0C,symC,symCC,symC0,symC0C,cuts,cutsC,cuts0,cuts0C
node score.mjs --supersede --tags $T --rows screen --compose 'best=symA,fwdH' --out results/screen-score.md --json results/screen-score.json \
  --variants pilot,fwd,fwdC,fwdH*,best,bestC,cuts,cutsC
node score.mjs --supersede --tags $T --rows <the 35 rows of -3m, 6/m, 6/mmm, m-3, m-3m> --variants pilot,fwd,fwdH*,symA,symAC,symA0,symA0C,cuts,cutsC,cuts0,cuts0C --out results/sym35-score.md --json results/sym35-score.json
node prof.mjs --rows box-Pm-3-near,ellcyl-P2m-generic --method today,fwd                # results/prof2.out
```

`best` is one configuration (forward differences, no intermediate covariance, the central pass,
held frames de-duplicated, the class's distinct starts only): run as `symA` in the five classes
whose starts it changes (tag symfix, after the random-stream fix), as `fwdH` in the six where it
changes none (there no fill is drawn, so the fix changes nothing). `fwdH*` is `fwd` less its
flagged duplicate held refinements (on 52 rows run both ways: 117 372 against 117 364
evaluations).

## Results (`results/<tag>/<row>.json`)

A run's record is the pilot's with, per method: `search` { evals, ms } and `var` (stages with
evaluations, iterations and χ²; starts; held duplicates; the covariance-only pass; the central
pass; `pre`, the fit before the central pass and its accuracy). `*-score.md` and `*-score.json`
are `score.mjs`'s tables.

## The random-stream fix (after the skeptic's check)

The first symA, symC and cuts runs (now symA0, symC0, cuts0) shifted the stream that turns the
fit before each polish and the refit, so their polish and refit differed from fwdH's for a
reason other than the starts. Fixed in `var.mjs` and re-run on the 35 rows of the five classes
with a fill (tag symfix, 15 min). Checks: `today` still equals the pilot and the legacy modes
reproduce the first records (sqbox-Pm-3-on, tag legacy: 1/1 and 3/3); symA equals B-verify's
symAs on its 14 rows; symC keeps the same fill starts (17 draws in -3m and 6/m, 215–229 in
6/mmm and cubic) and differs from symC0 by the turns alone. Scores are made with `--supersede`,
so the first records stay in the best known as symA0, symC0, cuts0.
