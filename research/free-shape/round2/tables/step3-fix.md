# Step 3: what the check does beyond widening, on the prototype's runs

`scripts/step3/hp/rep-fixP.mjs --rows` on the prototype's records (`$W/fs2/step3/hp/results/P1`: the engine's check and jackknife, and methods/proto.mjs's refits without the flagged segments). Rules on a kept fit whose check fired: R0 nothing (today); R1 marked; R2 the shape refitted without the flagged segments and reported so (a: all of them where 2 segments are left; t: at most a third, the worst first); R3 the keep test again without them (kept below ΔBIC −10); R4 R2 and R3 together; R5 not supported (the isotropic size). Harmful, harmless: the error row's result spoiled or not (an extent beyond 25 % or unbounded, the axis beyond 10°); harmless lost: a shape read well and rejected. The second table: the prototype's report (esds; with jackLo, jackHi and jackTurn where the check fired).

| rule | spheres: false shapes (marked) | error truths kept / lost | unbounded | harmful kept (marked) | harmless kept, marked | harmless lost | clean truths kept / lost | clean marked |
|---|---|---|---|---|---|---|---|---|
| R0 | 2/11 (0) | 33 / 0 | 4 | 13 (0) | 0 | 0 | 33 / 0 | 0 |
| R1 | 2/11 (2) | 33 / 0 | 4 | 13 (12) | 12 | 0 | 33 / 0 | 0 |
| R2a | 2/11 (2) | 33 / 0 | 2 | 11 (10) | 14 | 0 | 33 / 0 | 0 |
| R2t | 2/11 (2) | 33 / 0 | 1 | 11 (10) | 14 | 0 | 33 / 0 | 0 |
| R3a | 1/11 (1) | 26 / 7 | 3 | 8 (7) | 10 | 2 | 33 / 0 | 0 |
| R3t | 1/11 (1) | 29 / 4 | 4 | 9 (8) | 12 | 0 | 33 / 0 | 0 |
| R4a | 1/11 (1) | 26 / 7 | 2 | 7 (6) | 11 | 2 | 33 / 0 | 0 |
| R4t | 1/11 (1) | 29 / 4 | 1 | 9 (8) | 12 | 0 | 33 / 0 | 0 |
| R5 | 0/11 (0) | 9 / 24 | 0 | 1 (0) | 0 | 12 | 33 / 0 | 0 |


## The prototype's report: coverage

| kept truths | report | runs | extents covered (unbounded apart) | beyond 25 %: covered | axes covered (beyond 10°: covered) | median half-width, ln D | median axis radius ° |
|---|---|---|---|---|---|---|---|
| flagged, with an error | esds alone | 24 | 28/56 (4) | 2/11 | 11/24 (0/7) | 3.2 % | 3.1 |
| flagged, with an error | esds and jackknife | 24 | 51/56 (4) | 7/11 | 19/24 (2/7) | 16.8 % | 11.9 |
| flagged, clean | esds alone | 0 | 0/0 (0) | 0/0 | 0/0 (0/0) | — % | — |
| not flagged, with an error | esds alone | 9 | 15/23 (0) | 0/2 | 8/9 (0/1) | 2.4 % | 7.5 |
| not flagged, clean | esds alone | 33 | 65/82 (0) | 1/3 | 26/32 (1/3) | 1.6 % | 2.3 |


## Per flagged kept fit

| row | error | outcome | flagged segments (S) | z seg, z bin | ΔBIC → without all, a third | worst, axis → refit all, a third |
|---|---|---|---|---|---|---|
| box-Pmmm-on | po 0.06 | free | 16 (27) | 46.3, 52.4 | -5090 → -937, -2557 | 342 %, 4.2° → ∞ %, 10.0°, 34 %, 4.6° |
| box-P6mmm-on | impurity 0.57 | free | 2 (13) | 28.1, 19.7 | -1914 → -1220, -1220 | ∞ %, 5.3° → 5740 %, 4.7°, 5740 %, 4.7° |
| box-Pm-3-near | impurity 0.76 | free | 2 (9) | 71.2, 53.9 | -580 → -838, -838 | 4 %, 8.2° → 5 %, 2.9°, 5 %, 2.9° |
| box-Pm-3m-generic | hump 0.64 | held | 9 (9) | 274.1, 210.6 | -1277 → —, -5096 | 3 %, 9.9° → —, 5 %, 9.9° |
| sqbox-P4m-on | air 0.81 | held | 6 (16) | 24.4, 25.4 | -152 → 2, 2 | 12 %, 90.0° → 4 %, 90.0°, 5 %, 90.0° |
| sqbox-P-3-generic | hump 0.84 | free | 2 (13) | 1.8, 7.3 | -230 → -127, -127 | 39 %, 2.8° → 34 %, 3.1°, 34 %, 3.1° |
| sqbox-P-3m1-on | po 0.70 | free | 3 (11) | 2.4, 5.6 | -847 → 5, 5 | 30 %, 20.2° → 16 %, 7.9°, 16 %, 7.9° |
| sqbox-P6mmm-generic | impurity 0.95 | free | 10 (12) | 256.2, 209.2 | -524 → 20, -2941 | 21 %, 0.7° → 35 %, 24.0°, 12 %, 1.1° |
| cylinder-P2m-on | impurity 0.63 | held | 2 (28) | 9.9, 13.9 | -2432 → -868, -868 | 19 %, 0.0° → 8 %, 0.0°, 8 %, 0.0° |
| cylinder-P-3m1-generic | po 0.92 | held | 3 (11) | 0.0, 8.0 | -151 → 1, 1 | 34 %, 13.4° → 29826 %, 13.4°, 29826 %, 13.4° |
| cylinder-Pm-3-generic | hump 0.57 | free | 7 (9) | 74.8, 57.1 | -1268 → 23, -4 | 13 %, 14.3° → 12 %, 9.6°, 2 %, 7.0° |
| cylinder-Pm-3m-on | sizedist 0.72 | held | 9 (9) | 71.9, 45.8 | -4754 → —, -1821 | 19 %, 0.0° → —, 174 %, 0.0° |
| ellcyl-P-1-near | po 0.82 | free | 20 (22) | 62.4, 56.6 | -5334 → 31, -1919 | ∞ %, 87.8° → 364 %, 86.6°, 2442 %, 88.6° |
| ellcyl-P4m-near | sizedist 0.26 | free | 10 (13) | 22.7, 17.7 | -8018 → -136, -4115 | 16 %, 1.2° → 19 %, 3.3°, 12 %, 5.2° |
| ellcyl-P-3-on | impurity 0.28 | held | 1 (10) | 53.8, 40.7 | -1474 → -1121, -1121 | 3 %, 0.0° → 1 %, 0.0°, 1 %, 0.0° |
| ellcyl-P-3m1-near | sizedist 0.93 | free | 1 (11) | 4.0, 7.3 | -2805 → -737, -737 | ∞ %, 5.0° → ∞ %, 22.9°, ∞ %, 22.9° |
| ellipsoid-P4m-on | hump 0.29 | held | 5 (13) | 16.0, 19.3 | -7216 → -1551, -1767 | 1 %, 0.0° → 1 %, 0.0°, 1 %, 0.0° |
| ellipsoid-P4mmm-near | sizedist 0.49 | free | 3 (12) | 4.5, 6.0 | -8858 → -5741, -5741 | ∞ %, 8.3° → 1919 %, 8.1°, 1919 %, 8.1° |
| ellipsoid-P-3-generic | impurity 0.73 | free | 7 (14) | 106.9, 71.5 | -800 → -801, -941 | 117 %, 14.6° → 9 %, 4.7°, 6 %, 4.1° |
| ellipsoid-P6mmm-generic | air 0.94 | free | 8 (13) | 22.9, 22.3 | -1804 → -299, -1293 | 5 %, 2.5° → 5 %, 5.4°, 1 %, 0.7° |
| spheroid-P-1-generic | po 0.50 | free | 14 (20) | 27.8, 26.8 | -2842 → -86, -343 | 308 %, 88.0° → 277 %, 80.6°, 648 %, 84.1° |
| spheroid-P2m-on | impurity 0.85 | held | 8 (8) | 292.4, 213.6 | -5354 → —, -7382 | 6 %, 0.0° → —, 0 %, 0.0° |
| spheroid-P4mmm-on | hump 0.78 | held | 5 (12) | 19.5, 22.3 | -7531 → -2074, -2206 | 3 %, 0.0° → 4 %, 0.0°, 4 %, 0.0° |
| spheroid-P6mmm-near | hump 0.44 | free | 9 (12) | 82.1, 64.0 | -1937 → 19, -388 | 7 %, 1.3° → 13 %, 7.2°, 8 %, 5.5° |
| sphere-P6mmm-1 | po 0.59 | free | 5 (13) | 7.0, 12.1 | -348 → 30, 12 | shape → shape, shape |
| sphere-Pm-3m-3 | sizedist 0.71 | free | 2 (9) | 4.5, 4.4 | -3483 → -216, -216 | shape → shape, shape |
