# Step 3: the jackknife over lines on the kept truths

`scripts/step3/h/rep-jack.mjs --rows` on the C1 records (the jackknife run on every kept fit: at most 20 contiguous groups of segments, each weighted 0 and the fit refined from itself, 4 iterations and then up to 8 more). Flag: the adopted check; flagged segments: family-wise z > 3.09 by either statistic. Covered: the truth within D·e^(±2 sd) or D ± 2 esd (an unbounded extent apart); axes: the truth's most distinct axis within max(2·esd, 2·rms turn). Versions: the esds alone; the jackknife after 12 and after 4 iterations; only the groups that hold a flagged segment; one refit without the flagged segments (±2|Δ|; C1's refits without the k most significant segments, the first k at least the flagged count, at most 5).

FLAG: x.st.zseg > 3.09 || x.st.zb1 > 3.09; flagged segments: family-wise z > 3.09

| rows | version | runs | extents covered (unbounded apart) | extents beyond 25 %: covered | axes covered (beyond 10°: covered) | median half-width, ln D (× local) | median axis radius ° |
|---|---|---|---|---|---|---|---|
| flagged error rows | local | 24 | 28/56 (4) | 2/11 | 11/24 (0/7) | 3.2 % (1.0×) | 3.1 |
| flagged error rows | jack 12 | 24 | 51/56 (4) | 7/11 | 19/24 (2/7) | 18.6 % (4.9×) | 14.7 |
| flagged error rows | jack 4 | 24 | 51/56 (4) | 7/11 | 19/24 (2/7) | 16.8 % (4.6×) | 11.9 |
| flagged error rows | jack, flagged groups | 24 | 49/56 (4) | 6/11 | 17/24 (2/7) | 16.4 % (4.7×) | 10.2 |
| flagged error rows | refit without flagged | 24 | 42/56 (4) | 3/11 | 16/24 (2/7) | 9.5 % (2.1×) | 8.8 |
| flagged clean rows | local | 0 | 0/0 (0) | 0/0 | 0/0 (0/0) | — % (—×) | — |
| flagged clean rows | jack 12 | 0 | 0/0 (0) | 0/0 | 0/0 (0/0) | — % (—×) | — |
| flagged clean rows | jack 4 | 0 | 0/0 (0) | 0/0 | 0/0 (0/0) | — % (—×) | — |
| flagged clean rows | jack, flagged groups | 0 | 0/0 (0) | 0/0 | 0/0 (0/0) | — % (—×) | — |
| flagged clean rows | refit without flagged | 0 | 0/0 (0) | 0/0 | 0/0 (0/0) | — % (—×) | — |
| unflagged error rows | local | 9 | 15/23 (0) | 0/2 | 8/9 (0/1) | 2.6 % (1.0×) | 7.5 |
| unflagged error rows | jack 12 | 9 | 19/23 (0) | 0/2 | 8/9 (0/1) | 5.1 % (1.5×) | 8.7 |
| unflagged error rows | jack 4 | 9 | 18/23 (0) | 0/2 | 8/9 (0/1) | 5.1 % (1.3×) | 10.7 |
| unflagged error rows | jack, flagged groups | 9 | 15/23 (0) | 0/2 | 8/9 (0/1) | 2.4 % (1.0×) | 7.5 |
| unflagged error rows | refit without flagged | 9 | 15/23 (0) | 0/2 | 8/9 (0/1) | 2.4 % (1.0×) | 7.5 |
| all kept error rows | local | 33 | 43/79 (4) | 2/13 | 19/33 (0/8) | 3.1 % (1.0×) | 3.4 |
| all kept error rows | jack 12 | 33 | 70/79 (4) | 7/13 | 27/33 (2/8) | 12.3 % (3.3×) | 12.2 |
| all kept error rows | jack 4 | 33 | 69/79 (4) | 7/13 | 27/33 (2/8) | 12.8 % (3.5×) | 11.0 |
| all kept error rows | jack, flagged groups | 33 | 64/79 (4) | 6/13 | 25/33 (2/8) | 10.6 % (2.1×) | 9.6 |
| all kept error rows | refit without flagged | 33 | 57/79 (4) | 3/13 | 24/33 (2/8) | 6.9 % (1.0×) | 8.7 |
| all kept clean rows | local | 33 | 65/82 (0) | 1/3 | 26/32 (1/3) | 2.0 % (1.0×) | 2.3 |
| all kept clean rows | jack 12 | 33 | 79/82 (0) | 3/3 | 28/32 (1/3) | 3.5 % (1.3×) | 4.3 |
| all kept clean rows | jack 4 | 33 | 79/82 (0) | 3/3 | 28/32 (1/3) | 3.4 % (1.2×) | 3.8 |
| all kept clean rows | jack, flagged groups | 33 | 65/82 (0) | 1/3 | 26/32 (1/3) | 1.6 % (1.0×) | 2.3 |
| all kept clean rows | refit without flagged | 33 | 65/82 (0) | 1/3 | 26/32 (1/3) | 1.6 % (1.0×) | 2.3 |

Cost on 66 kept truths (median, range; × the fit's own iso + search + report in the same process): groups 13 (7–20); full jackknife 1789 evaluations (0.44×, 0.12–1.13), 7.5 s wall (0.42×); 4 iterations 0.27×; refits reaching 12 iterations 75/877; flagged groups only (flagged rows) 0.18×; one refit without the flagged 0.06×.


## Per run (error rows, and any clean row flagged)

| row | error | flag | flagged segments | worst | extents: error / local hw / jack 2sd (ln) | axis: error / local / jack ° |
|---|---|---|---|---|---|---|
| box-P2m-generic | air 0.17 |  | 0/32 |  | -0.01/0.02/0.03, -0.03/0.03/0.05, -0.03/0.32/0.77 | 1.4/4.7/12.3 |
| box-Pmmm-on | po 0.06 | yes | 16/27 | extent 342 % | -0.01/0.01/0.07, -0.01/0.03/0.08, 1.49/13.60/0.78 | 4.2/0.6/4.9 |
| box-P-3-on | sizedist 0.12 |  | 0/8 |  | 0.00/0.05/0.02, 0.02/0.03/0.11, 0.07/0.52/0.02 | 0.0/8.7/8.7 |
| box-P6mmm-on | impurity 0.57 | yes | 2/13 | unbounded | -0.12/0.03/0.25, -0.01/0.04/0.28, ∞/—/∞ | 5.3/0.9/7.4 |
| box-Pm-3-near | impurity 0.76 | yes | 2/9 |  | 0.03/0.04/0.12, 0.02/0.05/0.07, 0.04/0.13/0.31 | 8.2/1.7/17.5 |
| box-Pm-3m-generic | hump 0.64 | yes | 9/9 |  | -0.00/0.02/0.06, -0.03/0.06/0.38, 0.00/0.27/0.44 | 9.9/72.1/72.1 |
| sqbox-P-1-on | sizedist 0.19 |  | 0/7 |  | 0.01/0.01/0.03, 0.03/0.01/0.02 | 0.5/1.1/3.1 |
| sqbox-P4m-on | air 0.81 | yes | 6/16 | axis 90.0° | -0.12/0.04/0.18, 0.02/0.03/0.05 | 90.0/1.5/1.5 |
| sqbox-P-3-generic | hump 0.84 | yes | 2/13 | extent 39 % | 0.02/0.02/0.04, -0.49/0.34/0.93 | 2.8/2.8/21.3 |
| sqbox-P-3m1-on | po 0.70 | yes | 3/11 | extent 30 % | -0.02/0.05/0.09, -0.36/0.06/0.31 | 20.2/4.1/12.2 |
| sqbox-P6mmm-generic | impurity 0.95 | yes | 10/12 |  | -0.01/0.02/0.05, -0.24/0.27/0.60 | 0.7/2.9/11.0 |
| cylinder-P2m-on | impurity 0.63 | yes | 2/28 |  | -0.02/0.02/0.07, -0.21/0.18/0.37 | 0.0/9.9/9.9 |
| cylinder-P-3m1-generic | po 0.92 | yes | 3/11 | extent 34 % | -0.08/0.10/0.44, -0.42/0.13/0.60 | 13.4/12.8/12.8 |
| cylinder-P6mmm-near | air 0.32 |  | 0/12 |  | 0.01/0.02/0.04, 0.01/0.06/0.05 | 0.9/6.2/8.2 |
| cylinder-Pm-3-generic | hump 0.57 | yes | 7/9 | axis 14.3° | 0.05/0.02/0.12, -0.14/0.02/0.27 | 14.3/0.8/37.1 |
| cylinder-Pm-3m-on | sizedist 0.72 | yes | 9/9 |  | 0.17/0.02/0.66, 0.05/0.01/0.09 | 0.0/0.2/0.2 |
| ellcyl-P-1-near | po 0.82 | yes | 20/22 | unbounded | 1.76/0.08/0.58, ∞/—/0.00, -1.59/0.01/0.12 | 87.8/3.1/27.2 |
| ellcyl-Pmmm-on | air 0.13 |  | 0/20 |  | 0.01/0.03/0.10, -0.01/0.02/0.04, 0.00/0.04/0.51 | 0.0/7.5/7.5 |
| ellcyl-P4m-near | sizedist 0.26 | yes | 10/13 |  | 0.03/0.00/0.06, 0.14/0.01/0.29, 0.00/0.01/0.17 | 1.2/0.6/16.9 |
| ellcyl-P4mmm-generic | hump 0.06 |  | 0/14 |  | 0.03/—/0.16, 0.06/—/0.25, 0.02/0.02/0.02 | 0.5/1.4/5.0 |
| ellcyl-P-3-on | impurity 0.28 | yes | 1/10 |  | -0.03/0.02/0.04, 0.03/0.04/0.05, -0.02/0.03/0.02 | 0.0/2.2/2.2 |
| ellcyl-P-3m1-near | sizedist 0.93 | yes | 1/11 | unbounded | -0.04/0.02/0.28, ∞/—/0.00, 0.01/0.10/0.97 | 5.0/3.9/71.7 |
| ellipsoid-P4m-on | hump 0.29 | yes | 5/13 |  | -0.00/0.01/0.04, -0.01/0.01/0.06, 0.00/0.02/1.05 | 0.0/3.8/3.8 |
| ellipsoid-P4mmm-near | sizedist 0.49 | yes | 3/12 | unbounded | -0.09/0.01/0.06, 0.34/0.05/0.50, ∞/—/0.00 | 8.3/3.1/16.6 |
| ellipsoid-P-3-generic | impurity 0.73 | yes | 7/14 | extent 117 % | 0.03/0.04/0.19, 0.02/0.09/0.17, 0.77/1.30/∞ | 14.6/11.2/41.3 |
| ellipsoid-P6mmm-generic | air 0.94 | yes | 8/13 |  | 0.05/0.03/0.12, -0.03/0.07/0.11, 0.02/0.06/0.19 | 2.5/3.4/5.3 |
| ellipsoid-Pm-3-on | po 0.23 |  | 0/9 |  | 0.02/0.02/0.03, 0.02/0.04/0.03, 0.03/—/0.20 | 0.0/11.9/11.9 |
| spheroid-P-1-generic | po 0.50 | yes | 14/20 | extent 308 % | -0.61/0.01/0.21, 1.41/0.15/3.62 | 88.0/1.3/27.1 |
| spheroid-P2m-on | impurity 0.85 | yes | 8/8 |  | -0.06/0.01/0.12, -0.06/0.09/0.19 | 0.0/3.3/3.3 |
| spheroid-Pmmm-near | air 0.97 |  | 0/22 |  | 0.00/0.01/0.01, -0.00/0.02/0.01 | 6.1/12.8/12.8 |
| spheroid-P4mmm-on | hump 0.78 | yes | 5/12 |  | -0.03/0.03/0.07, -0.00/0.02/0.11 | 0.0/17.4/17.4 |
| spheroid-P6m-on | sizedist 0.84 |  | 0/13 | extent 179 % | 1.03/0.11/0.49, -1.52/0.09/0.11 | 28.5/17.8/17.8 |
| spheroid-P6mmm-near | hump 0.44 | yes | 9/12 |  | -0.06/0.03/0.20, -0.07/0.03/0.26 | 1.3/5.3/22.5 |
