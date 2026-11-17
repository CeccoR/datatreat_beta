# Step 5: the family (`../STEP5.md` §3)

Every screening row fitted as each of the six solids (X2: the 66 truths, the minima stage off, the search's polish on; X1: the 11 spheres, the stage on); rule 'all' (every shape with a gain goes on), early 0. A family's χ² is its best member's (the ball family holds the isotropic fit, "sphere"); margins in χ²/max(1, χ²_ν,iso) (`fam5.mjs`). BIC: each family's member of least χ²/ν + P ln N.

## One margin m for every row (no allowance for the check)

| statistic | m | all: right / n.d. / wrong | clean | error |
|---|---|---|---|---|
| χ² | 0 | 48 / 0 / 18 | 30 / 0 / 3 | 18 / 0 / 15 |
| χ² | 3 | 43 / 10 / 13 | 27 / 6 / 0 | 16 / 4 / 13 |
| χ² | 6 | 38 / 18 / 10 | 24 / 9 / 0 | 14 / 9 / 10 |
| χ² | 10 | 33 / 24 / 9 | 21 / 12 / 0 | 12 / 12 / 9 |
| χ² | 16 | 27 / 32 / 7 | 18 / 15 / 0 | 9 / 17 / 7 |
| χ² | 25 | 19 / 43 / 4 | 14 / 19 / 0 | 5 / 24 / 4 |
| BIC | 0 | 50 / 0 / 16 | 30 / 0 / 3 | 20 / 0 / 13 |
| BIC | 3 | 46 / 6 / 14 | 27 / 4 / 2 | 19 / 2 / 12 |
| BIC | 6 | 45 / 11 / 10 | 27 / 5 / 1 | 18 / 6 / 9 |
| BIC | 10 | 37 / 21 / 8 | 24 / 9 / 0 | 13 / 12 / 8 |
| BIC | 16 | 32 / 28 / 6 | 23 / 10 / 0 | 9 / 18 / 6 |
| BIC | 25 | 29 / 32 / 5 | 20 / 13 / 0 | 9 / 19 / 5 |

## The bootstrap of the margin (FB)

45 rows whose runner-up family (or the true one) lies within 30 χ²_ν of the winner; each solid within 30 and the true family's two refined again from its returned fit on 10 T replicas (the generator's counts with Poisson noise, the same draws for every solid; central differences, 30 iterations). A flip: the data's runner-up lower. c and m* from P(flip) = Φ(−m/√(4m + c)) on the data's margin (`fboot-an.mjs`).

| group | rows | replicas | flips at m < 3 (rows) | 3–10 | 10–25 | over 25 | c | m* (5 %) |
|---|---|---|---|---|---|---|---|---|
| all | 45 | 450 | 0.41 (10) | 0.09 (14) | 0.15 (19) | 0.00 (2) | 54.1 | 18.7 |
| clean | 20 | 200 | 0.48 (6) | 0.15 (6) | 0.04 (7) | 0.00 (1) | 16.8 | 14.1 |
| error | 25 | 250 | 0.30 (4) | 0.04 (8) | 0.22 (12) | 0.00 (1) | 112.5 | 23.7 |
| flagged | 17 | 170 | 0.45 (2) | 0.04 (7) | 0.37 (7) | 0.00 (1) | 313.3 | 35.1 |
| not flagged | 28 | 280 | 0.40 (8) | 0.13 (7) | 0.03 (12) | 0.00 (1) | 6.0 | 12.2 |
| row | error | flag | winner right | m data | m refit | m noise-free | replicas: median, min | flips |
| box-P-1-near | — |  | yes | 26.0 | 26.0 | 22.3 | 20.9, 13.5 | 0/10 |
| box-P2m-generic | air |  | yes | 11.5 | 11.5 | 12.5 | 14.7, 0.3 | 0/10 |
| box-Pmmm-on | po | F | no | 4.2 | 4.2 | 6.9 | 10.9, 2.9 | 0/10 |
| box-P4m-near | — |  | yes | 21.8 | 21.8 | 22.8 | 24.8, 9.2 | 0/10 |
| box-P-3-on | sizedist |  | no | 0.9 | 1.1 | 0.3 | 0.6, -1.9 | 2/10 |
| box-P-3m1-near | — |  | yes | 3.5 | 3.1 | 1.5 | 1.5, -2.5 | 2/10 |
| box-P6m-generic | — |  | no | 0.4 | 0.4 | -0.5 | -0.8, -3.5 | 8/10 |
| box-P6mmm-on | impurity | F | yes | 12.5 | 12.5 | 10.0 | 9.2, -3.3 | 2/10 |
| box-Pm-3-near | impurity | F | yes | 20.0 | 20.0 | 12.4 | 13.4, 7.4 | 0/10 |
| box-Pm-3m-generic | hump | F | no | 26.5 | 26.5 | 24.9 | 24.8, 23.1 | 0/10 |
| sqbox-P-1-on | sizedist |  | no | 13.1 | 12.2 | 18.9 | 20.9, 7.0 | 0/10 |
| sqbox-P4m-on | air | F | no | 11.5 | 11.5 | -11.6 | -14.1, -54.2 | 10/10 |
| sqbox-P4mmm-near | — |  | yes | 23.0 | 23.0 | 23.2 | 23.5, 16.5 | 0/10 |
| sqbox-P-3-generic | hump | F | yes | 3.2 | 3.2 | 1.4 | 2.1, -2.9 | 2/10 |
| sqbox-P-3m1-on | po | F | no | 16.8 | 16.8 | 8.3 | -3.0, -20.5 | 6/10 |
| sqbox-P6mmm-generic | impurity | F | yes | 0.1 | 0.1 | -0.8 | -0.8, -1.9 | 7/10 |
| cylinder-P-1-generic | — |  | yes | 12.5 | 12.5 | 26.7 | 27.9, 16.9 | 0/10 |
| cylinder-P2m-on | impurity | F | yes | 4.6 | 6.1 | 12.8 | 11.9, 0.2 | 0/10 |
| cylinder-Pmmm-near | — |  | no | 2.4 | 2.4 | -1.5 | 0.8, -4.0 | 4/10 |
| cylinder-P-3-near | — |  | yes | 0.7 | 0.7 | 1.7 | 1.8, -2.4 | 3/10 |
| cylinder-P-3m1-generic | po | F | no | 1.5 | 1.5 | 7.7 | 4.7, -9.4 | 2/10 |
| cylinder-P6m-on | — |  | yes | 9.3 | 9.3 | 4.4 | 4.9, -1.2 | 1/10 |
| cylinder-P6mmm-near | air |  | yes | 16.1 | 16.1 | 18.1 | 17.4, 13.7 | 0/10 |
| ellcyl-P-1-near | po | F | yes | 7.2 | 7.2 | 9.1 | 8.6, 7.6 | 0/10 |
| ellcyl-Pmmm-on | air |  | yes | 16.4 | 17.4 | 22.5 | 20.8, 6.3 | 0/10 |
| ellcyl-P4mmm-generic | hump |  | yes | 0.8 | 0.8 | 6.8 | 6.9, -6.0 | 1/10 |
| ellcyl-P6m-generic | — |  | yes | 0.3 | 0.3 | 1.3 | -0.0, -3.4 | 5/10 |
| ellcyl-Pm-3-near | — |  | yes | 7.8 | 7.8 | 11.0 | 7.4, 3.4 | 0/10 |
| ellcyl-Pm-3m-generic | — |  | yes | 4.3 | 4.3 | 2.6 | 2.3, -7.4 | 3/10 |
| ellipsoid-P2m-near | — |  | yes | 18.4 | 18.5 | 30.2 | 28.9, 16.1 | 0/10 |
| ellipsoid-Pmmm-generic | — |  | yes | 15.1 | 15.1 | 35.7 | 36.8, 22.6 | 0/10 |
| ellipsoid-P4m-on | hump | F | yes | 8.7 | 8.7 | 16.6 | 18.6, 8.0 | 0/10 |
| ellipsoid-P-3-generic | impurity | F | no | 5.3 | 9.4 | 11.4 | 11.9, 10.0 | 0/10 |
| ellipsoid-P-3m1-on | — |  | yes | 9.4 | 9.5 | 13.2 | 11.8, 3.0 | 0/10 |
| ellipsoid-P6m-near | — |  | yes | 1.4 | 2.2 | 1.8 | -0.2, -10.8 | 5/10 |
| ellipsoid-P6mmm-generic | air | F | yes | 23.4 | 23.4 | 27.7 | 30.3, 10.6 | 0/10 |
| ellipsoid-Pm-3-on | po |  | yes | 15.8 | 15.8 | 28.7 | 30.6, 7.0 | 0/10 |
| ellipsoid-Pm-3m-near | — |  | no | 1.5 | 1.5 | -0.5 | 0.1, -2.1 | 4/10 |
| spheroid-P2m-on | impurity | F | no | 22.5 | 22.3 | 23.7 | 23.4, 20.5 | 0/10 |
| spheroid-P4m-generic | — |  | yes | 21.5 | 21.5 | 27.1 | 27.2, -4.4 | 1/10 |
| spheroid-P4mmm-on | hump | F | no | 4.3 | 4.3 | 6.7 | 7.9, -1.2 | 1/10 |
| spheroid-P-3-near | — |  | yes | 10.3 | 11.1 | 10.9 | 5.4, -5.9 | 2/10 |
| spheroid-P6m-on | sizedist |  | no | 9.8 | 9.8 | 4.7 | 5.6, 0.3 | 0/10 |
| spheroid-P6mmm-near | hump | F | no | 18.0 | 18.7 | 2.1 | -5.6, -29.1 | 8/10 |
| spheroid-Pm-3-generic | — |  | yes | 4.3 | -0.4 | 4.5 | 4.8, -5.2 | 3/10 |

The nested test on the same replicas (the true family's special member less its general one, χ²_ν):

  box special truths, clean: 1 rows, replicas 10: median 0.0, 90 % 0.4, 95 % 0.5, max 0.7
  box special truths, error: 5 rows, replicas 50: median 0.2, 90 % 11.7, 95 % 25.8, max 50.5
| box | special truths 6: data -1.2, -3.2, 0.0, 6.2, 4.9, -0.3; replicas 60: median 0.1, 95 % 21.3, 99 % 44.8 | general truths 10: data 638.3, 130.4, 745.0, 475.3, 15.6, 9.9, 2.8, 562.2, 10.0, 230.0; replicas median 179.8, 5 % 0.2 |
  cyl special truths, clean: 4 rows, replicas 40: median 0.7, 90 % 3.3, 95 % 4.7, max 27.1
  cyl special truths, error: 3 rows, replicas 30: median 4.5, 90 % 37.3, 95 % 42.7, max 50.4
| cyl | special truths 7: data 0.1, 4.3, -1.6, 2.6, 37.9, 3.4, 1.5; replicas 70: median 1.5, 95 % 36.3, 99 % 45.7 | general truths 6: data 137.2, 11.8, 2.7, 2.6, 71.6, 4.5; replicas median 17.5, 5 % 2.8 |
  ball special truths, clean: 3 rows, replicas 30: median 0.9, 90 % 5.0, 95 % 6.4, max 8.2
  ball special truths, error: 4 rows, replicas 40: median 12.8, 90 % 25.4, 95 % 26.3, max 27.6
| ball | special truths 7: data 28.7, -5.9, 5.2, -0.0, 19.8, 2.3, -2.7; replicas 70: median 6.9, 95 % 25.7, 99 % 26.9 | general truths 9: data 336.0, 0.3, 2656.7, 98.1, 0.3, 12.0, 14.3, 380.6, 4.9; replicas median 17.5, 5 % 0.2 |

## What to try (`fam-sub.mjs`)

The verdict from a subset of the six searches; margin 14, 35 where the winner's per-line check fired; nested needs 3.84 (box), 5.99 (cylinder, ball), 25 flagged. Strategies for the user's solid s0: all six; gen (s0, its nested partner and the three general members); near (s0, its partner and the general member of the family nearest s0's a priori: box → cylinder, cylinder → box, ball → cylinder); one (s0 alone).

chi: margin 10, flagged 35, nest {"box":3.84,"cyl":5.99,"ball":5.99}, chosen: true
| strategy | searches a fit | right / not determined / wrong | clean | error | n.d. with the truth among those within | determined and the solid itself right | verdict as all six |
nested (gen, the right family): special truths given the special 20, the general 2 [sqbox-Pmmm-generic 6.4; spheroid-P-1-generic 517.5 po]; general truths given the general 19, the special 7 [box-Pm-3-near 10.0; ellcyl-P4mmm-generic 2.7; ellcyl-P6m-generic 2.6; ellcyl-Pm-3m-generic 4.5; ellipsoid-Pmmm-generic 0.3; ellipsoid-P-3m1-on 0.3; ellipsoid-P6mmm-generic 14.3]
| all | 6.0 | 29 / 33 / 4 | 21 / 12 / 0 | 8 / 21 / 4 | 30/33 | 26 | 66/66 |
| gen | 4.0 | 29 / 33 / 4 | 21 / 12 / 0 | 8 / 21 / 4 | 30/33 | 26 | 66/66 |
| near | 3.0 | 31 / 30 / 5 | 21 / 12 / 0 | 10 / 18 / 5 | 30/30 | 27 | 60/66 |
| one | 1.0 | 66 / 0 / 0 | 33 / 0 / 0 | 33 / 0 / 0 | 0/0 | 66 | 29/66 |
chi: margin 14, flagged 35, nest {"box":3.84,"cyl":5.99,"ball":5.99}, chosen: true
| strategy | searches a fit | right / not determined / wrong | clean | error | n.d. with the truth among those within | determined and the solid itself right | verdict as all six |
nested (gen, the right family): special truths given the special 20, the general 2 [sqbox-Pmmm-generic 6.4; spheroid-P-1-generic 517.5 po]; general truths given the general 19, the special 7 [box-Pm-3-near 10.0; ellcyl-P4mmm-generic 2.7; ellcyl-P6m-generic 2.6; ellcyl-Pm-3m-generic 4.5; ellipsoid-Pmmm-generic 0.3; ellipsoid-P-3m1-on 0.3; ellipsoid-P6mmm-generic 14.3]
| all | 6.0 | 26 / 37 / 3 | 19 / 14 / 0 | 7 / 23 / 3 | 34/37 | 23 | 66/66 |
| gen | 4.0 | 26 / 37 / 3 | 19 / 14 / 0 | 7 / 23 / 3 | 34/37 | 23 | 66/66 |
| near | 3.0 | 28 / 34 / 4 | 19 / 14 / 0 | 9 / 20 / 4 | 34/34 | 24 | 60/66 |
| one | 1.0 | 66 / 0 / 0 | 33 / 0 / 0 | 33 / 0 / 0 | 0/0 | 66 | 26/66 |
bic: margin 10, flagged 35, nest {"box":3.84,"cyl":5.99,"ball":5.99}, chosen: true
| strategy | searches a fit | right / not determined / wrong | clean | error | n.d. with the truth among those within | determined and the solid itself right | verdict as all six |
nested (gen, the right family): special truths given the special 22, the general 3 [sqbox-Pmmm-generic 6.4; spheroid-P-1-generic 517.5 po; spheroid-P6m-on 19.8 sizedist]; general truths given the general 18, the special 9 [box-P6m-generic 2.8; box-Pm-3-near 10.0; ellcyl-P4mmm-generic 2.7; ellcyl-P6m-generic 2.6; ellcyl-Pm-3m-generic 4.5; ellipsoid-Pmmm-generic 0.3; ellipsoid-P-3m1-on 0.3; ellipsoid-P6mmm-generic 14.3; ellipsoid-Pm-3m-near 4.9]
| all | 6.0 | 33 / 29 / 4 | 24 / 9 / 0 | 9 / 20 / 4 | 27/29 | 29 | 66/66 |
| gen | 4.0 | 39 / 23 / 4 | 28 / 5 / 0 | 11 / 18 / 4 | 21/23 | 31 | 58/66 |
| near | 3.0 | 42 / 20 / 4 | 28 / 5 / 0 | 14 / 15 / 4 | 20/20 | 33 | 51/66 |
| one | 1.0 | 66 / 0 / 0 | 33 / 0 / 0 | 33 / 0 / 0 | 0/0 | 66 | 33/66 |
chi: margin 14, flagged 35, nest {"box":3.84,"cyl":5.99,"ball":5.99}, chosen: any
| strategy | searches a fit | right / not determined / wrong | clean | error | n.d. with the truth among those within | determined and the solid itself right | verdict as all six |
| all | 6.0 | 156 / 222 / 18 | 114 / 84 / 0 | 42 / 138 / 18 | 204/222 | 138 | 396/396 |
| gen | 4.0 | 156 / 218 / 22 | 114 / 84 / 0 | 42 / 134 / 22 | 200/218 | 94 | 388/396 |
| near | 3.0 | 130 / 172 / 94 | 84 / 62 / 52 | 46 / 110 / 42 | 118/172 | 86 | 250/396 |
| one | 1.0 | 132 / 2 / 262 | 66 / 2 / 130 | 66 / 0 / 132 | 2/2 | 66 | 58/396 |

## Per row (one margin, χ² and BIC; nested Δ = special − general in each family; spheroid − sphere)

| row | error | flag | win (by) χ² | margin χ² | true margin χ² | win BIC | margin BIC | nested Δ (box, cyl, ball) | spheroid − sphere |
|---|---|---|---|---|---|---|---|---|---|
| box-P-1-near | — |  | box (box) | 26.0 | 26.0 | box (box) | 26.0 | 638.3, 655.7, 712.0 | 5102.9 |
| box-P2m-generic | air 0.17 |  | box (box) | 11.5 | 11.5 | box (box) | 11.5 | 130.4, 183.6, 98.8 | 1021.9 |
| box-Pmmm-on | po 0.06 | F | cyl (ellcyl) | 4.2 | -4.2 | cyl (ellcyl) | 4.2 | 745.0, 1092.7, 916.2 | 3351.2 |
| box-P4m-near | — |  | box (box) | 21.8 | 21.8 | box (box) | 21.8 | 475.3, 468.9, 243.0 | 5912.5 |
| box-P4mmm-generic | — |  | box (box) | 33.6 | 33.6 | box (box) | 33.6 | 389.9, 422.4, 421.2 | 7886.9 |
| box-P-3-on | sizedist 0.12 |  | cyl (ellcyl) | 0.9 | -0.9 | cyl (ellcyl) | 0.9 | 15.6, 9.6, 3.1 | 8785.6 |
| box-P-3m1-near | — |  | box (box) | 3.5 | 3.5 | cyl (cylinder) | 1.4 | 9.9, 3.3, 0.0 | 291.2 |
| box-P6m-generic | — |  | cyl (ellcyl) | 0.4 | -0.4 | cyl (cylinder) | 4.8 | 2.8, 7.6, 1.3 | 577.5 |
| box-P6mmm-on | impurity 0.57 | F | box (box) | 12.5 | 12.5 | box (box) | 12.5 | 562.2, 152.0, 160.8 | 1761.8 |
| box-Pm-3-near | impurity 0.76 | F | box (box) | 20.0 | 20.0 | box (box) | 2.5 | 10.0, 1.0, -0.0 | 576.6 |
| box-Pm-3m-generic | hump 0.64 | F | cyl (ellcyl) | 26.5 | -32.7 | cyl (ellcyl) | 5.1 | 230.0, 190.7, 92.3 | 1209.2 |
| sqbox-P-1-on | sizedist 0.19 |  | cyl (ellcyl) | 13.1 | -13.1 | box (box) | 13.3 | -1.2, 101.1, 6.4 | 6911.4 |
| sqbox-P2m-near | — |  | box (box) | 213.9 | 213.9 | box (sqbox) | 222.9 | 0.1, 263.7, 12.4 | 6164.2 |
| sqbox-Pmmm-generic | — |  | box (box) | 131.0 | 131.0 | box (sqbox) | 133.8 | 6.4, 37.5, 18.8 | 83.0 |
| sqbox-P4m-on | air 0.81 | F | cyl (ellcyl) | 11.5 | -11.5 | cyl (cylinder) | 4.9 | -3.2, 6.6, 4.8 | 46.2 |
| sqbox-P4mmm-near | — |  | box (box) | 23.0 | 23.0 | box (sqbox) | 32.2 | 0.0, 45.9, 5.4 | 7779.9 |
| sqbox-P-3-generic | hump 0.84 | F | box (box) | 3.2 | 3.2 | box (sqbox) | 6.1 | 6.2, 18.7, 1.6 | 244.8 |
| sqbox-P-3m1-on | po 0.70 | F | cyl (ellcyl) | 16.8 | -16.8 | cyl (ellcyl) | 40.1 | 4.9, 20.9, 10.6 | 868.3 |
| sqbox-P6m-near | — |  | box (box) | 37.0 | 37.0 | box (sqbox) | 45.8 | 0.4, 18.4, 1.7 | 89.2 |
| sqbox-P6mmm-generic | impurity 0.95 | F | box (sqbox) | 0.1 | 0.1 | box (sqbox) | 9.3 | -0.3, 18.9, 3.6 | 534.4 |
| sqbox-Pm-3-on | — |  | box (box) | 240.7 | 240.7 | box (sqbox) | 249.9 | 0.0, 29.6, 0.0 | -0.3 |
| sqbox-Pm-3m-near | — |  | box (box) | 31.8 | 31.8 | box (sqbox) | 22.6 | 0.1, 0.0, 1.5 | 639.7 |
| cylinder-P-1-generic | — |  | cyl (ellcyl) | 12.5 | 12.5 | cyl (cylinder) | 28.8 | 7.2, 0.1, 0.5 | 7570.4 |
| cylinder-P2m-on | impurity 0.63 | F | cyl (ellcyl) | 4.6 | 4.6 | cyl (cylinder) | 31.3 | 3.4, 4.3, 1.5 | 2397.8 |
| cylinder-Pmmm-near | — |  | box (box) | 2.4 | -2.4 | cyl (ellcyl) | 16.9 | 2.5, -1.6, 13.2 | 1206.8 |
| cylinder-P4m-generic | — |  | cyl (ellcyl) | 35.8 | 35.8 | cyl (cylinder) | 46.8 | 1.8, 0.0, 2.2 | 1852.0 |
| cylinder-P4mmm-on | — |  | cyl (ellcyl) | 287.9 | 287.9 | cyl (cylinder) | 323.8 | 12.7, 1.0, -0.9 | 1126.2 |
| cylinder-P-3-near | — |  | cyl (ellcyl) | 0.7 | 0.7 | cyl (cylinder) | 11.4 | 4.1, 2.6, 22.2 | 2666.1 |
| cylinder-P-3m1-generic | po 0.92 | F | ball (ellipsoid) | 1.5 | -1.5 | ball (spheroid) | 14.5 | 4.0, 37.9, 5.5 | 193.7 |
| cylinder-P6m-on | — |  | cyl (ellcyl) | 9.3 | 9.3 | cyl (cylinder) | 9.8 | 4.6, 3.4, 0.1 | 52.7 |
| cylinder-P6mmm-near | air 0.32 |  | cyl (ellcyl) | 16.1 | 16.1 | cyl (cylinder) | 5.4 | 0.5, 1.5, 10.6 | 1127.2 |
| cylinder-Pm-3-generic | hump 0.57 | F | box (box) | 205.5 | -205.5 | box (sqbox) | 205.6 | 9.1, 125.7, 34.0 | 1310.3 |
| cylinder-Pm-3m-on | sizedist 0.72 | F | ball (ellipsoid) | 302.5 | -302.5 | ball (spheroid) | 283.5 | 106.1, 1880.1, 9.9 | 6935.9 |
| ellcyl-P-1-near | po 0.82 | F | cyl (ellcyl) | 7.2 | 7.2 | cyl (ellcyl) | 7.2 | 117.2, 137.2, 117.5 | 5214.9 |
| ellcyl-P2m-generic | — |  | cyl (ellcyl) | 31.8 | 31.8 | cyl (ellcyl) | 31.8 | 604.2, 903.0, 732.0 | 6795.2 |
| ellcyl-Pmmm-on | air 0.13 |  | cyl (ellcyl) | 16.4 | 16.4 | cyl (ellcyl) | 44.0 | 15.7, 11.8, 92.2 | 541.4 |
| ellcyl-P4m-near | sizedist 0.26 | F | cyl (ellcyl) | 590.6 | 590.6 | cyl (ellcyl) | 590.6 | 166.1, 1614.9, 164.5 | 7070.8 |
| ellcyl-P4mmm-generic | hump 0.06 |  | cyl (ellcyl) | 0.8 | 0.8 | cyl (cylinder) | 7.5 | 0.1, 2.7, 2.4 | 853.9 |
| ellcyl-P-3-on | impurity 0.28 | F | cyl (ellcyl) | 40.9 | 40.9 | cyl (ellcyl) | 68.6 | 59.8, 142.8, 5.5 | 1331.8 |
| ellcyl-P-3m1-near | sizedist 0.93 | F | ball (ellipsoid) | 76.6 | -76.6 | ball (spheroid) | 94.3 | 24.2, 396.6, 0.8 | 2926.7 |
| ellcyl-P6m-generic | — |  | cyl (ellcyl) | 0.3 | 0.3 | cyl (cylinder) | 9.8 | 2.9, 2.6, 20.7 | 1194.9 |
| ellcyl-P6mmm-on | — |  | cyl (ellcyl) | 40.4 | 40.4 | cyl (ellcyl) | 42.7 | 203.6, 251.8, 386.8 | 9264.3 |
| ellcyl-Pm-3-near | — |  | cyl (ellcyl) | 7.8 | 7.8 | ball (ellipsoid) | 8.3 | 59.4, 71.6, 57.5 | 641.1 |
| ellcyl-Pm-3m-generic | — |  | cyl (ellcyl) | 4.3 | 4.3 | cyl (cylinder) | 9.2 | 0.2, 4.5, 40.9 | 739.5 |
| ellipsoid-P-1-on | — |  | ball (ellipsoid) | 34.3 | 34.3 | ball (ellipsoid) | 34.3 | 71.1, 121.3, 117.6 | 6247.9 |
| ellipsoid-P2m-near | — |  | ball (ellipsoid) | 18.4 | 18.4 | ball (ellipsoid) | 46.0 | 272.9, 323.4, 336.0 | 7061.0 |
| ellipsoid-Pmmm-generic | — |  | ball (ellipsoid) | 15.1 | 15.1 | ball (spheroid) | 33.2 | 11.8, 56.8, 0.3 | 2367.4 |
| ellipsoid-P4m-on | hump 0.29 | F | ball (ellipsoid) | 8.7 | 8.7 | ball (ellipsoid) | 36.3 | 120.4, 2570.6, 2656.7 | 4577.5 |
| ellipsoid-P4mmm-near | sizedist 0.49 | F | ball (ellipsoid) | 34.2 | 34.2 | ball (ellipsoid) | 34.2 | 81.1, 204.8, 70.1 | 8834.0 |
| ellipsoid-P-3-generic | impurity 0.73 | F | cyl (ellcyl) | 5.3 | -5.3 | cyl (ellcyl) | 32.9 | 73.7, 172.3, 98.1 | 747.9 |
| ellipsoid-P-3m1-on | — |  | ball (ellipsoid) | 9.4 | 9.4 | ball (spheroid) | 45.9 | 83.9, 186.3, 0.3 | 2421.0 |
| ellipsoid-P6m-near | — |  | ball (ellipsoid) | 1.4 | 1.4 | ball (ellipsoid) | 1.4 | 3.7, 13.3, 12.0 | 893.4 |
| ellipsoid-P6mmm-generic | air 0.94 | F | ball (ellipsoid) | 23.4 | 23.4 | ball (spheroid) | 27.6 | 0.9, 28.4, 14.3 | 1835.6 |
| ellipsoid-Pm-3-on | po 0.23 |  | ball (ellipsoid) | 15.8 | 15.8 | ball (ellipsoid) | 15.8 | 341.3, 352.1, 380.6 | 2926.2 |
| ellipsoid-Pm-3m-near | — |  | cyl (ellcyl) | 1.5 | -1.5 | ball (spheroid) | 2.6 | 4.7, 9.0, 4.9 | 31.5 |
| spheroid-P-1-generic | po 0.50 | F | ball (ellipsoid) | 71.4 | 71.4 | ball (ellipsoid) | 71.4 | 14.1, 553.8, 517.5 | 2869.9 |
| spheroid-P2m-on | impurity 0.85 | F | cyl (ellcyl) | 22.5 | -77.7 | cyl (ellcyl) | 22.5 | 22.1, 68.7, 28.7 | 5363.2 |
| spheroid-Pmmm-near | air 0.97 |  | ball (ellipsoid) | 102.8 | 102.8 | ball (spheroid) | 139.6 | 4.5, 175.8, 0.0 | 3256.5 |
| spheroid-P4m-generic | — |  | ball (spheroid) | 21.5 | 21.5 | ball (ellipsoid) | 28.7 | 0.1, 3.9, -5.9 | 67.3 |
| spheroid-P4mmm-on | hump 0.78 | F | cyl (ellcyl) | 4.3 | -42.0 | cyl (cylinder) | 9.9 | 8.0, 11.5, 5.2 | 7539.9 |
| spheroid-P-3-near | — |  | ball (spheroid) | 10.3 | 10.3 | ball (spheroid) | 30.7 | -1.8, 1.9, -0.0 | 52.5 |
| spheroid-P-3m1-generic | — |  | ball (ellipsoid) | 79.4 | 79.4 | ball (spheroid) | 97.8 | 151.7, 599.6, 0.1 | 6978.7 |
| spheroid-P6m-on | sizedist 0.84 |  | cyl (ellcyl) | 9.8 | -9.8 | ball (spheroid) | 7.2 | 6.0, 26.4, 19.8 | 255.2 |
| spheroid-P6mmm-near | hump 0.44 | F | cyl (ellcyl) | 18.0 | -44.9 | cyl (ellcyl) | 15.4 | 6.6, 65.3, 2.3 | 1964.2 |
| spheroid-Pm-3-generic | — |  | ball (spheroid) | 4.3 | 4.3 | ball (ellipsoid) | 1.5 | 5.0, 5.3, -2.7 | 520.5 |
| spheroid-Pm-3m-on | — |  | ball (ellipsoid) | 42.7 | 42.7 | ball (spheroid) | 79.5 | 5.3, 115.9, 0.0 | 2940.6 |
| sphere-P-1-2 | — |  | ball (ellipsoid) | 745.5 | 745.5 | ball (spheroid) | 750.7 | 38.3, 7.8, 2.6 | 18.5 |
| sphere-P2m-3 | — |  | cyl (ellcyl) | 4.8 | -4.8 | ball (sphere) | 19.6 | 2.0, 2.5, 1.5 | 4.2 |
| sphere-Pmmm-1 | — |  | ball (ellipsoid) | 172.0 | 172.0 | ball (sphere) | 181.2 | 2.2, 1.7, 1.2 | 0.5 |
| sphere-P4m-2 | — |  | ball (ellipsoid) | 222.3 | 222.3 | ball (sphere) | 239.2 | 30.2, 11.0, 1.1 | 0.5 |
| sphere-P4mmm-3 | air 0.02 | F | ball (ellipsoid) | 46.0 | 46.0 | ball (sphere) | 59.1 | -2.1, 6.5, 2.5 | 0.1 |
| sphere-P-3-1 | — |  | ball (ellipsoid) | 144.0 | 144.0 | ball (sphere) | 159.5 | 15.5, 29.7, 2.4 | 0.5 |
| sphere-P-3m1-2 | — |  | ball (ellipsoid) | 39.4 | 39.4 | ball (sphere) | 48.0 | 13.8, 8.3, 0.1 | 8.9 |
| sphere-P6m-3 | impurity 0.14 | F | ball (ellipsoid) | 6.2 | 6.2 | ball (sphere) | 17.0 | 1.1, -3.7, 1.2 | 7.3 |
| sphere-P6mmm-1 | po 0.59 | F | cyl (ellcyl) | 53.8 | -70.0 | cyl (ellcyl) | 60.8 | 2.8, 25.0, 0.0 | 381.1 |
| sphere-Pm-3-2 | hump 0.11 | F | ball (spheroid) | 272.7 | 272.7 | ball (sphere) | 282.3 | -21.7, 0.7, -0.0 | 0.3 |
| sphere-Pm-3m-3 | sizedist 0.71 |  | ball (ellipsoid) | 13.7 | 13.7 | ball (ellipsoid) | 13.7 | 50.2, 180.2, 172.1 | 3510.7 |
