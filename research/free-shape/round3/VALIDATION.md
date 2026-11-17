# Free shape, round 3: the validation part, scored once

Stage 4 of `../PROTOCOL.md`: round 3's frozen prototype (`CONFIRM.md` §7, `tables/frozen.md`) and round 2's
frozen prototype on the 154 validation runs of round 3's design (132 truths, 22 spheres), drawn now for the first
time. Scored as the confirmation scored the tuning part (`score3.mjs`). Nothing was changed after the results
were seen; the shortfalls are reported as found (§7). No run of today's search was made (the user's decision).
All data are synthetic; `$W` is the work folder, not in the repository.

## 1. What was run

| tag | what | runs | process time |
|---|---|---|---|
| VP | round 3's frozen prototype at its defaults (no record), its engine copy checked against `FROZEN3.json` by every run | 154 | 108 min |
| VQ | round 2's frozen prototype, its engine copy checked against round 2's `FROZEN.json` | 154 | 90 min |

Both runs of a row draw the same pattern and fit the same isotropic start (76 150 evaluations either way). Reach is
against the best known over both and their truth references. Per row: `tables/validation-score.md`.

## 2. Summary

| 154 validation runs | round 2 (VQ) | round 3 (VP) |
|---|---|---|
| truths kept: clean, with an error | 65/66, 66/66 | 65/66, 66/66 |
| spheres keeping a shape: clean, with an error | 0/11, 7/11 | 0/11, 7/11 |
| reached / judged (Δ ≤ 1) | 126 / 131 | **128 / 131** |
| clean truths not reached | 2 (1.6, 62 χ²_ν) | 1 (62) |
| worst extent, median (90 %); 65 clean truths kept by both | +1 % (+12 %) | +1 % (+13 %) |
| clean extents within the reported interval | 158/162 (98 %) | 159/162 (98 %) |
| **clean principal axes within the reported radius** | 62/65 (95 %), misses at 1.49–1.94× the radius | **61/65 (94 %), misses at 1.01–1.06×** |
| median radius, clean | 3.2° | 5.1° |
| error axes: not flagged, flagged | 16/23, 32/42 | 17/23, 31/42 |
| search evaluations | 539 238 | 581 088 (1.08×; per run median 1.08×) |
| report evaluations | 254 952 | 443 303 (1.74×) |
| whole fit's evaluations (isotropic fit, search, report) | 870 340 | 1 100 541 (1.26×) |
| whole fit's CPU | 5393 s | 6492 s (1.20×) |
| largest minima stage: flagged / not flagged | 10 827 (all) | 6560 / 13 496 |
| minima not explored in full (capped) | not reported | 15 (1) |

Against the confirmation (`CONFIRM.md`):

| figure | tuning part (308) | validation (154) | reading |
|---|---|---|---|
| clean principal axes covered, round 3 | 125/128 (98 %, offline at t 5.99) | 61/65 (94 %) | held (together 186/193, 96 %) |
| the same, round 2 | 113/127 engine, 116/128 offline (89–91 %) | 62/65 (95 %) | round 2 together 175–178 of 192–193 (91–92 %) |
| clean extents covered | 308/322 (96 %) | 159/162 (98 %) | held |
| reach, round 3 against round 2 | 249 against 246 of 263 | 128 against 126 of 131 | held |
| search evaluations × round 2 | 1.03 (with the first cap) | 1.08 | as screened (the lines 1.08×) |
| false alarms of the check on clean patterns | 2 of 154 (both search misses or near the threshold) | 0 of 77 | held |

## 3. Point 1: the axes

- **The four clean misses lie at the radius' edge.** sqbox-P-3-near-a (4.01° against 3.79°), ellcyl-Pm-3m-near-a
  (1.59° against 1.58°), sqbox-P2m-near-b (0.64° against 0.63°), ellipsoid-P6m-near-b (6.60° against 6.42°,
  held). The first three are unique free fits that round 2 also misses, at 1.94, 1.62 and 1.49 times its radius;
  round 3's profile takes them to 1.01–1.06. The fourth is a held fit whose search round 3's lines changed (round
  2 holds it at 7.37°, from a different free fit's offset).
- **61 of 65 is 0.4 binomial sd under 95 %**; with the tuning part 186 of 193 (96.4 %). Round 2's prototype on the
  same validation rows covers 62 of 65: on this draw it is at its nominal figure (its own validation set: 84 %;
  the tuning part here: 89 %), so the two do not differ on the validation part in count; they differ in how far
  the misses fall (round 3 within 6 % of its radius, round 2 up to 1.94×) and in what the radius costs.
- **The width**: the median clean radius 5.1° against 3.2° (the bimodal mix of lattice and loose axes, `POINT1.md`);
  the profile's trials make the report 1.74× round 2's evaluations, the whole fit 1.26×, its CPU 1.20×.

## 4. Point 4: the cap

On the validation part the evaluation cap cut one stage (sphere-P-3m1-4, texture 0.16, a flagged sphere kept with
a shape, 6560 evaluations); the flagged stages' largest is 6560, the unflagged ones' 13 496 (uncapped, as the point
asks). The report says `explored: false` on 15 runs (5 flagged): there the cap or `max` 6 left a distinct
candidate out. Round 2 reported none of these.

## 5. Point 5: the starts

The lines' starts (372 on 138 runs) reach three rows round 2 does not: ellcyl-P-3-generic-a (clean, 1.6 χ²_ν),
ellcyl-P-3m1-on-a (texture, 98.8) and ellcyl-Pm-3-near-b (texture, 501); one error row ends 1.3 χ²_ν short
(box-P-3-generic-a, a hump). The clean truth ellcyl-Pm-3m-near-a stays 62 χ²_ν above its truth reference in both.
The search costs 1.00–1.13× round 2's by class.

## 6. The check, the jackknife, the keep test (unchanged parts; the over-weighted errors)

| VP, 154 runs | rows | flagged | spoiled | spoiled and flagged |
|---|---|---|---|---|
| clean truths / spheres | 66 / 11 | 0 / 0 | 4 / 0 | 0 |
| size distribution | 23 | 9 | 16 | 7 |
| texture | 24 | 18 | 18 | 16 |
| hump, impurity, air | 11, 9, 10 | 10, 9, 4 | 2, 4, 0 | 2, 4, 0 |

- **No false alarm** on 77 clean patterns (largest z 2.28).
- **The jackknife** (flagged kept truths with an error; the reported interval): size distributions 14 of 21
  extents (3 unbounded), 6 of 9 axes; textures 18 of 31 (6 unbounded), 9 of 15; humps 18/20, 6/7; impurities
  19/19, 7/8; air 8/8, 3/3.
- **The keep test**: no clean sphere kept; 7 of 11 error spheres kept in both rounds (2 of them a size
  distribution, not flagged).

## 7. Shortfalls

Reported as found; nothing was changed after the results were seen.

1. **The clean axes: 61 of 65 (94 %)**, just under 95 %; with the tuning part 96 %. The misses are at 1.01–1.06×
   their radius, but they are there, and on this draw round 2's prototype counts one more covered. The radius is
   1.6× round 2's in median and costs 1.74× the report's evaluations.
2. **Search misses on clean rows remain.** One clean validation truth (ellcyl-Pm-3m-near-a, 62 χ²_ν) and four
   clean tuning truths (`CONFIRM.md` §2, up to 1163 χ²_ν) end above their truth reference; the lines' starts take
   full-refinement slots and once ended a flagged row 25.6 χ²_ν higher (tuning).
3. **The cap's one loss in kind**: a held fit left 12.7 χ²_ν above a free minimum the full stage finds (tuning,
   flagged texture); unflagged stages still run to 13 496 evaluations.
4. **Size distributions and texture** (the repository's `BACKLOG.md`, not this round): 7 of 16 spoiled size
   distributions are caught; the jackknife covers 14 of 21 of their flagged extents and 18 of 31 of the textures';
   7 of 11 error spheres keep a shape.
5. **Small counts**: 65 clean axes a part (binomial sd 2.7 %); the cap acted on 1 validation row.

## 8. Files

- `VALIDATION.md`: this note. `tables/validation-score.md`: the comparison per row (154).
- Scripts: `scripts/score3.mjs`, `scripts/jobs-V.txt`. Not in the repository: the records `$W/fs2/r3/results/VP`, `VQ`.
