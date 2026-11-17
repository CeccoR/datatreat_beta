# Free shape, round 3, point 4: the minima stage's cost cap

On round 2's flagged rows the minima stage spent up to 47 813 evaluations (one cubic ellipsoid with a size
distribution: five candidates at a symmetric orientation, every turn tried, each refinement long;
`../round2/CONFIRM.md` §8.1). Round 3 caps the stage where the per-line check fires, says when the minima were
not explored in full, and measures what the cap loses. All data are synthetic; `$W` is the work folder, not in
the repository.

## The cap

Where the per-line check of the fit before the stage fired (the keep test's check, `keepRec.flagged`), the stage
(`shapeMinima`) takes at most `SHAPE_MINIMA.capCands` candidates and begins no candidate and no round of turns
once it has spent `capEvals` pattern evaluations (the engine's own counter, `EVAL_COUNT`). A candidate already
settling finishes its round, so a stage can pass the budget by one round. `info.minimaStage` records `evals`,
`left` (distinct candidates beyond the limit, counted to 12, not refined), `skipped`, `capped` and `explored`,
and the report's `minima.explored` is false when the cap, or round 2's `max` 6, left a distinct candidate or a
round out. Both tunables at Infinity give round 2's stage to the bit (`proto/README.md`, verification 1).

## Screening (77 runs), the first setting

On S0 (round 2's stage) the 24 flagged stages cost up to 17 511 evaluations (median 1026), the 44 others up to
8144 (median 1188, 90 % 5113). `capCands` 3 with `capEvals` 6000 was chosen to bring the flagged rows inside the
others' range, and run on the four rows it could change (CP): the stage 0.29–0.53× as long, every returned χ²
equal, 2 of 9 minima within Δ* dropped.

## Confirmation (308 runs): what the cap loses

On the tuning part at the defaults (P, `CONFIRM.md`) the cap cut 23 of 105 flagged stages. Each was run again
uncapped (PX) and, for the rows whose uncapped stage passes 6000, with the evaluation cap alone (PY)
(`cap3.mjs`, `tables/confirm-cap.md`):

| the 23 rows the first setting cut | stage evaluations | search evaluations | returned χ² higher (> 0.5 χ²_ν) | minima within Δ* (of the uncapped's found) | extents covered (E) | axes covered |
|---|---|---|---|---|---|---|
| uncapped (PX) | 128 211 | 180 577 | — | 55 | 43 | 17 |
| capCands 3, capEvals 6000 (P) | 67 681 (0.53×) | 120 080 (0.66×) | 2: box-Pm-3m-on-a 12.7 (held, where uncapped it goes free), box-P-3-near-b 0.66 | 39 (39) | 40 | 14 |
| **capEvals 6000 alone** (PY on the 7 rows it can change, PX elsewhere) | 101 623 (0.79×) | 153 972 (0.85×) | 1: box-Pm-3m-on-a 12.7 | 52 (52) | **43** | **17** |

- **The candidate cap cost more than it saved where it acted.** 16 of its 23 rows had an uncapped stage under
  6000 evaluations: they were not the tail. Its own losses, beyond the evaluation cap's, are 13 minima, 3
  extents' coverage and 3 axes' (box-P6mmm-near-a, box-Pm-3m-on-a, ellcyl-P-3m1-generic-a, box-P-3-near-b,
  box-Pm-3-generic-b). Set off
  (`capCands` Infinity) on that evidence.
- **The evaluation cap alone cuts the tail and keeps the intervals.** It acts on 6 rows of the tuning part
  (0.59× their stage); every interval covers as uncapped. Its one loss is box-Pm-3m-on-a (texture 0.46): the
  uncapped stage's fourth candidate reaches a free minimum 12.7 χ²_ν below the held frame the capped stage
  returns, which a flagged row's Δ* (25) and its jackknife already treat as within the misfit. The largest
  flagged stage becomes 8316 evaluations (uncapped 17 237); the cost saved is 2.4 % of the tuning part's search,
  the cap's value being the tail, not the total.
- **Not explored.** With the final setting the report says `explored: false` on the capped rows and on those
  where `max` 6 left a distinct candidate out (23 unflagged stages of 171 on the tuning part, as in round 2,
  which did not say so).
- **Unflagged stages are not capped** (the point asks for the flagged rows): their largest are 13 225, 12 423 and 12 174
  evaluations (clean truths: ellcyl-P6mmm-near-a, ellipsoid-P4m-near-a, ellcyl-Pmmm-near-b; 4–6 candidates), the
  same tail in kind; a cap there would be a new decision.

## Decision

`capEvals` 6000 where the check fired; `capCands` off. The validation (`VALIDATION.md`) reports the stage's
cost and how often the minima were not explored.

## Files

`tables/confirm-cap.md`; `scripts/cap3.mjs`, `scripts/jobs-X.txt` (PX, PY). Records in `$W/fs2/r3/results/{CP,P,PX,PY}`.
