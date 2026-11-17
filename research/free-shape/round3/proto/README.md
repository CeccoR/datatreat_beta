# Round 3 prototype

Round 2's frozen prototype (`../../round2/proto/`, `../../round2/CONFIRM.md` §9) with three parts added, each
behind its own switch and named tunables, round 2's behaviour given back by the switches below. Not applied:
the branch is unchanged. `$W` is the work folder (the session's scratchpad), not in the repository.

## Files

- `engine.patch`: `git diff` of the whole prototype (round 2's parts and round 3's) against the branch's
  engine files (unchanged since `9782d33`): `xrd-rietveld.js`, `xrd-broad.js`, `xrd-sizeline.js` (new), `sw.js`,
  `RIETVELD.md`. It replaces round 2's patch: `git apply research/free-shape/round3/proto/engine.patch`.
- `round3-only.diff`: round 3's changes alone, `xrd-rietveld.js` and `RIETVELD.md` against round 2's frozen
  engine (`diff -u`), for reading.
- `../scripts/mkpatch.sh` makes both from `$W/r3-app` (the app copy with the prototype) and `$W/r3-gitbase`
  (the branch's HEAD exported, `git archive`).

## The parts (`xrd-rietveld.js`)

| part | tunables (default; round 2's) | what |
|---|---|---|
| the axes' radius | `SHAPE_ANGLE` { `rule` 'profile' ('r2'), `t` 5.99, `kappa` 1, `each` false, `record` false, `dMax` 40 } | 'profile': each turn's profile (`turnProfiles`, turnEsds's own refinement at each turn, on the steps 1, 1.5, 2, 3, 4, 6, 8, 12, 16, 24, 32, 45, 60°) read where χ² rises by t·χ²_ν (`turnRead`; the larger side), an axis's radius the larger reading of the turns that tilt it, a held fit's at least 2·freeOff, then with the minima's betweenDeg and, where the check fired, the jackknife's turn. 'curv': the covariance's σ of each turn × kappa·√5.99 instead. `each`: the hull over the minima within Δ* of each minimum's angle plus its own reading. `record`: the profiles' points and the covariance's σ (the report's `minima.angle`, a study's). `esdAngle` is round 2's (read on the default steps from the same points). |
| the stage's cap | `SHAPE_MINIMA.capEvals` 6000 (Infinity), `.capCands` Infinity (Infinity; 3 was screened and dropped) | where the per-line check of the fit before the stage fired (the keep test's), at most capCands candidates, and no candidate or round of turns begun once the stage has spent capEvals pattern evaluations (`EVAL_COUNT`). `info.minimaStage` gains `left` (distinct candidates beyond the limit, counted up to 12), `skipped`, `capped`, `explored`, `evals`, `flagged`; the report's `minima.explored`. |
| targeted starts | `SHAPE_TARGET` { `lines` 2 (0), `frames` 0, `framesFull` 2 } | `lines`: `lineBroadening` (the isotropic fit's residual on each segment of the per-line check projected on the derivative in Ys) gives each line's extra width; a plate on the normals of the `lines` most broadened (z > 2), a needle on those of the `lines` least broadened (z < −2), a family among the low-index starts skipped. `frames`: the lowest distinct ends' frames with their widths relabelled, refined briefly, the framesFull best in full, before the stage. `info.target` records them; the ends' kinds carry `-line` / `-frame`. |

Also: `EVAL_COUNT` (a counter of pattern evaluations, `phasePattern`), `minimaSigmas` returns each turn's σ
(`t`), `SHAPE_ANGLE` and `SHAPE_TARGET` are exported. Nothing else in the engine changes.

## Verification

The harness is round 2's step-6 harness (`../scripts/`: `h/run.mjs`, `h/make-eng.mjs`, `h/methods/p3.mjs`),
on an engine copy made by `make-eng.mjs` from `$W/r3-app`; `h2/` runs round 2's frozen engine (its copy checked
against round 2's `FROZEN.json` hashes). Every run deterministic, nice 15, three at a time.

1. **Round 2's switches give round 2 to the bit.** `SHAPE_ANGLE.rule 'r2'`, `capCands` and `capEvals` off,
   `lines` 0 (F0, box-P-1-near-a) against round 2's frozen engine (T0r2): the isotropic fit (1672 evaluations,
   χ² 39 761.148), the search's 5798 and the stage's 2312 evaluations, χ² 16 008.228, the dimensions, the
   report's 2025 evaluations, esdAngle, radius and lo–hi, all equal. With `record` on (T0rec, S0) the search and
   every reported number are equal too; the report adds `minima.angle` and costs 2.0× (the profiles followed
   to Δχ²/χ²_ν 40).
2. **Each part alone.** The screening's defaults (F1: t 9, capCands 3) on box-Pm-3-near-a equal TL's search to the bit (χ² 10 081.515, 3859
   evaluations): the cap does not fire there; the radius alone changes (principal axis 0.51° → 2.29°), the
   report 809 → 1797 evaluations. On ellipsoid-Pmmm-generic-a (flagged) the defaults equal the cap's screening
   variant's stage (capped: 3 candidates, 4 left) with the lines' starts added: χ² 26 270.619 as uncapped, the
   stage 17 237 → 8316 evaluations.
3. **The confirmation's records** (`../CONFIRM.md`): the engine's `radius` equals `ang3.mjs`'s offline
   profile reading at t 9 on 260 of 260 kept truths with a record (`--check`).
4. **The frozen defaults** (F2: t 5.99, capEvals alone) on box-Pm-3m-on-a equal PY (the evaluation cap alone) and
   on ellcyl-P-3m1-generic-a PX (uncapped; its stage under 6000) to the bit: χ², the search's and the stage's
   evaluations; the radius equals the offline reading at t 5.99 on both.
5. **Lint and tests** on `$W/r3-app` at the freeze: `npm run lint` clean; the engine's tests (rietveld, rvmodel,
   rvpool, rvsplit, rvlock, rvcif, rvui, smoke, widths, modules) 53 of 53 pass. No test asks for a free shape.
