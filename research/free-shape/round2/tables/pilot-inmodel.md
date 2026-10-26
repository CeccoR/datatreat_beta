## Cost (3 runs: inmodel)

Per run: members in range (generator) and in the model's list; isotropic fit; today's search and report; the truth reference. Wall times in s, one process each, nice 15.

| run | class | grid | members (list) | iso ev | iso s | search ev | ms/ev | search s | report ev | report s | iso+search+report s | truth ref s | wall s | outcome |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| box-P4mmm-generic | 4/mmm | 10–100/0.01 | 105 (153) | 313 | 5.3 | 3010 | 24.5 | 73.8 | 891 | 20.0 | 99.1 | 7.8 | 107.4 | free |
| ellcyl-P6mmm-on | 6/mmm | 10–100/0.01 | 112 (152) | 281 | 4.1 | 4378 | 21.7 | 95.1 | 2495 | 40.6 | 139.8 | 7.7 | 148.0 | held |
| ellipsoid-Pm-3m-near | m-3m | 10–100/0.01 | 101 (152) | 274 | 1.8 | 2994 | 14.5 | 43.4 | 3422 | 43.9 | 89.1 | 5.5 | 95.1 | held |

Per Laue class (means over its runs): members in range (in the model's list), ms per evaluation of the search, evaluations, wall time (s).

| class | runs | members (list) | refl. (list) | ms/ev search | iso ev | search ev | report ev | iso s | search s | report s | iso+search+report s | truth ref s |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 4/mmm | 1 | 105 (153) | 27 (36) | 24.5 | 313 | 3010 | 891 | 5.3 | 73.8 | 20.0 | 99.1 | 7.8 |
| 6/mmm | 1 | 112 (152) | 22 (29) | 21.7 | 281 | 4378 | 2495 | 4.1 | 95.1 | 40.6 | 139.8 | 7.7 |
| m-3m | 1 | 101 (152) | 13 (17) | 14.5 | 274 | 2994 | 3422 | 1.8 | 43.4 | 43.9 | 89.1 | 5.5 |

Mean iso+search+report: 109.4 s (median 99.1, max 139.8); mean whole run with the truth reference and drawing: 116.8 s; ms per evaluation of the search: median 21.7, 14.5–24.5.

## Line-shape bias (3 truths)

Signed errors of the extents, the truth's thinnest, middle and longest (median, and the 10th–90th percentiles); the truth's most distinct axis (°, median and 90th percentile). "ref": the truth reference (refined from the truth, no search); "today": today's reported solid (kept runs). χ²_ν: the truth reference's.

| solid | kernel | runs | ref thinnest | ref middle | ref longest | ref axis ° | ref χ²_ν | today kept | today thinnest | today longest | today axis ° |
|---|---|---|---|---|---|---|---|---|---|---|---|
| box | none | 1 | -0 % (-0 %…-0 %) | +0 % (+0 %…+0 %) | +1 % (+1 %…+1 %) | 0.1 (0.1) | 1.01 | 1 | -0 % (-0 %…-0 %) | +1 % (+1 %…+1 %) | 0.1 (0.1) |
| ellcyl | none | 1 | -0 % (-0 %…-0 %) | -1 % (-1 %…-1 %) | +1 % (+1 %…+1 %) | 0.0 (0.0) | 0.99 | 1 | -0 % (-0 %…-0 %) | +1 % (+1 %…+1 %) | 0.0 (0.0) |
| ellipsoid | none | 1 | +3 % (+3 %…+3 %) | -11 % (-11 %…-11 %) | +154 % (+154 %…+154 %) | 18.5 (18.5) | 1.00 | 1 | +4 % (+4 %…+4 %) | +150 % (+150 %…+150 %) | 26.8 (26.8) |

By the model error (truth reference, all solids):

| error | runs | ref thinnest | ref middle | ref longest | ref axis ° | ref χ²_ν |
|---|---|---|---|---|---|---|

By Laue class (truth reference, clean truths):

| class | runs | ref thinnest | ref longest | longest/thinnest read ÷ true | ref axis ° |
|---|---|---|---|---|---|

| run | kernel | dims nm | ref dims nm | ref thinnest | middle | longest | ref axis ° | ref orient ° | ref χ²_ν | today | today thinnest | middle | longest | today axis ° |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| box-P4mmm-generic | none | 2.9×8.8×17.2 | 2.9×8.8×17.5 | -0 % | +0 % | +1 % | 0.1 | 0.4 | 1.01 | free | -0 % | +0 % | +1 % | 0.1 |
| ellcyl-P6mmm-on | none | 4.3×11.7×34.2 | 4.3×11.6×34.5 | -0 % | -1 % | +1 % | 0.0 | 0.0 | 0.99 | held | -0 % | -1 % | +1 % | 0.0 |
| ellipsoid-Pm-3m-near | none | 14.0×36.6×60.0 | 14.5×152.7×32.6 | +3 % | -11 % | +154 % | 18.5 | 42.4 | 1.00 | held | +4 % | -10 % | +150 % | 26.8 |

## Today's search (3 runs)

| set | runs | held | free | rejected (early) | reached / judged | Δ>1 | ref ΔBIC<−10, today rejected | worst dim, median (90 %) | thinnest, median | axis °, median (90 %) | axis ° holohedry, median | search ev | search s | report s | iso s |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| truths | 3 | 2 | 1 | 0 (0) | 3 / 3 | 0 | 0 | +1 % (+121 %) | -0 % | 0.1 (21.5) | 0.1 | 3461 | 70.8 | 34.8 | 3.8 |

| solid | runs | held | free | rejected (early) | reached / judged | Δ>1 | ref ΔBIC<−10, today rejected | worst dim, median (90 %) | thinnest, median | axis °, median (90 %) | axis ° holohedry, median | search ev | search s | report s | iso s |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| box | 1 | 0 | 1 | 0 (0) | 1 / 1 | 0 | 0 | +1 % (+1 %) | -0 % | 0.1 (0.1) | 0.1 | 3010 | 73.8 | 20.0 | 5.3 |
| ellcyl | 1 | 1 | 0 | 0 (0) | 1 / 1 | 0 | 0 | +1 % (+1 %) | -0 % | 0.0 (0.0) | 0.0 | 4378 | 95.1 | 40.6 | 4.1 |
| ellipsoid | 1 | 1 | 0 | 0 (0) | 1 / 1 | 0 | 0 | +150 % (+150 %) | +4 % | 26.8 (26.8) | 26.8 | 2994 | 43.4 | 43.9 | 1.8 |

| sphere searched as | runs | held | free | rejected (early) | reached / judged | Δ>1 | ref ΔBIC<−10, today rejected | worst dim, median (90 %) | thinnest, median | axis °, median (90 %) | axis ° holohedry, median | search ev | search s | report s | iso s |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|

| class | runs | held | free | rejected (early) | reached / judged | Δ>1 | ref ΔBIC<−10, today rejected | worst dim, median (90 %) | thinnest, median | axis °, median (90 %) | axis ° holohedry, median | search ev | search s | report s | iso s |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 4/mmm | 1 | 0 | 1 | 0 (0) | 1 / 1 | 0 | 0 | +1 % (+1 %) | -0 % | 0.1 (0.1) | 0.1 | 3010 | 73.8 | 20.0 | 5.3 |
| 6/mmm | 1 | 1 | 0 | 0 (0) | 1 / 1 | 0 | 0 | +1 % (+1 %) | -0 % | 0.0 (0.0) | 0.0 | 4378 | 95.1 | 40.6 | 4.1 |
| m-3m | 1 | 1 | 0 | 0 (0) | 1 / 1 | 0 | 0 | +150 % (+150 %) | +4 % | 26.8 (26.8) | 26.8 | 2994 | 43.4 | 43.9 | 1.8 |

| orientation | runs | held | free | rejected (early) | reached / judged | Δ>1 | ref ΔBIC<−10, today rejected | worst dim, median (90 %) | thinnest, median | axis °, median (90 %) | axis ° holohedry, median | search ev | search s | report s | iso s |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| on | 1 | 1 | 0 | 0 (0) | 1 / 1 | 0 | 0 | +1 % (+1 %) | -0 % | 0.0 (0.0) | 0.0 | 4378 | 95.1 | 40.6 | 4.1 |
| near | 1 | 1 | 0 | 0 (0) | 1 / 1 | 0 | 0 | +150 % (+150 %) | +4 % | 26.8 (26.8) | 26.8 | 2994 | 43.4 | 43.9 | 1.8 |
| generic | 1 | 0 | 1 | 0 (0) | 1 / 1 | 0 | 0 | +1 % (+1 %) | -0 % | 0.1 (0.1) | 0.1 | 3010 | 73.8 | 20.0 | 5.3 |

| error (truths) | runs | held | free | rejected (early) | reached / judged | Δ>1 | ref ΔBIC<−10, today rejected | worst dim, median (90 %) | thinnest, median | axis °, median (90 %) | axis ° holohedry, median | search ev | search s | report s | iso s |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| none | 3 | 2 | 1 | 0 (0) | 3 / 3 | 0 | 0 | +1 % (+121 %) | -0 % | 0.1 (21.5) | 0.1 | 3461 | 70.8 | 34.8 | 3.8 |

| error (spheres) | runs | held | free | rejected (early) | reached / judged | Δ>1 | ref ΔBIC<−10, today rejected | worst dim, median (90 %) | thinnest, median | axis °, median (90 %) | axis ° holohedry, median | search ev | search s | report s | iso s |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|

| run | class | solid (searched) | orient | error | iso χ²_ν | outcome | ΔBIC | ref ΔBIC | Δ | worst dim | thinnest | axis ° | axis ° holo | search ev | search s | report s |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| box-P4mmm-generic | 4/mmm | box | generic | none | 3.14 | free | -6058 | -6058 | 0.00 | +1 % | -0 % | 0.1 | 0.1 | 3010 | 73.8 | 20.0 |
| ellcyl-P6mmm-on | 6/mmm | ellcyl | on | none | 23.37 | held | -8587 | -8587 | 0.00 | +1 % | -0 % | 0.0 | 0.0 | 4378 | 95.1 | 40.6 |
| ellipsoid-Pm-3m-near | m-3m | ellipsoid | near | none | 1.00 | held | -14 | 13 | 0.00 | +150 % | +4 % | 26.8 | 26.8 | 2994 | 43.4 | 43.9 |

Failures: none; records with an error: none.

