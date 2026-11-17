# Free shape, round 3, point 5: completeness of the minima, targeted starts

Round 2 found 76 % of the true minima on clean rows against a dense reference (`../round2/STEP4.md` §4), and
three clean tuning truths ended 6.5–131 χ²_ν above their truth reference, of which four random starts
recovered two (`../round2/CONFIRM.md` §4). The minima stage refines the ends the search gives it; it cannot
refine a minimum no end falls into. Round 3 tried two kinds of targeted start against random fill and the
dense reference on the 66 screening truths of the new tuning part (`DESIGN.md`), and keeps one. All data are
synthetic; `$W` is the work folder, not in the repository.

## What was run

The engine is round 2's frozen prototype with round 3's switches (`proto/`); every run is deterministic, at
nice 15, three at a time (`scripts/batch3.mjs`). Each run is followed by its truth reference.

| tag | what | runs | search evaluations × S0 |
|---|---|---|---|
| S0 | round 2's search (the switches off; bit-identical to round 2's frozen engine, `proto/README.md`) | 66 | 1.00 |
| TL | `SHAPE_TARGET.lines` 2: a plate on the normals of the 2 most broadened lines, a needle on those of the 2 least broadened | 66 | **1.08** |
| TF | `SHAPE_TARGET.frames` 1, `framesFull` 2: the lowest end's frame with its widths relabelled (a box's five other orders, an elliptic cylinder's height on either side, a two-width body's widths swapped, a square box also turned 45°), refined briefly, the two best in full | 66 | 1.17 |
| RF | 4 random starts beside the class's (`SHAPE_FILL` 4, round 2's SC) | 66 | 1.10 |
| DR | the dense reference: 40 starts (30 random), 10 full refinements, the stage on up to 24 candidates within 60 χ²_ν (round 2's) | 66 | 3.16 |

**The lines' broadening** (`lineBroadening`): the isotropic fit's residual, on each of the per-line check's
segments whose strongest reflection carries at least half the segment's intensity, projected on the pattern's
derivative in the isotropic size Ys (two evaluations): δ, the segment's extra Ys, and its z. Most broadened:
the largest δ with z > 2; least: the smallest with z < −2; a lattice family already among the low-index
starts, or one taken already, is skipped. On the 66 rows the rule added 165 starts (2.5 a row), each one brief
refinement and, when among the best, a full one.

## Results

Reach: a run's lowest χ² within 1 χ²_ν of the best known (every record of the row, the truth references
included). True minima: the reference's minima within Δ* (16; 25 where the check fired) of the lowest χ² of
the reference and the variant; found when a variant minimum matches it within each other's local error
(`comp3.mjs`, `tables/screen-starts.md`).

| 66 screening truths | clean: true minima found | clean reached | error: found | error reached | lower than S0 by > 1 χ²_ν | higher |
|---|---|---|---|---|---|---|
| S0 (round 2's search) | 42/55 (76 %) | 30/33 | 47/67 | 28/33 | — | — |
| **TL, lines 2** | 42/53 | **31/33** | 50/67 | **29/33** | **3**: box-Pm-3-near-a (clean) 1293, box-P-3m1-near-a (texture 0.06) 25.3, ellcyl-P-3-on-a (texture 0.01) 4.6 | 0 |
| TF, frames 1 | 41/55 | 30/33 | 45/67 | 30/33 | 2: box-P-3m1-near-a 25.1, sqbox-P6m-near-a (impurity) 1.6 | 0 |
| RF, 4 random | 42/55 | 30/33 | 50/67 | 30/33 | 2: box-P-3m1-near-a 25.3, ellcyl-P-3-on-a 6.3 | 0 |
| DR, dense reference | — | 32/33 | — | 32/33 | 7 | 0 |

- **The lines' starts pay.** The clean truth box-Pm-3-near-a (3.2 × 15.3 × 60 nm, m−3) is round 2's failure
  in full: the search returns 3.0 × 59.9 × 37.6 nm (the thin axis right, the other two widths mixed),
  1293 χ²_ν above the truth reference and flagged by the per-line check (z 6.3) on a clean pattern; the dense
  reference ends 44 χ²_ν above the line starts' fit. TL's needle on the normal of (310), the least broadened line,
  refines to 3.17 × 15.36 × 58.96 nm at the truth reference's χ². On the other two rows the lowest minimum
  also comes from a line start (`from`: 'full-line'). No row ends higher. The cost is one brief trial a start
  and 1.08× the search's evaluations (1.10× its wall).
- **Relabelled frames and random starts pay less.** TF's two gains are one TL also makes and one at 1.6 χ²_ν
  on an impurity row, at 1.17×; RF's two are both TL's, at 1.10×. Neither reaches box-Pm-3-near-a. Both
  stay off (`frames` 0; `SHAPE_FILL` 0).
- **Completeness is unchanged.** The share of the reference's true minima found stays at 76–79 % on clean
  rows with any variant: the misses are second minima of poorly bounded long extents and relabellings (as in
  round 2, `../round2/STEP4.md` §4), which a start at a better place does not add. The lines' starts improve
  the reach (the lowest minimum), not the count of near-equivalent ones.
- **Still missed.** Two clean truths are reached only by the dense reference: sqbox-Pmmm-generic-a (2.5 χ²_ν)
  and ellcyl-P-3m1-near-a (4.2); one error row (ellcyl-P4m-near-a, air, 1.5). DR costs 3.2× the search.

## Decision

`SHAPE_TARGET.lines` = 2 is on by default; `frames` 0 and `SHAPE_FILL` 0. The confirmation on the whole
tuning part (`CONFIRM.md`) reads its reach against round 2's search on the 231 rows outside the screening set.

## Files

`tables/screen-starts.md` (per row: Δ and true minima found for each tag); `scripts/comp3.mjs`; job file
`scripts/jobs-S.txt`. Records in `$W/fs2/r3/results/{S0,TL,TF,RF,DR}` (not in the repository).
