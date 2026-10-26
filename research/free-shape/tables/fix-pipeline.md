# The pipeline at the picked background degree, run by run

`scripts/fix/tools/pipe-sum.mjs`. Errors against the truth by compareSolids: thinnest dimension, largest dimension, the most distinct axis (the plate normal). BIC pick over refits of the degree-6 kept solid at 6, 12, 18 (ΔBIC of 6 and 12 against the best). Degree 18: the whole refinement again from the CIF with a degree-18 background.

## u

u: 12 runs; degree 6: 12 kept, flag 12; median |thin| 18 %, median max 71 %, median normal 5.8°, held 1
pick: {"18":12}; refit at the pick: median |thin| 6 %, median normal 5.7°
degree 18 searched: 12 kept, held 11; median |thin| 2 %, max |thin| 8 %, median max 7 %, median normal 0.0°, max normal 6.0°; flag at 18 2; worst segment 1.0–1.3; evaluations mean search 4584, report 2348, jackknife 1769, iso 520

| run | degree 6: kept, thin / max / normal error | worst segment χ²_ν | BIC pick (ΔBIC of 6, 12) | refit at the pick: thin / max / normal | searched at 18: kept, thin / max / normal | worst segment at 18 | evaluations at 18: search, report, jackknife |
|---|---|---|---|---|---|---|---|
| u01 | free, -17 % / 79 % / 6.1° | 1.6 | 18 (465, 54) | -8 % / 59 % / 6.1° | held, -1 % / 3 % / 0.0° | 1.1 | 3567, 2152, 1928 |
| u02 | free, -18 % / 59 % / 5.8° | 1.9 | 18 (630, 137) | -6 % / 38 % / 5.8° | held, -2 % / 4 % / 0.0° | 1.1 | 4920, 2296, 1593 |
| u03 | free, -22 % / 281 % / 6.5° | 2.6 | 18 (1304, 326) | -6 % / 77 % / 6.5° | held, -0 % / 2 % / 0.0° | 1.2 | 5366, 2938, 1915 |
| u04 | held, -6 % / 7 % / 0.0° | 1.3 | 18 (188, 31) | 5 % / 13 % / 0.0° | held, 5 % / 13 % / 0.0° | 1.1 | 4015, 1726, 1339 |
| u05 | free, -28 % / 973 % / 5.3° | 3.1 | 18 (1576, 357) | -3 % / 24 % / 4.2° | held, 1 % / 3 % / 0.0° | 1.3 | 5319, 2048, 2070 |
| u06 | free, -17 % / 218 % / 5.8° | 1.6 | 18 (413, 64) | -7 % / 89 % / 5.8° | held, -2 % / 4 % / 0.0° | 1.1 | 4638, 2528, 1390 |
| u07 | free, -22 % / 71 % / 5.7° | 2.1 | 18 (840, 92) | -5 % / 203 % / 5.7° | held, 2 % / 16 % / 0.0° | 1.1 | 3994, 2216, 1580 |
| u08 | free, -13 % / 20 % / 1.8° | 1.5 | 18 (419, 75) | 3 % / 9 % / 1.8° | held, 8 % / 28 % / 6.0° | 1.3 | 4387, 2304, 1811 |
| u09 | free, -16 % / 54 % / 9.0° | 1.4 | 18 (251, 39) | -7 % / 58 % / 9.0° | free, -2 % / 14 % / 3.4° | 1.0 | 5253, 2996, 1881 |
| u10 | free, -23 % / 0 % / 5.9° | 2.2 | 18 (891, 155) | 1 % / 28 % / 2.5° | held, 2 % / 2 % / 0.0° | 1.2 | 4268, 2622, 1745 |
| u11 | free, -12 % / 101 % / 4.9° | 1.4 | 18 (163, 30) | -5 % / 151 % / 4.9° | held, 1 % / 11 % / 0.0° | 1.1 | 4574, 2318, 2200 |
| u12 | free, -19 % / 38 % / 6.2° | 1.8 | 18 (698, 130) | -8 % / 57 % / 6.2° | held, -4 % / 10 % / 0.0° | 1.1 | 4712, 2037, 1781 |

## v

v: 12 runs; degree 6: 12 kept, flag 10; median |thin| 20 %, median max 108 %, median normal 6.0°, held 1
pick: {"12":1,"18":11}; refit at the pick: median |thin| 6 %, median normal 5.6°
degree 18 searched: 12 kept, held 9; median |thin| 2 %, max |thin| 8 %, median max 8 %, median normal 0.0°, max normal 6.0°; flag at 18 0; worst segment 1.0–1.2; evaluations mean search 4613, report 2321, jackknife 2123, iso 512

| run | degree 6: kept, thin / max / normal error | worst segment χ²_ν | BIC pick (ΔBIC of 6, 12) | refit at the pick: thin / max / normal | searched at 18: kept, thin / max / normal | worst segment at 18 | evaluations at 18: search, report, jackknife |
|---|---|---|---|---|---|---|---|
| v01 | free, -21 % / 108 % / 5.5° | 2.2 | 18 (980, 281) | -6 % / 91 % / 5.5° | held, -2 % / 32 % / 0.0° | 1.1 | 4595, 2582, 1759 |
| v02 | free, -25 % / 0 % / 9.0° | 1.6 | 18 (564, 113) | -4 % / 13 % / 4.2° | held, -2 % / 2 % / 0.0° | 1.1 | 3929, 2920, 1648 |
| v03 | free, -10 % / 14 % / 3.0° | 1.2 | 18 (175, 10) | -2 % / 7 % / 3.0° | held, 2 % / 13 % / 4.0° | 1.0 | 4040, 2126, 2509 |
| v04 | free, -25 % / 0 % / 7.8° | 2.3 | 18 (915, 229) | -13 % / 338 % / 7.8° | free, -8 % / 0 % / 5.0° | 1.2 | 5599, 1575, 2295 |
| v05 | free, -20 % / 221 % / 5.8° | 1.8 | 18 (626, 130) | -9 % / 126 % / 5.8° | held, -4 % / 4 % / 0.0° | 1.2 | 5552, 2492, 2403 |
| v06 | free, -19 % / 23790 % / 8.0° | 1.6 | 18 (435, 94) | -8 % / 69 % / 8.0° | held, 2 % / 4 % / 0.0° | 1.1 | 4416, 2412, 2146 |
| v07 | free, -18 % / 52 % / 6.0° | 2.0 | 18 (776, 150) | -4 % / 51 % / 6.0° | free, -2 % / 72 % / 5.0° | 1.1 | 4615, 2235, 2242 |
| v08 | free, -20 % / 0 % / 4.2° | 2.4 | 18 (1108, 305) | -7 % / 0 % / 4.2° | free, -3 % / 92 % / 3.7° | 1.1 | 5080, 1945, 2427 |
| v09 | free, -23 % / 0 % / 4.8° | 2.2 | 18 (1021, 223) | -10 % / 0 % / 4.8° | held, -2 % / 7 % / 0.0° | 1.1 | 4487, 2092, 1671 |
| v10 | free, -23 % / 0 % / 7.8° | 2.0 | 18 (728, 150) | -1 % / 59 % / 3.4° | held, 1 % / 8 % / 0.0° | 1.1 | 4560, 2766, 2362 |
| v11 | held, -6 % / 28 % / 6.0° | 1.2 | 12 (205, 0) | -0 % / 29 % / 6.0° | held, 4 % / 29 % / 6.0° | 1.1 | 4646, 2404, 2264 |
| v12 | free, -18 % / 406 % / 6.8° | 1.4 | 18 (368, 42) | -6 % / 179 % / 6.8° | held, -0 % / 3 % / 0.0° | 1.1 | 3841, 2304, 1744 |

## misfit

misfit: 8 runs; degree 6: 8 kept, flag 0; median |thin| 7 %, median max 14 %, median normal 0.0°, held 5
pick: {"6":8}; refit at the pick: median |thin| 7 %, median normal 0.0°

| run | degree 6: kept, thin / max / normal error | worst segment χ²_ν | BIC pick (ΔBIC of 6, 12) | refit at the pick: thin / max / normal | searched at 18: kept, thin / max / normal | worst segment at 18 | evaluations at 18: search, report, jackknife |
|---|---|---|---|---|---|---|---|
| box-plate110-air | held, 1 % / 4 % / 0.0° | 1.1 | 6 (0, 40) | 1 % / 4 % / 0.0° | not run | — | — |
| box-plate110-mix | free, -20 % / 20 % / 7.0° | 1.1 | 6 (0, 41) | -20 % / 20 % / 7.0° | not run | — | — |
| cyl-disc110-air | held, -3 % / 3 % / 0.0° | 1.1 | 6 (0, 44) | -3 % / 3 % / 0.0° | not run | — | — |
| cyl-disc110-mix | held, -12 % / 12 % / 0.0° | 1.1 | 6 (0, 40) | -12 % / 12 % / 0.0° | not run | — | — |
| ell-plate110-air | held, -0 % / 3 % / 0.0° | 1.1 | 6 (0, 48) | -0 % / 3 % / 0.0° | not run | — | — |
| ell-plate110-mix | held, -16 % / 16 % / 0.0° | 1.1 | 6 (0, 42) | -16 % / 16 % / 0.0° | not run | — | — |
| sqbox-plate001-air | free, -2 % / 48 % / 7.7° | 1.1 | 6 (0, 30) | -3 % / 48 % / 7.7° | not run | — | — |
| sqbox-plate001-mix | free, -21 % / 75 % / 10.2° | 1.1 | 6 (0, 49) | -21 % / 75 % / 10.2° | not run | — | — |
