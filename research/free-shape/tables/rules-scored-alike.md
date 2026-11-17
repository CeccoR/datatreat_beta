# Reporting rules scored alike (scripts/writer/cross.mjs)

## The studies' runs at background degree 6 (80 synthetic runs that keep a solid, 12 proxies)

Scored alike: covered = the truth inside the stated interval (role by role: the truth's thinnest, middle, longest extent); determined = interval hi/lo ≤ 1.25² (extent) or radius ≤ 10° (direction); accurate = the estimate within 25 % (|ln| ≤ ln 1.25) or 10° of the truth; holds as stated = a determined quantity whose truth lies inside its own interval or radius. Directions: the truth's defined axes paired with the fit's. Lower limit 0: intervals reaching 0 nm.

### Synthetic runs that kept a solid

| rule | runs | flagged | thinnest covered | middle covered | longest covered | lower limit 0 | extents determined: accurate | determined extents holding as stated | directions covered | directions determined: accurate | determined directions holding as stated | runs resolved in full: accurate in full | thinnest hi/lo (median) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| today (P0_app: linear esds, held/free in quadrature, cones 2.45σ) | 80 | 0 | 71/80 | 63/80 | 70/80 | 4 | 166/178 | 145/178 | 184/194 | 36/39 | 33/39 | 12/12 | 1.09 |
| today (uniqueness rebuild: linear esds, 2σ) | 80 | 0 | 74/80 | 69/80 | 72/80 | 4 | 166/172 | 150/172 | 178/194 | 61/65 | 56/65 | 16/16 | 1.09 |
| E_L6 | 80 | 0 | 76/80 | 77/80 | 74/80 | 1 | 170/170 | 162/170 | 186/189 | 21/21 | 20/21 | 7/7 | 1.09 |
| E_L6 + D rule | 80 | 0 | 76/80 | 77/80 | 74/80 | 1 | 170/170 | 162/170 | 188/189 | 19/19 | 18/19 | 6/6 | 1.09 |
| E_L6 + D rule + jackknife when flagged | 80 | 0 | 76/80 | 77/80 | 74/80 | 1 | 170/170 | 162/170 | 188/189 | 19/19 | 18/19 | 6/6 | 1.09 |
| merged rule: E_L6, today's radius, D rule, jackknife when flagged | 80 | 0 | 76/80 | 77/80 | 74/80 | 1 | 170/170 | 162/170 | 190/194 | 48/48 | 44/48 | 12/12 | 1.09 |
| merged rule with E_L10 | 80 | 0 | 78/80 | 77/80 | 74/80 | 1 | 169/169 | 163/169 | 190/194 | 48/48 | 44/48 | 11/11 | 1.10 |
| merged rule with E_L12 (Δ 12.5) | 80 | 0 | 78/80 | 77/80 | 74/80 | 1 | 169/169 | 163/169 | 190/194 | 46/46 | 42/46 | 10/10 | 1.10 |
| condP (uniqueness) | 80 | 0 | 73/80 | 73/80 | 71/80 | 1 | 196/198 | 178/198 | 190/194 | 51/51 | 47/51 | 15/15 | 1.07 |
| condD (uniqueness) | 80 | 0 | 76/80 | 74/80 | 73/80 | 1 | 192/192 | 180/192 | 192/194 | 49/49 | 47/49 | 15/15 | 1.08 |

### Sample-like proxies

| rule | runs | flagged | thinnest covered | middle covered | longest covered | lower limit 0 | extents determined: accurate | determined extents holding as stated | directions covered | directions determined: accurate | determined directions holding as stated | runs resolved in full: accurate in full | thinnest hi/lo (median) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| today (P0_app: linear esds, held/free in quadrature, cones 2.45σ) | 12 | 12 | 1/12 | 11/12 | 11/12 | 2 | 11/15 | 4/15 | 23/36 | 13/15 | 2/15 | 0/0 | 1.08 |
| today (uniqueness rebuild: linear esds, 2σ) | 12 | 12 | 1/12 | 11/12 | 11/12 | 2 | 11/15 | 4/15 | 9/36 | 16/28 | 3/28 | 0/0 | 1.08 |
| E_L6 | 12 | 12 | 1/12 | 10/12 | 5/12 | 0 | 10/14 | 3/14 | 28/36 | 11/11 | 3/11 | 0/0 | 1.08 |
| E_L6 + D rule | 12 | 12 | 1/12 | 10/12 | 5/12 | 0 | 10/14 | 3/14 | 28/36 | 11/11 | 3/11 | 0/0 | 1.08 |
| E_L6 + D rule + jackknife when flagged | 12 | 12 | 12/12 | 11/12 | 10/12 | 0 | 1/1 | 1/1 | 35/36 | 7/7 | 6/7 | 0/0 | 1.91 |
| merged rule: E_L6, today's radius, D rule, jackknife when flagged | 12 | 12 | 12/12 | 11/12 | 10/12 | 0 | 1/1 | 1/1 | 35/36 | 7/7 | 6/7 | 0/0 | 1.91 |
| merged rule with E_L10 | 12 | 12 | 12/12 | 12/12 | 10/12 | 0 | 1/1 | 1/1 | 35/36 | 7/7 | 6/7 | 0/0 | 1.91 |
| merged rule with E_L12 (Δ 12.5) | 12 | 12 | 12/12 | 12/12 | 10/12 | 0 | 1/1 | 1/1 | 35/36 | 7/7 | 6/7 | 0/0 | 1.91 |
| condP (uniqueness) | 12 | 12 | 12/12 | 11/12 | 12/12 | 5 | 3/3 | 3/3 | 35/36 | 4/4 | 3/4 | 0/0 | 1.91 |
| condD (uniqueness) | 12 | 12 | 12/12 | 12/12 | 12/12 | 5 | 3/3 | 3/3 | 36/36 | 4/4 | 4/4 | 0/0 | 1.91 |


## Fresh proxies v01-v12 at degree 6 (the review's runs)

| rule | runs | flagged | thinnest covered | middle covered | longest covered | lower limit 0 | extents determined: accurate | determined extents holding as stated | directions covered | directions determined: accurate | determined directions holding as stated | runs resolved in full: accurate in full | thinnest hi/lo (median) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| today (P0_app: linear esds, held/free in quadrature, cones 2.45σ) | 12 | 10 | 1/12 | 11/12 | 11/12 | 7 | 5/13 | 1/13 | 26/36 | 13/13 | 3/13 | 0/0 | 1.10 |
| today (uniqueness rebuild: linear esds, 2σ) | 12 | 10 | 1/12 | 11/12 | 11/12 | 7 | 5/13 | 1/13 | 7/36 | 19/32 | 5/32 | 0/0 | 1.10 |
| E_L6 | 12 | 10 | 1/12 | 11/12 | 6/12 | 0 | 5/13 | 1/13 | 31/36 | 8/8 | 3/8 | 0/0 | 1.11 |
| E_L6 + D rule | 12 | 10 | 1/12 | 11/12 | 6/12 | 0 | 5/13 | 1/13 | 31/36 | 8/8 | 3/8 | 0/0 | 1.11 |
| E_L6 + D rule + jackknife when flagged | 12 | 10 | 11/12 | 11/12 | 7/12 | 0 | 2/3 | 1/3 | 36/36 | 4/4 | 4/4 | 0/0 | 2.78 |
| merged rule: E_L6, today's radius, D rule, jackknife when flagged | 12 | 10 | 11/12 | 11/12 | 7/12 | 0 | 2/3 | 1/3 | 34/36 | 4/4 | 2/4 | 0/0 | 2.78 |
| merged rule with E_L10 | 12 | 10 | 11/12 | 11/12 | 7/12 | 0 | 2/3 | 1/3 | 34/36 | 4/4 | 2/4 | 0/0 | 2.78 |
| merged rule with E_L12 (Δ 12.5) | 12 | 10 | 11/12 | 11/12 | 7/12 | 0 | 2/3 | 1/3 | 34/36 | 4/4 | 2/4 | 0/0 | 2.78 |
| condP (uniqueness) | 12 | 10 | 11/12 | 11/12 | 11/12 | 11 | 2/3 | 1/3 | 35/36 | 1/1 | 0/1 | 0/0 | 2.78 |
| condD (uniqueness) | 12 | 10 | 11/12 | 11/12 | 11/12 | 11 | 2/3 | 1/3 | 35/36 | 1/1 | 0/1 | 0/0 | 2.78 |

## Proxies u01-u12 searched again at degree 18, jackknife on every run whose pick moved (--flag6)

| rule | runs | flagged | thinnest covered | middle covered | longest covered | lower limit 0 | extents determined: accurate | determined extents holding as stated | directions covered | directions determined: accurate | determined directions holding as stated | runs resolved in full: accurate in full | thinnest hi/lo (median) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| today (P0_app: linear esds, held/free in quadrature, cones 2.45σ) | 12 | 12 | 11/12 | 11/12 | 11/12 | 1 | 28/29 | 27/29 | 36/36 | 20/20 | 20/20 | 4/4 | 1.10 |
| today (uniqueness rebuild: linear esds, 2σ) | 12 | 12 | 11/12 | 11/12 | 12/12 | 1 | 28/29 | 27/29 | 36/36 | 25/25 | 25/25 | 5/6 | 1.10 |
| E_L6 | 12 | 12 | 11/12 | 11/12 | 12/12 | 0 | 26/27 | 25/27 | 36/36 | 9/9 | 9/9 | 1/1 | 1.10 |
| E_L6 + D rule | 12 | 12 | 11/12 | 11/12 | 12/12 | 0 | 26/27 | 25/27 | 36/36 | 7/7 | 7/7 | 1/1 | 1.10 |
| E_L6 + D rule + jackknife when flagged | 12 | 12 | 11/12 | 11/12 | 12/12 | 0 | 18/18 | 17/18 | 36/36 | 6/6 | 6/6 | 1/1 | 1.36 |
| merged rule: E_L6, today's radius, D rule, jackknife when flagged | 12 | 12 | 11/12 | 11/12 | 12/12 | 0 | 18/18 | 17/18 | 36/36 | 12/12 | 12/12 | 1/1 | 1.36 |
| merged rule with E_L10 | 12 | 12 | 11/12 | 11/12 | 12/12 | 0 | 18/18 | 17/18 | 36/36 | 12/12 | 12/12 | 1/1 | 1.36 |
| merged rule with E_L12 (Δ 12.5) | 12 | 12 | 11/12 | 11/12 | 12/12 | 0 | 18/18 | 17/18 | 36/36 | 12/12 | 12/12 | 1/1 | 1.36 |
| condP (uniqueness) | 12 | 12 | 11/12 | 11/12 | 12/12 | 1 | 26/26 | 25/26 | 36/36 | 10/10 | 10/10 | 0/0 | 1.10 |
| condD (uniqueness) | 12 | 12 | 11/12 | 11/12 | 12/12 | 1 | 26/26 | 25/26 | 36/36 | 10/10 | 10/10 | 0/0 | 1.10 |

## Proxies u01-u12 searched again at degree 18, jackknife only where the flag still fires

| rule | runs | flagged | thinnest covered | middle covered | longest covered | lower limit 0 | extents determined: accurate | determined extents holding as stated | directions covered | directions determined: accurate | determined directions holding as stated | runs resolved in full: accurate in full | thinnest hi/lo (median) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| today (P0_app: linear esds, held/free in quadrature, cones 2.45σ) | 12 | 2 | 11/12 | 11/12 | 11/12 | 1 | 28/29 | 27/29 | 36/36 | 20/20 | 20/20 | 4/4 | 1.10 |
| today (uniqueness rebuild: linear esds, 2σ) | 12 | 2 | 11/12 | 11/12 | 12/12 | 1 | 28/29 | 27/29 | 36/36 | 25/25 | 25/25 | 5/6 | 1.10 |
| E_L6 | 12 | 2 | 11/12 | 11/12 | 12/12 | 0 | 26/27 | 25/27 | 36/36 | 9/9 | 9/9 | 1/1 | 1.10 |
| E_L6 + D rule | 12 | 2 | 11/12 | 11/12 | 12/12 | 0 | 26/27 | 25/27 | 36/36 | 7/7 | 7/7 | 1/1 | 1.10 |
| E_L6 + D rule + jackknife when flagged | 12 | 2 | 11/12 | 11/12 | 12/12 | 0 | 24/24 | 23/24 | 36/36 | 7/7 | 7/7 | 1/1 | 1.10 |
| merged rule: E_L6, today's radius, D rule, jackknife when flagged | 12 | 2 | 11/12 | 11/12 | 12/12 | 0 | 24/24 | 23/24 | 36/36 | 14/14 | 14/14 | 1/1 | 1.10 |
| merged rule with E_L10 | 12 | 2 | 11/12 | 11/12 | 12/12 | 0 | 24/24 | 23/24 | 36/36 | 14/14 | 14/14 | 1/1 | 1.10 |
| merged rule with E_L12 (Δ 12.5) | 12 | 2 | 11/12 | 11/12 | 12/12 | 0 | 24/24 | 23/24 | 36/36 | 14/14 | 14/14 | 1/1 | 1.10 |
| condP (uniqueness) | 12 | 2 | 11/12 | 11/12 | 12/12 | 1 | 26/26 | 25/26 | 36/36 | 10/10 | 10/10 | 0/0 | 1.10 |
| condD (uniqueness) | 12 | 2 | 11/12 | 11/12 | 12/12 | 1 | 26/26 | 25/26 | 36/36 | 10/10 | 10/10 | 0/0 | 1.10 |

## Proxies v01-v12 searched again at degree 18, jackknife on every run whose pick moved (--flag6)

| rule | runs | flagged | thinnest covered | middle covered | longest covered | lower limit 0 | extents determined: accurate | determined extents holding as stated | directions covered | directions determined: accurate | determined directions holding as stated | runs resolved in full: accurate in full | thinnest hi/lo (median) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| today (P0_app: linear esds, held/free in quadrature, cones 2.45σ) | 12 | 12 | 12/12 | 9/12 | 12/12 | 3 | 21/21 | 19/21 | 31/36 | 9/9 | 6/9 | 0/0 | 1.13 |
| today (uniqueness rebuild: linear esds, 2σ) | 12 | 12 | 12/12 | 9/12 | 12/12 | 3 | 21/21 | 19/21 | 29/36 | 19/19 | 16/19 | 1/1 | 1.13 |
| E_L6 | 12 | 12 | 12/12 | 11/12 | 10/12 | 0 | 19/19 | 18/19 | 35/36 | 7/7 | 6/7 | 0/0 | 1.13 |
| E_L6 + D rule | 12 | 12 | 12/12 | 11/12 | 10/12 | 0 | 19/19 | 18/19 | 35/36 | 7/7 | 6/7 | 0/0 | 1.13 |
| E_L6 + D rule + jackknife when flagged | 12 | 12 | 12/12 | 11/12 | 12/12 | 0 | 11/11 | 10/11 | 36/36 | 6/6 | 6/6 | 0/0 | 1.36 |
| merged rule: E_L6, today's radius, D rule, jackknife when flagged | 12 | 12 | 12/12 | 11/12 | 12/12 | 0 | 11/11 | 10/11 | 36/36 | 11/11 | 11/11 | 1/1 | 1.36 |
| merged rule with E_L10 | 12 | 12 | 12/12 | 12/12 | 12/12 | 0 | 11/11 | 11/11 | 36/36 | 9/9 | 9/9 | 0/0 | 1.36 |
| merged rule with E_L12 (Δ 12.5) | 12 | 12 | 12/12 | 12/12 | 12/12 | 0 | 11/11 | 11/11 | 36/36 | 9/9 | 9/9 | 0/0 | 1.36 |
| condP (uniqueness) | 12 | 12 | 12/12 | 9/12 | 12/12 | 3 | 21/21 | 19/21 | 32/36 | 11/11 | 9/11 | 1/1 | 1.13 |
| condD (uniqueness) | 12 | 12 | 12/12 | 9/12 | 12/12 | 3 | 21/21 | 19/21 | 32/36 | 11/11 | 9/11 | 1/1 | 1.13 |

## Proxies v01-v12 searched again at degree 18, jackknife only where the flag still fires

| rule | runs | flagged | thinnest covered | middle covered | longest covered | lower limit 0 | extents determined: accurate | determined extents holding as stated | directions covered | directions determined: accurate | determined directions holding as stated | runs resolved in full: accurate in full | thinnest hi/lo (median) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| today (P0_app: linear esds, held/free in quadrature, cones 2.45σ) | 12 | 0 | 12/12 | 9/12 | 12/12 | 3 | 21/21 | 19/21 | 31/36 | 9/9 | 6/9 | 0/0 | 1.13 |
| today (uniqueness rebuild: linear esds, 2σ) | 12 | 0 | 12/12 | 9/12 | 12/12 | 3 | 21/21 | 19/21 | 29/36 | 19/19 | 16/19 | 1/1 | 1.13 |
| E_L6 | 12 | 0 | 12/12 | 11/12 | 10/12 | 0 | 19/19 | 18/19 | 35/36 | 7/7 | 6/7 | 0/0 | 1.13 |
| E_L6 + D rule | 12 | 0 | 12/12 | 11/12 | 10/12 | 0 | 19/19 | 18/19 | 35/36 | 7/7 | 6/7 | 0/0 | 1.13 |
| E_L6 + D rule + jackknife when flagged | 12 | 0 | 12/12 | 11/12 | 10/12 | 0 | 19/19 | 18/19 | 35/36 | 7/7 | 6/7 | 0/0 | 1.13 |
| merged rule: E_L6, today's radius, D rule, jackknife when flagged | 12 | 0 | 12/12 | 11/12 | 10/12 | 0 | 19/19 | 18/19 | 33/36 | 13/13 | 10/13 | 1/1 | 1.13 |
| merged rule with E_L10 | 12 | 0 | 12/12 | 12/12 | 11/12 | 0 | 19/19 | 19/19 | 33/36 | 11/11 | 8/11 | 0/0 | 1.13 |
| merged rule with E_L12 (Δ 12.5) | 12 | 0 | 12/12 | 12/12 | 11/12 | 0 | 19/19 | 19/19 | 33/36 | 11/11 | 8/11 | 0/0 | 1.13 |
| condP (uniqueness) | 12 | 0 | 12/12 | 9/12 | 12/12 | 3 | 21/21 | 19/21 | 32/36 | 11/11 | 9/11 | 1/1 | 1.13 |
| condD (uniqueness) | 12 | 0 | 12/12 | 9/12 | 12/12 | 3 | 21/21 | 19/21 | 32/36 | 11/11 | 9/11 | 1/1 | 1.13 |

Synthetic hold-out and misfit runs: tables/fix-holdout.md. Today's report at degree 18 is the app's own report on the degree-18 fit; the app does not pick the degree today.
