# Track A: the solids told apart

Round 2, `../AB.md`. Made by `scripts/A/xconf.mjs`, `scripts/A/nested.mjs`, `scripts/A/why.mjs`, `scripts/A/fix/xmargin.mjs`, `scripts/A/fix/shapesep.mjs`, `scripts/A/fix/sepcmp.mjs` from the run records in `$W/fs2/A/results/` (not in the repository). Only tuning rows.

## Cross-solid fits: each of the 11 clean sub-screen rows searched as each of the six solids (early rejection off)

The "margin" columns of these tables are the other way round (best other family − truth); the margins below are the ones AB.md quotes.

### lor: 11 rows

Confusion by lowest χ² (rows: true solid; columns: chosen):

| true \ chosen | box | sqbox | cylinder | ellcyl | ellipsoid | spheroid | right |
|---|---|---|---|---|---|---|---|
| box | 1 | 1 | · | 1 | · | · | 1/3 |
| sqbox | · | 1 | · | · | · | · | 1/1 |
| cylinder | 1 | · | 1 | · | · | · | 1/2 |
| ellcyl | · | 1 | · | 2 | · | · | 2/3 |
| ellipsoid | 1 | · | · | · | · | · | 0/1 |
| spheroid | · | · | · | 1 | · | · | 0/1 |

Right: 5 of 11.

Confusion by lowest BIC (rows: true solid; columns: chosen):

| true \ chosen | box | sqbox | cylinder | ellcyl | ellipsoid | spheroid | right |
|---|---|---|---|---|---|---|---|
| box | 1 | 1 | · | 1 | · | · | 1/3 |
| sqbox | · | 1 | · | · | · | · | 1/1 |
| cylinder | · | 1 | 1 | · | · | · | 1/2 |
| ellcyl | · | 1 | · | 2 | · | · | 2/3 |
| ellipsoid | · | 1 | · | · | · | · | 0/1 |
| spheroid | · | · | · | · | · | 1 | 1/1 |

Right: 6 of 11.

| row | class | truth | iso χ²_ν | box Δχ²/χ²_ν, ΔBIC | sqbox Δχ²/χ²_ν, ΔBIC | cylinder Δχ²/χ²_ν, ΔBIC | ellcyl Δχ²/χ²_ν, ΔBIC | ellipsoid Δχ²/χ²_ν, ΔBIC | spheroid Δχ²/χ²_ν, ΔBIC | by χ² | by BIC | margin χ² | margin BIC |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| box-P-1-near | -1 | box | 2.53 | 2.5, 0h | 300.1, 304 | 298.9, 294 | 0.0, 0h | 15.8, 23h | 298.3, 293 | ellcyl | ellcyl | 2.5 | 0 |
| ellcyl-P2m-generic | 2/m | ellcyl | 4.64 | 5.5, 5 | 371.1, 362 | 527.5, 509 | 0.0, 0 | 12.3, 12 | 526.5, 508 | ellcyl | ellcyl | -5.5 | -5 |
| ellipsoid-Pmmm-generic | mmm | ellipsoid | 1.24 | 0.0, 9 | 0.2, 0 | 20.7, 11 | 9.3, 18 | 31.2, 40 | 44.3, 35 | box | sqbox | 31.2 | 40 |
| box-P4m-near | 4/m | box | 2.66 | 0.0, 0h | 70.7, 61h | 167.5, 175h | 28.7, 30h | 114.6, 118h | 187.8, 181h | box | box | -28.7 | -30 |
| cylinder-P4mmm-on | 4/mmm | cylinder | 16.55 | 0.0, 5h | 3.7, 0h | 70.0, 66h | 45.6, 51h | 365.6, 371h | 365.7, 362h | box | sqbox | 70.0 | 66 |
| spheroid-P-3-near | -3 | spheroid | 1.16 | 1.3, 37 | 1.4, 27 | 6.2, 5h | 0.0, 20h | 1.6, 9h | 1.6, 0h | ellcyl | spheroid | 1.6 | -5 |
| box-P-3m1-near | -3m | box | 1.03 | 0.0, 9h | 0.0, 0h | 0.0, 0h | 0.0, 9h | 1.6, 11h | 1.6, 2h | sqbox | sqbox | 0.0 | 9 |
| cylinder-P6m-on | 6/m | cylinder | 1.09 | 0.3, 10h | 0.1, 0h | 0.0, 0h | 0.0, 9h | 16.9, 26h | 16.9, 17h | cylinder | cylinder | -0.0 | -0 |
| ellcyl-P6m-generic | 6/m | ellcyl | 1.19 | 22.5, 43 | 22.6, 34 | 42.4, 29h | 0.0, 0h | 38.9, 35h | 40.7, 24h | ellcyl | ellcyl | -22.5 | -24 |
| sqbox-Pm-3-on | m-3 | sqbox | 1.59 | 0.1, 9h | 0.0, 0h | 100.6, 101h | 100.6, 110h | 242.4, 252h | 242.4, 242h | sqbox | sqbox | -0.1 | -9 |
| ellcyl-Pm-3m-generic | m-3m | ellcyl | 1.13 | 0.0, 9h | 0.0, 0h | 17.0, 17h | 17.0, 26h | 95.8, 105h | 84.2, 84h | sqbox | sqbox | 17.0 | 26 |

Searches: 66, 3776 evaluations and 65.3 s each (mean).

### lsq: 11 rows

Confusion by lowest χ² (rows: true solid; columns: chosen):

| true \ chosen | box | sqbox | cylinder | ellcyl | ellipsoid | spheroid | right |
|---|---|---|---|---|---|---|---|
| box | 2 | 1 | · | · | · | · | 2/3 |
| sqbox | 1 | · | · | · | · | · | 0/1 |
| cylinder | · | · | · | 1 | · | 1 | 0/2 |
| ellcyl | · | · | · | 3 | · | · | 3/3 |
| ellipsoid | · | · | · | · | 1 | · | 1/1 |
| spheroid | · | · | · | · | · | 1 | 1/1 |

Right: 7 of 11.

Confusion by lowest BIC (rows: true solid; columns: chosen):

| true \ chosen | box | sqbox | cylinder | ellcyl | ellipsoid | spheroid | right |
|---|---|---|---|---|---|---|---|
| box | 2 | · | · | · | · | 1 | 2/3 |
| sqbox | · | 1 | · | · | · | · | 1/1 |
| cylinder | · | · | · | 1 | · | 1 | 0/2 |
| ellcyl | · | · | · | 2 | · | 1 | 2/3 |
| ellipsoid | · | · | · | · | · | 1 | 0/1 |
| spheroid | · | · | · | · | · | 1 | 1/1 |

Right: 6 of 11.

| row | class | truth | iso χ²_ν | box Δχ²/χ²_ν, ΔBIC | sqbox Δχ²/χ²_ν, ΔBIC | cylinder Δχ²/χ²_ν, ΔBIC | ellcyl Δχ²/χ²_ν, ΔBIC | ellipsoid Δχ²/χ²_ν, ΔBIC | spheroid Δχ²/χ²_ν, ΔBIC | by χ² | by BIC | margin χ² | margin BIC |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| box-P-1-near | -1 | box | 2.48 | 0.0, 0 | 454.0, 445 | 502.6, 484 | 8.5, 9h | 42.3, 42 | 596.5, 578 | box | box | -8.5 | -9 |
| ellcyl-P2m-generic | 2/m | ellcyl | 4.35 | 16.1, 16 | 574.8, 566 | 695.2, 677 | 0.0, 0 | 90.6, 91 | 729.4, 711 | ellcyl | ellcyl | -16.1 | -16 |
| ellipsoid-Pmmm-generic | mmm | ellipsoid | 1.28 | 26.1, 43 | 27.1, 35 | 13.7, 12 | 12.3, 29 | 0.0, 17 | 1.6, 0 | ellipsoid | spheroid | -1.6 | 17 |
| box-P4m-near | 4/m | box | 2.69 | 0.0, 0 | 204.3, 195 | 286.4, 268 | 30.2, 18h | 66.9, 55h | 243.7, 225 | box | box | -30.2 | -18 |
| cylinder-P4mmm-on | 4/mmm | cylinder | 4.73 | 392.0, 420 | 394.8, 413 | 126.1, 117h | 0.0, 0h | 2903.6, 2904h | 2903.6, 2894h | ellcyl | ellcyl | 126.1 | 117 |
| spheroid-P-3-near | -3 | spheroid | 1.02 | 16.7, 37h | 24.8, 28h | 3.5, 15h | 3.5, 24h | 0.0, 9h | 0.0, 0h | spheroid | spheroid | -0.0 | -9 |
| box-P-3m1-near | -3m | box | 1.03 | 0.0, 30h | 0.0, 21h | 3.8, 17 | 2.4, 11h | 5.0, 9h | 5.0, 0h | sqbox | spheroid | 0.0 | 30 |
| cylinder-P6m-on | 6/m | cylinder | 1.01 | 25.7, 36h | 25.7, 27h | 7.2, 7h | 7.2, 16h | 0.0, 9h | 0.0, 0h | spheroid | spheroid | 7.2 | 7 |
| ellcyl-P6m-generic | 6/m | ellcyl | 1.10 | 14.4, 16 | 14.4, 6 | 26.8, 10 | 0.0, 1 | 5.8, 7 | 17.1, 0 | ellcyl | spheroid | -5.8 | 1 |
| sqbox-Pm-3-on | m-3 | sqbox | 1.17 | 0.0, 9h | 0.1, 0h | 141.1, 127h | 141.1, 136h | 988.9, 984h | 988.9, 975h | box | sqbox | 0.1 | -9 |
| ellcyl-Pm-3m-generic | m-3m | ellcyl | 1.07 | 12.7, 36 | 30.9, 42h | 51.3, 56 | 0.0, 0h | 33.0, 37h | 52.6, 57 | ellcyl | ellcyl | -12.7 | -36 |

Searches: 66, 3780 evaluations and 60.4 s each (mean).

### wppm: 11 rows

Confusion by lowest χ² (rows: true solid; columns: chosen):

| true \ chosen | box | sqbox | cylinder | ellcyl | ellipsoid | spheroid | right |
|---|---|---|---|---|---|---|---|
| box | 3 | · | · | · | · | · | 3/3 |
| sqbox | 1 | · | · | · | · | · | 0/1 |
| cylinder | · | · | · | 2 | · | · | 0/2 |
| ellcyl | · | · | · | 3 | · | · | 3/3 |
| ellipsoid | · | · | · | · | 1 | · | 1/1 |
| spheroid | · | · | · | · | 1 | · | 0/1 |

Right: 7 of 11.

Confusion by lowest BIC (rows: true solid; columns: chosen):

| true \ chosen | box | sqbox | cylinder | ellcyl | ellipsoid | spheroid | right |
|---|---|---|---|---|---|---|---|
| box | 2 | · | 1 | · | · | · | 2/3 |
| sqbox | · | 1 | · | · | · | · | 1/1 |
| cylinder | · | · | 2 | · | · | · | 2/2 |
| ellcyl | · | · | 2 | 1 | · | · | 1/3 |
| ellipsoid | · | · | · | · | · | 1 | 0/1 |
| spheroid | · | · | · | · | · | 1 | 1/1 |

Right: 7 of 11.

| row | class | truth | iso χ²_ν | box Δχ²/χ²_ν, ΔBIC | sqbox Δχ²/χ²_ν, ΔBIC | cylinder Δχ²/χ²_ν, ΔBIC | ellcyl Δχ²/χ²_ν, ΔBIC | ellipsoid Δχ²/χ²_ν, ΔBIC | spheroid Δχ²/χ²_ν, ΔBIC | by χ² | by BIC | margin χ² | margin BIC |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| box-P-1-near | -1 | box | 2.50 | 0.0, 0 | 638.5, 629 | 681.7, 663 | 26.0, 26 | 130.0, 130 | 842.3, 824 | box | box | -26.0 | -26 |
| ellcyl-P2m-generic | 2/m | ellcyl | 4.35 | 31.8, 32 | 636.1, 627 | 903.0, 885 | 0.0, 0 | 143.5, 143 | 866.1, 848 | ellcyl | ellcyl | -31.8 | -32 |
| ellipsoid-Pmmm-generic | mmm | ellipsoid | 1.32 | 82.7, 101 | 94.7, 104 | 71.9, 72 | 15.1, 33 | 0.0, 18 | 0.3, 0 | ellipsoid | spheroid | -0.3 | 18 |
| box-P4m-near | 4/m | box | 2.67 | 0.0, 0 | 475.3, 466 | 490.6, 472 | 21.8, 5h | 156.7, 157 | 399.7, 381 | box | box | -21.8 | -5 |
| cylinder-P4mmm-on | 4/mmm | cylinder | 3.37 | 288.3, 324 | 293.8, 320 | 1.3, 0h | 0.0, 8h | 5905.5, 5913h | 5905.5, 5904h | ellcyl | cylinder | 1.3 | -8 |
| spheroid-P-3-near | -3 | spheroid | 1.00 | 30.2, 63h | 33.6, 60 | 13.1, 21h | 11.1, 47 | 0.0, 9h | 0.8, 0h | ellipsoid | spheroid | 0.8 | -9 |
| box-P-3m1-near | -3m | box | 1.03 | 0.0, 12h | 3.3, 3h | 2.1, 0h | 1.6, 10h | 8.1, 11h | 8.2, 1h | box | cylinder | -1.6 | 12 |
| cylinder-P6m-on | 6/m | cylinder | 1.00 | 9.3, 15h | 13.9, 11h | 3.4, 0h | 0.0, 6h | 13.2, 19h | 13.2, 10h | ellcyl | cylinder | 3.4 | -6 |
| ellcyl-P6m-generic | 6/m | ellcyl | 1.13 | 0.3, 16 | 3.1, 10 | 2.5, 0 | 0.0, 16 | 68.9, 85 | 89.0, 86 | ellcyl | cylinder | -0.3 | 16 |
| sqbox-Pm-3-on | m-3 | sqbox | 1.16 | 0.0, 9h | 0.0, 0h | 270.3, 270h | 240.7, 250h | 1400.9, 1410h | 1400.9, 1401h | box | sqbox | 0.0 | -9 |
| ellcyl-Pm-3m-generic | m-3m | ellcyl | 1.10 | 4.5, 18 | 4.5, 9 | 4.5, 0 | 0.0, 14 | 44.2, 36h | 90.4, 81h | ellcyl | cylinder | -4.5 | 14 |

Searches: 66, 3713 evaluations and 186.7 s each (mean).

## Nested families

| model | criterion | right | nested | wrong | rows |
|---|---|---|---|---|---|
| lor | χ² | 5 | 1 | 5 | 11 |
| lor | BIC | 6 | 1 | 4 | 11 |
| lsq | χ² | 7 | 3 | 1 | 11 |
| lsq | BIC | 6 | 2 | 3 | 11 |
| wppm | χ² | 7 | 4 | 0 | 11 |
| wppm | BIC | 7 | 3 | 1 | 11 |

| row | truth dims (nm) | lor: by χ² / by BIC | lsq: by χ² / by BIC | wppm: by χ² / by BIC |
|---|---|---|---|---|
| box-P-1-near | 6.7 × 13.7 × 60.0 | ellcyl / ellcyl | box / box | box / box |
| ellcyl-P2m-generic | 27.3 × 60.0 × 14.6 | ellcyl / ellcyl | ellcyl / ellcyl | ellcyl / ellcyl |
| ellipsoid-Pmmm-generic | 5.2 × 20.1 × 21.1 | box / sqbox | ellipsoid / spheroid | ellipsoid / spheroid |
| box-P4m-near | 9.1 × 18.2 × 60.0 | box / box | box / box | box / box |
| cylinder-P4mmm-on | 6.3 × 6.3 × 6.5 | box / sqbox | ellcyl / ellcyl | ellcyl / cylinder |
| spheroid-P-3-near | 15.5 × 15.5 × 13.1 | ellcyl / spheroid | spheroid / spheroid | ellipsoid / spheroid |
| box-P-3m1-near | 14.3 × 29.6 × 60.0 | sqbox / sqbox | sqbox / spheroid | box / cylinder |
| cylinder-P6m-on | 5.7 × 5.7 × 6.4 | cylinder / cylinder | spheroid / spheroid | ellcyl / cylinder |
| ellcyl-P6m-generic | 44.8 × 58.5 × 9.8 | ellcyl / ellcyl | ellcyl / spheroid | ellcyl / cylinder |
| sqbox-Pm-3-on | 10.9 × 10.9 × 15.2 | sqbox / sqbox | box / sqbox | box / sqbox |
| ellcyl-Pm-3m-generic | 17.0 × 52.1 × 6.7 | sqbox / sqbox | ellcyl / ellcyl | ellcyl / cylinder |

## With a margin (one noise draw)

Right family = true solid or its nested partner, by more than m χ²/χ²_ν,iso over the best other family; another family = another family wins by more than m; else undetermined.

### lor

| row | truth | margin χ²/χ²_ν (best other family) | pick by χ² | margin BIC (best other family) | pick by BIC |
|---|---|---|---|---|---|
| box-P-1-near | box | -2.5 (ellcyl) | ellcyl | -0.2 (ellcyl) | ellcyl |
| ellcyl-P2m-generic | ellcyl | 5.5 (box) | ellcyl | 5.5 (box) | ellcyl |
| ellipsoid-Pmmm-generic | ellipsoid | -31.2 (box) | box | -35.0 (sqbox) | sqbox |
| box-P4m-near | box | 28.7 (ellcyl) | box | 29.6 (ellcyl) | box |
| cylinder-P4mmm-on | cylinder | -45.6 (box) | box | -51.1 (sqbox) | sqbox |
| spheroid-P-3-near | spheroid | -1.6 (ellcyl) | ellcyl | 5.3 (cylinder) | spheroid |
| box-P-3m1-near | box | 0.0 (cylinder) | sqbox | 0.0 (cylinder) | sqbox |
| cylinder-P6m-on | cylinder | 0.1 (sqbox) | cylinder | 0.4 (sqbox) | cylinder |
| ellcyl-P6m-generic | ellcyl | 22.5 (box) | ellcyl | 24.1 (spheroid) | ellcyl |
| sqbox-Pm-3-on | sqbox | 100.6 (cylinder) | sqbox | 100.6 (cylinder) | sqbox |
| ellcyl-Pm-3m-generic | ellcyl | -17.0 (sqbox) | sqbox | -17.0 (sqbox) | sqbox |

| margin m | by χ²: right solid / nested / undetermined / other family | by BIC: right / nested / undetermined / other |
|---|---|---|
| 0 | 5 / 1 / 0 / 5 | 6 / 1 / 0 / 4 |
| 3 | 4 / 0 / 4 / 3 | 5 / 0 / 3 / 3 |
| 6 | 3 / 0 / 5 / 3 | 3 / 0 / 5 / 3 |
| 10 | 3 / 0 / 5 / 3 | 3 / 0 / 5 / 3 |

### lsq

| row | truth | margin χ²/χ²_ν (best other family) | pick by χ² | margin BIC (best other family) | pick by BIC |
|---|---|---|---|---|---|
| box-P-1-near | box | 8.5 (ellcyl) | box | 8.5 (ellcyl) | box |
| ellcyl-P2m-generic | ellcyl | 16.1 (box) | ellcyl | 16.1 (box) | ellcyl |
| ellipsoid-Pmmm-generic | ellipsoid | 12.3 (ellcyl) | ellipsoid | 12.0 (cylinder) | spheroid |
| box-P4m-near | box | 30.2 (ellcyl) | box | 17.7 (ellcyl) | box |
| cylinder-P4mmm-on | cylinder | 392.0 (box) | ellcyl | 413.2 (sqbox) | ellcyl |
| spheroid-P-3-near | spheroid | 3.5 (cylinder) | spheroid | 14.9 (cylinder) | spheroid |
| box-P-3m1-near | box | 2.4 (ellcyl) | sqbox | -20.8 (spheroid) | spheroid |
| cylinder-P6m-on | cylinder | -7.2 (spheroid) | spheroid | -7.2 (spheroid) | spheroid |
| ellcyl-P6m-generic | ellcyl | 5.8 (ellipsoid) | ellcyl | -1.3 (spheroid) | spheroid |
| sqbox-Pm-3-on | sqbox | 141.1 (ellcyl) | box | 126.8 (cylinder) | sqbox |
| ellcyl-Pm-3m-generic | ellcyl | 12.7 (box) | ellcyl | 35.7 (box) | ellcyl |

| margin m | by χ²: right solid / nested / undetermined / other family | by BIC: right / nested / undetermined / other |
|---|---|---|
| 0 | 7 / 3 / 0 / 1 | 6 / 2 / 0 / 3 |
| 3 | 7 / 2 / 1 / 1 | 6 / 2 / 1 / 2 |
| 6 | 5 / 2 / 3 / 1 | 6 / 2 / 1 / 2 |
| 10 | 4 / 2 / 5 / 0 | 5 / 2 / 3 / 1 |

### wppm

| row | truth | margin χ²/χ²_ν (best other family) | pick by χ² | margin BIC (best other family) | pick by BIC |
|---|---|---|---|---|---|
| box-P-1-near | box | 26.0 (ellcyl) | box | 26.0 (ellcyl) | box |
| ellcyl-P2m-generic | ellcyl | 31.8 (box) | ellcyl | 31.8 (box) | ellcyl |
| ellipsoid-Pmmm-generic | ellipsoid | 15.1 (ellcyl) | ellipsoid | 33.2 (ellcyl) | spheroid |
| box-P4m-near | box | 21.8 (ellcyl) | box | 5.3 (ellcyl) | box |
| cylinder-P4mmm-on | cylinder | 288.3 (box) | ellcyl | 320.1 (sqbox) | cylinder |
| spheroid-P-3-near | spheroid | 11.1 (ellcyl) | ellipsoid | 20.8 (cylinder) | spheroid |
| box-P-3m1-near | box | 1.6 (ellcyl) | box | -3.1 (cylinder) | cylinder |
| cylinder-P6m-on | cylinder | 9.3 (box) | ellcyl | 9.8 (spheroid) | cylinder |
| ellcyl-P6m-generic | ellcyl | 0.3 (box) | ellcyl | 9.8 (sqbox) | cylinder |
| sqbox-Pm-3-on | sqbox | 240.7 (ellcyl) | box | 249.9 (ellcyl) | sqbox |
| ellcyl-Pm-3m-generic | ellcyl | 4.5 (sqbox) | ellcyl | 9.2 (sqbox) | cylinder |

| margin m | by χ²: right solid / nested / undetermined / other family | by BIC: right / nested / undetermined / other |
|---|---|---|
| 0 | 7 / 4 / 0 / 0 | 7 / 3 / 0 / 1 |
| 3 | 5 / 4 / 2 / 0 | 7 / 3 / 0 / 1 |
| 6 | 4 / 4 / 3 / 0 | 6 / 3 / 2 / 0 |
| 10 | 4 / 3 / 4 / 0 | 5 / 1 / 5 / 0 |

## Expected margins (noise-free fits to the exact pattern) and the isolating test (in-model separations)

| row | counts | rival | col rms | in-model Δχ²: lor / ball / wppm | exact data, expected margin χ²/χ²_ν,iso: lor / lsq / wppm | noisy margin (one draw): lor / lsq / wppm |
|---|---|---|---|---|---|---|
| box-P-1-near | 971 | ellcyl | 1.1 % | 3.6 / 5.2 / 116.8 | -2.1 / 25.7 / 46.9 | -2.5 / 8.5 / 26.0 |
| box-P-1-near | 971 | ellipsoid | 2.5 % | 17.5 / 32.5 / 408.8 | 18.6 / 64.7 / 165.4 | 13.4 / 42.3 / 130.0 |
| ellcyl-P2m-generic | 18195 | box | 1.4 % | 7.8 / 9.1 / 126.6 | 8.5 / 17.2 / 30.3 | 5.5 / 16.1 / 31.8 |
| ellcyl-P2m-generic | 18195 | ellipsoid | 1.6 % | 32.6 / 58.9 / 606.4 | 3.3 / 95.3 / 138.0 | 12.3 / 90.6 / 143.5 |
| ellipsoid-Pmmm-generic | 1066 | box | 2.6 % | 3.2 / 11.0 / 181.4 | -33.3 / 41.6 / 138.2 | -31.2 / 26.1 / 82.7 |
| ellipsoid-Pmmm-generic | 1066 | ellcyl | 1.6 % | 1.7 / 4.5 / 40.3 | -10.2 / 13.9 / 30.7 | -21.9 / 12.3 / 15.1 |
| box-P4m-near | 9487 | ellcyl | 1.7 % | 15.9 / 41.0 / 63.6 | 25.9 / 25.5 / 23.3 | 28.7 / 30.2 / 21.8 |
| box-P4m-near | 9487 | ellipsoid | 3.1 % | 21.4 / 70.9 / 384.6 | 129.3 / 53.7 / 145.2 | 114.6 / 66.9 / 156.7 |
| cylinder-P4mmm-on | 21916 | box | 0.9 % | 23.5 / 39.2 / 1355.3 | -112.5 / 297.0 / 411.5 | -45.6 / 392.0 / 288.3 |
| cylinder-P4mmm-on | 21916 | ellipsoid | 3.3 % | 621.0 / 3664.8 / 19904.2 | 251.3 / 2826.9 / 5928.8 | 320.0 / 2903.6 / 5905.5 |
| spheroid-P-3-near | 1225 | box | 2.0 % | 0.1 / 0.2 / 35.1 | 2.7 / 27.0 / 36.7 | -0.3 / 16.7 / 30.2 |
| spheroid-P-3-near | 1225 | ellcyl | 1.0 % | 0.1 / 0.4 / 15.3 | 1.6 / 5.6 / 16.1 | -1.6 / 3.5 / 11.1 |
| box-P-3m1-near | 906 | ellcyl | 1.6 % | 0.5 / 0.5 / 3.2 | 1.0 / 0.5 / 3.0 | 0.0 / 2.4 / 1.6 |
| box-P-3m1-near | 906 | ellipsoid | 2.6 % | 0.6 / 1.1 / 4.3 | 1.5 / 4.9 / 4.1 | 1.6 / 5.0 / 8.1 |
| cylinder-P6m-on | 949 | box | 0.9 % | 0.1 / 0.1 / 6.4 | -13.6 / 7.0 / 6.5 | 0.1 / 18.5 / 9.3 |
| cylinder-P6m-on | 949 | ellipsoid | 2.3 % | 5.2 / 6.9 / 27.7 | 2.8 / -8.9 / 26.9 | 16.9 / -7.2 / 13.2 |
| ellcyl-P6m-generic | 4107 | box | 1.3 % | 0.2 / 0.1 / 1.5 | 23.5 / -10.4 / 1.6 | 22.5 / 14.4 / 0.3 |
| ellcyl-P6m-generic | 4107 | ellipsoid | 2.0 % | 2.0 / 4.5 / 84.5 | 42.4 / -11.0 / 77.2 | 38.9 / 5.8 / 68.9 |
| sqbox-Pm-3-on | 4203 | ellcyl | 3.2 % | 26.5 / 57.5 / 303.8 | 92.9 / 73.8 / 268.9 | 100.6 / 141.1 / 240.7 |
| sqbox-Pm-3-on | 4203 | ellipsoid | 5.6 % | 79.3 / 266.8 / 1647.7 | 202.0 / 928.9 / 1435.9 | 242.4 / 988.9 / 1400.9 |
| ellcyl-Pm-3m-generic | 2192 | box | 1.5 % | 0.1 / 0.2 / 2.6 | -17.4 / 4.6 / 2.7 | -17.0 / 12.7 / 4.5 |
| ellcyl-Pm-3m-generic | 2192 | ellipsoid | 1.5 % | 0.6 / 3.0 / 65.5 | 109.8 / 33.0 / 60.2 | 67.3 / 33.0 / 44.2 |

Expected margin per row (the nearest rival family, exact data), counted: right family by more than m / within ±m / another family by more than m:

| model | m = 3 | m = 10 | rows within ±3 or wrong |
|---|---|---|---|
| lor | 4 / 3 / 4 | 3 / 4 / 4 | box-P-1-near -2.1, ellipsoid-Pmmm-generic -33.3, cylinder-P4mmm-on -112.5, spheroid-P-3-near 1.6, box-P-3m1-near 1.0, cylinder-P6m-on -13.6, ellcyl-Pm-3m-generic -17.4 |
| lsq | 8 / 1 / 2 | 6 / 4 / 1 | box-P-3m1-near 0.5, cylinder-P6m-on -8.9, ellcyl-P6m-generic -11.0 |
| wppm | 8 / 3 / 0 | 7 / 4 / 0 | box-P-3m1-near 3.0, ellcyl-P6m-generic 1.6, ellcyl-Pm-3m-generic 2.7 |

In-model, the 17 pairs within 2.6 % rms of column lengths: ball ÷ lor median 1.80 (0.71–5.28); wppm ÷ ball median 13.2 (1.5–150.4) (separations under 0.1 counted as 0.1).

## What sets the solids apart (column lengths, in-model and noisy separations)

Per candidate: col = rms ln ⟨L⟩_V mismatch of its best column-length match (%); in = noise-free in-model Δχ² (engine's own lines, the row's counts); then, per model, the noisy cross-solid fit's Δχ²/χ²_ν over the row's best solid (· = the best). The truth's own solid in bold.

| row | counts | members / distinct ⟨L⟩_V | box | sqbox | cylinder | ellcyl | ellipsoid | spheroid |
|---|---|---|---|---|---|---|---|---|
| box-P-1-near | 971 | 70 / 36 | **col 0.0, in 0.0, lor 2.5, lsq ·, wppm ·** | col 22.4, in 1121.9, lor 300.1, lsq 454.0, wppm 638.5 | col 23.4, in 1126.9, lor 298.9, lsq 502.6, wppm 681.7 | col 1.1, in 3.6, lor ·, lsq 8.5, wppm 26.0 | col 2.5, in 17.5, lor 15.8, lsq 42.3, wppm 130.0 | col 25.2, in 1137.1, lor 298.3, lsq 596.5, wppm 842.3 |
| ellcyl-P2m-generic | 18195 | 71 / 36 | col 1.4, in 7.8, lor 5.5, lsq 16.1, wppm 31.8 | col 12.0, in 2779.7, lor 371.1, lsq 574.8, wppm 636.1 | col 13.2, in 2711.8, lor 527.5, lsq 695.2, wppm 903.0 | **col 0.0, in 0.0, lor ·, lsq ·, wppm ·** | col 1.6, in 32.6, lor 12.3, lsq 90.6, wppm 143.5 | col 13.1, in 2711.8, lor 526.5, lsq 729.4, wppm 866.1 |
| ellipsoid-Pmmm-generic | 1066 | 68 / 38 | col 2.6, in 3.2, lor ·, lsq 26.1, wppm 82.7 | col 2.6, in 3.5, lor 0.2, lsq 27.1, wppm 94.7 | col 2.1, in 4.0, lor 20.7, lsq 13.7, wppm 71.9 | col 1.6, in 1.7, lor 9.3, lsq 12.3, wppm 15.1 | **col 0.0, in 0.0, lor 31.2, lsq ·, wppm ·** | col 0.8, in 1.1, lor 44.3, lsq 1.6, wppm 0.3 |
| box-P4m-near | 9487 | 67 / 37 | **col 0.0, in 0.0, lor ·, lsq ·, wppm ·** | col 17.0, in 244.4, lor 70.7, lsq 204.3, wppm 475.3 | col 17.7, in 390.7, lor 167.5, lsq 286.4, wppm 490.6 | col 1.7, in 15.9, lor 28.7, lsq 30.2, wppm 21.8 | col 3.1, in 21.4, lor 114.6, lsq 66.9, wppm 156.7 | col 17.7, in 390.7, lor 187.8, lsq 243.7, wppm 399.7 |
| cylinder-P4mmm-on | 21916 | 68 / 8 | col 0.9, in 23.5, lor ·, lsq 392.0, wppm 288.3 | col 0.9, in 23.7, lor 3.7, lsq 394.8, wppm 293.8 | **col 0.0, in 0.0, lor 70.0, lsq 126.1, wppm 1.3** | col 0.0, in 0.0, lor 45.6, lsq ·, wppm · | col 3.3, in 616.5, lor 365.6, lsq 2903.6, wppm 5905.5 | col 3.3, in 1932.9, lor 365.7, lsq 2903.6, wppm 5905.5 |
| spheroid-P-3-near | 1225 | 61 / 13 | col 2.0, in 0.1, lor 1.3, lsq 16.7, wppm 30.2 | col 2.1, in 0.1, lor 1.4, lsq 24.8, wppm 33.6 | col 1.7, in 0.1, lor 6.2, lsq 3.5, wppm 13.1 | col 1.0, in 0.1, lor ·, lsq 3.5, wppm 11.1 | col 0.0, in 0.0, lor 1.6, lsq ·, wppm · | **col 0.0, in 0.0, lor 1.6, lsq ·, wppm 0.8** |
| box-P-3m1-near | 906 | 67 / 34 | **col 0.0, in 0.0, lor ·, lsq ·, wppm ·** | col 12.3, in 0.6, lor ·, lsq ·, wppm 3.3 | col 13.3, in 0.7, lor ·, lsq 3.8, wppm 2.1 | col 1.6, in 0.5, lor ·, lsq 2.4, wppm 1.6 | col 2.6, in 0.6, lor 1.6, lsq 5.0, wppm 8.1 | col 15.2, in 1.0, lor 1.6, lsq 5.0, wppm 8.2 |
| cylinder-P6m-on | 949 | 69 / 9 | col 0.9, in 0.1, lor 0.3, lsq 25.7, wppm 9.3 | col 0.9, in 0.1, lor 0.1, lsq 25.7, wppm 13.9 | **col 0.0, in 0.0, lor ·, lsq 7.2, wppm 3.4** | col 0.0, in 0.0, lor ·, lsq 7.2, wppm · | col 2.3, in 5.1, lor 16.9, lsq ·, wppm 13.2 | col 2.4, in 5.5, lor 16.9, lsq ·, wppm 13.2 |
| ellcyl-P6m-generic | 4107 | 69 / 40 | col 1.3, in 0.2, lor 22.5, lsq 14.4, wppm 0.3 | col 3.7, in 1.0, lor 22.6, lsq 14.4, wppm 3.1 | col 3.9, in 1.6, lor 42.4, lsq 26.8, wppm 2.5 | **col 0.0, in 0.0, lor ·, lsq ·, wppm ·** | col 2.0, in 2.0, lor 38.9, lsq 5.8, wppm 68.9 | col 4.6, in 7.1, lor 40.7, lsq 17.1, wppm 89.0 |
| sqbox-Pm-3-on | 4203 | 73 / 11 | col 0.0, in 0.0, lor 0.1, lsq ·, wppm · | **col 0.0, in 0.0, lor ·, lsq 0.1, wppm ·** | col 3.2, in 30.2, lor 100.6, lsq 141.1, wppm 270.3 | col 3.2, in 26.9, lor 100.6, lsq 141.1, wppm 240.7 | col 5.6, in 67.6, lor 242.4, lsq 988.9, wppm 1400.9 | col 5.6, in 92.8, lor 242.4, lsq 988.9, wppm 1400.9 |
| ellcyl-Pm-3m-generic | 2192 | 73 / 42 | col 1.5, in 0.1, lor ·, lsq 12.7, wppm 4.5 | col 14.8, in 4.0, lor ·, lsq 30.9, wppm 4.5 | col 15.4, in 3.7, lor 17.0, lsq 51.3, wppm 4.5 | **col 0.0, in 0.0, lor 17.0, lsq ·, wppm ·** | col 1.5, in 0.6, lor 95.8, lsq 33.0, wppm 44.2 | col 16.3, in 6.2, lor 84.2, lsq 52.6, wppm 90.4 |

#### The nearest rival by column lengths

| row | distinct ⟨L⟩_V | counts | rival | col rms | in-model Δχ² | lor: rival − truth (Δχ²/χ²_ν) | lsq: rival − truth (Δχ²/χ²_ν) | wppm: rival − truth (Δχ²/χ²_ν) |
|---|---|---|---|---|---|---|---|---|
| box-P-1-near | 36 | 971 | ellcyl | 1.1 % | 3.6 | -2.5 | 8.5 | 26.0 |
| ellcyl-P2m-generic | 36 | 18195 | box | 1.4 % | 7.8 | 5.5 | 16.1 | 31.8 |
| ellipsoid-Pmmm-generic | 38 | 1066 | spheroid | 0.8 % | 1.1 | 13.2 | 1.6 | 0.3 |
| box-P4m-near | 37 | 9487 | ellcyl | 1.7 % | 15.9 | 28.7 | 30.2 | 21.8 |
| cylinder-P4mmm-on | 8 | 21916 | ellcyl | 0.0 % | -0.0 | -24.4 | -126.1 | -1.3 |
| spheroid-P-3-near | 13 | 1225 | ellipsoid | 0.0 % | -0.0 | 0.0 | 0.0 | -0.8 |
| box-P-3m1-near | 34 | 906 | ellcyl | 1.6 % | 0.5 | 0.0 | 2.4 | 1.6 |
| cylinder-P6m-on | 9 | 949 | ellcyl | 0.0 % | -0.0 | 0.0 | -0.0 | -3.4 |
| ellcyl-P6m-generic | 40 | 4107 | box | 1.3 % | 0.2 | 22.5 | 14.4 | 0.3 |
| sqbox-Pm-3-on | 11 | 4203 | box | 0.0 % | 0.0 | 0.1 | -0.1 | -0.0 |
| ellcyl-Pm-3m-generic | 42 | 2192 | ellipsoid | 1.5 % | 0.6 | 78.9 | 33.0 | 44.2 |
