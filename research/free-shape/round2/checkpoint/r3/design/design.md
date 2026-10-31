# Design fs3-design-r3 (seed 20261031)

396 truths, 66 spheres; tuning 308, validation 154; screening set 77.

## Model error × solid (truths)
| solid | none | hump | sizedist | impurity | air | po | all |
|---|---|---|---|---|---|---|---|
| box | 33 | 4 | 10 | 5 | 4 | 10 | 66 |
| sqbox | 33 | 5 | 10 | 4 | 4 | 10 | 66 |
| cylinder | 33 | 5 | 10 | 4 | 4 | 10 | 66 |
| ellcyl | 33 | 4 | 10 | 5 | 4 | 10 | 66 |
| ellipsoid | 33 | 4 | 10 | 4 | 5 | 10 | 66 |
| spheroid | 33 | 4 | 10 | 4 | 5 | 10 | 66 |
| all | 198 | 26 | 60 | 26 | 26 | 60 | 396 |

## Model error × Laue class (truths)
| class | none | hump | sizedist | impurity | air | po | all |
|---|---|---|---|---|---|---|---|
| -1 | 18 | 3 | 5 | 2 | 3 | 5 | 36 |
| 2/m | 18 | 2 | 6 | 2 | 2 | 6 | 36 |
| mmm | 18 | 2 | 5 | 3 | 2 | 6 | 36 |
| 4/m | 18 | 2 | 6 | 2 | 3 | 5 | 36 |
| 4/mmm | 18 | 2 | 5 | 3 | 2 | 6 | 36 |
| -3 | 18 | 2 | 6 | 3 | 2 | 5 | 36 |
| -3m | 18 | 3 | 5 | 2 | 3 | 5 | 36 |
| 6/m | 18 | 2 | 6 | 2 | 2 | 6 | 36 |
| 6/mmm | 18 | 2 | 6 | 2 | 2 | 6 | 36 |
| m-3 | 18 | 3 | 5 | 2 | 3 | 5 | 36 |
| m-3m | 18 | 3 | 5 | 3 | 2 | 5 | 36 |
| all | 198 | 26 | 60 | 26 | 26 | 60 | 396 |

## Model error × orientation (truths)
| orientation | none | hump | sizedist | impurity | air | po | all |
|---|---|---|---|---|---|---|---|
| on | 66 | 9 | 20 | 9 | 8 | 20 | 132 |
| near | 66 | 9 | 20 | 8 | 9 | 20 | 132 |
| generic | 66 | 8 | 20 | 9 | 9 | 20 | 132 |
| all | 198 | 26 | 60 | 26 | 26 | 60 | 396 |

## Model error × split, and the screening set (truths)
| split | none | hump | sizedist | impurity | air | po | all |
|---|---|---|---|---|---|---|---|
| tuning (screening) | 33 | 4 | 10 | 5 | 4 | 10 | 66 |
| tuning | 99 | 13 | 30 | 13 | 13 | 30 | 198 |
| validation | 66 | 9 | 20 | 8 | 9 | 20 | 132 |
| all | 198 | 26 | 60 | 26 | 26 | 60 | 396 |

## Orientation × split (truths)
| orientation | tuning+screen | tuning | validation | all |
|---|---|---|---|---|
| on | 22 | 66 | 44 | 132 |
| near | 22 | 66 | 44 | 132 |
| generic | 22 | 66 | 44 | 132 |
| all | 66 | 198 | 132 | 396 |

## Spheres: model error × split
| split | none | hump | sizedist | impurity | air | po | all |
|---|---|---|---|---|---|---|---|
| tuning (screening) | 6 | 0 | 2 | 1 | 1 | 1 | 11 |
| tuning | 16 | 3 | 5 | 2 | 2 | 5 | 33 |
| validation | 11 | 2 | 3 | 1 | 1 | 4 | 22 |
| all | 33 | 5 | 10 | 4 | 4 | 10 | 66 |

## Spheres: solid searched × split
| searched as | tuning+screen | tuning | validation | all |
|---|---|---|---|---|
| box | 2 | 5 | 4 | 11 |
| sqbox | 2 | 5 | 4 | 11 |
| cylinder | 2 | 6 | 3 | 11 |
| ellcyl | 2 | 5 | 4 | 11 |
| ellipsoid | 2 | 6 | 3 | 11 |
| spheroid | 1 | 6 | 4 | 11 |
| all | 11 | 33 | 22 | 66 |

## Spheres: model error × class
| class | none | error | all |
|---|---|---|---|
| -1 | 3 | 3 | 6 |
| 2/m | 3 | 3 | 6 |
| mmm | 3 | 3 | 6 |
| 4/m | 3 | 3 | 6 |
| 4/mmm | 3 | 3 | 6 |
| -3 | 3 | 3 | 6 |
| -3m | 3 | 3 | 6 |
| 6/m | 3 | 3 | 6 |
| 6/mmm | 3 | 3 | 6 |
| m-3 | 3 | 3 | 6 |
| m-3m | 3 | 3 | 6 |
| all | 33 | 33 | 66 |

## The hypercube
- Truths: 7 columns (smallest, ratio1, ratio2, counts, pb, eps, strength), sliced by solid (first six) and by error kind (strength). Minimum distance between two of the 396 points in the unit cube 0.3013 (the same sliced structure before annealing: median of 20 draws 0.1571). Largest correlation between two columns 0.0264 (ratio2 × pb, over 396 rows: the strength's correlations over the rows with an error, the others' over all), Pearson on the unit-cube coordinates.
- Spheres: 5 columns (D, counts, pb, eps, strength). Minimum distance 0.2381 (unannealed median 0.1786); largest correlation 0.0230 (D × strength, over 33 rows).
- 56 of the 396 truths had their ratios shrunk to keep the largest extent at 60 nm.
- On the factors as drawn (the cap acts on them, not on the cube): ρ(ln smallest, ln largest/smallest) -0.154 over the 396 truths; for the three-extent solids ρ(ln smallest, ln middle/smallest) -0.165, ρ(ln smallest, ln largest/middle) -0.220; mean ln(largest/smallest) by tercile of the smallest extent 1.41, 1.24, 1.17 (at the cap 6, 9, 41); every other pair under |ρ| 0.044 (ln largest/smallest × ln counts).
- The strength column, by error-kind slice (rows, empty 1/n bins): hump 26, 1; sizedist 60, 2; impurity 26, 0; air 26, 2; po 60, 0. The slices are dealt near (m + U)/n each and then given the global levels (k + ½)/396, so a slice of unequal size can miss a bin of its own.

## The factors per solid (min, median, max)
| solid | smallest nm | largest nm | counts | peak/bg | ε % | strength (with an error) |
|---|---|---|---|---|---|---|
| box | 2.04, 5.58, 15 | 5.40, 39, 60 | 312, 3088, 28141 | 1.00, 4.59, 20 | 0.000, 0.153, 0.298 | 0.06, 0.65, 0.99 |
| sqbox | 2.01, 5.63, 15 | 2.23, 12, 60 | 309, 3161, 28803 | 1.03, 4.56, 20 | 0.003, 0.150, 0.297 | 0.02, 0.59, 0.95 |
| cylinder | 2.05, 5.60, 15 | 3.17, 12, 60 | 305, 3017, 29481 | 1.02, 4.66, 19 | 0.002, 0.154, 0.299 | 0.02, 0.40, 0.98 |
| ellcyl | 2.02, 5.52, 15 | 3.77, 35, 60 | 320, 3053, 29140 | 1.04, 4.49, 19 | 0.004, 0.153, 0.297 | 0.01, 0.44, 0.94 |
| ellipsoid | 2.06, 5.55, 15 | 5.70, 32, 60 | 302, 3125, 28470 | 1.01, 4.52, 20 | 0.003, 0.151, 0.296 | 0.03, 0.49, 0.99 |
| spheroid | 2.03, 5.49, 15 | 3.00, 13, 55 | 316, 3198, 29826 | 1.03, 4.63, 19 | 0.001, 0.152, 0.300 | 0.00, 0.56, 1.00 |

## Orientation frames on the lattice (first axis: second axes)
- P-1: [100]: [010]; [010]: [100]; [001]: —; [110]: —; [101]: —
- P2m: [100]: [010]; [010]: [100] [001] [101]; [001]: [010]; [110]: —; [101]: [010]
- Pmmm: [100]: [010] [001] [011]; [010]: [100] [001] [101]; [001]: [100] [010] [110]; [110]: [001]; [101]: [010]
- P4m: [100]: [010] [001] [011]; [001]: [100] [010] [110]; [110]: [001] [-110] [1-11]; [101]: [010]; [111]: [-110]
- P4mmm: [100]: [010] [001] [011]; [001]: [100] [010] [110]; [110]: [001] [-110] [1-11]; [101]: [010]; [111]: [-110]
- P-3: [100]: [001] [120] [121]; [001]: [100] [010] [110]; [101]: [120]; [1-10]: [001] [110] [111]; [10-1]: [120]
- P-3m1: [100]: [001] [120] [121]; [001]: [100] [010] [110]; [101]: [120]; [1-10]: [001] [110] [111]
- P6m: [100]: [001] [120] [121]; [001]: [100] [010] [110]; [101]: [120]; [1-10]: [001] [110] [111]
- P6mmm: [100]: [001] [120] [121]; [001]: [100] [010] [110]; [101]: [120]; [1-10]: [001] [110] [111]
- Pm-3: [100]: [010] [001] [011]; [110]: [001] [-110] [1-11]; [111]: [-101] [-110] [0-11]
- Pm-3m: [100]: [010] [001] [011]; [110]: [001] [-110] [1-11]; [111]: [-101] [-110] [0-11]
