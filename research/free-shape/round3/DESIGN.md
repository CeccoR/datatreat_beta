# Free shape, round 3: the design

Round 3 needs a new design: round 2's validation set is spent (`../round2/VALIDATION.md`), and round 2's
shortfalls (`../round2/VALIDATION.md` §9) were measured on too few rows of the kinds that matter (33 clean
truths and 5 clean spheres a part, 6–8 rows of each model error). This design gives round 3 its tuning and
validation parts. It keeps `../PROTOCOL.md`'s layout and generator; what changes is the number of rows, the
seeds and the weight of the error kinds. All data are synthetic. `$W` is the work folder (the session's
scratchpad), not in the repository.

## What was drawn

`scripts/make-design3.mjs` (round 2's `make-design.mjs` with the changes below) writes `$W/fs2/r3/design/design.json`
(462 rows) and its balance tables (`tables/design.md`), deterministically (54 s). `scripts/check-frames.mjs`
passes every row through the generator's `normRow` and checks the frames against the search's held route.

| | round 2 | round 3 |
|---|---|---|
| version, master seed | `fs2-design-v1`, 20261026 | `fs3-design-r3`, 20261031 (every row's noise, error draws and frame new) |
| truths | 6 solids × 11 Laue classes × 3 orientations = 198 | the same grid twice (replicates a, b) = **396**; ids `<solid>-<phase>-<orient>-<a|b>` |
| spheres | 3 per class = 33 | 6 per class = **66** |
| clean truths: tuning / validation | 66 / 33 | **132 / 66** |
| clean spheres: tuning / validation | 12 / 5 | **22 / 11** |
| error kinds among the 198 (round 2: 99) truths with an error | hump 20, size distribution 20, impurity 20, air 20, texture 19 | **size distribution 60, texture 60**, hump 26, impurity 26, air 26 |
| spheres with an error | 16 (4, 3, 3, 3, 3) | **33**: size distribution 10, texture 10, hump 5, impurity 4, air 4 |
| split | per solid × class cell 2 tuning, 1 validation, the validation orientation (11·solid + class) mod 3 | the same per replicate, the orientation (11·solid + class + replicate) mod 3 |
| parts | tuning 154 (132 + 22), validation 77 (66 + 11) | **tuning 308 (264 + 44), validation 154 (132 + 22)** |
| screening subset | 77 (one tuning truth a cell + one sphere a class) | 77, the same rule on replicate a alone |

- **Balance.** The error kinds were placed by the same annealing over solid, class, orientation, the split
  (screening, the rest of tuning, validation), solid × split, and now also the replicate and orientation ×
  split. Each solid carries 33 clean truths, 10 size distributions, 10 textures and 4–5 of each other kind;
  each class 18 clean and 5–6 of each over-weighted kind; each orientation 66 clean and 20 of each. By part:
  tuning 132 clean, 40 size distributions, 40 textures, 17–18 of each other kind; validation 66 clean, 20, 20,
  8–9. The screening subset holds 33 clean truths, 10 size distributions, 10 textures, 4–5 of the rest.
- **The hypercube** is one sliced maximin Latin hypercube over the 396 truths (7 columns, 600 000 swaps):
  minimum distance 0.301 (unannealed 0.157), largest column correlation 0.026. The spheres' own (5 columns):
  0.238 (0.179), 0.023. 56 truths had their ratios shrunk to keep the largest extent at 60 nm (round 2: 30
  of 198); as in round 2 this ties the smallest extent to the anisotropy (ρ −0.15), so a regression over the
  design should carry both.
- **Frames.** 'on': 131 of 131 truths with a defined axis have their frame among the held frames; 'near':
  tilts 2.03–9.89°, the 44 cylinders' and spheroids' axes turned by their full tilt; 'generic': 28 without a
  held frame (round 2: 12 of 65). Two near-spheres have no defined axis.
- **The size distribution and texture over-weighted** (60 each of 198 error truths, against 26 of each other
  kind): they are round 2's two blind spots (the repository's `BACKLOG.md`), and round 3 does not model them, but
  the check's detections, the jackknife's coverage and the minima stage's cost tail are measured on them, and
  round 2 had 6–8 rows of each a part. The other three kinds keep about round 2's count.

## Why this size, and the cost

The pilot's budget logic (`../round2/PILOT.md` §1, §5) set what a run costs: the cells (×0.8), the range
(10–110°) and the step (0.01°) were chosen so that the 77 screening runs fit in about an hour on three
processes. Round 3 keeps all three, so a run costs what it did; what the design sets is how many runs each
stage takes.

- **Screening stays at 77 runs** (one replicate), so each variant of a step costs what a round-2 step did:
  31 min of elapsed time for the 77 with the angles' profiles recorded (71 s a run, P−1 159 s, m−3 24 s).
- **The tuning part doubles to 308 runs** and is run once at the end (the confirmation), with the angles'
  record, about 2 h on three processes.
- **The validation part is 154 runs**, run twice (round 3's prototype and round 2's frozen one), about 2 h.
- **No run of today's search (v522)**: by the user's decision, round 3 compares only with round 2's frozen
  prototype and with the truth.

Twice the truths halve the binomial sd of a coverage on clean rows (from about 4 % to about 2.7 % on a part's
clean axes), and the 20 + 20 size distributions and textures a validation part (against 6–8) let the check's
and the jackknife's figures on them be read at all. Doubling the clean truths through a second replicate of
the categorical grid keeps the design's balance cell by cell; drawing more continuous levels for the same
cells would not.

## Files

- `scripts/make-design3.mjs`, `scripts/check-frames.mjs`: the design and its checks (run from
  `$W/fs2/r3/design`, with the shared `$W/fs2/harness` and `$W/fs2/phases`).
- `tables/design.md`: the balance tables and the hypercube's figures as written.
- Not in the repository: `$W/fs2/r3/design/design.json` (462 rows; rebuilt to the bit by the script).
