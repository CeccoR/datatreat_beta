## 2. What was built

In the work folder `fs2/pilot` (`scripts/pilot/`):

- **`run.mjs`: one command per row.**
  - The generator draws the design row in memory (`gen.mjs` drawRow). The lines are exact,
    or with `--kernel none` the engine's own.
  - The harness refines it (`lib.mjs` runCase): autoRefine from the CIF with the standard's
    profile, up to the shape search, where each method runs from the same isotropic fit.
  - It writes one JSON per run (`writeResult`: an unbounded extent is written "Infinity"):
    - evaluations and ms of the isotropic fit, of each method's search and of the report;
    - the refine log;
    - the reported and the free solid;
    - their errors against the truth: the generalised compare, modulo the class and modulo
      the holohedry;
    - ΔBIC and the outcome;
    - the model's list (reflections, members);
    - the generator's info and the error's realised draws.
- **`methods/today.mjs`: today's search and report, unchanged.**
  - The search is `freeShape`, as autoRefine calls it.
  - The report is the card's `bodyShapeOf` on the kept solid: linear esds and angular
    profiles (`turnEsds`), as the worker's summarise calls it.
  - The two are timed apart. The report's refinements are not logged with the search's.
- **The truth reference** is round 1's (`harness/methods/truth.mjs`): the solid refined from
  the truth, first with rounded faces, then exact free and exact held. It is the model's
  minimum next to the truth.
- **The rest:**
  - `batch.mjs`: at most 3 processes, nice 15, resumable; it refuses validation rows.
  - `report.mjs`: every table below. Medians and percentiles keep unbounded extents as +∞.
  - `inmodel.mjs`: the in-model controls against the same truths with exact lines.
  - `costgrid.mjs` and `decide.mjs`: the cost decision.
  - `narrow.mjs`: the narrowest line, for the step.
  - `lreading.mjs`: the Lorentzian's reading of one exact line.
  - `fix/`: the verification's checks and the first baseline rescored (§10).

## 3. The checks

The parts were checked when built (their READMEs):
- the generator: the ⟨L⟩_V identity, A(L) against Monte Carlo, the Lorentzian limit, the
  plumbing, the integral breadth, the errors;
- the harness's tests;
- the phases against the engine;
- the design's frames against the search's held route.

After the final decision (§5) and the verification's fixes (§10) every check was run again on
the final cells and grid. All pass:

| Check | Result on the final cells and grid |
|---|---|
| phases (`check.mjs`) | All 11 read to the intended group and class, with the class's order of operations; members = mult/2 for every reflection; no notes or warnings. Volumes 26.6–28.4 Å³; shortest distances 1.15–2.62 Å. Closest pair of distinct reflections in 10–130°: 0.0109° (P−1, at 94°), 0.021° (P2/m), 0.19° or more for the rest. Isotropic fit from the CIF (10 nm, ε 0.1 %): χ²_ν 0.971–1.030; cell within 7·10⁻⁵; D 9.89–10.14 nm. |
| generator (`checks.mjs`) | ⟨L⟩_V identity ≤ 4.6·10⁻¹²; Monte Carlo \|z\| ≤ 2.37; the Lorentzian limit on Pm−3m and P−1 ≤ 3.1·10⁻¹² of the peak (cylinders; 1.4·10⁻¹⁵ for the rest), the exact lines 13–19 % off it; plumbing 0.12–0.27 % of the peak (0.06–0.15 % with a Lorentzian instrument); breadths 1.000; each error at its spec; 0.15–0.25 s a pattern |
| generator, every row with an error (`fix/errors-check.mjs`) | 24 hump and 23 impurity rows at their stated share of the strongest line within the range, to 10⁻¹⁴; 23 air rows at their stated start, to 2·10⁻¹⁶ |
| generator against a direct synthesis (`fix/pattern110.mjs`, the verifier's code on 10–110°) | 6 rows: the exact-line correction (5–18 % of the peak) within 5.0·10⁻⁴ of the peak, 3.1·10⁻⁴ with the background's family taken out; the in-model limit on the frozen engine ≤ 1.5·10⁻¹⁶ |
| harness (`test.mjs`) | 44 062 checks, 0 failed (15 814 as before, plus 160 for the pairing by role, 27 648 turned lattice frames and 440 relabelled bodies for the canonical form) |
| design (`check-frames.mjs`) | 'on' 66 of 66 held exactly; 'near' 66 of 66 snap back to their frame, the 22 cylinders' and spheroids' axes turned 2.00–9.81° by their tilt; 12 of 65 'generic' have no held frame (no lattice row normal to the axis they snap); normRow reads all 231 rows |
| narrowest line (`narrow.mjs`) | 0.165° over all 231 rows on 10–110°: 16.5 points per FWHM at 0.01° |

A uniform scale leaves every lattice direction where it was in the Cartesian frame, so the
design's frames still hold on the scaled cells: the 209 rows the revision left alone have the
same R to 3·10⁻¹⁶.
