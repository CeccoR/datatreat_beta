# Step 6: the prototype against today's search on the 154 tuning runs

`../scripts/step6/score6.mjs --part tuning --p P --best SC,SY,MX,RD,SF2 --rows`: today's records are the pilot's on the 77 screening rows (`$W/fs2/pilot/results/screen`) and step 6's T on the other 77; the prototype's step 6's P. `../CONFIRM.md` §3 reads it.


Δ* 16 (flagged 25), κ 1.2. Reach against the best known exact χ² of the same line (prototype: exact line, its runs and SC,SY,MX,RD,SF2 with their truth references; today: Lorentzian, its run and truth reference).

| method | runs | truths: held / free / rejected (early) | spheres kept: clean / error | reached / judged | unbounded | worst, median (90 %) | thinnest | axis °, median (90 %) | search evaluations (× today; per run median) | report evaluations | isotropic fit evaluations |
|---|---|---|---|---|---|---|---|---|---|---|---|
| today | 154 | 67 / 55 / 10 (6) | 2/12 / 4/10 | 117 / 126 | 5 | +41 % (+278 %) | +19 % | 6.8 (77.9) | 612710 (1.000; 1.000) | 201554 | 72592 |
| prototype | 154 | 44 / 87 / 1 (0) | 0/12 / 4/10 | 127 / 132 | 8 | +4 % (+179 %) | +0 % | 1.3 (13.3) | 532034 (0.868; 0.643) | 254737 | 76456 |

- clean truths kept by both (58): worst +38 % → +1 % (90 %: +196 % → +19 %), thinnest +21 % → +0 %, axis 6.8° → 0.5°; unbounded 1 → 0
- with an error truths kept by both (64): worst +43 % → +13 % (90 %: +287 % → +∞), thinnest +17 % → -0 %, axis 7.0° → 3.0°; unbounded 4 → 8

Anisotropy (longest/thinnest read ÷ true) on the 58 clean truths both kept: median, median |ln|, outside 0.9–1.1:
- today: 0.75, 0.310, 40
- prototype: 1.00, 0.017, 10

Outcome prototype ≠ today on 70: box-P4m-near held → free; box-P-3m1-near held → free; box-P6mmm-near held → free; box-Pm-3-near held → free; box-Pm-3-generic held → free; sqbox-P4m-on rejected → held; sqbox-P4mmm-near held → free; sqbox-P-3m1-on held → free; sqbox-P-3m1-near held → free; sqbox-P6m-near rejected → free; sqbox-P6m-generic held → free; sqbox-Pm-3-near held → free; sqbox-Pm-3m-near rejected → free; cylinder-P2m-on free → held; cylinder-Pmmm-near held → free; cylinder-P4m-on free → held; cylinder-P4mmm-near held → free; cylinder-P-3m1-generic free → held; cylinder-P6mmm-near held → free; cylinder-Pm-3-on held → free; cylinder-Pm-3-generic held → free; cylinder-Pm-3m-on held → free; cylinder-Pm-3m-near held → free; ellcyl-P2m-on held → free; ellcyl-Pmmm-near held → free; ellcyl-P4m-near held → free; ellcyl-P-3-on free → held; ellcyl-P-3m1-near held → free; ellcyl-P-3m1-generic free → held; ellcyl-P6m-on held → free; ellcyl-P6mmm-near held → free; ellcyl-Pm-3-near held → free; ellcyl-Pm-3-generic early → free; ellcyl-Pm-3m-on held → free; ellcyl-Pm-3m-generic held → free; ellipsoid-P-1-on free → held; ellipsoid-Pmmm-on free → held; ellipsoid-P4mmm-near held → free; ellipsoid-P4mmm-generic held → free; ellipsoid-P-3-on free → held; ellipsoid-P-3m1-near held → free; ellipsoid-P6m-generic held → free; ellipsoid-P6mmm-generic held → free; ellipsoid-Pm-3-near held → free; ellipsoid-Pm-3m-near early → held; ellipsoid-Pm-3m-generic held → free; spheroid-P-1-on free → held; spheroid-P4m-generic held → free; spheroid-P4mmm-near held → free; spheroid-P-3-generic held → free; spheroid-P-3m1-on free → held; spheroid-P6m-on free → held; spheroid-P6mmm-near held → free; spheroid-P6mmm-generic held → free; spheroid-Pm-3-on early → held; spheroid-Pm-3-generic early → free; spheroid-Pm-3m-on early → held; spheroid-Pm-3m-near early → free; sphere-P2m-1 rejected → early; sphere-Pmmm-1 free → early; sphere-P4m-2 rejected → early; sphere-P4m-3 early → free; sphere-P4mmm-1 rejected → early; sphere-P-3-1 free → early; sphere-P-3-2 rejected → early; sphere-P-3m1-2 rejected → early; sphere-P-3m1-3 free → early; sphere-P6m-3 rejected → early; sphere-P6mmm-2 held → rejected; sphere-Pm-3m-3 early → free.

Not reached, prototype: sqbox-Pmmm-generic (Δ 6.5), sqbox-P6m-generic (Δ 59.0), cylinder-Pm-3m-on (Δ 1514.1), ellcyl-Pmmm-near (Δ 46.1), ellcyl-P6m-on (Δ 131.3). Today: box-Pmmm-on (Δ 19.1), box-P6m-on (Δ 10.1), sqbox-P2m-near (Δ 1.9), ellcyl-P2m-on (Δ 17.7), ellcyl-P4m-near (Δ 35.8), ellcyl-P4mmm-on (Δ 3.0), ellcyl-P-3-near (Δ 2.7), ellcyl-P6mmm-on (Δ 62.9), ellcyl-Pm-3-near (Δ 2.6).

**Cost** (sums; walls in s; the prototype's report includes the jackknife where the check fired):

| method | search evaluations | report | isotropic fit | wall: search | report | isotropic fit | ms an evaluation, search (median) |
|---|---|---|---|---|---|---|---|
| today | 612710 | 201554 | 72592 | 8591 | 2669 | 1478 | 10.40 |
| prototype | 532034 | 254737 | 76456 | 2629 | 1315 | 511 | 4.36 |

The minima stage: 251215 of the prototype's search evaluations (0.89× the rest of the search).

| class | -1 | 2/m | mmm | 4/m | 4/mmm | -3 | -3m | 6/m | 6/mmm | m-3 | m-3m |
|---|---|---|---|---|---|---|---|---|---|---|---|
| search evaluations, prototype ÷ today | 0.60 | 0.70 | 0.80 | 0.65 | 0.57 | 0.90 | 0.98 | 0.90 | 0.83 | 0.92 | 2.16 |

**The two errors** (prototype; kept truths; extents in ln D; an unbounded extent apart):

| kept truths | runs | extents (unbounded) | L κ local | B minima alone | C both | J with the jackknife | E engine lo–hi | median half-width L / C / J | principal axes L / C / J / E | median radius L / C / J |
|---|---|---|---|---|---|---|---|---|---|---|
| clean | 66 | 165 (0) | 154/165 (93 %) | 23/165 (14 %) | 155/165 (94 %) | 155/165 (94 %) | 155/165 (94 %) | 2.7 / 2.9 / 2.9 % | 54 / 59 / 59 / 59 of 65 | 2.2 / 3.7 / 3.7° |
| error, not flagged | 16 | 37 (2) | 23/37 (62 %) | 8/37 (22 %) | 26/37 (70 %) | 26/37 (70 %) | 26/37 (70 %) | 3.4 / 7.4 / 7.4 % | 10 / 12 / 12 / 12 of 16 | 4.8 / 5.5 / 5.5° |
| error, flagged | 49 | 117 (6) | 56/117 (48 %) | 12/117 (10 %) | 58/117 (50 %) | 100/117 (85 %) | 100/117 (85 %) | 3.3 / 3.8 / 15.8 % | 21 / 26 / 41 / 41 of 49 | 2.2 / 3.1 / 12.6° |
| all kept | 131 | 319 (8) | 233/319 (73 %) | 43/319 (13 %) | 239/319 (75 %) | 281/319 (88 %) | 281/319 (88 %) | 3.0 / 3.3 / 6.2 % | 85 / 97 / 112 / 112 of 130 | 2.3 / 3.7 / 8.1° |

| today's esds (κ 1) | runs | extents (unbounded) | covered | median half-width | principal axes covered (2·esdAngle) | median radius |
|---|---|---|---|---|---|---|
| clean | 58 | 146 (1) | 39/146 (27 %) | 6.3 % | 15 of 57 | 2.8° |
| with an error | 64 | 156 (4) | 45/156 (29 %) | 7.2 % | 21 of 64 | 3.0° |
| all kept | 122 | 302 (5) | 84/302 (28 %) | 6.7 % | 36 of 121 | 2.9° |

Local z (D's error over the curvature's σ, κ 1) on the clean kept truths, not flagged (165 extents): median |z| 0.69 (normal 0.67), rms of |z| < 5 1.14, beyond 2: 18, 3: 6, 5: 4.

**Uniqueness** (one minimum within Δ*):

| kept truths | unique | unique, L covers all | several | several: L covers | only C | neither | with J: unique / several covered |
|---|---|---|---|---|---|---|---|
| clean | 45/66 | 39 | 21 | 14 | 5 | 2 | 39/45 / 19/21 |
| error, not flagged | 11/16 | 4 | 5 | 0 | 3 | 2 | 5/11 / 3/5 |
| error, flagged | 36/49 | 8 | 13 | 1 | 2 | 10 | 25/36 / 9/13 |
| all kept | 92/131 | 51 | 39 | 15 | 10 | 14 | 69/92 / 31/39 |

**The per-line check** (prototype: the fit returned, or beside a rejection the isotropic fit):

| rows | runs | flagged | spoiled | spoiled and flagged | z (worst of the two), median / max |
|---|---|---|---|---|---|
| clean truths | 66 | 0 | 9 | 0 | 0.48 / 2.09 |
| clean spheres | 12 | 0 | 0 | 0 | 0.00 / 1.01 |
| hump | 15 | 14 | 3 | 3 | 22.30 / 274.14 |
| sizedist | 16 | 10 | 10 | 8 | 5.58 / 71.84 |
| impurity | 16 | 16 | 2 | 2 | 44.19 / 292.29 |
| air | 15 | 7 | 4 | 1 | 2.82 / 53.00 |
| po | 14 | 12 | 12 | 11 | 18.59 / 144.27 |
| all with an error | 76 | 59 | 31 | 25 | 14.14 / 292.29 |

Spoiled and not flagged: box-P4m-generic (none), box-P-3m1-near (none), box-P6m-generic (none), cylinder-P6m-near (air 0.00), ellcyl-P6m-on (none), ellcyl-Pm-3-generic (none), ellcyl-Pm-3m-on (air 0.27), ellcyl-Pm-3m-generic (none), ellipsoid-P6m-near (none), ellipsoid-Pm-3-near (air 0.89), spheroid-P4mmm-near (po 0.05), spheroid-P-3-near (none), spheroid-P6m-on (sizedist 0.84), spheroid-Pm-3-on (none), sphere-P4m-3 (sizedist 0.95). Clean rows flagged: none.

**The keep test** (shapes kept):

| rows | runs | today | prototype |
|---|---|---|---|
| clean truths | 66 | 58 | 66 |
| truths with an error | 66 | 64 | 65 |
| clean spheres | 12 | 2 | 0 |
| spheres with an error | 10 | 4 | 4 |

Truths the prototype rejects: box-P-3m1-generic (air; G 22.8, need 16.1, flagged; today rejected).

Spheres the prototype keeps: sphere-Pmmm-2 (hump 0.44, 2.1 nm; G 438.0, need 18.6, flagged; today free); sphere-P4m-3 (sizedist 0.95, 10.8 nm; G 482.2, need 16.1; today early); sphere-P6mmm-1 (po 0.59, 9.9 nm; G 386.9, need 16.1, flagged; today free); sphere-Pm-3m-3 (sizedist 0.71, 4.4 nm; G 3510.7, need 13.2, flagged; today early). Today keeps: sphere-Pmmm-1, sphere-Pmmm-2, sphere-P-3-1, sphere-P-3m1-3, sphere-P6mmm-1, sphere-P6mmm-2.

| row | class | error | today: outcome, evals, Δ, worst, thinnest, axis | prototype: outcome, evals, Δ, worst, thinnest, axis | flag | minima ≤ Δ* | extents covered (C/J) |
|---|---|---|---|---|---|---|---|
| box-P-1-near | -1 |  | free, 3824, 0.00, +32 %, +15 %, 3.7° | free, 3817, 0.00, +1 %, -0 %, 0.5° |  | 1 | 3/3 of 3 |
| box-P-1-generic | -1 |  | free, 3789, 0.00, +56 %, +8 %, 3.4° | free, 2495, 0.00, +7 %, +0 %, 0.1° |  | 1 | 2/2 of 3 |
| box-P2m-on | 2/m |  | held, 3972, 0.39, +54 %, +16 %, 0.0° | held, 3234, 0.01, +4 %, -1 %, 0.0° |  | 1 | 3/3 of 3 |
| box-P2m-generic | 2/m | air 0.17 | free, 5136, 0.00, +19 %, +14 %, 1.5° | free, 3005, 0.00, +3 %, -1 %, 1.5° |  | 1 | 2/2 of 3 |
| box-Pmmm-on | mmm | po 0.06 | free, 4386, 19.09, +17 %, +17 %, 6.3° | free, 3366, 0.00, +339 %, -1 %, 4.2° | F | 1 | 1/2 of 3 |
| box-Pmmm-near | mmm | po 0.39 | free, 3975, 0.00, +38 %, -6 %, 4.3° | free, 6361, 0.39, +∞, -11 %, 10.2° | F | 1 | 1/3 of 3 |
| box-P4m-near | 4/m |  | held, 8376, 0.00, +37 %, +37 %, 5.5° | free, 3029, 0.00, +4 %, +0 %, 0.9° |  | 2 | 3/3 of 3 |
| box-P4m-generic | 4/m |  | held, 3569, 0.00, +59 %, +20 %, 12.2° | held, 4098, 0.00, +82 %, +1 %, 9.0° |  | 1 | 3/3 of 3 |
| box-P4mmm-on | 4/mmm |  | held, 4745, 0.00, +26 %, +17 %, 0.0° | held, 2239, 0.00, +1 %, +1 %, 0.0° |  | 1 | 3/3 of 3 |
| box-P4mmm-generic | 4/mmm |  | free, 5375, 0.00, +54 %, +38 %, 14.5° | free, 2092, 0.00, +2 %, +0 %, 0.1° |  | 1 | 3/3 of 3 |
| box-P-3-on | -3 | sizedist 0.12 | held, 6119, 0.00, +57 %, +11 %, 0.0° | held, 6404, 0.00, +7 %, +0 %, 0.0° |  | 5 | 3/3 of 3 |
| box-P-3-near | -3 | sizedist 0.87 | free, 6068, 0.00, +10 %, +9 %, 23.3° | free, 3922, 0.00, +127 %, -19 %, 43.1° | F | 1 | 0/1 of 3 |
| box-P-3m1-near | -3m |  | held, 3294, 0.00, +74 %, +74 %, 28.3° | free, 7492, 0.05, +191 %, +1 %, 10.9° |  | 2 | 3/3 of 3 |
| box-P-3m1-generic | -3m | air 0.74 | rejected, 3773, 0.00, — | rejected, 1713, 0.00, — | F | — | — |
| box-P6m-on | 6/m |  | held, 4506, 10.10, +43 %, +43 %, 30.0° | held, 3358, 0.00, +0 %, +0 %, 0.0° |  | 1 | 3/3 of 3 |
| box-P6m-generic | 6/m |  | free, 3748, 0.38, +101 %, +101 %, 16.5° | free, 8794, 0.00, +36 %, +1 %, 12.6° |  | 2 | 3/3 of 3 |
| box-P6mmm-on | 6/mmm | impurity 0.57 | free, 3621, 0.00, +∞, +3 %, 4.8° | free, 6575, 0.00, +∞, -12 %, 5.3° | F | 2 | 2/3 of 3 |
| box-P6mmm-near | 6/mmm |  | held, 4544, 0.00, +7 %, +7 %, 2.9° | free, 3090, 0.00, +1 %, -1 %, 0.4° |  | 2 | 3/3 of 3 |
| box-Pm-3-near | m-3 | impurity 0.76 | held, 4076, 0.03, +42 %, +12 %, 7.4° | free, 2889, 0.00, +4 %, +3 %, 8.3° | F | 3 | 3/3 of 3 |
| box-Pm-3-generic | m-3 | impurity 0.02 | held, 7104, 0.00, +66 %, +25 %, 29.5° | free, 2473, 0.00, +24 %, +0 %, 0.5° | F | 2 | 1/3 of 3 |
| box-Pm-3m-on | m-3m | hump 0.24 | held, 3254, 0.00, +224 %, +116 %, 0.0° | held, 4666, 0.00, +3 %, +0 %, 0.0° | F | 1 | 3/3 of 3 |
| box-Pm-3m-generic | m-3m | hump 0.64 | held, 3574, 0.00, +73 %, +73 %, 19.7° | held, 4995, 0.00, +3 %, -0 %, 9.9° | F | 1 | 3/3 of 3 |
| sqbox-P-1-on | -1 | sizedist 0.19 | free, 4805, 0.00, +39 %, +16 %, 3.9° | free, 2703, 0.00, +3 %, +1 %, 0.5° |  | 1 | 1/1 of 2 |
| sqbox-P-1-near | -1 | impurity 0.69 | free, 7367, 0.00, +7 %, -6 %, 44.3° | free, 5250, 0.00, +2 %, -0 %, 2.3° | F | 4 | 2/2 of 2 |
| sqbox-P2m-near | 2/m |  | free, 5477, 1.94, +12 %, +2 %, 8.9° | free, 2160, 0.00, +0 %, -0 %, 0.5° |  | 1 | 2/2 of 2 |
| sqbox-P2m-generic | 2/m | sizedist 0.40 | free, 3837, 0.00, +40 %, +4 %, 12.2° | free, 3854, 0.00, +25 %, +8 %, 3.4° |  | 1 | 1/1 of 2 |
| sqbox-Pmmm-on | mmm | impurity 0.53 | held, 3556, 0.00, +4 %, -1 %, 0.0° | held, 2490, 0.00, +2 %, -2 %, 0.0° | F | 1 | 2/2 of 2 |
| sqbox-Pmmm-generic | mmm |  | free, 3414, 0.00, +7 %, +7 %, 10.3° | free, 3090, 6.54, +1 %, -0 %, 5.1° |  | 3 | 2/2 of 2 |
| sqbox-P4m-on | 4/m | air 0.81 | rejected, 3062, 0.00, — | held, 3952, 0.00, +10 %, +1 %, 90.0° | F | 3 | 1/2 of 2 |
| sqbox-P4m-near | 4/m |  | free, 3786, 0.00, +63 %, +63 %, 11.6° | free, 1892, 0.00, +0 %, +0 %, 0.2° |  | 2 | 2/2 of 2 |
| sqbox-P4mmm-near | 4/mmm |  | held, 4643, 0.00, +10 %, +10 %, 1.9° | free, 3605, 0.00, +1 %, -1 %, 0.7° |  | 1 | 2/2 of 2 |
| sqbox-P4mmm-generic | 4/mmm | air 0.66 | free, 5598, 0.00, +48 %, +13 %, 33.3° | free, 1910, 0.00, +1 %, -0 %, 1.4° | F | 1 | 1/2 of 2 |
| sqbox-P-3-on | -3 |  | held, 3469, 0.00, +209 %, +209 %, 90.0° | held, 2600, 0.00, +1 %, +0 %, 0.0° |  | 1 | 2/2 of 2 |
| sqbox-P-3-generic | -3 | hump 0.84 | free, 3548, 0.00, +71 %, +29 %, 10.5° | free, 2780, 0.01, +38 %, +2 %, 2.9° | F | 1 | 1/2 of 2 |
| sqbox-P-3m1-on | -3m | po 0.70 | held, 3976, 0.00, +179 %, +179 %, 73.8° | free, 7210, 0.00, +30 %, -30 %, 20.2° | F | 2 | 1/1 of 2 |
| sqbox-P-3m1-near | -3m | hump 0.47 | held, 3751, 0.00, +51 %, +44 %, 89.9° | free, 8162, 0.00, +9 %, -1 %, 5.1° | F | 1 | 0/2 of 2 |
| sqbox-P6m-near | 6/m |  | rejected, 3174, 0.00, — | free, 2290, 0.00, +0 %, +0 %, 2.3° |  | 2 | 2/2 of 2 |
| sqbox-P6m-generic | 6/m |  | held, 3876, 0.00, +62 %, +31 %, 83.8° | free, 2202, 59.02, +3 %, -1 %, 0.7° |  | 2 | 2/2 of 2 |
| sqbox-P6mmm-on | 6/mmm |  | held, 4049, 0.00, +502 %, +502 %, 90.0° | held, 4607, 0.00, +5 %, -1 %, 0.0° |  | 1 | 2/2 of 2 |
| sqbox-P6mmm-generic | 6/mmm | impurity 0.95 | free, 4088, 0.00, +81 %, +54 %, 78.3° | free, 2331, 0.00, +21 %, -1 %, 0.7° | F | 1 | 2/2 of 2 |
| sqbox-Pm-3-on | m-3 |  | held, 3095, 0.00, +46 %, +46 %, 0.0° | held, 1961, 0.00, +0 %, -0 %, 0.0° |  | 1 | 2/2 of 2 |
| sqbox-Pm-3-near | m-3 |  | held, 3489, 0.00, +32 %, +32 %, 5.0° | free, 2443, 0.00, +1 %, +1 %, 5.1° |  | 1 | 2/2 of 2 |
| sqbox-Pm-3m-near | m-3m |  | rejected, 3454, 0.00, — | free, 1707, 0.00, +1 %, +0 %, 0.6° |  | 1 | 2/2 of 2 |
| sqbox-Pm-3m-generic | m-3m | po 0.55 | free, 3664, 0.00, +49 %, +22 %, 23.0° | free, 2929, 0.00, +14 %, +0 %, 18.6° | F | 2 | 1/2 of 2 |
| cylinder-P-1-on | -1 | hump 0.18 | free, 3609, 0.00, +28 %, -5 %, 3.7° | free, 2014, 0.00, +6 %, +1 %, 2.2° | F | 1 | 0/2 of 2 |
| cylinder-P-1-generic | -1 |  | free, 3875, 0.00, +∞, +15 %, 3.1° | free, 2125, 0.00, +1 %, +0 %, 0.3° |  | 1 | 2/2 of 2 |
| cylinder-P2m-on | 2/m | impurity 0.63 | free, 3345, 0.00, +28 %, +4 %, 6.1° | held, 1949, 0.00, +19 %, -2 %, 0.0° | F | 1 | 1/2 of 2 |
| cylinder-P2m-near | 2/m |  | free, 2696, 0.00, +8 %, +4 %, 5.7° | free, 3653, 0.00, +7 %, -7 %, 7.4° |  | 2 | 2/2 of 2 |
| cylinder-Pmmm-near | mmm |  | held, 3469, 0.00, +24 %, +24 %, 3.3° | free, 1435, 0.00, +2 %, +1 %, 1.1° |  | 1 | 2/2 of 2 |
| cylinder-Pmmm-generic | mmm |  | free, 4744, 0.00, +29 %, +6 %, 50.0° | free, 1441, 0.00, +0 %, +0 %, 0.2° |  | 1 | 2/2 of 2 |
| cylinder-P4m-on | 4/m |  | free, 4058, 0.00, +11 %, +11 %, 6.4° | held, 1934, 0.00, +0 %, +0 %, 0.0° |  | 1 | 2/2 of 2 |
| cylinder-P4m-generic | 4/m |  | free, 3235, 0.00, +31 %, +31 %, 18.8° | free, 1429, 0.00, +1 %, +0 %, 0.6° |  | 1 | 2/2 of 2 |
| cylinder-P4mmm-on | 4/mmm |  | held, 3513, 0.00, +19 %, +19 %, 0.0° | held, 2707, 0.00, +0 %, -0 %, 0.0° |  | 1 | 2/2 of 2 |
| cylinder-P4mmm-near | 4/mmm | impurity 0.90 | held, 3478, 0.02, +33 %, +33 %, 7.1° | free, 2656, 0.00, +22 %, +0 %, 3.1° | F | 1 | 1/2 of 2 |
| cylinder-P-3-near | -3 |  | free, 2934, 0.00, +30 %, +30 %, 13.6° | free, 2515, 0.00, +6 %, -1 %, 0.9° |  | 1 | 2/2 of 2 |
| cylinder-P-3-generic | -3 | po 0.98 | free, 2788, 0.06, +∞, +10 %, 11.9° | free, 2155, 0.00, +∞, -2 %, 3.1° | F | 2 | 1/2 of 2 |
| cylinder-P-3m1-on | -3m |  | held, 2757, 0.00, +16 %, +5 %, 0.0° | held, 2220, 0.00, +0 %, +0 %, 0.0° |  | 1 | 2/2 of 2 |
| cylinder-P-3m1-generic | -3m | po 0.92 | free, 2702, 0.00, +88 %, -44 %, 33.2° | held, 4084, 0.00, +34 %, -34 %, 13.4° | F | 4 | 2/2 of 2 |
| cylinder-P6m-on | 6/m |  | held, 2662, 0.00, +31 %, +31 %, 90.0° | held, 2192, 0.00, +1 %, +1 %, 0.0° |  | 1 | 2/2 of 2 |
| cylinder-P6m-near | 6/m | air 0.00 | held, 2597, 0.00, +43 %, +39 %, 19.8° | held, 2412, 0.00, +12 %, +2 %, 13.0° |  | 3 | 1/1 of 2 |
| cylinder-P6mmm-near | 6/mmm | air 0.32 | held, 3238, 0.00, +100 %, +100 %, 85.6° | free, 1564, 0.00, +2 %, +1 %, 0.8° |  | 1 | 2/2 of 2 |
| cylinder-P6mmm-generic | 6/mmm |  | free, 3579, 0.00, +39 %, +39 %, 5.8° | free, 1611, 0.00, +2 %, +1 %, 0.4° |  | 1 | 2/2 of 2 |
| cylinder-Pm-3-on | m-3 | sizedist 0.02 | held, 2773, 0.00, +68 %, +68 %, 0.0° | free, 1421, 0.00, +1 %, +1 %, 2.3° |  | 1 | 0/0 of 2 |
| cylinder-Pm-3-generic | m-3 | hump 0.57 | held, 3920, 0.00, +25 %, +1 %, 14.0° | free, 4723, 0.00, +13 %, -13 %, 14.3° | F | 2 | 0/2 of 2 |
| cylinder-Pm-3m-on | m-3m | sizedist 0.72 | held, 3146, 0.00, +29 %, +29 %, 0.0° | free, 6568, 1514.06, +18 %, +3 %, 0.0° | F | 1 | 0/2 of 2 |
| cylinder-Pm-3m-near | m-3m |  | held, 2399, 0.00, +9 %, +9 %, 3.7° | free, 1451, 0.00, +0 %, -0 %, 1.3° |  | 1 | 2/2 of 2 |
| ellcyl-P-1-near | -1 | po 0.82 | free, 7318, 0.00, +∞, +343 %, 85.9° | free, 3971, 0.00, +∞, +481 %, 87.8° | F | 2 | 2/2 of 3 |
| ellcyl-P-1-generic | -1 | impurity 0.44 | free, 3792, 0.00, +20 %, +14 %, 0.5° | free, 2592, 0.00, +1 %, -1 %, 0.3° | F | 1 | 2/3 of 3 |
| ellcyl-P2m-on | 2/m | sizedist 0.62 | held, 4258, 17.68, +302 %, +302 %, 0.0° | free, 4691, 0.00, +156 %, -3 %, 12.4° | F | 1 | 0/2 of 3 |
| ellcyl-P2m-generic | 2/m |  | free, 4319, 0.00, +19 %, +18 %, 18.3° | free, 2534, 0.00, +4 %, +0 %, 2.6° |  | 1 | 3/3 of 3 |
| ellcyl-Pmmm-on | mmm | air 0.13 | held, 3736, 0.00, +13 %, +3 %, 0.0° | held, 3121, 0.00, +1 %, +1 %, 0.0° |  | 1 | 3/3 of 3 |
| ellcyl-Pmmm-near | mmm | hump 0.67 | held, 5261, 0.00, +66 %, +66 %, 1.0° | free, 6853, 46.13, +7 %, +0 %, 8.3° | F | 1 | 3/3 of 3 |
| ellcyl-P4m-near | 4/m | sizedist 0.26 | held, 9968, 35.80, +20 %, +8 %, 1.0° | free, 6379, 0.00, +16 %, +3 %, 1.2° | F | 1 | 1/3 of 3 |
| ellcyl-P4m-generic | 4/m |  | free, 4291, 0.00, +50 %, +22 %, 15.3° | free, 3225, 0.00, +5 %, -1 %, 0.5° |  | 1 | 3/3 of 3 |
| ellcyl-P4mmm-on | 4/mmm |  | held, 4305, 2.99, +49 %, +7 %, 0.0° | held, 4154, 0.00, +1 %, -0 %, 0.0° |  | 1 | 3/3 of 3 |
| ellcyl-P4mmm-generic | 4/mmm | hump 0.06 | free, 4913, 0.00, +284 %, +284 %, 3.5° | free, 2986, 0.00, +7 %, +3 %, 0.5° |  | 1 | 1/1 of 3 |
| ellcyl-P-3-on | -3 | impurity 0.28 | free, 4490, 0.00, +50 %, +50 %, 20.9° | held, 6783, 0.00, +3 %, -3 %, 0.0° | F | 1 | 2/3 of 3 |
| ellcyl-P-3-near | -3 |  | free, 5281, 2.67, +60 %, +18 %, 35.2° | free, 2282, 0.00, +14 %, -0 %, 1.3° |  | 1 | 3/3 of 3 |
| ellcyl-P-3m1-near | -3m | sizedist 0.93 | held, 4316, 0.00, +121 %, +4 %, 23.3° | free, 4654, 0.66, +∞, -4 %, 5.2° | F | 2 | 2/3 of 3 |
| ellcyl-P-3m1-generic | -3m |  | free, 4802, 0.00, +21 %, -16 %, 29.9° | held, 4467, 0.00, +4 %, -0 %, 2.1° |  | 2 | 3/3 of 3 |
| ellcyl-P6m-on | 6/m |  | held, 4594, 0.00, +94 %, +5 %, 0.0° | free, 2563, 131.32, +562 %, -4 %, 6.2° |  | 1 | 0/0 of 3 |
| ellcyl-P6m-generic | 6/m |  | free, 5182, 0.00, +191 %, +191 %, 24.6° | free, 4356, 0.00, +8 %, +1 %, 7.2° |  | 2 | 3/3 of 3 |
| ellcyl-P6mmm-on | 6/mmm |  | held, 4347, 62.91, +551 %, +551 %, 90.0° | held, 3514, 0.00, +0 %, +0 %, 0.0° |  | 1 | 3/3 of 3 |
| ellcyl-P6mmm-near | 6/mmm | po 0.20 | held, 3988, 0.00, +62 %, +62 %, 2.1° | free, 3853, 0.00, +568 %, +568 %, 58.6° | F | 1 | 0/0 of 3 |
| ellcyl-Pm-3-near | m-3 |  | held, 3728, 2.56, +304 %, +304 %, 4.2° | free, 7403, 0.00, +1 %, +1 %, 2.4° |  | 2 | 3/3 of 3 |
| ellcyl-Pm-3-generic | m-3 |  | early, 2326, —, — | free, 9566, 0.00, +84 %, -2 %, 1.2° |  | 2 | 3/3 of 3 |
| ellcyl-Pm-3m-on | m-3m | air 0.27 | held, 4772, 0.02, +37 %, +37 %, 0.0° | free, 3409, 0.35, +∞, +2 %, 11.7° |  | 2 | 3/3 of 3 |
| ellcyl-Pm-3m-generic | m-3m |  | held, 3130, 0.00, +191 %, +191 %, 8.4° | free, 2763, 0.00, +30 %, +0 %, 7.3° |  | 2 | 1/1 of 3 |
| ellipsoid-P-1-on | -1 |  | free, 3850, 0.00, +12 %, +2 %, 4.2° | held, 2332, 0.00, +2 %, +1 %, 0.0° |  | 1 | 3/3 of 3 |
| ellipsoid-P-1-near | -1 |  | free, 3691, 0.00, +25 %, +9 %, 4.3° | free, 1949, 0.00, +1 %, -1 %, 0.8° |  | 1 | 3/3 of 3 |
| ellipsoid-P2m-near | 2/m |  | held, 4554, 0.00, +19 %, +9 %, 4.3° | held, 2808, 0.00, +2 %, +1 %, 4.3° |  | 1 | 3/3 of 3 |
| ellipsoid-P2m-generic | 2/m | air 0.45 | free, 4119, 0.00, +21 %, +21 %, 2.6° | free, 1959, 0.00, +0 %, +0 %, 0.3° | F | 1 | 3/3 of 3 |
| ellipsoid-Pmmm-on | mmm | hump 0.86 | free, 4085, 0.00, +∞, +3 %, 1.6° | held, 7030, 0.00, +7 %, +0 %, 0.0° | F | 1 | 2/2 of 3 |
| ellipsoid-Pmmm-generic | mmm |  | free, 3069, 0.00, +18 %, +10 %, 1.5° | free, 2075, 0.00, +4 %, -0 %, 0.9° |  | 1 | 2/2 of 3 |
| ellipsoid-P4m-on | 4/m | hump 0.29 | held, 6846, 0.00, +14 %, -3 %, 0.0° | held, 3470, 0.00, +1 %, -0 %, 0.0° | F | 1 | 2/3 of 3 |
| ellipsoid-P4m-near | 4/m |  | free, 4584, 0.00, +89 %, +41 %, 19.1° | free, 3239, 0.00, +8 %, +1 %, 0.9° |  | 2 | 3/3 of 3 |
| ellipsoid-P4mmm-near | 4/mmm | sizedist 0.49 | held, 6667, 0.00, +12 %, +7 %, 4.4° | free, 2958, 0.00, +∞, -9 %, 8.3° | F | 1 | 1/2 of 3 |
| ellipsoid-P4mmm-generic | 4/mmm | impurity 0.12 | held, 4423, 0.17, +37 %, +25 %, 20.0° | free, 2342, 0.00, +14 %, -5 %, 2.0° | F | 1 | 1/3 of 3 |
| ellipsoid-P-3-on | -3 |  | free, 5959, 0.13, +21 %, +21 %, 28.2° | held, 2496, 0.00, +0 %, -0 %, 0.0° |  | 1 | 3/3 of 3 |
| ellipsoid-P-3-generic | -3 | impurity 0.73 | free, 3969, 0.38, +38 %, +33 %, 32.1° | free, 16279, 0.00, +116 %, +3 %, 14.5° | F | 1 | 3/3 of 3 |
| ellipsoid-P-3m1-on | -3m |  | held, 4071, 0.00, +29 %, +11 %, 0.0° | held, 5691, 0.00, +14 %, -1 %, 0.0° |  | 2 | 3/3 of 3 |
| ellipsoid-P-3m1-near | -3m |  | held, 5627, 0.00, +50 %, +50 %, 29.8° | free, 1653, 0.00, +0 %, -0 %, 0.5° |  | 1 | 3/3 of 3 |
| ellipsoid-P6m-near | 6/m |  | held, 3701, 0.00, +76 %, +76 %, 6.8° | held, 9944, 0.00, +77 %, +3 %, 6.8° |  | 2 | 3/3 of 3 |
| ellipsoid-P6m-generic | 6/m | po 0.79 | held, 4231, 0.00, +40 %, +19 %, 14.6° | free, 2816, 0.00, +101 %, -26 %, 2.3° | F | 1 | 0/3 of 3 |
| ellipsoid-P6mmm-on | 6/mmm |  | held, 5224, 0.00, +14 %, +14 %, 0.0° | held, 7726, 0.00, +1 %, +0 %, 0.0° |  | 1 | 3/3 of 3 |
| ellipsoid-P6mmm-generic | 6/mmm | air 0.94 | held, 4015, 0.00, +58 %, +58 %, 19.2° | free, 1813, 0.00, +5 %, +5 %, 2.5° | F | 2 | 2/3 of 3 |
| ellipsoid-Pm-3-on | m-3 | po 0.23 | held, 4148, 0.05, +94 %, +9 %, 0.0° | held, 3477, 0.00, +3 %, +2 %, 0.0° |  | 1 | 3/3 of 3 |
| ellipsoid-Pm-3-near | m-3 | air 0.89 | held, 4344, 0.00, +59 %, +7 %, 13.5° | free, 2507, 0.00, +∞, -5 %, 13.7° |  | 2 | 3/3 of 3 |
| ellipsoid-Pm-3m-near | m-3m |  | early, 2134, —, — | held, 3539, 0.00, +14 %, +1 %, 3.2° |  | 1 | 3/3 of 3 |
| ellipsoid-Pm-3m-generic | m-3m | sizedist 0.77 | held, 4036, 0.00, +76 %, +76 %, 32.5° | free, 51971, 0.00, +125 %, -10 %, 4.8° | F | 1 | 1/1 of 3 |
| spheroid-P-1-on | -1 | air 0.21 | free, 3215, 0.00, +18 %, +11 %, 2.1° | held, 1635, 0.00, +5 %, +0 %, 0.0° |  | 1 | 2/2 of 2 |
| spheroid-P-1-generic | -1 | po 0.50 | free, 4110, 0.00, +289 %, +289 %, 88.7° | free, 2010, 0.00, +308 %, +308 %, 88.0° | F | 1 | 0/1 of 2 |
| spheroid-P2m-on | 2/m | impurity 0.85 | free, 4425, 0.00, +1075 %, +9 %, 4.1° | free, 5084, 0.12, +10 %, -6 %, 1.3° | F | 1 | 1/2 of 2 |
| spheroid-P2m-near | 2/m |  | free, 2880, 0.00, +2 %, -2 %, 6.3° | free, 1473, 0.00, +0 %, -0 %, 0.4° |  | 1 | 2/2 of 2 |
| spheroid-Pmmm-near | mmm | air 0.97 | held, 4414, 0.00, +8 %, +8 %, 6.1° | held, 1669, 0.00, +0 %, +0 %, 6.1° |  | 1 | 2/2 of 2 |
| spheroid-Pmmm-generic | mmm | sizedist 0.54 | free, 4528, 0.00, +10 %, +9 %, 23.1° | free, 1468, 0.00, +25 %, -1 %, 4.8° | F | 1 | 0/1 of 2 |
| spheroid-P4m-on | 4/m | impurity 0.37 | held, 4069, 0.00, +16 %, +10 %, 0.0° | held, 2127, 0.00, +1 %, -0 %, 0.0° | F | 1 | 2/2 of 2 |
| spheroid-P4m-generic | 4/m |  | held, 2479, 0.00, +54 %, +54 %, 44.1° | free, 3961, 0.00, +1 %, +1 %, 8.4° |  | 3 | 2/2 of 2 |
| spheroid-P4mmm-on | 4/mmm | hump 0.78 | held, 4741, 0.00, +5 %, +1 %, 0.0° | held, 3107, 0.00, +3 %, -0 %, 0.0° | F | 1 | 2/2 of 2 |
| spheroid-P4mmm-near | 4/mmm | po 0.05 | held, 3713, 0.00, +15 %, -14 %, 4.9° | free, 2319, 0.00, +4 %, -3 %, 11.0° |  | 1 | 1/1 of 2 |
| spheroid-P-3-near | -3 |  | held, 2698, 0.00, +11 %, +11 %, 33.0° | held, 3037, 0.00, +6 %, -6 %, 13.2° |  | 2 | 2/2 of 2 |
| spheroid-P-3-generic | -3 |  | held, 5181, 0.00, +320 %, +320 %, 87.2° | free, 1553, 0.00, +2 %, -0 %, 0.4° |  | 2 | 2/2 of 2 |
| spheroid-P-3m1-on | -3m |  | free, 2686, 0.00, +41 %, +32 %, 6.8° | held, 1457, 0.00, +1 %, -0 %, 0.0° |  | 2 | 2/2 of 2 |
| spheroid-P-3m1-generic | -3m |  | free, 4059, 0.00, +47 %, +47 %, 4.0° | free, 1204, 0.00, +1 %, -0 %, 0.1° |  | 1 | 2/2 of 2 |
| spheroid-P6m-on | 6/m | sizedist 0.84 | free, 2646, 0.00, +42 %, +21 %, 6.9° | held, 1425, 0.00, +179 %, +179 %, 28.5° |  | 2 | 0/0 of 2 |
| spheroid-P6m-near | 6/m | hump 1.00 | held, 5187, 0.00, +59 %, +56 %, 86.5° | held, 1739, 0.00, +1 %, -0 %, 4.9° | F | 1 | 2/2 of 2 |
| spheroid-P6mmm-near | 6/mmm | hump 0.44 | held, 5998, 0.00, +185 %, +185 %, 89.1° | free, 2308, 0.00, +7 %, -7 %, 1.3° | F | 1 | 0/2 of 2 |
| spheroid-P6mmm-generic | 6/mmm | sizedist 0.59 | held, 3306, 0.00, +25 %, +25 %, 66.2° | free, 1196, 0.00, +60 %, +60 %, 13.3° | F | 1 | 0/0 of 2 |
| spheroid-Pm-3-on | m-3 |  | early, 1839, —, — | held, 1580, 0.00, +14 %, -3 %, 15.8° |  | 1 | 0/0 of 2 |
| spheroid-Pm-3-generic | m-3 |  | early, 1885, —, — | free, 1118, 0.00, +4 %, +4 %, 6.0° |  | 1 | 1/1 of 2 |
| spheroid-Pm-3m-on | m-3m |  | early, 1802, —, — | held, 944, 0.00, +1 %, +0 %, 0.0° |  | 1 | 2/2 of 2 |
| spheroid-Pm-3m-near | m-3m |  | early, 1840, —, — | free, 1871, 0.00, +3 %, -0 %, 2.5° |  | 1 | 2/2 of 2 |
| sphere-P-1-2 | -1 |  | rejected, 3349, —, — | rejected, 1642, —, — |  | — | — |
| sphere-P-1-3 | -1 |  | early, 3079, —, — | early, 1470, —, — |  | — | — |
| sphere-P2m-1 | 2/m |  | rejected, 3968, —, — | early, 1210, —, — |  | — | — |
| sphere-P2m-3 | 2/m |  | early, 2840, —, — | early, 1264, —, — |  | — | — |
| sphere-Pmmm-1 | mmm |  | free, 2908, —, — | early, 947, —, — |  | — | — |
| sphere-Pmmm-2 | mmm | hump 0.44 | free, 7746, —, — | free, 5987, —, — | F | — | — |
| sphere-P4m-2 | 4/m |  | rejected, 3291, —, — | early, 1182, —, — |  | — | — |
| sphere-P4m-3 | 4/m | sizedist 0.95 | early, 2505, —, — | free, 1724, —, — |  | — | — |
| sphere-P4mmm-1 | 4/mmm |  | rejected, 3421, —, — | early, 1166, —, — |  | — | — |
| sphere-P4mmm-3 | 4/mmm | air 0.02 | early, 2107, —, — | early, 1021, —, — | F | — | — |
| sphere-P-3-1 | -3 |  | free, 4717, —, — | early, 1119, —, — |  | — | — |
| sphere-P-3-2 | -3 | impurity 0.83 | rejected, 3814, —, — | early, 1153, —, — | F | — | — |
| sphere-P-3m1-2 | -3m |  | rejected, 3027, —, — | early, 895, —, — |  | — | — |
| sphere-P-3m1-3 | -3m | air 0.35 | free, 4222, —, — | early, 878, —, — | F | — | — |
| sphere-P6m-1 | 6/m |  | early, 1993, —, — | early, 730, —, — |  | — | — |
| sphere-P6m-3 | 6/m | impurity 0.14 | rejected, 2922, —, — | early, 944, —, — | F | — | — |
| sphere-P6mmm-1 | 6/mmm | po 0.59 | free, 6324, —, — | free, 8060, —, — | F | — | — |
| sphere-P6mmm-2 | 6/mmm | po 0.65 | held, 3271, —, — | rejected, 1007, —, — | F | — | — |
| sphere-Pm-3-2 | m-3 | hump 0.11 | early, 1922, —, — | early, 572, —, — | F | — | — |
| sphere-Pm-3-3 | m-3 |  | early, 1899, —, — | early, 572, —, — |  | — | — |
| sphere-Pm-3m-1 | m-3m |  | early, 1901, —, — | early, 561, —, — |  | — | — |
| sphere-Pm-3m-3 | m-3m | sizedist 0.71 | early, 1796, —, — | free, 958, —, — | F | — | — |

