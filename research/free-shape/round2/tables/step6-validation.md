# Step 6: the validation part, once: the frozen prototype against today's search (77 runs)

`../scripts/step6/score6.mjs --part validation --p VP --t VT --rows` on the records `$W/fs2/step6/results/VP` (the frozen prototype, each run followed by its truth reference) and `VT` (today's search, `b9bef5f`). `../VALIDATION.md` reads it.


Δ* 16 (flagged 25), κ 1.2. Reach against the best known exact χ² of the same line (prototype: exact line, its runs with their truth references; today: Lorentzian, its run and truth reference).

| method | runs | truths: held / free / rejected (early) | spheres kept: clean / error | reached / judged | unbounded | worst, median (90 %) | thinnest | axis °, median (90 %) | search evaluations (× today; per run median) | report evaluations | isotropic fit evaluations |
|---|---|---|---|---|---|---|---|---|---|---|---|
| today | 77 | 40 / 21 / 5 (3) | 2/5 / 3/6 | 62 / 63 | 2 | +29 % (+111 %) | +19 % | 6.1 (34.2) | 327537 (1.000; 1.000) | 108164 | 33698 |
| prototype | 77 | 23 / 42 / 1 (1) | 0/5 / 2/6 | 64 / 65 | 6 | +2 % (+256 %) | -0 % | 1.5 (14.6) | 244121 (0.745; 0.558) | 121459 | 35684 |

- clean truths kept by both (30): worst +28 % → +1 % (90 %: +108 % → +6 %), thinnest +21 % → -0 %, axis 4.4° → 0.2°; unbounded 0 → 0
- with an error truths kept by both (31): worst +35 % → +9 % (90 %: +111 % → +∞), thinnest +18 % → +0 %, axis 8.3° → 3.2°; unbounded 2 → 6

Anisotropy (longest/thinnest read ÷ true) on the 30 clean truths both kept: median, median |ln|, outside 0.9–1.1:
- today: 0.77, 0.347, 20
- prototype: 1.00, 0.009, 3

Outcome prototype ≠ today on 36: box-P-1-on free → held; box-Pm-3m-near held → free; sqbox-Pmmm-near held → free; sqbox-P4m-generic rejected → free; sqbox-P-3-near held → free; sqbox-P6m-on free → held; sqbox-P6mmm-near held → free; cylinder-P-3m1-near held → free; cylinder-P6mmm-on rejected → held; cylinder-Pm-3-near held → free; cylinder-Pm-3m-generic held → free; ellcyl-P2m-near held → free; ellcyl-Pmmm-generic held → free; ellcyl-P4mmm-near held → free; ellcyl-P-3-generic held → free; ellcyl-P-3m1-on free → held; ellcyl-P6m-near held → free; ellcyl-P6mmm-generic held → free; ellcyl-Pm-3-on held → free; ellcyl-Pm-3m-near held → free; ellipsoid-P-3-near held → free; ellipsoid-P-3m1-generic held → free; ellipsoid-P6mmm-near held → free; ellipsoid-Pm-3-generic early → free; spheroid-P2m-generic held → free; spheroid-Pmmm-on free → held; spheroid-P-3m1-near held → free; spheroid-P6m-generic held → free; spheroid-Pm-3-near early → free; spheroid-Pm-3m-generic held → free; sphere-P2m-2 free → early; sphere-Pmmm-3 free → early; sphere-P4mmm-2 rejected → free; sphere-P-3-3 held → early; sphere-P6m-2 early → rejected; sphere-P6mmm-3 free → early.

Not reached, prototype: sqbox-P4m-generic (Δ 2.0). Today: ellcyl-P4m-on (Δ 31.1).

**Cost** (sums; walls in s; the prototype's report includes the jackknife where the check fired):

| method | search evaluations | report | isotropic fit | wall: search | report | isotropic fit | ms an evaluation, search (median) |
|---|---|---|---|---|---|---|---|
| today | 327537 | 108164 | 33698 | 2800 | 885 | 413 | 6.28 |
| prototype | 244121 | 121459 | 35684 | 1287 | 632 | 245 | 4.16 |

The minima stage: 112009 of the prototype's search evaluations (0.85× the rest of the search).

| class | -1 | 2/m | mmm | 4/m | 4/mmm | -3 | -3m | 6/m | 6/mmm | m-3 | m-3m |
|---|---|---|---|---|---|---|---|---|---|---|---|
| search evaluations, prototype ÷ today | 0.55 | 0.57 | 0.40 | 1.20 | 0.90 | 0.74 | 1.30 | 0.71 | 0.83 | 0.58 | 0.64 |

**The two errors** (prototype; kept truths; extents in ln D; an unbounded extent apart):

| kept truths | runs | extents (unbounded) | L κ local | B minima alone | C both | J with the jackknife | E engine lo–hi | median half-width L / C / J | principal axes L / C / J / E | median radius L / C / J |
|---|---|---|---|---|---|---|---|---|---|---|
| clean | 31 | 78 (0) | 78/78 (100 %) | 12/78 (15 %) | 78/78 (100 %) | 78/78 (100 %) | 78/78 (100 %) | 2.2 / 2.2 / 2.2 % | 25 / 26 / 26 / 26 of 31 | 1.5 / 1.9 / 1.9° |
| clean, flagged | 1 | 2 (0) | 2/2 (100 %) | 0/2 (0 %) | 2/2 (100 %) | 2/2 (100 %) | 2/2 (100 %) | 2.2 / 2.2 / 2.4 % | 1 / 1 / 1 / 1 of 1 | 4.5 / 4.5 / 13.0° |
| error, not flagged | 9 | 21 (1) | 18/21 (86 %) | 4/21 (19 %) | 18/21 (86 %) | 18/21 (86 %) | 18/21 (86 %) | 5.8 / 9.8 / 9.8 % | 5 / 5 / 5 / 5 of 9 | 4.1 / 8.6 / 8.6° |
| error, flagged | 24 | 56 (5) | 30/56 (54 %) | 7/56 (13 %) | 33/56 (59 %) | 50/56 (89 %) | 50/56 (89 %) | 2.5 / 3.2 / 13.4 % | 11 / 16 / 24 / 24 of 24 | 2.0 / 7.3 / 15.0° |
| all kept | 65 | 157 (6) | 128/157 (82 %) | 23/157 (15 %) | 131/157 (83 %) | 148/157 (94 %) | 148/157 (94 %) | 2.4 / 2.9 / 4.1 % | 42 / 48 / 56 / 56 of 65 | 2.5 / 3.6 / 5.0° |

| today's esds (κ 1) | runs | extents (unbounded) | covered | median half-width | principal axes covered (2·esdAngle) | median radius |
|---|---|---|---|---|---|---|
| clean | 30 | 76 (0) | 17/76 (22 %) | 4.6 % | 13 of 30 | 2.7° |
| with an error | 31 | 76 (2) | 19/76 (25 %) | 7.8 % | 14 of 31 | 4.0° |
| all kept | 61 | 152 (2) | 36/152 (24 %) | 5.9 % | 27 of 61 | 3.1° |

Local z (D's error over the curvature's σ, κ 1) on the clean kept truths, not flagged (78 extents): median |z| 0.68 (normal 0.67), rms of |z| < 5 0.99, beyond 2: 3, 3: 0, 5: 0.

**Uniqueness** (one minimum within Δ*):

| kept truths | unique | unique, L covers all | several | several: L covers | only C | neither | with J: unique / several covered |
|---|---|---|---|---|---|---|---|
| clean | 26/31 | 22 | 5 | 3 | 1 | 1 | 22/26 / 4/5 |
| clean, flagged | 1/1 | 1 | 0 | 0 | 0 | 0 | 1/1 / 0/0 |
| error, not flagged | 5/9 | 2 | 4 | 3 | 0 | 1 | 2/5 / 3/4 |
| error, flagged | 14/24 | 5 | 10 | 2 | 1 | 7 | 12/14 / 7/10 |
| all kept | 46/65 | 30 | 19 | 8 | 2 | 9 | 37/46 / 14/19 |

**The per-line check** (prototype: the fit returned, or beside a rejection the isotropic fit):

| rows | runs | flagged | spoiled | spoiled and flagged | z (worst of the two), median / max |
|---|---|---|---|---|---|
| clean truths | 33 | 1 | 2 | 0 | 0.18 / 3.14 |
| clean spheres | 5 | 0 | 0 | 0 | 1.29 / 2.08 |
| hump | 9 | 7 | 3 | 2 | 21.06 / 233.69 |
| sizedist | 7 | 3 | 6 | 2 | 0.98 / 9.98 |
| impurity | 7 | 7 | 2 | 2 | 74.98 / 154.47 |
| air | 8 | 5 | 2 | 2 | 5.07 / 87.56 |
| po | 8 | 6 | 5 | 5 | 18.26 / 295.25 |
| all with an error | 39 | 28 | 18 | 13 | 8.68 / 295.25 |

Spoiled and not flagged: box-P-3-generic (none), box-P6m-near (sizedist 0.42), sqbox-P4m-generic (sizedist 0.08), ellcyl-P6mmm-generic (hump 0.36), ellipsoid-P6mmm-near (sizedist 0.96), spheroid-P6mmm-on (none), sphere-P4mmm-2 (sizedist 0.41). Clean rows flagged: spheroid-Pm-3-near z 3.14.

**The keep test** (shapes kept):

| rows | runs | today | prototype |
|---|---|---|---|
| clean truths | 33 | 30 | 32 |
| truths with an error | 33 | 31 | 33 |
| clean spheres | 5 | 2 | 0 |
| spheres with an error | 6 | 3 | 2 |

Truths the prototype rejects: spheroid-P4mmm-generic (none; G —, need 16.1, early; today early).

Spheres the prototype keeps: sphere-P-1-1 (po 0.77, 2.7 nm; G 3488.7, need 24.7, flagged; today free); sphere-P4mmm-2 (sizedist 0.41, 13.8 nm; G 78.4, need 16.1; today rejected). Today keeps: sphere-P-1-1, sphere-P2m-2, sphere-Pmmm-3, sphere-P-3-3, sphere-P6mmm-3.

| row | class | error | today: outcome, evals, Δ, worst, thinnest, axis | prototype: outcome, evals, Δ, worst, thinnest, axis | flag | minima ≤ Δ* | extents covered (C/J) |
|---|---|---|---|---|---|---|---|
| box-P-1-on | -1 |  | free, 5203, 0.00, +92 %, +13 %, 4.1° | held, 2631, 0.00, +1 %, +1 %, 0.0° |  | 1 | 3/3 of 3 |
| box-P2m-near | 2/m | hump 0.34 | free, 5301, 0.00, +24 %, +15 %, 0.4° | free, 3297, 0.00, +3 %, -0 %, 0.7° | F | 1 | 3/3 of 3 |
| box-Pmmm-generic | mmm | impurity 0.17 | free, 5095, 0.00, +5 %, +3 %, 0.3° | free, 2261, 0.00, +1 %, +0 %, 1.4° | F | 1 | 3/3 of 3 |
| box-P4m-on | 4/m |  | held, 4710, 0.00, +13 %, +13 %, 0.0° | held, 3472, 0.00, +1 %, -0 %, 0.0° |  | 1 | 3/3 of 3 |
| box-P4mmm-near | 4/mmm | air 0.61 | free, 3944, 0.00, +34 %, +18 %, 7.7° | free, 6171, 0.00, +46 %, -1 %, 1.6° | F | 3 | 3/3 of 3 |
| box-P-3-generic | -3 |  | free, 3368, 0.00, +65 %, +58 %, 13.4° | free, 4651, 0.00, +48 %, -1 %, 5.0° |  | 1 | 3/3 of 3 |
| box-P-3m1-on | -3m | po 0.33 | free, 4029, 0.46, +55 %, +24 %, 13.2° | free, 3566, 0.00, +∞, -1 %, 3.9° | F | 1 | 2/3 of 3 |
| box-P6m-near | 6/m | sizedist 0.42 | held, 3762, 0.00, +29 %, +0 %, 8.3° | held, 6936, 0.00, +∞, -5 %, 8.3° |  | 3 | 3/3 of 3 |
| box-P6mmm-generic | 6/mmm |  | free, 5384, 0.00, +72 %, +70 %, 9.9° | free, 2163, 0.00, +23 %, +0 %, 1.6° |  | 2 | 3/3 of 3 |
| box-Pm-3-on | m-3 |  | held, 5257, 0.36, +30 %, +30 %, 0.0° | held, 1933, 0.00, +1 %, -0 %, 0.0° |  | 1 | 3/3 of 3 |
| box-Pm-3m-near | m-3m | air 0.79 | held, 5668, 0.00, +41 %, +7 %, 5.4° | free, 3728, 0.00, +1 %, +0 %, 1.5° | F | 3 | 3/3 of 3 |
| sqbox-P-1-generic | -1 |  | free, 5624, 0.00, +18 %, +16 %, 0.7° | free, 2243, 0.00, +1 %, -0 %, 0.1° |  | 1 | 2/2 of 2 |
| sqbox-P2m-on | 2/m |  | held, 7002, 0.00, +46 %, +46 %, 0.0° | held, 4371, 0.00, +0 %, -0 %, 0.0° |  | 1 | 2/2 of 2 |
| sqbox-Pmmm-near | mmm |  | held, 4899, 0.98, +15 %, +5 %, 0.8° | free, 2735, 0.00, +1 %, -1 %, 2.9° |  | 1 | 2/2 of 2 |
| sqbox-P4m-generic | 4/m | sizedist 0.08 | rejected, 3510, 0.00, — | free, 4085, 2.03, +1 %, +0 %, 41.4° |  | 5 | 2/2 of 2 |
| sqbox-P4mmm-on | 4/mmm |  | held, 3345, 0.00, +27 %, +27 %, 0.0° | held, 1761, 0.00, +1 %, +0 %, 0.0° |  | 1 | 2/2 of 2 |
| sqbox-P-3-near | -3 | air 0.53 | held, 4146, 0.00, +113 %, +113 %, 89.7° | free, 2983, 0.00, +2 %, -2 %, 3.2° | F | 2 | 1/2 of 2 |
| sqbox-P-3m1-generic | -3m |  | free, 4919, 0.01, +54 %, +54 %, 11.4° | free, 2113, 0.00, +1 %, +1 %, 0.4° |  | 2 | 2/2 of 2 |
| sqbox-P6m-on | 6/m | hump 0.51 | free, 3784, 0.00, +73 %, +73 %, 17.3° | held, 2660, 0.00, +1 %, -1 %, 0.0° | F | 1 | 2/2 of 2 |
| sqbox-P6mmm-near | 6/mmm |  | held, 5218, 0.00, +22 %, +19 %, 1.9° | free, 1962, 0.00, +2 %, +0 %, 0.2° |  | 1 | 2/2 of 2 |
| sqbox-Pm-3-generic | m-3 | po 0.30 | held, 3429, 0.00, +40 %, +40 %, 18.4° | held, 1680, 0.00, +1 %, +1 %, 2.3° |  | 1 | 2/2 of 2 |
| sqbox-Pm-3m-on | m-3m | impurity 0.33 | free, 5938, 0.00, +11 %, +11 %, 4.7° | free, 3589, 0.00, +4 %, -1 %, 5.8° | F | 2 | 0/2 of 2 |
| cylinder-P-1-near | -1 | hump 0.03 | free, 3583, 0.00, +25 %, +10 %, 6.1° | free, 2124, 0.00, +1 %, +1 %, 1.0° |  | 1 | 1/1 of 2 |
| cylinder-P2m-generic | 2/m | hump 0.71 | free, 3384, 0.00, +35 %, -4 %, 0.7° | free, 2314, 0.00, +17 %, +7 %, 11.8° | F | 1 | 0/2 of 2 |
| cylinder-Pmmm-on | mmm |  | held, 6868, 0.08, +4 %, +3 %, 0.0° | held, 2829, 0.00, +0 %, +0 %, 0.0° |  | 1 | 2/2 of 2 |
| cylinder-P4m-near | 4/m | po 0.67 | free, 3636, 0.00, +∞, +∞, 32.9° | free, 3852, 0.00, +393 %, +393 %, 22.7° | F | 2 | 0/1 of 2 |
| cylinder-P4mmm-generic | 4/mmm | sizedist 0.31 | free, 3093, 0.00, +63 %, +19 %, 33.5° | free, 1384, 0.00, +47 %, +5 %, 2.2° | F | 1 | 0/0 of 2 |
| cylinder-P-3-on | -3 | air 0.59 | held, 3080, 0.00, +29 %, +29 %, 0.0° | held, 2321, 0.00, +2 %, +0 %, 0.0° |  | 1 | 2/2 of 2 |
| cylinder-P-3m1-near | -3m | impurity 0.98 | held, 3554, 0.00, +24 %, +16 %, 12.8° | free, 2465, 0.00, +51 %, +51 %, 51.9° | F | 3 | 2/2 of 2 |
| cylinder-P6m-generic | 6/m |  | free, 2896, 0.00, +361 %, +361 %, 74.6° | free, 1317, 0.00, +1 %, -0 %, 0.2° |  | 1 | 2/2 of 2 |
| cylinder-P6mmm-on | 6/mmm |  | rejected, 3192, 0.00, — | held, 1526, 0.01, +0 %, +0 %, 0.0° |  | 1 | 2/2 of 2 |
| cylinder-Pm-3-near | m-3 |  | held, 2463, 0.00, +27 %, +22 %, 3.0° | free, 1406, 0.00, +1 %, -0 %, 3.0° |  | 1 | 2/2 of 2 |
| cylinder-Pm-3m-generic | m-3m |  | held, 2507, 0.00, +23 %, +20 %, 6.1° | free, 2016, 0.00, +5 %, -1 %, 1.2° |  | 1 | 2/2 of 2 |
| ellcyl-P-1-on | -1 |  | held, 5595, 0.00, +8 %, +6 %, 0.0° | held, 2407, 0.00, +1 %, -0 %, 0.0° |  | 1 | 3/3 of 3 |
| ellcyl-P2m-near | 2/m |  | held, 4523, 0.00, +16 %, +1 %, 4.7° | free, 4440, 0.00, +3 %, -1 %, 2.3° |  | 1 | 3/3 of 3 |
| ellcyl-Pmmm-generic | mmm |  | held, 5900, 0.00, +44 %, +44 %, 33.7° | free, 1828, 0.00, +1 %, +1 %, 0.4° |  | 1 | 3/3 of 3 |
| ellcyl-P4m-on | 4/m | air 0.48 | held, 5855, 31.07, +111 %, +111 %, 0.0° | held, 4124, 0.00, +6 %, -0 %, 0.0° | F | 1 | 3/3 of 3 |
| ellcyl-P4mmm-near | 4/mmm |  | held, 5300, 0.00, +24 %, +15 %, 7.3° | free, 5293, 0.00, +5 %, +1 %, 4.4° |  | 1 | 3/3 of 3 |
| ellcyl-P-3-generic | -3 |  | held, 3731, 0.00, +52 %, +52 %, 12.7° | free, 5623, 0.20, +3 %, -1 %, 1.9° |  | 2 | 3/3 of 3 |
| ellcyl-P-3m1-on | -3m |  | free, 3361, 0.00, +253 %, +253 %, 43.7° | held, 3644, 0.00, +15 %, -0 %, 0.0° |  | 1 | 3/3 of 3 |
| ellcyl-P6m-near | 6/m | impurity 0.21 | held, 5334, 0.00, +65 %, +16 %, 25.7° | free, 4520, 0.00, +6 %, -0 %, 1.2° | F | 1 | 3/3 of 3 |
| ellcyl-P6mmm-generic | 6/mmm | hump 0.36 | held, 4333, 0.00, +80 %, +47 %, 14.7° | free, 3805, 0.00, +37 %, -3 %, 3.4° |  | 1 | 3/3 of 3 |
| ellcyl-Pm-3-on | m-3 | sizedist 0.65 | held, 6190, 0.00, +53 %, +50 %, 0.0° | free, 3331, 0.00, +∞, +167 %, 4.3° | F | 2 | 2/2 of 3 |
| ellcyl-Pm-3m-near | m-3m | po 0.88 | held, 6080, 0.35, +18 %, +18 %, 1.7° | free, 7494, 0.30, +∞, +2 %, 3.2° | F | 1 | 1/3 of 3 |
| ellipsoid-P-1-generic | -1 |  | free, 3748, 0.00, +29 %, -1 %, 1.5° | free, 1848, 0.00, +1 %, +0 %, 0.2° |  | 1 | 3/3 of 3 |
| ellipsoid-P2m-on | 2/m | po 0.61 | free, 9477, 0.00, +∞, -50 %, 26.6° | free, 4389, 0.00, +∞, -46 %, 9.1° | F | 1 | 1/3 of 3 |
| ellipsoid-Pmmm-near | mmm |  | held, 4931, 0.00, +2 %, -2 %, 2.6° | held, 2140, 0.00, +1 %, +0 %, 2.6° |  | 1 | 3/3 of 3 |
| ellipsoid-P4m-generic | 4/m | impurity 0.46 | held, 4232, 0.00, +22 %, +22 %, 2.7° | held, 12594, 0.00, +9 %, -2 %, 2.7° | F | 1 | 3/3 of 3 |
| ellipsoid-P4mmm-on | 4/mmm |  | held, 3388, 0.00, +29 %, +29 %, 0.0° | held, 5401, 0.00, +3 %, -1 %, 0.0° |  | 2 | 3/3 of 3 |
| ellipsoid-P-3-near | -3 |  | held, 4075, 0.00, +58 %, +32 %, 38.9° | free, 1611, 0.00, +2 %, -0 %, 0.8° |  | 1 | 3/3 of 3 |
| ellipsoid-P-3m1-generic | -3m | hump 0.14 | held, 4986, 0.00, +18 %, +4 %, 15.5° | free, 20773, 0.00, +5 %, +2 %, 11.1° | F | 2 | 2/2 of 3 |
| ellipsoid-P6m-on | 6/m | po 0.43 | held, 7140, 0.00, +25 %, -4 %, 0.0° | held, 1979, 0.00, +9 %, +4 %, 0.0° | F | 1 | 0/3 of 3 |
| ellipsoid-P6mmm-near | 6/mmm | sizedist 0.96 | held, 3199, 0.00, +20 %, +10 %, 20.6° | free, 10329, 0.00, +30 %, -30 %, 16.5° |  | 1 | 1/1 of 3 |
| ellipsoid-Pm-3-generic | m-3 | air 0.37 | early, 2189, —, — | free, 2835, 0.00, +11 %, -1 %, 2.5° |  | 3 | 3/3 of 3 |
| ellipsoid-Pm-3m-on | m-3m |  | held, 3673, 0.00, +78 %, +78 %, 0.0° | held, 2536, 0.00, +2 %, -1 %, 0.0° |  | 1 | 3/3 of 3 |
| spheroid-P-1-near | -1 | sizedist 0.24 | free, 3265, 0.00, +37 %, +8 %, 3.3° | free, 1780, 0.00, +9 %, +3 %, 0.8° | F | 1 | 0/1 of 2 |
| spheroid-P2m-generic | 2/m |  | held, 2702, 0.00, +9 %, +5 %, 11.3° | free, 1687, 0.00, +0 %, -0 %, 0.6° |  | 1 | 2/2 of 2 |
| spheroid-Pmmm-on | mmm |  | free, 5572, 0.00, +18 %, -1 %, 6.0° | held, 2263, 0.00, +1 %, +0 %, 0.0° |  | 1 | 2/2 of 2 |
| spheroid-P4m-near | 4/m | po 0.11 | held, 4377, 0.00, +8 %, -4 %, 7.5° | held, 5180, 0.00, +3 %, +1 %, 7.5° |  | 2 | 2/2 of 2 |
| spheroid-P4mmm-generic | 4/mmm |  | early, 2132, —, — | early, 1032, —, — |  | — | — |
| spheroid-P-3-on | -3 | hump 0.92 | held, 3928, 0.00, +25 %, +25 %, 34.2° | held, 1304, 0.00, +2 %, +2 %, 0.0° | F | 1 | 1/2 of 2 |
| spheroid-P-3m1-near | -3m | impurity 0.09 | held, 3397, 0.00, +76 %, +62 %, 87.3° | free, 1320, 0.00, +∞, -3 %, 18.2° | F | 2 | 1/2 of 2 |
| spheroid-P6m-generic | 6/m | air 0.09 | held, 2805, 0.00, +46 %, +36 %, 16.0° | free, 1385, 0.00, +1 %, +1 %, 19.3° | F | 2 | 2/2 of 2 |
| spheroid-P6mmm-on | 6/mmm |  | held, 2955, 0.00, +25 %, +15 %, 90.0° | held, 2417, 0.00, +0 %, +0 %, 30.0° |  | 3 | 2/2 of 2 |
| spheroid-Pm-3-near | m-3 |  | early, 1852, —, — | free, 1835, 0.00, +1 %, -1 %, 1.8° | F | 1 | 2/2 of 2 |
| spheroid-Pm-3m-generic | m-3m |  | held, 6604, 0.00, +387 %, +387 %, 21.3° | free, 888, 0.00, +1 %, -0 %, 0.2° |  | 1 | 2/2 of 2 |
| sphere-P-1-1 | -1 | po 0.77 | free, 6055, —, — | free, 5194, —, — | F | — | — |
| sphere-P2m-2 | 2/m | air 0.29 | free, 5843, —, — | early, 1324, —, — |  | — | — |
| sphere-Pmmm-3 | mmm | impurity 0.92 | free, 4734, —, — | early, 1148, —, — | F | — | — |
| sphere-P4m-1 | 4/m |  | early, 2474, —, — | early, 1245, —, — |  | — | — |
| sphere-P4mmm-2 | 4/mmm | sizedist 0.41 | rejected, 3515, —, — | free, 1319, —, — |  | — | — |
| sphere-P-3-3 | -3 |  | held, 3796, —, — | early, 959, —, — |  | — | — |
| sphere-P-3m1-1 | -3m |  | early, 2516, —, — | early, 972, —, — |  | — | — |
| sphere-P6m-2 | 6/m | hump 0.56 | early, 2394, —, — | rejected, 1256, —, — | F | — | — |
| sphere-P6mmm-3 | 6/mmm |  | free, 3493, —, — | early, 861, —, — |  | — | — |
| sphere-Pm-3-1 | m-3 | hump 0.23 | early, 1909, —, — | early, 579, —, — | F | — | — |
| sphere-Pm-3m-2 | m-3m |  | early, 2188, —, — | early, 684, —, — |  | — | — |

