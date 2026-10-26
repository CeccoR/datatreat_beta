# Hold-out: fresh noise on the synthetic truths (seeds 4 and 5), the review's runs

The app's search and report, the misfit flag and the jackknife where it fires (scripts/fix/u-pipe.mjs), plus the truth reference, at background degree 6. Scored as tables/rules-scored-alike.md. Nothing in the rules was set on these runs.

```
60 hold-out runs: 51 kept (44 held), 9 rejected
worst segment χ²_ν on the kept runs: max 1.173 (sqbox-plate001#4), then 1.164 (ecyl-plate110#5), 1.163 (box-plate100#4), 1.140 (box-needle111#5); over 1.25: 0; over 1.207: 0
rejected: box-block-rand#4 early ΔBIC 5 truth gain 10.2 (above every null); box-block-rand#5 late ΔBIC -5 truth gain 27.2 (above every null); ecyl-rand#4 late ΔBIC -0 truth gain 19.8 (above every null); ecyl-rand#5 late ΔBIC 6 truth gain 15.5 (above every null); ell-block-t25#4 late ΔBIC -4 truth gain 20.8 (above every null); ell-block-t25#5 late ΔBIC -3 truth gain 20.7 (above every null); sph-mild001#5 late ΔBIC -10 truth gain 18.1 (above every null); sqbox-block-rand#4 early ΔBIC 5 truth gain 2.6; sqbox-block-rand#5 late ΔBIC 3 truth gain 10.7 (above every null)
rejected runs whose truth gains more than every null of its width count: 8 of 9
```

Scored alike: covered = the truth inside the stated interval (role by role: the truth's thinnest, middle, longest extent); determined = interval hi/lo ≤ 1.25² (extent) or radius ≤ 10° (direction); accurate = the estimate within 25 % (|ln| ≤ ln 1.25) or 10° of the truth; holds as stated = a determined quantity whose truth lies inside its own interval or radius. Directions: the truth's defined axes paired with the fit's. Lower limit 0: intervals reaching 0 nm.

### Synthetic runs that kept a solid

| rule | runs | flagged | thinnest covered | middle covered | longest covered | lower limit 0 | extents determined: accurate | determined extents holding as stated | directions covered | directions determined: accurate | determined directions holding as stated | runs resolved in full: accurate in full | thinnest hi/lo (median) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| today (P0_app: linear esds, held/free in quadrature, cones 2.45σ) | 51 | 0 | 43/51 | 41/51 | 48/51 | 6 | 98/103 | 82/103 | 113/120 | 25/25 | 25/25 | 8/9 | 1.09 |
| today (uniqueness rebuild: linear esds, 2σ) | 51 | 0 | 43/51 | 43/51 | 49/51 | 6 | 99/101 | 85/101 | 111/123 | 38/40 | 37/40 | 10/10 | 1.09 |
| E_L6 | 51 | 0 | 48/51 | 48/51 | 46/51 | 1 | 104/105 | 96/105 | 121/123 | 12/12 | 12/12 | 6/6 | 1.09 |
| E_L6 + D rule | 51 | 0 | 48/51 | 48/51 | 46/51 | 1 | 104/105 | 96/105 | 123/123 | 8/8 | 8/8 | 4/4 | 1.09 |
| E_L6 + D rule + jackknife when flagged | 51 | 0 | 48/51 | 48/51 | 46/51 | 1 | 104/105 | 96/105 | 123/123 | 8/8 | 8/8 | 4/4 | 1.09 |
| merged rule: E_L6, today's radius, D rule, jackknife when flagged | 51 | 0 | 48/51 | 48/51 | 46/51 | 1 | 104/105 | 96/105 | 118/123 | 30/30 | 29/30 | 6/7 | 1.09 |
| merged rule with E_L10 | 51 | 0 | 48/51 | 48/51 | 46/51 | 1 | 101/102 | 93/102 | 118/123 | 30/30 | 29/30 | 6/7 | 1.09 |
| merged rule with E_L12 (Δ 12.5) | 51 | 0 | 48/51 | 48/51 | 46/51 | 1 | 100/101 | 92/101 | 118/123 | 30/30 | 29/30 | 5/6 | 1.09 |


## Misfits that are not a hump (air, mix), degree 6

| rule | runs | flagged | thinnest covered | middle covered | longest covered | lower limit 0 | extents determined: accurate | determined extents holding as stated | directions covered | directions determined: accurate | determined directions holding as stated | runs resolved in full: accurate in full | thinnest hi/lo (median) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| today (P0_app: linear esds, held/free in quadrature, cones 2.45σ) | 8 | 0 | 4/8 | 7/8 | 7/8 | 0 | 14/16 | 12/16 | 17/20 | 3/4 | 1/4 | 1/1 | 1.10 |
| today (uniqueness rebuild: linear esds, 2σ) | 8 | 0 | 4/8 | 7/8 | 7/8 | 0 | 14/16 | 12/16 | 15/20 | 8/9 | 6/9 | 2/2 | 1.10 |
| E_L6 | 8 | 0 | 4/8 | 6/8 | 6/8 | 0 | 14/16 | 12/16 | 17/20 | 3/4 | 1/4 | 1/1 | 1.10 |
| E_L6 + D rule | 8 | 0 | 4/8 | 6/8 | 6/8 | 0 | 14/16 | 12/16 | 17/20 | 3/4 | 1/4 | 1/1 | 1.10 |
| E_L6 + D rule + jackknife when flagged | 8 | 0 | 4/8 | 6/8 | 6/8 | 0 | 14/16 | 12/16 | 17/20 | 3/4 | 1/4 | 1/1 | 1.10 |
| merged rule: E_L6, today's radius, D rule, jackknife when flagged | 8 | 0 | 4/8 | 6/8 | 6/8 | 0 | 14/16 | 12/16 | 17/20 | 6/7 | 4/7 | 2/2 | 1.10 |
| merged rule with E_L10 | 8 | 0 | 4/8 | 6/8 | 6/8 | 0 | 14/16 | 12/16 | 17/20 | 6/7 | 4/7 | 2/2 | 1.10 |
| merged rule with E_L12 (Δ 12.5) | 8 | 0 | 4/8 | 6/8 | 6/8 | 0 | 14/16 | 12/16 | 17/20 | 6/7 | 4/7 | 2/2 | 1.10 |
