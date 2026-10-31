# Free shape, round 3

Round 3 of the free-shape work, run under `../PROTOCOL.md` on a new design, polishing round 2's frozen prototype
(`../round2/`) on four points: the axes' intervals (1), the minima stage's cost cap (4), the completeness of the
minima (5), and a bigger design (6). Round 2's other two shortfalls, size distributions and texture, are the
repository's `BACKLOG.md` item and not this round's. Synthetic data only; no run of today's search (v522).

**What round 3 found, and what it changed.** A new design (`fs3-design-r3`: the categorical grid twice, 396
truths and 66 spheres, size distributions and texture 60 each among the 198 error truths; tuning 308 runs,
validation 154) gave the new tuning and validation parts at round 2's cost per run. (1) Round 2's angular radius,
2·esdAngle, is the tilt's 1-σ reading doubled, which a two-dimensional tilt exceeds one time in seven: the
prototype now follows each turn's profile until χ² rises by 5.99·χ²_ν (χ²₂'s 95 %) and takes the larger reading of
the turns that tilt the axis; the covariance scaled by a factor covered as many but misstates near-degenerate axes
by hundreds of degrees. The screening chose t 9, the tuning part showed it over-covering (127 of 128) and t 5.99 was
frozen (125 of 128). (4) The stage stops beginning candidates or rounds after 6000 evaluations where the per-line
check fired and says when the minima were not explored; a cap of 3 candidates was screened and dropped because it
lost minima and coverage on cheap rows. (5) A plate on the normals of the two most broadened lines and a needle on
those of the two least broadened, read from the isotropic fit's residual, reach rows round 2's search misses (a
clean truth by 1293 χ²_ν) at 1.08× the search; relabelled frames and random starts bought less and stay off; the
share of a dense reference's minima found is unchanged (76–79 %). Scored once on the validation part against round
2's frozen prototype: 61 of 65 clean principal axes covered (94 %; round 2 62 of 65 on this draw, its misses up to
1.94× the radius, round 3's within 1.06×; with the tuning part 96 % against round 2's 91–92 %), clean extents 159
of 162 (round 2 158), reach 128 of 131 (126), at 1.08× the search's and 1.26× the whole fit's evaluations (the
profile makes the report 1.74×). Shortfalls (`VALIDATION.md` §7): the axes just under 95 % on the validation draw,
clean search misses that remain (one validation truth 62 χ²_ν, four tuning truths up to 1163), one held fit the cap
leaves 12.7 χ²_ν above a free minimum, and the size distributions and texture of `BACKLOG.md`.

## Index

| file | what |
|---|---|
| `DESIGN.md` | point 6: the new design, why its size, its cost (`tables/design.md`) |
| `POINT1.md` | the axes' 95 % radius: profile against curvature, the threshold (`tables/screen-angles.md`) |
| `POINT4.md` | the minima stage's cap and what it loses (`tables/confirm-cap.md`) |
| `POINT5.md` | targeted starts against random fill and the dense reference (`tables/screen-starts.md`) |
| `CONFIRM.md` | the confirmation on the 308 tuning runs against round 2's prototype, the two tunables changed, the freeze (`tables/confirm-score.md`, `confirm-angles.md`, `frozen.md`) |
| `VALIDATION.md` | the validation part, scored once, against round 2's frozen prototype (`tables/validation-score.md`) |
| `proto/` | the prototype: `engine.patch` (round 2's parts and round 3's, against the branch; not applied), `round3-only.diff`, `README.md` (parts, switches, tunables, verifications) |
| `scripts/` | every script behind the numbers, with its `README.md` and the job files |
| `tables/` | the small tables the notes read |
