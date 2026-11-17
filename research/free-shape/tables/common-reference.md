Δ against the lowest exact χ² any record of any study found (102 runs with an exact fit; folders: harness/results/baseline, starts/results/r1, starts/results/r2b, starts/results/r3, starts/results/r4, optimizer/results/f-c1, optimizer/results/f-c4, optimizer/results/f-fwd, optimizer/results/p-brief4, optimizer/results/p-briefShape, optimizer/results/p-briefShapeXs, optimizer/results/p-broy3, optimizer/results/p-c1, optimizer/results/p-c3, optimizer/results/p-c4, optimizer/results/p-c5, optimizer/results/p-c7, optimizer/results/p-c8, optimizer/results/p-c9, optimizer/results/p-dedup, optimizer/results/p-fwd, optimizer/results/p-halving, optimizer/results/p-halvingDedup, optimizer/results/p-heldBrief, optimizer/results/p-logW, optimizer/results/p-member, optimizer/results/p-nocov, optimizer/results/p-sur4, optimizer/results/p-sur8, optimizer/results/r-c10, optimizer/results/r-c11, optimizer/results/r-c12, optimizer/results/r-c13, optimizer/results/u-c1, uniqueness/results/main).

| search | runs | evaluations (× app) | synthetic | sample-like | controls, fixtures | reached Δ ≤ 1 | Δ > 3 (proxies) | proxies reached, mean Δ | outcome as the app |
|---|---|---|---|---|---|---|---|---|---|
| app (baseline) | 110 | 3551 (1.00) | 3577 | 4367 | 2027 | 93/98 | 1 (1) | 8/12, 0.82 | 110/110 |
| fwd | 110 | 1813 (0.51) | 1812 | 2337 | 1042 | 94/98 | 0 (0) | 9/12, 0.64 | 110/110 |
| c1 = fwd + halving | 110 | 1251 (0.35) | 1253 | 1666 | 608 | 93/97 | 1 (1) | 10/12, 1.35 | 107/110 |
| c4 = c1 + frames screened | 110 | 1160 (0.33) | 1168 | 1475 | 608 | 93/97 | 1 (1) | 10/12, 1.35 | 106/110 |
| cfam | 110 | 2587 (0.73) | 2698 | 3353 | 201 | 92/97 | 2 (0) | 9/12, 0.80 | 108/110 |
| 6 screened picks | 110 | 2348 (0.66) | 2416 | 3270 | 201 | 90/97 | 3 (1) | 9/12, 0.99 | 109/110 |
| a4 | 110 | 1976 (0.56) | 1909 | 3663 | 201 | 89/97 | 3 (0) | 9/12, 0.86 | 109/110 |
| a3 | 110 | 1734 (0.49) | 1642 | 3443 | 201 | 89/97 | 4 (1) | 9/12, 1.04 | 108/110 |

- app (baseline) misses: u12#1 4.2; box-plate110-off8#2 2.0; u02#1 1.3; u03#1 1.1; u06#1 1.0
- fwd misses: u12#1 2.8; box-plate110-off8#2 2.0; u02#1 1.3; u08#1 1.2
- c1 = fwd + halving misses: u11#1 11.4; ecyl-rand#2 1.4; sph-mild001#3 1.1; u08#1 1.1
- c4 = c1 + frames screened misses: u11#1 11.4; ecyl-rand#2 1.4; sph-mild001#3 1.1; u08#1 1.1
- cfam misses: sph-mild001#3 6.3; box-plate110-off8#2 3.1; u03#1 2.7; u02#1 2.0; u08#1 1.5
- 6 screened picks misses: sph-mild001#3 6.3; u03#1 4.9; box-plate110-off8#2 3.1; u02#1 2.3; u08#1 2.2; ell-needle100#2 1.8; sqbox-plate001#1 1.0
- a4 misses: sph-mild001#3 6.3; ecyl-plate110-t20#3 3.4; box-plate110-off8#2 3.1; u03#1 2.7; u08#1 2.2; u02#1 2.0; ell-needle100#2 1.8; sqbox-plate001#1 1.0
- a3 misses: sph-mild001#3 6.3; u03#1 4.9; ecyl-plate110-t20#3 3.4; box-plate110-off8#2 3.1; u08#1 2.2; u02#1 2.0; ell-needle100#2 1.8; sqbox-plate001#1 1.0

Which record holds the reference: baseline:truth 14, baseline:baseline 14, f-c1:c1 12, f-fwd:fwd 11, r2b:c6 11, r2b:a3 8, r1:ws6 6, p-broy3:broy3 4, r-c10:c10 4, r2b:cfam 3, r1:ws4dd 2, r3:curv4 2, p-c5:c5 1, r1:ws6s 1, p-briefShapeXs:briefShapeXs 1, r1:ws2 1, p-c9:c9 1, r1:wsfam 1, r-c13:c13 1, r-c12:c12 1, p-logW:logW 1, r1:ws4 1, r1:ws4b5 1
