# Step 2: the solids with the finalist (`../STEP2.md` §7)

## Expected family margins

AB.md §3.6's: noise-free fits to the generator's exact pattern of each of the 11 clean sub-screen rows (Poisson weights at the row's counts), the true solid from the truth and each other family's general member from track A's best column-length start (track A's `fix/shapesep.mjs --data exact`, here `scripts/step2/bench/shapesep2.mjs` on step 2's engine); margin = (rival χ² − true solid's χ²)/χ²_ν of the row's isotropic fit, the nearest rival family's. lsq and wppm: track A's runs (`$W/fs2/A/results/shapesep-exact-{lsq,wppm}.json`); W4: step 2's finalist (`scripts/step2/bench/margins.mjs`).

| row | counts | lsq: margin (rival) | wppm: margin (rival) | W4: margin (rival) |
|---|---|---|---|---|
| box-P-1-near | 971 | 25.7 (ellcyl) | 46.9 (ellcyl) | 46.9 (ellcyl) |
| ellcyl-P2m-generic | 18195 | 17.2 (box) | 30.3 (box) | 30.3 (box) |
| ellipsoid-Pmmm-generic | 1066 | 13.9 (ellcyl) | 30.7 (ellcyl) | 30.7 (ellcyl) |
| box-P4m-near | 9487 | 25.5 (ellcyl) | 23.3 (ellcyl) | 23.3 (ellcyl) |
| cylinder-P4mmm-on | 21916 | 297.0 (box) | 411.5 (box) | 412.1 (box) |
| spheroid-P-3-near | 1225 | 5.6 (ellcyl) | 16.1 (ellcyl) | 16.1 (ellcyl) |
| box-P-3m1-near | 906 | 0.5 (ellcyl) | 3.0 (ellcyl) | 3.0 (ellcyl) |
| cylinder-P6m-on | 949 | -8.9 (ellipsoid) | 6.5 (box) | 6.5 (box) |
| ellcyl-P6m-generic | 4107 | -11.0 (ellipsoid) | 1.6 (box) | 1.6 (box) |
| sqbox-Pm-3-on | 4203 | 73.8 (ellcyl) | 268.9 (ellcyl) | 261.0 (ellcyl) |
| ellcyl-Pm-3m-generic | 2192 | 4.6 (box) | 2.7 (box) | 2.7 (box) |
| right / within ±3 / wrong | | 8 / 1 / 2 | 8 / 3 / 0 | 8 / 3 / 0 |

## Cross-solid searches, one noise draw (track A's xconf)

Each clean sub-screen row searched as each of the six solids, early rejection off (`PROTO_NOEARLY`), W4 with search v2 'briefs' (`scripts/step2/runxs.sh`, `jobs-xs.txt`), read by track A's `xconf.mjs` and `fix/xmargin.mjs`; track A's WPPM runs (`xs-wppm`, v522's search) beside them. Margins in χ²/χ²_ν,iso, negative: the truth's solid wins.

### W4

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
| box-P-1-near | -1 | box | 2.50 | 0.0, 0 | 638.3, 629 | 681.7, 663 | 26.0, 26 | 130.0, 130 | 842.3, 824 | box | box | -26.0 | -26 |
| ellcyl-P2m-generic | 2/m | ellcyl | 4.35 | 31.8, 32 | 636.0, 627 | 903.0, 885 | 0.0, 0 | 143.5, 143 | 866.1, 848 | ellcyl | ellcyl | -31.8 | -32 |
| ellipsoid-Pmmm-generic | mmm | ellipsoid | 1.32 | 82.7, 101 | 94.6, 104 | 71.9, 72 | 15.1, 33 | 0.0, 18 | 0.3, 0 | ellipsoid | spheroid | -0.3 | 18 |
| box-P4m-near | 4/m | box | 2.67 | 0.0, 0 | 475.3, 466 | 490.7, 472 | 21.8, 5h | 156.7, 157 | 399.7, 381 | box | box | -21.8 | -5 |
| cylinder-P4mmm-on | 4/mmm | cylinder | 3.37 | 288.0, 324 | 300.7, 327 | 1.0, 0h | 0.0, 8h | 5906.0, 5914h | 5905.2, 5904h | ellcyl | cylinder | 1.0 | -8 |
| spheroid-P-3-near | -3 | spheroid | 1.00 | 35.4, 71 | 33.6, 60 | 13.1, 21h | 11.1, 47 | 0.0, 9h | 0.8, 0h | ellipsoid | spheroid | 0.8 | -9 |
| box-P-3m1-near | -3m | box | 1.03 | 0.0, 12h | 3.3, 3h | 2.1, 0h | 3.1, 6h | 8.1, 11h | 8.2, 1h | box | cylinder | -2.1 | 12 |
| cylinder-P6m-on | 6/m | cylinder | 1.00 | 9.3, 15h | 13.6, 11h | 3.4, 0h | 0.0, 6h | 13.1, 19h | 13.2, 10h | ellcyl | cylinder | 3.4 | -6 |
| ellcyl-P6m-generic | 6/m | ellcyl | 1.13 | 0.3, 16 | 3.1, 10 | 2.6, 0 | 0.0, 16 | 69.0, 85 | 89.1, 86 | ellcyl | cylinder | -0.3 | 16 |
| sqbox-Pm-3-on | m-3 | sqbox | 1.16 | 0.0, 9h | 0.0, 0h | 270.2, 270h | 240.7, 250h | 1403.2, 1412h | 1401.7, 1402h | box | sqbox | 0.0 | -9 |
| ellcyl-Pm-3m-generic | m-3m | ellcyl | 1.10 | 4.3, 18 | 4.5, 9 | 4.5, 0 | 0.0, 14 | 44.3, 36h | 90.4, 81h | ellcyl | cylinder | -4.3 | 14 |

Searches: 66, 2232 evaluations and 14.8 s each (mean).


Counted with a margin m (`fix/xmargin.mjs`), right solid / nested partner / undetermined / another family, by χ² and by BIC; track A's WPPM gives the same counts:

| m | by χ² | by BIC |
|---|---|---|
| 0 | 7 / 4 / 0 / 0 | 7 / 3 / 0 / 1 |
| 3 | 5 / 4 / 2 / 0 | 7 / 3 / 0 / 1 |
| 10 | 4 / 3 / 4 / 0 | 5 / 1 / 5 / 0 |
