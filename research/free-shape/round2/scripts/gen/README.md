# Round-2 generator

Draws one powder pattern from one truth (one row of the design), with the exact size line of
every member (PROTOCOL.md, "The generator"). Paths are relative to this folder,
`$W/fs2/gen`.
Node 22: `/opt/node22/bin/node`.

## Set by the pilot (2026-10-26), and its verification

- **Grid.** Round 2 draws on **10–110° in 0.01° steps**: `GRID` here, the default of every caller
  (`draw.mjs`, `../harness/run.mjs --draw`, `../pilot/run.mjs`). The pilot set cells and range by
  cost (`research/free-shape/round2/PILOT.md`); its first choice, 10–100° with only P−1, P2/m
  and Pmmm scaled, was set aside after its verification. The standard keeps the 10–130° it was
  drawn and refined on (`STD_GRID`; `data/irf.json` unchanged).
- **Cells.** Every phase is scaled by 0.8 in every length (`../phases/README.md`).
- **Errors' areas within the range.** The hump's and each impurity line's area are now their
  stated share of the strongest line within the pattern, as the strongest line's own area is
  measured. Before, the hump's pseudo-Voigt carried the stated area over its whole profile, of
  which 86–99 % fell inside 10–100° (realised 5.8–37.9 % for 5–40 % stated). Each impurity line
  was drawn by the engine's `addPeak`, cut at ±40 FWHM and lowered at its edge, and kept 98.5 %
  of its area. Now the hump is scaled to its area over the grid, and each impurity line is
  drawn over the whole pattern and scaled likewise (`../pilot/fix/errors-check.mjs`: all 24 hump
  and 23 impurity rows within 10⁻¹⁴ of the stated share).
- **The corrections' window** is the engine's WPPM window, as before, and the README now says
  what it does (Windows, below). The pilot's verification measured it.
- `checks.mjs` was run again on the final cells and grid (`results/checks.json`; the first cells'
  run is `results/checks-v1.json`). All pass: the ⟨L⟩_V identity ≤ 4.6·10⁻¹², Monte Carlo |z| ≤
  2.37, the Lorentzian limit ≤ 3.1·10⁻¹², the plumbing 0.12–0.27 % of the peak (0.06–0.15 %
  with a Lorentzian instrument), the errors at their spec, 0.15–0.25 s a pattern.

## Files

- `make-eng.mjs` builds `eng/` from the frozen engine (`../engine`, b9bef5f) and writes
  `eng.diff`. One hook is added to `xrd-rietveld.js`, and nothing else changes: after each line the
  engine draws with a Lorentzian size width, `model.sizeHook(out, line)` is called if set. The
  two such lines are a free-shape member in `shapeLine` and an isotropic line with Ys > 0 (the
  sphere). Internals are exported as `ENG`. Without the hook the engine is the frozen one.
- `kernels.mjs` holds the exact common-volume functions A(L), the log-normal average, and an
  independent Monte Carlo common volume (`mcCommon`). It does not import the engine.
- `gen.mjs` is the generator: the instrument, the standard, the rows, the errors, `drawRow`
  and `savePattern`.
- `draw.mjs` draws a design batch (CLI). `checks.mjs` runs the checks into `results/checks.json`
  (log: `results/checks.log`).
- `data/irf.json` is the refined standard's profile (cached). `tmp/` holds scratch.

## The route: the engine's line plus the exact line's difference

Each member is drawn by the engine as it is, at the truth's parameters, with its Lorentzian size
width. The hook then adds, at that member's own line (Kα1 or Kα2, its axial nodes, its window),
the difference between the exact size line and that Lorentzian. Both are convolved with the rest
of the line:

```text
line = pV_TCH(HG, HL_rest + Γ)  +  I · F⁻¹[ pV_rest(L) · (A(L) − e^{−πΓL}) · Σ_k w_k e^{−2πiLδ_k} ]
```

- The second term is synthesised in d* = 2 sinθ/λ, where a size line is symmetric. It is read at
  each 2θ through the exact map, by the engine's own WPPM synthesis (`xrd-broad.js` `wppmLine`).
- pV_rest is the engine's TCH pseudo-Voigt of the same line without its size width: the
  instrument and the microstrain (X + Xs) tanθ.
- Γ = 0.675/⟨L⟩_V (Å⁻¹) is the engine's size FWHM in d*, from the engine's own member width:
  w·(π/180)/λ₁, the same for Kα1 and Kα2.
- A(L) is the solid's own common-volume function along the member (`kernels.mjs`).

The correction has zero area (A(0) = 1), so the exact line keeps the Lorentzian's area. With
A(L) = e^{−πΓL} the correction is zero, and the pattern is the engine's calc. The only difference
from the engine is therefore the size line's shape, in d*.

**Why not convolve the exact line into a size-free line.** The engine's line is a TCH
pseudo-Voigt, not a convolution, so its size part cannot be divided out: the Gaussian part times
e^{+πΓL} grows to e^{160} at a sphere's support, whatever its size. Drawing pV_rest ⊗ S alone instead
would differ from the engine's TCH line by TCH's own error, 0.2 % of the peak (check 4). That
difference would then be a model error that has nothing to do with the shape.

**Windows.** Every line the engine draws is drawn over the whole pattern (`model.noise0` =
10⁻³⁰): its tails are whole, and the phase's pattern is linear in its scale, which is set
afterwards. Lines listed beyond the range reach in with their tails, as in the engine. The
correction is not: it is synthesised by FFT as the engine's WPPM lines are, over ±max(40 FWHM,
the line's half-window), and lowered by its value at the window's edge. (The first README said
its tails were whole; the verification showed they are not.) Against a direct synthesis with no
window and no lowering (`../pilot/fix/pattern110.mjs`, six rows, 10–110°):
- the drawn correction is off by at most 5·10⁻⁴ of the peak, 3·10⁻⁴ once the background's own
  family (quadratic + 1/2θ) is taken out, for corrections of 5–18 % of the peak;
- for the broadest lines (a 3 nm sphere) part of it is a smooth offset, +2.6·10⁻⁴ of the peak on
  average, from the FFT's period (the folded tails, less the edge value), not from the 40-FWHM
  window: drawing the correction over the whole pattern (`whole: true`) moved it by under
  5·10⁻⁶ of the peak.

At 30 000 counts that is 8–15 counts, against a background of at least 1 500 counts (σ ≥ 39),
mostly taken up by the background. The data are the exact lines to that level.

## Conventions (the engine's, RIETVELD.md §10.2–10.3)

- **dims** are in nm, along the body's own axes x, y, z:
  - box: its edges;
  - ellipsoid: its full axes;
  - cylinder: its diameter (x = y) and height (z, the axis);
  - elliptic cylinder: its two full section axes (x, y) and height (z);
  - sqbox, spheroid and cylinder have dims[0] = dims[1], or give two values [x = y, z];
  - sphere: D (as dims, [D], or `row.D`).
- **W** (°) is the width of a sphere of that dimension: Kλ₁/D·(180/π), K = 0.9.
- **R** maps body to Cartesian: its columns are the body axes in the engine's Cartesian frame
  (`memberVectors`: x ∥ a*, y in the a*–b* plane, z ∥ c). A member's direction u is m = Rᵀu in
  the body. An improper R (det −1) has its z column turned over; every solid is
  centrosymmetric. `phaseFrame(phase)` gives the frame:
  - `Bm`, with reflection hkl at Bm·h;
  - `Am`, with lattice direction [uvw] at Am·uvw;
  - `laue`.

  Checked on the triclinic cell: |a|, |b|, |c|, α, β, γ come back exact, and a·(B·(001)) = 3·10⁻¹⁷.
- **A(L)** (A(0) = 1, zero past the support):

  | Solid | A(L) |
  |---|---|
  | box | Π(1 − L\|mᵢ\|/aᵢ)₊ |
  | ellipsoid, spheroid, sphere | 1 − 3x/2 + x³/2, with x = L·\|diag(1/D)m\| |
  | cylinder, elliptic cylinder | (1 − L\|m_z\|/H)₊ · (2/π)(acos ρ − ρ√(1−ρ²)), with ρ = L·\|(m_x/D_x, m_y/D_y)\| (two affine unit-diameter discs, overlap over the disc's area) |

  2∫A dL = ⟨L⟩_V, the engine's `columnLengthV` reading.
- **Size distribution.** A_dist(L) = E_V[A(L/s)], with ln s ~ N(−σ²/2, σ²) by volume. The
  number-weighted median is e^{−3.5σ²}: the engine's WPPM reading (`wppmLineOf`, toMedian). The
  dims are then the volume-weighted mean crystallite's, and ⟨L⟩_V (the integral breadth) is the
  dims' in every direction: σ changes the shape alone. The average is a 281-point trapezoid in
  z over ±7, tabulated on 800 points of L and read by Catmull–Rom interpolation.
- **Microstrain.** The engine's Xs = 4ε·(180/π), with ε as a fraction (`row.eps`, or
  `row.strain` in %). It is in the data and in the model.
- **Scale.** The phase's highest point above the background equals `counts`.
- **Background.** B·(0.9 − 0.15u + 0.2u² + 4°/2θ), with u = (2θ − 70°)/60°. That is a quadratic in
  2θ plus 1/2θ, inside the model's family on any range. B is set so the background under that
  highest point is counts/pb. Its coefficients on the model's own basis for the grid are in
  `truth.P` (bg0, bg1, bg2, bgInv).
- **Sample state.** Cell and atoms as the CIF has them, ΔB 0, displacement 0. The instrument is
  the refined standard's (below).
- **Noise.** Poisson, seeded by hash(row.id) and row.seed. The errors' random draws use a
  separate stream from the same two.

## The instrument (fixed) and the standard

- **Geometry.** Cu Kα1/Kα2 (λ 1.540598/1.544426 Å, ratio 0.5), Bragg–Brentano with R 240 mm.
  Sollers are 0.02 rad on both sides (round 1: 0.04), the line focus 12 mm, sample and receiver
  15 mm long axially (the Soller model, §3.7.1). Caglioti U 0.0012, V −0.0008, W 0.0006 °²;
  X 0.006, Y 0.012 °.
- **Why these values.** They are about what a fine-slit lab diffractometer with a strip detector
  gives on LaB6. The FWHM of the refined profile is 0.030° at 20–40°, 0.034° at 60°, 0.045° at
  90° and 0.089° at 130° (η 0.53–0.60), 0.01–0.03° narrower than round 1's. The samples'
  narrowest size lines (a 60 nm extent along the diffraction vector) are 0.10°/cosθ wide. That is
  three times the instrument's width at low angles, so the size dominates every line, and it
  gives at least 12 points per FWHM at the 0.01° step.
- **Grid.** 10–110° in 0.01° steps (10 001 points; `GRID`, or a `grid` option): the pilot's
  decision. The standard is drawn on 10–130° (`STD_GRID`).
- **The standard.** As in round 1 (`standardIrf`, cached in `data/irf.json`):
  - LaB6 (the card's built-in CIF) drawn with that truth (zero 0.008°, sin 2θ shift −0.0171°) on
    the grid, 15 000 counts at its strongest line on 150, with Poisson noise;
  - refined by `autoRefine({ standard: true })` in 1.95 s, to χ²_ν 0.991 and Rwp 7.1 %;
  - refined values against the truth: U 0.00109 (0.0012), V −0.00073 (−0.0008), W 0.00058
    (0.0006), X 0.0066 (0.006), Y 0.0120 (0.012), axL 14.4 (15) mm, zero 0.0075° (0.008°),
    sin 2θ shift −0.01717° (−0.0171°).

  The samples are drawn with that refined profile, the one autoRefine holds on them.

## Model errors (all left out of the refinement)

The strength s runs from 0 to 1 and maps linearly onto PROTOCOL.md's range. A field the row's
`error` gives is used as given; otherwise it is drawn from the row's error stream. The realised
draws are in `truth.error`.

| kind | drawn |
|---|---|
| `hump` | area (5 + 35 s) % of the strongest line's (α1 + α2, as drawn), both within the range; centre uniform from lo + 5° to the range's middle (15–60°); FWHM 3–10° uniform; pseudo-Voigt with η 0.5, scaled to that area over the grid |
| `sizedist` | σ = 0.1 + 0.4 s, volume-weighted, ⟨L⟩_V kept (above) |
| `impurity` | 1–3 lines (uniform), each (1 + 9 s) % of the strongest line's area within the range, uniform over lo + 2° … hi − 2°; each a Kα1/Kα2 pair with the instrument's profile and a 100 nm Lorentzian size, no axial asymmetry, drawn over the whole pattern and scaled to that area over the grid |
| `air` | (0.5 + 2.5 s) × the background at the range's start, decaying as e^{−(2θ − lo)/τ}, τ 2–6° uniform |
| `po` | March–Dollase r = 0.95 − 0.25 s, or 1/r for half the draws (needles), on an axis drawn uniformly among the phase's distinct Laue families of the seven low-index planes (cubic: 100, 110, 111); drawn with the engine's own member weights (phase option po, `p1.PO`) |

"The strongest line" is the reflection with the largest integrated intensity. Its α1 + α2
area is integrated over the grid as drawn (`info.strongest`).

## API

```js
import { drawRow, normRow, standardIrf, phaseFrame, savePattern, cifPath, INSTR, GRID } from './gen.mjs';
const pat = drawRow(row, { kernel: 'exact', grid: GRID, noise: true });
// → { id, x, y, yc, parts: { phase, bg, error }, instr, irf,
//     truth: { P (engine names: the profile, p1.Xs, the solid's W/Q or Ys, p1.PO, p1.scale, bg0..2, bgInv),
//              solid: { type, dims (nm), axes (R's columns), W, Q }, error (its draws), row },
//     info: { S, peak2t, peak, bgAtPeak, strongest: { hkl, tt, area }, nRefl, nMembers, ms, kernel } }
savePattern('patterns/' + row.id + '.json', pat);   // x, y, instr, irf, truth, info
```

- **row** (`normRow` accepts both forms the parallel agents use):
  - `id`, `seed`;
  - `solid`: box | sqbox | cylinder | ellcyl | ellipsoid | spheroid | sphere;
  - `dims` (nm; a sphere's `D`) and `R` (nested or flat row-major);
  - `phase`: a phase id of `../phases/cif` ('P-1') or a CIF path;
  - `counts` (or `peak`) and `pb` (or `p2b`);
  - `eps` (a fraction) or `strain` (%);
  - `error`: `{ kind, strength, … }`, null, or `{ kind: 'none' }`.
- **pattern for the harness.** `{ x, y, instr, irf }` is what `../harness/lib.mjs` `runCase`
  takes as `pattern`.
- **kernel option:**
  - `'exact'` (default);
  - `'lorentz'`: e^{−0.675πL/⟨L⟩_V}, with ⟨L⟩_V from the kernels (the limit check);
  - `'none'`: the engine's calc. `sub: true` draws only the subtracted term into `parts.sub`
    (the plumbing check).
- **kernels.mjs:**
  - `body(type, dimsÅ, R, σ)`;
  - `along(body, n)` → { A(L), T, m };
  - `kernel(body, n)` → { A(L), T, Lv }, with the distribution;
  - `mcCommon(type, D, m, L, N, U)`.
- **Batch:** `nice -n 15 node draw.mjs --design ../design/design.json --out patterns [--ids a,b]
  [--part i/n]`. One JSON per row; existing files are skipped.

## Checks (`node checks.mjs`, 47 s; numbers from `results/checks.json`)

1. **⟨L⟩_V identity.** 2∫A dL (64×16-node Gauss–Legendre) against the engine's own ⟨L⟩_V, at 50
   random directions per solid, for random dims in the design's ranges and a random R. The
   engine side is `shapeWidths`, through the W parameters and the quaternion of R, as a fit
   would hold them: ⟨L⟩_V = 0.75·Kλ₁·(180/π)/w.
   - Max relative error: box, sqbox, ellipsoid, spheroid, sphere 3·10⁻¹⁵; cylinder and elliptic
     cylinder 5·10⁻¹² (quadrature against the closed form).
   - With σ 0.5, ⟨L⟩_V of the averaged A against the dims': at most 2.9·10⁻⁵ (the table's
     interpolation).
2. **A(L) against Monte Carlo.** `mcCommon` draws 4·10⁵ points uniformly in the body, from its
   own inside test in the body frame, and counts those whose translate by L·m stays inside. It
   ran at 3 random directions × L = 0.15, 0.4, 0.7 of the support, per solid.
   - Agreement within the noise: |z| at most 2.37 over the 63 points (max |ΔA| 0.0015, the
     Monte Carlo's σ about 0.0008).
   - The log-normal table (σ 0.4) against a Monte Carlo average over 2·10⁵ sizes, at 5 L: within
     7·10⁻⁴, the average's own noise.
3. **Lorentzian limit.** Kernel `'lorentz'` against the engine's calc (`'none'`), max |Δ| over the
   phase's peak at scale 1. All seven solids at random dims and R, on the cubic (Pm-3m) and the
   triclinic (P-1) cell:
   - 7·10⁻¹⁶ or less; cylinders 3·10⁻¹² (the quadrature).
   - The exact lines on the same rows differ from the engine's by 13–19 % of the peak (max |Δ|):
     the shape the protocol puts in the data.
4. **Plumbing.** The subtracted term alone, synthesised in d* with the engine's areas, positions,
   nodes and λ, against the engine's own lines, on a box 10×15×25 and 3×4×6 nm on Pm-3m and P-1.
   It catches a wrong intensity, position or node in the correction, which the limit check
   cannot (zero times anything is zero).
   - Max |Δ| over the peak: 0.12–0.27 % with the instrument (TCH against a true convolution,
     and the 2θ against the d* map; 0.16–0.22 % on 10–130° before the cells were scaled).
   - 0.06–0.15 % with a Lorentzian instrument (U = V = W = 0: the d* map and the axial wings
     alone).
5. **Integral breadth of a drawn size line.** One member per solid, drawn by the same synthesis
   at 60° with no instrument (H 10⁻⁶ °), on a grid of Γ/40 over ±55°.
   - The area over the peak, in d*, times ⟨L⟩_V: 1.000 for every solid when the area is the
     line's whole (1).
   - 0.986–0.998 with the area integrated over the ±55° window. The rest is the Porod tails
     beyond it, 0.2–1.4 % for 2–21 nm.
6. **Errors**, each on one drawn pattern (box 5×9×16 nm, Pm-3m, s = 0.5):
   - hump: area 22.5 % of the strongest line within the range (spec 22.5 %; 93.1 % of the whole
     pseudo-Voigt lies inside, the centre being 17.2°); FWHM 5.95° (drawn 5.94°).
   - sizedist (σ 0.3): the strongest line's integral breadth unchanged (ratio 1.00), its FWHM
     0.97 of the single size's (the top sharper).
   - impurity: one line at 52.3°, 5.50 % over the range (spec 5.5 %; 99.9 % of its whole profile
     inside).
   - air: 1.75× the background at 10° (spec 1.75).
   - po (r 1.21 on [110]): every reflection's intensity ratio with/without equals the March–Dollase
     average over its members, computed here from the phase's frame (max relative difference
     4·10⁻¹⁶). On a cubic phase the family totals move only 0.987–1.02. The members' own weights
     span r⁻³ to r^{1.5} (0.56–1.33), which the free shape sees member by member.
7. **Time per pattern.** One box at random per Laue class, exact lines, noise; one process,
   nice 15, this 4-vCPU machine.
   - 0.15–0.25 s (60–73 members, 10–110°); 0.42–0.63 s with a size distribution (σ 0.5). On
     the first cells and 10–130° (170–187 members): 0.43–0.71 s and 1.2–1.5 s.
   - The phase's least value is (0.4–57)·10⁻⁴ of its peak: never negative. The extremes (a 2 nm
     sphere, a 2×12×60 nm box, a 60×2 nm disc) also stay positive.
   - 231 patterns (198 truths + 33 spheres) take about 1 min (2.5 min on the first cells).

## Not checked or left as is

- The exact line is symmetric in d*. The engine's own Lorentzian is symmetric in 2θ. The
  correction is the difference of two d* lines, so the generated line is the engine's line plus
  (exact − Lorentzian) in d*: it is not the d*-symmetric exact line when the size is very small.
  The difference of maps is in the subtracted term, 0.1 % of the peak at 3 nm (check 4).
- The impurity lines are drawn without the axial divergence's asymmetry.
- The background's shape is fixed; its level follows pb.
- The design's row format was not yet written when this was built. `normRow` takes both the
  task's row form and the harness's (phase id, eps, D). Agree on it when `../design` appears.
