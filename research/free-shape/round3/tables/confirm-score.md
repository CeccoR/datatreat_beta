# Round 3: tuning part, 308 rows (264 truths, 44 spheres); round 3 308 records, round 2 308

| method | runs | truths: held / free / rejected (early) | spheres kept: clean / error | reached / judged | unbounded | worst, median (90 %) | thinnest | axis °, median (90 %) | search evaluations (× round 2; per run median) | of which the minima stage | report evaluations | not explored (capped) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| round 2 | 308 | 87 / 175 / 2 (1) | 0/22 / 14/22 | 246 / 263 | 16 | +6 % (+212 %) | -0 % | 1.8 (25.7) | 1082790 (1.000; 1.000) | 531874 (max 17511) | 1108636 | 8 (0) |
| round 3 | 308 | 87 / 175 / 2 (1) | 0/22 / 14/22 | 249 / 263 | 16 | +6 % (+200 %) | -0 % | 1.8 (25.7) | 1113057 (1.028; 1.092) | 490877 (max 13225) | 1338433 | 46 (23) |

- clean truths kept by both (131): round 2 worst +2 % (90 % +28 %), thinnest +0 %, axis 0.4°, unbounded 2, anisotropy 1.00; round 3 worst +2 % (90 % +28 %), thinnest +0 %, axis 0.4°, unbounded 2, anisotropy 1.00
- with an error truths kept by both (131): round 2 worst +22 % (90 % +∞), thinnest -0 %, axis 8.0°, unbounded 14, anisotropy 1.04; round 3 worst +21 % (90 % +∞), thinnest -0 %, axis 7.6°, unbounded 14, anisotropy 1.04

Outcome changed (round 2 → round 3) on 2: box-Pm-3m-on-a free → held; ellcyl-P-3-on-a held → free.

Not reached, round 2 (17): box-P-3m1-near-a (po) Δ 25.3, box-Pm-3-near-a Δ 1292.8, sqbox-Pmmm-on-a (po) Δ 1.8, sqbox-P6m-near-a (impurity) Δ 1.6, cylinder-P-3m1-on-a Δ 66.1, ellcyl-P4m-near-a (air) Δ 1.3, ellcyl-P4mmm-on-a Δ 1162.8, ellcyl-P-3-on-a (po) Δ 6.3, ellcyl-P-3m1-near-a Δ 2.7, box-P-3-near-b Δ 18.9, box-Pm-3-generic-b (hump) Δ 33.4, sqbox-P4mmm-generic-b (sizedist) Δ 1.6, sqbox-P6m-generic-b Δ 15.7, sqbox-P6mmm-on-b (po) Δ 2.9, ellcyl-P6m-near-b (hump) Δ 36.9, ellcyl-P6mmm-near-b (impurity) Δ 64.3, ellcyl-Pm-3-generic-b (po) Δ 68.9.
Not reached, round 3 (14): box-Pm-3m-on-a (po) Δ 8.4, sqbox-P6m-near-a (impurity) Δ 1.6, cylinder-P-3m1-on-a Δ 66.1, ellcyl-P4m-near-a (air) Δ 1.3, ellcyl-P4mmm-on-a Δ 1162.8, ellcyl-P-3-on-a (po) Δ 1.7, ellcyl-P-3m1-near-a Δ 2.7, box-Pm-3-generic-b (hump) Δ 33.4, sqbox-P6m-generic-b Δ 15.7, sqbox-P6mmm-on-b (po) Δ 2.9, ellcyl-P6m-near-b (hump) Δ 36.9, ellcyl-P6mmm-near-b (impurity) Δ 2.4, ellcyl-Pm-3-generic-b (po) Δ 68.9, ellipsoid-Pm-3-near-b (sizedist) Δ 25.6.

**The two errors** (kept truths; E the engine's reported interval and radius):

| method | kept truths | runs | extents (unbounded) | E covered | median half-width E | principal axes E covered | median radius E | E radius ÷ error, clean misses |
|---|---|---|---|---|---|---|---|---|
| round 2 | clean | 128 | 319 (1) | 306/319 (96 %) | 3.1 % | 113/127 (89 %) | 2.8° | sqbox-P2m-generic-a 0.9/0.8°, sqbox-Pmmm-generic-a 2.3/2.2°, sqbox-Pm-3-near-a 31.9/28.2°, cylinder-P6mmm-near-a 1.6/0.0°, cylinder-Pm-3m-near-a 1.6/1.2°, ellipsoid-P2m-near-a 2.8/2.6°, spheroid-P4m-generic-a 37.5/19.7°, spheroid-P4mmm-near-a 1.8/1.5°, box-P-1-generic-b 0.3/0.3°, box-P6mmm-near-b 1.3/1.1°, sqbox-P-3m1-generic-b 1.9/1.4°, sqbox-P6m-generic-b 4.6/1.0°, cylinder-P2m-generic-b 1.0/0.7°, ellcyl-P6mmm-generic-b 0.7/0.7° |
| round 2 | clean, flagged | 3 | 8 (1) | 6/8 (75 %) | 7.4 % | 1/3 (33 %) | 5.8° |  |
| round 2 | error, not flagged | 39 | 97 (1) | 57/97 (59 %) | 5.1 % | 26/39 (67 %) | 4.9° |  |
| round 2 | error, flagged | 92 | 216 (13) | 176/216 (81 %) | 21.7 % | 70/91 (77 %) | 15.7° |  |
| round 2 | all kept | 262 | 640 (16) | 545/640 (85 %) | 6.4 % | 210/260 (81 %) | 7.7° |  |
| round 3 | clean | 129 | 322 (1) | 308/322 (96 %) | 3.1 % | 127/128 (99 %) | 5.5° | sqbox-P6m-generic-b 4.6/1.7° |
| round 3 | clean, flagged | 2 | 5 (1) | 2/5 (40 %) | 5.9 % | 1/2 (50 %) | 5.4° |  |
| round 3 | error, not flagged | 38 | 94 (1) | 55/94 (59 %) | 5.0 % | 28/38 (74 %) | 8.9° |  |
| round 3 | error, flagged | 93 | 219 (13) | 178/219 (81 %) | 20.0 % | 71/92 (77 %) | 15.6° |  |
| round 3 | all kept | 262 | 640 (16) | 543/640 (85 %) | 6.4 % | 227/260 (87 %) | 10.3° |  |

**Uniqueness** (round 3; one minimum within Δ*; covered by E):

| kept truths | unique | unique, covered | several | several, covered |
|---|---|---|---|---|
| clean | 93/129 | 88 | 36 | 28 |
| clean, flagged | 2/2 | 0 | 0 | 0 |
| error, not flagged | 24/38 | 11 | 14 | 6 |
| error, flagged | 73/93 | 45 | 20 | 13 |

**The per-line check** (round 3; the fit returned, or beside a rejection the isotropic fit):

| rows | runs | flagged | spoiled | spoiled and flagged | z median / max |
|---|---|---|---|---|---|
| clean truths | 132 | 2 | 17 | 2 | 0.55 / 9.10 |
| clean spheres | 22 | 0 | 0 | 0 | 0.34 / 2.20 |
| hump | 20 | 20 | 9 | 9 | 28.28 / 176.73 |
| sizedist | 47 | 20 | 31 | 15 | 2.21 / 42.32 |
| impurity | 21 | 21 | 9 | 9 | 75.32 / 361.58 |
| air | 20 | 5 | 4 | 2 | 1.52 / 77.60 |
| po | 46 | 42 | 39 | 38 | 24.07 / 421.71 |
| all with an error | 154 | 108 | 92 | 73 | 15.14 / 421.71 |

Spoiled and not flagged: box-P2m-generic-a (none), box-P-3-on-a (none), box-P6m-on-a (sizedist 0.71), box-P6m-generic-a (none), sqbox-Pm-3-near-a (none), sqbox-Pm-3m-generic-a (none), cylinder-P-3m1-on-a (none), ellcyl-P4m-generic-a (air 0.61), ellcyl-P6m-generic-a (none), ellcyl-Pm-3-near-a (none), ellcyl-Pm-3m-generic-a (po 0.49), ellipsoid-P4m-near-a (none), ellipsoid-P6m-generic-a (sizedist 0.39), spheroid-P4m-generic-a (none), spheroid-Pm-3-on-a (sizedist 0.49), spheroid-Pm-3m-near-a (sizedist 0.35), box-Pmmm-generic-b (sizedist 0.89), box-P4m-generic-b (sizedist 0.92), box-P-3m1-generic-b (none), box-Pm-3m-on-b (none), sqbox-P-3-near-b (sizedist 0.88), sqbox-P6m-on-b (sizedist 0.43), cylinder-P-3-on-b (sizedist 0.58), cylinder-P6m-near-b (none), ellcyl-P4mmm-near-b (sizedist 0.35), ellcyl-Pm-3-on-b (none), ellcyl-Pm-3m-on-b (sizedist 0.18), ellipsoid-P-3-on-b (none), ellipsoid-Pm-3m-on-b (sizedist 0.62), spheroid-P6mmm-generic-b (air 0.97), sphere-P2m-4 (sizedist 0.37), sphere-Pmmm-1 (sizedist 0.33), sphere-P4m-3 (sizedist 0.78), sphere-P-3-1 (sizedist 0.30). Clean rows flagged: ellcyl-P4mmm-on-a z 9.10, box-P-3-near-b z 3.29.

**The jackknife** (round 3, flagged kept truths with an error, by kind: extents E covered / n, axes E covered / n):

- hump: 16 rows, extents 32/38 (unbounded 1), axes 14/16
- sizedist: 18 rows, extents 24/42 (unbounded 3), axes 12/17
- impurity: 18 rows, extents 45/45 (unbounded 0), axes 17/18
- air: 4 rows, extents 11/11 (unbounded 0), axes 4/4
- po: 37 rows, extents 66/83 (unbounded 9), axes 24/37

**The keep test** (shapes kept):

| rows | runs | round 2 | round 3 |
|---|---|---|---|
| clean truths | 132 | 131 | 131 |
| truths with an error | 132 | 131 | 131 |
| clean spheres | 22 | 0 | 0 |
| spheres with an error | 22 | 14 | 14 |

Truths round 3 rejects: cylinder-Pm-3-generic-a (hump; G —, need 13.2, early); spheroid-Pm-3-on-b (none; G 6.4, need 13.2).
Spheres round 3 keeps: sphere-P-1-3 (hump 0.46, flagged); sphere-P-1-6 (sizedist 0.95, flagged); sphere-P2m-4 (sizedist 0.37); sphere-Pmmm-1 (sizedist 0.33); sphere-Pmmm-4 (sizedist 0.58, flagged); sphere-P4m-2 (po 0.83, flagged); sphere-P4m-3 (sizedist 0.78); sphere-P4mmm-4 (po 0.57, flagged); sphere-P-3-1 (sizedist 0.30); sphere-P-3m1-3 (impurity 0.92, flagged); sphere-P6m-1 (po 0.10, flagged); sphere-P6m-4 (impurity 0.49, flagged); sphere-P6mmm-2 (po 0.89, flagged); sphere-P6mmm-5 (po 0.45, flagged).

| row | class | error | round 2: outcome, search evals, stage evals, Δ, worst, axis°, axis radius° | round 3: outcome, search evals, stage evals, Δ, worst, axis°, axis radius° | flag | minima ≤ Δ* | explored |
|---|---|---|---|---|---|---|---|
| box-P-1-near-a | -1 | po 0.52 | free, 5798, 2312, 0.0, +397 %, 14.2, 11.3 | free, 6088, 2312, 0.0, +397 %, 14.2, 11.3 | F | 1 | yes |
| box-P-1-generic-a | -1 | sizedist 0.30 | free, 2499, 580, 0.0, +10 %, 0.3, 2.6 | free, 3023, 580, 0.0, +10 %, 0.3, 2.6 | F | 1 | yes |
| box-P2m-on-a | 2/m | po 0.73 | free, 2918, 574, 0.0, +∞, 4.1, 20.0 | free, 3329, 574, 0.0, +∞, 4.1, 20.0 | F | 1 | yes |
| box-P2m-generic-a | 2/m |  | free, 2635, 1034, 0.0, +29 %, 2.0, 6.6 | free, 2638, 1034, 0.0, +29 %, 2.0, 16.1 |  | 1 | yes |
| box-Pmmm-on-a | mmm | air 0.34 | held, 10683, 8144, 0.0, +3 %, 0.0, 5.0 | held, 11105, 8144, 0.0, +3 %, 0.0, 5.0 |  | 1 | yes |
| box-Pmmm-near-a | mmm | air 0.90 | free, 3194, 641, 0.0, +2 %, 0.8, 2.8 | free, 3660, 641, 0.0, +2 %, 0.8, 2.8 | F | 1 | yes |
| box-P4m-near-a | 4/m | impurity 0.83 | free, 5400, 3333, 0.0, +7 %, 1.5, 13.3 | free, 4267, 1762, 0.0, +7 %, 1.5, 16.4 | F | 2 | no (cap) |
| box-P4m-generic-a | 4/m | impurity 0.99 | free, 5378, 3201, 0.0, +680 %, 0.5, 4.3 | free, 4701, 2054, 0.0, +376 %, 0.6, 5.4 | F | 1 | no (cap) |
| box-P4mmm-on-a | 4/mmm |  | held, 2591, 618, 0.0, +0 %, 0.0, 0.3 | held, 3026, 618, 0.0, +0 %, 0.0, 0.6 |  | 1 | yes |
| box-P4mmm-generic-a | 4/mmm |  | free, 2786, 1083, 0.0, +7 %, 0.2, 2.7 | free, 3023, 1083, 0.0, +7 %, 0.2, 4.3 |  | 2 | yes |
| box-P-3-on-a | -3 |  | held, 7935, 5542, 0.0, +34 %, 0.0, 1.7 | held, 8166, 5542, 0.0, +34 %, 0.0, 2.6 |  | 1 | yes |
| box-P-3-near-a | -3 |  | free, 4736, 2375, 0.0, +5 %, 1.7, 4.4 | free, 5532, 2826, 0.0, +5 %, 1.7, 5.4 |  | 4 | yes |
| box-P-3m1-near-a | -3m | po 0.06 | free, 3154, 1049, 25.3, +∞, 9.1, 14.6 | free, 3306, 660, 0.0, +∞, 9.3, 14.2 | F | 1 | yes |
| box-P-3m1-generic-a | -3m |  | free, 3049, 1251, 0.0, +4 %, 1.2, 3.3 | free, 3264, 1251, 0.0, +4 %, 1.2, 6.7 |  | 1 | yes |
| box-P6m-on-a | 6/m | sizedist 0.71 | held, 11788, 10272, 0.0, +118 %, 0.0, 28.9 | held, 10968, 9109, 0.0, +118 %, 0.0, 28.9 |  | 2 | no |
| box-P6m-generic-a | 6/m |  | free, 6088, 4699, 0.0, +83 %, 2.7, 34.0 | free, 6091, 4699, 0.0, +83 %, 2.7, 34.0 |  | 2 | no |
| box-P6mmm-on-a | 6/mmm |  | held, 3008, 519, 0.0, +6 %, 0.0, 1.6 | held, 2908, 519, 0.0, +6 %, 0.0, 2.0 |  | 1 | yes |
| box-P6mmm-near-a | 6/mmm | po 0.70 | held, 6957, 5033, 0.0, +∞, 21.6, 28.9 | held, 4343, 2294, 0.0, +∞, 21.6, 10.4 | F | 1 | no (cap) |
| box-Pm-3-near-a | m-3 |  | free, 2333, 385, 1292.8, +145 %, 7.7, 14.8 | free, 3859, 293, 0.0, +2 %, 0.4, 2.3 |  | 1 | yes |
| box-Pm-3-generic-a | m-3 |  | free, 2438, 412, 0.0, +12 %, 0.4, 0.8 | free, 2410, 412, 0.0, +12 %, 0.4, 1.7 |  | 1 | yes |
| box-Pm-3m-on-a | m-3m | po 0.46 | free, 13405, 11787, 0.6, +229 %, 16.4, 29.6 | held, 6830, 5003, 8.4, +63 %, 45.0, 39.3 | F | 1 | no (cap) |
| box-Pm-3m-generic-a | m-3m | sizedist 0.29 | free, 5647, 4211, 0.0, +9 %, 8.2, 8.5 | free, 5748, 4211, 0.0, +9 %, 8.2, 52.6 |  | 3 | no |
| sqbox-P-1-on-a | -1 |  | held, 5088, 552, 0.0, +0 %, 0.0, 0.2 | held, 5646, 552, 0.0, +0 %, 0.0, 0.4 |  | 1 | yes |
| sqbox-P-1-near-a | -1 | hump 0.95 | free, 2877, 407, 0.0, +4 %, 0.4, 3.0 | free, 3238, 407, 0.0, +4 %, 0.4, 2.5 | F | 1 | yes |
| sqbox-P2m-near-a | 2/m | po 0.64 | free, 9295, 3464, 0.0, +95 %, 52.1, 44.9 | free, 8828, 3464, 0.0, +95 %, 52.1, 44.9 | F | 1 | yes |
| sqbox-P2m-generic-a | 2/m |  | free, 1759, 233, 0.0, +1 %, 0.9, 0.8 | free, 2281, 233, 0.0, +1 %, 0.9, 1.6 |  | 1 | yes |
| sqbox-Pmmm-on-a | mmm | po 0.44 | free, 2483, 439, 1.8, +49 %, 10.5, 15.3 | free, 5143, 2514, 0.0, +26 %, 9.2, 28.4 | F | 1 | yes |
| sqbox-Pmmm-generic-a | mmm |  | free, 2239, 447, 0.0, +1 %, 2.3, 2.2 | free, 2340, 447, 0.0, +1 %, 2.3, 3.9 |  | 1 | yes |
| sqbox-P4m-on-a | 4/m | po 0.87 | free, 7968, 4145, 0.0, +2 %, 12.9, 22.0 | free, 8837, 4145, 0.0, +2 %, 12.9, 22.0 | F | 1 | yes |
| sqbox-P4m-near-a | 4/m |  | free, 2133, 432, 0.0, +0 %, 0.7, 0.8 | free, 2448, 476, 0.0, +0 %, 0.7, 1.5 |  | 1 | yes |
| sqbox-P4mmm-near-a | 4/mmm | hump 0.03 | free, 2066, 327, 0.0, +1 %, 0.1, 0.5 | free, 2459, 327, 0.0, +1 %, 0.1, 0.7 | F | 1 | yes |
| sqbox-P4mmm-generic-a | 4/mmm | po 0.86 | free, 7920, 6159, 0.0, +790 %, 6.6, 21.0 | free, 5958, 3979, 0.0, +790 %, 6.6, 21.0 | F | 2 | no (cap) |
| sqbox-P-3-on-a | -3 |  | held, 3255, 1433, 0.5, +6 %, 0.0, 120.2 | held, 2825, 692, 0.0, +6 %, 0.0, 6.4 |  | 1 | yes |
| sqbox-P-3-generic-a | -3 |  | free, 1978, 285, 0.0, +0 %, 0.2, 0.3 | free, 2253, 285, 0.0, +0 %, 0.2, 0.6 |  | 1 | yes |
| sqbox-P-3m1-on-a | -3m | sizedist 0.56 | held, 7159, 5592, 0.0, +6 %, 0.0, 120.1 | held, 7660, 5904, 0.4, +6 %, 0.0, 87.3 |  | 4 | no |
| sqbox-P-3m1-near-a | -3m | hump 0.78 | free, 2605, 607, 0.0, +3 %, 12.2, 28.9 | free, 2712, 607, 0.0, +3 %, 12.2, 28.9 | F | 1 | yes |
| sqbox-P6m-near-a | 6/m | impurity 0.02 | free, 3250, 1158, 1.6, +2 %, 1.3, 10.5 | free, 3558, 1158, 1.6, +2 %, 1.3, 10.9 | F | 3 | yes |
| sqbox-P6m-generic-a | 6/m | po 0.71 | held, 2618, 1082, 0.0, +8 %, 74.5, 0.6 | held, 2838, 1082, 0.0, +8 %, 74.5, 1.1 | F | 1 | yes |
| sqbox-P6mmm-on-a | 6/mmm |  | held, 3461, 1908, 0.0, +2 %, 0.0, 55.1 | held, 4952, 3211, 0.0, +2 %, 0.0, 55.1 |  | 2 | yes |
| sqbox-P6mmm-generic-a | 6/mmm | sizedist 0.94 | free, 3595, 988, 0.0, +88 %, 4.0, 6.8 | free, 3553, 1010, 0.0, +88 %, 4.0, 6.9 | F | 1 | yes |
| sqbox-Pm-3-on-a | m-3 |  | held, 2261, 1105, 0.0, +3 %, 0.0, 1.6 | held, 2362, 1105, 0.0, +3 %, 0.0, 3.9 |  | 1 | yes |
| sqbox-Pm-3-near-a | m-3 |  | held, 4456, 3110, 0.1, +29 %, 31.9, 28.2 | held, 5023, 3328, 0.0, +29 %, 31.9, 126.5 |  | 4 | no |
| sqbox-Pm-3m-near-a | m-3m |  | held, 1874, 631, 0.0, +3 %, 4.5, 21.1 | held, 2058, 631, 0.0, +3 %, 4.5, 15.9 |  | 1 | yes |
| sqbox-Pm-3m-generic-a | m-3m |  | free, 4407, 3328, 0.0, +28 %, 1.5, 7.8 | free, 4602, 3328, 0.0, +28 %, 1.5, 41.0 |  | 1 | yes |
| cylinder-P-1-on-a | -1 |  | held, 2309, 276, 0.0, +1 %, 0.0, 0.2 | held, 2561, 276, 0.0, +1 %, 0.0, 0.4 |  | 1 | yes |
| cylinder-P-1-generic-a | -1 | air 0.26 | free, 1965, 303, 0.0, +5 %, 0.2, 0.8 | free, 2207, 303, 0.0, +5 %, 0.2, 1.3 |  | 1 | yes |
| cylinder-P2m-on-a | 2/m |  | held, 2753, 329, 0.0, +0 %, 0.0, 1.6 | held, 3846, 952, 0.0, +0 %, 0.0, 3.9 |  | 1 | yes |
| cylinder-P2m-near-a | 2/m |  | free, 1657, 236, 0.0, +0 %, 0.1, 0.4 | free, 1758, 236, 0.0, +0 %, 0.1, 0.6 |  | 1 | yes |
| cylinder-Pmmm-near-a | mmm | sizedist 0.04 | free, 1934, 514, 0.0, +2 %, 0.3, 0.6 | free, 2185, 514, 0.0, +2 %, 0.3, 1.0 |  | 1 | yes |
| cylinder-Pmmm-generic-a | mmm | po 0.37 | free, 1560, 302, 0.0, +2 %, 6.0, 3.4 | free, 1822, 302, 0.0, +2 %, 6.0, 3.4 | F | 1 | yes |
| cylinder-P4m-on-a | 4/m | po 0.40 | free, 2427, 905, 0.0, +10 %, 10.4, 18.8 | free, 2600, 905, 0.0, +10 %, 10.4, 18.8 | F | 2 | yes |
| cylinder-P4m-generic-a | 4/m |  | free, 1518, 270, 0.0, +2 %, 0.1, 0.4 | free, 1744, 270, 0.0, +2 %, 0.1, 0.7 |  | 1 | yes |
| cylinder-P4mmm-on-a | 4/mmm |  | held, 1248, 177, 0.0, +2 %, 0.0, 13.0 | held, 1251, 177, 0.0, +2 %, 0.0, 11.0 |  | 1 | yes |
| cylinder-P4mmm-near-a | 4/mmm | impurity 0.92 | held, 1803, 336, 0.0, +3 %, 3.4, 11.0 | held, 1998, 336, 0.0, +3 %, 3.4, 8.6 | F | 1 | yes |
| cylinder-P-3-near-a | -3 |  | free, 3122, 1399, 0.0, +1 %, 3.1, — | free, 3399, 1399, 0.0, +1 %, 3.1, — |  | 1 | yes |
| cylinder-P-3-generic-a | -3 | po 0.09 | free, 2263, 1033, 0.0, +80 %, 58.2, 57.0 | free, 2537, 1033, 0.0, +80 %, 58.2, 57.0 | F | 2 | yes |
| cylinder-P-3m1-on-a | -3m |  | free, 1928, 794, 66.1, +∞, 14.4, 16.4 | free, 2205, 794, 66.1, +∞, 14.4, 24.7 |  | 2 | yes |
| cylinder-P-3m1-generic-a | -3m | po 0.54 | free, 3242, 1003, 0.0, +∞, 25.7, 37.0 | free, 3458, 1003, 0.0, +∞, 25.7, 37.0 | F | 2 | yes |
| cylinder-P6m-on-a | 6/m | sizedist 0.16 | free, 1522, 348, 0.0, +25 %, 7.4, 16.5 | free, 1770, 348, 0.0, +25 %, 7.4, 16.5 | F | 1 | yes |
| cylinder-P6m-near-a | 6/m |  | free, 1510, 475, 0.0, +0 %, 0.5, 12.2 | free, 1738, 475, 0.0, +0 %, 0.5, 12.2 |  | 2 | yes |
| cylinder-P6mmm-near-a | 6/mmm |  | free, 1991, 622, 0.0, +1 %, 1.6, 0.0 | free, 2264, 622, 0.0, +1 %, 1.6, 15.4 |  | 1 | yes |
| cylinder-P6mmm-generic-a | 6/mmm | sizedist 0.80 | free, 1918, 285, 0.0, +55 %, 5.3, 6.9 | free, 2103, 285, 0.0, +55 %, 5.3, 6.9 | F | 1 | yes |
| cylinder-Pm-3-on-a | m-3 | hump 0.98 | held, 1474, 377, 0.0, +21 %, 35.3, 14.3 | held, 1635, 377, 0.0, +21 %, 35.3, 11.5 | F | 1 | yes |
| cylinder-Pm-3-generic-a | m-3 | hump 0.40 | early, 630, 0, —, —, —, — | early, 725, 0, —, —, —, — | F | — | — |
| cylinder-Pm-3m-on-a | m-3m |  | held, 1294, 325, 0.0, +1 %, 0.0, 1.7 | held, 1477, 325, 0.0, +1 %, 0.0, 1.6 |  | 1 | yes |
| cylinder-Pm-3m-near-a | m-3m |  | free, 1303, 267, 0.0, +0 %, 1.6, 1.2 | free, 1454, 267, 0.0, +0 %, 1.6, 2.3 |  | 1 | yes |
| ellcyl-P-1-near-a | -1 |  | free, 3696, 1439, 0.0, +8 %, 0.9, 88.3 | free, 4296, 1439, 0.0, +8 %, 0.9, 88.3 |  | 2 | yes |
| ellcyl-P-1-generic-a | -1 |  | free, 2062, 254, 0.0, +5 %, 0.2, 0.4 | free, 2596, 254, 0.0, +5 %, 0.2, 0.9 |  | 1 | yes |
| ellcyl-P2m-on-a | 2/m | sizedist 0.26 | free, 3269, 656, 0.0, +6 %, 2.0, 2.9 | free, 3931, 656, 0.0, +6 %, 2.0, 2.9 | F | 1 | yes |
| ellcyl-P2m-generic-a | 2/m | sizedist 0.11 | free, 2942, 278, 0.0, +156 %, 80.2, 2.0 | free, 3207, 278, 0.0, +156 %, 80.2, 2.0 | F | 1 | yes |
| ellcyl-Pmmm-on-a | mmm | sizedist 0.32 | free, 5115, 2689, 0.1, +12 %, 0.0, 0.6 | free, 5631, 2689, 0.1, +12 %, 0.0, 1.1 |  | 1 | yes |
| ellcyl-Pmmm-near-a | mmm | sizedist 0.68 | free, 2946, 635, 0.0, +140 %, 2.0, 11.6 | free, 3427, 635, 0.0, +140 %, 2.0, 11.6 | F | 1 | yes |
| ellcyl-P4m-near-a | 4/m | air 0.08 | free, 3081, 842, 1.3, +10 %, 0.2, 9.6 | free, 3510, 842, 1.3, +10 %, 0.2, 9.6 | F | 2 | yes |
| ellcyl-P4m-generic-a | 4/m | air 0.61 | held, 8101, 5953, 0.0, +26 %, 1.8, 81.7 | held, 8519, 5885, 0.0, +26 %, 1.8, 81.7 |  | 2 | no |
| ellcyl-P4mmm-on-a | 4/mmm |  | free, 3702, 704, 1162.8, +∞, 58.2, 5.8 | free, 3962, 704, 1162.8, +∞, 58.2, 5.8 | F | 1 | yes |
| ellcyl-P4mmm-generic-a | 4/mmm |  | free, 2379, 470, 0.0, +1 %, 0.3, 0.4 | free, 2648, 470, 0.0, +1 %, 0.3, 0.7 |  | 1 | yes |
| ellcyl-P-3-on-a | -3 | po 0.01 | held, 7422, 5213, 6.3, +5 %, 29.9, 73.5 | free, 7108, 4360, 1.7, +1 %, 4.5, 37.9 |  | 3 | no |
| ellcyl-P-3-near-a | -3 | po 0.74 | free, 3109, 435, 0.0, +∞, 49.8, 44.7 | free, 3248, 435, 0.0, +∞, 49.8, 44.7 | F | 1 | yes |
| ellcyl-P-3m1-near-a | -3m |  | free, 3698, 661, 2.7, +1 %, 0.3, 0.7 | free, 3315, 661, 2.7, +1 %, 0.3, 1.7 |  | 1 | yes |
| ellcyl-P-3m1-generic-a | -3m | sizedist 0.51 | free, 7915, 4040, 0.0, +145 %, 17.6, 12.9 | free, 8132, 4040, 0.0, +145 %, 17.6, 12.9 | F | 2 | no (cap) |
| ellcyl-P6m-on-a | 6/m | impurity 0.50 | held, 9163, 5878, 0.0, +126 %, 90.0, 0.0 | held, 8511, 5878, 0.0, +126 %, 90.0, 0.0 | F | 1 | yes |
| ellcyl-P6m-generic-a | 6/m |  | held, 5757, 3964, 0.0, +108 %, 40.4, 53.0 | held, 5875, 3964, 0.0, +108 %, 40.4, 53.0 |  | 2 | no |
| ellcyl-P6mmm-on-a | 6/mmm | impurity 0.94 | held, 7979, 6234, 0.0, +8 %, 0.0, 65.3 | held, 3767, 1684, 0.0, +8 %, 0.0, 59.9 | F | 2 | no (cap) |
| ellcyl-P6mmm-near-a | 6/mmm |  | held, 15132, 13225, 0.0, +16 %, 7.6, 20.2 | held, 15362, 13225, 0.0, +16 %, 7.6, 16.3 |  | 2 | no |
| ellcyl-Pm-3-near-a | m-3 |  | held, 5115, 3656, 0.0, +55 %, 4.0, 49.1 | held, 5227, 3656, 0.0, +55 %, 4.0, 49.1 |  | 3 | no |
| ellcyl-Pm-3-generic-a | m-3 |  | free, 2071, 321, 0.0, +19 %, 1.2, 2.3 | free, 2271, 321, 0.0, +19 %, 1.2, 5.7 |  | 1 | yes |
| ellcyl-Pm-3m-on-a | m-3m |  | held, 3528, 1338, 0.0, +0 %, 0.0, 3.1 | held, 3667, 1338, 0.0, +0 %, 0.0, 3.4 |  | 1 | yes |
| ellcyl-Pm-3m-generic-a | m-3m | po 0.49 | held, 6320, 4880, 0.0, +93 %, 5.6, 20.3 | held, 6323, 4880, 0.0, +93 %, 5.6, 29.1 |  | 3 | no |
| ellipsoid-P-1-on-a | -1 | hump 0.12 | held, 1720, 265, 0.0, +2 %, 0.0, 2.0 | held, 2246, 265, 0.0, +2 %, 0.0, 3.5 | F | 1 | yes |
| ellipsoid-P-1-near-a | -1 |  | free, 2239, 349, 0.0, +3 %, 0.1, 0.7 | free, 2769, 349, 0.0, +3 %, 0.1, 1.2 |  | 1 | yes |
| ellipsoid-P2m-near-a | 2/m |  | free, 5280, 2412, 0.0, +3 %, 2.8, 2.6 | free, 7802, 5020, 0.0, +3 %, 2.8, 4.8 |  | 1 | yes |
| ellipsoid-P2m-generic-a | 2/m |  | free, 1897, 330, 0.0, +3 %, 0.4, 0.5 | free, 2435, 330, 0.0, +3 %, 0.4, 0.8 |  | 1 | yes |
| ellipsoid-Pmmm-on-a | mmm | po 0.15 | free, 3125, 1059, 0.0, +7 %, 7.8, 8.7 | free, 3631, 1059, 0.0, +7 %, 7.8, 8.7 | F | 1 | yes |
| ellipsoid-Pmmm-generic-a | mmm | impurity 0.76 | free, 20033, 17511, 0.0, +204 %, 1.0, 7.0 | free, 11066, 8316, 0.0, +203 %, 1.0, 7.0 | F | 1 | no (cap) |
| ellipsoid-P4m-on-a | 4/m |  | held, 5666, 3882, 0.0, +2 %, 0.0, 7.1 | held, 8121, 5361, 0.0, +2 %, 0.0, 7.1 |  | 2 | yes |
| ellipsoid-P4m-near-a | 4/m |  | held, 17175, 14676, 0.0, +9 %, 16.5, 129.6 | held, 15713, 12423, 0.0, +9 %, 16.5, 49.0 |  | 2 | no |
| ellipsoid-P4mmm-near-a | 4/mmm |  | free, 8252, 6568, 0.0, +8 %, 6.6, 13.0 | free, 9430, 7393, 0.0, +8 %, 6.6, 27.7 |  | 1 | no |
| ellipsoid-P4mmm-generic-a | 4/mmm | po 0.83 | free, 4224, 1996, 0.0, +213 %, 5.7, 82.5 | free, 4531, 1996, 0.0, +213 %, 5.7, 82.5 | F | 1 | yes |
| ellipsoid-P-3-on-a | -3 |  | held, 3358, 1743, 0.0, +4 %, 0.0, 6.1 | held, 3874, 1819, 0.0, +4 %, 0.0, 10.8 |  | 2 | no |
| ellipsoid-P-3-generic-a | -3 | air 0.57 | free, 1672, 190, 0.0, +1 %, 0.1, 0.2 | free, 2025, 190, 0.0, +1 %, 0.1, 0.4 |  | 1 | yes |
| ellipsoid-P-3m1-on-a | -3m |  | held, 3685, 2242, 0.0, +1 %, 0.0, 12.9 | held, 3964, 2242, 0.0, +1 %, 0.0, 11.7 |  | 2 | yes |
| ellipsoid-P-3m1-near-a | -3m |  | held, 10650, 8359, 0.0, +4 %, 4.4, 10.3 | held, 10592, 8498, 0.0, +4 %, 4.4, 10.3 |  | 1 | no |
| ellipsoid-P6m-near-a | 6/m |  | held, 3425, 2046, 0.0, +11 %, 7.7, 37.8 | held, 3764, 2046, 0.0, +11 %, 7.7, 37.8 |  | 1 | yes |
| ellipsoid-P6m-generic-a | 6/m | sizedist 0.39 | free, 5622, 4341, 0.0, +37 %, 20.5, 1.1 | free, 6202, 4496, 0.0, +37 %, 18.0, 0.5 |  | 1 | no |
| ellipsoid-P6mmm-on-a | 6/mmm |  | held, 3848, 2199, 0.0, +2 %, 0.0, 9.2 | held, 4915, 2892, 0.0, +2 %, 0.0, 9.9 |  | 2 | yes |
| ellipsoid-P6mmm-generic-a | 6/mmm | po 0.34 | free, 3736, 1220, 0.0, +17 %, 10.3, 22.1 | free, 4343, 1220, 0.0, +17 %, 10.3, 22.1 | F | 1 | yes |
| ellipsoid-Pm-3-on-a | m-3 | sizedist 0.09 | held, 4488, 2986, 0.0, +1 %, 0.0, 14.2 | held, 5009, 3381, 0.0, +1 %, 0.0, 12.0 |  | 1 | yes |
| ellipsoid-Pm-3-near-a | m-3 |  | free, 2958, 1698, 0.1, +7 %, 2.6, 21.6 | free, 2685, 1398, 0.0, +7 %, 2.6, 21.6 |  | 2 | yes |
| ellipsoid-Pm-3m-near-a | m-3m | sizedist 0.98 | free, 11423, 7893, 0.0, +∞, 11.6, 19.0 | free, 8249, 4513, 0.0, +∞, 11.6, 19.0 | F | 1 | no (cap) |
| ellipsoid-Pm-3m-generic-a | m-3m | air 0.63 | free, 6541, 5505, 0.0, +12 %, 3.5, 5.3 | free, 6668, 5505, 0.0, +12 %, 3.5, 13.6 |  | 1 | yes |
| spheroid-P-1-on-a | -1 | air 0.45 | held, 1621, 223, 0.0, +0 %, 0.0, 0.2 | held, 1834, 233, 0.0, +0 %, 0.0, 0.3 |  | 1 | yes |
| spheroid-P-1-generic-a | -1 |  | free, 1827, 249, 0.0, +1 %, 0.1, 1.4 | free, 2294, 249, 0.0, +1 %, 0.1, 2.3 |  | 1 | yes |
| spheroid-P2m-on-a | 2/m |  | held, 2042, 758, 0.0, +1 %, 0.0, 88.7 | held, 2163, 760, 0.0, +1 %, 0.0, 88.7 |  | 2 | yes |
| spheroid-P2m-near-a | 2/m |  | free, 1574, 213, 0.0, +1 %, 0.6, 3.2 | free, 1918, 213, 0.0, +1 %, 0.6, 14.1 |  | 1 | yes |
| spheroid-Pmmm-near-a | mmm |  | held, 3086, 1562, 0.0, +2 %, 7.5, 18.1 | held, 3610, 1625, 0.0, +2 %, 7.5, 13.5 |  | 1 | yes |
| spheroid-Pmmm-generic-a | mmm |  | free, 1326, 185, 0.0, +2 %, 0.1, 0.6 | free, 1386, 185, 0.0, +2 %, 0.1, 1.2 |  | 1 | yes |
| spheroid-P4m-on-a | 4/m | sizedist 0.66 | free, 2493, 823, 0.0, +∞, 11.6, 15.3 | free, 2878, 823, 0.0, +∞, 11.6, 15.3 | F | 1 | yes |
| spheroid-P4m-generic-a | 4/m |  | free, 3269, 2132, 0.0, +15 %, 37.5, 19.7 | free, 3116, 1734, 0.0, +15 %, 37.5, 59.0 |  | 2 | yes |
| spheroid-P4mmm-on-a | 4/mmm | impurity 0.68 | free, 1672, 506, 0.0, +1 %, 15.4, 97.1 | free, 1765, 506, 0.0, +1 %, 15.4, 97.1 | F | 1 | yes |
| spheroid-P4mmm-near-a | 4/mmm |  | free, 1341, 167, 0.0, +1 %, 1.8, 1.5 | free, 1416, 167, 0.0, +1 %, 1.8, 9.9 |  | 1 | yes |
| spheroid-P-3-near-a | -3 | sizedist 1.00 | free, 1748, 405, 0.0, +255 %, 48.1, 11.3 | free, 1915, 405, 0.0, +255 %, 48.1, 11.3 | F | 1 | yes |
| spheroid-P-3-generic-a | -3 |  | free, 2804, 1464, 0.0, +1 %, 4.7, 10.8 | free, 3090, 1464, 0.0, +1 %, 4.7, 16.8 |  | 1 | yes |
| spheroid-P-3m1-on-a | -3m | impurity 0.20 | free, 2609, 1232, 0.0, +4 %, 2.7, 10.4 | free, 2818, 1232, 0.0, +4 %, 2.7, 10.4 | F | 1 | yes |
| spheroid-P-3m1-generic-a | -3m |  | free, 1217, 165, 0.0, +4 %, 1.4, 2.8 | free, 1312, 165, 0.0, +4 %, 1.4, 10.7 |  | 1 | yes |
| spheroid-P6m-on-a | 6/m | po 0.92 | free, 2073, 506, 0.0, +∞, 72.2, 35.7 | free, 2379, 506, 0.0, +∞, 72.2, 35.7 | F | 2 | yes |
| spheroid-P6m-near-a | 6/m | po 0.57 | free, 1958, 702, 0.0, +15 %, 23.0, 42.3 | free, 2326, 702, 0.0, +15 %, 23.0, 46.6 | F | 1 | yes |
| spheroid-P6mmm-near-a | 6/mmm | hump 0.60 | free, 3750, 1313, 0.0, +29 %, 33.9, 190.1 | free, 3854, 1971, 0.0, +29 %, 33.9, 190.1 | F | 1 | no (cap) |
| spheroid-P6mmm-generic-a | 6/mmm |  | free, 1102, 162, 0.0, +0 %, 0.3, 0.6 | free, 1339, 162, 0.0, +0 %, 0.3, 1.0 |  | 1 | yes |
| spheroid-Pm-3-on-a | m-3 | sizedist 0.49 | free, 1005, 369, 0.0, +27 %, 27.6, 24.9 | free, 1146, 386, 0.0, +27 %, 27.6, 24.9 |  | 2 | yes |
| spheroid-Pm-3-generic-a | m-3 | po 0.84 | free, 1031, 210, 0.0, +9 %, 1.5, 7.6 | free, 1146, 210, 0.0, +9 %, 1.5, 7.6 | F | 1 | yes |
| spheroid-Pm-3m-on-a | m-3m |  | held, 1711, 308, 0.0, +0 %, 0.0, 4.4 | held, 1745, 230, 0.0, +0 %, 0.0, 5.6 |  | 1 | yes |
| spheroid-Pm-3m-near-a | m-3m | sizedist 0.35 | free, 840, 142, 0.0, +28 %, 10.7, 1.0 | free, 985, 142, 0.0, +28 %, 10.7, 2.0 |  | 1 | yes |
| box-P-1-on-b | -1 |  | held, 4325, 1127, 0.0, +3 %, 0.0, 2.1 | held, 4894, 1127, 0.0, +3 %, 0.0, 3.2 |  | 2 | yes |
| box-P-1-generic-b | -1 |  | free, 2165, 349, 0.0, +0 %, 0.3, 0.3 | free, 2657, 349, 0.0, +0 %, 0.3, 0.5 |  | 1 | yes |
| box-P2m-on-b | 2/m |  | held, 2927, 697, 0.0, +1 %, 0.0, 0.7 | held, 3468, 697, 0.0, +1 %, 0.0, 1.5 |  | 1 | yes |
| box-P2m-near-b | 2/m |  | free, 8359, 5410, 0.0, +13 %, 2.6, 9.4 | free, 7426, 4210, 0.0, +13 %, 2.6, 9.4 |  | 3 | no |
| box-Pmmm-near-b | mmm | hump 0.87 | free, 11539, 5649, 0.0, +28 %, 3.5, 13.4 | free, 11793, 5649, 0.0, +28 %, 3.5, 13.4 | F | 1 | yes |
| box-Pmmm-generic-b | mmm | sizedist 0.89 | free, 2523, 391, 0.0, +38 %, 3.3, 1.6 | free, 2599, 391, 0.0, +38 %, 3.3, 2.7 |  | 1 | yes |
| box-P4m-on-b | 4/m | sizedist 0.07 | held, 2470, 692, 0.0, +6 %, 0.0, 2.3 | held, 2697, 692, 0.0, +6 %, 0.0, 7.9 |  | 1 | yes |
| box-P4m-generic-b | 4/m | sizedist 0.92 | free, 4646, 2821, 0.0, +∞, 17.3, 20.1 | free, 5457, 3270, 0.0, +∞, 17.3, 28.3 |  | 4 | yes |
| box-P4mmm-on-b | 4/mmm |  | held, 2207, 282, 0.1, +2 %, 0.0, 1.4 | held, 2609, 312, 0.2, +2 %, 0.0, 2.5 |  | 1 | yes |
| box-P4mmm-near-b | 4/mmm | po 0.66 | free, 3189, 854, 0.0, +∞, 8.7, 19.5 | free, 3519, 854, 0.0, +∞, 8.7, 19.5 | F | 1 | yes |
| box-P-3-near-b | -3 |  | free, 3551, 1438, 18.9, +9 %, 8.1, 3.2 | free, 3756, 1576, 0.6, +59 %, 3.9, 5.0 | F | 1 | no (cap) |
| box-P-3-generic-b | -3 |  | free, 2652, 665, 0.0, +3 %, 1.0, 4.0 | free, 3262, 665, 0.0, +3 %, 1.0, 4.7 |  | 2 | yes |
| box-P-3m1-on-b | -3m | air 0.74 | held, 3938, 376, 0.0, +0 %, 0.0, 0.7 | held, 2970, 376, 0.0, +0 %, 0.0, 1.4 |  | 1 | yes |
| box-P-3m1-generic-b | -3m |  | free, 3148, 1890, 0.0, +44 %, 1.4, 5.8 | free, 3360, 1792, 0.0, +44 %, 1.4, 5.8 |  | 3 | yes |
| box-P6m-on-b | 6/m |  | held, 2032, 423, 0.0, +0 %, 0.0, 0.4 | held, 2292, 423, 0.0, +0 %, 0.0, 0.7 |  | 1 | yes |
| box-P6m-near-b | 6/m | po 0.59 | free, 3229, 499, 0.0, +13 %, 4.4, 6.7 | free, 3640, 499, 0.0, +13 %, 4.4, 6.7 | F | 1 | yes |
| box-P6mmm-near-b | 6/mmm |  | free, 2020, 419, 0.0, +0 %, 1.3, 1.1 | free, 2423, 419, 0.0, +0 %, 1.3, 2.5 |  | 1 | yes |
| box-P6mmm-generic-b | 6/mmm |  | free, 2015, 446, 0.0, +1 %, 0.6, 2.1 | free, 2484, 423, 0.0, +1 %, 0.6, 8.0 |  | 1 | yes |
| box-Pm-3-on-b | m-3 |  | held, 3774, 2393, 0.0, +2 %, 0.0, 3.1 | held, 3876, 2393, 0.0, +2 %, 0.0, 6.7 |  | 3 | yes |
| box-Pm-3-generic-b | m-3 | hump 0.35 | free, 4423, 1707, 33.4, +25 %, 10.1, 28.5 | free, 4335, 1361, 33.4, +25 %, 10.1, 15.2 | F | 2 | no (cap) |
| box-Pm-3m-on-b | m-3m |  | held, 7740, 6447, 0.0, +45 %, 0.0, 8.4 | held, 7743, 6447, 0.0, +45 %, 0.0, 9.7 |  | 1 | yes |
| box-Pm-3m-near-b | m-3m | impurity 0.41 | held, 8115, 6412, 0.0, +72 %, 1.5, 13.6 | held, 4433, 2727, 0.0, +72 %, 1.5, 15.6 | F | 1 | no (cap) |
| sqbox-P-1-near-b | -1 | po 0.29 | free, 7549, 1241, 0.0, +112 %, 88.1, 36.5 | free, 7231, 1151, 0.0, +112 %, 88.1, 36.5 | F | 2 | yes |
| sqbox-P-1-generic-b | -1 |  | free, 2371, 515, 0.0, +0 %, 0.1, 0.4 | free, 2942, 515, 0.0, +0 %, 0.1, 0.7 |  | 1 | yes |
| sqbox-P2m-on-b | 2/m | hump 0.65 | held, 4607, 2069, 0.0, +1 %, 0.0, 0.4 | held, 5108, 2069, 0.0, +1 %, 0.0, 0.7 | F | 1 | yes |
| sqbox-P2m-generic-b | 2/m | sizedist 0.91 | free, 6055, 516, 0.0, +22 %, 3.4, 30.1 | free, 6295, 516, 0.0, +22 %, 3.4, 30.1 | F | 1 | yes |
| sqbox-Pmmm-on-b | mmm | impurity 0.56 | held, 5799, 3531, 0.0, +1 %, 0.0, 89.1 | held, 4173, 1781, 0.0, +1 %, 0.0, 89.1 | F | 2 | no (cap) |
| sqbox-Pmmm-near-b | mmm |  | free, 3644, 611, 0.0, +0 %, 0.2, 2.0 | free, 3935, 611, 0.0, +0 %, 0.2, 3.4 |  | 1 | yes |
| sqbox-P4m-near-b | 4/m | air 0.88 | free, 2023, 290, 0.0, +3 %, 0.4, 0.5 | free, 3150, 1184, 0.0, +3 %, 0.4, 1.1 |  | 1 | yes |
| sqbox-P4m-generic-b | 4/m |  | free, 1848, 523, 0.0, +0 %, 0.6, 57.1 | free, 2248, 523, 0.0, +0 %, 0.6, 57.1 |  | 2 | yes |
| sqbox-P4mmm-on-b | 4/mmm |  | held, 2422, 654, 0.0, +0 %, 0.0, 1.0 | held, 2636, 654, 0.0, +0 %, 0.0, 1.5 |  | 1 | yes |
| sqbox-P4mmm-generic-b | 4/mmm | sizedist 0.86 | free, 6110, 585, 1.6, +91 %, 5.7, 3.2 | free, 4286, 536, 0.0, +88 %, 5.7, 3.5 | F | 1 | yes |
| sqbox-P-3-on-b | -3 | air 0.46 | held, 2694, 699, 0.0, +1 %, 0.0, 0.9 | held, 3093, 699, 0.0, +1 %, 0.0, 1.3 |  | 1 | yes |
| sqbox-P-3-near-b | -3 | sizedist 0.88 | free, 5300, 2857, 0.0, +108 %, 41.9, 56.2 | free, 4871, 2857, 0.0, +108 %, 41.9, 56.2 |  | 5 | yes |
| sqbox-P-3m1-near-b | -3m | sizedist 0.13 | free, 2132, 258, 0.0, +2 %, 1.1, 0.9 | free, 2424, 258, 0.0, +2 %, 1.1, 6.3 |  | 1 | yes |
| sqbox-P-3m1-generic-b | -3m |  | free, 1419, 269, 0.0, +1 %, 1.9, 1.4 | free, 1602, 269, 0.0, +1 %, 1.9, 2.5 |  | 1 | yes |
| sqbox-P6m-on-b | 6/m | sizedist 0.43 | held, 5069, 3836, 0.0, +325 %, 90.0, 83.1 | held, 5072, 3836, 0.0, +325 %, 90.0, 83.1 |  | 3 | no |
| sqbox-P6m-generic-b | 6/m |  | free, 2294, 237, 15.7, +0 %, 4.6, 1.0 | free, 1923, 237, 15.7, +0 %, 4.6, 1.7 |  | 1 | yes |
| sqbox-P6mmm-on-b | 6/mmm | po 0.60 | free, 5004, 3153, 2.9, +24 %, 44.9, 121.0 | free, 5436, 3153, 2.9, +24 %, 44.9, 121.0 | F | 2 | yes |
| sqbox-P6mmm-near-b | 6/mmm |  | free, 1432, 258, 0.0, +1 %, 0.1, 0.3 | free, 1534, 258, 0.0, +1 %, 0.1, 0.6 |  | 1 | yes |
| sqbox-Pm-3-near-b | m-3 |  | free, 2688, 1436, 0.0, +2 %, 0.0, 12.6 | free, 3257, 1756, 0.0, +2 %, 0.0, 12.6 |  | 5 | yes |
| sqbox-Pm-3-generic-b | m-3 |  | free, 1544, 235, 0.0, +5 %, 0.3, 0.6 | free, 1738, 235, 0.0, +5 %, 0.3, 0.9 |  | 1 | yes |
| sqbox-Pm-3m-on-b | m-3m |  | held, 2122, 758, 0.0, +1 %, 0.0, 1.2 | held, 2125, 758, 0.0, +1 %, 0.0, 2.3 |  | 1 | yes |
| sqbox-Pm-3m-generic-b | m-3m | impurity 0.86 | held, 7443, 6057, 0.0, +7 %, 9.5, 19.3 | held, 3816, 2234, 0.0, +7 %, 9.5, 14.6 | F | 2 | no (cap) |
| cylinder-P-1-on-b | -1 |  | held, 3954, 502, 0.0, +0 %, 0.0, 0.2 | held, 4430, 502, 0.0, +0 %, 0.0, 0.4 |  | 1 | yes |
| cylinder-P-1-near-b | -1 | impurity 0.80 | free, 2473, 487, 0.0, +10 %, 1.3, 8.2 | free, 3081, 571, 0.0, +10 %, 1.3, 8.2 | F | 1 | yes |
| cylinder-P2m-near-b | 2/m | po 0.96 | free, 5168, 776, 0.0, +∞, 10.3, 43.5 | free, 5649, 776, 0.0, +∞, 10.3, 43.5 | F | 1 | yes |
| cylinder-P2m-generic-b | 2/m |  | free, 1738, 267, 0.0, +3 %, 1.0, 0.7 | free, 2179, 267, 0.0, +3 %, 1.0, 1.1 |  | 1 | yes |
| cylinder-Pmmm-on-b | mmm |  | held, 2037, 410, 0.0, +1 %, 0.0, 4.4 | held, 2394, 410, 0.0, +1 %, 0.0, 3.3 |  | 1 | yes |
| cylinder-Pmmm-generic-b | mmm | hump 0.55 | free, 2424, 1062, 0.0, +4 %, 8.8, 24.1 | free, 2796, 1062, 0.0, +4 %, 8.8, 24.1 | F | 1 | yes |
| cylinder-P4m-on-b | 4/m |  | held, 2839, 829, 0.0, +0 %, 0.0, 0.4 | held, 3165, 829, 0.0, +0 %, 0.0, 0.6 |  | 1 | yes |
| cylinder-P4m-near-b | 4/m | sizedist 0.76 | free, 2627, 805, 0.0, +136 %, 8.7, 8.7 | free, 2975, 805, 0.0, +136 %, 8.7, 8.7 | F | 1 | yes |
| cylinder-P4mmm-near-b | 4/mmm | po 0.27 | free, 1854, 437, 0.0, +6 %, 3.7, 2.3 | free, 2061, 454, 0.0, +6 %, 3.7, 9.6 |  | 1 | yes |
| cylinder-P4mmm-generic-b | 4/mmm |  | free, 1635, 314, 0.0, +1 %, 0.6, 1.4 | free, 1758, 354, 0.0, +1 %, 0.6, 3.0 |  | 1 | yes |
| cylinder-P-3-on-b | -3 | sizedist 0.58 | free, 2448, 1177, 0.0, +74 %, 38.9, 5.0 | free, 2839, 1411, 0.0, +74 %, 38.9, 31.6 |  | 3 | yes |
| cylinder-P-3-generic-b | -3 | impurity 0.23 | free, 1991, 336, 0.0, +1 %, 2.4, 33.0 | free, 2258, 336, 0.0, +1 %, 2.4, 33.0 | F | 1 | yes |
| cylinder-P-3m1-on-b | -3m |  | held, 2534, 1352, 0.0, +3 %, 0.0, 14.1 | held, 2724, 1352, 0.0, +3 %, 0.0, 21.1 |  | 1 | yes |
| cylinder-P-3m1-near-b | -3m | air 0.15 | held, 2872, 1707, 0.0, +2 %, 2.5, 26.7 | held, 2984, 1707, 0.0, +2 %, 2.5, 40.0 |  | 1 | yes |
| cylinder-P6m-near-b | 6/m |  | held, 2649, 1532, 0.0, +31 %, 9.0, 71.5 | held, 2652, 1532, 0.0, +31 %, 9.0, 71.5 |  | 2 | yes |
| cylinder-P6m-generic-b | 6/m | air 0.19 | held, 2266, 1070, 0.0, +8 %, 27.4, 68.0 | held, 2269, 1070, 0.0, +8 %, 27.4, 68.0 | F | 3 | yes |
| cylinder-P6mmm-on-b | 6/mmm |  | held, 1399, 234, 0.0, +9 %, 0.0, 2.6 | held, 1680, 234, 0.0, +9 %, 0.0, 5.5 |  | 1 | yes |
| cylinder-P6mmm-generic-b | 6/mmm | sizedist 0.23 | free, 1388, 311, 0.0, +11 %, 6.8, 2.1 | free, 1637, 311, 0.0, +11 %, 6.8, 4.7 |  | 1 | yes |
| cylinder-Pm-3-on-b | m-3 |  | held, 923, 176, 0.0, +1 %, 0.0, 6.2 | held, 1074, 176, 0.0, +1 %, 0.0, 5.3 |  | 1 | yes |
| cylinder-Pm-3-near-b | m-3 | sizedist 0.38 | free, 1494, 319, 0.0, +10 %, 4.0, 1.4 | free, 1553, 299, 0.0, +10 %, 4.0, 2.6 |  | 1 | yes |
| cylinder-Pm-3m-near-b | m-3m |  | free, 954, 193, 0.0, +0 %, 0.4, 1.4 | free, 1108, 193, 0.0, +0 %, 0.4, 8.0 |  | 1 | yes |
| cylinder-Pm-3m-generic-b | m-3m |  | free, 1234, 284, 0.0, +1 %, 1.1, 1.9 | free, 1427, 285, 0.0, +1 %, 1.1, 4.1 |  | 1 | yes |
| ellcyl-P-1-on-b | -1 |  | held, 2393, 316, 0.0, +1 %, 0.0, 0.4 | held, 2941, 316, 0.0, +1 %, 0.0, 0.8 |  | 1 | yes |
| ellcyl-P-1-generic-b | -1 |  | free, 2451, 451, 0.0, +3 %, 1.5, 1.5 | free, 3003, 451, 0.0, +3 %, 1.5, 3.2 |  | 1 | yes |
| ellcyl-P2m-on-b | 2/m | po 0.77 | free, 7286, 2365, 0.0, +∞, 80.2, 86.0 | free, 7728, 2365, 0.0, +∞, 80.2, 86.0 | F | 2 | yes |
| ellcyl-P2m-near-b | 2/m |  | free, 3132, 1231, 0.0, +11 %, 1.5, 2.9 | free, 4847, 2413, 0.0, +11 %, 1.5, 9.4 |  | 1 | yes |
| ellcyl-Pmmm-near-b | mmm |  | held, 12875, 10308, 0.0, +1 %, 8.3, 26.7 | held, 15202, 12174, 0.0, +1 %, 8.3, 21.4 |  | 1 | yes |
| ellcyl-Pmmm-generic-b | mmm | po 0.08 | free, 2819, 1113, 0.0, +96 %, 50.7, 46.0 | free, 3699, 1679, 0.0, +96 %, 50.7, 46.0 | F | 1 | yes |
| ellcyl-P4m-on-b | 4/m |  | held, 2480, 375, 0.0, +1 %, 0.0, 0.9 | held, 2894, 375, 0.0, +1 %, 0.0, 1.4 |  | 1 | yes |
| ellcyl-P4m-generic-b | 4/m |  | free, 8547, 6597, 0.2, +19 %, 7.4, 18.9 | free, 8903, 6622, 0.2, +19 %, 7.4, 34.7 |  | 4 | no |
| ellcyl-P4mmm-on-b | 4/mmm | air 0.01 | free, 9223, 6479, 0.0, +33 %, 11.9, 22.9 | free, 9470, 6479, 0.0, +33 %, 11.9, 22.9 | F | 1 | yes |
| ellcyl-P4mmm-near-b | 4/mmm | sizedist 0.35 | free, 5740, 4112, 0.0, +101 %, 4.1, 51.9 | free, 6651, 4824, 0.0, +101 %, 4.1, 51.7 |  | 2 | yes |
| ellcyl-P-3-near-b | -3 |  | free, 2360, 518, 0.0, +2 %, 6.4, 6.7 | free, 2668, 518, 0.0, +2 %, 6.4, 6.7 |  | 2 | yes |
| ellcyl-P-3-generic-b | -3 |  | free, 2117, 495, 0.0, +2 %, 0.1, 0.8 | free, 2442, 495, 0.0, +2 %, 0.1, 1.2 |  | 2 | yes |
| ellcyl-P-3m1-on-b | -3m | po 0.21 | free, 5335, 1009, 0.0, +44 %, 10.5, 14.1 | free, 5803, 1009, 0.0, +44 %, 10.5, 14.1 | F | 1 | yes |
| ellcyl-P-3m1-generic-b | -3m | hump 0.44 | free, 2347, 257, 0.0, +∞, 12.2, 26.2 | free, 2713, 283, 0.0, +∞, 12.2, 27.1 | F | 1 | yes |
| ellcyl-P6m-on-b | 6/m |  | held, 5425, 3824, 0.0, +9 %, 0.0, 72.1 | held, 5670, 3824, 0.0, +9 %, 0.0, 72.1 |  | 4 | no |
| ellcyl-P6m-near-b | 6/m | hump 0.53 | free, 5460, 2604, 36.9, +4884 %, 36.2, 37.0 | free, 5850, 2604, 36.9, +4884 %, 36.2, 37.0 | F | 1 | yes |
| ellcyl-P6mmm-near-b | 6/mmm | impurity 0.09 | free, 3806, 1011, 64.3, +102 %, 20.9, 13.2 | free, 3269, 419, 2.4, +2 %, 3.5, 8.4 | F | 1 | yes |
| ellcyl-P6mmm-generic-b | 6/mmm |  | free, 1806, 242, 0.0, +1 %, 0.7, 0.7 | free, 2115, 242, 0.0, +1 %, 0.7, 1.1 |  | 1 | yes |
| ellcyl-Pm-3-on-b | m-3 |  | held, 6795, 4946, 0.0, +571 %, 0.0, 3.4 | held, 7038, 4946, 0.0, +571 %, 0.0, 4.8 |  | 1 | yes |
| ellcyl-Pm-3-generic-b | m-3 | po 0.90 | free, 4085, 285, 68.9, +421 %, 20.4, 15.7 | free, 4198, 285, 68.9, +421 %, 20.4, 15.7 | F | 1 | yes |
| ellcyl-Pm-3m-on-b | m-3m | sizedist 0.18 | free, 3859, 1977, 0.0, +10 %, 12.7, 1.2 | free, 4083, 1977, 0.0, +10 %, 12.7, 2.4 |  | 1 | yes |
| ellcyl-Pm-3m-near-b | m-3m |  | free, 3150, 1443, 0.0, +4 %, 1.1, 2.6 | free, 3153, 1443, 0.0, +4 %, 1.1, 17.4 |  | 1 | yes |
| ellipsoid-P-1-near-b | -1 | sizedist 0.70 | free, 2364, 254, 0.0, +19 %, 0.5, 2.0 | free, 2958, 254, 0.0, +19 %, 0.5, 2.0 | F | 1 | yes |
| ellipsoid-P-1-generic-b | -1 |  | free, 2048, 264, 0.0, +1 %, 0.1, 0.2 | free, 2643, 264, 0.0, +1 %, 0.1, 0.3 |  | 1 | yes |
| ellipsoid-P2m-on-b | 2/m | po 0.26 | free, 2280, 634, 0.0, +47 %, 13.2, 15.4 | free, 2789, 634, 0.0, +47 %, 13.2, 15.4 | F | 1 | yes |
| ellipsoid-P2m-generic-b | 2/m | impurity 0.16 | free, 4064, 1632, 0.1, +4 %, 14.4, 26.6 | free, 4505, 1659, 0.0, +4 %, 14.4, 26.6 | F | 1 | yes |
| ellipsoid-Pmmm-on-b | mmm |  | held, 9256, 7376, 0.0, +3 %, 0.0, 14.4 | held, 11806, 9406, 0.0, +3 %, 0.0, 16.0 |  | 1 | yes |
| ellipsoid-Pmmm-near-b | mmm |  | held, 3741, 1629, 0.1, +20 %, 7.5, 21.4 | held, 4191, 1703, 0.0, +20 %, 7.5, 17.5 |  | 1 | no |
| ellipsoid-P4m-near-b | 4/m |  | held, 8499, 6475, 0.0, +7 %, 6.3, 15.5 | held, 8847, 6339, 0.0, +7 %, 6.3, 16.3 |  | 1 | no |
| ellipsoid-P4m-generic-b | 4/m |  | free, 6856, 4621, 0.0, +19 %, 0.8, 10.3 | free, 7182, 4519, 0.0, +19 %, 0.8, 10.3 |  | 2 | yes |
| ellipsoid-P4mmm-on-b | 4/mmm |  | held, 3146, 1439, 0.0, +3 %, 0.0, 20.4 | held, 3396, 1439, 0.0, +3 %, 0.0, 20.4 |  | 1 | yes |
| ellipsoid-P4mmm-generic-b | 4/mmm |  | free, 1717, 213, 0.0, +5 %, 0.2, 0.6 | free, 2014, 213, 0.0, +5 %, 0.2, 1.3 |  | 1 | yes |
| ellipsoid-P-3-on-b | -3 |  | free, 9387, 7815, 0.0, +7 %, 12.3, 18.5 | free, 9717, 7815, 0.0, +7 %, 12.3, 31.7 |  | 2 | yes |
| ellipsoid-P-3-near-b | -3 | sizedist 0.78 | free, 3547, 863, 0.0, +∞, 7.1, 52.8 | free, 3895, 863, 0.0, +∞, 7.1, 52.8 | F | 1 | yes |
| ellipsoid-P-3m1-near-b | -3m | air 0.82 | held, 5497, 3027, 0.0, +23 %, 1.5, 2.4 | held, 5664, 3027, 0.0, +23 %, 1.5, 3.4 |  | 1 | yes |
| ellipsoid-P-3m1-generic-b | -3m | impurity 0.49 | free, 14203, 12413, 0.0, +16 %, 1.6, 4.6 | free, 8394, 6249, 0.0, +16 %, 1.6, 5.5 | F | 1 | no (cap) |
| ellipsoid-P6m-on-b | 6/m | hump 0.07 | free, 4735, 2929, 0.0, +11 %, 9.0, 20.2 | free, 5289, 2998, 0.0, +10 %, 9.0, 13.2 | F | 1 | yes |
| ellipsoid-P6m-generic-b | 6/m | po 0.99 | free, 2259, 1053, 0.0, +24 %, 15.3, 18.7 | free, 2557, 1053, 0.0, +24 %, 15.3, 18.7 | F | 2 | yes |
| ellipsoid-P6mmm-on-b | 6/mmm | hump 0.89 | held, 3102, 1682, 0.0, +14 %, 20.7, 5.1 | held, 3121, 1682, 0.0, +14 %, 20.7, 10.3 | F | 1 | yes |
| ellipsoid-P6mmm-near-b | 6/mmm |  | free, 1668, 238, 0.0, +0 %, 0.1, 2.8 | free, 1948, 238, 0.0, +0 %, 0.1, 5.9 |  | 1 | yes |
| ellipsoid-Pm-3-near-b | m-3 | sizedist 0.64 | free, 1537, 474, 0.0, +73 %, 4.6, 3.3 | free, 1725, 300, 25.6, +171 %, 25.2, 38.2 | F | 1 | yes |
| ellipsoid-Pm-3-generic-b | m-3 |  | free, 3663, 2487, 0.0, +6 %, 1.2, 24.1 | free, 4223, 2712, 0.0, +6 %, 1.2, 11.4 |  | 2 | yes |
| ellipsoid-Pm-3m-on-b | m-3m | sizedist 0.62 | free, 4379, 3197, 0.0, +68 %, 25.2, 48.6 | free, 4592, 3197, 0.0, +68 %, 25.2, 46.8 |  | 2 | no |
| ellipsoid-Pm-3m-generic-b | m-3m | po 0.81 | free, 1545, 495, 0.0, +347 %, 5.4, 15.8 | free, 1747, 495, 0.0, +347 %, 5.4, 15.8 | F | 2 | yes |
| spheroid-P-1-on-b | -1 | sizedist 0.82 | held, 1768, 276, 0.0, +37 %, —, — | held, 2240, 276, 0.0, +37 %, —, — | F | 1 | yes |
| spheroid-P-1-near-b | -1 | po 0.56 | free, 2177, 384, 0.0, +47 %, 46.3, 33.1 | free, 2413, 384, 0.0, +47 %, 46.3, 33.1 | F | 1 | yes |
| spheroid-P2m-near-b | 2/m |  | free, 1777, 213, 0.0, +1 %, 0.2, 0.8 | free, 2239, 213, 0.0, +1 %, 0.2, 1.6 |  | 1 | yes |
| spheroid-P2m-generic-b | 2/m |  | free, 1470, 213, 0.0, +1 %, 0.2, 0.3 | free, 1853, 213, 0.0, +1 %, 0.2, 0.6 |  | 1 | yes |
| spheroid-Pmmm-on-b | mmm | impurity 0.59 | held, 1753, 453, 0.0, +13 %, 20.8, 24.0 | held, 2160, 453, 0.0, +13 %, 20.8, 32.8 | F | 1 | yes |
| spheroid-Pmmm-generic-b | mmm | po 0.31 | free, 1621, 414, 0.0, +4 %, 10.7, 6.2 | free, 2039, 412, 0.0, +4 %, 10.7, 18.9 | F | 1 | yes |
| spheroid-P4m-on-b | 4/m | hump 0.72 | held, 1965, 620, 0.0, +10 %, 0.0, 4.9 | held, 2260, 620, 0.0, +10 %, 0.0, 5.9 | F | 1 | yes |
| spheroid-P4m-near-b | 4/m |  | free, 1499, 569, 0.0, +1 %, 2.1, 19.7 | free, 1646, 569, 0.0, +1 %, 2.1, 19.7 |  | 2 | yes |
| spheroid-P4mmm-near-b | 4/mmm | po 0.20 | free, 4903, 2549, 0.0, +17 %, 21.6, 52.7 | free, 5118, 2549, 0.0, +17 %, 21.6, 52.7 | F | 1 | yes |
| spheroid-P4mmm-generic-b | 4/mmm | sizedist 0.14 | free, 1468, 196, 0.0, +11 %, 4.3, 11.8 | free, 1832, 196, 0.0, +11 %, 4.3, 33.2 |  | 1 | yes |
| spheroid-P-3-on-b | -3 |  | held, 1574, 412, 0.0, +1 %, 0.0, 5.6 | held, 1752, 412, 0.0, +1 %, 0.0, 11.6 |  | 1 | yes |
| spheroid-P-3-generic-b | -3 |  | free, 1211, 158, 0.0, +3 %, 0.5, 0.8 | free, 1489, 158, 0.0, +3 %, 0.5, 1.4 |  | 1 | yes |
| spheroid-P-3m1-on-b | -3m |  | held, 1205, 167, 0.0, +0 %, 0.0, 2.1 | held, 1288, 158, 0.0, +0 %, 0.0, 3.8 |  | 1 | yes |
| spheroid-P-3m1-near-b | -3m |  | held, 4930, 2531, 0.0, +2 %, 3.9, 18.2 | held, 5211, 2531, 0.0, +2 %, 3.9, 16.0 |  | 1 | yes |
| spheroid-P6m-near-b | 6/m | air 0.93 | free, 1609, 552, 0.0, +1 %, 8.5, 4.9 | free, 1885, 552, 0.0, +1 %, 8.5, 8.2 |  | 1 | yes |
| spheroid-P6m-generic-b | 6/m |  | free, 1397, 411, 0.0, +5 %, 0.4, 23.5 | free, 1488, 411, 0.0, +5 %, 0.4, 23.5 |  | 2 | yes |
| spheroid-P6mmm-on-b | 6/mmm | po 0.91 | free, 2723, 1477, 0.0, +68 %, 20.8, 100.2 | free, 2288, 1057, 0.0, +68 %, 20.8, 100.2 | F | 2 | no (cap) |
| spheroid-P6mmm-generic-b | 6/mmm | air 0.97 | held, 2162, 1015, 0.0, +6 %, 16.6, 27.8 | held, 2165, 1015, 0.0, +6 %, 16.6, 27.8 |  | 2 | yes |
| spheroid-Pm-3-on-b | m-3 |  | rejected, 832, 0, 0.0, —, —, — | rejected, 835, 0, 0.0, —, —, — |  | — | — |
| spheroid-Pm-3-near-b | m-3 |  | held, 1083, 298, 0.0, +2 %, 4.9, 12.5 | held, 1169, 298, 0.0, +2 %, 4.9, 12.2 |  | 1 | yes |
| spheroid-Pm-3m-near-b | m-3m |  | held, 2016, 1223, 0.0, +1 %, 5.2, 21.6 | held, 2119, 1259, 0.0, +1 %, 5.2, 18.9 |  | 1 | yes |
| spheroid-Pm-3m-generic-b | m-3m | hump 0.28 | free, 757, 142, 0.0, +14 %, 1.2, 9.5 | free, 850, 142, 0.0, +14 %, 1.2, 11.7 | F | 1 | yes |
| sphere-P-1-2 | -1 |  | early, 1376, 0, —, —, —, — | early, 1379, 0, —, —, —, — |  | — | — |
| sphere-P-1-3 | -1 | hump 0.46 | free, 1957, 357, —, —, —, — | free, 2188, 357, —, —, —, — | F | — | yes |
| sphere-P-1-5 | -1 |  | early, 1442, 0, —, —, —, — | early, 1588, 0, —, —, —, — |  | — | — |
| sphere-P-1-6 | -1 | sizedist 0.95 | free, 7190, 4845, —, —, —, — | free, 7721, 4845, —, —, —, — | F | — | no (cap) |
| sphere-P2m-1 | 2/m |  | early, 1320, 0, —, —, —, — | early, 1437, 0, —, —, —, — |  | — | — |
| sphere-P2m-3 | 2/m | impurity 0.61 | rejected, 1892, 0, —, —, —, — | rejected, 2246, 0, —, —, —, — | F | — | — |
| sphere-P2m-4 | 2/m | sizedist 0.37 | free, 5268, 3330, —, —, —, — | free, 5304, 3330, —, —, —, — |  | — | yes |
| sphere-P2m-6 | 2/m |  | early, 1270, 0, —, —, —, — | early, 1273, 0, —, —, —, — |  | — | — |
| sphere-Pmmm-1 | mmm | sizedist 0.33 | free, 2866, 1270, —, —, —, — | free, 2869, 1270, —, —, —, — |  | — | yes |
| sphere-Pmmm-2 | mmm |  | early, 1225, 0, —, —, —, — | early, 1334, 0, —, —, —, — |  | — | — |
| sphere-Pmmm-4 | mmm | sizedist 0.58 | free, 2804, 1282, —, —, —, — | free, 3032, 1282, —, —, —, — | F | — | yes |
| sphere-Pmmm-5 | mmm |  | early, 1196, 0, —, —, —, — | early, 1305, 0, —, —, —, — |  | — | — |
| sphere-P4m-2 | 4/m | po 0.83 | free, 4255, 2007, —, —, —, — | free, 4816, 2485, —, —, —, — | F | — | yes |
| sphere-P4m-3 | 4/m | sizedist 0.78 | free, 1877, 803, —, —, —, — | free, 1942, 803, —, —, —, — |  | — | yes |
| sphere-P4m-5 | 4/m |  | early, 930, 0, —, —, —, — | early, 933, 0, —, —, —, — |  | — | — |
| sphere-P4m-6 | 4/m |  | early, 1126, 0, —, —, —, — | early, 1129, 0, —, —, —, — |  | — | — |
| sphere-P4mmm-1 | 4/mmm |  | early, 1019, 0, —, —, —, — | early, 1022, 0, —, —, —, — |  | — | — |
| sphere-P4mmm-3 | 4/mmm |  | early, 1024, 0, —, —, —, — | early, 1027, 0, —, —, —, — |  | — | — |
| sphere-P4mmm-4 | 4/mmm | po 0.57 | held, 3801, 2436, —, —, —, — | held, 2519, 1151, —, —, —, — | F | — | no (cap) |
| sphere-P4mmm-6 | 4/mmm |  | early, 1000, 0, —, —, —, — | early, 1003, 0, —, —, —, — |  | — | — |
| sphere-P-3-1 | -3 | sizedist 0.30 | free, 4539, 1984, —, —, —, — | free, 3992, 1700, —, —, —, — |  | — | yes |
| sphere-P-3-2 | -3 |  | early, 993, 0, —, —, —, — | early, 996, 0, —, —, —, — |  | — | — |
| sphere-P-3-4 | -3 | sizedist 0.13 | early, 1177, 0, —, —, —, — | early, 1180, 0, —, —, —, — |  | — | — |
| sphere-P-3-5 | -3 |  | early, 1121, 0, —, —, —, — | early, 1240, 0, —, —, —, — |  | — | — |
| sphere-P-3m1-2 | -3m |  | early, 981, 0, —, —, —, — | early, 984, 0, —, —, —, — |  | — | — |
| sphere-P-3m1-3 | -3m | impurity 0.92 | free, 3488, 1879, —, —, —, — | free, 3685, 1879, —, —, —, — | F | — | no (cap) |
| sphere-P-3m1-5 | -3m |  | early, 892, 0, —, —, —, — | early, 895, 0, —, —, —, — |  | — | — |
| sphere-P-3m1-6 | -3m | hump 0.69 | early, 980, 0, —, —, —, — | early, 983, 0, —, —, —, — | F | — | — |
| sphere-P6m-1 | 6/m | po 0.10 | held, 7628, 4708, —, —, —, — | held, 5605, 2286, —, —, —, — | F | — | no (cap) |
| sphere-P6m-3 | 6/m |  | early, 806, 0, —, —, —, — | early, 899, 0, —, —, —, — |  | — | — |
| sphere-P6m-4 | 6/m | impurity 0.49 | held, 4116, 2886, —, —, —, — | held, 3335, 2027, —, —, —, — | F | — | no (cap) |
| sphere-P6m-6 | 6/m | air 0.75 | early, 910, 0, —, —, —, — | early, 1206, 0, —, —, —, — | F | — | — |
| sphere-P6mmm-1 | 6/mmm |  | early, 742, 0, —, —, —, — | early, 836, 0, —, —, —, — |  | — | — |
| sphere-P6mmm-2 | 6/mmm | po 0.89 | free, 3165, 1455, —, —, —, — | free, 3431, 1431, —, —, —, — | F | — | yes |
| sphere-P6mmm-4 | 6/mmm |  | early, 906, 0, —, —, —, — | early, 1010, 0, —, —, —, — |  | — | — |
| sphere-P6mmm-5 | 6/mmm | po 0.45 | held, 6020, 4142, —, —, —, — | held, 4853, 2892, —, —, —, — | F | — | no (cap) |
| sphere-Pm-3-2 | m-3 | air 0.08 | early, 718, 0, —, —, —, — | early, 721, 0, —, —, —, — |  | — | — |
| sphere-Pm-3-3 | m-3 | po 0.19 | early, 528, 0, —, —, —, — | early, 615, 0, —, —, —, — |  | — | — |
| sphere-Pm-3-5 | m-3 |  | early, 748, 0, —, —, —, — | early, 751, 0, —, —, —, — |  | — | — |
| sphere-Pm-3-6 | m-3 | air 0.05 | early, 637, 0, —, —, —, — | early, 640, 0, —, —, —, — |  | — | — |
| sphere-Pm-3m-1 | m-3m | hump 0.64 | early, 588, 0, —, —, —, — | early, 591, 0, —, —, —, — | F | — | — |
| sphere-Pm-3m-3 | m-3m |  | early, 533, 0, —, —, —, — | early, 536, 0, —, —, —, — |  | — | — |
| sphere-Pm-3m-4 | m-3m |  | early, 704, 0, —, —, —, — | early, 707, 0, —, —, —, — |  | — | — |
| sphere-Pm-3m-6 | m-3m |  | early, 535, 0, —, —, —, — | early, 538, 0, —, —, —, — |  | — | — |
