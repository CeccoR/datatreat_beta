# Design fs2-design-v1 (seed 20261026)

198 truths, 33 spheres; tuning 154, validation 77; screening set 77.

## Model error × solid (truths)
| solid | none | hump | sizedist | impurity | air | po | all |
|---|---|---|---|---|---|---|---|
| box | 16 | 3 | 3 | 4 | 4 | 3 | 33 |
| sqbox | 17 | 3 | 3 | 4 | 3 | 3 | 33 |
| cylinder | 17 | 4 | 3 | 3 | 3 | 3 | 33 |
| ellcyl | 17 | 3 | 4 | 3 | 3 | 3 | 33 |
| ellipsoid | 16 | 3 | 3 | 3 | 4 | 4 | 33 |
| spheroid | 16 | 4 | 4 | 3 | 3 | 3 | 33 |
| all | 99 | 20 | 20 | 20 | 20 | 19 | 198 |

## Model error × Laue class (truths)
| class | none | hump | sizedist | impurity | air | po | all |
|---|---|---|---|---|---|---|---|
| -1 | 9 | 2 | 2 | 2 | 1 | 2 | 18 |
| 2/m | 9 | 2 | 2 | 2 | 2 | 1 | 18 |
| mmm | 9 | 2 | 1 | 2 | 2 | 2 | 18 |
| 4/m | 9 | 1 | 2 | 2 | 2 | 2 | 18 |
| 4/mmm | 9 | 2 | 2 | 2 | 2 | 1 | 18 |
| -3 | 9 | 2 | 2 | 2 | 2 | 1 | 18 |
| -3m | 9 | 2 | 1 | 2 | 1 | 3 | 18 |
| 6/m | 9 | 2 | 2 | 1 | 2 | 2 | 18 |
| 6/mmm | 9 | 2 | 2 | 2 | 2 | 1 | 18 |
| m-3 | 9 | 1 | 2 | 2 | 2 | 2 | 18 |
| m-3m | 9 | 2 | 2 | 1 | 2 | 2 | 18 |
| all | 99 | 20 | 20 | 20 | 20 | 19 | 198 |

## Model error × orientation (truths)
| orientation | none | hump | sizedist | impurity | air | po | all |
|---|---|---|---|---|---|---|---|
| on | 33 | 7 | 7 | 7 | 6 | 6 | 66 |
| near | 33 | 6 | 7 | 6 | 7 | 7 | 66 |
| generic | 33 | 7 | 6 | 7 | 7 | 6 | 66 |
| all | 99 | 20 | 20 | 20 | 20 | 19 | 198 |

## Model error × split, and the screening set (truths)
| split | none | hump | sizedist | impurity | air | po | all |
|---|---|---|---|---|---|---|---|
| tuning (screening) | 33 | 7 | 7 | 7 | 6 | 6 | 66 |
| tuning | 33 | 6 | 7 | 7 | 7 | 6 | 66 |
| validation | 33 | 7 | 6 | 6 | 7 | 7 | 66 |
| all | 99 | 20 | 20 | 20 | 20 | 19 | 198 |

## Orientation × split (truths)
| orientation | tuning+screen | tuning | validation | all |
|---|---|---|---|---|
| on | 22 | 22 | 22 | 66 |
| near | 22 | 22 | 22 | 66 |
| generic | 22 | 22 | 22 | 66 |
| all | 66 | 66 | 66 | 198 |

## Spheres: model error × split
| split | none | hump | sizedist | impurity | air | po | all |
|---|---|---|---|---|---|---|---|
| tuning (screening) | 6 | 1 | 1 | 1 | 1 | 1 | 11 |
| tuning | 6 | 1 | 1 | 1 | 1 | 1 | 11 |
| validation | 5 | 2 | 1 | 1 | 1 | 1 | 11 |
| all | 17 | 4 | 3 | 3 | 3 | 3 | 33 |

## Spheres: solid searched × split
| searched as | tuning+screen | tuning | validation | all |
|---|---|---|---|---|
| box | 2 | 2 | 2 | 6 |
| sqbox | 2 | 2 | 2 | 6 |
| cylinder | 2 | 2 | 2 | 6 |
| ellcyl | 1 | 2 | 2 | 5 |
| ellipsoid | 2 | 1 | 2 | 5 |
| spheroid | 2 | 2 | 1 | 5 |
| all | 11 | 11 | 11 | 33 |

## Spheres: model error × class
| class | none | error | all |
|---|---|---|---|
| -1 | 2 | 1 | 3 |
| 2/m | 2 | 1 | 3 |
| mmm | 1 | 2 | 3 |
| 4/m | 2 | 1 | 3 |
| 4/mmm | 1 | 2 | 3 |
| -3 | 2 | 1 | 3 |
| -3m | 2 | 1 | 3 |
| 6/m | 1 | 2 | 3 |
| 6/mmm | 1 | 2 | 3 |
| m-3 | 1 | 2 | 3 |
| m-3m | 2 | 1 | 3 |
| all | 17 | 16 | 33 |

## The hypercube
- Truths: 7 columns (smallest, ratio1, ratio2, counts, pb, eps, strength), sliced by solid (first six) and by error kind (strength). Minimum distance between two of the 198 points in the unit cube 0.4796 (the same sliced structure before annealing: median of 20 draws 0.1990). Largest correlation between two columns 0.0031 (pb × strength, over 99 rows: the strength's correlations over the rows with an error, the others' over all), Pearson on the unit-cube coordinates.
- Spheres: 5 columns (D, counts, pb, eps, strength). Minimum distance 0.4762 (unannealed median 0.2247); largest correlation 0.0058 (pb × strength, over 16 rows).
- 30 of the 198 truths had their ratios shrunk to keep the largest extent at 60 nm.

## The factors per solid (min, median, max)
| solid | smallest nm | largest nm | counts | peak/bg | ε % | strength (with an error) |
|---|---|---|---|---|---|---|
| box | 2.05, 5.34, 14 | 4.30, 32, 60 | 333, 3180, 28971 | 1.04, 4.51, 19 | 0.007, 0.148, 0.293 | 0.02, 0.39, 0.87 |
| sqbox | 2.07, 5.62, 14 | 3.53, 12, 60 | 341, 3107, 27655 | 1.05, 4.64, 20 | 0.001, 0.151, 0.298 | 0.08, 0.53, 0.95 |
| cylinder | 2.01, 5.39, 15 | 2.74, 16, 60 | 325, 3035, 29653 | 1.01, 4.31, 18 | 0.004, 0.146, 0.296 | 0.00, 0.63, 0.98 |
| ellcyl | 2.12, 5.56, 15 | 4.00, 36, 60 | 311, 2897, 28305 | 1.07, 4.57, 19 | 0.008, 0.149, 0.299 | 0.06, 0.44, 0.93 |
| ellipsoid | 2.03, 5.51, 15 | 6.13, 31, 60 | 304, 2965, 27019 | 1.02, 4.44, 20 | 0.005, 0.152, 0.292 | 0.12, 0.49, 0.96 |
| spheroid | 2.09, 5.45, 14 | 2.23, 14, 54 | 318, 2831, 26398 | 1.09, 4.37, 19 | 0.002, 0.154, 0.295 | 0.05, 0.50, 1.00 |

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
