# Free shape, round 3: the confirmation on the tuning part, and the freeze

Stage 3 of `../PROTOCOL.md` for round 3: the prototype with points 1, 4 and 5 as screened (`POINT1.md`,
`POINT4.md`, `POINT5.md`) run on the whole tuning part of the new design (`DESIGN.md`: 264 truths, 44 spheres,
308 runs), against round 2's frozen prototype on the same rows. A tunable was to change only on clear, explained
evidence; two did (the angles' threshold and the candidate cap), both read from the same records without a new
search. The prototype was then frozen before any validation row was drawn. All data are synthetic; `$W` is the
work folder, not in the repository. No run of today's search (v522) was made (the user's decision).

## 1. What was run

| tag | what | runs |
|---|---|---|
| P | round 3's prototype at the screening's defaults (profile t 9, `capCands` 3 and `capEvals` 6000, `lines` 2), the angles' profiles recorded to Δχ²/χ²_ν 40 | 308 |
| Q | round 2's frozen prototype (`h2/`, its engine checked against round 2's hashes), the 231 rows outside the screening set; on the 77 screening rows S0 is its equal (round 3's engine with round 2's switches, bit-identical, `proto/README.md`) | 231 |
| PX, PY | the rows P's cap cut, run uncapped (23) and with `capEvals` alone where it can act (7) | 30 |
| F2 | the final engine (t 5.99, `capEvals` alone) on two of them: equal to PY and to PX to the bit (χ², the search's and the stage's evaluations); its radius equal to the offline reading at t 5.99 | 2 |

Scoring: `score3.mjs` (outcome, reach against the best known over both prototypes and the truth references,
accuracy, cost, the engine's own intervals, uniqueness, the check, the keep test; `tables/confirm-score.md`, per
row), `ang3.mjs` and `ang3b.mjs` (the angles over a grid from the recorded profiles; `tables/confirm-angles.md`),
`cap3.mjs` (`tables/confirm-cap.md`). The engine's radius equals the offline reading on 260 of 260 kept truths.

## 2. Round 3 against round 2 on the 308 tuning runs

| | round 2 (Q, S0) | round 3 (P) |
|---|---|---|
| truths held / free / rejected (early) | 87 / 175 / 2 (1) | 87 / 175 / 2 (1) |
| truths kept: clean, with an error | 131/132, 131/132 | 131/132, 131/132 |
| spheres keeping a shape: clean, with an error | 0/22, 14/22 | 0/22, 14/22 |
| reached / judged (Δ ≤ 1 against the best known) | 246 / 263 | **249 / 263** |
| clean truths not reached | 7 | **4** |
| worst extent, median (90 %); clean truths kept by both (131) | +2 % (+28 %) | +2 % (+28 %) |
| clean extents within the reported interval | 306/319 (96 %) | 308/322 (96 %) |
| clean principal axes within the reported radius | 113/127 (89 %); offline 116/128 (91 %) | **125/128 (98 %) at t 5.99** (127 at t 9) |
| search evaluations | 1 082 790 | 1 113 057 (1.03×; per run median 1.09×) |
| largest minima stage | 17 511 | 13 225 (flagged: 8316) |

- **Reach** (point 5). The lines' starts make 7 rows lower than round 2's search by more than 1 χ²_ν: the clean
  truths box-Pm-3-near-a (1145 χ²_ν) and box-P-3-near-b (18.2), and five error rows (ellcyl-P6mmm-near-b 61.5,
  box-P-3m1-near-a 25.2, ellcyl-P-3-on-a 4.6, sqbox-Pmmm-on-a 1.8, sqbox-P4mmm-generic-b 1.6). Two end higher:
  box-Pm-3m-on-a (texture, 7.8: the cap, §4) and ellipsoid-Pm-3-near-b (a size distribution, 25.6: a needle
  start took one of the three full refinements from the brief end that led to the lower minimum). On 149 of 276
  kept runs the lowest minimum is reached from a line start among others; 729 starts were added (2.6 a run).
  The four clean truths still not reached are cylinder-P-3m1-on-a (66 χ²_ν), ellcyl-P4mmm-on-a (1163, flagged
  by the check at z 9.1, the misfit being the search's), sqbox-P6m-generic-b (15.7) and ellcyl-P-3m1-near-a (2.7).
- **Nothing else moves**: the outcomes (2 changed, both flagged texture rows), the accuracy of the kept truths,
  the extents' intervals, the keep test and the check's flags (107 and 108 of 154 error rows) are round 2's; the parts
  touch the starts, the stage's tail and the reported radius only.

## 3. Point 1 on the tuning part: t changed from 9 to 5.99

The kept truths' principal axes, every rule read from the same profiles (`tables/confirm-angles.md`):

| rule | clean (128) | radius ÷ round 2's, median | error, not flagged (38) | error, flagged (92) |
|---|---|---|---|---|
| round 2: 2·esdAngle | 116 (90.6 %) | 1 | 25 | 70 |
| profile t 4 | 122 (95.3 %) | 1.10 | 27 | 70 |
| **profile t 5.99** | **125 (97.7 %)** | **1.34** | 27 | 71 |
| profile t 9 (the screening's choice) | 127 (99.2 %) | 1.61 | 28 | 71 |
| curv κ 1 / 1.2 | 125 / 126 | 1.22 / 1.47 | 28 | 70 |

- **t 9 over-covers.** 127 of 128 is 2.2 binomial sd above 95 % (121.6 expected, sd 2.5); t 5.99 is 1.3 sd above,
  t 4 on it. The screening's argument for 9 (the extents' bias factor κ² = 1.44 on top of χ²₂'s 95 % point) does
  not hold for the profile as read: its reading takes the larger side and the larger turn, and the error over the
  profile's 1-σ reading has a median of 0.83 where a two-dimensional normal tilt gives 1.18 (`ang3b.mjs`, 71 clean
  axes off the lattice): it is already conservative by about 1.4, the factor κ was to supply. **t = 5.99**, the
  theoretical 95 % point, is frozen: 125 of 128 at 1.34× round 2's radius (against 1.61×) and 2.05× round 2's
  profile trials (against 2.26×). The change is to the reading alone; the engine's radius at 5.99 equals the
  offline reading (F2).
- **The three misses at t 5.99**: spheroid-P4m-generic-a (37.5° against 24.3°: a near-sphere with a second
  minimum), sqbox-P6m-generic-b (4.6° against 1.4°: the clean truth 15.7 χ²_ν above its truth reference, the
  square turned about its axis, a search miss) and cylinder-P2m-generic-b (0.99° against 0.87°). Round 2's
  twelve: ten at 1.03–1.5 times their radius, spheroid-P4m-generic-a at 1.9 and sqbox-P6m-generic-b at 4.7, as
  its validation found (up to 1.9×).
- **The curvature** covers 125 at κ 1, but on the 38 unflagged error rows its median radius is 11.9° against
  the profile's 7.9° for one more axis, and it states hundreds of degrees on near-degenerate axes: not taken.
- **Unique free fits** (51 clean, the axis off the lattice): 2 lie beyond the t-5.99 radius and 1 beyond round
  2's; round 2's other misses are held fits and fits with several minima, where its 2·esdAngle is also the
  radius.

## 4. Point 4 on the tuning part: the candidate cap dropped

The first setting (`capCands` 3, `capEvals` 6000) cut 23 of 105 flagged stages; run uncapped (PX), they show
what it lost: 2 returned fits higher (12.7 and 0.66 χ²_ν), 16 of 55 minima within Δ*, 3 extents' and 3 axes'
coverage, while 16 of the 23 were cheap stages (under 6000 evaluations uncapped). With `capEvals` alone (PY) 6
rows are cut, every interval covers as uncapped, one fit is higher (box-Pm-3m-on-a, held 12.7 χ²_ν above the free
minimum the full stage reaches, a flagged texture row) and 3 of 11 minima are dropped; the flagged tail goes from
17 237 to 8316 evaluations. **`capCands` set off (Infinity), `capEvals` 6000 kept** (`POINT4.md`).

## 5. Point 5 on the tuning part

`lines` 2 holds: 7 rows lower, 2 higher (§2), 3 more rows reached of 263, at 1.03× round 2's search evaluations
with the first cap (the lines alone: 1.08× on the screening runs). Unchanged.

## 6. The check, the jackknife and the keep test on the over-weighted errors

The design's 47 size distributions and 46 textures on the tuning part (round 2 had 16 and 14) measure these
better; they are round 2's figures, round 3 changes none of these parts (`tables/confirm-score.md`):

- **The check** flags 19–20 of 47 size distributions (spoiled 31, caught 14–15) and 42 of 46 textures (spoiled
  39–40, caught 38); humps 20/20, impurities 21/21, air 5/20. Clean truths flagged: 2–3 of 132, each a search
  miss (ellcyl-P4mmm-on-a z 9.1, 1163 χ²_ν from its truth; box-Pm-3-near-a in round 2) or near the threshold
  (box-P-3-near-b z 3.29); no clean sphere of 22.
- **The jackknife** (flagged kept truths, round 3's reported interval): size distributions 24 of 42 extents
  (57 %; 3 unbounded) and 12 of 17 axes; textures 66 of 83 (80 %; 9 unbounded) and 24 of 37; humps 32/38, 14/16;
  impurities 45/45, 17/18; air 11/11, 4/4.
- **The keep test**: no clean sphere kept (0 of 22); 14 of 22 error spheres kept (both rounds), 11 of them a size
  distribution (6) or texture (5), 7 of the 11 flagged, as round 2 found. These are the repository's `BACKLOG.md` item, not this round's.

## 7. The freeze

- **Changed after the screening**: `SHAPE_ANGLE.t` 9 → 5.99 (§3) and `SHAPE_MINIMA.capCands` 3 → Infinity (§4),
  with their comments and `RIETVELD.md` §10.8's paragraph "Round 3".
- **Checks**: F0 (round 2's switches) equals round 2's frozen engine to the bit; F1 and F2 (the defaults) equal
  the variants they combine (`proto/README.md`); the engine's radius equals the offline reading on every record.
  `npm run lint`: clean. The engine's tests (rietveld, rvmodel, rvpool, rvsplit, rvlock, rvcif, rvui, smoke,
  widths, modules): 53 of 53 pass. `proto/engine.patch` regenerated (`git apply --check` passes on the branch).
- **Written down before any validation row was drawn** (18:41 UTC): `$W/fs2/r3/FROZEN3.json` and
  `tables/frozen.md` (the tunables as the engine reads them, the engine files' sha256). `batch3.mjs` refuses a
  validation row before it exists; `h/run.mjs` refuses one unless its engine copy matches it, `h2/run.mjs` unless
  round 2's copy matches round 2's `FROZEN.json`.
- **Frozen tunables (round 3's)**: `SHAPE_ANGLE` { rule 'profile', t 5.99, each false }; `SHAPE_MINIMA.capEvals`
  6000 (capCands off); `SHAPE_TARGET` { lines 2, frames 0 }; everything else round 2's frozen values.

## 8. Risks carried into the validation

- **The threshold changed on the tuning part's evidence**, after the screening chose otherwise; the validation
  reads it fresh. 125 of 128 is 97.7 %, 1.3 sd above 95 %: some optimism of the same size as round 2's (its
  tuning part 91 %, validation 84 %) would still leave about 95 %.
- **The lines' starts take full-refinement slots** from the class's own starts (one row 25.6 χ²_ν higher); a
  start that is better in brief is not always better in full.
- **The cap's one loss is a held fit 12.7 χ²_ν above a free minimum** on a flagged row; flagged rows will show
  more of these where their stage runs long.
- **The record inflated P's report** (profiles to Δχ²/χ²_ν 40): its report cost is not the prototype's; the
  validation runs without the record.

## Files

- `CONFIRM.md`: this note. `tables/confirm-score.md` (per row, round 2 against round 3), `tables/confirm-angles.md`,
  `tables/confirm-cap.md`, `tables/frozen.md`.
- `scripts/`: `score3.mjs`, `ang3.mjs`, `ang3b.mjs`, `cap3.mjs`, `freeze3.mjs`, `jobs-C.txt`, `jobs-X.txt`, `jobs-F.txt`.
- Not in the repository (`$W/fs2/r3/`): the records (`results/P`, `Q`, `S0`, `PX`, `PY`, `F0`–`F2`), `FROZEN3.json`.
