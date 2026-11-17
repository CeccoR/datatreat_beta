## 8. What it means for round 2

- **The cost is now set.** A run costs 115 s (isotropic fit + search + report), 133 s with the
  truth reference and the drawing. In the runs' own time a screening is 147 min, 171 min with
  the truth reference:
  - on 3 processes, about 49 min (57 with the truth reference): within the hour the pilot was
    given;
  - on 2 processes, as later stages run per agent, about 74 min (86): over the hour;
  - a confirmation on the 154 tuning runs is about 295 min of run time: 2.5 h on 2 processes,
    1.6 h on 3; the validation, once, as a screening.
  - P−1 is 3.3× the mean (379 s); its isotropic fit is a quarter of that.

  The first write-up quoted 1 h a screening and 2 h a confirmation on 3 processes only (§10,
  H8).
- **The line shape sets most of today's extent error, not all of it, and not the axes alone.**
  - The truth reference reads the thinnest extent +29 % on the clean truths; with the engine's
    own lines the same truths come back at 0 % (median), the worst extent at +7 % against
    +39 %.
  - In the model's own lines the cubic ellipsoid and a hexagonal elliptic cylinder are not
    determined, and the cylinders' axes are flat to about 5° (§6.3). The axis error of today's
    solids (6.8°, median) mixes the line shape, the held route's frames (a 'near' truth reads
    about as far off as its frame) and this weak determination.
  - Accuracy figures in later screenings will measure the model's line shape as much as the
    search. The search's own figures are reach, completeness and evaluations.
- **Reach needs a better reference than the truth's minimum.** In 26 of 60 kept truths
  today's minimum lies below it. The best known per run must be the lowest over every method
  run on it, as the protocol says (Δ ≤ 1 against the best known), with the dense reference
  search for completeness. Against the truth reference today misses 5 of 63; three are
  elliptic cylinders, whose height the search puts on another extent in 8 of 11 kept runs.
- **The keep criterion meets false shapes on exact lines.** 3 of 11 spheres keep one (ΔBIC
  −88 to −442): two small spheres (2.5, 3.4 nm) and one with texture. The isotropic model's
  own misfit (χ²_ν up to 4.9 on a 2.5 nm sphere) is taken for evidence even with χ² divided by
  its χ²_ν. This is the protocol's keep-criterion question, now with numbers.
- **Cubic is the weak class, and 6/mmm reads axes across.** 3 of 6 m−3m truths are rejected;
  m−3m reads a quarter of the true anisotropy from the truth, and in the model's own lines the
  cubic ellipsoid is not determined. In 6/mmm 4 of 6 kept truths have their distinct axis
  78–90° off. A better search will not help with the first. A line shape nearer the exact one
  might: the protocol's "why the solids are confused".
- **Merohedral classes.** −3's axis error drops from 17.2° to 12.1° modulo the holohedry. The
  other four show no twin-like error at median.
- **Scoring.** Unbounded extents are +∞ in every median and percentile, and solids with a
  symmetry axis are compared axis to axis (§10). Any later method is scored by the same
  `report.mjs`.

## 9. Files

- `scripts/`: the scripts and small inputs: phases, generator, harness, design, pilot. Its
  README sets up a work folder from this repository.
- `scripts/pilot/README.md`: the pilot's commands and results layout; `scripts/pilot/fix/`: the
  verification's checks (`errors-check.mjs`, `pattern110.mjs`), the first baseline rescored
  (`rescore.mjs`), the row-by-row and cost comparisons with it (`compare-c3.mjs`,
  `cost-compare.mjs`).
- `tables/pilot-cost.md`: §4.1's runs on the first cells, with the bias and search tables
  (scored with the fixed harness).
- `tables/pilot-screen.md`: every table of §4.2, §6.2, §6.4 and §7, and the per-run tables.
- `tables/pilot-inmodel.md`: §6.3, run by run.
- `tables/pilot-screen-c3.md`: the first baseline (C3), scored with the fixed harness (§10).
- The run records (one JSON per run) and the profiles are in the work folder,
  `fs2/pilot/results/`, not in the repository.
