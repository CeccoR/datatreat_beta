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

