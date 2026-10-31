# Step 4: the minima stage (`../STEP4.md` §3–§5, §9)

Records: `$W/fs2/step4/h/results/` (S2: the prototype's defaults on the 77 screening runs; S1: the first version, the search's random polish kept; DR2: the dense reference; U1, U2, T1, T2: the main stream seeded 12345 and 777). Scripts: `../scripts/step4/`.

## The stage on the 77 screening runs (S2; `score4.mjs --tag S2 --delta 16 --deltaF 25 --kappa 1.2`)

```
cost: stage 122742 evaluations, search without it 141981 (P1's search 156033): 0.864×; per staged run median 0.532× (max 6.84); ms 499900 of 1320294
staged runs 68: ends 15, candidates 2 (max 6), distinct minima within keep 1
  Δ* 6: unique 51/68, 2: 14, 3+: 3
  Δ* 10: unique 49/68, 2: 15, 3+: 4
  Δ* 12.5: unique 45/68, 2: 19, 3+: 4
  Δ* 15: unique 44/68, 2: 19, 3+: 5
  Δ* 20: unique 42/68, 2: 19, 3+: 7
stage's lowest below the search's free fit: 49 (Δ in χ²_ν: 0.02, 0.01, 1.03, 0.03, 0.86, 0.43, 0.00, 0.02, 0.03, 0.23, 0.00, 0.01, 0.00, 1.52, 0.00, 0.00, 0.00, 0.01, 0.00, 0.23, 0.03, 0.01, 6330.95, 0.00, 0.03, 0.03, 0.00, 0.32, 0.85, 909.16, 0.00, 0.00, 0.02, 0.00, 0.00, 0.00, 0.02, 0.00, 0.00, 0.02, 0.00, 1.24, 0.00, 0.00, 0.00, 0.00, 0.27, 10.82, 0.00)
outcome changed against P1: 2 cylinder-Pm-3m-on held→free; spheroid-P2m-on held→free
returned χ² against P1 (χ²_ν units): lower by >0.5 on 4 (box-Pmmm-on -0.7, cylinder-Pm-3m-on -31.1, spheroid-P2m-on -6.0, sphere-P6mmm-1 -3.6), higher by >0.5 on 1 (sqbox-P4m-on +0.8)
accuracy (kept in both, 66): worst extent median 4.1 % (P1 4.1 %), principal median 1.30° (P1 1.23°); changed by >1 %: box-Pmmm-on 342→339, box-P-3m1-near 11→191, box-P6m-generic 37→36, sqbox-P4m-on 12→10, spheroid-P2m-on 6→10
```

## Completeness against the dense reference (`comp4.mjs --ref DR2 --tag S2 --delta 16`)

| row | ref. minima ≤ Δ* | found | default ≤ Δ* | default lowest − reference lowest (χ²_ν) | unique: default / ref. | ref. search evals × default | ref. stage candidates |
|---|---|---|---|---|---|---|---|
| box-P-3m1-near | 6 | 3 | 2 | 0.05 | no / no | 3.7 | 24 |
| box-P2m-generic | 1 | 1 | 1 | 0.00 | yes / yes | 2.4 | 2 |
| box-Pm-3m-generic | 1 | 1 | 1 | 0.00 | yes / yes | 1.8 | 5 |
| cylinder-P-3m1-generic | 4 | 3 | 3 | 0.00 | no / no | 2.7 | 13 |
| cylinder-P2m-on | 1 | 1 | 1 | 0.00 | yes / yes | 3.3 | 3 |
| cylinder-Pm-3m-on | 1 | 0 | 0 | 1514.20 | yes / yes | 1.1 | 1 |
| ellcyl-P-3m1-near | 3 | 1 | 1 | 4.04 | no / no | 3.2 | 8 |
| ellcyl-P2m-generic | 1 | 1 | 1 | -0.00 | yes / yes | 2.7 | 1 |
| ellcyl-Pm-3m-generic | 3 | 2 | 2 | 0.00 | no / no | 5.1 | 18 |
| ellipsoid-P-3m1-on | 1 | 1 | 2 | 0.00 | no / yes | 4.3 | 24 |
| ellipsoid-P2m-near | 1 | 1 | 1 | -0.00 | yes / yes | 2.7 | 1 |
| ellipsoid-Pm-3m-near | 1 | 1 | 1 | -0.00 | yes / yes | 4.8 | 21 |
| spheroid-P-3m1-generic | 1 | 1 | 1 | 0.00 | yes / yes | 3.5 | 1 |
| spheroid-P2m-on | 1 | 1 | 1 | 0.19 | yes / yes | 3.3 | 3 |
| spheroid-Pm-3m-on | 1 | 1 | 1 | -0.00 | yes / yes | 3.9 | 1 |
| sqbox-P-3m1-on | 5 | 2 | 2 | 4.97 | no / no | 1.7 | 9 |
| sqbox-P2m-near | 1 | 1 | 1 | 0.00 | yes / yes | 2.8 | 1 |
| sqbox-Pm-3m-near | 1 | 1 | 1 | 0.00 | yes / yes | 4.0 | 3 |

rows 18: true minima 34, found 23 (68 %); reach 15/18; uniqueness verdict the same on 17/18; reference cost 2.97× the default's search (stage included)

Clean rows: 17 true minima, 13 found, reach 10/10; error rows: 17, 10, reach 5/8.

## The random stream (`turn4.mjs`): the same rows seeded three ways

The final stage (no random turn; the seed still sets the starts' small tilts): `TAGS=S2,U1,U2 node turn4.mjs`. 'today' there is the search without its polish.

| row | today: free χ² spread (χ²_ν) | stage: lowest χ² spread | outcomes | extents, largest difference | axis, largest angle |
|---|---|---|---|---|---|
| box-P-3m1-near | 0.04 | 0.04 | free, free, free | 18.8 % | 0.3° |
| box-P4m-near | 7.46 | 7.46 | free, free, free | 0.6 % | 5.4° |
| box-P4mmm-generic | 0.00 | 0.00 | free, free, free | 0.0 % | 0.0° |
| box-P6m-generic | 0.00 | 0.00 | free, free, free | 0.7 % | 0.0° |
| cylinder-P6mmm-near | 0.03 | 0.00 | free, free, free | 0.0 % | 0.0° |
| cylinder-Pm-3m-on | 985.94 | 30.98 | free, held, held | 1.3 % | 0.0° |
| ellcyl-P6m-generic | 0.19 | 0.09 | free, free, free | 8.0 % | 0.5° |
| ellipsoid-P-3m1-on | 0.02 | 0.00 | held, held, held | 0.0 % | 0.0° |
| ellipsoid-Pmmm-generic | 0.00 | 0.00 | free, free, free | 0.0 % | 0.0° |
| sphere-P6mmm-1 | 4.97 | 1.96 | free, free, free | 1.4 % | 0.5° |
| spheroid-P4m-generic | 0.00 | 0.00 | free, free, free | 0.0 % | 0.0° |
| sqbox-P6m-near | 0.00 | 0.00 | free, free, free | 0.0 % | 0.0° |

The first version (the search's random polish and refit kept, the stage after them): `node turn4.mjs`. 'today' is the search as step 3 left it.

| row | today: free χ² spread (χ²_ν) | stage: lowest χ² spread | outcomes | extents, largest difference | axis, largest angle |
|---|---|---|---|---|---|
| box-P4mmm-generic | 0.00 | 0.00 | free, free, free | 0.0 % | 0.0° |
| box-P6m-generic | 0.00 | 0.00 | free, free, free | 1.6 % | 0.0° |
| cylinder-P6mmm-near | 0.03 | 0.00 | free, free, free | 0.0 % | 0.0° |
| cylinder-Pm-3m-on | 26.73 | 20.57 | free, free, held | 0.9 % | 0.0° |
| ellcyl-P6m-generic | 0.02 | 0.09 | free, free, free | 8.4 % | 0.5° |
| ellipsoid-P-3m1-on | 0.01 | 0.00 | held, held, held | 0.0 % | 0.0° |
| ellipsoid-Pmmm-generic | 0.00 | 0.00 | free, free, free | 0.0 % | 0.0° |
| sphere-P6mmm-1 | 2.60 | 4.73 | free, free, free | 3.3 % | 8.3° |
| spheroid-P4m-generic | 0.00 | 0.00 | free, free, free | 0.0 % | 0.0° |
| sqbox-P6m-near | 0.00 | 0.00 | free, free, free | 0.0 % | 0.0° |
