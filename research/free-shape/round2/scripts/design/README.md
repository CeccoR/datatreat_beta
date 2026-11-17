# The round-2 design

`make-design.mjs` writes `design.json` (231 rows) and `design.md` (its balance tables and the
hypercube's figures), following `research/free-shape/PROTOCOL.md` ("The design", "The split").
The seeds are fixed: the version `fs2-design-v1` and the master seed 20261026. Paths are
relative to this folder,
`$W/fs2/design`.

**Revision 2 (the pilot's verification, `research/free-shape/round2/PILOT.md`).** The 22 'near'
cylinders and spheroids are turned so that their axis moves by the full tilt (below). The other
209 rows are as they were (their R to 3·10⁻¹⁶: the scaled cells' rounding). The seeds keep the
version, so noise and error draws are unchanged; `design.json` carries `revision: 2`.

```sh
node make-design.mjs      # 40 s, deterministic: design.json, design.md
node check-frames.mjs     # the frames against the search's held route; every row through the generator's normRow
```

## A row (the format agreed with the generator, `../gen/gen.mjs` normRow, and the harness, `../harness/lib.mjs` runCase)

| field | |
|---|---|
| `id` | `<solid>-<phase>-<orient>` (`box-P4m-near`) or `sphere-<phase>-<k>` |
| `kind` | `truth` or `sphere` |
| `phase`, `laue` | the phase id of `../phases/cif` (P-1 … Pm-3m) and its class |
| `solid` | box, sqbox, cylinder, ellcyl, ellipsoid, spheroid, or sphere |
| `search` | the solid the search fits: the truth's own; for a sphere, one of the six (6, 6, 6, 5, 5, 5) |
| `orient` | on, near, generic (null for spheres) |
| `dims` | nm along the body's own axes x, y, z (the engine's: sqbox, cylinder, spheroid have x = y and z the axis; ellcyl x, y the section, z the height); a sphere's [D, D, D], and `D` |
| `R` | 3×3 row-major, its columns the body axes in the engine's Cartesian frame (`memberVectors`: a* along x, b* in the a*–b* plane, z along c); full precision, proper; null for spheres |
| `frame` | for on/near: `first`, `firstAxis` (the lattice row and the body axis on it), `second`, `secondAxis`; for near also `R0` (the frame it was turned from), `tiltDeg`, `tiltAxis` |
| `counts` | the phase's highest point above the background |
| `pb` | peak to background there |
| `eps` | microstrain ε, a fraction |
| `error` | null, or `{ kind: hump / sizedist / impurity / air / po, strength 0–1 }`; the generator draws the rest (centre, width, lines, axis…) from the row's seed, by its README's table |
| `split`, `screen` | tuning or validation; whether in the 77-run screening set |
| `seed` | hash(version, id): the noise and the error's draws |
| `lhs` | the row's coordinates in the unit hypercube (truths: smallest, ratio1, ratio2, counts, pb, eps, strength; spheres: D, counts, pb, eps, strength) |
| `ratios` / `ratio` | three-extent solids: middle/smallest, largest/middle; two-extent: axis/section |
| `heightRank` | ellcyl only: which extent is the height (smallest, middle, largest: 11 each) |

`check-frames.mjs` passes every one of the 231 rows through the generator's `normRow`.

## How it is built

**The rows.**
- Truths: 6 solids × 11 classes × 3 orientations = 198, each combination once.
- Spheres: 3 per class = 33.

**The split.**
- In each solid × class cell the orientation sent to validation is (11·solid + class) mod 3, and
  the other two go to tuning. Validation thus takes each orientation 22 times: twice per class,
  3–4 times per solid.
- The screening set is the tuning truth of orientation (validation + 1) mod 3 in each cell
  (66), plus per class the sphere after the validation one (11), so 77 runs.
- Spheres: validation is sphere (class mod 3), so 22 tuning and 11 validation.
- Totals: tuning 154 (132 + 22), validation 77 (66 + 11), screening 77.

**The model error.**
- **Truths:** 99 none, and hump 20, sizedist 20, impurity 20, air 20, po 19, placed by
  annealing on swaps. The objective is the squared deviation of every count from its
  proportional share, over solid, class, orientation, the split (tuning in the screening set,
  tuning outside it, validation) and solid × split.
- **Spheres:** 16 of 33 with an error (as near half as balance allows), balanced over class and
  split. The kinds among them are 4, 3, 3, 3, 3. Each sphere's searched solid is balanced over
  split and error.

**The continuous factors: one sliced maximin Latin hypercube.**
- **Truths:** 198 rows, 7 columns. Each column holds the 198 centred levels (k + ½)/198. They are
  dealt so that each slice covers (0, 1) as its own Latin hypercube would: each solid's 33 rows
  in the first six columns, and each error kind's rows (and the error-free ones) in the
  strength column.
- **Near Latin within a slice, not exactly.** A slice's rows are dealt near (m + U)/n_s and
  then take the global levels (k + ½)/198 in that order. Slices of equal size (the six solids,
  33 each) get one level in each of their own 1/33 bins. The error kinds' slices are unequal
  (99, 20, 20, 20, 20, 19), and two of them miss one of their own bins: sizedist and po have
  one empty 1/n bin each (and one bin with two). `design.md` lists them.
- **The annealing** (400 000 swaps, only within a slice) minimises ln φ₅₀/50 + 20·Σρ².
  - φ₅₀ is Morris–Mitchell's: (Σ d⁻⁵⁰)^(1/50), a smooth maximin.
  - ρ is the columns' correlations, the strength's over the rows with an error only.
- **Spheres:** their own hypercube, 33 rows and 5 columns (D, counts, pb, eps, strength), the
  strength sliced by error.
- **Mapping to the factors:**
  - smallest extent 2·7.5ᵘ nm (2–15, log-uniform);
  - three-extent solids: middle/smallest 6ᵘ, largest/middle 6ᵘ;
  - two-extent solids: axis/section 6^(2u − 1), from 1/6 (plate) to 6 (needle), with the smaller
    of section and axis being the smallest extent;
  - counts 300·100ᵘ;
  - peak to background 20ᵘ;
  - ε 0.003·u;
  - strength u;
  - sphere D 2·15ᵘ nm.
- **Largest extent ≤ 60 nm.** Where it would pass, both log-ratios are shrunk in proportion (30
  of 198 truths). Their ratios' marginal is then no longer exactly log-uniform at the top, and
  the cap correlates the factors as drawn: the larger the smallest extent, the less room for
  anisotropy (below).
- **Elliptic cylinders:** the height is the smallest, middle or largest extent by (class +
  orientation) mod 3, 11 each.

**Orientation.** Each truth has its own stream (hash of version, 'frame' and id).
- **'on':** the body's most telling axis (the engine's rule: the width farthest from the other
  two) is put exactly on one of the phase's `lowIndexAxes`. For a body with three turns, one of
  the other two axes goes on one of the three simplest lattice rows exactly normal to it
  (`latticeAcross(q, e, null, 0.01, 64)`). The first axis is drawn among those that have such
  a row. The third axis completes a proper frame. These are the frames the search's held route
  tries. In P−1 they are [100] ⟂ [010] only (γ = 90°, `../phases/README.md`).
- **'near':** such a frame turned 2–10° (uniform) about a uniform random axis. A cylinder or
  spheroid is its axis alone, so it is turned about the random axis's part normal to its own
  axis, and its axis moves by the full 2–10°. (The first draw turned it about the random axis
  itself: a turn about an axis near its own barely moves it, and 3 of the 22 moved under 2°,
  1.27–1.53°. The pilot's verification found it; the 22 rows were drawn again, the rest are
  unchanged.)
- **'generic':** a uniform random rotation (the quaternion of four normal deviates).

## The balance (`design.md` has every table)

**Model error × solid** (truths)

| solid | none | hump | sizedist | impurity | air | po |
|---|---|---|---|---|---|---|
| box | 16 | 3 | 3 | 4 | 4 | 3 |
| sqbox | 17 | 3 | 3 | 4 | 3 | 3 |
| cylinder | 17 | 4 | 3 | 3 | 3 | 3 |
| ellcyl | 17 | 3 | 4 | 3 | 3 | 3 |
| ellipsoid | 16 | 3 | 3 | 3 | 4 | 4 |
| spheroid | 16 | 4 | 4 | 3 | 3 | 3 |

**Model error × class.** Every class has 9 none and 9 errors. The kinds per class are 1–2 each,
except −3m with 3 po (2, 1, 2, 1, 3).

**Model error × orientation:** 33 none per orientation, and 6–7 of each kind.

**Model error × split**

| | none | hump | sizedist | impurity | air | po |
|---|---|---|---|---|---|---|
| tuning, screening | 33 | 7 | 7 | 7 | 6 | 6 |
| tuning, other | 33 | 6 | 7 | 7 | 7 | 6 |
| validation | 33 | 7 | 6 | 6 | 7 | 7 |

**Orientation × split:** 22 in each of the nine cells.

**Spheres**

- With an error: 5 or 6 in each of the three split groups. Every class has 1 or 2.
- Searched as each solid: 1–2 in each split group.

## The hypercube (`design.json` lhs; `design.md`)

- **Truths.**
  - The minimum distance between two of the 198 points in the 7-D unit cube is 0.480. The same
    sliced structure before annealing gives 0.199 (the median of 20 draws).
  - On the cube's coordinates, the largest correlation between two columns is 0.0031 (pb ×
    strength, over the 99 rows with an error). The first six columns' correlations, over all
    198 rows, are smaller.
  - On the factors as drawn the cap shows (`design.md`):
    - ρ(ln smallest, ln largest/smallest) = −0.125 over the 198 truths;
    - for the three-extent solids, ρ(ln smallest, ln middle/smallest) = −0.119 and
      ρ(ln smallest, ln largest/middle) = −0.162;
    - mean ln(largest/smallest) by tercile of the smallest extent: 1.36, 1.29, 1.13 (3, 9 and
      18 of each tercile's truths at the cap).
    - Every other pair of drawn factors is under |ρ| 0.07.
    - A regression over the design should carry both the smallest extent and the anisotropy:
      their effects are not separable from the margins alone.
- **Spheres.**
  - The minimum distance is 0.476 (0.225 unannealed).
  - The largest correlation is 0.0058 (pb × strength, over the 16 spheres with an error).
- **Per solid** (min, median, max):
  - smallest extent 2.0–2.1, 5.3–5.6, 14–15 nm;
  - counts 304–341, 2831–3180, 26 398–29 653;
  - pb 1.01–1.09, 4.3–4.6, 18–20;
  - ε 0.001–0.008, 0.146–0.154, 0.292–0.299 %.
- **Plates and needles:** among the two-extent solids, 50 plates and 49 needles.
- **Near-isotropic truths:** 8 have largest/smallest under 1.15, for instance
  spheroid-P4mmm-generic, 7.91 × 7.91 × 7.70 nm. The ratio's range starts at 1, and these
  are kept: they are the design's near-isotropic truths.

## The frames against the search (`node check-frames.mjs`)

`check-frames.mjs` copies the engine's held route, freeShapeRun's `snaps` (b9bef5f, as it is),
and applies it to each truth's own frame and widths:

- **'on':** 66 of 66 truths have their frame among the held frames, exactly (10⁻⁵°). The first
  axis lies on its row to 10⁻⁵°.
- **'near':** 66 of 66 truths have the frame they were turned from among the frames held from
  them. The nearest held frame is 6.22° away (median), 9.88° at most. These truths are the held
  route's trap: it can hold a frame 2–10° off the truth. The 22 cylinders' and spheroids' axes
  are turned by their full tilt, 2.00–9.81°.
- **'generic':** the nearest held frame is 8.31° away (median), 45° at most. 12 of 65 have no
  held frame at all. Every one of them has an axis within 10° of a lattice row. The held route
  snaps the most telling of those axes (the width farthest from the other two, not the one
  nearest a row), and that row has no lattice row exactly normal to it (`latticeAcross`
  empty), so no second axis can be set. Examples:
  - box-P-3-generic snaps to ⟨322⟩, 1.86° off;
  - ellcyl-P-1-generic snaps to [311], 0.49° off;
  - ellipsoid-P6mmm-generic snaps to ⟨431⟩, 6.5° off, though another axis is 0.9° from ⟨112⟩.

  The 12 are mostly in −1, 2/m and mmm, with one each in −3 and 6/mmm. One more generic truth,
  an almost-spherical spheroid, has no defined axis. (The first README said the 12 had no axis
  within 10° of a row; the count was right, the cause was not.)
- Every R is a proper rotation (10⁻⁹), and every tilt is within 2–10°.

## Renewing the validation set

PROTOCOL.md says a validation set is spent once anything changes after it is scored. To draw a
new one, change `VERSION` in `make-design.mjs` (new seeds for every row: noise, errors' draws,
frames) or `SEED` (a new hypercube and new error placement), and run it again.
