# Step 6: the tunables on the 154 tuning runs

Read by `../scripts/step6/` from the records in `$W/fs2/step6/results/` (P: the prototype at its defaults; SC, SY, MX, RD: the variants on the rows a setting can change; FAM: the 4-search family comparison on the 66 tuning truths outside the screening set). `../CONFIRM.md` reads them.

## Δ* and κ (sweep6.mjs)

| rows | Δ* (flagged) | κ | extents covered C | J | median half-width C | axes C, κA 1 / 1.2 / 1.5 | unique | unique and C covers all |
|---|---|---|---|---|---|---|---|---|
| clean (not flagged) (66) | 12.5 (25) | 1 | 150/165 (91 %) | 150 | 2.4 % | 59 / 61 / 62 of 65 | 46/66 | 36 |
| clean (not flagged) (66) | 12.5 (25) | 1.1 | 152/165 (92 %) | 152 | 2.7 % | 59 / 61 / 62 of 65 | 46/66 | 38 |
| clean (not flagged) (66) | 12.5 (25) | 1.2 | 155/165 (94 %) | 155 | 2.9 % | 59 / 61 / 62 of 65 | 46/66 | 40 |
| clean (not flagged) (66) | 12.5 (25) | 1.3 | 157/165 (95 %) | 157 | 3.2 % | 59 / 61 / 62 of 65 | 46/66 | 41 |
| clean (not flagged) (66) | 12.5 (25) | 1.5 | 159/165 (96 %) | 159 | 3.6 % | 59 / 61 / 62 of 65 | 46/66 | 41 |
| clean (not flagged) (66) | 16 (25) | 1 | 150/165 (91 %) | 150 | 2.4 % | 59 / 61 / 62 of 65 | 45/66 | 36 |
| clean (not flagged) (66) | 16 (25) | 1.1 | 152/165 (92 %) | 152 | 2.7 % | 59 / 61 / 62 of 65 | 45/66 | 38 |
| clean (not flagged) (66) | 16 (25) | 1.2 | 155/165 (94 %) | 155 | 2.9 % | 59 / 61 / 62 of 65 | 45/66 | 39 |
| clean (not flagged) (66) | 16 (25) | 1.3 | 157/165 (95 %) | 157 | 3.2 % | 59 / 61 / 62 of 65 | 45/66 | 40 |
| clean (not flagged) (66) | 16 (25) | 1.5 | 159/165 (96 %) | 159 | 3.6 % | 59 / 61 / 62 of 65 | 45/66 | 40 |
| clean (not flagged) (66) | 20 (25) | 1 | 150/165 (91 %) | 150 | 2.4 % | 59 / 61 / 62 of 65 | 42/66 | 33 |
| clean (not flagged) (66) | 20 (25) | 1.1 | 152/165 (92 %) | 152 | 2.7 % | 59 / 61 / 62 of 65 | 42/66 | 35 |
| clean (not flagged) (66) | 20 (25) | 1.2 | 155/165 (94 %) | 155 | 2.9 % | 59 / 61 / 62 of 65 | 42/66 | 36 |
| clean (not flagged) (66) | 20 (25) | 1.3 | 157/165 (95 %) | 157 | 3.2 % | 59 / 61 / 62 of 65 | 42/66 | 37 |
| clean (not flagged) (66) | 20 (25) | 1.5 | 159/165 (96 %) | 159 | 3.6 % | 59 / 61 / 62 of 65 | 42/66 | 37 |
| clean (not flagged) (66) | 25 (25) | 1 | 152/165 (92 %) | 152 | 2.5 % | 59 / 61 / 62 of 65 | 41/66 | 33 |
| clean (not flagged) (66) | 25 (25) | 1.1 | 154/165 (93 %) | 154 | 2.7 % | 59 / 61 / 62 of 65 | 41/66 | 35 |
| clean (not flagged) (66) | 25 (25) | 1.2 | 157/165 (95 %) | 157 | 3.0 % | 59 / 61 / 62 of 65 | 41/66 | 36 |
| clean (not flagged) (66) | 25 (25) | 1.3 | 158/165 (96 %) | 158 | 3.2 % | 59 / 61 / 62 of 65 | 41/66 | 37 |
| clean (not flagged) (66) | 25 (25) | 1.5 | 159/165 (96 %) | 159 | 3.7 % | 59 / 61 / 62 of 65 | 41/66 | 37 |
| error, not flagged (16) | 12.5 (25) | 1 | 25/37 (68 %) | 25 | 5.6 % | 12 / 13 / 13 of 16 | 11/16 | 5 |
| error, not flagged (16) | 12.5 (25) | 1.1 | 25/37 (68 %) | 25 | 6.2 % | 12 / 13 / 13 of 16 | 11/16 | 5 |
| error, not flagged (16) | 12.5 (25) | 1.2 | 25/37 (68 %) | 25 | 6.7 % | 12 / 13 / 13 of 16 | 11/16 | 5 |
| error, not flagged (16) | 12.5 (25) | 1.3 | 27/37 (73 %) | 27 | 7.3 % | 12 / 13 / 13 of 16 | 11/16 | 6 |
| error, not flagged (16) | 12.5 (25) | 1.5 | 29/37 (78 %) | 29 | 8.4 % | 12 / 13 / 13 of 16 | 11/16 | 6 |
| error, not flagged (16) | 16 (25) | 1 | 26/37 (70 %) | 26 | 6.1 % | 12 / 13 / 13 of 16 | 11/16 | 5 |
| error, not flagged (16) | 16 (25) | 1.1 | 26/37 (70 %) | 26 | 6.8 % | 12 / 13 / 13 of 16 | 11/16 | 5 |
| error, not flagged (16) | 16 (25) | 1.2 | 26/37 (70 %) | 26 | 7.4 % | 12 / 13 / 13 of 16 | 11/16 | 5 |
| error, not flagged (16) | 16 (25) | 1.3 | 28/37 (76 %) | 28 | 7.7 % | 12 / 13 / 13 of 16 | 11/16 | 6 |
| error, not flagged (16) | 16 (25) | 1.5 | 30/37 (81 %) | 30 | 8.5 % | 12 / 13 / 13 of 16 | 11/16 | 6 |
| error, not flagged (16) | 20 (25) | 1 | 26/37 (70 %) | 26 | 6.1 % | 12 / 13 / 13 of 16 | 11/16 | 5 |
| error, not flagged (16) | 20 (25) | 1.1 | 26/37 (70 %) | 26 | 6.8 % | 12 / 13 / 13 of 16 | 11/16 | 5 |
| error, not flagged (16) | 20 (25) | 1.2 | 26/37 (70 %) | 26 | 7.4 % | 12 / 13 / 13 of 16 | 11/16 | 5 |
| error, not flagged (16) | 20 (25) | 1.3 | 28/37 (76 %) | 28 | 7.7 % | 12 / 13 / 13 of 16 | 11/16 | 6 |
| error, not flagged (16) | 20 (25) | 1.5 | 30/37 (81 %) | 30 | 8.5 % | 12 / 13 / 13 of 16 | 11/16 | 6 |
| error, not flagged (16) | 25 (25) | 1 | 26/37 (70 %) | 26 | 6.1 % | 12 / 13 / 13 of 16 | 11/16 | 5 |
| error, not flagged (16) | 25 (25) | 1.1 | 26/37 (70 %) | 26 | 6.8 % | 12 / 13 / 13 of 16 | 11/16 | 5 |
| error, not flagged (16) | 25 (25) | 1.2 | 26/37 (70 %) | 26 | 7.4 % | 12 / 13 / 13 of 16 | 11/16 | 5 |
| error, not flagged (16) | 25 (25) | 1.3 | 28/37 (76 %) | 28 | 7.7 % | 12 / 13 / 13 of 16 | 11/16 | 6 |
| error, not flagged (16) | 25 (25) | 1.5 | 30/37 (81 %) | 30 | 8.5 % | 12 / 13 / 13 of 16 | 11/16 | 6 |
| flagged (49) | 16 (25) | 1 | 57/117 (49 %) | 100 | 3.1 % | 26 / 27 / 29 of 49 | 36/49 | 8 |
| flagged (49) | 16 (25) | 1.1 | 58/117 (50 %) | 100 | 3.4 % | 26 / 27 / 29 of 49 | 36/49 | 8 |
| flagged (49) | 16 (25) | 1.2 | 58/117 (50 %) | 100 | 3.8 % | 26 / 27 / 29 of 49 | 36/49 | 8 |
| flagged (49) | 16 (25) | 1.3 | 60/117 (51 %) | 101 | 4.1 % | 26 / 27 / 29 of 49 | 36/49 | 10 |
| flagged (49) | 16 (25) | 1.5 | 65/117 (56 %) | 101 | 4.7 % | 26 / 27 / 29 of 49 | 36/49 | 11 |
| flagged (49) | 16 (16) | 1 | 57/117 (49 %) | 100 | 3.1 % | 26 / 27 / 29 of 49 | 36/49 | 8 |
| flagged (49) | 16 (16) | 1.1 | 58/117 (50 %) | 100 | 3.4 % | 26 / 27 / 29 of 49 | 36/49 | 8 |
| flagged (49) | 16 (16) | 1.2 | 58/117 (50 %) | 100 | 3.8 % | 26 / 27 / 29 of 49 | 36/49 | 8 |
| flagged (49) | 16 (16) | 1.3 | 60/117 (51 %) | 101 | 4.1 % | 26 / 27 / 29 of 49 | 36/49 | 10 |
| flagged (49) | 16 (16) | 1.5 | 65/117 (56 %) | 101 | 4.7 % | 26 / 27 / 29 of 49 | 36/49 | 11 |
| flagged (49) | 16 (35) | 1 | 57/117 (49 %) | 100 | 3.1 % | 27 / 28 / 30 of 49 | 35/49 | 8 |
| flagged (49) | 16 (35) | 1.1 | 58/117 (50 %) | 100 | 3.4 % | 27 / 28 / 30 of 49 | 35/49 | 8 |
| flagged (49) | 16 (35) | 1.2 | 58/117 (50 %) | 100 | 3.8 % | 27 / 28 / 30 of 49 | 35/49 | 8 |
| flagged (49) | 16 (35) | 1.3 | 60/117 (51 %) | 101 | 4.1 % | 27 / 28 / 30 of 49 | 35/49 | 10 |
| flagged (49) | 16 (35) | 1.5 | 65/117 (56 %) | 101 | 4.7 % | 27 / 28 / 30 of 49 | 35/49 | 11 |

## SC: the start cut: four random starts (PROTO_FILL=4) on the 10 rows whose isotropic fit read no size (cmp6.mjs)

| row | error | outcome ref → SC | Δχ² (χ²_ν) | solid changed | worst ref → var | minima ≤ Δ* | covered E (extents, axis) ref → var | search ev ref → var (stage) |
|---|---|---|---|---|---|---|---|---|
| box-Pmmm-near | po | free → free | 0.00 |  | +∞ → +∞ | 1 → 1 | 3/3, ax → 3/3, ax | 6361 → 6852 (834 → 834) |
| box-P-3m1-near | none | free → free | 0.00 |  | +191 % → +191 % | 2 → 2 | 3/3, ax → 3/3, ax | 7492 → 7771 (6034 → 5939) |
| sqbox-P4mmm-near | none | free → free | 0.00 |  | +1 % → +1 % | 1 → 1 | 2/2, ax → 2/2, ax | 3605 → 4056 (1214 → 1214) |
| cylinder-P-3m1-on | none | held → held | 0.00 |  | +0 % → +0 % | 1 → 1 | 2/2, ax → 2/2, ax | 2220 → 2580 (640 → 640) |
| ellcyl-Pmmm-near | hump | free → free | -45.91 | -40 %, -6 %, +64 %; 11.5° | +7 % → +65 % | 1 → 1 | 3/3, · → 1/3, ax | 6853 → 4201 (4041 → 333) |
| ellipsoid-Pmmm-on | hump | held → held | 0.00 |  | +7 % → +7 % | 1 → 1 | 2/3, ax → 2/3, ax | 7030 → 6976 (2910 → 3825) |
| ellipsoid-P4m-on | hump | held → held | 0.00 |  | +1 % → +1 % | 1 → 1 | 3/3, ax → 3/3, ax | 3470 → 3771 (761 → 761) |
| ellipsoid-P4mmm-near | sizedist | free → free | 0.00 |  | +∞ → +∞ | 1 → 1 | 2/3, ax → 2/3, ax | 2958 → 3448 (460 → 460) |
| ellipsoid-Pm-3-on | po | held → held | 0.00 |  | +3 % → +3 % | 1 → 1 | 3/3, ax → 3/3, ax | 3477 → 3869 (1297 → 1297) |
| spheroid-P-3m1-on | none | held → held | 0.00 |  | +1 % → +1 % | 2 → 2 | 2/2, ax → 2/2, ax | 1457 → 1845 (432 → 432) |

SC against P on 10 rows: outcome changed 0; returned χ² lower by more than 0.1 χ²_ν on 1, higher on 0; solid changed 1; search evaluations 44923 → 45369 (1.010×), the stage's 18623 → 15735 (0.845×); extents and axes covered 34 → 33 of 37.

## SY: the start cut: the starts' width floored at the instrument's FWHM at mid-range (PROTO_Y0F=1), the same rows (cmp6.mjs)

| row | error | outcome ref → SY | Δχ² (χ²_ν) | solid changed | worst ref → var | minima ≤ Δ* | covered E (extents, axis) ref → var | search ev ref → var (stage) |
|---|---|---|---|---|---|---|---|---|
| box-Pmmm-near | po | free → free | -0.39 |  | +∞ → +∞ | 1 → 1 | 3/3, ax → 3/3, ax | 6361 → 4116 (834 → 470) |
| box-P-3m1-near | none | free → free | -0.05 | +14 %, +0 %, +0 %; 0.3° | +191 % → +231 % | 2 → 3 | 3/3, ax → 3/3, ax | 7492 → 6466 (6034 → 4848) |
| sqbox-P4mmm-near | none | free → free | -0.00 |  | +1 % → +1 % | 1 → 1 | 2/2, ax → 2/2, ax | 3605 → 3511 (1214 → 1013) |
| cylinder-P-3m1-on | none | held → held | 0.00 |  | +0 % → +0 % | 1 → 1 | 2/2, ax → 2/2, ax | 2220 → 2562 (640 → 1211) |
| ellcyl-Pmmm-near | hump | free → free | -3.06 |  | +7 % → +5 % | 1 → 1 | 3/3, · → 3/3, ax | 6853 → 3635 (4041 → 1172) |
| ellipsoid-Pmmm-on | hump | held → held | 0.00 |  | +7 % → +7 % | 1 → 1 | 2/3, ax → 2/3, ax | 7030 → 5947 (2910 → 3590) |
| ellipsoid-P4m-on | hump | held → held | 0.00 |  | +1 % → +1 % | 1 → 1 | 3/3, ax → 3/3, ax | 3470 → 3914 (761 → 691) |
| ellipsoid-P4mmm-near | sizedist | free → free | -0.00 |  | +∞ → +∞ | 1 → 1 | 2/3, ax → 2/3, ax | 2958 → 3103 (460 → 461) |
| ellipsoid-Pm-3-on | po | held → held | -0.00 |  | +3 % → +3 % | 1 → 1 | 3/3, ax → 3/3, ax | 3477 → 4486 (1297 → 2817) |
| spheroid-P-3m1-on | none | held → held | 0.00 |  | +1 % → +1 % | 2 → 2 | 2/2, ax → 2/2, ax | 1457 → 1457 (432 → 432) |

SY against P on 10 rows: outcome changed 0; returned χ² lower by more than 0.1 χ²_ν on 2, higher on 0; solid changed 1; search evaluations 44923 → 39197 (0.873×), the stage's 18623 → 16705 (0.897×); extents and axes covered 34 → 35 of 37.

## MX: the minima stage with max 3, on the 22 rows whose stage took more than 3 candidates (cmp6.mjs)

| row | error | outcome ref → MX | Δχ² (χ²_ν) | solid changed | worst ref → var | minima ≤ Δ* | covered E (extents, axis) ref → var | search ev ref → var (stage) |
|---|---|---|---|---|---|---|---|---|
| box-P4m-generic | none | held → held | 0.00 |  | +82 % → +82 % | 1 → 1 | 3/3, ax → 3/3, ax | 4098 → 2901 (2421 → 1224) |
| box-P-3-on | sizedist | held → held | 0.00 |  | +7 % → +7 % | 5 → 3 | 3/3, ax → 2/3, ax | 6404 → 5215 (3257 → 2068) |
| box-P-3m1-near | none | free → free | 0.39 | -70 %, +7 %, +5 %; 20.4° | +191 % → +12 % | 2 → 2 | 3/3, ax → 2/3, ax | 7492 → 4620 (6034 → 3163) |
| box-P6m-generic | none | free → free | 0.00 |  | +36 % → +36 % | 2 → 2 | 3/3, · → 3/3, · | 8794 → 5084 (7087 → 3377) |
| sqbox-P-1-near | impurity | free → free | 0.00 |  | +2 % → +2 % | 4 → 3 | 2/2, ax → 2/2, ax | 5250 → 4191 (2916 → 1857) |
| sqbox-P-3m1-on | po | free → free | 0.00 |  | +30 % → +30 % | 2 → 2 | 1/2, · → 1/2, · | 7210 → 5074 (4795 → 2659) |
| cylinder-P-3m1-generic | po | held → held | 0.00 |  | +34 % → +34 % | 4 → 2 | 2/2, ax → 2/2, ax | 4084 → 3019 (2847 → 1782) |
| cylinder-P6m-near | air | held → held | 0.00 |  | +12 % → +12 % | 3 → 2 | 1/2, ax → 1/2, ax | 2412 → 2103 (1430 → 1121) |
| ellcyl-P-3m1-generic | none | held → held | 0.00 |  | +4 % → +4 % | 2 → 1 | 3/3, ax → 3/3, ax | 4467 → 4162 (3034 → 2729) |
| ellcyl-Pm-3-near | none | free → free | 0.00 |  | +1 % → +1 % | 2 → 2 | 3/3, ax → 3/3, ax | 7403 → 6564 (4652 → 3813) |
| ellcyl-Pm-3-generic | none | free → free | 0.00 |  | +84 % → +84 % | 2 → 2 | 3/3, ax → 3/3, ax | 9566 → 5579 (7668 → 3681) |
| ellipsoid-P4m-near | none | free → free | 0.00 |  | +8 % → +8 % | 2 → 2 | 3/3, ax → 3/3, ax | 3239 → 2486 (1627 → 874) |
| ellipsoid-P-3-generic | impurity | free → free | 0.00 |  | +116 % → +116 % | 1 → 1 | 3/3, ax → 3/3, ax | 16279 → 10731 (14201 → 8653) |
| ellipsoid-P-3m1-on | none | held → held | 0.00 |  | +14 % → +14 % | 2 → 1 | 3/3, ax → 3/3, ax | 5691 → 3547 (4063 → 1919) |
| ellipsoid-P6m-near | none | held → held | 0.00 |  | +77 % → +77 % | 2 → 1 | 3/3, ax → 3/3, ax | 9944 → 5884 (7873 → 3813) |
| ellipsoid-P6mmm-on | none | held → held | 0.00 |  | +1 % → +1 % | 1 → 1 | 3/3, ax → 3/3, ax | 7726 → 6245 (5667 → 4186) |
| ellipsoid-Pm-3-near | air | free → free | 0.00 |  | +∞ → +∞ | 2 → 2 | 3/3, ax → 3/3, ax | 2507 → 2095 (1275 → 863) |
| ellipsoid-Pm-3m-near | none | held → held | 0.00 |  | +14 % → +14 % | 1 → 1 | 3/3, ax → 3/3, ax | 3539 → 2346 (2587 → 1394) |
| ellipsoid-Pm-3m-generic | sizedist | free → free | 0.00 |  | +125 % → +125 % | 1 → 1 | 1/3, ax → 1/3, ax | 51971 → 32696 (47813 → 28538) |
| spheroid-P4m-generic | none | free → free | 0.00 |  | +1 % → +1 % | 3 → 2 | 2/2, ax → 2/2, ax | 3961 → 2793 (2536 → 1368) |
| spheroid-P-3-near | none | held → held | 0.00 |  | +6 % → +6 % | 2 → 2 | 2/2, ax → 2/2, ax | 3037 → 2205 (1906 → 1074) |
| sphere-P6mmm-1 | po | free → free | 0.00 |  | — → — | — → — | — → — | 8060 → 5175 (6131 → 3246) |

MX against P on 22 rows: outcome changed 0; returned χ² lower by more than 0.1 χ²_ν on 0, higher on 1; solid changed 1; search evaluations 183134 → 124715 (0.681×), the stage's 141820 → 83402 (0.588×); extents and axes covered 72 → 70 of 78.

## RD: the minima stage with rounds 3, on the 5 rows where a minimum entered a fourth round (cmp6.mjs)

| row | error | outcome ref → RD | Δχ² (χ²_ν) | solid changed | worst ref → var | minima ≤ Δ* | covered E (extents, axis) ref → var | search ev ref → var (stage) |
|---|---|---|---|---|---|---|---|---|
| sqbox-P-3m1-near | hump | free → free | 0.00 |  | +9 % → +9 % | 1 → 2 | 2/2, ax → 2/2, ax | 8162 → 7879 (4790 → 4507) |
| cylinder-Pm-3m-on | sizedist | free → free | 19.49 |  | +18 % → +19 % | 1 → 1 | 2/2, ax → 1/2, ax | 6568 → 3120 (5251 → 1803) |
| ellcyl-Pmmm-near | hump | free → free | 4.92 |  | +7 % → +10 % | 1 → 1 | 3/3, · → 3/3, ax | 6853 → 4513 (4041 → 1701) |
| ellcyl-P-3m1-near | sizedist | free → free | 0.00 |  | +∞ → +∞ | 2 → 2 | 3/3, ax → 3/3, ax | 4654 → 4471 (2121 → 1938) |
| sphere-P6mmm-1 | po | free → free | 0.00 |  | — → — | — → — | — → — | 8060 → 6423 (6131 → 4494) |

RD against P on 5 rows: outcome changed 0; returned χ² lower by more than 0.1 χ²_ν on 0, higher on 2; solid changed 0; search evaluations 34297 → 26406 (0.770×), the stage's 22334 → 14443 (0.647×); extents and axes covered 13 → 13 of 14.

## FAM: the family, 66 tuning truths outside the screening set (fam6.mjs)

66 truths with a verdict (of 66 runs)

| truths | right | not determined (truth among the named) | wrong |
|---|---|---|---|
| clean (33) | 18 | 15 (15) | 0 |
| with an error (33) | 10 | 16 (16) | 7 |
| all (66) | 28 | 31 (31) | 7 |

Wrong: box-P-3-near (sizedist 0.87; cyl by 291.0, need 35); sqbox-Pm-3m-generic (po 0.55; cyl by 79.8, need 35); cylinder-P-1-on (hump 0.18; box by 63.6, need 35); ellcyl-P2m-on (sizedist 0.62; ball by 37.3, need 35); ellcyl-P6mmm-near (po 0.20; box by 90.2, need 35); ellipsoid-P6m-generic (po 0.79; cyl by 222.6, need 35); spheroid-P6mmm-generic (sizedist 0.59; cyl by 123.5, need 35).

Not determined: the winner wrong on 14 of 31; the truth not among the named on none.

Nested, the winner the truth's family (45): special truths given the special member 20 of 23; general truths given the general 17 of 22 (given the special: box-P2m-on Δ 3.3, ellcyl-P-3m1-generic Δ 1.5, ellipsoid-P2m-generic Δ 4.2, ellipsoid-P6mmm-on Δ 1.3, ellipsoid-Pm-3m-generic Δ 21.4); special truths given the general: cylinder-P-3-generic Δ 365.1, cylinder-Pm-3-on Δ 30.6, spheroid-P4mmm-near Δ 21.6.

Cost against the chosen solid's run (66): search evaluations 4.16× (median 5.13×), wall 4.37× (median 4.96×); the chosen solid's χ² equal to its run's on 66.

| row | error | verdict | family (by) | margin, need | within | solid (nested Δ, need) |
|---|---|---|---|---|---|---|
| box-P-1-generic |  | nd | box (box) | 7.1, 14 | box cyl | box (158.5, 3.84) |
| box-P2m-on |  | nd | box (box) | 12.1, 14 | box cyl | sqbox (3.3, 3.84) |
| box-Pmmm-near | po 0.39 | nd | cyl (ellcyl) | 23.4, 35 | cyl box | ellcyl |
| box-P4m-generic |  | nd | cyl (ellcyl) | 0.2, 14 | cyl box ball | ellcyl |
| box-P4mmm-on |  | right | box (box) | 65.5, 14 | box | box (8.7, 3.84) |
| box-P-3-near | sizedist 0.87 | wrong | cyl (ellcyl) | 291.0, 35 | cyl | ellcyl |
| box-P-3m1-generic | air 0.74 | nd | cyl (ellcyl) | 4.1, 35 | cyl box ball | ellcyl |
| box-P6m-on |  | right | box (box) | 91.0, 14 | box | box (506.3, 3.84) |
| box-P6mmm-near |  | right | box (box) | 28.1, 14 | box | box (5.0, 3.84) |
| box-Pm-3-generic | impurity 0.02 | nd | cyl (ellcyl) | 11.0, 35 | cyl box | ellcyl |
| box-Pm-3m-on | hump 0.24 | right | box (box) | 53.4, 35 | box | box (67.6, 25) |
| sqbox-P-1-near | impurity 0.69 | nd | cyl (ellcyl) | 1.9, 35 | cyl box | ellcyl |
| sqbox-P2m-generic | sizedist 0.40 | nd | ball (ellipsoid) | 3.3, 14 | ball cyl box | ellipsoid |
| sqbox-Pmmm-on | impurity 0.53 | right | box (box) | 66.7, 35 | box | sqbox (6.5, 25) |
| sqbox-P4m-near |  | right | box (box) | 153.8, 14 | box | sqbox (0.1, 3.84) |
| sqbox-P4mmm-generic | air 0.66 | right | box (box) | 395.1, 35 | box | sqbox (2.8, 25) |
| sqbox-P-3-on |  | right | box (box) | 28.3, 14 | box | sqbox (2.1, 3.84) |
| sqbox-P-3m1-near | hump 0.47 | nd | cyl (ellcyl) | 18.3, 35 | cyl box | ellcyl |
| sqbox-P6m-generic |  | right | box (box) | 50.6, 14 | box | sqbox (1.1, 3.84) |
| sqbox-P6mmm-on |  | nd | box (box) | 2.5, 14 | box cyl | sqbox (0.3, 3.84) |
| sqbox-Pm-3-near |  | right | box (box) | 17.5, 14 | box | sqbox (0.0, 3.84) |
| sqbox-Pm-3m-generic | po 0.55 | wrong | cyl (ellcyl) | 79.8, 35 | cyl | ellcyl |
| cylinder-P-1-on | hump 0.18 | wrong | box (box) | 63.6, 35 | box | box |
| cylinder-P2m-near |  | nd | box (box) | 2.4, 14 | box cyl ball | box |
| cylinder-Pmmm-generic |  | right | cyl (ellcyl) | 648.9, 14 | cyl | cylinder (0.9, 5.99) |
| cylinder-P4m-on |  | nd | box (box) | 1.3, 14 | box cyl | box |
| cylinder-P4mmm-near | impurity 0.90 | nd | box (box) | 2.3, 35 | box cyl | box |
| cylinder-P-3-generic | po 0.98 | nd | cyl (ellcyl) | 29.6, 35 | cyl box | ellcyl (365.1, 25) |
| cylinder-P-3m1-on |  | nd | cyl (cylinder) | 1.5, 14 | cyl box | cylinder (-48.6, 5.99) |
| cylinder-P6m-near | air 0.00 | nd | cyl (ellcyl) | 2.1, 14 | cyl box ball | cylinder (5.9, 5.99) |
| cylinder-P6mmm-generic |  | nd | cyl (ellcyl) | 1.1, 14 | cyl box | cylinder (1.9, 5.99) |
| cylinder-Pm-3-on | sizedist 0.02 | right | cyl (ellcyl) | 91.7, 14 | cyl | ellcyl (30.6, 5.99) |
| cylinder-Pm-3m-near |  | right | cyl (ellcyl) | 54.2, 14 | cyl | cylinder (1.0, 5.99) |
| ellcyl-P-1-generic | impurity 0.44 | right | cyl (ellcyl) | 98.4, 35 | cyl | ellcyl (632.6, 25) |
| ellcyl-P2m-on | sizedist 0.62 | wrong | ball (ellipsoid) | 37.3, 35 | ball | ellipsoid |
| ellcyl-Pmmm-near | hump 0.67 | right | cyl (ellcyl) | 37.4, 35 | cyl | ellcyl (311.7, 25) |
| ellcyl-P4m-generic |  | right | cyl (ellcyl) | 34.8, 14 | cyl | ellcyl (89.8, 5.99) |
| ellcyl-P4mmm-on |  | right | cyl (ellcyl) | 20.9, 14 | cyl | ellcyl (76.5, 5.99) |
| ellcyl-P-3-near |  | right | cyl (ellcyl) | 16.8, 14 | cyl | ellcyl (284.8, 5.99) |
| ellcyl-P-3m1-generic |  | nd | cyl (ellcyl) | 12.5, 14 | cyl box | cylinder (1.5, 5.99) |
| ellcyl-P6m-on |  | nd | ball (ellipsoid) | 7.6, 14 | ball cyl | ellipsoid |
| ellcyl-P6mmm-near | po 0.20 | wrong | box (box) | 90.2, 35 | box | box |
| ellcyl-Pm-3-generic |  | nd | cyl (ellcyl) | 6.3, 14 | cyl ball | ellcyl (32.5, 5.99) |
| ellcyl-Pm-3m-on | air 0.27 | nd | cyl (ellcyl) | 9.3, 14 | cyl box | ellcyl (129.7, 5.99) |
| ellipsoid-P-1-near |  | right | ball (ellipsoid) | 86.5, 14 | ball | ellipsoid (527.4, 5.99) |
| ellipsoid-P2m-generic | air 0.45 | right | ball (ellipsoid) | 77.7, 35 | ball | spheroid (4.2, 25) |
| ellipsoid-Pmmm-on | hump 0.86 | nd | ball (ellipsoid) | 20.3, 35 | ball cyl box | ellipsoid (219.8, 25) |
| ellipsoid-P4m-near |  | right | ball (ellipsoid) | 23.3, 14 | ball | ellipsoid (104.9, 5.99) |
| ellipsoid-P4mmm-generic | impurity 0.12 | nd | cyl (ellcyl) | 10.5, 35 | cyl ball | ellcyl |
| ellipsoid-P-3-on |  | right | ball (ellipsoid) | 26.9, 14 | ball | ellipsoid (63.0, 5.99) |
| ellipsoid-P-3m1-near |  | right | ball (ellipsoid) | 265.9, 14 | ball | ellipsoid (1947.7, 5.99) |
| ellipsoid-P6m-generic | po 0.79 | wrong | cyl (ellcyl) | 222.6, 35 | cyl | ellcyl |
| ellipsoid-P6mmm-on |  | nd | ball (ellipsoid) | 6.4, 14 | ball box cyl | spheroid (1.3, 5.99) |
| ellipsoid-Pm-3-near | air 0.89 | nd | box (box) | 0.2, 14 | box cyl ball | box |
| ellipsoid-Pm-3m-generic | sizedist 0.77 | right | ball (ellipsoid) | 185.5, 35 | ball | spheroid (21.4, 25) |
| spheroid-P-1-on | air 0.21 | right | ball (ellipsoid) | 21.1, 14 | ball | spheroid (0.8, 5.99) |
| spheroid-P2m-near |  | right | ball (ellipsoid) | 242.8, 14 | ball | spheroid (0.2, 5.99) |
| spheroid-Pmmm-generic | sizedist 0.54 | right | ball (ellipsoid) | 92.1, 35 | ball | spheroid (13.3, 25) |
| spheroid-P4m-on | impurity 0.37 | nd | ball (ellipsoid) | 4.8, 35 | ball cyl box | spheroid (0.1, 25) |
| spheroid-P4mmm-near | po 0.05 | nd | ball (ellipsoid) | 3.7, 14 | ball cyl | ellipsoid (21.6, 5.99) |
| spheroid-P-3-generic |  | nd | ball (ellipsoid) | 7.0, 14 | ball cyl | spheroid (0.6, 5.99) |
| spheroid-P-3m1-on |  | nd | cyl (ellcyl) | 1.0, 14 | cyl ball | ellcyl |
| spheroid-P6m-near | hump 1.00 | nd | ball (ellipsoid) | 23.3, 35 | ball cyl | spheroid (1.5, 25) |
| spheroid-P6mmm-generic | sizedist 0.59 | wrong | cyl (ellcyl) | 123.5, 35 | cyl | ellcyl |
| spheroid-Pm-3-on |  | nd | ball (ellipsoid) | 2.3, 14 | ball box cyl | spheroid (0.8, 5.99) |
| spheroid-Pm-3m-near |  | right | ball (spheroid) | 53.4, 14 | ball | spheroid (-3.9, 5.99) |
