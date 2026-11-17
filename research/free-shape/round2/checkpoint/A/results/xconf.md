## lor: 11 rows

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

## wppm: 11 rows

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

