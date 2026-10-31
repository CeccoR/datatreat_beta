## wppm: the 77 screening runs

Reference: today. Reach against the best known exact χ² of each run over every record on this line (A/results/screen-wppm, A/results/s-wppm, A/results/sph-wppm, A/results/tr-wppm, A/results/xs-wppm, step1/h/results/id-wppm, step1/h/results/v2b-wppm).

| variant | runs | held / free / rejected (early) | outcome ≠ today | reached / judged | unbounded | worst (90 %) | thinnest | axis ° (90 %) | spheres kept | search evaluations | × today (per run median) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| today | 77 | 24 / 42 / 0 (0) | 0 | 62 / 66 | 6 | +4 % (+335 %) | +0 % | 1.6 (14.4) | 2 / 11 | 256493 | 1.000 (1.000) |
| briefs | 77 | 24 / 42 / 0 (0) | 2 | 62 / 66 | 4 | +4 % (+148 %) | +0 % | 1.3 (14.4) | 2 / 11 | 158335 | 0.617 (0.564) |

Anisotropy (longest/thinnest read ÷ true) on the 33 clean truths every variant kept: median, median |ln|, rows outside 0.9–1.1:

- today: 0.99, 0.02, 7
- briefs: 0.99, 0.02, 7

**briefs against today.** Outcome changed on 2: ellipsoid-Pm-3-on free → held; spheroid-P2m-on held → free. Reach lost on 1: sqbox-P-3m1-on (Δ 0.00 → 4.9); gained on 1: ellipsoid-Pm-3-on (Δ 216.6 → 0.00). Returned χ² (both kept), in χ²_ν: within 0.1 on 62, lower on 4 (ellcyl-P-1-near -0.20, ellcyl-P-3m1-near -0.24, ellipsoid-Pm-3-on -211.31, spheroid-P2m-on -6.19), higher on 2 (sqbox-P-3m1-on +4.89, sphere-P6mmm-1 +0.14). Solid changed on 4: box-P-3m1-near (extents -0 %, -0 %, +0 %; 2.0°); sqbox-P-3m1-on (extents +100 %, +100 %, -100 %; 63.0°); ellipsoid-Pm-3-on (extents -100 %, +3 %, -100 %; 10.1°); spheroid-P2m-on (extents -1 %, -1 %, -5 %; 1.4°).

**Cost** (sums over the runs; CPU of iso + search + report, and walls, s):

| variant | search ev | report ev | iso ev | CPU | wall: search | report | iso | ms an evaluation (search wall, median) |
|---|---|---|---|---|---|---|---|---|
| today | 256493 | 105582 | 40201 | — | 12426 | 4375 | 2719 | 33.85 |
| briefs | 158335 | 106286 | 40201 | 8439 | 4338 | 2374 | 1456 | 18.51 |

Search evaluations per Laue class, × today:

| class | briefs |
|---|---|
| -1 | 0.60 |
| 2/m | 0.63 |
| mmm | 0.59 |
| 4/m | 0.69 |
| 4/mmm | 0.68 |
| -3 | 0.70 |
| -3m | 0.58 |
| 6/m | 0.51 |
| 6/mmm | 0.58 |
| m-3 | 0.65 |
| m-3m | 0.54 |

| run | class | error | today: outcome, ev, Δ, worst, thinnest, axis | briefs: outcome, ev, Δ, worst, thinnest, axis |
|---|---|---|---|---|
| box-P-1-near | -1 | none | free, 4514, 0.02, +2 %, -0 %, 0.6° | free, 2744, 0.02, +2 %, -0 %, 0.6° |
| box-P2m-generic | 2/m | air | free, 3689, 0.00, +3 %, -1 %, 1.3° | free, 2150, 0.00, +3 %, -1 %, 1.3° |
| box-Pmmm-on | mmm | po | free, 4795, 0.00, +362 %, -1 %, 4.2° | free, 3605, 0.00, +362 %, -1 %, 4.2° |
| box-P4m-near | 4/m | none | free, 3288, 0.00, +4 %, +0 %, 0.8° | free, 1996, 0.00, +4 %, +0 %, 0.8° |
| box-P4mmm-generic | 4/mmm | none | free, 3085, 0.00, +2 %, +0 %, 0.1° | free, 1784, 0.00, +2 %, +0 %, 0.1° |
| box-P-3-on | -3 | sizedist | held, 6873, 0.00, +6 %, +0 %, 0.0° | held, 5326, 0.00, +6 %, +0 %, 0.0° |
| box-P-3m1-near | -3m | none | free, 3550, 0.00, +11 %, +6 %, 14.9° | free, 2076, 0.08, +11 %, +6 %, 15.5° |
| box-P6m-generic | 6/m | none | free, 3334, 0.00, +36 %, +1 %, 12.6° | free, 1844, 0.00, +36 %, +1 %, 12.6° |
| box-P6mmm-on | 6/mmm | impurity | free, 3984, 0.00, +∞, -12 %, 5.4° | free, 2709, 0.00, +∞, -12 %, 5.4° |
| box-Pm-3-near | m-3 | impurity | free, 3719, 0.00, +4 %, +3 %, 8.2° | free, 1985, 0.02, +4 %, +3 %, 8.3° |
| box-Pm-3m-generic | m-3m | hump | held, 4357, 0.00, +3 %, -0 %, 9.9° | held, 3797, 0.00, +3 %, -0 %, 9.9° |
| sqbox-P-1-on | -1 | sizedist | free, 4496, 0.41, +3 %, +1 %, 0.4° | free, 2860, 0.41, +3 %, +1 %, 0.4° |
| sqbox-P2m-near | 2/m | none | free, 3232, 0.00, +0 %, -0 %, 0.5° | free, 1845, 0.00, +0 %, -0 %, 0.5° |
| sqbox-Pmmm-generic | mmm | none | free, 3111, 6.55, +1 %, -0 %, 5.1° | free, 1814, 6.55, +1 %, -0 %, 5.1° |
| sqbox-P4m-on | 4/m | air | held, 3358, 0.23, +10 %, +1 %, 90.0° | held, 1994, 0.00, +10 %, +1 %, 90.0° |
| sqbox-P4mmm-near | 4/mmm | none | free, 4163, 0.00, +1 %, -1 %, 0.7° | free, 2533, 0.00, +1 %, -1 %, 0.6° |
| sqbox-P-3-generic | -3 | hump | free, 2960, 0.01, +39 %, +1 %, 2.9° | free, 1776, 0.02, +39 %, +1 %, 3.0° |
| sqbox-P-3m1-on | -3m | po | free, 3339, 0.00, +∞, +∞, 61.9° | free, 2095, 4.89, +30 %, -30 %, 20.2° |
| sqbox-P6m-near | 6/m | none | free, 3054, 0.00, +0 %, +0 %, 2.3° | free, 1666, 0.00, +0 %, +0 %, 2.3° |
| sqbox-P6mmm-generic | 6/mmm | impurity | free, 3214, 0.00, +24 %, -1 %, 0.8° | free, 1931, 0.00, +24 %, -1 %, 0.8° |
| sqbox-Pm-3-on | m-3 | none | held, 3122, 0.00, +0 %, -0 %, 0.0° | held, 1872, 0.00, +0 %, -0 %, 0.0° |
| sqbox-Pm-3m-near | m-3m | none | free, 3194, 0.00, +1 %, +0 %, 0.6° | free, 1573, 0.00, +1 %, +0 %, 0.6° |
| cylinder-P-1-generic | -1 | none | free, 3473, 0.00, +1 %, +0 %, 0.3° | free, 1930, 0.00, +1 %, +0 %, 0.3° |
| cylinder-P2m-on | 2/m | impurity | held, 3151, 0.00, +19 %, -2 %, 0.0° | held, 1872, 0.00, +19 %, -2 %, 0.0° |
| cylinder-Pmmm-near | mmm | none | free, 2575, 0.00, +2 %, +1 %, 1.1° | free, 1386, 0.00, +2 %, +1 %, 1.1° |
| cylinder-P4m-generic | 4/m | none | free, 2345, 0.00, +2 %, +0 %, 0.6° | free, 1304, 0.00, +2 %, +0 %, 0.6° |
| cylinder-P4mmm-on | 4/mmm | none | held, 2985, 0.00, +0 %, -0 %, 0.0° | held, 1818, 0.00, +0 %, -0 %, 0.0° |
| cylinder-P-3-near | -3 | none | free, 2732, 0.00, +6 %, -1 %, 0.9° | free, 1708, 0.00, +6 %, -1 %, 0.9° |
| cylinder-P-3m1-generic | -3m | po | held, 2674, 0.00, +34 %, -34 %, 13.4° | held, 1390, 0.00, +34 %, -34 %, 13.4° |
| cylinder-P6m-on | 6/m | none | held, 2473, 0.00, +1 %, +1 %, 0.0° | held, 1226, 0.00, +1 %, +1 %, 0.0° |
| cylinder-P6mmm-near | 6/mmm | air | free, 2316, 0.04, +1 %, +1 %, 2.0° | free, 1215, 0.00, +1 %, +1 %, 0.9° |
| cylinder-Pm-3-generic | m-3 | hump | free, 4751, 0.01, +13 %, -13 %, 14.3° | free, 4018, 0.00, +13 %, -13 %, 14.3° |
| cylinder-Pm-3m-on | m-3m | sizedist | held, 3258, 1502.11, +15 %, +3 %, 0.0° | held, 1825, 1502.11, +15 %, +3 %, 0.0° |
| ellcyl-P-1-near | -1 | po | free, 6280, 0.20, +∞, +489 %, 87.8° | free, 4568, 0.00, +∞, +483 %, 87.8° |
| ellcyl-P2m-generic | 2/m | none | free, 3688, 0.00, +4 %, +0 %, 2.6° | free, 2222, 0.00, +4 %, +0 %, 2.6° |
| ellcyl-Pmmm-on | mmm | air | held, 3414, 0.00, +1 %, +1 %, 0.0° | held, 1955, 0.00, +1 %, +1 %, 0.0° |
| ellcyl-P4m-near | 4/m | sizedist | free, 7090, 0.00, +16 %, +3 %, 1.2° | free, 6182, 0.01, +16 %, +3 %, 1.2° |
| ellcyl-P4mmm-generic | 4/mmm | hump | free, 2979, 0.00, +7 %, +3 %, 0.5° | free, 1680, 0.00, +7 %, +3 %, 0.5° |
| ellcyl-P-3-on | -3 | impurity | held, 5559, 0.00, +3 %, -3 %, 0.0° | held, 4867, 0.00, +3 %, -3 %, 0.0° |
| ellcyl-P-3m1-near | -3m | sizedist | free, 4208, 1.52, +∞, -3 %, 5.1° | free, 3464, 1.28, +∞, -3 %, 5.6° |
| ellcyl-P6m-generic | 6/m | none | free, 3501, 0.00, +7 %, +1 %, 7.2° | free, 1833, 0.00, +7 %, +1 %, 7.2° |
| ellcyl-P6mmm-on | 6/mmm | none | held, 5158, 0.00, +0 %, +0 %, 0.0° | held, 3412, 0.00, +0 %, +0 %, 0.0° |
| ellcyl-Pm-3-near | m-3 | none | free, 4129, 0.00, +1 %, +1 %, 2.5° | free, 3217, 0.00, +1 %, +1 %, 2.5° |
| ellcyl-Pm-3m-generic | m-3m | none | free, 3030, 0.00, +30 %, +0 %, 7.4° | free, 1430, 0.00, +30 %, +0 %, 7.4° |
| ellipsoid-P-1-on | -1 | none | held, 3921, 0.00, +2 %, +1 %, 0.0° | held, 2102, 0.00, +2 %, +1 %, 0.0° |
| ellipsoid-P2m-near | 2/m | none | held, 3661, 0.00, +2 %, +1 %, 4.3° | held, 2286, 0.00, +2 %, +1 %, 4.3° |
| ellipsoid-Pmmm-generic | mmm | none | free, 3026, 0.00, +4 %, -0 %, 0.9° | free, 1650, 0.00, +4 %, -0 %, 0.9° |
| ellipsoid-P4m-on | 4/m | hump | held, 4555, 0.00, +1 %, -0 %, 0.0° | held, 3315, 0.00, +1 %, -0 %, 0.0° |
| ellipsoid-P4mmm-near | 4/mmm | sizedist | free, 3672, 0.00, +∞, -9 %, 8.3° | free, 4298, 0.00, +∞, -9 %, 8.3° |
| ellipsoid-P-3-generic | -3 | impurity | free, 3927, 0.00, +117 %, +3 %, 14.5° | free, 2652, 0.00, +117 %, +3 %, 14.6° |
| ellipsoid-P-3m1-on | -3m | none | held, 3632, 0.00, +14 %, -1 %, 0.0° | held, 1723, 0.01, +14 %, -1 %, 0.0° |
| ellipsoid-P6m-near | 6/m | none | held, 3866, 0.00, +77 %, +3 %, 6.8° | held, 2119, 0.00, +77 %, +3 %, 6.8° |
| ellipsoid-P6mmm-generic | 6/mmm | air | free, 2441, 0.00, +5 %, +5 %, 2.5° | free, 1066, 0.00, +5 %, +5 %, 2.5° |
| ellipsoid-Pm-3-on | m-3 | po | free, 2823, 216.63, +∞, -1 %, 13.1° | held, 1683, 0.00, +3 %, +2 %, 0.0° |
| ellipsoid-Pm-3m-near | m-3m | none | held, 2629, 0.00, +14 %, +1 %, 3.2° | held, 939, 0.01, +14 %, +1 %, 3.2° |
| spheroid-P-1-generic | -1 | po | free, 3301, 0.00, +308 %, +308 %, 88.0° | free, 1787, 0.00, +308 %, +308 %, 88.0° |
| spheroid-P2m-on | 2/m | impurity | held, 3706, 0.48, +6 %, -6 %, 0.0° | free, 3261, 0.00, +11 %, -6 %, 1.4° |
| spheroid-Pmmm-near | mmm | air | held, 2407, 0.00, +0 %, +0 %, 6.1° | held, 1241, 0.00, +0 %, +0 %, 6.1° |
| spheroid-P4m-generic | 4/m | none | free, 2565, 0.00, +1 %, +1 %, 8.5° | free, 1614, 0.00, +1 %, +1 %, 8.5° |
| spheroid-P4mmm-on | 4/mmm | hump | held, 2632, 0.00, +3 %, -0 %, 0.0° | held, 1532, 0.00, +3 %, -0 %, 0.0° |
| spheroid-P-3-near | -3 | none | held, 2201, 0.00, +6 %, -6 %, 13.2° | held, 1172, 0.00, +6 %, -6 %, 13.2° |
| spheroid-P-3m1-generic | -3m | none | free, 2316, 0.00, +1 %, -0 %, 0.1° | free, 1102, 0.00, +1 %, -0 %, 0.1° |
| spheroid-P6m-on | 6/m | sizedist | held, 2038, 0.00, +179 %, +179 %, 28.5° | held, 909, 0.00, +179 %, +179 %, 28.5° |
| spheroid-P6mmm-near | 6/mmm | hump | free, 2316, 0.00, +7 %, -7 %, 1.3° | free, 1149, 0.00, +7 %, -7 %, 1.3° |
| spheroid-Pm-3-generic | m-3 | none | free, 2118, 0.00, +4 %, +4 %, 6.0° | free, 1138, 0.00, +4 %, +4 %, 6.0° |
| spheroid-Pm-3m-on | m-3m | none | held, 2138, 0.00, +1 %, +0 %, 0.0° | held, 842, 0.00, +1 %, +0 %, 0.0° |
| sphere-P-1-2 | -1 | none | rejected, 3420, —, — | rejected, 1710, —, — |
| sphere-P2m-3 | 2/m | none | early, 2636, —, — | early, 1302, —, — |
| sphere-Pmmm-1 | mmm | none | early, 2038, —, — | early, 967, —, — |
| sphere-P4m-2 | 4/m | none | early, 2383, —, — | early, 1162, —, — |
| sphere-P4mmm-3 | 4/mmm | air | early, 1952, —, — | early, 1014, —, — |
| sphere-P-3-1 | -3 | none | early, 2330, —, — | early, 1109, —, — |
| sphere-P-3m1-2 | -3m | none | early, 2206, —, — | early, 895, —, — |
| sphere-P6m-3 | 6/m | impurity | early, 2247, —, — | early, 931, —, — |
| sphere-P6mmm-1 | 6/mmm | po | free, 3376, —, — | free, 1787, —, — |
| sphere-Pm-3-2 | m-3 | hump | early, 1788, —, — | early, 578, —, — |
| sphere-Pm-3m-3 | m-3m | sizedist | free, 2026, —, — | free, 803, —, — |

