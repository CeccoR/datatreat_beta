## 7. Today's search on the screening set

The screening set is 77 runs: 66 tuning truths, one per solid × class, and 11 spheres. It ran
at the decided cells and range, with 3 processes, nice 15, resumable, and no failures. Reach
is Δ = (today's best exact χ² − the lower of today's and the truth reference's)/max(1,
χ²_ν). It is judged on truths, but not on early rejections, whose only ends are brief
refinements (round 1's rule). Accuracy is the reported solid against the truth, modulo the
class's rotations and the body's symmetry. The extents are paired within the body's axis
classes: by size within a class, by role across them (a spheroid's, cylinder's or square box's
axis with the other's axis; §10, H2). "Axis" is the truth's most distinct axis. An extent read
as unbounded counts as +∞, the largest error.

**Overall:**

| set | runs | held | free | rejected (early) | reached / judged | unbounded | worst extent, median (90 %) | thinnest, median | axis °, median (90 %) | evals: search | s: search / report / iso |
|---|---|---|---|---|---|---|---|---|---|---|---|
| truths | 66 | 32 | 28 | 6 (3) | 58 / 63 | 3 | +42 % (+290 %) | +20 % | 6.8 (79.0) | 4122 | 79 / 26 / 16 |
| spheres | 11 | 0 | 3 | 8 (4) | — | — | — | — | — | 3200 | 64 / 8 / 8 |

- **Five runs miss** (Δ > 1), seven are over Δ 0.1:
  - ellcyl-P6mmm-on (clean), Δ 62.9: held at a 28 × 28 × 4.5 nm plate, the truth 4.3 × 11.7 ×
    34.2;
  - ellcyl-P4m-near (size distribution 0.26), Δ 35.8;
  - box-Pmmm-on (preferred orientation 0.06), Δ 19.1;
  - ellcyl-Pm-3-near (clean), Δ 2.6;
  - sqbox-P2m-near (clean), Δ 1.9.

  At C3 one run missed, at Δ 1.65 (cylinder-Pm-3m-on, which reaches now). Three of the five
  are elliptic cylinders: their height is the extent the search most often puts elsewhere
  (below).
- **No rejection is a miss.** All 6 rejected truths have a truth-reference ΔBIC of +4 to +27:
  even from the truth the data do not support the shape against the isotropic size. They are
  ellipsoid-Pm-3m-near, spheroid-Pm-3-generic and spheroid-Pm-3m-on (early), and
  sqbox-Pm-3m-near, sqbox-P4m-on (9.1×9.1×9.0 nm) and sqbox-P6m-near (late).
- **Spheres (the nulls):** 3 of 11 keep a shape.
  - sphere-P-3-1, 2.5 nm, searched as a box: 2.1 × 1.9 × 2.0 nm, ΔBIC −88;
  - sphere-Pmmm-1, 3.4 nm, cylinder: 2.8 × 2.8 × 2.7, ΔBIC −341;
  - sphere-P6mmm-1, 9.9 nm, preferred orientation at strength 0.59, box: 7.8 × 7.6 × 15.1,
    ΔBIC −442.

  The first two are the two smallest spheres of the set (isotropic χ²_ν 4.9 and 2.9). Each is
  kept as a near-equant body, which takes up part of the sphere's line-shape error. The third
  is texture read as shape. The 8 rejected spheres include every error kind but texture.
  sphere-P-3m1-2 (3.7 nm), kept at C3, is rejected now (ΔBIC +9).

**By solid** (truths):

| solid | held / free / rejected | reached / judged | worst extent (90 %) | thinnest | axis ° (90 %) |
|---|---|---|---|---|---|
| box | 5 / 6 / 0 | 10 / 11 | +54 % (+101 %) | +17 % | 6.3 (19.7) |
| square box | 3 / 5 / 3 | 10 / 11 | +43 % (+110 %) | +22 % | 9.6 (75.1) |
| cylinder | 6 / 5 / 0 | 11 / 11 | +30 % (+100 %) | +24 % | 13.6 (85.6) |
| elliptic cylinder | 6 / 5 / 0 | 8 / 11 | +191 % (+551 %) | +191 % | 18.3 (85.9) |
| ellipsoid | 7 / 3 / 1 | 10 / 10 | +24 % (+77 %) | +9 % | 4.2 (20.5) |
| spheroid | 5 / 4 / 2 | 9 / 9 | +47 % (+446 %) | +21 % | 6.9 (88.8) |

- **The 90th percentiles near 80–90°** are fits with their distinct axis across the truth's: a
  cylinder or spheroid read with its aspect flipped (a needle for a plate), a square box with
  its height on an edge. The pairing by role reports these as they are; size pairing had hidden
  the spheroid's (§10, H2).
- **The elliptic cylinder's errors are mostly another assignment of its height.** In 8 of 11
  the reported height pairs by size with another of the truth's extents, at the truth
  reference's χ² or a lower one: round 1's elliptic-cylinder confusion. Paired whatever their
  role (`accLoose`), the extents' worst error is +66 % (median) against +191 % by role.

**By class** (kept truths; worst extent, thinnest, axis):
- −1: +164 %, +15 %, 4.1° (2 of 6 kept read an extent as unbounded);
- 2/m: +19 %, +9 %, 5.2°;
- mmm: +15 %, +9 %, 4.7°;
- 4/m: +31 %, +31 %, 5.5° (1 of 6 truths rejected);
- 4/mmm: +15 %, +14 %, 2.7°;
- −3: +44 %, +30 %, 17.2° (12.1° modulo the holohedry);
- −3m: +81 %, +29 %, 25.8°;
- 6/m: +76 %, +76 %, 16.5° (1 of 6 rejected);
- 6/mmm: +143 %, +79 %, 82.0°;
- m−3: +46 %, +12 %, 4.2° (1 of 6 rejected, early);
- m−3m: +73 %, +73 %, 8.4° (3 of 6 rejected).

The low classes are read best, as §6.2 predicts. 6/mmm is the worst for the axis: 4 of its 6
kept truths have the distinct axis 78–90° off (at C3, rescored, 3 of 6: 52.5° median). −3 is
the one merohedral class whose axis error drops modulo the holohedry (17.2° to 12.1°).

**By orientation** (truths):
- on: 12 held, axis 4.0° (90th percentile 75°), worst extent +35 %;
- near: 15 held, 6.8° (86°), +32 %;
- generic: 5 held, 16.5° (44°), +58 %.

The held route snaps the 'on' truths exactly. A truth 2–10° off its frame reads about as far
off as its frame lies from it (the design's near frames: 6.2° median).

**By model error** (truths; worst extent, axis):
- none (33): +32 %, 7.6°;
- hump (7): +71 %, 10.5°;
- size distribution (7): +39 %, 3.9°;
- impurity (7): +50 %, 7.4°;
- air (6): +19 %, 6.1°;
- preferred orientation (6): +136 %, 53.5°.

Texture costs the most, then the hump.

**Against the first baseline (C3), row by row** (`fix/compare-c3.mjs`): the same outcome in
67 of 77 runs. Six went from held to free, two from free to held, one early rejection is held
now (cylinder-Pm-3-generic), and one sphere is rejected now. The medians move little: worst
extent +46 % → +42 %, thinnest +23 % → +20 %, axis 7.7° → 6.8° (C3 rescored with the fixed
harness). Reach drops from 61/62 to 58/63. The five misses are in five classes, two of which
gained members with the change (mmm, 2/m), so on this evidence the drop is not tied to the
member count; three of the five are elliptic cylinders.

**Evaluations and time:**
- search: 4122 evaluations and 79 s on the truths, 3200 and 64 s on the spheres;
- report: 1637 evaluations and 29 s on a kept solid;
- the whole set: 147 min of the runs' own time without the truth reference, 171 min with it
  (§4.2).

The per-run tables are in `tables/pilot-screen.md`.
