## Cost (11 runs: inmodel)

Per run: members in range (generator) and in the model's list; isotropic fit; today's search and report; the truth reference. Wall times in s, one process each, nice 15.

| run | class | grid | members (list) | iso ev | iso s | search ev | ms/ev | search s | report ev | report s | iso+search+report s | truth ref s | wall s | outcome |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| box-P-1-near | -1 | 10–110/0.01 | 70 (214) | 1340 | 96.1 | 3770 | 48.5 | 182.7 | 1164 | 57.4 | 336.2 | 33.0 | 369.9 | free |
| cylinder-P-3-near | -3 | 10–110/0.01 | 61 (91) | 395 | 3.9 | 2506 | 9.4 | 23.5 | 1224 | 11.2 | 38.6 | 2.9 | 42.0 | free |
| ellipsoid-P-3m1-on | -3m | 10–110/0.01 | 67 (104) | 289 | 2.9 | 3190 | 13.3 | 42.6 | 3745 | 46.8 | 92.3 | 9.3 | 101.9 | held |
| sqbox-P2m-near | 2/m | 10–110/0.01 | 71 (144) | 422 | 18.1 | 4147 | 32.4 | 134.4 | 1140 | 36.4 | 188.9 | 21.8 | 211.3 | free |
| spheroid-P4m-generic | 4/m | 10–110/0.01 | 67 (102) | 308 | 3.5 | 2263 | 13.5 | 30.6 | 1894 | 27.0 | 61.1 | 7.6 | 69.0 | held |
| box-P4mmm-generic | 4/mmm | 10–110/0.01 | 68 (93) | 291 | 3.3 | 2941 | 15.6 | 45.9 | 720 | 11.0 | 60.1 | 4.8 | 65.3 | free |
| ellcyl-P6m-generic | 6/m | 10–110/0.01 | 69 (93) | 300 | 2.6 | 3658 | 9.8 | 35.7 | 2417 | 23.0 | 61.3 | 9.9 | 71.7 | free |
| ellcyl-P6mmm-on | 6/mmm | 10–110/0.01 | 60 (103) | 267 | 2.2 | 5048 | 13.6 | 68.8 | 2356 | 27.5 | 98.4 | 5.4 | 104.2 | held |
| sqbox-Pm-3-on | m-3 | 10–110/0.01 | 73 (89) | 249 | 1.6 | 2836 | 11.0 | 31.2 | 2298 | 21.8 | 54.6 | 6.8 | 61.8 | held |
| ellipsoid-Pm-3m-near | m-3m | 10–110/0.01 | 73 (89) | 247 | 1.4 | 2839 | 9.0 | 25.7 | 0 | 0.0 | 27.0 | 2.9 | 30.4 | rejected |
| cylinder-Pmmm-near | mmm | 10–110/0.01 | 68 (94) | 345 | 5.9 | 2441 | 17.9 | 43.7 | 711 | 13.2 | 62.8 | 4.5 | 67.7 | free |

Per Laue class (means over its runs): members in range (in the model's list), ms per evaluation of the search, evaluations, wall time (s).

| class | runs | members (list) | refl. (list) | ms/ev search | iso ev | search ev | report ev | iso s | search s | report s | iso+search+report s | truth ref s |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| -1 | 1 | 70 (214) | 70 (214) | 48.5 | 1340 | 3770 | 1164 | 96.1 | 182.7 | 57.4 | 336.2 | 33.0 |
| 2/m | 1 | 71 (144) | 46 (88) | 32.4 | 422 | 4147 | 1140 | 18.1 | 134.4 | 36.4 | 188.9 | 21.8 |
| mmm | 1 | 68 (94) | 30 (41) | 17.9 | 345 | 2441 | 711 | 5.9 | 43.7 | 13.2 | 62.8 | 4.5 |
| 4/m | 1 | 67 (102) | 22 (33) | 13.5 | 308 | 2263 | 1894 | 3.5 | 30.6 | 27.0 | 61.1 | 7.6 |
| 4/mmm | 1 | 68 (93) | 19 (25) | 15.6 | 291 | 2941 | 720 | 3.3 | 45.9 | 11.0 | 60.1 | 4.8 |
| -3 | 1 | 61 (91) | 23 (33) | 9.4 | 395 | 2506 | 1224 | 3.9 | 23.5 | 11.2 | 38.6 | 2.9 |
| -3m | 1 | 67 (104) | 22 (31) | 13.3 | 289 | 3190 | 3745 | 2.9 | 42.6 | 46.8 | 92.3 | 9.3 |
| 6/m | 1 | 69 (93) | 17 (21) | 9.8 | 300 | 3658 | 2417 | 2.6 | 35.7 | 23.0 | 61.3 | 9.9 |
| 6/mmm | 1 | 60 (103) | 14 (20) | 13.6 | 267 | 5048 | 2356 | 2.2 | 68.8 | 27.5 | 98.4 | 5.4 |
| m-3 | 1 | 73 (89) | 12 (14) | 11.0 | 249 | 2836 | 2298 | 1.6 | 31.2 | 21.8 | 54.6 | 6.8 |
| m-3m | 1 | 73 (89) | 10 (12) | 9.0 | 247 | 2839 | 0 | 1.4 | 25.7 | 0.0 | 27.0 | 2.9 |

Mean iso+search+report: 98.3 s (median 61.3, max 336.2); mean whole run with the truth reference and drawing: 108.6 s; ms per evaluation of the search: median 13.5, 9.0–48.5.

## Line-shape bias (11 truths)

Signed errors of the extents, the truth's thinnest, middle and longest (median, and the 10th–90th percentiles); the truth's most distinct axis (°, median and 90th percentile). "ref": the truth reference (refined from the truth, no search); "today": today's reported solid (kept runs). χ²_ν: the truth reference's.

| solid | kernel | runs | ref thinnest | ref middle | ref longest | ref unbounded | ref axis ° | ref χ²_ν | today kept | today thinnest | today longest | today axis ° |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| box | none | 2 | -0 % (-1 %…+1 %) | -1 % (-2 %…+1 %) | -4 % (-7 %…-1 %) | 0 | 1.1 (1.8) | 1.00 | 2 | -0 % (-1 %…+1 %) | -4 % (-7 %…-1 %) | 1.1 (1.8) |
| sqbox | none | 2 | +1 % (-0 %…+1 %) | +1 % (-0 %…+1 %) | +2 % (+1 %…+2 %) | 0 | 0.7 (1.3) | 1.00 | 2 | +1 % (-0 %…+1 %) | +2 % (+1 %…+2 %) | 0.7 (1.3) |
| cylinder | none | 2 | +2 % (+0 %…+4 %) | +16 % (+8 %…+23 %) | +16 % (+8 %…+23 %) | 0 | 4.8 (4.9) | 1.01 | 2 | +2 % (+0 %…+4 %) | +16 % (+8 %…+23 %) | 4.8 (4.9) |
| ellcyl | none | 2 | +2 % (+0 %…+3 %) | -13 % (-23 %…-4 %) | +85 % (+18 %…+153 %) | 0 | 2.0 (3.6) | 0.98 | 2 | +208 % (+42 %…+375 %) | -15 % (-27 %…-2 %) | 12.9 (23.3) |
| ellipsoid | none | 2 | -3 % (-4 %…-2 %) | +15 % (+14 %…+16 %) | +4217 % (+837 %…+7597 %) | 0 | 16.1 (22.2) | 0.99 | 1 | -1 % (-1 %…-1 %) | -20 % (-20 %…-20 %) | 0.0 (0.0) |
| spheroid | none | 1 | +3 % (+3 %…+3 %) | -1 % (-1 %…-1 %) | -1 % (-1 %…-1 %) | 0 | 5.3 (5.3) | 1.01 | 1 | +11 % (+11 %…+11 %) | -7 % (-7 %…-7 %) | 6.6 (6.6) |

By the model error (truth reference, all solids):

| error | runs | ref thinnest | ref middle | ref longest | ref axis ° | ref χ²_ν |
|---|---|---|---|---|---|---|

By Laue class (truth reference, clean truths):

| class | runs | ref thinnest | ref longest | longest/thinnest read ÷ true | ref axis ° |
|---|---|---|---|---|---|

| run | kernel | dims nm | ref dims nm | ref thinnest | middle | longest | ref axis ° | ref orient ° | ref χ²_ν | today | today thinnest | middle | longest | today axis ° |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| box-P-1-near | none | 6.7×13.7×60.0 | 6.6×13.9×55.5 | -2 % | +1 % | -8 % | 1.9 | 2.3 | 1.01 | free | -2 % | +1 % | -8 % | 1.9 |
| box-P4mmm-generic | none | 2.9×8.8×17.2 | 2.9×8.6×17.2 | +1 % | -2 % | -0 % | 0.3 | 1.9 | 1.00 | free | +1 % | -2 % | -0 % | 0.3 |
| cylinder-P-3-near | none | 46.6×46.6×14.8 | 49.5×49.5×14.7 | -0 % | +6 % | +6 % | 5.0 | 5.0 | 1.00 | free | -0 % | +6 % | +6 % | 5.0 |
| cylinder-Pmmm-near | none | 34.2×34.2×9.7 | 42.8×42.8×10.1 | +4 % | +25 % | +25 % | 4.7 | 4.7 | 1.02 | free | +4 % | +25 % | +25 % | 4.7 |
| ellcyl-P6m-generic | none | 44.8×58.5×9.8 | 157.7×33.3×10.2 | +4 % | -26 % | +170 % | 4.0 | 35.7 | 0.98 | free | +416 % | -75 % | -31 % | 25.9 |
| ellcyl-P6mmm-on | none | 4.3×11.7×34.2 | 4.3×11.6×34.6 | +0 % | -1 % | +1 % | 0.0 | 0.0 | 0.98 | held | +0 % | -1 % | +1 % | 0.0 |
| ellipsoid-P-3m1-on | none | 12.2×25.5×39.5 | 12.0×36.3×29.5 | -2 % | +16 % | -8 % | 8.5 | 9.3 | 0.98 | held | -1 % | +19 % | -20 % | 0.0 |
| ellipsoid-Pm-3m-near | none | 14.0×36.6×60.0 | 13.5×41.6×5125.1 | -4 % | +14 % | +8442 % | 23.7 | 24.0 | 1.00 | rejected | — | — | — | — |
| spheroid-P4m-generic | none | 22.9×22.9×14.2 | 22.6×22.6×14.6 | +3 % | -1 % | -1 % | 5.3 | 5.3 | 1.01 | held | +11 % | -7 % | -7 % | 6.6 |
| sqbox-P2m-near | none | 5.1×5.1×9.1 | 5.2×5.2×9.3 | +2 % | +2 % | +3 % | 1.5 | 2.0 | 0.99 | free | +2 % | +2 % | +3 % | 1.5 |
| sqbox-Pm-3-on | none | 10.9×10.9×15.2 | 10.8×10.8×15.3 | -1 % | -1 % | +1 % | 0.0 | 0.0 | 1.00 | held | -1 % | -1 % | +1 % | 0.0 |

## Today's search (11 runs)

| set | runs | held | free | rejected (early) | reached / judged | Δ>1 | ref ΔBIC<−10, today rejected | unbounded extent | worst dim, median (90 %) | thinnest, median | axis °, median (90 %) | axis ° holohedry, median | search ev | search s | report s | iso s |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| truths | 11 | 4 | 6 | 1 (0) | 11 / 11 | 0 | 0 | 0 | +7 % (+64 %) | +0 % | 1.7 (8.6) | 1.7 | 3240 | 60.4 | 25.0 | 12.9 |

| solid | runs | held | free | rejected (early) | reached / judged | Δ>1 | ref ΔBIC<−10, today rejected | unbounded extent | worst dim, median (90 %) | thinnest, median | axis °, median (90 %) | axis ° holohedry, median | search ev | search s | report s | iso s |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| box | 2 | 0 | 2 | 0 (0) | 2 / 2 | 0 | 0 | 0 | +5 % (+7 %) | -0 % | 1.1 (1.8) | 1.1 | 3356 | 114.3 | 34.2 | 49.7 |
| sqbox | 2 | 1 | 1 | 0 (0) | 2 / 2 | 0 | 0 | 0 | +2 % (+2 %) | +1 % | 0.7 (1.3) | 0.7 | 3492 | 82.8 | 29.1 | 9.9 |
| cylinder | 2 | 0 | 2 | 0 (0) | 2 / 2 | 0 | 0 | 0 | +16 % (+23 %) | +2 % | 4.8 (4.9) | 4.7 | 2474 | 33.6 | 12.2 | 4.9 |
| ellcyl | 2 | 1 | 1 | 0 (0) | 2 / 2 | 0 | 0 | 0 | +209 % (+375 %) | +208 % | 12.9 (23.3) | 12.5 | 4353 | 52.2 | 25.2 | 2.4 |
| ellipsoid | 2 | 1 | 0 | 1 (0) | 2 / 2 | 0 | 0 | 0 | +20 % (+20 %) | -1 % | 0.0 (0.0) | 0.0 | 3015 | 34.1 | 23.4 | 2.1 |
| spheroid | 1 | 1 | 0 | 0 (0) | 1 / 1 | 0 | 0 | 0 | +11 % (+11 %) | +11 % | 6.6 (6.6) | 6.6 | 2263 | 30.6 | 27.0 | 3.5 |

| sphere searched as | runs | held | free | rejected (early) | reached / judged | Δ>1 | ref ΔBIC<−10, today rejected | unbounded extent | worst dim, median (90 %) | thinnest, median | axis °, median (90 %) | axis ° holohedry, median | search ev | search s | report s | iso s |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|

| class | runs | held | free | rejected (early) | reached / judged | Δ>1 | ref ΔBIC<−10, today rejected | unbounded extent | worst dim, median (90 %) | thinnest, median | axis °, median (90 %) | axis ° holohedry, median | search ev | search s | report s | iso s |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| -1 | 1 | 0 | 1 | 0 (0) | 1 / 1 | 0 | 0 | 0 | +8 % (+8 %) | -2 % | 1.9 (1.9) | 1.9 | 3770 | 182.7 | 57.4 | 96.1 |
| 2/m | 1 | 0 | 1 | 0 (0) | 1 / 1 | 0 | 0 | 0 | +3 % (+3 %) | +2 % | 1.5 (1.5) | 1.5 | 4147 | 134.4 | 36.4 | 18.1 |
| mmm | 1 | 0 | 1 | 0 (0) | 1 / 1 | 0 | 0 | 0 | +25 % (+25 %) | +4 % | 4.7 (4.7) | 4.7 | 2441 | 43.7 | 13.2 | 5.9 |
| 4/m | 1 | 1 | 0 | 0 (0) | 1 / 1 | 0 | 0 | 0 | +11 % (+11 %) | +11 % | 6.6 (6.6) | 6.6 | 2263 | 30.6 | 27.0 | 3.5 |
| 4/mmm | 1 | 0 | 1 | 0 (0) | 1 / 1 | 0 | 0 | 0 | +2 % (+2 %) | +1 % | 0.3 (0.3) | 0.3 | 2941 | 45.9 | 11.0 | 3.3 |
| -3 | 1 | 0 | 1 | 0 (0) | 1 / 1 | 0 | 0 | 0 | +6 % (+6 %) | -0 % | 5.0 (5.0) | 4.6 | 2506 | 23.5 | 11.2 | 3.9 |
| -3m | 1 | 1 | 0 | 0 (0) | 1 / 1 | 0 | 0 | 0 | +20 % (+20 %) | -1 % | 0.0 (0.0) | 0.0 | 3190 | 42.6 | 46.8 | 2.9 |
| 6/m | 1 | 0 | 1 | 0 (0) | 1 / 1 | 0 | 0 | 0 | +416 % (+416 %) | +416 % | 25.9 (25.9) | 25.0 | 3658 | 35.7 | 23.0 | 2.6 |
| 6/mmm | 1 | 1 | 0 | 0 (0) | 1 / 1 | 0 | 0 | 0 | +1 % (+1 %) | +0 % | 0.0 (0.0) | 0.0 | 5048 | 68.8 | 27.5 | 2.2 |
| m-3 | 1 | 1 | 0 | 0 (0) | 1 / 1 | 0 | 0 | 0 | +1 % (+1 %) | -1 % | 0.0 (0.0) | 0.0 | 2836 | 31.2 | 21.8 | 1.6 |
| m-3m | 1 | 0 | 0 | 1 (0) | 1 / 1 | 0 | 0 | 0 | — | — | — | — | 2839 | 25.7 | 0.0 | 1.4 |

| orientation | runs | held | free | rejected (early) | reached / judged | Δ>1 | ref ΔBIC<−10, today rejected | unbounded extent | worst dim, median (90 %) | thinnest, median | axis °, median (90 %) | axis ° holohedry, median | search ev | search s | report s | iso s |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| on | 3 | 3 | 0 | 0 (0) | 3 / 3 | 0 | 0 | 0 | +1 % (+17 %) | -1 % | 0.0 (0.0) | 0.0 | 3691 | 47.5 | 32.0 | 2.2 |
| near | 5 | 0 | 4 | 1 (0) | 5 / 5 | 0 | 0 | 0 | +7 % (+20 %) | +1 % | 3.3 (4.9) | 3.3 | 3141 | 82.0 | 23.6 | 25.1 |
| generic | 3 | 1 | 2 | 0 (0) | 3 / 3 | 0 | 0 | 0 | +11 % (+335 %) | +11 % | 6.6 (22.0) | 6.6 | 2954 | 37.4 | 20.4 | 3.1 |

| error (truths) | runs | held | free | rejected (early) | reached / judged | Δ>1 | ref ΔBIC<−10, today rejected | unbounded extent | worst dim, median (90 %) | thinnest, median | axis °, median (90 %) | axis ° holohedry, median | search ev | search s | report s | iso s |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| none | 11 | 4 | 6 | 1 (0) | 11 / 11 | 0 | 0 | 0 | +7 % (+64 %) | +0 % | 1.7 (8.6) | 1.7 | 3240 | 60.4 | 25.0 | 12.9 |

| error (spheres) | runs | held | free | rejected (early) | reached / judged | Δ>1 | ref ΔBIC<−10, today rejected | unbounded extent | worst dim, median (90 %) | thinnest, median | axis °, median (90 %) | axis ° holohedry, median | search ev | search s | report s | iso s |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|

| run | class | solid (searched) | orient | error | iso χ²_ν | outcome | ΔBIC | ref ΔBIC | Δ | worst dim | thinnest | axis ° | axis ° holo | search ev | search s | report s |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| box-P-1-near | -1 | box | near | none | 2.12 | free | -5168 | -5168 | 0.00 | +8 % | -2 % | 1.9 | 1.9 | 3770 | 182.7 | 57.4 |
| box-P4mmm-generic | 4/mmm | box | generic | none | 3.11 | free | -6749 | -6749 | 0.00 | +2 % | +1 % | 0.3 | 0.3 | 2941 | 45.9 | 11.0 |
| cylinder-P-3-near | -3 | cylinder | near | none | 1.37 | free | -2690 | -2690 | 0.00 | +6 % | -0 % | 5.0 | 4.6 | 2506 | 23.5 | 11.2 |
| cylinder-Pmmm-near | mmm | cylinder | near | none | 1.15 | free | -1029 | -1029 | 0.00 | +25 % | +4 % | 4.7 | 4.7 | 2441 | 43.7 | 13.2 |
| ellcyl-P6m-generic | 6/m | ellcyl | generic | none | 1.12 | free | -1140 | -1135 | 0.00 | +416 % | +416 % | 25.9 | 25.0 | 3658 | 35.7 | 23.0 |
| ellcyl-P6mmm-on | 6/mmm | ellcyl | on | none | 21.15 | held | -9504 | -9504 | 0.00 | +1 % | +0 % | 0.0 | 0.0 | 5048 | 68.8 | 27.5 |
| ellipsoid-P-3m1-on | -3m | ellipsoid | on | none | 1.16 | held | -1473 | -1445 | 0.00 | +20 % | -1 % | 0.0 | 0.0 | 3190 | 42.6 | 46.8 |
| ellipsoid-Pm-3m-near | m-3m | ellipsoid | near | none | 1.00 | rejected | -2 | 23 | 0.00 | — | — | — | — | 2839 | 25.7 | 0.0 |
| spheroid-P4m-generic | 4/m | spheroid | generic | none | 1.02 | held | -39 | -22 | 0.00 | +11 % | +11 % | 6.6 | 6.6 | 2263 | 30.6 | 27.0 |
| sqbox-P2m-near | 2/m | sqbox | near | none | 2.45 | free | -5908 | -5908 | 0.00 | +3 % | +2 % | 1.5 | 1.5 | 4147 | 134.4 | 36.4 |
| sqbox-Pm-3-on | m-3 | sqbox | on | none | 1.02 | held | -169 | -169 | 0.00 | +1 % | -1 % | 0.0 | 0.0 | 2836 | 31.2 | 21.8 |

Failures: none; records with an error: none.

## Today's minimum against the truth reference's (10 kept truths)

- Today's χ² more than one χ²_ν below the truth reference's: 1; of those at another solid (beyond 8° or 28 %): 1.
- Within one χ²_ν of it: 9; of those at another solid: 1.
- Above it by more than one χ²_ν: 0.
- Elliptic cylinders kept: 2; the reported height paired by size with another of the truth's extents: 1. Worst extent (median) paired by role +209 %, by size whatever the role +8 %.

