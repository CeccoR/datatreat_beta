## Cost (11 runs: cost-rescored)

Per run: members in range (generator) and in the model's list; isotropic fit; today's search and report; the truth reference. Wall times in s, one process each, nice 15.

| run | class | grid | members (list) | iso ev | iso s | search ev | ms/ev | search s | report ev | report s | iso+search+report s | truth ref s | wall s | outcome |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| box-P-1-near | -1 | 10–130/0.01 | 187 (553) | 2114 | 423.9 | 5074 | 141.6 | 718.3 | 1404 | 188.7 | 1330.9 | 132.6 | 1465.2 | free |
| cylinder-P-3-near | -3 | 10–130/0.01 | 171 (249) | 391 | 8.1 | 2814 | 31.7 | 89.3 | 1072 | 32.2 | 129.5 | 20.0 | 150.7 | free |
| ellipsoid-P-3m1-on | -3m | 10–130/0.01 | 180 (256) | 259 | 5.3 | 4834 | 33.5 | 162.0 | 2417 | 68.5 | 235.8 | 25.6 | 262.5 | held |
| sqbox-P2m-near | 2/m | 10–130/0.01 | 182 (376) | 498 | 49.4 | 8474 | 84.6 | 717.0 | 1326 | 122.1 | 888.5 | 183.1 | 1073.1 | held |
| spheroid-P4m-generic | 4/m | 10–130/0.01 | 177 (259) | 305 | 7.0 | 3337 | 35.6 | 118.7 | 1585 | 60.6 | 186.3 | 64.0 | 251.5 | held |
| box-P4mmm-generic | 4/mmm | 10–130/0.01 | 170 (260) | 279 | 5.8 | 6575 | 42.3 | 278.1 | 997 | 44.8 | 328.8 | 65.8 | 395.8 | free |
| ellcyl-P6m-generic | 6/m | 10–130/0.01 | 184 (250) | 354 | 5.4 | 6362 | 26.0 | 165.7 | 3282 | 77.9 | 249.0 | 25.2 | 275.2 | held |
| ellcyl-P6mmm-on | 6/mmm | 10–130/0.01 | 170 (246) | 405 | 8.5 | 6561 | 33.3 | 218.4 | 1820 | 49.9 | 276.9 | 15.1 | 293.0 | free |
| sqbox-Pm-3-on | m-3 | 10–130/0.01 | 182 (242) | 300 | 2.6 | 2931 | 29.6 | 86.7 | 718 | 18.3 | 107.5 | 14.8 | 123.3 | held |
| ellipsoid-Pm-3m-near | m-3m | 10–130/0.01 | 182 (242) | 264 | 2.6 | 2153 | 22.2 | 47.7 | 0 | 0.0 | 50.3 | 14.3 | 65.7 | early |
| cylinder-Pmmm-near | mmm | 10–130/0.01 | 180 (253) | 368 | 15.9 | 5724 | 50.0 | 286.1 | 951 | 44.1 | 346.1 | 24.8 | 372.1 | held |

Per Laue class (means over its runs): members in range (in the model's list), ms per evaluation of the search, evaluations, wall time (s).

| class | runs | members (list) | refl. (list) | ms/ev search | iso ev | search ev | report ev | iso s | search s | report s | iso+search+report s | truth ref s |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| -1 | 1 | 187 (553) | 187 (553) | 141.6 | 2114 | 5074 | 1404 | 423.9 | 718.3 | 188.7 | 1330.9 | 132.6 |
| 2/m | 1 | 182 (376) | 111 (219) | 84.6 | 498 | 8474 | 1326 | 49.4 | 717.0 | 122.1 | 888.5 | 183.1 |
| mmm | 1 | 180 (253) | 70 (96) | 50.0 | 368 | 5724 | 951 | 15.9 | 286.1 | 44.1 | 346.1 | 24.8 |
| 4/m | 1 | 177 (259) | 54 (77) | 35.6 | 305 | 3337 | 1585 | 7.0 | 118.7 | 60.6 | 186.3 | 64.0 |
| 4/mmm | 1 | 170 (260) | 41 (57) | 42.3 | 279 | 6575 | 997 | 5.8 | 278.1 | 44.8 | 328.8 | 65.8 |
| -3 | 1 | 171 (249) | 61 (87) | 31.7 | 391 | 2814 | 1072 | 8.1 | 89.3 | 32.2 | 129.5 | 20.0 |
| -3m | 1 | 180 (256) | 50 (68) | 33.5 | 259 | 4834 | 2417 | 5.3 | 162.0 | 68.5 | 235.8 | 25.6 |
| 6/m | 1 | 184 (250) | 39 (52) | 26.0 | 354 | 6362 | 3282 | 5.4 | 165.7 | 77.9 | 249.0 | 25.2 |
| 6/mmm | 1 | 170 (246) | 32 (43) | 33.3 | 405 | 6561 | 1820 | 8.5 | 218.4 | 49.9 | 276.9 | 15.1 |
| m-3 | 1 | 182 (242) | 25 (31) | 29.6 | 300 | 2931 | 718 | 2.6 | 86.7 | 18.3 | 107.5 | 14.8 |
| m-3m | 1 | 182 (242) | 20 (24) | 22.2 | 264 | 2153 | 0 | 2.6 | 47.7 | 0.0 | 50.3 | 14.3 |

Mean iso+search+report: 375.4 s (median 249.0, max 1330.9); mean whole run with the truth reference and drawing: 429.8 s; ms per evaluation of the search: median 33.5, 22.2–141.6.

## Line-shape bias (11 truths)

Signed errors of the extents, the truth's thinnest, middle and longest (median, and the 10th–90th percentiles); the truth's most distinct axis (°, median and 90th percentile). "ref": the truth reference (refined from the truth, no search); "today": today's reported solid (kept runs). χ²_ν: the truth reference's.

| solid | kernel | runs | ref thinnest | ref middle | ref longest | ref unbounded | ref axis ° | ref χ²_ν | today kept | today thinnest | today longest | today axis ° |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| box | exact | 2 | +21 % (+12 %…+29 %) | +0 % (-14 %…+15 %) | -26 % (-49 %…-3 %) | 0 | 9.0 (13.3) | 2.53 | 2 | +22 % (+12 %…+32 %) | -25 % (-48 %…-3 %) | 7.4 (10.5) |
| sqbox | exact | 2 | +16 % (+1 %…+30 %) | +16 % (+1 %…+30 %) | -5 % (-6 %…-5 %) | 0 | 2.6 (4.6) | 2.97 | 2 | +13 % (-3 %…+29 %) | -10 % (-14 %…-6 %) | 2.6 (4.7) |
| cylinder | exact | 2 | +26 % (+20 %…+32 %) | +11 % (+9 %…+12 %) | +11 % (+9 %…+12 %) | 0 | 7.3 (12.2) | 1.07 | 2 | +25 % (+20 %…+31 %) | +10 % (+10 %…+11 %) | 8.3 (13.8) |
| ellcyl | exact | 2 | +37 % (+21 %…+54 %) | +24 % (-3 %…+51 %) | -14 % (-26 %…-1 %) | 0 | 6.4 (11.5) | 4.76 | 2 | +380 % (+295 %…+465 %) | -62 % (-82 %…-43 %) | 56.0 (81.9) |
| ellipsoid | exact | 2 | +50 % (+19 %…+80 %) | +1 % (-22 %…+24 %) | -36 % (-52 %…-20 %) | 0 | 0.0 (0.0) | 1.05 | 1 | +11 % (+11 %…+11 %) | -17 % (-17 %…-17 %) | 0.0 (0.0) |
| spheroid | exact | 1 | +47 % (+47 %…+47 %) | +2 % (+2 %…+2 %) | +2 % (+2 %…+2 %) | 0 | 43.4 (43.4) | 1.17 | 1 | +46 % (+46 %…+46 %) | +1 % (+1 %…+1 %) | 44.1 (44.1) |

By the model error (truth reference, all solids):

| error | runs | ref thinnest | ref middle | ref longest | ref axis ° | ref χ²_ν |
|---|---|---|---|---|---|---|
| none | 11 | +32 % (+10 %…+58 %) | +9 % (-18 %…+33 %) | -5 % (-55 %…+9 %) | 3.5 (14.4) | 1.17 |

By Laue class (truth reference, clean truths):

| class | runs | ref thinnest | ref longest | longest/thinnest read ÷ true | ref axis ° |
|---|---|---|---|---|---|
| -1 | 1 | +10 % | +2 % | 0.93 (0.93…0.93) | 3.5 (3.5) |
| 2/m | 1 | -2 % | -6 % | 0.96 (0.96…0.96) | 5.1 (5.1) |
| mmm | 1 | +18 % | +13 % | 0.95 (0.95…0.95) | 1.1 (1.1) |
| 4/m | 1 | +47 % | +2 % | 0.69 (0.69…0.69) | 43.4 (43.4) |
| 4/mmm | 1 | +32 % | -55 % | 0.34 (0.34…0.34) | 14.4 (14.4) |
| -3 | 1 | +34 % | +9 % | 0.81 (0.81…0.81) | 13.4 (13.4) |
| -3m | 1 | +11 % | -16 % | 0.75 (0.75…0.75) | 0.0 (0.0) |
| 6/m | 1 | +58 % | -29 % | 0.45 (0.45…0.45) | 12.8 (12.8) |
| 6/mmm | 1 | +17 % | +2 % | 0.87 (0.87…0.87) | 0.0 (0.0) |
| m-3 | 1 | +33 % | -5 % | 0.72 (0.72…0.72) | 0.0 (0.0) |
| m-3m | 1 | +88 % | -56 % | 0.23 (0.23…0.23) | 0.0 (0.0) |

| run | kernel | dims nm | ref dims nm | ref thinnest | middle | longest | ref axis ° | ref orient ° | ref χ²_ν | today | today thinnest | middle | longest | today axis ° |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| box-P-1-near | exact | 6.7×13.7×60.0 | 7.4×16.2×61.4 | +10 % | +18 % | +2 % | 3.5 | 3.8 | 1.28 | free | +10 % | +18 % | +2 % | 3.5 |
| box-P4mmm-generic | exact | 2.9×8.8×17.2 | 3.8×7.2×7.7 | +32 % | -18 % | -55 % | 14.4 | 28.5 | 3.77 | free | +34 % | -22 % | -53 % | 11.3 |
| cylinder-P-3-near | exact | 46.6×46.6×14.8 | 50.6×50.6×19.7 | +34 % | +9 % | +9 % | 13.4 | 13.4 | 1.08 | free | +33 % | +9 % | +9 % | 15.1 |
| cylinder-Pmmm-near | exact | 34.2×34.2×9.7 | 38.6×38.6×11.5 | +18 % | +13 % | +13 % | 1.1 | 1.1 | 1.06 | held | +18 % | +11 % | +11 % | 1.5 |
| ellcyl-P6m-generic | exact | 44.8×58.5×9.8 | 40.5×41.7×15.5 | +58 % | -10 % | -29 % | 12.8 | 23.5 | 1.12 | held | +273 % | -60 % | -38 % | 23.7 |
| ellcyl-P6mmm-on | exact | 4.3×11.7×34.2 | 5.0×18.5×34.8 | +17 % | +58 % | +2 % | 0.0 | 0.0 | 8.39 | free | +486 % | +145 % | -87 % | 88.4 |
| ellipsoid-P-3m1-on | exact | 12.2×25.5×39.5 | 13.5×33.0×33.0 | +11 % | +29 % | -16 % | 0.0 | 0.0 | 1.07 | held | +11 % | +29 % | -17 % | 0.0 |
| ellipsoid-Pm-3m-near | exact | 14.0×36.6×60.0 | 26.4×26.5×26.5 | +88 % | -28 % | -56 % | 0.0 | 0.0 | 1.02 | early | — | — | — | — |
| spheroid-P4m-generic | exact | 22.9×22.9×14.2 | 23.3×23.3×20.8 | +47 % | +2 % | +2 % | 43.4 | 43.4 | 1.17 | held | +46 % | +1 % | +1 % | 44.1 |
| sqbox-P2m-near | exact | 5.1×5.1×9.1 | 5.0×5.0×8.5 | -2 % | -2 % | -6 % | 5.1 | 5.7 | 4.36 | held | -7 % | -7 % | -15 % | 5.2 |
| sqbox-Pm-3-on | exact | 10.9×10.9×15.2 | 14.5×14.5×14.5 | +33 % | +33 % | -5 % | 0.0 | 0.0 | 1.57 | held | +33 % | +33 % | -5 % | 0.0 |

## Today's search (11 runs)

| set | runs | held | free | rejected (early) | reached / judged | Δ>1 | ref ΔBIC<−10, today rejected | unbounded extent | worst dim, median (90 %) | thinnest, median | axis °, median (90 %) | axis ° holohedry, median | search ev | search s | report s | iso s |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| truths | 11 | 6 | 4 | 1 (1) | 8 / 10 | 2 | 0 | 0 | +33 % (+295 %) | +33 % | 8.2 (48.5) | 8.2 | 4985 | 262.5 | 64.3 | 48.6 |

| solid | runs | held | free | rejected (early) | reached / judged | Δ>1 | ref ΔBIC<−10, today rejected | unbounded extent | worst dim, median (90 %) | thinnest, median | axis °, median (90 %) | axis ° holohedry, median | search ev | search s | report s | iso s |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| box | 2 | 0 | 2 | 0 (0) | 1 / 2 | 1 | 0 | 0 | +36 % (+50 %) | +22 % | 7.4 (10.5) | 7.4 | 5825 | 498.2 | 116.8 | 214.9 |
| sqbox | 2 | 2 | 0 | 0 (0) | 2 / 2 | 0 | 0 | 0 | +24 % (+31 %) | +13 % | 2.6 (4.7) | 2.6 | 5703 | 401.8 | 70.2 | 26.0 |
| cylinder | 2 | 1 | 1 | 0 (0) | 2 / 2 | 0 | 0 | 0 | +25 % (+31 %) | +25 % | 8.3 (13.8) | 7.4 | 4269 | 187.7 | 38.1 | 12.0 |
| ellcyl | 2 | 1 | 1 | 0 (0) | 1 / 2 | 1 | 0 | 0 | +380 % (+465 %) | +380 % | 56.0 (81.9) | 56.0 | 6462 | 192.0 | 63.9 | 6.9 |
| ellipsoid | 2 | 1 | 0 | 1 (1) | 1 / 1 | 0 | 0 | 0 | +29 % (+29 %) | +11 % | 0.0 (0.0) | 0.0 | 3494 | 104.9 | 34.2 | 4.0 |
| spheroid | 1 | 1 | 0 | 0 (0) | 1 / 1 | 0 | 0 | 0 | +46 % (+46 %) | +46 % | 44.1 (44.1) | 44.1 | 3337 | 118.7 | 60.6 | 7.0 |

| sphere searched as | runs | held | free | rejected (early) | reached / judged | Δ>1 | ref ΔBIC<−10, today rejected | unbounded extent | worst dim, median (90 %) | thinnest, median | axis °, median (90 %) | axis ° holohedry, median | search ev | search s | report s | iso s |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|

| class | runs | held | free | rejected (early) | reached / judged | Δ>1 | ref ΔBIC<−10, today rejected | unbounded extent | worst dim, median (90 %) | thinnest, median | axis °, median (90 %) | axis ° holohedry, median | search ev | search s | report s | iso s |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| -1 | 1 | 0 | 1 | 0 (0) | 1 / 1 | 0 | 0 | 0 | +18 % (+18 %) | +10 % | 3.5 (3.5) | 3.5 | 5074 | 718.3 | 188.7 | 423.9 |
| 2/m | 1 | 1 | 0 | 0 (0) | 1 / 1 | 0 | 0 | 0 | +15 % (+15 %) | -7 % | 5.2 (5.2) | 5.2 | 8474 | 717.0 | 122.1 | 49.4 |
| mmm | 1 | 1 | 0 | 0 (0) | 1 / 1 | 0 | 0 | 0 | +18 % (+18 %) | +18 % | 1.5 (1.5) | 1.5 | 5724 | 286.1 | 44.1 | 15.9 |
| 4/m | 1 | 1 | 0 | 0 (0) | 1 / 1 | 0 | 0 | 0 | +46 % (+46 %) | +46 % | 44.1 (44.1) | 44.1 | 3337 | 118.7 | 60.6 | 7.0 |
| 4/mmm | 1 | 0 | 1 | 0 (0) | 0 / 1 | 1 | 0 | 0 | +53 % (+53 %) | +34 % | 11.3 (11.3) | 11.3 | 6575 | 278.1 | 44.8 | 5.8 |
| -3 | 1 | 0 | 1 | 0 (0) | 1 / 1 | 0 | 0 | 0 | +33 % (+33 %) | +33 % | 15.1 (15.1) | 13.3 | 2814 | 89.3 | 32.2 | 8.1 |
| -3m | 1 | 1 | 0 | 0 (0) | 1 / 1 | 0 | 0 | 0 | +29 % (+29 %) | +11 % | 0.0 (0.0) | 0.0 | 4834 | 162.0 | 68.5 | 5.3 |
| 6/m | 1 | 1 | 0 | 0 (0) | 1 / 1 | 0 | 0 | 0 | +273 % (+273 %) | +273 % | 23.7 (23.7) | 23.7 | 6362 | 165.7 | 77.9 | 5.4 |
| 6/mmm | 1 | 0 | 1 | 0 (0) | 0 / 1 | 1 | 0 | 0 | +486 % (+486 %) | +486 % | 88.4 (88.4) | 88.4 | 6561 | 218.4 | 49.9 | 8.5 |
| m-3 | 1 | 1 | 0 | 0 (0) | 1 / 1 | 0 | 0 | 0 | +33 % (+33 %) | +33 % | 0.0 (0.0) | 0.0 | 2931 | 86.7 | 18.3 | 2.6 |
| m-3m | 1 | 0 | 0 | 1 (1) | 0 / 0 | 0 | 0 | 0 | — | — | — | — | 2153 | 47.7 | 0.0 | 2.6 |

| orientation | runs | held | free | rejected (early) | reached / judged | Δ>1 | ref ΔBIC<−10, today rejected | unbounded extent | worst dim, median (90 %) | thinnest, median | axis °, median (90 %) | axis ° holohedry, median | search ev | search s | report s | iso s |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| on | 3 | 2 | 1 | 0 (0) | 2 / 3 | 1 | 0 | 0 | +33 % (+396 %) | +33 % | 0.0 (70.7) | 0.0 | 4775 | 155.7 | 45.6 | 5.5 |
| near | 5 | 2 | 2 | 1 (1) | 4 / 4 | 0 | 0 | 0 | +18 % (+29 %) | +14 % | 4.4 (12.2) | 4.4 | 4848 | 371.7 | 77.4 | 100.0 |
| generic | 3 | 2 | 1 | 0 (0) | 2 / 3 | 1 | 0 | 0 | +53 % (+229 %) | +46 % | 23.7 (40.0) | 23.7 | 5425 | 187.5 | 61.1 | 6.0 |

| error (truths) | runs | held | free | rejected (early) | reached / judged | Δ>1 | ref ΔBIC<−10, today rejected | unbounded extent | worst dim, median (90 %) | thinnest, median | axis °, median (90 %) | axis ° holohedry, median | search ev | search s | report s | iso s |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| none | 11 | 6 | 4 | 1 (1) | 8 / 10 | 2 | 0 | 0 | +33 % (+295 %) | +33 % | 8.2 (48.5) | 8.2 | 4985 | 262.5 | 64.3 | 48.6 |

| error (spheres) | runs | held | free | rejected (early) | reached / judged | Δ>1 | ref ΔBIC<−10, today rejected | unbounded extent | worst dim, median (90 %) | thinnest, median | axis °, median (90 %) | axis ° holohedry, median | search ev | search s | report s | iso s |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|

| run | class | solid (searched) | orient | error | iso χ²_ν | outcome | ΔBIC | ref ΔBIC | Δ | worst dim | thinnest | axis ° | axis ° holo | search ev | search s | report s |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| box-P-1-near | -1 | box | near | none | 2.33 | free | -5358 | -5358 | 0.00 | +18 % | +10 % | 3.5 | 3.5 | 5074 | 718.3 | 188.7 |
| box-P4mmm-generic | 4/mmm | box | generic | none | 4.54 | free | -1968 | -1992 | 28.04 | +53 % | +34 % | 11.3 | 11.3 | 6575 | 278.1 | 44.8 |
| cylinder-P-3-near | -3 | cylinder | near | none | 1.32 | free | -2129 | -2125 | 0.00 | +33 % | +33 % | 15.1 | 13.3 | 2814 | 89.3 | 32.2 |
| cylinder-Pmmm-near | mmm | cylinder | near | none | 1.16 | held | -1022 | -1004 | 0.00 | +18 % | +18 % | 1.5 | 1.5 | 5724 | 286.1 | 44.1 |
| ellcyl-P6m-generic | 6/m | ellcyl | generic | none | 1.21 | held | -920 | -843 | 0.00 | +273 % | +273 % | 23.7 | 23.7 | 6362 | 165.7 | 77.9 |
| ellcyl-P6mmm-on | 6/mmm | ellcyl | on | none | 29.62 | free | -8517 | -8571 | 89.24 | +486 % | +486 % | 88.4 | 88.4 | 6561 | 218.4 | 49.9 |
| ellipsoid-P-3m1-on | -3m | ellipsoid | on | none | 1.25 | held | -1664 | -1664 | 0.00 | +29 % | +11 % | 0.0 | 0.0 | 4834 | 162.0 | 68.5 |
| ellipsoid-Pm-3m-near | m-3m | ellipsoid | near | none | 1.02 | early | 19 | 19 | — | — | — | — | — | 2153 | 47.7 | 0.0 |
| spheroid-P4m-generic | 4/m | spheroid | generic | none | 1.17 | held | -52 | -33 | 0.00 | +46 % | +46 % | 44.1 | 44.1 | 3337 | 118.7 | 60.6 |
| sqbox-P2m-near | 2/m | sqbox | near | none | 5.80 | held | -2982 | -2939 | 0.00 | +15 % | -7 % | 5.2 | 5.2 | 8474 | 717.0 | 122.1 |
| sqbox-Pm-3-on | m-3 | sqbox | on | none | 1.63 | held | -464 | -464 | 0.00 | +33 % | +33 % | 0.0 | 0.0 | 2931 | 86.7 | 18.3 |

Failures: none; records with an error: none.

## Today's minimum against the truth reference's (10 kept truths)

- Today's χ² more than one χ²_ν below the truth reference's: 3; of those at another solid (beyond 8° or 28 %): 2.
- Within one χ²_ν of it: 5; of those at another solid: 0.
- Above it by more than one χ²_ν: 2.
- Elliptic cylinders kept: 2; the reported height paired by size with another of the truth's extents: 2. Worst extent (median) paired by role +380 %, by size whatever the role +98 %.

