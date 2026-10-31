## lsq: the 77 screening runs

Reference: today. Reach against the best known exact χ² of each run over every record on this line (A/results/screen-lsq, A/results/s-lsq, A/results/sph-lsq, A/results/tr-lsq, A/results/xs-lsq, ../proto-h/results/t2, ../proto-h/results/t4, ../proto-h3/results/why, ../proto-h3/results/why-today, ../proto-h3/results/fwdb, ../proto-h3/results/polc, step1/h/results/id-lsq, step1/h/results/chk-v2b, step1/h/results/v2a-lsq, step1/h/results/v2b-lsq).

| variant | runs | held / free / rejected (early) | outcome ≠ today | reached / judged | unbounded | worst (90 %) | thinnest | axis ° (90 %) | spheres kept | search evaluations | × today (per run median) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| today | 77 | 22 / 43 / 1 (0) | 0 | 64 / 66 | 2 | +16 % (+232 %) | +1 % | 4.3 (31.8) | 2 / 11 | 273482 | 1.000 (1.000) |
| all | 77 | 20 / 44 / 2 (1) | 2 | 61 / 65 | 3 | +15 % (+246 %) | +1 % | 4.5 (29.4) | 2 / 11 | 130254 | 0.476 (0.486) |
| briefs | 77 | 21 / 43 / 2 (1) | 1 | 64 / 65 | 2 | +13 % (+187 %) | +1 % | 4.1 (29.4) | 2 / 11 | 168157 | 0.615 (0.581) |

Anisotropy (longest/thinnest read ÷ true) on the 32 clean truths every variant kept: median, median |ln|, rows outside 0.9–1.1:

- today: 0.95, 0.11, 18
- all: 0.95, 0.09, 15
- briefs: 0.95, 0.09, 15

**all against today.** Outcome changed on 2: cylinder-Pm-3m-on held → free; ellipsoid-Pm-3-on held → early. Reach lost on 3: box-P6mmm-on (Δ 0.95 → 1.3); cylinder-Pm-3m-on (Δ 0.00 → 1695.7); ellcyl-P-3-on (Δ 0.00 → 2.7); gained on 1: ellcyl-P6mmm-on (Δ 828.2 → 0.00). Returned χ² (both kept), in χ²_ν: within 0.1 on 60, lower on 3 (sqbox-P6m-near -0.47, ellcyl-P6mmm-on -764.73, sphere-P6mmm-1 -0.32), higher on 3 (sqbox-Pm-3-on +0.33, cylinder-Pm-3m-on +1693.15, ellcyl-P-3-on +2.67). Solid changed on 5: box-P6m-generic (extents +0 %, -20 %, +9 %; 0.1°); cylinder-Pm-3m-on (extents +∞, +∞, -12 %; 16.9°); ellcyl-P-3-on (extents -0 %, +4 %, -4 %; 16.4°); ellcyl-P6mmm-on (extents -72 %, -65 %, +772 %; 86.4°); sphere-P6mmm-1 (extents -0 %, -1 %, +0 %; 2.4°).

**briefs against today.** Outcome changed on 1: ellipsoid-Pm-3-on held → early. Reach lost on 1: ellcyl-P-3-on (Δ 0.00 → 2.7); gained on 2: ellcyl-P6mmm-on (Δ 828.2 → 0.00); ellipsoid-P2m-near (Δ 1.2 → 0.00). Returned χ² (both kept), in χ²_ν: within 0.1 on 60, lower on 4 (box-P-3-on -0.42, sqbox-P6m-near -0.47, ellcyl-P6mmm-on -764.73, sphere-P6mmm-1 -0.29), higher on 2 (sqbox-Pm-3-on +0.33, ellcyl-P-3-on +2.66). Solid changed on 5: box-P-3-on (extents -0 %, +0 %, -0 %; 8.9°); box-P6m-generic (extents +0 %, -24 %, +11 %; 0.1°); ellcyl-P-3-on (extents -0 %, +4 %, -4 %; 16.4°); ellcyl-P6mmm-on (extents -72 %, -65 %, +772 %; 86.4°); sphere-P6mmm-1 (extents -0 %, -1 %, +0 %; 2.4°).

**Cost** (sums over the runs; CPU of iso + search + report, and walls, s):

| variant | search ev | report ev | iso ev | CPU | wall: search | report | iso | ms an evaluation (search wall, median) |
|---|---|---|---|---|---|---|---|---|
| today | 273482 | 101819 | 37003 | — | 5001 | 1623 | 992 | 14.13 |
| all | 130254 | 99330 | 37003 | 2636 | 1285 | 769 | 444 | 7.29 |
| briefs | 168157 | 99628 | 37003 | 2938 | 1564 | 772 | 452 | 7.01 |

Search evaluations per Laue class, × today:

| class | all | briefs |
|---|---|---|
| -1 | 0.50 | 0.61 |
| 2/m | 0.49 | 0.60 |
| mmm | 0.51 | 0.61 |
| 4/m | 0.52 | 0.70 |
| 4/mmm | 0.54 | 0.68 |
| -3 | 0.49 | 0.61 |
| -3m | 0.45 | 0.55 |
| 6/m | 0.44 | 0.55 |
| 6/mmm | 0.46 | 0.62 |
| m-3 | 0.36 | 0.46 |
| m-3m | 0.46 | 0.73 |

| run | class | error | today: outcome, ev, Δ, worst, thinnest, axis | all: outcome, ev, Δ, worst, thinnest, axis | briefs: outcome, ev, Δ, worst, thinnest, axis |
|---|---|---|---|---|---|
| box-P-1-near | -1 | none | free, 4056, 0.00, +7 %, +0 %, 2.6° | free, 1967, 0.00, +7 %, +0 %, 2.6° | free, 2282, 0.00, +7 %, +0 %, 2.6° |
| box-P2m-generic | 2/m | air | free, 3337, 0.00, +13 %, -1 %, 1.7° | free, 1596, 0.00, +13 %, -1 %, 1.7° | free, 1817, 0.00, +13 %, -1 %, 1.7° |
| box-Pmmm-on | mmm | po | free, 4819, 0.09, +10585 %, +2 %, 5.0° | free, 2476, 0.00, +10614 %, +2 %, 5.0° | free, 3389, 0.00, +10615 %, +2 %, 5.0° |
| box-P4m-near | 4/m | none | free, 4835, 0.00, +24 %, +4 %, 2.6° | free, 2542, 0.00, +24 %, +4 %, 2.6° | free, 3631, 0.00, +24 %, +4 %, 2.6° |
| box-P4mmm-generic | 4/mmm | none | free, 4557, 0.00, +21 %, +2 %, 0.8° | free, 2275, 0.00, +21 %, +2 %, 0.8° | free, 3252, 0.00, +21 %, +2 %, 0.8° |
| box-P-3-on | -3 | sizedist | free, 4746, 0.42, +21 %, -2 %, 1.8° | free, 2305, 0.42, +21 %, -2 %, 1.8° | free, 2909, 0.00, +21 %, -2 %, 1.7° |
| box-P-3m1-near | -3m | none | free, 4242, 0.00, +44 %, +44 %, 10.3° | free, 1810, 0.00, +43 %, +43 %, 16.2° | free, 2352, 0.00, +43 %, +43 %, 16.2° |
| box-P6m-generic | 6/m | none | free, 3602, 0.07, +33 %, +8 %, 17.7° | free, 1655, 0.00, +13 %, +8 %, 17.8° | free, 2451, 0.02, +12 %, +8 %, 17.8° |
| box-P6mmm-on | 6/mmm | impurity | held, 5163, 0.95, +11 %, -11 %, 0.0° | held, 2189, 1.30, +11 %, -11 %, 0.0° | held, 3042, 0.00, +11 %, -11 %, 0.0° |
| box-Pm-3-near | m-3 | impurity | free, 4107, 0.00, +13 %, +8 %, 1.0° | free, 1859, 0.00, +13 %, +8 %, 1.0° | free, 2709, 0.00, +13 %, +8 %, 1.0° |
| box-Pm-3m-generic | m-3m | hump | free, 5269, 0.00, +44 %, +20 %, 13.6° | free, 2690, 0.01, +44 %, +20 %, 13.6° | free, 4161, 0.01, +44 %, +20 %, 13.6° |
| sqbox-P-1-on | -1 | sizedist | held, 5091, 0.00, +3 %, -0 %, 0.0° | held, 2578, 0.00, +3 %, -0 %, 0.0° | held, 3448, 0.00, +3 %, -0 %, 0.0° |
| sqbox-P2m-near | 2/m | none | free, 3662, 0.00, +9 %, -4 %, 3.2° | free, 1824, 0.00, +9 %, -4 %, 3.2° | free, 2249, 0.00, +9 %, -4 %, 3.2° |
| sqbox-Pmmm-generic | mmm | none | free, 3211, 0.00, +7 %, -0 %, 43.7° | free, 1569, 0.00, +7 %, -0 %, 43.7° | free, 1928, 0.00, +7 %, -0 %, 43.7° |
| sqbox-P4m-on | 4/m | air | held, 3606, 0.00, +13 %, -13 %, 0.0° | held, 1644, 0.00, +13 %, -13 %, 0.0° | held, 1967, 0.00, +13 %, -13 %, 0.0° |
| sqbox-P4mmm-near | 4/mmm | none | free, 3398, 0.00, +3 %, -2 %, 1.8° | free, 1822, 0.00, +3 %, -2 %, 1.8° | free, 2234, 0.05, +3 %, -2 %, 1.8° |
| sqbox-P-3-generic | -3 | hump | free, 3088, 0.00, +66 %, +10 %, 8.8° | free, 1549, 0.00, +66 %, +10 %, 8.8° | free, 1907, 0.00, +66 %, +10 %, 8.8° |
| sqbox-P-3m1-on | -3m | po | held, 3196, 0.02, +29 %, -29 %, 30.0° | held, 1390, 0.07, +29 %, -29 %, 30.0° | held, 1640, 0.00, +29 %, -29 %, 30.0° |
| sqbox-P6m-near | 6/m | none | free, 4062, 0.47, +27 %, +27 %, 46.8° | free, 1889, 0.00, +27 %, +27 %, 46.4° | free, 2692, 0.00, +27 %, +27 %, 46.4° |
| sqbox-P6mmm-generic | 6/mmm | impurity | free, 3624, 0.00, +34 %, -4 %, 4.7° | free, 1640, 0.00, +34 %, -4 %, 4.7° | free, 2126, 0.00, +34 %, -4 %, 4.7° |
| sqbox-Pm-3-on | m-3 | none | free, 3209, 0.00, +17 %, +16 %, 4.2° | free, 1140, 0.33, +17 %, +17 %, 3.8° | free, 1416, 0.33, +17 %, +17 %, 3.8° |
| sqbox-Pm-3m-near | m-3m | none | free, 2964, 0.00, +18 %, +18 %, 3.3° | free, 1112, 0.00, +18 %, +18 %, 3.3° | free, 1406, 0.00, +18 %, +18 %, 3.3° |
| cylinder-P-1-generic | -1 | none | free, 3473, 0.00, +3 %, -1 %, 0.1° | free, 1695, 0.00, +3 %, -1 %, 0.1° | free, 1930, 0.00, +3 %, -1 %, 0.1° |
| cylinder-P2m-on | 2/m | impurity | held, 3728, 0.00, +21 %, -3 %, 0.0° | held, 1871, 0.00, +21 %, -3 %, 0.0° | held, 2435, 0.00, +21 %, -3 %, 0.0° |
| cylinder-Pmmm-near | mmm | none | free, 2518, 0.00, +5 %, +5 %, 0.9° | free, 1237, 0.00, +5 %, +5 %, 0.9° | free, 1369, 0.00, +5 %, +5 %, 0.9° |
| cylinder-P4m-generic | 4/m | none | free, 5388, 0.00, +8 %, +8 %, 4.0° | free, 2826, 0.00, +8 %, +8 %, 4.0° | free, 4323, 0.00, +8 %, +8 %, 4.0° |
| cylinder-P4mmm-on | 4/mmm | none | held, 3059, 0.00, +1 %, +1 %, 0.0° | held, 1591, 0.00, +1 %, +1 %, 0.0° | held, 1859, 0.00, +1 %, +1 %, 0.0° |
| cylinder-P-3-near | -3 | none | free, 2717, 0.01, +17 %, +4 %, 9.7° | free, 1420, 0.00, +17 %, +4 %, 9.7° | free, 1674, 0.00, +17 %, +4 %, 9.7° |
| cylinder-P-3m1-generic | -3m | po | held, 3312, 0.00, +33 %, -33 %, 28.1° | held, 1418, 0.00, +33 %, -33 %, 28.1° | held, 1913, 0.00, +33 %, -33 %, 28.1° |
| cylinder-P6m-on | 6/m | none | held, 2422, 0.00, +5 %, -1 %, 0.0° | held, 1065, 0.00, +5 %, -1 %, 0.0° | held, 1185, 0.00, +5 %, -1 %, 0.0° |
| cylinder-P6mmm-near | 6/mmm | air | free, 3221, 0.00, +8 %, -2 %, 6.7° | free, 1565, 0.00, +8 %, -2 %, 6.7° | free, 1977, 0.00, +8 %, -2 %, 6.7° |
| cylinder-Pm-3-generic | m-3 | hump | free, 2619, 0.00, +31 %, -31 %, 6.3° | free, 994, 0.00, +31 %, -31 %, 6.3° | free, 1183, 0.00, +31 %, -31 %, 6.3° |
| cylinder-Pm-3m-on | m-3m | sizedist | held, 3797, 0.00, +3 %, -3 %, 0.0° | free, 2340, 1695.66, +∞, -15 %, 16.9° | held, 4477, 0.92, +3 %, -3 %, 0.0° |
| ellcyl-P-1-near | -1 | po | free, 6360, 0.00, +∞, +450 %, 84.5° | free, 3281, 0.00, +∞, +450 %, 84.5° | free, 4616, 0.00, +∞, +450 %, 84.5° |
| ellcyl-P2m-generic | 2/m | none | free, 3242, 0.00, +16 %, +1 %, 2.8° | free, 1565, 0.00, +16 %, +1 %, 2.8° | free, 1747, 0.00, +16 %, +1 %, 2.8° |
| ellcyl-Pmmm-on | mmm | air | free, 3437, 0.00, +3 %, +1 %, 6.7° | free, 1688, 0.00, +3 %, +1 %, 6.7° | free, 1937, 0.00, +3 %, +1 %, 6.7° |
| ellcyl-P4m-near | 4/m | sizedist | free, 3342, 0.00, +2 %, +2 %, 1.0° | free, 1703, 0.00, +2 %, +2 %, 1.0° | free, 2062, 0.00, +2 %, +2 %, 1.0° |
| ellcyl-P4mmm-generic | 4/mmm | hump | free, 3165, 0.00, +266 %, +266 %, 11.2° | free, 1646, 0.00, +266 %, +266 %, 11.2° | free, 2038, 0.00, +266 %, +266 %, 11.2° |
| ellcyl-P-3-on | -3 | impurity | free, 6308, 0.00, +29 %, +17 %, 25.1° | free, 2827, 2.67, +32 %, +21 %, 8.7° | free, 4005, 2.66, +32 %, +21 %, 8.7° |
| ellcyl-P-3m1-near | -3m | sizedist | free, 4114, 0.05, +∞, -4 %, 18.6° | free, 1998, 0.00, +∞, -4 %, 18.4° | free, 2690, 0.00, +∞, -4 %, 18.4° |
| ellcyl-P6m-generic | 6/m | none | free, 3832, 0.00, +307 %, +307 %, 25.3° | free, 1562, 0.00, +307 %, +307 %, 25.3° | free, 1997, 0.00, +307 %, +307 %, 25.3° |
| ellcyl-P6mmm-on | 6/mmm | none | free, 6639, 828.19, +253 %, +186 %, 86.7° | free, 3034, 0.00, +5 %, +1 %, 0.5° | free, 4673, 0.00, +5 %, +1 %, 0.5° |
| ellcyl-Pm-3-near | m-3 | none | free, 3853, 0.00, +10 %, +0 %, 3.6° | free, 1631, 0.01, +10 %, +0 %, 3.7° | free, 2240, 0.01, +10 %, +0 %, 3.7° |
| ellcyl-Pm-3m-generic | m-3m | none | held, 3825, 0.00, +199 %, +57 %, 8.4° | held, 1442, 0.00, +199 %, +57 %, 8.4° | held, 1994, 0.00, +199 %, +57 %, 8.4° |
| ellipsoid-P-1-on | -1 | none | held, 3926, 0.00, +2 %, +0 %, 0.0° | held, 1987, 0.00, +2 %, +0 %, 0.0° | held, 2230, 0.00, +2 %, +0 %, 0.0° |
| ellipsoid-P2m-near | 2/m | none | held, 4309, 1.24, +3 %, -0 %, 4.3° | held, 2367, 1.86, +3 %, -0 %, 4.3° | held, 3013, 0.00, +3 %, -0 %, 4.3° |
| ellipsoid-Pmmm-generic | mmm | none | free, 2942, 0.00, +7 %, -1 %, 0.9° | free, 1474, 0.00, +7 %, -1 %, 0.9° | free, 1558, 0.00, +7 %, -1 %, 0.9° |
| ellipsoid-P4m-on | 4/m | hump | held, 5870, 0.00, +2 %, +1 %, 0.0° | held, 3281, 0.00, +2 %, +1 %, 0.0° | held, 4797, 0.00, +2 %, +1 %, 0.0° |
| ellipsoid-P4mmm-near | 4/mmm | sizedist | free, 3509, 0.00, +46 %, -6 %, 2.6° | free, 2184, 0.00, +46 %, -6 %, 2.6° | free, 2960, 0.00, +46 %, -6 %, 2.6° |
| ellipsoid-P-3-generic | -3 | impurity | free, 3368, 0.00, +128 %, +8 %, 23.2° | free, 1757, 0.00, +128 %, +8 %, 23.2° | free, 2110, 0.00, +128 %, +8 %, 23.2° |
| ellipsoid-P-3m1-on | -3m | none | held, 3161, 0.00, +25 %, -3 %, 16.2° | held, 1564, 0.00, +25 %, -3 %, 16.2° | held, 1892, 0.00, +25 %, -3 %, 16.2° |
| ellipsoid-P6m-near | 6/m | none | held, 3262, 0.00, +14 %, +6 %, 6.8° | held, 1425, 0.00, +14 %, +6 %, 6.8° | held, 1662, 0.00, +14 %, +6 %, 6.8° |
| ellipsoid-P6mmm-generic | 6/mmm | air | held, 2843, 0.11, +29 %, +29 %, 19.0° | held, 1287, 0.21, +29 %, +29 %, 19.0° | held, 1404, 0.21, +29 %, +29 %, 19.0° |
| ellipsoid-Pm-3-on | m-3 | po | held, 2409, 0.01, +20 %, +2 %, 0.0° | early, 228, —, — | early, 228, —, — |
| ellipsoid-Pm-3m-near | m-3m | none | rejected, 2760, 0.00, — | rejected, 1020, 0.01, — | rejected, 1333, 0.01, — |
| spheroid-P-1-generic | -1 | po | free, 3511, 0.00, +291 %, +291 %, 87.3° | free, 1726, 0.00, +291 %, +291 %, 87.3° | free, 2028, 0.00, +291 %, +291 %, 87.3° |
| spheroid-P2m-on | 2/m | impurity | held, 5638, 0.17, +12 %, -8 %, 0.0° | held, 2493, 0.00, +12 %, -8 %, 0.0° | held, 3376, 0.00, +12 %, -8 %, 0.0° |
| spheroid-Pmmm-near | mmm | air | held, 4001, 0.00, +1 %, +1 %, 6.1° | held, 2161, 0.00, +1 %, +1 %, 6.1° | held, 2783, 0.00, +1 %, +1 %, 6.1° |
| spheroid-P4m-generic | 4/m | none | free, 2533, 0.00, +16 %, +16 %, 28.4° | free, 1347, 0.00, +16 %, +16 %, 27.4° | free, 1509, 0.00, +16 %, +16 %, 27.4° |
| spheroid-P4mmm-on | 4/mmm | hump | held, 3667, 0.00, +8 %, -3 %, 0.0° | held, 2038, 0.00, +8 %, -3 %, 0.0° | held, 2588, 0.00, +8 %, -3 %, 0.0° |
| spheroid-P-3-near | -3 | none | held, 2543, 0.00, +6 %, +6 %, 33.0° | held, 1342, 0.00, +6 %, +6 %, 33.0° | held, 1464, 0.00, +6 %, +6 %, 33.0° |
| spheroid-P-3m1-generic | -3m | none | free, 2412, 0.00, +6 %, -0 %, 0.9° | free, 1022, 0.00, +6 %, -0 %, 0.9° | free, 1163, 0.00, +6 %, -0 %, 0.9° |
| spheroid-P6m-on | 6/m | sizedist | free, 2238, 0.00, +159 %, +159 %, 19.2° | free, 923, 0.00, +159 %, +159 %, 19.2° | free, 1032, 0.00, +159 %, +159 %, 19.2° |
| spheroid-P6mmm-near | 6/mmm | hump | free, 2438, 0.00, +153 %, +153 %, 76.6° | free, 1101, 0.00, +153 %, +153 %, 76.6° | free, 1210, 0.00, +153 %, +153 %, 76.6° |
| spheroid-Pm-3-generic | m-3 | none | free, 1929, 0.00, +10 %, +10 %, 7.1° | free, 649, 0.00, +10 %, +10 %, 7.1° | free, 762, 0.00, +10 %, +10 %, 7.1° |
| spheroid-Pm-3m-on | m-3m | none | held, 4101, 0.09, +8 %, +4 %, 0.0° | held, 2186, 0.00, +8 %, +4 %, 0.0° | held, 3842, 0.01, +8 %, +4 %, 0.0° |
| sphere-P-1-2 | -1 | none | rejected, 3487, —, — | rejected, 1581, —, — | rejected, 1701, —, — |
| sphere-P2m-3 | 2/m | none | early, 2682, —, — | early, 1262, —, — | early, 1262, —, — |
| sphere-Pmmm-1 | mmm | none | early, 2171, —, — | early, 1060, —, — | early, 1060, —, — |
| sphere-P4m-2 | 4/m | none | early, 2456, —, — | early, 1235, —, — | early, 1235, —, — |
| sphere-P4mmm-3 | 4/mmm | air | early, 2011, —, — | early, 1028, —, — | early, 1028, —, — |
| sphere-P-3-1 | -3 | none | early, 2429, —, — | early, 1210, —, — | early, 1210, —, — |
| sphere-P-3m1-2 | -3m | none | early, 2284, —, — | early, 960, —, — | early, 960, —, — |
| sphere-P6m-3 | 6/m | impurity | early, 2280, —, — | early, 950, —, — | early, 950, —, — |
| sphere-P6mmm-1 | 6/mmm | po | free, 4397, —, — | free, 2261, —, — | free, 3164, —, — |
| sphere-Pm-3-2 | m-3 | hump | early, 1835, —, — | early, 598, —, — | early, 598, —, — |
| sphere-Pm-3m-3 | m-3m | sizedist | free, 1865, —, — | free, 627, —, — | free, 713, —, — |

