# Step 2: where WPPM's cost goes (`../STEP2.md` §3)

Whole runs (isotropic fit, search v2 'briefs', report), WPPM, one row per Laue class, on an engine copy with timers (`performance.now`) around WPPM's parts and no arithmetic change (`scripts/step2/prof/make-prof.mjs`, `runprof.sh`, `sum-run.mjs`). Two to three processes at nice 15 on 4 vCPUs; the timers are walls, so the shares are read within `phasePattern`.

## On step 1's engine

| row | class | CPU s | evaluations | ms an evaluation | phasePattern share of CPU | read-out | FFT | common factor | size A(L) | fill | lineNodes | rest | lines an evaluation | read-out points a line | N (% of lines) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| box-P-1-near | -1 | 352 | 4689 | 72.3 | 96 % | 58 % | 6 % | 3 % | 1 % | 1 % | 31 % | 1 % | 194 | 6308 | 1k:100 |
| box-P-3m1-near | -3m | 86 | 6032 | 13.7 | 96 % | 62 % | 9 % | 5 % | 2 % | 2 % | 17 % | 2 % | 62 | 4064 | 256:1 1k:99 2k:0 4k:0 |
| box-P4m-near | 4/m | 60 | 3664 | 15.4 | 94 % | 57 % | 11 % | 5 % | 2 % | 2 % | 22 % | 1 % | 66 | 3879 | 1k:87 2k:12 4k:0 8k:0 |
| cylinder-P4mmm-on | 4/mmm | 58 | 2609 | 21.0 | 95 % | 72 % | 5 % | 2 % | 1 % | 1 % | 17 % | 1 % | 50 | 8853 | 1k:100 2k:0 |
| cylinder-P6m-on | 6/m | 42 | 2447 | 16.7 | 97 % | 74 % | 6 % | 2 % | 1 % | 1 % | 14 % | 1 % | 42 | 8643 | 1k:99 2k:1 |
| ellcyl-P2m-generic | 2/m | 147 | 4522 | 30.9 | 95 % | 51 % | 9 % | 4 % | 1 % | 2 % | 31 % | 1 % | 122 | 3726 | 1k:100 2k:0 4k:0 |
| ellcyl-Pm-3m-generic | m-3m | 32 | 3846 | 7.7 | 93 % | 71 % | 7 % | 3 % | 3 % | 2 % | 12 % | 2 % | 24 | 6844 | 1k:93 2k:7 4k:0 |
| ellipsoid-P6mmm-generic | 6/mmm | 59 | 4288 | 13.2 | 96 % | 73 % | 7 % | 3 % | 1 % | 1 % | 14 % | 1 % | 40 | 7145 | 1k:98 2k:1 4k:0 |
| ellipsoid-Pmmm-generic | mmm | 135 | 4593 | 28.1 | 95 % | 65 % | 9 % | 4 % | 1 % | 2 % | 18 % | 1 % | 82 | 6476 | 1k:63 2k:37 4k:0 8k:0 |
| spheroid-P-3-near | -3 | 73 | 3818 | 18.4 | 97 % | 71 % | 8 % | 4 % | 1 % | 1 % | 14 % | 1 % | 66 | 5865 | 1k:100 2k:0 |
| sqbox-Pm-3-on | m-3 | 28 | 3124 | 8.4 | 93 % | 71 % | 7 % | 3 % | 2 % | 1 % | 13 % | 1 % | 28 | 6441 | 1k:99 2k:1 4k:0 |
All 11: phasePattern 95.7 % of CPU; of it read 62.1 %, fft 7.4 %, com 3.4 %, size 1.2 %, fill 1.5 %, lineNodes 23.1 %

Read-out: the profile read at every pattern point of the window (±40 FWHM, so 3700–8900 points a line), a sine, a cosine and `Math.floor` a point. lineNodes: the axial divergence's nodes, almost all of it the Soller cells computed again for every θ a refinement visits. N: the FFT's length (k = 1024).

## On step 2's engine (`WPPM_OPT` all on: the finalist W4)

| row | class | evaluations before / after | ms an evaluation before / after (timers) | after: drawing (read-out, FFT, coefficients) / axial nodes / rest, of phasePattern |
|---|---|---|---|---|
| box-P-1-near | -1 | 4689 / 4600 | 72.3 / 15.6 | 90 % / 6 % / 4 % |
| box-P-3m1-near | -3m | 6032 / 5557 | 13.7 / 3.6 | 86 % / 8 % / 6 % |
| box-P4m-near | 4/m | 3664 / 3752 | 15.4 / 4.1 | 84 % / 11 % / 5 % |
| cylinder-P4mmm-on | 4/mmm | 2609 / 3176 | 21.0 / 4.7 | 90 % / 5 % / 5 % |
| cylinder-P6m-on | 6/m | 2447 / 2529 | 16.7 / 3.8 | 89 % / 5 % / 6 % |
| ellcyl-P2m-generic | 2/m | 4522 / 4419 | 30.9 / 8.4 | 84 % / 10 % / 6 % |
| ellcyl-Pm-3m-generic | m-3m | 3846 / 4051 | 7.7 / 1.9 | 87 % / 6 % / 6 % |
| ellipsoid-P6mmm-generic | 6/mmm | 4288 / 4249 | 13.2 / 3.1 | 90 % / 4 % / 6 % |
| ellipsoid-Pmmm-generic | mmm | 4593 / 4624 | 28.1 / 7.2 | 91 % / 4 % / 5 % |
| spheroid-P-3-near | -3 | 3818 / 3812 | 18.4 / 4.4 | 90 % / 4 % / 6 % |
| sqbox-Pm-3-on | m-3 | 3124 / 2860 | 8.4 / 2.4 | 86 % / 7 % / 7 % |

## The Jacobian's columns

A central refinement (2 iterations, the faces rounded, no covariance) from the truth's widths ×1.1, the free set of the search's (scale, background, cell, zero, B, Xs, widths, turns), `scripts/step2/prof/prof.mjs`; ms a column (two evaluations). Step 1's engine:

- box-P-1-near (−1), WPPM: the cell's six 175–193, zero 144, B, Xs, widths and turns 99–117; lsq: the cell's 71–86, zero 42, the others 7–8 (the Soller cells: 76–80 % of an lsq evaluation in this refinement, 26 % of a WPPM one).
- sqbox-Pm-3-on (m−3), WPPM: a 24, zero 17, the others 15–17; lsq: a 11, the others 6.5–7.
- Step 2's engine, WPPM (W4): box-P-1-near every column 23–33, sqbox-Pm-3-on 3.7–5.8.

Every non-linear column of a WPPM refinement recomputed the whole pattern: no column was cheaper than another but the cell's, which also recomputed every line's Soller cells. The members' size coefficients A(L), the part a per-shape cache would keep, took 1.2 % of `phasePattern`.
