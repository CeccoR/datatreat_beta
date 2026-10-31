# Free shape, round 3, point 1: the axes' 95 % radius

Round 2's validation covered 27 of 32 clean principal axes (84 %; 86 of 97, 89 %, over both parts), and on
well-determined single-minimum fits the stated radius was up to 1.9× too small (`../round2/VALIDATION.md` §4,
§9). Round 3 compares two remedies on the screening runs of the new tuning part (`DESIGN.md`): a turn profile
read where χ² rises by a threshold, and the curvature (the covariance's σ) scaled by a tuned factor, each with
and without each minimum's own interval; it picks by coverage, then cost, and confirms on the whole tuning part
(`CONFIRM.md`). All data are synthetic; `$W` is the work folder, not in the repository.

## Why round 2's radius is short

Round 2 stated an axis's radius as 2·esdAngle, esdAngle being the rms of the profile's 1-σ readings of the two
turns that tilt the axis (`turnEsds`: the body turned by 1, 2, 4, 8 … °, the rest refined 4 iterations, σ where
Δχ² first reaches χ²_ν). An axis's error is a tilt, two-dimensional: with two equal normal turns of σ, its
angle exceeds 2σ with probability e⁻² = 13.5 %; the 95 % point is √5.99 σ = 2.45σ. So 2·esdAngle covers 86 %
at best, what round 2 measured (84–91 %), before any bias. The extents needed κ 1.2 on the curvature for the
instrument's and the line's residual bias (`../round2/STEP4.md` §6); the turns have no reason to need less.

## What was run

`S0`: the 77 screening runs (66 truths, 11 spheres) with round 2's search and `SHAPE_ANGLE.record` (each turn's
profile followed to Δχ²/χ²_ν 40 on the steps 1, 1.5, 2, 3, 4, 6, 8, 12, 16, 24, 32, 45, 60°, both sides, with
`each`: also at every minimum within Δ*; the covariance's σ of each turn, at the reported fit and at each
minimum). Every rule is then read offline from the same records (`ang3.mjs`), the engine's own reading checked
equal on the confirmation (`proto/README.md`, verification 3).

- **'profile', t**: each turn's reading where Δχ²/χ²_ν first reaches t (√Δχ² linear between steps), the
  larger side; an axis's radius the larger reading of the turns that tilt it.
- **'curv', κ**: κ·√5.99·σ_turn (the covariance's), the larger of the two turns.
- Both with the minima as round 2 (the largest angle of a minimum within Δ* to the axis), or with **each**: the
  hull over the minima within Δ* of (the angle + that minimum's own reading). A held fit's radius is at least
  2·freeOff (round 2's convention); where the check fired the jackknife's turn joins, as before.

## Results on the 77 screening runs

Principal axes (the truth's most distinct, modulo the class) of the kept truths (`tables/screen-angles.md`; the
median radius is bimodal, axes on or near the lattice under 3° and loose ones over 10°, so the ratio to round
2's radius row by row is the fairer width):

| rule | clean (31) covered | median radius, clean | ÷ round 2's (median) | error, not flagged (10) | error, flagged (22) |
|---|---|---|---|---|---|
| round 2: 2·esdAngle | 27 (87 %) | 2.8° | 1 | 10 | 17 |
| profile t 5.99 | 30 | 7.1° | 1.24 | 10 | 17 |
| **profile t 9** | **31** | **7.1°** | **1.53** | 10 | 17 |
| profile t 12 | 30 | 11.1° | 1.69 | 10 | 17 |
| profile t 9, each | 31 | 10.7° | 1.71 | 10 | 17 |
| curv κ 1 | 30 | 8.6° | 1.22 | 10 | 17 |
| curv κ 1.5 | 30 | 13.0° | 1.84 | 10 | 17 |
| curv κ 1, each | 31 | 15.8° | 1.51 | 10 | 17 |

- **Round 2's four misses** reproduce its shortfall on new rows: sqbox-Pmmm-generic-a (2.28° against 2.24°),
  ellipsoid-P2m-near-a (2.78° against 2.56°), cylinder-P6mmm-near-a (1.60°: a flat profile whose default steps
  never crossed in the record run) and spheroid-P4m-generic-a (37.5° against 19.7°, a second minimum). The
  profile at t 5.99 covers three, t 9 all four.
- **The well-determined unique fits.** On the 15 clean axes off the lattice and free (11 unique), the error
  over round 2's radius reaches 1.55 at most on the unique ones beyond it (3 of 11), over the profile's t-5.99
  reading 0.64 at most at t 9 (`ang3b.mjs`). The profile's own 1-σ reading (the larger side and turn) puts the
  error at a median 0.80 of it, 1.60 at the 90th percentile: the profiles are not parabolas (sqbox-Pmmm-generic-a
  has a second valley 8° away, 0.9 χ²_ν deep, the minima stage never saw), which a reading at the threshold
  takes in and a σ scaled up from one χ²_ν does not.
- **The curvature fails where it matters.** At κ 1 it covers as many, but where two widths are nearly equal
  or the orientation is symmetric its σ runs to tens or hundreds of degrees (ellipsoid-P2m-near-a 133° at κ 1
  against an error of 2.8°; cylinder-P6mmm-near-a 61°; a hump spheroid 799°), and a held fit's covariance
  has no turns at all, so it needs the profile's σ as a fallback anyway. Its only advantage is cost.
- **each** (every minimum's own cone) adds width (1.71× at t 9) and no coverage on these rows: the minima's
  angles already carry the spread.
- **The flagged error rows** are the jackknife's (17 of 22 with every rule); their misses are texture and
  size distributions, round 2's open point (the repository's `BACKLOG.md`), not this one's.

**Cost.** The profile is read on the finer steps up to t: on the clean screening truths' principal axes 2.04×
round 2's profile trials at t 5.99, 2.22× at t 9 (each trial one refinement of 4 iterations); the report's
evaluations about 2× round 2's (box-Pm-3-near-a 809 → 1797). The curvature costs nothing beyond the fit.

## Decision

`SHAPE_ANGLE.rule 'profile'`, **t = 9**, `each` off. t 9 is χ²₂'s 95 % point 5.99 times κ² = 1.2², the factor
the curvature needed on the extents (`../round2/STEP4.md` §6) for the instrument's and the line's bias; the
screening runs cannot tell 5.99 (30 of 31) from 9 (31 of 31) and round 2's lesson was that the tuning part's
coverage ran 7 points above the validation's, so the threshold takes the bias factor the extents showed. The
curvature, cheaper, is not taken: it misstates exactly the near-degenerate axes. `esdAngle` stays round 2's
1-σ figure; `radius` is the 95 % statement. The confirmation reads t over a grid on the 308 tuning runs
(`CONFIRM.md` §3).

## Files

`tables/screen-angles.md` (the grid and the rows); `scripts/ang3.mjs`, `scripts/ang3b.mjs`. Records in
`$W/fs2/r3/results/S0` (not in the repository).
