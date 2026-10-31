## wppm: the 77 screening runs

Reference: v2b. Reach against the best known exact χ² of each run over every record on this line ($W/fs2/A/results/screen-wppm, $W/fs2/A/results/s-wppm, $W/fs2/A/results/sph-wppm, $W/fs2/A/results/tr-wppm, $W/fs2/A/results/xs-wppm, $W/fs2/step1/h/results/id-wppm, $W/fs2/step1/h/results/v2b-wppm, $W/fs2/step2/h/results/W0, $W/fs2/step2/h/results/W1, $W/fs2/step2/h/results/W3, $W/fs2/step2/h/results/W4, $W/fs2/step2/h/results/W5).

| variant | runs | held / free / rejected (early) | outcome ≠ v2b | reached / judged | unbounded | worst (90 %) | thinnest | axis ° (90 %) | spheres kept | search evaluations | × v2b (per run median) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| v2b | 77 | 24 / 42 / 0 (0) | 0 | 62 / 66 | 4 | +4 % (+148 %) | +0 % | 1.3 (14.4) | 2 / 11 | 158335 | 1.000 (1.000) |
| W5 | 77 | 23 / 43 / 0 (0) | 1 | 62 / 66 | 4 | +4 % (+148 %) | +0 % | 1.3 (14.3) | 2 / 11 | 155872 | 0.984 (1.000) |
| W4 | 77 | 25 / 41 / 0 (0) | 1 | 62 / 66 | 4 | +4 % (+148 %) | +0 % | 1.2 (14.3) | 2 / 11 | 155879 | 0.984 (0.992) |

Anisotropy (longest/thinnest read ÷ true) on the 33 clean truths every variant kept: median, median |ln|, rows outside 0.9–1.1:

- v2b: 0.99, 0.02, 7
- W5: 0.99, 0.02, 7
- W4: 0.99, 0.02, 7

**W5 against v2b.** Outcome changed on 1: box-Pm-3m-generic held → free. Reach lost on 0; gained on 0. Returned χ² (both kept), in χ²_ν: within 0.1 on 64, lower on 3 (box-P-3m1-near -0.13, box-Pm-3m-generic -2.30, sphere-P6mmm-1 -0.96), higher on 1 (ellcyl-P-1-near +0.20). Solid changed on 2: box-P-3m1-near (extents -0 %, +1 %, -0 %; 3.8°); box-Pm-3m-generic (extents -0 %, -3 %, +14 %; 3.0°).

**W4 against v2b.** Outcome changed on 1: spheroid-P2m-on free → held. Reach lost on 0; gained on 0. Returned χ² (both kept), in χ²_ν: within 0.1 on 56, lower on 7 (box-Pmmm-on -0.71, box-P-3-on -0.19, box-P-3m1-near -0.11, sqbox-P-1-on -0.36, sqbox-P4m-on -0.88, sqbox-P6mmm-generic -0.19, sphere-P6mmm-1 -22.20), higher on 5 (sqbox-P4mmm-near +0.13, cylinder-P4mmm-on +0.15, cylinder-Pm-3m-on +41.69, ellcyl-P-3m1-near +0.52, spheroid-P2m-on +6.19). Solid changed on 3: box-P-3m1-near (extents -0 %, +1 %, -0 %; 3.1°); spheroid-P2m-on (extents +1 %, +1 %, +6 %; 1.4°); sphere-P6mmm-1 (extents +13 %, -6 %, +2 %; 19.4°).

**Cost** (sums over the runs; CPU of iso + search + report, and walls, s):

| variant | search ev | report ev | iso ev | CPU | wall: search | report | iso | ms an evaluation (search wall, median) |
|---|---|---|---|---|---|---|---|---|
| v2b | 158335 | 106286 | 40201 | 8439 | 4338 | 2374 | 1456 | 18.51 |
| W5 | 155872 | 105463 | 40196 | 2048 | 1043 | 604 | 334 | 5.03 |
| W4 | 155879 | 106008 | 40219 | 1678 | 869 | 493 | 276 | 4.13 |

Search evaluations per Laue class, × v2b:

| class | W5 | W4 |
|---|---|---|
| -1 | 0.91 | 0.89 |
| 2/m | 0.95 | 1.01 |
| mmm | 1.00 | 0.92 |
| 4/m | 1.01 | 0.96 |
| 4/mmm | 0.89 | 0.94 |
| -3 | 1.07 | 1.01 |
| -3m | 1.01 | 1.01 |
| 6/m | 1.00 | 1.01 |
| 6/mmm | 0.98 | 1.04 |
| m-3 | 0.98 | 1.00 |
| m-3m | 1.03 | 1.10 |

| run | class | error | v2b: outcome, ev, Δ, worst, thinnest, axis | W5: outcome, ev, Δ, worst, thinnest, axis | W4: outcome, ev, Δ, worst, thinnest, axis |
|---|---|---|---|---|---|
| box-P-1-near | -1 | none | free, 2744, 0.03, +2 %, -0 %, 0.6° | free, 2744, 0.03, +2 %, -0 %, 0.6° | free, 2681, 0.00, +2 %, -0 %, 0.6° |
| box-P2m-generic | 2/m | air | free, 2150, 0.04, +3 %, -1 %, 1.3° | free, 2150, 0.04, +3 %, -1 %, 1.3° | free, 2077, 0.00, +3 %, -1 %, 1.4° |
| box-Pmmm-on | mmm | po | free, 3605, 0.71, +362 %, -1 %, 4.2° | free, 3605, 0.71, +362 %, -1 %, 4.2° | free, 2789, 0.00, +342 %, -1 %, 4.2° |
| box-P4m-near | 4/m | none | free, 1996, 0.05, +4 %, +0 %, 0.8° | free, 1996, 0.05, +4 %, +0 %, 0.8° | free, 1993, 0.00, +4 %, +0 %, 0.9° |
| box-P4mmm-generic | 4/mmm | none | free, 1784, 0.09, +2 %, +0 %, 0.1° | free, 1784, 0.09, +2 %, +0 %, 0.1° | free, 1755, 0.00, +2 %, +0 %, 0.1° |
| box-P-3-on | -3 | sizedist | held, 5326, 0.19, +6 %, +0 %, 0.0° | held, 6450, 0.19, +6 %, +0 %, 0.0° | held, 3494, 0.00, +7 %, +0 %, 0.0° |
| box-P-3m1-near | -3m | none | free, 2076, 0.13, +11 %, +6 %, 15.5° | free, 1882, 0.00, +12 %, +5 %, 14.4° | free, 1690, 0.02, +11 %, +5 %, 14.4° |
| box-P6m-generic | 6/m | none | free, 1844, 0.00, +36 %, +1 %, 12.6° | free, 1936, 0.00, +35 %, +1 %, 12.6° | free, 1969, 0.00, +37 %, +1 %, 12.6° |
| box-P6mmm-on | 6/mmm | impurity | free, 2709, 0.00, +∞, -12 %, 5.4° | free, 2537, 0.00, +∞, -12 %, 5.4° | free, 2758, 0.04, +∞, -12 %, 5.3° |
| box-Pm-3-near | m-3 | impurity | free, 1985, 0.09, +4 %, +3 %, 8.3° | free, 1985, 0.09, +4 %, +3 %, 8.3° | free, 1780, 0.00, +4 %, +3 %, 8.2° |
| box-Pm-3m-generic | m-3m | hump | held, 3797, 0.00, +3 %, -0 %, 9.9° | free, 3980, 0.11, +14 %, -0 %, 12.5° | held, 4866, 0.04, +3 %, -0 %, 9.9° |
| sqbox-P-1-on | -1 | sizedist | free, 2860, 0.41, +3 %, +1 %, 0.4° | free, 2860, 0.41, +3 %, +1 %, 0.4° | free, 2440, 0.05, +3 %, +1 %, 0.5° |
| sqbox-P2m-near | 2/m | none | free, 1845, 0.05, +0 %, -0 %, 0.5° | free, 1845, 0.05, +0 %, -0 %, 0.5° | free, 1790, 0.00, +0 %, -0 %, 0.5° |
| sqbox-Pmmm-generic | mmm | none | free, 1814, 6.55, +1 %, -0 %, 5.1° | free, 1814, 6.55, +1 %, -0 %, 5.1° | free, 1785, 6.57, +1 %, -0 %, 5.1° |
| sqbox-P4m-on | 4/m | air | held, 1994, 0.00, +10 %, +1 %, 90.0° | held, 1994, 0.00, +10 %, +1 %, 90.0° | held, 1849, 0.14, +12 %, +2 %, 90.0° |
| sqbox-P4mmm-near | 4/mmm | none | free, 2533, 0.00, +1 %, -1 %, 0.6° | free, 2579, 0.00, +1 %, -1 %, 0.7° | free, 2529, 0.13, +1 %, -1 %, 0.7° |
| sqbox-P-3-generic | -3 | hump | free, 1776, 0.02, +39 %, +1 %, 3.0° | free, 1776, 0.02, +39 %, +1 %, 3.0° | free, 1912, 0.00, +39 %, +2 %, 2.8° |
| sqbox-P-3m1-on | -3m | po | free, 2095, 4.89, +30 %, -30 %, 20.2° | free, 2095, 4.89, +30 %, -30 %, 20.2° | free, 2569, 4.83, +30 %, -30 %, 20.2° |
| sqbox-P6m-near | 6/m | none | free, 1666, 0.01, +0 %, +0 %, 2.3° | free, 1666, 0.01, +0 %, +0 %, 2.3° | free, 1777, 0.00, +0 %, +0 %, 2.3° |
| sqbox-P6mmm-generic | 6/mmm | impurity | free, 1931, 0.19, +24 %, -1 %, 0.8° | free, 1931, 0.19, +24 %, -1 %, 0.8° | free, 1722, 0.00, +21 %, -1 %, 0.7° |
| sqbox-Pm-3-on | m-3 | none | held, 1872, 0.00, +0 %, -0 %, 0.0° | held, 1912, 0.00, +0 %, -0 %, 0.0° | held, 1592, 0.00, +0 %, -0 %, 0.0° |
| sqbox-Pm-3m-near | m-3m | none | free, 1573, 0.00, +1 %, +0 %, 0.6° | free, 1567, 0.00, +1 %, +0 %, 0.6° | free, 1413, 0.06, +1 %, +0 %, 0.6° |
| cylinder-P-1-generic | -1 | none | free, 1930, 0.00, +1 %, +0 %, 0.3° | free, 1930, 0.00, +1 %, +0 %, 0.3° | free, 1955, 0.01, +1 %, +0 %, 0.3° |
| cylinder-P2m-on | 2/m | impurity | held, 1872, 0.00, +19 %, -2 %, 0.0° | held, 1871, 0.00, +19 %, -2 %, 0.0° | held, 1793, 0.00, +19 %, -2 %, 0.0° |
| cylinder-Pmmm-near | mmm | none | free, 1386, 0.01, +2 %, +1 %, 1.1° | free, 1386, 0.01, +2 %, +1 %, 1.1° | free, 1322, 0.00, +2 %, +1 %, 1.1° |
| cylinder-P4m-generic | 4/m | none | free, 1304, 0.00, +2 %, +0 %, 0.6° | free, 1304, 0.00, +2 %, +0 %, 0.6° | free, 1288, 0.01, +2 %, +0 %, 0.6° |
| cylinder-P4mmm-on | 4/mmm | none | held, 1818, 0.02, +0 %, -0 %, 0.0° | held, 1818, 0.02, +0 %, -0 %, 0.0° | held, 2386, 0.00, +0 %, -0 %, 0.0° |
| cylinder-P-3-near | -3 | none | free, 1708, 0.01, +6 %, -1 %, 0.9° | free, 1708, 0.01, +6 %, -1 %, 0.9° | free, 1531, 0.00, +6 %, -1 %, 0.9° |
| cylinder-P-3m1-generic | -3m | po | held, 1390, 0.00, +34 %, -34 %, 13.4° | held, 1390, 0.00, +34 %, -34 %, 13.4° | held, 1378, 0.00, +34 %, -34 %, 13.4° |
| cylinder-P6m-on | 6/m | none | held, 1226, 0.00, +1 %, +1 %, 0.0° | held, 1226, 0.00, +1 %, +1 %, 0.0° | held, 1320, 0.00, +1 %, +1 %, 0.0° |
| cylinder-P6mmm-near | 6/mmm | air | free, 1215, 0.00, +1 %, +1 %, 0.9° | free, 1215, 0.00, +1 %, +1 %, 0.9° | free, 1367, 0.00, +1 %, +1 %, 0.9° |
| cylinder-Pm-3-generic | m-3 | hump | free, 4018, 0.00, +13 %, -13 %, 14.3° | free, 4018, 0.00, +13 %, -13 %, 14.3° | free, 4119, 0.01, +13 %, -13 %, 14.3° |
| cylinder-Pm-3m-on | m-3m | sizedist | held, 1825, 1502.11, +15 %, +3 %, 0.0° | held, 1823, 1502.11, +15 %, +3 %, 0.0° | held, 1863, 1545.96, +19 %, +5 %, 0.0° |
| ellcyl-P-1-near | -1 | po | free, 4568, 0.00, +∞, +483 %, 87.8° | free, 2893, 0.20, +∞, +489 %, 87.8° | free, 3066, 0.10, +∞, +481 %, 87.8° |
| ellcyl-P2m-generic | 2/m | none | free, 2222, 0.02, +4 %, +0 %, 2.6° | free, 1913, 0.02, +4 %, +0 %, 2.6° | free, 2127, 0.00, +4 %, +0 %, 2.6° |
| ellcyl-Pmmm-on | mmm | air | held, 1955, 0.00, +1 %, +1 %, 0.0° | held, 1979, 0.00, +1 %, +1 %, 0.0° | held, 1939, 0.02, +1 %, +1 %, 0.0° |
| ellcyl-P4m-near | 4/m | sizedist | free, 6182, 0.10, +16 %, +3 %, 1.2° | free, 6206, 0.10, +16 %, +3 %, 1.2° | free, 6000, 0.00, +16 %, +3 %, 1.2° |
| ellcyl-P4mmm-generic | 4/mmm | hump | free, 1680, 0.00, +7 %, +3 %, 0.5° | free, 1681, 0.00, +7 %, +3 %, 0.5° | free, 1655, 0.01, +7 %, +3 %, 0.5° |
| ellcyl-P-3-on | -3 | impurity | held, 4867, 0.01, +3 %, -3 %, 0.0° | held, 4868, 0.01, +3 %, -3 %, 0.0° | held, 7270, 0.00, +3 %, -3 %, 0.0° |
| ellcyl-P-3m1-near | -3m | sizedist | free, 3464, 1.28, +∞, -3 %, 5.6° | free, 3725, 1.24, +∞, -3 %, 5.2° | free, 3492, 1.79, +∞, -4 %, 5.0° |
| ellcyl-P6m-generic | 6/m | none | free, 1833, 0.03, +7 %, +1 %, 7.2° | free, 1753, 0.03, +7 %, +1 %, 7.2° | free, 1598, 0.00, +8 %, +1 %, 7.2° |
| ellcyl-P6mmm-on | 6/mmm | none | held, 3412, 0.00, +0 %, +0 %, 0.0° | held, 3224, 0.00, +0 %, +0 %, 0.0° | held, 3115, 0.03, +0 %, +0 %, 0.0° |
| ellcyl-Pm-3-near | m-3 | none | free, 3217, 0.00, +1 %, +1 %, 2.5° | free, 2741, 0.00, +1 %, +1 %, 2.5° | free, 2881, 0.00, +1 %, +1 %, 2.4° |
| ellcyl-Pm-3m-generic | m-3m | none | free, 1430, 0.00, +30 %, +0 %, 7.4° | free, 1496, 0.00, +30 %, +0 %, 7.4° | free, 1600, 0.01, +31 %, +0 %, 7.4° |
| ellipsoid-P-1-on | -1 | none | held, 2102, 0.00, +2 %, +1 %, 0.0° | held, 2163, 0.00, +2 %, +1 %, 0.0° | held, 2169, 0.00, +2 %, +1 %, 0.0° |
| ellipsoid-P2m-near | 2/m | none | held, 2286, 0.00, +2 %, +1 %, 4.3° | held, 2137, 0.00, +2 %, +1 %, 4.3° | held, 2055, 0.02, +2 %, +1 %, 4.3° |
| ellipsoid-Pmmm-generic | mmm | none | free, 1650, 0.00, +4 %, -0 %, 0.9° | free, 1663, 0.00, +4 %, -0 %, 0.9° | free, 1658, 0.00, +4 %, -0 %, 0.9° |
| ellipsoid-P4m-on | 4/m | hump | held, 3315, 0.00, +1 %, -0 %, 0.0° | held, 3396, 0.00, +1 %, -0 %, 0.0° | held, 2891, 0.00, +1 %, -0 %, 0.0° |
| ellipsoid-P4mmm-near | 4/mmm | sizedist | free, 4298, 0.00, +∞, -9 %, 8.3° | free, 2672, 0.00, +∞, -9 %, 8.3° | free, 2712, 0.00, +∞, -9 %, 8.3° |
| ellipsoid-P-3-generic | -3 | impurity | free, 2652, 0.00, +117 %, +3 %, 14.6° | free, 2808, 0.00, +117 %, +3 %, 14.6° | free, 2292, 0.00, +117 %, +3 %, 14.6° |
| ellipsoid-P-3m1-on | -3m | none | held, 1723, 0.01, +14 %, -1 %, 0.0° | held, 1804, 0.00, +14 %, -1 %, 0.0° | held, 1748, 0.00, +14 %, -1 %, 0.0° |
| ellipsoid-P6m-near | 6/m | none | held, 2119, 0.00, +77 %, +3 %, 6.8° | held, 2125, 0.00, +77 %, +3 %, 6.8° | held, 2167, 0.00, +77 %, +3 %, 6.8° |
| ellipsoid-P6mmm-generic | 6/mmm | air | free, 1066, 0.00, +5 %, +5 %, 2.5° | free, 1187, 0.00, +5 %, +5 %, 2.5° | free, 1143, 0.01, +5 %, +5 %, 2.5° |
| ellipsoid-Pm-3-on | m-3 | po | held, 1683, 0.00, +3 %, +2 %, 0.0° | held, 1895, 0.01, +3 %, +2 %, 0.0° | held, 2422, 0.00, +3 %, +2 %, 0.0° |
| ellipsoid-Pm-3m-near | m-3m | none | held, 939, 0.01, +14 %, +1 %, 3.2° | held, 992, 0.00, +14 %, +1 %, 3.2° | held, 978, 0.00, +14 %, +1 %, 3.2° |
| spheroid-P-1-generic | -1 | po | free, 1787, 0.00, +308 %, +308 %, 88.0° | free, 1816, 0.00, +308 %, +308 %, 88.0° | free, 1786, 0.00, +308 %, +308 %, 88.0° |
| spheroid-P2m-on | 2/m | impurity | free, 3261, 0.00, +11 %, -6 %, 1.4° | free, 2941, 0.05, +10 %, -6 %, 1.3° | held, 3917, 0.77, +6 %, -6 %, 0.0° |
| spheroid-Pmmm-near | mmm | air | held, 1241, 0.00, +0 %, +0 %, 6.1° | held, 1239, 0.00, +0 %, +0 %, 6.1° | held, 1210, 0.00, +0 %, +0 %, 6.1° |
| spheroid-P4m-generic | 4/m | none | free, 1614, 0.00, +1 %, +1 %, 8.5° | free, 1613, 0.00, +1 %, +1 %, 8.5° | free, 1583, 0.00, +1 %, +1 %, 8.5° |
| spheroid-P4mmm-on | 4/mmm | hump | held, 1532, 0.00, +3 %, -0 %, 0.0° | held, 1532, 0.00, +3 %, -0 %, 0.0° | held, 1735, 0.00, +3 %, -0 %, 0.0° |
| spheroid-P-3-near | -3 | none | held, 1172, 0.00, +6 %, -6 %, 13.2° | held, 1166, 0.00, +6 %, -6 %, 13.2° | held, 1167, 0.00, +6 %, -6 %, 13.2° |
| spheroid-P-3m1-generic | -3m | none | free, 1102, 0.00, +1 %, -0 %, 0.1° | free, 1097, 0.00, +1 %, -0 %, 0.1° | free, 1101, 0.01, +1 %, -0 %, 0.1° |
| spheroid-P6m-on | 6/m | sizedist | held, 909, 0.00, +179 %, +179 %, 28.5° | held, 898, 0.00, +179 %, +179 %, 28.5° | held, 909, 0.00, +179 %, +179 %, 28.5° |
| spheroid-P6mmm-near | 6/mmm | hump | free, 1149, 0.00, +7 %, -7 %, 1.3° | free, 1089, 0.00, +7 %, -7 %, 1.3° | free, 1121, 0.00, +7 %, -7 %, 1.3° |
| spheroid-Pm-3-generic | m-3 | none | free, 1138, 0.00, +4 %, +4 %, 6.0° | free, 1138, 0.00, +4 %, +4 %, 6.0° | free, 1056, 0.00, +4 %, +4 %, 6.0° |
| spheroid-Pm-3m-on | m-3m | none | held, 842, 0.00, +1 %, +0 %, 0.0° | held, 838, 0.00, +1 %, +0 %, 0.0° | held, 758, 0.00, +1 %, +0 %, 0.0° |
| sphere-P-1-2 | -1 | none | rejected, 1710, —, — | rejected, 1715, —, — | rejected, 1704, —, — |
| sphere-P2m-3 | 2/m | none | early, 1302, —, — | early, 1318, —, — | early, 1262, —, — |
| sphere-Pmmm-1 | mmm | none | early, 967, —, — | early, 967, —, — | early, 945, —, — |
| sphere-P4m-2 | 4/m | none | early, 1162, —, — | early, 1164, —, — | early, 1180, —, — |
| sphere-P4mmm-3 | 4/mmm | air | early, 1014, —, — | early, 1016, —, — | early, 1019, —, — |
| sphere-P-3-1 | -3 | none | early, 1109, —, — | early, 1109, —, — | early, 1117, —, — |
| sphere-P-3m1-2 | -3m | none | early, 895, —, — | early, 895, —, — | early, 893, —, — |
| sphere-P6m-3 | 6/m | impurity | early, 931, —, — | early, 931, —, — | early, 942, —, — |
| sphere-P6mmm-1 | 6/mmm | po | free, 1787, —, — | free, 1868, —, — | free, 2577, —, — |
| sphere-Pm-3-2 | m-3 | hump | early, 578, —, — | early, 578, —, — | early, 570, —, — |
| sphere-Pm-3m-3 | m-3m | sizedist | free, 803, —, — | free, 846, —, — | free, 797, —, — |

