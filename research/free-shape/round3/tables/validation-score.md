# Round 3: validation part, 154 rows (132 truths, 22 spheres); round 3 154 records, round 2 154

| method | runs | truths: held / free / rejected (early) | spheres kept: clean / error | reached / judged | unbounded | worst, median (90 %) | thinnest | axis °, median (90 %) | search evaluations (× round 2; per run median) | of which the minima stage | report evaluations | not explored (capped) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| round 2 | 154 | 48 / 83 / 1 (1) | 0/11 / 7/11 | 126 / 131 | 12 | +4 % (+265 %) | -0 % | 1.0 (12.6) | 539238 (1.000; 1.000) | 249128 (max 10827) | 254952 | 0 (0) |
| round 3 | 154 | 49 / 82 / 1 (1) | 0/11 / 7/11 | 128 / 131 | 12 | +4 % (+219 %) | -0 % | 1.2 (12.6) | 581088 (1.078; 1.083) | 250403 (max 13496) | 443303 | 15 (1) |

- clean truths kept by both (65): round 2 worst +1 % (90 % +12 %), thinnest +0 %, axis 0.4°, unbounded 0, anisotropy 1.00; round 3 worst +1 % (90 % +13 %), thinnest +0 %, axis 0.4°, unbounded 0, anisotropy 1.00
- with an error truths kept by both (66): round 2 worst +23 % (90 % +∞), thinnest -0 %, axis 3.4°, unbounded 12, anisotropy 1.01; round 3 worst +21 % (90 % +∞), thinnest -0 %, axis 3.4°, unbounded 12, anisotropy 1.01

Outcome changed (round 2 → round 3) on 2: ellcyl-Pm-3-near-b free → held; sphere-Pm-3m-2 free → held.

Not reached, round 2 (5): ellcyl-P-3-generic-a Δ 1.6, ellcyl-P-3m1-on-a (po) Δ 98.8, ellcyl-Pm-3m-near-a Δ 62.0, sqbox-Pm-3m-near-b (hump) Δ 4.8, ellcyl-Pm-3-near-b (po) Δ 501.1.
Not reached, round 3 (3): box-P-3-generic-a (hump) Δ 1.3, ellcyl-Pm-3m-near-a Δ 62.0, sqbox-Pm-3m-near-b (hump) Δ 4.8.

**The two errors** (kept truths; E the engine's reported interval and radius):

| method | kept truths | runs | extents (unbounded) | E covered | median half-width E | principal axes E covered | median radius E | E radius ÷ error, clean misses |
|---|---|---|---|---|---|---|---|---|
| round 2 | clean | 65 | 162 (0) | 158/162 (98 %) | 3.7 % | 62/65 (95 %) | 3.2° | sqbox-P-3-near-a 4.0/2.1°, ellcyl-Pm-3m-near-a 1.6/1.0°, sqbox-P2m-near-b 0.6/0.4° |
| round 2 | error, not flagged | 23 | 55 (1) | 41/55 (75 %) | 7.0 % | 16/23 (70 %) | 5.7° |  |
| round 2 | error, flagged | 43 | 99 (11) | 78/99 (79 %) | 13.0 % | 32/42 (76 %) | 10.1° |  |
| round 2 | all kept | 131 | 316 (12) | 277/316 (88 %) | 6.9 % | 110/130 (85 %) | 5.7° |  |
| round 3 | clean | 65 | 162 (0) | 159/162 (98 %) | 4.3 % | 61/65 (94 %) | 5.1° | sqbox-P-3-near-a 4.0/3.8°, ellcyl-Pm-3m-near-a 1.6/1.6°, sqbox-P2m-near-b 0.6/0.6°, ellipsoid-P6m-near-b 6.6/6.4° |
| round 3 | error, not flagged | 23 | 55 (1) | 40/55 (73 %) | 7.0 % | 17/23 (74 %) | 9.7° |  |
| round 3 | error, flagged | 43 | 99 (11) | 77/99 (78 %) | 13.4 % | 31/42 (74 %) | 9.9° |  |
| round 3 | all kept | 131 | 316 (12) | 276/316 (87 %) | 7.4 % | 109/130 (84 %) | 6.5° |  |

**Uniqueness** (round 3; one minimum within Δ*; covered by E):

| kept truths | unique | unique, covered | several | several, covered |
|---|---|---|---|---|
| clean | 48/65 | 44 | 17 | 17 |
| error, not flagged | 15/23 | 9 | 8 | 3 |
| error, flagged | 33/43 | 20 | 10 | 6 |

**The per-line check** (round 3; the fit returned, or beside a rejection the isotropic fit):

| rows | runs | flagged | spoiled | spoiled and flagged | z median / max |
|---|---|---|---|---|---|
| clean truths | 66 | 0 | 4 | 0 | 0.13 / 2.28 |
| clean spheres | 11 | 0 | 0 | 0 | 0.53 / 2.06 |
| hump | 11 | 10 | 2 | 2 | 37.59 / 203.49 |
| sizedist | 23 | 9 | 16 | 7 | 1.48 / 64.05 |
| impurity | 9 | 9 | 4 | 4 | 56.26 / 156.30 |
| air | 10 | 4 | 0 | 0 | 2.71 / 19.20 |
| po | 24 | 18 | 18 | 16 | 9.47 / 132.72 |
| all with an error | 77 | 50 | 40 | 29 | 7.14 / 203.49 |

Spoiled and not flagged: box-P2m-near-a (none), box-P4m-on-a (po 0.10), ellcyl-P6m-near-a (sizedist 0.61), ellcyl-Pm-3m-near-a (none), ellipsoid-P6m-on-a (none), spheroid-P6m-generic-a (none), spheroid-P6mmm-on-a (sizedist 0.00), sqbox-P6mmm-generic-b (sizedist 0.05), cylinder-P-3m1-generic-b (sizedist 0.46), ellcyl-P4m-near-b (sizedist 0.54), ellipsoid-P6mmm-generic-b (sizedist 0.52), ellipsoid-Pm-3m-near-b (po 0.13), spheroid-P6m-on-b (sizedist 0.81), sphere-P4mmm-5 (sizedist 0.34), sphere-Pm-3m-5 (sizedist 0.70). Clean rows flagged: none.

**The jackknife** (round 3, flagged kept truths with an error, by kind: extents E covered / n, axes E covered / n):

- hump: 8 rows, extents 18/20 (unbounded 0), axes 6/7
- sizedist: 9 rows, extents 14/21 (unbounded 3), axes 6/9
- impurity: 8 rows, extents 19/19 (unbounded 2), axes 7/8
- air: 3 rows, extents 8/8 (unbounded 0), axes 3/3
- po: 15 rows, extents 18/31 (unbounded 6), axes 9/15

**The keep test** (shapes kept):

| rows | runs | round 2 | round 3 |
|---|---|---|---|
| clean truths | 66 | 65 | 65 |
| truths with an error | 66 | 66 | 66 |
| clean spheres | 11 | 0 | 0 |
| spheres with an error | 11 | 7 | 7 |

Truths round 3 rejects: spheroid-Pm-3-near-a (none; G —, need 13.2, early).
Spheres round 3 keeps: sphere-P2m-2 (po 0.52, flagged); sphere-P4mmm-2 (po 0.01, flagged); sphere-P4mmm-5 (sizedist 0.34); sphere-P-3m1-4 (po 0.16, flagged); sphere-P6mmm-6 (hump 0.42, flagged); sphere-Pm-3m-2 (impurity 0.86, flagged); sphere-Pm-3m-5 (sizedist 0.70).

| row | class | error | round 2: outcome, search evals, stage evals, Δ, worst, axis°, axis radius° | round 3: outcome, search evals, stage evals, Δ, worst, axis°, axis radius° | flag | minima ≤ Δ* | explored |
|---|---|---|---|---|---|---|---|
| box-P-1-on-a | -1 | sizedist 0.96 | free, 6602, 4168, 0.0, +58 %, 3.1, 8.6 | free, 7156, 4137, 0.0, +58 %, 3.1, 8.6 | F | 5 | no |
| box-P2m-near-a | 2/m |  | free, 3692, 340, 0.0, +36 %, 0.7, 1.0 | free, 4239, 340, 0.0, +36 %, 0.7, 8.2 |  | 1 | yes |
| box-Pmmm-generic-a | mmm |  | free, 2167, 431, 0.0, +8 %, 0.2, 0.5 | free, 2636, 431, 0.0, +8 %, 0.2, 0.9 |  | 1 | yes |
| box-P4m-on-a | 4/m | po 0.10 | held, 12752, 9088, 0.0, +34 %, 0.0, 37.4 | held, 13196, 9088, 0.0, +34 %, 0.0, 37.4 |  | 3 | no |
| box-P4mmm-near-a | 4/mmm | sizedist 0.24 | free, 9353, 5026, 0.0, +195 %, 4.7, 20.7 | free, 9552, 5026, 0.0, +195 %, 4.7, 20.7 | F | 3 | yes |
| box-P-3-generic-a | -3 | hump 0.84 | free, 4836, 2227, 0.0, +10 %, 0.3, 6.3 | free, 4845, 2156, 1.3, +7 %, 0.3, 6.3 | F | 4 | yes |
| box-P-3m1-on-a | -3m |  | held, 6631, 4211, 0.1, +1 %, 0.0, 0.6 | held, 7068, 4211, 0.1, +1 %, 0.0, 0.7 |  | 1 | yes |
| box-P6m-near-a | 6/m |  | free, 3519, 1369, 1.0, +19 %, 0.4, 5.1 | free, 4544, 1970, 0.0, +19 %, 0.4, 7.0 |  | 2 | yes |
| box-P6mmm-generic-a | 6/mmm | po 0.94 | free, 6584, 4923, 0.0, +∞, 12.6, 15.7 | free, 4732, 2618, 0.0, +∞, 12.6, 15.7 | F | 2 | no |
| box-Pm-3-on-a | m-3 | impurity 0.65 | free, 2304, 419, 0.0, +∞, 4.2, 5.7 | free, 3303, 1017, 0.0, +∞, 4.2, 4.1 | F | 1 | yes |
| box-Pm-3m-near-a | m-3m | hump 0.32 | free, 2086, 225, 0.0, +2 %, 1.3, 10.6 | free, 2299, 224, 0.0, +2 %, 1.3, 13.2 | F | 1 | yes |
| sqbox-P-1-generic-a | -1 | po 0.52 | free, 6385, 2515, 0.0, +∞, 71.3, 16.7 | free, 6954, 2515, 0.0, +∞, 71.3, 16.7 | F | 1 | yes |
| sqbox-P2m-on-a | 2/m |  | held, 2393, 544, 0.0, +13 %, 0.0, 3.2 | held, 2877, 544, 0.0, +13 %, 0.0, 5.0 |  | 1 | yes |
| sqbox-Pmmm-near-a | mmm |  | free, 2540, 773, 0.0, +3 %, 0.5, 2.4 | free, 2881, 773, 0.0, +3 %, 0.5, 4.5 |  | 1 | yes |
| sqbox-P4m-generic-a | 4/m | sizedist 0.28 | free, 4147, 2476, 0.0, +16 %, 9.7, 15.3 | free, 4352, 2476, 0.0, +16 %, 9.7, 15.3 |  | 3 | yes |
| sqbox-P4mmm-on-a | 4/mmm |  | held, 2179, 390, 0.0, +1 %, 0.0, 2.7 | held, 2461, 390, 0.0, +1 %, 0.0, 2.1 |  | 1 | yes |
| sqbox-P-3-near-a | -3 |  | free, 1803, 279, 0.0, +1 %, 4.0, 2.1 | free, 2202, 279, 0.0, +1 %, 4.0, 3.8 |  | 1 | yes |
| sqbox-P-3m1-generic-a | -3m |  | free, 4323, 2796, 0.0, +1 %, 6.8, 69.8 | free, 4427, 2796, 0.0, +1 %, 6.8, 69.8 |  | 4 | no |
| sqbox-P6m-on-a | 6/m |  | held, 3081, 1568, 0.0, +1 %, 0.0, 1.9 | held, 3352, 1568, 0.0, +1 %, 0.0, 5.4 |  | 1 | yes |
| sqbox-P6mmm-near-a | 6/mmm | air 0.39 | held, 2188, 793, 0.0, +4 %, 3.3, 3.8 | held, 2507, 793, 0.0, +4 %, 3.3, 7.2 | F | 1 | yes |
| sqbox-Pm-3-generic-a | m-3 | air 0.79 | free, 2143, 182, 0.0, +1 %, 0.5, 0.9 | free, 2363, 279, 0.0, +1 %, 0.5, 1.4 |  | 1 | yes |
| sqbox-Pm-3m-on-a | m-3m | po 0.18 | held, 3586, 1451, 0.0, +4 %, 0.0, 0.3 | held, 3602, 1451, 0.0, +4 %, 0.0, 0.4 | F | 1 | yes |
| cylinder-P-1-near-a | -1 | hump 0.20 | free, 2137, 313, 0.0, +1 %, 0.4, 1.4 | free, 2714, 313, 0.0, +1 %, 0.4, 1.4 | F | 1 | yes |
| cylinder-P2m-generic-a | 2/m |  | free, 1565, 190, 0.0, +0 %, 0.2, 0.4 | free, 1677, 190, 0.0, +0 %, 0.2, 0.6 |  | 1 | yes |
| cylinder-Pmmm-on-a | mmm |  | held, 2044, 397, 0.0, +0 %, 0.0, 0.6 | held, 2451, 397, 0.0, +0 %, 0.0, 0.6 |  | 1 | yes |
| cylinder-P4m-near-a | 4/m |  | free, 1579, 292, 0.0, +0 %, 0.1, 1.1 | free, 1863, 292, 0.0, +0 %, 0.1, 1.7 |  | 1 | yes |
| cylinder-P4mmm-generic-a | 4/mmm |  | free, 1428, 228, 0.0, +1 %, 1.3, 1.9 | free, 1682, 311, 0.0, +1 %, 1.3, 2.7 |  | 1 | yes |
| cylinder-P-3-on-a | -3 | impurity 0.43 | held, 3637, 624, 0.0, +3 %, 0.0, 0.4 | held, 3918, 624, 0.0, +3 %, 0.0, 0.6 | F | 1 | yes |
| cylinder-P-3m1-near-a | -3m | sizedist 0.84 | free, 1936, 481, 0.0, +∞, 11.5, 24.2 | free, 2130, 481, 0.0, +∞, 11.5, 24.2 | F | 1 | yes |
| cylinder-P6m-generic-a | 6/m |  | free, 2564, 1364, 0.0, +25 %, 6.6, 16.7 | free, 2753, 1364, 0.0, +25 %, 6.6, 20.5 |  | 1 | yes |
| cylinder-P6mmm-on-a | 6/mmm |  | held, 2813, 1635, 0.0, +2 %, 0.0, 2.6 | held, 2989, 1635, 0.0, +2 %, 0.0, 4.8 |  | 1 | yes |
| cylinder-Pm-3-near-a | m-3 | sizedist 0.02 | held, 1636, 507, 0.0, +3 %, 2.9, 5.7 | held, 1799, 507, 0.0, +3 %, 2.9, 4.2 |  | 1 | yes |
| cylinder-Pm-3m-generic-a | m-3m |  | held, 2148, 1140, 0.0, +1 %, 7.0, 29.6 | held, 2151, 1140, 0.0, +1 %, 7.0, 44.1 |  | 3 | yes |
| ellcyl-P-1-on-a | -1 |  | held, 7797, 301, 0.0, +1 %, 0.0, 2.3 | held, 8060, 301, 0.0, +1 %, 0.0, 3.2 |  | 1 | yes |
| ellcyl-P2m-near-a | 2/m | sizedist 0.47 | free, 6026, 469, 0.0, +342 %, 3.1, 0.8 | free, 6198, 469, 0.0, +342 %, 3.1, 0.8 | F | 1 | yes |
| ellcyl-Pmmm-generic-a | mmm |  | free, 5541, 3043, 0.0, +8 %, 0.8, 2.4 | free, 6434, 3684, 0.0, +11 %, 0.9, 3.5 |  | 1 | yes |
| ellcyl-P4m-on-a | 4/m | hump 0.24 | held, 3641, 1461, 0.0, +1 %, 0.0, 19.7 | held, 4091, 1461, 0.0, +1 %, 0.0, 19.7 | F | 1 | yes |
| ellcyl-P4mmm-near-a | 4/mmm |  | free, 3748, 477, 0.0, +0 %, 0.1, 0.2 | free, 3976, 477, 0.0, +0 %, 0.1, 0.4 |  | 1 | yes |
| ellcyl-P-3-generic-a | -3 |  | free, 4562, 2761, 1.6, +4 %, 19.1, 37.2 | free, 4714, 2678, 0.7, +18 %, 9.2, 31.1 |  | 5 | no |
| ellcyl-P-3m1-on-a | -3m | po 0.36 | free, 5157, 685, 98.8, +∞, 10.0, 14.1 | free, 10405, 4554, 0.0, +∞, 13.4, 12.9 | F | 1 | yes |
| ellcyl-P6m-near-a | 6/m | sizedist 0.61 | held, 8713, 6654, 0.0, +∞, 63.1, 62.7 | held, 8960, 6654, 0.0, +∞, 63.1, 62.7 |  | 3 | no |
| ellcyl-P6mmm-generic-a | 6/mmm |  | free, 2262, 287, 0.0, +4 %, 1.0, 1.8 | free, 2484, 287, 0.0, +4 %, 1.0, 2.5 |  | 1 | yes |
| ellcyl-Pm-3-on-a | m-3 | air 0.37 | held, 2885, 1047, 0.0, +2 %, 0.0, 11.3 | held, 2993, 1047, 0.0, +2 %, 0.0, 11.7 |  | 1 | yes |
| ellcyl-Pm-3m-near-a | m-3m |  | free, 7706, 5151, 62.0, +219 %, 1.6, 1.0 | free, 8092, 5151, 62.0, +219 %, 1.6, 1.6 |  | 1 | yes |
| ellipsoid-P-1-generic-a | -1 | po 0.23 | free, 1880, 316, 0.0, +12 %, 12.8, 12.6 | free, 2426, 316, 0.0, +12 %, 12.8, 12.6 | F | 1 | yes |
| ellipsoid-P2m-on-a | 2/m | impurity 0.31 | free, 5065, 3445, 0.0, +∞, 10.9, 6.4 | free, 5471, 3445, 0.0, +∞, 10.9, 18.1 | F | 1 | yes |
| ellipsoid-Pmmm-near-a | mmm |  | free, 1764, 231, 0.0, +2 %, 0.1, 0.4 | free, 2209, 231, 0.0, +2 %, 0.1, 0.8 |  | 1 | yes |
| ellipsoid-P4m-generic-a | 4/m |  | free, 4197, 2480, 0.0, +2 %, 0.6, 8.1 | free, 4838, 2855, 0.0, +2 %, 0.6, 33.4 |  | 1 | yes |
| ellipsoid-P4mmm-on-a | 4/mmm | sizedist 0.69 | free, 6359, 680, 0.0, +∞, 6.3, 18.9 | free, 6492, 680, 0.0, +∞, 6.3, 18.9 | F | 1 | yes |
| ellipsoid-P-3-near-a | -3 |  | free, 3036, 666, 0.0, +4 %, 2.0, 4.2 | free, 4156, 643, 0.0, +4 %, 2.0, 5.8 |  | 1 | yes |
| ellipsoid-P-3m1-generic-a | -3m | hump 0.11 | free, 3942, 2605, 0.0, +14 %, 6.5, 33.4 | free, 6190, 4655, 0.0, +14 %, 6.5, 32.9 | F | 1 | yes |
| ellipsoid-P6m-on-a | 6/m |  | held, 9536, 7555, 0.0, +8 %, 10.9, 20.1 | held, 9673, 7579, 0.0, +8 %, 10.9, 26.3 |  | 2 | yes |
| ellipsoid-P6mmm-near-a | 6/mmm | po 0.03 | free, 5613, 3609, 0.0, +16 %, 5.7, 29.6 | free, 5920, 3609, 0.0, +16 %, 5.7, 29.6 | F | 1 | yes |
| ellipsoid-Pm-3-generic-a | m-3 | air 0.27 | free, 5238, 3139, 0.0, +12 %, 5.0, 2.2 | free, 5454, 3139, 0.0, +12 %, 5.0, 4.6 |  | 1 | yes |
| ellipsoid-Pm-3m-on-a | m-3m |  | held, 7441, 6165, 0.0, +4 %, 0.0, 19.3 | held, 10342, 8801, 0.0, +4 %, 0.0, 16.7 |  | 1 | yes |
| spheroid-P-1-near-a | -1 |  | free, 1736, 222, 0.0, +0 %, 0.1, 0.4 | free, 2227, 222, 0.0, +0 %, 0.1, 0.6 |  | 1 | yes |
| spheroid-P2m-generic-a | 2/m | air 0.06 | free, 1940, 190, 0.0, +4 %, 0.4, 0.4 | free, 2360, 190, 0.0, +4 %, 0.4, 0.5 |  | 1 | yes |
| spheroid-Pmmm-on-a | mmm |  | held, 3030, 934, 0.0, +1 %, 0.0, 8.5 | held, 3444, 934, 0.0, +1 %, 0.0, 9.9 |  | 1 | yes |
| spheroid-P4m-near-a | 4/m |  | held, 1722, 632, 0.0, +0 %, 7.2, 17.2 | held, 1725, 632, 0.0, +0 %, 7.2, 25.5 |  | 3 | yes |
| spheroid-P4mmm-generic-a | 4/mmm | hump 0.62 | free, 1581, 571, 0.0, +21 %, —, — | free, 1646, 571, 0.0, +21 %, —, — | F | 2 | yes |
| spheroid-P-3-on-a | -3 | sizedist 0.18 | free, 2035, 848, 0.0, +2 %, 7.7, 0.7 | free, 2387, 848, 0.0, +2 %, 7.7, 1.2 |  | 1 | yes |
| spheroid-P-3m1-near-a | -3m |  | held, 1672, 165, 0.0, +1 %, 6.8, 15.0 | held, 1953, 165, 0.0, +1 %, 6.8, 17.0 |  | 1 | yes |
| spheroid-P6m-generic-a | 6/m |  | held, 1390, 392, 0.0, +13 %, 16.8, 18.4 | held, 1590, 392, 0.0, +13 %, 16.8, 18.4 |  | 2 | yes |
| spheroid-P6mmm-on-a | 6/mmm | sizedist 0.00 | held, 2158, 1000, 0.0, +47 %, 29.9, 26.2 | held, 2478, 1220, 0.0, +47 %, 29.9, 26.8 |  | 2 | yes |
| spheroid-Pm-3-near-a | m-3 |  | early, 551, 0, —, —, —, — | early, 554, 0, —, —, —, — |  | — | — |
| spheroid-Pm-3m-generic-a | m-3m | impurity 0.30 | held, 1930, 999, 0.0, +8 %, 11.1, 27.5 | held, 1818, 946, 0.0, +8 %, 11.1, 27.4 | F | 2 | yes |
| box-P-1-near-b | -1 | air 0.67 | free, 3037, 418, 0.0, +24 %, 0.5, 2.4 | free, 3585, 418, 0.0, +24 %, 0.5, 2.4 | F | 1 | yes |
| box-P2m-generic-b | 2/m | sizedist 0.74 | free, 3165, 531, 0.0, +∞, 1.8, 4.3 | free, 3542, 531, 0.0, +∞, 1.8, 4.3 | F | 1 | yes |
| box-Pmmm-on-b | mmm |  | held, 10274, 7458, 0.0, +2 %, 0.0, 8.9 | held, 6002, 2438, 0.0, +2 %, 0.0, 8.9 |  | 3 | yes |
| box-P4m-near-b | 4/m |  | free, 2778, 398, 0.0, +2 %, 0.1, 0.4 | free, 3153, 398, 0.0, +2 %, 0.1, 0.7 |  | 1 | yes |
| box-P4mmm-generic-b | 4/mmm |  | free, 2237, 423, 0.0, +1 %, 0.1, 0.3 | free, 2553, 423, 0.0, +1 %, 0.1, 0.4 |  | 1 | yes |
| box-P-3-on-b | -3 | sizedist 0.42 | free, 4444, 1356, 0.8, +265 %, 9.0, 4.1 | free, 4638, 1265, 0.0, +203 %, 9.0, 4.2 | F | 1 | yes |
| box-P-3m1-near-b | -3m | po 0.63 | free, 6428, 4629, 0.0, +51 %, 16.4, 33.4 | free, 6584, 4527, 0.0, +51 %, 16.4, 45.1 | F | 4 | yes |
| box-P6m-generic-b | 6/m |  | free, 4111, 2193, 0.0, +3 %, 4.6, 7.1 | free, 4871, 2832, 0.0, +3 %, 4.6, 8.4 |  | 4 | yes |
| box-P6mmm-on-b | 6/mmm |  | held, 5349, 3548, 0.0, +3 %, 0.0, 12.3 | held, 5143, 2850, 0.0, +3 %, 0.0, 11.5 |  | 1 | yes |
| box-Pm-3-near-b | m-3 | impurity 0.36 | free, 5305, 3272, 0.0, +39 %, 1.5, 10.4 | free, 6492, 4266, 0.4, +21 %, 1.4, 9.5 | F | 2 | no |
| box-Pm-3m-generic-b | m-3m |  | free, 1925, 287, 0.0, +16 %, 0.9, 1.7 | free, 1788, 287, 0.0, +16 %, 0.9, 3.1 |  | 1 | yes |
| sqbox-P-1-on-b | -1 |  | held, 3289, 353, 0.0, +1 %, 0.0, 1.3 | held, 3698, 319, 0.0, +1 %, 0.0, 2.1 |  | 1 | yes |
| sqbox-P2m-near-b | 2/m |  | free, 2062, 281, 0.0, +2 %, 0.6, 0.4 | free, 2543, 281, 0.0, +2 %, 0.6, 0.6 |  | 1 | yes |
| sqbox-Pmmm-generic-b | mmm | sizedist 0.59 | free, 3535, 790, 0.0, +18 %, 5.7, 4.6 | free, 3753, 790, 0.0, +18 %, 5.7, 4.6 | F | 1 | yes |
| sqbox-P4m-on-b | 4/m |  | held, 2234, 499, 0.0, +1 %, 0.0, 6.1 | held, 2541, 540, 0.0, +1 %, 0.0, 5.1 |  | 1 | yes |
| sqbox-P4mmm-near-b | 4/mmm |  | free, 4286, 2580, 0.0, +1 %, 2.0, 40.9 | free, 4449, 2597, 0.0, +1 %, 2.1, 40.9 |  | 2 | yes |
| sqbox-P-3-generic-b | -3 | impurity 0.07 | free, 2037, 325, 0.0, +1 %, 0.4, 1.3 | free, 2439, 325, 0.0, +1 %, 0.4, 1.3 | F | 1 | yes |
| sqbox-P-3m1-on-b | -3m |  | held, 2202, 823, 0.0, +1 %, 0.0, 4.2 | held, 2475, 823, 0.0, +1 %, 0.0, 6.5 |  | 1 | yes |
| sqbox-P6m-near-b | 6/m |  | free, 2514, 998, 0.3, +0 %, 0.5, 5.0 | free, 2787, 998, 0.3, +0 %, 0.5, 5.0 |  | 2 | yes |
| sqbox-P6mmm-generic-b | 6/mmm | sizedist 0.05 | free, 2198, 925, 0.0, +31 %, 9.5, 3.8 | free, 2498, 925, 0.0, +31 %, 9.5, 12.3 |  | 1 | yes |
| sqbox-Pm-3-on-b | m-3 | po 0.25 | held, 1935, 666, 0.1, +1 %, 0.0, 4.3 | held, 2037, 666, 0.1, +1 %, 0.0, 5.5 |  | 1 | yes |
| sqbox-Pm-3m-near-b | m-3m | hump 0.75 | held, 1809, 385, 4.8, +81 %, 1.7, 0.9 | held, 1986, 385, 4.8, +81 %, 1.7, 1.3 | F | 1 | yes |
| cylinder-P-1-generic-b | -1 |  | free, 2047, 278, 0.0, +0 %, 0.0, 0.2 | free, 2495, 278, 0.0, +0 %, 0.0, 0.2 |  | 1 | yes |
| cylinder-P2m-on-b | 2/m | hump 0.48 | held, 2136, 305, 0.0, +3 %, 0.0, 2.0 | held, 2508, 305, 0.0, +3 %, 0.0, 3.4 | F | 1 | yes |
| cylinder-Pmmm-near-b | mmm |  | free, 1539, 237, 0.0, +1 %, 1.0, 2.9 | free, 1835, 237, 0.0, +1 %, 1.0, 12.5 |  | 1 | yes |
| cylinder-P4m-generic-b | 4/m |  | free, 1376, 215, 0.0, +1 %, 0.2, 0.4 | free, 1737, 215, 0.0, +1 %, 0.2, 0.5 |  | 1 | yes |
| cylinder-P4mmm-on-b | 4/mmm | po 0.41 | free, 3511, 2011, 0.0, +∞, 21.6, 27.4 | free, 3851, 1973, 0.0, +∞, 21.6, 27.4 | F | 1 | no |
| cylinder-P-3-near-b | -3 | po 0.97 | free, 2618, 412, 0.0, +38 %, 12.4, 23.6 | free, 2885, 412, 0.0, +38 %, 12.4, 23.6 | F | 1 | yes |
| cylinder-P-3m1-generic-b | -3m | sizedist 0.46 | free, 1713, 395, 0.0, +109 %, 33.1, 2.3 | free, 1897, 395, 0.0, +109 %, 33.1, 4.8 |  | 1 | yes |
| cylinder-P6m-on-b | 6/m | po 0.14 | free, 1878, 685, 0.0, +30 %, 3.7, 6.5 | free, 2153, 685, 0.0, +30 %, 3.7, 6.6 | F | 2 | yes |
| cylinder-P6mmm-near-b | 6/mmm |  | free, 1442, 220, 0.0, +2 %, 1.7, 7.2 | free, 1717, 220, 0.0, +2 %, 1.7, 10.2 |  | 1 | yes |
| cylinder-Pm-3-generic-b | m-3 | po 0.04 | free, 1388, 440, 0.0, +0 %, 0.9, 18.5 | free, 1465, 440, 0.0, +0 %, 0.9, 18.5 |  | 2 | yes |
| cylinder-Pm-3m-on-b | m-3m | air 0.51 | held, 1607, 639, 0.0, +1 %, 0.0, 0.8 | held, 1708, 639, 0.0, +1 %, 0.0, 1.0 |  | 1 | yes |
| ellcyl-P-1-near-b | -1 | impurity 0.72 | free, 2604, 347, 0.0, +12 %, 0.2, 4.2 | free, 3159, 347, 0.0, +12 %, 0.2, 4.2 | F | 1 | yes |
| ellcyl-P2m-generic-b | 2/m | po 0.67 | free, 3926, 471, 0.1, +∞, 84.3, 26.8 | free, 4603, 387, 0.0, +∞, 84.3, 27.3 | F | 1 | yes |
| ellcyl-Pmmm-on-b | mmm |  | held, 2430, 546, 0.0, +1 %, 0.0, 0.3 | held, 2926, 546, 0.0, +1 %, 0.0, 0.5 |  | 1 | yes |
| ellcyl-P4m-near-b | 4/m | sizedist 0.54 | free, 5793, 3608, 0.0, +41 %, 23.2, 2.9 | free, 6024, 3608, 0.0, +41 %, 23.2, 5.8 |  | 1 | yes |
| ellcyl-P4mmm-generic-b | 4/mmm | impurity 0.15 | free, 2524, 452, 0.0, +17 %, 2.0, 5.1 | free, 2732, 452, 0.0, +17 %, 2.0, 5.1 | F | 1 | yes |
| ellcyl-P-3-on-b | -3 | hump 0.18 | held, 6046, 3855, 0.1, +4 %, 0.0, 1.6 | held, 6269, 3855, 0.1, +4 %, 0.0, 2.4 |  | 2 | yes |
| ellcyl-P-3m1-near-b | -3m |  | held, 8017, 5937, 0.0, +9 %, 2.8, 90.0 | held, 8368, 5961, 0.0, +9 %, 2.8, 90.0 |  | 4 | no |
| ellcyl-P6m-generic-b | 6/m |  | free, 3667, 635, 0.0, +5 %, 1.0, 1.7 | free, 4038, 635, 0.0, +5 %, 1.0, 3.1 |  | 1 | yes |
| ellcyl-P6mmm-on-b | 6/mmm |  | held, 9087, 6721, 0.0, +0 %, 0.0, 18.1 | held, 9416, 6721, 0.0, +0 %, 0.0, 18.1 |  | 3 | no |
| ellcyl-Pm-3-near-b | m-3 | po 0.77 | free, 5274, 2999, 501.1, +86 %, 0.9, 15.9 | held, 4761, 2172, 0.0, +63 %, 9.2, 2.1 | F | 1 | yes |
| ellcyl-Pm-3m-generic-b | m-3m |  | free, 8174, 6728, 0.0, +10 %, 2.3, 32.3 | free, 8385, 6728, 0.0, +10 %, 2.3, 32.3 |  | 4 | no |
| ellipsoid-P-1-on-b | -1 |  | held, 2333, 260, 0.0, +1 %, 0.0, 1.0 | held, 2985, 260, 0.0, +1 %, 0.0, 1.2 |  | 1 | yes |
| ellipsoid-P2m-near-b | 2/m | sizedist 0.45 | free, 8155, 6362, 0.0, +14 %, 3.0, 14.6 | free, 8623, 6422, 0.0, +14 %, 3.0, 17.3 |  | 1 | no |
| ellipsoid-Pmmm-generic-b | mmm |  | free, 2352, 793, 0.0, +6 %, 0.4, 1.0 | free, 2455, 793, 0.0, +6 %, 0.4, 1.6 |  | 1 | yes |
| ellipsoid-P4m-on-b | 4/m | po 0.47 | held, 5846, 3487, 0.0, +11 %, 0.0, 9.0 | held, 6121, 3260, 0.0, +11 %, 0.0, 9.7 |  | 1 | no |
| ellipsoid-P4mmm-near-b | 4/mmm | air 0.73 | free, 1537, 190, 0.0, +1 %, 0.4, 3.3 | free, 1638, 190, 0.0, +1 %, 0.4, 3.3 | F | 1 | yes |
| ellipsoid-P-3-generic-b | -3 |  | free, 4322, 2859, 0.0, +4 %, 1.5, 32.7 | free, 4553, 2859, 0.0, +4 %, 1.5, 32.7 |  | 3 | yes |
| ellipsoid-P-3m1-on-b | -3m |  | held, 5145, 3490, 0.1, +1 %, 0.0, 7.2 | held, 5660, 3636, 0.0, +1 %, 0.0, 174.1 |  | 1 | yes |
| ellipsoid-P6m-near-b | 6/m |  | held, 13305, 10827, 0.0, +5 %, 6.6, 7.4 | held, 16567, 13496, 0.0, +5 %, 6.6, 6.4 |  | 1 | yes |
| ellipsoid-P6mmm-generic-b | 6/mmm | sizedist 0.52 | free, 3445, 2274, 0.0, +56 %, 3.4, 13.1 | free, 3642, 2274, 0.0, +56 %, 3.4, 13.1 |  | 2 | yes |
| ellipsoid-Pm-3-on-b | m-3 |  | held, 2236, 474, 0.0, +0 %, 0.0, 171.6 | held, 2547, 474, 0.0, +0 %, 0.0, 171.6 |  | 2 | yes |
| ellipsoid-Pm-3m-near-b | m-3m | po 0.13 | held, 5444, 4131, 0.0, +46 %, 3.4, 9.6 | held, 5447, 4131, 0.0, +46 %, 3.4, 14.6 |  | 1 | no |
| spheroid-P-1-generic-b | -1 | sizedist 0.21 | free, 1891, 276, 0.0, +8 %, 1.9, 13.2 | free, 2124, 276, 0.0, +8 %, 1.9, 13.2 | F | 1 | yes |
| spheroid-P2m-on-b | 2/m | air 0.22 | held, 1505, 191, 0.0, +1 %, 0.0, 0.4 | held, 1606, 191, 0.0, +1 %, 0.0, 0.6 |  | 1 | yes |
| spheroid-Pmmm-near-b | mmm | po 0.42 | free, 1851, 262, 0.0, +125 %, 81.4, 20.8 | free, 2208, 262, 0.0, +125 %, 81.4, 20.8 | F | 1 | yes |
| spheroid-P4m-generic-b | 4/m | po 0.33 | free, 2369, 1158, 0.0, +46 %, 5.5, 10.4 | free, 2711, 1177, 0.0, +46 %, 5.5, 10.3 | F | 2 | yes |
| spheroid-P4mmm-on-b | 4/mmm |  | held, 1511, 416, 0.0, +1 %, 0.0, 3.7 | held, 1596, 416, 0.0, +1 %, 0.0, 4.1 |  | 1 | yes |
| spheroid-P-3-near-b | -3 | po 0.79 | free, 3633, 1932, 0.0, +∞, 11.2, 9.7 | free, 3613, 1819, 0.0, +∞, 11.2, 18.7 | F | 1 | yes |
| spheroid-P-3m1-generic-b | -3m |  | free, 1268, 177, 0.0, +0 %, 1.1, 1.6 | free, 1431, 177, 0.0, +0 %, 1.1, 3.6 |  | 1 | yes |
| spheroid-P6m-on-b | 6/m | sizedist 0.81 | held, 3158, 2192, 0.0, +28 %, 21.4, 50.0 | held, 3161, 2192, 0.0, +28 %, 21.4, 50.0 |  | 4 | yes |
| spheroid-P6mmm-near-b | 6/mmm |  | free, 2762, 276, 0.0, +1 %, 0.1, 10.7 | free, 3086, 276, 0.0, +1 %, 0.1, 13.1 |  | 1 | yes |
| spheroid-Pm-3-generic-b | m-3 |  | held, 3128, 2412, 0.0, +7 %, 2.1, 21.1 | held, 3131, 2412, 0.0, +7 %, 2.1, 18.6 |  | 2 | yes |
| spheroid-Pm-3m-on-b | m-3m |  | held, 1161, 407, 0.0, +0 %, 0.0, 8.4 | held, 1353, 407, 0.0, +0 %, 0.0, 5.7 |  | 1 | yes |
| sphere-P-1-1 | -1 |  | early, 1468, 0, —, —, —, — | early, 1471, 0, —, —, —, — |  | — | — |
| sphere-P-1-4 | -1 | air 0.80 | early, 1256, 0, —, —, —, — | early, 1373, 0, —, —, —, — | F | — | — |
| sphere-P2m-2 | 2/m | po 0.52 | free, 5704, 1005, —, —, —, — | free, 5958, 1005, —, —, —, — | F | — | yes |
| sphere-P2m-5 | 2/m |  | early, 1329, 0, —, —, —, — | early, 1332, 0, —, —, —, — |  | — | — |
| sphere-Pmmm-3 | mmm |  | early, 932, 0, —, —, —, — | early, 935, 0, —, —, —, — |  | — | — |
| sphere-Pmmm-6 | mmm | sizedist 0.25 | early, 981, 0, —, —, —, — | early, 984, 0, —, —, —, — |  | — | — |
| sphere-P4m-1 | 4/m | hump 0.99 | early, 1030, 0, —, —, —, — | early, 1124, 0, —, —, —, — | F | — | — |
| sphere-P4m-4 | 4/m |  | early, 976, 0, —, —, —, — | early, 979, 0, —, —, —, — |  | — | — |
| sphere-P4mmm-2 | 4/mmm | po 0.01 | free, 4527, 218, —, —, —, — | free, 4846, 218, —, —, —, — | F | — | yes |
| sphere-P4mmm-5 | 4/mmm | sizedist 0.34 | free, 1308, 335, —, —, —, — | free, 1373, 335, —, —, —, — |  | — | yes |
| sphere-P-3-3 | -3 | po 0.22 | early, 1150, 0, —, —, —, — | early, 1260, 0, —, —, —, — |  | — | — |
| sphere-P-3-6 | -3 |  | early, 1187, 0, —, —, —, — | early, 1190, 0, —, —, —, — |  | — | — |
| sphere-P-3m1-1 | -3m |  | early, 875, 0, —, —, —, — | early, 878, 0, —, —, —, — |  | — | — |
| sphere-P-3m1-4 | -3m | po 0.16 | free, 11810, 9314, —, —, —, — | free, 9350, 6560, —, —, —, — | F | — | no (cap) |
| sphere-P6m-2 | 6/m |  | early, 950, 0, —, —, —, — | early, 953, 0, —, —, —, — |  | — | — |
| sphere-P6m-5 | 6/m |  | early, 1009, 0, —, —, —, — | early, 1012, 0, —, —, —, — |  | — | — |
| sphere-P6mmm-3 | 6/mmm |  | early, 875, 0, —, —, —, — | early, 878, 0, —, —, —, — |  | — | — |
| sphere-P6mmm-6 | 6/mmm | hump 0.42 | held, 4112, 1326, —, —, —, — | held, 3899, 1326, —, —, —, — | F | — | yes |
| sphere-Pm-3-1 | m-3 |  | early, 609, 0, —, —, —, — | early, 612, 0, —, —, —, — |  | — | — |
| sphere-Pm-3-4 | m-3 |  | early, 732, 0, —, —, —, — | early, 735, 0, —, —, —, — |  | — | — |
| sphere-Pm-3m-2 | m-3m | impurity 0.86 | free, 4515, 2871, —, —, —, — | held, 2600, 898, —, —, —, — | F | — | yes |
| sphere-Pm-3m-5 | m-3m | sizedist 0.70 | held, 6960, 5394, —, —, —, — | held, 7164, 5394, —, —, —, — |  | — | yes |
