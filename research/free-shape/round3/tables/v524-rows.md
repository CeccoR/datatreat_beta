# Round 3: tuning part (screen), 77 rows (66 truths, 11 spheres); round 3 77 records, round 2 77

| method | runs | truths: held / free / rejected (early) | spheres kept: clean / error | reached / judged | unbounded | worst, median (90 %) | thinnest | axis °, median (90 %) | search evaluations (× round 2; per run median) | of which the minima stage | report evaluations | not explored (capped) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| round 2 | 77 | 22 / 43 / 1 (1) | 0/6 / 3/5 | 61 / 65 | 4 | +5 % (+185 %) | +0 % | 1.4 (30.6) | 301733 (1.000; 1.000) | 142010 (max 8316) | 232946 | 12 (2) |
| round 3 | 77 | 22 / 43 / 1 (1) | 0/6 / 3/5 | 60 / 65 | 5 | +6 % (+234 %) | +0 % | 1.5 (30.7) | 308907 (1.024; 0.990) | 149867 (max 13623) | 233446 | 11 (2) |

- clean truths kept by both (33): round 2 worst +2 % (90 % +33 %), thinnest +0 %, axis 0.3°, unbounded 0, anisotropy 1.00; round 3 worst +3 % (90 % +51 %), thinnest -0 %, axis 0.9°, unbounded 0, anisotropy 1.00
- with an error truths kept by both (32): round 2 worst +10 % (90 % +∞), thinnest +0 %, axis 4.2°, unbounded 4, anisotropy 1.00; round 3 worst +11 % (90 % +∞), thinnest +0 %, axis 4.8°, unbounded 5, anisotropy 1.00

Outcome changed (round 2 → round 3) on 0: —.

Not reached, round 2 (4): sqbox-P6m-near-a (impurity) Δ 1.6, ellcyl-P4m-near-a (air) Δ 1.3, ellcyl-P-3-on-a (po) Δ 1.7, ellcyl-P-3m1-near-a Δ 2.7.
Not reached, round 3 (5): box-Pm-3-near-a Δ 1292.5, sqbox-P2m-near-a (po) Δ 771.3, ellcyl-P4m-near-a (air) Δ 14.0, ellcyl-P4mmm-generic-a Δ 148.1, ellcyl-P-3m1-near-a Δ 4.8.

**The two errors** (kept truths; E the engine's reported interval and radius):

| method | kept truths | runs | extents (unbounded) | E covered | median half-width E | principal axes E covered | median radius E | E radius ÷ error, clean misses |
|---|---|---|---|---|---|---|---|---|
| round 2 | clean | 33 | 82 (0) | 78/82 (95 %) | 3.5 % | 31/32 (97 %) | 6.1° | spheroid-P4m-generic-a 37.5/24.3° |
| round 2 | error, not flagged | 10 | 27 (0) | 22/27 (81 %) | 8.0 % | 10/10 (100 %) | 8.5° |  |
| round 2 | error, flagged | 22 | 50 (4) | 38/50 (76 %) | 23.3 % | 17/22 (77 %) | 14.7° |  |
| round 2 | all kept | 65 | 159 (4) | 138/159 (87 %) | 6.4 % | 58/64 (91 %) | 10.8° |  |
| round 3 | clean | 32 | 79 (0) | 73/79 (92 %) | 3.5 % | 30/31 (97 %) | 4.3° | spheroid-P4m-generic-a 37.5/22.0° |
| round 3 | clean, flagged | 1 | 3 (0) | 3/3 (100 %) | 12.6 % | 1/1 (100 %) | 14.7° |  |
| round 3 | error, not flagged | 10 | 27 (0) | 22/27 (81 %) | 7.4 % | 10/10 (100 %) | 8.8° |  |
| round 3 | error, flagged | 22 | 49 (5) | 36/49 (73 %) | 18.9 % | 17/22 (77 %) | 14.5° |  |
| round 3 | all kept | 65 | 158 (5) | 134/158 (85 %) | 6.6 % | 58/64 (91 %) | 11.3° |  |

**Uniqueness** (round 3; one minimum within Δ*; covered by E):

| kept truths | unique | unique, covered | several | several, covered |
|---|---|---|---|---|
| clean | 25/32 | 23 | 7 | 3 |
| clean, flagged | 1/1 | 1 | 0 | 0 |
| error, not flagged | 6/10 | 4 | 4 | 3 |
| error, flagged | 17/22 | 9 | 5 | 4 |

**The per-line check** (round 3; the fit returned, or beside a rejection the isotropic fit):

| rows | runs | flagged | spoiled | spoiled and flagged | z median / max |
|---|---|---|---|---|---|
| clean truths | 33 | 1 | 7 | 1 | 0.61 / 6.33 |
| clean spheres | 6 | 0 | 0 | 0 | 0.20 / 1.82 |
| hump | 4 | 4 | 1 | 1 | 11.26 / 51.12 |
| sizedist | 12 | 5 | 6 | 4 | 1.53 / 16.21 |
| impurity | 6 | 6 | 2 | 2 | 87.10 / 132.69 |
| air | 5 | 1 | 0 | 0 | 0.81 / 18.78 |
| po | 11 | 9 | 9 | 8 | 39.47 / 464.48 |
| all with an error | 38 | 25 | 18 | 15 | 13.93 / 464.48 |

Spoiled and not flagged: box-P2m-generic-a (none), box-P-3-on-a (none), box-P6m-generic-a (none), ellcyl-P6m-generic-a (none), ellcyl-Pm-3-near-a (none), ellcyl-Pm-3m-generic-a (po 0.49), spheroid-P4m-generic-a (none), sphere-Pmmm-1 (sizedist 0.33), sphere-P-3-1 (sizedist 0.30). Clean rows flagged: box-Pm-3-near-a z 6.33.

**The jackknife** (round 3, flagged kept truths with an error, by kind: extents E covered / n, axes E covered / n):

- hump: 3 rows, extents 5/7 (unbounded 0), axes 3/3
- sizedist: 5 rows, extents 5/11 (unbounded 1), axes 3/5
- impurity: 5 rows, extents 13/13 (unbounded 0), axes 5/5
- air: 1 rows, extents 2/3 (unbounded 0), axes 1/1
- po: 8 rows, extents 11/15 (unbounded 4), axes 5/8

**The keep test** (shapes kept):

| rows | runs | round 2 | round 3 |
|---|---|---|---|
| clean truths | 33 | 33 | 33 |
| truths with an error | 33 | 32 | 32 |
| clean spheres | 6 | 0 | 0 |
| spheres with an error | 5 | 3 | 3 |

Truths round 3 rejects: cylinder-Pm-3-generic-a (hump; G —, need 13.2, early).
Spheres round 3 keeps: sphere-Pmmm-1 (sizedist 0.33); sphere-P4m-2 (po 0.83, flagged); sphere-P-3-1 (sizedist 0.30).

| row | class | error | round 2: outcome, search evals, stage evals, Δ, worst, axis°, axis radius° | round 3: outcome, search evals, stage evals, Δ, worst, axis°, axis radius° | flag | minima ≤ Δ* | explored |
|---|---|---|---|---|---|---|---|
| box-P-1-near-a | -1 | po 0.52 | free, 6088, 2312, 0.0, +397 %, 14.2, 11.3 | free, 5562, 1653, 0.0, +391 %, 14.2, 11.2 | F | 1 | yes |
| box-P2m-generic-a | 2/m |  | free, 2638, 1034, 0.0, +29 %, 2.0, 13.0 | free, 2742, 1099, 0.0, +29 %, 2.0, 13.0 |  | 1 | yes |
| box-Pmmm-on-a | mmm | air 0.34 | held, 11105, 8144, 0.0, +3 %, 0.0, 5.0 | held, 10649, 7845, 0.0, +3 %, 0.0, 5.8 |  | 1 | yes |
| box-P4m-near-a | 4/m | impurity 0.83 | free, 5838, 3333, 0.0, +7 %, 1.5, 15.2 | free, 8680, 6426, 0.0, +7 %, 0.2, 15.3 | F | 3 | no |
| box-P4mmm-generic-a | 4/mmm |  | free, 3023, 1083, 0.0, +7 %, 0.2, 4.0 | free, 2438, 449, 0.0, +7 %, 0.2, 4.0 |  | 1 | yes |
| box-P-3-on-a | -3 |  | held, 8166, 5542, 0.0, +34 %, 0.0, 2.3 | held, 6686, 4009, 0.0, +34 %, 0.0, 2.3 |  | 1 | yes |
| box-P-3m1-near-a | -3m | po 0.06 | free, 3306, 660, 0.0, +∞, 9.3, 14.2 | free, 3373, 633, 0.0, +∞, 9.3, 13.6 | F | 1 | yes |
| box-P6m-generic-a | 6/m |  | free, 6091, 4699, 0.0, +83 %, 2.7, 34.0 | free, 5095, 3682, 0.0, +72 %, 2.9, 33.9 |  | 3 | yes |
| box-P6mmm-on-a | 6/mmm |  | held, 2908, 519, 0.0, +6 %, 0.0, 1.7 | held, 2943, 519, 0.0, +6 %, 0.0, 1.7 |  | 1 | yes |
| box-Pm-3-near-a | m-3 |  | free, 3859, 293, 0.0, +2 %, 0.4, 0.9 | free, 3098, 390, 1292.5, +146 %, 7.7, 14.7 | F | 1 | yes |
| box-Pm-3m-generic-a | m-3m | sizedist 0.29 | free, 5748, 4211, 0.0, +9 %, 8.2, 21.8 | free, 6398, 4792, 0.0, +9 %, 8.1, 22.0 |  | 3 | no |
| sqbox-P-1-on-a | -1 |  | held, 5646, 552, 0.0, +0 %, 0.0, 0.3 | held, 5012, 552, 0.0, +0 %, 0.0, 0.3 |  | 1 | yes |
| sqbox-P2m-near-a | 2/m | po 0.64 | free, 8828, 3464, 0.0, +95 %, 52.1, 44.9 | free, 5843, 1432, 771.3, +∞, 47.2, 18.7 | F | 1 | yes |
| sqbox-Pmmm-generic-a | mmm |  | free, 2340, 447, 0.0, +1 %, 2.3, 3.2 | free, 2267, 447, 0.0, +1 %, 2.3, 3.2 |  | 1 | yes |
| sqbox-P4m-on-a | 4/m | po 0.87 | free, 8837, 4145, 0.0, +2 %, 12.9, 22.0 | free, 5016, 584, 0.7, +2 %, 12.3, 21.6 | F | 1 | yes |
| sqbox-P4mmm-near-a | 4/mmm | hump 0.03 | free, 2459, 327, 0.0, +1 %, 0.1, 0.6 | free, 2441, 300, 0.0, +1 %, 0.1, 0.6 | F | 1 | yes |
| sqbox-P-3-generic-a | -3 |  | free, 2253, 285, 0.0, +0 %, 0.2, 0.5 | free, 2252, 285, 0.0, +0 %, 0.2, 0.5 |  | 1 | yes |
| sqbox-P-3m1-on-a | -3m | sizedist 0.56 | held, 7660, 5904, 0.4, +6 %, 0.0, 87.3 | held, 8774, 7014, 0.0, +6 %, 0.0, 86.4 |  | 3 | no |
| sqbox-P6m-near-a | 6/m | impurity 0.02 | free, 3558, 1158, 1.6, +2 %, 1.3, 10.5 | free, 3388, 831, 0.0, +2 %, 2.1, 12.1 | F | 2 | yes |
| sqbox-P6mmm-generic-a | 6/mmm | sizedist 0.94 | free, 3553, 1010, 0.0, +88 %, 4.0, 6.9 | free, 2948, 353, 0.1, +88 %, 4.0, 6.8 | F | 1 | yes |
| sqbox-Pm-3-on-a | m-3 |  | held, 2362, 1105, 0.0, +3 %, 0.0, 3.2 | held, 2081, 900, 0.0, +3 %, 0.0, 3.2 |  | 1 | yes |
| sqbox-Pm-3m-near-a | m-3m |  | held, 2058, 631, 0.0, +3 %, 4.5, 15.1 | held, 2295, 530, 0.0, +3 %, 4.5, 15.1 |  | 1 | yes |
| cylinder-P-1-generic-a | -1 | air 0.26 | free, 2207, 303, 0.0, +5 %, 0.2, 1.1 | free, 2145, 303, 0.0, +5 %, 0.2, 1.2 |  | 1 | yes |
| cylinder-P2m-on-a | 2/m |  | held, 3846, 952, 0.0, +0 %, 0.0, 3.2 | held, 3732, 851, 0.0, +0 %, 0.0, 3.2 |  | 1 | yes |
| cylinder-Pmmm-near-a | mmm | sizedist 0.04 | free, 2185, 514, 0.0, +2 %, 0.3, 0.8 | free, 2199, 514, 0.0, +2 %, 0.3, 0.9 |  | 1 | yes |
| cylinder-P4m-generic-a | 4/m |  | free, 1744, 270, 0.0, +2 %, 0.1, 0.5 | free, 1720, 270, 0.0, +2 %, 0.1, 0.5 |  | 1 | yes |
| cylinder-P4mmm-on-a | 4/mmm |  | held, 1251, 177, 0.0, +2 %, 0.0, 10.5 | held, 1240, 177, 0.0, +2 %, 0.0, 10.5 |  | 1 | yes |
| cylinder-P-3-near-a | -3 |  | free, 3399, 1399, 0.0, +1 %, 3.1, — | free, 3279, 1585, 0.0, +1 %, 3.1, — |  | 1 | yes |
| cylinder-P-3m1-generic-a | -3m | po 0.54 | free, 3458, 1003, 0.0, +∞, 25.7, 37.0 | free, 3928, 1778, 0.0, +∞, 25.7, 36.5 | F | 2 | yes |
| cylinder-P6m-on-a | 6/m | sizedist 0.16 | free, 1770, 348, 0.0, +25 %, 7.4, 16.5 | free, 1814, 348, 0.0, +25 %, 7.4, 16.5 | F | 1 | yes |
| cylinder-P6mmm-near-a | 6/mmm |  | free, 2264, 622, 0.0, +1 %, 1.6, 14.7 | free, 2174, 503, 0.0, +1 %, 1.5, 14.6 |  | 1 | yes |
| cylinder-Pm-3-generic-a | m-3 | hump 0.40 | early, 725, 0, —, —, —, — | early, 718, 0, —, —, —, — | F | — | — |
| cylinder-Pm-3m-on-a | m-3m |  | held, 1477, 325, 0.0, +1 %, 0.0, 1.4 | held, 1547, 307, 0.0, +1 %, 0.0, 1.5 |  | 1 | yes |
| ellcyl-P-1-near-a | -1 |  | free, 4296, 1439, 0.0, +8 %, 0.9, 88.3 | free, 3488, 820, 0.0, +8 %, 0.9, 2.2 |  | 1 | yes |
| ellcyl-P2m-generic-a | 2/m | sizedist 0.11 | free, 3207, 278, 0.0, +156 %, 80.2, 2.0 | free, 2402, 278, 0.0, +156 %, 80.2, 2.0 | F | 1 | yes |
| ellcyl-Pmmm-on-a | mmm | sizedist 0.32 | free, 5631, 2689, 0.1, +12 %, 0.0, 0.9 | free, 3186, 567, 0.1, +12 %, 0.0, 1.0 |  | 1 | yes |
| ellcyl-P4m-near-a | 4/m | air 0.08 | free, 3510, 842, 1.3, +10 %, 0.2, 9.6 | free, 3004, 395, 14.0, +20 %, 0.4, 2.8 | F | 1 | yes |
| ellcyl-P4mmm-generic-a | 4/mmm |  | free, 2648, 470, 0.0, +1 %, 0.3, 0.6 | free, 3336, 1187, 148.1, +9 %, 0.5, 0.9 |  | 1 | yes |
| ellcyl-P-3-on-a | -3 | po 0.01 | free, 7108, 4360, 1.7, +1 %, 4.5, 37.9 | free, 6343, 3920, 0.0, +1 %, 7.1, 40.4 |  | 3 | no |
| ellcyl-P-3m1-near-a | -3m |  | free, 3315, 661, 2.7, +1 %, 0.3, 1.3 | free, 2754, 238, 4.8, +2 %, 3.2, 4.3 |  | 1 | yes |
| ellcyl-P6m-generic-a | 6/m |  | held, 5875, 3964, 0.0, +108 %, 40.4, 53.0 | held, 4904, 3352, 0.0, +108 %, 40.4, 146.9 |  | 2 | no |
| ellcyl-P6mmm-on-a | 6/mmm | impurity 0.94 | held, 8287, 6204, 0.0, +8 %, 0.0, 65.3 | held, 8378, 6246, 0.0, +8 %, 0.0, 89.8 | F | 5 | no |
| ellcyl-Pm-3-near-a | m-3 |  | held, 5227, 3656, 0.0, +55 %, 4.0, 49.1 | held, 6256, 4688, 0.0, +55 %, 4.0, 44.4 |  | 4 | no |
| ellcyl-Pm-3m-generic-a | m-3m | po 0.49 | held, 6323, 4880, 0.0, +93 %, 5.6, 28.2 | held, 7023, 5323, 0.0, +93 %, 5.6, 28.2 |  | 3 | no |
| ellipsoid-P-1-on-a | -1 | hump 0.12 | held, 2246, 265, 0.0, +2 %, 0.0, 3.0 | held, 2270, 285, 0.0, +2 %, 0.0, 3.0 | F | 1 | yes |
| ellipsoid-P2m-near-a | 2/m |  | free, 7802, 5020, 0.0, +3 %, 2.8, 4.2 | free, 5872, 3330, 0.0, +3 %, 2.8, 4.2 |  | 1 | yes |
| ellipsoid-Pmmm-generic-a | mmm | impurity 0.76 | free, 11066, 8316, 0.1, +203 %, 1.0, 7.0 | free, 11353, 8490, 0.0, +202 %, 1.0, 7.0 | F | 1 | no (cap) |
| ellipsoid-P4m-on-a | 4/m |  | held, 8121, 5361, 0.0, +2 %, 0.0, 7.1 | held, 11914, 7916, 0.0, +2 %, 0.0, 7.1 |  | 2 | yes |
| ellipsoid-P4mmm-near-a | 4/mmm |  | free, 9430, 7393, 0.0, +8 %, 6.6, 26.3 | free, 8407, 6407, 0.0, +8 %, 6.6, 26.3 |  | 1 | yes |
| ellipsoid-P-3-generic-a | -3 | air 0.57 | free, 2025, 190, 0.0, +1 %, 0.1, 0.4 | free, 1946, 190, 0.0, +1 %, 0.1, 0.4 |  | 1 | yes |
| ellipsoid-P-3m1-on-a | -3m |  | held, 3964, 2242, 0.0, +1 %, 0.0, 11.0 | held, 3385, 1694, 0.0, +1 %, 0.0, 11.0 |  | 2 | yes |
| ellipsoid-P6m-near-a | 6/m |  | held, 3764, 2046, 0.0, +11 %, 7.7, 37.8 | held, 15484, 13623, 0.0, +13 %, 8.1, 20.5 |  | 1 | no |
| ellipsoid-P6mmm-generic-a | 6/mmm | po 0.34 | free, 4343, 1220, 0.0, +17 %, 10.3, 22.1 | free, 8587, 5412, 0.0, +17 %, 10.3, 17.6 | F | 1 | yes |
| ellipsoid-Pm-3-on-a | m-3 | sizedist 0.09 | held, 5009, 3381, 0.0, +1 %, 0.0, 12.0 | held, 5598, 3755, 0.0, +1 %, 0.0, 11.9 |  | 1 | yes |
| ellipsoid-Pm-3m-near-a | m-3m | sizedist 0.98 | free, 9813, 6077, 0.0, +∞, 11.6, 19.0 | free, 11221, 6133, 0.0, +∞, 11.6, 18.8 | F | 1 | no (cap) |
| spheroid-P-1-generic-a | -1 |  | free, 2294, 249, 0.0, +1 %, 0.1, 1.9 | free, 2214, 233, 0.1, +1 %, 0.1, 2.0 |  | 1 | yes |
| spheroid-P2m-on-a | 2/m |  | held, 2163, 760, 0.0, +1 %, 0.0, 88.7 | held, 1980, 533, 0.0, +1 %, 0.0, 88.7 |  | 2 | yes |
| spheroid-Pmmm-near-a | mmm |  | held, 3610, 1625, 0.1, +2 %, 7.5, 13.5 | held, 4165, 2199, 0.0, +2 %, 7.5, 13.5 |  | 1 | yes |
| spheroid-P4m-generic-a | 4/m |  | free, 3116, 1734, 0.0, +15 %, 37.5, 24.3 | free, 3104, 1690, 0.0, +15 %, 37.5, 22.0 |  | 2 | yes |
| spheroid-P4mmm-on-a | 4/mmm | impurity 0.68 | free, 1765, 506, 0.0, +1 %, 15.4, 97.1 | free, 1698, 487, 0.0, +1 %, 15.4, 62.6 | F | 1 | yes |
| spheroid-P-3-near-a | -3 | sizedist 1.00 | free, 1915, 405, 0.0, +255 %, 48.1, 11.3 | free, 1786, 405, 0.0, +255 %, 48.1, 11.3 | F | 1 | yes |
| spheroid-P-3m1-generic-a | -3m |  | free, 1312, 165, 0.0, +4 %, 1.4, 10.1 | free, 1351, 158, 0.0, +4 %, 1.4, 13.5 |  | 1 | yes |
| spheroid-P6m-on-a | 6/m | po 0.92 | free, 2379, 506, 0.0, +∞, 72.2, 35.7 | free, 2239, 487, 0.0, +∞, 72.2, 52.0 | F | 2 | yes |
| spheroid-P6mmm-near-a | 6/mmm | hump 0.60 | free, 4323, 2440, 0.0, +29 %, 33.9, 190.1 | free, 4731, 2820, 0.0, +29 %, 34.0, 114.2 | F | 1 | yes |
| spheroid-Pm-3-generic-a | m-3 | po 0.84 | free, 1146, 210, 0.0, +9 %, 1.5, 7.6 | free, 1115, 210, 0.0, +9 %, 1.5, 7.6 | F | 1 | yes |
| spheroid-Pm-3m-on-a | m-3m |  | held, 1745, 230, 0.0, +0 %, 0.0, 5.1 | held, 3770, 224, 0.0, +0 %, 0.0, 3.2 |  | 1 | yes |
| sphere-P-1-2 | -1 |  | early, 1379, 0, —, —, —, — | early, 1366, 0, —, —, —, — |  | — | — |
| sphere-P2m-3 | 2/m | impurity 0.61 | rejected, 2246, 0, —, —, —, — | rejected, 2340, 0, —, —, —, — | F | — | — |
| sphere-Pmmm-1 | mmm | sizedist 0.33 | free, 2869, 1270, —, —, —, — | free, 3417, 1925, —, —, —, — |  | — | yes |
| sphere-P4m-2 | 4/m | po 0.83 | free, 4816, 2485, —, —, —, — | free, 2792, 681, —, —, —, — | F | — | yes |
| sphere-P4mmm-3 | 4/mmm |  | early, 1027, 0, —, —, —, — | early, 1035, 0, —, —, —, — |  | — | — |
| sphere-P-3-1 | -3 | sizedist 0.30 | free, 3992, 1700, —, —, —, — | free, 4214, 2205, —, —, —, — |  | — | yes |
| sphere-P-3m1-2 | -3m |  | early, 984, 0, —, —, —, — | early, 979, 0, —, —, —, — |  | — | — |
| sphere-P6m-3 | 6/m |  | early, 899, 0, —, —, —, — | early, 935, 0, —, —, —, — |  | — | — |
| sphere-P6mmm-1 | 6/mmm |  | early, 836, 0, —, —, —, — | early, 865, 0, —, —, —, — |  | — | — |
| sphere-Pm-3-2 | m-3 | air 0.08 | early, 721, 0, —, —, —, — | early, 695, 0, —, —, —, — |  | — | — |
| sphere-Pm-3m-3 | m-3m |  | early, 536, 0, —, —, —, — | early, 528, 0, —, —, —, — |  | — | — |
