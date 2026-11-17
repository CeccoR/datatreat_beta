# The phases of round 2

Eleven fictitious phases, one per Laue class, for the synthetic tests of the free shape
(`research/free-shape/PROTOCOL.md`). They are kept simple and cheap: a small primitive cell,
Zn at the origin and O on one site. Paths below are relative to this folder,
`$W/fs2/phases`.
Node 22: `/opt/node22/bin/node`. The engine is the frozen b9bef5f copy, through
`../harness/eng` (instrumented only; `../harness/make-eng.mjs`).

## Changed by the pilot (2026-10-26) and its verification

The pilot (`../pilot`, `research/free-shape/round2/PILOT.md`) set cells and range by cost.
**Every cell is scaled by 0.8 in every length** (`scale` in `make-phases.mjs`; angles and
fractional coordinates kept), and round 2 runs on **10–110°**. The members in range stay equal
across the classes, as the first cells were built for: 60–73 in 10–110° (P−1 70, P2/m 71, Pmmm
68, P4/m 67, P4/mmm 68, −3 61, −3m 67, 6/m 69, 6/mmm 60, m−3 73, m−3m 73).

The pilot's first decision scaled only P−1, P2/m and Pmmm, with 10–100°. Its verification set
it aside: it left those three with 53–58 members against 101–112 for the others, which ties the
Laue class to the member count in any reading over the design, and it cost more (PILOT.md §5).
The first cells are in `cif-v1/` (`phases-v1.json`, `phases-nofit-v1.json`, `check-v1.log`), the
first decision's in `cif-c3/` (`phases-c3.json`, `phases-nofit-c3.json`, `check-c3.log`).
`phases.json` and `check.log` are the checks on the final cells. All pass:
- every phase reads to its intended group and class, with the class's order of operations;
- members = mult/2 for every reflection;
- no pair of distinct reflections closer than 0.0109° in 10–130° (P−1 at 94°; then P2/m 0.021°,
  the rest 0.19° or more);
- the isotropic fits from the CIF (10 nm, ε 0.1 %): χ²_ν 0.971–1.030, D 9.89–10.14 nm, the cells
  within 7·10⁻⁵.

Volumes are 26.6–28.4 Å³. The shortest distances are 1.15–2.62 Å: 6/m's O–O is 1.15 Å, under
the 1.4 Å the first cells kept. The phases are fictitious and the engine takes no notice; it is
noted, not changed. The tables below are the first cells' unless the row says otherwise.

## The rule

- **One P group per class**, symmorphic: P−1, P2/m (b unique), Pmmm, P4/m, P4/mmm, P−3, P−3m1,
  P6/m, P6/mmm, Pm−3, Pm−3m. The CIFs write every operator out (the point group's matrices in
  the cell's basis, closed from a few generators by `make-phases.mjs`).
- **Zn at the origin, one per cell.** No finer lattice can be found.
- **O on one site whose orbit has exactly the class's symmetry.** The engine does not take the
  file's operators as the symmetry: `prepPhase` finds it from the atoms (`structureCell`). Zn
  alone would give the lattice's holohedry. So in the five merohedral classes the O site breaks
  the holohedry:
  - 4/m: 4k (x, y, ½);
  - −3: 6g (x, y, z);
  - −3m: 2d (⅓, ⅔, z);
  - 6/m: 6k (x, y, ½);
  - m−3: 6f (x, 0, ½).

  The other classes have O on a special site (P−1 2i, P2/m 2m, the rest the body centre or
  2d of P6/mmm). The coordinates were chosen on a small grid with two aims: shortest distances
  not absurd (1.4–3.3 Å), and a strong difference between the reflections that the holohedry
  makes equivalent but the class does not. That difference, Σ|I₁ − I₂|/Σ(I₁ + I₂) over the
  pairs at the same d (F² × multiplicity), is 0.45 (4/m), 0.42 (−3), 0.37 (−3m), 0.69 (6/m)
  and 0.56 (m−3). Without it the data could not tell a body from its image under the missing
  operations. Those classes still tell it only through these intensities (see the harness's
  `orientHolo`).
- **Volumes 52–56 Å³**, the low end of the 50–90 asked. In the search every member is drawn
  with its own width, so a pattern's cost follows its members. In 10–130° there are about
  3.4 members per Å³ whatever the class. A first set at 69–74 Å³ had 230–256 members, against
  170–187 now.
- **Metrics with no degeneracy:**
  - the triclinic angles are 96, 104 and 90°;
  - β is 100°;
  - orthorhombic edges are 6.8 % and 20 % apart;
  - c/a is 1.23 (4/m), 0.87 (4/mmm), 1.47 (−3), 1.72 (−3m), 0.89 (6/m) and 1.31 (6/mmm).

  None of these ratios is a simple one. Pmmm's a was moved from 3.37 to 3.36 Å: at 3.37,
  (300) and (023) fell 0.010° apart.
- **The triclinic γ is exactly 90°.** The search holds a body with three turns only on two
  lattice rows exactly normal to each other (`latticeAcross` at 0.01°). A generic triclinic
  cell has no such pair among the simple rows. With γ = 90°, [100] ⟂ [010] gives P−1 one held
  frame, with the third axis along c* (a plate on (001)). α and β break every other symmetry.
  That P−1 has two frames on the lattice against 5–15 in the other classes is a property of
  the class (a remark for the round's reading, below).

## The phases (`cif/<id>.cif`; `phases.json` holds everything below)

| phase | class | cell (Å; °) | V Å³ | sites | reflections | members | to 100/110/120° | model's list | holohedry pairs | closest other pair | shortest Å |
|---|---|---|---|---|---|---|---|---|---|---|---|
| P-1 | −1 | 3.55, 3.87, 4.19; 96, 104, 90 | 55.5 | Zn 1, O 2 | 187 | 187 | 112/140/164 | 553/553 | 0 | 0.0073° at 71.6° | 1.92 |
| P2m | 2/m | 3.82, 3.28, 4.37; β 100 | 53.9 | Zn 1, O 2 | 111 | 182 | 109/142/158 | 219/376 | 0 | 0.011° at 91.5° | 1.89 |
| Pmmm | mmm | 3.36, 3.59, 4.32 | 52.1 | Zn 1, O 1 | 70 | 180 | 108/130/149 | 96/253 | 0 | 0.097° at 108.3° | 3.27 |
| P4m | 4/m | 3.50, 4.32 | 52.9 | Zn 1, O 4 | 54 | 177 | 110/134/146 | 77/259 | 12 | 0.171° at 91.9° | 1.79 |
| P4mmm | 4/mmm | 3.91, 3.41 | 52.1 | Zn 1, O 1 | 41 | 170 | 105/131/157 | 57/260 | 0 (+500/430) | 0.249° at 96.4° | 3.25 |
| P-3 | −3 | 3.46, 5.10 | 52.9 | Zn 1, O 6 | 61 | 171 | 110/143/149 | 87/249 | 28 | 0.298° at 65.1° | 1.81 |
| P-3m1 | −3m | 3.28, 5.64 | 52.5 | Zn 1, O 2 | 50 | 180 | 104/125/162 | 68/256 | 17 | 0.135° at 65.8° | 2.43 |
| P6m | 6/m | 4.10, 3.64 | 53.0 | Zn 1, O 6 | 39 | 184 | 102/138/157 | 52/250 | 7 | 0.268° at 102.9° | 1.44 |
| P6mmm | 6/mmm | 3.59, 4.69 | 52.4 | Zn 1, O 2 | 32 | 170 | 112/124/152 | 43/246 | 0 | 0.111° at 118.3° | 2.07 |
| Pm-3 | m−3 | 3.75 | 52.7 | Zn 1, O 6 | 25 | 182 | 101/125/152 | 31/242 | 5 (+300/221, 401/322, 411/330) | 4.84° at 90.7° | 1.73 |
| Pm-3m | m−3m | 3.73 | 51.9 | Zn 1, O 1 | 20 | 182 | 101/125/152 | 24/242 | 0 (+300/221, 410/322, 411/330) | 4.89° at 91.4° | 3.23 |

How each column was measured (`check.mjs`):

- **Reflections and members** are counted in 10–130° of Cu Kα1, d ≥ λ/(2 sin 65°), by the
  engine's `reflections`. A member is a distinct direction, one per ± pair: mult/2.
- **To 100/110/120°** gives the members a narrower range would keep, for the pilot.
- **The model's list** is the reflections and members the engine sets up on a 10–130° grid.
  It reaches past the range: the lattice's bounds, and for P−1 the ±15° on its angles, can
  grow a d (`latticeStretch`). The lines past it are not drawn until the cell grows them in,
  but every member's width is computed.
- **Holohedry pairs** are reflections at exactly the same d that an operation of the lattice's
  holohedry (not of the class) relates. They are the merohedral classes' (hkl)/(khl) pairs. The
  pairs in brackets are integer coincidences of the lattice type (h² + k² + l² equal), which no
  metric removes.
- **Closest other pair** is the smallest 2θ gap between two reflections that are neither.
- **Shortest** is the shortest interatomic distance.

## Checks with the engine (`node check.mjs`; `phases.json`, `check.log`)

- `prepPhase` reads each CIF to the intended group (sg as named, crystal system and constraint
  as the class's: triclinic … cubic, no conventional basis needed). The operations it finds from
  the atoms number exactly the class's order (2, 4, 8, 8, 16, 6, 12, 12, 24, 24, 48). There are
  no notes and no warnings, and the formula and Z check.
- The free shape's Laue group (`q.laue`, built by `memberVectors`) has the class's order. Every
  reflection of every phase has mult/2 members (0 exceptions). The multiplicities are as the
  class gives them; P−1's are all 2, Pm−3m's run 6, 8, 12, 24, 48.
- The lattice's holohedry (integer operations that keep the metric) has order 2, 4, 8, 16, 16,
  24, 24, 24, 24, 48, 48. It is larger than the class for 4/m, −3, −3m, 6/m and m−3 only.
- **An isotropic Rietveld fit converges on each.** The pattern was drawn with the engine's
  forward model:
  - 10 nm, ε 0.1 %, ΔB 0.3 Å²;
  - the cell 0.2 % larger than the CIF's;
  - strongest line 3000 counts on about 150, Poisson noise;
  - round 1's instrument and refined LaB6 profile, 10–130° in 0.01°.

  It was refined by `autoRefine` from the CIF with that profile: isotropic size, ADP overall,
  strain refined. One process, nice 15, this 4-vCPU machine, with one other job at times.

| phase | χ²_ν | evaluations | s | ms/eval | cell (worst rel. error) | D nm (10) | ε % (0.1) | ΔB Å² (0.3) |
|---|---|---|---|---|---|---|---|---|
| P-1 | 0.970 | 632 | 104.5 | 165 | 7.0·10⁻⁵ | 10.11 | 0.113 | 0.275 |
| P2m | 1.015 | 380 | 27.9 | 74 | 2.4·10⁻⁵ | 9.97 | 0.097 | 0.304 |
| Pmmm | 0.983 | 747 | 39.8 | 53 | 3.4·10⁻⁵ | 9.99 | 0.095 | 0.299 |
| P4m | 0.993 | 308 | 6.5 | 21 | 9.7·10⁻⁶ | 9.97 | 0.096 | 0.302 |
| P4mmm | 0.991 | 308 | 5.2 | 17 | 9.2·10⁻⁵ | 9.95 | 0.097 | 0.313 |
| P-3 | 1.004 | 308 | 6.3 | 20 | 3.9·10⁻⁵ | 9.98 | 0.100 | 0.304 |
| P-3m1 | 1.013 | 302 | 5.3 | 18 | 7.1·10⁻⁵ | 10.04 | 0.103 | 0.305 |
| P6m | 1.031 | 301 | 4.6 | 15 | 6.1·10⁻⁵ | 9.97 | 0.097 | 0.329 |
| P6mmm | 0.990 | 308 | 4.8 | 15 | 4.6·10⁻⁵ | 9.97 | 0.097 | 0.314 |
| Pm-3 | 0.985 | 254 | 1.8 | 7 | 5.5·10⁻⁵ | 9.97 | 0.095 | 0.292 |
| Pm-3m | 1.026 | 260 | 1.8 | 7 | 3.0·10⁻⁵ | 9.89 | 0.091 | 0.328 |

## The cost of an evaluation (`node cost.mjs`; `cost.json`)

These are milliseconds per `calc()` of the whole pattern: the median of 5 after a warm-up, the
parameters held, the same grid and instrument. One process, nice 15, alongside one other job.

| phase | isotropic 5 nm | box 2×3×5 nm | 5×8×12 nm | 15×20×30 nm |
|---|---|---|---|---|
| P-1 | 35.4 | 42.3 | 28.2 | 23.2 |
| P2m | 21.7 | 38.7 | 27.4 | 25.7 |
| Pmmm | 10.9 | 34.4 | 21.8 | 13.4 |
| P4m | 9.5 | 36.5 | 24.3 | 15.0 |
| P4mmm | 6.9 | 33.9 | 21.4 | 14.1 |
| P-3 | 11.1 | 36.1 | 20.9 | 13.5 |
| P-3m1 | 8.5 | 37.9 | 23.2 | 15.0 |
| P6m | 6.9 | 39.3 | 21.2 | 13.6 |
| P6mmm | 5.7 | 33.8 | 21.4 | 13.4 |
| Pm-3 | 4.0 | 30.2 | 21.0 | 12.7 |
| Pm-3m | 3.2 | 31.9 | 20.1 | 12.9 |

- **With the shape on**, the cost is nearly the same in every class: 20–28 ms at 5×8×12 nm,
  30–42 ms at 2×3×5. The members are, and the smaller the crystallite, the wider each member's
  window.
- **Isotropic**, it follows the reflections: 3 ms (m−3m) to 35 ms (−1).
- **In a refinement an evaluation costs more** than held still: the axial nodes are drawn again
  whenever the cell or the widths move. The fits above took 7–21 ms an evaluation in the
  higher classes, 53–74 ms in mmm and 2/m, and 165 ms in −1. P−1's isotropic fit, 105 s, is
  the dearest stage of any run. The pilot measures the search's own cost.

## Frames on the lattice (`phases.json` axes; the design's 'on' orientation)

The first axis takes one of `lowIndexAxes(q)`: the five simplest families the search starts
from. The second axis takes the three simplest rows exactly normal to it,
`latticeAcross(q, e, null, 0.01, 64)`. These are the frames the search's held route tries:

- **P−1:** [100] → [010]; [010] → [100]; [001], [110], [101] → none.
- **P2/m:** [100] → [010]; [010] → [100] [001] [101]; [001] → [010]; ⟨110⟩ → none; [101] →
  [010].
- **Pmmm:** [100] → [010] [001] [011]; [010] → [100] [001] [101]; [001] → [100] [010] [110];
  ⟨110⟩ → [001]; ⟨101⟩ → [010].
- **4/m, 4/mmm:** ⟨100⟩ → [010] [001] [011]; [001] → [100] [010] [110]; ⟨110⟩ → [001] [1−10]
  [1−11]; ⟨101⟩ → [010]; ⟨111⟩ → [1−10].
- **Trigonal and hexagonal:** ⟨110⟩ (an a axis) → [001] [120] [121]; [001] → [100] [010]
  [110]; ⟨111⟩ (⟨101⟩ in −3) → [120]; ⟨210⟩ → [001] [110] [111]. P−3 has [10−1] → [120]
  besides.
- **m−3, m−3m:** ⟨100⟩ → [010] [001] [011]; ⟨110⟩ → [001] [1−10] [1−11]; ⟨111⟩ → [10−1]
  [1−10] [01−1].

Families are named as the engine names them (`lattDirection`: fewest negative indices, then
the largest). In the hexagonal cells the a axes' family is therefore ⟨110⟩.

## Files

- `make-phases.mjs` writes `cif/*.cif`. It exports `PHASES` (id, class, group, cell, O site)
  and `closeGroup`.
- `check.mjs` (about 4 min; `--nofit` 1 s) writes `phases.json` and `check.log`.
- `cost.mjs` (about 2 min) writes `cost.json` and `cost.log`. Options: `--lo --hi --step`,
  `--scale s` (every length × s), `--only id,id`.
- `phases-nofit.json` holds the checks without the fits.
- `tmp/` holds the scratch of the site and cell choices (`tune.mjs`: shortest distance and
  holohedry contrast for trial O coordinates; `closest.mjs`: the closest pairs for trial
  cells).

## Remarks for the round

- **Cost.** It depends on members, not reflections, once the shape is on. Lower symmetry costs
  more only before the search (P−1's isotropic fit) and in the model's list (P−1 553 members,
  130–260 elsewhere, through its free angles). Narrowing the range to 110° would keep 69–84 %
  of the members.
- **Merohedral classes** (4/m, −3, −3m, 6/m, m−3). A body and its image under an operation of
  the holohedry outside the class differ only through the intensities of reflection pairs at
  the same d. The harness reports the orientation's error both ways (`orient`, `orientHolo`).
  Then a minimum found at the mirror image reads as what it is.
- **P−1.** It has frames on the lattice only because γ = 90°. A generic triclinic phase would
  give a body with three turns no held frame at all. That is the engine's behaviour, and worth
  knowing before a real triclinic phase is used.
