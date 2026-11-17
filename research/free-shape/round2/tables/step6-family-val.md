# Step 6: the family verdicts on the 66 validation truths

`../scripts/step6/fam6.mjs --part validation --tag VFAM --ref VP --rows`: the frozen prototype with `SHAPE_FAMILY.solids 'general'` (the chosen solid, its nested partner and the three general members), margins 14 / 35, nested 3.84 / 5.99 / 5.99 (25 flagged). `../VALIDATION.md` §8 reads it.

66 truths with a verdict (of 66 runs)

| truths | right | not determined (truth among the named) | wrong |
|---|---|---|---|
| clean (33) | 22 | 11 (11) | 0 |
| with an error (33) | 9 | 21 (21) | 3 |
| all (66) | 31 | 32 (32) | 3 |

Wrong: cylinder-P2m-generic (hump 0.71; box by 63.6, need 35); cylinder-P4mmm-generic (sizedist 0.31; ball by 119.7, need 35); ellipsoid-P2m-on (po 0.61; cyl by 146.6, need 35).

Not determined: the winner wrong on 6 of 32; the truth not among the named on none.

Nested, the winner the truth's family (57): special truths given the special member 27 of 29; general truths given the general 23 of 28 (given the special: box-P2m-near Δ 22.6, ellipsoid-P-3m1-generic Δ 2.8, ellipsoid-P6m-on Δ -0.0, ellipsoid-P6mmm-near Δ 3.6, ellipsoid-Pm-3-generic Δ 5.6); special truths given the general: cylinder-P4m-near Δ 520.0, spheroid-P-3m1-near Δ 28.1.

Cost against the chosen solid's run (66): search evaluations 4.75× (median 5.22×), wall 4.82× (median 5.12×); the chosen solid's χ² equal to its run's on 66.

| row | error | verdict | family (by) | margin, need | within | solid (nested Δ, need) |
|---|---|---|---|---|---|---|
| box-P-1-on |  | nd | box (box) | 9.9, 14 | box cyl | box (271.1, 3.84) |
| box-P2m-near | hump 0.34 | nd | box (box) | 11.0, 35 | box cyl | sqbox (22.6, 25) |
| box-Pmmm-generic | impurity 0.17 | nd | box (box) | 8.6, 35 | box cyl | box (729.4, 25) |
| box-P4m-on |  | right | box (box) | 606.2, 14 | box | box (289.6, 3.84) |
| box-P4mmm-near | air 0.61 | nd | box (box) | 0.1, 35 | box cyl | box (127.1, 25) |
| box-P-3-generic |  | nd | box (box) | 7.8, 14 | box cyl ball | box (82.0, 3.84) |
| box-P-3m1-on | po 0.33 | nd | box (box) | 7.8, 35 | box cyl | box (28.4, 25) |
| box-P6m-near | sizedist 0.42 | nd | cyl (ellcyl) | 1.2, 14 | cyl box ball | ellcyl |
| box-P6mmm-generic |  | right | box (box) | 23.1, 14 | box | box (508.8, 3.84) |
| box-Pm-3-on |  | right | box (box) | 39.2, 14 | box | box (205.7, 3.84) |
| box-Pm-3m-near | air 0.79 | nd | box (box) | 20.0, 35 | box cyl | box (64.5, 25) |
| sqbox-P-1-generic |  | right | box (box) | 133.3, 14 | box | sqbox (0.0, 3.84) |
| sqbox-P2m-on |  | right | box (box) | 644.9, 14 | box | sqbox (0.0, 3.84) |
| sqbox-Pmmm-near |  | right | box (sqbox) | 24.0, 14 | box | sqbox (-2.6, 3.84) |
| sqbox-P4m-generic | sizedist 0.08 | nd | box (sqbox) | 5.1, 14 | box cyl | sqbox (-5.2, 3.84) |
| sqbox-P4mmm-on |  | right | box (box) | 41.5, 14 | box | sqbox (0.2, 3.84) |
| sqbox-P-3-near | air 0.53 | nd | box (box) | 33.2, 35 | box cyl | sqbox (5.7, 25) |
| sqbox-P-3m1-generic |  | nd | box (box) | 1.2, 14 | box cyl | sqbox (0.6, 3.84) |
| sqbox-P6m-on | hump 0.51 | nd | box (box) | 1.4, 35 | box cyl ball | sqbox (2.6, 25) |
| sqbox-P6mmm-near |  | right | box (box) | 21.6, 14 | box | sqbox (0.2, 3.84) |
| sqbox-Pm-3-generic | po 0.30 | nd | box (box) | 12.4, 14 | box cyl | sqbox (1.7, 3.84) |
| sqbox-Pm-3m-on | impurity 0.33 | nd | cyl (ellcyl) | 5.9, 35 | cyl box | ellcyl |
| cylinder-P-1-near | hump 0.03 | right | cyl (ellcyl) | 106.5, 14 | cyl | cylinder (0.5, 5.99) |
| cylinder-P2m-generic | hump 0.71 | wrong | box (box) | 63.6, 35 | box | box |
| cylinder-Pmmm-on |  | nd | cyl (ellcyl) | 12.3, 14 | cyl box | cylinder (0.1, 5.99) |
| cylinder-P4m-near | po 0.67 | right | cyl (ellcyl) | 48.5, 35 | cyl | ellcyl (520.0, 25) |
| cylinder-P4mmm-generic | sizedist 0.31 | wrong | ball (ellipsoid) | 119.7, 35 | ball | ellipsoid |
| cylinder-P-3-on | air 0.59 | right | cyl (ellcyl) | 24.8, 14 | cyl | cylinder (2.4, 5.99) |
| cylinder-P-3m1-near | impurity 0.98 | nd | box (box) | 20.8, 35 | box cyl ball | box |
| cylinder-P6m-generic |  | nd | cyl (ellcyl) | 5.8, 14 | cyl box | cylinder (0.4, 5.99) |
| cylinder-P6mmm-on |  | right | cyl (ellcyl) | 104.6, 14 | cyl | cylinder (0.6, 5.99) |
| cylinder-Pm-3-near |  | right | cyl (ellcyl) | 196.1, 14 | cyl | cylinder (0.6, 5.99) |
| cylinder-Pm-3m-generic |  | nd | cyl (ellcyl) | 9.7, 14 | cyl box | cylinder (0.1, 5.99) |
| ellcyl-P-1-on |  | right | cyl (ellcyl) | 38.1, 14 | cyl | ellcyl (169.4, 5.99) |
| ellcyl-P2m-near |  | nd | cyl (ellcyl) | 5.1, 14 | cyl box | ellcyl (47.7, 5.99) |
| ellcyl-Pmmm-generic |  | right | cyl (ellcyl) | 389.7, 14 | cyl | ellcyl (417.1, 5.99) |
| ellcyl-P4m-on | air 0.48 | nd | cyl (ellcyl) | 33.9, 35 | cyl box | ellcyl (578.8, 25) |
| ellcyl-P4mmm-near |  | right | cyl (ellcyl) | 41.0, 14 | cyl | ellcyl (165.8, 5.99) |
| ellcyl-P-3-generic |  | nd | cyl (ellcyl) | 8.1, 14 | cyl box | ellcyl (28.1, 5.99) |
| ellcyl-P-3m1-on |  | nd | cyl (ellcyl) | 0.9, 14 | cyl box | ellcyl (22.8, 5.99) |
| ellcyl-P6m-near | impurity 0.21 | nd | cyl (ellcyl) | 16.3, 35 | cyl ball box | ellcyl (273.5, 25) |
| ellcyl-P6mmm-generic | hump 0.36 | right | cyl (ellcyl) | 15.7, 14 | cyl | ellcyl (84.8, 5.99) |
| ellcyl-Pm-3-on | sizedist 0.65 | right | cyl (ellcyl) | 128.0, 35 | cyl | ellcyl (615.4, 25) |
| ellcyl-Pm-3m-near | po 0.88 | nd | box (box) | 7.3, 35 | box cyl | box |
| ellipsoid-P-1-generic |  | right | ball (ellipsoid) | 79.1, 14 | ball | ellipsoid (57.9, 5.99) |
| ellipsoid-P2m-on | po 0.61 | wrong | cyl (ellcyl) | 146.6, 35 | cyl | ellcyl |
| ellipsoid-Pmmm-near |  | right | ball (ellipsoid) | 112.9, 14 | ball | ellipsoid (839.1, 5.99) |
| ellipsoid-P4m-generic | impurity 0.46 | nd | cyl (ellcyl) | 2.6, 35 | cyl ball box | ellcyl |
| ellipsoid-P4mmm-on |  | nd | ball (ellipsoid) | 4.0, 14 | ball cyl | ellipsoid (52.0, 5.99) |
| ellipsoid-P-3-near |  | right | ball (ellipsoid) | 133.0, 14 | ball | ellipsoid (64.8, 5.99) |
| ellipsoid-P-3m1-generic | hump 0.14 | right | ball (ellipsoid) | 58.7, 35 | ball | spheroid (2.8, 25) |
| ellipsoid-P6m-on | po 0.43 | right | ball (spheroid) | 79.3, 35 | ball | spheroid (-0.0, 25) |
| ellipsoid-P6mmm-near | sizedist 0.96 | nd | ball (ellipsoid) | 7.2, 14 | ball cyl | spheroid (3.6, 5.99) |
| ellipsoid-Pm-3-generic | air 0.37 | nd | ball (ellipsoid) | 8.5, 14 | ball cyl | spheroid (5.6, 5.99) |
| ellipsoid-Pm-3m-on |  | nd | cyl (ellcyl) | 2.4, 14 | cyl ball | ellcyl |
| spheroid-P-1-near | sizedist 0.24 | right | ball (ellipsoid) | 140.4, 35 | ball | spheroid (9.3, 25) |
| spheroid-P2m-generic |  | right | ball (ellipsoid) | 406.7, 14 | ball | spheroid (0.9, 5.99) |
| spheroid-Pmmm-on |  | right | ball (ellipsoid) | 19.2, 14 | ball | spheroid (0.1, 5.99) |
| spheroid-P4m-near | po 0.11 | nd | ball (ellipsoid) | 7.7, 14 | ball cyl | spheroid (0.0, 5.99) |
| spheroid-P4mmm-generic |  | right | ball (ellipsoid) | 23.6, 14 | ball | spheroid (0.1, 5.99) |
| spheroid-P-3-on | hump 0.92 | right | ball (ellipsoid) | 402.4, 35 | ball | spheroid (0.2, 25) |
| spheroid-P-3m1-near | impurity 0.09 | nd | ball (ellipsoid) | 12.5, 35 | ball cyl box | ellipsoid (28.1, 25) |
| spheroid-P6m-generic | air 0.09 | nd | ball (ellipsoid) | 1.6, 35 | ball cyl box | spheroid (1.8, 25) |
| spheroid-P6mmm-on |  | right | ball (ellipsoid) | 55.4, 14 | ball | spheroid (0.5, 5.99) |
| spheroid-Pm-3-near |  | right | ball (spheroid) | 63.5, 35 | ball | spheroid (-2.8, 25) |
| spheroid-Pm-3m-generic |  | right | ball (ellipsoid) | 23.8, 14 | ball | spheroid (0.5, 5.99) |
