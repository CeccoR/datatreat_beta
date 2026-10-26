## 5. Decisions: cells, range, step

**The rule.** The user asked that no hours be spent on an unlucky choice of phase, and that
cells, range and step be decided by cost after the pilot. The order set for the pilot: if a run
is over budget, these are applied in turn until it fits:
1. shrink the costliest cells, keeping each class;
2. narrow the range to 10–110°, then to 10–100°;
3. coarsen the step, only if the narrowest line keeps at least 5 points per FWHM.

**The profiles** (`costgrid.mjs`, `scripts/pilot/`) are ms per evaluation inside a brief
refinement. The pattern is drawn at the truth and refined for 3 iterations after an untimed
warm-up, with what the search frees: the scale, the background, X_s, the cell and the solid.
Then the same with the isotropic size. Six of the cost truths, one process each, 3 at a time,
on the first cells (×0.8: every length scaled). Each cell is shaped / isotropic ms, then the
members in range:

| run | 1, 10–130/0.01 | 1, 10–110/0.01 | 1, 10–100/0.01 | 1, 10–130/0.02 | 1, 10–110/0.02 | 0.8, 10–130/0.01 | 0.8, 10–110/0.01 | 0.8, 10–100/0.01 | 0.8, 10–130/0.02 | 0.8, 10–110/0.02 |
|---|---|---|---|---|---|---|---|---|---|---|
| box-P-1-near | 146 / 215 (187) | 108 / 150 (140) | 75 / 109 (112) | 116 / 176 (187) | 87 / 123 (140) | 57 / 83 (96) | 39 / 63 (70) | 39 / 57 (58) | 55 / 81 (96) | 38 / 58 (70) |
| sqbox-P2m-near | 113 / 121 (182) | 75 / 99 (142) | 64 / 87 (109) | 75 / 110 (182) | 59 / 79 (142) | 42 / 58 (91) | 29 / 36 (71) | 26 / 33 (56) | 34 / 53 (91) | 32 / 39 (71) |
| cylinder-Pmmm-near | 52 / 68 (180) | 47 / 46 (130) | 34 / 36 (108) | 42 / 65 (180) | 33 / 48 (130) | 34 / 33 (94) | 23 / 22 (68) | 18 / 17 (53) | 26 / 31 (94) | 19 / 21 (68) |
| box-P4mmm-generic | 31 / 25 (170) | 23 / 17 (131) | 17 / 18 (105) | 22 / 23 (170) | 16 / 17 (131) | 15 / 13 (89) | 10 / 7 (68) | 9 / 6 (52) | 12 / 6 (89) | 6 / 6 (68) |
| ellcyl-P6mmm-on | 31 / 22 (170) | 16 / 17 (124) | 15 / 8 (112) | 20 / 20 (170) | 17 / 15 (124) | 14 / 6 (91) | 8 / 6 (60) | 7 / 6 (54) | 7 / 5 (91) | 6 / 4 (60) |
| sqbox-Pm-3-on | 26 / 6 (182) | 21 / 10 (125) | 14 / 5 (101) | 14 / 6 (182) | 13 / 5 (125) | 14 / 4 (89) | 11 / 4 (73) | 9 / 4 (46) | 9 / 3 (89) | 6 / 2 (73) |

**The prediction** (`decide.mjs`). Each class's measured run (§4.1) is scaled by its ratios:
the isotropic fit by the isotropic ratio, the search and report by the shaped one. A class not
profiled takes the median ratio of m−3, 4/mmm and 6/mmm. The evaluations are taken as
unchanged.

| configuration | predicted mean, s | members in range |
|---|---|---|
| C0 as first drawn | 375 | 170–187 |
| C1 the costliest cells × 0.8 (P−1, P2/m, Pmmm: 85–142 ms an evaluation against 22–42 elsewhere) | 241 | 91–96 and 170–187 |
| C2 C1 and 10–110° | 170 | 68–71 and 124–143 |
| C3 C1 and 10–100° | 138 | 53–58 and 101–112 |
| C4 C1, 10–110° and 0.02° (step coarsened before the range is exhausted, for comparison) | 141 | 68–71 and 124–143 |
| D1 every cell × 0.8 | 168 | 86–96 |
| **D2 every cell × 0.8 and 10–110°** | **115** | **60–73** |

**The first choice was C3**, taken as the first configuration in the order within the budget,
and D2 was set aside because it "would halve every class's members". It was verified at 116 s on
the 11 cost truths and 134 s on the screening set. **The verification showed it was the wrong
choice** (§10, H3):
- C3 left −1, 2/m and mmm with 53–58 members in range against 101–112 for the other eight. The
  phases were built with equal members (170–187 in 10–130°), so that the Laue class is not read
  through the member count; C3 undid that.
- The reason given against D2 did not separate the two: C3 cut those three classes harder than
  D2 does, and D2 was predicted cheaper.

**The choice is D2: every cell × 0.8, 10–110°.** It is the first configuration within the budget
when step 1 shrinks every cell, and the only one in the table that keeps the members equal
across classes. Measured, it is cheaper than C3:
- on the same 11 cost truths, 103.5 s a run (iso + search + report, mean) against 115.5 s at
  C3, 10 % less; −1 323 s against 291, 2/m 234 against 205, mmm 92 against 92, the other
  eight 15–45 % cheaper. The prediction (115 against 138 s) missed −1 and 2/m, whose
  evaluations got dearer with 10–110° (49 against 43 ms, 32.5 against 26.3);
- on the screening set, @@SCREEN_MEAN@@ s against 134 s (§4.2).

Members in 10–110°: P−1 70, P2/m 71, Pmmm 68, P4/m 67, P4/mmm 68, −3 61, −3m 67, 6/m 69, 6/mmm
60, m−3 73, m−3m 73. The cubic classes have 10–12 reflections in range.

**The step stays at 0.01°.** No coarsening was needed.
- `narrow.mjs` finds every design row's narrowest line, a lower bound on its FWHM: the
  member's exact size line (its A(L), the row's size distribution) convolved with the
  instrument's pseudo-Voigt and the row's strain, the axial wings and Kα2 left out.
- Over all 231 rows on 10–110° and the final cells, the narrowest is 0.165°: box-Pm-3-on,
  ⟨L⟩_V 60 nm, (111) at 52.8°. That is 16.5 points per FWHM at 0.01°.
- At 0.02° it would still be 8.3, so the step remains in reserve.
- Only the truths' geometry was read, no result.

**What changed in the data:**
- **Cells.** Every length × 0.8; angles and atoms' fractional coordinates kept. P−1 2.84, 3.096,
  3.352 Å (96, 104, 90°); P2/m 3.056, 2.624, 3.496 Å (β 100°); Pmmm 2.688, 2.872, 3.456 Å; P4/m
  2.8, 3.456; P4/mmm 3.128, 2.728; P−3 2.768, 4.08; P−3m1 2.624, 4.512; P6/m 3.28, 2.912; P6/mmm
  2.872, 3.752; Pm−3 3.0; Pm−3m 2.984 Å. Volumes 26.6–28.4 Å³. The first cells are kept in
  `scripts/phases/cif-v1/`, C3's in `cif-c3/`.
- **Range.** 10–110°, 10 001 points: the generator's `GRID`, every caller's default.
- **Design revision 2** (§10, H6): the 22 near cylinders and spheroids turned by their full tilt.
- **Errors** (§10, G1, G2): the hump's and the impurity lines' areas are their stated share
  within the range.
- The background shape, the instrument, the noise and the error draws are unchanged. Hump
  centres and impurity positions are drawn over the new range, as their rules say.
