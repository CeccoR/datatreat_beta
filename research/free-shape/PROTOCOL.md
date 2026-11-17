# Test protocol for the free-shape work (from round 2 on)

Agreed with the user on 2026-10-26. It replaces the case list of `FREE-SHAPE.md` §3 for
every test from now on. Round 1 (`FREE-SHAPE.md`) stays as it is.

## Rules

- **Synthetic data only.** The user's samples are not used to tune or to choose anything:
  doing so would fit the method to them.
- **Known truths, balanced.** Every profile is drawn from a known solid, and the six solids
  come in equal shares.
- **Tuning and validation are split by truth.** Everything is tuned on the tuning part. The
  validation part is scored once, on the final version. If anything changes after that, the
  validation set is spent: a new one is drawn from the same design with new seeds.
- **Keep the data simple.** The phases are fictitious small cells, one per Laue class.
  Real phases may be used later to check one symmetry, never to tune. No hours are spent
  on a phase that is merely an awkward choice: after the pilot, cells, range and step are
  set by the cost they bring.

## The design

A designed experiment, not every combination.

- **Categorical factors, crossed in full, once each:** 6 solids × 11 Laue classes × 3
  orientation classes = **198 truths**.
- **Continuous factors, as one maximin Latin hypercube** over the 198 truths: each factor
  covers its range evenly, and the factors are uncorrelated.
- **The model error is a factor of the design:**
  - half the truths have none;
  - the other half have one of five kinds, about a tenth each;
  - the kinds are assigned so that solid, Laue class, orientation and the split are
    balanced;
  - the error's strength is a dimension of the hypercube.
  - Each truth is drawn once: accuracy is measured against the known truth, so no truth
    needs a twin without the error.
- **Spheres:** 11 Laue classes × 3 = **33**, half of them with an error. They are the nulls
  for the keep criterion, and they show whether an error invents a shape.

| Factor | Levels or range |
|---|---|
| Solid | box, square-based box, cylinder, elliptic cylinder, ellipsoid, spheroid |
| Laue class | −1, 2/m, mmm, 4/m, 4/mmm, −3, −3m, 6/m, 6/mmm, m−3, m−3m (one fictitious phase each) |
| Orientation | on the lattice (axes on a lattice frame); near it (that frame turned 2–10° about a random axis); generic (uniform at random) |
| Smallest extent | 2–15 nm, log-uniform |
| Ratios | three-extent solids: middle/smallest and largest/middle, 1–6 each, log-uniform; two-extent solids: axis/section 1/6–6, log-uniform (plate to needle); largest extent ≤ 60 nm |
| Sphere diameter | 2–30 nm, log-uniform |
| Counts | strongest line 300–30 000, log-uniform |
| Peak to background | 1–20, log-uniform |
| Microstrain ε | 0–0.3 %, uniform; in the data and refined (in the model, not an error) |
| Model error | none (½), or one of the five below (about ⅒ each), strength 0–1 from the hypercube |

The five model errors are all left out of the refinement:

| Error | Strength 0 → 1 |
|---|---|
| amorphous hump | area 5–40 % of the strongest line; centre and width (FWHM 3–10°) at random |
| size distribution | log-normal in the solid's scale, σ 0.1–0.5, volume-weighted |
| impurity | 1–3 lines, 1–10 % of the strongest line each, at random positions |
| air scatter | a low-angle exponential, 0.5–3× the background at 10° |
| preferred orientation | March–Dollase, r from 0.95 to 0.7 or 1/r, on a random low-index axis |

## The generator

- **Exact line shapes.** The size line of every member is the Fourier transform of the
  solid's own common-volume function A(L) along the member's direction. It is not the
  model's Lorentzian. For most solids A(L) is analytic:
  - box: Π (1 − L|n·eᵢ|/aᵢ);
  - ellipsoid and spheroid: the sphere's 1 − 3x/2 + x³/2, with x = L/D(n) after the affine
    map;
  - cylinder and elliptic cylinder: (1 − L|n·e_axis|/H) × the overlap of two (affine)
    circles.
  - A size distribution averages A(L) over the scales, by volume.
  - Check: 2∫A dL equals the model's ⟨L⟩_V for every solid and direction.
- **Microstrain and the instrument** are convolved as the engine does. The instrument
  comes from a drawn and refined LaB6 standard, as in round 1.
- **The instrument is fixed and strong:**
  - Cu Kα₁ + Kα₂ with a narrow instrumental profile;
  - 10–130° in steps of 0.01°;
  - the pilot may narrow the range if the cost demands it.
- **Background and noise:**
  - background in the model's own family (Chebyshev + 1/2θ);
  - Poisson noise.

## The split

- **Truths:**
  - each solid × Laue cell holds 3 truths, one per orientation;
  - 2 go to tuning and 1 to validation;
  - which orientation goes to validation rotates over the cells.
  - This gives **132 tuning and 66 validation truths** (2/3 and 1/3: the price of balance).
- **Spheres:** 22 and 11.
- **The screening set:** one tuning truth per solid × Laue cell (66) and one sphere per
  class (11): 77 runs.

## Stages

1. **Pilot** (about a dozen runs):
   - the generator checked: the ⟨L⟩_V identity, and A(L) against a direct numerical
     common volume;
   - the bias of the model's Lorentzian on exact lines;
   - the cost of a run in every Laue class.
   - Then cells, range and step are fixed by cost.
2. **Screening** of each variant on the 77-run screening set.
3. **Confirmation** of the promoted variants on the whole tuning part (154 runs).
4. **Validation**, once, on 77 runs.

## Figures of merit

- **Efficiency:** pattern evaluations a run (independent of the machine), then wall time.
- **Reach:** the global minimum (Δ ≤ 1 against the best known).
- **Completeness:** the share of the true minima found, against a dense reference search
  on the tuning part.
- **Accuracy:** each extent's error; each direction's error modulo the phase's and the
  solid's symmetry.
- **The two errors** (local, from the χ² curvature or profile; between the minima): their
  coverage against the 95 % stated, and their width.
- **Solids:**
  - how often the true solid ranks first;
  - which solids are confused, and under which factors.
- **Keep criterion:** real shapes kept, spheres kept.
- **Model errors:**
  - how near the fit stays to the truth;
  - how often the per-line χ²_ν flag fires, with and without an error;
  - whether the jackknife widens enough.
- **Reading the results:** each figure of merit is read against the factors (a regression
  over the design), to see what drives it.

## What round 2 works on (the user's decisions on `FREE-SHAPE.md` §7)

- **The fit's efficiency first.**
  - No covariance in intermediate refinements.
  - Forward differences, with the minimum refined once more by central differences (to be
    weighed).
- **Held frames de-duplicated, with a convention.** Directions are written in the Laue
  class's fundamental zone: in cubic [110], never [1̅1̅0] or [011]. A box's frame is made
  canonical as a whole: the normal first, then the second axis by a fixed rule.
- **Every true minimum refined to the same level.**
  - Symmetry-equivalent and within-resolution duplicates are merged.
  - Each parameter carries two errors, kept apart: the local one (curvature for the
    extents, profile for the angles) and the spread over the true minima within a
    calibrated Δχ².
  - One minimum only means no second error: the shape is unique.
- **Directions.** Extents that cannot be told apart give their directions as an unordered
  set, with the error of the turn about the normal. A turn is lost only where it is a true
  symmetry of the solid (cylinder, spheroid).
- **Why the solids are confused, and how to tell them apart.** Exact line shapes carry
  the information that ⟨L⟩_V alone does not.
- **Symmetry used to cut the starts.** The phase's Laue class gives equivalent starts, and
  the solid's own symmetry does too: a cylinder has two equal axes.
- **The per-line χ²_ν, always checked**, and the jackknife over lines where it fires.
- **The keep criterion:** alternatives to ΔBIC < −10, where the data give a founded doubt.
- **Dropped:**
  - the background degree chosen with the shape;
  - halving of the brief trials.
- **Paused:** alternative morphologies, until the solids can be told apart.
- **Later:** the result card. It will still state whether the shape is supported against
  one size, whether the per-line flag fired, and the size over all directions.
