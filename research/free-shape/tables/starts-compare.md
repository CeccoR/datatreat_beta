110 runs common to baseline, cfam, c6, a4, a3

| method | reached (Δ ≤ 1) | Δ > 3 (of which proxies) | proxies: mean Δ | outcome ≠ baseline | evals synth | evals sample | evals ctrl | evals all | s all | s (first in process) | dim err med / p90 | thinnest med / p90 | normal ° med / p90 / max | precision: dim sd med, misor. ° med / mean |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| baseline | 96/98 | 1 (1) | 0.6 | 0 | 3577 | 4367 | 2027 | 3551 | 21.2 | 19.5 (64) | 7 % / 29 % | 2 % / 6 % | 0.0 / 8.0 / 24.9 | 8 %, 7.3 / 10.0 |
| cfam | 93/97 | 2 (0) | 0.6 | 1 | 2698 | 3353 | 201 | 2587 | 18.7 | — (0) | 7 % / 33 % | 2 % / 6 % | 0.0 / 8.0 / 25.2 | 8 %, 7.3 / 10.6 |
| c6 | 90/97 | 3 (1) | 0.8 | 0 | 2416 | 3270 | 201 | 2348 | 17.0 | — (0) | 7 % / 30 % | 2 % / 6 % | 0.0 / 8.0 / 25.2 | 8 %, 7.3 / 10.5 |
| a4 | 90/97 | 3 (0) | 0.7 | 0 | 1909 | 3663 | 201 | 1976 | 14.3 | 12.9 (64) | 7 % / 32 % | 2 % / 6 % | 0.0 / 8.1 / 24.9 | 8 %, 7.3 / 10.3 |
| a3 | 90/97 | 4 (1) | 0.9 | 1 | 1642 | 3443 | 201 | 1734 | 13.2 | 13.2 (110) | 7 % / 32 % | 2 % / 6 % | 0.0 / 8.1 / 24.9 | 8 %, 7.3 / 11.1 |

baseline: misses box-plate110-off8#2 Δ 2.0; u12#1 Δ 4.0; outcomes changed none
cfam: misses box-plate110-off8#2 Δ 3.1; sph-mild001#3 Δ 6.3; u03#1 Δ 2.3; u08#1 Δ 1.5; outcomes changed sqbox-plate-rand#2 held→free
c6: misses box-plate110-off8#2 Δ 3.1; ell-needle100#2 Δ 1.8; sph-mild001#3 Δ 6.3; sqbox-plate001#1 Δ 1.0; u02#1 Δ 1.0; u03#1 Δ 4.6; u08#1 Δ 2.2; outcomes changed none
a4: misses box-plate110-off8#2 Δ 3.1; ecyl-plate110-t20#3 Δ 3.4; ell-needle100#2 Δ 1.8; sph-mild001#3 Δ 6.3; sqbox-plate001#1 Δ 1.0; u03#1 Δ 2.3; u08#1 Δ 2.2; outcomes changed none
a3: misses box-plate110-off8#2 Δ 3.1; ecyl-plate110-t20#3 Δ 3.4; ell-needle100#2 Δ 1.8; sph-mild001#3 Δ 6.3; sqbox-plate001#1 Δ 1.0; u03#1 Δ 4.6; u08#1 Δ 2.2; outcomes changed sqbox-plate-rand#2 held→free

| solid (synthetic) | runs | baseline: evals, reached | cfam: evals, reached | c6: evals, reached | a4: evals, reached | a3: evals, reached |
|---|---|---|---|---|---|---|
| box | 24 | 3973, 21/22 | 2921, 21/22 | 2564, 21/22 | 2082, 21/22 | 1767, 21/22 |
| cylinder | 12 | 2927, 12/12 | 2523, 12/12 | 2470, 12/12 | 2006, 12/12 | 1697, 12/12 |
| ellcyl | 12 | 4663, 11/11 | 3416, 11/11 | 3076, 11/11 | 2415, 10/11 | 2198, 10/11 |
| ellipsoid | 15 | 3741, 15/15 | 3021, 15/15 | 2681, 14/15 | 2110, 14/15 | 1855, 14/15 |
| spheroid | 12 | 2381, 12/12 | 1621, 11/12 | 1665, 11/12 | 1293, 11/12 | 985, 11/12 |
| sqbox | 15 | 3389, 14/14 | 2443, 13/13 | 1942, 12/13 | 1440, 12/13 | 1268, 12/13 |
