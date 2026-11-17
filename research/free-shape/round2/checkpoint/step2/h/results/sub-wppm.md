## wppm: the 22 runs (the sub-screen)

Reference: W0. Reach against the best known exact χ² of each run over every record on this line ($W/fs2/A/results/screen-wppm, $W/fs2/A/results/s-wppm, $W/fs2/A/results/sph-wppm, $W/fs2/A/results/tr-wppm, $W/fs2/A/results/xs-wppm, $W/fs2/step1/h/results/id-wppm, $W/fs2/step1/h/results/v2b-wppm, $W/fs2/step2/h/results/W0, $W/fs2/step2/h/results/W1, $W/fs2/step2/h/results/W3, $W/fs2/step2/h/results/W4, $W/fs2/step2/h/results/W5).

| variant | runs | held / free / rejected (early) | outcome ≠ W0 | reached / judged | unbounded | worst (90 %) | thinnest | axis ° (90 %) | spheres kept | search evaluations | × W0 (per run median) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| W0 | 22 | 8 / 14 / 0 (0) | 0 | 20 / 22 | 0 | +6 % (+29 %) | +0 % | 1.9 (15.4) | 0 / 0 | 40458 | 1.000 (1.000) |
| W3 | 22 | 8 / 14 / 0 (0) | 0 | 20 / 22 | 0 | +6 % (+29 %) | +0 % | 1.9 (14.6) | 0 / 0 | 40016 | 0.989 (0.981) |
| W5 | 22 | 8 / 14 / 0 (0) | 0 | 20 / 22 | 0 | +6 % (+29 %) | +0 % | 1.9 (14.5) | 0 / 0 | 40201 | 0.994 (1.000) |
| W4 | 22 | 8 / 14 / 0 (0) | 0 | 20 / 22 | 0 | +6 % (+29 %) | +0 % | 1.9 (14.6) | 0 / 0 | 39527 | 0.977 (0.976) |

Anisotropy (longest/thinnest read ÷ true) on the 11 clean truths every variant kept: median, median |ln|, rows outside 0.9–1.1:

- W0: 0.98, 0.04, 3
- W3: 0.98, 0.04, 3
- W5: 0.98, 0.04, 3
- W4: 0.98, 0.04, 3

**W3 against W0.** Outcome changed on 0. Reach lost on 0; gained on 0. Returned χ² (both kept), in χ²_ν: within 0.1 on 17, lower on 3 (box-P-3m1-near -0.10, sqbox-P-1-on -0.36, sqbox-P4m-on -0.88), higher on 2 (cylinder-P4mmm-on +0.15, cylinder-Pm-3m-on +41.69). Solid changed on 1: box-P-3m1-near (extents -0 %, +1 %, -0 %; 2.5°).

**W5 against W0.** Outcome changed on 0. Reach lost on 0; gained on 0. Returned χ² (both kept), in χ²_ν: within 0.1 on 21, lower on 1 (box-P-3m1-near -0.13), higher on 0. Solid changed on 1: box-P-3m1-near (extents -0 %, +1 %, -0 %; 3.8°).

**W4 against W0.** Outcome changed on 0. Reach lost on 0; gained on 0. Returned χ² (both kept), in χ²_ν: within 0.1 on 17, lower on 3 (box-P-3m1-near -0.11, sqbox-P-1-on -0.36, sqbox-P4m-on -0.88), higher on 2 (cylinder-P4mmm-on +0.15, cylinder-Pm-3m-on +41.69). Solid changed on 1: box-P-3m1-near (extents -0 %, +1 %, -0 %; 3.1°).

**Cost** (sums over the runs; CPU of iso + search + report, and walls, s):

| variant | search ev | report ev | iso ev | CPU | wall: search | report | iso | ms an evaluation (search wall, median) |
|---|---|---|---|---|---|---|---|---|
| W0 | 40458 | 36283 | 10372 | 2342 | 1139 | 787 | 347 | 18.37 |
| W3 | 40016 | 35747 | 10375 | 875 | 412 | 269 | 148 | 6.54 |
| W5 | 40201 | 36479 | 10372 | 576 | 274 | 202 | 79 | 5.02 |
| W4 | 39527 | 35814 | 10375 | 458 | 220 | 161 | 65 | 4.15 |

Search evaluations per Laue class, × W0:

| class | W3 | W5 | W4 |
|---|---|---|---|
| -1 | 0.91 | 1.00 | 0.91 |
| 2/m | 1.00 | 0.92 | 0.96 |
| mmm | 0.99 | 1.00 | 0.99 |
| 4/m | 0.96 | 1.00 | 0.96 |
| 4/mmm | 1.15 | 1.00 | 1.16 |
| -3 | 0.90 | 1.04 | 0.90 |
| -3m | 1.08 | 0.95 | 1.02 |
| 6/m | 0.93 | 0.97 | 0.95 |
| 6/mmm | 1.03 | 1.03 | 1.02 |
| m-3 | 0.86 | 1.01 | 0.87 |
| m-3m | 1.11 | 1.02 | 1.06 |

| run | class | error | W0: outcome, ev, Δ, worst, thinnest, axis | W3: outcome, ev, Δ, worst, thinnest, axis | W5: outcome, ev, Δ, worst, thinnest, axis | W4: outcome, ev, Δ, worst, thinnest, axis |
|---|---|---|---|---|---|---|
| box-P-1-near | -1 | none | free, 2744, 0.03, +2 %, -0 %, 0.6° | free, 2681, 0.00, +2 %, -0 %, 0.6° | free, 2744, 0.03, +2 %, -0 %, 0.6° | free, 2681, 0.00, +2 %, -0 %, 0.6° |
| box-P4m-near | 4/m | none | free, 1996, 0.05, +4 %, +0 %, 0.8° | free, 1985, 0.00, +4 %, +0 %, 0.9° | free, 1996, 0.05, +4 %, +0 %, 0.8° | free, 1993, 0.00, +4 %, +0 %, 0.9° |
| box-P-3m1-near | -3m | none | free, 2076, 0.13, +11 %, +6 %, 15.5° | free, 1947, 0.03, +11 %, +5 %, 14.3° | free, 1882, 0.00, +12 %, +5 %, 14.4° | free, 1690, 0.02, +11 %, +5 %, 14.4° |
| box-Pm-3-near | m-3 | impurity | free, 1985, 0.09, +4 %, +3 %, 8.3° | free, 1780, 0.00, +4 %, +3 %, 8.2° | free, 1985, 0.09, +4 %, +3 %, 8.3° | free, 1780, 0.00, +4 %, +3 %, 8.2° |
| sqbox-P-1-on | -1 | sizedist | free, 2860, 0.41, +3 %, +1 %, 0.4° | free, 2440, 0.05, +3 %, +1 %, 0.5° | free, 2860, 0.41, +3 %, +1 %, 0.4° | free, 2440, 0.05, +3 %, +1 %, 0.5° |
| sqbox-P4m-on | 4/m | air | held, 1994, 0.00, +10 %, +1 %, 90.0° | held, 1849, 0.14, +12 %, +2 %, 90.0° | held, 1994, 0.00, +10 %, +1 %, 90.0° | held, 1849, 0.14, +12 %, +2 %, 90.0° |
| sqbox-P-3m1-on | -3m | po | free, 2095, 4.89, +30 %, -30 %, 20.2° | free, 2569, 4.83, +30 %, -30 %, 20.2° | free, 2095, 4.89, +30 %, -30 %, 20.2° | free, 2569, 4.83, +30 %, -30 %, 20.2° |
| sqbox-Pm-3-on | m-3 | none | held, 1872, 0.00, +0 %, -0 %, 0.0° | held, 1552, 0.00, +0 %, -0 %, 0.0° | held, 1912, 0.00, +0 %, -0 %, 0.0° | held, 1592, 0.00, +0 %, -0 %, 0.0° |
| cylinder-P2m-on | 2/m | impurity | held, 1872, 0.00, +19 %, -2 %, 0.0° | held, 1793, 0.00, +19 %, -2 %, 0.0° | held, 1871, 0.00, +19 %, -2 %, 0.0° | held, 1793, 0.00, +19 %, -2 %, 0.0° |
| cylinder-P4mmm-on | 4/mmm | none | held, 1818, 0.02, +0 %, -0 %, 0.0° | held, 2371, 0.03, +0 %, -0 %, 0.0° | held, 1818, 0.02, +0 %, -0 %, 0.0° | held, 2386, 0.00, +0 %, -0 %, 0.0° |
| cylinder-P6m-on | 6/m | none | held, 1226, 0.00, +1 %, +1 %, 0.0° | held, 1322, 0.00, +1 %, +1 %, 0.0° | held, 1226, 0.00, +1 %, +1 %, 0.0° | held, 1320, 0.00, +1 %, +1 %, 0.0° |
| cylinder-Pm-3m-on | m-3m | sizedist | held, 1825, 1502.11, +15 %, +3 %, 0.0° | held, 2055, 1545.99, +19 %, +5 %, 0.0° | held, 1823, 1502.11, +15 %, +3 %, 0.0° | held, 1863, 1545.96, +19 %, +5 %, 0.0° |
| ellcyl-P2m-generic | 2/m | none | free, 2222, 0.02, +4 %, +0 %, 2.6° | free, 2320, 0.00, +4 %, +0 %, 2.6° | free, 1913, 0.02, +4 %, +0 %, 2.6° | free, 2127, 0.00, +4 %, +0 %, 2.6° |
| ellcyl-P4mmm-generic | 4/mmm | hump | free, 1680, 0.00, +7 %, +3 %, 0.5° | free, 1655, 0.01, +7 %, +3 %, 0.5° | free, 1681, 0.00, +7 %, +3 %, 0.5° | free, 1655, 0.01, +7 %, +3 %, 0.5° |
| ellcyl-P6m-generic | 6/m | none | free, 1833, 0.03, +7 %, +1 %, 7.2° | free, 1538, 0.00, +8 %, +1 %, 7.2° | free, 1753, 0.03, +7 %, +1 %, 7.2° | free, 1598, 0.00, +8 %, +1 %, 7.2° |
| ellcyl-Pm-3m-generic | m-3m | none | free, 1430, 0.00, +30 %, +0 %, 7.4° | free, 1550, 0.01, +31 %, +0 %, 7.4° | free, 1496, 0.00, +30 %, +0 %, 7.4° | free, 1600, 0.01, +31 %, +0 %, 7.4° |
| ellipsoid-Pmmm-generic | mmm | none | free, 1650, 0.00, +4 %, -0 %, 0.9° | free, 1663, 0.00, +4 %, -0 %, 0.9° | free, 1663, 0.00, +4 %, -0 %, 0.9° | free, 1658, 0.00, +4 %, -0 %, 0.9° |
| ellipsoid-P-3-generic | -3 | impurity | free, 2652, 0.00, +117 %, +3 %, 14.6° | free, 2288, 0.00, +117 %, +3 %, 14.6° | free, 2808, 0.00, +117 %, +3 %, 14.6° | free, 2292, 0.00, +117 %, +3 %, 14.6° |
| ellipsoid-P6mmm-generic | 6/mmm | air | free, 1066, 0.00, +5 %, +5 %, 2.5° | free, 1167, 0.01, +5 %, +5 %, 2.5° | free, 1187, 0.00, +5 %, +5 %, 2.5° | free, 1143, 0.01, +5 %, +5 %, 2.5° |
| spheroid-Pmmm-near | mmm | air | held, 1241, 0.00, +0 %, +0 %, 6.1° | held, 1212, 0.00, +0 %, +0 %, 6.1° | held, 1239, 0.00, +0 %, +0 %, 6.1° | held, 1210, 0.00, +0 %, +0 %, 6.1° |
| spheroid-P-3-near | -3 | none | held, 1172, 0.00, +6 %, -6 %, 13.2° | held, 1158, 0.00, +6 %, -6 %, 13.2° | held, 1166, 0.00, +6 %, -6 %, 13.2° | held, 1167, 0.00, +6 %, -6 %, 13.2° |
| spheroid-P6mmm-near | 6/mmm | hump | free, 1149, 0.00, +7 %, -7 %, 1.3° | free, 1121, 0.00, +7 %, -7 %, 1.3° | free, 1089, 0.00, +7 %, -7 %, 1.3° | free, 1121, 0.00, +7 %, -7 %, 1.3° |

