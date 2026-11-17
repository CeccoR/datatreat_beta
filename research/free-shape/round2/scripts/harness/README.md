# Free-shape harness, round 2

Round 1's harness (`../../fs/harness`) carried over to round 2. It runs on the frozen b9bef5f
engine and is driven by the design (`../design/design.json`) and the generator's patterns
(`../gen`). Round 1 was cubic only; this version works for the eleven phases of `../phases`, one
per Laue class. Each run goes like this:

1. A design row's pattern is refined as the app refines it, up to the shape search: from the CIF,
   with the standard's profile, the row's solid as the size, ADP overall, strain refined.
2. One or more search methods run there, all from the same isotropic fit.
3. Each method is measured: pattern evaluations, wall time, every refinement it made, the solid
   it reports and the free fit behind it. Each is compared with the truth, modulo the class's
   rotations and the body's own symmetry.

Nothing here touches the app's files. Paths are relative to this folder,
`$W/fs2/harness`.
Node 22: `/opt/node22/bin/node`.

## The engine copy

`make-eng.mjs` is round 1's. It copies `../engine` (the git archive of b9bef5f, read-only) into
`eng/` and instruments `xrd-rietveld.js` only (`eng.diff`):

- `phasePattern` counts one pattern evaluation per call;
- `refine` logs each call made while `FS.log` is on;
- autoRefine's call of `freeShape` goes through `opts.shapeHook`;
- the internals are exported as `ENG`: round 1's list, plus `cartOp` and `properOp`.

No arithmetic changes. The anchors were checked unique on b9bef5f.

## What changed from round 1 (`lib.mjs`)

- **No case list.** `runCase({ row, pattern, methods, shape?, fit?, log? })` takes a design row
  (format in `../design/README.md`) and a pattern `{ x, y, varMul?, instr, irf }` (the generator's
  `savePattern` file, or `drawRow` in memory: `patternFor(row, { file, draw, kernel })`).
- **The phase is the row's** (`row.phase`, `../phases/cif`). It is read with `prepPhase` and
  refined with `PHASE_OPTS`: size, lorentz, strain iso, ADP overall, no texture, no occupancy.
  The solid is `shape || row.search`: the truth's own, or the one a sphere row is searched as.
- **The refinement is round 1's.** `autoRefine(model, { standard: false, irf: pattern.irf, fit,
  shapeHook })`, stopped after the shape search. Every method starts from the isotropic fit's
  `model.v`.
- **Searching another solid** (`--shape`, or a second `runCase`) runs autoRefine again: the
  isotropic fit is deterministic, so it is the same fit at the cost of its evaluations again (240
  to 630).
- **The symmetry comes from the engine.** `laueRotations(id)` gives the class's proper rotations
  in the engine's Cartesian frame (`q.Bm`: a* along x, b* in the x–y plane): `q.laue`, the
  group `memberVectors` builds, through `cartOp` (C = B·Rᵀ·B⁻¹), det > 0. Every solid is
  centrosymmetric, so these, with axes taken without sign, cover the Laue group.
  `holoRotations(id)` gives the lattice's holohedry the same way: integer operations, entries
  −1…1, that keep the reciprocal metric.
- **`compareSolids(fit, ref, { rots, loose })`** is round 1's, with the rotations given, and
  one change from the pilot's verification:
  - Dimensions are paired within the body's axis classes (`CLASSES`): by size within a class, by
    role across classes. A box's and an ellipsoid's three extents are one class. A square box,
    cylinder, spheroid and elliptic cylinder have two: the section (x, y) and the height or
    axis (z), as the engine parametrises them. Round 1 paired the spheroid and the square box
    by size: a spheroid fit with its aspect flipped (an oblate truth read prolate) had the
    truth's symmetry axis compared with one of the fit's in-plane axes, which the spheroid
    leaves undefined, so the reported angle followed an arbitrary spin of the fit (32° reported
    for an 89° error on spheroid-P-1-generic). By role, it is the angle between the two
    symmetry axes, and the extents are compared role by role.
  - Axes the ref ties within 4 % are tried in every order (a cube's, a square's) or left out of
    the orientation (a ball's, a round section's, and a spheroid's axis when its two extents
    are within 4 %: a ball).
  - Axes are compared without sign; the best rotation is taken.
  - It returns `dimErr`, `dimMax`, `orient` (the worst defined axis, °) and `principal` (the
    ref's most distinct axis, °).
- **`accuracy(id, fit, ref)`** gives the same modulo the class (`orient`, `principal`) and modulo
  the holohedry (`orientHolo`, `principalHolo`). In 4/m, −3, −3m, 6/m and m−3 they differ when
  the fit is the truth's image under an operation the class lacks: a body the data tell apart
  only through the intensities of reflections at the same d.
- **`canonical(id, solid)`** and **`canonicalDir(id, u)`** give the fundamental zone and the
  canonical frame (the rule below).
- `sameSolid` and `basins` take the phase id: modulo its class.
- **Records** (`writeResult`, `readResult`): an unbounded extent (a width refined to 0) is
  Infinity, and so is its error. JSON writes Infinity as null, which the first pilot report
  then dropped from its medians as if it were a missing value. `writeResult` spells it out
  ("Infinity"); `readResult` reads it back, and reads null in `dims`, `dimErr` and `dimMax` of
  the older records as Infinity.
- `truthOf(row)` gives the truth's solid and its parameters as the model reads them
  (sphere-equivalent widths, the quaternion of R): the truth reference's start.
- `modelPattern(row, …)` is a stand-in pattern drawn with the model's own Lorentzian lines and
  round 1's instrument (`data/irf-r1.json`). It is for the tests only, never for results.

## The canonical form (the rule, as PROTOCOL.md asks)

**A direction** (an axis without sign) is written in the class's fundamental zone:

1. **Its family**, as the engine names directions (`lattDirection`): the simplest lattice row,
   indices up to 4, within 10° (SNAP_DEG), else the nearest. It is taken over all the axis's
   images, so equivalent axes find the same family. The family is written by its first member,
   the engine's: fewest negative indices, then the largest.
2. **Of the axis's images G·u** (G the class's rotations, either sense), the one nearest that
   member.
3. **Ties** (the member's stabiliser) are broken by the same order on the lattice coordinates,
   with coordinates within 10⁻⁷ counting as equal.
4. **The sense** is the one toward the member.

So an axis on a row is the family's first member: in m−3m ⟨110⟩ is [110], never [−1−10] or
[011]; in 4/m [120] and [210] stay two families. An axis a few degrees off a row reads next to
that row's name. The zone is the region nearest the name, not a sector cut along the rows, so a
plate 2° off [100] in 4/m reads [1 −0.03 0.02], not [0.03 1 0.02]. The engine's naming is a
discrete rule with no Dirichlet zone that matches it everywhere; this is the continuous rule
that agrees with it on every row.

**A frame** is made canonical as a whole:

1. **The normal** is the most telling axis, as the engine's held route picks it: the width
   (∝ 1/extent) farthest from the other two. It is a plate's normal or a needle's axis, and the
   axis of a cylinder or spheroid.
2. **The second axis** is the one of larger extent of the other two. If their extents are equal
   (a square's edges, a cube's), each is tried in turn.
3. **Over the class's rotations,** the normal goes where `canonicalDir` puts it. Among the
   rotations that do so equally (its stabiliser, within 10⁻⁹ rad), the second axis decides by
   the lattice row it lies on or nearest: of its family's members, the one nearest G·e, the
   first of those by the direction order; then G·e nearest that row. Remaining ties go by the
   direction order on the normal, then on the second axis. Where the candidates' normals or
   second axes come from different families (a cube's axes, a square's edges), the simpler
   family goes first (Σ indices², then the direction order).
4. **Axes** point toward their rows, or by the order when normal to them. The third axis is the
   cross product that keeps the frame proper, so it can be written as a quaternion.
5. **Slots.** Within each class of interchangeable slots (a box's or an ellipsoid's three, a
   section's two), the normal takes the first, then the second axis, then the third; the
   dimensions go with their axes. A relabelled body (its slots permuted within a class, with
   its extents) has one canonical form. A cube's axes take the principal axis's slot and the
   first other.

**Why rows, not distances.** The first form placed the second axis nearest its family's first
member. Where that member is the normal's own row (⟨100⟩ about [100] in m−3m, ⟨110⟩ about [111]),
every image of the second axis is equally far from it, and a turn of 0.01° chose another image:
5 of the design's 66 'on' frames read a canonical frame 30–90° away when turned 0.01° (the
pilot's verification). Keyed on the row an axis lies on, a lattice frame and the same frame
turned a little read the same; the zone's boundaries lie where an axis is equally near two rows.
One boundary remains at lattice frames: the engine names a direction by the simplest row within
10° (SNAP_DEG), and an axis exactly 10° from such a row changes family with any turn. In these
phases that is a* of P2/m (β = 100°, a* is 10.000° from [100]); `test.mjs` counts and leaves out
the 4 lattice frames it touches.
6. **A cylinder or spheroid** is its axis alone, with x along axis × z_Cartesian (or
   x_Cartesian when the axis is along z).

`canonical` returns `{ axes, R, normal, second, labels, families }`. `labels` are [uvw] where
the axis is within 0.5° of a row with indices up to 12, else its coordinates scaled to the
largest 1.

## Tests (`node test.mjs`: 44 062 checks, 0 failed, 1 min; `--run` adds two runs on stand-in patterns)

1. **The class's rotations.**
   - There are as many as the class has proper operations (1, 2, 4, 4, 8, 3, 6, 6, 12, 12, 24),
     each orthogonal and proper, each inside the holohedry (1, 2, 4, 8, 8, 12, 12, 12, 12, 24, 24).
   - Each takes every member of every reflection onto a member of the same reflection: the
     Cartesian action is the one the engine draws with.
2. **compareSolids.** Per phase and solid, the frames tested are 4 random ones, every lattice
   frame (`lowIndexAxes` × 2 rows of `latticeAcross`), and those turned 3°.
   - A truth turned by every rotation of its class compares to itself with no error. The body's
     own symmetry is applied besides: a 180° turn about an axis; a square's or round section's
     x and y swapped.
     - 9 216 comparisons; the worst is 1.7·10⁻⁶° (rounding);
     - dimensions 10⁻¹².
   - A truth turned 3° reads 0.05–3°.
   - In the merohedral classes, an operation of the holohedry outside the class is an error
     modulo the class (> 0.5° on random frames) and none modulo the holohedry (< 10⁻⁵°).
3. **canonical.**
   - Equal for every frame equivalent by the class's rotations and the body's symmetry: 9 744
     checks, 8 per solid and frame.
   - Idempotent, proper, and the same solid as its input.
4. **canonicalDir.**
   - Each of the 124 directions [uvw] (|indices| ≤ 2) in each phase reads as the engine names
     its family (`lattDirection`).
   - A low-index row turned 2° reads within 2° of that family's first member, under its name.
5. **Pairing by role** (added by the pilot's verification), 40 random frames:
   - a spheroid 16.2 × 16.2 × 7.6 read 8.1 × 8.1 × 28.3 with its axis θ off (0–90°): principal
     and orient are θ, whatever the fit's spin about its own axis (0, 10, 45, 80°), and the
     extents are paired by role;
   - a near-cube square box 6 × 6 × 6.4 read 6.3 × 6.3 × 5.9 with its height θ off: principal
     θ, the height −7.8 %;
   - a spheroid within 4 % of a ball has no defined axis.
6. **canonical near the lattice and relabelled** (added by the pilot's verification):
   - every lattice frame (each low-index axis with its first three normal rows, both ways),
     each solid, turned 10⁻⁶° and 0.01° about 8 random axes: 27 648 turned frames, each within
     twice the turn of the unturned frame's canonical form, slot by slot (worst 7·10⁻⁷° beyond
     the turn); the 4 lattice frames at the engine's naming limit (a* of P2/m) are counted and
     left out;
   - 440 relabelled boxes, ellipsoids, elliptic cylinders and square boxes: the same canonical
     frame and extents, slot by slot.

5. **`--run`, stand-in patterns** (the model's own Lorentzian lines, 10–90° in 0.02°).
   - A box 3×7×12 nm in P4/m at a generic orientation: the baseline and the truth reference end
     at one minimum (χ² 4020.9), the dimensions within 3 % and the orientation 4.0° off.
   - A sphere searched as a cylinder: rejected early (ΔBIC +8).

The tests caught three faults in the canonical form while it was written: tied square edges
placed in different slots; a sense left to the sign of a 10⁻¹⁷ dot product; and acos's 10⁻⁸ rad
at a coincidence, which broke ties. The angles are now atan2(|a × b|, a·b).

## Running

```sh
node run.mjs --list                                   # the design's rows
node run.mjs --row box-P4m-near --method methods/baseline.mjs,methods/truth.mjs --out /tmp/x.json
node run.mjs --row box-P4m-near --draw [--kernel none]   # the pattern drawn in memory (gen/gen.mjs)
node batch.mjs --tag mytag --rows screen|tuning|validation|truths|spheres|all|id,id --method methods/a.mjs,methods/truth.mjs [--jobs 2]
node summary.mjs --tag mytag [--method baseline]      # results/<tag>/summary.md
```

- **`run.mjs`** reads the pattern from `../gen/patterns/<row>.json` (gen/draw.mjs), or `--pattern
  file`, or draws it in memory (`--draw`; `--kernel none`: the engine's own Lorentzian lines, a
  control). `--shape` searches another solid. `--fit` passes the card's fit settings.
  `--nolog` drops the per-refinement log.
- **`batch.mjs`** runs one process per row under `nice -n 15`, 2 at a time by default (3 allowed
  for the pilot when nothing else runs, never more). It writes `results/<tag>/<row>.json`, skips
  those already there, and logs to `results/<tag>/batch.log`. `--rows screen` is the 77-run
  screening set. Score the validation set once, on the final version (PROTOCOL.md).
- **`summary.mjs`** gives, per run and per class and solid: evaluations and seconds of the search
  and of the isotropic fit, the outcome, Δ (the best exact χ² against the lowest any method of
  the run reached, over max(1, χ²_ν)), and the accuracy.

## A method

Round 1's interface: a module whose default export is `{ name, search(model, k, res, free, opts,
ENG, ctx), reference? }`.

- It is called where autoRefine calls `freeShape`, and returns what `freeShape` returns.
- `ctx` is `{ row, id (the phase), shape, iso, rots (the class's rotations), rng, truth }`.
  `truth` (`{ solid, P }`) is given only to a method with `reference: true`.
- `methods/baseline.mjs` is the app's `freeShape`. `methods/truth.mjs` is round 1's reference:
  the solid refined from the truth, with rounded faces, then exact free, then exact held.

## What a record holds (`results/<tag>/<row>.json`)

Round 1's fields:

- the isotropic fit: `iso`;
- `evals`, `ms`, `refines`, `iterations`;
- `kept`, `held`, `rejected`, `early`, `dBIC`;
- `chi2`, `chi2Free`, `chi2Held`, `chi2Best`;
- `solid`, `freeSolid`;
- the log of every `refine()`, its start and its end.

And these:

- `canonical`: the reported solid's canonical frame;
- `acc` and `accFree`: `accuracy()`, modulo the class and the holohedry;
- `accLoose`: the extents paired whatever their class;
- `row`, `phase`, `laue`, `truth`;
- `pattern`: the file or the kernel, and the generator's `info`.

Unbounded extents and their errors are Infinity: records are written with `writeResult` and
read with `readResult` (above). The smoke runs below and round 1's tables predate the pairing
by role.

## Smoke runs (`results/smoke/`; one process each, two at a time, nice 15)

Three runs on generator patterns drawn in memory, each with the baseline and the truth
reference.

| row | lines | isotropic fit | baseline | truth reference |
|---|---|---|---|---|
| box-P4m-near: box 9.1×18.2×60 nm, 2–10° off ⟨101⟩/⟨100⟩, no error | exact | χ²_ν 2.90; 570 ev, 11.9 s | held, ΔBIC −5359, χ² 19 142; 7343 ev, 192 s (26 ms/ev); 12.4×17.4×59.0 (+37 %, −4 %, −2 %), orient 5.8° | free, χ² 19 143; +38 %, −3 %, +6 %, orient 3.8° |
| spheroid-Pm-3m-on: 8.05×8.05×2.25 nm, axis on [110], ε 0.24 %, 2350 counts | exact | χ²_ν 1.226; 240 ev, 3.0 s | rejected early, ΔBIC +9; 1784 ev, 84 s | refined from the truth to a 4.3 nm sphere: χ² 14 695, the isotropic fit's |
| the same row | the engine's (kernel none) | χ²_ν 1.052; 252 ev, 2.1 s | held on [110], ΔBIC −970, χ² 11 586 (χ²_ν 0.966); 8.00×8.00×2.22 (−1 %); 2481 ev, 95 s | the same minimum |

**The harness is right.** With the engine's own lines, the search and the truth reference find
the truth to 1 %. The model at the generator's truth parameters, unrefined, gives χ²_ν 0.967 on
that pattern. So the frames, the widths and the conventions of the harness and the generator
agree.

**On exact lines the spheroid's shape was lost entirely, a result the pilot must look at first.**
The same model at the truth gives χ²_ν 2.84. From the truth, the Lorentzian spheroid refines to
the sphere. The box kept its shape, with the smallest extent read 37 % large. This is the
protocol's "bias of the model's Lorentzian on exact lines", measured on two rows only.

## Files

- `lib.mjs`: the API. `run.mjs`, `batch.mjs`, `summary.mjs`, `test.mjs`.
- `methods/baseline.mjs`, `methods/truth.mjs`.
- `make-eng.mjs`, `eng/`, `eng.diff`.
- `data/irf-r1.json`: round 1's refined LaB6 profile, for the stand-in only. The generator's
  standard is `../gen/data/irf.json`, and every pattern carries its own.
- `results/smoke/`: the runs above and `test-run.log`.
- `tmp/`: debugging scratch.
